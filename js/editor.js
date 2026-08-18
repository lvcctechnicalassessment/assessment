/**
 * Monaco Editor setup + Anti-cheat monitoring
 */

const CodeEditor = {
  editor: null,
  sessionId: null,
  examId: null,
  updateTimer: null,
  lastCode: '',
  isLocked: false,

  async init(containerId, initialCode = '', sessionId, examId) {
    this.sessionId = sessionId;
    this.examId = examId;

    return new Promise((resolve) => {
      require.config({
        paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.0/min/vs' }
      });

      // Avoid re-loading
      if (window.monaco) {
        this._createEditor(containerId, initialCode);
        resolve(this.editor);
        return;
      }

      require(['vs/editor/editor.main'], () => {
        this._createEditor(containerId, initialCode);
        resolve(this.editor);
      });
    });
  },

  _createEditor(containerId, initialCode) {
    const container = document.getElementById(containerId);
    if (!container) return;

    this.editor = monaco.editor.create(container, {
      value: initialCode,
      language: 'python',
      theme: 'vs-dark',
      automaticLayout: true,
      fontSize: 15,
      minimap: { enabled: true },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      tabSize: 4,
      insertSpaces: true,
      suggestOnTriggerCharacters: true,
      quickSuggestions: true,
      parameterHints: { enabled: true },
      autoClosingBrackets: 'always',
      autoClosingQuotes: 'always',
      formatOnType: true,
      // Disable some features that could help cheating
      contextmenu: false,
      // Basic Python support is built-in
    });

    // Sync code to Firestore (debounced)
    this.editor.onDidChangeModelContent(() => {
      this._scheduleUpdate();
    });

    // Basic syntax markers via simple heuristics + Monaco markers
    this.editor.onDidChangeModelContent(() => {
      this._checkBasicSyntax();
    });

    this.lastCode = initialCode;
    this._setupAntiCheat();
  },

  _scheduleUpdate() {
    if (this.updateTimer) clearTimeout(this.updateTimer);
    this.updateTimer = setTimeout(() => {
      const code = this.editor.getValue();
      if (code !== this.lastCode) {
        this.lastCode = code;
        Exam.updateSessionCode(this.sessionId, code).catch(console.error);
      }
    }, 800); // 800ms debounce for live feel without spamming
  },

  _checkBasicSyntax() {
    // Very lightweight syntax checks for common Python mistakes
    // For real syntax errors, students should use the "Check" button which uses a simple parser
    const model = this.editor.getModel();
    if (!model) return;

    const code = model.getValue();
    const markers = [];

    // Unmatched brackets / parentheses (simple count)
    const opens = (code.match(/[\(\[\{]/g) || []).length;
    const closes = (code.match(/[\)\]\}]/g) || []).length;
    if (opens !== closes) {
      markers.push({
        severity: monaco.MarkerSeverity.Warning,
        message: 'Possible unmatched brackets/parentheses',
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 1,
        endColumn: 1
      });
    }

    // Indentation warning for mixed tabs/spaces is hard; skip for now

    monaco.editor.setModelMarkers(model, 'python-basic', markers);
  },

  // Simple "run" using a message – real execution needs Pyodide (heavy)
  // For this MVP we show a note and highlight errors if any markers exist
  checkCode() {
    const code = this.editor.getValue();
    const outputEl = document.getElementById('output-content');
    if (!outputEl) return;

    outputEl.innerHTML = '';

    // Very basic static analysis
    const lines = code.split('\n');
    let hasError = false;

    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('print ') && !trimmed.startsWith('print(')) {
        this._addOutput(`Line ${i + 1}: print statement should use parentheses: print(...)`, 'error');
        hasError = true;
      }
      if (trimmed.match(/^\s*def\s+\w+\s*\([^)]*$/)) {
        this._addOutput(`Line ${i + 1}: Possible incomplete function definition`, 'warning');
      }
    });

    if (!hasError) {
      this._addOutput('Basic syntax check passed. (Full execution requires server-side or Pyodide integration)', 'success');
      this._addOutput('Your code is being live-synced to the teacher dashboard.', 'info');
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

  // ========== ANTI-CHEAT ==========
  _setupAntiCheat() {
    // 1. Block right-click / context menu
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this._flag('rightclick', 'Right-click attempted');
    });

    // 2. Detect copy
    document.addEventListener('copy', (e) => {
      this._flag('copy', 'Copy action detected');
    });

    // 3. Detect paste — record line ranges for teacher highlight
    document.addEventListener('paste', (e) => {
      const text = (e.clipboardData || window.clipboardData).getData('text') || '';
      const lines = text.split(/\r?\n/).length;
      let startLine = 1, endLine = lines;
      try {
        if (this.editor) {
          const sel = this.editor.getSelection();
          if (sel) {
            startLine = sel.startLineNumber;
            endLine = startLine + Math.max(lines - 1, 0);
          }
        }
      } catch (_) {}
      const pasteRange = { startLine, endLine, lines, chars: text.length, at: new Date().toISOString() };
      this._flag('paste', `Student pasted code (${lines} line${lines === 1 ? '' : 's'})`, { pasteRange });
      // Local highlight markers
      this._highlightPaste(startLine, endLine);
    });

    // 4. Tab / window switch / minimize
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this._flag('tabswitch', 'Tab/window switched or minimized');
      }
    });

    // 5. Window blur (another common switch signal)
    window.addEventListener('blur', () => {
      this._flag('blur', 'Window lost focus');
    });

    // 6. Attempt to close / navigate away
    window.addEventListener('beforeunload', (e) => {
      this._flag('close', 'Attempted to close or leave the page');
      // Modern browsers ignore custom messages
      e.preventDefault();
      e.returnValue = '';
    });

    // 7. Prevent drag-drop of files/text into editor
    document.addEventListener('drop', (e) => {
      e.preventDefault();
      this._flag('drop', 'Drag-and-drop of content attempted');
    });
    document.addEventListener('dragover', (e) => e.preventDefault());

    // Optional: try to request fullscreen (browsers may block)
    // document.documentElement.requestFullscreen?.().catch(() => {});
  },

  _flag(type, details, extra = {}) {
    if (!this.sessionId) return;
    const key = type + details;
    if (this._lastFlag === key && Date.now() - (this._lastFlagTime || 0) < 4000) return;
    this._lastFlag = key;
    this._lastFlagTime = Date.now();

    Exam.logEvent(this.sessionId, type, details, extra).catch(console.error);

    const banner = document.getElementById('lock-banner');
    if (banner) {
      banner.textContent = '⚠ Integrity alert: ' + details;
      banner.classList.remove('hidden');
      setTimeout(() => banner.classList.add('hidden'), 3500);
    }
  },

  _highlightPaste(startLine, endLine) {
    if (!this.editor || !window.monaco) return;
    const model = this.editor.getModel();
    if (!model) return;
    const markers = monaco.editor.getModelMarkers({ resource: model.uri }) || [];
    markers.push({
      severity: monaco.MarkerSeverity.Warning,
      message: 'Recently pasted block',
      startLineNumber: startLine,
      startColumn: 1,
      endLineNumber: endLine,
      endColumn: 1
    });
    monaco.editor.setModelMarkers(model, 'paste-highlight', markers.filter(m => m.message === 'Recently pasted block' || m.owner === 'paste-highlight').concat([{
      severity: monaco.MarkerSeverity.Warning,
      message: 'Recently pasted block',
      startLineNumber: startLine,
      startColumn: 1,
      endLineNumber: endLine,
      endColumn: 200
    }]));
  },

  lockEditor() {
    if (this.editor) {
      this.editor.updateOptions({ readOnly: true });
    }
    this.isLocked = true;
  },


  dispose() {
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
