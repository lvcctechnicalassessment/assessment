/**
 * Assessment integrity monitor — desktop screen capture + mobile heartbeat
 */
const Monitor = {
  sessionId: null,
  examId: null,
  deviceType: 'desktop',
  stream: null,
  video: null,
  timer: null,
  heartbeatTimer: null,
  started: false,
  violationCount: 0,

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

  /**
   * Gate: student must accept rules before exam content.
   * Returns true if started successfully.
   */
  async showEntryGate(sessionId, examId) {
    this.sessionId = sessionId;
    this.examId = examId;
    this.detectDevice();

    // Test mode: skip gate
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
          <img src="assets/lvcc-logo.png" width="64" height="64" alt="" />
          <h1>Assessment integrity rules</h1>
          <ul>
            <li>Full screen is required for the entire assessment.</li>
            <li>${this.deviceType === 'desktop'
              ? 'You must share your screen so your instructor can monitor integrity.'
              : 'Stay in this app. Switching apps or tabs is tracked as a violation.'}</li>
            <li>Do not exit full screen, switch tabs, or open other windows.</li>
            <li>Violations are logged and visible to your instructor in real time.</li>
          </ul>
          <p class="text-muted">Device detected: <strong>${this.deviceType}</strong></p>
          <button class="btn btn-primary btn-lg" id="monitor-accept">Accept Rules & Start Exam</button>
        </div>`;
      document.body.appendChild(overlay);

      document.getElementById('monitor-accept').onclick = async () => {
        const btn = document.getElementById('monitor-accept');
        btn.disabled = true;
        btn.textContent = 'Starting…';
        await this.requestFullscreen();
        if (this.deviceType === 'desktop') {
          const ok = await this.startDesktopCapture();
          if (!ok) {
            btn.disabled = false;
            btn.textContent = 'Accept Rules & Start Exam';
            if (window.UI) await UI.alert('Screen share is required on desktop. Please allow sharing your screen (or this tab) and try again.', 'Permission required');
            return;
          }
        } else {
          await this.startMobileHeartbeat();
        }
        this.bindLockListeners();
        this.started = true;
        overlay.remove();
        resolve(true);
      };
    });
  },

  async startDesktopCapture() {
    try {
      this.stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 360 },
          frameRate: { ideal: 5, max: 8 }
        },
        audio: false
      });
      this.video = document.createElement('video');
      this.video.srcObject = this.stream;
      this.video.muted = true;
      this.video.playsInline = true;
      await this.video.play();
      this.stream.getVideoTracks()[0].addEventListener('ended', () => {
        this.recordViolation('screen-share-stopped');
        this.showLockOverlay('Screen sharing stopped. Share your screen again to continue.');
        this.stream = null;
      });
      this.timer = setInterval(() => this.pushDesktopFrame(), 10000);
      await this.pushDesktopFrame();
      return true;
    } catch (e) {
      console.warn('getDisplayMedia', e);
      // Fallback: UI snapshot only
      this.timer = setInterval(() => this.pushUiSnapshot(), 10000);
      await this.pushUiSnapshot();
      return true; // allow continue with UI capture
    }
  },

  async pushDesktopFrame() {
    if (!this.sessionId) return;
    let thumb = null;
    if (this.video && this.video.readyState >= 2 && this.video.videoWidth > 4) {
      try {
        const c = document.createElement('canvas');
        c.width = 640;
        c.height = Math.max(1, Math.round(640 * (this.video.videoHeight / this.video.videoWidth)));
        c.getContext('2d').drawImage(this.video, 0, 0, c.width, c.height);
        thumb = c.toDataURL('image/jpeg', 0.32);
      } catch (e) { console.warn(e); }
    }
    if (!thumb) thumb = await this.captureUi();
    await this.writeMonitor({
      deviceType: 'desktop',
      monitorFeed: thumb || 'ACTIVE',
      isWindowFocused: document.hasFocus(),
      isFullscreen: this.isFullscreen(),
      violationCount: this.violationCount
    });
  },

  async pushUiSnapshot() {
    const thumb = await this.captureUi();
    await this.writeMonitor({
      deviceType: this.deviceType,
      monitorFeed: thumb || 'ACTIVE',
      isWindowFocused: document.hasFocus(),
      isFullscreen: this.isFullscreen(),
      violationCount: this.violationCount
    });
  },

  async captureUi() {
    try {
      if (typeof html2canvas !== 'function') return null;
      const target = document.querySelector('.exam-layout, .regular-exam-wrap, #app') || document.body;
      const canvas = await html2canvas(target, {
        scale: 0.35,
        logging: false,
        useCORS: true,
        backgroundColor: '#ffffff',
        ignoreElements: (el) => el.id === 'monitor-gate' || el.id === 'monitor-lock' || el.classList?.contains('fab-msg')
      });
      return canvas.toDataURL('image/jpeg', 0.32);
    } catch (e) {
      console.warn('captureUi', e);
      return null;
    }
  },

  async startMobileHeartbeat() {
    this.heartbeatTimer = setInterval(() => this.pushMobileHeartbeat(), 10000);
    await this.pushMobileHeartbeat();
  },

  async pushMobileHeartbeat() {
    await this.writeMonitor({
      deviceType: 'mobile',
      monitorFeed: document.hasFocus() && this.isFullscreen() ? 'Exam Active' : 'LEFT EXAM APP',
      isWindowFocused: document.hasFocus(),
      isFullscreen: this.isFullscreen(),
      violationCount: this.violationCount
    });
  },

  async writeMonitor(fields) {
    if (!this.sessionId || String(this.sessionId).startsWith('test_')) return;
    const payload = {
      ...fields,
      name: (window.Auth && Auth.userProfile && (Auth.userProfile.name || Auth.userProfile.email)) || '',
      lastHeartbeat: firebase.firestore.FieldValue.serverTimestamp(),
      screenThumb: typeof fields.monitorFeed === 'string' && fields.monitorFeed.startsWith('data:')
        ? fields.monitorFeed
        : undefined,
      lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
    };
    // remove undefined
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
    try {
      await window.db.collection('sessions').doc(this.sessionId).update(payload);
    } catch (e) {
      console.warn('monitor write session', e);
    }
    try {
      await window.db.collection('liveScreens').doc(this.sessionId).set({
        examId: this.examId,
        thumb: payload.screenThumb || null,
        monitorFeed: fields.monitorFeed && !String(fields.monitorFeed).startsWith('data:') ? fields.monitorFeed : null,
        deviceType: fields.deviceType,
        isWindowFocused: fields.isWindowFocused,
        isFullscreen: fields.isFullscreen,
        violationCount: fields.violationCount,
        at: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.warn('monitor write liveScreens', e);
    }
  },

  bindLockListeners() {
    const onFs = () => {
      if (!this.isFullscreen()) {
        this.recordViolation('exited-fullscreen');
        this.showLockOverlay('You exited full screen. Return to full screen to continue.');
      }
    };
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('webkitfullscreenchange', onFs);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.recordViolation('tab-hidden');
        this.writeMonitor({
          deviceType: this.deviceType,
          monitorFeed: this.deviceType === 'mobile' ? 'LEFT EXAM APP' : 'TAB HIDDEN',
          isWindowFocused: false,
          isFullscreen: this.isFullscreen(),
          violationCount: this.violationCount
        });
      }
    });

    window.addEventListener('blur', () => {
      this.recordViolation('window-blur');
      this.writeMonitor({
        deviceType: this.deviceType,
        monitorFeed: this.deviceType === 'mobile' ? 'LEFT EXAM APP' : 'WINDOW BLUR',
        isWindowFocused: false,
        isFullscreen: this.isFullscreen(),
        violationCount: this.violationCount
      });
    });
  },

  recordViolation(type) {
    this.violationCount += 1;
    if (this.sessionId && !String(this.sessionId).startsWith('test_')) {
      Exam.logEvent(this.sessionId, type, `Violation #${this.violationCount}`, {
        violationCount: this.violationCount
      }).catch(() => {});
    }
  },

  showLockOverlay(message) {
    let el = document.getElementById('monitor-lock');
    if (!el) {
      el = document.createElement('div');
      el.id = 'monitor-lock';
      el.className = 'monitor-lock';
      document.body.appendChild(el);
    }
    el.innerHTML = `
      <div class="monitor-gate-card">
        <h1>⚠️ Integrity lock</h1>
        <p>${message}</p>
        <p>Violations: <strong>${this.violationCount}</strong></p>
        <button class="btn btn-primary" id="monitor-return-fs">Return to Fullscreen</button>
      </div>`;
    el.classList.remove('hidden');
    document.getElementById('monitor-return-fs').onclick = async () => {
      await this.requestFullscreen();
      if (this.deviceType === 'desktop' && !this.stream) {
        const ok = await this.startDesktopCapture();
        if (!ok) return;
      }
      el.classList.add('hidden');
      this.writeMonitor({
        deviceType: this.deviceType,
        monitorFeed: this.deviceType === 'mobile' ? 'Exam Active' : 'ACTIVE',
        isWindowFocused: true,
        isFullscreen: true,
        violationCount: this.violationCount
      });
    };
  },

  stop() {
    if (this.timer) clearInterval(this.timer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.timer = this.heartbeatTimer = null;
    if (this.stream) {
      this.stream.getTracks().forEach(tr => tr.stop());
      this.stream = null;
    }
    document.getElementById('monitor-gate')?.remove();
    document.getElementById('monitor-lock')?.remove();
  }
};

window.Monitor = Monitor;
