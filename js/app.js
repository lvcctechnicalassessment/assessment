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
          <button class="btn btn-ghost btn-sm menu-toggle" onclick="App.toggleMobileNav()" aria-label="Menu">☰</button>
          <div class="logo">
            <img src="assets/lvcc-logo.png" alt="LVCC" class="header-logo" width="36" height="36" />
            <span class="logo-text">LVCC Assessment Portal</span>
          </div>
        </div>
        <div class="user-info header-user-desktop">
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
          <div class="sidebar-user">
            <div class="text-muted" style="font-size:0.75rem;margin-bottom:0.35rem">Signed in</div>
            <div style="font-weight:600;word-break:break-all">${escapeHtml(name)}</div>
            <span class="role-badge ${role}" style="margin-top:0.35rem;display:inline-block">${role}</span>
            <button class="btn btn-sm btn-ghost w-full mt-1" onclick="App.logout()">Logout</button>
          </div>
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
    if (!Auth.isTeacher()) {
      alert('Only teachers can create assessments. Students can generate mock assessments from History.');
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
          <div class="card-title">Questions</div>
          <div id="questions-builder"></div>
          <button type="button" class="btn btn-ghost mt-1" id="add-q-btn">+ Add question</button>
        </div>
        <div class="modal-actions action-btns">
          <button class="btn btn-ghost" onclick="App.showTeacherHome()">Cancel</button>
          <button class="btn btn-ghost" id="draft-exam-btn">Save draft</button>
          <button class="btn btn-primary" id="create-exam-btn">Publish…</button>
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

    window._builderQuestions = [];
    const renderBuilder = () => {
      const box = document.getElementById('questions-builder');
      box.innerHTML = window._builderQuestions.map((q, i) => {
        const typeSel = `<div class="form-row" style="margin-bottom:0.5rem">
          <select data-i="${i}" class="form-control q-type">
            ${QUESTION_TYPES.map(t => `<option value="${t.id}" ${q.type===t.id?'selected':''}>${t.label}</option>`).join('')}
          </select>
          <button class="btn btn-sm btn-danger" data-del="${i}">Remove</button>
        </div>`;
        if (q.type === 'multiple' || q.type === 'multiselect') {
          return `<div class="card">${typeSel}${Regular.renderBuilderMC(q, i)}</div>`;
        }
        return `<div class="card q-edit">${typeSel}
          <textarea class="form-control q-prompt" data-i="${i}" placeholder="Type question here" rows="2">${escapeHtml(q.prompt||'')}</textarea>
          <input class="form-control mt-1" data-correct-text="${i}" value="${escapeHtml(String(q.correct ?? ''))}" placeholder="Correct answer" />
        </div>`;
      }).join('') || '<p class="text-muted">No questions yet. Add one and mark the correct option with ✓.</p>';

      box.querySelectorAll('.q-type').forEach(el => {
        el.onchange = () => {
          window._builderQuestions[Number(el.dataset.i)] = Regular.newQuestion(el.value);
          renderBuilder();
        };
      });
      box.querySelectorAll('[data-del]').forEach(el => {
        el.onclick = () => {
          window._builderQuestions.splice(Number(el.dataset.del), 1);
          renderBuilder();
        };
      });
      box.querySelectorAll('[data-prompt]').forEach(el => {
        el.oninput = () => { window._builderQuestions[Number(el.dataset.prompt)].prompt = el.value; };
      });
      box.querySelectorAll('.q-prompt').forEach(el => {
        if (el.dataset.i !== undefined) el.oninput = () => { window._builderQuestions[Number(el.dataset.i)].prompt = el.value; };
      });
      box.querySelectorAll('[data-opt-text]').forEach(el => {
        el.oninput = () => {
          const [qi, oi] = el.dataset.optText.split(':').map(Number);
          window._builderQuestions[qi].options[oi] = el.value;
        };
      });
      box.querySelectorAll('[data-correct]').forEach(el => {
        el.onclick = () => {
          const [qi, oi] = el.dataset.correct.split(':').map(Number);
          const q = window._builderQuestions[qi];
          if (q.type === 'multiselect' || q.multiCorrect) {
            const arr = Array.isArray(q.correct) ? q.correct.map(Number) : [];
            const idx = arr.indexOf(oi);
            if (idx >= 0) arr.splice(idx, 1); else arr.push(oi);
            q.correct = arr;
          } else {
            q.correct = oi;
          }
          renderBuilder();
        };
      });
      box.querySelectorAll('[data-del-opt]').forEach(el => {
        el.onclick = () => {
          const [qi, oi] = el.dataset.delOpt.split(':').map(Number);
          window._builderQuestions[qi].options.splice(oi, 1);
          renderBuilder();
        };
      });
      box.querySelectorAll('[data-add-opt]').forEach(el => {
        el.onclick = () => {
          const qi = Number(el.dataset.addOpt);
          window._builderQuestions[qi].options.push('');
          renderBuilder();
        };
      });
      box.querySelectorAll('[data-multi]').forEach(el => {
        el.onchange = () => {
          const qi = Number(el.dataset.multi);
          const q = window._builderQuestions[qi];
          q.multiCorrect = el.checked;
          q.type = el.checked ? 'multiselect' : 'multiple';
          q.correct = el.checked ? (Array.isArray(q.correct) ? q.correct : [q.correct].filter(x => x !== undefined)) : (Array.isArray(q.correct) ? (q.correct[0] ?? 0) : q.correct);
          renderBuilder();
        };
      });
      box.querySelectorAll('[data-correct-text]').forEach(el => {
        el.oninput = () => { window._builderQuestions[Number(el.dataset.correctText)].correct = el.value; };
      });
    };
    document.getElementById('add-q-btn').onclick = () => {
      window._builderQuestions.push(Regular.newQuestion('multiple'));
      renderBuilder();
    };

    const buildPayload = (status) => {
      const title = document.getElementById('exam-title').value.trim();
      const instructions = document.getElementById('exam-instructions').value.trim();
      const examType = document.getElementById('exam-type').value;
      const language = document.getElementById('exam-language').value;
      const subject = document.getElementById('exam-subject').value.trim() || 'General';
      const startAt = document.getElementById('exam-start').value;
      const endAt = document.getElementById('exam-end').value;
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
          starterCode: document.getElementById('exam-starter').value,
          answerKey: document.getElementById('exam-answer').value,
          questions: p.examType === 'regular' ? window._builderQuestions : [],
          status: 'draft',
          active: false
        });
        await UI.alert('Draft saved. You can edit and publish later.', 'Draft');
        this.showTeacherHome();
      } catch (err) { await UI.alert(err.message); }
    };

    document.getElementById('create-exam-btn').onclick = async () => {
      const title = document.getElementById('exam-title').value.trim();
      const instructions = document.getElementById('exam-instructions').value.trim();
      const examType = document.getElementById('exam-type').value;
      const language = document.getElementById('exam-language').value;
      const subject = document.getElementById('exam-subject').value.trim() || 'General';
      const startAt = document.getElementById('exam-start').value;
      const endAt = document.getElementById('exam-end').value;
      const maxScore = examType === 'regular' ? 0 : (Number(document.getElementById('exam-maxscore').value) || 100);
      if (!title || !instructions) { alert('Title and instructions required'); return; }
      if (!startAt || !endAt) { alert('Start and end time required'); return; }
      if (new Date(endAt) <= new Date(startAt)) { alert('End must be after start'); return; }
      // Scheduled start cannot be in the past (allow 1 min skew)
      if (new Date(startAt).getTime() < Date.now() - 60000) {
        alert('Start time cannot be before the current date and time.');
        return;
      }
      try {
        const exam = await Exam.createExam({
          title, instructions, examType, language, subject, startAt, endAt, maxScore,
          starterCode: document.getElementById('exam-starter').value,
          answerKey: document.getElementById('exam-answer').value,
          questions: examType === 'regular' ? window._builderQuestions : [],
          status: 'published',
          active: true
        });
        await UI.alert('Assessment published. Share the link or QR with students.', 'Published');
        this.showSharePanel(exam.id);
      } catch (err) {
        alert('Error: ' + err.message);
      }
    };
  },

  copyExamLink(examId) {
    const url = `${window.location.origin}${window.location.pathname}?exam=${examId}`;
    navigator.clipboard.writeText(url).then(() => alert('Assessment link copied to clipboard.')).catch(() => {
      // silent fallback without ugly prompt URL when possible
      const ta = document.createElement('textarea');
      ta.value = url; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); alert('Assessment link copied to clipboard.'); } catch (_) {}
      ta.remove();
    });
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
      navigator.clipboard.writeText(url).then(() => alert('Link copied.')).catch(() => {});
    };
  },

  async shareToCoTeacher(examId) {
    const email = prompt('Co-teacher email (La Verdad account):');
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
      alert('Shared with co-teacher. They will see a fresh copy to configure.');
    } catch (e) {
      alert(e.message || String(e));
    }
  },

  async deleteExam(examId, title) {
    const typed = prompt('Type the assessment name to confirm deletion:\n\n' + title);
    if (typed === null) return;
    if (typed.trim() !== title.trim()) {
      alert('Name did not match. Deletion cancelled.');
      return;
    }
    if (!confirm('Permanently delete this assessment?')) return;
    try {
      await Exam.deleteExam(examId);
      alert('Assessment deleted.');
      this.showTeacherHome();
    } catch (e) {
      alert(e.message);
    }
  },

  async editExam(examId) {
    const exam = await Exam.getExam(examId);
    if (!exam) { alert('Not found'); return; }
    const toLocal = (ms) => {
      const d = new Date(ms);
      const pad = n => String(n).padStart(2, '0');
      return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    };
    this.renderShell(`
      <h2 class="page-title">Edit assessment</h2>
      <div class="card">
        <div class="form-group"><label>Title</label>
          <input id="edit-title" class="form-control" value="${escapeHtml(exam.title || '')}" /></div>
        <div class="form-group"><label>Instructions</label>
          <textarea id="edit-instructions" class="form-control" rows="4">${escapeHtml(exam.instructions || '')}</textarea></div>
        <div class="form-row">
          <div class="form-group"><label>Start</label>
            <input type="datetime-local" id="edit-start" class="form-control" value="${toLocal(exam.startAt || Date.now())}" /></div>
          <div class="form-group"><label>End</label>
            <input type="datetime-local" id="edit-end" class="form-control" value="${toLocal(exam.endAt || Date.now())}" /></div>
        </div>
        ${exam.examType !== 'regular' ? `<div class="form-group"><label>Max score</label>
          <input type="number" id="edit-max" class="form-control" value="${exam.maxScore || 100}" /></div>` : ''}
        <div class="action-btns">
          <button class="btn btn-primary" id="save-edit">Save</button>
          <button class="btn btn-ghost" onclick="App.showTeacherHome()">Cancel</button>
        </div>
      </div>
    `, 'exams');
    document.getElementById('save-edit').onclick = async () => {
      const startAt = new Date(document.getElementById('edit-start').value).getTime();
      const endAt = new Date(document.getElementById('edit-end').value).getTime();
      if (endAt <= startAt) { alert('End must be after start'); return; }
      const updates = {
        title: document.getElementById('edit-title').value.trim(),
        instructions: document.getElementById('edit-instructions').value.trim(),
        startAt, endAt,
        durationMinutes: Math.max(1, Math.round((endAt - startAt) / 60000))
      };
      const maxEl = document.getElementById('edit-max');
      if (maxEl) updates.maxScore = Number(maxEl.value) || 100;
      await Exam.updateExam(examId, updates);
      alert('Saved.');
      this.showTeacherHome();
    };
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
    this.renderShell(`<h2 class="page-title">Assessment History</h2><div id="hist">Loading...</div>`, 'history');
    const sessions = await Exam.listStudentSessions(Auth.currentUser.uid);
    const el = document.getElementById('hist');
    if (!sessions.length) {
      el.innerHTML = '<p class="text-muted">No assessments yet.</p>';
      return;
    }
    // Group by subject then type
    const bySubject = {};
    sessions.forEach(s => {
      const sub = s.subject || 'General';
      if (!bySubject[sub]) bySubject[sub] = { code: [], regular: [] };
      if ((s.examType || 'code') === 'regular') bySubject[sub].regular.push(s);
      else bySubject[sub].code.push(s);
    });

    let html = '';
    Object.keys(bySubject).sort().forEach(sub => {
      const g = bySubject[sub];
      html += `<div class="card mt-2"><h3>${escapeHtml(sub)}</h3>`;
      html += this._histBlock('Code assessments', g.code, 'code', sub);
      html += this._histBlock('Regular assessments', g.regular, 'regular', sub);
      html += `</div>`;
    });
    el.innerHTML = html;
  },

  _histBlock(title, list, type, subject) {
    const items = list.map(s => `
      <label class="hist-check">
        <input type="checkbox" class="mock-pick" data-type="${type}" data-subject="${escapeHtml(subject)}" data-examid="${s.examId}" />
        <span><strong>${escapeHtml(s.examTitle || s.examId)}</strong>
        <span class="text-muted"> · ${escapeHtml(s.status)}</span></span>
      </label>`).join('') || '<p class="text-muted">None</p>';
    return `
      <div class="hist-cat">
        <div class="hist-cat-head">
          <strong>${title}</strong>
          ${list.length ? `<button class="btn btn-sm btn-primary" onclick="App.startMockFromSelection('${type}','${escapeHtml(subject)}')">Generate mock assessment</button>` : ''}
        </div>
        ${items}
      </div>`;
  },

  async startMockFromSelection(type, subject) {
    const boxes = [...document.querySelectorAll(`.mock-pick[data-type="${type}"][data-subject="${CSS.escape(subject)}"]:checked`)];
    if (!boxes.length) {
      alert('Select at least one assessment under this category.');
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
      alert('No questions available from the selection.');
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
    document.getElementById('mock-done').onclick = () => {
      alert('Mock finished (practice only).');
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

    document.getElementById('submit-exam-btn').onclick = async () => {
      const ok = await UI.confirm('Submit this assessment? You will not be able to edit further.', 'Submit');
      if (!ok) return;
      CodeEditor.beginSubmit();
      await Exam.updateSessionAnswers(session.id, Regular.collectAnswers(box));
      await Exam.submitSession(session.id, 'manual');
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
  async showIntegrityHistory(examId) {
    const exam = await Exam.getExam(examId);
    this.renderShell(`
      <div class="card-header page-header-responsive">
        <h2 class="page-title">Integrity issues — ${escapeHtml(exam?.title || '')}</h2>
        <button class="btn btn-ghost" onclick="App.showTeacherHome()">Back</button>
      </div>
      <div class="card">
        <input type="search" id="integrity-filter-page" class="form-control" placeholder="Filter by name, email, type..." />
      </div>
      <div id="integrity-hist-list" class="mt-2">Loading...</div>
    `, 'exams');
    let all = [];
    try {
      const snap = await window.db.collection('integrityHistory')
        .where('examId', '==', examId)
        .get();
      all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      all.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    } catch (e) {
      // fallback notifications
      const snap = await window.db.collection('notifications').where('examId', '==', examId).get();
      all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    const render = () => {
      const q = (document.getElementById('integrity-filter-page')?.value || '').toLowerCase();
      const items = q ? all.filter(n =>
        (n.studentName || '').toLowerCase().includes(q) ||
        (n.studentEmail || '').toLowerCase().includes(q) ||
        (n.type || '').toLowerCase().includes(q) ||
        (n.details || '').toLowerCase().includes(q)
      ) : all;
      const el = document.getElementById('integrity-hist-list');
      el.innerHTML = items.length ? items.map(n => {
        const thumb = n.screenshot || n.extra?.screenshot;
        const time = n.createdAt?.toDate ? n.createdAt.toDate().toLocaleString() : '';
        return `<div class="integrity-item card">
          <div class="integrity-item-main">
            <strong>${escapeHtml(n.studentName || '')}</strong> · ${escapeHtml(n.studentEmail || '')}
            <div><span class="chip">${escapeHtml(n.type || '')}</span> ${escapeHtml(n.details || '')}</div>
            <div class="text-muted" style="font-size:0.75rem">${time}</div>
          </div>
          ${thumb ? `<img class="integrity-thumb" src="${thumb}" onclick="UI.showImage(this.src,'Student screen')" />` : ''}
        </div>`;
      }).join('') : '<p class="text-muted">No integrity events recorded.</p>';
    };
    document.getElementById('integrity-filter-page').oninput = render;
    render();
  },

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
    if (!(await UI.confirm('Are you sure you want to log out?', 'Log out'))) return;
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
