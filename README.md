# pip-picker

This is a lightweight Next.js prototype that helps interactively pick Python packages and checks compatibility using PyPI metadata.

 Features:
 - Search PyPI packages and add them as squares
 - Choose a version (latest by default)
 - Squares change color: green = ok, yellow = warning/unknown, red = conflict
 - Uses serverless API routes to fetch PyPI metadata and run naive compatibility heuristics

 Python version & export
 - Choose a Python version in the UI (defaults to `3.11`) — this is sent to the validation API and used for basic classifier checks.
 - Click `Export requirements.txt` to download a generated `requirements.txt` containing selected packages and pinned versions (when selected or when a latest version is inferred).

Quick start (Windows `cmd.exe`):

```
cd c:\Users\aizhar\pip-manager
npm install
npm run dev
```

Then open http://localhost:3000

Notes:
- Compatibility heuristics are intentionally simple: they parse `requires_dist` entries and look for direct mentions and simple specifier mismatches. This is a prototype — I'll improve heuristics on request.
- If you want stricter version resolution, we can add a backend service that uses `pip` or `packaging` library to compute exact dependency graphs.
