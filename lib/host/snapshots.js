import {mkdirSync,readFileSync,writeFileSync,renameSync,statSync} from 'node:fs'
import {join,isAbsolute} from 'node:path'
import {sanitize} from './core.js'

const MAX_BYTES=8*1024*1024
/** Successful search pages only. Expired/network-failed queries never erase these snapshots. */
export class SearchSnapshots {
  constructor({disk=false,max=80,now=Date.now}={}){this.disk=disk;this.max=max;this.now=now;this.profiles=new Map()}
  entries(dir){
    if(this.profiles.has(dir))return this.profiles.get(dir)
    const entries=new Map()
    if(this.disk&&isAbsolute(dir)){
      try{
        const path=join(dir,'.lumen-market','search-cache.json')
        if(statSync(path).size<=MAX_BYTES){
          const data=JSON.parse(readFileSync(path,'utf8'))
          if(data.version===1&&Array.isArray(data.entries))for(const [key,value] of data.entries.slice(-this.max)){
            if(typeof key==='string'&&Number.isFinite(value?.checkedAt)&&Array.isArray(value?.found?.rows)&&value.found.rows.every(row=>row&&typeof row.name==='string'&&['npm','github'].includes(row.source)))entries.set(key,sanitize(value))
          }
        }
      }catch{}
    }
    this.profiles.set(dir,entries);return entries
  }
  get(dir,key){return this.entries(dir).get(key)??null}
  save(dir,key,found){
    const entries=this.entries(dir),value=sanitize({checkedAt:this.now(),found})
    entries.delete(key);entries.set(key,value)
    while(entries.size>this.max)entries.delete(entries.keys().next().value)
    if(!this.disk)return true
    if(!isAbsolute(dir))return false
    try{
      const folder=join(dir,'.lumen-market'),path=join(folder,'search-cache.json')
      let data=JSON.stringify({version:1,entries:[...entries]})
      while(Buffer.byteLength(data)>MAX_BYTES&&entries.size>1){entries.delete(entries.keys().next().value);data=JSON.stringify({version:1,entries:[...entries]})}
      if(Buffer.byteLength(data)>MAX_BYTES)return false
      mkdirSync(folder,{recursive:true})
      writeFileSync(path+'.tmp',data,{mode:0o600});renameSync(path+'.tmp',path)
      return true
    }catch{return false}
  }
}
