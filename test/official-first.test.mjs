import {test} from 'node:test'
import assert from 'node:assert/strict'
import {Market} from '../lib/host/market.js'
import {MarketError} from '../lib/host/core.js'
import {createRoute} from '../lib/host/route.js'
import {EventEmitter} from 'node:events'

const manifest={name:'dsh-demo',version:'1.0.0',repository:'github:alice/demo',engines:{dsh:'>=0.2.0'},dsh:{bundle:{patch:'x.yml'}}}
function fixture(){
  const calls=[],metadata=[]
  const manager={inspect:async spec=>{calls.push(['inspect',spec]);return {status:'accepted',...(spec.startsWith('dsh-demo@')?{name:'dsh-demo',version:'1.0.0'}:{})}},installBundle:async(spec,options)=>{calls.push(['install',spec,options]);return {application:'applied',changed:true}}}
  const npm={detail:async()=>{metadata.push('npm');return {source:'npm',name:'dsh-demo',version:'1.0.0',spec:'dsh-demo@1.0.0',validation:'bundle',manifest}},clear(){}}
  const market=new Market({npm,github:{detail:async()=>{metadata.push('github');throw new MarketError('rate-limited',502)},clear(){}},manager:()=>manager,profile:{snapshot:async()=>({profile:{dir:'official-first-fixture'},rows:[],runtimeVersion:'0.2.1'})}})
  const plan=()=>market.inspect({action:'install',mode:'official-first',source:'github',repo:'alice/demo',name:'dsh-demo',version:'1.0.0'})
  return {market,manager,npm,calls,metadata,plan}
}
test('one-click installs directly through the official manager without market metadata first',async()=>{
  const f=fixture(),plan=await f.plan()
  assert.deepEqual(f.metadata,[])
  assert.equal((await f.market.execute('install',{previewId:plan.previewId})).ok,true)
  assert.deepEqual(f.calls.map(c=>c.slice(0,2)),[['inspect','https://github.com/alice/demo'],['install','https://github.com/alice/demo']])
  assert.deepEqual(f.metadata,[])
})
test('confirmed official network failure continues to the market pinned npm pipeline',async()=>{
  const f=fixture()
  f.manager.installBundle=async(spec,options)=>{f.calls.push(['install',spec,options]);return spec.startsWith('https:')?{application:'failed',changed:false,stage:'install',failedAt:'spec-host',packageResult:{kind:'network'}}:{application:'applied',changed:true}}
  const plan=await f.plan(),result=await f.market.execute('install',{previewId:plan.previewId})
  assert.equal(result.ok,true)
  assert.deepEqual(f.calls.filter(c=>c[0]==='install').map(c=>c[1]),['https://github.com/alice/demo','dsh-demo@1.0.0'])
  assert.match(result.installation.logs,/official/)
  assert.match(result.installation.logs,/fallback/)
})
test('cancellation, uncertain change, partial application and authorization never trigger fallback',async()=>{
  for(const failure of [{application:'cancelled',changed:false},{application:'failed',stage:'install',packageResult:{kind:'network'}},{application:'failed',changed:true,stage:'install',packageResult:{kind:'network'}},{application:'failed',changed:false,stage:'apply',packageResult:{kind:'network'}},{application:'failed',changed:false,stage:'install',packageResult:{kind:'build-blocked'},pendingBuilds:['demo-build']}]){
    const f=fixture();f.manager.installBundle=async()=>failure
    const plan=await f.plan(),result=await f.market.execute('install',{previewId:plan.previewId})
    assert.equal(result.ok,false)
    assert.deepEqual(f.metadata,[])
    if(failure.pendingBuilds)assert.ok(result.approvalPreviewId)
  }
})
test('official script approval retries exactly the original official target after consent',async()=>{
  const f=fixture()
  f.manager.installBundle=async(spec,options)=>{f.calls.push(['install',spec,options]);return options.approvedBuilds?{application:'applied',changed:true}:{application:'failed',changed:false,packageResult:{kind:'build-blocked'},pendingBuilds:['demo-build']}}
  const plan=await f.plan(),blocked=await f.market.execute('install',{previewId:plan.previewId})
  await assert.rejects(f.market.execute('install',{previewId:blocked.approvalPreviewId}),e=>e.code==='build-consent-required')
  assert.equal((await f.market.execute('install',{previewId:blocked.approvalPreviewId,buildConsent:true})).ok,true)
  assert.deepEqual(f.calls.filter(c=>c[0]==='install').map(c=>c[1]),['https://github.com/alice/demo','https://github.com/alice/demo'])
  assert.deepEqual(f.metadata,[])
})
test('official preflight network refusal can fall back but a policy refusal cannot',async()=>{
  for(const problem of ['network','not-a-bundle']){
    const f=fixture();f.manager.inspect=async spec=>spec.startsWith('https:')?{status:'refused',problem,reason:'fixture'}:{status:'accepted',name:'dsh-demo',version:'1.0.0'}
    const plan=await f.plan(),result=await f.market.execute('install',{previewId:plan.previewId})
    assert.equal(result.ok,problem==='network')
    assert.equal(f.metadata.length>0,problem==='network')
  }
})
test('unknown fallback compatibility waits for confirmation before the second installation',async()=>{
  const f=fixture(),detail=f.npm.detail
  f.npm.detail=async()=>{const row=await detail(),pkg={...manifest};delete pkg.engines;return {...row,manifest:pkg}}
  f.manager.installBundle=async spec=>{f.calls.push(['install',spec]);return spec.startsWith('https:')?{application:'failed',changed:false,stage:'install',packageResult:{kind:'network'}}:{application:'applied',changed:true}}
  const plan=await f.plan(),result=await f.market.execute('install',{previewId:plan.previewId})
  assert.ok(result.fallbackPreview?.preview.requiresCompatibilityConsent)
  assert.equal(f.calls.filter(c=>c[0]==='install').length,1)
  const done=await f.market.execute('install',{previewId:result.fallbackPreview.previewId,compatibilityConsent:true})
  assert.equal(done.ok,true)
})
test('official-first accepts a pinned commit and rejects forged install specs',async()=>{
  const f=fixture()
  const plan=await f.market.inspect({mode:'official-first',source:'github',repo:'alice/demo',sha:'a'.repeat(40)})
  await f.market.execute('install',{previewId:plan.previewId})
  assert.equal(f.calls.find(c=>c[0]==='install')[1],'github:alice/demo#'+'a'.repeat(40))
  await assert.rejects(f.market.inspect({mode:'official-first',source:'npm',name:'demo;echo bad'}))
  await assert.rejects(f.market.inspect({mode:'official-first',action:'upgrade',source:'npm',name:'demo'}))
})
test('a version resolved by official inspection remains fixed in the fallback lookup',async()=>{
  const f=fixture(),detail=f.npm.detail,versions=[]
  f.npm.detail=async(name,version)=>{versions.push(version);return detail()}
  f.manager.inspect=async()=>({status:'accepted',name:'dsh-demo',version:'1.0.0'})
  let attempts=0
  f.manager.installBundle=async()=>++attempts===1?{application:'failed',changed:false,stage:'install',packageResult:{kind:'network'}}:{application:'applied',changed:true}
  const plan=await f.market.inspect({mode:'official-first',source:'npm',name:'dsh-demo'})
  assert.equal((await f.market.execute('install',{previewId:plan.previewId})).ok,true)
  assert.equal(versions[0],'1.0.0')
})
test('cancelling official preflight prevents installation and fallback',async()=>{
  const f=fixture();let release,started
  const ready=new Promise(resolve=>started=resolve)
  f.manager.inspect=async()=>{started();return new Promise(resolve=>release=()=>resolve({status:'accepted'}))}
  const plan=await f.plan(),active=f.market.execute('install',{previewId:plan.previewId})
  await ready
  await f.market.cancel({operationId:f.market.operation({previewId:plan.previewId}).operation.operationId})
  release()
  assert.equal((await active).application,'cancelled')
  assert.equal(f.calls.some(c=>c[0]==='install'),false)
  assert.deepEqual(f.metadata,[])
})
test('an applying event or a lost installer reply prevents automatic fallback',async()=>{
  for(const lost of [false,true]){
    const f=fixture()
    f.manager.installBundle=async(spec,options)=>{
      if(lost)throw new MarketError('network',502)
      f.market.progress({requestId:options.requestId,phase:'applying'})
      return {application:'failed',changed:false,stage:'install',packageResult:{kind:'network'}}
    }
    const plan=await f.plan(),active=f.market.execute('install',{previewId:plan.previewId})
    if(lost)await assert.rejects(active,e=>e.code==='network')
    else assert.equal((await active).ok,false)
    assert.deepEqual(f.metadata,[])
  }
})
test('a pinned GitHub commit remains pinned when the market fallback is needed',async()=>{
  const f=fixture(),sha='a'.repeat(40)
  f.npm.detail=async()=>{throw new MarketError('not-found',404)}
  f.market.github.detail=async(repo,options)=>{
    assert.equal(options?.sha,sha)
    return {source:'github',repo,name:'dsh-demo',version:'1.0.0',sha,spec:`github:${repo}#${sha}`,validation:'bundle',manifest}
  }
  let calls=0
  f.manager.installBundle=async spec=>{f.calls.push(['install',spec]);return ++calls===1?{application:'failed',changed:false,stage:'install',packageResult:{kind:'network'}}:{application:'applied',changed:true}}
  const plan=await f.market.inspect({mode:'official-first',source:'github',repo:'alice/demo',sha,version:'1.0.0'})
  assert.equal((await f.market.execute('install',{previewId:plan.previewId})).ok,true)
  assert.deepEqual(f.calls.filter(c=>c[0]==='install').map(c=>c[1]),[`github:alice/demo#${sha}`,`github:alice/demo#${sha}`])
})
test('the HTTP route accepts official-first targets but rejects raw executable specs',async()=>{
  const f=fixture(),route=createRoute(f.market)
  const post=async(path,body)=>{
    const req=new EventEmitter();Object.assign(req,{url:'/api/lumen-market'+path,method:'POST',headers:{'x-dsh-lumen-market':'1'},socket:{remoteAddress:'127.0.0.1'}})
    const res={statusCode:200,setHeader(){},end(text){this.body=JSON.parse(text)}}
    const pending=route(req,res)
    queueMicrotask(()=>{req.emit('data',Buffer.from(JSON.stringify(body)));req.emit('end')})
    await pending;return res
  }
  const plan=await post('/inspect',{mode:'official-first',source:'github',repo:'alice/demo'})
  assert.equal(plan.statusCode,200)
  assert.equal((await post('/install',{previewId:plan.body.previewId})).body.ok,true)
  assert.equal((await post('/inspect',{mode:'official-first',source:'npm',name:'demo',spec:'file:C:/bad.tgz'})).statusCode,400)
  assert.deepEqual(f.metadata,[])
})
test('script approval still works when fallback changes the selected npm source to GitHub',async()=>{
  const f=fixture(),sha='a'.repeat(40)
  f.market.github.detail=async repo=>({source:'github',repo,sha,name:'dsh-demo',version:'1.0.0',spec:`github:${repo}#${sha}`,validation:'bundle',manifest})
  f.manager.installBundle=async(spec,options)=>{
    f.calls.push(['install',spec,options])
    if(options.approvedBuilds)return {application:'applied',changed:true}
    return spec.startsWith('github:')?{application:'failed',changed:false,packageResult:{kind:'build-blocked'},pendingBuilds:['github-build']}:{application:'failed',changed:false,stage:'install',packageResult:{kind:'network'}}
  }
  const plan=await f.plan(),blocked=await f.market.execute('install',{previewId:plan.previewId})
  assert.ok(blocked.approvalPreviewId)
  assert.equal((await f.market.execute('install',{previewId:blocked.approvalPreviewId,buildConsent:true})).ok,true)
  assert.equal(f.calls.filter(c=>c[0]==='install').at(-1)[1],`github:alice/demo#${sha}`)
})
