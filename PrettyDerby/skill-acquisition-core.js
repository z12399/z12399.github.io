(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else if (typeof define === 'function' && define.amd) define([], factory);
  else if (root) root.SKILL_ACQUISITION_CORE = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MODEL_VERSION = 'skill-acquisition-core-v1';
  const ROUTE_TYPES = Object.freeze({
    TRAINING_HINT: 'training_hint',
    CONTINUOUS_EVENT: 'continuous_event',
    RANDOM_EVENT: 'random_event',
    UNKNOWN_EVENT: 'unknown_event'
  });
  const DEFAULT_HINT_BASELINE = 0.06;
  const DEFAULT_CONTINUOUS_PROBABILITY = 0.75;
  const MAX_DOMAIN_WEIGHT = 1000000;
  const DEFAULT_DOMAIN_WEIGHT = 100;
  const SORT_SENTINEL = Number.MAX_SAFE_INTEGER;
  const HINT_DISCOUNTS = Object.freeze({ 1: 0.10, 2: 0.20, 3: 0.30, 4: 0.35, 5: 0.40 });

  function objectLike(value) {
    return value !== null && typeof value === 'object';
  }

  function finite(value, fallback = null) {
    const number = typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
    return Number.isFinite(number) ? number : fallback;
  }

  function clamp(value, minimum, maximum) {
    const number = finite(value, minimum);
    return Math.min(maximum, Math.max(minimum, number));
  }

  function array(value) {
    return Array.isArray(value) ? value : value == null ? [] : [value];
  }

  function uniqueNumbers(values) {
    return [...new Set(array(values).map(value => finite(value)).filter(value => value != null))];
  }

  function firstDefined(...values) {
    return values.find(value => value !== undefined && value !== null);
  }

  function sentinelNumber(value) {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase().replace(/[-\s]+/g, '_');
    if (normalized === 'max_safe_integer' || normalized === 'maxsafeinteger') return Number.MAX_SAFE_INTEGER;
    if (normalized === 'max_value' || normalized === 'maxvalue') return Number.MAX_VALUE;
    if (normalized === 'infinity' || normalized === '+infinity') return Infinity;
    if (normalized === '-infinity') return -Infinity;
    return finite(value);
  }

  function isSortSentinel(value) {
    const number = sentinelNumber(value);
    return number != null && (!Number.isFinite(number) || Math.abs(number) >= Number.MAX_SAFE_INTEGER);
  }

  function normalizeSortPriority(value) {
    const number = sentinelNumber(value);
    if (number == null) return null;
    if (number === Infinity) return Number.MAX_SAFE_INTEGER;
    if (number === -Infinity) return Number.MIN_SAFE_INTEGER;
    return number;
  }

  function normalizedFamilyIds(source) {
    return uniqueNumbers([
      ...(Array.isArray(source.familyIds) ? source.familyIds : []),
      source.familyId,
      source.id,
      source.skillId
    ]);
  }

  function normalizeTarget(raw, index = 0) {
    const source = objectLike(raw) ? raw : {};
    const rawWeight = firstDefined(source.weight, source.domainWeight, source.score, source.utility);
    const sortValue = firstDefined(
      source.sortPriority,
      source.sortOrder,
      source.sortIndex,
      source.priority,
      isSortSentinel(source.weight) ? source.weight : null
    );
    const fallbackCandidates = [
      source.domainWeight,
      source.utility,
      source.categoryWeight,
      source.defaultWeight
    ];
    const fallback = fallbackCandidates
      .map(value => sentinelNumber(value))
      .find(value => value != null && Number.isFinite(value) && Math.abs(value) < Number.MAX_SAFE_INTEGER);
    const safeFallback = clamp(fallback == null ? DEFAULT_DOMAIN_WEIGHT : fallback, 0, MAX_DOMAIN_WEIGHT);
    const usableWeight = !isSortSentinel(rawWeight) ? finite(rawWeight, safeFallback) : safeFallback;
    const weight = clamp(usableWeight, 0, MAX_DOMAIN_WEIGHT);
    const target = {
      ...source,
      id: finite(firstDefined(source.id, source.skillId, source.familyId)),
      skillId: finite(firstDefined(source.skillId, source.id)),
      familyId: finite(firstDefined(source.familyId, source.id, source.skillId)),
      familyIds: normalizedFamilyIds(source),
      name: firstDefined(source.name, source.nameZhTw, source.label, null),
      requiredKind: firstDefined(source.requiredKind, source.kind, null),
      allowUpgrade: source.allowUpgrade === true,
      weight,
      domainWeight: weight,
      sortPriority: normalizeSortPriority(sortValue),
      weightWasSortSentinel: isSortSentinel(rawWeight),
      weightBound: MAX_DOMAIN_WEIGHT
    };
    return target;
  }

  function routeText(route) {
    return [
      route?.routeType,
      route?.source,
      route?.sourceType,
      route?.grantType,
      route?.eventKind,
      route?.kind,
      route?.type
    ].filter(value => value != null).join(' ').toLowerCase().replace(/[\s-]+/g, '_');
  }

  function routeDatasetStatus(dataset) {
    const routes = Array.isArray(dataset) ? dataset : dataset?.routes;
    const metadata = Array.isArray(dataset) ? null : dataset?.metadata;
    if (!Array.isArray(routes)) return { status: 'unknown', reason: 'routes-missing', routeCount: 0 };
    if (!metadata || typeof metadata !== 'object') {
      return { status: 'unknown', reason: 'metadata-missing', routeCount: routes.length };
    }
    if (
      metadata.complete === false
      || metadata.scope === 'partial'
      || metadata.status === 'partial'
      || (Array.isArray(metadata.errors) && metadata.errors.length > 0)
    ) {
      return { status: 'partial', reason: 'metadata-reports-partial', routeCount: routes.length };
    }
    if (metadata.complete === true) return { status: 'complete', reason: null, routeCount: routes.length };
    return { status: 'unknown', reason: 'completion-flag-missing', routeCount: routes.length };
  }

  function routeRecords(dataset, supportId, skillId) {
    const routes = Array.isArray(dataset) ? dataset : dataset?.routes;
    if (!Array.isArray(routes)) return [];
    return routes.filter(route =>
      (supportId == null || Number(route.supportId) === Number(supportId))
      && (skillId == null || Number(route.skillId) === Number(skillId))
    );
  }

  function continuousHeuristic(route, options) {
    const configured = options?.continuousHeuristic ?? options?.continuousProbability;
    let value;
    let source = 'default-continuous-route';
    if (typeof configured === 'function') {
      const result = configured(route);
      if (objectLike(result)) {
        value = firstDefined(result.probability, result.rankingProbability, result.value);
        source = result.probabilitySource || result.source || 'custom';
      } else value = result;
      source = source || 'custom';
    } else if (configured != null) {
      value = configured;
      source = 'configured';
    } else value = DEFAULT_CONTINUOUS_PROBABILITY;
    const probability = clamp(value, 0, 1);
    const safeSource = String(source).replace(/official/ig, 'reference-free');
    return { probability, probabilitySource: `heuristic:${safeSource}` };
  }

  function classifySupportRoute(route, options = {}) {
    const source = objectLike(route) ? route : {};
    const text = routeText(source);
    const explicit = String(firstDefined(source.routeType, source.eventKind, source.kind, source.type, '')).toLowerCase();
    let routeType;
    if (
      /training_hint|hint_training|support_hint/.test(text)
      && !/random|continuous|event/.test(explicit)
    ) routeType = ROUTE_TYPES.TRAINING_HINT;
    else if (/continuous|連続|event_continuous/.test(text)) routeType = ROUTE_TYPES.CONTINUOUS_EVENT;
    else if (/random|ランダム|event_random/.test(text)) routeType = ROUTE_TYPES.RANDOM_EVENT;
    else if (source.isTrainingHint === true || source.source === 'hint') routeType = ROUTE_TYPES.TRAINING_HINT;
    else routeType = ROUTE_TYPES.UNKNOWN_EVENT;

    let rankingProbability = null;
    let probabilitySource = 'not-applicable';
    let bonusOnly = false;
    if (routeType === ROUTE_TYPES.CONTINUOUS_EVENT) {
      const heuristic = continuousHeuristic(source, options);
      rankingProbability = heuristic.probability;
      probabilitySource = heuristic.probabilitySource;
    } else if (routeType === ROUTE_TYPES.RANDOM_EVENT) {
      rankingProbability = 0;
      probabilitySource = 'excluded-random-event';
      bonusOnly = true;
    } else if (routeType === ROUTE_TYPES.UNKNOWN_EVENT) {
      rankingProbability = 0;
      probabilitySource = 'unknown-event-fail-closed';
      bonusOnly = true;
    } else {
      probabilitySource = 'hint-model';
    }
    return {
      ...source,
      routeType,
      rankingProbability,
      bonusOnly,
      probabilitySource,
      routeDatasetStatus: options.routeDataset ? routeDatasetStatus(options.routeDataset).status : null
    };
  }

  function directEffect(source, effectType) {
    const containers = [source, source?.resolvedEffects, source?.effects, source?.effectValues];
    for (const container of containers) {
      if (!objectLike(container)) continue;
      const direct = firstDefined(container[effectType], container[String(effectType)]);
      if (direct != null) {
        if (objectLike(direct) && direct.value != null) return finite(direct.value);
        const number = finite(direct);
        if (number != null) return number;
      }
      const row = array(container).find(item => Number(item?.effectType ?? item?.type) === effectType);
      if (row) {
        const number = finite(firstDefined(row.value, row.amount));
        if (number != null) return number;
      }
    }
    return null;
  }

  function effectAtLevel(profile, effectType, level, limitBreak) {
    if (!objectLike(profile)) return null;
    const rows = Array.isArray(profile.effectRows) ? profile.effectRows : [];
    const row = rows.find(item => Number(item?.effectType ?? item?.type) === effectType);
    if (row) {
      const values = row.valuesByLevel || row.values || {};
      const requested = Math.max(1, Math.trunc(finite(level, profile.maxLevel || 1)));
      const available = Object.keys(values).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
      if (available.length) {
        const key = available.includes(requested)
          ? requested
          : available.reduce((best, candidate) => candidate <= requested ? candidate : best, available[0]);
        return finite(values[key] ?? values[String(key)]);
      }
    }
    const lb = Math.max(0, Math.trunc(finite(limitBreak, 4)));
    const snapshot = profile.effectsByLimitBreak?.[lb] || profile.effectsByLimitBreak?.[String(lb)];
    return finite(snapshot?.effects?.[effectType] ?? snapshot?.effects?.[String(effectType)]);
  }

  function resolveHintEffects(profileOrResolved = {}, options = {}) {
    const source = objectLike(profileOrResolved) ? profileOrResolved : {};
    const profile = source.profile || source;
    const level = finite(firstDefined(options.level, source.level), null);
    const limitBreak = finite(firstDefined(options.limitBreak, source.limitBreak), 4);
    const effect17 = Math.max(0, finite(firstDefined(
      options.effect17,
      options.hintLevelBonus,
      source.effect17,
      source.hintLevelBonus,
      directEffect(source, 17),
      directEffect(profile, 17),
      effectAtLevel(profile, 17, level, limitBreak)
    ), 0));
    const effect18 = Math.max(0, finite(firstDefined(
      options.effect18,
      options.hintRate,
      source.effect18,
      source.hintRate,
      directEffect(source, 18),
      directEffect(profile, 18),
      effectAtLevel(profile, 18, level, limitBreak)
    ), 0));
    return {
      effect17,
      effect18,
      hintLevelBonus: effect17,
      hintRate: effect18,
      level,
      limitBreak,
      source: level == null ? 'resolved-effects-or-profile' : 'profile-effect-curve'
    };
  }

  function inferPoolSize(input, options) {
    const ids = firstDefined(
      input.hintSkillIds,
      input.skillPool,
      input.pool,
      input.profile?.skillSources?.hintSkillIds,
      input.supportCard?.hintSkillIds,
      input.card?.hintSkillIds
    );
    const count = Array.isArray(ids) ? ids.length : finite(firstDefined(input.poolSize, input.hintPoolSize, options.poolSize));
    return Math.max(1, Math.trunc(finite(count, 1)));
  }

  function calculateHintAcquisition(input = {}, options = {}) {
    const source = objectLike(input) ? input : { effects: input };
    const settings = objectLike(options) ? options : {};
    const effects = resolveHintEffects(source.profile || source.effects || source, {
      ...settings,
      effect17: firstDefined(settings.effect17, source.effect17),
      effect18: firstDefined(settings.effect18, source.effect18)
    });
    const poolSize = inferPoolSize(source, settings);
    const pool = firstDefined(source.hintSkillIds, source.skillPool, source.pool);
    const targetSkillId = finite(firstDefined(source.targetSkillId, source.skillId, source.target?.id));
    const targetInPool = !Array.isArray(pool) || targetSkillId == null
      ? true
      : pool.some(id => Number(id) === targetSkillId);
    const baseline = clamp(firstDefined(settings.baseline, source.baseline, DEFAULT_HINT_BASELINE), 0, 1);
    const opportunities = Math.max(0, Math.trunc(finite(firstDefined(
      settings.opportunities,
      source.opportunities,
      settings.nOpportunities,
      source.nOpportunities,
      1
    ), 1)));
    const pPerOpportunity = targetInPool
      ? clamp(baseline * (1 + effects.hintRate / 100) / poolSize, 0, 1)
      : 0;
    const pAtLeastOnce = 1 - Math.pow(1 - pPerOpportunity, opportunities);
    const hintGrantLevel = Math.max(1, Math.trunc(1 + effects.effect17));
    const discountLevel = clamp(hintGrantLevel, 1, 5);
    const discountRate = HINT_DISCOUNTS[discountLevel] || 0;
    return {
      ...effects,
      poolSize,
      targetInPool,
      baseline,
      opportunities,
      nOpportunities: opportunities,
      pPerOpportunity,
      pAtLeastOnce,
      acquisitionProbability: pAtLeastOnce,
      hintGrant: hintGrantLevel,
      hintGrantLevel,
      spDiscountLevel: discountLevel,
      spDiscountPercent: discountRate * 100,
      spDiscountRate: discountRate,
      skillPointMultiplier: 1 - discountRate,
      formula: {
        pPerOpportunity: 'baseline * (1 + hintRate / 100) / poolSize',
        pAtLeastOnce: '1 - (1 - pPerOpportunity) ^ opportunities',
        hintGrant: '1 + effect17',
        hintLvDoesNotChangeProbability: true
      }
    };
  }

  function routeGroupKey(route, index) {
    const explicit = firstDefined(route.exclusiveGroup, route.exclusive_group, route.eventChoiceGroup, route.eventId);
    if (explicit != null) return String(explicit);
    return [route.supportId ?? route.cardId ?? '', route.skillId ?? '', route.routeType ?? route.eventKind ?? route.kind ?? '', route.eventIndex ?? index].join(':');
  }

  function independentEvidence(route) {
    return route?.independent === true
      || route?.evidenceIndependent === true
      || route?.independenceEvidence === true
      || route?.probabilityEvidence?.independent === true;
  }

  function routeCoverage(route, classification, options) {
    if (classification.routeType === ROUTE_TYPES.RANDOM_EVENT || classification.routeType === ROUTE_TYPES.UNKNOWN_EVENT) {
      return { coverageProbability: 0, hint: null, source: classification.probabilitySource };
    }
    if (classification.routeType === ROUTE_TYPES.TRAINING_HINT) {
      const hint = route.hintMetrics || calculateHintAcquisition({
        ...route,
        profile: route.profile || route.supportProfile,
        hintSkillIds: route.hintSkillIds,
        poolSize: route.poolSize ?? route.hintPoolSize,
        targetSkillId: route.targetSkillId ?? route.skillId
      }, options);
      return { coverageProbability: hint.pAtLeastOnce, hint, source: 'hint-model' };
    }
    const provided = finite(route.coverageProbability);
    return {
      coverageProbability: provided == null ? classification.rankingProbability : clamp(provided, 0, 1),
      hint: null,
      source: provided == null ? classification.probabilitySource : 'provided-coverage'
    };
  }

  function noisyOr(values) {
    return clamp(1 - values.reduce((product, value) => product * (1 - clamp(value, 0, 1)), 1), 0, 1);
  }

  function mergeRoutes(routes, options = {}) {
    const classified = array(routes).map((route, index) => {
      const classification = classifySupportRoute(route, options);
      const coverage = routeCoverage(route, classification, options);
      return {
        ...classification,
        routeIndex: index,
        exclusiveGroup: routeGroupKey(classification, index),
        coverageProbability: coverage.coverageProbability,
        hintMetrics: coverage.hint,
        coverageSource: coverage.source,
        independenceEvidence: independentEvidence(route)
      };
    });
    const groups = new Map();
    for (const route of classified) {
      if (!groups.has(route.exclusiveGroup)) groups.set(route.exclusiveGroup, []);
      groups.get(route.exclusiveGroup).push(route);
    }
    const breakdown = [...groups.entries()].map(([exclusiveGroup, groupRoutes]) => {
      const coverageProbability = Math.max(...groupRoutes.map(route => route.coverageProbability), 0);
      return {
        exclusiveGroup,
        routes: groupRoutes,
        coverageProbability,
        routeTypes: [...new Set(groupRoutes.map(route => route.routeType))],
        mergedBy: 'max-within-exclusive-group'
      };
    });
    const values = breakdown.map(group => group.coverageProbability);
    const canUnion = options.independentEvidence === true
      || (classified.length > 0 && classified.every(route => route.independenceEvidence));
    const coverageProbability = canUnion ? noisyOr(values) : Math.max(...values, 0);
    return {
      routes: classified,
      groups: breakdown,
      breakdown,
      coverageProbability,
      rankingProbability: Math.max(...classified.map(route => finite(route.rankingProbability, 0)), 0),
      bonusOnly: classified.length > 0 && classified.every(route => route.bonusOnly),
      unionMode: canUnion ? 'independent-evidence-noisy-or' : 'same-source-max',
      independentEvidence: canUnion
    };
  }

  function skillTier(value) {
    const raw = typeof value === 'string' ? value.trim().toLowerCase() : value;
    if (raw === 'white' || raw === 'lower' || raw === 'low' || raw === 'lower_tier') return 1;
    if (raw === 'gold' || raw === 'exactgold' || raw === 'exact_gold') return 2;
    return finite(raw);
  }

  function skillFamilyIds(skill) {
    return uniqueNumbers([
      ...(Array.isArray(skill?.familyIds) ? skill.familyIds : []),
      skill?.familyId,
      skill?.id,
      skill?.skillId
    ]);
  }

  function matchesTarget(targetInput, candidateInput, options = {}) {
    const target = normalizeTarget(targetInput);
    const candidate = objectLike(candidateInput?.skill) ? candidateInput.skill : (candidateInput || {});
    const targetSkill = targetInput?.skill || options.targetSkill || {};
    const targetFamilies = new Set(uniqueNumbers([
      ...target.familyIds,
      ...skillFamilyIds(targetSkill),
      target.id,
      target.skillId
    ]).map(String));
    const candidateFamilies = skillFamilyIds(candidate);
    const candidateId = finite(firstDefined(candidate.id, candidate.skillId));
    if (Array.isArray(targetInput?.skillIds) && targetInput.skillIds.length
      && !targetInput.skillIds.map(Number).includes(candidateId)) return false;
    if (target.exact === true && candidateId !== target.id) return false;
    if (candidateFamilies.length && targetFamilies.size
      && !candidateFamilies.some(id => targetFamilies.has(String(id)))) return false;
    if (!candidateFamilies.length && candidateId != null && !targetFamilies.has(String(candidateId))) return false;

    const requiredKind = String(firstDefined(
      target.requiredKind,
      target.kind,
      target.coverageRole,
      ''
    )).toLowerCase().replace(/[\s-]+/g, '_');
    const targetTier = skillTier(firstDefined(
      target.targetTier,
      target.tier,
      target.rarity,
      targetSkill.rarity,
      /gold/.test(requiredKind) ? 2 : /white|lower/.test(requiredKind) ? 1 : null
    ));
    const candidateTier = skillTier(firstDefined(candidate.tier, candidate.rarity, candidate.kind));

    if (requiredKind === 'exact_gold' || requiredKind === 'exactgold' || requiredKind === 'gold' || requiredKind === 'event_gold') {
      if (!(candidateTier >= 2)) return false;
    }
    if (requiredKind === 'exact_white') {
      if (candidateTier != null && candidateTier !== 1) return false;
    }
    if (requiredKind === 'white' || requiredKind === 'hint_white' || requiredKind === 'lower_tier') {
      // Skill families are tiered upgrades: a gold candidate satisfies a
      // lower-tier/white target in the same family, while the reverse is
      // blocked by the gold target gate above.
      if (candidateTier != null && candidateTier < 1) return false;
    }
    if (target.minRarity != null && candidateTier != null && candidateTier < Number(target.minRarity)) return false;
    if (targetTier === 2 && candidateTier === 1) return false;
    if (targetTier === 1 && candidateTier != null && candidateTier < 1) return false;
    return true;
  }

  function sourceIds(source) {
    const supportId = finite(firstDefined(
      source?.supportId,
      source?.cardId,
      source?.supportCard?.id,
      source?.card?.id
    ));
    const outfitId = finite(firstDefined(
      source?.outfitId,
      source?.costumeId,
      source?.dressId,
      source?.cardOutfitId,
      source?.supportCard?.outfitId,
      source?.card?.outfitId
    ));
    const sourceId = firstDefined(source?.sourceId, source?.nodeId, source?.id);
    return { supportId, outfitId, sourceId: sourceId == null ? null : String(sourceId) };
  }

  function normalizeSourceCandidate(raw, index = 0) {
    const source = objectLike(raw) ? raw : {};
    const ids = sourceIds(source);
    const routes = array(firstDefined(
      source.routes,
      source.route,
      source.routeType != null || source.eventKind != null || source.kind != null ? source : null
    ));
    return {
      ...source,
      ...ids,
      sourceType: firstDefined(source.sourceType, source.type, 'support'),
      routes,
      owned: source.owned === true,
      selected: source.selected === true || source.actual === true,
      borrowed: source.borrowed === true,
      borrowCandidate: source.borrowCandidate === true || source.borrowed === true,
      index,
      sourceQuality: clamp(firstDefined(source.sourceQuality, source.quality, source.alternativeSourceQuality, 1), 0, 1)
    };
  }

  function candidateAliases(source) {
    const ids = sourceIds(source);
    return [
      ids.supportId == null ? null : `support:${ids.supportId}`,
      ids.outfitId == null ? null : `outfit:${ids.outfitId}`,
      ids.sourceId == null ? null : `source:${ids.sourceId}`
    ].filter(Boolean);
  }

  function dedupeSourceGraph(input) {
    const rows = array(Array.isArray(input) ? input : input?.sources).map(normalizeSourceCandidate);
    const parent = rows.map((_, index) => index);
    function find(index) {
      let current = index;
      while (parent[current] !== current) {
        parent[current] = parent[parent[current]];
        current = parent[current];
      }
      return current;
    }
    function union(left, right) {
      const a = find(left);
      const b = find(right);
      if (a !== b) parent[b] = a;
    }
    const aliasOwners = new Map();
    rows.forEach((row, index) => {
      for (const alias of candidateAliases(row)) {
        if (aliasOwners.has(alias)) union(index, aliasOwners.get(alias));
        else aliasOwners.set(alias, index);
      }
    });
    const groups = new Map();
    rows.forEach((row, index) => {
      const root = find(index);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root).push(row);
    });
    const nodes = [...groups.values()].map(group => {
      const aliases = [...new Set(group.flatMap(candidateAliases))];
      const supportIds = uniqueNumbers(group.map(row => row.supportId));
      const outfitIds = uniqueNumbers(group.map(row => row.outfitId));
      const routes = group.flatMap(row => row.routes || []);
      const routeKeys = new Set();
      const dedupedRoutes = routes.filter((route, routeIndex) => {
        const key = [
          route?.supportId ?? '', route?.skillId ?? '', route?.routeType ?? route?.eventKind ?? route?.kind ?? '',
          route?.eventIndex ?? '', route?.exclusiveGroup ?? '', route?.eventTitle ?? '', routeIndex
        ].join('|');
        if (routeKeys.has(key)) return false;
        routeKeys.add(key);
        return true;
      });
      const first = group[0] || {};
      return {
        ...first,
        sourceKey: outfitIds.length ? `outfit:${outfitIds[0]}`
          : supportIds.length ? `support:${supportIds[0]}`
            : aliases[0] || `source:${first.index}`,
        aliases,
        supportIds,
        outfitIds,
        routes: dedupedRoutes,
        candidateCount: group.length,
        owned: group.some(row => row.owned),
        selected: group.some(row => row.selected),
        borrowed: group.some(row => row.borrowed),
        borrowCandidate: group.some(row => row.borrowCandidate),
        sourceQuality: Math.max(...group.map(row => row.sourceQuality), 0)
      };
    });
    return { nodes, sourceNodes: nodes, aliases: aliasOwners };
  }

  function idSet(values) {
    const result = new Set();
    for (const value of array(values)) {
      if (objectLike(value)) {
        for (const alias of candidateAliases(value)) result.add(alias);
        const ids = sourceIds(value);
        if (ids.supportId != null) result.add(String(ids.supportId));
        if (ids.outfitId != null) result.add(String(ids.outfitId));
        if (ids.sourceId != null) result.add(String(ids.sourceId));
      } else if (value != null) result.add(String(value));
    }
    return result;
  }

  function sourceSelected(source, input = {}) {
    const ids = sourceIds(source);
    const aliases = new Set(candidateAliases(source));
    const selections = [
      ...array(input.selectedSources),
      ...array(input.selectedSourceIds),
      ...array(input.selectedSupportIds),
      ...array(input.selectedBorrow),
      ...array(input.selectedBorrowId),
      ...array(input.borrowedCard)
    ];
    const selected = idSet(selections);
    const matchesSelection = aliases.has([...selected].find(value => aliases.has(value)))
      || (ids.supportId != null && selected.has(String(ids.supportId)))
      || (ids.outfitId != null && selected.has(String(ids.outfitId)))
      || (ids.sourceId != null && selected.has(String(ids.sourceId)));
    const borrowed = source.borrowCandidate || source.borrowed;
    if (borrowed) return source.selected === true || matchesSelection;
    // Ownership makes a source available for replacement/scarcity analysis;
    // it is not proof that the card is in the selected deck.  Actual coverage
    // requires an explicit selected/actual source or selected borrow.
    return source.actual === true || source.selected === true || matchesSelection;
  }

  function lookupById(collection, id) {
    if (collection instanceof Map) return collection.get(Number(id)) || collection.get(String(id));
    if (Array.isArray(collection)) return collection.find(item => Number(item?.id) === Number(id));
    if (objectLike(collection)) return collection[id] || collection[String(id)];
    return null;
  }

  function catalogSkill(catalog, id) {
    return lookupById(catalog?.skills, id) || lookupById(catalog?.skillById, id);
  }

  function catalogSupport(catalog, id) {
    return lookupById(catalog?.supports, id) || lookupById(catalog?.supportById, id);
  }

  function catalogProfile(profiles, id) {
    const collection = profiles?.profiles || profiles;
    return lookupById(collection, id);
  }

  function routeMatchesTarget(route, target, catalog, options = {}) {
    const routeSkillId = finite(firstDefined(route?.skillId, route?.targetSkillId));
    const candidate = route?.skill || (routeSkillId == null ? null : catalogSkill(catalog, routeSkillId));
    if (candidate) return matchesTarget(target, candidate, options);
    if (routeSkillId == null) return true;
    const familySet = new Set(normalizeTarget(target).familyIds.map(String));
    return familySet.has(String(routeSkillId)) || Number(target.id) === routeSkillId;
  }

  function deriveSupportCandidates(input, target, catalog) {
    const routeData = input.routeData || input.supportEventRoutes || input.routesData || null;
    const profileData = input.profiles || input.profileData || catalog.supportCardProfiles;
    const explicitRows = Array.isArray(input.routes)
      ? input.routes
      : Array.isArray(input.routeRows) ? input.routeRows : [];
    let cards = array(input.supportCards || input.cards || catalog.supports);
    if (!cards.length && explicitRows.length) {
      cards = uniqueNumbers(explicitRows.map(row => row.supportId))
        .map(id => catalogSupport(catalog, id) || { id });
    }
    const selectedIds = idSet([
      ...array(input.selectedSupportIds),
      ...array(input.selectedSources),
      ...array(input.selectedBorrow)
    ]);
    const ownedIds = idSet(input.ownedSupportIds || input.ownedCards);
    const borrowIds = idSet(input.borrowCandidates || input.borrowedCards);
    return cards.flatMap(card => {
      const supportId = finite(firstDefined(card?.supportId, card?.id));
      if (supportId == null) return [];
      const profile = catalogProfile(profileData, supportId);
      const hintSkillIds = uniqueNumbers([
        ...(Array.isArray(card?.hintSkillIds) ? card.hintSkillIds : []),
        ...(Array.isArray(profile?.skillSources?.hintSkillIds) ? profile.skillSources.hintSkillIds : [])
      ]);
      const eventSkillIds = uniqueNumbers([
        ...(Array.isArray(card?.eventSkillIds) ? card.eventSkillIds : []),
        ...(Array.isArray(profile?.skillSources?.eventSkillIds) ? profile.skillSources.eventSkillIds : [])
      ]);
      const rows = [
        ...explicitRows.filter(row => Number(row.supportId) === supportId),
        ...routeRecords(routeData, supportId, null)
      ];
      const routes = [];
      const relevantHints = hintSkillIds.filter(skillId => routeMatchesTarget({ skillId }, target, catalog, { targetSkill: catalogSkill(catalog, target.id) }));
      for (const skillId of relevantHints) {
        routes.push({
          supportId,
          skillId,
          routeType: ROUTE_TYPES.TRAINING_HINT,
          source: 'training_hint',
          exclusiveGroup: `support:${supportId}:hint:${skillId}`,
          profile,
          hintSkillIds,
          targetSkillId: skillId,
          poolSize: hintSkillIds.length,
          evidence: 'support-card-profile.skillSources.hintSkillIds'
        });
      }
      const eventRows = rows.filter(row => eventSkillIds.includes(Number(row.skillId)) || routeMatchesTarget(row, target, catalog));
      for (const row of eventRows) {
        if (!routeMatchesTarget(row, target, catalog)) continue;
        routes.push({
          ...row,
          supportId,
          sourceType: 'support_event',
          profile,
          hintSkillIds
        });
      }
      for (const skillId of eventSkillIds.filter(id => routeMatchesTarget({ skillId: id }, target, catalog))) {
        if (routes.some(route => Number(route.skillId) === skillId && route.sourceType === 'support_event')) continue;
        routes.push({
          supportId,
          skillId,
          eventKind: 'unknown',
          routeType: ROUTE_TYPES.UNKNOWN_EVENT,
          sourceType: 'support_event',
          profile,
          evidence: 'event-route-not-found'
        });
      }
      if (!routes.length && finite(card.coverageProbability) == null) return [];
      return [{
        ...card,
        supportId,
        profile,
        routes,
        owned: card.owned === true || ownedIds.has(String(supportId)),
        selected: card.selected === true || selectedIds.has(String(supportId)),
        borrowed: card.borrowed === true,
        borrowCandidate: card.borrowCandidate === true || borrowIds.has(String(supportId))
      }];
    });
  }

  function buildSourceGraph(input = {}) {
    const catalog = input.catalog || {};
    const initialTarget = input.target || {
      id: input.skillId,
      skillId: input.skillId
    };
    const target = normalizeTarget(initialTarget);
    const rawCandidates = array(input.sources || input.sourceCandidates).length
      ? array(input.sources || input.sourceCandidates)
      : deriveSupportCandidates(input, target, catalog);
    const normalized = rawCandidates.map(normalizeSourceCandidate).map(source => {
      const compatibleRoutes = source.routes.filter(route => routeMatchesTarget(route, target, catalog, {
        targetSkill: input.targetSkill || catalogSkill(catalog, target.id)
      }));
      return {
        ...source,
        routes: compatibleRoutes,
        selected: source.selected || sourceSelected(source, input)
      };
    });
    const graph = dedupeSourceGraph(normalized);
    const nodes = graph.nodes.map(node => {
      const routes = node.routes || [];
      const routeBreakdown = routes.length
        ? mergeRoutes(routes, {
          ...input,
          routeDataset: input.routeData || input.supportEventRoutes || input.routesData
        })
        : null;
      const coverageProbability = routeBreakdown
        ? routeBreakdown.coverageProbability
        : clamp(node.coverageProbability, 0, 1);
      const potentialCoverage = Number.isFinite(coverageProbability)
        ? coverageProbability
        : node.borrowCandidate ? 1 : 0;
      return {
        ...node,
        routeBreakdown,
        coverageProbability,
        potentialCoverage,
        actual: sourceSelected(node, input),
        selectedBorrow: (node.borrowCandidate || node.borrowed) && sourceSelected(node, input)
      };
    });
    return {
      modelVersion: MODEL_VERSION,
      target,
      nodes,
      sourceNodes: nodes,
      routeDatasetStatus: routeDatasetStatus(input.routeData || input.supportEventRoutes || input.routesData),
      deduped: true
    };
  }

  function plannedLineageEntries(input) {
    const field = input.plannedLineage ?? input.plannedLineageSources;
    if (field != null) return { entries: array(field), fieldWasPlanned: true };
    return { entries: array(input.lineage), fieldWasPlanned: false };
  }

  function lineageIsVerified(entry) {
    return entry?.verified === true
      || String(firstDefined(entry?.verificationStatus, entry?.evidenceStatus, entry?.status, '')).toLowerCase() === 'verified';
  }

  function resolvePlannedLineage(input, target, catalog) {
    const { entries, fieldWasPlanned } = plannedLineageEntries(input);
    const verified = entries.filter(entry => {
      if (!objectLike(entry) || !lineageIsVerified(entry)) return false;
      const planned = fieldWasPlanned || entry.planned === true || String(entry.status || '').toLowerCase() === 'planned';
      if (!planned) return false;
      const candidate = entry.skill || catalogSkill(catalog, entry.skillId ?? entry.id);
      return matchesTarget(target, candidate || { id: entry.skillId ?? entry.id }, {
        targetSkill: input.targetSkill || catalogSkill(catalog, target.id)
      });
    });
    const rows = verified.map((entry, index) => ({
      ...entry,
      sourceKey: String(firstDefined(entry.sourceId, entry.parentId, entry.factorId, entry.skillId, entry.id, `lineage:${index}`)),
      coverageProbability: clamp(firstDefined(entry.coverageProbability, entry.probability, 1), 0, 1),
      credit: Math.max(0, finite(firstDefined(entry.credit, entry.lineageCredit), 1))
    }));
    const seen = new Set();
    const deduped = rows.filter(row => {
      if (seen.has(row.sourceKey)) return false;
      seen.add(row.sourceKey);
      return true;
    });
    return {
      entries: deduped,
      actualCoverage: noisyOr(deduped.map(row => row.coverageProbability)),
      plannedLineageCredit: deduped.reduce((sum, row) => sum + row.credit, 0)
    };
  }

  function potentialCoverage(source) {
    const route = source?.routes?.[0] || source;
    const classification = classifySupportRoute(route);
    const hasExplicitRoute = (Array.isArray(source?.routes) && source.routes.length > 0)
      || source?.routeType != null
      || source?.eventKind != null
      || source?.kind != null;
    if (hasExplicitRoute
      && (classification.routeType === ROUTE_TYPES.RANDOM_EVENT || classification.routeType === ROUTE_TYPES.UNKNOWN_EVENT)) return 0;
    const direct = finite(source?.potentialCoverage ?? source?.coverageProbability);
    if (direct != null) return clamp(direct, 0, 1);
    if (finite(source?.routeBreakdown?.coverageProbability) != null) return clamp(source.routeBreakdown.coverageProbability, 0, 1);
    return 1;
  }

  function sourceQuality(source) {
    return clamp(firstDefined(
      source?.alternativeSourceQuality,
      source?.sourceQuality,
      source?.quality,
      source?.routeBreakdown?.coverageProbability != null ? Math.max(0.25, source.routeBreakdown.coverageProbability) : null,
      1
    ), 0, 1);
  }

  function sourceMatchesKey(source, key) {
    if (key == null) return false;
    const wanted = String(key);
    if (String(source?.sourceKey ?? '') === wanted) return true;
    const ids = sourceIds(source);
    if ([ids.supportId, ids.outfitId, ids.sourceId].some(value => value != null && String(value) === wanted)) return true;
    return candidateAliases(source).includes(wanted);
  }

  function calculateScarcity(input = {}) {
    const rows = array(input.sourceNodes || input.nodes || input.sources).map(normalizeSourceCandidate);
    const actualIds = idSet(input.actualSourceIds || input.selectedSourceIds || input.selectedSources);
    const evaluated = rows.map(row => ({
      ...row,
      potentialCoverage: potentialCoverage(row),
      actual: row.actual === true || row.selected === true || candidateAliases(row).some(alias => actualIds.has(alias))
    }));
    const potential = evaluated.filter(row => row.potentialCoverage > 0);
    const actual = potential.filter(row => row.actual);
    const primary = [...actual].sort((left, right) => right.potentialCoverage - left.potentialCoverage)[0] || null;
    const candidateKey = firstDefined(
      input.candidateSourceKey,
      input.candidateSourceId,
      input.candidateKey,
      input.sourceKey
    );
    const candidate = candidateKey == null
      ? null
      : potential.find(row => sourceMatchesKey(row, candidateKey)) || null;
    // Candidate-specific scarcity is a marginal question: the candidate being
    // ranked is never counted as its own replacement.  Selected actual
    // coverage remains a separate output and does not silently erase other
    // viable alternatives.
    const alternatives = candidate
      ? potential.filter(row => row !== candidate)
      : potential.filter(row => row !== primary);
    const qualityRows = alternatives.map(row => ({
      sourceKey: row.sourceKey || candidateAliases(row)[0] || String(row.index),
      quality: sourceQuality(row),
      potentialCoverage: row.potentialCoverage
    }));
    const effectiveAlternativeMass = qualityRows.reduce((sum, row) => sum + row.quality, 0);
    const factorabilityProxy = clamp(firstDefined(input.factorabilityProxy, input.factorability, 0), 0, 1);
    const floor = clamp(firstDefined(input.floor, input.scarcityFloor, 0.10), 0, 1);
    const baseScarcityMultiplier = clamp(1 / (1 + effectiveAlternativeMass), floor, 1);
    const scarcityMultiplier = clamp(baseScarcityMultiplier * (1 - factorabilityProxy), 0, 1);
    const alternativeSourceQuality = qualityRows.length
      ? qualityRows.reduce((sum, row) => sum + row.quality, 0) / qualityRows.length
      : 0;
    return {
      alternativeSourceCount: qualityRows.length,
      alternativeSourceQuality,
      alternativeSourceQualityBreakdown: qualityRows,
      effectiveAlternativeMass,
      factorabilityProxy,
      floor,
      baseScarcityMultiplier,
      scarcityMultiplier,
      marginalMultiplier: scarcityMultiplier,
      formulaBreakdown: {
        effectiveAlternativeMass: 'sum(alternativeSourceQuality)',
        baseScarcityMultiplier: 'clamp(1 / (1 + effectiveAlternativeMass), floor, 1)',
        scarcityMultiplier: 'baseScarcityMultiplier * (1 - factorabilityProxy)',
        primarySourceKey: primary?.sourceKey || null,
        candidateSourceKey: candidate?.sourceKey || (candidateKey == null ? null : String(candidateKey)),
        candidateExcludedFromAlternatives: Boolean(candidate)
      },
      candidateSourceKey: candidate?.sourceKey || (candidateKey == null ? null : String(candidateKey)),
      candidateFound: Boolean(candidate)
    };
  }

  function calculateMarginalScarcity(candidateKey, input = {}) {
    if (objectLike(candidateKey) && arguments.length === 1) {
      return calculateScarcity({ ...candidateKey, candidateSourceId: firstDefined(
        candidateKey.candidateSourceId,
        candidateKey.candidateSourceKey,
        candidateKey.candidateKey
      ) });
    }
    return calculateScarcity({ ...input, candidateSourceId: candidateKey });
  }

  function analyzeSkillAcquisition(input = {}) {
    const catalog = input.catalog || {};
    const targetSkill = input.targetSkill || catalogSkill(catalog, input.target?.id ?? input.skillId);
    const target = normalizeTarget({
      ...(input.target || {}),
      ...(targetSkill && input.target?.rarity == null ? { rarity: targetSkill.rarity } : {}),
      ...(targetSkill && input.target?.familyId == null ? { familyId: targetSkill.familyId, familyIds: targetSkill.familyIds } : {})
    });
    const graph = buildSourceGraph({ ...input, target, targetSkill });
    const actualNodes = graph.nodes.filter(node => node.actual && node.coverageProbability > 0);
    const lineage = resolvePlannedLineage(input, target, catalog);
    const actualCoverage = noisyOr([
      ...actualNodes.map(node => node.coverageProbability),
      lineage.actualCoverage
    ]);
    const scarcity = calculateScarcity({
      ...input,
      sourceNodes: graph.nodes,
      actualSourceIds: actualNodes.flatMap(node => node.aliases || []),
      actualCoverage
    });
    const selectedBorrowIds = graph.nodes.filter(node => node.selectedBorrow).flatMap(node => node.aliases || []);
    return {
      modelVersion: MODEL_VERSION,
      target,
      skill: targetSkill || null,
      sourceGraph: graph,
      routeBreakdown: graph.nodes.map(node => ({
        sourceKey: node.sourceKey,
        actual: node.actual,
        selectedBorrow: node.selectedBorrow,
        coverageProbability: node.coverageProbability,
        breakdown: node.routeBreakdown?.breakdown || []
      })),
      actualCoverage,
      actualCoverageProbability: actualCoverage,
      actualSourceCount: actualNodes.length + (lineage.actualCoverage > 0 ? 1 : 0),
      selectedBorrowIds,
      alternativeSourceCount: scarcity.alternativeSourceCount,
      alternativeSourceQuality: scarcity.alternativeSourceQuality,
      factorabilityProxy: scarcity.factorabilityProxy,
      plannedLineageCredit: lineage.plannedLineageCredit,
      plannedLineage: lineage.entries,
      scarcityMultiplier: scarcity.scarcityMultiplier,
      marginalMultiplier: scarcity.marginalMultiplier,
      scarcity,
      formulaBreakdown: {
        coverage: 'noisy-or(selected source coverage plus verified planned lineage)',
        scarcity: scarcity.formulaBreakdown,
        randomAndUnknown: 'rankingProbability=0 and coverage=0'
      }
    };
  }

  return {
    MODEL_VERSION,
    ROUTE_TYPES,
    DEFAULT_HINT_BASELINE,
    DEFAULT_CONTINUOUS_PROBABILITY,
    MAX_DOMAIN_WEIGHT,
    DEFAULT_DOMAIN_WEIGHT,
    HINT_DISCOUNTS,
    clamp,
    normalizeTarget,
    isSortSentinel,
    routeDatasetStatus,
    routeRecords,
    classifySupportRoute,
    resolveHintEffects,
    calculateHintAcquisition,
    calculateHintMetrics: calculateHintAcquisition,
    mergeRoutes,
    noisyOr,
    skillTier,
    matchesTarget,
    targetMatchesSkill: matchesTarget,
    normalizeSourceCandidate,
    dedupeSourceGraph,
    dedupeSources: input => dedupeSourceGraph(input).nodes,
    buildSourceGraph,
    calculateScarcity,
    computeScarcity: calculateScarcity,
    calculateMarginalScarcity,
    resolvePlannedLineage,
    analyzeSkillAcquisition,
    evaluateAcquisition: analyzeSkillAcquisition,
    calculateAcquisition: analyzeSkillAcquisition
  };
});
