(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.FACTOR_EXECUTION_CORE = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const STAT_AXES = Object.freeze(['speed', 'stamina', 'power', 'guts', 'wisdom']);
  const BLUE_FACTOR_GAIN = Object.freeze({ 1: 5, 2: 12, 3: 21 });
  const HARD_REQUIREMENT_LEVELS = Object.freeze(['RULE_REQUIRED', 'USER_REQUIRED']);
  const DEFAULT_RISK_PROFILES = Object.freeze([
    Object.freeze({ id: 'stable', label: '保守', nearTieToleranceRatio: 0.04, tradeoffBudget: 0.05 }),
    Object.freeze({ id: 'balanced', label: '平衡', nearTieToleranceRatio: 0.08, tradeoffBudget: 0.1 }),
    Object.freeze({ id: 'upside', label: '進取', nearTieToleranceRatio: 0.12, tradeoffBudget: 0.15 })
  ]);

  function number(value, fallback = null) {
    if (value === null || value === undefined || value === '') return fallback;
    const result = Number(value);
    return Number.isFinite(result) ? result : fallback;
  }

  function text(value, fallback = '') {
    const result = value == null ? '' : String(value).trim();
    return result || fallback;
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function requirementLevel(value, fallback = 'RECOMMENDED') {
    const candidate = text(value, fallback).toUpperCase();
    return ['RULE_REQUIRED', 'USER_REQUIRED', 'RECOMMENDED', 'OPTIONAL'].includes(candidate)
      ? candidate
      : fallback;
  }

  function normalizeAxisTarget(raw = {}, axis) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const minimum = number(source.minimum);
    const target = number(source.target);
    return {
      axis,
      label: text(source.label, axis),
      minimum: minimum === null ? null : Math.max(0, minimum),
      target: target === null ? null : Math.max(0, target),
      belowWeight: Math.max(0, number(source.belowWeight, 1)),
      surplusWeight: Math.max(0, number(source.surplusWeight ?? source.overWeight, 0.25)),
      minimumRequirementLevel: requirementLevel(source.minimumRequirementLevel, 'USER_REQUIRED'),
      evidenceStatus: text(source.evidenceStatus, 'USER_CONFIGURED')
    };
  }

  function normalizeTargetProfile(raw = {}) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const axes = Object.fromEntries(STAT_AXES.map(axis => [
      axis,
      normalizeAxisTarget(source.axes?.[axis] ?? source.targets?.[axis], axis)
    ]));
    const rawThreshold = number(source.diminishingReturns?.threshold);
    const threshold = rawThreshold === null ? null : Math.max(0, rawThreshold);
    return {
      id: text(source.id, 'manual'),
      label: text(source.label, '自訂目標'),
      scenarioId: text(source.scenarioId),
      sourceStatus: text(source.sourceStatus, 'USER_CONFIGURED'),
      recommendationUse: text(source.recommendationUse, 'ADVISORY_ONLY'),
      axes,
      diminishingReturns: {
        threshold,
        multiplier: clamp(number(source.diminishingReturns?.multiplier, threshold === null ? 1 : 0.5), 0, 1),
        evidenceStatus: text(
          source.diminishingReturns?.evidenceStatus,
          source.sourceStatus || 'USER_CONFIGURED'
        )
      }
    };
  }

  function normalizeRiskProfile(value, profiles = DEFAULT_RISK_PROFILES) {
    const rows = Array.isArray(profiles) && profiles.length ? profiles : DEFAULT_RISK_PROFILES;
    const requestedId = text(value?.id ?? value, 'balanced');
    const source = rows.find(row => text(row?.id) === requestedId)
      || rows.find(row => text(row?.id) === 'balanced')
      || rows[0]
      || DEFAULT_RISK_PROFILES[1];
    return {
      id: text(source.id, 'balanced'),
      label: text(source.label, '平衡'),
      nearTieToleranceRatio: clamp(number(source.nearTieToleranceRatio, 0.08), 0, 1),
      tradeoffBudget: clamp(number(source.tradeoffBudget, 0.1), 0, 1)
    };
  }

  function effectiveGain(fromValue, toValue, diminishingReturns = {}) {
    const from = Math.max(0, number(fromValue, 0));
    const to = Math.max(from, number(toValue, from));
    const rawThreshold = number(diminishingReturns.threshold);
    if (rawThreshold === null) return to - from;
    const threshold = Math.max(0, rawThreshold);
    const multiplier = clamp(number(diminishingReturns.multiplier, 0.5), 0, 1);
    if (to <= threshold) return to - from;
    if (from >= threshold) return (to - from) * multiplier;
    return (threshold - from) + (to - threshold) * multiplier;
  }

  function statUtility(value, targetEntry, diminishingReturns = {}) {
    const current = Math.max(0, number(value, 0));
    const target = number(targetEntry?.target ?? targetEntry?.minimum);
    const belowWeight = Math.max(0, number(targetEntry?.belowWeight, 1));
    const surplusWeight = Math.max(0, number(targetEntry?.surplusWeight, 0.25));
    if (target === null) return null;
    const belowEnd = Math.min(current, target);
    const below = effectiveGain(0, belowEnd, diminishingReturns) * belowWeight;
    const surplus = current > target
      ? effectiveGain(target, current, diminishingReturns) * surplusWeight
      : 0;
    return below + surplus;
  }

  function evaluateStatProfile(expectedStats = {}, rawProfile = {}) {
    const profile = normalizeTargetProfile(rawProfile);
    const rows = STAT_AXES.map(axis => {
      const entry = profile.axes[axis];
      const expected = number(expectedStats?.[axis]);
      const targetGap = expected === null || entry.target === null
        ? null
        : Math.max(0, entry.target - expected);
      const minimumGap = expected === null || entry.minimum === null
        ? null
        : Math.max(0, entry.minimum - expected);
      const targetSurplus = expected === null || entry.target === null
        ? null
        : Math.max(0, expected - entry.target);
      return {
        ...entry,
        expected,
        targetGap,
        minimumGap,
        targetSurplus,
        utility: expected === null || (entry.minimum === null && entry.target === null)
          ? null
          : statUtility(expected, entry, profile.diminishingReturns),
        status: expected === null
          ? 'UNVERIFIED'
          : entry.minimum === null && entry.target === null
            ? 'UNCONFIGURED'
          : minimumGap > 0 && HARD_REQUIREMENT_LEVELS.includes(entry.minimumRequirementLevel)
            ? 'BELOW_MINIMUM'
            : targetGap > 0
              ? 'BELOW_TARGET'
              : entry.target === null
                ? 'AT_OR_ABOVE_MINIMUM'
                : 'AT_OR_ABOVE_TARGET'
      };
    });
    const blockers = rows.filter(row => row.status === 'BELOW_MINIMUM');
    const tradeoffs = rows.filter(row => row.status === 'BELOW_TARGET');
    const unknown = rows.filter(row => row.status === 'UNVERIFIED');
    const unconfigured = rows.filter(row => row.status === 'UNCONFIGURED');
    return {
      profile,
      rows,
      blockers,
      tradeoffs,
      unknown,
      unconfigured,
      status: blockers.length
        ? 'BLOCKED'
        : unknown.length === rows.length
          ? 'UNVERIFIED'
          : unconfigured.length === rows.length
            ? 'UNCONFIGURED'
            : tradeoffs.length || unknown.length || unconfigured.length
              ? 'READY_WITH_TRADEOFFS'
              : 'READY',
      evidenceStatus: profile.sourceStatus,
      totalUtility: rows.reduce((sum, row) => sum + (number(row.utility, 0) || 0), 0)
    };
  }

  function blueFactorGain(stars) {
    return BLUE_FACTOR_GAIN[Math.max(1, Math.min(3, Math.trunc(number(stars, 1))))];
  }

  function evaluateBlueFactorMarginal(input = {}) {
    const axis = STAT_AXES.includes(input.axis) ? input.axis : STAT_AXES[0];
    const profile = normalizeTargetProfile(input.profile);
    const targetEntry = profile.axes[axis];
    const stars = Math.max(1, Math.min(3, Math.trunc(number(input.stars, 1))));
    const rawGain = blueFactorGain(stars);
    const current = number(input.current);
    const rawCap = number(input.cap);
    const cap = rawCap === null ? null : Math.max(0, rawCap);
    if (current === null) {
      return {
        axis,
        stars,
        rawGain,
        appliedGain: rawGain,
        marginalUtility: null,
        status: 'CURRENT_VALUE_UNVERIFIED',
        evidenceStatus: profile.sourceStatus
      };
    }
    if (targetEntry.minimum === null && targetEntry.target === null) {
      return {
        axis,
        stars,
        current,
        next: current + rawGain,
        cap,
        rawGain,
        appliedGain: rawGain,
        marginalUtility: null,
        status: 'TARGET_UNCONFIGURED',
        evidenceStatus: profile.sourceStatus
      };
    }
    const unconstrainedNext = Math.max(0, current) + rawGain;
    const next = cap === null ? unconstrainedNext : Math.min(cap, unconstrainedNext);
    const beforeUtility = statUtility(current, targetEntry, profile.diminishingReturns);
    const afterUtility = statUtility(next, targetEntry, profile.diminishingReturns);
    return {
      axis,
      stars,
      current,
      next,
      cap,
      rawGain,
      appliedGain: Math.max(0, next - current),
      marginalUtility: Math.max(0, afterUtility - beforeUtility),
      targetGapBefore: targetEntry.target === null ? null : Math.max(0, targetEntry.target - current),
      targetGapAfter: targetEntry.target === null ? null : Math.max(0, targetEntry.target - next),
      crossesTarget: targetEntry.target !== null && current < targetEntry.target && next >= targetEntry.target,
      status: cap !== null && next === current ? 'CAPPED' : 'EVALUATED',
      evidenceStatus: profile.sourceStatus
    };
  }

  function rankBlueFactorOptions(expectedStats = {}, rawProfile = {}, stars = 3) {
    const profile = normalizeTargetProfile(rawProfile);
    return STAT_AXES.map(axis => evaluateBlueFactorMarginal({
      axis,
      stars,
      current: expectedStats?.[axis],
      profile
    })).sort((left, right) =>
      (number(right.marginalUtility, -1) - number(left.marginalUtility, -1))
      || STAT_AXES.indexOf(left.axis) - STAT_AXES.indexOf(right.axis)
    );
  }

  function isGoalRace(row) {
    return row?.isGoalRace === true
      || row?.goalRace === true
      || row?.kind === 'goal-race'
      || row?.type === 'goal-race';
  }

  function evaluateRaceDensity(races = [], rawOptions = {}) {
    const options = {
      thirdConsecutiveCost: Math.max(0, number(rawOptions.thirdConsecutiveCost, 1)),
      fourthPlusCost: Math.max(0, number(rawOptions.fourthPlusCost, 2.5)),
      additionalConsecutiveCost: Math.max(0, number(rawOptions.additionalConsecutiveCost, 0.5)),
      evidenceStatus: text(rawOptions.evidenceStatus, 'COMMUNITY_MODEL_CALIBRATION_REQUIRED')
    };
    const rows = (Array.isArray(races) ? races : [])
      .map((row, index) => ({ ...row, turn: number(row?.turn), sourceOrder: index }))
      .filter(row => row.turn !== null)
      .sort((left, right) => left.turn - right.turn || left.sourceOrder - right.sourceOrder);
    let previousTurn = null;
    let streak = 0;
    const evaluated = rows.map(row => {
      streak = previousTurn !== null && row.turn === previousTurn + 1 ? streak + 1 : 1;
      previousTurn = row.turn;
      const goal = isGoalRace(row);
      const cost = goal || streak < 3
        ? 0
        : streak === 3
          ? options.thirdConsecutiveCost
          : options.fourthPlusCost + Math.max(0, streak - 4) * options.additionalConsecutiveCost;
      return {
        ...row,
        isGoalRace: goal,
        consecutiveRaceCount: streak,
        densityCost: cost,
        costStatus: cost > 0 ? 'SOFT_COST' : (goal ? 'GOAL_RACE_EXEMPT' : 'NO_COST')
      };
    });
    const costly = evaluated.filter(row => row.densityCost > 0);
    return {
      rows: evaluated,
      costly,
      totalCost: evaluated.reduce((sum, row) => sum + row.densityCost, 0),
      maximumStreak: evaluated.reduce((maximum, row) => Math.max(maximum, row.consecutiveRaceCount), 0),
      status: costly.length ? 'READY_WITH_TRADEOFFS' : 'READY',
      scoreIncluded: false,
      evidenceStatus: options.evidenceStatus,
      policy: options
    };
  }

  function scheduleForCharacter(dataset, characterId) {
    const id = number(characterId);
    if (id === null) return null;
    const schedules = dataset?.characterSchedules || dataset?.schedules || [];
    const row = schedules.find(item => Number(item?.characterId) === id);
    return row ? JSON.parse(JSON.stringify(row)) : null;
  }

  function distanceTypeFromMeters(value) {
    const meters = number(value);
    if (meters === null) return null;
    if (meters <= 1400) return 1;
    if (meters <= 1800) return 2;
    if (meters <= 2400) return 3;
    return 4;
  }

  function normalizeScheduleRace(raw = {}, kind = 'optional-race') {
    const source = raw && typeof raw === 'object' ? raw : {};
    const groundType = number(source.groundType ?? source.context?.ground_type)
      ?? (String(source.surface || '').toLowerCase() === 'dirt' ? 2
        : String(source.surface || '').toLowerCase() === 'turf' ? 1 : null);
    const distance = number(source.distance ?? source.context?.course_distance);
    const distanceType = number(source.distanceType ?? source.context?.distance_type)
      ?? distanceTypeFromMeters(distance);
    const goal = kind === 'goal-race' || isGoalRace(source);
    const catalogRaceId = number(source.catalogRaceId ?? source.id);
    return {
      ...source,
      id: text(source.id, `${goal ? 'goal' : 'optional'}:${text(source.catalogRaceId, 'unknown')}:${text(source.turn, 'unknown')}`),
      turn: number(source.turn),
      kind: goal ? 'goal-race' : 'optional-race',
      isGoalRace: goal,
      nameZhTw: text(source.nameZhTw ?? source.name),
      nameJp: text(source.nameJp),
      catalogRaceId,
      canonicalRaceId: number(source.canonicalRaceId ?? source.raceId),
      grade: number(source.grade),
      groundType,
      distance,
      distanceType,
      mappingStatus: text(
        source.mappingStatus,
        goal ? 'COMMUNITY_NAME_ONLY' : (catalogRaceId === null ? 'USER_INPUT_UNRESOLVED' : 'LOCAL_CATALOG_MATCHED')
      ),
      constraintClass: goal ? 'COMMUNITY_OBSERVED' : 'USER_OPTIONAL',
      requirementLevel: goal ? 'RECOMMENDED' : requirementLevel(source.requirementLevel, 'OPTIONAL'),
      hard: false,
      evidenceStatus: text(
        source.evidenceStatus ?? source.sourceStatus,
        goal ? 'COMMUNITY_GOAL_SCHEDULE' : 'USER_RECORDED_TURN_LOCAL_CATALOG'
      )
    };
  }

  function raceAptitudeAssessment(card = {}, rawRace = {}) {
    const race = normalizeScheduleRace(rawRace, isGoalRace(rawRace) ? 'goal-race' : 'optional-race');
    const aptitude = Array.isArray(card?.aptitude) ? card.aptitude : [];
    const surfaceIndex = race.groundType === 1 ? 0 : race.groundType === 2 ? 1 : null;
    const distanceIndex = race.distanceType && race.distanceType >= 1 && race.distanceType <= 4
      ? race.distanceType + 1
      : null;
    const surfaceRank = surfaceIndex === null ? '' : text(aptitude[surfaceIndex]);
    const distanceRank = distanceIndex === null ? '' : text(aptitude[distanceIndex]);
    const rankValue = rank => ({ S: 7, A: 6, B: 5, C: 4, D: 3, E: 2, F: 1, G: 0 })[rank] ?? null;
    const checks = [
      surfaceIndex === null ? null : { axis: race.groundType === 2 ? 'dirt' : 'turf', kind: 'surface', rank: surfaceRank },
      distanceIndex === null ? null : {
        axis: ({ 1: 'short', 2: 'mile', 3: 'medium', 4: 'long' })[race.distanceType],
        kind: 'distance',
        rank: distanceRank
      }
    ].filter(Boolean).map(row => ({ ...row, value: rankValue(row.rank) }));
    const unknown = checks.filter(row => row.value === null);
    const risky = checks.filter(row => row.value !== null && row.value < rankValue('B'));
    return {
      surfaceRank: surfaceRank || null,
      distanceRank: distanceRank || null,
      checks,
      requiredRedKeys: risky.map(row => row.axis),
      status: unknown.length
        ? 'UNVERIFIED'
        : risky.length
          ? 'READY_WITH_TRADEOFFS'
          : 'READY',
      evidenceStatus: aptitude.length >= 6 ? 'LOCAL_CHARACTER_CATALOG' : 'APTITUDE_DATA_MISSING'
    };
  }

  function findRaceScheduleWindows(races = [], rawOptions = {}) {
    const minimumTurn = Math.max(1, Math.trunc(number(rawOptions.minimumTurn, 1)));
    const maximumTurn = Math.max(minimumTurn, Math.trunc(number(rawOptions.maximumTurn, 72)));
    const buffer = Math.max(0, Math.trunc(number(rawOptions.bufferTurns, 1)));
    const occupied = new Set((Array.isArray(races) ? races : [])
      .map(row => number(row?.turn))
      .filter(Number.isFinite)
      .map(Math.trunc));
    const safeTurns = [];
    for (let turn = minimumTurn; turn <= maximumTurn; turn += 1) {
      let safe = !occupied.has(turn);
      for (let offset = 1; safe && offset <= buffer; offset += 1) {
        safe = !occupied.has(turn - offset) && !occupied.has(turn + offset);
      }
      if (safe) safeTurns.push(turn);
    }
    const windows = [];
    for (const turn of safeTurns) {
      const previous = windows.at(-1);
      if (previous && turn === previous.to + 1) {
        previous.to = turn;
        previous.length += 1;
      } else {
        windows.push({ from: turn, to: turn, length: 1 });
      }
    }
    return windows
      .map(window => ({
        ...window,
        status: 'ADVISORY_WINDOW',
        evidenceStatus: 'TURN_DENSITY_ONLY_NO_RACE_CALENDAR'
      }))
      .sort((left, right) => right.length - left.length || left.from - right.from);
  }

  function analyzeRaceSchedule(input = {}) {
    const includeGoalRaces = input.includeGoalRaces !== false;
    const rawGoals = input.goalSchedule?.goals ?? input.goalRaces ?? [];
    const goals = includeGoalRaces
      ? (Array.isArray(rawGoals) ? rawGoals : []).map(row => normalizeScheduleRace(row, 'goal-race'))
      : [];
    const optionalRaces = (Array.isArray(input.optionalRaces) ? input.optionalRaces : [])
      .map(row => normalizeScheduleRace(row, 'optional-race'));
    const unplacedRows = [...goals, ...optionalRaces].filter(row => row.turn === null);
    const races = [...goals, ...optionalRaces]
      .filter(row => row.turn !== null)
      .sort((left, right) => left.turn - right.turn || Number(left.isGoalRace) - Number(right.isGoalRace));
    const turnGroups = new Map();
    races.forEach(row => {
      const key = String(row.turn);
      if (!turnGroups.has(key)) turnGroups.set(key, []);
      turnGroups.get(key).push(row);
    });
    const collisions = [...turnGroups.entries()]
      .filter(([, rows]) => rows.length > 1)
      .map(([turn, rows]) => ({
        code: 'TURN_COLLISION',
        turn: Number(turn),
        requirementLevel: 'RULE_REQUIRED',
        constraintClass: 'LOCAL_ENGINE_INVARIANT',
        evidenceStatus: 'DETERMINISTIC_TURN_COLLISION',
        races: rows,
        message: `第 ${turn} 回合排了 ${rows.length} 場賽事；同一回合只能保留一場。`
      }));
    const density = evaluateRaceDensity(races, input.raceDensityPolicy);
    const aptitudeRows = races.map(row => ({
      ...row,
      aptitudeAssessment: raceAptitudeAssessment(input.card, row)
    }));
    const aptitudeTradeoffs = aptitudeRows
      .filter(row => row.aptitudeAssessment.status === 'READY_WITH_TRADEOFFS')
      .map(row => ({
        code: 'LOW_NATIVE_APTITUDE',
        turn: row.turn,
        raceId: row.id,
        requirementLevel: 'RECOMMENDED',
        requiredRedKeys: row.aptitudeAssessment.requiredRedKeys,
        message: `第 ${row.turn} 回合「${row.nameZhTw || row.nameJp || '未命名賽事'}」的原生適性低於 B；可保留，但要承擔勝負與育成穩定度風險。`
      }));
    const unmappedGoals = goals.filter(row => row.mappingStatus !== 'LOCAL_CATALOG_MATCHED');
    const unknownAptitude = aptitudeRows.filter(row => row.aptitudeAssessment.status === 'UNVERIFIED');
    const densityTradeoffs = density.costly.map(row => ({
      code: 'CONSECUTIVE_OPTIONAL_RACE_COST',
      turn: row.turn,
      requirementLevel: 'RECOMMENDED',
      cost: row.densityCost,
      message: `第 ${row.turn} 回合形成第 ${row.consecutiveRaceCount} 場連戰；這是可接受但需明示的軟成本。`
    }));
    const tradeoffs = [...densityTradeoffs, ...aptitudeTradeoffs];
    const warnings = [
      ...unmappedGoals.map(row => ({
        code: 'GOAL_RACE_MAPPING_UNVERIFIED',
        turn: row.turn,
        requirementLevel: 'RECOMMENDED',
        message: `第 ${row.turn} 回合目標賽只有社群名稱或非唯一對應；不把它當成本地賽事證據。`
      })),
      ...unknownAptitude.map(row => ({
        code: 'RACE_APTITUDE_UNVERIFIED',
        turn: row.turn,
        requirementLevel: 'RECOMMENDED',
        message: `第 ${row.turn} 回合賽事缺少完整場地／距離或角色適性資料。`
      })),
      ...unplacedRows.map(row => ({
        code: 'RACE_TURN_UNVERIFIED',
        turn: null,
        raceId: row.id,
        requirementLevel: row.requirementLevel || 'RECOMMENDED',
        constraintClass: row.constraintClass,
        message: `「${row.nameZhTw || row.nameJp || '未命名賽事'}」缺少回合；保留為未排入資料，不參與衝突、連戰或窗口計算。`
      }))
    ];
    const terminalBoundaries = (Array.isArray(input.goalSchedule?.terminalTurns)
      ? input.goalSchedule.terminalTurns
      : [])
      .map(turn => number(turn))
      .filter(Number.isFinite)
      .map(turn => ({
        turn,
        kind: 'TERMINAL_BOUNDARY',
        constraintClass: 'COMMUNITY_OBSERVED_BOUNDARY',
        scoreIncluded: false,
        evidenceStatus: 'COMMUNITY_GOAL_SCHEDULE_DISPLAY_ONLY'
      }));
    const planningWindows = findRaceScheduleWindows(races, input.windowPolicy);
    const sensitivity = collisions.length
      ? { key: 'turn-collision', label: '同回合衝突', detail: '先移除或改期其中一場，否則路線不可執行。' }
      : densityTradeoffs.length
        ? { key: 'optional-turns', label: '可選賽回合', detail: '移動一場可選賽，可能直接解除三／四連戰成本。' }
        : aptitudeTradeoffs.length
          ? { key: 'native-aptitude', label: '原生適性', detail: '低適性賽事是否保留，最影響周回穩定度；紅因子只是規劃，並非保證。' }
          : unmappedGoals.length
            ? { key: 'goal-mapping', label: '社群目標賽對應', detail: '名稱未唯一對應前，不應用本地賽事欄位推導更多結論。' }
            : optionalRaces.length
              ? { key: 'optional-race-value', label: '可選賽價值', detail: '目前只評估可執行性，尚未替可選賽計算因子掉落或勝率。' }
              : { key: 'optional-races-empty', label: '尚未輸入加賽', detail: '只有必跑節點時，只能找空檔，不能推測你真正想刷的 G1。' };
    const status = collisions.length
      ? 'BLOCKED'
      : tradeoffs.length || warnings.length
        ? 'READY_WITH_TRADEOFFS'
        : (!input.card || (includeGoalRaces && !input.goalSchedule))
          ? 'UNVERIFIED'
          : 'READY';
    return {
      schemaVersion: 1,
      status,
      probabilityStatus: 'NOT_COMPUTED',
      scoreIncluded: false,
      includeGoalRaces,
      goals,
      optionalRaces,
      races: aptitudeRows,
      unplacedRows,
      terminalBoundaries,
      blockers: collisions,
      tradeoffs,
      warnings,
      density,
      planningWindows,
      sensitivity,
      evidenceStatus: optionalRaces.length
        ? 'MIXED_COMMUNITY_GOALS_USER_TURNS_LOCAL_CATALOG'
        : 'COMMUNITY_GOALS_AND_LOCAL_CHARACTER_CATALOG'
    };
  }

  function analyzeManualLineageSchedules(input = {}) {
    const slotIds = Array.isArray(input.slotIds) && input.slotIds.length
      ? input.slotIds.map(value => text(value)).filter(Boolean)
      : ['target', 'parentA', 'parentB', 'parentA1', 'parentA2', 'parentB1', 'parentB2'];
    const slots = input.slots && typeof input.slots === 'object' ? input.slots : {};
    const bySlot = Object.fromEntries(slotIds.map(slotId => {
      const slot = slots[slotId] || {};
      if (!slot.card) {
        return [slotId, {
          schemaVersion: 1,
          slotId,
          status: 'EMPTY',
          probabilityStatus: 'NOT_COMPUTED',
          scoreIncluded: false,
          blockers: [],
          tradeoffs: [],
          warnings: [],
          races: [],
          unplacedRows: [],
          terminalBoundaries: []
        }];
      }
      return [slotId, {
        slotId,
        ...analyzeRaceSchedule({
          card: slot.card,
          goalSchedule: slot.goalSchedule,
          optionalRaces: slot.optionalRaces,
          includeGoalRaces: input.includeGoalRaces,
          raceDensityPolicy: input.raceDensityPolicy,
          windowPolicy: input.windowPolicy
        })
      }];
    }));
    const parentSlotIds = slotIds.filter(slotId => slotId !== 'target');
    const sharedCounts = new Map();
    parentSlotIds.forEach(slotId => {
      const uniqueIds = new Set((bySlot[slotId]?.races || [])
        .filter(row => Number(row.grade) === 100)
        .filter(row => row.mappingStatus === 'LOCAL_CATALOG_MATCHED')
        .map(row => number(row.catalogRaceId))
        .filter(Number.isFinite));
      uniqueIds.forEach(catalogRaceId => {
        if (!sharedCounts.has(catalogRaceId)) sharedCounts.set(catalogRaceId, []);
        sharedCounts.get(catalogRaceId).push(slotId);
      });
    });
    const sharedG1Drafts = [...sharedCounts.entries()]
      .filter(([, sourceSlotIds]) => sourceSlotIds.length >= 2)
      .map(([catalogRaceId, sourceSlotIds]) => ({
        catalogRaceId,
        sourceSlotIds,
        slotCount: sourceSlotIds.length,
        status: 'PROJECTED_ONLY',
        scoreIncluded: false,
        evidenceStatus: 'PLANNED_OR_COMMUNITY_SCHEDULE_NOT_CONFIRMED_WIN'
      }))
      .sort((left, right) => right.slotCount - left.slotCount || left.catalogRaceId - right.catalogRaceId);
    const rows = Object.values(bySlot);
    const status = rows.some(row => row.status === 'BLOCKED')
      ? 'BLOCKED'
      : rows.some(row => row.status === 'READY_WITH_TRADEOFFS')
        ? 'READY_WITH_TRADEOFFS'
        : rows.every(row => row.status === 'EMPTY')
          ? 'EMPTY'
          : rows.some(row => ['EMPTY', 'UNVERIFIED'].includes(row.status))
            ? 'READY_WITH_WARNINGS'
            : 'READY';
    return {
      schemaVersion: 1,
      bySlot,
      familySummary: {
        status,
        sharedG1Drafts,
        incompleteSlots: rows.filter(row => ['EMPTY', 'UNVERIFIED'].includes(row.status)).map(row => row.slotId),
        probabilityStatus: 'NOT_COMPUTED',
        scoreIncluded: false
      }
    };
  }

  function annotateNearTies(rows = [], rawOptions = {}) {
    const scoreKey = text(rawOptions.scoreKey, 'score');
    const risk = normalizeRiskProfile(rawOptions.riskProfile, rawOptions.riskProfiles);
    const toleranceRatio = clamp(
      number(rawOptions.toleranceRatio, risk.nearTieToleranceRatio),
      0,
      1
    );
    const scores = rows.map(row => number(row?.[scoreKey]));
    const finiteScores = scores.filter(Number.isFinite);
    if (!finiteScores.length) return rows.map(row => ({ ...row, nearTie: false, nearTieStatus: 'SCORE_UNVERIFIED' }));
    const topScore = Math.max(...finiteScores);
    return rows.map((row, index) => {
      const score = scores[index];
      if (!Number.isFinite(score)) return { ...row, nearTie: false, nearTieStatus: 'SCORE_UNVERIFIED' };
      const gap = Math.max(0, topScore - score);
      const denominator = Math.max(1, Math.abs(topScore), Math.abs(score));
      const gapRatio = gap / denominator;
      const reference = gap === 0;
      const nearTie = !reference && gapRatio <= toleranceRatio;
      return {
        ...row,
        nearTie,
        nearTieReference: reference,
        nearTieStatus: reference ? 'REFERENCE' : (nearTie ? 'WITHIN_TRADEOFF_BUDGET' : 'OUTSIDE_TRADEOFF_BUDGET'),
        nearTieGap: gap,
        nearTieGapRatio: gapRatio,
        nearTieToleranceRatio: toleranceRatio,
        nearTieEvidenceStatus: 'DETERMINISTIC_SENSITIVITY_NOT_PROBABILITY'
      };
    });
  }

  function evaluateExecutionPlan(input = {}) {
    const targetProfile = normalizeTargetProfile(input.targetProfile);
    const statAssessment = evaluateStatProfile(input.expectedStats, targetProfile);
    const blueFactorOptions = rankBlueFactorOptions(input.expectedStats, targetProfile, input.blueFactorStars || 3);
    const raceDensity = evaluateRaceDensity(input.races, input.raceDensityPolicy);
    const blockers = [...statAssessment.blockers];
    const tradeoffs = [
      ...statAssessment.tradeoffs.map(row => ({
        code: 'STAT_BELOW_TARGET',
        axis: row.axis,
        gap: row.targetGap,
        message: `${row.label}距目標仍差 ${Math.round(row.targetGap)}。`
      })),
      ...raceDensity.costly.map(row => ({
        code: 'CONSECUTIVE_OPTIONAL_RACE_COST',
        turn: row.turn,
        cost: row.densityCost,
        message: `第 ${row.turn} 回合為第 ${row.consecutiveRaceCount} 場連戰；保留為可接受的賽程成本。`
      }))
    ];
    return {
      schemaVersion: 1,
      targetProfile,
      riskProfile: normalizeRiskProfile(input.riskProfile, input.riskProfiles),
      statAssessment,
      blueFactorOptions,
      raceDensity,
      blockers,
      tradeoffs,
      status: blockers.length
        ? 'BLOCKED'
        : tradeoffs.length
          ? 'READY_WITH_TRADEOFFS'
          : ['UNVERIFIED', 'UNCONFIGURED'].includes(statAssessment.status)
            ? statAssessment.status
            : 'READY',
      probabilityStatus: 'NOT_COMPUTED',
      scoreIncluded: false,
      evidenceStatus: targetProfile.sourceStatus
    };
  }

  return {
    STAT_AXES,
    BLUE_FACTOR_GAIN,
    DEFAULT_RISK_PROFILES,
    normalizeTargetProfile,
    normalizeRiskProfile,
    effectiveGain,
    statUtility,
    evaluateStatProfile,
    blueFactorGain,
    evaluateBlueFactorMarginal,
    rankBlueFactorOptions,
    evaluateRaceDensity,
    scheduleForCharacter,
    distanceTypeFromMeters,
    normalizeScheduleRace,
    raceAptitudeAssessment,
    findRaceScheduleWindows,
    analyzeRaceSchedule,
    analyzeManualLineageSchedules,
    annotateNearTies,
    evaluateExecutionPlan
  };
});
