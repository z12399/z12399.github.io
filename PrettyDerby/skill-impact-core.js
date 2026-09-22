(function (root, factory) {
  const skillCore = typeof module !== 'undefined' && module.exports
    ? require('./skill-core.js')
    : root.SKILL_CORE;
  const courseCore = typeof module !== 'undefined' && module.exports
    ? require('./course-core.js')
    : root.COURSE_CORE;
  const api = factory(skillCore, courseCore);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SKILL_IMPACT_CORE = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (skillCore, courseCore) {
  if (!skillCore || !courseCore) {
    throw new Error('SKILL_IMPACT_CORE requires SKILL_CORE and COURSE_CORE.');
  }

  const MODEL_VERSION = 'course-bashin-v3';
  const FRONT_RUNNER_STYLE = 1;
  const STYLE_TAGS = ['run', 'ldr', 'btw', 'cha'];
  const DISTANCE_TAGS = ['sho', 'mil', 'med', 'lng'];
  const GROUND_TAGS = ['tur', 'dir'];
  const DISTANCE_TAG_BY_ID = { 1: 'sho', 2: 'mil', 3: 'med', 4: 'lng' };
  const GROUND_TAG_BY_ID = { 1: 'tur', 2: 'dir' };
  const DEFAULT_BASELINE = {
    middleSpeed: 20,
    terminalSpeedGain: 6.2,
    terminalAcceleration: 0.45,
    horseLengthMeters: 2.5,
    stepSeconds: 0.01,
    samples: 31
  };

  function numeric(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function uniqueNumbers(values) {
    return [...new Set((values || []).map(Number).filter(Number.isFinite))];
  }

  function compare(actual, operator, expected) {
    if (operator === '==') return actual === expected;
    if (operator === '!=') return actual !== expected;
    if (operator === '>=') return actual >= expected;
    if (operator === '<=') return actual <= expected;
    if (operator === '>') return actual > expected;
    if (operator === '<') return actual < expected;
    return false;
  }

  function normalizeIntervals(items) {
    return (items || [])
      .map(item => ({
        start: Math.max(0, Number(item.start)),
        end: Number(item.end),
        label: item.label || ''
      }))
      .filter(item => Number.isFinite(item.start) && Number.isFinite(item.end) && item.end > item.start)
      .sort((a, b) => a.start - b.start || a.end - b.end);
  }

  function intersectIntervals(left, right) {
    const output = [];
    for (const a of left || []) {
      for (const b of right || []) {
        const start = Math.max(a.start, b.start);
        const end = Math.min(a.end, b.end);
        if (end > start) {
          output.push({
            start,
            end,
            label: [a.label, b.label].filter(Boolean).join(' × ')
          });
        }
      }
    }
    return normalizeIntervals(output);
  }

  function complementIntervals(items, distance, label) {
    const ranges = normalizeIntervals(items);
    const output = [];
    let cursor = 0;
    for (const item of ranges) {
      if (item.start > cursor) {
        output.push({ start: cursor, end: item.start, label });
      }
      cursor = Math.max(cursor, item.end);
    }
    if (cursor < distance) output.push({ start: cursor, end: distance, label });
    return output;
  }

  function phaseIntervals(timeline, operator, value) {
    return (timeline?.phases || [])
      .filter(item => compare(Number(item.phase), operator, Number(value)))
      .map(item => ({ start: item.start, end: item.end, label: `賽段 ${item.phase}` }));
  }

  function segmentPortion(items, portion, label) {
    return (items || []).map(item => {
      const length = item.end - item.start;
      if (portion === 'first-half') {
        return { start: item.start, end: item.start + length / 2, label };
      }
      if (portion === 'later-half') {
        return { start: item.start + length / 2, end: item.end, label };
      }
      if (portion === 'first-quarter') {
        return { start: item.start, end: item.start + length / 4, label };
      }
      return { start: item.start, end: item.end, label };
    });
  }

  function clauseIntervals(clause, timeline) {
    const field = clause?.field;
    const value = Number(clause?.value);
    const operator = clause?.operator;
    const distance = Number(timeline?.distance);
    if (!field || !Number.isFinite(distance)) return null;

    if (field === 'phase') return phaseIntervals(timeline, operator, value);
    if (/^phase_(random|firsthalf|firsthalf_random|laterhalf|laterhalf_random|firstquarter|firstquarter_random)$/.test(field)) {
      const phase = phaseIntervals(timeline, operator, value);
      const suffix = field.includes('random') ? '隨機' : '';
      if (field.includes('firsthalf')) return segmentPortion(phase, 'first-half', `賽段前半${suffix}`);
      if (field.includes('laterhalf')) return segmentPortion(phase, 'later-half', `賽段後半${suffix}`);
      if (field.includes('firstquarter')) return segmentPortion(phase, 'first-quarter', `賽段前四分之一${suffix}`);
      return segmentPortion(phase, 'all', `賽段${suffix}`);
    }
    if (field === 'phase_first_half_straight_random' || field === 'phase_latter_half_straight_random') {
      const phases = phaseIntervals(timeline, operator, value);
      const portion = field.includes('first_half') ? 'first-half' : 'later-half';
      return intersectIntervals(
        segmentPortion(phases, portion, portion === 'first-half' ? '賽段前半' : '賽段後半'),
        timeline.straights
      );
    }
    if (field === 'phase_straight_random' || field === 'phase_corner_random') {
      const phases = phaseIntervals(timeline, operator, value);
      const geometry = field === 'phase_straight_random'
        ? timeline.straights
        : timeline.corners;
      return intersectIntervals(phases, geometry);
    }
    if (field === 'corner') {
      if (operator === '==' && value === 0) {
        return complementIntervals(timeline.corners, distance, '非彎道路段');
      }
      return (timeline.corners || [])
        .filter(item => compare(Number(item.cornerNumber), operator, value))
        .map(item => ({ start: item.start, end: item.end, label: `第 ${item.cornerNumber} 彎道` }));
    }
    if (field === 'straight_front_type') {
      return (timeline.straights || [])
        .filter(item => compare(Number(item.frontType), operator, value))
        .map(item => ({ start: item.start, end: item.end, label: '指定側直線' }));
    }
    if (field === 'straight_random') {
      return (timeline.straights || []).map(item => ({
        start: item.start, end: item.end, label: '直線隨機'
      }));
    }
    if (field === 'corner_random') {
      const corner = (timeline.corners || [])
        .filter(item => compare(Number(item.cornerNumber), operator, value))
        .at(-1);
      return corner
        ? [{ start: corner.start, end: corner.end, label: `第 ${corner.cornerNumber} 彎道隨機` }]
        : [];
    }
    if (field === 'all_corner_random') {
      return (timeline.corners || []).map(item => ({
        start: item.start, end: item.end, label: '彎道隨機'
      }));
    }
    if (['is_last_straight', 'is_last_straight_onetime', 'last_straight_random'].includes(field) && value === 1) {
      const last = (timeline.straights || []).at(-1);
      return last ? [{ start: last.start, end: last.end, label: '最終直線' }] : [];
    }
    if (field === 'is_finalcorner' && value === 1) {
      const last = (timeline.corners || []).at(-1);
      return last ? [{ start: last.start, end: distance, label: '最終彎道或之後' }] : [];
    }
    if (field === 'is_finalcorner_random' && value === 1) {
      const last = (timeline.corners || []).at(-1);
      return last ? [{ start: last.start, end: last.end, label: '最終彎道隨機' }] : [];
    }
    if (field === 'is_finalcorner_laterhalf' && value === 1) {
      const last = (timeline.corners || []).at(-1);
      return last
        ? [{ start: last.start + (last.end - last.start) / 2, end: distance, label: '最終彎道後半或之後' }]
        : [];
    }
    if ((field === 'is_lastspurt' && value === 1) || (field === 'lastspurt' && value >= 1)) {
      return [{
        start: timeline.terminalStart,
        end: distance,
        label: '最後衝刺'
      }];
    }
    if (field === 'distance_rate' || field === 'distance_rate_after_random') {
      const point = distance * value / 100;
      if (['>=', '>'].includes(operator) || field === 'distance_rate_after_random') {
        return [{ start: point, end: distance, label: `全程 ${value}% 後` }];
      }
      if (['<=', '<'].includes(operator)) {
        return [{ start: 0, end: point, label: `全程 ${value}% 前` }];
      }
    }
    if (field === 'remain_distance') {
      const point = Math.max(0, distance - value);
      if (['<=', '<'].includes(operator)) {
        return [{ start: point, end: distance, label: `剩餘 ${value}m 內` }];
      }
      if (['>=', '>'].includes(operator)) {
        return [{ start: 0, end: point, label: `剩餘 ${value}m 前` }];
      }
    }
    if (field === 'up_slope_random' && value === 1) {
      return (timeline.slopes || [])
        .filter(item => item.direction === 'up')
        .map(item => ({ start: item.start, end: item.end, label: '上坡隨機' }));
    }
    if (field === 'up_slope_random_later_half' && value === 1) {
      return segmentPortion(
        (timeline.slopes || []).filter(item => item.direction === 'up'),
        'later-half',
        '上坡後半隨機'
      );
    }
    if (field === 'down_slope_random' && value === 1) {
      return (timeline.slopes || [])
        .filter(item => item.direction === 'down')
        .map(item => ({ start: item.start, end: item.end, label: '下坡隨機' }));
    }
    if (field === 'slope') {
      if (operator === '==' && value === 0) {
        return complementIntervals(timeline.slopes, distance, '平路');
      }
      const direction = value === 1 ? 'up' : value === 2 ? 'down' : null;
      if (!direction) return null;
      return (timeline.slopes || [])
        .filter(item => item.direction === direction)
        .map(item => ({
          start: item.start,
          end: item.end,
          label: direction === 'up' ? '上坡' : '下坡'
        }));
    }
    return null;
  }

  function reliabilityForFields(fields) {
    let value = 1;
    const fieldSet = new Set(fields || []);
    if ([...fieldSet].some(field => /infront|blocked|lane|surrounded/.test(field))) value *= 0.45;
    if ([...fieldSet].some(field => /change_order|overtake|is_overtake|is_behind/.test(field))) value *= 0.65;
    if ([...fieldSet].some(field => /compete|bashin_diff|distance_diff/.test(field))) value *= 0.72;
    if ([...fieldSet].some(field => /activate_count|skill_count/.test(field))) value *= 0.82;
    if ([...fieldSet].some(field => /popularity|random_lot/.test(field))) value *= 0.6;
    if (fieldSet.has('order') || fieldSet.has('order_rate')) value *= 0.9;
    return Math.max(0.2, Math.min(1, value));
  }

  function changesActivationTime(field) {
    return /change_order|overtake|blocked|infront|surrounded|compete|activate_count|skill_count|is_used_skill|temptation|accumulatetime|bashin_diff|distance_diff/.test(field);
  }

  function usesEqualSegmentRandom(field) {
    return [
      'straight_random',
      'corner_random',
      'all_corner_random',
      'last_straight_random',
      'is_finalcorner_random',
      'phase_straight_random',
      'phase_corner_random',
      'phase_first_half_straight_random',
      'phase_latter_half_straight_random',
      'up_slope_random',
      'up_slope_random_later_half',
      'down_slope_random'
    ].includes(field);
  }

  function expressionBranches(expression) {
    const ast = skillCore.parseExpression(expression || 'always==1');
    return ast.any?.length ? ast.any.map(branch => branch.all || []) : [[]];
  }

  function resolveActivationWindowsForGroup(group, timeline, context = {}) {
    if (!group || !timeline?.distance) return [];
    const preBranches = group.precondition ? expressionBranches(group.precondition) : [[]];
    const conditionBranches = expressionBranches(group.condition || 'always==1');
    const windows = [];

    for (const pre of preBranches) {
      for (const condition of conditionBranches) {
        const clauses = [...pre, ...condition].filter(clause => clause.valid);
        if (clauses.some(clause =>
          skillCore.evaluateClause(clause, context) === skillCore.FALSE
        )) continue;
        let intervals = [{ start: 0, end: timeline.distance, label: '全程' }];
        const fields = [];
        for (const clause of clauses) {
          fields.push(clause.field);
          const constraint = clauseIntervals(clause, timeline);
          if (constraint !== null) {
            intervals = intersectIntervals(intervals, constraint);
          }
          if (!intervals.length) break;
        }
        if (!intervals.length) continue;
        const random = fields.some(field => /random/.test(field));
        const dynamicFields = fields.filter(field =>
          skillCore.evaluateClause(
            clauses.find(clause => clause.field === field),
            context
          ) === skillCore.UNKNOWN
          && clauseIntervals(clauses.find(clause => clause.field === field), timeline) === null
          && field !== 'always'
        );
        const dynamicTimingFields = dynamicFields.filter(changesActivationTime);
        const dynamicTiming = dynamicTimingFields.length > 0;
        windows.push({
          group,
          intervals,
          distribution: random || dynamicTiming ? 'uniform-reference' : 'first-valid-point',
          random: random || dynamicTiming,
          dynamicFields: [...new Set(dynamicFields)],
          dynamicTimingFields: [...new Set(dynamicTimingFields)],
          randomMode: fields.some(usesEqualSegmentRandom)
            ? 'equal-segments'
            : 'distance-uniform',
          requiresFullSpurt: fields.some(field => field === 'is_lastspurt' || field === 'lastspurt'),
          conditionReliability: reliabilityForFields(dynamicFields.concat(fields)),
          confidence: timeline.geometryConfidence === 'catalog'
            ? dynamicFields.length ? 'course-plus-condition-proxy' : 'course'
            : 'rough'
        });
      }
    }
    return windows;
  }

  function accelerationEffect(group) {
    return Math.max(0, ...(group?.effects || [])
      .filter(effect => Number(effect.type) === 31)
      .map(effect => Number(effect.value) / 10000)
      .filter(Number.isFinite));
  }

  function durationSeconds(group, distance) {
    const base = Number(group?.baseTime);
    if (!Number.isFinite(base) || base <= 0) return 0;
    return (base / 10000) * (Number(distance) / 1000);
  }

  function baselineTimeAtDistance(relativeMeters, baseline) {
    if (relativeMeters <= 0) return relativeMeters / baseline.middleSpeed;
    const accelerationTime = baseline.terminalSpeedGain / baseline.terminalAcceleration;
    const accelerationDistance =
      baseline.middleSpeed * accelerationTime
      + 0.5 * baseline.terminalAcceleration * accelerationTime ** 2;
    if (relativeMeters <= accelerationDistance) {
      return (
        -baseline.middleSpeed
        + Math.sqrt(
          baseline.middleSpeed ** 2
          + 2 * baseline.terminalAcceleration * relativeMeters
        )
      ) / baseline.terminalAcceleration;
    }
    return accelerationTime
      + (relativeMeters - accelerationDistance)
        / (baseline.middleSpeed + baseline.terminalSpeedGain);
  }

  function simulateAccelerationAt(activationMeters, duration, extraAcceleration, timeline, options = {}) {
    const baseline = { ...DEFAULT_BASELINE, ...(options.baseline || {}) };
    if (
      !Number.isFinite(activationMeters)
      || !Number.isFinite(duration)
      || duration <= 0
      || !Number.isFinite(extraAcceleration)
      || extraAcceleration <= 0
      || !Number.isFinite(timeline?.terminalStart)
    ) return 0;
    const activationTime = baselineTimeAtDistance(
      activationMeters - timeline.terminalStart,
      baseline
    );
    const targetSpeed = baseline.middleSpeed + baseline.terminalSpeedGain;
    const endTime = Math.max(
      baseline.terminalSpeedGain / baseline.terminalAcceleration + 2,
      activationTime + duration + 2,
      18
    );
    let normalSpeed = baseline.middleSpeed;
    let skillSpeed = baseline.middleSpeed;
    let normalDistance = 0;
    let skillDistance = 0;
    for (let time = 0; time < endTime; time += baseline.stepSeconds) {
      normalSpeed = Math.min(
        targetSpeed,
        normalSpeed + baseline.terminalAcceleration * baseline.stepSeconds
      );
      const skillActive = time >= activationTime && time < activationTime + duration;
      skillSpeed = Math.min(
        targetSpeed,
        skillSpeed + (
          baseline.terminalAcceleration + (skillActive ? extraAcceleration : 0)
        ) * baseline.stepSeconds
      );
      normalDistance += normalSpeed * baseline.stepSeconds;
      skillDistance += skillSpeed * baseline.stepSeconds;
    }
    return Math.max(
      0,
      (skillDistance - normalDistance) / baseline.horseLengthMeters
    );
  }

  function intervalQuantiles(intervals, count, mode = 'distance-uniform') {
    const ranges = normalizeIntervals(intervals);
    const total = ranges.reduce((sum, item) => sum + item.end - item.start, 0);
    if (!ranges.length || total <= 0) return [];
    const output = [];
    const wanted = Math.max(2, Number(count) || DEFAULT_BASELINE.samples);
    if (mode === 'equal-segments') {
      for (let index = 0; index < wanted; index += 1) {
        const scaled = (index + 0.5) / wanted * ranges.length;
        const range = ranges[Math.min(ranges.length - 1, Math.floor(scaled))];
        const local = scaled - Math.floor(scaled);
        output.push(range.start + (range.end - range.start) * local);
      }
      return output;
    }
    for (let index = 0; index < wanted; index += 1) {
      let offset = total * ((index + 0.5) / wanted);
      for (const item of ranges) {
        const length = item.end - item.start;
        if (offset <= length) {
          output.push(item.start + offset);
          break;
        }
        offset -= length;
      }
    }
    return output;
  }

  function summarizeNumbers(values) {
    const sorted = (values || []).filter(Number.isFinite).sort((a, b) => a - b);
    if (!sorted.length) return { mean: 0, min: 0, max: 0, p50: 0 };
    return {
      mean: sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
      min: sorted[0],
      max: sorted.at(-1),
      p50: sorted[Math.floor(sorted.length / 2)]
    };
  }

  function estimateWindowImpact(window, group, timeline, options = {}) {
    const extraAcceleration = accelerationEffect(group);
    const duration = durationSeconds(group, timeline.distance);
    const positions = window.distribution === 'first-valid-point'
      ? [Math.min(...window.intervals.map(item => item.start))]
      : intervalQuantiles(window.intervals, options.samples, window.randomMode);
    const gains = positions.map(position =>
      simulateAccelerationAt(position, duration, extraAcceleration, timeline, options)
    );
    const values = summarizeNumbers(gains);
    const earliest = Math.min(...window.intervals.map(item => item.start));
    const latest = Math.max(...window.intervals.map(item => item.end));
    const effectiveRate = gains.length
      ? gains.filter(value => value >= 0.1).length / gains.length
      : 0;
    return {
      expectedBashin: values.mean,
      minBashin: values.min,
      maxBashin: values.max,
      medianBashin: values.p50,
      effectiveRate,
      conditionReliability: window.conditionReliability,
      riskAdjustedBashin: values.mean * window.conditionReliability,
      earliestMeters: earliest,
      latestMeters: latest,
      delayMeters: earliest - timeline.terminalStart,
      durationSeconds: duration,
      acceleration: extraAcceleration,
      distribution: window.distribution,
      dynamicFields: window.dynamicFields,
      dynamicTimingFields: window.dynamicTimingFields,
      randomMode: window.randomMode,
      requiresFullSpurt: window.requiresFullSpurt,
      confidence: window.confidence,
      source: 'local-estimate'
    };
  }

  function relevantTags(skill, context) {
    const tags = new Set(skill?.tags || []);
    const styles = STYLE_TAGS.filter(tag => tags.has(tag));
    if (styles.length && !tags.has('run')) return false;
    const distanceTags = DISTANCE_TAGS.filter(tag => tags.has(tag));
    const wantedDistance = DISTANCE_TAG_BY_ID[Number(context?.distance_type)];
    if (distanceTags.length && wantedDistance && !tags.has(wantedDistance)) return false;
    const groundTags = GROUND_TAGS.filter(tag => tags.has(tag));
    const wantedGround = GROUND_TAG_BY_ID[Number(context?.ground_type)];
    if (groundTags.length && wantedGround && !tags.has(wantedGround)) return false;
    return true;
  }

  function analyzeVariant(skill, variant, timeline, context, options = {}) {
    if (!skill || !variant || !relevantTags(skill, context)) return null;
    const candidates = [];
    for (const [groupIndex, group] of (variant.conditionGroups || []).entries()) {
      if (!accelerationEffect(group)) continue;
      const windows = resolveActivationWindowsForGroup(group, timeline, context);
      for (const window of windows) {
        candidates.push({
          ...estimateWindowImpact(window, group, timeline, options),
          groupIndex,
          conditionSummary: [group.precondition, group.condition].filter(Boolean)
        });
      }
    }
    if (!candidates.length) return null;
    candidates.sort((a, b) =>
      b.riskAdjustedBashin - a.riskAdjustedBashin
      || b.expectedBashin - a.expectedBashin
    );
    if (candidates.length === 1) return candidates[0];
    const expectedBashin = candidates.reduce(
      (sum, candidate) => sum + candidate.expectedBashin,
      0
    ) / candidates.length;
    const riskAdjustedBashin = candidates.reduce(
      (sum, candidate) => sum + candidate.riskAdjustedBashin,
      0
    ) / candidates.length;
    return {
      ...candidates[0],
      expectedBashin,
      minBashin: Math.min(...candidates.map(candidate => candidate.minBashin)),
      maxBashin: Math.max(...candidates.map(candidate => candidate.maxBashin)),
      medianBashin: candidates.reduce(
        (sum, candidate) => sum + candidate.medianBashin,
        0
      ) / candidates.length,
      effectiveRate: candidates.reduce(
        (sum, candidate) => sum + candidate.effectiveRate,
        0
      ) / candidates.length,
      conditionReliability: expectedBashin > 0
        ? Math.max(0.2, Math.min(1, riskAdjustedBashin / expectedBashin))
        : 1,
      riskAdjustedBashin,
      earliestMeters: Math.min(...candidates.map(candidate => candidate.earliestMeters)),
      latestMeters: Math.max(...candidates.map(candidate => candidate.latestMeters)),
      delayMeters: Math.min(...candidates.map(candidate => candidate.delayMeters)),
      distribution: candidates.some(candidate =>
        candidate.distribution !== 'first-valid-point'
      ) ? 'uniform-reference' : 'first-valid-point',
      dynamicFields: [...new Set(candidates.flatMap(candidate => candidate.dynamicFields || []))],
      dynamicTimingFields: [...new Set(
        candidates.flatMap(candidate => candidate.dynamicTimingFields || [])
      )],
      requiresFullSpurt: candidates.some(candidate => candidate.requiresFullSpurt),
      branchCount: candidates.length,
      aggregation: 'equal-branch-reference'
    };
  }

  function mergeSnapshotImpact(estimated, snapshot) {
    if (!snapshot) return estimated;
    const expectedBashin = numeric(snapshot.expectedBashin);
    if (expectedBashin == null) return estimated;
    const reliability = estimated?.conditionReliability ?? 1;
    const minBashin = numeric(snapshot.minBashin) ?? expectedBashin;
    const maxBashin = numeric(snapshot.maxBashin) ?? expectedBashin;
    return {
      ...(estimated || {}),
      expectedBashin,
      minBashin,
      maxBashin,
      medianBashin: expectedBashin,
      bashinPerPt: numeric(snapshot.bashinPerPt),
      conditionReliability: reliability,
      riskAdjustedBashin: expectedBashin * reliability,
      source: 'utools-reference',
      sourceRuleset: 'jp-current-reference',
      targetServer: 'zh_tw',
      snapshotVariant: snapshot.variant || null
    };
  }

  function impactGrade(impact) {
    const value = Number(impact?.riskAdjustedBashin ?? impact?.expectedBashin) || 0;
    if (value >= 3) return 'S';
    if (value >= 2) return 'A';
    if (value >= 1) return 'B';
    if (value >= 0.35) return 'C';
    return 'D';
  }

  function timingLabel(impact, timeline) {
    if (!impact) return '發動位置不明';
    const start = Number(impact.earliestMeters);
    const end = Number(impact.latestMeters);
    const delay = Number(impact.delayMeters);
    const random = impact.distribution !== 'first-valid-point';
    if (!Number.isFinite(start)) return '發動位置不明';
    if (random && Math.abs(delay) <= 5) {
      return `後期前段隨機・${Math.round(start)}～${Math.round(end)}m`;
    }
    if (Math.abs(delay) <= 5) return `後期起點 ${Math.round(timeline.terminalStart)}m 立即發動`;
    if (delay < 0 && end >= timeline.terminalStart) {
      return `${random ? '跨後期隨機' : '後期前置加速'}・${Math.round(start)}～${Math.round(end)}m`;
    }
    if (delay > 0) {
      return `${random ? '隨機窗' : '最早'} ${Math.round(start)}m・比後期起點晚 ${Math.round(delay)}m`;
    }
    return `${random ? '隨機窗' : '最早'} ${Math.round(start)}m`;
  }

  function factorVariant(variants) {
    return variants
      .filter(item => Number(item.skill.rarity) === 1 && Number(item.skill.id) < 300000)
      .sort((a, b) =>
        b.impact.riskAdjustedBashin - a.impact.riskAdjustedBashin
        || Number(a.skill.cost || 9999) - Number(b.skill.cost || 9999)
      )[0] || null;
  }

  function sourceCount(skill) {
    const sources = skill?.sources || {};
    return new Set([
      ...(sources.supportHint || []),
      ...(sources.supportEvent || []),
      ...(sources.characterBuiltIn || []),
      ...(sources.characterEvent || []),
      ...(sources.scenarioEvent || [])
    ].map(String)).size;
  }

  function snapshotRows(snapshots, courseId, style = 'runner') {
    if (
      snapshots?.targetServer
      && snapshots.targetServer !== 'zh_tw'
    ) return [];
    if (
      snapshots?.ruleset
      && snapshots.ruleset !== 'jp-current-reference'
    ) return [];
    return snapshots?.entries?.[`${courseId}:${style}`]?.rows || [];
  }

  function resolvedSnapshotVariant(snapshot, skill) {
    if (snapshot?.variant) return snapshot.variant;
    return skill?.geneVersion
      ? 'inherited'
      : 'skill';
  }

  function buildCourseAccelerationTable(options = {}) {
    const catalog = options.catalog || {};
    const resolved = courseCore.resolveCourse(catalog, options.race || options.context || {});
    const timeline = resolved.timeline;
    const context = {
      ...resolved.context,
      ...(options.race?.context || {}),
      ...(options.context || {}),
      always: 1,
      running_style: Number(options.runningStyle) || FRONT_RUNNER_STYLE
    };
    if (
      timeline.geometryConfidence !== 'catalog'
      && options.allowRoughGeometry !== true
    ) {
      return {
        schemaVersion: 1,
        modelVersion: MODEL_VERSION,
        source: 'insufficient-course-geometry',
        ruleset: {
          targetServer: 'zh_tw',
          courseData: catalog?.metadata?.asOf || catalog?.metadata?.fetchedAt || null,
          externalReference: null,
          snapshotMode: null
        },
        course: resolved,
        timeline,
        context,
        families: []
      };
    }
    const snapshotMap = new Map(
      snapshotRows(options.snapshots, resolved.courseId, 'runner')
        .map(row => [Number(row.skillId), row])
    );
    const variantsByFamily = new Map();

    for (const skill of catalog.skills || []) {
      if (!skill.availableOnServer) continue;
      const skillId = Number(skill.id);
      if (
        !options.includeNonStandardSkills
        && !(skillId >= 100000 && skillId < 300000)
      ) continue;
      if (snapshotMap.size && !snapshotMap.has(skillId)) continue;
      const variant = skill;
      const estimated = analyzeVariant(skill, variant, timeline, context, options);
      if (!estimated) continue;
      const snapshot = snapshotMap.get(Number(skill.id));
      const snapshotVariant = resolvedSnapshotVariant(snapshot, skill);
      const impact = snapshotVariant === 'inherited'
        ? estimated
        : mergeSnapshotImpact(estimated, snapshot);
      const referenceBashin = snapshotVariant === 'inherited'
        ? numeric(snapshot?.expectedBashin) ?? impact?.expectedBashin
        : impact?.expectedBashin;
      if (!impact || referenceBashin < (options.minimumBashin ?? 0.1)) continue;
      const familyId = Number(skill.familyId || skill.id);
      if (!variantsByFamily.has(familyId)) variantsByFamily.set(familyId, []);
      variantsByFamily.get(familyId).push({
        skill,
        impact,
        snapshot,
        snapshotVariant,
        sourceCount: sourceCount(skill)
      });
    }

    const families = [];
    for (const [familyId, variants] of variantsByFamily) {
      variants.sort((a, b) =>
        b.impact.riskAdjustedBashin - a.impact.riskAdjustedBashin
        || Number(b.skill.rarity) - Number(a.skill.rarity)
        || Number(a.skill.id) - Number(b.skill.id)
      );
      // Unique identity is an explicit catalog property.  Rarity is not a
      // reliable discriminator: older upgraded uniques can be rarity 4 while
      // modern ones are rarity 5.  Using geneVersion keeps body uniques out of
      // the ordinary factor bucket without guessing from presentation rarity.
      const uniqueVariant = variants.find(item => Boolean(item.skill.geneVersion));
      const primary = uniqueVariant || variants[0];
      const factor = factorVariant(variants);
      const isUnique = Boolean(uniqueVariant);
      let inheritedImpact = null;
      if (isUnique && primary.skill.geneVersion) {
        const estimatedInherited = analyzeVariant(
          primary.skill,
          primary.skill.geneVersion,
          timeline,
          context,
          options
        );
        if (estimatedInherited) {
          inheritedImpact = primary.snapshotVariant === 'inherited'
            ? mergeSnapshotImpact(estimatedInherited, {
              ...primary.snapshot,
              variant: 'inherited'
            })
            : estimatedInherited;
        }
      }
      const routeImpact = isUnique
        ? inheritedImpact || primary.impact
        : factor?.impact || primary.impact;
      const courseImpact = isUnique
        ? inheritedImpact || primary.impact
        : primary.impact;
      const familyIds = uniqueNumbers(primary.skill.familyIds || [familyId]);
      const actionable =
        Boolean(factor)
        || isUnique
        || variants.some(item => item.sourceCount > 0);
      // Keep the inherited route explicit.  Downstream coverage must never use
      // a same-family match to claim that an arbitrary parent can inherit this
      // unique; only this unique's recorded parent skill IDs qualify.
      const inheritedParentSkillIds = isUnique
        ? uniqueNumbers([
          ...(primary.skill.geneVersion?.parentSkillIds || []),
          primary.skill.id
        ])
        : [];
      const coverageTargetSkillId = isUnique
        ? Number(primary.skill.id)
        : Number(factor?.skill?.id || primary.skill.id);
      families.push({
        id: Number(primary.skill.id),
        familyId,
        familyIds,
        factorId: factor ? Number(factor.skill.id) : null,
        name: primary.skill.nameZhTw || primary.skill.name || String(primary.skill.id),
        factorName: factor?.skill?.nameZhTw || factor?.skill?.name || null,
        rarity: Number(primary.skill.rarity),
        sourceKind: isUnique ? 'parent-unique' : null,
        coverageTargetKind: isUnique ? 'direct-parent-unique' : 'factor',
        coverageTargetSkillId,
        inheritedParentSkillIds,
        inheritedAvailable: Boolean(inheritedImpact),
        actionable,
        primarySkill: primary.skill,
        primaryImpact: primary.impact,
        courseImpact,
        factorSkill: factor?.skill || null,
        factorImpact: factor?.impact || null,
        inheritedImpact,
        routeImpactVariant: inheritedImpact ? 'inherited' : isUnique ? 'original-fallback' : 'factor',
        routeImpact,
        expectedBashin: Number(courseImpact.expectedBashin),
        minBashin: Number(courseImpact.minBashin),
        maxBashin: Number(courseImpact.maxBashin),
        bashinPerPt: numeric(courseImpact.bashinPerPt),
        riskAdjustedBashin: Number(courseImpact.riskAdjustedBashin),
        routeBashin: Number(routeImpact?.riskAdjustedBashin || 0),
        priority: impactGrade(courseImpact),
        activationWindow: timingLabel(courseImpact, timeline),
        reason: `${timingLabel(courseImpact, timeline)}；單技能參考 ${courseImpact.expectedBashin.toFixed(2)} 馬身。`,
        impactSource: courseImpact.source,
        conditionReliability: courseImpact.conditionReliability,
        effectiveRate: courseImpact.effectiveRate,
        dynamicFields: courseImpact.dynamicFields || [],
        requiresFullSpurt: Boolean(courseImpact.requiresFullSpurt)
      });
    }

    families.sort((a, b) =>
      b.riskAdjustedBashin - a.riskAdjustedBashin
      || b.expectedBashin - a.expectedBashin
      || a.id - b.id
    );
    return {
      schemaVersion: 1,
      modelVersion: MODEL_VERSION,
      source: snapshotMap.size ? 'utools-reference-allowlist' : 'local-estimate',
      ruleset: {
        targetServer: 'zh_tw',
        courseData: catalog?.metadata?.asOf || catalog?.metadata?.fetchedAt || null,
        externalReference: snapshotMap.size ? 'jp-current' : null,
        snapshotMode: snapshotMap.size ? 'allowlist' : null
      },
      course: resolved,
      timeline,
      context,
      families
    };
  }

  return {
    MODEL_VERSION,
    DEFAULT_BASELINE,
    resolveActivationWindowsForGroup,
    simulateAccelerationAt,
    analyzeVariant,
    buildCourseAccelerationTable,
    impactGrade,
    timingLabel
  };
});
