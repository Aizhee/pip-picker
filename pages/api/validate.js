function parseReqString(s) {
  // Very small parser: extracts name and simple specifier text
  // examples: "numpy (>=1.20)" or "pandas" or "scikit-learn (==1.2.0)"
  if (!s) return null
  const m = s.match(/^\s*([A-Za-z0-9_.-]+)\s*(?:\(([^)]+)\))?/) || []
  return { name: (m[1] || '').toLowerCase(), spec: (m[2] || '').trim() }
}

function parseSpecifiers(spec) {
  if (!spec) return []
  // split on commas or semicolons
  const parts = spec.split(/[,;]|\s+and\s+/i).map(p => p.trim()).filter(Boolean)
  const specs = []
  for (const p of parts) {
    const m = p.match(/^([<>=!~]{1,2})\s*(.+)$/)
    if (m) specs.push({ op: m[1], ver: m[2].trim() })
  }
  return specs
}

function cmpVersion(a, b) {
  if (a === b) return 0
  const pa = String(a).split('.').map(x => (isNaN(x) ? x : Number(x)))
  const pb = String(b).split('.').map(x => (isNaN(x) ? x : Number(x)))
  const n = Math.max(pa.length, pb.length)
  for (let i = 0; i < n; i++) {
    const va = pa[i] === undefined ? 0 : pa[i]
    const vb = pb[i] === undefined ? 0 : pb[i]
    if (typeof va === 'number' && typeof vb === 'number') {
      if (va < vb) return -1
      if (va > vb) return 1
    } else {
      const sa = String(va)
      const sb = String(vb)
      if (sa < sb) return -1
      if (sa > sb) return 1
    }
  }
  return 0
}

function specifiersToBounds(specs) {
  // returns { lower: {ver, inclusive}, upper: {ver, inclusive} }
  let lower = null
  let upper = null
  for (const s of specs) {
    const op = s.op
    const v = s.ver
    if (!v) continue
    if (op === '>') {
      if (!lower || cmpVersion(v, lower.ver) > 0) lower = { ver: v, inclusive: false }
    } else if (op === '>=') {
      if (!lower || cmpVersion(v, lower.ver) > 0 || (cmpVersion(v, lower.ver) === 0 && !lower.inclusive)) lower = { ver: v, inclusive: true }
    } else if (op === '<') {
      if (!upper || cmpVersion(v, upper.ver) < 0) upper = { ver: v, inclusive: false }
    } else if (op === '<=') {
      if (!upper || cmpVersion(v, upper.ver) < 0 || (cmpVersion(v, upper.ver) === 0 && !upper.inclusive)) upper = { ver: v, inclusive: true }
    } else if (op === '==') {
      // exact: set both bounds
      lower = { ver: v, inclusive: true }
      upper = { ver: v, inclusive: true }
    } else if (op === '~=' || op === '~') {
      // approximate: treat as >=v and < next major (simple heuristic)
      const parts = v.split('.')
      const major = Number(parts[0]) || 0
      lower = { ver: v, inclusive: true }
      const nextMajor = String(major + 1)
      upper = { ver: `${nextMajor}.0`, inclusive: false }
    }
  }
  return { lower, upper }
}

function boundsOverlap(aBounds, bBounds) {
  // aBounds and bBounds are {lower, upper}
  // if either has no bounds then assume overlap
  if (!aBounds || !bBounds) return true
  const aLow = aBounds.lower
  const aUp = aBounds.upper
  const bLow = bBounds.lower
  const bUp = bBounds.upper

  // Check if a.upper < b.lower or b.upper < a.lower
  if (aUp && bLow) {
    const c = cmpVersion(aUp.ver, bLow.ver)
    if (c < 0) return false
    if (c === 0 && (!aUp.inclusive || !bLow.inclusive)) return false
  }
  if (bUp && aLow) {
    const c = cmpVersion(bUp.ver, aLow.ver)
    if (c < 0) return false
    if (c === 0 && (!bUp.inclusive || !aLow.inclusive)) return false
  }
  return true
}

