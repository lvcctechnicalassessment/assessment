/**
 * Light / Dark / Retro theme
 * Retro is exam-session only (not persisted as permanent preference for whole app)
 */
const Theme = {
  KEY: 'lvcc_theme',
  DEFAULT: 'light',
  EXAM_KEY: 'lvcc_exam_theme',
  init() {
    const saved = localStorage.getItem(this.KEY) || this.DEFAULT;
    this.apply(saved, false);
  },
  current() {
    return document.documentElement.getAttribute('data-theme') || this.DEFAULT;
  },
  isRetro() {
    return document.documentElement.getAttribute('data-theme') === 'retro';
  },
  _isStudent() {
    try {
      const role = window.Auth?.userProfile?.role || window.Auth?.currentUser?.role;
      return role === 'student';
    } catch (_) { return false; }
  },
  apply(theme, persist = true) {
    let t = theme;
    if (t !== 'light' && t !== 'dark' && t !== 'retro') t = 'light';
    // Retro is a full theme for students; instructors/admin stay light/dark
    if (t === 'retro' && !this._isStudent()) t = 'dark';
    document.documentElement.setAttribute('data-theme', t);
    document.body && document.body.setAttribute('data-theme', t);
    if (persist) {
      localStorage.setItem(this.KEY, t);
      this.saveToProfile(t);
    }
    this.syncButtons();
  },
  applyPreferred() {
    const saved = localStorage.getItem(this.KEY) || this.DEFAULT;
    this.apply(saved, false);
  },
  toggle() {
    if (this._isStudent()) {
      // Student: light → dark → retro → light
      const order = ['light', 'dark', 'retro'];
      const c = this.current();
      const i = order.indexOf(c);
      this.apply(order[(i + 1) % order.length], true);
    } else {
      const c = this.current();
      this.apply(c === 'dark' ? 'light' : 'dark', true);
    }
  },
  cycleExamTheme() {
    // Same as toggle for students during exam
    this.toggle();
  },
  async saveToProfile(theme) {
    try {
      if (!window.auth?.currentUser || !window.db) return;
      await window.db.collection('users').doc(window.auth.currentUser.uid).set(
        { theme: theme, updatedAt: firebase.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );
    } catch (e) { console.warn('theme save', e); }
  },
  async loadFromProfile() {
    try {
      if (!window.auth?.currentUser || !window.db) return;
      const snap = await window.db.collection('users').doc(window.auth.currentUser.uid).get();
      if (snap.exists && snap.data().theme) {
        this.apply(snap.data().theme, true);
      } else if (this._isStudent()) {
        // First login for students defaults to Light
        this.apply('light', true);
      }
    } catch (e) { console.warn('theme load', e); }
  },
  icon() {
    const c = this.current();
    if (c === 'retro') return '👾';
    return c === 'dark' ? '☀️' : '🌙';
  },
  label() {
    const c = this.current();
    if (c === 'retro') return 'Retro';
    return c === 'dark' ? 'Dark' : 'Light';
  },
  syncButtons() {
    document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
      btn.textContent = this.icon();
      btn.title = 'Theme: ' + this.label();
    });
    document.querySelectorAll('[data-theme-switch]').forEach(sw => {
      const c = this.current();
      sw.classList.toggle('on', c === 'dark' || c === 'retro');
      sw.setAttribute('aria-checked', c !== 'light' ? 'true' : 'false');
      const lab = sw.querySelector('.theme-switch-label');
      if (lab) lab.textContent = this.label();
      const knob = sw.querySelector('.theme-switch-knob');
      if (knob) knob.textContent = this.icon();
    });
    document.querySelectorAll('[data-theme-label]').forEach(el => {
      el.textContent = this.label();
    });
  },
  buttonHtml() {
    return `<button type="button" class="theme-toggle-icon" data-theme-toggle onclick="Theme.toggle()" aria-label="Switch theme">${this.icon()}</button>`;
  },
  examButtonHtml() {
    return `<button type="button" class="theme-toggle-icon theme-exam-btn" data-theme-toggle onclick="Theme.cycleExamTheme()" aria-label="Switch exam theme" title="Theme">${this.icon()}</button>`;
  },
  settingsSwitchHtml() {
    const c = this.current();
    const student = this._isStudent();
    if (student) {
      return `<div class="theme-switch-row" style="flex-direction:column;align-items:center;gap:0.75rem;padding-top:0.5rem">
        <span style="align-self:flex-start">Theme</span>
        <div class="theme-tri-switch">
          <button type="button" class="theme-tri-btn ${c==='light'?'active':''}" onclick="Theme.apply('light',true);Theme.openSettings()" title="Light">☀️</button>
          <button type="button" class="theme-tri-btn ${c==='dark'?'active':''}" onclick="Theme.apply('dark',true);Theme.openSettings()" title="Dark">🌙</button>
          <button type="button" class="theme-tri-btn ${c==='retro'?'active':''}" onclick="Theme.apply('retro',true);Theme.openSettings()" title="Retro">👾</button>
        </div>
      </div>`;
    }
    // Instructor / admin: classic light-dark switch
    const on = c === 'dark';
    return `<div class="theme-switch-row">
      <span>Theme</span>
      <button type="button" class="theme-switch ${on ? 'on' : ''}" data-theme-switch role="switch"
        aria-checked="${on}" onclick="Theme.toggle();setTimeout(()=>Theme.openSettings(),50)">
        <span class="theme-switch-track">
          <span class="theme-switch-knob">${on ? '🌙' : '☀️'}</span>
        </span>
        <span class="theme-switch-label">${on ? 'Dark' : 'Light'}</span>
      </button>
    </div>`;
  },
  openSettings() {
    document.getElementById('settings-popover')?.remove();
    document.getElementById('user-popover')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'settings-popover';
    overlay.className = 'popover-overlay';
    overlay.innerHTML = `<div class="popover-card settings-card" style="display:flex;flex-direction:column;min-height:220px">
      <h3 style="margin-top:0">Settings</h3>
      ${this.settingsSwitchHtml()}
      <div style="flex:1"></div>
      <button type="button" class="btn btn-ghost btn-block" id="settings-about-btn" style="margin-top:1.5rem;text-align:center;display:block;width:100%">About</button>
    </div>`;
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    document.body.appendChild(overlay);
    document.getElementById('settings-about-btn')?.addEventListener('click', () => {
      overlay.remove();
      this.openAbout();
    });
    this.syncButtons();
  },
  openAbout() {
    document.getElementById('about-popover')?.remove();
    const ver = (document.querySelector('.app-version')?.textContent || 'v1.5.39').replace('Build ', '');
    const overlay = document.createElement('div');
    overlay.id = 'about-popover';
    overlay.className = 'popover-overlay';
    overlay.innerHTML = `<div class="popover-card about-card about-themed" style="max-width:420px;text-align:center;padding:1.5rem 1.25rem 1.25rem">
      <img src="assets/lvcc-logo.png" alt="LVCC" width="72" height="72" style="margin:0.25rem auto 0.75rem;display:block" />
      <h3 style="margin:0.35rem 0;text-align:center">LVCC Assessment Portal</h3>
      <p class="text-muted" style="margin:0.35rem 0;text-align:center">We live with honesty, truthfulness, and moral courage.</p>
      <p style="font-size:0.85rem;margin:0.75rem 0;text-align:center"><strong>${ver}</strong></p>
      <p style="text-align:center;font-size:0.9rem;line-height:1.55;margin:0.85rem 0">
        This app was created for La Verdad Christian College students and instructors to have their own secure assessment platform —
        supporting both coding and regular assessments, integrity monitoring, and fair evaluation.
      </p>
      <p style="text-align:center;font-size:0.9rem;line-height:1.55;margin:1rem 0 0.5rem">
        If you encounter any issues, contact Ma'am Pau at
      </p>
      <p class="about-email" style="text-align:center;font-family:Consolas,'Courier New',monospace;color:#ea580c;font-size:0.95rem;margin:0.25rem 0 1rem">
        joanepaulinemaunes@laverdad.edu.ph
      </p>
    </div>`;
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    document.body.appendChild(overlay);
  }
};
window.Theme = Theme;
try {
  const t = localStorage.getItem('lvcc_theme') || 'light';
  document.documentElement.setAttribute('data-theme', t === 'retro' ? 'light' : t);
} catch (_) {}
