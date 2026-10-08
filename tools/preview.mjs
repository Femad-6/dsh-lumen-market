/** Offline visual harness: loads the real client with real React and mock API only. */
import { build } from 'esbuild'
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'

const bootstrap=await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';
let definition;window.__ModuleLoader__={load:d=>definition=d};
window.startLumen=()=>{let dict;const module=definition.factory(()=>React);const ctx={effect:f=>f(),locale:{register:(ns,d)=>{dict=d;return()=>{}},bind:()=>k=>dict.zh[k]||k},slots:{inject:(owner,f)=>f(),register:(info,component)=>{if(info.name==='main')createRoot(document.getElementById('app')).render(React.createElement(component));return()=>{}}}};module.apply(ctx)};`,resolveDir:process.cwd(),loader:'js'},bundle:true,write:false,format:'iife',minify:true})
const fixtures=[
  {id:'npm:dsh-notes',name:'dsh-notes',source:'npm',version:'1.4.2',description:'将会话中的重要结论保存为可检索的 Markdown 笔记。支持标签整理和项目归档。',descriptionSource:'package.json',links:{readme:'https://github.com/example/dsh-notes',npm:'https://www.npmjs.com/package/dsh-notes'},validation:'bundle',compatibility:{verdict:'compatible'},installable:true},
  {id:'github:example/dsh-focus',name:'example/dsh-focus',repo:'example/dsh-focus',source:'github',description:'一个轻量的专注面板，帮助你查看当前任务与工作进度。此为预览演示数据。',descriptionSource:'GitHub',links:{repository:'https://github.com/example/dsh-focus'},validation:'unverified',compatibility:{verdict:'unknown'}},
  {id:'npm:dsh-terminal-kit',name:'dsh-terminal-kit',source:'npm',version:'0.8.0',description:'在工作空间中组织常用命令与终端会话，提供快捷入口和运行记录。',descriptionSource:'package.json',links:{npm:'https://www.npmjs.com/package/dsh-terminal-kit'},validation:'bundle',compatibility:{verdict:'incompatible',peers:{'@deepseek-ai/dsh':'^0.1.0'}},installable:false},
]
const installed=[{...fixtures[0],id:'installed:dsh-notes',source:'registry',installed:'1.3.0',latest:'1.4.2',upgradeable:true,verdict:'outdated'}, {id:'installed:dsh-moonpet',name:'dsh-moonpet',source:'local',installed:'0.1.0',description:'本地开发中的桌面伙伴，使用 link: 安装。',descriptionSource:'package.json',links:{},verdict:'local'}]
const colors=`:root{--dsw-alias-label-primary:#1e242c;--dsw-alias-label-secondary:#57606e;--dsw-alias-label-caption:#768190;--dsw-alias-state-business-primary:#23765d;--dsw-alias-state-error-primary:#ad3434;--dsw-alias-bg-base:#ffffff;--dsw-alias-bg-layer-3:#ffffff;--dsw-alias-label-on-color:#ffffff;--preview-bg:#f7f8f9}html[data-theme=dark]{--dsw-alias-label-primary:#e4e9ed;--dsw-alias-label-secondary:#a5b1bf;--dsw-alias-label-caption:#8795a5;--dsw-alias-state-business-primary:#66c8ac;--dsw-alias-state-error-primary:#f38f87;--dsw-alias-bg-base:#202831;--dsw-alias-bg-layer-3:#2a3541;--dsw-alias-label-on-color:#18211e;--preview-bg:#182027}body{margin:0;background:var(--preview-bg);font-family:'Segoe UI','Microsoft YaHei',sans-serif;height:100vh}#app{height:calc(100vh - 42px)}.preview-bar{box-sizing:border-box;height:42px;padding:8px 16px;font-size:12px;color:var(--dsw-alias-label-secondary);border-bottom:1px solid color-mix(in srgb,var(--dsw-alias-label-primary) 12%,transparent)}.preview-bar button{margin-left:16px;cursor:pointer}`
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>流明市场 · 离线预览</title><style>${colors}</style><div class="preview-bar">离线演示 · 所有插件与安装结果均为模拟数据<button id="theme">切换主题</button></div><div id="app"></div><script src="/react.js"></script><script src="/client.js"></script><script>document.getElementById('theme').onclick=()=>document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';window.startLumen()</script></html>`
const server=createServer(async(req,res)=>{
  const u=new URL(req.url,'http://localhost')
  if(u.pathname==='/react.js'){res.setHeader('content-type','application/javascript');res.end(bootstrap.outputFiles[0].text);return}
  if(u.pathname==='/client.js'){res.setHeader('content-type','application/javascript');res.end(readFileSync(new URL('../lib/client.js',import.meta.url)));return}
  if(u.pathname.startsWith('/api/lumen-market/')){
    res.setHeader('content-type','application/json')
    let payload={ok:true,rows:fixtures,errors:[],hasMore:false,pendingRestart:[]}
    if(u.pathname.endsWith('/installed')||u.pathname.endsWith('/updates'))payload={ok:true,rows:installed,pendingRestart:[],checkedAt:new Date().toISOString()}
    if(u.pathname.endsWith('/detail'))payload=fixtures.find(r=>r.name===u.searchParams.get('name'))||installed.find(r=>r.name===u.searchParams.get('name'))||fixtures[0]
    if(u.pathname.endsWith('/inspect')){let s='';for await(const chunk of req)s+=chunk;const b=JSON.parse(s);payload={previewId:'demo-only',preview:{...fixtures[0],action:b.action,spec:'dsh-notes@1.4.2'}}}
    if(u.pathname.endsWith('/install')||u.pathname.endsWith('/upgrade'))payload={ok:true,application:'restart-required',pendingRestart:['dsh-notes']}
    res.end(JSON.stringify(payload));return
  }
  res.setHeader('content-type','text/html; charset=utf-8');res.end(html)
})
server.listen(19408,'127.0.0.1',()=>console.log('Offline preview: http://127.0.0.1:19408'))
