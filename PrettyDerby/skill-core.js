(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.SKILL_CORE = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const TRUE = 'true';
  const FALSE = 'false';
  const UNKNOWN = 'unknown';
  const STATIC_COURSE_FIELDS = [
    'always', 'course_distance', 'distance_type', 'ground_type', 'ground_condition',
    'rotation', 'season', 'weather', 'time', 'track_id', 'grade', 'is_abroad',
    'is_dirtgrade', 'is_basis_distance', 'is_tight_track', 'corner_count'
  ];

  function parseClause(rawClause) {
    const raw = String(rawClause || '').trim();
    const match = raw.match(/^([A-Za-z_][A-Za-z0-9_]*)(==|!=|>=|<=|>|<)(-?\d+(?:\.\d+)?)$/);
    if (!match) return { raw, valid: false };
    return {
      raw,
      valid: true,
      field: match[1],
      operator: match[2],
      value: Number(match[3])
    };
  }

  function parseExpression(expression) {
    const raw = String(expression || '').trim();
    if (!raw) return { raw, any: [] };
    return {
      raw,
      any: raw.split('@').map(orBranch => ({
        all: orBranch.split('&').map(parseClause)
      }))
    };
  }

  function compare(actual, operator, expected) {
    if (operator === '==') return actual === expected;
    if (operator === '!=') return actual !== expected;
    if (operator === '>=') return actual >= expected;
    if (operator === '<=') return actual <= expected;
    if (operator === '>') return actual > expected;
    if (operator === '<') return actual < expected;
    return null;
  }

  function evaluateClause(clause, context) {
    if (!clause?.valid || !Object.hasOwn(context || {}, clause.field)) return UNKNOWN;
    const actual = Number(context[clause.field]);
    if (!Number.isFinite(actual)) return UNKNOWN;
    const result = compare(actual, clause.operator, clause.value);
    return result == null ? UNKNOWN : result ? TRUE : FALSE;
  }

  function triAnd(values) {
    if (values.includes(FALSE)) return FALSE;
    if (values.every(value => value === TRUE)) return TRUE;
    return UNKNOWN;
  }

  function triOr(values) {
    if (values.includes(TRUE)) return TRUE;
    if (values.length && values.every(value => value === FALSE)) return FALSE;
    return UNKNOWN;
  }

  function evaluateExpression(expressionOrAst, context) {
    const ast = typeof expressionOrAst === 'string'
      ? parseExpression(expressionOrAst)
      : expressionOrAst;
    if (!ast?.any?.length) return UNKNOWN;
    return triOr(ast.any.map(branch => triAnd(
      (branch.all || []).map(clause => evaluateClause(clause, context))
    )));
  }

  function expressionFields(expressionOrAst) {
    const ast = typeof expressionOrAst === 'string'
      ? parseExpression(expressionOrAst)
      : expressionOrAst;
    return [...new Set((ast?.any || []).flatMap(branch =>
      (branch.all || []).filter(clause => clause.valid).map(clause => clause.field)
    ))];
  }

  function inspectConditionGroup(group, context) {
    const precondition = group?.precondition
      ? evaluateExpression(group.precondition, context)
      : TRUE;
    const activation = evaluateExpression(group?.condition || 'always==1', context);
    return {
      precondition,
      activation,
      feasibility: triAnd([precondition, activation])
    };
  }

  function evaluateConditionGroup(group, context) {
    return inspectConditionGroup(group, context).feasibility;
  }

  function evaluateSkillForContext(skill, context) {
    const groups = skill?.conditionGroups || [];
    if (!groups.length) return UNKNOWN;
    return triOr(groups.map(group => evaluateConditionGroup(group, context)));
  }

  function findStaticCourseSkills(catalog, context, options) {
    const allowedFields = new Set(options?.allowedFields || STATIC_COURSE_FIELDS);
    const positiveOnly = options?.positiveOnly !== false;
    const requireSpecificCondition = options?.requireSpecificCondition !== false;
    return (catalog?.skills || []).filter(skill => {
      if (options?.availableOnly !== false && !skill.availableOnServer) return false;
      if (options?.rarities && !options.rarities.includes(Number(skill.rarity))) return false;
      return (skill.conditionGroups || []).some(group => {
        const expressions = [group.precondition, group.condition || 'always==1'].filter(Boolean);
        const fields = expressions.flatMap(expressionFields);
        if (!fields.length || fields.some(field => !allowedFields.has(field))) return false;
        if (requireSpecificCondition && fields.every(field => field === 'always')) return false;
        if (evaluateConditionGroup(group, context) !== TRUE) return false;
        const values = (group.effects || []).map(effect => Number(effect.value)).filter(Number.isFinite);
        return !positiveOnly || (values.some(value => value > 0) && values.every(value => value >= 0));
      });
    }).sort((a, b) => Number(a.familyId) - Number(b.familyId) || Number(a.id) - Number(b.id));
  }

  function runningStyleId(style) {
    if (Number.isFinite(Number(style)) && Number(style) >= 1 && Number(style) <= 4) return Number(style);
    const normalized = String(style || '').trim().toLowerCase();
    const aliases = {
      '領頭': 1, '逃げ': 1, '逃': 1, runner: 1, 'front runner': 1,
      '前列': 2, '先行': 2, leader: 2, 'pace chaser': 2,
      '居中': 3, '差し': 3, '差': 3, betweener: 3, 'late surger': 3,
      '後追': 4, '追込': 4, '追い込み': 4, chaser: 4, 'end closer': 4
    };
    return aliases[normalized] ?? null;
  }

  function buildRaceContext(race, style) {
    const context = { ...(race?.context || {}) };
    if (!Object.hasOwn(context, 'always')) context.always = 1;
    const styleId = runningStyleId(style);
    if (styleId) context.running_style = styleId;
    return context;
  }

  function indexCatalog(catalog) {
    return {
      skillsById: new Map((catalog?.skills || []).map(item => [Number(item.id), item])),
      supportsById: new Map((catalog?.supports || []).map(item => [Number(item.id), item])),
      characterCardsById: new Map((catalog?.characterCards || []).map(item => [Number(item.id), item])),
      racesById: new Map((catalog?.races || []).map(item => [Number(item.id), item]))
    };
  }

  function isSupportOwned(card, inventory, rules) {
    if (!card) return false;
    if (rules?.ownership?.assumedOwnedRarities?.includes(card.rarity)) return true;
    return (inventory?.supportCards || []).some(owned => Number(owned.id) === Number(card.id));
  }

  function resolveSkillSources(skillId, catalog, inventory, rules) {
    const indexes = indexCatalog(catalog);
    const skill = indexes.skillsById.get(Number(skillId));
    if (!skill) return null;
    const supportIds = new Set([
      ...(skill.sources?.supportHint || []),
      ...(skill.sources?.supportEvent || [])
    ].map(Number));
    const supports = [...supportIds].map(id => {
      const card = indexes.supportsById.get(id);
      if (!card) return null;
      const routes = [];
      if (skill.sources.supportHint.includes(id)) routes.push('hint');
      if (skill.sources.supportEvent.includes(id)) routes.push('event');
      return { ...card, routes, owned: isSupportOwned(card, inventory, rules) };
    }).filter(Boolean).sort((a, b) => Number(b.owned) - Number(a.owned) || b.rarity.localeCompare(a.rarity) || a.id - b.id);
    const characterIds = new Set([
      ...(skill.sources?.characterBuiltIn || []),
      ...(skill.sources?.characterEvent || [])
    ].map(Number));
    const characterCards = [...characterIds].map(id => {
      const card = indexes.characterCardsById.get(id);
      if (!card) return null;
      const routes = [];
      if (skill.sources.characterBuiltIn.includes(id)) routes.push('built-in');
      if (skill.sources.characterEvent.includes(id)) routes.push('event');
      return { ...card, routes };
    }).filter(Boolean);
    return { skill, supports, characterCards, scenarioEventIds: skill.sources?.scenarioEvent || [] };
  }

  function rankSupportSources(skillIds, catalog, inventory, rules, options) {
    const wanted = new Set((skillIds || []).map(Number));
    const ownedOnly = Boolean(options?.ownedOnly);
    return (catalog?.supports || []).map(card => {
      const hintSkillIds = (card.hintSkillIds || []).filter(id => wanted.has(Number(id)));
      const eventSkillIds = (card.eventSkillIds || []).filter(id => wanted.has(Number(id)));
      const coverage = [...new Set([...hintSkillIds, ...eventSkillIds])];
      const owned = isSupportOwned(card, inventory, rules);
      return { ...card, owned, coverage, hintSkillIds, eventSkillIds };
    }).filter(card => card.coverage.length && (!ownedOnly || card.owned))
      .sort((a, b) => b.coverage.length - a.coverage.length || Number(b.owned) - Number(a.owned) || a.id - b.id);
  }

  return {
    TRUE,
    FALSE,
    UNKNOWN,
    STATIC_COURSE_FIELDS,
    parseClause,
    parseExpression,
    expressionFields,
    evaluateClause,
    evaluateExpression,
    inspectConditionGroup,
    evaluateConditionGroup,
    evaluateSkillForContext,
    findStaticCourseSkills,
    runningStyleId,
    buildRaceContext,
    indexCatalog,
    isSupportOwned,
    resolveSkillSources,
    rankSupportSources
  };
});
