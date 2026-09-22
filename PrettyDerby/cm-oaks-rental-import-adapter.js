(function (root, factory) {
  const scoreCore = typeof module !== 'undefined' && module.exports
    ? require('./lineage-rental-score-core.js')
    : root?.LINEAGE_RENTAL_SCORE_CORE;
  const api = factory(scoreCore);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CM_OAKS_RENTAL_IMPORT_ADAPTER = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (defaultScoreCore) {
  'use strict';

  // This adapter is deliberately narrower than the scorer.  It is the only
  // boundary that accepts pasted JSON, fixes the CM Oaks target, and chooses
  // which explicitly named fields are allowed to reach the scorer.
  const MODEL_VERSION = 'cm-oaks-rental-import-adapter-v1';
  const INPUT_SCHEMA = 'prettyderby-rental-candidates.v1';
  const ADAPTER_SCHEMA_VERSION = 1;
  const AUTHORITY = 'CANDIDATE_ADVISORY_ONLY';
  const TARGET = Object.freeze({
    courseId: 10606,
    surface: 'turf',
    distanceType: 'medium',
    distanceM: 2400,
    runningStyle: 'runner',
    decisionScope: 'cm_winner_line'
  });
  const ALLOWED_LINEAGE_STAGES = new Set(['grandparent', 'direct_parent']);
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

  const TARGET_OVERRIDE_KEYS = new Set([
    'target',
    'courseid',
    'course_id',
    'surface',
    'groundtype',
    'ground_type',
    'distancetype',
    'distance_type',
    'distancem',
    'distance_m',
    'runningstyle',
    'running_style',
    'decisionscope',
    'decision_scope'
  ]);

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function hasOwn(source, key) {
    return Boolean(source)
      && Object.prototype.hasOwnProperty.call(source, key);
  }

  function clone(value) {
    if (Array.isArray(value)) return value.map(clone);
    if (isObject(value)) {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
    }
    return value;
  }

  function text(value, fallback = '') {
    if (typeof value !== 'string') return fallback;
    const result = value.trim();
    return result || fallback;
  }

  function firstPresent(source, keys) {
    if (!source) return { present: false, value: undefined, key: null };
    for (const key of keys) {
      if (hasOwn(source, key)) return { present: true, value: source[key], key };
    }
    return { present: false, value: undefined, key: null };
  }

  function normalizedKey(value) {
    return typeof value === 'string'
      ? value.toLowerCase().replace(/[^a-z0-9]/g, '')
      : '';
  }

  function isKuaKey(key) {
    const normalized = normalizedKey(key);
    return normalized === 'kua' || normalized.startsWith('kua');
  }

  function findForbiddenProbabilityPath(value, path = '', insideKua = false) {
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        const found = findForbiddenProbabilityPath(value[index], `${path}[${index}]`, insideKua);
        if (found) return found;
      }
      return null;
    }
    if (!isObject(value)) return null;
    for (const [key, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${key}` : key;
      const keyIsKua = isKuaKey(key);
      // Keep the scorer's existing KUA boundary: KUA is advisory-only and
      // never reaches the scoring input, so model rates inside it are ignored.
      if (!insideKua && !keyIsKua && FORBIDDEN_PROBABILITY_KEYS.has(normalizedKey(key))) {
        return childPath;
      }
      const found = findForbiddenProbabilityPath(child, childPath, insideKua || keyIsKua);
      if (found) return found;
    }
    return null;
  }

  function errorResult(code, path = null, extraWarnings = []) {
    const error = { code };
    if (path) error.path = path;
    return {
      adapterSchemaVersion: ADAPTER_SCHEMA_VERSION,
      adapterModelVersion: MODEL_VERSION,
      inputSchema: INPUT_SCHEMA,
      authority: AUTHORITY,
      status: 'BLOCKED',
      importStatus: 'BLOCKED',
      probabilityStatus: 'NOT_COMPUTED',
      target: clone(TARGET),
      rankings: [],
      dataGaps: [],
      errors: [error],
      warnings: clone(extraWarnings)
    };
  }

  function unavailableResult(warnings = []) {
    return {
      adapterSchemaVersion: ADAPTER_SCHEMA_VERSION,
      adapterModelVersion: MODEL_VERSION,
      inputSchema: INPUT_SCHEMA,
      authority: AUTHORITY,
      status: 'UNAVAILABLE',
      importStatus: 'IMPORTED',
      probabilityStatus: 'NOT_COMPUTED',
      target: clone(TARGET),
      rankings: [],
      dataGaps: [],
      errors: [],
      warnings: [
        { code: 'LINEAGE_RENTAL_SCORE_CORE_UNAVAILABLE' },
        ...clone(warnings)
      ]
    };
  }

  function normalizeId(value) {
    if (typeof value === 'string') {
      const result = value.trim();
      return result || null;
    }
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    return null;
  }

  function normalizeOptionalText(value) {
    return typeof value === 'string'
      ? text(value)
      : (typeof value === 'number' && Number.isFinite(value) ? String(value) : null);
  }

  function copyField(target, source, destination, aliases) {
    const found = firstPresent(source, aliases);
    if (!found.present) return;
    // Preserve null and invalid values as supplied.  The scorer owns the
    // UNKNOWN normalization; this adapter must never turn missing evidence
    // into a zero or into a proxy derived from an array length.
    target[destination] = clone(found.value);
  }

  function copyTextField(target, source, destination, aliases) {
    const found = firstPresent(source, aliases);
    if (!found.present) return;
    const value = normalizeOptionalText(found.value);
    if (value !== null) target[destination] = value;
  }

  function mapCandidate(rawCandidate, index) {
    const idField = firstPresent(rawCandidate, ['id', 'candidateId', 'candidate_id']);
    const id = idField.present ? normalizeId(idField.value) : null;
    if (!id) return { error: errorResult('CANDIDATE_ID_REQUIRED', `candidates[${index}]`) };

    const candidate = { id };
    copyTextField(candidate, rawCandidate, 'nameZhTw', [
      'nameZhTw', 'name_zh_tw', 'name', 'candidateName', 'candidate_name'
    ]);

    const body = isObject(rawCandidate.body) ? rawCandidate.body : null;
    const bodyBlue = firstPresent(rawCandidate, [
      'bodyBlue', 'body_blue', 'blueFactor', 'blue_factor', 'blue'
    ]);
    if (bodyBlue.present) candidate.body_blue = clone(bodyBlue.value);
    else if (body) copyField(candidate, body, 'body_blue', ['blue', 'blueFactor', 'blue_factor']);

    const bodyRed = firstPresent(rawCandidate, [
      'bodyRed', 'body_red', 'redFactor', 'red_factor', 'red'
    ]);
    if (bodyRed.present) candidate.body_red = clone(bodyRed.value);
    else if (body) copyField(candidate, body, 'body_red', ['red', 'redFactor', 'red_factor']);

    const bodyUnique = firstPresent(rawCandidate, ['bodyUnique', 'body_unique', 'unique']);
    if (bodyUnique.present) candidate.body_unique = clone(bodyUnique.value);
    else if (body) copyField(candidate, body, 'body_unique', ['unique', 'bodyUnique', 'body_unique']);

    copyField(candidate, rawCandidate, 'effective_body_white_count', [
      'effectiveWhiteCount', 'effective_white_count',
      'effective_body_white_count', 'bodyWhiteCount', 'body_white_count'
    ]);
    copyTextField(candidate, rawCandidate, 'effective_body_white_count_status', [
      'effectiveWhiteCountStatus', 'effective_white_count_status',
      'effective_body_white_count_status', 'bodyWhiteCountStatus', 'body_white_count_status'
    ]);
    copyField(candidate, rawCandidate, 'directly_useful_body_white_families', [
      'directlyUsefulBodyWhiteFamilies', 'directly_useful_body_white_families',
      'usefulWhiteFamilies', 'useful_white_families', 'whiteFactors', 'white_factors'
    ]);
    copyTextField(candidate, rawCandidate, 'user_ordinal_white_comparison', [
      'userOrdinalWhiteComparison', 'user_ordinal_white_comparison',
      'whiteFactorOrdinal', 'white_factor_ordinal'
    ]);
    copyField(candidate, rawCandidate, 'parents_construction_reds', [
      'parents', 'parentsConstructionReds', 'parents_construction_reds',
      'constructionReds', 'construction_reds'
    ]);
    copyField(candidate, rawCandidate, 'shared_g1_count', [
      'g1Count', 'g1_count', 'sharedG1Count', 'shared_g1_count',
      'sharedG1Wins', 'shared_g1_wins'
    ]);
    copyTextField(candidate, rawCandidate, 'g1_status', ['g1Status', 'g1_status']);
    copyTextField(candidate, rawCandidate, 'source_status', ['sourceStatus', 'source_status']);

    return { candidate };
  }

  function collectIgnoredTargetFields(payload) {
    return Object.keys(payload)
      .filter(key => TARGET_OVERRIDE_KEYS.has(normalizedKey(key)))
      .sort();
  }

  function normalizeOptions(options) {
    if (options === null || options === undefined) return { ok: true, value: {} };
    if (!isObject(options)) {
      return { ok: false, result: errorResult('OPTIONS_MUST_BE_OBJECT', 'options') };
    }

    const stageField = firstPresent(options, ['lineageStage', 'lineage_stage']);
    const stage = stageField.present
      ? text(stageField.value)
      : 'grandparent';
    if (!ALLOWED_LINEAGE_STAGES.has(stage)) {
      return { ok: false, result: errorResult('INVALID_LINEAGE_STAGE', 'options.lineageStage') };
    }

    const recoveryField = firstPresent(options, [
      'deckHasEarlyOrMiddleRecovery', 'deck_has_early_or_middle_recovery'
    ]);
    if (recoveryField.present
      && typeof recoveryField.value !== 'boolean') {
      return { ok: false, result: errorResult('RECOVERY_MUST_BE_BOOLEAN', 'options.deckHasEarlyOrMiddleRecovery') };
    }

    return {
      ok: true,
      value: {
        lineageStage: stage,
        hasRecovery: recoveryField.present,
        recovery: recoveryField.present ? recoveryField.value : undefined,
        scorerOverride: hasOwn(options, 'scorer')
          ? options.scorer
          : hasOwn(options, 'scoreCore')
            ? options.scoreCore
            : hasOwn(options, 'lineageRentalScoreCore')
              ? options.lineageRentalScoreCore
              : undefined,
        hasScorerOverride: hasOwn(options, 'scorer')
          || hasOwn(options, 'scoreCore')
          || hasOwn(options, 'lineageRentalScoreCore')
      }
    };
  }

  function validateAndMapPayload(payload) {
    if (!isObject(payload)) return { result: errorResult('ROOT_MUST_BE_OBJECT', 'root') };
    if (payload.schemaVersion !== INPUT_SCHEMA) {
      return { result: errorResult('SCHEMA_VERSION_UNSUPPORTED', 'schemaVersion') };
    }
    const forbiddenPath = findForbiddenProbabilityPath(payload);
    if (forbiddenPath) {
      return { result: errorResult('FORBIDDEN_PROBABILITY_FIELD', forbiddenPath) };
    }
    if (!Array.isArray(payload.candidates)) {
      return { result: errorResult('CANDIDATES_MUST_BE_ARRAY', 'candidates') };
    }
    if (!payload.candidates.length) {
      return { result: errorResult('CANDIDATES_MUST_NOT_BE_EMPTY', 'candidates') };
    }

    const mapped = [];
    for (let index = 0; index < payload.candidates.length; index += 1) {
      const rawCandidate = payload.candidates[index];
      if (!isObject(rawCandidate)) {
        return { result: errorResult('CANDIDATE_MUST_BE_OBJECT', `candidates[${index}]`) };
      }
      const row = mapCandidate(rawCandidate, index);
      if (row.error) return { result: row.error };
      mapped.push(row.candidate);
    }

    const seen = new Set();
    for (let index = 0; index < mapped.length; index += 1) {
      if (seen.has(mapped[index].id)) {
        return { result: errorResult('DUPLICATE_CANDIDATE_ID', `candidates[${index}].id`) };
      }
      seen.add(mapped[index].id);
    }

    return {
      candidates: mapped,
      ignoredTargetFields: collectIgnoredTargetFields(payload)
    };
  }

  function scoringInput(candidates, normalizedOptions) {
    const input = {
      // These are intentionally constants.  No pasted field can redirect the
      // scorer to another race, surface, distance, style, or objective.
      server: 'zh_tw',
      course_id: TARGET.courseId,
      course_name: 'CM 奧克斯',
      surface: TARGET.surface,
      distance_type: TARGET.distanceType,
      distance_m: TARGET.distanceM,
      running_style: TARGET.runningStyle,
      lineage_stage: normalizedOptions.lineageStage,
      decision_scope: TARGET.decisionScope,
      candidates
    };
    if (normalizedOptions.hasRecovery) {
      input.deck_has_early_or_middle_recovery = normalizedOptions.recovery;
    }
    return input;
  }

  function resolvedScorer(normalizedOptions) {
    return normalizedOptions.hasScorerOverride
      ? normalizedOptions.scorerOverride
      : defaultScoreCore;
  }

  function warningForIgnoredFields(fields) {
    return fields.length
      ? [{
        code: 'FIXED_CM_OAKS_TARGET_APPLIED',
        ignoredInputFields: fields
      }]
      : [];
  }

  function parseAndScore(inputText, options = {}) {
    if (typeof inputText !== 'string') {
      return errorResult('JSON_TEXT_REQUIRED', 'input');
    }
    let payload;
    try {
      payload = JSON.parse(inputText);
    } catch (error) {
      return errorResult('JSON_PARSE_ERROR', 'input');
    }

    const normalizedOptions = normalizeOptions(options);
    if (!normalizedOptions.ok) return normalizedOptions.result;
    const mapped = validateAndMapPayload(payload);
    if (mapped.result) return mapped.result;

    const scorer = resolvedScorer(normalizedOptions.value);
    const scoreFunction = typeof scorer?.rankLineageAncestorCandidates === 'function'
      ? scorer.rankLineageAncestorCandidates
      : typeof scorer?.rankCandidates === 'function'
        ? scorer.rankCandidates
        : null;
    if (!scoreFunction) return unavailableResult(warningForIgnoredFields(mapped.ignoredTargetFields));

    const input = scoringInput(mapped.candidates, normalizedOptions.value);
    let scored;
    try {
      scored = scoreFunction.call(scorer, input);
    } catch (error) {
      return {
        ...unavailableResult(warningForIgnoredFields(mapped.ignoredTargetFields)),
        status: 'ERROR',
        importStatus: 'IMPORTED',
        errors: [{ code: 'SCORER_ERROR' }]
      };
    }
    if (!isObject(scored)) {
      return {
        ...unavailableResult(warningForIgnoredFields(mapped.ignoredTargetFields)),
        status: 'ERROR',
        importStatus: 'IMPORTED',
        errors: [{ code: 'SCORER_INVALID_RESULT' }]
      };
    }

    const result = clone(scored);
    const scorerWarnings = Array.isArray(result.warnings) ? result.warnings : [];
    return {
      ...result,
      adapterSchemaVersion: ADAPTER_SCHEMA_VERSION,
      adapterModelVersion: MODEL_VERSION,
      inputSchema: INPUT_SCHEMA,
      authority: AUTHORITY,
      importStatus: 'IMPORTED',
      target: clone(TARGET),
      probabilityStatus: 'NOT_COMPUTED',
      warnings: [...scorerWarnings, ...warningForIgnoredFields(mapped.ignoredTargetFields)]
    };
  }

  return {
    MODEL_VERSION,
    INPUT_SCHEMA,
    ADAPTER_SCHEMA_VERSION,
    AUTHORITY,
    TARGET,
    parseAndScore,
  };
});
