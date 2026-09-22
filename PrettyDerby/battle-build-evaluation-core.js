(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BATTLE_BUILD_EVALUATION_CORE = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SCHEMA_VERSION = 'prettyderby-battle-build-evaluation.v2';
  const TARGET_FIELDS = Object.freeze([
    'server',
    'eventMode',
    'courseId',
    'surface',
    'distanceType',
    'distanceM',
    'runningStyle',
    'objective'
  ]);
  const SOURCE_TYPES = Object.freeze([
    'body_unique',
    'body_evolved',
    'body_awakened',
    'body_innate',
    'support',
    'white_factor',
    'inherited_unique',
    'scenario',
    'aptitude_repair',
    'other'
  ]);
  const COUNTED_SOURCE_STATUSES = new Set(['CONFIRMED', 'PLANNED']);
  const KNOWN_CONTRIBUTION_STATUSES = new Set(['CONFIRMED', 'PLANNED']);
  const COUNTED_CONDITION_STATES = new Set(['CONFIRMED_FOR_TARGET', 'OBJECTIVE_ALIGNED']);
  const KNOWN_CONDITION_STATES = new Set([
    'CONFIRMED_FOR_TARGET',
    'OBJECTIVE_ALIGNED',
    'CONDITIONAL',
    'NOT_APPLICABLE'
  ]);
  const KNOWN_SELECTION_STATES = new Set(['SELECTED_EFFECTIVE', 'AVAILABLE_UNUSED', 'STRUCTURAL']);
  const VALUE_SCOPES = new Set([
    'DEMAND_COVERAGE_ONLY',
    'NON_DEMAND_ADDITIVE',
    'DECOMPOSED_MIXED',
    'STRUCTURAL'
  ]);
  const FORBIDDEN_KEY = /(?:probability|winrate|activationrate|successrate|chance)/i;

  const EVALUATION_LAYERS = Object.freeze([
    Object.freeze({
      id: 'target_gate',
      order: 0,
      label: '目標與可行性硬門檻',
      rule: '八欄目標、繁中服可用性、持有、覺醒／進化、適性修復與六卡合法性先通過。'
    }),
    Object.freeze({
      id: 'course_demand',
      order: 1,
      label: '賽道需求槽',
      rule: '每一槽綁定功能、米數窗口、跑法、條件 family、stacking family、最低量與停止加分量。'
    }),
    Object.freeze({
      id: 'source_normalization',
      order: 2,
      label: '建構來源正規化',
      rule: '本體、六卡、白因子、繼承固有與劇本來源都轉成同 effect family、acquisition family、窗口與單位的供給。'
    }),
    Object.freeze({
      id: 'baseline_coverage',
      order: 3,
      label: '非本體基準覆蓋',
      rule: '先只算卡＋因子＋繼承；同 family 只保留最高有效版本。'
    }),
    Object.freeze({
      id: 'residual_demand',
      order: 4,
      label: '剩餘需求',
      rule: '剩餘量＝足量停止線－非本體覆蓋；不同時間或條件的槽不得互相扣除。'
    }),
    Object.freeze({
      id: 'body_marginal',
      order: 5,
      label: '本體邊際',
      rule: '本體只計加入基準後真正補上的量；基準已達停止加分量時，本體同類效果為 0 分。'
    }),
    Object.freeze({
      id: 'performance_gate',
      order: 6,
      label: '成品五維、耐力與回復門檻',
      rule: '速度、耐力安全線、力量、根性、賢能與回復方案各自過門檻；足耐不由技能分補票。'
    }),
    Object.freeze({
      id: 'team_script',
      order: 7,
      label: '隊伍腳本與角色分工',
      rule: 'CM 的勝負馬、牽引馬與隊友互動要明示；隊伍需求未知時不能把單馬包當完整結論。'
    }),
    Object.freeze({
      id: 'whole_build_value',
      order: 8,
      label: '全技能有效總量',
      rule: '加速度先在各槽截到足量停止線；其餘技能只有在賽道共同單位已證明可相加時才加總；任何有效技能未建模時停止排行。'
    }),
    Object.freeze({
      id: 'opportunity_cost',
      order: 9,
      label: '配卡與施工機會成本',
      rule: '比較保留重複金技卡與換卡兩條完整方案；金技路線、白技池、訓練、技能 Pt、舒適度及適性修復分開呈現。'
    }),
    Object.freeze({
      id: 'final_comparison',
      order: 10,
      label: '完整建構比較',
      rule: '只有完整候選集合中每匹可行戰馬都有至少一個 READY 建構時才有 finalRank；本體短名單不能冒充最終排行。'
    })
  ]);

  const COMPARISON_ORDER = Object.freeze([
    Object.freeze({ key: 'hardGate', direction: 'gate' }),
    Object.freeze({ key: 'comparisonSet', direction: 'all_eligible_candidates_ready_gate' }),
    Object.freeze({ key: 'performance.hardMinimumMetVector', direction: 'requirement_order_desc' }),
    Object.freeze({ key: 'performance.hardResidualVector', direction: 'requirement_order_asc' }),
    Object.freeze({ key: 'coverage.hardMinimumMetVector', direction: 'slot_order_desc' }),
    Object.freeze({ key: 'coverage.hardResidualToMinimumVector', direction: 'slot_order_asc' }),
    Object.freeze({ key: 'coverage.hardSufficientMetVector', direction: 'slot_order_desc' }),
    Object.freeze({ key: 'coverage.hardResidualToSufficiencyVector', direction: 'slot_order_asc' }),
    Object.freeze({ key: 'coverage.softSufficientMetVector', direction: 'slot_order_desc' }),
    Object.freeze({ key: 'coverage.softResidualToSufficiencyVector', direction: 'slot_order_asc' }),
    Object.freeze({ key: 'teamFit.hardRequirementsMet', direction: 'gate' }),
    Object.freeze({ key: 'teamFit.roleCoverage', direction: 'desc' }),
    Object.freeze({ key: 'teamFit.conflictCost', direction: 'asc' }),
    Object.freeze({ key: 'wholeBuild.effectiveCourseValue', direction: 'desc' }),
    Object.freeze({ key: 'opportunity.trainingOutput', direction: 'desc' }),
    Object.freeze({ key: 'opportunity.skillPtEconomy', direction: 'desc' }),
    Object.freeze({ key: 'opportunity.deckComfort', direction: 'desc' }),
    Object.freeze({ key: 'opportunity.aptitudeRepairCost', direction: 'asc' }),
    Object.freeze({ key: 'conditionBurden', direction: 'asc' }),
    Object.freeze({ key: 'candidateId', direction: 'asc', role: 'deterministic_tiebreak' })
  ]);

  const STATUS_ORDER = Object.freeze({
    BLOCKED: 0,
    NEEDS_BUILD_CONTEXT: 1,
    NEEDS_EVIDENCE: 2,
    INCOMPLETE_BUILD: 3,
    READY: 4
  });

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function hasOwn(value, key) {
    return Object.prototype.hasOwnProperty.call(value || {}, key);
  }

  function text(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  function finite(value) {
    if (typeof value === 'boolean' || value == null) return null;
    if (typeof value === 'string' && !value.trim()) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function nonNegative(value) {
    const parsed = finite(value);
    return parsed != null && parsed >= 0 ? parsed : null;
  }

  function integer(value) {
    const parsed = finite(value);
    return parsed != null && Number.isInteger(parsed) ? parsed : null;
  }

  function clone(value) {
    if (Array.isArray(value)) return value.map(clone);
    if (!isObject(value)) return value;
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, clone(child)]));
  }

  function unique(values) {
    return [...new Set((values || []).filter(value => value !== null && value !== undefined))];
  }

  function integerList(value) {
    if (!Array.isArray(value)) return null;
    const rows = value.map(integer);
    return rows.some(row => row == null) ? null : unique(rows);
  }

  function textList(value) {
    if (!Array.isArray(value)) return null;
    const rows = value.map(text);
    return rows.some(row => row == null) ? null : rows;
  }

  function forbiddenPaths(value, path = '$', output = []) {
    if (Array.isArray(value)) {
      value.forEach((item, index) => forbiddenPaths(item, `${path}[${index}]`, output));
      return output;
    }
    if (!isObject(value)) return output;
    for (const [key, child] of Object.entries(value)) {
      const next = `${path}.${key}`;
      if (FORBIDDEN_KEY.test(key)) output.push(next);
      forbiddenPaths(child, next, output);
    }
    return output;
  }

  function token(value) {
    return typeof value === 'string'
      ? value.trim().toLowerCase().replace(/[\s_-]+/g, '')
      : value;
  }

  function normalizeServer(value) {
    return ({ zhtw: 'zh_tw', tw: 'zh_tw', '繁中': 'zh_tw', jp: 'jp', '日服': 'jp' })[token(value)] || null;
  }

  function normalizeEventMode(value) {
    return ({ cm: 'cm', championsmeeting: 'cm', loh: 'loh', leagueofheroes: 'loh' })[token(value)] || null;
  }

  function normalizeSurface(value) {
    return ({ turf: 'turf', grass: 'turf', '草地': 'turf', dirt: 'dirt', sand: 'dirt', '泥地': 'dirt' })[token(value)] || null;
  }

  function normalizeDistanceType(value) {
    const numeric = integer(value);
    if (numeric != null) return ({ 1: 'short', 2: 'mile', 3: 'medium', 4: 'long' })[numeric] || null;
    return ({ short: 'short', mile: 'mile', medium: 'medium', middle: 'medium', long: 'long', '中距離': 'medium' })[token(value)] || null;
  }

  function normalizeStyle(value) {
    const numeric = integer(value);
    if (numeric != null) return ({ 1: 'runner', 2: 'leader', 3: 'betweener', 4: 'chaser' })[numeric] || null;
    return ({ runner: 'runner', escape: 'runner', '領頭': 'runner', leader: 'leader', betweener: 'betweener', chaser: 'chaser' })[token(value)] || null;
  }

  function normalizeObjective(value) {
    return ({
      cmwinnerline: 'cm_winner_line',
      cm: 'cm_winner_line',
      lohtop3: 'loh_top3',
      lohscoreline: 'loh_score_line'
    })[token(value)] || null;
  }

  function normalizeTarget(raw = {}) {
    const source = isObject(raw) ? raw : {};
    const target = {
      server: normalizeServer(source.server),
      eventMode: normalizeEventMode(source.eventMode),
      courseId: integer(source.courseId),
      surface: normalizeSurface(source.surface),
      distanceType: normalizeDistanceType(source.distanceType),
      distanceM: integer(source.distanceM),
      runningStyle: normalizeStyle(source.runningStyle),
      objective: normalizeObjective(source.objective)
    };
    const errors = TARGET_FIELDS
      .filter(field => target[field] == null)
      .map(field => ({ code: 'TARGET_FIELD_INVALID', field }));
    if (target.eventMode === 'cm' && target.objective !== 'cm_winner_line') {
      errors.push({ code: 'CM_OBJECTIVE_MISMATCH', field: 'objective' });
    }
    if (target.eventMode === 'loh' && !['loh_top3', 'loh_score_line'].includes(target.objective)) {
      errors.push({ code: 'LOH_OBJECTIVE_MISMATCH', field: 'objective' });
    }
    const targetKey = errors.length
      ? null
      : TARGET_FIELDS.map(field => `${field}=${target[field]}`).join('|');
    return { status: errors.length ? 'BLOCKED' : 'READY', target, targetKey, errors };
  }

  function normalizeDemandSlots(rawSlots, target) {
    if (!Array.isArray(rawSlots) || !rawSlots.length) {
      return { status: 'NEEDS_EVIDENCE', slots: [], errors: [{ code: 'DEMAND_SLOTS_MISSING' }] };
    }
    const seen = new Set();
    const errors = [];
    const slots = rawSlots.map((raw, index) => {
      const source = isObject(raw) ? raw : {};
      const id = text(source.id);
      const start = nonNegative(source.meterWindow?.start);
      const end = nonNegative(source.meterWindow?.end);
      const minimum = nonNegative(source.minimum);
      const targetValue = nonNegative(source.target);
      const scoringCeiling = nonNegative(source.scoringCeiling);
      const physicalCap = nonNegative(source.physicalCap ?? source.scoringCeiling);
      const sufficientThreshold = nonNegative(source.sufficientThreshold) ?? targetValue ?? minimum;
      const slot = {
        id,
        functionType: text(source.functionType),
        meterWindow: { start, end },
        runningStyle: normalizeStyle(source.runningStyle ?? target?.runningStyle),
        conditionFamily: text(source.conditionFamily),
        stackingFamily: text(source.stackingFamily),
        requirementLevel: text(source.requirementLevel)?.toUpperCase(),
        priority: integer(source.priority),
        unit: text(source.unit),
        minimum,
        target: targetValue,
        sufficientThreshold,
        scoringCeiling,
        physicalCap,
        includeInCourseTotal: source.includeInCourseTotal !== false,
        evidenceStatus: text(source.evidenceStatus)?.toUpperCase() || 'UNKNOWN',
        evidenceSource: text(source.evidenceSource)
      };
      const missing = [
        ['id', id],
        ['functionType', slot.functionType],
        ['meterWindow.start', start],
        ['meterWindow.end', end],
        ['runningStyle', slot.runningStyle],
        ['conditionFamily', slot.conditionFamily],
        ['stackingFamily', slot.stackingFamily],
        ['requirementLevel', slot.requirementLevel],
        ['priority', slot.priority],
        ['unit', slot.unit],
        ['minimum', minimum],
        ['sufficientThreshold', sufficientThreshold],
        ['scoringCeiling', scoringCeiling],
        ['physicalCap', physicalCap],
        ['evidenceSource', slot.evidenceSource]
      ].filter(([, value]) => value == null);
      for (const [field] of missing) errors.push({ code: 'DEMAND_FIELD_MISSING', index, field });
      if (id && seen.has(id)) errors.push({ code: 'DEMAND_SLOT_DUPLICATE', index, id });
      if (id) seen.add(id);
      if (start != null && end != null && (!(end > start) || end > target.distanceM)) {
        errors.push({ code: 'DEMAND_WINDOW_INVALID', index, id });
      }
      if (minimum != null && targetValue != null && minimum > targetValue) {
        errors.push({ code: 'DEMAND_ORDER_INVALID', index, id, fields: ['minimum', 'target'] });
      }
      if (minimum != null && sufficientThreshold != null && minimum > sufficientThreshold) {
        errors.push({ code: 'DEMAND_ORDER_INVALID', index, id, fields: ['minimum', 'sufficientThreshold'] });
      }
      if (targetValue != null && sufficientThreshold != null && targetValue > sufficientThreshold) {
        errors.push({ code: 'DEMAND_ORDER_INVALID', index, id, fields: ['target', 'sufficientThreshold'] });
      }
      if (sufficientThreshold != null && scoringCeiling != null && sufficientThreshold > scoringCeiling) {
        errors.push({ code: 'DEMAND_ORDER_INVALID', index, id, fields: ['sufficientThreshold', 'scoringCeiling'] });
      }
      if (targetValue != null && scoringCeiling != null && targetValue > scoringCeiling) {
        errors.push({ code: 'DEMAND_ORDER_INVALID', index, id, fields: ['target', 'scoringCeiling'] });
      }
      if (scoringCeiling != null && physicalCap != null && scoringCeiling > physicalCap) {
        errors.push({ code: 'DEMAND_ORDER_INVALID', index, id, fields: ['scoringCeiling', 'physicalCap'] });
      }
      if (!['HARD', 'SOFT'].includes(slot.requirementLevel)) {
        errors.push({ code: 'DEMAND_REQUIREMENT_LEVEL_INVALID', index, id });
      }
      if (!['CONFIRMED', 'USER_CALIBRATED'].includes(slot.evidenceStatus)) {
        const code = slot.evidenceStatus === 'POLICY_CANDIDATE'
          ? 'DEMAND_POLICY_NOT_CALIBRATED'
          : 'DEMAND_EVIDENCE_UNKNOWN';
        errors.push({ code, index, id });
      }
      return slot;
    });
    slots.sort((left, right) => left.priority - right.priority || String(left.id).localeCompare(String(right.id)));
    return { status: errors.length ? 'NEEDS_EVIDENCE' : 'READY', slots, errors };
  }

  function normalizeDemandProfileContract(raw, slots) {
    const source = isObject(raw) ? raw : {};
    const declaredStatus = text(source.status)?.toUpperCase() || 'UNKNOWN';
    const expectedSlotIds = textList(source.expectedSlotIds);
    const evidenceSource = text(source.evidenceSource);
    const actualSlotIds = (Array.isArray(slots) ? slots : [])
      .map(slot => slot.id)
      .filter(Boolean);
    const declaredIds = expectedSlotIds ? expectedSlotIds.slice().sort() : [];
    const actualIds = actualSlotIds.slice().sort();
    const errors = [];
    if (declaredStatus !== 'CONFIRMED_COMPLETE') {
      errors.push({
        code: declaredStatus === 'POLICY_CANDIDATE'
          ? 'DEMAND_PROFILE_POLICY_NOT_CALIBRATED'
          : 'DEMAND_PROFILE_NOT_CONFIRMED_COMPLETE'
      });
    }
    if (!expectedSlotIds || !expectedSlotIds.length) {
      errors.push({ code: 'DEMAND_PROFILE_EXPECTED_SLOT_IDS_MISSING' });
    }
    if (Array.isArray(source.expectedSlotIds) && expectedSlotIds
      && source.expectedSlotIds.length !== expectedSlotIds.length) {
      errors.push({ code: 'DEMAND_PROFILE_SLOT_IDS_DUPLICATE_OR_INVALID' });
    }
    if (JSON.stringify(declaredIds) !== JSON.stringify(actualIds)) {
      errors.push({ code: 'DEMAND_PROFILE_SLOT_IDS_MISMATCH', declaredIds, actualIds });
    }
    if (!evidenceSource) errors.push({ code: 'DEMAND_PROFILE_EVIDENCE_MISSING' });
    return {
      status: errors.length ? 'NEEDS_EVIDENCE' : 'READY',
      declaredStatus,
      expectedSlotIds: expectedSlotIds || [],
      actualSlotIds,
      evidenceSource,
      errors
    };
  }

  function normalizePerformanceRequirements(rawRequirements) {
    if (!Array.isArray(rawRequirements) || !rawRequirements.length) {
      return { status: 'NEEDS_EVIDENCE', requirements: [], errors: [{ code: 'PERFORMANCE_REQUIREMENTS_MISSING' }] };
    }
    const errors = [];
    const seen = new Set();
    const requirements = rawRequirements.map((raw, index) => {
      const source = isObject(raw) ? raw : {};
      const row = {
        id: text(source.id),
        label: text(source.label),
        unit: text(source.unit),
        minimum: nonNegative(source.minimum),
        target: nonNegative(source.target),
        requirementLevel: text(source.requirementLevel)?.toUpperCase(),
        priority: integer(source.priority),
        evidenceStatus: text(source.evidenceStatus)?.toUpperCase() || 'UNKNOWN',
        evidenceSource: text(source.evidenceSource)
      };
      for (const [field, value] of Object.entries({
        id: row.id,
        label: row.label,
        unit: row.unit,
        minimum: row.minimum,
        target: row.target,
        requirementLevel: row.requirementLevel,
        priority: row.priority,
        evidenceSource: row.evidenceSource
      })) {
        if (value == null) errors.push({ code: 'PERFORMANCE_REQUIREMENT_FIELD_MISSING', index, field });
      }
      if (row.id && seen.has(row.id)) errors.push({ code: 'PERFORMANCE_REQUIREMENT_DUPLICATE', index, id: row.id });
      if (row.id) seen.add(row.id);
      if (row.minimum != null && row.target != null && row.minimum > row.target) {
        errors.push({ code: 'PERFORMANCE_REQUIREMENT_ORDER_INVALID', index, id: row.id });
      }
      if (!['HARD', 'SOFT'].includes(row.requirementLevel)) {
        errors.push({ code: 'PERFORMANCE_REQUIREMENT_LEVEL_INVALID', index, id: row.id });
      }
      if (!['CONFIRMED', 'USER_CALIBRATED'].includes(row.evidenceStatus)) {
        errors.push({ code: 'PERFORMANCE_REQUIREMENT_EVIDENCE_UNKNOWN', index, id: row.id });
      }
      return row;
    });
    requirements.sort((left, right) => left.priority - right.priority || String(left.id).localeCompare(String(right.id)));
    return { status: errors.length ? 'NEEDS_EVIDENCE' : 'READY', requirements, errors };
  }

  function normalizePerformanceMetrics(rawMetrics, requirements) {
    if (!Array.isArray(rawMetrics)) {
      return { status: 'NEEDS_EVIDENCE', rows: [], errors: [{ code: 'PERFORMANCE_METRICS_MISSING' }] };
    }
    const byId = new Map(rawMetrics.map(row => [text(row?.requirementId), row]));
    const errors = [];
    const rows = requirements.map((requirement, index) => {
      const source = isObject(byId.get(requirement.id)) ? byId.get(requirement.id) : {};
      const value = nonNegative(source.value);
      const unit = text(source.unit);
      const status = text(source.status)?.toUpperCase() || 'UNKNOWN';
      const evidenceSource = text(source.evidenceSource);
      if (value == null) errors.push({ code: 'PERFORMANCE_METRIC_VALUE_MISSING', index, requirementId: requirement.id });
      if (unit !== requirement.unit) errors.push({ code: 'PERFORMANCE_METRIC_UNIT_MISMATCH', index, requirementId: requirement.id });
      if (!['CONFIRMED', 'PLANNED'].includes(status)) {
        errors.push({ code: 'PERFORMANCE_METRIC_STATUS_UNKNOWN', index, requirementId: requirement.id });
      }
      if (!evidenceSource) errors.push({ code: 'PERFORMANCE_METRIC_EVIDENCE_MISSING', index, requirementId: requirement.id });
      return {
        requirementId: requirement.id,
        label: requirement.label,
        requirementLevel: requirement.requirementLevel,
        priority: requirement.priority,
        unit: requirement.unit,
        value,
        minimum: requirement.minimum,
        target: requirement.target,
        minimumMet: value != null && value >= requirement.minimum,
        targetMet: value != null && value >= requirement.target,
        residualToMinimum: value == null ? null : Math.max(0, requirement.minimum - value),
        residualToTarget: value == null ? null : Math.max(0, requirement.target - value),
        status,
        evidenceSource
      };
    });
    const hardRows = rows.filter(row => row.requirementLevel === 'HARD');
    return {
      status: errors.length ? 'NEEDS_EVIDENCE' : 'READY',
      rows,
      hardMinimumMetVector: hardRows.map(row => row.minimumMet ? 1 : 0),
      hardResidualVector: hardRows.map(row => row.residualToMinimum),
      targetMetVector: rows.map(row => row.targetMet ? 1 : 0),
      allHardMinimumMet: hardRows.every(row => row.minimumMet),
      errors
    };
  }

  function normalizeTeamContext(raw) {
    const source = isObject(raw) ? raw : {};
    const status = text(source.status)?.toUpperCase() || 'UNKNOWN';
    const strategyId = text(source.strategyId);
    const teammateOutfitIds = integerList(source.teammateOutfitIds);
    const evidenceSource = text(source.evidenceSource);
    const errors = [];
    if (status !== 'CONFIRMED') errors.push({ code: 'TEAM_CONTEXT_NOT_CONFIRMED' });
    if (!strategyId) errors.push({ code: 'TEAM_STRATEGY_ID_MISSING' });
    if (!teammateOutfitIds) errors.push({ code: 'TEAMMATE_IDS_INVALID' });
    if (!evidenceSource) errors.push({ code: 'TEAM_CONTEXT_EVIDENCE_MISSING' });
    return { status: errors.length ? 'NEEDS_EVIDENCE' : 'READY', strategyId, teammateOutfitIds: teammateOutfitIds || [], evidenceSource, errors };
  }

  function normalizeTeamFit(raw, teamContext) {
    const source = isObject(raw) ? raw : {};
    const status = text(source.status)?.toUpperCase() || 'UNKNOWN';
    const hardRequirementsMet = typeof source.hardRequirementsMet === 'boolean' ? source.hardRequirementsMet : null;
    const roleCoverage = nonNegative(source.roleCoverage);
    const conflictCost = nonNegative(source.conflictCost);
    const role = text(source.role);
    const strategyId = text(source.strategyId);
    const evidenceSource = text(source.evidenceSource);
    const errors = [];
    if (status !== 'CONFIRMED') errors.push({ code: 'TEAM_FIT_NOT_CONFIRMED' });
    if (hardRequirementsMet == null) errors.push({ code: 'TEAM_FIT_HARD_GATE_UNKNOWN' });
    if (roleCoverage == null) errors.push({ code: 'TEAM_FIT_ROLE_COVERAGE_UNKNOWN' });
    if (conflictCost == null) errors.push({ code: 'TEAM_FIT_CONFLICT_COST_UNKNOWN' });
    if (!role) errors.push({ code: 'TEAM_FIT_ROLE_MISSING' });
    if (!strategyId || strategyId !== teamContext?.strategyId) errors.push({ code: 'TEAM_FIT_STRATEGY_MISMATCH' });
    if (!evidenceSource) errors.push({ code: 'TEAM_FIT_EVIDENCE_MISSING' });
    return { status: errors.length ? 'NEEDS_EVIDENCE' : 'READY', hardRequirementsMet, roleCoverage, conflictCost, role, strategyId, evidenceSource, errors };
  }

  function meterWindowCoverage(sourceWindow, demandWindow) {
    const sourceStart = sourceWindow?.start;
    const sourceEnd = sourceWindow?.end;
    const demandStart = demandWindow?.start;
    const demandEnd = demandWindow?.end;
    if ([sourceStart, sourceEnd, demandStart, demandEnd].some(value => value == null)) return 'UNKNOWN';
    if (!(sourceEnd > sourceStart) || !(demandEnd > demandStart)) return 'INVALID';
    if (sourceStart <= demandStart && sourceEnd >= demandEnd) return 'FULL';
    if (sourceStart < demandEnd && sourceEnd > demandStart) return 'PARTIAL';
    return 'NONE';
  }

  function normalizeContribution(raw, sourceIndex, contributionIndex, slotById) {
    const source = isObject(raw) ? raw : {};
    const slotId = text(source.slotId);
    const magnitude = nonNegative(source.magnitude);
    const unit = text(source.unit);
    const status = text(source.status)?.toUpperCase() || 'UNKNOWN';
    const meterStart = nonNegative(source.meterWindow?.start);
    const meterEnd = nonNegative(source.meterWindow?.end);
    const conditionFamily = text(source.conditionFamily);
    const stackingFamily = text(source.stackingFamily);
    const conditionState = text(source.conditionState)?.toUpperCase() || 'UNKNOWN';
    const slot = slotById.get(slotId);
    const windowCoverage = slot
      ? meterWindowCoverage({ start: meterStart, end: meterEnd }, slot.meterWindow)
      : 'UNKNOWN';
    const errors = [];
    if (!slotId || !slotById.has(slotId)) errors.push({ code: 'CONTRIBUTION_SLOT_UNKNOWN', sourceIndex, contributionIndex, slotId });
    if (magnitude == null) errors.push({ code: 'CONTRIBUTION_MAGNITUDE_UNKNOWN', sourceIndex, contributionIndex, slotId });
    if (!unit) errors.push({ code: 'CONTRIBUTION_UNIT_UNKNOWN', sourceIndex, contributionIndex, slotId });
    if (!text(source.evidenceSource)) {
      errors.push({ code: 'CONTRIBUTION_EVIDENCE_MISSING', sourceIndex, contributionIndex, slotId });
    }
    if (meterStart == null || meterEnd == null || !(meterEnd > meterStart)) {
      errors.push({ code: 'CONTRIBUTION_WINDOW_INVALID', sourceIndex, contributionIndex, slotId });
    }
    if (!conditionFamily) errors.push({ code: 'CONTRIBUTION_CONDITION_FAMILY_MISSING', sourceIndex, contributionIndex, slotId });
    if (!stackingFamily) errors.push({ code: 'CONTRIBUTION_STACKING_FAMILY_MISSING', sourceIndex, contributionIndex, slotId });
    if (!KNOWN_CONTRIBUTION_STATUSES.has(status)) {
      errors.push({ code: 'CONTRIBUTION_STATUS_UNKNOWN', sourceIndex, contributionIndex, slotId });
    }
    if (!KNOWN_CONDITION_STATES.has(conditionState)) {
      errors.push({ code: 'CONTRIBUTION_CONDITION_STATE_UNKNOWN', sourceIndex, contributionIndex, slotId });
    }
    if (slot && unit && unit !== slot.unit) {
      errors.push({ code: 'CONTRIBUTION_UNIT_MISMATCH', sourceIndex, contributionIndex, slotId });
    }
    if (slot && windowCoverage === 'NONE') {
      errors.push({ code: 'CONTRIBUTION_WINDOW_NO_OVERLAP', sourceIndex, contributionIndex, slotId });
    }
    if (slot && windowCoverage === 'PARTIAL') {
      errors.push({ code: 'CONTRIBUTION_WINDOW_PARTIAL_COVERAGE', sourceIndex, contributionIndex, slotId });
    }
    if (slot && conditionFamily && conditionFamily !== slot.conditionFamily) {
      errors.push({ code: 'CONTRIBUTION_CONDITION_FAMILY_MISMATCH', sourceIndex, contributionIndex, slotId });
    }
    if (slot && stackingFamily && stackingFamily !== slot.stackingFamily) {
      errors.push({ code: 'CONTRIBUTION_STACKING_FAMILY_MISMATCH', sourceIndex, contributionIndex, slotId });
    }
    return {
      contribution: {
        slotId,
        magnitude,
        unit,
        status,
        evidenceSource: text(source.evidenceSource),
        meterWindow: { start: meterStart, end: meterEnd },
        windowCoverage,
        conditionFamily,
        stackingFamily,
        conditionState
      },
      errors
    };
  }

  function normalizeSource(raw, index, slotById) {
    const source = isObject(raw) ? raw : {};
    const sourceType = text(source.sourceType)?.toLowerCase();
    const sourceId = text(String(source.sourceId ?? ''));
    const skillId = integer(source.skillId);
    const effectFamilyId = integer(source.effectFamilyId ?? source.familyId ?? source.skillFamilyId);
    const acquisitionFamilyId = integer(source.acquisitionFamilyId ?? source.familyId ?? source.skillFamilyId);
    const replacesAcquisitionFamilyIds = integerList(source.replacesAcquisitionFamilyIds ?? []) || [];
    const sourceStatus = text(source.sourceStatus)?.toUpperCase() || 'UNKNOWN';
    const selectionState = text(source.selectionState)?.toUpperCase() || 'SELECTED_EFFECTIVE';
    const valueScope = text(source.valueScope)?.toUpperCase()
      || (selectionState === 'STRUCTURAL' ? 'STRUCTURAL' : null);
    const errors = [];
    if (!SOURCE_TYPES.includes(sourceType)) errors.push({ code: 'SOURCE_TYPE_INVALID', index, sourceType });
    if (!sourceId) errors.push({ code: 'SOURCE_ID_MISSING', index });
    if (skillId == null) errors.push({ code: 'SOURCE_SKILL_ID_INVALID', index });
    if (effectFamilyId == null) errors.push({ code: 'SOURCE_EFFECT_FAMILY_ID_INVALID', index });
    if (acquisitionFamilyId == null) errors.push({ code: 'SOURCE_ACQUISITION_FAMILY_ID_INVALID', index });
    if (!COUNTED_SOURCE_STATUSES.has(sourceStatus)) errors.push({ code: 'SOURCE_STATUS_UNKNOWN', index, sourceId });
    if (!KNOWN_SELECTION_STATES.has(selectionState)) errors.push({ code: 'SOURCE_SELECTION_STATE_UNKNOWN', index, sourceId });
    if (!valueScope || !VALUE_SCOPES.has(valueScope)) errors.push({ code: 'SOURCE_VALUE_SCOPE_UNKNOWN', index, sourceId });
    const rawContributions = Array.isArray(source.contributions) ? source.contributions : [];
    if (selectionState === 'SELECTED_EFFECTIVE'
      && ['DEMAND_COVERAGE_ONLY', 'DECOMPOSED_MIXED'].includes(valueScope)
      && !rawContributions.length) {
      errors.push({ code: 'SOURCE_DEMAND_CONTRIBUTIONS_MISSING', index, sourceId });
    }
    const normalizedContributions = rawContributions.map((row, contributionIndex) =>
      normalizeContribution(row, index, contributionIndex, slotById));
    errors.push(...normalizedContributions.flatMap(row => row.errors));
    const courseValue = hasOwn(source, 'courseValue') ? nonNegative(source.courseValue) : null;
    const courseValueUnit = text(source.courseValueUnit);
    const requiresCourseValue = selectionState === 'SELECTED_EFFECTIVE'
      && ['NON_DEMAND_ADDITIVE', 'DECOMPOSED_MIXED'].includes(valueScope)
      && source.requiresCourseValue !== false;
    const courseValueStatus = text(source.courseValueStatus)?.toUpperCase()
      || (courseValue != null ? 'CONFIRMED' : 'NOT_MODELED');
    if (courseValue != null && !courseValueUnit) errors.push({ code: 'COURSE_VALUE_UNIT_MISSING', index, sourceId });
    if (requiresCourseValue && (courseValue == null || courseValueStatus !== 'CONFIRMED')) {
      errors.push({ code: 'COURSE_VALUE_NOT_MODELED', index, sourceId });
    }
    if (courseValueStatus === 'UNKNOWN') errors.push({ code: 'COURSE_VALUE_UNKNOWN', index, sourceId });
    const referenceValue = hasOwn(source, 'referenceValue') ? nonNegative(source.referenceValue) : null;
    const referenceValueUnit = text(source.referenceValueUnit);
    if (referenceValue != null && !referenceValueUnit) {
      errors.push({ code: 'REFERENCE_VALUE_UNIT_MISSING', index, sourceId });
    }
    const conditionBurden = hasOwn(source, 'conditionBurden') ? nonNegative(source.conditionBurden) : null;
    const skillPointCost = hasOwn(source, 'skillPointCost') ? nonNegative(source.skillPointCost) : null;
    if (selectionState === 'SELECTED_EFFECTIVE' && conditionBurden == null) {
      errors.push({ code: 'CONDITION_BURDEN_NOT_MODELED', index, sourceId });
    }
    if (selectionState === 'SELECTED_EFFECTIVE' && skillPointCost == null) {
      errors.push({ code: 'SKILL_POINT_COST_NOT_MODELED', index, sourceId });
    }
    return {
      source: {
        sourceType,
        sourceId,
        skillId,
        familyId: effectFamilyId,
        effectFamilyId,
        acquisitionFamilyId,
        replacesAcquisitionFamilyIds,
        sourceStatus,
        selectionState,
        valueScope,
        isGold: source.isGold === true,
        isBodyUnique: source.isBodyUnique === true || sourceType === 'body_unique',
        routeGroup: text(source.routeGroup),
        routeOption: text(source.routeOption),
        routeState: text(source.routeState)?.toUpperCase() || 'ACTIVE',
        cardId: integer(source.cardId),
        name: text(source.name),
        contributions: normalizedContributions.map(row => row.contribution),
        courseValue,
        courseValueUnit,
        courseValueStatus,
        requiresCourseValue,
        referenceValue,
        referenceValueUnit,
        conditionBurden,
        skillPointCost
      },
      errors
    };
  }

  function routeErrors(sources) {
    const byGroup = new Map();
    for (const source of sources) {
      if (!source.routeGroup || source.routeState !== 'ACTIVE') continue;
      if (!byGroup.has(source.routeGroup)) byGroup.set(source.routeGroup, []);
      byGroup.get(source.routeGroup).push(source);
    }
    return [...byGroup.entries()]
      .map(([routeGroup, rows]) => ({
        routeGroup,
        rows,
        options: unique(rows.map(row => row.routeOption || `source:${row.sourceId}`))
      }))
      .filter(row => row.options.length > 1)
      .map(({ routeGroup, rows, options }) => ({
        code: 'EXCLUSIVE_ROUTE_MULTIPLE_ACTIVE',
        routeGroup,
        routeOptions: options,
        sourceIds: rows.map(row => row.sourceId)
      }));
  }

  function normalizeSourceList(rawSources, slotById) {
    if (!Array.isArray(rawSources)) return { sources: [], errors: [{ code: 'SOURCE_LIST_MISSING' }] };
    const rows = rawSources.map((raw, index) => normalizeSource(raw, index, slotById));
    const sources = rows.map(row => row.source)
      .filter(source => source.routeState === 'ACTIVE');
    return { sources, errors: [...rows.flatMap(row => row.errors), ...routeErrors(sources)] };
  }

  function resolveAcquisitionOverlaps(sources) {
    const bodyUpgradeFamilies = new Map();
    for (const source of sources) {
      if (!source.sourceType.startsWith('body_')) continue;
      for (const familyId of source.replacesAcquisitionFamilyIds || []) {
        if (!bodyUpgradeFamilies.has(familyId)) bodyUpgradeFamilies.set(familyId, []);
        bodyUpgradeFamilies.get(familyId).push(source.sourceId);
      }
    }
    const suppressedSourceIds = new Set();
    const overlaps = [];
    for (const source of sources) {
      if (source.sourceType.startsWith('body_')) continue;
      const bodySourceIds = bodyUpgradeFamilies.get(source.acquisitionFamilyId) || [];
      if (!bodySourceIds.length) continue;
      suppressedSourceIds.add(source.sourceId);
      overlaps.push({
        kind: 'BODY_UPGRADE_REPLACES_ACQUISITION_FAMILY',
        acquisitionFamilyId: source.acquisitionFamilyId,
        suppressedSourceId: source.sourceId,
        bodySourceIds: [...bodySourceIds],
        cardId: source.cardId,
        isGold: source.isGold
      });
    }
    return {
      effectSources: sources.filter(source =>
        source.selectionState === 'SELECTED_EFFECTIVE'
        && !suppressedSourceIds.has(source.sourceId)),
      suppressedSourceIds: [...suppressedSourceIds],
      overlaps
    };
  }

  function contributionForSlot(source, slotId) {
    return (source.contributions || []).find(row => row.slotId === slotId) || null;
  }

  function coverageForSlot(slot, sources) {
    const unknownSources = [];
    const candidates = [];
    const conditionalCandidates = [];
    for (const source of sources) {
      const contribution = contributionForSlot(source, slot.id);
      if (!contribution) continue;
      if (contribution.conditionFamily !== slot.conditionFamily) {
        unknownSources.push(source.sourceId);
        continue;
      }
      if (contribution.windowCoverage !== 'FULL') {
        unknownSources.push(source.sourceId);
        continue;
      }
      if (!COUNTED_SOURCE_STATUSES.has(source.sourceStatus)
        || !KNOWN_CONTRIBUTION_STATUSES.has(contribution.status)
        || contribution.magnitude == null) {
        unknownSources.push(source.sourceId);
        continue;
      }
      if (COUNTED_CONDITION_STATES.has(contribution.conditionState)) {
        candidates.push({ source, contribution });
      } else if (contribution.conditionState === 'CONDITIONAL') {
        conditionalCandidates.push({ source, contribution });
      }
    }
    const byFamily = new Map();
    for (const row of candidates) {
      const key = String(row.source.effectFamilyId);
      if (!byFamily.has(key)) byFamily.set(key, []);
      byFamily.get(key).push(row);
    }
    const selected = [];
    const duplicates = [];
    for (const [familyId, rows] of byFamily) {
      rows.sort((left, right) =>
        right.contribution.magnitude - left.contribution.magnitude
        || String(left.source.sourceId).localeCompare(String(right.source.sourceId)));
      selected.push(rows[0]);
      if (rows.length > 1) {
        duplicates.push({
          familyId: Number(familyId),
          effectFamilyId: Number(familyId),
          keptSourceId: rows[0].source.sourceId,
          suppressedSourceIds: rows.slice(1).map(row => row.source.sourceId),
          goldDuplicate: rows.some(row => row.source.isGold)
        });
      }
    }
    const rawCovered = selected.reduce((sum, row) => sum + row.contribution.magnitude, 0);
    const possibleRowsByFamily = new Map();
    for (const row of [...candidates, ...conditionalCandidates]) {
      const key = String(row.source.effectFamilyId);
      if (!possibleRowsByFamily.has(key)) possibleRowsByFamily.set(key, []);
      possibleRowsByFamily.get(key).push(row);
    }
    const possibleSelected = [...possibleRowsByFamily.values()].map(rows => rows
      .slice()
      .sort((left, right) => right.contribution.magnitude - left.contribution.magnitude
        || String(left.source.sourceId).localeCompare(String(right.source.sourceId)))[0]);
    const possibleRawCovered = possibleSelected.reduce((sum, row) => sum + row.contribution.magnitude, 0);
    const physicalCovered = Math.min(slot.physicalCap, rawCovered);
    const scoredCovered = Math.min(slot.scoringCeiling, physicalCovered);
    const sufficientCovered = Math.min(slot.sufficientThreshold, physicalCovered);
    const possiblePhysicalCovered = Math.min(slot.physicalCap, possibleRawCovered);
    const possibleScoredCovered = Math.min(slot.scoringCeiling, possiblePhysicalCovered);
    const possibleSufficientCovered = Math.min(slot.sufficientThreshold, possiblePhysicalCovered);
    const conditionalAffectsDecision = possibleSufficientCovered > sufficientCovered;
    return {
      slotId: slot.id,
      requirementLevel: slot.requirementLevel,
      priority: slot.priority,
      unit: slot.unit,
      status: unknownSources.length
        ? 'UNKNOWN'
        : conditionalAffectsDecision ? 'CONDITIONAL' : 'KNOWN',
      rawCovered,
      possibleRawCovered,
      physicalCovered,
      possiblePhysicalCovered,
      scoredCovered,
      possibleScoredCovered,
      sufficientCovered,
      possibleSufficientCovered,
      minimumMet: physicalCovered >= slot.minimum,
      sufficientThreshold: slot.sufficientThreshold,
      sufficientMet: slot.sufficientThreshold != null && physicalCovered >= slot.sufficientThreshold,
      targetMet: slot.target == null
        ? slot.sufficientThreshold != null && physicalCovered >= slot.sufficientThreshold
        : physicalCovered >= slot.target,
      residualToMinimum: Math.max(0, slot.minimum - physicalCovered),
      residualToTarget: slot.target == null ? null : Math.max(0, slot.target - physicalCovered),
      residualToSufficiency: Math.max(0, slot.sufficientThreshold - physicalCovered),
      excessAboveScoringCeiling: Math.max(0, rawCovered - slot.scoringCeiling),
      contributors: selected.map(row => ({
        sourceId: row.source.sourceId,
        sourceType: row.source.sourceType,
        skillId: row.source.skillId,
        familyId: row.source.effectFamilyId,
        effectFamilyId: row.source.effectFamilyId,
        acquisitionFamilyId: row.source.acquisitionFamilyId,
        magnitude: row.contribution.magnitude,
        valueScope: row.source.valueScope,
        isGold: row.source.isGold,
        isBodyUnique: row.source.isBodyUnique
      })),
      duplicates,
      unknownSourceIds: unique(unknownSources),
      conditionalSourceIds: unique(conditionalCandidates.map(row => row.source.sourceId)),
      conditionalAffectsDecision
    };
  }

  function coverageLedger(slots, sources) {
    return slots.map(slot => coverageForSlot(slot, sources));
  }

  function rowBySlot(rows, slotId) {
    return rows.find(row => row.slotId === slotId);
  }

  function bodyMarginalForSlot(slot, baseline, withBody, rawSupply) {
    const baselineKnown = baseline?.status === 'KNOWN';
    const baselineAlreadySufficient = baselineKnown
      && baseline.physicalCovered >= slot.sufficientThreshold;
    const marginal = baselineAlreadySufficient
      ? 0
      : baselineKnown && withBody?.status === 'KNOWN'
        ? Math.max(0, withBody.sufficientCovered - baseline.sufficientCovered)
        : null;
    return {
      slotId: slot.id,
      unit: slot.unit,
      sufficientThreshold: slot.sufficientThreshold,
      baselineScored: baseline.scoredCovered,
      withBodyScored: withBody.scoredCovered,
      baselineEffective: baseline.sufficientCovered,
      withBodyEffective: withBody.sufficientCovered,
      marginal,
      marginalStatus: marginal == null ? 'UNKNOWN' : 'KNOWN',
      rawBodySupply: rawSupply,
      baselineAlreadySufficient,
      baselineCoverageStatus: baseline.status,
      baselineAlreadyAtScoringCeiling: baseline.scoredCovered >= slot.scoringCeiling
    };
  }

  function sourceCourseValueLedger(sources, comparisonUnit) {
    const byFamily = new Map();
    const unknownSourceIds = [];
    for (const source of sources) {
      if (!COUNTED_SOURCE_STATUSES.has(source.sourceStatus)) {
        unknownSourceIds.push(source.sourceId);
        continue;
      }
      if (!['NON_DEMAND_ADDITIVE', 'DECOMPOSED_MIXED'].includes(source.valueScope)) continue;
      if (!source.requiresCourseValue && source.courseValueStatus === 'NOT_MODELED') continue;
      if (source.courseValueStatus !== 'CONFIRMED'
        || source.courseValue == null
        || source.courseValueUnit !== comparisonUnit) {
        unknownSourceIds.push(source.sourceId);
        continue;
      }
      const key = String(source.effectFamilyId);
      if (!byFamily.has(key)) byFamily.set(key, []);
      byFamily.get(key).push(source);
    }
    const selected = [];
    const duplicates = [];
    for (const [familyId, rows] of byFamily) {
      rows.sort((left, right) => right.courseValue - left.courseValue
        || String(left.sourceId).localeCompare(String(right.sourceId)));
      selected.push(rows[0]);
      if (rows.length > 1) {
        duplicates.push({
          familyId: Number(familyId),
          effectFamilyId: Number(familyId),
          keptSourceId: rows[0].sourceId,
          suppressedSourceIds: rows.slice(1).map(row => row.sourceId),
          goldDuplicate: rows.some(row => row.isGold)
        });
      }
    }
    const bySkill = new Map();
    for (const source of selected) {
      const key = String(source.skillId);
      if (!bySkill.has(key)) bySkill.set(key, []);
      bySkill.get(key).push(source);
    }
    const skillSelected = [];
    for (const [skillId, rows] of bySkill) {
      rows.sort((left, right) => right.courseValue - left.courseValue
        || String(left.sourceId).localeCompare(String(right.sourceId)));
      skillSelected.push(rows[0]);
      if (rows.length > 1) {
        duplicates.push({
          kind: 'SKILL_LEVEL_ADDITIVE_DEDUPE',
          dedupeScope: 'SKILL_ADDITIVE',
          skillId: Number(skillId),
          effectFamilyIds: unique(rows.map(row => row.effectFamilyId)),
          keptSourceId: rows[0].sourceId,
          suppressedSourceIds: rows.slice(1).map(row => row.sourceId),
          goldDuplicate: rows.some(row => row.isGold)
        });
      }
    }
    return {
      value: skillSelected.reduce((sum, source) => sum + source.courseValue, 0),
      contributors: skillSelected.map(source => ({
        sourceId: source.sourceId,
        sourceType: source.sourceType,
        skillId: source.skillId,
        familyId: source.effectFamilyId,
        effectFamilyId: source.effectFamilyId,
        acquisitionFamilyId: source.acquisitionFamilyId,
        courseValue: source.courseValue
      })),
      duplicates,
      unknownSourceIds: unique(unknownSourceIds),
      status: unknownSourceIds.length ? 'UNKNOWN' : 'KNOWN'
    };
  }

  function skillLevelMaxTotal(sources, field) {
    const bySkill = new Map();
    for (const source of sources) {
      const key = String(source.skillId);
      const value = nonNegative(source[field]) ?? 0;
      bySkill.set(key, Math.max(bySkill.get(key) ?? 0, value));
    }
    return [...bySkill.values()].reduce((sum, value) => sum + value, 0);
  }

  function normalizeOpportunity(raw = {}) {
    const source = isObject(raw) ? raw : {};
    const fields = ['trainingOutput', 'skillPtEconomy', 'deckComfort', 'aptitudeRepairCost'];
    const values = Object.fromEntries(fields.map(field => [field, nonNegative(source[field])]));
    const declaredStatus = text(source.status)?.toUpperCase() || 'UNKNOWN';
    const evidenceSource = text(source.evidenceSource);
    const missingFields = fields.filter(field => values[field] == null);
    if (declaredStatus !== 'CONFIRMED') missingFields.push('status');
    if (!evidenceSource) missingFields.push('evidenceSource');
    return {
      ...values,
      status: missingFields.length ? 'UNKNOWN' : 'KNOWN',
      declaredStatus,
      evidenceSource,
      missingFields,
      note: text(source.note)
    };
  }

  function normalizeComparisonUnitContract(raw) {
    const source = isObject(raw) ? raw : {};
    const unit = text(source.unit);
    const additivity = text(source.additivity)?.toUpperCase() || 'UNKNOWN';
    const evidenceSource = text(source.evidenceSource);
    const errors = [];
    if (!unit) errors.push({ code: 'COMPARISON_UNIT_MISSING' });
    if (!['CONFIRMED_ADDITIVE', 'REFERENCE_ONLY'].includes(additivity)) {
      errors.push({ code: 'COMPARISON_UNIT_ADDITIVITY_UNKNOWN' });
    }
    if (!evidenceSource) errors.push({ code: 'COMPARISON_UNIT_EVIDENCE_MISSING' });
    return {
      unit,
      additivity,
      evidenceSource,
      status: errors.length
        ? 'NEEDS_EVIDENCE'
        : additivity === 'CONFIRMED_ADDITIVE' ? 'READY' : 'REFERENCE_ONLY',
      errors
    };
  }

  function normalizeSkillPlan(raw) {
    const source = isObject(raw) ? raw : {};
    const status = text(source.status)?.toUpperCase() || 'UNKNOWN';
    const selectedSkillIds = integerList(source.selectedSkillIds);
    const evidenceSource = text(source.evidenceSource);
    const errors = [];
    if (status !== 'CONFIRMED') errors.push({ code: 'SKILL_PLAN_NOT_CONFIRMED' });
    if (!selectedSkillIds || !selectedSkillIds.length) errors.push({ code: 'SKILL_PLAN_IDS_MISSING' });
    if (Array.isArray(source.selectedSkillIds) && selectedSkillIds
      && source.selectedSkillIds.length !== selectedSkillIds.length) {
      errors.push({ code: 'SKILL_PLAN_IDS_DUPLICATE_OR_INVALID' });
    }
    if (!evidenceSource) errors.push({ code: 'SKILL_PLAN_EVIDENCE_MISSING' });
    return { status, selectedSkillIds: selectedSkillIds || [], evidenceSource, errors };
  }

  function normalizeExpectedStats(raw) {
    const source = isObject(raw) ? raw : {};
    const status = text(source.status)?.toUpperCase() || 'UNKNOWN';
    const fields = ['speed', 'stamina', 'power', 'guts', 'wisdom'];
    const values = Object.fromEntries(fields.map(field => [field, nonNegative(source[field])]));
    const evidenceSource = text(source.evidenceSource);
    const errors = [];
    if (!['CONFIRMED', 'PLANNED'].includes(status)) errors.push({ code: 'EXPECTED_STATS_STATUS_UNKNOWN' });
    for (const field of fields) {
      if (values[field] == null) errors.push({ code: 'EXPECTED_STAT_MISSING', field });
    }
    if (!evidenceSource) errors.push({ code: 'EXPECTED_STATS_EVIDENCE_MISSING' });
    return { status, ...values, evidenceSource, errors };
  }

  function validateBuildContext(raw, candidateId) {
    const source = isObject(raw) ? raw : {};
    const missing = [];
    const sixCardIds = Array.isArray(source.sixCardIds)
      ? source.sixCardIds.map(integer)
      : null;
    if (!sixCardIds || sixCardIds.length !== 6 || sixCardIds.some(id => id == null)) {
      missing.push('sixCardIds');
    }
    if (sixCardIds && unique(sixCardIds).length !== sixCardIds.length) missing.push('sixCardIds.unique');
    if (!Array.isArray(source.deckSources)) missing.push('deckSources');
    if (!Array.isArray(source.whiteFactorSources)) missing.push('whiteFactorSources');
    if (!Array.isArray(source.inheritedUniqueSources)) missing.push('inheritedUniqueSources');
    if (!isObject(source.aptitudeRepair)
      || !['CONFIRMED', 'NOT_REQUIRED'].includes(text(source.aptitudeRepair?.status)?.toUpperCase())) {
      missing.push('aptitudeRepair');
    }
    const expectedStats = normalizeExpectedStats(source.expectedStats);
    if (expectedStats.errors.length) missing.push('expectedStats');
    if (!isObject(source.opportunity)) missing.push('opportunity');
    if (!Array.isArray(source.performanceMetrics)) missing.push('performanceMetrics');
    if (!isObject(source.teamFit)) missing.push('teamFit');
    const skillPlan = normalizeSkillPlan(source.skillPlan);
    if (skillPlan.errors.length) missing.push('skillPlan');
    if (integer(source.battleUmaOutfitId) !== integer(candidateId)) missing.push('battleUmaOutfitId');
    return {
      complete: !missing.length,
      missing: unique(missing),
      sixCardIds: sixCardIds || [],
      expectedStats,
      skillPlan
    };
  }

  function evaluateVariant(candidate, rawVariant, slots, options) {
    const variant = isObject(rawVariant) ? rawVariant : {};
    const variantId = text(variant.variantId) || 'build-variant';
    const context = validateBuildContext(variant, candidate.candidateId);
    if (!context.complete) {
      return {
        variantId,
        status: 'NEEDS_BUILD_CONTEXT',
        missingBuildFields: context.missing,
        finalRankEligible: false,
        baseline: [],
        withBody: [],
        bodyMarginal: [],
        bodyUniqueMarginal: [],
        duplicates: [],
        skillTotal: { status: 'UNKNOWN', effectiveSkillCount: null },
        wholeBuild: { effectiveCourseValue: null, status: 'UNKNOWN' },
        opportunity: normalizeOpportunity(variant.opportunity),
        performance: { status: 'UNKNOWN', rows: [] },
        teamFit: { status: 'UNKNOWN' }
      };
    }

    const slotById = new Map(slots.map(slot => [slot.id, slot]));
    const allRawSources = [
      ...(candidate.bodySources || []),
      ...(variant.deckSources || []),
      ...(variant.whiteFactorSources || []),
      ...(variant.inheritedUniqueSources || []),
      ...(variant.scenarioSources || []),
      ...(variant.aptitudeRepair?.sources || [])
    ];
    const normalized = normalizeSourceList(allRawSources, slotById);
    const acquisition = resolveAcquisitionOverlaps(normalized.sources);
    const effectiveSources = acquisition.effectSources;
    const selectedSkillIds = new Set(context.skillPlan.selectedSkillIds);
    const modeledSelectedSkillIds = new Set(effectiveSources
      .filter(source => source.valueScope !== 'STRUCTURAL')
      .map(source => source.skillId));
    const skillPlanErrors = [
      ...[...selectedSkillIds]
        .filter(skillId => !modeledSelectedSkillIds.has(skillId))
        .map(skillId => ({ code: 'SKILL_PLAN_SOURCE_MISSING', skillId })),
      ...[...modeledSelectedSkillIds]
        .filter(skillId => !selectedSkillIds.has(skillId))
        .map(skillId => ({ code: 'SOURCE_NOT_DECLARED_IN_SKILL_PLAN', skillId }))
    ];
    const bodySources = effectiveSources.filter(source => source.sourceType.startsWith('body_'));
    const bodyNonUnique = bodySources.filter(source => !source.isBodyUnique);
    const nonBodySources = effectiveSources.filter(source => !source.sourceType.startsWith('body_'));
    const baseline = coverageLedger(slots, nonBodySources);
    const withBodyNonUnique = coverageLedger(slots, [...nonBodySources, ...bodyNonUnique]);
    const withBody = coverageLedger(slots, [...nonBodySources, ...bodySources]);
    const bodyMarginal = slots.map(slot => {
      const base = rowBySlot(baseline, slot.id);
      const complete = rowBySlot(withBody, slot.id);
      return bodyMarginalForSlot(slot, base, complete, bodySources
        .map(source => contributionForSlot(source, slot.id))
        .filter(Boolean)
        .reduce((sum, contribution) => sum + (contribution.magnitude || 0), 0));
    });
    const bodyUniqueMarginal = slots.map(slot => {
      const base = rowBySlot(withBodyNonUnique, slot.id);
      const complete = rowBySlot(withBody, slot.id);
      const row = bodyMarginalForSlot(slot, base, complete, bodySources
        .filter(source => source.isBodyUnique)
        .map(source => contributionForSlot(source, slot.id))
        .filter(Boolean)
        .reduce((sum, contribution) => sum + (contribution.magnitude || 0), 0));
      const { rawBodySupply, ...withoutRawBodySupply } = row;
      return {
        ...withoutRawBodySupply,
        rawUniqueSupply: rawBodySupply,
        suppressedByExistingBuild: base.sufficientMet === true
      };
    });
    const opportunity = normalizeOpportunity(variant.opportunity);
    const performance = normalizePerformanceMetrics(variant.performanceMetrics, options.performanceRequirements);
    const teamFit = normalizeTeamFit(variant.teamFit, options.teamContext);
    const unbounded = sourceCourseValueLedger(effectiveSources, options.comparisonUnit);
    const boundedCourseValue = slots
      .filter(slot => slot.includeInCourseTotal && slot.unit === options.comparisonUnit)
      .reduce((sum, slot) => sum + rowBySlot(withBody, slot.id).sufficientCovered, 0);
    const wholeBuild = {
      effectiveCourseValue: boundedCourseValue + unbounded.value,
      boundedDemandValue: boundedCourseValue,
      unboundedUtilityValue: unbounded.value,
      unit: options.comparisonUnit,
      status: unbounded.status,
      contributors: unbounded.contributors,
      unknownSourceIds: unbounded.unknownSourceIds
    };
    const coverage = {
      minimumMetCount: withBody.filter(row => row.minimumMet).length,
      targetMetCount: withBody.filter(row => row.targetMet).length,
      slotCount: slots.length,
      residualToMinimumTotal: withBody.reduce((sum, row) => sum + row.residualToMinimum, 0),
      residualToTargetTotal: withBody.reduce((sum, row) => sum + row.residualToTarget, 0),
      residualToSufficiencyTotal: withBody.reduce((sum, row) => sum + row.residualToSufficiency, 0),
      allMinimumMet: withBody.every(row => row.minimumMet),
      allTargetMet: withBody.every(row => row.targetMet),
      allSufficientMet: withBody.every(row => row.sufficientMet),
      hardMinimumMetVector: withBody
        .filter(row => row.requirementLevel === 'HARD')
        .map(row => row.minimumMet ? 1 : 0),
      hardResidualToMinimumVector: withBody
        .filter(row => row.requirementLevel === 'HARD')
        .map(row => row.residualToMinimum),
      hardSufficientMetVector: withBody
        .filter(row => row.requirementLevel === 'HARD')
        .map(row => row.sufficientMet ? 1 : 0),
      hardResidualToSufficiencyVector: withBody
        .filter(row => row.requirementLevel === 'HARD')
        .map(row => row.residualToSufficiency),
      softSufficientMetVector: withBody
        .filter(row => row.requirementLevel === 'SOFT')
        .map(row => row.sufficientMet ? 1 : 0),
      softResidualToSufficiencyVector: withBody
        .filter(row => row.requirementLevel === 'SOFT')
        .map(row => row.residualToSufficiency),
      targetMetVector: withBody.map(row => row.targetMet ? 1 : 0),
      allHardMinimumMet: withBody
        .filter(row => row.requirementLevel === 'HARD')
        .every(row => row.minimumMet)
    };
    const duplicates = unique([
      ...withBody.flatMap(row => row.duplicates.map(item => JSON.stringify(item))),
      ...unbounded.duplicates.map(item => JSON.stringify(item))
    ]).map(item => JSON.parse(item));
    const goldDuplicateFamilies = unique(duplicates
      .filter(item => item.goldDuplicate)
      .map(item => item.familyId));
    const errors = [
      ...normalized.errors,
      ...context.skillPlan.errors,
      ...skillPlanErrors,
      ...performance.errors,
      ...teamFit.errors
    ];
    const redundantSourceIds = unique([
      ...duplicates.flatMap(item => item.suppressedSourceIds || []),
      ...acquisition.suppressedSourceIds
    ]);
    const referenceValues = normalized.sources
      .filter(source => source.referenceValue != null)
      .map(source => ({
        sourceId: source.sourceId,
        skillId: source.skillId,
        value: source.referenceValue,
        unit: source.referenceValueUnit,
        scoreIncluded: false
      }));
    const skillTotal = {
      status: errors?.length ? 'UNKNOWN' : 'KNOWN',
      rawSourceCount: normalized.sources.length,
      selectedEffectiveSourceCount: effectiveSources.length,
      effectiveSkillCount: unique(effectiveSources
        .filter(source => source.valueScope !== 'STRUCTURAL')
        .map(source => source.skillId)).length,
      uniqueEffectFamilyCount: unique(effectiveSources
        .filter(source => source.valueScope !== 'STRUCTURAL')
        .map(source => source.effectFamilyId)).length,
      skillPointCost: skillLevelMaxTotal(effectiveSources, 'skillPointCost'),
      conditionBurden: skillLevelMaxTotal(effectiveSources, 'conditionBurden'),
      demandCoverageBySlot: withBody.map(row => ({
        slotId: row.slotId,
        scoredCovered: row.scoredCovered,
        possibleScoredCovered: row.possibleScoredCovered,
        effectiveCovered: row.sufficientCovered,
        possibleEffectiveCovered: row.possibleSufficientCovered,
        unit: row.unit,
        status: row.status
      })),
      redundantSourceIds,
      conditionalSourceIds: unique(withBody.flatMap(row => row.conditionalSourceIds || [])),
      unresolvedSourceIds: unique([
        ...withBody.flatMap(row => row.unknownSourceIds || []),
        ...wholeBuild.unknownSourceIds
      ]),
      referenceValues,
      additiveUtilityValue: wholeBuild.unboundedUtilityValue,
      additiveUtilityUnit: wholeBuild.unit
    };
    const unknownCoverage = withBody.some(row =>
      row.status === 'UNKNOWN' || row.conditionalAffectsDecision === true);
    let status = 'READY';
    if (errors.some(error => error.code === 'EXCLUSIVE_ROUTE_MULTIPLE_ACTIVE')) status = 'BLOCKED';
    else if (errors.length || unknownCoverage || wholeBuild.status === 'UNKNOWN' || opportunity.status === 'UNKNOWN') {
      status = 'NEEDS_EVIDENCE';
    } else if (!performance.allHardMinimumMet || teamFit.hardRequirementsMet !== true || !coverage.allHardMinimumMet) {
      status = 'INCOMPLETE_BUILD';
    }
    return {
      variantId,
      status,
      finalRankEligible: status === 'READY',
      missingBuildFields: [],
      sourceErrors: errors,
      baseline,
      withBody,
      bodyMarginal,
      bodyUniqueMarginal,
      coverage,
      duplicates,
      goldDuplicateFamilies,
      skillTotal,
      acquisitionOverlaps: acquisition.overlaps,
      suppressedAcquisitionSourceIds: acquisition.suppressedSourceIds,
      wholeBuild,
      opportunity,
      performance,
      teamFit,
      expectedStats: context.expectedStats,
      skillPlan: context.skillPlan,
      conditionBurden: skillLevelMaxTotal(effectiveSources, 'conditionBurden'),
      sourceLedger: normalized.sources,
      effectiveSourceLedger: effectiveSources,
      sixCardIds: context.sixCardIds
    };
  }

  function compareVariants(left, right) {
    const compareVector = (leftValues, rightValues, direction) => {
      const a = Array.isArray(leftValues) ? leftValues : [];
      const b = Array.isArray(rightValues) ? rightValues : [];
      const length = Math.max(a.length, b.length);
      for (let index = 0; index < length; index += 1) {
        const leftValue = finite(a[index]);
        const rightValue = finite(b[index]);
        if (leftValue == null && rightValue == null) continue;
        if (leftValue == null) return 1;
        if (rightValue == null) return -1;
        const difference = direction === 'asc'
          ? leftValue - rightValue
          : rightValue - leftValue;
        if (difference) return difference;
      }
      return 0;
    };
    return (STATUS_ORDER[right.status] ?? -1) - (STATUS_ORDER[left.status] ?? -1)
      || compareVector(left.performance?.hardMinimumMetVector, right.performance?.hardMinimumMetVector, 'desc')
      || compareVector(left.performance?.hardResidualVector, right.performance?.hardResidualVector, 'asc')
      || compareVector(left.coverage?.hardMinimumMetVector, right.coverage?.hardMinimumMetVector, 'desc')
      || compareVector(left.coverage?.hardResidualToMinimumVector, right.coverage?.hardResidualToMinimumVector, 'asc')
      || compareVector(left.coverage?.hardSufficientMetVector, right.coverage?.hardSufficientMetVector, 'desc')
      || compareVector(left.coverage?.hardResidualToSufficiencyVector, right.coverage?.hardResidualToSufficiencyVector, 'asc')
      || compareVector(left.coverage?.softSufficientMetVector, right.coverage?.softSufficientMetVector, 'desc')
      || compareVector(left.coverage?.softResidualToSufficiencyVector, right.coverage?.softResidualToSufficiencyVector, 'asc')
      || Number(right.teamFit?.hardRequirementsMet === true) - Number(left.teamFit?.hardRequirementsMet === true)
      || (right.teamFit?.roleCoverage ?? -Infinity) - (left.teamFit?.roleCoverage ?? -Infinity)
      || (left.teamFit?.conflictCost ?? Infinity) - (right.teamFit?.conflictCost ?? Infinity)
      || (right.wholeBuild?.effectiveCourseValue ?? -Infinity) - (left.wholeBuild?.effectiveCourseValue ?? -Infinity)
      || (right.opportunity?.trainingOutput ?? -Infinity) - (left.opportunity?.trainingOutput ?? -Infinity)
      || (right.opportunity?.skillPtEconomy ?? -Infinity) - (left.opportunity?.skillPtEconomy ?? -Infinity)
      || (right.opportunity?.deckComfort ?? -Infinity) - (left.opportunity?.deckComfort ?? -Infinity)
      || (left.opportunity?.aptitudeRepairCost ?? Infinity) - (right.opportunity?.aptitudeRepairCost ?? Infinity)
      || String(left.variantId).localeCompare(String(right.variantId));
  }

  function candidateGate(candidate, target) {
    const errors = [];
    const ownership = text(candidate.ownership)?.toUpperCase();
    const serverStatus = text(candidate.serverStatus)?.toUpperCase();
    const bodyEvidence = text(candidate.bodyEvidence)?.toUpperCase();
    const aptitudeState = text(candidate.aptitudeState)?.toUpperCase();
    const awakeningState = text(candidate.awakeningState)?.toUpperCase();
    const evolutionState = text(candidate.evolutionState)?.toUpperCase();
    if (ownership !== 'USER_OWNED') errors.push({ code: 'BODY_NOT_CONFIRMED_OWNED' });
    if (target.server === 'zh_tw' && !['AVAILABLE', 'NOT_REQUIRED'].includes(serverStatus)) {
      errors.push({ code: 'BODY_SERVER_AVAILABILITY_UNKNOWN' });
    }
    if (!['SUFFICIENT', 'CONFIRMED'].includes(bodyEvidence)) errors.push({ code: 'BODY_EVIDENCE_UNKNOWN' });
    if (!['CONFIRMED', 'NOT_REQUIRED'].includes(awakeningState)) errors.push({ code: 'AWAKENING_UNKNOWN' });
    if (!['CONFIRMED', 'NOT_REQUIRED'].includes(evolutionState)) errors.push({ code: 'EVOLUTION_UNKNOWN' });
    if (aptitudeState === 'INELIGIBLE_REPAIR' || aptitudeState === 'BLOCKED') {
      errors.push({ code: 'APTITUDE_INELIGIBLE' });
    } else if (!['READY', 'LIGHT_REPAIR', 'HEAVY_REPAIR'].includes(aptitudeState)) {
      errors.push({ code: 'APTITUDE_UNKNOWN' });
    }
    return { status: errors.length ? 'BLOCKED' : 'PASS', errors };
  }

  function evaluateCandidate(candidate, slots, target, options) {
    const candidateId = integer(candidate?.candidateId ?? candidate?.outfitId);
    const gate = candidateGate(candidate || {}, target);
    if (candidateId == null) gate.errors.push({ code: 'CANDIDATE_ID_INVALID' });
    if (gate.errors.length) gate.status = 'BLOCKED';
    if (gate.status !== 'PASS') {
      return {
        candidateId,
        name: text(candidate?.name),
        status: 'BLOCKED',
        hardGate: gate,
        variants: [],
        selectedVariant: null,
        finalRank: null,
        finalRankEligible: false
      };
    }
    const variants = Array.isArray(candidate?.buildVariants) && candidate.buildVariants.length
      ? candidate.buildVariants.map(variant => evaluateVariant(candidate, variant, slots, options))
      : [evaluateVariant(candidate, {}, slots, options)];
    variants.sort(compareVariants);
    const selectedVariant = variants.find(variant => variant.status === 'READY') || null;
    const diagnosticVariant = variants[0] || null;
    return {
      candidateId,
      name: text(candidate?.name),
      status: selectedVariant ? 'READY' : (diagnosticVariant?.status || 'NEEDS_BUILD_CONTEXT'),
      hardGate: gate,
      variants,
      selectedVariant,
      diagnosticVariant,
      finalRank: null,
      finalRankEligible: Boolean(selectedVariant?.finalRankEligible)
    };
  }

  function compareCandidates(left, right) {
    if (!left.selectedVariant || !right.selectedVariant) {
      if (left.selectedVariant) return -1;
      if (right.selectedVariant) return 1;
      return (left.candidateId ?? Infinity) - (right.candidateId ?? Infinity);
    }
    const leftVariant = left.selectedVariant;
    const rightVariant = right.selectedVariant;
    return compareVariants(leftVariant, rightVariant)
      || (leftVariant.conditionBurden ?? Infinity) - (rightVariant.conditionBurden ?? Infinity)
      || (left.candidateId ?? Infinity) - (right.candidateId ?? Infinity);
  }

  function normalizeComparisonSet(raw, candidates) {
    const source = isObject(raw) ? raw : {};
    const status = text(source.status)?.toUpperCase() || 'UNKNOWN';
    const candidateIds = integerList(source.candidateIds);
    const evidenceSource = text(source.evidenceSource);
    const actualIds = candidates.map(candidate => candidate.candidateId).filter(id => id != null).sort((a, b) => a - b);
    const declaredIds = (candidateIds || []).slice().sort((a, b) => a - b);
    const errors = [];
    if (status !== 'CONFIRMED_COMPLETE') errors.push({ code: 'COMPARISON_SET_NOT_CONFIRMED_COMPLETE' });
    if (!candidateIds || !candidateIds.length) errors.push({ code: 'COMPARISON_SET_IDS_MISSING' });
    if (Array.isArray(source.candidateIds) && candidateIds
      && source.candidateIds.length !== candidateIds.length) {
      errors.push({ code: 'COMPARISON_SET_IDS_DUPLICATE_OR_INVALID' });
    }
    if (JSON.stringify(declaredIds) !== JSON.stringify(actualIds)) {
      errors.push({ code: 'COMPARISON_SET_IDS_MISMATCH', declaredIds, actualIds });
    }
    if (!evidenceSource) errors.push({ code: 'COMPARISON_SET_EVIDENCE_MISSING' });
    return {
      status: errors.length ? 'NEEDS_EVIDENCE' : 'READY',
      declaredStatus: status,
      candidateIds: candidateIds || [],
      evidenceSource,
      errors
    };
  }

  function overallStatus(candidates, demandStatus, demandProfileStatus, performanceStatus, teamContextStatus, comparisonSetStatus, comparisonUnitStatus) {
    if (demandStatus !== 'READY') return 'NEEDS_EVIDENCE';
    if (demandProfileStatus !== 'READY') return 'NEEDS_EVIDENCE';
    if (performanceStatus !== 'READY') return 'NEEDS_EVIDENCE';
    if (teamContextStatus !== 'READY') return 'NEEDS_EVIDENCE';
    if (comparisonSetStatus !== 'READY') return 'NEEDS_EVIDENCE';
    if (comparisonUnitStatus !== 'READY') return 'NEEDS_EVIDENCE';
    const eligible = candidates.filter(candidate => candidate.hardGate?.status === 'PASS');
    if (!eligible.length) return 'BLOCKED';
    if (eligible.every(candidate => candidate.status === 'READY')) return 'READY';
    if (candidates.some(candidate => candidate.status === 'NEEDS_EVIDENCE')) return 'NEEDS_EVIDENCE';
    if (candidates.some(candidate => candidate.status === 'NEEDS_BUILD_CONTEXT')) return 'NEEDS_BUILD_CONTEXT';
    if (candidates.some(candidate => candidate.status === 'INCOMPLETE_BUILD')) return 'INCOMPLETE_BUILD';
    return 'BLOCKED';
  }

  function evaluateBattleBuilds(input = {}) {
    const forbidden = forbiddenPaths(input);
    const targetResult = normalizeTarget(input.target || {});
    if (forbidden.length || targetResult.status !== 'READY') {
      return {
        schemaVersion: SCHEMA_VERSION,
        status: 'BLOCKED',
        target: targetResult.target,
        targetKey: targetResult.targetKey,
        candidates: [],
        layers: clone(EVALUATION_LAYERS),
        comparisonOrder: clone(COMPARISON_ORDER),
        errors: [
          ...targetResult.errors,
          ...forbidden.map(path => ({ code: 'FORBIDDEN_PROBABILITY_FIELD', path }))
        ],
        boundary: 'No final rank without a complete build context; no probability or win-rate output.'
      };
    }
    const demand = normalizeDemandSlots(input.demandSlots, targetResult.target);
    const demandProfileContract = normalizeDemandProfileContract(
      input.demandProfileContract || input.demandContract,
      demand.slots
    );
    const performanceRequirements = normalizePerformanceRequirements(input.performanceRequirements);
    const teamContext = normalizeTeamContext(input.teamContext);
    const comparisonUnitContract = normalizeComparisonUnitContract(
      input.comparisonUnitContract
        || (input.comparisonUnit ? { unit: input.comparisonUnit, additivity: 'UNKNOWN' } : null)
    );
    const comparisonUnit = comparisonUnitContract.unit || 'UNKNOWN';
    const candidates = (Array.isArray(input.candidates) ? input.candidates : [])
      .map(candidate => evaluateCandidate(candidate, demand.slots, targetResult.target, {
        comparisonUnit,
        performanceRequirements: performanceRequirements.requirements,
        teamContext
      }))
      .sort(compareCandidates);
    const comparisonSet = normalizeComparisonSet(input.comparisonSet, candidates);
    const eligible = candidates.filter(candidate => candidate.hardGate?.status === 'PASS');
    const finalRankingReady = demand.status === 'READY'
      && demandProfileContract.status === 'READY'
      && performanceRequirements.status === 'READY'
      && teamContext.status === 'READY'
      && comparisonSet.status === 'READY'
      && comparisonUnitContract.status === 'READY'
      && eligible.length > 0
      && eligible.every(candidate => candidate.finalRankEligible);
    if (finalRankingReady) {
      let finalRank = 0;
      for (const candidate of candidates) {
        if (!candidate.finalRankEligible) continue;
        finalRank += 1;
        candidate.finalRank = finalRank;
      }
    }
    return {
      schemaVersion: SCHEMA_VERSION,
      status: overallStatus(
        candidates,
        demand.status,
        demandProfileContract.status,
        performanceRequirements.status,
        teamContext.status,
        comparisonSet.status,
        comparisonUnitContract.status
      ),
      target: targetResult.target,
      targetKey: targetResult.targetKey,
      comparisonUnit,
      comparisonUnitContract,
      demandSlots: demand.slots,
      demandProfileContract,
      performanceRequirements: performanceRequirements.requirements,
      teamContext,
      comparisonSet,
      finalRankingReady,
      candidates,
      layers: clone(EVALUATION_LAYERS),
      comparisonOrder: clone(COMPARISON_ORDER),
      errors: [
        ...demand.errors,
        ...demandProfileContract.errors,
        ...performanceRequirements.errors,
        ...teamContext.errors,
        ...comparisonSet.errors,
        ...comparisonUnitContract.errors
      ],
      boundary: 'Body data may form a shortlist only. finalRank requires calibrated interval demand, performance/stamina gates, a fixed team script, and READY whole-build variants for the complete eligible set; UNKNOWN never becomes zero.'
    };
  }

  return Object.freeze({
    SCHEMA_VERSION,
    TARGET_FIELDS,
    SOURCE_TYPES,
    EVALUATION_LAYERS,
    COMPARISON_ORDER,
    normalizeTarget,
    normalizeDemandSlots,
    normalizeDemandProfileContract,
    normalizePerformanceRequirements,
    evaluateBattleBuilds
  });
});
