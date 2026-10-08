import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { classifySpecifier, exactVersion, packageName, normalizeResult } from '../lib/host/core.js'
import { safeLinks } from '../lib/host/links.js'
import { evaluateCompatibility } from '../lib/host/compat.js'
import { Cache } from '../lib/host/cache.js'
import { Profile } from '../lib/host/profile.js'
import { readJSON } from '../lib/host/http.js'
import { registriesOf } from '../lib/host/npm.js'

test('local/git/alias/tarball sources cannot become registry upgrades', () => {
  for (const [spec, want] of [['link:D:/dev','local'],['file:../x','local'],['npm:other@1','alias'],['github:a/b#abc','git'],['https://x/y.tgz?download=1','tarball'],['git@github.com:a/b','git'],['../local','local'],['^1.0.0','registry']]) assert.equal(classifySpecifier(spec), want)
  for (const v of ['latest','^1.2.3','01.2.3','1.2.3-01','1.2.3;echo']) assert.equal(exactVersion(v), false)
  assert.equal(exactVersion('1.2.3-rc.1+build.9'), true)
  assert.equal(packageName('../bad'), false)
})
test('application determines success and cancelled is never success', () => {
  assert.equal(normalizeResult({ok:true,application:'failed'}).ok, false)
  assert.equal(normalizeResult({application:'cancelled'}).ok, false)
  assert.equal(normalizeResult({application:'restart-required',changed:true}).restartRequired, true)
})
test('links reject credentials and dangerous schemes; normalize repository metadata', () => {
  const links = safeLinks({name:'@scope/demo',homepage:'javascript:alert(1)',repository:{url:'git+https://github.com/alice/demo.git'}})
  assert.deepEqual(links, {repository:'https://github.com/alice/demo',readme:'https://github.com/alice/demo',npm:'https://www.npmjs.com/package/@scope/demo'})
  assert.equal(safeLinks({homepage:'https://user:pass@example.com'}).homepage, undefined)
  assert.equal(safeLinks({repository:'git@github.com:alice/demo.git'}).repository, 'https://github.com/alice/demo')
  assert.equal(safeLinks({}, {source:'github',repo:'alice/demo',sha:'a'.repeat(40)}).readme, 'https://github.com/alice/demo/tree/'+'a'.repeat(40))
})
test('full peer semver handles prerelease, workspace, malformed non-DSH peers and exact exemptions', () => {
  const make = range => ({name:'demo',version:'1.0.0',peerDependencies:{'@deepseek-ai/dsh':range}})
  for (const range of ['>=0.1.0 <0.2.0 || ^0.3.0','workspace:^']) assert.equal(evaluateCompatibility(make(range),'0.2.0-rc.2').verdict,'compatible')
  assert.equal(evaluateCompatibility(make(''),'0.2.0').verdict,'incompatible')
  assert.equal(evaluateCompatibility(make('^0.1.0'),null).verdict,'unknown')
  assert.equal(evaluateCompatibility({peerDependencies:{react:42}},'0.2.0').malformed,true)
  assert.equal(evaluateCompatibility(make('^0.1.0'),'0.2.0',{'demo@1.0.0':['0.2.0']}).exempted,true)
})
test('cache expires, bounds entries and deduplicates reads, clear prevents stale reinsertion', async () => {
  let now = 0, count = 0, resolve
  const cache = new Cache({ttl:10,max:2,now:()=>now})
  const task = () => { count++; return new Promise(r=>resolve=r) }
  const a = cache.load('x',task), b = cache.load('x',task)
  await Promise.resolve(); resolve(7)
  assert.deepEqual(await Promise.all([a,b]),[7,7]); assert.equal(count,1)
  now=11; assert.equal(cache.get('x'),undefined)
  cache.set('a',1); cache.set('b',2); cache.set('c',3); assert.equal(cache.get('a'),undefined)
  const stale = cache.load('late',task); await Promise.resolve(); cache.clear(); resolve(9); await stale
  assert.equal(cache.get('late'),undefined)
})
test('profile verifies manifest, chooses argv before hmr/env, reads actual installed version', async () => {
  const dir=mkdtempSync(join(tmpdir(),'lumen-profile-')), other=mkdtempSync(join(tmpdir(),'lumen-other-'))
  writeFileSync(join(dir,'package.json'),JSON.stringify({dsh:{profile:{bundles:['demo']}},dependencies:{demo:'^1.0.0'}}))
  writeFileSync(join(other,'package.json'),JSON.stringify({dsh:{profile:{bundles:[]}}}))
  mkdirSync(join(dir,'node_modules','demo'),{recursive:true})
  writeFileSync(join(dir,'node_modules','demo','package.json'),JSON.stringify({name:'demo',version:'1.2.0',description:'A real description',homepage:'https://example.com'}))
  const profile=new Profile({argv:['node','bad-path',dir],env:{DSH_PROFILE_DIR:other},hmrBaseDir:()=>other})
  const snapshot=await profile.snapshot({listBundles:async()=>[{name:'@deepseek-ai/dsh-base',version:'0.2.0'}]})
  assert.equal(snapshot.profile.dir,dir); assert.equal(snapshot.rows[0].installed,'1.2.0')
  assert.equal(snapshot.rows[0].description,'A real description'); assert.equal(snapshot.runtimeVersion,'0.2.0')
  assert.equal(new Profile({argv:[],env:{}}).resolution().dir,null)
})
test('bounded JSON reader rejects oversized streamed response and cancels the body', async () => {
  let cancelled=false
  const stream=new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('x'.repeat(33)))},cancel(){cancelled=true}})
  await assert.rejects(readJSON(async()=>new Response(stream),'https://example.com',{maxBytes:32}),/response-too-large/)
  assert.equal(cancelled,true)
})
test('registries honor manager resolved private registry before mirror fallbacks',()=>{
  assert.deepEqual(registriesOf({registry:null,resolved:'https://private.example/npm/',fallbackRegistries:['https://registry.npmmirror.com/']}),['https://private.example/npm','https://registry.npmmirror.com'])
})
test('installation-provided bundle never becomes a registry upgrade even when profile depends on it',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'lumen-shipped-'))
  writeFileSync(join(dir,'package.json'),JSON.stringify({dsh:{profile:{bundles:['base']}},dependencies:{base:'1.0.0'}}))
  const p=new Profile({argv:['node',dir],env:{}})
  const snap=await p.snapshot({listBundles:async()=>[{name:'base',version:'0.2.0',installed:false,removable:false}]})
  assert.equal(snap.rows[0].source,'shipped');assert.equal(snap.rows[0].installed,'0.2.0')
})
