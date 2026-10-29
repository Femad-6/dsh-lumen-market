import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,readFile,writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {gzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {SourceCatalog,catalogOrigin} from '../lib/host/catalog.js'
import {Market} from '../lib/host/market.js'

const sha='a'.repeat(40),manifest={name:'dsh-demo',version:'1.0.0',main:'lib/index.js',dsh:{bundle:{patch:'cordis.patch.yml'}}}
function archive(pkg=manifest,code='export const name="demo"'){
  const chunks=[]
  for(const [path,value] of Object.entries({'package.json':JSON.stringify(pkg),'lib/index.js':code,'cordis.patch.yml':'plugins: {}'})){
    const data=Buffer.from(value),head=Buffer.alloc(512)
    head.write('root/'+path);head.write('0000644',100);head.write(data.length.toString(8).padStart(11,'0'),124);head[156]=48
    head.fill(32,148,156);head.write([...head].reduce((a,b)=>a+b,0).toString(8).padStart(6,'0')+'\0 ',148)
    chunks.push(head,data,Buffer.alloc((512-data.length%512)%512))
  }
  return gzipSync(Buffer.concat([...chunks,Buffer.alloc(1024)]))
}
const bytes=archive(),integrity='sha512-'+createHash('sha512').update(bytes).digest('base64')
const entry={repo:'alice/demo',sha,name:'dsh-demo',version:'1.0.0',downloads:[{url:'https://mirror.example/demo.tgz',integrity}]}

test('imported source installs the hash-verified archive when GitHub is unavailable and reuses it offline',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'lumen-catalog-'));let calls=0
  const catalog=new SourceCatalog({fetchImpl:async url=>{calls++;assert.equal(url,entry.downloads[0].url);return new Response(bytes)}})
  await catalog.import(dir,{schemaVersion:1,entries:[entry]})
  const found=await catalog.search(dir,'demo')
  assert.equal(found.rows[0].repo,'alice/demo')
  const row=await catalog.resolve(dir,'alice/demo')
  assert.equal(row.validation,'bundle');assert.equal(row.manifest.name,'dsh-demo')
  assert.deepEqual(await readFile(row.archivePath),bytes)
  assert.deepEqual(await catalogOrigin(dir,'dsh-demo','file:'+row.archivePath,'1.0.0'),{repo:'alice/demo',sha})
  const offline=new SourceCatalog({fetchImpl:async()=>{throw new Error('offline')}})
  assert.equal((await offline.resolve(dir,'alice/demo')).archivePath,row.archivePath)
  assert.equal(calls,1)
})

test('source mirror fallback rejects wrong bytes and validates package identity before installation',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'lumen-catalog-')),urls=[]
  const catalog=new SourceCatalog({fetchImpl:async url=>{urls.push(url);return new Response(url.includes('bad')?Buffer.from('wrong'):bytes)}})
  await catalog.import(dir,{schemaVersion:1,entries:[{...entry,downloads:[{url:'https://bad.example/demo.tgz',integrity},...entry.downloads]}]})
  const row=await catalog.resolve(dir,'alice/demo');assert.equal(urls.length,2)
  await writeFile(row.archivePath,'corrupt cache')
  assert.equal(await catalogOrigin(dir,'dsh-demo','file:'+row.archivePath,'1.0.0'),null)
  assert.deepEqual(await readFile((await catalog.resolve(dir,'alice/demo')).archivePath),bytes)
  await catalog.import(dir,{schemaVersion:1,entries:[{...entry,name:'wrong-name'}]})
  await assert.rejects(catalog.resolve(dir,'alice/demo'),e=>e.code==='source-package-mismatch')
})

test('source import rejects mutable commits, unverified mirrors and arbitrary local URLs atomically',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'lumen-catalog-')),catalog=new SourceCatalog()
  await catalog.import(dir,{schemaVersion:1,entries:[entry]})
  for(const bad of [{...entry,sha:'main'},{...entry,downloads:[{url:'https://mirror.example/a.tgz'}]},{...entry,downloads:[{url:'file:///C:/secret',integrity}]},{...entry,downloads:[{url:'https://user:password@mirror.example/a',integrity}]}]){
    await assert.rejects(catalog.import(dir,{schemaVersion:1,entries:[bad]}),e=>e.code==='invalid-source')
  }
  assert.deepEqual((await catalog.list(dir)).entries,[entry])
})

