import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Market } from '../lib/host/market.js'
import {MarketError} from '../lib/host/core.js'
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

test('weekly ranking preserves its 50-candidate order, coverage and cached results across market pages',async()=>{
  const {market}=setup();let failed=false
  const rows=Array.from({length:50},(_,i)=>({id:`github:alice/p${i}`,name:`alice/p${i}`,repo:`alice/p${i}`,source:'github',weeklyStars:50-i}))
  market.github.search=async(q,page,{sort})=>{
    assert.equal(q,'');assert.equal(sort,'weekly-stars')
    if(failed)throw new MarketError('network',502)
    return {rows:rows.slice((page-1)*21,page*21),hasMore:page<3,weekly:{candidateLimit:50,candidates:50,measured:50,failed:0}}
  }
  const first=await market.search({q:'',source:'github',sort:'weekly-stars'})
  const last=await market.search({q:'',source:'github',sort:'weekly-stars',page:3})
  assert.equal(first.rows[0].weeklyStars,50);assert.equal(first.sources.github.weekly.candidates,50)
  assert.equal(last.rows.length,8);assert.equal(last.hasMore,false)
  failed=true
  const cached=await market.search({q:'',source:'github',sort:'weekly-stars',force:true})
  assert.equal(cached.stale,true);assert.equal(cached.rows[0].weeklyStars,50)
})

test('verified npm target installs from cache on network failures at inspection and execution',async()=>{
  const {market,npm,calls,setNow}=setup()
  await market.detail({source:'npm',name:'demo',version:'2.0.0'})
  setNow(500)
  npm.detail=async()=>{throw new MarketError('network',502)}
  market.manager().inspect=async()=>{throw new Error('cached target must not require remote preflight')}
  const preview=await market.inspect({source:'npm',name:'demo',version:'2.0.0'})
  assert.equal(preview.preview.cachedMetadata.checkedAt,0)
  assert.equal(preview.preview.cachedMetadata.reason,'network')
  const result=await market.execute('install',{previewId:preview.previewId})
  assert.equal(result.ok,true);assert.equal(result.cachedMetadata.checkedAt,0)
  assert.deepEqual(calls,['demo@2.0.0'])
})

test('cached GitHub target stays pinned even if a different commit is cached before execution',async()=>{
  const {market,calls}=setup()
  await market.detail({source:'github',repo:'alice/demo'})
  market.github.detail=async()=>{throw new MarketError('rate-limited',502)}
  const preview=await market.inspect({source:'github',repo:'alice/demo'})
  assert.equal(preview.preview.cachedMetadata.reason,'rate-limited')
  const context=await market.context()
  const newer={...preview.preview,sha:'b'.repeat(40),spec:'github:alice/demo#'+'b'.repeat(40)}
  delete newer.cachedMetadata
  market.saveVerified(newer,context)
  await market.execute('install',{previewId:preview.previewId})
  assert.deepEqual(calls,['github:alice/demo#'+'a'.repeat(40)])
})

test('search candidates alone, wrong versions and different profiles cannot authorize cached installation',async()=>{
  const {market,npm,calls}=setup()
  await market.search({source:'npm'})
  const live=npm.detail
  npm.detail=async()=>{throw new MarketError('network',502)}
  await assert.rejects(market.inspect({source:'npm',name:'demo'}),e=>e.code==='network')
  npm.detail=live;await market.detail({source:'npm',name:'demo',version:'2.0.0'})
  npm.detail=async()=>{throw new MarketError('timeout',502)}
  await assert.rejects(market.inspect({source:'npm',name:'demo',version:'1.0.0'}),e=>e.code==='timeout')
  market.profile.snapshot=async()=>({profile:{dir:'other-profile'},runtimeVersion:'0.2.0',rows:[]})
  await assert.rejects(market.inspect({source:'npm',name:'demo',version:'2.0.0'}),e=>e.code==='timeout')
  assert.equal(calls.length,0)
})

