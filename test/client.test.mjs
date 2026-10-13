import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { JSDOM } from 'jsdom'

function client(fetchImpl,{cachedFetch,localStorage}={}){
  let definition;const window={localStorage,fetch:(url,init)=>url.includes('/search-cache?')?(cachedFetch?cachedFetch(url,init):response({cacheHit:false,rows:[],errors:[]})):fetchImpl(url,init),__ModuleLoader__:{load:d=>definition=d}}
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
    if(url.includes('/updates'))return response({rows:[{id:'installed:local',name:'local',source:'local',description:'Local work',links:{}},{name:'demo-failed',source:'registry',verdict:'lookup-failed',error:{code:'network'}}],errors:[{source:'npm',name:'demo-failed',code:'network',diagnostic:'demo-failed'}],pendingRestart:[]})
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
  await click('查看详情');assert.equal([...doc.querySelectorAll('.lm-detail button')].some(button=>button.textContent==='卸载'),false)
  await click('安装预览');assert.equal(installs,0)
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

test('closing diagnostics ignores late responses and leaves operation results intact',async()=>{
  let finishHealth
  const store=client(url=>url.endsWith('/health')?new Promise(r=>finishHealth=r):response(url.endsWith('/inspect')?{previewId:'install-preview',preview:{...row,action:'install'}}:url.endsWith('/install')?{ok:true,application:'applied'}:{rows:[],errors:[]})).createStore()
  await store.prepare(row);await store.execute()
  const pending=store.health()
  assert.equal(store.get().healthOpen,true)
  store.closeHealth()
  finishHealth(new Response('{"ok":true,"managementAvailable":true}'));await pending
  assert.equal(store.get().healthOpen,false);assert.equal(store.get().health,null)
  assert.equal(store.get().result.application,'applied');store.dispose()
})

test('installed cards require uninstall confirmation, allow cancellation and disable protected rows',async t=>{
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'})
  const previous={window:globalThis.window,document:globalThis.document,act:globalThis.IS_REACT_ACT_ENVIRONMENT}
  globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true
  const scrolled=[];dom.window.HTMLElement.prototype.scrollIntoView=function(options){scrolled.push({element:this,options})}
  let removals=0,rows=[{...row,id:'installed:demo',source:'local',removable:true,installed:'1.0.0'},{id:'installed:base',name:'base',source:'shipped',removable:false}]
  const posts=[]
  const module=client((url,init)=>{
    if(url.endsWith('/inspect')){const body=JSON.parse(init.body);posts.push(body);return response({previewId:'remove-preview',preview:{...rows[0],action:'uninstall',fromVersion:'1.0.0'}})}
    if(url.endsWith('/uninstall')){removals++;assert.deepEqual(JSON.parse(init.body),{previewId:'remove-preview'});rows=rows.slice(1);return response({ok:true,action:'uninstall',application:'applied',warnings:['simulation removal warning'],packageResult:{kind:null,output:'simulation removal diagnostic'},pendingRestart:[]})}
    return response({rows:url.includes('/search')?[]:rows,errors:[]})
  })
  let Page,dictionary
  module.apply({effect(fn){fn()},locale:{register(ns,value){dictionary=value;return()=>{}},bind:()=>key=>dictionary.zh[key]??key},slots:{inject(owner,fn){fn()},register(info,component){if(info.name==='main')Page=component;return()=>{}}}})
  const root=createRoot(dom.window.document.getElementById('root'))
  t.after(async()=>{await act(async()=>root.unmount());dom.window.close();globalThis.window=previous.window;globalThis.document=previous.document;globalThis.IS_REACT_ACT_ENVIRONMENT=previous.act})
  await act(async()=>root.render(React.createElement(Page)))
  const doc=dom.window.document,click=async text=>{const button=[...doc.querySelectorAll('button')].find(b=>b.textContent===text);assert.ok(button,`missing button ${text}`);await act(async()=>button.click())}
  assert.equal([...doc.querySelectorAll('button')].some(b=>b.textContent==='卸载'),false)
  await click('已安装')
  const buttons=[...doc.querySelectorAll('button')].filter(b=>b.textContent==='卸载')
  assert.equal(buttons.length,2);assert.equal(buttons[0].disabled,false);assert.equal(buttons[1].disabled,true)
  await click('卸载');assert.equal(removals,0);assert.deepEqual(posts[0],{action:'uninstall',source:'installed',name:'demo'})
  assert.ok(doc.querySelector('.lm-preview').textContent.includes('demo'));assert.ok(doc.querySelector('.lm-preview').textContent.includes('本地链接'))
  assert.ok(scrolled.some(call=>call.element===doc.querySelector('.lm-preview')),'confirmation must be brought into view')
  assert.equal(doc.activeElement.className,'lm-preview')
  await click('取消');assert.equal(doc.querySelector('.lm-preview'),null);assert.equal(removals,0)
  await click('查看详情');assert.ok(doc.querySelector('.lm-detail'))
  const detailUninstall=[...doc.querySelectorAll('.lm-detail button')].find(button=>button.textContent==='卸载')
  assert.ok(detailUninstall,'installed detail provides uninstall')
  await act(async()=>detailUninstall.click());await click('确认卸载')
  assert.equal(removals,1);assert.equal(doc.querySelectorAll('.lm-card').length,1)
  assert.equal(!!doc.querySelector('.lm-detail'),false)
  assert.ok(doc.body.textContent.includes('已卸载'))
  assert.ok([...doc.querySelectorAll('summary')].some(summary=>summary.textContent==='卸载诊断'))
  await click('关闭提示')
  assert.equal(doc.body.textContent.includes('已卸载'),false)
  assert.equal(doc.body.textContent.includes('simulation removal warning'),false)
  assert.equal(doc.body.textContent.includes('simulation removal diagnostic'),false)
  assert.equal(doc.querySelectorAll('.lm-card').length,1);assert.equal(removals,1)
  await click('查看详情')
  const protectedUninstall=[...doc.querySelectorAll('.lm-detail button')].find(button=>button.textContent==='卸载')
  assert.ok(protectedUninstall);assert.equal(protectedUninstall.disabled,true)
  assert.deepEqual(Object.keys(dictionary.zh).sort(),Object.keys(dictionary.en).sort())
})

test('diagnostics panel can close and reopen without persisting a raw result banner',async t=>{
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'})
  const previous={window:globalThis.window,document:globalThis.document,act:globalThis.IS_REACT_ACT_ENVIRONMENT}
  globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true
  const module=client(url=>response(url.endsWith('/health')?{ok:true,managementAvailable:true,profile:{dir:'test-profile'}}:{rows:[],errors:[]}))
  let Page,dictionary
  module.apply({effect(fn){fn()},locale:{register(ns,value){dictionary=value;return()=>{}},bind:()=>key=>dictionary.zh[key]??key},slots:{inject(owner,fn){fn()},register(info,component){if(info.name==='main')Page=component;return()=>{}}}})
  const root=createRoot(dom.window.document.getElementById('root'))
  t.after(async()=>{await act(async()=>root.unmount());dom.window.close();globalThis.window=previous.window;globalThis.document=previous.document;globalThis.IS_REACT_ACT_ENVIRONMENT=previous.act})
  await act(async()=>root.render(React.createElement(Page)))
  const doc=dom.window.document,click=async text=>{const button=[...doc.querySelectorAll('button')].find(b=>b.textContent===text);assert.ok(button,`missing button ${text}`);await act(async()=>button.click())}
  await click('诊断')
  const panel=doc.querySelector('section[aria-label="诊断"]');assert.ok(panel);assert.ok(panel.textContent.includes('test-profile'))
  await click('关闭诊断');assert.equal(doc.querySelector('section[aria-label="诊断"]'),null)
  assert.equal(doc.body.textContent.includes('test-profile'),false)
  await click('诊断');assert.ok(doc.querySelector('section[aria-label="诊断"]'))
})

test('refresh requests fresh search and update data on every tab',async()=>{
  const urls=[];const module=client(url=>{urls.push(url);return response({rows:[],errors:[]})})
  const store=module.createStore()
  await store.load('discover',true)
  assert.equal(new URL(urls[0],'http://localhost').searchParams.get('force'),'1')
  await store.load('installed',true)
  await new Promise(r=>setImmediate(r))
  assert.ok(urls.some(url=>url.endsWith('/updates?force=1')))
  urls.length=0;await store.load('updates',true)
  assert.equal(urls[0],'/api/lumen-market/updates?force=1');store.dispose()
})

test('installed tab displays local rows while background update check is pending',async()=>{
  let finishUpdates
  const module=client(url=>url.includes('/updates')?new Promise(r=>finishUpdates=r):response({rows:[{id:'installed:demo',name:'demo',source:'registry',installed:'1.0.0'}],errors:[]}))
  const store=module.createStore();await store.load('installed')
  assert.equal(store.get().status,'ready');assert.equal(store.get().data.rows[0].installed,'1.0.0')
  assert.equal(store.get().updatesChecking,true)
  assert.equal(typeof finishUpdates,'function')
  finishUpdates(new Response(JSON.stringify({rows:[{id:'installed:demo',name:'demo',source:'registry',installed:'1.0.0',latest:'2.0.0',upgradeable:true}],errors:[]})))
  await new Promise(r=>setImmediate(r))
  assert.equal(store.get().data.rows[0].latest,'2.0.0');assert.equal(store.get().updatesChecking,false);store.dispose()
})

test('navigation ignores a late preview and releases its preparing state',async()=>{
  let finish
  const module=client(url=>url.endsWith('/inspect')?new Promise(r=>finish=r):response({rows:[],errors:[]}))
  const store=module.createStore(),pending=store.prepare(row)
  await store.selectTab('installed')
  finish(new Response(JSON.stringify({previewId:'old',preview:{...row,action:'install'}})));await pending
  assert.equal(store.get().preview,null);assert.equal(store.get().busy,false);store.dispose()
})

test('starting another search invalidates the earlier preview request',async()=>{
  let finish
  const store=client(url=>url.endsWith('/inspect')?new Promise(r=>finish=r):response({rows:[],errors:[]})).createStore()
  const pending=store.prepare(row);await store.search('different plugin')
  finish(new Response(JSON.stringify({previewId:'old',preview:{...row,action:'install'}})));await pending
  assert.equal(store.get().preview,null);assert.equal(store.get().busy,false);store.dispose()
})

test('late installed background results cannot replace a newer discover search',async()=>{
  let finishUpdates
  const store=client(url=>url.includes('/updates')?new Promise(r=>finishUpdates=r):response({rows:[{...row,name:url.includes('/search')?'new-result':'local-result'}],errors:[]})).createStore()
  await store.load('installed');await store.search('new-result')
  finishUpdates(new Response(JSON.stringify({rows:[{...row,name:'stale-result'}],errors:[]})))
  await new Promise(r=>setImmediate(r))
  assert.equal(store.get().data.rows[0].name,'new-result');store.dispose()
})

test('filters are restored per tab and discovery filters cannot empty installed data',async()=>{
  const store=client(()=>response({rows:[],errors:[]})).createStore()
  store.filter({onlyCompatible:true})
  await store.selectTab('installed')
  assert.equal(store.get().onlyCompatible,false)
  await store.selectTab('discover')
  assert.equal(store.get().onlyCompatible,true);store.dispose()
})

test('client monitors its preview operation and delegates cancellation without aborting the install result',async()=>{
  let release;const urls=[]
  const module=client((url,init)=>{
    urls.push([url,init.body])
    if(url.endsWith('/inspect'))return response({previewId:'bound-preview',preview:{...row,action:'install'}})
    if(url.endsWith('/install'))return new Promise(r=>release=r)
    if(url.includes('/operation'))return response({operation:{operationId:'bound-operation',phase:'installing',cancellable:true}})
    if(url.endsWith('/cancel')){release(new Response(JSON.stringify({ok:false,application:'cancelled',pendingRestart:[]})));return response({status:'cancelled'})}
    return response({rows:[],errors:[]})
  })
  const store=module.createStore();await store.prepare(row)
  assert.equal(typeof store.cancel,'function')
  const active=store.execute();await new Promise(r=>setImmediate(r))
  assert.equal(store.get().operation.phase,'installing')
  assert.ok(urls.some(([url])=>url.endsWith('/operation?previewId=bound-preview')))
  await store.cancel();await active
  assert.equal(JSON.parse(urls.find(([url])=>url.endsWith('/cancel'))[1]).operationId,'bound-operation')
  assert.equal(store.get().result.application,'cancelled');assert.equal(store.get().busy,false);store.dispose()
})

test('a completed installation refresh cannot stop the next installation monitor',async t=>{
  let finishFirstRefresh,finishSecondInstall,installs=0,inspections=0,refreshes=0
  const store=client((url,init)=>{
    if(url.endsWith('/inspect'))return response({previewId:'preview-'+(++inspections),preview:{...row,action:'install'}})
    if(url.endsWith('/install')){installs++;return installs===1?response({ok:true,application:'applied'}):new Promise(r=>finishSecondInstall=r)}
    if(url.includes('/operation'))return response({operation:{operationId:'operation-'+installs,phase:'installing',cancellable:true}})
    if(url.includes('/search')&&++refreshes===1)return new Promise(r=>finishFirstRefresh=r)
    return response({rows:[],errors:[]})
  }).createStore()
  t.after(()=>{store.dispose();finishFirstRefresh?.(new Response('{"rows":[]}'));finishSecondInstall?.(new Response('{"ok":true,"application":"applied"}'))})
  await store.prepare(row);const first=store.execute();await new Promise(r=>setImmediate(r))
  await store.prepare({...row,name:'second'});const second=store.execute();await new Promise(r=>setImmediate(r))
  assert.equal(store.get().operation.operationId,'operation-2')
  finishFirstRefresh(new Response('{"rows":[]}'));await first
  assert.equal(store.get().busy,true);assert.equal(store.get().executing,true)
  assert.equal(store.get().operation.operationId,'operation-2')
  finishSecondInstall(new Response('{"ok":true,"application":"applied"}'));await second
})

test('opening a different plugin resets the detail scroll position',async t=>{
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'})
  const previous={window:globalThis.window,document:globalThis.document,act:globalThis.IS_REACT_ACT_ENVIRONMENT}
  globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true
  const rows=[row,{...row,id:'npm:second',name:'second'}]
  const module=client(url=>response(url.includes('/detail')?rows.find(row=>row.name===new URL(url,'http://localhost').searchParams.get('name')):{rows,errors:[]}))
  let Page,dictionary
  module.apply({effect(fn){fn()},locale:{register(ns,value){dictionary=value;return()=>{}},bind:()=>key=>dictionary.zh[key]??key},slots:{inject(owner,fn){fn()},register(info,component){if(info.name==='main')Page=component;return()=>{}}}})
  const root=createRoot(dom.window.document.getElementById('root'))
  t.after(async()=>{await act(async()=>root.unmount());dom.window.close();globalThis.window=previous.window;globalThis.document=previous.document;globalThis.IS_REACT_ACT_ENVIRONMENT=previous.act})
  await act(async()=>root.render(React.createElement(Page)))
  const buttons=[...dom.window.document.querySelectorAll('.lm-card button')].filter(button=>button.textContent==='查看详情')
  await act(async()=>buttons[0].click())
  dom.window.document.querySelector('.lm-detail').scrollTop=200
  await act(async()=>buttons[1].click())
  const detail=dom.window.document.querySelector('.lm-detail')
  assert.equal(detail.querySelector('h2').textContent,'second')
  assert.equal(detail.scrollTop,0)
})

test('GitHub sort persists during pagination and refresh, then resets outside GitHub',async()=>{
  const urls=[];const store=client(url=>{urls.push(new URL(url,'http://localhost'));return response({rows:[],errors:[]})}).createStore()
  for(const sort of ['stars','updated','forks']){
    urls.length=0
    await store.search('market','github',1,false,sort)
    await store.search('market','github',2);await store.load('discover',true)
    assert.deepEqual(urls.map(url=>url.searchParams.get('sort')),[sort,sort,sort])
    assert.equal(urls[2].searchParams.get('page'),'2');assert.equal(urls[2].searchParams.get('force'),'1')
  }
  await store.search('market','npm')
  assert.equal(store.get().sort,'default');assert.equal(urls.at(-1).searchParams.get('sort'),'default');store.dispose()
})

test('a failed new sort cannot present the previous ordering as current results',async()=>{
  let requests=0
  const store=client(()=>++requests===1?response({rows:[row],errors:[]}):Promise.resolve(new Response('{"code":"network"}',{status:502}))).createStore()
  await store.search('market','all')
  await store.search('market','github',1,false,'stars')
  assert.equal(store.get().status,'error');assert.equal(store.get().sort,'stars')
  assert.equal(store.get().data,null);store.dispose()
})

test('refresh keeps successful rows while waiting and preserves them after source failure',async()=>{
  let finish,requests=0
  const store=client(()=>++requests===1?response({ok:true,rows:[row],errors:[]}):new Promise(resolve=>finish=resolve)).createStore()
  await store.search('market','github')
  const pending=store.load('discover',true)
  assert.equal(store.get().data.rows[0].name,'demo')
  finish(new Response('{"ok":false,"rows":[],"errors":[{"source":"github","code":"rate-limited","retryAt":12345}]}'));await pending
  assert.equal(store.get().data.rows[0].name,'demo')
  assert.equal(store.get().data.stale,true)
  assert.equal(store.get().data.errors[0].code,'rate-limited')
  store.dispose()
})

test('new empty success replaces old rows and failed unknown queries cannot borrow them',async()=>{
  let requests=0
  const store=client(()=>response(++requests===1?{ok:true,rows:[row],errors:[]}:requests===2?{ok:true,rows:[],errors:[]}:{ok:false,rows:[],errors:[{source:'github',code:'network'}]})).createStore()
  await store.search('market','github');await store.load('discover',true)
  assert.equal(store.get().data.rows.length,0)
  await store.search('another query','github')
  assert.equal(store.get().data.rows.length,0);store.dispose()
})

test('server-filtered empty cache does not resurrect a newly installed plugin from client history',async()=>{
  let requests=0
  const store=client(()=>response(++requests===1?{ok:true,rows:[row],errors:[]}:{ok:false,cacheHit:true,stale:true,rows:[],errors:[{source:'github',code:'rate-limited'}]})).createStore()
  await store.search('market','github');await store.load('discover',true)
  assert.equal(store.get().data.rows.length,0);store.dispose()
})

test('local snapshot appears before remote completion and a late cache cannot overwrite fresh results',async()=>{
  let finish,finishCache
  const store=client(()=>new Promise(resolve=>finish=resolve),{cachedFetch:()=>response({cacheHit:true,stale:true,rows:[{...row,name:'saved'}],errors:[],sources:{github:{cached:true,checkedAt:123}}})}).createStore()
  const pending=store.search('market','github')
  await new Promise(resolve=>setImmediate(resolve))
  assert.equal(store.get().status,'loading');assert.equal(store.get().data.rows[0].name,'saved')
  finish(new Response(JSON.stringify({ok:true,rows:[{...row,name:'fresh'}],errors:[]})));await pending
  assert.equal(store.get().data.rows[0].name,'fresh');store.dispose()
  const late=client(()=>response({ok:true,rows:[row],errors:[]}),{cachedFetch:()=>new Promise(resolve=>finishCache=resolve)}).createStore()
  await late.search('market','github')
  finishCache(new Response(JSON.stringify({cacheHit:true,rows:[{...row,name:'late-cache'}]})))
  await new Promise(resolve=>setImmediate(resolve))
  assert.equal(late.get().data.rows[0].name,'demo');late.dispose()
})

test('last successful discovery controls survive recreation without persisting result or credential data in browser storage',async()=>{
  const values=new Map(),localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)}
  let store=client(()=>response({ok:true,rows:[row],errors:[]}),{localStorage}).createStore()
  await store.search('market','github',2,false,'stars');store.dispose()
  store=client(()=>response({rows:[],errors:[]}),{localStorage}).createStore()
  assert.equal(store.get().q,'market');assert.equal(store.get().source,'github');assert.equal(store.get().sort,'stars');assert.equal(store.get().page,2)
  assert.equal(store.get().data,null)
  store.dispose()
})

