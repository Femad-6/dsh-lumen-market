import { Cache } from './cache.js'
import { HTTP, mapLimit } from './http.js'
import { MarketError, packageName, exactVersion, plainText, validateQuery, redact } from './core.js'
import { safeLinks } from './links.js'

export function registriesOf(info={}) {
  const values=[info.registry??info.resolved,...(info.fallbackRegistries??[])]
  if(!values.some(v=>typeof v==='string'&&v.trim()))values.push('https://registry.npmjs.org','https://registry.npmmirror.com')
  return [...new Set(values.filter(v=>{try{return ['https:','http:'].includes(new URL(v).protocol)}catch{return false}}).map(v=>v.replace(/\/+$/,'')))]
}
export function manifestRow(manifest,{source='npm',repo,sha,registry}={}) {
  const bundle=typeof manifest?.dsh?.bundle?.patch==='string' && !!manifest.dsh.bundle.patch.trim()
  return {id:source==='github'?`github:${repo}`:`npm:${manifest.name}`,name:manifest.name,source,repo,sha,version:manifest.version??null,description:plainText(manifest.description),descriptionSource:'package.json',links:safeLinks(manifest,{source,repo,sha}),manifest,registry:registry?redact(registry):undefined,validation:bundle?'bundle':manifest.dsh?.client?'client-only':'not-plugin',spec:source==='npm'&&bundle?`${manifest.name}@${manifest.version}`:null}
}
export class NpmSource {
  constructor({http=new HTTP(),registries=async()=>registriesOf(),now=Date.now}={}){
    this.http=http;this.registries=registries
    this.registryCache=new Cache({ttl:30000,max:1,now})
    this.searchCache=new Cache({ttl:300000,max:32,now});this.cache=new Cache({now})
  }
  async query(path,dead=new Set()) {
    let error=new MarketError('registry-unavailable',502)
    for(const registry of await this.registryCache.load('registries',()=>this.registries())){
      if(dead.has(registry))continue
      try{return {data:await this.http.json(`${registry}${path}`,{maxBytes:path.startsWith('/-/')?4194304:524288}),registry}}
      catch(e){error=e;if(e.code==='network')dead.add(registry)}
    }
    throw error
  }
  async detail(name,version,{fresh=false,dead}={}) {
    if(!packageName(name) || (version!==undefined && !exactVersion(version)))throw new MarketError('invalid-target')
    const key=`${name}@${version??'latest'}`
    const run=async()=>{
      const {data,registry}=await this.query(`/${encodeURIComponent(name)}/${version??'latest'}`,dead)
      if(data?.name!==name || !exactVersion(data?.version) || (version!==undefined && data.version!==version))throw new MarketError('invalid-manifest',502)
      return manifestRow(data,{registry})
    }
    if(fresh){this.registryCache.clear();return run()}
    return this.cache.load(key,run)
  }
  async search(q='',page=1) {
    q=validateQuery(q,page)
    const state=await this.searchCache.load(q,async()=>{
      const dead=new Set()
      const state={rows:[],seen:new Set(),offset:0,exhausted:false,limited:false,incomplete:false,dead,queue:Promise.resolve(),coverage:'npm-keyword-candidates'}
      if(packageName(q)){
        try{
          const exact=await this.detail(q,undefined,{dead})
          if(exact.validation!=='not-plugin'){state.rows.push(exact);state.exhausted=true;state.coverage='npm-exact-package'}
        }catch(e){if(e.code!=='not-found')throw e}
      }
      return state
    })
    // Serialize scans for the same query so concurrent pagination cannot duplicate offsets.
    const scan=async()=>{
      const end=page*20;let batches=0
      while(state.rows.length<=end&&!state.exhausted&&batches<3){
        const {data}=await this.query(`/-/v1/search?text=${encodeURIComponent(q||'dsh-plugin')}&size=20&from=${state.offset}`,state.dead)
        if(!Array.isArray(data?.objects))throw new MarketError('invalid-response',502)
        const items=data.objects.slice(0,20)
        const rows=await mapLimit(items,3,async item=>{
          const name=item?.package?.name
          if(!packageName(name))return null
          try{return await this.detail(name,undefined,{dead:state.dead})}
          catch(e){return {id:`npm:${name}`,name,source:'npm',description:plainText(item.package.description),descriptionSource:'npm',links:safeLinks({name}),validation:'unverified',error:e.code??'network'}}
        })
        for(const row of rows){if(row&&row.validation!=='not-plugin'&&!state.seen.has(row.id)){state.seen.add(row.id);state.rows.push(row)}}
        state.offset+=items.length;batches++
        if(items.length<20&&(!Number.isFinite(data.total)||state.offset<data.total))state.incomplete=true
        state.exhausted=items.length<20||(Number.isFinite(data.total)&&state.offset>=data.total)
        if(state.offset>=500&&!state.exhausted){state.exhausted=true;state.limited=true}
      }
      return {rows:state.rows.slice((page-1)*20,end),page,total:state.rows.length,totalExact:state.exhausted&&!state.limited&&!state.incomplete,hasMore:state.rows.length>end,scanned:state.offset,scanLimited:state.limited||(!state.exhausted&&state.rows.length<=end),incomplete:state.incomplete,coverage:state.coverage}
    }
    const pending=state.queue.then(scan);state.queue=pending.then(()=>{},()=>{})
    return pending
  }
  clear(){this.searchCache.clear();this.cache.clear();this.registryCache.clear()}
}