test('cache never bypasses current compatibility, installation state or definitive remote rejection',async()=>{
  for(const failure of ['not-found','invalid-manifest','disposed']){
    const {market,npm,calls}=setup()
    await market.detail({source:'npm',name:'demo',version:'2.0.0'})
    npm.detail=async()=>{throw new MarketError(failure,502)}
    await assert.rejects(market.inspect({source:'npm',name:'demo',version:'2.0.0'}),e=>e.code===failure)
    assert.equal(calls.length,0)
  }
  const {market,npm,rows,calls}=setup()
  await market.detail({source:'npm',name:'demo',version:'2.0.0'})
  npm.detail=async()=>{throw new MarketError('network',502)}
  rows.push({name:'demo',source:'registry',installed:'2.0.0'})
  await assert.rejects(market.inspect({source:'npm',name:'demo',version:'2.0.0'}),e=>e.code==='already-installed')
  rows.length=0
  market.profile.snapshot=async()=>({profile:{dir:'test'},runtimeVersion:null,rows:[]})
  await assert.rejects(market.inspect({source:'npm',name:'demo',version:'2.0.0'}),e=>e.code==='not-installable')
  assert.equal(calls.length,0)
})

test('a definitive manifest or official rejection invalidates cached authorization for later network failures',async()=>{
  for(const rejection of ['manifest','official']){
    const {market,npm}=setup()
    await market.detail({source:'npm',name:'demo',version:'2.0.0'})
    if(rejection==='manifest')npm.detail=async()=>{throw new MarketError('not-found',404)}
    else market.manager().inspect=async()=>({problem:'incompatible',reason:'Rejected by host'})
    await assert.rejects(market.inspect({source:'npm',name:'demo',version:'2.0.0'}))
    npm.detail=async()=>{throw new MarketError('network',502)}
    await assert.rejects(market.inspect({source:'npm',name:'demo',version:'2.0.0'}),e=>e.code==='network')
    await assert.rejects(market.inspect({source:'npm',name:'demo'}),e=>e.code==='network')
  }
})

test('cached previews recheck the active profile before starting the manager',async()=>{
  const {market,npm,calls}=setup()
  const preview=await market.inspect({source:'npm',name:'demo'})
  npm.detail=async()=>{throw new MarketError('network',502)}
  market.profile.snapshot=async()=>({profile:{dir:'other-profile'},runtimeVersion:'0.2.0',rows:[]})
  await assert.rejects(market.execute('install',{previewId:preview.previewId}),e=>e.code==='preview-stale')
  assert.equal(calls.length,0)
})

test('official rejection revokes old previews and a later detail read cannot silently restore cached installation',async()=>{
  const {market,npm,calls}=setup()
  const preview=await market.inspect({source:'npm',name:'demo',version:'2.0.0'})
  market.manager().inspect=async()=>({problem:'incompatible'})
  await assert.rejects(market.inspect({source:'npm',name:'demo',version:'2.0.0'}),e=>e.code==='official-inspect-rejected')
  await market.detail({source:'npm',name:'demo',version:'2.0.0'})
  const live=npm.detail
  npm.detail=async()=>{throw new MarketError('network',502)}
  await assert.rejects(market.execute('install',{previewId:preview.previewId}),e=>e.code==='preview-stale')
  await assert.rejects(market.inspect({source:'npm',name:'demo',version:'2.0.0'}),e=>e.code==='network')
  assert.equal(calls.length,0)
  npm.detail=live;market.manager().inspect=async()=>({kind:'registry'})
  await market.inspect({source:'npm',name:'demo',version:'2.0.0'})
  npm.detail=async()=>{throw new MarketError('network',502)}
  assert.ok((await market.inspect({source:'npm',name:'demo',version:'2.0.0'})).preview.cachedMetadata)
})

test('an incompatible online manifest invalidates an older compatible cache of the same version',async()=>{
  const {market,npm}=setup()
  await market.detail({source:'npm',name:'demo',version:'2.0.0'})
  const live=npm.detail
  npm.detail=async(...args)=>{const row=await live(...args);return {...row,manifest:{...row.manifest,peerDependencies:{'@deepseek-ai/dsh':'>=99.0.0'}}}}
  await assert.rejects(market.inspect({source:'npm',name:'demo',version:'2.0.0'}),e=>e.code==='not-installable')
  npm.detail=async()=>{throw new MarketError('network',502)}
  await assert.rejects(market.inspect({source:'npm',name:'demo',version:'2.0.0'}),e=>e.code==='network')
})

