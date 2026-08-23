/**
 * Light / Dark theme — permanent preference
 */
const Theme = {
  KEY: 'lvcc_theme',
  DEFAULT: 'light',
  init() {
    const saved = localStorage.getItem(this.KEY) || this.DEFAULT;
    this.apply(saved, false);
  },
  current() {
    return document.documentElement.getAttribute('data-theme') || this.DEFAULT;
  },
  apply(theme, persist = true) {
    const t = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', t);
    document.body && document.body.setAttribute('data-theme', t);
    if (persist) {
      localStorage.setItem(this.KEY, t);
      this.saveToProfile(t);
    }
    this.syncButtons();
  },
  toggle() {
    this.apply(this.current() === 'dark' ? 'light' : 'dark', true);
  },
  async saveToProfile(theme) {
    try {
      if (!window.auth?.currentUser || !window.db) return;
      await window.db.collection('users').doc(window.auth.currentUser.uid).set(
        { theme, updatedAt: firebase.firestore.FieldValue.serverTimestamp() },
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
  icon() { return this.current() === 'dark' ? '☀️' : '🌙'; },
  syncButtons() {
    document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
      btn.textContent = this.icon();
    });
    document.querySelectorAll('[data-theme-switch]').forEach(sw => {
      sw.classList.toggle('on', this.current() === 'dark');
      sw.setAttribute('aria-checked', this.current() === 'dark' ? 'true' : 'false');
      const lab = sw.querySelector('.theme-switch-label');
      if (lab) lab.textContent = this.current() === 'dark' ? 'Dark' : 'Light';
      const knob = sw.querySelector('.theme-switch-knob');
      if (knob) knob.textContent = this.current() === 'dark' ? '🌙' : '☀️';
    });
  },
  buttonHtml() {
    return `<button type="button" class="theme-toggle-icon" data-theme-toggle onclick="Theme.toggle()" aria-label="Switch theme">${this.icon()}</button>`;
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
    </div>`;
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    document.body.appendChild(overlay);
    this.syncButtons();
  }
};
window.Theme = Theme;
try {
  const t = localStorage.getItem('lvcc_theme') || 'light';
  document.documentElement.setAttribute('data-theme', t);
} catch (_) {}
