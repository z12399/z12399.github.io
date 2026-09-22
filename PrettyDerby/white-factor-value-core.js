(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.WHITE_FACTOR_VALUE_CORE = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const MODEL_VERSION = 'white-factor-value-v1';
  const AUTHORITY = 'CANDIDATE_ADVISORY_ONLY';
  const TARGET_CONTRACT = Object.freeze({
    courseId: 10606,
    groundType: 1,
    ground: 'turf',
    distance: 2400,
    distanceType: 3,
    distanceLabel: 'medium',
    runningStyle: 1,
    runningStyleLabel: 'runner',
    objective: 'cm_winner_line'
  });
  const GENERATION_PROXY = Object.freeze({
    ordinary_white: 0.2,
    double_circle: 0.25,
    gold: 0.4
  });
  const GRANDPARENT_SENSITIVITY = Object.freeze({ low: 0.33, base: 0.4, high: 0.5 });
  const NATIVE_DUPLICATE_SKILLS = new Set([203402, 203382]);
  const NOT_FACTOR_SKILLS = new Set([410041]);
  const GRASS_NOT_APPLICABLE_SKILLS = new Set([202952]);

  function finiteNumber(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const result = Number(trimmed);
    return Number.isFinite(result) ? result : null;
  }

  function integer(value, fallback = null) {
    const result = finiteNumber(value);
    return result === null || !Number.isInteger(result) ? fallback : result;
  }

  function text(value, fallback = '') {
    const result = value === null || value === undefined ? '' : String(value).trim();
    return result || fallback;
  }

  function own(source, key) {
    return Boolean(source && typeof source === 'object'
      && Object.prototype.hasOwnProperty.call(source, key));
  }

  function firstOwn(source, keys) {
    if (!source || typeof source !== 'object') return undefined;
    for (const key of keys) {
      if (own(source, key)) return source[key];
    }
    return undefined;
  }

  function clamp01(value) {
    const result = finiteNumber(value);
    return result === null || result < 0 || result > 1 ? null : result;
  }

  function roundMetric(value) {
    return value === null ? null : Math.round(value * 1e12) / 1e12;
  }

  function normalizeToken(value) {
    return text(value)
      .toLowerCase()
      .replace(/[\s_\-．。]/g, '');
  }

  function targetValue(input, keys) {
    const containers = [input?.target, input?.course, input?.context, input];
    for (const container of containers) {
      const value = firstOwn(container, keys);
      if (value !== undefined && value !== null && value !== '') return value;
    }
    return undefined;
  }

  function sameCourseId(value) {
    if (value === undefined || value === null || value === '') return false;
    const result = finiteNumber(value);
    return result !== null && result === TARGET_CONTRACT.courseId;
  }

  function sameDistance(value) {
    if (value === undefined || value === null || value === '') return false;
    const result = finiteNumber(value);
    return result !== null && result === TARGET_CONTRACT.distance;
  }

  function sameGround(value) {
    if (value === undefined || value === null || value === '') return false;
    const token = normalizeToken(value);
    return token === '1' || token === 'turf' || token === 'grass'
      || token === '草地' || token === '草';
  }

  function sameDistanceType(value) {
    if (value === undefined || value === null || value === '') return false;
    const token = normalizeToken(value);
    return token === '3' || token === 'medium' || token === 'middle'
      || token === '中距離' || token === '中';
  }

  function sameRunningStyle(value) {
    if (value === undefined || value === null || value === '') return false;
    const token = normalizeToken(value);
    return token === '1' || token === 'runner' || token === 'frontrunner'
      || token === '逃' || token === '領頭';
  }

  function sameObjective(value) {
    if (value === undefined || value === null || value === '') return false;
    const token = normalizeToken(value);
    return token === 'cmwinnerline' || token === 'winnerline'
      || token === 'cm';
  }

  function inspectTarget(input) {
    const failures = [];
    const courseId = targetValue(input, ['courseId', 'course_id', 'courseID']);
    const distance = targetValue(input, ['distance', 'distanceM', 'distance_m']);
    const ground = targetValue(input, ['groundType', 'ground_type', 'ground', 'surface']);
    const distanceType = targetValue(input, ['distanceType', 'distance_type', 'distanceLabel']);
    const runningStyle = targetValue(input, ['runningStyle', 'running_style', 'style']);
    const objective = targetValue(input, ['objective', 'targetObjective']);
    if (!sameCourseId(courseId)) failures.push('course_id_must_be_10606');
    if (!sameDistance(distance)) failures.push('distance_must_be_2400');
    if (!sameGround(ground)) failures.push('ground_must_be_turf');
    if (!sameDistanceType(distanceType)) failures.push('distance_type_must_be_medium');
    if (!sameRunningStyle(runningStyle)) failures.push('running_style_must_be_runner');
    if (!sameObjective(objective)) failures.push('objective_must_be_cm_winner_line');
    return {
      status: failures.length ? 'BLOCKED' : 'PASS',
      failures,
      resolved: { ...TARGET_CONTRACT }
    };
  }

  function isKuaKey(key) {
    return normalizeToken(key) === 'kua';
  }

  function isForbiddenKey(key) {
    const token = normalizeToken(key);
    if (!token || isKuaKey(key)) return false;
    if (token === 'winnerline') return false;
    return token.includes('activation')
      || token.includes('inheritance')
      || token === 'inherit'
      || token === 'win'
      || token === 'winning'
      || token.includes('winrate')
      || token.includes('winprobability')
      || token.includes('winningprobability')
      || token.includes('probability')
      || token.includes('chance')
      || token.endsWith('rate');
  }

  function findForbiddenFields(value, path = '', result = []) {
    if (result.length || value === null || value === undefined) return result;
    if (Array.isArray(value)) {
      value.forEach((item, index) => findForbiddenFields(item, `${path}[${index}]`, result));
      return result;
    }
    if (typeof value !== 'object') return result;
    for (const [key, child] of Object.entries(value)) {
      if (isKuaKey(key)) continue;
      const childPath = path ? `${path}.${key}` : key;
      if (isForbiddenKey(key)) {
        result.push(childPath);
        return result;
      }
      findForbiddenFields(child, childPath, result);
      if (result.length) return result;
    }
    return result;
  }

  function normalizeVariant(value) {
    const token = normalizeToken(value);
    if (!token) return 'UNKNOWN';
    if (token === 'ordinarywhite' || token === 'white' || token === 'normal') {
      return 'ordinary_white';
    }
    if (token === 'doublecircle' || token === 'white◎' || token === '◎') {
      return 'double_circle';
    }
    if (token === 'gold' || token === '金') return 'gold';
    if (token === 'unique' || token === '固有') return 'unique';
    return 'UNKNOWN';
  }

  function normalizeWinnerLine(value) {
    const raw = typeof value === 'object' && value !== null
      ? firstOwn(value, ['status', 'applicability', 'value'])
      : value;
    const token = normalizeToken(raw);
    if (token === 'primary' || token === '主要' || token === 'winner') return 'PRIMARY';
    if (token === 'secondary' || token === '次要') return 'SECONDARY';
    if (token === 'none' || token === '無') return 'NONE';
    return 'UNKNOWN';
  }

  function snapshotStatus(row) {
    const raw = normalizeToken(firstOwn(row, ['snapshotStatus', 'snapshot_status']));
    if (['missing', 'unknown', 'invalid', 'unavailable', 'notapplicable'].includes(raw)) {
      return raw === 'notapplicable' ? 'NOT_APPLICABLE' : 'UNKNOWN';
    }
    const expected = finiteNumber(firstOwn(row, [
      'snapshotExpectedBashin',
      'snapshot_expected_bashin',
      'expectedBashin',
      'expected_bashin'
    ]));
    return expected === null || expected < 0 ? 'UNKNOWN' : 'KNOWN';
  }

  function snapshotNumber(row, keys, status) {
    if (status !== 'KNOWN') return null;
    return finiteNumber(firstOwn(row, keys));
  }

  function normalizeCardRoute(row) {
    const raw = normalizeToken(firstOwn(row, ['cardRouteStatus', 'card_route_status']));
    if (raw === 'sourceexistsunselected') return 'SOURCE_EXISTS_UNSELECTED';
    if (raw === 'selectedcoverage') return 'SELECTED_COVERAGE';
    if (raw === 'notindeck') return 'NOT_IN_DECK';
    if (raw === 'guaranteed') return 'GUARANTEED';
    if (raw === 'unknown' || !raw) return 'UNKNOWN';
    return 'UNKNOWN';
  }

  function generationProxy(variant) {
    return Object.prototype.hasOwnProperty.call(GENERATION_PROXY, variant)
      ? GENERATION_PROXY[variant]
      : null;
  }

  function stageSensitivity(directValue, status, multiplier = 1) {
    if (directValue === null || status !== 'KNOWN') {
      return {
        status,
        value: null,
        sensitivity: { low: null, base: null, high: null },
        sensitivityStatus: status === 'UNKNOWN'
          ? 'UNKNOWN'
          : 'NOT_APPLICABLE'
      };
    }
    const value = roundMetric(directValue * multiplier);
    return {
      status: 'KNOWN',
      value,
      sensitivity: {
        low: roundMetric(value * GRANDPARENT_SENSITIVITY.low),
        base: roundMetric(value * GRANDPARENT_SENSITIVITY.base),
        high: roundMetric(value * GRANDPARENT_SENSITIVITY.high)
      },
      sensitivityStatus: 'UNVERIFIED_COMMUNITY_SENSITIVITY'
    };
  }

  function grandparentStage(directValue, status) {
    if (directValue === null || status !== 'KNOWN') {
      return {
        status,
        value: null,
        sensitivity: { low: null, base: null, high: null },
        sensitivityStatus: status === 'UNKNOWN'
          ? 'UNKNOWN'
          : 'NOT_APPLICABLE'
      };
    }
    return {
      status: 'KNOWN',
      value: roundMetric(directValue * GRANDPARENT_SENSITIVITY.base),
      sensitivity: {
        low: roundMetric(directValue * GRANDPARENT_SENSITIVITY.low),
        base: roundMetric(directValue * GRANDPARENT_SENSITIVITY.base),
        high: roundMetric(directValue * GRANDPARENT_SENSITIVITY.high)
      },
      sensitivityStatus: 'UNVERIFIED_COMMUNITY_SENSITIVITY'
    };
  }

  function scaleStage(stage, multiplier) {
    if (stage.value === null || multiplier === 1) return stage;
    return {
      ...stage,
      value: roundMetric(stage.value * multiplier),
      sensitivity: {
        low: stage.sensitivity.low === null ? null : roundMetric(stage.sensitivity.low * multiplier),
        base: stage.sensitivity.base === null ? null : roundMetric(stage.sensitivity.base * multiplier),
        high: stage.sensitivity.high === null ? null : roundMetric(stage.sensitivity.high * multiplier)
      }
    };
  }

  function buildGateBlockedResult(
    targetGate,
    warnings,
    failures = targetGate.failures,
    requiredSummary = { requiredSkillIds: [], unresolvedSkillIds: [], status: 'READY' }
  ) {
    return {
      schemaVersion: 1,
      modelVersion: MODEL_VERSION,
      authority: AUTHORITY,
      status: 'BLOCKED',
      hardGate: { status: 'BLOCKED', failures },
      target: targetGate.resolved,
      rows: [],
      rankings: [],
      requiredGoalSummary: requiredSummary,
      warnings
    };
  }

  function normalizePolicy(input) {
    const policy = input?.policy && typeof input.policy === 'object' ? input.policy : {};
    const secondaryWeight = clamp01(firstOwn(policy, ['secondaryWeight', 'secondary_weight']));
    const selectedCoverageMultiplier = clamp01(firstOwn(policy, [
      'selectedCoverageMultiplier',
      'selected_coverage_multiplier'
    ]));
    return { secondaryWeight, selectedCoverageMultiplier };
  }

  function normalizeRequiredSkillIds(input) {
    const raw = firstOwn(input, ['userRequiredSkillIds', 'user_required_skill_ids']);
    if (raw === undefined) return { ids: [], warnings: [] };
    if (!Array.isArray(raw)) {
      return {
        ids: [],
        warnings: [{
          code: 'USER_REQUIRED_SKILL_IDS_INVALID',
          detail: 'userRequiredSkillIds must be an array; ignored'
        }]
      };
    }
    const ids = [];
    const seen = new Set();
    const warnings = [];
    raw.forEach((value, index) => {
      const skillId = integer(value);
      if (skillId === null || skillId <= 0) {
        warnings.push({
          code: 'USER_REQUIRED_SKILL_ID_INVALID',
          detail: { index }
        });
        return;
      }
      if (seen.has(skillId)) {
        warnings.push({
          code: 'USER_REQUIRED_SKILL_ID_DUPLICATE',
          detail: { index, skillId }
        });
        return;
      }
      seen.add(skillId);
      ids.push(skillId);
    });
    return { ids, warnings };
  }

  function requiredGoalSummary(requiredSkillIds, rows = []) {
    const bySkillId = new Map(rows.map(row => [row.skillId, row]));
    const unresolvedSkillIds = requiredSkillIds.filter(skillId => {
      const row = bySkillId.get(skillId);
      if (!row) return true;
      if (row.bodyGoal?.status === 'NOT_REQUIRED') return false;
      return row.utilityStatus !== 'KNOWN' || row.scoreStatus !== 'RELATIVE';
    });
    return {
      requiredSkillIds: [...requiredSkillIds],
      unresolvedSkillIds,
      status: unresolvedSkillIds.length ? 'NEEDS_EVIDENCE' : 'READY'
    };
  }

  function blockedRequiredGoalSummary(requiredSkillIds) {
    return {
      requiredSkillIds: [...requiredSkillIds],
      unresolvedSkillIds: [...requiredSkillIds],
      status: requiredSkillIds.length ? 'NEEDS_EVIDENCE' : 'READY'
    };
  }

  function evaluateWhiteFactorValues(input = {}) {
    const source = input && typeof input === 'object' ? input : {};
    const required = normalizeRequiredSkillIds(source);
    const targetGate = inspectTarget(source);
    const forbidden = findForbiddenFields(source);
    const warnings = [...required.warnings];
    if (targetGate.failures.length) {
      return buildGateBlockedResult(targetGate, [...warnings, {
        code: 'TARGET_GATE_FAILED',
        detail: targetGate.failures
      }], targetGate.failures, blockedRequiredGoalSummary(required.ids));
    }
    if (forbidden.length) {
      return buildGateBlockedResult(targetGate, [...warnings, {
        code: 'FORBIDDEN_UNCERTAIN_FIELD',
        detail: forbidden
      }], ['forbidden_uncertain_field'], blockedRequiredGoalSummary(required.ids));
    }

    const policy = normalizePolicy(source);
    const nativeSkillIds = new Set((Array.isArray(source.nativeSkillIds)
      ? source.nativeSkillIds
      : Array.isArray(source.native_skill_ids) ? source.native_skill_ids : [])
      .map(integer)
      .filter(Number.isFinite));
    const candidates = Array.isArray(source.candidateSkills) ? source.candidateSkills : null;
    if (!candidates || candidates.length === 0) {
      return buildGateBlockedResult(targetGate, [...warnings, {
        code: 'CANDIDATE_SKILLS_REQUIRED',
        detail: 'candidateSkills must be a non-empty array'
      }], ['candidate_skills_required'], blockedRequiredGoalSummary(required.ids));
    }
    const seenSkillIds = new Set();
    for (let index = 0; index < candidates.length; index += 1) {
      const candidate = candidates[index];
      const skillId = candidate && typeof candidate === 'object'
        ? integer(firstOwn(candidate, ['skillId', 'skill_id', 'id']))
        : null;
      if (skillId === null || skillId <= 0) {
        return buildGateBlockedResult(targetGate, [...warnings, {
          code: 'CANDIDATE_SKILL_ID_INVALID',
          detail: { index }
        }], ['candidate_skill_id_invalid'], blockedRequiredGoalSummary(required.ids));
      }
      if (seenSkillIds.has(skillId)) {
        return buildGateBlockedResult(targetGate, [...warnings, {
          code: 'CANDIDATE_SKILL_ID_DUPLICATE',
          detail: { index, skillId }
        }], ['candidate_skill_id_duplicate'], blockedRequiredGoalSummary(required.ids));
      }
      seenSkillIds.add(skillId);
    }

    const rows = candidates.map((candidate, index) => {
      const row = candidate && typeof candidate === 'object' ? candidate : {};
      const skillId = integer(firstOwn(row, ['skillId', 'skill_id', 'id']));
      const familyId = integer(firstOwn(row, ['familyId', 'family_id'])) ?? skillId;
      const name = text(firstOwn(row, ['name', 'nameZhTw', 'name_zh_tw']), skillId === null ? `candidate-${index + 1}` : String(skillId));
      const variant = normalizeVariant(firstOwn(row, ['variant', 'factorVariant', 'factor_variant']));
      const rowSnapshotStatus = snapshotStatus(row);
      const isGrassNotApplicable = GRASS_NOT_APPLICABLE_SKILLS.has(skillId);
      const isNotFactor = NOT_FACTOR_SKILLS.has(skillId) || variant === 'unique';
      const winnerLine = normalizeWinnerLine(firstOwn(row, ['winnerLine', 'winner_line']));
      const secondaryWeight = policy.secondaryWeight;
      const winnerWeight = winnerLine === 'PRIMARY'
        ? 1
        : winnerLine === 'NONE'
          ? 0
          : winnerLine === 'SECONDARY'
            ? secondaryWeight
            : null;
      const utilityStatus = isGrassNotApplicable
        ? 'NOT_APPLICABLE'
        : rowSnapshotStatus;
      const expected = isGrassNotApplicable
        ? null
        : snapshotNumber(row, [
          'snapshotExpectedBashin',
          'snapshot_expected_bashin',
          'expectedBashin',
          'expected_bashin'
        ], utilityStatus);
      const min = isGrassNotApplicable ? null : snapshotNumber(row, ['snapshotMinBashin', 'minBashin', 'min_bashin'], utilityStatus);
      const max = isGrassNotApplicable ? null : snapshotNumber(row, ['snapshotMaxBashin', 'maxBashin', 'max_bashin'], utilityStatus);
      const proxy = isNotFactor ? null : generationProxy(variant);
      const canCompute = expected !== null && winnerWeight !== null && proxy !== null;
      const directValue = canCompute ? roundMetric(expected * winnerWeight * proxy) : null;
      const baseStageStatus = isGrassNotApplicable || isNotFactor
        ? 'NOT_APPLICABLE'
        : (directValue === null ? 'UNKNOWN' : 'KNOWN');
      const cardRouteStatus = normalizeCardRoute(row);
      const selectedWithPolicy = cardRouteStatus === 'SELECTED_COVERAGE'
        && policy.selectedCoverageMultiplier !== null;
      const selectedWithoutPolicy = cardRouteStatus === 'SELECTED_COVERAGE'
        && policy.selectedCoverageMultiplier === null;
      const acquisitionMultiplier = selectedWithPolicy
        ? policy.selectedCoverageMultiplier
        : 1;
      const bodyStage = stageSensitivity(directValue, baseStageStatus, 1);
      const directParentStage = stageSensitivity(directValue, baseStageStatus, 1);
      const grandparentStageValue = grandparentStage(directValue, baseStageStatus);
      const adjustedBody = scaleStage(bodyStage, acquisitionMultiplier);
      const adjustedDirect = scaleStage(directParentStage, acquisitionMultiplier);
      const adjustedGrand = scaleStage(grandparentStageValue, acquisitionMultiplier);
      const nativeDuplicate = NATIVE_DUPLICATE_SKILLS.has(skillId)
        && nativeSkillIds.has(skillId);
      const bodyGoal = isGrassNotApplicable || isNotFactor
        ? {
          status: 'NOT_APPLICABLE',
          marginalValue: null,
          reason: isGrassNotApplicable ? '草地目標不適用沙地技能' : '固有技能不是白因子目標'
        }
        : nativeDuplicate
          ? {
            status: 'NOT_REQUIRED',
            marginalValue: 0,
            reason: '目標本體已自帶此技能；不重複估算本體缺口'
          }
          : required.ids.includes(skillId)
            ? {
              status: 'REQUIRED',
              marginalValue: adjustedBody.value,
              reason: 'USER_REQUIRED_SKILL_IDS 明示本體需要追蹤；效用未知時保留 null'
            }
          : {
            status: 'OPTIONAL',
            marginalValue: null,
            reason: '未提供本體硬性必需設定，不擅自提升為 REQUIRED'
          };
      const childFactorOption = isGrassNotApplicable || isNotFactor
        ? {
          status: 'NOT_APPLICABLE',
          marginalValue: null,
          reason: isGrassNotApplicable ? 'ground_type 不符' : '固有技能不進白因子排序'
        }
        : nativeDuplicate
          ? {
            status: 'RETAIN',
            marginalValue: adjustedDirect.value,
            reason: '本體已自帶，但子代若缺技能家族仍可保留因子選項'
          }
          : {
            status: 'RETAIN',
            marginalValue: adjustedDirect.value,
            reason: '可作為子代白因子候選'
          };
      const dataGap = selectedWithoutPolicy;
      const score = isGrassNotApplicable || isNotFactor || adjustedDirect.value === null
        ? null
        : adjustedDirect.value;
      const scoreStatus = isGrassNotApplicable || isNotFactor
        ? 'NOT_APPLICABLE'
        : score === null ? 'UNKNOWN' : 'RELATIVE';
      const rowWarnings = [];
      if (rowSnapshotStatus === 'UNKNOWN' && !isGrassNotApplicable) {
        rowWarnings.push('snapshot 缺失或數值非法；保留 UNKNOWN/null');
      }
      if (selectedWithoutPolicy) {
        rowWarnings.push('SELECTED_COVERAGE 缺少 policy.selectedCoverageMultiplier；不折減，標記 dataGap');
      }
      if (winnerLine === 'SECONDARY' && secondaryWeight === null) {
        rowWarnings.push('SECONDARY 未提供 policy.secondaryWeight；不猜權重');
      }
      return {
        skillId,
        familyId,
        nameZhTw: name,
        variant,
        utilityStatus,
        courseUtility: {
          status: utilityStatus,
          value: expected,
          min,
          max,
          source: utilityStatus === 'KNOWN' ? 'INPUT_SNAPSHOT' : utilityStatus
        },
        winnerLine: {
          status: winnerLine,
          weight: winnerWeight,
          reason: winnerLine === 'PRIMARY'
            ? 'CM 只優化第一名線'
            : winnerLine === 'SECONDARY'
              ? '次要線；權重必須由 policy 明示'
              : winnerLine === 'NONE'
                ? '不納入 winner-line'
                : 'winner-line 未知'
        },
        factorMarginal: {
          status: isGrassNotApplicable || isNotFactor ? 'NOT_APPLICABLE' : (directValue === null ? 'UNKNOWN' : 'KNOWN'),
          authority: 'COMMUNITY_REFERENCE_NOT_GUARANTEE',
          generationProxy: proxy,
          formula: 'expectedBashin * winnerLineWeight * generationProxy',
          body: adjustedBody,
          directParent: adjustedDirect,
          grandparent: adjustedGrand,
          grandparentSensitivityStatus: 'UNVERIFIED_COMMUNITY_SENSITIVITY'
        },
        acquisition: {
          cardRouteStatus,
          factorMarginalMultiplier: acquisitionMultiplier,
          adjusted: selectedWithPolicy,
          dataGap,
          courseUtilityUnchanged: true
        },
        bodyGoal,
        childFactorOption,
        relativeScore: score,
        scoreStatus,
        warnings: rowWarnings
      };
    });

    rows.forEach(row => warnings.push(...row.warnings.map(detail => ({
      code: 'ROW_DATA_BOUNDARY',
      skillId: row.skillId,
      detail
    }))));
    warnings.push({
      code: 'NON_ADDITIVE_BASHIN',
      detail: '單技能 expectedBashin 不可直接相加；本 core 只輸出相對候選值'
    });
    warnings.push({
      code: 'NO_PROBABILITY_DERIVATION',
      detail: '不推導 activation、inheritance、win、factor probability/rate/chance'
    });

    const requiredGoal = requiredGoalSummary(required.ids, rows);

    const rankings = rows
      .filter(row => row.scoreStatus === 'RELATIVE' && Number.isFinite(row.relativeScore))
      .sort((left, right) => right.relativeScore - left.relativeScore || left.skillId - right.skillId)
      .map((row, index) => ({
        rank: index + 1,
        skillId: row.skillId,
        familyId: row.familyId,
        stage: 'direct_parent',
        score: row.relativeScore,
        scoreStatus: 'RELATIVE',
        reasonCodes: [
          row.winnerLine.status === 'PRIMARY' ? 'PRIMARY_WINNER_LINE' : 'EXPLICIT_SECONDARY_WEIGHT',
          row.acquisition.adjusted ? 'SELECTED_COVERAGE_ADJUSTED' : 'NO_ACQUISITION_DISCOUNT'
        ]
      }));
    return {
      schemaVersion: 1,
      modelVersion: MODEL_VERSION,
      authority: AUTHORITY,
      status: 'PASS',
      hardGate: { status: 'PASS', failures: [] },
      target: targetGate.resolved,
      rows,
      rankings,
      requiredGoalSummary: requiredGoal,
      warnings
    };
  }

  return {
    MODEL_VERSION,
    AUTHORITY,
    TARGET_CONTRACT,
    GENERATION_PROXY,
    GRANDPARENT_SENSITIVITY,
    evaluateWhiteFactorValues
  };
});
