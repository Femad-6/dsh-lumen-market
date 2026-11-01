import {MarketError,exactVersion,packageName} from './core.js'
import {repoKey} from './github.js'
import {repositoryURL} from './links.js'

export const unavailable=error=>['network','timeout','rate-limited','registry-unavailable','source-unavailable','not-found','http-403','http-404','http-429','http-500','http-502','http-503','http-504'].includes(error?.code)
export const repositoryOf=row=>repoKey(row?.repo??repositoryURL(row?.manifest?.repository)?.replace(/^github:/,''))?.toLowerCase()??repoKey(typeof row?.manifest?.repository==='string'?row.manifest.repository.replace(/^github:/,''):null)?.toLowerCase()??null
export function samePackageName(left,right,repo){
  if(left===right)return true
  if(!repo||!packageName(left)||!packageName(right))return false
  const prefix=`@${repo.split('/')[0].toLowerCase()}/`
  return left===prefix+right||right===prefix+left
}
function repositoryPackageNames(repo,hint){
  const key=repoKey(repo)?.toLowerCase()
  if(!key)return []
  const [owner,slug]=key.split('/')
  const bare=packageName(hint)?hint:slug
  const prefix=`@${owner}/`
  return [...new Set([bare,...(!bare.startsWith('@')?[prefix+bare]:bare.startsWith(prefix)?[bare.slice(prefix.length)]:[]),prefix+slug])].filter(packageName)
}
export function exhausted(attempts,last){
  return attempts.length>1?new MarketError('install-sources-exhausted',502,{sourceAttempts:attempts}):last??new MarketError('source-unavailable',502,{sourceAttempts:attempts})
}
export async function installRegistries(manager,row){
  let info
  try{info=await manager.registries?.()}catch{}
  // Pass the registry that supplied the checked metadata through to the official pipeline.
  const values=[row.registry,info?.registry,...(info?.fallbackRegistries??[]),info?.resolved]
  const seen=new Set(),result=[]
  for(const value of values){
    if(typeof value!=='string')continue
    try{
      const url=new URL(value)
      if(!['http:','https:'].includes(url.protocol))continue
      const key=url.href.replace(/\/+$/,'')
      if(!seen.has(key)){seen.add(key);result.push(value)}
    }catch{}
  }
  return result.length?result:[undefined]
}

/** Lazy alternatives: never ask another source after a successful installation.
 * Cross-source package names alone are insufficient: repository and exact version must agree.
 */
export async function* installCandidates(market,args,context,{first=null,attempts=[],onAttempt=()=>{}}={}){
  let original=first?.row,last,produced=false
  const fail=(source,error,name)=>{last=error;const attempt={source,...(name?{package:name}:{}),code:error.code??'network'};attempts.push(attempt);onAttempt(attempt)}
  const npmTried=new Set()
  if(args.source==='npm')npmTried.add(args.name)
  const npmForRepository=async function*(hint,version,repo=repositoryOf(args)){
    for(const name of repositoryPackageNames(repo,hint)){
      if(npmTried.has(name))continue
      npmTried.add(name)
      try{
        const row=await market.npm.detail(name,version,{fresh:true})
        if(row.name!==name||version&&row.manifest?.version!==version||repositoryOf(row)!==repoKey(repo)?.toLowerCase())throw new MarketError('source-package-mismatch',409)
        original??=row;produced=true;yield {row,cachedMetadata:null}
      }catch(error){fail('npm',error,name)}
    }
  }
  if(!first&&args.source==='github')yield* npmForRepository(args.name,args.version)
  if(first){produced=true;yield first}
  else{
    try{
      const resolved=await market.resolveTarget(args,context,{fresh:true,allowCache:true})
      if((args.version&&resolved.row.manifest?.version!==args.version)||(original&&(!samePackageName(resolved.row.name,original.name,repositoryOf(original))||resolved.row.manifest?.version!==original.manifest?.version)))throw new MarketError('source-package-mismatch',409)
      if(args.source==='github')yield* npmForRepository(resolved.row.name,resolved.row.manifest.version)
      original??=resolved.row;produced=true;yield resolved
    }catch(error){if(!unavailable(error))throw error;fail(args.source,error)}
  }
  const repo=repositoryOf(original)??repositoryOf(args)
  let name=original?.name??(packageName(args.name)?args.name:null)
  let version=original?.manifest?.version??args.version
  let entries=[]
  if(market.catalog?.list){
    try{entries=(await market.catalog.list(context.profile.dir)).entries.filter(e=>(!repo||e.repo.toLowerCase()===repo)&&(!name||samePackageName(e.name,name,repo))&&(!version||e.version===version))}
    catch(error){fail('catalog',error)}
  }
  if(repo&&!name&&entries.length){name=entries[0].name;version??=entries[0].version}
  if(repo&&!name){const slug=repo.split('/')[1];if(packageName(slug))name=slug}
  const targets=[]
  // Direct GitHub targets may still have a usable archive mirror. Preserve their commit.
  if(!original?.catalog)for(const entry of entries){
    if(!name||!samePackageName(entry.name,name,repo)||entry.version!==version)continue
    if(args.source==='github'&&args.sha&&entry.sha!==args.sha)continue
    targets.push({source:'catalog',repo:entry.repo,sha:entry.sha})
  }
  if(name)yield* npmForRepository(name,version,repo)
  if(args.source==='npm'&&repo)targets.push({source:'github',repo,version})
  for(const target of targets){
    market.assertActive()
    if(market.operationState?.cancelRequested&&market.busy)return
    try{
      onAttempt({source:target.source,code:'trying'})
      const row=target.source==='catalog'?await market.catalog.resolve(context.profile.dir,target.repo,target.sha):
        target.source==='npm'?await market.npm.detail(target.name,target.version,{fresh:true}):await market.github.detail(target.repo,{fresh:true})
      if(!row||!packageName(row.name)||!exactVersion(row.manifest?.version)||!samePackageName(row.name,name,repo)||version&&row.manifest.version!==version||repo&&repositoryOf(row)!==repo)throw new MarketError('source-package-mismatch',409)
      produced=true;yield {row,cachedMetadata:null}
    }catch(error){fail(target.source,error)}
  }
  if(!produced)throw exhausted(attempts,last)
}

export function retryInstall(result){
  return result.application==='failed'&&!result.changed&&[null,'install','package'].includes(result.stage)&&
    ['network','timeout','not-found','no-matching-version'].includes(result.packageResult?.kind)
}