test('star sorting control selects GitHub and renders known star counts',async t=>{
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'})
  const previous={window:globalThis.window,document:globalThis.document,act:globalThis.IS_REACT_ACT_ENVIRONMENT}
  globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true
  const urls=[],githubRows=[{id:'github:bob/popular',name:'bob/popular',repo:'bob/popular',source:'github',stars:42},{id:'github:alice/zero',name:'alice/zero',repo:'alice/zero',source:'github',stars:0},{id:'github:alice/unknown',name:'alice/unknown',repo:'alice/unknown',source:'github',stars:null}]
  const module=client(url=>{urls.push(new URL(url,'http://localhost'));return response({rows:githubRows,errors:[],hasMore:false})})
  let Page,dictionary
  module.apply({effect(fn){fn()},locale:{register(ns,value){dictionary=value;return()=>{}},bind:()=>key=>dictionary.zh[key]??key},slots:{inject(owner,fn){fn()},register(info,component){if(info.name==='main')Page=component;return()=>{}}}})
  const root=createRoot(dom.window.document.getElementById('root'))
  t.after(async()=>{await act(async()=>root.unmount());dom.window.close();globalThis.window=previous.window;globalThis.document=previous.document;globalThis.IS_REACT_ACT_ENVIRONMENT=previous.act})
  await act(async()=>root.render(React.createElement(Page)))
  const sort=dom.window.document.querySelector('select[aria-label="排序"]')
  assert.ok(sort,'sort control is available in discover')
  await act(async()=>{sort.value='stars';sort.dispatchEvent(new dom.window.Event('change',{bubbles:true}))})
  assert.equal(urls.at(-1).searchParams.get('source'),'github');assert.equal(urls.at(-1).searchParams.get('sort'),'stars')
  assert.equal(dom.window.document.querySelector('select[aria-label="来源"]').value,'github')
  assert.equal(dom.window.document.querySelector('[aria-label="GitHub 星标: 42"]').textContent,'★ 42')
  assert.equal(dom.window.document.querySelector('[aria-label="GitHub 星标: 0"]').textContent,'★ 0')
  assert.equal(dom.window.document.querySelector('[aria-label="GitHub 星标: null"]'),null)
  assert.deepEqual(Object.keys(dictionary.zh).sort(),Object.keys(dictionary.en).sort())
})