test('discovery fills 21 visible cards after installed filtering and pagination never repeats them',async()=>{
  const {market,npm}=setup({installed:[{name:'plugin-0',source:'local'},{name:'plugin-1',source:'registry'}]})
  const all=Array.from({length:50},(_,i)=>({id:`npm:plugin-${i}`,name:`plugin-${i}`,source:'npm'}))
  npm.search=async(q,page)=>({rows:all.slice((page-1)*21,page*21),page,total:all.length,hasMore:page*21<all.length})
  const first=await market.search({source:'npm'}),second=await market.search({source:'npm',page:2}),last=await market.search({source:'npm',page:3})
  assert.equal(first.rows.length,21);assert.equal(second.rows.length,21);assert.equal(last.rows.length,6)
  assert.equal(first.rows[0].name,'plugin-2');assert.equal(second.rows[0].name,'plugin-23')
  assert.equal(new Set([...first.rows,...second.rows,...last.rows].map(row=>row.name)).size,48)
  assert.equal(last.hasMore,false)
})

test('combined discovery is one page of 21 cards rather than a page from each source',async()=>{
  const {market,npm}=setup()
  npm.search=async(q,page)=>({rows:page===1?Array.from({length:21},(_,i)=>({name:`npm-${i}`,source:'npm'})):[],total:21,hasMore:false})
  market.github.search=async(q,page)=>({rows:page===1?Array.from({length:21},(_,i)=>({name:`alice/plugin-${i}`,repo:`alice/plugin-${i}`,source:'github'})):[],total:21,hasMore:false})
  const first=await market.search(),second=await market.search({page:2})
  assert.equal(first.rows.length,21);assert.equal(second.rows.length,21)
  assert.equal(new Set([...first.rows,...second.rows].map(row=>row.name)).size,42)
  assert.equal(second.hasMore,false)
})

test('direct deep-page requests and concurrent pagination keep the same 21-item boundaries',async()=>{
  const {market,npm}=setup({installed:[{name:'plugin-0',source:'local'}]})
  const all=Array.from({length:100},(_,i)=>({name:`plugin-${i}`,source:'npm'})),calls=[]
  npm.search=async(q,page)=>{calls.push(page);await new Promise(resolve=>setImmediate(resolve));return {rows:all.slice((page-1)*21,page*21),total:all.length,hasMore:page*21<all.length}}
  const deep=await market.search({source:'npm',page:4})
  assert.equal(deep.rows.length,21);assert.equal(deep.rows[0].name,'plugin-64')
  calls.length=0
  const [first,second]=await Promise.all([market.search({q:'new',source:'npm'}),market.search({q:'new',source:'npm',page:2})])
  assert.equal(first.rows.length,21);assert.equal(second.rows.length,21)
  assert.equal(new Set([...first.rows,...second.rows].map(row=>row.name)).size,42)
  assert.deepEqual(calls,[1,2,3])
})

test('failed refresh falls back to the same source query snapshot and rechecks installed state',async()=>{
  const {market,rows}=setup()
  market.github.search=async()=>({rows:[{name:'alice/demo',repo:'alice/demo',source:'github',stars:42}],total:1})
  await market.search({q:'market',source:'github',sort:'stars'})
  market.github.search=async()=>{throw Object.assign(new Error('rate-limited'),{code:'rate-limited',extra:{retryAt:9999}})}
  const result=await market.search({q:'market',source:'github',sort:'stars',force:true})
  assert.equal(result.rows[0].name,'alice/demo');assert.equal(result.stale,true)
  assert.equal(result.sources.github.cached,true);assert.equal(result.errors[0].retryAt,9999)
  assert.equal((await market.search({q:'different',source:'github',sort:'stars'})).rows.length,0)
  rows.push({name:'demo',source:'git',specifier:'github:alice/demo'})
  assert.equal((await market.search({q:'market',source:'github',sort:'stars'})).rows.length,0)
})

