"""
app.py — Flask application for CBSE Result Dashboard
Serves the static frontend and provides the SQLite API for Phase 2 persistence.
"""

import os
from functools import wraps
from flask import Flask, render_template, jsonify, request, send_from_directory, abort, session
import db

# ── App setup ─────────────────────────────────────────────────
BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
MAPPING_DIR = os.path.join(BASE_DIR, 'static', 'mappings')

app = Flask(__name__, template_folder='templates', static_folder='static')
app.config['MAX_CONTENT_LENGTH'] = 20 * 1024 * 1024  # 20 MB upload limit
app.secret_key = os.environ.get('SECRET_KEY', 'cbse-dashboard-super-secret-key-1234')

# Initialise database on startup
db.init_db()


# ── Auth Decorators ───────────────────────────────────────────

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            return jsonify({'error': 'Unauthorized. Please login.'}), 401
        return f(*args, **kwargs)
    return decorated_function


def current_user():
    return session.get('user')


def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            return jsonify({'error': 'Unauthorized. Please login.'}), 401
        if session['user'].get('role') != 'admin':
            return jsonify({'error': 'Forbidden. Admin access required.'}), 403
        return f(*args, **kwargs)
    return decorated_function


def feature_required(feature_key):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user = current_user()
            if not user:
                return jsonify({'error': 'Unauthorized. Please login.'}), 401
            if user.get('role') == 'admin' or db.user_has_feature(user['id'], feature_key):
                return f(*args, **kwargs)
            return jsonify({'error': 'Premium feature not enabled for this account.'}), 403
        return decorated_function
    return decorator


def requested_owner_id():
    user = current_user()
    if not user:
        return None
    if user.get('role') != 'admin':
        return user['id']
    raw_owner_id = request.args.get('ownerUserId')
    try:
        return int(raw_owner_id) if raw_owner_id else None
    except (TypeError, ValueError):
        return None


def owner_for_resource(school_code, year):
    owner_id = requested_owner_id()
    if owner_id:
        return owner_id
    return db.session_owner_id(school_code, year, current_user())


def ensure_resource_access(school_code, year):
    user = current_user()
    if user and user.get('role') == 'admin':
        return True
    return db.user_can_access_session(user, school_code, year)


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


# ── Authentication API ────────────────────────────────────────

@app.route('/auth/login', methods=['POST'])
def auth_login():
    data = request.get_json(force=True) or {}
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400
    
    user = db.verify_user(username, password)
    if user:
        session.clear()
        session['user'] = user
        return jsonify({'status': 'success', 'user': user})
    return jsonify({'error': 'Invalid username or password'}), 401


@app.route('/auth/register', methods=['POST'])
def auth_register():
    data = request.get_json(force=True) or {}
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''
    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400
    if len(password) < 4:
        return jsonify({'error': 'Password must be at least 4 characters long'}), 400

    user = db.create_user(username, password, 'user')
    if not user:
        return jsonify({'error': 'Username already exists'}), 409
    session.clear()
    session['user'] = user
    return jsonify({'status': 'success', 'user': user}), 201


@app.route('/auth/logout', methods=['POST'])
def auth_logout():
    session.clear()
    return jsonify({'status': 'success'})


@app.route('/auth/status', methods=['GET'])
def auth_status():
    if 'user' in session:
        fresh = db.get_user_by_id(session['user']['id'])
        if fresh:
            session['user'] = fresh
        return jsonify({'loggedIn': True, 'user': session['user']})
    return jsonify({'loggedIn': False, 'user': None})


@app.route('/api/users/change-password', methods=['POST'])
@login_required
def auth_change_password():
    data = request.get_json(force=True) or {}
    new_password = data.get('password')
    if not new_password or len(new_password) < 4:
        return jsonify({'error': 'Password must be at least 4 characters long'}), 400
    db.change_password(session['user']['username'], new_password)
    return jsonify({'status': 'success', 'message': 'Password updated successfully'})


# ── Admin User Management API ─────────────────────────────────

@app.route('/api/admin/users', methods=['GET'])
@admin_required
def admin_list_users():
    users = db.list_users()
    return jsonify(users)


@app.route('/api/admin/users', methods=['POST'])
@admin_required
def admin_register_user():
    data = request.get_json(force=True) or {}
    username = data.get('username')
    password = data.get('password')
    role = data.get('role', 'user')
    
    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400
    if role not in ('admin', 'user'):
        return jsonify({'error': 'Invalid role. Must be admin or user.'}), 400
    if len(password) < 4:
        return jsonify({'error': 'Password must be at least 4 characters long'}), 400
        
    user = db.create_user(username, password, role)
    if user:
        return jsonify({'status': 'success', 'user': user}), 201
    return jsonify({'error': 'Username already exists'}), 409


@app.route('/api/admin/users/<int:user_id>/features', methods=['GET'])
@admin_required
def admin_get_user_features(user_id):
    user = db.get_user_by_id(user_id)
    if not user:
        abort(404)
    return jsonify(user['features'])


