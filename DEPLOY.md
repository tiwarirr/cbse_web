# PythonAnywhere Deployment Guide — CBSE Result Dashboard

## What this deployment gives you
- The full dashboard accessible from any browser, any device
- Sessions, follow-up notes, and combinations stored in SQLite (server-side)
- Excel mapping files (student master, teacher mapping) served automatically
- localStorage used as automatic fallback if server is unreachable
- No size limits, no data loss on browser clear

---

## File structure on server

```
/home/YOUR_USERNAME/cbse_web/
├── app.py                      ← Flask app + API routes
├── db.py                       ← SQLite helpers
├── wsgi.py                     ← PythonAnywhere WSGI entry point
├── requirements.txt
├── data/
│   └── cbse.db                 ← Created automatically on first run
├── static/
│   ├── js/
│   │   ├── app.js
│   │   ├── chart.umd.min.js
│   │   └── xlsx.full.min.js
│   ├── css/
│   │   ├── styles.css
│   │   └── fonts.css
│   ├── fonts/                  ← Self-hosted woff2 files
│   └── mappings/               ← School Excel files go here
│       ├── 60478-2025-student_master.xlsx
│       ├── 60478-2025-teacher_mapping.xlsx
│       └── 60478-2025-internal_marks.xlsx
└── templates/
    └── index.html
```

---

## Step 1 — Upload files

Option A: Upload via PythonAnywhere Files tab (simplest)
1. Go to pythonanywhere.com → Files
2. Create `/home/YOUR_USERNAME/cbse_web/` and all subdirectories
3. Upload every file from this `cbse_web/` folder maintaining the structure

Option B: Git clone (recommended for updates)
```bash
# In PythonAnywhere Bash console:
cd ~
git clone https://github.com/YOUR_REPO/cbse_web.git
```

---

## Step 2 — Install dependencies

Open a Bash console on PythonAnywhere:

```bash
cd ~/cbse_web
pip3 install --user flask
```

Flask is the only dependency. SQLite is built into Python.

---

## Step 3 — Configure wsgi.py

Edit `wsgi.py` and replace `YOUR_USERNAME` with your actual PythonAnywhere username:

```python
project_home = '/home/YOUR_USERNAME/cbse_web'
```

---

## Step 4 — Create the web app

1. Go to **Web** tab on PythonAnywhere
2. Click **Add a new web app**
3. Choose **Manual configuration** (not Flask quick-start)
4. Choose **Python 3.10** (or newer)

In the web app configuration:
- **Source code**: `/home/YOUR_USERNAME/cbse_web`
- **Working directory**: `/home/YOUR_USERNAME/cbse_web`
- **WSGI configuration file**: click the link and replace the entire content with:

```python
import sys, os
project_home = '/home/YOUR_USERNAME/cbse_web'
if project_home not in sys.path:
    sys.path.insert(0, project_home)
os.chdir(project_home)
from app import app as application
```

---

## Step 5 — Static files mapping (optional, for performance)

In the Web tab, under **Static files**:

| URL          | Directory                                  |
|---|---|
| `/static/`   | `/home/YOUR_USERNAME/cbse_web/static/`     |

This lets PythonAnywhere serve static files directly without going through Flask, which is faster on the free tier.

---

## Step 6 — Reload and test

1. Click **Reload** in the Web tab
2. Open `https://YOUR_USERNAME.pythonanywhere.com`
3. The dashboard should load with self-hosted fonts and all features working

---

## Step 7 — Add school mapping files

To enable automatic student master and teacher mapping for a school:

1. Go to Files → `/home/YOUR_USERNAME/cbse_web/static/mappings/`
2. Upload Excel files named exactly:
   - `{schoolCode}-{year}-student_master.xlsx`
   - `{schoolCode}-{year}-teacher_mapping.xlsx`
   - `{schoolCode}-{year}-internal_marks.xlsx` (optional)

Example for school 60478, year 2025:
```
60478-2025-student_master.xlsx
60478-2025-teacher_mapping.xlsx
```

The dashboard will auto-load these when that school's result is opened.

---

## How persistence works (Phase 2)

When the page loads, the JS detects the Flask server via `GET /api/ping`.

| Condition | Behaviour |
|---|---|
| Server reachable | Sessions saved to SQLite via API |
| Server unreachable | Falls back to localStorage (same as before) |

This means the dashboard continues to work even if the server has a temporary issue.

**What is stored server-side:**
- Raw gazette text (per school, year, class)
- Follow-up notes (status, owner, remarks per student)
- Multi-school combinations

**What stays client-side:**
- All parsing (browser JS)
- All charts and analytics (browser JS)
- Excel exports (browser JS)
- Student master + teacher mapping rows (reloaded from Excel on each open)

---

## Backup and restore

The **Backup** button in the dashboard exports a JSON file from whatever is currently loaded. This works identically to the local version.

For a full server-side backup, simply download the SQLite database:
```bash
# In PythonAnywhere console:
cp ~/cbse_web/data/cbse.db ~/cbse_backup_$(date +%Y%m%d).db
```

---

## Updating the app

```bash
# In PythonAnywhere console:
cd ~/cbse_web
git pull   # if using git

# Then reload the web app from the Web tab
```

---

## Troubleshooting

**Page loads but charts are broken**
→ Check browser console for 404 errors on `/static/js/chart.umd.min.js`
→ Verify the static files mapping in the Web tab

**Sessions not saving to server**
→ Open browser DevTools → Network → check `/api/ping` response
→ If 404, the WSGI config is wrong — recheck wsgi.py path

**Auto-load Excel not working**
→ Files must be in `static/mappings/` with exact naming
→ Check that the Web tab has `/static/` mapped to the right directory

**`data/cbse.db` not created**
→ The `data/` directory must exist and be writable
→ Run manually: `mkdir -p ~/cbse_web/data`

**Free tier "CPU quota exceeded"**
→ All heavy computation (parsing, charts, export) is in the browser
→ Flask only does lightweight DB reads/writes — this should not happen

---

## Free tier limits

| Resource | Limit | Our usage |
|---|---|---|
| Disk | 512 MB | ~5 MB for code + DB |
| CPU/day | 100 seconds | < 1 second (DB is all we do) |
| Web apps | 1 | 1 |
| Always-on tasks | 0 | Not needed |

The free tier is fully sufficient for a school's internal use.
