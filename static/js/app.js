/* ── SUBJECT NAMES  (source: cbseacademic.nic.in + cbse.gov.in, verified Mar 2026) ── */
const SN = {
  // ── CLASS X / IX  LANGUAGES ──
  '001':'English Elective',   '002':'Hindi Course-A',            '003':'Urdu Elective',
  '085':'Hindi Course-B',     '122':'Sanskrit',                  '184':'English Lang. & Lit.',

  // ── CLASS X  CORE ACADEMIC ──
  '041':'Mathematics (Standard)', '241':'Mathematics (Basic)',
  '086':'Science',                '087':'Social Science',
  '064':'Home Science',           '076':'NCC',

  // ── CLASS X  SKILL SUBJECTS (400-series, cbseacademic.nic.in) ──
  '401':'Retail',                     '402':'Information Technology',
  '403':'Security',                   '404':'Automotive',
  '405':'Intro to Financial Markets', '406':'Tourism',
  '407':'Beauty & Wellness',          '408':'Agriculture',
  '409':'Food Production',            '410':'Front Office Operations',
  '411':'Banking & Insurance',        '412':'Marketing & Sales',
  '413':'Health Care',                '414':'Apparel',
  '415':'Multimedia',                 '416':'Multi Skill Foundation',
  '417':'Artificial Intelligence',    '418':'Physical Activity Trainer',
  '419':'Data Science',               '420':'Electronics & Hardware',
  '421':'Pharma & Biotechnology',     '422':'Design Thinking',

  // ── CLASS XII  LANGUAGES ──
  '301':'English Core',  '302':'Hindi Core',   '303':'Urdu Core',
  '322':'Sanskrit Core', '118':'French',       '120':'German',
  '104':'Punjabi',       '105':'Bengali',      '106':'Tamil',
  '107':'Telugu',        '108':'Sindhi',       '109':'Marathi',
  '110':'Gujarati',      '112':'Malayalam',    '113':'Odia',
  '114':'Assamese',      '115':'Kannada',

  // ── CLASS XII  ACADEMIC ELECTIVES (careers360 + cbse.gov.in) ──
  '027':'History',                  '028':'Political Science',
  '029':'Geography',                '030':'Economics',
  '031':'Carnatic Music Vocal',     '032':'Carnatic Music Mel. Ins.',
  '033':'Carnatic Perc. (Mridangam)','034':'Hindustani Music Vocal',
  '035':'Hindustani Music Mel. Ins.','036':'Hindustani Perc. Ins.',
  '037':'Psychology',               '039':'Sociology',
  '041':'Mathematics',              '241':'Applied Mathematics',
  '042':'Physics',                  '043':'Chemistry',
  '044':'Biology',                  '045':'Biotechnology',
  '046':'Engineering Graphics',     '048':'Physical Education',
  '049':'Painting',                 '050':'Graphics',
  '051':'Sculpture',                '052':'Applied / Commercial Art',
  '054':'Business Studies',         '055':'Accountancy',
  '056':'Kathak Dance',             '057':'Bharatnatyam Dance',
  '058':'Kuchipudi Dance',          '059':'Odissi Dance',
  '060':'Manipuri Dance',           '061':'Kathakali Dance',
  '065':'Informatics Practices',    '066':'Entrepreneurship',
  '073':'Knowledge Trad. & Practices','074':'Legal Studies',
  '083':'Computer Science',

  // ── CLASS XII  SKILL SUBJECTS (800-series, cbseacademic.nic.in) ──
  '801':'Retail',                        '802':'Information Technology',
  '803':'Web Applications',              '804':'Automotive',
  '805':'Financial Markets Management',  '806':'Tourism',
  '807':'Beauty & Wellness',             '808':'Agriculture',
  '809':'Food Production',               '810':'Front Office Operations',
  '811':'Banking',                       '812':'Marketing',
  '813':'Health Care',                   '814':'Insurance',
  '816':'Horticulture',                  '817':'Typography & Computer Application',
  '818':'Geospatial Technology',         '819':'Electrical Technology',
  '820':'Electronics Technology',        '821':'Multimedia',
  '822':'Taxation',                      '823':'Cost Accounting',
  '824':'Office Procedures & Practices', '825':'Shorthand (English)',
  '826':'Shorthand (Hindi)',             '827':'Air Conditioning & Refrigeration',
  '828':'Medical Diagnostics',           '829':'Textile Design',
  '830':'Design',                        '831':'Salesmanship',
  '833':'Business Administration',       '834':'Food Nutrition & Dietetics',
  '835':'Mass Media Studies',            '836':'Library & Information Science',
  '837':'Fashion Studies',               '841':'Yoga',
  '842':'Early Childhood Care & Edu.',   '843':'Artificial Intelligence',
  '844':'Data Science',                  '845':'Physical Activity Trainer',
  '846':'Land Transportation',           '847':'Electronics & Hardware',
  '848':'Design Thinking & Innovation',
};
const CLASS_SUBJECT_NAMES = {
  X: {
    '241': 'Mathematics Basic',
  },
  XII: {
    '241': 'Applied Mathematics',
  },
};
const sn = (c, cls) => CLASS_SUBJECT_NAMES[cls]?.[c] || SN[c] || `Subj ${c}`;


const raw = {X:null, XII:null};
const DB = {X:[], XII:[]};
const parseDiagnostics = {X:null, XII:null};
const uploadRaw = {X:null, XII:null};
const schoolSessions = {};
let savedCombinations = [];
let currentCombinedMerit = null;
let currentExamComparison = null;

let charts = {};
let activeCls = null;
let activeSec = 'summary';
let overlayState = null;
let activeSessionId = null;
const workspaceState = {
  selectedSessionIds: [],
  mode: 'single',
  comparisonYear: 'all',
  classScope: 'X',
  meritScope: 'same-class',
  activeCombinationId: null,
};
const COMBO_STORAGE_KEY = 'CBSE-MULTI-COMBINATIONS';
const STUDENT_MASTER_SUFFIX = 'STUDENTMASTER';
const TEACHER_MAPPING_SUFFIX = 'TEACHERMAPPING';
const FOLLOW_UP_SUFFIX = 'FOLLOWUP';

// sort state per class
const sortState  = {};
// current filtered+sorted pool per class — used by exportCurrentView
const currentPool = {};
const subjectViewState = {};
const performanceViewState = {X:'total', XII:'total'};


/* ══════════════════════════════════════════════════════════════
   STORE — persistence adapter
   Phase 1: localStorage only (same behaviour as before)
   Phase 2: switches to Flask/SQLite API when server detected
   All rendering code is unaffected — only the persistence
   call sites are routed through this object.
══════════════════════════════════════════════════════════════ */
const Store = {
  mode: 'local',   // 'local' | 'api'
  user: null,

  hasFeature(key){
    return this.mode !== 'api' || this.user?.role === 'admin' || !!this.user?.features?.[key];
  },

  ownerQuery(session){
    if(this.mode !== 'api' || !session?.ownerUserId) return '';
    return `?ownerUserId=${encodeURIComponent(session.ownerUserId)}`;
  },

  async detectMode(){
    try {
      const r = await fetch('/api/ping', {method:'GET', cache:'no-store'});
      if(r.ok){ this.mode = 'api'; return 'api'; }
    } catch { /* no server */ }
    this.mode = 'local';
    return 'local';
  },

  async checkAuth() {
    if (this.mode !== 'api') return { loggedIn: false, user: null };
    try {
      const r = await fetch('/auth/status', { cache: 'no-store' });
      if (r.ok) {
        const data = await r.json();
        this.user = data.loggedIn ? data.user : null;
        return data;
      }
    } catch (e) {
      console.error('[Store] checkAuth failed', e);
    }
    this.user = null;
    return { loggedIn: false, user: null };
  },

  async login(username, password) {
    if (this.mode !== 'api') return { error: 'Offline mode' };
    try {
      const r = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await r.json();
      if (r.ok) {
        this.user = data.user;
        return { success: true, user: data.user };
      }
      return { error: data.error || 'Login failed' };
    } catch (e) {
      return { error: 'Network error occurred' };
    }
  },

  async logout() {
    if (this.mode !== 'api') return { success: true };
    try {
      const r = await fetch('/auth/logout', { method: 'POST' });
      if (r.ok) {
        this.user = null;
        return { success: true };
      }
    } catch (e) {
      console.error('[Store] logout failed', e);
    }
    return { error: 'Logout failed' };
  },

  async changePassword(password) {
    if (this.mode !== 'api') return { error: 'Offline mode' };
    try {
      const r = await fetch('/api/users/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await r.json();
      if (r.ok) return { success: true };
      return { error: data.error || 'Failed to change password' };
    } catch (e) {
      return { error: 'Network error occurred' };
    }
  },

  async registerUser(username, password, role) {
    if (this.mode !== 'api') return { error: 'Offline mode' };
    try {
      const r = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role })
      });
      const data = await r.json();
      if (r.ok) return { success: true, user: data.user };
      return { error: data.error || 'Failed to register user' };
    } catch (e) {
      return { error: 'Network error occurred' };
    }
  },

  async registerSelf(username, password) {
    if (this.mode !== 'api') return { error: 'Offline mode' };
    try {
      const r = await fetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await r.json();
      if (r.ok) {
        this.user = data.user;
        return { success: true, user: data.user };
      }
      return { error: data.error || 'Registration failed' };
    } catch (e) {
      return { error: 'Network error occurred' };
    }
  },

  async updateUserFeatures(userId, features) {
    if (this.mode !== 'api') return { error: 'Offline mode' };
    try {
      const r = await fetch(`/api/admin/users/${userId}/features`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(features)
      });
      const data = await r.json();
      if (r.ok) return { success: true, features: data.features };
      return { error: data.error || 'Failed to update features' };
    } catch (e) {
      return { error: 'Network error occurred' };
    }
  },

  async listUsers() {
    if (this.mode !== 'api') return [];
    try {
      const r = await fetch('/api/admin/users');
      if (r.status === 401) { this.user = null; syncUserUI(); return []; }
      if (r.ok) return await r.json();
    } catch (e) {
      console.error('[Store] listUsers failed', e);
    }
    return [];
  },

  async deleteUser(username) {
    if (this.mode !== 'api') return { error: 'Offline mode' };
    try {
      const r = await fetch(`/api/admin/users/${username}`, { method: 'DELETE' });
      if (r.status === 401) { this.user = null; syncUserUI(); return { error: 'Session expired' }; }
      const data = await r.json();
      if (r.ok) return { success: true };
      return { error: data.error || 'Failed to delete user' };
    } catch (e) {
      return { error: 'Network error occurred' };
    }
  },

  async saveSession(session){
    const examLabel = normalizeExamLabel(session.examLabel);
    if(this.mode === 'api'){
      for(const cls of ['X','XII']){
        const bundle = session.classes[cls];
        if(!bundle) continue;
        const r = await fetch('/api/sessions', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({
            schoolCode: session.schoolCode,
            schoolName: session.schoolName,
            year: session.year,
            cls,
            rawText: bundle.rawText,
            examLabel,
            examDate: bundle.examDate || '',
          }),
        });
        if (r.status === 401) { this.user = null; syncUserUI(); return; }
      }
    } else {
      const suffix = examLabel === DEFAULT_EXAM_LABEL ? '' : `--${slugifyExamLabel(examLabel)}`;
      ['X','XII'].forEach(cls => {
        const bundle = session.classes[cls];
        if(bundle) localStorage.setItem(`${session.schoolCode}-${session.year}-${cls}${suffix}`, bundle.rawText);
      });
    }
  },

  async loadAllSessions(){
    if(this.mode === 'api'){
      try {
        const r = await fetch('/api/sessions', {cache:'no-store'});
        if (r.status === 401) { this.user = null; syncUserUI(); return {}; }
        if(!r.ok) return {};
        const list = await r.json();
        const grouped = {};
        list.forEach(item => {
          const sid = createSessionId(item.schoolCode, item.year, item.examLabel, item.ownerUserId);
          if(!grouped[sid]) grouped[sid] = {
            X:null,
            XII:null,
            examDates:{},
            schoolCode:item.schoolCode,
            schoolName:item.schoolName,
            year:item.year,
            examLabel:item.examLabel || DEFAULT_EXAM_LABEL,
            ownerUserId:item.ownerUserId,
            ownerUsername:item.ownerUsername,
          };
          grouped[sid][item.cls] = item.rawText;
          grouped[sid].examDates[item.cls] = item.examDate || '';
        });
        return grouped;
      } catch { return {}; }
    } else {
      const pattern = /^(.+)-(\d{4})-(X|XII)(?:--([a-z0-9-]+))?$/;
      const grouped = {};
      for(let i=0;i<localStorage.length;i++){
        const key = localStorage.key(i);
        const match = key && key.match(pattern);
        if(!match) continue;
        const [, schoolCode, year, cls, labelSlug] = match;
        const examLabel = labelSlug || DEFAULT_EXAM_LABEL;
        const sid = createSessionId(schoolCode, year, examLabel);
        if(!grouped[sid]) grouped[sid] = {X:null, XII:null, examDates:{}, schoolCode, year, examLabel};
        grouped[sid][cls] = localStorage.getItem(key);
      }
      return grouped;
    }
  },

  async deleteSession(schoolCode, year, sessionRef=null){
    if(this.mode === 'api'){
      const session = sessionRef || Object.values(schoolSessions).find(s => s.schoolCode === schoolCode && String(s.year) === String(year));
      const r = await fetch(`/api/sessions/${schoolCode}/${year}${this.ownerQuery(session)}`, {method:'DELETE'});
      if (r.status === 401) { this.user = null; syncUserUI(); return; }
    } else {
      ['X','XII'].forEach(cls => {
        localStorage.removeItem(`${schoolCode}-${year}-${cls}`);
        const prefix = `${schoolCode}-${year}-${cls}--`;
        for(let i = localStorage.length - 1; i >= 0; i--){
          const key = localStorage.key(i);
          if(key && key.startsWith(prefix)) localStorage.removeItem(key);
        }
      });
    }
  },

  async deleteSessionAttempt(schoolCode, year, cls, examLabel, sessionRef=null){
    if(this.mode === 'api'){
      const r = await fetch(`/api/sessions/${schoolCode}/${year}/attempt${this.ownerQuery(sessionRef)}`, {
        method:'DELETE',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({cls, examLabel}),
      });
      if (r.status === 401) { this.user = null; syncUserUI(); return; }
    } else {
      const suffix = normalizeExamLabel(examLabel) === DEFAULT_EXAM_LABEL ? '' : `--${slugifyExamLabel(examLabel)}`;
      localStorage.removeItem(`${schoolCode}-${year}-${cls}${suffix}`);
    }
  },

  async saveFollowUps(session){
    const followUps = session.masterData?.followUps || {};
    if(this.mode === 'api'){
      const r = await fetch(`/api/followup/${session.schoolCode}/${session.year}${this.ownerQuery(session)}`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(followUps),
      });
      if (r.status === 401) { this.user = null; syncUserUI(); return; }
    } else {
      localStorage.setItem(
        `${session.schoolCode}-${session.year}-FOLLOWUP`,
        JSON.stringify(followUps)
      );
    }
  },

  async loadFollowUps(session){
    if(this.mode === 'api'){
      try {
        const r = await fetch(`/api/followup/${session.schoolCode}/${session.year}${this.ownerQuery(session)}`);
        if (r.status === 401) { this.user = null; syncUserUI(); return {}; }
        if(r.ok) return await r.json();
      } catch {}
      return {};
    } else {
      try {
        return JSON.parse(localStorage.getItem(`${session.schoolCode}-${session.year}-FOLLOWUP`) || '{}');
      } catch { return {}; }
    }
  },

  async saveCombinations(combos){
    if(this.mode === 'api'){
      const r = await fetch('/api/combinations', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(combos),
      });
      if (r.status === 401) { this.user = null; syncUserUI(); return; }
    } else {
      localStorage.setItem('CBSE-MULTI-COMBINATIONS', JSON.stringify(combos));
    }
  },

  async loadCombinations(){
    if(this.mode === 'api'){
      try {
        const r = await fetch('/api/combinations');
        if (r.status === 401) { this.user = null; syncUserUI(); return []; }
        if(r.ok) return await r.json();
      } catch {}
      return [];
    } else {
      try {
        const raw = localStorage.getItem('CBSE-MULTI-COMBINATIONS');
        const c = raw ? JSON.parse(raw) : [];
        return Array.isArray(c) ? c : [];
      } catch { return []; }
    }
  },

  async savePerformanceMarks(session, rows, componentType){
    if(this.mode === 'api'){
      try {
        const r = await fetch(`/api/performance/${session.schoolCode}/${session.year}${this.ownerQuery(session)}`, {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({rows, componentType}),
        });
        if (r.status === 401) { this.user = null; syncUserUI(); return; }
        const data = await r.json();
        console.log('[CBSE save] savePerformanceMarks status='+r.status+' rows='+rows.length, data);
      } catch(err) {
        console.error('[CBSE save] savePerformanceMarks FAILED', err);
      }
    }
  },

  async loadPerformanceMarks(session){
    if(this.mode === 'api'){
      try {
        const r = await fetch(`/api/performance/${session.schoolCode}/${session.year}${this.ownerQuery(session)}`);
        if (r.status === 401) { this.user = null; syncUserUI(); return {rows:[], componentType:null}; }
        if(r.ok) return await r.json();  // {rows, componentType}
      } catch {}
    }
    return {rows:[], componentType:null};
  },

  async saveMasterRows(session, type, rows){
    if(this.mode === 'api'){
      try {
        const r = await fetch(`/api/master/${session.schoolCode}/${session.year}/${type}${this.ownerQuery(session)}`, {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify(rows),
        });
        if (r.status === 401) { this.user = null; syncUserUI(); return; }
        const data = await r.json();
        console.log('[CBSE save] saveMasterRows', type, 'status='+r.status, 'schoolCode='+session.schoolCode, 'year='+session.year, 'rows='+rows.length, 'response='+JSON.stringify(data));
      } catch(err) {
        console.error('[CBSE save] saveMasterRows FAILED', type, err);
      }
    }
  },

  async loadMasterRows(session, type){
    if(this.mode === 'api'){
      try {
        const r = await fetch(`/api/master/${session.schoolCode}/${session.year}/${type}${this.ownerQuery(session)}`);
        if (r.status === 401) { this.user = null; syncUserUI(); return []; }
        if(r.ok) return await r.json();
      } catch {}
    }
    return [];
  },
};

/*
 * Shared student record contract used by renderers and exports:
 * { rollNo, gender, name, result, cls, compSub, subjects }
 * subjects: [{ code, name, marks, grade }]
 */
function createStudentRecord({rollNo, gender, name, result, cls, compSub, subjects}){
  return {rollNo, gender, name, result, cls, compSub, subjects};
}

function subjectIsAbsent(subject){
  return subject.grade === 'AB';
}

function subjectIsFail(subject){
  if(subjectIsAbsent(subject)) return false;
  if(subject.grade === 'E') return true;
  // Grade-NA fallback: gazette files without explicit grades
  return subject.grade === 'NA' && subject.marks < cbsePassMarkForSubject(subject);
}

function subjectIsPass(subject){
  return !subjectIsAbsent(subject) && !subjectIsFail(subject);
}
/* ── CBSE pass-mark calculation ─────────────────────────────
   CBSE rule: passing threshold = Math.round(maxMarks * 0.33)
   Verified official values:
     100 marks → 33,  80 marks → 26,  70 marks → 23
      50 marks → 17,  30 marks → 10,  20 marks →  7
   Note: for gazette analysis the grade (E / D2 etc.) is
   authoritative — this function is only used as a fallback
   for rare gazette files that carry marks but no grade codes,
   and for the performance-upload component analysis.
─────────────────────────────────────────────────────────── */
function cbsePassMark(maxMarks){
  // Math.round matches all known official CBSE thresholds
  return Math.round((maxMarks || 100) * 0.33);
}

function cbsePassMarkForSubject(subject){
  // Use componentMaxMarks if available (theory/practical split),
  // otherwise assume the gazette mark is out of 100.
  if(Number.isFinite(subject.theoryMaxMarks) && subject.theoryMaxMarks > 0){
    return cbsePassMark(subject.theoryMaxMarks);
  }
  return cbsePassMark(100);  // gazette total mark is always out of 100
}

function createEmptyMasterData(){
  return {
    studentMaster: [],
    teacherMappings: [],
    performanceMarks: {
      componentType: null,
      rows: [],
      reportRows: [],
    },
    followUps: {},
    mappingFiles: {
      studentMaster: {status:'idle', fileName:'', expected:[]},
      teacherMappings: {status:'idle', fileName:'', expected:[]},
      performanceMarks: {status:'idle', fileName:'', expected:[]},
    },
    diagnostics: {
      studentMaster: {rows:0, matched:0, unmapped:0},
      teacherMappings: {rows:0, matched:0, unmapped:0},
      performanceMarks: {rows:0, matched:0, unmatched:0, duplicateRows:0, duplicateKeys:0, derivedTheory:0, missingCoverage:0, scopedClasses:[]},
    }
  };
}

const DEFAULT_EXAM_LABEL = 'Main';

