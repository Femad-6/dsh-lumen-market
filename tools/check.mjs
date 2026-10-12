import {readdirSync,readFileSync,existsSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {join,resolve} from 'node:path'
import {spawnSync} from 'node:child_process'
const root=fileURLToPath(new URL('..',import.meta.url))
const files=directory=>readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(join(directory,entry.name)):entry.name.endsWith('.js')||entry.name.endsWith('.mjs')?[join(directory,entry.name)]:[])
for(const path of [...files(join(root,'lib')),...files(join(root,'tools'))]){
  const result=spawnSync(process.execPath,['--check',path],{encoding:'utf8'})
  if(result.status!==0)throw new Error(result.stderr||result.error?.message||`syntax check failed: ${path}`)
}
const manifest=JSON.parse(readFileSync(join(root,'package.json'),'utf8'))
for(const path of [manifest.main,manifest.icon,manifest.dsh?.bundle?.patch,...Object.values(manifest.exports)]){
  if(typeof path!=='string'||!resolve(root,path).startsWith(root)||!existsSync(resolve(root,path)))throw new Error(`missing or unsafe package entry: ${path}`)
}
console.log('Syntax and package entries checked.')
