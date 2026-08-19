/**
 * Teacher / Proctor Live Dashboard — Assessments
 */

const Dashboard = {
  unsubscribers: [],
  currentExamId: null,
  currentExam: null,
  sessionsCache: [],
  proctorFilterIds: null,

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
            <h3>No assessments yet</h3>
            <p>Create a Code or Regular assessment.</p>
            <button class="btn btn-primary mt-2" onclick="App.showCreateExam()">+ Create Assessment</button>
          </div>`;
        return;
      }

      let html = `
        <div class="card-header page-header-responsive">
          <h2 class="page-title">My Assessments</h2>
          <button class="btn btn-primary" onclick="App.showCreateExam()">+ New Assessment</button>
        </div>
        <div class="assess-list">`;

      exams.forEach(ex => {
        const type = ex.examType === 'regular' ? 'Regular' : 'Code';
        const lang = ex.examType !== 'regular' ? (ex.language || 'python') : '';
        const start = ex.startAt ? new Date(ex.startAt).toLocaleString() : '—';
        const end = ex.endAt ? new Date(ex.endAt).toLocaleString() : '—';
        html += `
          <div class="assess-card">
            <div class="assess-card-main">
              <div class="assess-title">${escapeHtml(ex.title)}</div>
              <div class="assess-meta">
                <span class="chip">${type}${lang ? ' · ' + lang : ''}</span>
                <span class="chip">${escapeHtml(ex.subject || 'General')}</span>
                <span class="chip ${ex.active ? 'chip-ok' : ''}">${ex.active ? 'Active' : 'Closed'}</span>
              </div>
              <div class="text-muted" style="font-size:0.8rem;margin-top:0.35rem">
                ${start} → ${end}
              </div>
            </div>
            <div class="assess-actions">
              <div class="action-group">
                <span class="action-label">Monitor</span>
                <button class="btn btn-sm btn-primary" onclick="App.openLiveDashboard('${ex.id}')">Live</button>
                <button class="btn btn-sm btn-ghost" onclick="App.showIntegrityHistory('${ex.id}')">Integrity issues</button>
                <button class="btn btn-sm btn-ghost" onclick="App.showExamResults('${ex.id}')">Results</button>
              </div>
              <div class="action-group">
                <span class="action-label">Share</span>
                <button class="btn btn-sm btn-ghost" onclick="App.showSharePanel('${ex.id}')">Link / QR</button>
                <button class="btn btn-sm btn-ghost" onclick="App.showExamInvites('${ex.id}')">Invite</button>
                <button class="btn btn-sm btn-ghost" onclick="App.shareToCoTeacher('${ex.id}')">Share to Co-teacher</button>
                <button class="btn btn-sm btn-ghost" onclick="App.showProctors('${ex.id}')">Proctors</button>
              </div>
              <div class="action-group">
                <span class="action-label">Manage</span>
                <button class="btn btn-sm btn-ghost" onclick="App.editExam('${ex.id}')">Edit</button>
                <button class="btn btn-sm btn-ghost" onclick="App.duplicateExam('${ex.id}')">Duplicate</button>
                <button class="btn btn-sm btn-ghost" onclick="App.toggleExamActive('${ex.id}', ${!ex.active})">${ex.active ? 'Close' : 'Reopen'}</button>
                <button class="btn btn-sm btn-danger" onclick="App.deleteExam('${ex.id}', '${escapeHtml(ex.title).replace(/'/g, "\\'")}')">Delete</button>
              </div>
            </div>
          </div>`;
      });

      html += '</div>';
      container.innerHTML = html;
    } catch (err) {
      const msg = err.message || String(err);
      let help = /permission/i.test(msg)
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
      container.innerHTML = '<div class="empty-state">Assessment not found</div>';
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
            ${isProctor ? ' · <strong>Proctor view</strong>' : ''}
          </p>
        </div>
        <div class="action-btns">
          ${!isProctor ? `<button class="btn btn-primary" id="btn-extend-all">⏱ Extend all</button>` : ''}
          <button class="btn btn-ghost" onclick="App.showTeacherHome()">← Back</button>
        </div>
      </div>
      <div id="integrity-modal-root"></div>
      <div class="live-layout">
        <div id="live-sessions-grid" class="live-grid">
          <div class="empty-state">Waiting for students...</div>
        </div>
        <aside class="integrity-panel" id="integrity-panel">
          <div class="integrity-panel-head">
            <strong>Integrity issues</strong>
            <input type="search" id="integrity-filter" class="form-control" placeholder="Filter name, email..." />
          </div>
          <div id="integrity-list" class="integrity-list"><p class="text-muted">No events yet.</p></div>
        </aside>
      </div>
    `;

    const extBtn = document.getElementById('btn-extend-all');
    if (extBtn) extBtn.onclick = () => this.promptExtendAll(examId);

    const unsub = Exam.listenToSessions(examId, (sessions) => {
      let list = sessions;
      if (proctorFilterIds) list = sessions.filter(s => proctorFilterIds.includes(s.studentId));
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
      this._allIntegrity = filtered;
      this._handlePasteNotifications(filtered);
      this.renderIntegrityPanel(filtered);
    });
    this.unsubscribers.push(unsubN);

    const filterInput = document.getElementById('integrity-filter');
    if (filterInput) {
      filterInput.oninput = () => this.renderIntegrityPanel(this._allIntegrity || []);
    }
  },

  renderIntegrityPanel(notifs) {
    const list = document.getElementById('integrity-list');
    if (!list) return;
    const q = (document.getElementById('integrity-filter')?.value || '').trim().toLowerCase();
    let items = notifs || [];
    if (q) {
      items = items.filter(n =>
        (n.studentName || '').toLowerCase().includes(q) ||
        (n.studentEmail || '').toLowerCase().includes(q) ||
        (n.details || '').toLowerCase().includes(q) ||
        (n.type || '').toLowerCase().includes(q)
      );
    }
    if (!items.length) {
      list.innerHTML = '<p class="text-muted">No matching integrity events.</p>';
      return;
    }
    list.innerHTML = items.map(n => {
      const time = n.createdAt?.toDate ? n.createdAt.toDate().toLocaleString() : '';
      const thumb = n.screenshot || (n.extra && n.extra.screenshot);
      return `<div class="integrity-item">
        <div class="integrity-item-main">
          <strong>${escapeHtml(n.studentName || n.studentEmail || '')}</strong>
          <div class="text-muted" style="font-size:0.75rem">${escapeHtml(n.studentEmail || '')}</div>
          <div><span class="chip">${escapeHtml(n.type || '')}</span> ${escapeHtml(n.details || '')}</div>
          <div class="text-muted" style="font-size:0.7rem">${time}</div>
        </div>
        ${thumb ? `<img class="integrity-thumb" src="${thumb}" alt="screen" onclick="UI.showImage(this.src,'Student screen')" />` : ''}
      </div>`;
    }).join('');
  },

  promptExtendAll(examId) {
    const mins = prompt('Extend this assessment for ALL students by how many minutes?', '15');
    if (!mins) return;
    Exam.extendExam(examId, Number(mins)).then(() => {
      alert('Extended by ' + mins + ' minutes.');
      const el = document.getElementById('live-container') || document.getElementById('main-content');
      this.renderLiveDashboard(el, examId, this.proctorFilterIds);
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
    let body = isRegular
      ? `<pre class="student-code-preview" style="height:280px;white-space:pre-wrap">${escapeHtml(Regular.answersPreview(session.answers, exam?.questions))}</pre>`
      : `<pre class="student-code-preview" style="height:280px;white-space:pre-wrap" id="detail-code"></pre>`;

    const root = document.getElementById('integrity-modal-root');
    root.innerHTML = `
      <div class="modal-overlay" id="detail-modal">
        <div class="modal modal-wide">
          <h2>${escapeHtml(session.studentName || session.studentEmail)}</h2>
          <p class="text-muted">Status: ${escapeHtml(session.status)}</p>
          ${body}
          <div class="mt-1 text-muted" style="font-size:0.85rem">
            ${ranges.length ? ranges.map(r => `Paste lines ${r.startLine}–${r.endLine}`).join(' · ') : 'No paste ranges'}
          </div>
          <div class="modal-actions mt-2 action-btns">
            <button class="btn btn-ghost" onclick="document.getElementById('detail-modal').remove()">Close</button>
            <button class="btn btn-primary" onclick="Dashboard.promptExtend('${sessionId}')">⏱ Extend</button>
            <button class="btn btn-primary" onclick="App.gradeSession('${sessionId}', '${session.examId}')">Grade</button>
          </div>
        </div>
      </div>`;

    if (!isRegular) {
      const pre = document.getElementById('detail-code');
      const lines = (session.code || '').split('\n');
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
    Exam.extendSession(sessionId, Number(mins)).then(() => alert('Extended by ' + mins + ' minutes.')).catch(e => alert(e.message));
  },

  _renderSessions(sessions, exam) {
    const grid = document.getElementById('live-sessions-grid');
    if (!grid) return;
    if (!sessions.length) {
      grid.innerHTML = '<div class="empty-state">Waiting for students...</div>';
      return;
    }
    sessions.sort((a, b) => (a.status === 'active' ? -1 : 1));
    const isRegular = exam?.examType === 'regular';

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
  const s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, '0'), ss = String(s % 60).padStart(2, '0');
  return h > 0 ? h + ':' + mm + ':' + ss : mm + ':' + ss;
}

window.Dashboard = Dashboard;
window.escapeHtml = window.escapeHtml || function(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
};
window.formatMs = formatMs;
