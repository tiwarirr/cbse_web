"""
db.py — SQLite persistence layer for CBSE Result Dashboard
Phase 2: replaces localStorage with server-side storage.
"""

import sqlite3
import json
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'data', 'cbse.db')


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

        CREATE TABLE IF NOT EXISTS combinations (
            id                   TEXT PRIMARY KEY,
            name                 TEXT NOT NULL,
            selected_session_ids TEXT NOT NULL,
            default_class_scope  TEXT DEFAULT 'X',
            merit_scope          TEXT DEFAULT 'same-class',
            created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    ''')
    conn.commit()
    conn.close()


# ── Sessions ──────────────────────────────────────────────────

def save_session(school_code, school_name, year, cls, raw_text):
    conn = get_db()
    conn.execute('''
        INSERT INTO sessions (school_code, school_name, year, cls, raw_text)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(school_code, year, cls) DO UPDATE SET
            raw_text   = excluded.raw_text,
            school_name = COALESCE(excluded.school_name, school_name),
            saved_at   = CURRENT_TIMESTAMP
    ''', (school_code, school_name, year, cls, raw_text))
    conn.commit()
    conn.close()


def list_sessions():
    conn = get_db()
    rows = conn.execute(
        'SELECT school_code, school_name, year, cls, raw_text FROM sessions ORDER BY year DESC, school_code'
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_session(school_code, year):
    conn = get_db()
    rows = conn.execute(
        'SELECT cls, raw_text, school_name FROM sessions WHERE school_code=? AND year=?',
        (school_code, year)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def delete_session(school_code, year):
    conn = get_db()
    conn.execute('DELETE FROM sessions WHERE school_code=? AND year=?', (school_code, year))
    conn.execute('DELETE FROM student_master WHERE school_code=? AND year=?', (school_code, year))
    conn.execute('DELETE FROM teacher_mapping WHERE school_code=? AND year=?', (school_code, year))
    conn.execute('DELETE FROM follow_up WHERE school_code=? AND year=?', (school_code, year))
    conn.commit()
    conn.close()


# ── Master data ───────────────────────────────────────────────

def save_student_master(school_code, year, rows):
    """Replace all student master rows for this school/year."""
    conn = get_db()
    conn.execute('DELETE FROM student_master WHERE school_code=? AND year=?', (school_code, year))
    conn.executemany('''
        INSERT INTO student_master (school_code, year, roll_no, cls, section, class_teacher, stream, house)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', [
        (school_code, year, r.get('rollNo',''), r.get('class',''),
         r.get('section',''), r.get('classTeacher',''),
         r.get('stream',''), r.get('house',''))
        for r in rows
    ])
    conn.commit()
    conn.close()


def get_student_master(school_code, year):
    conn = get_db()
    rows = conn.execute(
        'SELECT roll_no, cls, section, class_teacher, stream, house FROM student_master WHERE school_code=? AND year=?',
        (school_code, year)
    ).fetchall()
    conn.close()
    return [{'rollNo': r['roll_no'], 'class': r['cls'], 'section': r['section'],
             'classTeacher': r['class_teacher'], 'stream': r['stream'], 'house': r['house']}
            for r in rows]


def save_teacher_mapping(school_code, year, rows):
    """Replace all teacher mapping rows for this school/year."""
    conn = get_db()
    conn.execute('DELETE FROM teacher_mapping WHERE school_code=? AND year=?', (school_code, year))
    conn.executemany('''
        INSERT INTO teacher_mapping (school_code, year, cls, section, subject_code, subject_name, teacher_name, department, teacher_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', [
        (school_code, year, r.get('class',''), r.get('section',''),
         r.get('subjectCode',''), r.get('subjectName',''),
         r.get('teacherName',''), r.get('department',''), r.get('teacherId',''))
        for r in rows
    ])
    conn.commit()
    conn.close()


def get_teacher_mapping(school_code, year):
    conn = get_db()
    rows = conn.execute(
        'SELECT cls, section, subject_code, subject_name, teacher_name, department, teacher_id FROM teacher_mapping WHERE school_code=? AND year=?',
        (school_code, year)
    ).fetchall()
    conn.close()
    return [{'class': r['cls'], 'section': r['section'], 'subjectCode': r['subject_code'],
             'subjectName': r['subject_name'], 'teacherName': r['teacher_name'],
             'department': r['department'], 'teacherId': r['teacher_id']}
            for r in rows]


# ── Follow-up notes ───────────────────────────────────────────

def save_follow_ups(school_code, year, notes_dict):
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
            INSERT INTO follow_up (school_code, year, cls, roll_no, status, owner, remarks)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(school_code, year, cls, roll_no) DO UPDATE SET
                status     = excluded.status,
                owner      = excluded.owner,
                remarks    = excluded.remarks,
                updated_at = CURRENT_TIMESTAMP
        ''', (school_code, year, cls, roll_no,
              note.get('status',''), note.get('owner',''), note.get('remarks','')))
    conn.commit()
    conn.close()


def get_follow_ups(school_code, year):
    """Returns dict in same format JS expects: { "X|rollNo": {status,owner,remarks} }"""
    conn = get_db()
    rows = conn.execute(
        'SELECT cls, roll_no, status, owner, remarks FROM follow_up WHERE school_code=? AND year=?',
        (school_code, year)
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

def save_combinations(combos):
    """Replace all combinations with the provided list."""
    conn = get_db()
    conn.execute('DELETE FROM combinations')
    for c in combos:
        conn.execute('''
            INSERT INTO combinations (id, name, selected_session_ids, default_class_scope, merit_scope)
            VALUES (?, ?, ?, ?, ?)
        ''', (c.get('id'), c.get('name'), json.dumps(c.get('selectedSessionIds',[])),
              c.get('defaultClassScope','X'), c.get('meritScope','same-class')))
    conn.commit()
    conn.close()


def list_combinations():
    conn = get_db()
    rows = conn.execute('SELECT * FROM combinations ORDER BY created_at').fetchall()
    conn.close()
    return [{
        'id':                 r['id'],
        'name':               r['name'],
        'selectedSessionIds': json.loads(r['selected_session_ids'] or '[]'),
        'defaultClassScope':  r['default_class_scope'],
        'meritScope':         r['merit_scope'],
        'createdAt':          r['created_at'],
    } for r in rows]
