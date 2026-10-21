import {mkdir,readFile,writeFile,open,rename,unlink} from 'node:fs/promises'
import {join,resolve,relative,sep} from 'node:path'
import {createHash,randomUUID} from 'node:crypto'
import {MarketError,normalizeResult,packageName,exactVersion} from './core.js'

const FILES=['package.json','pnpm-lock.yaml','cordis.patch.yml','cordis.yml','pnpm-workspace.yaml']
const CONFIG=['cordis.patch.yml','cordis.yml']
const fingerprint=bytes=>bytes===null?null:createHash('sha256').update(bytes).digest('hex')
const stable=value=>value&&typeof value==='object'?Array.isArray(value)?value.map(stable):Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value
const same=(a,b)=>JSON.stringify(stable(a))===JSON.stringify(stable(b))
async function optional(file){try{return await readFile(file)}catch(error){if(error.code==='ENOENT')return null;throw error}}
async function manifest(dir){return JSON.parse(await readFile(join(dir,'package.json'),'utf8'))}
function otherState(value,name){
  const copy=structuredClone(value);copy.dependencies={...copy.dependencies};delete copy.dependencies[name]
  copy.dsh.profile.bundles=(copy.dsh.profile.bundles??[]).filter(item=>item!==name)
  return copy
}

/** Only this transaction store's completed, exact archive can retain npm provenance.
 * Arbitrary local files and tarball URLs remain local sources.
 */
export async function reinstallOrigin(dir,name,specifier,version){
  if(typeof specifier!=='string'||!specifier.startsWith('file:'))return null
  const parts=relative(resolve(dir,'.lumen-market','reinstall'),resolve(dir,specifier.slice(5))).split(sep)
  if(parts.length!==2||!/^[a-f0-9-]{36}$/.test(parts[0])||!['target.tgz','previous.tgz'].includes(parts[1]))return null
  try{
    const data=JSON.parse(await readFile(join(dir,'.lumen-market','reinstall',parts[0],'journal.json'),'utf8'))
    const target=parts[1]==='target.tgz',expected=target?data.toVersion:data.fromVersion,archive=target?data.targetArchive:data.previousArchive
    if(data.name!==name||version!==expected||(target?data.status!=='completed':data.status!=='rolled-back')||!archive?.integrity?.startsWith('sha512-'))return null
    return {name,version,integrity:archive.integrity}
  }catch{return null}
}

/** Confirmed, sequential use of the official manager. Never deletes plugin directories.
 * Archives and a private journal survive failures; unfinished operations fail closed.
 */
