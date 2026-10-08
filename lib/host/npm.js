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
  constructor({http=new HTTP(),registries=async()=>registriesOf()}={}){this.http=http;this.registries=registries;this.searchCache=new Cache({ttl:300000});this.cache=new Cache()}
  async query(path,dead=new Set()) {
    let error=new MarketError('registry-unavailable',502)
    for(const registry of await this.registries()){
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
    return fresh?run():this.cache.load(key,run)
  }
  async search(q='',page=1) {
    q=validateQuery(q,page)
    return this.searchCache.load(`${q}:${page}`,async()=>{
      const dead=new Set()
      const {data}=await this.query(`/-/v1/search?text=${encodeURIComponent(q||'dsh-plugin')}&size=20&from=${(page-1)*20}`,dead)
      if(!Array.isArray(data?.objects))throw new MarketError('invalid-response',502)
      const rows=await mapLimit(data.objects.slice(0,20),3,async item=>{
        const name=item?.package?.name
        if(!packageName(name))return null
        try{return await this.detail(name,undefined,{dead})}
        catch(e){return {id:`npm:${name}`,name,source:'npm',description:plainText(item.package.description),descriptionSource:'npm',links:safeLinks({name}),validation:'unverified',error:e.code??'network'}}
      })
      return {rows:rows.filter(r=>r && r.validation!=='not-plugin'),page,total:Number.isFinite(data.total)?data.total:0,coverage:'npm-keyword-candidates'}
    })
  }
  clear(){this.searchCache.clear();this.cache.clear()}
}
