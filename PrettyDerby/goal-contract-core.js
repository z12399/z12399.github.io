(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GOAL_CONTRACT_CORE = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // This is an aggregation boundary.  It deliberately does not require, call,
  // or re-score any of the race, deck, acquisition, or lineage models.  The
  // inputs are already model outputs; this module preserves their evidence
  // state and gives downstream consumers one versioned shape.
  const SCHEMA_VERSION = 1;
  const CONTRACT_SCHEMA = 'prettyderby-goal-contract.v1';
  const MODEL_VERSION = 'goal-contract-v1';
  const COVER_CLASSES = Object.freeze([
    'NATIVE_CERTAIN',
    'DIRECT_PARENT_CERTAIN',
    'DECK_CONFIRMED',
    'EXISTING_FACTOR_CONFIRMED',
    'PARTIAL_ROUTE',
    'UNRESOLVED'
  ]);
  const COVER_CLASS_ORDER = Object.freeze({
    UNRESOLVED: 0,
    PARTIAL_ROUTE: 1,
    EXISTING_FACTOR_CONFIRMED: 2,
    DECK_CONFIRMED: 3,
    DIRECT_PARENT_CERTAIN: 4,
    NATIVE_CERTAIN: 5
  });
  const DEDUCTION_ORDER = Object.freeze([
    'NATIVE_CERTAIN',
    'DIRECT_PARENT_CERTAIN',
    'DECK_CONFIRMED',
    'EXISTING_FACTOR_CONFIRMED',
    'PARTIAL_ROUTE',
    'UNRESOLVED'
  ]);
  const LINEAGE_STAGES = Object.freeze(['direct_parent', 'grandparent', 'foundation']);
  const REQUIRED_TARGET_FIELDS = Object.freeze([
    'server',
    'eventMode',
    'courseId',
    'surface',
    'distanceType',
    'distanceM',
    'runningStyle',
    'objective'
  ]);
  const DEFAULT_RACE_FIT_AXES = Object.freeze([
    'surfaceAptitude',
    'distanceAptitude',
    'runningStyleFit',
    'necessarySkillFit',
    'recoveryFit'
  ]);
  const FULL_BUILD_EVALUATION_KEYS = Object.freeze([
    'fullBuildEvaluation',
    'full_build_evaluation',
    'battleBuildEvaluation',
    'battle_build_evaluation',
    'buildEvaluation',
    'build_evaluation'
  ]);
  const FULL_BUILD_STATUS_KEYS = Object.freeze([
    'status',
    'state',
    'evaluationStatus',
    'evaluation_status',
    'buildStatus',
    'build_status'
  ]);
  const FULL_BUILD_CANDIDATE_KEYS = Object.freeze([
    'candidates',
    'candidateResults',
    'candidate_results',
    'rows'
  ]);
  const FINAL_RANK_KEYS = Object.freeze(['finalRank', 'final_rank']);
  const FORBIDDEN_KEY_RE = /(?:probability|winrate|inheritancerate)/i;

  // raceFit.rank is only a projection of an already-authorized whole-build
  // finalRank.  Body axes may still be displayed and compared diagnostically,
  // but they can never manufacture a rank.

  function isObject(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  }

  function clone(value) {
    if (Array.isArray(value)) return value.map(clone);
    if (isObject(value)) {
      return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, clone(child)]));
    }
    return value;
  }

  // User supplied model rows can carry forbidden metrics.  The aggregator
  // uses allowlists for its own rows, and this helper is an additional guard
  // for free-form objective labels and evidence notes.
  function sanitize(value) {
    if (Array.isArray(value)) return value.map(sanitize);
    if (!isObject(value)) return value;
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !FORBIDDEN_KEY_RE.test(String(key)))
        .map(([key, child]) => [key, sanitize(child)])
    );
  }

  function stableValue(value) {
    if (Array.isArray(value)) return value.map(stableValue);
    if (!isObject(value)) return value;
    return Object.fromEntries(
      Object.keys(value).sort().map(key => [key, stableValue(value[key])])
    );
  }

  function stableKey(value) {
    return JSON.stringify(stableValue(sanitize(value)));
  }

  function text(value, fallback = '') {
    if (value === null || value === undefined) return fallback;
    const result = String(value).trim();
    return result || fallback;
  }

  function numeric(value, fallback = null) {
    if (value === null || value === undefined || value === '' || typeof value === 'boolean') {
      return fallback;
    }
    const result = Number(value);
    return Number.isFinite(result) ? result : fallback;
  }

  function own(source, key) {
    return isObject(source) && Object.prototype.hasOwnProperty.call(source, key);
  }

  function firstOwn(source, keys) {
    for (const key of keys) {
      if (own(source, key)) return source[key];
    }
    return undefined;
  }

  const RANK_STATUS_VALUES = new Set([
    'READY',
    'READY_WITH_TRADEOFFS',
    'READY_WITH_WARNINGS',
    'UNKNOWN',
    'NEEDS_EVIDENCE',
    'NEEDS_BUILD_CONTEXT',
    'INCOMPLETE_BUILD',
    'BLOCKED'
  ]);

  function statusToken(value) {
    if (value === null || value === undefined) return null;
    const result = String(value).trim().toUpperCase().replace(/[\s-]+/g, '_');
    return result || null;
  }

  function rankStatusInfo(source) {
    if (!isObject(source)) return { present: false, status: null, recognized: false };
    let unrecognized = null;
    for (const key of FULL_BUILD_STATUS_KEYS) {
      if (!own(source, key)) continue;
      const status = statusToken(source[key]);
      const info = {
        present: true,
        status,
        recognized: RANK_STATUS_VALUES.has(status)
      };
      if (info.recognized) return info;
      unrecognized ||= info;
    }
    return unrecognized || { present: false, status: null, recognized: false };
  }

  function validFinalRank(value) {
    return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
      ? value
      : null;
  }

  function finalRankInfo(source) {
    if (!isObject(source)) return { present: false, valid: false, value: null };
    for (const key of FINAL_RANK_KEYS) {
      if (!own(source, key)) continue;
      const value = validFinalRank(source[key]);
      return { present: true, valid: value !== null, value };
    }
    return { present: false, valid: false, value: null };
  }

  function finalRankEligibilityInfo(source) {
    if (!isObject(source)) return { present: false, eligible: false };
    for (const key of ['finalRankEligible', 'final_rank_eligible']) {
      if (!own(source, key)) continue;
      return { present: true, eligible: source[key] === true };
    }
    return { present: false, eligible: false };
  }

  function candidateIdentity(source) {
    const value = firstOwn(source, [
      'candidateId',
      'candidate_id',
      'id',
      'outfitId',
      'outfit_id',
      'characterId',
      'character_id'
    ]);
    return hasMeaningful(value) ? String(value) : null;
  }

  function fullBuildEvaluationContext(input, candidateCount) {
    const supplied = firstOwn(input, FULL_BUILD_EVALUATION_KEYS);
    if (supplied === undefined) {
      return {
        present: false,
        ready: false,
        status: null,
        hasCandidateRows: false,
        records: new Map(),
        singleRecord: null
      };
    }
    if (!isObject(supplied)) {
      return {
        present: true,
        ready: false,
        status: null,
        hasCandidateRows: false,
        records: new Map(),
        singleRecord: null
      };
    }
    const statusInfo = rankStatusInfo(supplied);
    const rankingReadyKey = ['finalRankingReady', 'final_ranking_ready']
      .find(key => own(supplied, key));
    const rankingReady = rankingReadyKey === undefined || supplied[rankingReadyKey] === true;
    const ready = statusInfo.recognized && statusInfo.status === 'READY' && rankingReady;
    const candidateRows = FULL_BUILD_CANDIDATE_KEYS
      .map(key => supplied[key])
      .find(value => Array.isArray(value));
    const records = new Map();
    if (Array.isArray(candidateRows)) {
      for (const row of candidateRows) {
        const id = candidateIdentity(row);
        if (id !== null && !records.has(id)) records.set(id, row);
      }
    }
    const directRank = finalRankInfo(supplied);
    const singleRecord = !Array.isArray(candidateRows) && directRank.present
      ? supplied
      : null;
    return {
      present: true,
      ready,
      status: statusInfo.status,
      hasCandidateRows: Array.isArray(candidateRows),
      records,
      singleRecord: candidateCount === 1 ? singleRecord : null
    };
  }

  function candidateBuildRecords(source, context, index, candidateCount) {
    const records = [];
    if (context.present && context.ready) {
      if (context.hasCandidateRows) {
        const id = candidateIdentity(source);
        records.push({
          source: id === null ? null : context.records.get(id),
          required: true,
          kind: 'full-build-evaluation'
        });
      } else if (context.singleRecord && (index === 0 || candidateCount === 1)) {
        records.push({ source: context.singleRecord, required: true, kind: 'full-build-evaluation' });
      }
    }
    for (const key of FULL_BUILD_EVALUATION_KEYS) {
      if (isObject(source[key])) {
        records.push({ source: source[key], required: true, kind: key });
      }
    }
    const directRank = finalRankInfo(source);
    const directEligibility = finalRankEligibilityInfo(source);
    const directStatus = rankStatusInfo(source);
    if (directRank.present || directEligibility.present || directStatus.present) {
      records.push({ source, required: false, kind: 'candidate' });
    }
    return records;
  }

  function wholeBuildRankProjection(source, config) {
    const raceFit = isObject(source?.raceFit) ? source.raceFit : {};
    const axes = axisMap(source);
    const raceStatus = rankStatusInfo(raceFit);
    const sourceStatus = rankStatusInfo(source);
    const status = raceStatus.present ? raceStatus : sourceStatus;
    const configuredAsWholeBuild = config.axisOrder.length === 1
      && config.axisOrder[0] === 'wholeBuildRank';
    // This is the narrow adapter shape currently emitted by the UI.  Do not
    // accept generic axes, body order, or legacy rank fields as a substitute.
    if (!configuredAsWholeBuild || !status.present) {
      return { present: false, status, rank: { present: false, valid: false, value: null } };
    }
    const rank = own(axes, 'wholeBuildRank')
      ? { present: true, valid: validFinalRank(axes.wholeBuildRank) !== null, value: validFinalRank(axes.wholeBuildRank) }
      : { present: false, valid: false, value: null };
    return { present: true, status, rank };
  }

  function resolveCandidateRankEvidence(source, config, context, index, candidateCount) {
    if (context.present && !context.ready) {
      return { authorized: false, rank: null, status: context.status || 'NEEDS_EVIDENCE' };
    }
    const records = candidateBuildRecords(source, context, index, candidateCount);
    const evidence = {
      authorized: false,
      rank: null,
      status: null,
      invalid: false,
      missing: false,
      ready: context.present && context.ready
    };
    const rankValues = [];
    const addRecord = record => {
      if (!isObject(record.source)) {
        if (record.required) evidence.missing = true;
        return;
      }
      const status = rankStatusInfo(record.source);
      const finalRank = finalRankInfo(record.source);
      const eligibility = finalRankEligibilityInfo(record.source);
      if (record.required && ((!status.present && !(context.present && context.ready))
        || (status.present && !status.recognized) || !finalRank.present)) {
        evidence.missing = true;
      }
      if (status.present) {
        if (!status.recognized || status.status !== 'READY') {
          evidence.status = status.status || 'UNKNOWN';
        } else {
          evidence.ready = true;
        }
      }
      if (finalRank.present) {
        if (!finalRank.valid) evidence.invalid = true;
        else rankValues.push(finalRank.value);
      }
      if (eligibility.present && !eligibility.eligible) evidence.invalid = true;
    };
    records.forEach(addRecord);
    if (context.present && context.hasCandidateRows && !records.some(record => isObject(record.source))) {
      evidence.missing = true;
    }

    const projection = wholeBuildRankProjection(source, config);
    if (projection.present) {
      if (!projection.status.recognized || projection.status.status !== 'READY') {
        evidence.status = projection.status.status || 'UNKNOWN';
      } else {
        evidence.ready = true;
      }
      if (!projection.rank.present || !projection.rank.valid) evidence.invalid = true;
      else rankValues.push(projection.rank.value);
    }

    const uniqueRanks = [...new Set(rankValues)];
    if (evidence.status || evidence.invalid || evidence.missing || !evidence.ready || uniqueRanks.length !== 1) {
      return {
        ...evidence,
        rank: null,
        authorized: false
      };
    }
    return {
      ...evidence,
      rank: uniqueRanks[0],
      authorized: true
    };
  }

  function hasMeaningful(value) {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim() !== '';
    if (typeof value === 'number') return Number.isFinite(value);
    if (Array.isArray(value)) return value.length > 0;
    if (isObject(value)) return Object.keys(value).length > 0;
    return true;
  }

  function normalizedToken(value) {
    return text(value)
      .toLocaleLowerCase('en-US')
      .replace(/[\s_\-./]+/g, '');
  }

  function canonicalServer(value) {
    return text(value).toLowerCase();
  }

  function canonicalEventMode(value) {
    const token = normalizedToken(value);
    return ({
      cm: 'cm',
      cmclassic: 'cm',
      championsmeeting: 'cm',
      championsmeetingclassic: 'cm',
      loh: 'loh',
      legendsofhonor: 'loh',
      legendsofheroes: 'loh'
    })[token] || text(value).toLowerCase();
  }

  function canonicalSurface(value) {
    const token = normalizedToken(value);
    return ({
      '1': 'turf',
      turf: 'turf',
      grass: 'turf',
      草地: 'turf',
      '2': 'dirt',
      dirt: 'dirt',
      mud: 'dirt',
      泥地: 'dirt',
      沙地: 'dirt'
    })[token] || text(value).toLowerCase();
  }

  function canonicalDistanceType(value) {
    const token = normalizedToken(value);
    return ({
      '1': 'short',
      short: 'short',
      短距離: 'short',
      '2': 'mile',
      mile: 'mile',
      英里: 'mile',
      一哩: 'mile',
      '3': 'medium',
      medium: 'medium',
      中距離: 'medium',
      '4': 'long',
      long: 'long',
      長距離: 'long'
    })[token] || text(value).toLowerCase();
  }

  function canonicalRunningStyle(value) {
    const token = normalizedToken(value);
    return ({
      '1': 'runner',
      run: 'runner',
      runner: 'runner',
      escape: 'runner',
      nige: 'runner',
      逃げ: 'runner',
      領頭: 'runner',
      逃馬: 'runner',
      '2': 'leader',
      ldr: 'leader',
      leader: 'leader',
     先行: 'leader',
      前列: 'leader',
      '3': 'betweener',
      btw: 'betweener',
      betweener: 'betweener',
      差し: 'betweener',
      居中: 'betweener',
      '4': 'chaser',
      cha: 'chaser',
      chaser: 'chaser',
      追込: 'chaser',
      追馬: 'chaser',
      '5': 'daitōge',
      daitoge: 'daitōge',
      大逃: 'daitōge'
    })[token] || text(value).toLowerCase();
  }

  function field(source, name) {
    const aliases = {
      server: ['server', 'targetServer', 'target_server'],
      eventMode: ['eventMode', 'event_mode', 'mode'],
      courseId: ['courseId', 'course_id'],
      surface: ['surface', 'groundType', 'ground_type'],
      distanceType: ['distanceType', 'distance_type'],
      distanceM: ['distanceM', 'distance_m', 'distance', 'distanceMeters'],
      runningStyle: ['runningStyle', 'running_style', 'style'],
      objective: ['objective', 'goalObjective', 'goal_objective']
    };
    return firstOwn(source, aliases[name] || [name]);
  }

  function normalizeTarget(raw = {}) {
    const source = isObject(raw) ? raw : {};
    const race = isObject(source.race) ? source.race : {};
    const context = isObject(source.context) ? source.context : {};
    const merged = {
      ...context,
      ...race,
      ...source
    };
    const normalized = {
      id: text(firstOwn(source, ['id', 'targetId', 'target_id', 'key'])),
      targetKey: '',
      server: canonicalServer(field(merged, 'server')),
      eventMode: canonicalEventMode(field(merged, 'eventMode')),
      courseId: numeric(field(merged, 'courseId')),
      surface: canonicalSurface(field(merged, 'surface')),
      distanceType: canonicalDistanceType(field(merged, 'distanceType')),
      distanceM: numeric(field(merged, 'distanceM')),
      runningStyle: canonicalRunningStyle(field(merged, 'runningStyle')),
      objective: sanitize(field(merged, 'objective')),
      ruleset: text(firstOwn(merged, ['ruleset', 'rulesetId', 'ruleset_id'])),
      catalogRaceId: numeric(firstOwn(merged, ['catalogRaceId', 'catalog_race_id', 'raceId', 'race_id'])),
      geometryConfidence: text(firstOwn(merged, ['geometryConfidence', 'geometry_confidence']), 'UNKNOWN'),
      evidenceStatus: text(firstOwn(merged, ['evidenceStatus', 'evidence_status']), 'UNKNOWN'),
      teamComposition: Array.isArray(firstOwn(source, ['teamComposition', 'team_composition']))
        ? firstOwn(source, ['teamComposition', 'team_composition']).map(item => canonicalRunningStyle(item))
        : [],
      label: text(firstOwn(source, ['label', 'name', 'nameZhTw', 'title']))
    };
    normalized.targetKey = stableKey([
      normalized.server || 'unknown',
      normalized.eventMode || 'unknown',
      normalized.courseId ?? 'unknown',
      normalized.surface || 'unknown',
      normalized.distanceType || 'unknown',
      normalized.distanceM ?? 'unknown',
      normalized.runningStyle || 'unknown',
      hasMeaningful(normalized.objective) ? normalized.objective : 'unknown'
    ]);
    return normalized;
  }

  function validateTarget(target) {
    const missing = [];
    for (const name of REQUIRED_TARGET_FIELDS) {
      const value = target?.[name];
      if (name === 'courseId' || name === 'distanceM') {
        if (!Number.isFinite(value)) missing.push(name);
      } else if (!hasMeaningful(value)) {
        missing.push(name);
      }
    }
    return missing;
  }

  function profileView(raw) {
    if (!isObject(raw)) return null;
    const source = isObject(raw.race) ? { ...raw, ...raw.race } : raw;
    const values = {};
    for (const name of ['server', 'eventMode', 'courseId', 'surface', 'distanceType', 'distanceM', 'runningStyle', 'objective']) {
      const rawValue = field(source, name);
      if (!hasMeaningful(rawValue)) continue;
      values[name] = name === 'server'
        ? canonicalServer(rawValue)
        : name === 'eventMode'
          ? canonicalEventMode(rawValue)
          : name === 'courseId' || name === 'distanceM'
            ? numeric(rawValue)
            : name === 'surface'
              ? canonicalSurface(rawValue)
              : name === 'distanceType'
              ? canonicalDistanceType(rawValue)
                : name === 'runningStyle'
                  ? canonicalRunningStyle(rawValue)
                  : stableKey(rawValue);
    }
    return Object.keys(values).length ? values : null;
  }

  function profileMismatches(target, input = {}) {
    const candidates = [];
    const courseTable = input.courseTable;
    if (isObject(courseTable?.profile)) candidates.push(['courseTable.profile', courseTable.profile]);
    if (isObject(courseTable?.targetProfile)) candidates.push(['courseTable.targetProfile', courseTable.targetProfile]);
    if (isObject(courseTable?.context)) candidates.push(['courseTable.context', courseTable.context]);
    if (isObject(courseTable) && !Array.isArray(courseTable)) {
      const top = profileView(courseTable);
      if (top) candidates.push(['courseTable', courseTable]);
    }
    for (const [name, value] of [
      ['profileTarget', input.profileTarget ?? input.profile_target],
      ['planningSnapshot.profile', input.planningSnapshot?.profile],
      ['planningSnapshot.targetProfile', input.planningSnapshot?.targetProfile],
      ['planningSnapshot.context', input.planningSnapshot?.context],
      ['lineagePlan.profile', input.lineagePlan?.profile],
      ['lineagePlan.targetProfile', input.lineagePlan?.targetProfile]
    ]) {
      if (isObject(value)) candidates.push([name, value]);
    }
    const mismatches = [];
    const suppliedTargetKey = text(firstOwn(input.planningSnapshot, [
      'targetKey', 'target_key', 'goalTargetKey', 'goal_target_key'
    ]));
    if (suppliedTargetKey && suppliedTargetKey !== target.targetKey) {
      mismatches.push({
        source: 'planningSnapshot.targetKey',
        field: 'targetKey',
        expected: target.targetKey,
        actual: suppliedTargetKey
      });
    }
    for (const [sourceName, raw] of candidates) {
      const profile = profileView(raw);
      if (!profile) continue;
      for (const name of Object.keys(profile)) {
        if (!hasMeaningful(target[name])) continue;
        const expected = name === 'objective' ? stableKey(target[name]) : target[name];
        if (profile[name] !== expected) {
          mismatches.push({
            source: sourceName,
            field: name,
            expected,
            actual: profile[name]
          });
        }
      }
    }
    return mismatches;
  }

  function arrayFrom(value, keys = []) {
    if (Array.isArray(value)) return value;
    if (!isObject(value)) return [];
    for (const key of keys) {
      if (Array.isArray(value[key])) return value[key];
    }
    return [];
  }

  function courseRows(courseTable) {
    if (Array.isArray(courseTable)) return courseTable;
    if (!isObject(courseTable)) return [];
    for (const key of ['families', 'targets', 'rows', 'skills', 'courseSkills', 'course_skills', 'requirements']) {
      if (Array.isArray(courseTable[key])) return courseTable[key];
    }
    return [];
  }

  function rawIdentifiers(row) {
    const source = isObject(row) ? row : {};
    const values = [
      firstOwn(source, ['id', 'targetId', 'target_id', 'requiredSkillId', 'required_skill_id', 'skillId', 'skill_id']),
      firstOwn(source, ['familyId', 'family_id', 'skillFamilyId', 'skill_family_id', 'canonicalFamilyId', 'canonical_family_id']),
      firstOwn(source, ['coverageTargetId', 'coverage_target_id']),
      firstOwn(source, ['coverageTargetKey', 'coverage_target_key', 'coverageKey', 'coverage_key'])
    ];
    return values
      .flatMap(value => Array.isArray(value) ? value : [value])
      .filter(hasMeaningful)
      .map(value => String(value));
  }

  function skillFamilyInfo(raw, index = 0) {
    const source = isObject(raw) ? raw : {};
    const explicit = firstOwn(source, [
      'canonicalFamilyId', 'canonical_family_id', 'skillFamilyId', 'skill_family_id',
      'familyId', 'family_id', 'familyKey', 'family_key'
    ]);
    const familyIds = [
      ...(Array.isArray(source.familyIds) ? source.familyIds : []),
      ...(Array.isArray(source.family_ids) ? source.family_ids : [])
    ].filter(hasMeaningful);
    const familyId = hasMeaningful(explicit) ? explicit : familyIds[0];
    const skillId = firstOwn(source, ['skillId', 'skill_id', 'requiredSkillId', 'required_skill_id', 'id']);
    const name = text(firstOwn(source, ['nameZhTw', 'name', 'skillName', 'skill_name', 'label']));
    let familyKey;
    if (hasMeaningful(familyId)) {
      familyKey = `family:${String(familyId).trim().toLowerCase()}`;
    } else if (name) {
      familyKey = `name:${normalizedToken(name)}`;
    } else if (hasMeaningful(skillId)) {
      familyKey = `skill:${String(skillId).trim().toLowerCase()}`;
    } else {
      familyKey = `row:${index}`;
    }
    const aliases = [familyKey, ...familyIds.map(value => `family:${String(value).trim().toLowerCase()}`)];
    return {
      familyId: hasMeaningful(familyId)
        ? (numeric(familyId) === null ? String(familyId) : numeric(familyId))
        : null,
      familyKey,
      aliases: [...new Set(aliases)],
      skillId: numeric(skillId) === null ? (hasMeaningful(skillId) ? String(skillId) : null) : numeric(skillId),
      name
    };
  }

  function requirementLevel(row) {
    const raw = text(firstOwn(row, ['requirementLevel', 'requirement_level', 'level'])).toUpperCase();
    if (['RULE_REQUIRED', 'USER_REQUIRED', 'RECOMMENDED', 'OPTIONAL'].includes(raw)) return raw;
    if (row?.required === true || row?.hard === true) return 'USER_REQUIRED';
    return 'RECOMMENDED';
  }

  function requirementRank(level) {
    return ({ RULE_REQUIRED: 4, USER_REQUIRED: 3, RECOMMENDED: 2, OPTIONAL: 1 })[level] || 0;
  }

  function selectedIdSet(selectedTargetIds) {
    return new Set((Array.isArray(selectedTargetIds) ? selectedTargetIds : [])
      .filter(hasMeaningful)
      .map(value => String(value)));
  }

  function rowMatchesSelection(row, info, selected) {
    if (!selected.size) return true;
    const keys = new Set([
      ...rawIdentifiers(row),
      ...info.aliases,
      info.familyId === null ? '' : String(info.familyId),
      info.skillId === null ? '' : String(info.skillId)
    ].filter(Boolean));
    return [...selected].some(value => keys.has(value));
  }

  function normalizeRequirementRow(raw, index, targetKey) {
    const source = isObject(raw) ? raw : {};
    const info = skillFamilyInfo(source, index);
    const id = firstOwn(source, ['id', 'targetId', 'target_id', 'requiredSkillId', 'required_skill_id', 'skillId', 'skill_id']);
    return {
      targetId: hasMeaningful(id) ? (numeric(id) === null ? String(id) : numeric(id)) : `target-${index + 1}`,
      skillId: info.skillId,
      familyId: info.familyId,
      skillFamilyId: info.familyId,
      canonicalFamilyKey: info.familyKey,
      familyAliases: info.aliases,
      name: info.name,
      kind: text(firstOwn(source, ['kind', 'type', 'category']), 'skill'),
      sourceEligibility: Array.isArray(firstOwn(source, ['sourceEligibility', 'source_eligibility']))
        ? firstOwn(source, ['sourceEligibility', 'source_eligibility']).map(text).filter(Boolean)
        : [],
      timingWindow: text(firstOwn(source, ['timingWindow', 'timing_window', 'window'])),
      requirementLevel: requirementLevel(source),
      reason: text(firstOwn(source, ['reason', 'description', 'note'])),
      targetKey,
      dedupeKey: `${targetKey}|${info.familyKey}`,
      sourceIds: rawIdentifiers(source),
      sourceIndex: index
    };
  }

  function buildRequirements(input, target) {
    const selected = selectedIdSet(input.selectedTargetIds);
    const rows = courseRows(input.courseTable);
    const sourceRows = rows.length ? rows : snapshotRows(input.planningSnapshot);
    const selectedRows = sourceRows
      .map((row, index) => ({ row, index, info: skillFamilyInfo(row, index) }))
      .filter(entry => rowMatchesSelection(entry.row, entry.info, selected));
    const groups = [];
    const aliasToGroup = new Map();
    for (const entry of selectedRows) {
      const normalized = normalizeRequirementRow(entry.row, entry.index, target.targetKey);
      let groupIndex = null;
      for (const alias of normalized.familyAliases) {
        if (aliasToGroup.has(alias)) {
          groupIndex = aliasToGroup.get(alias);
          break;
        }
      }
      if (groupIndex === null) {
        groupIndex = groups.length;
        groups.push(normalized);
      } else {
        const current = groups[groupIndex];
        const preferred = requirementRank(normalized.requirementLevel) > requirementRank(current.requirementLevel)
          ? normalized
          : current;
        groups[groupIndex] = {
          ...preferred,
          sourceIds: [...new Set([...current.sourceIds, ...normalized.sourceIds])],
          familyAliases: [...new Set([...current.familyAliases, ...normalized.familyAliases])],
          duplicateCount: (current.duplicateCount || 1) + 1,
          skillIds: [...new Set([
            ...(current.skillIds || (current.skillId === null ? [] : [current.skillId])),
            ...(normalized.skillIds || (normalized.skillId === null ? [] : [normalized.skillId]))
          ])]
        };
      }
      for (const alias of normalized.familyAliases) aliasToGroup.set(alias, groupIndex);
    }
    const normalizedRows = groups.map(row => ({
      ...row,
      duplicateCount: row.duplicateCount || 1,
      skillIds: row.skillIds || (row.skillId === null ? [] : [row.skillId])
    }));
    const unresolvedSelectedTargetIds = [...selected].filter(value => !normalizedRows.some(row =>
      row.sourceIds.includes(value)
        || row.familyAliases.includes(value)
        || String(row.familyId) === value
        || String(row.skillId) === value
    ));
    return {
      rows: normalizedRows,
      must: normalizedRows.filter(row => ['RULE_REQUIRED', 'USER_REQUIRED'].includes(row.requirementLevel)),
      recommended: normalizedRows.filter(row => !['RULE_REQUIRED', 'USER_REQUIRED'].includes(row.requirementLevel)),
      selectedTargetIds: [...selected],
      unresolvedSelectedTargetIds,
      sourceRowCount: sourceRows.length
    };
  }

  function snapshotRows(snapshot) {
    if (!isObject(snapshot)) return [];
    const rows = [];
    for (const key of ['rows', 'selectedRows', 'targets', 'coverageTargets', 'coverageByFamily']) {
      const value = snapshot[key];
      if (Array.isArray(value)) rows.push(...value);
      else if (isObject(value)) rows.push(...Object.values(value));
    }
    for (const parentKey of ['coverageSummary', 'factorCoverage', 'coverage', 'allCoverage']) {
      const parent = snapshot[parentKey];
      if (!isObject(parent)) continue;
      for (const key of ['targets', 'rows', 'coverageByFamily']) {
        const value = parent[key];
        if (Array.isArray(value)) rows.push(...value);
        else if (isObject(value)) rows.push(...Object.values(value));
      }
    }
    return rows;
  }

  function coverageState(raw) {
    const value = text(firstOwn(raw, ['coverageState', 'coverage_state', 'state'])).toUpperCase();
    if (['COVERED', 'CERTAIN', 'CONFIRMED', 'FULL'].includes(value)) return 'COVERED';
    if (['PARTIAL', 'PARTIALLY_COVERED', 'PARTIALLY-COVERED'].includes(value)) return 'PARTIAL';
    if (['GAP', 'UN covered'.replace(' ', ''), 'UNCOVERED', 'NONE'].includes(value)) return 'GAP';
    return 'UNKNOWN';
  }

  function routeRows(raw) {
    const value = firstOwn(raw, ['coverageRoutes', 'coverage_routes', 'routes']);
    return Array.isArray(value) ? value : [];
  }

  function routeText(route) {
    const source = isObject(route) ? route : {};
    return [
      source.coverClass, source.coverageClass, source.class, source.type, source.source,
      source.routeType, source.route_type, source.sourceKind, source.source_kind,
      source.kind, source.evidenceStatus, source.evidence_status, source.status
    ].filter(hasMeaningful).map(value => normalizedToken(value)).join('|');
  }

  function routeStatus(route) {
    const source = isObject(route) ? route : {};
    return text(firstOwn(source, ['status', 'evidenceStatus', 'evidence_status', 'certainty']), '').toUpperCase();
  }

  function explicitRouteClass(route) {
    const token = routeText(route);
    if (/nativecertain|native|umacertain|characterbuilt|builtin|bodycertain|selfcertain/.test(token)) {
      return 'NATIVE_CERTAIN';
    }
    if (/directparent|parentunique|inheritedparent|parentcertain/.test(token)) {
      return 'DIRECT_PARENT_CERTAIN';
    }
    if (/deckconfirmed|deck|supportcard|supportevent|supporthint|battledeck|exactroute/.test(token)) {
      return 'DECK_CONFIRMED';
    }
    if (/existingfactor|verifiedfactor|factorconfirmed|factor/.test(token)) {
      return 'EXISTING_FACTOR_CONFIRMED';
    }
    return null;
  }

  function routeIsCertain(route, state) {
    const status = normalizedToken(routeStatus(route));
    if (!status) return state === 'COVERED';
    return new Set([
      'certain',
      'confirmed',
      'userconfirmed',
      'userrecorded',
      'verified',
      'satisfied',
      'pass',
      'ready'
    ]).has(status);
  }

  function deckConfirmationView(raw) {
    const source = isObject(raw) ? raw : {};
    const explicitStatus = text(firstOwn(source, ['status', 'confirmationStatus', 'confirmation_status', 'selectionStatus']), '').toUpperCase();
    const statusToken = normalizedToken(explicitStatus);
    const explicitlyNegative = [
      'unconfirmed', 'notconfirmed', 'unknown', 'unverified', 'pending', 'missing', 'blocked'
    ].includes(statusToken);
    const confirmed = !explicitlyNegative && (
      raw === true
      || source.confirmed === true
      || source.valid === true && ['CONFIRMED', 'READY', 'APPLIED'].includes(explicitStatus)
      || ['CONFIRMED', 'USER_CONFIRMED', 'APPLIED', 'READY'].includes(explicitStatus)
    );
    const ids = [
      ...(Array.isArray(source.confirmedTargetIds) ? source.confirmedTargetIds : []),
      ...(Array.isArray(source.confirmedSkillIds) ? source.confirmedSkillIds : []),
      ...(Array.isArray(source.confirmedFamilyIds) ? source.confirmedFamilyIds : []),
      ...(Array.isArray(source.targetIds) ? source.targetIds : []),
      ...(Array.isArray(source.skillIds) ? source.skillIds : []),
      ...(Array.isArray(source.familyIds) ? source.familyIds : [])
    ].filter(hasMeaningful).map(value => String(value));
    return {
      status: confirmed ? 'CONFIRMED' : explicitStatus || (isObject(raw) ? 'UNKNOWN' : 'UNCONFIRMED'),
      confirmed,
      exactRoute: source.exactRoute === true || source.exact_route === true,
      ids: [...new Set(ids)],
      source: text(firstOwn(source, ['source', 'evidenceStatus', 'evidence_status']))
    };
  }

  function deckConfirmsTarget(deck, requirement) {
    if (!deck.confirmed) return false;
    if (!deck.ids.length) return false;
    const values = new Set([
      ...requirement.sourceIds,
      ...requirement.familyAliases,
      requirement.familyId === null ? '' : String(requirement.familyId),
      requirement.skillId === null ? '' : String(requirement.skillId),
      String(requirement.targetId)
    ].filter(Boolean));
    return deck.ids.some(id => values.has(id));
  }

  function routeReference(route, index) {
    const source = isObject(route) ? route : {};
    const type = text(firstOwn(source, ['type', 'source', 'routeType', 'sourceKind', 'kind']), 'unknown');
    return {
      routeId: text(firstOwn(source, ['id', 'routeId', 'route_id']), `route-${index + 1}`),
      type,
      status: routeStatus(source) || 'UNKNOWN',
      cardId: numeric(firstOwn(source, ['cardId', 'card_id', 'supportId', 'support_id'])),
      stepId: text(firstOwn(source, ['stepId', 'step_id', 'sourceStepId', 'source_step_id'])),
      recordId: text(firstOwn(source, ['recordId', 'record_id', 'breederRecordId', 'breeder_record_id'])),
      evidenceStatus: text(firstOwn(source, ['evidenceStatus', 'evidence_status']), 'UNKNOWN'),
      classHint: explicitRouteClass(source)
    };
  }

  function snapshotRowMatches(requirement, row) {
    const rowTargetKey = text(firstOwn(row, [
      'targetKey', 'target_key', 'goalTargetKey', 'goal_target_key'
    ]));
    if (rowTargetKey && rowTargetKey !== requirement.targetKey) return false;
    const info = skillFamilyInfo(row);
    const ids = new Set([
      ...rawIdentifiers(row),
      ...info.aliases,
      info.familyId === null ? '' : String(info.familyId),
      info.skillId === null ? '' : String(info.skillId),
      text(firstOwn(row, ['name', 'nameZhTw', 'skillName', 'skill_name']))
    ].filter(Boolean).map(value => String(value)));
    const wanted = new Set([
      ...requirement.sourceIds,
      ...requirement.familyAliases,
      requirement.familyId === null ? '' : String(requirement.familyId),
      requirement.skillId === null ? '' : String(requirement.skillId),
      String(requirement.targetId),
      requirement.name
    ].filter(Boolean));
    return [...wanted].some(value => ids.has(value));
  }

  function classForSnapshot(requirement, row, deck) {
    const state = coverageState(row);
    const routes = routeRows(row);
    const classes = [];
    for (const route of routes) {
      const hint = explicitRouteClass(route);
      if (hint && routeIsCertain(route, state)) {
        if (hint === 'DECK_CONFIRMED') {
          if (deckConfirmsTarget(deck, requirement)) {
            classes.push(hint);
          }
        } else {
          classes.push(hint);
        }
      } else if (!hint
        && routeIsCertain(route, state)
        && deckConfirmsTarget(deck, requirement)
        && /support|deck|card|hint|event/.test(routeText(route))) {
        // A planning snapshot may label a confirmed support route as
        // support-event/support-hint rather than "deck".  The deck
        // confirmation is accepted only for this target's supplied route;
        // coverageState/routes still remain the deduction source.
        classes.push('DECK_CONFIRMED');
      }
    }
    if (classes.length) {
      return classes.sort((left, right) => COVER_CLASS_ORDER[right] - COVER_CLASS_ORDER[left])[0];
    }
    if (state === 'PARTIAL') return 'PARTIAL_ROUTE';
    if (state === 'UNKNOWN') return 'UNRESOLVED';
    if (state === 'GAP') return 'UNRESOLVED';
    // A covered row without an identifiable route is intentionally not
    // promoted.  The snapshot is the only source of deduction state.
    return 'UNRESOLVED';
  }

  function residualRow(requirement, snapshotMatches, deck) {
    const matches = snapshotMatches.length ? snapshotMatches : [null];
    const classified = matches.map(row => ({
      row,
      className: row ? classForSnapshot(requirement, row, deck) : 'UNRESOLVED',
      state: row ? coverageState(row) : 'UNKNOWN',
      routes: row ? routeRows(row) : []
    }));
    classified.sort((left, right) => COVER_CLASS_ORDER[right.className] - COVER_CLASS_ORDER[left.className]);
    const chosen = classified[0];
    const source = chosen.row || {};
    const state = chosen.state;
    const sourceResidualWeight = numeric(firstOwn(source, ['residualWeight', 'residualNeed', 'residual_weight', 'residual_need']));
    return {
      targetId: requirement.targetId,
      skillId: requirement.skillId,
      familyId: requirement.familyId,
      skillFamilyId: requirement.skillFamilyId,
      canonicalFamilyKey: requirement.canonicalFamilyKey,
      dedupeKey: requirement.dedupeKey,
      name: requirement.name,
      kind: requirement.kind,
      requirementLevel: requirement.requirementLevel,
      coverageClass: chosen.className,
      coverClass: chosen.className,
      coverageState: state,
      routeTypes: [...new Set(chosen.routes.map(route => text(firstOwn(route, ['type', 'source', 'routeType', 'sourceKind', 'kind']), 'unknown')))],
      coverageRoutes: chosen.routes.map(routeReference),
      sourceRowIds: matches.filter(Boolean).map((row, index) => text(firstOwn(row, ['id', 'targetId', 'coverageTargetId', 'coverageTargetKey']), `snapshot-row-${index + 1}`)),
      sourceResidualWeight,
      residualDisposition: ['NATIVE_CERTAIN', 'DIRECT_PARENT_CERTAIN', 'DECK_CONFIRMED', 'EXISTING_FACTOR_CONFIRMED'].includes(chosen.className)
        ? 'DEDUCTED'
        : chosen.className === 'PARTIAL_ROUTE'
          ? 'PARTIAL_REMAINS'
          : 'NOT_DEDUCED',
      duplicateCount: Math.max(requirement.duplicateCount || 1, matches.length),
      targetKey: requirement.targetKey
    };
  }

  function buildResidual(input, target, requirements) {
    const suppliedTargetKey = text(firstOwn(input.planningSnapshot, [
      'targetKey', 'target_key', 'goalTargetKey', 'goal_target_key'
    ]));
    const snapshot = suppliedTargetKey && suppliedTargetKey !== target.targetKey
      ? null
      : input.planningSnapshot;
    const rows = snapshotRows(snapshot);
    const deck = deckConfirmationView(input.deckConfirmation);
    const residualRows = requirements.rows.map(requirement => residualRow(
      requirement,
      rows.filter(row => snapshotRowMatches(requirement, row)),
      deck
    ));
    const remainingTargets = residualRows.filter(row =>
      ['PARTIAL_ROUTE', 'UNRESOLVED'].includes(row.coverageClass)
    );
    const deductedTargets = residualRows.filter(row => !remainingTargets.includes(row));
    return {
      source: 'planningSnapshot',
      sourcePresent: isObject(snapshot),
      deductionOrder: [...DEDUCTION_ORDER],
      coverClasses: [...COVER_CLASSES],
      targets: residualRows,
      remainingTargets,
      deductedTargets,
      selectedTargetIds: [...requirements.selectedTargetIds],
      unresolvedTargetIds: residualRows.filter(row => row.coverageClass === 'UNRESOLVED').map(row => row.targetId),
      partialTargetIds: residualRows.filter(row => row.coverageClass === 'PARTIAL_ROUTE').map(row => row.targetId),
      deck
    };
  }

  function candidateRows(input) {
    const source = input.raceFitCandidates ?? input.race_fit_candidates;
    if (Array.isArray(source)) return source;
    const battle = input.battleHorse ?? input.battle_horse;
    if (Array.isArray(battle)) return battle;
    if (isObject(battle)) {
      if (isObject(battle.selectedCandidate) || isObject(battle.candidate)) {
        return [battle.selectedCandidate || battle.candidate];
      }
      for (const key of ['candidates', 'raceFitCandidates', 'race_fit_candidates', 'rows']) {
        if (Array.isArray(battle[key])) return battle[key];
      }
      if (isObject(battle.raceFit) || isObject(battle.axes) || isObject(battle.axisValues)) return [battle];
    }
    return [];
  }

  function raceFitConfig(input, candidates) {
    const battle = isObject(input.battleHorse) ? input.battleHorse : {};
    const first = candidates.find(isObject) || {};
    const nested = isObject(first.raceFit) ? first.raceFit : {};
    const configured = firstOwn(input, ['raceFitAxes', 'race_fit_axes', 'axisOrder', 'axis_order'])
      ?? firstOwn(battle, ['raceFitAxes', 'race_fit_axes', 'axisOrder', 'axis_order'])
      ?? firstOwn(nested, ['axisOrder', 'axis_order']);
    const order = Array.isArray(configured) && configured.length
      ? configured.map(text).filter(Boolean)
      : (() => {
          const firstAxes = firstOwn(first, ['axes', 'axisValues', 'axis_values'])
            ?? firstOwn(nested, ['axes', 'axisValues', 'axis_values']);
          if (isObject(firstAxes) && Object.keys(firstAxes).length) return Object.keys(firstAxes);
          return [...DEFAULT_RACE_FIT_AXES];
        })();
    const directions = {
      ...(isObject(firstOwn(battle, ['axisDirections', 'axis_directions']))
        ? firstOwn(battle, ['axisDirections', 'axis_directions'])
        : {}),
      ...(isObject(firstOwn(input, ['axisDirections', 'axis_directions']))
        ? firstOwn(input, ['axisDirections', 'axis_directions'])
        : {})
    };
    return {
      axisOrder: [...new Set(order)],
      directions: Object.fromEntries(Object.entries(directions).map(([key, value]) => [
        key,
        normalizedToken(value) === 'min' || normalizedToken(value) === 'lower' ? 'min' : 'max'
      ]))
    };
  }

  function axisValue(raw) {
    if (isObject(raw)) {
      const nested = firstOwn(raw, ['value', 'rank', 'score', 'level', 'amount']);
      if (nested !== undefined) return axisValue(nested);
      const status = normalizedToken(firstOwn(raw, ['status', 'state']));
      if (['confirmed', 'ready', 'good', 'high', 'pass'].includes(status)) return 1;
      if (['unknown', 'unverified', 'pending', 'missing'].includes(status)) return null;
      return null;
    }
    const number = numeric(raw);
    if (number !== null) return number;
    const token = normalizedToken(raw);
    if ([
      'unknown', 'unverified', 'pending', 'missing', 'na', 'notavailable',
      'needsevidence', 'uncertain', 'unconfirmed', 'notconfirmed'
    ].includes(token)) return null;
    const rank = { s: 7, a: 6, b: 5, c: 4, d: 3, e: 2, f: 1, g: 0 }[token];
    return rank === undefined ? (hasMeaningful(raw) ? text(raw) : null) : rank;
  }

  function axisMap(candidate) {
    const source = isObject(candidate) ? candidate : {};
    const raceFit = isObject(source.raceFit) ? source.raceFit : {};
    const axes = firstOwn(source, ['axes', 'axisValues', 'axis_values'])
      ?? firstOwn(raceFit, ['axes', 'axisValues', 'axis_values'])
      ?? {};
    return isObject(axes) ? axes : {};
  }

  function compareValues(left, right, direction) {
    const a = axisValue(left);
    const b = axisValue(right);
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    if (typeof a === 'string' || typeof b === 'string') {
      const result = String(a).localeCompare(String(b), 'en', { numeric: true });
      return direction === 'min' ? result : -result;
    }
    return direction === 'min' ? a - b : b - a;
  }

  function dominates(left, right, config) {
    let strictlyBetter = false;
    let shared = 0;
    for (const axis of config.axisOrder) {
      const a = axisValue(left._axes?.[axis]);
      const b = axisValue(right._axes?.[axis]);
      if (a === null || b === null || typeof a === 'string' || typeof b === 'string') continue;
      shared += 1;
      const direction = config.directions[axis] || 'max';
      const difference = direction === 'min' ? a - b : b - a;
      if (difference > 0) return false;
      if (difference < 0) strictlyBetter = true;
    }
    return shared > 0 && strictlyBetter;
  }

  function codePointCompare(left, right) {
    const a = Array.from(String(left));
    const b = Array.from(String(right));
    const length = Math.min(a.length, b.length);
    for (let index = 0; index < length; index += 1) {
      const diff = a[index].codePointAt(0) - b[index].codePointAt(0);
      if (diff) return diff;
    }
    return a.length - b.length;
  }

  function normalizeCandidate(raw, index, config, residual, rankContext = {}) {
    const source = isObject(raw) ? raw : {};
    const nested = isObject(source.raceFit) ? source.raceFit : {};
    const axesSource = axisMap(source);
    const axes = Object.fromEntries(config.axisOrder.map(axis => [
      axis,
      hasMeaningful(axesSource[axis]) ? sanitize(axesSource[axis]) : null
    ]));
    const numericAxes = Object.fromEntries(config.axisOrder.map(axis => [axis, axisValue(axesSource[axis])]));
    const rankEvidence = resolveCandidateRankEvidence(
      source,
      config,
      rankContext.fullBuildEvaluation || fullBuildEvaluationContext({}, 0),
      index,
      rankContext.candidateCount || 1
    );
    const raceStatus = rankStatusInfo(nested);
    const sourceStatus = rankStatusInfo(source);
    const status = raceStatus.present && (!raceStatus.recognized || raceStatus.status !== 'READY')
      ? (raceStatus.status || 'UNKNOWN')
      : sourceStatus.present && (!sourceStatus.recognized || sourceStatus.status !== 'READY')
        ? (sourceStatus.status || 'UNKNOWN')
        : rankEvidence.status || (rankEvidence.authorized ? 'READY' : 'NEEDS_EVIDENCE');
    const candidateId = firstOwn(source, ['candidateId', 'candidate_id', 'id', 'outfitId', 'outfit_id', 'characterId', 'character_id']);
    const id = hasMeaningful(candidateId) ? String(candidateId) : `candidate-${index + 1}`;
    return {
      id,
      candidateId: id,
      name: text(firstOwn(source, ['name', 'nameZhTw', 'candidateName', 'candidate_name']), id),
      aptitude: sanitize(firstOwn(source, ['aptitude', 'aptitudes', 'nativeAptitude']) || {}),
      uniqueSkillIds: (Array.isArray(firstOwn(source, ['uniqueSkillIds', 'unique_skill_ids']))
        ? firstOwn(source, ['uniqueSkillIds', 'unique_skill_ids']) : []).map(value => numeric(value) ?? String(value)),
      deckIds: (Array.isArray(firstOwn(source, ['deckIds', 'deck_ids', 'supportIds', 'support_ids']))
        ? firstOwn(source, ['deckIds', 'deck_ids', 'supportIds', 'support_ids']) : []).map(value => numeric(value) ?? String(value)),
      raceFit: {
        axes,
        axisOrder: [...config.axisOrder],
        directions: Object.fromEntries(config.axisOrder.map(axis => [axis, config.directions[axis] || 'max'])),
        method: 'lexicographic+pareto',
        axisValues: numericAxes,
        missingAxes: config.axisOrder.filter(axis => numericAxes[axis] === null),
        status,
        paretoOptimal: false,
        rank: null,
        dominanceCount: 0,
        dominatedBy: []
      },
      acquisition: sanitize(firstOwn(source, ['acquisition', 'availability', 'sourceEligibility']) || {}),
      remainingTargets: clone(residual.remainingTargets),
      winStrength: { value: null, status: 'UNKNOWN' },
      _axes: numericAxes,
      _rankEvidence: rankEvidence
    };
  }

  function rankRaceFit(input, residual) {
    const raw = candidateRows(input);
    const config = raceFitConfig(input, raw);
    const fullBuildEvaluation = fullBuildEvaluationContext(input, raw.length);
    const rows = raw.map((candidate, index) => normalizeCandidate(
      candidate,
      index,
      config,
      residual,
      { fullBuildEvaluation, candidateCount: raw.length }
    ));
    for (const left of rows) {
      for (const right of rows) {
        if (left === right) continue;
        if (dominates(right, left, config)) {
          left.raceFit.dominanceCount += 1;
          left.raceFit.dominatedBy.push(right.id);
        }
      }
    }
    rows.forEach(row => {
      row.raceFit.paretoOptimal = row.raceFit.dominanceCount === 0;
    });
    rows.sort((left, right) => {
      if (left.raceFit.paretoOptimal !== right.raceFit.paretoOptimal) {
        return left.raceFit.paretoOptimal ? -1 : 1;
      }
      for (const axis of config.axisOrder) {
        const diff = compareValues(left._axes[axis], right._axes[axis], config.directions[axis] || 'max');
        if (diff) return diff;
      }
      return codePointCompare(left.id, right.id);
    });
    rows.forEach(row => {
      row.raceFit.rank = row._rankEvidence.authorized ? row._rankEvidence.rank : null;
      delete row._axes;
      delete row._rankEvidence;
    });
    const selectedId = firstOwn(input, ['selectedBattleHorseId', 'selected_battle_horse_id', 'selectedCandidateId', 'selected_candidate_id']);
    const selected = rows.find(row => String(row.id) === String(selectedId)) || rows[0] || null;
    return {
      candidates: rows,
      selected,
      axisOrder: [...config.axisOrder],
      directions: Object.fromEntries(config.axisOrder.map(axis => [axis, config.directions[axis] || 'max'])),
      method: 'lexicographic+pareto',
      status: !rows.length ? 'NEEDS_EVIDENCE' : rows.some(row => row.raceFit.rank === null) ? 'NEEDS_EVIDENCE' : 'READY'
    };
  }

  function normalizeStage(value) {
    const token = normalizedToken(value);
    if (['parent', 'directparent', 'direct_parent', 'direct'].includes(token)) return 'direct_parent';
    if (['grandparent', 'grand_parent', 'grand'].includes(token)) return 'grandparent';
    if (['foundation', 'foundationseed', 'seed', 'base'].includes(token)) return 'foundation';
    return text(value).toLowerCase();
  }

  function lineageStepRows(plan) {
    if (!isObject(plan)) return [];
    const rows = [];
    for (const key of ['workOrder', 'work_order', 'steps', 'lineageWorkSteps', 'lineage_work_steps']) {
      if (Array.isArray(plan[key])) rows.push(...plan[key]);
    }
    if (rows.length) return rows;
    for (const [stage, keys] of Object.entries({
      direct_parent: ['directParents', 'direct_parents', 'parents'],
      grandparent: ['grandparents', 'grand_parents'],
      foundation: ['foundations', 'foundationCandidates', 'foundation_candidates']
    })) {
      for (const key of keys) {
        if (!Array.isArray(plan[key])) continue;
        plan[key].forEach((row, index) => rows.push({ ...row, stage, id: row?.id || `${stage}:${index + 1}` }));
        break;
      }
    }
    return rows;
  }

  function breederRecords(raw) {
    if (Array.isArray(raw)) return raw.map((record, index) => [text(record?.id, `record-${index + 1}`), record]);
    if (!isObject(raw)) return [];
    const source = Array.isArray(raw.records) ? raw.records : raw;
    if (Array.isArray(source)) return source.map((record, index) => [text(record?.id, `record-${index + 1}`), record]);
    return Object.entries(source).filter(([, record]) => isObject(record));
  }

  function bindingMap(raw) {
    if (Array.isArray(raw)) {
      return new Map(raw.map(row => [
        text(firstOwn(row, ['stepId', 'step_id', 'id'])),
        row
      ]).filter(([key]) => key));
    }
    const source = isObject(raw) ? (isObject(raw.byStep) ? raw.byStep : isObject(raw.bindings) ? raw.bindings : raw) : {};
    return new Map(Object.entries(source));
  }

  function bindingRecordId(binding) {
    if (!hasMeaningful(binding)) return '';
    if (!isObject(binding)) return String(binding);
    return text(firstOwn(binding, ['recordId', 'record_id', 'breederRecordId', 'breeder_record_id', 'id']))
      || text(binding.record?.id);
  }

  function recordProvenance(record) {
    const source = isObject(record) ? record : {};
    const tokens = new Set([
      firstOwn(source, ['sourceStatus', 'source_status']),
      firstOwn(source, ['evidenceStatus', 'evidence_status']),
      firstOwn(source, ['provenanceStatus', 'provenance_status']),
      firstOwn(source, ['sourceKind', 'source_kind']),
      firstOwn(source, ['source']),
      firstOwn(source.provenance, ['status', 'source', 'kind'])
    ].filter(hasMeaningful).map(value => normalizedToken(value)));
    const hasAny = values => values.some(value => tokens.has(value));
    if (hasAny(['historicalpublicsnapshot', 'publicsnapshot', 'historicalsnapshot', 'archivedsnapshot'])) {
      return 'HISTORICAL_PUBLIC_SNAPSHOT';
    }
    if (hasAny(['historicalrental', 'rentalhistory', 'historicalborrow', 'rentalsnapshot'])) {
      return 'HISTORICAL_RENTAL';
    }
    if (hasAny(['userconfirmedrental'])) return 'USER_CONFIRMED_RENTAL';
    if (hasAny(['userrecorded', 'localstorage', 'localrecord', 'evidenced', 'userconfirmed'])) {
      return 'USER_RECORDED';
    }
    if (hasAny(['projected', 'planned'])) return 'PROJECTED';
    return 'UNKNOWN';
  }

  function bindStep(step, recordsById, bindings) {
    const stepId = text(step?.id);
    if (!stepId) {
      return {
        stepId: '', recordId: null, status: 'UNBOUND', evidenceStatus: 'UNVERIFIED',
        exactStepBinding: false, usableForEvidence: false, reason: 'step.id missing'
      };
    }
    if (!bindings.has(stepId)) {
      return {
        stepId, recordId: null, status: 'UNBOUND', evidenceStatus: 'UNVERIFIED',
        exactStepBinding: false, usableForEvidence: false, reason: 'no exact step.id binding'
      };
    }
    const binding = bindings.get(stepId);
    const recordId = bindingRecordId(binding);
    const record = recordsById.get(recordId) || null;
    if (!record) {
      return {
        stepId, recordId: recordId || null, status: 'MISSING_REGISTERED_RECORD', evidenceStatus: 'UNVERIFIED',
        exactStepBinding: true, usableForEvidence: false, reason: 'binding does not resolve to a registered breeder record'
      };
    }
    const provenance = recordProvenance(record);
    if (provenance === 'HISTORICAL_PUBLIC_SNAPSHOT' || provenance === 'HISTORICAL_RENTAL') {
      return {
        stepId, recordId, status: provenance, evidenceStatus: provenance,
        exactStepBinding: true, usableForEvidence: false, reason: 'historical rental/snapshot cannot become USER_RECORDED'
      };
    }
    if (provenance === 'USER_RECORDED' || provenance === 'USER_CONFIRMED_RENTAL') {
      return {
        stepId, recordId, status: 'USER_RECORDED', evidenceStatus: 'USER_RECORDED',
        exactStepBinding: true, usableForEvidence: true, sourceStatus: provenance, record: {
          id: recordId,
          outfitId: numeric(firstOwn(record, ['outfitId', 'outfit_id'])),
          characterId: numeric(firstOwn(record, ['characterId', 'character_id'])),
          name: text(firstOwn(record, ['name', 'nameZhTw', 'label']))
        }
      };
    }
    return {
      stepId, recordId, status: provenance === 'PROJECTED' ? 'PROJECTED' : 'UNVERIFIED',
      evidenceStatus: provenance === 'PROJECTED' ? 'PROJECTED' : 'UNVERIFIED',
      exactStepBinding: true, usableForEvidence: false
    };
  }

  function g1Identity(row) {
    const id = firstOwn(row, ['canonicalRaceId', 'canonical_race_id', 'raceId', 'race_id', 'catalogRaceId', 'catalog_race_id', 'id']);
    return hasMeaningful(id) ? String(id) : text(firstOwn(row, ['nameZhTw', 'name', 'nameJp']));
  }

  function normalizeG1(row, sourceKind) {
    const source = isObject(row) ? row : {};
    const projected = sourceKind === 'projected';
    const canonicalRaceId = numeric(firstOwn(source, ['canonicalRaceId', 'canonical_race_id', 'raceId', 'race_id']));
    const finish = numeric(firstOwn(source, ['finishPosition', 'finish_position', 'place', 'rank']));
    const outcome = normalizedToken(firstOwn(source, ['outcome', 'result', 'status']));
    const explicitConfirmed = !projected
      && (text(firstOwn(source, ['evidenceStatus', 'evidence_status', 'verificationStatus', 'verification_status'])).toUpperCase() === 'CONFIRMED'
        || text(firstOwn(source, ['status'])).toUpperCase() === 'CONFIRMED')
      && (outcome === 'win' || finish === 1 || source.win === true || source.won === true);
    const status = projected ? 'PROJECTED' : explicitConfirmed && canonicalRaceId !== null ? 'CONFIRMED' : 'UNVERIFIED';
    return {
      raceId: g1Identity(source),
      canonicalRaceId,
      name: text(firstOwn(source, ['nameZhTw', 'name', 'nameJp'])),
      status,
      sourceKind: projected ? 'projected' : 'confirmed-source',
      scoreIncluded: status === 'CONFIRMED',
      evidenceStatus: status
    };
  }

  function g1Rows(step, sourceKind) {
    const keys = sourceKind === 'projected'
      ? ['g1ScheduleProjected', 'projectedG1Schedule', 'projectedG1', 'projectedG1s', 'scheduledG1Races']
      : ['g1ScheduleConfirmed', 'confirmedG1Wins', 'confirmedG1', 'g1Wins', 'g1Results'];
    const rows = [];
    for (const key of keys) {
      const value = step?.[key];
      if (Array.isArray(value)) rows.push(...value);
      else if (isObject(value?.races)) rows.push(...value.races);
      else if (Array.isArray(value?.races)) rows.push(...value.races);
    }
    const schedule = isObject(step?.g1Schedule) ? step.g1Schedule : {};
    const nested = sourceKind === 'projected'
      ? firstOwn(schedule, ['projected', 'projectedRaces', 'scheduled'])
      : firstOwn(schedule, ['confirmed', 'confirmedRaces', 'wins']);
    if (Array.isArray(nested)) rows.push(...nested);
    else if (Array.isArray(nested?.races)) rows.push(...nested.races);
    return rows.map(row => normalizeG1(row, sourceKind));
  }

  function executionView(step) {
    const source = firstOwn(step, ['executionFeasibility', 'execution_feasibility', 'feasibility']);
    if (!isObject(source) && !hasMeaningful(source)) return { status: 'UNKNOWN', evidenceStatus: 'UNKNOWN' };
    if (!isObject(source)) return { status: text(source).toUpperCase(), evidenceStatus: 'SUPPLIED' };
    return {
      status: text(firstOwn(source, ['status', 'state']), 'UNKNOWN').toUpperCase(),
      evidenceStatus: text(firstOwn(source, ['evidenceStatus', 'evidence_status']), 'SUPPLIED'),
      blockers: Array.isArray(source.blockers) ? source.blockers.map(item => text(item)).filter(Boolean) : [],
      warnings: Array.isArray(source.warnings) ? source.warnings.map(item => text(item)).filter(Boolean) : []
    };
  }

  function candidateView(step) {
    const candidate = isObject(step?.candidate) ? step.candidate : step;
    return {
      id: text(firstOwn(candidate, ['id', 'candidateId', 'candidate_id', 'outfitId', 'outfit_id'])),
      outfitId: numeric(firstOwn(candidate, ['outfitId', 'outfit_id'])),
      characterId: numeric(firstOwn(candidate, ['characterId', 'character_id'])),
      name: text(firstOwn(candidate, ['name', 'nameZhTw', 'candidateName', 'candidate_name'])),
      slot: text(firstOwn(candidate, ['slot', 'branch']))
    };
  }

  function lineageValue(step) {
    const direct = firstOwn(step, ['lineageValue', 'lineage_value']);
    if (direct !== undefined) return { value: sanitize(direct), source: 'step.lineageValue' };
    const candidate = isObject(step?.candidate) ? step.candidate : {};
    const candidateValue = firstOwn(candidate, ['lineageValue', 'lineage_value']);
    if (candidateValue !== undefined) return { value: sanitize(candidateValue), source: 'candidate.lineageValue' };
    const basis = isObject(step?.selectionBasis) ? step.selectionBasis : {};
    const basisValue = firstOwn(basis, ['lineageValue', 'lineage_value']);
    if (basisValue !== undefined) return { value: sanitize(basisValue), source: 'selectionBasis.lineageValue' };
    return { value: null, source: 'UNSUPPLIED' };
  }

  function factorOutputRows(step, binding) {
    const flow = isObject(step?.factorFlow) ? step.factorFlow : {};
    const output = isObject(step?.outputs) ? step.outputs : {};
    const observed = isObject(flow.observedOutputs) ? flow.observedOutputs : {};
    const rows = [];
    for (const type of ['blue', 'red', 'white', 'green']) {
      const values = [];
      for (const container of [output[type], flow[type], observed[type]]) {
        if (Array.isArray(container)) values.push(...container);
        else if (isObject(container)) values.push(container);
      }
      for (const raw of values) {
        const source = isObject(raw) ? raw : {};
        const declared = text(firstOwn(source, ['status', 'evidenceStatus', 'evidence_status']), 'UNVERIFIED').toUpperCase();
        const recorded = declared === 'USER_RECORDED' && binding.usableForEvidence;
        rows.push({
          type,
          skillId: numeric(firstOwn(source, ['skillId', 'skill_id'])),
          familyId: numeric(firstOwn(source, ['familyId', 'family_id', 'skillFamilyId', 'skill_family_id'])),
          name: text(firstOwn(source, ['name', 'nameZhTw', 'label', 'key'])),
          status: recorded ? 'USER_RECORDED' : declared === 'PROJECTED' ? 'PROJECTED' : declared === 'SATISFIED' && binding.usableForEvidence ? 'USER_RECORDED' : 'UNVERIFIED',
          evidenceStatus: recorded ? 'USER_RECORDED' : declared === 'PROJECTED' ? 'PROJECTED' : 'UNVERIFIED',
          sourceRecordId: recorded ? binding.recordId : null,
          stepId: binding.stepId
        });
      }
    }
    const byKey = new Map();
    rows.forEach(row => {
      const key = `${row.type}|${row.skillId ?? row.familyId ?? row.name}`;
      const existing = byKey.get(key);
      if (!existing || existing.status !== 'USER_RECORDED' && row.status === 'USER_RECORDED') byKey.set(key, row);
    });
    return [...byKey.values()];
  }

  function buildLineage(input, target, residual) {
    const plan = input.lineagePlan;
    const rawSteps = lineageStepRows(plan);
    const records = new Map(breederRecords(input.registeredBreeders).map(([id, record]) => [String(id), record]));
    const bindings = bindingMap(input.breederBindings);
    const rows = rawSteps.map((step, index) => {
      const stage = normalizeStage(firstOwn(step, ['stage', 'lineageStage', 'lineage_stage', 'kind']));
      const binding = bindStep(step, records, bindings);
      const value = lineageValue(step);
      const confirmedG1 = g1Rows(step, 'confirmed').filter(row => row.status === 'CONFIRMED');
      const projectedG1 = g1Rows(step, 'projected');
      return {
        id: text(step?.id, `step-${index + 1}`),
        stepId: text(step?.id, `step-${index + 1}`),
        stage,
        order: numeric(firstOwn(step, ['order', 'sequence'])) ?? index + 1,
        dependsOn: Array.isArray(firstOwn(step, ['dependsOn', 'depends_on']))
          ? firstOwn(step, ['dependsOn', 'depends_on']).map(text).filter(Boolean)
          : [],
        candidate: candidateView(step),
        lineageValue: value.value,
        lineageValueSource: value.source,
        binding,
        g1Schedule: {
          confirmed: confirmedG1,
          projected: projectedG1,
          projectedScoreIncluded: false
        },
        executionFeasibility: executionView(step),
        outputs: factorOutputRows(step, binding),
        warnings: projectedG1.length ? ['projected G1 remains unconfirmed and does not enter lineage value'] : []
      };
    });
    const stages = Object.fromEntries(LINEAGE_STAGES.map(stage => [stage, rows.filter(row => row.stage === stage)]));
    const allBindingRows = rows.map(row => row.binding);
    const missingEvidence = allBindingRows.filter(binding => !binding.usableForEvidence);
    const projected = rows.some(row => row.g1Schedule.projected.length > 0);
    const stageStatus = stageRows => stageRows.some(row => !row.binding.usableForEvidence)
      ? 'NEEDS_EVIDENCE'
      : stageRows.some(row => row.g1Schedule.projected.length)
        ? 'READY_WITH_TRADEOFFS'
        : stageRows.length ? 'READY' : 'NEEDS_EVIDENCE';
    const outputs = Object.fromEntries(['blue', 'red', 'white', 'green'].map(type => [
      type,
      rows.flatMap(row => row.outputs.filter(output => output.type === type))
    ]));
    const confirmed = rows.flatMap(row => row.g1Schedule.confirmed);
    const projectedRows = rows.flatMap(row => row.g1Schedule.projected);
    const slots = Object.fromEntries(rows.map(row => [row.id, {
      stage: row.stage,
      lineageValue: row.lineageValue,
      binding: row.binding,
      status: row.binding.usableForEvidence
        ? row.g1Schedule.projected.length ? 'READY_WITH_TRADEOFFS' : 'READY'
        : 'NEEDS_EVIDENCE'
    }]));
    const status = !rawSteps.length
      ? 'NEEDS_EVIDENCE'
      : missingEvidence.length
        ? 'NEEDS_EVIDENCE'
        : projected
          ? 'READY_WITH_TRADEOFFS'
          : 'READY';
    return {
      status,
      targets: clone(residual.targets),
      remainingTargets: clone(residual.remainingTargets),
      direct_parent: stages.direct_parent,
      grandparent: stages.grandparent,
      foundation: stages.foundation,
      stages,
      slots,
      bindings: Object.fromEntries(rows.map(row => [row.id, row.binding])),
      outputs,
      g1Schedule: {
        confirmed,
        projected: projectedRows,
        projectedScoreIncluded: false
      },
      stopPolicy: sanitize(isObject(plan?.stopPolicy) ? plan.stopPolicy : {}),
      executionFeasibility: rows.map(row => ({ stepId: row.id, ...row.executionFeasibility })),
      evidence: allBindingRows,
      stageStatus: Object.fromEntries(LINEAGE_STAGES.map(stage => [stage, stageStatus(stages[stage])]))
    };
  }

  function evidenceRows(target, requirements, residual, raceFit, lineage, input, mismatches) {
    const rows = [];
    rows.push({ id: 'target', status: validateTarget(target).length ? 'BLOCKED' : 'READY', source: 'target' });
    if (mismatches.length) rows.push({ id: 'profile', status: 'BLOCKED', source: 'profile', fields: mismatches.map(row => row.field) });
    if (requirements.unresolvedSelectedTargetIds.length) {
      rows.push({ id: 'selected-targets', status: 'NEEDS_EVIDENCE', source: 'courseTable', ids: requirements.unresolvedSelectedTargetIds });
    }
    for (const row of residual.targets) {
      rows.push({ id: row.dedupeKey, status: row.coverageClass === 'UNRESOLVED' ? 'NEEDS_EVIDENCE' : row.coverageClass === 'PARTIAL_ROUTE' ? 'READY_WITH_TRADEOFFS' : 'READY', source: 'planningSnapshot', coverageClass: row.coverageClass });
    }
    if (raceFit.status === 'NEEDS_EVIDENCE') rows.push({ id: 'race-fit', status: 'NEEDS_EVIDENCE', source: 'raceFit' });
    if (lineage.status === 'NEEDS_EVIDENCE') rows.push({ id: 'lineage', status: 'NEEDS_EVIDENCE', source: 'lineagePlan' });
    if (lineage.status === 'READY_WITH_TRADEOFFS') rows.push({ id: 'lineage-projected-g1', status: 'READY_WITH_TRADEOFFS', source: 'lineagePlan' });
    if (isObject(input.deckConfirmation) && !residual.deck.confirmed) rows.push({ id: 'deck', status: 'NEEDS_EVIDENCE', source: 'deckConfirmation' });
    return rows;
  }

  function buildGoalContract(input = {}) {
    const source = isObject(input) ? input : {};
    const target = normalizeTarget(source.target);
    const missingTargetFields = validateTarget(target);
    const mismatches = profileMismatches(target, source);
    const requirements = buildRequirements(source, target);
    const residual = buildResidual(source, target, requirements);
    const raceFit = rankRaceFit(source, residual);
    const lineage = buildLineage(source, target, residual);
    const hardBlockers = [];
    if (missingTargetFields.length) {
      hardBlockers.push({ code: 'TARGET_REQUIRED_FIELD_MISSING', fields: missingTargetFields, message: 'target profile is incomplete' });
    }
    if (mismatches.length) {
      hardBlockers.push({ code: 'PROFILE_MISMATCH', mismatches, message: 'target and supplied profile do not match' });
    }
    const evidence = evidenceRows(target, requirements, residual, raceFit, lineage, source, mismatches);
    const needsEvidence = evidence.filter(row => row.status === 'NEEDS_EVIDENCE');
    const tradeoffs = evidence.filter(row => row.status === 'READY_WITH_TRADEOFFS');
    const status = hardBlockers.length
      ? 'BLOCKED'
      : needsEvidence.length
        ? 'NEEDS_EVIDENCE'
        : tradeoffs.length
          ? 'READY_WITH_TRADEOFFS'
          : 'READY';
    const selectedCandidate = raceFit.selected;
    const goal = {
      eventMode: target.eventMode,
      objective: clone(target.objective),
      server: target.server,
      ruleset: target.ruleset,
      race: {
        catalogRaceId: target.catalogRaceId,
        courseId: target.courseId,
        surface: target.surface,
        distanceType: target.distanceType,
        distanceM: target.distanceM,
        geometryConfidence: target.geometryConfidence,
        evidenceStatus: target.evidenceStatus
      },
      runningStyle: target.runningStyle,
      teamComposition: [...target.teamComposition]
    };
    const battleCandidate = selectedCandidate ? {
      ...selectedCandidate,
      remainingTargets: clone(residual.remainingTargets),
      winStrength: { value: null, status: 'UNKNOWN' }
    } : {
      candidateId: null,
      name: '',
      aptitude: {},
      uniqueSkillIds: [],
      deckIds: [],
      acquisition: {},
      raceFit: {
        axes: {}, axisOrder: raceFit.axisOrder, directions: raceFit.directions,
        method: raceFit.method, missingAxes: [...raceFit.axisOrder], status: 'NEEDS_EVIDENCE',
        paretoOptimal: false, rank: null, dominanceCount: 0, dominatedBy: []
      },
      remainingTargets: clone(residual.remainingTargets),
      winStrength: { value: null, status: 'UNKNOWN' }
    };
    const result = sanitize({
      schema: CONTRACT_SCHEMA,
      schemaVersion: SCHEMA_VERSION,
      modelVersion: MODEL_VERSION,
      status,
      goal,
      target: {
        id: target.id || null,
        targetKey: target.targetKey,
        label: target.label,
        server: target.server,
        eventMode: target.eventMode,
        courseId: target.courseId,
        surface: target.surface,
        distanceType: target.distanceType,
        distanceM: target.distanceM,
        runningStyle: target.runningStyle,
        objective: clone(target.objective),
        ...goal
      },
      requirements: {
        must: requirements.must,
        recommended: requirements.recommended,
        all: requirements.rows,
        selectedTargetIds: requirements.selectedTargetIds,
        unresolvedSelectedTargetIds: requirements.unresolvedSelectedTargetIds,
        canonicalFamilyDeduped: true,
        targetKey: target.targetKey
      },
      battleCandidate,
      battleCandidates: raceFit.candidates,
      raceFit: {
        candidates: raceFit.candidates,
        selectedCandidateId: selectedCandidate?.candidateId || null,
        axisOrder: raceFit.axisOrder,
        directions: raceFit.directions,
        method: raceFit.method,
        status: raceFit.status
      },
      residual,
      deck: residual.deck,
      lineage,
      blockers: hardBlockers,
      needsEvidence,
      tradeoffs,
      evidence,
      warnings: [
        'This contract aggregates supplied model outputs; it does not calculate a new score.',
        'Unknown coverage is not deducted as zero.',
        ...(lineage.executionFeasibility.length ? ['Execution feasibility is reported separately and never changes lineage value.'] : [])
      ],
      limitations: [
        'raceFit is a transparent lexicographic/Pareto comparison, not a finish or win claim.',
        'Projected G1 remains projected and is excluded from confirmed G1 evidence.',
        'Only an exact step.id binding to a registered record can support USER_RECORDED evidence.'
      ],
      coverClasses: [...COVER_CLASSES],
      deductionOrder: [...DEDUCTION_ORDER]
    });
    return result;
  }

  return {
    SCHEMA_VERSION,
    CONTRACT_SCHEMA,
    MODEL_VERSION,
    REQUIRED_TARGET_FIELDS,
    COVER_CLASSES,
    DEDUCTION_ORDER,
    LINEAGE_STAGES,
    DEFAULT_RACE_FIT_AXES,
    normalizeTarget,
    validateTarget,
    canonicalSkillFamily: skillFamilyInfo,
    normalizeRequirements: buildRequirements,
    classifyCoverage: classForSnapshot,
    rankRaceFit,
    normalizeCandidate,
    bindStep,
    buildGoalContract,
    aggregateGoalContract: buildGoalContract,
    createGoalContract: buildGoalContract
  };
});