export class Reinstaller{
  constructor({npm,fetchImpl=fetch,maxBytes=64*1024*1024}={}){this.npm=npm;this.fetch=fetchImpl;this.maxBytes=maxBytes}
  async pending(dir){
    const active=await optional(join(dir,'.lumen-market','reinstall-active.json'))
    if(!active)return null
    return {status:'recovery-required',backupRoot:join(dir,'.lumen-market','reinstall')}
  }
  async archive(row,file){
    const dist=row.manifest?.dist
    let url=new URL(dist?.tarball??'invalid:')
    const registry=row.registry?new URL(row.registry):null
    const allowed=value=>!value.username&&!value.password&&!value.hash&&(value.protocol==='https:'||value.protocol==='http:'&&registry?.origin===value.origin)
    if(!allowed(url))throw new MarketError('reinstall-package-unavailable',409)
    const checks=String(dist?.integrity??'').split(/\s+/).filter(value=>/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(value))
    if(!checks.length)throw new MarketError('reinstall-package-unavailable',409)
    const signal=AbortSignal.timeout(30000)
    let response
    for(let redirects=0;redirects<=3;redirects++){
      response=await this.fetch(url.href,{redirect:'manual',signal})
      if(![301,302,303,307,308].includes(response.status))break
      await response.body?.cancel()
      const location=response.headers.get('location')
      if(redirects===3||!location)throw new MarketError('reinstall-package-unavailable',409)
      const next=new URL(location,url)
      if(!allowed(next)||url.protocol==='https:'&&next.protocol!=='https:')throw new MarketError('reinstall-package-unavailable',409)
      url=next
    }
    if(!response.ok||!response.body)throw new MarketError('reinstall-package-unavailable',409)
    if(Number(response.headers.get('content-length'))>this.maxBytes){await response.body.cancel();throw new MarketError('package-too-large',409)}
    const reader=response.body.getReader(),chunks=[];let size=0
    try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>this.maxBytes)throw new MarketError('package-too-large',409);chunks.push(Buffer.from(value))}}
    finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
    const bytes=Buffer.concat(chunks),integrity='sha512-'+createHash('sha512').update(bytes).digest('base64')
    if(!checks.includes(integrity))throw new MarketError('package-integrity',409)
    await writeFile(file,bytes,{flag:'wx',mode:0o600})
    return {integrity,bytes:size}
  }
  async run({dir,existing,target,manager,onPhase=()=>{},assertActive=()=>{}}){
    if(!packageName(existing.name)||!exactVersion(existing.installed)||target.name!==existing.name||!exactVersion(target.version))throw new MarketError('invalid-target')
    const stateDir=join(dir,'.lumen-market'),active=join(stateDir,'reinstall-active.json'),id=randomUUID(),backupDir=join(stateDir,'reinstall',id)
    await mkdir(stateDir,{recursive:true})
    let handle
    try{handle=await open(active,'wx',0o600)}catch(error){if(error.code==='EEXIST')throw new MarketError('recovery-required',409);throw error}
    await handle.writeFile(JSON.stringify({id}));await handle.close()
    const journal={schemaVersion:1,id,name:existing.name,fromVersion:existing.installed,toVersion:target.version,status:'preparing',startedAt:new Date().toISOString()}
    let touched=false,terminal=false,recovering=false,before,saved,oldArchive
    const record=async status=>{
      journal.status=status;journal.updatedAt=new Date().toISOString()
      await writeFile(join(backupDir,'journal.json.tmp'),JSON.stringify(journal,null,2)+'\n',{mode:0o600})
      await rename(join(backupDir,'journal.json.tmp'),join(backupDir,'journal.json'))
      onPhase(status)
    }
    const configsUnchanged=async()=>{
      for(const file of CONFIG)if(fingerprint(await optional(join(dir,file)))!==fingerprint(saved[file]))throw new MarketError('recovery-required',409)
    }
    const checkOtherState=async()=>{
      if(!same(otherState(await manifest(dir),existing.name),otherState(before,existing.name)))throw new MarketError('recovery-required',409)
      await configsUnchanged()
    }
    const verify=async version=>{
      const installed=JSON.parse(await readFile(join(dir,'node_modules',existing.name,'package.json'),'utf8'))
      if(installed.name!==existing.name||installed.version!==version)throw new MarketError('installed-version-mismatch',409)
      await checkOtherState()
      if(!same((await manifest(dir)).dsh.profile.bundles,before.dsh.profile.bundles))throw new MarketError('recovery-required',409)
    }
    const recover=async()=>{
      recovering=true
      await record('restoring');await checkOtherState()
      const current=await manifest(dir)
      if(current.dependencies?.[existing.name]){
        let version
        try{version=JSON.parse(await readFile(join(dir,'node_modules',existing.name,'package.json'),'utf8')).version}catch{}
        if(version===existing.installed){
          const enabled=normalizeResult(await manager.setBundleEnabled(existing.name,existing.bundle===true))
          if(!enabled.ok)throw new MarketError('recovery-required',409)
          await verify(existing.installed);return false
        }
        const removed=normalizeResult(await manager.removeBundle(existing.name));if(!removed.ok)throw new MarketError('recovery-required',409)
      }
      // The verified local archive avoids re-fetching the previous package itself; dependencies remain managed by the host.
      const restored=normalizeResult(await manager.installBundle(oldArchive,{enabled:existing.bundle===true}))
      if(!restored.ok)throw new MarketError('recovery-required',409)
      await verify(existing.installed);return true
    }
    try{
      await mkdir(join(backupDir,'files'),{recursive:true});await record('preparing')
      saved=Object.fromEntries(await Promise.all(FILES.map(async file=>[file,await optional(join(dir,file))])))
      if(!saved['package.json'])throw new MarketError('profile-unreadable',409)
      before=JSON.parse(saved['package.json'].toString('utf8'))
      if(before.dependencies?.[existing.name]!==existing.specifier)throw new MarketError('preview-stale',409)
      const order=before.dsh?.profile?.bundles??[]
      if(order.includes(existing.name)!==(existing.bundle===true))throw new MarketError('preview-stale',409)
      if(order.includes(existing.name)&&order.at(-1)!==existing.name)throw new MarketError('reinstall-order-unsupported',409)
      const installedBefore=JSON.parse(await readFile(join(dir,'node_modules',existing.name,'package.json'),'utf8'))
      if(installedBefore.name!==existing.name||installedBefore.version!==existing.installed)throw new MarketError('preview-stale',409)
      for(const file of FILES)if(saved[file])await writeFile(join(backupDir,'files',file),saved[file],{mode:0o600})
      const old=await this.npm.detail(existing.name,existing.installed,{fresh:true})
      if(old.name!==existing.name||old.version!==existing.installed)throw new MarketError('reinstall-package-unavailable',409)
      oldArchive=join(backupDir,'previous.tgz')
      journal.previousArchive=await this.archive(old,oldArchive)
      journal.targetArchive=await this.archive(target,join(backupDir,'target.tgz'))
      for(const file of FILES)if(fingerprint(await optional(join(dir,file)))!==fingerprint(saved[file]))throw new MarketError('preview-stale',409)
      assertActive();await record('removing');assertActive();touched=true
      const removal=normalizeResult(await manager.removeBundle(existing.name))
      if(!removal.ok){
        const local=await recover();await record('rolled-back');terminal=true
        return {...removal,upgradeMode:'reinstall',recovery:{status:'restored',localArchive:local},backupDir}
      }
      await checkOtherState()
      if((await manifest(dir)).dependencies?.[existing.name])throw new MarketError('removal-incomplete',409)
      assertActive();await record('installing');assertActive()
      const installed=normalizeResult(await manager.installBundle(join(backupDir,'target.tgz'),{enabled:existing.bundle===true}))
      if(!installed.ok){
        const local=await recover();await record('rolled-back');terminal=true
        return {...installed,upgradeMode:'reinstall',recovery:{status:'restored',localArchive:local},backupDir}
      }
      await verify(target.version);await record('completed');terminal=true
      return {...installed,upgradeMode:'reinstall',backupDir}
    }catch(error){
      if(!touched){await record('aborted');terminal=true;throw error instanceof MarketError?error:new MarketError('reinstall-preparation-failed',409)}
      if(recovering){await record('recovery-required');return {ok:false,application:'failed',changed:true,error:{code:'recovery-required'},upgradeMode:'reinstall',recovery:{status:'required'},backupDir}}
      try{
        const local=await recover();await record('rolled-back');terminal=true
        return {ok:false,application:'failed',changed:true,error:{code:error.code??'upgrade-failed'},upgradeMode:'reinstall',recovery:{status:'restored',localArchive:local},backupDir}
      }catch{
        await record('recovery-required')
        return {ok:false,application:'failed',changed:true,error:{code:'recovery-required'},upgradeMode:'reinstall',recovery:{status:'required'},backupDir}
      }
    }finally{
      // Only this explicit lock file is removed. Archive/config evidence is retained.
      if(terminal)await unlink(active)
    }
  }
}
