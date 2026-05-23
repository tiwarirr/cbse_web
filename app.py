"""
app.py — Flask application for CBSE Result Dashboard
Serves the static frontend and provides the SQLite API for Phase 2 persistence.
"""

import os
from flask import Flask, render_template, jsonify, request, send_from_directory, abort
import db

# ── App setup ─────────────────────────────────────────────────
BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
MAPPING_DIR = os.path.join(BASE_DIR, 'static', 'mappings')

app = Flask(__name__, template_folder='templates', static_folder='static')
app.config['MAX_CONTENT_LENGTH'] = 20 * 1024 * 1024  # 20 MB upload limit

# Initialise database on startup
db.init_db()


# ── Frontend ──────────────────────────────────────────────────

@app.route('/')
def index():
    # app_version = mtime of app.js — forces browser to re-fetch after every deploy
    import os
    app_js_path = os.path.join(BASE_DIR, 'static', 'js', 'app.js')
    app_version = int(os.path.getmtime(app_js_path)) if os.path.exists(app_js_path) else 1
    return render_template('index.html', app_version=app_version)


# ── Health / mode-detection ───────────────────────────────────

@app.route('/api/ping')
def ping():
    """JS Store.detectMode() calls this to know the server is present."""
    return jsonify({'status': 'ok', 'mode': 'api'})


# ── Mapping files (Excel auto-load) ───────────────────────────

@app.route('/api/mappings/<path:filename>')
def serve_mapping(filename):
    """
    Serve Excel mapping files from the static/mappings/ directory.
    JS fetchMappingRows() tries /api/mappings/<filename> first.
    Put school mapping files in static/mappings/ with names like:
        60478-2025-student_master.xlsx
        60478-2025-teacher_mapping.xlsx
        60478-2025-internal_marks.xlsx
    """
    safe = os.path.basename(filename)          # no path traversal
    path = os.path.join(MAPPING_DIR, safe)
    if not os.path.isfile(path):
        abort(404)
    return send_from_directory(MAPPING_DIR, safe)


# ── Sessions API ──────────────────────────────────────────────

@app.route('/api/sessions', methods=['GET'])
def api_list_sessions():
    """Return list of saved sessions including raw text (needed by JS Store.loadAllSessions)."""
    sessions = db.list_sessions()
    # Normalise key names to camelCase for JS
    return jsonify([
        {
            'schoolCode': s['school_code'],
            'schoolName': s['school_name'] or '',
            'year':       s['year'],
            'cls':        s['cls'],
            'rawText':    s['raw_text'],
        }
        for s in sessions
    ])


@app.route('/api/sessions', methods=['POST'])
def api_save_session():
    """Save raw gazette text for one class of one school/year."""
    data = request.get_json(force=True)
    required = ('schoolCode', 'year', 'cls', 'rawText')
    if not all(data.get(k) for k in required):
        return jsonify({'error': 'schoolCode, year, cls and rawText are required'}), 400
    if data['cls'] not in ('X', 'XII'):
        return jsonify({'error': 'cls must be X or XII'}), 400

    db.save_session(
        school_code = data['schoolCode'],
        school_name = data.get('schoolName', ''),
        year        = str(data['year']),
        cls         = data['cls'],
        raw_text    = data['rawText'],
    )
    return jsonify({'status': 'saved'})


@app.route('/api/sessions/<school_code>/<year>', methods=['GET'])
def api_get_session(school_code, year):
    """Return raw text for all classes of a school/year."""
    rows = db.get_session(school_code, year)
    if not rows:
        abort(404)
    # Shape: [{cls, rawText, schoolName}]
    return jsonify([
        {'cls': r['cls'], 'rawText': r['raw_text'], 'schoolName': r.get('school_name', '')}
        for r in rows
    ])


@app.route('/api/sessions/<school_code>/<year>', methods=['DELETE'])
def api_delete_session(school_code, year):
    db.delete_session(school_code, year)
    return jsonify({'status': 'deleted'})


# ── Master data API ───────────────────────────────────────────

@app.route('/api/master/<school_code>/<year>/student', methods=['GET'])
def api_get_student_master(school_code, year):
    rows = db.get_student_master(school_code, year)
    return jsonify(rows)


@app.route('/api/master/<school_code>/<year>/student', methods=['POST'])
def api_save_student_master(school_code, year):
    rows = request.get_json(force=True)
    if not isinstance(rows, list):
        return jsonify({'error': 'Expected a JSON array'}), 400
    db.save_student_master(school_code, year, rows)
    return jsonify({'status': 'saved', 'count': len(rows)})


@app.route('/api/master/<school_code>/<year>/teacher', methods=['GET'])
def api_get_teacher_mapping(school_code, year):
    rows = db.get_teacher_mapping(school_code, year)
    return jsonify(rows)


@app.route('/api/master/<school_code>/<year>/teacher', methods=['POST'])
def api_save_teacher_mapping(school_code, year):
    rows = request.get_json(force=True)
    if not isinstance(rows, list):
        return jsonify({'error': 'Expected a JSON array'}), 400
    db.save_teacher_mapping(school_code, year, rows)
    return jsonify({'status': 'saved', 'count': len(rows)})


# ── Follow-up API ─────────────────────────────────────────────

@app.route('/api/followup/<school_code>/<year>', methods=['GET'])
def api_get_follow_ups(school_code, year):
    notes = db.get_follow_ups(school_code, year)
    return jsonify(notes)


@app.route('/api/followup/<school_code>/<year>', methods=['POST'])
def api_save_follow_ups(school_code, year):
    """Accept the full follow-up dict and upsert all rows."""
    notes = request.get_json(force=True)
    if not isinstance(notes, dict):
        return jsonify({'error': 'Expected a JSON object'}), 400
    db.save_follow_ups(school_code, year, notes)
    return jsonify({'status': 'saved', 'count': len(notes)})


# ── Performance marks API ────────────────────────────────────────

@app.route('/api/performance/<school_code>/<year>', methods=['GET'])
def api_get_performance_marks(school_code, year):
    rows, component_type = db.get_performance_marks(school_code, year)
    return jsonify({'rows': rows, 'componentType': component_type})


@app.route('/api/performance/<school_code>/<year>', methods=['POST'])
def api_save_performance_marks(school_code, year):
    data = request.get_json(force=True)
    rows = data.get('rows', [])
    component_type = data.get('componentType', 'internal')
    if not isinstance(rows, list):
        return jsonify({'error': 'rows must be a JSON array'}), 400
    db.save_performance_marks(school_code, year, component_type, rows)
    return jsonify({'status': 'saved', 'count': len(rows)})


# ── Combinations API ──────────────────────────────────────────

@app.route('/api/combinations', methods=['GET'])
def api_list_combinations():
    return jsonify(db.list_combinations())


@app.route('/api/combinations', methods=['POST'])
def api_save_combinations():
    """Accept the full combinations array and replace all saved combinations."""
    combos = request.get_json(force=True)
    if not isinstance(combos, list):
        return jsonify({'error': 'Expected a JSON array'}), 400
    db.save_combinations(combos)
    return jsonify({'status': 'saved', 'count': len(combos)})


# ── Dev server entry point ────────────────────────────────────

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)