@app.route('/api/admin/users/<int:user_id>/features', methods=['POST'])
@admin_required
def admin_update_user_features(user_id):
    target = db.get_user_by_id(user_id)
    if not target:
        abort(404)
    if target['role'] == 'admin':
        return jsonify({'error': 'Admin users already have all features.'}), 400
    features = request.get_json(force=True) or {}
    db.set_user_features(user_id, features)
    return jsonify({'status': 'success', 'features': db.get_feature_map(user_id)})


@app.route('/api/admin/users/<username>', methods=['DELETE'])
@admin_required
def admin_delete_user(username):
    if username.lower() == 'admin':
        return jsonify({'error': 'Cannot delete master admin user'}), 400
    if username.lower() == session['user']['username'].lower():
        return jsonify({'error': 'Cannot delete yourself'}), 400
        
    db.delete_user(username)
    return jsonify({'status': 'success', 'message': f'User {username} deleted'})


@app.route('/api/admin/reset-data', methods=['POST'])
@admin_required
def admin_reset_data():
    db.reset_all_data()
    return jsonify({'status': 'success', 'message': 'All school data has been wiped from the database.'})


# ── Mapping files (Excel auto-load) ───────────────────────────

@app.route('/api/mappings/<path:filename>')
@login_required
def serve_mapping(filename):
    """
    Serve Excel mapping files from the static/mappings/ directory.
    JS fetchMappingRows() tries /api/mappings/<filename> first.
    """
    safe = os.path.basename(filename)          # no path traversal
    path = os.path.join(MAPPING_DIR, safe)
    if not os.path.isfile(path):
        abort(404)
    return send_from_directory(MAPPING_DIR, safe)


# ── Sessions API ──────────────────────────────────────────────

@app.route('/api/sessions', methods=['GET'])
@login_required
def api_list_sessions():
    """Return list of saved sessions including raw text (needed by JS Store.loadAllSessions)."""
    sessions = db.list_sessions(current_user())
    # Normalise key names to camelCase for JS
    return jsonify([
        {
            'schoolCode': s['school_code'],
            'schoolName': s['school_name'] or '',
            'year':       s['year'],
            'cls':        s['cls'],
            'examLabel':  s.get('exam_label') or 'Main',
            'examDate':   s.get('exam_date') or '',
            'rawText':    s['raw_text'],
            'ownerUserId': s.get('owner_user_id'),
            'ownerUsername': s.get('owner_username') or '',
        }
        for s in sessions
    ])


@app.route('/api/sessions', methods=['POST'])
@login_required
def api_save_session():
    """Save raw gazette text for one exam attempt of one class of one school/year."""
    data = request.get_json(force=True)
    required = ('schoolCode', 'year', 'cls', 'rawText')
    if not all(data.get(k) for k in required):
        return jsonify({'error': 'schoolCode, year, cls and rawText are required'}), 400
    if data['cls'] not in ('X', 'XII'):
        return jsonify({'error': 'cls must be X or XII'}), 400
    user = current_user()
    if user.get('role') != 'admin':
        exists = db.session_class_exists(user['id'], data['schoolCode'], str(data['year']), data['cls'])
        if not exists and db.result_file_count(user['id']) >= 2:
            return jsonify({'error': 'Regular users can upload only two result files.'}), 403

    db.save_session(
        school_code = data['schoolCode'],
        school_name = data.get('schoolName', ''),
        year        = str(data['year']),
        cls         = data['cls'],
        raw_text    = data['rawText'],
        owner_user_id = user['id'],
        owner_username = user['username'],
        exam_label  = (data.get('examLabel') or 'Main').strip() or 'Main',
        exam_date   = data.get('examDate') or None,
    )
    return jsonify({'status': 'saved'})


@app.route('/api/sessions/<school_code>/<year>', methods=['GET'])
@login_required
def api_get_session(school_code, year):
    """Return raw text for all classes of a school/year."""
    if not ensure_resource_access(school_code, year):
        return jsonify({'error': 'Forbidden'}), 403
    rows = db.get_session(school_code, year, current_user(), requested_owner_id())
    if not rows:
        abort(404)
    # Shape: [{cls, examLabel, rawText, schoolName}]
    return jsonify([
        {
            'cls': r['cls'],
            'examLabel': r.get('exam_label') or 'Main',
            'examDate': r.get('exam_date') or '',
            'rawText': r['raw_text'],
            'schoolName': r.get('school_name', ''),
            'ownerUserId': r.get('owner_user_id'),
            'ownerUsername': r.get('owner_username') or '',
        }
        for r in rows
    ])


@app.route('/api/sessions/<school_code>/<year>', methods=['DELETE'])
@login_required
def api_delete_session(school_code, year):
    if not ensure_resource_access(school_code, year):
        return jsonify({'error': 'Forbidden'}), 403
    db.delete_session(school_code, year, current_user(), owner_user_id=requested_owner_id())
    return jsonify({'status': 'deleted'})


