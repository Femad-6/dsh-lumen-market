import {readdirSync,readFileSync,existsSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {join,resolve} from 'node:path'
import {spawnSync} from 'node:child_process'
import assert from 'node:assert/strict'
import semver from 'semver'
const root=fileURLToPath(new URL('..',import.meta.url))
const files=directory=>readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(join(directory,entry.name)):entry.name.endsWith('.js')||entry.name.endsWith('.mjs')?[join(directory,entry.name)]:[])
for(const path of [...files(join(root,'lib')),...files(join(root,'tools'))]){
  const result=spawnSync(process.execPath,['--check',path],{encoding:'utf8'})
  if(result.status!==0)throw new Error(result.stderr||result.error?.message||`syntax check failed: ${path}`)
}
const manifest=JSON.parse(readFileSync(join(root,'package.json'),'utf8'))
assert.ok(semver.validRange(manifest.engines?.node),'Declare a valid Node.js range')
const compatibility=manifest.dsh?.compatibility
assert.ok(compatibility&&semver.validRange(compatibility.dsh),'Declare a valid DSH range')
assert.ok(Object.keys(compatibility.dshReleases??{}).length,'Declare exact DSH release states')
for(const [version,status] of Object.entries(compatibility.dshReleases)){
  assert.ok(semver.valid(version)&&['compatible','incompatible','unknown'].includes(status),'Invalid DSH release state')
  const operations=compatibility.dshOperations?.[version]
  assert.ok(operations,'Record operation states for each declared release')
  for(const key of ['install','start','uninstall','rollback'])assert.ok(['passed','failed','unknown'].includes(operations[key]),`Invalid ${version} ${key} state`)
}
for(const path of [manifest.main,manifest.icon,manifest.dsh?.bundle?.patch,...Object.values(manifest.exports)]){
  if(typeof path!=='string'||!resolve(root,path).startsWith(root)||!existsSync(resolve(root,path)))throw new Error(`missing or unsafe package entry: ${path}`)
}
console.log('Syntax and package entries checked.')
