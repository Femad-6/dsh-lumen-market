/** Disposable official DSH acceptance. Keeps every Profile and log; never deletes directories.
 * The acceptance sequence follows AI-Scarlett/build-dsh-plugin's public E3 guidance.
 * Usage: node tools/verify-profile.mjs <official lib/bin.js> <plugin.tgz>
 */
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdir,writeFile,readFile,readdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {createServer} from 'node:net'
import {createHash} from 'node:crypto'

const [cliArg,packageArg]=process.argv.slice(2)
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
async function run(args){
  return new Promise((done,reject)=>{
    const child=spawn(process.execPath,[cli,...args],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']})
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
  stage='start'
  const server=createServer()
  await new Promise((done,reject)=>server.once('error',reject).listen(0,'127.0.0.1',done))
  const port=server.address().port
  await new Promise(done=>server.close(done))
  host=spawn(process.execPath,[cli,'web','--no-open','--port',String(port)],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']})
  let output=''
  for(const stream of [host.stdout,host.stderr])stream.on('data',data=>{output=(output+data).slice(-65536)})
  let launch
  for(let i=0;i<180;i++){
    launch=/dsh web: (http:\/\/[^\s]+)/.exec(output)?.[1]
    if(launch)break
    if(host.exitCode!==null)throw new Error(`Host exited ${host.exitCode}`)
    await pause(500)
  }
  assert.ok(launch,'Host must report its authenticated launch URL')
  const login=await fetch(launch,{redirect:'manual',signal:AbortSignal.timeout(10000)})
  assert.ok([302,303].includes(login.status))
  const cookie=login.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ')
  assert.ok(cookie)
  const base=new URL(launch).origin
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
  const installedResponse=await fetch(`${base}/api/lumen-market/installed`,{headers:{cookie,'x-dsh-lumen-market':'1'},signal:AbortSignal.timeout(10000)})
  assert.equal(installedResponse.status,200)
  const inventory=await installedResponse.json()
  assert.ok(inventory.rows.some(row=>row.name==='dsh-lumen-market'))
  evidence.runtimeFilesSha256=await runtimeHash(join(health.profile.dir,'node_modules','dsh-lumen-market'))
  evidence.start='passed';evidence.authenticatedHealthHttp=200;evidence.installedInventoryHttp=200
  await stop()
  stage='uninstall'
  await run(['plugin','--profile','web','remove','dsh-lumen-market'])
  const removed=await run(['--profile','web','--dump-config'])
  assert.doesNotMatch(removed,/lumen-market/)
  await writeFile(join(root,'removed.yml'),removed)
  evidence.uninstall='passed'
  stage='restore-composition'
  assert.equal(removed,baseline,'Official remove must restore baseline composition')
  evidence.compositionRestored=true;evidence.rollbackScope='failure rollback not tested'
  evidence.status='passed'
}catch(error){
  evidence.status='failed';evidence.failedStage=stage
  // Credential-bearing launch URLs and cookies are never persisted.
  evidence.error=error.message.replace(/https?:\/\/[^\s]+/g,'[URL redacted]').slice(-3000)
  process.exitCode=1
}finally{
  await stop()
  await writeFile(join(root,'evidence.json'),JSON.stringify(evidence,null,2)+'\n')
  console.log(JSON.stringify(evidence,null,2))
}
