import { readFileSync } from 'node:fs'
import { join, dirname, isAbsolute } from 'node:path'
import { classifySpecifier, packageName, exactVersion, MarketError, plainText } from './core.js'
import { safeLinks } from './links.js'
import { reinstallOrigin } from './reinstall.js'
import { catalogOrigin } from './catalog.js'

function read(path){try{return JSON.parse(readFileSync(path,'utf8'))}catch{return null}}
export class Profile {
  constructor({argv=process.argv,env=process.env,hmrBaseDir=()=>null,moduleDir=''}={}) {this.signals={argv,env,hmrBaseDir,moduleDir}}
  resolution(){
    const {argv,env,hmrBaseDir,moduleDir}=this.signals
    const home=env.DSH_HOME || join(env.USERPROFILE||env.HOME||'','.dsh'), candidates=[]
    for(let i=argv.length-1;i>=0;i--){
      const s=argv[i]
      if(s==='--profile' && argv[i+1])candidates.push({dir:isAbsolute(argv[i+1])?argv[i+1]:join(home,'profiles',argv[i+1]),evidence:'argv:--profile'})
      else if(s.startsWith('--profile=')){const p=s.slice(10);candidates.push({dir:isAbsolute(p)?p:join(home,'profiles',p),evidence:'argv:--profile='})}
      else if(/[\\/]/.test(s))candidates.push({dir:s,evidence:`argv[${i}]`})
    }
    const hmr=typeof hmrBaseDir==='function'?hmrBaseDir():hmrBaseDir
    if(hmr)candidates.push({dir:hmr,evidence:'hmr.baseDir'})
    if(env.DSH_PROFILE_DIR)candidates.push({dir:env.DSH_PROFILE_DIR,evidence:'env:DSH_PROFILE_DIR'})
    if(env.DSH_PROFILE)candidates.push({dir:join(home,'profiles',env.DSH_PROFILE),evidence:'env:DSH_PROFILE'})
    let ancestor=moduleDir
    for(let i=0;ancestor&&i<4;i++){ancestor=dirname(ancestor);candidates.push({dir:ancestor,evidence:'module-ancestor'})}
    const seen=new Set(),rejected=[]
    for(const c of candidates){const k=c.dir.replace(/\\/g,'/').toLowerCase();if(seen.has(k))continue;seen.add(k)
      const m=read(join(c.dir,'package.json'))
      if(m?.dsh?.profile && typeof m.dsh.profile==='object' && !Array.isArray(m.dsh.profile))return {...c,rejected}
      rejected.push(c)
    }
    return {dir:null,evidence:null,rejected}
  }
  async snapshot(manager){
    const profile=this.resolution()
    if(!profile.dir)throw new MarketError('profile-not-found',503,{rejected:profile.rejected})
    const bundles=await manager?.listBundles?.()??[]
    // Read disk after async service calls so source validation uses the newest local state.
    const manifest=read(join(profile.dir,'package.json'))
    if(!manifest)throw new MarketError('profile-unreadable',503)
    const shipped=new Map(bundles.map(b=>[b.name,b]))
    const selected=new Set(Array.isArray(manifest.dsh?.profile?.bundles)?manifest.dsh.profile.bundles:[])
    const dependencies=manifest.dependencies??{}
    const rows=[]
    for(const [name,specifier] of Object.entries(dependencies)){
      if(!packageName(name))continue
      const pkg=read(join(profile.dir,'node_modules',name,'package.json'))??{}
      const known=shipped.get(name),origin=await reinstallOrigin(profile.dir,name,specifier,pkg.version),gitOrigin=await catalogOrigin(profile.dir,name,specifier,pkg.version),source=gitOrigin?'git':origin?'tarball':classifySpecifier(specifier)
      if(known?.installed===false){
        rows.push({id:`installed:${name}`,name,source:'shipped',installed:known.version??null,description:plainText(known.description),descriptionSource:'package.json',links:{},bundle:selected.has(name),enabled:known.enabled!==false})
        continue
      }
      rows.push({id:`installed:${name}`,name,source,...(origin?{npmOrigin:origin}:{}),...(gitOrigin?{gitOrigin}:{}),specifier,installed:pkg.version??(exactVersion(specifier)?specifier:null),description:plainText(pkg.description||known?.description),descriptionSource:'package.json',links:safeLinks({...pkg,name},{source:gitOrigin?'github':source==='registry'||origin?'npm':source,...(gitOrigin?gitOrigin:{})}),bundle:selected.has(name),enabled:known?.enabled!==false,removable:known?.removable===true,manifest:pkg})
    }
    for(const name of selected){if(Object.hasOwn(dependencies,name))continue;const b=shipped.get(name)
      rows.push({id:`installed:${name}`,name,source:'shipped',installed:b?.version??null,description:plainText(b?.description),descriptionSource:'package.json',links:{},bundle:true,enabled:b?.enabled!==false})}
    return {profile,rows,dependencies:{...dependencies},bundleOrder:[...selected],runtimeVersion:bundles.find(b=>b.name==='@deepseek-ai/dsh-base')?.version??null}
  }
}
