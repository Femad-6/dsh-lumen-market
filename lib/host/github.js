import {DISCOVERY_PAGE_SIZE} from './core.js'
import { Cache } from './cache.js'
import { HTTP, mapLimit } from './http.js'
import { MarketError, packageName, plainText, validateQuery } from './core.js'
import { safeLinks } from './links.js'
import { manifestRow } from './npm.js'

const API='https://api.github.com'
const REPO=/^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}\/[a-zA-Z0-9_.-]{1,100}$/
const starCount=info=>Number.isSafeInteger(info?.stargazers_count)&&info.stargazers_count>=0?info.stargazers_count:null
export function repoKey(value) {
  if(typeof value!=='string')return null
  let s=value.trim()
  if(s.startsWith('https://')){
    try{const u=new URL(s);if(u.hostname!=='github.com'||u.port||u.username||u.password||u.search||u.hash)return null;s=u.pathname.replace(/^\/|\/$/g,'')}catch{return null}
  }
  s=s.replace(/\.git$/,'')
  return REPO.test(s) && !s.split('/').some(p=>/^\.+$/.test(p))?s:null
}
function filePath(value){
  if(typeof value!=='string')throw new MarketError('unverified')
  const p=value.replace(/^\.\//,'')
  if(!p || p.length>256 || /[\\:*?#\x00-\x1f]/.test(p) || p.startsWith('/') || p.split('/').some(s=>!s||s==='.'||s==='..'))throw new MarketError('unverified')
  return p
}
function exportPaths(value,out=[]){
  if(value===null || value===undefined)return out
  if(typeof value==='string')out.push(filePath(value))
  else if(typeof value==='object'){for(const v of Object.values(value))exportPaths(v,out)}
  else throw new MarketError('unverified')
  return out
}
export class GithubSource {
  constructor({http=new HTTP(),token=null,now=Date.now}={}){this.http=http;this.token=token;this.now=now;this.blockedUntil=0;this.searchCache=new Cache({ttl:300000,now});this.cache=new Cache({now})}
  async get(path,{maxBytes=524288}={}){
    if(this.now()<this.blockedUntil)throw new MarketError('rate-limited',502,{retryAt:this.blockedUntil})
    const headers={'accept':'application/vnd.github+json','user-agent':'dsh-lumen-market/0.5.1','x-github-api-version':'2022-11-28'}
    if(this.token)headers.authorization=`Bearer ${this.token}`
    try{return await this.http.json(API+path,{headers,maxBytes})}
    catch(e){if(e.code==='rate-limited')this.blockedUntil=e.extra.retryAt;throw e}
  }
  candidate(info){
    const repo=repoKey(info?.full_name)
    if(!repo)throw new MarketError('invalid-response',502)
    return {id:`github:${repo}`,repo,name:repo,source:'github',description:plainText(info.description),descriptionSource:'GitHub',links:safeLinks({},{source:'github',repo}),validation:'unverified',stars:starCount(info)}
  }
  async search(q='',page=1,{sort='default'}={}){
    q=validateQuery(q,page)
    if(!['default','updated','stars','forks'].includes(sort))throw new MarketError('invalid-sort')
    return this.searchCache.load(JSON.stringify([q,page,sort]),async()=>{
      const repo=repoKey(q)
      if(repo)return {rows:[this.candidate(await this.get(`/repos/${repo}`))],total:1,page:1,sort,coverage:'exact-repository'}
      if(/^https?:|^[^\s]+\/[^\s]+/.test(q))throw new MarketError('invalid-repository')
      // Repository search is intentionally topic-scoped; an exact URL bypasses it.
      const terms=q.split(/\s+/).filter(Boolean).map(t=>`"${t.replace(/["\\]/g,'')}"`).join(' ')
      const query=`${terms} topic:dsh-plugin`.trim()
      const order=sort==='default'?'':`&sort=${sort}&order=desc`
      const data=await this.get(`/search/repositories?q=${encodeURIComponent(query)}${order}&per_page=${DISCOVERY_PAGE_SIZE}&page=${page}`,{maxBytes:4194304})
      if(!Array.isArray(data.items))throw new MarketError('invalid-response',502)
      const rows=data.items.slice(0,DISCOVERY_PAGE_SIZE).filter(i=>repoKey(i.full_name)).map(i=>this.candidate(i))
      return {rows,total:Math.min(Number(data.total_count)||0,1000),page,sort,coverage:'topic:dsh-plugin',incomplete:data.incomplete_results===true}
    })
  }
  async detail(input,{sha:fixed,fresh=false}={}){
    const repo=repoKey(input)
    if(!repo || (fixed!==undefined && !/^[a-f0-9]{40}$/i.test(fixed)))throw new MarketError('invalid-repository')
    const run=async()=>{
      let count=0
      const request=path=>{if(++count>12)throw new MarketError('unverified');return this.get(path)}
      const info=await request(`/repos/${repo}`)
      let sha=fixed
      if(!sha){if(typeof info.default_branch!=='string')throw new MarketError('unverified');sha=(await request(`/repos/${repo}/commits/${encodeURIComponent(info.default_branch)}`)).sha}
      if(!/^[a-f0-9]{40}$/i.test(sha??''))throw new MarketError('unverified')
      const base=`/repos/${repo}/contents/`
      const file=path=>request(`${base}${path.split('/').map(encodeURIComponent).join('/')}?ref=${sha}`)
      let manifest
      try{
        const data=await file('package.json')
        if(data.type!=='file'||data.encoding!=='base64'||typeof data.content!=='string'||data.size>524288)throw new MarketError('unverified')
        const bytes=Buffer.from(data.content,'base64');if(bytes.length>524288)throw new MarketError('response-too-large',502)
        manifest=JSON.parse(bytes.toString('utf8'))
      }catch(e){
        if(['not-found','unverified','response-too-large','invalid-response'].includes(e.code)||e instanceof SyntaxError)return {...this.candidate(info),validation:'unverified',spec:null,error:e.code??'invalid-manifest'}
        throw e
      }
      if(!packageName(manifest?.name))return {...this.candidate(info),validation:manifest?.workspaces?'monorepo':'not-plugin',spec:null}
      const row=manifestRow(manifest,{source:'github',repo,sha});row.spec=null;row.stars=starCount(info)
      if(row.validation!=='bundle')return row
      try{
        const entry=manifest.exports?.['.']??(typeof manifest.exports==='string'?manifest.exports:manifest.main??'index.js')
        const paths=exportPaths(entry)
        if(manifest.main)paths.push(filePath(manifest.main))
        paths.push(filePath(manifest.dsh.bundle.patch))
        exportPaths(manifest.exports,paths)
        if(manifest.dsh.client)exportPaths(manifest.exports?.['./client']??'./lib/client.js',paths)
        const unique=[...new Set(paths)]
        if(unique.length+count>12)throw new MarketError('unverified')
        await mapLimit(unique,3,async path=>{const metadata=await file(path);if(metadata.type!=='file')throw new MarketError('unverified')})
        row.spec=`github:${repo}#${sha}`
      }catch(e){
        if(e.code==='rate-limited'||e.code==='network'||e.code==='disposed')throw e
        row.validation=e.code==='not-found'?'missing-artifacts':'unverified';row.error=e.code??'unverified'
      }
      return row
    }
    return fresh?run():this.cache.load(`${repo}:${fixed??'default'}`,run)
  }
  clear(){this.cache.clear();this.searchCache.clear()}
}
