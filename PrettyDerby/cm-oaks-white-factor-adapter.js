(function (root, factory) {
  const core = typeof module !== 'undefined' && module.exports
    ? require('./white-factor-value-core.js')
    : root?.WHITE_FACTOR_VALUE_CORE;
  const api = factory(core);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CM_OAKS_WHITE_FACTOR_ADAPTER = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (defaultCore) {
  'use strict';

  const MODEL_VERSION = 'cm-oaks-white-factor-adapter-v1';
  const SNAPSHOT_KEY = '10606:runner';
  const TARGET = Object.freeze({
    courseId: 10606,
    groundType: 1,
    distance: 2400,
    distanceType: 3,
    runningStyle: 1,
    objective: 'cm_winner_line'
  });
  const REQUIRED_SKILL_IDS = Object.freeze([210052]);
  const TRACKED_SKILLS = Object.freeze([
    Object.freeze({ skillId: 210052, nameZhTw: '青春點火．智慧' }),
    Object.freeze({ skillId: 203402, nameZhTw: '乘順風而行' }),
    Object.freeze({ skillId: 203382, nameZhTw: '領先到底的姿勢' }),
    Object.freeze({ skillId: 203112, nameZhTw: '正面突破' }),
    Object.freeze({ skillId: 200022, nameZhTw: '逆時針○' })
  ]);
  const ROUTES = Object.freeze([
    Object.freeze({
      id: 'kitasan',
      label: '正月北黑用',
      nativeSkillIds: Object.freeze([]),
      description: '三個終盤白技都仍是子代候選；青春點火．智慧保留為使用者必追項。'
    }),
    Object.freeze({
      id: 'katsuragi',
      label: '正月葛城用',
      nativeSkillIds: Object.freeze([203402, 203382]),
      description: '乘順風而行與領先到底的姿勢由本體取得，不再當成本體硬缺口，但仍可留給子代。'
    })
  ]);

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function finiteInteger(value) {
    if (typeof value === 'number') return Number.isInteger(value) ? value : null;
    if (typeof value !== 'string' || !value.trim()) return null;
    const result = Number(value.trim());
    return Number.isInteger(result) ? result : null;
  }

  function text(value, fallback = '') {
    const result = value === null || value === undefined ? '' : String(value).trim();
    return result || fallback;
  }

  function snapshotEntry(input) {
    if (isObject(input?.snapshotEntry)) return input.snapshotEntry;
    return input?.courseEffectSnapshots?.entries?.[SNAPSHOT_KEY]
      || input?.course_effect_snapshots?.entries?.[SNAPSHOT_KEY]
      || null;
  }

  function validSnapshotEntry(entry) {
    return isObject(entry)
      && finiteInteger(entry.courseId) === TARGET.courseId
      && finiteInteger(entry.runningStyle) === TARGET.runningStyle
      && Array.isArray(entry.rows);
  }

  function skillCatalogRows(input) {
    if (Array.isArray(input?.skillCatalog)) return input.skillCatalog;
    if (Array.isArray(input?.skills)) return input.skills;
    if (Array.isArray(input?.gameCatalog?.skills)) return input.gameCatalog.skills;
    if (Array.isArray(input?.game_catalog?.skills)) return input.game_catalog.skills;
    return [];
  }

  function routeById(routeId) {
    const normalized = text(routeId).toLowerCase();
    return ROUTES.find(route => route.id === normalized) || ROUTES[0];
  }

  function buildCandidateSkills(input = {}) {
    const entry = snapshotEntry(input);
    const entryUsable = validSnapshotEntry(entry);
    const snapshotById = new Map((entryUsable ? entry.rows : [])
      .map(row => [finiteInteger(row?.skillId), row])
      .filter(([skillId]) => skillId !== null));
    const catalogById = new Map(skillCatalogRows(input)
      .map(row => [finiteInteger(row?.id ?? row?.skillId), row])
      .filter(([skillId]) => skillId !== null));
    const cardRouteBySkillId = isObject(input.cardRouteBySkillId)
      ? input.cardRouteBySkillId
      : {};
    return TRACKED_SKILLS.map(tracked => {
      const snapshot = snapshotById.get(tracked.skillId);
      const catalog = catalogById.get(tracked.skillId);
      const known = Boolean(snapshot)
        && Number.isFinite(Number(snapshot.expectedBashin))
        && Number(snapshot.expectedBashin) >= 0;
      return {
        skillId: tracked.skillId,
        familyId: finiteInteger(snapshot?.familyId ?? catalog?.familyId) || tracked.skillId,
        nameZhTw: text(catalog?.nameZhTw ?? catalog?.name, tracked.nameZhTw),
        variant: 'ordinary_white',
        snapshotStatus: known ? 'KNOWN' : 'MISSING',
        snapshotExpectedBashin: known ? Number(snapshot.expectedBashin) : null,
        snapshotMinBashin: known && Number.isFinite(Number(snapshot.minBashin))
          ? Number(snapshot.minBashin)
          : null,
        snapshotMaxBashin: known && Number.isFinite(Number(snapshot.maxBashin))
          ? Number(snapshot.maxBashin)
          : null,
        winnerLine: 'PRIMARY',
        cardRouteStatus: text(cardRouteBySkillId[tracked.skillId], 'UNKNOWN')
      };
    });
  }

  function orderedRows(result) {
    const rows = Array.isArray(result?.rows) ? result.rows : [];
    const rankingIndex = new Map((result?.rankings || [])
      .map(item => [Number(item.skillId), Number(item.rank)]));
    return rows.slice().sort((left, right) => {
      const leftRequired = left.bodyGoal?.status === 'REQUIRED' ? 0 : 1;
      const rightRequired = right.bodyGoal?.status === 'REQUIRED' ? 0 : 1;
      if (leftRequired !== rightRequired) return leftRequired - rightRequired;
      const leftRank = rankingIndex.get(Number(left.skillId)) ?? Number.MAX_SAFE_INTEGER;
      const rightRank = rankingIndex.get(Number(right.skillId)) ?? Number.MAX_SAFE_INTEGER;
      return leftRank - rightRank || Number(left.skillId) - Number(right.skillId);
    });
  }

  function evaluateRoute(input = {}, routeId = 'kitasan') {
    const route = routeById(routeId);
    const core = input.whiteFactorCore || input.white_factor_core || defaultCore;
    if (typeof core?.evaluateWhiteFactorValues !== 'function') {
      return {
        schemaVersion: 1,
        modelVersion: MODEL_VERSION,
        authority: 'CANDIDATE_ADVISORY_ONLY',
        status: 'UNAVAILABLE',
        probabilityStatus: 'NOT_COMPUTED',
        route,
        rows: [],
        rankings: [],
        warnings: [{ code: 'WHITE_FACTOR_CORE_UNAVAILABLE' }]
      };
    }
    const entry = snapshotEntry(input);
    const result = core.evaluateWhiteFactorValues({
      target: { ...TARGET },
      candidateSkills: buildCandidateSkills(input),
      nativeSkillIds: route.nativeSkillIds.slice(),
      userRequiredSkillIds: REQUIRED_SKILL_IDS.slice(),
      policy: isObject(input.policy) ? input.policy : {}
    });
    const snapshotStatus = validSnapshotEntry(entry) ? 'LOCAL_SNAPSHOT' : 'MISSING';
    const requiredStatus = result.requiredGoalSummary?.status || 'NEEDS_EVIDENCE';
    const numericStatus = result.rankings?.length ? 'RELATIVE_VALUES_AVAILABLE' : 'NEEDS_EVIDENCE';
    const rowBySkillId = new Map((result.rows || []).map(row => [Number(row.skillId), row]));
    const bodyRankings = (result.rankings || []).filter(item =>
      rowBySkillId.get(Number(item.skillId))?.bodyGoal?.status !== 'NOT_REQUIRED'
    );
    return {
      ...result,
      adapterModelVersion: MODEL_VERSION,
      route,
      snapshot: {
        key: SNAPSHOT_KEY,
        status: snapshotStatus,
        fetchedAt: snapshotStatus === 'LOCAL_SNAPSHOT' ? text(entry.fetchedAt) : ''
      },
      bodyRankings,
      childRankings: (result.rankings || []).slice(),
      decisionStatus: result.status === 'BLOCKED'
        ? 'BLOCKED'
        : (requiredStatus === 'READY' && numericStatus === 'RELATIVE_VALUES_AVAILABLE'
          ? 'READY'
          : 'NEEDS_EVIDENCE'),
      probabilityStatus: 'NOT_COMPUTED',
      displayRows: orderedRows(result)
    };
  }

  function evaluateAllRoutes(input = {}) {
    return {
      schemaVersion: 1,
      modelVersion: MODEL_VERSION,
      authority: 'CANDIDATE_ADVISORY_ONLY',
      target: { ...TARGET },
      probabilityStatus: 'NOT_COMPUTED',
      routes: Object.fromEntries(ROUTES.map(route => [
        route.id,
        evaluateRoute(input, route.id)
      ]))
    };
  }

  return {
    MODEL_VERSION,
    SNAPSHOT_KEY,
    TARGET,
    REQUIRED_SKILL_IDS,
    TRACKED_SKILLS,
    ROUTES,
    buildCandidateSkills,
    evaluateRoute,
    evaluateAllRoutes
  };
});
