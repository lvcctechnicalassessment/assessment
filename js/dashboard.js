/**
 * Teacher Live Dashboard + integrity modals
 */

const Dashboard = {
  unsubscribers: [],
  currentExamId: null,
  currentExam: null,
  sessionsCache: [],

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
              <th>Duration</th>
              <th>Created</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>`;

      exams.forEach(ex => {
        const date = ex.createdAt?.toDate ? ex.createdAt.toDate().toLocaleString() : '—';
        const dur = ex.durationMinutes ? ex.durationMinutes + ' min' : '—';
        html += `
          <tr>
            <td><strong>${escapeHtml(ex.title)}</strong></td>
            <td>${dur}</td>
            <td>${date}</td>
            <td>${ex.active ? '<span style="color:var(--success)">Active</span>' : 'Closed'}</td>
            <td style="display:flex;flex-wrap:wrap;gap:0.35rem">
              <button class="btn btn-sm btn-primary" onclick="App.openLiveDashboard('${ex.id}')">Live</button>
              <button class="btn btn-sm btn-ghost" onclick="App.copyExamLink('${ex.id}')">Copy Link</button>
              <button class="btn btn-sm btn-ghost" onclick="App.showExamInvites('${ex.id}')">Invite</button>
              <button class="btn btn-sm btn-ghost" onclick="App.showExamResults('${ex.id}')">Results</button>
              <button class="btn btn-sm btn-ghost" onclick="App.toggleExamActive('${ex.id}', ${!ex.active})">${ex.active ? 'Close' : 'Reopen'}</button>
            </td>
          </tr>`;
      });

      html += '</tbody></table>';
      container.innerHTML = html;
    } catch (err) {
      const msg = err.message || String(err);
      let help = '';
      if (msg.includes('permission') || msg.includes('Permission')) {
        help = `<p class="mt-2">Publish the rules in <code>firestore.rules</code> (Firebase → Firestore → Rules), then refresh.</p>`;
      }
      container.innerHTML = `<div class="card"><p style="color:var(--danger)">Error loading exams: ${escapeHtml(msg)}</p>${help}</div>`;
    }
  },

  async renderLiveDashboard(container, examId) {
    this.clearListeners();
    this.currentExamId = examId;
    container.innerHTML = '<div class="loading-screen"><div class="spinner"></div><p>Connecting to live sessions...</p></div>';

    const exam = await Exam.getExam(examId);
    this.currentExam = exam;
    if (!exam) {
      container.innerHTML = '<div class="empty-state">Exam not found</div>';
      return;
    }

    container.innerHTML = `
      <div class="card-header">
        <div>
          <h2 class="page-title">Live Dashboard — ${escapeHtml(exam.title)}</h2>
          <p class="page-subtitle">Real-time view · Duration: ${exam.durationMinutes || 60} min · Max score: ${exam.maxScore || 50}</p>
        </div>
        <button class="btn btn-ghost" onclick="App.showTeacherHome()">← Back</button>
      </div>
      <div id="integrity-modal-root"></div>
      <div id="live-sessions-grid" class="live-grid">
        <div class="empty-state">Waiting for students to join...</div>
      </div>
      <div id="teacher-notifications"></div>
    `;

    const unsub = Exam.listenToSessions(examId, (sessions) => {
      this.sessionsCache = sessions;
      this._renderSessions(sessions);
    });
    this.unsubscribers.push(unsub);

    const unsubN = Exam.listenToNotifications([examId], (notifs) => {
      this._handlePasteNotifications(notifs);
      Notifications.renderPanel(document.getElementById('teacher-notifications'), notifs);
    });
    this.unsubscribers.push(unsubN);
  },

  _lastPasteAlert: null,
  _handlePasteNotifications(notifs) {
    const paste = notifs.find(n => n.type === 'paste' && !n._shown);
    if (!paste) return;
    // Show modal for latest paste
    const key = paste.id || paste.timestamp;
    if (key === this._lastPasteAlert) return;
    this._lastPasteAlert = key;
    this.showPasteAlert(paste);
  },

  showPasteAlert(n) {
    const lines = n.extra?.pasteRange?.lines || n.details?.match(/\((\d+)/)?.[1] || '?';
    const root = document.getElementById('integrity-modal-root');
    if (!root) return;
    root.innerHTML = `
      <div class="modal-overlay" id="paste-modal">
        <div class="modal">
          <h2>Suspicious activity</h2>
          <p style="margin:0.75rem 0;line-height:1.5">
            Student <strong>${escapeHtml(n.studentName || n.studentEmail)}</strong> pasted code
            (<strong>${escapeHtml(String(lines))}</strong> line${String(lines) === '1' ? '' : 's'}).
          </p>
          <div class="modal-actions">
            <button class="btn btn-ghost" onclick="document.getElementById('paste-modal').remove()">Dismiss</button>
            <button class="btn btn-primary" onclick="Dashboard.openStudentDetail('${n.sessionId}')">See details</button>
          </div>
        </div>
      </div>`;
  },

  async openStudentDetail(sessionId) {
    const modal = document.getElementById('paste-modal');
    if (modal) modal.remove();
    const s = this.sessionsCache.find(x => x.id === sessionId);
    let session = s;
    if (!session) {
      const snap = await window.db.collection('sessions').doc(sessionId).get();
      if (snap.exists) session = { id: snap.id, ...snap.data() };
    }
    if (!session) { alert('Session not found'); return; }

    const ranges = session.pasteRanges || [];
    const root = document.getElementById('integrity-modal-root');
    root.innerHTML = `
      <div class="modal-overlay" id="detail-modal">
        <div class="modal" style="max-width:720px;max-height:90vh;overflow:auto">
          <h2>${escapeHtml(session.studentName || session.studentEmail)}</h2>
          <p class="text-muted">Pasted regions are marked below (line ranges).</p>
          <pre class="student-code-preview" style="height:320px;white-space:pre-wrap" id="detail-code"></pre>
          <div class="mt-1 text-muted" style="font-size:0.85rem">
            ${(ranges.length ? ranges.map(r => `Lines ${r.startLine}–${r.endLine} (${r.lines} lines)`).join(' · ') : 'No paste ranges stored')}
          </div>
          <div class="modal-actions mt-2">
            <button class="btn btn-ghost" onclick="document.getElementById('detail-modal').remove()">Close</button>
            <button class="btn btn-primary" onclick="Dashboard.promptExtend('${sessionId}')">Extend time</button>
          </div>
        </div>
      </div>`;
    const pre = document.getElementById('detail-code');
    const code = session.code || '';
    const lines = code.split('\n');
    pre.innerHTML = lines.map((line, i) => {
      const ln = i + 1;
      const hit = ranges.some(r => ln >= r.startLine && ln <= r.endLine);
      const cls = hit ? ' style="background:rgba(220,38,38,0.25)"' : '';
      return `<span${cls}>${escapeHtml(line) || ' '}</span>`;
    }).join('\n');
  },

  promptExtend(sessionId) {
    const mins = prompt('Extend by how many minutes?', '15');
    if (!mins) return;
    Exam.extendSession(sessionId, Number(mins)).then(() => {
      alert('Time extended by ' + mins + ' minutes.');
    }).catch(e => alert(e.message));
  },

  _renderSessions(sessions) {
    const grid = document.getElementById('live-sessions-grid');
    if (!grid) return;
    if (sessions.length === 0) {
      grid.innerHTML = '<div class="empty-state">Waiting for students to join...</div>';
      return;
    }
    sessions.sort((a, b) => (a.status === 'active' ? -1 : 1));
    grid.innerHTML = sessions.map(s => {
      const last = s.lastUpdate?.toDate ? s.lastUpdate.toDate().toLocaleTimeString() : '—';
      const remain = s.endsAt ? Math.max(0, s.endsAt - Date.now()) : null;
      const timer = remain != null ? formatMs(remain) : '';
      const eventsHtml = (s.events || []).slice(-4).reverse().map(e => {
        const cls = ['copy','paste','tabswitch','blur','close','rightclick','drop'].includes(e.type) ? 'danger' : '';
        return `<div class="event-item ${cls}">⚠ ${e.type}: ${escapeHtml(e.details || '')}</div>`;
      }).join('') || '<span class="text-muted">No events yet</span>';

      return `
        <div class="student-card">
          <div class="student-card-header">
            <div>
              <div class="name">${escapeHtml(s.studentName || s.studentEmail)}</div>
              <div class="text-muted" style="font-size:0.8rem">${escapeHtml(s.studentEmail)}</div>
            </div>
            <div>
              <span class="status ${s.status !== 'active' ? 'idle' : ''}">${s.status}</span>
              ${timer ? `<div class="text-muted" style="font-size:0.75rem">⏱ ${timer}</div>` : ''}
              <div class="text-muted" style="font-size:0.7rem">Updated ${last}</div>
            </div>
          </div>
          <pre class="student-code-preview">${escapeHtml(s.code || '')}</pre>
          <div class="student-events">${eventsHtml}</div>
          <div style="padding:0.5rem;display:flex;gap:0.4rem;flex-wrap:wrap">
            <button class="btn btn-sm btn-ghost" onclick="Dashboard.openStudentDetail('${s.id}')">Details</button>
            <button class="btn btn-sm btn-ghost" onclick="Dashboard.promptExtend('${s.id}')">Extend</button>
            <button class="btn btn-sm btn-primary" onclick="App.gradeSession('${s.id}', '${s.examId}')">Grade</button>
          </div>
        </div>`;
    }).join('');
  }
};

function formatMs(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  if (h > 0) return h + ':' + mm + ':' + ss;
  return mm + ':' + ss;
}

window.Dashboard = Dashboard;
window.escapeHtml = window.escapeHtml || function(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
};
window.formatMs = formatMs;
