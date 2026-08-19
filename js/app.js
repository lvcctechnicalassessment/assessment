/**
 * LVCC Assessment Portal — Main App
 * v1.3.0
 */

const App = {
  async init() {
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
          Personal email only if invited to a specific exam.
        </p>
        <div id="login-error" class="hidden login-error"></div>
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
        if (Auth.userProfile) this.routeAfterLogin();
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
      this.startStudentExam(examId);
      return;
    }
    if (role === 'superadmin') this.showSuperAdmin();
    else if (role === 'teacher') this.showTeacherHome();
    else if (role === 'proctor') this.showProctorHome();
    else this.showStudentHome();
  },

  toggleMobileNav() {
    document.getElementById('sidebar')?.classList.toggle('open');
    document.getElementById('nav-backdrop')?.classList.toggle('open');
  },

  renderShell(contentHtml, activeNav = '') {
    const role = Auth.userProfile.role;
    const name = Auth.userProfile.name || Auth.userProfile.email;
    let navItems = '';
    if (role === 'superadmin') {
      navItems = `
        <div class="nav-item ${activeNav==='teachers'?'active':''}" onclick="App.showSuperAdmin();App.toggleMobileNav()">👥 Teachers</div>
        <div class="nav-item ${activeNav==='exams'?'active':''}" onclick="App.showTeacherHome();App.toggleMobileNav()">📝 My Exams</div>`;
    } else if (role === 'teacher') {
      navItems = `
        <div class="nav-item ${activeNav==='exams'?'active':''}" onclick="App.showTeacherHome();App.toggleMobileNav()">📝 My Exams</div>`;
    } else if (role === 'proctor') {
      navItems = `
        <div class="nav-item ${activeNav==='proctor'?'active':''}" onclick="App.showProctorHome();App.toggleMobileNav()">👁 Proctor</div>`;
    } else {
      navItems = `
        <div class="nav-item ${activeNav==='student'?'active':''}" onclick="App.showStudentHome();App.toggleMobileNav()">🏠 Home</div>
        <div class="nav-item ${activeNav==='history'?'active':''}" onclick="App.showStudentHistory();App.toggleMobileNav()">📚 History</div>
        <div class="nav-item ${activeNav==='mock'?'active':''}" onclick="App.showMockExam();App.toggleMobileNav()">🎲 Mock Exam</div>`;
    }

    document.getElementById('app').innerHTML = `
      <header class="app-header">
        <button class="btn btn-ghost btn-sm menu-toggle" onclick="App.toggleMobileNav()" aria-label="Menu">☰</button>
        <div class="logo">
          <img src="assets/lvcc-logo.png" alt="LVCC" class="header-logo" width="36" height="36" />
          <span class="logo-text">LVCC Assessment Portal</span>
        </div>
        <div class="user-info">
          <span class="role-badge ${role}">${role}</span>
          <span class="user-name">${escapeHtml(name)}</span>
          <button class="btn btn-sm btn-ghost" onclick="App.logout()">Logout</button>
        </div>
      </header>
      <div id="nav-backdrop" class="nav-backdrop" onclick="App.toggleMobileNav()"></div>
      <div class="dashboard">
        <aside class="sidebar" id="sidebar">
          <h3>Menu</h3>
          ${navItems}
        </aside>
        <main class="main-content" id="main-content">${contentHtml}</main>
      </div>`;
  },

  // ---- Superadmin ----
  async showSuperAdmin() {
    this.renderShell(`
      <h2 class="page-title">Teacher Management</h2>
      <div class="card">
        <div class="form-group">
          <label>Teacher Email</label>
          <input type="email" id="teacher-email" class="form-control" placeholder="teacher@laverdad.edu.ph" />
        </div>
        <button class="btn btn-primary" id="add-teacher-btn">Add Teacher</button>
        <p id="add-teacher-msg" class="mt-1 text-muted"></p>
      </div>
      <div class="card mt-2">
        <div class="card-title">Teachers & Admins</div>
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
    if (!confirm('Demote this user to student?')) return;
    await Auth.removeTeacher(uid);
    this.loadTeachersList();
  },
  async makeSuperAdmin(uid) {
    if (!confirm('Promote to Superadmin?')) return;
    await Auth.setRole(uid, 'superadmin');
    this.loadTeachersList();
  },
  async setRole(uid, role) {
    if (!confirm('Change role to ' + role + '?')) return;
    await Auth.setRole(uid, role);
    this.loadTeachersList();
  },

  // ---- Teacher ----
  async showTeacherHome() {
    this.renderShell(`<div id="exams-container">Loading...</div>`, 'exams');
    await Dashboard.renderMyExams(document.getElementById('exams-container'));
  },

  showCreateExam() {
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
          <label>Title</label>
          <input id="exam-title" class="form-control" placeholder="Assessment title" />
        </div>
        <div class="form-group">
          <label>Subject</label>
          <input id="exam-subject" class="form-control" value="General" />
        </div>
        <div class="form-group">
          <label>Exam type</label>
          <select id="exam-type" class="form-control">
            <option value="code">Code Assessment</option>
            <option value="regular">Regular Assessment</option>
          </select>
        </div>
        <div class="form-group" id="lang-group">
          <label>Programming language</label>
          <select id="exam-language" class="form-control">
            <option value="python">Python</option>
            <option value="java">Java</option>
          </select>
        </div>
        <div class="form-group">
          <label>Instructions</label>
          <textarea id="exam-instructions" class="form-control" rows="4"></textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Time start (all students)</label>
            <input type="datetime-local" id="exam-start" class="form-control" value="${toLocal(now)}" />
          </div>
          <div class="form-group">
            <label>Time end (all students)</label>
            <input type="datetime-local" id="exam-end" class="form-control" value="${toLocal(later)}" />
          </div>
        </div>
        <div class="form-group">
          <label>Max score (default 50)</label>
          <input type="number" id="exam-maxscore" class="form-control" value="50" min="1" />
        </div>
        <div id="code-fields">
          <div class="form-group">
            <label>Starter code</label>
            <textarea id="exam-starter" class="form-control" rows="5" style="font-family:monospace"></textarea>
          </div>
          <div class="form-group">
            <label>Answer key (optional)</label>
            <textarea id="exam-answer" class="form-control" rows="4" style="font-family:monospace"></textarea>
          </div>
        </div>
        <div id="regular-fields" class="hidden">
          <div class="card-title">Questions</div>
          <div id="questions-builder"></div>
          <button type="button" class="btn btn-ghost mt-1" id="add-q-btn">+ Add question</button>
        </div>
        <div class="modal-actions action-btns">
          <button class="btn btn-ghost" onclick="App.showTeacherHome()">Cancel</button>
          <button class="btn btn-primary" id="create-exam-btn">Create</button>
        </div>
      </div>
    `, 'exams');

    const typeEl = document.getElementById('exam-type');
    const syncType = () => {
      const reg = typeEl.value === 'regular';
      document.getElementById('lang-group').classList.toggle('hidden', reg);
      document.getElementById('code-fields').classList.toggle('hidden', reg);
      document.getElementById('regular-fields').classList.toggle('hidden', !reg);
    };
    typeEl.onchange = syncType;
    syncType();

    window._builderQuestions = [];
    const renderBuilder = () => {
      const box = document.getElementById('questions-builder');
      box.innerHTML = window._builderQuestions.map((q, i) => `
        <div class="q-edit card">
          <div class="form-row">
            <select data-i="${i}" class="form-control q-type">
              ${QUESTION_TYPES.map(t => `<option value="${t.id}" ${q.type===t.id?'selected':''}>${t.label}</option>`).join('')}
            </select>
            <button class="btn btn-sm btn-danger" data-del="${i}">Remove</button>
          </div>
          <input class="form-control mt-1 q-prompt" data-i="${i}" value="${escapeHtml(q.prompt)}" placeholder="Question prompt" />
          <input class="form-control mt-1 q-opts" data-i="${i}" value="${escapeHtml((q.options||[]).join(' | '))}" placeholder="Options separated by | (for MC/dropdown)" />
        </div>`).join('') || '<p class="text-muted">No questions yet.</p>';
      box.querySelectorAll('.q-type').forEach(el => {
        el.onchange = () => {
          const i = Number(el.dataset.i);
          window._builderQuestions[i] = Regular.newQuestion(el.value);
          renderBuilder();
        };
      });
      box.querySelectorAll('.q-prompt').forEach(el => {
        el.oninput = () => { window._builderQuestions[Number(el.dataset.i)].prompt = el.value; };
      });
      box.querySelectorAll('.q-opts').forEach(el => {
        el.oninput = () => {
          const i = Number(el.dataset.i);
          window._builderQuestions[i].options = el.value.split('|').map(s => s.trim()).filter(Boolean);
        };
      });
      box.querySelectorAll('[data-del]').forEach(el => {
        el.onclick = () => {
          window._builderQuestions.splice(Number(el.dataset.del), 1);
          renderBuilder();
        };
      });
    };
    document.getElementById('add-q-btn').onclick = () => {
      window._builderQuestions.push(Regular.newQuestion('multiple'));
      renderBuilder();
    };

    document.getElementById('create-exam-btn').onclick = async () => {
      const title = document.getElementById('exam-title').value.trim();
      const instructions = document.getElementById('exam-instructions').value.trim();
      const examType = document.getElementById('exam-type').value;
      const language = document.getElementById('exam-language').value;
      const subject = document.getElementById('exam-subject').value.trim() || 'General';
      const startAt = document.getElementById('exam-start').value;
      const endAt = document.getElementById('exam-end').value;
      const maxScore = Number(document.getElementById('exam-maxscore').value) || 50;
      if (!title || !instructions) { alert('Title and instructions required'); return; }
      if (!startAt || !endAt) { alert('Start and end time required'); return; }
      if (new Date(endAt) <= new Date(startAt)) { alert('End must be after start'); return; }
      try {
        const exam = await Exam.createExam({
          title, instructions, examType, language, subject, startAt, endAt, maxScore,
          starterCode: document.getElementById('exam-starter').value,
          answerKey: document.getElementById('exam-answer').value,
          questions: examType === 'regular' ? window._builderQuestions : []
        });
        alert('Exam created!');
        this.showTeacherHome();
        this.copyExamLink(exam.id);
      } catch (err) {
        alert('Error: ' + err.message);
      }
    };
  },

  copyExamLink(examId) {
    const url = `${window.location.origin}${window.location.pathname}?exam=${examId}`;
    navigator.clipboard.writeText(url).then(() => alert('Link copied:\n' + url)).catch(() => prompt('Copy link:', url));
  },

  async toggleExamActive(examId, active) {
    if (!confirm(active ? 'Reopen this exam?' : 'Close this exam?')) return;
    await Exam.updateExam(examId, { active });
    if (!active) {
      try { await Exam.deactivateProctorsForExam(examId); } catch (_) {}
    }
    this.showTeacherHome();
  },

  async duplicateExam(examId) {
    if (!confirm('Duplicate this exam? You can set a new schedule next.')) return;
    const start = prompt('New start (YYYY-MM-DDTHH:MM) or leave blank for now:', '');
    const mins = prompt('Duration in minutes:', '60');
    const startAt = start || new Date().toISOString();
    const endAt = new Date(new Date(startAt).getTime() + (Number(mins) || 60) * 60000).toISOString();
    try {
      const exam = await Exam.duplicateExam(examId, { startAt, endAt, durationMinutes: Number(mins) || 60 });
      alert('Duplicated: ' + exam.title);
      this.showTeacherHome();
    } catch (e) { alert(e.message); }
  },

  openLiveDashboard(examId) {
    this.renderShell(`<div id="live-container"></div>`, 'exams');
    Dashboard.renderLiveDashboard(document.getElementById('live-container'), examId, null);
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
    if (!confirm('Remove invite?')) return;
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
    this.renderShell(`
      <h2 class="page-title">Student Portal</h2>
      <p class="page-subtitle">Open the exam link from your teacher, or review your history and take mock exams.</p>
      <div class="card">
        <p>Exam links look like: <code>?exam=EXAM_ID</code></p>
        <div class="action-btns mt-2">
          <button class="btn btn-primary" onclick="App.showStudentHistory()">📚 History</button>
          <button class="btn btn-ghost" onclick="App.showMockExam()">🎲 Mock Exam</button>
        </div>
      </div>
    `, 'student');
  },

  async showStudentHistory() {
    this.renderShell(`<h2 class="page-title">Assessment History</h2><div id="hist">Loading...</div>`, 'history');
    const sessions = await Exam.listStudentSessions(Auth.currentUser.uid);
    const el = document.getElementById('hist');
    if (!sessions.length) {
      el.innerHTML = '<p class="text-muted">No assessments yet.</p>';
      return;
    }
    const code = sessions.filter(s => (s.examType || 'code') === 'code');
    const reg = sessions.filter(s => s.examType === 'regular');
    const block = (title, list) => `
      <div class="card mt-2"><h3>${title}</h3>
        ${list.map(s => `<div class="hist-item">
          <strong>${escapeHtml(s.examTitle || s.examId)}</strong>
          <span class="text-muted">${escapeHtml(s.subject || '')} · ${escapeHtml(s.status)}</span>
        </div>`).join('') || '<p class="text-muted">None</p>'}
      </div>`;
    el.innerHTML = block('Code assessments', code) + block('Regular assessments', reg);
  },

  async showMockExam() {
    this.renderShell(`
      <h2 class="page-title">Mock Exam</h2>
      <p class="page-subtitle">Combine past regular-assessment questions into a practice test (randomized).</p>
      <div class="card">
        <button class="btn btn-primary" id="start-mock">Generate mock from my history</button>
        <div id="mock-area" class="mt-2"></div>
      </div>
    `, 'mock');
    document.getElementById('start-mock').onclick = async () => {
      const sessions = await Exam.listStudentSessions(Auth.currentUser.uid);
      const examIds = [...new Set(sessions.filter(s => s.examType === 'regular').map(s => s.examId))];
      let questions = [];
      for (const id of examIds.slice(0, 10)) {
        const ex = await Exam.getExam(id);
        if (ex?.questions) questions = questions.concat(ex.questions);
      }
      // shuffle
      questions = questions.sort(() => Math.random() - 0.5).slice(0, 15);
      if (!questions.length) {
        document.getElementById('mock-area').innerHTML = '<p class="text-muted">No regular assessment questions in your history yet.</p>';
        return;
      }
      const area = document.getElementById('mock-area');
      area.innerHTML = questions.map(q => Regular.renderStudentQuestion(q, null)).join('') +
        `<button class="btn btn-primary mt-2" id="mock-done">Finish mock</button>`;
      document.getElementById('mock-done').onclick = () => {
        alert('Mock finished (practice only — not graded).');
        this.showStudentHome();
      };
    };
  },

  async startStudentExam(examId) {
    try {
      const session = await Exam.joinExam(examId);
      const exam = session.exam;
      if ((exam.examType || session.examType) === 'regular') {
        return this.startRegularExam(session);
      }
      return this.startCodeExam(session);
    } catch (err) {
      alert(err.message);
      this.showStudentHome();
    }
  },

  async startCodeExam(session) {
    const exam = session.exam;
    const lang = exam.language || session.language || 'python';
    document.getElementById('app').innerHTML = `
      <div class="lock-banner hidden" id="lock-banner"></div>
      <div id="timesup-overlay" class="timesup-overlay hidden">
        <div class="timesup-box"><h1>Time's up!</h1><p>Your code was submitted automatically.</p></div>
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
    document.getElementById('check-code-btn').onclick = () => CodeEditor.checkCode();
    document.getElementById('submit-exam-btn').onclick = async () => {
      if (!confirm('Submit exam?')) return;
      await Exam.submitSession(session.id, 'manual');
      CodeEditor.dispose();
      alert('Submitted.');
      this.showStudentHome();
    };
    this._runTimer(session);
  },

  async startRegularExam(session) {
    const exam = session.exam;
    const questions = exam.questions || [];
    document.getElementById('app').innerHTML = `
      <div class="lock-banner hidden" id="lock-banner"></div>
      <div id="timesup-overlay" class="timesup-overlay hidden">
        <div class="timesup-box"><h1>Time's up!</h1><p>Your answers were submitted automatically.</p></div>
      </div>
      <header class="app-header exam-header-bar">
        <div class="logo"><span class="logo-text">Regular Assessment</span></div>
        <div class="user-info">
          <span id="exam-timer" class="exam-timer">--:--</span>
          <button class="btn btn-sm btn-danger" id="submit-exam-btn">Submit</button>
        </div>
      </header>
      <div class="regular-exam-wrap">
        <div class="card"><h3>${escapeHtml(exam.title)}</h3>
          <p class="text-muted">${escapeHtml(exam.instructions || '')}</p></div>
        <div id="regular-questions"></div>
      </div>`;

    const box = document.getElementById('regular-questions');
    const answers = session.answers || {};
    box.innerHTML = questions.map(q => Regular.renderStudentQuestion(q, answers[q.id])).join('') ||
      '<p class="text-muted">No questions in this assessment.</p>';

    // Integrity for regular (copy/paste etc.)
    CodeEditor.sessionId = session.id;
    CodeEditor.examId = exam.id;
    CodeEditor._setupAntiCheat();

    let saveTimer;
    const save = () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        const a = Regular.collectAnswers(box);
        Exam.updateSessionAnswers(session.id, a).catch(console.error);
      }, 600);
    };
    box.addEventListener('change', save);
    box.addEventListener('input', save);

    document.getElementById('submit-exam-btn').onclick = async () => {
      if (!confirm('Submit assessment?')) return;
      await Exam.updateSessionAnswers(session.id, Regular.collectAnswers(box));
      await Exam.submitSession(session.id, 'manual');
      alert('Submitted.');
      this.showStudentHome();
    };
    this._runTimer(session, async () => {
      await Exam.updateSessionAnswers(session.id, Regular.collectAnswers(box));
    });
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
  async gradeSession(sessionId, examId) {
    const exam = await Exam.getExam(examId);
    const snap = await window.db.collection('sessions').doc(sessionId).get();
    if (!snap.exists) { alert('Not found'); return; }
    const session = { id: snap.id, ...snap.data() };
    const maxScore = Number(exam.maxScore) || 50;
    const auto = Exam.autoGrade(session.code, exam.answerKey, maxScore);
    const existing = await Exam.getGrade(sessionId);
    const scoreStr = prompt(
      `Grade ${session.studentName || session.studentEmail}\nMax: ${maxScore}\n` +
      (auto.note ? `Auto: ${auto.note} → ${auto.score}\n` : '') + `Score:`,
      String(existing?.score ?? auto.score ?? '')
    );
    if (scoreStr === null) return;
    const score = Number(scoreStr);
    if (Number.isNaN(score) || score < 0 || score > maxScore) { alert('Invalid'); return; }
    const comment = prompt('Comment:', existing?.comment || '') || '';
    const percent = Math.round((score / maxScore) * 1000) / 10;
    await Exam.saveGrade(sessionId, examId, {
      studentId: session.studentId, studentEmail: session.studentEmail, studentName: session.studentName,
      score, maxScore, percent, comment, method: 'manual'
    });
    alert(`Saved ${score}/${maxScore} (${percent}%)`);
  },

  async showExamResults(examId) {
    const exam = await Exam.getExam(examId);
    this.renderShell(`
      <div class="card-header page-header-responsive">
        <h2 class="page-title">Results — ${escapeHtml(exam.title)}</h2>
        <div class="action-btns">
          <button class="btn btn-ghost" onclick="App.exportSummary('${examId}')">Export CSV</button>
          <button class="btn btn-ghost" onclick="App.showTeacherHome()">Back</button>
        </div>
      </div>
      <div id="results-table">Loading...</div>
    `, 'exams');
    const sessionsSnap = await window.db.collection('sessions').where('examId', '==', examId).get();
    const sessions = sessionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const grades = await Exam.listGrades(examId);
    const gradeMap = Object.fromEntries(grades.map(g => [g.sessionId, g]));
    const el = document.getElementById('results-table');
    el.innerHTML = `<div class="table-wrap"><table class="table"><thead><tr>
      <th>Student</th><th>Email</th><th>Status</th><th>Score</th><th>%</th><th></th></tr></thead><tbody>
      ${sessions.map(s => {
        const g = gradeMap[s.id];
        return `<tr>
          <td>${escapeHtml(s.studentName||'')}</td><td>${escapeHtml(s.studentEmail||'')}</td>
          <td>${escapeHtml(s.status)}</td>
          <td>${g ? g.score+'/'+g.maxScore : '—'}</td>
          <td>${g ? g.percent+'%' : '—'}</td>
          <td class="action-btns">
            <button class="btn btn-sm btn-primary" onclick="App.gradeSession('${s.id}','${examId}')">Grade</button>
            <button class="btn btn-sm btn-ghost" onclick="App.exportStudentReport('${s.id}','${examId}')">Export</button>
          </td></tr>`;
      }).join('')}</tbody></table></div>`;
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
    if (!confirm('Log out?')) return;
    clearInterval(this._examTimerInterval);
    Dashboard.clearListeners();
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
