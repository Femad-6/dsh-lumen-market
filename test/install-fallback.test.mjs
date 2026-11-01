import {test} from 'node:test'
import assert from 'node:assert/strict'
import {Market} from '../lib/host/market.js'
import {MarketError} from '../lib/host/core.js'

const sha='a'.repeat(40)
const manifest={name:'dsh-demo',version:'1.0.0',repository:'github:alice/demo',engines:{dsh:'>=0.2.0'},dsh:{bundle:{patch:'x.yml'}}}
function fixture(){
  const calls=[]
  const npmRow={source:'npm',name:manifest.name,version:'1.0.0',spec:'dsh-demo@1.0.0',validation:'bundle',manifest,registry:'https://first.example'}
  const gitRow={...npmRow,source:'github',repo:'alice/demo',sha,spec:`github:alice/demo#${sha}`,registry:undefined}
  const manager={inspect:async()=>({status:'accepted'}),registries:async()=>({registry:'https://first.example',fallbackRegistries:['https://mirror.example'],resolved:'https://first.example'}),installBundle:async(spec,options)=>{calls.push({spec,registry:options.registry});return {application:'applied',changed:true}}}
  const market=new Market({npm:{detail:async()=>npmRow,clear(){}},github:{detail:async()=>gitRow,clear(){}},profile:{snapshot:async()=>({profile:{dir:'fallback-fixture'},rows:[],runtimeVersion:'0.2.1'})},manager:()=>manager})
  return {market,manager,calls,npmRow,gitRow}
}
test('GitHub discovery installs through npm first without requiring a GitHub API request',async()=>{
  const {market,calls}=fixture()
  let githubCalls=0
  market.github.detail=async()=>{githubCalls++;throw new MarketError('rate-limited',502,{retryAt:999999})}
  const plan=await market.inspect({source:'github',repo:'alice/demo',name:'dsh-demo',version:'1.0.0'})
  assert.equal(plan.preview.source,'npm')
  assert.equal((await market.execute('install',{previewId:plan.previewId})).ok,true)
  assert.equal(calls[0].spec,'dsh-demo@1.0.0')
  assert.equal(githubCalls,0)
})
test('installation tries the next configured registry when the first download fails',async()=>{
  const {market,manager,calls}=fixture()
  manager.installBundle=async(spec,options)=>{calls.push({spec,registry:options.registry});return options.registry==='https://mirror.example'?{application:'applied',changed:true}:{application:'failed',changed:false,stage:'package',failedAt:'registry',packageResult:{kind:'network'}}}
  const plan=await market.inspect({source:'npm',name:'dsh-demo',version:'1.0.0'})
  const result=await market.execute('install',{previewId:plan.previewId})
  assert.equal(result.ok,true)
  assert.deepEqual(calls.map(c=>c.registry),['https://first.example','https://mirror.example'])
  assert.match(result.installation.logs,/mirror.example/)
})
test('failed npm downloads automatically continue to the pinned GitHub target',async()=>{
  const {market,manager,calls}=fixture()
  manager.installBundle=async(spec,options)=>{calls.push({spec,registry:options.registry});return spec.startsWith('github:')?{application:'applied',changed:true}:{application:'failed',changed:false,stage:'package',failedAt:'registry',packageResult:{kind:'network'}}}
  const plan=await market.inspect({source:'github',repo:'alice/demo',name:'dsh-demo',version:'1.0.0'})
  const result=await market.execute('install',{previewId:plan.previewId})
  assert.equal(result.ok,true)
  assert.equal(result.source,'github')
  assert.equal(calls[0].spec,'dsh-demo@1.0.0')
  assert.equal(calls.at(-1).spec,`github:alice/demo#${sha}`)
})
test('GitHub detail also falls back to npm instead of failing on API limits',async()=>{
  const {market}=fixture()
  market.github.detail=async()=>{throw new MarketError('rate-limited',502)}
  const detail=await market.detail({source:'github',repo:'alice/demo',name:'dsh-demo',version:'1.0.0'})
  assert.equal(detail.source,'npm')
  assert.equal(detail.installable,true)
})
test('npm fallback never installs a different GitHub version',async()=>{
  const {market,manager,gitRow,calls}=fixture()
  market.github.detail=async()=>({...gitRow,version:'2.0.0',manifest:{...manifest,version:'2.0.0'}})
  manager.installBundle=async(spec,options)=>{calls.push({spec,registry:options.registry});return {application:'failed',changed:false,stage:'install',packageResult:{kind:'network'}}}
  const plan=await market.inspect({source:'npm',name:'dsh-demo',version:'1.0.0'})
  const result=await market.execute('install',{previewId:plan.previewId})
  assert.equal(result.ok,false)
  assert.equal(result.sourcesExhausted,true)
  assert.equal(calls.some(c=>c.spec.startsWith('github:')),false)
  assert.ok(result.sourceAttempts.some(a=>a.code==='source-package-mismatch'))
})
test('confirmed unchanged installer exceptions continue to the next registry',async()=>{
  const {market,manager,calls}=fixture()
  manager.installBundle=async(spec,options)=>{calls.push({spec,registry:options.registry});if(calls.length===1)throw new MarketError('network',502,{changed:false,stage:'install'});return {application:'applied',changed:true}}
  const plan=await market.inspect({source:'npm',name:'dsh-demo',version:'1.0.0'})
  assert.equal((await market.execute('install',{previewId:plan.previewId})).ok,true)
  assert.equal(calls[1].registry,'https://mirror.example')
})
test('a source that goes offline during final revalidation cannot block another available source',async()=>{
  const {market,gitRow,calls,npmRow}=fixture()
  let offline=false
  market.catalog={list:async()=>({entries:[]}),resolve:async()=>{if(offline)throw new MarketError('network',502);return {...gitRow,catalog:true,archivePath:'verified.tgz',archiveIntegrity:'sha512-fixture'}}}
  market.github.detail=async()=>{throw new MarketError('rate-limited',502)}
  market.npm.detail=async()=>{if(!offline)throw new MarketError('network',502);return npmRow}
  const plan=await market.inspect({source:'github',repo:'alice/demo',name:'dsh-demo',version:'1.0.0'})
  offline=true
  const result=await market.execute('install',{previewId:plan.previewId})
  assert.equal(result.ok,true)
  assert.equal(calls[0].spec,'dsh-demo@1.0.0')
})
test('npm is preferred after the repository metadata reveals a different npm package name',async()=>{
  const {market}=fixture()
  const plan=await market.inspect({source:'github',repo:'alice/demo'})
  assert.equal(plan.preview.source,'npm')
  assert.equal(plan.preview.name,'dsh-demo')
})
test('a same-name npm package from another repository is never installed as fallback',async()=>{
  const {market,npmRow,calls}=fixture()
  market.github.detail=async()=>{throw new MarketError('rate-limited',502)}
  market.npm.detail=async()=>({...npmRow,manifest:{...manifest,repository:'github:mallory/demo'}})
  await assert.rejects(market.inspect({source:'github',repo:'alice/demo',name:'dsh-demo',version:'1.0.0'}),e=>e.code==='install-sources-exhausted'&&e.extra.sourceAttempts.some(a=>a.code==='source-package-mismatch'))
  assert.equal(calls.length,0)
})
test('all unavailable metadata sources are summarized instead of only asking to wait for GitHub',async()=>{
  const {market}=fixture()
  market.github.detail=async()=>{throw new MarketError('rate-limited',502,{retryAt:999999})}
  market.npm.detail=async()=>{throw new MarketError('network',502)}
  await assert.rejects(market.inspect({source:'github',repo:'alice/demo',name:'dsh-demo',version:'1.0.0'}),e=>e.code==='install-sources-exhausted'&&e.extra.sourceAttempts.some(a=>a.source==='npm')&&e.extra.sourceAttempts.some(a=>a.source==='github')&&!e.extra.retryAt)
})
test('script approval and partially applied results stop automatic retries',async()=>{
  for(const failure of [{application:'failed',changed:false,packageResult:{kind:'build-blocked'},pendingBuilds:['demo']},{application:'failed',changed:true,packageResult:{kind:'network'}},{application:'failed',changed:false,stage:'apply',packageResult:{kind:'network'}}]){
    const {market,manager,calls}=fixture()
    manager.installBundle=async(spec,options)=>{calls.push({spec,registry:options.registry});return failure}
    const plan=await market.inspect({source:'npm',name:'dsh-demo',version:'1.0.0'})
    const result=await market.execute('install',{previewId:plan.previewId})
    assert.equal(result.ok,false)
    assert.equal(calls.length,1)
  }
})
test('cancelling while resolving a fallback prevents the next installer call',async()=>{
  const {market,manager,gitRow,calls}=fixture()
  let release,started
  const resolving=new Promise(resolve=>started=resolve)
  market.github.detail=async()=>{started();return new Promise(resolve=>release=()=>resolve(gitRow))}
  manager.installBundle=async(spec,options)=>{calls.push({spec,registry:options.registry});return {application:'failed',changed:false,stage:'install',packageResult:{kind:'network'},registries:['https://first.example','https://mirror.example']}}
  const plan=await market.inspect({source:'npm',name:'dsh-demo',version:'1.0.0'})
  const active=market.execute('install',{previewId:plan.previewId})
  await resolving
  const operation=market.operation({previewId:plan.previewId}).operation
  await market.cancel({operationId:operation.operationId})
  release()
  const result=await active
  assert.equal(result.application,'cancelled')
  assert.equal(calls.length,1)
})
test('an official package identity mismatch revokes earlier installation previews',async()=>{
  const {market,manager,calls}=fixture()
  const plan=await market.inspect({source:'npm',name:'dsh-demo',version:'1.0.0'})
  manager.inspect=async()=>({status:'accepted',name:'other-plugin',version:'1.0.0'})
  await assert.rejects(market.inspect({source:'npm',name:'dsh-demo',version:'1.0.0'}),e=>e.code==='preview-stale')
  await assert.rejects(market.execute('install',{previewId:plan.previewId}),e=>e.code==='preview-stale')
  assert.equal(calls.length,0)
})
test('a direct GitHub install can still try a matching catalog mirror after host failure',async()=>{
  const {market,manager,calls,gitRow}=fixture()
  market.npm.detail=async()=>{throw new MarketError('not-found',404)}
  market.catalog={list:async()=>({entries:[{repo:'alice/demo',name:'dsh-demo',version:'1.0.0',sha}]}),resolve:async()=>null}
  manager.installBundle=async(spec,options)=>{calls.push({spec,registry:options.registry});return spec==='mirror.tgz'?{application:'applied',changed:true}:{application:'failed',changed:false,stage:'install',failedAt:'spec-host',packageResult:{kind:'network'}}}
  const plan=await market.inspect({source:'github',repo:'alice/demo',name:'dsh-demo',version:'1.0.0'})
  let attempts=0
  market.catalog.resolve=async()=>{attempts++;return attempts===1?null:{...gitRow,catalog:true,archivePath:'mirror.tgz',archiveIntegrity:'sha512-fixture'}}
  const result=await market.execute('install',{previewId:plan.previewId})
  assert.equal(result.ok,true)
  assert.equal(calls.at(-1).spec,'mirror.tgz')
})
test('npm disappearing during final revalidation still tries the repository recorded in its manifest',async()=>{
  const {market,calls}=fixture()
  const plan=await market.inspect({source:'npm',name:'dsh-demo',version:'1.0.0'})
  market.npm.detail=async()=>{throw new MarketError('not-found',404)}
  const result=await market.execute('install',{previewId:plan.previewId})
  assert.equal(result.ok,true)
  assert.equal(calls[0].spec,`github:alice/demo#${sha}`)
})
test('a catalog download outage can use GitHub at the identical commit during final revalidation',async()=>{
  const {market,gitRow,calls}=fixture()
  let offline=false
  market.npm.detail=async()=>{throw new MarketError('not-found',404)}
  market.catalog={list:async()=>({entries:[]}),resolve:async()=>{if(offline)throw new MarketError('network',502);return {...gitRow,catalog:true,archivePath:'verified.tgz',archiveIntegrity:'sha512-fixture'}}}
  const plan=await market.inspect({source:'github',repo:'alice/demo',name:'dsh-demo',version:'1.0.0'})
  offline=true
  assert.equal((await market.execute('install',{previewId:plan.previewId})).ok,true)
  assert.equal(calls[0].spec,`github:alice/demo#${sha}`)
})
test('an unrelated bare npm package does not prevent discovery of the repository owners scoped package',async()=>{
  const {market,manager,npmRow,calls}=fixture()
  const names=[]
  market.npm.detail=async(name,version)=>{
    names.push(name)
    assert.equal(version,'1.0.0')
    if(name==='dsh-demo')return {...npmRow,manifest:{...manifest,repository:undefined}}
    if(name==='@alice/dsh-demo')return {...npmRow,name,spec:name+'@1.0.0',manifest:{...manifest,name}}
    throw new MarketError('not-found',404)
  }
  market.github.detail=async()=>{throw new MarketError('rate-limited',502)}
  manager.inspect=async()=>({status:'accepted',name:'@alice/dsh-demo',version:'1.0.0'})
  const plan=await market.inspect({source:'github',repo:'alice/demo',name:'dsh-demo',version:'1.0.0'})
  assert.equal(plan.preview.name,'@alice/dsh-demo')
  assert.equal(plan.preview.spec,'@alice/dsh-demo@1.0.0')
  assert.equal((await market.execute('install',{previewId:plan.previewId})).ok,true)
  assert.equal(calls[0].spec,'@alice/dsh-demo@1.0.0')
  assert.deepEqual(names.slice(0,2),['dsh-demo','@alice/dsh-demo'])
})
test('a scoped package with a different repository is rejected too',async()=>{
  const {market,npmRow,calls}=fixture()
  market.npm.detail=async name=>({...npmRow,name,spec:name+'@1.0.0',manifest:{...manifest,name,repository:'github:mallory/demo'}})
  market.github.detail=async()=>{throw new MarketError('rate-limited',502)}
  await assert.rejects(market.inspect({source:'github',repo:'alice/demo',name:'dsh-demo',version:'1.0.0'}),e=>e.code==='install-sources-exhausted')
  assert.equal(calls.length,0)
})
test('scoped npm install can fall back to the repositories unscoped package at the same version',async()=>{
  const {market,manager,npmRow,calls}=fixture()
  market.npm.detail=async name=>({...npmRow,name,spec:name+'@1.0.0',manifest:{...manifest,name}})
  manager.installBundle=async(spec,options)=>{calls.push({spec,registry:options.registry});return spec.startsWith('github:')?{application:'applied',changed:true}:{application:'failed',changed:false,stage:'install',packageResult:{kind:'network'}}}
  const plan=await market.inspect({source:'npm',name:'@alice/dsh-demo',version:'1.0.0'})
  assert.equal((await market.execute('install',{previewId:plan.previewId})).ok,true)
  assert.equal(calls.at(-1).spec,`github:alice/demo#${sha}`)
})
test('a scoped alias cannot duplicate the unscoped installation in the same profile',async()=>{
  const {market,npmRow,calls}=fixture()
  market.npm.detail=async name=>({...npmRow,name,spec:name+'@1.0.0',manifest:{...manifest,name}})
  market.profile.snapshot=async()=>({profile:{dir:'fallback-fixture'},runtimeVersion:'0.2.1',rows:[{name:'dsh-demo',source:'git',specifier:`github:alice/demo#${sha}`,installed:'1.0.0',manifest}]})
  await assert.rejects(market.inspect({source:'npm',name:'@alice/dsh-demo',version:'1.0.0'}),e=>e.code==='source-conflict'||e.code==='already-installed')
  assert.equal(calls.length,0)
})
test('a different installed repository with the same bare name is not mistaken for the scoped plugin',async()=>{
  const {market,npmRow}=fixture()
  market.npm.detail=async name=>({...npmRow,name,spec:name+'@1.0.0',manifest:{...manifest,name}})
  market.profile.snapshot=async()=>({profile:{dir:'fallback-fixture'},runtimeVersion:'0.2.1',rows:[{name:'dsh-demo',source:'registry',installed:'1.0.0',manifest:{...manifest,repository:'github:bob/other-plugin'}}]})
  const plan=await market.inspect({source:'npm',name:'@alice/dsh-demo',version:'1.0.0'})
  assert.equal(plan.preview.name,'@alice/dsh-demo')
})
test('bare npm download failure continues to a verified scoped alias before relying on GitHub',async()=>{
  const {market,manager,npmRow,calls}=fixture()
  market.npm.detail=async name=>({...npmRow,name,spec:name+'@1.0.0',manifest:{...manifest,name}})
  market.github.detail=async()=>{throw new MarketError('rate-limited',502)}
  manager.installBundle=async(spec,options)=>{calls.push({spec,registry:options.registry});return spec==='@alice/dsh-demo@1.0.0'?{application:'applied',changed:true}:{application:'failed',changed:false,stage:'install',packageResult:{kind:'network'}}}
  const plan=await market.inspect({source:'github',repo:'alice/demo',name:'dsh-demo',version:'1.0.0'})
  assert.equal(plan.preview.name,'dsh-demo')
  assert.equal((await market.execute('install',{previewId:plan.previewId})).ok,true)
  assert.equal(calls.at(-1).spec,'@alice/dsh-demo@1.0.0')
})
test('bare npm metadata disappearing during final revalidation can switch to the scoped npm alias',async()=>{
  const {market,npmRow,calls}=fixture()
  const plan=await market.inspect({source:'npm',name:'dsh-demo',version:'1.0.0'})
  market.npm.detail=async name=>{
    if(name==='dsh-demo')throw new MarketError('not-found',404)
    return {...npmRow,name,spec:name+'@1.0.0',manifest:{...manifest,name}}
  }
  assert.equal((await market.execute('install',{previewId:plan.previewId})).ok,true)
  assert.equal(calls[0].spec,'@alice/dsh-demo@1.0.0')
})
