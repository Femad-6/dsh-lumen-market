import semver from 'semver'
import { randomUUID, createHash } from 'node:crypto'
import { MarketError, exactVersion, normalizeResult, validateQuery, sanitize, packageName } from './core.js'
import { Cache } from './cache.js'
import { evaluateCompatibility } from './compat.js'
import { repoKey } from './github.js'
import { mapLimit } from './http.js'

const stable = v => v && typeof v==='object' ? Array.isArray(v)?v.map(stable):Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])) : v
const digest = row => createHash('sha256').update(JSON.stringify(stable({name:row.name,version:row.version,sha:row.sha??null,manifest:row.manifest}))).digest('hex')
function installedRepo(spec){
  if(typeof spec!=='string')return null
  return repoKey(spec.replace(/^github:/,'').replace(/^git\+https:/,'https:').replace(/#.*$/,''))?.toLowerCase()??null
}
export class Market {
  constructor({npm,github,profile,manager=()=>null,http,now=Date.now}={}){
    this.npm=npm;this.github=github;this.profile=profile;this.manager=manager;this.http=http;this.now=now
    this.previews=new Cache({ttl:600000,max:200,now});this.pendingRestart=new Set();this.busy=false;this.disposed=false;this.requestId=null
  }
  assertActive(){if(this.disposed)throw new MarketError('disposed',503)}
  async context(){
    this.assertActive()
    const manager=this.manager()
    let exemptions={}
    try{exemptions=(await manager?.listVersionExemptions?.())?.exemptions??{}}catch{}
    const snapshot=await this.profile.snapshot(manager)
    return {...snapshot,exemptions}
  }
  decorate(row,context){
    const compatibility=row.manifest?evaluateCompatibility(row.manifest,context.runtimeVersion,context.exemptions):{verdict:'unknown',peers:{},exempted:false}
    const installed=context.rows.find(r=>r.name===row.name && (row.source==='npm'?r.source==='registry':r.source==='git' && installedRepo(r.specifier)===row.repo?.toLowerCase()))
    const nameCollision=context.rows.some(r=>r.name===row.name)&&!installed
    return {...row,compatibility,installed:installed?.installed??null,alreadyInstalled:!!installed,sourceConflict:nameCollision,installable:!nameCollision && row.validation==='bundle' && (compatibility.verdict==='compatible'||compatibility.exempted===true) && !!row.spec}
  }
  async search({q='',source='all',page=1}={}){
    q=validateQuery(q,page);if(!['all','npm','github'].includes(source))throw new MarketError('invalid-source')
    const context=await this.context(),names=source==='all'?['npm','github']:[source]
    const results=await Promise.allSettled(names.map(s=>this[s].search(q,page)))
    const rows=[],errors=[],sources={}
    if(source==='all' && page===1){
      const needle=q.toLowerCase()
      const local=context.rows.filter(r=>!needle||`${r.name} ${r.description??''} ${Object.values(r.links??{}).join(' ')}`.toLowerCase().includes(needle))
      rows.push(...local.map(r=>({...r,validation:r.bundle?'bundle':'not-plugin',alreadyInstalled:true,installable:false,upgradeable:false})))
      sources.installed={total:local.length,page:1,coverage:'current-profile'}
    }
    results.forEach((result,i)=>{const s=names[i];if(result.status==='fulfilled'){sources[s]={total:result.value.total,coverage:result.value.coverage,page:result.value.page};rows.push(...result.value.rows.map(r=>this.decorate(r,context)))}else errors.push({source:s,code:result.reason.code??'network',...result.reason.extra})})
    return sanitize({ok:rows.length>0||errors.length===0,rows,errors,sources,page,hasMore:names.some(s=>sources[s]?.total>page*20),pendingRestart:[...this.pendingRestart],runtimeVersion:context.runtimeVersion})
  }
  async detail({source,name,repo,version}={}){
    const context=await this.context()
    if(source==='installed'){
      const row=context.rows.find(r=>r.name===name);if(!row)throw new MarketError('not-found',404)
      return sanitize({...row,validation:row.bundle?'bundle':'not-plugin',compatibility:evaluateCompatibility(row.manifest??{},context.runtimeVersion,context.exemptions),installable:false})
    }
    if(!['npm','github'].includes(source))throw new MarketError('invalid-source')
    const row=source==='npm'?await this.npm.detail(name,version):await this.github.detail(repo)
    return sanitize(this.decorate(row,context))
  }
  async installed(){
    return {...await this.updates(),busy:this.busy}
  }
  async updates({force=false}={}){
    if(force)this.npm.clear()
    const context=await this.context(),dead=new Set()
    const rows=await mapLimit(context.rows,3,async row=>{
      if(row.source!=='registry')return {...row,upgradeable:false,verdict:row.source}
      try{
        const target=await this.npm.detail(row.name,undefined,{dead})
        const decorated=this.decorate(target,context)
        const compare=exactVersion(row.installed)&&exactVersion(target.version)?semver.compare(target.version,row.installed):null
        return {...row,latest:target.version,description:row.description||target.description,links:Object.keys(row.links??{}).length?row.links:target.links,compatibility:decorated.compatibility,validation:target.validation,upgradeable:compare>0&&decorated.installable,verdict:compare===null?'unknown-installed':compare>0?decorated.installable?'outdated':'blocked':compare===0?'current':'ahead'}
      }catch(e){return {...row,upgradeable:false,verdict:'lookup-failed',error:{code:e.code??'network',...e.extra}}}
    })
    const errors=rows.filter(r=>r.verdict==='lookup-failed').map(r=>({source:'npm',name:r.name,diagnostic:r.name,...r.error}))
    return sanitize({ok:true,rows,errors,checkedAt:new Date(this.now()).toISOString(),pendingRestart:[...this.pendingRestart],runtimeVersion:context.runtimeVersion,profile:context.profile})
  }
  checkTarget(row,action,context){
    const decorated=this.decorate(row,context)
    const existing=context.rows.find(r=>r.name===row.name)
    if(action==='upgrade'){
      if(row.source!=='npm'||!existing||existing.source!=='registry')throw new MarketError('source-changed',409)
      if(!exactVersion(existing.installed)||!exactVersion(row.version)||semver.compare(row.version,existing.installed)<=0)throw new MarketError('target-not-newer',409)
    }else if(existing){throw new MarketError(decorated.alreadyInstalled?'already-installed':'source-conflict',409)}
    if(!decorated.installable)throw new MarketError('not-installable',409,{validation:row.validation,compatibility:decorated.compatibility})
    return existing
  }
  async inspect({action='install',source,name,repo,version}={}){
    if(!['install','upgrade'].includes(action)||!['npm','github'].includes(source))throw new MarketError('invalid-target')
    const manager=this.manager();if(typeof manager?.installBundle!=='function')throw new MarketError('management-required',503)
    const context=await this.context()
    const row=source==='npm'?await this.npm.detail(name,version,{fresh:true}):await this.github.detail(repo,{fresh:true})
    const existing=this.checkTarget(row,action,context)
    if(action==='install' && typeof manager.inspect==='function'){
      const result=await manager.inspect(row.spec)
      if(result?.problem)throw new MarketError('official-inspect-rejected',409,{problem:result.problem,diagnostic:result.diagnostic??null})
      if(source==='npm' && (result?.name && result.name!==row.name || result?.version && result.version!==row.version))throw new MarketError('preview-stale',409)
    }
    const previewId=randomUUID(),expiresAt=this.now()+600000
    this.previews.set(previewId,{action,row,digest:digest(row),existing:existing?{source:existing.source,specifier:existing.specifier,installed:existing.installed}:null})
    return sanitize({ok:true,previewId,expiresAt,preview:{...this.decorate(row,context),action,spec:row.spec,fromVersion:existing?.installed??null}})
  }
  async execute(action,body={}){
    this.assertActive()
    if(!['install','upgrade'].includes(action)||typeof body.previewId!=='string'||Object.keys(body).some(k=>k!=='previewId'))throw new MarketError('invalid-request')
    if(this.busy)throw new MarketError('busy',409)
    const preview=this.previews.get(body.previewId)
    if(!preview||preview.action!==action)throw new MarketError('preview-expired',409)
    this.busy=true;this.previews.entries.delete(body.previewId)
    try{
      const manager=this.manager()
      if(typeof manager?.installBundle!=='function')throw new MarketError('management-required',503)
      const row=preview.row.source==='npm'?await this.npm.detail(preview.row.name,preview.row.version,{fresh:true}):await this.github.detail(preview.row.repo,{sha:preview.row.sha,fresh:true})
      if(digest(row)!==preview.digest)throw new MarketError('preview-stale',409)
      const context=await this.context()
      const existing=this.checkTarget(row,action,context)
      if(existing && (existing.specifier!==preview.existing?.specifier || existing.installed!==preview.existing?.installed))throw new MarketError('preview-stale',409)
      this.assertActive();this.requestId=randomUUID()
      const result=normalizeResult(await manager.installBundle(row.spec,{requestId:this.requestId,enabled:existing?existing.enabled!==false && existing.bundle!==false:true}))
      if(result.ok && ((existing && result.changed)||result.application==='restart-required'))this.pendingRestart.add(row.name)
      this.npm.clear();this.github.clear()
      return sanitize({...result,name:row.name,source:row.source,pendingRestart:[...this.pendingRestart]})
    }finally{this.busy=false;this.requestId=null}
  }
  health(){return sanitize({ok:true,pid:process.pid,profile:this.profile.resolution(),managementAvailable:typeof this.manager()?.installBundle==='function',pendingRestart:[...this.pendingRestart],busy:this.busy,github:{authenticated:!!this.github.token,retryAt:this.github.blockedUntil??0}})}
  dispose(){
    this.disposed=true;this.http?.dispose();this.previews.clear();this.npm.clear();this.github.clear()
    if(this.requestId){try{Promise.resolve(this.manager()?.cancelInstall?.(this.requestId)).catch(()=>{})}catch{}}
  }
}
