/**
 * Main Application Controller & Router
 */

const App = {
  async init() {
    const loading = document.getElementById('loading');
    try {
      // Give CDN scripts a moment, then try to initialize Firebase
      const ok = await this.waitForFirebase(8000);
      if (!ok) {
        this.showFirebaseLoadError();
        return;
      }

      // Check if still using placeholder config
      if (!window.firebaseConfig || window.firebaseConfig.apiKey === 'YOUR_API_KEY') {
        this.showConfigNeeded();
        return;
      }

      const profile = await Auth.init();
      if (profile) {
        await Auth.checkPendingTeacher(Auth.currentUser);
        this.routeAfterLogin();
      } else {
        this.showLogin();
      }
    } catch (err) {
      console.error(err);
      this.showError(err.message || String(err));
    } finally {
      if (loading) loading.classList.add('hidden');
    }
  },

  /** Wait up to `ms` milliseconds for the Firebase CDN scripts + init */
  waitForFirebase(ms = 8000) {
    return new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        if (typeof firebase !== 'undefined') {
          const success = window.initFirebaseApp && window.initFirebaseApp();
          resolve(!!success && !!window.auth);
          return;
        }
        if (Date.now() - start > ms) {
          resolve(false);
          return;
        }
        setTimeout(tick, 150);
      };
      tick();
    });
  },

  showFirebaseLoadError() {
    document.getElementById('app').innerHTML = `
      <div class="auth-container" style="max-width:640px">
        <h1>⚠️ Firebase SDK Failed to Load</h1>
        <p>The Google Firebase scripts could not be downloaded. This is usually caused by one of the following:</p>
        <div style="text-align:left;background:var(--bg);padding:1.25rem;border-radius:8px;margin:1.5rem 0;font-size:0.9rem;line-height:1.7">
          <ol style="padding-left:1.25rem">
            <li><strong>Ad-blocker / Privacy extension</strong> – temporarily disable uBlock, AdGuard, Privacy Badger, etc. for this site.</li>
            <li><strong>School / corporate network</strong> – many schools block <code>gstatic.com</code>. Try a personal hotspot or home network.</li>
            <li><strong>Browser extensions</strong> – try an Incognito/Private window with extensions disabled.</li>
            <li><strong>Offline</strong> – confirm you have internet access.</li>
          </ol>
          <p style="margin-top:1rem">Quick test: open this link in a new tab:<br>
            <a href="https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js" target="_blank" style="color:var(--primary);word-break:break-all">
              https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js
            </a><br>
            If it does <em>not</em> download a JavaScript file, the network is blocking Firebase.
          </p>
        </div>
        <button class="btn btn-primary" onclick="location.reload()">Try Again</button>
      </div>`;
  },

  showConfigNeeded() {
    document.getElementById('app').innerHTML = `
      <div class="auth-container" style="max-width:640px">
        <h1>⚙️ Firebase Setup Required</h1>
        <p>This app needs a Firebase project to handle authentication, real-time data, and live dashboards.</p>
        <div style="text-align:left;background:var(--bg);padding:1.25rem;border-radius:8px;margin:1.5rem 0;font-size:0.9rem">
          <ol style="padding-left:1.25rem;line-height:1.8">
            <li>Go to <a href="https://console.firebase.google.com/" target="_blank" style="color:var(--primary)">Firebase Console</a></li>
            <li>Create a new project</li>
            <li>Enable <strong>Authentication → Google</strong> sign-in</li>
            <li>Create a <strong>Firestore Database</strong> (start in test mode)</li>
            <li>Register a Web App and copy the config object</li>
            <li>Open <code>js/firebase-config.js</code> and paste your config</li>
            <li>Also set your email in the <code>SUPERADMIN_EMAILS</code> array</li>
            <li>Deploy to GitHub Pages and test</li>
          </ol>
        </div>
        <p class="text-muted">After configuring, refresh this page.</p>
      </div>`;
  },

  showLogin() {
    document.getElementById('app').innerHTML = `
      <div class="auth-container" style="max-width:460px">
        <img src="assets/lvcc-logo.png" alt="LVCC Logo" class="brand-logo" />
        <h1>LVCC Assessment Portal</h1>
        <p class="brand-subtitle">True to our name, true to our test</p>
        <button class="google-btn" id="google-signin">
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" />
          Sign in with Google
        </button>
        <p class="mt-2 text-muted" style="font-size:0.85rem;line-height:1.5">
          Use your <strong>@student.laverdad.edu.ph</strong> or <strong>@laverdad.edu.ph</strong> account.<br>
          Personal email is only allowed if your teacher invited you.
        </p>
        <div id="login-error" class="hidden" style="margin-top:1rem;padding:0.85rem 1rem;background:rgba(220,38,38,0.15);border:1px solid var(--danger);border-radius:8px;color:#fca5a5;font-size:0.9rem;white-space:pre-wrap;text-align:left"></div>
      </div>`;
    document.getElementById('google-signin').onclick = async () => {
      const errBox = document.getElementById('login-error');
      errBox.classList.add('hidden');
      errBox.textContent = '';
      try {
        await Auth.signInWithGoogle();
        if (Auth.currentUser) {
          await Auth.checkPendingTeacher(Auth.currentUser);
        }
        if (Auth.userProfile) {
          this.routeAfterLogin();
        }
      } catch (err) {
        errBox.textContent = err.message || 'Sign-in failed. Please try again.';
        errBox.classList.remove('hidden');
      }
    };
  },

  showAccessDeniedScreen(message) {
    document.getElementById('app').innerHTML = `
      <div class="auth-container" style="max-width:520px">
        <h1>Access Denied</h1>
        <p style="color:#fca5a5;white-space:pre-wrap;margin:1rem 0;line-height:1.6">${escapeHtml(message)}</p>
        <p class="text-muted" style="font-size:0.9rem;margin-bottom:1.5rem">
          Allowed: <strong>@student.laverdad.edu.ph</strong> · <strong>@laverdad.edu.ph</strong><br>
          Or a personal email that your teacher has invited.
        </p>
        <button class="btn btn-primary" onclick="App.showLogin()">Back to Sign In</button>
      </div>`;
  },

  routeAfterLogin() {
    const role = Auth.userProfile.role;
    // Check URL for exam join link
    const params = new URLSearchParams(window.location.search);
    const examId = params.get('exam');

    if (examId && (role === 'student' || role === 'teacher' || role === 'superadmin')) {
      this.startStudentExam(examId);
      return;
    }

    if (role === 'superadmin') {
      this.showSuperAdmin();
    } else if (role === 'teacher') {
      this.showTeacherHome();
    } else {
      this.showStudentHome();
    }
  },

  // ========== LAYOUT ==========
  renderShell(contentHtml, activeNav = '') {
    const role = Auth.userProfile.role;
    const name = Auth.userProfile.name || Auth.userProfile.email;

    let navItems = '';
    if (role === 'superadmin') {
      navItems = `
        <div class="nav-item ${activeNav==='teachers'?'active':''}" onclick="App.showSuperAdmin()">👥 Teachers</div>
        <div class="nav-item ${activeNav==='exams'?'active':''}" onclick="App.showTeacherHome()">📝 My Exams</div>
      `;
    } else if (role === 'teacher') {
      navItems = `
        <div class="nav-item ${activeNav==='exams'?'active':''}" onclick="App.showTeacherHome()">📝 My Exams</div>
      `;
    }

    document.getElementById('app').innerHTML = `
      <header class="app-header">
        <div class="logo">
          <img src="assets/lvcc-logo.png" alt="LVCC" class="header-logo" />
          <span>LVCC Assessment Portal</span>
        </div>
        <div class="user-info">
          <span class="role-badge ${role}">${role}</span>
          <span>${escapeHtml(name)}</span>
          <button class="btn btn-sm btn-ghost" onclick="App.logout()">Logout</button>
        </div>
      </header>
      <div class="dashboard">
        <aside class="sidebar">
          <h3>Menu</h3>
          ${navItems}
          <div class="nav-item" onclick="window.open('https://github.com','_blank')">📖 Help</div>
        </aside>
        <main class="main-content" id="main-content">
          ${contentHtml}
        </main>
      </div>`;
  },

  // ========== SUPERADMIN ==========
  async showSuperAdmin() {
    this.renderShell(`
      <h2 class="page-title">Teacher Management</h2>
      <p class="page-subtitle">Add teachers by their school Google email. They will receive the teacher role on next login (or immediately if already registered).</p>
      
      <div class="card">
        <div class="card-header">
          <div class="card-title">Add Teacher</div>
        </div>
        <div class="form-group">
          <label>Teacher Email</label>
          <input type="email" id="teacher-email" class="form-control" placeholder="teacher@school.edu" />
        </div>
        <button class="btn btn-primary" id="add-teacher-btn">Add Teacher</button>
        <p id="add-teacher-msg" class="mt-1 text-muted"></p>
      </div>

      <div class="card mt-2">
        <div class="card-header">
          <div class="card-title">Current Teachers & Admins</div>
        </div>
        <div id="teachers-list">Loading...</div>
      </div>
    `, 'teachers');

    document.getElementById('add-teacher-btn').onclick = async () => {
      const email = document.getElementById('teacher-email').value;
      const msg = document.getElementById('add-teacher-msg');
      if (!email) return;
      try {
        const res = await Auth.addTeacher(email);
        msg.textContent = res.message;
        msg.style.color = 'var(--success)';
        document.getElementById('teacher-email').value = '';
        this.loadTeachersList();
      } catch (err) {
        msg.textContent = err.message;
        msg.style.color = 'var(--danger)';
      }
    };

    this.loadTeachersList();
  },

  async loadTeachersList() {
    const el = document.getElementById('teachers-list');
    try {
      const teachers = await Auth.listTeachers();
      if (teachers.length === 0) {
        el.innerHTML = '<p class="text-muted">No teachers yet.</p>';
        return;
      }
      const myUid = Auth.currentUser?.uid;
      el.innerHTML = `
        <table class="table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Actions</th></tr></thead>
          <tbody>
            ${teachers.map(t => {
              const isMe = t.uid === myUid;
              let actions = '';
              if (t.role === 'teacher') {
                actions = `
                  <button class="btn btn-sm btn-primary" onclick="App.makeSuperAdmin('${t.uid}')">Make Superadmin</button>
                  <button class="btn btn-sm btn-danger" onclick="App.removeTeacher('${t.uid}')">Demote</button>`;
              } else if (t.role === 'superadmin' && !isMe) {
                actions = `
                  <button class="btn btn-sm btn-ghost" onclick="App.setRole('${t.uid}', 'teacher')">Make Teacher</button>
                  <button class="btn btn-sm btn-danger" onclick="App.removeTeacher('${t.uid}')">Demote</button>`;
              } else if (isMe) {
                actions = `<span class="text-muted" style="font-size:0.8rem">You</span>`;
              }
              return `
              <tr>
                <td>${escapeHtml(t.name)}</td>
                <td>${escapeHtml(t.email)}</td>
                <td><span class="role-badge ${t.role}">${t.role}</span></td>
                <td class="flex gap-2">${actions}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>`;
    } catch (err) {
      el.innerHTML = `<p style="color:var(--danger)">${err.message}</p>`;
    }
  },

  async removeTeacher(uid) {
    if (!confirm('Demote this user to student?')) return;
    await Auth.removeTeacher(uid);
    this.loadTeachersList();
  },

  async makeSuperAdmin(uid) {
    if (!confirm('Promote this user to Superadmin?')) return;
    await Auth.setRole(uid, 'superadmin');
    this.loadTeachersList();
  },

  async setRole(uid, role) {
    if (!confirm('Change this user role to "' + role + '"?')) return;
    await Auth.setRole(uid, role);
    this.loadTeachersList();
  },

  // ========== TEACHER ==========
  async showTeacherHome() {
    this.renderShell(`
      <div id="exams-container">Loading exams...</div>
    `, 'exams');
    await Dashboard.renderMyExams(document.getElementById('exams-container'));
  },

  async showExamInvites(examId) {
    const exam = await Exam.getExam(examId);
    const title = exam ? exam.title : examId;
    this.renderShell(`
      <h2 class="page-title">Invite to Exam</h2>
      <p class="page-subtitle">
        Invite a personal email for <strong>${escapeHtml(title)}</strong> only.
        That student cannot access your other exams.
      </p>
      <div class="card">
        <div class="form-group">
          <label>Student personal email</label>
          <input type="email" id="invite-email" class="form-control" placeholder="student@gmail.com" />
        </div>
        <button class="btn btn-primary" id="invite-btn">Invite to this exam</button>
        <button class="btn btn-ghost" onclick="App.showTeacherHome()">Back to Exams</button>
        <p id="invite-msg" class="mt-1 text-muted"></p>
      </div>
      <div class="card mt-2">
        <div class="card-header"><div class="card-title">Invited to this exam</div></div>
        <div id="invites-list">Loading...</div>
      </div>
    `, 'exams');

    document.getElementById('invite-btn').onclick = async () => {
      const email = document.getElementById('invite-email').value;
      const msg = document.getElementById('invite-msg');
      try {
        const res = await Auth.inviteStudentToExam(examId, title, email);
        msg.textContent = res.message;
        msg.style.color = 'var(--success)';
        document.getElementById('invite-email').value = '';
        this.loadExamInvitesList(examId);
      } catch (err) {
        msg.textContent = err.message;
        msg.style.color = 'var(--danger)';
      }
    };

    this.loadExamInvitesList(examId);
  },

  async loadExamInvitesList(examId) {
    const el = document.getElementById('invites-list');
    if (!el) return;
    try {
      const invites = await Auth.listExamInvites(examId);
      if (invites.length === 0) {
        el.innerHTML = '<p class="text-muted">No personal-email invites for this exam yet.</p>';
        return;
      }
      el.innerHTML = `
        <table class="table">
          <thead><tr><th>Email</th><th>Invited</th><th></th></tr></thead>
          <tbody>
            ${invites.map(i => {
              const date = i.createdAt?.toDate ? i.createdAt.toDate().toLocaleString() : '—';
              return `<tr>
                <td>${escapeHtml(i.email)}</td>
                <td>${date}</td>
                <td><button class="btn btn-sm btn-danger" onclick="App.removeExamInvite('${examId}', '${escapeHtml(i.email)}')">Remove</button></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>`;
    } catch (err) {
      el.innerHTML = `<p style="color:var(--danger)">${escapeHtml(err.message)}</p>`;
    }
  },

  async removeExamInvite(examId, email) {
    if (!confirm('Remove invite for ' + email + ' from this exam?')) return;
    await Auth.removeExamInvite(examId, email);
    this.loadExamInvitesList(examId);
  },

  showCreateExam() {
    this.renderShell(`
      <h2 class="page-title">Create Coding Exam</h2>
      <p class="page-subtitle">Students receive a unique link. Set duration and optional answer key for auto-grading.</p>
      <div class="card">
        <div class="form-group">
          <label>Exam Title</label>
          <input type="text" id="exam-title" class="form-control" placeholder="e.g. Python Midterm" />
        </div>
        <div class="form-group">
          <label>Instructions</label>
          <textarea id="exam-instructions" class="form-control" rows="6" placeholder="Clear instructions for students"></textarea>
        </div>
        <div class="form-group">
          <label>Duration (minutes)</label>
          <input type="number" id="exam-duration" class="form-control" value="60" min="1" max="600" />
        </div>
        <div class="form-group">
          <label>Max score (default base 50)</label>
          <input type="number" id="exam-maxscore" class="form-control" value="50" min="1" max="100" />
        </div>
        <div class="form-group">
          <label>Starter Code (optional)</label>
          <textarea id="exam-starter" class="form-control" rows="5" style="font-family:monospace"># Write your Python solution here

def solution():
    pass
</textarea>
        </div>
        <div class="form-group">
          <label>Answer key / correct solution (optional — for auto-grade)</label>
          <textarea id="exam-answer" class="form-control" rows="6" style="font-family:monospace" placeholder="Paste the expected correct Python solution"></textarea>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" onclick="App.showTeacherHome()">Cancel</button>
          <button class="btn btn-primary" id="create-exam-btn">Create Exam</button>
        </div>
      </div>
    `, 'exams');

    document.getElementById('create-exam-btn').onclick = async () => {
      const title = document.getElementById('exam-title').value.trim();
      const instructions = document.getElementById('exam-instructions').value.trim();
      const starterCode = document.getElementById('exam-starter').value;
      const durationMinutes = Number(document.getElementById('exam-duration').value) || 60;
      const maxScore = Number(document.getElementById('exam-maxscore').value) || 50;
      const answerKey = document.getElementById('exam-answer').value;
      if (!title || !instructions) {
        alert('Title and instructions are required');
        return;
      }
      try {
        const exam = await Exam.createExam({ title, instructions, starterCode, durationMinutes, maxScore, answerKey });
        alert('Exam created! Share the link with students.');
        this.showTeacherHome();
        this.copyExamLink(exam.id);
      } catch (err) {
        alert('Error: ' + err.message + '\n\nIf this is a permissions error, publish firestore.rules in Firebase Console.');
      }
    };
  },

  copyExamLink(examId) {
    const url = `${window.location.origin}${window.location.pathname}?exam=${examId}`;
    navigator.clipboard.writeText(url).then(() => {
      alert('Exam link copied to clipboard!\n\n' + url);
    }).catch(() => {
      prompt('Copy this exam link:', url);
    });
  },

  async toggleExamActive(examId, active) {
    const msg = active ? 'Reopen this exam?' : 'Close this exam? Students will no longer be able to join.';
    if (!confirm(msg)) return;
    await Exam.updateExam(examId, { active });
    this.showTeacherHome();
  },

  openLiveDashboard(examId) {
    this.renderShell(`<div id="live-container"></div>`, 'exams');
    Dashboard.renderLiveDashboard(document.getElementById('live-container'), examId);
  },

  // ========== STUDENT ==========
  showStudentHome() {
    this.renderShell(`
      <h2 class="page-title">Student Portal</h2>
      <p class="page-subtitle">Enter an exam link provided by your teacher, or wait for the link to be shared.</p>
      <div class="card">
        <p>If you have an exam URL that looks like:</p>
        <code style="background:var(--bg);padding:0.5rem;display:block;border-radius:6px;margin:0.75rem 0">
          https://your-site.github.io/?exam=ABC123
        </code>
        <p>Open it while logged in to start the exam.</p>
        <p class="mt-2 text-muted">Your coding activity will be monitored in real time by your teacher to ensure exam integrity.</p>
      </div>
    `);
  },

  async startStudentExam(examId) {
    document.getElementById('app').innerHTML = `
      <div class="lock-banner hidden" id="lock-banner"></div>
      <div id="timesup-overlay" class="timesup-overlay hidden">
        <div class="timesup-box">
          <h1>Time's up!</h1>
          <p>Your code has been submitted automatically.</p>
        </div>
      </div>
      <header class="app-header">
        <div class="logo">
          <img src="assets/lvcc-logo.png" alt="LVCC" class="header-logo" />
          <span>LVCC Assessment Portal — Coding Exam</span>
        </div>
        <div class="user-info">
          <span id="exam-timer" class="exam-timer">--:--</span>
          <span>${escapeHtml(Auth.userProfile.name)}</span>
          <button class="btn btn-sm btn-danger" id="submit-exam-btn">Submit Exam</button>
        </div>
      </header>
      <div class="exam-layout">
        <aside class="exam-sidebar">
          <h3 style="margin-bottom:0.75rem">Instructions</h3>
          <div class="exam-instructions" id="exam-instructions-text">Loading...</div>
          <div class="mt-2">
            <button class="btn btn-primary w-full" id="check-code-btn">Check Syntax</button>
          </div>
        </aside>
        <div class="exam-editor-area">
          <div class="editor-toolbar">
            <span class="text-muted">Python Editor • Auto-save & Live Sync enabled</span>
            <span style="flex:1"></span>
            <span id="sync-status" class="text-muted" style="font-size:0.8rem">● Live</span>
          </div>
          <div id="monaco-container"></div>
          <div class="output-panel">
            <div style="font-weight:600;margin-bottom:0.4rem;color:var(--text-muted)">Output / Diagnostics</div>
            <div id="output-content"></div>
          </div>
        </div>
      </div>
    `;

    try {
      const session = await Exam.joinExam(examId);
      document.getElementById('exam-instructions-text').textContent = session.exam.instructions;
      await CodeEditor.init('monaco-container', session.code || session.exam.starterCode || '', session.id, examId);

      document.getElementById('check-code-btn').onclick = () => CodeEditor.checkCode();
      document.getElementById('submit-exam-btn').onclick = async () => {
        if (!confirm('Submit your exam? You will not be able to edit further.')) return;
        await Exam.submitSession(session.id, 'manual');
        alert('Exam submitted successfully.');
        CodeEditor.dispose();
        this.showStudentHome();
      };

      // Timer
      const endsAt = session.endsAt || (Date.now() + (session.durationMinutes || 60) * 60000);
      this._examTimerInterval = setInterval(async () => {
        // Refresh endsAt from session if teacher extended
        const remain = endsAt - Date.now();
        const el = document.getElementById('exam-timer');
        if (el) {
          el.textContent = typeof formatMs === 'function' ? formatMs(Math.max(0, remain)) : '';
          if (remain < 5 * 60 * 1000) el.classList.add('timer-warn');
        }
        if (remain <= 0) {
          clearInterval(this._examTimerInterval);
          CodeEditor.lockEditor();
          const ov = document.getElementById('timesup-overlay');
          if (ov) ov.classList.remove('hidden');
          try {
            await Exam.submitSession(session.id, 'timeout');
          } catch (e) { console.error(e); }
        }
      }, 500);

      // Listen for teacher time extension
      Exam.listenToSession(session.id, (s) => {
        if (s.endsAt && s.endsAt > endsAt) {
          // update local endsAt by reassignment via closure - use object
        }
        if (s.status === 'submitted' && s.submitReason === 'timeout') {
          CodeEditor.lockEditor();
        }
      });

    } catch (err) {
      alert('Could not join exam: ' + err.message);
      this.showStudentHome();
    }
  },

  async logout() {
    if (!confirm('Are you sure you want to log out?')) return;
    Dashboard.clearListeners();
    CodeEditor.dispose();
    await Auth.signOut();
    window.history.replaceState({}, '', window.location.pathname);
    this.showLogin();
  },


  async gradeSession(sessionId, examId) {
    const exam = await Exam.getExam(examId);
    const snap = await window.db.collection('sessions').doc(sessionId).get();
    if (!snap.exists) { alert('Session not found'); return; }
    const session = { id: snap.id, ...snap.data() };
    const maxScore = Number(exam.maxScore) || 50;
    const auto = Exam.autoGrade(session.code, exam.answerKey, maxScore);
    const existing = await Exam.getGrade(sessionId);

    const scoreDefault = existing?.score ?? auto.score ?? '';
    const commentDefault = existing?.comment || '';

    const scoreStr = prompt(
      `Grade ${session.studentName || session.studentEmail}\n` +
      `Max score: ${maxScore} (percentage shown on /100 scale)\n` +
      (auto.note ? `Auto-grade hint: ${auto.note} → ${auto.score}\n` : '') +
      `Enter score (0–${maxScore}):`,
      String(scoreDefault)
    );
    if (scoreStr === null) return;
    const score = Number(scoreStr);
    if (Number.isNaN(score) || score < 0 || score > maxScore) {
      alert('Invalid score');
      return;
    }
    const comment = prompt('Comment (optional):', commentDefault) || '';
    const percent = Math.round((score / maxScore) * 1000) / 10;
    await Exam.saveGrade(sessionId, examId, {
      studentId: session.studentId,
      studentEmail: session.studentEmail,
      studentName: session.studentName,
      score,
      maxScore,
      percent,
      comment,
      method: existing ? 'manual' : (auto.method || 'manual')
    });
    alert(`Saved: ${score}/${maxScore} (${percent}%)`);
  },

  async showExamResults(examId) {
    const exam = await Exam.getExam(examId);
    this.renderShell(`
      <div class="card-header">
        <div>
          <h2 class="page-title">Results — ${escapeHtml(exam.title)}</h2>
          <p class="page-subtitle">Max score: ${exam.maxScore || 50} · Base scale shown as score/max and %</p>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-ghost" onclick="App.exportSummary('${examId}')">Export summary CSV</button>
          <button class="btn btn-ghost" onclick="App.showTeacherHome()">← Back</button>
        </div>
      </div>
      <div id="results-table">Loading...</div>
    `, 'exams');

    const sessionsSnap = await window.db.collection('sessions').where('examId', '==', examId).get();
    const sessions = sessionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const grades = await Exam.listGrades(examId);
    const gradeMap = Object.fromEntries(grades.map(g => [g.sessionId, g]));

    const el = document.getElementById('results-table');
    if (sessions.length === 0) {
      el.innerHTML = '<p class="text-muted">No submissions yet.</p>';
      return;
    }
    el.innerHTML = `
      <table class="table">
        <thead><tr><th>Student</th><th>Email</th><th>Status</th><th>Score</th><th>%</th><th>Comment</th><th></th></tr></thead>
        <tbody>
          ${sessions.map(s => {
            const g = gradeMap[s.id];
            const score = g ? `${g.score}/${g.maxScore}` : '—';
            const pct = g ? g.percent + '%' : '—';
            return `<tr>
              <td>${escapeHtml(s.studentName || '')}</td>
              <td>${escapeHtml(s.studentEmail || '')}</td>
              <td>${escapeHtml(s.status)}</td>
              <td>${score}</td>
              <td>${pct}</td>
              <td>${escapeHtml(g?.comment || '')}</td>
              <td style="display:flex;gap:0.35rem;flex-wrap:wrap">
                <button class="btn btn-sm btn-primary" onclick="App.gradeSession('${s.id}', '${examId}')">Grade</button>
                <button class="btn btn-sm btn-ghost" onclick="App.exportStudentReport('${s.id}', '${examId}')">Export</button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;
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
      'Status: ' + (session.status || ''),
      'Score: ' + (grade ? `${grade.score}/${grade.maxScore} (${grade.percent}%)` : 'Not graded'),
      'Comment: ' + (grade?.comment || ''),
      '',
      '--- Student answer ---',
      session.code || '',
      '',
      '--- Correct answer / key ---',
      exam.answerKey || '(none)',
      ''
    ].join('\\n');
    downloadText(`report-${(session.studentEmail || sessionId).replace(/[^a-z0-9]/gi,'_')}.txt`, text);
  },

  async exportSummary(examId) {
    const exam = await Exam.getExam(examId);
    const sessionsSnap = await window.db.collection('sessions').where('examId', '==', examId).get();
    const sessions = sessionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const grades = await Exam.listGrades(examId);
    const gradeMap = Object.fromEntries(grades.map(g => [g.sessionId, g]));
    const rows = [['Name', 'Email', 'Status', 'Score', 'Max', 'Percent', 'Comment']];
    sessions.forEach(s => {
      const g = gradeMap[s.id];
      rows.push([
        s.studentName || '',
        s.studentEmail || '',
        s.status || '',
        g ? g.score : '',
        g ? g.maxScore : (exam.maxScore || 50),
        g ? g.percent : '',
        (g?.comment || '').replace(/,/g, ';')
      ]);
    });
    const csv = rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\\n');
    downloadText(`summary-${examId}.csv`, csv);
  },

  showError(msg) {
    document.getElementById('app').innerHTML = `
      <div class="auth-container">
        <h1>Error</h1>
        <p style="color:var(--danger)">${escapeHtml(msg)}</p>
        <button class="btn btn-primary mt-2" onclick="location.reload()">Reload</button>
      </div>`;
  }
};

// Boot
document.addEventListener('DOMContentLoaded', () => App.init());

window.App = App;


function downloadText(filename, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
window.downloadText = downloadText;

function formatMs(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  if (h > 0) return h + ':' + mm + ':' + ss;
  return mm + ':' + ss;
}
window.formatMs = formatMs;
