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
        <label>Total points <input type="number" min="0" step="0.5" class="form-control points-input" data-points="${index}" value="${q.points ?? 1}" style="width:70px;display:inline-block"/></label>
        <label class="ml-1">Points per blank <input type="number" min="0" step="0.5" class="form-control" data-points-each="${index}" value="${q.pointsPerItem ?? q.pointsPerBlank ?? ''}" placeholder="auto" style="width:70px;display:inline-block"/></label>
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
        <label>Total points <input type="number" min="0" step="0.5" class="form-control points-input" data-points="${index}" value="${q.points ?? 1}" style="width:70px;display:inline-block"/></label>
        <label>Points per blank <input type="number" min="0" step="0.5" class="form-control" data-points-each="${index}" value="${q.pointsPerItem ?? ''}" placeholder="auto" style="width:70px;display:inline-block"/></label>
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
          ${it.image ? 'Replace image' : 'Image'}
          <input type="file" accept="image/*" data-cat-item-img="${index}:${ii}" hidden />
        </label>
        ${it.image ? `<button type="button" class="btn btn-sm btn-ghost" data-cat-item-del-img="${index}:${ii}">Remove image</button>` : ''}
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
        <label>Total points <input type="number" min="0" step="0.5" class="form-control points-input" data-points="${index}" value="${q.points ?? 1}" style="width:70px;display:inline-block"/></label>
        <label>Points per item <input type="number" min="0" step="0.5" class="form-control" data-points-each="${index}" value="${q.pointsPerItem ?? ''}" placeholder="auto" style="width:70px;display:inline-block"/></label>
      </div>
    </div>`;
  },


  renderBuilderTable(q, index) {
    const rows = Math.min(20, Math.max(1, Number(q.rows) || 3));
    const cols = Math.min(10, Math.max(1, Number(q.cols) || 3));
    q.cells = q.cells || {};
    let blankCount = 0;
    Object.keys(q.cells).forEach(k => { if (q.cells[k] && q.cells[k].blank) blankCount++; });
    let grid = '<table class="table-fill-cfg"><thead><tr><th></th>';
    for (let c = 0; c < cols; c++) {
      const h = (q.headers && q.headers[c]) || ('Col ' + (c + 1));
      grid += `<th><input class="form-control" data-tf-header="${index}:${c}" value="${escapeHtml(h)}" /></th>`;
    }
    grid += '</tr></thead><tbody>';
    for (let r = 0; r < rows; r++) {
      grid += `<tr><th>${r + 1}</th>`;
      for (let c = 0; c < cols; c++) {
        const key = r + '-' + c;
        const cell = q.cells[key] || {};
        const isBlank = !!cell.blank;
        const val = isBlank ? (Array.isArray(cell.correct) ? cell.correct[0] : (cell.correct || '')) : (cell.value || '');
        const alts = isBlank ? (Array.isArray(cell.correct) && cell.correct.length > 1 ? cell.correct.slice(1) : (cell.alternatives || [])) : [];
        grid += `<td class="${isBlank ? 'is-blank' : ''}">
          <label class="tf-blank-toggle"><input type="checkbox" data-tf-blank="${index}:${key}" ${isBlank ? 'checked' : ''}/> Blank</label>
          <input class="form-control" data-tf-cell="${index}:${key}" value="${escapeHtml(String(val || ''))}" placeholder="${isBlank ? 'Correct answer' : 'Cell text'}" />
          ${isBlank ? `<input class="form-control mt-1" data-tf-alt="${index}:${key}" value="${escapeHtml((alts || []).join(', '))}" placeholder="Alternatives" />` : ''}
        </td>`;
      }
      grid += '</tr>';
    }
    grid += '</tbody></table>';
    return `<div class="table-fill-dual" data-gidx="${index}">
      <div class="table-fill-left">
        <label class="text-muted" style="font-size:0.8rem">Instruction (shown as first merged row of the table)</label>
        <textarea class="form-control q-prompt" data-gidx="${index}" rows="2" placeholder="Instructions for students — appears as top row spanning all columns">${escapeHtml(q.prompt || '')}</textarea>
        <div class="form-group mt-1" style="display:flex;gap:0.5rem;flex-wrap:wrap">
          <label>Rows <input type="number" min="1" max="20" class="form-control" style="width:70px" data-tf-rows="${index}" value="${rows}" /></label>
          <label>Cols <input type="number" min="1" max="10" class="form-control" style="width:70px" data-tf-cols="${index}" value="${cols}" /></label>
          <button type="button" class="btn btn-sm btn-ghost" data-tf-resize="${index}">Apply size</button>
          <span class="text-muted" style="font-size:0.8rem">Blanks: ${blankCount}/50</span>
        </div>
        <div class="table-fill-scroll">${grid}</div>
        <div class="points-row mt-1" style="display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center">
          <label>Scoring
            <select class="form-control" data-pointsmode="${index}" style="width:auto;display:inline-block">
              <option value="all" ${(q.pointsMode || 'all') === 'all' ? 'selected' : ''}>Full points only if all blanks correct</option>
              <option value="each" ${q.pointsMode === 'each' ? 'selected' : ''}>Points for every correct blank</option>
            </select>
          </label>
          <label>Total points <input type="number" min="0" step="0.5" class="form-control points-input" data-points="${index}" value="${q.points ?? 1}" style="width:70px;display:inline-block"/></label>
          <label class="tf-each-pts" style="${(q.pointsMode || 'all') === 'each' ? '' : 'opacity:0.5'}">Points per blank <input type="number" min="0" step="0.5" class="form-control" data-points-each="${index}" value="${q.pointsPerItem ?? ''}" placeholder="auto" style="width:70px;display:inline-block"/></label>
        </div>
      </div>
      <div class="table-fill-right" id="tf-calc-panel-${index}">
        <div class="tf-calc-head">
          <strong>Calculator</strong>
          <button type="button" class="btn btn-sm btn-ghost" data-tf-calc-toggle="${index}" title="Collapse">⌄</button>
        </div>
        <div class="tf-calculator">
          <input class="form-control tf-calc-display" data-tf-calc-display="${index}" readonly value="0" />
          <div class="tf-calc-keys">
            ${['7','8','9','/','4','5','6','*','1','2','3','-','0','.','=','+','C','⌫','Copy'].map(k =>
              `<button type="button" class="btn btn-sm btn-ghost tf-calc-key" data-tf-calc-key="${index}:${k}">${k}</button>`
            ).join('')}
          </div>
        </div>
      </div>
    </div>`;
  },

  renderStudentTable(q, answer) {
    const rows = Number(q.rows) || 3;
    const cols = Number(q.cols) || 3;
    const cells = q.cells || {};
    const ans = (answer && typeof answer === 'object') ? answer : {};
    const instr = q.prompt || 'Fill in the blank cells.';
    let grid = '<table class="table-fill-student table-fill-grid"><thead>';
    // Instruction row: merge all columns
    grid += `<tr class="tf-instr-row"><td colspan="${cols + 1}">${escapeHtml(instr)}</td></tr>`;
    grid += '<tr class="tf-header-row"><th class="tf-corner"></th>';
    for (let c = 0; c < cols; c++) {
      grid += `<th>${escapeHtml((q.headers && q.headers[c]) || ('Col ' + (c + 1)))}</th>`;
    }
    grid += '</tr></thead><tbody>';
    for (let r = 0; r < rows; r++) {
      grid += `<tr><th class="tf-row-h">${r + 1}</th>`;
      for (let c = 0; c < cols; c++) {
        const key = r + '-' + c;
        const cell = cells[key] || {};
        if (cell.blank) {
          grid += `<td class="tf-cell tf-blank"><input class="tf-student-blank" data-qid="${q.id}" data-cell="${key}" value="${escapeHtml(ans[key] || '')}" /></td>`;
        } else {
          grid += `<td class="tf-cell tf-fixed">${escapeHtml(cell.value || '')}</td>`;
        }
      }
      grid += '</tr>';
    }
    grid += '</tbody></table>';
    return `<div class="table-fill-take" data-qid="${q.id}" data-table-fill="1">
      <div class="table-fill-take-left">
        <div class="table-fill-scroll table-fill-center">${grid}</div>
      </div>
      <aside class="table-fill-take-right" id="student-calc-panel">
        <button type="button" class="btn btn-sm btn-ghost calc-collapse-btn" id="calc-collapse-btn" title="Calculator">计算器</button>
        <div class="tf-calculator tf-calc-pro" id="student-calculator">
          <div class="tf-calc-title">Calculator</div>
          <input class="form-control tf-calc-display" id="stu-calc-display" readonly value="0" />
          <div class="tf-calc-keys">
            ${['7','8','9','÷','4','5','6','×','1','2','3','−','0','.','=','+','C','⌫','Copy'].map(k =>
              `<button type="button" class="tf-calc-key" data-stu-calc="${k === '÷' ? '/' : k === '×' ? '*' : k === '−' ? '-' : k}">${k}</button>`
            ).join('')}
          </div>
          <p class="tf-calc-hint">Copy/paste with table is allowed</p>
        </div>
      </aside>
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
    const keyRows = left.map((_, i) => {
      const opts = right.map((t, j) => `<option value="${j}" ${Number(correct[i]) === j ? 'selected' : ''}>${escapeHtml(t || ('B' + (j + 1)))}</option>`).join('');
      return `<div class="form-group"><label>A${i + 1} → <select class="form-control" data-match-key="${index}:${i}">${opts}</select></label></div>`;
    }).join('');
    return `<div class="match-builder" data-gidx="${index}">
      <textarea class="form-control q-prompt" data-gidx="${index}" rows="2" placeholder="Instructions (e.g. Match Column A with Column B)">${escapeHtml(q.prompt || '')}</textarea>
      <p class="text-muted" style="font-size:0.8rem">1 point per correct pair. Set answer key below.</p>
      <div class="match-cfg-cols">
        <div><strong>Column A</strong>${leftRows}
          <button type="button" class="btn btn-sm btn-ghost" data-match-add-left="${index}">+ Add A</button></div>
        <div><strong>Column B</strong>${rightRows}
          <button type="button" class="btn btn-sm btn-ghost" data-match-add-right="${index}">+ Add B</button></div>
      </div>
      <div class="match-key mt-1"><strong>Answer key</strong>${keyRows}</div>
      <div class="points-row mt-1"><label>Points (total if all correct, or leave auto = 1×pairs)
        <input type="number" min="0" step="0.5" class="form-control points-input" data-points="${index}" value="${q.points != null ? q.points : left.length}" style="width:80px;display:inline-block"/></label>
      </div>
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
      const caption = q.caption || 'Note: Open-ended scores may be adjusted by your teacher based on a personal assessment of your response, as open-ended answers may not be fully auto-graded on this portal.';
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
        const itemPts = (q.pointsPerItem != null && q.pointsPerItem !== '') ? Number(q.pointsPerItem) : (pts / n);
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
        const itemPts = (q.pointsPerItem != null && q.pointsPerItem !== '') ? Number(q.pointsPerItem) : (pts / n);
        total -= pts;
        items.forEach(it => {
          total += itemPts;
          const got = a && (a[it.id] || a[it.name]);
          if (got && (got === it.category || got === (q.categories||[]).find(c=>c.id===it.category)?.name)) earned += itemPts;
        });
        return;
      }
      if (q.type === 'table') {
        const cells = q.cells || {};
        const blanks = Object.keys(cells).filter(k => cells[k] && cells[k].blank);
        const n = blanks.length || 1;
        const mode = q.pointsMode || 'all';
        const itemPts = (q.pointsPerItem != null && q.pointsPerItem !== '')
          ? Number(q.pointsPerItem)
          : (n ? pts / n : pts);
        let correctCount = 0;
        blanks.forEach(key => {
          const cell = cells[key];
          const got = String((a && a[key]) || '').trim().toLowerCase();
          if (!got) return;
          let corrects = [];
          if (Array.isArray(cell.correct)) corrects = cell.correct;
          else corrects = [cell.correct, ...(cell.alternatives || [])];
          const okList = corrects.map(x => String(x || '').trim().toLowerCase()).filter(Boolean);
          if (okList.includes(got)) correctCount++;
        });
        if (mode === 'each') {
          // Replace default full-question pts with sum of per-blank awards
          total -= pts;
          total += itemPts * n;
          earned += itemPts * correctCount;
        } else {
          // Full points only if every blank is correct
          if (n > 0 && correctCount === n) earned += pts;
        }
        return;
      }
      if (q.type === 'match') {
        const left = q.left || [];
        const key = Array.isArray(q.correct) ? q.correct : left.map((_, i) => i);
        const pairPts = 1;
        const maxPairs = left.length;
        total -= pts;
        total += pairPts * maxPairs;
        let hits = 0;
        left.forEach((_, i) => {
          const got = a != null ? (a[i] != null ? a[i] : a[String(i)]) : null;
          if (got != null && Number(got) === Number(key[i])) hits++;
        });
        earned += pairPts * hits;
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
    const tf = container.querySelector('.table-fill-take, [data-table-fill="1"]');
    if (tf) {
      const qid = tf.getAttribute('data-qid');
      const map = {};
      tf.querySelectorAll('.tf-student-blank').forEach(inp => {
        const key = inp.getAttribute('data-cell');
        if (key) map[key] = (inp.value || '').trim();
      });
      if (qid) answers[qid] = map;
      return answers;
    }
    container.querySelectorAll('textarea[data-qid], input[data-qid], select[data-qid]').forEach(el => {
      const qid = el.getAttribute('data-qid');
      if (qid) answers[qid] = el.value;
    });
    // Multiple choice / TF gamified cards
    container.querySelectorAll('.gq-block[data-qid], .q-card[data-qid][data-type="multiple"], .q-card[data-qid][data-type="truefalse"]').forEach(card => {
      const qid = card.getAttribute('data-qid');
      if (!qid) return;
      const multi = card.querySelector('.gq-student')?.getAttribute('data-multi') === '1';
      const selected = [...card.querySelectorAll('.gq-student.selected')].map(b => Number(b.getAttribute('data-opt')));
      if (multi) answers[qid] = selected;
      else if (selected.length) answers[qid] = selected[0];
    });
    return answers;
  },

  bindWordBoxDrag(root, onChange) {
    if (!root) return;
    let dragWord = '';
    const placeWord = (zone, word) => {
      if (!zone || !word) return;
      zone.classList.add('filled');
      zone.innerHTML = '';
      const span = document.createElement('span');
      span.className = 'wb-placed';
      span.setAttribute('draggable', 'true');
      span.setAttribute('data-word', word);
      span.textContent = word;
      zone.appendChild(span);
      // allow dragging placed word again
      span.addEventListener('dragstart', (ev) => {
        dragWord = word;
        try { ev.dataTransfer.setData('text/plain', word); } catch (_) {}
      });
      span.addEventListener('click', () => { dragWord = word; });
      onChange && onChange();
    };
    root.querySelectorAll('.wb-chip, .wb-placed').forEach(chip => {
      chip.setAttribute('draggable', 'true');
      chip.style.touchAction = 'none';
      chip.addEventListener('dragstart', (e) => {
        dragWord = chip.getAttribute('data-word') || chip.textContent || '';
        try { e.dataTransfer.setData('text/plain', dragWord); e.dataTransfer.effectAllowed = 'copy'; } catch (_) {}
      });
      // Mobile: tap chip then tap blank
      chip.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragWord = chip.getAttribute('data-word') || chip.textContent || '';
        root.querySelectorAll('.wb-chip').forEach(c => c.classList.remove('wb-selected'));
        chip.classList.add('wb-selected');
      });
    });
    root.querySelectorAll('.wb-drop-zone, .wb-inline-drop').forEach(zone => {
      zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
      zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
      zone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        zone.classList.remove('drag-over');
        const word = (e.dataTransfer.getData('text/plain') || dragWord || '').trim();
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
          // clear on second click without selection
          zone.classList.remove('filled');
          zone.innerHTML = '<span class="wb-placeholder">&nbsp;</span>';
          onChange && onChange();
        }
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
      chip.style.touchAction = 'none';
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
      zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
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

};

window.Regular = Regular;
window.QUESTION_TYPES = QUESTION_TYPES;
