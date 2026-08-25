/**
 * LVCC Assessment Portal — Main App
 * v1.3.0
 */

const App = {
  clearExamQuery() {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('exam');
      window.history.replaceState({}, '', url.pathname + (url.search || '') + (url.hash || ''));
    } catch (_) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  },

  async init() {
    Theme.init();
    const loading = document.getElementById('loading');
    try {
      const ok = await this.waitForFirebase(8000);
      if (!ok) { this.showFirebaseLoadError(); return; }
      if (!window.firebaseConfig || window.firebaseConfig.apiKey === 'YOUR_API_KEY') {
        this.showConfigNeeded(); return;
      }
      const profile = await Auth.init();
      if (profile) {
        await Auth.checkPendingTeacher(Auth.currentUser);
        await Auth.resolveProctorState(Auth.currentUser);
        await Theme.loadFromProfile();
        this.routeAfterLogin();
      } else {
        this.showLogin();
      }
    } catch (err) {
      console.error(err);
      this.showError(err.message || String(err));
    } finally {
      loading?.classList.add('hidden');
    }
  },

  waitForFirebase(ms = 8000) {
    return new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        if (typeof firebase !== 'undefined') {
          resolve(!!(window.initFirebaseApp && window.initFirebaseApp() && window.auth));
          return;
        }
        if (Date.now() - start > ms) { resolve(false); return; }
        setTimeout(tick, 150);
      };
      tick();
    });
  },

  showFirebaseLoadError() {
    document.getElementById('app').innerHTML = `
      <div class="auth-container" style="max-width:640px">
        <h1>⚠️ Firebase SDK Failed to Load</h1>
        <p>Disable ad-blockers, try Incognito, or another network.</p>
        <button class="btn btn-primary" onclick="location.reload()">Try Again</button>
      </div>`;
  },

  showConfigNeeded() {
    document.getElementById('app').innerHTML = `
      <div class="auth-container" style="max-width:640px">
        <h1>⚙️ Firebase Setup Required</h1>
        <p>Edit <code>js/firebase-config.js</code> with your project keys and SUPERADMIN_EMAILS.</p>
      </div>`;
  },

  showLogin() {
    document.getElementById('app').innerHTML = `
      <div class="auth-container">
        <img src="assets/lvcc-logo.png" alt="LVCC Logo" class="brand-logo" width="120" height="120" />
        <h1>LVCC Assessment Portal</h1>
        <p class="brand-subtitle">True to our name, true to our test</p>
        <button class="google-btn" id="google-signin">
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" />
          Sign in with Google
        </button>
        <p class="mt-2 text-muted" style="font-size:0.85rem;line-height:1.5">
          Use <strong>@student.laverdad.edu.ph</strong> or <strong>@laverdad.edu.ph</strong>.<br>
          Personal email is allowed only if invited to a specific exam.
        </p>
        <div id="login-error" class="hidden login-error"></div>
        <div class="mt-2" style="text-align:center">${Theme.buttonHtml()}
          <div class="app-version">Build v1.5.8</div>
        </div>
      </div>`;
    document.getElementById('google-signin').onclick = async () => {
      const errBox = document.getElementById('login-error');
      errBox.classList.add('hidden');
      try {
        await Auth.signInWithGoogle();
        if (Auth.currentUser) {
          await Auth.checkPendingTeacher(Auth.currentUser);
          await Auth.resolveProctorState(Auth.currentUser);
        }
        if (Auth.userProfile) {
          await Theme.loadFromProfile();
          this.routeAfterLogin();
        }
      } catch (err) {
        errBox.textContent = err.message || 'Sign-in failed.';
        errBox.classList.remove('hidden');
      }
    };
  },

  showAccessDeniedScreen(message) {
    document.getElementById('app').innerHTML = `
      <div class="auth-container" style="max-width:520px">
        <h1>Access Denied</h1>
        <p class="access-denied-msg">${escapeHtml(message)}</p>
        <button class="btn btn-primary" onclick="App.showLogin()">Back to Sign In</button>
      </div>`;
  },

  routeAfterLogin() {
    const role = Auth.userProfile.role;
    const params = new URLSearchParams(window.location.search);
    const examId = params.get('exam');

    if (examId && role !== 'proctor') {
      const isTest = new URLSearchParams(window.location.search).get('test') === '1';
      // Instructors may only open via test=1
      this.startStudentExam(examId, { testMode: isTest });
      return;
    }
    if (role === 'superadmin') this.showDashboard();
    else if (role === 'teacher') this.showDashboard();
    else if (role === 'proctor') this.showProctorHome();
    else this.showStudentJoinScreen();
  },

  toggleMobileNav() {
    document.getElementById('sidebar')?.classList.toggle('open');
    document.getElementById('nav-backdrop')?.classList.toggle('open');
  },

  renderShell(contentHtml, activeNav = '') {
    const role = Auth.userProfile.role;
    const name = Auth.userProfile.name || Auth.userProfile.email || '';
    const email = Auth.userProfile.email || '';
    const photo = Auth.userProfile.photoURL || Auth.currentUser?.photoURL || '';
    const initials = (name || email || '?').split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase();

    let navItems = '';
    if (role === 'superadmin') {
      navItems = `
        <div class="nav-item ${activeNav==='dashboard'?'active':''}" onclick="App.showDashboard();App.closeNav()">
          <span class="nav-ico">📈</span><span>Dashboard</span></div>
        <div class="nav-item ${activeNav==='teachers'?'active':''}" onclick="App.showSuperAdmin();App.closeNav()">
          <span class="nav-ico">👥</span><span>Instructors</span></div>
        <div class="nav-item ${activeNav==='exams'?'active':''}" onclick="App.showTeacherHome();App.closeNav()">
          <span class="nav-ico">📝</span><span>My Assessments</span></div>`;
    } else if (role === 'teacher') {
      navItems = `
        <div class="nav-item ${activeNav==='dashboard'?'active':''}" onclick="App.showDashboard();App.closeNav()">
          <span class="nav-ico">📈</span><span>Dashboard</span></div>
        <div class="nav-item ${activeNav==='exams'?'active':''}" onclick="App.showTeacherHome();App.closeNav()">
          <span class="nav-ico">📝</span><span>My Assessments</span></div>`;
    } else if (role === 'proctor') {
      navItems = `
        <div class="nav-item ${activeNav==='dashboard'?'active':''}" onclick="App.showDashboard();App.closeNav()">
          <span class="nav-ico">📈</span><span>Dashboard</span></div>
        <div class="nav-item ${activeNav==='proctor'?'active':''}" onclick="App.showProctorHome();App.closeNav()">
          <span class="nav-ico">◉</span><span>Proctor</span></div>`;
    } else {
      navItems = `
        <div class="nav-item ${activeNav==='dashboard'?'active':''}" onclick="App.showDashboard();App.closeNav()">
          <span class="nav-ico">📈</span><span>Dashboard</span></div>
        <div class="nav-item ${activeNav==='history'?'active':''}" onclick="App.showStudentHistory();App.closeNav()">
          <span class="nav-ico">📝</span><span>Assessments</span></div>
        <div class="nav-item ${activeNav==='mock'?'active':''}" onclick="App.showMockHistory();App.closeNav()">
          <span class="nav-ico">◐</span><span>Mock History</span></div>`;
    }

    const avatar = photo
      ? `<img class="user-avatar" src="${photo}" alt="" />`
      : `<span class="user-avatar user-avatar-fallback">${escapeHtml(initials)}</span>`;

    document.getElementById('app').innerHTML = `
      <div class="shell ${document.body.classList.contains('nav-collapsed') ? 'nav-collapsed' : ''}">
        <div id="nav-backdrop" class="nav-backdrop" onclick="App.closeNav()"></div>
        <aside class="sidebar" id="sidebar">
          <div class="sidebar-brand">
            <button type="button" class="brand-toggle" onclick="App.toggleNav()" aria-label="Toggle menu">
              <img src="assets/lvcc-logo.png" alt="LVCC" class="header-logo" width="36" height="36" />
            </button>
            <div class="brand-text">
              <div class="logo-text">LVCC Assessment Portal</div>
              <div class="app-version">v1.5.8</div>
            </div>
          </div>
          <nav class="sidebar-nav">${navItems}</nav>
          <div class="sidebar-user">
            <button type="button" class="user-row" id="user-menu-btn" onclick="App.toggleUserPopover(event)">
              ${avatar}
              <div class="user-row-text">
                <div class="user-row-name">${escapeHtml(name)} <span class="role-badge ${role}">${role}</span></div>
                <div class="user-row-email">${escapeHtml(email)}</div>
              </div>
            </button>
          </div>
        </aside>
        <div class="shell-main">
          <header class="thin-bar">
            <div class="logo" style="display:flex;align-items:center;gap:0.5rem">
              <img src="assets/lvcc-logo.png" alt="LVCC" width="28" height="28" />
              <span class="thin-bar-title">LVCC Assessment Portal</span>
            </div>
            <button type="button" class="mobile-avatar-btn thin-bar-right" onclick="App.toggleNav()" aria-label="Menu" id="mobile-menu-avatar"></button>
          </header>
          <main class="main-content" id="main-content">${contentHtml}</main>
        </div>
      </div>`;
    // mobile avatar button
    const mob = document.getElementById('mobile-menu-avatar');
    if (mob) {
      mob.innerHTML = photo
        ? `<img class="user-avatar" src="${photo}" alt="" />`
        : `<span class="user-avatar user-avatar-fallback">${escapeHtml(initials)}</span>`;
    }
  },

  toggleNav() {
    if (window.innerWidth > 900) {
      document.querySelector('.shell')?.classList.toggle('nav-collapsed');
      document.body.classList.toggle('nav-collapsed');
    } else {
      document.body.classList.toggle('nav-open');
      document.querySelector('.shell')?.classList.toggle('nav-open');
    }
  },

  closeNav() {
    document.body.classList.remove('nav-open');
    document.querySelector('.shell')?.classList.remove('nav-open');
  },

  toggleUserPopover(ev) {
    ev?.stopPropagation?.();
    const existing = document.getElementById('user-popover');
    if (existing) { existing.remove(); return; }
    const btn = document.getElementById('user-menu-btn');
    const rect = btn?.getBoundingClientRect();
    const pop = document.createElement('div');
    pop.id = 'user-popover';
    pop.className = 'user-popover';
    pop.innerHTML = `
      <button type="button" class="popover-item" onclick="Theme.openSettings();document.getElementById('user-popover')?.remove()">Settings</button>
      <button type="button" class="popover-item danger" onclick="App.logout()">Logout</button>`;
    if (rect) {
      pop.style.position = 'fixed';
      pop.style.left = Math.min(rect.left, window.innerWidth - 200) + 'px';
      pop.style.bottom = (window.innerHeight - rect.top + 8) + 'px';
    }
    document.body.appendChild(pop);
    setTimeout(() => {
      const close = (e) => {
        if (!pop.contains(e.target) && e.target !== btn) {
          pop.remove();
          document.removeEventListener('click', close);
        }
      };
      document.addEventListener('click', close);
    }, 0);
  },


  showStudentJoinScreen() {
    document.getElementById('app').innerHTML = `
      <div class="join-screen">
        <div class="join-card">
          <div style="text-align:center;margin-bottom:1.25rem">
            <img src="assets/lvcc-logo.png" width="56" height="56" alt="LVCC" />
            <h1 style="font-size:1.25rem;margin-top:0.75rem">LVCC Assessment Portal</h1>
            <p class="text-muted">Enter your assessment code to begin</p>
          </div>
          <div class="join-input-wrap">
            <input id="join-code-input" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="8" placeholder="Enter the Assessment Code" />
            <button type="button" class="btn btn-primary" id="join-code-btn">Join</button>
          </div>
          <button type="button" class="btn btn-ghost join-dashboard-btn" id="join-go-dash">Go to my Dashboard</button>
        </div>
      </div>`;
    document.getElementById('join-go-dash').onclick = () => this.showDashboard();
    document.getElementById('join-code-btn').onclick = () => this.joinByAssessmentCode();
    const inp = document.getElementById('join-code-input');
    inp.oninput = () => { inp.value = inp.value.replace(/\D/g, '').slice(0, 8); };
    inp.onkeydown = (e) => { if (e.key === 'Enter') this.joinByAssessmentCode(); };
  },

  async joinByAssessmentCode(codeFromArg) {
    const raw = codeFromArg != null ? codeFromArg : (document.getElementById('join-code-input')?.value || document.getElementById('modal-join-code')?.value || '');
    const code = String(raw).replace(/\D/g, '').slice(0, 8);
    if (code.length !== 8) {
      await UI.alert('Please enter a valid 8-digit assessment code (numbers only).', 'Invalid code');
      return;
    }
    try {
      const snap = await window.db.collection('exams').where('assessmentCode', '==', code).limit(1).get();
      if (snap.empty) {
        await UI.alert('Assessment code not found.', 'Not found');
        return;
      }
      const exam = { id: snap.docs[0].id, ...snap.docs[0].data() };
      if (exam.status === 'draft' || exam.active === false) {
        await UI.alert('This assessment is not available.', 'Unavailable');
        return;
      }
      const { startAt, endAt } = Exam.getExamWindow(exam);
      const now = Date.now();
      if (now > endAt) {
        await UI.alert('This assessment has ended.', 'Closed');
        return;
      }
      if (now < startAt) {
        return this.showExamCountdown(exam, startAt);
      }
      return this.startStudentExam(exam.id);
    } catch (e) {
      console.error(e);
      await UI.alert(e.message || 'Could not join assessment.', 'Error');
    }
  },

  openJoinCodeModal() {
    document.getElementById('join-modal')?.remove();
    const wrap = document.createElement('div');
    wrap.id = 'join-modal';
    wrap.className = 'popover-overlay';
    wrap.innerHTML = `<div class="popover-card settings-card">
      <h3>Join Assessment</h3>
      <div class="join-input-wrap" style="margin-top:0.75rem">
        <input id="modal-join-code" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="8" placeholder="Enter the Assessment Code" />
        <button type="button" class="btn btn-primary" id="modal-join-btn">Join</button>
      </div>
      <button type="button" class="btn btn-ghost w-full mt-1" id="modal-join-cancel">Cancel</button>
    </div>`;
    wrap.onclick = (e) => { if (e.target === wrap) wrap.remove(); };
    document.body.appendChild(wrap);
    const inp = document.getElementById('modal-join-code');
    inp.oninput = () => { inp.value = inp.value.replace(/\D/g, '').slice(0, 8); };
    document.getElementById('modal-join-cancel').onclick = () => wrap.remove();
    document.getElementById('modal-join-btn').onclick = async () => {
      const v = inp.value;
      wrap.remove();
      await this.joinByAssessmentCode(v);
    };
  },

  async showDashboard() {
    const role = Auth.userProfile.role;
    if (role === 'student') return this.showStudentDashboard();
    if (role === 'proctor') return this.showProctorHome();
    return this.showTeacherDashboard();
  },

  async showTeacherDashboard() {
    let exams = [];
    try {
      exams = (typeof Exam.listMyExams === 'function')
        ? await Exam.listMyExams()
        : await Exam.listTeacherExams(Auth.currentUser.uid);
    } catch (e) { console.warn(e); }
    const published = exams.filter(e => e.status === 'published' || (e.active !== false && e.status !== 'draft')).length;
    const drafts = exams.filter(e => e.status === 'draft' || (e.active === false && !e.endAt)).length;
    this.renderShell(`
      <h2 class="page-title">Dashboard</h2>
      <div class="stat-grid" style="margin-top:0.5rem">
        <div class="stat-card"><div class="stat-val">${exams.length}</div><div class="stat-label">Total assessments</div></div>
        <div class="stat-card"><div class="stat-val">${published}</div><div class="stat-label">Published</div></div>
        <div class="stat-card"><div class="stat-val">${drafts}</div><div class="stat-label">Drafts</div></div>
      </div>
      <div class="card mt-2">
        <p class="text-muted">Quick actions</p>
        <div class="action-btns">
          <button class="btn btn-primary" onclick="App.showCreateExam()">New assessment</button>
          <button class="btn btn-ghost" onclick="App.showTeacherHome()">My Assessments</button>
        </div>
      </div>
    `, 'dashboard');
  },

  async showStudentDashboard() {
    let sessions = [];
    try { sessions = await Exam.listStudentSessions(Auth.currentUser.uid); } catch (_) {}
    const done = sessions.filter(s => s.status === 'submitted').length;
    const mocks = sessions.filter(s => s.isMock).length;
    const avg = (() => {
      const scored = sessions.filter(s => s.score != null);
      if (!scored.length) return '—';
      return (scored.reduce((a, s) => a + Number(s.score), 0) / scored.length).toFixed(1);
    })();
    this.renderShell(`
      <div class="page-header-with-action">
        <h2 class="page-title">Dashboard</h2>
        <button class="btn btn-primary" onclick="App.openJoinCodeModal()">Join Assessment</button>
      </div>
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-val">${done}</div><div class="stat-label">Completed</div></div>
        <div class="stat-card"><div class="stat-val">${avg}</div><div class="stat-label">Avg score</div></div>
        <div class="stat-card"><div class="stat-val">${mocks}</div><div class="stat-label">Mock attempts</div></div>
      </div>
      <div class="card mt-2">
        <div class="action-btns">
          <button class="btn btn-primary" onclick="App.showStudentHistory()">Assessments</button>
          <button class="btn btn-ghost" onclick="App.showMockHistory()">Mock History</button>
        </div>
      </div>
    `, 'dashboard');
  },


  // ---- Superadmin ----
  async showSuperAdmin() {
    this.renderShell(`
      <h2 class="page-title">Instructor Management</h2>
      <div class="card">
        <div class="form-group">
          <label>Instructor Email</label>
          <input type="email" id="teacher-email" class="form-control" placeholder="teacher@laverdad.edu.ph" />
        </div>
        <button class="btn btn-primary" id="add-teacher-btn">Add Instructor</button>
        <p id="add-teacher-msg" class="mt-1 text-muted"></p>
      </div>
      <div class="card mt-2">
        <div class="card-title">Instructors & Admins</div>
        <div id="teachers-list">Loading...</div>
      </div>
    `, 'teachers');
    document.getElementById('add-teacher-btn').onclick = async () => {
      const email = document.getElementById('teacher-email').value;
      const msg = document.getElementById('add-teacher-msg');
      try {
        const res = await Auth.addTeacher(email);
        msg.textContent = res.message; msg.style.color = 'var(--success)';
        this.loadTeachersList();
      } catch (err) {
        msg.textContent = err.message; msg.style.color = 'var(--danger)';
      }
    };
    this.loadTeachersList();
  },

  async loadTeachersList() {
    const el = document.getElementById('teachers-list');
    try {
      const teachers = await Auth.listTeachers();
      const myUid = Auth.currentUser?.uid;
      el.innerHTML = `<div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th></th></tr></thead><tbody>
        ${teachers.map(t => {
          let actions = '';
          if (t.role === 'teacher') {
            actions = `<button class="btn btn-sm btn-primary" onclick="App.makeSuperAdmin('${t.uid}')">Make Superadmin</button>
              <button class="btn btn-sm btn-danger" onclick="App.removeTeacher('${t.uid}')">Demote</button>`;
          } else if (t.role === 'superadmin' && t.uid !== myUid) {
            actions = `<button class="btn btn-sm btn-ghost" onclick="App.setRole('${t.uid}','teacher')">Make Teacher</button>`;
          } else actions = '<span class="text-muted">You</span>';
          return `<tr><td>${escapeHtml(t.name)}</td><td>${escapeHtml(t.email)}</td>
            <td><span class="role-badge ${t.role}">${t.role}</span></td><td class="action-btns">${actions}</td></tr>`;
        }).join('')}
      </tbody></table></div>`;
    } catch (err) {
      el.innerHTML = `<p style="color:var(--danger)">${escapeHtml(err.message)}</p>`;
    }
  },

  async removeTeacher(uid) {
    if (!(await UI.confirm('Demote this user to student?', 'Demote'))) return;
    await Auth.removeTeacher(uid);
    this.loadTeachersList();
  },
  async makeSuperAdmin(uid) {
    if (!(await UI.confirm('Promote to Superadmin?', 'Promote'))) return;
    await Auth.setRole(uid, 'superadmin');
    this.loadTeachersList();
  },
  async setRole(uid, role) {
    if (!(await UI.confirm('Change role to "' + role + '"?', 'Change role'))) return;
    await Auth.setRole(uid, role);
    this.loadTeachersList();
  },

  // ---- Teacher ----
  async showTeacherHome() {
    this.renderShell(`<div id="exams-container">Loading...</div>`, 'exams');
    await Dashboard.renderMyExams(document.getElementById('exams-container'));
  },

  autosaveKey() { return 'lvcc_draft_' + (Auth.currentUser?.uid || 'anon'); },
  saveAutosave() {
    try {
      const data = {
        title: document.getElementById('exam-title')?.value || '',
        subject: document.getElementById('exam-subject')?.value || '',
        examType: document.getElementById('exam-type')?.value || 'regular',
        language: document.getElementById('exam-language')?.value || 'python',
        starter: document.getElementById('exam-starter')?.value || '',
        answer: document.getElementById('exam-answer')?.value || '',
        maxScore: document.getElementById('exam-maxscore')?.value || 100,
        sections: window._builderSections || [],
        at: Date.now()
      };
      localStorage.setItem(this.autosaveKey(), JSON.stringify(data));
    } catch (_) {}
  },
  loadAutosave() {
    try {
      const raw = localStorage.getItem(this.autosaveKey());
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  },
  clearAutosave() {
    try { localStorage.removeItem(this.autosaveKey()); } catch (_) {}
  },


  /** Collect form + builder into a clean Firestore-safe payload */
  collectAssessmentForm(status = 'draft') {
    // Always sync flat list from sections
    const sections = JSON.parse(JSON.stringify(window._builderSections || []));
    const questions = sections.flatMap(s => s.questions || []);
    window._builderSections = sections;
    window._builderQuestions = questions;

    const title = (document.getElementById('exam-title')?.value || '').trim();
    const subject = (document.getElementById('exam-subject')?.value || '').trim();
    const examType = document.getElementById('exam-type')?.value || 'regular';
    const language = document.getElementById('exam-language')?.value || 'python';
    const instructions = (document.getElementById('exam-instructions')?.value || '').trim();
    const starterCode = document.getElementById('exam-starter')?.value || '';
    const answerKey = document.getElementById('exam-answer')?.value || '';
    const maxScore = examType === 'regular' ? 0 : (Number(document.getElementById('exam-maxscore')?.value) || 100);

    const payload = {
      title,
      subject: subject || 'General',
      instructions,
      examType,
      language: language === 'java' ? 'java' : 'python',
      starterCode,
      answerKey,
      maxScore,
      questions: examType === 'regular' ? questions : [],
      sections: examType === 'regular' ? sections : [],
      status: status === 'published' ? 'published' : 'draft',
      active: status === 'published'
    };
    return payload;
  },

  async saveAssessment(status = 'draft', schedule = null) {
    const payload = this.collectAssessmentForm(status);
    if (!payload.title) {
      throw new Error('Title is required.');
    }
    if (!payload.subject || payload.subject === '') {
      throw new Error('Subject is required.');
    }
    if (status === 'published' && payload.examType === 'regular' && !(payload.questions || []).length) {
      throw new Error('Add at least one question before publishing.');
    }
    if (schedule) {
      payload.startAt = schedule.startAt;
      payload.endAt = schedule.endAt;
      payload.durationMinutes = schedule.durationMinutes || Math.max(1, Math.round((schedule.endAt - schedule.startAt) / 60000));
    } else if (status === 'draft') {
      payload.startAt = payload.startAt || Date.now();
      payload.endAt = payload.endAt || (Date.now() + 3600000);
      payload.durationMinutes = payload.durationMinutes || 60;
    }

    // Strip undefined (Firestore rejects undefined)
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

    let examId = window._editingExamId;
    if (examId) {
      await Exam.updateExam(examId, payload);
    } else {
      const created = await Exam.createExam(payload);
      examId = created.id;
      window._editingExamId = examId;
    }
    this.clearAutosave();
    return examId;
  },

  async showCreateExam(opts = {}) {
    // opts.keepEditing = true when called from editExam
    if (!opts.keepEditing) window._editingExamId = null;
    window._builderSections = window._builderSections || [];
    if (!opts.keepEditing) {
      window._builderSections = [];
      window._builderQuestions = [];
    }
    if (!Auth.isTeacher()) {
      await UI.alert('Only instructors can create assessments. Students can generate mock assessments from History.', 'Access');
      this.showStudentHome();
      return;
    }
    const now = new Date();
    const later = new Date(now.getTime() + 60 * 60000);
    const toLocal = (d) => {
      const pad = n => String(n).padStart(2, '0');
      return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    };

    this.renderShell(`
      <h2 class="page-title">Create Assessment</h2>
      <div class="card">
        <div class="form-group">
          <label>Title <span style="color:var(--danger)">*</span></label>
          <input id="exam-title" class="form-control" placeholder="Assessment title" value="" />
        </div>
        <div class="form-group">
          <label>Subject <span style="color:var(--danger)">*</span></label>
          <input id="exam-subject" class="form-control" placeholder="e.g. English, Math" value="" />
        </div>
        <div class="form-group">
          <label>Exam type</label>
          <select id="exam-type" class="form-control">
            <option value="regular" selected>Regular Assessment</option>
            <option value="code">Code Assessment</option>
          </select>
        </div>
        <div class="form-group" id="lang-group">
          <label>Programming language</label>
          <select id="exam-language" class="form-control">
            <option value="python">Python</option>
            <option value="java">Java</option>
          </select>
        </div>
        <!-- Instructions are per-section when adding questions -->
        <!-- Start/end only on Publish -->
        <div class="form-group">
          <label id="maxscore-label">Max score (default 100 for code)</label>
          <input type="number" id="exam-maxscore" class="form-control" value="100" min="1" />
        </div>
        <div id="code-fields">
          <div class="form-group">
            <label>Starter code</label>
            <textarea id="exam-starter" class="form-control" rows="5" style="font-family:monospace"></textarea>
          </div>
          <div class="form-group">
            <label>Expected Output (optional)</label>
            <textarea id="exam-answer" class="form-control" rows="4" style="font-family:monospace"></textarea>
          </div>
        </div>
        <div id="regular-fields" class="hidden">
          <div class="card-title">Question sections</div>
          <div id="questions-builder" class="mt-2"></div>
        </div>
        <div class="modal-actions action-btns form-footer-actions form-footer-split">
          <div class="footer-left">
            <button class="btn btn-primary" id="add-question-footer-btn" type="button">Add Question</button>
          </div>
          <div class="footer-right">
            <button class="btn btn-ghost" onclick="App.saveAutosave();App.showTeacherHome()">Cancel</button>
            <button class="btn btn-ghost" id="draft-exam-btn">Save as Draft</button>
            <button class="btn btn-primary" id="create-exam-btn">Publish</button>
          </div>
        </div>
      </div>
    `, 'exams');

    const typeEl = document.getElementById('exam-type');
    const syncType = () => {
      const reg = typeEl.value === 'regular';
      document.getElementById('lang-group').classList.toggle('hidden', reg);
      document.getElementById('code-fields').classList.toggle('hidden', reg);
      document.getElementById('regular-fields').classList.toggle('hidden', !reg);
      const maxG = document.getElementById('exam-maxscore')?.closest('.form-group');
      if (maxG) maxG.classList.toggle('hidden', reg);
    };
    typeEl.onchange = syncType;
    syncType();

    window._builderSections = [];
    window._builderQuestions = []; // flattened for save

    const syncFlat = () => {
      window._builderQuestions = (window._builderSections || []).flatMap(s => s.questions || []);
    };

    const renderBuilder = () => {
      window._renderAssessmentBuilder = renderBuilder;
      const box = document.getElementById('questions-builder');
      const sections = window._builderSections || [];
      if (!sections.length) {
        box.innerHTML = '<p class="text-muted">No sections yet. Choose a question type below to start a section.</p>';
        return;
      }
      box.innerHTML = sections.map((sec, si) => {
        const qs = sec.questions || [];
        const qHtml = qs.map((q, qi) => {
          // global index in flat list
          const globalIdx = sections.slice(0, si).reduce((a, s) => a + (s.questions || []).length, 0) + qi;
          const typeSel = ''; // type fixed per section
          if (q.type === 'multiple' || q.type === 'multiselect') {
            return `<div class="card q-in-section" data-si="${si}" data-qi="${qi}">${Regular.renderBuilderMC(q, globalIdx)}
              <button type="button" class="btn btn-sm btn-danger mt-1" data-del-q="${si}:${qi}">Remove question</button></div>`;
          }
          if (q.type === 'truefalse' || q.type === 'modified_tf') {
            return `<div class="card q-in-section" data-si="${si}" data-qi="${qi}">${Regular.renderBuilderTF(q, globalIdx)}
              <button type="button" class="btn btn-sm btn-danger mt-1" data-del-q="${si}:${qi}">Remove question</button></div>`;
          }
          return `<div class="card q-in-section" data-si="${si}" data-qi="${qi}">
            <textarea class="form-control q-prompt" data-gidx="${globalIdx}" placeholder="Type question here" rows="2">${escapeHtml(q.prompt||'')}</textarea>
            <input class="form-control mt-1" data-correct-text="${globalIdx}" value="${escapeHtml(String(q.correct ?? ''))}" placeholder="Correct answer" />
            <label class="mt-1">Points <input type="number" class="form-control" style="width:80px;display:inline-block" data-points="${globalIdx}" value="${q.points??1}" /></label>
            <button type="button" class="btn btn-sm btn-danger mt-1" data-del-q="${si}:${qi}">Remove question</button>
          </div>`;
        }).join('');
        return `
          <div class="section-block" data-si="${si}">
            <div class="section-head">
              <h3>${escapeHtml(sec.title)}</h3>
              <button type="button" class="btn btn-sm btn-danger" data-del-sec="${si}">Remove section</button>
            </div>
            <div class="form-group">
              <label>Section instructions</label>
              <textarea class="form-control" data-sec-instr="${si}" rows="2" placeholder="Instructions for this section">${escapeHtml(sec.instructions||'')}</textarea>
            </div>
            ${qHtml}
            <button type="button" class="btn btn-ghost btn-sm" data-add-same="${si}">+ Add ${escapeHtml(sec.title)} question</button>
          </div>`;
      }).join('');

      // wire section instructions
      box.querySelectorAll('[data-sec-instr]').forEach(el => {
        el.oninput = () => { window._builderSections[Number(el.dataset.secInstr)].instructions = el.value; };
      });
      box.querySelectorAll('[data-del-sec]').forEach(el => {
        el.onclick = async () => {
          if (!(await UI.confirm('Remove this entire section and its questions?', 'Remove section'))) return;
          window._builderSections.splice(Number(el.dataset.delSec), 1);
          syncFlat(); renderBuilder();
        };
      });
      box.querySelectorAll('[data-del-q]').forEach(el => {
        el.onclick = async () => {
          if (!(await UI.confirm('Delete this question?', 'Delete question'))) return;
          const [si, qi] = el.dataset.delQ.split(':').map(Number);
          window._builderSections[si].questions.splice(qi, 1);
          syncFlat(); renderBuilder();
        };
      });
      box.querySelectorAll('[data-add-same]').forEach(el => {
        el.onclick = () => {
          const si = Number(el.dataset.addSame);
          const type = (window._builderSections[si].questions[0] || {}).type || 'multiple';
          window._builderSections[si].questions.push(Regular.newQuestion(type));
          syncFlat(); renderBuilder();
        };
      });
      // re-use global index handlers for MC/TF
      const flat = window._builderQuestions;
      box.querySelectorAll('[data-prompt]').forEach(el => {
        el.oninput = () => { const i = Number(el.dataset.prompt); if (flat[i]) flat[i].prompt = el.value; };
      });
      box.querySelectorAll('.q-prompt').forEach(el => {
        if (el.dataset.gidx !== undefined) el.oninput = () => { const i = Number(el.dataset.gidx); if (flat[i]) flat[i].prompt = el.value; };
      });
      box.querySelectorAll('[data-opt-text]').forEach(el => {
        el.oninput = () => {
          const [qi, oi] = el.dataset.optText.split(':').map(Number);
          if (flat[qi]) flat[qi].options[oi] = el.value;
        };
      });
      box.querySelectorAll('[data-correct]').forEach(el => {
        el.onclick = () => {
          const [qi, oi] = el.dataset.correct.split(':').map(Number);
          const q = flat[qi]; if (!q) return;
          if (q.multiCorrect) {
            const arr = Array.isArray(q.correct) ? q.correct.map(Number) : [];
            const idx = arr.indexOf(oi);
            if (idx >= 0) arr.splice(idx, 1); else arr.push(oi);
            q.correct = arr;
          } else q.correct = oi;
          // write back to section
          syncFlat(); renderBuilder();
        };
      });
      box.querySelectorAll('[data-del-opt]').forEach(el => {
        el.onclick = () => {
          const [qi, oi] = el.dataset.delOpt.split(':').map(Number);
          if (flat[qi]) flat[qi].options.splice(oi, 1);
          syncFlat(); renderBuilder();
        };
      });
      box.querySelectorAll('[data-add-opt]').forEach(el => {
        el.onclick = () => {
          const qi = Number(el.dataset.addOpt);
          if (flat[qi]) flat[qi].options.push('');
          syncFlat(); renderBuilder();
        };
      });
      box.querySelectorAll('[data-multi]').forEach(el => {
        el.onchange = () => {
          const qi = Number(el.dataset.multi);
          const q = flat[qi]; if (!q) return;
          const modeSel = box.querySelector(`[data-pointsmode="${qi}"]`);
          if (modeSel) q.pointsMode = modeSel.value;
          const ptsInp = box.querySelector(`[data-points="${qi}"]`);
          if (ptsInp) q.points = Number(ptsInp.value) || 1;
          q.multiCorrect = el.checked;
          q.correct = el.checked
            ? (Array.isArray(q.correct) ? q.correct : [q.correct].filter(x => x != null))
            : (Array.isArray(q.correct) ? (q.correct[0] ?? 0) : q.correct);
          if (!q.pointsMode) q.pointsMode = 'all';
          syncFlat(); renderBuilder();
        };
      });
      box.querySelectorAll('[data-pointsmode]').forEach(el => {
        el.onchange = () => { const q = flat[Number(el.dataset.pointsmode)]; if (q) q.pointsMode = el.value; };
      });
      box.querySelectorAll('[data-points]').forEach(el => {
        el.oninput = () => { const q = flat[Number(el.dataset.points)]; if (q) q.points = Number(el.value) || 1; };
      });
      box.querySelectorAll('[data-modified]').forEach(el => {
        el.oninput = () => { const q = flat[Number(el.dataset.modified)]; if (q) q.modifiedAnswer = el.value; };
      });
      box.querySelectorAll('[data-modified-alt]').forEach(el => {
        el.oninput = () => {
          const q = flat[Number(el.dataset.modifiedAlt)];
          if (q) q.modifiedAlternatives = el.value.split(',').map(s => s.trim()).filter(Boolean);
        };
      });
      box.querySelectorAll('[data-correct-text]').forEach(el => {
        el.oninput = () => { const q = flat[Number(el.dataset.correctText)]; if (q) q.correct = el.value; };
      });
    };

    const defaultSectionInstructions = (type) => ({
      multiple: 'Choose the best answer. Select the correct option.',
      truefalse: 'Select True or False for each statement.',
      modified_tf: 'Select True or False. If False, write the correct answer in the text box.',
      fill: 'Fill in each blank with the correct word or phrase.',
      essay: 'Write a complete response in the text box (max 1000 characters).',
      table: 'Fill in the blank cells in the table with the correct values.',
      passage: 'Read the passage carefully, then answer the related questions.',
      dropdown: 'Select the correct option from the dropdown.',
      match: 'Match each item on the left with the correct option on the right.',
      reorder: 'Put the items in the correct order.',
      categorize: 'Place each item into the correct category.',
      wordbox: 'Enter words related to the topic as instructed.',
    }[type] || 'Read the instructions and answer carefully.');

    const openTypePicker = async () => {
      const labels = QUESTION_TYPES.map(x => x.label + ' (' + x.id + ')').join('\n');
      // Themed modal with type buttons
      return new Promise((resolve) => {
        const root = document.getElementById('ui-modal-root') || (() => {
          const el = document.createElement('div'); el.id = 'ui-modal-root'; document.body.appendChild(el); return el;
        })();
        root.innerHTML = `<div class="modal-overlay ui-modal-overlay"><div class="modal ui-modal modal-wide">
          <h2>Select question type</h2>
          <div class="type-picker type-picker-modal type-cards type-grid-4x4">${QUESTION_TYPES.map(x =>
            `<button type="button" class="type-card" data-type="${x.id}"><span class="type-card-label">${escapeHtml(x.label)}</span></button>`
          ).join('')}</div>
          <div class="modal-actions"><button class="btn btn-ghost" id="type-cancel">Cancel</button></div>
        </div></div>`;
        root.querySelector('#type-cancel').onclick = () => { UI.close(); resolve(null); };
        root.querySelectorAll('.type-card, .type-pick').forEach(btn => {
          btn.onclick = () => { const type = btn.dataset.type; UI.close(); resolve(type); };
        });
      });
    };

    const addSectionOfType = (type) => {
      if (!type) return;
      const label = (QUESTION_TYPES.find(x => x.id === type) || { label: type }).label;
      const sec = Regular.newSection(label);
      sec.instructions = defaultSectionInstructions(type);
      const q = Regular.newQuestion(type);
      if (type === 'essay') {
        q.caption = q.caption || 'Note: Essay scores may be adjusted by your teacher based on a personal assessment of your response, as essays may not be fully auto-graded.';
      }
      sec.questions.push(q);
      window._builderSections.push(sec);
      syncFlat();
      renderBuilder();
    };

    // Fresh create by default — no restore prompt
    if (!window._editingExamId) {
      window._builderSections = [];
      window._builderQuestions = [];
      this.clearAutosave();
    }
    clearInterval(window._autosaveIv);
    window._autosaveIv = setInterval(() => this.saveAutosave(), 4000);
    window.addEventListener('beforeunload', () => this.saveAutosave());

    document.getElementById('add-question-footer-btn').onclick = async () => {
      const type = await openTypePicker();
      addSectionOfType(type);
    };


    const buildPayload = (status) => {
      const title = document.getElementById('exam-title').value.trim();
      const instructions = (document.getElementById('exam-instructions')?.value || '').trim();
      const examType = document.getElementById('exam-type').value;
      const language = document.getElementById('exam-language').value;
      const subject = document.getElementById('exam-subject').value.trim() || 'General';
      const startAt = document.getElementById('exam-start')?.value || '';
      const endAt = document.getElementById('exam-end')?.value || '';
      const maxScore = examType === 'regular' ? 0 : (Number(document.getElementById('exam-maxscore').value) || 100);
      return { title, instructions, examType, language, subject, startAt, endAt, maxScore, status };
    };

    document.getElementById('draft-exam-btn').onclick = async () => {
      const btn = document.getElementById('draft-exam-btn');
      const pub = document.getElementById('create-exam-btn');
      try {
        if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
        if (pub) pub.disabled = true;
        const id = await this.saveAssessment('draft');
        await UI.alert('Assessment has been saved as draft.', 'Draft saved');
        window._editingExamId = null;
        this.showTeacherHome();
      } catch (err) {
        console.error(err);
        await UI.alert(err.message || String(err), 'Could not save draft');
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Save draft'; }
        if (pub) pub.disabled = false;
      }
    };

    document.getElementById('create-exam-btn').onclick = async () => {
      const btn = document.getElementById('create-exam-btn');
      const draft = document.getElementById('draft-exam-btn');
      try {
        // Validate before schedule popup
        const preview = this.collectAssessmentForm('published');
        if (!preview.title) { await UI.alert('Title is required.', 'Missing fields'); return; }
        if (!preview.subject) { await UI.alert('Subject is required.', 'Missing fields'); return; }
        if (preview.examType === 'regular' && !(preview.questions || []).length) {
          await UI.alert('Add at least one question before publishing.', 'No questions');
          return;
        }
        const sched = await this.pickSchedule();
        if (!sched) return;
        if (btn) { btn.disabled = true; btn.textContent = 'Publishing…'; }
        if (draft) draft.disabled = true;
        const id = await this.saveAssessment('published', sched);
        window._editingExamId = null;
        await UI.alert('Assessment published.', 'Published');
        this.showSharePanel(id);
      } catch (err) {
        console.error(err);
        await UI.alert(err.message || String(err), 'Could not publish');
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Publish'; }
        if (draft) draft.disabled = false;
      }
    };
  },

  async copyExamLink(examId) {
    const url = `${window.location.origin}${window.location.pathname}?exam=${examId}`;
    try {
      await navigator.clipboard.writeText(url);
      await UI.alert('Assessment link copied to clipboard.', 'Share');
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = url; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (__) {}
      ta.remove();
      await UI.alert('Assessment link copied to clipboard.', 'Share');
    }
  },

  async showSharePanel(examId) {
    const exam = await Exam.getExam(examId);
    const code = exam?.assessmentCode || examId.slice(0, 8);
    const url = `${window.location.origin}${window.location.pathname}?exam=${examId}`;
    const qr = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(url);
    this.renderShell(`
      <h2 class="page-title">Share assessment</h2>
      <div class="card share-panel">
        <p class="text-muted" style="text-align:center">Assessment ID</p>
        <div class="share-id-big">${escapeHtml(String(code))}</div>
        <div style="text-align:center;margin:1rem 0">
          <img src="${qr}" alt="QR code" width="220" height="220" style="border-radius:12px;background:#fff;padding:8px" />
        </div>
        <p class="text-muted">Students can join with the Assessment ID or open this link while signed in.</p>
        <div class="form-group">
          <label>Link</label>
          <input class="form-control" id="share-url" readonly value="${url.replace(/"/g, '&quot;')}" />
        </div>
        <div class="action-btns">
          <button class="btn btn-primary" id="copy-share-link">Copy link</button>
          <button class="btn btn-ghost" onclick="App.showTeacherHome()">Done</button>
        </div>
      </div>
    `, 'exams');
    document.getElementById('copy-share-link').onclick = () => {
      navigator.clipboard.writeText(url).then(() => UI.alert('Link copied.', 'Share')).catch(() => {});
    };
    // auto-copy
    try { navigator.clipboard.writeText(url); } catch (_) {}
  },

  async shareToCoTeacher(examId) {
    const email = await UI.prompt('Co-teacher email (La Verdad account):', '', 'Share to Co-teacher');
    if (!email) return;
    try {
      const exam = await Exam.getExam(examId);
      if (!exam) throw new Error('Assessment not found');
      const { id, createdAt, updatedAt, teacherId, teacherEmail, teacherName, proctors, ...rest } = exam;
      // Store pending share — co-teacher claims on login / list
      await window.db.collection('pendingShares').add({
        sourceExamId: examId,
        toEmail: email.trim().toLowerCase(),
        fromTeacherId: Auth.currentUser.uid,
        fromTeacherEmail: Auth.userProfile.email,
        snapshot: rest,
        title: (exam.title || 'Assessment') + ' (shared)',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      // If co-teacher already has user account, create their copy now
      const q = await window.db.collection('users').where('email', '==', email.trim().toLowerCase()).limit(1).get();
      if (!q.empty) {
        const uid = q.docs[0].id;
        const now = Date.now();
        await Exam.createExam({
          ...rest,
          title: (exam.title || 'Assessment') + ' (Copy)',
          startAt: now,
          endAt: now + (Number(rest.durationMinutes) || 60) * 60000
        });
        // createExam uses current user as teacher — need direct write for co-teacher
        // Fix: write exam under co-teacher id
        const ref = window.db.collection('exams').doc();
        await ref.set({
          ...rest,
          title: (exam.title || 'Assessment') + ' (Copy)',
          teacherId: uid,
          teacherEmail: email.trim().toLowerCase(),
          teacherName: q.docs[0].data().name || email,
          proctors: [],
          startAt: now,
          endAt: now + (Number(rest.durationMinutes) || 60) * 60000,
          active: true,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
      await UI.alert('Shared with co-teacher. They will see a fresh copy to configure.', 'Shared');
    } catch (e) {
      await UI.alert(e.message || String(e), 'Error');
    }
  },

  async deleteExam(examId, title) {
    const typed = await UI.prompt('Type the assessment name to confirm deletion:\n\n' + title, '', 'Delete assessment');
    if (typed === null) return;
    if (typed.trim() !== title.trim()) {
      await UI.alert('Name did not match. Deletion cancelled.', 'Delete');
      return;
    }
    if (!(await UI.confirm('Permanently delete this assessment?', 'Delete'))) return;
    try {
      await Exam.deleteExam(examId);
      await UI.alert('Assessment deleted.', 'Deleted');
      this.showTeacherHome();
    } catch (e) {
      await UI.alert(e.message || String(e), 'Error');
    }
  },


  async openManageMenu(examId) {
    const choice = await UI.prompt('Type: edit | duplicate | delete | close | reopen | publish', 'edit', 'Manage', 'edit');
    if (choice == null) return;
    const c = String(choice).trim().toLowerCase();
    if (c === 'edit') return this.editExam(examId);
    if (c === 'duplicate') return this.duplicateExam(examId);
    if (c === 'delete') {
      const ex = await Exam.getExam(examId);
      return this.deleteExam(examId, ex?.title || '');
    }
    if (c === 'publish') return this.publishDraft(examId);
    if (c === 'close') return this.toggleExamActive(examId, false);
    if (c === 'reopen') return this.toggleExamActive(examId, true);
    await UI.alert('Unknown action. Use edit, duplicate, delete, publish, close, or reopen.', 'Manage');
  },

  async openMonitorMenu(examId, live) {
    const choice = await UI.prompt('Type: live | integrity | results | test', live ? 'live' : 'results', 'Monitor', 'live');
    if (choice == null) return;
    const c = String(choice).trim().toLowerCase();
    if (c === 'live') return this.openLiveDashboard(examId);
    if (c === 'integrity') return this.showIntegrityHistory(examId);
    if (c === 'results') return this.showExamResults(examId);
    if (c === 'test') return this.testAsStudent(examId);
    await UI.alert('Unknown. Use live, integrity, results, or test.', 'Monitor');
  },

  async openShareMenu(examId) {
    const choice = await UI.prompt('Type: link | invite | coteacher | proctors', 'link', 'Share', 'link');
    if (choice == null) return;
    const c = String(choice).trim().toLowerCase();
    if (c === 'link' || c === 'qr') return this.showSharePanel(examId);
    if (c === 'invite') return this.showExamInvites(examId);
    if (c === 'coteacher' || c === 'co-teacher') return this.shareToCoTeacher(examId);
    if (c === 'proctors') return this.showProctors(examId);
    await UI.alert('Unknown. Use link, invite, coteacher, or proctors.', 'Share');
  },

  async editExam(examId) {
    window._editingExamId = examId;
    const exam = await Exam.getExam(examId);
    if (!exam) { await UI.alert('Assessment not found.', 'Error'); return; }

    // Open builder UI first
    await this.showCreateExam({ keepEditing: true });

    // Prefill after DOM is ready
    const apply = () => {
      const set = (id, val) => {
        const el = document.getElementById(id);
        if (el && val != null) el.value = val;
      };
      set('exam-title', exam.title || '');
      set('exam-subject', exam.subject || '');
      set('exam-type', exam.examType || 'regular');
      document.getElementById('exam-type')?.dispatchEvent(new Event('change'));
      set('exam-language', exam.language || 'python');
      set('exam-starter', exam.starterCode || '');
      set('exam-answer', exam.answerKey || '');
      set('exam-maxscore', exam.maxScore != null ? exam.maxScore : 100);

      // Load sections / questions into builder state
      let sections = [];
      if (exam.sections && exam.sections.length) {
        sections = JSON.parse(JSON.stringify(exam.sections));
      } else if (exam.questions && exam.questions.length) {
        sections = [{
          id: 's1',
          title: 'Questions',
          instructions: exam.instructions || '',
          questions: JSON.parse(JSON.stringify(exam.questions))
        }];
      }
      window._builderSections = sections;
      window._builderQuestions = sections.flatMap(s => s.questions || []);

      // Trigger builder re-render (showCreateExam defined renderBuilder in closure — call via Add Question path)
      // Expose last renderBuilder
      if (typeof window._renderAssessmentBuilder === 'function') {
        window._renderAssessmentBuilder();
      } else {
        // Fallback: click path - re-open create is not enough; inject HTML summary
        const box = document.getElementById('questions-builder');
        if (box) {
          box.innerHTML = window._builderQuestions.length
            ? `<p class="text-muted">${window._builderQuestions.length} question(s) loaded. Use Add Question to continue editing, then Save draft or Publish.</p>` +
              window._builderQuestions.map((q, i) =>
                `<div class="card mt-1"><strong>Q${i+1} (${escapeHtml(q.type||'')})</strong><div>${escapeHtml(q.prompt||'')}</div></div>`
              ).join('')
            : '<p class="text-muted">No questions yet</p>';
        }
      }

      const titleEl = document.querySelector('.page-title');
      if (titleEl) titleEl.textContent = 'Edit Assessment';

      // Ensure buttons still use unified save (showCreateExam already wired them)
      const draftBtn = document.getElementById('draft-exam-btn');
      const pubBtn = document.getElementById('create-exam-btn');
      if (draftBtn) draftBtn.textContent = 'Save draft';
      if (pubBtn) pubBtn.textContent = exam.status === 'published' ? 'Save & Publish' : 'Publish';
    };
    setTimeout(apply, 100);
  },

  async toggleExamActiveduplicateExam(examId) {
    if (!(await UI.confirm('Duplicate this assessment? You can set a new schedule next.', 'Duplicate'))) return;
    const start = await UI.prompt('New start (YYYY-MM-DDTHH:MM) or leave blank for now:', '', 'Duplicate');
    const mins = await UI.prompt('Duration in minutes:', '60', 'Duplicate');
    const startAt = start || new Date().toISOString();
    const endAt = new Date(new Date(startAt).getTime() + (Number(mins) || 60) * 60000).toISOString();
    try {
      const exam = await Exam.duplicateExam(examId, { startAt, endAt, durationMinutes: Number(mins) || 60 });
      await UI.alert('Duplicated: ' + exam.title);
      this.showTeacherHome();
    } catch (e) { await UI.alert(e.message || String(e), 'Error'); }
  },

  openLiveDashboard(examId) {
    this.renderShell(`
      <div class="card-header page-header-responsive">
        <h2 class="page-title">Live dashboard</h2>
        <button class="btn btn-ghost" onclick="App.showTeacherHome()">Back</button>
      </div>
      <div id="live-container"></div>
    `, 'exams');
    const el = document.getElementById('live-container');
    if (!el) { UI.alert('Live container missing.', 'Error'); return; }
    try {
      Dashboard.renderLiveDashboard(el, examId, null);
    } catch (e) {
      console.error(e);
      el.innerHTML = `<div class="card"><p style="color:var(--danger)">${escapeHtml(e.message || String(e))}</p></div>`;
    }
  },

  async showExamInvites(examId) {
    const exam = await Exam.getExam(examId);
    this.renderShell(`
      <h2 class="page-title">Invite to: ${escapeHtml(exam?.title || '')}</h2>
      <p class="page-subtitle">Personal emails invited here can only take this exam.</p>
      <div class="card">
        <div class="form-group"><label>Email</label>
          <input id="invite-email" class="form-control" placeholder="student@gmail.com" /></div>
        <button class="btn btn-primary" id="invite-btn">Invite</button>
        <button class="btn btn-ghost" onclick="App.showTeacherHome()">Back</button>
        <p id="invite-msg" class="mt-1 text-muted"></p>
      </div>
      <div class="card mt-2"><div id="invites-list">Loading...</div></div>
    `, 'exams');
    document.getElementById('invite-btn').onclick = async () => {
      try {
        const res = await Auth.inviteStudentToExam(examId, exam?.title, document.getElementById('invite-email').value);
        document.getElementById('invite-msg').textContent = res.message;
        this.loadExamInvitesList(examId);
      } catch (e) {
        document.getElementById('invite-msg').textContent = e.message;
      }
    };
    this.loadExamInvitesList(examId);
  },

  async loadExamInvitesList(examId) {
    const el = document.getElementById('invites-list');
    const invites = await Auth.listExamInvites(examId);
    el.innerHTML = invites.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Email</th><th></th></tr></thead><tbody>
      ${invites.map(i => `<tr><td>${escapeHtml(i.email)}</td>
        <td><button class="btn btn-sm btn-danger" onclick="App.removeExamInvite('${examId}','${escapeHtml(i.email)}')">Remove</button></td></tr>`).join('')}
    </tbody></table></div>` : '<p class="text-muted">No invites.</p>';
  },

  async removeExamInvite(examId, email) {
    if (!(await UI.confirm('Remove this invite?', 'Remove invite'))) return;
    await Auth.removeExamInvite(examId, email);
    this.loadExamInvitesList(examId);
  },

  async showProctors(examId) {
    const exam = await Exam.getExam(examId);
    this.renderShell(`
      <h2 class="page-title">Proctors — ${escapeHtml(exam?.title || '')}</h2>
      <p class="page-subtitle">Assign emails as temporary proctors. Students are distributed evenly. Access ends when the exam ends.</p>
      <div class="card">
        <div class="form-group">
          <label>Proctor emails (comma-separated)</label>
          <textarea id="proctor-emails" class="form-control" rows="3" placeholder="a@laverdad.edu.ph, b@laverdad.edu.ph">${escapeHtml((exam.proctors||[]).map(p=>p.email).join(', '))}</textarea>
        </div>
        <div class="action-btns">
          <button class="btn btn-primary" id="save-proctors">Save & distribute</button>
          <button class="btn btn-ghost" onclick="App.showTeacherHome()">Back</button>
        </div>
        <p id="proctor-msg" class="mt-1 text-muted"></p>
      </div>
      <div class="card mt-2" id="proctor-list"></div>
    `, 'exams');
    document.getElementById('save-proctors').onclick = async () => {
      const raw = document.getElementById('proctor-emails').value;
      const emails = raw.split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
      try {
        const proctors = await Exam.setProctors(examId, emails);
        document.getElementById('proctor-msg').textContent = 'Saved. ' + proctors.length + ' proctor(s).';
        this.renderProctorList(proctors);
      } catch (e) {
        document.getElementById('proctor-msg').textContent = e.message;
      }
    };
    this.renderProctorList(exam.proctors || []);
  },

  renderProctorList(proctors) {
    const el = document.getElementById('proctor-list');
    if (!el) return;
    el.innerHTML = proctors.length ? proctors.map(p =>
      `<div class="card"><strong>${escapeHtml(p.email)}</strong>
        <div class="text-muted">Assigned students: ${(p.studentIds||[]).length}</div></div>`
    ).join('') : '<p class="text-muted">No proctors assigned.</p>';
  },

  // ---- Proctor home ----
  async showProctorHome() {
    const assignments = Auth.proctorAssignments || await Auth.resolveProctorState(Auth.currentUser);
    this.renderShell(`
      <h2 class="page-title">Proctor assignments</h2>
      <p class="page-subtitle">You only see students assigned to you. Access ends when the exam ends.</p>
      <div id="proctor-exams"></div>
    `, 'proctor');
    const el = document.getElementById('proctor-exams');
    if (!assignments.length) {
      el.innerHTML = '<div class="empty-state">No active proctor assignments.</div>';
      return;
    }
    el.innerHTML = assignments.map(a => `
      <div class="card">
        <strong>${escapeHtml(a.examTitle || a.examId)}</strong>
        <div class="text-muted">Students assigned: ${(a.studentIds||[]).length}</div>
        <button class="btn btn-primary mt-1" onclick="App.openProctorLive('${a.examId}')">Open live view</button>
      </div>`).join('');
  },

  openProctorLive(examId) {
    const a = (Auth.proctorAssignments || []).find(x => x.examId === examId);
    this.renderShell(`<div id="live-container"></div>`, 'proctor');
    Dashboard.renderLiveDashboard(document.getElementById('live-container'), examId, a?.studentIds || []);
  },

  // ---- Student ----
  showStudentHome() {
    document.getElementById('student-chat-fab')?.remove();
    if (this._sessionWatchUnsub) { try { this._sessionWatchUnsub(); } catch(_){} this._sessionWatchUnsub = null; }
    this.renderShell(`
      <h2 class="page-title">Student Portal</h2>
      <p class="page-subtitle">Open the assessment link shared by your teacher. You cannot create new assessments — only mock practice from your history.</p>
      <div class="card">
        <div class="action-btns">
          <button class="btn btn-primary" onclick="App.showStudentHistory()">📚 Assessment History</button>
          <button class="btn btn-ghost" onclick="App.showMockExam()">🎲 Mock History</button>
        </div>
      </div>
      <div class="card mt-2">
        <h3>Results overview</h3>
        <p class="text-muted">Charts per subject will appear here as you complete assessments.</p>
        <div id="student-results-dash" class="text-muted">Complete assessments to see your progress.</div>
      </div>
    `, 'student');
  },

  async showStudentHistory() {
    this._mockSelectMode = false;
    this.renderShell(`
      <h2 class="page-title">Assessment History</h2>
      <div class="hist-section">
        <div class="hist-head-grid">
          <h3 style="margin:0">Code assessments</h3>
          <div class="hist-filter-row" style="display:contents">
            <input type="search" id="hist-filter-code" class="form-control" placeholder="Filter code assessments..." />
            <button type="button" class="btn btn-primary" id="mock-from-code">Create mock exam</button>
          </div>
        </div>
        <div id="hist-code" class="table-wrap mt-2"><p class="text-muted" style="text-align:left">Loading…</p></div>
      </div>
      <div class="hist-section mt-2">
        <div class="hist-head-grid">
          <h3 style="margin:0">Regular assessments</h3>
          <div class="hist-filter-row" style="display:contents">
            <input type="search" id="hist-filter-reg" class="form-control" placeholder="Filter regular assessments..." />
            <button type="button" class="btn btn-primary" id="mock-from-reg">Create mock exam</button>
          </div>
        </div>
        <div id="hist-reg" class="table-wrap mt-2">Loading...</div>
      </div>
    `, 'history');

    const sessions = (await Exam.listStudentSessions(Auth.currentUser.uid)).filter(s => !s.isMock);
    window._histSessions = sessions;

    const renderTables = () => {
      const qCode = (document.getElementById('hist-filter-code')?.value || '').toLowerCase();
      const qReg = (document.getElementById('hist-filter-reg')?.value || '').toLowerCase();
      const code = sessions.filter(s => (s.examType || 'code') === 'code');
      const reg = sessions.filter(s => (s.examType || '') === 'regular');
      const showCb = this._mockSelectMode;

      const table = (list, filter) => {
        const filtered = list.filter(s => {
          const title = (s.examTitle || s.subject || '').toLowerCase();
          return !filter || title.includes(filter) || (s.subject || '').toLowerCase().includes(filter);
        });
        if (!filtered.length) return '<p class="text-muted" style="text-align:left">No assessments in this section.</p>';
        return `<table class="table" style="text-align:left"><thead><tr>
          ${showCb ? '<th class="mock-pick-col"></th>' : ''}
          <th>Title</th><th>Subject</th><th>Total</th><th>Correct</th><th>Incorrect</th><th>Unattempted</th><th>Submitted</th>
        </tr></thead><tbody>${filtered.map(s => {
          const title = s.examTitle || s.subject || 'Assessment';
          const st = App.computeAttemptStats(s, null);
          return `<tr class="hist-row" data-open="${s.id}">
            ${showCb ? `<td class="mock-pick-col" onclick="event.stopPropagation()"><input type="checkbox" class="mock-pick" data-sid="${s.id}" data-eid="${s.examId||''}" /></td>` : ''}
            <td>${escapeHtml(title)}</td>
            <td>${escapeHtml(s.subject || '—')}</td>
            <td>${st.total}</td>
            <td>${st.correct}</td>
            <td>${st.incorrect}</td>
            <td>${st.unattempted}</td>
            <td>${s.submittedAt?.toDate ? s.submittedAt.toDate().toLocaleString() : '—'}</td>
          </tr>`;
        }).join('')}</tbody></table>`;
      };

      document.getElementById('hist-code').innerHTML = table(code, qCode);
      document.getElementById('hist-reg').innerHTML = table(reg, qReg);
      document.querySelectorAll('tr.hist-row[data-open]').forEach(tr => {
        tr.onclick = () => App.showStudentAttempt(tr.getAttribute('data-open'));
      });
    };

    renderTables();
    document.getElementById('hist-filter-code').oninput = renderTables;
    document.getElementById('hist-filter-reg').oninput = renderTables;

    const startMockFlow = async (type) => {
      if (!this._mockSelectMode) {
        this._mockSelectMode = true;
        renderTables();
        await UI.alert('Select assessments with the checkboxes, then click Create mock exam again.', 'Select assessments');
        return;
      }
      const boxes = [...document.querySelectorAll('.mock-pick:checked')].filter(cb => {
        const s = sessions.find(x => x.id === cb.getAttribute('data-sid'));
        if (!s) return false;
        return type === 'code' ? (s.examType || 'code') === 'code' : (s.examType || '') === 'regular';
      });
      if (!boxes.length) {
        await UI.alert('Select at least one assessment.', 'Mock exam');
        return;
      }
      const name = await UI.prompt('Mock exam name:', 'My mock exam', 'Mock exam', 'Name');
      if (name == null) return;
      const mins = await UI.prompt('Time limit (minutes):', '30', 'Mock exam', 'Minutes');
      if (mins == null) return;
      await this.startMockFromSessions(boxes.map(b => b.getAttribute('data-sid')), type, {
        title: String(name).trim() || 'Mock exam',
        durationMinutes: Math.max(5, Number(mins) || 30)
      });
    };
    document.getElementById('mock-from-code').onclick = () => startMockFlow('code');
    document.getElementById('mock-from-reg').onclick = () => startMockFlow('regular');
  },

  async showMockHistory() {
    this.renderShell(`
      <h2 class="page-title">Mock History</h2>
      <div id="mock-hist-table" class="table-wrap">Loading...</div>
    `, 'mock');
    let sessions = [];
    try { sessions = (await Exam.listStudentSessions(Auth.currentUser.uid)).filter(s => s.isMock === true); } catch (_) {}
    const el = document.getElementById('mock-hist-table');
    if (!sessions.length) {
      el.innerHTML = '<p class="text-muted" style="text-align:left">No mock assessments yet. Create one from Assessments.</p>';
      return;
    }
    el.innerHTML = `<table class="table" style="text-align:left"><thead><tr>
      <th>Title</th><th>Subject</th><th>Score</th><th>Max</th><th>Time taken</th><th></th>
    </tr></thead><tbody>${sessions.map(s => {
      const mins = s.durationMs ? Math.round(s.durationMs / 60000) : (s.timeTakenMinutes != null ? s.timeTakenMinutes : '—');
      return `<tr>
        <td>${escapeHtml(s.examTitle || 'Mock')}</td>
        <td>${escapeHtml(s.subject || '—')}</td>
        <td>${s.score != null ? s.score : '—'}</td>
        <td>${s.maxScore != null ? s.maxScore : '—'}</td>
        <td>${mins}${mins !== '—' ? ' min' : ''}</td>
        <td>
          <button class="btn btn-sm btn-ghost" onclick="App.showStudentAttempt('${s.id}')">View</button>
          <button class="btn btn-sm btn-primary" onclick="App.retakeMock('${s.id}')">Retake</button>
        </td>
      </tr>`;
    }).join('')}</tbody></table>`;
  },

  async startMockFromSessions(sessionIds, type, opts = {}) {
    const allQ = [];
    for (const sid of sessionIds) {
      const snap = await window.db.collection('sessions').doc(sid).get();
      if (!snap.exists) continue;
      const s = snap.data();
      let qs = s.questionsSnapshot || [];
      if (!qs.length && s.examId) {
        const exam = await Exam.getExam(s.examId);
        if (exam) qs = Regular.flattenQuestions(exam);
      }
      qs.forEach(q => allQ.push({ ...q }));
    }
    if (!allQ.length) {
      await UI.alert('No questions found in the selected assessments.', 'Mock exam');
      return;
    }
    for (let i = allQ.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allQ[i], allQ[j]] = [allQ[j], allQ[i]];
    }
    const mockExam = {
      id: 'mock_' + Date.now(),
      title: opts.title || 'Mock exam',
      examType: type === 'code' ? 'code' : 'regular',
      subject: 'Mock',
      sections: [{ id: 'm1', title: 'Mock', instructions: 'Practice mock — randomized from your history.', questions: allQ }],
      questions: allQ,
      durationMinutes: opts.durationMinutes || Math.max(30, allQ.length * 2)
    };
    const sessionLocal = {
      id: 'mock_' + Date.now(),
      examId: mockExam.id,
      exam: mockExam,
      answers: {},
      status: 'active',
      isMock: true,
      examTitle: mockExam.title,
      examType: mockExam.examType,
      subject: 'Mock',
      endsAt: Date.now() + mockExam.durationMinutes * 60000,
      studentId: Auth.currentUser.uid,
      studentEmail: Auth.userProfile.email,
      studentName: Auth.userProfile.name || '',
      questionsSnapshot: allQ,
      maxScore: allQ.reduce((s, q) => s + (Number(q.points) || 1), 0)
    };
    // Persist so Mock History can list it
    try {
      const ref = await window.db.collection('sessions').add({
        ...sessionLocal,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        startedAt: Date.now()
      });
      sessionLocal.id = ref.id;
    } catch (e) {
      console.warn('mock persist', e);
    }
    window._testMode = true;
    window._mockSessionMeta = { questions: allQ, type: mockExam.examType };
    if (mockExam.examType === 'regular') return this.startRegularExam(sessionLocal);
    return this.startCodeExam(sessionLocal);
  },

  async retakeMock(sessionId) {
    const snap = await window.db.collection('sessions').doc(sessionId).get();
    if (!snap.exists) {
      // local-only mock may not be in DB — rebuild from meta if needed
      await UI.alert('Could not load that mock. Create a new mock from history.', 'Retake');
      return;
    }
    const s = snap.data();
    let qs = s.questionsSnapshot || [];
    if (!qs.length) {
      await UI.alert('No questions stored for this mock.', 'Retake');
      return;
    }
    for (let i = qs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [qs[i], qs[j]] = [qs[j], qs[i]];
    }
    await this.startMockFromSessions([sessionId], s.examType || 'regular');
  },




  async ensureJsPdf() {
    const pick = () => {
      if (window.jspdf && window.jspdf.jsPDF) return window.jspdf.jsPDF;
      if (window.jspdf && typeof window.jspdf === 'function') return window.jspdf;
      if (window.jsPDF) return window.jsPDF;
      return null;
    };
    let Ctor = pick();
    if (Ctor) return Ctor;
    const urls = [
      'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
      'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
      'https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js'
    ];
    for (const url of urls) {
      try {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = url;
          s.async = true;
          s.onload = () => resolve();
          s.onerror = () => reject(new Error('load fail'));
          document.head.appendChild(s);
        });
        Ctor = pick();
        if (Ctor) return Ctor;
      } catch (_) {}
    }
    throw new Error('PDF library not available');
  },

  computeAttemptStats(session, exam) {
    if (session && session.totalQuestions != null && session.correctCount != null) {
      const total = Number(session.totalQuestions) || 0;
      const correct = Number(session.correctCount) || 0;
      const incorrect = Number(session.incorrectCount) || 0;
      const unattempted = Number(session.unattemptedCount) != null ? Number(session.unattemptedCount) : Math.max(0, total - correct - incorrect);
      return { total, correct, incorrect, unattempted, accuracy: total ? Math.round((correct / total) * 100) : (session.accuracy || 0) };
    }
    const questions = session.questionsSnapshot?.length
      ? session.questionsSnapshot
      : (exam ? (typeof Regular.flattenQuestions === 'function' ? Regular.flattenQuestions(exam) : (exam.questions || [])) : []);
    const answers = session.answers || {};
    let correct = 0, incorrect = 0, unattempted = 0, total = questions.length;
    if (!total && session.code != null) {
      // code assessment single item
      total = 1;
      if (session.status === 'submitted') {
        if (session.score != null && session.maxScore) {
          correct = session.score >= session.maxScore ? 1 : 0;
          incorrect = correct ? 0 : 1;
        } else {
          unattempted = session.code ? 0 : 1;
          incorrect = session.code ? 1 : 0;
        }
      }
      return { total, correct, incorrect, unattempted, accuracy: total ? Math.round((correct / total) * 100) : 0 };
    }
    questions.forEach(q => {
      const resp = answers[q.id];
      const empty = resp === undefined || resp === null || resp === '' || (Array.isArray(resp) && !resp.length);
      if (empty) { unattempted++; return; }
      if (q.type === 'essay') { unattempted++; return; } // essay not auto-scored as correct
      try {
        const g = Regular.gradeAnswers([q], { [q.id]: resp });
        if ((g.score || 0) >= (g.maxScore || 1)) correct++;
        else incorrect++;
      } catch (_) {
        incorrect++;
      }
    });
    const accuracy = total ? Math.round((correct / total) * 100) : 0;
    return { total, correct, incorrect, unattempted, accuracy };
  },

  formatAnswerDisplay(q, value, isCorrectKey = false) {
    if (!q) return '—';
    const rawOpts = q.options || [];
    const opts = rawOpts.map((o) => (o == null ? '' : String(o).trim()));
    const labelAt = (i) => {
      if (i === true || i === 'true') return 'True';
      if (i === false || i === 'false') return 'False';
      const n = Number(i);
      if (!Number.isNaN(n) && n >= 0 && n < rawOpts.length) {
        const s = opts[n];
        if (s) return s;
        return String(rawOpts[n] ?? '') || ('Choice ' + (n + 1));
      }
      if (i != null && i !== '') return String(i);
      return '—';
    };
    if (isCorrectKey) {
      if (q.type === 'essay') return '(Evaluated by instructor)';
      if (q.type === 'multiple' || q.type === 'dropdown' || q.type === 'multiselect') {
        if (q.multiCorrect === true && Array.isArray(q.correct)) {
          return q.correct.map(labelAt).filter(Boolean).join(', ') || '—';
        }
        if (q.correct === undefined || q.correct === null || q.correct === '') return '—';
        return labelAt(q.correct);
      }
      if (q.type === 'truefalse' || q.type === 'modified_tf') {
        let s = (Number(q.correct) === 0 || q.correct === true || q.correct === 'true') ? 'True' : 'False';
        if (q.modifiedAnswer) s += ' · ' + q.modifiedAnswer;
        return s;
      }
      if (q.type === 'fill') {
        if (Array.isArray(q.blanks) && q.blanks.length) {
          return q.blanks.map((b, i) => {
            const c = Array.isArray(b.correct) ? b.correct.filter(Boolean).join('/') : (b.correct || '');
            return 'Blank ' + (i + 1) + ': ' + (c || '—');
          }).join(' · ');
        }
        return q.correct != null && q.correct !== '' ? String(q.correct) : '—';
      }
      if (q.correct != null && q.correct !== '') {
        return typeof q.correct === 'object' ? JSON.stringify(q.correct) : String(q.correct);
      }
      return '—';
    }
    if (value === undefined || value === null || value === '') return '—';
    if (q.type === 'essay') return String(value);
    if (q.type === 'multiple' || q.type === 'dropdown' || q.type === 'multiselect') {
      if (Array.isArray(value)) return value.map(labelAt).join(', ') || '—';
      return labelAt(value);
    }
    if (q.type === 'truefalse' || q.type === 'modified_tf') {
      if (typeof value === 'object') {
        let s = (Number(value.choice) === 0 || value.choice === true || value.choice === 'true') ? 'True' : 'False';
        if (value.modified) s += ' · ' + value.modified;
        return s;
      }
      return (value == 0 || value === true || value === 'true') ? 'True'
        : (value == 1 || value === false || value === 'false') ? 'False' : String(value);
    }
    if (typeof value === 'object') {
      try { return JSON.stringify(value); } catch (_) { return String(value); }
    }
    return String(value);
  },

  async showStudentAttempt(sessionId) {
    const snap = await window.db.collection('sessions').doc(sessionId).get();
    if (!snap.exists) { await UI.alert('Not found.', 'Error'); return; }
    const session = { id: snap.id, ...snap.data() };
    const exam = await Exam.getExam(session.examId);
    let questions = [];
    if (exam) {
      questions = Regular.flattenQuestions(exam);
      if (!questions.length && Array.isArray(exam.questions)) questions = exam.questions;
    }
    if (!questions.length && Array.isArray(session.questionsSnapshot)) {
      questions = session.questionsSnapshot;
    }
    const answers = session.answers || {};
    // Debug-friendly: if still empty but answers exist, list answer keys
    if (!questions.length && answers && Object.keys(answers).length) {
      questions = Object.keys(answers).map((id, i) => ({
        id,
        type: 'essay',
        prompt: 'Question ' + (i + 1) + ' (' + id + ')',
        correct: ''
      }));
    }
    // map by id and by index fallback
    const rows = questions.map((q, i) => {
      let resp = answers[q.id];
      if (resp === undefined) {
        // try alternate keys
        const keys = Object.keys(answers);
        if (keys[i] != null) resp = answers[keys[i]];
      }
      return {
        prompt: q.prompt || q.statement || ('Question ' + (i + 1)),
        response: this.formatAnswerDisplay(q, resp, false),
        correct: this.formatAnswerDisplay(q, null, true)
      };
    });

    // code assessment fallback
    if (!rows.length) {
      rows.push({
        prompt: 'Code submission',
        response: session.code || '—',
        correct: exam?.answerKey || '—'
      });
    }

    const stats = this.computeAttemptStats(session, exam);
    this.renderShell(`
      <div class="card-header page-header-responsive">
        <h2 class="page-title">${escapeHtml(session.examTitle || exam?.title || 'Attempt')}</h2>
        <div class="action-btns">
          <button class="btn btn-ghost" id="export-attempt-pdf">Export PDF</button>
          <button class="btn btn-ghost" onclick="App.showStudentHistory()">Back</button>
        </div>
      </div>
      <div class="attempt-stats">
        <div class="attempt-stat"><div class="val">${stats.total}</div><div class="lbl">Total Questions</div></div>
        <div class="attempt-stat"><div class="val">${stats.correct}</div><div class="lbl">Correct</div></div>
        <div class="attempt-stat"><div class="val">${stats.incorrect}</div><div class="lbl">Incorrect</div></div>
        <div class="attempt-stat"><div class="val">${stats.unattempted}</div><div class="lbl">Unattempted</div></div>
      </div>
      <p class="text-muted">Accuracy: <strong>${stats.accuracy}%</strong></p>
      <div class="table-wrap">
        <table class="table" id="attempt-detail-table">
          <thead><tr><th>Question</th><th>Your response</th><th>Correct answer</th></tr></thead>
          <tbody>
            ${rows.map((r, i) => `<tr>
              <td data-label="Question"><strong>Q${i + 1}.</strong> ${escapeHtml(r.prompt)}</td>
              <td data-label="Response">${escapeHtml(r.response)}</td>
              <td data-label="Correct">${escapeHtml(r.correct)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    `, 'history');

    document.getElementById('export-attempt-pdf').onclick = () => {
      this.downloadAttemptPdf(session, exam, rows);
    };
  },

  async downloadAttemptPdf(session, exam, rows) {
    const title = session.examTitle || exam?.title || 'Attempt';
    try {
      const jsPDF = await this.ensureJsPdf();
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const margin = 40;
      let y = margin;
      const pageW = doc.internal.pageSize.getWidth();
      const maxW = pageW - margin * 2;
      doc.setFontSize(14);
      doc.text(title, margin, y); y += 20;
      doc.setFontSize(10);
      doc.text(`${session.studentName || ''}  ${session.studentEmail || ''}`, margin, y); y += 18;
      const st = this.computeAttemptStats(session, exam);
      doc.text(`Total: ${st.total}  Correct: ${st.correct}  Incorrect: ${st.incorrect}  Unattempted: ${st.unattempted}  Accuracy: ${st.accuracy}%`, margin, y); y += 22;
      rows.forEach((r, i) => {
        const block = `Q${i + 1}. ${r.prompt}\nYour response: ${r.response}\nCorrect answer: ${r.correct}\n`;
        const lines = doc.splitTextToSize(block, maxW);
        if (y + lines.length * 12 > doc.internal.pageSize.getHeight() - margin) {
          doc.addPage();
          y = margin;
        }
        doc.text(lines, margin, y);
        y += lines.length * 12 + 10;
      });
      doc.save(`attempt-${session.id || 'export'}.pdf`);
      await UI.alert('PDF downloaded.', 'Export');
    } catch (e) {
      console.error(e);
      await UI.alert(e.message || 'Could not export PDF. Check your connection and try again.', 'Export');
    }
  },

  async startMockFromSelection(type, subject) {
    const boxes = [...document.querySelectorAll(`.mock-pick[data-type="${type}"][data-subject="${CSS.escape(subject)}"]:checked`)];
    if (!boxes.length) {
      await UI.alert('Select at least one assessment under this category.', 'Mock');
      return;
    }
    const examIds = [...new Set(boxes.map(b => b.dataset.examid))];
    let questions = [];
    for (const id of examIds) {
      const ex = await Exam.getExam(id);
      if (type === 'regular' && ex?.questions) questions = questions.concat(ex.questions);
      if (type === 'code') {
        // code mock: show starter prompts as open practice notes
        questions.push({
          id: 'code_' + id,
          type: 'open',
          prompt: (ex?.title || 'Code practice') + ':\n' + (ex?.instructions || 'Practice coding from this assessment.'),
          points: 1
        });
      }
    }
    questions = questions.sort(() => Math.random() - 0.5).slice(0, 20);
    if (!questions.length) {
      await UI.alert('No questions available from the selection.', 'Mock');
      return;
    }
    // Save mock history
    try {
      await window.db.collection('mockHistory').add({
        studentId: Auth.currentUser.uid,
        subject, type,
        questionCount: questions.length,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (_) {}

    this.renderShell(`
      <h2 class="page-title">Mock assessment — ${escapeHtml(subject)}</h2>
      <p class="page-subtitle">Practice only (not graded). ${questions.length} questions.</p>
      <div id="mock-area"></div>
      <button class="btn btn-primary mt-2" id="mock-done">Finish</button>
    `, 'mock');
    const area = document.getElementById('mock-area');
    area.innerHTML = questions.map(q => Regular.renderStudentQuestion(q, null)).join('');
    Regular.bindStudentMC(area, () => {});
    document.getElementById('mock-done').onclick = async () => {
      await UI.alert('Mock finished (practice only).', 'Done');
      this.showMockExam();
    };
  },


  async showMockExam() {
    this.renderShell(`
      <h2 class="page-title">Mock History</h2>
      <p class="page-subtitle">Past mock assessments you generated. Create new mocks from Assessment History.</p>
      <div id="mock-hist">Loading...</div>
    `, 'mock');
    const el = document.getElementById('mock-hist');
    try {
      const snap = await window.db.collection('mockHistory')
        .where('studentId', '==', Auth.currentUser.uid)
        .get();
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      if (!list.length) {
        el.innerHTML = '<p class="text-muted">No mock history yet. Go to Assessment History and click Generate mock assessment.</p>';
        return;
      }
      el.innerHTML = list.map(m => `
        <div class="card">
          <strong>${escapeHtml(m.subject || 'General')}</strong>
          <div class="text-muted">${escapeHtml(m.type || '')} · ${m.questionCount || 0} questions
          · ${m.createdAt?.toDate ? m.createdAt.toDate().toLocaleString() : ''}</div>
        </div>`).join('');
    } catch (e) {
      el.innerHTML = '<p class="text-muted">No mock history yet. Use Assessment History to generate mocks.</p>';
    }
  },


  async testAsStudent(examId) {
    // Always open preview in a new tab so instructor UI stays intact
    const url = new URL(window.location.href);
    url.searchParams.set('exam', examId);
    url.searchParams.set('test', '1');
    const w = window.open(url.toString(), '_blank', 'noopener');
    if (!w) {
      await UI.alert('Please allow pop-ups to open Test as student in a new tab.', 'Pop-up blocked');
    }
  },

  async startStudentExam(examId, opts = {}) {
    try {
      const isTest = !!opts.testMode;
      // Instructors / superadmins cannot take real assessments
      if (!isTest && Auth.userProfile && (Auth.isTeacher() || Auth.userProfile.role === 'superadmin' || Auth.userProfile.role === 'teacher' || Auth.userProfile.role === 'proctor')) {
        await UI.alert('You are registered as an instructor and cannot take assessments as a student. Use "Test as student" on the assessment card to preview.', 'Not allowed');
        this.clearExamQuery();
        return this.showTeacherHome ? this.showTeacherHome() : this.showStudentHome();
      }
      const exam = await Exam.getExam(examId);
      if (!exam) { await UI.alert('Assessment not found.', 'Error'); return this.showStudentHome(); }
      const { startAt, endAt } = Exam.getExamWindow(exam);
      const now = Date.now();
      if (!isTest && now < startAt) {
        return this.showExamCountdown(exam, startAt);
      }
      if (!isTest && now > endAt) {
        await UI.alert('This assessment has ended.', 'Closed');
        return this.showStudentHome();
      }
      let session;
      if (isTest) {
        // Preview: always give a fresh duration from now (ignore past endAt)
        const durMs = Math.max(5, Number(exam.durationMinutes) || 60) * 60000;
        session = {
          id: 'test_' + Date.now(),
          examId,
          exam: { ...exam, startAt: Date.now(), endAt: Date.now() + durMs },
          code: exam.starterCode || '',
          answers: {},
          status: 'test',
          endsAt: Date.now() + durMs,
          studentEmail: Auth.userProfile.email,
          studentName: (Auth.userProfile.name || '') + ' (Test)',
          _testMode: true
        };
      } else {
        session = await Exam.joinExam(examId);
      }
      // Monitor gate handles fullscreen + capture
      session._testMode = isTest;
      window._testMode = isTest;
      if (!isTest) {
        await Monitor.showEntryGate(session.id, exam.id || examId);
      } else {
        window._testMode = true;
        if (window.Monitor) { Monitor.sessionId = session.id; Monitor.examId = exam.id; Monitor.started = true; Monitor.submitting = false; }
      }
      if ((exam.examType || session.examType) === 'regular') {
        return this.startRegularExam(session);
      }
      return this.startCodeExam(session);
    } catch (err) {
      this.clearExamQuery();
      if (err.code === 'already-submitted') {
        await UI.alert('You already submitted this assessment.', 'Already submitted');
        return this.showStudentHistory();
      }
      await UI.alert(err.message || String(err), 'Error');
      this.showStudentHome();
    }
  },

  showExamCountdown(exam, startAt) {
    const examId = exam.id;
    document.getElementById('app').innerHTML = `
      <div class="countdown-screen">
        <img src="assets/lvcc-logo.png" alt="" width="72" height="72" />
        <h1>Your assessment is not started yet</h1>
        <p class="countdown-sub">Subject: <strong>${escapeHtml(exam.subject || 'General')}</strong> — ${escapeHtml(exam.title || '')}</p>
        <p class="text-muted">Starts at ${new Date(startAt).toLocaleString()}</p>
        <div id="big-countdown" class="big-countdown">--:--:--</div>
        <button class="btn btn-ghost mt-2" onclick="App.showStudentHome()">Back to home</button>
      </div>`;
    const tick = () => {
      const remain = startAt - Date.now();
      const el = document.getElementById('big-countdown');
      if (!el) return;
      if (remain <= 0) {
        clearInterval(iv);
        el.textContent = 'Starting…';
        App.startStudentExam(examId);
        return;
      }
      const s = Math.floor(remain / 1000);
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = s % 60;
      el.textContent = [h, m, sec].map(n => String(n).padStart(2, '0')).join(':');
    };
    tick();
    const iv = setInterval(tick, 250);
  },

  async startCodeExam(session) {
    const exam = session.exam;
    const lang = exam.language || session.language || 'python';
    document.getElementById('app').innerHTML = `
      <div class="lock-banner hidden" id="lock-banner"></div>
      <div id="timesup-overlay" class="timesup-overlay hidden">
        <div class="timesup-box">
          <h1>Time's up!</h1>
          <p>Your work was submitted automatically.</p>
          <div class="action-btns" style="justify-content:center;margin-top:1rem">
            <button class="btn btn-primary" onclick="App.showStudentHistory()">View results</button>
            <button class="btn btn-ghost" onclick="App.showStudentHome()">Back to home</button>
          </div>
        </div>
      </div>
      <header class="app-header exam-header-bar">
        <div class="logo">
          <img src="assets/lvcc-logo.png" alt="" class="header-logo" width="32" height="32" />
          <span class="logo-text">Code Exam · ${escapeHtml(lang)}</span>
        </div>
        <div class="user-info">
          <span id="exam-timer" class="exam-timer">--:--</span>
          <button class="btn btn-sm btn-danger" id="submit-exam-btn">Submit</button>
        </div>
      </header>
      <div class="exam-layout">
        <aside class="exam-sidebar">
          <h3>Instructions</h3>
          <div class="exam-instructions" id="exam-instructions-text"></div>
          <button class="btn btn-primary w-full mt-2" id="check-code-btn">Check Syntax</button>
        </aside>
        <div class="exam-editor-area">
          <div class="editor-toolbar"><span class="text-muted">${escapeHtml(lang)} · Live sync</span></div>
          <div id="monaco-container"></div>
          <div class="output-panel"><div id="output-content"></div></div>
        </div>
      </div>`;
    document.getElementById('exam-instructions-text').textContent = exam.instructions || '';
    await CodeEditor.init('monaco-container', session.code || exam.starterCode || '', session.id, exam.id, lang);
    // Monitor handles screen/heartbeat
    // CodeEditor.startScreenShare(2500);
    this._endedHandled = false;
    this._watchTeacherEnd(session.id);
    this.injectTestModeBar();
    this.injectStudentChatFab(session.id);
    document.getElementById('check-code-btn').onclick = () => CodeEditor.checkCode();
    document.getElementById('submit-exam-btn').onclick = async () => {
      if (!(await UI.confirm('Submit this assessment?', 'Submit'))) return;
      CodeEditor.beginSubmit();
      await Exam.submitSession(session.id, 'manual');
      try { Monitor.stop(); } catch(_){}
      CodeEditor.dispose();
      document.getElementById('student-chat-fab')?.remove();
      this.clearExamQuery();
      await UI.alert('Submitted successfully.', 'Done');
      this.showStudentHome();
    };
    this._runTimer(session);
  },


  _watchTeacherEnd(sessionId) {
    if (!sessionId || String(sessionId).startsWith('test_')) return;
    if (this._sessionWatchUnsub) try { this._sessionWatchUnsub(); } catch (_) {}
    this._lastInstructorReply = null;
    this._lastInstructorChat = null;
    this._sessionWatchUnsub = Exam.listenToSession(sessionId, async (s) => {
      if (!s) return;
      // Instructor ended
      if (s.status === 'submitted' && (s.submitReason === 'teacher-ended' || s.submitReason === 'ended')) {
        if (this._endedHandled) return;
        this._endedHandled = true;
        if (this._sessionWatchUnsub) { try { this._sessionWatchUnsub(); } catch (_) {} this._sessionWatchUnsub = null; }
        CodeEditor.beginSubmit();
        try { try { Monitor.stop(); } catch(_){}
      CodeEditor.dispose(); } catch (_) {}
        document.getElementById('student-chat-fab')?.remove();
        this.clearExamQuery();
        this._showEndedOverlay();
        return;
      }
      // Reply from paste modal
      if (s.instructorReply && s.instructorReply !== this._lastInstructorReply) {
        this._lastInstructorReply = s.instructorReply;
        await UI.alert(String(s.instructorReply || ''), 'Message from Instructor');
      }
      // Chat / reply from instructor (paste reply or message student)
      const msg = s.lastInstructorMessage || s.instructorReply;
      if (msg && msg !== this._lastInstructorChat) {
        this._lastInstructorChat = msg;
        this._lastInstructorReply = s.instructorReply || this._lastInstructorReply;
        await UI.alert(String(msg), 'Message from Instructor');
      }
    });
  },

  _showEndedOverlay() {
    let ov = document.getElementById('timesup-overlay');
    if (!ov) {
      document.getElementById('app').innerHTML = `
        <div id="timesup-overlay" class="timesup-overlay">
          <div class="timesup-box">
            <h1>Assessment Ended</h1>
            <p>Your instructor ended this assessment.</p>
            <div class="action-btns" style="justify-content:center;margin-top:1rem">
              <button class="btn btn-primary" onclick="App.showStudentHistory()">View results</button>
              <button class="btn btn-ghost" onclick="App.showStudentHome()">Back to home</button>
            </div>
          </div>
        </div>`;
      return;
    }
    ov.classList.remove('hidden');
    const box = ov.querySelector('.timesup-box');
    if (box) {
      box.innerHTML = `<h1>Assessment Ended</h1>
        <p>Your instructor ended this assessment.</p>
        <div class="action-btns" style="justify-content:center;margin-top:1rem">
          <button class="btn btn-primary" onclick="App.showStudentHistory()">View results</button>
          <button class="btn btn-ghost" onclick="App.showStudentHome()">Back to home</button>
        </div>`;
    }
  },

  injectTestModeBar() {
    if (!window._testMode) return;
    document.getElementById('test-mode-bar')?.remove();
    const bar = document.createElement('div');
    bar.id = 'test-mode-bar';
    bar.className = 'test-mode-bar';
    bar.innerHTML = `<span>Test as student (preview)</span>
      <button class="btn btn-sm btn-danger" id="test-end-btn">End / Close</button>`;
    document.body.appendChild(bar);
    document.getElementById('test-end-btn').onclick = () => {
      try { try { Monitor.stop(); } catch(_){}
      CodeEditor.dispose(); } catch (_) {}
      document.getElementById('student-chat-fab')?.remove();
      document.getElementById('test-mode-bar')?.remove();
      window.close();
      // if window.close blocked
      this.clearExamQuery();
      this.showTeacherHome ? this.showTeacherHome() : this.showStudentHome();
    };
  },

  injectStudentChatFab(sessionId) {
    if (!sessionId || String(sessionId).startsWith('test_')) return;
    document.getElementById('student-chat-fab')?.remove();
    const fab = document.createElement('button');
    fab.id = 'student-chat-fab';
    fab.className = 'fab-msg';
    fab.title = 'Talk to instructor';
    fab.innerHTML = '💬';
    fab.style.zIndex = '9500';
    fab.style.pointerEvents = 'auto';
    fab.onclick = async () => {
      // Suppress integrity blur while messaging
      if (window.Monitor) Monitor._uiBusy = true;
      try {
        const msg = await UI.prompt('Message your instructor:', '', 'Talk to instructor', 'Talk to instructor');
        if (msg == null) return;
        const text = String(msg).trim();
        if (!text) {
          await UI.alert('Please type a message.', 'Empty');
          return;
        }
        await window.db.collection('sessions').doc(sessionId).update({
          lastStudentMessage: text,
          lastStudentMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
          chatPing: Date.now(),
          studentChatAt: Date.now()
        });
        await UI.alert('Message sent to instructor.', 'Sent');
      } catch (e) {
        console.error(e);
        await UI.alert(e.message || 'Could not send', 'Error');
      } finally {
        setTimeout(() => { if (window.Monitor) Monitor._uiBusy = false; }, 800);
      }
    };
    document.body.appendChild(fab);
  },

  async startRegularExam(session) {
    const exam = session.exam || await Exam.getExam(session.examId);
    const groups = (typeof Regular.groupQuestionsForTake === 'function')
      ? Regular.groupQuestionsForTake(exam)
      : (Regular.flattenQuestions(exam) || []).map(q => ({ kind: 'single', question: q }));
    if (!groups.length) {
      await UI.alert('This assessment has no questions yet.', 'Empty');
      return this.showStudentHome();
    }
    let gi = 0;
    let pi = 0;
    const answers = { ...(session.answers || {}) };
    window._takeAnswers = answers;

    const qIdOf = (g, pidx = 0) => {
      if (g.kind === 'passage') {
        const list = g.questions && g.questions.length ? g.questions : [g.passage];
        return list[pidx]?.id;
      }
      return g.question?.id;
    };
    const isAnswered = (qid) => {
      if (!qid) return true;
      const v = answers[qid];
      if (v === undefined || v === null || v === '') return false;
      if (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length) return false;
      if (Array.isArray(v) && !v.length) return false;
      return true;
    };
    const allAnswered = () => groups.every((g, idx) => {
      if (g.kind === 'passage') {
        const list = g.questions && g.questions.length ? g.questions : [g.passage];
        return list.every(q => isAnswered(q.id));
      }
      return isAnswered(g.question?.id);
    });
    const findNextUnanswered = (fromGi, fromPi) => {
      for (let i = fromGi; i < groups.length; i++) {
        const g = groups[i];
        if (g.kind === 'passage') {
          const list = g.questions && g.questions.length ? g.questions : [g.passage];
          const startP = (i === fromGi) ? fromPi + 1 : 0;
          for (let p = startP; p < list.length; p++) {
            if (!isAnswered(list[p].id)) return { gi: i, pi: p };
          }
        } else if (!isAnswered(g.question?.id)) {
          if (i > fromGi || fromPi >= 0) return { gi: i, pi: 0 };
        }
      }
      for (let i = 0; i <= fromGi; i++) {
        const g = groups[i];
        if (g.kind === 'passage') {
          const list = g.questions && g.questions.length ? g.questions : [g.passage];
          for (let p = 0; p < list.length; p++) {
            if (!isAnswered(list[p].id)) return { gi: i, pi: p };
          }
        } else if (!isAnswered(g.question?.id)) return { gi: i, pi: 0 };
      }
      return null;
    };

    const renderMcKahoot = (q) => {
      const opts = q.options || [];
      const multi = q.multiCorrect === true;
      const val = answers[q.id];
      const cards = opts.map((o, i) => {
        const selected = multi
          ? (Array.isArray(val) && (val.includes(i) || val.includes(String(i))))
          : (val == i || val === String(i));
        const label = (o && String(o).trim()) ? String(o).trim() : ('Choice ' + (i + 1));
        return `<button type="button" class="take-opt c${i % 6} ${selected ? 'selected' : ''}" data-opt="${i}" data-multi="${multi ? 1 : 0}">${escapeHtml(label)}</button>`;
      }).join('');
      return `<div class="take-q-stack" style="display:flex;flex-direction:column;width:100%">
        <div class="take-q-banner"><span class="take-q-num">${gi + 1} / ${groups.length}</span>${escapeHtml(q.prompt || q.statement || 'Question')}</div>
        <div class="take-options-grid ${opts.length <= 2 ? '' : ''}" id="take-q-box" data-qid="${q.id}">${cards}</div>
      </div>`;
    };

    const renderTake = () => {
      if (gi >= groups.length) {
        const next = findNextUnanswered(0, -1);
        if (next) { gi = next.gi; pi = next.pi; }
        else {
          this.finishRegularTake(session, answers, 'manual');
          return;
        }
      }
      const g = groups[gi];
      const progress = Math.round((gi / Math.max(groups.length, 1)) * 100);
      let body = '';
      let currentQ = null;
      if (g.kind === 'passage') {
        const list = g.questions && g.questions.length ? g.questions : [g.passage];
        if (pi >= list.length) pi = list.length - 1;
        currentQ = list[pi];
        const passageHtml = (g.passage.passages || []).map(pp =>
          `<div class="passage-doc"><h4>${escapeHtml(pp.title || 'Passage')}</h4>${pp.html || ''}</div>`
        ).join('') || `<div class="passage-doc">${escapeHtml(g.passage.prompt || '')}</div>`;
        const qPart = (currentQ.type === 'multiple' || currentQ.type === 'truefalse' || currentQ.type === 'modified_tf')
          ? renderMcKahoot(currentQ)
          : `<div id="take-q-box">${Regular.renderStudentQuestion(currentQ, answers[currentQ.id])}</div>`;
        body = `<div class="take-passage"><div class="take-passage-left">${passageHtml}</div><div class="take-passage-right">${qPart}</div></div>`;
      } else {
        currentQ = g.question;
        if (currentQ.type === 'multiple' || currentQ.type === 'truefalse' || currentQ.type === 'modified_tf') {
          body = renderMcKahoot(currentQ);
        } else {
          body = `<div class="take-q-banner"><span class="take-q-num">${gi + 1} / ${groups.length}</span>${escapeHtml(currentQ.prompt || 'Question')}</div>
            <div class="take-single" id="take-q-box">${Regular.renderStudentQuestion(currentQ, answers[currentQ.id])}</div>`;
        }
      }

      const showSkip = !allAnswered();
      // Full-screen take: replace entire app chrome
      document.getElementById('app').innerHTML = `
        <div class="exam-take-wrap take-fullscreen">
          <div class="take-topbar">
            <div class="take-progress"><div class="take-progress-bar" style="width:${progress}%"></div></div>
            <div class="take-topbar-meta">
              <span class="take-count">${gi + 1} / ${groups.length}</span>
              <span id="exam-timer" class="timer-badge">--:--</span>
              <button type="button" class="btn btn-sm btn-danger" id="take-end-btn">End assessment</button>
            </div>
          </div>
          <div class="take-stage">${body}</div>
          <div class="take-nav">
            ${g.kind === 'passage' ? '<button type="button" class="btn btn-ghost" id="take-skip-passage">Skip passage</button>' : ''}
            ${showSkip ? '<button type="button" class="btn btn-ghost" id="take-skip">Skip</button>' : ''}
            <button type="button" class="btn btn-primary" id="take-next">${(!showSkip) ? 'Submit' : 'Next'}</button>
          </div>
        </div>`;

      const box = document.getElementById('take-q-box');
      const save = () => {
        if (!box) return;
        if (box.classList.contains('take-options-grid')) {
          const qid = box.getAttribute('data-qid');
          const multi = box.querySelector('.take-opt')?.getAttribute('data-multi') === '1';
          const selected = [...box.querySelectorAll('.take-opt.selected')].map(b => Number(b.dataset.opt));
          if (multi) answers[qid] = selected;
          else if (selected.length) answers[qid] = selected[0];
        } else {
          Object.assign(answers, Regular.collectAnswers(box));
        }
        window._takeAnswers = answers;
        if (!String(session.id).startsWith('test_')) {
          Exam.updateSessionAnswers(session.id, answers).catch(() => {});
        }
      };

      if (box?.classList.contains('take-options-grid')) {
        box.querySelectorAll('.take-opt').forEach(btn => {
          btn.onclick = () => {
            const multi = btn.getAttribute('data-multi') === '1';
            if (!multi) {
              box.querySelectorAll('.take-opt').forEach(b => b.classList.remove('selected'));
              btn.classList.add('selected');
            } else {
              btn.classList.toggle('selected');
            }
            save();
          };
        });
      } else if (box) {
        Regular.bindStudentMC(box, save);
        box.querySelectorAll('input, textarea, select').forEach(el => {
          el.addEventListener('change', save);
          el.addEventListener('input', save);
        });
      }

      const goNext = async (skipPassage = false, isSkip = false) => {
        save();
        if (isSkip) {
          const n = findNextUnanswered(gi, g.kind === 'passage' ? pi : -1);
          if (n) { gi = n.gi; pi = n.pi; renderTake(); return; }
          return;
        }
        if (!showSkip) {
          const ok = await UI.confirm('Submit this assessment? You will not be able to change answers after submitting.', 'Submit assessment');
          if (!ok) return;
          await this.finishRegularTake(session, answers, 'manual');
          return;
        }
        if (g.kind === 'passage' && !skipPassage) {
          const list = g.questions && g.questions.length ? g.questions : [g.passage];
          if (pi < list.length - 1) { pi += 1; renderTake(); return; }
        }
        gi += 1;
        pi = 0;
        if (gi >= groups.length) {
          const n = findNextUnanswered(0, -1);
          if (n) { gi = n.gi; pi = n.pi; renderTake(); return; }
          const ok = await UI.confirm('Submit this assessment? You will not be able to change answers after submitting.', 'Submit assessment');
          if (!ok) return;
          await this.finishRegularTake(session, answers, 'manual');
        } else renderTake();
      };

      const nextBtn = document.getElementById('take-next');
      const skipBtn = document.getElementById('take-skip');
      const skipPassBtn = document.getElementById('take-skip-passage');
      const endBtn = document.getElementById('take-end-btn');
      if (nextBtn) nextBtn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); goNext(false, false); };
      if (skipBtn) skipBtn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); goNext(false, true); };
      if (skipPassBtn) skipPassBtn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); goNext(true, false); };
      if (endBtn) endBtn.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (window.Monitor) { Monitor._uiBusy = true; Monitor.submitting = true; }
        try {
          const ok = await UI.confirm(
            'End this assessment now? Confirming will automatically submit your answers and end the assessment.',
            'End assessment'
          );
          if (!ok) {
            if (window.Monitor) { Monitor.submitting = false; Monitor._uiBusy = false; }
            return;
          }
          save();
          await this.finishRegularTake(session, answers, 'manual');
        } catch (err) {
          if (window.Monitor) { Monitor.submitting = false; Monitor._uiBusy = false; }
          console.error(err);
          await UI.alert(err.message || String(err), 'Error');
        }
      };
      this.injectTestModeBar();
      if (!String(session.id).startsWith('test_')) {
        this.injectStudentChatFab(session.id);
        this._watchTeacherEnd(session.id);
      }
      // Keep fullscreen during take
      try {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      } catch (_) {}
    };

    this._endedHandled = false;
    this._watchTeacherEnd(session.id);
    try {
      const el = document.documentElement;
      if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    } catch (_) {}
    try {
      if (window.Monitor) {
        Monitor.sessionId = session.id;
        Monitor.examId = session.examId || session.exam?.id;
        Monitor.submitting = false;
        Monitor.bindLockListeners();
        if (!Monitor.timer && !String(session.id).startsWith('test_')) {
          Monitor.timer = setInterval(() => Monitor.pushLiveThumbs(), 12000);
        }
      }
    } catch (_) {}
    renderTake();
    this._runTimer(session, async () => {
      Object.assign(answers, window._takeAnswers || {});
      await this.finishRegularTake(session, answers, 'time-up');
    });
  },

  async finishRegularTake(session, answers, reason = 'manual') {
    try { if (window.Monitor) Monitor.markSubmitting(); } catch (_) {}
    try { CodeEditor.beginSubmit(); } catch (_) {}
    const isTest = !!(session._testMode || window._testMode || String(session.id).startsWith('test_'));
    if (!isTest) {
      try {
        await Exam.updateSessionAnswers(session.id, answers || {});
        const exam = session.exam || await Exam.getExam(session.examId);
        const st = this.computeAttemptStats({ ...session, answers: answers || {} }, exam);
        await window.db.collection('sessions').doc(session.id).update({
          totalQuestions: st.total,
          correctCount: st.correct,
          incorrectCount: st.incorrect,
          unattemptedCount: st.unattempted,
          accuracy: st.accuracy,
          questionsSnapshot: session.questionsSnapshot || (exam ? Regular.flattenQuestions(exam) : [])
        }).catch(() => {});
        await Exam.submitSession(session.id, reason === 'time-up' ? 'time-up' : 'manual');
      } catch (e) { console.error(e); }
    }
    this.clearExamQuery();
    document.getElementById('student-chat-fab')?.remove();
    document.getElementById('test-mode-bar')?.remove();
    window._testMode = false;
    if (isTest) {
      // Instructor preview tab: close or return to instructor dashboard
      this.renderShell(`
        <div class="card empty-state times-up-card">
          <h2>Preview ended</h2>
          <p>Test as student session finished. This did not count as a real submission.</p>
          <div class="action-btns" style="justify-content:center">
            <button class="btn btn-primary" onclick="window.close()">Close tab</button>
            <button class="btn btn-ghost" onclick="App.showDashboard()">Back to dashboard</button>
          </div>
        </div>
      `, 'dashboard');
      return;
    }
    this.renderShell(`
      <div class="card empty-state times-up-card">
        <h2>${reason === 'time-up' ? "Time's up!" : 'Assessment submitted'}</h2>
        <p>Your answers were submitted${reason === 'time-up' ? ' automatically' : ''}.</p>
        <div class="action-btns" style="justify-content:center">
          <button class="btn btn-primary" onclick="App.showStudentHistory()">View results</button>
          <button class="btn btn-ghost" onclick="App.showDashboard()">Back to home</button>
        </div>
      </div>
    `, 'history');
  },

  _runTimer(session, onExpireExtra) {
    let endsAt = session.endsAt || Date.now() + 3600000;
    this._examTimerInterval = setInterval(async () => {
      const remain = endsAt - Date.now();
      const el = document.getElementById('exam-timer');
      if (el) {
        el.textContent = formatMs(Math.max(0, remain));
        if (remain < 300000) el.classList.add('timer-warn');
      }
      if (remain <= 0) {
        clearInterval(this._examTimerInterval);
        CodeEditor.lockEditor?.();
        document.getElementById('timesup-overlay')?.classList.remove('hidden');
        try {
          if (onExpireExtra) await onExpireExtra();
          await Exam.submitSession(session.id, 'timeout');
        } catch (e) { console.error(e); }
      }
    }, 500);

    Exam.listenToSession(session.id, (s) => {
      if (s.endsAt && s.endsAt > endsAt) endsAt = s.endsAt;
    });
  },

  // ---- Grading / export (retained) ----
  async publishDraft(examId) {
    const exam = await Exam.getExam(examId);
    if (!exam) { await UI.alert('Not found.', 'Error'); return; }
    const schedule = await this.pickSchedule();
    if (!schedule) return;
    await Exam.updateExam(examId, {
      startAt: schedule.startAt, endAt: schedule.endAt, status: 'published', active: true,
      durationMinutes: Math.max(1, Math.round((schedule.endAt - schedule.startAt) / 60000))
    });
    await UI.alert('Assessment published.', 'Published');
    this.showSharePanel(examId);
  },

  pickSchedule() {
    return new Promise((resolve) => {
      const toLocal = (d) => {
        const pad = n => String(n).padStart(2, '0');
        return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
      };
      const now = new Date();
      const later = new Date(now.getTime() + 3600000);
      UI._root().innerHTML = `<div class="modal-overlay ui-modal-overlay"><div class="modal ui-modal">
        <h2>Publish schedule</h2>
        <div class="form-group"><label>Start date & time</label>
          <input type="datetime-local" id="sched-start" class="form-control" value="${toLocal(now)}" /></div>
        <div class="form-group"><label>End date & time</label>
          <input type="datetime-local" id="sched-end" class="form-control" value="${toLocal(later)}" /></div>
        <div class="form-group"><label>Time limit (minutes)</label>
          <input type="number" id="sched-mins" class="form-control" min="1" value="60" /></div>
        <div class="modal-actions">
          <button class="btn btn-ghost" id="sched-cancel">Cancel</button>
          <button class="btn btn-primary" id="sched-ok">Publish</button>
        </div>
      </div></div>`;
      document.getElementById('sched-cancel').onclick = () => { UI.close(); resolve(null); };
      document.getElementById('sched-ok').onclick = () => {
        const startAt = new Date(document.getElementById('sched-start').value).getTime();
        let endAt = new Date(document.getElementById('sched-end').value).getTime();
        const mins = Number(document.getElementById('sched-mins').value) || 0;
        if (mins > 0) endAt = startAt + mins * 60000;
        if (!startAt || !endAt || endAt <= startAt) {
          UI.alert('End must be after start.', 'Schedule');
          return;
        }
        if (startAt < Date.now() - 60000) {
          UI.alert('Start cannot be in the past.', 'Schedule');
          return;
        }
        UI.close();
        resolve({ startAt, endAt, durationMinutes: Math.max(1, Math.round((endAt - startAt) / 60000)) });
      };
    });
  },

  async showIntegrityHistory(examId) {
    const exam = await Exam.getExam(examId);
    this.renderShell(`
      <div class="card-header page-header-responsive">
        <h2 class="page-title">Integrity issues — ${escapeHtml(exam?.title || '')}</h2>
        <div class="action-btns">
          <button class="btn btn-ghost" id="btn-export-integrity-pdf">Export PDF</button>
          <button class="btn btn-ghost" onclick="App.showTeacherHome()">Back</button>
        </div>
      </div>
      <div class="card">
        <input type="search" id="integrity-filter-page" class="form-control" placeholder="Filter by name, email, type..." />
      </div>
      <div id="integrity-hist-list" class="mt-2">Loading...</div>
    `, 'exams');

    let all = [];
    const render = () => {
      const q = (document.getElementById('integrity-filter-page')?.value || '').toLowerCase();
      const items = q ? all.filter(n =>
        (n.studentName || '').toLowerCase().includes(q) ||
        (n.studentEmail || '').toLowerCase().includes(q) ||
        (n.type || '').toLowerCase().includes(q) ||
        (n.details || '').toLowerCase().includes(q)
      ) : all;
      window._integrityExportRows = items;
      const el = document.getElementById('integrity-hist-list');
      if (!items.length) {
        el.innerHTML = '<p class="text-muted">No integrity events recorded for this assessment.</p>';
        return;
      }
      // dedupe
      const seen = new Set();
      const deduped = items.filter(n => {
        const ts = n.createdAt?.toMillis?.() || Date.parse(n.timestamp || 0) || 0;
        const key = [n.sessionId||'', n.type||'', n.details||'', Math.floor(ts/60000)].join('|');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      window._integrityExportRows = deduped;
      const hideNames = !!window._integrityHideNames;
      el.innerHTML = `<div class="table-wrap"><div style="margin-bottom:0.5rem">
        <button type="button" class="integrity-eye-btn" id="toggle-hide-names" title="Hide/show student names">${hideNames ? '👁️' : '👁️‍🗨️'}</button>
        <span class="text-muted" style="font-size:0.85rem">${hideNames ? 'Names hidden' : 'Names visible'}</span>
      </div>
      <table class="table integrity-table">
        <thead><tr><th></th><th>Name</th><th>Email</th><th>Issue</th><th>Date stamp</th></tr></thead>
        <tbody>${deduped.map(n => {
          const time = n.createdAt?.toDate ? n.createdAt.toDate().toLocaleString()
            : (n.timestamp ? new Date(n.timestamp).toLocaleString() : '');
          const thumb = n.screenshot || n.extra?.screenshot || n.cameraScreenshot || n.extra?.cameraScreenshot || n.screenThumb;
          const rawName = n.studentName || n.studentEmail || 'Student';
          const mask = (s) => '•'.repeat(Math.max(6, String(s).length));
          const nameDisp = hideNames ? mask(rawName) : escapeHtml(rawName);
          const emailDisp = hideNames ? mask(n.studentEmail || '') : escapeHtml(n.studentEmail || '');
          const issueLabel = ({
            'tab-hidden': 'Switching tabs: Leaving the assessment window or browser tab',
            'window-blur': 'Switching tabs: Leaving the assessment window or browser tab',
            'paste': 'Copying content: Attempting to copy text or questions',
            'paste-critical': 'Copying content: Attempting to copy text or questions',
            'paste-message': 'Copying content: Attempting to copy text or questions',
            'copy': 'Copying content: Attempting to copy text or questions',
            'resize': 'Resizing the window: Changing the browser size to break full-screen',
            'right-click': 'Right-clicking: Opening context menus on the page',
            'extension-suspect': 'Using web extensions: Unauthorized browser tools',
            'external-search-suspect': 'Using external search tools: Suspicious resize + right-click pattern',
            'exited-fullscreen': 'Exiting full-screen mode: Quitting required full-screen view',
            'connection-loss': 'Left due to loss of connection / poor network'
          })[n.type] || (n.details || n.type || 'Violation');
          return `<tr>
            <td data-label="Shot">${thumb && String(thumb).startsWith('data:') ? `<img class="integrity-thumb" src="${thumb}" style="width:72px;height:auto;display:block;margin:0 auto;cursor:pointer" onclick="UI.showImage(this.src,'Integrity screenshot')" />` : '—'}</td>
            <td data-label="Name" class="${hideNames ? 'integrity-name-masked' : ''}">${nameDisp}</td>
            <td data-label="Email" class="${hideNames ? 'integrity-name-masked' : ''}">${emailDisp}</td>
            <td data-label="Issue">${escapeHtml(issueLabel)}</td>
            <td data-label="Time">${escapeHtml(time)}</td>
          </tr>`;
        }).join('')}</tbody></table></div>`;
      document.getElementById('toggle-hide-names').onclick = () => {
        window._integrityHideNames = !window._integrityHideNames;
        render();
      };
    };

    const merge = (rows) => {
      const map = {};
      rows.forEach(n => {
        const key = n.id || (n.sessionId + '_' + (n.timestamp || n.type + n.details));
        map[key] = n;
      });
      all = Object.values(map);
      all.sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() || Date.parse(a.timestamp || 0) || 0;
        const tb = b.createdAt?.toMillis?.() || Date.parse(b.timestamp || 0) || 0;
        return tb - ta;
      });
      render();
    };

    // 1) integrityHistory
    try {
      const unsub = window.db.collection('integrityHistory').where('examId', '==', examId)
        .onSnapshot(snap => {
          merge(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }, () => {});
      Dashboard.unsubscribers.push(unsub);
    } catch (_) {}

    // 2) notifications
    try {
      const unsub2 = window.db.collection('notifications').where('examId', '==', examId)
        .onSnapshot(snap => {
          merge([...(window._integrityExportRows || all), ...snap.docs.map(d => ({ id: d.id, ...d.data() }))]);
        }, () => {});
      Dashboard.unsubscribers.push(unsub2);
    } catch (_) {}

    // 3) session.events fallback (always works if sessions readable)
    try {
      const unsub3 = Exam.listenToSessions(examId, (sessions) => {
        const fromSessions = [];
        sessions.forEach(s => {
          (s.events || []).forEach((e, i) => {
            fromSessions.push({
              id: s.id + '_ev_' + i,
              sessionId: s.id,
              examId,
              studentName: s.studentName,
              studentEmail: s.studentEmail,
              type: e.type,
              details: e.details,
              timestamp: e.timestamp,
              extra: e,
              screenshot: e.screenshot
            });
          });
        });
        merge([...all, ...fromSessions]);
      });
      Dashboard.unsubscribers.push(unsub3);
    } catch (_) {}

    document.getElementById('integrity-filter-page').oninput = render;
    document.getElementById('btn-export-integrity-pdf').onclick = async () => {
      const rows = window._integrityExportRows || all;
      const title = exam?.title || 'Assessment';
      const stamp = fileStamp();
      try {
        const jsPDF = await this.ensureJsPdf();
        const doc = new jsPDF({ unit: 'pt', format: 'a4' });
        let y = 40;
        doc.setFontSize(14);
        doc.text('Integrity issues — ' + title, 40, y); y += 24;
        doc.setFontSize(10);
        rows.forEach((n) => {
          const time = n.createdAt?.toDate ? n.createdAt.toDate().toLocaleString()
            : (n.timestamp ? new Date(n.timestamp).toLocaleString() : '');
          const line = `${n.studentName || ''} | ${n.studentEmail || ''} | ${n.type || ''} | ${n.details || ''} | ${time}`;
          const lines = doc.splitTextToSize(line, 520);
          if (y + lines.length * 12 > 780) { doc.addPage(); y = 40; }
          doc.text(lines, 40, y);
          y += lines.length * 12 + 8;
          const thumb = n.screenshot || n.extra?.screenshot || n.screenThumb;
          if (thumb && String(thumb).startsWith('data:image')) {
            try {
              if (y > 640) { doc.addPage(); y = 40; }
              doc.addImage(thumb, 'JPEG', 40, y, 120, 80);
              y += 90;
            } catch (_) {}
          }
        });
        doc.save(safeFilePart(title) + '-' + stamp + '.pdf');
        await UI.alert('PDF downloaded.', 'Export');
      } catch (e) {
        console.error(e);
        await UI.alert(e.message || 'Could not export PDF.', 'Export');
      }
    };
    document.getElementById('btn-export-integrity-hq').onclick = () => {
      const rows = window._integrityExportRows || all;
      const stamp = fileStamp();
      let n = 0;
      rows.forEach(row => {
        const thumb = row.screenshot || row.extra?.screenshot || row.screenThumb || row.extra?.cameraScreenshot;
        if (!thumb || !String(thumb).startsWith('data:')) return;
        const nameParts = String(row.studentName || row.studentEmail || 'student').trim().split(/\s+/);
        const last = nameParts.slice(-1)[0] || 'student';
        const first = nameParts[0] || '';
        const issue = safeFilePart(row.type || 'issue');
        const fname = `${safeFilePart(last)}${safeFilePart(first)}-${issue}-${stamp}.jpg`;
        downloadDataUrl(thumb, fname);
        n++;
      });
      UI.alert(n ? (`Downloaded ${n} image(s).`) : 'No HQ images in the current filter.', 'Export HQ');
    };

  },

  async gradeSession(sessionId, examId) {
    const exam = await Exam.getExam(examId);
    const snap = await window.db.collection('sessions').doc(sessionId).get();
    if (!snap.exists) { await UI.alert('Not found.', 'Error'); return; }
    const session = { id: snap.id, ...snap.data() };
    const maxScore = Number(exam.maxScore) || 50;
    const auto = Exam.autoGrade(session.code, exam.answerKey, maxScore);
    const existing = await Exam.getGrade(sessionId);
    const scoreStr = await UI.prompt(
      `Grade ${session.studentName || session.studentEmail}\nMax: ${maxScore}` +
      (auto.note ? `\nAuto: ${auto.note} → ${auto.score}` : '') + `\nEnter score:`,
      String(existing?.score ?? auto.score ?? ''),
      'Grade'
    );
    if (scoreStr === null) return;
    const score = Number(scoreStr);
    if (Number.isNaN(score) || score < 0 || score > maxScore) { await UI.alert('Invalid score.', 'Error'); return; }
    const comment = (await UI.prompt('Comment (optional):', existing?.comment || '', 'Comment')) || '';
    const percent = Math.round((score / maxScore) * 1000) / 10;
    await Exam.saveGrade(sessionId, examId, {
      studentId: session.studentId, studentEmail: session.studentEmail, studentName: session.studentName,
      score, maxScore, percent, comment, method: 'manual'
    });
    await UI.alert(`Saved ${score}/${maxScore} (${percent}%)`, 'Graded');
  },

  async showExamResults(examId) {
    const exam = await Exam.getExam(examId);
    this.renderShell(`
      <div class="card-header page-header-responsive">
        <h2 class="page-title">Results — ${escapeHtml(exam.title)}</h2>
        <div class="action-btns">
          <button class="btn btn-ghost" id="btn-export-xlsx">Export Excel</button>
          <button class="btn btn-ghost" onclick="App.showTeacherHome()">Back</button>
        </div>
      </div>
      <div id="results-stats" class="stats-grid">Loading stats...</div>
      <div id="results-table" class="mt-2">Loading...</div>
    `, 'exams');

    const sessionsSnap = await window.db.collection('sessions').where('examId', '==', examId).get();
    const sessions = sessionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const grades = await Exam.listGrades(examId);
    const gradeMap = Object.fromEntries(grades.map(g => [g.sessionId, g]));
    const questions = Regular.flattenQuestions(exam);

    // Auto-grade missing where possible
    for (const s of sessions) {
      if (!gradeMap[s.id] && questions.length && s.answers) {
        const g = Regular.gradeAnswers(questions, s.answers);
        gradeMap[s.id] = { ...g, sessionId: s.id };
      } else if (!gradeMap[s.id] && s.code && exam.answerKey) {
        const g = Exam.autoGrade(s.code, exam.answerKey, exam.maxScore || 100);
        gradeMap[s.id] = { score: g.score, maxScore: exam.maxScore || 100, percent: g.percent, sessionId: s.id };
      }
    }

    const graded = Object.values(gradeMap).filter(g => g.score != null);
    const studentCount = sessions.length;
    const totalItems = questions.length || 1;
    const avg = graded.length ? graded.reduce((a, g) => a + (Number(g.percent) || 0), 0) / graded.length : 0;
    const perfect = graded.filter(g => Number(g.percent) >= 100).length;

    // Most incorrect: for regular, count wrong per question
    const wrongCount = {};
    questions.forEach(q => { wrongCount[q.id] = { prompt: q.prompt || q.id, wrong: 0 }; });
    sessions.forEach(s => {
      if (!s.answers || !questions.length) return;
      questions.forEach(q => {
        const g = Regular.gradeAnswers([q], { [q.id]: s.answers[q.id] });
        if ((g.score || 0) < (g.maxScore || 1)) wrongCount[q.id].wrong++;
      });
    });
    const hardest = Object.values(wrongCount).sort((a, b) => b.wrong - a.wrong).slice(0, 5);

    const topPerformers = sessions.map(s => {
      const g = gradeMap[s.id] || {};
      const submittedAt = s.submittedAt?.toMillis?.() || s.submittedAt || 0;
      const startedAt = s.startedAt?.toMillis?.() || s.createdAt?.toMillis?.() || 0;
      const duration = (submittedAt && startedAt) ? Math.max(0, submittedAt - startedAt) : (s.durationMs || 0);
      return {
        name: s.studentName || s.studentEmail || 'Student',
        email: s.studentEmail || '',
        percent: Number(g.percent) || 0,
        score: g.score,
        duration
      };
    }).filter(p => p.percent > 0 || p.score != null)
      .sort((a, b) => (b.percent - a.percent) || (a.duration - b.duration))
      .slice(0, 5);

    const pieTotal = hardest.reduce((a, h) => a + h.wrong, 0) || 1;
    const colors = ['#2563eb','#8b5cf6','#14b8a6','#f59e0b','#f43f5e'];
    let ang = 0;
    const slices = hardest.map((h, i) => {
      const frac = h.wrong / pieTotal;
      const start = ang;
      ang += frac * Math.PI * 2;
      const x1 = 50 + 40 * Math.cos(start), y1 = 50 + 40 * Math.sin(start);
      const x2 = 50 + 40 * Math.cos(ang), y2 = 50 + 40 * Math.sin(ang);
      const large = frac > 0.5 ? 1 : 0;
      return `<path d="M50,50 L${x1},${y1} A40,40 0 ${large} 1 ${x2},${y2} Z" fill="${colors[i % colors.length]}"><title>${escapeHtml(h.prompt).slice(0,40)} (${h.wrong})</title></path>`;
    }).join('') || `<circle cx="50" cy="50" r="40" fill="var(--surface-2)" />`;
    const legend = hardest.map((h, i) =>
      `<div class="pie-legend-item"><span class="pie-swatch" style="background:${colors[i%colors.length]}"></span>${escapeHtml(h.prompt).slice(0,48)} (${h.wrong})</div>`
    ).join('') || '<div class="text-muted">No data</div>';

    const topList = (typeof topPerformers !== 'undefined' ? topPerformers : []).map((p, i) =>
      `<div class="pie-legend-item"><strong>#${i+1}</strong> ${escapeHtml(p.name)} — ${p.percent}%${p.duration ? (' · ' + Math.round(p.duration/60000) + ' min') : ''}</div>`
    ).join('') || '<div class="text-muted">No data</div>';

    document.getElementById('results-stats').innerHTML = `
      <div class="results-stats-row">
        <div class="stats-grid stats-4">
          <div class="stat-card stat-blue"><div class="stat-val">${studentCount}</div><div class="stat-label">Students</div></div>
          <div class="stat-card stat-purple"><div class="stat-val">${totalItems}</div><div class="stat-label">Total items</div></div>
          <div class="stat-card stat-teal"><div class="stat-val">${avg.toFixed(1)}%</div><div class="stat-label">Average score</div></div>
          <div class="stat-card stat-green"><div class="stat-val">${perfect}</div><div class="stat-label">Perfect scores</div></div>
        </div>
        <div class="stat-card pie-card">
          <div class="stat-label">Most incorrect questions</div>
          <div class="pie-wrap">
            <svg viewBox="0 0 100 100" class="pie-svg">${slices}</svg>
            <div class="pie-legend">${legend}</div>
          </div>
        </div>
        <div class="stat-card pie-card">
          <div class="stat-label">Top performing students</div>
          <div class="pie-legend" style="margin-top:0.75rem">${topList}</div>
        </div>
      </div>`;

    const el = document.getElementById('results-table');
    el.innerHTML = `<div class="table-wrap"><table class="table" id="results-data-table"><thead><tr>
      <th>Student</th><th>Email</th><th>Status</th><th>Score</th><th>%</th><th></th></tr></thead><tbody>
      ${sessions.map(s => {
        const g = gradeMap[s.id];
        return `<tr>
          <td>${escapeHtml(s.studentName||'')}</td><td>${escapeHtml(s.studentEmail||'')}</td>
          <td>${escapeHtml(s.status)}</td>
          <td>${g && g.score != null ? g.score+'/'+(g.maxScore||'') : '—'}</td>
          <td>${g && g.percent != null ? g.percent+'%' : '—'}</td>
          <td class="action-btns">
            <button class="btn btn-sm btn-primary" onclick="App.gradeSession('${s.id}','${examId}')">Grade</button>
            <button class="btn btn-sm btn-ghost" onclick="App.reEvaluateSession('${s.id}','${examId}')">Re-evaluate</button>
            <button class="btn btn-sm btn-ghost" onclick="App.exportStudentReport('${s.id}','${examId}')">Export</button>
          </td></tr>`;
      }).join('')}</tbody></table></div>`;

    document.getElementById('btn-export-xlsx').onclick = () => {
      const rows = [['Name','Email','Status','Score','Max','Percent']];
      sessions.forEach(s => {
        const g = gradeMap[s.id];
        rows.push([s.studentName||'', s.studentEmail||'', s.status||'', g?.score??'', g?.maxScore??'', g?.percent??'']);
      });
      rows.push(['']);
      rows.push(['Summary']);
      rows.push(['Students', studentCount]);
      rows.push(['Total items', totalItems]);
      rows.push(['Average %', avg.toFixed(1)]);
      rows.push(['Perfect scores', perfect]);
      hardest.forEach((h, i) => rows.push(['Hardest Q'+(i+1), String(h.prompt||'').replace(/\r?\n/g, ' '), (h.wrong) + ' wrong']));
      const csv = rows.map(r => r.map(c => '"' + String(c ?? '').replace(/"/g, '""') + '"').join(',')).join('\r\n');
      const stamp = fileStamp();
      downloadText(safeFilePart(exam.title || 'results') + '-summary-' + stamp + '.csv', '\uFEFF' + csv);
      UI.alert('Excel CSV downloaded.', 'Export');
    };
  },

  async exportStudentReport(sessionId, examId) {
    const exam = await Exam.getExam(examId);
    const snap = await window.db.collection('sessions').doc(sessionId).get();
    const session = { id: snap.id, ...snap.data() };
    const grade = await Exam.getGrade(sessionId);
    const text = [
      'LVCC Assessment Portal — Student Report',
      'Exam: ' + (exam.title || ''),
      'Student: ' + (session.studentName || ''),
      'Email: ' + (session.studentEmail || ''),
      'Score: ' + (grade ? `${grade.score}/${grade.maxScore} (${grade.percent}%)` : 'N/A'),
      'Comment: ' + (grade?.comment || ''),
      '', '--- Answer ---', session.code || JSON.stringify(session.answers || {}, null, 2),
      '', '--- Key ---', exam.answerKey || ''
    ].join('\n');
    downloadText(`report-${(session.studentEmail||sessionId).replace(/[^a-z0-9]/gi,'_')}.txt`, text);
  },

  async exportSummary(examId) {
    const exam = await Exam.getExam(examId);
    const sessionsSnap = await window.db.collection('sessions').where('examId', '==', examId).get();
    const sessions = sessionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const grades = await Exam.listGrades(examId);
    const gradeMap = Object.fromEntries(grades.map(g => [g.sessionId, g]));
    const rows = [['Name','Email','Status','Score','Max','Percent','Comment']];
    sessions.forEach(s => {
      const g = gradeMap[s.id];
      rows.push([s.studentName||'', s.studentEmail||'', s.status||'', (g && g.score != null ? g.score : ''), (g && g.maxScore != null ? g.maxScore : (exam.maxScore || 50)), (g && g.percent != null ? g.percent : ''), (g?.comment||'').replace(/,/g,';')]);
    });
    downloadText(`summary-${examId}.csv`, rows.map(r => r.map(c => '"'+String(c).replace(/"/g,'""')+'"').join(',')).join('\n'));
  },

  async logout() {
    if (!(await UI.confirm('Are you sure you want to log out?', 'Log out'))) return;
    clearInterval(this._examTimerInterval);
    Dashboard.clearListeners();
    try { Monitor.stop(); } catch(_){}
      CodeEditor.dispose();
    await Auth.signOut();
    window.history.replaceState({}, '', window.location.pathname);
    this.showLogin();
  },

  showError(msg) {
    document.getElementById('app').innerHTML = `
      <div class="auth-container"><h1>Error</h1>
      <p style="color:var(--danger)">${escapeHtml(msg)}</p>
      <button class="btn btn-primary" onclick="location.reload()">Reload</button></div>`;
  }
};


function fileStamp(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}`;
}
function safeFilePart(s) {
  return String(s || 'file').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80);
}
function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function downloadText(filename, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}
function formatMs(ms) {
  const s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, '0'), ss = String(s % 60).padStart(2, '0');
  return h > 0 ? h + ':' + mm + ':' + ss : mm + ':' + ss;
}
window.App = App;
window.downloadText = downloadText;
window.formatMs = formatMs;
document.addEventListener('DOMContentLoaded', () => App.init());
