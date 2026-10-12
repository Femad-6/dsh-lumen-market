import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Market } from '../lib/host/market.js'
const pkg={name:'demo',version:'2.0.0',description:'Useful',dsh:{bundle:{patch:'x.yml'}}}
function setup({result={application:'applied',changed:true},installed=[],failGit=false}={}){
  let now=0;const calls=[];const rows=installed
  const npm={detail:async(name,version)=>({id:`npm:${name}`,name,source:'npm',version:version??'2.0.0',manifest:{...pkg,name,version:version??'2.0.0'},validation:'bundle',spec:`${name}@${version??'2.0.0'}`,links:{},description:'Useful'}),search:async()=>({rows:[{id:'npm:demo',name:'demo',source:'npm',manifest:pkg,validation:'bundle',version:'2.0.0'}],total:1}),clear(){}}
  const github={detail:async repo=>({id:`github:${repo}`,name:'demo',repo,source:'github',sha:'a'.repeat(40),spec:`github:${repo}#${'a'.repeat(40)}`,manifest:pkg,validation:'bundle'}),search:async()=>{if(failGit)throw Object.assign(new Error('rate-limited'),{code:'rate-limited',extra:{retryAt:1234}});return {rows:[],total:0}},clear(){}}
  const manager={inspect:async()=>({kind:'registry'}),listVersionExemptions:async()=>({exemptions:{}}),installBundle:async spec=>{calls.push(spec);return typeof result==='function'?result():result}}
  const profile={resolution:()=>({dir:'test',rejected:[]}),snapshot:async()=>({profile:{dir:'test'},runtimeVersion:'0.2.0',rows})}
  const market=new Market({npm,github,manager:()=>manager,profile,now:()=>now})
  return {market,calls,rows,npm,setNow:n=>now=n}
}
test('combined search retains npm result when GitHub fails',async()=>{
  const {market}=setup({failGit:true});const r=await market.search({q:'demo'})
  assert.equal(r.rows[0].name,'demo');assert.equal(r.errors[0].source,'github');assert.equal(r.errors[0].retryAt,1234)
})
test('install uses server preview exact version, never client supplied spec',async()=>{
  const {market,calls}=setup();const p=await market.inspect({source:'npm',name:'demo',version:'2.0.0'})
  assert.equal(p.preview.spec,'demo@2.0.0')
  assert.equal((await market.execute('install',{previewId:p.previewId})).ok,true)
  assert.deepEqual(calls,['demo@2.0.0'])
  await assert.rejects(market.execute('install',{previewId:p.previewId}),/preview-expired/)
})
test('preview ID expires and request cannot smuggle a raw spec',async()=>{
  const {market,setNow,calls}=setup();const p=await market.inspect({source:'npm',name:'demo',version:'2.0.0'})
  setNow(600001);await assert.rejects(market.execute('install',{previewId:p.previewId}),/preview-expired/)
  await assert.rejects(market.execute('install',{spec:'evil@latest'}),/invalid-request/)
  assert.deepEqual(calls,[])
})
test('GitHub install is pinned and same-name installed package causes conflict',async()=>{
  const {market,calls,rows}=setup();const p=await market.inspect({source:'github',repo:'alice/demo'})
  await market.execute('install',{previewId:p.previewId});assert.equal(calls[0],`github:alice/demo#${'a'.repeat(40)}`)
  rows.push({name:'demo',source:'git',specifier:'github:bob/demo',installed:'1.0.0'})
  await assert.rejects(market.inspect({source:'github',repo:'alice/demo'}),/source-conflict/)
})
test('upgrading rechecks source and refuses a newly linked dependency',async()=>{
  const {market,rows,calls}=setup({installed:[{id:'installed:demo',name:'demo',source:'registry',specifier:'^1.0.0',installed:'1.0.0'}]})
  const p=await market.inspect({action:'upgrade',source:'npm',name:'demo',version:'2.0.0'})
  rows[0].source='local';rows[0].specifier='link:D:/dev'
  await assert.rejects(market.execute('upgrade',{previewId:p.previewId}),/source-changed/);assert.deepEqual(calls,[])
})
test('resolved official failure does not set restart while successful replacement survives refresh',async()=>{
  const installed=[{id:'installed:demo',name:'demo',source:'registry',specifier:'1.0.0',installed:'1.0.0'}]
  const failed=setup({result:{ok:true,application:'failed'},installed})
  let p=await failed.market.inspect({action:'upgrade',source:'npm',name:'demo',version:'2.0.0'})
  assert.equal((await failed.market.execute('upgrade',{previewId:p.previewId})).ok,false)
  assert.deepEqual((await failed.market.installed()).pendingRestart,[])
  const good=setup({installed});p=await good.market.inspect({action:'upgrade',source:'npm',name:'demo',version:'2.0.0'})
  await good.market.execute('upgrade',{previewId:p.previewId})
  assert.deepEqual((await good.market.installed()).pendingRestart,['demo'])
  assert.deepEqual((await good.market.installed()).pendingRestart,['demo'])
  assert.deepEqual((await setup({installed}).market.installed()).pendingRestart,[])
})
test('updates never qualifies local/git/alias and unknown disk version',async()=>{
  const {market}=setup({installed:[{name:'local',source:'local'},{name:'git',source:'git'},{name:'alias',source:'alias'},{name:'unknown',source:'registry',installed:null},{name:'new',source:'registry',installed:'1.0.0'}]})
  const r=await market.updates();assert.deepEqual(r.rows.filter(x=>x.upgradeable).map(x=>x.name),['new'])
})
test('concurrent writes return busy; consumed previews cannot replay',async()=>{
  let release
  const {market}=setup({result:()=>new Promise(r=>release=r)})
  const p=await market.inspect({source:'npm',name:'demo',version:'2.0.0'}),p2=await market.inspect({source:'npm',name:'other',version:'2.0.0'})
  const active=market.execute('install',{previewId:p.previewId})
  await assert.rejects(market.execute('install',{previewId:p2.previewId}),/busy/)
  while(!release)await new Promise(r=>setImmediate(r))
  release({application:'applied',changed:true});await active
})
test('manifest changing after preview requires a fresh preview',async()=>{
  const {market,npm,calls}=setup();const p=await market.inspect({source:'npm',name:'demo',version:'2.0.0'})
  const original=npm.detail;npm.detail=async(...args)=>{const row=await original(...args);row.manifest={...row.manifest,dsh:{}};return row}
  await assert.rejects(market.execute('install',{previewId:p.previewId}),/preview-stale/);assert.deepEqual(calls,[])
})
test('execute reads a new profile snapshot after remote revalidation completes',async()=>{
  const {market,npm,rows,calls}=setup({installed:[{name:'demo',source:'registry',specifier:'1.0.0',installed:'1.0.0'}]})
  const originalSnapshot=market.profile.snapshot
  market.profile.snapshot=async()=>structuredClone(await originalSnapshot())
  const p=await market.inspect({action:'upgrade',source:'npm',name:'demo',version:'2.0.0'})
  const originalDetail=npm.detail
  npm.detail=async(...args)=>{const row=await originalDetail(...args);rows[0]={name:'demo',source:'local',specifier:'link:D:/dev',installed:'1.0.0'};return row}
  await assert.rejects(market.execute('upgrade',{previewId:p.previewId}),/source-changed/)
  assert.deepEqual(calls,[])
})
test('upgrading a disabled bundle preserves its disabled selection in manager options',async()=>{
  const {market}=setup({installed:[{name:'demo',source:'registry',specifier:'1.0.0',installed:'1.0.0',enabled:false,bundle:false}]})
  const p=await market.inspect({action:'upgrade',source:'npm',name:'demo',version:'2.0.0'})
  let options
  market.manager().installBundle=async(spec,opts)=>{options=opts;return {application:'applied',changed:true}}
  await market.execute('upgrade',{previewId:p.previewId})
  assert.equal(options.enabled,false)
})
test('failed update lookups remain visible in aggregate errors instead of empty success',async()=>{
  const {market,npm}=setup({installed:[{name:'demo',source:'registry',installed:'1.0.0'}]})
  npm.detail=async()=>{throw Object.assign(new Error('network'),{code:'network'})}
  const data=await market.updates()
  assert.equal(data.rows[0].verdict,'lookup-failed')
  assert.equal(data.errors[0].name,'demo');assert.equal(data.errors[0].code,'network')
})
test('all-source search includes matching locally linked installs without offering registry replacement',async()=>{
  const {market}=setup({installed:[{id:'installed:dsh-moonpet',name:'dsh-moonpet',source:'local',installed:'0.1.2',description:'MoonPet 月伴',links:{repository:'https://github.com/Femad-6/deepseek-moonpet'},bundle:true}]})
  let data=await market.search({q:'moonpet',source:'all'})
  const moon=data.rows.find(r=>r.name==='dsh-moonpet')
  assert.ok(moon);assert.equal(moon.id,'installed:dsh-moonpet');assert.equal(moon.alreadyInstalled,true);assert.equal(moon.installable,false);assert.equal(moon.source,'local')
  assert.equal((await market.search({q:'not-matching',source:'all'})).rows.some(r=>r.name==='dsh-moonpet'),false)
  assert.equal((await market.search({q:'moonpet',source:'npm'})).rows.some(r=>r.id==='installed:dsh-moonpet'),false)
})

