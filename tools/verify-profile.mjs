/** Disposable official DSH acceptance. Keeps every Profile and log; never deletes directories.
 * The acceptance sequence follows AI-Scarlett/build-dsh-plugin's public E3 guidance.
 * Usage: node tools/verify-profile.mjs <official lib/bin.js> <plugin.tgz>
 */
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdir,writeFile,readFile,readdir} from 'node:fs/promises'
import {resolve,join,dirname} from 'node:path'
import {createServer} from 'node:net'
import {createServer as createHttpServer} from 'node:http'
import {createHash} from 'node:crypto'

const [cliArg,packageArg,mode]=process.argv.slice(2)
const testReinstall=mode==='--reinstall'
const testUpgrade=mode==='--upgrade'||testReinstall
if(!cliArg||!packageArg)throw new Error('Pass an official DSH CLI and the exact plugin tarball')
const cli=resolve(cliArg),tarball=resolve(packageArg)
const root=resolve('verification',`profile-acceptance-${Date.now()}`)
await mkdir(root,{recursive:true})
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!/(TOKEN|SECRET|PASSWORD|API_KEY|AUTH|CREDENTIAL)/i.test(key)))
Object.assign(env,{DSH_HOME:join(root,'home'),DSH_AGENTS_HOME:join(root,'agents'),DSH_TELEMETRY_DISABLED:'1',npm_config_cache:join(root,'npm-cache'),npm_config_userconfig:join(root,'.npmrc'),npm_config_registry:'https://registry.npmjs.org/',CI:'true'})
await writeFile(env.npm_config_userconfig,'',{mode:0o600})
const evidence={schemaVersion:1,checkedAt:new Date().toISOString(),platform:process.platform,node:process.version,packageSha256:createHash('sha256').update(await readFile(tarball)).digest('hex'),install:'unknown',start:'unknown',uninstall:'unknown',rollback:'unknown',desktopUi:'not-tested',root}
let host,stage='version'
const pause=ms=>new Promise(done=>setTimeout(done,ms))
async function runtimeHash(packageRoot){
  const files=['cordis.patch.yml']
  async function walk(dir){for(const entry of await readdir(join(packageRoot,dir),{withFileTypes:true})){const file=dir+'/'+entry.name;if(entry.isDirectory())await walk(file);else files.push(file)}}
  await walk('lib')
  const hash=createHash('sha256')
  for(const file of files.sort()){hash.update(file+'\0');hash.update(await readFile(join(packageRoot,file)));hash.update('\0')}
  return hash.digest('hex')
}
async function run(args,{entry=cli,cwd=root}={}){
  return new Promise((done,reject)=>{
    const child=spawn(process.execPath,[entry,...args],{cwd,env,windowsHide:true,stdio:['ignore','pipe','pipe']})
    let output=''
    child.stdout.on('data',data=>{output+=data});child.stderr.on('data',data=>{output+=data})
    const timeout=setTimeout(()=>child.kill(),180000)
    child.once('error',error=>{clearTimeout(timeout);reject(error)})
    child.once('exit',code=>{clearTimeout(timeout);if(code===0)done(output);else reject(new Error(`CLI exit ${code}: ${output.slice(-3000)}`))})
  })
}
async function stop(){
  if(!host||host.exitCode!==null)return
  const ended=new Promise(done=>host.once('exit',done))
  host.kill();await ended;host=null
}
async function boot(){
  const server=createServer()
  await new Promise((done,reject)=>server.once('error',reject).listen(0,'127.0.0.1',done))
  const port=server.address().port
  await new Promise(done=>server.close(done))
  host=spawn(process.execPath,[cli,'web','--no-open','--port',String(port)],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']})
  let output=''
  for(const stream of [host.stdout,host.stderr])stream.on('data',data=>{output=(output+data).slice(-65536)})
  let launch
  for(let i=0;i<300;i++){
    launch=/dsh web: (http:\/\/[^\s]+)/.exec(output)?.[1]
    if(launch)break
    if(host.exitCode!==null)throw new Error(`Host exited ${host.exitCode}`)
    await pause(500)
  }
  assert.ok(launch,'Host must report its authenticated launch URL: '+output.slice(-3000).replace(/https?:\/\/[^\s]+/g,'[URL redacted]'))
  const localLaunch=new URL(launch);evidence.bootHost=localLaunch.hostname;localLaunch.hostname='127.0.0.1'
  evidence.bootStage='login'
  const login=await fetch(localLaunch,{redirect:'manual',signal:AbortSignal.timeout(30000)})
  assert.ok([302,303].includes(login.status))
  const cookie=login.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ')
  assert.ok(cookie)
  const base=localLaunch.origin
  evidence.bootStage='health'
  let response
  for(let i=0;i<30;i++){
    response=await fetch(`${base}/api/lumen-market/health`,{headers:{cookie,'x-dsh-lumen-market':'1'},signal:AbortSignal.timeout(10000)})
    if(response.status===200)break
    await response.body?.cancel();await pause(500)
  }
  assert.equal(response.status,200)
  const health=await response.json()
  assert.equal(health.ok,true);assert.equal(health.managementAvailable,true)
  assert.equal(resolve(health.profile.dir),resolve(env.DSH_HOME,'profiles','web'))
  evidence.bootStage='installed'
  const installedResponse=await fetch(`${base}/api/lumen-market/installed`,{headers:{cookie,'x-dsh-lumen-market':'1'},signal:AbortSignal.timeout(10000)})
  assert.equal(installedResponse.status,200)
  const inventory=await installedResponse.json()
  assert.ok(inventory.rows.some(row=>row.name==='dsh-lumen-market'))
  return {base,cookie,health,inventory}
}

const fixtureName='dsh-lumen-upgrade-fixture',profileDir=join(env.DSH_HOME,'profiles','web')
let fixturePacks,savedPatch,registryServer,registryUrl,tarRequests={}
async function prepareUpgrade(){
  const npmCli=process.env.npm_execpath||join(dirname(process.execPath),'node_modules/npm/bin/npm-cli.js')
  fixturePacks=[]
  for(const [version,incompatible] of [['1.0.0',false],['2.0.0',false],['3.0.0',true],['4.0.0',false]]){
    const dir=join(root,'fixtures',version);await mkdir(dir,{recursive:true})
    const manifest={name:fixtureName,version,type:'module',main:'index.js',license:'MIT',...(version==='4.0.0'||incompatible?{}:{engines:{dsh:'>=0.2.0 <0.3.0'}}),dsh:{bundle:{patch:'./cordis.patch.yml'}},...(incompatible?{peerDependencies:{'@deepseek-ai/dsh-base':'99.0.0'}}:{})}
    await writeFile(join(dir,'package.json'),JSON.stringify(manifest,null,2))
    await writeFile(join(dir,'index.js'),"export const name='lumenUpgradeFixture'; export function apply() {}\n")
    await writeFile(join(dir,'cordis.patch.yml'),'- insert:\n    - id: lumen-upgrade-fixture\n      name: '+fixtureName+'\n')
    await run(['pack','--ignore-scripts','--json'],{entry:npmCli,cwd:dir})
    fixturePacks.push(join(dir,fixtureName+'-'+version+'.tgz'))
  }
  if(testReinstall){await startRegistry();await run(['plugin','--profile','web','add','--ignore-scripts','--config.auto-install-peers=false','--registry='+registryUrl,fixtureName+'@1.0.0']);await writeFile(join(profileDir,'.npmrc'),'registry='+registryUrl+'\n')}
  else await installFixture(fixturePacks[0])
  savedPatch=await readFile(join(profileDir,'cordis.patch.yml'),'utf8')
  await writeFile(join(profileDir,'cordis.patch.yml'),'- id: lumen-upgrade-fixture\n  disabled: '+(testReinstall?'false':'true')+'\n  config:\n    sentinel: preserve-me\n')
}
async function startRegistry(){
  const packages={}
  for(const version of ['1.0.0','2.0.0','3.0.0','4.0.0']){
    const bytes=await readFile(fixturePacks[['1.0.0','2.0.0','3.0.0','4.0.0'].indexOf(version)])
    const meta=JSON.parse(await readFile(join(root,'fixtures',version,'package.json'),'utf8'))
    // Simulate metadata that passes preflight but whose installed 3.0.0 payload is incompatible.
    delete meta.peerDependencies
    packages[version]={bytes,meta}
  }
  registryServer=createHttpServer(async(req,res)=>{
    const path=new URL(req.url,'http://localhost').pathname
    if(path==='/semver'||path.startsWith('/semver/')){try{const upstream=await fetch('https://registry.npmjs.org'+path,{signal:AbortSignal.timeout(20000)});res.writeHead(upstream.status,{'content-type':'application/json'});res.end(await upstream.text())}catch{res.writeHead(502);res.end('{}')}return}
    if(path.startsWith('/tar/')){const version=path.slice(5).replace('.tgz','');const item=packages[version];if(item){tarRequests[version]=(tarRequests[version]||0)+1;res.writeHead(200,{'content-type':'application/octet-stream'});res.end(item.bytes);return}}
    const versions=Object.fromEntries(Object.entries(packages).map(([version,item])=>[version,{...item.meta,dist:{tarball:registryUrl+'/tar/'+version+'.tgz',integrity:'sha512-'+createHash('sha512').update(item.bytes).digest('base64')}}]))
    if(path==='/'+fixtureName){res.setHeader('content-type','application/json');res.end(JSON.stringify({name:fixtureName,'dist-tags':{latest:'2.0.0'},versions,time:{created:'2026-01-01T00:00:00.000Z',modified:'2026-01-01T00:00:00.000Z',...Object.fromEntries(Object.keys(versions).map(v=>[v,'2026-01-01T00:00:00.000Z']))}}));return}
    const version=path.split('/').at(-1)==='latest'?'2.0.0':path.split('/').at(-1)
    if(path.startsWith('/'+fixtureName+'/')&&versions[version]){res.setHeader('content-type','application/json');res.end(JSON.stringify(versions[version]));return}
    res.writeHead(404);res.end('{}')
  })
  await new Promise(done=>registryServer.listen(0,'127.0.0.1',done));registryUrl='http://127.0.0.1:'+registryServer.address().port
}
async function reinstallRunning(session){
  const headers={cookie:session.cookie,'x-dsh-lumen-market':'1','content-type':'application/json'}
  const call=async(path,body)=>{
    const res=await fetch(session.base+'/api/lumen-market'+path,{headers,method:body?'POST':'GET',...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(180000)})
    return {status:res.status,data:await res.json()}
  }
  const before=JSON.parse(await readFile(join(profileDir,'package.json'),'utf8'))
  const config=await readFile(join(profileDir,'cordis.patch.yml'),'utf8')
  const created=await call('/backup',{})
  assert.equal(created.status,200);const backupId=created.data.backup.id
  const exported=await call('/backup-export',{backupId})
  assert.equal(exported.status,200)
  const portable=JSON.stringify(exported.data.backup)
  assert.equal(portable.includes(root),false);assert.equal(portable.includes('preserve-me'),false);assert.equal(portable.includes('apiKey'),false)
  const initialDiff=await call('/backup-preview',{backupId})
  assert.equal(initialDiff.status,200);assert.equal(initialDiff.data.diff.readOnly,true)
  evidence.profileBackupAndPortableExport='passed'
  const unknown=await call('/inspect',{action:'upgrade',source:'npm',name:fixtureName,version:'4.0.0'})
  assert.equal(unknown.status,200);assert.equal(unknown.data.preview.compatibility.verdict,'unknown');assert.equal(unknown.data.preview.requiresCompatibilityConsent,true)
  const blockedUnknown=await call('/upgrade',{previewId:unknown.data.previewId,reinstallConsent:true})
  assert.equal(blockedUnknown.status,409);assert.equal(blockedUnknown.data.code,'compatibility-consent-required')
  evidence.unknownCompatibilityConsent='passed'

  let plan=await call('/inspect',{action:'upgrade',source:'npm',name:fixtureName,version:'2.0.0'})
  assert.equal(plan.status,200);assert.equal(plan.data.preview.upgradeMode,'reinstall')
  const noConsent=await call('/upgrade',{previewId:plan.data.previewId})
  assert.equal(noConsent.status,409);assert.equal(noConsent.data.code,'reinstall-consent-required')
  let result=await call('/upgrade',{previewId:plan.data.previewId,reinstallConsent:true,...(plan.data.preview.requiresCompatibilityConsent?{compatibilityConsent:true}:{})})
  assert.equal(result.status,200);assert.equal(result.data.ok,true,JSON.stringify(result.data));assert.equal(result.data.upgradeMode,'reinstall')
  assert.equal(JSON.parse(await readFile(join(profileDir,'node_modules',fixtureName,'package.json'),'utf8')).version,'2.0.0')
  assert.equal(await readFile(join(profileDir,'cordis.patch.yml'),'utf8'),config)
  assert.deepEqual(JSON.parse(await readFile(join(profileDir,'package.json'),'utf8')).dsh.profile.bundles,before.dsh.profile.bundles)
  assert.equal(tarRequests['2.0.0'],1,'manager installs staged target without downloading it again');evidence.installFromVerifiedArchive='passed'
  evidence.confirmedRunningReinstall='passed';evidence.settingsAndOrderPreserved=true
  plan=await call('/inspect',{action:'upgrade',source:'npm',name:fixtureName,version:'3.0.0'})
  assert.equal(plan.status,200)
  result=await call('/upgrade',{previewId:plan.data.previewId,reinstallConsent:true,...(plan.data.preview.requiresCompatibilityConsent?{compatibilityConsent:true}:{})})
  assert.equal(result.status,200);assert.equal(result.data.ok,false);assert.equal(result.data.recovery.status,'restored',JSON.stringify(result.data));assert.equal(result.data.recovery.localArchive,true)
  assert.equal(JSON.parse(await readFile(join(profileDir,'node_modules',fixtureName,'package.json'),'utf8')).version,'2.0.0')
  assert.equal(await readFile(join(profileDir,'cordis.patch.yml'),'utf8'),config)
  assert.deepEqual(JSON.parse(await readFile(join(profileDir,'package.json'),'utf8')).dsh.profile.bundles,before.dsh.profile.bundles)
  const updates=await call('/updates')
  const recovered=updates.data.rows.find(row=>row.name===fixtureName)
  assert.equal(recovered.installed,'2.0.0');assert.equal(recovered.npmOrigin.name,fixtureName);assert.equal(recovered.latest,'2.0.0')
  const backupDiff=await call('/backup-preview',{backupId})
  assert.equal(backupDiff.status,200);assert.ok(backupDiff.data.diff.changedVersions.some(row=>row.name===fixtureName));assert.equal(backupDiff.data.diff.readOnly,true)
  evidence.readOnlyRestoreDiff='passed'
  evidence.verifiedArchiveOrigin='passed'
  evidence.runningReinstallRecovery='passed';evidence.localRecoverySource='verified local archive'
}
const installFixture=path=>run(['plugin','--profile','web','add','--ignore-scripts','--config.auto-install-peers=false','--config.strict-peer-dependencies=false',path])
async function upgradeStopped(){
  const settings=await readFile(join(profileDir,'cordis.patch.yml'),'utf8')
  const before=JSON.parse(await readFile(join(profileDir,'package.json'),'utf8'))
  const version=async()=>JSON.parse(await readFile(join(profileDir,'node_modules',fixtureName,'package.json'),'utf8')).version
  await installFixture(fixturePacks[1])
  assert.equal(await version(),'2.0.0')
  assert.equal(await readFile(join(profileDir,'cordis.patch.yml'),'utf8'),settings)
  const after=JSON.parse(await readFile(join(profileDir,'package.json'),'utf8'))
  assert.deepEqual(after.dsh.profile.bundles,before.dsh.profile.bundles)
  evidence.stoppedProfileUpgrade='passed';evidence.settingsAndOrderPreserved=true
  const protectedFiles=['package.json','pnpm-lock.yaml','cordis.patch.yml']
  const snapshot=await Promise.all(protectedFiles.map(file=>readFile(join(profileDir,file),'utf8')))
  let failure
  try{await installFixture(fixturePacks[2])}catch(error){failure=error}
  assert.ok(failure,'Incompatible fixture must be rejected')
  assert.match(failure.message,/restored package.json, pnpm-lock.yaml, and node_modules/)
  for(const [index,file] of protectedFiles.entries())assert.equal(await readFile(join(profileDir,file),'utf8'),snapshot[index],file+' restored exactly')
  assert.equal(await version(),'2.0.0')
  evidence.incompatibleUpgradeRecovery='passed'
  const restarted=await boot()
  assert.equal(restarted.inventory.rows.find(row=>row.name===fixtureName).installed,'2.0.0')
  evidence.recoveredProfileRestart='passed'
  await stop()
  await run(['plugin','--profile','web','remove',fixtureName])
  await writeFile(join(profileDir,'cordis.patch.yml'),savedPatch)
}
try{
  evidence.dshVersion=(await run(['--version'])).trim()
  stage='baseline'
  const baseline=await run(['--profile','web','--dump-config'])
  await writeFile(join(root,'baseline.yml'),baseline)
  stage='install'
  await run(['plugin','--profile','web','add','--ignore-scripts','--config.auto-install-peers=false',tarball])
  const installed=await run(['--profile','web','--dump-config'])
  assert.match(installed,/lumen-market/)
  await writeFile(join(root,'installed.yml'),installed)
  evidence.install='passed'
  if(testUpgrade){stage='prepare-upgrade';await prepareUpgrade()}
  stage='start'
  const session=await boot()
  const {base,cookie,health}=session
  stage='sources-api'
  const sourceHeaders={cookie,'x-dsh-lumen-market':'1','content-type':'application/json'}
  const catalogResponse=await fetch(base+'/api/lumen-market/sources',{headers:sourceHeaders})
  assert.equal(catalogResponse.status,200);assert.equal((await catalogResponse.json()).catalog.schemaVersion,1)
  const sourceDir=join(root,'fixtures','source'),sourceName='dsh-acceptance-fixture'
  await mkdir(sourceDir,{recursive:true})
  await writeFile(join(sourceDir,'package.json'),JSON.stringify({name:sourceName,version:'1.0.0',type:'module',main:'index.js',engines:{dsh:'>=0.2.0 <0.3.0'},dsh:{bundle:{patch:'cordis.patch.yml'}},scripts:{postinstall:'node -e "console.log(\'lumen-source-approval-fixture\')"'}}))
  await writeFile(join(sourceDir,'index.js'),"export const name='sourceAcceptance'; export function apply() {}\n")
  await writeFile(join(sourceDir,'cordis.patch.yml'),'- insert:\n    - id: lumen-source-acceptance\n      name: '+sourceName+'\n')
  const npmCli=process.env.npm_execpath||join(dirname(process.execPath),'node_modules/npm/bin/npm-cli.js')
  await run(['pack','--ignore-scripts','--json'],{entry:npmCli,cwd:sourceDir})
  const sourceBytes=await readFile(join(sourceDir,sourceName+'-1.0.0.tgz')),sourceHash=createHash('sha512').update(sourceBytes).digest('hex')
  const archiveDir=join(health.profile.dir,'.lumen-market','archives');await mkdir(archiveDir,{recursive:true});await writeFile(join(archiveDir,sourceHash+'.tgz'),sourceBytes)
  const imported=await fetch(base+'/api/lumen-market/sources',{method:'POST',headers:sourceHeaders,body:JSON.stringify({action:'import',catalog:{schemaVersion:1,entries:[{repo:'acceptance/fixture',sha:'a'.repeat(40),name:sourceName,version:'1.0.0',downloads:[{url:'https://source-fixture.invalid/package.tgz',integrity:'sha512-'+Buffer.from(sourceHash,'hex').toString('base64')}]}]}})})
  assert.equal(imported.status,200);assert.equal((await imported.json()).catalog.entries[0].repo,'acceptance/fixture')
  const stored=JSON.parse(await readFile(join(health.profile.dir,'.lumen-market','sources.json'),'utf8'))
  assert.equal(stored.entries[0].sha,'a'.repeat(40));evidence.sourceCatalogReadImportPersistence='passed'
  const sourceCall=async(path,body)=>{
    const res=await fetch(base+'/api/lumen-market'+path,{headers:sourceHeaders,method:body?'POST':'GET',...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(180000)})
    return {status:res.status,data:await res.json()}
  }
  stage='source-install-and-script-approval'
  const sourcePlan=await sourceCall('/inspect',{source:'github',repo:'acceptance/fixture'})
  assert.equal(sourcePlan.status,200);assert.equal(sourcePlan.data.preview.catalog,true)
  let sourceInstall=await sourceCall('/install',{previewId:sourcePlan.data.previewId})
  assert.equal(sourceInstall.status,200)
  if(sourceInstall.data.packageResult?.kind==='build-blocked'){
    assert.ok(sourceInstall.data.installation.logs.length>0)
    assert.ok(sourceInstall.data.approvalPreviewId);assert.ok(sourceInstall.data.pendingBuilds.length)
    const noConsent=await sourceCall('/install',{previewId:sourceInstall.data.approvalPreviewId})
    assert.equal(noConsent.data.code,'build-consent-required')
    sourceInstall=await sourceCall('/install',{previewId:sourceInstall.data.approvalPreviewId,buildConsent:true})
    evidence.sourceScriptApprovalRetry='passed'
  }else evidence.sourceScriptApprovalRetry='not-blocked-by-host'
  assert.equal(sourceInstall.data.ok,true,JSON.stringify(sourceInstall.data))
  assert.equal(sourceInstall.data.installation.done,true)
  assert.ok(sourceInstall.data.installation.elapsedMs>=0)
  assert.ok(sourceInstall.data.installation.logs.includes('lumen-source-approval-fixture'))
  evidence.liveOfficialInstallLogAndTiming='passed'
  const sourceInventory=await sourceCall('/installed')
  assert.equal(sourceInventory.data.rows.find(row=>row.name===sourceName)?.gitOrigin?.repo,'acceptance/fixture')
  const removePlan=await sourceCall('/inspect',{action:'uninstall',source:'installed',name:sourceName})
  assert.equal(removePlan.status,200)
  const sourceRemove=await sourceCall('/uninstall',{previewId:removePlan.data.previewId})
  assert.equal(sourceRemove.data.ok,true)
  evidence.cachedSourceOfficialInstallAndOrigin='passed';evidence.sourceFixtureRemoval='passed'
  evidence.runtimeFilesSha256=await runtimeHash(join(health.profile.dir,'node_modules','dsh-lumen-market'))
  evidence.start='passed';evidence.authenticatedHealthHttp=200;evidence.installedInventoryHttp=200
  if(testReinstall)await reinstallRunning(session)
  if(testUpgrade&&!testReinstall){
    assert.equal(health.upgrade.supported,false)
    assert.equal(health.upgrade.reason,'profile-running')
    const refusal=await fetch(base+'/api/lumen-market/inspect',{method:'POST',headers:{cookie,'x-dsh-lumen-market':'1','content-type':'application/json'},body:JSON.stringify({action:'upgrade',source:'npm',name:fixtureName,version:'2.0.0'}),signal:AbortSignal.timeout(10000)})
    assert.equal(refusal.status,409);assert.equal((await refusal.json()).code,'upgrade-unavailable')
    evidence.runningProfileUpgradeBlocked='passed'
  }
  await stop()
  if(testReinstall){await run(['plugin','--profile','web','remove',fixtureName]);await writeFile(join(profileDir,'cordis.patch.yml'),savedPatch)}
  else if(testUpgrade){stage='stopped-upgrade-and-recovery';await upgradeStopped()}
  stage='uninstall'
  await run(['plugin','--profile','web','remove','dsh-lumen-market'])
  const removed=await run(['--profile','web','--dump-config'])
  assert.doesNotMatch(removed,/lumen-market/)
  await writeFile(join(root,'removed.yml'),removed)
  evidence.uninstall='passed'
  stage='restore-composition'
  assert.equal(removed,baseline,'Official remove must restore baseline composition')
  evidence.compositionRestored=true;evidence.rollbackScope=testReinstall?'running official remove/install with incompatible payload and verified local recovery; crashes not tested':testUpgrade?'incompatible fixture update restored manifest, lockfile and modules; crashes/network interruptions not tested':'failure rollback not tested'
  evidence.status='passed'
}catch(error){
  evidence.status='failed';evidence.failedStage=stage
  // Credential-bearing launch URLs and cookies are never persisted.
  evidence.error=error.message.replace(/https?:\/\/[^\s]+/g,'[URL redacted]').slice(-3000)
  process.exitCode=1
}finally{
  await stop()
  if(registryServer)await new Promise(done=>registryServer.close(done))
  await writeFile(join(root,'evidence.json'),JSON.stringify(evidence,null,2)+'\n')
  console.log(JSON.stringify(evidence,null,2))
}
