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
    const sentence = q.sentence || '';
    const rows = Number(q.wordBankRows) || 2;
    const cols = Number(q.wordBankCols) || 2;
    let bank = q.wordBank || [];
    while (bank.length < rows * cols) bank.push('');
    bank = bank.slice(0, rows * cols);
    // Visual sentence with rectangle blanks
    let vis = '';
    let last = 0;
    const re = /\{\{(\d+)\}\}/g;
    let m;
    while ((m = re.exec(sentence)) !== null) {
      if (m.index > last) vis += `<span class="wb-cfg-text">${escapeHtml(sentence.slice(last, m.index))}</span>`;
      const bid = m[1];
      const blank = (q.blanks || []).find(b => String(b.id) === String(bid));
      const filled = blank && blank.correct ? escapeHtml(blank.correct) : '';
      vis += `<span class="wb-cfg-blank ${filled ? 'filled' : ''}" data-wb-drop-blank="${index}:${bid}" data-blank-id="${bid}">${filled || '&nbsp;'}</span>`;
      last = m.index + m[0].length;
    }
    if (last < sentence.length) vis += `<span class="wb-cfg-text">${escapeHtml(sentence.slice(last))}</span>`;
    if (!sentence) vis = '<span class="text-muted">Type the sentence below, then use Insert blank</span>';

    let cells = '';
    for (let i = 0; i < rows * cols; i++) {
      cells += `<div class="wb-cfg-chip" draggable="true" data-wb-chip="${index}:${i}" data-word="${escapeHtml(bank[i] || '')}">
        <input class="form-control" data-wb-bank="${index}:${i}" value="${escapeHtml(bank[i] || '')}" placeholder="Word ${i+1}" onclick="event.stopPropagation()" />
      </div>`;
    }
    const blankCfg = (q.blanks || []).map((b, bi) => `
      <div class="mt-1" style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center">
        <span class="text-muted">Blank {{${escapeHtml(String(b.id))}}}</span>
        <input class="form-control" style="max-width:180px" data-wb-blank-correct="${index}:${bi}" value="${escapeHtml(b.correct||'')}" placeholder="Correct" />
        <input class="form-control" style="max-width:200px" data-wb-blank-alt="${index}:${bi}" value="${escapeHtml((b.alternatives||[]).join(', '))}" placeholder="Alternatives" />
        <button type="button" class="btn btn-sm btn-danger" data-wb-del-blank="${index}:${bi}">×</button>
      </div>`).join('');

    return `<div class="builder-wordbox" data-gidx="${index}">
      <div class="wb-cfg-preview">${vis}</div>
      <label class="mt-1">Sentence text (blanks appear as boxes above)</label>
      <textarea class="form-control" data-wb-sentence="${index}" rows="2">${escapeHtml(sentence)}</textarea>
      <div class="action-btns mt-1">
        <button type="button" class="btn btn-sm btn-primary" data-wb-insert-blank="${index}">+ Insert blank</button>
      </div>
      <div class="form-group mt-1" style="display:flex;gap:0.75rem;flex-wrap:wrap;align-items:end">
        <label>Rows <input type="number" min="1" max="8" class="form-control" style="width:70px" data-wb-rows="${index}" value="${rows}" /></label>
        <label>Columns <input type="number" min="1" max="6" class="form-control" style="width:70px" data-wb-cols="${index}" value="${cols}" /></label>
        <button type="button" class="btn btn-sm btn-ghost" data-wb-resize="${index}">Apply grid</button>
      </div>
      <label>Word bank — drag a word onto a blank above</label>
      <div class="wb-cfg-bank" style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:0.4rem">${cells}</div>
      <div class="mt-1"><strong>Blank answers</strong></div>
      ${blankCfg || '<p class="text-muted">Insert blanks first</p>'}
      <div class="points-row mt-1">
        <label>Points <input type="number" min="0" step="0.5" class="form-control points-input" data-points="${index}" value="${q.points ?? 1}" style="width:70px;display:inline-block"/></label>
      </div>
    </div>`;
  },

  renderBuilderFill(q, index) {
    const sentence = q.sentence || q.template || '';
    let vis = '';
    let last = 0;
    const re = /\{\{(\d+)\}\}/g;
    let m;
    while ((m = re.exec(sentence)) !== null) {
      if (m.index > last) vis += `<span class="wb-cfg-text">${escapeHtml(sentence.slice(last, m.index))}</span>`;
      const bid = m[1];
      const blank = (q.blanks || []).find(b => String(b.id) === String(bid));
      const filled = blank && blank.correct ? escapeHtml(String(Array.isArray(blank.correct) ? blank.correct[0] : blank.correct)) : '';
      vis += `<span class="wb-cfg-blank fill-blank ${filled ? 'filled' : ''}">${filled || '____'}</span>`;
      last = m.index + m[0].length;
    }
    if (last < sentence.length) vis += `<span class="wb-cfg-text">${escapeHtml(sentence.slice(last))}</span>`;
    const blankCfg = (q.blanks || []).map((b, bi) => {
      const corr = Array.isArray(b.correct) ? b.correct[0] : (b.correct || '');
      const alts = Array.isArray(b.correct) && b.correct.length > 1 ? b.correct.slice(1) : (b.alternatives || []);
      return `<div class="mt-1" style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center">
        <span class="text-muted">Blank {{${escapeHtml(String(b.id))}}}</span>
        <input class="form-control" style="max-width:180px" data-fill-correct="${index}:${bi}" value="${escapeHtml(String(corr))}" placeholder="Correct answer" />
        <input class="form-control" style="max-width:200px" data-fill-alt="${index}:${bi}" value="${escapeHtml((alts||[]).join(', '))}" placeholder="Alternatives" />
        <button type="button" class="btn btn-sm btn-danger" data-fill-del="${index}:${bi}">×</button>
      </div>`;
    }).join('');
    return `<div class="builder-fill" data-gidx="${index}">
      <div class="wb-cfg-preview">${vis || '<span class="text-muted">Type sentence with blanks</span>'}</div>
      <label>Sentence (use Insert blank for open-ended blanks — no word bank)</label>
      <textarea class="form-control" data-fill-sentence="${index}" rows="2">${escapeHtml(sentence)}</textarea>
      <button type="button" class="btn btn-sm btn-primary mt-1" data-fill-insert="${index}">+ Insert blank</button>
      <div class="mt-1"><strong>Correct answers</strong></div>
      ${blankCfg || '<p class="text-muted">Insert blanks first</p>'}
      <div class="points-row mt-1">
        <label>Points <input type="number" min="0" step="0.5" class="form-control points-input" data-points="${index}" value="${q.points ?? 1}" style="width:70px;display:inline-block"/></label>
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
          <button type="button" class="btn btn-sm btn-danger" data-pass-del-opt="${index}:${ki}:${oi}">×</button>
        </div>`).join('');
      return `<div class="card mt-1" style="padding:0.75rem">
        <input class="form-control" data-pass-q-prompt="${index}:${ki}" value="${escapeHtml(kq.prompt||'')}" placeholder="Question prompt" />
        <select class="form-control mt-1" data-pass-q-type="${index}:${ki}">
          <option value="multiple" ${isMc?'selected':''}>Multiple Choice</option>
          <option value="essay" ${kq.type==='essay'?'selected':''}>Open-Ended Text</option>
        </select>
        ${isMc ? `<div class="mt-1">${opts}<button type="button" class="btn btn-sm btn-ghost" data-pass-add-opt="${index}:${ki}">+ Add Option</button></div>`
          : `<textarea class="form-control mt-1" data-pass-rubric="${index}:${ki}" rows="2" placeholder="Suggested answer / rubric">${escapeHtml(kq.correct||kq.rubric||'')}</textarea>`}
        <button type="button" class="btn btn-sm btn-danger mt-1" data-pass-del-q="${index}:${ki}">Delete Question</button>
      </div>`;
    }).join('');
    return `<div class="passage-dual" data-gidx="${index}">
      <div class="passage-dual-left">
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
        <div class="rte-editor" contenteditable="true" data-pass-html="${index}">${html}</div>
      </div>
      <div class="passage-dual-right">
        <button type="button" class="btn btn-primary" data-pass-add-q="${index}">+ Add New Question</button>
        <div class="pass-q-list">${qCards}</div>
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
          <button type="button" class="btn btn-sm btn-danger" data-cat-del="${index}:${ci}">×</button>
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
          Image
          <input type="file" accept="image/*" data-cat-item-img="${index}:${ii}" hidden />
        </label>
        <button type="button" class="btn btn-sm btn-danger" data-cat-item-del="${index}:${ii}">×</button>
      </div>`).join('');
    return `<div class="categorize-dual" data-gidx="${index}">
      <div class="form-group">
        <label>Prompt</label>
        <input class="form-control q-prompt" data-gidx="${index}" value="${escapeHtml(q.prompt||'')}" placeholder="Organize these items into the right categories." />
      </div>
      <div class="cat-board">${catCols || '<p class="text-muted">Add categories</p>'}</div>
      <div class="action-btns mt-1" style="flex-wrap:wrap;gap:0.5rem">
        <button type="button" class="btn btn-sm btn-primary" data-cat-add="${index}">+ Add Category</button>
        <button type="button" class="btn btn-sm btn-primary" data-cat-add-item="${index}">+ Add Item</button>
      </div>
      <div class="mt-1"><strong>Items & answer key</strong> <span class="text-muted" style="font-size:0.8rem">(name + correct category; optional image)</span></div>
      ${itemRows || '<p class="text-muted">Click “+ Add Item”, then set the name and category.</p>'}
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

  renderStudentFill(q, answer) {
    const sentence = q.sentence || q.template || '';
    const ans = (answer && typeof answer === 'object') ? answer : {};
    let parts = [];
    let last = 0;
    const re = /\{\{(\d+)\}\}/g;
    let m;
    while ((m = re.exec(sentence)) !== null) {
      if (m.index > last) parts.push(`<span class="wb-text">${escapeHtml(sentence.slice(last, m.index))}</span>`);
      const bid = m[1];
      const val = ans[bid] || '';
      parts.push(`<input class="wb-fill-input" data-qid="${q.id}" data-blank="${bid}" value="${escapeHtml(val)}" placeholder="…" />`);
      last = m.index + m[0].length;
    }
    if (last < sentence.length) parts.push(`<span class="wb-text">${escapeHtml(sentence.slice(last))}</span>`);
    return `<div class="wb-student wb-inline fill-student" data-qid="${q.id}">
      <div class="wb-sentence-bar">${parts.join('')}</div>
    </div>`;
  },

  renderStudentCategorize(q, answer) {
    const cats = q.categories || [];
    const items = q.items || [];
    const ans = (answer && typeof answer === 'object') ? answer : {};
    // placed item ids per category
    const placed = new Set(Object.keys(ans));
    const leftItems = items.filter(it => !placed.has(it.id) && !placed.has(it.name));
    const bank = leftItems.map(it =>
      `<div class="cat-item-chip" draggable="true" data-item-id="${escapeHtml(it.id)}" data-item-name="${escapeHtml(it.name||'')}">${escapeHtml(it.name||'')}</div>`
    ).join('');
    const cols = cats.map((c, ci) => {
      const inCat = items.filter(it => ans[it.id] === c.id || ans[it.name] === c.id || ans[it.id] === c.name);
      const cells = inCat.map(it =>
        `<div class="cat-item-chip placed" draggable="true" data-item-id="${escapeHtml(it.id)}" data-item-name="${escapeHtml(it.name||'')}">${escapeHtml(it.name||'')}</div>`
      ).join('');
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
    if (q.type === 'fill') return this.renderStudentFill(q, answer);
    if (q.type === 'categorize') return this.renderStudentCategorize(q, answer);
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
      if (q.type === 'wordbox' || q.type === 'fill') {
        const blanks = q.blanks || [];
        const n = blanks.length || 1;
        const itemPts = pts / n;
        total -= pts;
        blanks.forEach(b => {
          total += itemPts;
          const got = String((a && (a[b.id] || a['b'+b.id])) || '').trim().toLowerCase();
          if (!got) return;
          let corrects = [];
          if (Array.isArray(b.correct)) corrects = b.correct;
          else corrects = [b.correct, ...(b.alternatives || [])];
          const okList = corrects.map(x => String(x || '').trim().toLowerCase()).filter(Boolean);
          if (okList.includes(got)) earned += itemPts;
        });
        return;
      }
      if (q.type === 'categorize') {
        const items = q.items || [];
        const n = items.length || 1;
        const itemPts = pts / n;
        total -= pts;
        items.forEach(it => {
          total += itemPts;
          const got = a && (a[it.id] || a[it.name]);
          if (got && (got === it.category || got === (q.categories||[]).find(c=>c.id===it.category)?.name)) earned += itemPts;
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
      wb.querySelectorAll('.wb-fill-input').forEach(inp => {
        const item = inp.getAttribute('data-blank');
        if (item) map[item] = (inp.value || '').trim();
      });
      if (qid) answers[qid] = map;
      return answers;
    }
    const cat = container.querySelector('.cat-student');
    if (cat) {
      const qid = cat.getAttribute('data-qid');
      const map = {};
      cat.querySelectorAll('.cat-col-drop .cat-item-chip').forEach(chip => {
        const id = chip.getAttribute('data-item-id');
        const catId = chip.closest('[data-cat-id]')?.getAttribute('data-cat-id');
        if (id && catId) map[id] = catId;
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

  bindCategorizeDrag(root, onChange) {
    if (!root) return;
    let dragId = '', dragName = '';
    root.querySelectorAll('.cat-item-chip').forEach(chip => {
      chip.setAttribute('draggable', 'true');
      chip.addEventListener('dragstart', (e) => {
        dragId = chip.getAttribute('data-item-id') || '';
        dragName = chip.getAttribute('data-item-name') || chip.textContent || '';
        e.dataTransfer.setData('text/plain', dragId);
      });
    });
    root.querySelectorAll('.cat-col-drop').forEach(zone => {
      zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
      zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
      zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        const id = e.dataTransfer.getData('text/plain') || dragId;
        if (!id) return;
        const chip = root.querySelector(`.cat-item-chip[data-item-id="${CSS.escape(id)}"]`);
        if (chip) zone.appendChild(chip);
        onChange && onChange();
      });
    });
    const bank = root.querySelector('.cat-options-panel');
    if (bank) {
      bank.addEventListener('dragover', (e) => e.preventDefault());
      bank.addEventListener('drop', (e) => {
        e.preventDefault();
        const id = e.dataTransfer.getData('text/plain') || dragId;
        const chip = root.querySelector(`.cat-item-chip[data-item-id="${CSS.escape(id)}"]`);
        if (chip) bank.appendChild(chip);
        onChange && onChange();
      });
    }
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
