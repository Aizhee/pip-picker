import { useEffect, useState, useRef } from 'react'

function PackageSquare({ pkg, onVersionChange, onRemove, selectedNames }) {
  const color = pkg.status === 'ok' ? 'var(--accent-ok)' : pkg.status === 'conflict' ? 'var(--accent-err)' : 'var(--accent-warn)'
  
  const allReqs = pkg.requires || []
  const presentDeps = allReqs.filter(m => selectedNames.has(m.name.toLowerCase()))

  const accentStyle = { borderLeft: `6px solid ${color}` }

  return (
    <div className="pkg-card" style={accentStyle}>
      <div className="pkg-title">
        <strong>{pkg.name}</strong>
        <button onClick={() => onRemove(pkg.name)}>x</button>
      </div>
      <div className="pkg-desc">{pkg.description}</div>
      {pkg.project_url ? (
        <div style={{fontSize:12}}><a href={pkg.project_url} target="_blank" rel="noreferrer">project</a></div>
      ) : null}
      <div>
        <select value={pkg.version || ''} onChange={(e) => onVersionChange(pkg.name, e.target.value)}>
          <option value="">latest</option>
          {pkg.versions?.map(v => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      </div>

      {}
      <div className="pkg-meta">
        {pkg.details && pkg.details.length > 0 ? (
          pkg.details.map((d, i) => (
            <div key={i} style={{color: pkg.status === 'conflict' ? '#ffb4b4' : 'rgba(255,255,255,0.85)'}}>{d}</div>
          ))
        ) : null}
      </div>

      {}
      {presentDeps.length > 0 ? (
        <div className="pkg-deps">
          <em>Deps: {presentDeps.map(m => m.spec ? `${m.name} ${m.spec}` : m.name).join(', ')}</em>
        </div>
      ) : null}
    </div>
  )
}

export default function Home() {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [selected, setSelected] = useState([]) 
  const pythonVersions = [
    ...Array.from({ length: 15 }, (_, i) => `3.${i}`).reverse(),
    ...Array.from({ length: 8 }, (_, i) => `2.${i}`).reverse()
  ]
  const [pythonVersion, setPythonVersion] = useState(() => pythonVersions[0] || '3.11')
  const [loading, setLoading] = useState(false)
  const suggRef = useRef(null)
  const [dragActive, setDragActive] = useState(false)
  const [inputFocused, setInputFocused] = useState(false)
  const fileRef = useRef(null)

  // load Ko-fi overlay widget on client and initialize floating chat button
  useEffect(() => {
    if (typeof window === 'undefined') return
    // if already loaded, just draw
    if (window.kofiWidgetOverlay && typeof window.kofiWidgetOverlay.draw === 'function') {
      try {
        window.kofiWidgetOverlay.draw('aizhee', {
          type: 'floating-chat',
          'floating-chat.donateButton.text': '',
          'floating-chat.donateButton.background-color': '#00000000',
          'floating-chat.donateButton.text-color': '#fff'
        })
      } catch (e) {
        console.error('kofi draw error', e)
      }
      return
    }

    const s = document.createElement('script')
    s.src = 'https://storage.ko-fi.com/cdn/scripts/overlay-widget.js'
    s.async = true
    s.onload = () => {
      try {
        if (window.kofiWidgetOverlay && typeof window.kofiWidgetOverlay.draw === 'function') {
          window.kofiWidgetOverlay.draw('aizhee', {
            type: 'floating-chat',
            'floating-chat.donateButton.text': '',
            'floating-chat.donateButton.background-color': '#00000000',
            'floating-chat.donateButton.text-color': '#fff'
          })
        }
      } catch (e) {
        console.error('kofi init error', e)
      }
    }
    document.body.appendChild(s)

    return () => {
      // keep the script for overlay functionality; do not remove on unmount
    }
  }, [])

  useEffect(() => {
    if (selected.length === 0) return
    validateSelected()
    
  }, [selected.length])

  
  useEffect(() => {
    if (selected.length === 0) return
    validateSelected()
    
  }, [pythonVersion])

  useEffect(() => {
    if (!query) { setSuggestions([]); return }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(query)}`)
        if (!res.ok) return
        const data = await res.json()
        setSuggestions(data.suggestions || [])
      } catch (err) {
        console.error('suggest error', err)
      }
    }, 220)
    return () => clearTimeout(t)
  }, [query])

  async function addPackageFromName(name, requestedSpec = null) {
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(name)}`)
      if (!res.ok) {
        alert('Package not found on PyPI')
        setLoading(false)
        return
      }
      const data = await res.json()
      // choose a version based on requestedSpec if provided
      const chooseVersion = (versions, spec) => {
        if (!spec || !versions || versions.length === 0) return ''
        const cmp = (a, b) => {
          const pa = a.split(/[.-_+]/).map(x => (x.match(/^\d+$/) ? Number(x) : x))
          const pb = b.split(/[.-_+]/).map(x => (x.match(/^\d+$/) ? Number(x) : x))
          for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
            const A = pa[i] === undefined ? 0 : pa[i]
            const B = pb[i] === undefined ? 0 : pb[i]
            if (typeof A === 'number' && typeof B === 'number') {
              if (A > B) return 1
              if (A < B) return -1
            } else {
              const sa = String(A)
              const sb = String(B)
              if (sa > sb) return 1
              if (sa < sb) return -1
            }
          }
          return 0
        }

        if (spec.op === '==' && spec.ver) {
          // exact match
          if (versions.includes(spec.ver)) return spec.ver
          return ''
        }
        if (spec.op === '>=' && spec.ver) {
          // versions is assumed newest-first; pick first version >= spec.ver
          for (const v of versions) {
            try {
              if (cmp(v, spec.ver) >= 0) return v
            } catch (e) {
              continue
            }
          }
          return ''
        }
        // default: none
        return ''
      }

      const selectedVersion = requestedSpec ? chooseVersion(data.versions || [], requestedSpec) : ''

      const pkg = {
        name: data.name,
        version: selectedVersion || '',
        versions: data.versions,
        status: 'unknown',
        details: [],
        requires: [],
        description: data.description || '',
        project_url: data.project_url || ''
      }
      setSelected(s => {
        if (s.find(x => x.name.toLowerCase() === pkg.name.toLowerCase())) return s
        return [...s, pkg]
      })
      setQuery('')
      setSuggestions([])
    } catch (err) {
      console.error(err)
      alert('Error searching package')
    } finally {
      setLoading(false)
    }
  }

  
  async function handleFileImport(e) {
    const f = e.target.files && e.target.files[0]
    if (!f) return
    try {
      await processImportedFile(f)
    } finally {
      if (e.target) e.target.value = ''
    }
  }

  async function processImportedFile(file) {
    if (!file) return
    try {
      const text = await file.text()
      const entries = new Map()
      for (const raw of text.split(/\r?\n/)) {
        let line = raw.trim()
        if (!line) continue
        if (line.startsWith('#')) continue
        if (line.startsWith('-r') || line.startsWith('--')) continue

        // parse forms like: package==1.2.3, package>=1.2, package<=1.2, package<1.2, package>1.2
        const m = line.match(/^([A-Za-z0-9_.+-]+)(?:\s*(==|>=|<=|>|<)\s*([^\s;,#]+))?/) 
        if (!m) continue
        const pkgName = m[1]
        const op = m[2] || null
        const ver = m[3] || null
        const key = pkgName.toLowerCase()
        if (!entries.has(key)) {
          entries.set(key, { name: pkgName, spec: op ? { op, ver } : null })
        }
      }
      if (entries.size === 0) {
        alert('No packages found in file')
        return
      }
      for (const { name, spec } of entries.values()) {
        await addPackageFromName(name, spec)
      }
    } catch (err) {
      console.error('import error', err)
      alert('Failed to import file')
    }
  }

  function onDragOver(e) {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(true)
  }

  function onDragLeave(e) {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }

  async function onDrop(e) {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    const files = e.dataTransfer && e.dataTransfer.files
    if (!files || files.length === 0) return
    const f = files[0]
    await processImportedFile(f)
  }

  function triggerImport() {
    if (fileRef.current) fileRef.current.click()
  }

  function triggerCopy() {
    if (selected.length === 0) return
    const specs = selected.map(p => {
      const v = p.version && p.version !== '' ? p.version : (p.versions && p.versions.length ? p.versions[0] : '')
      return v ? `${p.name}==${v}` : `${p.name}`
    }).filter(Boolean)
    const cmd = ['pip install', ...specs].join(' ')
    navigator.clipboard.writeText(cmd).then(() => {
      alert('Copied to clipboard')
    }).catch(() => {
      alert('Failed to copy to clipboard')
    })
  }

  
  async function validateSelected(curSelected = null) {
    const used = Array.isArray(curSelected) ? curSelected : (Array.isArray(selected) ? selected : [])
    const payload = { packages: used.map(p => ({ name: p.name, version: p.version || 'latest' })), python_version: pythonVersion }
    try {
      const res = await fetch('/api/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()

      
      const updated = used.map(p => {
        const found = (data.packages || []).find(x => x.name.toLowerCase() === p.name.toLowerCase())
        return found ? { ...p, status: found.status, details: found.details || [], requires: found.requires || [] } : p
      })
      setSelected(updated)

      
    } catch (err) {
      console.error('validate error', err)
    }
  }

  function removePackage(name) {
    setSelected(s => s.filter(p => p.name !== name))
  }

  function onVersionChange(name, version) {
    setSelected(s => {
      const newS = s.map(p => p.name === name ? { ...p, version } : p)
      
      setTimeout(() => validateSelected(newS), 120)
      return newS
    })
  }

  const selectedNames = new Set(selected.map(p => p.name.toLowerCase()))

  return (
    <div className="app">
      <div className="header">
        <h1 style={{margin:0}}>pip-picker</h1>
        <div className="muted">interactive package compatibility checker</div>
      </div>

      <div className="controls-container">
        <div className="controls">
          <div className="control-group">
            <div style={{display:'flex', flexDirection:'column'}}>
              <select value={pythonVersion} onChange={e => setPythonVersion(e.target.value)}>
                  {pythonVersions.map(v => (
                    <option key={v} value={v}>Python {v}</option>
                  ))}
              </select>
            </div>
          </div>
          <div className="search-group">
            <input
              className="search-input"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search PyPI package (e.g. numpy)"
              onFocus={() => setInputFocused(true)}
              onBlur={() => setTimeout(() => setInputFocused(false), 150)}
            />
            <button onClick={() => addPackageFromName(query)} disabled={loading || !query.trim()}>Add</button>

            {suggestions.length > 0 && inputFocused && (
              <div ref={suggRef} className="suggestions">
                {suggestions.map(s => (
                  <div key={s} onMouseDown={() => addPackageFromName(s)}>{s}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {selected.length === 0 ? (
          <div
            className={`empty-state ${dragActive ? 'dragging' : ''}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            Search and add a library first <br></br>or drag and drop a requirements.txt file here
          </div>
      ) : (
        <div className="grid">
          {selected.map(p => (
            <PackageSquare key={p.name} pkg={p} onVersionChange={onVersionChange} onRemove={removePackage} selectedNames={selectedNames} />
          ))}
        </div>
      )}

      <div style={{marginTop:20, display:'flex', gap:12, alignItems:'center', flexWrap:'wrap'}}>
        <button onClick={validateSelected}>Re-validate</button>
        <button onClick={triggerImport}>Import requirements.txt</button>
        <button onClick={triggerCopy}>Copy pip command</button>
        <input ref={fileRef} type="file" accept=".txt" style={{display:'none'}} onChange={handleFileImport} />
        <button onClick={() => {
          if (selected.length === 0) return
          const lines = selected.map(p => {
            const v = p.version && p.version !== '' ? p.version : (p.versions && p.versions.length ? p.versions[0] : '')
            return v ? `${p.name}==${v}` : `${p.name}`
          })
          const header = `# generated by pip-picker\n# python-version: ${pythonVersion}\n\n`
          const content = header + lines.join('\n') + '\n'
          const blob = new Blob([content], { type: 'text/plain' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = 'requirements.txt'
          document.body.appendChild(a)
          a.click()
          a.remove()
          URL.revokeObjectURL(url)
        }}>Export requirements.txt</button>
      </div>
    
      <div className="app-footer footer-note">This tool queries the <a href="https://pypi.org/" target="_blank" rel="noreferrer">PyPI JSON API</a> to fetch package metadata and version history.<br></br><br></br>made with <span aria-hidden>❤</span> by <strong>aizhee</strong></div>
    </div>
  )
}
