import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { EventEmitter } from 'node:events'
import { createRoute } from '../lib/host/route.js'
import { apply } from '../lib/index.js'
const market={health:()=>({ok:true}),search:async q=>({ok:true,q}),installed:async()=>({ok:true,rows:[]}),updates:async()=>({ok:true,rows:[]}),detail:async()=>({name:'demo'}),inspect:async()=>({previewId:'id'}),execute:async()=>({ok:false,application:'failed'})}
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
