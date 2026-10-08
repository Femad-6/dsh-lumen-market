/** Read-only public API smoke. Never creates a manager or installs any package. */
import { HTTP } from '../lib/host/http.js'
import { NpmSource } from '../lib/host/npm.js'
import { GithubSource } from '../lib/host/github.js'
const http=new HTTP(),npm=new NpmSource({http}),github=new GithubSource({http})
const summarize=row=>({id:row.id,name:row.name,version:row.version,validation:row.validation,sha:row.sha??null,links:row.links})
const checks=[
  ['npm-manifest',()=>npm.detail('dsh-compat-market')],
  ['github-search',()=>github.search('market',1)],
  ['github-repository',()=>github.detail('lpf0404/dsh-compat-market')],
]
const results=await Promise.all(checks.map(async([check,run])=>{
  try{const data=await run();return {check,ok:true,...(data.rows?{total:data.total,candidates:data.rows.length,sample:data.rows.slice(0,3).map(summarize)}:{row:summarize(data)})}}
  catch(e){return {check,ok:false,code:e.code??'internal',...e.extra}}
}))
http.dispose()
console.log(JSON.stringify({checkedAt:new Date().toISOString(),installationAttempted:false,results},null,2))
