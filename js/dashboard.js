/**
 * Teacher / Proctor Live Dashboard — Assessments
 */

const Dashboard = {
  unsubscribers: [],
  currentExamId: null,
  currentExam: null,
  sessionsCache: [],
  proctorFilterIds: null,
  _allIntegrity: [],
  _examList: [],
  _tab: 'published',
  _filter: '',

  clearListeners() {
    this.unsubscribers.forEach(u => u && u());
    this.unsubscribers = [];
  },

  isExamLive(ex) {
    if (!ex || ex.active === false || ex.status === 'draft') return false;
    const { endAt } = Exam.getExamWindow(ex);
    return Date.now() < endAt;
  },

  async renderMyExams(container) {
    container.innerHTML = '<div class="loading-screen"><div class="spinner"></div></div>';
    try {
      this._examList = await Exam.listMyExams();
      this._renderExamList(container);
    } catch (err) {
      const msg = err.message || String(err);
      let help = /permission/i.test(msg)
        ? `<p class="mt-2">Publish <code>firestore.rules</code> in Firebase → Firestore → Rules.</p>` : '';
      container.innerHTML = `<div class="card"><p style="color:var(--danger)">Error: ${escapeHtml(msg)}</p>${help}</div>`;
    }
  },

  _renderExamList(container) {
    const exams = this._examList || [];
    const q = (this._filter || '').toLowerCase();
    const isDraft = (ex) => ex.status === 'draft' || (ex.active === false && !ex.endAt);

    let list = exams.filter(ex => {
      if (this._tab === 'drafts') return isDraft(ex) || ex.status === 'draft';
      // published
      return !isDraft(ex) && ex.status !== 'draft';
    });
    if (q) {
      list = list.filter(ex =>
        (ex.title || '').toLowerCase().includes(q) ||
        (ex.subject || '').toLowerCase().includes(q) ||
        (ex.examType || '').toLowerCase().includes(q)
      );
    }

    let html = `
      <div class="card-header page-header-responsive">
        <h2 class="page-title">My Assessments</h2>
        <button class="btn btn-primary" onclick="App.showCreateExam()">+ New Assessment</button>
      </div>
      <div class="assess-tabs">
        <button class="assess-tab ${this._tab === 'published' ? 'active' : ''}" onclick="Dashboard.setTab('published')">Published</button>
        <button class="assess-tab ${this._tab === 'drafts' ? 'active' : ''}" onclick="Dashboard.setTab('drafts')">Drafts</button>
        <input type="search" class="form-control assess-filter" placeholder="Filter assessments..."
          value="${escapeHtml(this._filter)}" oninput="Dashboard.setFilter(this.value)" />
      </div>
      <div class="assess-list">`;

    if (!list.length) {
      html += `<div class="empty-state"><p>No assessments in ${this._tab === 'drafts' ? 'Drafts' : 'Published'}.</p>
        <button class="btn btn-primary mt-2" onclick="App.showCreateExam()">+ Create Assessment</button></div>`;
    } else {
      list.forEach(ex => {
        const type = ex.examType === 'regular' ? 'Regular' : 'Code';
        const lang = ex.examType !== 'regular' ? (ex.language || 'python') : '';
        const start = ex.startAt ? new Date(ex.startAt).toLocaleString() : '—';
        const end = ex.endAt ? new Date(ex.endAt).toLocaleString() : '—';
        const live = this.isExamLive(ex);
        html += `
          <div class="assess-card">
            <div class="assess-card-main">
              <div class="assess-title">${escapeHtml(ex.title)}</div>
              <div class="assess-meta">
                <span class="chip">${type}${lang ? ' · ' + lang : ''}</span>
                <span class="chip">${escapeHtml(ex.subject || 'General')}</span>
                <span class="chip ${live ? 'chip-ok' : ''}">${live ? 'Live window open' : (ex.status === 'draft' ? 'Draft' : 'Closed / ended')}</span>
              </div>
              <div class="text-muted" style="font-size:0.8rem;margin-top:0.35rem">${start} → ${end}</div>
            </div>
            <div class="assess-actions">
              <div class="action-group">
                <span class="action-label">Monitor</span>
                ${live ? `<button class="btn btn-sm btn-primary" onclick="App.openLiveDashboard('${ex.id}')">Live</button>` : ''}
                <button class="btn btn-sm btn-ghost" onclick="App.testAsStudent('${ex.id}')">Test as student</button>
                <button class="btn btn-sm btn-ghost" onclick="App.showIntegrityHistory('${ex.id}')">Integrity issues</button>
                <button class="btn btn-sm btn-ghost" onclick="App.showExamResults('${ex.id}')">Results</button>
              </div>
              <div class="action-group">
                <span class="action-label">Share</span>
                ${ex.status !== 'draft' ? `<button class="btn btn-sm btn-ghost" onclick="App.showSharePanel('${ex.id}')">Link / QR</button>` : ''}
                <button class="btn btn-sm btn-ghost" onclick="App.showExamInvites('${ex.id}')">Invite</button>
                <button class="btn btn-sm btn-ghost" onclick="App.shareToCoTeacher('${ex.id}')">Share to Co-teacher</button>
                <button class="btn btn-sm btn-ghost" onclick="App.showProctors('${ex.id}')">Proctors</button>
              </div>
              <div class="action-group">
                <span class="action-label">Manage</span>
                <button class="btn btn-sm btn-ghost" onclick="App.editExam('${ex.id}')">Edit</button>
                <button class="btn btn-sm btn-ghost" onclick="App.duplicateExam('${ex.id}')">Duplicate</button>
                ${ex.status === 'draft' ? `<button class="btn btn-sm btn-primary" onclick="App.publishDraft('${ex.id}')">Publish</button>` : `
                <button class="btn btn-sm btn-ghost" onclick="App.toggleExamActive('${ex.id}', ${!ex.active})">${ex.active ? 'Close' : 'Reopen'}</button>`}
                <button class="btn btn-sm btn-danger" onclick="App.deleteExam('${ex.id}', '${escapeHtml(ex.title).replace(/'/g, "\\'")}')">Delete</button>
              </div>
            </div>
          </div>`;
      });
    }
    html += '</div>';
    container.innerHTML = html;
  },

  setTab(tab) {
    this._tab = tab;
    const c = document.getElementById('exams-container');
    if (c) this._renderExamList(c);
  },

  setFilter(val) {
    this._filter = val;
    const c = document.getElementById('exams-container');
    if (c) this._renderExamList(c);
  },

  async renderLiveDashboard(container, examId, proctorFilterIds = null) {
    this.clearListeners();
    this.currentExamId = examId;
    this.proctorFilterIds = proctorFilterIds;
    this._sessionScreenFilter = '';
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
            · <strong id="live-student-count">0 taking now</strong>
          </p>
        </div>
        <div class="action-btns">
          ${!isProctor ? `<button class="btn btn-primary" id="btn-extend-all">⏱ Extend all</button>` : ''}
          <button class="btn btn-ghost" onclick="App.showTeacherHome()">← Back</button>
        </div>
      </div>
      <div id="integrity-modal-root"></div>
      <div class="live-layout live-layout-fixed live-3panel">
        <div class="live-main">
          <div class="live-main-toolbar">
            <input type="search" id="session-screen-filter" class="form-control" placeholder="Filter student screens by name or email..." />
          </div>
          <div id="live-sessions-grid" class="live-grid">
            <div class="empty-state">Waiting for students...</div>
          </div>
        </div>
        <aside class="integrity-panel integrity-panel-fixed" id="integrity-panel">
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

    document.getElementById('session-screen-filter').oninput = (e) => {
      this._sessionScreenFilter = e.target.value;
      this._renderSessions(this.sessionsCache, exam);
    };

    this._seenStudentMsgs = this._seenStudentMsgs || {};
    const unsub = Exam.listenToSessions(examId, (sessions) => {
      let list = sessions;
      if (proctorFilterIds) list = sessions.filter(s => proctorFilterIds.includes(s.studentId));
      // popup new student messages
      list.forEach(s => {
        if (s.lastStudentMessage && s.chatPing && this._seenStudentMsgs[s.id] !== s.chatPing) {
          this._seenStudentMsgs[s.id] = s.chatPing;
          this.showIncomingStudentMessage(s);
        }
      });
      this.sessionsCache = list;
      this._renderSessions(list, exam);
    });
    this.unsubscribers.push(unsub);

    // Live integrity from notifications
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

    // Also listen integrityHistory for permanent sync
    try {
      const unsubH = window.db.collection('integrityHistory')
        .where('examId', '==', examId)
        .onSnapshot(snap => {
          const hist = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          hist.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
          // merge with notifications by id
          const map = {};
          (this._allIntegrity || []).forEach(n => { map[n.id] = n; });
          hist.forEach(n => { map[n.id] = n; });
          const merged = Object.values(map);
          merged.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
          this._allIntegrity = merged;
          this.renderIntegrityPanel(merged);
        }, () => {});
      this.unsubscribers.push(unsubH);
    } catch (_) {}

    document.getElementById('integrity-filter').oninput = () => this.renderIntegrityPanel(this._allIntegrity || []);
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

  async promptExtendAll(examId) {
    const mins = await UI.prompt('Extend this assessment for ALL students by how many minutes?', '15', 'Extend all');
    if (!mins) return;
    try {
      await Exam.extendExam(examId, Number(mins));
      await UI.alert('Extended by ' + mins + ' minutes.', 'Extended');
      const el = document.getElementById('live-container') || document.getElementById('main-content');
      this.renderLiveDashboard(el, examId, this.proctorFilterIds);
    } catch (e) {
      await UI.alert(e.message || String(e), 'Error');
    }
  },

  _lastPasteAlert: null,
  _handlePasteNotifications(notifs) {
    const critical = notifs.find(n => n.type === 'paste-critical' && n.id !== this._lastPasteAlert);
    if (critical) {
      this._lastPasteAlert = critical.id;
      this.showCriticalPaste(critical);
      return;
    }
    const msg = notifs.find(n => n.type === 'paste-message' && n.id !== this._lastPasteAlert && n.extra?.studentMessage);
    if (msg) {
      this._lastPasteAlert = msg.id;
      this.showStudentMessage(msg);
    }
  },

  showStudentMessage(n) {
    const root = document.getElementById('integrity-modal-root');
    if (!root) return;
    const studentMsg = n.extra?.studentMessage || '';
    root.innerHTML = `
      <div class="modal-overlay ui-modal-overlay" id="student-msg-modal">
        <div class="modal ui-modal">
          <h2>Message from student</h2>
          <p class="ui-modal-body"><strong>${escapeHtml(n.studentName || n.studentEmail)}</strong></p>
          <p class="ui-modal-body">${escapeHtml(studentMsg)}</p>
          <div id="sm-reply-box" class="hidden form-group"><label>Reply</label>
            <textarea id="sm-reply-text" class="form-control" rows="3"></textarea>
            <button class="btn btn-primary mt-1" id="sm-send">Send reply</button>
          </div>
          <div class="modal-actions action-btns cp-actions-row">
            <button class="btn btn-primary" id="sm-reply">Reply</button>
            <button class="btn btn-ghost" id="sm-close">Close</button>
          </div>
        </div>
      </div>`;
    document.getElementById('sm-close').onclick = () => document.getElementById('student-msg-modal')?.remove();
    document.getElementById('sm-reply').onclick = () => document.getElementById('sm-reply-box')?.classList.remove('hidden');
    document.getElementById('sm-send').onclick = async () => {
      const text = document.getElementById('sm-reply-text').value.trim();
      if (!text) return;
      await window.db.collection('sessions').doc(n.sessionId).update({
        instructorReply: text,
        instructorReplyAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      document.getElementById('student-msg-modal')?.remove();
      await UI.alert('Reply sent.', 'Sent');
    };
  },

  showCriticalPaste(n) {
    const root = document.getElementById('integrity-modal-root');
    if (!root) return;
    const studentMsg = n.extra?.studentMessage || n.studentMessage || '';
    root.innerHTML = `
      <div class="modal-overlay ui-modal-overlay" id="critical-paste-modal">
        <div class="modal ui-modal">
          <h2>3rd paste warning</h2>
          <p class="ui-modal-body"><strong>${escapeHtml(n.studentName || n.studentEmail)}</strong> has reached 3 copy-paste warnings.</p>
          ${studentMsg ? `<p class="ui-modal-body"><em>Student message:</em> ${escapeHtml(studentMsg)}</p>` : ''}
          <div id="cp-reply-box" class="hidden form-group"><label>Reply to student</label>
            <textarea id="cp-reply-text" class="form-control" rows="3"></textarea>
            <button class="btn btn-primary mt-1" id="cp-send-reply">Send reply</button>
          </div>
          <div class="modal-actions action-btns cp-actions-row">
            <button class="btn btn-danger" id="cp-end">End assessment</button>
            <button class="btn btn-ghost" id="cp-deduct">Deduct points</button>
            <button class="btn btn-ghost" id="cp-reply">Reply</button>
            <button class="btn btn-ghost" id="cp-ignore">Close</button>
          </div>
        </div>
      </div>`;
    document.getElementById('cp-ignore').onclick = () => document.getElementById('critical-paste-modal')?.remove();
    document.getElementById('cp-reply').onclick = () => document.getElementById('cp-reply-box')?.classList.remove('hidden');
    document.getElementById('cp-send-reply').onclick = async () => {
      const text = document.getElementById('cp-reply-text').value.trim();
      if (!text) return;
      await window.db.collection('sessions').doc(n.sessionId).update({
        instructorReply: text,
        instructorReplyAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      await UI.alert('Reply sent to student.', 'Sent');
      document.getElementById('critical-paste-modal')?.remove();
    };
    document.getElementById('cp-end').onclick = async () => {
      try {
        await window.db.collection('sessions').doc(n.sessionId).update({
          status: 'submitted',
          submitReason: 'teacher-ended',
          submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
          codeLocked: true
        });
      } catch (e) {
        await Exam.submitSession(n.sessionId, 'teacher-ended');
      }
      document.getElementById('critical-paste-modal')?.remove();
      await UI.alert('Assessment ended for this student.', 'Ended');
    };
    document.getElementById('cp-deduct').onclick = async () => {
      const pts = await UI.prompt('How many points to deduct?', '5', 'Deduct points');
      if (pts == null) return;
      await window.db.collection('sessions').doc(n.sessionId).update({
        penaltyPoints: firebase.firestore.FieldValue.increment(Number(pts) || 0),
        penaltyNote: 'Paste warnings x3'
      });
      document.getElementById('critical-paste-modal')?.remove();
      await UI.alert('Deducted ' + pts + ' points.', 'Penalty');
    };
  },


  showPasteAlert(n) {
    const lines = n.extra?.pasteRange?.lines || (String(n.details || '').match(/(\d+)\s*line/) || [])[1] || '?';
    const root = document.getElementById('integrity-modal-root');
    if (!root) return;
    root.innerHTML = `
      <div class="modal-overlay ui-modal-overlay" id="paste-modal">
        <div class="modal ui-modal">
          <h2>Suspicious activity</h2>
          <p class="ui-modal-body">
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
    if (!session) { await UI.alert('Session not found.', 'Error'); return; }

    const ranges = session.pasteRanges || [];
    const exam = this.currentExam;
    const isRegular = (session.examType || exam?.examType) === 'regular';
    let body = isRegular
      ? `<pre class="student-code-preview" style="height:280px;white-space:pre-wrap">${escapeHtml(Regular.answersPreview(session.answers, exam?.questions))}</pre>`
      : `<pre class="student-code-preview" style="height:280px;white-space:pre-wrap" id="detail-code"></pre>`;

    const root = document.getElementById('integrity-modal-root');
    root.innerHTML = `
      <div class="modal-overlay ui-modal-overlay" id="detail-modal">
        <div class="modal ui-modal modal-wide">
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

  async promptExtend(sessionId) {
    const mins = await UI.prompt('Extend this student by how many minutes?', '15', 'Extend');
    if (!mins) return;
    try {
      await Exam.extendSession(sessionId, Number(mins));
      await UI.alert('Extended by ' + mins + ' minutes.', 'Extended');
    } catch (e) {
      await UI.alert(e.message || String(e), 'Error');
    }
  },

  _renderSessions(sessions, exam) {
    const grid = document.getElementById('live-sessions-grid');
    if (!grid) return;
    let list = sessions || [];
    const activeCount = (sessions || []).filter(s => s.status === 'active' && !String(s.id).startsWith('test_')).length;
    const countEl = document.getElementById('live-student-count');
    if (countEl) countEl.textContent = activeCount + ' taking now';
    const q = (this._sessionScreenFilter || '').toLowerCase();
    if (q) {
      list = list.filter(s =>
        (s.studentName || '').toLowerCase().includes(q) ||
        (s.studentEmail || '').toLowerCase().includes(q)
      );
    }
    if (!list.length) {
      grid.innerHTML = '<div class="empty-state">Waiting for students...</div>';
      return;
    }
    list.sort((a, b) => (a.status === 'active' ? -1 : 1));
    const isRegular = exam?.examType === 'regular';

    grid.innerHTML = list.map(s => {
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
              <div class="name">${escapeHtml(s.studentName || s.studentEmail)}
                ${s.lastStudentMessage ? '<span class="chip chip-ok" title="' + escapeHtml(s.lastStudentMessage) + '">💬</span>' : ''}
              </div>
              <div class="text-muted" style="font-size:0.8rem">${escapeHtml(s.studentEmail)}</div>
              ${s.lastStudentMessage ? `<div class="student-chat-preview">Student: ${escapeHtml(s.lastStudentMessage)}</div>` : ''}
            </div>
            <div class="text-right">
              <span class="status ${s.status !== 'active' ? 'idle' : ''}">${s.status}</span>
              ${timer ? `<div class="timer-chip">⏱ ${timer}</div>` : ''}
              <div class="text-muted" style="font-size:0.7rem">${last}</div>
            </div>
          </div>
          <div class="screen-share-wrap">
            ${s.screenThumb
              ? `<img class="screen-share-img" src="${s.screenThumb}" alt="Student screen" onclick="UI.showImage(this.src,'Live student screen')" />`
              : `<div class="screen-share-placeholder">Waiting for screen share…</div>`}
            <span class="screen-share-label">${s.screenThumb ? 'Live screen' : 'No feed yet'}</span>
          </div>
          <details class="screen-code-details"><summary>Text snapshot</summary><pre class="student-code-preview">${preview}</pre></details>
          <div class="student-events">${eventsHtml}</div>
          <div class="action-btns" style="padding:0.5rem">
            <button class="btn btn-sm btn-ghost" onclick="Dashboard.openStudentDetail('${s.id}')">Details</button>
            <button class="btn btn-sm btn-ghost" onclick="Dashboard.messageStudent('${s.id}')">Message student</button>
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
