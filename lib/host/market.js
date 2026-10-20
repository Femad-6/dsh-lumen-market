import {DISCOVERY_PAGE_SIZE} from './core.js'
import semver from 'semver'
import { randomUUID, createHash } from 'node:crypto'
import { MarketError, exactVersion, normalizeResult, validateQuery, sanitize, packageName } from './core.js'
import { Cache } from './cache.js'
import { evaluateCompatibility } from './compat.js'
import { repoKey } from './github.js'
import { mapLimit } from './http.js'
import { SearchSnapshots } from './snapshots.js'

const stable = v => v && typeof v==='object' ? Array.isArray(v)?v.map(stable):Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])) : v
const digest = row => createHash('sha256').update(JSON.stringify(stable({name:row.name,version:row.version,sha:row.sha??null,manifest:row.manifest}))).digest('hex')
const transient = error => ['network','timeout','rate-limited','registry-unavailable','http-500','http-502','http-503','http-504'].includes(error?.code)
const targetKey = ({source,name,repo,version}) => source==='github'&&repoKey(repo)?JSON.stringify(['github',repoKey(repo).toLowerCase()]):source==='npm'&&packageName(name)&&(version===undefined||exactVersion(version))?JSON.stringify(['npm',name,version??'latest']):null
function fixedTarget(row){
  if(!row||!packageName(row.name)||row.manifest?.name!==row.name||!exactVersion(row.manifest?.version)||row.validation!=='bundle'||typeof row.manifest?.dsh?.bundle?.patch!=='string'||!row.manifest.dsh.bundle.patch.trim())return false
  return row.source==='npm'?exactVersion(row.version)&&row.version===row.manifest.version&&row.spec===`${row.name}@${row.version}`:
    row.source==='github'&&!!repoKey(row.repo)&&/^[a-f0-9]{40}$/i.test(row.sha??'')&&row.spec===`github:${row.repo}#${row.sha}`
}
function installedRepo(spec){
  if(typeof spec!=='string')return null
  return repoKey(spec.replace(/^github:/,'').replace(/^git\+https:/,'https:').replace(/#.*$/,''))?.toLowerCase()??null
}
export class Market {
  constructor({npm,github,profile,manager=()=>null,http,now=Date.now,snapshots=new SearchSnapshots({now})}={}){
    this.npm=npm;this.github=github;this.profile=profile;this.manager=manager;this.http=http;this.now=now;this.snapshots=snapshots;this.discoveryPages=new Map()
    this.installSnapshots=new SearchSnapshots({disk:snapshots.disk,max:100,now,filename:'install-cache.json'})
    this.previews=new Cache({ttl:600000,max:200,now});this.pendingRestart=new Set();this.busy=false;this.disposed=false;this.requestId=null;this.operationState=null
  }
  assertActive(){if(this.disposed)throw new MarketError('disposed',503)}
  saveVerified(row,context,{official=false}={}){
    if(!fixedTarget(row)||!this.decorate(row,context).installable)return
    const rejected=this.installSnapshots.get(context.profile.dir,targetKey(row))?.found
    if(!official&&rejected?.rejected&&(!rejected.spec||rejected.spec===row.spec))return
    const clean=sanitize({...row});delete clean.cachedMetadata
    const found={rows:[clean],digest:digest(clean)}
    this.installSnapshots.save(context.profile.dir,targetKey(row),found)
    if(row.source==='npm')this.installSnapshots.save(context.profile.dir,targetKey({...row,version:undefined}),found)
  }
  forgetVerified(args,context){
    const dir=context.profile.dir,key=targetKey(args)
    if(!key)return
    const saved=this.installSnapshots.get(dir,key)?.found?.rows?.[0],row=saved??args
    const keys=new Set([key])
    if(args.source==='npm'){
      if(saved)keys.add(targetKey(saved))
      const latest=targetKey({...args,version:undefined}),latestRow=this.installSnapshots.get(dir,latest)?.found?.rows?.[0]
      if(latestRow&&(!args.version||latestRow.version===args.version))keys.add(latest)
    }
    for(const invalidKey of keys)this.installSnapshots.save(dir,invalidKey,{rows:[],rejected:true,spec:row.spec??null})
    for(const {value:preview} of this.previews.entries.values()){
      if(preview.profileDir===dir&&preview.row.source===args.source&&
        (args.source==='github'?repoKey(preview.row.repo)?.toLowerCase()===repoKey(args.repo)?.toLowerCase():preview.row.name===args.name&&(!args.version||preview.row.version===args.version)))preview.invalidated=true
    }
  }
  async resolveTarget(args,context,{fresh=false,pinned=null,allowCache=true}={}){
    const key=targetKey(args)
    try{
      const row=args.source==='npm'?await this.npm.detail(args.name,args.version,{fresh}):await this.github.detail(args.repo,{fresh,...(args.sha?{sha:args.sha}:{})})
      if(!fixedTarget(row)||context.rows&&!this.decorate(row,context).installable)this.forgetVerified(args,context)
      return {row,cachedMetadata:null}
    }catch(error){
      if(!transient(error)){
        if(['not-found','invalid-manifest'].includes(error.code))this.forgetVerified(args,context)
        throw error
      }
      if(!allowCache||!key)throw error
      const saved=pinned??this.installSnapshots.get(context.profile.dir,key)
      const row=saved?.found?.rows?.[0]
      if(!fixedTarget(row)||saved.found.digest!==digest(row)||targetKey(row)!==targetKey({...args,version:args.source==='npm'?row.version:args.version})||args.version!==undefined&&args.version!==row.version||args.sha!==undefined&&args.sha!==row.sha)throw error
      return {row,cachedMetadata:{checkedAt:saved.checkedAt,reason:error.code}}
    }
  }
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
  async search({q='',source='all',page=1,force=false,sort='default',cachedOnly=false}={}){
    q=validateQuery(q,page);if(!['all','npm','github'].includes(source))throw new MarketError('invalid-source')
    if(!['default','updated','stars','forks','weekly-stars'].includes(sort))throw new MarketError('invalid-sort')
    if(sort!=='default'&&source!=='github')throw new MarketError('github-sort-required')
    const context=await this.context(),names=source==='all'?['npm','github']:[source]
    const displayKey=JSON.stringify(['page21',source,q,page,sort]),saved=this.snapshots.get(context.profile.dir,displayKey)
    const isInstalled=row=>context.rows.some(installed=>{
      if(row.source==='npm')return installed.name===row.name||installed.manifest?.name===row.name
      const repo=row.repo?.toLowerCase()
      return repo && (installedRepo(installed.specifier)===repo||repoKey(installed.links?.repository)?.toLowerCase()===repo)
    })
    const decorate=rows=>rows.filter(row=>!isInstalled(row)).map(row=>this.decorate(row,context))
    if(cachedOnly)return sanitize(saved?{...saved.found,rows:decorate(saved.found.rows),stale:true,cacheHit:true,sources:Object.fromEntries(Object.entries(saved.found.sources||{}).map(([s,info])=>[s,{...info,cached:true}]))}:{ok:true,rows:[],errors:[],sources:{},page,sort,pageSize:DISCOVERY_PAGE_SIZE,cacheHit:false,hasMore:false})
    const queryKey=JSON.stringify([context.profile.dir,q,source,sort])
    let state=this.discoveryPages.get(queryKey)
    if(force||!state||this.now()-state.createdAt>300000){
      if(force){this.npm.clear();this.github.clear()}
      state={createdAt:this.now(),rows:[],seen:new Set(),sources:{},errors:new Map(),warnings:[],cursors:Object.fromEntries(names.map(s=>[s,{page:1,done:false,paused:false}])),queue:Promise.resolve()}
      this.discoveryPages.delete(queryKey);this.discoveryPages.set(queryKey,state)
      while(this.discoveryPages.size>50)this.discoveryPages.delete(this.discoveryPages.keys().next().value)
    }
    const rawKey=(s,upstreamPage)=>JSON.stringify(['raw21',s,q,upstreamPage,s==='github'?sort:'default'])
    const scan=async()=>{
      const end=page*DISCOVERY_PAGE_SIZE
      const maxRounds=Math.min(50,Math.max(3,page+2+Math.ceil(context.rows.length*2/DISCOVERY_PAGE_SIZE)))
      let rounds=0,visible=decorate(state.rows)
      while(visible.length<end&&rounds<maxRounds){
        const active=names.filter(s=>!state.cursors[s].done&&(!state.cursors[s].paused||this.snapshots.get(context.profile.dir,rawKey(s,state.cursors[s].page))))
        if(!active.length)break
        rounds++
        const results=await Promise.allSettled(active.map(async s=>{
          const cursor=state.cursors[s],key=rawKey(s,cursor.page),old=this.snapshots.get(context.profile.dir,key)
          if(cursor.paused&&old)return {...old.found,cached:true,checkedAt:old.checkedAt}
          try{
            const found=await (s==='github'?this.github.search(q,cursor.page,{sort}):this.npm.search(q,cursor.page))
            if(!Array.isArray(found.rows))throw new MarketError('invalid-response',502)
            if(!this.snapshots.save(context.profile.dir,key,found))state.warnings.push({source:s,code:'cache-write-failed'})
            state.errors.delete(s)
            return {...found,cached:false,checkedAt:this.now()}
          }catch(error){
            cursor.paused=true;state.errors.set(s,{source:s,code:error.code??'network',...error.extra})
            if(!old)throw error
            return {...old.found,cached:true,checkedAt:old.checkedAt}
          }
        }))
        results.forEach((result,i)=>{
          const s=active[i],cursor=state.cursors[s]
          if(result.status!=='fulfilled')return
          const found=result.value,more=found.hasMore??found.total>cursor.page*DISCOVERY_PAGE_SIZE
          const previous=state.sources[s]
          state.sources[s]={...found,rows:undefined,hasMore:more,cached:!!found.cached||!!previous?.cached,checkedAt:previous?Math.min(previous.checkedAt,found.checkedAt):found.checkedAt}
          cursor.done=!more;cursor.page++
          if(cursor.page>50)cursor.done=true
          for(const row of found.rows){const id=row.id||`${row.source}:${row.repo||row.name}`;if(!state.seen.has(id)){state.seen.add(id);state.rows.push(row)}}
        })
        visible=decorate(state.rows)
      }
      const more=visible.length>end||names.some(s=>!state.cursors[s].done)
      const scanLimited=visible.length<end&&rounds===maxRounds&&names.some(s=>!state.cursors[s].done&&!state.cursors[s].paused)
      const errors=[...state.errors.values()]
      const result={ok:visible.length>0||errors.length===0,rows:visible.slice((page-1)*DISCOVERY_PAGE_SIZE,end),errors,sources:state.sources,page,sort,pageSize:DISCOVERY_PAGE_SIZE,stale:names.some(s=>state.sources[s]?.cached),cacheHit:Object.keys(state.sources).length>0,cacheWarnings:state.warnings,hasMore:more,scanLimited,pendingRestart:[...this.pendingRestart],runtimeVersion:context.runtimeVersion}
      if(errors.length===0){if(!this.snapshots.save(context.profile.dir,displayKey,result))result.cacheWarnings=[...result.cacheWarnings,{code:'cache-write-failed'}]}
      else if(!result.rows.length&&saved)return sanitize({...saved.found,rows:decorate(saved.found.rows),errors,stale:true,cacheHit:true,pendingRestart:[...this.pendingRestart]})
      return sanitize(result)
    }
    const pending=state.queue.then(scan);state.queue=pending.then(()=>{},()=>{})
    return pending
  }
  async detail({source,name,repo,version}={}){
    const context=await this.context()
    if(source==='installed'){
      const row=context.rows.find(r=>r.name===name);if(!row)throw new MarketError('not-found',404)
      return sanitize({...row,alreadyInstalled:true,removable:row.removable===true&&typeof this.manager()?.removeBundle==='function',validation:row.bundle?'bundle':'not-plugin',compatibility:evaluateCompatibility(row.manifest??{},context.runtimeVersion,context.exemptions),installable:false})
    }
    if(!['npm','github'].includes(source))throw new MarketError('invalid-source')
    const {row,cachedMetadata}=await this.resolveTarget({source,name,repo,version},context)
    if(!cachedMetadata)this.saveVerified(row,context)
    return sanitize({...this.decorate(row,context),...(cachedMetadata?{cachedMetadata}:{})})
  }
  async installed(){
    const context=await this.context()
    const rows=context.rows.map(row=>({...row,alreadyInstalled:true,removable:row.removable===true&&typeof this.manager()?.removeBundle==='function',upgradeable:false,verdict:row.source==='registry'?'unchecked':row.source}))
    return sanitize({ok:true,rows,errors:[],checkedAt:null,busy:this.busy,pendingRestart:[...this.pendingRestart],runtimeVersion:context.runtimeVersion,profile:context.profile})
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
    return sanitize({ok:true,rows:rows.map(row=>({...row,removable:row.removable===true&&typeof this.manager()?.removeBundle==='function'})),errors,checkedAt:new Date(this.now()).toISOString(),pendingRestart:[...this.pendingRestart],runtimeVersion:context.runtimeVersion,profile:context.profile})
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
    if(action==='uninstall'){
      if(source!=='installed'||!packageName(name)||repo!==undefined||version!==undefined)throw new MarketError('invalid-target')
      if(typeof this.manager()?.removeBundle!=='function')throw new MarketError('removal-unavailable',503)
      const context=await this.context(),row=context.rows.find(row=>row.name===name)
      if(!row||row.removable!==true||row.source==='shipped')throw new MarketError('not-removable',409)
      const previewId=randomUUID(),expiresAt=this.now()+600000
      this.previews.set(previewId,{action,row:{...row},profileDir:context.profile.dir,existing:{source:row.source,specifier:row.specifier,installed:row.installed}})
      return sanitize({ok:true,previewId,expiresAt,preview:{...row,action,fromVersion:row.installed}})
    }
    if(!['install','upgrade'].includes(action)||!['npm','github'].includes(source))throw new MarketError('invalid-target')
    const manager=this.manager();if(typeof manager?.installBundle!=='function')throw new MarketError('management-required',503)
    const context=await this.context()
    let {row,cachedMetadata}=await this.resolveTarget({source,name,repo,version},context,{fresh:true,allowCache:action==='install'})
    const existing=this.checkTarget(row,action,context)
    if(action==='install' && !cachedMetadata && typeof manager.inspect==='function'){
      let result
      try{result=await manager.inspect(row.spec)}catch(error){if(!transient(error))throw error;cachedMetadata={checkedAt:this.now(),reason:error.code}}
      if(result?.problem){this.forgetVerified(row,context);throw new MarketError('official-inspect-rejected',409,{problem:result.problem,diagnostic:result.reason??result.diagnostic??null})}
      if(source==='npm' && (result?.name && result.name!==row.name || result?.version && result.version!==row.version)){this.forgetVerified(row,context);throw new MarketError('preview-stale',409)}
    }
    if(!cachedMetadata)this.saveVerified(row,context,{official:action==='install'&&typeof manager.inspect==='function'})
    const previewId=randomUUID(),expiresAt=this.now()+600000
    this.previews.set(previewId,{action,row,digest:digest(row),checkedAt:cachedMetadata?.checkedAt??this.now(),profileDir:context.profile.dir,cachedMetadata,existing:existing?{source:existing.source,specifier:existing.specifier,installed:existing.installed}:null})
    return sanitize({ok:true,previewId,expiresAt,preview:{...this.decorate(row,context),action,spec:row.spec,fromVersion:existing?.installed??null,...(cachedMetadata?{cachedMetadata}:{})}})
  }
  async execute(action,body={}){
    this.assertActive()
    if(!['install','upgrade','uninstall'].includes(action)||typeof body.previewId!=='string'||Object.keys(body).some(k=>k!=='previewId'))throw new MarketError('invalid-request')
    if(this.busy)throw new MarketError('busy',409)
    const preview=this.previews.get(body.previewId)
    if(!preview||preview.action!==action)throw new MarketError('preview-expired',409)
    if(preview.invalidated)throw new MarketError('preview-stale',409)
    this.busy=true;this.previews.entries.delete(body.previewId)
    const operation={operationId:randomUUID(),previewId:body.previewId,name:preview.row.name,action,phase:'checking',startedAt:this.now(),cancellable:true,cancelRequested:false,managerStarted:false,done:false}
    this.operationState=operation;this.requestId=operation.operationId
    try{
      const manager=this.manager()
      if(action==='uninstall'){
        if(typeof manager?.removeBundle!=='function')throw new MarketError('removal-unavailable',503)
        const context=await this.context(),existing=context.rows.find(row=>row.name===preview.row.name)
        if(context.profile.dir!==preview.profileDir||!existing||existing.source!==preview.existing.source||existing.specifier!==preview.existing.specifier||existing.installed!==preview.existing.installed)throw new MarketError('preview-stale',409)
        if(existing.removable!==true||existing.source==='shipped')throw new MarketError('not-removable',409)
        this.assertActive()
        if(operation.cancelRequested){operation.application='cancelled';return normalizeResult({application:'cancelled',changed:false})}
        operation.phase='removing';operation.cancellable=false;operation.managerStarted=true
        const result=normalizeResult(await manager.removeBundle(existing.name))
        operation.application=result.application
        if(result.ok&&result.application==='restart-required')this.pendingRestart.add(existing.name)
        else if(result.ok)this.pendingRestart.delete(existing.name)
        this.npm.clear();this.github.clear()
        return sanitize({...result,action,name:existing.name,source:existing.source,pendingRestart:[...this.pendingRestart]})
      }
      if(typeof manager?.installBundle!=='function')throw new MarketError('management-required',503)
      const pinned={checkedAt:preview.checkedAt,found:{rows:[preview.row],digest:preview.digest}}
      const {row,cachedMetadata}=await this.resolveTarget(preview.row,{profile:{dir:preview.profileDir}},{fresh:true,pinned,allowCache:action==='install'})
      if(operation.cancelRequested){operation.application='cancelled';return normalizeResult({application:'cancelled',changed:false})}
      if(digest(row)!==preview.digest){this.forgetVerified(preview.row,{profile:{dir:preview.profileDir}});throw new MarketError('preview-stale',409)}
      const currentContext=await this.context()
      if(preview.invalidated||currentContext.profile.dir!==preview.profileDir)throw new MarketError('preview-stale',409)
      const existing=this.checkTarget(row,action,currentContext)
      if(existing && (existing.specifier!==preview.existing?.specifier || existing.installed!==preview.existing?.installed))throw new MarketError('preview-stale',409)
      this.assertActive()
      if(operation.cancelRequested){operation.application='cancelled';return normalizeResult({application:'cancelled',changed:false})}
      operation.managerStarted=true;operation.phase='installing';operation.cancellable=typeof manager.cancelInstall==='function'
      const result=normalizeResult(await manager.installBundle(row.spec,{requestId:this.requestId,enabled:existing?existing.enabled!==false && existing.bundle!==false:true}))
      operation.application=result.application
      if(result.ok)this.saveVerified(row,currentContext,{official:true})
      if(result.ok && ((existing && result.changed)||result.application==='restart-required'))this.pendingRestart.add(row.name)
      this.npm.clear();this.github.clear()
      return sanitize({...result,name:row.name,source:row.source,pendingRestart:[...this.pendingRestart],...((cachedMetadata||preview.cachedMetadata)?{cachedMetadata:cachedMetadata||preview.cachedMetadata}:{})})
    }catch(e){
      if(operation.cancelRequested&&!operation.managerStarted){operation.application='cancelled';return normalizeResult({application:'cancelled',changed:false})}
      operation.error={code:e.code??'internal'};throw e
    }finally{operation.done=true;operation.cancellable=false;operation.phase=operation.application??'failed';this.busy=false;this.requestId=null}
  }
  progress(event){
    const operation=this.operationState
    if(!this.busy||!operation||event?.requestId!==operation.operationId||!['installing','applying','cancelling'].includes(event.phase))return
    operation.phase=event.phase
    operation.cancellable=event.phase==='installing'&&typeof this.manager()?.cancelInstall==='function'
    if(event.attempt&&Number.isInteger(event.attempt.index)&&Number.isInteger(event.attempt.total)){
      operation.attempt={registry:typeof event.attempt.registry==='string'?event.attempt.registry:null,index:event.attempt.index,total:event.attempt.total}
    }
  }
  operation({previewId}={}){
    this.assertActive()
    if(typeof previewId!=='string'||!previewId||previewId.length>128)throw new MarketError('invalid-request')
    const operation=this.operationState
    return sanitize({ok:true,operation:operation?.previewId===previewId?{operationId:operation.operationId,name:operation.name,action:operation.action,phase:operation.phase,startedAt:operation.startedAt,cancellable:operation.cancellable,done:operation.done,attempt:operation.attempt??null,cancelStatus:operation.cancelStatus??null,error:operation.error??null}:null})
  }
  async cancel(body={}){
    this.assertActive()
    if(typeof body.operationId!=='string'||!body.operationId||body.operationId.length>128||Object.keys(body).some(k=>k!=='operationId'))throw new MarketError('invalid-request')
    const operation=this.operationState
    if(!operation||operation.operationId!==body.operationId)throw new MarketError('operation-not-found',404)
    if(!this.busy||operation.done)return {ok:true,status:'not-running'}
    if(operation.action==='uninstall'&&operation.managerStarted)throw new MarketError('cancellation-unavailable',409)
    if(operation.cancelPromise)return operation.cancelPromise
    if(!operation.managerStarted){operation.cancelRequested=true;operation.phase='cancelling';operation.cancellable=false;operation.cancelStatus='requested';return {ok:true,status:'requested'}}
    const manager=this.manager()
    if(typeof manager?.cancelInstall!=='function')throw new MarketError('cancellation-unavailable',409)
    const previous=operation.phase;operation.phase='cancelling';operation.cancellable=false
    operation.cancelPromise=Promise.resolve().then(()=>manager.cancelInstall(operation.operationId)).then(result=>{
      const status=['cancelled','too-late','not-running'].includes(result?.status)?result.status:'not-running'
      operation.cancelStatus=status
      if(status==='too-late'&&!operation.done)operation.phase=previous
      return {ok:true,status}
    }).catch(e=>{if(!operation.done){operation.phase=previous;operation.cancellable=previous==='installing'};throw e}).finally(()=>{operation.cancelPromise=null})
    return operation.cancelPromise
  }
  health(){return sanitize({ok:true,pid:process.pid,profile:this.profile.resolution(),managementAvailable:typeof this.manager()?.installBundle==='function',pendingRestart:[...this.pendingRestart],busy:this.busy,github:{authenticated:!!this.github.token,retryAt:this.github.blockedUntil??0}})}
  dispose(){
    if(this.operationState)this.operationState.cancelRequested=true
    this.disposed=true;this.discoveryPages.clear();this.http?.dispose();this.previews.clear();this.npm.clear();this.github.clear()
    if(this.requestId){try{Promise.resolve(this.manager()?.cancelInstall?.(this.requestId)).catch(()=>{})}catch{}}
  }
}
