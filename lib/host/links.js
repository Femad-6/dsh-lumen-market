import { packageName } from './core.js'

export function safeURL(value) {
  if (typeof value !== 'string' || value.length > 2048) return undefined
  try {
    const u = new URL(value)
    if (!['https:','http:'].includes(u.protocol) || u.username || u.password) return undefined
    return u.href.replace(/\/$/,'')
  } catch { return undefined }
}
export function repositoryURL(value) {
  let raw = typeof value === 'object' && value ? value.url : value
  if (typeof raw !== 'string') return undefined
  raw=raw.replace(/^git\+https:/,'https:').replace(/^git@github\.com:/,'https://github.com/').replace(/^ssh:\/\/git@github\.com\//,'https://github.com/').replace(/\.git(?:#.*)?$/,'')
  return safeURL(raw)
}
export function safeLinks(manifest={}, {source='npm',repo,sha}={}) {
  const repository = source==='github' && /^[\w.-]+\/[\w.-]+$/.test(repo??'') ? `https://github.com/${repo}` : repositoryURL(manifest.repository)
  const homepage = safeURL(manifest.homepage)
  const links={}
  if (homepage) links.homepage=homepage
  if (repository) {
    links.repository=repository
    links.readme=source==='github' && /^[a-f0-9]{40}$/i.test(sha??'') ? `${repository}/tree/${sha}` : repository
  }
  if (source==='npm' && packageName(manifest.name)) links.npm=`https://www.npmjs.com/package/${manifest.name}`
  return links
}