test('installed list returns disk data without performing remote version lookups',async()=>{
  const {market,npm}=setup({installed:[{id:'installed:demo',name:'demo',source:'registry',installed:'1.0.0'}]})
  let lookups=0;npm.detail=async()=>{lookups++;throw new Error('remote must not block local data')}
  const data=await market.installed()
  assert.equal(data.rows[0].name,'demo');assert.equal(data.rows[0].verdict,'unchecked')
  assert.equal(lookups,0)
})

test('explicit discover refresh invalidates both sources and uses filtered hasMore',async()=>{
  const {market,npm}=setup();let npmCleared=0,gitCleared=0
  npm.clear=()=>npmCleared++;market.github.clear=()=>gitCleared++
  npm.search=async()=>({rows:[],total:1000,hasMore:false,scanLimited:true,page:1})
  const data=await market.search({q:'plugin tools',force:true})
  assert.equal(npmCleared,1);assert.equal(gitCleared,1)
  assert.equal(data.hasMore,false);assert.equal(data.sources.npm.scanLimited,true)
})

test('market passes star sorting to GitHub and preserves the upstream order',async()=>{
  const {market}=setup();let received
  market.github.search=async(q,page,options)=>{received={q,page,options};return {rows:[{id:'github:bob/high',repo:'bob/high',name:'bob/high',source:'github',stars:400},{id:'github:alice/low',repo:'alice/low',name:'alice/low',source:'github',stars:3}],total:40,page,sort:options?.sort}}
  const result=await market.search({q:'market',source:'github',page:2,sort:'stars'})
  assert.deepEqual(received,{q:'market',page:2,options:{sort:'stars'}})
  assert.deepEqual(result.rows.map(row=>row.stars),[400,3]);assert.equal(result.sort,'stars')
})

