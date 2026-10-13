/** Real HTTP + profile files + adapters; installation manager is explicitly simulated. */
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createServer} from 'node:http'
import {Market} from '../lib/host/market.js'
import {Profile} from '../lib/host/profile.js'
import {NpmSource} from '../lib/host/npm.js'
import {createRoute} from '../lib/host/route.js'

async function fixture(t,mode){
  const dir=mkdtempSync(join(tmpdir(),'lumen-integration-')),manifestPath=join(dir,'package.json'),diskPath=join(dir,'node_modules','demo','package.json'),lockPath=join(dir,'pnpm-lock.yaml')
  const selected=['demo','untouched'],before={dsh:{profile:{bundles:selected}},dependencies:{demo:'1.0.0'}},pkg={name:'demo',version:'1.0.0',dsh:{bundle:{patch:'demo.yml'}}}
  mkdirSync(join(dir,'node_modules','demo'),{recursive:true})
  writeFileSync(manifestPath,JSON.stringify(before));writeFileSync(diskPath,JSON.stringify(pkg));writeFileSync(lockPath,'fixture-lock-v1\n')
  let market,finish,cancelled=false,observedEnabled
  const restore=()=>{writeFileSync(manifestPath,JSON.stringify(before));writeFileSync(diskPath,JSON.stringify(pkg));writeFileSync(lockPath,'fixture-lock-v1\n')}
  const manager={
    listBundles:async()=>[{name:'@deepseek-ai/dsh-base',version:'0.2.0'},{name:'demo',version:'1.0.0',enabled:false,installed:true,removable:true}],
    removeBundle:async name=>{
      assert.equal(name,'demo')
      if(mode==='failure')return {application:'failed',changed:false,error:{code:'stop-profile'}}
      const current=JSON.parse(readFileSync(manifestPath,'utf8'))
      delete current.dependencies[name]
      current.dsh.profile.bundles=current.dsh.profile.bundles.filter(bundle=>bundle!==name)
      writeFileSync(manifestPath,JSON.stringify(current))
      return {application:'applied',changed:true}
    },
    installBundle:async(spec,options)=>{
      assert.equal(spec,'demo@2.0.0');observedEnabled=options.enabled
      writeFileSync(manifestPath,JSON.stringify({...before,dependencies:{demo:'2.0.0'}}));writeFileSync(diskPath,JSON.stringify({...pkg,version:'2.0.0'}));writeFileSync(lockPath,'fixture-lock-v2\n')
      market.progress({requestId:options.requestId,phase:'installing'})
      if(mode==='cancel')await new Promise(r=>finish=r)
      if(mode==='failure'||cancelled){restore();return {application:cancelled?'cancelled':'failed',changed:false,error:cancelled?undefined:{code:'operation-error',diagnostic:'simulated failure'},packageResult:{kind:'network',exitCode:1,output:'simulated registry failure'}}}
      market.progress({requestId:options.requestId,phase:'applying'})
      return {application:'restart-required',changed:true,warnings:['simulated manager; bundle stayed disabled']}
    },
    cancelInstall:async()=>{cancelled=true;finish?.();return {status:'cancelled'}},
  }
  const profile=new Profile({argv:['node',dir],env:{},moduleDir:''})
  const npm=new NpmSource({http:{json:async()=>({...pkg,version:'2.0.0'})}})
  market=new Market({npm,github:{clear(){},token:null},profile,manager:()=>manager})
  const server=createServer(createRoute(market));await new Promise(r=>server.listen(0,'127.0.0.1',r))
  t.after(async()=>{finish?.();market.dispose();server.closeAllConnections();await new Promise(r=>server.close(r))})
  const headers={'x-dsh-lumen-market':'1','content-type':'application/json'},base=`http://127.0.0.1:${server.address().port}/api/lumen-market`
  const request=async(path,body)=>{const response=await fetch(base+path,{headers,method:body?'POST':'GET',body:body?JSON.stringify(body):undefined});const data=await response.json();assert.equal(response.status,200,JSON.stringify(data));return data}
  return {request,dir,selected,readManifest:()=>JSON.parse(readFileSync(manifestPath,'utf8')),readLock:()=>readFileSync(lockPath,'utf8'),enabled:()=>observedEnabled}
}

