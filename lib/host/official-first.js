import {MarketError,packageName,exactVersion,normalizeResult,sanitize} from './core.js'
import {repoKey} from './github.js'
import {unavailable,retryInstall,repositoryOf} from './install-sources.js'

export function officialRow({source,name,repo,version,sha}){
  if(version!==undefined&&!exactVersion(version)||sha!==undefined&&!/^[a-f0-9]{40}$/i.test(sha))throw new MarketError('invalid-target')
  if(source==='npm'&&packageName(name)&&repo===undefined&&sha===undefined)return {source,name,version,spec:version?`${name}@${version}`:name}
  const key=repoKey(repo)
  if(source!=='github'||!key)throw new MarketError('invalid-target')
  return {source,repo:key,name:packageName(name)?name:key.split('/')[1].toLowerCase(),version,sha,spec:sha?`github:${key}#${sha}`:`https://github.com/${key}`}
}

/** The official manager returns a settled result. Never infer failure from silence or a closed dialog. */
export async function executeOfficialFirst(market,preview,operation,body){
  const manager=market.manager()
  let row={...preview.row},raw,result,context
  const log=text=>{operation.lastActivityAt=market.now();operation.log.line(text)}
  const cancelled=()=>operation.cancelRequested?normalizeResult({application:'cancelled',changed:false}):null
  const check=async()=>{
    market.assertActive();const current=await market.context()
    await market.assertNoRecovery(current)
    if(current.profile.dir!==preview.profileDir||preview.invalidated)throw new MarketError('preview-stale',409)
    const repo=repositoryOf(row)
    if(current.rows.some(r=>r.name===row.name||repo&&(r.gitOrigin?.repo?.toLowerCase()??repositoryOf(r)??repoKey(r.specifier?.replace(/^github:/,'').replace(/#.*$/,''))?.toLowerCase())===repo))throw new MarketError('already-installed',409)
    market.assertActive();return current
  }
  const finish=(value,target=row,record=preview)=>{
    market.rememberBuildApproval(value,record,target)
    operation.application=value.application
    if(value.ok){market.saveVerified(target,context,{official:true});if(value.application==='restart-required')market.pendingRestart.add(target.name)}
    market.npm.clear();market.github.clear();operation.log.flush()
    return sanitize({...value,name:target.name,source:target.source,pendingRestart:[...market.pendingRestart],installation:market.installationSnapshot(operation,{done:true,phase:value.application})})
  }
  context=await check()
  if(cancelled())return finish(cancelled())
  log(`[official] checking ${row.spec}`)
  let preflightFailure=false
  if(typeof manager?.inspect==='function'){
    let inspection
    try{inspection=await manager.inspect(row.spec)}catch(error){
      if(!unavailable(error))throw error
      inspection={problem:error.code,reason:error.message}
    }
    if(inspection?.problem||inspection?.bundle===false){
      const code=inspection.problem??'not-a-bundle'
      preflightFailure=unavailable({code})
      raw={application:'failed',changed:false,stage:'install',packageResult:{kind:preflightFailure?(['timeout','not-found','no-matching-version'].includes(code)?code:'network'):'unknown'},error:{code:'official-inspect-rejected',problem:code,diagnostic:inspection.reason}}
    }else if(row.source==='npm'){
      if(inspection?.name&&inspection.name!==row.name||row.version&&inspection?.version&&inspection.version!==row.version)throw new MarketError('preview-stale',409)
      if(exactVersion(inspection?.version)){row.version=inspection.version;row.spec=`${row.name}@${row.version}`}
    }
  }
  if(cancelled())return finish(cancelled())
  if(!raw){
    context=await check()
    if(cancelled())return finish(cancelled())
    operation.managerStarted=true;operation.phase='installing';operation.cancellable=typeof manager.cancelInstall==='function'
    log(`[official] installing ${row.spec}`)
    // A rejected/lost call has no confirmed outcome and must not start another installation.
    raw=await manager.installBundle(row.spec,{requestId:market.requestId,enabled:true,...(preview.pendingBuilds?{approvedBuilds:[...preview.pendingBuilds]}:{})})
  }
  result=normalizeResult(raw)
  log(`[official] ${result.ok?'installed':result.packageResult?.kind??result.application}`)
  if(result.ok||cancelled()||preview.pendingBuilds||operation.applicationStarted||!(preflightFailure||raw?.changed===false&&retryInstall(result)))return finish(result)
  operation.managerStarted=false;operation.phase='checking';operation.cancellable=true
  context=await check()
  if(cancelled())return finish(cancelled())
  log('[fallback] official failed; checking market sources')
  let fallback
  const fallbackArgs={...preview.fallbackArgs,...(exactVersion(row.version)?{version:row.version}:{})}
  try{fallback=await market.inspect(fallbackArgs)}catch(error){
    if(cancelled())return finish(cancelled())
    log(`[fallback] ${error.code??'internal'}`)
    return finish({...result,sourcesExhausted:true,error:{code:error.code??'internal',...error.extra}})
  }
  if(cancelled()){market.previews.entries.delete(fallback.previewId);return finish(cancelled())}
  if(fallback.preview.requiresCompatibilityConsent){
    log('[fallback] waiting for compatibility confirmation')
    return finish({...result,fallbackPreview:fallback})
  }
  const next=market.previews.get(fallback.previewId)
  market.previews.entries.delete(fallback.previewId)
  if(!next)throw new MarketError('preview-expired',409)
  next.sourceAttempts=[{source:'official',code:result.packageResult?.kind??'failed'},...(next.sourceAttempts??[])]
  const installed=await market.installWithSources(next.row,next,context,operation,body)
  return finish(installed.result,installed.row,next)
}
