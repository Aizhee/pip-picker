export default async function handler(req, res) {
  const q = (req.query.q || '').trim()
  if (!q) return res.status(400).json({ error: 'missing query' })

  // Try direct package metadata from PyPI (use cache)
  try {
    const { getPackage } = require('../../lib/pypiCache')
    const data = await getPackage(q, '')
    if (!data) return res.status(404).json({ error: 'not found' })
    const versions = Object.keys(data.releases || {})
      .sort((a, b) => {
        // semantic-ish comparator: compare numeric parts, fallback to string
        const pa = String(a).split('.').map(x => (isNaN(x) ? x : Number(x)))
        const pb = String(b).split('.').map(x => (isNaN(x) ? x : Number(x)))
        const n = Math.max(pa.length, pb.length)
        for (let i = 0; i < n; i++) {
          const va = pa[i] === undefined ? 0 : pa[i]
          const vb = pb[i] === undefined ? 0 : pb[i]
          if (typeof va === 'number' && typeof vb === 'number') {
            if (va < vb) return 1
            if (va > vb) return -1
          } else {
            const sa = String(va)
            const sb = String(vb)
            if (sa < sb) return 1
            if (sa > sb) return -1
          }
        }
        return 0
      })
    const info = data.info || {}
    const projectUrl = info.home_page || (info.project_urls && info.project_urls.Homepage) || null
    return res.json({ name: info.name || q, versions, description: info.summary || '', project_url: projectUrl })
  } catch (err) {
    console.error('search error', err)
    return res.status(500).json({ error: 'internal' })
  }
}