test('discovery hides installed rows and explicit orders select GitHub and survive refresh',async t=>{
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'})
  const previous={window:globalThis.window,document:globalThis.document,act:globalThis.IS_REACT_ACT_ENVIRONMENT}
  globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true
  const urls=[],installed={...row,id:'installed:local',name:'local',source:'local',alreadyInstalled:true}
  const module=client(url=>{urls.push(new URL(url,'http://localhost'));return response({rows:url.includes('/installed')||url.includes('/updates')?[installed]:[row,{...row,id:'npm:existing',name:'existing',alreadyInstalled:true},installed],errors:[]})})
  let Page,dictionary
  module.apply({effect(fn){fn()},locale:{register(ns,value){dictionary=value;return()=>{}},bind:()=>key=>dictionary.zh[key]??key},slots:{inject(owner,fn){fn()},register(info,component){if(info.name==='main')Page=component;return()=>{}}}})
  const root=createRoot(dom.window.document.getElementById('root'))
  t.after(async()=>{await act(async()=>root.unmount());dom.window.close();globalThis.window=previous.window;globalThis.document=previous.document;globalThis.IS_REACT_ACT_ENVIRONMENT=previous.act})
  await act(async()=>root.render(React.createElement(Page)))
  const doc=dom.window.document
  assert.deepEqual([...doc.querySelectorAll('.lm-card h2,.lm-card h3')].map(el=>el.textContent),['demo'])
  assert.equal(doc.querySelectorAll('select').length,2)
  const sort=doc.querySelector('select[aria-label="排序"]')
  for(const value of ['updated','forks']){
    assert.ok([...sort.options].some(option=>option.value===value))
    await act(async()=>{sort.value=value;sort.dispatchEvent(new dom.window.Event('change',{bubbles:true}))})
    assert.equal(urls.at(-1).searchParams.get('source'),'github');assert.equal(urls.at(-1).searchParams.get('sort'),value)
    await act(async()=>[...doc.querySelectorAll('button')].find(button=>button.textContent==='重新检查').click())
    assert.equal(urls.at(-1).searchParams.get('sort'),value)
  }
  await act(async()=>[...doc.querySelectorAll('[role="tab"]')].find(tab=>tab.textContent==='已安装').click())
  assert.ok(doc.querySelector('.lm-card').textContent.includes('local'))
})