test('adding a known repository caches its fixed archive and exports a portable pinned source',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'lumen-catalog-')),catalog=new SourceCatalog({fetchImpl:async url=>{
    assert.equal(url,'https://codeload.github.com/alice/demo/tar.gz/'+sha)
    return new Response(bytes)
  }})
  await catalog.remember(dir,{repo:'alice/demo',sha,name:'dsh-demo',version:'1.0.0'})
  const saved=await catalog.list(dir)
  assert.equal(saved.entries[0].downloads[0].integrity,integrity)
  assert.equal((await catalog.resolve(dir,'alice/demo')).manifest.version,'1.0.0')
})

test('market finds imported sources during an API outage and installs the verified local archive',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'lumen-catalog-')),catalog=new SourceCatalog({fetchImpl:async()=>new Response(bytes)}),calls=[]
  await catalog.import(dir,{schemaVersion:1,entries:[entry]})
  const market=new Market({catalog,github:{search:async()=>{throw Object.assign(new Error(),{code:'rate-limited'})},detail:async()=>{throw new Error('GitHub should not be needed')},clear(){}},npm:{clear(){}},manager:()=>({installBundle:async spec=>{calls.push(spec);return {application:'applied',changed:true}}}),profile:{snapshot:async()=>({profile:{dir},rows:[],runtimeVersion:'0.2.1-rc.2'})}})
  const found=await market.search({source:'catalog',q:'demo'})
  assert.equal(found.rows[0].repo,'alice/demo')
  const plan=await market.inspect({source:'github',repo:'alice/demo'})
  assert.equal(plan.preview.catalog,true)
  const result=await market.execute('install',{previewId:plan.previewId,compatibilityConsent:true})
  assert.equal(result.ok,true);assert.ok(calls[0].endsWith('.tgz'))
  assert.deepEqual(await readFile(calls[0]),bytes)
})

test('source content cannot change between preview and execution even with identical manifest and commit',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'lumen-catalog-'));let payload=bytes,installs=0
  const catalog=new SourceCatalog({fetchImpl:async()=>new Response(payload)})
  await catalog.import(dir,{schemaVersion:1,entries:[entry]})
  const market=new Market({catalog,github:{clear(){}},npm:{clear(){}},manager:()=>({installBundle:async()=>{installs++;return {application:'applied'}}}),profile:{snapshot:async()=>({profile:{dir},rows:[],runtimeVersion:'0.2.1-rc.2'})}})
  const plan=await market.inspect({source:'github',repo:'alice/demo'})
  payload=archive(manifest,'export const changed=true')
  await catalog.import(dir,{schemaVersion:1,entries:[{...entry,downloads:[{url:entry.downloads[0].url,integrity:'sha512-'+createHash('sha512').update(payload).digest('base64')}]}]})
  await assert.rejects(market.execute('install',{previewId:plan.previewId,compatibilityConsent:true}),e=>e.code==='preview-stale')
  assert.equal(installs,0)
})

test('learning a canonical archive hash never overwrites a source updated during download',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'lumen-catalog-'));let finish,started
  const ready=new Promise(resolve=>started=resolve)
  const catalog=new SourceCatalog({fetchImpl:async()=>{started();return new Promise(resolve=>finish=()=>resolve(new Response(bytes)))}})
  await catalog.import(dir,{schemaVersion:1,entries:[{...entry,downloads:[{url:'https://codeload.github.com/alice/demo/tar.gz/'+sha}]}]})
  const pending=catalog.resolve(dir,'alice/demo');await ready
  await catalog.import(dir,{schemaVersion:1,entries:[{...entry,sha:'b'.repeat(40)}]})
  finish();await pending
  assert.equal((await catalog.list(dir)).entries[0].sha,'b'.repeat(40))
})

test('updating a JSON feed remembers its address and refreshes pinned entries without installing',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'lumen-catalog-'));let latest=entry
  const catalog=new SourceCatalog({fetchImpl:async()=>new Response(JSON.stringify({schemaVersion:1,entries:[latest]}))})
  await catalog.update(dir,'https://catalog.example/plugins.json')
  assert.deepEqual((await catalog.list(dir)).feeds,['https://catalog.example/plugins.json'])
  latest={...entry,sha:'b'.repeat(40)}
  await catalog.update(dir,'https://catalog.example/plugins.json')
  const saved=await catalog.list(dir)
  assert.equal(saved.entries[0].sha,'b'.repeat(40));assert.equal(saved.feeds.length,1)
})
