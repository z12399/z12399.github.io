(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LINEAGE_RENTAL_SCORE_CORE = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // This module is deliberately separate from lineage-planner-core.js.  It is
  // an advisory scorer for externally supplied rental records, not a new
  // inheritance engine and not a replacement for the existing planner API.
  const MODEL_VERSION = 'lineage-rental-score-v1';
  const CONTRACT_SCHEMA = 'prettyderby-lineage-score-contract.v1';
  const AUTHORITY = 'CANDIDATE_ADVISORY_ONLY';
  const RUNNER_ALIASES = new Set(['runner', 'escape', 'nige', '逃馬', '領頭', '1']);
  const STAGES = new Set(['grandparent', 'direct_parent']);
  const COMPONENT_IDS = Object.freeze([
    'white_factor_utility',
    'blue_marginal',
    'body_unique_grandparent',
    'construction_reds',
    'g1_affinity',
    'data_completeness'
  ]);
  const SKILL_IDS = Object.freeze({
    joyToTheWorld: 110771,
    barcaroleOfBlessings: 110151
  });
  const SCORE_BOUNDS = Object.freeze({
    white: 0.72,
    blue: 0.05,
    uniqueDirect: 0.18,
    reds: 0.03,
    g1: 0.02,
    completeness: 0.05
  });
  const CM_OAKS_CONTEXT = Object.freeze({
    courseId: 10606,
    surface: 'turf',
    distanceType: 'medium',
    distanceM: 2400
  });
  const FORBIDDEN_PROBABILITY_KEYS = new Set([
    'activationprobability',
    'inheritanceprobability',
    'winprobability',
    'winrate',
    'successprobability',
    'factorprobability',
    'activationrate',
    'winratepct',
    'inheritancechance',
    'inheritancerate',
    'factorrate',
    'successpercent',
    'probability',
    'chance',
    'rate',
    'count'
  ]);

  function finite(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const result = Number(trimmed);
    return Number.isFinite(result) ? result : null;
  }

  function finiteNonNegative(value) {
    const result = finite(value);
    return result === null || result < 0 ? null : result;
  }

  function text(value, fallback = '') {
    const result = value === null || value === undefined ? '' : String(value).trim();
    return result || fallback;
  }

  function isObject(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  }

  function clone(value) {
    if (Array.isArray(value)) return value.map(clone);
    if (isObject(value)) {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
    }
    return value;
  }

  function firstDefined(source, keys) {
    for (const key of keys) {
      if (source
        && Object.prototype.hasOwnProperty.call(source, key)
        && source[key] !== undefined) return source[key];
    }
    return undefined;
  }

  function normalizedKey(value) {
    return text(value).toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function canonicalSurface(value) {
    const normalized = text(value).toLowerCase();
    return ({
      '1': 'turf',
      turf: 'turf',
      grass: 'turf',
      草地: 'turf',
      '2': 'dirt',
      dirt: 'dirt',
      mud: 'dirt',
      泥地: 'dirt'
    })[normalized] || normalized;
  }

  function canonicalDistanceType(value) {
    const normalized = text(value).toLowerCase();
    return ({
      '1': 'short',
      short: 'short',
      短距離: 'short',
      '2': 'mile',
      mile: 'mile',
      英里: 'mile',
      '3': 'medium',
      medium: 'medium',
      中距離: 'medium',
      '4': 'long',
      long: 'long',
      長距離: 'long'
    })[normalized] || normalized;
  }

  function isKuaAdvisoryKey(key) {
    const normalized = normalizedKey(key);
    return normalized === 'kua' || normalized.startsWith('kua');
  }

  function keyHasForbiddenProbability(key) {
    const normalized = normalizedKey(key);
    return FORBIDDEN_PROBABILITY_KEYS.has(normalized);
  }

  function findForbiddenProbabilityKey(value, path = '', insideKua = false) {
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        const found = findForbiddenProbabilityKey(value[index], `${path}[${index}]`, insideKua);
        if (found) return found;
      }
      return null;
    }
    if (!isObject(value)) return null;
    for (const [key, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${key}` : key;
      const keyIsKua = isKuaAdvisoryKey(key);
      // KUA is advisory-only: its complete subtree, including any model
      // rates, must not become a gate or a scoring input.
      if (!insideKua && !keyIsKua && keyHasForbiddenProbability(key)) return childPath;
      const found = findForbiddenProbabilityKey(child, childPath, insideKua || keyIsKua);
      if (found) return found;
    }
    return null;
  }

  function findKuaKey(value, path = '') {
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        const found = findKuaKey(value[index], `${path}[${index}]`);
        if (found) return found;
      }
      return null;
    }
    if (!isObject(value)) return null;
    for (const [key, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${key}` : key;
      if (isKuaAdvisoryKey(key)) return childPath;
      const found = findKuaKey(child, childPath);
      if (found) return found;
    }
    return null;
  }

  function normalizeMap(raw) {
    const source = isObject(raw) ? raw : {};
    const result = {};
    for (const [key, value] of Object.entries(source)) {
      const number = finiteNonNegative(value);
      if (number !== null) result[text(key)] = number;
    }
    return result;
  }

  function normalizeBlue(raw) {
    const source = isObject(raw) ? raw : {};
    const axes = ['speed', 'stamina', 'power', 'guts', 'wisdom'];
    const result = {};
    for (const axis of axes) {
      const value = finiteNonNegative(firstDefined(source, [axis, `${axis}Stars`, `${axis}_stars`]));
      if (value !== null) result[axis] = value;
    }
    return result;
  }

  function normalizeRed(raw) {
    const source = isObject(raw) ? raw : {};
    const result = {};
    for (const axis of ['turf', 'dirt', 'short', 'mile', 'medium', 'long']) {
      const value = finiteNonNegative(firstDefined(source, [axis, `${axis}Stars`, `${axis}_stars`]));
      if (value !== null) result[axis] = value;
    }
    return result;
  }

  function normalizeUnique(raw, candidate) {
    const source = isObject(raw) ? raw : {};
    const id = finite(firstDefined(source, ['skillId', 'skill_id', 'id', 'familyId', 'family_id']))
      ?? finite(firstDefined(candidate, ['uniqueSkillId', 'unique_skill_id']));
    const name = text(firstDefined(source, ['nameZhTw', 'name', 'skillName', 'skill_name']))
      || text(firstDefined(candidate, ['uniqueSkillName', 'unique_skill_name']));
    const stars = finiteNonNegative(firstDefined(source, ['stars', 'star']));
    const courseStatus = text(firstDefined(source, [
      'localCourseEffectEvidenceStatus',
      'local_course_effect_evidence_status',
      'courseEffectEvidenceStatus',
      'course_effect_evidence_status'
    ]));
    const conditionStatus = text(firstDefined(source, [
      'conditionEvidenceStatus',
      'condition_evidence_status'
    ]));
    return { id, name, stars, courseStatus, conditionStatus };
  }

  function normalizeParents(raw) {
    const source = Array.isArray(raw)
      ? raw
      : isObject(raw)
        ? Object.values(raw)
        : [];
    return source.map(parent => {
      const parentObject = isObject(parent) ? parent : {};
      return {
        red: normalizeRed(firstDefined(parentObject, ['red', 'redFactor', 'red_factor']))
      };
    });
  }

  function normalizeCandidate(raw, index = 0) {
    const source = isObject(raw) ? raw : {};
    const body = isObject(source.body) ? source.body : {};
    const bodyBlue = firstDefined(source, ['bodyBlue', 'body_blue', 'blueFactor', 'blue_factor'])
      ?? firstDefined(body, ['blue', 'blueFactor', 'blue_factor']);
    const bodyRed = firstDefined(source, ['bodyRed', 'body_red', 'redFactor', 'red_factor'])
      ?? firstDefined(body, ['red', 'redFactor', 'red_factor']);
    const uniqueRaw = firstDefined(source, ['bodyUnique', 'body_unique', 'unique'])
      ?? firstDefined(body, ['unique', 'bodyUnique', 'body_unique']);
    const whiteRaw = firstDefined(source, [
      'directlyUsefulBodyWhiteFamilies',
      'directly_useful_body_white_families',
      'usefulWhiteFamilies',
      'useful_white_families'
    ]);
    const effectiveWhiteCount = finiteNonNegative(firstDefined(source, [
      'effectiveWhiteCount',
      'effective_body_white_count',
      'bodyWhiteCount',
      'body_white_count'
    ]));
    const countStatus = text(firstDefined(source, [
      'effectiveWhiteCountStatus',
      'effective_body_white_count_status',
      'bodyWhiteCountStatus',
      'body_white_count_status'
    ]), effectiveWhiteCount === null ? 'UNKNOWN' : 'SUPPLIED');
    const ordinalComparison = text(firstDefined(source, [
      'userOrdinalWhiteComparison',
      'user_ordinal_white_comparison',
      'whiteFactorOrdinal',
      'white_factor_ordinal'
    ]));
    const parentsRaw = firstDefined(source, [
      'parents',
      'parentsConstructionReds',
      'parents_construction_reds',
      'constructionReds',
      'construction_reds'
    ]);
    const g1Count = finiteNonNegative(firstDefined(source, [
      'g1Count',
      'g1_count',
      'sharedG1Count',
      'shared_g1_count'
    ]));
    const id = text(firstDefined(source, ['id', 'candidateId', 'candidate_id']), `candidate-${index + 1}`);
    const name = text(firstDefined(source, ['nameZhTw', 'name', 'candidateName', 'candidate_name']), id);
    const metadata = isObject(source.metadata) ? clone(source.metadata) : {};
    return {
      id,
      name,
      bodyBlue: normalizeBlue(bodyBlue),
      bodyRed: normalizeRed(bodyRed),
      bodyUnique: normalizeUnique(uniqueRaw, source),
      effectiveWhiteCount,
      effectiveWhiteCountStatus: countStatus,
      directlyUsefulBodyWhiteFamilies: Array.isArray(whiteRaw) ? whiteRaw.map(item => text(item)).filter(Boolean) : null,
      userOrdinalWhiteComparison: ordinalComparison,
      parents: normalizeParents(parentsRaw),
      g1Count,
      g1Status: text(firstDefined(source, ['g1Status', 'g1_status']), g1Count === null ? 'UNKNOWN' : 'SUPPLIED'),
      sourceStatus: text(firstDefined(source, ['sourceStatus', 'source_status']), 'USER_SUPPLIED_EXTERNAL_EVIDENCE'),
      metadata
    };
  }

  function normalizeContext(raw = {}) {
    const source = isObject(raw) ? raw : {};
    const courseId = finite(firstDefined(source, ['courseId', 'course_id']));
    const distanceM = finite(firstDefined(source, ['distanceM', 'distance_m']));
    const recovery = firstDefined(source, [
      'deckHasEarlyOrMiddleRecovery',
      'deck_has_early_or_middle_recovery'
    ]);
    // A present key with undefined/null is still missing evidence. Only an
    // explicit boolean satisfies USER_REQUIRED recovery evidence.
    const recoveryKeyPresent = typeof recovery === 'boolean';
    const candidatesRaw = firstDefined(source, ['candidates', 'externalCandidates', 'external_candidates']);
    const candidates = Array.isArray(candidatesRaw)
      ? candidatesRaw.map(normalizeCandidate)
      : [];
    return {
      server: text(firstDefined(source, ['server', 'targetServer', 'target_server'])),
      courseId,
      courseName: text(firstDefined(source, ['courseName', 'course_name'])),
      surface: canonicalSurface(firstDefined(source, ['surface', 'groundType', 'ground_type'])),
      distanceType: canonicalDistanceType(firstDefined(source, ['distanceType', 'distance_type'])),
      distanceM,
      runningStyle: text(firstDefined(source, ['runningStyle', 'running_style'])).toLowerCase(),
      lineageStage: text(firstDefined(source, ['lineageStage', 'lineage_stage'])).toLowerCase(),
      decisionScope: text(firstDefined(source, ['decisionScope', 'decision_scope'])).toLowerCase(),
      recovery: recoveryKeyPresent ? recovery : null,
      recoveryKeyPresent,
      candidates,
      source: isObject(source.source) ? clone(source.source) : null,
      raw: source
    };
  }

  function gate(id, requirementLevel, rule, status, reason) {
    return { id, requirementLevel, rule, status, reason };
  }

  function isJoyUnique(unique) {
    const source = unique || {};
    return source.id === SKILL_IDS.joyToTheWorld
      || text(source.name).toLowerCase() === 'joy to the world';
  }

  function isJoyCandidate(candidate) {
    return isJoyUnique(candidate?.bodyUnique);
  }

  function duplicateCandidateIds(candidates) {
    const seen = new Set();
    const duplicates = new Set();
    for (const candidate of candidates) {
      if (seen.has(candidate.id)) duplicates.add(candidate.id);
      seen.add(candidate.id);
    }
    return [...duplicates];
  }

  function contextGateResults(context, forbiddenPath = null) {
    const gates = [];
    gates.push(context.lineageStage && STAGES.has(context.lineageStage)
      ? gate('HG-01', 'RULE_REQUIRED', 'Lineage stage must be grandparent or direct_parent.', 'PASS', context.lineageStage)
      : gate('HG-01', 'RULE_REQUIRED', 'Lineage stage must be declared.', 'BLOCKED', 'lineage_stage missing or unsupported'));
    gates.push(context.runningStyle && RUNNER_ALIASES.has(context.runningStyle)
      ? gate('HG-02', 'RULE_REQUIRED', 'Running style must be runner/逃馬.', 'PASS', context.runningStyle)
      : gate('HG-02', 'RULE_REQUIRED', 'Running style must be declared as runner/逃馬.', 'BLOCKED', 'running_style missing or not runner'));
    gates.push(context.decisionScope === 'cm_winner_line'
      ? gate('HG-03', 'RULE_REQUIRED', 'Only the CM winner line is evaluated.', 'PASS', context.decisionScope)
      : gate('HG-03', 'RULE_REQUIRED', 'Decision scope must be cm_winner_line.', 'BLOCKED', 'decision_scope is not cm_winner_line'));
    const joyIsPresent = context.candidates.some(isJoyCandidate);
    gates.push(!joyIsPresent
      ? gate('HG-04', 'USER_REQUIRED', 'Recovery availability is required only when a Joy to the World candidate is present.', 'PASS', 'no Joy to the World candidate')
      : context.recoveryKeyPresent
        ? gate('HG-04', 'USER_REQUIRED', 'Recovery availability must be supplied for Joy condition evaluation.', 'PASS', String(context.recovery))
        : gate('HG-04', 'USER_REQUIRED', 'Recovery availability must be supplied for Joy condition evaluation.', 'NEEDS_EVIDENCE', 'deck_has_early_or_middle_recovery missing'));
    gates.push(forbiddenPath
      ? gate('HG-05', 'RULE_REQUIRED', 'Restricted fabricated rate/count fields may not be supplied.', 'BLOCKED', 'restricted fabricated rate/count field supplied')
      : gate('HG-05', 'RULE_REQUIRED', 'Unknown values stay unknown; no fabricated rates or counts.', 'PASS', 'no forbidden rate field detected'));
    gates.push(context.courseId === CM_OAKS_CONTEXT.courseId
      ? gate('HG-06', 'RULE_REQUIRED', 'CM Oaks course_id must be 10606.', 'PASS', String(context.courseId))
      : gate('HG-06', 'RULE_REQUIRED', 'CM Oaks course_id must be 10606.', 'BLOCKED', context.courseId === null ? 'course_id missing' : 'course_id is not 10606'));
    gates.push(context.surface === CM_OAKS_CONTEXT.surface
      ? gate('HG-07', 'RULE_REQUIRED', 'CM Oaks surface must be turf.', 'PASS', context.surface)
      : gate('HG-07', 'RULE_REQUIRED', 'CM Oaks surface must be turf.', 'BLOCKED', context.surface ? 'surface is not turf' : 'surface missing'));
    gates.push(context.distanceType === CM_OAKS_CONTEXT.distanceType
      ? gate('HG-08', 'RULE_REQUIRED', 'CM Oaks distance_type must be medium.', 'PASS', context.distanceType)
      : gate('HG-08', 'RULE_REQUIRED', 'CM Oaks distance_type must be medium.', 'BLOCKED', context.distanceType ? 'distance_type is not medium' : 'distance_type missing'));
    gates.push(context.distanceM === CM_OAKS_CONTEXT.distanceM
      ? gate('HG-09', 'RULE_REQUIRED', 'CM Oaks distance_m must be 2400.', 'PASS', String(context.distanceM))
      : gate('HG-09', 'RULE_REQUIRED', 'CM Oaks distance_m must be 2400.', 'BLOCKED', context.distanceM === null ? 'distance_m missing' : 'distance_m is not 2400'));
    const duplicateIds = duplicateCandidateIds(context.candidates);
    gates.push(duplicateIds.length === 0
      ? gate('HG-10', 'RULE_REQUIRED', 'Candidate IDs must be unique.', 'PASS', 'candidate IDs are unique')
      : gate('HG-10', 'RULE_REQUIRED', 'Candidate IDs must be unique.', 'BLOCKED', 'duplicate candidate_id supplied'));
    return gates;
  }

  function overallGateStatus(gates) {
    if (gates.some(item => item.status === 'BLOCKED')) return 'BLOCKED';
    if (gates.some(item => item.status === 'NEEDS_EVIDENCE')) return 'NEEDS_EVIDENCE';
    return 'PASS';
  }

  function compareCodePointLexical(left, right) {
    const leftPoints = Array.from(String(left), character => character.codePointAt(0));
    const rightPoints = Array.from(String(right), character => character.codePointAt(0));
    const length = Math.min(leftPoints.length, rightPoints.length);
    for (let index = 0; index < length; index += 1) {
      if (leftPoints[index] !== rightPoints[index]) return leftPoints[index] - rightPoints[index];
    }
    return leftPoints.length - rightPoints.length;
  }

  function relationForCandidate(candidate, candidates) {
    const relation = candidate.userOrdinalWhiteComparison;
    if (!relation) return null;
    const normalized = relation.replace(/\s+/g, '');
    const ids = candidates.map(item => item.id);
    const candidateId = candidate.id;
    const match = normalized.match(/^([^<>!=]+)(>=|<=|>|<|=)([^<>!=]+)$/);
    if (!match) {
      if (/^higher$/i.test(relation)) return 'HIGHER';
      if (/^lower$/i.test(relation)) return 'LOWER';
      if (/^equal$/i.test(relation)) return 'EQUAL';
      return null;
    }
    const left = text(match[1]);
    const operator = match[2];
    const right = text(match[3]);
    if (!ids.includes(left) && !ids.includes(right)) return null;
    const leftIsCandidate = left === candidateId;
    const rightIsCandidate = right === candidateId;
    if (!leftIsCandidate && !rightIsCandidate) return null;
    if (operator === '=') return 'EQUAL';
    if (leftIsCandidate) return ['>', '>='].includes(operator) ? 'HIGHER' : 'LOWER';
    return ['<', '<='].includes(operator) ? 'HIGHER' : 'LOWER';
  }

  function whiteInfo(candidate, candidates) {
    const knownCounts = candidates
      .map(item => item.effectiveWhiteCount)
      .filter(value => value !== null);
    const maxCount = knownCounts.length ? Math.max(...knownCounts) : null;
    if (candidate.effectiveWhiteCount !== null && maxCount !== null && maxCount > 0) {
      return {
        value: Math.max(0, Math.min(1, candidate.effectiveWhiteCount / maxCount)),
        ordinal: candidate.effectiveWhiteCount === maxCount ? 'HIGHER_OR_EQUAL' : 'LOWER',
        numericValue: candidate.effectiveWhiteCount,
        evidenceStatus: candidate.effectiveWhiteCountStatus || 'SUPPLIED',
        reason: `effective body white count ${candidate.effectiveWhiteCount}`
      };
    }
    const relation = relationForCandidate(candidate, candidates);
    if (relation) {
      return {
        // This is an ordinal ranking proxy, not a fabricated count.  The
        // emitted numeric_value remains null and the evidence status says why.
        value: relation === 'HIGHER' ? 1 : relation === 'EQUAL' ? 0.75 : 0.5,
        ordinal: relation,
        numericValue: null,
        evidenceStatus: 'USER_ASSERTED_ORDINAL_WITH_MISSING_COUNT',
        reason: `user supplied ordinal ${relation}; missing count remains UNKNOWN`
      };
    }
    return {
      value: null,
      ordinal: 'UNKNOWN',
      numericValue: null,
      evidenceStatus: 'UNKNOWN',
      reason: 'effective body white count and ordinal comparison are UNKNOWN'
    };
  }

  function blueInfo(candidate) {
    const entries = Object.entries(candidate.bodyBlue);
    if (!entries.length) {
      return {
        value: null,
        ordinal: 'UNKNOWN',
        numericValue: null,
        evidenceStatus: 'UNKNOWN',
        reason: 'blue factor is UNKNOWN'
      };
    }
    const [axis, stars] = entries.sort((left, right) => right[1] - left[1])[0];
    const bounded = Math.max(0, Math.min(1, 0.5 + (stars - 2) * 0.01));
    return {
      value: bounded,
      ordinal: stars > 2 ? 'HIGHER_SMALL_MARGIN' : stars < 2 ? 'LOWER_SMALL_MARGIN' : 'BASELINE',
      numericValue: stars,
      evidenceStatus: 'USER_RULE_BOUNDED',
      reason: `${axis} ${stars}★; blue difference is bounded as a small CM Oaks marginal`
    };
  }

  function uniqueRelevanceProxy(targetDirectParentContribution, ancestorDiscount) {
    // scoreValue is a bounded relevance proxy, not a probability. Convert the
    // intended direct-parent contribution back through the unique component
    // weight before applying the lineage-stage discount.
    return (targetDirectParentContribution / SCORE_BOUNDS.uniqueDirect) * ancestorDiscount;
  }

  function uniqueInfo(candidate, context) {
    const unique = candidate.bodyUnique;
    const joy = isJoyCandidate(candidate);
    const barcarole = unique.id === SKILL_IDS.barcaroleOfBlessings || unique.name === '惠福的船歌';
    const discount = context.lineageStage === 'grandparent' ? 0.5 : 1;
    if (joy) {
      if (context.recovery === true) {
        return {
          value: uniqueRelevanceProxy(0.12, discount),
          ordinal: 'CONDITIONAL_WITH_PLANNED_RECOVERY',
          numericValue: null,
          evidenceStatus: 'USER_SUPPLIED_EXTERNAL_EVIDENCE',
          ancestorDiscount: discount,
          conditionStatus: 'CONDITIONAL_WITH_PLANNED_RECOVERY',
          courseEffectStatus: 'UNMAPPED_OR_UNVERIFIED',
          reason: 'Joy to the World requires an early/middle recovery and a non-leading mid-race position; recovery is user-supplied as available and the ancestor discount is applied'
        };
      }
      if (context.recovery === false) {
        return {
          value: 0,
          ordinal: 'CONDITIONAL_UNMET',
          numericValue: null,
          evidenceStatus: 'USER_RULE_BOUNDED',
          ancestorDiscount: discount,
          conditionStatus: 'CONDITIONAL_UNMET',
          courseEffectStatus: 'UNMAPPED_OR_UNVERIFIED',
          reason: 'Joy to the World recovery prerequisite is explicitly unavailable; no activation rate is inferred'
        };
      }
      return {
        value: null,
        ordinal: 'CONDITIONAL_UNKNOWN',
        numericValue: null,
        evidenceStatus: 'UNKNOWN',
        ancestorDiscount: discount,
        conditionStatus: 'CONDITIONAL_UNKNOWN',
        courseEffectStatus: 'UNMAPPED_OR_UNVERIFIED',
        reason: 'Joy to the World recovery prerequisite is UNKNOWN'
      };
    }
    if (barcarole) {
      return {
        value: uniqueRelevanceProxy(0.06, discount),
        ordinal: 'UNMAPPED_OR_UNVERIFIED',
        numericValue: null,
        evidenceStatus: 'USER_SUPPLIED_EXTERNAL_EVIDENCE',
        ancestorDiscount: discount,
        conditionStatus: 'CONDITIONAL',
        courseEffectStatus: 'UNMAPPED_OR_UNVERIFIED',
        reason: '惠福的船歌 has local mechanics but no local CM inherited course-effect row; it is not treated as zero and remains grandparent-discounted'
      };
    }
    if (unique.id === null && !unique.name) {
      return {
        value: null,
        ordinal: 'UNKNOWN',
        numericValue: null,
        evidenceStatus: 'UNKNOWN',
        ancestorDiscount: discount,
        conditionStatus: 'UNKNOWN',
        courseEffectStatus: 'UNKNOWN',
        reason: 'body unique is UNKNOWN'
      };
    }
    return {
      value: uniqueRelevanceProxy(0.06, discount),
      ordinal: 'UNVERIFIED',
      numericValue: null,
      evidenceStatus: 'UNVERIFIED',
      ancestorDiscount: discount,
      conditionStatus: text(unique.conditionStatus, 'UNVERIFIED'),
      courseEffectStatus: text(unique.courseStatus, 'UNVERIFIED'),
      reason: 'unique identity is supplied but no approved course-effect value is available'
    };
  }

  function constructionRedInfo(candidate) {
    // A missing axis is not a zero-star axis. Aggregate only explicitly
    // supplied axes (the two construction parents commonly carry different
    // red types), and keep the component UNKNOWN when either required axis is
    // absent from the entire construction record.
    const mileValues = candidate.parents
      .map(parent => parent.red.mile)
      .filter(value => value !== undefined);
    const dirtValues = candidate.parents
      .map(parent => parent.red.dirt)
      .filter(value => value !== undefined);
    const hasMile = mileValues.length > 0;
    const hasDirt = dirtValues.length > 0;
    if (!hasMile || !hasDirt) {
      return {
        value: null,
        ordinal: 'UNKNOWN',
        numericValue: null,
        evidenceStatus: 'UNKNOWN',
        reason: 'parent construction reds are UNKNOWN'
      };
    }
    const mile = mileValues.reduce((sum, value) => sum + value, 0);
    const dirt = dirtValues.reduce((sum, value) => sum + value, 0);
    const stars = mile + dirt;
    return {
      value: Math.max(0, Math.min(1, stars / 6)),
      ordinal: stars >= 6 ? 'HIGHER' : stars >= 5 ? 'LOWER_SMALL_MARGIN' : 'LOWER',
      numericValue: stars,
      evidenceStatus: 'USER_SUPPLIED_EXTERNAL_EVIDENCE',
      reason: `construction reds: mile ${hasMile ? mile : 'UNKNOWN'} + dirt ${hasDirt ? dirt : 'UNKNOWN'}; soft only`
    };
  }

  function g1Info(candidate, candidates) {
    if (candidate.g1Count === null) {
      return {
        value: null,
        ordinal: 'UNKNOWN',
        numericValue: null,
        evidenceStatus: 'UNKNOWN',
        reason: 'G1 count is UNKNOWN'
      };
    }
    const known = candidates.map(item => item.g1Count).filter(value => value !== null);
    const max = known.length ? Math.max(...known) : candidate.g1Count;
    const min = known.length ? Math.min(...known) : candidate.g1Count;
    const ordinal = candidate.g1Count === max && candidate.g1Count === min
      ? 'EQUAL'
      : candidate.g1Count === max ? 'HIGHER_SOFT' : 'LOWER_SOFT';
    return {
      value: max > 0 ? candidate.g1Count / max : 1,
      ordinal,
      numericValue: candidate.g1Count,
      evidenceStatus: candidate.g1Status || 'SUPPLIED',
      reason: `shared G1 count ${candidate.g1Count}; soft audit component only`
    };
  }

  function completenessInfo(candidate) {
    const unknowns = [];
    if (candidate.effectiveWhiteCount === null && !candidate.userOrdinalWhiteComparison) unknowns.push('effective_body_white_count');
    if (!candidate.directlyUsefulBodyWhiteFamilies) unknowns.push('directly_useful_body_white_families');
    if (!Object.keys(candidate.bodyBlue).length) unknowns.push('body_blue');
    if (!candidate.parents.length) unknowns.push('parents_construction_reds');
    if (candidate.g1Count === null) unknowns.push('shared_g1_count');
    if (candidate.bodyUnique.id === null && !candidate.bodyUnique.name) unknowns.push('body_unique');
    const knownRatio = 1 - Math.min(1, unknowns.length / 6);
    return {
      value: knownRatio,
      ordinal: unknowns.length ? 'LOWER' : 'HIGHER',
      numericValue: knownRatio,
      evidenceStatus: unknowns.length ? 'COMPLETENESS_ONLY' : candidate.sourceStatus,
      reason: unknowns.length ? `unknown fields retained separately: ${unknowns.join(', ')}` : 'required scoring fields supplied',
      unknownFields: unknowns
    };
  }

  function component(componentId, info, weightedValue = null, extras = {}) {
    return {
      componentId,
      ordinal: info.ordinal,
      numericValue: info.numericValue,
      evidenceStatus: info.evidenceStatus,
      reason: info.reason,
      scoreValue: info.value,
      weightedValue,
      ...extras,
      ...(info.ancestorDiscount === undefined ? {} : {
        ancestorDiscount: info.ancestorDiscount,
        conditionStatus: info.conditionStatus,
        courseEffectStatus: info.courseEffectStatus
      }),
      ...(info.unknownFields ? { unknownFields: [...info.unknownFields] } : {})
    };
  }

  function scoreCandidate(candidate, context, candidates, baseGates) {
    const white = whiteInfo(candidate, candidates);
    const blue = blueInfo(candidate);
    const unique = uniqueInfo(candidate, context);
    const reds = constructionRedInfo(candidate);
    const g1 = g1Info(candidate, candidates);
    const completeness = completenessInfo(candidate);
    const infos = {
      white_factor_utility: white,
      blue_marginal: blue,
      body_unique_grandparent: unique,
      construction_reds: reds,
      g1_affinity: g1,
      data_completeness: completeness
    };
    const weighted = {
      white_factor_utility: white.value === null ? null : white.value * SCORE_BOUNDS.white,
      blue_marginal: blue.value === null ? null : blue.value * SCORE_BOUNDS.blue,
      body_unique_grandparent: unique.value === null ? null : unique.value * SCORE_BOUNDS.uniqueDirect,
      construction_reds: reds.value === null ? null : reds.value * SCORE_BOUNDS.reds,
      g1_affinity: g1.value === null ? null : g1.value * SCORE_BOUNDS.g1,
      data_completeness: null
    };
    const requiredForRanking = ['white_factor_utility', 'blue_marginal', 'body_unique_grandparent']
      .filter(id => infos[id].value === null);
    const total = Object.entries(weighted)
      .filter(([componentId, value]) => componentId !== 'data_completeness' && value !== null)
      .map(([, value]) => value)
      .reduce((sum, value) => sum + value, 0);
    const rankingStatus = requiredForRanking.length ? 'NEEDS_EVIDENCE' : 'PASS';
    const rankingConfidence = rankingStatus === 'PASS' ? 1 : 0;
    const evidenceConfidence = completeness.value;
    const warnings = [];
    if (unique.ordinal === 'CONDITIONAL_UNMET') warnings.push('Joy to the World condition is explicitly unmet for this sensitivity scenario.');
    if (unique.courseEffectStatus === 'UNMAPPED_OR_UNVERIFIED') warnings.push('Unique course-effect mapping is unavailable or unverified; no zero-value coercion was applied.');
    if (candidate.sourceStatus !== 'OFFICIAL_EVIDENCE') warnings.push(`Candidate source remains ${candidate.sourceStatus}.`);
    return {
      candidateId: candidate.id,
      candidateName: candidate.name,
      rank: null,
      totalScore: rankingStatus === 'PASS' ? Math.max(0, Math.min(1, total)) : null,
      hardGateResults: clone(baseGates),
      componentBreakdown: [
        component('white_factor_utility', white, weighted.white_factor_utility),
        component('blue_marginal', blue, weighted.blue_marginal),
        component('body_unique_grandparent', unique, weighted.body_unique_grandparent),
        component('construction_reds', reds, weighted.construction_reds),
        component('g1_affinity', g1, weighted.g1_affinity),
        component('data_completeness', completeness, weighted.data_completeness, {
          confidenceValue: completeness.value,
          utilityExcluded: true
        })
      ],
      dataGaps: [
        ...completeness.unknownFields,
        ...(unique.courseEffectStatus === 'UNMAPPED_OR_UNVERIFIED' ? ['body unique local course-effect row unavailable'] : []),
        ...(isJoyCandidate(candidate) ? ['Joy activation rate not supplied and not inferred'] : [])
      ],
      warnings,
      rankingStatus,
      rankingConfidence,
      evidenceConfidence,
      summary: buildSummary(candidate, infos, context)
    };
  }

  function buildSummary(candidate, infos, context) {
    const white = infos.white_factor_utility.ordinal;
    const blue = infos.blue_marginal.ordinal;
    const unique = infos.body_unique_grandparent.ordinal;
    return `${candidate.name}：本體白因子 ${white}；藍因子 ${blue}；祖輩固有 ${unique}；階段 ${context.lineageStage}。`;
  }

  function baseResponse(context, gates, extra = {}) {
    return {
      schema: CONTRACT_SCHEMA,
      modelVersion: MODEL_VERSION,
      authority: AUTHORITY,
      rankingOnly: true,
      ranking_only: true,
      status: overallGateStatus(gates),
      hardGateResults: clone(gates),
      warnings: [
        'CANDIDATE_ADVISORY_ONLY: external rental scoring does not modify canonical data or lineage-planner-core.',
        'No win, inheritance or activation rate is calculated or emitted.',
        ...(findKuaKey(context.raw) ? ['KUA input is ignored as a decision aid and cannot become a rate, win metric or hard gate.'] : [])
      ],
      context: {
        server: context.server,
        courseId: context.courseId,
        surface: context.surface,
        distanceType: context.distanceType,
        distanceM: context.distanceM,
        runningStyle: context.runningStyle,
        lineageStage: context.lineageStage,
        decisionScope: context.decisionScope,
        deckHasEarlyOrMiddleRecovery: context.recovery
      },
      ...extra
    };
  }

  function rankLineageAncestorCandidates(input = {}) {
    const forbiddenPath = findForbiddenProbabilityKey(input);
    const context = normalizeContext(input);
    const gates = contextGateResults(context, forbiddenPath);
    const response = baseResponse(context, gates);
    if (response.status !== 'PASS') {
      return {
        ...response,
        rankings: [],
        dataGaps: response.status === 'NEEDS_EVIDENCE' ? ['deck_has_early_or_middle_recovery is required'] : [],
        sensitivities: []
      };
    }
    if (!context.candidates.length) {
      return {
        ...response,
        status: 'NEEDS_EVIDENCE',
        rankings: [],
        dataGaps: ['candidates are required'],
        sensitivities: []
      };
    }
    const rows = context.candidates.map(candidate => scoreCandidate(candidate, context, context.candidates, gates));
    if (rows.some(row => row.rankingStatus !== 'PASS')) {
      return {
        ...response,
        status: 'NEEDS_EVIDENCE',
        rankings: rows,
        dataGaps: [...new Set(rows.flatMap(row => row.dataGaps))],
        sensitivities: []
      };
    }
    rows.sort((left, right) => right.totalScore - left.totalScore
      || compareCodePointLexical(left.candidateId, right.candidateId));
    rows.forEach((row, index) => { row.rank = index + 1; });
    return {
      ...response,
      status: 'READY',
      rankings: rows,
      dataGaps: [...new Set(rows.flatMap(row => row.dataGaps))],
      sensitivities: []
    };
  }

  function scoreLineageAncestorCandidate(input = {}) {
    const source = isObject(input) ? input : {};
    const candidate = source.candidate
      ? normalizeCandidate(source.candidate)
      : normalizeCandidate(source, 0);
    const contextInput = {
      ...source,
      candidates: Array.isArray(source.candidates)
        ? source.candidates
        : [source.candidate || candidate]
    };
    delete contextInput.candidate;
    const ranked = rankLineageAncestorCandidates(contextInput);
    const row = ranked.rankings.find(item => item.candidateId === candidate.id);
    return {
      ...ranked,
      candidateId: candidate.id,
      candidateName: candidate.name,
      rank: row?.rank ?? null,
      totalScore: row?.totalScore ?? null,
      componentBreakdown: row?.componentBreakdown || [],
      candidateHardGateResults: row?.hardGateResults || ranked.hardGateResults,
      candidateDataGaps: row?.dataGaps || ranked.dataGaps,
      summary: row?.summary || null
    };
  }

  function getComponent(row, id) {
    return (row?.componentBreakdown || []).find(item => item.componentId === id) || null;
  }

  function runSensitivity(input = {}) {
    const base = rankLineageAncestorCandidates(input);
    const source = isObject(input) ? input : {};
    const candidateRows = Array.isArray(source.candidates)
      ? source.candidates
      : source.candidate
        ? [source.candidate]
        : [];
    const withoutRecovery = {
      ...clone(source),
      deck_has_early_or_middle_recovery: false,
      deckHasEarlyOrMiddleRecovery: false,
      candidates: candidateRows
    };
    delete withoutRecovery.candidate;
    const directParent = {
      ...clone(source),
      lineage_stage: 'direct_parent',
      lineageStage: 'direct_parent',
      candidates: candidateRows
    };
    delete directParent.candidate;
    const noRecovery = rankLineageAncestorCandidates(withoutRecovery);
    const direct = rankLineageAncestorCandidates(directParent);
    const baseRanking = base.rankings.map(row => row.candidateId);
    return [
      {
        id: 'remove_recovery',
        status: noRecovery.status,
        ranking: noRecovery.rankings.map(row => row.candidateId),
        rankingUnchanged: baseRanking.length > 0 && baseRanking.join('|') === noRecovery.rankings.map(row => row.candidateId).join('|'),
        uniqueConditions: noRecovery.rankings.map(row => ({
          candidateId: row.candidateId,
          component: getComponent(row, 'body_unique_grandparent')
        })),
        warnings: noRecovery.warnings,
        dataGaps: noRecovery.dataGaps
      },
      {
        id: 'grandparent_to_direct_parent',
        status: direct.status,
        ranking: direct.rankings.map(row => row.candidateId),
        rankingUnchanged: baseRanking.length > 0 && baseRanking.join('|') === direct.rankings.map(row => row.candidateId).join('|'),
        uniqueConditions: direct.rankings.map(row => ({
          candidateId: row.candidateId,
          component: getComponent(row, 'body_unique_grandparent')
        })),
        warnings: direct.warnings,
        dataGaps: direct.dataGaps
      }
    ];
  }

  return {
    MODEL_VERSION,
    CONTRACT_SCHEMA,
    AUTHORITY,
    COMPONENT_IDS,
    SCORE_BOUNDS,
    CM_OAKS_CONTEXT,
    normalizeCandidate,
    normalizeContext,
    scoreLineageAncestorCandidate,
    rankLineageAncestorCandidates,
    rankCandidates: rankLineageAncestorCandidates,
    runSensitivity
  };
});
