(function (root, factory) {
  const courseCore = typeof module !== 'undefined' && module.exports
    ? require('./course-core.js')
    : root?.COURSE_CORE;
  const skillCore = typeof module !== 'undefined' && module.exports
    ? require('./skill-core.js')
    : root?.SKILL_CORE;
  const skillImpactCore = typeof module !== 'undefined' && module.exports
    ? require('./skill-impact-core.js')
    : root?.SKILL_IMPACT_CORE;
  const api = factory(courseCore, skillCore, skillImpactCore);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BATTLE_HORSE_RANKING_CORE = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (
  courseCore,
  skillCore,
  skillImpactCore
) {
  'use strict';

  const TARGET_FIELDS = [
    'server',
    'eventMode',
    'courseId',
    'surface',
    'distanceType',
    'distanceM',
    'runningStyle',
    'objective'
  ];

  const APTITUDE_ORDER = {
    UNKNOWN: -1,
    G: 0,
    F: 1,
    E: 2,
    D: 3,
    C: 4,
    B: 5,
    A: 6,
    S: 7
  };

  const TERMINAL_ORDER = {
    UNKNOWN: 0,
    NONE: 1,
    SUPPORT: 2,
    CORE: 3
  };

  const DEPTH_ORDER = {
    UNKNOWN: 0,
    SHALLOW: 1,
    ONE_EDGE: 2,
    TWO_PHASE: 3,
    FULL: 4
  };

  const SPECIFICITY_ORDER = {
    NONE: 0,
    GENERAL: 1,
    GEOMETRY_ALIGNED: 2,
    EXACT_TARGET: 3
  };

  const TIER_ORDER = {
    BENCHMARK_ONLY: 0,
    UNKNOWN: 1,
    MANUAL_ONLY: 2,
    CONDITIONAL: 3,
    STRATEGIC: 4,
    RECOMMENDED: 5
  };

  // Policy thresholds are deliberately exposed as facts of this planner, not
  // as activation probabilities or win-rate estimates.
  const PHASE_CONTROL_POLICY = Object.freeze({
    kind: 'policy_threshold',
    note: 'control-strength policy thresholds; not probability, activation rate, or win rate',
    start: Object.freeze({ type31CoreMin: 4000 }),
    mid: Object.freeze({
      type27CoreMin: 3500,
      type22CoreMin: 2500,
      type31CoreMin: 4000
    }),
    finish: Object.freeze({ coreSource: 'record.terminalLaunch===CORE' })
  });

  // This is a public explanation of the comparator below. Keep it data-only
  // so the UI can render the same order without maintaining a second copy.
  const SCORING_ORDER = Object.freeze([
    Object.freeze({ key: 'eligibility', direction: 'gate', role: 'hard_gate' }),
    Object.freeze({ key: 'recommendationTier', direction: 'desc', role: 'lexicographic' }),
    Object.freeze({ key: 'dimensions.terminalLaunch', direction: 'desc', role: 'lexicographic' }),
    Object.freeze({ key: 'dimensions.packageDepth', direction: 'desc', role: 'lexicographic' }),
    Object.freeze({ key: 'dimensions.terminalEffectReference', direction: 'desc', role: 'lexicographic' }),
    Object.freeze({ key: 'dimensions.courseSpecific', direction: 'desc', role: 'lexicographic' }),
    Object.freeze({ key: 'dimensions.startControl', direction: 'desc', role: 'lexicographic' }),
    Object.freeze({ key: 'dimensions.midRaceControl', direction: 'desc', role: 'lexicographic' }),
    Object.freeze({ key: 'dimensions.finishControl', direction: 'desc', role: 'lexicographic' }),
    Object.freeze({ key: 'dimensions.conditionBurden', direction: 'desc', role: 'lexicographic' }),
    Object.freeze({ key: 'dimensions.offStyleWasteCount', direction: 'asc', role: 'lexicographic' }),
    Object.freeze({ key: 'aptitude', direction: 'desc', role: 'lexicographic' }),
    Object.freeze({ key: 'outfitId', direction: 'asc', role: 'deterministic_tiebreak' })
  ]);

  function scoringOrder() {
    return SCORING_ORDER.map(item => ({ ...item }));
  }

  function availabilityCanResolve(availability) {
    return availability === 'AVAILABLE' || availability === 'NOT_REQUIRED';
  }

  const DYNAMIC_FIELDS = new Set([
    'order',
    'order_rate',
    'is_overtake',
    'bashin_diff_behind',
    'change_order_onetime',
    'overtake_target_time',
    'overtake_target_no_order_up_time',
    'blocked_front_continuetime',
    'blocked_side_continuetime',
    'running_style_count_same_rate',
    'infront_near_lane_time',
    'infront_near_lane_count',
    'surrounded_time',
    'is_behind',
    'compete_time',
    'activate_count_start',
    'activate_count_middle',
    'activate_count_end',
    'activate_count_heal',
    'change_order_up_end_after',
    'skill_count'
  ]);

  function isDynamicBurdenField(field) {
    return DYNAMIC_FIELDS.has(field)
      || /^(activate_count_|change_order_|blocked_|bashin_diff_|overtake_|running_style_count_|infront_|surrounded_|compete_)/.test(field);
  }

  function finiteNumber(value) {
    if (typeof value === 'boolean' || value == null) return null;
    if (typeof value === 'string' && !value.trim()) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function normalizedToken(value) {
    return typeof value === 'string'
      ? value.trim().toLowerCase().replace(/[\s_-]+/g, '')
      : value;
  }

  function normalizeServer(value) {
    const number = finiteNumber(value);
    if (number === 1) return 'zh_tw';
    if (number === 2) return 'jp';
    const token = normalizedToken(value);
    const aliases = {
      zh_tw: 'zh_tw',
      zhtw: 'zh_tw',
      tw: 'zh_tw',
      taiwan: 'zh_tw',
      '繁中': 'zh_tw',
      '繁體中文': 'zh_tw',
      jp: 'jp',
      ja: 'jp',
      japan: 'jp',
      日服: 'jp'
    };
    return aliases[token] || null;
  }

  function normalizeEventMode(value) {
    const number = finiteNumber(value);
    if (number === 1) return 'cm';
    if (number === 2) return 'loh';
    const token = normalizedToken(value);
    const aliases = {
      cm: 'cm',
      championsmeeting: 'cm',
      champions: 'cm',
      巔峰杯: 'cm',
      巔峰賽: 'cm',
      loh: 'loh',
      leagueofheroes: 'loh',
      英雄杯: 'loh',
      英雄賽: 'loh'
    };
    return aliases[token] || null;
  }

  function normalizeSurface(value) {
    const number = finiteNumber(value);
    if (number === 1) return 'turf';
    if (number === 2) return 'dirt';
    const token = normalizedToken(value);
    const aliases = {
      turf: 'turf',
      grass: 'turf',
      lawn: 'turf',
      芝: 'turf',
      草: 'turf',
      草地: 'turf',
      turftrack: 'turf',
      dirt: 'dirt',
      sand: 'dirt',
      dirttrack: 'dirt',
      砂: 'dirt',
      砂地: 'dirt'
    };
    return aliases[token] || null;
  }

  function normalizeDistanceType(value) {
    const number = finiteNumber(value);
    if (number === 1) return 'short';
    if (number === 2) return 'mile';
    if (number === 3) return 'medium';
    if (number === 4) return 'long';
    const token = normalizedToken(value);
    const aliases = {
      short: 'short',
      sprint: 'short',
      短: 'short',
      短距離: 'short',
      mile: 'mile',
      miles: 'mile',
      一哩: 'mile',
      哩: 'mile',
      英里: 'mile',
      medium: 'medium',
      middle: 'medium',
      mid: 'medium',
      中: 'medium',
      中距離: 'medium',
      long: 'long',
      長: 'long',
      長距離: 'long'
    };
    return aliases[token] || null;
  }

  function normalizeRunningStyle(value) {
    const number = finiteNumber(value);
    if (number === 1) return 'runner';
    if (number === 2) return 'leader';
    if (number === 3) return 'betweener';
    if (number === 4) return 'chaser';
    const token = normalizedToken(value);
    const aliases = {
      runner: 'runner',
      frontrunner: 'runner',
      frontrunner: 'runner',
      escape: 'runner',
      逃げ: 'runner',
      領頭: 'runner',
      領跑: 'runner',
      大逃: 'runner',
      leader: 'leader',
     先行: 'leader',
      前列: 'leader',
      betweener: 'betweener',
      pace: 'betweener',
      差し: 'betweener',
      居中: 'betweener',
      chaser: 'chaser',
      closer: 'chaser',
      追込: 'chaser',
      後追: 'chaser'
    };
    return aliases[token] || null;
  }

  function normalizeObjective(value) {
    const number = finiteNumber(value);
    if (number === 1) return 'cm_winner_line';
    if (number === 2) return 'loh_score_line';
    const token = normalizedToken(value);
    const aliases = {
      cmwinnerline: 'cm_winner_line',
      cmwinner: 'cm_winner_line',
      cm: 'cm_winner_line',
      winnerline: 'cm_winner_line',
      cm_winner_line: 'cm_winner_line',
      lohscoreline: 'loh_score_line',
      lohscore: 'loh_score_line',
      loh: 'loh_score_line',
      loh_score_line: 'loh_score_line'
    };
    return aliases[token] || null;
  }

  function fieldValue(target, field) {
    const aliases = {
      server: ['server', 'targetServer', 'serverId'],
      eventMode: ['eventMode', 'mode', 'event_mode'],
      courseId: ['courseId', 'course_id', 'course'],
      surface: ['surface', 'ground', 'terrain', 'groundSurface', 'groundType'],
      distanceType: ['distanceType', 'distance_type', 'distanceTypeCode'],
      distanceM: ['distanceM', 'distanceMeters', 'distance', 'course_distance', 'courseDistance'],
      runningStyle: ['runningStyle', 'running_style', 'style'],
      objective: ['objective', 'goal', 'targetObjective']
    };
    for (const key of aliases[field] || []) {
      if (target && Object.prototype.hasOwnProperty.call(target, key)) {
        const value = target[key];
        if (field === 'courseId' && value && typeof value === 'object') {
          return value.id ?? value.courseId;
        }
        return value;
      }
    }
    return undefined;
  }

  function targetFieldNormalizer(field, value) {
    if (field === 'server') return normalizeServer(value);
    if (field === 'eventMode') return normalizeEventMode(value);
    if (field === 'courseId' || field === 'distanceM') return finiteNumber(value);
    if (field === 'surface') return normalizeSurface(value);
    if (field === 'distanceType') return normalizeDistanceType(value);
    if (field === 'runningStyle') return normalizeRunningStyle(value);
    if (field === 'objective') return normalizeObjective(value);
    return null;
  }

  function makeTargetKey(target) {
    return TARGET_FIELDS.map(field => `${field}=${target?.[field]}`).join('|');
  }

  function normalizeTarget(input) {
    const raw = input || {};
    const target = {};
    const missing = [];
    const invalid = [];
    for (const field of TARGET_FIELDS) {
      const rawValue = fieldValue(raw, field);
      if (rawValue == null || (typeof rawValue === 'string' && !rawValue.trim())) {
        missing.push(field);
        continue;
      }
      const normalized = targetFieldNormalizer(field, rawValue);
      if (normalized == null || (field === 'courseId' && normalized <= 0) || (field === 'distanceM' && normalized <= 0)) {
        invalid.push({ field, value: rawValue });
        continue;
      }
      target[field] = normalized;
    }

    const errors = [
      ...missing.map(field => ({ code: 'MISSING_TARGET_FIELD', field })),
      ...invalid.map(item => ({ code: 'INVALID_TARGET_FIELD', ...item }))
    ];

    if (target.eventMode === 'cm' && target.objective !== 'cm_winner_line') {
      errors.push({
        code: 'EVENT_OBJECTIVE_MISMATCH',
        eventMode: target.eventMode,
        objective: target.objective
      });
    }
    if (target.eventMode === 'loh' && target.objective !== 'loh_score_line') {
      errors.push({
        code: 'EVENT_OBJECTIVE_MISMATCH',
        eventMode: target.eventMode,
        objective: target.objective
      });
    }

    const evidenceProfile = raw.evidenceProfile;
    const evidenceMismatches = [];
    if (evidenceProfile && typeof evidenceProfile === 'object') {
      const evidenceSource = evidenceProfile.target && typeof evidenceProfile.target === 'object'
        ? evidenceProfile.target
        : evidenceProfile;
      for (const field of TARGET_FIELDS) {
        const rawEvidence = fieldValue(evidenceSource, field);
        if (rawEvidence == null || (typeof rawEvidence === 'string' && !rawEvidence.trim())) continue;
        const normalizedEvidence = targetFieldNormalizer(field, rawEvidence);
        if (normalizedEvidence == null || target[field] == null || normalizedEvidence !== target[field]) {
          evidenceMismatches.push({
            field,
            targetValue: target[field] ?? null,
            evidenceValue: normalizedEvidence
          });
        }
      }
      if (evidenceMismatches.length) {
        errors.push(...evidenceMismatches.map(item => ({
          code: 'EVIDENCE_PROFILE_MISMATCH',
          ...item
        })));
      }
    }

    const status = errors.length ? 'BLOCKED' : 'READY';
    return {
      status,
      target: status === 'READY' ? target : null,
      normalized: status === 'READY' ? target : null,
      targetKey: status === 'READY' ? makeTargetKey(target) : null,
      missing,
      invalid,
      evidenceMismatches,
      errors
    };
  }

  function styleCode(style) {
    return { runner: 1, leader: 2, betweener: 3, chaser: 4 }[style] || null;
  }

  function distanceCode(distance) {
    return { short: 1, mile: 2, medium: 3, long: 4 }[distance] || null;
  }

  function surfaceCode(surface) {
    return { turf: 1, dirt: 2 }[surface] || null;
  }

  function buildTargetContext(target) {
    return {
      always: 1,
      course_distance: target?.distanceM,
      distance_type: distanceCode(target?.distanceType),
      ground_type: surfaceCode(target?.surface),
      running_style: styleCode(target?.runningStyle)
    };
  }

  function findCharacterCard(catalog, cardOrId) {
    if (cardOrId && typeof cardOrId === 'object') {
      const id = finiteNumber(cardOrId.outfitId ?? cardOrId.id ?? cardOrId.cardId);
      if (id != null) {
        return (catalog?.characterCards || []).find(item => Number(item.id) === id) || cardOrId;
      }
      return cardOrId;
    }
    const id = finiteNumber(cardOrId);
    return id == null
      ? null
      : (catalog?.characterCards || []).find(item => Number(item.id) === id) || null;
  }

  function findSkill(catalog, skillId) {
    const id = finiteNumber(skillId);
    if (id == null) return null;
    return (catalog?.skills || []).find(item => Number(item.id) === id) || null;
  }

  function uniqueSkillIdList(card) {
    return [...new Set((card?.uniqueSkillIds || [])
      .map(finiteNumber)
      .filter(id => id != null))];
  }

  function skillAvailability(skill, target) {
    if (target?.server !== 'zh_tw') return 'NOT_REQUIRED';
    if (!skill || !Object.prototype.hasOwnProperty.call(skill, 'availableOnServer')) {
      return 'UNKNOWN';
    }
    if (skill.availableOnServer === true) return 'AVAILABLE';
    if (skill.availableOnServer === false) return 'NOT_AVAILABLE';
    return 'UNKNOWN';
  }

  function emptyTimingEvidence(reason = 'skill-not-available') {
    return {
      windows: [],
      impact: {
        relativeEffectBashin: null,
        usefulTimingShare: null,
        source: reason,
        referenceNote: 'local course reference; not a probability, activation rate, or win-rate estimate'
      },
      effectTypes: [],
      maxType22: 0,
      maxType31: 0,
      fields: [],
      dynamicFields: [],
      earliestMeters: null,
      latestMeters: null,
      medianReference: null,
      riskReference: null
    };
  }

  function skillFamilyIds(skill) {
    return [...new Set([
      finiteNumber(skill?.familyId),
      ...(skill?.familyIds || []).map(finiteNumber)
    ].filter(id => id != null))];
  }

  function groupEffectTypes(group) {
    return [...new Set((group?.effects || [])
      .map(effect => finiteNumber(effect?.type))
      .filter(type => type != null))];
  }

  function groupEffectMaximum(variant, type, allowedGroupIndices) {
    const values = (variant?.conditionGroups || [])
      .flatMap((group, groupIndex) =>
        !allowedGroupIndices || allowedGroupIndices.has(groupIndex)
          ? group?.effects || []
          : []
      )
      .filter(effect => Number(effect?.type) === type)
      .map(effect => finiteNumber(effect?.value))
      .filter(value => value != null);
    return values.length ? Math.max(...values) : 0;
  }

  function conditionFields(variant) {
    return [...new Set((variant?.conditionGroups || [])
      .flatMap(group => [group?.precondition, group?.condition])
      .filter(Boolean)
      .flatMap(expression => skillCore?.expressionFields
        ? skillCore.expressionFields(expression)
        : [])
      .filter(Boolean))];
  }

  function overlapLength(interval, start, end) {
    return Math.max(0, Math.min(interval.end, end) - Math.max(interval.start, start));
  }

  function flattenWindows(variant, timeline, context) {
    if (!variant || !timeline || !skillImpactCore?.resolveActivationWindowsForGroup) return [];
    return (variant.conditionGroups || []).flatMap((group, groupIndex) =>
      (skillImpactCore.resolveActivationWindowsForGroup(group, timeline, context) || [])
        .map(window => ({
          ...window,
          groupIndex,
          conditionFields: [...new Set([
            ...[group?.precondition, group?.condition]
              .filter(Boolean)
              .flatMap(expression => skillCore?.expressionFields
                ? skillCore.expressionFields(expression)
                : []),
            ...(window.dynamicFields || []),
            ...(window.dynamicTimingFields || [])
          ])]
        }))
    );
  }

  function applicabilityForSkill(skill, context) {
    if (!skill || !skillCore?.evaluateSkillForContext) return 'UNKNOWN';
    const state = skillCore.evaluateSkillForContext(skill, context);
    if (state === skillCore.FALSE) return 'NOT_APPLICABLE';
    if (state === skillCore.TRUE) return 'APPLICABLE';
    return 'CONDITIONED_KNOWN';
  }

  function statusForSkill(skill, context, timeline) {
    const applicability = applicabilityForSkill(skill, context);
    if (applicability === 'NOT_APPLICABLE') return applicability;
    if (!skill || !timeline) return 'UNKNOWN';
    return applicability;
  }

  function compareImpact(left, right) {
    const l = left || {};
    const r = right || {};
    return (finiteNumber(r.riskAdjustedBashin) ?? -Infinity) - (finiteNumber(l.riskAdjustedBashin) ?? -Infinity)
      || (finiteNumber(r.expectedBashin) ?? -Infinity) - (finiteNumber(l.expectedBashin) ?? -Infinity);
  }

  function timingEvidence(skill, variant, target, timeline, context) {
    const windows = flattenWindows(variant, timeline, context);
    const impact = skillImpactCore?.analyzeVariant && timeline
      ? skillImpactCore.analyzeVariant(skill, variant, timeline, context)
      : null;
    const terminalStart = finiteNumber(timeline?.terminalStart);
    const distance = finiteNumber(timeline?.distance ?? target?.distanceM);
    const intervals = windows.flatMap(window => window.intervals || []);
    const totalLength = intervals.reduce((sum, item) => sum + Math.max(0, item.end - item.start), 0);
    const terminalLength = terminalStart == null || distance == null
      ? null
      : intervals.reduce((sum, item) => sum + overlapLength(item, terminalStart, distance), 0);
    const usefulTimingShare = totalLength > 0 && terminalLength != null
      ? Math.max(0, Math.min(1, terminalLength / totalLength))
      : null;
    const fields = [...new Set([
      ...conditionFields(variant),
      ...windows.flatMap(window => window.conditionFields || [])
    ])];
    const activeGroupIndices = new Set(windows.map(window => window.groupIndex));
    const activeEffectTypes = [...new Set(windows.flatMap(window =>
      groupEffectTypes((variant.conditionGroups || [])[window.groupIndex])
    ))];
    const maxType22 = groupEffectMaximum(variant, 22, activeGroupIndices);
    const maxType31 = groupEffectMaximum(variant, 31, activeGroupIndices);
    const earliestMeters = windows.length
      ? Math.min(...intervals.map(item => item.start).filter(Number.isFinite))
      : null;
    const latestMeters = windows.length
      ? Math.max(...intervals.map(item => item.end).filter(Number.isFinite))
      : null;
    return {
      windows: windows.map(window => ({
        groupIndex: Number.isInteger(window.groupIndex) ? window.groupIndex : null,
        intervals: (window.intervals || []).map(item => ({
          start: item.start,
          end: item.end,
          label: item.label || null
        })),
        distribution: window.distribution || null,
        conditionFields: window.conditionFields || [],
        effectTypes: groupEffectTypes((variant.conditionGroups || [])[window.groupIndex]),
        controlEffectTypes: groupEffectTypes((variant.conditionGroups || [])[window.groupIndex])
          .filter(type => [22, 27, 31].includes(type)),
        controlEffects: ((variant.conditionGroups || [])[window.groupIndex]?.effects || [])
          .map(effect => ({
            type: finiteNumber(effect?.type),
            value: finiteNumber(effect?.value)
          }))
          .filter(effect => [22, 27, 31].includes(effect.type) && effect.value != null),
        confidence: window.confidence || null
      })),
      impact: impact ? {
        relativeEffectBashin: finiteNumber(impact.expectedBashin),
        usefulTimingShare,
        source: impact.source || 'local-estimate',
        referenceNote: 'local course reference; not a probability, activation rate, or win-rate estimate'
      } : {
        relativeEffectBashin: null,
        usefulTimingShare,
        source: 'no-acceleration-analysis',
        referenceNote: 'local course reference; not a probability, activation rate, or win-rate estimate'
      },
      effectTypes: activeEffectTypes,
      maxType22,
      maxType31,
      fields,
      dynamicFields: fields.filter(isDynamicBurdenField),
      earliestMeters,
      latestMeters,
      medianReference: finiteNumber(impact?.medianBashin),
      riskReference: finiteNumber(impact?.riskAdjustedBashin)
    };
  }

  function classifyTerminal(skill, variant, applicability, evidence, timeline) {
    if (applicability === 'NOT_APPLICABLE') return 'NONE';
    if (!evidence || !timeline) return 'UNKNOWN';
    const terminalStart = finiteNumber(timeline.terminalStart);
    const hasTerminalType31Window = terminalStart != null
      && (evidence.windows || []).some(window => {
        if (!(window.effectTypes || []).includes(31)) return false;
        // A type-10 or activate_count_start window is explicitly an opening
        // control window. It must not be promoted to a terminal launch merely
        // because its interval happens to span the terminal section.
        const fields = new Set(window.conditionFields || []);
        if ((window.effectTypes || []).includes(10) || fields.has('activate_count_start')) {
          return false;
        }
        return (window.intervals || []).some(interval => {
          const start = finiteNumber(interval?.start);
          const end = finiteNumber(interval?.end);
          return start != null
            && end != null
            && start <= terminalStart + 100
            && end >= terminalStart;
        });
      });
    const accelerationCore = evidence.maxType31 > 0
      && (evidence.medianReference ?? -Infinity) >= 0.25
      && (evidence.riskReference ?? -Infinity) >= 0.25
      && hasTerminalType31Window;
    const forwardCore = evidence.maxType22 >= 2500
      && terminalStart != null
      && evidence.windows.some(window => {
        const starts = (window.intervals || [])
          .map(interval => interval.start)
          .filter(Number.isFinite);
        if (!starts.length || !(window.effectTypes || []).includes(22)) return false;
        const earliest = Math.min(...starts);
        return earliest >= terminalStart - 100 && earliest <= terminalStart + 100;
      });
    if (accelerationCore || forwardCore) return 'CORE';
    if (evidence.maxType31 > 0 || evidence.maxType22 > 0) return 'SUPPORT';
    return 'NONE';
  }

  function phaseEvidenceForRecord(record, timeline) {
    const windows = (record?.timing?.windows || [])
      .filter(window => (window.controlEffectTypes || []).length);
    const terminalStart = finiteNumber(timeline?.terminalStart);
    const makePhase = () => ({
      effects: new Set(),
      maxValues: {},
      sourceSkillIds: new Set()
    });
    const phaseEffects = { start: makePhase(), mid: makePhase(), finish: makePhase() };
    if (!windows.length || terminalStart == null) return phaseEffects;
    const startEnd = Math.min(400, terminalStart / 3);
    const classifyPoint = point => point < startEnd
      ? 'start'
      : point < terminalStart
        ? 'mid'
        : 'finish';
    for (const window of windows) {
      const effectTypes = new Set(window.controlEffectTypes || []);
      const fields = new Set(window.conditionFields || []);
      let resolvedPhase = null;
      if ((window.effectTypes || []).includes(10) || fields.has('activate_count_start')) {
        resolvedPhase = 'start';
      } else if (fields.has('activate_count_middle')) {
        resolvedPhase = 'mid';
      }
      if (resolvedPhase) {
        const bucket = phaseEffects[resolvedPhase];
        for (const type of effectTypes) bucket.effects.add(type);
        for (const effect of window.controlEffects || []) {
          if (!effectTypes.has(effect.type) || !Number.isFinite(effect.value)) continue;
          bucket.maxValues[effect.type] = Math.max(
            bucket.maxValues[effect.type] ?? -Infinity,
            effect.value
          );
          if (record.skillId != null) bucket.sourceSkillIds.add(record.skillId);
        }
        continue;
      }
      const intervals = (window.intervals || []).filter(item =>
        Number.isFinite(item.start) && Number.isFinite(item.end) && item.end > item.start
      );
      if (!intervals.length) continue;
      const isUnanchoredAlways = fields.size > 0
        && [...fields].every(field => field === 'always');
      const courseDistance = finiteNumber(timeline?.distance);
      const isUnanchoredFullCourse = courseDistance != null
        && intervals.length === 1
        && intervals[0].start <= 0
        && intervals[0].end >= courseDistance;
      if (isUnanchoredAlways || isUnanchoredFullCourse) continue;
      const possiblePhases = new Set();
      if (window.distribution === 'first-valid-point') {
        possiblePhases.add(classifyPoint(Math.min(...intervals.map(item => item.start))));
      } else {
        for (const interval of intervals) {
          const startPhase = classifyPoint(interval.start);
          const endPhase = classifyPoint(Math.max(interval.start, interval.end - 1e-6));
          possiblePhases.add(startPhase);
          possiblePhases.add(endPhase);
        }
      }
      // A random skill that can land in several phases is one activation, not
      // several independent pieces of phase coverage.  Keep it diagnostic-only
      // for package depth instead of crediting every intersected segment.
      if (possiblePhases.size !== 1) continue;
      const [phase] = possiblePhases;
      const bucket = phaseEffects[phase];
      for (const type of effectTypes) bucket.effects.add(type);
      for (const effect of window.controlEffects || []) {
        if (!effectTypes.has(effect.type) || !Number.isFinite(effect.value)) continue;
        bucket.maxValues[effect.type] = Math.max(
          bucket.maxValues[effect.type] ?? -Infinity,
          effect.value
        );
        if (record.skillId != null) bucket.sourceSkillIds.add(record.skillId);
      }
    }
    return phaseEffects;
  }

  function phaseForRecord(record, timeline) {
    const phaseEffects = phaseEvidenceForRecord(record, timeline);
    return {
      start: phaseEffects.start.effects.size > 0,
      mid: phaseEffects.mid.effects.size > 0,
      finish: phaseEffects.finish.effects.size > 0
    };
  }

  function controlDimension(records, timeline, phaseName) {
    const relevant = records
      .map(record => ({ record, evidence: phaseEvidenceForRecord(record, timeline)[phaseName] }))
      .filter(item => item.evidence.effects.size > 0);
    if (!relevant.length) {
      const unknown = records.some(record => record.applicability === 'UNKNOWN');
      return {
        enabled: unknown ? null : false,
        tier: unknown ? 'UNKNOWN' : 'NONE',
        maxValues: {},
        sourceSkillIds: []
      };
    }
    const maxValues = {};
    const sourceSkillIds = new Set();
    for (const item of relevant) {
      for (const [type, value] of Object.entries(item.evidence.maxValues || {})) {
        maxValues[type] = Math.max(maxValues[type] ?? -Infinity, value);
      }
      for (const skillId of item.evidence.sourceSkillIds || []) sourceSkillIds.add(skillId);
    }
    const type22 = maxValues[22] ?? -Infinity;
    const type27 = maxValues[27] ?? -Infinity;
    const type31 = maxValues[31] ?? -Infinity;
    const core = phaseName === 'start'
      ? type31 >= PHASE_CONTROL_POLICY.start.type31CoreMin
      : phaseName === 'mid'
        ? type27 >= PHASE_CONTROL_POLICY.mid.type27CoreMin
          || type22 >= PHASE_CONTROL_POLICY.mid.type22CoreMin
          || type31 >= PHASE_CONTROL_POLICY.mid.type31CoreMin
        : relevant.some(item => item.record.terminalLaunch === 'CORE');
    return {
      enabled: true,
      tier: core ? 'CORE' : 'SUPPORT',
      maxValues,
      sourceSkillIds: [...sourceSkillIds].sort((left, right) => left - right)
    };
  }

  function courseSpecificity(records) {
    const targetFields = new Set(['distance_type', 'running_style', 'ground_type', 'course_distance']);
    let exact = false;
    let geometry = false;
    let general = false;
    for (const record of records) {
      const fields = new Set(record.timing.fields || []);
      const tags = new Set(record.skill?.tags || []);
      const hasTargetField = [...fields].some(field => targetFields.has(field));
      const hasGeometry = [...fields].some(field =>
        /phase|corner|straight|final|spurt|distance_rate|remain_distance/.test(field)
      );
      if (hasTargetField) exact = true;
      else if (hasGeometry) geometry = true;
      else if (record.applicability !== 'NOT_APPLICABLE' || tags.size) general = true;
    }
    if (exact) return 'EXACT_TARGET';
    if (geometry) return 'GEOMETRY_ALIGNED';
    if (general) return 'GENERAL';
    return records.some(record => record.applicability === 'UNKNOWN') ? 'NONE' : 'NONE';
  }

  function conditionBurden(records, target) {
    const winnerLineFields = target?.eventMode === 'cm' && target?.objective === 'cm_winner_line'
      ? new Set(['order', 'order_rate'])
      : new Set();
    const fields = new Set(records
      .flatMap(record => record.timing.dynamicFields || [])
      .filter(field => !winnerLineFields.has(field)));
    if (records.some(record => record.applicability === 'UNKNOWN')) return 'UNKNOWN';
    if (!fields.size) return 'LOW';
    if (fields.size <= 1) return 'LOW';
    if (fields.size <= 3) return 'MEDIUM';
    return 'HIGH';
  }

  function chooseBestAlternative(records, target, timeline) {
    return [...records].sort((left, right) => {
      const l = left.applicability === 'NOT_APPLICABLE' ? 0 : 1;
      const r = right.applicability === 'NOT_APPLICABLE' ? 0 : 1;
      return r - l
        || TERMINAL_ORDER[classifyTerminal(right.skill, right.variant, right.applicability, right.timing, timeline)]
          - TERMINAL_ORDER[classifyTerminal(left.skill, left.variant, left.applicability, left.timing, timeline)]
        || (right.timing.impact.relativeEffectBashin ?? -Infinity)
          - (left.timing.impact.relativeEffectBashin ?? -Infinity)
        || Number(left.skill?.id || 0) - Number(right.skill?.id || 0);
    })[0] || null;
  }

  function resolveBodyPackage(input, maybeCatalog, maybeTarget, maybeOptions) {
    const config = input && typeof input === 'object' && (
      Object.prototype.hasOwnProperty.call(input, 'card')
      || Object.prototype.hasOwnProperty.call(input, 'catalog')
      || Object.prototype.hasOwnProperty.call(input, 'target')
    )
      ? input
      : {
        card: input,
        catalog: maybeCatalog,
        target: maybeTarget,
        ...(maybeOptions || {})
      };
    const catalog = config.catalog || {};
    const card = findCharacterCard(catalog, config.card ?? config.outfitId ?? config.cardId);
    const targetResult = normalizeTarget(config.target || {});
    const target = targetResult.target;
    const context = target ? buildTargetContext(target) : {};
    const race = target ? {
      courseId: target.courseId,
      distance: target.distanceM,
      context
    } : {};
    const resolvedCourse = courseCore?.resolveCourse
      ? courseCore.resolveCourse(catalog, race)
      : { timeline: null };
    const timeline = resolvedCourse?.timeline || null;
    const cardEvidence = card ? 'CONFIRMED' : 'UNKNOWN';
    const uniqueIds = uniqueSkillIdList(card);
    const uniqueSkills = uniqueIds.map(id => ({ id, skill: findSkill(catalog, id) }));
    const stars = finiteNumber(config.stars ?? card?.stars);
    const selectedUniqueId = uniqueIds.length === 1
      ? uniqueIds[0]
      : uniqueIds.length > 1 && stars != null
        ? (stars >= 3 ? uniqueIds.at(-1) : uniqueIds[0])
        : null;
    const selectedUnique = selectedUniqueId == null
      ? null
      : uniqueSkills.find(item => item.id === selectedUniqueId && item.skill) || null;
    const active = [];
    const replaced = [];
    const notApplicable = [];
    const evidence = {
      catalog: cardEvidence,
      target: targetResult.status,
      courseGeometry: timeline?.geometryConfidence === 'catalog' ? 'CONFIRMED' : 'UNKNOWN',
      activeUnique: selectedUnique?.skill ? 'CONFIRMED' : uniqueIds.length ? 'UNKNOWN' : 'NONE',
      uniqueStars: uniqueIds.length <= 1
        ? 'NOT_REQUIRED'
        : stars == null
          ? 'UNKNOWN'
          : 'CONFIRMED',
      serverAvailability: target?.server === 'zh_tw' ? 'CONFIRMED' : 'NOT_REQUIRED',
      awakeningLevel: finiteNumber(config.awakeningLevel ?? card?.awakeningLevel) == null
        ? 'UNKNOWN'
        : 'CONFIRMED',
      evolution: 'CONFIRMED'
    };

    for (const item of uniqueSkills) {
      const availability = skillAvailability(item.skill, target);
      if (availability === 'UNKNOWN') evidence.serverAvailability = 'UNKNOWN';
      if (!item.skill) evidence.catalog = 'PARTIAL';
    }

    function addResolvedRecord(record) {
      if (!record || record.applicability === 'NOT_APPLICABLE' || !availabilityCanResolve(record.availability)) {
        if (record) notApplicable.push(record);
        return;
      }
      active.push(record);
    }

    function makeRecord(skill, kind, state, routeGroup) {
      const availability = skillAvailability(skill, target);
      if (availability === 'UNKNOWN') evidence.serverAvailability = 'UNKNOWN';
      const applicability = availability === 'NOT_AVAILABLE'
        ? 'NOT_APPLICABLE'
        : availability === 'UNKNOWN'
          ? 'UNKNOWN'
          : statusForSkill(skill, context, timeline);
      const timing = availabilityCanResolve(availability)
        ? timingEvidence(skill, skill, target, timeline, context)
        : emptyTimingEvidence(availability === 'UNKNOWN'
          ? 'skill-server-availability-unknown'
          : 'skill-not-available-on-server');
      const record = {
        skillId: finiteNumber(skill?.id),
        name: skill?.nameZhTw || skill?.name || null,
        kind,
        state: availability === 'NOT_AVAILABLE'
          ? 'NOT_AVAILABLE'
          : availability === 'UNKNOWN'
            ? 'UNKNOWN'
            : state,
        sourceKind: kind === 'unique' ? 'native-unique' : kind,
        canonicalFamilyIds: skillFamilyIds(skill),
        availability,
        applicability,
        timing,
        routeGroup: routeGroup || null,
        skill: {
          id: finiteNumber(skill?.id),
          tags: Array.isArray(skill?.tags) ? [...skill.tags] : []
        }
      };
      record.terminalLaunch = classifyTerminal(skill, skill, applicability, timing, timeline);
      return record;
    }

    if (selectedUnique) {
      const uniqueRecord = makeRecord(selectedUnique.skill, 'unique', 'ACTIVE', 'native-unique');
      addResolvedRecord(uniqueRecord);
      for (const item of uniqueSkills.filter(item => item.id !== selectedUnique.id)) {
        if (!item.skill) {
          evidence.catalog = 'PARTIAL';
          evidence.serverAvailability = 'UNKNOWN';
          continue;
        }
        replaced.push({
          skillId: item.id,
          name: item.skill.nameZhTw || item.skill.name || null,
          kind: 'unique',
          state: 'REPLACED',
          replacedBy: selectedUnique.id,
          canonicalFamilyIds: skillFamilyIds(item.skill),
          availability: skillAvailability(item.skill, target)
        });
      }
    } else if (uniqueIds.length) {
      evidence.activeUnique = 'UNKNOWN';
      for (const item of uniqueSkills) {
        const availability = skillAvailability(item.skill, target);
        notApplicable.push({
          skillId: item.id,
          name: item.skill?.nameZhTw || item.skill?.name || null,
          kind: 'unique',
          state: 'UNKNOWN',
          availability,
          applicability: 'UNKNOWN',
          canonicalFamilyIds: skillFamilyIds(item.skill)
        });
      }
    }

    const innateIds = [...new Set((card?.innateSkillIds || [])
      .map(finiteNumber)
      .filter(id => id != null))];
    const awakeningIds = [...new Set((card?.awakeningSkillIds || [])
      .map(finiteNumber)
      .filter(id => id != null))];
    const awakeningLevel = finiteNumber(config.awakeningLevel ?? card?.awakeningLevel);
    const unlockedAwakeningCount = awakeningLevel == null
      ? 0
      : Math.min(awakeningIds.length, Math.max(0, Math.floor(awakeningLevel) - 1));
    const unlockedAwakeningIds = awakeningIds.slice(0, unlockedAwakeningCount);
    const baseIds = [...new Set([...innateIds, ...unlockedAwakeningIds])];
    const evolutionGroups = new Map();
    for (const route of card?.evolvedSkills || []) {
      const oldId = finiteNumber(route?.old);
      const newId = finiteNumber(route?.new);
      if (oldId == null || newId == null) continue;
      if (!evolutionGroups.has(oldId)) evolutionGroups.set(oldId, []);
      evolutionGroups.get(oldId).push(newId);
    }

    const replacedOldIds = new Set();
    const replacedFamilyIds = new Set();
    const evolutionRecords = [];
    for (const [oldId, newIds] of evolutionGroups) {
      if (!baseIds.includes(oldId)) continue;
      const oldSkill = findSkill(catalog, oldId);
      const alternativeIds = [...new Set(newIds)];
      const alternatives = [];
      for (const newId of alternativeIds) {
        const newSkill = findSkill(catalog, newId);
        if (!newSkill) {
          evidence.catalog = 'PARTIAL';
          evidence.serverAvailability = 'UNKNOWN';
          continue;
        }
        alternatives.push(makeRecord(
          newSkill,
          'evolved',
          'SELECTABLE',
          `evolution:${oldId}`
        ));
      }
      if (!alternatives.length) {
        evidence.evolution = 'UNKNOWN';
        continue;
      }
      const availableAlternatives = alternatives.filter(item => availabilityCanResolve(item.availability));
      const unknownAlternatives = alternatives.filter(item => item.availability === 'UNKNOWN');
      if (unknownAlternatives.length) {
        evidence.evolution = 'UNKNOWN';
        evidence.serverAvailability = 'UNKNOWN';
      }
      // An evolved branch that is server-visible but inapplicable on this
      // target must not replace an otherwise usable old skill.  Availability
      // and target applicability are separate gates.
      const applicableAlternatives = availableAlternatives
        .filter(item => item.applicability !== 'NOT_APPLICABLE');
      const chosen = chooseBestAlternative(applicableAlternatives, target, timeline);
      const oldAvailability = skillAvailability(oldSkill, target);
      if (oldAvailability === 'UNKNOWN') {
        evidence.serverAvailability = 'UNKNOWN';
      }
      const retainOld = !chosen && oldAvailability === 'AVAILABLE';
      const route = {
        oldSkillId: oldId,
        oldFamilyIds: skillFamilyIds(oldSkill),
        alternatives: alternatives.map(item => ({
          skillId: item.skillId,
          applicability: item.applicability,
          terminalLaunch: item.terminalLaunch,
          availability: item.availability
        })),
        selectedSkillId: chosen?.skillId ?? null,
        state: chosen
          ? 'SELECTED'
          : retainOld
            ? 'OLD_RETAINED'
            : 'NO_AVAILABLE_SKILL'
      };
      evolutionRecords.push(route);
      if (chosen) {
        replacedOldIds.add(oldId);
        for (const familyId of skillFamilyIds(oldSkill)) replacedFamilyIds.add(familyId);
        replaced.push({
          skillId: oldId,
          name: oldSkill?.nameZhTw || oldSkill?.name || null,
          kind: 'awakening',
          state: 'REPLACED',
          replacedBy: chosen.skillId,
          canonicalFamilyIds: skillFamilyIds(oldSkill),
          availability: oldAvailability,
          routeGroup: `evolution:${oldId}`
        });
      }
      for (const item of alternatives) {
        if (chosen && item.skillId === chosen.skillId) addResolvedRecord(item);
        else notApplicable.push({
          ...item,
          state: item.skillId === chosen?.skillId ? 'NOT_APPLICABLE' : 'ALTERNATIVE_NOT_SELECTED',
          routeGroup: `evolution:${oldId}`
        });
      }
    }

    for (const id of baseIds) {
      const skill = findSkill(catalog, id);
      if (replacedOldIds.has(id) || skillFamilyIds(skill).some(familyId => replacedFamilyIds.has(familyId))) continue;
      if (!skill) {
        evidence.catalog = 'PARTIAL';
        evidence.serverAvailability = 'UNKNOWN';
        notApplicable.push({
          skillId: id,
          name: null,
          kind: innateIds.includes(id) ? 'innate' : 'awakening',
          state: 'UNKNOWN',
          availability: 'UNKNOWN',
          applicability: 'UNKNOWN',
          canonicalFamilyIds: []
        });
        continue;
      }
      const record = makeRecord(
        skill,
        innateIds.includes(id) ? 'innate' : 'awakening',
        'ACTIVE',
        null
      );
      addResolvedRecord(record);
    }

    const seenFamilies = new Set();
    const dedupedActive = active.filter(record => {
      const familyKey = record.canonicalFamilyIds.join(',') || `skill:${record.skillId}`;
      if (seenFamilies.has(familyKey)) return false;
      seenFamilies.add(familyKey);
      return true;
    });

    const distinctSkills = dedupedActive;
    const terminalRecords = distinctSkills.filter(record => record.terminalLaunch === 'CORE');
    const startControl = controlDimension(distinctSkills, timeline, 'start');
    const midRaceControl = controlDimension(distinctSkills, timeline, 'mid');
    const finishControl = controlDimension(distinctSkills, timeline, 'finish');
    // A verified terminal launch is the terminal CORE phase.  The depth
    // policy then counts only non-terminal CORE start/mid control; SUPPORT
    // phase coverage never upgrades package depth.
    const corePhaseCount = (terminalRecords.length ? 1 : 0)
      + [startControl.tier === 'CORE', midRaceControl.tier === 'CORE']
        .filter(Boolean).length;
    const packageDepth = timeline == null || !distinctSkills.length
      ? 'UNKNOWN'
      : terminalRecords.length && corePhaseCount >= 3
        ? 'FULL'
        : terminalRecords.length && corePhaseCount >= 2
          ? 'TWO_PHASE'
          : terminalRecords.length
            ? 'ONE_EDGE'
            : distinctSkills.length
              ? 'SHALLOW'
              : 'UNKNOWN';
    const terminalRelativeEffects = terminalRecords
      .map(record => finiteNumber(record.timing?.impact?.relativeEffectBashin))
      .filter(value => value != null);
    const terminalRiskReferences = terminalRecords
      .map(record => finiteNumber(record.timing?.riskReference))
      .filter(value => value != null);
    const offStyleWasteFamilies = new Set();
    for (const item of notApplicable) {
      if (item.applicability !== 'NOT_APPLICABLE' || item.routeGroup) continue;
      const familyKey = (item.canonicalFamilyIds || []).join(',') || `skill:${item.skillId}`;
      offStyleWasteFamilies.add(`base:${familyKey}`);
    }
    for (const route of evolutionRecords) {
      const serverResolvedAlternatives = route.alternatives.filter(alternative =>
        availabilityCanResolve(alternative.availability)
      );
      if (serverResolvedAlternatives.length > 0
        && serverResolvedAlternatives.every(alternative => alternative.applicability === 'NOT_APPLICABLE')) {
        offStyleWasteFamilies.add(`evolution:${route.oldSkillId}`);
      }
    }
    const offStyleWasteCount = offStyleWasteFamilies.size;
    const dimensions = {
      terminalLaunch: terminalRecords.length
        ? 'CORE'
        : distinctSkills.some(record => record.terminalLaunch === 'SUPPORT')
          ? 'SUPPORT'
          : distinctSkills.some(record => record.applicability === 'UNKNOWN')
            ? 'UNKNOWN'
            : 'NONE',
      startControl,
      midRaceControl,
      finishControl,
      courseSpecific: courseSpecificity(distinctSkills),
      conditionBurden: conditionBurden(distinctSkills, target),
      offStyleWasteCount,
      packageDepth,
      terminalRelativeEffectBashin: terminalRelativeEffects.length
        ? Math.max(...terminalRelativeEffects)
        : null,
      terminalRiskAdjustedBashin: terminalRiskReferences.length
        ? Math.max(...terminalRiskReferences)
        : null,
      controlPolicy: PHASE_CONTROL_POLICY.kind,
      evidenceState: evidence.catalog === 'CONFIRMED'
        && evidence.target === 'READY'
        && evidence.courseGeometry === 'CONFIRMED'
        && evidence.serverAvailability !== 'UNKNOWN'
        && evidence.uniqueStars !== 'UNKNOWN'
        && evidence.evolution !== 'UNKNOWN'
        ? 'SUFFICIENT'
        : evidence.catalog === 'UNKNOWN' || evidence.target === 'BLOCKED'
          || evidence.serverAvailability === 'UNKNOWN'
          || evidence.uniqueStars === 'UNKNOWN'
          || evidence.evolution === 'UNKNOWN'
          ? 'UNKNOWN'
          : 'PARTIAL'
    };

    return {
      schemaVersion: 'prettyderby-body-package.v1',
      outfitId: finiteNumber(card?.id ?? card?.outfitId),
      characterId: finiteNumber(card?.characterId),
      active: dedupedActive.map(record => {
        const { skill, ...safe } = record;
        return safe;
      }),
      replaced,
      notApplicable: notApplicable.map(item => {
        const { skill, ...safe } = item;
        return safe;
      }),
      evolutionRoutes: evolutionRecords,
      policy: PHASE_CONTROL_POLICY,
      dimensions,
      evidence,
      target: targetResult.status === 'READY' ? target : null,
      context: target ? {
        courseId: target.courseId,
        distanceM: target.distanceM,
        distanceType: target.distanceType,
        surface: target.surface,
        runningStyle: target.runningStyle
      } : null
    };
  }

  function aptitudeState(value) {
    if (typeof value !== 'string') return 'UNKNOWN';
    const rank = value.trim().toUpperCase();
    if (!(rank in APTITUDE_ORDER)) return 'UNKNOWN';
    if (rank === 'S' || rank === 'A') return 'READY';
    if (rank === 'B') return 'LIGHT_REPAIR';
    if (rank === 'C' || rank === 'D') return 'HEAVY_REPAIR';
    return 'INELIGIBLE_REPAIR';
  }

  function cardAptitudes(card, target) {
    const values = Array.isArray(card?.aptitude) ? card.aptitude : [];
    const indexes = {
      surface: target?.surface === 'dirt' ? 1 : target?.surface === 'turf' ? 0 : null,
      distance: {
        short: 2,
        mile: 3,
        medium: 4,
        long: 5
      }[target?.distanceType] ?? null,
      runningStyle: {
        runner: 6,
        leader: 7,
        betweener: 8,
        chaser: 9
      }[target?.runningStyle] ?? null
    };
    const output = {};
    for (const field of ['surface', 'distance', 'runningStyle']) {
      const index = indexes[field];
      const rank = index == null ? null : values[index];
      output[field] = {
        rank: typeof rank === 'string' ? rank.toUpperCase() : null,
        state: aptitudeState(rank),
        index
      };
    }
    const states = Object.values(output).map(item => item.state);
    const overall = states.includes('UNKNOWN')
      ? 'UNKNOWN'
      : states.includes('INELIGIBLE_REPAIR')
        ? 'INELIGIBLE_REPAIR'
        : states.includes('HEAVY_REPAIR')
          ? 'HEAVY_REPAIR'
          : states.includes('LIGHT_REPAIR')
            ? 'LIGHT_REPAIR'
            : 'READY';
    return { ...output, overall };
  }

  function ownershipFor(outfitId, inventory, candidate) {
    const owned = new Set((inventory?.trainees || [])
      .map(item => finiteNumber(item?.outfitId ?? item?.id))
      .filter(id => id != null));
    if (owned.size) return owned.has(outfitId) ? 'USER_OWNED' : 'NOT_OWNED';
    if (candidate?.ownership === 'USER_OWNED') return 'USER_OWNED';
    if (candidate?.ownership === 'NOT_OWNED') return 'NOT_OWNED';
    return 'UNKNOWN';
  }

  function deckState(input, candidate) {
    const source = candidate?.deckConflict || input?.deckConflict || input?.deck || null;
    if (!source) return 'NEUTRAL';
    if (source.status === 'CONFIRMED' || source.confirmed === true) {
      if (source.conflict === true || source.hasConflict === true || (source.conflictingCardIds || []).length) {
        return 'DECK_CHANGE_REQUIRED';
      }
      return 'CONFIRMED_NO_CONFLICT';
    }
    if (source.status === 'CONFLICT' || source.status === 'DECK_CHANGE_REQUIRED') return 'DECK_CHANGE_REQUIRED';
    return 'NEUTRAL';
  }

  function aptitudeSortValue(aptitude) {
    const states = ['surface', 'distance', 'runningStyle'].map(field => aptitude?.[field]?.state);
    if (states.includes('UNKNOWN')) return 0;
    if (states.includes('INELIGIBLE_REPAIR')) return 1;
    if (states.includes('HEAVY_REPAIR')) return 2;
    if (states.includes('LIGHT_REPAIR')) return 3;
    return 4;
  }

  function burdenSortValue(value) {
    return { UNKNOWN: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }[value] ?? 0;
  }

  function terminalEffectSortValue(dimensions) {
    return finiteNumber(dimensions?.terminalRiskAdjustedBashin)
      ?? finiteNumber(dimensions?.terminalRelativeEffectBashin)
      ?? -Infinity;
  }

  function candidateHasBodyEdge(body) {
    const dimensions = body?.dimensions || {};
    return dimensions.startControl?.enabled === true
      || dimensions.midRaceControl?.enabled === true
      || dimensions.finishControl?.enabled === true
      || (body?.active || []).some(record => record.terminalLaunch === 'SUPPORT');
  }

  function makeCandidate(input, candidate, card, target, targetResult, options) {
    const outfitId = finiteNumber(card?.id ?? card?.outfitId ?? candidate?.outfitId ?? candidate?.id);
    const ownership = ownershipFor(outfitId, input.inventory, candidate);
    const inventoryTrainee = (input.inventory?.trainees || []).find(item =>
      Number(item?.outfitId ?? item?.id) === outfitId
    );
    const body = resolveBodyPackage({
      card,
      catalog: input.catalog,
      target,
      awakeningLevel: candidate?.awakeningLevel
        ?? inventoryTrainee?.awakeningLevel
        ?? card?.awakeningLevel,
      stars: candidate?.stars
        ?? inventoryTrainee?.stars
        ?? card?.stars
    });
    const aptitude = cardAptitudes(card, target);
    const deckFeasibility = deckState(input, candidate);
    const terminal = body.dimensions.terminalLaunch;
    const packageDepth = body.dimensions.packageDepth;
    const hasUnknown = body.dimensions.evidenceState === 'UNKNOWN'
      || aptitude.overall === 'UNKNOWN'
      || body.active.some(record => record.applicability === 'UNKNOWN')
      || ((card?.awakeningSkillIds || []).length > 0
        && body.evidence.awakeningLevel === 'UNKNOWN');
    const ineligible = aptitude.overall === 'INELIGIBLE_REPAIR';
    const heavyRepair = aptitude.overall === 'HEAVY_REPAIR';
    const deckChange = deckFeasibility === 'DECK_CHANGE_REQUIRED';
    const evolutionRoutes = body.evolutionRoutes || [];
    const allEvolutionOffTarget = evolutionRoutes.length >= 2
      && evolutionRoutes.every(route => route.alternatives.length > 0
        && route.alternatives.every(alternative => alternative.applicability === 'NOT_APPLICABLE'));
    let recommendationTier;
    const reasons = [];
    const gaps = [];
    const unknowns = [];
    if (ownership === 'NOT_OWNED') {
      recommendationTier = options.includeBenchmarks ? 'BENCHMARK_ONLY' : 'UNKNOWN';
      reasons.push('非使用者持有戰馬；只作基準比較。');
    } else if (ownership === 'UNKNOWN') {
      recommendationTier = 'UNKNOWN';
      unknowns.push('無法從 inventory.trainees 確認持有狀態。');
    } else if (hasUnknown) {
      recommendationTier = 'UNKNOWN';
      unknowns.push('本體或目標證據尚有 UNKNOWN，不能用 0 或中間分代替。');
    } else if (terminal === 'CORE' && !ineligible && packageDepth !== 'UNKNOWN') {
      if (deckChange || heavyRepair) {
        recommendationTier = 'CONDITIONAL';
        if (deckChange) gaps.push('已確認支援卡衝突，需要調整配卡。');
        if (heavyRepair) gaps.push('至少一項適性需要重度紅因子修復。');
      } else if (allEvolutionOffTarget && body.active.filter(record => record.terminalLaunch === 'CORE').length === 1) {
        recommendationTier = 'STRATEGIC';
        reasons.push('有明確終盤本體優勢，但多個進化路線對目標不適用；屬單邊策略。');
      } else if (packageDepth === 'FULL' || packageDepth === 'TWO_PHASE') {
        recommendationTier = 'RECOMMENDED';
      } else {
        recommendationTier = 'STRATEGIC';
        gaps.push('終盤核心存在，但本體分段覆蓋仍偏單邊。');
      }
    } else if (terminal === 'CORE') {
      recommendationTier = 'CONDITIONAL';
      if (ineligible) gaps.push('目標適性為 E/F/G，資料只代表存在修復可能，不代表已可用。');
      if (heavyRepair) gaps.push('目標適性需要重度修復。');
      if (deckChange) gaps.push('已確認需要變更配卡。');
    } else if (candidateHasBodyEdge(body)) {
      recommendationTier = 'CONDITIONAL';
      gaps.push('有本體領先／中盤／終盤支援，但沒有通過終盤 CORE 門檻。');
    } else {
      recommendationTier = 'MANUAL_ONLY';
      gaps.push('沒有已驗證的終盤 CORE；仍可手動選擇，但不應列為前排推薦。');
    }

    if (terminal === 'CORE') {
      const terminalSkills = (body.active || [])
        .filter(record => record.terminalLaunch === 'CORE')
        .map(record => `${record.skillId}${record.name ? ` ${record.name}` : ''}`);
      reasons.push(`已驗證至少一個目標終盤 CORE 本體／進化技能：${terminalSkills.join('、') || 'UNKNOWN'}。`);
    }
    if (body.dimensions.startControl?.enabled) reasons.push('本體包包含開局控制。');
    if (body.dimensions.midRaceControl?.enabled) reasons.push('本體包包含中盤控制。');
    if (body.dimensions.courseSpecific === 'EXACT_TARGET') reasons.push('技能條件含目標距離／跑法等明確限制。');
    if (aptitude.overall === 'LIGHT_REPAIR') gaps.push('至少一項適性為 B，需要輕度修復。');
    if (body.dimensions.offStyleWasteCount) gaps.push(`有 ${body.dimensions.offStyleWasteCount} 個對目標不適用的本體／進化路線。`);

    const hardGate = recommendationTier === 'UNKNOWN'
      ? { status: 'UNKNOWN', blockers: unknowns.slice() }
      : recommendationTier === 'MANUAL_ONLY'
        ? { status: 'PASS', blockers: [] }
        : { status: 'PASS', blockers: [] };
    const frontRecommended = ownership === 'USER_OWNED'
      && recommendationTier === 'RECOMMENDED';
    return {
      candidateId: outfitId,
      outfitId,
      characterId: finiteNumber(card?.characterId ?? candidate?.characterId),
      name: card?.nameZhTw || card?.name || candidate?.name || null,
      title: card?.titleZhTw || card?.title || candidate?.title || null,
      ownership,
      recommendationTier,
      frontRecommended,
      rank: null,
      modelOrder: null,
      hardGate,
      aptitude,
      dimensions: {
        ...body.dimensions,
        deckFeasibility
      },
      bodyPackage: body,
      reasons: [...new Set(reasons)],
      gaps: [...new Set(gaps)],
      unknowns: [...new Set(unknowns)],
      evidence: body.evidence
    };
  }

  function rankBattleHorses(input = {}) {
    const rawTarget = input.target && typeof input.target === 'object'
      ? {
        ...input.target,
        ...(input.evidenceProfile && !input.target.evidenceProfile
          ? { evidenceProfile: input.evidenceProfile }
          : {})
      }
      : input;
    const targetResult = normalizeTarget(rawTarget);
    if (targetResult.status !== 'READY') {
      return {
        schemaVersion: 'prettyderby-battle-horse-ranking.v1',
        status: 'BLOCKED',
        target: null,
        targetKey: null,
        scoringOrder: scoringOrder(),
        modelOrder: [],
        candidates: [],
        errors: targetResult.errors,
        evidenceMismatches: targetResult.evidenceMismatches
      };
    }
    const target = targetResult.target;
    const catalog = input.catalog || {};
    const ownIds = new Set((input.inventory?.trainees || [])
      .map(item => finiteNumber(item?.outfitId ?? item?.id))
      .filter(id => id != null));
    let suppliedCandidates = Array.isArray(input.candidates) ? input.candidates : null;
    if (!suppliedCandidates) {
      const cards = input.includeBenchmarks
        ? (catalog.characterCards || [])
        : (catalog.characterCards || []).filter(card => ownIds.has(Number(card.id)));
      suppliedCandidates = cards.map(card => ({ card, outfitId: card.id }));
    }
    const rows = [];
    for (const supplied of suppliedCandidates) {
      const candidate = supplied?.card && typeof supplied.card === 'object'
        ? supplied
        : supplied;
      const cardRef = supplied?.card
        ?? supplied?.outfitId
        ?? supplied?.cardId
        ?? supplied?.id
        ?? supplied;
      const card = findCharacterCard(catalog, cardRef);
      if (!card) continue;
      const ownership = ownershipFor(
        finiteNumber(card.id ?? card.outfitId),
        input.inventory,
        supplied
      );
      if (ownership === 'NOT_OWNED' && !input.includeBenchmarks) continue;
      rows.push(makeCandidate(input, supplied, card, target, targetResult, {
        includeBenchmarks: Boolean(input.includeBenchmarks)
      }));
    }

    rows.sort((left, right) => {
      return (TIER_ORDER[right.recommendationTier] ?? 0) - (TIER_ORDER[left.recommendationTier] ?? 0)
        || TERMINAL_ORDER[right.dimensions.terminalLaunch] - TERMINAL_ORDER[left.dimensions.terminalLaunch]
        || DEPTH_ORDER[right.dimensions.packageDepth] - DEPTH_ORDER[left.dimensions.packageDepth]
        || terminalEffectSortValue(right.dimensions) - terminalEffectSortValue(left.dimensions)
        || SPECIFICITY_ORDER[right.dimensions.courseSpecific] - SPECIFICITY_ORDER[left.dimensions.courseSpecific]
        || (right.dimensions.startControl?.tier === 'CORE' ? 1 : 0) - (left.dimensions.startControl?.tier === 'CORE' ? 1 : 0)
        || (right.dimensions.midRaceControl?.tier === 'CORE' ? 1 : 0) - (left.dimensions.midRaceControl?.tier === 'CORE' ? 1 : 0)
        || (right.dimensions.finishControl?.tier === 'CORE' ? 1 : 0) - (left.dimensions.finishControl?.tier === 'CORE' ? 1 : 0)
        || burdenSortValue(right.dimensions.conditionBurden) - burdenSortValue(left.dimensions.conditionBurden)
        || left.dimensions.offStyleWasteCount - right.dimensions.offStyleWasteCount
        || aptitudeSortValue(right.aptitude) - aptitudeSortValue(left.aptitude)
        || (left.outfitId ?? Infinity) - (right.outfitId ?? Infinity);
    });
    rows.forEach((row, index) => {
      row.rank = index + 1;
      row.modelOrder = index + 1;
    });
    return {
      schemaVersion: 'prettyderby-battle-horse-ranking.v1',
      status: 'READY',
      target,
      targetKey: targetResult.targetKey,
      scoringOrder: scoringOrder(),
      modelOrder: rows.map(row => row.candidateId),
      candidates: rows,
      errors: [],
      evidenceMismatches: []
    };
  }

  return {
    TARGET_FIELDS,
    SCORING_ORDER,
    PHASE_CONTROL_POLICY,
    normalizeTarget,
    resolveBodyPackage,
    rankBattleHorses
  };
});