test('cache-only search returns previous successes without remote requests and empty success replaces them',async()=>{
  const {market,npm}=setup();let requests=0
  npm.search=async()=>{requests++;return {rows:requests===1?[{name:'demo',source:'npm'}]:[],total:requests===1?1:0}}
  await market.search({source:'npm',q:'market'})
  assert.equal((await market.search({source:'npm',q:'market',cachedOnly:true})).rows[0].name,'demo')
  assert.equal(requests,1)
  await market.search({source:'npm',q:'market',force:true})
  assert.equal((await market.search({source:'npm',q:'market',cachedOnly:true})).rows.length,0)
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
test('discovery excludes local installs and matching npm candidates while installed retains them',async()=>{
  const {market}=setup({installed:[{id:'installed:dsh-moonpet',name:'dsh-moonpet',source:'local',installed:'0.1.2',description:'MoonPet 月伴',links:{repository:'https://github.com/Femad-6/deepseek-moonpet'},bundle:true}]})
  let data=await market.search({q:'moonpet',source:'all'})
  const moon=data.rows.find(r=>r.name==='dsh-moonpet')
  assert.equal(moon,undefined)
  assert.equal(data.sources.installed,undefined)
  assert.equal((await market.installed()).rows[0].name,'dsh-moonpet')
  assert.equal((await market.search({q:'not-matching',source:'all'})).rows.some(r=>r.name==='dsh-moonpet'),false)
  assert.equal((await market.search({q:'moonpet',source:'npm'})).rows.some(r=>r.id==='installed:dsh-moonpet'),false)
})

test('discovery hides installed npm names across sources and GitHub repositories across package names',async()=>{
  const {market}=setup({installed:[{name:'demo',source:'local',installed:'1.0.0'},{name:'different-package-name',source:'git',specifier:'github:Alice/demo#main'},{name:'linked-package',source:'local',links:{repository:'https://github.com/Carol/linked.git'}}]})
  market.github.search=async()=>({rows:[{id:'github:alice/demo',name:'alice/demo',repo:'alice/demo',source:'github'},{id:'github:carol/linked',name:'carol/linked',repo:'carol/linked',source:'github'},{id:'github:bob/new',name:'bob/new',repo:'bob/new',source:'github'}],total:41,hasMore:true})
  for(const source of ['all','npm','github']){
    const result=await market.search({source})
    assert.deepEqual(result.rows.map(row=>row.name),source==='npm'?[]:['bob/new'])
    if(source!=='npm')assert.equal(result.hasMore,true)
  }
})

test('all explicit GitHub orders are accepted only in GitHub scope',async()=>{
  const {market}=setup()
  for(const sort of ['updated','forks','stars']){
    assert.equal((await market.search({source:'github',sort})).sort,sort)
    await assert.rejects(market.search({source:'all',sort}),/github-sort-required/)
  }
})

test('discovery also hides npm plugins installed under an alias',async()=>{
  const {market}=setup({installed:[{name:'my-demo',source:'alias',specifier:'npm:demo@1.0.0',manifest:{name:'demo'},installed:'1.0.0'}]})
  assert.deepEqual((await market.search({source:'npm'})).rows,[])
  assert.equal((await market.installed()).rows[0].name,'my-demo')
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
  const {market}=setup();const received=[]
  const all=Array.from({length:43},(_,index)=>({id:`github:alice/plugin-${index}`,repo:`alice/plugin-${index}`,name:`alice/plugin-${index}`,source:'github',stars:400-index}))
  market.github.search=async(q,page,options)=>{received.push({q,page,options});return {rows:all.slice((page-1)*21,page*21),total:43,page,sort:options?.sort}}
  const result=await market.search({q:'market',source:'github',page:2,sort:'stars'})
  assert.deepEqual(received.map(call=>call.page),[1,2]);assert.ok(received.every(call=>call.options.sort==='stars'))
  assert.deepEqual(result.rows.map(row=>row.stars),Array.from({length:21},(_,index)=>379-index));assert.equal(result.sort,'stars')
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

test('uninstall previews bind the installed target and removal uses only the official manager',async()=>{
  const {market,rows,calls}=setup({installed:[{name:'local-demo',source:'local',specifier:'link:D:/dev',installed:'1.0.0',removable:true}]})
  const removed=[];market.manager().removeBundle=async name=>{removed.push(name);rows.length=0;return {application:'applied',changed:true}}
  assert.equal((await market.installed()).rows[0].removable,true)
  const preview=await market.inspect({action:'uninstall',source:'installed',name:'local-demo'})
  assert.equal(preview.preview.name,'local-demo');assert.equal(preview.preview.action,'uninstall')
  assert.deepEqual(removed,[])
  const result=await market.execute('uninstall',{previewId:preview.previewId})
  assert.equal(result.ok,true);assert.deepEqual(removed,['local-demo']);assert.deepEqual(calls,[])
  assert.deepEqual((await market.installed()).rows,[])
  await assert.rejects(market.execute('uninstall',{previewId:preview.previewId}),/preview-expired/)
})

test('installed detail preserves installed identity and official removal availability',async()=>{
  const {market}=setup({installed:[{id:'installed:demo',name:'demo',source:'registry',removable:true}]})
  let detail=await market.detail({source:'installed',name:'demo'})
  assert.equal(detail.alreadyInstalled,true);assert.equal(detail.removable,false)
  market.manager().removeBundle=async()=>({application:'applied'})
  detail=await market.detail({source:'installed',name:'demo'})
  assert.equal(detail.removable,true)
})

test('uninstall rejects unsupported, protected, changed or forged targets before any removal',async()=>{
  const {market,rows}=setup({installed:[{name:'demo',source:'registry',specifier:'1.0.0',installed:'1.0.0',removable:true}]})
  assert.equal((await market.installed()).rows[0].removable,false)
  await assert.rejects(market.inspect({action:'uninstall',source:'installed',name:'demo'}),/removal-unavailable/)
  let removes=0;market.manager().removeBundle=async()=>{removes++;return {application:'applied'}}
  rows[0].removable=false
  await assert.rejects(market.inspect({action:'uninstall',source:'installed',name:'demo'}),/not-removable/)
  rows[0].removable=true
  const preview=await market.inspect({action:'uninstall',source:'installed',name:'demo'})
  await assert.rejects(market.execute('uninstall',{previewId:preview.previewId,name:'other'}),/invalid-request/)
  rows[0].specifier='link:D:/changed';rows[0].source='local'
  await assert.rejects(market.execute('uninstall',{previewId:preview.previewId}),/preview-stale/)
  assert.equal(removes,0)
})

test('uninstall failures retain installed state and do not set a successful restart notice',async()=>{
  const {market}=setup({installed:[{name:'demo',source:'registry',specifier:'1.0.0',installed:'1.0.0',removable:true}]})
  market.manager().removeBundle=async()=>({application:'failed',changed:false,error:{code:'stop-profile'}})
  const preview=await market.inspect({action:'uninstall',source:'installed',name:'demo'})
  const result=await market.execute('uninstall',{previewId:preview.previewId})
  assert.equal(result.ok,false);assert.equal(result.error.code,'stop-profile')
  assert.deepEqual(result.pendingRestart,[]);assert.equal((await market.installed()).rows[0].name,'demo')
})

test('uninstall previews expire and removal rechecks profile ownership and permissions',async()=>{
  const {market,rows,setNow}=setup({installed:[{name:'demo',source:'registry',specifier:'1.0.0',installed:'1.0.0',removable:true}]})
  let removes=0;market.manager().removeBundle=async()=>{removes++;return {application:'applied'}}
  let preview=await market.inspect({action:'uninstall',source:'installed',name:'demo'})
  setNow(600001);await assert.rejects(market.execute('uninstall',{previewId:preview.previewId}),/preview-expired/)
  preview=await market.inspect({action:'uninstall',source:'installed',name:'demo'})
  rows[0].removable=false
  await assert.rejects(market.execute('uninstall',{previewId:preview.previewId}),/not-removable/)
  rows[0].removable=true
  preview=await market.inspect({action:'uninstall',source:'installed',name:'demo'})
  const snapshot=market.profile.snapshot
  market.profile.snapshot=async()=>({...await snapshot(),profile:{dir:'another-profile'}})
  await assert.rejects(market.execute('uninstall',{previewId:preview.previewId}),/preview-stale/)
  assert.equal(removes,0)
})

test('active uninstall blocks concurrent writes and does not offer unsupported cancellation',async()=>{
  const {market}=setup({installed:[{name:'demo',source:'registry',specifier:'1.0.0',installed:'1.0.0',removable:true}]})
  let finish;market.manager().removeBundle=async()=>new Promise(resolve=>finish=resolve)
  const preview=await market.inspect({action:'uninstall',source:'installed',name:'demo'})
  const active=market.execute('uninstall',{previewId:preview.previewId})
  while(!finish)await new Promise(resolve=>setImmediate(resolve))
  const operation=market.operation({previewId:preview.previewId}).operation
  assert.equal(operation.phase,'removing');assert.equal(operation.cancellable,false)
  await assert.rejects(market.execute('install',{previewId:'another'}),/busy/)
  await assert.rejects(market.cancel({operationId:operation.operationId}),/cancellation-unavailable/)
  finish({application:'restart-required',changed:true});const result=await active
  assert.deepEqual(result.pendingRestart,['demo']);assert.equal(market.busy,false)
})
