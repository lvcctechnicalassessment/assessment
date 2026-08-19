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
          <div class="app-version">Build v1.4.9</div>
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
        <div class="nav-item ${activeNav==='teachers'?'active':''}" onclick="App.showSuperAdmin();App.toggleMobileNav()">👥 Instructors</div>
        <div class="nav-item ${activeNav==='exams'?'active':''}" onclick="App.showTeacherHome();App.toggleMobileNav()">📝 My Assessments</div>`;
    } else if (role === 'teacher') {
      navItems = `
        <div class="nav-item ${activeNav==='exams'?'active':''}" onclick="App.showTeacherHome();App.toggleMobileNav()">📝 My Assessments</div>`;
    } else if (role === 'proctor') {
      navItems = `
        <div class="nav-item ${activeNav==='proctor'?'active':''}" onclick="App.showProctorHome();App.toggleMobileNav()">👁 Proctor</div>`;
    } else {
      navItems = `
        <div class="nav-item ${activeNav==='student'?'active':''}" onclick="App.showStudentHome();App.toggleMobileNav()">🏠 Home</div>
        <div class="nav-item ${activeNav==='history'?'active':''}" onclick="App.showStudentHistory();App.toggleMobileNav()">📚 History</div>
        <div class="nav-item ${activeNav==='mock'?'active':''}" onclick="App.showMockExam();App.toggleMobileNav()">🎲 Mock History</div>`;
    }

    document.getElementById('app').innerHTML = `
      <header class="app-header">
        <div class="header-left">
          <div class="logo">
            <img src="assets/lvcc-logo.png" alt="LVCC" class="header-logo" width="36" height="36" />
            <span class="logo-text">LVCC Assessment Portal</span><span class="app-version">v1.4.9</span>
          </div>
        </div>
        <div class="header-right">
          ${Theme.buttonHtml()}
          <div class="user-info header-user-desktop">
            <span class="role-badge ${role}">${role}</span>
            <span class="user-name">${escapeHtml(name)}</span>
            <button class="btn btn-sm btn-ghost" onclick="App.logout()">Logout</button>
          </div>
          <button class="btn btn-ghost btn-sm menu-toggle" onclick="App.toggleMobileNav()" aria-label="Menu">☰</button>
        </div>
      </header>
      <div id="nav-backdrop" class="nav-backdrop" onclick="App.toggleMobileNav()"></div>
      <div class="dashboard">
        <aside class="sidebar" id="sidebar">
          <h3>Menu</h3>
          ${navItems}
          <div class="sidebar-user">
            <div class="text-muted" style="font-size:0.75rem;margin-bottom:0.35rem">Signed in</div>
            <div style="font-weight:600;word-break:break-all">${escapeHtml(name)}</div>
            <span class="role-badge ${role}" style="margin-top:0.35rem;display:inline-block">${role}</span>
            <div class="mt-1">${Theme.buttonHtml()}</div>
            <button class="btn btn-sm btn-ghost w-full mt-1" onclick="App.logout()">Logout</button>
          </div>
        </aside>
        <main class="main-content" id="main-content">${contentHtml}</main>
      </div>`;
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

  async showCreateExam() {
    if (!window._editingExamId) window._editingExamId = null;
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
            <label>Answer key (optional)</label>
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
            <button class="btn btn-ghost" id="draft-exam-btn">Save draft</button>
            <button class="btn btn-primary" id="create-exam-btn">Publish…</button>
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
      const p = buildPayload('draft');
      if (!p.title) { await UI.alert('Title is required'); return; }
      try {
        await Exam.createExam({
          ...p,
          startAt: p.startAt || new Date().toISOString(),
          endAt: p.endAt || new Date(Date.now()+3600000).toISOString(),
          // draft: schedule set on publish

          starterCode: document.getElementById('exam-starter').value,
          answerKey: document.getElementById('exam-answer').value,
          questions: p.examType === 'regular' ? window._builderQuestions : [],
          sections: p.examType === 'regular' ? (window._builderSections || []) : [],
          status: 'draft',
          active: false
        });
        this.clearAutosave(); window._editingExamId = null;
        await UI.alert('Draft saved. You can edit and publish later.', 'Draft');
        this.showTeacherHome();
      } catch (err) { await UI.alert(err.message || String(err), 'Error'); }
    };

    document.getElementById('create-exam-btn').onclick = async () => {
      const title = document.getElementById('exam-title').value.trim();
      const instructions = (document.getElementById('exam-instructions')?.value || '').trim();
      const examType = document.getElementById('exam-type').value;
      const language = document.getElementById('exam-language').value;
      const subject = document.getElementById('exam-subject').value.trim() || 'General';
      const startAt = document.getElementById('exam-start')?.value || '';
      const endAt = document.getElementById('exam-end')?.value || '';
      const maxScore = examType === 'regular' ? 0 : (Number(document.getElementById('exam-maxscore').value) || 100);
      if (!title) { await UI.alert('Title is required.', 'Missing fields'); return; }
      if (examType === 'regular') {
        const qs = window._builderQuestions || [];
        const missing = qs.filter(q => q.type !== 'essay' && (q.correct === undefined || q.correct === null || q.correct === ''));
        if (missing.length) {
          await UI.alert('Every question except Essay must have a correct answer configured.', 'Correct answers required');
          return;
        }
      }
      let pubStart = startAt, pubEnd = endAt;
      if (!pubStart || !pubEnd) {
        const sched = await this.pickSchedule();
        if (!sched) return;
        pubStart = new Date(sched.startAt).toISOString();
        pubEnd = new Date(sched.endAt).toISOString();
      }
      if (new Date(pubEnd) <= new Date(pubStart)) { await UI.alert('End must be after start.', 'Schedule'); return; }
      if (new Date(pubStart).getTime() < Date.now() - 60000) {
        await UI.alert('Start time cannot be before the current date and time.', 'Schedule');
        return;
      }
      try {
        const exam = await Exam.createExam({
          title, instructions, examType, language, subject, startAt: pubStart, endAt: pubEnd, maxScore,
          starterCode: document.getElementById('exam-starter').value,
          answerKey: document.getElementById('exam-answer').value,
          questions: examType === 'regular' ? window._builderQuestions : [],
          sections: examType === 'regular' ? (window._builderSections || []) : [],
          status: 'published',
          active: true
        });
        this.clearAutosave();
        await UI.alert('Assessment published. Share the link or QR with students.', 'Published');
        this.showSharePanel(exam.id);
      } catch (err) {
        await UI.alert(err.message || String(err), 'Error');
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

  showSharePanel(examId) {
    const url = `${window.location.origin}${window.location.pathname}?exam=${examId}`;
    const qr = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(url);
    this.renderShell(`
      <h2 class="page-title">Share assessment</h2>
      <div class="card share-panel">
        <p class="text-muted">Students open this link (or scan the QR) while signed in.</p>
        <div class="form-group">
          <label>Link</label>
          <input class="form-control" id="share-url" readonly value="${url.replace(/"/g, '&quot;')}" />
        </div>
        <div class="action-btns">
          <button class="btn btn-primary" id="copy-share">Copy link</button>
          <button class="btn btn-ghost" onclick="App.showTeacherHome()">Back</button>
        </div>
        <div class="qr-wrap mt-2">
          <img src="${qr}" alt="QR code" width="220" height="220" />
          <p class="text-muted" style="font-size:0.85rem">Scan to open assessment</p>
        </div>
      </div>
    `, 'exams');
    document.getElementById('copy-share').onclick = () => {
      navigator.clipboard.writeText(url).then(() => UI.alert('Link copied.', 'Share')).catch(() => {});
    };
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

  async editExam(examId) {
    window._editingExamId = examId;
    const exam = await Exam.getExam(examId);
    if (!exam) { await UI.alert('Assessment not found.', 'Error'); return; }
    // Reuse create UI prefilled
    await this.showCreateExam();
    // Prefill after DOM ready
    setTimeout(() => {
      const set = (id, val) => { const el = document.getElementById(id); if (el && val != null) el.value = val; };
      set('exam-title', exam.title);
      set('exam-subject', exam.subject || 'General');
      set('exam-type', exam.examType || 'regular');
      set('exam-language', exam.language || 'python');
      set('exam-starter', exam.starterCode || '');
      set('exam-answer', exam.answerKey || '');
      set('exam-maxscore', exam.maxScore || 100);
      document.getElementById('exam-type')?.dispatchEvent(new Event('change'));
      window._builderSections = exam.sections && exam.sections.length
        ? JSON.parse(JSON.stringify(exam.sections))
        : [];
      if (!window._builderSections.length && (exam.questions || []).length) {
        // migrate flat questions into one section
        const sec = Regular.newSection('Questions');
        sec.questions = JSON.parse(JSON.stringify(exam.questions));
        window._builderSections = [sec];
      }
      window._builderQuestions = (window._builderSections || []).flatMap(s => s.questions || []);
      // trigger render if available
      const box = document.getElementById('questions-builder');
      if (box && window._builderSections) {
        // re-call by clicking type or force rebuild via custom event
        document.getElementById('exam-type')?.dispatchEvent(new Event('change'));
      }
      // Override create buttons to update existing
      const draftBtn = document.getElementById('draft-exam-btn');
      const pubBtn = document.getElementById('create-exam-btn');
      const saveUpdate = async (publish) => {
        const title = document.getElementById('exam-title').value.trim();
        if (!title) { await UI.alert('Title is required.', 'Missing fields'); return; }
      if (examType === 'regular') {
        const qs = window._builderQuestions || [];
        const missing = qs.filter(q => q.type !== 'essay' && (q.correct === undefined || q.correct === null || q.correct === ''));
        if (missing.length) {
          await UI.alert('Every question except Essay must have a correct answer configured.', 'Correct answers required');
          return;
        }
      }
        const examType = document.getElementById('exam-type').value;
        const updates = {
          title,
          subject: document.getElementById('exam-subject').value.trim() || 'General',
          examType,
          language: document.getElementById('exam-language').value,
          starterCode: document.getElementById('exam-starter')?.value || '',
          answerKey: document.getElementById('exam-answer')?.value || '',
          maxScore: examType === 'regular' ? 0 : (Number(document.getElementById('exam-maxscore')?.value) || 100),
          questions: examType === 'regular' ? (window._builderQuestions || []) : [],
          sections: examType === 'regular' ? (window._builderSections || []) : [],
        };
        if (publish) {
          updates.status = 'published';
          updates.active = true;
        }
        await Exam.updateExam(examId, updates);
        await UI.alert('Changes saved.', 'Saved');
        if (publish) this.showSharePanel(examId);
        else this.showTeacherHome();
      };
      if (draftBtn) draftBtn.onclick = () => saveUpdate(false);
      if (pubBtn) {
        pubBtn.textContent = exam.status === 'draft' ? 'Publish…' : 'Save';
        pubBtn.onclick = async () => {
          if (exam.status === 'draft') {
            // schedule then publish
            await saveUpdate(false);
            await this.publishDraft(examId);
          } else {
            await saveUpdate(false);
          }
        };
      }
      // Render sections builder
      try {
        const syncFlat = () => { window._builderQuestions = (window._builderSections || []).flatMap(s => s.questions || []); };
        // minimal re-render trigger: add temporary note
        const note = document.createElement('p');
        note.className = 'text-muted';
        note.textContent = 'Editing assessment — save when done. Re-open type sections from the type picker if needed.';
        document.getElementById('questions-builder')?.prepend(note);
      } catch (_) {}
    }, 50);
  },


  async toggleExamActive(examId, active) {
    if (!(await UI.confirm(active ? 'Reopen this assessment?' : 'Close this assessment?', 'Confirm'))) return;
    await Exam.updateExam(examId, { active });
    if (!active) {
      try { await Exam.deactivateProctorsForExam(examId); } catch (_) {}
    }
    this.showTeacherHome();
  },

  async duplicateExam(examId) {
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
    this.renderShell(`
      <h2 class="page-title">Assessment History</h2>
      <div class="hist-section">
        <div class="hist-section-head">
          <h3>Code assessments</h3>
          <input type="search" id="hist-filter-code" class="form-control" placeholder="Filter code assessments..." />
        </div>
        <div id="hist-code" class="table-wrap">Loading...</div>
      </div>
      <div class="hist-section mt-2">
        <div class="hist-section-head">
          <h3>Regular assessments</h3>
          <input type="search" id="hist-filter-reg" class="form-control" placeholder="Filter regular assessments..." />
        </div>
        <div id="hist-reg" class="table-wrap">Loading...</div>
      </div>
    `, 'history');

    const sessions = await Exam.listStudentSessions(Auth.currentUser.uid);
    const grades = {};
    for (const s of sessions) {
      try {
        const g = await Exam.getGrade(s.id);
        if (g) grades[s.id] = g;
      } catch (_) {}
    }

    const enrich = async (s) => {
      const exam = await Exam.getExam(s.examId).catch(() => null);
      const questions = exam ? Regular.flattenQuestions(exam) : [];
      const total = questions.length || (s.code != null ? 1 : 0);
      let correct = 0, incorrect = 0, unattempted = 0, partial = 0;
      if (questions.length && s.answers) {
        questions.forEach(q => {
          const a = s.answers[q.id];
          if (a === undefined || a === null || a === '' || (Array.isArray(a) && !a.length)) {
            unattempted++;
            return;
          }
          if (q.type === 'essay') { partial++; return; }
          const g = Regular.gradeAnswers([q], { [q.id]: a });
          if (g.score >= (g.maxScore || 1)) correct++;
          else if (g.score > 0) partial++;
          else incorrect++;
        });
      } else if (grades[s.id]) {
        const pct = Number(grades[s.id].percent) || 0;
        if (pct >= 100) correct = total;
        else if (pct <= 0) incorrect = total;
        else { partial = 1; incorrect = Math.max(0, total - 1); }
      }
      return { s, exam, total, correct, incorrect, unattempted, partial, grade: grades[s.id] };
    };

    const enriched = [];
    for (const s of sessions) enriched.push(await enrich(s));

    const renderTable = (list, elId, filterId) => {
      const el = document.getElementById(elId);
      const q = (document.getElementById(filterId)?.value || '').toLowerCase();
      const filtered = q ? list.filter(x =>
        (x.s.examTitle || '').toLowerCase().includes(q) ||
        (x.s.subject || '').toLowerCase().includes(q)
      ) : list;
      if (!filtered.length) {
        el.innerHTML = '<p class="text-muted">No assessments in this section.</p>';
        return;
      }
      el.innerHTML = `<table class="table">
        <thead><tr>
          <th>Title</th><th>Subject</th><th>Status</th>
          <th>Total Questions</th><th>Correct</th><th>Incorrect</th><th>Unattempted</th><th>Partially Correct</th>
        </tr></thead>
        <tbody>${filtered.map(x => `
          <tr class="hist-row" style="cursor:pointer" onclick="App.showStudentAttempt('${x.s.id}')">
            <td data-label="Title">${escapeHtml(x.s.examTitle || x.s.examId)}</td>
            <td data-label="Subject">${escapeHtml(x.s.subject || '')}</td>
            <td data-label="Status">${escapeHtml(x.s.status || '')}</td>
            <td data-label="Total">${x.total}</td>
            <td data-label="Correct">${x.correct}</td>
            <td data-label="Incorrect">${x.incorrect}</td>
            <td data-label="Unattempted">${x.unattempted}</td>
            <td data-label="Partial">${x.partial}</td>
          </tr>`).join('')}</tbody></table>`;
    };

    const code = enriched.filter(x => (x.s.examType || 'code') !== 'regular');
    const reg = enriched.filter(x => x.s.examType === 'regular');
    renderTable(code, 'hist-code', 'hist-filter-code');
    renderTable(reg, 'hist-reg', 'hist-filter-reg');
    document.getElementById('hist-filter-code').oninput = () => renderTable(code, 'hist-code', 'hist-filter-code');
    document.getElementById('hist-filter-reg').oninput = () => renderTable(reg, 'hist-reg', 'hist-filter-reg');
  },

  formatAnswerDisplay(q, value, isCorrectKey = false) {
    if (!q) return '—';
    const opts = (q.options || []).map((o, i) => {
      const s = o == null ? '' : String(o).trim();
      return s || ('Option ' + (i + 1));
    });
    const labelAt = (i) => {
      const n = Number(i);
      if (!Number.isNaN(n) && opts[n] != null) return opts[n];
      return i == null || i === '' ? '—' : String(i);
    };

    if (isCorrectKey) {
      if (q.type === 'essay') return '(Evaluated by instructor)';
      if (q.type === 'multiple' || q.type === 'dropdown' || q.type === 'multiselect') {
        if (q.multiCorrect === true && Array.isArray(q.correct)) {
          return q.correct.map(labelAt).join(', ') || '—';
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
        if (q.correct != null && q.correct !== '') return String(q.correct);
        return '—';
      }
      if (q.correct != null && q.correct !== '') {
        return typeof q.correct === 'object' ? JSON.stringify(q.correct) : String(q.correct);
      }
      return '—';
    }

    // student response
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

    this.renderShell(`
      <div class="card-header page-header-responsive">
        <h2 class="page-title">${escapeHtml(session.examTitle || exam?.title || 'Attempt')}</h2>
        <div class="action-btns">
          <button class="btn btn-ghost" id="export-attempt-pdf">Export PDF</button>
          <button class="btn btn-ghost" onclick="App.showStudentHistory()">Back</button>
        </div>
      </div>
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

  downloadAttemptPdf(session, exam, rows) {
    const title = session.examTitle || exam?.title || 'Attempt';
    // Prefer jsPDF if loaded
    if (window.jspdf && window.jspdf.jsPDF) {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const margin = 40;
      let y = margin;
      const pageW = doc.internal.pageSize.getWidth();
      const maxW = pageW - margin * 2;
      doc.setFontSize(14);
      doc.text(title, margin, y); y += 20;
      doc.setFontSize(10);
      doc.text(`${session.studentName || ''}  ${session.studentEmail || ''}`, margin, y); y += 18;
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
      UI.alert('PDF downloaded.', 'Export');
      return;
    }
    // Fallback: print-to-pdf via hidden iframe
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
      <style>body{font-family:system-ui;padding:24px}h1{font-size:18px}
      .q{margin:12px 0;padding:10px;border:1px solid #ddd;border-radius:8px}
      .label{font-weight:600;font-size:12px;color:#555}</style></head><body>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(session.studentName || '')} · ${escapeHtml(session.studentEmail || '')}</p>
      ${rows.map((r, i) => `<div class="q"><div><strong>Q${i + 1}.</strong> ${escapeHtml(r.prompt)}</div>
        <div class="label">Your response</div><div>${escapeHtml(r.response)}</div>
        <div class="label">Correct answer</div><div>${escapeHtml(r.correct)}</div></div>`).join('')}
      </body></html>`;
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open(); doc.write(html); doc.close();
    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => iframe.remove(), 1000);
    }, 300);
    UI.alert('Use the print dialog → Save as PDF.', 'Export');
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
    const url = new URL(window.location.href);
    url.searchParams.set('exam', examId);
    url.searchParams.set('test', '1');
    window.open(url.toString(), '_blank', 'noopener');
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
        // Preview session (not graded / not listed as real taker)
        session = {
          id: 'test_' + Date.now(),
          examId,
          exam,
          code: exam.starterCode || '',
          answers: {},
          status: 'test',
          endsAt: endAt,
          studentEmail: Auth.userProfile.email,
          studentName: (Auth.userProfile.name || '') + ' (Test)'
        };
      } else {
        session = await Exam.joinExam(examId);
      }
      // Monitor gate handles fullscreen + capture
      session._testMode = isTest;
      window._testMode = isTest;
      await Monitor.showEntryGate(session.id, exam.id || examId);
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
      // Chat from instructor
      if (s.lastInstructorMessage && s.lastInstructorMessage !== this._lastInstructorChat) {
        this._lastInstructorChat = s.lastInstructorMessage;
        await UI.alert(String(s.lastInstructorMessage || ''), 'Message from Instructor');
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
    fab.onclick = async () => {
      const msg = await UI.prompt('Message your instructor:', '', 'Talk to instructor', 'Talk to instructor');
      if (msg == null) return;
      const text = String(msg).trim();
      if (!text) {
        await UI.alert('Please type a message.', 'Empty');
        return;
      }
      try {
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
      }
    };
    document.body.appendChild(fab);
  },

  async startRegularExam(session) {
    const exam = session.exam;
    const questions = exam.questions || [];
    document.getElementById('app').innerHTML = `
      <div class="lock-banner hidden" id="lock-banner"></div>
      <div id="timesup-overlay" class="timesup-overlay hidden">
        <div class="timesup-box">
          <h1>Time's up!</h1>
          <p>Your answers were submitted automatically.</p>
          <div class="action-btns" style="justify-content:center;margin-top:1rem">
            <button class="btn btn-primary" onclick="App.showStudentHistory()">View results</button>
            <button class="btn btn-ghost" onclick="App.showStudentHome()">Back to home</button>
          </div>
        </div>
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

    let saveTimer;
    const save = () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        const a = Regular.collectAnswers(box);
        Exam.updateSessionAnswers(session.id, a).catch(console.error);
      }, 600);
    };
    Regular.bindStudentMC(box, save);
    box.addEventListener('change', save);
    box.addEventListener('input', save);

    // Integrity for regular (copy/paste etc.)
    CodeEditor.sessionId = session.id;
    CodeEditor.examId = exam.id;
    CodeEditor._setupAntiCheat();
    // Monitor handles screen/heartbeat
    // CodeEditor.startScreenShare(2500);
    this._endedHandled = false;
    this._watchTeacherEnd(session.id);
    this.injectTestModeBar();
    this.injectStudentChatFab(session.id);

    document.getElementById('submit-exam-btn').onclick = async () => {
      const ok = await UI.confirm('Submit this assessment? You will not be able to edit further.', 'Submit');
      if (!ok) return;
      CodeEditor.beginSubmit();
      await Exam.updateSessionAnswers(session.id, Regular.collectAnswers(box));
      await Exam.submitSession(session.id, 'manual');
      this.clearExamQuery();
      await UI.alert('Submitted successfully.', 'Done');
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
        <div class="form-group"><label>Start</label>
          <input type="datetime-local" id="sched-start" class="form-control" value="${toLocal(now)}" /></div>
        <div class="form-group"><label>End</label>
          <input type="datetime-local" id="sched-end" class="form-control" value="${toLocal(later)}" /></div>
        <div class="modal-actions">
          <button class="btn btn-ghost" id="sched-cancel">Cancel</button>
          <button class="btn btn-primary" id="sched-ok">Publish</button>
        </div>
      </div></div>`;
      document.getElementById('sched-cancel').onclick = () => { UI.close(); resolve(null); };
      document.getElementById('sched-ok').onclick = () => {
        const startAt = new Date(document.getElementById('sched-start').value).getTime();
        const endAt = new Date(document.getElementById('sched-end').value).getTime();
        if (!startAt || !endAt || endAt <= startAt) {
          UI.alert('End must be after start.', 'Schedule');
          return;
        }
        if (startAt < Date.now() - 60000) {
          UI.alert('Start cannot be in the past.', 'Schedule');
          return;
        }
        UI.close();
        resolve({ startAt, endAt });
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
      el.innerHTML = `<div class="table-wrap"><table class="table integrity-table">
        <thead><tr><th></th><th>Name</th><th>Email</th><th>Issue</th><th>Date stamp</th></tr></thead>
        <tbody>${deduped.map(n => {
          const time = n.createdAt?.toDate ? n.createdAt.toDate().toLocaleString()
            : (n.timestamp ? new Date(n.timestamp).toLocaleString() : '');
          const thumb = n.screenshot || n.extra?.screenshot || n.screenThumb;
          return `<tr>
            <td data-label="Shot">${thumb ? `<img class="integrity-thumb" src="${thumb}" onclick="UI.showImage(this.src,'Integrity screenshot')" />` : '—'}</td>
            <td data-label="Name">${escapeHtml(n.studentName || '—')}</td>
            <td data-label="Email">${escapeHtml(n.studentEmail || '—')}</td>
            <td data-label="Issue"><span class="chip">${escapeHtml(n.type || '')}</span> ${escapeHtml(n.details || '')}</td>
            <td data-label="Date">${time}</td>
          </tr>`;
        }).join('')}</tbody></table></div>`;
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
    document.getElementById('btn-export-integrity-pdf').onclick = () => {
      const rows = window._integrityExportRows || all;
      const body = rows.map(n => {
        const time = n.createdAt?.toDate ? n.createdAt.toDate().toLocaleString()
          : (n.timestamp ? new Date(n.timestamp).toLocaleString() : '');
        const thumb = n.screenshot || n.extra?.screenshot || n.screenThumb;
        return `<tr>
          <td>${thumb ? `<img src="${thumb}" style="width:80px;height:auto;border-radius:4px"/>` : '—'}</td>
          <td>${escapeHtml(n.studentName||'')}</td><td>${escapeHtml(n.studentEmail||'')}</td>
          <td>${escapeHtml(n.type||'')}</td><td>${escapeHtml(n.details||'')}</td><td>${time}</td></tr>`;
      }).join('');
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Integrity</title>
        <style>body{font-family:system-ui;padding:24px}table{border-collapse:collapse;width:100%}
        th,td{border:1px solid #ccc;padding:8px;font-size:12px;vertical-align:top}th{background:#eee}
        img{max-width:100px}</style></head><body>
        <h1>Integrity issues — ${escapeHtml(exam?.title||'')}</h1>
        <table><thead><tr><th>Screenshot</th><th>Name</th><th>Email</th><th>Issue</th><th>Details</th><th>Date</th></tr></thead>
        <tbody>${body}</tbody></table></body></html>`;
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'integrity-' + examId + '.html';
      link.click();
      URL.revokeObjectURL(link.href);
      UI.alert('Downloaded. Open the file and use Print → Save as PDF if needed.', 'Export');
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
      rows.push([]);
      rows.push(['Summary']);
      rows.push(['Students', studentCount]);
      rows.push(['Total items', totalItems]);
      rows.push(['Average %', avg.toFixed(1)]);
      rows.push(['Perfect scores', perfect]);
      hardest.forEach((h, i) => rows.push(['Hardest Q'+(i+1), h.prompt, h.wrong + ' wrong']));
      const csv = rows.map(r => r.map(c => '"'+String(c).replace(/"/g,'""')+'"').join(',')).join('\\n');
      // Excel-friendly CSV
      downloadText(`results-${examId}.csv`, '\uFEFF' + csv);
      UI.alert('Exported results as CSV (opens in Excel).', 'Export');
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
