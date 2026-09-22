(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.KUA_FRONTEND_CORE = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const SCHEMA_VERSION = 1;
  const STATE_TYPE = 'NORMALIZED_TURN_STATE';
  const STAT_AXES = Object.freeze(['speed', 'stamina', 'power', 'guts', 'wisdom', 'skillPt']);
  const ENGINE_STATUS = 'CLEAN_ROOM_FRONTEND_MVP_NOT_ORIGINAL_KUA';
  const PROBABILITY_STATUS = 'NOT_COMPUTED';
  const PROBABILITY_CLAIM_STATUS = 'NOT_PROBABILITY';
  const DEFAULT_RISK_PROFILE = Object.freeze({
    id: 'balanced',
    label: '平衡',
    nearTieToleranceRatio: 0.08
  });
  const DEFAULT_TARGET_PROFILE = Object.freeze({
    id: 'manual',
    label: '自行設定',
    sourceStatus: 'USER_CONFIGURED',
    recommendationUse: 'ADVISORY_ONLY',
    axes: {},
    diminishingReturns: { threshold: null, multiplier: 1 },
    utilityWeights: {
      vital: 0.25,
      motivation: 18,
      bond: 10,
      hint: 7,
      facility: 10,
      failure: 12,
      goalRace: 0
    }
  });
  const AXIS_ALIASES = Object.freeze({
    speed: 'speed', spd: 'speed',
    stamina: 'stamina', sta: 'stamina',
    power: 'power', pow: 'power',
    guts: 'guts', gut: 'guts',
    wisdom: 'wisdom', wis: 'wisdom', wiz: 'wisdom',
    skillPt: 'skillPt', skillPoints: 'skillPt', skill_points: 'skillPt', skl: 'skillPt'
  });

  function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function hasOwn(value, key) {
    return Object.prototype.hasOwnProperty.call(value, key);
  }

  function text(value, fallback = '') {
    const result = value == null ? '' : String(value).trim();
    return result || fallback;
  }

  function number(value, fallback = null) {
    if (value === null || value === undefined || value === '') return fallback;
    const result = Number(value);
    return Number.isFinite(result) ? result : fallback;
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function round(value, places = 6) {
    if (!Number.isFinite(Number(value))) return null;
    const factor = 10 ** places;
    return Math.round(Number(value) * factor) / factor;
  }

  function addError(errors, code, path, message) {
    errors.push({ code, path, message });
  }

  function addWarning(warnings, code, path, message) {
    warnings.push({ code, path, message });
  }

  function canonicalAxis(key) {
    return AXIS_ALIASES[String(key)] || null;
  }

  function normalizeScalar(source, key, errors, options = {}) {
    const { required = false, fallback = null, minimum = null } = options;
    if (!hasOwn(source, key)) {
      if (required) addError(errors, 'MISSING_REQUIRED_FIELD', key, `缺少必要欄位：${key}`);
      return fallback;
    }
    const parsed = number(source[key], null);
    if (parsed === null) {
      addError(errors, 'INVALID_NUMBER', key, `${key} 必須是有限數字。`);
      return fallback;
    }
    return minimum === null ? parsed : Math.max(minimum, parsed);
  }

  function normalizeBoolean(source, key, errors, options = {}) {
    const { required = false, fallback = false } = options;
    if (!hasOwn(source, key)) {
      if (required) addError(errors, 'MISSING_REQUIRED_FIELD', key, `缺少必要欄位：${key}`);
      return fallback;
    }
    if (typeof source[key] === 'boolean') return source[key];
    if (source[key] === 1 || source[key] === '1' || String(source[key]).toLowerCase() === 'true') return true;
    if (source[key] === 0 || source[key] === '0' || String(source[key]).toLowerCase() === 'false') return false;
    addError(errors, 'INVALID_BOOLEAN', key, `${key} 必須是 boolean。`);
    return fallback;
  }

  function normalizeNamedAxes(raw, path, errors, warnings, options = {}) {
    const { required = false, defaultValue = 0, nonNegative = false } = options;
    const result = Object.fromEntries(STAT_AXES.map(axis => [axis, defaultValue]));
    if (raw === undefined || raw === null) {
      if (required) addError(errors, 'MISSING_REQUIRED_FIELD', path, `缺少具名軸物件：${path}`);
      return result;
    }
    if (Array.isArray(raw)) {
      addError(errors, 'AXIS_ARRAY_NOT_ACCEPTED', path, `${path} 必須使用具名軸物件，不接受陣列位置映射。`);
      return result;
    }
    if (!isObject(raw)) {
      addError(errors, 'INVALID_AXIS_OBJECT', path, `${path} 必須是具名軸物件。`);
      return result;
    }
    const seen = new Set();
    Object.keys(raw).forEach(key => {
      const axis = canonicalAxis(key);
      if (!axis) {
        addError(errors, 'UNKNOWN_AXIS_KEY', `${path}.${key}`, `不認識的 named axis：${key}。`);
        return;
      }
      if (seen.has(axis)) {
        addError(errors, 'DUPLICATE_AXIS_KEY', `${path}.${key}`, `同一具名軸重複提供：${axis}。`);
        return;
      }
      seen.add(axis);
      const parsed = number(raw[key], null);
      if (parsed === null) {
        addError(errors, 'INVALID_AXIS_VALUE', `${path}.${key}`, `${key} 必須是有限數字。`);
        return;
      }
      result[axis] = nonNegative ? Math.max(0, parsed) : parsed;
      if (key !== axis) {
        addWarning(warnings, 'AXIS_ALIAS_NORMALIZED', `${path}.${key}`, `${key} 已按具名 alias 轉為 ${axis}。`);
      }
    });
    if (required) {
      STAT_AXES.forEach(axis => {
        if (!seen.has(axis)) {
          addError(errors, 'MISSING_REQUIRED_AXIS', `${path}.${axis}`, `缺少必要 named axis：${axis}。`);
          result[axis] = null;
        }
      });
    }
    return result;
  }

  function evidenceStatus(value) {
    return text(value, 'UNVERIFIED').toUpperCase();
  }

  function normalizeCommand(raw, index, stateErrors, stateWarnings) {
    const source = isObject(raw) ? raw : {};
    const path = `commands[${index}]`;
    const errors = [];
    const warnings = [];
    const id = text(source.id);
    const type = text(source.type);
    const label = text(source.label);
    if (!id) addError(errors, 'MISSING_COMMAND_ID', `${path}.id`, '行動必須有穩定 id。');
    if (!type) addError(errors, 'MISSING_COMMAND_TYPE', `${path}.type`, '行動必須有 type。');
    if (!label) addError(errors, 'MISSING_COMMAND_LABEL', `${path}.label`, '行動必須有可讀 label。');
    const available = normalizeBoolean(source, 'available', errors, { required: true, fallback: false });
    const rawFailureRate = hasOwn(source, 'failureRate') ? number(source.failureRate, null) : null;
    if (rawFailureRate === null) addError(errors, 'MISSING_OR_INVALID_FAILURE_RATE', `${path}.failureRate`, 'failureRate 必須是 0 到 100 的有限數字。');
    const failureRate = rawFailureRate === null ? null : clamp(rawFailureRate, 0, 100);
    if (rawFailureRate !== null && rawFailureRate !== failureRate) {
      addWarning(warnings, 'FAILURE_RATE_CLAMPED', `${path}.failureRate`, 'failureRate 已限制在 0 到 100；這不是成功率。');
    }
    const gains = normalizeNamedAxes(source.gains, `${path}.gains`, errors, warnings, {
      required: true,
      defaultValue: 0,
      nonNegative: false
    });
    const numericDelta = key => normalizeScalar(source, key, errors, { fallback: 0 });
    const isGoalRace = normalizeBoolean(source, 'isGoalRace', errors, { fallback: false });
    if (!hasOwn(source, 'evidenceStatus')) {
      addWarning(warnings, 'MISSING_EVIDENCE_STATUS', `${path}.evidenceStatus`, '未提供 evidenceStatus，保持 UNVERIFIED。');
    }
    const command = {
      id: id || `command-${index + 1}`,
      type: type || 'unknown',
      label: label || id || `候選行動 ${index + 1}`,
      available,
      failureRate,
      gains,
      vitalDelta: numericDelta('vitalDelta'),
      motivationDelta: numericDelta('motivationDelta'),
      bondGain: numericDelta('bondGain'),
      hintCount: numericDelta('hintCount'),
      facilityGain: numericDelta('facilityGain'),
      isGoalRace,
      evidenceStatus: evidenceStatus(source.evidenceStatus),
      validationErrors: errors,
      validationWarnings: warnings,
      sourceIndex: index
    };
    errors.forEach(error => stateErrors.push(error));
    warnings.forEach(warning => stateWarnings.push(warning));
    return command;
  }

  function normalizeTurnState(input = {}) {
    const source = isObject(input) ? input : {};
    const errors = [];
    const warnings = [];
    if (!isObject(input)) addError(errors, 'INVALID_STATE_OBJECT', '$', '回合狀態必須是物件。');
    if (hasOwn(source, 'schemaVersion') && Number(source.schemaVersion) !== SCHEMA_VERSION) {
      addError(errors, 'UNSUPPORTED_SCHEMA_VERSION', 'schemaVersion', `只支援 NORMALIZED_TURN_STATE schema v${SCHEMA_VERSION}。`);
    }
    const stats = normalizeNamedAxes(source.stats, 'stats', errors, warnings, {
      required: true,
      defaultValue: null,
      nonNegative: true
    });
    const turn = normalizeScalar(source, 'turn', errors, { required: true, fallback: null, minimum: 0 });
    const vital = normalizeScalar(source, 'vital', errors, { required: true, fallback: null });
    const motivation = normalizeScalar(source, 'motivation', errors, { required: true, fallback: null });
    if (!Array.isArray(source.commands)) {
      addError(errors, 'MISSING_COMMANDS', 'commands', 'commands 必須是候選行動陣列。');
    }
    const commands = Array.isArray(source.commands)
      ? source.commands.map((command, index) => normalizeCommand(command, index, errors, warnings))
      : [];
    const normalizationStatus = errors.length ? 'UNVERIFIED' : 'READY';
    return {
      schemaVersion: SCHEMA_VERSION,
      stateType: STATE_TYPE,
      turn,
      vital,
      motivation,
      stats,
      commands,
      sourceStatus: text(source.sourceStatus, 'MANUAL_SNAPSHOT').toUpperCase(),
      connectionStatus: text(source.connectionStatus, 'NOT_LIVE_CONNECTED').toUpperCase(),
      normalizationStatus,
      status: normalizationStatus,
      valid: normalizationStatus === 'READY',
      errors,
      warnings,
      probabilityStatus: PROBABILITY_STATUS,
      probabilityClaimStatus: PROBABILITY_CLAIM_STATUS,
      engineStatus: ENGINE_STATUS
    };
  }

  function normalizeTargetProfile(raw = {}) {
    const source = isObject(raw) ? raw : {};
    const rawAxes = isObject(source.axes) ? source.axes : {};
    const axes = Object.fromEntries(STAT_AXES.map(axis => {
      const entry = isObject(rawAxes[axis]) ? rawAxes[axis] : {};
      return [axis, {
        axis,
        label: text(entry.label, axis),
        minimum: number(entry.minimum, null),
        target: number(entry.target, null),
        belowWeight: Math.max(0, number(entry.belowWeight, 1)),
        surplusWeight: Math.max(0, number(entry.surplusWeight ?? entry.overWeight, 0.25)),
        evidenceStatus: evidenceStatus(entry.evidenceStatus || source.sourceStatus)
      }];
    }));
    const diminishingReturns = isObject(source.diminishingReturns) ? source.diminishingReturns : {};
    const rawWeights = source.utilityWeights || source.weights || {};
    const utilityWeights = {
      ...DEFAULT_TARGET_PROFILE.utilityWeights,
      ...Object.fromEntries(['vital', 'motivation', 'bond', 'hint', 'facility', 'failure', 'goalRace']
        .map(key => [key, Math.max(0, number(rawWeights[key], DEFAULT_TARGET_PROFILE.utilityWeights[key]))]))
    };
    return {
      id: text(source.id, 'manual'),
      label: text(source.label, '自行設定'),
      sourceStatus: evidenceStatus(source.sourceStatus || 'USER_CONFIGURED'),
      recommendationUse: text(source.recommendationUse, 'ADVISORY_ONLY'),
      axes,
      diminishingReturns: {
        threshold: number(diminishingReturns.threshold, null),
        multiplier: clamp(number(diminishingReturns.multiplier, 1), 0, 1),
        evidenceStatus: evidenceStatus(diminishingReturns.evidenceStatus || source.sourceStatus)
      },
      utilityWeights,
      riskProfile: isObject(source.riskProfile) ? {
        id: text(source.riskProfile.id, DEFAULT_RISK_PROFILE.id),
        label: text(source.riskProfile.label, DEFAULT_RISK_PROFILE.label),
        nearTieToleranceRatio: clamp(number(source.riskProfile.nearTieToleranceRatio, DEFAULT_RISK_PROFILE.nearTieToleranceRatio), 0, 1)
      } : DEFAULT_RISK_PROFILE
    };
  }

  function effectiveGain(fromValue, toValue, diminishingReturns = {}) {
    const from = Math.max(0, number(fromValue, 0));
    const to = Math.max(from, number(toValue, from));
    const threshold = number(diminishingReturns.threshold, null);
    if (threshold === null) return to - from;
    const multiplier = clamp(number(diminishingReturns.multiplier, 0.5), 0, 1);
    if (to <= threshold) return to - from;
    if (from >= threshold) return (to - from) * multiplier;
    return (threshold - from) + (to - threshold) * multiplier;
  }

  function statUtility(value, targetEntry = {}, diminishingReturns = {}) {
    const current = Math.max(0, number(value, 0));
    const target = number(targetEntry.target ?? targetEntry.minimum, null);
    if (target === null) return null;
    const belowWeight = Math.max(0, number(targetEntry.belowWeight, 1));
    const surplusWeight = Math.max(0, number(targetEntry.surplusWeight, 0.25));
    const below = effectiveGain(0, Math.min(current, target), diminishingReturns) * belowWeight;
    const surplus = current > target
      ? effectiveGain(target, current, diminishingReturns) * surplusWeight
      : 0;
    return below + surplus;
  }

  function resolveCommandAndState(first, second) {
    if (isObject(first) && Array.isArray(first.commands)) return { state: first, command: second };
    return { command: first, state: second };
  }

  function isNormalizedState(value) {
    return isObject(value)
      && value.stateType === STATE_TYPE
      && typeof value.normalizationStatus === 'string'
      && Array.isArray(value.errors)
      && Array.isArray(value.warnings);
  }

  function scoreBreakdown(first = {}, second = {}, third = {}) {
    const resolved = resolveCommandAndState(first, second);
    const state = isNormalizedState(resolved.state)
      ? resolved.state
      : normalizeTurnState(resolved.state);
    const command = resolved.command?.gains && resolved.command?.validationErrors
      ? resolved.command
      : normalizeCommand(resolved.command, 0, [], []);
    const profile = normalizeTargetProfile(third?.targetProfile || third?.profile || third || DEFAULT_TARGET_PROFILE);
    const axisRows = STAT_AXES.map(axis => {
      const current = number(state.stats?.[axis], null);
      const gain = number(command.gains?.[axis], 0);
      const targetEntry = profile.axes[axis];
      const beforeUtility = current === null ? null : statUtility(current, targetEntry, profile.diminishingReturns);
      const afterUtility = current === null ? null : statUtility(current + gain, targetEntry, profile.diminishingReturns);
      return {
        axis,
        label: targetEntry.label,
        current,
        gain,
        next: current === null ? null : current + gain,
        target: targetEntry.target,
        targetGapBefore: current === null || targetEntry.target === null ? null : Math.max(0, targetEntry.target - current),
        targetGapAfter: current === null || targetEntry.target === null ? null : Math.max(0, targetEntry.target - (current + gain)),
        utility: beforeUtility === null || afterUtility === null ? null : round(afterUtility - beforeUtility),
        evidenceStatus: targetEntry.evidenceStatus
      };
    });
    const statUtilityTotal = axisRows.reduce((sum, row) => sum + (Number.isFinite(row.utility) ? row.utility : 0), 0);
    const weights = profile.utilityWeights;
    const components = {
      stats: round(statUtilityTotal),
      vital: round(number(command.vitalDelta, 0) * weights.vital),
      motivation: round(number(command.motivationDelta, 0) * weights.motivation),
      bond: round(number(command.bondGain, 0) * weights.bond),
      hint: round(number(command.hintCount, 0) * weights.hint),
      facility: round(number(command.facilityGain, 0) * weights.facility),
      failurePenalty: command.failureRate === null ? null : round(-(command.failureRate / 100) * weights.failure),
      goalRace: command.isGoalRace ? round(weights.goalRace) : 0
    };
    const finiteComponents = Object.values(components).filter(value => Number.isFinite(value));
    const score = finiteComponents.length === Object.keys(components).length - (components.failurePenalty === null ? 1 : 0)
      ? round(finiteComponents.reduce((sum, value) => sum + value, 0))
      : null;
    const unconfiguredAxes = axisRows.filter(row => profile.axes[row.axis].target === null).map(row => row.axis);
    return {
      formula: 'score = Σ named-axis marginal utility + vitalDelta×vitalWeight + motivationDelta×motivationWeight + bondGain×bondWeight + hintCount×hintWeight + facilityGain×facilityWeight − failureRate/100×failureWeight + goalRace×goalRaceWeight',
      score,
      components,
      statUtility: components.stats,
      vitalValue: components.vital,
      motivationValue: components.motivation,
      bondValue: components.bond,
      hintValue: components.hint,
      facilityValue: components.facility,
      failurePenalty: components.failurePenalty,
      goalRaceValue: components.goalRace,
      axes: axisRows,
      unconfiguredAxes,
      evidenceStatus: profile.sourceStatus,
      probabilityStatus: PROBABILITY_STATUS,
      probabilityClaimStatus: PROBABILITY_CLAIM_STATUS,
      engineStatus: ENGINE_STATUS
    };
  }

  function evaluateCommand(first = {}, second = {}, third = {}) {
    const resolved = resolveCommandAndState(first, second);
    const state = isNormalizedState(resolved.state)
      ? resolved.state
      : normalizeTurnState(resolved.state);
    const command = resolved.command?.gains && resolved.command?.validationErrors
      ? resolved.command
      : normalizeCommand(resolved.command, 0, [], []);
    const breakdown = scoreBreakdown(command, state, third);
    const stateValid = state.normalizationStatus === 'READY';
    const commandValid = Array.isArray(command.validationErrors) && command.validationErrors.length === 0;
    const status = !stateValid || !commandValid
      ? 'UNVERIFIED'
      : !command.available
        ? 'UNAVAILABLE'
        : breakdown.unconfiguredAxes.length === STAT_AXES.length
          ? 'READY_WITH_UNCONFIGURED_PROFILE'
          : 'READY';
    const reasons = [
      ...(!stateValid ? state.errors.map(error => error.message) : []),
      ...(!commandValid ? command.validationErrors.map(error => error.message) : []),
      ...(!command.available ? ['行動目前標記為不可用。'] : [])
    ];
    return {
      schemaVersion: SCHEMA_VERSION,
      id: command.id,
      type: command.type,
      label: command.label,
      available: command.available,
      failureRate: command.failureRate,
      evidenceStatus: command.evidenceStatus,
      status,
      score: status === 'READY' || status === 'READY_WITH_UNCONFIGURED_PROFILE' ? breakdown.score : null,
      scoreBreakdown: breakdown,
      explanation: {
        keep: command.gains,
        tradeoff: {
          vitalDelta: command.vitalDelta,
          motivationDelta: command.motivationDelta,
          failureRate: command.failureRate,
          unavailable: !command.available
        },
        sensitiveAssumptions: [
          '面板 gains 使用 named axes；不接受陣列位置對應。',
          'failureRate 只作輸入欄位的相對風險扣分，不是成功率或勝率。',
          ...breakdown.unconfiguredAxes.map(axis => `${axis} target 未設定，該軸邊際值不納入。`)
        ]
      },
      reasons,
      sourceIndex: command.sourceIndex,
      probabilityStatus: PROBABILITY_STATUS,
      probabilityClaimStatus: PROBABILITY_CLAIM_STATUS,
      engineStatus: ENGINE_STATUS
    };
  }

  function attachResultMetadata(array, metadata) {
    Object.defineProperties(array, {
      rows: { value: array, enumerable: false },
      result: { value: metadata, enumerable: false },
      status: { value: metadata.status, enumerable: false },
      stateStatus: { value: metadata.stateStatus, enumerable: false },
      probabilityStatus: { value: PROBABILITY_STATUS, enumerable: false },
      probabilityClaimStatus: { value: PROBABILITY_CLAIM_STATUS, enumerable: false },
      engineStatus: { value: ENGINE_STATUS, enumerable: false }
    });
    return array;
  }

  function rankCommands(input = {}, options = {}) {
    const state = isNormalizedState(input) ? input : normalizeTurnState(input);
    const profile = normalizeTargetProfile(options.targetProfile || options.profile || DEFAULT_TARGET_PROFILE);
    const rawRows = state.commands.map(command => evaluateCommand(command, state, { targetProfile: profile }));
    const sorted = rawRows.slice().sort((left, right) => {
      const leftAvailable = left.status !== 'UNAVAILABLE' && left.status !== 'UNVERIFIED';
      const rightAvailable = right.status !== 'UNAVAILABLE' && right.status !== 'UNVERIFIED';
      if (leftAvailable !== rightAvailable) return leftAvailable ? -1 : 1;
      const leftScore = Number.isFinite(left.score) ? left.score : -Infinity;
      const rightScore = Number.isFinite(right.score) ? right.score : -Infinity;
      return rightScore - leftScore || left.sourceIndex - right.sourceIndex;
    });
    const topScored = sorted.find(row => Number.isFinite(row.score));
    const tolerance = clamp(number(options.nearTieToleranceRatio, profile.riskProfile.nearTieToleranceRatio), 0, 1);
    sorted.forEach((row, index) => {
      row.rank = index + 1;
      row.eligibleRank = Number.isFinite(row.score)
        ? sorted.filter(candidate => Number.isFinite(candidate.score) && candidate.score > row.score).length + 1
        : null;
      const gap = topScored && Number.isFinite(row.score) ? Math.max(0, topScored.score - row.score) : null;
      const gapRatio = gap === null ? null : gap / Math.max(1, Math.abs(topScored.score), Math.abs(row.score));
      row.nearTie = Boolean(gapRatio !== null && gapRatio > 0 && gapRatio <= tolerance);
      row.nearTieReference = Boolean(topScored && row.id === topScored.id);
      row.nearTieStatus = row.nearTieReference
        ? 'REFERENCE'
        : row.nearTie
          ? 'WITHIN_TRADEOFF_BUDGET'
          : gapRatio === null
            ? 'SCORE_UNVERIFIED'
            : 'OUTSIDE_TRADEOFF_BUDGET';
      row.nearTieGap = gap;
      row.nearTieGapRatio = gapRatio;
      row.nearTieToleranceRatio = tolerance;
    });
    const status = state.normalizationStatus !== 'READY'
      ? 'UNVERIFIED'
      : sorted.length
        ? (sorted.some(row => row.status === 'READY' || row.status === 'READY_WITH_UNCONFIGURED_PROFILE') ? 'READY' : 'UNVERIFIED')
        : 'NO_COMMANDS';
    return attachResultMetadata(sorted, {
      schemaVersion: SCHEMA_VERSION,
      status,
      stateStatus: state.normalizationStatus,
      rows: sorted,
      targetProfile: profile,
      probabilityStatus: PROBABILITY_STATUS,
      probabilityClaimStatus: PROBABILITY_CLAIM_STATUS,
      engineStatus: ENGINE_STATUS
    });
  }

  function explainCommand(first = {}, second = {}, third = {}) {
    return evaluateCommand(first, second, third);
  }

  function acceptNormalizedSnapshot(input) {
    const hasInputContract = isObject(input)
      && Number(input.schemaVersion) === SCHEMA_VERSION
      && input.stateType === STATE_TYPE;
    if (!hasInputContract) {
      return {
        accepted: false,
        reason: 'ADAPTER_REQUIRES_NORMALIZED_TURN_STATE_V1',
        snapshot: null
      };
    }
    const snapshot = normalizeTurnState(input);
    return {
      accepted: snapshot.normalizationStatus === 'READY',
      reason: snapshot.normalizationStatus === 'READY' ? null : 'NORMALIZATION_FAILED',
      snapshot
    };
  }

  return {
    SCHEMA_VERSION,
    STATE_TYPE,
    STAT_AXES,
    AXIS_ALIASES,
    ENGINE_STATUS,
    PROBABILITY_STATUS,
    PROBABILITY_CLAIM_STATUS,
    DEFAULT_RISK_PROFILE,
    normalizeTurnState,
    normalizeTargetProfile,
    effectiveGain,
    statUtility,
    scoreBreakdown,
    evaluateCommand,
    explainCommand,
    explain: explainCommand,
    rankCommands,
    acceptNormalizedSnapshot
  };
});
