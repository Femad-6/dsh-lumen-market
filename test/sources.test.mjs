import { test } from 'node:test'
import assert from 'node:assert/strict'
import { NpmSource } from '../lib/host/npm.js'
import { GithubSource, repoKey } from '../lib/host/github.js'
import { HTTP } from '../lib/host/http.js'
import {MarketError} from '../lib/host/core.js'
const manifest={name:'dsh-demo',version:'1.0.0',description:'Small useful plugin',engines:{dsh:'>=0.2.0 <0.3.0'},main:'lib/index.js',exports:{'.':'./lib/index.js','./client':'./lib/client.js'},dsh:{bundle:{patch:'./cordis.patch.yml'},client:{platform:'web'}}}
const json=(x,status=200,headers={})=>new Response(JSON.stringify(x),{status,headers})
const sha='a'.repeat(40)

test('empty star search requests the most-starred topic plugins without a keyword',async()=>{
  let requested
  const source=new GithubSource({http:{json:async url=>{requested=new URL(url);return {items:[{full_name:'alice/top',stargazers_count:9000}],total_count:1}}}})
  const result=await source.search('   ',1,{sort:'stars'})
  assert.equal(requested.searchParams.get('q'),'topic:dsh-plugin')
  assert.equal(requested.searchParams.get('sort'),'stars');assert.equal(requested.searchParams.get('order'),'desc')
  assert.equal(result.rows[0].stars,9000)
})

const historyWeek=Date.UTC(2026,9,18)/1000
const weeklyNow=Date.UTC(2026,9,20,12)
const history=(days,prior=[0,0,0,0,0,0,0])=>[
  {week:historyWeek,total:days.reduce((a,b)=>a+b,0),days},
  {week:historyWeek-604800,total:prior.reduce((a,b)=>a+b,0),days:prior}
]

test('weekly star ranking measures at most 50 candidates, sorts growth and shares one ranking across pages',async()=>{
  const calls=[]
  const source=new GithubSource({now:()=>weeklyNow,http:{json:async(url,options)=>{
    calls.push(url)
    if(url.includes('/search/')){
      const params=new URL(url).searchParams
      assert.equal(params.get('per_page'),'50');assert.equal(params.get('sort'),'stars')
      return {total_count:120,items:Array.from({length:55},(_,i)=>({full_name:`alice/plugin-${i}`,stargazers_count:1000-i}))}
    }
    assert.equal(options.headers['x-github-api-version'],'2026-03-10')
    assert.ok(url.includes('/stargazers/history?per_page=2'))
    const index=Number(url.match(/plugin-(\d+)/)[1])
    return history([index,0,999,0,0,0,0])
  }}})
  const first=await source.search('',1,{sort:'weekly-stars'}),second=await source.search('',2,{sort:'weekly-stars'}),third=await source.search('',3,{sort:'weekly-stars'})
  assert.equal(calls.length,51)
  assert.equal(first.rows[0].repo,'alice/plugin-49');assert.equal(first.rows[0].weeklyStars,49)
  assert.equal(first.weekly.candidateLimit,50);assert.equal(first.weekly.candidates,50);assert.equal(first.weekly.measured,50)
  assert.equal(first.weekly.totalMatches,120)
  assert.equal(second.rows[0].weeklyStars,28);assert.equal(third.rows.length,8);assert.equal(third.hasMore,false)
  assert.equal(new Set([...first.rows,...second.rows,...third.rows].map(row=>row.repo)).size,50)
})

test('weekly star history sums seven complete GitHub days across the week boundary, excluding today and older days',async()=>{
  const source=new GithubSource({now:()=>weeklyNow,http:{json:async url=>url.includes('/search/')?{total_count:1,items:[{full_name:'alice/demo',stargazers_count:100}]}:history([2,3,900,0,0,0,0],[700,800,1,1,1,1,1])}})
  const result=await source.search('',1,{sort:'weekly-stars'})
  assert.equal(result.rows[0].weeklyStars,10)
})

test('weekly ranking keeps failed measurements unknown and stops further network requests after rate limiting',async()=>{
  let requests=0
  const source=new GithubSource({now:()=>weeklyNow,http:{json:async url=>{
    requests++
    if(url.includes('/search/'))return {total_count:8,items:Array.from({length:8},(_,i)=>({full_name:`alice/p${i}`,stargazers_count:100-i}))}
    if(url.includes('/p0/'))return history([0,0,0,0,0,0,0])
    throw new MarketError('rate-limited',502,{retryAt:weeklyNow+60000})
  }}})
  const result=await source.search('',1,{sort:'weekly-stars'})
  assert.ok(requests<=4)
  assert.equal(result.rows[0].weeklyStars,0)
  assert.equal(result.rows[1].weeklyStars,null)
  assert.equal(result.weekly.measured,1);assert.equal(result.weekly.failed,7)
})

