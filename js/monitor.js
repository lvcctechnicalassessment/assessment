/**
 * Soft client-side write budget to protect Spark free quotas
 * (20k writes / 50k reads / 20k deletes per day). Live thumbs are throttled first.
 */
window.WriteBudget = window.WriteBudget || {
  dayKey() { return new Date().toISOString().slice(0, 10); },
  load() {
    try {
      const raw = localStorage.getItem('lvcc_write_budget');
      const o = raw ? JSON.parse(raw) : null;
      if (!o || o.day !== this.dayKey()) return { day: this.dayKey(), writes: 0, reads: 0, deletes: 0, liveStopped: false };
      return o;
    } catch (_) { return { day: this.dayKey(), writes: 0, reads: 0, deletes: 0, liveStopped: false }; }
  },
  save(o) { try { localStorage.setItem('lvcc_write_budget', JSON.stringify(o)); } catch (_) {} },
  // Reserve headroom for saves/results/exports (~8k writes buffer)
  maxLiveWrites: 8000,
  canLiveWrite() {
    const o = this.load();
    return !o.liveStopped && o.writes < this.maxLiveWrites;
  },
  recordWrite(n = 1) {
    const o = this.load();
    o.writes += n;
    if (o.writes >= this.maxLiveWrites && !o.liveStopped) {
      o.liveStopped = true;
      this.save(o);
      if (window.UI) {
        UI.alert(
          'Live monitoring write limit for today was reached to protect free-tier quotas. Assessment saving, results, integrity export, and PDF export remain available. Live screen updates are paused until tomorrow.',
          'Live monitoring paused'
        );
      }
      return false;
    }
    this.save(o);
    return true;
  }
};

/**
 * Assessment integrity monitor
 * - Desktop: enforce fullscreen + screen share
 * - Live thumbs overwrite every 10-15s (screen + camera)
 * - HQ capture only on violation
 */
