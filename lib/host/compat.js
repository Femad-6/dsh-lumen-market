import semver from 'semver'
import { exactVersion } from './core.js'

export function evaluateCompatibility(manifest, runtime, exemptions={}, nodeVersion=process.versions.node) {
  const out={verdict:'unknown',reason:'undeclared',peers:{},constraints:{},requirements:{},checked:0,exempted:false}
  const object=value=>value&&typeof value==='object'&&!Array.isArray(value)
  if(!object(manifest))return {...out,verdict:'incompatible',malformed:true,reason:'malformed'}
  let malformed=false,nonPeerConflict=false,unexemptableConflict=false,hasDshEngine=false
  const check=(key,range,{peer=false,node=false}={})=>{
    if(!node)out.checked++
    out.requirements[key]=typeof range==='string'?range:null
    const version=node?nodeVersion:runtime
    const workspace=peer&&['workspace:^','workspace:~','workspace:*'].includes(range)
    const requirement=workspace?runtime:range
    if(typeof range!=='string'||range.length>2048||!range.trim()||!workspace&&!semver.validRange(range)){
      malformed=true;out.constraints[key]=typeof range==='string'?range:null;return
    }
    if(!exactVersion(version))return
    if(!semver.satisfies(version,requirement,{includePrerelease:true})){
      if(peer)out.peers[key.slice('peerDependencies.'.length)]=range
      else{out.constraints[key]=range;nonPeerConflict=true;if(node||key==='dsh.compatibility.dsh')unexemptableConflict=true}
    }
  }
  if(Object.hasOwn(manifest,'engines')){
    if(!object(manifest.engines))malformed=true
    else{
      if(Object.hasOwn(manifest.engines,'node'))check('engines.node',manifest.engines.node,{node:true})
      if(Object.hasOwn(manifest.engines,'dsh')){hasDshEngine=true;check('engines.dsh',manifest.engines.dsh)}
    }
  }
  if(object(manifest.dsh)&&Object.hasOwn(manifest.dsh,'compatibility')){
    if(!object(manifest.dsh.compatibility))malformed=true
    else if(Object.hasOwn(manifest.dsh.compatibility,'dsh'))check('dsh.compatibility.dsh',manifest.dsh.compatibility.dsh)
  }
  if(Object.hasOwn(manifest,'peerDependencies')){
    if(!object(manifest.peerDependencies)||Object.values(manifest.peerDependencies).some(range=>typeof range!=='string'))malformed=true
    else if(!hasDshEngine)for(const [name,range] of Object.entries(manifest.peerDependencies))if(name==='@deepseek-ai/dsh'||name.startsWith('@deepseek-ai/dsh-'))check('peerDependencies.'+name,range,{peer:true})
  }
  if(malformed)return {...out,verdict:'incompatible',malformed:true,reason:'malformed'}
  if(nonPeerConflict||Object.keys(out.peers).length){
    out.verdict='incompatible';out.reason='conflict'
    out.exempted=!unexemptableConflict&&Array.isArray(exemptions[`${manifest.name}@${manifest.version}`])&&exemptions[`${manifest.name}@${manifest.version}`].includes(runtime)
  }else if(!exactVersion(runtime))out.reason='runtime-unknown'
  else if(Object.hasOwn(out.requirements,'engines.node')&&!exactVersion(nodeVersion))out.reason='runtime-unknown'
  else if(out.checked){out.verdict='compatible';out.reason='declared'}
  return out
}