test('isolated HTTP upgrade observes the new disk version and preserves order and disabled state',async t=>{
  const f=await fixture(t,'success')
  const p=await f.request('/inspect',{action:'upgrade',source:'npm',name:'demo',version:'2.0.0'})
  const result=await f.request('/upgrade',{previewId:p.previewId})
  assert.equal(result.application,'restart-required');assert.deepEqual(result.pendingRestart,['demo'])
  assert.equal((await f.request('/installed')).rows.find(r=>r.name==='demo').installed,'2.0.0')
  assert.deepEqual(f.readManifest().dsh.profile.bundles,['demo','untouched']);assert.equal(f.enabled(),false)
})

test('isolated failed upgrade exposes its classification and observes restored profile files',async t=>{
  const f=await fixture(t,'failure')
  const p=await f.request('/inspect',{action:'upgrade',source:'npm',name:'demo',version:'2.0.0'})
  const result=await f.request('/upgrade',{previewId:p.previewId})
  assert.equal(result.ok,false);assert.equal(result.packageResult.kind,'network');assert.deepEqual(result.pendingRestart,[])
  assert.equal((await f.request('/installed')).rows.find(r=>r.name==='demo').installed,'1.0.0')
  assert.equal(f.readManifest().dependencies.demo,'1.0.0');assert.equal(f.readLock(),'fixture-lock-v1\n')
})

test('isolated HTTP cancel waits for the simulated manager to restore the profile',async t=>{
  const f=await fixture(t,'cancel')
  const p=await f.request('/inspect',{action:'upgrade',source:'npm',name:'demo',version:'2.0.0'})
  const active=f.request('/upgrade',{previewId:p.previewId})
  let operation
  for(let i=0;i<100;i++){
    operation=(await f.request('/operation?previewId='+p.previewId)).operation
    if(operation?.phase==='installing')break
    await new Promise(r=>setTimeout(r,5))
  }
  assert.equal(operation?.phase,'installing')
  await f.request('/cancel',{operationId:operation.operationId})
  assert.equal((await active).application,'cancelled')
  assert.equal((await f.request('/installed')).rows.find(r=>r.name==='demo').installed,'1.0.0')
  assert.equal(f.readLock(),'fixture-lock-v1\n')
})

test('isolated HTTP uninstall previews then removes only the selected simulated dependency',async t=>{
  const f=await fixture(t,'success')
  assert.equal((await f.request('/installed')).rows.find(row=>row.name==='demo').removable,true)
  const preview=await f.request('/inspect',{action:'uninstall',source:'installed',name:'demo'})
  assert.equal(f.readManifest().dependencies.demo,'1.0.0')
  const result=await f.request('/uninstall',{previewId:preview.previewId})
  assert.equal(result.ok,true);assert.equal(result.action,'uninstall')
  assert.equal(f.readManifest().dependencies.demo,undefined)
  assert.deepEqual(f.readManifest().dsh.profile.bundles,['untouched'])
  assert.equal((await f.request('/installed')).rows.some(row=>row.name==='demo'),false)
})

test('isolated HTTP uninstall failure displays official rejection and retains the dependency',async t=>{
  const f=await fixture(t,'failure')
  const preview=await f.request('/inspect',{action:'uninstall',source:'installed',name:'demo'})
  const result=await f.request('/uninstall',{previewId:preview.previewId})
  assert.equal(result.ok,false);assert.equal(result.error.code,'stop-profile')
  assert.equal(f.readManifest().dependencies.demo,'1.0.0')
  assert.equal((await f.request('/installed')).rows.some(row=>row.name==='demo'),true)
})
