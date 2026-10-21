import { fileURLToPath } from 'node:url'
import { Profile } from './host/profile.js'
import { HTTP } from './host/http.js'
import { NpmSource, registriesOf } from './host/npm.js'
import { GithubSource } from './host/github.js'
import { Market } from './host/market.js'
import { createRoute, ROUTE } from './host/route.js'
import { SearchSnapshots } from './host/snapshots.js'
import { Reinstaller } from './host/reinstall.js'

export const name='lumenMarket'
export const inject=['webServer']
export function apply(ctx){
  const optional=service=>{try{return ctx.get(service)}catch{return undefined}}
  const manager=()=>optional('pluginManager')
  const http=new HTTP()
  const profile=new Profile({hmrBaseDir:()=>optional('hmr')?.baseDir,moduleDir:fileURLToPath(new URL('..',import.meta.url))})
  const npm=new NpmSource({http,registries:async()=>{try{return registriesOf(await manager()?.registries?.())}catch{return registriesOf()}}})
  const token=process.env.DSH_LUMEN_MARKET_GITHUB_TOKEN?.trim()||null
  const github=new GithubSource({http,token:['off','none','false','0'].includes(token?.toLowerCase())?null:token})
  const upgradeCapability=()=>{
    try{return ctx.get('hmr')!==undefined?{supported:false,reason:'profile-running'}:{supported:true}}
    catch{return {supported:false,reason:'capability-unknown'}}
  }
  const reinstaller=new Reinstaller({npm,fetchImpl:http.fetch})
  const market=new Market({npm,github,profile,manager,reinstaller,upgradeCapability,http,snapshots:new SearchSnapshots({disk:true})})
  ctx.effect(()=>{
    const offProgress=ctx.on?.('plugin-manager/install-state',event=>market.progress(event))
    const unregister=ctx.webServer.register({kind:'prefix',path:ROUTE,handler:createRoute(market)})
    return ()=>{if(typeof offProgress==='function')offProgress();unregister();market.dispose()}
  },'lumen-market: route and requests')
}
