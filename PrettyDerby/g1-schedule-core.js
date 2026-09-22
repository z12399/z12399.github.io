(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.G1_SCHEDULE_CORE = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // The generator deliberately accepts only a complete, explicit aptitude
  // contract.  A card-style aptitude array uses the same first six positions
  // as data/gametora-data.json: turf, dirt, short, mile, medium, long.
  const APTITUDE_KEYS = Object.freeze([
    'turf', 'dirt', 'short', 'mile', 'medium', 'long'
  ]);
  const APTITUDE_ARRAY_KEYS = Object.freeze([
    ...APTITUDE_KEYS, 'runner', 'leader', 'betweener', 'chaser'
  ]);
  const APTITUDE_RANKS = Object.freeze(['G', 'F', 'E', 'D', 'C', 'B', 'A', 'S']);
  const RED_FACTOR_THRESHOLDS = Object.freeze([
    { stars: 0, bonus: 0 },
    { stars: 1, bonus: 1 },
    { stars: 4, bonus: 2 },
    { stars: 7, bonus: 3 },
    { stars: 10, bonus: 4 }
  ]);
  const RULESET = Object.freeze({
    id: 'zh_tw-2024-06-27',
    server: 'zh_tw',
    effectiveDate: '2024-06-27',
    confirmedOnly: true,
    canonicalRaceIdRequired: true,
    projectedScheduleScores: false
  });
  const REQUIREMENT_LEVELS = Object.freeze([
    'RULE_REQUIRED', 'USER_REQUIRED', 'RECOMMENDED', 'OPTIONAL'
  ]);

  // These are the curated local canonical candidates used for the factor-run
  // construction.  They are intentionally not inferred from race names or
  // from the current trainee's requested target.  The catalog still remains
  // the source of the actual name, surface, distance, and catalog ID.
  const CANONICAL_G1_IDS_BY_BUCKET = Object.freeze({
    'turf-mile': Object.freeze([1007, 1011, 1018]),
    'turf-medium': Object.freeze([1003, 1005, 1010, 1016, 1019]),
    'turf-long': Object.freeze([1006, 1015, 1023]),
    'dirt-mile': Object.freeze([1001, 1020, 1030, 1109, 1110]),
    'dirt-medium': Object.freeze([1101, 1102, 1105, 1106, 1107]),
    'dirt-long': Object.freeze([])
  });
  // A G1 foundation is not just a bag of races.  The three classic-year
  // windows force a choice between the Triple Tiara and the Classic Triple
  // Crown, so keep those route races outside the generic bucket list and
  // compare them as mutually exclusive packages.  This contract is advisory:
  // it never turns projected races into confirmed wins or an affinity score.
  const G1_FOUNDATION_ROUTE_DEFINITIONS = Object.freeze({
    triple_tiara: Object.freeze({
      id: 'triple_tiara',
      label: '牝馬三冠',
      canonicalRaceIds: Object.freeze([1004, 1009, 1014]),
      canonicalRaceIdsByBucket: Object.freeze({
        'turf-mile': Object.freeze([1004]),
        'turf-medium': Object.freeze([1009, 1014])
      }),
      requiredAxes: Object.freeze(['turf', 'mile', 'medium']),
      routeBuckets: Object.freeze(['turf-mile', 'turf-medium']),
      description: '櫻花賞／奧克斯／秋華賞；對英里＋中距離底座最直接。'
    }),
    classic_crown: Object.freeze({
      id: 'classic_crown',
      label: '經典三冠',
      canonicalRaceIds: Object.freeze([1005, 1010, 1015]),
      canonicalRaceIdsByBucket: Object.freeze({
        'turf-medium': Object.freeze([1005, 1010]),
        'turf-long': Object.freeze([1015])
      }),
      requiredAxes: Object.freeze(['turf', 'medium', 'long']),
      routeBuckets: Object.freeze(['turf-medium', 'turf-long']),
      description: '皋月賞／日本打比／菊花賞；適合中距離＋長距離底座。'
    })
  });
  const G1_FOUNDATION_COMMON_IDS_BY_BUCKET = Object.freeze({
    'turf-mile': Object.freeze([1007, 1011, 1018]),
    'turf-medium': Object.freeze([1003, 1016, 1019]),
    'turf-long': Object.freeze([1006, 1023]),
    'dirt-mile': Object.freeze([1001, 1020, 1030, 1109, 1110]),
    'dirt-medium': Object.freeze([1101, 1102, 1105, 1106, 1107]),
    'dirt-long': Object.freeze([])
  });
  const BUCKET_ORDER = Object.freeze([
    'turf-mile',
    'turf-medium',
    'turf-long',
    'dirt-mile',
    'dirt-medium',
    'dirt-long'
  ]);
  const EDGE_DEFINITIONS = Object.freeze([
    Object.freeze({ id: 'P1-P2', leftSlot: 'parentA', rightSlot: 'parentB' }),
    Object.freeze({ id: 'P1-GP11', leftSlot: 'parentA', rightSlot: 'parentA1' }),
    Object.freeze({ id: 'P1-GP12', leftSlot: 'parentA', rightSlot: 'parentA2' }),
    Object.freeze({ id: 'P2-GP21', leftSlot: 'parentB', rightSlot: 'parentB1' }),
    Object.freeze({ id: 'P2-GP22', leftSlot: 'parentB', rightSlot: 'parentB2' })
  ]);
  const SLOT_TO_STEP_ID = Object.freeze({
    parentA: 'parent:A',
    parentB: 'parent:B',
    parentA1: 'grandparent:parentA1',
    parentA2: 'grandparent:parentA2',
    parentB1: 'grandparent:parentB1',
    parentB2: 'grandparent:parentB2',
    target: 'target'
  });

  const SURFACE_LABELS = Object.freeze({ turf: '草地', dirt: '泥地' });
  const DISTANCE_LABELS = Object.freeze({
    short: '短距離',
    mile: '英里',
    medium: '中距離',
    long: '長距離'
  });
  const KEY_ALIASES = Object.freeze({
    turf: ['turf', 'grass', '芝', '草', '草地', 'ground1'],
    dirt: ['dirt', 'sand', '泥', '泥地', 'ダート', 'ground2'],
    short: ['short', 'sprint', '短', '短距', '短距離'],
    mile: ['mile', 'miles', '英里', '一哩', '一英里', 'マイル'],
    medium: ['medium', 'middle', '中', '中距', '中距離'],
    long: ['long', 'stayer', '長', '長距', '長距離']
  });

  function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object || {}, key);
  }

  function text(value, fallback = '') {
    const result = value === null || value === undefined ? '' : String(value).trim();
    return result || fallback;
  }

  function number(value, fallback = null) {
    if (value === null || value === undefined || value === '') return fallback;
    const result = Number(value);
    return Number.isFinite(result) ? result : fallback;
  }

  function requirementLevel(value, fallback = 'RECOMMENDED') {
    const normalized = text(value).toUpperCase();
    return REQUIREMENT_LEVELS.includes(normalized) ? normalized : fallback;
  }

  function strongestRequirementLevel(values, fallback = 'RECOMMENDED') {
    const priority = ['OPTIONAL', 'RECOMMENDED', 'USER_REQUIRED', 'RULE_REQUIRED'];
    return (values || [])
      .map(value => requirementLevel(value, fallback))
      .sort((left, right) => priority.indexOf(right) - priority.indexOf(left))[0]
      || fallback;
  }

  function integer(value, fallback = null) {
    const result = number(value, fallback);
    return Number.isInteger(result) ? result : fallback;
  }

  function clone(value) {
    if (Array.isArray(value)) return value.map(clone);
    if (isObject(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
    return value;
  }

  function normalizedToken(value) {
    return text(value)
      .normalize('NFKC')
      .toLocaleLowerCase()
      .replace(/[\s_\-./]+/g, '');
  }

  function canonicalAptitudeKey(value) {
    const token = normalizedToken(value);
    if (!token) return null;
    for (const key of APTITUDE_KEYS) {
      if (KEY_ALIASES[key].some(alias => normalizedToken(alias) === token)) return key;
    }
    return null;
  }

  function normalizeRank(value) {
    if (value === null || value === undefined || value === '') return null;
    if (Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) < APTITUDE_RANKS.length) {
      return APTITUDE_RANKS[Number(value)];
    }
    const rank = text(value).toUpperCase();
    return APTITUDE_RANKS.includes(rank) ? rank : null;
  }

  function rankIndex(value) {
    const rank = normalizeRank(value);
    const index = APTITUDE_RANKS.indexOf(rank);
    return index < 0 ? null : index;
  }

  function rankAt(index) {
    return Number.isInteger(index) && index >= 0 && index < APTITUDE_RANKS.length
      ? APTITUDE_RANKS[index]
      : null;
  }

  function redStartingBonus(stars) {
    const total = Math.max(0, number(stars, 0));
    let bonus = 0;
    for (const threshold of RED_FACTOR_THRESHOLDS) {
      if (total >= threshold.stars) bonus = threshold.bonus;
    }
    return bonus;
  }

  function surfaceFromValue(value) {
    if (Number(value) === 1) return 'turf';
    if (Number(value) === 2) return 'dirt';
    const token = normalizedToken(value);
    if (KEY_ALIASES.turf.some(alias => normalizedToken(alias) === token)) return 'turf';
    if (KEY_ALIASES.dirt.some(alias => normalizedToken(alias) === token)) return 'dirt';
    return null;
  }

  function distanceFromValue(value, distanceMeters = null) {
    if (Number(value) === 1) return 'short';
    if (Number(value) === 2) return 'mile';
    if (Number(value) === 3) return 'medium';
    if (Number(value) === 4) return 'long';
    const token = normalizedToken(value);
    for (const key of ['short', 'mile', 'medium', 'long']) {
      if (KEY_ALIASES[key].some(alias => normalizedToken(alias) === token)) return key;
    }
    const meters = number(distanceMeters);
    if (meters === null) return null;
    if (meters <= 1400) return 'short';
    if (meters <= 1800) return 'mile';
    if (meters <= 2400) return 'medium';
    return 'long';
  }

  function gradeIsG1(value) {
    const token = normalizedToken(value);
    return token === '100' || token === 'g1' || token === 'gi' || token === 'gⅠ';
  }

  function bucketKey(surface, distance) {
    return surface && distance ? `${surface}-${distance}` : null;
  }

  function splitBucket(bucket) {
    const [surface, distance] = text(bucket).split('-');
    return { surface: surface || null, distance: distance || null };
  }

  function canonicalG1IdsForBucket(bucket, foundationRouteId = '') {
    const route = G1_FOUNDATION_ROUTE_DEFINITIONS[text(foundationRouteId)];
    if (!route) return [...(CANONICAL_G1_IDS_BY_BUCKET[bucket] || [])];
    return uniqueNumbers([
      ...(G1_FOUNDATION_COMMON_IDS_BY_BUCKET[bucket] || []),
      ...(route.canonicalRaceIdsByBucket?.[bucket] || [])
    ]);
  }

  function aptitudeSource(source) {
    const candidates = [
      source?.aptitudes,
      source?.nativeAptitudes,
      source?.originalAptitudes,
      source?.aptitude,
      source?.card?.aptitudes,
      source?.card?.aptitude,
      source?.character?.aptitudes,
      source?.character?.aptitude,
      source?.metadata?.aptitudes,
      source?.metadata?.aptitude
    ];
    return candidates.find(value => value !== undefined && value !== null);
  }

  function aptitudeValueFromEntry(entry) {
    if (!isObject(entry)) return entry;
    return entry.rank
      ?? entry.value
      ?? entry.aptitude
      ?? entry.grade
      ?? entry.level
      ?? entry.valueRank;
  }

  function putAptitude(values, key, value) {
    const canonical = canonicalAptitudeKey(key);
    if (!canonical) return;
    const rank = normalizeRank(value);
    if (rank) values[canonical] = rank;
  }

  function readAptitudeMap(raw, values) {
    if (Array.isArray(raw)) {
      raw.forEach((entry, index) => {
        const key = isObject(entry)
          ? entry.key ?? entry.type ?? entry.name ?? entry.nameZhTw
          : APTITUDE_ARRAY_KEYS[index];
        putAptitude(values, key, aptitudeValueFromEntry(entry));
      });
      return true;
    }
    if (!isObject(raw)) return false;
    let readAny = false;
    Object.entries(raw).forEach(([key, value]) => {
      const canonical = canonicalAptitudeKey(key);
      if (canonical) {
        putAptitude(values, canonical, aptitudeValueFromEntry(value));
        readAny = true;
        return;
      }
      if (['surface', 'ground', 'groundAptitudes'].includes(normalizedToken(key)) && isObject(value)) {
        Object.entries(value).forEach(([nestedKey, nestedValue]) => putAptitude(values, nestedKey, aptitudeValueFromEntry(nestedValue)));
        readAny = true;
        return;
      }
      if (['distance', 'distanceAptitudes'].includes(normalizedToken(key)) && isObject(value)) {
        Object.entries(value).forEach(([nestedKey, nestedValue]) => putAptitude(values, nestedKey, aptitudeValueFromEntry(nestedValue)));
        readAny = true;
      }
    });
    return readAny;
  }

  function normalizeAptitudes(source) {
    const raw = aptitudeSource(source || {});
    const values = Object.fromEntries(APTITUDE_KEYS.map(key => [key, null]));
    const provided = raw !== undefined && raw !== null;
    const parsed = readAptitudeMap(raw, values);
    const missingKeys = APTITUDE_KEYS.filter(key => !values[key]);
    return {
      sourceType: Array.isArray(raw) ? 'card-aptitude-array' : (isObject(raw) ? 'normalized-map' : 'missing'),
      provided,
      parsed,
      complete: provided && parsed && missingKeys.length === 0,
      ranks: values,
      missingKeys
    };
  }

  function redSource(source, direction = 'outgoing') {
    const candidates = direction === 'incoming'
      ? [
        source?.incomingRedFactors,
        source?.incomingRedFactor,
        source?.incomingRedPlan,
        source?.incomingRedByKey,
        source?.factors?.incomingRed,
        source?.factors?.incomingRedFactors,
        source?.card?.incomingRedFactors
      ]
      : [
        source?.outgoingRedFactors,
        source?.outgoingRedFactor,
        source?.specifiedRedFactors,
        source?.specifiedRedFactor,
        // Legacy generic fields are outgoing-only compatibility aliases. They
        // are never read as incoming aptitude support.
        source?.redFactors,
        source?.redFactor,
        source?.factors?.red,
        source?.factors?.redFactors,
        source?.card?.redFactors
      ];
    return candidates.find(value => value !== undefined && value !== null);
  }

  function redEntries(raw) {
    if (raw === null || raw === undefined) return [];
    if (Array.isArray(raw)) return raw;
    if (!isObject(raw)) return [{ key: raw, stars: 0 }];
    if (raw.key !== undefined || raw.aptitudeKey !== undefined || raw.redFactorKey !== undefined || raw.type !== undefined) {
      return [raw];
    }
    if (Array.isArray(raw.factors)) return raw.factors;
    if (isObject(raw.factors)) return redEntries(raw.factors);
    if (Array.isArray(raw.values)) return raw.values;
    if (isObject(raw.byKey)) return redEntries(raw.byKey);
    return Object.entries(raw).map(([key, value]) => isObject(value)
      ? { ...value, key: value.key ?? key }
      : { key, stars: value });
  }

  function normalizeRedFactors(source, direction = 'outgoing') {
    const raw = redSource(source || {}, direction);
    const byKey = new Map();
    redEntries(raw).forEach((entry, index) => {
      const key = canonicalAptitudeKey(
        entry?.key
          ?? entry?.aptitudeKey
          ?? entry?.redFactorKey
          ?? entry?.type
          ?? entry?.nameZhTw
          ?? entry?.name
      );
      if (!key) return;
      const stars = Math.max(0, number(entry?.stars ?? entry?.star ?? entry?.level, 0));
      if (!byKey.has(key)) {
        byKey.set(key, {
          key,
          nameZhTw: text(entry?.nameZhTw ?? entry?.label ?? entry?.name, SURFACE_LABELS[key] || DISTANCE_LABELS[key] || key),
          requirementLevels: [],
          sources: new Map()
        });
      }
      const factor = byKey.get(key);
      if (entry?.requirementLevel) factor.requirementLevels.push(entry.requirementLevel);
      const sourceStepIds = [...new Set([
        ...(Array.isArray(entry?.sourceStepIds) ? entry.sourceStepIds : []),
        entry?.sourceStepId
      ].map(text).filter(Boolean))];
      const evidenceRecordId = text(entry?.evidenceRecordId ?? entry?.recordId);
      const sourceIdentity = sourceStepIds.length
        ? `steps:${sourceStepIds.slice().sort().join('|')}`
        : (evidenceRecordId ? `record:${evidenceRecordId}` : `row:${index}`);
      const source = factor.sources.get(sourceIdentity) || {
        stars: 0,
        recordedStars: 0,
        sourceStepIds: [],
        sourceIndexes: []
      };
      source.stars = Math.max(source.stars, stars);
      if (['USER_RECORDED', 'EVIDENCED'].includes(text(entry?.evidenceStatus).toUpperCase())) {
        source.recordedStars = Math.max(source.recordedStars, stars);
      }
      source.sourceStepIds = [...new Set([...source.sourceStepIds, ...sourceStepIds])];
      source.sourceIndexes.push(index);
      factor.sources.set(sourceIdentity, source);
    });
    const factors = [...byKey.values()].map(factor => {
      const sources = [...factor.sources.values()];
      const stars = sources.reduce((sum, source) => sum + source.stars, 0);
      const recordedStars = sources.reduce((sum, source) => sum + source.recordedStars, 0);
      const sourceStepIds = [...new Set(sources.flatMap(source => source.sourceStepIds))];
      return {
      key: factor.key,
      nameZhTw: factor.nameZhTw,
      stars,
      recordedStars,
      requirementLevel: strongestRequirementLevel(factor.requirementLevels, 'RECOMMENDED'),
      sourceIndexes: sources.flatMap(source => source.sourceIndexes),
      sourceStepIds,
      sourceStepId: sourceStepIds[0] || '',
      evidenceStatus: stars > 0 && recordedStars >= stars
        ? 'USER_RECORDED'
        : 'UNVERIFIED',
      startBonus: redStartingBonus(stars)
      };
    });
    return {
      provided: raw !== undefined && raw !== null,
      direction,
      factors,
      byKey: Object.fromEntries(factors.map(factor => [factor.key, factor]))
    };
  }

  function normalizeIncomingRedFactors(source) {
    return normalizeRedFactors(source, 'incoming');
  }

  function normalizeOutgoingRedFactors(source) {
    return normalizeRedFactors(source, 'outgoing');
  }

  function normalizeRequiredRanks(source, options = {}) {
    const defaultRank = normalizeRank(source?.defaultRequiredRank ?? options.defaultRequiredRank)
      || (options.strictAptitude === false ? 'C' : 'A');
    const values = Object.fromEntries(APTITUDE_KEYS.map(key => [key, defaultRank]));
    const raw = source?.raceAptitudeRequirements
      ?? source?.requestedAptitudes
      ?? source?.requiredAptitudes
      ?? source?.aptitudeRequirements;
    if (Array.isArray(raw)) {
      raw.forEach(entry => {
        const key = canonicalAptitudeKey(entry?.key ?? entry?.aptitudeKey ?? entry?.type ?? entry?.name);
        if (key) values[key] = normalizeRank(entry?.requiredRank ?? entry?.requestedRank ?? entry?.rank ?? entry?.value) || values[key];
      });
    } else if (isObject(raw)) {
      Object.entries(raw).forEach(([key, value]) => {
        const canonical = canonicalAptitudeKey(key);
        if (canonical) values[canonical] = normalizeRank(aptitudeValueFromEntry(value)) || values[canonical];
      });
    }
    const directRank = normalizeRank(source?.requiredRank ?? source?.aptitudeRequiredRank);
    if (directRank) APTITUDE_KEYS.forEach(key => { values[key] = directRank; });
    return values;
  }

  function normalizeRequiredRankLevels(source, options = {}) {
    const defaultLevel = requirementLevel(
      source?.defaultRequirementLevel ?? options.defaultRequirementLevel,
      options.strictAptitude === false ? 'RECOMMENDED' : 'RULE_REQUIRED'
    );
    const levels = Object.fromEntries(APTITUDE_KEYS.map(key => [key, defaultLevel]));
    const raw = source?.raceAptitudeRequirements
      ?? source?.requestedAptitudes
      ?? source?.requiredAptitudes
      ?? source?.aptitudeRequirements;
    if (Array.isArray(raw)) {
      raw.forEach(entry => {
        const key = canonicalAptitudeKey(entry?.key ?? entry?.aptitudeKey ?? entry?.type ?? entry?.name);
        if (key) levels[key] = requirementLevel(entry?.requirementLevel, 'RULE_REQUIRED');
      });
    } else if (isObject(raw)) {
      Object.entries(raw).forEach(([key, value]) => {
        const canonical = canonicalAptitudeKey(key);
        if (canonical) {
          levels[canonical] = isObject(value)
            ? requirementLevel(value.requirementLevel, 'RULE_REQUIRED')
            : 'RULE_REQUIRED';
        }
      });
    }
    const directRank = normalizeRank(source?.requiredRank ?? source?.aptitudeRequiredRank);
    if (directRank) APTITUDE_KEYS.forEach(key => { levels[key] = 'RULE_REQUIRED'; });
    return levels;
  }

  function normalizeCandidate(raw, index = 0, options = {}) {
    const source = isObject(raw) ? raw : {};
    const aptitudes = normalizeAptitudes(source);
    const incomingRed = normalizeRedFactors(source, 'incoming');
    const outgoingRed = normalizeRedFactors(source, 'outgoing');
    const incomingRedFactors = incomingRed.factors.map(factor => ({ ...factor }));
    const outgoingRedFactors = outgoingRed.factors.map(factor => ({ ...factor }));
    const stepId = text(source.stepId ?? source.lineageStepId ?? source.overrideKey);
    const slot = text(source.slot ?? source.lineageSlot ?? source.parentSlot);
    return {
      id: text(source.id ?? source.candidateId, `candidate-${index + 1}`),
      slot: slot || null,
      stepId: stepId || null,
      nameZhTw: text(source.nameZhTw ?? source.name ?? source.card?.nameZhTw, `候選 ${index + 1}`),
      nameJp: text(source.nameJp ?? source.card?.nameJp),
      outfitId: number(source.outfitId ?? source.cardId ?? source.card?.id),
      characterId: number(source.characterId ?? source.card?.characterId),
      affinityKey: text(source.affinityKey ?? source.nameJp),
      aptitudeInput: aptitudes,
      aptitudes: { ...aptitudes.ranks },
      requiredRanks: normalizeRequiredRanks(source, options),
      requiredRankLevels: normalizeRequiredRankLevels(source, options),
      // These two maps are intentionally separate. Incoming factors can make
      // this candidate's projected race plan red-dependent; outgoing factors
      // are only the factors this candidate is meant to leave for descendants.
      incomingRedFactors,
      incomingRedByKey: Object.fromEntries(incomingRedFactors.map(factor => [factor.key, { ...factor }])),
      outgoingRedByKey: Object.fromEntries(outgoingRedFactors.map(factor => [factor.key, { ...factor }])),
      // Keep the legacy aliases for consumers that only display a generic red
      // factor, but do not use them for aptitude eligibility below.
      red: outgoingRedFactors.map(factor => ({ ...factor })),
      redByKey: Object.fromEntries(outgoingRedFactors.map(factor => [factor.key, { ...factor }])),
      outgoingRedFactors,
      outgoingRedFactor: outgoingRedFactors[0] ? { ...outgoingRedFactors[0] } : null,
      automationMode: source.automationMode ?? options.automationMode ?? null,
      sourceHasScheduleInput: source.projectedG1Schedule !== undefined
        || source.g1Schedule !== undefined
        || source.g1Wins !== undefined
        || source.confirmedG1Wins !== undefined,
      source
    };
  }

  function catalogRows(input) {
    if (Array.isArray(input)) return input;
    if (!isObject(input)) return [];
    if (Array.isArray(input.races)) return input.races;
    if (Array.isArray(input.catalog)) return input.catalog;
    if (Array.isArray(input.entries)) return input.entries;
    return [];
  }

  function normalizeCatalogRace(raw, options = {}) {
    if (!isObject(raw)) return null;
    const catalogRaceId = number(raw.catalogRaceId ?? raw.catalogId ?? raw.id);
    const canonicalRaceId = number(raw.canonicalRaceId ?? raw.raceId ?? raw.baseRaceId);
    const distanceMeters = number(raw.distance ?? raw.distanceMeters ?? raw.courseDistance);
    const surface = surfaceFromValue(raw.surface ?? raw.ground ?? raw.groundType);
    const distance = distanceFromValue(raw.distanceType ?? raw.distanceCategory ?? raw.distanceBucket, distanceMeters);
    if (catalogRaceId === null || canonicalRaceId === null) return null;
    return {
      catalogRaceId,
      catalogId: catalogRaceId,
      canonicalRaceId,
      raceId: canonicalRaceId,
      nameZhTw: text(raw.nameZhTw ?? raw.name ?? raw.name_tw),
      nameJp: text(raw.nameJp ?? raw.name_jp),
      nameEn: text(raw.nameEn ?? raw.name_en),
      urlName: text(raw.urlName ?? raw.url_name),
      grade: raw.grade ?? raw.raceGrade ?? raw.rank,
      surface,
      groundType: number(raw.groundType),
      distance: distanceMeters,
      distanceMeters,
      distanceType: distance,
      distanceBucket: distance,
      server: text(raw.server ?? raw.serverId, options.server ?? RULESET.server),
      raw
    };
  }

  function buildCatalogIndex(input, options = {}) {
    const byCanonical = new Map();
    const sourceRows = catalogRows(input);
    const normalized = sourceRows.map(row => normalizeCatalogRace(row, options)).filter(Boolean);
    normalized.forEach(entry => {
      if (!byCanonical.has(String(entry.canonicalRaceId))) byCanonical.set(String(entry.canonicalRaceId), []);
      byCanonical.get(String(entry.canonicalRaceId)).push(entry);
    });
    return {
      sourceCount: sourceRows.length,
      normalizedCount: normalized.length,
      g1Count: normalized.filter(entry => gradeIsG1(entry.grade)).length,
      byCanonical,
      entries: normalized
    };
  }

  function uniqueNumbers(values) {
    return [...new Set((values || []).map(number).filter(Number.isFinite))];
  }

  function canonicalCatalogRows(catalogIndex, canonicalRaceIds) {
    return uniqueNumbers(canonicalRaceIds).map(canonicalRaceId => {
      const rows = (catalogIndex.byCanonical.get(String(canonicalRaceId)) || [])
        .filter(entry => gradeIsG1(entry.grade));
      const row = rows[0] || null;
      return {
        canonicalRaceId,
        catalogRaceId: row?.catalogRaceId ?? null,
        nameZhTw: row?.nameZhTw || row?.nameJp || `GⅠ ${canonicalRaceId}`,
        nameJp: row?.nameJp || '',
        surface: row?.surface || null,
        distanceType: row?.distanceType || null,
        distanceMeters: row?.distanceMeters ?? null,
        status: row ? 'CATALOG_MATCHED' : 'CATALOG_MISSING',
        scoreIncluded: false
      };
    });
  }

  function goalScheduleRows(goalSchedule) {
    if (Array.isArray(goalSchedule)) return goalSchedule;
    if (!isObject(goalSchedule)) return [];
    if (Array.isArray(goalSchedule.goals)) return goalSchedule.goals;
    if (Array.isArray(goalSchedule.goalRaces)) return goalSchedule.goalRaces;
    return [];
  }

  function resolveGoalScheduleCanonicalIds(goalSchedule, catalogIndex) {
    const resolved = [];
    const unresolved = [];
    goalScheduleRows(goalSchedule)
      .filter(row => gradeIsG1(row?.grade ?? row?.raceGrade ?? row?.rank))
      .forEach(row => {
        let canonicalRaceId = number(row?.canonicalRaceId ?? row?.raceId ?? row?.baseRaceId);
        const catalogRaceId = number(row?.catalogRaceId ?? row?.catalogId);
        if (canonicalRaceId === null && catalogRaceId !== null) {
          canonicalRaceId = catalogIndex.entries
            .find(entry => entry.catalogRaceId === catalogRaceId)?.canonicalRaceId ?? null;
        }
        if (canonicalRaceId === null) {
          const nameTokens = [row?.nameZhTw, row?.nameJp, row?.name]
            .map(normalizedToken).filter(Boolean);
          const surface = surfaceFromValue(row?.surface ?? row?.ground ?? row?.groundType);
          const distanceMeters = number(row?.distance ?? row?.distanceMeters);
          const distanceType = distanceFromValue(row?.distanceType, distanceMeters);
          const matches = catalogIndex.entries.filter(entry => {
            if (!gradeIsG1(entry.grade)) return false;
            if (surface && entry.surface !== surface) return false;
            if (distanceType && entry.distanceType !== distanceType) return false;
            if (distanceMeters !== null && entry.distanceMeters !== distanceMeters) return false;
            const entryTokens = [entry.nameZhTw, entry.nameJp, entry.raw?.name]
              .map(normalizedToken).filter(Boolean);
            return nameTokens.some(token => entryTokens.includes(token));
          });
          const canonicalMatches = uniqueNumbers(matches.map(entry => entry.canonicalRaceId));
          if (canonicalMatches.length === 1) canonicalRaceId = canonicalMatches[0];
        }
        if (canonicalRaceId === null) {
          unresolved.push({
            nameZhTw: text(row?.nameZhTw ?? row?.name),
            nameJp: text(row?.nameJp),
            turn: number(row?.turn),
            mappingStatus: text(row?.mappingStatus, 'UNRESOLVED'),
            scoreIncluded: false
          });
          return;
        }
        resolved.push(canonicalRaceId);
      });
    return {
      canonicalRaceIds: uniqueNumbers(resolved),
      unresolved,
      evidenceStatus: unresolved.length ? 'PARTLY_RESOLVED' : 'RESOLVED_FROM_EXPLICIT_OR_UNIQUE_CATALOG_IDENTITY',
      scoreIncluded: false
    };
  }

  function routeGoalNameMatches(goalSchedule, routeRaces) {
    const matches = [];
    goalScheduleRows(goalSchedule)
      .filter(row => gradeIsG1(row?.grade ?? row?.raceGrade ?? row?.rank))
      .forEach(goal => {
        const goalTokens = [goal?.nameZhTw, goal?.nameJp, goal?.name]
          .map(normalizedToken).filter(Boolean);
        if (!goalTokens.length) return;
        const goalSurface = surfaceFromValue(goal?.surface ?? goal?.ground ?? goal?.groundType);
        const goalDistance = number(goal?.distance ?? goal?.distanceMeters);
        const matched = (routeRaces || []).find(race => {
          if (race.status !== 'CATALOG_MATCHED') return false;
          if (goalSurface && race.surface !== goalSurface) return false;
          if (goalDistance !== null && race.distanceMeters !== goalDistance) return false;
          const raceTokens = [race.nameZhTw, race.nameJp].map(normalizedToken).filter(Boolean);
          return goalTokens.some(token => raceTokens.includes(token));
        });
        if (!matched) return;
        matches.push({
          canonicalRaceId: matched.canonicalRaceId,
          nameZhTw: matched.nameZhTw,
          goalNameZhTw: text(goal?.nameZhTw ?? goal?.name),
          goalNameJp: text(goal?.nameJp),
          turn: number(goal?.turn),
          evidenceStatus: 'COMMUNITY_ROUTE_NAME_DISTANCE_SURFACE_MATCH',
          canonicalIdentityStatus: 'UNRESOLVED_FOR_CONFIRMED_G1',
          scoreIncluded: false
        });
      });
    return [...new Map(matches.map(row => [String(row.canonicalRaceId), row])).values()];
  }

  function foundationAxisAssessment(candidate, key) {
    const plan = dimensionPlan(candidate, key);
    const nativeIndex = rankIndex(plan.nativeRank);
    const requiredIndex = rankIndex(plan.requiredRank);
    const maximumEffectiveIndex = nativeIndex === null
      ? null
      : Math.min(rankIndex('A'), nativeIndex + redStartingBonus(10));
    const redCanReach = nativeIndex !== null
      && requiredIndex !== null
      && maximumEffectiveIndex >= requiredIndex;
    return {
      key,
      label: plan.label,
      nativeRank: plan.nativeRank,
      requiredRank: plan.requiredRank,
      nativeReady: plan.nativeEligible,
      redCanReach,
      requiredIncomingRedStars: plan.nativeEligible ? 0 : plan.requiredIncomingRedStars,
      status: plan.nativeEligible
        ? 'NATIVE_READY'
        : (redCanReach ? 'RED_FACTOR_OPTION' : 'APTITUDE_UNPROVEN')
    };
  }

  function candidateBaseAffinityEvidence(source) {
    const selection = source?.selectionBasis || {};
    const rows = [
      ['baseAffinity', source?.baseAffinity],
      ['childAffinity', selection.childAffinity],
      ['parentAffinity', selection.parentAffinity],
      ['targetAffinity', selection.targetAffinity]
    ].map(([key, value]) => ({ key, value: number(value) }))
      .filter(row => row.value !== null);
    return {
      status: rows.length ? 'AVAILABLE_SEPARATE_SIGNAL' : 'UNVERIFIED',
      rows,
      scoreIncluded: false,
      note: '基礎相性與共同 GⅠ 是兩條獨立證據；本裁決不把兩者壓成一個不透明總分。'
    };
  }

  function compareVectors(left, right) {
    const length = Math.max(left.length, right.length);
    for (let index = 0; index < length; index += 1) {
      const difference = number(left[index], 0) - number(right[index], 0);
      if (difference !== 0) return difference;
    }
    return 0;
  }

  function evaluateG1FoundationRoutes(input = {}) {
    const candidateSource = input.candidate ?? input.card ?? input;
    const catalogInput = input.raceCatalog ?? input.catalog ?? input.g1RaceCatalog;
    const scheduleOptions = {
      server: text(input.server, RULESET.server),
      ruleset: text(input.ruleset ?? input.rulesetId, RULESET.id),
      strictAptitude: false,
      defaultRequiredRank: normalizeRank(input.routeRequiredRank) || 'C',
      defaultRequirementLevel: 'RECOMMENDED'
    };
    const catalogIndex = buildCatalogIndex(catalogInput, scheduleOptions);
    const candidate = normalizeCandidate({
      ...(isObject(candidateSource) ? candidateSource : {}),
      requiredRank: scheduleOptions.defaultRequiredRank
    }, 0, scheduleOptions);
    const desiredBuckets = [...new Set((input.desiredBuckets || ['turf-mile', 'turf-medium'])
      .map(text).filter(bucket => BUCKET_ORDER.includes(bucket)))];
    const goalEvidence = resolveGoalScheduleCanonicalIds(
      input.goalSchedule ?? candidateSource?.goalSchedule,
      catalogIndex
    );
    const goalIds = new Set(goalEvidence.canonicalRaceIds.map(String));
    const sharedIds = new Set(uniqueNumbers(
      input.sharedCanonicalRaceIds ?? input.sharedG1CanonicalRaceIds
    ).map(String));
    const prefersTiara = desiredBuckets.includes('turf-mile') && desiredBuckets.includes('turf-medium');
    const prefersClassic = desiredBuckets.includes('turf-long') && desiredBuckets.includes('turf-medium');
    const routeRows = Object.values(G1_FOUNDATION_ROUTE_DEFINITIONS).map(definition => {
      const opposingDefinitions = Object.values(G1_FOUNDATION_ROUTE_DEFINITIONS)
        .filter(item => item.id !== definition.id)
      const opposingIds = opposingDefinitions.flatMap(item => item.canonicalRaceIds);
      const races = canonicalCatalogRows(catalogIndex, definition.canonicalRaceIds);
      const opposingRaces = opposingDefinitions
        .flatMap(item => canonicalCatalogRows(catalogIndex, item.canonicalRaceIds));
      const axes = definition.requiredAxes.map(key => foundationAxisAssessment(candidate, key));
      const requiredRedAxes = axes.filter(axis => axis.status === 'RED_FACTOR_OPTION');
      const unprovenAxes = axes.filter(axis => axis.status === 'APTITUDE_UNPROVEN');
      const builtInGoalNameMatches = routeGoalNameMatches(
        input.goalSchedule ?? candidateSource?.goalSchedule,
        races
      );
      const opposingGoalNameMatches = routeGoalNameMatches(
        input.goalSchedule ?? candidateSource?.goalSchedule,
        opposingRaces
      );
      const builtInGoalMatches = uniqueNumbers([
        ...definition.canonicalRaceIds.filter(id => goalIds.has(String(id))),
        ...builtInGoalNameMatches.map(row => row.canonicalRaceId)
      ]);
      const opposingGoalMatches = uniqueNumbers([
        ...opposingIds.filter(id => goalIds.has(String(id))),
        ...opposingGoalNameMatches.map(row => row.canonicalRaceId)
      ]);
      const sharedMatches = definition.canonicalRaceIds.filter(id => sharedIds.has(String(id)));
      const commonCanonicalRaceIds = uniqueNumbers(desiredBuckets
        .flatMap(bucket => G1_FOUNDATION_COMMON_IDS_BY_BUCKET[bucket] || []));
      const missingCatalogRaceIds = races
        .filter(row => row.status !== 'CATALOG_MATCHED')
        .map(row => row.canonicalRaceId);
      const preferencePenalty = definition.id === 'triple_tiara'
        ? (prefersTiara ? 0 : 1)
        : (prefersClassic ? 0 : 1);
      const comparisonVector = [
        missingCatalogRaceIds.length,
        unprovenAxes.length,
        requiredRedAxes.reduce((sum, axis) => sum + axis.requiredIncomingRedStars, 0),
        opposingGoalMatches.length,
        -builtInGoalMatches.length,
        -sharedMatches.length,
        preferencePenalty
      ];
      return {
        id: definition.id,
        label: definition.label,
        description: definition.description,
        status: missingCatalogRaceIds.length || !candidate.aptitudeInput.complete
          ? 'NEEDS_EVIDENCE'
          : (unprovenAxes.length
            ? 'APTITUDE_UNPROVEN'
            : (requiredRedAxes.length ? 'RED_FACTOR_OPTION' : 'NATIVE_READY')),
        races,
        canonicalRaceIds: [...definition.canonicalRaceIds],
        commonCanonicalRaceIds,
        foundationCanonicalRaceIds: uniqueNumbers([...commonCanonicalRaceIds, ...definition.canonicalRaceIds]),
        axes,
        requiredRedAxes,
        unprovenAxes,
        builtInGoalMatches,
        builtInGoalNameMatches,
        opposingGoalMatches,
        opposingGoalNameMatches,
        sharedMatches,
        missingCatalogRaceIds,
        comparisonVector,
        comparisonOrder: [
          '賽事資料缺口較少',
          '無法證明的適性較少',
          '所需紅因子星數較少',
          '相衝的固定目標賽較少',
          '本路線固定目標賽較多',
          '已知共同 GⅠ 對齊較多',
          '目標 bucket 偏好'
        ],
        scoreIncluded: false,
        probabilityStatus: 'NOT_COMPUTED'
      };
    }).sort((left, right) => compareVectors(left.comparisonVector, right.comparisonVector));

    const dirtRaceIds = uniqueNumbers([
      ...(G1_FOUNDATION_COMMON_IDS_BY_BUCKET['dirt-mile'] || []),
      ...(G1_FOUNDATION_COMMON_IDS_BY_BUCKET['dirt-medium'] || [])
    ]);
    const dirtRaces = canonicalCatalogRows(catalogIndex, dirtRaceIds);
    const dirtAxes = ['dirt', 'mile', 'medium'].map(key => foundationAxisAssessment(candidate, key));
    const dirtRequiredRedAxes = dirtAxes.filter(axis => axis.status === 'RED_FACTOR_OPTION');
    const dirtUnprovenAxes = dirtAxes.filter(axis => axis.status === 'APTITUDE_UNPROVEN');
    const dirtGoalMatches = dirtRaceIds.filter(id => goalIds.has(String(id)));
    const dirtSharedMatches = dirtRaceIds.filter(id => sharedIds.has(String(id)));
    const dirtSignal = dirtGoalMatches.length > 0 || dirtSharedMatches.length > 0;
    const dirtStatus = !catalogIndex.g1Count || !candidate.aptitudeInput.complete
      ? 'NEEDS_EVIDENCE'
      : dirtUnprovenAxes.length
        ? 'NOT_RECOMMENDED'
        : dirtSignal
          ? (dirtRequiredRedAxes.length ? 'RECOMMENDED_RED_FACTOR_OPTION' : 'RECOMMENDED_NATIVE')
          : dirtRequiredRedAxes.length
            ? 'NOT_RECOMMENDED_NO_SHARED_G1'
            : 'AVAILABLE_NOT_NEEDED';
    const dirtDecision = {
      status: dirtStatus,
      races: dirtRaces,
      canonicalRaceIds: dirtRaceIds,
      axes: dirtAxes,
      requiredRedAxes: dirtRequiredRedAxes,
      unprovenAxes: dirtUnprovenAxes,
      builtInGoalMatches: dirtGoalMatches,
      sharedMatches: dirtSharedMatches,
      reason: dirtSignal
        ? '已有固定目標賽或共同泥地 GⅠ 證據，才值得評估補泥地。'
        : '沒有固定目標賽或共同泥地 GⅠ 證據；不為了賽事數量單獨花紅因子補泥地。',
      scoreIncluded: false,
      probabilityStatus: 'NOT_COMPUTED'
    };
    const warnings = [];
    if (!catalogIndex.g1Count) warnings.push({
      code: 'G1_CATALOG_REQUIRED',
      message: '缺少可核對的 GⅠ catalog；不用賽名自行補造路線。'
    });
    if (!candidate.aptitudeInput.complete) warnings.push({
      code: 'APTITUDE_INPUT_INCOMPLETE',
      message: '缺少完整六軸適性；不宣稱三冠或泥地路線可執行。'
    });
    if (goalEvidence.unresolved.length) warnings.push({
      code: 'GOAL_G1_IDENTITY_UNRESOLVED',
      message: '部分固定 GⅠ 目標賽無法唯一對應 canonical race；不當成路線命中。'
    });
    return {
      schemaVersion: 1,
      status: warnings.some(item => item.code === 'G1_CATALOG_REQUIRED' || item.code === 'APTITUDE_INPUT_INCOMPLETE')
        ? 'NEEDS_EVIDENCE'
        : 'READY',
      candidateId: candidate.id,
      candidateNameZhTw: candidate.nameZhTw,
      desiredBuckets,
      requiredRank: scheduleOptions.defaultRequiredRank,
      recommendedRoute: routeRows[0] || null,
      alternatives: routeRows.slice(1),
      routes: Object.fromEntries(routeRows.map(route => [route.id, route])),
      dirtDecision,
      goalEvidence,
      baseAffinityEvidence: candidateBaseAffinityEvidence(candidateSource),
      ruleset: { ...RULESET, id: scheduleOptions.ruleset, server: scheduleOptions.server },
      warnings,
      scoreIncluded: false,
      probabilityStatus: 'NOT_COMPUTED',
      evidencePolicy: {
        routeUse: 'G1_FOUNDATION_PLANNING_ONLY',
        fixedGoals: 'COMMUNITY_TOOL_OBSERVED',
        sharedG1: 'USER_RECORDED_OR_EXPLICIT_ONLY',
        baseAffinity: 'SEPARATE_SIGNAL',
        confirmedWins: false
      }
    };
  }

  function planLineageG1Foundation(input = {}) {
    const candidates = Array.isArray(input.candidates) ? input.candidates.filter(Boolean) : [];
    const catalogInput = input.raceCatalog ?? input.catalog ?? input.g1RaceCatalog;
    const catalogIndex = buildCatalogIndex(catalogInput, input);
    const explicitSharedIds = uniqueNumbers(
      input.sharedCanonicalRaceIds ?? input.sharedG1CanonicalRaceIds
    );
    const goalEvidenceByCandidate = candidates.map(candidate => ({
      candidate,
      evidence: resolveGoalScheduleCanonicalIds(candidate.goalSchedule, catalogIndex)
    }));
    const goalFrequency = new Map();
    goalEvidenceByCandidate.forEach(item => item.evidence.canonicalRaceIds.forEach(id => {
      goalFrequency.set(id, (goalFrequency.get(id) || 0) + 1);
    }));
    const observedSharedIds = [...goalFrequency.entries()]
      .filter(([, count]) => count >= 2)
      .map(([id]) => id);
    const sharedCanonicalRaceIds = uniqueNumbers([...explicitSharedIds, ...observedSharedIds]);
    const candidatePlans = candidates.map(candidate => evaluateG1FoundationRoutes({
      ...input,
      candidate,
      goalSchedule: candidate.goalSchedule,
      raceCatalog: catalogInput,
      sharedCanonicalRaceIds
    }));
    const preferredRouteId = input.preferredRouteId === 'classic_crown'
      ? 'classic_crown'
      : 'triple_tiara';
    const routeComparisons = Object.values(G1_FOUNDATION_ROUTE_DEFINITIONS).map(definition => {
      const rows = candidatePlans.map(plan => plan.routes[definition.id]).filter(Boolean);
      const missingCatalogRaceCount = rows.reduce(
        (sum, row) => sum + (row.missingCatalogRaceIds || []).length,
        0
      );
      const fixedGoalConflictCount = rows.reduce((sum, row) => sum + row.opposingGoalMatches.length, 0);
      const alignedCandidateCount = rows.filter(row => row.builtInGoalMatches.length > 0).length;
      const builtInGoalMatchCount = rows.reduce((sum, row) => sum + row.builtInGoalMatches.length, 0);
      const sharedMatchCount = rows.reduce((sum, row) => sum + row.sharedMatches.length, 0);
      const unprovenAxisCount = rows.reduce((sum, row) => sum + row.unprovenAxes.length, 0);
      const redStarCost = rows.reduce((sum, row) => sum + row.requiredRedAxes
        .reduce((axisSum, axis) => axisSum + axis.requiredIncomingRedStars, 0), 0);
      const comparisonVector = [
        missingCatalogRaceCount,
        unprovenAxisCount,
        redStarCost,
        fixedGoalConflictCount,
        -alignedCandidateCount,
        -builtInGoalMatchCount,
        -sharedMatchCount,
        definition.id === preferredRouteId ? 0 : 1
      ];
      return {
        id: definition.id,
        label: definition.label,
        races: canonicalCatalogRows(catalogIndex, definition.canonicalRaceIds),
        canonicalRaceIds: [...definition.canonicalRaceIds],
        missingCatalogRaceCount,
        fixedGoalConflictCount,
        alignedCandidateCount,
        builtInGoalMatchCount,
        sharedMatchCount,
        unprovenAxisCount,
        redStarCost,
        comparisonVector,
        scoreIncluded: false
      };
    }).sort((left, right) => compareVectors(left.comparisonVector, right.comparisonVector));
    return {
      schemaVersion: 1,
      status: !catalogIndex.g1Count || !candidates.length ? 'NEEDS_EVIDENCE' : 'READY',
      recommendedRoute: routeComparisons[0] || null,
      alternatives: routeComparisons.slice(1),
      candidatePlans,
      sharedCanonicalRaceIds,
      sharedRaceEvidence: canonicalCatalogRows(catalogIndex, sharedCanonicalRaceIds),
      baseAffinityEvidence: candidatePlans.map(plan => ({
        candidateId: plan.candidateId,
        candidateNameZhTw: plan.candidateNameZhTw,
        ...plan.baseAffinityEvidence
      })),
      comparisonOrder: [
        '賽事資料缺口較少',
        '未證明適性較少',
        '額外紅因子星數成本較低',
        '固定目標賽衝突較少',
        '有對齊固定目標賽的馬較多',
        '固定目標賽命中數較多',
        '共同 GⅠ 對齊較多',
        '目標路線偏好'
      ],
      scoreIncluded: false,
      probabilityStatus: 'NOT_COMPUTED',
      assumptions: {
        routesAreExclusive: true,
        baseAffinitySeparate: true,
        projectedWinsConfirmed: false,
        dirtIsConditional: true
      }
    };
  }

  function raceRow(entry, bucket, eligibilityStatus, aptitudeRequirements, options = {}) {
    const { surface, distance } = splitBucket(bucket);
    return {
      id: entry.catalogRaceId,
      catalogId: entry.catalogRaceId,
      catalogRaceId: entry.catalogRaceId,
      raceId: entry.canonicalRaceId,
      canonicalRaceId: entry.canonicalRaceId,
      nameZhTw: entry.nameZhTw,
      nameJp: entry.nameJp,
      nameEn: entry.nameEn,
      urlName: entry.urlName,
      grade: 100,
      gradeLabel: 'G1',
      surface,
      groundType: entry.groundType,
      distance: entry.distance,
      distanceMeters: entry.distanceMeters,
      distanceType: distance,
      distanceBucket: bucket,
      server: options.server ?? RULESET.server,
      ruleset: options.ruleset ?? RULESET.id,
      outcomeStatus: 'SCHEDULED',
      status: 'PROJECTED',
      projected: true,
      verificationStatus: 'PROJECTED',
      scoreIncluded: false,
      eligibilityStatus,
      eligibilityEvidence: 'APTITUDE_PROJECTION_ONLY',
      confirmationPolicy: 'WIN_ONLY',
      requirementLevel: requirementLevel(options.projectedG1RequirementLevel, 'RECOMMENDED'),
      aptitudeRequirements: clone(aptitudeRequirements),
      source: 'gametora-catalog'
    };
  }

  function minimumIncomingRedStars(nativeIndex, requiredIndex) {
    if (nativeIndex === null || requiredIndex === null || nativeIndex >= requiredIndex) return 0;
    for (const threshold of RED_FACTOR_THRESHOLDS) {
      const effectiveIndex = Math.min(rankIndex('A'), nativeIndex + threshold.bonus);
      if (effectiveIndex >= requiredIndex) return threshold.stars;
    }
    // Ten stars is the maximum explicit input contract we can request. If the
    // native rank is still below the requested rank after that cap, the result
    // remains unverified rather than being treated as native eligibility.
    return RED_FACTOR_THRESHOLDS.at(-1).stars;
  }

  function dimensionPlan(candidate, key) {
    const nativeRank = candidate.aptitudeInput.ranks[key];
    const nativeIndex = rankIndex(nativeRank);
    const requiredRank = candidate.requiredRanks[key] || 'A';
    const requiredIndex = rankIndex(requiredRank);
    const factor = candidate.incomingRedByKey[key] || {
      key,
      nameZhTw: SURFACE_LABELS[key] || DISTANCE_LABELS[key] || key,
      stars: 0,
      startBonus: 0
    };
    const incomingStars = Math.max(0, number(factor.stars, 0));
    const effectiveIndex = nativeIndex === null
      ? null
      : Math.min(rankIndex('A'), nativeIndex + redStartingBonus(incomingStars));
    const nativeEligible = nativeIndex !== null && requiredIndex !== null && nativeIndex >= requiredIndex;
    const redEligibleByRank = effectiveIndex !== null && requiredIndex !== null && effectiveIndex >= requiredIndex;
    const requiredStars = minimumIncomingRedStars(nativeIndex, requiredIndex);
    const hasIncomingSupport = incomingStars > 0;
    // A maximal 10-star incoming contract is still explicitly marked
    // unverified when the numeric start rank cannot prove A. It may be listed
    // as red-dependent, but it is never silently promoted to native/runnable.
    const maxStarContract = hasIncomingSupport
      && incomingStars >= RED_FACTOR_THRESHOLDS.at(-1).stars;
    const incomingRedEligible = !nativeEligible
      && hasIncomingSupport
      && (redEligibleByRank || maxStarContract);
    const redEligible = nativeEligible || incomingRedEligible;
    const redFactorRequired = incomingRedEligible;
    const redFactorRequiredUnsatisfied = !nativeEligible && !incomingRedEligible;
    return {
      key,
      label: SURFACE_LABELS[key] || DISTANCE_LABELS[key] || key,
      requiredRank,
      requirementLevel: requirementLevel(candidate.requiredRankLevels?.[key], 'RECOMMENDED'),
      nativeRank,
      effectiveRankWithSpecifiedRed: rankAt(effectiveIndex),
      incomingRedFactorStars: incomingStars,
      redFactorStars: incomingStars,
      redFactorStartBonus: redStartingBonus(incomingStars),
      requiredIncomingRedStars: requiredStars,
      incomingRedProvided: hasIncomingSupport,
      incomingRedEligibilityBasis: maxStarContract && !redEligibleByRank
        ? 'MAX_STAR_INCOMING_UNVERIFIED'
        : (redEligibleByRank ? 'START_RANK_PROJECTION' : 'NONE'),
      nativeEligible,
      redEligible,
      redFactorRequired,
      redFactorRequiredUnsatisfied,
      status: !nativeRank
        ? 'MISSING_APTITUDE'
        : (nativeEligible
          ? 'NATIVE_APTITUDE_ELIGIBLE'
          : (redFactorRequired ? 'RED_FACTOR_DEPENDENT' : 'RED_FACTOR_REQUIRED_UNSATISFIED'))
    };
  }

  function bucketRequirement(candidate, bucket, surfacePlan, distancePlan, eligibilityStatus) {
    return {
      bucket,
      surface: surfacePlan.key,
      distanceType: distancePlan.key,
      surfaceRank: surfacePlan.nativeRank,
      distanceRank: distancePlan.nativeRank,
      surfaceEffectiveRank: surfacePlan.effectiveRankWithSpecifiedRed,
      distanceEffectiveRank: distancePlan.effectiveRankWithSpecifiedRed,
      requiredRank: surfacePlan.requiredRank,
      requirementLevel: strongestRequirementLevel([
        surfacePlan.requirementLevel,
        distancePlan.requirementLevel
      ]),
      nativeEligible: surfacePlan.nativeEligible && distancePlan.nativeEligible,
      redFactorEligible: surfacePlan.redEligible && distancePlan.redEligible,
      redFactorRequired: surfacePlan.redFactorRequired || distancePlan.redFactorRequired,
      redFactorRequiredUnsatisfied: surfacePlan.redFactorRequiredUnsatisfied || distancePlan.redFactorRequiredUnsatisfied,
      eligibilityStatus,
      requiredFactors: [surfacePlan, distancePlan]
        .filter(item => item.redFactorRequired)
        .map(item => item.key),
      unsatisfiedFactors: [surfacePlan, distancePlan]
        .filter(item => item.redFactorRequiredUnsatisfied)
        .map(item => item.key)
    };
  }

  function addWarning(warnings, warning) {
    const key = [warning.code, warning.candidateId, warning.bucket, warning.stepId].join('|');
    if (!warnings.some(item => [item.code, item.candidateId, item.bucket, item.stepId].join('|') === key)) {
      warnings.push(warning);
    }
  }

  function candidateSchedule(candidate, catalogIndex, options = {}) {
    const warnings = [];
    const bucketPlans = [];
    const projectedRaces = [];
    const nativeProjectedRaces = [];
    const redDependentProjectedRaces = [];
    const raceAptitudeRequirements = [];
    const incomingRedByKey = new Map();
    const incomingRedRequirementsByKey = new Map();

    if (candidate.sourceHasScheduleInput) {
      addWarning(warnings, {
        code: 'CANDIDATE_SCHEDULE_INPUT_IGNORED',
        message: 'G1 schedule/win input is not used to infer a projected schedule; the generator requires explicit aptitude data.',
        candidateId: candidate.id
      });
    }
    if (!candidate.aptitudeInput.complete) {
      addWarning(warnings, {
        code: 'APTITUDE_INPUT_INCOMPLETE',
        message: '候選缺少完整 turf/dirt/short/mile/medium/long 適性；不補預設 A，排程 fail closed。',
        candidateId: candidate.id,
        missingKeys: candidate.aptitudeInput.missingKeys,
        sourceType: candidate.aptitudeInput.sourceType
      });
    }

    const requestedBuckets = Array.isArray(options.desiredBuckets) && options.desiredBuckets.length
      ? options.desiredBuckets
      : BUCKET_ORDER;
    requestedBuckets.forEach((bucket, bucketIndex) => {
      const { surface, distance } = splitBucket(bucket);
      const surfacePlan = dimensionPlan(candidate, surface);
      const distancePlan = dimensionPlan(candidate, distance);
      const configuredCanonicalIds = canonicalG1IdsForBucket(bucket, options.foundationRouteId);
      const catalogEntries = configuredCanonicalIds
        .flatMap(canonicalId => catalogIndex.byCanonical.get(String(canonicalId)) || [])
        .filter(entry => gradeIsG1(entry.grade))
        .filter(entry => entry.nameZhTw && entry.surface === surface && entry.distanceType === distance);
      const seenCatalogCanonical = new Set();
      const uniqueEntries = catalogEntries.filter(entry => {
        const key = String(entry.canonicalRaceId);
        if (seenCatalogCanonical.has(key)) return false;
        seenCatalogCanonical.add(key);
        return true;
      });

      if (!uniqueEntries.length) {
        addWarning(warnings, {
          code: 'NO_G1_CANDIDATES_FOR_BUCKET',
          message: `沒有可用的 G1 catalog race for ${bucket}; 不以名稱或非 G1 資料補造賽程。`,
          candidateId: candidate.id,
          bucket,
          surface,
          distance
        });
      }

      let eligibilityStatus = 'INELIGIBLE';
      if (!candidate.aptitudeInput.complete || !surfacePlan.nativeRank || !distancePlan.nativeRank) {
        eligibilityStatus = 'MISSING_APTITUDE';
      } else if (surfacePlan.nativeEligible && distancePlan.nativeEligible) {
        eligibilityStatus = 'NATIVE_APTITUDE_ELIGIBLE';
      } else if (surfacePlan.redEligible && distancePlan.redEligible) {
        eligibilityStatus = 'RED_FACTOR_DEPENDENT';
      } else if (surfacePlan.redFactorRequiredUnsatisfied || distancePlan.redFactorRequiredUnsatisfied) {
        eligibilityStatus = 'RED_FACTOR_REQUIRED_UNSATISFIED';
      }
      const requirement = uniqueEntries.length
        ? bucketRequirement(candidate, bucket, surfacePlan, distancePlan, eligibilityStatus)
        : null;
      if (requirement) raceAptitudeRequirements.push(requirement);
      [surfacePlan, distancePlan]
        .filter(item => item.redFactorRequiredUnsatisfied)
        .forEach(item => {
          const suppliedFactor = candidate.incomingRedByKey[item.key] || null;
          const suppliedStars = suppliedFactor?.stars || 0;
          if (!incomingRedRequirementsByKey.has(item.key)) {
            incomingRedRequirementsByKey.set(item.key, {
              key: item.key,
              label: item.label,
              nameZhTw: item.label,
              requiredStars: item.requiredIncomingRedStars,
              suppliedStars,
              recordedStars: suppliedFactor?.recordedStars || 0,
              evidenceStatus: suppliedFactor?.evidenceStatus || 'UNVERIFIED',
              sourceStepId: suppliedFactor?.sourceStepId || '',
              sourceStepIds: clone(suppliedFactor?.sourceStepIds || []),
              missingStars: Math.max(0, item.requiredIncomingRedStars - suppliedStars),
              nativeRank: item.nativeRank,
              requestedRank: item.requiredRank,
              requiredRank: item.requiredRank,
              requirementLevel: item.requirementLevel,
              requiredForAutonomous: true,
              status: 'RED_FACTOR_REQUIRED_UNSATISFIED',
              appliesToBuckets: []
            });
          }
          const storedRequirement = incomingRedRequirementsByKey.get(item.key);
          storedRequirement.requirementLevel = strongestRequirementLevel([
            storedRequirement.requirementLevel,
            item.requirementLevel
          ]);
          storedRequirement.appliesToBuckets.push(bucket);
        });
      if (uniqueEntries.length
        && eligibilityStatus !== 'MISSING_APTITUDE'
        && eligibilityStatus !== 'INELIGIBLE'
        && eligibilityStatus !== 'RED_FACTOR_REQUIRED_UNSATISFIED') {
        requirement.requiredFactors.forEach(key => {
          const factor = candidate.incomingRedByKey[key];
          if (!factor) return;
          const dimension = [surfacePlan, distancePlan].find(item => item.key === key);
          if (!incomingRedByKey.has(key)) {
            incomingRedByKey.set(key, {
              key,
              label: factor.nameZhTw,
              nameZhTw: factor.nameZhTw,
              stars: factor.stars,
              recordedStars: factor.recordedStars,
              evidenceStatus: factor.evidenceStatus,
              sourceStepId: factor.sourceStepId,
              sourceStepIds: clone(factor.sourceStepIds || []),
              startBonus: factor.startBonus,
              nativeRank: candidate.aptitudeInput.ranks[key],
              requestedRank: candidate.requiredRanks[key] || 'A',
              requiredRank: candidate.requiredRanks[key] || 'A',
              requiredStars: dimension?.requiredIncomingRedStars || 0,
              requirementLevel: dimension?.requirementLevel || 'RECOMMENDED',
              requiredForAutonomous: true,
              appliesToBuckets: []
            });
          }
          const storedIncoming = incomingRedByKey.get(key);
          storedIncoming.requirementLevel = strongestRequirementLevel([
            storedIncoming.requirementLevel,
            dimension?.requirementLevel
          ]);
          storedIncoming.appliesToBuckets.push(bucket);
        });
        uniqueEntries.forEach(entry => {
          const rowRequirements = {
            bucket,
            surface: clone(surfacePlan),
            distance: clone(distancePlan),
            requiredRank: candidate.requiredRanks[surface] || 'A',
            raceCatalogId: entry.catalogRaceId,
            canonicalRaceId: entry.canonicalRaceId
          };
          const row = raceRow(entry, bucket, eligibilityStatus, rowRequirements, options);
          projectedRaces.push(row);
          if (eligibilityStatus === 'NATIVE_APTITUDE_ELIGIBLE') nativeProjectedRaces.push(row);
          else redDependentProjectedRaces.push(row);
        });
      }

      bucketPlans.push({
        bucket,
        order: bucketIndex + 1,
        surface,
        distanceType: distance,
        canonicalRaceIds: configuredCanonicalIds.slice(),
        catalogRaceIds: uniqueEntries.map(entry => entry.catalogRaceId),
        status: uniqueEntries.length ? eligibilityStatus : 'NO_G1_CANDIDATES_FOR_BUCKET',
        surfaceAptitude: surfacePlan,
        distanceAptitude: distancePlan,
        raceAptitudeRequirement: uniqueEntries.length
          ? bucketRequirement(candidate, bucket, surfacePlan, distancePlan, eligibilityStatus)
          : null
      });
    });

    const incomingRedRequirements = [...incomingRedRequirementsByKey.values()].map(item => ({
      ...item,
      appliesToBuckets: [...new Set(item.appliesToBuckets)]
    }));
    if (incomingRedRequirements.length) {
      addWarning(warnings, {
        code: 'RED_FACTOR_REQUIRED_UNSATISFIED',
        message: '本匹低適性需要上游 incoming red factor；candidate 的 outgoing red 不可回套為本匹進場適性。',
        candidateId: candidate.id,
        requirements: clone(incomingRedRequirements)
      });
    }

    if (redDependentProjectedRaces.length) {
      addWarning(warnings, {
        code: candidate.automationMode === 'autonomous'
          ? 'AUTO_APTITUDE_INHERITANCE_UNVERIFIED'
          : 'RED_FACTOR_APTITUDE_DEPENDENCY_UNVERIFIED',
        message: candidate.automationMode === 'autonomous'
          ? '自主育成是否會套用紅因子或完成後續繼承尚未驗證；紅因子依賴賽程不可視為自動可執行。'
          : '此 projected 賽程依賴指定紅因子提高適性；紅因子套用／後續繼承仍未驗證。',
        candidateId: candidate.id,
        automationMode: candidate.automationMode,
        buckets: [...new Set(redDependentProjectedRaces.map(row => row.distanceBucket))]
      });
    }

    const incomingRedPlan = [...incomingRedByKey.values()].map(item => ({
      ...item,
      appliesToBuckets: [...new Set(item.appliesToBuckets)]
    }));
    const dedupeRows = rows => {
      const seen = new Set();
      return rows.filter(row => {
        const key = String(row.canonicalRaceId);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };
    return {
      id: candidate.id,
      slot: candidate.slot,
      stepId: candidate.stepId,
      nameZhTw: candidate.nameZhTw,
      nameJp: candidate.nameJp,
      outfitId: candidate.outfitId,
      characterId: candidate.characterId,
      aptitudeInput: clone(candidate.aptitudeInput),
      aptitudes: clone(candidate.aptitudes),
      requiredRanks: clone(candidate.requiredRanks),
      requiredRankLevels: clone(candidate.requiredRankLevels),
      incomingRedFactors: clone(candidate.incomingRedFactors),
      incomingRedByKey: clone(candidate.incomingRedByKey),
      outgoingRedByKey: clone(candidate.outgoingRedByKey),
      bucketPlans,
      raceAptitudeRequirements,
      incomingRedPlan,
      incomingRedRequirements,
      outgoingRedFactor: candidate.outgoingRedFactor ? clone(candidate.outgoingRedFactor) : null,
      outgoingRedFactors: clone(candidate.outgoingRedFactors),
      projectedG1Schedule: dedupeRows(projectedRaces),
      nativeProjectedG1Schedule: dedupeRows(nativeProjectedRaces),
      redFactorDependentProjectedG1Schedule: dedupeRows(redDependentProjectedRaces),
      runnableProjectedG1Schedule: dedupeRows(nativeProjectedRaces),
      status: projectedRaces.length ? 'PROJECTED' : 'NO_PROJECTED_G1_SCHEDULE',
      eligibilityStatus: candidate.aptitudeInput.complete
        ? (redDependentProjectedRaces.length
          ? 'PARTLY_RED_FACTOR_DEPENDENT'
          : (incomingRedRequirements.length ? 'RED_FACTOR_REQUIRED_UNSATISFIED' : 'NATIVE_ONLY'))
        : 'APTITUDE_INPUT_INCOMPLETE',
      automationMode: candidate.automationMode,
      warnings,
      source: {
        aptitudeContract: candidate.aptitudeInput.sourceType,
        redFactorSpecified: candidate.outgoingRedFactors.length > 0
      },
      _candidate: candidate
    };
  }

  function foundationRedAxes(candidate, oneStarStars, options = {}) {
    const requestedRanks = options.requiredRank
      ? Object.fromEntries(APTITUDE_KEYS.map(key => [key, normalizeRank(options.requiredRank) || 'A']))
      : candidate.requiredRanks;
    return APTITUDE_KEYS
      .map(key => {
        const nativeRank = candidate.aptitudeInput.ranks[key];
        const nativeIndex = rankIndex(nativeRank);
        const requestedRank = requestedRanks[key] || 'A';
        const requestedIndex = rankIndex(requestedRank);
        const requiredStars = minimumIncomingRedStars(nativeIndex, requestedIndex);
        if (requiredStars <= 0 || requiredStars > oneStarStars) return null;
        return {
          key,
          label: SURFACE_LABELS[key] || DISTANCE_LABELS[key] || key,
          nativeRank,
          requestedRank,
          requiredStars,
          explicitStars: oneStarStars,
          requirementLevel: requirementLevel(candidate.requiredRankLevels?.[key], 'RECOMMENDED'),
          status: 'RED_FACTOR_DEPENDENT'
        };
      })
      .filter(Boolean);
  }

  function foundationCandidateSource(candidate, incomingRedFactors, options = {}) {
    const source = isObject(candidate) ? { ...candidate } : {};
    // Foundation coverage is a hypothetical base-material contract.  Never
    // let an outgoing factor or a previously persisted incoming field
    // accidentally self-satisfy the candidate's own race aptitude.
    source.incomingRedFactors = incomingRedFactors;
    source.incomingRedFactor = null;
    source.incomingRedByKey = {};
    source.incomingRedPlan = [];
    if (options.requiredRank !== undefined) source.requiredRank = options.requiredRank;
    return source;
  }

  function foundationRowsForBucket(rows, bucket) {
    return (rows || []).filter(row => row.distanceBucket === bucket || row.distanceType === splitBucket(bucket).distance && row.surface === splitBucket(bucket).surface);
  }

  function evaluateFoundationG1Coverage(candidate, raceCatalog, options = {}) {
    const scheduleOptions = {
      server: text(options.server, RULESET.server),
      ruleset: text(options.ruleset ?? options.rulesetId, RULESET.id),
      automationMode: options.automationMode ?? null,
      strictAptitude: options.strictAptitude !== false,
      defaultRequiredRank: normalizeRank(options.defaultRequiredRank),
      defaultRequirementLevel: requirementLevel(
        options.defaultRequirementLevel,
        options.strictAptitude === false ? 'RECOMMENDED' : 'RULE_REQUIRED'
      ),
      projectedG1RequirementLevel: requirementLevel(options.projectedG1RequirementLevel, 'RECOMMENDED')
    };
    const catalogInput = raceCatalog
      ?? options.raceCatalog
      ?? options.g1RaceCatalog
      ?? options.catalog;
    const catalogIndex = buildCatalogIndex(catalogInput, scheduleOptions);
    const normalized = normalizeCandidate(candidate, 0, scheduleOptions);
    const oneStarStars = Math.max(1, integer(options.oneStarStars, 1));
    const requiredRedAxes = foundationRedAxes(normalized, oneStarStars, options);
    const oneStarRedFactors = requiredRedAxes.map(axis => ({
      key: axis.key,
      nameZhTw: axis.label,
      stars: oneStarStars
    }));
    const nativePlan = candidateSchedule(
      normalizeCandidate(foundationCandidateSource(candidate, [], options), 0, scheduleOptions),
      catalogIndex,
      scheduleOptions
    );
    const expandedPlan = candidateSchedule(
      normalizeCandidate(foundationCandidateSource(candidate, oneStarRedFactors, options), 0, scheduleOptions),
      catalogIndex,
      scheduleOptions
    );
    const nativeIds = new Set(nativePlan.nativeProjectedG1Schedule.map(row => String(row.canonicalRaceId)));
    const nativeRows = nativePlan.nativeProjectedG1Schedule;
    const expandedRows = expandedPlan.projectedG1Schedule;
    const expandableRows = expandedRows.filter(row => !nativeIds.has(String(row.canonicalRaceId)));
    const rowsByBucket = rows => Object.fromEntries(BUCKET_ORDER.map(bucket => [
      bucket,
      foundationRowsForBucket(rows, bucket)
    ]));
    const nativeRowsByBucket = rowsByBucket(nativeRows);
    const expandedRowsByBucket = rowsByBucket(expandedRows);
    const expandableRowsByBucket = rowsByBucket(expandableRows);
    const nativeBucketById = new Map(nativePlan.bucketPlans.map(item => [item.bucket, item]));
    const expandedBucketById = new Map(expandedPlan.bucketPlans.map(item => [item.bucket, item]));
    const bucketStatus = BUCKET_ORDER.map(bucket => {
      const nativeBucket = nativeBucketById.get(bucket);
      const expandedBucket = expandedBucketById.get(bucket);
      const nativeBucketRows = nativeRowsByBucket[bucket];
      const expandedBucketRows = expandedRowsByBucket[bucket];
      const expandableBucketRows = expandableRowsByBucket[bucket];
      const requiredKeys = [...new Set(expandableBucketRows.flatMap(row => [
        row.aptitudeRequirements?.surface,
        row.aptitudeRequirements?.distance
      ].filter(Boolean).flatMap(dimension => dimension.redFactorRequired ? [dimension.key] : [])))];
      return {
        bucket,
        surface: splitBucket(bucket).surface,
        distanceType: splitBucket(bucket).distance,
        nativeStatus: nativeBucket?.status || 'MISSING_APTITUDE',
        oneStarRedStatus: expandedBucket?.status || 'MISSING_APTITUDE',
        status: nativeBucket?.status || 'MISSING_APTITUDE',
        nativeCanonicalRaceIds: nativeBucketRows.map(row => row.canonicalRaceId),
        nativeCount: nativeBucketRows.length,
        oneStarExpandableCanonicalRaceIds: expandableBucketRows.map(row => row.canonicalRaceId),
        oneStarExpandableCount: expandableBucketRows.length,
        oneStarExpandedCanonicalRaceIds: expandedBucketRows.map(row => row.canonicalRaceId),
        oneStarExpandedCount: expandedBucketRows.length,
        requiredRedAxes: requiredKeys
      };
    });
    const expandedRedAxes = requiredRedAxes.map(axis => ({
      ...axis,
      appliesToBuckets: bucketStatus
        .filter(item => item.requiredRedAxes.includes(axis.key))
        .map(item => item.bucket)
    })).filter(axis => axis.appliesToBuckets.length);
    const warnings = [];
    [...nativePlan.warnings, ...expandedPlan.warnings].forEach(warning => addWarning(warnings, warning));
    if (!catalogRows(catalogInput).length) {
      addWarning(warnings, {
        code: 'G1_CATALOG_REQUIRED',
        message: '需要明確 G1 catalog；foundation coverage 不猜測賽道。',
        candidateId: normalized.id
      });
    }
    const nativeCanonicalRaceIds = [...new Set(nativeRows.map(row => row.canonicalRaceId))];
    const oneStarExpandableCanonicalRaceIds = [...new Set(expandableRows.map(row => row.canonicalRaceId))];
    const oneStarExpandedCanonicalRaceIds = [...new Set(expandedRows.map(row => row.canonicalRaceId))];
    const status = !normalized.aptitudeInput.complete
      ? 'APTITUDE_INPUT_INCOMPLETE'
      : (nativeCanonicalRaceIds.length ? 'READY' : 'NO_NATIVE_G1_SCHEDULE');
    return {
      schemaVersion: 1,
      status,
      candidateId: normalized.id,
      outfitId: normalized.outfitId,
      characterId: normalized.characterId,
      aptitudeInput: clone(normalized.aptitudeInput),
      aptitudes: clone(normalized.aptitudes),
      nativeCanonicalG1Ids: nativeCanonicalRaceIds,
      nativeCanonicalG1Count: nativeCanonicalRaceIds.length,
      nativeCanonicalRaceIds,
      nativeCount: nativeCanonicalRaceIds.length,
      oneStarExpandableCanonicalG1Ids: oneStarExpandableCanonicalRaceIds,
      oneStarExpandableCanonicalG1Count: oneStarExpandableCanonicalRaceIds.length,
      oneStarExpandableCanonicalRaceIds,
      oneStarExpandableCount: oneStarExpandableCanonicalRaceIds.length,
      oneStarExpandedCanonicalG1Ids: oneStarExpandedCanonicalRaceIds,
      oneStarExpandedCanonicalG1Count: oneStarExpandedCanonicalRaceIds.length,
      oneStarExpandedCanonicalRaceIds,
      oneStarExpandedCount: oneStarExpandedCanonicalRaceIds.length,
      requiredRedAxes: expandedRedAxes,
      requiredRedFactors: expandedRedAxes.map(axis => ({
        key: axis.key,
        nameZhTw: axis.label,
        requiredStars: axis.requiredStars,
        explicitStars: axis.explicitStars,
        nativeRank: axis.nativeRank,
        requestedRank: axis.requestedRank,
        appliesToBuckets: axis.appliesToBuckets
      })),
      bucketStatus,
      nativeRaces: clone(nativeRows),
      oneStarExpandableRaces: clone(expandableRows).map(row => ({
        ...row,
        eligibilityStatus: 'RED_FACTOR_DEPENDENT',
        verificationStatus: 'PROJECTED',
        scoreIncluded: false,
        autonomousStatus: scheduleOptions.automationMode === 'autonomous' ? 'UNVERIFIED' : 'NOT_COMPUTED'
      })),
      oneStarExpandedRaces: clone(expandedRows),
      autonomous: {
        status: expandedRedAxes.length && scheduleOptions.automationMode === 'autonomous'
          ? 'UNVERIFIED'
          : (expandedRedAxes.length ? 'RED_FACTOR_DEPENDENT' : 'NOT_APPLICABLE'),
        addedRaceStatus: expandedRedAxes.length ? 'RED_FACTOR_DEPENDENT' : 'NONE',
        addedRaceVerificationStatus: expandedRedAxes.length ? 'PROJECTED_UNVERIFIED' : 'NONE',
        addedRaceCount: oneStarExpandableCanonicalRaceIds.length,
        confirmedCount: 0,
        scoreIncluded: false
      },
      source: {
        ruleset: scheduleOptions.ruleset,
        server: scheduleOptions.server,
        canonicalBucketDefinitions: clone(CANONICAL_G1_IDS_BY_BUCKET),
        oneStarRedFactors: clone(oneStarRedFactors)
      },
      warnings,
      assumptions: {
        native: '只計候選自身原生 A 適性可跑的 canonical G1；B 不宣稱直接可跑。',
        oneStarExpansion: '只對一枚明確 1★ 紅因子足以把原生適性補到 A 的 bucket 展開；依賴紅因子的新增場次仍是 RED_FACTOR_DEPENDENT。',
        autonomous: 'autonomous 不把 projected 或紅因子依賴場次當 confirmed，也不計分。',
        failClosed: '缺少完整六軸適性、catalog、G1 grade、canonical bucket 或泥長候選時維持空集合。'
      }
    };
  }

  function rowMap(rows) {
    return new Map((rows || []).map(row => [String(row.canonicalRaceId), row]));
  }

  function mergeCommonRows(rows, candidatePlans) {
    const base = clone(rows[0]);
    const eligibilityByCandidate = {};
    let hasRedDependency = false;
    rows.forEach(row => {
      const candidateId = row._candidateId || row.candidateId;
      if (candidateId) eligibilityByCandidate[candidateId] = row.eligibilityStatus;
      if (row.eligibilityStatus !== 'NATIVE_APTITUDE_ELIGIBLE') hasRedDependency = true;
    });
    delete base._candidateId;
    delete base.candidateId;
    base.eligibilityStatus = hasRedDependency
      ? 'AUTO_APTITUDE_INHERITANCE_UNVERIFIED'
      : 'NATIVE_APTITUDE_ELIGIBLE';
    base.eligibilityByCandidate = eligibilityByCandidate;
    base.commonAcrossCandidateIds = candidatePlans.map(plan => plan.id);
    return base;
  }

  function intersectPlans(plans, scheduleKey) {
    if (!plans.length) return [];
    const first = rowMap(plans[0][scheduleKey]);
    const common = [];
    first.forEach((firstRow, canonicalKey) => {
      const rows = [{ ...firstRow, candidateId: plans[0].id }];
      for (const plan of plans.slice(1)) {
        const match = rowMap(plan[scheduleKey]).get(canonicalKey);
        if (!match) return;
        rows.push({ ...match, candidateId: plan.id });
      }
      common.push(mergeCommonRows(rows, plans));
    });
    return common;
  }

  function unionRows(rows) {
    const seen = new Map();
    (rows || []).flat().forEach(row => {
      const key = String(row.canonicalRaceId);
      if (!seen.has(key)) seen.set(key, clone(row));
      else if (row.eligibilityStatus !== 'NATIVE_APTITUDE_ELIGIBLE') {
        seen.get(key).eligibilityStatus = 'AUTO_APTITUDE_INHERITANCE_UNVERIFIED';
      }
    });
    return [...seen.values()].sort((left, right) => {
      const leftBucket = BUCKET_ORDER.indexOf(left.distanceBucket);
      const rightBucket = BUCKET_ORDER.indexOf(right.distanceBucket);
      return leftBucket - rightBucket || Number(left.canonicalRaceId) - Number(right.canonicalRaceId);
    });
  }

  function edgeSchedule(edge, planBySlot, options = {}) {
    const left = planBySlot.get(edge.leftSlot);
    const right = planBySlot.get(edge.rightSlot);
    if (!left || !right) {
      return {
        id: edge.id,
        leftSlot: edge.leftSlot,
        rightSlot: edge.rightSlot,
        status: 'NONE',
        projected: [],
        runnableProjected: [],
        redFactorDependentProjected: [],
        scoreIncluded: false,
        confirmed: [],
        missingCandidateSlots: [!left ? edge.leftSlot : null, !right ? edge.rightSlot : null].filter(Boolean)
      };
    }
    const projected = intersectPlans([left, right], 'projectedG1Schedule');
    const runnableProjected = intersectPlans([left, right], 'nativeProjectedG1Schedule');
    const redFactorDependentProjected = projected.filter(row => !runnableProjected.some(other => String(other.canonicalRaceId) === String(row.canonicalRaceId)));
    return {
      id: edge.id,
      leftSlot: edge.leftSlot,
      rightSlot: edge.rightSlot,
      leftCandidateId: left.id,
      rightCandidateId: right.id,
      status: projected.length ? 'PROJECTED' : 'NO_COMMON_G1_SCHEDULE',
      projected,
      projectedG1Schedule: projected,
      runnableProjected,
      runnableProjectedG1Schedule: runnableProjected,
      redFactorDependentProjected,
      scoreIncluded: false,
      confirmed: [],
      incomingRedPlanByEndpoint: {
        [edge.leftSlot]: clone(left.incomingRedPlan),
        [edge.rightSlot]: clone(right.incomingRedPlan)
      },
      outgoingRedFactorByEndpoint: {
        [edge.leftSlot]: clone(left.outgoingRedFactors),
        [edge.rightSlot]: clone(right.outgoingRedFactors)
      },
      confirmationPolicy: 'WIN_ONLY',
      ruleset: options.ruleset ?? RULESET.id,
      server: options.server ?? RULESET.server
    };
  }

  function candidateInputs(input) {
    const raw = input?.candidates
      ?? input?.lineageCandidates
      ?? input?.constructionCandidates
      ?? input?.candidatePool
      ?? input?.candidate;
    if (Array.isArray(raw)) return raw;
    if (isObject(raw)) {
      return Object.entries(raw).map(([slot, candidate]) => ({
        ...(isObject(candidate) ? candidate : {}),
        slot: candidate?.slot ?? slot
      }));
    }
    return [];
  }

  function stepIdForCandidate(plan) {
    if (plan.stepId) return plan.stepId;
    if (plan.slot && SLOT_TO_STEP_ID[plan.slot]) return SLOT_TO_STEP_ID[plan.slot];
    if (plan.slot) return plan.slot;
    return plan.id;
  }

  function noIncomingRedSentinel() {
    // lineage-planner-core selects the first non-empty redFactorRequirements
    // source.  An invalid, keyless entry normalizes to [] and intentionally
    // suppresses a global target requirement for a step that has no incoming
    // red plan.  The public incomingRedPlan remains the authoritative field.
    return [{ disabled: true, reason: 'NO_INCOMING_RED_FACTOR' }];
  }

  function buildStepOverride(plan, projectedRows) {
    const incoming = clone(plan.incomingRedPlan);
    const requirements = clone(plan.incomingRedRequirements || []);
    return {
      confirmed: [],
      confirmedG1Wins: [],
      projected: clone(projectedRows),
      projectedG1Schedule: clone(projectedRows),
      scoreIncluded: false,
      projectedG1ScoreIncluded: false,
      status: projectedRows.length ? 'PROJECTED' : 'NONE',
      confirmationPolicy: 'WIN_ONLY',
      incomingRedPlan: incoming,
      incomingRedRequirements: requirements,
      outgoingRedFactor: clone(plan.outgoingRedFactor),
      outgoingRedFactors: clone(plan.outgoingRedFactors),
      raceAptitudeRequirements: clone(plan.raceAptitudeRequirements),
      redFactorRequirements: incoming.length
        ? incoming
        : (requirements.length ? requirements : noIncomingRedSentinel()),
      eligibilityStatus: plan.eligibilityStatus,
      warnings: clone(plan.warnings)
    };
  }

  function buildProjectedG1Schedule(input = {}) {
    const desiredBuckets = [...new Set((Array.isArray(input.desiredBuckets)
      ? input.desiredBuckets
      : BUCKET_ORDER).map(text).filter(bucket => BUCKET_ORDER.includes(bucket)))];
    const options = {
      server: text(input.server, RULESET.server),
      ruleset: text(input.ruleset ?? input.rulesetId, RULESET.id),
      automationMode: input.automationMode ?? null,
      strictAptitude: input.strictAptitude !== false,
      defaultRequiredRank: normalizeRank(input.defaultRequiredRank),
      defaultRequirementLevel: requirementLevel(
        input.defaultRequirementLevel,
        input.strictAptitude === false ? 'RECOMMENDED' : 'RULE_REQUIRED'
      ),
      projectedG1RequirementLevel: requirementLevel(input.projectedG1RequirementLevel, 'RECOMMENDED'),
      desiredBuckets: desiredBuckets.length ? desiredBuckets : BUCKET_ORDER.slice(),
      foundationRouteId: G1_FOUNDATION_ROUTE_DEFINITIONS[text(input.foundationRouteId)]
        ? text(input.foundationRouteId)
        : ''
    };
    const catalogInput = input.raceCatalog
      ?? input.g1RaceCatalog
      ?? input.catalog
      ?? input.gameToraRaceCatalog;
    const catalogIndex = buildCatalogIndex(catalogInput, options);
    const rawCandidates = candidateInputs(input);
    const candidates = rawCandidates.map((raw, index) => normalizeCandidate(raw, index, options));
    const plans = candidates.map(candidate => candidateSchedule(candidate, catalogIndex, options));
    const warnings = [];
    plans.forEach(plan => plan.warnings.forEach(warning => addWarning(warnings, warning)));
    if (!rawCandidates.length) {
      addWarning(warnings, {
        code: 'NO_CONSTRUCTION_CANDIDATES',
        message: '沒有施工候選；不建立全域適性或全域紅因子替代排程。'
      });
    }
    if (!catalogRows(catalogInput).length) {
      addWarning(warnings, {
        code: 'G1_CATALOG_REQUIRED',
        message: '需要 data/gametora-data.json 的 races catalog；沒有 catalog 時不猜測 G1。'
      });
    }

    const planBySlot = new Map(plans.filter(plan => plan.slot).map(plan => [plan.slot, plan]));
    const edges = EDGE_DEFINITIONS.map(edge => edgeSchedule(edge, planBySlot, options));
    edges.forEach(edge => {
      if (edge.missingCandidateSlots?.length) {
        addWarning(warnings, {
          code: 'EDGE_CANDIDATE_MISSING',
          message: `共同 G1 edge 缺少候選端點：${edge.missingCandidateSlots.join(', ')}`,
          edgeId: edge.id,
          missingCandidateSlots: edge.missingCandidateSlots
        });
      }
      if (edge.redFactorDependentProjected?.length) {
        addWarning(warnings, {
          code: options.automationMode === 'autonomous'
            ? 'AUTO_APTITUDE_INHERITANCE_UNVERIFIED'
            : 'RED_FACTOR_APTITUDE_DEPENDENCY_UNVERIFIED',
          message: options.automationMode === 'autonomous'
            ? '共同 G1 edge 有賽程依賴紅因子；自主育成是否套用／繼承仍未驗證。'
            : '共同 G1 edge 有賽程依賴紅因子；紅因子套用／繼承仍未驗證。',
          edgeId: edge.id,
          raceIds: edge.redFactorDependentProjected.map(row => row.canonicalRaceId),
          automationMode: options.automationMode
        });
      }
    });

    const generationCommonProjected = intersectPlans(plans, 'projectedG1Schedule');
    const generationCommonRunnable = intersectPlans(plans, 'nativeProjectedG1Schedule');
    const candidatePlanById = Object.fromEntries(plans.map(plan => [plan.id, plan]));
    const assignedRowsBySlot = new Map();
    plans.forEach(plan => {
      const incident = edges
        .filter(edge => edge.leftSlot === plan.slot || edge.rightSlot === plan.slot)
        .flatMap(edge => edge.projected || []);
      assignedRowsBySlot.set(plan.slot || plan.id, incident.length ? unionRows([incident]) : clone(plan.projectedG1Schedule));
    });

    const g1ScheduleByStep = {};
    const stepOverridesByCandidateId = {};
    plans.forEach(plan => {
      const assignedRows = assignedRowsBySlot.get(plan.slot || plan.id) || [];
      const key = stepIdForCandidate(plan);
      const override = buildStepOverride(plan, assignedRows);
      g1ScheduleByStep[key] = override;
      stepOverridesByCandidateId[plan.id] = key;
    });

    const status = generationCommonProjected.length || plans.some(plan => plan.projectedG1Schedule.length)
      ? 'PROJECTED_ONLY'
      : 'NO_PROJECTED_G1_SCHEDULE';
    return {
      schemaVersion: 1,
      status,
      ruleset: clone({ ...RULESET, id: options.ruleset, server: options.server }),
      server: options.server,
      automationMode: options.automationMode,
      aptitudeContract: {
        accepted: [
          'aptitude: [turf, dirt, short, mile, medium, long, ...styles]',
          'aptitudes/nativeAptitudes: {turf,dirt,short,mile,medium,long}'
        ],
        requiredKeys: APTITUDE_KEYS.slice(),
        missingValuePolicy: 'FAIL_CLOSED_NO_DEFAULT_A',
        defaultRequiredRank: options.defaultRequiredRank || (options.strictAptitude ? 'A' : 'C'),
        defaultRequirementLevel: options.defaultRequirementLevel,
        projectedG1RequirementLevel: options.projectedG1RequirementLevel,
        redStartingBonusThresholds: clone(RED_FACTOR_THRESHOLDS)
      },
      catalog: {
        sourceCount: catalogIndex.sourceCount,
        normalizedCount: catalogIndex.normalizedCount,
        g1Count: catalogIndex.g1Count,
        canonicalRaceIdRequired: true,
        selectedCanonicalRaceIds: uniqueNumbers(options.desiredBuckets
          .flatMap(bucket => canonicalG1IdsForBucket(bucket, options.foundationRouteId)))
      },
      bucketOrder: options.desiredBuckets.slice(),
      bucketDefinitions: Object.fromEntries(options.desiredBuckets.map(bucket => [
        bucket,
        canonicalG1IdsForBucket(bucket, options.foundationRouteId)
      ])),
      foundationRouteId: options.foundationRouteId || null,
      candidates: plans.map(plan => {
        const copy = clone(plan);
        delete copy._candidate;
        return copy;
      }),
      candidatePlansById: Object.fromEntries(plans.map(plan => {
        const copy = clone(plan);
        delete copy._candidate;
        return [plan.id, copy];
      })),
      edgeSchedules: edges,
      generationCommonProjectedG1Schedule: generationCommonProjected,
      generationCommonRunnableProjectedG1Schedule: generationCommonRunnable,
      commonProjectedG1Schedule: generationCommonProjected,
      commonRunnableProjectedG1Schedule: generationCommonRunnable,
      g1ScheduleByStep,
      stepOverridesByCandidateId,
      // No confirmed evidence is accepted or scored by this module.
      confirmedG1: {
        status: 'NOT_COMPUTED',
        races: [],
        scoreIncluded: false,
        total: 0
      },
      projectedG1: {
        status: 'PROJECTED',
        races: generationCommonProjected,
        scoreIncluded: false,
        total: 0,
        confirmationPolicy: 'WIN_ONLY'
      },
      // Compatibility-shaped aliases are still explicitly non-scoring.  They
      // make it difficult for a caller to mistake this projected contract for
      // a confirmed breeder score while keeping the status machine visible.
      confirmedG1Bonus: {
        status: 'NOT_COMPUTED',
        races: [],
        scoreIncluded: false,
        total: 0
      },
      projectedG1Bonus: {
        status: 'PROJECTED_ONLY',
        races: generationCommonProjected,
        scoreIncluded: false,
        total: 0
      },
      projectedG1Schedule: generationCommonProjected,
      projectedG1ScheduleScoreIncluded: false,
      warnings,
      assumptions: {
        projectedOnly: '所有輸出都是 PROJECTED；此模組不把排程轉成 confirmed，也不計 projected 分數。',
        confirmation: '只有日後補上同一 server/ruleset、catalogRaceId/canonicalRaceId、G1 且 outcomeStatus=WIN 或 finishPosition=1 的完整證據，才能交給既有 breeder confirmed classifier。',
        autonomousAptitude: '自主育成是否套用紅因子／完成後續繼承維持 UNVERIFIED；red-dependent rows 不等同於可自動執行。',
        redFactorDirection: '只有 incomingRedFactors/incomingRedByKey 可以影響本匹 projected red-dependent eligibility；outgoingRedFactor(s) 只供下代規劃與顯示。',
        edgePlanning: '先對五條 G1 edge 取兩端共同集合，再把 edge 集合分配到各端 step；不把一個候選的紅因子全域套用到其他候選。',
        eligibility: '缺少完整六軸適性、catalog race、G1 grade 或指定 bucket 時 fail closed。'
      }
    };
  }

  function buildG1ScheduleByStep(input = {}) {
    return buildProjectedG1Schedule(input).g1ScheduleByStep;
  }

  return {
    SCHEMA_VERSION: 1,
    RULESET,
    APTITUDE_KEYS,
    APTITUDE_ARRAY_KEYS,
    APTITUDE_RANKS,
    RED_FACTOR_THRESHOLDS,
    BUCKET_ORDER,
    CANONICAL_G1_IDS_BY_BUCKET,
    G1_FOUNDATION_ROUTE_DEFINITIONS,
    G1_FOUNDATION_COMMON_IDS_BY_BUCKET,
    EDGE_DEFINITIONS,
    SLOT_TO_STEP_ID,
    normalizeAptitudes,
    normalizeRedFactors,
    normalizeIncomingRedFactors,
    normalizeOutgoingRedFactors,
    normalizeCandidate,
    normalizeCatalogRace,
    buildCatalogIndex,
    redStartingBonus,
    resolveGoalScheduleCanonicalIds,
    evaluateG1FoundationRoutes,
    planLineageG1Foundation,
    evaluateFoundationG1Coverage,
    buildProjectedG1Schedule,
    buildG1SchedulePlan: buildProjectedG1Schedule,
    generateG1Schedule: buildProjectedG1Schedule,
    buildG1ScheduleByStep
  };
});
