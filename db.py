"""
db.py — SQLite persistence layer for CBSE Result Dashboard
Phase 2: replaces localStorage with server-side storage.
"""

import sqlite3
import json
import os
from werkzeug.security import generate_password_hash, check_password_hash

DB_PATH = os.path.join(os.path.dirname(__file__), 'data', 'cbse.db')

DEFAULT_FEATURES = {
    'student_master_upload': False,
    'teacher_mapping_upload': False,
    'performance_marks_upload': False,
    'excel_export': False,
}


def get_db():
    """Return a database connection with row_factory set."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA journal_mode=WAL')
    conn.execute('PRAGMA foreign_keys=ON')
    return conn


def init_db():
    """Create tables if they do not exist. Safe to call on every startup."""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = get_db()
    conn.executescript('''
        CREATE TABLE IF NOT EXISTS sessions (
            id          INTEGER PRIMARY KEY,
            school_code TEXT    NOT NULL,
            school_name TEXT,
            year        TEXT    NOT NULL,
            cls         TEXT    NOT NULL CHECK(cls IN ('X','XII')),
            raw_text    TEXT    NOT NULL,
            saved_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(school_code, year, cls)
        );

        CREATE TABLE IF NOT EXISTS student_master (
            id            INTEGER PRIMARY KEY,
            school_code   TEXT NOT NULL,
            year          TEXT NOT NULL,
            roll_no       TEXT NOT NULL,
            cls           TEXT NOT NULL,
            section       TEXT,
            class_teacher TEXT,
            stream        TEXT,
            house         TEXT,
            UNIQUE(school_code, year, roll_no, cls)
        );

        CREATE TABLE IF NOT EXISTS teacher_mapping (
            id           INTEGER PRIMARY KEY,
            school_code  TEXT NOT NULL,
            year         TEXT NOT NULL,
            cls          TEXT NOT NULL,
            section      TEXT,
            subject_code TEXT,
            subject_name TEXT,
            teacher_name TEXT,
            department   TEXT,
            teacher_id   TEXT
        );

        CREATE TABLE IF NOT EXISTS follow_up (
            id          INTEGER PRIMARY KEY,
            school_code TEXT NOT NULL,
            year        TEXT NOT NULL,
            cls         TEXT NOT NULL,
            roll_no     TEXT NOT NULL,
            status      TEXT DEFAULT '',
            owner       TEXT DEFAULT '',
            remarks     TEXT DEFAULT '',
            updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(school_code, year, cls, roll_no)
        );

        CREATE TABLE IF NOT EXISTS performance_marks (
            id             INTEGER PRIMARY KEY,
            school_code    TEXT NOT NULL,
            year           TEXT NOT NULL,
            component_type TEXT NOT NULL,
            roll_no        TEXT NOT NULL,
            cls            TEXT NOT NULL,
            subject_code   TEXT NOT NULL,
            component_marks     REAL NOT NULL,
            component_max_marks REAL NOT NULL,
            UNIQUE(school_code, year, roll_no, cls, subject_code)
        );

        CREATE TABLE IF NOT EXISTS combinations (
            id                   TEXT PRIMARY KEY,
            name                 TEXT NOT NULL,
            selected_session_ids TEXT NOT NULL,
            default_class_scope  TEXT DEFAULT 'X',
            merit_scope          TEXT DEFAULT 'same-class',
            created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS users (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            username      TEXT    NOT NULL UNIQUE,
            password_hash TEXT    NOT NULL,
            role          TEXT    NOT NULL CHECK(role IN ('admin', 'user')),
            created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS user_feature_permissions (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     INTEGER NOT NULL,
            feature_key TEXT    NOT NULL,
            enabled     INTEGER NOT NULL DEFAULT 0,
            updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, feature_key),
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );
    ''')
    _migrate_auth_schema(conn)
    # Seed default admin user if empty
    admin_exists = conn.execute('SELECT 1 FROM users WHERE role = ?', ('admin',)).fetchone()
    if not admin_exists:
        hashed = generate_password_hash('admin123')
        conn.execute('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', ('admin', hashed, 'admin'))
    conn.commit()
    conn.close()


def _columns(conn, table):
    return {row['name'] for row in conn.execute(f'PRAGMA table_info({table})').fetchall()}


def _migrate_auth_schema(conn):
    """Move older installs to per-user ownership and user/admin roles."""
    conn.execute('PRAGMA foreign_keys=OFF')
    try:
        _migrate_users_table(conn)
        admin = conn.execute("SELECT id, username FROM users WHERE role='admin' ORDER BY id LIMIT 1").fetchone()
        owner_id = admin['id'] if admin else 1
        owner_name = admin['username'] if admin else 'admin'
        _migrate_sessions_table(conn, owner_id, owner_name)
        _migrate_student_master_table(conn, owner_id)
        _migrate_teacher_mapping_table(conn, owner_id)
        _migrate_follow_up_table(conn, owner_id)
        _migrate_performance_marks_table(conn, owner_id)
        _migrate_combinations_table(conn, owner_id)
        conn.execute('PRAGMA foreign_keys=ON')
    except Exception:
        conn.execute('PRAGMA foreign_keys=ON')
        raise


def _migrate_users_table(conn):
    cols = _columns(conn, 'users')
    role_sql = conn.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").fetchone()['sql']
    if "role IN ('admin', 'user')" in role_sql:
        return
    conn.executescript('''
        CREATE TABLE users_new (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            username      TEXT    NOT NULL UNIQUE,
            password_hash TEXT    NOT NULL,
            role          TEXT    NOT NULL CHECK(role IN ('admin', 'user')),
            created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    ''')
    created_expr = 'created_at' if 'created_at' in cols else 'CURRENT_TIMESTAMP'
    conn.execute(f'''
        INSERT INTO users_new (id, username, password_hash, role, created_at)
        SELECT id, username, password_hash,
               CASE WHEN role='admin' THEN 'admin' ELSE 'user' END,
               {created_expr}
        FROM users
    ''')
    conn.execute('DROP TABLE users')
    conn.execute('ALTER TABLE users_new RENAME TO users')


def _migrate_sessions_table(conn, default_owner_id, default_owner_username):
    conn.executescript('''
        CREATE TABLE sessions_new (
            id             INTEGER PRIMARY KEY,
            school_code    TEXT    NOT NULL,
            school_name    TEXT,
            year           TEXT    NOT NULL,
            cls            TEXT    NOT NULL CHECK(cls IN ('X','XII')),
            raw_text       TEXT    NOT NULL,
            owner_user_id  INTEGER NOT NULL,
            owner_username TEXT    NOT NULL,
            saved_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(owner_user_id, school_code, year, cls)
        );
    ''')
    cols = _columns(conn, 'sessions')
    owner_id_expr = 'owner_user_id' if 'owner_user_id' in cols else str(default_owner_id)
    owner_name_expr = 'owner_username' if 'owner_username' in cols else f"'{default_owner_username}'"
    saved_expr = 'saved_at' if 'saved_at' in cols else 'CURRENT_TIMESTAMP'
    conn.execute(f'''
        INSERT OR IGNORE INTO sessions_new
            (id, school_code, school_name, year, cls, raw_text, owner_user_id, owner_username, saved_at)
        SELECT id, school_code, school_name, year, cls, raw_text,
               COALESCE({owner_id_expr}, ?),
               COALESCE({owner_name_expr}, ?),
               {saved_expr}
        FROM sessions
    ''', (default_owner_id, default_owner_username))
    conn.execute('DROP TABLE sessions')
    conn.execute('ALTER TABLE sessions_new RENAME TO sessions')


def _migrate_student_master_table(conn, default_owner_id):
    conn.executescript('''
        CREATE TABLE student_master_new (
            id            INTEGER PRIMARY KEY,
            owner_user_id INTEGER NOT NULL,
            school_code   TEXT NOT NULL,
            year          TEXT NOT NULL,
            roll_no       TEXT NOT NULL,
            cls           TEXT NOT NULL,
            section       TEXT,
            class_teacher TEXT,
            stream        TEXT,
            house         TEXT,
            UNIQUE(owner_user_id, school_code, year, roll_no, cls)
        );
    ''')
    cols = _columns(conn, 'student_master')
    owner_expr = 'owner_user_id' if 'owner_user_id' in cols else str(default_owner_id)
    conn.execute(f'''
        INSERT OR IGNORE INTO student_master_new
            (id, owner_user_id, school_code, year, roll_no, cls, section, class_teacher, stream, house)
        SELECT id, COALESCE({owner_expr}, ?), school_code, year, roll_no, cls, section, class_teacher, stream, house
        FROM student_master
    ''', (default_owner_id,))
    conn.execute('DROP TABLE student_master')
    conn.execute('ALTER TABLE student_master_new RENAME TO student_master')


def _migrate_teacher_mapping_table(conn, default_owner_id):
    if 'owner_user_id' not in _columns(conn, 'teacher_mapping'):
        conn.execute('ALTER TABLE teacher_mapping ADD COLUMN owner_user_id INTEGER')
        conn.execute('UPDATE teacher_mapping SET owner_user_id=? WHERE owner_user_id IS NULL', (default_owner_id,))


def _migrate_follow_up_table(conn, default_owner_id):
    conn.executescript('''
        CREATE TABLE follow_up_new (
            id            INTEGER PRIMARY KEY,
            owner_user_id INTEGER NOT NULL,
            school_code   TEXT NOT NULL,
            year          TEXT NOT NULL,
            cls           TEXT NOT NULL,
            roll_no       TEXT NOT NULL,
            status        TEXT DEFAULT '',
            owner         TEXT DEFAULT '',
            remarks       TEXT DEFAULT '',
            updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(owner_user_id, school_code, year, cls, roll_no)
        );
    ''')
    cols = _columns(conn, 'follow_up')
    owner_expr = 'owner_user_id' if 'owner_user_id' in cols else str(default_owner_id)
    updated_expr = 'updated_at' if 'updated_at' in cols else 'CURRENT_TIMESTAMP'
    conn.execute(f'''
        INSERT OR IGNORE INTO follow_up_new
            (id, owner_user_id, school_code, year, cls, roll_no, status, owner, remarks, updated_at)
        SELECT id, COALESCE({owner_expr}, ?), school_code, year, cls, roll_no, status, owner, remarks, {updated_expr}
        FROM follow_up
    ''', (default_owner_id,))
    conn.execute('DROP TABLE follow_up')
    conn.execute('ALTER TABLE follow_up_new RENAME TO follow_up')


def _migrate_performance_marks_table(conn, default_owner_id):
    conn.executescript('''
        CREATE TABLE performance_marks_new (
            id                  INTEGER PRIMARY KEY,
            owner_user_id       INTEGER NOT NULL,
            school_code         TEXT NOT NULL,
            year                TEXT NOT NULL,
            component_type      TEXT NOT NULL,
            roll_no             TEXT NOT NULL,
            cls                 TEXT NOT NULL,
            subject_code        TEXT NOT NULL,
            component_marks     REAL NOT NULL,
            component_max_marks REAL NOT NULL,
            UNIQUE(owner_user_id, school_code, year, roll_no, cls, subject_code)
        );
    ''')
    cols = _columns(conn, 'performance_marks')
    owner_expr = 'owner_user_id' if 'owner_user_id' in cols else str(default_owner_id)
    conn.execute(f'''
        INSERT OR IGNORE INTO performance_marks_new
            (id, owner_user_id, school_code, year, component_type, roll_no, cls, subject_code, component_marks, component_max_marks)
        SELECT id, COALESCE({owner_expr}, ?), school_code, year, component_type, roll_no, cls, subject_code, component_marks, component_max_marks
        FROM performance_marks
    ''', (default_owner_id,))
    conn.execute('DROP TABLE performance_marks')
    conn.execute('ALTER TABLE performance_marks_new RENAME TO performance_marks')


def _migrate_combinations_table(conn, default_owner_id):
    conn.executescript('''
        CREATE TABLE combinations_new (
            row_id               INTEGER PRIMARY KEY AUTOINCREMENT,
            id                   TEXT NOT NULL,
            owner_user_id        INTEGER NOT NULL,
            name                 TEXT NOT NULL,
            selected_session_ids TEXT NOT NULL,
            default_class_scope  TEXT DEFAULT 'X',
            merit_scope          TEXT DEFAULT 'same-class',
            created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(owner_user_id, id)
        );
    ''')
    cols = _columns(conn, 'combinations')
    owner_expr = 'owner_user_id' if 'owner_user_id' in cols else str(default_owner_id)
    created_expr = 'created_at' if 'created_at' in cols else 'CURRENT_TIMESTAMP'
    updated_expr = 'updated_at' if 'updated_at' in cols else 'CURRENT_TIMESTAMP'
    conn.execute(f'''
        INSERT OR IGNORE INTO combinations_new
            (id, owner_user_id, name, selected_session_ids, default_class_scope, merit_scope, created_at, updated_at)
        SELECT id, COALESCE({owner_expr}, ?), name, selected_session_ids, default_class_scope, merit_scope,
               {created_expr}, {updated_expr}
        FROM combinations
    ''', (default_owner_id,))
    conn.execute('DROP TABLE combinations')
    conn.execute('ALTER TABLE combinations_new RENAME TO combinations')


# ── Sessions ──────────────────────────────────────────────────

def save_session(school_code, school_name, year, cls, raw_text, owner_user_id, owner_username):
    conn = get_db()
    conn.execute('''
        INSERT INTO sessions (school_code, school_name, year, cls, raw_text, owner_user_id, owner_username)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(owner_user_id, school_code, year, cls) DO UPDATE SET
            raw_text   = excluded.raw_text,
            school_name = COALESCE(excluded.school_name, school_name),
            owner_username = excluded.owner_username,
            saved_at   = CURRENT_TIMESTAMP
    ''', (school_code, school_name, year, cls, raw_text, owner_user_id, owner_username))
    conn.commit()
    conn.close()


def list_sessions(user=None):
    conn = get_db()
    if user and user.get('role') != 'admin':
        rows = conn.execute(
            'SELECT school_code, school_name, year, cls, raw_text, owner_user_id, owner_username '
            'FROM sessions WHERE owner_user_id=? ORDER BY year DESC, school_code',
            (user['id'],)
        ).fetchall()
    else:
        rows = conn.execute(
            'SELECT school_code, school_name, year, cls, raw_text, owner_user_id, owner_username '
            'FROM sessions ORDER BY year DESC, school_code, owner_username'
        ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_session(school_code, year, user=None, owner_user_id=None):
    conn = get_db()
    if owner_user_id:
        rows = conn.execute(
            'SELECT cls, raw_text, school_name, owner_user_id, owner_username '
            'FROM sessions WHERE school_code=? AND year=? AND owner_user_id=?',
            (school_code, year, owner_user_id)
        ).fetchall()
    elif user and user.get('role') != 'admin':
        rows = conn.execute(
            'SELECT cls, raw_text, school_name, owner_user_id, owner_username '
            'FROM sessions WHERE school_code=? AND year=? AND owner_user_id=?',
            (school_code, year, user['id'])
        ).fetchall()
    else:
        rows = conn.execute(
            'SELECT cls, raw_text, school_name, owner_user_id, owner_username FROM sessions WHERE school_code=? AND year=?',
            (school_code, year)
        ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def delete_session(school_code, year, user=None):
    conn = get_db()
    if user and user.get('role') != 'admin':
        params = (school_code, year, user['id'])
        conn.execute('DELETE FROM sessions WHERE school_code=? AND year=? AND owner_user_id=?', params)
        conn.execute('DELETE FROM student_master WHERE school_code=? AND year=? AND owner_user_id=?', params)
        conn.execute('DELETE FROM teacher_mapping WHERE school_code=? AND year=? AND owner_user_id=?', params)
        conn.execute('DELETE FROM follow_up WHERE school_code=? AND year=? AND owner_user_id=?', params)
        conn.execute('DELETE FROM performance_marks WHERE school_code=? AND year=? AND owner_user_id=?', params)
    else:
        conn.execute('DELETE FROM sessions WHERE school_code=? AND year=?', (school_code, year))
        conn.execute('DELETE FROM student_master WHERE school_code=? AND year=?', (school_code, year))
        conn.execute('DELETE FROM teacher_mapping WHERE school_code=? AND year=?', (school_code, year))
        conn.execute('DELETE FROM follow_up WHERE school_code=? AND year=?', (school_code, year))
        conn.execute('DELETE FROM performance_marks WHERE school_code=? AND year=?', (school_code, year))
    conn.commit()
    conn.close()


def session_owner_id(school_code, year, user=None):
    if user and user.get('role') != 'admin':
        return user['id']
    conn = get_db()
    row = conn.execute(
        'SELECT owner_user_id FROM sessions WHERE school_code=? AND year=? ORDER BY saved_at DESC LIMIT 1',
        (school_code, year)
    ).fetchone()
    conn.close()
    return row['owner_user_id'] if row else (user['id'] if user else None)


def user_can_access_session(user, school_code, year):
    if not user:
        return False
    if user.get('role') == 'admin':
        return True
    conn = get_db()
    row = conn.execute(
        'SELECT 1 FROM sessions WHERE school_code=? AND year=? AND owner_user_id=? LIMIT 1',
        (school_code, year, user['id'])
    ).fetchone()
    conn.close()
    return row is not None


def uploaded_class_count(user_id, school_code, year):
    conn = get_db()
    row = conn.execute(
        'SELECT COUNT(DISTINCT cls) AS count FROM sessions WHERE owner_user_id=? AND school_code=? AND year=?',
        (user_id, school_code, year)
    ).fetchone()
    conn.close()
    return row['count'] if row else 0


def result_file_count(user_id):
    conn = get_db()
    row = conn.execute(
        'SELECT COUNT(*) AS count FROM sessions WHERE owner_user_id=?',
        (user_id,)
    ).fetchone()
    conn.close()
    return row['count'] if row else 0


def session_class_exists(user_id, school_code, year, cls):
    conn = get_db()
    row = conn.execute(
        'SELECT 1 FROM sessions WHERE owner_user_id=? AND school_code=? AND year=? AND cls=? LIMIT 1',
        (user_id, school_code, year, cls)
    ).fetchone()
    conn.close()
    return row is not None


# ── Master data ───────────────────────────────────────────────

def save_student_master(school_code, year, rows, owner_user_id):
    """Replace all student master rows for this school/year."""
    conn = get_db()
    conn.execute(
        'DELETE FROM student_master WHERE school_code=? AND year=? AND owner_user_id=?',
        (school_code, year, owner_user_id)
    )
    conn.executemany('''
        INSERT INTO student_master (owner_user_id, school_code, year, roll_no, cls, section, class_teacher, stream, house)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', [
        (owner_user_id, school_code, year, r.get('rollNo',''), r.get('class',''),
         r.get('section',''), r.get('classTeacher',''),
         r.get('stream',''), r.get('house',''))
        for r in rows
    ])
    conn.commit()
    conn.close()


def get_student_master(school_code, year, owner_user_id):
    conn = get_db()
    rows = conn.execute(
        'SELECT roll_no, cls, section, class_teacher, stream, house FROM student_master WHERE school_code=? AND year=? AND owner_user_id=?',
        (school_code, year, owner_user_id)
    ).fetchall()
    conn.close()
    return [{'rollNo': r['roll_no'], 'class': r['cls'], 'section': r['section'],
             'classTeacher': r['class_teacher'], 'stream': r['stream'], 'house': r['house']}
            for r in rows]


def save_teacher_mapping(school_code, year, rows, owner_user_id):
    """Replace all teacher mapping rows for this school/year."""
    conn = get_db()
    conn.execute(
        'DELETE FROM teacher_mapping WHERE school_code=? AND year=? AND owner_user_id=?',
        (school_code, year, owner_user_id)
    )
    conn.executemany('''
        INSERT INTO teacher_mapping (owner_user_id, school_code, year, cls, section, subject_code, subject_name, teacher_name, department, teacher_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', [
        (owner_user_id, school_code, year, r.get('class',''), r.get('section',''),
         r.get('subjectCode',''), r.get('subjectName',''),
         r.get('teacherName',''), r.get('department',''), r.get('teacherId',''))
        for r in rows
    ])
    conn.commit()
    conn.close()


def get_teacher_mapping(school_code, year, owner_user_id):
    conn = get_db()
    rows = conn.execute(
        'SELECT cls, section, subject_code, subject_name, teacher_name, department, teacher_id FROM teacher_mapping WHERE school_code=? AND year=? AND owner_user_id=?',
        (school_code, year, owner_user_id)
    ).fetchall()
    conn.close()
    return [{'class': r['cls'], 'section': r['section'], 'subjectCode': r['subject_code'],
             'subjectName': r['subject_name'], 'teacherName': r['teacher_name'],
             'department': r['department'], 'teacherId': r['teacher_id']}
            for r in rows]


# ── Follow-up notes ───────────────────────────────────────────

def save_follow_ups(school_code, year, notes_dict, owner_user_id):
    """
    notes_dict shape: { "X|21230892": {"status":"Reviewed","owner":"…","remarks":"…"}, … }
    Key format is "{cls}|{rollNo}" — same as JS side.
    """
    conn = get_db()
    for key, note in notes_dict.items():
        parts = key.split('|', 1)
        if len(parts) != 2:
            continue
        cls, roll_no = parts
        conn.execute('''
            INSERT INTO follow_up (owner_user_id, school_code, year, cls, roll_no, status, owner, remarks)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(owner_user_id, school_code, year, cls, roll_no) DO UPDATE SET
                status     = excluded.status,
                owner      = excluded.owner,
                remarks    = excluded.remarks,
                updated_at = CURRENT_TIMESTAMP
        ''', (owner_user_id, school_code, year, cls, roll_no,
              note.get('status',''), note.get('owner',''), note.get('remarks','')))
    conn.commit()
    conn.close()


def get_follow_ups(school_code, year, owner_user_id):
    """Returns dict in same format JS expects: { "X|rollNo": {status,owner,remarks} }"""
    conn = get_db()
    rows = conn.execute(
        'SELECT cls, roll_no, status, owner, remarks FROM follow_up WHERE school_code=? AND year=? AND owner_user_id=?',
        (school_code, year, owner_user_id)
    ).fetchall()
    conn.close()
    return {
        f"{r['cls']}|{r['roll_no']}": {
            'status': r['status'] or '',
            'owner':  r['owner']  or '',
            'remarks':r['remarks'] or '',
        }
        for r in rows
    }


# ── Combinations ──────────────────────────────────────────────

def save_combinations(combos, owner_user_id):
    """Replace all combinations with the provided list."""
    conn = get_db()
    conn.execute('DELETE FROM combinations WHERE owner_user_id=?', (owner_user_id,))
    for c in combos:
        conn.execute('''
            INSERT INTO combinations (id, owner_user_id, name, selected_session_ids, default_class_scope, merit_scope)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (c.get('id'), owner_user_id, c.get('name'), json.dumps(c.get('selectedSessionIds',[])),
              c.get('defaultClassScope','X'), c.get('meritScope','same-class')))
    conn.commit()
    conn.close()


def save_performance_marks(school_code, year, component_type, rows, owner_user_id):
    """Replace all performance mark rows for this school/year."""
    conn = get_db()
    conn.execute(
        'DELETE FROM performance_marks WHERE school_code=? AND year=? AND owner_user_id=?',
        (school_code, year, owner_user_id)
    )
    conn.executemany('''
        INSERT INTO performance_marks
            (owner_user_id, school_code, year, component_type, roll_no, cls, subject_code, component_marks, component_max_marks)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(owner_user_id, school_code, year, roll_no, cls, subject_code) DO UPDATE SET
            component_marks     = excluded.component_marks,
            component_max_marks = excluded.component_max_marks,
            component_type      = excluded.component_type
    ''', [
        (owner_user_id, school_code, year, component_type,
         r.get('rollNo',''), r.get('class',''), r.get('subjectCode',''),
         r.get('componentMarks', 0), r.get('componentMaxMarks', 0))
        for r in rows
        if r.get('rollNo') and r.get('class') and r.get('subjectCode')
           and r.get('componentMarks') is not None and r.get('componentMaxMarks') is not None
    ])
    conn.commit()
    conn.close()


def get_performance_marks(school_code, year, owner_user_id):
    """Returns rows in the same shape the JS mapPerformanceRows produces."""
    conn = get_db()
    rows = conn.execute(
        'SELECT component_type, roll_no, cls, subject_code, component_marks, component_max_marks '
        'FROM performance_marks WHERE school_code=? AND year=? AND owner_user_id=? ORDER BY roll_no, subject_code',
        (school_code, year, owner_user_id)
    ).fetchall()
    conn.close()
    if not rows:
        return [], None
    component_type = rows[0]['component_type']
    return [
        {
            'rollNo':          r['roll_no'],
            'class':           r['cls'],
            'subjectCode':     r['subject_code'],
            'componentMarks':  r['component_marks'],
            'componentMaxMarks': r['component_max_marks'],
            'componentType':   r['component_type'],
        }
        for r in rows
    ], component_type


def list_combinations(user=None):
    conn = get_db()
    if user and user.get('role') != 'admin':
        rows = conn.execute('SELECT * FROM combinations WHERE owner_user_id=? ORDER BY created_at', (user['id'],)).fetchall()
    else:
        rows = conn.execute('SELECT * FROM combinations ORDER BY created_at').fetchall()
    conn.close()
    return [{
        'id':                 r['id'],
        'ownerUserId':        r['owner_user_id'],
        'name':               r['name'],
        'selectedSessionIds': json.loads(r['selected_session_ids'] or '[]'),
        'defaultClassScope':  r['default_class_scope'],
        'meritScope':         r['merit_scope'],
        'createdAt':          r['created_at'],
    } for r in rows]


def reset_all_data():
    """Wipe all school result data. User accounts and permissions are left intact."""
    conn = get_db()
    for table in ('sessions', 'student_master', 'teacher_mapping', 'follow_up', 'performance_marks', 'combinations'):
        conn.execute(f'DELETE FROM {table}')
    conn.commit()
    conn.close()


# ── Users & Authentication ────────────────────────────────────

def normalize_role(role):
    return 'admin' if role == 'admin' else 'user'


def get_feature_map(user_id):
    features = dict(DEFAULT_FEATURES)
    conn = get_db()
    rows = conn.execute(
        'SELECT feature_key, enabled FROM user_feature_permissions WHERE user_id=?',
        (user_id,)
    ).fetchall()
    conn.close()
    for row in rows:
        features[row['feature_key']] = bool(row['enabled'])
    return features


def user_has_feature(user_id, feature_key):
    return bool(get_feature_map(user_id).get(feature_key, False))


def set_user_features(user_id, features):
    conn = get_db()
    for key in DEFAULT_FEATURES:
        enabled = 1 if features.get(key) else 0
        conn.execute('''
            INSERT INTO user_feature_permissions (user_id, feature_key, enabled)
            VALUES (?, ?, ?)
            ON CONFLICT(user_id, feature_key) DO UPDATE SET
                enabled = excluded.enabled,
                updated_at = CURRENT_TIMESTAMP
        ''', (user_id, key, enabled))
    conn.commit()
    conn.close()


def public_user(user, include_features=True):
    if not user:
        return None
    result = {
        'id': user['id'],
        'username': user['username'],
        'role': normalize_role(user['role']),
    }
    if 'created_at' in user.keys():
        result['created_at'] = user['created_at']
    if include_features:
        result['features'] = get_feature_map(user['id'])
    return result


def create_user(username, password, role='user'):
    """Create a new user. Returns user info dict if successful, None if username exists."""
    conn = get_db()
    hashed = generate_password_hash(password)
    role = normalize_role(role)
    try:
        conn.execute('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', (username.lower(), hashed, role))
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        return None
    
    row = conn.execute('SELECT id, username, role, created_at FROM users WHERE username = ?', (username.lower(),)).fetchone()
    conn.close()
    return public_user(row) if row else None


def verify_user(username, password):
    """Verify credentials. Returns user info dict (excluding hash) if valid, else None."""
    conn = get_db()
    row = conn.execute('SELECT id, username, password_hash, role FROM users WHERE username = ?', (username.lower(),)).fetchone()
    conn.close()
    if not row:
        return None
    if check_password_hash(row['password_hash'], password):
        return public_user(row)
    return None


def list_users():
    """List all registered users (excluding hashes)."""
    conn = get_db()
    rows = conn.execute('SELECT id, username, role, created_at FROM users ORDER BY username').fetchall()
    conn.close()
    return [public_user(r) for r in rows]


def get_user_by_id(user_id):
    conn = get_db()
    row = conn.execute('SELECT id, username, role, created_at FROM users WHERE id=?', (user_id,)).fetchone()
    conn.close()
    return public_user(row) if row else None


def delete_user(username):
    """Delete a user by username."""
    conn = get_db()
    conn.execute('DELETE FROM users WHERE username = ?', (username.lower(),))
    conn.commit()
    conn.close()


def change_password(username, new_password):
    """Change a user's password."""
    conn = get_db()
    hashed = generate_password_hash(new_password)
    conn.execute('UPDATE users SET password_hash = ? WHERE username = ?', (hashed, username.lower()))
    conn.commit()
    conn.close()

