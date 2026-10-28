import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { EventEmitter } from 'node:events'
import { createRoute } from '../lib/host/route.js'
import { apply } from '../lib/index.js'
const market={health:()=>({ok:true}),search:async q=>({ok:true,q}),installed:async()=>({ok:true,rows:[]}),updates:async()=>({ok:true,rows:[]}),detail:async()=>({name:'demo'}),inspect:async()=>({previewId:'id'}),execute:async()=>({ok:false,application:'failed'}),operation:args=>({ok:true,args,operation:null}),cancel:async body=>({ok:true,status:'cancelled',operationId:body.operationId})}
Object.assign(market,{listBackups:async()=>({ok:true,backups:[]}),createBackup:async()=>({ok:true,backup:{id:'created'}}),exportBackup:async id=>({ok:true,backup:{id}}),previewBackup:async options=>({ok:true,diff:{readOnly:true,options}})})
function invoke({path='/health',method='GET',headers={'x-dsh-lumen-market':'1'},remote='127.0.0.1',body}={}){
  const req=new EventEmitter();req.url='/api/lumen-market'+path;req.method=method;req.headers=headers;req.socket={remoteAddress:remote}
  const res={headers:{},statusCode:200,setHeader(k,v){this.headers[k]=v},end(s){this.body=JSON.parse(s)}}
  const p=createRoute(market)(req,res)
  if(body!==undefined)queueMicrotask(()=>{req.emit('data',Buffer.from(body));req.emit('end')})
  return p.then(()=>res)
}
test('all requests require header and writes require loopback',async()=>{
  assert.equal((await invoke({headers:{}})).statusCode,403)
  assert.equal((await invoke({path:'/install',method:'POST',remote:'192.0.2.2',body:'{}'})).statusCode,403)
  assert.equal((await invoke({method:'OPTIONS'})).statusCode,405)
})

test('backup routes are loopback-only, same-origin and reject extra write arguments',async()=>{
  assert.equal((await invoke({path:'/backups'})).statusCode,200)
  assert.equal((await invoke({path:'/backups',remote:'192.0.2.1'})).statusCode,403)
  assert.equal((await invoke({path:'/backup',method:'POST',body:'{}'})).body.backup.id,'created')
  assert.equal((await invoke({path:'/backup',method:'POST',body:'{"path":"outside"}'})).statusCode,400)
  assert.equal((await invoke({path:'/backup',method:'POST',body:'{}',headers:{'x-dsh-lumen-market':'1',host:'localhost',origin:'https://evil.invalid'}})).statusCode,403)
  assert.equal((await invoke({path:'/backup-preview',method:'POST',body:'{"backupId":"id"}'})).body.diff.readOnly,true)
})

test('weekly stars sorting reaches the search API with an empty keyword',async()=>{
  const result=await invoke({path:'/search?source=github&sort=weekly-stars&q='})
  assert.equal(result.statusCode,200)
  assert.equal(result.body.q.sort,'weekly-stars');assert.equal(result.body.q.q,'')
})
test('route rejects bad pagination/unknown methods/oversized or malformed bodies',async()=>{
  assert.equal((await invoke({path:'/search?page=abc'})).statusCode,400)
  assert.equal((await invoke({path:'/inspect',method:'POST',body:'{'})).statusCode,400)
  assert.equal((await invoke({path:'/inspect',method:'POST',body:JSON.stringify({data:'x'.repeat(32768)})})).statusCode,413)
  assert.equal((await invoke({path:'/install',method:'GET'})).statusCode,405)
  assert.equal((await invoke({path:'/unrecognized'})).statusCode,404)
})
test('internal error body never exposes upstream messages',async()=>{
  const broken={...market,health(){throw new Error('secret credential')}}
  const req={url:'/api/lumen-market/health',method:'GET',headers:{'x-dsh-lumen-market':'1'},socket:{}}
  const res={setHeader(){},end(s){this.body=s}}
  await createRoute(broken)(req,res);assert.equal(res.statusCode,500);assert.equal(res.body,'{"ok":false,"code":"internal"}')
})

test('search route propagates explicit force refresh to the host',async()=>{
  const r=await invoke({path:'/search?q=demo&force=1'})
  assert.equal(r.body.q.force,true)
})

test('search route forwards GitHub sorting and refuses invalid sort parameters',async()=>{
  const sorted=await invoke({path:'/search?source=github&sort=stars'})
  assert.equal(sorted.body.q.sort,'stars')
  assert.equal((await invoke({path:'/search?source=github&sort=arbitrary'})).statusCode,400)
})

test('search route accepts new orders and uses default ordering when omitted',async()=>{
  assert.equal((await invoke({path:'/search'})).body.q.sort,'default')
  for(const sort of ['default','updated','forks']){
    const result=await invoke({path:`/search?source=github&sort=${sort}`})
    assert.equal(result.statusCode,200);assert.equal(result.body.q.sort,sort)
  }
})

test('cache-only route keeps query isolation and does not request live source results',async()=>{
  const cached=await invoke({path:'/search-cache?q=market&source=github&page=2&sort=stars'})
  assert.equal(cached.statusCode,200);assert.equal(cached.body.q.cachedOnly,true)
  assert.equal(cached.body.q.page,2);assert.equal(cached.body.q.sort,'stars')
})

test('uninstall route accepts only preview IDs and remains loopback protected',async()=>{
  const response=await invoke({path:'/uninstall',method:'POST',body:'{"previewId":"id"}'})
  assert.equal(response.statusCode,200)
  assert.equal((await invoke({path:'/uninstall',method:'POST',remote:'192.0.2.2',body:'{"previewId":"id"}'})).statusCode,403)
  assert.equal((await invoke({path:'/uninstall',method:'GET'})).statusCode,405)
})

test('operation polling and cancel routes validate their bound identifiers and loopback',async()=>{
  const poll=await invoke({path:'/operation?previewId=preview-id'})
  assert.equal(poll.statusCode,200);assert.equal(poll.body.args.previewId,'preview-id')
  assert.equal((await invoke({path:'/cancel',method:'POST',body:'{"operationId":"operation-id"}'})).body.status,'cancelled')
  assert.equal((await invoke({path:'/cancel',method:'POST',remote:'192.0.2.2',body:'{"operationId":"operation-id"}'})).statusCode,403)
  assert.equal((await invoke({path:'/cancel',method:'POST',body:'{"operationId":"operation-id","spec":"evil"}'})).statusCode,400)
})
test('Cordis registers independent prefix route and disposes resources',()=>{
  let registered,cleanup,disposed=false
  const ctx={webServer:{register(r){registered=r;return()=>disposed=true}},get(){return null},effect(fn){cleanup=fn()}}
  apply(ctx);assert.equal(registered.path,'/api/lumen-market');assert.equal(registered.kind,'prefix');cleanup();assert.equal(disposed,true)
})
test('real HTTP request reaches search and failed application is preserved',async t=>{
  const server=createServer(createRoute(market));await new Promise(r=>server.listen(0,'127.0.0.1',r))
  t.after(()=>new Promise(r=>server.close(r)))
  const base=`http://127.0.0.1:${server.address().port}/api/lumen-market`,headers={'x-dsh-lumen-market':'1','content-type':'application/json'}
  const r=await fetch(base+'/search?q=demo&page=2',{headers});assert.equal(r.status,200);assert.equal((await r.json()).q.page,2)
  const failed=await fetch(base+'/install',{method:'POST',headers,body:'{"previewId":"id"}'})
  assert.equal((await failed.json()).application,'failed')
})
