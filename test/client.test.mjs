import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { JSDOM } from 'jsdom'

function client(fetchImpl){
  let definition;const window={fetch:fetchImpl,__ModuleLoader__:{load:d=>definition=d}}
  vm.runInNewContext(readFileSync(new URL('../lib/client.js',import.meta.url),'utf8'),{window,AbortController,URL,URLSearchParams,setTimeout,clearTimeout,console})
  assert.equal(definition.id,'dsh-lumen-market')
  return definition.factory(name=>{assert.equal(name,'react');return React})
}
const row={id:'npm:demo',name:'demo',source:'npm',description:'A useful plugin <img src=x onerror=alert(1)>',descriptionSource:'package.json',version:'1.0.0',validation:'bundle',compatibility:{verdict:'compatible'},links:{readme:'https://github.com/alice/demo',npm:'https://www.npmjs.com/package/demo'},installable:true}
const response=data=>Promise.resolve(new Response(JSON.stringify(data)))

test('store ignores out-of-order search responses and sends CSRF header',async()=>{
  const resolvers=[]
  const module=client((url,init)=>{assert.equal(init.headers['x-dsh-lumen-market'],'1');return new Promise(r=>resolvers.push(r))})
  const store=module.createStore();const first=store.search('old','npm'),second=store.search('new','github')
  resolvers[1](new Response(JSON.stringify({rows:[{...row,name:'new'}],errors:[]})));await second
  resolvers[0](new Response(JSON.stringify({rows:[{...row,name:'old'}],errors:[]})));await first
  assert.equal(store.get().data.rows[0].name,'new');store.dispose()
})
test('real React page shows descriptions, safe document links and requires preview before install',async t=>{
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'})
  const old={window:globalThis.window,document:globalThis.document,act:globalThis.IS_REACT_ACT_ENVIRONMENT}
  globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true
  let installs=0;const posts=[]
  const module=client((url,init)=>{
    if(init.method==='POST'){posts.push([url,JSON.parse(init.body)]);if(url.endsWith('/install')){installs++;return response({ok:true,application:'applied',changed:true,pendingRestart:[]})}return response({previewId:'server-id',expiresAt:Date.now()+600000,preview:{...row,spec:'demo@1.0.0',action:'install'}})}
    if(url.includes('/detail'))return response(row)
    if(url.includes('/installed'))return response({rows:[{id:'installed:local',name:'local',source:'local',description:'Local work',links:{}}],pendingRestart:[]})
    if(url.includes('/updates'))return response({rows:[{name:'demo-failed',source:'registry',verdict:'lookup-failed',error:{code:'network'}}],errors:[{source:'npm',name:'demo-failed',code:'network',diagnostic:'demo-failed'}],pendingRestart:[]})
    return response({rows:[row],errors:[],pendingRestart:[],hasMore:false})
  })
  let dictionary,page
  const ctx={effect(fn){fn()},locale:{register(ns,dict){dictionary=dict;return()=>{}},bind(){return key=>dictionary.zh[key]??key}},slots:{inject(owner,fn){fn()},register(info,component){if(info.name==='main')page=component;return()=>{}}}}
  module.apply(ctx);assert.deepEqual(Object.keys(dictionary.zh).sort(),Object.keys(dictionary.en).sort())
  const root=createRoot(dom.window.document.getElementById('root'))
  t.after(async()=>{await act(async()=>root.unmount());dom.window.close();globalThis.window=old.window;globalThis.document=old.document;globalThis.IS_REACT_ACT_ENVIRONMENT=old.act})
  await act(async()=>root.render(React.createElement(page)))
  const doc=dom.window.document
  assert.ok(doc.body.textContent.includes('流明市场'));assert.ok(doc.body.textContent.includes('A useful plugin'))
  assert.equal(doc.querySelector('img'),null);assert.ok(doc.body.textContent.includes('<img src=x onerror=alert(1)>'))
  const link=doc.querySelector('a[href="https://github.com/alice/demo"]');assert.ok(link);assert.equal(link.rel,'noopener noreferrer');assert.equal(link.target,'_blank')
  const click=async text=>{const b=[...doc.querySelectorAll('button')].find(b=>b.textContent===text);assert.ok(b,`missing button ${text}`);await act(async()=>b.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})))}
  await click('查看详情');await click('安装预览');assert.equal(installs,0)
  assert.ok(doc.body.textContent.includes('demo@1.0.0'))
  await click('确认安装');assert.equal(installs,1);assert.equal(posts.at(-1)[1].previewId,'server-id');assert.deepEqual(Object.keys(posts.at(-1)[1]),['previewId'])
  await click('已安装');assert.ok(doc.body.textContent.includes('Local work'))
  assert.equal([...doc.querySelectorAll('button')].filter(b=>b.textContent==='升级预览').length,0)
  await click('可更新');assert.ok(doc.body.textContent.includes('demo-failed'));assert.ok(doc.body.textContent.includes('network'))
})
test('store ignores stale detail responses when user opens another plugin',async()=>{
  const pending=[];const module=client(()=>new Promise(r=>pending.push(r)))
  const store=module.createStore(),first=store.open({...row,name:'old'}),second=store.open({...row,name:'new'})
  pending[1](new Response(JSON.stringify({...row,name:'new'})));await second
  pending[0](new Response(JSON.stringify({...row,name:'old'})));await first
  assert.equal(store.get().detail.name,'new');store.dispose()
})
test('client suppresses malicious link metadata and safely renders description text',async()=>{
  const module=client(()=>response({rows:[],errors:[]}))
  assert.equal(module.safeLink('javascript:alert(1)'),null)
  assert.equal(module.safeLink('https://a:b@example.com'),null)
  assert.equal(module.safeLink('https://example.com/docs'),'https://example.com/docs')
})
