import {DISCOVERY_PAGE_SIZE} from './core.js'
import { Cache } from './cache.js'
import { HTTP, mapLimit } from './http.js'
import { MarketError, packageName, plainText, validateQuery } from './core.js'
import { safeLinks } from './links.js'
import { manifestRow } from './npm.js'

const API='https://api.github.com'
const REPO=/^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}\/[a-zA-Z0-9_.-]{1,100}$/
const starCount=info=>Number.isSafeInteger(info?.stargazers_count)&&info.stargazers_count>=0?info.stargazers_count:null
const DAY=86400000,WEEKLY_LIMIT=50
function weeklyCount(history,now,createdAt){
  const invalid=()=>{throw new MarketError('invalid-star-history',502)}
  if(!Array.isArray(history)||!history.length||history.length>2)return invalid()
  const buckets=new Map()
  for(const [index,item] of history.entries()){
    if(!Number.isSafeInteger(item?.week)||item.week<=0||!Array.isArray(item.days)||item.days.length!==7||item.days.some(n=>!Number.isSafeInteger(n)||n<0)||item.total!==item.days.reduce((a,b)=>a+b,0))return invalid()
    if(index&&history[index-1].week-item.week!==604800)return invalid()
    item.days.forEach((count,day)=>buckets.set(item.week*1000+day*DAY,count))
  }
  const week=history[0].week*1000
  if(now<week||now>=week+7*DAY)return invalid()
  // The API supplies calendar-day buckets, not individual star timestamps.
  const end=week+Math.floor((now-week)/DAY)*DAY,start=end-7*DAY,created=Date.parse(createdAt)
  let count=0
  for(let day=start;day<end;day+=DAY){
    if(!buckets.has(day)&&!(Number.isFinite(created)&&day+DAY<=created))return invalid()
    count+=buckets.get(day)??0
  }
  if(!Number.isSafeInteger(count))return invalid()
  return count
}
export function repoKey(value) {
  if(typeof value!=='string')return null
  let s=value.trim()
  if(s.startsWith('https://')){
    try{const u=new URL(s);if(u.hostname!=='github.com'||u.port||u.username||u.password||u.search||u.hash)return null;s=u.pathname.replace(/^\/|\/$/g,'')}catch{return null}
  }
  s=s.replace(/\.git$/,'')
  return REPO.test(s) && !s.split('/').some(p=>/^\.+$/.test(p))?s:null
}
function filePath(value,allowPattern=false){
  if(typeof value!=='string')throw new MarketError('unverified')
  const p=value.replace(/^\.\//,'')
  if(!p || p.length>256 || /[\\:?#\x00-\x1f]/.test(p) || (!allowPattern && p.includes('*')) || p.startsWith('/') || p.split('/').some(s=>!s||s==='.'||s==='..'))throw new MarketError('unverified')
  return p
}
function exportPaths(value,out=[],allowPattern=false){
  if(value===null || value===undefined)return out
  if(typeof value==='string')out.push(filePath(value,allowPattern))
  else if(typeof value==='object'){for(const v of Object.values(value))exportPaths(v,out,allowPattern)}
  else throw new MarketError('unverified')
  return out
}
function matchesExportPattern(pattern,path){
  const parts=pattern.split('*')
  const width=(path.length-parts.reduce((size,part)=>size+part.length,0))/(parts.length-1)
  if(!Number.isInteger(width) || width<0)return false
  const replacement=path.slice(parts[0].length,parts[0].length+width)
  return parts.join(replacement)===path
}
export class GithubSource {
  constructor({http=new HTTP(),token=null,now=Date.now}={}){this.http=http;this.token=token;this.now=now;this.blockedUntil=0;this.searchCache=new Cache({ttl:300000,now});this.cache=new Cache({now});this.weeklyCache=new Cache({ttl:900000,max:10,now})}
  async get(path,{maxBytes=524288,apiVersion='2022-11-28'}={}){
    if(this.now()<this.blockedUntil)throw new MarketError('rate-limited',502,{retryAt:this.blockedUntil})
    const headers={'accept':'application/vnd.github+json','user-agent':'dsh-lumen-market/0.6.0','x-github-api-version':apiVersion}
    if(this.token)headers.authorization=`Bearer ${this.token}`
    try{return await this.http.json(API+path,{headers,maxBytes})}
    catch(e){if(e.code==='rate-limited')this.blockedUntil=e.extra?.retryAt??this.now()+60000;throw e}
  }
  candidate(info){
    const repo=repoKey(info?.full_name)
    if(!repo)throw new MarketError('invalid-response',502)
    return {id:`github:${repo}`,repo,name:repo,source:'github',description:plainText(info.description),descriptionSource:'GitHub',links:safeLinks({},{source:'github',repo}),validation:'unverified',stars:starCount(info)}
  }
  async search(q='',page=1,{sort='default'}={}){
    q=validateQuery(q,page)
    if(!['default','updated','stars','forks','weekly-stars'].includes(sort))throw new MarketError('invalid-sort')
    if(sort==='weekly-stars')return this.weeklySearch(q,page)
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
  async weeklySearch(q,page){
    const ranking=await this.weeklyCache.load(q,async()=>{
      const repo=repoKey(q)
      if(!repo&&/^https?:|^[^\s]+\/[^\s]+/.test(q))throw new MarketError('invalid-repository')
      const terms=q.split(/\s+/).filter(Boolean).map(t=>`"${t.replace(/["\\]/g,'')}"`).join(' ')
      const data=repo?{items:[await this.get(`/repos/${repo}`)],total_count:1}:await this.get(`/search/repositories?q=${encodeURIComponent(`${terms} topic:dsh-plugin`.trim())}&sort=stars&order=desc&per_page=${WEEKLY_LIMIT}&page=1`,{maxBytes:4194304})
      if(!Array.isArray(data.items))throw new MarketError('invalid-response',502)
      const candidates=[...new Map(data.items.slice(0,WEEKLY_LIMIT).filter(item=>repoKey(item.full_name)).map(item=>[item.full_name.toLowerCase(),item])).values()]
      const checkedAt=this.now(),failures=[]
      const rows=await mapLimit(candidates,3,async info=>{
        const row=this.candidate(info)
        try{
          const history=await this.get(`/repos/${row.repo}/stargazers/history?per_page=2`,{apiVersion:'2026-03-10'})
          return {...row,weeklyStars:weeklyCount(history,checkedAt,info.created_at)}
        }catch(error){
          if(error.code==='disposed')throw error
          failures.push(error);return {...row,weeklyStars:null,weeklyError:error.code??'network'}
        }
      })
      if(rows.length&&failures.length===rows.length)throw failures[0]
      rows.sort((a,b)=>(b.weeklyStars??-1)-(a.weeklyStars??-1)||(b.stars??-1)-(a.stars??-1)||a.repo.localeCompare(b.repo))
      return {rows,weekly:{candidateLimit:WEEKLY_LIMIT,candidates:rows.length,measured:rows.length-failures.length,failed:failures.length,totalMatches:Number.isSafeInteger(data.total_count)?data.total_count:null,checkedAt},coverage:repo?'exact-repository':'topic:dsh-plugin',incomplete:data.incomplete_results===true}
    })
    return {...ranking,rows:ranking.rows.slice((page-1)*DISCOVERY_PAGE_SIZE,page*DISCOVERY_PAGE_SIZE),page,sort:'weekly-stars',total:ranking.rows.length,hasMore:page*DISCOVERY_PAGE_SIZE<ranking.rows.length}
  }
  async detail(input,{sha:fixed,fresh=false}={}){
    const repo=repoKey(input)
    if(!repo || (fixed!==undefined && !/^[a-f0-9]{40}$/i.test(fixed)))throw new MarketError('invalid-repository')
    const run=async()=>{
      let count=0
      const request=(path,options)=>{if(++count>12)throw new MarketError('unverified');return this.get(path,options)}
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
        exportPaths(manifest.exports,paths,true)
        if(manifest.dsh.client)exportPaths(manifest.exports?.['./client']??'./lib/client.js',paths)
        const unique=[...new Set(paths)]
        const patterns=unique.filter(path=>path.includes('*')),files=unique.filter(path=>!path.includes('*'))
        if((patterns.length?1:files.length)+count>12)throw new MarketError('unverified')
        if(patterns.length){
          // Export patterns are Node subpath mappings, not literal Contents API paths.
          const tree=await request(`/repos/${repo}/git/trees/${sha}?recursive=1`,{maxBytes:4194304})
          if(tree.truncated || !Array.isArray(tree.tree))throw new MarketError('unverified')
          const artifacts=tree.tree.filter(entry=>entry?.type==='blob' && ['100644','100755'].includes(entry.mode) && typeof entry.path==='string').map(entry=>entry.path)
          if(files.some(path=>!artifacts.includes(path)))throw new MarketError('not-found',404)
          for(const pattern of patterns){
            if(!artifacts.some(path=>matchesExportPattern(pattern,path) && filePath(path)===path))throw new MarketError('not-found',404)
          }
        }else{
          await mapLimit(files,3,async path=>{const metadata=await file(path);if(metadata.type!=='file')throw new MarketError('unverified')})
        }
        row.spec=`github:${repo}#${sha}`
      }catch(e){
        if(e.code==='rate-limited'||e.code==='network'||e.code==='disposed')throw e
        row.validation=e.code==='not-found'?'missing-artifacts':'unverified';row.error=e.code??'unverified'
      }
      return row
    }
    return fresh?run():this.cache.load(`${repo}:${fixed??'default'}`,run)
  }
  clear(){this.cache.clear();this.searchCache.clear();this.weeklyCache.clear()}
}
