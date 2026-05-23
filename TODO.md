# CBSE Dashboard — PythonAnywhere Migration TODO

## Phase 1 — Static Flask Deployment
Deploy the existing client-side app via Flask. Zero JS logic changes. localStorage still used.

### 1.1 Project scaffold
- [x] Create directory structure: `static/`, `templates/`, `data/`, `mappings/`
- [x] Fix duplicate `renderSubjects` bug in app.js
- [x] Move state var declarations to top-level block in app.js
- [x] Vendor Chart.js and SheetJS (download to static/js/)
- [x] Download Google Fonts and serve locally (static/fonts/)
- [x] Update cbse_dashboard.html to use local asset paths
- [x] Create Flask app.py with routes for HTML, static, and mapping files
- [x] Create wsgi.py for PythonAnywhere
- [x] Create requirements.txt
- [x] Write PythonAnywhere setup instructions

### 1.2 Verification
- [x] `node --check static/js/app.js` passes
- [x] Flask runs locally: `python app.py`
- [x] Upload TXT → parse → all tabs render
- [x] Excel auto-load works (mapping files served via Flask)
- [x] Export Excel works
- [x] Backup/restore works

---

## Phase 2 — SQLite Persistence Layer
Replace localStorage with server-side SQLite. Parsing and rendering unchanged.

### 2.1 Database
- [x] Create `db.py` with schema and helper functions
- [x] Tables: sessions, student_master, teacher_mapping, follow_up, combinations
- [x] Auto-init on first run (CREATE TABLE IF NOT EXISTS)

### 2.2 Flask API routes
- [x] GET  `/api/sessions` — list all sessions
- [x] POST `/api/sessions` — save raw text for X or XII
- [x] GET  `/api/sessions/<code>/<year>` — get raw text for a school/year
- [x] DELETE `/api/sessions/<code>/<year>` — remove a school
- [x] GET  `/api/master/<code>/<year>` — get student master + teacher mapping
- [x] POST `/api/master/<code>/<year>/student` — save student master rows
- [x] POST `/api/master/<code>/<year>/teacher` — save teacher mapping rows
- [x] GET  `/api/followup/<code>/<year>/<cls>` — get follow-up notes
- [x] PUT  `/api/followup/<code>/<year>/<cls>/<roll>` — save one note
- [x] GET  `/api/combinations` — list combinations
- [x] POST `/api/combinations` — save combination
- [x] DELETE `/api/combinations/<id>` — remove combination
- [x] GET  `/api/mappings/<filename>` — serve Excel mapping files (replaces same-folder fetch)

### 2.3 JS store adapter (app.js changes)
- [x] Add `Store` object with async API wrappers
- [x] `Store.detectMode()` — 'api' if server reachable, 'local' fallback
- [x] Replace `persistSchoolSession` → `Store.saveSession`
- [x] Replace `rebuildSessionsFromLocalStorage` → `Store.loadAllSessions`
- [x] Replace `persistMasterData` (follow-up) → `Store.saveFollowUp`
- [x] Replace `persistSavedCombinations` / `collectSavedCombinations` → Store methods
- [x] Replace `fetchMappingRows` fetch path → `/api/mappings/<filename>`
- [x] Replace `tryRestoreFromLocalStorage` → `tryRestoreFromServer`
- [x] Keep localStorage as offline fallback (Store.mode === 'local')

### 2.4 Verification
- [x] Upload TXT → saved in SQLite
- [x] Reload page → session restored from server
- [x] Follow-up note → persisted in DB
- [x] Backup export → includes server data
- [x] localStorage fallback works when API unreachable

---

## Phase 3 — Multi-user Auth (Future)
Simple login so multiple staff members can use the same deployment.

### 3.1 Auth
- [x] Add `users` table to SQLite (username, bcrypt hash)
- [x] POST `/auth/login` and `/auth/logout`
- [x] Session cookie (Flask-Login or manual)
- [x] Protect all `/api/*` routes with login_required
- [x] Per-user follow-up notes (add user_id FK to follow_up table)

### 3.2 Admin
- [x] Simple admin route to create user accounts
- [x] Password change endpoint

---

## Notes
- Parsing (parseX, parseXII, buildSubs) — NO changes ever, these are browser-only
- Chart rendering — NO changes, browser-only
- Excel export — NO changes, browser-only
- Only the persistence layer (15 localStorage calls) changes in Phase 2
- PythonAnywhere free tier: 512MB disk, 100s CPU/day — all fine since heavy work is in browser
