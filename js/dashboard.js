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
  // Default OFF — students still share screen; instructor must opt-in to view
  showLiveScreens: false,
  focusedSessionId: null,

  clearListeners() {
    if (this._livePollIv) { try { clearInterval(this._livePollIv); } catch (_) {} this._livePollIv = null; }

    this.unsubscribers.forEach(u => u && u());
    this.unsubscribers = [];
  },

  isExamLive(ex) {
    if (!ex || ex.status === 'draft') return false;
    if (ex.active === false) return false;
    const now = Date.now();
    const end = ex.endAt ? Number(ex.endAt) : null;
    if (end && now > end) return false;
    return true;
  },
  isExamEnded(ex) {
    if (!ex || ex.status === 'draft') return false;
    if (ex.active === false) return true;
    const end = ex.endAt ? Number(ex.endAt) : null;
    return !!(end && Date.now() > end);
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
              </div>
              <div class="text-muted" style="font-size:0.8rem;margin-top:0.35rem">${start} → ${end}</div>
              <div style="margin-top:0.35rem"><span class="chip ${live ? 'chip-ok' : (ex.status === 'draft' ? '' : 'chip-danger')}">${live ? 'Live window open' : (ex.status === 'draft' ? 'Draft' : 'Closed')}</span></div>
            </div>
            <div class="assess-cat-grid">
              <div class="action-group-box">
                <span class="action-label">Manage</span>
                <div class="btn-row">
                  <button class="btn btn-sm btn-ghost" onclick="App.editExam('${ex.id}')">Edit</button>
                  <button class="btn btn-sm btn-ghost" onclick="App.duplicateExam('${ex.id}')">Duplicate</button>
                  ${ex.status === 'draft' ? `<button class="btn btn-sm btn-primary" onclick="App.publishDraft('${ex.id}')">Publish</button>` : (this.isExamEnded(ex) || ex.active === false ? `<button class="btn btn-sm btn-primary" onclick="App.reopenExam('${ex.id}')">Reopen</button>` : `<button class="btn btn-sm btn-ghost" onclick="App.toggleExamActive('${ex.id}', false)">Close</button>`)}
                  <button class="btn btn-sm btn-danger" onclick="App.deleteExam('${ex.id}', '${escapeHtml(ex.title).replace(/'/g, "\\'")}')">Delete</button>
                </div>
              </div>
              <div class="action-group-box">
                <span class="action-label">Monitor</span>
                <div class="btn-row">
                  ${live ? `<button class="btn btn-sm btn-ghost" onclick="App.openLiveDashboard('${ex.id}')">Live</button>` : `<button class="btn btn-sm btn-ghost" disabled title="Assessment closed">Closed</button>`}
                  <button class="btn btn-sm btn-ghost" onclick="App.testAsStudent('${ex.id}')">Test</button>
                  <button class="btn btn-sm btn-ghost" onclick="App.showIntegrityHistory('${ex.id}')">Integrity</button>
                  <button class="btn btn-sm btn-ghost" onclick="App.showExamResults('${ex.id}')">Results</button>
                </div>
              </div>
              <div class="action-group-box">
                <span class="action-label">Share</span>
                <div class="btn-row">
                  <button class="btn btn-sm btn-ghost" onclick="App.showSharePanel('${ex.id}')">Link / QR</button>
                  <button class="btn btn-sm btn-ghost" onclick="App.showExamInvites('${ex.id}')">Invite</button>
                  <button class="btn btn-sm btn-ghost" onclick="App.shareToCoTeacher('${ex.id}')">Share to Co-Instructor</button>
                  <button class="btn btn-sm btn-ghost" onclick="App.showProctors('${ex.id}')">Add Proctor</button>
                </div>
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
            · <strong id="live-submitted-count">0 submitted</strong>
          </p>
        </div>
        <div class="action-btns" style="flex-wrap:wrap">
          <div class="live-screen-modes" style="display:flex;gap:0.35rem;flex-wrap:wrap;align-items:center">
            <button type="button" class="btn btn-sm btn-ghost" id="live-screens-all" title="Show all student screens">View all screens</button>
            <button type="button" class="btn btn-sm btn-ghost" id="live-screens-one" title="Watch one student">Specific student</button>
            <button type="button" class="btn btn-sm btn-ghost" id="live-screens-off" title="Hide screens (quota saver)">Screens off</button>
          </div>
          ${!isProctor ? `<button class="btn btn-primary" id="btn-extend-all">⏱ Extend all</button>` : ''}
          ${!isProctor ? `<button class="btn btn-danger" id="btn-end-all">End all assessments</button>` : ''}
          <button class="btn btn-ghost" onclick="App.showInstructorHome ? App.showInstructorHome() : App.showDashboard()">← Back</button>
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
    const endAllBtn = document.getElementById('btn-end-all');
    if (endAllBtn) endAllBtn.onclick = () => this.endAllAssessments(examId);

    document.getElementById('session-screen-filter').oninput = (e) => {
      this._sessionScreenFilter = e.target.value;
      this._renderSessions(this.sessionsCache, exam);
    };
    const liveToggle = document.getElementById('toggle-live-screens');
    if (liveToggle) {
      liveToggle.checked = !!this.showLiveScreens;
      liveToggle.onchange = () => this.setLiveScreensEnabled(liveToggle.checked);
    }
    const btnAll = document.getElementById('live-screens-all');
    const btnOne = document.getElementById('live-screens-one');
    const btnOff = document.getElementById('live-screens-off');
    if (btnAll) btnAll.onclick = () => {
      this.focusedSessionId = null;
      this.setLiveScreensEnabled(true);
      const sel = document.getElementById('live-focus-student');
      if (sel) sel.value = '';
    };
    if (btnOff) btnOff.onclick = () => {
      this.focusedSessionId = null;
      this.setLiveScreensEnabled(false);
      const sel = document.getElementById('live-focus-student');
      if (sel) sel.value = '';
    };
    if (btnOne) btnOne.onclick = () => {
      const sel = document.getElementById('live-focus-student');
      if (sel && sel.options.length > 1) {
        sel.focus();
        UI.alert('Choose a student from the dropdown above the grid to view only their screen.', 'Specific student');
      } else {
        UI.alert('No active students yet. When students join, pick one from the student filter dropdown.', 'Specific student');
      }
    };
    // Sync preference to exam so students stop/start screen uploads
    try {
      window.db.collection('exams').doc(examId).update({
        liveFeedEnabled: false, // default discreet — instructor turns on if needed
        liveFeedUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }).catch(() => {});
    } catch (_) {}
    this.showLiveScreens = false;
    this._liveExamId = examId;
    this.currentExamId = examId;
    this._liveMsgsPrimed = false;
    this._livePastePrimed = false;

    this._seenStudentMsgs = this._seenStudentMsgs || {};
    this._liveThumbs = this._liveThumbs || {};
    this._liveMsgsPrimed = false; // first snapshot only seeds — no popup for old messages
    document.getElementById('student-msg-modal')?.remove();
    document.getElementById('critical-paste-modal')?.remove();
    this.sessionsCache = [];
    this._liveThumbs = this._liveThumbs || {};

    const applySessions = (sessions) => {
      let list = Array.isArray(sessions) ? sessions.slice() : [];
      // Attach live thumbs
      list = list.map(s => ({
        ...s,
        screenThumb: s.screenThumb || this._liveThumbs[s.id] || null
      }));
      if (proctorFilterIds) {
        list = list.filter(s => proctorFilterIds.includes(s.studentId));
      }
      if (!this._liveMsgsPrimed) {
        list.forEach(s => { if (s.chatPing) this._seenStudentMsgs[s.id] = s.chatPing; });
        this._liveMsgsPrimed = true;
      } else {
        list.forEach(s => {
          if (s.lastStudentMessage && s.chatPing && this._seenStudentMsgs[s.id] !== s.chatPing) {
            this._seenStudentMsgs[s.id] = s.chatPing;
            if (s.awaitingAdmit || s.lockedUntilAdmit) this.showAdmitRequest(s);
            else this.showIncomingStudentMessage(s);
          }
        });
      }
      this.sessionsCache = list;
      this._renderSessions(list, this.currentExam || exam);
    };

    // 1) Immediate one-shot load so cards appear without waiting for snapshot
    window.db.collection('sessions').where('examId', '==', examId).get()
      .then(snap => applySessions(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(e => console.warn('sessions get', e));

    // 2) Live snapshot
    const unsub = Exam.listenToSessions(examId, (sessions) => {
      applySessions(sessions);
    });
    this.unsubscribers.push(unsub);

    // 3) Light poll every 5s as safety net
    const pollOnce = async () => {
      try {
        const snap = await window.db.collection('sessions').where('examId', '==', examId).get();
        applySessions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) { console.warn('sessions poll', e); }
    };
    this._livePollIv = setInterval(pollOnce, 5000);
    // Live screen thumbs collection (optional)
    try {
      const unsubLS = window.db.collection('liveScreens').onSnapshot(snap => {
        snap.docChanges().forEach(ch => {
          const id = ch.doc.id;
          const data = ch.doc.data() || {};
          if (data.thumb) this._liveThumbs[id] = data.thumb;
          if (data.cameraThumb) {
            this._liveCams = this._liveCams || {};
            this._liveCams[id] = data.cameraThumb;
          }
        });
        if (this.sessionsCache && this.sessionsCache.length) {
          const list = this.sessionsCache.map(s => ({
            ...s,
            screenThumb: s.screenThumb || this._liveThumbs[s.id]
          }));
          this._renderSessions(list, this.currentExam);
        }
      }, () => {});
      this.unsubscribers.push(unsubLS);
    } catch (_) {}

    // Live integrity from notifications
    const unsubN = Exam.listenToNotifications([examId], (notifs) => {
      // Pull any session docs referenced by integrity events into the live grid
      (notifs || []).forEach(n => {
        const sid = n.sessionId;
        if (!sid) return;
        if ((this.sessionsCache || []).some(s => s.id === sid)) return;
        window.db.collection('sessions').doc(sid).get().then(snap => {
          if (!snap.exists) return;
          const data = snap.data() || {};
          if (data.examId && data.examId !== examId) return;
          const row = { id: snap.id, ...data, studentName: data.studentName || n.studentName, studentEmail: data.studentEmail || n.studentEmail };
          const merged = [...(this.sessionsCache || []).filter(s => s.id !== row.id), row];
          this.sessionsCache = merged;
          this._renderSessions(merged, this.currentExam || exam);
        }).catch(() => {});
      });
      let filtered = notifs;
      if (proctorFilterIds) {
        filtered = notifs.filter(n => {
          const s = this.sessionsCache.find(x => x.id === n.sessionId);
          return s && proctorFilterIds.includes(s.studentId);
        });
      }
      this._allIntegrity = filtered;
      if (!this._livePastePrimed) {
        filtered.forEach(n => {
          if (n.type === 'paste-critical' || n.type === 'paste-message') this._lastPasteAlert = n.id;
        });
        this._livePastePrimed = true;
      } else {
        this._handlePasteNotifications(filtered);
      }
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
    // Deduplicate by sessionId+type+details+minute
    const seen = new Set();
    items = items.filter(n => {
      const ts = n.createdAt?.toMillis?.() || Date.parse(n.timestamp || 0) || 0;
      const bucket = Math.floor(ts / 60000);
      const key = [n.sessionId || '', (n.type === 'outside-assessment' || n.type === 'window-blur' ? 'Clicked outside assessment page' : (n.type || '')), n.details || '', bucket].join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (q) {
      items = items.filter(n =>
        (n.studentName || '').toLowerCase().includes(q) ||
        (n.studentEmail || '').toLowerCase().includes(q) ||
        (n.details || '').toLowerCase().includes(q) ||
        ((n.type === 'outside-assessment' || n.type === 'window-blur' ? 'Clicked outside assessment page' : (n.type || ''))).toLowerCase().includes(q)
      );
    }
    // Paste issues first
    const rank = (n) => {
      if (n.type === 'paste-critical' || n.type === 'paste' || n.type === 'paste-key' || n.type === 'paste-message') return 0;
      if (n.type === 'tabswitch' || n.type === 'blur' || n.type === 'exited-fullscreen') return 1;
      return 5;
    };
    // Newest first by time only (no paste-on-top)
    items.sort((a, b) => (b.createdAt?.toMillis?.() || Date.parse(b.timestamp||0) || 0) - (a.createdAt?.toMillis?.() || Date.parse(a.timestamp||0) || 0));
    if (!items.length) {
      list.innerHTML = '<p class="text-muted">No matching integrity events.</p>';
      return;
    }
    list.innerHTML = items.map(n => {
      const time = n.createdAt?.toDate ? n.createdAt.toDate().toLocaleString() : (n.timestamp ? new Date(n.timestamp).toLocaleString() : '');
      const thumb = n.screenshot || n.extra?.screenshot || n.screenThumb;
      return `<div class="integrity-item integrity-item-row">
        ${thumb ? `<img class="integrity-thumb" src="${thumb}" alt="shot" onclick="UI.showImage(this.src,'Integrity screenshot')" />` : `<div class="integrity-thumb integrity-thumb-empty"></div>`}
        <div class="integrity-item-main">
          <strong>${escapeHtml(n.studentName || n.studentEmail || '')}</strong>
          <div class="text-muted" style="font-size:0.75rem">${escapeHtml(n.studentEmail || '')}</div>
          <div><span class="chip">${escapeHtml((n.type === 'outside-assessment' || n.type === 'window-blur' ? 'Clicked outside assessment page' : (n.type || '')))}</span> ${escapeHtml(n.details || '')}</div>
          <div class="text-muted" style="font-size:0.7rem">${time}</div>
        </div>
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
  /** Call when opening live dashboard so prior messages are not re-shown */
  seedSeenMessages(sessions) {
    this._seenStudentMsgs = this._seenStudentMsgs || {};
    (sessions || []).forEach(s => {
      if (s.chatPing) this._seenStudentMsgs[s.id] = s.chatPing;
      if (s.lastStudentMessageAt) {
        const t = s.lastStudentMessageAt.toMillis ? s.lastStudentMessageAt.toMillis() : s.lastStudentMessageAt;
        this._seenStudentMsgs[s.id + '_ts'] = t;
      }
    });
    // Clear any leftover modal from a previous visit
    document.getElementById('student-msg-modal')?.remove();
    document.getElementById('critical-paste-modal')?.remove();
  },
  _handlePasteNotifications(notifs) {
    this._endedSessions = this._endedSessions || {};
    this._pasteIgnoreSessions = this._pasteIgnoreSessions || {};
    const critical = notifs.find(n => n.type === 'paste-critical' && n.id !== this._lastPasteAlert && !this._endedSessions[n.sessionId] && !this._pasteIgnoreSessions[n.sessionId]);
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
    document.getElementById('cp-ignore').onclick = () => {
      this._pasteIgnoreSessions = this._pasteIgnoreSessions || {};
      this._pasteIgnoreSessions[n.sessionId] = true;
      document.getElementById('critical-paste-modal')?.remove();
      UI.alert('Further paste alerts for this student are silenced for this session. History is still recorded.', 'Ignored');
    };
    document.getElementById('cp-reply').onclick = () => {
      document.getElementById('cp-reply-box')?.classList.remove('hidden');
      const ta = document.getElementById('cp-reply-text');
      if (ta) { ta.value = ''; ta.placeholder = 'Type your reply…'; }
    };
    document.getElementById('cp-send-reply').onclick = async () => {
      const text = document.getElementById('cp-reply-text').value.trim();
      if (!text) return;
      await window.db.collection('sessions').doc(n.sessionId).update({
        instructorReply: text,
        lastInstructorMessage: text,
        instructorReplyAt: firebase.firestore.FieldValue.serverTimestamp(),
        chatPing: Date.now()
      });
      await UI.alert('Reply sent to student.', 'Sent');
      document.getElementById('critical-paste-modal')?.remove();
    };
    document.getElementById('cp-end').onclick = async () => {
      const btn = document.getElementById('cp-end');
      if (btn) btn.disabled = true;
      this._lastPasteAlert = n.id; // prevent re-popup loop
      this._endedSessions = this._endedSessions || {};
    this._pasteIgnoreSessions = this._pasteIgnoreSessions || {};
      this._endedSessions[n.sessionId] = true;
      try {
        await window.db.collection('sessions').doc(n.sessionId).update({
          status: 'submitted',
          submitReason: 'teacher-ended',
          submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
          codeLocked: true,
          chatPing: Date.now()
        });
      } catch (e) {
        try { await Exam.submitSession(n.sessionId, 'teacher-ended'); } catch (e2) { console.error(e2); }
      }
      document.getElementById('critical-paste-modal')?.remove();
      // one-shot alert, not re-triggered
      UI.alert('Assessment ended for this student.', 'Ended');
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



  showAdmitRequest(s) {
    if (!s || !s.id) return;
    document.getElementById('admit-req-modal')?.remove();
    const root = document.getElementById('integrity-modal-root') || document.body;
    const wrap = document.createElement('div');
    wrap.id = 'admit-req-modal';
    wrap.className = 'modal-overlay ui-modal-overlay';
    wrap.style.cssText = 'z-index:50000;pointer-events:auto';
    wrap.innerHTML = `
      <div class="modal ui-modal">
        <h2>Student left assessment</h2>
        <p class="ui-modal-body"><strong>${escapeHtml(s.studentName || s.studentEmail || 'Student')}</strong> wants to return.</p>
        <p class="ui-modal-body">${escapeHtml(s.lockRequestMessage || s.lastStudentMessage || '')}</p>
        <div class="form-group">
          <label>Reply to student</label>
          <textarea id="admit-reply" class="form-control" rows="2" placeholder="Optional message…"></textarea>
        </div>
        <div class="modal-actions action-btns" style="flex-wrap:wrap">
          <button class="btn btn-danger" id="admit-end">End Student Assessment</button>
          <button class="btn btn-ghost" id="admit-ignore">Ignore</button>
          <button class="btn btn-primary" id="admit-ok">Admit</button>
        </div>
      </div>`;
    root.appendChild(wrap);
    const sendReply = async () => {
      const text = (document.getElementById('admit-reply')?.value || '').trim();
      if (!text) return;
      await window.db.collection('sessions').doc(s.id).update({
        lastInstructorMessage: text,
        instructorReply: text,
        chatPing: Date.now()
      });
    };
    document.getElementById('admit-ignore').onclick = async () => {
      await sendReply();
      wrap.remove();
    };
    document.getElementById('admit-ok').onclick = async () => {
      await sendReply();
      await window.db.collection('sessions').doc(s.id).update({
        lockedUntilAdmit: false,
        instructorAdmitted: true,
        awaitingAdmit: false,
        admittedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      wrap.remove();
      if (window.UI) UI.alert('Student admitted back into the assessment.', 'Admitted');
    };
    document.getElementById('admit-end').onclick = async () => {
      await sendReply();
      try {
        await window.db.collection('sessions').doc(s.id).update({
          status: 'submitted',
          submitReason: 'teacher-ended',
          lockedUntilAdmit: false,
          awaitingAdmit: false,
          submittedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      } catch (e) { console.error(e); }
      wrap.remove();
    };
  },

  showIncomingStudentMessage(s) {
    if (!s || !s.id) return;
    const text = String(s.lastStudentMessage || '').trim();
    if (!text || text === '(No message)') return;
    // Avoid duplicate popup for same chatPing
    const key = s.id + '_' + (s.chatPing || s.lastStudentMessageAt || text);
    this._shownStudentChats = this._shownStudentChats || {};
    if (this._shownStudentChats[key]) return;
    this._shownStudentChats[key] = true;

    document.getElementById('student-msg-modal')?.remove();
    const root = document.getElementById('integrity-modal-root') || document.body;
    const wrap = document.createElement('div');
    wrap.id = 'student-msg-modal';
    wrap.className = 'modal-overlay ui-modal-overlay';
    wrap.style.cssText = 'z-index:50000;pointer-events:auto';
    wrap.innerHTML = `
      <div class="modal ui-modal">
        <h2>Message from student</h2>
        <p class="ui-modal-body"><strong>${escapeHtml(s.studentName || s.studentEmail || 'Student')}</strong></p>
        <p class="ui-modal-body">${escapeHtml(text)}</p>
        <div class="form-group">
          <label>Reply</label>
          <textarea id="student-msg-reply" class="form-control" rows="3" placeholder="Type your reply…"></textarea>
        </div>
        <div class="modal-actions action-btns">
          <button class="btn btn-ghost" id="student-msg-close">Close</button>
          <button class="btn btn-primary" id="student-msg-send">Send reply</button>
        </div>
      </div>`;
    root.appendChild(wrap);
    document.getElementById('student-msg-close').onclick = () => wrap.remove();
    document.getElementById('student-msg-send').onclick = async () => {
      const reply = (document.getElementById('student-msg-reply')?.value || '').trim();
      if (!reply) {
        await UI.alert('Please type a reply.', 'Empty');
        return;
      }
      try {
        await window.db.collection('sessions').doc(s.id).update({
          lastInstructorMessage: reply,
          instructorReply: reply,
          lastInstructorMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
          instructorReplyAt: firebase.firestore.FieldValue.serverTimestamp(),
          chatPing: Date.now()
        });
        wrap.remove();
        await UI.alert('Reply sent to student.', 'Sent');
      } catch (e) {
        await UI.alert(e.message || String(e), 'Error');
      }
    };
  },

  async endStudentAssessment(sessionId) {
    if (!sessionId) {
      await UI.alert('No session selected.', 'Error');
      return;
    }
    const ok = await UI.confirm(
      "End this student's assessment now? Their work will be submitted and they will be removed from live view.",
      'End assessment'
    );
    if (!ok) return;
    try {
      // Direct Firestore update so instructor-side always works
      await window.db.collection('sessions').doc(sessionId).update({
        status: 'submitted',
        submitReason: 'teacher-ended',
        submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
        screenThumb: null,
        cameraThumb: null,
        monitorFeed: 'SUBMITTED',
        monitoringStopped: true,
        instructorEnded: true
      });
      try { await window.db.collection('liveScreens').doc(sessionId).delete(); } catch (_) {}
      await UI.alert('Assessment ended for this student.', 'Ended');
    } catch (e) {
      console.error(e);
      await UI.alert(e.message || String(e), 'Error');
    }
  },

  async endAllAssessments(examId) {
    const ok = await UI.confirm(
      'End assessment for ALL students currently taking this exam? Their work will be submitted.',
      'End all assessments'
    );
    if (!ok) return;
    try {
      const sessions = this.sessionsCache || [];
      const active = sessions.filter(s =>
        s.status === 'active' && !String(s.id).startsWith('test_')
      );
      let n = 0;
      for (const s of active) {
        try {
          await window.db.collection('sessions').doc(s.id).update({
            status: 'submitted',
            submitReason: 'teacher-ended',
            submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
            screenThumb: null,
            cameraThumb: null,
            monitorFeed: 'SUBMITTED',
            monitoringStopped: true,
            instructorEnded: true
          });
          try { await window.db.collection('liveScreens').doc(s.id).delete(); } catch (_) {}
          n++;
        } catch (e) { console.warn(e); }
      }
      await UI.alert('Ended assessment for ' + n + ' student(s).', 'Ended');
    } catch (e) {
      console.error(e);
      await UI.alert(e.message || String(e), 'Error');
    }
  },

  async messageStudent(sessionId) {
    if (!sessionId) {
      await UI.alert('No session selected.', 'Error');
      return;
    }
    const msg = await UI.prompt('Message this student:', '', 'Message student', 'Type your message…');
    if (msg == null) return;
    const text = String(msg).trim();
    if (!text) {
      await UI.alert('Please type a message.', 'Empty');
      return;
    }
    try {
      await window.db.collection('sessions').doc(sessionId).update({
        lastInstructorMessage: text,
        instructorReply: text,
        lastInstructorMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
        instructorReplyAt: firebase.firestore.FieldValue.serverTimestamp(),
        chatPing: Date.now()
      });
      await UI.alert('Message sent to student.', 'Sent');
    } catch (e) {
      console.error(e);
      await UI.alert(e.message || String(e), 'Error');
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


  setLiveScreensEnabled(on) {
    this.showLiveScreens = !!on;
    try {
      if (this.currentExamId || this._liveExamId) {
        const id = this.currentExamId || this._liveExamId;
        window.db.collection('exams').doc(id).update({
          liveFeedEnabled: !!on,
          liveFeedUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(() => {});
      }
    } catch (_) {}
    if (this.sessionsCache) this._renderSessions(this.sessionsCache, this.currentExam);
  },

  _renderSessions(sessions, exam) {
    // Refresh focus dropdown
    const sel = document.getElementById('focus-student-screen');
    if (sel) {
      const cur = this.focusedSessionId || '';
      const opts = ['<option value="">All students (grid)</option>'];
      (sessions || []).filter(s => s.status === 'active').forEach(s => {
        const label = escapeHtml((s.studentName || s.studentEmail || s.id || '').toString());
        opts.push(`<option value="${escapeHtml(s.id)}" ${cur === s.id ? 'selected' : ''}>${label}</option>`);
      });
      sel.innerHTML = opts.join('');
      sel.onchange = () => {
        this.focusedSessionId = sel.value || null;
        // Viewing one student implies screens on for that card only
        if (this.focusedSessionId) this.showLiveScreens = true;
        this._renderSessions(this.sessionsCache, this.currentExam || exam);
      };
    }
    const grid = document.getElementById('live-sessions-grid');
    if (!grid) return;
    const all = sessions || [];
    const activeCount = all.filter(s => s.status === 'active' && !String(s.id).startsWith('test_')).length;
    const submittedCount = all.filter(s => s.status === 'submitted' || s.status === 'ended').length;
    const countEl = document.getElementById('live-student-count');
    if (countEl) countEl.textContent = activeCount + ' taking now';
    const subEl = document.getElementById('live-submitted-count');
    if (subEl) subEl.textContent = submittedCount + ' submitted';

    // Show all non-finished sessions (default status = active)
    let list = all.filter(s => {
      if (!s || !s.id) return false;
      if (String(s.id).startsWith('test_')) return false;
      if (s.isMock) return false;
      const st = String(s.status || 'active').toLowerCase().trim();
      return st !== 'submitted' && st !== 'ended' && st !== 'graded';
    });
    const q = (this._sessionScreenFilter || '').toLowerCase();
    if (q) {
      list = list.filter(s =>
        (s.studentName || '').toLowerCase().includes(q) ||
        (s.studentEmail || '').toLowerCase().includes(q)
      );
    }
    // Instructor: watch only one student's screen (others removed from grid)
    if (this.focusedSessionId) {
      const still = list.some(s => s.id === this.focusedSessionId);
      if (!still) this.focusedSessionId = null;
      else list = list.filter(s => s.id === this.focusedSessionId);
    }
    if (!list.length) {
      grid.innerHTML = '<div class="empty-state">Waiting for students… (no active sessions for this assessment yet)</div>';
      return;
    }
    // Sort by violation count then name (no forced paste-on-top)
    const severity = (s) => {
      const ev = (s.events || []).map(e => e.type);
      if (ev.includes('paste') || ev.includes('paste-key') || ev.includes('paste-critical') || ev.includes('paste-message')) return 0;
      if (s.isWindowFocused === false || s.isFullscreen === false) return 1;
      if ((s.violationCount || 0) > 0) return 2;
      if (s.lastStudentMessage) return 3;
      return 9;
    };
    list.sort((a, b) => (b.violationCount||0) - (a.violationCount||0) || String(a.studentName||'').localeCompare(String(b.studentName||'')));
    const isRegular = exam?.examType === 'regular';

    try {
    grid.innerHTML = list.map(s => {
      const last = s.lastUpdate?.toDate ? s.lastUpdate.toDate().toLocaleTimeString() : '—';
      const remain = s.endsAt ? Math.max(0, s.endsAt - Date.now()) : null;
      const timer = remain != null ? formatMs(remain) : '';
      const eventsHtml = (s.events || []).slice(-4).reverse().map(e => {
        const cls = ['copy','paste','paste-key','tabswitch','blur','close','rightclick','drop','cut'].includes(e.type) ? 'danger' : '';
        return `<div class="event-item ${cls}">⚠ ${e.type}: ${escapeHtml(e.details || '')}</div>`;
      }).join('') || '<span class="text-muted">No events</span>';
      let preview = '';
      try {
        if (isRegular) {
          if (typeof Regular.answersPreview === 'function') {
            preview = escapeHtml(Regular.answersPreview(s.answers, exam?.questions));
          } else {
            const n = s.answers && typeof s.answers === 'object' ? Object.keys(s.answers).length : 0;
            preview = n ? (n + ' answer(s)') : '';
          }
        } else {
          preview = escapeHtml(s.code || '');
        }
      } catch (_) { preview = ''; }

      const live = this._liveThumbs || {};
      const feed = s.screenThumb || live[s.id];
      const isMobile = s.deviceType === 'mobile' || (typeof s.monitorFeed === 'string' && !String(s.monitorFeed).startsWith('data:'));
      const focused = s.isWindowFocused !== false;
      const fs = s.isFullscreen !== false;
      const violations = s.violationCount || 0;
      const alert = (!focused || !fs || violations > 0 && (s.monitorFeed === 'LEFT EXAM APP' || s.monitorFeed === 'TAB HIDDEN' || s.monitorFeed === 'WINDOW BLUR'));
      const cardAlert = (!focused || !fs) ? 'student-card-alert' : '';
      return `
        <div class="student-card ${cardAlert}">
          <div class="student-card-header">
            <div>
              ${(!focused || !fs) ? '<div class="violation-banner">⚠️ ' + (!fs ? 'EXITED FULLSCREEN' : 'LEFT APPLICATION') + '</div>' : ''}
              <div class="name">${escapeHtml(s.studentName || s.studentEmail)}
                ${s.lastStudentMessage ? '<span class="chip chip-ok" title="' + escapeHtml(s.lastStudentMessage) + '">💬</span>' : ''}
                ${isMobile ? '<span class="chip">📱 Mobile</span>' : '<span class="chip">🖥️ Desktop</span>'}
              </div>
              <div class="text-muted" style="font-size:0.8rem">${escapeHtml(s.studentEmail)}</div>
              <div class="text-muted" style="font-size:0.75rem">Violations: ${violations}</div>
            </div>
            <div class="text-right">
              <span class="status ${s.status !== 'active' ? 'idle' : ''}">${s.status}</span>
              ${timer ? `<div class="timer-chip">⏱ ${timer}</div>` : ''}
              <div class="text-muted" style="font-size:0.7rem">${last}</div>
            </div>
          </div>
          <div class="screen-share-wrap">
            ${!this.showLiveScreens
              ? `<div class="screen-share-placeholder">Live screens off<br/><span style="font-size:0.7rem">Quota saver</span></div>`
              : (this.focusedSessionId && this.focusedSessionId !== s.id)
                ? `<div class="screen-share-placeholder">Screen hidden<br/><span style="font-size:0.7rem">Viewing another student</span></div>`
              : (feed && (String(feed).startsWith('data:') || String(feed).startsWith('http'))
                ? `<img class="screen-share-img" src="${feed}" alt="Screen" onclick="UI.showImage(this.src,'Student screen')" />`
                : isMobile
                  ? `<div class="screen-share-placeholder mobile-status">📱 ${escapeHtml(s.monitorFeed || 'Mobile active')}</div>`
                  : `<div class="screen-share-placeholder">Waiting for screen…</div>`)}
            <span class="screen-share-label">Screen</span>
          </div>
          <div class="${(s.connectionQuality === 'bad' || s.pingMs > 800) ? 'ping-bad' : 'ping-ok'}">
            ${(s.connectionQuality === 'bad' || s.pingMs > 800) ? '⚠ Bad connection' : (s.pingMs != null ? ('Ping ' + s.pingMs + ' ms') : 'Connection OK')}
          </div>
          ${isRegular ? '' : `<details class="screen-code-details"><summary>Text snapshot</summary><pre class="student-code-preview">${preview}</pre></details>`}
          <div class="student-events">${eventsHtml}</div>
          <div class="action-btns" style="padding:0.5rem">
            <button class="btn btn-sm btn-ghost" onclick="Dashboard.openStudentDetail('${s.id}')">Details</button>
            <button class="btn btn-sm btn-ghost" onclick="Dashboard.messageStudent('${s.id}')">Message student</button>
            <button class="btn btn-sm btn-primary" onclick="Dashboard.promptExtend('${s.id}')">⏱ Extend</button>
            <button class="btn btn-sm btn-danger" onclick="Dashboard.endStudentAssessment('${s.id}')">End assessment</button>
            <button class="btn btn-sm btn-primary" onclick="App.gradeSession('${s.id}', '${s.examId}')">Grade</button>
          </div>
        </div>`;
    }).join('');
    } catch (err) {
      console.error('live card render', err);
      grid.innerHTML = list.map(s => {
        const name = escapeHtml(s.studentName || s.studentEmail || s.id);
        const st = escapeHtml(s.status || 'active');
        return `<div class="student-card"><div class="student-card-header"><div>
          <strong>${name}</strong>
          <div class="text-muted">${escapeHtml(s.studentEmail || '')}</div>
          <div>Violations: ${s.violationCount || 0}</div>
        </div><span class="chip chip-ok">${st}</span></div>
        <div class="action-btns" style="padding:0.5rem">
          <button class="btn btn-sm btn-ghost" onclick="Dashboard.openStudentDetail('${s.id}')">Details</button>
          <button class="btn btn-sm btn-ghost" onclick="Dashboard.messageStudent('${s.id}')">Message student</button>
          <button class="btn btn-sm btn-primary" onclick="App.gradeSession('${s.id}', '${s.examId || ''}')">Grade</button>
        </div></div>`;
      }).join('') || '<div class="empty-state">Waiting for students…</div>';
    }
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
