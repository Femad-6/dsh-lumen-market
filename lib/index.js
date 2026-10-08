import { fileURLToPath } from 'node:url'
import { Profile } from './host/profile.js'
import { HTTP } from './host/http.js'
import { NpmSource, registriesOf } from './host/npm.js'
import { GithubSource } from './host/github.js'
import { Market } from './host/market.js'
import { createRoute, ROUTE } from './host/route.js'

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
  const market=new Market({npm,github,profile,manager,http})
  ctx.effect(()=>{
    const unregister=ctx.webServer.register({kind:'prefix',path:ROUTE,handler:createRoute(market)})
    return ()=>{unregister();market.dispose()}
  },'lumen-market: route and requests')
}
