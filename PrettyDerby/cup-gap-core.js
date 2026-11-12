(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.CupGapCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Cup gap planner core.
  //
  // Design rule: every number this module outputs is either game data copied
  // through (skill PT cost, meta adoption rate, aptitude letter) or a plain,
  // labelled sum / count / difference of such numbers. There are no composite
  // scores, weights (other than "adoption rate" in the set cover, documented
  // below) or invented probabilities.

  const TIER_CORE = 70;
  const TIER_COMMON = 30;

  // ---------------------------------------------------------------- utils

  function list(value) {
    return Array.isArray(value) ? value : [];
  }

  function num(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function byNumberAsc(a, b) {
    return a - b;
  }

  // Normalise a display name for loose matching of user-typed / OCR'd factor
  // names against catalog names ("青春點火・智慧" vs "青春點火．智慧").
  function normalizeName(value) {
    let text = String(value == null ? '' : value);
    if (typeof text.normalize === 'function') text = text.normalize('NFKC');
    return text
      .replace(/[\s・·．.、]/g, '')
      .replace(/[〇◯]/g, '○')
      .toLowerCase();
  }

  // ------------------------------------------------------------- indexing

  const INDEX_CACHE = typeof WeakMap === 'function' ? new WeakMap() : null;

  function isNegativeSkill(skill) {
    if (!skill) return false;
    const names = [skill.nameJp, skill.name, skill.nameZhTw].filter(Boolean).map(String);
    if (names.some(name => /×$/.test(name.trim()))) return true;
    const desc = String(skill.descriptionZhTw || skill.description || '');
    return /^變得(稍微)?不擅長/.test(desc);
  }

  function isDoubleCircle(skill) {
    return [skill.nameJp, skill.name, skill.nameZhTw]
      .filter(Boolean)
      .some(name => /◎$/.test(String(name).trim()));
  }

  // Tier inside a white/gold family. Higher tier = upgrade of lower tier.
  //   -1  negative (×, 苦手, ゲート難 ...) – never a prerequisite or a source
  //    1  plain white (○ or unsuffixed white)
  //    2  white ◎
  //    3  gold (rarity 2)
  //  null uniques / evolved / anything else: no family semantics
  function skillTier(skill) {
    if (!skill) return null;
    if (isNegativeSkill(skill)) return -1;
    if (skill.rarity === 2) return 3;
    if (skill.rarity === 1) return isDoubleCircle(skill) ? 2 : 1;
    return null;
  }

  function indexCatalog(catalog) {
    const source = catalog && typeof catalog === 'object' ? catalog : {};
    if (INDEX_CACHE && INDEX_CACHE.has(source)) return INDEX_CACHE.get(source);

    // Availability rule.
    //   Old zh_tw catalog (data/gametora-data.json): it only contains cards
    //   already on TW; `metadata.asOf` is its snapshot date and a missing
    //   releaseDate counts as released.
    //   Cup catalog (data/cup-catalog.json, marked by
    //   `metadata.availabilityRule`, or any catalog with
    //   `metadata.strictReleaseDates: true`): JP records with TW dates, where
    //   releaseDate null = not scheduled on TW. A support / outfit is on TW at
    //   date D iff releaseDate != null && releaseDate <= D. D is
    //   `metadata.planningDate` (set by the caller), else `metadata.asOf`,
    //   else `metadata.baseAsOf` (catalog build day). Records not available
    //   at D are left out of the index entirely, so every function below
    //   treats them exactly like a JP-only card ("id missing from catalog").
    const meta = source.metadata || {};
    const strict = meta.strictReleaseDates === true || !!meta.availabilityRule;
    const asOfRaw = meta.planningDate || meta.asOf || (strict ? meta.baseAsOf : null) || null;
    const asOf = asOfRaw ? String(asOfRaw).slice(0, 10) : null;
    const availableAt = record => !strict || (record.releaseDate != null && record.releaseDate !== ''
      && (!asOf || String(record.releaseDate).slice(0, 10) <= asOf));

    const skillById = new Map();
    for (const skill of list(source.skills)) {
      const id = num(skill && skill.id);
      if (id !== null) skillById.set(id, skill);
    }
    const supportById = new Map();
    for (const support of list(source.supports)) {
      const id = num(support && support.id);
      if (id !== null && availableAt(support)) supportById.set(id, support);
    }
    const cardById = new Map();
    for (const card of list(source.characterCards)) {
      const id = num(card && card.id);
      if (id !== null && availableAt(card)) cardById.set(id, card);
    }

    // skillId -> Map(supportId -> 'hint' | 'event'), only for cards that exist
    // in the catalog (the zh_tw catalog only contains released cards; skill
    // `sources` lists also reference JP-only card ids, which are dropped).
    const supportsBySkill = new Map();
    const addSupport = (skillId, supportId, via) => {
      if (!supportById.has(supportId)) return;
      if (!supportsBySkill.has(skillId)) supportsBySkill.set(skillId, new Map());
      const bucket = supportsBySkill.get(skillId);
      // event beats hint (event = guaranteed skill / hint chain on the card)
      if (bucket.get(supportId) !== 'event') bucket.set(supportId, via);
    };
    for (const support of supportById.values()) {
      for (const skillId of list(support.hintSkillIds)) addSupport(num(skillId), support.id, 'hint');
      for (const skillId of list(support.eventSkillIds)) addSupport(num(skillId), support.id, 'event');
    }

    // skillId -> Map(cardId -> via) for trainee outfits.
    const TRAINEE_VIA_ORDER = ['unique', 'innate', 'awakening', 'evolved', 'event'];
    const cardsBySkill = new Map();
    const addCard = (skillId, cardId, via) => {
      if (skillId === null || !cardById.has(cardId)) return;
      if (!cardsBySkill.has(skillId)) cardsBySkill.set(skillId, new Map());
      const bucket = cardsBySkill.get(skillId);
      const prev = bucket.get(cardId);
      if (!prev || TRAINEE_VIA_ORDER.indexOf(via) < TRAINEE_VIA_ORDER.indexOf(prev)) bucket.set(cardId, via);
    };
    for (const card of cardById.values()) {
      for (const id of list(card.uniqueSkillIds)) addCard(num(id), card.id, 'unique');
      for (const id of list(card.innateSkillIds)) addCard(num(id), card.id, 'innate');
      for (const id of list(card.awakeningSkillIds)) addCard(num(id), card.id, 'awakening');
      for (const evo of list(card.evolvedSkills)) addCard(num(evo && evo.new), card.id, 'evolved');
      for (const id of list(card.eventSkillIds)) addCard(num(id), card.id, 'event');
    }

    // Skill-side source lists (union, filtered to catalog ids) for robustness
    // in case a support/card record lacks its skill arrays.
    for (const skill of skillById.values()) {
      const sources = skill.sources || {};
      for (const sid of list(sources.supportHint)) addSupport(skill.id, num(sid), 'hint');
      for (const sid of list(sources.supportEvent)) addSupport(skill.id, num(sid), 'event');
      for (const cid of list(sources.characterBuiltIn)) {
        const card = cardById.get(num(cid));
        if (!card) continue;
        // built-in = unique/innate/awakening/evolved; pick the precise one if
        // the card lists it, else call it 'awakening'.
        if (cardsBySkill.get(skill.id) && cardsBySkill.get(skill.id).has(card.id)) continue;
        addCard(skill.id, card.id, 'awakening');
      }
      for (const cid of list(sources.characterEvent)) addCard(skill.id, num(cid), 'event');
    }

    // Evolved-skill provenance.
    const scenarioEvolutionById = new Map();
    const characterEvolutionById = new Map();
    for (const skill of skillById.values()) {
      for (const evo of list(skill.evolution)) {
        for (const evolvedId of list(evo && evo.evos)) {
          const id = num(evolvedId);
          if (id === null) continue;
          if (evo.scenario_id !== undefined && evo.scenario_id !== null) {
            scenarioEvolutionById.set(id, { scenarioId: evo.scenario_id, fromSkillId: skill.id });
          } else if (evo.card_id !== undefined && evo.card_id !== null) {
            if (!characterEvolutionById.has(id)) characterEvolutionById.set(id, []);
            characterEvolutionById.get(id).push({ cardId: evo.card_id, fromSkillId: skill.id });
          }
        }
      }
    }
    for (const card of cardById.values()) {
      for (const evo of list(card.evolvedSkills)) {
        const id = num(evo && evo.new);
        if (id === null) continue;
        if (!characterEvolutionById.has(id)) characterEvolutionById.set(id, []);
        const bucket = characterEvolutionById.get(id);
        if (!bucket.some(entry => entry.cardId === card.id)) bucket.push({ cardId: card.id, fromSkillId: num(evo.old) });
      }
    }

    const nameIndex = new Map();
    for (const skill of skillById.values()) {
      for (const name of [skill.nameZhTw, skill.name, skill.nameJp]) {
        const key = normalizeName(name);
        if (key && !nameIndex.has(key)) nameIndex.set(key, skill.id);
      }
    }

    const index = {
      skillById,
      supportById,
      cardById,
      supportsBySkill,
      cardsBySkill,
      scenarioEvolutionById,
      characterEvolutionById,
      nameIndex,
      asOf,
      strict,
      familyCache: new Map()
    };
    if (INDEX_CACHE) INDEX_CACHE.set(source, index);
    return index;
  }

  // --------------------------------------------------------------- family

  // Family encoding in data/gametora-data.json (verified against the data):
  //   every white/gold skill has `familyId` and `familyIds` (all members incl.
  //   the negative × variant). The order of familyIds is NOT a reliable
  //   upgrade order (e.g. 200961 family = [◎, ○, gold 紫電一閃]; 200331 =
  //   [gold, ○, ×]), so the upgrade chain is derived from tier:
  //   ○ (rarity 1) -> ◎ (rarity 1, name ends with ◎) -> gold (rarity 2).
  //   Example: 200012 右回り○ (90) -> 200011 右回り◎ (110) -> 200014 右回りの鬼
  //   (130, "Speed and Power +60" = ◎ effect plus power, i.e. the ◎ upgrade).
  function familyOf(skillId, catalog) {
    const index = indexCatalog(catalog);
    const id = num(skillId);
    const skill = index.skillById.get(id);
    if (!skill) return { skillId: id, familyId: null, unknown: true, members: [], chain: [], prerequisites: [] };
    const familyId = num(skill.familyId) !== null ? num(skill.familyId) : id;
    let members = index.familyCache.get(familyId);
    if (!members) {
      const ids = list(skill.familyIds).map(num).filter(value => value !== null);
      if (!ids.includes(id)) ids.push(id);
      members = ids
        .map(memberId => index.skillById.get(memberId))
        .filter(Boolean)
        .map(member => ({
          id: member.id,
          tier: skillTier(member),
          rarity: member.rarity,
          cost: num(member.cost),
          negative: isNegativeSkill(member),
          name: skillDisplayName(member)
        }));
      index.familyCache.set(familyId, members);
    }
    const tier = skillTier(skill);
    // Upgrade chain, lowest tier first, negatives excluded.
    const chain = members
      .filter(member => member.tier !== null && member.tier > 0)
      .slice()
      .sort((a, b) => a.tier - b.tier || a.id - b.id)
      .map(member => member.id);
    const prerequisites = tier !== null && tier > 0
      ? members
        .filter(member => member.tier !== null && member.tier > 0 && member.tier < tier)
        .sort((a, b) => a.tier - b.tier || a.id - b.id)
        .map(member => member.id)
      : [];
    return { skillId: id, familyId, tier, members, chain, prerequisites };
  }

  // How a source skill relates to a target skill.
  //   exact   same id                                  -> unlocks target
  //   lower   source is a lower tier of the family     -> unlocks only a ◎
  //           target (a ○ hint makes the ◎ purchasable: no card in the data
  //           hints any ◎ directly, yet ◎ is bought widely — 右回り◎ has zero
  //           sources of its own while 右回り○ has 22 support hints). A gold
  //           still needs its own gold hint, so a white hint does NOT unlock
  //           a gold target.
  //   higher  source is an upgrade of the target       -> unlocks target
  //           (buying the upgrade buys the prerequisite too)
  //   sibling same tier, different skill               -> does not unlock
  function relation(targetId, sourceId, index) {
    if (targetId === sourceId) return { relation: 'exact', exact: true, unlocksTarget: true };
    const target = index.skillById.get(targetId);
    const sourceSkill = index.skillById.get(sourceId);
    if (!target || !sourceSkill) return null;
    const family = list(target.familyIds).map(num);
    if (!family.includes(sourceId)) return null;
    const targetTier = skillTier(target);
    const sourceTier = skillTier(sourceSkill);
    if (targetTier === null || sourceTier === null || targetTier < 0 || sourceTier < 0) return null;
    if (sourceTier < targetTier) return { relation: 'lower', exact: false, unlocksTarget: targetTier === 2 };
    if (sourceTier > targetTier) return { relation: 'higher', exact: false, unlocksTarget: true };
    return { relation: 'sibling', exact: false, unlocksTarget: false };
  }

  // Candidate source skills for a target: the target itself plus its
  // non-negative family members (only if the target has white/gold tier).
  function relatedSkillIds(targetId, index) {
    const target = index.skillById.get(targetId);
    if (!target) return [targetId];
    const ids = [targetId];
    const tier = skillTier(target);
    if (tier !== null && tier > 0) {
      for (const memberId of list(target.familyIds).map(num)) {
        if (memberId !== null && memberId !== targetId) ids.push(memberId);
      }
    }
    return ids;
  }

  // --------------------------------------------------------------- naming

  function skillDisplayName(skill) {
    if (!skill) return '';
    return String(skill.nameZhTw || skill.name || skill.nameJp || skill.nameJa || (skill.id != null ? `#${skill.id}` : skill.skillId != null ? `#${skill.skillId}` : ''));
  }

  function supportDisplayName(support) {
    if (!support) return '';
    const name = support.nameZhTw || support.name || '';
    const title = support.titleZhTw || support.title || '';
    return `${title}${name}`.trim() || `#${support.id}`;
  }

  // ----------------------------------------------------------------- cost

  // PT cost encoding (verified against data/gametora-data.json):
  //   `cost` of a gold skill is its OWN price only, it does NOT include the
  //   white prerequisite. Evidence: 306 of 343 golds cost <= the cheapest
  //   white in their family (e.g. 200331 弧線的教授 cost 180, its white 200332
  //   彎道靈巧○ cost 180; 200361 疾風一文字 170 vs 200362 直線靈巧 170), which is
  //   impossible if the white price were folded in. The cup-meta `cost`
  //   column follows the same convention (右回り◎ 110, catalog 110).
  //   In game, buying an upgrade without its prerequisite costs the sum of
  //   the whole chain below it, so:
  //     effective(gold)  = gold + ◎ (if the family has one) + ○
  //     effective(◎)     = ◎ + ○
  //     effective(○)     = ○
  //   Members already in ownedSkillIds are not charged; owning a higher tier
  //   implies owning everything below it. Uniques / evolved (cost null) = 0.
  //   hintDiscountBySkillId: optional {skillId: fraction 0..1} applied to that
  //   component's cost, rounded DOWN like the game (floor(base × (1 − d));
  //   e.g. 疾風一文字 170 at Lv2 + 切れ者 = floor(170 × 0.7) = 119).
  // floor(base × (1 − fraction)); the fraction is turned into integer
  // hundredths first so 0.3 / 0.6 float noise cannot drop a whole PT.
  function discountedCost(base, fraction) {
    const hundredths = Math.round(Math.min(1, Math.max(0, Number(fraction) || 0)) * 10000);
    return Math.floor((Number(base) || 0) * (10000 - hundredths) / 10000);
  }

  function effectiveSkillCost(skillId, catalog, options) {
    const opts = options || {};
    const index = indexCatalog(catalog);
    const id = num(skillId);
    const skill = index.skillById.get(id);
    const owned = new Set(list(opts.ownedSkillIds).map(num));
    const discounts = opts.hintDiscountBySkillId || {};
    if (!skill) return { skillId: id, unknown: true, total: 0, components: [] };
    const family = familyOf(id, catalog);
    // owning a higher (or equal) tier member implies owning lower ones
    const ownedTier = family.members
      .filter(member => owned.has(member.id) && member.tier !== null && member.tier > 0)
      .reduce((max, member) => Math.max(max, member.tier), 0);
    const ownTier = skillTier(skill);
    if (owned.has(id) || (ownTier !== null && ownTier > 0 && ownedTier >= ownTier)) {
      return { skillId: id, total: 0, components: [], alreadyOwned: true };
    }
    const chainIds = family.prerequisites
      .filter(preId => {
        const member = family.members.find(entry => entry.id === preId);
        return member && member.tier > ownedTier && !owned.has(preId);
      })
      .concat([id]);
    const components = chainIds.map(componentId => {
      const component = index.skillById.get(componentId);
      const base = num(component && component.cost) || 0;
      const fraction = Math.min(1, Math.max(0, Number(discounts[componentId]) || 0));
      const cost = fraction ? discountedCost(base, fraction) : base;
      return { skillId: componentId, name: skillDisplayName(component), baseCost: base, discount: fraction, cost };
    });
    return { skillId: id, total: components.reduce((sum, entry) => sum + entry.cost, 0), components };
  }

  // -------------------------------------------------------- target skills

  function findArchetype(cup, archetypeId) {
    const archetypes = list(cup && cup.archetypes);
    if (archetypeId === undefined || archetypeId === null) return archetypes[0] || null;
    if (typeof archetypeId === 'number' && !archetypes.some(entry => entry && entry.id === archetypeId)) {
      return archetypes[archetypeId] || null;
    }
    return archetypes.find(entry => entry && entry.id === archetypeId) || null;
  }

  function tierForRate(rate) {
    if (rate >= TIER_CORE) return 'core';
    if (rate >= TIER_COMMON) return 'common';
    return 'niche';
  }

  function buildTargetSkills({ cup, archetypeId, minRate = 30 } = {}) {
    const archetype = findArchetype(cup, archetypeId);
    if (!archetype) return [];
    const threshold = Number.isFinite(Number(minRate)) ? Number(minRate) : 30;
    const rows = [];
    const seen = new Set();
    for (const raw of list(archetype.skills)) {
      if (!raw) continue;
      const rate = num(raw.rate);
      if (rate === null || rate < threshold) continue;
      const skillId = num(raw.skillId);
      const key = skillId !== null ? skillId : `name:${raw.nameJa}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        skillId,
        baseSkillId: num(raw.baseSkillId) !== null ? num(raw.baseSkillId) : skillId,
        name: raw.nameZhTw || raw.nameJa || (skillId !== null ? `#${skillId}` : ''),
        nameJa: raw.nameJa || null,
        rate,
        cost: num(raw.cost),
        rarity: num(raw.rarity),
        phase: raw.phase || null,
        effect: raw.effect || null,
        inheritedUnique: raw.inheritedUnique === true,
        tier: tierForRate(rate)
      });
    }
    rows.sort((a, b) => b.rate - a.rate || (a.skillId || 0) - (b.skillId || 0));
    return rows;
  }

  // ------------------------------------------------------- activation
  //
  // Conservative "can this skill ever fire for this running style on this
  // course?" check, from the catalog's conditionGroups (game condition
  // strings). Encoding (verified against data/cup-catalog.json):
  //   several conditionGroups      = alternatives (OR)
  //   '@' inside a string          = OR,  '&' = AND
  //   precondition AND condition   (a group with a precondition needs both)
  // A skill is `impossible` only when EVERY alternative contains a hard
  // contradiction:
  //   running_style        ≠ the archetype's style (1 逃げ 2 先行 3 差し 4 追込)
  //   distance_type / ground_type / rotation / season / track_id /
  //   is_basis_distance / course_distance  ≠ the cup course
  //   order / order_rate / order_rate_inXX_continue / order_rate_outXX_continue
  //                        no position in the style's typical order band
  //                        (STYLE_ORDER_BANDS) satisfies all of them at once
  // Anything else (phase, hp, corner, weather, field composition …) is never
  // treated as a contradiction, so "might fire" skills stay (e.g. 垂れウマ回避).
  //
  // Typical position per running style as a fraction of the field (inclusive
  // rate range): the band is the same share of the field whatever the size.
  // order_rate of order o = o * 100 / fieldSize (percent). The order band for a
  // field size rounds OUTWARD (floor the start, ceil the end) so the filter
  // stays conservative. Values = the old 18-runner bands (1-4, 2-9, 6-14, 7-18).
  // 追込 starts at 7/18, not 10/18: the JP top-300 追込 carry Joy to the World
  // (order_rate 20-50 mid/late race) at 83 %, so 追込 do reach the front half.
  // TODO(差追): only 逃げ / 先行 are verified (VERIFIED_STYLES); the 差し / 追込
  // rate bands below are untuned placeholders - extend when back styles matter.
  const VERIFIED_STYLES = ['逃げ', '先行'];
  const STYLE_ORDER_RATE_BANDS = {
    1: [1 / 18, 4 / 18],   // 逃げ
    2: [2 / 18, 9 / 18],   // 先行
    3: [6 / 18, 14 / 18],  // 差し  TODO(差追)
    4: [7 / 18, 18 / 18]   // 追込  TODO(差追)
  };
  // Runners per event (cup.fieldSize overrides). Anything else (story races) = 18.
  const DEFAULT_FIELD_SIZE = 18;
  const FIELD_SIZE_BY_EVENT_MODE = { loh: 12, cm: 9 };
  const ACTIVATION_FIELD_SIZE = DEFAULT_FIELD_SIZE;
  function fieldSizeForCup(cup) {
    const own = num(cup && cup.fieldSize);
    if (own !== null && own >= 1) return Math.floor(own);
    return FIELD_SIZE_BY_EVENT_MODE[cup && cup.eventMode] || DEFAULT_FIELD_SIZE;
  }
  function orderBand(styleId, fieldSize = DEFAULT_FIELD_SIZE) {
    const rates = STYLE_ORDER_RATE_BANDS[styleId];
    if (!rates) return null;
    const n = Math.max(1, Math.floor(fieldSize) || DEFAULT_FIELD_SIZE);
    const lo = Math.max(1, Math.floor(rates[0] * n + 1e-9));
    const hi = Math.min(n, Math.max(lo, Math.ceil(rates[1] * n - 1e-9)));
    return [lo, hi];
  }
  const STYLE_ORDER_BANDS = Object.fromEntries([1, 2, 3, 4].map(id => [id, orderBand(id, DEFAULT_FIELD_SIZE)]));
  const RUNNING_STYLE_ID = {
    逃げ: 1, 先行: 2, 差し: 3, 追込: 4, 追い込み: 4,
    領頭: 1, 前列: 2, 居中: 3, 後追: 4,
    runner: 1, leader: 2, betweener: 3, chaser: 4
  };
  const DISTANCE_TYPE_ID = { short: 1, sprint: 1, mile: 2, medium: 3, middle: 3, long: 4 };
  const SEASON_IDS = { spring: [1, 5], summer: [2], autumn: [3], fall: [3], winter: [4] };

  function runningStyleId(style) {
    if (num(style) !== null) return num(style);
    return RUNNING_STYLE_ID[String(style || '').trim()] || null;
  }

  // Course facts as allowed value lists (null = unknown -> never contradicts).
  function courseFacts(course) {
    const c = course || {};
    const distance = num(c.distance);
    const basis = c.basisDistance === true || c.basisDistance === false
      ? (c.basisDistance ? 1 : 0)
      : (distance !== null ? (distance % 400 === 0 ? 1 : 0) : null);
    return {
      distance_type: DISTANCE_TYPE_ID[c.distanceType] ? [DISTANCE_TYPE_ID[c.distanceType]] : null,
      ground_type: c.surface === 'turf' ? [1] : c.surface === 'dirt' ? [2] : null,
      rotation: c.rotation === 'right' ? [1] : c.rotation === 'left' ? [2] : null,
      season: SEASON_IDS[c.season] || null,
      track_id: num(c.trackId) !== null ? [num(c.trackId)] : null,
      is_basis_distance: basis === null ? null : [basis],
      course_distance: distance !== null ? [distance] : null
    };
  }

  function compareTerm(left, op, right) {
    switch (op) {
      case '==': return left === right;
      case '!=': return left !== right;
      case '>=': return left >= right;
      case '<=': return left <= right;
      case '>': return left > right;
      case '<': return left < right;
      default: return true;
    }
  }

  function parseTerm(text) {
    const m = String(text || '').trim().match(/^([a-z_0-9]+)(==|!=|>=|<=|>|<)(-?[0-9.]+)$/);
    return m ? { term: m[0], key: m[1], op: m[2], value: Number(m[3]) } : null;
  }

  const COURSE_KEYS = ['distance_type', 'ground_type', 'rotation', 'season', 'track_id', 'is_basis_distance', 'course_distance'];

  // One AND-alternative (array of parsed terms) -> list of contradictions.
  function contradictionsOf(terms, styleId, facts, band, fieldSize) {
    const out = [];
    for (const t of terms) {
      if (t.key === 'running_style' && styleId !== null && !compareTerm(styleId, t.op, t.value)) {
        out.push({ kind: 'running_style', term: t.term, key: t.key, op: t.op, value: t.value });
      } else if (COURSE_KEYS.includes(t.key) && facts[t.key] && !facts[t.key].some(v => compareTerm(v, t.op, t.value))) {
        out.push({ kind: 'course', term: t.term, key: t.key, op: t.op, value: t.value });
      }
    }
    if (band) {
      const position = [];
      for (const t of terms) {
        if (t.key === 'order' || t.key === 'order_rate') position.push(t);
        const inOut = t.key.match(/^order_rate_(in|out)(\d+)_continue$/);
        if (inOut && t.op === '==' && t.value === 1) {
          position.push({ ...t, key: 'order_rate', op: inOut[1] === 'in' ? '<=' : '>', value: Number(inOut[2]) });
        }
      }
      if (position.length) {
        let any = false;
        for (let o = band[0]; o <= band[1] && !any; o += 1) {
          const rate = o * 100 / fieldSize;
          if (position.every(t => compareTerm(t.key === 'order' ? o : rate, t.op, t.value))) any = true;
        }
        if (!any) {
          const terms2 = [...new Set(position.map(t => t.term))];
          out.push({ kind: 'position', term: terms2.join('&'), key: 'order', band: band.slice(), fieldSize });
        }
      }
    }
    return out;
  }

  function splitAlternatives(text) {
    if (text === null || text === undefined || String(text).trim() === '') return [[]];
    return String(text).split('@').map(alt => alt.split('&').map(parseTerm).filter(Boolean));
  }

  // skill: catalog record. Returns { status: 'possible' | 'impossible' |
  // 'unknown', reasons: [{kind, term, ...}] (one per alternative, first
  // contradiction; only when impossible), alternatives: count, conditionText }.
  function classifySkillActivation(skill, { style = null, course = null, fieldSize = DEFAULT_FIELD_SIZE } = {}) {
    const groups = list(skill && skill.conditionGroups);
    if (!groups.length) return { status: 'unknown', reasons: [], alternatives: 0, conditionText: '' };
    const styleId = runningStyleId(style);
    const facts = courseFacts(course);
    const band = styleId !== null ? orderBand(styleId, fieldSize) : null;
    const reasons = [];
    let alternatives = 0;
    let possible = false;
    const texts = [];
    for (const group of groups) {
      if (!group) continue;
      texts.push([group.precondition, group.condition].filter(Boolean).join(' ⇒ '));
      for (const pre of splitAlternatives(group.precondition)) {
        for (const cond of splitAlternatives(group.condition)) {
          alternatives += 1;
          const found = contradictionsOf([...pre, ...cond], styleId, facts, band, fieldSize);
          if (!found.length) possible = true;
          else reasons.push(found[0]);
        }
      }
    }
    const uniq = [];
    const seen = new Set();
    for (const r of reasons) { if (!seen.has(r.term)) { seen.add(r.term); uniq.push(r); } }
    return { status: possible ? 'possible' : 'impossible', reasons: possible ? [] : uniq, alternatives, conditionText: texts.join(' ／ ') };
  }

  // Activation of a meta target row: the row's own skill, else (inherited
  // unique gene ids 9xxxxx are not in the catalog) its baseSkillId.
  function classifyTargetActivation(row, index, archetype, cup) {
    const skill = index.skillById.get(num(row && row.skillId)) || index.skillById.get(num(row && row.baseSkillId)) || null;
    return classifySkillActivation(skill, { style: archetype && archetype.style, course: cup && cup.course, fieldSize: fieldSizeForCup(cup) });
  }

  // ------------------------------------------------------- source lookup

  const TRAINEE_VIA_ORDER = ['unique', 'innate', 'awakening', 'evolved', 'event'];

  function traineeSkillVia(card) {
    const map = new Map();
    if (!card) return map;
    const put = (id, via) => {
      const key = num(id);
      if (key === null) return;
      const prev = map.get(key);
      if (!prev || TRAINEE_VIA_ORDER.indexOf(via) < TRAINEE_VIA_ORDER.indexOf(prev)) map.set(key, via);
    };
    list(card.uniqueSkillIds).forEach(id => put(id, 'unique'));
    list(card.innateSkillIds).forEach(id => put(id, 'innate'));
    list(card.awakeningSkillIds).forEach(id => put(id, 'awakening'));
    list(card.evolvedSkills).forEach(evo => put(evo && evo.new, 'evolved'));
    list(card.eventSkillIds).forEach(id => put(id, 'event'));
    return map;
  }

  // removedEvent: skill ids this card's events do NOT give in this plan
  // (they sit only on an event choice that was not taken). A removed skill
  // that is also in the card's hint list stays as 'hint'.
  function supportSkillVia(support, removedEvent) {
    const map = new Map();
    if (!support) return map;
    const removed = removedEvent instanceof Set ? removedEvent : new Set(list(removedEvent).map(num));
    list(support.hintSkillIds).forEach(id => { if (num(id) !== null) map.set(num(id), 'hint'); });
    list(support.eventSkillIds).forEach(id => { if (num(id) !== null && !removed.has(num(id))) map.set(num(id), 'event'); });
    return map;
  }

  // eventExclusions: {supportId: [skillId]} or Map -> Map(supportId -> Set).
  function exclusionMap(eventExclusions) {
    const out = new Map();
    if (!eventExclusions) return out;
    const entries = eventExclusions instanceof Map ? [...eventExclusions.entries()] : Object.entries(eventExclusions);
    for (const [key, ids] of entries) {
      const id = num(key);
      if (id === null) continue;
      out.set(id, new Set([...(ids instanceof Set ? ids : list(ids))].map(num).filter(v => v !== null)));
    }
    return out;
  }

  function resolveOne(skillId, index, traineeVia, deck, scenarioSet) {
    const related = relatedSkillIds(skillId, index);
    // trainee
    let trainee = null;
    let traineeMatchedSkillId = null;
    let traineeExact = null;
    const traineeCandidates = [];
    for (const candidateId of related) {
      const via = traineeVia.get(candidateId);
      if (!via) continue;
      const rel = relation(skillId, candidateId, index);
      if (!rel || !rel.unlocksTarget) continue;
      traineeCandidates.push({ via, candidateId, exact: rel.exact });
    }
    traineeCandidates.sort((a, b) => (b.exact - a.exact)
      || TRAINEE_VIA_ORDER.indexOf(a.via) - TRAINEE_VIA_ORDER.indexOf(b.via)
      || a.candidateId - b.candidateId);
    if (traineeCandidates.length) {
      trainee = traineeCandidates[0].via;
      traineeMatchedSkillId = traineeCandidates[0].candidateId;
      traineeExact = traineeCandidates[0].exact;
    }
    // deck
    const deckRows = [];
    const deckPartial = [];
    for (const card of deck) {
      let best = null;
      let bestPartial = null;
      for (const candidateId of related) {
        const via = card.skills.get(candidateId);
        if (!via) continue;
        const rel = relation(skillId, candidateId, index);
        if (!rel) continue;
        const entry = { supportId: card.id, via, matchedSkillId: candidateId, exact: rel.exact, relation: rel.relation };
        const better = (current, next) => !current
          || (next.exact && !current.exact)
          || (next.exact === current.exact && next.via === 'event' && current.via !== 'event');
        if (rel.unlocksTarget) { if (better(best, entry)) best = entry; }
        else if (better(bestPartial, entry)) bestPartial = entry;
      }
      if (best) deckRows.push(best);
      else if (bestPartial) deckPartial.push(bestPartial);
    }
    // scenario
    let scenario = false;
    for (const candidateId of related) {
      if (!scenarioSet.has(candidateId)) continue;
      const rel = relation(skillId, candidateId, index);
      if (rel && rel.unlocksTarget) { scenario = true; break; }
    }
    return {
      skillId,
      unknown: !index.skillById.has(skillId),
      trainee,
      traineeMatchedSkillId,
      traineeExact,
      deck: deckRows,
      deckPartial,
      scenario
    };
  }

  function resolveSkillSources({ skillIds, catalog, traineeCardId = null, deckCardIds = [], scenarioSkillIds = [], eventExclusions = null } = {}) {
    const index = indexCatalog(catalog);
    const traineeCard = traineeCardId === null || traineeCardId === undefined ? null : index.cardById.get(num(traineeCardId)) || null;
    const traineeVia = traineeSkillVia(traineeCard);
    const removed = exclusionMap(eventExclusions);
    const deck = list(deckCardIds)
      .map(num)
      .filter(id => id !== null)
      .map(id => ({ id, support: index.supportById.get(id) }))
      .map(entry => ({ id: entry.id, unknown: !entry.support, skills: supportSkillVia(entry.support, removed.get(entry.id)) }));
    const scenarioSet = new Set(list(scenarioSkillIds).map(num).filter(id => id !== null));
    const result = {};
    for (const raw of list(skillIds)) {
      const id = num(raw);
      if (id === null) continue;
      result[id] = resolveOne(id, index, traineeVia, deck, scenarioSet);
    }
    return result;
  }

  // ------------------------------------------------------------ battle gap

  function statusOf(sources) {
    if (sources.trainee) return 'trainee';
    if (sources.deck.some(entry => entry.via === 'event')) return 'deck-event';
    if (sources.deck.length) return 'deck-hint';
    if (sources.scenario) return 'scenario';
    return 'none';
  }

  // What kind of skill a target row is (for the UI to separate "white factor
  // to breed" from things breeding cannot provide).
  function skillKind(row, index) {
    if (row.inheritedUnique) return 'inherited-unique';
    const skill = index.skillById.get(row.skillId);
    if (!skill) return 'unknown';
    if (index.scenarioEvolutionById.has(row.skillId)) return 'scenario-evolution';
    if (index.characterEvolutionById.has(row.skillId) || skill.rarity === 6) return 'character-evolution';
    if (skill.rarity === 1 || skill.rarity === 2) return 'white';
    return 'unique';
  }

  function sumRates(rows) {
    return Math.round(rows.reduce((sum, row) => sum + (Number(row.rate) || 0), 0) * 100) / 100;
  }

  // activation (default true): target rows whose conditions can never hold
  // for the archetype's running style on the cup course (see
  // classifySkillActivation) go to `impossible` instead of covered / gap /
  // inheritedUniques, so every downstream list leaves them out.
  function analyzeBattleGap({ cup, archetypeId, catalog, traineeCardId = null, deckCardIds = [], scenarioSkillIds = [], minRate = 30, eventExclusions = null, activation = true } = {}) {
    const index = indexCatalog(catalog);
    const archetype = findArchetype(cup, archetypeId);
    const targets = buildTargetSkills({ cup, archetypeId, minRate });
    const sourceMap = resolveSkillSources({
      skillIds: targets.filter(row => !row.inheritedUnique && row.skillId !== null).map(row => row.skillId),
      catalog,
      traineeCardId,
      deckCardIds,
      scenarioSkillIds,
      eventExclusions
    });
    const covered = [];
    const gap = [];
    const inheritedUniques = [];
    const impossible = [];
    for (const target of targets) {
      const kind = skillKind(target, index);
      if (activation !== false) {
        const act = classifyTargetActivation(target, index, archetype, cup);
        if (act.status === 'impossible') {
          impossible.push({ ...target, kind, activation: act });
          continue;
        }
      }
      if (target.inheritedUnique) {
        inheritedUniques.push({ ...target, kind, status: 'inheritance', source: 'parent-unique-factor' });
        continue;
      }
      const sources = target.skillId !== null && sourceMap[target.skillId]
        ? sourceMap[target.skillId]
        : { skillId: target.skillId, unknown: true, trainee: null, traineeMatchedSkillId: null, traineeExact: null, deck: [], deckPartial: [], scenario: false };
      const row = {
        ...target,
        kind,
        unknown: sources.unknown === true,
        sources,
        status: statusOf(sources)
      };
      const evo = index.scenarioEvolutionById.get(target.skillId);
      if (evo) row.scenarioEvolution = evo;
      if (row.status === 'none') gap.push(row);
      else covered.push(row);
    }
    const traineeCard = traineeCardId === null || traineeCardId === undefined ? null : index.cardById.get(num(traineeCardId)) || null;
    const notes = [];
    if (traineeCardId === null || traineeCardId === undefined) notes.push('no trainee card selected: trainee sources are empty');
    else if (!traineeCard) notes.push(`trainee card ${traineeCardId} not in catalog: trainee sources are empty`);
    const unknownDeck = list(deckCardIds).map(num).filter(id => id !== null && !index.supportById.has(id));
    if (unknownDeck.length) notes.push(`deck cards not in catalog: ${unknownDeck.join(', ')}`);
    const countBy = (rows, key) => rows.reduce((acc, row) => { acc[row[key]] = (acc[row[key]] || 0) + 1; return acc; }, {});
    const breedableGap = gap.filter(row => row.kind === 'white');
    return {
      covered,
      gap,
      breedableGap,
      inheritedUniques,
      impossible,
      summary: {
        targetCount: targets.length,
        coveredCount: covered.length,
        gapCount: gap.length,
        breedableGapCount: breedableGap.length,
        inheritedUniqueCount: inheritedUniques.length,
        impossibleCount: impossible.length,
        impossibleRateSum: sumRates(impossible),
        coveredByStatus: countBy(covered, 'status'),
        gapByKind: countBy(gap, 'kind'),
        targetRateSum: sumRates(targets),
        coveredRateSum: sumRates(covered),
        gapRateSum: sumRates(gap),
        inheritedUniqueRateSum: sumRates(inheritedUniques),
        traineeCardId: traineeCard ? traineeCard.id : null,
        deckCardIds: list(deckCardIds).map(num).filter(id => id !== null),
        notes
      }
    };
  }

  // ------------------------------------------------------------ PT budget

  // Cost of a row given what is already owned. Trainee innate / unique /
  // evolved rows cost 0 (innate skills are learned at the start; uniques and
  // evolutions are not bought with PT). Rows without a catalog record fall
  // back to the meta `cost` column (standalone price).
  function rowCost(row, catalog, owned, discounts) {
    const index = indexCatalog(catalog);
    const via = row.sources && row.sources.trainee;
    if (via === 'innate' || via === 'unique' || via === 'evolved') return { total: 0, components: [], free: via };
    if (!index.skillById.has(row.skillId)) {
      const base = num(row.cost) || 0;
      const fraction = Math.min(1, Math.max(0, Number(discounts[row.skillId]) || 0));
      return { total: fraction ? discountedCost(base, fraction) : base, components: [], unknown: true };
    }
    return effectiveSkillCost(row.skillId, catalog, { ownedSkillIds: [...owned], hintDiscountBySkillId: discounts });
  }

  function computePtBudget({ rows = [], expectedPt = 0, catalog, hintDiscountBySkillId = {}, ownedSkillIds = [] } = {}) {
    const discounts = hintDiscountBySkillId || {};
    const owned = new Set(list(ownedSkillIds).map(num).filter(id => id !== null));
    const all = list(rows).filter(Boolean);
    const coveredRows = all.filter(row => !row.inheritedUnique && row.status && row.status !== 'none')
      .slice()
      .sort((a, b) => (b.rate || 0) - (a.rate || 0) || (a.skillId || 0) - (b.skillId || 0));
    const gapRows = all.filter(row => !row.inheritedUnique && (!row.status || row.status === 'none'));
    const inheritedRows = all.filter(row => row.inheritedUnique);

    const coveredItems = [];
    let coveredCost = 0;
    for (const row of coveredRows) {
      const cost = rowCost(row, catalog, owned, discounts);
      coveredCost += cost.total;
      coveredItems.push({ skillId: row.skillId, name: row.name, rate: row.rate, status: row.status, cost: cost.total, components: cost.components || [], alreadyOwned: cost.alreadyOwned === true, free: cost.free || null });
      if (row.skillId !== null) owned.add(row.skillId);
    }

    const pt = Number(expectedPt) || 0;
    const surplus = pt - coveredCost;

    // Gap priority: rate desc, then standalone effective cost asc (computed
    // against what the covered set already owns), then id.
    const purchasable = gapRows.filter(row => row.kind === undefined || row.kind === 'white' || row.kind === 'unknown');
    const notPurchasable = gapRows.filter(row => !purchasable.includes(row));
    const sortKey = new Map(purchasable.map(row => [row, rowCost(row, catalog, owned, discounts).total]));
    purchasable.sort((a, b) => (b.rate || 0) - (a.rate || 0) || sortKey.get(a) - sortKey.get(b) || (a.skillId || 0) - (b.skillId || 0));

    const gapByPriority = [];
    let cumulativeCost = 0;
    for (const row of purchasable) {
      const cost = rowCost(row, catalog, owned, discounts);
      cumulativeCost += cost.total;
      gapByPriority.push({
        ...row,
        cost: cost.total,
        costComponents: cost.components || [],
        alreadyOwned: cost.alreadyOwned === true,
        cumulativeCost,
        withinSurplus: cumulativeCost <= surplus
      });
      if (row.skillId !== null) owned.add(row.skillId);
    }

    const inheritedUniqueItems = inheritedRows.map(row => ({ skillId: row.skillId, name: row.name, rate: row.rate, cost: num(row.cost) || 0 }));
    return {
      expectedPt: pt,
      coveredCost,
      coveredItems,
      surplus,
      gapByPriority,
      gapCostTotal: cumulativeCost,
      // expectedPt - coveredCost - gapCostTotal: PT still unspent after buying
      // every gap skill (negative = not enough PT for the whole gap).
      uncoveredAfterAllGap: surplus - cumulativeCost,
      gapNotPurchasable: notPurchasable.map(row => ({ skillId: row.skillId, name: row.name, rate: row.rate, kind: row.kind })),
      // Inherited uniques are also bought with PT (meta `cost` column); listed
      // for information, not subtracted from `surplus`.
      inheritedUniqueItems,
      inheritedUniqueCostTotal: inheritedUniqueItems.reduce((sum, row) => sum + row.cost, 0)
    };
  }

  // ------------------------------------------------------------ inventory

  function ownershipIndex(inventory, catalog, assumeOwnedRarities) {
    const index = indexCatalog(catalog);
    const owned = new Map(); // supportId -> { limitBreak, level, assumed }
    for (const card of list(inventory && inventory.supportCards)) {
      const id = num(card && card.id);
      if (id === null) continue;
      owned.set(id, { limitBreak: num(card.limitBreak), level: num(card.level), assumed: false });
    }
    const rarities = new Set(list(assumeOwnedRarities));
    for (const support of index.supportById.values()) {
      if (rarities.has(support.rarity) && !owned.has(support.id)) owned.set(support.id, { limitBreak: null, level: null, assumed: true });
    }
    const ownedOutfits = new Set(list(inventory && inventory.trainees).map(entry => num(entry && (entry.outfitId != null ? entry.outfitId : entry.id))).filter(id => id !== null));
    return { owned, ownedOutfits };
  }

  function releasedSupportIds(index) {
    const ids = [];
    for (const support of index.supportById.values()) {
      if (!releasedOn(support, index)) continue;
      ids.push(support.id);
    }
    return ids.sort(byNumberAsc);
  }

  // ------------------------------------------------------------- breeders

  // Accepts a normalised list [{id,label,whiteFactors:[{skillId?|name,stars}]}],
  // runtime breeders (persistence-core: {id,name,whiteFactors}) and
  // owned-breeder-registry records ({planningId,displayName,
  // knownWhiteFactorHighlights}).
  function normalizeBreeders(breeders, catalog) {
    const index = indexCatalog(catalog);
    return list(breeders).filter(Boolean).map((raw, position) => {
      const factors = list(raw.whiteFactors).length ? raw.whiteFactors : list(raw.knownWhiteFactorHighlights);
      return {
        id: raw.id != null ? String(raw.id) : raw.planningId != null ? String(raw.planningId) : `breeder-${position}`,
        label: raw.label || raw.displayName || raw.name || String(raw.id || raw.planningId || position),
        blue: raw.blue || raw.bodyBlue || raw.blueFactor || null,
        red: raw.red || raw.bodyRed || raw.redFactor || null,
        outfitId: num(raw.outfitId != null ? raw.outfitId : raw.cardId),
        uniqueLabel: raw.bodyUnique && raw.bodyUnique.label ? String(raw.bodyUnique.label) : null,
        uniqueStars: raw.bodyUnique ? num(raw.bodyUnique.stars) : null,
        usable: raw.usableAsBreeder !== false,
        whiteFactors: factors.filter(Boolean).map(factor => {
          let skillId = num(factor.skillId);
          if (skillId === null && factor.name) {
            const hit = index.nameIndex.get(normalizeName(factor.name));
            skillId = hit === undefined ? null : hit;
          }
          return { skillId, name: factor.name || null, stars: num(factor.stars) };
        })
      };
    });
  }

  // ------------------------------------------------------ stallion sources

  function cardMatchesFor(skillId, index) {
    // supportId -> best {via, matchedSkillId, exact, relation}
    const result = new Map();
    const partial = new Map();
    for (const candidateId of relatedSkillIds(skillId, index)) {
      const bucket = index.supportsBySkill.get(candidateId);
      if (!bucket) continue;
      const rel = relation(skillId, candidateId, index);
      if (!rel) continue;
      for (const [supportId, via] of bucket) {
        const entry = { via, matchedSkillId: candidateId, exact: rel.exact, relation: rel.relation };
        const target = rel.unlocksTarget ? result : partial;
        const prev = target.get(supportId);
        if (!prev || (entry.exact && !prev.exact) || (entry.exact === prev.exact && entry.via === 'event' && prev.via !== 'event')) target.set(supportId, entry);
      }
    }
    for (const id of result.keys()) partial.delete(id);
    return { result, partial };
  }

  function outfitMatchesFor(skillId, index) {
    const result = new Map();
    for (const candidateId of relatedSkillIds(skillId, index)) {
      const bucket = index.cardsBySkill.get(candidateId);
      if (!bucket) continue;
      const rel = relation(skillId, candidateId, index);
      if (!rel || !rel.unlocksTarget) continue;
      for (const [cardId, via] of bucket) {
        const prev = result.get(cardId);
        if (!prev || (rel.exact && !prev.exact)) result.set(cardId, { via, matchedSkillId: candidateId, exact: rel.exact });
      }
    }
    return result;
  }

  function findStallionSources({ gapSkillIds = [], catalog, inventory = {}, borrowPool = 'all-released', breeders = [], assumeOwnedRarities = ['R', 'SR'] } = {}) {
    const index = indexCatalog(catalog);
    const { owned, ownedOutfits } = ownershipIndex(inventory, catalog, assumeOwnedRarities);
    const pool = new Set(borrowPool === 'all-released' || borrowPool === undefined || borrowPool === null
      ? releasedSupportIds(index)
      : list(borrowPool).map(num).filter(id => id !== null));
    const normalizedBreeders = normalizeBreeders(breeders, catalog);

    return list(gapSkillIds).map(num).filter(id => id !== null).map(skillId => {
      const skill = index.skillById.get(skillId);
      const { result: cardMatches, partial } = cardMatchesFor(skillId, index);
      const ownedCards = [];
      const borrowOnlyCards = [];
      for (const [supportId, match] of [...cardMatches].sort((a, b) => a[0] - b[0])) {
        const support = index.supportById.get(supportId);
        const ownership = owned.get(supportId);
        const row = {
          supportId,
          name: supportDisplayName(support),
          rarity: support ? support.rarity : null,
          supportType: support ? support.supportType : null,
          via: match.via,
          matchedSkillId: match.matchedSkillId,
          exact: match.exact,
          limitBreak: ownership ? ownership.limitBreak : null
        };
        if (ownership) ownedCards.push({ ...row, assumedOwned: ownership.assumed });
        else if (pool.has(supportId)) borrowOnlyCards.push(row);
      }
      const traineeOutfits = [...outfitMatchesFor(skillId, index)]
        .sort((a, b) => a[0] - b[0])
        .map(([cardId, match]) => {
          const card = index.cardById.get(cardId);
          return {
            cardId,
            name: card ? `${card.titleZhTw || card.title || ''}${card.nameZhTw || card.name || ''}` : `#${cardId}`,
            via: match.via,
            matchedSkillId: match.matchedSkillId,
            exact: match.exact,
            owned: ownedOutfits.has(cardId)
          };
        });
      const scenarioEventIds = [];
      for (const candidateId of relatedSkillIds(skillId, index)) {
        const rel = relation(skillId, candidateId, index);
        if (!rel || !rel.unlocksTarget) continue;
        const candidate = index.skillById.get(candidateId);
        for (const scenarioId of list(candidate && candidate.sources && candidate.sources.scenarioEvent)) {
          if (!scenarioEventIds.includes(scenarioId)) scenarioEventIds.push(scenarioId);
        }
      }
      scenarioEventIds.sort((a, b) => Number(a) - Number(b));
      // Card / outfit ids named in the catalog's skill `sources` lists (of the
      // skill and of family members that unlock it) that are NOT in the zh_tw
      // catalog, i.e. JP-only cards. Matching above skips them; surfaced here
      // so the UI can say "the source exists, just not on TW yet".
      const unreleasedSupportIds = new Set();
      const unreleasedOutfitIds = new Set();
      for (const candidateId of relatedSkillIds(skillId, index)) {
        const rel = relation(skillId, candidateId, index);
        if (!rel || !rel.unlocksTarget) continue;
        const candidate = index.skillById.get(candidateId);
        const sources = (candidate && candidate.sources) || {};
        for (const raw of list(sources.supportHint).concat(list(sources.supportEvent))) {
          const id = num(raw);
          if (id !== null && !index.supportById.has(id)) unreleasedSupportIds.add(id);
        }
        for (const raw of list(sources.characterBuiltIn).concat(list(sources.characterEvent))) {
          const id = num(raw);
          if (id !== null && !index.cardById.has(id)) unreleasedOutfitIds.add(id);
        }
      }
      const ownedBreedersWithFactor = [];
      for (const breeder of normalizedBreeders) {
        let best = null;
        for (const factor of breeder.whiteFactors) {
          if (factor.skillId === null) continue;
          const rel = relation(skillId, factor.skillId, index);
          if (!rel || !rel.unlocksTarget) continue;
          if (!best || (rel.exact && !best.exact) || (rel.exact === best.exact && (factor.stars || 0) > (best.stars || 0))) {
            best = { breederId: breeder.id, label: breeder.label, stars: factor.stars, factorSkillId: factor.skillId, exact: rel.exact };
          }
        }
        if (best) ownedBreedersWithFactor.push(best);
      }
      const anyCardInCatalog = cardMatches.size > 0;
      return {
        skillId,
        name: skillDisplayName(skill) || `#${skillId}`,
        unknown: !skill,
        ownedCards,
        borrowOnlyCards,
        partialCards: [...partial].sort((a, b) => a[0] - b[0]).map(([supportId, match]) => ({ supportId, name: supportDisplayName(index.supportById.get(supportId)), ...match, owned: owned.has(supportId) })),
        traineeOutfits,
        scenarioEvent: scenarioEventIds.length > 0,
        scenarioEventIds,
        ownedBreedersWithFactor,
        unreleasedSources: {
          supportIds: [...unreleasedSupportIds].sort(byNumberAsc),
          outfitIds: [...unreleasedOutfitIds].sort(byNumberAsc)
        },
        // No released support card, no trainee outfit and no scenario event in
        // the catalog supplies this skill: it can only come from an existing
        // (old-scenario) stallion / rental.
        sourceless: !anyCardInCatalog && traineeOutfits.length === 0 && scenarioEventIds.length === 0
      };
    });
  }

  // ------------------------------------------------------- stallion deck

  // Greedy weighted set cover. The ONLY weight is the skill's adoption `rate`
  // from the meta stats: at each step the card that adds the largest sum of
  // rates of not-yet-covered gap skills is taken. Ties: more newly covered
  // skills, then a card that covers via event over hint-only, then higher
  // limitBreak (unknown = -1), then lower supportId.
  // Slots: up to maxOwned cards from the owned set and maxBorrow cards from
  // the borrow pool (any released card). One character per deck (game rule);
  // pass traineeCharacterId to also exclude the stallion run's own character.
  // preCoveredSkillIds: gap skills the stallion run's protagonist supplies
  // itself; they count as covered before the greedy runs (reported in
  // preCoveredSkillIds, included in coveredSkillIds).
  function suggestStallionDeck({ gapRows = [], catalog, inventory = {}, maxOwned = 5, maxBorrow = 1, lockedCardIds = [], borrowPool = 'all-released', traineeCharacterId = null, assumeOwnedRarities = ['R', 'SR'], preCoveredSkillIds = [] } = {}) {
    const index = indexCatalog(catalog);
    const { owned } = ownershipIndex(inventory, catalog, assumeOwnedRarities);
    const pool = borrowPool === 'all-released' || borrowPool === undefined || borrowPool === null
      ? releasedSupportIds(index)
      : list(borrowPool).map(num).filter(id => id !== null);

    const targets = [];
    const rateById = new Map();
    for (const row of list(gapRows)) {
      const id = num(row && row.skillId);
      if (id === null || rateById.has(id)) continue;
      rateById.set(id, Number(row.rate) || 0);
      targets.push(id);
    }

    // supportId -> Map(skillId -> via) of gap skills this card unlocks
    const coverage = new Map();
    for (const skillId of targets) {
      for (const [supportId, match] of cardMatchesFor(skillId, index).result) {
        if (!coverage.has(supportId)) coverage.set(supportId, new Map());
        coverage.get(supportId).set(skillId, match.via);
      }
    }

    const chosen = [];
    const covered = new Set();
    const preCovered = new Set(list(preCoveredSkillIds).map(num).filter(id => id !== null && rateById.has(id)));
    preCovered.forEach(id => covered.add(id));
    const usedCharacters = new Set();
    if (traineeCharacterId !== null && traineeCharacterId !== undefined) usedCharacters.add(num(traineeCharacterId));
    let ownedLeft = Math.max(0, Number(maxOwned) || 0);
    let borrowLeft = Math.max(0, Number(maxBorrow) || 0);

    const take = (supportId, borrowed, locked) => {
      const support = index.supportById.get(supportId);
      const cardSkills = coverage.get(supportId) || new Map();
      const newly = [...cardSkills.keys()].filter(id => !covered.has(id)).sort(byNumberAsc);
      newly.forEach(id => covered.add(id));
      if (support && support.characterId != null) usedCharacters.add(num(support.characterId));
      if (borrowed) borrowLeft -= 1; else ownedLeft -= 1;
      chosen.push({
        supportId,
        name: supportDisplayName(support),
        owned: owned.has(supportId),
        borrowed,
        locked: locked === true,
        limitBreak: owned.has(supportId) ? owned.get(supportId).limitBreak : null,
        newlyCovered: newly,
        newlyCoveredRateSum: sumRates(newly.map(id => ({ rate: rateById.get(id) }))),
        allCovered: [...cardSkills.keys()].sort(byNumberAsc)
      });
    };

    for (const raw of list(lockedCardIds)) {
      const id = num(raw);
      if (id === null || chosen.some(card => card.supportId === id)) continue;
      const support = index.supportById.get(id);
      if (support && support.characterId != null && usedCharacters.has(num(support.characterId))) continue;
      if (owned.has(id) && ownedLeft > 0) take(id, false, true);
      else if (borrowLeft > 0) take(id, true, true);
    }

    const candidateIds = [...new Set([...owned.keys(), ...pool])].filter(id => coverage.has(id)).sort(byNumberAsc);
    for (;;) {
      if (ownedLeft <= 0 && borrowLeft <= 0) break;
      let best = null;
      for (const supportId of candidateIds) {
        if (chosen.some(card => card.supportId === supportId)) continue;
        const support = index.supportById.get(supportId);
        if (support && support.characterId != null && usedCharacters.has(num(support.characterId))) continue;
        const isOwned = owned.has(supportId);
        let borrowed;
        if (isOwned && ownedLeft > 0) borrowed = false;
        else if (borrowLeft > 0 && pool.includes(supportId)) borrowed = true;
        else continue;
        const newly = [...coverage.get(supportId)].filter(([id]) => !covered.has(id));
        if (!newly.length) continue;
        const candidate = {
          supportId,
          borrowed,
          gain: newly.reduce((sum, [id]) => sum + rateById.get(id), 0),
          count: newly.length,
          event: newly.some(([, via]) => via === 'event') ? 1 : 0,
          limitBreak: isOwned && owned.get(supportId).limitBreak !== null ? owned.get(supportId).limitBreak : -1
        };
        if (!best
          || candidate.gain > best.gain + 1e-9
          || (Math.abs(candidate.gain - best.gain) <= 1e-9 && (
            candidate.count > best.count
            || (candidate.count === best.count && (
              candidate.event > best.event
              || (candidate.event === best.event && (
                candidate.limitBreak > best.limitBreak
                || (candidate.limitBreak === best.limitBreak && candidate.supportId < best.supportId)))))))) {
          best = candidate;
        }
      }
      if (!best) break;
      take(best.supportId, best.borrowed, false);
    }

    const coveredSkillIds = targets.filter(id => covered.has(id));
    const uncoveredSkillIds = targets.filter(id => !covered.has(id));
    const rateOf = ids => sumRates(ids.map(id => ({ rate: rateById.get(id) })));
    return {
      cards: chosen,
      preCoveredSkillIds: targets.filter(id => preCovered.has(id)),
      coveredSkillIds,
      uncoveredSkillIds,
      coveredRateSum: rateOf(coveredSkillIds),
      totalRateSum: rateOf(targets)
    };
  }

  // ------------------------------------------------------------- aptitude

  const APTITUDE_KEYS = ['turf', 'dirt', 'short', 'mile', 'medium', 'long', 'runner', 'leader', 'betweener', 'chaser'];
  const LETTERS = ['G', 'F', 'E', 'D', 'C', 'B', 'A', 'S'];
  const STYLE_KEYS = {
    逃げ: 'runner', 先行: 'leader', 差し: 'betweener', 追込: 'chaser', 追い込み: 'chaser',
    領頭: 'runner', 前列: 'leader', 居中: 'betweener', 後追: 'chaser',
    runner: 'runner', leader: 'leader', betweener: 'betweener', chaser: 'chaser',
    1: 'runner', 2: 'leader', 3: 'betweener', 4: 'chaser'
  };
  const DISTANCE_KEYS = { short: 'short', sprint: 'short', mile: 'mile', medium: 'medium', middle: 'medium', long: 'long' };

  function distanceKeyFor(course) {
    if (!course) return null;
    const type = course.distanceType && DISTANCE_KEYS[String(course.distanceType).toLowerCase()];
    if (type) return type;
    const meters = num(course.distance);
    if (meters === null) return null;
    if (meters <= 1400) return 'short';
    if (meters <= 1800) return 'mile';
    if (meters <= 2400) return 'medium';
    return 'long';
  }

  function aptitudeEntry(key, letter) {
    const position = LETTERS.indexOf(String(letter || '').toUpperCase());
    if (position < 0) return { key, letter: letter || null, stepsToA: null, stepsToS: null, unknown: true };
    return {
      key,
      letter: LETTERS[position],
      stepsToA: Math.max(0, LETTERS.indexOf('A') - position),
      stepsToS: Math.max(0, LETTERS.indexOf('S') - position)
    };
  }

  function summarizeAptitudeNeeds({ cup, traineeCard, archetypeId, style } = {}) {
    const course = cup && cup.course ? cup.course : {};
    const surfaceKey = String(course.surface || '').toLowerCase() === 'dirt' ? 'dirt' : (course.surface ? 'turf' : null);
    const distanceKey = distanceKeyFor(course);
    const archetype = archetypeId !== undefined ? findArchetype(cup, archetypeId) : null;
    const styleRaw = style !== undefined && style !== null ? style : archetype ? archetype.style : null;
    const styleKey = styleRaw !== null && styleRaw !== undefined ? STYLE_KEYS[styleRaw] || null : null;
    const aptitude = list(traineeCard && traineeCard.aptitude);
    const letterFor = key => (key ? aptitude[APTITUDE_KEYS.indexOf(key)] : null);
    const notes = [];
    if (!traineeCard) notes.push('no trainee card: letters unknown');
    if (!styleKey) notes.push('running style unknown');
    return {
      surface: surfaceKey ? aptitudeEntry(surfaceKey, letterFor(surfaceKey)) : null,
      distance: distanceKey ? aptitudeEntry(distanceKey, letterFor(distanceKey)) : null,
      style: styleKey ? aptitudeEntry(styleKey, letterFor(styleKey)) : null,
      notes
    };
  }

  // ------------------------------------------------------- lazy route
  //
  // The functions below feed the page's 「懶人路線」 summary. Same rule as
  // the rest of this module: they only partition, filter, count and sum
  // game data; every ordering is a plain multi-key sort documented inline.

  function rarityRankOf(rarity) {
    return { SSR: 3, SR: 2, R: 1 }[rarity] || 0;
  }

  // Same rule as indexCatalog's availableAt (strict catalogs: null date = not
  // on TW; old catalog: missing date = released).
  function releasedOn(record, index) {
    if (!record) return !index.strict;
    if (!record.releaseDate) return !index.strict;
    return !index.asOf || String(record.releaseDate).slice(0, 10) <= index.asOf;
  }

  function outfitLabel(card) {
    if (!card) return { name: '', title: '' };
    return {
      name: String(card.nameZhTw || card.name || card.nameJp || `#${card.id}`),
      title: String(card.titleZhTw || card.title || card.titleJp || '').replace(/^\[|\]$/g, '')
    };
  }

  // Gene (inherited) skill id -> parent unique skill ids. Encoding in
  // data/gametora-data.json (verified): a unique skill (rarity 3..5) carries
  // `geneVersionId` = id of its inherited version (110771 -> 910771) and
  // `geneVersion.parentSkillIds` = every unique that inherits as that gene
  // (a ★1/2 card unique and its ★3 version share one gene: 10071 and
  // 100071 -> 900071). cup-meta inherited rows carry the gene id as skillId
  // and the ★3 parent as baseSkillId (used as fallback).
  function parentsByGeneId(index) {
    if (index.parentsByGeneId) return index.parentsByGeneId;
    const map = new Map();
    const add = (geneId, parentId) => {
      if (geneId === null || parentId === null) return;
      if (!map.has(geneId)) map.set(geneId, []);
      const bucket = map.get(geneId);
      if (!bucket.includes(parentId)) bucket.push(parentId);
    };
    for (const skill of index.skillById.values()) {
      const gene = skill.geneVersion || null;
      const geneId = num(skill.geneVersionId) !== null ? num(skill.geneVersionId) : num(gene && gene.id);
      if (geneId === null) continue;
      add(geneId, skill.id);
      for (const parentId of list(gene && gene.parentSkillIds)) add(geneId, num(parentId));
    }
    for (const bucket of map.values()) bucket.sort(byNumberAsc);
    index.parentsByGeneId = map;
    return map;
  }

  // For each inherited-unique target row: which trainee outfits own the
  // parent unique (so a parent / grandparent of that character passes it
  // down), whether the owner has that outfit, and JP-only outfit ids named
  // in the parent skill's sources (the unique exists but not on TW yet).
  function findInheritedUniqueOwners({ rows = [], catalog, inventory = {} } = {}) {
    const index = indexCatalog(catalog);
    const { ownedOutfits } = ownershipIndex(inventory, catalog, []);
    const genes = parentsByGeneId(index);
    return list(rows).filter(Boolean).map(row => {
      const geneId = num(row.skillId);
      let parentSkillIds = (geneId !== null && genes.get(geneId)) || [];
      if (!parentSkillIds.length && num(row.baseSkillId) !== null && num(row.baseSkillId) !== geneId) parentSkillIds = [num(row.baseSkillId)];
      const owners = [];
      const unreleased = new Set();
      for (const parentId of parentSkillIds) {
        for (const card of index.cardById.values()) {
          if (!list(card.uniqueSkillIds).map(num).includes(parentId)) continue;
          if (owners.some(owner => owner.cardId === card.id)) continue;
          const label = outfitLabel(card);
          owners.push({
            cardId: card.id,
            characterId: num(card.characterId),
            name: label.name,
            title: label.title,
            owned: ownedOutfits.has(card.id),
            released: releasedOn(card, index)
          });
        }
        const parent = index.skillById.get(parentId);
        for (const raw of list(parent && parent.sources && parent.sources.characterBuiltIn)) {
          const id = num(raw);
          if (id !== null && !index.cardById.has(id)) unreleased.add(id);
        }
      }
      // owned first, then outfit id
      owners.sort((a, b) => (b.owned - a.owned) || a.cardId - b.cardId);
      return {
        skillId: geneId,
        baseSkillId: num(row.baseSkillId),
        parentSkillIds: parentSkillIds.slice(),
        name: row.name || skillDisplayName(index.skillById.get(parentSkillIds[0])) || `#${geneId}`,
        rate: Number(row.rate) || 0,
        cost: num(row.cost),
        owners,
        ownerOwned: owners.some(owner => owner.owned),
        unreleasedOwnerIds: [...unreleased].sort(byNumberAsc)
      };
    });
  }

  // Owned trainee outfits as stallion (parent) candidates. Facts per outfit:
  //   uniqueDemandRate     adoption rate of the inherited unique this outfit
  //                        passes down for the target (0 if none)
  //   selfSuppliedGap      breedable gap skills the outfit supplies itself
  //                        (unique/innate/awakening/evolved/event, same family
  //                        rules as findStallionSources' traineeOutfits)
  //   selfSuppliedRateSum  plain sum of those skills' adoption rates
  // Sort (no blended score): usable first (an outfit of the battle trainee's
  // own character cannot be its parent), then uniqueDemandRate desc, then
  // selfSuppliedRateSum desc, then selfSuppliedGap count desc, then id asc.
  function rankStallionCandidates({ gapRows = [], inheritedUniqueRows = [], catalog, inventory = {}, breeders = [], traineeCharacterId = null } = {}) {
    const index = indexCatalog(catalog);
    const { ownedOutfits } = ownershipIndex(inventory, catalog, []);
    const demandByCard = new Map();
    for (const row of findInheritedUniqueOwners({ rows: inheritedUniqueRows, catalog, inventory })) {
      for (const owner of row.owners) {
        const prev = demandByCard.get(owner.cardId);
        if (!prev || row.rate > prev.rate) demandByCard.set(owner.cardId, { skillId: row.skillId, name: row.name, rate: row.rate });
      }
    }
    const gapById = new Map();
    for (const row of list(gapRows)) {
      const id = num(row && row.skillId);
      if (id === null || gapById.has(id)) continue;
      gapById.set(id, { skillId: id, name: row.name || skillDisplayName(index.skillById.get(id)), rate: Number(row.rate) || 0 });
    }
    const supplyByCard = new Map();
    for (const entry of gapById.values()) {
      for (const [cardId, match] of outfitMatchesFor(entry.skillId, index)) {
        if (!ownedOutfits.has(cardId)) continue;
        if (!supplyByCard.has(cardId)) supplyByCard.set(cardId, []);
        supplyByCard.get(cardId).push({ ...entry, via: match.via, matchedSkillId: match.matchedSkillId, exact: match.exact });
      }
    }
    const normalized = normalizeBreeders(breeders, catalog);
    const traineeChar = num(traineeCharacterId);
    const candidates = [...ownedOutfits].filter(id => index.cardById.has(id)).map(cardId => {
      const card = index.cardById.get(cardId);
      const label = outfitLabel(card);
      const supplied = (supplyByCard.get(cardId) || []).sort((a, b) => b.rate - a.rate || a.skillId - b.skillId);
      const demand = demandByCard.get(cardId) || null;
      const sameCharacterAsTrainee = traineeChar !== null && num(card.characterId) === traineeChar;
      return {
        cardId,
        characterId: num(card.characterId),
        name: label.name,
        title: label.title,
        uniqueDemand: demand,
        uniqueDemandRate: demand ? demand.rate : 0,
        selfSuppliedGap: supplied.map(entry => entry.skillId),
        selfSupplied: supplied,
        selfSuppliedRateSum: sumRates(supplied),
        sameCharacterAsTrainee,
        usable: !sameCharacterAsTrainee,
        relevant: !!demand || supplied.length > 0,
        existingBreeders: normalized.filter(breeder => breeder.outfitId === cardId).map(breeder => ({ breederId: breeder.id, label: breeder.label }))
      };
    });
    candidates.sort((a, b) => (b.usable - a.usable)
      || b.uniqueDemandRate - a.uniqueDemandRate
      || b.selfSuppliedRateSum - a.selfSuppliedRateSum
      || b.selfSuppliedGap.length - a.selfSuppliedGap.length
      || a.cardId - b.cardId);
    return candidates;
  }

  // Partition analyzeBattleGap rows by how the owner gets each skill. Every
  // row lands in exactly one group:
  //   free          trainee built-in, or the current scenario when no deck card
  //                 gives it ("不用管")
  //   deck          at least one deck card unlocks it (event or hint)
  //   breed         white gap skill with some TW source or an owned stallion
  //   unobtainable  white gap skill in unobtainableSkillIds
  //   notBreedable  non-white gap (other character's unique, evolutions, unknown)
  //   inherited     inherited uniques
  // tiers: optional filter on row.tier ('core' / 'common' / 'niche').
  function groupTargetsByAcquisition({ gap, unobtainableSkillIds = [], tiers = null } = {}) {
    const unobtainable = new Set(list(unobtainableSkillIds).map(num));
    const keep = row => !tiers || list(tiers).includes(row.tier);
    const groups = { free: [], deck: [], breed: [], unobtainable: [], notBreedable: [], inherited: [] };
    for (const row of list(gap && gap.covered).filter(keep)) {
      const src = row.sources || {};
      if (src.trainee) groups.free.push({ ...row, freeVia: 'trainee' });
      else if (list(src.deck).length) groups.deck.push(row);
      else groups.free.push({ ...row, freeVia: 'scenario' });
    }
    for (const row of list(gap && gap.gap).filter(keep)) {
      if (row.kind !== 'white') groups.notBreedable.push(row);
      else if (unobtainable.has(row.skillId)) groups.unobtainable.push(row);
      else groups.breed.push(row);
    }
    for (const row of list(gap && gap.inheritedUniques).filter(keep)) groups.inherited.push(row);
    const byRate = (a, b) => (b.rate || 0) - (a.rate || 0) || (a.skillId || 0) - (b.skillId || 0);
    Object.values(groups).forEach(rows => rows.sort(byRate));
    return groups;
  }

  // Per deck card (deck order, duplicates dropped): which of `rows` it
  // unlocks, split into event (the card's event gives the skill / its hint
  // chain) and hint (training hint). multiSource = 2+ deck cards unlock it.
  function groupRowsByDeckCard({ rows = [], deckCardIds = [] } = {}) {
    const ids = [];
    for (const raw of list(deckCardIds)) {
      const id = num(raw);
      if (id !== null && !ids.includes(id)) ids.push(id);
    }
    const out = ids.map(supportId => ({ supportId, event: [], hint: [], count: 0 }));
    const byId = new Map(out.map(entry => [entry.supportId, entry]));
    const sorted = list(rows).slice().sort((a, b) => (b.rate || 0) - (a.rate || 0) || (a.skillId || 0) - (b.skillId || 0));
    for (const row of sorted) {
      const deck = list(row.sources && row.sources.deck);
      const multiSource = new Set(deck.map(entry => entry.supportId)).size > 1;
      for (const entry of deck) {
        const bucket = byId.get(num(entry.supportId));
        if (!bucket) continue;
        const item = { skillId: row.skillId, name: row.name, rate: row.rate, tier: row.tier, multiSource, matchedSkillId: entry.matchedSkillId, exact: entry.exact !== false };
        (entry.via === 'event' ? bucket.event : bucket.hint).push(item);
        bucket.count += 1;
      }
    }
    return out;
  }

  // Ordered ways to obtain one breedable gap skill as a white factor, from a
  // findStallionSources row. Fixed order (no score):
  //   1 owned card whose event gives it   2 owned card that hints it
  //   3 owned outfit that has it built in / via its events
  //   4 borrow-only card (event, then hint)   5 scenario event (catalog)
  //   6 outfit the owner does not have (built in / via its events)
  // Cards within a class: exact skill before family unlock, then rarity
  // SSR > SR > R, then limitBreak desc (unknown last), then id asc.
  // Owned stallions already carrying the factor are listed separately
  // (exact first, then stars desc).
  function rankBreedOptions(sourceRow) {
    const row = sourceRow || {};
    const cardOrder = (a, b) => (b.exact - a.exact)
      || rarityRankOf(b.rarity) - rarityRankOf(a.rarity)
      || ((b.limitBreak == null ? -1 : b.limitBreak) - (a.limitBreak == null ? -1 : a.limitBreak))
      || a.supportId - b.supportId;
    const ownedCards = list(row.ownedCards).slice().sort(cardOrder);
    const borrowCards = list(row.borrowOnlyCards).slice().sort(cardOrder);
    const options = [];
    const pushCard = (card, kind) => options.push({ kind, via: card.via, supportId: card.supportId, name: card.name, rarity: card.rarity, supportType: card.supportType, limitBreak: card.limitBreak, assumedOwned: card.assumedOwned === true, matchedSkillId: card.matchedSkillId, exact: card.exact });
    ownedCards.filter(card => card.via === 'event').forEach(card => pushCard(card, 'owned-card'));
    ownedCards.filter(card => card.via !== 'event').forEach(card => pushCard(card, 'owned-card'));
    list(row.traineeOutfits).filter(outfit => outfit.owned).slice().sort((a, b) => (b.exact - a.exact) || a.cardId - b.cardId)
      .forEach(outfit => options.push({ kind: 'owned-outfit', via: outfit.via, cardId: outfit.cardId, name: outfit.name, matchedSkillId: outfit.matchedSkillId, exact: outfit.exact }));
    borrowCards.filter(card => card.via === 'event').forEach(card => pushCard(card, 'borrow-card'));
    borrowCards.filter(card => card.via !== 'event').forEach(card => pushCard(card, 'borrow-card'));
    list(row.scenarioEventIds).forEach(scenarioId => options.push({ kind: 'scenario', scenarioId }));
    list(row.traineeOutfits).filter(outfit => !outfit.owned).slice().sort((a, b) => (b.exact - a.exact) || a.cardId - b.cardId)
      .forEach(outfit => options.push({ kind: 'unowned-outfit', via: outfit.via, cardId: outfit.cardId, name: outfit.name, matchedSkillId: outfit.matchedSkillId, exact: outfit.exact }));
    const existingBreeders = list(row.ownedBreedersWithFactor).slice()
      .sort((a, b) => (b.exact - a.exact) || ((b.stars || 0) - (a.stars || 0)) || String(a.breederId).localeCompare(String(b.breederId)));
    const ownedOptionCount = options.filter(option => option.kind === 'owned-card' || option.kind === 'owned-outfit').length;
    return {
      skillId: row.skillId,
      name: row.name,
      existingBreeders,
      options,
      ownedOptionCount,
      borrowOnly: ownedOptionCount === 0 && options.some(option => option.kind === 'borrow-card'),
      sourceless: row.sourceless === true,
      unreleasedSources: row.unreleasedSources || { supportIds: [], outfitIds: [] }
    };
  }

  // Split computePtBudget's gap priority list into white factors that must
  // be carried (rate >= coreRate) and the ones that only use leftover PT
  // (below coreRate, inside the cut line). Running totals are the budget's
  // own cumulativeCost (its priority order is rate desc, so every must-carry
  // row precedes every optional row).
  function planWhiteFactors({ budget, coreRate = TIER_CORE } = {}) {
    const rows = list(budget && budget.gapByPriority);
    const mustCarry = rows.filter(row => (row.rate || 0) >= coreRate);
    const optional = rows.filter(row => (row.rate || 0) < coreRate && row.withinSurplus);
    const within = rows.filter(row => row.withinSurplus);
    const allFit = rows.length > 0 && within.length === rows.length;
    const spent = within.length ? within[within.length - 1].cumulativeCost : 0;
    const surplus = budget ? Number(budget.surplus) || 0 : 0;
    return {
      mustCarry,
      mustCarryBeyondCut: mustCarry.filter(row => !row.withinSurplus),
      optional,
      beyondCut: rows.filter(row => !row.withinSurplus),
      allFit,
      spentWithinCut: spent,
      // PT left after buying everything above the cut line
      leftover: surplus - spent
    };
  }

  // Facts about each owned stallion relative to this target: which gap
  // skills it already carries as white factors, which demanded inherited
  // unique it passes down (by its outfit, else by unique name), and its
  // red / blue factor (red marked relevant when its key is one of
  // aptitudeKeys, e.g. ['turf','long','runner']).
  function describeOwnedBreeders({ breeders = [], catalog, gapSkillIds = [], inheritedUniqueRows = [], aptitudeKeys = [] } = {}) {
    const index = indexCatalog(catalog);
    const normalized = normalizeBreeders(breeders, catalog);
    const gapIds = list(gapSkillIds).map(num).filter(id => id !== null);
    const owners = findInheritedUniqueOwners({ rows: inheritedUniqueRows, catalog });
    const keys = new Set(list(aptitudeKeys));
    return normalized.map(breeder => {
      const carriesGap = [];
      for (const skillId of gapIds) {
        let best = null;
        for (const factor of breeder.whiteFactors) {
          if (factor.skillId === null) continue;
          const rel = relation(skillId, factor.skillId, index);
          if (!rel || !rel.unlocksTarget) continue;
          if (!best || (rel.exact && !best.exact) || (rel.exact === best.exact && (factor.stars || 0) > (best.stars || 0))) {
            best = { skillId, factorSkillId: factor.skillId, stars: factor.stars, exact: rel.exact };
          }
        }
        if (best) carriesGap.push(best);
      }
      let inheritedUnique = null;
      for (const row of owners) {
        const byOutfit = breeder.outfitId !== null && row.owners.some(owner => owner.cardId === breeder.outfitId);
        const byName = !byOutfit && breeder.uniqueLabel && normalizeName(breeder.uniqueLabel) === normalizeName(row.name);
        if ((byOutfit || byName) && (!inheritedUnique || row.rate > inheritedUnique.rate)) {
          inheritedUnique = { skillId: row.skillId, name: row.name, rate: row.rate, stars: breeder.uniqueStars };
        }
      }
      const red = breeder.red && breeder.red.key ? { key: breeder.red.key, label: breeder.red.label || breeder.red.key, stars: num(breeder.red.stars), relevant: keys.has(breeder.red.key) } : null;
      const blue = breeder.blue && breeder.blue.key ? { key: breeder.blue.key, label: breeder.blue.label || breeder.blue.key, stars: num(breeder.blue.stars) } : null;
      return {
        breederId: breeder.id,
        label: breeder.label,
        outfitId: breeder.outfitId,
        usable: breeder.usable,
        whiteFactorCount: breeder.whiteFactors.length,
        carriesGap,
        inheritedUnique,
        red,
        blue,
        intersects: carriesGap.length > 0 || !!inheritedUnique || !!(red && red.relevant)
      };
    });
  }

  // Meta support cards (of one archetype) released on TW after the owner's
  // inventory snapshot and not currently marked owned: the snapshot cannot
  // know about them, so "未持有" for these is an assumption. Sorted rate desc.
  function cardsNewerThanInventory({ archetype, catalog, inventoryDate, ownedSupportIds = [] } = {}) {
    const index = indexCatalog(catalog);
    const date = inventoryDate ? String(inventoryDate).slice(0, 10) : null;
    if (!date) return [];
    const owned = new Set(list(ownedSupportIds).map(num));
    return list(archetype && archetype.supportCards)
      .filter(meta => meta && meta.supportId != null)
      .map(meta => ({ meta, support: index.supportById.get(num(meta.supportId)) }))
      .filter(({ support }) => support && support.releaseDate && String(support.releaseDate).slice(0, 10) > date && releasedOn(support, index) && !owned.has(support.id))
      .map(({ meta, support }) => ({ supportId: support.id, name: supportDisplayName(support), rate: Number(meta.rate) || 0, releaseDate: String(support.releaseDate).slice(0, 10) }))
      .sort((a, b) => b.rate - a.rate || a.supportId - b.supportId);
  }

  // Top-N meta cards (rate desc) of an archetype that the owner cannot field
  // as owned: not on TW, or not owned (the deck has one borrow slot; the
  // card currently borrowed in deckSlots is reported separately).
  function metaCardAvailability({ archetype, catalog, deckSlots = [], ownedSupportIds = [], topN = 6 } = {}) {
    const index = indexCatalog(catalog);
    const owned = new Set(list(ownedSupportIds).map(num));
    const borrowedIds = new Set(list(deckSlots).filter(slot => slot && slot.borrowed).map(slot => num(slot.supportId)));
    const top = list(archetype && archetype.supportCards).filter(Boolean).slice().sort((a, b) => (Number(b.rate) || 0) - (Number(a.rate) || 0)).slice(0, Math.max(0, topN));
    const notOnTw = [];
    const notOwned = [];
    const borrowed = [];
    for (const meta of top) {
      const support = meta.supportId != null ? index.supportById.get(num(meta.supportId)) : null;
      const entry = { supportId: support ? support.id : null, meta, name: support ? supportDisplayName(support) : `${meta.titleJa || ''}${meta.characterJa || ''}`, rate: Number(meta.rate) || 0 };
      // meta.twReleased is relative to the meta build day; a strict catalog
      // view already encodes availability at the planning date.
      if (!support || (!index.strict && meta.twReleased === false) || !releasedOn(support, index)) notOnTw.push(entry);
      else if (owned.has(support.id)) continue;
      else if (borrowedIds.has(support.id)) borrowed.push(entry);
      else notOwned.push(entry);
    }
    return { topN: top.length, notOnTw, notOwned, borrowed };
  }

  // Target rows whose only source is the current scenario (status
  // 'scenario') where every scenario entry that unlocks it is marked
  // verified:false in data/scenario-skill-sources.
  function unverifiedScenarioSources({ rows = [], catalog, scenarioSkills = [] } = {}) {
    const index = indexCatalog(catalog);
    const entries = list(scenarioSkills).filter(entry => entry && num(entry.skillId) !== null);
    const out = [];
    for (const row of list(rows)) {
      if (!row || row.status !== 'scenario') continue;
      const matching = entries.filter(entry => {
        const rel = relation(row.skillId, num(entry.skillId), index);
        return rel && rel.unlocksTarget;
      });
      if (matching.length && matching.every(entry => entry.verified === false)) {
        out.push({ skillId: row.skillId, name: row.name, rate: row.rate, scenarioSkillIds: matching.map(entry => num(entry.skillId)) });
      }
    }
    return out;
  }

  return {
    TIER_CORE,
    TIER_COMMON,
    APTITUDE_KEYS,
    ACTIVATION_FIELD_SIZE,
    STYLE_ORDER_BANDS,
    STYLE_ORDER_RATE_BANDS,
    FIELD_SIZE_BY_EVENT_MODE,
    VERIFIED_STYLES,
    fieldSizeForCup,
    orderBand,
    runningStyleId,
    courseFacts,
    classifySkillActivation,
    classifyTargetActivation,
    findInheritedUniqueOwners,
    rankStallionCandidates,
    groupTargetsByAcquisition,
    groupRowsByDeckCard,
    rankBreedOptions,
    planWhiteFactors,
    describeOwnedBreeders,
    cardsNewerThanInventory,
    metaCardAvailability,
    unverifiedScenarioSources,
    indexCatalog,
    normalizeName,
    skillTier,
    isNegativeSkill,
    familyOf,
    skillDisplayName,
    supportDisplayName,
    effectiveSkillCost,
    discountedCost,
    buildTargetSkills,
    resolveSkillSources,
    analyzeBattleGap,
    computePtBudget,
    normalizeBreeders,
    findStallionSources,
    suggestStallionDeck,
    summarizeAptitudeNeeds
  };
});
