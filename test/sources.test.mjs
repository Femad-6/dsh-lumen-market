import { test } from 'node:test'
import assert from 'node:assert/strict'
import { NpmSource } from '../lib/host/npm.js'
import { GithubSource, repoKey } from '../lib/host/github.js'
import { HTTP } from '../lib/host/http.js'
const manifest={name:'dsh-demo',version:'1.0.0',description:'Small useful plugin',main:'lib/index.js',exports:{'.':'./lib/index.js','./client':'./lib/client.js'},dsh:{bundle:{patch:'./cordis.patch.yml'},client:{platform:'web'}}}
const json=(x,status=200,headers={})=>new Response(JSON.stringify(x),{status,headers})
const sha='a'.repeat(40)
function githubFixture({pkg=manifest,missing,rate=false}={}) {
  const urls=[]
  const http=new HTTP({fetchImpl:async(url,init)=>{
    urls.push([url,init.headers]);assert.ok(url.startsWith('https://api.github.com/'))
    if(rate)return json({},429,{'retry-after':'60'})
    if(url.includes('/search/'))return json({total_count:1,items:[{full_name:'alice/demo',description:'A description',default_branch:'main',stargazers_count:2}]})
    if(url.endsWith('/repos/alice/demo'))return json({full_name:'alice/demo',default_branch:'main'})
    if(url.includes('/commits/'))return json({sha})
    const path=decodeURIComponent(url.split('/contents/')[1]?.split('?')[0]??'')
    assert.ok(url.includes(`ref=${sha}`),'all files must use the pinned commit')
    if(path===missing)return json({},404)
    return json({type:'file',encoding:'base64',size:20,content:Buffer.from(path==='package.json'?JSON.stringify(pkg):'// built artifact').toString('base64')})
  }})
  return {source:new GithubSource({http,token:'explicit-token'}),urls}
}
test('npm verifies candidates and falls back from unreachable source',async()=>{
  const http=new HTTP({fetchImpl:async url=>{
    if(url.startsWith('https://dead.example'))throw new Error('unreachable')
    return json(url.includes('/-/v1/search')?{objects:[{package:{name:'dsh-demo'}}],total:1}:manifest)
  }})
  const npm=new NpmSource({http,registries:async()=>['https://dead.example','https://registry.npmjs.org']})
  const r=await npm.search('demo',1)
  assert.equal(r.rows[0].validation,'bundle');assert.equal(r.rows[0].version,'1.0.0');assert.equal(r.rows[0].description,'Small useful plugin')
})
test('npm refuses incorrect manifest identity or floating version',async()=>{
  for(const pkg of [{...manifest,name:'wrong'},{...manifest,version:'latest'}]){
    const npm=new NpmSource({http:new HTTP({fetchImpl:async()=>json(pkg)})})
    await assert.rejects(npm.detail('dsh-demo'),/invalid-manifest/)
  }
})
test('npm client-only candidate is displayed with no bundle qualification',async()=>{
  const npm=new NpmSource({http:new HTTP({fetchImpl:async()=>json({...manifest,dsh:{client:{platform:'web'}}})})})
  assert.equal((await npm.detail('dsh-demo')).validation,'client-only')
})
test('GitHub search returns unverified candidates, exact repo inputs bypass topics',async()=>{
  const {source,urls}=githubFixture()
  assert.equal(repoKey('https://github.com/alice/demo/'),'alice/demo')
  assert.equal(repoKey('https://github.com/alice/demo/tree/main'),null)
  assert.equal(repoKey('https://evil.example/alice/demo'),null)
  const found=await source.search('demo',1)
  assert.equal(found.rows[0].validation,'unverified')
  assert.equal(urls.length,1)
  const exact=await source.search('alice/demo',1)
  assert.equal(exact.rows[0].repo,'alice/demo')
  assert.ok(!urls.slice(1).some(([u])=>u.includes('/search/')))
})
test('GitHub checks artifacts on a fixed SHA and returns corresponding documentation',async()=>{
  const {source}=githubFixture()
  const row=await source.detail('alice/demo')
  assert.equal(row.validation,'bundle');assert.equal(row.spec,`github:alice/demo#${sha}`)
  assert.equal(row.links.readme,`https://github.com/alice/demo/tree/${sha}`)
})
test('GitHub missing compiled client blocks install qualification',async()=>{
  const {source}=githubFixture({missing:'lib/client.js'})
  const row=await source.detail('alice/demo')
  assert.equal(row.validation,'missing-artifacts');assert.equal(row.spec,null)
})
test('GitHub refuses unsafe/wildcard entry paths and unsupported monorepo root',async()=>{
  for(const pkg of [{...manifest,main:'../outside.js'},{...manifest,exports:{'./*':'./lib/*.js'}},{name:'root',workspaces:['packages/*']}]){
    const {source}=githubFixture({pkg});const row=await source.detail('alice/demo')
    assert.notEqual(row.validation,'bundle');assert.equal(row.spec,null)
  }
})
test('GitHub rate-limit blocks repeated requests and never leaks its token',async()=>{
  const {source,urls}=githubFixture({rate:true})
  await assert.rejects(source.search('demo'),e=>e.code==='rate-limited' && e.extra.retryAt>Date.now())
  await assert.rejects(source.search('other'),/rate-limited/)
  assert.equal(urls.length,1)
  assert.equal(urls[0][1].authorization,'Bearer explicit-token')
})
test('GitHub request budget marks large export maps unverified',async()=>{
  const pkg={...manifest,exports:Object.fromEntries(Array.from({length:20},(_,i)=>[`./x${i}`,`./lib/x${i}.js`]))}
  const {source,urls}=githubFixture({pkg});const row=await source.detail('alice/demo')
  assert.equal(row.validation,'unverified');assert.ok(urls.length<=12)
})
