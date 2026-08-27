/**
 * Themed modal system (replaces alert/confirm/prompt)
 */
const UI = {
  _root() {
    let el = document.getElementById('ui-modal-root');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ui-modal-root';
      document.body.appendChild(el);
    }
    return el;
  },

  close() {
    const root = document.getElementById('ui-modal-root');
    if (root) {
      root.innerHTML = '';
      root.style.cssText = '';
      root.onclick = null;
    }
  },

  _show(html) {
    const root = this._root();
    root.style.cssText = 'position:fixed;inset:0;z-index:50000;pointer-events:auto;';
    root.innerHTML = html;
    // Click on backdrop only (not modal) — optional dismiss not default for confirm
    const overlay = root.querySelector('.ui-modal-overlay, .modal-overlay');
    if (overlay) {
      overlay.style.cssText = (overlay.getAttribute('style') || '') + ';position:fixed;inset:0;z-index:50000;pointer-events:auto;display:flex;align-items:center;justify-content:center;';
      // stop clicks from reaching page behind
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          // do not auto-close; just block
          e.stopPropagation();
        }
      }, true);
    }
    const modal = root.querySelector('.ui-modal, .modal');
    if (modal) {
      modal.style.pointerEvents = 'auto';
      modal.addEventListener('click', (e) => e.stopPropagation());
    }
    return root;
  },

  alert(message, title = 'Notice') {
    return new Promise((resolve) => {
      this._show(`
        <div class="modal-overlay ui-modal-overlay">
          <div class="modal ui-modal">
            <h2>${escapeHtml(title)}</h2>
            <p class="ui-modal-body">${escapeHtml(message)}</p>
            <div class="modal-actions">
              <button class="btn btn-primary" id="ui-ok">OK</button>
            </div>
          </div>
        </div>`);
      document.getElementById('ui-ok').onclick = () => { this.close(); resolve(); };
    });
  },

  confirm(message, title = 'Confirm') {
    return new Promise((resolve) => {
      this._show(`
        <div class="modal-overlay ui-modal-overlay">
          <div class="modal ui-modal">
            <h2>${escapeHtml(title)}</h2>
            <p class="ui-modal-body">${escapeHtml(message)}</p>
            <div class="modal-actions">
              <button class="btn btn-ghost" id="ui-cancel">Cancel</button>
              <button class="btn btn-primary" id="ui-ok">Confirm</button>
            </div>
          </div>
        </div>`);
      document.getElementById('ui-cancel').onclick = () => { this.close(); resolve(false); };
      document.getElementById('ui-ok').onclick = () => { this.close(); resolve(true); };
    });
  },

  prompt(message, defaultValue = '', title = 'Input', placeholder = '') {
    return new Promise((resolve) => {
      const ph = placeholder || '';
      this._show(`
        <div class="modal-overlay ui-modal-overlay">
          <div class="modal ui-modal">
            <h2>${escapeHtml(title)}</h2>
            <p class="ui-modal-body">${escapeHtml(message)}</p>
            <input class="form-control" id="ui-input" value="${escapeHtml(defaultValue || '')}" placeholder="${escapeHtml(ph)}" />
            <div class="modal-actions">
              <button class="btn btn-ghost" id="ui-cancel">Cancel</button>
              <button class="btn btn-primary" id="ui-ok">OK</button>
            </div>
          </div>
        </div>`);
      const input = document.getElementById('ui-input');
      input.focus();
      if (defaultValue) input.select();
      document.getElementById('ui-cancel').onclick = () => { this.close(); resolve(null); };
      document.getElementById('ui-ok').onclick = () => { const v = input.value; this.close(); resolve(v); };
      input.onkeydown = (e) => {
        if (e.key === 'Enter') document.getElementById('ui-ok').click();
        if (e.key === 'Escape') document.getElementById('ui-cancel').click();
      };
    });
  },

  showImage(src, title = 'Screenshot') {
    this._show(`
      <div class="modal-overlay ui-modal-overlay" id="ui-img-overlay">
        <div class="modal ui-modal modal-wide">
          <h2>${escapeHtml(title)}</h2>
          <img src="${src}" alt="screenshot" style="max-width:100%;border-radius:8px;background:#000" />
          <div class="modal-actions">
            <button class="btn btn-primary" id="ui-ok">Close</button>
          </div>
        </div>
      </div>`);
    document.getElementById('ui-ok').onclick = () => this.close();
  }
};
window.UI = UI;


/** 5 min idle → 10s countdown → end session (saves Firestore quota) */
window.IdleGuard = {
  idleMs: 5 * 60 * 1000,
  warnMs: 10 * 1000,
  _last: Date.now(),
  _timer: null,
  _warnTimer: null,
  _active: false,
  _onExpire: null,
  start(onExpire) {
    this.stop();
    this._onExpire = onExpire;
    this._active = true;
    this._last = Date.now();
    const bump = () => { this._last = Date.now(); };
    ['mousemove','mousedown','keydown','touchstart','scroll','click'].forEach(ev => {
      window.addEventListener(ev, bump, { passive: true, capture: true });
    });
    this._bump = bump;
    this._timer = setInterval(() => this._tick(), 1000);
  },
  stop() {
    this._active = false;
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
    if (this._warnTimer) clearInterval(this._warnTimer);
    this._warnTimer = null;
    document.getElementById('idle-guard-modal')?.remove();
    if (this._bump) {
      ['mousemove','mousedown','keydown','touchstart','scroll','click'].forEach(ev => {
        window.removeEventListener(ev, this._bump, { capture: true });
      });
      this._bump = null;
    }
  },
  _tick() {
    if (!this._active) return;
    if (document.getElementById('idle-guard-modal')) return;
    if (Date.now() - this._last < this.idleMs) return;
    this._showWarn();
  },
  _showWarn() {
    if (document.getElementById('idle-guard-modal')) return;
    let left = 10;
    const root = document.createElement('div');
    root.id = 'idle-guard-modal';
    root.className = 'modal-overlay ui-modal-overlay';
    root.style.cssText = 'position:fixed;inset:0;z-index:60000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.55)';
    root.innerHTML = `<div class="modal ui-modal" style="max-width:420px;text-align:center">
      <h2>Are you still there?</h2>
      <p>No activity detected for 5 minutes. Session will end in <strong id="idle-count">${left}</strong>s to save resources.</p>
      <div class="action-btns" style="justify-content:center;gap:0.75rem;margin-top:1rem">
        <button type="button" class="btn btn-danger" id="idle-end">End session</button>
        <button type="button" class="btn btn-primary" id="idle-continue">Continue</button>
      </div>
    </div>`;
    document.body.appendChild(root);
    const end = () => {
      root.remove();
      if (this._warnTimer) clearInterval(this._warnTimer);
      this._warnTimer = null;
      this.stop();
      if (typeof this._onExpire === 'function') this._onExpire();
    };
    const cont = () => {
      root.remove();
      if (this._warnTimer) clearInterval(this._warnTimer);
      this._warnTimer = null;
      this._last = Date.now();
    };
    root.querySelector('#idle-end').onclick = end;
    root.querySelector('#idle-continue').onclick = cont;
    this._warnTimer = setInterval(() => {
      left -= 1;
      const el = document.getElementById('idle-count');
      if (el) el.textContent = String(left);
      if (left <= 0) end();
    }, 1000);
  }
};
