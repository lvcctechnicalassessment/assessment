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
  apply(theme, persist = true) {
    let t = theme;
    if (t !== 'light' && t !== 'dark' && t !== 'retro') t = 'light';
    document.documentElement.setAttribute('data-theme', t);
    document.body && document.body.setAttribute('data-theme', t);
    if (persist && t !== 'retro') {
      localStorage.setItem(this.KEY, t);
      this.saveToProfile(t);
    }
    if (t === 'retro') {
      try { sessionStorage.setItem(this.EXAM_KEY, 'retro'); } catch (_) {}
    }
    this.syncButtons();
  },
  /** Permanent preference only (light/dark) */
  applyPreferred() {
    const saved = localStorage.getItem(this.KEY) || this.DEFAULT;
    this.apply(saved === 'retro' ? 'light' : saved, false);
  },
  toggle() {
    const c = this.current();
    if (c === 'retro') this.apply('dark', true);
    else this.apply(c === 'dark' ? 'light' : 'dark', true);
  },
  cycleExamTheme() {
    // During exam: light → dark → retro → light
    const order = ['light', 'dark', 'retro'];
    const c = this.current();
    const i = order.indexOf(c);
    const next = order[(i + 1) % order.length];
    this.apply(next, next !== 'retro');
  },
  async saveToProfile(theme) {
    try {
      if (!window.auth?.currentUser || !window.db) return;
      const t = theme === 'retro' ? 'dark' : theme;
      await window.db.collection('users').doc(window.auth.currentUser.uid).set(
        { theme: t, updatedAt: firebase.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );
    } catch (e) { console.warn('theme save', e); }
  },
  async loadFromProfile() {
    try {
      if (!window.auth?.currentUser || !window.db) return;
      const snap = await window.db.collection('users').doc(window.auth.currentUser.uid).get();
      if (snap.exists && snap.data().theme) this.apply(snap.data().theme, true);
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
    const on = this.current() === 'dark';
    return `<div class="theme-switch-row">
      <span>Theme</span>
      <button type="button" class="theme-switch ${on ? 'on' : ''}" data-theme-switch role="switch"
        aria-checked="${on}" onclick="Theme.toggle()">
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
    overlay.innerHTML = `<div class="popover-card settings-card">
      <h3>Settings</h3>
      ${this.settingsSwitchHtml()}
      <button type="button" class="btn btn-ghost btn-block mt-1" id="settings-about-btn">About</button>
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
    const ver = (document.querySelector('.app-version')?.textContent || 'v1.5.37').replace('Build ', '');
    const overlay = document.createElement('div');
    overlay.id = 'about-popover';
    overlay.className = 'popover-overlay';
    overlay.innerHTML = `<div class="popover-card about-card" style="max-width:420px;text-align:center">
      <img src="assets/lvcc-logo.png" alt="LVCC" width="72" height="72" style="margin:0.5rem auto;display:block" />
      <h3 style="margin:0.35rem 0">LVCC Assessment Portal</h3>
      <p class="text-muted" style="margin:0.25rem 0">Integrity - We live with honesty, truthfulness, and moral courage.</p>
      <p style="font-size:0.85rem;margin:0.5rem 0"><strong>${ver}</strong></p>
      <p style="text-align:left;font-size:0.9rem;line-height:1.5;margin:0.75rem 0">
        This app was created for La Verdad Christian College students and instructors to have their own secure assessment platform —
        supporting both coding and regular assessments, integrity monitoring, and fair evaluation.
      </p>
      <p style="text-align:left;font-size:0.9rem;line-height:1.5;margin:0.5rem 0">
        <strong>Developer:</strong> Ms. Joane Pauline S. Maunes
      </p>
      <button type="button" class="btn btn-primary" id="about-close">Close</button>
    </div>`;
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    document.body.appendChild(overlay);
    document.getElementById('about-close')?.addEventListener('click', () => overlay.remove());
  }
};
window.Theme = Theme;
try {
  const t = localStorage.getItem('lvcc_theme') || 'light';
  document.documentElement.setAttribute('data-theme', t === 'retro' ? 'light' : t);
} catch (_) {}