function specifierOverlap(a, b) {
  // if either empty, assume overlap
  if (!a || !b) return true
  const aSpecs = parseSpecifiers(a)
  const bSpecs = parseSpecifiers(b)
  if (aSpecs.length === 0 || bSpecs.length === 0) return true
  const aBounds = specifiersToBounds(aSpecs)
  const bBounds = specifiersToBounds(bSpecs)
  return boundsOverlap(aBounds, bBounds)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' })
  const body = req.body
  const pkgs = Array.isArray(body.packages) ? body.packages : []
  const pythonVersion = body.python_version || null
  if (!pkgs.length) return res.status(400).json({ error: 'no packages' })

  // fetch metadata for each (use shared cache to avoid repeated network calls)
  const metaMap = {}
  try {
    const { getPackage } = require('../../lib/pypiCache')
    for (const p of pkgs) {
      const name = p.name
      const version = (p.version && p.version !== 'latest') ? p.version : ''
      try {
        const data = await getPackage(name, version)
        if (!data) {
          metaMap[name.toLowerCase()] = { error: 'not found', requires: [], info: {} }
          continue
        }
        const requires = (data.info && data.info.requires_dist) || []
        const info = data.info || {}
        metaMap[name.toLowerCase()] = { requires, info }
      } catch (err) {
        console.error('fetch meta error', err)
        metaMap[name.toLowerCase()] = { error: 'fetch error', requires: [], info: {} }
      }
    }
  } catch (err) {
    console.error('cache/import error', err)
  }

  // parse dependencies
  const parsed = {}
  for (const [name, info] of Object.entries(metaMap)) {
    parsed[name] = (info.requires || []).map(r => parseReqString(r)).filter(Boolean)
  }

  // check pairwise compatibility
  const results = []
  for (const p of pkgs) {
    const name = p.name
    const nameKey = name.toLowerCase()
    let status = 'ok'
    const details = []

    // python version checks: look at classifiers if provided
    try {
      const cls = (metaMap[nameKey] && metaMap[nameKey].info && metaMap[nameKey].info.classifiers) || []
      const pyClassifiers = cls.filter(c => c.startsWith('Programming Language :: Python'))
      if (pythonVersion && pyClassifiers.length > 0) {
        const wanted = `Programming Language :: Python :: ${pythonVersion}`
        const major = `Programming Language :: Python :: ${pythonVersion.split('.').slice(0,2).join('.')}`
        const matches = pyClassifiers.some(c => c === wanted || c.startsWith(`Programming Language :: Python :: ${pythonVersion.split('.')[0]}`))
        if (!matches) {
          details.push(`package classifiers do not explicitly list Python ${pythonVersion}`)
          if (status !== 'conflict') status = 'warning'
        }
      }
    } catch (err) {
      // ignore
    }

    // does this package require any other selected package with a specifier incompatible with selected version?
    const reqs = parsed[nameKey] || []
    for (const other of pkgs) {
      if (other.name.toLowerCase() === nameKey) continue
      // check if reqs mentions other
      const mention = reqs.find(r => r.name === other.name.toLowerCase())
      if (mention && mention.spec) {
        // if other has explicit selected version, check overlap
        if (other.version && other.version !== 'latest') {
          const ok = specifierOverlap(mention.spec, `== ${other.version}`)
          if (!ok) {
            status = 'conflict'
            details.push(`${name} requires ${other.name} ${mention.spec} (selected ${other.version})`)
          }
        } else {
          details.push(`${name} requires ${other.name} ${mention.spec}`)
          if (status !== 'conflict') status = 'warning'
        }
      }
    }


    // also check common dependencies between packages
    for (const other of pkgs) {
      if (other.name.toLowerCase() === nameKey) continue
      const otherReqs = parsed[other.name.toLowerCase()] || []
      for (const r1 of reqs) {
        for (const r2 of otherReqs) {
          if (r1.name && r2.name && r1.name === r2.name) {
            const overlap = specifierOverlap(r1.spec, r2.spec)
            if (!overlap) {
              status = 'conflict'
              details.push(`Conflicting specifiers for ${r1.name}: ${name}(${r1.spec}) vs ${other.name}(${r2.spec})`)
            }
          }
        }
      }
    }

    // include parsed requires so frontend can show dependencies among selected packages
    results.push({ name, version: p.version || 'latest', status, details, requires: reqs })
  }

  const overall = results.every(r => r.status === 'ok')
  return res.json({ overallCompatible: overall, python_version: pythonVersion || null, packages: results })
}
