import {mkdir,readFile,writeFile,readdir,stat,rename} from 'node:fs/promises'
import {join,isAbsolute} from 'node:path'
import {createHash,randomUUID} from 'node:crypto'
import {MarketError,packageName,exactVersion,npmInstalled} from './core.js'

const FILES=['package.json','pnpm-lock.yaml','cordis.patch.yml','cordis.yml','pnpm-workspace.yaml']
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/
const hash=data=>data===null?null:createHash('sha256').update(data).digest('hex')
const fail=()=>{throw new MarketError('invalid-backup',400)}
async function bytes(file,max=16*1024*1024){
  try{const info=await stat(file);if(!info.isFile()||info.size>max)throw new MarketError('backup-too-large',413);return await readFile(file)}
  catch(error){if(error.code==='ENOENT')return null;throw error}
}
function root(dir){if(!isAbsolute(dir))throw new MarketError('profile-not-found',409);return join(dir,'.lumen-market','backups')}
function plugin(row){
  const version=exactVersion(row.installed)?row.installed:null
  let source=npmInstalled(row)?'npm':row.source,target
  if(source==='npm'&&version)target=`${row.name}@${version}`
  if(source==='git'){
    const match=/^(?:github:|(?:git\+)?https:\/\/github\.com\/)([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+?)(?:\.git)?#([a-f0-9]{40})$/i.exec(row.specifier??'')
    if(match&&match[0].length<=256)target=`github:${match[1]}#${match[2]}`
  }
  if(!['npm','git','local','tarball','alias','shipped','other'].includes(source))source='other'
  return {name:row.name,version,source,bundle:row.bundle===true,enabled:row.enabled!==false,...(target?{target}:{manual:true})}
}
function portable(value){
  if(value?.schemaVersion!==1||value.format!=='dsh-lumen-profile'||!Array.isArray(value.plugins)||value.plugins.length>500||!Array.isArray(value.bundleOrder)||value.bundleOrder.length>500)fail()
  if(value.runtimeVersion!==null&&!exactVersion(value.runtimeVersion))fail()
  if(typeof value.createdAt!=='string'||value.createdAt.length>40||!Number.isFinite(Date.parse(value.createdAt)))fail()
  const names=new Set(),plugins=value.plugins.map(item=>{
    if(!packageName(item?.name)||names.has(item.name)||item.version!==null&&!exactVersion(item.version)||!['npm','git','local','tarball','alias','shipped','other'].includes(item.source)||typeof item.bundle!=='boolean'||typeof item.enabled!=='boolean')fail()
    names.add(item.name)
    if(item.target!==undefined){
      const npm=item.source==='npm'&&item.version&&item.target===`${item.name}@${item.version}`
      const git=item.source==='git'&&typeof item.target==='string'&&item.target.length<=256&&/^github:[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+#[a-f0-9]{40}$/i.test(item.target)
      if(!npm&&!git)fail()
    }
    return {name:item.name,version:item.version,source:item.source,bundle:item.bundle,enabled:item.enabled,...(item.target?{target:item.target}:{manual:true})}
  })
  if(value.bundleOrder.some(name=>!packageName(name))||new Set(value.bundleOrder).size!==value.bundleOrder.length)fail()
  return {schemaVersion:1,format:'dsh-lumen-profile',createdAt:value.createdAt,runtimeVersion:value.runtimeVersion,plugins,bundleOrder:[...value.bundleOrder]}
}
function summary(meta,dir){return {id:meta.id,createdAt:meta.createdAt,pluginCount:meta.plugins.length,fileCount:meta.files.filter(file=>file.present).length,directory:join(root(dir),meta.id)}}

/** Raw configuration stays in a private local snapshot. Portable exports contain no configuration text or machine paths. */
export class ProfileBackups{
  async create(context){
    const dir=context.profile.dir,id=randomUUID(),directory=join(root(dir),id)
    const saved=Object.fromEntries(await Promise.all(FILES.map(async name=>[name,await bytes(join(dir,name))])))
    if(!saved['package.json'])throw new MarketError('profile-unreadable',409)
    const manifest=JSON.parse(saved['package.json'].toString('utf8'))
    if(!manifest.dsh?.profile||typeof manifest.dsh.profile!=='object'||Array.isArray(manifest.dsh.profile))throw new MarketError('profile-unreadable',409)
    const dependencies=manifest.dependencies??{},expected=context.dependencies??Object.fromEntries(context.rows.filter(row=>row.specifier!==undefined).map(row=>[row.name,row.specifier]))
    const entries=value=>Object.entries(value).sort(([a],[b])=>a.localeCompare(b))
    if(!dependencies||typeof dependencies!=='object'||Array.isArray(dependencies)||Object.keys(dependencies).some(name=>!packageName(name)))throw new MarketError('profile-unreadable',409)
    if(JSON.stringify(entries(dependencies))!==JSON.stringify(entries(expected)))throw new MarketError('preview-stale',409)
    if(JSON.stringify(manifest.dsh?.profile?.bundles??[])!==JSON.stringify(context.bundleOrder??[]))throw new MarketError('preview-stale',409)
    for(const row of context.rows)if(row.source!=='shipped'&&manifest.dependencies?.[row.name]!==row.specifier)throw new MarketError('preview-stale',409)
    const meta={...portable({schemaVersion:1,format:'dsh-lumen-profile',createdAt:new Date().toISOString(),runtimeVersion:exactVersion(context.runtimeVersion)?context.runtimeVersion:null,plugins:context.rows.map(plugin),bundleOrder:context.bundleOrder??[]}),id,
      files:FILES.map(name=>({name,present:saved[name]!==null,bytes:saved[name]?.length??0,sha256:hash(saved[name])}))}
    await mkdir(join(directory,'files'),{recursive:true,mode:0o700})
    for(const name of FILES)if(saved[name]!==null)await writeFile(join(directory,'files',name),saved[name],{mode:0o600,flag:'wx'})
    for(const name of FILES)if(hash(await bytes(join(dir,name)))!==hash(saved[name]))throw new MarketError('preview-stale',409)
    await writeFile(join(directory,'index.json.tmp'),JSON.stringify(meta,null,2)+'\n',{mode:0o600,flag:'wx'})
    await rename(join(directory,'index.json.tmp'),join(directory,'index.json'))
    return summary(meta,dir)
  }
  async load(dir,id){
    if(typeof id!=='string'||!UUID.test(id))fail()
    const data=await bytes(join(root(dir),id,'index.json'),512*1024)
    if(!data)throw new MarketError('backup-not-found',404)
    let meta
    try{meta=JSON.parse(data.toString('utf8'))}catch{fail()}
    portable(meta)
    if(meta.id!==id||!Array.isArray(meta.files)||meta.files.length!==FILES.length||new Set(meta.files.map(file=>file.name)).size!==FILES.length)fail()
    for(const file of meta.files)if(!FILES.includes(file.name)||typeof file.present!=='boolean'||file.present&&!/^[a-f0-9]{64}$/.test(file.sha256)||!file.present&&file.sha256!==null)fail()
    return meta
  }
  async list(dir){
    let entries
    try{entries=await readdir(root(dir),{withFileTypes:true})}catch(error){if(error.code==='ENOENT')return [];throw error}
    const found=[]
    for(const entry of entries){if(!entry.isDirectory()||!UUID.test(entry.name))continue;try{found.push(summary(await this.load(dir,entry.name),dir))}catch{}}
    return found.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,20)
  }
  async export(dir,id){return portable(await this.load(dir,id))}
  async preview(context,options){
    if(!options||Object.keys(options).length!==1||!Object.hasOwn(options,'backupId')&&!Object.hasOwn(options,'backup'))fail()
    let backup,configuration=[]
    if(Object.hasOwn(options,'backupId')){
      const meta=await this.load(context.profile.dir,options.backupId)
      for(const file of meta.files){
        const saved=await bytes(join(root(context.profile.dir),meta.id,'files',file.name))
        if(hash(saved)!==file.sha256)throw new MarketError('backup-integrity',409)
        configuration.push({name:file.name,changed:hash(await bytes(join(context.profile.dir,file.name)))!==file.sha256})
      }
      backup=portable(meta)
    }else backup=portable(options.backup)
    const current=new Map(context.rows.map(row=>[row.name,row])),saved=new Set(backup.plugins.map(row=>row.name)),missing=[],changedVersions=[],changedState=[],changedSources=[]
    for(const row of backup.plugins){
      const installed=current.get(row.name)
      if(!installed)missing.push(row)
      else{
        const source=plugin(installed)
        if(source.source!==row.source||source.target!==row.target)changedSources.push({name:row.name,current:source.source,backup:row.source,currentTarget:source.target??null,backupTarget:row.target??null})
        if(installed.installed!==row.version)changedVersions.push({name:row.name,current:exactVersion(installed.installed)?installed.installed:null,backup:row.version})
        if((installed.enabled!==false)!==row.enabled||(installed.bundle===true)!==row.bundle)changedState.push({name:row.name,enabled:row.enabled,bundle:row.bundle})
      }
    }
    return {readOnly:true,runtimeChanged:backup.runtimeVersion!==context.runtimeVersion,missing,changedVersions,changedState,changedSources,manualSources:backup.plugins.filter(row=>row.manual).map(row=>row.name),kept:context.rows.filter(row=>!saved.has(row.name)).map(row=>({name:row.name,version:exactVersion(row.installed)?row.installed:null})),orderChanged:JSON.stringify(context.bundleOrder??[])!==JSON.stringify(backup.bundleOrder),configuration}
  }
}