test('weekly ranking rejects missing or malformed history instead of inventing zero and propagates total failures',async()=>{
  for(const invalid of [[],{},[{week:historyWeek,total:7,days:[7]}],history([1,-1,0,0,0,0,0])]){
    const source=new GithubSource({now:()=>weeklyNow,http:{json:async url=>url.includes('/search/')?{total_count:1,items:[{full_name:'alice/demo',stargazers_count:100}]}:invalid}})
    await assert.rejects(source.search('',1,{sort:'weekly-stars'}),e=>e.code==='invalid-star-history')
  }
})
function githubFixture({pkg=manifest,missing,rate=false,tree,largeClient=false}={}) {
  const urls=[]
  const http=new HTTP({fetchImpl:async(url,init)=>{
    urls.push([url,init.headers]);assert.ok(url.startsWith('https://api.github.com/'))
    if(rate)return json({},429,{'retry-after':'60'})
    if(url.includes('/search/'))return json({total_count:1,items:[{full_name:'alice/demo',description:'A description',default_branch:'main',stargazers_count:2}]})
    if(url.endsWith('/repos/alice/demo'))return json({full_name:'alice/demo',default_branch:'main',stargazers_count:2})
    if(url.includes('/commits/'))return json({sha})
    if(url.includes('/git/trees/')){assert.ok(url.includes(`/git/trees/${sha}?recursive=1`));return json(tree?{...tree,tree:Array.isArray(tree.tree)?tree.tree.filter(entry=>entry.path!==missing):tree.tree}:{tree:[],truncated:false})}
    const path=decodeURIComponent(url.split('/contents/')[1]?.split('?')[0]??'')
    assert.ok(url.includes(`ref=${sha}`),'all files must use the pinned commit')
    if(path===missing)return json({},404)
    if(largeClient && path==='lib/client.js')return json({type:'file',encoding:'base64',content:'x'.repeat(600000)})
    return json({type:'file',encoding:'base64',size:20,content:Buffer.from(path==='package.json'?JSON.stringify(pkg):'// built artifact').toString('base64')})
  }})
  return {source:new GithubSource({http,token:'explicit-token'}),urls}
}
test('npm verifies candidates and falls back from unreachable source',async()=>{
  const http=new HTTP({fetchImpl:async url=>{
    if(url.startsWith('https://dead.example'))throw new Error('unreachable')
    if(url.endsWith('/demo/latest'))return json({},404)
    return json(url.includes('/-/v1/search')?{objects:[{package:{name:'dsh-demo'}}],total:1}:manifest)
  }})
  const npm=new NpmSource({http,registries:async()=>['https://dead.example','https://registry.npmjs.org']})
  const r=await npm.search('demo',1)
  assert.equal(r.rows[0].validation,'bundle');assert.equal(r.rows[0].version,'1.0.0');assert.equal(r.rows[0].description,'Small useful plugin')
})

test('npm shares registry configuration across a cold page and reloads it after clear',async()=>{
  let registryCalls=0
  const npm=new NpmSource({registries:async()=>{registryCalls++;return ['https://mock.invalid']},http:{json:async url=>{
    if(url.includes('/-/v1/search'))return {total:20,objects:Array.from({length:20},(_,i)=>({package:{name:`dsh-item-${i}`}}))}
    return {...manifest,name:decodeURIComponent(new URL(url).pathname.split('/')[1])}
  }}})
  const found=await npm.search('plugin tools')
  assert.equal(found.rows.length,20)
  assert.equal(registryCalls,1)
  npm.clear();await npm.detail('dsh-fresh')
  assert.equal(registryCalls,2)
})

test('npm exact package lookup succeeds even when keyword search omits the package',async()=>{
  const npm=new NpmSource({http:{json:async url=>url.includes('/-/v1/search')?{objects:[],total:0}:manifest}})
  const found=await npm.search('dsh-demo')
  assert.equal(found.rows[0]?.name,'dsh-demo')
  assert.equal(found.coverage,'npm-exact-package')
  assert.equal(found.hasMore,false)
})

test('npm pagination counts matching candidates and skips non-plugin raw pages',async()=>{
  const raw=Array.from({length:42},(_,i)=>({package:{name:`dsh-result-${i}`}}))
  const npm=new NpmSource({http:{json:async url=>{
    const u=new URL(url)
    if(u.pathname==='/-/v1/search'){const from=Number(u.searchParams.get('from'));return {objects:raw.slice(from,from+20),total:42}}
    const name=decodeURIComponent(u.pathname.split('/')[1]),index=Number(name.split('-').at(-1))
    return {name,version:'1.0.0',...(index>=20?{dsh:manifest.dsh}:{})}
  }}})
  const first=await npm.search('plugin tools',1),second=await npm.search('plugin tools',2)
  assert.equal(first.rows.length,21)
  assert.equal(first.hasMore,true)
  assert.deepEqual(second.rows.map(r=>r.name),['dsh-result-41'])
  assert.equal(second.hasMore,false)
})

