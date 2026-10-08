import { MarketError, sanitize, validateQuery } from './core.js'

export const ROUTE='/api/lumen-market'
export const HEADER='x-dsh-lumen-market'
const local=address=>['127.0.0.1','::1','::ffff:127.0.0.1'].includes(address)
function bodyOf(req){
  return new Promise((resolve,reject)=>{
    let size=0,chunks=[]
    const finish=(err,value)=>{clearTimeout(timer);req.removeListener('data',data);req.removeListener('end',end);req.removeListener('error',error);req.removeListener('aborted',aborted);err?reject(err):resolve(value)}
    const data=chunk=>{size+=chunk.length;if(size>32768){finish(new MarketError('body-too-large',413));req.resume?.()}else chunks.push(chunk)}
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
      const gets=new Set(['/health','/search','/detail','/installed','/updates']),posts=new Set(['/inspect','/install','/upgrade'])
      if(!gets.has(path)&&!posts.has(path))throw new MarketError('not-found',404)
      if((gets.has(path)&&req.method!=='GET')||(posts.has(path)&&req.method!=='POST'))throw new MarketError('method-not-allowed',405)
      let result
      if(path==='/health')result=market.health()
      else if(path==='/search'){
        const page=Number(url.searchParams.get('page')??1),q=url.searchParams.get('q')??''
        validateQuery(q,page);result=await market.search({q,source:url.searchParams.get('source')??'all',page})
      }else if(path==='/detail'){
        const args=Object.fromEntries(['source','name','repo','version'].map(k=>[k,url.searchParams.get(k)??undefined]))
        if(Object.values(args).some(v=>v!==undefined&&v.length>256))throw new MarketError('invalid-target')
        result=await market.detail(args)
      }else if(path==='/installed')result=await market.installed()
      else if(path==='/updates')result=await market.updates({force:url.searchParams.get('force')==='1'})
      else{
        const body=await bodyOf(req)
        if(path==='/inspect'){
          if(Object.keys(body).some(k=>!['action','source','name','repo','version'].includes(k))||Object.values(body).some(v=>typeof v!=='string'||v.length>256))throw new MarketError('invalid-request')
          result=await market.inspect(body)
        }else result=await market.execute(path.slice(1),body)
      }
      send(res,200,result)
    }catch(e){send(res,e instanceof MarketError?e.status:500,e instanceof MarketError?{ok:false,code:e.code,...e.extra}:{ok:false,code:'internal'})}
  }
}
