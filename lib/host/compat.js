import semver from 'semver'
import { exactVersion } from './core.js'

export function evaluateCompatibility(manifest, runtime, exemptions={}) {
  const out={verdict:'unknown',peers:{},checked:0,exempted:false}
  if(!exactVersion(runtime))return out
  out.verdict='compatible'
  if(!Object.hasOwn(manifest??{},'peerDependencies'))return out
  const peers=manifest.peerDependencies
  if(!peers || typeof peers!=='object' || Array.isArray(peers) || Object.values(peers).some(v=>typeof v!=='string'))return {...out,verdict:'incompatible',malformed:true}
  for(const [name,range] of Object.entries(peers)) {
    if(name!=='@deepseek-ai/dsh' && !name.startsWith('@deepseek-ai/dsh-'))continue
    out.checked++
    const r=['workspace:^','workspace:~','workspace:*'].includes(range)?runtime:range
    if(!r.trim() || !semver.satisfies(runtime,r,{includePrerelease:true}))out.peers[name]=range
  }
  if(Object.keys(out.peers).length){out.verdict='incompatible';out.exempted=exemptions[`${manifest.name}@${manifest.version}`]?.includes(runtime)===true}
  return out
}
