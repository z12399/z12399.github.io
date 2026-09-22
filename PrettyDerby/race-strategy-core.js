(function (root, factory) {
  const skillCore = typeof module !== 'undefined' && module.exports
    ? require('./skill-core.js')
    : root.SKILL_CORE;
  const api = factory(skillCore);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.RACE_STRATEGY_CORE = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (skillCore) {
  if (!skillCore) {
    throw new Error('RACE_STRATEGY_CORE requires SKILL_CORE to be loaded first.');
  }

  const ENGINE_ID = 'generic-front-runner-v1';
  const FRONT_RUNNER_STYLE = 1;
  const PROFILE_MATCH_FIELDS = [
    'course_distance', 'distance_type', 'ground_type', 'track_id', 'rotation',
    'season', 'ground_condition', 'weather', 'time', 'is_basis_distance',
    'is_tight_track', 'corner_count'
  ];
  const CONTEXT_FIELDS = [
    ...new Set([
      ...skillCore.STATIC_COURSE_FIELDS,
      'running_style', 'grade', 'course_distance', 'distance_type', 'ground_type',
      'rotation', 'season', 'ground_condition', 'weather', 'time', 'track_id',
      'is_abroad', 'is_dirtgrade', 'is_basis_distance', 'is_tight_track',
      'corner_count'
    ])
  ];
  const PHASE_FIELDS = new Set([
    'phase', 'phase_random', 'phase_firsthalf_random', 'phase_laterhalf_random',
    'phase_firstquarter_random', 'phase_straight_random', 'phase_corner_random',
    'phase_firsthalf'
  ]);
  const STYLE_TAGS = ['run', 'ldr', 'btw', 'cha'];
  const DISTANCE_TAGS = ['sho', 'mil', 'med', 'lng'];
  const GROUND_TAGS = ['tur', 'dir'];
  const DISTANCE_TAG_BY_ID = { 1: 'sho', 2: 'mil', 3: 'med', 4: 'lng' };
  const GROUND_TAG_BY_ID = { 1: 'tur', 2: 'dir' };
  const DEFAULT_LIMITS = {
    recovery: 8,
    terminalAcceleration: 10,
    openingPositioning: 10,
    middleSpeed: 12,
    preTerminalSpeed: 10,
    green: Number.POSITIVE_INFINITY,
    insurance: 8
  };
  const CATEGORY_DEFINITIONS = [
    {
      id: 'recovery',
      label: '足耐／回復',
      weight: 500,
      description: '依賽道距離挑選可用回復；實際需求仍應交由足耐模擬器判定。'
    },
    {
      id: 'terminalAcceleration',
      label: '終盤加速',
      weight: 450,
      description: '只收錄條件可在本賽道成立，且於終盤、最終彎道或最後衝刺發動的加速。'
    },
    {
      id: 'openingPositioning',
      label: '序盤搶位',
      weight: 400,
      description: '領頭在序盤建立位置所需的起跑、加速、橫移與速度技能。'
    },
    {
      id: 'middleSpeed',
      label: '中盤速度',
      weight: 350,
      description: '用於維持領先、避免被超越並為終盤保留位置優勢的速度技能。'
    },
    {
      id: 'preTerminalSpeed',
      label: '終盤前速度',
      weight: 375,
      description: '優先辨識中盤後半與接近終盤前發動的速度技能。'
    },
    {
      id: 'green',
      label: '賽道綠技',
      weight: 300,
      description: '由方向、季節、天氣、場地、距離與賽場條件動態產生，不沿用其他賽道清單。'
    },
    {
      id: 'insurance',
      label: '保險與其他技能',
      weight: 200,
      description: '條件可成立，但不屬於主要時間窗的速度、加速、視野或穩定性技能。'
    }
  ];

  function numberOrNull(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function firstDefined(...values) {
    return values.find(value => value !== undefined && value !== null);
  }

  function copyKnownContextFields(source) {
    const context = {};
    for (const field of CONTEXT_FIELDS) {
      if (Object.hasOwn(source || {}, field)) context[field] = source[field];
    }
    return context;
  }

  function normalizeRaceContext(raceOrContext, options = {}) {
    const race = raceOrContext || {};
    const course = race.course || {};
    const explicitContext = race.context
      ? copyKnownContextFields(race.context)
      : copyKnownContextFields(race);
    const mappedContext = {
      course_distance: firstDefined(race.distance, race.courseDistance, course.distance),
      distance_type: firstDefined(race.distanceType, course.distanceType),
      ground_type: firstDefined(race.groundType, course.groundType),
      rotation: firstDefined(race.rotation, course.rotation),
      season: firstDefined(race.season, course.season),
      ground_condition: firstDefined(race.groundCondition, course.groundCondition),
      weather: firstDefined(race.weather, course.weather),
      time: firstDefined(race.time, course.time),
      track_id: firstDefined(race.trackId, course.trackId),
      grade: race.grade,
      is_abroad: race.isAbroad,
      is_dirtgrade: race.isDirtGrade,
      is_basis_distance: race.isBasisDistance,
      is_tight_track: race.isTightTrack,
      corner_count: firstDefined(race.cornerCount, course.cornerCount)
    };
    const context = { always: 1 };
    for (const [field, value] of Object.entries(mappedContext)) {
      if (value !== undefined && value !== null && Number.isFinite(Number(value))) {
        context[field] = value;
      }
    }
    Object.assign(context, explicitContext, copyKnownContextFields(options.context));
    context.running_style = numberOrNull(firstDefined(
      options.runningStyle,
      options.style,
      context.running_style,
      FRONT_RUNNER_STYLE
    )) || FRONT_RUNNER_STYLE;
    return context;
  }

  function summarizeRace(raceOrContext, context) {
    const race = raceOrContext || {};
    const course = race.course || {};
    return {
      id: firstDefined(race.catalogRaceId, race.catalogId, race.gameToraRaceId, race.id, null),
      profileId: typeof race.id === 'string' ? race.id : null,
      courseId: firstDefined(race.courseId, course.courseId, null),
      nameZhTw: firstDefined(race.nameZhTw, race.name, null),
      nameEn: firstDefined(race.nameEn, null),
      trackId: numberOrNull(context.track_id),
      distance: numberOrNull(context.course_distance),
      distanceType: numberOrNull(context.distance_type),
      groundType: numberOrNull(context.ground_type),
      rotation: numberOrNull(context.rotation)
    };
  }

  function deriveRedFactors(context) {
    const distance = {
      1: ['short', '短距離'],
      2: ['mile', '一哩'],
      3: ['medium', '中距離'],
      4: ['long', '長距離']
    }[Number(context?.distance_type)];
    const ground = {
      1: ['turf', '草地'],
      2: ['dirt', '泥地']
    }[Number(context?.ground_type)];
    return [
      distance && {
        id: `distance-${distance[0]}`,
        type: 'distance',
        value: Number(context.distance_type),
        label: `${distance[1]}因子`,
        priority: 'S',
        recommendedStars: 3,
        reason: `目標賽道為${distance[1]}，距離適性直接影響速度與加速度修正。`
      },
      ground && {
        id: `ground-${ground[0]}`,
        type: 'ground',
        value: Number(context.ground_type),
        label: `${ground[1]}因子`,
        priority: Number(context.ground_type) === 2 ? 'S' : 'A',
        recommendedStars: 3,
        reason: `目標賽道為${ground[1]}，用紅因子確保場地適性。`
      }
    ].filter(Boolean);
  }

  function clausesForGroups(groups) {
    return (groups || []).flatMap(group =>
      [group.precondition, group.condition].filter(Boolean).flatMap(expression =>
        skillCore.parseExpression(expression).any.flatMap(branch => branch.all || [])
      )
    ).filter(clause => clause.valid);
  }

  function conditionsForGroups(groups) {
    return [...new Set((groups || []).flatMap(group =>
      [group.precondition, group.condition].filter(Boolean)
    ))];
  }

  function effectsForGroups(groups) {
    return (groups || []).flatMap(group => group.effects || []);
  }

  function effectValues(effects, type, predicate = value => value > 0) {
    return (effects || [])
      .filter(effect => Number(effect.type) === Number(type))
      .map(effect => Number(effect.value))
      .filter(value => Number.isFinite(value) && predicate(value));
  }

  function hasPositiveEffect(effects, type) {
    return effectValues(effects, type).length > 0;
  }

  function tagCompatible(skill, context) {
    const tags = new Set(skill?.tags || []);
    const presentStyleTags = STYLE_TAGS.filter(tag => tags.has(tag));
    if (presentStyleTags.length && !tags.has('run')) return false;
    const presentDistanceTags = DISTANCE_TAGS.filter(tag => tags.has(tag));
    const wantedDistanceTag = DISTANCE_TAG_BY_ID[Number(context?.distance_type)];
    if (presentDistanceTags.length && wantedDistanceTag && !tags.has(wantedDistanceTag)) return false;
    const presentGroundTags = GROUND_TAGS.filter(tag => tags.has(tag));
    const wantedGroundTag = GROUND_TAG_BY_ID[Number(context?.ground_type)];
    if (presentGroundTags.length && wantedGroundTag && !tags.has(wantedGroundTag)) return false;
    return true;
  }

  function feasibleGroups(skill, context) {
    return (skill?.conditionGroups || []).filter(group =>
      skillCore.evaluateConditionGroup(group, context) !== skillCore.FALSE
    );
  }

  function phaseValues(groups) {
    const phases = new Set();
    for (const clause of clausesForGroups(groups).filter(item => PHASE_FIELDS.has(item.field))) {
      for (let phase = 0; phase <= 3; phase += 1) {
        if (skillCore.evaluateClause(clause, { [clause.field]: phase }) === skillCore.TRUE) {
          phases.add(phase);
        }
      }
    }
    return phases;
  }

  function hasConditionField(groups, fields) {
    const wanted = new Set(Array.isArray(fields) ? fields : [fields]);
    return clausesForGroups(groups).some(clause => wanted.has(clause.field));
  }

  function hasClause(groups, predicate) {
    return clausesForGroups(groups).some(predicate);
  }

  function hasTerminalTiming(skill, groups, context) {
    const tags = new Set(skill?.tags || []);
    const phases = phaseValues(groups);
    if (['l_2', 'l_3', 'f_c', 'f_s'].some(tag => tags.has(tag))) return true;
    if (phases.has(2) || phases.has(3)) return true;
    if (hasConditionField(groups, [
      'is_finalcorner', 'is_finalcorner_random', 'is_finalcorner_laterhalf',
      'is_last_straight', 'is_last_straight_onetime', 'is_lastspurt', 'lastspurt'
    ])) return true;
    const distance = Number(context?.course_distance);
    return Number.isFinite(distance) && hasClause(groups, clause =>
      clause.field === 'remain_distance'
      && ['<', '<='].includes(clause.operator)
      && clause.value <= distance / 3
    );
  }

  function hasOpeningTiming(skill, groups) {
    const tags = new Set(skill?.tags || []);
    const phases = phaseValues(groups);
    if (tags.has('l_0') || phases.has(0)) return true;
    return hasConditionField(groups, [
      'activate_count_start', 'is_badstart', 'start_dash', 'post_number'
    ]);
  }

  function hasPreTerminalTiming(skill, groups, context) {
    if (hasClause(groups, clause =>
      clause.field === 'phase_laterhalf_random'
      && clause.operator === '=='
      && clause.value === 1
    )) return true;
    if (hasClause(groups, clause =>
      clause.field === 'distance_rate'
      && ['>', '>='].includes(clause.operator)
      && clause.value >= 45
      && clause.value < 70
    )) return true;
    const distance = Number(context?.course_distance);
    return Number.isFinite(distance) && hasClause(groups, clause =>
      clause.field === 'remain_distance'
      && ['<', '<='].includes(clause.operator)
      && clause.value <= distance * 0.45
      && clause.value > distance / 3
    );
  }

  function hasMiddleTiming(skill, groups) {
    const tags = new Set(skill?.tags || []);
    const phases = phaseValues(groups);
    if (tags.has('l_1') || phases.has(1)) return true;
    return hasConditionField(groups, [
      'corner_random', 'all_corner_random', 'straight_random',
      'phase_corner_random', 'phase_straight_random'
    ]);
  }

  function terminalActivationGeometry(skill, groups, context, course) {
    const distance = Number(course?.length || context?.course_distance);
    const terminalStart = Number(course?.spurtStart?.meters || (distance * 2 / 3));
    if (!Number.isFinite(distance) || !Number.isFinite(terminalStart)) return null;
    const ranges = [];
    const tags = new Set(skill?.tags || []);
    const lastCorner = Array.isArray(course?.corners) ? course.corners.at(-1) : null;
    const lastStraight = Array.isArray(course?.straights) ? course.straights.at(-1) : null;
    if (
      tags.has('f_c')
      || hasConditionField(groups, [
        'is_finalcorner', 'is_finalcorner_random', 'is_finalcorner_laterhalf'
      ])
    ) {
      if (lastCorner) ranges.push({ start: Number(lastCorner.start), end: Number(lastCorner.end), label: '最終彎道' });
    }
    if (
      tags.has('f_s')
      || hasConditionField(groups, [
        'is_last_straight', 'is_last_straight_onetime', 'is_lastspurt', 'lastspurt'
      ])
    ) {
      if (lastStraight) ranges.push({ start: Number(lastStraight.start), end: Number(lastStraight.end), label: '最終直線' });
    }
    const phases = phaseValues(groups);
    if (tags.has('l_2') || tags.has('l_3') || phases.has(2) || phases.has(3)) {
      ranges.push({ start: terminalStart, end: distance, label: '終盤階段' });
    }
    for (const clause of clausesForGroups(groups)) {
      if (
        clause.field === 'remain_distance'
        && ['<', '<='].includes(clause.operator)
        && Number.isFinite(Number(clause.value))
      ) {
        ranges.push({
          start: Math.max(0, distance - Number(clause.value)),
          end: distance,
          label: `剩餘 ${Number(clause.value)}m`
        });
      }
    }
    if (!ranges.length) return null;
    const effectiveEnd = Math.min(distance, terminalStart + Math.max(160, distance * 0.12));
    const scored = ranges.map(range => {
      const overlap = Math.max(0, Math.min(range.end, effectiveEnd) - Math.max(range.start, terminalStart));
      const window = Math.max(1, Math.min(range.end, effectiveEnd) - Math.max(0, range.start));
      return { ...range, overlap, ratio: overlap / window };
    });
    const best = scored.sort((a, b) => b.ratio - a.ratio || b.overlap - a.overlap)[0];
    const effective = scored.some(range => range.end > terminalStart && range.overlap > 0);
    const timingBonus = effective ? Math.round(140 * best.ratio) : -180;
    return {
      effective,
      terminalStart,
      effectiveEnd,
      timingBonus,
      label: effective
        ? `${best.label}與終盤起點 ${terminalStart}m 有效窗重疊`
        : `發動區間未覆蓋終盤起點 ${terminalStart}m`
    };
  }

  function isBeneficialSkill(skill, groups) {
    const effects = effectsForGroups(groups);
    if ([9, 22, 27, 28, 31, 35].some(type => hasPositiveEffect(effects, type))) return true;
    if (effectValues(effects, 10, value => value > 0 && value <= 9000).length) return true;
    if ([1, 2, 3, 4, 5, 8, 32].some(type => hasPositiveEffect(effects, type))) return true;
    return effectValues(effects, 29, value => value < 0).length > 0;
  }

  function classifySkill(skill, context, options = {}) {
    if (!skill?.availableOnServer) return null;
    if (!tagCompatible(skill, context)) return null;
    const groups = feasibleGroups(skill, context);
    if (!groups.length || !isBeneficialSkill(skill, groups)) return null;
    if (options.staticSkillIds?.has(Number(skill.id))) return 'green';

    const effects = effectsForGroups(groups);
    const recovery = hasPositiveEffect(effects, 9);
    const acceleration = hasPositiveEffect(effects, 31);
    const speed = hasPositiveEffect(effects, 27) || hasPositiveEffect(effects, 22);
    const positioning = [28, 35].some(type => hasPositiveEffect(effects, type))
      || effectValues(effects, 10, value => value > 0 && value <= 9000).length > 0;
    const terminalGeometry = terminalActivationGeometry(skill, groups, context, options.course);
    const terminal = hasTerminalTiming(skill, groups, context)
      && terminalGeometry?.effective !== false;
    const opening = hasOpeningTiming(skill, groups);
    const preTerminal = hasPreTerminalTiming(skill, groups, context);
    const middle = hasMiddleTiming(skill, groups);

    if (recovery) return 'recovery';
    if (acceleration && terminal) return 'terminalAcceleration';
    if ((positioning || speed || acceleration) && opening) return 'openingPositioning';
    if (speed && preTerminal && !terminal) return 'preTerminalSpeed';
    if (speed && middle && !terminal) return 'middleSpeed';
    return 'insurance';
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

  function maximum(values) {
    return values.length ? Math.max(...values) : 0;
  }

  function scoreSkill(skill, categoryId, groups, context, geometry = null) {
    const effects = effectsForGroups(groups);
    const tags = new Set(skill?.tags || []);
    let score = 0;
    score += maximum(effectValues(effects, 9)) * 1.4;
    score += maximum(effectValues(effects, 31)) / 8;
    score += maximum(effectValues(effects, 27)) / 10;
    score += maximum(effectValues(effects, 22)) / 8;
    score += maximum(effectValues(effects, 28));
    score += maximum(effectValues(effects, 35)) / 10;
    const reaction = effectValues(effects, 10, value => value > 0 && value <= 9000);
    if (reaction.length) score += (15000 - Math.min(...reaction)) / 8;
    score += Math.min(sourceCount(skill), 12) * 5;
    const cost = Number(skill?.cost);
    if (Number.isFinite(cost)) score += Math.max(0, 240 - cost) / 4;
    if ((skill?.tags || []).includes('dbf')) score -= 25;
    if (conditionsForGroups(groups).some(condition => /random_lot|popularity/.test(condition))) {
      score -= 20;
    }
    if (tags.has('run')) score += 30;
    if (tags.has(DISTANCE_TAG_BY_ID[Number(context?.distance_type)])) score += 35;
    if (tags.has(GROUND_TAG_BY_ID[Number(context?.ground_type)])) score += 55;
    if (categoryId === 'terminalAcceleration') score += 80 + Number(geometry?.timingBonus || 0);
    if (categoryId === 'preTerminalSpeed') score += 40;
    if (categoryId === 'green') score += 30;
    return Math.round(score * 100) / 100;
  }

  function activationWindow(categoryId) {
    return {
      recovery: 'race-dependent',
      terminalAcceleration: 'late-race',
      openingPositioning: 'early-race',
      middleSpeed: 'mid-race',
      preTerminalSpeed: 'late-mid-race',
      green: 'always-static',
      insurance: 'variable'
    }[categoryId] || 'variable';
  }

  function effectLabel(groups) {
    const effects = effectsForGroups(groups);
    const labels = [];
    const recovery = maximum(effectValues(effects, 9));
    const acceleration = maximum(effectValues(effects, 31));
    const speed = maximum(effectValues(effects, 27));
    const instantSpeed = maximum(effectValues(effects, 22));
    if (recovery) labels.push(`回復 ${(recovery / 100).toFixed(1)}%`);
    if (acceleration) labels.push(`加速度 +${(acceleration / 10000).toFixed(2)}`);
    if (speed) labels.push(`速度 +${(speed / 10000).toFixed(2)}`);
    if (instantSpeed) labels.push(`即時速度 +${(instantSpeed / 10000).toFixed(2)}`);
    if (hasPositiveEffect(effects, 28)) labels.push('橫移強化');
    if (effectValues(effects, 10, value => value > 0 && value <= 9000).length) labels.push('起跑改善');
    if (!labels.length && [1, 2, 3, 4, 5, 32].some(type => hasPositiveEffect(effects, type))) {
      labels.push('能力值／穩定性提升');
    }
    return labels.join('、') || '條件型增益';
  }

  function categoryReason(categoryId) {
    return {
      recovery: '提供足耐或回復，但是否必帶應由距離、耐力、根性與回復量共同判斷。',
      terminalAcceleration: '條件指向終盤或最後衝刺，可作為領頭主要加速候選。',
      openingPositioning: '在序盤改善起跑、加速、速度或走位，用來爭取領頭位置。',
      middleSpeed: '於中盤提供速度，協助維持領先與接續終盤。',
      preTerminalSpeed: '在中盤後半或終盤切入前提供速度，改善進入終盤的位置。',
      green: '靜態賽道條件完全符合，開賽即生效。',
      insurance: '條件在本賽道可成立，但發動時間或收益較不固定。'
    }[categoryId];
  }

  function skillItem(skill, categoryId, context, options = {}) {
    const groups = feasibleGroups(skill, context);
    const geometry = categoryId === 'terminalAcceleration'
      ? terminalActivationGeometry(skill, groups, context, options.course)
      : null;
    return {
      id: Number(skill.id),
      familyId: numberOrNull(skill.familyId),
      factorId: Number(skill.id),
      name: skill.nameZhTw || skill.name || skill.nameEn || String(skill.id),
      nameZhTw: skill.nameZhTw || skill.name || null,
      nameEn: skill.nameEn || null,
      rarity: numberOrNull(skill.rarity),
      cost: numberOrNull(skill.cost),
      priority: null,
      categoryId,
      activationWindow: activationWindow(categoryId),
      effectLabel: effectLabel(groups),
      reason: [categoryReason(categoryId), geometry?.label].filter(Boolean).join(' '),
      conditionSummary: conditionsForGroups(groups),
      score: scoreSkill(skill, categoryId, groups, context, geometry),
      terminalGeometry: geometry,
      sourceCount: sourceCount(skill),
      source: 'generated'
    };
  }

  function compareSkillItems(a, b) {
    return b.score - a.score
      || b.sourceCount - a.sourceCount
      || Number(a.id) - Number(b.id);
  }

  function deduplicateFamilies(items) {
    const itemsByFamily = new Map();
    for (const item of items) {
      const key = String(item.familyId || item.id);
      if (!itemsByFamily.has(key)) itemsByFamily.set(key, []);
      itemsByFamily.get(key).push(item);
    }
    const factorVariants = [...itemsByFamily.values()].map(familyItems =>
      [...familyItems].sort((a, b) => {
        const aCost = Number.isFinite(Number(a.cost)) ? Number(a.cost) : Number.MAX_SAFE_INTEGER;
        const bCost = Number.isFinite(Number(b.cost)) ? Number(b.cost) : Number.MAX_SAFE_INTEGER;
        return aCost - bCost
          || a.score - b.score
          || Number(b.id) - Number(a.id);
      })[0]
    );
    return factorVariants.sort(compareSkillItems);
  }

  function addPriorities(items) {
    return items.map((item, index) => ({
      ...item,
      priority: index < 2 ? 'S' : index < 5 ? 'A' : 'B'
    }));
  }

  function normalFactorCandidate(skill, options) {
    if (options.includeNonStandardSkills) return true;
    const id = Number(skill?.id);
    return id >= 200000 && id < 300000;
  }

  function generateCategories(catalog, context, options = {}) {
    const rarities = options.rarities || [1];
    const staticSkills = skillCore.findStaticCourseSkills(catalog, context, {
      rarities,
      positiveOnly: true,
      requireSpecificCondition: true
    }).filter(skill => normalFactorCandidate(skill, options));
    const staticSkillIds = new Set(staticSkills.map(skill => Number(skill.id)));
    const buckets = Object.fromEntries(CATEGORY_DEFINITIONS.map(category => [category.id, []]));

    for (const skill of catalog?.skills || []) {
      if (!rarities.includes(Number(skill.rarity))) continue;
      if (!normalFactorCandidate(skill, options)) continue;
      const categoryId = classifySkill(skill, context, {
        staticSkillIds,
        course: options.course
      });
      if (!categoryId) continue;
      buckets[categoryId].push(skillItem(skill, categoryId, context, options));
    }

    const limits = { ...DEFAULT_LIMITS, ...(options.limits || {}) };
    const categories = CATEGORY_DEFINITIONS.map(definition => {
      const ranked = addPriorities(deduplicateFamilies(buckets[definition.id] || []));
      const limit = Number(limits[definition.id]);
      const skills = Number.isFinite(limit) ? ranked.slice(0, Math.max(0, limit)) : ranked;
      return {
        ...definition,
        candidateCount: ranked.length,
        skills
      };
    });
    return { categories, staticSkillIds };
  }

  function numericRaceId(race) {
    const id = firstDefined(
      race?.catalogRaceId,
      race?.catalogId,
      race?.gameToraRaceId,
      race?.id
    );
    return Number.isFinite(Number(id)) ? Number(id) : null;
  }

  function profileMatchDetails(profile, raceOrContext, context) {
    if (!profile?.context) {
      return { matches: false, reason: 'profile-has-no-race-context', comparedFields: [] };
    }
    const raceId = numericRaceId(raceOrContext);
    if (profile.catalogRaceId != null && raceId != null
      && Number(profile.catalogRaceId) !== raceId) {
      return { matches: false, reason: 'catalog-race-id-mismatch', comparedFields: [] };
    }
    const raceCourseId = firstDefined(raceOrContext?.courseId, raceOrContext?.course?.courseId);
    if (profile.courseId != null && raceCourseId != null
      && Number(profile.courseId) !== Number(raceCourseId)) {
      return { matches: false, reason: 'course-id-mismatch', comparedFields: [] };
    }

    const comparedFields = PROFILE_MATCH_FIELDS.filter(field =>
      Object.hasOwn(profile.context, field) && Object.hasOwn(context, field)
    );
    const mismatch = comparedFields.find(field =>
      Number(profile.context[field]) !== Number(context[field])
    );
    if (mismatch) {
      return {
        matches: false,
        reason: `context-mismatch:${mismatch}`,
        comparedFields
      };
    }
    const discriminatorCount = [
      'course_distance', 'distance_type', 'ground_type', 'track_id'
    ].filter(field => comparedFields.includes(field)).length;
    if (discriminatorCount < 3) {
      return {
        matches: false,
        reason: 'insufficient-course-discriminators',
        comparedFields
      };
    }
    return { matches: true, reason: 'race-context-match', comparedFields };
  }

  function profileMatchesRace(profile, raceOrContext, options = {}) {
    const context = options.context || normalizeRaceContext(raceOrContext, options);
    return profileMatchDetails(profile, raceOrContext, context).matches;
  }

  function overrideTargetCategory(profileCategoryId, skillId, staticSkillIds) {
    if (profileCategoryId === 'stamina') return 'recovery';
    if (profileCategoryId === 'terminal') return 'terminalAcceleration';
    if (profileCategoryId === 'opening') return 'openingPositioning';
    if (profileCategoryId === 'middle') return 'middleSpeed';
    if (profileCategoryId === 'preTerminal') return 'preTerminalSpeed';
    if (profileCategoryId === 'efficiency') {
      return staticSkillIds.has(Number(skillId)) ? 'green' : 'insurance';
    }
    return CATEGORY_DEFINITIONS.some(category => category.id === profileCategoryId)
      ? profileCategoryId
      : 'insurance';
  }

  function overrideSkillItem(rawSkill, profileCategory, targetCategoryId, skillById, context) {
    const catalogSkill = skillById.get(Number(rawSkill.id));
    const base = catalogSkill
      ? skillItem(catalogSkill, targetCategoryId, context)
      : {
        id: Number(rawSkill.id),
        familyId: null,
        factorId: Number(rawSkill.id),
        name: String(rawSkill.id),
        nameZhTw: null,
        nameEn: null,
        rarity: null,
        cost: null,
        priority: null,
        categoryId: targetCategoryId,
        activationWindow: activationWindow(targetCategoryId),
        effectLabel: null,
        reason: null,
        conditionSummary: [],
        // Generated profile entries still need a finite domain score. The
        // override/source ordering below already gives them precedence.
        score: 1000,
        sourceCount: 0,
        source: 'generated'
      };
    const rawScore = Number(rawSkill.score);
    const baseScore = Number(base.score);
    const finiteScore = Number.isFinite(rawScore)
      && Math.abs(rawScore) < Number.MAX_SAFE_INTEGER
      ? rawScore
      : Number.isFinite(baseScore)
        ? baseScore
        : 1000;
    const sortPriority = rawSkill.sortPriority != null
      ? rawSkill.sortPriority
      : Number.MAX_SAFE_INTEGER;
    return {
      ...base,
      ...rawSkill,
      id: Number(rawSkill.id),
      factorId: rawSkill.factorId == null ? base.factorId : Number(rawSkill.factorId),
      name: base.name,
      nameZhTw: base.nameZhTw,
      nameEn: base.nameEn,
      categoryId: targetCategoryId,
      profileCategoryId: profileCategory.id,
      priority: rawSkill.priority || 'S',
      reason: rawSkill.reason || base.reason,
      effectLabel: rawSkill.effectLabel || base.effectLabel,
      source: 'profile-override',
      profileOverride: true,
      sortPriority,
      score: finiteScore
    };
  }

  function applyProfileOverride(categories, profile, catalog, context, staticSkillIds) {
    const profileCategories = profile?.skillPlan?.categories || [];
    const allOverrideSkills = profileCategories.flatMap(category =>
      (category.skills || []).map(skill => ({ category, skill }))
    );
    const overriddenIds = new Set(allOverrideSkills.flatMap(({ skill }) =>
      [skill.id, skill.factorId].filter(value => value != null).map(value => String(Number(value)))
    ));
    const categoryById = new Map(categories.map(category => [
      category.id,
      {
        ...category,
        skills: category.skills.filter(skill =>
          !overriddenIds.has(String(Number(skill.id)))
          && !overriddenIds.has(String(Number(skill.factorId)))
        )
      }
    ]));
    const skillById = new Map((catalog?.skills || []).map(skill => [Number(skill.id), skill]));

    for (const { category: profileCategory, skill } of allOverrideSkills) {
      const targetCategoryId = overrideTargetCategory(
        profileCategory.id,
        skill.id,
        staticSkillIds
      );
      const targetCategory = categoryById.get(targetCategoryId);
      if (!targetCategory) continue;
      targetCategory.skills.push(overrideSkillItem(
        skill,
        profileCategory,
        targetCategoryId,
        skillById,
        context
      ));
    }
    return CATEGORY_DEFINITIONS.map(definition => {
      const category = categoryById.get(definition.id);
      return {
        ...category,
        skills: [...category.skills].sort((a, b) => {
          const aOverride = a.source === 'profile-override' ? 1 : 0;
          const bOverride = b.source === 'profile-override' ? 1 : 0;
          if (aOverride && bOverride) {
            const aSortPriority = Number.isFinite(Number(a.sortPriority))
              ? Number(a.sortPriority)
              : Number.MIN_SAFE_INTEGER;
            const bSortPriority = Number.isFinite(Number(b.sortPriority))
              ? Number(b.sortPriority)
              : Number.MIN_SAFE_INTEGER;
            return bSortPriority - aSortPriority
              || Number(b.sourceCount || 0) - Number(a.sourceCount || 0)
              || Number(a.id) - Number(b.id);
          }
          return bOverride - aOverride || compareSkillItems(a, b);
        })
      };
    });
  }

  function buildRaceStrategy(catalog, raceOrContext, options = {}) {
    const context = normalizeRaceContext(raceOrContext, {
      ...options,
      runningStyle: FRONT_RUNNER_STYLE
    });
    const courseId = firstDefined(
      raceOrContext?.courseId,
      raceOrContext?.course?.id,
      raceOrContext?.course?.courseId
    );
    const course = raceOrContext?.course || (catalog?.racetracks || [])
      .flatMap(track => track.courses || [])
      .find(item => Number(item.id) === Number(courseId)) || null;
    const generated = generateCategories(catalog, context, { ...options, course });
    const profile = options.profileOverride || options.profile || null;
    const match = profile
      ? profileMatchDetails(profile, raceOrContext, context)
      : { matches: false, reason: 'no-profile-override', comparedFields: [] };
    const categories = match.matches
      ? applyProfileOverride(
        generated.categories,
        profile,
        catalog,
        context,
        generated.staticSkillIds
      )
      : generated.categories;
    const green = categories.find(category => category.id === 'green');
    return {
      schemaVersion: 1,
      engine: ENGINE_ID,
      source: match.matches ? 'generated-with-profile-override' : 'generated',
      runningStyle: FRONT_RUNNER_STYLE,
      race: summarizeRace(raceOrContext, context),
      context,
      redFactors: deriveRedFactors(context),
      staticSkillIds: (green?.skills || []).map(skill => Number(skill.id)),
      categories,
      staminaModel: match.matches ? profile?.skillPlan?.staminaModel || null : null,
      profileOverride: {
        requested: Boolean(profile),
        applied: match.matches,
        profileId: profile?.id || null,
        reason: match.reason,
        comparedFields: match.comparedFields
      }
    };
  }

  return {
    ENGINE_ID,
    FRONT_RUNNER_STYLE,
    CATEGORY_DEFINITIONS,
    DEFAULT_LIMITS,
    normalizeRaceContext,
    deriveRedFactors,
    classifySkill,
    profileMatchesRace,
    buildRaceStrategy
  };
});