test('market refuses unsupported sorting and star sorting outside GitHub scope',async()=>{
  const {market}=setup()
  await assert.rejects(market.search({source:'github',sort:'arbitrary'}),/invalid-sort/)
  await assert.rejects(market.search({source:'all',sort:'stars'}),/github-sort-required/)
})

test('cancelling remote revalidation prevents the official installation from starting',async()=>{
  const {market,npm,calls}=setup()
  const preview=await market.inspect({source:'npm',name:'demo'})
  assert.equal(typeof market.operation,'function')
  const original=npm.detail;let release
  npm.detail=async(...args)=>{await new Promise(r=>release=r);return original(...args)}
  const active=market.execute('install',{previewId:preview.previewId})
  const operation=market.operation({previewId:preview.previewId}).operation
  assert.equal(operation.phase,'checking')
  await market.cancel({operationId:operation.operationId})
  release();const result=await active
  assert.equal(result.application,'cancelled');assert.equal(result.ok,false)
  assert.deepEqual(calls,[]);assert.equal(market.busy,false)
})

test('official progress is bound to the active request and cancellation awaits its result',async()=>{
  const {market}=setup();const preview=await market.inspect({source:'npm',name:'demo'})
  assert.equal(typeof market.progress,'function')
  let release,requestId
  market.manager().installBundle=async(spec,options)=>{requestId=options.requestId;return new Promise(r=>release=r)}
  market.manager().cancelInstall=async id=>{assert.equal(id,requestId);release({application:'cancelled',changed:false});return {status:'cancelled'}}
  const active=market.execute('install',{previewId:preview.previewId})
  while(!release)await new Promise(r=>setImmediate(r))
  market.progress({requestId:'unrelated',phase:'applying'})
  assert.equal(market.operation({previewId:preview.previewId}).operation.phase,'installing')
  market.progress({requestId,phase:'installing',attempt:{registry:'https://u:secret@registry.example',index:1,total:2}})
  const op=market.operation({previewId:preview.previewId}).operation
  assert.equal(op.attempt.registry,'https://[redacted]@registry.example')
  assert.equal(market.operation({previewId:'another-preview'}).operation,null)
  await assert.rejects(market.cancel({operationId:'unrelated'}),/operation-not-found/)
  assert.equal((await market.cancel({operationId:op.operationId})).status,'cancelled')
  assert.equal((await active).application,'cancelled')
})

test('too-late cancellation never changes a successful application into cancelled',async()=>{
  const {market}=setup();const preview=await market.inspect({source:'npm',name:'demo'})
  assert.equal(typeof market.cancel,'function')
  let release
  market.manager().installBundle=()=>new Promise(r=>release=r)
  market.manager().cancelInstall=async()=>({status:'too-late'})
  const active=market.execute('install',{previewId:preview.previewId})
  while(!release)await new Promise(r=>setImmediate(r))
  const operation=market.operation({previewId:preview.previewId}).operation
  assert.equal((await market.cancel({operationId:operation.operationId})).status,'too-late')
  release({application:'applied',changed:true})
  assert.equal((await active).ok,true)
})
