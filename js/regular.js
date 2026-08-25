/**
 * Regular Assessment — sections, question types, gamified MC, passage, fill, table, TF
 */

const QUESTION_TYPES = [
  { id: 'multiple', label: 'Multiple choice' },
  { id: 'truefalse', label: 'True or False' },
  { id: 'modified_tf', label: 'Modified True or False' },
  { id: 'fill', label: 'Fill in the blank' },
  { id: 'essay', label: 'Essay' },
  { id: 'dropdown', label: 'Dropdown' },
  { id: 'match', label: 'Match' },
  { id: 'reorder', label: 'Reorder' },
  { id: 'categorize', label: 'Categorize' },
  { id: 'table', label: 'Table fill' },
  { id: 'passage', label: 'Passage' },
  { id: 'dragdrop', label: 'Drag and drop' },
  { id: 'hottext', label: 'Hot text' },
  { id: 'labeling', label: 'Labeling' },
  { id: 'hotspot', label: 'Hotspot' },
  { id: 'wordbox', label: 'Word Box' }
];

const OPTION_COLORS = ['#3b82f6', '#14b8a6', '#eab308', '#f43f5e', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'];

const TF_INSTRUCTIONS = {
  simple: 'Select True or False for each statement.',
  modified: 'Select True or False. If False, underline/highlight the wrong part and write the correct answer.'
};

const Regular = {
  types: QUESTION_TYPES,
  optionColors: OPTION_COLORS,
  tfInstructions: TF_INSTRUCTIONS,

  newSection(title = 'Section 1') {
    return {
      id: 'sec_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      title,
      instructions: '',
      questions: []
    };
  },

  newQuestion(type = 'multiple') {
    const id = 'q_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const base = { id, type, prompt: '', points: 1, pointsMode: 'all' }; // all | each
    switch (type) {
      case 'multiple':
        return { ...base, options: ['', '', '', ''], correct: 0, multiCorrect: false };
      case 'truefalse':
        return {
          ...base,
          tfCategory: 'simple',
          options: ['True', 'False'],
          correct: 0,
          statement: ''
        };
      case 'modified_tf':
        return {
          ...base,
          points: 2,
          pointsMode: 'split', // 1 for TF + 1 for correction text
          tfCategory: 'modified',
          options: ['True', 'False'],
          correct: 0,
          statement: '',
          modifiedAnswer: '',
          modifiedAlternatives: [],
          highlightWords: []
        };
      case 'fill':
        return {
          ...base,
          template: 'The capital of France is {{blank}}.',
          blanks: [{ id: 'b1', correct: ['Paris'], alternatives: [] }]
        };
      case 'essay':
        return { ...base, maxChars: 1000, correct: '' };
      case 'wordbox':
        return {
          ...base,
          prompt: '',
          // Sentence with {{1}} {{2}} markers for blanks
          sentence: 'Leaves have green pigment called {{1}} that helps with {{2}}.',
          wordBank: ['chlorophyll', 'photosynthesis', 'mitosis', 'carbohydrates'],
          blanks: [
            { id: '1', correct: 'chlorophyll', alternatives: [] },
            { id: '2', correct: 'photosynthesis', alternatives: [] }
          ]
        };
      case 'dropdown':
        return { ...base, options: ['Option A', 'Option B'], correct: 0 };
      case 'table':
        return {
          ...base,
          rows: 3,
          cols: 3,
          headers: ['Col 1', 'Col 2', 'Col 3'],
          cells: {}, // "r-c": { blank: true, correct: [''], alternatives: [] } or { value: 'text' }
        };
      case 'passage':
        return {
          ...base,
          isPassageSet: true,
          passages: [{ id: 'p1', title: 'Passage 1', html: '<p>Type or paste passage content here.</p>' }],
          // questions attached in section builder
        };
      case 'match':
        return { ...base, left: ['Item 1', 'Item 2'], right: ['Match A', 'Match B'], correct: [0, 1] };
      case 'reorder':
        return { ...base, items: ['First', 'Second', 'Third'], correct: [0, 1, 2] };
      case 'categorize':
        return { ...base, categories: ['Cat A', 'Cat B'], items: ['Item 1', 'Item 2'], correct: {} };
      default:
        return { ...base, correct: '' };
    }
  },

  renderBuilderMC(q, index) {
    const multi = !!q.multiCorrect;
    const opts = q.options || ['', '', '', ''];
    const cards = opts.map((o, i) => {
      const color = OPTION_COLORS[i % OPTION_COLORS.length];
      const isCorrect = multi
        ? (Array.isArray(q.correct) && q.correct.map(Number).includes(i))
        : Number(q.correct) === i;
      return `
        <div class="gq-option" style="background:${color}" data-q="${index}" data-opt="${i}">
          <div class="gq-option-tools">
            <button type="button" class="gq-icon-btn" data-del-opt="${index}:${i}" title="Delete">🗑</button>
            <button type="button" class="gq-correct-btn ${isCorrect ? 'is-correct' : ''}" data-correct="${index}:${i}" title="Mark correct">✓</button>
          </div>
          <textarea class="gq-option-input" data-opt-text="${index}:${i}" placeholder="Type answer option here" rows="3">${escapeHtml(o)}</textarea>
        </div>`;
    }).join('');
    return `
      <div class="gq-block" data-qi="${index}">
        <div class="gq-question-box">
          <textarea class="gq-question-input" data-prompt="${index}" placeholder="Type question here" rows="3">${escapeHtml(q.prompt || '')}</textarea>
        </div>
        <div class="gq-options-row">${cards}
          <button type="button" class="gq-add-opt" data-add-opt="${index}">+</button>
        </div>
        <div class="gq-footer">
          <label class="gq-toggle">
            <input type="checkbox" data-multi="${index}" ${multi ? 'checked' : ''}/> Multiple correct answers
          </label>
          <div class="points-row">
            <label>Points <input type="number" min="0" step="0.5" class="form-control points-input" data-points="${index}" value="${q.points ?? 1}" style="width:70px;display:inline-block"/></label>
            ${multi ? `<label class="gq-toggle"><select data-pointsmode="${index}" class="form-control" style="width:auto;display:inline-block">
              <option value="all" ${(q.pointsMode || 'all') === 'all' ? 'selected' : ''}>Full points if all correct</option>
              <option value="each" ${q.pointsMode === 'each' ? 'selected' : ''}>Point(s) per correct answer</option>
            </select></label>` : ''}
          </div>
        </div>
      </div>`;
  },


  renderBuilderWordBox(q, index) {
    const sentence = q.sentence || q.prompt || '';
    const bank = q.wordBank || [];
    const blanks = q.blanks || [];
    const bankInputs = bank.map((w, i) =>
      `<input class="form-control" data-wb-bank="${index}:${i}" value="${escapeHtml(w || '')}" placeholder="Word ${i+1}" style="margin-bottom:0.35rem" />`
    ).join('');
    const blankRows = blanks.map((b, bi) => `
      <div class="card mt-1" style="padding:0.65rem">
        <strong>Blank {{${escapeHtml(String(b.id || (bi+1)))}}}</strong>
        <input class="form-control mt-1" data-wb-blank-correct="${index}:${bi}" value="${escapeHtml(b.correct || '')}" placeholder="Correct word from bank" />
        <input class="form-control mt-1" data-wb-blank-alt="${index}:${bi}" value="${escapeHtml((b.alternatives||[]).join(', '))}" placeholder="Alternatives (comma-separated)" />
        <button type="button" class="btn btn-sm btn-danger mt-1" data-wb-del-blank="${index}:${bi}">Remove blank</button>
      </div>`).join('');
    return `<div class="builder-wordbox" data-gidx="${index}">
      <p class="text-muted" style="font-size:0.85rem">Write the sentence and insert blanks as <code>{{1}}</code>, <code>{{2}}</code>, etc. Students drag words into those blanks.</p>
      <label>Sentence (use {{1}}, {{2}}… for blanks)</label>
      <textarea class="form-control" data-wb-sentence="${index}" rows="3" placeholder="Leaves have green pigment called {{1}} that helps with {{2}}.">${escapeHtml(sentence)}</textarea>
      <div class="action-btns mt-1">
        <button type="button" class="btn btn-sm btn-ghost" data-wb-insert-blank="${index}">+ Insert blank at end</button>
      </div>
      <label class="mt-1">Word bank (tiles students can drag)</label>
      <div id="wb-bank-list-${index}">${bankInputs || '<p class="text-muted">No words yet</p>'}</div>
      <button type="button" class="btn btn-sm btn-primary mt-1" data-wb-add-word="${index}">+ Add word</button>
      <div class="mt-2"><strong>Blank answers</strong></div>
      ${blankRows || '<p class="text-muted">Add {{1}} in the sentence, then set correct answers here.</p>'}
      <div class="points-row mt-1">
        <label>Points <input type="number" min="0" step="0.5" class="form-control points-input" data-points="${index}" value="${q.points ?? 1}" style="width:70px;display:inline-block"/></label>
      </div>
    </div>`;
  },

  renderBuilderTF(q, index) {
    const isMod = q.type === 'modified_tf' || q.tfCategory === 'modified';
    return `
      <div class="gq-block" data-qi="${index}">
        <div class="gq-question-box">
          <textarea class="gq-question-input" data-prompt="${index}" placeholder="Type statement here" rows="2">${escapeHtml(q.prompt || q.statement || '')}</textarea>
        </div>
        <div class="gq-options-row">
          <div class="gq-option" style="background:${OPTION_COLORS[0]}">
            <div class="gq-option-tools">
              <button type="button" class="gq-correct-btn ${Number(q.correct) === 0 ? 'is-correct' : ''}" data-correct="${index}:0">✓</button>
            </div>
            <div class="gq-option-input" style="pointer-events:none">True</div>
          </div>
          <div class="gq-option" style="background:${OPTION_COLORS[3]}">
            <div class="gq-option-tools">
              <button type="button" class="gq-correct-btn ${Number(q.correct) === 1 ? 'is-correct' : ''}" data-correct="${index}:1">✓</button>
            </div>
            <div class="gq-option-input" style="pointer-events:none">False</div>
          </div>
        </div>
        ${isMod ? `
          <div class="form-group mt-1">
            <label>Correct answer (if False)</label>
            <input class="form-control" data-modified="${index}" value="${escapeHtml(q.modifiedAnswer || '')}" placeholder="Primary correct answer" />
            <label class="mt-1">Alternative correct answers (comma-separated)</label>
            <input class="form-control" data-modified-alt="${index}" value="${escapeHtml((q.modifiedAlternatives || []).join(', '))}" placeholder="alt1, alt2" />
          </div>` : ''}
        <div class="points-row mt-1">
          <label>Points <input type="number" min="0" step="0.5" class="form-control points-input" data-points="${index}" value="${q.points ?? (isMod ? 2 : 1)}" style="width:70px;display:inline-block"/></label>
          ${isMod ? '<span class="text-muted" style="font-size:0.8rem">Default 2 (1 for T/F + 1 for correction)</span>' : ''}
        </div>
      </div>`;
  },

  renderStudentWordBox(q, answer) {
    const sentence = q.sentence || q.prompt || '';
    const bank = (q.wordBank || []).filter(w => String(w || '').trim());
    const ans = (answer && typeof answer === 'object') ? answer : {};
    // Build sentence with drop zones for {{n}}
    const parts = [];
    let last = 0;
    const re = /\{\{(\d+)\}\}/g;
    let m;
    while ((m = re.exec(sentence)) !== null) {
      if (m.index > last) {
        parts.push(`<span class="wb-text">${escapeHtml(sentence.slice(last, m.index))}</span>`);
      }
      const bid = m[1];
      const filled = ans[bid] || ans['b'+bid] || '';
      parts.push(`<span class="wb-inline-drop ${filled ? 'filled' : ''}" data-qid="${q.id}" data-blank="${bid}" data-drop="1">${
        filled
          ? `<span class="wb-placed" draggable="true" data-word="${escapeHtml(filled)}">${escapeHtml(filled)}</span>`
          : '<span class="wb-placeholder">&nbsp;</span>'
      }</span>`);
      last = m.index + m[0].length;
    }
    if (last < sentence.length) {
      parts.push(`<span class="wb-text">${escapeHtml(sentence.slice(last))}</span>`);
    }
    const bankHtml = bank.map((w, i) => {
      const used = Object.values(ans).some(v => String(v).toLowerCase() === String(w).toLowerCase());
      return `<div class="wb-chip ${used ? 'wb-used' : ''}" draggable="true" data-word="${escapeHtml(w)}" id="wb-chip-${q.id}-${i}">${escapeHtml(w)}</div>`;
    }).join('');
    return `<div class="wb-student wb-inline" data-qid="${q.id}">
      <div class="wb-sentence-bar">${parts.join('') || escapeHtml(sentence)}</div>
      <p class="wb-hint">Drag these tiles and drop them in the correct blank above</p>
      <div class="wb-bank-student">${bankHtml || '<span class="text-muted">No words</span>'}</div>
    </div>`;
  },

  renderStudentQuestion(q, answer) {
    if (q.type === 'wordbox') return this.renderStudentWordBox(q, answer);
    const val = answer !== undefined ? answer : null;

    if (q.type === 'multiple') {
      const multi = q.multiCorrect === true;
      const opts = q.options || [];
      const cards = opts.map((o, i) => {
        const color = OPTION_COLORS[i % OPTION_COLORS.length];
        const selected = multi
          ? (Array.isArray(val) && (val.includes(i) || val.includes(String(i))))
          : (val == i || val === String(i));
        return `
          <button type="button" class="gq-option gq-student ${selected ? 'selected' : ''}"
            style="background:${color}" data-qid="${q.id}" data-opt="${i}" data-multi="${multi ? '1' : '0'}"
            role="${multi ? 'checkbox' : 'radio'}" name="q_${q.id}">
            <span class="gq-student-check">${selected ? '✓' : ''}</span>
            <span>${escapeHtml((o && String(o).trim()) ? o : ('Option ' + (i + 1)))}</span>
          </button>`;
      }).join('');
      return `
        <div class="q-card gq-block" data-qid="${q.id}" data-type="multiple">
          <div class="gq-question-box"><div class="gq-question-text">${escapeHtml(q.prompt || 'Question')} <span class="text-muted">(${q.points ?? 1} pt)</span></div></div>
          <div class="gq-options-row">${cards}</div>
        </div>`;
    }

    if (q.type === 'truefalse' || q.type === 'modified_tf') {
      const cat = q.type === 'modified_tf' ? 'modified' : (q.tfCategory || 'simple');
      const selected = val && typeof val === 'object' ? val.choice : val;
      return `
        <div class="q-card gq-block" data-qid="${q.id}" data-type="${q.type}" data-tfcategory="${cat}">
          <div class="gq-question-box">
            <div class="gq-question-text">${escapeHtml(q.prompt || 'Statement')} <span class="text-muted">(${q.points ?? (cat==='modified'?2:1)} pt)</span></div>
          </div>
          <div class="gq-options-row">
            <button type="button" class="gq-option gq-student ${selected == 0 || selected === 'true' ? 'selected' : ''}"
              style="background:${OPTION_COLORS[0]}" data-qid="${q.id}" data-opt="0" data-multi="0">
              <span class="gq-student-check">${selected == 0 ? '✓' : ''}</span>True</button>
            <button type="button" class="gq-option gq-student ${selected == 1 || selected === 'false' ? 'selected' : ''}"
              style="background:${OPTION_COLORS[3]}" data-qid="${q.id}" data-opt="1" data-multi="0">
              <span class="gq-student-check">${selected == 1 ? '✓' : ''}</span>False</button>
          </div>
          ${cat === 'modified' ? `
            <div class="form-group mt-1">
              <label>If False, write the correct answer</label>
              <input class="form-control" data-qid="${q.id}" data-tf-mod="1" value="${escapeHtml((val && val.modified) || '')}" placeholder="Correct answer" />
            </div>` : ''}
        </div>`;
    }

    if (q.type === 'fill') {
      const parts = String(q.template || '').split(/\{\{blank\}\}/g);
      const blanks = q.blanks || [];
      let html = '';
      parts.forEach((part, i) => {
        html += `<span>${escapeHtml(part)}</span>`;
        if (i < parts.length - 1) {
          const b = blanks[i] || {};
          const v = (val && val[b.id]) || '';
          html += `<input class="fill-blank" data-qid="${q.id}" data-blank="${b.id || i}" value="${escapeHtml(v)}" placeholder="____" />`;
        }
      });
      return `
        <div class="q-card" data-qid="${q.id}" data-type="fill">
          <div class="q-prompt"><strong>${escapeHtml(q.prompt || 'Fill in the blanks')}</strong> <span class="text-muted">(${q.points ?? 1} pt)</span></div>
          <div class="fill-template">${html}</div>
        </div>`;
    }

    if (q.type === 'essay') {
      const max = q.maxChars || 1000;
      const text = typeof val === 'string' ? val : '';
      const caption = q.caption || 'Note: Essay scores may be adjusted by your teacher based on a personal assessment of your response, as essays may not be fully auto-graded on this portal.';
      return `
        <div class="q-card" data-qid="${q.id}" data-type="essay">
          <div class="q-prompt"><strong>${escapeHtml(q.prompt || 'Essay')}</strong> <span class="text-muted">(${q.points ?? 1} pt)</span></div>
          <p class="essay-caption">${escapeHtml(caption)}</p>
          <textarea class="form-control" rows="6" maxlength="${max}" data-qid="${q.id}" data-essay="1"
            placeholder="Write your answer (max ${max} characters)">${escapeHtml(text)}</textarea>
          <div class="text-muted essay-count" style="font-size:0.8rem;text-align:right"><span data-count="${q.id}">${text.length}</span> / ${max}</div>
        </div>`;
    }

    if (q.type === 'table') {
      const rows = q.rows || 2, cols = q.cols || 2;
      const headers = q.headers || [];
      let thead = '<tr>' + Array.from({ length: cols }, (_, c) =>
        `<th>${escapeHtml(headers[c] || 'Col ' + (c + 1))}</th>`).join('') + '</tr>';
      let tbody = '';
      for (let r = 0; r < rows; r++) {
        tbody += '<tr>';
        for (let c = 0; c < cols; c++) {
          const key = r + '-' + c;
          const cell = (q.cells || {})[key] || {};
          if (cell.blank) {
            const v = (val && val[key]) || '';
            tbody += `<td><input class="form-control table-blank" data-qid="${q.id}" data-cell="${key}" value="${escapeHtml(v)}" /></td>`;
          } else {
            tbody += `<td>${escapeHtml(cell.value || '')}</td>`;
          }
        }
        tbody += '</tr>';
      }
      return `
        <div class="q-card" data-qid="${q.id}" data-type="table">
          <div class="q-prompt"><strong>${escapeHtml(q.prompt || 'Table')}</strong></div>
          <div class="table-wrap"><table class="assess-table"><thead>${thead}</thead><tbody>${tbody}</tbody></table></div>
        </div>`;
    }

    // generic
    return `
      <div class="q-card" data-qid="${q.id}" data-type="${q.type}">
        <div class="q-prompt"><strong>${escapeHtml(q.prompt || 'Question')}</strong></div>
        <textarea class="form-control" rows="3" data-qid="${q.id}">${escapeHtml(typeof val === 'object' ? JSON.stringify(val) : (val || ''))}</textarea>
      </div>`;
  },

  collectAnswers(container) {
    const answers = {};
    container.querySelectorAll('[data-qid]').forEach(el => {
      const qid = el.getAttribute('data-qid');
      if (!qid) return;
      if (el.classList && el.classList.contains('q-card')) {
        // handled via children
      }
    });

    // MC / TF buttons
    container.querySelectorAll('.q-card, .gq-block[data-qid]').forEach(card => {
      const qid = card.getAttribute('data-qid');
      if (!qid) return;
      const selected = [...card.querySelectorAll('.gq-student.selected')];
      if (selected.length) {
        const multi = selected[0].dataset.multi === '1';
        const choice = multi ? selected.map(s => Number(s.dataset.opt)) : Number(selected[0].dataset.opt);
        const mod = card.querySelector('[data-tf-mod]');
        if (mod) answers[qid] = { choice, modified: mod.value };
        else answers[qid] = choice;
        return;
      }
      const fillInputs = card.querySelectorAll('.fill-blank');
      if (fillInputs.length) {
        const obj = {};
        fillInputs.forEach(inp => { obj[inp.dataset.blank] = inp.value; });
        answers[qid] = obj;
        return;
      }
      const tableInputs = card.querySelectorAll('.table-blank');
      if (tableInputs.length) {
        const obj = {};
        tableInputs.forEach(inp => { obj[inp.dataset.cell] = inp.value; });
        answers[qid] = obj;
        return;
      }
      const essay = card.querySelector('[data-essay]');
      if (essay) { answers[qid] = essay.value; return; }
      const one = card.querySelector(`textarea[data-qid="${qid}"], input[data-qid="${qid}"], select[data-qid="${qid}"]`);
      if (one) answers[qid] = one.value;
    });
    return answers;
  },

  bindStudentMC(container, onChange) {
    // Unbind previous handlers by cloning options row buttons
    container.querySelectorAll('.gq-student').forEach(btn => {
      const multi = btn.getAttribute('data-multi') === '1';
      btn.setAttribute('role', multi ? 'checkbox' : 'radio');
      btn.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const card = btn.closest('[data-qid]');
        if (!card) return;
        const isMulti = btn.getAttribute('data-multi') === '1';
        if (!isMulti) {
          // RADIO behavior — only one selected
          card.querySelectorAll('.gq-student').forEach(b => {
            b.classList.remove('selected');
            b.setAttribute('aria-checked', 'false');
            const c = b.querySelector('.gq-student-check');
            if (c) c.textContent = '';
          });
          btn.classList.add('selected');
          btn.setAttribute('aria-checked', 'true');
          const check = btn.querySelector('.gq-student-check');
          if (check) check.textContent = '✓';
        } else {
          // CHECKBOX behavior
          btn.classList.toggle('selected');
          const on = btn.classList.contains('selected');
          btn.setAttribute('aria-checked', on ? 'true' : 'false');
          const check = btn.querySelector('.gq-student-check');
          if (check) check.textContent = on ? '✓' : '';
        }
        if (onChange) onChange();
      };
    });
    container.querySelectorAll('[data-essay]').forEach(ta => {
      ta.oninput = () => {
        const span = container.querySelector(`[data-count="${ta.dataset.qid}"]`);
        if (span) span.textContent = ta.value.length;
        if (onChange) onChange();
      };
    });
  },

  answersPreview(answers, questions) {
    if (!answers) return '(no answers yet)';
    const qs = questions || [];
    return qs.map((q, i) => `Q${i + 1}: ${JSON.stringify(answers[q.id] ?? '—')}`).join('\n');
  },

  gradeAnswers(questions, answers) {
    let earned = 0, total = 0;
    (questions || []).forEach(q => {
      const pts = Number(q.points) || 1;
      total += pts;
      const a = answers?.[q.id];
      if (a === undefined || a === null || a === '') return;
      let ok = false;
      if (q.type === 'wordbox') {
        const blanks = q.blanks || [];
        const n = blanks.length || 1;
        const itemPts = pts / n;
        total -= pts;
        blanks.forEach(b => {
          total += itemPts;
          const got = String((a && (a[b.id] || a['b'+b.id])) || '').trim().toLowerCase();
          if (!got) return;
          const okList = [b.correct, ...(b.alternatives || [])].map(x => String(x || '').trim().toLowerCase()).filter(Boolean);
          if (okList.includes(got)) earned += itemPts;
        });
        return;
      }
      if (q.type === 'multiple' || q.type === 'dropdown') {
        if (q.multiCorrect) {
          const ca = Array.isArray(q.correct) ? [...q.correct].map(Number).sort() : [];
          const aa = Array.isArray(a) ? [...a].map(Number).sort() : [];
          if (q.pointsMode === 'each') {
            const hit = aa.filter(x => ca.includes(x)).length;
            earned += Math.min(pts, hit * (pts / Math.max(ca.length, 1)));
            return;
          }
          ok = JSON.stringify(ca) === JSON.stringify(aa);
        } else {
          ok = Number(a) === Number(q.correct);
        }
      } else if (q.type === 'truefalse') {
        const choice = typeof a === 'object' ? a.choice : a;
        ok = Number(choice) === Number(q.correct);
      } else if (q.type === 'fill') {
        const blanks = q.blanks || [];
        ok = blanks.every(b => {
          const ans = String((a && a[b.id]) || '').trim().toLowerCase();
          const opts = [b.correct, ...(b.alternatives || [])].flat().map(x => String(x).trim().toLowerCase());
          return opts.includes(ans);
        });
      } else if (typeof q.correct === 'string' && q.correct) {
        ok = String(a).trim().toLowerCase() === String(q.correct).trim().toLowerCase();
      }
      if (ok) earned += pts;
    });
    const percent = total ? Math.round((earned / total) * 1000) / 10 : 0;
    return { score: Math.round(earned * 10) / 10, maxScore: total, percent };
  },

  /** Flatten sections → questions list for grading/live */
  flattenQuestions(exam) {
    if (exam.sections && exam.sections.length) {
      return exam.sections.flatMap(s => s.questions || []);
    }
    return exam.questions || [];
  },

  /** Group questions for single-item take UI. Passages stay as one unit. */
  groupQuestionsForTake(exam) {
    const sections = exam.sections || [];
    const groups = [];
    if (sections.length) {
      sections.forEach(sec => {
        (sec.questions || []).forEach(q => {
          if (q.type === 'passage' || q.isPassageSet) {
            const kids = (q.questions || []).length ? q.questions : [];
            groups.push({ kind: 'passage', passage: q, questions: kids.length ? kids : [q], section: sec });
          } else {
            groups.push({ kind: 'single', question: q, section: sec });
          }
        });
      });
    } else {
      (exam.questions || []).forEach(q => {
        if (q.type === 'passage' || q.isPassageSet) {
          groups.push({ kind: 'passage', passage: q, questions: q.questions || [q] });
        } else {
          groups.push({ kind: 'single', question: q });
        }
      });
    }
    return groups;
  },

  collectAnswers(container) {
    const answers = {};
    if (!container) return answers;
    const wb = container.querySelector('.wb-student');
    if (wb) {
      const qid = wb.getAttribute('data-qid');
      const map = {};
      wb.querySelectorAll('.wb-drop-zone, .wb-inline-drop').forEach(z => {
        const item = z.getAttribute('data-item') || z.getAttribute('data-blank');
        const placed = z.querySelector('.wb-placed');
        if (item) map[item] = placed ? (placed.getAttribute('data-word') || placed.textContent || '').trim() : '';
      });
      if (qid) answers[qid] = map;
      return answers;
    }
    container.querySelectorAll('textarea[data-qid], input[data-qid], select[data-qid]').forEach(el => {
      const qid = el.getAttribute('data-qid');
      if (qid) answers[qid] = el.value;
    });
    return answers;
  },

  bindWordBoxDrag(root, onChange) {
    if (!root) return;
    root.querySelectorAll('.wb-chip, .wb-placed').forEach(chip => {
      chip.setAttribute('draggable', 'true');
      chip.addEventListener('dragstart', (e) => {
        const word = chip.getAttribute('data-word') || chip.textContent || '';
        e.dataTransfer.setData('text/plain', word);
      });
    });
    root.querySelectorAll('.wb-drop-zone, .wb-inline-drop').forEach(zone => {
      zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
      zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
      zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        const word = (e.dataTransfer.getData('text/plain') || '').trim();
        if (!word) return;
        zone.classList.add('filled');
        const span = document.createElement('span');
        span.className = 'wb-placed';
        span.draggable = true;
        span.setAttribute('data-word', word);
        span.textContent = word;
        span.addEventListener('dragstart', (ev) => ev.dataTransfer.setData('text/plain', word));
        zone.innerHTML = '';
        zone.appendChild(span);
        onChange && onChange();
      });
      zone.addEventListener('dblclick', () => {
        zone.classList.remove('filled');
        zone.innerHTML = '<span class="wb-placeholder">&nbsp;</span>';
        onChange && onChange();
      });
    });
  },

  bindStudentMC(box, onChange) {
    if (!box || !onChange) return;
    box.querySelectorAll('.gq-student, .take-opt').forEach(btn => {
      btn.addEventListener('click', () => onChange());
    });
  }
};

window.Regular = Regular;
window.QUESTION_TYPES = QUESTION_TYPES;
