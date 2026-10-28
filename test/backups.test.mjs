import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,writeFile,readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {ProfileBackups} from '../lib/host/backups.js'

async function fixture(){
  const dir=await mkdtemp(join(tmpdir(),'lumen-profile-backup-'))
  const manifest={name:'isolated',dependencies:{demo:'1.0.0',local:'link:D:/private/work'},dsh:{profile:{bundles:['demo','local']}}}
  const patch='- id: demo\n  config: {apiKey: private-fixture-key}\n'
  await writeFile(join(dir,'package.json'),JSON.stringify(manifest));await writeFile(join(dir,'cordis.patch.yml'),patch)
  const context={profile:{dir},runtimeVersion:'0.2.1-rc.2',bundleOrder:['demo','local'],rows:[{name:'demo',source:'registry',specifier:'1.0.0',installed:'1.0.0',bundle:true,enabled:true},{name:'local',source:'local',specifier:'link:D:/private/work',installed:'1.0.0',bundle:true,enabled:false}]}
  return {dir,patch,context,store:new ProfileBackups()}
}
test('profile backup keeps exact configuration locally but exports no private configuration or paths',async()=>{
  const f=await fixture(),backup=await f.store.create(f.context)
  assert.equal(await readFile(join(backup.directory,'files','cordis.patch.yml'),'utf8'),f.patch)
  const exported=await f.store.export(f.dir,backup.id)
  const json=JSON.stringify(exported)
  for(const text of ['private-fixture-key','apiKey','D:/private/work',f.dir])assert.equal(json.includes(text),false)
  assert.equal(exported.plugins[0].target,'demo@1.0.0')
  assert.equal(exported.plugins[1].manual,true)
  assert.equal((await f.store.list(f.dir)).length,1)
  assert.equal(await readFile(join(f.dir,'cordis.patch.yml'),'utf8'),f.patch)
})
test('restore preview shows changes without installing, deleting, or overwriting anything',async()=>{
  const f=await fixture(),backup=await f.store.create(f.context)
  await writeFile(join(f.dir,'cordis.patch.yml'),'changed configuration')
  const context={...f.context,rows:[{...f.context.rows[0],installed:'2.0.0'},{name:'new',installed:'1.0.0',source:'registry',bundle:true}]}
  const result=await f.store.preview(context,{backupId:backup.id})
  assert.equal(result.changedVersions[0].name,'demo')
  assert.equal(result.missing[0].name,'local')
  assert.equal(result.kept[0].name,'new')
  assert.equal(result.configuration.find(row=>row.name==='cordis.patch.yml').changed,true)
  assert.equal(await readFile(join(f.dir,'cordis.patch.yml'),'utf8'),'changed configuration')
})
test('backup identifiers, imported manifests and tampered snapshots fail closed',async()=>{
  const f=await fixture()
  await assert.rejects(f.store.export(f.dir,'../outside'),e=>e.code==='invalid-backup')
  await assert.rejects(f.store.preview(f.context,{backup:{schemaVersion:1,format:'dsh-lumen-profile',plugins:[{name:'../bad'}]}}),e=>e.code==='invalid-backup')
  const backup=await f.store.create(f.context)
  await writeFile(join(backup.directory,'files','cordis.patch.yml'),'tampered')
  await assert.rejects(f.store.preview(f.context,{backupId:backup.id}),e=>e.code==='backup-integrity')
})
test('imported plugin lists produce a read-only diff and keep additional installed plugins',async()=>{
  const f=await fixture(),backup=await f.store.create(f.context),exported=await f.store.export(f.dir,backup.id)
  const result=await f.store.preview({...f.context,rows:[{name:'extra',installed:'1.0.0',source:'registry'}]},{backup:exported})
  assert.equal(result.missing.length,2);assert.equal(result.kept[0].name,'extra')
  assert.equal(result.readOnly,true)
})
test('restore preview detects same-version source changes and different pinned GitHub commits',async()=>{
  const f=await fixture(),created=await f.store.create(f.context),backup=await f.store.export(f.dir,created.id)
  let diff=await f.store.preview({...f.context,rows:[{...f.context.rows[0],source:'local',specifier:'link:D:/another'}]},{backup})
  assert.equal(diff.changedSources[0].name,'demo')
  backup.plugins[0]={...backup.plugins[0],source:'git',target:'github:owner/demo#'+'a'.repeat(40)}
  diff=await f.store.preview({...f.context,rows:[{...f.context.rows[0],source:'git',specifier:'github:owner/demo#'+'b'.repeat(40)}]},{backup})
  assert.equal(diff.changedSources[0].backupTarget,'github:owner/demo#'+'a'.repeat(40))
})
test('a dependency added after the context snapshot prevents an incomplete backup',async()=>{
  const f=await fixture(),manifest=JSON.parse(await readFile(join(f.dir,'package.json'),'utf8'))
  manifest.dependencies.new='2.0.0';await writeFile(join(f.dir,'package.json'),JSON.stringify(manifest))
  await assert.rejects(f.store.create(f.context),error=>error.code==='preview-stale')
  assert.equal((await f.store.list(f.dir)).length,0)
})
