# pip-picker

pip-picker is a small Next.js prototype for interactively selecting Python packages and performing simple compatibility checks using PyPI metadata.

![image](screenshot.png)

-- Quick summary

- Search PyPI packages and add them to the workspace
- Choose package versions (defaults to the newest available)
- Validate compatibility between the selected packages for a chosen Python minor version
- Export a pinned `requirements.txt` or copy a `pip install` command

Why this exists

This tool helps you quickly sanity-check whether a selected set of packages are likely to be compatible with a target Python minor version by using metadata published on PyPI (e.g. `requires_dist` and `classifiers`). It is intentionally lightweight and focused on quick feedback rather than full dependency resolution.

Getting started (Windows `cmd.exe`)

```cmd
cd c:\Users\user\pip-manager
npm install
npm run dev
```

Open http://localhost:3000 in your browser.

Important files & behavior

- `pages/index.js` — main UI: search, add packages, choose versions, import/export, drag-drop requirements.txt
- `pages/api/search.js` — fetches package metadata and release versions from PyPI (cached)
- `pages/api/validate.js` — naive compatibility checker that parses `requires_dist` and compares version specifiers / classifiers against the selected Python version
- `lib/pypiCache.js` — in-memory cache for PyPI JSON responses used by the API routes
- `public/robots.txt` — blocks crawlers from the `/api/` routes (advisory; use server-side protection for stronger security)

Importing requirements

- You can import a `requirements.txt` file using the Import button or drag-and-drop onto the empty state. The importer will attempt to parse simple lines like `package==1.2.3` and `package>=1.2` and select an appropriate package version when possible.

Exporting

- Use the "Export requirements.txt" button to download a generated file. Selected versions are pinned when available.


Limitations & notes

- Compatibility checks are heuristic and not a replacement for running an actual dependency resolver. They rely on author-provided metadata which can be incomplete or inconsistent.
- Version comparison in the frontend is a simple segment-aware comparator and does not fully implement PEP 440. For strict resolution, consider using Python's `packaging`/`pip` on the backend.


