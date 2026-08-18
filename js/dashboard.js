/**
 * Teacher Live Dashboard
 */

const Dashboard = {
  unsubscribers: [],
  currentExamId: null,

  clearListeners() {
    this.unsubscribers.forEach(u => u && u());
    this.unsubscribers = [];
  },

  async renderMyExams(container) {
    container.innerHTML = '<div class="loading-screen"><div class="spinner"></div></div>';

    try {
      const exams = await Exam.listMyExams();
      if (exams.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="icon">📝</div>
            <h3>No exams yet</h3>
            <p>Create your first coding exam to get started.</p>
            <button class="btn btn-primary mt-2" onclick="App.showCreateExam()">+ Create Exam</button>
          </div>`;
        return;
      }

      let html = `
        <div class="card-header">
          <h2 class="page-title">My Exams</h2>
          <button class="btn btn-primary" onclick="App.showCreateExam()">+ New Exam</button>
        </div>
        <table class="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Created</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>`;

      exams.forEach(ex => {
        const date = ex.createdAt?.toDate ? ex.createdAt.toDate().toLocaleString() : '—';
        html += `
          <tr>
            <td><strong>${escapeHtml(ex.title)}</strong></td>
            <td>${date}</td>
            <td>${ex.active ? '<span style="color:var(--success)">Active</span>' : 'Closed'}</td>
            <td>
              <button class="btn btn-sm btn-primary" onclick="App.openLiveDashboard('${ex.id}')">Live Dashboard</button>
              <button class="btn btn-sm btn-ghost" onclick="App.copyExamLink('${ex.id}')">Copy Link</button>
              <button class="btn btn-sm btn-ghost" onclick="App.showExamInvites('${ex.id}')">Invite</button>
              <button class="btn btn-sm btn-ghost" onclick="App.toggleExamActive('${ex.id}', ${!ex.active})">${ex.active ? 'Close' : 'Reopen'}</button>
            </td>
          </tr>`;
      });

      html += '</tbody></table>';
      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = `<div class="card"><p style="color:var(--danger)">Error loading exams: ${err.message}</p></div>`;
    }
  },

  async renderLiveDashboard(container, examId) {
    this.clearListeners();
    this.currentExamId = examId;
    container.innerHTML = '<div class="loading-screen"><div class="spinner"></div><p>Connecting to live sessions...</p></div>';

    const exam = await Exam.getExam(examId);
    if (!exam) {
      container.innerHTML = '<div class="empty-state">Exam not found</div>';
      return;
    }

    container.innerHTML = `
      <div class="card-header">
        <div>
          <h2 class="page-title">Live Dashboard — ${escapeHtml(exam.title)}</h2>
          <p class="page-subtitle">Real-time view of students' editors. Click a card to expand.</p>
        </div>
        <button class="btn btn-ghost" onclick="App.showTeacherHome()">← Back</button>
      </div>
      <div id="live-sessions-grid" class="live-grid">
        <div class="empty-state">Waiting for students to join...</div>
      </div>
      <div id="teacher-notifications"></div>
    `;

    // Real-time sessions
    const unsub = Exam.listenToSessions(examId, (sessions) => {
      this._renderSessions(sessions);
    });
    this.unsubscribers.push(unsub);

    // Notifications for this exam
    const unsubN = Exam.listenToNotifications([examId], (notifs) => {
      Notifications.renderPanel(document.getElementById('teacher-notifications'), notifs);
    });
    this.unsubscribers.push(unsubN);
  },

  _renderSessions(sessions) {
    const grid = document.getElementById('live-sessions-grid');
    if (!grid) return;

    if (sessions.length === 0) {
      grid.innerHTML = '<div class="empty-state">Waiting for students to join...</div>';
      return;
    }

    // Sort: active first, then by lastUpdate
    sessions.sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (b.status === 'active' && a.status !== 'active') return 1;
      return 0;
    });

    grid.innerHTML = sessions.map(s => {
      const last = s.lastUpdate?.toDate ? s.lastUpdate.toDate().toLocaleTimeString() : '—';
      const eventsHtml = (s.events || []).slice(-5).reverse().map(e => {
        const cls = ['copy','paste','tabswitch','blur','close','rightclick','drop'].includes(e.type) ? 'danger' : '';
        return `<div class="event-item ${cls}">⚠ ${e.type}: ${escapeHtml(e.details || '')} <span class="text-muted">(${e.timestamp?.slice(11,19) || ''})</span></div>`;
      }).join('') || '<span class="text-muted">No events yet</span>';

      return `
        <div class="student-card" data-session="${s.id}">
          <div class="student-card-header">
            <div>
              <div class="name">${escapeHtml(s.studentName || s.studentEmail)}</div>
              <div class="text-muted" style="font-size:0.8rem">${escapeHtml(s.studentEmail)}</div>
            </div>
            <div>
              <span class="status ${s.status !== 'active' ? 'idle' : ''}">${s.status}</span>
              <div class="text-muted" style="font-size:0.7rem;margin-top:2px">Updated ${last}</div>
            </div>
          </div>
          <pre class="student-code-preview" id="code-${s.id}">${escapeHtml(s.code || '')}</pre>
          <div class="student-events">${eventsHtml}</div>
        </div>`;
    }).join('');

    // Auto-scroll code previews to bottom on update (optional)
    sessions.forEach(s => {
      const pre = document.getElementById(`code-${s.id}`);
      if (pre) pre.scrollTop = pre.scrollHeight;
    });
  }
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

window.Dashboard = Dashboard;
window.escapeHtml = escapeHtml;
