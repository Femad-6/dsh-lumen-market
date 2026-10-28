import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,writeFile,readFile,unlink} from 'node:fs/promises'
import {join,relative} from 'node:path'
import {tmpdir} from 'node:os'
import {createHash} from 'node:crypto'
import {Reinstaller,reinstallOrigin} from '../lib/host/reinstall.js'
import {MarketError} from '../lib/host/core.js'

async function fixture({failInstall=false,failRemove=false,failRollback=false,corrupt=false,partialInstall=false}={}){
  const dir=await mkdtemp(join(tmpdir(),'lumen-reinstall-'))
  const settings='- id: demo\n  config: {color: blue}\n'
  const manifest={name:'isolated',dependencies:{demo:'1.0.0'},dsh:{profile:{bundles:['demo']}}}
  await mkdir(join(dir,'node_modules','demo'),{recursive:true})
  await writeFile(join(dir,'package.json'),JSON.stringify(manifest));await writeFile(join(dir,'cordis.patch.yml'),settings)
  await writeFile(join(dir,'node_modules','demo','package.json'),JSON.stringify({name:'demo',version:'1.0.0'}))
  const bytes=version=>Buffer.from('verified package '+version)
  const row=version=>({name:'demo',version,source:'npm',spec:'demo@'+version,validation:'bundle',manifest:{name:'demo',version,dsh:{bundle:{patch:'x.yml'}},dist:{tarball:'https://registry.example/demo-'+version+'.tgz',integrity:'sha512-'+createHash('sha512').update(bytes(version)).digest('base64')}}})
  const service=new Reinstaller({npm:{detail:async(name,version)=>row(version)},fetchImpl:async url=>new Response(corrupt?'damaged':bytes(url.includes('1.0.0')?'1.0.0':'2.0.0'))})
  const calls=[],installSpecs=[]
  const save=async version=>{
    const current=JSON.parse(await readFile(join(dir,'package.json'),'utf8'))
    if(version){current.dependencies.demo=version;current.dsh.profile.bundles=['demo'];await writeFile(join(dir,'node_modules','demo','package.json'),JSON.stringify({name:'demo',version}))}
    else{delete current.dependencies.demo;current.dsh.profile.bundles=[]}
    await writeFile(join(dir,'package.json'),JSON.stringify(current))
  }
  const manager={
    removeBundle:async()=>{calls.push('remove');if(failRemove)return {application:'failed',changed:false,error:{code:'bundle-in-use'}};await save(null);return {application:'applied',changed:true}},
    installBundle:async spec=>{const rollback=spec.endsWith('previous.tgz');installSpecs.push(spec);calls.push(rollback?'restore':'install');if(rollback&&failRollback||!rollback&&failInstall){if(partialInstall&&!rollback){const m=JSON.parse(await readFile(join(dir,'package.json'),'utf8'));m.dependencies.demo='2.0.0';await writeFile(join(dir,'package.json'),JSON.stringify(m));await unlink(join(dir,'node_modules','demo','package.json'))}return {application:'failed',changed:false,error:{code:'operation-error'}}}await save(rollback?'1.0.0':'2.0.0');return {application:'applied',changed:true}},
    setBundleEnabled:async()=>({application:'applied',changed:false}),
  }
  const existing={name:'demo',installed:'1.0.0',specifier:'1.0.0',source:'registry',bundle:true,enabled:true,removable:true}
  return {dir,settings,service,calls,installSpecs,manager,existing,target:row('2.0.0'),run:(options={})=>service.run({dir,existing,target:row('2.0.0'),manager,onPhase(){},...options})}
}

