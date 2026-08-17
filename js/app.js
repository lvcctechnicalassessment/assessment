/**
 * Main Application Controller & Router
 */

const App = {
  async init() {
    const loading = document.getElementById('loading');
    try {
      // Check if Firebase SDK loaded
      if (typeof firebase === 'undefined' || !window.auth) {
        this.showError('Firebase SDK failed to load. Check your internet connection or CDN blockers, then reload.');
        return;
      }

      // Check if still using placeholder config
      if (!window.firebaseConfig || window.firebaseConfig.apiKey === 'YOUR_API_KEY') {
        this.showConfigNeeded();
        return;
      }

      const profile = await Auth.init();
      if (profile) {
        // Check pending teacher promotion
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
      <div class="auth-container">
        <h1>🛡️ Exam Integrity</h1>
        <p>Secure coding examinations with live monitoring and anti-cheat protection.</p>
        <button class="google-btn" id="google-signin">
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" />
          Sign in with School Google Account
        </button>
        <p class="mt-2 text-muted" style="font-size:0.8rem">Only authorized school accounts. Roles: Superadmin · Teacher · Student</p>
      </div>`;
    document.getElementById('google-signin').onclick = async () => {
      try {
        await Auth.signInWithGoogle();
        await Auth.checkPendingTeacher(Auth.currentUser);
        this.routeAfterLogin();
      } catch (err) {
        alert('Sign-in failed: ' + err.message);
      }
    };
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
        <div class="logo">🛡️ Exam<span>Integrity</span></div>
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
      el.innerHTML = `
        <table class="table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th></th></tr></thead>
          <tbody>
            ${teachers.map(t => `
              <tr>
                <td>${escapeHtml(t.name)}</td>
                <td>${escapeHtml(t.email)}</td>
                <td><span class="role-badge ${t.role}">${t.role}</span></td>
                <td>
                  ${t.role === 'teacher' ? `<button class="btn btn-sm btn-danger" onclick="App.removeTeacher('${t.uid}')">Demote</button>` : ''}
                </td>
              </tr>`).join('')}
          </tbody>
        </table>`;
    } catch (err) {
      el.innerHTML = `<p style="color:var(--danger)">${err.message}</p>`;
    }
  },

  async removeTeacher(uid) {
    if (!confirm('Demote this teacher to student?')) return;
    await Auth.removeTeacher(uid);
    this.loadTeachersList();
  },

  // ========== TEACHER ==========
  async showTeacherHome() {
    this.renderShell(`
      <div id="exams-container">Loading exams...</div>
    `, 'exams');
    await Dashboard.renderMyExams(document.getElementById('exams-container'));
  },

  showCreateExam() {
    this.renderShell(`
      <h2 class="page-title">Create Coding Exam</h2>
      <p class="page-subtitle">Students will receive a unique link to take this exam in a monitored editor.</p>
      
      <div class="card">
        <div class="form-group">
          <label>Exam Title</label>
          <input type="text" id="exam-title" class="form-control" placeholder="e.g. Python Midterm – Functions & Lists" />
        </div>
        <div class="form-group">
          <label>Instructions</label>
          <textarea id="exam-instructions" class="form-control" rows="8" placeholder="Write clear instructions, allowed libraries, time limits, what to implement, etc."></textarea>
        </div>
        <div class="form-group">
          <label>Starter Code (optional)</label>
          <textarea id="exam-starter" class="form-control" rows="6" style="font-family:monospace"># Write your Python solution here

def solution():
    pass
</textarea>
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
      if (!title || !instructions) {
        alert('Title and instructions are required');
        return;
      }
      try {
        const exam = await Exam.createExam({ title, instructions, starterCode });
        alert('Exam created! Share the link with students.');
        this.showTeacherHome();
        // Optionally auto-copy link
        this.copyExamLink(exam.id);
      } catch (err) {
        alert('Error: ' + err.message);
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
    // Full-screen exam layout (no sidebar)
    document.getElementById('app').innerHTML = `
      <div class="lock-banner hidden" id="lock-banner"></div>
      <header class="app-header">
        <div class="logo">🛡️ Exam<span>Integrity</span> — Coding Exam</div>
        <div class="user-info">
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
            <span id="sync-status" class="text-muted" style="font-size:0.8rem">● Synced</span>
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
        await Exam.submitSession(session.id);
        alert('Exam submitted successfully. You may close this window.');
        CodeEditor.dispose();
        this.showStudentHome();
      };

      // Visual sync indicator
      setInterval(() => {
        const el = document.getElementById('sync-status');
        if (el) el.textContent = '● Live';
      }, 5000);

    } catch (err) {
      alert('Could not join exam: ' + err.message);
      this.showStudentHome();
    }
  },

  async logout() {
    Dashboard.clearListeners();
    CodeEditor.dispose();
    await Auth.signOut();
    // Clear query params
    window.history.replaceState({}, '', window.location.pathname);
    this.showLogin();
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
