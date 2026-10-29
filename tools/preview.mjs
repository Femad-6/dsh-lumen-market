import {DISCOVERY_PAGE_SIZE} from '../lib/host/core.js'
/** Offline visual harness: loads the real client with real React and mock API only. */
import { build } from 'esbuild'
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import {resolve} from 'node:path'
import {SearchSnapshots} from '../lib/host/snapshots.js'
const previewSnapshots=new SearchSnapshots({disk:true}),previewProfile=resolve('verification/preview-profile')

const bootstrap=await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';
let definition;window.__ModuleLoader__={load:d=>definition=d};
window.startLumen=()=>{let dict;const module=definition.factory(()=>React);const ctx={effect:f=>f(),locale:{register:(ns,d)=>{dict=d;return()=>{}},bind:()=>k=>dict.zh[k]||k},slots:{inject:(owner,f)=>f(),register:(info,component)=>{if(info.name==='main')createRoot(document.getElementById('app')).render(React.createElement(component));return()=>{}}}};module.apply(ctx)};`,resolveDir:process.cwd(),loader:'js'},bundle:true,write:false,format:'iife',minify:true})
const fixtures=[
  {id:'npm:dsh-notes',name:'dsh-notes',source:'npm',version:'1.4.2',description:'将会话中的重要结论保存为可检索的 Markdown 笔记。支持标签整理和项目归档。',descriptionSource:'package.json',links:{readme:'https://github.com/example/dsh-notes',npm:'https://www.npmjs.com/package/dsh-notes'},validation:'bundle',compatibility:{verdict:'compatible'},installable:true},
  {id:'github:example/dsh-focus',name:'example/dsh-focus',repo:'example/dsh-focus',source:'github',description:'一个轻量的专注面板，帮助你查看当前任务与工作进度。此为预览演示数据。',descriptionSource:'GitHub',links:{repository:'https://github.com/example/dsh-focus'},validation:'unverified',compatibility:{verdict:'unknown'}},
  {id:'npm:dsh-terminal-kit',name:'dsh-terminal-kit',source:'npm',version:'0.8.0',description:'在工作空间中组织常用命令与终端会话，提供快捷入口和运行记录。',descriptionSource:'package.json',links:{npm:'https://www.npmjs.com/package/dsh-terminal-kit'},validation:'bundle',compatibility:{verdict:'incompatible',peers:{'@deepseek-ai/dsh':'^0.1.0'}},installable:false},
]
const scrollFixtures=Array.from({length:21},(_,index)=>({...fixtures[0],id:`npm:dsh-scroll-preview-${index+1}`,name:`dsh-scroll-preview-${index+1}`,description:index===20?'离线长详情示例，用于验证右侧独立滚动与底部内容可达性。'.repeat(160):'离线滚动布局示例，用于验证列表下方插件的详情保持可见。'}))
const starFixtures=Array.from({length:23},(_,index)=>({...fixtures[1],id:`github:example/dsh-stars-demo-${index+1}`,name:`example/dsh-stars-demo-${index+1}`,repo:`example/dsh-stars-demo-${index+1}`,stars:(index*173+41)%3000,forks:(index*47+19)%700,updatedAt:new Date(Date.UTC(2026,9,1+(index*7)%12)).toISOString(),description:'离线星标排序演示，仓库与星标数均为模拟数据。'}))
const installed=[{...fixtures[0],id:'installed:dsh-notes',source:'registry',removable:true,installed:'1.3.0',latest:'1.4.2',upgradeable:true,verdict:'outdated'}, {id:'installed:dsh-moonpet',name:'dsh-moonpet',source:'local',removable:true,installed:'0.1.0',description:'本地开发中的桌面伙伴，使用 link: 安装。',descriptionSource:'package.json',links:{},verdict:'local'},{id:'installed:dsh-base',name:'dsh-base',source:'shipped',removable:false,installed:'0.2.0',description:'模拟内置插件，不可卸载。',links:{},verdict:'shipped'}]
const colors=`:root{--dsw-alias-label-primary:#1e242c;--dsw-alias-label-secondary:#57606e;--dsw-alias-label-caption:#768190;--dsw-alias-state-business-primary:#23765d;--dsw-alias-state-error-primary:#ad3434;--dsw-alias-bg-base:#ffffff;--dsw-alias-bg-layer-3:#ffffff;--dsw-alias-label-on-color:#ffffff;--preview-bg:#f7f8f9}html[data-theme=dark]{--dsw-alias-label-primary:#e4e9ed;--dsw-alias-label-secondary:#a5b1bf;--dsw-alias-label-caption:#8795a5;--dsw-alias-state-business-primary:#66c8ac;--dsw-alias-state-error-primary:#f38f87;--dsw-alias-bg-base:#202831;--dsw-alias-bg-layer-3:#2a3541;--dsw-alias-label-on-color:#18211e;--preview-bg:#182027}body{margin:0;background:var(--preview-bg);font-family:'Segoe UI','Microsoft YaHei',sans-serif;height:100vh}#app{height:calc(100vh - 42px)}.preview-bar{box-sizing:border-box;height:42px;padding:8px 16px;font-size:12px;color:var(--dsw-alias-label-secondary);border-bottom:1px solid color-mix(in srgb,var(--dsw-alias-label-primary) 12%,transparent)}.preview-bar button{margin-left:16px;cursor:pointer}`
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>流明市场 · 离线预览</title><style>${colors}.preview-bar{height:auto;min-height:42px;display:flex;align-items:center;flex-wrap:wrap;gap:8px}.preview-bar button{margin:0}.preview-bar select{font:inherit;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base)}</style><div class="preview-bar">离线演示 · 模拟数据<button id="theme">切换主题</button><select id="scenario" aria-label="模拟场景"><option value="success">正常安装</option><option value="slow">慢速安装</option><option value="failure">安装失败</option><option value="rate-limit">搜索限流</option></select></div><div id="app"></div><script src="/react.js"></script><script src="/client.js"></script><script>const mode=new URLSearchParams(location.search).get('mode')||'success';const layout=new URLSearchParams(location.search).get('layout')||'';document.getElementById('scenario').value=mode;document.getElementById('scenario').onchange=e=>{const u=new URL(location.href);u.searchParams.set('mode',e.target.value);location.href=u.href};const originalFetch=window.fetch.bind(window);window.fetch=(url,options={})=>originalFetch(url,{...options,headers:{...options.headers,'x-lumen-preview-mode':mode,'x-lumen-preview-layout':layout}});document.getElementById('theme').onclick=()=>document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';window.startLumen()</script></html>`
const previews=new Map(),operations=new Map(),pendingRestart=new Set()
const snapshotOperation=op=>{
  const end=op.finishedAt??Date.now(),elapsedMs=end-(op.startedAt??end),quietMs=end-(op.lastActivityAt??end)
  return {operationId:op.operationId,name:op.name,phase:op.phase,startedAt:op.startedAt,lastActivityAt:op.lastActivityAt,elapsedMs,quietMs,quiet:!op.done&&quietMs>=60000,cancellable:op.cancellable,done:op.done,attempt:op.attempt??null,logs:op.logs??''}
}
let sourceCatalog={schemaVersion:1,entries:[{repo:'alice/dsh-demo',sha:'a'.repeat(40),name:'dsh-demo',version:'1.0.0',downloads:[{url:'https://codeload.github.com/alice/dsh-demo/tar.gz/'+'a'.repeat(40)}]}]}
const server=createServer(async(req,res)=>{
  const u=new URL(req.url,'http://localhost')
  if(u.pathname==='/react.js'){res.setHeader('content-type','application/javascript');res.end(bootstrap.outputFiles[0].text);return}
  if(u.pathname==='/client.js'){res.setHeader('content-type','application/javascript');res.end(readFileSync(new URL('../lib/client.js',import.meta.url)));return}
  if(u.pathname.startsWith('/api/lumen-market/')){
    res.setHeader('content-type','application/json')
    if(req.headers['x-lumen-preview-layout']==='installed-long'&&!installed.some(row=>row.name.startsWith('dsh-installed-scroll-')))installed.push(...Array.from({length:24},(_,index)=>({id:`installed:dsh-installed-scroll-${index+1}`,name:`dsh-installed-scroll-${index+1}`,source:'local',installed:'1.0.0',removable:true,description:'离线模拟已安装插件，用于验证滚动到列表下方后卸载确认仍进入视野。',links:{},verdict:'local'})))
    const catalog=req.headers['x-lumen-preview-layout']==='long'?scrollFixtures:u.searchParams.get('source')==='github'?starFixtures:fixtures
    const filtered=catalog.filter(row=>u.searchParams.get('source')!=='npm'||row.source==='npm').filter(row=>u.searchParams.get('source')!=='github'||row.source==='github')
    if(['stars','forks'].includes(u.searchParams.get('sort'))){const key=u.searchParams.get('sort');filtered.sort((a,b)=>(b[key]??-1)-(a[key]??-1))}
    if(u.searchParams.get('sort')==='updated')filtered.sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''))
    const page=Number(u.searchParams.get('page')||1)
    let payload={ok:true,rows:filtered.filter(row=>!installed.some(item=>item.name===row.name)).slice((page-1)*DISCOVERY_PAGE_SIZE,page*DISCOVERY_PAGE_SIZE),errors:[],hasMore:filtered.filter(row=>!installed.some(item=>item.name===row.name)).length>page*DISCOVERY_PAGE_SIZE,pendingRestart:[...pendingRestart]}
    const snapshotKey=JSON.stringify(['page21',req.headers['x-lumen-preview-layout']||'',u.searchParams.get('q')||'',u.searchParams.get('source')||'all',page,u.searchParams.get('sort')||'default'])
    if(u.pathname.endsWith('/search-cache')||u.pathname.endsWith('/search')){
      const saved=previewSnapshots.get(previewProfile,snapshotKey)
      const cached=saved?{...saved.found,cacheHit:true,stale:true,sources:Object.fromEntries(Object.keys(saved.found.sources||{}).map(source=>[source,{cached:true,checkedAt:saved.checkedAt}]))}:{ok:false,rows:[],cacheHit:false,errors:[],sources:{}}
      if(u.pathname.endsWith('/search-cache')){res.end(JSON.stringify(cached));return}
      if(req.headers['x-lumen-preview-mode']==='rate-limit'){res.end(JSON.stringify({...cached,errors:[{source:'github',code:'rate-limited',retryAt:Date.now()+60000}]}));return}
      if(req.headers['x-lumen-preview-mode']==='slow')await new Promise(resolve=>setTimeout(resolve,1800))
      payload.sources=Object.fromEntries([...new Set(payload.rows.map(row=>row.source))].map(source=>[source,{cached:false,checkedAt:Date.now()}]))
      previewSnapshots.save(previewProfile,snapshotKey,payload)
    }
    if(u.pathname.endsWith('/installed'))payload={ok:true,rows:installed.map(row=>({...row,latest:undefined,upgradeable:false,verdict:row.source==='registry'?'unchecked':row.source})),pendingRestart:[...pendingRestart]}
    if(u.pathname.endsWith('/updates')){await new Promise(r=>setTimeout(r,500));payload={ok:true,rows:installed,pendingRestart:[...pendingRestart],checkedAt:new Date().toISOString()}}
    if(u.pathname.endsWith('/health'))payload={ok:true,profile:{dir:'offline-preview-profile',evidence:'simulation'},managementAvailable:true,busy:false,pendingRestart:[...pendingRestart],github:{authenticated:false,retryAt:0}}
    if(u.pathname.endsWith('/detail'))payload=(u.searchParams.get('source')==='installed'?installed:[...catalog,...fixtures,...scrollFixtures,...starFixtures]).find(r=>r.name===u.searchParams.get('name'))||fixtures[0]
    let body={};if(req.method==='POST'){let s='';for await(const chunk of req)s+=chunk;body=JSON.parse(s)}
    if(u.pathname.endsWith('/sources')){
      if(body.action==='import')sourceCatalog=body.catalog
      payload={ok:true,catalog:sourceCatalog}
    }
    if(u.pathname.endsWith('/inspect')){
      const row=(body.action==='uninstall'?installed:catalog).find(row=>row.name===body.name)||fixtures[0],previewId=randomUUID()
      const preview={...row,action:body.action||'install',spec:`${row.name}@${row.version}`,fromVersion:body.action==='uninstall'?row.installed:body.action==='upgrade'?installed.find(r=>r.name===row.name)?.installed:null}
      previews.set(previewId,preview);if(previews.size>100)previews.delete(previews.keys().next().value)
      payload={ok:true,previewId,expiresAt:Date.now()+600000,preview}
    }
    if(u.pathname.endsWith('/operation')){const op=operations.get(u.searchParams.get('previewId'));payload={ok:true,operation:op?snapshotOperation(op):null}}
    if(u.pathname.endsWith('/cancel')){const op=[...operations.values()].find(op=>op.operationId===body.operationId);if(op&&!op.done){op.cancelled=true;op.phase='cancelling';op.cancellable=false;op.finish();payload={ok:true,status:'cancelled'}}else payload={ok:true,status:'not-running'}}
    if(u.pathname.endsWith('/uninstall')){
      const preview=previews.get(body.previewId),index=installed.findIndex(row=>row.name===preview?.name)
      if(!preview||preview.action!=='uninstall'||index<0||!installed[index].removable){res.statusCode=409;res.end(JSON.stringify({ok:false,code:'not-removable'}));return}
      previews.delete(body.previewId)
      const op={operationId:randomUUID(),name:preview.name,phase:'removing',cancellable:false,done:false}
      operations.set(body.previewId,op)
      await new Promise(resolve=>setTimeout(resolve,req.headers['x-lumen-preview-mode']==='slow'?8000:500))
      const failed=req.headers['x-lumen-preview-mode']==='failure'
      op.done=true;op.phase=failed?'failed':'applied'
      if(!failed){installed.splice(index,1);pendingRestart.delete(preview.name)}
      payload={ok:!failed,action:'uninstall',application:op.phase,changed:!failed,pendingRestart:[...pendingRestart],error:failed?{code:'bundle-in-use'}:null,warnings:['此结果由离线模拟 API 产生；未操作真实插件。']}
    }
    if(u.pathname.endsWith('/install')||u.pathname.endsWith('/upgrade')){
      const preview=previews.get(body.previewId)
      if(!preview){res.statusCode=409;res.end(JSON.stringify({ok:false,code:'preview-expired'}));return}
      previews.delete(body.previewId)
      const op={operationId:randomUUID(),name:preview.name,phase:'installing',cancellable:true,done:false,cancelled:false,finish:null}
      Object.assign(op,{startedAt:Date.now(),lastActivityAt:Date.now(),attempt:{index:1,total:2,registry:'https://registry.npmjs.org/'},logs:'Progress: resolved 1, reused 0, downloaded 0\n'})
      const quiet=req.headers['x-lumen-preview-mode']==='quiet'
      if(quiet){op.startedAt-=68000;op.lastActivityAt-=65000;op.logs+='WARN GET registry request waiting (offline simulation)\n'}
      operations.set(body.previewId,op);if(operations.size>100)operations.delete(operations.keys().next().value)
      let fallback
      if(!quiet)fallback=setTimeout(()=>{if(op.done||op.cancelled)return;op.lastActivityAt=Date.now();op.attempt={index:2,total:2,registry:'https://registry.npmmirror.com/'};op.logs+='WARN GET first registry timed out (offline simulation)\nProgress: resolved 8, reused 5, downloaded 3\n'},2500)
      await new Promise(resolve=>{const timer=setTimeout(resolve,['slow','quiet'].includes(req.headers['x-lumen-preview-mode'])?8000:1800);op.finish=()=>{clearTimeout(timer);resolve()}})
      clearTimeout(fallback);op.finishedAt=Date.now()
      op.done=true;op.cancellable=false
      const failed=req.headers['x-lumen-preview-mode']==='failure'
      op.phase=op.cancelled?'cancelled':failed?'failed':'restart-required'
      if(!failed&&!op.cancelled)pendingRestart.add(preview.name)
      payload={ok:!failed&&!op.cancelled,application:op.phase,changed:!failed&&!op.cancelled,pendingRestart:[...pendingRestart],warnings:['此结果由离线模拟 API 产生。'],packageResult:failed?{kind:'network',exitCode:1,output:'模拟注册表连接失败；未操作真实 profile。'}:null}
      if(req.headers['x-lumen-preview-mode']==='build-blocked'&&!body.buildConsent){const approvalPreviewId=randomUUID();previews.set(approvalPreviewId,preview);payload={ok:false,application:'failed',packageResult:{kind:'build-blocked',output:'模拟脚本授权拦截；未操作真实 profile。'},approvalPreviewId,pendingBuilds:[preview.name]};pendingRestart.delete(preview.name)}
      payload.installation=snapshotOperation(op)
    }
    res.end(JSON.stringify(payload));return
  }
  res.setHeader('content-type','text/html; charset=utf-8');res.end(html)
})
server.listen(19408,'127.0.0.1',()=>console.log('Offline preview: http://127.0.0.1:19408'))
