import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,readFileSync,writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {SearchSnapshots} from '../lib/host/snapshots.js'
import {Market} from '../lib/host/market.js'

test('successful query snapshots survive recreation and stay isolated by profile and key',()=>{
  const dir=mkdtempSync(join(tmpdir(),'lumen-snapshots-'))
  const key=JSON.stringify(['github','market',1,'stars'])
  const snapshots=new SearchSnapshots({disk:true,now:()=>123})
  assert.equal(snapshots.save(dir,key,{rows:[{name:'alice/demo',source:'github'}],total:1,token:'secret'}),true)
  const restored=new SearchSnapshots({disk:true})
  assert.equal(restored.get(dir,key).found.rows[0].name,'alice/demo')
  assert.equal(restored.get(dir,key).checkedAt,123)
  assert.equal(restored.get(dir,JSON.stringify(['github','market',2,'stars'])),null)
  assert.equal(restored.get(join(dir,'other-profile'),key),null)
  assert.equal(readFileSync(join(dir,'.lumen-market','search-cache.json'),'utf8').includes('secret'),false)
  writeFileSync(join(dir,'.lumen-market','search-cache.json'),'{broken json')
  assert.equal(new SearchSnapshots({disk:true}).get(dir,key),null)
})

test('snapshot storage bounds entries and replaces an old success with an empty success',()=>{
  const snapshots=new SearchSnapshots({max:2})
  for(const key of ['a','b','c'])snapshots.save('profile',key,{rows:[{name:key}]})
  assert.equal(snapshots.get('profile','a'),null)
  snapshots.save('profile','c',{rows:[]})
  assert.deepEqual(snapshots.get('profile','c').found.rows,[])
})

test('recreated market serves disk results before remote access and retains them during rate limits',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'lumen-market-restart-'))
  const profile={snapshot:async()=>({profile:{dir},rows:[],runtimeVersion:'0.2.0'})}
  let requests=0,fail=false
  const github={clear(){},search:async()=>{requests++;if(fail)throw Object.assign(new Error('rate-limited'),{code:'rate-limited'});return {rows:[{name:'alice/demo',repo:'alice/demo',source:'github'}],total:1}}}
  let market=new Market({profile,github,snapshots:new SearchSnapshots({disk:true})})
  await market.search({source:'github',sort:'stars'})
  fail=true;market=new Market({profile,github,snapshots:new SearchSnapshots({disk:true})})
  assert.equal((await market.search({source:'github',sort:'stars',cachedOnly:true})).rows[0].name,'alice/demo')
  assert.equal(requests,1)
  const failed=await market.search({source:'github',sort:'stars'})
  assert.equal(failed.rows[0].name,'alice/demo');assert.equal(failed.stale,true)
})