function slugifyExamLabel(label){
  return String(label || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function normalizeExamLabel(label){
  return String(label || '').trim() || DEFAULT_EXAM_LABEL;
}

// Sessions tagged with the default label keep the original id shape (schoolCode-year[-uOwner])
// so existing saved combinations / backups made before exam attempts existed keep resolving.
function createSessionId(schoolCode, year, examLabel, ownerUserId){
  const base = `${schoolCode || 'CBSE'}-${year || new Date().getFullYear()}`;
  const slug = slugifyExamLabel(examLabel);
  const withLabel = (slug && slug !== slugifyExamLabel(DEFAULT_EXAM_LABEL)) ? `${base}-${slug}` : base;
  return ownerUserId ? `${withLabel}-u${ownerUserId}` : withLabel;
}

function getSessionStorageKey(session, suffix){
  return `${session.schoolCode}-${session.year}-${suffix}`;
}

function getMappingStorageKey(session, type){
  return getSessionStorageKey(session, type === 'student' ? STUDENT_MASTER_SUFFIX : TEACHER_MAPPING_SUFFIX);
}

function getSessionLabel(session){
  const base = session.schoolName || session.schoolCode || 'Unknown School';
  if(Store.mode === 'api' && Store.user?.role === 'admin' && session.ownerUsername){
    return `${base} (${session.ownerUsername})`;
  }
  return base;
}

function getActiveSessions(){
  return workspaceState.selectedSessionIds
    .map(id => schoolSessions[id])
    .filter(Boolean);
}

function isMultiMode(){
  return workspaceState.mode === 'multi' && getActiveSessions().length > 1;
}

function updateMixedYearBanner(){
  const sessions = getActiveSessions();
  const years = new Set(sessions.map(session => session.year).filter(Boolean));
  const banner = document.getElementById('mixed-year-banner');
  if(years.size > 1 && isMultiMode()) banner.classList.add('show');
  else banner.classList.remove('show');
}

function renderActiveWorkspaceHeader(){
  const sessions = getActiveSessions();
  if(isMultiMode()){
    const schoolCount = sessions.length;
    const years = [...new Set(sessions.map(session => session.year).filter(Boolean))];
    const examLabels = [...new Set(sessions.map(session => normalizeExamLabel(session.examLabel)))];
    let examNote = '';
    if(examLabels.length > 1) examNote = ' &nbsp;&middot;&nbsp; Mixed exam attempts';
    else if(examLabels[0] && examLabels[0] !== DEFAULT_EXAM_LABEL) examNote = ` &nbsp;&middot;&nbsp; ${escapeHtml(examLabels[0])}`;
    document.getElementById('hschool').textContent = 'Multi-School Workspace';
    document.getElementById('hmeta').innerHTML =
      `${schoolCount} school${schoolCount > 1 ? 's' : ''} selected` +
      `<br><span style="opacity:.6">${workspaceState.classScope === 'all' ? 'All classes' : `Class ${workspaceState.classScope}`} &nbsp;&middot;&nbsp; ` +
      `${workspaceState.comparisonYear === 'all' ? 'All years' : workspaceState.comparisonYear}` +
      `${years.length > 1 ? ' &nbsp;&middot;&nbsp; Mixed years' : ''}${examNote}</span>`;
    return;
  }

  const session = activeSessionId ? schoolSessions[activeSessionId] : null;
  if(!session){
    document.getElementById('hschool').textContent = 'CBSE Result Dashboard';
    document.getElementById('hmeta').textContent = '';
    return;
  }

  document.getElementById('hschool').textContent = getSessionLabel(session);
  const examLabel = normalizeExamLabel(session.examLabel);
  const examBadge = examLabel !== DEFAULT_EXAM_LABEL
    ? ` <span style="display:inline-block;margin-left:4px;padding:2px 9px;border-radius:20px;background:#eef2ff;color:#4f46e5;font-size:10px;font-weight:800;letter-spacing:.03em;vertical-align:middle;">${escapeHtml(examLabel).toUpperCase()}</span>`
    : '';
  document.getElementById('hmeta').innerHTML =
    [DB.X.length ? `Class X: <strong style="color:var(--gold)">${DB.X.length}</strong>` : '',
     DB.XII.length ? `Class XII: <strong style="color:#22d3ee">${DB.XII.length}</strong>` : '']
      .filter(Boolean).join(' &nbsp;&middot;&nbsp; ') + examBadge +
    `<br><span style="opacity:.6">CBSE ${session.year}` +
    (session.schoolCode ? ` &nbsp;&middot;&nbsp; School ${session.schoolCode}` : '') + `</span>`;
}

function formatStorageSize(bytes){
  if(bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  if(bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function estimateLocalStorageUsageBytes(){
  let total = 0;
  for(let i = 0; i < localStorage.length; i++){
    const key = localStorage.key(i) || '';
    const value = localStorage.getItem(key) || '';
    total += (key.length + value.length) * 2;
  }
  return total;
}

async function updateStorageIndicator(){
  const valueEl = document.getElementById('storage-value');
  const fillEl = document.getElementById('storage-fill');
  if(!valueEl || !fillEl) return;

  const usedBytes = estimateLocalStorageUsageBytes();
  const fallbackQuota = 5 * 1024 * 1024;
  const pctUsed = Math.min(100, (usedBytes / fallbackQuota) * 100);
  valueEl.textContent = `${formatStorageSize(usedBytes)} used, ${formatStorageSize(Math.max(0, fallbackQuota - usedBytes))} free`;
  fillEl.style.width = `${Math.max(2, pctUsed)}%`;
  fillEl.style.background = pctUsed > 85
    ? 'linear-gradient(90deg, #d05c33 0%, #b52c2c 100%)'
    : pctUsed > 60
      ? 'linear-gradient(90deg, #d7a63a 0%, #cf7e22 100%)'
      : 'linear-gradient(90deg, #c9a84c 0%, #d48b1f 100%)';
}

function escapeAttr(value){
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtml(value){
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function createParseDiagnostics(cls){
  return {cls, matchedRows:0, parsedStudents:0, warnings:[]};
}

function addParseWarning(diagnostics, detail){
  diagnostics.warnings.push(detail);
}

function addParseWarningOnce(diagnostics, detail){
  if(!diagnostics.warnings.includes(detail)) diagnostics.warnings.push(detail);
}

function resetCardState(cls){
  uploadRaw[cls] = null;
  document.getElementById('card-'+cls).className = 'upload-card';
  document.getElementById('status-'+cls).textContent = '';
}

function dragOver(e,c){e.preventDefault();document.getElementById('card-'+c).classList.add('dragover')}
function dragLeave(e,c){document.getElementById('card-'+c).classList.remove('dragover')}
function fileDrop(e,c){e.preventDefault();dragLeave(e,c);readFile(e.dataTransfer.files[0],c)}
function handleFile(e,c){readFile(e.target.files[0],c)}

function detectClass(text){
  const head = text.slice(0,3000);
  if(/SENIOR SCHOOL CERTIFICATE/i.test(head)) return 'XII';
  if(/SECONDARY SCHOOL EXAMINATION/i.test(head)) return 'X';
  return null;
}

function refreshExamLabelDates(){
  const el = document.getElementById('exam-label-dates');
  if(!el) return;
  const parts = ['X','XII']
    .filter(cls => uploadRaw[cls])
    .map(cls => {
      const meta = parseMeta(uploadRaw[cls]);
      return meta.date ? `Class ${cls} file date: ${meta.date}` : '';
    })
    .filter(Boolean);
  el.textContent = parts.join('  ·  ');
}

function readFile(file, c){
  if(!file) return;
  const r = new FileReader();
  r.onload = ev => {
    const text = ev.target.result;
    const detected = detectClass(text);
    const actualClass = detected || c;
    if(detected && detected !== c) resetCardState(c);
    uploadRaw[actualClass] = text;
    const el = document.getElementById('status-'+actualClass);
    el.textContent = 'Loaded ' + file.name + (detected && detected !== c ? ' (auto-detected as Class '+detected+')' : '');
    el.style.color = actualClass==='X' ? 'var(--cx-dk)' : 'var(--cxii-dk)';
    document.getElementById('card-'+actualClass).className = 'upload-card loaded-'+actualClass;
    document.getElementById('btn-analyze').disabled = !(uploadRaw.X || uploadRaw.XII);
    refreshExamLabelDates();
  };
  r.readAsText(file,'UTF-8');
}

function normalize(t){ return t.replace(/\r\n/g,'\n').replace(/\r/g,'\n'); }

const GRADE_RE = /^(A1|A2|B1|B2|C1|C2|D1|D2|E)$/;

function parseSubjectMarkTokens(line, diagnostics){
  const gradedTokens = [...line.matchAll(/\b(AB|\d{2,3})\s+(A1|A2|B1|B2|C1|C2|D1|D2|E)\b/g)]
    .map(match => ({raw: match[1], grade: match[2], gradeMissing: false}));
  if(gradedTokens.length) return gradedTokens;

  const markTokens = (line.match(/\b(?:AB|\d{2,3})\b/g) || [])
    .filter(token => !GRADE_RE.test(token))
    .map(token => ({raw: token, grade: null, gradeMissing: token !== 'AB'}));
  if(markTokens.some(token => token.gradeMissing)){
    addParseWarningOnce(diagnostics, 'Subject grades are not present in this board file; marks were parsed and grades are shown as NA.');
  }
  return markTokens;
}

function inferMissingGrade(code, rawMark, marks, result, compSub){
  if(rawMark === 'AB') return 'AB';
  const compCodes = String(compSub || '').match(/\d{3}/g) || [];
  if(compCodes.includes(code)) return 'E';
  if(result === 'FAIL' && marks < cbsePassMark(100)) return 'E';
  return 'NA';
}

function buildSubs(codes, toks, result, diagnostics, rollNo, compSub, cls){
  if(result==='ABST' && toks.length===0){
    return codes.map(c=>({code:c, name:sn(c, cls), marks:0, grade:'AB', theoryMarks:null, componentMarks:null, componentType:null, componentMaxMarks:null, theoryMaxMarks:null}));
  }

  if(toks.length===0){
    addParseWarning(diagnostics, `Roll ${rollNo}: marks line missing or unreadable.`);
  } else if(toks.length !== codes.length){
    addParseWarning(diagnostics, `Roll ${rollNo}: expected ${codes.length} subjects, found ${toks.length} mark entries.`);
  }

  const usable = Math.min(codes.length, toks.length);
  return codes.slice(0, usable).map((c,j)=>{
    const rawMark = toks[j].raw;
    const marks = rawMark === 'AB' ? 0 : parseInt(rawMark, 10);
    return {
      code:c,
      name:sn(c, cls),
      marks,
      grade:rawMark === 'AB' ? 'AB' : (toks[j].grade || inferMissingGrade(c, rawMark, marks, result, compSub)),
      theoryMarks:null,
      componentMarks:null,
      componentType:null,
      componentMaxMarks:null,
      theoryMaxMarks:null,
    };
  });
}

function parseX(text){
  const lines = normalize(text).split('\n');
  const out = [];
  const diagnostics = createParseDiagnostics('X');

  for(let i=0;i<lines.length;i++){
    const ln = lines[i];
    const m = ln.match(/^(\d{8})\s+(?:\S+\s+)?(F|M)\s+(.+?)\s{2,}((?:\d{3}\s+){4,6}\d{3})\s+(PASS|COMP|ABST|FAIL)/);
    if(!m) continue;

    diagnostics.matchedRows++;
    const codes = m[4].trim().split(/\s+/);
    const cm = ln.match(/COMP\s+(\d{3})/);
    const nextLine = lines[i+1] || '';
    const compSub = cm ? cm[1] : null;
    const toks = parseSubjectMarkTokens(nextLine, diagnostics);
    const subjects = buildSubs(codes, toks, m[5], diagnostics, m[1], compSub, 'X');

    if(!subjects.length && m[5] !== 'ABST'){
      addParseWarning(diagnostics, `Roll ${m[1]}: no subject marks were parsed from the detail line.`);
    }

    out.push(createStudentRecord({
      rollNo:m[1],
      gender:m[2],
      name:m[3].trim(),
      result:m[5],
      cls:'X',
      compSub,
      subjects
    }));
    diagnostics.parsedStudents++;
    i++;
  }

  return {students:out, diagnostics};
}

function parseXII(text){
  const lines = normalize(text).split('\n');
  const out = [];
  const diagnostics = createParseDiagnostics('XII');

  for(let i=0;i<lines.length;i++){
    const ln = lines[i];
    let m = ln.match(/^(\d{8})\s+(?:\S+\s+)?(F|M)\s+(.+?)\s{2,}((?:\d{3}\s+){4,6}\d{3})\s+(?:A1|A2|B1|B2|C1|C2|D1|D2|E)\s+(?:A1|A2|B1|B2|C1|C2|D1|D2|E)\s+(?:A1|A2|B1|B2|C1|C2|D1|D2|E)\s+(PASS|COMP|ABST|FAIL)/);
    if(!m) m = ln.match(/^(\d{8})\s+(?:\S+\s+)?(F|M)\s+(.+?)\s{2,}((?:\d{3}\s+){4,6}\d{3})\s+.{0,50}?(ABST|PASS|COMP|FAIL)\b/);
    if(!m) continue;

    diagnostics.matchedRows++;
    const codes = m[4].trim().split(/\s+/);
    const cm = ln.match(/COMP\s+((?:\d{3}[ \t]*)+)/);
    const nextLine = lines[i+1] || '';
    const compSub = cm ? cm[1].trim() : null;
    const toks = parseSubjectMarkTokens(nextLine, diagnostics);
    const subjects = buildSubs(codes, toks, m[5], diagnostics, m[1], compSub, 'XII');

    if(!subjects.length && m[5] !== 'ABST'){
      addParseWarning(diagnostics, `Roll ${m[1]}: no subject marks were parsed from the detail line.`);
    }

    out.push(createStudentRecord({
      rollNo:m[1],
      gender:m[2],
      name:m[3].trim(),
      result:m[5],
      cls:'XII',
      compSub,
      subjects
    }));
    diagnostics.parsedStudents++;
    i++;
  }

  return {students:out, diagnostics};
}

function parseMeta(t) {
  const yr = t.match(/EXAMINATION[^-\n]*[-\u2013](\d{4})/);
  const rg = t.match(/REGION\s*:\s*([A-Z][A-Z0-9 ]+?)(?:\s{2,}|\n|PAGE)/i);
  const sc = t.match(/SCHOOL\s*:\s*-\s*(\d+)\s+(.+)/i);
  const dt = t.match(/DATE\s*:-\s*(\d{2}-\d{2}-\d{4})/i);
  return {
    year: yr ? yr[1] : new Date().getFullYear(),
    region: rg ? rg[1].trim() : '',
    code: sc ? sc[1].trim() : '',
    school: sc ? sc[2].trim() : '',
    date: dt ? dt[1] : '',
  };
}

function parseClassBundle(cls, text){
  if(!text) return null;
  const parsed = cls === 'X' ? parseX(text) : parseXII(text);
  return {
    rawText: text,
    students: parsed.students,
    diagnostics: parsed.diagnostics,
    examDate: parseMeta(text).date,
  };
}

function buildSessionFromRawClasses(classes, examLabel){
  const sampleText = classes.X || classes.XII || '';
  const meta = parseMeta(sampleText);
  const schoolCode = meta.code || 'CBSE';
  const year = String(meta.year || new Date().getFullYear());
  const label = normalizeExamLabel(examLabel);
  const sessionId = createSessionId(schoolCode, year, label);
  const classX = parseClassBundle('X', classes.X || null);
  const classXII = parseClassBundle('XII', classes.XII || null);
  return {
    sessionId,
    schoolCode,
    schoolName: meta.school || schoolCode,
    year,
    examLabel: label,
    masterData: createEmptyMasterData(),
    parsed: {
      X: classX ? classX.students.length : 0,
      XII: classXII ? classXII.students.length : 0,
    },
    diagnostics: {
      X: classX ? classX.diagnostics : null,
      XII: classXII ? classXII.diagnostics : null,
    },
    classes: {
      X: classX,
      XII: classXII,
    }
  };
}

function mergeSessionIntoRegistry(session){
  const existing = schoolSessions[session.sessionId];
  if(existing){
    // Preserve existing masterData rows unless the incoming session has actual data.
    // createEmptyMasterData() is an object (truthy) but has no rows — don't let it
    // silently wipe rows that were already loaded from the server.
    const incomingHasRows = session.masterData &&
      (session.masterData.studentMaster?.length || session.masterData.teacherMappings?.length ||
       Object.keys(session.masterData.followUps || {}).length);
    const resolvedMasterData = incomingHasRows
      ? session.masterData
      : (existing.masterData || createEmptyMasterData());
    schoolSessions[session.sessionId] = {
      ...existing,
      schoolName: session.schoolName || existing.schoolName,
      masterData: resolvedMasterData,
      parsed: {
        X: session.classes.X ? session.classes.X.students.length : (existing.classes.X ? existing.classes.X.students.length : 0),
        XII: session.classes.XII ? session.classes.XII.students.length : (existing.classes.XII ? existing.classes.XII.students.length : 0),
      },
      diagnostics: {
        X: session.classes.X ? session.classes.X.diagnostics : existing.diagnostics?.X || null,
        XII: session.classes.XII ? session.classes.XII.diagnostics : existing.diagnostics?.XII || null,
      },
      classes: {
        X: session.classes.X || existing.classes.X,
        XII: session.classes.XII || existing.classes.XII,
      }
    };
  } else {
    schoolSessions[session.sessionId] = {
      ...session,
      masterData: session.masterData || createEmptyMasterData(),
    };
  }
  return schoolSessions[session.sessionId];
}

function applySessionToActiveData(sessionId, preferredCls){
  const session = schoolSessions[sessionId];
  if(!session) return;
  activeSessionId = sessionId;
  raw.X = session.classes.X ? session.classes.X.rawText : null;
  raw.XII = session.classes.XII ? session.classes.XII.rawText : null;
  DB.X = session.classes.X ? session.classes.X.students : [];
  DB.XII = session.classes.XII ? session.classes.XII.students : [];
  parseDiagnostics.X = session.classes.X ? session.classes.X.diagnostics : null;
  parseDiagnostics.XII = session.classes.XII ? session.classes.XII.diagnostics : null;
  const nextCls = preferredCls || (DB.X.length ? 'X' : DB.XII.length ? 'XII' : null);
  activeCls = nextCls;
  if(nextCls && Store.hasFeature('excel_export')) document.getElementById('btn-export').style.display = 'inline-block';
}

function listSessionClassBadges(session){
  return ['X','XII'].filter(cls => session.classes[cls]).map(cls =>
    `<span class="cpill cpill-${cls}">Class ${cls}</span>`
  ).join('');
}

function collectSavedCombinations(){
  // Sync fallback used by legacy callers; async path via Store.loadCombinations
  try {
    const raw = localStorage.getItem(COMBO_STORAGE_KEY);
    const c = raw ? JSON.parse(raw) : [];
    return Array.isArray(c) ? c : [];
  } catch { return []; }
}

async function persistSavedCombinations(){
  await Store.saveCombinations(savedCombinations);
}

async function persistSchoolSession(session){
  await Store.saveSession(session);
}

function loadSessionMasterData(session){
  // Sync path: read whatever is in localStorage (legacy backwards compat)
  const fallback = createEmptyMasterData();
  try {
    const studentMaster = JSON.parse(localStorage.getItem(getSessionStorageKey(session, STUDENT_MASTER_SUFFIX)) || '[]');
    const teacherMappings = JSON.parse(localStorage.getItem(getSessionStorageKey(session, TEACHER_MAPPING_SUFFIX)) || '[]');
    const followUps = JSON.parse(localStorage.getItem(getSessionStorageKey(session, FOLLOW_UP_SUFFIX)) || '{}');
    const loaded = {
      ...fallback,
      studentMaster: Array.isArray(studentMaster) ? studentMaster : [],
      teacherMappings: Array.isArray(teacherMappings) ? teacherMappings : [],
      followUps: followUps && typeof followUps === 'object' ? followUps : {},
    };
    if(loaded.studentMaster.length) loaded.mappingFiles.studentMaster = {status:'legacy', fileName:'older saved data', expected:getMappingFileCandidates(session, 'student')};
    if(loaded.teacherMappings.length) loaded.mappingFiles.teacherMappings = {status:'legacy', fileName:'older saved data', expected:getMappingFileCandidates(session, 'teacher')};
    return loaded;
  } catch {
    return fallback;
  }
}

async function loadSessionMasterDataFromServer(session){
  // Async path: load master rows saved via manual upload from SQLite API.
  // Called after rebuildSessionsFromLocalStorage completes.
  console.log('[CBSE restore] loadSessionMasterDataFromServer called, mode='+Store.mode+' sessionId='+session.sessionId);
  if(Store.mode !== 'api') { console.log('[CBSE restore] skipped — not api mode'); return; }
  const masterData = session.masterData || createEmptyMasterData();

  const [studentRows, teacherRows, followUps, perfData] = await Promise.all([
    Store.loadMasterRows(session, 'student'),
    Store.loadMasterRows(session, 'teacher'),
    Store.loadFollowUps(session),
    Store.loadPerformanceMarks(session),
  ]);

  console.log('[CBSE restore] studentRows='+studentRows.length+' teacherRows='+teacherRows.length+' followUps='+Object.keys(followUps).length+' perfRows='+perfData.rows.length);

  if(studentRows.length){
    masterData.studentMaster = studentRows;
    masterData.mappingFiles.studentMaster = {
      status: 'manual',
      fileName: 'server (uploaded mapping)',
      expected: getMappingFileCandidates(session, 'student'),
    };
  }
  if(teacherRows.length){
    masterData.teacherMappings = teacherRows;
    masterData.mappingFiles.teacherMappings = {
      status: 'manual',
      fileName: 'server (uploaded mapping)',
      expected: getMappingFileCandidates(session, 'teacher'),
    };
  }
  if(Object.keys(followUps).length){
    masterData.followUps = followUps;
  }
  if(perfData.rows.length && perfData.componentType){
    // Re-apply performance rows to enrich subject records
    applyPerformanceRows(session, perfData.rows, perfData.componentType);
    session.masterData.mappingFiles.performanceMarks = {
      status: 'manual',
      fileName: 'server (uploaded marks)',
      expected: [],
    };
  }
  session.masterData = masterData;
  console.log('[CBSE restore] after assignment: studentMaster='+session.masterData.studentMaster.length+' teacherMappings='+session.masterData.teacherMappings.length);
}

async function persistMasterData(session){
  await Store.saveFollowUps(session);
}

async function rebuildSessionsFromLocalStorage(){
  Object.keys(schoolSessions).forEach(key => delete schoolSessions[key]);
  const grouped = await Store.loadAllSessions();
  const mergedSessions = [];
  Object.entries(grouped).forEach(([, classes]) => {
    const session = buildSessionFromRawClasses({
      X: classes.X || null,
      XII: classes.XII || null,
    }, classes.examLabel);
    // Carry over schoolName from server response if available
    if(classes.schoolName) session.schoolName = classes.schoolName;
    if(classes.ownerUserId) {
      session.ownerUserId = classes.ownerUserId;
      session.ownerUsername = classes.ownerUsername || '';
      session.sessionId = createSessionId(session.schoolCode, session.year, session.examLabel, classes.ownerUserId);
    }
    const merged = mergeSessionIntoRegistry(session);
    merged.masterData = loadSessionMasterData(merged);  // sync: localStorage legacy
    mergedSessions.push(merged);
  });
  // Async: load master rows and follow-ups from SQLite for all sessions in parallel
  await Promise.all(mergedSessions.map(s => loadSessionMasterDataFromServer(s)));
  savedCombinations = await Store.loadCombinations();
}

function normalizeHeaderName(value){
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function normalizeClassValue(value){
  const rawValue = String(value || '').trim().toUpperCase();
  const compact = rawValue.replace(/[^A-Z0-9]/g, '');
  if(compact === '10' || compact === 'X' || compact === 'CLASSX' || compact === 'CLASS10') return 'X';
  if(compact === '12' || compact === 'XII' || compact === 'CLASSXII' || compact === 'CLASS12') return 'XII';
  return rawValue;
}

function normalizeSectionValue(value){
  return String(value || '').trim().toUpperCase();
}

function normalizeRollValue(value){
  const digits = String(value || '').replace(/\D/g, '');
  return digits || String(value || '').trim();
}

function pickRowValue(row, aliases){
  for(const alias of aliases){
    const key = Object.keys(row).find(item => normalizeHeaderName(item) === alias);
    if(key && row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') return row[key];
  }
  return '';
}

function mapStudentMasterRows(rows){
  return rows.map(row => ({
    rollNo: normalizeRollValue(pickRowValue(row, ['rollno','rollnumber','admissionno'])),
    class: normalizeClassValue(pickRowValue(row, ['class','cls'])),
    section: normalizeSectionValue(pickRowValue(row, ['section','sec'])),
    classTeacher: String(pickRowValue(row, ['classteacher','classteachername','teacher']) || '').trim(),
    stream: String(pickRowValue(row, ['stream']) || '').trim(),
    house: String(pickRowValue(row, ['house']) || '').trim(),
  })).filter(row => row.rollNo && row.class && row.section);
}

function mapTeacherRows(rows){
  return rows.map(row => ({
    class: normalizeClassValue(pickRowValue(row, ['class','cls'])),
    section: normalizeSectionValue(pickRowValue(row, ['section','sec'])),
    subjectCode: String(pickRowValue(row, ['subjectcode','subcode','code']) || '').trim().padStart(3, '0'),
    subjectName: String(pickRowValue(row, ['subjectname','subject']) || '').trim(),
    teacherName: String(pickRowValue(row, ['teachername','teacher']) || '').trim(),
    department: String(pickRowValue(row, ['department','dept']) || '').trim(),
    teacherId: String(pickRowValue(row, ['teacherid','staffid','employeeid']) || '').trim(),
  })).filter(row => row.class && row.section && row.subjectCode && row.teacherName);
}

function normalizeSubjectCodeValue(value){
  return String(value || '').trim().padStart(3, '0');
}

function parseNumericCell(value){
  if(value === undefined || value === null || String(value).trim() === '') return null;
  const cleaned = String(value).trim().replace(/,/g, '');
  const numeric = Number(cleaned);
  return Number.isFinite(numeric) ? numeric : null;
}

function mapPerformanceRows(rows, componentType){
  return rows.map(row => ({
    rollNo: normalizeRollValue(pickRowValue(row, ['rollno','rollnumber','admissionno'])),
    class: normalizeClassValue(pickRowValue(row, ['class','cls'])),
    subjectCode: normalizeSubjectCodeValue(pickRowValue(row, ['subjectcode','subcode','code'])),
    componentMarks: parseNumericCell(pickRowValue(row, ['componentmarks','internalmarks','practicalmarks','marks'])),
    componentMaxMarks: parseNumericCell(pickRowValue(row, ['componentmaxmarks','internalmaxmarks','practicalmaxmarks','maxmarks','max'])),
    componentType,
  })).filter(row =>
    row.rollNo &&
    row.class &&
    row.subjectCode &&
    row.componentMarks !== null &&
    row.componentMaxMarks !== null
  );
}

function resetPerformanceEnrichment(session){
  if(!session) return;
  ['X','XII'].forEach(cls => {
    const classBundle = session.classes?.[cls];
    if(!classBundle?.students) return;
    classBundle.students.forEach(student => {
      student.subjects.forEach(subject => {
        subject.theoryMarks = null;
        subject.componentMarks = null;
        subject.componentType = null;
        subject.componentMaxMarks = null;
        subject.theoryMaxMarks = null;
      });
    });
  });
}

function applyPerformanceRows(session, rows, componentType){
  const masterData = session.masterData || createEmptyMasterData();
  const diagnostics = {rows: rows.length, matched: 0, unmatched: 0, duplicateRows: 0, duplicateKeys: 0, derivedTheory: 0, missingCoverage: 0, scopedClasses: []};
  const studentLookup = new Map();
  const subjectLookup = new Map();
  const matchedKeys = new Set();
  const reportRows = [];
  const uploadKeyCounts = new Map();
  const uploadedClasses = new Set(rows.map(row => row.class).filter(Boolean));

  resetPerformanceEnrichment(session);

  ['X','XII'].forEach(cls => {
    const classBundle = session.classes?.[cls];
    if(!classBundle?.students) return;
    classBundle.students.forEach(student => {
      studentLookup.set(`${student.rollNo}|${student.cls}`, student);
      student.subjects.forEach(subject => {
        subjectLookup.set(`${student.rollNo}|${student.cls}|${subject.code}`, {student, subject});
      });
    });
  });

  rows.forEach(row => {
    const matchKey = `${row.rollNo}|${row.class}|${row.subjectCode}`;
    uploadKeyCounts.set(matchKey, (uploadKeyCounts.get(matchKey) || 0) + 1);
    const subjectEntry = subjectLookup.get(matchKey);
    const duplicateCount = uploadKeyCounts.get(matchKey);
    if(duplicateCount > 1){
      diagnostics.duplicateRows += 1;
      reportRows.push({
        ...row,
        status: 'Duplicate Upload',
        reason: `Duplicate upload key for ${row.rollNo} / ${row.class} / ${row.subjectCode}`,
        studentName: subjectEntry?.student?.name || '',
        subjectName: subjectEntry?.subject?.name || '',
        totalMarks: subjectEntry?.subject?.marks ?? '',
        theoryMarks: '',
        theoryMaxMarks: '',
      });
      return;
    }
    if(subjectEntry){
      const {student, subject} = subjectEntry;
      matchedKeys.add(matchKey);
      diagnostics.matched += 1;
      subject.componentMarks = row.componentMarks;
      subject.componentType = componentType;
      subject.componentMaxMarks = row.componentMaxMarks;
      subject.theoryMarks = Math.max(0, (subject.marks || 0) - row.componentMarks);
      subject.theoryMaxMarks = Math.max(0, 100 - row.componentMaxMarks);
      diagnostics.derivedTheory += 1;
      reportRows.push({
        ...row,
        status: 'Matched',
        reason: '',
        studentName: student.name,
        subjectName: subject.name,
        totalMarks: subject.marks,
        theoryMarks: subject.theoryMarks,
        theoryMaxMarks: subject.theoryMaxMarks,
      });
      return;
    }

    const student = studentLookup.get(`${row.rollNo}|${row.class}`);
    reportRows.push({
      ...row,
      status: 'Missing',
      reason: student ? 'Subject code not found for this student in analysed results' : 'Student not found in analysed results',
      studentName: student?.name || '',
      subjectName: '',
      totalMarks: '',
      theoryMarks: '',
      theoryMaxMarks: '',
    });
  });

  subjectLookup.forEach(({student, subject}, key) => {
    if(matchedKeys.has(key) || subjectIsAbsent(subject) || !uploadedClasses.has(student.cls)) return;
    diagnostics.missingCoverage += 1;
    reportRows.push({
      rollNo: student.rollNo,
      class: student.cls,
      subjectCode: subject.code,
      componentMarks: '',
      componentMaxMarks: '',
      componentType,
      status: 'Missing',
      reason: 'No uploaded component row for this analysed subject',
      studentName: student.name,
      subjectName: subject.name,
      totalMarks: subject.marks,
      theoryMarks: '',
      theoryMaxMarks: '',
    });
  });

  diagnostics.unmatched = reportRows.filter(row => row.status === 'Missing' && row.reason !== 'No uploaded component row for this analysed subject').length;
  diagnostics.duplicateKeys = [...uploadKeyCounts.values()].filter(count => count > 1).length;
  diagnostics.scopedClasses = [...uploadedClasses];

  masterData.performanceMarks = {
    componentType,
    rows,
    reportRows,
  };
  masterData.diagnostics = {
    ...(masterData.diagnostics || createEmptyMasterData().diagnostics),
    performanceMarks: diagnostics,
  };
  session.masterData = masterData;
  return diagnostics;
}

function getSelectedPerformanceComponentType(){
  return document.getElementById('performance-component-type')?.value === 'practical' ? 'practical' : 'internal';
}

function readWorkbookRows(file){
  return file.arrayBuffer().then(buffer => {
    return readWorkbookRowsFromBuffer(buffer);
  });
}

function readWorkbookRowsFromBuffer(buffer){
  const workbook = XLSX.read(buffer, {type:'array'});
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, {defval:''});
}

function sanitizeMappingFileToken(value){
  return String(value || '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[\\/:*?"<>|#%&{}$!'@+=`]/g, '')
    .replace(/_+/g, '_');
}

function getMappingFileCandidates(session, type){
  const schoolCode = sanitizeMappingFileToken(session?.schoolCode || '');
  const year = sanitizeMappingFileToken(session?.year || '');
  const suffix = type === 'student' ? 'student_master' : 'teacher_mapping';
  const candidates = [];
  if(schoolCode && year) candidates.push(`${schoolCode}-${year}-${suffix}.xlsx`);
  if(schoolCode) candidates.push(`${schoolCode}-${suffix}.xlsx`);
  candidates.push(`${suffix}.xlsx`);
  return [...new Set(candidates)];
}

function getPerformanceFileCandidates(session){
  const schoolCode = sanitizeMappingFileToken(session?.schoolCode || '');
  const year = sanitizeMappingFileToken(session?.year || '');
  const candidates = [];
  const addCandidates = componentType => {
    const suffix = componentType === 'practical' ? 'practical_marks' : 'internal_marks';
    if(schoolCode && year) candidates.push({fileName: `${schoolCode}-${year}-${suffix}.xlsx`, componentType});
    if(schoolCode) candidates.push({fileName: `${schoolCode}-${suffix}.xlsx`, componentType});
    candidates.push({fileName: `${suffix}.xlsx`, componentType});
  };
  addCandidates('internal');
  addCandidates('practical');
  return candidates.filter((item, index, arr) =>
    arr.findIndex(other => other.fileName === item.fileName && other.componentType === item.componentType) === index
  );
}

function setMappingFileStatus(session, type, status){
  if(!session) return;
  const masterData = session.masterData || createEmptyMasterData();
  const key = type === 'student'
    ? 'studentMaster'
    : type === 'teacher'
      ? 'teacherMappings'
      : 'performanceMarks';
  masterData.mappingFiles = {
    ...(masterData.mappingFiles || createEmptyMasterData().mappingFiles),
    [key]: {
      ...(masterData.mappingFiles?.[key] || {}),
      ...status,
    }
  };
  session.masterData = masterData;
}

function clearPersistedMappingData(session){
  if(!session) return;
  localStorage.removeItem(getMappingStorageKey(session, 'student'));
  localStorage.removeItem(getMappingStorageKey(session, 'teacher'));
}

async function fetchMappingRows(fileName){
  // On PythonAnywhere (or any Flask deployment), mapping files are served
  // via the /api/mappings/ route. Fall back to same-folder fetch for
  // local python -m http.server usage.
  const urls = [
    `/api/mappings/${encodeURIComponent(fileName)}`,
    encodeURI(fileName),
  ];
  for(const url of urls){
    try {
      const response = await fetch(url, {cache:'no-store'});
      if(!response.ok) continue;
      const buffer = await response.arrayBuffer();
      return readWorkbookRowsFromBuffer(buffer);
    } catch { /* try next */ }
  }
  return null;
}

async function autoLoadMappingFile(session, type){
  if(window.location.protocol === 'file:'){
    setMappingFileStatus(session, type, {status:'blocked', fileName:'', expected:getMappingFileCandidates(session, type)});
    return false;
  }
  const candidates = getMappingFileCandidates(session, type);
  const dataKey = type === 'student' ? 'studentMaster' : 'teacherMappings';
  const currentStatus = session.masterData?.mappingFiles?.[dataKey]?.status;
  // Short-circuit only when rows are actually loaded in memory.
  // 'manual' with no rows means we're after a refresh — don't skip, try server/file.
  if((currentStatus === 'loaded' || currentStatus === 'manual') && session.masterData?.[dataKey]?.length){
    return true;
  }
  // If server already restored rows (loadSessionMasterDataFromServer ran first), skip file fetch.
  if(Store.mode === 'api' && session.masterData?.[dataKey]?.length){
    return true;
  }
  setMappingFileStatus(session, type, {status:'loading', fileName:'', expected:candidates});

  for(const fileName of candidates){
    try {
      const rows = await fetchMappingRows(fileName);
      if(!rows) continue;
      const mappedRows = type === 'student' ? mapStudentMasterRows(rows) : mapTeacherRows(rows);
      const masterData = session.masterData || createEmptyMasterData();
      masterData[dataKey] = mappedRows;
      session.masterData = masterData;
      setMappingFileStatus(session, type, {status:'loaded', fileName, expected:candidates});
      clearPersistedMappingData(session);
      return true;
    } catch {
      // Try the next expected same-folder file name.
    }
  }

  if(currentStatus === 'legacy' && session.masterData?.[dataKey]?.length){
    setMappingFileStatus(session, type, {status:'legacy', fileName:'older saved data', expected:candidates});
    return true;
  }
  setMappingFileStatus(session, type, {status:'missing', fileName:'', expected:candidates});
  return false;
}

async function autoLoadPerformanceFile(session){
  if(window.location.protocol === 'file:'){
    setMappingFileStatus(session, 'performance', {
      status:'blocked',
      fileName:'',
      expected:getPerformanceFileCandidates(session).map(item => item.fileName),
    });
    return false;
  }
  const candidates = getPerformanceFileCandidates(session);
  const currentStatus = session.masterData?.mappingFiles?.performanceMarks?.status;
  if((currentStatus === 'loaded' || currentStatus === 'manual') && session.masterData?.performanceMarks?.rows?.length){
    return true;
  }
  // In API mode, performance marks are only uploaded manually — no same-folder files to scan.
  // Avoid firing a cascade of 404 requests on every page load.
  if(Store.mode === 'api'){
    setMappingFileStatus(session, 'performance', {
      status:'missing',
      fileName:'',
      expected:candidates.map(item => item.fileName),
    });
    return false;
  }
  setMappingFileStatus(session, 'performance', {status:'loading', fileName:'', expected:candidates.map(item => item.fileName)});

  for(const candidate of candidates){
    try {
      const rows = await fetchMappingRows(candidate.fileName);
      if(!rows) continue;
      const performanceRows = mapPerformanceRows(rows, candidate.componentType);
      if(!performanceRows.length) continue;
      applyPerformanceRows(session, performanceRows, candidate.componentType);
      setMappingFileStatus(session, 'performance', {
        status:'loaded',
        fileName:candidate.fileName,
        expected:candidates.map(item => item.fileName),
      });
      return true;
    } catch {
      // Try the next expected same-folder performance file name.
    }
  }

  setMappingFileStatus(session, 'performance', {
    status:'missing',
    fileName:'',
    expected:candidates.map(item => item.fileName),
  });
  return false;
}

async function autoLoadMappingFiles(session){
  if(!session || session._mappingLoadPromise) return session?._mappingLoadPromise || Promise.resolve(false);

  // If server already restored master rows (loadSessionMasterDataFromServer ran),
  // skip the file-fetch entirely — rows are already in memory.
  const md = session.masterData;
  const serverRestored =
    Store.mode === 'api' &&
    (md?.studentMaster?.length || md?.teacherMappings?.length);
  console.log('[CBSE restore] autoLoadMappingFiles: mode='+Store.mode+' studentMaster='+(md?.studentMaster?.length||0)+' teacherMappings='+(md?.teacherMappings?.length||0)+' serverRestored='+serverRestored);
  if(serverRestored){
    console.log('[CBSE restore] skipping file fetch — rows already in memory');
    renderWorkspacePanel();
    renderSec();
    return true;
  }

  session._mappingLoadPromise = Promise.all([
    Store.hasFeature('student_master_upload') ? autoLoadMappingFile(session, 'student') : Promise.resolve(false),
    Store.hasFeature('teacher_mapping_upload') ? autoLoadMappingFile(session, 'teacher') : Promise.resolve(false),
    Store.hasFeature('performance_marks_upload') ? autoLoadPerformanceFile(session) : Promise.resolve(false),
  ]).then(results => {
    session._mappingLoadPromise = null;
    if(activeSessionId === session.sessionId && !isMultiMode()){
      renderWorkspacePanel();
      renderSec();
    }
    return results.some(Boolean);
  });
  renderWorkspacePanel();
  return session._mappingLoadPromise;
}

function getCurrentSingleSession(){
  return activeSessionId ? schoolSessions[activeSessionId] : null;
}

function buildEnrichedStudents(cls){
  const session = getCurrentSingleSession();
  if(!session || !session.classes[cls]) return {students: [], diagnostics: createEmptyMasterData().diagnostics};

  const masterData = session.masterData || createEmptyMasterData();
  const studentMap = new Map(
    (masterData.studentMaster || []).map(row => [`${row.rollNo}|${row.class}`, row])
  );
  const teacherMap = new Map(
    (masterData.teacherMappings || []).map(row => [`${row.class}|${row.section}|${row.subjectCode}`, row])
  );

  const diagnostics = {
    studentMaster: {rows: masterData.studentMaster.length, matched: 0, unmapped: 0},
    teacherMappings: {rows: masterData.teacherMappings.length, matched: 0, unmapped: 0},
  };

  const students = DB[cls].map(student => {
    const studentMaster = studentMap.get(`${student.rollNo}|${student.cls}`) || null;
    if(studentMaster) diagnostics.studentMaster.matched += 1;
    else diagnostics.studentMaster.unmapped += 1;

    const section = studentMaster?.section || 'UNMAPPED';
    const subjects = student.subjects.map(subject => {
      const teacherRow = teacherMap.get(`${student.cls}|${section}|${subject.code}`) || null;
      if(teacherRow) diagnostics.teacherMappings.matched += 1;
      else diagnostics.teacherMappings.unmapped += 1;
      return {
        ...subject,
        teacherName: teacherRow?.teacherName || 'Unmapped',
        teacherId: teacherRow?.teacherId || '',
        department: teacherRow?.department || '',
        mappedSubjectName: teacherRow?.subjectName || subject.name,
      };
    });

    return {
      ...student,
      section,
      classTeacher: studentMaster?.classTeacher || 'Unmapped',
      stream: studentMaster?.stream || '',
      house: studentMaster?.house || '',
      schoolCode: session.schoolCode,
      schoolName: session.schoolName,
      year: session.year,
      subjects,
    };
  });

  session.masterData.diagnostics = diagnostics;
  return {students, diagnostics};
}

async function handleMasterFile(e, type){
  const file = e.target.files[0];
  e.target.value = '';
  const session = getCurrentSingleSession();
  if(!file || !session){
    alert('Open a single school session before uploading school master data.');
    return;
  }
  const featureKey = type === 'student'
    ? 'student_master_upload'
    : type === 'teacher'
      ? 'teacher_mapping_upload'
      : 'performance_marks_upload';
  if(!Store.hasFeature(featureKey)){
    alert('This Excel upload is a premium feature. Please contact the administrator.');
    return;
  }

  try {
    const rows = await readWorkbookRows(file);
    if(type === 'student'){
      const masterData = session.masterData || createEmptyMasterData();
      masterData.studentMaster = mapStudentMasterRows(rows);
      setMappingFileStatus(session, 'student', {status:'manual', fileName:file.name, expected:getMappingFileCandidates(session, 'student')});
      session.masterData = masterData;
      await Store.saveMasterRows(session, 'student', masterData.studentMaster);
      alert(`Student master loaded: ${masterData.studentMaster.length} valid row(s).`);
    } else if(type === 'teacher') {
      const masterData = session.masterData || createEmptyMasterData();
      masterData.teacherMappings = mapTeacherRows(rows);
      setMappingFileStatus(session, 'teacher', {status:'manual', fileName:file.name, expected:getMappingFileCandidates(session, 'teacher')});
      session.masterData = masterData;
      await Store.saveMasterRows(session, 'teacher', masterData.teacherMappings);
      alert(`Teacher mapping loaded: ${masterData.teacherMappings.length} valid row(s).`);
    } else {
      const componentType = getSelectedPerformanceComponentType();
      const performanceRows = mapPerformanceRows(rows, componentType);
      const diagnostics = applyPerformanceRows(session, performanceRows, componentType);
      const label = componentType === 'practical' ? 'Practical' : 'Internal';
      setMappingFileStatus(session, 'performance', {status:'manual', fileName:file.name, expected:[]});
      await Store.savePerformanceMarks(session, performanceRows, componentType);
      alert(`${label} marks loaded: ${diagnostics.rows} valid row(s), ${diagnostics.matched} matched subject row(s).`);
    }
    clearPersistedMappingData(session);
    await persistMasterData(session);
    renderWorkspacePanel();
    renderSec();
  } catch {
    alert('Could not read the uploaded file. Please use CSV or Excel with header columns.');
  }
}

function getFollowUpCategories(student){
  const categories = [];
  if(student.result === 'COMP') categories.push('Compartment');
  const weakSubjects = student.subjects.filter(subject => subjectIsFail(subject));
  if(weakSubjects.length) categories.push('Grade E');
  return {categories, weakSubjects};
}

async function updateFollowUpRecord(cls, rollNo, field, value){
  const session = getCurrentSingleSession();
  if(!session) return;
  const key = `${cls}|${rollNo}`;
  const followUps = session.masterData.followUps || {};
  followUps[key] = {
    ...(followUps[key] || {}),
    [field]: value,
  };
  session.masterData.followUps = followUps;
  await persistMasterData(session);
}

function renderParseWarnings(){
  const banner = document.getElementById('parse-banner');
  const body = document.getElementById('parse-banner-body');
  const classes = ['X', 'XII'].map(cls => parseDiagnostics[cls]).filter(diag => diag && diag.warnings.length);

  if(!classes.length){
    banner.classList.remove('show');
    body.innerHTML = '';
    return;
  }

  body.innerHTML = classes.map(diag => {
    const grouped = {};
    diag.warnings.forEach(msg => { grouped[msg] = (grouped[msg] || 0) + 1; });
    const items = Object.entries(grouped);
    const preview = items.slice(0, 4).map(([msg, count]) =>
      `<li>${msg}${count > 1 ? ` (${count} rows)` : ''}</li>`
    ).join('');
    const more = items.length > 4 ? `<div class="parse-warning-more">${items.length - 4} more warning pattern(s) not shown.</div>` : '';

    return `
      <div style="margin-bottom:10px">
        <div class="parse-summary">
          <span class="parse-chip">Class ${diag.cls}</span>
          <span class="parse-chip">${diag.parsedStudents} students parsed</span>
          <span class="parse-chip">${diag.warnings.length} warnings</span>
        </div>
        <ul class="parse-warning-list">${preview}</ul>
        ${more}
      </div>`;
  }).join('');

  banner.classList.add('show');
}

async function runAnalysis(){
  const staged = {X: uploadRaw.X, XII: uploadRaw.XII};
  const examLabelInput = document.getElementById('exam-label-input');
  const examLabel = normalizeExamLabel(examLabelInput ? examLabelInput.value : '');

  const sampleText = staged.X || staged.XII || '';
  const previewMeta = parseMeta(sampleText);
  const previewSessionId = createSessionId(previewMeta.code || 'CBSE', String(previewMeta.year || new Date().getFullYear()), examLabel);
  const existingSession = schoolSessions[previewSessionId];
  const overwritingClasses = ['X','XII'].filter(cls => staged[cls] && existingSession?.classes?.[cls]);
  if(overwritingClasses.length){
    const label = examLabel === DEFAULT_EXAM_LABEL ? 'existing' : `"${examLabel}"`;
    const proceed = confirm(
      `A ${label} attempt already exists for Class ${overwritingClasses.join(' & ')} of ` +
      `${previewMeta.school || previewMeta.code || 'this school'} (${previewMeta.year}). ` +
      `Uploading will overwrite it. Continue?`
    );
    if(!proceed) return;
  }

  const session = buildSessionFromRawClasses(staged, examLabel);
  const merged = mergeSessionIntoRegistry(session);
  await persistSchoolSession(merged);

  if(!workspaceState.selectedSessionIds.includes(merged.sessionId)){
    workspaceState.selectedSessionIds = [...workspaceState.selectedSessionIds, merged.sessionId];
  }
  activeSessionId = merged.sessionId;
  workspaceState.mode = workspaceState.selectedSessionIds.length > 1 ? 'multi' : 'single';
  workspaceState.activeCombinationId = null;

  applySessionToActiveData(merged.sessionId);
  const tot = DB.X.length + DB.XII.length;
  if(!tot){
    renderParseWarnings();
    alert('Could not parse any student records. Please check the file format.');
    return;
  }

  const meta = parseMeta(raw.X || raw.XII || '');
  if(meta.school) document.getElementById('hschool').textContent = meta.school;

  document.getElementById('upload-screen').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
  document.getElementById('btn-export').style.display = Store.hasFeature('excel_export') ? 'inline-block' : 'none';
  document.getElementById('btn-add-school').style.display = 'inline-block';
  document.getElementById('btn-clear').style.display = 'inline-block';
  document.getElementById('btn-backup').style.display = Store.user?.role === 'admin' || Store.mode !== 'api' ? 'inline-block' : 'none';
  document.getElementById('btn-upload-cancel').style.display = 'none';

  uploadRaw.X = null;
  uploadRaw.XII = null;
  resetCardState('X');
  resetCardState('XII');
  document.getElementById('btn-analyze').disabled = true;
  if(examLabelInput) examLabelInput.value = DEFAULT_EXAM_LABEL;
  refreshExamLabelDates();

  renderParseWarnings();
  renderWorkspacePanel();
  renderActiveWorkspaceHeader();
  buildClassTabs();
  switchClass(DB.X.length ? 'X' : 'XII');
  autoLoadMappingFiles(merged);
}

function saveToLocalStorage(){ /* school sessions are persisted during runAnalysis */ }

async function clearSavedData(){
  const sessions = getActiveSessions();
  for(const session of sessions){
    await Store.deleteSession(session.schoolCode, session.year, session);
    // Also clear localStorage keys regardless of mode
    ['X','XII'].forEach(cls => localStorage.removeItem(`${session.schoolCode}-${session.year}-${cls}`));
    [STUDENT_MASTER_SUFFIX, TEACHER_MAPPING_SUFFIX, FOLLOW_UP_SUFFIX].forEach(suffix =>
      localStorage.removeItem(getSessionStorageKey(session, suffix))
    );
  }
  const removedIds = new Set(sessions.map(session => session.sessionId));
  savedCombinations = savedCombinations.filter(combo =>
    !combo.selectedSessionIds.some(id => removedIds.has(id))
  );
  await persistSavedCombinations();
  location.reload();
}

async function deleteSessionCard(sessionId){
  const session = schoolSessions[sessionId];
  if(!session) return;
  const examLabel = normalizeExamLabel(session.examLabel);
  const ownerNote = Store.user?.role === 'admin' && session.ownerUsername ? ` (uploaded by ${session.ownerUsername})` : '';
  const labelNote = examLabel !== DEFAULT_EXAM_LABEL ? ` — ${examLabel}` : '';
  const clsList = ['X','XII'].filter(cls => session.classes?.[cls]);

  // If this owner has no other exam attempt for this school/year, also clean up the
  // shared master data (student master, teacher mapping, follow-ups, performance marks)
  // instead of leaving it orphaned. Otherwise only remove this specific attempt.
  const siblingAttempts = Object.values(schoolSessions).filter(s =>
    s.sessionId !== sessionId &&
    s.schoolCode === session.schoolCode &&
    String(s.year) === String(session.year) &&
    (s.ownerUserId || null) === (session.ownerUserId || null)
  );
  const isLastAttempt = siblingAttempts.length === 0;
  const scopeNote = isLastAttempt
    ? ' This is the only saved attempt for this school/year, so student master, teacher mapping, follow-ups and performance marks will be removed too.'
    : ' Other exam attempts and shared master data for this school/year will be kept.';

  const proceed = confirm(
    `Delete ${session.schoolName || session.schoolCode} · ${session.year}${labelNote}${ownerNote} (Class ${clsList.join(' & ') || '—'})?` +
    scopeNote + ' This cannot be undone.'
  );
  if(!proceed) return;

  if(isLastAttempt){
    await Store.deleteSession(session.schoolCode, session.year, session);
    clsList.forEach(cls => localStorage.removeItem(`${session.schoolCode}-${session.year}-${cls}`));
    [STUDENT_MASTER_SUFFIX, TEACHER_MAPPING_SUFFIX, FOLLOW_UP_SUFFIX].forEach(suffix =>
      localStorage.removeItem(getSessionStorageKey(session, suffix))
    );
  } else {
    for(const cls of clsList){
      await Store.deleteSessionAttempt(session.schoolCode, session.year, cls, examLabel, session);
    }
  }

  savedCombinations = savedCombinations.filter(combo => !combo.selectedSessionIds.includes(sessionId));
  await persistSavedCombinations();
  location.reload();
}

async function resetAllData(){
  const confirmText = prompt('This will permanently erase ALL saved schools, master data, follow-ups and combinations for every user, and clear this browser\'s local storage. This cannot be undone.\n\nType RESET to confirm.');
  if(confirmText !== 'RESET') return;

  if(Store.mode === 'api'){
    try{
      const r = await fetch('/api/admin/reset-data', { method: 'POST' });
      if(!r.ok){
        const body = await r.json().catch(() => ({}));
        alert(body.error || 'Failed to reset database.');
        return;
      }
    }catch(err){
      alert('Failed to reset database. Please check your connection and try again.');
      return;
    }
  }

  localStorage.clear();
  alert('Database and local storage have been cleared.');
  location.reload();
}

function collectSavedSessions(){
  return Object.values(schoolSessions).sort((a,b)=>{
    const yearDiff = String(b.year).localeCompare(String(a.year));
    if(yearDiff) return yearDiff;
    return String(a.schoolCode).localeCompare(String(b.schoolCode));
  });
}

function exportBackup(){
  const sessions = collectSavedSessions();
  if(!sessions.length){
    alert('No saved data found to back up. Please analyse results first.');
    return;
  }

  const meta = parseMeta(raw.X || raw.XII || '');
  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    generator: 'CBSE Result Dashboard',
    sessions: sessions.map(session => ({
      schoolCode: session.schoolCode,
      year: session.year,
      examLabel: normalizeExamLabel(session.examLabel),
      classes: {
        ...(session.classes.X ? {X: session.classes.X.rawText} : {}),
        ...(session.classes.XII ? {XII: session.classes.XII.rawText} : {}),
      }
    })),
    combinations: savedCombinations,
    studentMasters: [],
    teacherMappings: [],
    followUps: sessions
      .filter(session => session.masterData?.followUps && Object.keys(session.masterData.followUps).length)
      .map(session => ({schoolCode: session.schoolCode, year: session.year, rows: session.masterData.followUps}))
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const school = (meta.school || meta.code || 'CBSE').replace(/\s+/g,'_').substring(0,20);
  a.download = `CBSE_Backup_${school}_${meta.year || ''}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function getSessionMeta(session){
  if(session.schoolName) return {school: session.schoolName, code: session.schoolCode, year: session.year};
  const rawClass = session.classes?.X || session.classes?.XII || '';
  const text = typeof rawClass === 'string' ? rawClass : rawClass?.rawText || '';
  const meta = parseMeta(text);
  return {school: meta.school || session.schoolCode, code: session.schoolCode, year: session.year};
}

function syncWorkspaceControls(){
  const modeEl = document.getElementById('workspace-mode');
  const yearEl = document.getElementById('compare-year');
  const classEl = document.getElementById('compare-class');
  const meritEl = document.getElementById('compare-merit-scope');
  const performanceTypeEl = document.getElementById('performance-component-type');
  if(modeEl) modeEl.value = workspaceState.mode;
  if(classEl) classEl.value = workspaceState.classScope;
  if(meritEl) meritEl.value = workspaceState.meritScope;
  if(performanceTypeEl){
    const session = getCurrentSingleSession();
    performanceTypeEl.value = session?.masterData?.performanceMarks?.componentType || 'internal';
  }
  if(yearEl){
    const sessions = collectSavedSessions();
    const years = [...new Set(sessions.map(session => session.year))].sort().reverse();
    yearEl.innerHTML = `<option value="all">All Years</option>` + years.map(year =>
      `<option value="${year}">${year}</option>`
    ).join('');
    yearEl.value = years.includes(workspaceState.comparisonYear) ? workspaceState.comparisonYear : 'all';
    workspaceState.comparisonYear = yearEl.value;
  }
}

function renderMappingFileChip(label, rowCount, status){
  const state = status?.status || 'idle';
  const expected = status?.expected || [];
  let note = 'Not loaded';
  if(state === 'loading') note = 'Looking in folder...';
  else if(state === 'loaded') note = `Loaded ${status.fileName}`;
  else if(state === 'manual') note = `Uploaded ${status.fileName}`;
  else if(state === 'legacy') note = 'Loaded from older saved data';
  else if(state === 'blocked') note = 'Use http://127.0.0.1:8000, not file://';
  else if(state === 'missing') note = expected.length ? `Expected ${expected.slice(0, 2).join(' or ')}` : 'Not loaded';
  else if(rowCount) note = 'Loaded from older saved data';

  return `<span class="master-chip" title="${escapeAttr(note)}">${label} <strong>${rowCount}</strong><small>${escapeHtml(note)}</small></span>`;
}

function renderPerformanceReport(masterData){
  const reportRows = masterData?.performanceMarks?.reportRows || [];
  if(!reportRows.length) return '';
  const diagnostics = masterData?.diagnostics?.performanceMarks || createEmptyMasterData().diagnostics.performanceMarks;
  const matched = reportRows.filter(row => row.status === 'Matched').length;
  const duplicate = reportRows.filter(row => row.status === 'Duplicate Upload').length;
  const missing = reportRows.filter(row => row.status === 'Missing').length;
  const scopeLabel = diagnostics.scopedClasses?.length ? diagnostics.scopedClasses.join(', ') : 'uploaded classes';
  const sortedRows = [...reportRows].sort((a, b) => {
    const order = {'Missing':0, 'Duplicate Upload':1, 'Matched':2};
    if(a.status !== b.status) return (order[a.status] ?? 9) - (order[b.status] ?? 9);
    return String(a.rollNo).localeCompare(String(b.rollNo)) || String(a.subjectCode).localeCompare(String(b.subjectCode));
  });
  return `
    <details class="performance-report">
      <summary>Performance Upload Report <strong>${reportRows.length}</strong><span>Scope ${scopeLabel} | Uploaded ${diagnostics.rows} | Matched ${matched} | Duplicate upload rows ${duplicate} | Upload unmatched ${diagnostics.unmatched} | Expected subject rows missing upload ${diagnostics.missingCoverage}</span></summary>
      <div class="performance-report-table tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Status</th>
              <th>Reason</th>
              <th>Roll No</th>
              <th>Class</th>
              <th>Student</th>
              <th>Subject Code</th>
              <th>Subject</th>
              <th>Component</th>
              <th>Component Max</th>
              <th>Total</th>
              <th>Theory</th>
              <th>Theory Max</th>
            </tr>
          </thead>
          <tbody>
            ${sortedRows.map(row => `
              <tr>
                <td><span class="report-status ${row.status === 'Matched' ? 'ok' : 'miss'}">${row.status}</span></td>
                <td>${escapeHtml(row.reason || '-')}</td>
                <td>${escapeHtml(row.rollNo)}</td>
                <td>${escapeHtml(row.class)}</td>
                <td>${escapeHtml(row.studentName || '-')}</td>
                <td>${escapeHtml(row.subjectCode)}</td>
                <td>${escapeHtml(row.subjectName || '-')}</td>
                <td>${row.componentMarks}</td>
                <td>${row.componentMaxMarks}</td>
                <td>${row.totalMarks === '' ? '-' : row.totalMarks}</td>
                <td>${row.theoryMarks === '' ? '-' : row.theoryMarks}</td>
                <td>${row.theoryMaxMarks === '' ? '-' : row.theoryMaxMarks}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </details>`;
}

function renderWorkspacePanel(){
  syncWorkspaceControls();
  const sessions = collectSavedSessions();
  const sessionList = document.getElementById('session-list');
  const comboList = document.getElementById('combination-list');
  const workspaceSub = document.getElementById('workspace-sub');
  const selectedCount = getActiveSessions().length;
  const session = getCurrentSingleSession();
  const masterData = session?.masterData || createEmptyMasterData();
  workspaceSub.textContent = selectedCount
    ? `${selectedCount} school${selectedCount > 1 ? 's' : ''} selected. Use Multi-School mode for comparison and combined merit.`
    : 'Upload or restore schools to start a multischool workspace.';
  if(session && !isMultiMode()){
    const performanceRows = masterData.performanceMarks?.rows?.length || 0;
    const performanceType = masterData.performanceMarks?.componentType
      ? (masterData.performanceMarks.componentType === 'practical' ? 'Practical' : 'Internal')
      : 'Performance';
    workspaceSub.innerHTML += `<div class="master-status">
      ${renderMappingFileChip('Student Master', masterData.studentMaster.length, masterData.mappingFiles?.studentMaster)}
      ${renderMappingFileChip('Teacher Mapping', masterData.teacherMappings.length, masterData.mappingFiles?.teacherMappings)}
      ${renderMappingFileChip(`${performanceType} Upload`, performanceRows, masterData.mappingFiles?.performanceMarks)}
      <span class="master-chip">Follow-Up Notes <strong>${Object.keys(masterData.followUps || {}).length}</strong></span>
    </div>
    <div class="mapping-helper">Auto-load uses school-code Excel files in this folder. Upload only if you want to override for this session. Real-performance uploads stay in memory for this browser session.</div>
    ${renderPerformanceReport(masterData)}`;
  }

  sessionList.innerHTML = sessions.length ? sessions.map(session => {
    const selected = workspaceState.selectedSessionIds.includes(session.sessionId);
    const examLabel = normalizeExamLabel(session.examLabel);
    const examBadge = examLabel !== DEFAULT_EXAM_LABEL
      ? `<span class="cpill" style="background:#eef2ff;color:#4f46e5">${escapeHtml(examLabel)}</span>` : '';
    return `<div class="session-card ${selected ? 'selected' : ''}">
      <div class="session-meta">
        <div class="session-title">${getSessionLabel(session)}</div>
        <div class="session-sub">${session.schoolCode} | ${session.year}</div>
        <div class="session-badges">${listSessionClassBadges(session)} ${examBadge}</div>
      </div>
      <div class="session-actions">
        <button class="session-select" onclick="toggleSessionSelection('${session.sessionId}')">${selected ? 'Remove' : 'Select'}</button>
        <button class="session-open" onclick="openSingleSession('${session.sessionId}')">Open</button>
        <button class="session-delete" onclick="deleteSessionCard('${session.sessionId}')">Delete</button>
      </div>
    </div>`;
  }).join('') : '<div class="workspace-empty">No saved schools yet.</div>';

  comboList.innerHTML = savedCombinations.length ? savedCombinations.map(combo => `
    <div class="combo-card">
      <div class="session-meta">
        <div class="session-title">${combo.name}</div>
        <div class="combo-meta">${combo.selectedSessionIds.length} schools | Default class ${combo.defaultClassScope || 'X'} | ${combo.meritScope || 'same-class'}</div>
      </div>
      <button class="combo-open" onclick="openCombination('${combo.id}')">Open</button>
    </div>
  `).join('') : '<div class="workspace-empty">No saved combinations yet.</div>';

  updateMixedYearBanner();
  renderActiveWorkspaceHeader();
  updateStorageIndicator();
  document.getElementById('dashboard').style.display = sessions.length ? 'block' : document.getElementById('dashboard').style.display;
}

function toggleSessionSelection(sessionId){
  if(workspaceState.selectedSessionIds.includes(sessionId)){
    workspaceState.selectedSessionIds = workspaceState.selectedSessionIds.filter(id => id !== sessionId);
  } else {
    workspaceState.selectedSessionIds = [...workspaceState.selectedSessionIds, sessionId];
  }
  if(workspaceState.selectedSessionIds.length <= 1){
    workspaceState.mode = 'single';
    if(workspaceState.selectedSessionIds.length === 1) openSingleSession(workspaceState.selectedSessionIds[0]);
    else {
      activeSessionId = null;
      activeCls = null;
      renderWorkspacePanel();
      buildClassTabs();
      renderSec();
    }
  } else {
    workspaceState.mode = 'multi';
    renderWorkspacePanel();
    buildClassTabs();
    renderSec();
  }
}

function openSingleSession(sessionId){
  const session = schoolSessions[sessionId];
  if(!session) return;
  workspaceState.selectedSessionIds = [sessionId];
  workspaceState.mode = 'single';
  workspaceState.activeCombinationId = null;
  applySessionToActiveData(sessionId);
  document.getElementById('dashboard').style.display = 'block';
  document.getElementById('btn-export').style.display = Store.hasFeature('excel_export') ? 'inline-block' : 'none';
  document.getElementById('btn-add-school').style.display = 'inline-block';
  renderParseWarnings();
  renderWorkspacePanel();
  buildClassTabs();
  switchClass(DB.X.length ? 'X' : 'XII');
  // If server already loaded master rows, skip the Excel file-fetch entirely.
  const md = session.masterData;
  const hasServerRows = Store.mode === 'api' &&
    (md?.studentMaster?.length || md?.teacherMappings?.length);
  console.log('[CBSE openSingleSession] hasServerRows='+hasServerRows+
    ' studentMaster='+(md?.studentMaster?.length||0)+
    ' teacherMappings='+(md?.teacherMappings?.length||0));
  if(hasServerRows){
    renderSec();
  } else {
    autoLoadMappingFiles(session);
  }
}

function onWorkspaceModeChange(){
  const modeEl = document.getElementById('workspace-mode');
  workspaceState.mode = modeEl.value;
  if(workspaceState.mode === 'single' && workspaceState.selectedSessionIds.length){
    openSingleSession(workspaceState.selectedSessionIds[0]);
    return;
  }
  renderWorkspacePanel();
  buildClassTabs();
  renderSec();
}

function onWorkspaceFilterChange(){
  workspaceState.comparisonYear = document.getElementById('compare-year').value;
  workspaceState.classScope = document.getElementById('compare-class').value;
  workspaceState.meritScope = document.getElementById('compare-merit-scope').value;
  renderWorkspacePanel();
  renderSec();
}

async function promptSaveCombination(){
  const selected = getActiveSessions();
  if(selected.length < 2){
    alert('Select at least two schools before saving a combination.');
    return;
  }
  const name = window.prompt('Combination name', `Combination ${savedCombinations.length + 1}`);
  if(!name) return;
  const now = new Date().toISOString();
  const combo = {
    id: `combo-${Date.now()}`,
    name,
    selectedSessionIds: [...workspaceState.selectedSessionIds],
    defaultClassScope: workspaceState.classScope,
    meritScope: workspaceState.meritScope,
    createdAt: now,
    updatedAt: now,
  };
  savedCombinations = [...savedCombinations, combo];
  await persistSavedCombinations();
  renderWorkspacePanel();
}

function openCombination(comboId){
  const combo = savedCombinations.find(item => item.id === comboId);
  if(!combo) return;
  const existingIds = combo.selectedSessionIds.filter(id => schoolSessions[id]);
  const missingCount = combo.selectedSessionIds.length - existingIds.length;
  workspaceState.selectedSessionIds = existingIds;
  workspaceState.classScope = combo.defaultClassScope || 'X';
  workspaceState.meritScope = combo.meritScope || 'same-class';
  workspaceState.mode = existingIds.length > 1 ? 'multi' : 'single';
  workspaceState.activeCombinationId = comboId;
  if(missingCount){
    alert(`Combination restored partially. ${missingCount} saved school reference(s) were not found in local storage.`);
  }
  if(workspaceState.mode === 'single' && existingIds[0]) openSingleSession(existingIds[0]);
  else {
    renderWorkspacePanel();
    buildClassTabs();
    renderSec();
  }
}

function showUploadScreen(){
  document.getElementById('upload-screen').style.display = 'flex';
  document.getElementById('btn-upload-cancel').style.display = document.getElementById('dashboard').style.display === 'block' ? 'inline-block' : 'none';
}

function hideUploadScreen(){
  if(document.getElementById('dashboard').style.display === 'block'){
    document.getElementById('upload-screen').style.display = 'none';
  }
}

function openSessionOverlay(config){
  overlayState = config;
  const overlay = document.getElementById('import-overlay');
  const container = document.getElementById('import-sessions');
  const loadBtn = document.getElementById('import-btn-load');
  document.getElementById('import-title').textContent = config.title;
  document.getElementById('import-desc').textContent = config.description;
  loadBtn.textContent = config.buttonLabel || 'Load Selected';
  loadBtn.disabled = true;

  container.innerHTML = config.items.map((item, i) => {
    if(item.kind === 'combination'){
      return `<div class="import-session" data-idx="${i}" onclick="selectImportSession(this)">
        <div style="font-size:16px;font-weight:800;font-family:'DM Mono',monospace">C${i + 1}</div>
        <div class="import-session-info">
          <div class="import-session-name">${item.name}</div>
          <div class="import-session-meta">${item.selectedSessionIds.length} schools &nbsp;&middot;&nbsp; default ${item.defaultClassScope || 'X'}</div>
        </div>
      </div>`;
    }
    const session = item;
    const clsList = Object.keys(session.classes || {});
    const meta = getSessionMeta(session);
    const schoolName = meta.school || session.schoolCode;
    const classBadges = clsList.map(c =>
      `<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:${c==='X'?'var(--cx-lt)':'var(--cxii-lt)'};color:${c==='X'?'var(--cx-dk)':'var(--cxii-dk)'}">Class ${c}</span>`
    ).join('');
    return `<div class="import-session" data-idx="${i}" onclick="selectImportSession(this)">
      <div style="font-size:16px;font-weight:800;font-family:'DM Mono',monospace">${i + 1}</div>
      <div class="import-session-info">
        <div class="import-session-name">${schoolName}</div>
        <div class="import-session-meta">School ${session.schoolCode} &nbsp;&middot;&nbsp; ${session.year}${session.examLabel && normalizeExamLabel(session.examLabel) !== DEFAULT_EXAM_LABEL ? ' &nbsp;&middot;&nbsp; ' + escapeHtml(session.examLabel) : ''}</div>
        <div class="import-session-cls">${classBadges}</div>
      </div>
    </div>`;
  }).join('');

  if(config.items.length === 1){
    const card = container.querySelector('.import-session');
    if(card){
      card.classList.add('selected');
      loadBtn.disabled = false;
    }
  }

  overlay.classList.add('show');
}

function handleImportFile(e){
  const file = e.target.files[0];
  if(!file) return;
  e.target.value = '';
  const r = new FileReader();
  r.onload = ev => {
    let data;
    try {
      data = JSON.parse(ev.target.result);
    } catch {
      alert('Invalid backup file - could not parse JSON.');
      return;
    }

    if(!data.version || !Array.isArray(data.sessions) || !data.sessions.length){
      alert('Invalid backup file - missing sessions data.');
      return;
    }

    const exportedAt = new Date(data.exportedAt);
    const dateText = isNaN(exportedAt) ? '' : ` Backed up ${exportedAt.toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'numeric'})}.`;
    const items = [
      ...data.sessions.map(session => ({...session, kind:'session'})),
      ...((data.combinations || []).map(combo => ({...combo, kind:'combination'})))
    ];
    openSessionOverlay({
      mode:'backup',
      items,
      payload:data,
      title:'Restore from Backup',
      description:`${items.length} saved item${items.length > 1 ? 's' : ''} found in this backup.${dateText} Select one to load.`,
      buttonLabel:'Load Selected'
    });
  };
  r.readAsText(file,'UTF-8');
}

function selectImportSession(el){
  document.querySelectorAll('.import-session').forEach(c=>c.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('import-btn-load').disabled = false;
}

function closeImportOverlay(){
  document.getElementById('import-overlay').classList.remove('show');
  overlayState = null;
}

function showRestoreBanner(message){
  const banner = document.getElementById('restore-banner');
  document.getElementById('restore-msg').textContent = message;
  banner.classList.add('show');
}

function restoreSession(session, source, restoredMasterData){
  const examLabel = normalizeExamLabel(session.examLabel);
  const merged = mergeSessionIntoRegistry(buildSessionFromRawClasses({
    X: session.classes?.X?.rawText || session.classes?.X || null,
    XII: session.classes?.XII?.rawText || session.classes?.XII || null,
  }, examLabel));
  if(restoredMasterData){
    merged.masterData = {
      ...(merged.masterData || createEmptyMasterData()),
      ...restoredMasterData,
    };
  }
  openSingleSession(createSessionId(session.schoolCode, session.year, examLabel));
  showRestoreBanner(`${source} - School ${session.schoolCode} | ${session.year}${examLabel !== DEFAULT_EXAM_LABEL ? ' | ' + examLabel : ''}`);
}

async function doImport(){
  if(!overlayState) return;
  const selected = document.querySelector('.import-session.selected');
  if(!selected){
    alert('Please select a session to load.');
    return;
  }

  const idx = parseInt(selected.dataset.idx, 10);
  const item = overlayState.items[idx];
  if(!item){
    alert('Saved item not found.');
    return;
  }

  if(overlayState.mode === 'backup'){
    if(item.kind === 'session'){
      // Save via Store (handles both API and localStorage modes)
      const mockSession = {
        schoolCode: item.schoolCode, schoolName: item.schoolName || item.schoolCode,
        year: item.year,
        examLabel: normalizeExamLabel(item.examLabel),
        classes: Object.fromEntries(
          Object.entries(item.classes).map(([cls, rawText]) => [cls, {rawText}])
        ),
      };
      await Store.saveSession(mockSession);
      const studentMaster = (overlayState.payload?.studentMasters || []).find(entry =>
        entry.schoolCode === item.schoolCode && String(entry.year) === String(item.year)
      );
      const teacherMapping = (overlayState.payload?.teacherMappings || []).find(entry =>
        entry.schoolCode === item.schoolCode && String(entry.year) === String(item.year)
      );
      const followUps = (overlayState.payload?.followUps || []).find(entry =>
        entry.schoolCode === item.schoolCode && String(entry.year) === String(item.year)
      );
      if(followUps){
        const fuSession = {schoolCode:item.schoolCode, year:item.year, masterData:{followUps: followUps.rows || {}}};
        await Store.saveFollowUps(fuSession);
      }
      await rebuildSessionsFromLocalStorage();
      closeImportOverlay();
      const restoredMasterData = createEmptyMasterData();
      if(studentMaster){
        restoredMasterData.studentMaster = mapStudentMasterRows(studentMaster.rows || []);
        setMappingFileStatus(
          {masterData: restoredMasterData, schoolCode:item.schoolCode, year:item.year},
          'student',
          {status:'manual', fileName:'backup JSON', expected:getMappingFileCandidates(item, 'student')}
        );
      }
      if(teacherMapping){
        restoredMasterData.teacherMappings = mapTeacherRows(teacherMapping.rows || []);
        setMappingFileStatus(
          {masterData: restoredMasterData, schoolCode:item.schoolCode, year:item.year},
          'teacher',
          {status:'manual', fileName:'backup JSON', expected:getMappingFileCandidates(item, 'teacher')}
        );
      }
      if(followUps) restoredMasterData.followUps = followUps.rows || {};
      restoreSession(item, 'Data restored from backup', restoredMasterData);
      return;
    }
    savedCombinations = [...savedCombinations, {...item, kind:undefined}];
    await persistSavedCombinations();
    await rebuildSessionsFromLocalStorage();
    closeImportOverlay();
    openCombination(item.id);
    return;
  }

  closeImportOverlay();
  if(item.kind === 'combination'){
    openCombination(item.id);
    return;
  }
  restoreSession(item, 'Data restored from saved session');
}

async function tryRestoreFromLocalStorage(){
  // Detect whether a Flask/SQLite backend is available, then load sessions
  await Store.detectMode();
  console.log('[CBSE restore] Store.mode='+Store.mode);
  
  if(Store.mode === 'api'){
    const auth = await Store.checkAuth();
    syncUserUI();
    if(!auth.loggedIn){
      console.log('[CBSE auth] user not logged in, halting restore');
      return;
    }
  } else {
    syncUserUI();
  }
  
  await rebuildSessionsFromLocalStorage();
  const sessions = collectSavedSessions();
  console.log('[CBSE restore] sessions found='+sessions.length);
  if(sessions.length) {
    const s = schoolSessions[sessions[0].sessionId];
    console.log('[CBSE restore] first session studentMaster='+(s?.masterData?.studentMaster?.length||0)+' teacherMappings='+(s?.masterData?.teacherMappings?.length||0));
  }
  if(!sessions.length){
    renderWorkspacePanel();
    return;
  }

  if(sessions.length === 1 && !savedCombinations.length){
    openSingleSession(sessions[0].sessionId);
    showRestoreBanner(`Data restored from saved session - School ${sessions[0].schoolCode} | ${sessions[0].year}`);
    return;
  }

  openSessionOverlay({
    mode:'saved',
    items: [
      ...sessions.map(session => ({...session, kind:'session'})),
      ...savedCombinations.map(combo => ({...combo, kind:'combination'}))
    ],
    title:'Choose Saved Item',
    description:`Saved schools and combinations were found in this browser. Select one to restore.`,
    buttonLabel:'Restore Selected'
  });
  document.getElementById('dashboard').style.display = 'block';
  renderWorkspacePanel();
  document.getElementById('btn-backup').style.display = 'inline-block';
}
/* ── CLASS TABS ── */
function buildClassTabs(){
  const bar = document.getElementById('class-tabs');
  if(isMultiMode()){
    bar.style.display = 'none';
    return;
  }
  bar.style.display = 'flex';
  bar.innerHTML = '';
  ['X','XII'].forEach(c => {
    if(!DB[c].length) return;
    const b = document.createElement('button');
    b.id = 'ctab-'+c;
    b.className = 'ctab';
    b.innerHTML = `Class ${c} <span class="cpill cpill-${c}">${DB[c].length} students</span>`;
    b.onclick = ()=>switchClass(c);
    bar.appendChild(b);
  });
}

function switchClass(cls){
  activeCls = cls;
  document.querySelectorAll('.ctab').forEach(b=>b.classList.remove('ax','axii'));
  const bt = document.getElementById('ctab-'+cls);
  if(bt) bt.classList.add(cls==='X'?'ax':'axii');
  renderSec();
}

/* ── SECTION TABS ── */
function showSec(name, btn){
  activeSec = name;
  document.querySelectorAll('.stab').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  else {
    // sync desktop tabs when triggered from mobile select
    document.querySelectorAll('.stab').forEach(b=>{
      if(b.getAttribute('onclick') && b.getAttribute('onclick').includes("'"+name+"'")) b.classList.add('active');
    });
  }
  // sync mobile select
  const mob = document.getElementById('sec-select-mobile');
  if(mob) mob.value = name;
  document.querySelectorAll('.sec-panel').forEach(p=>p.classList.remove('active'));
  document.getElementById('sec-'+name).classList.add('active');
  renderSec();
}

function renderSec(){
  if(isMultiMode()){
    if(activeSec==='summary')  renderMultischoolSummary();
    if(activeSec==='merit')    renderCombinedMerit();
    if(activeSec==='subjects' || activeSec==='gender' || activeSec==='students' || activeSec==='sections' || activeSec==='teachers' || activeSec==='followup'){
      renderMultiPlaceholder(activeSec);
    }
    return;
  }
  if(!activeCls) return;
  if(activeSec==='summary')  renderSummary(activeCls);
  if(activeSec==='subjects') renderSubjects(activeCls);
  if(activeSec==='merit')    renderMerit(activeCls);
  if(activeSec==='gender')   renderGender(activeCls);
  if(activeSec==='students') renderStudents(activeCls);
  if(activeSec==='sections') renderSectionReview(activeCls);
  if(activeSec==='teachers') renderTeacherReview(activeCls);
  if(activeSec==='followup') renderFollowUp(activeCls);
  if(activeSec==='search')   doSearch();
}

/* ── HELPERS ── */
function st(students){
  const pass=students.filter(s=>s.result==='PASS').length;
  const comp=students.filter(s=>s.result==='COMP').length;
  const abst=students.filter(s=>s.result==='ABST').length;
  const n=students.length;
  return {pass,comp,abst,n,pct:n?((pass/n)*100).toFixed(1):'0.0'};
}
function tm(s){ return s.subjects.reduce((a,b)=>a+(b.marks||0),0); }
function avg(a){ return a.length?a.reduce((x,y)=>x+y,0)/a.length:0; }
function pct(n,d){ return d?((n/d)*100).toFixed(1):'0.0'; }
function dc(id){ if(charts[id]){charts[id].destroy();delete charts[id];} }

// Colour palettes per class
const CC = {
  X:  {main:'#c9a84c',dk:'#a07830',boys:'#6b4226',girls:'#c9a84c',
       bar:i=>`hsl(42,${65-i*3}%,${38+i*2}%)`},
  XII:{main:'#0e7490',dk:'#0a5570',boys:'#0a5570',girls:'#22b8d8',
       bar:i=>`hsl(195,${65-i*3}%,${36+i*2}%)`},
};

function sc(lbl,val,det,type=''){
  return `<div class="scard ${type}"><div class="slbl">${lbl}</div>
    <div class="sval">${val}</div><div class="sdet">${det}</div></div>`;
}

function stripe(cls, students){
  const s = st(students);
  const meta = parseMeta(raw[cls]||'');
  const exam = cls==='X'?'All India Secondary School Examination':'Senior School Certificate Examination';
  const detail = [meta.code?`School ${meta.code}`:'', meta.school||'', meta.region?`Region: ${meta.region}`:''].filter(Boolean).join(' · ');
  const session = (!isMultiMode() && activeSessionId) ? schoolSessions[activeSessionId] : null;
  const examLabel = session ? normalizeExamLabel(session.examLabel) : null;
  const examBadge = examLabel && examLabel !== DEFAULT_EXAM_LABEL
    ? `<span style="display:inline-block;margin-left:8px;padding:2px 9px;border-radius:20px;background:rgba(255,255,255,.3);color:#fff;font-size:10px;font-weight:800;letter-spacing:.03em;vertical-align:middle;">${escapeHtml(examLabel).toUpperCase()}${meta.date ? ' · ' + escapeHtml(meta.date) : ''}</span>`
    : '';
  return `<div class="cls-stripe s${cls}">
    <div class="cs-class">${cls}</div>
    <div class="cs-info">
      <div class="cs-exam">CBSE ${meta.year}${examBadge}</div>
      <div class="cs-name">${exam}</div>
      <div class="cs-detail">${detail}</div>
    </div>
    <div class="cs-space"></div>
    <div class="cs-big">
      <div class="cs-big-num">${s.pct}%</div>
      <div class="cs-big-lbl">Pass Rate</div>
    </div>
  </div>`;
}

function getComparisonSessions(){
  return getActiveSessions().filter(session =>
    workspaceState.comparisonYear === 'all' || String(session.year) === String(workspaceState.comparisonYear)
  );
}

function getStudentsForScope(session, scope){
  if(scope === 'all'){
    return [
      ...(session.classes.X ? session.classes.X.students : []),
      ...(session.classes.XII ? session.classes.XII.students : [])
    ];
  }
  return session.classes[scope] ? session.classes[scope].students : [];
}

function getScopedTopper(session, scope){
  const students = getStudentsForScope(session, scope).filter(s => s.result === 'PASS' || s.result === 'COMP');
  if(!students.length) return null;
  const topperPool = students.map(student => {
    const engCode = student.cls === 'XII' ? '301' : '184';
    const score = computeScore(student, {mode:'bestNEng', n:5, engCode});
    return {...student, schoolCode: session.schoolCode, schoolName: session.schoolName, year: session.year, _pct: score.pct};
  }).sort((a,b) => b._pct - a._pct);
  return topperPool[0];
}

function renderMultiPlaceholder(section){
  const titles = {
    subjects: 'Subject analysis remains school-specific in this release.',
    gender: 'Gender analysis remains school-specific in this release.',
    students: 'The all students table remains school-specific in this release.',
    sections: 'Section review is available in single-school mode after student master upload.',
    teachers: 'Teacher review is available in single-school mode after teacher mapping upload.',
    followup: 'Follow-up tracking is available in single-school mode.'
  };
  const targetMap = {
    subjects: 'd-subjects',
    gender: 'd-gender',
    students: 'd-students',
    sections: 'd-sections',
    teachers: 'd-teachers',
    followup: 'd-followup',
  };
  const target = targetMap[section];
  document.getElementById(target).innerHTML = `<div class="compare-note">${titles[section]} Open one school to use this tab, or use Summary and Merit for multischool comparison.</div>`;
}

function renderMultischoolSummary(){
  const sessions = getComparisonSessions();
  if(!sessions.length){
    document.getElementById('d-summary').innerHTML = '<div class="compare-note">No schools selected for comparison.</div>';
    return;
  }

  const scope = workspaceState.classScope;
  const rows = sessions.map(session => {
    const students = getStudentsForScope(session, scope);
    const stats = st(students);
    const topper = getScopedTopper(session, scope);
    return {
      session,
      students,
      stats,
      avgTotal: avg(students.filter(s => s.result === 'PASS').map(s => tm(s))).toFixed(1),
      topper
    };
  }).filter(row => row.students.length);

  if(!rows.length){
    document.getElementById('d-summary').innerHTML = '<div class="compare-note">No student data available for the selected year/class scope.</div>';
    return;
  }

  const subjectSet = new Map();
  rows.forEach(row => {
    row.students.forEach(student => {
      student.subjects.forEach(subject => {
        if(!subjectSet.has(subject.code)) subjectSet.set(subject.code, subject.name);
      });
    });
  });
  const subjectRows = [...subjectSet.entries()].map(([code, name]) => {
    const cells = rows.map(row => {
      const marks = row.students.flatMap(student => student.subjects.filter(subject => subject.code === code && subject.grade !== 'AB').map(subject => subject.marks));
      return marks.length ? avg(marks).toFixed(1) : '—';
    });
    return {code, name, cells};
  });

  document.getElementById('d-summary').innerHTML = `
    <div class="sec-h">
      <div class="sec-title">School Comparison</div>
      <div class="sec-sub">${scope === 'all' ? 'All classes' : `Class ${scope}`} across ${rows.length} selected school${rows.length > 1 ? 's' : ''}</div>
    </div>
    <div class="comparison-grid">
      ${rows.map(row => `
        <div class="card">
          <div class="card-title">${row.session.schoolName}</div>
          <div class="slbl">School ${row.session.schoolCode} · ${row.session.year}</div>
          <div class="stat-grid" style="margin-top:14px">
            ${sc('Students', row.stats.n, `${row.stats.pct}% pass`, 'blue')}
            ${sc('Pass', row.stats.pass, `${row.stats.comp} compartment`, 'green')}
            ${sc('Absent', row.stats.abst, `${row.stats.n - row.stats.pass - row.stats.comp - row.stats.abst} fail`, 'red')}
            ${sc('Avg Total', row.avgTotal, 'PASS students only', 'amber')}
          </div>
          <div style="font-size:13px;color:#777;margin-top:10px">
            ${row.topper ? `Topper: <strong>${row.topper.name}</strong> (${row.topper._pct.toFixed(2)}%)` : 'No topper data'}
          </div>
        </div>
      `).join('')}
    </div>
    <div class="two-col">
      <div class="card">
        <div class="card-title">Core Metrics by School</div>
        <div class="tbl-wrap">
          <table>
            <thead><tr><th>School</th><th>Year</th><th>Total</th><th>Pass</th><th>Comp</th><th>Absent</th><th>Pass %</th><th>Avg Total</th></tr></thead>
            <tbody>
              ${rows.map(row => `
                <tr>
                  <td><strong>${row.session.schoolName}</strong><div style="font-size:11px;color:#999">School ${row.session.schoolCode}</div></td>
                  <td>${row.session.year}</td>
                  <td>${row.stats.n}</td>
                  <td>${row.stats.pass}</td>
                  <td>${row.stats.comp}</td>
                  <td>${row.stats.abst}</td>
                  <td style="font-family:'DM Mono',monospace;font-weight:700;color:var(--green)">${row.stats.pct}%</td>
                  <td>${row.avgTotal}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <div class="card-title">Topper Comparison</div>
        <div class="tbl-wrap">
          <table>
            <thead><tr><th>School</th><th>Topper</th><th>Class</th><th>Score %</th></tr></thead>
            <tbody>
              ${rows.map(row => `
                <tr>
                  <td><strong>${row.session.schoolName}</strong></td>
                  <td>${row.topper ? row.topper.name : '—'}</td>
                  <td>${row.topper ? row.topper.cls : '—'}</td>
                  <td style="font-family:'DM Mono',monospace;font-weight:700;color:var(--green)">${row.topper ? row.topper._pct.toFixed(2)+'%' : '—'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Subject Averages by School</div>
      <div class="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Subject</th>
              <th>Code</th>
              ${rows.map(row => `<th>${row.session.schoolCode}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${subjectRows.map(row => `
              <tr>
                <td><strong>${row.name}</strong></td>
                <td style="font-family:'DM Mono',monospace">${row.code}</td>
                ${row.cells.map(cell => `<td>${cell}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

function detectEngCodeFromStudents(cls, students){
  const engCodes = cls === 'XII' ? ['301','302','001','002','118','120'] : ['184','001','002','085'];
  const allCodes = new Set();
  students.forEach(student => student.subjects.forEach(subject => allCodes.add(subject.code)));
  return engCodes.find(code => allCodes.has(code)) || (cls === 'XII' ? '301' : '184');
}

function getCombinedMeritPool(settings){
  const sessions = getComparisonSessions();
  const meritScope = workspaceState.meritScope;
  if(meritScope === 'same-class' && workspaceState.classScope === 'all') return {error:'Choose Class X or Class XII for same-class combined merit.'};
  let pool = [];
  sessions.forEach(session => {
    const scopes = meritScope === 'all-classes' && workspaceState.classScope === 'all' ? ['X','XII'] : [workspaceState.classScope === 'all' ? 'X' : workspaceState.classScope];
    scopes.forEach(cls => {
      const students = getStudentsForScope(session, cls).filter(student => student.result === 'PASS' || student.result === 'COMP');
      const engCode = detectEngCodeFromStudents(cls, students);
      students.forEach(student => {
        const score = computeScore(student, {...settings, engCode: settings.mode === 'bestNEng' ? engCode : settings.engCode});
        pool.push({
          ...student,
          schoolCode: session.schoolCode,
          schoolName: session.schoolName,
          year: session.year,
          _pct: score.pct,
          _used: score.used
        });
      });
    });
  });
  return {pool};
}

/* ══════════════════════════════════════════════════════════════
   SUMMARY
══════════════════════════════════════════════════════════════ */
function renderSummary(cls){
  const sts = DB[cls];
  const s = st(sts);
  const boys  = sts.filter(x=>x.gender==='M');
  const girls = sts.filter(x=>x.gender==='F');
  const sb = st(boys), sg = st(girls);

  // Subject-wise result table — group by subject code across all students
  const subResultMap = {};
  sts.forEach(x=>{
    x.subjects.forEach(sub=>{
      if(!subResultMap[sub.code]) subResultMap[sub.code]={name:sub.name,list:[]};
      subResultMap[sub.code].list.push(x);
    });
  });
  // Deduplicate: each student counted once per subject (some students appear in multiple subject rows)
  // Per-subject pass/fail handles both older grade-bearing files and marks-only files.
  const subjectRows = {};
  sts.forEach(x=>{
    x.subjects.forEach(sub=>{
      if(!subjectRows[sub.code]) subjectRows[sub.code]={name:sub.name,code:sub.code,total:0,pass:0,comp:0,abst:0};
      const r = subjectRows[sub.code];
      r.total++;
      if(subjectIsAbsent(sub)) r.abst++;
      else if(subjectIsFail(sub)) r.comp++;
      else r.pass++;
    });
  });
  const sRows = Object.values(subjectRows)
    .sort((a,b)=>b.total-a.total)
    .map(r=>{
      const pp = r.total ? ((r.pass/r.total)*100).toFixed(1) : '0.0';
      return `<tr>
        <td><strong>${r.name}</strong></td>
        <td style="font-family:'DM Mono',monospace;color:#bbb;font-size:12px">${r.code}</td>
        <td>${r.total}</td>
        <td><span class="badge bp">${r.pass}</span></td>
        <td><span class="badge bc">${r.comp}</span></td>
        <td><span class="badge ba">${r.abst}</span></td>
        <td style="font-family:'DM Mono',monospace;font-weight:700;color:var(--green)">${pp}%</td>
      </tr>`;
    }).join('');

  // Topper card — best-of-5-with-English scoring
  const engCode = detectEngCode(cls);
  const passPool = sts.filter(s=>s.result==='PASS'||s.result==='COMP');
  const topperData = passPool.map(x=>{
    const sc2 = computeScore(x,{mode:'bestNEng',n:5,engCode});
    return {...x,_pct:sc2.pct};
  }).sort((a,b)=>b._pct-a._pct);
  const topper = topperData[0];
  const topperHtml = topper ? `
    <div class="card" style="border-left:4px solid var(--gold);padding:16px 22px;margin-bottom:16px;display:flex;align-items:center;gap:22px;flex-wrap:wrap">
      <div style="font-size:30px;line-height:1">&#127942;</div>
      <div style="flex:1;min-width:180px">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#aaa;margin-bottom:4px">School Topper &mdash; Class ${cls}</div>
        <div style="font-family:'DM Serif Display',serif;font-size:20px;color:var(--ink)">${topper.name}</div>
        <div style="font-size:12px;color:#bbb;font-family:'DM Mono',monospace;margin-top:2px">Roll ${topper.rollNo} &nbsp;&middot;&nbsp; ${topper.gender==='F'?'Girl':'Boy'}</div>
      </div>
      <div style="text-align:right">
        <div style="font-family:'DM Mono',monospace;font-size:38px;font-weight:300;color:var(--green);line-height:1">${topper._pct.toFixed(2)}%</div>
        <div style="font-size:11px;color:#bbb;text-transform:uppercase;letter-spacing:.08em;margin-top:3px">Best 5 with English</div>
      </div>
    </div>` : '';

  const metaS = parseMeta(raw[cls]||'');
  document.getElementById('d-summary').innerHTML = `
    ${stripe(cls,sts)}
    <div class="stat-grid">
      ${sc('Total Students', s.n, `Class ${cls} \u00b7 CBSE ${metaS.year||''}`, cls==='X'?'cx':'cxii')}
      ${sc('Passed',         s.pass, s.pct+'% pass rate', 'green')}
      ${sc('Compartment',   s.comp, 'Need to clear 1+ sub', 'amber')}
      ${sc('Absent',        s.abst, 'Did not appear', 'red')}
      ${sc('Boys',    sb.n, sb.pct+'% passed', 'blue')}
      ${sc('Girls',   sg.n, sg.pct+'% passed', 'blue')}
    </div>
    ${topperHtml}

    <div class="two-col">
      <div class="card">
        <div class="card-title">Result Distribution — Class ${cls}</div>
        <div class="cwrap"><canvas id="c-sdnt-${cls}"></canvas></div>
      </div>
      <div class="card">
        <div class="card-title">Boys vs Girls — Pass % — Class ${cls}</div>
        <div class="cwrap"><canvas id="c-sgdr-${cls}"></canvas></div>
      </div>
    </div>
    <div class="two-col">
      <div class="card">
        <div class="card-title">Grade Distribution — Class ${cls} (all subjects)</div>
        <div class="cwrap"><canvas id="c-sgrb-${cls}"></canvas></div>
      </div>
      <div class="card">
        <div class="card-title">Subject-wise Result Breakdown — Class ${cls}</div>
        <div class="tbl-wrap" style="max-height:260px;overflow-y:auto">
          <table>
            <thead><tr><th>Subject</th><th>Code</th><th>Students</th><th>Pass</th><th>Failed/Comp</th><th>Absent</th><th>Pass %</th></tr></thead>
            <tbody>${sRows}</tbody>
          </table>
        </div>
      </div>
    </div>`;

  // Donut
  dc('c-sdnt-'+cls);
  charts['c-sdnt-'+cls] = new Chart(document.getElementById('c-sdnt-'+cls),{
    type:'doughnut',
    data:{labels:['Pass','Compartment','Absent'],
      datasets:[{data:[s.pass,s.comp,s.abst],
        backgroundColor:['#1a7a4a','#d4800a','#c0392b'],borderWidth:0,hoverOffset:6}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:'62%',
      plugins:{legend:{position:'bottom',labels:{font:{family:'Nunito',size:12},padding:14}},
        tooltip:{callbacks:{label:ctx=>` ${ctx.label}: ${ctx.raw}`}}}}
  });

  // Gender pass bar
  dc('c-sgdr-'+cls);
  charts['c-sgdr-'+cls] = new Chart(document.getElementById('c-sgdr-'+cls),{
    type:'bar',
    data:{labels:['Boys','Girls'],
      datasets:[{data:[parseFloat(sb.pct),parseFloat(sg.pct)],
        backgroundColor:[CC[cls].boys,CC[cls].girls],borderRadius:6,barThickness:50}]},
    options:{responsive:true,maintainAspectRatio:false,
      scales:{y:{min:0,max:100,ticks:{callback:v=>v+'%',font:{family:'DM Mono'}},grid:{color:'#f0ede8'}},
              x:{grid:{display:false},ticks:{font:{family:'Nunito',weight:'700'}}}},
      plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>` ${ctx.raw}%`}}}}
  });

  // Grade bar
  dc('c-sgrb-'+cls);
  const grades=['A1','A2','B1','B2','C1','C2','D1','D2','E'];
  const gc={}; grades.forEach(g=>gc[g]=0);
  sts.forEach(x=>x.subjects.forEach(sub=>{if(gc[sub.grade]!==undefined)gc[sub.grade]++;}));
  const gcols=['#1a7a4a','#2d8a3a','#1a4a7a','#2a5a9a','#8a6a00','#9a7a00','#8a4a00','#9a5a00','#c0392b'];
  charts['c-sgrb-'+cls] = new Chart(document.getElementById('c-sgrb-'+cls),{
    type:'bar',
    data:{labels:grades,datasets:[{data:grades.map(g=>gc[g]),backgroundColor:gcols,borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,
      scales:{y:{ticks:{font:{family:'DM Mono'}},grid:{color:'#f0ede8'}},
              x:{grid:{display:false},ticks:{font:{family:'DM Mono',size:12}}}},
      plugins:{legend:{display:false}}}
  });
}
/* ══════════════════════════════════════════════════════════════
   MERIT — CBSE dynamic scoring
══════════════════════════════════════════════════════════════ */

// Auto-detect English subject code for a class
function renderSubjects(cls){
  const sts = DB[cls];
  if(!sts.length){document.getElementById('d-subjects').innerHTML=nodata();return;}
  const {students: enrichedStudents} = buildEnrichedStudents(cls);
  const showTeacherDetail = !!subjectViewState[cls]?.showTeacherDetail;
  const mode = getActivePerformanceMode(cls);
  const modeLabel = getPerformanceModeLabel(cls, mode);
  const {labels: buckets, getBucket} = getPerformanceBuckets(mode);
  const chartLabel = mode === 'total' ? `Average ${modeLabel}` : `Average ${modeLabel} %`;

  const sm = {};
  enrichedStudents.forEach(student => student.subjects.forEach(subject => {
    if(!sm[subject.code]) sm[subject.code] = {code:subject.code, name:subject.name, marks:[], compareValues:[], performanceRecords:[], maxValues:[], pass:0, valid:0, abs:0, missing:0, mb:{}};
    const entry = sm[subject.code];
    if(subjectIsAbsent(subject)){
      entry.abs++;
      return;
    }
    const mark = getPerformanceMark(subject, mode);
    const compareValue = getPerformanceCompareValue(subject, mode);
    const maxValue = getPerformanceMax(subject, mode);
    if(mark === null){
      entry.missing++;
      return;
    }
    entry.marks.push(mark);
    if(compareValue !== null) entry.compareValues.push(compareValue);
    if(maxValue !== null) entry.maxValues.push(maxValue);
    if(compareValue !== null && maxValue !== null){
      entry.performanceRecords.push({mark, maxValue, percentage:(mark / maxValue) * 100});
    }
    entry.valid++;
    const bucket = getBucket(subject);
    if(bucket) entry.mb[bucket] = (entry.mb[bucket] || 0) + 1;
    if(isPerformancePass(subject, mode)) entry.pass++;
  }));
  const subs = Object.values(sm).filter(subject => (subject.valid + subject.abs + subject.missing) > 0).sort((a,b) => avg(b.compareValues) - avg(a.compareValues));
  const heatMapRows = subs.map(subject => {
    const percentages = buckets.map(bucket => {
      const count = subject.mb[bucket] || 0;
      return {
        bucket,
        count,
        percentage: subject.valid ? (count / subject.valid) * 100 : 0
      };
    });
    return {subject, percentages};
  });

  const teacherDetails = {};
  enrichedStudents.forEach(student => {
    student.subjects.forEach(subject => {
      if(!teacherDetails[subject.code]) teacherDetails[subject.code] = {};
      const key = `${subject.teacherName || 'Unmapped'}|${student.section || 'UNMAPPED'}`;
      if(!teacherDetails[subject.code][key]){
        teacherDetails[subject.code][key] = {
          teacherName: subject.teacherName || 'Unmapped',
          section: student.section || 'UNMAPPED',
          total: 0,
          absent: 0,
          missing: 0,
          taught: 0,
          pass: 0,
          fail: 0,
          marks: [],
          compareValues: [],
          performanceRecords: [],
          maxValues: [],
          mb: {},
        };
      }
      const row = teacherDetails[subject.code][key];
      row.total += 1;
      if(subjectIsAbsent(subject)){
        row.absent += 1;
        return;
      }
      const mark = getPerformanceMark(subject, mode);
      const compareValue = getPerformanceCompareValue(subject, mode);
      const maxValue = getPerformanceMax(subject, mode);
      if(mark === null){
        row.missing += 1;
        return;
      }
      row.taught += 1;
      row.marks.push(mark);
      if(compareValue !== null) row.compareValues.push(compareValue);
      if(maxValue !== null) row.maxValues.push(maxValue);
      if(compareValue !== null && maxValue !== null){
        row.performanceRecords.push({mark, maxValue, percentage:(mark / maxValue) * 100});
      }
      if(isPerformancePass(subject, mode)) row.pass += 1;
      else row.fail += 1;
      const bucket = getBucket(subject);
      if(bucket) row.mb[bucket] = (row.mb[bucket] || 0) + 1;
    });
  });

  document.getElementById('d-subjects').innerHTML = `
    <div class="sec-h">
      <div class="sec-title">Subject Performance - Class ${cls}</div>
      <div class="sec-sub">Average marks, highest score and threshold % per subject · ${sts.length} students</div>
    </div>
    ${renderPerformanceControls(cls)}
    <div class="card">
      <div class="card-title">Average ${modeLabel} by Subject - Class ${cls}</div>
      <div class="cwrap-lg"><canvas id="c-subavg-${cls}"></canvas></div>
    </div>
    <div class="card subject-heatmap-card">
      <div class="subject-heatmap-heading">
        <div>
          <div class="card-title subject-heatmap-title">Marks Distribution Heat Map - Class ${cls}</div>
          <div class="subject-heatmap-subtitle">Each cell shows the percentage of applicable students in that marks bucket. Absent and unavailable marks are excluded.</div>
        </div>
        <div class="subject-heatmap-legend" aria-label="Heat map colour scale from zero to one hundred percent">
          <span>0%</span>
          <span class="subject-heatmap-legend-bar" aria-hidden="true"></span>
          <span>100%</span>
        </div>
      </div>
      <div class="subject-heatmap-scroll" tabindex="0" aria-label="Subject marks distribution heat map">
        <table class="subject-heatmap-table">
          <thead>
            <tr>
              <th class="subject-heatmap-subject-col">Subject</th>
              ${buckets.map(bucket => `<th>${bucket}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${heatMapRows.map(row => `
              <tr>
                <th class="subject-heatmap-subject-col" scope="row">
                  <span>${escapeHtml(row.subject.name)}</span>
                  <small>${row.subject.valid} applicable</small>
                </th>
                ${row.percentages.map(cell => {
                  const roundedPercentage = Number(cell.percentage.toFixed(1));
                  const isEmpty = cell.count === 0;
                  const background = isEmpty
                    ? '#f1f0ed'
                    : `hsl(174 68% ${Math.max(28, 94 - (roundedPercentage * 0.66))}%)`;
                  const color = roundedPercentage >= 58 ? '#fff' : '#123b38';
                  const tooltip = `${row.subject.name} · ${cell.bucket}: ${cell.count} of ${row.subject.valid} applicable students (${roundedPercentage.toFixed(1)}%)`;
                  const safeTooltip = escapeHtml(tooltip).replace(/"/g, '&quot;');
                  return `<td class="subject-heatmap-cell${isEmpty ? ' is-empty' : ''}"
                    style="background:${background};color:${color}"
                    title="${safeTooltip}"
                    aria-label="${safeTooltip}">${roundedPercentage.toFixed(1)}%</td>`;
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
    <div class="card" style="max-width:100%;overflow-x:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px">
        <div class="card-title" style="margin-bottom:0">Detailed ${modeLabel} Breakdown Table - Class ${cls}</div>
        <button class="btn-restore-json workspace-btn" onclick="toggleSubjectTeacherDetail('${cls}')" style="display:inline-block;padding:8px 14px">
          ${showTeacherDetail ? 'Hide Teacher Detail' : 'Show Teacher Detail'}
        </button>
      </div>
      <div class="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th rowspan="2" style="white-space:nowrap">Subject</th>
              <th rowspan="2" style="white-space:nowrap">Code</th>
              <th rowspan="2" style="white-space:nowrap">TOTAL</th>
              <th rowspan="2" style="white-space:nowrap">ABS</th>
              <th rowspan="2" style="white-space:nowrap">NA</th>
              <th rowspan="2" style="white-space:nowrap">APP</th>
              <th rowspan="2" style="white-space:nowrap">${getPerformanceLowLabel(mode)}</th>
              <th rowspan="2" style="white-space:nowrap">AT/ABOVE THRESHOLD</th>
              <th rowspan="2" style="white-space:nowrap">THRESHOLD%</th>
              <th rowspan="2" style="white-space:nowrap">OUT OF</th>
              <th rowspan="2" style="white-space:nowrap">AVG</th>
              <th rowspan="2" style="white-space:nowrap">MAX<div style="font-size:9px;font-weight:600;color:#999">% · MARKS · COUNT</div></th>
              <th rowspan="2" style="white-space:nowrap">MIN<div style="font-size:9px;font-weight:600;color:#999">% · MARKS · COUNT</div></th>
              <th colspan="8" style="text-align:center;background:var(--paper);color:#888;font-size:11px;letter-spacing:.06em">MARKS DISTRIBUTION</th>
            </tr>
            <tr>${buckets.map(bucket => `<th style="white-space:nowrap;font-size:11px;text-align:center;padding:4px 6px">${bucket}</th>`).join('')}</tr>
          </thead>
          <tbody>${subs.map(subject => {
            const total = subject.valid + subject.abs + subject.missing;
            const avgMarks = formatPerformanceValue(subject.compareValues, mode, 'avg');
            const maxMarks = formatPerformanceExtreme(subject.performanceRecords, 'max');
            const minMarks = formatPerformanceExtreme(subject.performanceRecords, 'min');
            const outOf = getPerformanceOutOfLabel(subject.maxValues, mode);
            const fail = subject.valid - subject.pass;
            const passPct = subject.valid ? pct(subject.pass, subject.valid) : '0.0';
            const ppColor = parseFloat(passPct) >= 90 ? 'var(--green)' : parseFloat(passPct) >= 75 ? '#1a7a8a' : parseFloat(passPct) >= 50 ? 'var(--amber)' : 'var(--red)';
            const detailRows = Object.values(teacherDetails[subject.code] || {}).sort((a,b) => a.teacherName.localeCompare(b.teacherName) || a.section.localeCompare(b.section));
            const rowHighlight = showTeacherDetail && detailRows.length
              ? 'background:#fdf1cc;border-top:2px solid #dfbf73;border-bottom:2px solid #dfbf73;'
              : '';
            const detailHtml = showTeacherDetail && detailRows.length ? `<tr>
              <td colspan="${13 + buckets.length}" style="padding:0;background:#fbf8f3">
                <div style="padding:12px 16px">
                  <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#9a8f82;margin-bottom:8px">Teacher-Level Detail</div>
                  <table style="width:100%">
                    <thead>
                      <tr>
                        <th style="text-align:left">Teacher</th>
                        <th style="text-align:left">Section</th>
                        <th style="text-align:center">TOTAL</th>
                        <th style="text-align:center">ABS</th>
                        <th style="text-align:center">NA</th>
                        <th style="text-align:center">APP</th>
                        <th style="text-align:center">At/Above Threshold</th>
                        <th style="text-align:center">${getPerformanceLowLabel(mode)}</th>
                        <th style="text-align:center">Threshold %</th>
                        <th style="text-align:center">Out Of</th>
                        <th style="text-align:center">Avg</th>
                        <th style="text-align:center">Max<div style="font-size:9px;font-weight:600;color:#999">% · Marks · Count</div></th>
                        <th style="text-align:center">Min<div style="font-size:9px;font-weight:600;color:#999">% · Marks · Count</div></th>
                        ${buckets.map(bucket => `<th style="text-align:center">${bucket}</th>`).join('')}
                      </tr>
                    </thead>
                    <tbody>
                      ${detailRows.map(row => {
                        const rowAvg = formatPerformanceValue(row.compareValues, mode, 'avg');
                        const rowMax = formatPerformanceExtreme(row.performanceRecords, 'max');
                        const rowMin = formatPerformanceExtreme(row.performanceRecords, 'min');
                        const rowOutOf = getPerformanceOutOfLabel(row.maxValues, mode);
                        const rowPassPct = row.taught ? ((row.pass / row.taught) * 100).toFixed(1) : '0.0';
                        return `<tr>
                          <td><strong>${row.teacherName}</strong></td>
                          <td>${row.section}</td>
                          <td style="text-align:center">${row.total}</td>
                          <td style="text-align:center">${row.absent}</td>
                          <td style="text-align:center">${row.missing}</td>
                          <td style="text-align:center">${row.taught}</td>
                          <td style="text-align:center;color:var(--green);font-weight:700">${row.pass}</td>
                          <td style="text-align:center;color:var(--red)">${row.fail}</td>
                          <td style="text-align:center;font-family:'DM Mono',monospace">${rowPassPct}%</td>
                          <td style="text-align:center;font-family:'DM Mono',monospace">${rowOutOf}</td>
                          <td style="text-align:center;font-family:'DM Mono',monospace">${rowAvg}</td>
                          <td style="text-align:center;font-family:'DM Mono',monospace">${rowMax}</td>
                          <td style="text-align:center;font-family:'DM Mono',monospace">${rowMin}</td>
                          ${buckets.map(bucket => {
                            const count = row.mb[bucket] || 0;
                            return `<td style="text-align:center;font-family:'DM Mono',monospace;${count > 0 ? 'font-weight:700' : 'color:#ddd'}">${count || '-'}</td>`;
                          }).join('')}
                        </tr>`;
                      }).join('')}
                    </tbody>
                  </table>
                </div>
              </td>
            </tr>` : '';
            return `<tr class="${showTeacherDetail && detailRows.length ? 'subject-drilled-row' : ''}">
              <td style="white-space:nowrap;${rowHighlight}"><strong>${subject.name}</strong></td>
              <td style="font-family:'DM Mono',monospace;color:#bbb;font-size:12px;text-align:center;${rowHighlight}">${subject.code}</td>
              <td style="font-family:'DM Mono',monospace;text-align:center;${rowHighlight}">${total}</td>
              <td style="font-family:'DM Mono',monospace;text-align:center;${rowHighlight}">${subject.abs}</td>
              <td style="font-family:'DM Mono',monospace;text-align:center;${rowHighlight}">${subject.missing}</td>
              <td style="font-family:'DM Mono',monospace;text-align:center;${rowHighlight}">${subject.valid}</td>
              <td style="font-family:'DM Mono',monospace;text-align:center;color:var(--red);${rowHighlight}">${fail}</td>
              <td style="font-family:'DM Mono',monospace;text-align:center;color:var(--green);font-weight:700;${rowHighlight}">${subject.pass}</td>
              <td style="font-family:'DM Mono',monospace;font-weight:700;text-align:center;color:${ppColor};${rowHighlight}">${passPct}%</td>
              <td style="font-family:'DM Mono',monospace;text-align:center;${rowHighlight}">${outOf}</td>
              <td style="font-family:'DM Mono',monospace;text-align:center;${rowHighlight}">${avgMarks}</td>
              <td style="font-family:'DM Mono',monospace;text-align:center;${rowHighlight}">${maxMarks}</td>
              <td style="font-family:'DM Mono',monospace;text-align:center;${rowHighlight}">${minMarks}</td>
              ${buckets.map(bucket => {
                const count = subject.mb[bucket] || 0;
                return `<td style="font-family:'DM Mono',monospace;font-size:12px;text-align:center;${count > 0 ? 'font-weight:700' : 'color:#ddd'};${rowHighlight}">${count || '-'}</td>`;
              }).join('')}
            </tr>${detailHtml}`;
          }).join('')}</tbody>
        </table>
      </div>
    </div>`;

  const top = subs;
  const chartH = Math.max(300, top.length * 32);
  const canvasWrap = document.querySelector(`#c-subavg-${cls}`)?.parentElement;
  if(canvasWrap) canvasWrap.style.height = chartH + 'px';
  dc('c-subavg-'+cls);
  charts['c-subavg-'+cls] = new Chart(document.getElementById('c-subavg-'+cls),{
    type:'bar',
    data:{labels:top.map(subject => subject.name.length > 22 ? subject.name.slice(0,20) + '...' : subject.name),
      datasets:[{label:chartLabel,data:top.map(subject => parseFloat(avg(subject.compareValues).toFixed(1)) || 0),
        backgroundColor:top.map((_,i)=>CC[cls].bar(i)),borderRadius:4}]},
    options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,
      scales:{x:{ticks:{font:{family:'DM Mono'}},grid:{color:'#f0ede8'}},
              y:{ticks:{font:{family:'Nunito',size:12}},grid:{display:false}}},
      plugins:{legend:{display:false}}}
  });
}

function detectEngCode(cls){
  const engCodes = cls==='XII'
    ? ['301','302','001','002','118','120']  // prefer 301=English Core
    : ['184','001','002','085'];              // prefer 184=English Lang&Lit
  const allCodes = new Set();
  (DB[cls]||[]).forEach(s=>s.subjects.forEach(sub=>allCodes.add(sub.code)));
  return engCodes.find(c=>allCodes.has(c)) || '301';
}

// Compute score for a student given settings
function computeScore(s, settings){
  const subs = s.subjects.filter(sub=>sub.grade!=='AB');
  const sumM = arr => arr.reduce((a,b)=>a+b.marks,0);

  if(settings.mode==='all'){
    const total = sumM(subs);
    const maxM  = subs.length * 100;
    return { pct: maxM ? (total/maxM*100) : 0, used: subs.map(s=>s.code) };
  }

  const N = parseInt(settings.n)||5;

  if(settings.mode==='bestN'){
    const sorted = [...subs].sort((a,b)=>b.marks-a.marks);
    const best   = sorted.slice(0,N);
    return { pct: (sumM(best)/(N*100)*100), used: best.map(s=>s.code) };
  }

  if(settings.mode==='bestNEng'){
    const ec  = settings.engCode;
    const eng = subs.find(sub=>sub.code===ec);
    const rest= subs.filter(sub=>sub.code!==ec).sort((a,b)=>b.marks-a.marks);
    const best= eng ? [eng, ...rest.slice(0,N-1)] : rest.slice(0,N);
    return { pct: (sumM(best)/(N*100)*100), used: best.map(s=>s.code) };
  }
  return { pct:0, used:[] };
}

function renderMerit(cls){
  if(isMultiMode()){
    renderCombinedMerit();
    return;
  }
  const sts=DB[cls];
  if(!sts.length){document.getElementById('d-merit').innerHTML=nodata();return;}

  const engCode = detectEngCode(cls);

  document.getElementById('d-merit').innerHTML=`
    <div class="sec-h">
      <div class="sec-title">Merit List — Class ${cls}</div>
      <div class="sec-sub">Percentage-based ranking · PASS &amp; COMP students</div>
    </div>

    <!-- Settings Panel -->
    <div class="card" style="margin-bottom:14px;background:#faf8f4;border:1px solid var(--border)">
      <div style="font-family:'DM Serif Display',serif;font-size:14px;color:var(--ink);margin-bottom:12px">⚙ Merit Scoring Settings</div>
      <div style="display:flex;flex-wrap:wrap;gap:16px;align-items:flex-end">
        <div>
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#aaa;margin-bottom:6px">Scoring Mode</div>
          <select class="sselect" id="mm-${cls}" onchange="onMeritModeChange('${cls}')">
            <option value="bestNEng">Best N with English</option>
            <option value="bestN">Best N (any subjects)</option>
            <option value="all">All Subjects</option>
          </select>
        </div>
        <div id="mn-wrap-${cls}">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#aaa;margin-bottom:6px">N (count)</div>
          <input type="number" class="sinput" id="mn-${cls}" value="5" min="1" max="9"
            style="width:72px;padding:9px 12px;border-radius:50px"
            oninput="drawMerit('${cls}')">
        </div>
        <div id="me-wrap-${cls}">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#aaa;margin-bottom:6px">English Subject Code</div>
          <input type="text" class="sinput" id="me-${cls}" value="${engCode}" maxlength="4"
            style="width:100px;padding:9px 12px;border-radius:50px;font-family:'DM Mono',monospace"
            oninput="drawMerit('${cls}')">
        </div>
        <div>
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#aaa;margin-bottom:6px">Gender</div>
          <select class="sselect" id="mg-${cls}" onchange="drawMerit('${cls}')">
            <option value="all">All Students</option>
            <option value="M">Boys only</option>
            <option value="F">Girls only</option>
          </select>
        </div>
        <div>
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#aaa;margin-bottom:6px">Show</div>
          <select class="sselect" id="mc-${cls}" onchange="drawMerit('${cls}')">
            <option value="10">Top 10</option>
            <option value="25">Top 25</option>
            <option value="50">Top 50</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="tbl-wrap" id="mt-${cls}"></div>
    </div>`;

  drawMerit(cls);
}

function onMeritModeChange(cls){
  const mode = document.getElementById('mm-'+cls)?.value||'bestNEng';
  const nWrap = document.getElementById('mn-wrap-'+cls);
  const eWrap = document.getElementById('me-wrap-'+cls);
  if(nWrap) nWrap.style.display = mode==='all' ? 'none' : '';
  if(eWrap) eWrap.style.display = mode==='bestNEng' ? '' : 'none';
  drawMerit(cls);
}

function drawMerit(cls){
  if(isMultiMode()){
    drawCombinedMerit();
    return;
  }
  const gf   = document.getElementById('mg-'+cls)?.value||'all';
  const cf   = document.getElementById('mc-'+cls)?.value||'10';
  const mode = document.getElementById('mm-'+cls)?.value||'bestNEng';
  const n    = document.getElementById('mn-'+cls)?.value||'5';
  const ec   = (document.getElementById('me-'+cls)?.value||'301').trim();

  const settings = { mode, n, engCode: ec };

  // Include PASS and COMP students
  let pool = DB[cls].filter(s=>s.result==='PASS'||s.result==='COMP');
  if(gf!=='all') pool = pool.filter(s=>s.gender===gf);

  // Compute scores
  pool = pool.map(s=>{
    const sc = computeScore(s, settings);
    return { ...s, _pct: sc.pct, _used: sc.used };
  });

  // Sort: % desc, then English marks desc as tie-breaker
  pool.sort((a,b)=>{
    if(Math.abs(b._pct - a._pct) > 0.001) return b._pct - a._pct;
    const engA = a.subjects.find(sub=>sub.code===ec)?.marks||0;
    const engB = b.subjects.find(sub=>sub.code===ec)?.marks||0;
    if(engB!==engA) return engB-engA;
    // final tie-break: highest single subject
    const maxA = Math.max(...a.subjects.map(s=>s.marks||0));
    const maxB = Math.max(...b.subjects.map(s=>s.marks||0));
    return maxB-maxA;
  });

  if(cf!=='all') pool = pool.slice(0, parseInt(cf));

  // Dense ranking: ties share rank, next distinct score gets the next consecutive rank.
  let currentRank = 0;
  pool.forEach((s,i)=>{
    if(i>0 && Math.abs(s._pct-pool[i-1]._pct)<0.001){
      s._rank = pool[i-1]._rank;
    } else {
      currentRank += 1;
      s._rank = currentRank;
    }
  });

  const resBadge = r => r==='COMP'
    ? `<span class="badge bc" style="font-size:10px;margin-left:5px">COMP</span>`
    : `<span class="badge bp" style="font-size:10px;margin-left:5px">PASS</span>`;

  document.getElementById('mt-'+cls).innerHTML=`
    <table>
      <thead><tr>
        <th>Rank</th><th>Name</th><th>Roll No</th>
        <th>Gender</th><th>Result</th><th style="text-align:right">Score %</th><th>Subject Marks</th>
      </tr></thead>
      <tbody>${pool.length ? pool.map(s=>{
        const r=s._rank, bc=r===1?'r1':r===2?'r2':r===3?'r3':'';
        const usedSet = new Set(s._used);
        const subHtml = s.subjects.map(sub=>{
          const inScore = usedSet.has(sub.code);
          const style = inScore
            ? `font-weight:800;border:2px solid currentColor`
            : `opacity:0.35`;
          return `<span class="gr g-${sub.grade.toLowerCase()}" style="${style}">${sub.code}: ${sub.marks}</span>`;
        }).join(' ');
        return `<tr>
          <td><span class="rnk ${bc}">${r}</span></td>
          <td><strong>${s.name}</strong></td>
          <td style="font-family:'DM Mono',monospace;font-size:12px;color:#bbb">${s.rollNo}</td>
          <td>${s.gender==='F'?'👩 Girl':'👦 Boy'}</td>
          <td>${resBadge(s.result)}</td>
          <td style="font-family:'DM Mono',monospace;font-size:18px;font-weight:700;text-align:right;color:var(--green)">${s._pct.toFixed(2)}%</td>
          <td>${subHtml}</td>
        </tr>`;
      }).join('') : '<tr><td colspan="7" style="text-align:center;padding:32px;color:#ccc">No students found</td></tr>'}
      </tbody>
    </table>`;
}

function renderCombinedMerit(){
  document.getElementById('d-merit').innerHTML = `
    <div class="sec-h">
      <div class="sec-title">Combined Merit List</div>
      <div class="sec-sub">Across selected schools with source school, year, and class labels.</div>
    </div>
    <div class="card" style="margin-bottom:14px;background:#faf8f4;border:1px solid var(--border)">
      <div style="font-family:'DM Serif Display',serif;font-size:14px;color:var(--ink);margin-bottom:12px">Combined Merit Settings</div>
      <div style="display:flex;flex-wrap:wrap;gap:16px;align-items:flex-end">
        <div>
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#aaa;margin-bottom:6px">Scoring Mode</div>
          <select class="sselect" id="cm-mode" onchange="drawCombinedMerit()">
            <option value="bestNEng">Best N with English</option>
            <option value="bestN">Best N (any subjects)</option>
            <option value="all">All Subjects</option>
          </select>
        </div>
        <div id="cm-n-wrap">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#aaa;margin-bottom:6px">N (count)</div>
          <input type="number" class="sinput" id="cm-n" value="5" min="1" max="9" style="width:72px;padding:9px 12px;border-radius:50px" oninput="drawCombinedMerit()">
        </div>
        <div>
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#aaa;margin-bottom:6px">Gender</div>
          <select class="sselect" id="cm-g" onchange="drawCombinedMerit()">
            <option value="all">All Students</option>
            <option value="M">Boys only</option>
            <option value="F">Girls only</option>
          </select>
        </div>
        <div>
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#aaa;margin-bottom:6px">Show</div>
          <select class="sselect" id="cm-c" onchange="drawCombinedMerit()">
            <option value="10">Top 10</option>
            <option value="25">Top 25</option>
            <option value="50">Top 50</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="tbl-wrap" id="combined-merit-table"></div>
    </div>`;
  drawCombinedMerit();
}

function drawCombinedMerit(){
  const mode = document.getElementById('cm-mode')?.value || 'bestNEng';
  const n = document.getElementById('cm-n')?.value || '5';
  const gender = document.getElementById('cm-g')?.value || 'all';
  const count = document.getElementById('cm-c')?.value || '10';
  const settings = {mode, n, engCode:'301'};
  const meritResult = getCombinedMeritPool(settings);
  const container = document.getElementById('combined-merit-table');
  if(!container) return;
  if(meritResult.error){
    container.innerHTML = `<div class="compare-note">${meritResult.error}</div>`;
    currentCombinedMerit = null;
    return;
  }

  let pool = meritResult.pool;
  if(gender !== 'all') pool = pool.filter(student => student.gender === gender);
  pool.sort((a,b) => {
    if(Math.abs(b._pct - a._pct) > 0.001) return b._pct - a._pct;
    const engA = a.subjects.find(subject => ['184','301','302','001','002','085'].includes(subject.code))?.marks || 0;
    const engB = b.subjects.find(subject => ['184','301','302','001','002','085'].includes(subject.code))?.marks || 0;
    if(engB !== engA) return engB - engA;
    const maxA = Math.max(...a.subjects.map(subject => subject.marks || 0));
    const maxB = Math.max(...b.subjects.map(subject => subject.marks || 0));
    return maxB - maxA;
  });
  if(count !== 'all') pool = pool.slice(0, parseInt(count, 10));
  let currentRank = 0;
  pool.forEach((student, index) => {
    if(index > 0 && Math.abs(student._pct - pool[index - 1]._pct) < 0.001) student._rank = pool[index - 1]._rank;
    else {
      currentRank += 1;
      student._rank = currentRank;
    }
  });
  currentCombinedMerit = {pool, settings, meritScope: workspaceState.meritScope, classScope: workspaceState.classScope};

  container.innerHTML = `<table>
    <thead><tr>
      <th>Rank</th><th>Name</th><th>School</th><th>Year</th><th>Class</th><th>Roll No</th><th>Gender</th><th>Result</th><th style="text-align:right">Score %</th><th>Subject Marks</th>
    </tr></thead>
    <tbody>
      ${pool.length ? pool.map(student => {
        const usedSet = new Set(student._used);
        const r = student._rank;
        const bc = r===1?'r1':r===2?'r2':r===3?'r3':'';
        const subHtml = student.subjects.map(sub => `<span class="gr g-${sub.grade.toLowerCase()}" style="${usedSet.has(sub.code)?'font-weight:800;border:2px solid currentColor':'opacity:.35'}">${sub.code}: ${sub.marks}</span>`).join(' ');
        return `<tr>
          <td><span class="rnk ${bc}">${r}</span></td>
          <td><strong>${student.name}</strong></td>
          <td><strong>${student.schoolName}</strong><div style="font-size:11px;color:#999">School ${student.schoolCode}</div></td>
          <td>${student.year}</td>
          <td>${student.cls}</td>
          <td style="font-family:'DM Mono',monospace;font-size:12px;color:#bbb">${student.rollNo}</td>
          <td>${student.gender==='F'?'Girl':'Boy'}</td>
          <td>${student.result}</td>
          <td style="font-family:'DM Mono',monospace;font-size:18px;font-weight:700;text-align:right;color:var(--green)">${student._pct.toFixed(2)}%</td>
          <td>${subHtml}</td>
        </tr>`;
      }).join('') : '<tr><td colspan="10" style="text-align:center;padding:32px;color:#ccc">No students found</td></tr>'}
    </tbody>
  </table>`;
}

/* ══════════════════════════════════════════════════════════════
   GENDER
══════════════════════════════════════════════════════════════ */
function renderGender(cls){
  const sts=DB[cls];
  if(!sts.length){document.getElementById('d-gender').innerHTML=nodata();return;}
  const boys=sts.filter(s=>s.gender==='M');
  const girls=sts.filter(s=>s.gender==='F');
  const sb=st(boys), sg=st(girls);

  document.getElementById('d-gender').innerHTML=`
    <div class="sec-h">
      <div class="sec-title">Gender Analysis — Class ${cls}</div>
      <div class="sec-sub">Comparative performance between boys and girls</div>
    </div>
    <div class="gstrip">
      <div class="gcard">
        <div class="gicon">👦</div>
        <div><div class="gname">Boys</div><div class="gcnt">${sb.n}</div>
          <div class="gpct">✓ ${sb.pct}% passed</div></div>
      </div>
      <div class="gcard">
        <div class="gicon">👩</div>
        <div><div class="gname">Girls</div><div class="gcnt">${sg.n}</div>
          <div class="gpct">✓ ${sg.pct}% passed</div></div>
      </div>
    </div>
    <div class="two-col">
      <div class="card">
        <div class="card-title">Pass % — Boys vs Girls — Class ${cls}</div>
        <div class="cwrap"><canvas id="c-gp-${cls}"></canvas></div>
      </div>
      <div class="card">
        <div class="card-title">Average Total Marks — Class ${cls}</div>
        <div class="cwrap"><canvas id="c-ga-${cls}"></canvas></div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Subject-wise Average — Boys vs Girls — Class ${cls}</div>
      <div class="cwrap-lg"><canvas id="c-gs-${cls}"></canvas></div>
    </div>
    <div class="two-col">
      <div class="card">
        <div class="card-title">Grade Distribution — Boys — Class ${cls}</div>
        <div class="cwrap"><canvas id="c-ggb-${cls}"></canvas></div>
      </div>
      <div class="card">
        <div class="card-title">Grade Distribution — Girls — Class ${cls}</div>
        <div class="cwrap"><canvas id="c-ggg-${cls}"></canvas></div>
      </div>
    </div>`;

  // pass %
  dc('c-gp-'+cls);
  charts['c-gp-'+cls]=new Chart(document.getElementById('c-gp-'+cls),{
    type:'bar',
    data:{labels:['Boys','Girls'],
      datasets:[{data:[parseFloat(sb.pct),parseFloat(sg.pct)],
        backgroundColor:[CC[cls].boys,CC[cls].girls],borderRadius:6,barThickness:50}]},
    options:{responsive:true,maintainAspectRatio:false,
      scales:{y:{min:0,max:100,ticks:{callback:v=>v+'%',font:{family:'DM Mono'}},grid:{color:'#f0ede8'}},
              x:{grid:{display:false},ticks:{font:{family:'Nunito',weight:'700'}}}},
      plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>` ${ctx.raw}%`}}}}
  });

  // avg marks
  const ba=boys.filter(s=>s.result==='PASS').map(s=>tm(s));
  const ga=girls.filter(s=>s.result==='PASS').map(s=>tm(s));
  dc('c-ga-'+cls);
  charts['c-ga-'+cls]=new Chart(document.getElementById('c-ga-'+cls),{
    type:'bar',
    data:{labels:['Boys','Girls'],
      datasets:[{data:[parseFloat(avg(ba).toFixed(1)),parseFloat(avg(ga).toFixed(1))],
        backgroundColor:[CC[cls].boys,CC[cls].girls],borderRadius:6,barThickness:50}]},
    options:{responsive:true,maintainAspectRatio:false,
      scales:{y:{ticks:{font:{family:'DM Mono'}},grid:{color:'#f0ede8'}},
              x:{grid:{display:false},ticks:{font:{family:'Nunito',weight:'700'}}}},
      plugins:{legend:{display:false}}}
  });

  // subject comparison
  const subm={};
  sts.forEach(x=>x.subjects.forEach(sub=>{
    if(!subm[sub.code]) subm[sub.code]={name:sub.name,boys:[],girls:[]};
    if(sub.grade!=='AB'){
      if(x.gender==='M') subm[sub.code].boys.push(sub.marks);
      else subm[sub.code].girls.push(sub.marks);
    }
  }));
  const tsubs=Object.values(subm).filter(s=>s.boys.length>1&&s.girls.length>1)
    .sort((a,b)=>(b.boys.length+b.girls.length)-(a.boys.length+a.girls.length));
  // Dynamic height for gender subject chart
  const gChartH = Math.max(300, tsubs.length * 32);
  const gCanvasWrap = document.querySelector(`#c-gs-${cls}`)?.parentElement;
  if(gCanvasWrap) gCanvasWrap.style.height = gChartH + 'px';
  dc('c-gs-'+cls);
  charts['c-gs-'+cls]=new Chart(document.getElementById('c-gs-'+cls),{
    type:'bar',
    data:{labels:tsubs.map(s=>s.name.length>16?s.name.slice(0,14)+'…':s.name),
      datasets:[
        {label:'Boys Avg',data:tsubs.map(s=>parseFloat(avg(s.boys).toFixed(1))),backgroundColor:CC[cls].boys,borderRadius:3},
        {label:'Girls Avg',data:tsubs.map(s=>parseFloat(avg(s.girls).toFixed(1))),backgroundColor:CC[cls].girls,borderRadius:3}
      ]},
    options:{responsive:true,maintainAspectRatio:false,
      scales:{y:{ticks:{font:{family:'DM Mono'}},grid:{color:'#f0ede8'}},
              x:{grid:{display:false},ticks:{font:{family:'Nunito',size:11}}}},
      plugins:{legend:{position:'bottom',labels:{font:{family:'Nunito',size:12},padding:12}}}}
  });

  // grade distributions
  const grades=['A1','A2','B1','B2','C1','C2','D1','D2','E'];
  const gcols=['#1a7a4a','#2d8a3a','#1a4a7a','#2a5a9a','#8a6a00','#9a7a00','#8a4a00','#9a5a00','#c0392b'];
  [['b',boys,'c-ggb-'],['g',girls,'c-ggg-']].forEach(([,pool,id])=>{
    const gc={}; grades.forEach(g=>gc[g]=0);
    pool.forEach(x=>x.subjects.forEach(sub=>{if(gc[sub.grade]!==undefined)gc[sub.grade]++;}));
    dc(id+cls);
    charts[id+cls]=new Chart(document.getElementById(id+cls),{
      type:'bar',
      data:{labels:grades,datasets:[{data:grades.map(g=>gc[g]),backgroundColor:gcols,borderRadius:3}]},
      options:{responsive:true,maintainAspectRatio:false,
        scales:{y:{ticks:{font:{family:'DM Mono'}},grid:{color:'#f0ede8'}},
                x:{grid:{display:false},ticks:{font:{family:'DM Mono',size:11}}}},
        plugins:{legend:{display:false}}}
    });
  });
}

/* ══════════════════════════════════════════════════════════════
   SEARCH  (both classes, results grouped)
══════════════════════════════════════════════════════════════ */
function nodata(){ return '<div class="nodata">No data loaded for this class</div>'; }

/* ══════════════════════════════════════════════════════════════
   ALL STUDENTS TABLE
══════════════════════════════════════════════════════════════ */
function renderStudents(cls){
  const sts = DB[cls];
  if(!sts.length){document.getElementById('d-students').innerHTML=nodata();return;}

  // collect all subject codes in order of first appearance
  const subCols = [];
  const seenCodes = new Set();
  sts.forEach(s=>s.subjects.forEach(sub=>{
    if(!seenCodes.has(sub.code)){ seenCodes.add(sub.code); subCols.push({code:sub.code,name:sub.name}); }
  }));

  document.getElementById('d-students').innerHTML=`
    <div class="sec-h">
      <div class="sec-title">All Students — Class ${cls}</div>
      <div class="sec-sub">${sts.length} students · all subjects · click column headers to sort</div>
    </div>
    <div class="sbar">
      <input class="sinput" id="stf-q-${cls}" type="text" placeholder="🔍  Search by name or roll number…"
        oninput="drawStudents('${cls}')">
      <select class="sselect" id="stf-res-${cls}" onchange="drawStudents('${cls}')">
        <option value="all">All Results</option>
        <option value="PASS">Pass</option>
        <option value="COMP">Compartment</option>
        <option value="ABST">Absent</option>
        <option value="FAIL">Fail</option>
      </select>
      <select class="sselect" id="stf-gen-${cls}" onchange="drawStudents('${cls}')">
        <option value="all">All Genders</option>
        <option value="M">Boys</option>
        <option value="F">Girls</option>
      </select>
      <button class="btn-export" style="display:inline-block;padding:10px 20px;font-size:13px"
        onclick="exportCurrentView('${cls}')">⬇ Export Excel</button>
    </div>
    <div id="st-cnt-${cls}" style="font-size:12px;color:#aaa;font-family:'DM Mono',monospace;margin-bottom:8px"></div>
    <div class="card" style="padding:0">
      <div class="tbl-wrap" id="st-tbl-${cls}"></div>
    </div>`;

  drawStudents(cls);
}

function drawStudents(cls){
  const resF = document.getElementById('stf-res-'+cls)?.value || 'all';
  const genF = document.getElementById('stf-gen-'+cls)?.value || 'all';
  const q    = (document.getElementById('stf-q-'+cls)?.value || '').toLowerCase().trim();

  // collect subject cols
  const subCols = [];
  const seenCodes = new Set();
  DB[cls].forEach(s=>s.subjects.forEach(sub=>{
    if(!seenCodes.has(sub.code)){ seenCodes.add(sub.code); subCols.push({code:sub.code,name:sub.name}); }
  }));

  let pool = DB[cls]
    .filter(s=> resF==='all' || s.result===resF)
    .filter(s=> genF==='all' || s.gender===genF)
    .filter(s=> !q || s.name.toLowerCase().includes(q) || s.rollNo.includes(q));

  // sorting
  const ss = sortState[cls] || {col:'total', dir:-1};
  pool = pool.slice().sort((a,b)=>{
    let av, bv;
    if(ss.col==='name')   { av=a.name; bv=b.name; return ss.dir*(av<bv?-1:av>bv?1:0); }
    if(ss.col==='roll')   { av=a.rollNo; bv=b.rollNo; return ss.dir*(av<bv?-1:av>bv?1:0); }
    if(ss.col==='result') { av=a.result; bv=b.result; return ss.dir*(av<bv?-1:av>bv?1:0); }
    if(ss.col==='total')  { av=tm(a); bv=tm(b); return ss.dir*(av-bv); }
    if(ss.col==='pct')    {
      const aS=a.subjects.filter(x=>x.grade!=='AB').length;
      const bS=b.subjects.filter(x=>x.grade!=='AB').length;
      av=aS?(tm(a)/(aS*100)*100):0; bv=bS?(tm(b)/(bS*100)*100):0;
      return ss.dir*(av-bv);
    }
    const ai=a.subjects.find(x=>x.code===ss.col); const bi=b.subjects.find(x=>x.code===ss.col);
    av=ai&&ai.grade!=='AB'?ai.marks:-1; bv=bi&&bi.grade!=='AB'?bi.marks:-1;
    return ss.dir*(av-bv);
  });

  // store for export
  currentPool[cls] = {pool, subCols};

  // count label
  const total = DB[cls].length;
  const cntEl = document.getElementById('st-cnt-'+cls);
  if(cntEl){
    const isFiltered = pool.length < total;
    cntEl.textContent = isFiltered
      ? `Showing ${pool.length} of ${total} students`
      : `${total} students`;
  }

  function sortBtn(col, label){
    const active = (sortState[cls]||{}).col===col;
    const dir = active ? (sortState[cls].dir===-1?'↓':'↑') : '';
    return `<span style="cursor:pointer;user-select:none;white-space:nowrap" onclick="setSortStudents('${cls}','${col}')">${label}${active?` <span style="color:var(--${cls==='X'?'cx':'cxii'})">${dir}</span>`:'  <span style="opacity:.25">↕</span>'}</span>`;
  }

  const resColors = {PASS:'var(--green)',COMP:'var(--amber)',ABST:'#999',FAIL:'var(--red)'};

  const html = `<table>
    <thead>
      <tr>
        <th style="text-align:center;width:44px">#</th>
        <th>${sortBtn('roll','Roll No')}</th>
        <th>${sortBtn('name','Name')}</th>
        <th style="text-align:center">Gender</th>
        <th style="text-align:center">${sortBtn('result','Result')}</th>
        <th style="text-align:center">${sortBtn('total','Total')}</th>
        <th style="text-align:center">${sortBtn('pct','%')}</th>
        ${subCols.map(sc=>`<th title="${sc.name}" style="text-align:center;min-width:72px;white-space:nowrap">
          <div style="font-size:10px;font-weight:600;letter-spacing:.04em;color:#aaa;margin-bottom:2px">${sc.code}</div>
          <div style="font-size:10px;opacity:.7;margin-bottom:4px;max-width:70px;overflow:hidden;text-overflow:ellipsis">${sc.name.length>10?sc.name.slice(0,9)+'…':sc.name}</div>
          ${sortBtn(sc.code, '↕')}
        </th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${pool.length ? pool.map((s,i)=>{
        const total = tm(s);
        const validSubs = s.subjects.filter(x=>x.grade!=='AB').length;
        const pctVal = validSubs ? ((total/(validSubs*100))*100).toFixed(1) : null;
        const resultBadge = `<span style="font-size:11px;font-weight:700;color:${resColors[s.result]||'#888'}">${s.result}</span>`;
        const compNote = s.compSub ? `<div style="font-size:10px;color:var(--amber);margin-top:2px">Comp: ${s.compSub}</div>` : '';
        return `<tr>
          <td style="text-align:center;font-family:'DM Mono',monospace;font-size:12px;color:#ccc">${i+1}</td>
          <td style="font-family:'DM Mono',monospace;font-size:12px;color:#bbb">${s.rollNo}</td>
          <td><strong>${s.name}</strong></td>
          <td style="text-align:center">${s.gender==='F'?'👩':'👦'}</td>
          <td style="text-align:center">${resultBadge}${compNote}</td>
          <td style="font-family:'DM Mono',monospace;font-size:18px;font-weight:600;text-align:center">${total}</td>
          <td style="font-family:'DM Mono',monospace;font-size:14px;font-weight:700;text-align:center;color:var(--green)">${pctVal !== null ? pctVal+'%' : '&mdash;'}</td>
          ${subCols.map(sc=>{
            const sub = s.subjects.find(x=>x.code===sc.code);
            if(!sub) return `<td style="color:#eee;text-align:center">—</td>`;
            if(sub.grade==='AB') return `<td style="text-align:center;color:#ccc;font-size:11px">AB</td>`;
            return `<td style="text-align:center">
              <div style="font-family:'DM Mono',monospace;font-weight:700">${sub.marks}</div>
              <div><span class="gr g-${sub.grade.toLowerCase()}" style="font-size:10px">${sub.grade}</span></div>
            </td>`;
          }).join('')}
        </tr>`;
      }).join('') : `<tr><td colspan="${7+subCols.length}" style="text-align:center;padding:40px;color:#ccc">No students match the current filters</td></tr>`}
    </tbody>
  </table>`;

  document.getElementById('st-tbl-'+cls).innerHTML = html;
}

function setSortStudents(cls, col){
  const cur = sortState[cls] || {col:'total', dir:-1};
  sortState[cls] = { col, dir: cur.col===col ? -cur.dir : -1 };
  drawStudents(cls);
}

function toggleSubjectTeacherDetail(cls){
  subjectViewState[cls] = {
    ...(subjectViewState[cls] || {}),
    showTeacherDetail: !subjectViewState[cls]?.showTeacherDetail
  };
  renderSubjects(cls);
}

function getPerformanceModeOptions(cls){
  const session = getCurrentSingleSession();
  const componentType = session?.masterData?.performanceMarks?.componentType || null;
  const options = [{value:'total', label:'Total Marks'}];
  if(componentType){
    options.push({value:'theory', label:'Theory Marks'});
    options.push({value:'component', label: componentType === 'practical' ? 'Practical Marks' : 'Internal Marks'});
  }
  return options;
}

function getActivePerformanceMode(cls){
  const options = getPerformanceModeOptions(cls);
  const current = performanceViewState[cls] || 'total';
  if(options.some(option => option.value === current)) return current;
  performanceViewState[cls] = 'total';
  return 'total';
}

function setPerformanceAnalysisMode(cls, mode){
  performanceViewState[cls] = mode;
  if(activeSec === 'subjects') renderSubjects(cls);
  if(activeSec === 'teachers') renderTeacherReview(cls);
}

function getPerformanceModeLabel(cls, mode){
  return (getPerformanceModeOptions(cls).find(option => option.value === mode) || {}).label || 'Total Marks';
}

function getPerformanceMark(subject, mode){
  if(mode === 'theory') return Number.isFinite(subject.theoryMarks) ? subject.theoryMarks : null;
  if(mode === 'component') return Number.isFinite(subject.componentMarks) ? subject.componentMarks : null;
  return Number.isFinite(subject.marks) ? subject.marks : null;
}

function getPerformanceMax(subject, mode){
  if(mode === 'theory') return Number.isFinite(subject.theoryMaxMarks) ? subject.theoryMaxMarks : null;
  if(mode === 'component') return Number.isFinite(subject.componentMaxMarks) ? subject.componentMaxMarks : null;
  return 100;
}

function getPerformancePct(subject, mode){
  const mark = getPerformanceMark(subject, mode);
  const max = getPerformanceMax(subject, mode);
  if(mark === null || !max) return null;
  return (mark / max) * 100;
}

function getPerformanceCompareValue(subject, mode){
  return mode === 'total' ? getPerformanceMark(subject, mode) : getPerformancePct(subject, mode);
}

function isPerformanceMissing(subject, mode){
  return !subjectIsAbsent(subject) && getPerformanceMark(subject, mode) === null;
}

function getPerformanceThreshold(subject, mode){
  if(mode === 'component'){
    // Threshold for internal/practical component
    const max = Number.isFinite(subject.componentMaxMarks) && subject.componentMaxMarks > 0
      ? subject.componentMaxMarks : 100;
    return cbsePassMark(max);
  }
  if(mode === 'theory'){
    // Threshold for derived theory marks
    const max = Number.isFinite(subject.theoryMaxMarks) && subject.theoryMaxMarks > 0
      ? subject.theoryMaxMarks : 100;
    return cbsePassMark(max);
  }
  // Total marks: gazette is always out of 100
  return cbsePassMark(100);
}

function isPerformancePass(subject, mode){
  if(subjectIsAbsent(subject)) return false;
  const value = getPerformanceCompareValue(subject, mode);
  const threshold = getPerformanceThreshold(subject, mode);
  if(value === null || threshold === null) return false;
  return value >= threshold;
}

function isPerformanceDistinction(subject, mode){
  if(subjectIsAbsent(subject)) return false;
  if(mode === 'total'){
    const mark = getPerformanceMark(subject, mode);
    return mark !== null && mark >= 90;
  }
  const pctValue = getPerformancePct(subject, mode);
  return pctValue !== null && pctValue >= 90;
}

function getPerformanceLowLabel(mode){
  // Threshold is floor(33%) of max marks — 33 for /100 papers, 26 for /80, etc.
  return mode === 'total' ? 'Below Pass Mark' : 'Below Pass %';
}

function getPerformanceDistinctionLabel(mode){
  return mode === 'total' ? '90+' : '90%+';
}

function getPerformanceBuckets(mode){
  const labels = mode === 'total'
    ? ['<=40','41-50','51-60','61-70','71-80','81-90','91-94','95-100']
    : ['<=40%','41-50%','51-60%','61-70%','71-80%','81-90%','91-94%','95-100%'];
  return {
    labels,
    getBucket(subject){
      const value = mode === 'total' ? getPerformanceMark(subject, mode) : getPerformancePct(subject, mode);
      if(value === null) return null;
      if(value <= 40) return labels[0];
      if(value <= 50) return labels[1];
      if(value <= 60) return labels[2];
      if(value <= 70) return labels[3];
      if(value <= 80) return labels[4];
      if(value <= 90) return labels[5];
      if(value <= 94) return labels[6];
      return labels[7];
    }
  };
}

function getPerformanceOutOfLabel(maxValues, mode){
  if(mode === 'total') return '100';
  const values = (maxValues || []).filter(value => Number.isFinite(value));
  if(!values.length) return 'NA';
  const unique = [...new Set(values.map(value => Number(value.toFixed(2))))];
  if(unique.length === 1){
    const only = unique[0];
    return Number.isInteger(only) ? String(only) : only.toFixed(2);
  }
  return 'Mixed';
}

function formatPerformanceValue(values, mode, type){
  if(!values.length) return 'NA';
  const numeric = type === 'max'
    ? Math.max(...values)
    : type === 'min'
      ? Math.min(...values)
      : avg(values);
  return mode === 'total'
    ? numeric.toFixed(1).replace(/\.0$/, '')
    : `${numeric.toFixed(1)}%`;
}

function formatPerformanceExtreme(records, type){
  const validRecords = (records || []).filter(record =>
    Number.isFinite(record.mark) &&
    Number.isFinite(record.maxValue) &&
    record.maxValue > 0 &&
    Number.isFinite(record.percentage)
  );
  if(!validRecords.length) return 'NA';

  const percentages = validRecords.map(record => record.percentage);
  const extreme = type === 'min' ? Math.min(...percentages) : Math.max(...percentages);
  const matches = validRecords.filter(record => Math.abs(record.percentage - extreme) < 0.000001);
  const actualMarks = [...new Set(matches.map(record => {
    const mark = Number.isInteger(record.mark) ? String(record.mark) : record.mark.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
    const maxValue = Number.isInteger(record.maxValue) ? String(record.maxValue) : record.maxValue.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
    return `${mark}/${maxValue}`;
  }))];

  return `<div style="white-space:nowrap;font-weight:700">${extreme.toFixed(1)}%</div>
    <div style="white-space:nowrap;font-size:10px;color:#777">Marks: ${actualMarks.join(', ')}</div>
    <div style="white-space:nowrap;font-size:10px;color:#999">Count: ${matches.length}</div>`;
}

function renderPerformanceControls(cls){
  const mode = getActivePerformanceMode(cls);
  const options = getPerformanceModeOptions(cls);
  const session = getCurrentSingleSession();
  const diagnostics = session?.masterData?.diagnostics?.performanceMarks || createEmptyMasterData().diagnostics.performanceMarks;
  const componentLabel = session?.masterData?.performanceMarks?.componentType === 'practical' ? 'Practical' : 'Internal';
  const scopeLabel = diagnostics.scopedClasses?.length ? diagnostics.scopedClasses.join(', ') : 'uploaded classes';
  const helper = options.length === 1
    ? 'Upload an Internal or Practical workbook to unlock theory-based review.'
    : `${componentLabel} rows: ${diagnostics.rows} | Scope: ${scopeLabel} | Uploaded matched: ${diagnostics.matched} | Duplicate upload rows: ${diagnostics.duplicateRows} | Upload unmatched: ${diagnostics.unmatched} | Expected subject rows missing upload: ${diagnostics.missingCoverage} | Derived theory: ${diagnostics.derivedTheory} | Theory max = 100 - uploaded max`;
  return `
    <div class="review-controls">
      <div class="review-field">
        <label>Analysis Mode</label>
        <select class="followup-input small" onchange="setPerformanceAnalysisMode('${cls}', this.value)">
          ${options.map(option => `<option value="${option.value}" ${option.value === mode ? 'selected' : ''}>${option.label}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="review-note">Analysis mode: ${getPerformanceModeLabel(cls, mode)}. ${helper}</div>`;
}

function getSortIndicator(key, col){
  const state = sortState[key];
  if(!state || state.col !== col) return ' <span style="opacity:.25">↕</span>';
  return state.dir === -1 ? ' <span style="color:var(--gold-dk)">↓</span>' : ' <span style="color:var(--gold-dk)">↑</span>';
}

function sortHeader(key, col, label){
  return `<span style="cursor:pointer;user-select:none;white-space:nowrap" onclick="setReviewSort('${key}','${col}')">${label}${getSortIndicator(key, col)}</span>`;
}

function setReviewSort(key, col){
  const cur = sortState[key] || {col, dir:-1};
  sortState[key] = {col, dir: cur.col === col ? -cur.dir : -1};
  if(key.startsWith('section-review-')) renderSectionReview(key.replace('section-review-', ''));
  if(key.startsWith('teacher-review-')) renderTeacherReview(key.replace('teacher-review-', ''));
}

function renderSectionReview(cls){
  const {students, diagnostics} = buildEnrichedStudents(cls);
  const target = document.getElementById('d-sections');
  if(!students.length){
    target.innerHTML = nodata();
    return;
  }

  const groups = {};
  students.forEach(student => {
    const key = student.section || 'UNMAPPED';
    if(!groups[key]) groups[key] = {section:key, classTeacher:student.classTeacher || 'Unmapped', students:[]};
    groups[key].students.push(student);
  });
  let rows = Object.values(groups).map(group => {
    const stats = st(group.students);
    const topper = group.students
      .filter(student => student.result === 'PASS' || student.result === 'COMP')
      .sort((a,b) => tm(b) - tm(a))[0];
    const weakMap = {};
    group.students.forEach(student => {
      student.subjects.forEach(subject => {
        if(subjectIsFail(subject)){
          weakMap[subject.code] = weakMap[subject.code] || {name:subject.name, count:0};
          weakMap[subject.code].count += 1;
        }
      });
    });
    const weakest = Object.values(weakMap).sort((a,b) => b.count - a.count).slice(0,2).map(item => `${item.name} (${item.count})`).join(', ') || 'None';
    return {
      ...group,
      stats,
      avgTotal: avg(group.students.filter(student => student.result === 'PASS').map(student => tm(student))).toFixed(1),
      topper,
      weakest,
    };
  });
  const sortKey = `section-review-${cls}`;
  const sectionSort = sortState[sortKey] || {col:'passPct', dir:-1};
  rows = rows.sort((a,b) => {
    const failA = a.stats.n - a.stats.pass - a.stats.comp - a.stats.abst;
    const failB = b.stats.n - b.stats.pass - b.stats.comp - b.stats.abst;
    const valueA = {
      section: a.section,
      classTeacher: a.classTeacher || '',
      students: a.stats.n,
      passPct: parseFloat(a.stats.pct),
      comp: a.stats.comp,
      fail: failA,
      absent: a.stats.abst,
      avgTotal: parseFloat(a.avgTotal),
      topper: a.topper ? a.topper.name : '',
      weakest: a.weakest,
    }[sectionSort.col];
    const valueB = {
      section: b.section,
      classTeacher: b.classTeacher || '',
      students: b.stats.n,
      passPct: parseFloat(b.stats.pct),
      comp: b.stats.comp,
      fail: failB,
      absent: b.stats.abst,
      avgTotal: parseFloat(b.avgTotal),
      topper: b.topper ? b.topper.name : '',
      weakest: b.weakest,
    }[sectionSort.col];
    if(typeof valueA === 'number' && typeof valueB === 'number') return sectionSort.dir * (valueA - valueB);
    return sectionSort.dir * String(valueA).localeCompare(String(valueB));
  });

  target.innerHTML = `
    <div class="sec-h">
      <div class="sec-title">Section Review - Class ${cls}</div>
      <div class="sec-sub">Board-result review by section and class teacher.</div>
    </div>
    <div class="review-note">
      Student master rows: ${diagnostics.studentMaster.rows} | Matched students: ${diagnostics.studentMaster.matched} | Unmapped students: ${diagnostics.studentMaster.unmapped}
    </div>
    <div class="card">
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>${sortHeader(sortKey,'section','Section')}</th><th>${sortHeader(sortKey,'classTeacher','Class Teacher')}</th><th>${sortHeader(sortKey,'students','Students')}</th><th>${sortHeader(sortKey,'passPct','Pass %')}</th><th>${sortHeader(sortKey,'comp','Comp')}</th><th>${sortHeader(sortKey,'fail','Fail')}</th><th>${sortHeader(sortKey,'absent','Absent')}</th><th>${sortHeader(sortKey,'avgTotal','Avg Total')}</th><th>${sortHeader(sortKey,'topper','Topper')}</th><th>${sortHeader(sortKey,'weakest','Weakest Subjects')}</th></tr></thead>
          <tbody>
            ${rows.map(row => `
              <tr>
                <td><strong>${row.section}</strong></td>
                <td>${row.classTeacher || 'Unmapped'}</td>
                <td>${row.stats.n}</td>
                <td style="font-family:'DM Mono',monospace;font-weight:700;color:var(--green)">${row.stats.pct}%</td>
                <td>${row.stats.comp}</td>
                <td>${row.stats.n - row.stats.pass - row.stats.comp - row.stats.abst}</td>
                <td>${row.stats.abst}</td>
                <td>${row.avgTotal}</td>
                <td>${row.topper ? `${row.topper.name} (${tm(row.topper)})` : 'NA'}</td>
                <td>${row.weakest}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

function renderTeacherReview(cls){
  const {students, diagnostics} = buildEnrichedStudents(cls);
  const target = document.getElementById('d-teachers');
  if(!students.length){
    target.innerHTML = nodata();
    return;
  }
  const mode = getActivePerformanceMode(cls);
  const modeLabel = getPerformanceModeLabel(cls, mode);
  const avgHeader = mode === 'total' ? 'Avg' : 'Avg %';
  const schoolAvgHeader = mode === 'total' ? 'School Avg' : 'School Avg %';
  const varianceHeader = mode === 'total' ? 'Variance' : 'Variance pp';

  const groups = {};
  students.forEach(student => {
    student.subjects.forEach(subject => {
      const key = `${subject.teacherName}|${subject.code}|${student.section}`;
      if(!groups[key]){
        groups[key] = {
          teacherName: subject.teacherName,
          department: subject.department || '',
          subjectCode: subject.code,
          subjectName: subject.mappedSubjectName || subject.name,
          section: student.section,
          totalStudents: 0,
          marks: [],
          compareValues: [],
          maxValues: [],
          passCount: 0,
          absentCount: 0,
          distinctionCount: 0,
          lowCount: 0,
          missingCount: 0,
        };
      }
      const group = groups[key];
      group.totalStudents += 1;
      if(subject.grade === 'AB') group.absentCount += 1;
      else {
        const mark = getPerformanceMark(subject, mode);
        const compareValue = getPerformanceCompareValue(subject, mode);
        const maxValue = getPerformanceMax(subject, mode);
        if(mark === null){
          group.missingCount += 1;
          return;
        }
        group.marks.push(mark);
        if(compareValue !== null) group.compareValues.push(compareValue);
        if(maxValue !== null) group.maxValues.push(maxValue);
        if(isPerformancePass(subject, mode)) group.passCount += 1;
        if(isPerformanceDistinction(subject, mode)) group.distinctionCount += 1;
        if(!isPerformancePass(subject, mode)) group.lowCount += 1;
      }
    });
  });

  const schoolSubjectAverages = {};
  students.forEach(student => {
    student.subjects.forEach(subject => {
      schoolSubjectAverages[subject.code] = schoolSubjectAverages[subject.code] || [];
      const compareValue = getPerformanceCompareValue(subject, mode);
      if(subject.grade !== 'AB' && compareValue !== null) schoolSubjectAverages[subject.code].push(compareValue);
    });
  });

  let rows = Object.values(groups).map(group => {
    const taught = group.compareValues.length;
    const schoolAvg = avg(schoolSubjectAverages[group.subjectCode] || []);
    const teacherAvg = avg(group.compareValues);
    return {
      ...group,
      taught,
      passPct: taught ? ((group.passCount / taught) * 100).toFixed(1) : '0.0',
      avgMarks: teacherAvg.toFixed(1),
      schoolAvg: schoolAvg.toFixed(1),
      variance: (teacherAvg - schoolAvg).toFixed(1),
      outOf: getPerformanceOutOfLabel(group.maxValues, mode),
    };
  });
  const sortKey = `teacher-review-${cls}`;
  const teacherSort = sortState[sortKey] || {col:'passPct', dir:-1};
  rows = rows.sort((a,b) => {
    const valueA = {
      teacherName: a.teacherName,
      department: a.department || '',
      subjectName: a.subjectName,
      section: a.section,
      taught: a.taught,
      passPct: parseFloat(a.passPct),
      avgMarks: parseFloat(a.avgMarks),
      schoolAvg: parseFloat(a.schoolAvg),
      variance: parseFloat(a.variance),
      distinctionCount: a.distinctionCount,
      lowCount: a.lowCount,
      missingCount: a.missingCount,
      absentCount: a.absentCount,
    }[teacherSort.col];
    const valueB = {
      teacherName: b.teacherName,
      department: b.department || '',
      subjectName: b.subjectName,
      section: b.section,
      taught: b.taught,
      passPct: parseFloat(b.passPct),
      avgMarks: parseFloat(b.avgMarks),
      schoolAvg: parseFloat(b.schoolAvg),
      variance: parseFloat(b.variance),
      distinctionCount: b.distinctionCount,
      lowCount: b.lowCount,
      missingCount: b.missingCount,
      absentCount: b.absentCount,
    }[teacherSort.col];
    if(typeof valueA === 'number' && typeof valueB === 'number') return teacherSort.dir * (valueA - valueB);
    return teacherSort.dir * String(valueA).localeCompare(String(valueB));
  });

  target.innerHTML = `
    <div class="sec-h">
      <div class="sec-title">Teacher Review - Class ${cls}</div>
      <div class="sec-sub">Same-class board-result review by mapped subject teacher and section.</div>
    </div>
    ${renderPerformanceControls(cls)}
    <div class="review-note">
      Teacher mapping rows: ${diagnostics.teacherMappings.rows} | Mapped subject rows: ${diagnostics.teacherMappings.matched} | Unmapped subject rows: ${diagnostics.teacherMappings.unmapped} | View: ${modeLabel}
    </div>
    <div class="card">
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>${sortHeader(sortKey,'teacherName','Teacher')}</th><th>${sortHeader(sortKey,'department','Department')}</th><th>${sortHeader(sortKey,'subjectName','Subject')}</th><th>${sortHeader(sortKey,'section','Section')}</th><th>${sortHeader(sortKey,'taught','Taught')}</th><th>${sortHeader(sortKey,'passPct','Threshold %')}</th><th>Out Of</th><th>${sortHeader(sortKey,'avgMarks',avgHeader)}</th><th>${sortHeader(sortKey,'schoolAvg',schoolAvgHeader)}</th><th>${sortHeader(sortKey,'variance',varianceHeader)}</th><th>${sortHeader(sortKey,'distinctionCount',getPerformanceDistinctionLabel(mode))}</th><th>${sortHeader(sortKey,'lowCount',getPerformanceLowLabel(mode))}</th><th>${sortHeader(sortKey,'missingCount','NA')}</th><th>${sortHeader(sortKey,'absentCount','Absent')}</th></tr></thead>
          <tbody>
            ${rows.map(row => `
              <tr>
                <td><strong>${row.teacherName}</strong></td>
                <td>${row.department || 'NA'}</td>
                <td>${row.subjectName}<div style="font-size:11px;color:#999">${row.subjectCode}</div></td>
                <td>${row.section}</td>
                <td>${row.taught}</td>
                <td style="font-family:'DM Mono',monospace;font-weight:700;color:var(--green)">${row.passPct}%</td>
                <td style="font-family:'DM Mono',monospace">${row.outOf}</td>
                <td>${mode === 'total' ? row.avgMarks : `${row.avgMarks}%`}</td>
                <td>${mode === 'total' ? row.schoolAvg : `${row.schoolAvg}%`}</td>
                <td style="font-family:'DM Mono',monospace">${row.variance}</td>
                <td>${row.distinctionCount}</td>
                <td>${row.lowCount}</td>
                <td>${row.missingCount}</td>
                <td>${row.absentCount}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

function renderFollowUp(cls){
  const {students} = buildEnrichedStudents(cls);
  const target = document.getElementById('d-followup');
  if(!students.length){
    target.innerHTML = nodata();
    return;
  }

  const session = getCurrentSingleSession();
  const followUps = session?.masterData?.followUps || {};
  const rows = students.map(student => {
    const followUp = getFollowUpCategories(student);
    const key = `${student.cls}|${student.rollNo}`;
    return {
      ...student,
      followUp,
      saved: followUps[key] || {},
    };
  }).filter(row => row.followUp.categories.length).sort((a,b) => {
    const weight = student => student.result === 'COMP' ? 3 : student.result === 'FAIL' ? 2 : student.result === 'ABST' ? 1 : 0;
    return weight(b) - weight(a) || a.name.localeCompare(b.name);
  });

  target.innerHTML = `
    <div class="sec-h">
      <div class="sec-title">Follow-Up & Action - Class ${cls}</div>
      <div class="sec-sub">Post-result review for compartment, fail, absent, and borderline cases.</div>
    </div>
    <div class="review-note">
      This is a board-result follow-up tracker for parent meetings, supplementary preparation, and next-session planning.
    </div>
    <div class="card">
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>Name</th><th>Roll No</th><th>Section</th><th>Result</th><th>Categories</th><th>Weak Subjects</th><th>Status</th><th>Owner</th><th>Remarks</th></tr></thead>
          <tbody>
            ${rows.length ? rows.map(row => `
              <tr>
                <td><strong>${row.name}</strong><div style="font-size:11px;color:#999">${row.classTeacher || 'Unmapped class teacher'}</div></td>
                <td style="font-family:'DM Mono',monospace">${row.rollNo}</td>
                <td>${row.section || 'UNMAPPED'}</td>
                <td>${row.result}</td>
                <td>${row.followUp.categories.map(item => `<span class="followup-tag">${item}</span>`).join('')}</td>
                <td>${row.followUp.weakSubjects.length ? row.followUp.weakSubjects.map(subject => `${subject.code} (${subject.grade === 'AB' ? 'AB' : subject.marks})`).join(', ') : 'NA'}</td>
                <td>
                  <select class="sselect" onchange="updateFollowUpRecord('${row.cls}','${row.rollNo}','status',this.value)">
                    <option value="">Pending</option>
                    <option value="Reviewed" ${row.saved.status==='Reviewed'?'selected':''}>Reviewed</option>
                    <option value="Parent Meeting Done" ${row.saved.status==='Parent Meeting Done'?'selected':''}>Parent Meeting Done</option>
                    <option value="Supplementary Prep Started" ${row.saved.status==='Supplementary Prep Started'?'selected':''}>Supplementary Prep Started</option>
                    <option value="Closed" ${row.saved.status==='Closed'?'selected':''}>Closed</option>
                  </select>
                </td>
                <td><input class="followup-input small" type="text" value="${escapeAttr(row.saved.owner || '')}" placeholder="Owner" onchange="updateFollowUpRecord('${row.cls}','${row.rollNo}','owner',this.value)"></td>
                <td><input class="followup-input" type="text" value="${escapeAttr(row.saved.remarks || '')}" placeholder="Remarks" onchange="updateFollowUpRecord('${row.cls}','${row.rollNo}','remarks',this.value)"></td>
              </tr>
            `).join('') : '<tr><td colspan="9" style="text-align:center;padding:32px;color:#ccc">No follow-up students found for this class.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
}

/* ══════════════════════════════════════════════════════════════
   EXPORT CURRENT VIEW  —  exports the filtered+sorted table
   as it appears on screen right now
══════════════════════════════════════════════════════════════ */
function exportCurrentView(cls){
  if(!window.XLSX){ alert('Excel library not loaded yet — please wait a moment and try again.'); return; }
  if(!DB[cls] || !DB[cls].length){ alert('No data to export.'); return; }

  // Use the currently filtered+sorted pool (exactly what's on screen)
  const poolData = currentPool[cls];
  const exportPool = poolData ? poolData.pool : DB[cls];
  const subCols    = poolData ? poolData.subCols : (()=>{
    const seen=new Set(), cols=[];
    DB[cls].forEach(s=>s.subjects.forEach(sub=>{if(!seen.has(sub.code)){seen.add(sub.code);cols.push({code:sub.code,name:sub.name});}}));
    return cols;
  })();

  if(!exportPool.length){ alert('No students match the current filter — nothing to export.'); return; }

  const meta    = parseMeta(raw[cls] || '');
  const GOLD    = 'FFC9A84C', TEAL='FF0E7490', DARK='FF1A1A2E';
  const PASS_C  = 'FF1A7A4A', FAIL_C='FFC0392B', ABST_C='FF888888', COMP_C='FFD4800A';
  const RC = r  => r==='PASS'?PASS_C:r==='COMP'?COMP_C:r==='ABST'?ABST_C:FAIL_C;
  const H  = bg => ({
    font:{bold:true,color:{rgb:'FFFFFFFF'}}, fill:{fgColor:{rgb:bg}},
    alignment:{horizontal:'center',vertical:'center',wrapText:true}
  });

  // Assign rank only to PASS students within the current pool (in their current order)
  let rankCounter = 0;
  const ranks = exportPool.map(s => s.result==='PASS' ? ++rankCounter : '');

  // ── headers ──
  const fixHdrs = ['Rank','Roll No','Name','Gender','Result','Comp Subject','Total Marks','%'];
  const subHdrs = subCols.flatMap(s => [`${s.name} (${s.code})`, 'Grade']);
  const headers = [...fixHdrs, ...subHdrs];

  // ── data rows ──
  const rows = exportPool.map((s, i) => {
    const total = tm(s);
    const validSubs = s.subjects.filter(x=>x.grade!=='AB').length;
    const pctStr = validSubs ? ((total/(validSubs*100))*100).toFixed(1)+'%' : '';
    const fix = [
      ranks[i],
      s.rollNo,
      s.name,
      s.gender==='F' ? 'Female' : 'Male',
      s.result,
      s.compSub || '',
      total,
      pctStr
    ];
    const sdata = subCols.flatMap(sc => {
      const f = s.subjects.find(x => x.code===sc.code);
      return f ? [f.grade==='AB' ? 'AB' : f.marks, f.grade] : ['', ''];
    });
    return [...fix, ...sdata];
  });

  // ── worksheet ──
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  ws['!cols'] = [
    {wch:6}, {wch:12}, {wch:28}, {wch:9}, {wch:10}, {wch:22}, {wch:13}, {wch:8},
    ...subCols.flatMap(() => [{wch:24}, {wch:8}])
  ];

  // ── header styles ──
  const hdrBg = cls==='X' ? GOLD : TEAL;
  headers.forEach((_, ci) => {
    const a = XLSX.utils.encode_cell({r:0, c:ci});
    if(ws[a]) ws[a].s = H(ci < fixHdrs.length ? DARK : hdrBg);
  });

  // ── data row styles ──
  const MEDAL = ['FFC9A84C','FFCCCCCC','FFCD7F32'];
  rows.forEach((row, ri) => {
    const res  = row[4];
    const rc   = RC(res);
    const rank = row[0];
    const rIdx = ri + 1;
    const medal = typeof rank==='number' && rank<=3 ? MEDAL[rank-1] : null;

    headers.forEach((_, ci) => {
      const a = XLSX.utils.encode_cell({r:rIdx, c:ci});
      if(!ws[a]) return;
      if(medal){
        const base = {fill:{fgColor:{rgb:medal}}, font:{bold:rank===1, color:{rgb:DARK}}};
        ws[a].s = {...base, alignment:{horizontal: ci===0||ci===6||ci===7 ? 'center':'left'}};
        return;
      }
      if(ci===0)  ws[a].s = {alignment:{horizontal:'center'}, font:{color:{rgb:'FFBBBBBB'}}};
      else if(ci===1) ws[a].s = {font:{color:{rgb:'FFAAAAAA'}}, alignment:{horizontal:'center'}};
      else if(ci===2) ws[a].s = {font:{bold:true}};
      else if(ci===3) ws[a].s = {alignment:{horizontal:'center'}};
      else if(ci===4) ws[a].s = {font:{bold:true, color:{rgb:rc}}, alignment:{horizontal:'center'}};
      else if(ci===5 && row[5]) ws[a].s = {font:{color:{rgb:COMP_C}, italic:true}};
      else if(ci===6) ws[a].s = {font:{bold:true}, alignment:{horizontal:'center'}};
      else if(ci===7) ws[a].s = {font:{bold:true, color:{rgb:'FF1A7A4A'}}, alignment:{horizontal:'center'}};
      else if(ci>=8 && ci%2===0) ws[a].s = {font:{bold:true}, alignment:{horizontal:'center'}};
      else if(ci>=8 && ci%2===1) ws[a].s = {font:{color:{rgb:rc}}, alignment:{horizontal:'center'}};
    });
  });

  // ── download ──
  const school = (meta.school||'CBSE').replace(/\s+/g,'_').substring(0,22);
  const isFiltered = exportPool.length < DB[cls].length;
  XLSX.utils.book_append_sheet(wb, ws, `Class ${cls}`);
  XLSX.writeFile(wb, `CBSE_Class${cls}_${isFiltered?'Filtered_':''}${school}_${meta.year||''}.xlsx`);
}

function exportMultischoolWorkbook(){
  if(!window.XLSX){
    alert('Excel library not loaded yet - please wait a moment and try again.');
    return;
  }

  const sessions = getComparisonSessions();
  if(!sessions.length){
    alert('No schools are selected for multischool export.');
    return;
  }

  const wb = XLSX.utils.book_new();
  const summaryRows = [[
    'School Name','School Code','Year','Scope','Students','Pass','Compartment','Absent','Fail','Pass %','Average Total','Topper','Topper Score %'
  ]];

  const subjectMap = new Map();
  sessions.forEach(session => {
    const students = getStudentsForScope(session, workspaceState.classScope);
    if(!students.length) return;
    const stats = st(students);
    const fail = stats.n - stats.pass - stats.comp - stats.abst;
    const avgTotal = avg(students.filter(student => student.result === 'PASS').map(student => tm(student)));
    const topper = getScopedTopper(session, workspaceState.classScope);
    summaryRows.push([
      session.schoolName,
      session.schoolCode,
      session.year,
      workspaceState.classScope === 'all' ? 'All Classes' : `Class ${workspaceState.classScope}`,
      stats.n,
      stats.pass,
      stats.comp,
      stats.abst,
      fail,
      Number(stats.pct),
      Number(avgTotal.toFixed(1)),
      topper ? topper.name : '',
      topper ? Number(topper._pct.toFixed(2)) : ''
    ]);

    students.forEach(student => {
      student.subjects.forEach(subject => {
        const key = `${subject.code}|${subject.name}`;
        if(!subjectMap.has(key)) subjectMap.set(key, []);
        subjectMap.get(key).push({session, subject});
      });
    });
  });

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet['!cols'] = [
    {wch:28},{wch:14},{wch:8},{wch:14},{wch:10},{wch:10},{wch:14},{wch:10},{wch:8},{wch:10},{wch:12},{wch:24},{wch:14}
  ];
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Comparison');

  const subjectRows = [['Subject','Code', ...sessions.map(session => `${session.schoolCode} (${session.year})`)]];
  [...subjectMap.entries()]
    .sort((a,b) => a[0].localeCompare(b[0]))
    .forEach(([key]) => {
      const [code, name] = key.split('|');
      const cells = sessions.map(session => {
        const students = getStudentsForScope(session, workspaceState.classScope);
        const marks = students.flatMap(student =>
          student.subjects
            .filter(subject => subject.code === code && subject.grade !== 'AB')
            .map(subject => subject.marks)
        );
        return marks.length ? Number(avg(marks).toFixed(1)) : 'NA';
      });
      subjectRows.push([name, code, ...cells]);
    });
  const subjectSheet = XLSX.utils.aoa_to_sheet(subjectRows);
  subjectSheet['!cols'] = [{wch:30},{wch:10}, ...sessions.map(() => ({wch:16}))];
  XLSX.utils.book_append_sheet(wb, subjectSheet, 'Subject Averages');

  if(currentCombinedMerit && currentCombinedMerit.pool && currentCombinedMerit.pool.length){
    const meritRows = [[
      'Rank','Name','School Name','School Code','Year','Class','Roll No','Gender','Result','Score %','Used Subjects','Subject Marks'
    ]];
    currentCombinedMerit.pool.forEach(student => {
      meritRows.push([
        student._rank,
        student.name,
        student.schoolName,
        student.schoolCode,
        student.year,
        student.cls,
        student.rollNo,
        student.gender === 'F' ? 'Female' : 'Male',
        student.result,
        Number(student._pct.toFixed(2)),
        (student._used || []).join(', '),
        student.subjects.map(subject => `${subject.code}:${subject.grade === 'AB' ? 'AB' : subject.marks}`).join(' | ')
      ]);
    });
    const meritSheet = XLSX.utils.aoa_to_sheet(meritRows);
    meritSheet['!cols'] = [
      {wch:8},{wch:28},{wch:28},{wch:14},{wch:8},{wch:8},{wch:14},{wch:10},{wch:10},{wch:10},{wch:18},{wch:48}
    ];
    XLSX.utils.book_append_sheet(wb, meritSheet, 'Combined Merit');
  }

  const comboName = workspaceState.activeCombinationId
    ? (savedCombinations.find(combo => combo.id === workspaceState.activeCombinationId)?.name || 'Combination')
    : 'Workspace';
  XLSX.writeFile(
    wb,
    `CBSE_Multischool_${comboName.replace(/\s+/g, '_')}_${workspaceState.classScope}_${workspaceState.comparisonYear}.xlsx`
  );
}

function exportExcel(){
  if(!Store.hasFeature('excel_export')){
    alert('Excel export is a premium feature. Please contact the administrator.');
    return;
  }
  if(isMultiMode()){
    exportMultischoolWorkbook();
    return;
  }
  const meta = parseMeta(raw.X || raw.XII || '');
  const wb   = XLSX.utils.book_new();

  /* ─── shared constants ─── */
  const GRADES = ['A1','A2','B1','B2','C1','C2','D1','D2','E'];
  const GOLD='FFC9A84C', TEAL='FF0E7490', DARK='FF1A1A2E';
  const LGOLD='FFFFF8E8', LTEAL='FFE0F4F8', LGREY='FFF5F0E8';
  const PASS_C='FF1A7A4A', FAIL_C='FFC0392B', ABST_C='FF888888', COMP_C='FFD4800A';
  const GREEN_FILL='FFD6F0E0', AMBER_FILL='FFFFF0D6', RED_FILL='FFFCE8E8', BLUE_FILL='FFE8F0FA';

  /* ─── style helpers ─── */
  const H  = (bg,fg='FFFFFFFF') => ({
    font:{bold:true,color:{rgb:fg}}, fill:{fgColor:{rgb:bg}},
    alignment:{horizontal:'center',vertical:'center',wrapText:true},
    border:{bottom:{style:'medium',color:{rgb:'FFCCCCCC'}}}
  });
  const SH = (bg,fg=DARK) => ({         // section heading style
    font:{bold:true,sz:12,color:{rgb:fg}}, fill:{fgColor:{rgb:bg}},
    alignment:{horizontal:'left',vertical:'center'}
  });
  const C  = (bold=false,center=false) => ({
    font:{bold}, alignment:{horizontal:center?'center':'left',vertical:'center'}
  });
  const RC = r => r==='PASS'?PASS_C:r==='COMP'?COMP_C:r==='ABST'?ABST_C:FAIL_C;
  const PC = p => p>=90?PASS_C:p>=75?'FF1A7A8A':p>=50?COMP_C:FAIL_C;

  /* ─── data helpers ─── */
  const xavg  = arr => arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length*10)/10 : 0;
  const xpct  = (n,d) => d ? Math.round(n/d*1000)/10 : 0;
  const xtm   = s => s.subjects.filter(x=>x.grade!=='AB').reduce((a,b)=>a+b.marks,0);
  const xst   = arr => {
    const pass=arr.filter(s=>s.result==='PASS').length;
    const comp=arr.filter(s=>s.result==='COMP').length;
    const abst=arr.filter(s=>s.result==='ABST').length;
    const fail=arr.filter(s=>s.result==='FAIL').length;
    return {n:arr.length, pass, comp, abst, fail, pct:xpct(pass,arr.length)};
  };
  const buildSubMap = sts => {
    const sm={};
    sts.forEach(s=>s.subjects.forEach(sub=>{
      if(!sm[sub.code]) sm[sub.code]={code:sub.code,name:sub.name,
        marks:[],marksB:[],marksG:[],pass:0,passB:0,passG:0,n:0,nB:0,nG:0,grades:{}};
      const e=sm[sub.code];
      if(!subjectIsAbsent(sub)){
        e.marks.push(sub.marks); e.n++;
        e.grades[sub.grade]=(e.grades[sub.grade]||0)+1;
        if(subjectIsPass(sub)) e.pass++;
        if(s.gender==='M'){e.marksB.push(sub.marks);e.nB++;if(subjectIsPass(sub))e.passB++;}
        else              {e.marksG.push(sub.marks);e.nG++;if(subjectIsPass(sub))e.passG++;}
      }
    }));
    return Object.values(sm).filter(s=>s.marks.length>0).sort((a,b)=>xavg(b.marks)-xavg(a.marks));
  };
  const getSubjectCols = sts => {
    const seen=new Map();
    sts.forEach(s=>s.subjects.forEach(sub=>{if(!seen.has(sub.code))seen.set(sub.code,sub.name);}));
    return [...seen.entries()].map(([code,name])=>({code,name}));
  };

  /* ─── write helpers ─── */
  function styleRange(ws, r0, c0, r1, c1, styleFn){
    for(let r=r0;r<=r1;r++) for(let c=c0;c<=c1;c++){
      const a=XLSX.utils.encode_cell({r,c});
      if(ws[a]) ws[a].s=styleFn(r-r0,c-c0,ws[a].v);
    }
  }
  function addSection(data, title, bg){
    // Returns rows: one blank separator, one bold title row, then data rows
    return [[], [title,...Array(data[0]?.length-1||0).fill('')], ...data];
  }

  /* ════════════════════════════════════════════════════════
     SHEET 1 — SUMMARY  (mirrors Summary tab)
  ════════════════════════════════════════════════════════ */
  {
    const rows=[];
    // ── title block ──
    rows.push(['CBSE RESULT SUMMARY — '+meta.year]);
    rows.push([`School: ${meta.school||'—'}   |   Code: ${meta.code||'—'}   |   Region: ${meta.region||'—'}`]);
    rows.push([]);

    // ── overall results ──
    rows.push(['OVERALL RESULT','Total','Pass','Compartment','Absent','Fail','Pass %']);
    ['X','XII'].forEach(cls=>{
      const s=xst(DB[cls]); if(!s.n) return;
      rows.push([`Class ${cls}`,s.n,s.pass,s.comp,s.abst,s.fail,s.pct+'%']);
    });
    if(DB.X.length && DB.XII.length){
      const all=[...DB.X,...DB.XII], s=xst(all);
      rows.push(['Combined',s.n,s.pass,s.comp,s.abst,s.fail,s.pct+'%']);
    }
    rows.push([]);

    // ── gender summary ──
    rows.push(['GENDER SUMMARY','Total','Pass','Compartment','Absent','Pass %']);
    ['X','XII'].forEach(cls=>{
      const sts=DB[cls]; if(!sts.length) return;
      const boys=sts.filter(s=>s.gender==='M'), girls=sts.filter(s=>s.gender==='F');
      const sb=xst(boys), sg=xst(girls);
      rows.push([`Class ${cls} — Boys`, sb.n, sb.pass, sb.comp, sb.abst, sb.pct+'%']);
      rows.push([`Class ${cls} — Girls`,sg.n, sg.pass, sg.comp, sg.abst, sg.pct+'%']);
    });
    rows.push([]);

    // ── grade distribution ──
    rows.push(['GRADE DISTRIBUTION (all subjects combined)', ...GRADES]);
    ['X','XII'].forEach(cls=>{
      const sts=DB[cls]; if(!sts.length) return;
      const gc={}; GRADES.forEach(g=>gc[g]=0);
      sts.forEach(x=>x.subjects.forEach(s=>{if(gc[s.grade]!==undefined)gc[s.grade]++;}));
      rows.push([`Class ${cls}`, ...GRADES.map(g=>gc[g])]);
    });
    rows.push([]);

    // ── subject-wise result (mirrors Summary tab table) ──
    rows.push(['SUBJECT-WISE RESULT BREAKDOWN','Code','Students','Pass','Failed/Fail in Sub','Absent','Pass %']);
    ['X','XII'].forEach(cls=>{
      const sts=DB[cls]; if(!sts.length) return;
      rows.push([`— Class ${cls} —`]);
      const subjectRows={};
      sts.forEach(x=>x.subjects.forEach(sub=>{
        if(!subjectRows[sub.code]) subjectRows[sub.code]={name:sub.name,code:sub.code,total:0,pass:0,comp:0,abst:0};
        const r=subjectRows[sub.code]; r.total++;
        if(subjectIsAbsent(sub)) r.abst++;
        else if(subjectIsFail(sub)) r.comp++;
        else r.pass++;
      }));
      Object.values(subjectRows).sort((a,b)=>b.total-a.total).forEach(r=>{
        const pp=r.total?xpct(r.pass,r.total):0;
        rows.push([r.name, r.code, r.total, r.pass, r.comp, r.abst, pp+'%']);
      });
    });

    const ws=XLSX.utils.aoa_to_sheet(rows);
    ws['!cols']=[{wch:38},{wch:10},{wch:10},{wch:10},{wch:20},{wch:10},{wch:10}];

    // styles
    const secHdrRows=[];
    rows.forEach((r,i)=>{
      if(typeof r[0]==='string' && r[0]===r[0].toUpperCase() && r[0].length>3 && r[1]!==undefined && r[1]!=='')
        secHdrRows.push(i);
    });
    // title
    const t0=XLSX.utils.encode_cell({r:0,c:0});
    if(ws[t0]) ws[t0].s={font:{bold:true,sz:14},fill:{fgColor:{rgb:LGOLD}},alignment:{horizontal:'left'}};
    const t1=XLSX.utils.encode_cell({r:1,c:0});
    if(ws[t1]) ws[t1].s={font:{italic:true,sz:10,color:{rgb:'FF888888'}}};
    // section headers
    rows.forEach((row,ri)=>{
      if(!Array.isArray(row)||!row[0]) return;
      const v=String(row[0]);
      const isSecHdr = v===v.toUpperCase()&&v.length>4&&row.length>1&&row[1]!==undefined&&row[1]!=='';
      const isClsHdr = v.startsWith('— Class');
      if(isSecHdr){
        row.forEach((_,ci)=>{
          const a=XLSX.utils.encode_cell({r:ri,c:ci});
          if(ws[a]) ws[a].s=H(DARK);
        });
      } else if(isClsHdr){
        const a=XLSX.utils.encode_cell({r:ri,c:0});
        if(ws[a]) ws[a].s=SH(LGREY);
      } else if(ri>2 && row[1]!==undefined && row[1]!==''){
        // data rows — colour pass% column
        const pCol=row.length-1;
        const pp=parseFloat(row[pCol]);
        if(!isNaN(pp)){
          const a=XLSX.utils.encode_cell({r:ri,c:pCol});
          if(ws[a]) ws[a].s={font:{bold:true,color:{rgb:PC(pp)}},alignment:{horizontal:'center'}};
        }
        // centre numeric cols
        for(let c=1;c<row.length-1;c++){
          const a=XLSX.utils.encode_cell({r:ri,c});
          if(ws[a]&&typeof ws[a].v==='number') ws[a].s={alignment:{horizontal:'center'}};
        }
      }
    });

    XLSX.utils.book_append_sheet(wb, ws, 'Summary');
  }

  /* ════════════════════════════════════════════════════════
     SHEET 2 — SUBJECT ANALYSIS  (mirrors Subjects tab)
  ════════════════════════════════════════════════════════ */
  ['X','XII'].forEach(cls=>{
    const sts=DB[cls]; if(!sts.length) return;
    const subs=buildSubMap(sts);
    const hdrs=['Subject','Code','Appeared','Pass','Fail','Pass %',
                'Avg Marks','Highest','Lowest',...GRADES.map(g=>`Grade ${g}`)];
    const rows=subs.map(s=>[
      s.name, s.code, s.n, s.pass, s.n-s.pass,
      xpct(s.pass,s.n)+'%',
      xavg(s.marks), Math.max(...s.marks), Math.min(...s.marks),
      ...GRADES.map(g=>s.grades[g]||0)
    ]);
    const ws=XLSX.utils.aoa_to_sheet([hdrs,...rows]);
    ws['!cols']=[{wch:30},{wch:7},{wch:10},{wch:8},{wch:8},{wch:9},{wch:11},{wch:10},{wch:9},
                 ...GRADES.map(()=>({wch:9}))];
    hdrs.forEach((_,ci)=>{const a=XLSX.utils.encode_cell({r:0,c:ci});if(ws[a])ws[a].s=H(cls==='X'?GOLD:TEAL);});
    rows.forEach((row,ri)=>{
      const pp=parseFloat(row[5]);
      // pass% cell
      const pa=XLSX.utils.encode_cell({r:ri+1,c:5});
      if(ws[pa]) ws[pa].s={font:{bold:true,color:{rgb:PC(pp)}},alignment:{horizontal:'center'}};
      // centre all numeric
      [2,3,4,6,7,8,...GRADES.map((_,i)=>9+i)].forEach(ci=>{
        const a=XLSX.utils.encode_cell({r:ri+1,c:ci});
        if(ws[a]) ws[a].s={alignment:{horizontal:'center'}};
      });
    });
    XLSX.utils.book_append_sheet(wb, ws, `Cl ${cls} Subjects`);
  });

  /* ════════════════════════════════════════════════════════
     SHEET 3 — MERIT LIST  (mirrors Merit tab — ALL pass students)
  ════════════════════════════════════════════════════════ */
  ['X','XII'].forEach(cls=>{
    const sts=DB[cls]; if(!sts.length) return;
    const subCols=getSubjectCols(sts.filter(s=>s.result==='PASS'));
    const passed=sts.filter(s=>s.result==='PASS')
      .map(s=>({...s,total:xtm(s)}))
      .sort((a,b)=>b.total-a.total);

    const fixHdrs=['Rank','Roll No','Name','Gender','Total Marks'];
    const subHdrs=subCols.flatMap(s=>[s.name+' (Marks)',s.name+' (Grade)']);
    const hdrs=[...fixHdrs,...subHdrs];

    const rows=passed.map((s,i)=>{
      const fix=[i+1, s.rollNo, s.name, s.gender==='F'?'Female':'Male', s.total];
      const sdata=subCols.flatMap(sc=>{
        const f=s.subjects.find(x=>x.code===sc.code);
        return f?[f.grade==='AB'?'AB':f.marks, f.grade]:['',''];
      });
      return [...fix,...sdata];
    });

    const ws=XLSX.utils.aoa_to_sheet([hdrs,...rows]);
    ws['!cols']=[{wch:6},{wch:12},{wch:28},{wch:9},{wch:13},...subCols.flatMap(()=>[{wch:20},{wch:9}])];
    // header
    hdrs.forEach((_,ci)=>{
      const a=XLSX.utils.encode_cell({r:0,c:ci});
      if(ws[a]) ws[a].s=H(ci<5?DARK:(cls==='X'?GOLD:TEAL));
    });
    // medals for top 3
    const medals=[{fill:'FFC9A84C',ink:DARK},{fill:'FFCCCCCC',ink:'FF444444'},{fill:'FFCD7F32',ink:'FF444444'}];
    rows.forEach((row,ri)=>{
      const medal=medals[ri];
      hdrs.forEach((_,ci)=>{
        const a=XLSX.utils.encode_cell({r:ri+1,c:ci});
        if(!ws[a]) return;
        if(medal) ws[a].s={fill:{fgColor:{rgb:medal.fill}},font:{bold:ri===0,color:{rgb:medal.ink}},
                            alignment:{horizontal:ci===0||ci===4?'center':'left'}};
        else if(ci===0||ci===4) ws[a].s={alignment:{horizontal:'center'},font:{bold:ci===4}};
        else if(ci>=5&&ci%2===1) ws[a].s={alignment:{horizontal:'center'}};
      });
    });
    XLSX.utils.book_append_sheet(wb, ws, `Cl ${cls} Merit`);
  });

  /* ════════════════════════════════════════════════════════
     SHEET 4 — GENDER ANALYSIS  (mirrors Gender tab)
  ════════════════════════════════════════════════════════ */
  ['X','XII'].forEach(cls=>{
    const sts=DB[cls]; if(!sts.length) return;
    const boys=sts.filter(s=>s.gender==='M'), girls=sts.filter(s=>s.gender==='F');
    const sb=xst(boys), sg=xst(girls);
    const subs=buildSubMap(sts);
    const rows=[];

    // overall comparison
    rows.push([`GENDER ANALYSIS — CLASS ${cls}`]);
    rows.push([]);
    rows.push(['','Boys','Girls']);
    rows.push(['Total Students',     sb.n,                sg.n]);
    rows.push(['Passed',             sb.pass,             sg.pass]);
    rows.push(['Compartment',        sb.comp,             sg.comp]);
    rows.push(['Absent',             sb.abst,             sg.abst]);
    rows.push(['Pass %',             sb.pct+'%',          sg.pct+'%']);
    rows.push(['Avg Total Marks',
      xavg(boys.filter(s=>s.result==='PASS').map(s=>xtm(s))),
      xavg(girls.filter(s=>s.result==='PASS').map(s=>xtm(s)))
    ]);
    rows.push([]);

    // grade distribution by gender
    rows.push(['GRADE DISTRIBUTION','Boys',...Array(GRADES.length-1).fill(''),'Girls']);
    rows.push(['Grade',...GRADES,'','Grade',...GRADES]);
    const gcB={},gcG={}; GRADES.forEach(g=>{gcB[g]=0;gcG[g]=0;});
    boys.forEach(x=>x.subjects.forEach(s=>{if(gcB[s.grade]!==undefined)gcB[s.grade]++;}));
    girls.forEach(x=>x.subjects.forEach(s=>{if(gcG[s.grade]!==undefined)gcG[s.grade]++;}));
    rows.push(['Count',...GRADES.map(g=>gcB[g]),'','Count',...GRADES.map(g=>gcG[g])]);
    rows.push([]);

    // subject-wise boys vs girls average
    rows.push(['SUBJECT-WISE AVERAGE — BOYS vs GIRLS','Code','Boys Avg','Boys Pass%','Girls Avg','Girls Pass%','Difference (B−G)']);
    subs.forEach(s=>{
      const ba=xavg(s.marksB), ga=xavg(s.marksG);
      rows.push([
        s.name, s.code,
        ba, xpct(s.passB,s.nB)+'%',
        ga, xpct(s.passG,s.nG)+'%',
        Math.round((ba-ga)*10)/10
      ]);
    });

    const ws=XLSX.utils.aoa_to_sheet(rows);
    ws['!cols']=[{wch:34},{wch:10},{wch:12},{wch:12},{wch:12},{wch:12},{wch:16}];

    rows.forEach((row,ri)=>{
      if(!row[0]) return;
      const v=String(row[0]);
      // section headers
      if(v===v.toUpperCase()&&v.length>5&&row[1]!==undefined){
        row.forEach((_,ci)=>{
          const a=XLSX.utils.encode_cell({r:ri,c:ci});
          if(ws[a]) ws[a].s=H(cls==='X'?GOLD:TEAL);
        });
        return;
      }
      // label column bold
      const a0=XLSX.utils.encode_cell({r:ri,c:0});
      if(ws[a0]&&v&&!v.startsWith('Count')&&!v.startsWith('Grade')) ws[a0].s={font:{bold:true}};
      // Boys column blue tint, Girls column
      [1,2].forEach(ci=>{
        const a=XLSX.utils.encode_cell({r:ri,c:ci});
        if(ws[a]&&typeof ws[a].v==='number') ws[a].s={alignment:{horizontal:'center'}};
      });
      // Difference column — green if +ve, red if -ve
      const da=XLSX.utils.encode_cell({r:ri,c:6});
      if(ws[da]&&typeof ws[da].v==='number'){
        const diff=ws[da].v;
        ws[da].s={font:{bold:true,color:{rgb:diff>0?PASS_C:diff<0?FAIL_C:'FF888888'}},
                  alignment:{horizontal:'center'}};
      }
    });

    XLSX.utils.book_append_sheet(wb, ws, `Cl ${cls} Gender`);
  });

  /* ════════════════════════════════════════════════════════
     SHEET 5 — ALL STUDENTS RAW DATA  (mirrors Search/full student list)
  ════════════════════════════════════════════════════════ */
  ['X','XII'].forEach(cls=>{
    const sts=DB[cls]; if(!sts.length) return;
    const subCols=getSubjectCols(sts);
    const fixHdrs=['Roll No','Name','Gender','Result','Compartment Sub','Total Marks'];
    const subHdrs=subCols.flatMap(s=>[s.name+' (Marks)',s.name+' (Grade)']);
    const hdrs=[...fixHdrs,...subHdrs];

    const rows=sts.map(s=>{
      const fix=[s.rollNo, s.name, s.gender==='F'?'Female':'Male',
                 s.result, s.compSub||'', xtm(s)];
      const sdata=subCols.flatMap(sc=>{
        const f=s.subjects.find(x=>x.code===sc.code);
        return f?[f.grade==='AB'?'AB':f.marks,f.grade]:['',''];
      });
      return [...fix,...sdata];
    });

    const ws=XLSX.utils.aoa_to_sheet([hdrs,...rows]);
    ws['!cols']=[{wch:12},{wch:28},{wch:9},{wch:12},{wch:18},{wch:13},
                 ...subCols.flatMap(()=>[{wch:22},{wch:9}])];
    // header
    hdrs.forEach((_,ci)=>{
      const a=XLSX.utils.encode_cell({r:0,c:ci});
      if(ws[a]) ws[a].s=H(ci<6?DARK:(cls==='X'?GOLD:TEAL));
    });
    // data rows
    rows.forEach((row,ri)=>{
      const res=row[3];
      hdrs.forEach((_,ci)=>{
        const a=XLSX.utils.encode_cell({r:ri+1,c:ci}); if(!ws[a]) return;
        if(ci===3) ws[a].s={font:{bold:true,color:{rgb:RC(res)}},alignment:{horizontal:'center'}};
        else if(ci===5) ws[a].s={font:{bold:true},alignment:{horizontal:'center'}};
        else if(ci>=6&&ci%2===0) ws[a].s={alignment:{horizontal:'center'}};
        else if(ci>=6&&ci%2===1) ws[a].s={font:{color:{rgb:RC(res)}},alignment:{horizontal:'center'}};
      });
    });

    XLSX.utils.book_append_sheet(wb, ws, `Cl ${cls} All Students`);
  });

  ['X','XII'].forEach(cls => {
    const enriched = buildEnrichedStudents(cls);
    if(!enriched.students.length) return;

    const sectionGroups = {};
    enriched.students.forEach(student => {
      const key = student.section || 'UNMAPPED';
      if(!sectionGroups[key]) sectionGroups[key] = [];
      sectionGroups[key].push(student);
    });
    const sectionRows = [['Section','Class Teacher','Students','Pass %','Comp','Fail','Absent','Avg Total']];
    Object.entries(sectionGroups).forEach(([section, students]) => {
      const stats = st(students);
      sectionRows.push([section, students[0]?.classTeacher || 'Unmapped', stats.n, stats.pct + '%', stats.comp, stats.n - stats.pass - stats.comp - stats.abst, stats.abst, avg(students.filter(student => student.result === 'PASS').map(student => tm(student))).toFixed(1)]);
    });
    if(sectionRows.length > 1){
      const ws = XLSX.utils.aoa_to_sheet(sectionRows);
      ws['!cols'] = [{wch:12},{wch:20},{wch:10},{wch:10},{wch:8},{wch:8},{wch:8},{wch:12}];
      XLSX.utils.book_append_sheet(wb, ws, `Cl ${cls} Sections`);
    }

    const teacherGroups = {};
    enriched.students.forEach(student => {
      student.subjects.forEach(subject => {
        const key = `${subject.teacherName}|${subject.code}|${student.section}`;
        if(!teacherGroups[key]) teacherGroups[key] = {teacher:subject.teacherName, subject:subject.mappedSubjectName || subject.name, code:subject.code, section:student.section, taught:0, pass:0, marks:[], low:0, absent:0};
        const group = teacherGroups[key];
        group.taught += 1;
        if(subject.grade === 'AB') group.absent += 1;
        else {
          group.marks.push(subject.marks);
          if(!subjectIsFail(subject) && !subjectIsAbsent(subject)) group.pass += 1;
          if(subjectIsFail(subject)) group.low += 1;
        }
      });
    });
    const teacherRows = [['Teacher','Subject','Code','Section','Taught','Pass %','Average','Below 33','Absent']];
    Object.values(teacherGroups).forEach(group => {
      teacherRows.push([group.teacher, group.subject, group.code, group.section, group.taught, ((group.pass / group.taught) * 100).toFixed(1) + '%', avg(group.marks).toFixed(1), group.low, group.absent]);
    });
    if(teacherRows.length > 1){
      const ws = XLSX.utils.aoa_to_sheet(teacherRows);
      ws['!cols'] = [{wch:24},{wch:24},{wch:8},{wch:10},{wch:10},{wch:10},{wch:10},{wch:10},{wch:8}];
      XLSX.utils.book_append_sheet(wb, ws, `Cl ${cls} Teachers`);
    }

    const session = getCurrentSingleSession();
    const followUpRows = [['Name','Roll No','Section','Result','Categories','Status','Owner','Remarks']];
    enriched.students.forEach(student => {
      const followUp = getFollowUpCategories(student);
      if(!followUp.categories.length) return;
      const saved = session?.masterData?.followUps?.[`${student.cls}|${student.rollNo}`] || {};
      followUpRows.push([student.name, student.rollNo, student.section, student.result, followUp.categories.join(', '), saved.status || '', saved.owner || '', saved.remarks || '']);
    });
    if(followUpRows.length > 1){
      const ws = XLSX.utils.aoa_to_sheet(followUpRows);
      ws['!cols'] = [{wch:24},{wch:12},{wch:10},{wch:10},{wch:30},{wch:22},{wch:20},{wch:28}];
      XLSX.utils.book_append_sheet(wb, ws, `Cl ${cls} FollowUp`);
    }
  });

  /* ── download ── */
  const school=(meta.school||'CBSE').replace(/\s+/g,'_').substring(0,28);
  XLSX.writeFile(wb, `CBSE_${school}_${meta.year||new Date().getFullYear()}.xlsx`);
}

// ── AUTO RESTORE ON PAGE LOAD ──
tryRestoreFromLocalStorage();

// Close import overlay on outside click or ESC
document.getElementById('import-overlay').addEventListener('click', e=>{
  if(e.target === e.currentTarget) closeImportOverlay();
});
document.addEventListener('keydown', e=>{
  if(e.key==='Escape') closeImportOverlay();
});

/* ── AUTHENTICATION INTERACTIVE LOGIC ── */

async function authLogin() {
  const u = document.getElementById('login-username').value.trim();
  const p = document.getElementById('login-password').value;
  const err = document.getElementById('login-error');
  err.textContent = '';
  
  if(!u || !p) {
    err.textContent = 'Please enter both username and password.';
    return;
  }
  
  const res = await Store.login(u, p);
  if(res.success) {
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
    // Now trigger the full restore flow
    await tryRestoreFromLocalStorage();
  } else {
    err.textContent = res.error;
  }
}

async function authRegisterSelf() {
  const u = document.getElementById('signup-username').value.trim();
  const p = document.getElementById('signup-password').value;
  const err = document.getElementById('signup-error');
  err.textContent = '';

  if(!u || !p) {
    err.textContent = 'Please enter a username and password.';
    return;
  }

  const res = await Store.registerSelf(u, p);
  if(res.success) {
    document.getElementById('signup-username').value = '';
    document.getElementById('signup-password').value = '';
    await tryRestoreFromLocalStorage();
  } else {
    err.textContent = res.error;
  }
}

async function authLogout() {
  await Store.logout();
  location.reload();
}

async function authRegister() {
  const u = document.getElementById('reg-username').value.trim();
  const p = document.getElementById('reg-password').value;
  const r = document.getElementById('reg-role').value;
  const err = document.getElementById('reg-error');
  const succ = document.getElementById('reg-success');
  err.textContent = '';
  succ.textContent = '';
  
  if(!u || !p) {
    err.textContent = 'Username and password are required.';
    return;
  }
  
  const res = await Store.registerUser(u, p, r);
  if(res.success) {
    document.getElementById('reg-username').value = '';
    document.getElementById('reg-password').value = '';
    succ.textContent = `User ${res.user.username} created successfully.`;
    await refreshUserList();
  } else {
    err.textContent = res.error;
  }
}

async function saveNewPassword() {
  const p = document.getElementById('new-password').value;
  const err = document.getElementById('password-error');
  const succ = document.getElementById('password-success');
  err.textContent = '';
  succ.textContent = '';
  
  if(!p || p.length < 4) {
    err.textContent = 'Password must be at least 4 characters long.';
    return;
  }
  
  const res = await Store.changePassword(p);
  if(res.success) {
    document.getElementById('new-password').value = '';
    succ.textContent = 'Password changed successfully.';
    setTimeout(() => {
      closePasswordModal();
    }, 1500);
  } else {
    err.textContent = res.error;
  }
}

async function refreshUserList() {
  const body = document.getElementById('user-table-body');
  if(!body) return;
  body.innerHTML = '<tr><td colspan="5">Loading...</td></tr>';
  const users = await Store.listUsers();
  
  if(!users.length) {
    body.innerHTML = '<tr><td colspan="5">No users found.</td></tr>';
    return;
  }
  
  body.innerHTML = users.map(user => {
    const isMasterAdmin = user.username === 'admin';
    const isSelf = Store.user && Store.user.username === user.username;
    const canDelete = !isMasterAdmin && !isSelf;
    const isAdmin = user.role === 'admin';
    const features = user.features || {};
    const featureToggles = isAdmin
      ? '<span style="color:#aaa; font-size:11px;">All enabled</span>'
      : `
        <label class="feature-toggle"><input type="checkbox" ${features.student_master_upload ? 'checked' : ''} onchange="toggleUserFeature(${user.id}, 'student_master_upload', this.checked)"> Student master</label>
        <label class="feature-toggle"><input type="checkbox" ${features.teacher_mapping_upload ? 'checked' : ''} onchange="toggleUserFeature(${user.id}, 'teacher_mapping_upload', this.checked)"> Teacher mapping</label>
        <label class="feature-toggle"><input type="checkbox" ${features.performance_marks_upload ? 'checked' : ''} onchange="toggleUserFeature(${user.id}, 'performance_marks_upload', this.checked)"> Marks upload</label>
        <label class="feature-toggle"><input type="checkbox" ${features.excel_export ? 'checked' : ''} onchange="toggleUserFeature(${user.id}, 'excel_export', this.checked)"> Excel export</label>
      `;
    
    return `<tr>
      <td><strong>${escapeHtml(user.username)}</strong></td>
      <td><span class="followup-tag" style="background:${user.role === 'admin' ? '#eef2ff; color:#4f46e5;' : '#f3f4f6; color:#374151;'}">${user.role.toUpperCase()}</span></td>
      <td><div class="feature-toggle-grid">${featureToggles}</div></td>
      <td>${new Date(user.created_at || Date.now()).toLocaleDateString()}</td>
      <td>
        ${canDelete ? `<button class="btn-clear" style="padding: 2px 10px; font-size: 11px; display:inline-block;" onclick="deleteUserAccount('${user.username}')">Delete</button>` : '<span style="color:#aaa; font-size:11px;">Restricted</span>'}
      </td>
    </tr>`;
  }).join('');
}

async function toggleUserFeature(userId, featureKey, enabled) {
  const users = await Store.listUsers();
  const user = users.find(item => item.id === userId);
  if(!user) return;
  const features = {...(user.features || {}), [featureKey]: enabled};
  const res = await Store.updateUserFeatures(userId, features);
  if(!res.success) {
    alert(res.error);
    await refreshUserList();
  }
}

async function deleteUserAccount(username) {
  if(confirm(`Are you sure you want to delete user account "${username}"?`)) {
    const res = await Store.deleteUser(username);
    if(res.success) {
      await refreshUserList();
    } else {
      alert(res.error);
    }
  }
}

function openUserModal() {
  document.getElementById('user-modal').style.display = 'flex';
  document.getElementById('reg-error').textContent = '';
  document.getElementById('reg-success').textContent = '';
  refreshUserList();
}

function closeUserModal() {
  document.getElementById('user-modal').style.display = 'none';
}

function openPasswordModal() {
  document.getElementById('password-modal').style.display = 'flex';
  document.getElementById('password-error').textContent = '';
  document.getElementById('password-success').textContent = '';
}

function closePasswordModal() {
  document.getElementById('password-modal').style.display = 'none';
}

function syncUserUI() {
  const loginOverlay = document.getElementById('login-screen');
  const userDisp = document.getElementById('header-user-display');
  const btnLogout = document.getElementById('btn-logout');
  const btnPass = document.getElementById('btn-change-password');
  const btnManage = document.getElementById('btn-manage-users');
  
  // Admin-restricted buttons
  const btnAdd = document.getElementById('btn-add-school');
  const btnClear = document.getElementById('btn-clear');
  const btnRestore = document.getElementById('btn-restore-json');
  const btnBackup = document.getElementById('btn-backup');
  const btnExport = document.getElementById('btn-export');
  const workspaceActions = document.querySelector('.workspace-actions');
  const uploadScreen = document.getElementById('upload-screen');
  const setDisplayAll = (selector, enabled, display='inline-block') => {
    document.querySelectorAll(selector).forEach(el => {
      el.style.display = enabled ? display : 'none';
    });
  };
  const syncPremiumControls = () => {
    setDisplayAll('.premium-student-master', Store.hasFeature('student_master_upload'));
    setDisplayAll('.premium-teacher-mapping', Store.hasFeature('teacher_mapping_upload'));
    setDisplayAll('.premium-performance-marks', Store.hasFeature('performance_marks_upload'));
    if(btnExport) btnExport.style.display = Store.hasFeature('excel_export') ? 'inline-block' : 'none';
  };
  
  if (Store.mode === 'api') {
    if (!Store.user) {
      // Show login overlay, hide dashboard/workspace
      loginOverlay.style.display = 'flex';
      userDisp.style.display = 'none';
      btnLogout.style.display = 'none';
      btnPass.style.display = 'none';
      btnManage.style.display = 'none';
      
      // Hide admin operations
      if(btnAdd) btnAdd.style.display = 'none';
      if(btnClear) btnClear.style.display = 'none';
      if(btnRestore) btnRestore.style.display = 'none';
      if(btnBackup) btnBackup.style.display = 'none';
      if(btnExport) btnExport.style.display = 'none';
      syncPremiumControls();
      
      document.getElementById('dashboard').style.display = 'none';
      if(uploadScreen) uploadScreen.style.display = 'none';
    } else {
      // User is logged in
      loginOverlay.style.display = 'none';
      userDisp.textContent = `User: ${Store.user.username} (${Store.user.role.toUpperCase()})`;
      userDisp.style.display = 'inline';
      btnLogout.style.display = 'inline-block';
      btnPass.style.display = 'inline-block';
      
      const isAdmin = Store.user.role === 'admin';
      btnManage.style.display = isAdmin ? 'inline-block' : 'none';
      
      // Enforce admin controls
      if(btnAdd) btnAdd.style.display = 'inline-block';
      if(btnClear) btnClear.style.display = 'inline-block';
      if(btnRestore) btnRestore.style.display = isAdmin ? 'inline-block' : 'none';
      if(btnBackup) btnBackup.style.display = isAdmin ? 'inline-block' : 'none';
      
      if(workspaceActions) {
        workspaceActions.style.display = 'flex';
      }
      syncPremiumControls();
      
      const sessions = collectSavedSessions();
      if(!sessions.length) {
        if(isAdmin) {
          if(uploadScreen) uploadScreen.style.display = 'flex';
          document.getElementById('dashboard').style.display = 'none';
        } else {
          // Regular users see their own workspace only.
          if(uploadScreen) uploadScreen.style.display = 'none';
          document.getElementById('dashboard').style.display = 'block';
          document.getElementById('session-list').innerHTML = '<div class="workspace-empty">No saved schools available. Please contact your administrator.</div>';
        }
      } else {
        if(uploadScreen) uploadScreen.style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
      }
    }
  } else {
    // Local / Offline mode (no auth UI)
    loginOverlay.style.display = 'none';
    userDisp.style.display = 'none';
    btnLogout.style.display = 'none';
    btnPass.style.display = 'none';
    btnManage.style.display = 'none';
    
    // Enable all operations for local mode
    if(btnAdd) btnAdd.style.display = 'inline-block';
    if(btnClear) btnClear.style.display = 'inline-block';
    if(btnRestore) btnRestore.style.display = 'inline-block';
    if(btnBackup) btnBackup.style.display = 'inline-block';
    if(btnExport) btnExport.style.display = 'inline-block';
    if(workspaceActions) workspaceActions.style.display = 'flex';
    syncPremiumControls();
  }
}

/* ══════════════════════════════════════════════════════════════
   EXAM ATTEMPT COMPARISON
   Compares the same students across two exam attempts (e.g. Exam 1
   vs Exam 2, or Main vs Supplementary) of the same school/year/class.
══════════════════════════════════════════════════════════════ */

function sessionsWithClass(cls){
  return Object.values(schoolSessions)
    .filter(session => session.classes?.[cls])
    .sort((a,b) => {
      const schoolDiff = String(a.schoolCode).localeCompare(String(b.schoolCode));
      if(schoolDiff) return schoolDiff;
      const yearDiff = String(b.year).localeCompare(String(a.year));
      if(yearDiff) return yearDiff;
      return normalizeExamLabel(a.examLabel).localeCompare(normalizeExamLabel(b.examLabel));
    });
}

function examCompareOptionLabel(session, cls){
  const label = normalizeExamLabel(session.examLabel);
  const date = session.classes?.[cls]?.examDate;
  return `${session.schoolName || session.schoolCode} · ${session.year} · ${label}${date ? ' (' + date + ')' : ''}`;
}

function refreshExamCompareOptions(){
  const cls = document.getElementById('ec-class').value;
  const sessions = sessionsWithClass(cls);
  const selA = document.getElementById('ec-session-a');
  const selB = document.getElementById('ec-session-b');
  const errEl = document.getElementById('exam-compare-error');
  document.getElementById('exam-compare-results').innerHTML = '';

  const optionsHtml = sessions.map(session =>
    `<option value="${escapeAttr(session.sessionId)}">${escapeHtml(examCompareOptionLabel(session, cls))}</option>`
  ).join('');
  selA.innerHTML = optionsHtml;
  selB.innerHTML = optionsHtml;

  if(sessions.length < 2){
    errEl.textContent = `Only ${sessions.length} exam attempt${sessions.length === 1 ? '' : 's'} found for Class ${cls}. Upload a second attempt (e.g. Exam 2 or Supplementary) to compare.`;
  } else {
    errEl.textContent = '';
    selB.selectedIndex = Math.min(1, sessions.length - 1);
  }
}

function openExamCompareModal(){
  document.getElementById('exam-compare-modal').style.display = 'flex';
  document.getElementById('exam-compare-results').innerHTML = '';
  refreshExamCompareOptions();
}

function closeExamCompareModal(){
  document.getElementById('exam-compare-modal').style.display = 'none';
}

function subjectTotal(student){
  return (student?.subjects || []).reduce((sum, sub) => sum + (typeof sub.marks === 'number' ? sub.marks : 0), 0);
}

function computeExamAggregateStats(students){
  const stats = st(students);
  const fail = stats.n - stats.pass - stats.comp - stats.abst;
  const avgTotal = avg(students.filter(s => s.result === 'PASS').map(tm));
  return {n: stats.n, pass: stats.pass, comp: stats.comp, abst: stats.abst, fail, pct: Number(stats.pct), avgTotal: Number(avgTotal.toFixed(1))};
}

function computeExamSubjectAverages(studentsA, studentsB){
  const byCode = new Map();
  const collect = (students, side) => {
    students.forEach(student => student.subjects.forEach(sub => {
      if(!byCode.has(sub.code)) byCode.set(sub.code, {code: sub.code, name: sub.name, marksA: [], marksB: [], passA: 0, totalA: 0, passB: 0, totalB: 0});
      const entry = byCode.get(sub.code);
      if(sub.grade !== 'AB') entry[side === 'A' ? 'marksA' : 'marksB'].push(sub.marks);
      entry[side === 'A' ? 'totalA' : 'totalB']++;
      if(!subjectIsFail(sub) && !subjectIsAbsent(sub)) entry[side === 'A' ? 'passA' : 'passB']++;
    }));
  };
  collect(studentsA, 'A');
  collect(studentsB, 'B');
  return [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code)).map(entry => {
    const avgA = entry.marksA.length ? avg(entry.marksA) : null;
    const avgB = entry.marksB.length ? avg(entry.marksB) : null;
    return {
      code: entry.code, name: entry.name,
      avgA: avgA !== null ? Number(avgA.toFixed(1)) : null,
      avgB: avgB !== null ? Number(avgB.toFixed(1)) : null,
      delta: (avgA !== null && avgB !== null) ? Number((avgB - avgA).toFixed(1)) : null,
      passPctA: entry.totalA ? Number(((entry.passA / entry.totalA) * 100).toFixed(1)) : null,
      passPctB: entry.totalB ? Number(((entry.passB / entry.totalB) * 100).toFixed(1)) : null,
    };
  });
}

function computeExamComparisonRows(studentsA, studentsB){
  const mapA = new Map(studentsA.map(s => [s.rollNo, s]));
  const mapB = new Map(studentsB.map(s => [s.rollNo, s]));
  const allRolls = [...new Set([...mapA.keys(), ...mapB.keys()])].sort();

  return allRolls.map(rollNo => {
    const a = mapA.get(rollNo) || null;
    const b = mapB.get(rollNo) || null;
    const subjA = new Map((a?.subjects || []).map(s => [s.code, s]));
    const subjB = new Map((b?.subjects || []).map(s => [s.code, s]));
    const allCodes = [...new Set([...subjA.keys(), ...subjB.keys()])].sort();
    const subjects = allCodes.map(code => {
      const sa = subjA.get(code) || null;
      const sb = subjB.get(code) || null;
      const delta = (sa && sb && typeof sa.marks === 'number' && typeof sb.marks === 'number') ? (sb.marks - sa.marks) : null;
      return {code, name: sa?.name || sb?.name || sn(code, ''), a: sa, b: sb, delta};
    });
    const totalA = a ? subjectTotal(a) : null;
    const totalB = b ? subjectTotal(b) : null;
    return {
      rollNo,
      name: a?.name || b?.name || '',
      inA: !!a, inB: !!b,
      resultA: a?.result || '—',
      resultB: b?.result || '—',
      totalA, totalB,
      totalDelta: (totalA !== null && totalB !== null) ? (totalB - totalA) : null,
      subjects,
    };
  });
}

function renderExamComparison(){
  const cls = document.getElementById('ec-class').value;
  const sidA = document.getElementById('ec-session-a').value;
  const sidB = document.getElementById('ec-session-b').value;
  const errEl = document.getElementById('exam-compare-error');
  const resultsEl = document.getElementById('exam-compare-results');

  if(!sidA || !sidB){
    errEl.textContent = 'Select two exam attempts to compare.';
    return;
  }
  if(sidA === sidB){
    errEl.textContent = 'Choose two different exam attempts to compare.';
    return;
  }
  const sessionA = schoolSessions[sidA];
  const sessionB = schoolSessions[sidB];
  if(!sessionA?.classes?.[cls] || !sessionB?.classes?.[cls]){
    errEl.textContent = 'Selected attempts no longer have data for this class.';
    return;
  }
  errEl.textContent = '';

  const studentsA = sessionA.classes[cls].students;
  const studentsB = sessionB.classes[cls].students;
  const rows = computeExamComparisonRows(studentsA, studentsB);
  const labelA = examCompareOptionLabel(sessionA, cls);
  const labelB = examCompareOptionLabel(sessionB, cls);
  const statsA = computeExamAggregateStats(studentsA);
  const statsB = computeExamAggregateStats(studentsB);
  const subjectAverages = computeExamSubjectAverages(studentsA, studentsB);

  const improved = rows.filter(r => r.totalDelta !== null && r.totalDelta > 0).length;
  const declined = rows.filter(r => r.totalDelta !== null && r.totalDelta < 0).length;
  const unchanged = rows.filter(r => r.totalDelta === 0).length;
  const onlyInA = rows.filter(r => r.inA && !r.inB).length;
  const onlyInB = rows.filter(r => !r.inA && r.inB).length;
  const changeRows = rows.filter(r => (r.inA && r.inB && r.resultA !== r.resultB) || !r.inA || !r.inB);

  currentExamComparison = {cls, sessionA, sessionB, labelA, labelB, statsA, statsB, subjectAverages, rows, changeRows};

  const summaryHtml = `
    <div class="master-status" style="margin-bottom:12px;">
      <span class="master-chip">Improved <strong>${improved}</strong></span>
      <span class="master-chip">Declined <strong>${declined}</strong></span>
      <span class="master-chip">Unchanged total <strong>${unchanged}</strong></span>
      <span class="master-chip">Result status changed <strong>${changeRows.filter(r=>r.inA&&r.inB).length}</strong></span>
      ${onlyInA ? `<span class="master-chip">Only in A <strong>${onlyInA}</strong></span>` : ''}
      ${onlyInB ? `<span class="master-chip">Only in B <strong>${onlyInB}</strong></span>` : ''}
    </div>`;

  const statRow = (label, a, b, fmt = (v => v)) => {
    const delta = (typeof a === 'number' && typeof b === 'number') ? Number((b - a).toFixed(2)) : null;
    const color = delta > 0 ? 'var(--green,#1a7f37)' : delta < 0 ? 'var(--red,#c0392b)' : 'inherit';
    const deltaTxt = delta === null ? '' : (delta > 0 ? ` (+${delta})` : delta < 0 ? ` (${delta})` : ' (=)');
    return `<tr><td>${label}</td><td>${fmt(a)}</td><td>${fmt(b)}</td><td style="color:${color};font-weight:700">${fmt(b)}${deltaTxt}</td></tr>`;
  };
  const summaryStatsHtml = `
    <h3 style="margin:16px 0 8px;font-size:14px;">Summary Comparison</h3>
    <div class="tbl-wrap">
      <table>
        <thead><tr><th>Metric</th><th>A</th><th>B</th><th>B vs A</th></tr></thead>
        <tbody>
          ${statRow('Students', statsA.n, statsB.n)}
          ${statRow('Pass', statsA.pass, statsB.pass)}
          ${statRow('Compartment', statsA.comp, statsB.comp)}
          ${statRow('Absent', statsA.abst, statsB.abst)}
          ${statRow('Fail', statsA.fail, statsB.fail)}
          ${statRow('Pass %', statsA.pct, statsB.pct, v => `${v}%`)}
          ${statRow('Average Total (pass students)', statsA.avgTotal, statsB.avgTotal)}
        </tbody>
      </table>
    </div>`;

  const subjectAvgHtml = `
    <h3 style="margin:16px 0 8px;font-size:14px;">Subject-wise Averages</h3>
    <div class="tbl-wrap" style="max-height:260px;overflow:auto;">
      <table>
        <thead><tr><th>Subject</th><th>Code</th><th>Avg A</th><th>Avg B</th><th>Δ</th><th>Pass % A</th><th>Pass % B</th></tr></thead>
        <tbody>${subjectAverages.map(sub => {
          const color = sub.delta > 0 ? 'var(--green,#1a7f37)' : sub.delta < 0 ? 'var(--red,#c0392b)' : 'inherit';
          return `<tr>
            <td>${escapeHtml(sub.name)}</td>
            <td>${escapeHtml(sub.code)}</td>
            <td>${sub.avgA ?? '—'}</td>
            <td>${sub.avgB ?? '—'}</td>
            <td style="color:${color};font-weight:700">${sub.delta === null ? '—' : (sub.delta > 0 ? `+${sub.delta}` : sub.delta)}</td>
            <td>${sub.passPctA ?? '—'}${sub.passPctA !== null ? '%' : ''}</td>
            <td>${sub.passPctB ?? '—'}${sub.passPctB !== null ? '%' : ''}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>`;

  const changeReportHtml = `
    <h3 style="margin:16px 0 8px;font-size:14px;">Change Report <span style="font-weight:400;font-size:12px;color:var(--muted,#888)">(result status changed, or only appears in one attempt)</span></h3>
    ${changeRows.length ? `<div class="tbl-wrap" style="max-height:260px;overflow:auto;">
      <table>
        <thead><tr><th>Roll No</th><th>Name</th><th>Change</th><th>Result (A → B)</th><th>Total (A→B)</th></tr></thead>
        <tbody>${changeRows.map(row => {
          const changeType = !row.inA ? 'New in B' : !row.inB ? 'Missing in B' : 'Result changed';
          const totalDeltaTxt = row.totalDelta === null ? '—' : (row.totalDelta > 0 ? `+${row.totalDelta}` : row.totalDelta);
          return `<tr>
            <td>${escapeHtml(row.rollNo)}</td>
            <td>${escapeHtml(row.name)}</td>
            <td>${changeType}</td>
            <td style="font-weight:700">${escapeHtml(row.resultA)} → ${escapeHtml(row.resultB)}</td>
            <td>${row.totalA ?? '—'} → ${row.totalB ?? '—'} (${totalDeltaTxt})</td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>` : '<div class="workspace-empty">No status changes between these two attempts.</div>'}`;

  const tableRows = rows.map(row => {
    const subjectCells = row.subjects.map(sub => {
      const aTxt = sub.a ? (sub.a.grade === 'AB' ? 'AB' : sub.a.marks) : '—';
      const bTxt = sub.b ? (sub.b.grade === 'AB' ? 'AB' : sub.b.marks) : '—';
      const deltaTxt = sub.delta === null ? '' : (sub.delta > 0 ? ` (+${sub.delta})` : sub.delta < 0 ? ` (${sub.delta})` : ' (=)');
      const color = sub.delta > 0 ? 'var(--green,#1a7f37)' : sub.delta < 0 ? 'var(--red,#c0392b)' : 'inherit';
      return `<div title="${escapeAttr(sub.name)} (${escapeAttr(sub.code)})" style="white-space:nowrap;color:${color}">${escapeHtml(sub.code)}: ${escapeHtml(String(aTxt))}→${escapeHtml(String(bTxt))}${deltaTxt}</div>`;
    }).join('');
    const totalDeltaTxt = row.totalDelta === null ? '—' : (row.totalDelta > 0 ? `+${row.totalDelta}` : row.totalDelta);
    const totalColor = row.totalDelta > 0 ? 'var(--green,#1a7f37)' : row.totalDelta < 0 ? 'var(--red,#c0392b)' : 'inherit';
    const resultChangedFlag = row.inA && row.inB && row.resultA !== row.resultB;
    return `<tr>
      <td>${escapeHtml(row.rollNo)}</td>
      <td>${escapeHtml(row.name)}</td>
      <td style="${resultChangedFlag ? 'font-weight:700' : ''}">${escapeHtml(row.resultA)} → ${escapeHtml(row.resultB)}</td>
      <td>${subjectCells || '—'}</td>
      <td style="color:${totalColor};font-weight:700">${row.totalA ?? '—'} → ${row.totalB ?? '—'} (${totalDeltaTxt})</td>
    </tr>`;
  }).join('');

  resultsEl.innerHTML = `
    ${summaryHtml}
    <div style="font-size:12px;color:var(--muted,#888);margin-bottom:8px;">
      <strong>A:</strong> ${escapeHtml(labelA)} &nbsp;&middot;&nbsp; <strong>B:</strong> ${escapeHtml(labelB)}
    </div>
    <button class="btn-export" style="display:inline-block;margin-bottom:8px;" onclick="exportExamComparison()">Export to Excel</button>
    ${summaryStatsHtml}
    ${subjectAvgHtml}
    ${changeReportHtml}
    <h3 style="margin:16px 0 8px;font-size:14px;">Student-wise Comparison</h3>
    <div class="tbl-wrap" style="max-height:420px;overflow:auto;">
      <table>
        <thead>
          <tr>
            <th>Roll No</th>
            <th>Name</th>
            <th>Result (A → B)</th>
            <th>Subjects (A→B)</th>
            <th>Total (A→B)</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>`;
}

function exportExamComparison(){
  if(!window.XLSX){
    alert('Excel library not loaded yet - please wait a moment and try again.');
    return;
  }
  if(!currentExamComparison){
    alert('Run a comparison first.');
    return;
  }
  const {cls, labelA, labelB, statsA, statsB, subjectAverages, rows, changeRows} = currentExamComparison;

  const wb = XLSX.utils.book_new();

  const summarySheetRows = [
    ['Attempt A', labelA],
    ['Attempt B', labelB],
    [],
    ['Metric', 'A', 'B'],
    ['Students', statsA.n, statsB.n],
    ['Pass', statsA.pass, statsB.pass],
    ['Compartment', statsA.comp, statsB.comp],
    ['Absent', statsA.abst, statsB.abst],
    ['Fail', statsA.fail, statsB.fail],
    ['Pass %', statsA.pct, statsB.pct],
    ['Average Total (pass students)', statsA.avgTotal, statsB.avgTotal],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summarySheetRows);
  summarySheet['!cols'] = [{wch:28}, {wch:20}, {wch:20}];
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

  const subjectRows = [['Subject', 'Code', 'Avg A', 'Avg B', 'Delta', 'Pass % A', 'Pass % B']];
  subjectAverages.forEach(sub => subjectRows.push([sub.name, sub.code, sub.avgA, sub.avgB, sub.delta, sub.passPctA, sub.passPctB]));
  const subjectSheet = XLSX.utils.aoa_to_sheet(subjectRows);
  subjectSheet['!cols'] = [{wch:28}, {wch:8}, {wch:10}, {wch:10}, {wch:10}, {wch:10}, {wch:10}];
  XLSX.utils.book_append_sheet(wb, subjectSheet, 'Subject Averages');

  const changeSheetRows = [['Roll No', 'Name', 'Change', 'Result A', 'Result B', 'Total A', 'Total B', 'Total Delta']];
  changeRows.forEach(row => {
    const changeType = !row.inA ? 'New in B' : !row.inB ? 'Missing in B' : 'Result changed';
    changeSheetRows.push([row.rollNo, row.name, changeType, row.resultA, row.resultB, row.totalA, row.totalB, row.totalDelta]);
  });
  const changeSheet = XLSX.utils.aoa_to_sheet(changeSheetRows);
  changeSheet['!cols'] = [{wch:12}, {wch:26}, {wch:14}, {wch:10}, {wch:10}, {wch:10}, {wch:10}, {wch:10}];
  XLSX.utils.book_append_sheet(wb, changeSheet, 'Change Report');

  const maxSubjects = rows.reduce((max, row) => Math.max(max, row.subjects.length), 0);
  const studentHeader = ['Roll No', 'Name', 'Result A', 'Result B', 'Total A', 'Total B', 'Total Delta'];
  for(let i = 0; i < maxSubjects; i++){
    studentHeader.push(`Subject ${i+1}`, `A`, `B`, `Delta`);
  }
  const studentRows = [studentHeader];
  rows.forEach(row => {
    const line = [row.rollNo, row.name, row.resultA, row.resultB, row.totalA, row.totalB, row.totalDelta];
    row.subjects.forEach(sub => {
      line.push(
        `${sub.name} (${sub.code})`,
        sub.a ? (sub.a.grade === 'AB' ? 'AB' : sub.a.marks) : '',
        sub.b ? (sub.b.grade === 'AB' ? 'AB' : sub.b.marks) : '',
        sub.delta ?? ''
      );
    });
    studentRows.push(line);
  });
  const studentSheet = XLSX.utils.aoa_to_sheet(studentRows);
  studentSheet['!cols'] = [{wch:12}, {wch:26}, {wch:10}, {wch:10}, {wch:10}, {wch:10}, {wch:10}];
  XLSX.utils.book_append_sheet(wb, studentSheet, 'Student Comparison');

  const schoolTag = (currentExamComparison.sessionA.schoolCode || 'CBSE').replace(/\s+/g, '_');
  XLSX.writeFile(wb, `CBSE_ExamComparison_${schoolTag}_${cls}_${currentExamComparison.sessionA.year}.xlsx`);
}
