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
          sentence: 'The capital of France is {{1}}.',
          blanks: [{ id: '1', correct: 'Paris', alternatives: [] }]
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
          prompt: 'Passage',
          passageHtml: '<p>Type or paste the passage content here.</p>',
          passages: [{ id: 'p1', title: 'Passage 1', html: '<p>Type or paste the passage content here.</p>' }],
          questions: [
            { id: 'pq1', type: 'multiple', prompt: '', options: ['', '', '', ''], correct: 0, points: 1 }
          ]
        };
      case 'match':
        return { ...base, left: ['Item 1', 'Item 2'], right: ['Match A', 'Match B'], correct: [0, 1] };
      case 'reorder':
        return { ...base, items: ['First', 'Second', 'Third'], correct: [0, 1, 2] };
      case 'categorize':
        return {
          ...base,
          prompt: 'Organize these items into the right categories.',
          categories: [
            { id: 'c1', name: 'Category A' },
            { id: 'c2', name: 'Category B' }
          ],
          items: [
            { id: 'i1', name: 'Item 1', category: 'c1' },
            { id: 'i2', name: 'Item 2', category: 'c2' }
          ]
        };
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
          <button type="button" class="gq-icon-btn gq-del-left" data-del-opt="${index}:${i}" title="Delete">🗑</button>
          <textarea class="gq-option-input" data-opt-text="${index}:${i}" placeholder="Type answer option here" rows="3">${escapeHtml(o)}</textarea>
          <button type="button" class="gq-correct-btn gq-correct-right ${isCorrect ? 'is-correct' : ''}" data-correct="${index}:${i}" title="Mark correct">✓</button>
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
    const rows = Number(q.wordBankRows) || 2;
    const cols = Number(q.wordBankCols) || 4;
    let bank = q.wordBank || [];
    while (bank.length < rows * cols) bank.push('');
    bank = bank.slice(0, rows * cols);
    // Grid with +/− on last row/col edge
    let bankGrid = '<table class="wb-bank-cfg-table"><tbody>';
    for (let r = 0; r < rows; r++) {
      bankGrid += '<tr>';
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        bankGrid += `<td><input class="form-control" data-wb-bank="${index}:${i}" value="${escapeHtml(bank[i]||'')}" placeholder="Word" /></td>`;
      }
      if (r === 0) {
        bankGrid += `<td class="wb-edge" rowspan="${rows}">
          <button type="button" class="btn btn-sm btn-ghost tf-pm" data-wb-add-col="${index}" title="Add column">+</button>
          <button type="button" class="btn btn-sm btn-ghost tf-pm" data-wb-del-col="${index}" title="Remove column">−</button>
        </td>`;
      }
      bankGrid += '</tr>';
    }
    bankGrid += `<tr><td colspan="${cols}">
      <button type="button" class="btn btn-sm btn-ghost tf-pm" data-wb-add-row="${index}" title="Add row">+</button>
      <button type="button" class="btn btn-sm btn-ghost tf-pm" data-wb-del-row="${index}" title="Remove row">−</button>
    </td><td></td></tr></tbody></table>`;

    q.questions = Array.isArray(q.questions) ? q.questions : [];
    if (!q.questions.length && (q.sentence || q.prompt)) {
      q.questions = [{
        id: 'wbq1',
        type: 'wordbox',
        prompt: '',
        sentence: q.sentence || q.prompt || '',
        blanks: q.blanks || []
      }];
    }
    const bankList = bank.map(w => String(w || '').trim()).filter(Boolean);
    const highlightSentence = (sent) => {
      // Convert {{n}} to {} for display if needed; show matched words in orange
      let s = String(sent || '');
      // Already stored as text with {Word} or {{1}}
      s = escapeHtml(s);
      // Highlight {Word} matches
      s = s.replace(/\{([^{}]+)\}/g, (m, word) => {
        const w = word.trim();
        const match = bankList.find(b => b.toLowerCase() === w.toLowerCase());
        if (match) return `<span class="wb-ans-hl">${escapeHtml(match)}</span>`;
        return `<span class="wb-ans-slot">{}</span>`;
      });
      // Also highlight bare matched words that were previously converted
      return s;
    };
    const qCards = q.questions.map((kq, ki) => {
      const sent = kq.sentence || '';
      return `<div class="card pass-q-card" data-wb-qi="${ki}">
        <textarea class="form-control wb-sentence-input" data-wb-child-sentence="${index}:${ki}" rows="3" placeholder="e.g. The {Banana} is yellow." spellcheck="false">${escapeHtml(sent)}</textarea>
        <div class="wb-sentence-preview" data-wb-preview="${index}:${ki}">${highlightSentence(sent) || ''}</div>
        <button type="button" class="btn btn-sm btn-muted mt-1" data-wb-child-del="${index}:${ki}">Delete question</button>
      </div>`;
    }).join('');
    const blankN = (q.questions || []).reduce((n, kq) => {
      const s = kq.sentence || '';
      const m = s.match(/\{([^{}]+)\}/g) || s.match(/\{\{\d+\}\}/g) || [];
      return n + m.length;
    }, 0) || ((q.blanks || []).length);
    const eachMode = (q.pointsMode || 'each') === 'each';
    const per = q.pointsPerItem != null && q.pointsPerItem !== '' ? Number(q.pointsPerItem) : 1;
    const autoTotal = eachMode ? Math.max(1, blankN) * (per || 1) : (q.points ?? 1);
    return `<div class="builder-wordbox wb-cfg-dual vh-lock-inner" data-gidx="${index}">
      <div class="wb-cfg-left">
        <label>Word bank — reusable for all questions</label>
        <div class="wb-bank-scroll">${bankGrid}</div>
      </div>
      <div class="wb-cfg-right">
        <div class="pass-q-list-scroll">${qCards || '<p class="text-muted">No questions yet</p>'}</div>
        <div class="pass-q-add-bar">
          <button type="button" class="btn btn-primary" data-wb-add-q="${index}">+ Add New Question</button>
        </div>
      </div>
      <div class="points-row mt-1">
        <label>Scoring
          <select class="form-control" data-pointsmode="${index}" style="width:auto;display:inline-block">
            <option value="each" ${(q.pointsMode || 'each') === 'each' ? 'selected' : ''}>Points per correct answer</option>
            <option value="all" ${q.pointsMode === 'all' ? 'selected' : ''}>Full points only if all correct</option>
          </select>
        </label>
        <label class="tf-each-pts" style="${eachMode ? '' : 'display:none'}">Points per correct <input type="number" min="0" step="0.5" class="form-control" data-points-each="${index}" value="${q.pointsPerItem ?? 1}" placeholder="1" style="width:70px;display:inline-block"/></label>
        <label>Total points <input type="number" min="0" step="0.5" class="form-control points-input" data-points="${index}" value="${autoTotal}" style="width:80px;display:inline-block" ${eachMode ? 'readonly' : ''}/></label>
      </div>
    </div>`;
  },

  renderBuilderFill(q, index) {
    let segments = Array.isArray(q.parts) ? q.parts : null;
    if (!segments || !segments.length) {
      const tpl = q.template || q.sentence || q.prompt || '';
      segments = [];
      let last = 0;
      const re = /\{\{(\d+)\}\}/g;
      let m;
      while ((m = re.exec(tpl)) !== null) {
        if (m.index > last) segments.push({ kind: 'text', text: tpl.slice(last, m.index) });
        const bid = String(m[1]);
        const blank = (q.blanks || []).find(b => String(b.id) === bid) || {};
        const corr = Array.isArray(blank.correct) ? blank.correct[0] : (blank.correct || '');
        const alts = Array.isArray(blank.correct) && blank.correct.length > 1
          ? blank.correct.slice(1)
          : (blank.alternatives || []);
        segments.push({ kind: 'blank', id: bid, correct: corr || '', alternatives: alts || [] });
        last = m.index + m[0].length;
      }
      if (last < tpl.length) segments.push({ kind: 'text', text: tpl.slice(last) });
      if (!segments.length) segments = [{ kind: 'text', text: tpl || '' }];
      q.parts = segments;
    }
    const segsHtml = segments.map((s, si) => {
      if (s.kind === 'blank') {
        return `<span class="fib-seg fib-blank" data-fib-seg="${index}:${si}">
          <input class="form-control fib-inline-input fib-answer-input" data-fib-correct="${index}:${si}" value="${escapeHtml(s.correct||'')}" placeholder="Correct answer" />
          <button type="button" class="btn btn-sm btn-ghost fib-alt-btn" data-fib-alt-pop="${index}:${si}" title="Alternate answers">Alt…</button>
          <button type="button" class="btn btn-sm btn-muted" data-fib-del-seg="${index}:${si}">×</button>
        </span>`;
      }
      return `<span class="fib-seg fib-text" data-fib-seg="${index}:${si}">
        <input class="form-control fib-text-input" data-fib-text="${index}:${si}" value="${escapeHtml(s.text||'')}" placeholder="Text…" />
        <button type="button" class="btn btn-sm btn-muted" data-fib-del-seg="${index}:${si}">×</button>
      </span>`;
    }).join('');
    const blankN = segments.filter(s => s.kind === 'blank').length;
    const eachMode = (q.pointsMode || 'all') === 'each';
    const perBlank = q.pointsPerItem != null && q.pointsPerItem !== '' ? Number(q.pointsPerItem) : 1;
    const autoTotal = eachMode ? (blankN * (perBlank || 1)) : (q.points ?? 1);
    return `<div class="builder-fill" data-gidx="${index}">
      <p class="text-muted" style="font-size:0.85rem">Add text and answer boxes inline. Use Alt… for alternate answers.</p>
      <div class="fib-builder-row">${segsHtml || '<span class="text-muted">Empty</span>'}</div>
      <div class="action-btns mt-1" style="flex-wrap:wrap;gap:0.35rem">
        <button type="button" class="btn btn-sm btn-ghost" data-fib-add-text="${index}">+ Text</button>
        <button type="button" class="btn btn-sm btn-primary" data-fib-add-blank="${index}">+ Answer box</button>
      </div>
      <div class="points-row mt-1">
        <label>Scoring
          <select class="form-control" data-pointsmode="${index}" style="width:auto;display:inline-block">
            <option value="all" ${(q.pointsMode || 'all') === 'all' ? 'selected' : ''}>Full points only if all blanks correct</option>
            <option value="each" ${q.pointsMode === 'each' ? 'selected' : ''}>Points for every correct blank</option>
          </select>
        </label>
        <label class="tf-each-pts" style="${eachMode ? '' : 'display:none'}">Points per blank <input type="number" min="0" step="0.5" class="form-control" data-points-each="${index}" value="${q.pointsPerItem ?? ''}" placeholder="1" style="width:70px;display:inline-block"/></label>
        <label>Total points <input type="number" min="0" step="0.5" class="form-control points-input" data-points="${index}" value="${autoTotal}" style="width:80px;display:inline-block" ${eachMode ? 'readonly' : ''}/></label>
      </div>
    </div>`;
  },

  renderBuilderPassage(q, index) {
    if (!q.questions) q.questions = [];
    if (!q.passageHtml && q.passages && q.passages[0]) {
      q.passageHtml = q.passages[0].html || '';
    }
    const html = q.passageHtml || '<p></p>';
    const kids = q.questions;
    const qCards = kids.map((kq, ki) => {
      const isMc = kq.type === 'multiple';
      const opts = (kq.options || ['', '', '', '']).map((o, oi) => `
        <div style="display:flex;gap:0.35rem;align-items:center;margin:0.25rem 0">
          <input type="radio" name="pass-correct-${index}-${ki}" data-pass-correct="${index}:${ki}:${oi}" ${Number(kq.correct)===oi?'checked':''} />
          <input class="form-control" data-pass-opt="${index}:${ki}:${oi}" value="${escapeHtml(o)}" placeholder="Option ${String.fromCharCode(65+oi)}" />
          <button type="button" class="btn btn-sm btn-muted" data-pass-del-opt="${index}:${ki}:${oi}">×</button>
        </div>`).join('');
      return `<div class="card mt-1" style="padding:0.75rem">
        <input class="form-control" data-pass-q-prompt="${index}:${ki}" value="${escapeHtml(kq.prompt||'')}" placeholder="Question prompt" />
        <select class="form-control mt-1" data-pass-q-type="${index}:${ki}">
          <option value="multiple" ${isMc?'selected':''}>Multiple Choice</option>
          <option value="essay" ${kq.type==='essay'?'selected':''}>Open-Ended Text</option>
        </select>
        <label class="mt-1" style="display:inline-flex;align-items:center;gap:0.35rem">Points
          <input type="number" min="0" step="0.5" class="form-control" style="width:70px" data-pass-q-points="${index}:${ki}" value="${kq.points != null ? kq.points : 1}" />
        </label>
        ${isMc ? `<label class="mt-1" style="display:block"><input type="checkbox" data-pass-q-multi="${index}:${ki}" ${kq.multiCorrect ? 'checked' : ''}/> Multiple correct answers</label>
          <div class="mt-1">${opts}<button type="button" class="btn btn-sm btn-ghost" data-pass-add-opt="${index}:${ki}">+ Add Option</button></div>`
          : `<textarea class="form-control mt-1" data-pass-rubric="${index}:${ki}" rows="2" placeholder="Suggested answer / rubric">${escapeHtml(kq.correct||kq.rubric||'')}</textarea>
          <p class="text-muted" style="font-size:0.8rem">Note: Open-ended scores may be adjusted by your instructor based on a personal assessment of your response, as open-ended answers may not be fully auto-graded on this portal.</p>`}
        <button type="button" class="btn btn-sm btn-danger mt-1" data-pass-del-q="${index}:${ki}">Delete Question</button>
      </div>`;
    }).join('');
    const passages = (q.passages && q.passages.length) ? q.passages : [{ id: 'p1', title: 'Passage 1', html: html }];
    if (!q.passages || !q.passages.length) q.passages = passages;
    const tabBar = passages.map((pp, ti) =>
      `<button type="button" class="passage-tab ${ti === 0 ? 'active' : ''}" data-pass-tab-cfg="${index}:${ti}">${escapeHtml(pp.title || ('Passage ' + (ti + 1)))}</button>`
    ).join('') + `<button type="button" class="passage-tab passage-tab-add" data-pass-add-tab="${index}" title="Add passage tab">+</button>`;
    const activeHtml = passages[0] ? (passages[0].html || html) : html;
    return `<div class="passage-dual" data-gidx="${index}">
      <div class="passage-dual-left">
        <div class="passage-tab-bar">${tabBar}</div>
        <div class="rte-toolbar">
          <button type="button" data-rte="${index}:bold"><b>B</b></button>
          <button type="button" data-rte="${index}:italic"><i>I</i></button>
          <button type="button" data-rte="${index}:underline"><u>U</u></button>
          <button type="button" data-rte="${index}:h2">H2</button>
          <button type="button" data-rte="${index}:h3">H3</button>
          <button type="button" data-rte="${index}:left">Left</button>
          <button type="button" data-rte="${index}:center">Center</button>
          <button type="button" data-rte="${index}:right">Right</button>
          <button type="button" data-rte="${index}:justify">Justify</button>
          <button type="button" data-rte="${index}:image">Image URL</button>
          <label class="rte-upload-btn" title="Upload image from device">
            Upload image
            <input type="file" accept="image/*" data-pass-upload="${index}" hidden />
          </label>
        </div>
        <div class="rte-editor" contenteditable="true" data-pass-html="${index}" data-pass-active-tab="0">${activeHtml}</div>
      </div>
      <div class="passage-dual-right">
        <div class="pass-q-list pass-q-list-scroll">${qCards}</div>
        <div class="pass-q-add-bar">
          <button type="button" class="btn btn-primary" data-pass-add-q="${index}">+ Add New Question</button>
        </div>
      </div>
    </div>`;
  },

  renderBuilderCategorize(q, index) {
    // Normalize legacy string arrays → objects
    if (q.categories && q.categories.length && typeof q.categories[0] === 'string') {
      q.categories = q.categories.map((name, i) => ({ id: 'c' + (i + 1), name: String(name) }));
    }
    if (q.items && q.items.length && typeof q.items[0] === 'string') {
      const firstCat = (q.categories && q.categories[0] && q.categories[0].id) || 'c1';
      q.items = q.items.map((name, i) => ({ id: 'i' + (i + 1), name: String(name), category: firstCat }));
    }
    if (!q.categories) q.categories = [];
    if (!q.items) q.items = [];
    const cats = q.categories;
    const items = q.items;
    const catCols = cats.map((c, ci) => `
      <div class="cat-col" data-cat="${c.id}">
        <div class="cat-col-head" style="background:${['#3b82f6','#14b8a6','#f59e0b','#ef4444','#8b5cf6'][ci%5]}">
          <input class="form-control" data-cat-name="${index}:${ci}" value="${escapeHtml(c.name||'')}" placeholder="Category name" />
          <button type="button" class="btn btn-sm btn-muted" data-cat-del="${index}:${ci}">×</button>
        </div>
        <div class="cat-col-body text-muted" style="font-size:0.8rem;padding:0.5rem">Items assigned via answer key below</div>
      </div>`).join('');
    const itemRows = items.map((it, ii) => `
      <div class="cat-item-config" style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;margin:0.35rem 0;padding:0.5rem;border:1px solid var(--border);border-radius:8px">
        ${it.image ? `<img src="${escapeHtml(it.image)}" alt="" style="width:40px;height:40px;object-fit:cover;border-radius:6px" />` : ''}
        <input class="form-control" style="max-width:160px" data-cat-item-name="${index}:${ii}" value="${escapeHtml(it.name||'')}" placeholder="Item name" />
        <select class="form-control" style="max-width:160px" data-cat-item-cat="${index}:${ii}">
          <option value="">— category —</option>
          ${cats.map(c => `<option value="${escapeHtml(c.id)}" ${it.category===c.id?'selected':''}>${escapeHtml(c.name||c.id)}</option>`).join('')}
        </select>
        <label class="btn btn-sm btn-ghost" style="margin:0;cursor:pointer">
          ${it.image ? 'Replace image' : 'Image'}
          <input type="file" accept="image/*" data-cat-item-img="${index}:${ii}" hidden />
        </label>
        ${it.image ? `<button type="button" class="btn btn-sm btn-ghost" data-cat-item-del-img="${index}:${ii}">Remove image</button>` : ''}
        <button type="button" class="btn btn-sm btn-muted" data-cat-item-del="${index}:${ii}">×</button>
      </div>`).join('');
    const itemCount = items.length || 0;
    const perItem = q.pointsPerItem != null && q.pointsPerItem !== '' ? Number(q.pointsPerItem) : 1;
    const autoPts = Math.max(1, itemCount) * (perItem || 1);
    return `<div class="categorize-dual" data-gidx="${index}">
      <div class="form-group cat-row-1" style="display:flex;flex-wrap:wrap;gap:0.75rem;align-items:flex-end">
        <div style="flex:1;min-width:200px">
          <label>Prompt</label>
          <input class="form-control q-prompt" data-gidx="${index}" value="${escapeHtml(q.prompt||'')}" placeholder="Organize these items into the right categories." />
        </div>
        <div class="points-row" style="margin:0">
          <label>Points per item <input type="number" min="0" step="0.5" class="form-control" data-points-each="${index}" value="${q.pointsPerItem ?? 1}" placeholder="1" style="width:70px;display:inline-block"/></label>
          <label>Total points <input type="number" min="0" step="0.5" class="form-control points-input" data-points="${index}" value="${q.points != null ? q.points : autoPts}" style="width:70px;display:inline-block" readonly/></label>
        </div>
      </div>
      <div class="cat-row-2" style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem;flex-wrap:wrap;margin-top:0.75rem">
        <strong>Categories</strong>
        <button type="button" class="btn btn-sm btn-primary" data-cat-add="${index}">+ Add Category</button>
      </div>
      <div class="cat-board cat-row-3 mt-1">${catCols || '<p class="text-muted">No categories yet — click Add Category</p>'}</div>
      <div class="cat-row-4" style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem;flex-wrap:wrap;margin-top:0.75rem">
        <strong>Items &amp; answer key</strong>
        <button type="button" class="btn btn-sm btn-primary" data-cat-add-item="${index}">+ Add Item</button>
      </div>
      <div class="cat-items-scroll cat-row-5 mt-1">
        ${itemRows || '<p class="text-muted">Add items below, then set the name and category.</p>'}
      </div>
    </div>`;
  },


  ensureTableLayout(q) {
    if (!q) return q;
    q.cols = Math.min(10, Math.max(1, Number(q.cols) || 3));
    q.headers = Array.isArray(q.headers) ? q.headers : [];
    while (q.headers.length < q.cols) q.headers.push('Col ' + (q.headers.length + 1));
    q.headers = q.headers.slice(0, q.cols);
    q.cells = q.cells || {};
    if (!Array.isArray(q.tableRows) || !q.tableRows.length) {
      q.tableRows = [];
      if (q.subheaders && q.subheaders.some(s => String(s || '').trim())) {
        const vals = [];
        for (let c = 0; c < q.cols; c++) vals.push(q.subheaders[c] || '');
        q.tableRows.push({ type: 'subheader', values: vals });
      }
      const n = Math.min(20, Math.max(1, Number(q.rows) || 3));
      for (let i = 0; i < n; i++) q.tableRows.push({ type: 'data' });
    }
    q.tableRows.forEach(row => {
      if (row && row.type === 'subheader') {
        row.values = Array.isArray(row.values) ? row.values : [];
        while (row.values.length < q.cols) row.values.push('');
        row.values = row.values.slice(0, q.cols);
      }
    });
    q.rows = q.tableRows.filter(r => r && r.type === 'data').length || 1;
    return q;
  },

  renderBuilderTable(q, index) {
    this.ensureTableLayout(q);
    const cols = q.cols;
    let blankCount = 0;
    Object.keys(q.cells).forEach(k => { if (q.cells[k] && q.cells[k].blank) blankCount++; });
    const eachMode = (q.pointsMode || 'all') === 'each';
    const perBlank = q.pointsPerItem != null && q.pointsPerItem !== '' ? Number(q.pointsPerItem) : 1;
    const autoTotal = eachMode ? (blankCount * (perBlank || 1)) : (q.points ?? 1);
    let grid = '<table class="table-fill-cfg"><thead><tr class="tf-cfg-header">';
    for (let c = 0; c < cols; c++) {
      const h = q.headers[c] || ('Col ' + (c + 1));
      grid += `<th class="tf-cfg-th"><input class="form-control" data-tf-header="${index}:${c}" value="${escapeHtml(h)}" /></th>`;
    }
    grid += `<th class="tf-col-actions">
      <button type="button" class="btn btn-sm btn-ghost tf-pm" data-tf-add-col="${index}" title="Add column">+</button>
      <button type="button" class="btn btn-sm btn-ghost tf-pm" data-tf-del-col="${index}" title="Remove column">−</button>
    </th></tr></thead><tbody>`;
    let dataIdx = 0;
    (q.tableRows || []).forEach((row, ri) => {
      if (row.type === 'subheader') {
        grid += '<tr class="tf-cfg-sub">';
        for (let c = 0; c < cols; c++) {
          grid += `<td class="tf-sub-cell"><input class="form-control" data-tf-subcell="${index}:${ri}:${c}" value="${escapeHtml(row.values[c] || '')}" placeholder="Subheader" /></td>`;
        }
        grid += '<td></td></tr>';
        return;
      }
      const r = dataIdx++;
      grid += '<tr>';
      for (let c = 0; c < cols; c++) {
        const key = r + '-' + c;
        const cell = q.cells[key] || {};
        const isBlank = !!cell.blank;
        const val = isBlank ? (Array.isArray(cell.correct) ? cell.correct[0] : (cell.correct || '')) : (cell.value || '');
        grid += `<td class="tf-cfg-td ${isBlank ? 'is-blank' : ''}">
          <div class="tf-cell-inner">
            <input class="form-control tf-cfg-input" data-tf-cell="${index}:${key}" value="${escapeHtml(String(val || ''))}" placeholder="${isBlank ? 'Correct answer' : 'Cell text'}" />
            <div class="tf-cell-tools">
              <label class="tf-blank-toggle"><input type="checkbox" data-tf-blank="${index}:${key}" ${isBlank ? 'checked' : ''}/> Blank</label>
              ${isBlank ? `<button type="button" class="btn btn-sm btn-ghost" data-tf-alt-pop="${index}:${key}">Alt</button>` : ''}
            </div>
          </div>
        </td>`;
      }
      grid += '<td></td></tr>';
    });
    grid += `<tr class="tf-row-actions"><td colspan="${cols}">
      <button type="button" class="btn btn-sm btn-ghost tf-pm" data-tf-add-row="${index}" title="Add row">+</button>
      <button type="button" class="btn btn-sm btn-ghost" data-tf-add-sub="${index}">Add subheader</button>
      <button type="button" class="btn btn-sm btn-ghost tf-pm" data-tf-del-row="${index}" title="Remove row">−</button>
      <span class="text-muted" style="font-size:0.8rem;margin-left:0.5rem">Blanks: ${blankCount}/50</span>
    </td><td></td></tr></tbody></table>`;
    return `<div class="table-fill-single" data-gidx="${index}">
      <label class="text-muted" style="font-size:0.8rem">Instruction (shown as first merged row of the table)</label>
      <textarea class="form-control q-prompt" data-gidx="${index}" rows="2" placeholder="Instructions for students — appears as top row spanning all columns">${escapeHtml(q.prompt || '')}</textarea>
      <label class="mt-1" style="display:flex;align-items:center;gap:0.5rem">
        <input type="checkbox" data-tf-show-calc="${index}" ${q.showCalculator !== false ? 'checked' : ''}/>
        Show calculator during student assessment
      </label>
      <div class="table-fill-scroll mt-1">${grid}</div>
      <div class="points-row mt-1" style="display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center">
        <label>Scoring
          <select class="form-control" data-pointsmode="${index}" style="width:auto;display:inline-block">
            <option value="all" ${(q.pointsMode || 'all') === 'all' ? 'selected' : ''}>Full points only if all blanks correct</option>
            <option value="each" ${q.pointsMode === 'each' ? 'selected' : ''}>Points for every correct blank</option>
          </select>
        </label>
        <label class="tf-each-pts" style="${eachMode ? '' : 'display:none'}">Points per blank <input type="number" min="0" step="0.5" class="form-control" data-points-each="${index}" value="${q.pointsPerItem ?? ''}" placeholder="1" style="width:70px;display:inline-block"/></label>
        <label>Total points <input type="number" min="0" step="0.5" class="form-control points-input" data-points="${index}" value="${autoTotal}" style="width:70px;display:inline-block" ${eachMode ? 'readonly' : ''}/></label>
      </div>
    </div>`;
  },

  renderStudentTable(q, answer) {
    this.ensureTableLayout(q);
    const cols = Number(q.cols) || 3;
    const cells = q.cells || {};
    const ans = (answer && typeof answer === 'object') ? answer : {};
    const instr = q.prompt || 'Fill in the blank cells.';
    let grid = '<table class="table-fill-student table-fill-grid"><thead>';
    grid += `<tr class="tf-instr-row"><td colspan="${cols}">${escapeHtml(instr)}</td></tr>`;
    grid += '<tr class="tf-header-row">';
    for (let c = 0; c < cols; c++) {
      grid += `<th>${escapeHtml((q.headers && q.headers[c]) || ('Col ' + (c + 1)))}</th>`;
    }
    grid += '</tr></thead><tbody>';
    let dataIdx = 0;
    (q.tableRows || []).forEach(row => {
      if (row.type === 'subheader') {
        grid += '<tr class="tf-subheader-row">';
        for (let c = 0; c < cols; c++) {
          grid += `<th>${escapeHtml((row.values && row.values[c]) || '')}</th>`;
        }
        grid += '</tr>';
        return;
      }
      const r = dataIdx++;
      grid += '<tr>';
      for (let c = 0; c < cols; c++) {
        const key = r + '-' + c;
        const cell = cells[key] || {};
        if (cell.blank) {
          grid += `<td class="tf-cell tf-blank"><input class="tf-student-blank" data-qid="${q.id}" data-cell="${key}" value="${escapeHtml(ans[key] || '')}" inputmode="decimal" /></td>`;
        } else {
          grid += `<td class="tf-cell tf-fixed">${escapeHtml(cell.value || '')}</td>`;
        }
      }
      grid += '</tr>';
    });
    grid += '</tbody></table>';
    const showCalc = q.showCalculator !== false;
    const calcHtml = showCalc ? `<aside class="table-fill-take-right" id="student-calc-panel">
        <div class="tf-calculator tf-calc-pro" id="student-calculator">
          <div class="tf-calc-title">Calculator</div>
          <input class="form-control tf-calc-display" id="stu-calc-display" value="0" inputmode="decimal" autocomplete="off" />
          <div class="tf-calc-keys">
            ${['7','8','9','÷','4','5','6','×','1','2','3','−','0','.','=','+','C','⌫','Copy'].map(k =>
              `<button type="button" class="tf-calc-key" data-stu-calc="${k === '÷' ? '/' : k === '×' ? '*' : k === '−' ? '-' : k}">${k}</button>`
            ).join('')}
          </div>
          <p class="tf-calc-hint">Numbers only · Copy/paste with table is allowed</p>
        </div>
        <div class="tf-clip-history">
          <div class="tf-clip-title">Clipboard</div>
          <div class="tf-clip-list"><span class="text-muted">Empty</span></div>
        </div>
      </aside>` : '';
    return `<div class="table-fill-take ${showCalc ? '' : 'tf-full-width'}" data-qid="${q.id}" data-table-fill="1">
      <div class="table-fill-take-left">
        <div class="table-fill-scroll table-fill-center">${grid}</div>
      </div>
      ${calcHtml}
    </div>`;
  },

  renderBuilderMatch(q, index) {
    const left = q.left || ['', ''];
    const right = q.right || ['', ''];
    const correct = Array.isArray(q.correct) ? q.correct : left.map((_, i) => i);
    const leftRows = left.map((t, i) => `
      <div class="match-cfg-row" data-side="left" data-i="${i}">
        <span class="match-dot">●</span>
        <input class="form-control" data-match-left="${index}:${i}" value="${escapeHtml(t)}" placeholder="Column A item ${i + 1}" />
        <button type="button" class="btn btn-sm btn-ghost" data-match-del-left="${index}:${i}">×</button>
      </div>`).join('');
    const rightRows = right.map((t, i) => `
      <div class="match-cfg-row" data-side="right" data-i="${i}">
        <span class="match-dot">●</span>
        <input class="form-control" data-match-right="${index}:${i}" value="${escapeHtml(t)}" placeholder="Column B item ${i + 1}" />
        <button type="button" class="btn btn-sm btn-ghost" data-match-del-right="${index}:${i}">×</button>
      </div>`).join('');
    const keyRows = left.map((t, i) => {
      const opts = right.map((rt, j) => `<option value="${j}" ${Number(correct[i]) === j ? 'selected' : ''}>${escapeHtml(rt || ('B' + (j + 1)))}</option>`).join('');
      const aLabel = (t && String(t).trim()) ? t : ('A' + (i + 1));
      return `<div class="form-group"><label>${escapeHtml(aLabel)} → <select class="form-control" data-match-key="${index}:${i}">${opts}</select></label></div>`;
    }).join('');
    return `<div class="match-builder" data-gidx="${index}">
      <div style="display:flex;flex-wrap:wrap;gap:0.75rem;align-items:flex-start">
        <textarea class="form-control q-prompt" data-gidx="${index}" rows="2" style="flex:1;min-width:200px" placeholder="Instructions (e.g. Match Column A with Column B)">${escapeHtml(q.prompt || '')}</textarea>
        <label style="white-space:nowrap">Points
          <input type="number" min="0" step="0.5" class="form-control points-input" data-points="${index}" value="${q.points != null ? q.points : left.length}" style="width:80px;display:inline-block"/>
        </label>
      </div>
      <p class="text-muted" style="font-size:0.8rem">1 point per correct pair by default. Set answer key below.</p>
      <div class="match-cfg-cols">
        <div><strong>Column A</strong>${leftRows}
          <button type="button" class="btn btn-sm btn-ghost" data-match-add-left="${index}">+ Add A</button></div>
        <div><strong>Column B</strong>${rightRows}
          <button type="button" class="btn btn-sm btn-ghost" data-match-add-right="${index}">+ Add B</button></div>
      </div>
      <div class="match-key mt-1"><strong>Answer key</strong>${keyRows}</div>
    </div>`;
  },

  renderStudentMatch(q, answer) {
    const left = q.left || [];
    const right = q.right || [];
    const pairs = (answer && typeof answer === 'object') ? answer : {};
    const leftHtml = left.map((t, i) => `
      <div class="match-item match-left" data-match-left="${i}" data-qid="${q.id}">
        <span class="match-label">${i + 1}. ${escapeHtml(t)}</span>
        <button type="button" class="match-node" data-match-node="L${i}" aria-label="Match start"></button>
      </div>`).join('');
    const rightHtml = right.map((t, i) => `
      <div class="match-item match-right" data-match-right="${i}" data-qid="${q.id}">
        <button type="button" class="match-node" data-match-node="R${i}" aria-label="Match end"></button>
        <span class="match-label">${escapeHtml(t)}</span>
      </div>`).join('');
    const pairHints = left.map((_, i) => {
      const r = pairs[i] != null ? pairs[i] : pairs[String(i)];
      return r != null ? `<span class="match-pair-chip">A${i + 1}→B${Number(r) + 1}</span>` : '';
    }).join('');
    return `<div class="match-take vh-lock-inner" data-qid="${q.id}" data-type="match" id="match-take-${q.id}">
      <div class="match-prompt">${escapeHtml(q.prompt || 'Match Column A with Column B')}</div>
      <p class="match-instruction">Click an item in Column A, then click its pair in Column B to match.</p>
      <div class="match-board">
        <svg class="match-lines" id="match-svg-${q.id}"></svg>
        <div class="match-col match-col-a">${leftHtml}</div>
        <div class="match-col match-col-b">${rightHtml}</div>
      </div>
      <div class="match-pair-hints">${pairHints || '<span class="text-muted">Tap an item in A, then its match in B</span>'}</div>
    </div>`;
  },

  bindMatchTake(root, onChange) {
    if (!root) return;
    const qid = root.getAttribute('data-qid');
    let pending = null;
    const pairs = {};
    // restore
    root.querySelectorAll('.match-pair-chip').forEach(() => {});
    const redraw = () => {
      const svg = root.querySelector('.match-lines');
      if (!svg) return;
      const board = root.querySelector('.match-board');
      const br = board.getBoundingClientRect();
      svg.setAttribute('width', br.width);
      svg.setAttribute('height', br.height);
      svg.innerHTML = '';
      Object.keys(pairs).forEach(li => {
        const ri = pairs[li];
        const a = root.querySelector(`[data-match-node="L${li}"]`);
        const b = root.querySelector(`[data-match-node="R${ri}"]`);
        if (!a || !b) return;
        const ar = a.getBoundingClientRect();
        const bb = b.getBoundingClientRect();
        const x1 = ar.left + ar.width / 2 - br.left;
        const y1 = ar.top + ar.height / 2 - br.top;
        const x2 = bb.left + bb.width / 2 - br.left;
        const y2 = bb.top + bb.height / 2 - br.top;
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x1); line.setAttribute('y1', y1);
        line.setAttribute('x2', x2); line.setAttribute('y2', y2);
        line.setAttribute('stroke', 'currentColor');
        line.setAttribute('stroke-width', '2');
        svg.appendChild(line);
      });
      const hints = root.querySelector('.match-pair-hints');
      if (hints) {
        hints.innerHTML = Object.keys(pairs).length
          ? Object.keys(pairs).map(li => `<span class="match-pair-chip">A${Number(li) + 1}→B${Number(pairs[li]) + 1}</span>`).join('')
          : '<span class="text-muted">Tap an item in A, then its match in B</span>';
      }
      if (onChange) onChange({ ...pairs });
    };
    root.querySelectorAll('[data-match-left]').forEach(el => {
      el.onclick = (e) => {
        e.preventDefault();
        pending = Number(el.getAttribute('data-match-left'));
        root.querySelectorAll('.match-left').forEach(n => n.classList.remove('match-pending', 'selected'));
        el.classList.add('match-pending', 'selected');
        root.querySelectorAll('.match-item').forEach(x => x.classList.remove('pending'));
        el.classList.add('pending');
      };
    });
    root.querySelectorAll('[data-match-right]').forEach(el => {
      el.onclick = (e) => {
        e.preventDefault();
        if (pending == null) return;
        const ri = Number(el.getAttribute('data-match-right'));
        // remove existing use of this right
        Object.keys(pairs).forEach(k => { if (Number(pairs[k]) === ri) delete pairs[k]; });
        pairs[pending] = ri;
        pending = null;
        root.querySelectorAll('.match-item').forEach(x => x.classList.remove('pending'));
        redraw();
      };
    });
    // seed from existing answer chips text if needed — parent will set via data
    try {
      const prev = window._takeAnswers && window._takeAnswers[qid];
      if (prev && typeof prev === 'object') {
        Object.keys(prev).forEach(k => { pairs[k] = prev[k]; });
        redraw();
      }
    } catch (_) {}
    window.addEventListener('resize', redraw);
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

  renderStudentFill(q, answer) {
    // Centered fill-in-the-blank take UI
    const ans = (answer && typeof answer === 'object') ? answer : {};
    let html = '';
    if (Array.isArray(q.parts) && q.parts.length) {
      html = q.parts.map((s, si) => {
        if (s.kind === 'blank') {
          const id = s.id || String(si + 1);
          return `<input class="form-control fill-inline-input" data-qid="${q.id}" data-blank="${id}" value="${escapeHtml(ans[id]||'')}" placeholder="…" />`;
        }
        return `<span class="fill-inline-text">${escapeHtml(s.text||'')}</span>`;
      }).join(' ');
    } else {
      const tpl = q.template || q.prompt || '';
      let last = 0;
      const re = /\{\{(\d+)\}\}/g;
      let m;
      const chunks = [];
      while ((m = re.exec(tpl)) !== null) {
        if (m.index > last) chunks.push(`<span class="fill-inline-text">${escapeHtml(tpl.slice(last, m.index))}</span>`);
        const id = m[1];
        chunks.push(`<input class="form-control fill-inline-input" data-qid="${q.id}" data-blank="${id}" value="${escapeHtml(ans[id]||'')}" placeholder="…" />`);
        last = m.index + m[0].length;
      }
      if (last < tpl.length) chunks.push(`<span class="fill-inline-text">${escapeHtml(tpl.slice(last))}</span>`);
      html = chunks.join(' ') || escapeHtml(tpl);
    }
    return `<div class="fill-student-center" data-qid="${q.id}" data-type="fill">
      <div class="fill-student-inner">${html}</div>
    </div>`;
  },

  renderStudentCategorize(q, answer) {
    const cats = q.categories || [];
    const items = q.items || [];
    const ans = (answer && typeof answer === 'object') ? answer : {};
    const placed = new Set(Object.keys(ans));
    const leftItems = items.filter(it => !placed.has(it.id) && !placed.has(it.name));
    const chipHtml = (it, placedCls = '') => {
      const hasImg = it.image && String(it.image).startsWith('data:image');
      const body = hasImg
        ? `<img class="cat-chip-img" src="${escapeHtml(it.image)}" alt="${escapeHtml(it.name||'')}" draggable="false" /><span class="cat-chip-caption">${escapeHtml(it.name||'')}</span>`
        : `<span class="cat-chip-caption">${escapeHtml(it.name||'Item')}</span>`;
      return `<div class="cat-item-chip ${placedCls} ${hasImg ? 'has-img' : ''}" draggable="true" data-item-id="${escapeHtml(it.id)}" data-item-name="${escapeHtml(it.name||'')}">${body}</div>`;
    };
    const bank = leftItems.map(it => chipHtml(it)).join('');
    const cols = cats.map((c, ci) => {
      const inCat = items.filter(it => ans[it.id] === c.id || ans[it.name] === c.id || ans[it.id] === c.name);
      const cells = inCat.map(it => chipHtml(it, 'placed')).join('');
      return `<div class="cat-col" data-cat-id="${escapeHtml(c.id)}">
        <div class="cat-col-head" style="background:${['#3b82f6','#14b8a6','#f59e0b','#ef4444','#8b5cf6'][ci%5]}">${escapeHtml(c.name||'')}</div>
        <div class="cat-col-drop" data-cat-id="${escapeHtml(c.id)}">${cells || ''}</div>
      </div>`;
    }).join('');
    return `<div class="cat-student" data-qid="${q.id}">
      <p class="take-q-banner" style="margin-bottom:0.75rem">${escapeHtml(q.prompt||'')}</p>
      <div class="cat-student-layout">
        <div class="cat-options-panel"><div class="cat-options-title">Options (${leftItems.length})</div>${bank}</div>
        <div class="cat-board">${cols}</div>
      </div>
    </div>`;
  },

  renderStudentWordBoxSentence(q, answer) {
    let sentence = q.sentence || q.prompt || '';
    const ans = (answer && typeof answer === 'object') ? answer : {};
    // Support {Word} style from config: convert to {{1}}, {{2}} for blanks
    if (!/\{\{\d+\}\}/.test(sentence) && /\{[^{}]+\}/.test(sentence)) {
      let n = 0;
      sentence = sentence.replace(/\{([^{}]+)\}/g, () => {
        n += 1;
        return '{{' + n + '}}';
      });
    }
    const parts = [];
    let last = 0;
    const re = /\{\{(\d+)\}\}/g;
    let m;
    while ((m = re.exec(sentence)) !== null) {
      if (m.index > last) parts.push(`<span class="wb-text">${escapeHtml(sentence.slice(last, m.index))}</span>`);
      const bid = m[1];
      const filled = ans[bid] || ans['b'+bid] || '';
      parts.push(`<span class="wb-inline-drop ${filled ? 'filled' : ''}" data-qid="${q.id}" data-blank="${bid}" data-drop="1">${
        filled ? `<span class="wb-placed" draggable="true" data-word="${escapeHtml(filled)}">${escapeHtml(filled)}</span>` : '<span class="wb-placeholder">&nbsp;</span>'
      }</span>`);
      last = m.index + m[0].length;
    }
    if (last < sentence.length) parts.push(`<span class="wb-text">${escapeHtml(sentence.slice(last))}</span>`);
    return `<div class="wb-sentence-bar">${parts.join('') || escapeHtml(sentence)}</div>`;
  },

  renderStudentWordBox(q, answer) {
    const bank = (q.wordBank || []).filter(w => String(w || '').trim());
    const ans = (answer && typeof answer === 'object') ? answer : {};
    const bankTable = bank.map((w) =>
      `<div class="wb-chip wb-bank-cell" draggable="true" data-word="${escapeHtml(w)}">${escapeHtml(w)}</div>`
    ).join('') || '<span class="text-muted">No words</span>';
    const kids = Array.isArray(q.questions) && q.questions.length ? q.questions : null;
    let rightHtml;
    if (kids) {
      rightHtml = kids.map((kq) => {
        const ka = (ans && ans[kq.id] && typeof ans[kq.id] === 'object') ? ans[kq.id] : {};
        return `<div class="wb-child-q card" data-qid="${kq.id}">
          ${kq.prompt ? `<div class="wb-child-prompt">${escapeHtml(kq.prompt)}</div>` : ''}
          ${this.renderStudentWordBoxSentence({ ...kq, id: kq.id }, ka)}
        </div>`;
      }).join('');
    } else {
      rightHtml = this.renderStudentWordBoxSentence(q, ans) +
        '<p class="wb-hint">Drag a word into a blank, or tap a word then tap a blank</p>';
    }
    return `<div class="wb-student wb-dual" data-qid="${q.id}" data-type="wordbox">
      <div class="wb-dual-left">
        <div class="wb-bank-title">Word bank</div>
        <div class="wb-bank-table">${bankTable}</div>
      </div>
      <div class="wb-dual-right">${rightHtml}</div>
    </div>`;
  },

  renderStudentQuestion(q, answer) {
    if (q.type === 'wordbox') return this.renderStudentWordBox(q, answer);
    if (q.type === 'fill') return this.renderStudentFill(q, answer);
    if (q.type === 'categorize') return this.renderStudentCategorize(q, answer);
    if (q.type === 'table') return this.renderStudentTable(q, answer);
    if (q.type === 'match') return this.renderStudentMatch(q, answer);
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
              True</button>
            <button type="button" class="gq-option gq-student ${selected == 1 || selected === 'false' ? 'selected' : ''}"
              style="background:${OPTION_COLORS[3]}" data-qid="${q.id}" data-opt="1" data-multi="0">
              False</button>
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
      const caption = q.caption || 'Note: Open-ended scores may be adjusted by your instructor based on a personal assessment of your response, as open-ended answers may not be fully auto-graded on this portal.';
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
    if (!container) return answers;

    const ensureObj = (qid) => {
      if (!answers[qid] || typeof answers[qid] !== 'object' || Array.isArray(answers[qid])) answers[qid] = {};
      return answers[qid];
    };

    container.querySelectorAll('.take-options-grid[data-qid], .gq-block[data-qid], .q-card[data-qid]').forEach(card => {
      const qid = card.getAttribute('data-qid');
      if (!qid) return;
      const selected = [...card.querySelectorAll('.take-opt.selected, .gq-student.selected')];
      if (!selected.length) return;
      const multi = selected[0].getAttribute('data-multi') === '1';
      const choice = multi ? selected.map(s => Number(s.dataset.opt)) : Number(selected[0].dataset.opt);
      const mod = card.querySelector('[data-tf-mod]');
      answers[qid] = mod ? { choice, modified: mod.value } : choice;
    });

    container.querySelectorAll('.fill-inline-input, .fill-blank').forEach(inp => {
      const qid = inp.getAttribute('data-qid') || inp.closest('[data-qid]')?.getAttribute('data-qid');
      const blank = inp.getAttribute('data-blank');
      if (!qid || blank == null) return;
      const v = (inp.value || '').trim();
      if (v) ensureObj(qid)[blank] = v;
    });

    container.querySelectorAll('.tf-student-blank, .table-blank').forEach(inp => {
      const qid = inp.getAttribute('data-qid') || inp.closest('[data-qid]')?.getAttribute('data-qid');
      const key = inp.getAttribute('data-cell');
      if (!qid || key == null) return;
      const v = (inp.value || '').trim();
      if (v) ensureObj(qid)[key] = v;
    });

    container.querySelectorAll('.wb-inline-drop[data-blank]').forEach(z => {
      const blank = z.getAttribute('data-blank');
      if (blank == null) return;
      const placed = z.querySelector('.wb-placed');
      const word = (placed && (placed.getAttribute('data-word') || placed.textContent) || '').trim();
      if (!word) return;
      // Prefer explicit data-qid on the drop zone (child question id)
      let qid = z.getAttribute('data-qid');
      const childRoot = z.closest('.wb-child-q[data-qid]');
      const parentRoot = z.closest('.wb-student[data-qid], .wb-dual[data-qid]');
      if (!qid && childRoot) qid = childRoot.getAttribute('data-qid');
      if (!qid && parentRoot) qid = parentRoot.getAttribute('data-qid');
      if (!qid) return;
      ensureObj(qid)[blank] = word;
      // Also nest under parent wordbox id when this is a child sentence
      if (childRoot && parentRoot) {
        const parentId = parentRoot.getAttribute('data-qid');
        const childId = childRoot.getAttribute('data-qid');
        if (parentId && childId && parentId !== childId) {
          if (!answers[parentId] || typeof answers[parentId] !== 'object' || Array.isArray(answers[parentId])) answers[parentId] = {};
          if (!answers[parentId][childId] || typeof answers[parentId][childId] !== 'object') answers[parentId][childId] = {};
          answers[parentId][childId][blank] = word;
        }
      }
    });

    container.querySelectorAll('.cat-student[data-qid]').forEach(root => {
      const qid = root.getAttribute('data-qid');
      if (!qid) return;
      const map = {};
      root.querySelectorAll('.cat-col-drop').forEach(zone => {
        const cat = zone.getAttribute('data-cat-id');
        zone.querySelectorAll('.cat-item-chip').forEach(ch => {
          const id = ch.getAttribute('data-item-id');
          if (id) map[id] = cat;
        });
      });
      if (Object.keys(map).length) answers[qid] = map;
    });

    container.querySelectorAll('[data-essay]').forEach(el => {
      const qid = el.getAttribute('data-qid') || el.closest('[data-qid]')?.getAttribute('data-qid');
      if (qid && (el.value || '').trim()) answers[qid] = el.value;
    });

    return answers;
  },

  bindStudentMC(container, onChange) {
    if (!container) return;
    container.querySelectorAll('.gq-student, .gq-option.take-opt, button.gq-option').forEach(btn => {
      // strip check spans so they never stick
      const chk = btn.querySelector('.gq-student-check');
      if (chk) chk.remove();
      const multi = btn.getAttribute('data-multi') === '1';
      btn.setAttribute('role', multi ? 'checkbox' : 'radio');
      btn.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const card = btn.closest('[data-qid]') || btn.closest('.gq-block') || btn.closest('.q-card') || btn.parentElement;
        if (!card) return;
        if (!multi) {
          card.querySelectorAll('.gq-student, .gq-option').forEach(b => {
            b.classList.remove('selected');
            b.setAttribute('aria-checked', 'false');
          });
          btn.classList.add('selected');
          btn.setAttribute('aria-checked', 'true');
        } else {
          btn.classList.toggle('selected');
          btn.setAttribute('aria-checked', btn.classList.contains('selected') ? 'true' : 'false');
        }
        if (typeof onChange === 'function') onChange();
      };
    });
    container.querySelectorAll('[data-essay], textarea[data-qid]').forEach(ta => {
      ta.oninput = () => {
        const qid = ta.getAttribute('data-qid');
        const max = Number(ta.getAttribute('maxlength') || 1000);
        const counter = container.querySelector(`[data-count="${qid}"]`) || document.querySelector(`[data-count="${qid}"]`);
        if (counter) counter.textContent = String((ta.value || '').length);
        if (onChange) onChange();
      };
      // init count
      const qid = ta.getAttribute('data-qid');
      const counter = container.querySelector(`[data-count="${qid}"]`);
      if (counter) counter.textContent = String((ta.value || '').length);
    });
  },

  bindStudentTableCalc(root) {
    if (!root) return;
    const display = root.querySelector('#stu-calc-display') || root.querySelector('.tf-calc-display');
    if (!display) return;
    // Allow keyboard typing on display
    display.removeAttribute('readonly');
    display.setAttribute('inputmode', 'decimal');
    let expr = String(display.value || '0').replace(/[^0-9+\-*/().]/g, '') || '0';
    const setDisp = (v) => {
      expr = String(v).replace(/[^0-9+\-*/().]/g, '');
      display.value = expr || '0';
    };
    display.addEventListener('input', () => {
      const cleaned = display.value.replace(/[^0-9+\-*/().]/g, '');
      if (cleaned !== display.value) display.value = cleaned;
      expr = display.value || '0';
    });
    display.addEventListener('keypress', (e) => {
      if (!/[0-9+\-*/().]/.test(e.key) && e.key !== 'Enter') e.preventDefault();
    });
    const evalExpr = () => {
      try {
        const safe = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/[^0-9+\-*/().\s]/g, '');
        // eslint-disable-next-line no-new-func
        const n = Function('"use strict"; return (' + (safe || '0') + ')')();
        if (typeof n === 'number' && isFinite(n)) setDisp(String(n));
      } catch (_) {}
    };
    root.querySelectorAll('[data-stu-calc]').forEach(btn => {
      btn.type = 'button';
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const k = btn.getAttribute('data-stu-calc');
        if (k === 'C') { setDisp('0'); return; }
        if (k === 'Backspace' || k === '⌫') {
          setDisp(expr.length <= 1 ? '0' : expr.slice(0, -1));
          return;
        }
        if (k === '=') { evalExpr(); return; }
        if (k === 'Copy') {
          const val = display.value || '';
          try { navigator.clipboard.writeText(val); } catch (_) {}
          if (window.TableClipboard) TableClipboard.push(val);
          return;
        }
        if (expr === '0' && /[0-9.]/.test(k)) setDisp(k);
        else setDisp(expr + k);
      };
    });
    display.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); evalExpr(); }
    });
    // Clipboard history panel
    let hist = root.querySelector('.tf-clip-history');
    if (!hist) {
      hist = document.createElement('div');
      hist.className = 'tf-clip-history';
      hist.innerHTML = '<div class="tf-clip-title">Clipboard</div><div class="tf-clip-list"><span class="text-muted">Empty</span></div>';
      const panel = root.querySelector('#student-calc-panel') || root.querySelector('.table-fill-take-right') || root;
      panel.appendChild(hist);
    }
    window.TableClipboard = window.TableClipboard || {
      items: [],
      push(v) {
        v = String(v || '').trim();
        if (!v) return;
        this.items = [v, ...this.items.filter(x => x !== v)].slice(0, 8);
        document.querySelectorAll('.tf-clip-list').forEach(list => {
          list.innerHTML = this.items.map(x =>
            `<button type="button" class="tf-clip-item" data-clip="${String(x).replace(/"/g, '&quot;')}">${String(x).replace(/</g,'&lt;')}</button>`
          ).join('') || '<span class="text-muted">Empty</span>';
          list.querySelectorAll('.tf-clip-item').forEach(b => {
            b.onclick = () => {
              const val = b.getAttribute('data-clip') || b.textContent;
              try { navigator.clipboard.writeText(val); } catch (_) {}
              document.querySelectorAll('#stu-calc-display, .tf-calc-display').forEach(d => { d.value = val; });
            };
          });
        });
      }
    };
    // seed list
    window.TableClipboard.push('');
    // Paste into blanks allowed — context menu limited in app layer
  },

  bindWordBoxDrag(root, onChange) {
    if (!root) return;
    let dragWord = '';
    root.style.userSelect = 'none';
    const placeWord = (zone, word) => {
      if (!zone || !word) return;
      word = String(word).trim();
      if (!word) return;
      zone.classList.add('filled');
      zone.innerHTML = '';
      const span = document.createElement('span');
      span.className = 'wb-placed';
      span.setAttribute('draggable', 'true');
      span.setAttribute('data-word', word);
      span.textContent = word;
      span.style.cursor = 'grab';
      zone.appendChild(span);
      const startDrag = (ev) => {
        dragWord = word;
        try {
          ev.dataTransfer.setData('text/plain', word);
          ev.dataTransfer.effectAllowed = 'copyMove';
        } catch (_) {}
      };
      span.addEventListener('dragstart', startDrag);
      span.addEventListener('click', (e) => {
        e.stopPropagation();
        dragWord = word;
        root.querySelectorAll('.wb-chip').forEach(c => c.classList.remove('wb-selected'));
      });
      if (typeof onChange === 'function') onChange();
    };
    root.querySelectorAll('.wb-chip').forEach(chip => {
      chip.setAttribute('draggable', 'true');
      chip.style.cursor = 'grab';
      chip.style.touchAction = 'manipulation';
      chip.addEventListener('dragstart', (e) => {
        dragWord = (chip.getAttribute('data-word') || chip.textContent || '').trim();
        chip.style.cursor = 'grabbing';
        try {
          e.dataTransfer.setData('text/plain', dragWord);
          e.dataTransfer.effectAllowed = 'copyMove';
        } catch (_) {}
      });
      chip.addEventListener('dragend', () => { chip.style.cursor = 'grab'; });
      chip.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragWord = (chip.getAttribute('data-word') || chip.textContent || '').trim();
        root.querySelectorAll('.wb-chip').forEach(c => c.classList.remove('wb-selected'));
        chip.classList.add('wb-selected');
      });
    });
    root.querySelectorAll('.wb-drop-zone, .wb-inline-drop').forEach(zone => {
      zone.style.cursor = 'copy';
      zone.style.pointerEvents = 'auto';
      zone.addEventListener('dragenter', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
      zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        try { e.dataTransfer.dropEffect = 'copy'; } catch (_) {}
        zone.classList.add('drag-over');
      });
      zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
      zone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        zone.classList.remove('drag-over');
        let word = '';
        try { word = (e.dataTransfer.getData('text/plain') || '').trim(); } catch (_) {}
        if (!word) word = dragWord;
        if (!word) return;
        placeWord(zone, word);
        dragWord = '';
        root.querySelectorAll('.wb-chip').forEach(c => c.classList.remove('wb-selected'));
      });
      zone.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (dragWord) {
          placeWord(zone, dragWord);
          dragWord = '';
          root.querySelectorAll('.wb-chip').forEach(c => c.classList.remove('wb-selected'));
        } else if (zone.classList.contains('filled')) {
          zone.classList.remove('filled');
          zone.innerHTML = '<span class="wb-placeholder">&nbsp;</span>';
          if (typeof onChange === 'function') onChange();
        }
      });
    });
  },

  bindCategorizeDrag(root, onChange) {
    if (!root) return;
    let dragId = '', dragName = '';
    const placeItem = (zone, id, name) => {
      if (!zone || !id) return;
      // remove existing chip with same id from other zones / bank
      root.querySelectorAll('.cat-item-chip').forEach(ch => {
        if (ch.getAttribute('data-item-id') === id) ch.remove();
      });
      const chip = document.createElement('div');
      chip.className = 'cat-item-chip placed';
      chip.setAttribute('draggable', 'true');
      chip.setAttribute('data-item-id', id);
      chip.setAttribute('data-item-name', name || id);
      chip.textContent = name || id;
      zone.appendChild(chip);
      chip.addEventListener('dragstart', (e) => {
        dragId = id; dragName = name;
        try { e.dataTransfer.setData('text/plain', id); } catch (_) {}
      });
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        dragId = id; dragName = name;
        root.querySelectorAll('.cat-item-chip').forEach(c => c.classList.remove('wb-selected'));
        chip.classList.add('wb-selected');
      });
      onChange && onChange();
    };
    root.querySelectorAll('.cat-item-chip').forEach(chip => {
      chip.setAttribute('draggable', 'true');
      chip.style.cursor = 'grab';
      chip.style.touchAction = 'manipulation';
      chip.addEventListener('dragstart', (e) => {
        dragId = chip.getAttribute('data-item-id') || '';
        dragName = chip.getAttribute('data-item-name') || chip.textContent || '';
        try { e.dataTransfer.setData('text/plain', dragId); e.dataTransfer.effectAllowed = 'copy'; } catch (_) {}
      });
      chip.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragId = chip.getAttribute('data-item-id') || '';
        dragName = chip.getAttribute('data-item-name') || chip.textContent || '';
        root.querySelectorAll('.cat-item-chip').forEach(c => c.classList.remove('wb-selected'));
        chip.classList.add('wb-selected');
      });
    });
    root.querySelectorAll('.cat-col-drop').forEach(zone => {
      zone.style.cursor = 'copy';
      zone.style.pointerEvents = 'auto';
      zone.style.minHeight = '48px';
      zone.addEventListener('dragenter', (e) => { e.preventDefault(); });
      zone.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); try { e.dataTransfer.dropEffect = 'copy'; } catch(_){} zone.classList.add('drag-over'); });
      zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
      zone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        zone.classList.remove('drag-over');
        const id = (e.dataTransfer.getData('text/plain') || dragId || '').trim();
        if (!id) return;
        const chip = root.querySelector('.cat-item-chip[data-item-id="' + String(id).replace(/"/g, '') + '"]');
        const name = (chip && chip.getAttribute('data-item-name')) || dragName || id;
        placeItem(zone, id, name);
        dragId = ''; dragName = '';
      });
      zone.addEventListener('click', (e) => {
        if (!dragId) return;
        e.preventDefault();
        e.stopPropagation();
        placeItem(zone, dragId, dragName);
        dragId = ''; dragName = '';
        root.querySelectorAll('.cat-item-chip').forEach(c => c.classList.remove('wb-selected'));
      });
    });
  },


  /** Flatten sections/questions into a single ordered list of question objects */
  flattenQuestions(exam) {
    if (!exam) return [];
    const out = [];
    const seen = new Set();
    const push = (q) => {
      if (!q || typeof q !== 'object') return;
      const id = q.id || JSON.stringify(q).slice(0, 40);
      if (seen.has(id)) return;
      seen.add(id);
      out.push(q);
    };
    if (Array.isArray(exam.sections) && exam.sections.length) {
      exam.sections.forEach(sec => {
        (sec.questions || []).forEach(push);
      });
    }
    if (Array.isArray(exam.questions) && exam.questions.length) {
      exam.questions.forEach(push);
    }
    return out;
  },

  /**
   * Group questions for the student take UI.
   * Passage blocks become one group with nested questions.
   */
  groupQuestionsForTake(exam) {
    const groups = [];
    const pushQ = (q, sec) => {
      if (!q) return;
      const meta = {
        sectionTitle: sec?.title || '',
        sectionInstructions: sec?.instructions || '',
        sectionId: sec?.id || ''
      };
      if (q.type === 'passage' || q.isPassageSet) {
        groups.push({
          kind: 'passage',
          passage: q,
          questions: Array.isArray(q.questions) ? q.questions : [],
          ...meta
        });
      } else {
        groups.push({ kind: 'single', question: q, ...meta });
      }
    };
    if (exam && Array.isArray(exam.sections) && exam.sections.length) {
      exam.sections.forEach(sec => {
        (sec.questions || []).forEach(q => pushQ(q, sec));
      });
    } else {
      (this.flattenQuestions(exam) || []).forEach(q => pushQ(q, null));
    }
    return groups;
  },

};

window.Regular = Regular;
window.QUESTION_TYPES = QUESTION_TYPES;