@app.route('/api/sessions/<school_code>/<year>/attempt', methods=['DELETE'])
@login_required
def api_delete_session_attempt(school_code, year):
    """Remove a single exam attempt (e.g. just 'Exam 2') without touching master data or other attempts."""
    if not ensure_resource_access(school_code, year):
        return jsonify({'error': 'Forbidden'}), 403
    data = request.get_json(force=True) or {}
    cls = data.get('cls')
    exam_label = data.get('examLabel')
    if cls not in ('X', 'XII') or not exam_label:
        return jsonify({'error': 'cls and examLabel are required'}), 400
    db.delete_session_attempt(school_code, year, cls, exam_label, current_user())
    return jsonify({'status': 'deleted'})


# ── Master data API ───────────────────────────────────────────

@app.route('/api/master/<school_code>/<year>/student', methods=['GET'])
@login_required
def api_get_student_master(school_code, year):
    if not ensure_resource_access(school_code, year):
        return jsonify({'error': 'Forbidden'}), 403
    rows = db.get_student_master(school_code, year, owner_for_resource(school_code, year))
    return jsonify(rows)


@app.route('/api/master/<school_code>/<year>/student', methods=['POST'])
@login_required
@feature_required('student_master_upload')
def api_save_student_master(school_code, year):
    if not ensure_resource_access(school_code, year):
        return jsonify({'error': 'Forbidden'}), 403
    rows = request.get_json(force=True)
    if not isinstance(rows, list):
        return jsonify({'error': 'Expected a JSON array'}), 400
    db.save_student_master(school_code, year, rows, owner_for_resource(school_code, year))
    return jsonify({'status': 'saved', 'count': len(rows)})


@app.route('/api/master/<school_code>/<year>/teacher', methods=['GET'])
@login_required
def api_get_teacher_mapping(school_code, year):
    if not ensure_resource_access(school_code, year):
        return jsonify({'error': 'Forbidden'}), 403
    rows = db.get_teacher_mapping(school_code, year, owner_for_resource(school_code, year))
    return jsonify(rows)


@app.route('/api/master/<school_code>/<year>/teacher', methods=['POST'])
@login_required
@feature_required('teacher_mapping_upload')
def api_save_teacher_mapping(school_code, year):
    if not ensure_resource_access(school_code, year):
        return jsonify({'error': 'Forbidden'}), 403
    rows = request.get_json(force=True)
    if not isinstance(rows, list):
        return jsonify({'error': 'Expected a JSON array'}), 400
    db.save_teacher_mapping(school_code, year, rows, owner_for_resource(school_code, year))
    return jsonify({'status': 'saved', 'count': len(rows)})


# ── Follow-up API ─────────────────────────────────────────────

@app.route('/api/followup/<school_code>/<year>', methods=['GET'])
@login_required
def api_get_follow_ups(school_code, year):
    if not ensure_resource_access(school_code, year):
        return jsonify({'error': 'Forbidden'}), 403
    notes = db.get_follow_ups(school_code, year, owner_for_resource(school_code, year))
    return jsonify(notes)


@app.route('/api/followup/<school_code>/<year>', methods=['POST'])
@login_required
def api_save_follow_ups(school_code, year):
    """Accept the full follow-up dict and upsert all rows."""
    if not ensure_resource_access(school_code, year):
        return jsonify({'error': 'Forbidden'}), 403
    notes = request.get_json(force=True)
    if not isinstance(notes, dict):
        return jsonify({'error': 'Expected a JSON object'}), 400
    db.save_follow_ups(school_code, year, notes, owner_for_resource(school_code, year))
    return jsonify({'status': 'saved', 'count': len(notes)})


# ── Performance marks API ────────────────────────────────────────

@app.route('/api/performance/<school_code>/<year>', methods=['GET'])
@login_required
def api_get_performance_marks(school_code, year):
    if not ensure_resource_access(school_code, year):
        return jsonify({'error': 'Forbidden'}), 403
    rows, component_type = db.get_performance_marks(school_code, year, owner_for_resource(school_code, year))
    return jsonify({'rows': rows, 'componentType': component_type})


@app.route('/api/performance/<school_code>/<year>', methods=['POST'])
@login_required
@feature_required('performance_marks_upload')
def api_save_performance_marks(school_code, year):
    if not ensure_resource_access(school_code, year):
        return jsonify({'error': 'Forbidden'}), 403
    data = request.get_json(force=True)
    rows = data.get('rows', [])
    component_type = data.get('componentType', 'internal')
    if not isinstance(rows, list):
        return jsonify({'error': 'rows must be a JSON array'}), 400
    db.save_performance_marks(school_code, year, component_type, rows, owner_for_resource(school_code, year))
    return jsonify({'status': 'saved', 'count': len(rows)})


# ── Combinations API ──────────────────────────────────────────

@app.route('/api/combinations', methods=['GET'])
@login_required
def api_list_combinations():
    return jsonify(db.list_combinations(current_user()))


@app.route('/api/combinations', methods=['POST'])
@login_required
def api_save_combinations():
    """Accept the full combinations array and replace all saved combinations."""
    combos = request.get_json(force=True)
    if not isinstance(combos, list):
        return jsonify({'error': 'Expected a JSON array'}), 400
    db.save_combinations(combos, current_user()['id'])
    return jsonify({'status': 'saved', 'count': len(combos)})


# ── Dev server entry point ────────────────────────────────────

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)
