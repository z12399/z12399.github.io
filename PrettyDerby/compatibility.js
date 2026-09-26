(() => {
  'use strict';

  const STORAGE_KEY = 'prettyderby-compatibility:v1';
  const SLOTS = [
    { id: 'target', label: '育成目標' },
    { id: 'parentA', label: '親代 A' },
    { id: 'parentB', label: '親代 B' },
    { id: 'parentA1', label: '祖代 A1' },
    { id: 'parentA2', label: '祖代 A2' },
    { id: 'parentB1', label: '祖代 B1' },
    { id: 'parentB2', label: '祖代 B2' }
  ];
  const PAIR_LABELS = new Map([
    ['target-parentA', '目標 × 親代 A'],
    ['target-parentB', '目標 × 親代 B'],
    ['parentA-parentB', '親代 A × 親代 B'],
    ['target-parentA1', '目標 × 祖代 A1'],
    ['target-parentA2', '目標 × 祖代 A2'],
    ['target-parentB1', '目標 × 祖代 B1'],
    ['target-parentB2', '目標 × 祖代 B2']
  ]);
  const affinity = window.AFFINITY_DATA;
  const catalog = window.GAMETORA_DATA;
  const core = window.BREEDER_CORE;
  const workspace = document.getElementById('compatibilityWorkspace');
  const tree = document.getElementById('compatibilityTree');
  const result = document.getElementById('compatibilityResult');
  const dialog = document.getElementById('compatibilityDialog');
  const search = document.getElementById('compatibilitySearch');
  const choices = document.getElementById('compatibilityChoices');
  const dialogTitle = document.getElementById('compatibilityDialogTitle');
  const reset = document.getElementById('compatibilityReset');

  if (!workspace || !tree || !result || !dialog || !search || !choices || !dialogTitle || !reset) return;
  if (!Array.isArray(affinity?.names) || !Array.isArray(affinity?.matrix)
    || typeof core?.calculateBaseAffinity !== 'function') {
    result.textContent = '相性資料無法載入。';
    return;
  }

  const validKeys = new Set(affinity.names);
  const characters = new Map((catalog?.characters || [])
    .filter(character => validKeys.has(character.jp_name))
    .map(character => [character.jp_name, character]));
  const portraits = new Map();
  [...(catalog?.characterCards || [])]
    .filter(card => validKeys.has(card.nameJp) && Number.isFinite(Number(card.id)))
    .sort((left, right) => Number(left.id) - Number(right.id))
    .forEach(card => {
      if (!portraits.has(card.nameJp)) portraits.set(card.nameJp, Number(card.id));
    });

  const selections = loadSelections();
  const slotButtons = new Map();
  const choiceButtons = [];
  let activeSlot = null;
  let restoreFocusTo = null;

  function loadSelections() {
    const empty = Object.fromEntries(SLOTS.map(slot => [slot.id, null]));
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
      const slots = saved?.slots;
      if (!slots || typeof slots !== 'object') return empty;
      SLOTS.forEach(slot => {
        if (validKeys.has(slots[slot.id])) empty[slot.id] = slots[slot.id];
      });
    } catch {
      // Private browsing or malformed saved data must not block the calculator.
    }
    return empty;
  }

  function saveSelections() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ slots: selections }));
    } catch {
      // The current calculation remains usable when storage is unavailable.
    }
  }

  function nameFor(key) {
    return characters.get(key)?.name_tw || key;
  }

  function portraitFor(key, className) {
    const frame = document.createElement('span');
    frame.className = `compat-portrait ${className}`;
    const fallback = document.createElement('span');
    fallback.className = 'compat-portrait-fallback';
    fallback.textContent = [...nameFor(key || '')][0] || '＋';
    frame.append(fallback);
    const outfitId = portraits.get(key);
    if (outfitId) {
      const image = document.createElement('img');
      image.src = `assets/trainee-portraits/${outfitId}.png`;
      image.alt = '';
      image.loading = 'lazy';
      image.addEventListener('error', () => {
        image.remove();
        frame.classList.add('compat-portrait--missing');
      }, { once: true });
      frame.prepend(image);
    } else {
      frame.classList.add('compat-portrait--missing');
    }
    return frame;
  }

  function slotCard(slot) {
    const key = selections[slot.id];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'compat-slot';
    button.dataset.compatSlot = slot.id;
    button.setAttribute('aria-label', `${key ? '更換' : '選擇'}${slot.label}${key ? `：${nameFor(key)}` : ''}`);
    button.append(portraitFor(key, 'compat-slot-portrait'));

    const copy = document.createElement('span');
    copy.className = 'compat-slot-copy';
    const label = document.createElement('span');
    label.className = 'compat-slot-label';
    label.textContent = slot.label;
    const name = document.createElement('strong');
    name.className = 'compat-slot-name';
    name.textContent = key ? nameFor(key) : '選擇角色';
    copy.append(label, name);
    button.append(copy);
    slotButtons.set(slot.id, button);
    return button;
  }

  function tier(className, slotIds) {
    const row = document.createElement('div');
    row.className = `compat-tier ${className}`;
    slotIds.forEach(id => row.append(slotCard(SLOTS.find(slot => slot.id === id))));
    return row;
  }

  function renderTree() {
    slotButtons.clear();
    const surface = document.createElement('div');
    surface.className = 'compat-tree';
    surface.append(
      tier('compat-tier--grandparents', ['parentA1', 'parentA2', 'parentB1', 'parentB2']),
      tier('compat-tier--parents', ['parentA', 'parentB']),
      tier('compat-tier--target', ['target'])
    );
    tree.replaceChildren(surface);
  }

  function renderResult() {
    const analysis = core.calculateBaseAffinity(selections, affinity);
    const validPairs = analysis.pairs.filter(pair => pair.status === 'ok' && Number.isFinite(pair.score));
    const invalidPairs = analysis.pairs.filter(pair => pair.status === 'same-character');
    const validTotal = validPairs.reduce((sum, pair) => sum + pair.score, 0);
    const complete = validPairs.length === analysis.expectedPairCount;
    const invalidSlots = new Set(invalidPairs.flatMap(pair => pair.slots));

    slotButtons.forEach((button, id) => {
      button.classList.toggle('compat-slot--invalid', invalidSlots.has(id));
    });

    const summary = document.createElement('div');
    summary.className = 'compat-score';
    const heading = document.createElement('span');
    heading.className = 'compat-score-heading';
    heading.textContent = complete ? '基礎相性近似' : '目前小計';
    const value = document.createElement('strong');
    value.className = 'compat-score-value';
    value.textContent = validPairs.length ? String(validTotal) : '—';
    const count = document.createElement('span');
    count.className = 'compat-score-count';
    count.textContent = `${validPairs.length}／${analysis.expectedPairCount} 組`;
    summary.append(heading, value, count);
    if (invalidPairs.length) {
      const warning = document.createElement('p');
      warning.className = 'compat-warning';
      warning.textContent = `${invalidPairs.length} 組同角色配對未計分`;
      summary.append(warning);
    }

    const details = document.createElement('details');
    details.className = 'compat-details';
    const detailsHeading = document.createElement('summary');
    detailsHeading.textContent = '查看配對明細';
    const list = document.createElement('ol');
    list.className = 'compat-pair-list';
    analysis.pairs.forEach(pair => {
      const item = document.createElement('li');
      if (pair.status === 'same-character') item.className = 'compat-pair--invalid';
      const label = document.createElement('span');
      label.textContent = PAIR_LABELS.get(pair.id) || pair.label;
      const score = document.createElement('strong');
      score.textContent = pair.status === 'same-character'
        ? '同角色'
        : (pair.status === 'ok' ? String(pair.score) : '未選');
      item.append(label, score);
      list.append(item);
    });
    details.append(detailsHeading, list);

    const note = document.createElement('p');
    note.className = 'compat-note';
    note.textContent = '祖代採雙角色矩陣近似；未加共同 GⅠ。';
    result.replaceChildren(summary, details, note);
  }

  function render() {
    renderTree();
    renderResult();
  }

  function buildChoices() {
    choices.classList.add('compat-choices');
    choices.setAttribute('role', 'group');
    choices.setAttribute('aria-label', '選擇角色');
    const fragment = document.createDocumentFragment();
    affinity.names.forEach(key => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'compat-choice';
      button.dataset.compatKey = key;
      button.setAttribute('aria-label', nameFor(key));
      button.append(portraitFor(key, 'compat-choice-portrait'));
      const name = document.createElement('span');
      name.className = 'compat-choice-name';
      name.textContent = nameFor(key);
      button.append(name);
      button.addEventListener('click', () => {
        if (!activeSlot) return;
        const chosenSlot = activeSlot;
        selections[chosenSlot] = key;
        saveSelections();
        render();
        dialog.close();
        slotButtons.get(chosenSlot)?.focus({ preventScroll: true });
      });
      choiceButtons.push({ button, searchText: `${nameFor(key)} ${key}`.normalize('NFKC').toLocaleLowerCase() });
      fragment.append(button);
    });
    const empty = document.createElement('p');
    empty.className = 'compat-search-empty';
    empty.textContent = '找不到角色';
    empty.hidden = true;
    fragment.append(empty);
    choices.replaceChildren(fragment);
    return empty;
  }

  const searchEmpty = buildChoices();

  function filterChoices() {
    const query = search.value.trim().normalize('NFKC').toLocaleLowerCase();
    let visibleCount = 0;
    choiceButtons.forEach(({ button, searchText }) => {
      const visible = searchText.includes(query);
      button.hidden = !visible;
      if (visible) visibleCount += 1;
    });
    searchEmpty.hidden = visibleCount > 0;
  }

  tree.addEventListener('click', event => {
    const button = event.target.closest('[data-compat-slot]');
    if (!button || !tree.contains(button)) return;
    activeSlot = button.dataset.compatSlot;
    restoreFocusTo = button;
    const label = SLOTS.find(slot => slot.id === activeSlot)?.label || '角色';
    dialogTitle.textContent = `選擇${label}`;
    search.value = '';
    filterChoices();
    dialog.showModal();
    search.focus();
  });

  search.addEventListener('input', filterChoices);
  dialog.addEventListener('click', event => {
    if (event.target.closest('[data-compat-close]')) dialog.close();
    else if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    activeSlot = null;
    if (restoreFocusTo?.isConnected) restoreFocusTo.focus({ preventScroll: true });
    restoreFocusTo = null;
  });
  reset.addEventListener('click', () => {
    SLOTS.forEach(slot => { selections[slot.id] = null; });
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* optional storage */ }
    render();
    reset.focus({ preventScroll: true });
  });

  render();
})();
