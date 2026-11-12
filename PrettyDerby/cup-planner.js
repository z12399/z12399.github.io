(function () {
  'use strict';

  // 杯賽缺口規劃 — UI only. All computation lives in cup-gap-core.js
  // (window.CupGapCore) and cup-pick-core.js (window.CupPickCore). This file
  // wires data globals, persisted choices and rendering; it shows adoption
  // rates, PT costs, sources and plain sums only.

  const STORAGE_KEY = 'prettyderby-cup-planner:v1';
  const Core = window.CupGapCore;
  const Pick = window.CupPickCore;
  // Catalog: data/cup-catalog.js (JP records + real TW release dates, incl.
  // scheduled cards) when present, else the old zh_tw GameTora snapshot.
  const HAS_CUP_CATALOG = !!(window.CUP_CATALOG && Array.isArray(window.CUP_CATALOG.skills));
  const BASE_CATALOG = HAS_CUP_CATALOG ? window.CUP_CATALOG : (window.GAMETORA_DATA || { skills: [], supports: [], characterCards: [], metadata: {} });
  // `catalog` / `index` are the view at the planning date (rebuilt in compute()).
  let catalog = BASE_CATALOG;
  let index = null;
  const META = window.CUP_META || { cups: [] };
  const EVENT_ROUTES = [
    ...((window.SUPPORT_EVENT_ROUTES && Array.isArray(window.SUPPORT_EVENT_ROUTES.routes)) ? window.SUPPORT_EVENT_ROUTES.routes : []),
    ...((window.SUPPORT_EVENT_ROUTES_TW_EXTRA && Array.isArray(window.SUPPORT_EVENT_ROUTES_TW_EXTRA.routes)) ? window.SUPPORT_EVENT_ROUTES_TW_EXTRA.routes : [])
  ];
  const FACTOR_STRATEGY = window.FACTOR_RUN_STRATEGY || null;
  const pad2 = value => String(value).padStart(2, '0');
  const TODAY = (() => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; })();
  const INVENTORY = window.USER_INVENTORY || { supportCards: [], trainees: [] };
  const BREEDER_REGISTRY = window.PRETTY_DERBY_OWNED_BREEDER_REGISTRY || window.OWNED_BREEDER_REGISTRY || { ownedRecords: [] };
  const SCENARIOS = window.SCENARIO_SKILL_SOURCES && Array.isArray(window.SCENARIO_SKILL_SOURCES.scenarios)
    ? window.SCENARIO_SKILL_SOURCES.scenarios : [];
  const CURRENT_SCENARIO_ID = 'island';

  if (!Core || !Pick || !(HAS_CUP_CATALOG || window.GAMETORA_DATA)) {
    document.getElementById('app').innerHTML = '<p class="cp-empty">cup-gap-core.js、cup-pick-core.js 或目錄資料未載入，無法計算。</p>';
    return;
  }

  index = Core.indexCatalog(catalog);
  const asOf = HAS_CUP_CATALOG ? '' : ((BASE_CATALOG.metadata && BASE_CATALOG.metadata.asOf) || '');
  // Raw (unfiltered) lookups, for showing TW dates of cards after the planning date.
  const RAW_SUPPORT = new Map((BASE_CATALOG.supports || []).map(s => [Number(s.id), s]));
  const PORTRAIT_IDS = new Set(((window.GAMETORA_DATA && window.GAMETORA_DATA.characterCards) || BASE_CATALOG.characterCards || []).map(c => Number(c.id)));

  // Catalog view at a planning date: the core drops every support / outfit
  // whose TW releaseDate is null or after that date (see indexCatalog).
  const VIEW_CACHE = new Map();
  function catalogViewAt(date) {
    if (!HAS_CUP_CATALOG) return BASE_CATALOG;
    if (!VIEW_CACHE.has(date)) VIEW_CACHE.set(date, { ...BASE_CATALOG, metadata: { ...(BASE_CATALOG.metadata || {}), planningDate: date } });
    return VIEW_CACHE.get(date);
  }
  const mdText = date => { const m = String(date || '').match(/^\d{4}-(\d{2})-(\d{2})/); return m ? `${Number(m[1])}/${Number(m[2])}` : ''; };
  // 「M/D 實裝」 tag for a card that is in the view but not yet on TW today.
  function soonTag(record) {
    if (!HAS_CUP_CATALOG || !record || !record.releaseDate) return '';
    const date = String(record.releaseDate).slice(0, 10);
    return date > TODAY ? ` <em class="cp-tag cp-tag--soon">${esc(mdText(date))} 實裝</em>` : '';
  }

  const TYPE_LABEL = { Speed: '速度', Stamina: '耐力', Power: '力量', Guts: '意志力', intelligence: '智力', Wisdom: '智力', Friend: '友人', Group: '團隊' };
  const TYPE_ORDER = ['Speed', 'Stamina', 'Power', 'Guts', 'intelligence', 'Friend', 'Group'];
  const STYLE_LABEL = { 逃げ: '領頭', 先行: '前列', 差し: '居中', 追込: '後追', 追い込み: '後追' };
  const APT_LABEL = { turf: '草地', dirt: '泥地', short: '短距離', mile: '英里', medium: '中距離', long: '長距離', runner: '領頭', leader: '前列', betweener: '居中', chaser: '後追' };
  const STAT_KEYS = [['speed', '速度'], ['stamina', '耐力'], ['power', '力量'], ['guts', '意志力'], ['wisdom', '智力']];
  const TRAINEE_VIA_LABEL = { unique: '固有', innate: '初始技能', awakening: '覺醒', evolved: '進化', event: '育成事件' };
  const KIND_LABEL = {
    unique: '其他角色的固有技能（目前戰馬沒有）',
    'character-evolution': '角色進化技能（需特定角色衣裝）',
    'scenario-evolution': '劇本進化技能（需在對應劇本育成）',
    unknown: '台服目錄查無此技能',
    white: '白技能',
    'inherited-unique': '繼承固有'
  };
  const MIN_RATE_OPTIONS = [10, 20, 30, 50, 70];
  // Hint level -> discount %, as in the game (Lv1 10 … Lv5 40). 切れ者 adds a flat 10%.
  const HINT_DISCOUNT_BY_LEVEL = Pick ? Pick.HINT_DISCOUNT_BY_LEVEL : [0, 10, 20, 30, 35, 40];
  const MIN_VALUE_OPTIONS = [5, 10, 20, 30];
  const HINT_CHANCE_OPTIONS = [30, 40, 50, 60, 70, 80, 100];

  // ------------------------------------------------------------ state

  const DEFAULT_STATE = {
    cupId: null,
    archetypeId: null,
    minRate: 30,
    expectedPt: 6750,
    whiteHintLv: 5,
    goldHintLv: 2,
    awakeningHintLv: 3,
    sharp: true,
    inheritN: 4,
    inheritedWhiteHintLv: 1,
    factorHintChance: 100,
    defaultsVersion: 2,
    minValueRate: 10,
    onlyAboveCut: false,
    excludeUnobtainable: true,
    planDateMode: null,
    planDateCustom: null,
    traineeByArchetype: {},
    deckByArchetype: {},
    stallionByArchetype: {},
    pickByArchetype: {},
    ownedOverlay: {}
  };

  function loadState() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_STATE };
      const parsed = JSON.parse(raw);
      const saved = parsed && typeof parsed === 'object' ? parsed : {};
      // Old schema (single hint-discount select): drop its PT assumptions so the new defaults apply.
      if ('hintDiscount' in saved) { delete saved.hintDiscount; delete saved.expectedPt; }
      // Old ④ had goldHintLv 'auto'; the pick model needs a number (fallback when no event data).
      if (saved.goldHintLv === 'auto') delete saved.goldHintLv;
      // defaults v2 = owner's upper-bound plan (hint list Lv5, 切者, p = 100%):
      // older saves drop those three so the new defaults apply once.
      if (saved.defaultsVersion !== DEFAULT_STATE.defaultsVersion) {
        delete saved.whiteHintLv; delete saved.sharp; delete saved.factorHintChance;
        saved.defaultsVersion = DEFAULT_STATE.defaultsVersion;
      }
      return { ...DEFAULT_STATE, ...saved };
    } catch (error) {
      return { ...DEFAULT_STATE };
    }
  }

  let state = loadState();
  // Deep link from the launch menu / old race picker: cup-planner.html?cup=<id>.
  try {
    const requestedCup = new URLSearchParams(window.location.search).get('cup');
    if (requestedCup && Array.isArray(META.cups) && META.cups.some(cup => cup.id === requestedCup)) state.cupId = requestedCup;
  } catch (error) { /* no URL API */ }

  function save() {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (error) { /* storage unavailable */ }
  }

  // ------------------------------------------------------------ helpers

  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const fmt = value => (Number.isFinite(Number(value)) ? Number(value).toLocaleString('en-US') : '—');
  const pct = value => `${Math.round(Number(value) * 10) / 10}%`;
  const list = value => (Array.isArray(value) ? value : []);

  function cupList() { return list(META.cups); }
  function currentCup() {
    const cups = cupList();
    return cups.find(cup => cup.id === state.cupId) || cups[0] || null;
  }
  function currentArchetype(cup) {
    const archetypes = list(cup && cup.archetypes);
    return archetypes.find(entry => entry.id === state.archetypeId) || archetypes[0] || null;
  }

  function supportName(support) {
    if (!support) return '';
    const name = support.nameZhTw || support.name || support.nameJp || '';
    const title = String(support.titleZhTw || support.title || '').replace(/^\[|\]$/g, '');
    return title ? `${name}〈${title}〉` : name || `#${support.id}`;
  }
  function supportShortName(support) {
    if (!support) return '';
    return support.nameZhTw || support.name || support.nameJp || `#${support.id}`;
  }
  function cardName(card) {
    if (!card) return '';
    const title = String(card.titleZhTw || card.title || '').replace(/^\[|\]$/g, '');
    return `${card.nameZhTw || card.name || ''}${title ? `〈${title}〉` : ''}`;
  }
  function skillName(skillId) {
    const skill = index.skillById.get(Number(skillId));
    return skill ? Core.skillDisplayName(skill) : `#${skillId}`;
  }
  function typeLabel(type) { return TYPE_LABEL[type] || type || ''; }
  // Released at the planning date: in the cup-catalog view by construction;
  // old catalog keeps its asOf rule.
  function isReleased(support) {
    if (!support || !index.supportById.has(Number(support.id))) return false;
    return HAS_CUP_CATALOG || !asOf || !support.releaseDate || String(support.releaseDate) <= asOf;
  }

  // ------------------------------------------------------------ planning date

  function cupDateRange(cup) {
    const sched = cup && cup.twSchedule;
    if (!sched || !sched.start) return null;
    const stages = list(sched.stages);
    const span = stage => {
      const rows = stages.filter(entry => entry && entry.stage === stage);
      if (!rows.length) return null;
      return { start: rows.map(r => r.start).sort()[0], end: rows.map(r => r.end).sort().slice(-1)[0] };
    };
    return { start: sched.start, end: sched.end, entry: span(0), league: span(1), finals: span(2) };
  }
  function rangeText(range) { return range ? `${mdText(range.start)}–${mdText(range.end)}` : ''; }

  function planningDate(cup) {
    if (!HAS_CUP_CATALOG) return null;
    const cupDate = cup && cup.plannedDate ? String(cup.plannedDate).slice(0, 10) : null;
    const mode = state.planDateMode || (cupDate ? 'cup' : 'today');
    if (mode === 'custom' && /^\d{4}-\d{2}-\d{2}$/.test(String(state.planDateCustom || ''))) return String(state.planDateCustom);
    if (mode === 'cup' && cupDate) return cupDate;
    return TODAY;
  }

  // Inventory overlay: {supportId: -1 (未持有) | 0..4 (持有，突破數)}.
  function inventoryCardMap() {
    const map = new Map();
    for (const card of list(INVENTORY.supportCards)) {
      const id = Number(card && card.id);
      if (Number.isFinite(id)) map.set(id, card);
    }
    return map;
  }
  const BASE_INVENTORY_CARDS = inventoryCardMap();

  function ownedInfo(supportId) {
    const id = Number(supportId);
    const support = index.supportById.get(id);
    const overlay = state.ownedOverlay[id];
    if (overlay !== undefined && overlay !== null) {
      if (Number(overlay) < 0) return { owned: false, limitBreak: null, overlay: true };
      return { owned: true, limitBreak: Number(overlay), overlay: true };
    }
    const base = BASE_INVENTORY_CARDS.get(id);
    if (base) return { owned: true, limitBreak: base.limitBreak == null ? null : Number(base.limitBreak) };
    if (support && (support.rarity === 'R' || support.rarity === 'SR')) return { owned: true, limitBreak: null, assumed: true };
    return { owned: false, limitBreak: null };
  }

  // Inventory handed to the core: user-inventory + overlay, with R/SR assumed
  // owned (same default as the core) unless the overlay says otherwise.
  function inventoryForCore(excludedIds) {
    const excluded = new Set(list(excludedIds).map(Number));
    const supportCards = [];
    for (const support of index.supportById.values()) {
      if (excluded.has(support.id)) continue;
      const info = ownedInfo(support.id);
      if (info.owned) supportCards.push({ id: support.id, rarity: support.rarity, limitBreak: info.limitBreak });
    }
    return { supportCards, trainees: list(INVENTORY.trainees) };
  }

  const OWNED_OUTFITS = new Set(list(INVENTORY.trainees).map(entry => Number(entry && (entry.outfitId != null ? entry.outfitId : entry.id))).filter(Number.isFinite));

  function lbText(info) {
    if (!info || !info.owned) return '未持有';
    if (info.assumed) return '持有（R/SR 視為持有）';
    return info.limitBreak == null ? '持有（突破不明）' : `持有 ${info.limitBreak} 突`;
  }

  function thumb(supportId, support) {
    const label = support ? typeLabel(support.supportType).slice(0, 2) : '?';
    return `<span class="cp-thumb" data-type="${esc(support && support.supportType)}"><img src="assets/support-cards/${Number(supportId)}.thumb.png" alt="" loading="lazy" data-fallback="${esc(label)}" /></span>`;
  }

  function rateCell(rate) {
    const width = Math.max(0, Math.min(100, Number(rate) || 0));
    return `<span class="cp-rate"><span class="cp-rate__bar"><i style="width:${width}%"></i></span><b>${pct(rate)}</b></span>`;
  }

  function badge(text, tone) { return `<span class="cp-badge${tone ? ` cp-badge--${tone}` : ''}">${esc(text)}</span>`; }

  // ------------------------------------------------------------ scenarios

  function scenarioNumericId(scenario) {
    for (const key of ['gametoraScenarioId', 'gametoraId', 'scenarioId', 'numericId']) {
      const value = Number(scenario && scenario[key]);
      if (Number.isFinite(value)) return value;
    }
    return null;
  }
  function scenarioName(scenario) {
    return (scenario && (scenario.nameZhTw || scenario.name || scenario.nameJp || scenario.id)) || '';
  }
  const currentScenario = SCENARIOS.find(entry => entry && entry.id === CURRENT_SCENARIO_ID)
    || SCENARIOS.find(entry => entry && entry.currentlyPlayable === true) || null;
  const otherScenarios = SCENARIOS.filter(entry => entry && entry !== currentScenario);
  const scenarioSkillIds = scenario => list(scenario && scenario.skills).map(entry => Number(entry && entry.skillId)).filter(Number.isFinite);
  const CURRENT_SCENARIO_SKILLS = scenarioSkillIds(currentScenario);

  function gametoraScenarioLabel(numericId) {
    const hit = SCENARIOS.find(entry => scenarioNumericId(entry) === Number(numericId));
    return hit ? `〈${scenarioName(hit)}〉` : `GameTora 劇本 #${numericId}`;
  }

  // Other scenarios that can provide a skill, judged by the core's own
  // family rules (resolveSkillSources' scenario flag).
  function otherScenarioLabelsFor(skillId) {
    const labels = [];
    const familyIds = new Set([Number(skillId), ...Core.familyOf(skillId, catalog).members.map(member => member.id)]);
    for (const scenario of otherScenarios) {
      const ids = scenarioSkillIds(scenario);
      if (!ids.length) continue;
      const res = Core.resolveSkillSources({ skillIds: [skillId], catalog, scenarioSkillIds: ids });
      if (!res[skillId] || !res[skillId].scenario) continue;
      const entries = list(scenario.skills).filter(entry => familyIds.has(Number(entry && entry.skillId)));
      const verified = entries.some(entry => entry.verified !== false);
      let label = `〈${scenarioName(scenario)}〉`;
      if (scenario.releasedOnTw === false) label += '（台服未實裝）';
      if (!verified) label += '（未查證）';
      labels.push(label);
    }
    return labels;
  }

  // ------------------------------------------------------------ trainee / deck

  function traineeCardIdFor(archetype) {
    if (!archetype) return null;
    const saved = state.traineeByArchetype[archetype.id];
    if (saved !== undefined) return saved === null ? null : Number(saved);
    return archetype.characterCardId != null && index.cardById.has(Number(archetype.characterCardId)) ? Number(archetype.characterCardId) : null;
  }

  function defaultDeck(archetype, traineeCard) {
    const metas = list(archetype && archetype.supportCards)
      .filter(card => card && card.supportId != null && (HAS_CUP_CATALOG || card.twReleased !== false) && isReleased(index.supportById.get(Number(card.supportId))))
      .slice()
      .sort((a, b) => b.rate - a.rate);
    const slots = [];
    const usedCharacters = new Set();
    if (traineeCard) usedCharacters.add(Number(traineeCard.characterId));
    let borrowUsed = false;
    for (const meta of metas) {
      if (slots.length >= 6) break;
      const support = index.supportById.get(Number(meta.supportId));
      if (usedCharacters.has(Number(support.characterId))) continue;
      if (ownedInfo(support.id).owned) slots.push({ supportId: support.id, borrowed: false });
      else if (!borrowUsed) { slots.push({ supportId: support.id, borrowed: true }); borrowUsed = true; } else continue;
      usedCharacters.add(Number(support.characterId));
    }
    while (slots.length < 6) slots.push(null);
    return slots;
  }

  function deckFor(archetype, traineeCard) {
    const saved = state.deckByArchetype[archetype.id];
    if (Array.isArray(saved) && saved.length === 6) return saved.map(slot => (slot && index.supportById.has(Number(slot.supportId)) ? { supportId: Number(slot.supportId), borrowed: slot.borrowed === true } : null));
    return defaultDeck(archetype, traineeCard);
  }

  function setDeck(archetype, slots) {
    state.deckByArchetype[archetype.id] = slots.map(slot => (slot ? { supportId: slot.supportId, borrowed: slot.borrowed === true } : null));
  }

  // ⑤ per archetype: locked / excluded cards, protagonist (種馬局主角 cardId, null = auto).
  function stallionStateFor(archetype) {
    const entry = state.stallionByArchetype[archetype.id] || {};
    const protagonist = entry.protagonist == null ? null : Number(entry.protagonist);
    return { locked: list(entry.locked).map(Number), excluded: list(entry.excluded).map(Number), protagonist: Number.isFinite(protagonist) ? protagonist : null };
  }
  function setStallionState(archetype, value) {
    state.stallionByArchetype[archetype.id] = { locked: [...new Set(value.locked)], excluded: [...new Set(value.excluded)], protagonist: value.protagonist == null ? null : Number(value.protagonist) };
  }

  // ④ per-skill overrides: include (一定買) / exclude (不買) / hintLv / inherit (已確定種馬會帶)
  // and eventChoice ({`${supportId}:${eventId}`: choiceIndex}, exclusive card events).
  function pickStateFor(archetype) {
    const entry = (state.pickByArchetype || {})[archetype.id] || {};
    return {
      include: list(entry.include).map(Number),
      exclude: list(entry.exclude).map(Number),
      hintLv: entry.hintLv && typeof entry.hintLv === 'object' ? { ...entry.hintLv } : {},
      inherit: entry.inherit && typeof entry.inherit === 'object' ? { ...entry.inherit } : {},
      eventChoice: entry.eventChoice && typeof entry.eventChoice === 'object' ? { ...entry.eventChoice } : {}
    };
  }
  function setPickState(archetype, value) {
    if (!state.pickByArchetype || typeof state.pickByArchetype !== 'object') state.pickByArchetype = {};
    state.pickByArchetype[archetype.id] = { include: [...new Set(value.include)], exclude: [...new Set(value.exclude)], hintLv: value.hintLv, inherit: value.inherit, eventChoice: value.eventChoice || {} };
  }

  // ------------------------------------------------------------ compute

  function compute() {
    const cup = currentCup();
    const planDate = planningDate(cup);
    catalog = catalogViewAt(planDate);
    index = Core.indexCatalog(catalog);
    const archetype = currentArchetype(cup);
    if (!cup || !archetype) return { cup, archetype, planDate };
    const traineeCardId = traineeCardIdFor(archetype);
    const traineeCard = traineeCardId != null ? index.cardById.get(traineeCardId) || null : null;
    const deck = deckFor(archetype, traineeCard);
    const deckCardIds = deck.filter(Boolean).map(slot => slot.supportId);

    // Stallion sources for the whole breedable gap; "unobtainable" = no TW
    // card / outfit / scenario source and none of the owner's stallions has it.
    const breeders = list(BREEDER_REGISTRY.ownedRecords);
    const sourceCache = new Map();
    const sourcesFor = ids => {
      const missing = ids.filter(id => !sourceCache.has(id));
      if (missing.length) {
        Core.findStallionSources({ gapSkillIds: missing, catalog, inventory: inventoryForCore([]), breeders, assumeOwnedRarities: [] })
          .forEach(row => sourceCache.set(row.skillId, row));
      }
      return ids.map(id => sourceCache.get(id)).filter(Boolean);
    };
    const isUnobtainableRow = row => !!row && row.sourceless && !row.ownedBreedersWithFactor.length;
    const excludeUnobtainable = state.excludeUnobtainable !== false;

    // ④ 技能取捨 (cup-pick-core): exclusive event choices, stage 1 knapsack,
    // stage 2 white-factor pool. Computed first: ③ uses its event choices.
    const pickState = pickStateFor(archetype);
    const expectedPt = Number(state.expectedPt) || 0;
    const pick = Pick.planSkillPicks({
      cup, archetypeId: archetype.id, catalog,
      traineeCardId: traineeCard ? traineeCard.id : null,
      deckCardIds,
      scenarioSkillIds: CURRENT_SCENARIO_SKILLS,
      scenarioNumericId: scenarioNumericId(currentScenario),
      eventRoutes: EVENT_ROUTES,
      eventChoice: pickState.eventChoice,
      inventory: INVENTORY,
      forceInclude: pickState.include,
      forceExclude: pickState.exclude,
      hintLvBySkillId: pickState.hintLv,
      inheritPinned: pickState.inherit,
      excludeUnobtainable,
      isUnobtainable: id => isUnobtainableRow(sourcesFor([id])[0]),
      settings: {
        expectedPt,
        whiteHintLv: state.whiteHintLv,
        goldHintLv: state.goldHintLv,
        awakeningHintLv: state.awakeningHintLv,
        sharp: state.sharp !== false,
        inheritN: state.inheritN,
        inheritedWhiteHintLv: state.inheritedWhiteHintLv,
        factorHintChance: (Number(state.factorHintChance) || 0) / 100,
        minValueRate: state.minValueRate
      }
    });
    const gap = Core.analyzeBattleGap({
      cup, archetypeId: archetype.id, catalog,
      traineeCardId: traineeCard ? traineeCard.id : null,
      deckCardIds,
      scenarioSkillIds: CURRENT_SCENARIO_SKILLS,
      eventExclusions: pick.eventExclusions,
      minRate: state.minRate
    });
    const gapSources = sourcesFor(gap.breedableGap.map(row => row.skillId));
    const unobtainableIds = new Set(gapSources.filter(isUnobtainableRow).map(row => row.skillId));
    const unobtainableRows = gap.breedableGap.filter(row => unobtainableIds.has(row.skillId));
    const inheritTop = pick.stage1.inherited.filter(row => row.included);
    const inheritCost = inheritTop.reduce((sum, row) => sum + row.cost, 0);
    const poolById = new Map(pick.stage2.pool.map(item => [item.skillId, item]));
    // sources for the ③ gap plus every ④ stage-2 pool skill (B / D lists)
    const allStallionSources = sourcesFor([...new Set([...gap.breedableGap.map(row => row.skillId), ...pick.stage2.pool.map(item => item.skillId)])]);

    const stallionGapRows = state.onlyAboveCut
      ? gap.breedableGap.filter(row => poolById.has(row.skillId) && poolById.get(row.skillId).inExpected)
      : gap.breedableGap;
    const stallionIds = new Set(stallionGapRows.map(row => row.skillId));
    const stallionSources = allStallionSources.filter(row => stallionIds.has(row.skillId));
    const suggestionGapRows = excludeUnobtainable ? stallionGapRows.filter(row => !unobtainableIds.has(row.skillId)) : stallionGapRows;
    const stallion = stallionStateFor(archetype);
    const excludedSet = new Set(stallion.excluded);
    const borrowPool = [...index.supportById.values()].filter(support => isReleased(support) && !excludedSet.has(support.id)).map(support => support.id);
    // Stallion-run protagonist: the owner's pick among usable candidates,
    // else the top usable relevant candidate. Its support cards cannot be in
    // the stallion deck (same character), and the gap skills it supplies
    // itself count as covered before the greedy deck search.
    const candidates = Core.rankStallionCandidates({
      gapRows: gap.breedableGap.filter(row => !unobtainableIds.has(row.skillId)),
      inheritedUniqueRows: gap.inheritedUniques,
      catalog,
      inventory: INVENTORY,
      breeders,
      traineeCharacterId: traineeCard ? traineeCard.characterId : null
    });
    const protagonistOptions = candidates.filter(c => c.usable && c.relevant);
    const protagonist = protagonistOptions.find(c => c.cardId === stallion.protagonist) || protagonistOptions[0] || null;
    const protagonistManual = !!protagonist && protagonist.cardId === stallion.protagonist;
    const suggestion = Core.suggestStallionDeck({
      gapRows: suggestionGapRows,
      catalog,
      inventory: inventoryForCore(stallion.excluded),
      maxOwned: 5,
      maxBorrow: 1,
      lockedCardIds: stallion.locked.filter(id => !excludedSet.has(id)),
      borrowPool,
      assumeOwnedRarities: [],
      traineeCharacterId: protagonist ? protagonist.characterId : null,
      preCoveredSkillIds: protagonist ? protagonist.selfSuppliedGap : []
    });
    return { cup, archetype, traineeCard, traineeCardId, deck, gap, pick, poolById, pickState, planDate, inheritTop, inheritCost, expectedPt, stallionGapRows, stallionSources, allStallionSources, suggestion, suggestionGapRows, stallion, unobtainableIds, unobtainableRows, excludeUnobtainable, candidates, protagonist, protagonistOptions, protagonistManual };
  }

  // White-factor plan for D.2, straight from ④ stage 2: must-carry = pool
  // skills whose value (adoption share) ≥ 70%; 補 PT 用 = the other pool
  // skills inside the expected-value cut k.
  function whitePlanFrom(pick) {
    const s2 = pick.stage2;
    return {
      pool: s2.pool,
      mustCarry: s2.mustCarry,
      optional: s2.fillers,
      expectedK: s2.expectedK,
      stage2: s2
    };
  }

  // Facts for the 懶人路線 summary. Everything here is a core call on data
  // already in ctx; the renderer below only formats it.
  function computeRoute(ctx) {
    const { cup, archetype, traineeCard, gap, deck, allStallionSources, unobtainableIds } = ctx;
    const unobtainable = [...unobtainableIds];
    const ownedSupportIds = [...index.supportById.values()].filter(support => ownedInfo(support.id).owned).map(support => support.id);
    const breeders = list(BREEDER_REGISTRY.ownedRecords);
    const deadIds = new Set(list(ctx.pick.gap.impossible).map(row => row.skillId));
    const allInherited = Core.buildTargetSkills({ cup, archetypeId: archetype.id, minRate: 0 }).filter(row => row.inheritedUnique && !deadIds.has(row.skillId));
    const topRows = ctx.inheritTop.map(top => allInherited.find(row => row.skillId === top.skillId) || top);
    const optionalInherited = allInherited
      .filter(row => row.rate >= Core.TIER_COMMON && !ctx.inheritTop.some(top => top.skillId === row.skillId));
    const inheritOwners = Core.findInheritedUniqueOwners({ rows: [...topRows, ...optionalInherited], catalog, inventory: INVENTORY });
    const breedableIds = gap.breedableGap.filter(row => !unobtainableIds.has(row.skillId)).map(row => row.skillId);
    const apt = Core.summarizeAptitudeNeeds({ cup, traineeCard, archetypeId: archetype.id });
    const aptitudeKeys = [apt.surface, apt.distance, apt.style].filter(Boolean).map(entry => entry.key);
    return {
      core: Core.groupTargetsByAcquisition({ gap, unobtainableSkillIds: unobtainable, tiers: ['core'] }),
      common: Core.groupTargetsByAcquisition({ gap, unobtainableSkillIds: unobtainable, tiers: ['common'] }),
      niche: Core.groupTargetsByAcquisition({ gap, unobtainableSkillIds: unobtainable, tiers: ['niche'] }),
      all: Core.groupTargetsByAcquisition({ gap, unobtainableSkillIds: unobtainable }),
      deckAll: Core.groupRowsByDeckCard({ rows: gap.covered, deckCardIds: deck.filter(Boolean).map(slot => slot.supportId) }),
      sourcesById: new Map(list(allStallionSources).map(row => [row.skillId, row])),
      inheritTopOwners: inheritOwners.slice(0, ctx.inheritTop.length),
      inheritOptionalOwners: inheritOwners.slice(ctx.inheritTop.length),
      candidates: ctx.candidates,
      whitePlan: whitePlanFrom(ctx.pick),
      apt,
      breederFacts: Core.describeOwnedBreeders({ breeders, catalog, gapSkillIds: breedableIds, inheritedUniqueRows: gap.inheritedUniques, aptitudeKeys }),
      newerCards: Core.cardsNewerThanInventory({ archetype, catalog, inventoryDate: INVENTORY.generatedAt, ownedSupportIds }),
      metaAvail: Core.metaCardAvailability({ archetype, catalog, deckSlots: deck, ownedSupportIds, topN: 6 }),
      unverified: Core.unverifiedScenarioSources({ rows: gap.covered, catalog, scenarioSkills: list(currentScenario && currentScenario.skills) })
    };
  }

  // ------------------------------------------------------------ render ①

  function renderPlanDate(cup, planDate) {
    const el = document.getElementById('planDate');
    if (!el) return;
    if (!HAS_CUP_CATALOG) { el.innerHTML = ''; return; }
    const cupDate = cup && cup.plannedDate ? String(cup.plannedDate).slice(0, 10) : null;
    const mode = state.planDateMode || (cupDate ? 'cup' : 'today');
    const range = cupDateRange(cup);
    el.innerHTML = `<label class="cp-field cp-field--inline"><span>規劃日期</span>
        <select id="planDateMode" aria-label="規劃日期">
          <option value="today"${mode === 'today' ? ' selected' : ''}>今天（${esc(TODAY)}）</option>
          ${cupDate ? `<option value="cup"${mode === 'cup' ? ' selected' : ''}>杯賽日（${esc(cupDate)}）</option>` : ''}
          <option value="custom"${mode === 'custom' ? ' selected' : ''}>自訂</option>
        </select></label>
      ${mode === 'custom' ? `<input type="date" id="planDateCustom" aria-label="自訂規劃日期" value="${esc(planDate)}" />` : ''}
      <span class="cp-muted">只算 ${esc(planDate)} 前台服已實裝的卡與衣裝${range ? `；本杯台服 ${esc(rangeText(range))}` : ''}</span>`;
  }

  function renderFreshness(cup) {
    const parts = [];
    if (HAS_CUP_CATALOG) {
      const meta = BASE_CATALOG.metadata || {};
      parts.push(`目錄 JP 資料＋台服實裝日（${esc(meta.baseAsOf || '不明')}，台服 master ${esc(meta.twMasterUpdatedAt || '不明')}）`);
    } else parts.push(`目錄 GameTora 台服 ${esc(asOf || '不明')}`);
    if (cup && cup.source) {
      const date = cup.source.publishedAt ? String(cup.source.publishedAt).slice(0, 10) : '';
      parts.push(`meta <a href="${esc(cup.source.url)}" target="_blank" rel="noopener noreferrer">${esc(cup.source.title || cup.source.url)}</a>${cup.source.scope ? `（${esc(cup.source.scope)}${date ? `，${esc(date)}` : ''}）` : ''}`);
    }
    const inventoryDate = INVENTORY.generatedAt ? String(INVENTORY.generatedAt).slice(0, 10) : '不明';
    const overlayCount = Object.keys(state.ownedOverlay).length;
    parts.push(`持有卡 ${esc(inventoryDate)} 截圖${overlayCount ? `＋本機修正 ${overlayCount} 張` : ''}`);
    parts.push(currentScenario ? `劇本技能：${esc(scenarioName(currentScenario))}` : '劇本技能資料：未載入（不計劇本來源）');
    document.getElementById('freshness').innerHTML = parts.join('<span class="cp-sep">·</span>');
  }

  function archetypeOutfitStatus(archetype) {
    if (archetype.characterCardId == null || !index.cardById.has(Number(archetype.characterCardId))) return badge('台服未實裝', 'warn');
    return OWNED_OUTFITS.has(Number(archetype.characterCardId)) ? badge('持有此衣裝', 'ok') : badge('未持有此衣裝', 'muted');
  }

  function archetypeTitle(archetype) {
    const style = STYLE_LABEL[archetype.style] || archetype.style || '';
    const card = archetype.characterCardId != null ? index.cardById.get(Number(archetype.characterCardId)) : null;
    const name = card ? cardName(card) : (archetype.characterNameZhTw || archetype.characterLabelJa || archetype.id);
    return { style, name, jp: archetype.characterLabelJa || '' };
  }

  function renderTarget(ctx) {
    const { cup, archetype } = ctx;
    const el = document.getElementById('step-target');
    if (!cup) {
      el.innerHTML = '<h2 id="h-target">① 目標</h2><p class="cp-empty">沒有杯賽 meta 資料（data/cup-meta.js 未載入）。</p>';
      return;
    }
    const cupOptions = cupList().map(entry => `<option value="${esc(entry.id)}"${entry.id === cup.id ? ' selected' : ''}>${esc(entry.name || entry.id)}</option>`).join('');
    const cards = list(cup.archetypes).map(entry => {
      const t = archetypeTitle(entry);
      const selected = entry.id === archetype.id;
      const stats = entry.avgStats ? STAT_KEYS.map(([key, label]) => `<span><small>${label}</small>${fmt(Math.round(entry.avgStats[key]))}</span>`).join('') : '';
      // portraits exist only for outfits of the old zh_tw snapshot (assets/trainee-portraits)
      const portrait = entry.characterCardId != null && PORTRAIT_IDS.has(Number(entry.characterCardId))
        ?`<img class="cp-portrait" src="assets/trainee-portraits/${Number(entry.characterCardId)}.png" alt="" loading="lazy" data-hide-on-error="1" />` : '';
      return `<button type="button" class="cp-arch${selected ? ' is-selected' : ''}" data-action="pick-archetype" data-id="${esc(entry.id)}" aria-pressed="${selected}">
        ${portrait}
        <span class="cp-arch__body">
          <span class="cp-arch__style">${esc(t.style)}${styleUnverified(entry) ? ' ' + badge('判定未驗證', 'warn') : ''}</span>
          <strong>${esc(t.name)}</strong>
          <span class="cp-muted">${esc(t.jp)}${entry.uniqueSkillJa ? `（固有 ${esc(entry.uniqueSkillJa)}）` : ''}</span>
          <span class="cp-arch__meta">樣本 ${fmt(entry.sample)} 人 ${archetypeOutfitStatus(entry)}</span>
          <span class="cp-arch__stats">${stats}</span>
        </span>
      </button>`;
    }).join('');

    // 戰馬 selector
    const traineeId = ctx.traineeCardId;
    const ownedCards = [...OWNED_OUTFITS].map(id => index.cardById.get(id)).filter(Boolean).sort((a, b) => a.id - b.id);
    const otherCards = [...index.cardById.values()].filter(card => !OWNED_OUTFITS.has(card.id) && (!asOf || !card.releaseDate || card.releaseDate <= asOf)).sort((a, b) => a.id - b.id);
    const soonText = card => (HAS_CUP_CATALOG && card.releaseDate && String(card.releaseDate).slice(0, 10) > TODAY ? `（${mdText(card.releaseDate)} 實裝）` : '');
    const opt = card => `<option value="${card.id}"${card.id === traineeId ? ' selected' : ''}>${esc(cardName(card))}${card.id === Number(archetype.characterCardId) ? '（此型）' : ''}${esc(soonText(card))}</option>`;
    const traineeSelect = `<select id="traineeSelect" aria-label="戰馬">
      <option value=""${traineeId == null ? ' selected' : ''}>未選（不計自帶技能）</option>
      <optgroup label="持有">${ownedCards.map(opt).join('')}</optgroup>
      <optgroup label="未持有（台服已實裝）">${otherCards.map(opt).join('')}</optgroup>
    </select>`;
    let traineeNote = '';
    if (archetype.characterCardId == null || !index.cardById.has(Number(archetype.characterCardId))) {
      traineeNote = `<p class="cp-warn">此型角色衣裝（${esc(archetype.characterLabelJa || '')}${archetype.uniqueSkillJa ? `，固有 ${esc(archetype.uniqueSkillJa)}` : ''}）台服未實裝，無法判定自帶技能。可改選一位持有的戰馬套用同一份技能清單。</p>`;
    } else if (traineeId != null && traineeId !== Number(archetype.characterCardId)) {
      traineeNote = `<p class="cp-muted">目前用其他衣裝套此型的技能清單；此型原衣裝為 ${esc(cardName(index.cardById.get(Number(archetype.characterCardId))))}。</p>`;
    }
    if (traineeId != null && !OWNED_OUTFITS.has(traineeId)) traineeNote += '<p class="cp-muted">此衣裝不在持有清單（2026-07-15 截圖），若已持有可忽略。</p>';

    // stats + aptitude
    const ts = cup.targetStats || {};
    const statRows = `<table class="cp-table cp-table--stats"><thead><tr><th></th>${STAT_KEYS.map(([, label]) => `<th>${label}</th>`).join('')}</tr></thead><tbody>
      <tr><th scope="row">建議目標</th>${STAT_KEYS.map(([key]) => `<td>${fmt(ts[key])}</td>`).join('')}</tr>
      ${archetype.avgStats ? `<tr><th scope="row">此型 JP 平均</th>${STAT_KEYS.map(([key]) => `<td>${fmt(Math.round(archetype.avgStats[key]))}</td>`).join('')}</tr>` : ''}
    </tbody></table>${ts.note ? `<p class="cp-muted">${esc(ts.note)}</p>` : ''}`;

    const apt = Core.summarizeAptitudeNeeds({ cup, traineeCard: ctx.traineeCard, archetypeId: archetype.id });
    const aptRow = (label, entry) => {
      if (!entry) return `<tr><th scope="row">${label}</th><td colspan="3">不明</td></tr>`;
      if (entry.unknown) return `<tr><th scope="row">${label}</th><td>${esc(APT_LABEL[entry.key] || entry.key)}</td><td colspan="2">未選戰馬，適性不明</td></tr>`;
      const needA = entry.stepsToA > 0 ? `<b class="cp-need">差 ${entry.stepsToA} 階</b>` : '已達 A';
      const needS = entry.stepsToS > 0 ? `差 ${entry.stepsToS} 階` : '已達 S';
      return `<tr><th scope="row">${label}</th><td>${esc(APT_LABEL[entry.key] || entry.key)} <b class="cp-letter" data-rank="${esc(entry.letter)}">${esc(entry.letter)}</b></td><td>${needA}</td><td>${needS}</td></tr>`;
    };
    const aptTable = `<table class="cp-table cp-table--apt"><thead><tr><th>項目</th><th>戰馬目前</th><th>到 A 需紅因子提升</th><th>到 S 需紅因子提升</th></tr></thead><tbody>
      ${aptRow('場地', apt.surface)}${aptRow('距離', apt.distance)}${aptRow('腳質', apt.style)}</tbody></table>`;

    el.innerHTML = `<h2 id="h-target">① 目標</h2>
      <div class="cp-row">
        <label class="cp-field"><span>杯賽</span><select id="cupSelect">${cupOptions}</select></label>
        <span class="cp-muted">${esc(courseText(cup.course))}</span>
        ${(() => {
          const r = cupDateRange(cup);
          if (!r) return '';
          const seg = [r.entry ? `報名 ${rangeText(r.entry)}` : '', r.league ? `聯賽 ${rangeText(r.league)}` : '', r.finals ? `決賽 ${rangeText(r.finals)}` : ''].filter(Boolean).join('・');
          return `<span class="cp-muted">台服 ${esc(rangeText(r))}${seg ? `（${esc(seg)}）` : ''}</span>`;
        })()}
      </div>
      <h3>選擇型（腳質＋角色）</h3>
      <div class="cp-arch-grid">${cards}</div>
      <div class="cp-row cp-row--trainee">
        <label class="cp-field cp-field--wide"><span>戰馬（自帶技能、適性依此判定）</span>${traineeSelect}</label>
      </div>
      ${traineeNote}
      <div class="cp-two">
        <div><h3>能力值</h3>${statRows}</div>
        <div><h3>適性</h3>${cup.aptitudeNote ? `<p>${esc(cup.aptitudeNote)}</p>` : ''}${aptTable}</div>
      </div>`;
  }

  function courseText(course) {
    if (!course) return '';
    const surface = course.surface === 'dirt' ? '泥地' : course.surface === 'turf' ? '草地' : '';
    const rotation = course.rotation === 'right' ? '順時針' : course.rotation === 'left' ? '逆時針' : '';
    return [course.track, surface, course.distance ? `${course.distance}m` : '', APT_LABEL[course.distanceType] || '', rotation].filter(Boolean).join(' · ');
  }

  // ------------------------------------------------------------ render 懶人路線
  //
  // A numbered checklist built only from ctx / ctx.route facts. Text nodes
  // double as the "複製路線文字" output (routeToText walks this DOM), so
  // anything visual-only is marked data-copy-skip and chip separators are
  // real text hidden with CSS.

  const SEP = '<span class="cp-copysep">、</span>';
  const ref = (anchor, label) => `<a class="cp-ref" href="#${anchor}" data-copy-skip>${esc(label)}</a>`;
  const skillChip = (name, rate, tag) => `<span class="cp-chip">${esc(name)} <small>${pct(rate)}</small>${tag ? ` <em class="cp-tag">${esc(tag)}</em>` : ''}</span>`;
  const chips = items => (items.length ? `<span class="cp-chips">${items.join(SEP)}</span>` : '');
  const rowChips = rows => chips(rows.map(row => skillChip(row.name, row.rate)));

  function ownedText(supportId, borrowed) {
    if (borrowed) return '借卡';
    const info = ownedInfo(supportId);
    if (!info.owned) return '未持有';
    const support = index.supportById.get(supportId);
    if (info.assumed) return `${support ? support.rarity : ''} 視為持有`;
    return info.limitBreak == null ? '持有（突破不明）' : `持有 ${info.limitBreak} 突`;
  }

  function outfitText(cardId) {
    const card = index.cardById.get(Number(cardId));
    return card ? cardName(card) : `#${cardId}`;
  }

  // One breed option as plain words.
  function breedOptionText(option) {
    const through = option.exact === false && option.matchedSkillId != null ? `・經由 ${skillName(option.matchedSkillId)}` : '';
    if (option.kind === 'owned-card') return `${supportName(index.supportById.get(option.supportId))}（${option.via === 'event' ? '事件' : 'hint'}${through}，${ownedText(option.supportId, false)}）`;
    if (option.kind === 'owned-outfit') return `${outfitText(option.cardId)}自帶（${TRAINEE_VIA_LABEL[option.via] || option.via}${through}）`;
    if (option.kind === 'borrow-card') return `借${supportName(index.supportById.get(option.supportId))}（${option.via === 'event' ? '事件' : 'hint'}${through}）`;
    if (option.kind === 'scenario') return `在${gametoraScenarioLabel(option.scenarioId)}養（劇本事件）`;
    if (option.kind === 'unowned-outfit') return `${outfitText(option.cardId)}自帶（${TRAINEE_VIA_LABEL[option.via] || option.via}${through}；你沒有這件衣裝）`;
    return '';
  }

  function breederStars(entry) {
    return entry.stars == null ? '' : ` ★${entry.stars}`;
  }

  // "how to get this white factor" for one gap skill (B.3).
  function breedRouteText(skillId) {
    const source = lastRoute.sourcesById.get(skillId);
    if (!source) return '來源資料不明';
    const plan = Core.rankBreedOptions(source);
    if (plan.existingBreeders.length) {
      const first = plan.existingBreeders[0];
      return `現有種馬〈${first.label}〉已帶${breederStars(first)}${first.exact ? '' : `（${skillName(first.factorSkillId)}）`}${plan.existingBreeders.length > 1 ? `，另 ${plan.existingBreeders.length - 1} 隻也有` : ''}`;
    }
    const owned = plan.options.filter(option => option.kind === 'owned-card' || option.kind === 'owned-outfit');
    if (owned.length) return `可自己養：${owned.slice(0, 2).map(breedOptionText).join('、或 ')}`;
    const borrow = plan.options.filter(option => option.kind === 'borrow-card');
    if (borrow.length) return `只能借卡才養得出：${borrow.slice(0, 2).map(breedOptionText).join('、或 ')}`;
    const scen = plan.options.filter(option => option.kind === 'scenario');
    if (scen.length) return scen.map(breedOptionText).join('、或 ');
    const unowned = plan.options.filter(option => option.kind === 'unowned-outfit');
    if (unowned.length) return `只有未持有的衣裝會自帶：${unowned.slice(0, 2).map(breedOptionText).join('、或 ')}`;
    return noSourceText(source);
  }

  // No usable option: either nothing on TW at all, or only cards released after the catalog date.
  function noSourceText(source) {
    return source && source.sourceless ? '台服沒有來源' : '來源卡台服尚未開放';
  }

  function unobtainableReason(skillId) {
    const source = lastRoute.sourcesById.get(skillId);
    const unreleased = source && source.unreleasedSources ? source.unreleasedSources.supportIds.length + source.unreleasedSources.outfitIds.length : 0;
    if (unreleased) return '來源卡／馬娘台服未實裝';
    const scenarios = otherScenarioLabelsFor(skillId);
    return scenarios.length ? `只有${scenarios.join('／')}劇本給` : '台服沒有任何來源';
  }

  // PT of one gap skill as ④ prices it: stage-2 pool cost (white factor Lv,
  // in pool order), else its stage-1 row cost, else the plain chain price at
  // the white-factor level.
  function ptOf(skillId) {
    const item = lastCtx.poolById.get(skillId);
    if (item) return item.cost;
    const row = lastCtx.pick.stage1.rows.find(entry => entry.skillId === skillId);
    if (row) return row.cost;
    const fraction = (HINT_DISCOUNT_BY_LEVEL[Number(state.inheritedWhiteHintLv) || 0] + (state.sharp === false ? 0 : 10)) / 100;
    const discounts = {};
    Core.familyOf(skillId, catalog).members.forEach(member => { discounts[member.id] = fraction; });
    discounts[skillId] = fraction;
    return Core.effectiveSkillCost(skillId, catalog, { hintDiscountBySkillId: discounts }).total;
  }

  function styleLabel(archetype) { return STYLE_LABEL[archetype.style] || archetype.style || ''; }

  function routeConclusion(ctx, route) {
    const { cup, archetype, traineeCard, gap } = ctx;
    const s = gap.summary;
    const out = [];
    const archCard = archetype.characterCardId != null ? index.cardById.get(Number(archetype.characterCardId)) : null;
    if (!archCard) {
      out.push(`<p class="cp-warn">此型衣裝（${esc(archetype.characterLabelJa || archetype.id)}${archetype.uniqueSkillJa ? `，固有 ${esc(archetype.uniqueSkillJa)}` : ''}）台服未實裝。${traineeCard ? `下面用你選的戰馬 ${esc(cardName(traineeCard))} 套這份技能清單。` : '戰馬未選，自帶技能一律不計；可在 ① 改選一位持有的戰馬。'}</p>`);
    } else if (!traineeCard) {
      out.push('<p class="cp-warn">戰馬未選：自帶技能一律不計，下面的缺口會偏多。</p>');
    }
    if (traineeCard && !OWNED_OUTFITS.has(traineeCard.id)) {
      out.push(`<p class="cp-warn">戰馬 ${esc(cardName(traineeCard))} 不在你的持有清單（${esc(String(INVENTORY.generatedAt || '').slice(0, 10) || '截圖')}）。</p>`);
    }
    const traineeTitle = traineeCard ? String(traineeCard.titleZhTw || traineeCard.title || '').replace(/^\[|\]$/g, '') : '';
    const who = traineeCard ? `〈${traineeCard.nameZhTw || traineeCard.name || ''}${traineeTitle ? ` ${traineeTitle}` : ''}〉` : '〈未選戰馬〉';
    const cupName = String(cup.name || cup.id);
    const where = cup.course && cup.course.distance && cupName.includes(String(cup.course.distance)) ? cupName : `${cupName} ${courseText(cup.course)}`;
    const breedCount = route.all.breed.length;
    const parts = [`已有來源 ${s.coveredCount}`, `要靠種馬 ${breedCount}`];
    if (route.all.unobtainable.length) parts.push(`台服拿不到 ${route.all.unobtainable.length}`);
    if (route.all.notBreedable.length) parts.push(`種馬補不到的非白技能 ${route.all.notBreedable.length}`);
    parts.push(`繼承固有 ${s.inheritedUniqueCount}`);
    if (s.impossibleCount) parts.push(`${styleLabel(archetype)}不會發動 ${s.impossibleCount}（不算）`);
    out.push(unverifiedNote(archetype));
    out.push(`<p class="cp-route__lead">${esc(who)}跑 ${esc(where)} ${esc(styleLabel(archetype))}${cupDateRange(cup) ? `（台服 ${esc(rangeText(cupDateRange(cup)))}）` : ''}：目標技能 ${s.targetCount} 個（採用率 ≥ ${Number(state.minRate)}%），${parts.join('、')}。</p>`);
    // PT line: straight from ④ (stage 1 knapsack + stage 2 white-factor pool).
    const s1 = ctx.pick.stage1;
    const s2 = ctx.pick.stage2;
    const pPct = Math.round(s2.factorHintChance * 100);
    const inheritPart = ctx.inheritTop.length ? `（含繼承固有 ${ctx.inheritTop.length} 個 ${fmt(ctx.inheritCost)}）` : '';
    let ptLine = `預期 ${fmt(ctx.expectedPt)} PT（上限假設：配卡 hint 清單全拿 Lv${Number(state.whiteHintLv)}${state.sharp === false ? '' : '、切者'}）：戰馬＋配卡＋劇本拿得到的技能照 ④ 買 ${s1.boughtCount} 個，花 ${fmt(s1.spent)} PT${inheritPart}`;
    if (s1.leftover <= 0) ptLine += '，PT 已用完，種馬白因子不會變成實際購買。';
    else if (!s2.pool.length) ptLine += `，剩 ${fmt(s1.leftover)} PT，但沒有要靠種馬的技能（採用率 ≥ ${Number(state.minValueRate)}%）。`;
    else if (s2.expectedK != null) ptLine += `，剩 ${fmt(s1.leftover)} PT 要靠種馬白因子補：${pPct >= 100 ? '照上限（每顆因子都出 hint）' : `照期望值（因子出 hint 機率 ${pPct}%）`}，種馬大約要帶到第 ${s2.expectedK} 顆（合計原始 ${fmt(s2.expectedRawCost)} PT 的技能）。`;
    else ptLine += `，剩 ${fmt(s1.leftover)} PT；種馬把 ${s2.pool.length} 顆全帶上，期望也還剩約 ${fmt(Math.round(s2.unspentExpected))} PT 用不掉（可降低 ④ 無效門檻或換配卡）。`;
    if (s1.drop.length) ptLine += ` 有 ${s1.drop.length} 個技能因 PT 不夠被放掉。`;
    out.push(`<p>${esc(ptLine)} ${ref('step-pt', '→ ④')}</p>`);
    return out.join('');
  }

  // B.2: deck cards with what they give from `rows` (tier-filtered deck group).
  function deckGroupHtml(rows, compact) {
    const deckIds = lastCtx.deck.filter(Boolean).map(slot => slot.supportId);
    const groups = Core.groupRowsByDeckCard({ rows, deckCardIds: deckIds }).filter(entry => entry.count);
    if (!groups.length) return '';
    const items = groups.map(entry => {
      const slot = lastCtx.deck.find(s => s && s.supportId === entry.supportId);
      const support = index.supportById.get(entry.supportId);
      const tag = item => (item.multiSource ? '多來源' : '');
      const parts = [];
      if (entry.event.length) parts.push(`事件拿 ${chips(entry.event.map(item => skillChip(item.name, item.rate, tag(item))))}`);
      if (entry.hint.length) parts.push(`hint 要點到 ${chips(entry.hint.map(item => skillChip(item.name, item.rate, tag(item))))}<span class="cp-muted">（看運氣）</span>`);
      return `<li><b>${esc(supportName(support))}</b>（${esc(ownedText(entry.supportId, slot && slot.borrowed))}）：${parts.join('；')}</li>`;
    });
    return compact ? items.join('') : `<ul class="cp-route__list">${items.join('')}</ul>`;
  }

  function mustListHtml(route) {
    const g = route.core;
    const blocks = [];
    const freeTrainee = g.free.filter(row => row.freeVia === 'trainee');
    const freeScenario = g.free.filter(row => row.freeVia === 'scenario');
    if (g.free.length) {
      blocks.push(`<li><b>不用管</b>：${g.free.length} 個（戰馬自帶 ${freeTrainee.length}、劇本給 ${freeScenario.length}；進化技能不花 PT，但要先有進化前的技能）
        <details class="cp-more"><summary data-copy-skip>看名單</summary>${chips(g.free.map(freeChip))}</details></li>`);
    }
    const deckHtml = deckGroupHtml(g.deck, false);
    if (deckHtml) blocks.push(`<li><b>靠配卡</b>：${g.deck.length} 個 ${ref('step-deck', '→ ②')}${deckHtml}</li>`);
    if (g.breed.length) {
      const items = g.breed.map(row => `<li>${skillChip(row.name, row.rate)} <span class="cp-muted">PT ${fmt(ptOf(row.skillId))}</span> — ${esc(breedRouteText(row.skillId))}</li>`).join('');
      blocks.push(`<li><b>靠種馬（白因子必帶）</b>：${g.breed.length} 個 ${ref('step-stallion', '→ ⑤')}<ul class="cp-route__list">${items}</ul></li>`);
    }
    if (g.unobtainable.length) {
      const items = g.unobtainable.map(row => `<li>${skillChip(row.name, row.rate)} — ${esc(unobtainableReason(row.skillId))}</li>`).join('');
      blocks.push(`<li><b>台服現在拿不到</b>：${g.unobtainable.length} 個，先不用管 ${ref('step-gap', '→ ③')}<ul class="cp-route__list">${items}</ul></li>`);
    }
    if (g.notBreedable.length) {
      blocks.push(`<li><b>種馬補不到（非白技能）</b>：${g.notBreedable.map(row => `${skillChip(row.name, row.rate)}<span class="cp-muted">（${esc(KIND_LABEL[row.kind] || row.kind)}）</span>`).join(SEP)}</li>`);
    }
    if (g.inherited.length) {
      blocks.push(`<li><b>繼承固有</b>：${rowChips(g.inherited)} <span class="cp-muted">→ 見 D.1</span></li>`);
    }
    return blocks.length ? `<ol class="cp-route__list cp-route__list--num">${blocks.join('')}</ol>` : '<p class="cp-empty">採用率 ≥ 70% 的目標技能在目前門檻下沒有。</p>';
  }

  function minorListHtml(route) {
    const g = route.common;
    const lines = [];
    if (g.free.length) lines.push(`<li>不用管 ${g.free.length} 個：${chips(g.free.map(freeChip))}</li>`);
    if (g.deck.length) lines.push(`<li>配卡有：${rowChips(g.deck)}</li>`);
    if (g.breed.length) lines.push(`<li>種馬補：${rowChips(g.breed)}</li>`);
    const out = [...g.unobtainable, ...g.notBreedable];
    if (out.length) lines.push(`<li>拿不到：${rowChips(out)}</li>`);
    if (g.inherited.length) lines.push(`<li>繼承固有：${rowChips(g.inherited)}</li>`);
    const nicheCount = Object.values(route.niche).reduce((sum, rows) => sum + rows.length, 0);
    if (nicheCount) lines.push(`<li class="cp-muted">採用率 &lt; 30% 的另有 ${nicheCount} 個，見 ③。</li>`);
    if (!lines.length) return '';
    return `<div class="cp-route__minor"><h4>次要（30–70%）</h4><ul class="cp-route__list">${lines.join('')}</ul></div>`;
  }

  function deckSummaryHtml(ctx, route) {
    const lines = ctx.deck.map((slot, i) => {
      if (!slot) return `<li class="cp-muted">第 ${i + 1} 格空著</li>`;
      const support = index.supportById.get(slot.supportId);
      const entry = route.deckAll.find(item => item.supportId === slot.supportId) || { event: [], hint: [], count: 0 };
      return `<li><b>${esc(supportName(support))}</b>${soonTag(support)} ${esc(typeLabel(support.supportType))} ${esc(support.rarity)} · ${esc(ownedText(slot.supportId, slot.borrowed))} · 提供目標技能 ${entry.count} 個（事件 ${entry.event.length}、hint ${entry.hint.length}）</li>`;
    }).join('');
    const flags = [];
    const borrowed = ctx.deck.find(slot => slot && slot.borrowed);
    const borrowedName = borrowed ? supportName(index.supportById.get(borrowed.supportId)) : null;
    for (const entry of route.metaAvail.notOwned) {
      flags.push(`<li class="cp-warn">環境卡 ${esc(supportName(index.supportById.get(entry.supportId)))}（採用 ${pct(entry.rate)}）你沒有，借卡位只有一格${borrowedName ? `（目前借 ${esc(borrowedName)}）` : ''}。</li>`);
    }
    for (const entry of route.metaAvail.notOnTw) {
      const meta = entry.meta || {};
      const name = meta.nameZhTw ? `${meta.nameZhTw}〈${meta.titleZhTw || meta.titleJa || ''}〉` : `${meta.characterJa || ''}〈${meta.titleJa || ''}〉`;
      const raw = meta.supportId != null ? RAW_SUPPORT.get(Number(meta.supportId)) : null;
      const twDate = HAS_CUP_CATALOG ? ((raw && raw.releaseDate) || meta.releaseDateTw || null) : null;
      flags.push(`<li class="cp-warn">環境卡 ${esc(name)}（採用 ${pct(entry.rate)}）${twDate ? `台服 ${esc(String(twDate).slice(0, 10))} 才實裝（規劃日期之後）` : '台服未實裝'}。</li>`);
    }
    const custom = Array.isArray(state.deckByArchetype[ctx.archetype.id]);
    return `<ol class="cp-route__list cp-route__list--num">${lines}</ol>
      ${flags.length ? `<ul class="cp-route__list">${flags.join('')}</ul>` : ''}
      <p class="cp-muted">${custom ? '這是你在 ② 手動調整過的配卡。' : '預設配卡＝此型 meta 卡依採用率排序，優先放持有的卡，最多一張借卡，同角色只放一張。'}旗標只看此型採用率前 ${route.metaAvail.topN} 張。</p>`;
  }

  function ownerText(owner) {
    const status = !owner.released ? '台服尚未開放' : owner.owned ? '持有' : '未持有';
    return `${owner.name}${owner.title ? `〈${owner.title}〉` : ''}（${status}）`;
  }

  function inheritLine(row) {
    let who;
    if (row.owners.length) who = row.owners.map(ownerText).join('、');
    else if (row.unreleasedOwnerIds.length) who = `台服未實裝的衣裝（日服 #${row.unreleasedOwnerIds.join('、#')}）`;
    else who = '查不到擁有此固有的衣裝';
    return `<li>${skillChip(row.name, row.rate)} ← ${esc(who)}</li>`;
  }

  function stallionStepsHtml(ctx, route) {
    const steps = [];
    // 1. inherited uniques
    const n = ctx.inheritTop.length;
    const inheritHtml = n || route.inheritOptionalOwners.length
      ? `${n ? `<ul class="cp-route__list">${route.inheritTopOwners.map(inheritLine).join('')}</ul>` : '<p class="cp-muted">④ 設定不計繼承固有（0 個）。</p>'}
        ${route.inheritOptionalOwners.length ? `<p class="cp-muted">可選（採用率 ≥ 30%，不在前 ${n} 個）：</p><ul class="cp-route__list cp-route__list--minor">${route.inheritOptionalOwners.map(inheritLine).join('')}</ul>` : ''}
        <p class="cp-muted">固有只會從親代／祖代本身傳下來：2 親＋4 祖代的角色從上面挑。</p>`
      : '<p class="cp-muted">門檻以上沒有繼承固有。</p>';
    steps.push(`<li><b>繼承固有</b>（④ 計入前 ${n} 個）${ref('step-gap', '→ ③')}${inheritHtml}</li>`);

    // 2. white factors (④ stage 2)
    const plan = route.whitePlan;
    const s2 = plan.stage2;
    const pPct = Math.round(s2.factorHintChance * 100);
    const factorItem = row => `<li>${skillChip(row.name, row.value)} <span class="cp-muted">PT ${fmt(row.cost)} · 累計 ${fmt(row.cumulative)}（期望 ${fmt(Math.round(row.expectedCumulative))}）</span>${row.inExpected ? '' : ' <em class="cp-tag cp-tag--warn">超過期望切線</em>'}</li>`;
    let whiteHtml = '';
    if (!plan.pool.length) whiteHtml = `<p class="cp-muted">沒有要靠種馬補的白技能（採用率 ≥ ${Number(state.minValueRate)}%）。</p>`;
    else {
      whiteHtml += plan.mustCarry.length ? `<p>必帶（採用率 ≥ 70%）：</p><ul class="cp-route__list">${plan.mustCarry.map(factorItem).join('')}</ul>` : '<p class="cp-muted">必帶：沒有採用率 ≥ 70% 的白技能缺口。</p>';
      whiteHtml += plan.optional.length ? `<p>補 PT 用（④ 期望值切線以內，依 ④ 順序）：</p><ul class="cp-route__list cp-route__list--minor">${plan.optional.map(factorItem).join('')}</ul>` : '';
      if (s2.leftover <= 0) whiteHtml += `<p><b>第一階段已用完 PT</b>，白因子只是保險。</p>`;
      else if (s2.expectedK != null) whiteHtml += `<p><b>要穩定花完剩下的 ${fmt(s2.leftover)} PT，種馬大約要帶到第 ${s2.expectedK} 顆</b>（合計原始 ${fmt(s2.expectedRawCost)} PT，假設每顆出 hint 機率 ${pPct}%）。</p>`;
      else whiteHtml += `<p><b>全部 ${plan.pool.length} 顆都帶上，期望還剩約 ${fmt(Math.round(s2.unspentExpected))} PT</b> → 可把 ④ 無效門檻調低或換配卡。</p>`;
    }
    steps.push(`<li><b>白因子</b> ${ref('step-pt', '→ ④')}${whiteHtml}</li>`);

    // 3. red factors / aptitude
    const apt = route.apt;
    const aptText = entry => {
      if (!entry) return null;
      const label = APT_LABEL[entry.key] || entry.key;
      if (entry.unknown) return `${label}：未選戰馬，不明`;
      if (entry.stepsToS === 0) return `${label} ${entry.letter}（已是 S）`;
      if (entry.stepsToA > 0) return `${label} ${entry.letter}→A 差 ${entry.stepsToA} 階、→S 差 ${entry.stepsToS} 階`;
      return `${label} A→S 差 ${entry.stepsToS} 階`;
    };
    const aptLines = [aptText(apt.surface), aptText(apt.distance), aptText(apt.style)].filter(Boolean);
    const redBreeders = route.breederFacts.filter(b => b.red && b.red.relevant);
    steps.push(`<li><b>紅因子／適性</b> ${ref('step-target', '→ ①')}
      <p>${esc(aptLines.join('、'))}。</p>
      ${ctx.cup.aptitudeNote ? `<p class="cp-muted">meta：${esc(ctx.cup.aptitudeNote)}</p>` : ''}
      <p>升到 S 要靠親代／祖代帶同項目的紅因子（本頁不算星數或機率）。${redBreeders.length ? `現有種馬帶相關紅因子：${redBreeders.map(b => `〈${esc(b.label)}〉${esc(b.red.label)}${b.red.stars == null ? '' : ` ★${b.red.stars}`}`).join('、')}。` : '現有種馬沒有登錄相關紅因子。'}</p></li>`);

    // 4. stallion runs
    const usable = route.candidates.filter(c => c.usable && c.relevant).slice(0, 5);
    const blocked = route.candidates.filter(c => !c.usable && c.relevant);
    const candItem = c => {
      const facts = [];
      if (c.uniqueDemand) facts.push(`固有 ${c.uniqueDemand.name} ${pct(c.uniqueDemand.rate)}`);
      if (c.selfSupplied.length) facts.push(`自帶缺口：${c.selfSupplied.map(e => `${e.name} ${pct(e.rate)}`).join('、')}`);
      const existing = c.existingBreeders.length ? `（已有種馬 ${c.existingBreeders.map(b => `〈${b.label}〉`).join('')}）` : '';
      return `<li><b>${esc(cardName(index.cardById.get(c.cardId)))}</b>${esc(existing)}：${esc(facts.join('；'))}</li>`;
    };
    const candHtml = usable.length
      ? `<ol class="cp-route__list cp-route__list--num">${usable.map(candItem).join('')}</ol>`
      : '<p class="cp-muted">你持有的衣裝沒有一位能傳需求固有或自帶缺口技能。</p>';
    const blockedHtml = blocked.length ? `<p class="cp-muted">與戰馬同角色不能當自己的親：${esc(blocked.map(c => cardName(index.cardById.get(c.cardId))).join('、'))}</p>` : '';

    const sugg = ctx.suggestion;
    const rateById = new Map(ctx.gap.breedableGap.map(row => [row.skillId, row.rate]));
    const hero = ctx.protagonist;
    const heroLine = hero
      ? `<p>種馬局主角（${ctx.protagonistManual ? '你指定' : '假設：候選第 1 位'}）：<b>${esc(cardName(index.cardById.get(hero.cardId)))}</b>。配卡不放同角色的卡；主角自帶的缺口${sugg.preCoveredSkillIds.length ? ` ${chips(sugg.preCoveredSkillIds.map(id => skillChip(skillName(id), rateById.get(id))))} 先算已覆蓋` : '技能：沒有'}。 ${ref('step-stallion', '→ ⑤ 換主角')}</p>`
      : '<p class="cp-muted">沒有可當種馬局主角的持有衣裝，配卡不排除任何角色。</p>';
    const suggCards = sugg.cards.map(card => {
      const support = index.supportById.get(card.supportId);
      return `<li><b>${esc(supportName(support))}</b>（${esc(card.borrowed ? '借卡' : ownedText(card.supportId, false))}）：${card.newlyCovered.length ? `新覆蓋 ${chips(card.newlyCovered.map(id => skillChip(skillName(id), rateById.get(id))))}` : '無新覆蓋（鎖定卡）'}</li>`;
    }).join('');
    const borrowCard = sugg.cards.find(card => card.borrowed);
    const altText = skillId => {
      const source = route.sourcesById.get(skillId);
      if (!source) return '來源資料不明';
      const plan = Core.rankBreedOptions(source);
      if (plan.existingBreeders.length) return `現有種馬〈${plan.existingBreeders[0].label}〉已帶${breederStars(plan.existingBreeders[0])}`;
      const outfit = plan.options.find(option => option.kind === 'owned-outfit');
      if (outfit) return `改用 ${outfitText(outfit.cardId)} 當種馬局主角（自帶）`;
      const card = plan.options.find(option => option.kind === 'owned-card');
      if (card) return `換上 ${breedOptionText(card)}`;
      const borrow = plan.options.find(option => option.kind === 'borrow-card');
      if (borrow) return `只能借 ${supportName(index.supportById.get(borrow.supportId))}${borrowCard ? `（借卡位已給 ${supportShortName(index.supportById.get(borrowCard.supportId))}，要另跑一局）` : ''}`;
      const scen = plan.options.find(option => option.kind === 'scenario');
      if (scen) return breedOptionText(scen);
      const unowned = plan.options.find(option => option.kind === 'unowned-outfit');
      if (unowned) return `只有未持有的衣裝會自帶：${breedOptionText(unowned)}`;
      return source.sourceless ? '台服拿不到，先不用管' : noSourceText(source);
    };
    const uncovered = sugg.uncoveredSkillIds.map(id => `<li>${skillChip(skillName(id), rateById.get(id))} — ${esc(altText(id))}</li>`).join('');

    const breederLines = route.breederFacts.map(b => {
      const facts = [];
      if (b.carriesGap.length) facts.push(`帶缺口白因子 ${b.carriesGap.map(e => `${skillName(e.skillId)}${e.stars == null ? '' : ` ★${e.stars}`}${e.exact ? '' : `（${skillName(e.factorSkillId)}）`}`).join('、')}`);
      if (b.inheritedUnique) facts.push(`固有 ${b.inheritedUnique.name} ${pct(b.inheritedUnique.rate)}${b.inheritedUnique.stars == null ? '' : ` ★${b.inheritedUnique.stars}`}`);
      if (b.red) facts.push(`紅 ${b.red.label}${b.red.stars == null ? '' : ` ★${b.red.stars}`}${b.red.relevant ? '（相關）' : ''}`);
      if (b.blue) facts.push(`藍 ${b.blue.label}${b.blue.stars == null ? '' : ` ★${b.blue.stars}`}`);
      const text = b.carriesGap.length || b.inheritedUnique || (b.red && b.red.relevant) ? facts.join('；') : `與這次缺口無交集（已登錄白因子 ${b.whiteFactorCount} 個）`;
      return `<li><b>〈${esc(b.label)}〉</b>：${esc(text)}</li>`;
    }).join('');

    steps.push(`<li><b>種馬局怎麼跑</b> ${ref('step-stallion', '→ ⑤')}
      <p>候選種馬角色（你持有的衣裝）：</p>
      ${candHtml}
      <p class="cp-muted">排序：先比能傳的需求固有採用率，再比自帶缺口技能的採用率加總，再比自帶個數。</p>
      ${blockedHtml}
      ${heroLine}
      <p>種馬局配卡（同 ⑤ 建議，覆蓋 ${sugg.coveredSkillIds.length} / ${sugg.coveredSkillIds.length + sugg.uncoveredSkillIds.length} 個${sugg.preCoveredSkillIds.length ? `，含主角自帶 ${sugg.preCoveredSkillIds.length} 個` : ''}）：</p>
      ${suggCards ? `<ol class="cp-route__list cp-route__list--num">${suggCards}</ol>` : '<p class="cp-muted">沒有任何卡能覆蓋這些缺口。</p>'}
      ${uncovered ? `<p>配卡沒覆蓋到的，另外這樣補：</p><ul class="cp-route__list">${uncovered}</ul>` : ''}
      <p>現有種馬：</p>
      ${breederLines ? `<ul class="cp-route__list">${breederLines}</ul>` : '<p class="cp-muted">種馬登錄是空的。</p>'}</li>`);

    // 5. order (fixed rules; a line is skipped when it has nothing to say)
    const order = [];
    const battleBorrow = ctx.deck.find(slot => slot && slot.borrowed);
    const borrowParts = [];
    if (battleBorrow) borrowParts.push(`戰馬局借 ${supportName(index.supportById.get(battleBorrow.supportId))}`);
    if (borrowCard) borrowParts.push(`種馬局借 ${supportName(index.supportById.get(borrowCard.supportId))}`);
    if (borrowParts.length) order.push(`先確認借卡位：${borrowParts.join('；')}（每局只能借一張）。`);
    const top = ctx.protagonist;
    const must = plan.mustCarry.filter(row => !lastCtx.unobtainableIds.has(row.skillId));
    if (top || must.length) {
      order.push(`先養帶「必帶白因子＋需求固有」的親代：${top ? `主角用 ${cardName(index.cardById.get(top.cardId))}${top.uniqueDemand ? `（固有 ${top.uniqueDemand.name}）` : ''}` : '主角自選'}${must.length ? `，目標帶上 ${must.map(row => row.name).join('、')}` : ''}。`);
    }
    const missingUniques = route.inheritTopOwners.filter(row => !row.ownerOwned);
    if (missingUniques.length) order.push(`需求固有中你沒有對應衣裝的：${missingUniques.map(row => row.name).join('、')}，只能靠租借種馬或之後抽。`);
    if (plan.optional.length) order.push(`再補次要：${plan.optional.slice(0, 5).map(row => row.name).join('、')}${plan.optional.length > 5 ? ` 等 ${plan.optional.length} 個` : ''}。`);
    const redNeed = [apt.surface, apt.distance, apt.style].filter(entry => entry && !entry.unknown && entry.stepsToS > 0).map(entry => APT_LABEL[entry.key] || entry.key);
    if (redNeed.length) order.push(`親代／祖代的紅因子挑 ${redNeed.join('、')}。`);
    const outCount = route.all.unobtainable.length;
    if (outCount) order.push(`台服拿不到的 ${outCount} 個先不用管。`);
    if (order.length) steps.push(`<li><b>順序建議</b><ol class="cp-route__list cp-route__list--num">${order.map(line => `<li>${esc(line)}</li>`).join('')}</ol></li>`);
    return `<ol class="cp-route__list cp-route__list--num cp-route__steps">${steps.join('')}</ol>`;
  }

  function caveatsHtml(ctx, route) {
    const items = [];
    const invDate = String(INVENTORY.generatedAt || '').slice(0, 10);
    if (route.newerCards.length) {
      items.push(`<li>持有卡截圖是 ${esc(invDate || '不明')}，之後才實裝的 meta 卡一律當「未持有」：${chips(route.newerCards.map(card => `<span class="cp-chip">${esc(supportName(index.supportById.get(card.supportId)))} <small>${pct(card.rate)}・${esc(card.releaseDate)}</small></span>`))} <button type="button" class="ghost cp-small" data-action="open-picker" data-slot="-1" data-copy-skip>編輯持有卡／突破</button></li>`);
    }
    if (Number(state.expectedPt) === DEFAULT_STATE.expectedPt) items.push(`<li>預期 PT 還是預設 ${fmt(DEFAULT_STATE.expectedPt)}，請在 ④ 填你最近幾局的實際數字。 ${ref('step-pt', '→ ④')}</li>`);
    if (!ctx.traineeCard) items.push('<li>戰馬未選，自帶技能都沒算進去。</li>');
    else if (!OWNED_OUTFITS.has(ctx.traineeCard.id)) items.push(`<li>戰馬 ${esc(cardName(ctx.traineeCard))} 不在持有清單。</li>`);
    if (route.unverified.length) items.push(`<li>這些技能只靠劇本〈${esc(scenarioName(currentScenario))}〉給，但取得方式未查證：${rowChips(route.unverified)}</li>`);
    const records = list(BREEDER_REGISTRY.ownedRecords);
    const whiteTotal = route.breederFacts.reduce((sum, b) => sum + b.whiteFactorCount, 0);
    items.push(`<li>種馬登錄只有 ${records.length} 隻、共記錄 ${whiteTotal} 個白因子（多為部分截圖），沒記錄的白因子不計。</li>`);
    return `<ul class="cp-route__list">${items.join('')}</ul>`;
  }

  let lastRoute = null;

  function renderRoute(ctx) {
    const el = document.getElementById('step-route');
    const route = computeRoute(ctx);
    lastRoute = route;
    ctx.route = route;
    el.innerHTML = `<div class="cp-route__head">
        <h2 id="h-route">懶人路線</h2>
        <button type="button" class="ghost cp-small" data-action="copy-route" data-copy-skip>複製路線文字</button>
        <span class="cp-muted" id="routeCopyStatus" role="status" data-copy-skip></span>
      </div>
      <p class="cp-muted" data-copy-skip>只要選好杯賽和戰馬，照這份清單做；下面 ①–⑤ 是每一步的依據（點 → 跳過去）。</p>
      <div class="cp-route__block"><h3>A. 一句話結論</h3>${routeConclusion(ctx, route)}</div>
      <div class="cp-route__block"><h3>B. 必拿清單（採用率 ≥ 70%）</h3>${mustListHtml(route)}${minorListHtml(route)}</div>
      <div class="cp-route__block"><h3>C. 配卡</h3>${deckSummaryHtml(ctx, route)}</div>
      <div class="cp-route__block"><h3>D. 種馬要做的事</h3>${stallionStepsHtml(ctx, route)}</div>
      <div class="cp-route__block"><h3>E. 還要你確認的事</h3>${caveatsHtml(ctx, route)}</div>`;
  }

  // Plain-text export of the route section (for Discord). Walks the DOM:
  // headings become 【】 lines, list items get "1." / "-" with indentation,
  // inline nodes are concatenated; [data-copy-skip] is dropped.
  const BLOCK_TAGS = new Set(['P', 'H2', 'H3', 'H4', 'LI', 'UL', 'OL', 'DIV', 'DETAILS', 'SECTION']);
  function inlineText(node) {
    if (node.nodeType === 3) return node.nodeValue;
    if (node.nodeType !== 1 || node.hasAttribute('data-copy-skip')) return '';
    let text = '';
    node.childNodes.forEach(child => { text += inlineText(child); });
    return text;
  }
  function blockLines(el, indent) {
    const lines = [];
    let buffer = '';
    const flush = () => {
      const text = buffer.replace(/\s+/g, ' ').trim();
      if (text) lines.push(indent + text);
      buffer = '';
    };
    el.childNodes.forEach(child => {
      if (child.nodeType === 1 && child.hasAttribute('data-copy-skip')) return;
      if (child.nodeType === 1 && child.tagName === 'SUMMARY') return;
      if (child.nodeType !== 1 || !BLOCK_TAGS.has(child.tagName)) { buffer += inlineText(child); return; }
      flush();
      if (/^H[2-4]$/.test(child.tagName)) {
        lines.push('');
        lines.push(`${indent}【${inlineText(child).replace(/\s+/g, ' ').trim()}】`);
      } else if (child.tagName === 'UL' || child.tagName === 'OL') {
        let n = 0;
        child.childNodes.forEach(li => {
          if (li.nodeType !== 1 || li.tagName !== 'LI') return;
          n += 1;
          const bullet = child.tagName === 'OL' ? `${n}. ` : '- ';
          const sub = blockLines(li, `${indent}   `);
          if (!sub.length) return;
          sub[0] = indent + bullet + sub[0].trim();
          lines.push(...sub);
        });
      } else {
        lines.push(...blockLines(child, indent));
      }
    });
    flush();
    return lines;
  }
  function routeToText() {
    const el = document.getElementById('step-route');
    const lines = blockLines(el, '');
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  // ------------------------------------------------------------ event choices / activation / evolution text

  const EVENT_MODE_LABEL = {
    manual: '你指定',
    'auto-best': '自動：試過所有組合，④ 採用率加總最大',
    'auto-rule': '自動：選技能價值（採用率）加總較高的選項',
    dominant: '自動：其他選項的技能沒有採用率'
  };
  function eventChoicesFor(supportId) {
    return list(lastCtx && lastCtx.pick && lastCtx.pick.eventChoices).filter(ev => supportId == null || ev.supportId === supportId);
  }
  function chosenChoice(ev) { return ev.choices.find(choice => choice.choiceIndex === ev.chosenIndex) || ev.choices[0]; }
  function choiceLabel(choice) { return `選 ${choice.choiceIndex + 1}：${choice.names.join('＋')}`; }
  function eventChoiceText(ev) { return `事件〈${ev.eventTitle}〉${choiceLabel(chosenChoice(ev))}`; }
  function eventChoiceControl(ev) {
    const auto = ev.mode !== 'manual';
    const opts = ev.choices.map(choice => `<option value="${choice.choiceIndex}"${!auto && choice.choiceIndex === ev.chosenIndex ? ' selected' : ''}>${esc(choiceLabel(choice))}</option>`).join('');
    return `<select data-action="event-choice" data-key="${esc(ev.key)}" aria-label="事件〈${esc(ev.eventTitle)}〉選項" data-copy-skip>
      <option value=""${auto ? ' selected' : ''}>自動（${esc(choiceLabel(chosenChoice(ev)))}）</option>${opts}</select>`;
  }
  // 「選 n」 when a card's event source for this skill comes from an exclusive choice.
  function choiceTagFor(supportId, skillId) {
    const ev = eventChoicesFor(supportId).find(entry => chosenChoice(entry).skillIds.includes(Number(skillId)));
    return ev ? `選 ${ev.chosenIndex + 1}` : '';
  }
  function eventChoiceLine(ev, withControl) {
    return `<span class="cp-evchoice"><span>${esc(eventChoiceText(ev))} <small class="cp-muted">（${esc(EVENT_MODE_LABEL[ev.mode] || ev.mode)}）</small></span>${withControl ? eventChoiceControl(ev) : ''}</span>`;
  }

  const COND_VALUE_LABEL = {
    running_style: { 1: '領頭', 2: '前列', 3: '居中', 4: '後追' },
    distance_type: { 1: '短距離', 2: '英里', 3: '中距離', 4: '長距離' },
    ground_type: { 1: '草地', 2: '泥地' },
    rotation: { 1: '順時針', 2: '逆時針' },
    season: { 1: '春季', 2: '夏季', 3: '秋季', 4: '冬季', 5: '春季' }
  };
  // Back styles (差し / 追込): activation filter only calibrated for 逃げ / 先行.
  const UNVERIFIED_NOTE = '差／追的發動條件判定尚未驗證（目前只校對領頭與前列），結果僅供參考';
  function styleUnverified(archetype) { return !!archetype && !list(Core.VERIFIED_STYLES).includes(archetype.style === '追い込み' ? '追込' : archetype.style); }
  function unverifiedNote(archetype) { return styleUnverified(archetype) ? `<p class="cp-muted">${badge('判定未驗證', 'warn')} ${esc(UNVERIFIED_NOTE)}。</p>` : ''; }
  function eventModeLabel(cup) { return { loh: 'LOH', cm: 'CM' }[cup && cup.eventMode] || ''; }
  function bandSentence() {
    const cup = lastCtx && lastCtx.cup;
    const n = Core.fieldSizeForCup(cup);
    const names = { 1: '領頭', 2: '前列', 3: '居中', 4: '後追' };
    const bands = [1, 2, 3, 4].map(k => { const band = Core.orderBand(k, n); return `${names[k]} ${band[0]}–${band[1]}`; }).join('、');
    const label = eventModeLabel(cup);
    return `「不會發動」＝每一組發動條件都和腳質或本杯賽道（距離、場地、方向、季節、賽場、主要距離）矛盾；名次條件用${label ? ` ${label}` : ''} ${n} 人出走的典型名次帶判定：${bands}（名次帶按人數比例換算、往外取整；名次％＝名次 × 100 ÷ ${n}），條件範圍和名次帶完全不重疊才算（可能發動的，例如「避開力竭賽馬娘」，照常計算）。`;
  }
  function activationReasonText(reason) {
    const labels = COND_VALUE_LABEL[reason.key];
    if (reason.kind === 'position') {
      const style = lastCtx && lastCtx.archetype ? styleLabel(lastCtx.archetype) : '';
      return `名次條件 ${reason.term}（${style}通常第 ${reason.band[0]}–${reason.band[1]} 名／${reason.fieldSize || 18} 人）`;
    }
    let what;
    if (reason.key === 'track_id') what = '其他賽場';
    else if (reason.key === 'is_basis_distance') what = reason.value === 1 ? '主要距離（400m 倍數）' : '非主要距離';
    else if (reason.key === 'course_distance') what = '其他距離';
    else what = labels && labels[reason.value] ? labels[reason.value] : reason.term;
    return `${reason.op === '!=' ? '排除' : '限'}${what}（${reason.term}）`;
  }
  function activationText(activation) {
    const reasons = list(activation && activation.reasons);
    return reasons.length ? reasons.map(activationReasonText).join('；或 ') : '條件不符';
  }

  // Scenario / character evolution: free once its base skill is owned.
  function evolutionBaseId(row) {
    const id = Number(row.skillId);
    const scen = index.scenarioEvolutionById.get(id);
    if (scen) return Number(scen.fromSkillId);
    const trainee = lastCtx && lastCtx.traineeCard;
    const evo = trainee && list(trainee.evolvedSkills).find(entry => Number(entry && entry.new) === id);
    if (evo) return Number(evo.old);
    const chars = index.characterEvolutionById.get(id);
    return chars && chars.length ? Number(chars[0].fromSkillId) : null;
  }
  function evolutionNote(row) {
    if (row.kind !== 'scenario-evolution' && row.kind !== 'character-evolution') return '';
    const baseId = evolutionBaseId(row);
    return baseId == null ? '（進化，自動）' : `（進化，自動；前提：先有 ${skillName(baseId)}）`;
  }
  const freeChip = row => `<span class="cp-chip">${esc(row.name)}${evolutionNote(row) ? `<span class="cp-muted">${esc(evolutionNote(row))}</span>` : ''} <small>${pct(row.rate)}</small></span>`;

  // ------------------------------------------------------------ render ②

  function renderDeck(ctx) {
    const { archetype, deck, traineeCard } = ctx;
    const el = document.getElementById('step-deck');
    const charSlot = new Map();
    deck.forEach((slot, i) => {
      if (!slot) return;
      const support = index.supportById.get(slot.supportId);
      const key = Number(support && support.characterId);
      if (!charSlot.has(key)) charSlot.set(key, []);
      charSlot.get(key).push(i);
    });
    const metaRate = new Map(list(archetype.supportCards).filter(c => c.supportId != null).map(c => [Number(c.supportId), c.rate]));
    const slotsHtml = deck.map((slot, i) => {
      if (!slot) {
        return `<div class="cp-slot is-empty"><span class="cp-slot__num">${i + 1}</span><button type="button" class="ghost" data-action="open-picker" data-slot="${i}">選卡</button></div>`;
      }
      const support = index.supportById.get(slot.supportId);
      const info = ownedInfo(slot.supportId);
      const problems = [];
      if (!slot.borrowed && !info.owned) problems.push('未持有：改成借卡，或在選卡視窗標記持有');
      if ((charSlot.get(Number(support.characterId)) || []).length > 1) problems.push('同角色重複（遊戲不允許）');
      if (traineeCard && Number(traineeCard.characterId) === Number(support.characterId)) problems.push('與戰馬同角色（遊戲不允許）');
      const status = slot.borrowed ? badge('借卡（視為滿突）', 'borrow') : badge(lbText(info), info.owned ? 'ok' : 'warn');
      return `<div class="cp-slot${problems.length ? ' has-problem' : ''}${slot.borrowed ? ' is-borrowed' : ''}">
        <span class="cp-slot__num">${i + 1}</span>
        ${thumb(slot.supportId, support)}
        <span class="cp-slot__body">
          <strong>${esc(supportName(support))}</strong>${soonTag(support)}
          <span class="cp-muted">${esc(typeLabel(support.supportType))} ${esc(support.rarity)}${metaRate.has(slot.supportId) ? ` · 此型採用 ${pct(metaRate.get(slot.supportId))}` : ''}</span>
          <span>${status}</span>
          ${problems.map(text => `<span class="cp-warn">${esc(text)}</span>`).join('')}
          ${eventChoicesFor(slot.supportId).map(ev => eventChoiceLine(ev, true)).join('')}
        </span>
        <span class="cp-slot__actions">
          <button type="button" class="ghost" data-action="open-picker" data-slot="${i}">換卡</button>
          <button type="button" class="ghost" data-action="toggle-borrow" data-slot="${i}" aria-pressed="${slot.borrowed}">${slot.borrowed ? '取消借卡' : '設為借卡'}</button>
          <button type="button" class="ghost" data-action="clear-slot" data-slot="${i}">移除</button>
        </span>
      </div>`;
    }).join('');

    const inDeck = new Set(deck.filter(Boolean).map(slot => slot.supportId));
    const metaRows = list(archetype.supportCards).slice().sort((a, b) => b.rate - a.rate).map(meta => {
      const name = meta.nameZhTw ? `${meta.nameZhTw}〈${meta.titleZhTw || meta.titleJa || ''}〉` : `${meta.characterJa || ''}〈${meta.titleJa || ''}〉`;
      const support = meta.supportId != null ? index.supportById.get(Number(meta.supportId)) : null;
      let status;
      let action = '';
      if (!support || (!HAS_CUP_CATALOG && meta.twReleased === false)) {
        const raw = meta.supportId != null ? RAW_SUPPORT.get(Number(meta.supportId)) : null;
        const twDate = (raw && raw.releaseDate) || meta.releaseDateTw || null;
        status = HAS_CUP_CATALOG && twDate
          ? badge(`台服 ${String(twDate).slice(0, 10)} 實裝`, 'warn') + `<br><span class="cp-muted">在規劃日期 ${esc(ctx.planDate)} 之後，預設配卡已跳過</span>`
          : badge(HAS_CUP_CATALOG ? '台服未排程' : '台服未實裝', 'warn') + '<br><span class="cp-muted">預設配卡已跳過</span>';
      } else {
        const info = ownedInfo(support.id);
        status = (info.owned ? badge(lbText(info), 'ok') : badge('未持有（可借）', 'borrow')) + soonTag(support);
        action = inDeck.has(support.id) ? '<span class="cp-muted">已在配卡</span>' : `<button type="button" class="ghost cp-small" data-action="add-meta" data-id="${support.id}">加入</button>`;
      }
      const typeText = support ? typeLabel(support.supportType) : (meta.typeJa || '');
      return `<tr${support ? '' : ' class="is-unreleased"'}><td><div class="cp-meta-card">${support ? thumb(support.id, support) : ''}<span><span>${esc(name)}</span><br><span class="cp-muted">${esc(typeText)} ${esc(meta.rarity || '')}</span></span></div></td><td>${rateCell(meta.rate)}</td><td>${status}</td><td class="cp-nowrap">${action}</td></tr>`;
    }).join('');

    el.innerHTML = `<h2 id="h-deck">② 戰馬配卡</h2>
      <p class="cp-muted">預設＝此型 meta 卡依採用率排序，優先放持有的卡，最多一張借卡（任何台服已實裝卡，視為滿突）。同一角色不能出現兩次。</p>
      ${eventChoicesFor(null).length ? '<p class="cp-muted">卡事件的選項互斥：同一事件只能選一個，只在沒選的選項上的技能就拿不到那張卡的事件來源。預設自動選讓 ④ 採用率加總最大的選項；改選後 ②③④ 都照新選項重算。</p>' : ''}
      <div class="cp-deck-layout">
        <div>
          <div class="cp-slots">${slotsHtml}</div>
          <div class="cp-row">
            <button type="button" class="ghost" data-action="reset-deck">重設為預設配卡</button>
            <button type="button" class="ghost" data-action="open-picker" data-slot="-1">編輯持有卡／突破</button>
          </div>
        </div>
        <div>
          <h3>此型 meta 支援卡（JP 前 300）</h3>
          <table class="cp-table cp-table--meta"><thead><tr><th>卡</th><th>採用率</th><th>你的狀態</th><th></th></tr></thead><tbody>${metaRows}</tbody></table>
        </div>
      </div>`;
  }

  // ------------------------------------------------------------ render ③

  function sourceBadges(row) {
    const out = [];
    const src = row.sources || {};
    if (src.trainee) {
      const exact = src.traineeExact === false ? `（由 ${skillName(src.traineeMatchedSkillId)}）` : '';
      out.push(badge(`自帶：${TRAINEE_VIA_LABEL[src.trainee] || src.trainee}${exact}`, 'ok'));
    }
    for (const entry of list(src.deck)) {
      const support = index.supportById.get(entry.supportId);
      const via = entry.via === 'event' ? '卡事件' : '卡 hint';
      const through = entry.exact ? '' : `（${skillName(entry.matchedSkillId)}）`;
      const choice = entry.via === 'event' ? choiceTagFor(entry.supportId, entry.matchedSkillId) : '';
      out.push(badge(`${via}：〈${supportShortName(support)}〉${choice}${through}`, entry.via === 'event' ? 'event' : 'hint'));
    }
    if (src.scenario) out.push(badge(`劇本${currentScenario ? `：${scenarioName(currentScenario)}` : ''}`, 'scenario'));
    return out.join(' ');
  }

  function partialHint(row) {
    const partial = list(row.sources && row.sources.deckPartial);
    if (!partial.length) return '';
    return partial.map(entry => `<span class="cp-muted cp-partial">〈${esc(supportShortName(index.supportById.get(entry.supportId)))}〉只給下位技能 hint（${esc(skillName(entry.matchedSkillId))}）</span>`).join('');
  }

  function renderGap(ctx) {
    const { gap, traineeCard } = ctx;
    const el = document.getElementById('step-gap');
    const rateOptions = MIN_RATE_OPTIONS.map(value => `<option value="${value}"${Number(state.minRate) === value ? ' selected' : ''}>≥ ${value}%</option>`).join('');
    const s = gap.summary;
    const sortRate = rows => rows.slice().sort((a, b) => b.rate - a.rate);

    const coveredRows = sortRate(gap.covered).map(row => `<tr>
      <td data-label="技能"><strong>${esc(row.name)}</strong>${row.unknown ? ' ' + badge('目錄查無', 'warn') : ''}${evolutionNote(row) ? `<br><span class="cp-muted">${esc(evolutionNote(row))}</span>` : ''}</td>
      <td data-label="發動時機">${esc(row.phase || '—')}</td>
      <td data-label="採用率">${rateCell(row.rate)}</td>
      <td data-label="單價 PT" class="cp-num">${row.cost == null ? '—' : fmt(row.cost)}</td>
      <td data-label="來源">${sourceBadges(row)}${partialHint(row)}</td>
    </tr>`).join('');

    const { unobtainableIds, unobtainableRows, excludeUnobtainable } = ctx;
    const breedableShown = excludeUnobtainable ? gap.breedableGap.filter(row => !unobtainableIds.has(row.skillId)) : gap.breedableGap;
    const unobtainableBlock = unobtainableRows.length ? `<details class="cp-details"${excludeUnobtainable ? '' : ' open'}><summary>台服目前拿不到 ${unobtainableRows.length} 個（${excludeUnobtainable ? '已從缺口與 PT 排除' : '仍列在缺口與 PT 內'}）</summary>
      <p class="cp-muted">台服沒有任何卡、馬娘、劇本來源，你的種馬也都沒帶。原因見 ⑤。</p>
      <ul class="cp-plain">${sortRate(unobtainableRows).map(row => `<li><strong>${esc(row.name)}</strong> ${pct(row.rate)}${unobtainableIds.has(row.skillId) && !excludeUnobtainable ? ' ' + badge('拿不到', 'danger') : ''}</li>`).join('')}</ul></details>` : '';
    const breedable = sortRate(breedableShown).map(row => `<tr>
      <td data-label="技能"><strong>${esc(row.name)}</strong></td>
      <td data-label="發動時機">${esc(row.phase || '—')}</td>
      <td data-label="採用率">${rateCell(row.rate)}</td>
      <td data-label="單價 PT" class="cp-num">${row.cost == null ? '—' : fmt(row.cost)}</td>
      <td data-label="備註">${partialHint(row) || '<span class="cp-muted">戰馬、配卡、劇本都沒有</span>'}</td>
    </tr>`).join('');

    const otherGap = sortRate(gap.gap.filter(row => row.kind !== 'white'));
    const otherList = otherGap.length ? `<h3>不適用／需確認 <span class="cp-count">${otherGap.length}</span></h3>
      <ul class="cp-plain">${otherGap.map(row => `<li><strong>${esc(row.name)}</strong> ${pct(row.rate)} — ${esc(KIND_LABEL[row.kind] || row.kind)}${row.scenarioEvolution ? `（${esc(gametoraScenarioLabel(row.scenarioEvolution.scenarioId))}，由 ${esc(skillName(row.scenarioEvolution.fromSkillId))} 進化）` : ''}</li>`).join('')}</ul>
      <p class="cp-muted">這些不是白因子，種馬補不到。</p>` : '';

    const inherited = sortRate(gap.inheritedUniques).map(row => `<tr>
      <td data-label="技能"><strong>${esc(row.name)}</strong>${row.nameJa && row.nameJa !== row.name ? `<br><span class="cp-muted">${esc(row.nameJa)}</span>` : ''}</td>
      <td data-label="採用率">${rateCell(row.rate)}</td>
      <td data-label="PT" class="cp-num">${row.cost == null ? '—' : fmt(row.cost)}</td>
    </tr>`).join('');

    const noTrainee = !traineeCard ? '<p class="cp-warn">未選戰馬：自帶技能一律不計。</p>' : '';
    const dead = sortRate(list(gap.impossible));
    const deadBlock = dead.length ? `<details class="cp-details"><summary>不會發動 ${dead.length} 個（${esc(styleLabel(ctx.archetype))}在本杯賽道不可能觸發，已從缺口、PT 與懶人路線排除）</summary>
      <ul class="cp-plain">${dead.map(row => `<li><strong>${esc(row.name)}</strong> ${pct(row.rate)} — ${esc(activationText(row.activation))}</li>`).join('')}</ul>
      <p class="cp-muted">${esc(bandSentence())}</p></details>` : '';
    el.innerHTML = `<h2 id="h-gap">③ 技能缺口</h2>
      <div class="cp-row">
        <label class="cp-field"><span>採用率門檻</span><select id="minRateSelect">${rateOptions}</select></label>
        <label class="cp-check"><input type="checkbox" id="excludeUnobtainable"${excludeUnobtainable ? ' checked' : ''} /> 排除台服目前拿不到的技能</label>
      </div>
      <p>目標技能 <b>${s.targetCount}</b> 個 ＝ 已有來源 <b>${s.coveredCount}</b> ＋ 缺口 <b>${s.gapCount}</b> ＋ 繼承固有 <b>${s.inheritedUniqueCount}</b>${s.impossibleCount ? ` ＋ 不會發動 <b>${s.impossibleCount}</b>` : ''}${unobtainableRows.length ? `（缺口中 ${unobtainableRows.length} 個台服目前拿不到）` : ''}</p>
      ${noTrainee}
      ${deadBlock}
      <h3>已有來源 <span class="cp-count">${gap.covered.length}</span></h3>
      ${gap.covered.length ? `<table class="cp-table cp-table--rows"><thead><tr><th>技能</th><th>發動時機</th><th>採用率</th><th class="cp-num">單價 PT</th><th>來源</th></tr></thead><tbody>${coveredRows}</tbody></table>` : '<p class="cp-empty">沒有任何目標技能有來源。</p>'}
      <h3>缺口：要靠種馬白因子 <span class="cp-count">${breedableShown.length}</span></h3>
      ${breedableShown.length ? `<table class="cp-table cp-table--rows"><thead><tr><th>技能</th><th>發動時機</th><th>採用率</th><th class="cp-num">單價 PT</th><th>備註</th></tr></thead><tbody>${breedable}</tbody></table>` : '<p class="cp-empty">沒有白技能缺口。</p>'}
      ${unobtainableBlock}
      ${otherList}
      <h3>繼承固有 <span class="cp-count">${gap.inheritedUniques.length}</span></h3>
      <p class="cp-muted">來自親代（種馬）本身的固有技能，需在種馬局選對角色。</p>
      ${gap.inheritedUniques.length ? `<table class="cp-table cp-table--rows cp-table--narrow"><thead><tr><th>技能</th><th>採用率</th><th class="cp-num">PT</th></tr></thead><tbody>${inherited}</tbody></table>` : '<p class="cp-empty">門檻以上沒有繼承固有。</p>'}
      <p class="cp-muted">單價 PT ＝ 該技能本身價格（meta 表）；實際要買的連鎖價（金技含白技、◎含○）在 ④ 計算。</p>`;
  }

  // ------------------------------------------------------------ render ④

  // ④ 技能取捨 — renders CupPickCore.planSkillPicks (ctx.pick).
  const VERDICT_LABEL = { owned: '自帶', forced: '一定買', must: '必點', worth: '划算', drop: '可放', invalid: '無效', excluded: '不買', 'inherit-off': '未計入', impossible: '不會發動' };
  const VERDICT_TONE = { owned: 'ok', forced: 'event', must: 'ok', worth: 'hint', drop: 'muted', invalid: 'muted', excluded: 'warn', 'inherit-off': 'muted', impossible: 'danger' };

  function lvText(lv) { return lv == null ? '—' : (lv ? `Lv${lv}` : '無'); }

  function pickSourceText(row) {
    if (row.inheritedUnique) {
      const owners = list(row.owners);
      return owners.length ? `繼承固有（${owners.slice(0, 2).map(o => `${o.name}${o.title ? `〈${o.title}〉` : ''}${o.owned ? '・持有' : ''}`).join('、')}${owners.length > 2 ? ` 等 ${owners.length} 位` : ''}）` : '繼承固有';
    }
    const parts = list(row.levelInfo && row.levelInfo.parts).map(part => {
      const through = part.exact === false && part.matchedSkillId != null ? `・${skillName(part.matchedSkillId)}` : '';
      if (part.kind === 'deck-event') {
        const choice = choiceTagFor(part.supportId, part.matchedSkillId);
        return `〈${supportShortName(index.supportById.get(part.supportId))}〉事件${choice ? `（${choice}）` : ''} ${part.routeKnown ? `固定+${part.level}` : `Lv${part.level}（無事件資料）`}${through}`;
      }
      if (part.kind === 'deck-hint') return `〈${supportShortName(index.supportById.get(part.supportId))}〉hint${through}`;
      if (part.kind === 'trainee') return `戰馬${TRAINEE_VIA_LABEL[part.via] || part.via}${through}`;
      if (part.kind === 'scenario') return `劇本${currentScenario ? `〈${scenarioName(currentScenario)}〉` : ''}`;
      return '';
    }).filter(Boolean);
    if (!parts.length && !row.owned) parts.push('經由上位技能連鎖購買');
    return parts.join('、');
  }

  function evoText(row) {
    const evos = list(row.evolutions);
    if (!evos.length) return '';
    return `<br><span class="cp-muted">含進化 ${evos.map(e => `${esc(e.name)} ${pct(e.rate)}`).join('、')}</span>`;
  }

  function pickControls(row, pickState) {
    if (row.owned) return '';
    const id = row.skillId;
    const inc = pickState.include.includes(id);
    const exc = pickState.exclude.includes(id);
    const lvVal = pickState.hintLv[id];
    const lvSelect = `<select data-action="pick-lv" data-id="${id}" aria-label="${esc(row.name)} hint 等級">
      <option value=""${lvVal === undefined ? ' selected' : ''}>自動</option>
      ${[0, 1, 2, 3, 4, 5].map(value => `<option value="${value}"${lvVal === value ? ' selected' : ''}>${value ? `Lv${value}` : '無'}</option>`).join('')}
    </select>`;
    return `<span class="cp-pickctl">
      <button type="button" class="ghost cp-small${inc ? ' is-on' : ''}" data-action="pick-include" data-id="${id}" aria-pressed="${inc}">一定買</button>
      <button type="button" class="ghost cp-small${exc ? ' is-on' : ''}" data-action="pick-exclude" data-id="${id}" aria-pressed="${exc}">不買</button>
      ${lvSelect}
    </span>`;
  }

  function pickRowHtml(row, pickState, extraCell) {
    const tierMark = row.inheritedUnique ? '繼承固有' : row.tier === 3 ? '金' : row.tier === 2 ? '◎' : '白';
    const lvTag = row.levelInfo && row.levelInfo.overridden ? ' <em class="cp-tag">手動</em>' : '';
    return `<tr class="cp-pickrow cp-pickrow--${esc(row.verdict)}">
      <td data-label="技能"><strong>${esc(row.name)}</strong> ${badge(VERDICT_LABEL[row.verdict], VERDICT_TONE[row.verdict])}${evoText(row)}</td>
      <td data-label="階">${esc(tierMark)}</td>
      <td data-label="來源">${esc(pickSourceText(row))}</td>
      <td data-label="hint" class="cp-nowrap">${esc(lvText(row.hintLv))}${lvTag}</td>
      <td data-label="PT（原價）" class="cp-num">${row.owned ? '0' : `${fmt(row.cost)} <small class="cp-muted">(${fmt(row.baseCost)})</small>`}</td>
      <td data-label="採用率">${rateCell(row.value)}${row.value !== row.rate ? `<br><small class="cp-muted">本身 ${pct(row.rate)}</small>` : ''}</td>
      <td data-label="每 100 PT" class="cp-num">${row.valuePer100 == null ? '—' : fmt(Math.round(row.valuePer100 * 10) / 10)}</td>
      ${extraCell != null ? `<td data-label="輪到" class="cp-num">${extraCell}</td>` : ''}
      <td data-label="調整">${pickControls(row, pickState)}</td>
    </tr>`;
  }

  function pickTable(rows, pickState, withExtra) {
    if (!rows.length) return '<p class="cp-empty">沒有。</p>';
    const head = `<tr><th>技能</th><th>階</th><th>來源</th><th>hint</th><th class="cp-num">PT（原價）</th><th>採用率</th><th class="cp-num">每 100 PT</th>${withExtra ? '<th class="cp-num">輪到</th>' : ''}<th>調整</th></tr>`;
    const body = rows.map(row => pickRowHtml(row, pickState, withExtra ? (row.extraPt == null ? '—' : `加 ${fmt(row.extraPt)} PT`) : null)).join('');
    return `<table class="cp-table cp-table--rows cp-table--pick"><thead>${head}</thead><tbody>${body}</tbody></table>`;
  }

  function factorReferenceHtml() {
    const model = FACTOR_STRATEGY && FACTOR_STRATEGY.inheritanceProbabilityModel;
    const proxy = FACTOR_STRATEGY && FACTOR_STRATEGY.skillFactorModel;
    const sources = FACTOR_STRATEGY ? list(FACTOR_STRATEGY.sources) : [];
    const parts = [];
    if (model && model.baseInheritancePercentByStars && model.baseInheritancePercentByStars.skill) {
      const skill = model.baseInheritancePercentByStars.skill;
      const src = sources.find(entry => entry && entry.id === model.sourceId);
      parts.push(`白因子每次繼承的基礎觸發率 ★1/★2/★3 ＝ ${esc(skill[1])}/${esc(skill[2])}/${esc(skill[3])}%，再乘相性加成 ${esc(model.compatibilityMultiplier || '')}（${src ? `<a href="${esc(src.url)}" target="_blank" rel="noopener noreferrer">${esc(src.label)}</a>，${esc(src.date || '')}` : esc(model.sourceId || '')}；社群分析，未驗證）`);
    }
    if (proxy && proxy.ordinarySkill != null) {
      parts.push(`本站因子策略頁用的代理值：一般 ${Math.round(proxy.ordinarySkill * 100)}%、◎ ${Math.round(proxy.doubleCircleSkill * 100)}%、金 ${Math.round(proxy.goldSkill * 100)}%（社群假設，非官方）`);
    }
    return parts.length ? `<p class="cp-muted cp-ref-note">參考：${parts.join('；')}。一局有兩次繼承、每顆因子有多次機會，所以「一局內至少出一次 hint」會比單次觸發率高很多；p 請依自己的經驗調。</p>` : '';
  }

  function renderPt(ctx) {
    const { pick, pickState } = ctx;
    const s1 = pick.stage1;
    const s2 = pick.stage2;
    const el = document.getElementById('step-pt');
    const lvOptions = (current, labelZero) => [0, 1, 2, 3, 4, 5].map(value => `<option value="${value}"${Number(current) === value ? ' selected' : ''}>${value === 0 ? labelZero || '無 hint' : `Lv${value}`}（-${HINT_DISCOUNT_BY_LEVEL[value]}%）</option>`).join('');
    const sharpOn = state.sharp !== false;
    const inheritOptions = [0, 1, 2, 3, 4, 5, 6].map(value => `<option value="${value}"${Number(state.inheritN) === value ? ' selected' : ''}>${value} 個</option>`).join('');
    const chanceOptions = HINT_CHANCE_OPTIONS.map(value => `<option value="${value}"${Number(state.factorHintChance) === value ? ' selected' : ''}>${value === 100 ? '上限（全部出 hint）' : `${value}%`}</option>`).join('');
    const floorOptions = MIN_VALUE_OPTIONS.map(value => `<option value="${value}"${Number(state.minValueRate) === value ? ' selected' : ''}>&lt; ${value}%</option>`).join('');
    const pPct = Math.round(s2.factorHintChance * 100);

    const buyRows = [...s1.forced, ...s1.must, ...s1.worth];
    const free = s1.owned;
    const boughtCount = s1.boughtCount;
    const inheritedList = s1.inherited.length ? `<details class="cp-details"><summary>繼承固有（${s1.inherited.filter(r => r.included).length} / ${s1.inherited.length} 個計入第一階段）</summary>
      <ul class="cp-plain cp-inherit-list">${s1.inherited.map(r => `<li><label class="cp-check"><input type="checkbox" data-action="pick-inherit" data-id="${r.skillId}"${r.included ? ' checked' : ''} /> 已確定種馬會帶</label> <strong>${esc(r.name)}</strong> ${pct(r.rate)} · ${fmt(r.cost)} PT${r.pinned === null ? `<span class="cp-muted">（預設：${r.defaultIncluded ? `採用率前 ${Number(state.inheritN) || 0}` : '未計入'}）</span>` : ''}${r.owners.length ? `<br><span class="cp-muted">親代要是：${esc(r.owners.slice(0, 3).map(o => `${o.name}${o.title ? `〈${o.title}〉` : ''}${o.owned ? '（持有）' : ''}`).join('、'))}${r.owners.length > 3 ? ` 等 ${r.owners.length} 位` : ''}</span>` : '<br><span class="cp-muted">台服沒有擁有此固有的衣裝</span>'}</li>`).join('')}</ul></details>` : '';

    // stage 2 table with both cut markers
    const L = s2.leftover;
    const poolRows = [];
    let detDrawn = false;
    let expDrawn = false;
    s2.pool.forEach((item, i) => {
      if (!detDrawn && !item.inDeterministic) {
        detDrawn = true;
        poolRows.push(`<tr class="cp-cut"><td colspan="8">切線（全部都拿到 hint）：累計超過剩下的 ${fmt(L)} PT</td></tr>`);
      }
      if (!expDrawn && !item.inExpected && pPct < 100) {
        expDrawn = true;
        poolRows.push(`<tr class="cp-cut cp-cut--exp"><td colspan="8">切線（期望值，p ＝ ${pPct}%）：p × 累計 ≥ ${fmt(L)} PT</td></tr>`);
      }
      const comp = item.components.length > 1 ? `<br><span class="cp-muted">${esc(item.components.map(c => `${c.name} ${fmt(c.cost)}`).join(' ＋ '))}</span>` : '';
      poolRows.push(`<tr class="${item.inExpected ? 'is-within' : 'is-beyond'}">
        <td data-label="#">${i + 1}</td>
        <td data-label="技能"><strong>${esc(item.name)}</strong>${item.mustCarry ? ' ' + badge('必帶', 'danger') : ''}${evoText(item)}${comp}</td>
        <td data-label="採用率">${rateCell(item.value)}</td>
        <td data-label="PT" class="cp-num">${fmt(item.cost)}</td>
        <td data-label="每 100 PT" class="cp-num">${item.valuePer100 == null ? '—' : fmt(Math.round(item.valuePer100 * 10) / 10)}</td>
        <td data-label="累計 PT" class="cp-num">${fmt(item.cumulative)}</td>
        <td data-label="期望累計" class="cp-num">${fmt(Math.round(item.expectedCumulative))}</td>
        <td data-label="來源">${esc(lastRouteSourceShort(item.skillId))}</td>
      </tr>`);
    });

    let detLine;
    if (L <= 0) detLine = `第一階段已用完預期 PT（剩 ${fmt(L)}），種馬白因子不會變成實際購買。`;
    else if (!s2.pool.length) detLine = `剩 ${fmt(L)} PT，但沒有要靠種馬的技能（門檻 ${Number(state.minValueRate)}%）。`;
    else if (s2.allFitDeterministic) detLine = `若全部都拿到 hint：${s2.pool.length} 個全買也只花 ${fmt(s2.pool[s2.pool.length - 1].cumulative)} PT，還剩 ${fmt(L - s2.pool[s2.pool.length - 1].cumulative)}。`;
    else detLine = `若全部都拿到 hint：買到第 ${s2.deterministicCount} 個（${s2.deterministicCount ? esc(s2.pool[s2.deterministicCount - 1].name) : '—'}，合計 ${fmt(s2.deterministicSpent)} PT）就剩不到下一個。`;
    let expLine;
    if (L <= 0 || pPct >= 100) expLine = '';
    else if (s2.expectedK != null) expLine = `期望值：要穩定花完 ${fmt(L)} PT，種馬大約要帶到第 ${s2.expectedK} 顆（合計原始 ${fmt(s2.expectedRawCost)} PT 的技能，× ${pPct}% ≈ ${fmt(Math.round(s2.expectedAbsorbed))} PT）；期望採用率加總 ${fmt(s2.expectedValue)}。`;
    else expLine = `期望值：把 ${s2.pool.length} 顆全帶上，期望也只花得掉 ${fmt(Math.round(s2.expectedAbsorbed))} PT，平均還剩約 ${fmt(Math.round(s2.unspentExpected))} PT 用不掉 → 可把無效門檻降到 ${MIN_VALUE_OPTIONS.filter(v => v < Number(state.minValueRate)).map(v => `${v}%`).join('／') || '更低'}，或換配卡。期望採用率加總 ${fmt(s2.expectedValue)}。`;

    const invalidList = s1.invalid.length ? `<details class="cp-details"><summary>無效（採用率 &lt; ${Number(state.minValueRate)}%）${s1.invalid.length} 個：有 PT 也不買</summary>${pickTable(s1.invalid, pickState, false)}</details>` : '';
    const excludedList = s1.excluded.length ? `<details class="cp-details" open><summary>你設為不買 ${s1.excluded.length} 個</summary>${pickTable(s1.excluded, pickState, false)}</details>` : '';
    const freeList = free.length ? `<details class="cp-details"><summary>戰馬自帶（不花 PT）${free.length} 個，採用率加總 ${fmt(s1.ownedValue)}</summary>${pickTable(free, pickState, false)}</details>` : '';
    const deadRows = s1.impossible;
    const deadList = deadRows.length ? `<details class="cp-details"><summary>不會發動 ${deadRows.length} 個（${esc(styleLabel(ctx.archetype))}在本杯賽道不可能觸發）：不買、不列入種馬補</summary>
      <ul class="cp-plain cp-dead-list">${deadRows.map(row => `<li><strong>${esc(row.name)}</strong> ${badge('不會發動', 'danger')} ${pct(row.rate)}${row.hasSource ? '' : ' <span class="cp-muted">（戰馬／配卡／劇本也沒有）</span>'}<br><span class="cp-muted">${esc(activationText(row.activation))}</span> <button type="button" class="ghost cp-small${pickState.include.includes(row.skillId) ? ' is-on' : ''}" data-action="pick-include" data-id="${row.skillId}" aria-pressed="false">一定買</button></li>`).join('')}</ul>
      <p class="cp-muted">${esc(bandSentence())}「一定買」可強制計入。</p></details>` : '';
    const choiceList = list(pick.eventChoices).length ? `<div class="cp-evchoices"><h3>卡事件選項（同一事件只能選一個）</h3>
      <ul class="cp-plain">${pick.eventChoices.map(ev => `<li><b>${esc(supportShortName(index.supportById.get(ev.supportId)))}</b>：${eventChoiceLine(ev, true)}</li>`).join('')}</ul>
      <p class="cp-muted cp-rule">規則：每個事件只算一個選項。自動＝其他選項的技能都沒有採用率就直接選有的；兩個以上選項都有價值時，試遍所有組合（最多 ${Pick.MAX_CHOICE_COMBOS} 種）各跑一次第一階段，取採用率加總最大（同分取花費少）；組合太多時改為每個事件選技能價值加總較高的。沒選的選項上的技能就沒有這張卡的事件來源（hint 清單或其他卡仍算）。</p></div>` : '';
    const anyOverride = pickState.include.length || pickState.exclude.length || Object.keys(pickState.hintLv).length || Object.keys(pickState.inherit).length || Object.keys(pickState.eventChoice).length;

    el.innerHTML = `<h2 id="h-pt">④ 技能取捨</h2>
      ${unverifiedNote(ctx.archetype)}
      <p class="cp-lead">技能的「價值」＝JP 前 300 名同型玩家的採用率：大家在同樣的 PT 上限下實際買了什麼，就是最直接的取捨依據。</p>
      <div class="cp-row cp-row--controls">
        <label class="cp-field"><span>預期 PT</span><input id="expectedPtInput" type="number" min="0" step="50" inputmode="numeric" value="${esc(state.expectedPt)}" /><small class="cp-help">結算時『已花＋剩餘』的技能 PT</small></label>
        <label class="cp-field"><span>配卡 hint 清單 Lv（白／金）</span><select id="whiteHintLvSelect">${lvOptions(state.whiteHintLv)}</select></label>
        <label class="cp-field"><span>卡事件無資料時 Lv</span><select id="goldHintLvSelect">${lvOptions(state.goldHintLv)}</select></label>
        <label class="cp-field"><span>戰馬覺醒技能 Lv</span><select id="awakeningHintLvSelect">${lvOptions(state.awakeningHintLv)}</select></label>
        <label class="cp-field cp-field--check"><span>切者（再 -10%）</span><input id="sharpCheck" type="checkbox"${sharpOn ? ' checked' : ''} /></label>
        <label class="cp-field"><span>白因子 hint Lv</span><select id="inheritedWhiteHintLvSelect">${lvOptions(state.inheritedWhiteHintLv)}</select></label>
        <label class="cp-field"><span>因子出 hint 機率 p <em class="cp-tag">假設值，可調</em></span><select id="factorHintChanceSelect">${chanceOptions}</select></label>
        <label class="cp-field"><span>無效門檻</span><select id="minValueRateSelect">${floorOptions}</select></label>
        <label class="cp-field"><span>計入繼承固有（預設前 N 個）</span><select id="inheritNSelect">${inheritOptions}</select></label>
      </div>
      <p class="cp-muted">預設照上限規劃：配卡 hint 清單裡的技能（白、金）全部以 Lv5 取得；卡事件（連續事件與隨機事件）給的技能用事件資料的等級（同一選項有多種結果取最高，多張卡相加，最多 Lv5），沒有事件資料時用「卡事件無資料時 Lv」；同時在 hint 清單的取兩者較高；切者開。價格＝floor（原價 ×（1 − hint 折扣 − 切者 10%）），hint Lv1–5 ＝ 10／20／30／35／40%。戰馬覺醒技能資料沒有 hint 等級，用上面的設定（預設 Lv3）。金技要連同還沒有的白技一起買，◎ 要連同 ○。</p>
      <p class="cp-muted">只算會（或可能）發動的技能：${esc(bandSentence())}</p>
      <p class="cp-muted">同系列技能不重複計：買到 ○ 的價值＝至少有 ○ 的人數比例；升 ◎ 的追加價值＝至少有 ◎ 的比例（金同理）。進化技能的採用率算在進化前的技能上（戰馬自己的進化、目前劇本的進化）。</p>
      <div class="cp-equation" aria-label="第一階段結果">
        <span><small>預期 PT</small><b>${fmt(s1.budget)}</b></span><i>−</i>
        <span><small>花掉（買 ${boughtCount} 個）</small><b>${fmt(s1.spent)}</b></span><i>＝</i>
        <span class="${s1.leftover > 0 ? 'is-pos' : 'is-neg'}"><small>剩下＝要種馬補</small><b>${fmt(s1.leftover)}</b></span>
      </div>
      ${s1.overBudget ? `<p class="cp-alert">「一定買」的技能合計 ${fmt(s1.baselineCost)} PT 已超過預期 PT。</p>` : ''}
      ${anyOverride ? `<p class="cp-muted">有手動調整。<button type="button" class="cp-linkbtn" data-action="pick-reset">全部清除</button></p>` : ''}
      ${choiceList}
      <h3>買單 <span class="cp-count">${buyRows.length}</span></h3>
      ${pickTable(buyRows, pickState, false)}
      <p class="cp-muted cp-rule">規則：在預期 PT 內讓「採用率加總」最大（同分選便宜的；精確解，不是貪婪法）。必點＝少 1,000 PT 也還會買；划算＝少 1,000 PT 就會被擠掉。</p>
      ${freeList}
      ${inheritedList}
      <h3>可放 <span class="cp-count">${s1.drop.length}</span></h3>
      ${s1.drop.length ? pickTable(s1.drop, pickState, true) : '<p class="cp-empty">沒有：門檻以上、戰馬／配卡／劇本拿得到的技能全部買得起。</p>'}
      <p class="cp-muted cp-rule">規則：預期 PT 不夠時被放掉的技能；「輪到」＝預期 PT 每次加 100 重算，第一次會買它時要多的 PT。</p>
      ${excludedList}
      ${invalidList}
      ${deadList}
      <h3>種馬要補（第二階段）<span class="cp-count">${s2.pool.length}</span></h3>
      <div class="cp-row cp-row--note">${factorReferenceHtml()}</div>
      <p><b>${esc(detLine)}</b></p>
      ${expLine ? `<p><b>${esc(expLine)}</b></p>` : ''}
      ${s2.pool.length ? `<table class="cp-table cp-table--rows cp-table--budget cp-table--pool"><thead><tr><th>#</th><th>技能</th><th>採用率</th><th class="cp-num">PT</th><th class="cp-num">每 100 PT</th><th class="cp-num">累計 PT</th><th class="cp-num">期望累計（× p）</th><th>來源</th></tr></thead><tbody>${poolRows.join('')}</tbody></table>` : ''}
      <p class="cp-muted cp-rule">規則：戰馬／配卡／劇本都沒有、但採用率 ≥ ${Number(state.minValueRate)}% 的技能，依採用率高→低（同率便宜的先）排。PT 用「白因子 hint Lv」＋切者計。白因子不保證出 hint，假設每顆帶上的因子一局內出 hint 的機率是 p；第 k 顆的「期望累計」＝ p × 前 k 顆原始 PT 合計。必帶＝採用率 ≥ 70%。</p>
      ${s2.unobtainable.length ? `<p class="cp-muted">未列入（台服目前拿不到，見 ③）：${s2.unobtainable.map(row => `${esc(row.name)} ${pct(row.value)}`).join('、')}</p>` : ''}`;
  }

  function lastRouteSourceShort(skillId) {
    if (!lastRoute) return '';
    const text = breedRouteText(skillId);
    return text.length > 60 ? `${text.slice(0, 58)}…` : text;
  }

  // ------------------------------------------------------------ render ⑤

  function chipList(items, limit) {
    if (!items.length) return '<span class="cp-muted">—</span>';
    const max = limit || 4;
    const head = items.slice(0, max).join('');
    if (items.length <= max) return `<span class="cp-chips">${head}</span>`;
    return `<span class="cp-chips">${head}</span><details class="cp-more"><summary>另 ${items.length - max} 張</summary><span class="cp-chips">${items.slice(max).join('')}</span></details>`;
  }

  function cardChip(card, owned) {
    const support = index.supportById.get(card.supportId);
    const via = card.via === 'event' ? '事件' : 'hint';
    const through = card.exact ? '' : `・${skillName(card.matchedSkillId)}`;
    let lb = '';
    if (owned) {
      const info = ownedInfo(card.supportId);
      lb = info.assumed ? ` · ${support.rarity}` : info.limitBreak == null ? ' · 突破不明' : ` · ${info.limitBreak}突`;
    }
    return `<span class="cp-chip${card.via === 'event' ? ' is-event' : ''}" title="${esc(supportName(support))}">${esc(supportShortName(support))} <small>${esc(typeLabel(card.supportType))}${esc(lb)} · ${via}${esc(through)}</small></span>`;
  }

  function renderStallion(ctx) {
    const { stallionSources, suggestion, stallionGapRows, gap, stallion } = ctx;
    const el = document.getElementById('step-stallion');
    const rateById = new Map(gap.breedableGap.map(row => [row.skillId, row.rate]));
    const sorted = stallionSources.slice().sort((a, b) => (rateById.get(b.skillId) || 0) - (rateById.get(a.skillId) || 0));

    const rows = sorted.map(row => {
      const rate = rateById.get(row.skillId);
      if (row.sourceless) {
        const unreleased = row.unreleasedSources || { supportIds: [], outfitIds: [] };
        const jpIds = [...unreleased.supportIds.map(id => `卡 #${id}`), ...unreleased.outfitIds.map(id => `馬娘 #${id}`)];
        let known;
        if (jpIds.length) {
          known = `來源卡／馬娘台服尚未實裝（日服 ${esc(jpIds.slice(0, 6).join('、'))}${jpIds.length > 6 ? ` 等 ${jpIds.length} 個` : ''}），目前無法自己養出這顆因子；只能靠已有此因子的種馬或租借`;
        } else {
          const scenarios = otherScenarioLabelsFor(row.skillId);
          known = scenarios.length
            ? `需在${esc(scenarios.join('／'))}養的種馬才有`
            : '台服目前沒有任何卡／馬娘來源，只能靠已有此因子的種馬或租借';
        }
        const partial = row.partialCards.length ? `<br><span class="cp-muted">只給下位技能 hint 的卡：${row.partialCards.slice(0, 4).map(card => esc(supportShortName(index.supportById.get(card.supportId)))).join('、')}${row.partialCards.length > 4 ? ` 等 ${row.partialCards.length} 張` : ''}</span>` : '';
        const breeders = row.ownedBreedersWithFactor.length ? row.ownedBreedersWithFactor.map(b => `<span class="cp-chip is-owned">${esc(b.label)} <small>${b.stars == null ? '' : '★'.repeat(b.stars)}</small></span>`).join('') : '<span class="cp-muted">—</span>';
        return `<tr class="is-sourceless">
          <td data-label="技能"><strong>${esc(row.name)}</strong> ${badge(jpIds.length ? '來源台服未實裝' : '台服無來源', 'danger')}</td>
          <td data-label="採用率">${rateCell(rate)}</td>
          <td data-label="來源" colspan="4"><b>${known}</b>${partial}</td>
          <td data-label="現有種馬已帶"><span class="cp-chips">${breeders}</span></td>
        </tr>`;
      }
      const chipOrder = (a, b) => ((b.via === 'event') - (a.via === 'event'))
        || rarityRank(index.supportById.get(b.supportId)) - rarityRank(index.supportById.get(a.supportId))
        || ((ownedInfo(b.supportId).limitBreak ?? -1) - (ownedInfo(a.supportId).limitBreak ?? -1))
        || a.supportId - b.supportId;
      const owned = row.ownedCards.slice().sort(chipOrder).map(card => cardChip(card, true));
      const borrow = row.borrowOnlyCards.slice().sort(chipOrder).map(card => cardChip(card, false));
      const outfits = row.traineeOutfits.slice().sort((a, b) => (b.owned - a.owned) || a.cardId - b.cardId).map(outfit => `<span class="cp-chip${outfit.owned ? ' is-owned' : ''}">${esc(outfit.name)} <small>${esc(TRAINEE_VIA_LABEL[outfit.via] || outfit.via)}${outfit.owned ? ' · 持有' : ''}</small></span>`);
      const scen = row.scenarioEventIds.map(id => `<span class="cp-chip">${esc(gametoraScenarioLabel(id))}</span>`);
      const breeders = row.ownedBreedersWithFactor.map(b => `<span class="cp-chip is-owned">${esc(b.label)} <small>${b.stars == null ? '' : '★'.repeat(b.stars)}${b.exact ? '' : `・${esc(skillName(b.factorSkillId))}`}</small></span>`);
      return `<tr>
        <td data-label="技能"><strong>${esc(row.name)}</strong></td>
        <td data-label="採用率">${rateCell(rate)}</td>
        <td data-label="你持有的卡">${chipList(owned, 4)}</td>
        <td data-label="只能借的卡">${chipList(borrow, 3)}</td>
        <td data-label="會自帶的馬娘">${chipList(outfits, 3)}</td>
        <td data-label="劇本">${chipList(scen, 3)}</td>
        <td data-label="現有種馬已帶">${chipList(breeders, 4)}</td>
      </tr>`;
    }).join('');

    const nameRate = id => `${esc(skillName(id))} <small>${pct(rateById.get(id))}</small>`;
    const lockedSet = new Set(stallion.locked);
    const cards = suggestion.cards.map((card, i) => {
      const support = index.supportById.get(card.supportId);
      const info = ownedInfo(card.supportId);
      const status = card.borrowed ? badge('借卡', 'borrow') : badge(info.assumed ? `持有（${support.rarity} 視為持有）` : info.limitBreak == null ? '持有（突破不明）' : `持有 ${info.limitBreak} 突`, 'ok');
      const isLocked = lockedSet.has(card.supportId);
      return `<li class="cp-sugg${isLocked ? ' is-locked' : ''}">
        ${thumb(card.supportId, support)}
        <div class="cp-sugg__body">
          <strong>${i + 1}. ${esc(supportName(support))}</strong>
          <span>${esc(typeLabel(support.supportType))} ${esc(support.rarity)} ${status}${isLocked ? ' ' + badge('已鎖定', 'muted') : ''}</span>
          <span>新覆蓋 ${card.newlyCovered.length} 個（採用率加總 ${fmt(card.newlyCoveredRateSum)}）：${card.newlyCovered.length ? card.newlyCovered.map(nameRate).join('、') : '無（鎖定卡）'}</span>
        </div>
        <div class="cp-sugg__actions">
          <button type="button" class="ghost cp-small" data-action="${isLocked ? 'unlock-card' : 'lock-card'}" data-id="${card.supportId}">${isLocked ? '解鎖' : '鎖定'}</button>
          <button type="button" class="ghost cp-small" data-action="exclude-card" data-id="${card.supportId}">排除</button>
        </div>
      </li>`;
    }).join('');
    const lockedMissing = stallion.locked.filter(id => !suggestion.cards.some(card => card.supportId === id));
    const excluded = stallion.excluded.map(id => `<span class="cp-chip">${esc(supportName(index.supportById.get(id)))} <button type="button" class="cp-linkbtn" data-action="unexclude-card" data-id="${id}">恢復</button></span>`).join('');

    const totalCount = suggestion.coveredSkillIds.length + suggestion.uncoveredSkillIds.length;
    const hero = ctx.protagonist;
    const heroFacts = c => {
      const facts = [];
      if (c.uniqueDemand) facts.push(`固有 ${c.uniqueDemand.name}`);
      if (c.selfSupplied.length) facts.push(`自帶缺口 ${c.selfSupplied.length}`);
      return facts.length ? `（${facts.join('，')}）` : '';
    };
    const heroOptions = ctx.protagonistOptions.map(c => `<option value="${c.cardId}"${ctx.protagonistManual && hero && hero.cardId === c.cardId ? ' selected' : ''}>${esc(cardName(index.cardById.get(c.cardId)))}${esc(heroFacts(c))}</option>`).join('');
    const heroBlock = ctx.protagonistOptions.length
      ? `<div class="cp-row"><label class="cp-field cp-field--wide"><span>種馬局主角（假設）</span><select id="protagonistSelect">
          <option value=""${ctx.protagonistManual ? '' : ' selected'}>自動：候選第 1 位（${esc(cardName(index.cardById.get(ctx.protagonistOptions[0].cardId)))}）</option>${heroOptions}</select></label></div>
        <p class="cp-muted">目前假設主角是 <b>${esc(cardName(index.cardById.get(hero.cardId)))}</b>：建議配卡不放同角色的支援卡（遊戲不允許）；主角自帶的缺口技能${suggestion.preCoveredSkillIds.length ? ` ${suggestion.preCoveredSkillIds.map(nameRate).join('、')} 先算已覆蓋` : '沒有'}。候選＝你持有、能傳需求固有或自帶缺口技能、且與戰馬不同角色的衣裝（排序同懶人路線 D.4）。</p>`
      : '<p class="cp-muted">你持有的衣裝沒有可當種馬局主角的候選，建議配卡不排除任何角色。</p>';
    el.innerHTML = `<h2 id="h-stallion">⑤ 種馬反推</h2>
      <div class="cp-row">
        <label class="cp-check"><input type="checkbox" id="onlyAboveCut"${state.onlyAboveCut ? ' checked' : ''} /> 只看 ④ 期望值切線以內的缺口</label>
        <span class="cp-muted">對象：${stallionGapRows.length} 個白技能缺口${ctx.excludeUnobtainable && ctx.suggestionGapRows.length < stallionGapRows.length ? `；建議配卡不計台服拿不到的 ${stallionGapRows.length - ctx.suggestionGapRows.length} 個` : ''}</span>
      </div>
      ${stallionGapRows.length ? `<table class="cp-table cp-table--rows cp-table--stallion"><thead><tr><th>技能</th><th>採用率</th><th>你持有的卡</th><th>只能借的卡</th><th>會自帶的馬娘</th><th>劇本</th><th>現有種馬已帶</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="cp-muted">卡片標示：事件＝卡事件給技能，hint＝訓練 hint；「・技能名」表示經由同系列技能解鎖。R/SR 卡視為持有。種馬資料來自 owned-breeder-registry（只含已記錄的白因子）。</p>` : '<p class="cp-empty">沒有需要種馬補的白技能缺口。</p>'}
      <h3>種馬局建議配卡（持有 5 ＋ 借 1）</h3>
      ${heroBlock}
      <p class="cp-method">算法：貪婪法，每一步選「能新覆蓋的缺口技能採用率加總最大」的卡；同分依序比新覆蓋數、有事件給技能、突破數高、卡號小。同角色只放一張，也不放與主角同角色的卡。</p>
      ${totalCount ? `<p class="cp-total">覆蓋 <b>${suggestion.coveredSkillIds.length} / ${totalCount}</b> 個缺口技能${suggestion.preCoveredSkillIds.length ? `（含主角自帶 ${suggestion.preCoveredSkillIds.length} 個）` : ''}（採用率加總 <b>${fmt(suggestion.coveredRateSum)} / ${fmt(suggestion.totalRateSum)}</b>）</p>` : ''}
      ${suggestion.cards.length ? `<ol class="cp-sugg-list">${cards}</ol>` : '<p class="cp-empty">沒有任何卡能覆蓋這些缺口。</p>'}
      ${lockedMissing.length ? `<p class="cp-warn">鎖定但放不進去（同角色衝突或欄位已滿）：${lockedMissing.map(id => esc(supportName(index.supportById.get(id)))).join('、')} <button type="button" class="cp-linkbtn" data-action="clear-locks">清除鎖定</button></p>` : ''}
      ${suggestion.uncoveredSkillIds.length ? `<p><b>沒覆蓋到：</b>${suggestion.uncoveredSkillIds.map(nameRate).join('、')}</p>` : ''}
      ${excluded ? `<p class="cp-muted">已排除：</p><span class="cp-chips">${excluded}</span>` : ''}`;
  }

  // ------------------------------------------------------------ picker

  const picker = { slot: null };

  function renderPicker() {
    const ctx = lastCtx;
    if (!ctx || !ctx.archetype) return;
    const { archetype, deck, traineeCard } = ctx;
    const query = Core.normalizeName(document.getElementById('pickerSearch').value || '');
    const type = document.getElementById('pickerType').value;
    const ownedOnly = document.getElementById('pickerOwnedOnly').checked;
    const metaOnly = document.getElementById('pickerMetaOnly').checked;
    const metaRate = new Map(list(archetype.supportCards).filter(c => c.supportId != null).map(c => [Number(c.supportId), c.rate]));
    const slotIndex = picker.slot;
    const otherChars = new Map();
    deck.forEach((slot, i) => {
      if (!slot || i === slotIndex) return;
      const support = index.supportById.get(slot.supportId);
      otherChars.set(Number(support.characterId), i);
    });
    const candidates = [...index.supportById.values()].filter(support => {
      if (!isReleased(support)) return false;
      if (type && support.supportType !== type) return false;
      if (metaOnly && !metaRate.has(support.id)) return false;
      if (ownedOnly && !ownedInfo(support.id).owned) return false;
      if (query) {
        const hay = Core.normalizeName([support.nameZhTw, support.name, support.nameJp, support.titleZhTw, support.title, support.titleJp, support.id].join('|'));
        if (!hay.includes(query)) return false;
      }
      return true;
    }).sort((a, b) => ((metaRate.get(b.id) || -1) - (metaRate.get(a.id) || -1)) || rarityRank(b) - rarityRank(a) || b.id - a.id);
    const LIMIT = 150;
    const shown = candidates.slice(0, LIMIT);
    const lbOptions = (supportId, info) => {
      const base = BASE_INVENTORY_CARDS.get(supportId);
      const value = state.ownedOverlay[supportId] !== undefined ? String(state.ownedOverlay[supportId]) : 'base';
      const baseText = base ? `截圖：${base.limitBreak == null ? '持有' : `${base.limitBreak} 突`}` : (info.assumed ? '預設：視為持有' : '截圖：未持有');
      return `<select data-action="set-owned" data-id="${supportId}" aria-label="持有狀態">
        <option value="base"${value === 'base' ? ' selected' : ''}>${esc(baseText)}</option>
        <option value="-1"${value === '-1' ? ' selected' : ''}>未持有</option>
        ${[0, 1, 2, 3, 4].map(lb => `<option value="${lb}"${value === String(lb) ? ' selected' : ''}>持有 ${lb} 突</option>`).join('')}
      </select>`;
    };
    const rows = shown.map(support => {
      const info = ownedInfo(support.id);
      let conflict = '';
      if (slotIndex !== null && slotIndex >= 0) {
        if (otherChars.has(Number(support.characterId))) conflict = `同角色已在第 ${otherChars.get(Number(support.characterId)) + 1} 格`;
        else if (traineeCard && Number(traineeCard.characterId) === Number(support.characterId)) conflict = '與戰馬同角色';
      }
      const placeButtons = slotIndex !== null && slotIndex >= 0
        ? (conflict ? `<span class="cp-warn">${esc(conflict)}</span>` : `<button type="button" class="ghost cp-small" data-action="place-card" data-id="${support.id}" data-borrow="0"${info.owned ? '' : ' disabled title="未持有"'}>放入</button><button type="button" class="ghost cp-small" data-action="place-card" data-id="${support.id}" data-borrow="1">放入（借卡）</button>`)
        : '';
      return `<div class="cp-pick${info.owned ? ' is-owned' : ''}">
        ${thumb(support.id, support)}
        <div class="cp-pick__body">
          <strong>${esc(supportName(support))}</strong>${soonTag(support)}
          <span class="cp-muted">${esc(typeLabel(support.supportType))} ${esc(support.rarity)}${metaRate.has(support.id) ? ` · 此型採用 ${pct(metaRate.get(support.id))}` : ''} · ${esc(lbText(info))}</span>
        </div>
        <div class="cp-pick__actions">${lbOptions(support.id, info)}${placeButtons}</div>
      </div>`;
    }).join('');
    document.getElementById('pickerTitle').textContent = slotIndex !== null && slotIndex >= 0 ? `選擇第 ${slotIndex + 1} 格支援卡` : '編輯持有卡／突破';
    document.getElementById('pickerNote').textContent = `符合 ${candidates.length} 張${candidates.length > LIMIT ? `，顯示前 ${LIMIT} 張，請縮小搜尋` : ''}。持有狀態的修改存在此瀏覽器，覆蓋 2026-07-15 截圖。`;
    document.getElementById('pickerList').innerHTML = rows || '<p class="cp-empty">沒有符合的卡。</p>';
  }

  function rarityRank(support) { return { SSR: 3, SR: 2, R: 1 }[support.rarity] || 0; }

  function openPicker(slotIndex) {
    picker.slot = slotIndex;
    const typeSelect = document.getElementById('pickerType');
    if (!typeSelect.options.length) {
      typeSelect.innerHTML = '<option value="">全部類型</option>' + TYPE_ORDER.map(type => `<option value="${type}">${TYPE_LABEL[type]}</option>`).join('');
    }
    renderPicker();
    const dialog = document.getElementById('cardPicker');
    if (typeof dialog.showModal === 'function' && !dialog.open) dialog.showModal();
    else dialog.setAttribute('open', '');
    document.getElementById('pickerSearch').focus();
  }

  function closePicker() {
    const dialog = document.getElementById('cardPicker');
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else dialog.removeAttribute('open');
    picker.slot = null;
  }

  // ------------------------------------------------------------ main

  let lastCtx = null;

  function render() {
    const ctx = compute();
    lastCtx = ctx;
    if (ctx.cup) { state.cupId = ctx.cup.id; }
    if (ctx.archetype) { state.archetypeId = ctx.archetype.id; }
    renderFreshness(ctx.cup);
    renderPlanDate(ctx.cup, ctx.planDate);
    renderTarget(ctx);
    if (!ctx.archetype) {
      ['step-route', 'step-deck', 'step-gap', 'step-pt', 'step-stallion'].forEach(id => { document.getElementById(id).innerHTML = ''; });
      return;
    }
    renderRoute(ctx);
    renderDeck(ctx);
    renderGap(ctx);
    renderPt(ctx);
    renderStallion(ctx);
    const dialog = document.getElementById('cardPicker');
    if (dialog.open) renderPicker();
  }

  function copyRoute() {
    const text = routeToText();
    const status = document.getElementById('routeCopyStatus');
    const done = ok => { if (status) status.textContent = ok ? '已複製' : '複製失敗，請手動選取'; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => done(true), () => done(fallbackCopy(text)));
    else done(fallbackCopy(text));
  }

  function fallbackCopy(text) {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (error) { ok = false; }
    area.remove();
    return ok;
  }

  function update(mutator) {
    mutator();
    save();
    render();
  }

  function currentDeckCopy() {
    const ctx = lastCtx;
    return ctx.deck.map(slot => (slot ? { ...slot } : null));
  }

  document.addEventListener('click', event => {
    const target = event.target.closest('[data-action]');
    if (!target || target.tagName === 'SELECT') return;
    const action = target.dataset.action;
    const ctx = lastCtx;
    const archetype = ctx && ctx.archetype;
    const id = Number(target.dataset.id);
    const slotIndex = Number(target.dataset.slot);
    switch (action) {
      case 'pick-archetype':
        update(() => { state.archetypeId = target.dataset.id; });
        break;
      case 'open-picker':
        openPicker(slotIndex);
        break;
      case 'copy-route':
        copyRoute();
        break;
      case 'picker-close':
        closePicker();
        break;
      case 'toggle-borrow':
        update(() => {
          const deck = currentDeckCopy();
          const turnOn = !deck[slotIndex].borrowed;
          deck.forEach(slot => { if (slot) slot.borrowed = false; });
          deck[slotIndex].borrowed = turnOn;
          setDeck(archetype, deck);
        });
        break;
      case 'clear-slot':
        update(() => { const deck = currentDeckCopy(); deck[slotIndex] = null; setDeck(archetype, deck); });
        break;
      case 'reset-deck':
        update(() => { delete state.deckByArchetype[archetype.id]; });
        break;
      case 'add-meta':
        update(() => {
          const deck = currentDeckCopy();
          const support = index.supportById.get(id);
          const conflict = deck.findIndex(slot => slot && Number(index.supportById.get(slot.supportId).characterId) === Number(support.characterId));
          let slot = conflict >= 0 ? conflict : deck.findIndex(entry => !entry);
          if (slot < 0) { window.alert('六格已滿，請先移除一張卡。'); return; }
          if (ctx.traineeCard && Number(ctx.traineeCard.characterId) === Number(support.characterId)) { window.alert('與戰馬同角色，不能放入。'); return; }
          const owned = ownedInfo(id).owned;
          const borrowed = !owned;
          if (borrowed) deck.forEach(entry => { if (entry) entry.borrowed = false; });
          deck[slot] = { supportId: id, borrowed };
          setDeck(archetype, deck);
        });
        break;
      case 'place-card':
        update(() => {
          const deck = currentDeckCopy();
          const borrowed = target.dataset.borrow === '1';
          if (borrowed) deck.forEach(entry => { if (entry) entry.borrowed = false; });
          deck[picker.slot] = { supportId: id, borrowed };
          setDeck(archetype, deck);
        });
        closePicker();
        break;
      case 'pick-include':
      case 'pick-exclude':
        update(() => {
          const value = pickStateFor(archetype);
          const key = action === 'pick-include' ? 'include' : 'exclude';
          const other = action === 'pick-include' ? 'exclude' : 'include';
          if (value[key].includes(id)) value[key] = value[key].filter(entry => entry !== id);
          else { value[key].push(id); value[other] = value[other].filter(entry => entry !== id); }
          setPickState(archetype, value);
        });
        break;
      case 'pick-reset':
        update(() => { delete state.pickByArchetype[archetype.id]; });
        break;
      case 'lock-card':
      case 'unlock-card':
      case 'exclude-card':
      case 'unexclude-card':
      case 'clear-locks':
        update(() => {
          const value = stallionStateFor(archetype);
          if (action === 'lock-card') value.locked.push(id);
          if (action === 'unlock-card') value.locked = value.locked.filter(entry => entry !== id);
          if (action === 'exclude-card') { value.excluded.push(id); value.locked = value.locked.filter(entry => entry !== id); }
          if (action === 'unexclude-card') value.excluded = value.excluded.filter(entry => entry !== id);
          if (action === 'clear-locks') value.locked = [];
          setStallionState(archetype, value);
        });
        break;
      default:
        break;
    }
  });

  document.addEventListener('change', event => {
    const target = event.target;
    if (target.id === 'cupSelect') update(() => { state.cupId = target.value; state.archetypeId = null; });
    else if (target.id === 'traineeSelect') update(() => { state.traineeByArchetype[lastCtx.archetype.id] = target.value === '' ? null : Number(target.value); });
    else if (target.id === 'minRateSelect') update(() => { state.minRate = Number(target.value); });
    else if (target.id === 'whiteHintLvSelect') update(() => { state.whiteHintLv = Number(target.value); });
    else if (target.id === 'goldHintLvSelect') update(() => { state.goldHintLv = Number(target.value); });
    else if (target.id === 'awakeningHintLvSelect') update(() => { state.awakeningHintLv = Number(target.value); });
    else if (target.id === 'inheritedWhiteHintLvSelect') update(() => { state.inheritedWhiteHintLv = Number(target.value); });
    else if (target.id === 'factorHintChanceSelect') update(() => { state.factorHintChance = Number(target.value); });
    else if (target.id === 'minValueRateSelect') update(() => { state.minValueRate = Number(target.value); });
    else if (target.id === 'planDateMode') update(() => { state.planDateMode = target.value; if (target.value === 'custom' && !state.planDateCustom) state.planDateCustom = lastCtx.planDate || TODAY; });
    else if (target.id === 'planDateCustom') update(() => { if (/^\d{4}-\d{2}-\d{2}$/.test(target.value)) state.planDateCustom = target.value; });
    else if (target.dataset && target.dataset.action === 'pick-lv') {
      update(() => {
        const value = pickStateFor(lastCtx.archetype);
        const skillId = Number(target.dataset.id);
        if (target.value === '') delete value.hintLv[skillId];
        else value.hintLv[skillId] = Number(target.value);
        setPickState(lastCtx.archetype, value);
      });
    } else if (target.dataset && target.dataset.action === 'event-choice') {
      update(() => {
        const value = pickStateFor(lastCtx.archetype);
        const key = String(target.dataset.key);
        if (target.value === '') delete value.eventChoice[key];
        else value.eventChoice[key] = Number(target.value);
        setPickState(lastCtx.archetype, value);
      });
    } else if (target.id === 'protagonistSelect') {
      update(() => {
        const value = stallionStateFor(lastCtx.archetype);
        value.protagonist = target.value === '' ? null : Number(target.value);
        setStallionState(lastCtx.archetype, value);
      });
    } else if (target.dataset && target.dataset.action === 'pick-inherit') {
      update(() => {
        const value = pickStateFor(lastCtx.archetype);
        value.inherit[Number(target.dataset.id)] = target.checked;
        setPickState(lastCtx.archetype, value);
      });
    }
    else if (target.id === 'sharpCheck') update(() => { state.sharp = target.checked; });
    else if (target.id === 'inheritNSelect') update(() => { state.inheritN = Number(target.value); });
    else if (target.id === 'excludeUnobtainable') update(() => { state.excludeUnobtainable = target.checked; });
    else if (target.id === 'onlyAboveCut') update(() => { state.onlyAboveCut = target.checked; });
    else if (target.id === 'expectedPtInput') update(() => { state.expectedPt = Math.max(0, Math.round(Number(target.value) || 0)); });
    else if (target.dataset && target.dataset.action === 'set-owned') {
      update(() => {
        const supportId = Number(target.dataset.id);
        if (target.value === 'base') delete state.ownedOverlay[supportId];
        else state.ownedOverlay[supportId] = Number(target.value);
      });
    } else if (['pickerType', 'pickerOwnedOnly', 'pickerMetaOnly'].includes(target.id)) renderPicker();
  });

  document.addEventListener('input', event => {
    if (event.target.id === 'pickerSearch') renderPicker();
  });

  document.getElementById('cardPicker').addEventListener('close', () => { picker.slot = null; });
  document.getElementById('cardPicker').addEventListener('click', event => {
    if (event.target === event.currentTarget) closePicker();
  });

  // Image fallbacks (error events do not bubble; capture them).
  document.addEventListener('error', event => {
    const img = event.target;
    if (!(img instanceof HTMLImageElement)) return;
    if (img.dataset.hideOnError) { img.remove(); return; }
    if (img.dataset.fallback !== undefined) {
      const span = document.createElement('span');
      span.className = 'cp-thumb__text';
      span.textContent = img.dataset.fallback;
      img.replaceWith(span);
    }
  }, true);

  render();
  window.__cupPlanner = { compute, render, routeToText, getState: () => JSON.parse(JSON.stringify(state)) };
})();
