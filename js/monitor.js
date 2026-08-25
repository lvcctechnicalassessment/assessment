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
        <div class="monitor-gate-card">
          <div class="monitor-gate-center">
            <img src="assets/lvcc-logo.png" width="72" height="72" alt="LVCC" />
          </div>
          <h1 class="monitor-gate-title">Assessment integrity rules</h1>
          <div class="monitor-gate-body">
            <p>Full screen is required for the entire assessment on desktop devices.</p>
            <p>Your screen may be monitored so instructors can protect exam integrity. Do not exit full screen, switch tabs, or open other windows.</p>
            <p>Violations are logged in real time. Screen stills may be captured for monitoring when a violation is detected.</p>
            <p>By continuing, you agree to these rules and to remain in the assessment environment until you submit or time expires.</p>
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
          // 1) Prompt screen share immediately (desktop)
          if (this.deviceType === 'desktop') {
            btn.textContent = 'Waiting for screen share…';
            const shared = await Promise.race([
              this.startDesktopCapture(),
              new Promise(r => setTimeout(() => r(false), 60000))
            ]);
            if (!shared && !this.stream) {
              // still continue with UI snapshot fallback after confirm
              if (window.UI) {
                const cont = await UI.confirm('Screen share was not started. Continue with limited monitoring?', 'Screen share');
                if (!cont) {
                  btn.disabled = false;
                  btn.textContent = 'Accept Rules & Start Exam';
                  return;
                }
              }
            }
          }

          // 2) Force fullscreen after share prompt
          btn.textContent = 'Entering full screen…';
          await this.requestFullscreen();
          if (this.deviceType === 'desktop' && !this.isFullscreen()) {
            // try once more
            await this.requestFullscreen();
          }

          this.bindLockListeners();
          if (this.timer) clearInterval(this.timer);
          this.timer = setInterval(() => this.pushLiveThumbs(), 12000);
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
    const soft = ['exited-fullscreen','tab-hidden','window-blur','resize','right-click','screen-share-stopped'];
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
      await window.db.collection('sessions').doc(this.sessionId).update({
        violationCount: this.violationCount,
        lastViolation: type,
        lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
      });
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
        this.recordViolation('tab-hidden', true);
      }
    });

    window.addEventListener('blur', () => {
      if (this.submitting) return;
      setTimeout(() => {
        if (this.submitting || document.hasFocus()) return;
        this.recordViolation('window-blur', true);
      }, 400);
    });

    // Copy / paste (regular assessment + global)
    document.addEventListener('paste', (e) => {
      if (this.submitting || window._testMode) return;
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

  stop() {
    this.submitting = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.stream) {
      try { this.stream.getTracks().forEach(tr => tr.stop()); } catch (_) {}
      this.stream = null;
    }
    if (this.cameraStream) {
      try { this.cameraStream.getTracks().forEach(tr => tr.stop()); } catch (_) {}
      this.cameraStream = null;
    }
    document.getElementById('monitor-gate')?.remove();
    document.getElementById('monitor-lock')?.remove();
  }
};

window.Monitor = Monitor;
