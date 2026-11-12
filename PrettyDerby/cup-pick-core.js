(function (root, factory) {
  const gap = typeof module !== 'undefined' && module.exports ? require('./cup-gap-core.js') : root.CupGapCore;
  const api = factory(gap);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.CupPickCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Gap) {
  'use strict';

  // Skill pick optimizer ("技能取捨").
  //
  // Given cup + archetype + trainee + deck + PT, decide which skills to buy
  // and what the stallions must supply. Everything here is a documented rule:
  //
  // COST (same as the game): per skill floor(base × (1 − hint% − 切れ者%)),
  //   hint Lv0..5 = 0/10/20/30/35/40 %, 切れ者 = +10 %. Buying an upgrade
  //   also buys its not-yet-owned lower tiers (◎ needs ○, a gold needs the
  //   whites of its family), each component at its own hint level.
  //   Trainee innate / unique / evolved skills are owned (free).
  //
  // VALUE: the JP top-300 adoption rate of the skill for this archetype
  //   (cup-meta archetype.skills[].rate, every row). Meta rows mean "holds
  //   exactly this tier", so a family is one multiple-choice group:
  //     share(x)      = Σ rate of members y that imply x (y = x or x is a
  //                     prerequisite of y)   i.e. "% holding x or better"
  //     value(up to m) = Σ share(x) over x in {m} ∪ prerequisites(m)
  //   Linear chain ○ → ◎ → 金: V(○) = r○ + r◎ + r金, V(◎) = V(○) + (r◎ + r金),
  //   V(金) = V(◎) + r金. "買到 ○ 的價值＝至少有 ○ 的人數比例；升 ◎ 的追加價值
  //   ＝至少有 ◎ 的比例". A skill outside the meta list has value 0.
  //
  // STAGE 1: exact multiple-choice knapsack (DP over PT) maximising Σ value
  //   (ties: lower cost) subject to Σ cost ≤ expected PT, over skills that the
  //   trainee / deck / scenario can supply plus chosen inherited uniques.
  //   Verdicts (rules, not scores):
  //     必點  chosen at B and at B − 1000
  //     划算  chosen at B, dropped at B − 1000
  //     可放  not chosen at B; entryBudget = first B + k·100 where it is chosen
  //     無效  share < minValueRate: never offered
  //
  // STAGE 2: white-factor pool = valued skills (share ≥ minValueRate) with no
  //   stage-1 source. Order: value desc, then cheaper. With L = stage-1
  //   leftover and p = factorHintChance (an explicit assumption):
  //     deterministic cut: take in order while cumulative cost ≤ L
  //     expected cut k:    smallest k with p × Σ_{i ≤ k} cost_i ≥ L
  //     expected value:    p × Σ_{i ≤ k} value_i
  //   Default p = 1 (upper bound: every carried factor gives its hint).
  //
  // UPPER-BOUND DEFAULTS (owner's rule): every skill in a deck card's hint
  //   list (white or gold) is obtained at whiteHintLv = Lv5; event-granted
  //   skills (continuous AND random events) at the level the event gives
  //   (max over its results; the higher of event / hint when both); 切れ者 on.
  //
  // ACTIVATION: meta rows that can never fire for the archetype's running
  //   style on the cup course (CupGapCore.classifySkillActivation) have value
  //   0, verdict 不會發動 ('impossible'), and are kept out of stage 2. A
  //   per-skill forceInclude (一定買) still wins and restores the rate.
  //
  // EXCLUSIVE EVENT CHOICES: a deck card event whose choices give different
  //   skills (route data choiceIndex) is one decision: exactly one choice is
  //   taken. Skills only on the other choices lose that card's event source
  //   (hint lists / other cards still count). Choice per event: the owner's
  //   override, else automatic — events where at most one choice has value
  //   take that choice; the remaining "contested" events are enumerated
  //   (≤ MAX_CHOICE_COMBOS combinations, full stage-1 solve each, max total
  //   value, ties: less PT, then the per-event rule); beyond that the
  //   per-event rule alone: the choice whose skills' chain value
  //   (Σ share of the skill and its lower tiers) is larger, ties lower index.

  const HINT_DISCOUNT_BY_LEVEL = [0, 10, 20, 30, 35, 40];
  const SHARP_DISCOUNT = 10;
  const MAX_CHOICE_COMBOS = 16;
  const DEFAULTS = {
    expectedPt: 6750,
    whiteHintLv: 5,
    goldHintLv: 2,
    sharp: true,
    awakeningHintLv: 0,
    inheritedHintLv: 0,
    inheritedWhiteHintLv: 1,
    factorHintChance: 1,
    minValueRate: 10,
    inheritN: 4,
    mustCarryRate: 70,
    verdictDrop: 1000,
    entryStep: 100,
    maxExtraBudget: 30000
  };
  const SCORE_SCALE = 100000; // DP score = value(hundredths) × SCALE − cost

  function list(value) { return Array.isArray(value) ? value : []; }
  function num(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  function clampLv(value) { return Math.max(0, Math.min(5, Math.round(Number(value) || 0))); }
  function round2(value) { return Math.round(value * 100) / 100; }

  // floor(base × (100 − hint% − sharp%) / 100), integer arithmetic.
  function skillCostAt(base, hintLv, sharp) {
    const pct = HINT_DISCOUNT_BY_LEVEL[clampLv(hintLv)] + (sharp ? SHARP_DISCOUNT : 0);
    return Math.floor((Number(base) || 0) * (100 - pct) / 100);
  }

  // ------------------------------------------------------------ event hints

  // routes: SUPPORT_EVENT_ROUTES.routes (+ TW extra). Returns
  // Map(supportId -> Map(skillId -> fixed hint level)), max over the card's
  // routes for that skill (different choices / results of one event are
  // alternatives, so they are not added together).
  // chosenByKey (optional): Map / object `${supportId}:${eventId}` -> chosen
  // choiceIndex for exclusive events; routes of other choices are skipped.
  function buildEventHintIndex(routes, chosenByKey) {
    const map = new Map();
    const chosen = toChoiceMap(chosenByKey);
    for (const route of list(routes)) {
      if (!route) continue;
      const supportId = num(route.supportId);
      const skillId = num(route.skillId);
      if (supportId === null || skillId === null) continue;
      const key = `${supportId}:${route.eventId}`;
      if (chosen.has(key) && chosen.get(key) !== num(route.choiceIndex)) continue;
      const levels = list(route.hintLevels).map(num).filter(v => v !== null);
      // grantType 'grant' = the skill itself is given (no PT); record as 5.
      const level = route.grantType === 'grant' ? 5 : (levels.length ? Math.max(...levels) : null);
      if (level === null) continue;
      if (!map.has(supportId)) map.set(supportId, new Map());
      const bucket = map.get(supportId);
      bucket.set(skillId, Math.max(bucket.get(skillId) || 0, level));
    }
    return map;
  }

  function toChoiceMap(value) {
    const out = new Map();
    if (!value) return out;
    const entries = value instanceof Map ? [...value.entries()] : Object.entries(value);
    for (const [key, idx] of entries) if (num(idx) !== null) out.set(String(key), num(idx));
    return out;
  }

  // ------------------------------------------------------------ event choices

  // Exclusive events of the given cards: (supportId, eventId) whose route
  // rows carry ≥ 2 choiceIndex values with different skill sets. Different
  // results of one choice (random outcomes) are not a decision: their skills
  // are merged and the level is the max (upper bound).
  // Returns [{ key, supportId, eventId, eventTitle, eventKind,
  //   choices: [{ choiceIndex, choiceText, skillIds, levelBySkill }] }].
  function buildEventChoiceGroups(routes, supportIds) {
    const wanted = supportIds ? new Set(list(supportIds).map(num)) : null;
    const byKey = new Map();
    for (const route of list(routes)) {
      if (!route) continue;
      const supportId = num(route.supportId);
      const skillId = num(route.skillId);
      const choiceIndex = num(route.choiceIndex);
      if (supportId === null || skillId === null || choiceIndex === null) continue;
      if (wanted && !wanted.has(supportId)) continue;
      const key = `${supportId}:${route.eventId}`;
      if (!byKey.has(key)) byKey.set(key, { key, supportId, eventId: String(route.eventId), eventTitle: route.eventTitle || '', eventKind: route.eventKind || null, choiceMap: new Map() });
      const group = byKey.get(key);
      if (!group.choiceMap.has(choiceIndex)) group.choiceMap.set(choiceIndex, { choiceIndex, choiceText: route.choiceText || '', skillIds: [], levelBySkill: new Map() });
      const choice = group.choiceMap.get(choiceIndex);
      if (!choice.skillIds.includes(skillId)) choice.skillIds.push(skillId);
      const levels = list(route.hintLevels).map(num).filter(v => v !== null);
      const level = route.grantType === 'grant' ? 5 : (levels.length ? Math.max(...levels) : 0);
      choice.levelBySkill.set(skillId, Math.max(choice.levelBySkill.get(skillId) || 0, level));
    }
    const out = [];
    for (const group of byKey.values()) {
      const choices = [...group.choiceMap.values()].sort((a, b) => a.choiceIndex - b.choiceIndex);
      choices.forEach(choice => choice.skillIds.sort((a, b) => a - b));
      if (choices.length < 2) continue;
      if (new Set(choices.map(choice => choice.skillIds.join(','))).size < 2) continue;
      out.push({ key: group.key, supportId: group.supportId, eventId: group.eventId, eventTitle: group.eventTitle, eventKind: group.eventKind, choices });
    }
    out.sort((a, b) => a.supportId - b.supportId || String(a.eventId).localeCompare(String(b.eventId)));
    return out;
  }

  // Skill ids each card's events no longer give under `chosenByKey`
  // (skills only on unchosen choices of its exclusive events, minus anything
  // the card's other routes or the chosen choices give). -> {supportId: [ids]}
  function eventExclusionsFor(routes, groups, chosenByKey) {
    const chosen = toChoiceMap(chosenByKey);
    const exclusiveKeys = new Set(list(groups).map(g => g.key));
    const keep = new Map();
    const add = (supportId, skillId) => { if (!keep.has(supportId)) keep.set(supportId, new Set()); keep.get(supportId).add(skillId); };
    const cards = new Set(list(groups).map(g => g.supportId));
    for (const route of list(routes)) {
      if (!route) continue;
      const supportId = num(route.supportId);
      if (!cards.has(supportId)) continue;
      const key = `${supportId}:${route.eventId}`;
      if (exclusiveKeys.has(key)) continue;
      if (num(route.skillId) !== null) add(supportId, num(route.skillId));
    }
    const lost = new Map();
    for (const group of list(groups)) {
      const pick = chosen.has(group.key) ? chosen.get(group.key) : group.choices[0].choiceIndex;
      for (const choice of group.choices) {
        if (choice.choiceIndex === pick) choice.skillIds.forEach(id => add(group.supportId, id));
      }
    }
    for (const group of list(groups)) {
      const pick = chosen.has(group.key) ? chosen.get(group.key) : group.choices[0].choiceIndex;
      for (const choice of group.choices) {
        if (choice.choiceIndex === pick) continue;
        for (const id of choice.skillIds) {
          if (keep.get(group.supportId) && keep.get(group.supportId).has(id)) continue;
          if (!lost.has(group.supportId)) lost.set(group.supportId, new Set());
          lost.get(group.supportId).add(id);
        }
      }
    }
    const out = {};
    for (const [supportId, ids] of lost) out[supportId] = [...ids].sort((a, b) => a - b);
    return out;
  }

  // ------------------------------------------------------------ knapsack

  // Exact multiple-choice knapsack. groups: [{options: [{cost, value}]}]
  // (at most one option per group; "none" is implicit). Costs are integers
  // ≥ 0, values ≥ 0 (any unit). Solves every budget 0..maxBudget at once and
  // returns choiceAt(b) -> array of option index (or -1) per group.
  // Objective: max Σ value; ties -> min Σ cost; remaining ties -> earlier
  // group / option index (deterministic).
  function buildSolver(groups, maxBudget) {
    const G = groups.length;
    const W = Math.max(0, Math.floor(Number(maxBudget) || 0));
    const choice = new Int16Array(G * (W + 1)).fill(-1);
    let dp = new Float64Array(W + 1);
    for (let g = 0; g < G; g += 1) {
      const next = Float64Array.from(dp);
      const options = list(groups[g] && groups[g].options);
      for (let k = 0; k < options.length; k += 1) {
        const cost = Math.max(0, Math.round(Number(options[k].cost) || 0));
        const score = Math.round((Number(options[k].value) || 0) * 100) * SCORE_SCALE - cost;
        if (score <= 0 || cost > W) continue;
        for (let b = W; b >= cost; b -= 1) {
          const cand = dp[b - cost] + score;
          if (cand > next[b]) { next[b] = cand; choice[g * (W + 1) + b] = k; }
        }
      }
      dp = next;
    }
    function choiceAt(budget) {
      let b = Math.max(0, Math.min(W, Math.floor(Number(budget) || 0)));
      const out = new Array(G).fill(-1);
      for (let g = G - 1; g >= 0; g -= 1) {
        const k = choice[g * (W + 1) + b];
        if (k >= 0) {
          out[g] = k;
          b -= Math.max(0, Math.round(Number(groups[g].options[k].cost) || 0));
        }
      }
      return out;
    }
    return { choiceAt, maxBudget: W };
  }

  function solveMultipleChoice(groups, budget) {
    const solver = buildSolver(groups, budget);
    const picks = solver.choiceAt(budget);
    let cost = 0;
    let value = 0;
    picks.forEach((k, g) => { if (k >= 0) { cost += groups[g].options[k].cost; value += groups[g].options[k].value; } });
    return { picks, cost, value: round2(value) };
  }

  // ------------------------------------------------------------ main

  function normalizeSettings(settings) {
    const s = { ...DEFAULTS, ...(settings || {}) };
    s.expectedPt = Math.max(0, Math.round(Number(s.expectedPt) || 0));
    ['whiteHintLv', 'goldHintLv', 'awakeningHintLv', 'inheritedHintLv', 'inheritedWhiteHintLv'].forEach(key => { s[key] = clampLv(s[key]); });
    s.sharp = s.sharp !== false;
    s.factorHintChance = Math.max(0, Math.min(1, Number(s.factorHintChance)));
    if (!Number.isFinite(s.factorHintChance)) s.factorHintChance = DEFAULTS.factorHintChance;
    s.minValueRate = Math.max(0, Number(s.minValueRate) || 0);
    s.inheritN = Math.max(0, Math.round(Number(s.inheritN) || 0));
    return s;
  }

  function archetypeOf(cup, archetypeId) {
    return list(cup && cup.archetypes).find(a => a && a.id === archetypeId) || list(cup && cup.archetypes)[0] || null;
  }

  // Per-event rule value of one choice: Σ over its skills of the chain value
  // (share of the skill and of its not-owned lower tiers, evolution credit
  // and activation included) — chainValueById of a solve with every choice
  // open.
  function choiceRuleValues(groups, chainValueById) {
    const out = new Map();
    for (const group of groups) {
      out.set(group.key, group.choices.map(choice => round2(choice.skillIds.reduce((sum, id) => sum + (chainValueById.get(id) || 0), 0))));
    }
    return out;
  }

  function ruleChoice(values, group) {
    let best = 0;
    values.forEach((v, i) => { if (v > values[best] + 1e-9) best = i; });
    return group.choices[best].choiceIndex;
  }

  // Public entry: resolves exclusive event choices (see header), then solves.
  function planSkillPicks(options) {
    const opts = options || {};
    const routes = list(opts.eventRoutes);
    const deckCardIds = list(opts.deckCardIds).map(num).filter(v => v !== null);
    const groups = routes.length ? buildEventChoiceGroups(routes, deckCardIds) : [];
    if (!groups.length) {
      const res = planSkillPicksFixed(opts, new Map(), []);
      res.eventChoices = [];
      res.eventExclusions = {};
      return res;
    }
    const overrides = toChoiceMap(opts.eventChoice);
    const values = choiceRuleValues(groups, planSkillPicksFixed(opts, new Map(), []).chainValueById);
    const chosen = new Map();
    const mode = new Map();
    const contested = [];
    for (const group of groups) {
      const vals = values.get(group.key);
      const override = overrides.get(group.key);
      if (override !== undefined && group.choices.some(c => c.choiceIndex === override)) {
        chosen.set(group.key, override); mode.set(group.key, 'manual'); continue;
      }
      chosen.set(group.key, ruleChoice(vals, group));
      if (vals.filter(v => v > 0).length >= 2) contested.push(group);
      else mode.set(group.key, 'dominant');
    }
    const combos = contested.reduce((n, g) => n * g.choices.length, 1);
    let result = null;
    if (contested.length && combos <= MAX_CHOICE_COMBOS) {
      let best = null;
      const rule = new Map(contested.map(g => [g.key, chosen.get(g.key)]));
      const walk = (i, current) => {
        if (i === contested.length) {
          const map = new Map([...chosen, ...current]);
          const res = planSkillPicksFixed(opts, map, groups);
          const diff = contested.filter(g => current.get(g.key) !== rule.get(g.key)).length;
          const cand = { res, map, value: res.stage1.totalValue, spent: res.stage1.spent, diff };
          if (!best || cand.value > best.value + 1e-9
            || (Math.abs(cand.value - best.value) <= 1e-9 && (cand.spent < best.spent || (cand.spent === best.spent && cand.diff < best.diff)))) best = cand;
          return;
        }
        for (const choice of contested[i].choices) {
          current.set(contested[i].key, choice.choiceIndex);
          walk(i + 1, current);
        }
        current.delete(contested[i].key);
      };
      walk(0, new Map());
      best.map.forEach((v, k) => chosen.set(k, v));
      contested.forEach(g => mode.set(g.key, 'auto-best'));
      result = best.res;
    } else {
      contested.forEach(g => mode.set(g.key, 'auto-rule'));
      result = planSkillPicksFixed(opts, chosen, groups);
    }
    const index = Gap.indexCatalog(opts.catalog);
    const nameOf = id => Gap.skillDisplayName(index.skillById.get(id)) || `#${id}`;
    result.eventChoices = groups.map(group => ({
      key: group.key,
      supportId: group.supportId,
      eventId: group.eventId,
      eventTitle: group.eventTitle,
      eventKind: group.eventKind,
      chosenIndex: chosen.get(group.key),
      mode: mode.get(group.key),
      choices: group.choices.map((choice, i) => ({
        choiceIndex: choice.choiceIndex,
        choiceText: choice.choiceText,
        skillIds: choice.skillIds.slice(),
        names: choice.skillIds.map(nameOf),
        ruleValue: values.get(group.key)[i]
      }))
    }));
    result.eventExclusions = eventExclusionsFor(routes, groups, chosen);
    return result;
  }

  function planSkillPicksFixed(options, chosenByKey, choiceGroups) {
    const opts = options || {};
    const catalog = opts.catalog;
    const cup = opts.cup;
    const s = normalizeSettings(opts.settings);
    const index = Gap.indexCatalog(catalog);
    const archetype = archetypeOf(cup, opts.archetypeId);
    const forceInclude = new Set(list(opts.forceInclude).map(num).filter(v => v !== null));
    const forceExclude = new Set(list(opts.forceExclude).map(num).filter(v => v !== null));
    const lvOverride = new Map(Object.entries(opts.hintLvBySkillId || {}).map(([k, v]) => [Number(k), clampLv(v)]));
    const inheritPinned = opts.inheritPinned || {};
    const routes = list(opts.eventRoutes);
    const eventHints = routes.length || !(opts.eventHintIndex instanceof Map) ? buildEventHintIndex(routes, chosenByKey) : opts.eventHintIndex;
    const eventExclusions = list(choiceGroups).length ? eventExclusionsFor(routes, choiceGroups, chosenByKey) : null;
    const deckCardIds = list(opts.deckCardIds).map(num).filter(v => v !== null);
    const B = s.expectedPt;
    const notes = [];

    const gap = Gap.analyzeBattleGap({
      cup, archetypeId: archetype ? archetype.id : null, catalog,
      traineeCardId: opts.traineeCardId == null ? null : opts.traineeCardId,
      deckCardIds,
      scenarioSkillIds: opts.scenarioSkillIds || [],
      eventExclusions,
      activation: opts.activation !== false,
      minRate: 0
    });

    // ---- rates (non-inherited meta rows that can fire)
    const rateById = new Map();
    for (const row of [...gap.covered, ...gap.gap]) {
      if (row.skillId === null) continue;
      rateById.set(row.skillId, Math.max(rateById.get(row.skillId) || 0, Number(row.rate) || 0));
    }
    // ---- rows that can never fire (value 0 unless forced 一定買)
    const impossibleInfo = new Map();
    for (const row of gap.impossible) {
      if (row.skillId === null || row.inheritedUnique) continue;
      impossibleInfo.set(row.skillId, { rate: Number(row.rate) || 0, activation: row.activation });
      if (forceInclude.has(row.skillId)) rateById.set(row.skillId, Math.max(rateById.get(row.skillId) || 0, Number(row.rate) || 0));
    }

    // ---- evolutions: an evolved skill in the meta list is only reachable by
    // owning its base skill (trainee's own evolvedSkills, or a scenario
    // evolution of the scenario being played), so its adoption rate is
    // credited to the base skill: evoBonus(base) = Σ rate(evolved).
    // (The evolution's extra in-run conditions are assumed met.)
    const evoBonus = new Map();
    const evoInfo = new Map();
    const traineeForEvo = opts.traineeCardId == null ? null : index.cardById.get(num(opts.traineeCardId)) || null;
    const scenarioNumericId = num(opts.scenarioNumericId);
    const creditEvolution = (baseId, evolvedId, via) => {
      const rate = rateById.get(evolvedId);
      if (baseId === null || !rate) return;
      evoBonus.set(baseId, round2((evoBonus.get(baseId) || 0) + rate));
      if (!evoInfo.has(baseId)) evoInfo.set(baseId, []);
      evoInfo.get(baseId).push({ skillId: evolvedId, name: nameOfAny(evolvedId), rate, via });
    };
    function nameOfAny(id) { return Gap.skillDisplayName(index.skillById.get(id)) || `#${id}`; }
    if (traineeForEvo) {
      for (const evo of list(traineeForEvo.evolvedSkills)) creditEvolution(num(evo && evo.old), num(evo && evo.new), 'character');
    }
    if (scenarioNumericId !== null) {
      for (const [evolvedId, info] of index.scenarioEvolutionById) {
        if (num(info.scenarioId) === scenarioNumericId) creditEvolution(num(info.fromSkillId), evolvedId, 'scenario');
      }
    }
    const valueRate = id => (rateById.get(id) || 0) + (evoBonus.get(id) || 0);

    // ---- families touched by valued white/gold rows
    const familyByKey = new Map();
    for (const skillId of [...rateById.keys(), ...evoBonus.keys(), ...impossibleInfo.keys()]) {
      const skill = index.skillById.get(skillId);
      const tier = Gap.skillTier(skill);
      if (!skill || tier === null || tier <= 0) continue;
      const fam = Gap.familyOf(skillId, catalog);
      if (familyByKey.has(fam.familyId)) continue;
      const members = fam.members.filter(m => m.tier !== null && m.tier > 0);
      familyByKey.set(fam.familyId, { familyId: fam.familyId, members, chain: fam.chain.slice() });
    }

    // prerequisites within family (lower tiers), memo
    const prereqMemo = new Map();
    const prereqs = id => {
      if (!prereqMemo.has(id)) prereqMemo.set(id, Gap.familyOf(id, catalog).prerequisites.slice());
      return prereqMemo.get(id);
    };
    const implies = (y, x) => y === x || prereqs(y).includes(x);

    // sources for every member
    const memberIds = [];
    for (const fam of familyByKey.values()) fam.members.forEach(m => memberIds.push(m.id));
    const sources = Gap.resolveSkillSources({
      skillIds: memberIds, catalog,
      traineeCardId: opts.traineeCardId == null ? null : opts.traineeCardId,
      deckCardIds,
      scenarioSkillIds: opts.scenarioSkillIds || [],
      eventExclusions
    });
    const traineeCard = opts.traineeCardId == null ? null : index.cardById.get(num(opts.traineeCardId)) || null;
    const freeTrainee = new Set();
    if (traineeCard) {
      list(traineeCard.innateSkillIds).forEach(id => freeTrainee.add(num(id)));
      list(traineeCard.uniqueSkillIds).forEach(id => freeTrainee.add(num(id)));
      list(traineeCard.evolvedSkills).forEach(evo => freeTrainee.add(num(evo && evo.new)));
    }
    const owned = new Set();
    for (const id of memberIds) {
      if (freeTrainee.has(id)) { owned.add(id); prereqs(id).forEach(p => owned.add(p)); }
    }

    const tierOf = id => Gap.skillTier(index.skillById.get(id));
    const baseCostOf = id => num(index.skillById.get(id) && index.skillById.get(id).cost) || 0;
    const nameOf = id => Gap.skillDisplayName(index.skillById.get(id)) || `#${id}`;

    // ---- hint level of a member from its stage-1 sources
    const levelInfo = new Map();
    for (const id of memberIds) {
      const src = sources[id];
      const isGold = tierOf(id) === 3;
      const parts = [];
      let level = 0;
      let available = false;
      if (src) {
        let eventSum = 0;
        let hasEvent = false;
        let hasHint = false;
        for (const entry of list(src.deck)) {
          available = true;
          if (entry.via === 'event') {
            hasEvent = true;
            const hit = eventHints.get(entry.supportId) && eventHints.get(entry.supportId).get(entry.matchedSkillId);
            const lv = hit != null ? hit : s.goldHintLv;
            eventSum += lv;
            parts.push({ kind: 'deck-event', supportId: entry.supportId, matchedSkillId: entry.matchedSkillId, exact: entry.exact, level: lv, routeKnown: hit != null });
          } else {
            hasHint = true;
            // upper bound: the whole hint list (white and gold) at whiteHintLv
            parts.push({ kind: 'deck-hint', supportId: entry.supportId, matchedSkillId: entry.matchedSkillId, exact: entry.exact, level: s.whiteHintLv });
          }
        }
        if (hasEvent) level = Math.max(level, Math.min(5, eventSum));
        if (hasHint) level = Math.max(level, s.whiteHintLv);
        if (src.trainee) {
          available = true;
          const via = src.trainee;
          let lv = 0;
          if (via === 'awakening') lv = s.awakeningHintLv;
          else if (via === 'event') lv = isGold ? s.goldHintLv : s.whiteHintLv;
          parts.push({ kind: 'trainee', via, matchedSkillId: src.traineeMatchedSkillId, exact: src.traineeExact, level: lv });
          level = Math.max(level, lv);
        }
        if (src.scenario) {
          available = true;
          const lv = isGold ? s.goldHintLv : s.whiteHintLv;
          parts.push({ kind: 'scenario', level: lv });
          level = Math.max(level, lv);
        }
      }
      const overridden = lvOverride.has(id);
      levelInfo.set(id, { available, level: overridden ? lvOverride.get(id) : level, sourceLevel: level, overridden, parts });
    }
    const availableMember = id => levelInfo.has(id) && levelInfo.get(id).available;

    // excluded = forceExclude members and everything implying them
    const excluded = id => [...forceExclude].some(x => implies(id, x));

    // component cost list for buying `target` given `have` owned set
    // levelFor(component, target) picks the hint level.
    function chainComponents(target, have, levelFor) {
      const ids = prereqs(target).filter(p => !have.has(p)).concat(have.has(target) ? [] : [target]);
      return ids.map(id => {
        const lv = levelFor(id, target);
        const base = baseCostOf(id);
        return { skillId: id, name: nameOf(id), baseCost: base, hintLv: lv, cost: skillCostAt(base, lv, s.sharp) };
      });
    }
    // stage-1 level: own sources if any, else the target's (a prerequisite
    // without its own hint source is assumed to come at the target's level).
    const stage1Level = (id, target) => {
      if (lvOverride.has(id)) return lvOverride.get(id);
      if (availableMember(id)) return levelInfo.get(id).level;
      return levelInfo.has(target) ? levelInfo.get(target).level : 0;
    };

    // ---- groups
    const groups = [];
    const rowsById = new Map();
    const chainValueById = new Map();
    for (const fam of familyByKey.values()) {
      const members = fam.chain.filter(id => fam.members.some(m => m.id === id));
      const share = new Map();
      for (const x of members) {
        let total = 0;
        for (const y of members) if (implies(y, x)) total += valueRate(y);
        share.set(x, round2(Math.min(100, total)));
      }
      for (const x of members) {
        const tiers = [x, ...prereqs(x)].filter(z => !owned.has(z));
        chainValueById.set(x, round2(tiers.reduce((sum, z) => sum + (share.get(z) || 0), 0)));
      }
      const chainAvail = new Map(members.map(x => [x, availableMember(x) || members.some(y => y !== x && availableMember(y) && implies(y, x) && !excluded(y))]));
      // forced baseline
      const forced = members.filter(x => forceInclude.has(x) && chainAvail.get(x) && !owned.has(x));
      const baseSet = new Set();
      forced.forEach(f => { baseSet.add(f); prereqs(f).forEach(p => baseSet.add(p)); });
      owned.forEach(o => baseSet.delete(o));
      const baseComponents = [];
      if (forced.length) {
        const have = new Set(owned);
        const top = forced.slice().sort((a, b) => tierOf(b) - tierOf(a))[0];
        for (const f of [top, ...forced.filter(f => f !== top)]) {
          for (const comp of chainComponents(f, have, stage1Level)) { baseComponents.push(comp); have.add(comp.skillId); }
        }
      }
      const group = { kind: 'family', key: `f${fam.familyId}`, familyId: fam.familyId, members, share, baseComponents, baseSet, options: [] };
      for (const m of members) {
        if (!availableMember(m) || excluded(m) || owned.has(m)) continue;
        if (prereqs(m).some(p => excluded(p))) continue;
        if (!forceInclude.has(m) && (share.get(m) || 0) < s.minValueRate) continue;
        const cover = new Set([m, ...prereqs(m)]);
        if ([...baseSet].some(x => !cover.has(x))) continue; // must extend the forced baseline
        const have = new Set([...owned, ...baseSet]);
        const components = chainComponents(m, have, stage1Level);
        if (!components.length) continue;
        const value = round2(components.reduce((sum, c) => sum + (share.get(c.skillId) || 0), 0));
        group.options.push({ endId: m, components, cost: components.reduce((sum, c) => sum + c.cost, 0), value });
      }
      groups.push(group);
      for (const x of members) {
        const isImpossible = impossibleInfo.has(x) && !forceInclude.has(x) && (share.get(x) || 0) <= 0;
        if ((share.get(x) || 0) <= 0 && !isImpossible) continue;
        rowsById.set(x, {
          skillId: x,
          name: nameOf(x),
          group,
          tier: tierOf(x),
          impossible: isImpossible,
          activation: impossibleInfo.has(x) ? impossibleInfo.get(x).activation : null,
          rate: rateById.get(x) || (impossibleInfo.has(x) ? impossibleInfo.get(x).rate : 0),
          evolutions: evoInfo.get(x) || [],
          value: share.get(x),
          owned: owned.has(x),
          stage1: chainAvail.get(x) === true,
          available: availableMember(x),
          excluded: excluded(x),
          forced: baseSet.has(x),
          forceIncluded: forceInclude.has(x),
          levelInfo: levelInfo.get(x) || null
        });
      }
    }

    // inherited uniques
    // (inherited uniques that can never fire come last, value 0, never
    // included by default; 一定買 restores them)
    const byRateDesc = (a, b) => (b.rate || 0) - (a.rate || 0) || (a.skillId || 0) - (b.skillId || 0);
    const inheritedSorted = [
      ...gap.inheritedUniques.slice().sort(byRateDesc),
      ...gap.impossible.filter(row => row.inheritedUnique && row.skillId !== null).sort(byRateDesc).map(row => ({ ...row, impossible: true }))
    ];
    const owners = Gap.findInheritedUniqueOwners({ rows: inheritedSorted, catalog, inventory: opts.inventory || {} });
    const inheritedRows = inheritedSorted.map((row, i) => {
      const id = row.skillId;
      const pinned = inheritPinned[id];
      const dead = row.impossible === true && !forceInclude.has(id);
      const included = forceInclude.has(id) || (!dead && (pinned === true || pinned === false ? pinned : i < s.inheritN));
      const geneSkill = index.skillById.get(id);
      const base = num(geneSkill && geneSkill.cost) || num(row.cost) || 200;
      const lv = lvOverride.has(id) ? lvOverride.get(id) : s.inheritedHintLv;
      return {
        skillId: id,
        name: row.name || nameOf(id),
        rate: Number(row.rate) || 0,
        value: dead ? 0 : Number(row.rate) || 0,
        impossible: dead,
        activation: row.activation || null,
        inheritedUnique: true,
        included,
        pinned: pinned === true || pinned === false ? pinned : null,
        defaultIncluded: !dead && i < s.inheritN,
        owners: owners[i] ? owners[i].owners : [],
        ownerOwned: owners[i] ? owners[i].ownerOwned : false,
        components: [{ skillId: id, name: row.name || nameOf(id), baseCost: base, hintLv: lv, cost: skillCostAt(base, lv, s.sharp) }],
        excluded: forceExclude.has(id),
        forceIncluded: forceInclude.has(id)
      };
    });
    for (const row of inheritedRows) {
      const group = { kind: 'inherited', key: `i${row.skillId}`, members: [row.skillId], share: new Map([[row.skillId, row.value]]), baseComponents: [], baseSet: new Set(), options: [] };
      row.group = group;
      row.stage1 = row.included && !row.excluded;
      if (row.stage1) {
        const opt = { endId: row.skillId, components: row.components, cost: row.components[0].cost, value: row.value };
        if (row.forceIncluded) { group.baseComponents = row.components; group.baseSet = new Set([row.skillId]); row.forced = true; }
        else if (row.value >= s.minValueRate) group.options.push(opt);
      }
      groups.push(group);
      rowsById.set(row.skillId, row);
    }

    // ---- solve
    const baselineCost = groups.reduce((sum, g) => sum + g.baseComponents.reduce((t, c) => t + c.cost, 0), 0);
    const ownedValue = round2([...rowsById.values()].filter(r => r.owned).reduce((sum, r) => sum + r.value, 0));
    const baselineValue = round2(groups.reduce((sum, g) => sum + g.baseComponents.reduce((t, c) => t + (g.share.get(c.skillId) || 0), 0), 0));
    const dpBudget = Math.max(0, B - baselineCost);
    const extra = Math.min(s.maxExtraBudget, groups.reduce((sum, g) => sum + Math.max(0, ...g.options.map(o => o.cost)), 0));
    const solver = buildSolver(groups, dpBudget + extra + s.entryStep);
    const coveredMemo = new Map();
    const coveredAt = budget => {
      if (!coveredMemo.has(budget)) coveredMemo.set(budget, coveredAtRaw(budget));
      return coveredMemo.get(budget);
    };
    const coveredAtRaw = budget => {
      const picks = solver.choiceAt(Math.max(0, budget - baselineCost));
      const set = new Set();
      let cost = 0;
      picks.forEach((k, g) => {
        if (k < 0) return;
        const opt = groups[g].options[k];
        cost += opt.cost;
        opt.components.forEach(c => set.add(c.skillId));
      });
      return { picks, set, cost };
    };
    const atB = coveredAt(B);
    const atLow = coveredAt(B - s.verdictDrop);

    // ---- rows + verdicts
    const chosenComponent = new Map();
    atB.picks.forEach((k, g) => {
      if (k < 0) return;
      groups[g].options[k].components.forEach(c => chosenComponent.set(c.skillId, c));
    });
    groups.forEach(g => g.baseComponents.forEach(c => chosenComponent.set(c.skillId, c)));

    const rows = [];
    for (const row of rowsById.values()) {
      if (!row.stage1 && !row.owned && !row.inheritedUnique && !row.impossible) continue;
      const out = {
        skillId: row.skillId,
        name: row.name,
        familyKey: row.group.key,
        tier: row.tier == null ? null : row.tier,
        inheritedUnique: row.inheritedUnique === true,
        impossible: row.impossible === true,
        activation: row.activation || null,
        hasSource: row.inheritedUnique === true || row.stage1 === true || row.owned === true,
        rate: row.rate,
        evolutions: row.evolutions || [],
        value: row.value,
        owned: row.owned === true,
        forced: row.forced === true,
        excluded: row.excluded === true,
        levelInfo: row.levelInfo || null,
        owners: row.owners || null,
        included: row.included,
        pinned: row.pinned
      };
      let comp = chosenComponent.get(row.skillId);
      if (!comp) {
        // the option ending at this skill (what it would cost if bought next)
        const own = row.group.options.find(o => o.endId === row.skillId);
        comp = own ? own.components.find(c => c.skillId === row.skillId) : null;
        if (!comp && !row.owned) {
          const base = row.inheritedUnique ? row.components[0].baseCost : baseCostOf(row.skillId);
          const lv = row.inheritedUnique ? row.components[0].hintLv : stage1Level(row.skillId, row.skillId);
          comp = { skillId: row.skillId, baseCost: base, hintLv: lv, cost: skillCostAt(base, lv, s.sharp) };
        }
      }
      out.baseCost = row.owned ? 0 : comp.baseCost;
      out.hintLv = row.owned ? null : comp.hintLv;
      out.cost = row.owned ? 0 : comp.cost;
      out.valuePer100 = out.cost > 0 ? round2(out.value / out.cost * 100) : null;
      const ownOption = row.group.options.find(o => o.endId === row.skillId);
      out.optionCost = ownOption ? ownOption.cost : null; // cost of buying up to this tier from the current baseline
      if (row.owned) { out.verdict = 'owned'; out.chosen = true; }
      else if (row.excluded) { out.verdict = 'excluded'; out.chosen = false; }
      else if (row.forced) { out.verdict = 'forced'; out.chosen = true; }
      else if (row.impossible) { out.verdict = 'impossible'; out.chosen = false; }
      else if (row.inheritedUnique && !row.included) { out.verdict = 'inherit-off'; out.chosen = false; }
      else if (row.value < s.minValueRate) { out.verdict = 'invalid'; out.chosen = false; }
      else if (atB.set.has(row.skillId)) { out.chosen = true; out.verdict = atLow.set.has(row.skillId) ? 'must' : 'worth'; }
      else {
        out.chosen = false;
        out.verdict = 'drop';
        out.entryBudget = null;
        for (let b = B + s.entryStep; b <= B + extra + s.entryStep; b += s.entryStep) {
          if (coveredAt(b).set.has(row.skillId)) { out.entryBudget = b; break; }
        }
        out.extraPt = out.entryBudget == null ? null : out.entryBudget - B;
      }
      rows.push(out);
    }
    const verdictOrder = { owned: 0, forced: 1, must: 2, worth: 3, drop: 4, 'inherit-off': 5, excluded: 6, invalid: 7, impossible: 8 };
    rows.sort((a, b) => verdictOrder[a.verdict] - verdictOrder[b.verdict]
      || (b.valuePer100 == null ? -1 : b.valuePer100) - (a.valuePer100 == null ? -1 : a.valuePer100)
      || b.value - a.value || a.skillId - b.skillId);

    const spent = baselineCost + atB.cost;
    const bought = rows.filter(r => r.chosen && !r.owned);
    const totalValue = round2(ownedValue + baselineValue + bought.filter(r => !r.forced).reduce((sum, r) => sum + r.value, 0));
    const stage1 = {
      budget: B,
      baselineCost,
      spent,
      leftover: B - spent,
      overBudget: baselineCost > B,
      boughtCount: bought.length,
      totalValue,
      ownedValue,
      rows,
      buy: rows.filter(r => r.chosen),
      must: rows.filter(r => r.verdict === 'must'),
      worth: rows.filter(r => r.verdict === 'worth'),
      forced: rows.filter(r => r.verdict === 'forced'),
      owned: rows.filter(r => r.verdict === 'owned'),
      drop: rows.filter(r => r.verdict === 'drop').sort((a, b) => (a.extraPt == null ? 1e9 : a.extraPt) - (b.extraPt == null ? 1e9 : b.extraPt) || b.value - a.value),
      invalid: rows.filter(r => r.verdict === 'invalid').sort((a, b) => b.value - a.value || a.skillId - b.skillId),
      excluded: rows.filter(r => r.verdict === 'excluded'),
      inheritOff: rows.filter(r => r.verdict === 'inherit-off'),
      impossible: rows.filter(r => r.verdict === 'impossible').sort((a, b) => b.rate - a.rate || a.skillId - b.skillId),
      inherited: inheritedRows.filter(r => !r.impossible).map(r => ({ skillId: r.skillId, name: r.name, rate: r.rate, included: r.included, pinned: r.pinned, defaultIncluded: r.defaultIncluded, owners: r.owners, ownerOwned: r.ownerOwned, cost: r.components[0].cost, baseCost: r.components[0].baseCost }))
    };

    // ---- stage 2
    const have = new Set([...owned, ...chosenComponent.keys()]);
    const unobtainable = new Set(list(opts.unobtainableSkillIds).map(num));
    const isUnobtainable = typeof opts.isUnobtainable === 'function' ? opts.isUnobtainable : id => unobtainable.has(id);
    const poolCandidates = [];
    const unobtainableRows = [];
    for (const row of rowsById.values()) {
      if (row.inheritedUnique || row.stage1 || row.owned || row.excluded || row.impossible) continue;
      if (row.value < s.minValueRate) continue;
      if (opts.excludeUnobtainable !== false && isUnobtainable(row.skillId)) {
        unobtainableRows.push({ skillId: row.skillId, name: row.name, value: row.value, rate: row.rate });
        continue;
      }
      poolCandidates.push(row);
    }
    const stage2Level = (id, target) => {
      if (lvOverride.has(id)) return lvOverride.get(id);
      if (id !== target && availableMember(id)) return levelInfo.get(id).level;
      return s.inheritedWhiteHintLv;
    };
    const standalone = new Map(poolCandidates.map(row => [row.skillId, chainComponents(row.skillId, have, stage2Level).reduce((sum, c) => sum + c.cost, 0)]));
    poolCandidates.sort((a, b) => b.value - a.value || standalone.get(a.skillId) - standalone.get(b.skillId) || a.skillId - b.skillId);
    const p = s.factorHintChance;
    const L = stage1.leftover;
    const pool = [];
    const seqHave = new Set(have);
    let cumulative = 0;
    for (const row of poolCandidates) {
      const components = chainComponents(row.skillId, seqHave, stage2Level);
      components.forEach(c => seqHave.add(c.skillId));
      const cost = components.reduce((sum, c) => sum + c.cost, 0);
      cumulative += cost;
      pool.push({
        skillId: row.skillId,
        name: row.name,
        tier: row.tier,
        rate: row.rate,
        evolutions: row.evolutions || [],
        value: row.value,
        components,
        cost,
        valuePer100: cost > 0 ? round2(row.value / cost * 100) : null,
        cumulative,
        expectedCumulative: round2(p * cumulative),
        mustCarry: row.value >= s.mustCarryRate,
        forceIncluded: row.forceIncluded === true
      });
    }
    let deterministicCount = 0;
    while (deterministicCount < pool.length && pool[deterministicCount].cumulative <= L) deterministicCount += 1;
    let expectedK = null;
    if (L <= 0) expectedK = 0;
    else {
      for (let i = 0; i < pool.length; i += 1) {
        if (p * pool[i].cumulative >= L) { expectedK = i + 1; break; }
      }
    }
    const kUsed = expectedK == null ? pool.length : expectedK;
    pool.forEach((item, i) => {
      item.inDeterministic = i < deterministicCount;
      item.inExpected = i < kUsed;
    });
    const rawCostK = kUsed ? pool[kUsed - 1].cumulative : 0;
    const stage2 = {
      factorHintChance: p,
      leftover: L,
      pool,
      deterministicCount,
      deterministicSpent: deterministicCount ? pool[deterministicCount - 1].cumulative : 0,
      allFitDeterministic: deterministicCount === pool.length,
      expectedK,
      expectedRawCost: rawCostK,
      expectedAbsorbed: round2(p * rawCostK),
      unspentExpected: expectedK == null ? round2(L - p * rawCostK) : 0,
      expectedValue: round2(p * pool.slice(0, kUsed).reduce((sum, item) => sum + item.value, 0)),
      mustCarry: pool.filter(item => item.mustCarry),
      fillers: pool.slice(0, kUsed).filter(item => !item.mustCarry),
      poolValueTotal: round2(pool.reduce((sum, item) => sum + item.value, 0)),
      unobtainable: unobtainableRows.sort((a, b) => b.value - a.value || a.skillId - b.skillId)
    };

    if (!traineeCard) notes.push('no-trainee');
    return { settings: s, gap, stage1, stage2, notes, chainValueById };
  }

  return {
    HINT_DISCOUNT_BY_LEVEL,
    SHARP_DISCOUNT,
    MAX_CHOICE_COMBOS,
    DEFAULTS,
    skillCostAt,
    buildEventHintIndex,
    buildEventChoiceGroups,
    eventExclusionsFor,
    buildSolver,
    solveMultipleChoice,
    normalizeSettings,
    planSkillPicks
  };
});
