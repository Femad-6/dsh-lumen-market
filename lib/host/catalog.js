import {mkdir,readFile,writeFile,rename,stat} from 'node:fs/promises'
import {join,resolve,relative,sep} from 'node:path'
import {createHash,randomUUID} from 'node:crypto'
import {gunzipSync} from 'node:zlib'
import {isIP} from 'node:net'
import {MarketError,packageName,exactVersion} from './core.js'
import {repoKey} from './github.js'
import {manifestRow} from './npm.js'

const MAX=64*1024*1024,JSON_MAX=512*1024
const hash=bytes=>'sha512-'+createHash('sha512').update(bytes).digest('base64')
const bad=()=>{throw new MarketError('invalid-source')}
const canonical=entry=>`https://codeload.github.com/${entry.repo}/tar.gz/${entry.sha}`
export async function catalogOrigin(dir,name,specifier,version){
  if(typeof specifier!=='string'||!specifier.startsWith('file:'))return null
  const parts=relative(resolve(dir,'.lumen-market','archives'),resolve(dir,specifier.slice(5))).split(sep)
  if(parts.length!==1||!(/^[a-f0-9]{128}\.tgz$/).test(parts[0]))return null
  try{
    const file=join(dir,'.lumen-market','archives',parts[0]),entry=JSON.parse(await readFile(file+'.json','utf8'))
    if(entry.name!==name||entry.version!==version||!repoKey(entry.repo)||!/^[a-f0-9]{40}$/.test(entry.sha)||entry.integrity!=='sha512-'+Buffer.from(parts[0].slice(0,-4),'hex').toString('base64'))return null
    if((await stat(file)).size>MAX||hash(await readFile(file))!==entry.integrity)return null
    return {repo:entry.repo,sha:entry.sha}
  }catch{return null}
}
export function sourceURL(value){
  try{
    const u=new URL(value),host=u.hostname.replace(/^\[|\]$/g,'')
    if(u.protocol!=='https:'||u.port||u.username||u.password||u.hash||u.search||isIP(host)||!host.includes('.')||host==='localhost'||/\.(localhost|local|internal)$/.test(host))return bad()
    return u.href
  }catch{return bad()}
}
function validate(data){
  if(data?.schemaVersion!==1||!Array.isArray(data.entries)||data.entries.length>200)return bad()
  const feeds=data.feeds===undefined?[]:data.feeds
  if(!Array.isArray(feeds)||feeds.length>10)return bad()
  const seen=new Set()
  return {schemaVersion:1,...(feeds.length?{feeds:[...new Set(feeds.map(sourceURL))]}:{}),entries:data.entries.map(value=>{
    const repo=repoKey(value?.repo)
    if(!repo||!/^[a-f0-9]{40}$/.test(value.sha??'')||!packageName(value.name)||!exactVersion(value.version)||seen.has(repo.toLowerCase()))return bad()
    seen.add(repo.toLowerCase())
    const entry={repo,sha:value.sha,name:value.name,version:value.version}
    if(!Array.isArray(value.downloads)||!value.downloads.length||value.downloads.length>5)return bad()
    entry.downloads=value.downloads.map(item=>{
      const url=sourceURL(item?.url),integrity=item?.integrity
      if(integrity!==undefined&&!/^sha512-[A-Za-z0-9+/]{86}==$/.test(integrity)||!integrity&&url!==canonical(entry))return bad()
      return {url,...(integrity?{integrity}:{})}
    })
    return entry
  })}
}
function tarFiles(bytes){
  let tar
  try{tar=gunzipSync(bytes,{maxOutputLength:128*1024*1024})}catch{throw new MarketError('invalid-source-archive',409)}
  const files=new Map();let root=null,paxPath=null
  for(let offset=0;offset+512<=tar.length;){
    const head=tar.subarray(offset,offset+512);if(head.every(v=>v===0))break
    const text=(start,end)=>head.subarray(start,end).toString('utf8').split('\0')[0]
    const size=parseInt(text(124,136).trim(),8),type=text(156,157)||'0'
    const checksum=parseInt(text(148,156).trim(),8)
    if(!Number.isSafeInteger(size)||size<0||offset+512+size>tar.length||[...head].reduce((sum,v,i)=>sum+(i>=148&&i<156?32:v),0)!==checksum)throw new MarketError('invalid-source-archive',409)
    const body=tar.subarray(offset+512,offset+512+size);offset+=512+Math.ceil(size/512)*512
    if(type==='g'||type==='x'){
      // PAX paths are length-prefixed UTF-8 records; reject unsupported sparse/link metadata.
      let cursor=0
      while(cursor<body.length){const space=body.indexOf(32,cursor),length=Number(body.subarray(cursor,space).toString());if(space<cursor||!Number.isSafeInteger(length)||length<=space-cursor+1||cursor+length>body.length)throw new MarketError('invalid-source-archive',409);const record=body.subarray(space+1,cursor+length-1).toString();if(record.startsWith('path=')&&type==='x')paxPath=record.slice(5);else if(/^(path=|linkpath=|size=|GNU\.)/.test(record))throw new MarketError('invalid-source-archive',409);cursor+=length}
      continue
    }
    if(!['0','5'].includes(type))throw new MarketError('invalid-source-archive',409)
    const prefix=text(345,500),path=(paxPath??(prefix?prefix+'/':'')+text(0,100)).replace(/\/$/,'');paxPath=null
    const parts=path.split('/')
    if(parts.some(part=>!part||part==='.'||part==='..')||/[\\:\x00-\x1f]/.test(path)||parts.length<1)throw new MarketError('invalid-source-archive',409)
    root??=parts[0];if(parts[0]!==root)throw new MarketError('invalid-source-archive',409)
    if(type==='0'){const key=parts.slice(1).join('/');if(!key||files.has(key)||files.size>=20000)throw new MarketError('invalid-source-archive',409);files.set(key,body)}
  }
  return files
}
function verify(bytes,entry){
  const files=tarFiles(bytes);let manifest
  try{const data=files.get('package.json');if(!data||data.length>JSON_MAX)throw 0;manifest=JSON.parse(data.toString('utf8'))}catch{throw new MarketError('invalid-source-archive',409)}
  if(manifest.name!==entry.name||manifest.version!==entry.version||typeof manifest.dsh?.bundle?.patch!=='string')throw new MarketError('source-package-mismatch',409)
  const paths=[]
  const collect=value=>{if(typeof value==='string')paths.push(value);else if(value&&typeof value==='object')Object.values(value).forEach(collect)}
  collect(manifest.exports);collect(manifest.main??(manifest.exports?null:'index.js'));collect(manifest.dsh.bundle.patch)
  if(manifest.dsh.client)collect(manifest.exports?.['./client']??'./lib/client.js')
  if(paths.length>100||!paths.length)throw new MarketError('missing-artifacts',409)
  for(const value of paths){const path=value.replace(/^\.\//,'');if(!path||path.split('/').some(p=>!p||p==='.'||p==='..')||/[\\:\x00-\x1f]/.test(path))throw new MarketError('missing-artifacts',409);const parts=path.split('*');const matches=file=>{if(parts.length===1)return file===path;const width=(file.length-parts.reduce((sum,p)=>sum+p.length,0))/(parts.length-1);if(!Number.isInteger(width)||width<0)return false;return parts.join(file.slice(parts[0].length,parts[0].length+width))===file};if(![...files.keys()].some(matches))throw new MarketError('missing-artifacts',409)}
  return manifest
}

/** Explicitly maintained, profile-local sources. Archives are read, never extracted or executed here. */
export class SourceCatalog {
  constructor({fetchImpl=fetch}={}){this.fetch=fetchImpl;this.queue=Promise.resolve();this.pending=new Map()}
  async list(dir){
    const file=join(dir,'.lumen-market','sources.json')
    try{if((await stat(file)).size>JSON_MAX)throw new MarketError('invalid-source');return validate(JSON.parse(await readFile(file,'utf8')))}catch(e){if(e.code==='ENOENT')return {schemaVersion:1,entries:[]};throw e}
  }
  async import(dir,data,{expected=null,feed=null}={}){
    const incoming=validate(data)
    const task=this.queue.then(async()=>{
      const current=await this.list(dir),entries=new Map(current.entries.map(e=>[e.repo.toLowerCase(),e]))
      if(expected&&JSON.stringify(entries.get(incoming.entries[0].repo.toLowerCase()))!==expected)return current
      incoming.entries.forEach(e=>entries.set(e.repo.toLowerCase(),e))
      const feeds=[...new Set([...(current.feeds??[]),...(incoming.feeds??[]),...(feed?[feed]:[])])]
      const merged=validate({schemaVersion:1,entries:[...entries.values()],...(feeds.length?{feeds}:{})})
      const folder=join(dir,'.lumen-market'),file=join(folder,'sources.json');await mkdir(folder,{recursive:true})
      const text=JSON.stringify(merged,null,2)+'\n';if(Buffer.byteLength(text)>JSON_MAX)throw new MarketError('invalid-source')
      await writeFile(file+'.tmp',text,{mode:0o600});await rename(file+'.tmp',file);return merged
    })
    this.queue=task.catch(()=>{});return task
  }
  async download(url,max=MAX){
    const response=await this.fetch(sourceURL(url),{redirect:'error',signal:AbortSignal.timeout(max===JSON_MAX?15000:120000)})
    if(!response.ok||!response.body)throw new MarketError('network',502)
    if(Number(response.headers.get('content-length'))>max){await response.body.cancel();throw new MarketError('package-too-large',409)}
    const reader=response.body.getReader(),chunks=[];let size=0
    try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max)throw new MarketError('package-too-large',409);chunks.push(Buffer.from(value))}}finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
    return Buffer.concat(chunks)
  }
  async update(dir,url){
    let data;try{data=JSON.parse((await this.download(url,JSON_MAX)).toString('utf8'))}catch(e){if(e instanceof MarketError)throw e;throw new MarketError('invalid-source')}
    return this.import(dir,data,{feed:sourceURL(url)})
  }
  async search(dir,q='',page=1){
    const exact=repoKey(q)?.toLowerCase(),term=q.toLowerCase().trim()
    const entries=(await this.list(dir)).entries.filter(e=>exact?e.repo.toLowerCase()===exact:!term||`${e.repo} ${e.name}`.toLowerCase().includes(term))
    return {rows:entries.slice((page-1)*21,page*21).map(e=>({id:`github:${e.repo}`,name:e.name,repo:e.repo,sha:e.sha,version:e.version,source:'github',validation:'unverified',catalog:true,description:'',links:{repository:`https://github.com/${e.repo}`}})),total:entries.length,hasMore:page*21<entries.length,coverage:'configured-sources'}
  }
  async remember(dir,row){
    const entry={repo:row.repo,sha:row.sha,name:row.name,version:row.version,downloads:[{url:canonical(row)}]}
    validate({schemaVersion:1,entries:[entry]})
    const bytes=await this.download(canonical(entry));verify(bytes,entry)
    entry.downloads[0].integrity=hash(bytes)
    await this.storeArchive(dir,bytes)
    return this.import(dir,{schemaVersion:1,entries:[entry]})
  }
  async storeArchive(dir,bytes){
    const folder=join(dir,'.lumen-market','archives'),name=createHash('sha512').update(bytes).digest('hex')+'.tgz',file=join(folder,name)
    await mkdir(folder,{recursive:true});const temp=file+'.'+randomUUID()+'.tmp';await writeFile(temp,bytes,{mode:0o600});await rename(temp,file);return file
  }
  async resolve(dir,repo,sha){
    const entry=(await this.list(dir)).entries.find(e=>e.repo.toLowerCase()===repoKey(repo)?.toLowerCase()&&(!sha||e.sha===sha))
    if(!entry)return null
    const key=JSON.stringify([dir,entry])
    if(this.pending.has(key))return this.pending.get(key)
    const run=async()=>{
      let error=new MarketError('source-unavailable',502)
      for(const item of entry.downloads){
        try{
          let bytes,file
          if(item.integrity){file=join(dir,'.lumen-market','archives',Buffer.from(item.integrity.slice(7),'base64').toString('hex')+'.tgz');try{if((await stat(file)).size<=MAX)bytes=await readFile(file);if(bytes&&hash(bytes)!==item.integrity)bytes=null}catch{}}
          if(!bytes)bytes=await this.download(item.url)
          if(item.integrity&&hash(bytes)!==item.integrity)throw new MarketError('package-integrity',409)
          const manifest=verify(bytes,entry);file=await this.storeArchive(dir,bytes)
          await writeFile(file+'.json',JSON.stringify({repo:entry.repo,sha:entry.sha,name:entry.name,version:entry.version,integrity:hash(bytes)}),{mode:0o600})
          if(!item.integrity){const expected=JSON.stringify(entry);item.integrity=hash(bytes);await this.import(dir,{schemaVersion:1,entries:[entry]},{expected})}
          return {...manifestRow(manifest,{source:'github',repo:entry.repo,sha:entry.sha}),spec:`github:${entry.repo}#${entry.sha}`,archivePath:file,archiveIntegrity:hash(bytes),catalog:true}
        }catch(e){error=e instanceof MarketError?e:new MarketError('network',502)}
      }
      throw error
    }
    const task=run();this.pending.set(key,task);try{return await task}finally{this.pending.delete(key)}
  }
}