test('npm bounded empty scans report uncertainty without a misleading next page',async()=>{
  let searches=0
  const npm=new NpmSource({http:{json:async url=>{
    const u=new URL(url)
    if(u.pathname==='/-/v1/search'){searches++;const from=Number(u.searchParams.get('from'));return {objects:Array.from({length:20},(_,i)=>({package:{name:`ordinary-${from+i}`}})),total:1000}}
    return {name:decodeURIComponent(u.pathname.split('/')[1]),version:'1.0.0'}
  }}})
  const found=await npm.search('ordinary tools')
  assert.deepEqual(found.rows,[])
  assert.equal(found.hasMore,false)
  assert.equal(found.scanLimited,true)
  assert.equal(searches,3)
})

test('contradictory empty and short npm pages never establish an exact total',async()=>{
  for(const objects of [[],[{package:{name:'dsh-demo'}}]]){
    const npm=new NpmSource({http:{json:async url=>url.includes('/-/v1/search')?{objects,total:100}:manifest}})
    const found=await npm.search('plugin tools')
    assert.equal(found.rows.length,objects.length)
    assert.equal(found.totalExact,false);assert.equal(found.incomplete,true);assert.equal(found.hasMore,false)
  }
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

test('GitHub star sorting reaches the API and has separate caches across orders and pages',async()=>{
  const urls=[]
  const source=new GithubSource({http:{json:async url=>{
    const u=new URL(url);urls.push(u)
    const popular={full_name:'bob/popular',stargazers_count:400},recent={full_name:'alice/recent',stargazers_count:3}
    return {total_count:40,items:u.searchParams.get('sort')==='stars'?[popular,recent]:[recent,popular]}
  }}})
  const recent=await source.search('market',1),stars=await source.search('market',1,{sort:'stars'})
  assert.equal(recent.rows[0].repo,'alice/recent');assert.equal(stars.rows[0].repo,'bob/popular')
  assert.deepEqual(stars.rows.map(row=>row.stars),[400,3])
  await source.search('market',1,{sort:'stars'});assert.equal(urls.length,2)
  await source.search('market',2,{sort:'stars'})
  assert.equal(urls.at(-1).searchParams.get('sort'),'stars');assert.equal(urls.at(-1).searchParams.get('order'),'desc')
  assert.equal(urls.at(-1).searchParams.get('per_page'),'21')
  assert.equal(urls.at(-1).searchParams.get('page'),'2');assert.equal(stars.sort,'stars')
})

test('GitHub detail retains its observed star count after manifest verification',async()=>{
  const {source}=githubFixture()
  assert.equal((await source.detail('alice/demo')).stars,2)
})

test('GitHub rejects unsupported sort values before requesting the API',async()=>{
  const {source}=githubFixture()
  await assert.rejects(source.search('market',1,{sort:'arbitrary'}),/invalid-sort/)
})

test('GitHub default uses best match while recent and forks use distinct API orders and caches',async()=>{
  const urls=[]
  const source=new GithubSource({http:{json:async url=>{urls.push(new URL(url));return {total_count:0,items:[]}}}})
  for(const sort of ['default','updated','forks'])await source.search('market',1,{sort})
  assert.deepEqual(urls.map(url=>url.searchParams.get('sort')),[null,'updated','forks'])
  await source.search('market',1,{sort:'forks'});assert.equal(urls.length,3)
  await source.search('market',2,{sort:'forks'});assert.equal(urls.at(-1).searchParams.get('page'),'2')
})

test('missing or malformed GitHub stars are unknown rather than fabricated zeroes',()=>{
  const source=new GithubSource()
  for(const count of [undefined,-1,2.5,'42'])assert.equal(source.candidate({full_name:'alice/demo',stargazers_count:count}).stars,null)
  assert.equal(source.candidate({full_name:'alice/demo',stargazers_count:0}).stars,0)
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

const patternManifest={...manifest,exports:{...manifest.exports,'./package.json':'./package.json','./locale/*.json':'./locale/*.json'}}
const localeTree={truncated:false,tree:[...['lib/index.js','lib/client.js','package.json','cordis.patch.yml'].map(path=>({path,type:'blob',mode:'100644'})),{path:'locale/zh-CN.json',type:'blob',mode:'100644'},{path:'locale/en-US.json',type:'blob',mode:'100644'}]}

test('GitHub qualifies wildcard exports against files at the pinned commit',async()=>{
  const {source,urls}=githubFixture({pkg:patternManifest,tree:localeTree})
  const row=await source.detail('alice/demo')
  assert.equal(row.validation,'bundle');assert.equal(row.spec,`github:alice/demo#${sha}`)
  assert.equal(urls.filter(([url])=>url.includes('/git/trees/')).length,1)
  assert.ok(!urls.some(([url])=>url.includes('/contents/locale/')))
})

test('GitHub supports nested wildcard targets and shares one tree across patterns',async()=>{
  const pkg={...patternManifest,exports:{...patternManifest.exports,'./feature/*':'./features/*/index.js'}}
  const tree={...localeTree,tree:[...localeTree.tree,{path:'features/tools/nested/index.js',type:'blob',mode:'100644'}]}
  const {source,urls}=githubFixture({pkg,tree})
  assert.equal((await source.detail('alice/demo')).validation,'bundle')
  assert.equal(urls.filter(([url])=>url.includes('/git/trees/')).length,1)
  assert.ok(urls.length<=12)
})

test('GitHub rejects wildcard exports without matching regular files',async()=>{
  for(const tree of [{tree:[],truncated:false},{tree:[{path:'locale/zh-CN.json.bak',type:'blob',mode:'100644'}]},{tree:[{path:'locale/zh-CN.json',type:'tree',mode:'040000'}]},{tree:[{path:'locale/zh-CN.json',type:'blob',mode:'120000'}]}]){
    const {source}=githubFixture({pkg:patternManifest,tree})
    const row=await source.detail('alice/demo')
    assert.equal(row.validation,'missing-artifacts');assert.equal(row.spec,null)
  }
})

test('GitHub refuses incomplete or malformed wildcard tree responses',async()=>{
  for(const tree of [{...localeTree,truncated:true},{tree:null},{}]){
    const {source}=githubFixture({pkg:patternManifest,tree})
    const row=await source.detail('alice/demo')
    assert.equal(row.validation,'unverified');assert.equal(row.spec,null)
  }
})

test('GitHub wildcard support preserves required file and path safety checks',async()=>{
  for(const missing of ['lib/index.js','lib/client.js','cordis.patch.yml']){
    const {source}=githubFixture({pkg:patternManifest,tree:localeTree,missing})
    const row=await source.detail('alice/demo')
    assert.equal(row.validation,'missing-artifacts');assert.equal(row.spec,null)
  }
  for(const target of ['../locale/*.json','./locale/../*.json','/locale/*.json','./locale/?.json','./locale/*.json#fragment']){
    const pkg={...manifest,exports:{...manifest.exports,'./locale/*':target}}
    const {source}=githubFixture({pkg,tree:localeTree})
    const row=await source.detail('alice/demo')
    assert.equal(row.validation,'unverified');assert.equal(row.spec,null)
  }
})


test('GitHub verifies wildcard exports in a repository tree larger than a single file response',async()=>{
  const tree={truncated:false,tree:[...Array.from({length:8000},(_,i)=>({path:`vendor/channel-${i}/source/index.js`,type:'blob',mode:'100644',sha:'b'.repeat(40)})),...localeTree.tree]}
  const {source}=githubFixture({pkg:patternManifest,tree})
  const row=await source.detail('alice/demo')
  assert.equal(row.validation,'bundle');assert.equal(row.spec,`github:alice/demo#${sha}`)
})


test('GitHub uses tree metadata to qualify large client bundles without downloading their contents',async()=>{
  const {source}=githubFixture({pkg:patternManifest,tree:localeTree,largeClient:true})
  const row=await source.detail('alice/demo')
  assert.equal(row.validation,'bundle');assert.equal(row.spec,`github:alice/demo#${sha}`)
})


test('GitHub repeats the same subpath replacement for every star in an export target',async()=>{
  const pkg={...manifest,exports:{...manifest.exports,'./feature/*':'./features/*/copy-*.js'}}
  for(const [path,validation] of [['features/tools/copy-tools.js','bundle'],['features/tools/copy-other.js','missing-artifacts']]){
    const tree={...localeTree,tree:[...localeTree.tree,{path,type:'blob',mode:'100644'}]}
    const {source}=githubFixture({pkg,tree})
    assert.equal((await source.detail('alice/demo')).validation,validation)
  }
})


test('GitHub bounds matching work for adversarial repeated-star export patterns',async()=>{
  const pkg={...manifest,exports:{...manifest.exports,'./locale/*':'./locale/'+'a*'.repeat(12)+'z.json'}}
  const tree={...localeTree,tree:[...localeTree.tree,{path:'locale/'+'a'.repeat(32)+'y.json',type:'blob',mode:'100644'}]}
  const {source}=githubFixture({pkg,tree})
  const row=await source.detail('alice/demo')
  assert.equal(row.validation,'missing-artifacts');assert.equal(row.spec,null)
})