test('confirmed reinstall stages packages and keeps configuration while removing then installing',async()=>{
  const f=await fixture(),r=await f.run()
  assert.equal(r.ok,true);assert.deepEqual(f.calls,['remove','install'])
  assert.ok(f.installSpecs[0].endsWith('target.tgz'),'install exactly the staged and verified target')
  assert.equal(await readFile(join(f.dir,'cordis.patch.yml'),'utf8'),f.settings)
  assert.equal(JSON.parse(await readFile(join(f.dir,'node_modules','demo','package.json'),'utf8')).version,'2.0.0')
  assert.equal(await f.service.pending(f.dir),null)
})
test('a completed archive retains npm provenance, arbitrary local files do not',async()=>{
  const f=await fixture();await f.run()
  assert.equal((await reinstallOrigin(f.dir,'demo','file:'+f.installSpecs[0],'2.0.0')).name,'demo')
  assert.equal((await reinstallOrigin(f.dir,'demo','file:'+relative(f.dir,f.installSpecs[0]),'2.0.0')).name,'demo')
  assert.equal(await reinstallOrigin(f.dir,'demo','file:'+f.installSpecs[0],'9.0.0'),null)
  assert.equal(await reinstallOrigin(f.dir,'demo','file:'+join(f.dir,'untrusted.tgz'),'2.0.0'),null)
})
test('partial failed installation with missing modules still restores the old archive',async()=>{
  const f=await fixture({failInstall:true,partialInstall:true}),r=await f.run()
  assert.equal(r.recovery.status,'restored');assert.deepEqual(f.calls,['remove','install','remove','restore'])
  assert.equal(JSON.parse(await readFile(join(f.dir,'node_modules','demo','package.json'),'utf8')).version,'1.0.0')
})
test('an unavailable or corrupt recovery archive stops before uninstall',async()=>{
  const f=await fixture({corrupt:true})
  await assert.rejects(f.run(),error=>error.code==='package-integrity')
  assert.deepEqual(f.calls,[])
})
test('preparation network failure retains the old version and releases only the activity marker',async()=>{
  const f=await fixture();f.service.fetch=async()=>{throw new Error('network unavailable')}
  await assert.rejects(f.run(),error=>error.code==='reinstall-preparation-failed')
  assert.deepEqual(f.calls,[]);assert.equal(await f.service.pending(f.dir),null)
})
test('archive redirect cannot downgrade HTTPS before removal',async()=>{
  const f=await fixture();f.service.fetch=async()=>new Response(null,{status:302,headers:{location:'http://untrusted.invalid/archive.tgz'}})
  await assert.rejects(f.run(),error=>error.code==='reinstall-package-unavailable')
  assert.deepEqual(f.calls,[])
})
test('market disposal during preparation stops before uninstall',async()=>{
  const f=await fixture()
  await assert.rejects(f.run({assertActive(){throw new MarketError('disposed',503)}}),error=>error.code==='disposed')
  assert.deepEqual(f.calls,[]);assert.equal(await f.service.pending(f.dir),null)
})
test('an old version incompatible with the current host is rejected before uninstall',async()=>{
  const f=await fixture(),detail=f.service.npm.detail
  f.service.npm.detail=async(...args)=>{const old=await detail(...args);old.manifest.engines={dsh:'>=99'};return old}
  await assert.rejects(f.run({runtimeVersion:'0.2.1-rc.2'}),error=>error.code==='recovery-incompatible')
  assert.deepEqual(f.calls,[])
})
test('market disposal after removal restores the old version instead of installing the new one',async()=>{
  const f=await fixture()
  const result=await f.run({assertActive(){if(f.calls.includes('remove'))throw new MarketError('disposed',503)}})
  assert.equal(result.recovery.status,'restored');assert.deepEqual(f.calls,['remove','restore'])
})
test('official removal rejection never proceeds with the new installation',async()=>{
  const f=await fixture({failRemove:true}),r=await f.run()
  assert.equal(r.ok,false);assert.deepEqual(f.calls,['remove'])
})
test('new installation failure restores the verified old package without another network fetch',async()=>{
  const f=await fixture({failInstall:true}),r=await f.run()
  assert.equal(r.ok,false);assert.equal(r.recovery.status,'restored')
  assert.deepEqual(f.calls,['remove','install','restore'])
  assert.equal(JSON.parse(await readFile(join(f.dir,'node_modules','demo','package.json'),'utf8')).version,'1.0.0')
  assert.equal(await readFile(join(f.dir,'cordis.patch.yml'),'utf8'),f.settings)
})
test('failed old-version recovery retains a durable recovery-required journal',async()=>{
  const f=await fixture({failInstall:true,failRollback:true}),r=await f.run()
  assert.equal(r.ok,false);assert.equal(r.recovery.status,'required')
  assert.equal((await f.service.pending(f.dir)).status,'recovery-required')
  await assert.rejects(f.run(),error=>error.code==='recovery-required')
})