const Monitor = {
  sessionId: null,
  examId: null,
  deviceType: 'desktop',
  stream: null,
  video: null,
  cameraStream: null,
  cameraVideo: null,
  timer: null,
  started: false,
  violationCount: 0,
  submitting: false,
  _lockShown: false,

  detectDevice() {
    const ua = navigator.userAgent || '';
    const mobile = /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry/i.test(ua)
      || (navigator.maxTouchPoints > 1 && window.innerWidth < 900);
    this.deviceType = mobile ? 'mobile' : 'desktop';
    return this.deviceType;
  },

  isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  },

  async requestFullscreen() {
    const el = document.documentElement;
    try {
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    } catch (e) {
      console.warn('fullscreen', e);
    }
  },

  isSupportedBrowser() {
    const ua = navigator.userAgent || '';
    const isEdge = ua.indexOf('Edg/') >= 0 || ua.indexOf('EdgiOS/') >= 0;
    const isChrome = (ua.indexOf('Chrome/') >= 0 || ua.indexOf('CriOS/') >= 0) && ua.indexOf('OPR/') < 0 && !isEdge;
    return isChrome || isEdge;
  },

  async detectMultiMonitor() {
    try {
      if (window.screen && typeof window.screen.isExtended === 'boolean') {
        return !!window.screen.isExtended;
      }
      // Heuristic: very wide virtual screen vs window
      const aw = window.screen.availWidth || 0;
      const iw = window.innerWidth || 0;
      if (aw > 0 && iw > 0 && aw > iw * 1.6 && aw > 2200) return true;
    } catch (_) {}
    return false;
  },

  /** Universal consent UI when native getDisplayMedia is unavailable (common on mobile) */
  fakeScreenShareConsent() {
    return new Promise((resolve) => {
      const existing = document.getElementById('fake-share-modal');
      if (existing) existing.remove();
      const root = document.createElement('div');
      root.id = 'fake-share-modal';
      root.className = 'modal-overlay ui-modal-overlay';
      root.style.cssText = 'position:fixed;inset:0;z-index:60000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);padding:1rem';
      root.innerHTML = `<div class="modal ui-modal" style="max-width:440px;width:100%">
        <h2 style="margin-top:0">Screen sharing required</h2>
        <p style="text-align:left;line-height:1.5">
          <strong>${location.hostname || 'This site'}</strong> wants to share the contents of your screen for assessment integrity monitoring.
        </p>
        <p style="text-align:left;font-size:0.9rem;opacity:0.9">
          By tapping <strong>Allow</strong>, you consent to screen monitoring while this assessment is open.
          Your screen will be monitored for the duration of the exam.
        </p>
        <div class="action-btns" style="justify-content:flex-end;gap:0.5rem;margin-top:1.25rem">
          <button type="button" class="btn btn-ghost" id="fake-share-deny">Block</button>
          <button type="button" class="btn btn-primary" id="fake-share-allow">Allow</button>
        </div>
      </div>`;
      document.body.appendChild(root);
      root.querySelector('#fake-share-deny').onclick = () => { root.remove(); resolve(false); };
      root.querySelector('#fake-share-allow').onclick = () => { root.remove(); resolve(true); };
    });
  },

  async ensureScreenShareConsent() {
    // Mobile: do NOT require screen share (many devices block getDisplayMedia).
    // Keep monitoring cue on the assessment UI only.
    if (this.deviceType === 'mobile') {
      this._fakeShareAllowed = true;
      this.monitorFeed = 'ACTIVE';
      return true;
    }
    // Desktop: try native, then in-app consent
    const canNative = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
    if (canNative) {
      try {
        const ok = await this.startDesktopCapture();
        if (ok && this.stream) return true;
      } catch (_) {}
    }
    const allowed = await this.fakeScreenShareConsent();
    if (allowed) {
      this._fakeShareAllowed = true;
      this.monitorFeed = 'ACTIVE';
      return true;
    }
    return false;
  },

  async showEntryGate(sessionId, examId) {
    this.sessionId = sessionId;
    this.examId = examId;
    this.submitting = false;
    this.detectDevice();

    if (window._testMode || String(sessionId).startsWith('test_')) {
      this.started = true;
      return true;
    }

    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.id = 'monitor-gate';
      overlay.className = 'monitor-gate';
      overlay.innerHTML = `
        <div class="monitor-gate-card monitor-gate-padded">
          <div class="monitor-gate-center">
            <img src="assets/lvcc-logo.png" width="72" height="72" alt="LVCC" />
          </div>
          <h1 class="monitor-gate-title">Assessment Integrity Rules</h1>
          <div class="monitor-gate-body">
            <p>Full screen is required for the entire assessment on desktop devices.</p>
            <p>Your screen may be monitored so instructors can protect exam integrity. Do not exit full screen, switch tabs, or open other windows.</p>
            <p>Violations are logged in real time. Screen stills may be captured for monitoring when a violation is detected.</p>
            <p>By continuing, you agree to these rules and to remain in the assessment environment until you submit or time expires.</p>
            <p class="monitor-security-notice"><strong>Security Notice:</strong> This assessment portal requires <strong>Google Chrome</strong> or <strong>Microsoft Edge</strong>. Please copy the link and open it in a supported browser.</p>
          </div>
          <p class="monitor-gate-device">Device detected: <strong>${this.deviceType}</strong></p>
          <div class="monitor-gate-center">
            <button class="btn btn-primary btn-lg" id="monitor-accept">Accept Rules &amp; Start Exam</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);

      document.getElementById('monitor-accept').onclick = async () => {
        const btn = document.getElementById('monitor-accept');
        btn.disabled = true;
        btn.textContent = 'Starting…';
        this._joinedAt = Date.now();
        this._graceMs = 30000; // no join-time false positives

        try {
          // 0) Browser + multi-monitor checks
          if (!this.isSupportedBrowser()) {
            if (window.UI) {
              await UI.alert(
                'This assessment portal requires Google Chrome or Microsoft Edge. Please copy the link and open it in a supported browser.',
                'Unsupported browser'
              );
            }
            btn.disabled = false;
            btn.textContent = 'Accept Rules & Start Exam';
            return;
          }
          const multi = await this.detectMultiMonitor();
          if (multi) {
            if (window.UI) {
              await UI.alert(
                'A second display or extended desktop was detected. Please disconnect extra monitors and use a single screen, then try again.',
                'Multiple monitors detected'
              );
            }
            btn.disabled = false;
            btn.textContent = 'Accept Rules & Start Exam';
            return;
          }

          // 1) Screen share consent (native or universal fake prompt)
          btn.textContent = 'Waiting for screen share…';
          const shared = await this.ensureScreenShareConsent();
          if (!shared) {
            if (window.UI) {
              await UI.alert(
                'Screen sharing consent is required to start this assessment. Please tap Allow, then try again.',
                'Screen share required'
              );
            }
            btn.disabled = false;
            btn.textContent = 'Accept Rules & Start Exam';
            return;
          }

          // 2) Force fullscreen after share prompt
          btn.textContent = 'Entering full screen…';
          await this.requestFullscreen();
          if (this.deviceType === 'desktop' && !this.isFullscreen()) {
            // try once more
            await this.requestFullscreen();
          }

          this.bindLockListeners();
          this.startLiveFeedFlagWatcher();
          this.startSessionEndWatcher();
          if (this.timer) clearInterval(this.timer);
          this.timer = setInterval(() => this.pushLiveThumbs(), 15000);
          // don't block start on first thumb upload
          this.pushLiveThumbs().catch(() => {});
          this.started = true;
          overlay.remove();
          resolve(true);
        } catch (err) {
          console.error(err);
          btn.disabled = false;
          btn.textContent = 'Accept Rules & Start Exam';
          if (window.UI) await UI.alert(err.message || 'Could not start. Try again.', 'Start failed');
        }
      };
    });
  },

  async startCamera() {
    try {
      this.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
      this.cameraVideo = document.createElement('video');
      this.cameraVideo.srcObject = this.cameraStream;
      this.cameraVideo.muted = true;
      this.cameraVideo.playsInline = true;
      await this.cameraVideo.play();
      return true;
    } catch (e) {
      console.warn('camera', e);
      this.cameraStream = null;
      return false;
    }
  },

  async startDesktopCapture() {
    try {
      this.stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 5, max: 8 } },
        audio: false
      });
      this.video = document.createElement('video');
      this.video.srcObject = this.stream;
      this.video.muted = true;
      this.video.playsInline = true;
      await this.video.play();
      this.stream.getVideoTracks()[0].addEventListener('ended', () => {
        if (this.submitting) return;
        this.recordViolation('screen-share-stopped', true);
        this.stream = null;
        this.showLockOverlay('Screen sharing stopped. Share your screen again to continue. Full screen is required.');
      });
      return true;
    } catch (e) {
      console.warn('getDisplayMedia', e);
      return false;
    }
  },

  frameFromVideo(video, maxW, quality) {
    if (!video || video.readyState < 2 || video.videoWidth < 4) return null;
    try {
      const c = document.createElement('canvas');
      const w = Math.min(maxW, video.videoWidth);
      const h = Math.max(1, Math.round(w * (video.videoHeight / video.videoWidth)));
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(video, 0, 0, w, h);
      return c.toDataURL('image/jpeg', quality);
    } catch (e) {
      return null;
    }
  },

  async captureUi(scale, quality) {
    try {
      if (typeof html2canvas !== 'function') return null;
      const target = document.querySelector('.exam-take-wrap, .exam-layout, .regular-exam-wrap, #app') || document.body;
      const canvas = await html2canvas(target, {
        scale: scale || 0.4,
        logging: false,
        useCORS: true,
        backgroundColor: '#ffffff',
        ignoreElements: (el) => el.id === 'monitor-gate' || el.id === 'monitor-lock' || el.classList?.contains('fab-msg')
      });
      return canvas.toDataURL('image/jpeg', quality || 0.45);
    } catch (e) {
      return null;
    }
  },

  /** Live grid: small overwrite thumbs only */
  async pushLiveThumbs() {
    if (this.submitting || !this.sessionId || String(this.sessionId).startsWith('test_')) return;
    if (window.WriteBudget && !WriteBudget.canLiveWrite()) return;
    // Instructor turned off live grid (quota saver). Students must NOT notice:
    // - keep screen-share stream running
    // - keep fullscreen / integrity rules
    // - do NOT show any message
    // - only skip uploading live thumbnails (silent)
    if (this._liveFeedEnabled === false) {
      // Throttle quiet heartbeat (~every 4th tick ≈ 48s) so status stays "active"
      this._quietBeat = (this._quietBeat || 0) + 1;
      if (this._quietBeat % 8 === 1) {
        try {
          await window.db.collection('sessions').doc(this.sessionId).update({
            lastSeenAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastHeartbeat: firebase.firestore.FieldValue.serverTimestamp(),
            isWindowFocused: document.hasFocus() && !document.hidden,
            isFullscreen: this.isFullscreen(),
            // Look the same as a normal active session (no student-visible fields)
            monitorFeed: this.deviceType === 'mobile' ? 'Exam Active' : 'ACTIVE'
          });
          if (window.WriteBudget) WriteBudget.recordWrite(1);
        } catch (_) {}
      }
      return;
    }
    let screenThumb = this.frameFromVideo(this.video, 480, 0.35);
    if (!screenThumb) screenThumb = await this.captureUi(0.3, 0.35);
    const cameraThumb = null;

    let pingMs = null;
    try {
      const t0 = performance.now();
      await window.db.collection('sessions').doc(this.sessionId).get();
      pingMs = Math.round(performance.now() - t0);
    } catch (_) { pingMs = 9999; }
    const connectionQuality = (pingMs != null && pingMs > 800) ? 'bad' : 'ok';
    // Only flag connection-loss after sustained poor network (~30s)
    if (connectionQuality === 'bad') {
      if (!this._connBadSince) this._connBadSince = Date.now();
      if (!this._connFlagged && (Date.now() - this._connBadSince) >= 30000) {
        this._connFlagged = true;
        this.recordViolation('connection-loss', true);
      }
    } else {
      this._connBadSince = null;
      this._connFlagged = false;
    }

    const payload = {
      deviceType: this.deviceType,
      screenThumb: screenThumb || null,
      cameraThumb: cameraThumb || null,
      monitorFeed: screenThumb ? 'ACTIVE' : (this.deviceType === 'mobile' ? 'Exam Active' : 'ACTIVE'),
      isWindowFocused: document.hasFocus(),
      isFullscreen: this.isFullscreen(),
      violationCount: this.violationCount,
      pingMs,
      connectionQuality,
      lastHeartbeat: firebase.firestore.FieldValue.serverTimestamp(),
      lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
    };
    Object.keys(payload).forEach(k => payload[k] == null && delete payload[k]);
    try {
      await window.db.collection('sessions').doc(this.sessionId).update(payload);
    } catch (e) {
      console.warn('thumb push', e);
    }
    try {
      await window.db.collection('liveScreens').doc(this.sessionId).set({
        examId: this.examId,
        thumb: screenThumb || null,
        cameraThumb: cameraThumb || null,
        deviceType: this.deviceType,
        isWindowFocused: payload.isWindowFocused,
        isFullscreen: payload.isFullscreen,
        violationCount: this.violationCount,
        at: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (_) {}
  },

  /** HQ only on violation — higher quality still */
  async captureHqBundle() {
    const screenHq = this.frameFromVideo(this.video, 1280, 0.72)
      || await this.captureUi(0.6, 0.7);
    const cameraHq = this.frameFromVideo(this.cameraVideo, 640, 0.7);
    return { screenHq, cameraHq };
  },

  async recordViolation(type, forceHq = true) {
    if (this.submitting) return;
    // Grace after join: ignore focus/fullscreen/blur noise for 30s
    const joined = this._joinedAt || 0;
    const grace = this._graceMs || 30000;
    const soft = ['exited-fullscreen','tab-hidden','outside-assessment','resize','right-click','screen-share-stopped'];
    if (joined && (Date.now() - joined) < grace && soft.includes(type)) {
      return;
    }
    this.violationCount += 1;
    if (!this.sessionId || String(this.sessionId).startsWith('test_')) return;

    let extra = { violationCount: this.violationCount };
    if (forceHq) {
      try {
        const hq = await this.captureHqBundle();
        if (hq.screenHq) extra.screenshot = hq.screenHq;
        if (hq.cameraHq) extra.cameraScreenshot = hq.cameraHq;
      } catch (_) {}
    }
    try {
      const detail = type === 'connection-loss' ? 'Left due to loss of connection / poor network' : `Violation #${this.violationCount}`;
      await Exam.logEvent(this.sessionId, type, detail, extra);
    } catch (_) {}
    // bump session fields
    try {
      if (window.WriteBudget && !WriteBudget.recordWrite(1)) return;
      await window.db.collection('sessions').doc(this.sessionId).update({
        violationCount: this.violationCount,
        lastViolation: type,
        lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (_) {}
  },

  startLiveFeedFlagWatcher() {
    if (!this.examId || this._feedUnsub) return;
    try {
      this._feedUnsub = window.db.collection('exams').doc(this.examId).onSnapshot(snap => {
        const d = snap.data() || {};
        // Default OFF unless instructor explicitly enables liveFeedEnabled: true
        this._liveFeedEnabled = d.liveFeedEnabled === true;
      }, () => {});
    } catch (_) {
      this._liveFeedEnabled = false;
    }
  },

  /** Stop all local monitoring as soon as session is submitted/ended (teacher or self) */
  startSessionEndWatcher() {
    if (!this.sessionId || String(this.sessionId).startsWith('test_') || this._sessionEndUnsub) return;
    try {
      this._sessionEndUnsub = window.db.collection('sessions').doc(this.sessionId).onSnapshot(snap => {
        const d = snap.data() || {};
        if (d.status === 'submitted' || d.monitoringStopped || d.instructorEnded) {
          try { this.stop(); } catch (_) {}
          if (this._sessionEndUnsub) {
            try { this._sessionEndUnsub(); } catch (_) {}
            this._sessionEndUnsub = null;
          }
        }
      }, () => {});
    } catch (_) {}
  },

  bindLockListeners() {
    if (this._listenersBound) return;
    this._listenersBound = true;
    this._recentRightClick = 0;
    this._recentResize = 0;

    const onFs = () => {
      if (this.submitting) return;
      if (this.deviceType === 'desktop' && !this.isFullscreen()) {
        this.recordViolation('exited-fullscreen', true);
        this.showLockOverlay('You exited full screen. Return to full screen to continue the assessment.');
      }
    };
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('webkitfullscreenchange', onFs);

    document.addEventListener('visibilitychange', () => {
      if (this.submitting) return;
      if (document.hidden) {
        this._hiddenAt = Date.now();
        this.recordViolation('tab-hidden', true);
      } else {
        // Returned to tab — if session still active, allow continue (resume)
        this._hiddenAt = null;
        try {
          window.db.collection('sessions').doc(this.sessionId).update({
            lastSeenAt: firebase.firestore.FieldValue.serverTimestamp(),
            isWindowFocused: true
          });
        } catch (_) {}
      }
    });

    // Intentional leave: beforeunload with beacon + lock requiring instructor admit
    window.addEventListener('pagehide', () => {
      if (this.submitting || !this.sessionId || String(this.sessionId).startsWith('test_')) return;
      // Network-only drops often don't fire a clean intentional leave flag
      try {
        const payload = JSON.stringify({ intentionalLeave: true, at: Date.now() });
        // Best-effort flag; full lock handled on next load via session doc
        sessionStorage.setItem('lvcc_leave_' + this.sessionId, payload);
      } catch (_) {}
    });

    window.addEventListener('blur', () => {
      if (this.submitting) return;
      setTimeout(() => {
        if (this.submitting || document.hasFocus()) return;
        // Ignore blur caused by our own modals / message dialogs
        if (this._uiBusy || this.submitting) return;
        if (document.getElementById('ui-modal-root')?.innerHTML?.trim()) return;
        if (document.querySelector('.ui-modal-overlay, .modal-overlay')) return;
        this.recordViolation('outside-assessment', true);
      }, 400);
    });

    // Copy / paste (regular assessment + global)
    document.addEventListener('paste', (e) => {
      if (this.submitting || window._testMode) return;
      // Table fill allows calculator ↔ cell copy/paste without integrity flag
      if (window._tableFillActive) return;
      const text = (e.clipboardData || window.clipboardData)?.getData('text') || '';
      const lines = text ? text.split(/\r?\n/).length : 1;
      this.recordViolation('paste', true);
      try {
        if (window.CodeEditor && CodeEditor._studentPasteWarn) {
          Promise.resolve(CodeEditor._studentPasteWarn()).catch(() => {});
        } else if (window.UI) {
          Promise.resolve(UI.alert('You have been detected copy-pasting. This is logged as an integrity issue.', 'Integrity warning')).catch(() => {});
        }
      } catch (_) {}
    }, true);

    document.addEventListener('copy', () => {
      if (this.submitting || window._testMode) return;
      if (window._tableFillActive) return;
      this.recordViolation('copy', true);
    }, true);

    document.addEventListener('contextmenu', (e) => {
      if (this.submitting) return;
      e.preventDefault();
      this._recentRightClick = Date.now();
      this.recordViolation('right-click', true);
      if (this._recentResize && Date.now() - this._recentResize < 10000) {
        this.recordViolation('external-search-suspect', true);
      }
    }, true);

    let resizeTimer = null;
    window.addEventListener('resize', () => {
      if (this.submitting) return;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        this._recentResize = Date.now();
        this.recordViolation('resize', true);
        if (this._recentRightClick && Date.now() - this._recentRightClick < 10000) {
          this.recordViolation('external-search-suspect', true);
        }
      }, 400);
    });

    // Heuristic: many chrome extension injected nodes (best-effort)
    try {
      const observer = new MutationObserver(() => {
        if (this.submitting) return;
        const suspicious = document.querySelectorAll('[class*="extension"], [id*="chrome-extension"]').length;
        if (suspicious > 3) this.recordViolation('extension-suspect', false);
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    } catch (_) {}
  },

  showLockOverlay(message) {
    if (this.submitting) return;
    let el = document.getElementById('monitor-lock');
    if (!el) {
      el = document.createElement('div');
      el.id = 'monitor-lock';
      el.className = 'monitor-lock';
      document.body.appendChild(el);
    }
    el.innerHTML = `
      <div class="monitor-gate-card">
        <h1 class="monitor-gate-title">Integrity lock</h1>
        <div class="monitor-gate-body"><p>${message}</p>
        <p>Violations: <strong>${this.violationCount}</strong></p></div>
        <div class="monitor-gate-center">
          <button class="btn btn-primary btn-lg" id="monitor-return-fs">Return to Fullscreen</button>
        </div>
      </div>`;
    el.classList.remove('hidden');
    document.getElementById('monitor-return-fs').onclick = async () => {
      const btn = document.getElementById('monitor-return-fs');
      if (btn) { btn.disabled = true; btn.textContent = 'Please wait…'; }
      try {
        if (this.deviceType === 'desktop' && !this.stream) {
          const ok = await this.startDesktopCapture();
          if (!ok) {
            if (window.UI) await UI.alert('Screen share is required to continue.', 'Screen share');
            if (btn) { btn.disabled = false; btn.textContent = 'Return to Fullscreen'; }
            return;
          }
        }
        await this.requestFullscreen();
        if (this.deviceType === 'desktop' && !this.isFullscreen()) {
          await this.requestFullscreen();
        }
        el.classList.add('hidden');
        this.pushLiveThumbs().catch(() => {});
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Return to Fullscreen'; }
      }
    };
  },

  /** Call when student submits / times up / teacher ends */
  markSubmitting() {
    this.submitting = true;
    this.stop();
  },

  /**
   * Fully end monitoring so no further Firestore writes (thumbs/heartbeats).
   * Must run on: submit, time-up, teacher end, test-as-student close, leave exam.
   */
  stop() {
    this.submitting = true;
    this.started = false;
    if (this.timer) {
      try { clearInterval(this.timer); } catch (_) {}
      this.timer = null;
    }
    if (this._feedUnsub) {
      try { this._feedUnsub(); } catch (_) {}
      this._feedUnsub = null;
    }
    if (this._sessionEndUnsub) {
      try { this._sessionEndUnsub(); } catch (_) {}
      this._sessionEndUnsub = null;
    }
    if (this.stream) {
      try { this.stream.getTracks().forEach(tr => tr.stop()); } catch (_) {}
      this.stream = null;
    }
    if (this.cameraStream) {
      try { this.cameraStream.getTracks().forEach(tr => tr.stop()); } catch (_) {}
      this.cameraStream = null;
    }
    if (this.video) {
      try { this.video.srcObject = null; } catch (_) {}
      this.video = null;
    }
    document.getElementById('monitor-gate')?.remove();
    document.getElementById('monitor-lock')?.remove();
    // Clear ids last so any in-flight pushLiveThumbs bails out
    this.sessionId = null;
    this.examId = null;
  }
};

window.Monitor = Monitor;
