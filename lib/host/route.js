import { MarketError, sanitize, validateQuery } from './core.js'

export const ROUTE='/api/lumen-market'
export const HEADER='x-dsh-lumen-market'
const local=address=>['127.0.0.1','::1','::ffff:127.0.0.1'].includes(address)
function bodyOf(req,maxBytes=32768){
  return new Promise((resolve,reject)=>{
    let size=0,chunks=[]
    const finish=(err,value)=>{clearTimeout(timer);req.removeListener('data',data);req.removeListener('end',end);req.removeListener('error',error);req.removeListener('aborted',aborted);err?reject(err):resolve(value)}
    const data=chunk=>{size+=chunk.length;if(size>maxBytes){finish(new MarketError('body-too-large',413));req.resume?.()}else chunks.push(chunk)}
    const end=()=>{try{const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!value||typeof value!=='object'||Array.isArray(value))throw 0;finish(null,value)}catch{finish(new MarketError('invalid-json'))}}
    const error=()=>finish(new MarketError('invalid-request'))
    const aborted=()=>finish(new MarketError('request-aborted'))
    const timer=setTimeout(()=>{finish(new MarketError('body-timeout',408));req.resume?.()},15000)
    req.on('data',data);req.on('end',end);req.on('error',error);req.on('aborted',aborted)
  })
}
function send(res,status,value){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.end(JSON.stringify(sanitize(value)))}
export function createRoute(market){
  return async(req,res)=>{
    try{
      if(!['GET','POST'].includes(req.method))throw new MarketError('method-not-allowed',405)
      if(typeof req.headers[HEADER]!=='string'||!req.headers[HEADER])throw new MarketError('csrf-header-required',403)
      if(req.method==='POST'&&!local(req.socket?.remoteAddress))throw new MarketError('loopback-only',403)
      const url=new URL(req.url,'http://localhost'),path=url.pathname.slice(ROUTE.length)
      if(!url.pathname.startsWith(ROUTE+'/'))throw new MarketError('not-found',404)
      const gets=new Set(['/health','/search','/search-cache','/detail','/installed','/updates','/operation','/backups','/sources']),posts=new Set(['/inspect','/install','/upgrade','/uninstall','/cancel','/backup','/backup-export','/backup-preview','/sources'])
      if(!gets.has(path)&&!posts.has(path))throw new MarketError('not-found',404)
      if(path!=='/sources'&&((gets.has(path)&&req.method!=='GET')||(posts.has(path)&&req.method!=='POST')))throw new MarketError('method-not-allowed',405)
      if(path.startsWith('/backup')||path==='/sources'){
        if(!local(req.socket?.remoteAddress))throw new MarketError('loopback-only',403)
        if(req.headers.origin){let same=false;try{const origin=new URL(req.headers.origin);same=['http:','https:'].includes(origin.protocol)&&origin.host===req.headers.host}catch{}if(!same)throw new MarketError('origin-rejected',403)}
      }
      let result
      if(path==='/health')result=await market.health()
      else if(path==='/sources')result=await market.sources(req.method==='POST'?await bodyOf(req,512*1024):undefined)
      else if(path==='/backups')result=await market.listBackups()
      else if(path==='/operation')result=market.operation({previewId:url.searchParams.get('previewId')??undefined})
      else if(path==='/search'||path==='/search-cache'){
        const page=Number(url.searchParams.get('page')??1),q=url.searchParams.get('q')??''
        const sort=url.searchParams.get('sort')??'default'
        if(!['default','updated','stars','forks','weekly-stars'].includes(sort))throw new MarketError('invalid-sort')
        validateQuery(q,page);result=await market.search({q,source:url.searchParams.get('source')??'all',page,force:url.searchParams.get('force')==='1',sort,cachedOnly:path==='/search-cache'})
      }else if(path==='/detail'){
        const args=Object.fromEntries(['source','name','repo','version'].map(k=>[k,url.searchParams.get(k)??undefined]))
        if(Object.values(args).some(v=>v!==undefined&&v.length>256))throw new MarketError('invalid-target')
        result=await market.detail(args)
      }else if(path==='/installed')result=await market.installed()
      else if(path==='/updates')result=await market.updates({force:url.searchParams.get('force')==='1'})
      else{
        const body=await bodyOf(req,path==='/backup-preview'?512*1024:32768)
        if(path==='/backup'){
          if(Object.keys(body).length)throw new MarketError('invalid-request')
          result=await market.createBackup()
        }else if(path==='/backup-export'){
          if(Object.keys(body).length!==1||typeof body.backupId!=='string')throw new MarketError('invalid-request')
          result=await market.exportBackup(body.backupId)
        }else if(path==='/backup-preview')result=await market.previewBackup(body)
        else if(path==='/inspect'){
          if(Object.keys(body).some(k=>!['action','source','name','repo','version'].includes(k))||Object.values(body).some(v=>typeof v!=='string'||v.length>256))throw new MarketError('invalid-request')
          result=await market.inspect(body)
        }else if(path==='/cancel'){
          if(Object.keys(body).some(k=>k!=='operationId')||typeof body.operationId!=='string'||!body.operationId||body.operationId.length>128)throw new MarketError('invalid-request')
          result=await market.cancel(body)
        }else result=await market.execute(path.slice(1),body)
      }
      send(res,200,result)
    }catch(e){send(res,e instanceof MarketError?e.status:500,e instanceof MarketError?{ok:false,code:e.code,...e.extra}:{ok:false,code:'internal'})}
  }
}
