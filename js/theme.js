/**
 * Light / Dark theme — permanent preference (localStorage + Firestore profile)
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
    } catch (e) {
      console.warn('theme save', e);
    }
  },

  async loadFromProfile() {
    try {
      if (!window.auth?.currentUser || !window.db) return;
      const snap = await window.db.collection('users').doc(window.auth.currentUser.uid).get();
      if (snap.exists && snap.data().theme) {
        this.apply(snap.data().theme, true);
      }
    } catch (e) {
      console.warn('theme load', e);
    }
  },

  icon() {
    return this.current() === 'dark' ? '☀️' : '🌙';
  },

  syncButtons() {
    const icon = this.icon();
    document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
      btn.textContent = icon;
      btn.setAttribute('aria-label', this.current() === 'dark' ? 'Switch to light' : 'Switch to dark');
      btn.title = this.current() === 'dark' ? 'Light mode' : 'Dark mode';
    });
  },

  buttonHtml() {
    return `<button type="button" class="theme-toggle-icon" data-theme-toggle onclick="Theme.toggle()" aria-label="Switch theme">${this.icon()}</button>`;
  }
};

window.Theme = Theme;
try {
  const t = localStorage.getItem('lvcc_theme') || 'light';
  document.documentElement.setAttribute('data-theme', t);
} catch (_) {}
