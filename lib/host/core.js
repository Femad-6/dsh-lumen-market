import semver from 'semver'

export class MarketError extends Error {
  constructor(code, status = 400, extra = {}) { super(code); this.code = code; this.status = status; this.extra = extra }
}
export const packageName = value => typeof value === 'string' && value.length <= 214 && /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/.test(value)
export const exactVersion = value => typeof value === 'string' && value.length <= 128 && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(value) && semver.valid(value) !== null
export function classifySpecifier(value) {
  const s = String(value ?? '').trim()
  if (/^(?:link|file|workspace|portal):|^[./\\]|^[a-z]:[\\/]/i.test(s)) return 'local'
  if (/^npm:/i.test(s)) return 'alias'
  if (/\.(?:tgz|tar\.gz)(?:[?#]|$)/i.test(s)) return 'tarball'
  if (/^(?:git\+|git:|git@|github:|gitlab:|bitbucket:|gist:|https?:)/i.test(s)) return 'git'
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return 'other'
  return s ? 'registry' : 'other'
}
export function normalizeResult(r) {
  const application = typeof r?.application === 'string' ? r.application : 'failed'
  const ok = ['applied','restart-required','overridden'].includes(application)
  return sanitize({ok,application,changed:r?.changed===true,restartRequired:ok && (r?.changed===true || application==='restart-required'),error:r?.error??null,warnings:r?.warnings??[],pendingBuilds:r?.pendingBuilds??[]})
}
export function redact(value) {
  return String(value).replace(/(https?:\/\/)[^\s/@]+(?::[^\s/@]*)?@/gi,'$1[redacted]@').replace(/([?&](?:token|key|secret|password|auth|credential)=[^\s&#]*)/gi, match => match.split('=')[0]+'=[redacted]')
}
export function sanitize(value, depth=0) {
  if (depth > 12) return null
  if (typeof value === 'string') return redact(value)
  if (Array.isArray(value)) return value.slice(0,500).map(v=>sanitize(v,depth+1))
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key])=> !/^(?:token|githubToken|authorization|password|secret)$/i.test(key)).map(([k,v])=>[k,sanitize(v,depth+1)]))
  return value
}
export function validateQuery(q='',page=1) {
  if (typeof q !== 'string' || q.length > 200 || /[\x00-\x1f]/.test(q)) throw new MarketError('invalid-query')
  if (!Number.isInteger(page) || page < 1 || page > 50) throw new MarketError('invalid-page')
  return q.trim()
}
export const plainText = value => typeof value === 'string' ? value.slice(0,8000) : ''
