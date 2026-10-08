import { MarketError } from './core.js'

export async function readJSON(fetchImpl,url,{maxBytes=524288,signal,headers={}}={}) {
  const response=await fetchImpl(url,{headers:{accept:'application/json',...headers},signal,redirect:'error'})
  if(!response.ok){
    await response.body?.cancel().catch(()=>{})
    const reset=Number(response.headers.get('x-ratelimit-reset'))*1000
    const retry=response.headers.get('retry-after')
    const retryAt=retry ? (/^\d+$/.test(retry)?Date.now()+Number(retry)*1000:Date.parse(retry)) : reset
    throw new MarketError(response.status===404?'not-found':response.status===403||response.status===429?'rate-limited':`http-${response.status}`,502,{retryAt:Number.isFinite(retryAt)&&retryAt>Date.now()?retryAt:Date.now()+60000})
  }
  if(Number(response.headers.get('content-length'))>maxBytes){await response.body?.cancel().catch(()=>{});throw new MarketError('response-too-large',502)}
  if(!response.body)throw new MarketError('empty-response',502)
  const reader=response.body.getReader();const chunks=[];let size=0
  try{
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes)throw new MarketError('response-too-large',502);chunks.push(Buffer.from(value))}
    try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{throw new MarketError('invalid-response',502)}
  }finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
}
export class HTTP {
  constructor({fetchImpl=fetch,timeout=10000}={}){this.fetch=fetchImpl;this.timeout=timeout;this.controller=new AbortController()}
  json(url,options={}) {
    if(this.controller.signal.aborted)throw new MarketError('disposed',503)
    return readJSON(this.fetch,url,{...options,signal:AbortSignal.any([this.controller.signal,AbortSignal.timeout(this.timeout)])}).catch(e=>{if(e instanceof MarketError)throw e;throw new MarketError(this.controller.signal.aborted?'disposed':'network',502)})
  }
  dispose(){this.controller.abort()}
}
export async function mapLimit(items,limit,fn){
  const result=new Array(items.length);let cursor=0
  await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{while(cursor<items.length){const i=cursor++;result[i]=await fn(items[i],i)}}))
  return result
}
