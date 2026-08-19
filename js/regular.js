/**
 * Regular Assessment — question types + gamified MC UI
 */

const QUESTION_TYPES = [
  { id: 'multiple', label: 'Multiple choice' },
  { id: 'multiselect', label: 'Multi-select' },
  { id: 'truefalse', label: 'True / False' },
  { id: 'fill', label: 'Fill in the blank' },
  { id: 'open', label: 'Open ended' },
  { id: 'dropdown', label: 'Dropdown' },
  { id: 'match', label: 'Match' },
  { id: 'reorder', label: 'Reorder' },
  { id: 'categorize', label: 'Categorize' },
  { id: 'table', label: 'Table fill' },
  { id: 'passage', label: 'Passage' },
  { id: 'graphing', label: 'Graphing' },
  { id: 'math', label: 'Math response' },
  { id: 'dragdrop', label: 'Drag and drop' },
  { id: 'hottext', label: 'Hot text' },
  { id: 'matchtable', label: 'Match table' },
  { id: 'labeling', label: 'Labeling' },
  { id: 'hotspot', label: 'Hotspot' },
  { id: 'wordcloud', label: 'Word cloud' }
];

const OPTION_COLORS = ['#3b82f6', '#14b8a6', '#eab308', '#f43f5e', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'];

const Regular = {
  types: QUESTION_TYPES,
  optionColors: OPTION_COLORS,

  newQuestion(type = 'multiple') {
    const id = 'q_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const base = { id, type, prompt: '', points: 1 };
    switch (type) {
      case 'multiple':
        return { ...base, options: ['', '', '', ''], correct: 0, multiCorrect: false };
      case 'multiselect':
        return { ...base, options: ['', '', '', ''], correct: [], multiCorrect: true };
      case 'dropdown':
        return { ...base, options: ['Option A', 'Option B'], correct: 0 };
      case 'truefalse':
        return { ...base, correct: true };
      case 'fill':
      case 'open':
      case 'math':
      case 'wordcloud':
        return { ...base, correct: '' };
      case 'match':
        return { ...base, left: ['Item 1', 'Item 2'], right: ['Match A', 'Match B'], correct: [0, 1] };
      case 'reorder':
        return { ...base, items: ['First', 'Second', 'Third'], correct: [0, 1, 2] };
      case 'categorize':
        return { ...base, categories: ['Cat A', 'Cat B'], items: ['Item 1', 'Item 2'], correct: {} };
      case 'passage':
        return { ...base, passage: '', correct: '' };
      default:
        return { ...base, correct: '' };
    }
  },

  /** Teacher builder card for multiple / multiselect — gamified layout */
  renderBuilderMC(q, index) {
    const multi = q.type === 'multiselect' || q.multiCorrect;
    const opts = q.options || ['', '', '', ''];
    const cards = opts.map((o, i) => {
      const color = OPTION_COLORS[i % OPTION_COLORS.length];
      const isCorrect = multi
        ? (Array.isArray(q.correct) && q.correct.includes(i))
        : q.correct === i;
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
          <span class="text-muted" style="font-size:0.8rem">Click ✓ on the correct option(s)</span>
        </div>
      </div>`;
  },

  renderStudentQuestion(q, answer) {
    const val = answer !== undefined ? answer : null;
    if (q.type === 'multiple' || q.type === 'multiselect') {
      const multi = q.type === 'multiselect' || q.multiCorrect;
      const opts = q.options || [];
      const cards = opts.map((o, i) => {
        const color = OPTION_COLORS[i % OPTION_COLORS.length];
        const selected = multi
          ? (Array.isArray(val) && val.includes(i))
          : val == i;
        return `
          <button type="button" class="gq-option gq-student ${selected ? 'selected' : ''}"
            style="background:${color}" data-qid="${q.id}" data-opt="${i}" data-multi="${multi ? '1' : '0'}">
            <span class="gq-student-check">${selected ? '✓' : ''}</span>
            <span>${escapeHtml(o || 'Option ' + (i + 1))}</span>
          </button>`;
      }).join('');
      return `
        <div class="q-card gq-block" data-qid="${q.id}" data-type="${q.type}">
          <div class="gq-question-box"><div class="gq-question-text">${escapeHtml(q.prompt || 'Question')}</div></div>
          <div class="gq-options-row">${cards}</div>
        </div>`;
    }

    let body = '';
    switch (q.type) {
      case 'truefalse':
        body = `
          <label class="q-option"><input type="radio" name="${q.id}" value="true" ${val === true || val === 'true' ? 'checked' : ''}/> True</label>
          <label class="q-option"><input type="radio" name="${q.id}" value="false" ${val === false || val === 'false' ? 'checked' : ''}/> False</label>`;
        break;
      case 'fill':
      case 'math':
        body = `<input type="text" class="form-control" data-qid="${q.id}" value="${escapeHtml(val || '')}" placeholder="Your answer"/>`;
        break;
      case 'open':
      case 'wordcloud':
      case 'passage':
        body = (q.passage ? `<div class="q-passage">${escapeHtml(q.passage)}</div>` : '') +
          `<textarea class="form-control" rows="4" data-qid="${q.id}" placeholder="Your response">${escapeHtml(val || '')}</textarea>`;
        break;
      case 'dropdown':
        body = `<select class="form-control" data-qid="${q.id}">
          <option value="">Select...</option>
          ${(q.options || []).map((o, i) => `<option value="${i}" ${val == i ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('')}
        </select>`;
        break;
      default:
        body = `<textarea class="form-control" rows="3" data-qid="${q.id}" placeholder="Your answer">${escapeHtml(typeof val === 'object' ? JSON.stringify(val) : (val || ''))}</textarea>`;
    }
    return `
      <div class="q-card" data-qid="${q.id}" data-type="${q.type}">
        <div class="q-prompt"><strong>${escapeHtml(q.prompt || 'Question')}</strong></div>
        <div class="q-body">${body}</div>
      </div>`;
  },

  collectAnswers(container) {
    const answers = {};
    container.querySelectorAll('.q-card, .gq-block[data-qid]').forEach(card => {
      const qid = card.getAttribute('data-qid');
      if (!qid) return;
      // Gamified MC
      const selected = [...card.querySelectorAll('.gq-student.selected')];
      if (selected.length) {
        const multi = selected[0].dataset.multi === '1';
        answers[qid] = multi ? selected.map(s => Number(s.dataset.opt)) : Number(selected[0].dataset.opt);
        return;
      }
      const radios = card.querySelectorAll(`input[type=radio][name="${qid}"]`);
      if (radios.length) {
        const checked = card.querySelector(`input[type=radio][name="${qid}"]:checked`);
        if (checked) {
          answers[qid] = checked.value === 'true' ? true : checked.value === 'false' ? false : Number(checked.value);
        }
        return;
      }
      const one = card.querySelector(`[data-qid="${qid}"]`);
      if (one && one !== card) answers[qid] = one.value;
    });
    return answers;
  },

  bindStudentMC(container, onChange) {
    container.querySelectorAll('.gq-student').forEach(btn => {
      btn.onclick = () => {
        const multi = btn.dataset.multi === '1';
        const card = btn.closest('[data-qid]');
        if (!multi) {
          card.querySelectorAll('.gq-student').forEach(b => {
            b.classList.remove('selected');
            const c = b.querySelector('.gq-student-check');
            if (c) c.textContent = '';
          });
        }
        btn.classList.toggle('selected');
        const check = btn.querySelector('.gq-student-check');
        if (check) check.textContent = btn.classList.contains('selected') ? '✓' : '';
        if (onChange) onChange();
      };
    });
  },

  answersPreview(answers, questions) {
    if (!answers) return '(no answers yet)';
    return (questions || []).map((q, i) => `Q${i + 1}: ${JSON.stringify(answers[q.id] ?? '—')}`).join('\n');
  },

  /** Auto-grade regular questions when correct answers set */
  gradeAnswers(questions, answers) {
    let earned = 0, total = 0;
    (questions || []).forEach(q => {
      const pts = Number(q.points) || 1;
      total += pts;
      const a = answers?.[q.id];
      if (a === undefined || a === null || a === '') return;
      let ok = false;
      if (q.type === 'multiple' || q.type === 'dropdown') {
        ok = Number(a) === Number(q.correct);
      } else if (q.type === 'multiselect') {
        const ca = Array.isArray(q.correct) ? [...q.correct].map(Number).sort() : [];
        const aa = Array.isArray(a) ? [...a].map(Number).sort() : [];
        ok = JSON.stringify(ca) === JSON.stringify(aa);
      } else if (q.type === 'truefalse') {
        ok = String(a) === String(q.correct);
      } else if (typeof q.correct === 'string') {
        ok = String(a).trim().toLowerCase() === String(q.correct).trim().toLowerCase();
      }
      if (ok) earned += pts;
    });
    const percent = total ? Math.round((earned / total) * 1000) / 10 : 0;
    return { score: earned, maxScore: total, percent };
  }
};

window.Regular = Regular;
window.QUESTION_TYPES = QUESTION_TYPES;
