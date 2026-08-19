/**
 * Regular Assessment — question types + student/teacher UI helpers
 * Fully interactive: multiple, multi-select, truefalse, fill, open, dropdown, match, reorder, categorize
 * Structured support for: table, passage, graphing, math, dragdrop, hottext, matchtable, labeling, hotspot, wordcloud
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

const Regular = {
  types: QUESTION_TYPES,

  newQuestion(type = 'multiple') {
    const id = 'q_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const base = { id, type, prompt: '', points: 1 };
    switch (type) {
      case 'multiple':
      case 'multiselect':
      case 'dropdown':
        return { ...base, options: ['Option A', 'Option B', 'Option C'], correct: type === 'multiselect' ? [] : 0 };
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
        return { ...base, categories: ['Cat A', 'Cat B'], items: ['Item 1', 'Item 2'], correct: { 'Item 1': 'Cat A', 'Item 2': 'Cat B' } };
      case 'table':
        return { ...base, rows: 2, cols: 2, headers: ['Col1', 'Col2'], correct: {} };
      case 'passage':
        return { ...base, passage: 'Paste passage text here.', subQuestions: [] };
      case 'dragdrop':
      case 'labeling':
        return { ...base, items: ['A', 'B'], targets: ['1', '2'], correct: {} };
      case 'hottext':
      case 'hotspot':
        return { ...base, content: 'Selectable content', correct: [] };
      case 'matchtable':
        return { ...base, rows: ['R1'], cols: ['C1'], correct: {} };
      case 'graphing':
        return { ...base, correct: { x: 0, y: 0 } };
      default:
        return base;
    }
  },

  renderStudentQuestion(q, answer, onChange) {
    const val = answer !== undefined ? answer : null;
    let body = '';
    switch (q.type) {
      case 'multiple':
        body = (q.options || []).map((o, i) => `
          <label class="q-option"><input type="radio" name="${q.id}" value="${i}" ${val == i ? 'checked' : ''}/> ${escapeHtml(o)}</label>`).join('');
        break;
      case 'multiselect':
        body = (q.options || []).map((o, i) => `
          <label class="q-option"><input type="checkbox" name="${q.id}" value="${i}" ${(val || []).includes(i) ? 'checked' : ''}/> ${escapeHtml(o)}</label>`).join('');
        break;
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
        body = `<textarea class="form-control" rows="4" data-qid="${q.id}" placeholder="Your response">${escapeHtml(val || '')}</textarea>`;
        break;
      case 'dropdown':
        body = `<select class="form-control" data-qid="${q.id}">
          <option value="">Select...</option>
          ${(q.options || []).map((o, i) => `<option value="${i}" ${val == i ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('')}
        </select>`;
        break;
      case 'match':
        body = (q.left || []).map((L, i) => `
          <div class="q-match-row">
            <span>${escapeHtml(L)}</span>
            <select data-qid="${q.id}" data-idx="${i}" class="form-control">
              <option value="">Match...</option>
              ${(q.right || []).map((R, j) => `<option value="${j}" ${val && val[i] == j ? 'selected' : ''}>${escapeHtml(R)}</option>`).join('')}
            </select>
          </div>`).join('');
        break;
      case 'reorder':
        body = `<p class="text-muted">Enter order as comma-separated numbers (0 = first item index):</p>
          <input class="form-control" data-qid="${q.id}" value="${escapeHtml((val || q.items || []).join(','))}" />
          <div class="text-muted mt-1">${(q.items || []).map((it, i) => i + ': ' + escapeHtml(it)).join(' · ')}</div>`;
        break;
      case 'categorize':
        body = (q.items || []).map(it => `
          <div class="q-match-row">
            <span>${escapeHtml(it)}</span>
            <select data-qid="${q.id}" data-item="${escapeHtml(it)}" class="form-control">
              <option value="">Category...</option>
              ${(q.categories || []).map(c => `<option value="${escapeHtml(c)}" ${val && val[it] === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
            </select>
          </div>`).join('');
        break;
      case 'passage':
        body = `<div class="q-passage">${escapeHtml(q.passage || '')}</div>
          <textarea class="form-control mt-1" rows="3" data-qid="${q.id}" placeholder="Your answer based on the passage">${escapeHtml(val || '')}</textarea>`;
        break;
      default:
        body = `<textarea class="form-control" rows="3" data-qid="${q.id}" placeholder="Your answer (${q.type})">${escapeHtml(val || '')}</textarea>
          <p class="text-muted" style="font-size:0.8rem">Question type: ${q.type}</p>`;
    }
    return `
      <div class="q-card" data-qid="${q.id}">
        <div class="q-prompt"><strong>${escapeHtml(q.prompt || 'Question')}</strong> <span class="text-muted">(${q.points || 1} pt)</span></div>
        <div class="q-body">${body}</div>
      </div>`;
  },

  collectAnswers(container) {
    const answers = {};
    container.querySelectorAll('.q-card').forEach(card => {
      const qid = card.getAttribute('data-qid');
      const radios = card.querySelectorAll(`input[type=radio][name="${qid}"]`);
      if (radios.length) {
        const checked = card.querySelector(`input[type=radio][name="${qid}"]:checked`);
        if (checked) {
          answers[qid] = checked.value === 'true' ? true : checked.value === 'false' ? false : Number(checked.value);
        }
        return;
      }
      const checks = card.querySelectorAll(`input[type=checkbox][name="${qid}"]`);
      if (checks.length) {
        answers[qid] = [...checks].filter(c => c.checked).map(c => Number(c.value));
        return;
      }
      const selects = card.querySelectorAll(`select[data-qid="${qid}"]`);
      if (selects.length > 1) {
        const map = {};
        selects.forEach(s => {
          if (s.dataset.item) map[s.dataset.item] = s.value;
          else if (s.dataset.idx !== undefined) {
            if (!answers[qid]) answers[qid] = [];
            answers[qid][Number(s.dataset.idx)] = s.value === '' ? null : Number(s.value);
          }
        });
        if (Object.keys(map).length) answers[qid] = map;
        return;
      }
      const one = card.querySelector(`[data-qid="${qid}"]`);
      if (one) answers[qid] = one.value;
    });
    return answers;
  },

  /** Snapshot text for live proctor view */
  answersPreview(answers, questions) {
    if (!answers) return '(no answers yet)';
    return (questions || []).map((q, i) => {
      const a = answers[q.id];
      return `Q${i + 1}: ${JSON.stringify(a ?? '—')}`;
    }).join('\n');
  }
};

window.Regular = Regular;
window.QUESTION_TYPES = QUESTION_TYPES;
