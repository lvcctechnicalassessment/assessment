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
    el.style.cssText = 'position:fixed;inset:0;z-index:50000;pointer-events:none';
    return el;
  },

  close() {
    const root = document.getElementById('ui-modal-root');
    if (root) {
      root.innerHTML = '';
      root.style.pointerEvents = 'none';
    }
  },

  alert(message, title = 'Notice') {
    return new Promise((resolve) => {
      const root = this._root();
      root.style.pointerEvents = 'auto';
      root.innerHTML = `
        <div class="modal-overlay ui-modal-overlay" style="z-index:50000;pointer-events:auto">
          <div class="modal ui-modal">
            <h2>${escapeHtml(title)}</h2>
            <p class="ui-modal-body">${escapeHtml(message)}</p>
            <div class="modal-actions">
              <button class="btn btn-primary" id="ui-ok">OK</button>
            </div>
          </div>
        </div>`;
      document.getElementById('ui-ok').onclick = () => { this.close(); resolve(); };
    });
  },

  confirm(message, title = 'Confirm') {
    return new Promise((resolve) => {
      const root = this._root();
      root.style.pointerEvents = 'auto';
      root.innerHTML = `
        <div class="modal-overlay ui-modal-overlay" style="z-index:50000;pointer-events:auto">
          <div class="modal ui-modal">
            <h2>${escapeHtml(title)}</h2>
            <p class="ui-modal-body">${escapeHtml(message)}</p>
            <div class="modal-actions">
              <button class="btn btn-ghost" id="ui-cancel">Cancel</button>
              <button class="btn btn-primary" id="ui-ok">Confirm</button>
            </div>
          </div>
        </div>`;
      document.getElementById('ui-cancel').onclick = () => { this.close(); resolve(false); };
      document.getElementById('ui-ok').onclick = () => { this.close(); resolve(true); };
    });
  },

  prompt(message, defaultValue = '', title = 'Input', placeholder = '') {
    return new Promise((resolve) => {
      const ph = placeholder || (defaultValue ? '' : '');
      const root = this._root();
      root.style.pointerEvents = 'auto';
      root.innerHTML = `
        <div class="modal-overlay ui-modal-overlay" style="z-index:50000;pointer-events:auto">
          <div class="modal ui-modal">
            <h2>${escapeHtml(title)}</h2>
            <p class="ui-modal-body">${escapeHtml(message)}</p>
            <input class="form-control" id="ui-input" value="${escapeHtml(defaultValue || '')}" placeholder="${escapeHtml(ph)}" />
            <div class="modal-actions">
              <button class="btn btn-ghost" id="ui-cancel">Cancel</button>
              <button class="btn btn-primary" id="ui-ok">OK</button>
            </div>
          </div>
        </div>`;
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

  /** Show image maximized */
  showImage(src, title = 'Screenshot') {
    const root = this._root();
    root.style.pointerEvents = 'auto';
    root.innerHTML = `
      <div class="modal-overlay ui-modal-overlay" id="ui-img-overlay" style="z-index:50000;pointer-events:auto">
        <div class="modal ui-modal modal-wide">
          <h2>${escapeHtml(title)}</h2>
          <img src="${src}" alt="screenshot" style="max-width:100%;border-radius:8px;background:#000" />
          <div class="modal-actions">
            <button class="btn btn-primary" id="ui-ok">Close</button>
          </div>
        </div>
      </div>`;
    document.getElementById('ui-ok').onclick = () => this.close();
  }
};

window.UI = UI;
