/** Bounded process-only TTL cache; clear invalidates in-flight insertion as well. */
export class Cache {
  constructor({ttl=900000,max=500,now=Date.now}={}) { this.ttl=ttl;this.max=max;this.now=now;this.entries=new Map();this.pending=new Map();this.generation=0 }
  get(key) {
    const e=this.entries.get(key)
    if (!e) return undefined
    if(this.now()>=e.expires){this.entries.delete(key);return undefined}
    return e.value
  }
  set(key,value) {
    this.entries.delete(key);this.entries.set(key,{value,expires:this.now()+this.ttl})
    while(this.entries.size>this.max)this.entries.delete(this.entries.keys().next().value)
    return value
  }
  async load(key,fn) {
    const cached=this.get(key);if(cached!==undefined)return cached
    if(this.pending.has(key))return this.pending.get(key)
    const gen=this.generation
    const p=Promise.resolve().then(fn).then(v=>{if(gen===this.generation)this.set(key,v);return v})
    this.pending.set(key,p)
    try{return await p}finally{if(this.pending.get(key)===p)this.pending.delete(key)}
  }
  clear(){this.generation++;this.entries.clear();this.pending.clear()}
}
