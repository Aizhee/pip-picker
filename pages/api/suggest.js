let cache = { names: null, fetchedAt: 0 }
const CACHE_TTL = 1000 * 60 * 60 * 6 // 6 hours

async function fetchSimpleIndex() {
  const r = await fetch('https://pypi.org/simple/')
  if (r.status !== 200) throw new Error('simple index fetch failed')
  const text = await r.text()
  // simple parse: <a href="...">package-name</a>
  const names = Array.from(text.matchAll(/<a[^>]*>([^<]+)<\/a>/g)).map(m => m[1])
  return names
}

export default async function handler(req, res) {
  const q = (req.query.q || '').trim().toLowerCase()
  if (!q) return res.status(400).json({ error: 'missing query' })

  try {
    const now = Date.now()
    if (!cache.names || (now - cache.fetchedAt) > CACHE_TTL) {
      const names = await fetchSimpleIndex()
      cache.names = names
      cache.fetchedAt = now
    }

    const matches = cache.names.filter(n => n.toLowerCase().startsWith(q)).slice(0, 50)
    return res.json({ suggestions: matches })
  } catch (err) {
    console.error('suggest error', err)
    return res.status(500).json({ error: 'internal' })
  }
}
