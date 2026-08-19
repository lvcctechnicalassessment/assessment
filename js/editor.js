/**
 * Monaco Editor + Anti-cheat (copy/paste detection, highlights)
 */

const CodeEditor = {
  editor: null,
  sessionId: null,
  examId: null,
  language: 'python',
  updateTimer: null,
  lastCode: '',
  isLocked: false,
  isSubmitting: false,
  _handlers: [],

  async init(containerId, initialCode = '', sessionId, examId, language = 'python') {
    this.sessionId = sessionId;
    this.examId = examId;
    this.language = language === 'java' ? 'java' : 'python';
    this.isLocked = false;

    return new Promise((resolve) => {
      require.config({
        paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.0/min/vs' }
      });

      const boot = () => {
        this._createEditor(containerId, initialCode);
        resolve(this.editor);
      };

      if (window.monaco) boot();
      else require(['vs/editor/editor.main'], boot);
    });
  },

  _createEditor(containerId, initialCode) {
    const container = document.getElementById(containerId);
    if (!container) return;

    this.editor = monaco.editor.create(container, {
      value: initialCode,
      language: this.language,
      theme: 'vs-dark',
      automaticLayout: true,
      fontSize: 14,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      tabSize: this.language === 'python' ? 4 : 2,
      insertSpaces: true,
      suggestOnTriggerCharacters: true,
      quickSuggestions: true,
      parameterHints: { enabled: true },
      autoClosingBrackets: 'always',
      autoClosingQuotes: 'always',
      formatOnType: true,
      contextmenu: false,
      readOnly: false
    });

    this.editor.onDidChangeModelContent(() => {
      this._scheduleUpdate();
      this._checkBasicSyntax();
    });

    // Monaco-native paste (most reliable)
    this.editor.onDidPaste((e) => {
      try {
        const range = e.range;
        const startLine = range.startLineNumber;
        const endLine = range.endLineNumber;
        const lines = endLine - startLine + 1;
        const text = this.editor.getModel().getValueInRange(range) || '';
        const pasteRange = {
          startLine, endLine, lines,
          chars: text.length,
          at: new Date().toISOString()
        };
        this._flag('paste', `Student pasted code (${lines} line${lines === 1 ? '' : 's'})`, { pasteRange });
        this._highlightPaste(startLine, endLine);
      } catch (err) {
        console.error('paste handler', err);
      }
    });

    this.lastCode = initialCode;
    this._setupAntiCheat();
  },

  setLanguage(lang) {
    this.language = lang === 'java' ? 'java' : 'python';
    if (this.editor) {
      monaco.editor.setModelLanguage(this.editor.getModel(), this.language);
    }
  },

  _scheduleUpdate() {
    if (this.updateTimer) clearTimeout(this.updateTimer);
    this.updateTimer = setTimeout(() => {
      const code = this.editor.getValue();
      if (code !== this.lastCode) {
        this.lastCode = code;
        Exam.updateSessionCode(this.sessionId, code).catch(console.error);
      }
    }, 800);
  },

  _checkBasicSyntax() {
    const model = this.editor?.getModel();
    if (!model || !window.monaco) return;
    const code = model.getValue();
    const markers = [];
    const opens = (code.match(/[\(\[\{]/g) || []).length;
    const closes = (code.match(/[\)\]\}]/g) || []).length;
    if (opens !== closes) {
      markers.push({
        severity: monaco.MarkerSeverity.Warning,
        message: 'Possible unmatched brackets/parentheses',
        startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1
      });
    }
    monaco.editor.setModelMarkers(model, 'syntax-basic', markers);
  },

  checkCode() {
    const code = this.editor.getValue();
    const outputEl = document.getElementById('output-content');
    if (!outputEl) return;
    outputEl.innerHTML = '';
    const lines = code.split('\n');
    let hasError = false;
    if (this.language === 'python') {
      lines.forEach((line, i) => {
        const t = line.trim();
        if (t.startsWith('print ') && !t.startsWith('print(')) {
          this._addOutput(`Line ${i + 1}: use print(...)`, 'error');
          hasError = true;
        }
      });
    } else {
      if (!code.includes('{') && code.includes('class ')) {
        this._addOutput('Possible incomplete class body', 'warning');
      }
      if (code.includes('System.out.println') === false && code.includes('main')) {
        this._addOutput('Tip: use System.out.println for output', 'info');
      }
    }
    if (!hasError) {
      this._addOutput('Basic check passed. Code is live-synced to the proctor/teacher dashboard.', 'success');
    }
  },

  _addOutput(msg, type = 'info') {
    const el = document.getElementById('output-content');
    if (!el) return;
    const p = document.createElement('div');
    p.className = type;
    p.textContent = msg;
    el.appendChild(p);
  },

  _on(target, event, fn) {
    target.addEventListener(event, fn);
    this._handlers.push({ target, event, fn });
  },

  _setupAntiCheat() {
    // Ctrl/Cmd + C
    this._on(document, 'keydown', (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = (e.key || '').toLowerCase();
      if (key === 'c') {
        this._flag('copy', 'Ctrl+C / copy shortcut used');
      }
      if (key === 'v') {
        // paste event / onDidPaste will fire with details; still log key
        this._flag('paste-key', 'Ctrl+V / paste shortcut used');
      }
      if (key === 'x') {
        this._flag('cut', 'Ctrl+X / cut shortcut used');
      }
    });

    this._on(document, 'contextmenu', (e) => {
      e.preventDefault();
      this._flag('rightclick', 'Right-click attempted');
    });

    this._on(document, 'copy', () => {
      this._flag('copy', 'Copy action detected');
    });

    this._on(document, 'paste', (e) => {
      const text = (e.clipboardData || window.clipboardData)?.getData('text') || '';
      const lines = text ? text.split(/\r?\n/).length : 0;
      let startLine = 1, endLine = Math.max(lines, 1);
      try {
        const sel = this.editor?.getSelection();
        if (sel) {
          startLine = sel.startLineNumber;
          endLine = startLine + Math.max(lines - 1, 0);
        }
      } catch (_) {}
      const pasteRange = { startLine, endLine, lines: lines || 1, chars: text.length, at: new Date().toISOString() };
      this._flag('paste', `Student pasted code (${pasteRange.lines} line${pasteRange.lines === 1 ? '' : 's'})`, { pasteRange });
      setTimeout(() => this._highlightPaste(startLine, endLine), 50);
    });

    this._on(document, 'visibilitychange', () => {
      if (document.hidden) this._flag('tabswitch', 'Tab/window switched or minimized');
    });

    this._on(window, 'blur', () => this._flag('blur', 'Window lost focus'));

    this._on(window, 'beforeunload', (e) => {
      if (this.isSubmitting || this.isLocked) return;
      this._flag('close', 'Attempted to close or leave the page');
      e.preventDefault();
      e.returnValue = '';
    });

    this._on(document, 'drop', (e) => {
      e.preventDefault();
      this._flag('drop', 'Drag-and-drop of content attempted');
    });
    this._on(document, 'dragover', (e) => e.preventDefault());
  },

  _flag(type, details, extra = {}) {
    if (!this.sessionId || this.isLocked || this.isSubmitting) return;
    const key = type + details;
    if (this._lastFlag === key && Date.now() - (this._lastFlagTime || 0) < 2500) return;
    this._lastFlag = key;
    this._lastFlagTime = Date.now();

    // Capture student viewport thumbnail for teachers/proctors
    this.captureScreen().then((thumb) => {
      if (thumb) extra = { ...extra, screenshot: thumb };
      return Exam.logEvent(this.sessionId, type, details, extra);
    }).catch(() => Exam.logEvent(this.sessionId, type, details, extra));

    const banner = document.getElementById('lock-banner');
    if (banner) {
      banner.textContent = '⚠ Integrity alert: ' + details;
      banner.classList.remove('hidden');
      setTimeout(() => banner.classList.add('hidden'), 4000);
    }
  },

  async captureScreen() {
    try {
      if (typeof html2canvas !== 'function') return null;
      const target = document.getElementById('app') || document.body;
      const canvas = await html2canvas(target, {
        scale: 0.35,
        logging: false,
        useCORS: true,
        backgroundColor: '#0f172a',
        windowWidth: Math.min(window.innerWidth, 1280)
      });
      // Compress
      let q = 0.45;
      let data = canvas.toDataURL('image/jpeg', q);
      while (data.length > 90000 && q > 0.15) {
        q -= 0.1;
        data = canvas.toDataURL('image/jpeg', q);
      }
      return data.length < 120000 ? data : null;
    } catch (e) {
      console.warn('screenshot failed', e);
      return null;
    }
  },

  beginSubmit() {
    this.isSubmitting = true;
  },


  _highlightPaste(startLine, endLine) {
    if (!this.editor || !window.monaco) return;
    const model = this.editor.getModel();
    if (!model) return;
    const existing = (this._pasteDecorations || []);
    this._pasteDecorations = this.editor.deltaDecorations(existing, [{
      range: new monaco.Range(startLine, 1, endLine, 1),
      options: {
        isWholeLine: true,
        className: 'paste-line-highlight',
        linesDecorationsClassName: 'paste-line-gutter',
        overviewRuler: { color: '#dc2626', position: 4 }
      }
    }]);
    monaco.editor.setModelMarkers(model, 'paste-highlight', [{
      severity: monaco.MarkerSeverity.Warning,
      message: 'Recently pasted block',
      startLineNumber: startLine,
      startColumn: 1,
      endLineNumber: endLine,
      endColumn: 200
    }]);
  },

  lockEditor() {
    if (this.editor) this.editor.updateOptions({ readOnly: true });
    this.isLocked = true;
  },

  dispose() {
    this._handlers.forEach(({ target, event, fn }) => {
      try { target.removeEventListener(event, fn); } catch (_) {}
    });
    this._handlers = [];
    if (this.editor) {
      this.editor.dispose();
      this.editor = null;
    }
    if (this.updateTimer) clearTimeout(this.updateTimer);
  },

  getValue() {
    return this.editor ? this.editor.getValue() : '';
  },

  setValue(code) {
    if (this.editor) {
      this.editor.setValue(code);
      this.lastCode = code;
    }
  }
};

window.CodeEditor = CodeEditor;
