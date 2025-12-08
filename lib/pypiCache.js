// Simple in-memory cache for PyPI JSON responses.
// Keys: `${name}@${version||"latest"}`
const cache = new Map()
const DEFAULT_TTL = 1000 * 60 * 60 * 6 // 6 hours

function makeKey(name, version) {
  return `${name.toLowerCase()}@${version ? version : 'latest'}`
}

async function fetchPackageJson(name, version) {
  const vSegment = version && version !== 'latest' ? `/${encodeURIComponent(version)}` : ''
  const url = `https://pypi.org/pypi/${encodeURIComponent(name)}${vSegment}/json`
  const r = await fetch(url)
  if (r.status !== 200) throw new Error(`fetch ${url} -> ${r.status}`)
  return await r.json()
}

async function getPackage(name, version, { ttl = DEFAULT_TTL } = {}) {
  const key = makeKey(name, version)
  const now = Date.now()
  const entry = cache.get(key)
  if (entry && (now - entry.fetchedAt) < ttl) {
    return entry.data
  }
  try {
    const data = await fetchPackageJson(name, version)
    cache.set(key, { data, fetchedAt: now })
    return data
  } catch (err) {
    // store failure entry with short TTL to avoid hammering
    cache.set(key, { data: null, fetchedAt: now - (ttl - 1000) })
    throw err
  }
}

async function getSimpleIndex({ ttl = DEFAULT_TTL } = {}) {
  const key = '__simple_index__'
  const now = Date.now()
  const entry = cache.get(key)
  if (entry && (now - entry.fetchedAt) < ttl) return entry.data
  const r = await fetch('https://pypi.org/simple/')
  if (r.status !== 200) throw new Error('simple index fetch failed')
  const text = await r.text()
  const names = Array.from(text.matchAll(/<a[^>]*>([^<]+)<\/a>/g)).map(m => m[1])
  cache.set(key, { data: names, fetchedAt: now })
  return names
}

module.exports = { getPackage, getSimpleIndex }
