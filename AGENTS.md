# CBSE Result Dashboard

## Project

Flask + vanilla JS dashboard for parsing and analyzing CBSE board exam results. Parses gazette TXT files (Class X/XII), stores raw data in SQLite, enriches with student master/teacher mapping/performance marks from Excel files, and provides analytics, merit lists, follow-up tracking, and Excel export.

## Stack

- **Backend**: Python 3, Flask, Werkzeug, SQLite (`db.py`)
- **Frontend**: Vanilla JS (no framework), Chart.js, SheetJS (XLSX), self-hosted fonts
- **Deployment**: PythonAnywhere (WSGI via `wsgi.py`)
- **Persistence**: Server-side SQLite with localStorage fallback
- **Auth**: Session-based, two roles (`admin` / `user`), feature permissions per user

## Key files

| File | Role |
|---|---|
| `app.py` | Flask app: routes, auth decorators, API endpoints |
| `db.py` | SQLite helpers: schema, migrations, CRUD for all tables |
| `static/js/app.js` | All frontend logic: parsing, rendering, Store adapter, exports |
| `static/js/chart.umd.min.js` | Chart.js vendored |
| `static/js/xlsx.full.min.js` | SheetJS vendored |
| `static/css/styles.css` | All styles |
| `static/mappings/` | Excel files auto-loaded by school code + year |
| `templates/index.html` | Single HTML shell |
| `wsgi.py` | PythonAnywhere WSGI entry point |

## Architecture

- **Store adapter** (`app.js:130-283`): `Store` object abstracts persistence — `mode: 'api'` hits Flask/SQLite, `mode: 'local'` falls back to `localStorage`. All persistence goes through this.
- **Parsing** (`app.js:545-620`): `parseX()` / `parseXII()` match line regex patterns from CBSE gazette PDF layout.
- **Session registry** (`schoolSessions` map): All loaded sessions cached in memory. Active session drives `DB.X` / `DB.XII` arrays.
- **Master data enrichment** (`buildEnrichedStudents`): Merges parsed student records with student master (section, class teacher) and teacher mapping (per-subject teacher) from Excel uploads.
- **Performance marks**: Internal/practical marks uploaded via Excel, merged onto student subjects, deriving theory marks.

## Database tables (`db.py:34-124`)

`sessions`, `student_master`, `teacher_mapping`, `follow_up`, `performance_marks`, `combinations`, `users`, `user_feature_permissions`

Auto-migrates older schemas on startup (`_migrate_*` functions in `db.py`).

## Conventions

- **Python**: double-quote strings, docstrings on functions, `snake_case` for Python, `camelCase` for JS API responses
- **JS**: `camelCase` vars, `let`/`const`, no framework, no build step
- **API responses**: JSON, `camelCase` keys, errors as `{error: "message"}`
- **Auth**: `@login_required` and `@admin_required` decorators on Flask routes; `@feature_required('feature_key')` for feature gating
- **DB columns**: `snake_case`, auto-mapped to `camelCase` in API responses
- **No comments in code** unless explaining a non-obvious regex or migration

## Running locally

```bash
pip install flask werkzeug
python app.py
# Opens at http://127.0.0.1:5000
```

## Notes

- All heavy computation (parsing, charting, export) runs in the browser. Flask only does lightweight DB reads/writes.
- Default admin credentials: `admin` / `admin123`
- Regular users are limited to 2 result file uploads unless granted feature permissions by admin.
