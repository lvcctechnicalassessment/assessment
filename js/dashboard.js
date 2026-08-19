/**
 * Teacher / Proctor Live Dashboard
 */

const Dashboard = {
  unsubscribers: [],
  currentExamId: null,
  currentExam: null,
  sessionsCache: [],
  proctorFilterIds: null, // null = all (teacher); array = proctor subset

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
            <p>Create a Code or Regular assessment.</p>
            <button class="btn btn-primary mt-2" onclick="App.showCreateExam()">+ Create Exam</button>
          </div>`;
        return;
      }

      let html = `
        <div class="card-header page-header-responsive">
          <h2 class="page-title">My Exams</h2>
          <button class="btn btn-primary" onclick="App.showCreateExam()">+ New Exam</button>
        </div>
        <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Type</th>
              <th>Start</th>
              <th>End</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>`;

      exams.forEach(ex => {
        const type = ex.examType === 'regular' ? 'Regular' : 'Code';
        const lang = ex.examType !== 'regular' ? (ex.language || 'python') : '';
        const start = ex.startAt ? new Date(ex.startAt).toLocaleString() : '—';
        const end = ex.endAt ? new Date(ex.endAt).toLocaleString() : '—';
        html += `
          <tr>
            <td data-label="Title"><strong>${escapeHtml(ex.title)}</strong>
              ${lang ? `<div class="text-muted" style="font-size:0.75rem">${lang}</div>` : ''}</td>
            <td data-label="Type">${type}</td>
            <td data-label="Start">${start}</td>
            <td data-label="End">${end}</td>
            <td data-label="Status">${ex.active ? '<span style="color:var(--success)">Active</span>' : 'Closed'}</td>
            <td data-label="Actions"><div class="action-btns">
              <button class="btn btn-sm btn-primary" onclick="App.openLiveDashboard('${ex.id}')">Live</button>
              <button class="btn btn-sm btn-ghost" onclick="App.copyExamLink('${ex.id}')">Link</button>
              <button class="btn btn-sm btn-ghost" onclick="App.showExamInvites('${ex.id}')">Invite</button>
              <button class="btn btn-sm btn-ghost" onclick="App.showProctors('${ex.id}')">Proctors</button>
              <button class="btn btn-sm btn-ghost" onclick="App.showExamResults('${ex.id}')">Results</button>
              <button class="btn btn-sm btn-ghost" onclick="App.duplicateExam('${ex.id}')">Duplicate</button>
              <button class="btn btn-sm btn-ghost" onclick="App.toggleExamActive('${ex.id}', ${!ex.active})">${ex.active ? 'Close' : 'Reopen'}</button>
            </div></td>
          </tr>`;
      });

      html += '</tbody></table></div>';
      container.innerHTML = html;
    } catch (err) {
      const msg = err.message || String(err);
      let help = msg.includes('permission') || msg.includes('Permission')
        ? `<p class="mt-2">Publish <code>firestore.rules</code> in Firebase → Firestore → Rules.</p>` : '';
      container.innerHTML = `<div class="card"><p style="color:var(--danger)">Error: ${escapeHtml(msg)}</p>${help}</div>`;
    }
  },

  async renderLiveDashboard(container, examId, proctorFilterIds = null) {
    this.clearListeners();
    this.currentExamId = examId;
    this.proctorFilterIds = proctorFilterIds;
    container.innerHTML = '<div class="loading-screen"><div class="spinner"></div><p>Connecting...</p></div>';

    const exam = await Exam.getExam(examId);
    this.currentExam = exam;
    if (!exam) {
      container.innerHTML = '<div class="empty-state">Exam not found</div>';
      return;
    }

    const { startAt, endAt } = Exam.getExamWindow(exam);
    const isProctor = !!proctorFilterIds;

    container.innerHTML = `
      <div class="card-header page-header-responsive">
        <div>
          <h2 class="page-title">Live — ${escapeHtml(exam.title)}</h2>
          <p class="page-subtitle">
            ${exam.examType === 'regular' ? 'Regular' : 'Code'} assessment
            · ${new Date(startAt).toLocaleString()} → ${new Date(endAt).toLocaleString()}
            · Max ${exam.maxScore || 50}
            ${isProctor ? ' · <strong>Proctor view (assigned students only)</strong>' : ''}
          </p>
        </div>
        <div class="action-btns">
          ${!isProctor ? `<button class="btn btn-primary" id="btn-extend-all">⏱ Extend all</button>` : ''}
          <button class="btn btn-ghost" onclick="App.showTeacherHome()">← Back</button>
        </div>
      </div>
      <div id="integrity-modal-root"></div>
      <div id="live-sessions-grid" class="live-grid">
        <div class="empty-state">Waiting for students...</div>
      </div>
      <div id="teacher-notifications"></div>
    `;

    const extBtn = document.getElementById('btn-extend-all');
    if (extBtn) {
      extBtn.onclick = () => this.promptExtendAll(examId);
    }

    const unsub = Exam.listenToSessions(examId, (sessions) => {
      let list = sessions;
      if (proctorFilterIds) {
        list = sessions.filter(s => proctorFilterIds.includes(s.studentId));
      }
      this.sessionsCache = list;
      this._renderSessions(list, exam);
    });
    this.unsubscribers.push(unsub);

    const unsubN = Exam.listenToNotifications([examId], (notifs) => {
      let filtered = notifs;
      if (proctorFilterIds) {
        filtered = notifs.filter(n => {
          const s = this.sessionsCache.find(x => x.id === n.sessionId);
          return s && proctorFilterIds.includes(s.studentId);
        });
      }
      this._handlePasteNotifications(filtered);
      Notifications.renderPanel(document.getElementById('teacher-notifications'), filtered);
    });
    this.unsubscribers.push(unsubN);
  },

  promptExtendAll(examId) {
    const mins = prompt('Extend this exam for ALL students by how many minutes?', '15');
    if (!mins) return;
    Exam.extendExam(examId, Number(mins)).then(() => {
      alert('Extended by ' + mins + ' minutes for everyone.');
      this.renderLiveDashboard(document.getElementById('live-container') || document.getElementById('main-content'), examId, this.proctorFilterIds);
    }).catch(e => alert(e.message));
  },

  _lastPasteAlert: null,
  _handlePasteNotifications(notifs) {
    const paste = notifs.find(n => (n.type === 'paste' || n.type === 'paste-key') && n.id !== this._lastPasteAlert);
    if (!paste) return;
    this._lastPasteAlert = paste.id;
    this.showPasteAlert(paste);
  },

  showPasteAlert(n) {
    const lines = n.extra?.pasteRange?.lines || (String(n.details || '').match(/(\d+)\s*line/) || [])[1] || '?';
    const root = document.getElementById('integrity-modal-root');
    if (!root) return;
    root.innerHTML = `
      <div class="modal-overlay" id="paste-modal">
        <div class="modal">
          <h2>Suspicious activity</h2>
          <p style="margin:0.75rem 0;line-height:1.5">
            <strong>${escapeHtml(n.studentName || n.studentEmail)}</strong> pasted code
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
    document.getElementById('paste-modal')?.remove();
    let session = this.sessionsCache.find(x => x.id === sessionId);
    if (!session) {
      const snap = await window.db.collection('sessions').doc(sessionId).get();
      if (snap.exists) session = { id: snap.id, ...snap.data() };
    }
    if (!session) { alert('Session not found'); return; }

    const ranges = session.pasteRanges || [];
    const exam = this.currentExam;
    const isRegular = (session.examType || exam?.examType) === 'regular';
    let body;
    if (isRegular) {
      body = `<pre class="student-code-preview" style="height:280px;white-space:pre-wrap">${escapeHtml(Regular.answersPreview(session.answers, exam?.questions))}</pre>`;
    } else {
      body = `<pre class="student-code-preview" style="height:280px;white-space:pre-wrap" id="detail-code"></pre>`;
    }

    const root = document.getElementById('integrity-modal-root');
    root.innerHTML = `
      <div class="modal-overlay" id="detail-modal">
        <div class="modal modal-wide">
          <h2>${escapeHtml(session.studentName || session.studentEmail)}</h2>
          <p class="text-muted">Status: ${escapeHtml(session.status)} · Ends: ${session.endsAt ? new Date(session.endsAt).toLocaleString() : '—'}</p>
          ${body}
          <div class="mt-1 text-muted" style="font-size:0.85rem">
            ${ranges.length ? ranges.map(r => `Paste lines ${r.startLine}–${r.endLine} (${r.lines} lines)`).join(' · ') : 'No paste ranges'}
          </div>
          <div class="modal-actions mt-2 action-btns">
            <button class="btn btn-ghost" onclick="document.getElementById('detail-modal').remove()">Close</button>
            <button class="btn btn-primary" onclick="Dashboard.promptExtend('${sessionId}')">⏱ Extend this student</button>
            <button class="btn btn-primary" onclick="App.gradeSession('${sessionId}', '${session.examId}')">Grade</button>
          </div>
        </div>
      </div>`;

    if (!isRegular) {
      const pre = document.getElementById('detail-code');
      const code = session.code || '';
      const lines = code.split('\n');
      pre.innerHTML = lines.map((line, i) => {
        const ln = i + 1;
        const hit = ranges.some(r => ln >= r.startLine && ln <= r.endLine);
        return `<span${hit ? ' class="paste-hl"' : ''}>${escapeHtml(line) || ' '}</span>`;
      }).join('\n');
    }
  },

  promptExtend(sessionId) {
    const mins = prompt('Extend this student by how many minutes?', '15');
    if (!mins) return;
    Exam.extendSession(sessionId, Number(mins)).then(() => {
      alert('Extended by ' + mins + ' minutes.');
    }).catch(e => alert(e.message));
  },

  _renderSessions(sessions, exam) {
    const grid = document.getElementById('live-sessions-grid');
    if (!grid) return;
    if (sessions.length === 0) {
      grid.innerHTML = '<div class="empty-state">Waiting for students...</div>';
      return;
    }
    sessions.sort((a, b) => (a.status === 'active' ? -1 : 1));
    const isRegular = (exam?.examType === 'regular');

    grid.innerHTML = sessions.map(s => {
      const last = s.lastUpdate?.toDate ? s.lastUpdate.toDate().toLocaleTimeString() : '—';
      const remain = s.endsAt ? Math.max(0, s.endsAt - Date.now()) : null;
      const timer = remain != null ? formatMs(remain) : '';
      const eventsHtml = (s.events || []).slice(-4).reverse().map(e => {
        const cls = ['copy','paste','paste-key','tabswitch','blur','close','rightclick','drop','cut'].includes(e.type) ? 'danger' : '';
        return `<div class="event-item ${cls}">⚠ ${e.type}: ${escapeHtml(e.details || '')}</div>`;
      }).join('') || '<span class="text-muted">No events</span>';

      const preview = isRegular
        ? escapeHtml(Regular.answersPreview(s.answers, exam?.questions))
        : escapeHtml(s.code || '');

      return `
        <div class="student-card">
          <div class="student-card-header">
            <div>
              <div class="name">${escapeHtml(s.studentName || s.studentEmail)}</div>
              <div class="text-muted" style="font-size:0.8rem">${escapeHtml(s.studentEmail)}</div>
            </div>
            <div class="text-right">
              <span class="status ${s.status !== 'active' ? 'idle' : ''}">${s.status}</span>
              ${timer ? `<div class="timer-chip">⏱ ${timer}</div>` : ''}
              <div class="text-muted" style="font-size:0.7rem">${last}</div>
            </div>
          </div>
          <pre class="student-code-preview">${preview}</pre>
          <div class="student-events">${eventsHtml}</div>
          <div class="action-btns" style="padding:0.5rem">
            <button class="btn btn-sm btn-ghost" onclick="Dashboard.openStudentDetail('${s.id}')">Details</button>
            <button class="btn btn-sm btn-primary" onclick="Dashboard.promptExtend('${s.id}')">⏱ Extend</button>
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
  return h > 0 ? h + ':' + mm + ':' + ss : mm + ':' + ss;
}

window.Dashboard = Dashboard;
window.escapeHtml = window.escapeHtml || function(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
};
window.formatMs = formatMs;
