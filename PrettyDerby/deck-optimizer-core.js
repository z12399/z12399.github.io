(function (root, factory) {
  function optionalRequire(path) {
    try {
      return typeof module !== 'undefined' && module.exports ? require(path) : null;
    } catch (error) {
      // The acquisition core is being introduced independently.  Keep the
      // optimizer loadable for focused legacy tests until that file lands;
      // callers must then use the explicit fail-closed adapter below.
      return null;
    }
  }
  const skillCore = typeof module !== 'undefined' && module.exports
    ? require('./skill-core.js')
    : root?.SKILL_CORE;
  const levelFixtures = typeof module !== 'undefined' && module.exports
    ? require('./data/support-card-level-fixtures.js')
    : root?.SUPPORT_CARD_LEVEL_FIXTURES;
  const supportUniqueCore = typeof module !== 'undefined' && module.exports
    ? require('./support-unique-core.js')
    : root?.SUPPORT_UNIQUE_CORE;
  const skillAcquisitionCore = optionalRequire('./skill-acquisition-core.js') || root?.SKILL_ACQUISITION_CORE || null;
  const api = factory(skillCore, levelFixtures, supportUniqueCore, skillAcquisitionCore);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DECK_OPTIMIZER_CORE = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (skillCore, levelFixtures, supportUniqueCore, skillAcquisitionCore) {
  const EPSILON = 1e-9;
  // Runtime persistence currently stores this as a numeric package-model
  // version. Keep one bumped constant for every deck-level result/package
  // identity so a scoring-contract change cannot reuse stale cached decks.
  const MODEL_VERSION = 5;
  const MAX_REASONABLE_DOMAIN_WEIGHT = 1000000;
  const CONTEXTUAL_GOLD_SCORE_DIVISOR = 100;
  const MAX_CONTEXTUAL_GOLD_BONUS = 6;
  const ACQUISITION_MODEL_VERSION = skillAcquisitionCore?.MODEL_VERSION || 'skill-acquisition-unavailable';
  const DEFAULT_MAX_LEVEL = { R: 40, SR: 45, SSR: 50 };
  const DEFAULT_MAX_LEVEL_BY_LB = {
    R: [20, 25, 30, 35, 40],
    SR: [25, 30, 35, 40, 45],
    SSR: [30, 35, 40, 45, 50]
  };
  const COMPETITIVE_RARITY = 'SSR';
  const COMPETITIVE_SOURCE = 'gacha';
  const FIVE_AXIS_WEIGHTS = {
    trainingOutput: 0.30,
    skillPtEconomy: 0.15,
    necessarySkills: 0.25,
    hintEfficiency: 0.15,
    deckScenarioFit: 0.15
  };
  const STAT_UTILITY_POLICY = Object.freeze({
    id: 'zh-tw-user-confirmed-double-softcap-v1',
    threshold: 1200,
    trainingGainAboveThreshold: 0.5,
    raceEffectAboveThreshold: 0.5
  });
  const MAX_STAT_TO_SKILL_PT_WEIGHT_TRANSFER = 0.075;
  const STANDARD_TRAINING_BENCHMARK = {
    // Lv5 base rows mirror the static training table retained with the Kua
    // research packet.  The calculation below follows the same multiplier
    // order as UmaSim's training calculator: base + flat bonus, friendship,
    // motivation, training effect, then participant count.  This remains a
    // comparison benchmark rather than a complete turn-by-turn simulation.
    level5BaseStats: {
      Speed: { speed: 14, stamina: 0, power: 7, guts: 0, wisdom: 0 },
      Stamina: { speed: 0, stamina: 13, power: 0, guts: 6, wisdom: 0 },
      Power: { speed: 0, stamina: 7, power: 12, guts: 0, wisdom: 0 },
      Guts: { speed: 5, stamina: 0, power: 5, guts: 12, wisdom: 0 },
      Wisdom: { speed: 4, stamina: 0, power: 0, guts: 0, wisdom: 13 }
    },
    motivationBase: 0.2,
    soloParticipantMultiplier: 1.05,
    specialtyOtherWeight: 10000,
    specialtyNoneWeight: 5000,
    initialBondScorePerPoint: 1.5,
    wisdomRecoveryScorePerPoint: 10,
    baseSkillPt: 120,
    specialtyFrequencyPerPoint: 0.0025,
    initialBondFrequencyPerPoint: 0.0015,
    maximumTrainingFrequency: 1.35,
    trainingScorePerEffectiveGain: 16
  };
  const STRICT_PRIMARY_POLICY = {
    // Reference maturity is audit-only. Actual Lv/LB resolves the effect
    // curve; a low-LB card that clears the measured target-aware performance
    // gate must remain eligible.
    minimumLevel: 45,
    minimumLimitBreak: 3,
    // Percentiles are centred on ties. 0.70 keeps the primary tier meaningfully
    // modern while leaving enough exact, mature cards for the current Oi 5+1;
    // tests that deliberately use an all-identical synthetic cohort can opt
    // into a lower fixture-only threshold.
    minimumTrainingPercentile: 0.25,
    minimumCompositePercentile: 0.70
  };
  const CONTEXTUAL_GOLD_BENCHMARK = {
    // Explicit course-plan routes keep their declared weight. This smaller
    // fallback gives a compatible support event gold a visible, auditable
    // necessary-skill value when the plan has not enumerated that family.
    baseWeight: 180,
    scopedMultiplier: 1,
    universalMultiplier: 0.45,
    otherMultiplier: 0.3
  };
  const MODES = [
    { id: 'balanced', label: '綜合推薦' },
    { id: 'panel', label: '面板／Pt' },
    { id: 'skill', label: '技能互補' },
    { id: 'recovery', label: '耐力穩定' }
  ];
  const DEFAULT_TYPE_TEMPLATE = ['Speed', 'Speed', 'Stamina', 'Stamina', 'Wisdom', 'Group'];
  const MATURE_FRIENDSHIP_TRAINING_BENCHMARK_NAME = 'mature-friendship-training';
  const MATURE_FRIENDSHIP_TRAINING_BENCHMARK_PURPOSE = 'comparison-only-not-complete-simulation';

  function number(value, fallback = null) {
    if (value === null || value === undefined || value === '') return fallback;
    const result = Number(value);
    return Number.isFinite(result) ? result : fallback;
  }

  function resolveStatUtilityPolicy(options = {}) {
    const supplied = options.statUtilityPolicy || {};
    return {
      id: supplied.id || STAT_UTILITY_POLICY.id,
      threshold: Math.max(0, number(supplied.threshold, STAT_UTILITY_POLICY.threshold)),
      trainingGainAboveThreshold: clamp(number(
        supplied.trainingGainAboveThreshold,
        STAT_UTILITY_POLICY.trainingGainAboveThreshold
      ), 0, 1),
      raceEffectAboveThreshold: clamp(number(
        supplied.raceEffectAboveThreshold,
        STAT_UTILITY_POLICY.raceEffectAboveThreshold
      ), 0, 1)
    };
  }

  function expectedStatsForInput(input = {}) {
    return input.expectedStats || input.battleUma?.expectedStats || input.battleUma?.stats || {};
  }

  function statSaturationShare(input = {}) {
    const policy = resolveStatUtilityPolicy(input);
    const expected = expectedStatsForInput(input);
    const values = ['speed', 'stamina', 'power', 'guts', 'wisdom']
      .map(axis => number(expected?.[axis], null))
      .filter(Number.isFinite);
    if (!values.length) return 0;
    return values.reduce((sum, value) => sum + (value >= policy.threshold ? 1 : 0), 0)
      / values.length;
  }

  function fiveAxisWeightsForInput(input = {}) {
    const saturationShare = statSaturationShare(input);
    const transfer = MAX_STAT_TO_SKILL_PT_WEIGHT_TRANSFER * saturationShare;
    return {
      ...FIVE_AXIS_WEIGHTS,
      trainingOutput: Math.round((FIVE_AXIS_WEIGHTS.trainingOutput - transfer) * 1000000) / 1000000,
      skillPtEconomy: Math.round((FIVE_AXIS_WEIGHTS.skillPtEconomy + transfer) * 1000000) / 1000000
    };
  }

  // `score` is a race-strategy ordering sentinel in some profile overrides,
  // not a domain weight.  Keep this guard at the optimizer boundary so a
  // malformed/legacy target can never dominate a package by overflow.
  function normalizeDomainWeight(value, fallback = 100) {
    const safeFallback = number(fallback, 100);
    const boundedFallback = Number.isFinite(safeFallback) && safeFallback > 0
      && safeFallback <= MAX_REASONABLE_DOMAIN_WEIGHT
      ? safeFallback
      : 100;
    const candidate = number(value, null);
    if (!Number.isFinite(candidate) || candidate <= 0
      || candidate > MAX_REASONABLE_DOMAIN_WEIGHT
      || candidate >= Number.MAX_SAFE_INTEGER) {
      return boundedFallback;
    }
    return candidate;
  }

  function acquisitionDataIdentity(options = {}) {
    const routeData = options.supportEventRoutes || null;
    const profileData = options.supportProfiles || options.profiles || null;
    let coreIdentity = null;
    for (const method of ['getDataIdentity', 'dataIdentity', 'buildDataIdentity']) {
      if (typeof skillAcquisitionCore?.[method] !== 'function') continue;
      try {
        coreIdentity = skillAcquisitionCore[method]({
          supportEventRoutes: routeData,
          supportProfiles: profileData
        });
        if (coreIdentity) break;
      } catch (error) {
        // A partial checkout must not make deck optimization unusable.
      }
    }
    const routeMetadata = routeData?.metadata || {};
    const profileMetadata = profileData?.metadata || {};
    const routeVersion = coreIdentity?.eventRouteDataVersion
      || coreIdentity?.routeDataVersion
      || routeData?.version
      || routeData?.schemaVersion
      || routeMetadata.parserVersion
      || 'missing';
    const routeHash = coreIdentity?.eventRouteDataHash
      || coreIdentity?.routeDataHash
      || routeData?.hash
      || routeMetadata.hash
      || [
        routeData ? 'present' : 'missing',
        routeData?.schemaVersion || 0,
        routeMetadata.parserVersion || '',
        routeMetadata.generatedAt || '',
        routeMetadata.routeCount || routeData?.routes?.length || 0,
        routeMetadata.complete === true ? 'complete' : 'partial'
      ].join(':');
    const supportProfileVersion = coreIdentity?.supportProfileVersion
      || profileData?.version
      || [
        profileData ? 'present' : 'missing',
        profileData?.schemaVersion || 0,
        profileMetadata.asOf || '',
        profileMetadata.assetHash || '',
        profileMetadata.supportEffectsHash || ''
      ].join(':');
    return {
      modelVersion: coreIdentity?.modelVersion || ACQUISITION_MODEL_VERSION,
      eventRouteDataVersion: String(routeVersion),
      eventRouteDataHash: String(routeHash),
      supportProfileVersion: String(supportProfileVersion),
      coreAvailable: Boolean(skillAcquisitionCore)
    };
  }

  // Source availability is an input to the immutable acquisition graph. Keep
  // that identity separate from the selected six-card package: changing the
  // package must only overlay selected/actual flags on the same graph.
  function acquisitionInventoryIdentity(options = {}) {
    const inventory = options.inventory || options.ownedInventory || {};
    const supportCards = (inventory.supportCards || inventory.cards || [])
      .map(card => [
        Number(card?.id),
        Number(card?.level),
        Number(card?.limitBreak ?? card?.lb)
      ])
      .filter(row => Number.isFinite(row[0]))
      .sort((left, right) => left[0] - right[0]);
    const trainees = (inventory.trainees || [])
      .map(trainee => [Number(trainee?.outfitId ?? trainee?.id)])
      .filter(row => Number.isFinite(row[0]))
      .sort((left, right) => left[0] - right[0]);
    return JSON.stringify({ supportCards, trainees });
  }

  function positiveId(value) {
    const result = number(typeof value === 'object' ? value?.id : value);
    return Number.isFinite(result) && result > 0 ? result : null;
  }

  function uniqueNumbers(values) {
    return [...new Set((values || []).map(positiveId).filter(Number.isFinite))];
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, Number(value) || 0));
  }

  function normalizeSupportType(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    if (/^(intelligence|wisdom|賢|智)/i.test(text)) return 'Wisdom';
    if (/^(friend|友)/i.test(text)) return 'Friend';
    if (/^(group|團隊|隊伍)/i.test(text)) return 'Group';
    if (/^(speed|速度)/i.test(text)) return 'Speed';
    if (/^(stamina|耐力)/i.test(text)) return 'Stamina';
    if (/^(power|力量)/i.test(text)) return 'Power';
    if (/^(guts|根性)/i.test(text)) return 'Guts';
    return text;
  }

  function normalizeLifecyclePhase(raw = {}, fallback = {}) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const facilityLevel = clamp(
      source.facilityLevel ?? source.currentFacilityLevel ?? fallback.facilityLevel ?? 5,
      1,
      5
    );
    const rawCounts = source.ownedSkillCounts
      || source.ownedSkillsByCategory
      || fallback.ownedSkillCounts
      || {};
    const ownedSkillCounts = {};
    for (const [key, value] of Object.entries(rawCounts || {})) {
      const count = number(value, null);
      if (count != null) ownedSkillCounts[key] = Math.max(0, Math.trunc(count));
    }
    return {
      label: String(source.label || fallback.label || ''),
      facilityLevel,
      currentFacilityLevel: facilityLevel,
      ownedSkillCounts,
      weight: Math.max(0, number(source.weight, fallback.weight || 0)),
      // Preserve lifecycle probabilities through the optimizer normalizer;
      // support-unique-core uses these to avoid inheriting mature bond=100
      // into every startup/expected/peak phase.
      bondProbability: number(source.bondProbability, null)
    };
  }

  function normalizeTrainingLifecycleProxy(proxy = null) {
    const source = proxy?.trainingLifecycleProxy
      || proxy?.lifecycleProxy
      || proxy;
    if (!source || typeof source !== 'object') return null;
    const rawPhases = source.phases || {};
    const phaseByName = Array.isArray(rawPhases)
      ? new Map(rawPhases.map(phase => [String(phase?.id || phase?.name || phase?.label || ''), phase]))
      : new Map(Object.entries(rawPhases));
    const lowerRaw = phaseByName.get('lower') || phaseByName.get('low') || {};
    const expectedRaw = phaseByName.get('expected') || phaseByName.get('mean') || {};
    const peakRaw = phaseByName.get('peak') || phaseByName.get('high') || {};
    const expectedCounts = expectedRaw.ownedSkillCounts
      || expectedRaw.ownedSkillsByCategory
      || source.expectedOwnedSkillCounts
      || source.ownedSkillCounts
      || { speed: 1 };
    const lower = normalizeLifecyclePhase(lowerRaw, {
      label: 'lower',
      facilityLevel: source.lowerFacilityLevel ?? 1,
      ownedSkillCounts: source.lowerOwnedSkillCounts || { speed: 0 },
      weight: 0.25
    });
    const expected = normalizeLifecyclePhase(expectedRaw, {
      label: 'expected',
      facilityLevel: source.expectedFacilityLevel ?? 3,
      ownedSkillCounts: expectedCounts,
      weight: 0.5
    });
    const peak = normalizeLifecyclePhase(peakRaw, {
      label: 'peak',
      facilityLevel: source.peakFacilityLevel ?? 5,
      ownedSkillCounts: source.peakOwnedSkillCounts || { speed: 3 },
      weight: 0.25
    });
    return {
      version: String(source.version || 'training-lifecycle-proxy-v1'),
      source: String(source.source || 'heuristic-support-lifecycle'),
      explicit: source.explicit === true,
      formalPhase: 'expected',
      phases: { lower, expected, peak },
      note: String(source.note
        || 'lower／expected／peak 是 scenario heuristic；正式競技分只使用 expected，不是完整育成模擬')
    };
  }

  function lifecyclePhaseContext(proxy, phase) {
    const item = proxy?.phases?.[phase] || {};
    return {
      facilityLevel: item.facilityLevel,
      currentFacilityLevel: item.currentFacilityLevel ?? item.facilityLevel,
      ownedSkillCounts: { ...(item.ownedSkillCounts || {}) }
    };
  }

  function buildMatureFriendshipTrainingBenchmarkContext(selectedCards = [], lifecycleProxy = null) {
    const cards = Array.isArray(selectedCards) ? selectedCards : [];
    const lifecycle = normalizeTrainingLifecycleProxy(lifecycleProxy);
    const expectedPhase = lifecycle?.phases?.expected;
    const context = {
      benchmarkName: MATURE_FRIENDSHIP_TRAINING_BENCHMARK_NAME,
      benchmarkPurpose: MATURE_FRIENDSHIP_TRAINING_BENCHMARK_PURPOSE,
      bond: 100,
      combinedSupportBond: 600,
      isFriendshipTraining: true,
      trainingState: { isFriendshipTraining: true },
      facilityLevel: expectedPhase?.facilityLevel ?? 5,
      currentFacilityLevel: expectedPhase?.currentFacilityLevel ?? expectedPhase?.facilityLevel ?? 5,
      selectedCardCount: cards.length,
      completeSixCardDeck: cards.length === 6
    };
    if (expectedPhase) {
      context.ownedSkillCounts = { ...(expectedPhase.ownedSkillCounts || {}) };
      context.trainingLifecycleProxy = lifecycle;
    }
    // A type-count gate is only resolved from the actual five selected cards
    // plus the card being analyzed.  Do not invent a six-card composition for
    // single-card or partial-beam analysis.
    if (cards.length === 6) {
      context.supportTypeCount = new Set(cards
        .map(card => normalizeSupportType(card?.supportType || card?.card?.supportType))
        .filter(Boolean)
      ).size;
    }
    return context;
  }

  function mergeBenchmarkContext(context = {}, benchmarkContext = null) {
    if (!benchmarkContext) return { ...context };
    return {
      ...benchmarkContext,
      ...context,
      trainingState: {
        ...(benchmarkContext.trainingState || {}),
        ...(context.trainingState || {})
      }
    };
  }

  function normalizeTypeTemplate(value, mode = 'exact') {
    return normalizeTemplateSpec(value, mode).requiredTypes;
  }

  function normalizeTemplateSpec(value, mode = 'exact') {
    if (mode === 'free') {
      return {
        mode: 'free',
        requiredTypes: [],
        flexSlots: 0,
        flexTypes: [],
        alternatives: []
      };
    }
    if (value && !Array.isArray(value) && typeof value === 'object') {
      const requiredTypes = (value.requiredTypes || value.baseTypes || value.types || [])
        .map(normalizeSupportType).filter(Boolean);
      const alternatives = Array.isArray(value.alternatives)
        ? value.alternatives
          .map(item => normalizeTemplateSpec(item, 'exact').requiredTypes)
          .filter(item => item.length)
        : [];
      const flexTypes = (value.flexTypes || value.allowedFlexTypes || [])
        .map(normalizeSupportType).filter(Boolean);
      const flexSlots = Math.max(0, Math.min(2, number(value.flexSlots, 0)));
      return {
        mode: alternatives.length || flexSlots ? 'alternatives' : 'exact',
        requiredTypes,
        flexSlots,
        flexTypes,
        alternatives
      };
    }
    const source = Array.isArray(value) && value.length ? value : DEFAULT_TYPE_TEMPLATE;
    return {
      mode: 'exact',
      requiredTypes: source.map(normalizeSupportType).filter(Boolean),
      flexSlots: 0,
      flexTypes: [],
      alternatives: []
    };
  }

  function normalizeScenarioConstraint(value) {
    const source = value && typeof value === 'object' ? value : {};
    const requiredSupportCardIds = uniqueNumbers(
      source.requiredSupportCardIds || source.scenarioSupportIds || []
    );
    const requiredSupportTypes = [...new Set((source.requiredSupportTypes || [])
        .map(normalizeSupportType)
        .filter(Boolean))];
    const entryCardPolicy = source.entryCardPolicy === 'required-one'
      && requiredSupportCardIds.length
      ? 'required-one'
      : 'none';
    return {
      id: source.id || null,
      nameZhTw: source.nameZhTw || source.name || null,
      entryCardPolicy,
      requiredSupportCardIds,
      requiredSupportTypes,
      requiredCardPlacement: entryCardPolicy === 'required-one'
        ? (source.requiredCardPlacement || 'owned-preferred-borrow-allowed')
        : 'none'
    };
  }

  function scenarioRequiredCardIds(input) {
    return input?.scenario?.entryCardPolicy === 'required-one'
      ? input.scenario.requiredSupportCardIds || []
      : [];
  }

  function scenarioCardIsRequired(card, input) {
    return scenarioRequiredCardIds(input).includes(number(card?.id));
  }

  function scenarioRequiredOwnedIds(input, owned = input?.owned || []) {
    const ownedIds = new Set((owned || []).map(card => number(card?.id)));
    return scenarioRequiredCardIds(input).filter(id => ownedIds.has(id));
  }

  function scenarioRequiredBorrowIds(input, owned = input?.owned || []) {
    const ownedIds = new Set((owned || []).map(card => number(card?.id)));
    return scenarioRequiredCardIds(input).filter(id => !ownedIds.has(id));
  }

  function scenarioInventoryOwnsId(input, id) {
    return Boolean(inventoryEntryFor(
      { id: number(id) },
      input?.inventory || input?.ownedInventory
    ));
  }

  function scenarioUsableCardIds(input) {
    const catalog = input?.catalog || [];
    return scenarioRequiredCardIds(input).filter(id => {
      const card = catalog.find(item => number(item?.id) === number(id));
      if (!card || !cardIsServerAvailable(card, input)) return false;
      return !input.competitionMode || competitiveSourceEligibility(card, input).eligible;
    });
  }

  function scenarioPackageErrors(owned, borrowed, input) {
    const requiredIds = scenarioRequiredCardIds(input);
    if (!requiredIds.length) return [];
    const ownedMatches = (owned || []).filter(card =>
      requiredIds.includes(number(card?.id))
    );
    const borrowedMatches = borrowed && requiredIds.includes(number(borrowed.id))
      ? [borrowed]
      : [];
    const matches = [...ownedMatches, ...borrowedMatches];
    const errors = [];
    const displayIds = requiredIds.join('／');
    if (matches.length !== 1) {
      errors.push(`選定育成劇本必須精確帶入指定入場卡（${displayIds}），同型支援卡不能替代`);
    }
    const usableIds = scenarioUsableCardIds(input);
    if (!usableIds.length) {
      errors.push(`目前沒有任何可用的 exact 劇本入場卡（${displayIds}）；資料、伺服器或競技來源 gate 不足`);
      return errors;
    }
    const preferredOwnedIds = usableIds.filter(id => scenarioInventoryOwnsId(input, id));
    if (preferredOwnedIds.length) {
      if (!ownedMatches.some(card => preferredOwnedIds.includes(number(card?.id)))) {
        errors.push(`已持有劇本必帶卡（${preferredOwnedIds.join('／')}）必須占用五張自有卡之一`);
      }
      if (borrowedMatches.length) {
        errors.push('已持有劇本必帶卡不可改放借卡欄');
      }
    } else if (!borrowedMatches.some(card => usableIds.includes(number(card?.id)))) {
      errors.push(`未持有劇本必帶卡（${displayIds}）時，必須由唯一借卡欄提供`);
    }
    return errors;
  }

  function templateVariants(inputOrSpec) {
    const rawSpec = inputOrSpec?.templateSpec
      || inputOrSpec?.typeTemplate
      || inputOrSpec;
    const spec = rawSpec?.requiredTypes
      ? rawSpec
      : normalizeTemplateSpec(rawSpec, inputOrSpec?.typeTemplateMode || 'exact');
    if (spec.mode === 'free') return [[]];
    const variants = [...(spec.alternatives || [])];
    if (spec.flexSlots > 0) {
      const flexTypes = spec.flexTypes.length
        ? spec.flexTypes
        : ['Speed', 'Stamina', 'Power', 'Guts', 'Wisdom', 'Friend', 'Group'];
      const visit = (prefix, start, remaining) => {
        if (!remaining) {
          variants.push([...spec.requiredTypes, ...prefix]);
          return;
        }
        flexTypes.forEach((type, index) => visit([...prefix, type], index, remaining - 1));
      };
      visit([], 0, spec.flexSlots);
    } else if (spec.requiredTypes.length && !spec.alternatives?.length) {
      variants.push([...spec.requiredTypes]);
    }
    const unique = new Map();
    variants.filter(item => item.length).forEach(item => {
      const normalized = item.map(normalizeSupportType).filter(Boolean);
      const key = normalized.slice().sort().join('|');
      if (!unique.has(key)) unique.set(key, normalized);
    });
    return [...unique.values()];
  }

  function applyScenarioTemplateSpec(spec, scenario, catalog) {
    if (scenario?.entryCardPolicy !== 'required-one') return spec;
    const catalogTypes = scenario.requiredSupportCardIds
      .map(id => catalog.find(card => number(card?.id) === id)?.supportType)
      .map(normalizeSupportType)
      .filter(Boolean);
    const scenarioTypes = [...new Set([
      ...(scenario.requiredSupportTypes || []),
      ...catalogTypes
    ])];
    if (!scenarioTypes.length) return spec;
    // An exact scenario card may occupy an existing required slot of the
    // same type.  Do not turn a long-distance Stamina×2 base into Stamina×3
    // merely because the entry card is Stamina; the exact card gate below is
    // what makes that particular card mandatory.
    if (scenarioTypes.some(type => spec.requiredTypes.includes(type))) return spec;
    if (spec.flexSlots > 0) {
      const flexTypes = spec.flexTypes.length
        ? spec.flexTypes
        : ['Speed', 'Stamina', 'Power', 'Guts', 'Wisdom', 'Friend', 'Group'];
      const forcedVariants = [];
      for (const scenarioType of scenarioTypes) {
        const visit = (prefix, remaining) => {
          if (remaining === 0) {
            forcedVariants.push([...spec.requiredTypes, scenarioType, ...prefix]);
            return;
          }
          flexTypes.forEach(type => visit([...prefix, type], remaining - 1));
        };
        visit([], Math.max(0, spec.flexSlots - 1));
      }
      return {
        ...spec,
        mode: 'alternatives',
        // Consume one real flex slot for the exact scenario card while
        // retaining any other flex slots.  Enumerating the variants keeps the
        // package at six cards and prevents the exact card from being counted
        // twice as both a type requirement and a free borrow.
        flexSlots: 0,
        flexTypes: [],
        alternatives: forcedVariants
      };
    }
    const hasScenarioSlot = templateVariants(spec).some(variant =>
      variant.length === 6 && scenarioTypes.some(type => typeCounts(variant)[type] > 0)
    );
    if (hasScenarioSlot) return spec;
    if (spec.requiredTypes.length < 6) {
      return {
        ...spec,
        mode: 'alternatives',
        flexSlots: 1,
        flexTypes: scenarioTypes,
        alternatives: []
      };
    }
    // A six-slot exact template with no compatible slot cannot grow to seven
    // cards.  Replace one slot with the scenario type and keep the package at
    // six cards; packageValid still requires the exact support-card ID.
    return {
      ...spec,
      mode: 'alternatives',
      requiredTypes: [...spec.requiredTypes.slice(0, -1), scenarioTypes[0]],
      flexSlots: 0,
      flexTypes: [],
      alternatives: []
    };
  }

  function typeCounts(cardsOrTypes) {
    const counts = {};
    for (const item of cardsOrTypes || []) {
      const type = normalizeSupportType(item?.supportType ?? item);
      if (!type) continue;
      counts[type] = (counts[type] || 0) + 1;
    }
    return counts;
  }

  function missingTemplateTypes(cards, input) {
    if (input?.typeTemplateMode === 'free') return [];
    const actual = typeCounts(cards);
    const candidates = templateVariants(input)
      .map(variant => {
        const wanted = typeCounts(variant);
        const missing = [];
        for (const [type, count] of Object.entries(wanted)) {
          const remainder = count - (actual[type] || 0);
          if (remainder < 0) return null;
          for (let index = 0; index < remainder; index += 1) missing.push(type);
        }
        if (cards.length > variant.length) return null;
        return missing;
      })
      .filter(Array.isArray)
      .sort((left, right) => left.length - right.length
        || left.join(',').localeCompare(right.join(',')));
    return candidates[0] || null;
  }

  function typeTemplateIsExact(cards, input) {
    if (input?.typeTemplateMode === 'free') return true;
    const missing = missingTemplateTypes(cards, input);
    return cards.length === 6 && Array.isArray(missing) && missing.length === 0;
  }

  function mapById(value, field = 'id') {
    if (value instanceof Map) return value;
    if (Array.isArray(value)) return new Map(value.map(item => [number(item?.[field]), item]));
    return new Map(Object.entries(value || {}).map(([id, item]) => [
      number(item?.[field] ?? id),
      { ...item, [field]: number(item?.[field] ?? id) }
    ]));
  }

  function supportCatalogFrom(options) {
    return options.supportCatalog
      || options.catalog?.supports
      || options.catalog?.supportCards
      || [];
  }

  function skillCatalogFrom(options) {
    return options.skills
      || options.catalog?.skills
      || [];
  }

  function profileMapFrom(value) {
    if (value instanceof Map) return value;
    if (Array.isArray(value)) return new Map(value.map(item => [number(item?.id), item]));
    if (Array.isArray(value?.profiles)) return profileMapFrom(value.profiles);
    return new Map(Object.entries(value || {}).map(([id, item]) => [
      number(item?.id ?? id),
      { ...item, id: number(item?.id ?? id) }
    ]));
  }

  function fixtureMapFrom(value) {
    const profiles = Array.isArray(value?.profiles) ? value.profiles : value;
    return mapById(profiles || []);
  }

  function serverAvailabilityFor(card, serverAvailability, options = {}) {
    if (!card) return false;
    if (typeof options === 'string') options = { server: options };
    if (card.availableOnServer === false || card.serverAvailable === false) return false;
    const server = options.server || options.serverId || 'zh_tw';
    if (card.availableOnServers && Array.isArray(card.availableOnServers)
      && !card.availableOnServers.includes(server)) return false;
    if (card.serverAvailability && typeof card.serverAvailability === 'object'
      && card.serverAvailability[server] === false) return false;
    if (typeof serverAvailability === 'function') return serverAvailability(card, server) !== false;
    if (serverAvailability instanceof Set) return serverAvailability.has(number(card.id));
    if (Array.isArray(serverAvailability)) return serverAvailability.map(Number).includes(number(card.id));
    if (serverAvailability && typeof serverAvailability === 'object') {
      const state = serverAvailability[number(card.id)] ?? serverAvailability[String(card.id)];
      if (state === false || state?.available === false) return false;
    }
    if (options.requireTraditionalChinese !== false
      && card.nameZhTw == null
      && card.titleZhTw == null
      && card.availableOnServer == null
      && card.serverAvailable == null) {
      return false;
    }
    return true;
  }

  function cardIsServerAvailable(card, options = {}) {
    if (typeof options === 'string') options = { server: options };
    return serverAvailabilityFor(card, options.serverAvailability, options);
  }

  function inventoryEntries(inventory) {
    if (Array.isArray(inventory)) return inventory;
    return inventory?.supportCards || inventory?.supports || inventory?.ownedSupportCards || [];
  }

  function inventoryEntryFor(card, inventory) {
    const id = number(card?.id);
    return inventoryEntries(inventory).find(item => number(item?.id ?? item?.supportId) === id) || null;
  }

  function cardIsOwned(card, inventory, rules, options = {}) {
    if (!card) return false;
    const explicitOnly = options.explicitOnly === true;
    // Competitive ownership is intentionally an inventory-only operation.
    // Custom callbacks and ownedCardIds are useful for factor/legacy flows,
    // but must not be able to smuggle assumed ownership into a main deck.
    if (explicitOnly) return Boolean(inventoryEntryFor(card, inventory));
    if (typeof options.isCardOwned === 'function') return Boolean(options.isCardOwned(card, inventory, rules));
    // Competitive decks must be backed by the actual inventory.  A catalog
    // convenience flag such as `owned: true` is intentionally ignored in
    // that mode; it is not a substitute for an inventory row.
    if (!explicitOnly && card.owned === true) return true;
    if (options.ownedCardIds && new Set(options.ownedCardIds.map(Number)).has(number(card.id))) return true;
    if (inventoryEntryFor(card, inventory)) return true;
    if (explicitOnly) return false;
    const assumed = rules?.ownership?.assumedOwnedRarities || ['R', 'SR'];
    return assumed.includes(card.rarity);
  }

  function competitiveSourceEligibility(card, options = {}) {
    const reasons = [];
    const reasonCodes = [];
    if (!cardIsServerAvailable(card, options)) {
      reasonCodes.push('server');
      reasons.push('目前繁中伺服器不可用');
    }
    if (String(card?.rarity || '').toUpperCase() !== COMPETITIVE_RARITY) {
      reasonCodes.push('rarity');
      reasons.push('稀有度不是 SSR');
    }
    if (String(card?.obtained || '').toLowerCase() !== COMPETITIVE_SOURCE) {
      reasonCodes.push('obtained');
      reasons.push('取得來源不是 gacha（活動／商店／配布等）');
    }
    return {
      eligible: reasons.length === 0,
      reasons,
      reasonCodes,
      rarity: card?.rarity || null,
      obtained: card?.obtained || null,
      server: options.server || options.serverId || 'zh_tw'
    };
  }

  function competitiveCardAudit(card, options = {}) {
    const source = competitiveSourceEligibility(card, options);
    const explicitOwned = cardIsOwned(card, options.inventory || options.ownedInventory,
      options.rules || options.plannerRules, { ...options, explicitOnly: true });
    const ownedEligible = source.eligible && explicitOwned;
    const borrowedEligible = source.eligible;
    const ownedReasons = [...source.reasons];
    if (!explicitOwned) ownedReasons.push('未列入自有 inventory；只能作借卡或備選理解');
    return {
      id: number(card?.id),
      card,
      sourceEligible: source.eligible,
      ownedEligible,
      borrowedEligible,
      explicitOwned,
      sourceReasons: source.reasons,
      reasonCodes: source.reasonCodes,
      ownedReasons,
      borrowedReasons: [...source.reasons],
      source: card?.obtained || null,
      rarity: card?.rarity || null,
      modelMode: null,
      ownedRecommended: false,
      borrowedRecommended: false,
      competitiveRecommended: false,
      recommendationReasons: []
    };
  }

  function maxLevelByLimitBreak(card, profile, fixture) {
    const source = profile?.maxLevelByLimitBreak || fixture?.maxLevelByLimitBreak;
    if (Array.isArray(source)) return source.reduce((map, value, index) => {
      map[index] = number(value, 1);
      return map;
    }, {});
    if (source && typeof source === 'object') return { ...source };
    const values = DEFAULT_MAX_LEVEL_BY_LB[card?.rarity] || [];
    return values.reduce((map, value, index) => {
      map[index] = value;
      return map;
    }, {});
  }

  function maxLevelFor(card, profile, fixture, limitBreak) {
    const byLb = maxLevelByLimitBreak(card, profile, fixture);
    return number(byLb[clamp(limitBreak, 0, 4)], profile?.maxLevel || fixture?.maxLevel
      || DEFAULT_MAX_LEVEL[card?.rarity] || 1);
  }

  function interpolationValue(valuesByLevel, level, unlockLevel = 1) {
    if (!valuesByLevel || typeof valuesByLevel !== 'object' || level < unlockLevel) return 0;
    const points = Object.entries(valuesByLevel)
      .map(([key, value]) => [number(key), number(value, 0)])
      .filter(([key]) => Number.isFinite(key))
      .sort((left, right) => left[0] - right[0]);
    if (!points.length) return 0;
    if (level < points[0][0]) {
      // A max-level-only breakpoint must not masquerade as an early-level
      // snapshot. Use an explicitly labelled conservative proxy until a
      // decoded lower anchor is available.
      return points[0][1] * level / Math.max(1, points[0][0]);
    }
    if (level === points[0][0]) return points[0][1];
    if (level >= points.at(-1)[0]) return points.at(-1)[1];
    for (let index = 1; index < points.length; index += 1) {
      const [rightLevel, rightValue] = points[index];
      const [leftLevel, leftValue] = points[index - 1];
      if (level <= rightLevel) {
        const ratio = (level - leftLevel) / Math.max(1, rightLevel - leftLevel);
        return leftValue + (rightValue - leftValue) * ratio;
      }
    }
    return points.at(-1)[1];
  }

  function addEffect(effects, type, value) {
    const key = number(type);
    const amount = number(value, 0);
    if (!Number.isFinite(key) || !Number.isFinite(amount)) return;
    effects[key] = (Number(effects[key]) || 0) + amount;
  }

  function applyUniqueEffect(effect, effects, context, supportTypeCount) {
    const type = number(effect?.type);
    if (!Number.isFinite(type)) return false;
    if (type >= 1 && type <= 41) {
      addEffect(effects, type, effect.value);
      return true;
    }
    if (type === 101) {
      const bondMinimum = number(effect.value, 0);
      const bond = number(context?.bond ?? context?.initialBond, 0);
      if (bond < bondMinimum) return false;
      addEffect(effects, effect.value_1, effect.value_2);
      if (effect.value_3 != null) addEffect(effects, effect.value_3, effect.value_4);
      return true;
    }
    if (type === 103) {
      if (supportTypeCount < number(effect.value, Infinity)) return false;
      addEffect(effects, 8, effect.value_1);
      return true;
    }
    if (type === 102) {
      const bond = number(context?.bond ?? context?.initialBond, 0);
      if (bond < number(effect.value, Infinity)) return false;
      addEffect(effects, 8, effect.value_1);
      return true;
    }
    if (type === 111) {
      const configuredFacilityLevel = context?.currentFacilityLevel ?? context?.facilityLevel;
      if (configuredFacilityLevel == null) return false;
      const facilityLevel = clamp(
        configuredFacilityLevel,
        1,
        5
      );
      addEffect(effects, effect.value, number(effect.value_1, 0) * facilityLevel);
      return true;
    }
    // Remaining GameTora 101-122 unique types need game-state inputs we do
    // not own in this resolver. Keep them inactive rather than converting an
    // unknown condition into an invented permanent effect.
    return false;
  }

  function evaluatorPhaseEffects(evaluation, phaseKey, skippedUniqueTypes = new Set()) {
    const phase = evaluation?.[phaseKey];
    if (!phase?.known) return [];
    return (evaluation.items || [])
      .filter(item => !skippedUniqueTypes.has(number(item?.type)))
      .flatMap(item => (item[phaseKey]?.effects || [])
        .filter(effect => effect?.effectClass === 'additive'));
  }

  function evaluatorUnresolvedEffects(evaluation) {
    return (evaluation?.items || [])
      .filter(item => item?.status === 'conditional' || item?.status === 'unsupported')
      .map(item => {
        const raw = item.raw || {};
        return {
          type: number(item.type, null),
          value: number(raw.value, null),
          value_1: number(raw.value_1, null),
          value_2: number(raw.value_2, null),
          value_3: number(raw.value_3, null),
          value_4: number(raw.value_4, null),
          status: item.status,
          raw,
          condition: item.condition || null,
          requiredContext: item.requiredContext || [],
          expectedRange: item.expected?.range || [],
          peakRange: item.peak?.range || [],
          warnings: item.warnings || []
        };
      });
  }

  function lifecyclePhaseSummary(evaluation, phaseName) {
    const phase = evaluation?.[phaseName] || {};
    return {
      known: phase.known === true,
      effects: (phase.effects || []).filter(effect => effect?.effectClass === 'additive'),
      effectMap: phase.effectMap || null,
      range: phase.range || [],
      reason: phase.reason || null,
      assumptions: phase.assumptions || []
    };
  }

  function evaluateUniqueLifecycleFallback(unique, context, lifecycleProxy, currentEvaluation) {
    if (!lifecycleProxy || !unique || !supportUniqueCore?.evaluateUnique) return null;
    if (typeof supportUniqueCore.evaluateUniqueLifecycle === 'function') {
      const phases = Object.entries(lifecycleProxy.phases || {}).map(([id, phase]) => ({
        id,
        ...phase,
        proxySource: lifecycleProxy.source,
        assumptions: [lifecycleProxy.note]
      }));
      try {
        // `context.level` is the actual resolved support level (owned or
        // borrowed).  Keep it in the common lifecycle context so the
        // lifecycle API never evaluates a phase at an invented card level.
        const evaluation = supportUniqueCore.evaluateUniqueLifecycle(unique, {
          phases,
          proxySource: lifecycleProxy.source,
          assumptions: [lifecycleProxy.note],
          context: {
            ...context,
            level: number(context?.level, null)
          }
        });
        const phaseBreakdown = evaluation?.phaseBreakdown || evaluation?.phases || [];
        const phaseMap = Array.isArray(phaseBreakdown)
          ? Object.fromEntries(phaseBreakdown.map(phase => [
            String(phase?.id || phase?.label || ''),
            phase
          ]))
          : { ...phaseBreakdown };
        return {
          source: lifecycleProxy.source,
          explicit: lifecycleProxy.explicit,
          formalPhase: 'expected',
          note: lifecycleProxy.note,
          api: 'support-unique-core.evaluateUniqueLifecycle',
          evaluation,
          phaseBreakdown,
          phases: phaseMap,
          lower: evaluation?.lower || null,
          expected: evaluation?.expected || null,
          peak: evaluation?.peak || null,
          expectedEffectMap: evaluation?.expectedEffectMap || null,
          peakEffectMap: evaluation?.peakEffectMap || null,
          status: evaluation?.status || null,
          dataStatus: evaluation?.dataStatus || null,
          assumptions: evaluation?.assumptions || [lifecycleProxy.note]
        };
      } catch (error) {
        // Keep the bounded local adapter as a fail-safe while the shared
        // lifecycle API evolves; no peak value is promoted on error.
      }
    }
    const lifecycleItems = (currentEvaluation?.items || [])
      .filter(item => [111, 116].includes(number(item?.type)));
    if (!lifecycleItems.length) return null;
    let lowerEvaluation = null;
    try {
      lowerEvaluation = supportUniqueCore.evaluateUnique(unique, {
        ...context,
        ...lifecyclePhaseContext(lifecycleProxy, 'lower'),
        trainingLifecycleProxy: lifecycleProxy
      });
    } catch (error) {
      lowerEvaluation = null;
    }
    return {
      source: lifecycleProxy.source,
      explicit: lifecycleProxy.explicit,
      formalPhase: 'expected',
      api: 'deck-optimizer.lifecycle-fallback',
      note: lifecycleProxy.note,
      phases: {
        lower: {
          ...lifecyclePhaseSummary(lowerEvaluation, 'now'),
          context: lifecyclePhaseContext(lifecycleProxy, 'lower')
        },
        expected: {
          ...lifecyclePhaseSummary(currentEvaluation, 'expected'),
          context: lifecyclePhaseContext(lifecycleProxy, 'expected')
        },
        peak: {
          ...lifecyclePhaseSummary(currentEvaluation, 'peak'),
          context: lifecyclePhaseContext(lifecycleProxy, 'peak')
        }
      }
    };
  }

  function resolveProfile(instance, profile, context = {}, fixture = null, selectedCards = [], benchmarkContext = null) {
    const card = instance?.card || instance || {};
    const borrowed = instance?.borrowed === true;
    const limitBreak = clamp(
      instance?.limitBreak ?? instance?.LB ?? (borrowed ? 4 : 0),
      0,
      4
    );
    const maxLevel = maxLevelFor(card, profile, fixture, 4);
    const cap = maxLevelFor(card, profile, fixture, limitBreak);
    const requestedLevel = number(instance?.level ?? instance?.actualLevel, borrowed ? cap : 1);
    const level = clamp(requestedLevel, 1, cap);
    const effects = {};
    const effectRows = profile?.effectRows || fixture?.effectRows || [];
    if (effectRows.length) {
      for (const row of effectRows) {
        const value = interpolationValue(row.valuesByLevel, level, number(row.unlockLevel, 1));
        if (value > 0) addEffect(effects, row.effectType ?? row.type, value);
      }
    } else {
      const levelScale = borrowed ? 1 : 0.55 + 0.45 * (level / Math.max(1, maxLevel));
      const lbScale = borrowed ? 1 : 0.75 + 0.25 * (limitBreak / 4);
      for (const [type, value] of Object.entries(profile?.effects || {})) {
        addEffect(effects, type, Number(value) * levelScale * lbScale);
      }
    }
    const baseEffects = { ...effects };
    const conditionalEffects = [];
    const profileUnique = profile?.unique && Object.hasOwn(profile.unique, 'raw')
      ? profile.unique.raw
      : profile?.unique;
    const unique = profileUnique || fixture?.unique?.raw;
    const supportTypeCount = new Set(
      [...selectedCards, card]
        .map(item => normalizeSupportType(item?.supportType || item?.card?.supportType))
        .filter(Boolean)
    ).size;
    const evaluatorContext = {
      ...mergeBenchmarkContext(context, benchmarkContext),
      level
    };
    const uniqueEvaluation = supportUniqueCore && unique
      ? supportUniqueCore.evaluateUnique(unique, evaluatorContext)
      : null;
    const fixtureUniqueTypes = new Set(
      (fixture?.unique?.raw?.effects || [])
        .map(effect => number(effect?.type ?? effect?.effectType, null))
        .filter(Number.isFinite)
    );
    const lifecycleProxy = normalizeTrainingLifecycleProxy(
      evaluatorContext.trainingLifecycleProxy
        || evaluatorContext.lifecycleProxy
    );
    const lifecycleSensitivity = evaluateUniqueLifecycleFallback(
      unique,
      evaluatorContext,
      lifecycleProxy,
      uniqueEvaluation
    );
    let uniqueActive = [];
    let unresolvedUniqueEffects = uniqueEvaluation
      ? evaluatorUnresolvedEffects(uniqueEvaluation)
      : [];
    const curatedResolvedTypes = new Set();
    const fixtureCondition = fixture?.unique?.condition;
    const uniqueUnlockLevel = number(
      fixture?.unique?.unlockLevel ?? profile?.unique?.unlockLevel
        ?? unique?.unlockLevel ?? unique?.level,
      1
    );
    // Curated conditions are the decoded form of the raw unique. They remain
    // authoritative for their own type; the evaluator contract is retained
    // below but its same-type effects are not applied a second time.
    if (level >= uniqueUnlockLevel) {
      if (fixtureCondition?.bondAtLeast != null) {
        const conditionEffects = (fixtureCondition.effects || [fixtureCondition])
          .filter(effect => effect?.effectType != null)
          .map(effect => ({ effectType: effect.effectType, value: number(effect.value, 0) }));
        const bondThreshold = number(fixtureCondition.bondAtLeast, 0);
        const bondNow = number(evaluatorContext?.bond ?? evaluatorContext?.initialBond, 0);
        const expectedProbability = bondThreshold >= 100 ? 0.45 : 0.65;
        if (!benchmarkContext) {
          conditionalEffects.push({
            condition: `bond>=${bondThreshold}`,
            probability: expectedProbability,
            effects: conditionEffects
          });
        }
        if (bondNow >= bondThreshold) {
          conditionEffects.forEach(effect => addEffect(effects, effect.effectType, effect.value));
          uniqueActive.push(fixtureCondition);
          fixtureUniqueTypes.forEach(type => curatedResolvedTypes.add(type));
        }
      } else if (fixtureCondition?.supportTypeCountAtLeast != null) {
        if (supportTypeCount >= number(fixtureCondition.supportTypeCountAtLeast)) {
          addEffect(effects, fixtureCondition.effectType || 8, fixtureCondition.value || 10);
          uniqueActive.push(fixtureCondition);
        }
        fixtureUniqueTypes.forEach(type => curatedResolvedTypes.add(type));
      } else if (fixtureCondition?.facilityLevelMultiplier != null) {
        const configuredFacilityLevel = evaluatorContext?.facilityLevel
          ?? evaluatorContext?.currentFacilityLevel;
        if (configuredFacilityLevel != null) {
          const facilityLevel = clamp(configuredFacilityLevel, 1, 5);
          const effectType = number(unique?.effects?.[0]?.value, 8);
          addEffect(effects, effectType, number(fixtureCondition.facilityLevelMultiplier, 5) * facilityLevel);
          uniqueActive.push({ type: 111, facilityLevel });
          fixtureUniqueTypes.forEach(type => curatedResolvedTypes.add(type));
        }
      } else if (uniqueEvaluation) {
        const nowEffects = evaluatorPhaseEffects(uniqueEvaluation, 'now', fixtureUniqueTypes);
        nowEffects.forEach(effect => addEffect(effects, effect.effectType, effect.value));
        uniqueActive.push(...(uniqueEvaluation.items || [])
          .filter(item => item.status === 'active' && !fixtureUniqueTypes.has(number(item.type)))
          .map(item => item.raw));
      } else if (unique?.effects) {
        for (const effect of unique.effects) {
          if (applyUniqueEffect(effect, effects, context, supportTypeCount)) {
            uniqueActive.push(effect);
          }
        }
      }
    }
    unresolvedUniqueEffects = unresolvedUniqueEffects
      .filter(item => !curatedResolvedTypes.has(number(item.type)));
    let expectedEffects = { ...effects };
    let peakEffects = { ...effects };
    if (uniqueEvaluation && !conditionalEffects.length) {
      expectedEffects = { ...effects };
      peakEffects = { ...baseEffects };
      evaluatorPhaseEffects(uniqueEvaluation, 'peak', fixtureUniqueTypes)
        .forEach(effect => addEffect(peakEffects, effect.effectType, effect.value));
    }
    if (conditionalEffects.length) {
      expectedEffects = { ...baseEffects };
      peakEffects = { ...baseEffects };
      conditionalEffects.forEach(condition => {
        condition.effects.forEach(effect => {
          addEffect(expectedEffects, effect.effectType, effect.value * condition.probability);
          addEffect(peakEffects, effect.effectType, effect.value);
        });
      });
    }
    const lifecycleExpectedMap = lifecycleSensitivity?.expectedEffectMap;
    const lifecyclePeakMap = lifecycleSensitivity?.peakEffectMap;
    if (lifecycleSensitivity?.api === 'support-unique-core.evaluateUniqueLifecycle'
      && lifecycleExpectedMap
      && !conditionalEffects.length) {
      expectedEffects = { ...baseEffects };
      Object.entries(lifecycleExpectedMap).forEach(([effectType, value]) =>
        addEffect(expectedEffects, effectType, value)
      );
      if (lifecyclePeakMap) {
        peakEffects = { ...baseEffects };
        Object.entries(lifecyclePeakMap).forEach(([effectType, value]) =>
          addEffect(peakEffects, effectType, value)
        );
      }
    }
    const hasMissingLowAnchor = effectRows.some(row => {
      const levels = Object.keys(row.valuesByLevel || {})
        .map(value => number(value))
        .filter(Number.isFinite);
      return levels.length > 0 && level < Math.min(...levels);
    });
    const profileIsMaxOnly = !profile?.effectRows && !fixture?.effectRows;
    const partialStats = profileIsMaxOnly || hasMissingLowAnchor;
    return {
      id: number(card.id),
      level,
      limitBreak,
      maxLevel,
      limitBreakCap: cap,
      effects,
      baseEffects,
      expectedEffects,
      peakEffects,
      conditionalEffects,
      uniqueActive,
      matureFriendshipTrainingBenchmarkContext: benchmarkContext,
      uniqueEvaluation,
      lifecycleSensitivity,
      uniqueResolution: {
        status: unresolvedUniqueEffects.length ? 'unresolved-runtime-contract' : 'resolved-or-inactive',
        evaluatorStatus: uniqueEvaluation?.status || null,
        evaluatorAvailable: Boolean(uniqueEvaluation),
        unlockLevel: uniqueUnlockLevel,
        unlocked: level >= uniqueUnlockLevel,
        unresolvedEffects: unresolvedUniqueEffects,
        requiredContext: uniqueEvaluation?.requiredContext || [],
        condition: uniqueEvaluation?.condition || null,
        now: uniqueEvaluation?.now || null,
        expected: uniqueEvaluation?.expected || null,
        peak: uniqueEvaluation?.peak || null,
        lifecycleSensitivity,
        warnings: uniqueEvaluation?.warnings || []
      },
      effectRows,
      maxLevelByLimitBreak: maxLevelByLimitBreak(card, profile, fixture),
      modelMode: borrowed ? 'max-level-borrow' : partialStats ? 'partial-stats' : 'curve',
      source: fixture?.effectRows
        ? (hasMissingLowAnchor ? 'curated-level-fixture-partial-proxy' : 'curated-level-fixture')
        : profileIsMaxOnly ? 'max-only-proxy' : 'decoded-effect-rows'
    };
  }

  function skillMapFrom(options) {
    return mapById(skillCatalogFrom(options));
  }

  function familyIdsForSkill(value, skills) {
    const lookup = skills instanceof Map ? skills : mapById(skills || []);
    const skill = typeof value === 'object' ? value : lookup.get(positiveId(value));
    return uniqueNumbers([
      ...(skill?.familyIds || []),
      skill?.familyId,
      skill?.id
    ]);
  }

  function skillRouteKind(skill, source) {
    const rarity = number(skill?.rarity, 0);
    if (source === 'event') return rarity >= 2 ? 'eventGold' : rarity === 1 ? 'eventWhite' : 'eventOther';
    if (source === 'hint') return rarity >= 2 ? 'exactGold' : rarity === 1 ? 'hintWhite' : 'lowerTier';
    return rarity >= 2 ? 'exactGold' : rarity === 1 ? 'lowerTier' : 'other';
  }

  function runningStyleTag(value) {
    return { 1: 'run', 2: 'ldr', 3: 'btw', 4: 'cha' }[number(value)];
  }

  function skillTagsCompatible(skill, context = {}) {
    const tags = new Set(skill?.tags || []);
    const wantedStyle = runningStyleTag(context.running_style ?? context.runningStyle ?? 1);
    const styleTags = ['run', 'ldr', 'btw', 'cha'].filter(tag => tags.has(tag));
    if (styleTags.length && wantedStyle && !tags.has(wantedStyle)) return false;
    const wantedDistance = { 1: 'sho', 2: 'mil', 3: 'med', 4: 'lng' }[number(context.distance_type ?? context.distanceType)];
    const distanceTags = ['sho', 'mil', 'med', 'lng'].filter(tag => tags.has(tag));
    if (distanceTags.length && wantedDistance && !tags.has(wantedDistance)) return false;
    const wantedGround = { 1: 'tur', 2: 'dir' }[number(context.ground_type ?? context.groundType)];
    const groundTags = ['tur', 'dir'].filter(tag => tags.has(tag));
    if (groundTags.length && wantedGround && !tags.has(wantedGround)) return false;
    // order_rate, blockage, overtaking, and similar conditions are dynamic
    // reliability factors, not static incompatibilities.
    return true;
  }

  function dynamicReliability(skill) {
    const condition = (skill?.conditionGroups || []).map(group => group.condition || '').join('&');
    if (/order_rate|blocked|block|overtake|change_order|accumulatetime|random/i.test(condition)) return 0.82;
    return 0.92;
  }

  // A route can be mechanically available while its activation condition is
  // a poor fit for the selected running style. Keep this as a bounded,
  // condition-derived heuristic so contextual gold, necessary routes, and the
  // visible breakdown use one reliability value. It is deliberately not a
  // skill-ID exception.
  function conditionReliability(skill, context = {}, base = null) {
    const conditions = (skill?.conditionGroups || [])
      .map(group => String(group?.condition || ''))
      .join('&');
    const runningStyle = number(
      context.running_style ?? context.runningStyle,
      null
    );
    let multiplier = 1;
    const openingActivation = conditions.match(/activate_count_start\s*>=\s*(\d+)/i);
    if (openingActivation) {
      const required = Number(openingActivation[1]);
      const plannedCount = number(
        context.openingSkillCount
          ?? context.plannedOpeningSkillCount
          ?? context.openingSkillActivationCount
          ?? context.startSkillCount,
        null
      );
      // This is an explicit build-planning proxy, not an assumed in-race
      // count. Without it the activation-gated gold route is conditional and
      // contributes zero formal value; a plan that demonstrates enough
      // opening skills can restore its bounded route reliability.
      if (plannedCount == null || plannedCount < required) return 0;
    }
    if (runningStyle === 1 && /order_rate\s*>=\s*40/i.test(conditions)) {
      // A runner is normally in the front half; keep the route visible but
      // make the back-half condition close to zero rather than deleting it.
      multiplier = 0.05;
    } else if (runningStyle === 1 && /order_rate\s*<=\s*50/i.test(conditions)) {
      multiplier = 1;
    }
    const fallback = number(base, dynamicReliability(skill));
    return clamp(fallback * multiplier, 0, 1);
  }

  function targetFamilySet(target) {
    return new Set(uniqueNumbers([
      ...(target?.familyIds || []),
      target?.familyId,
      target?.id
    ]).map(String));
  }

  function targetMatchesSkill(target, skill, source, options = {}) {
    if (!skill || !skillTagsCompatible(skill, options.context || {})) return false;
    if (skill.availableOnServer === false) return false;
    const familySet = targetFamilySet(target);
    const skillFamilies = familyIdsForSkill(skill, options.skills);
    if (!skillFamilies.some(id => familySet.has(String(id)))) return false;
    const kind = skillRouteKind(skill, source);
    const required = target.requiredKind || target.kind || 'any';
    if (target.minRarity != null && number(skill.rarity, 0) < number(target.minRarity)) return false;
    if (required === 'exactGold' && number(skill.rarity, 0) < 2) return false;
    if (required === 'eventGold' && (source !== 'event' || number(skill.rarity, 0) < 2)) return false;
    if (required === 'hintWhite' && (source !== 'hint' || number(skill.rarity, 0) < 1)) return false;
    if (required === 'lowerTier' && number(skill.rarity, 0) < 1) return false;
    if (required === 'gold' && number(skill.rarity, 0) < 2) return false;
    if (required === 'white' && number(skill.rarity, 0) < 1) return false;
    if (required === 'exactWhite' && number(skill.rarity, 0) !== 1) return false;
    if (target.skillIds?.length && !target.skillIds.map(Number).includes(number(skill.id))) return false;
    return kind !== 'other';
  }

  function normalizeTargets(options, skills) {
    const source = options.targets
      || options.desiredSkills
      || options.courseProfile?.skillPlan?.categories?.flatMap(category =>
        (category.skills || []).map(skill => ({
          ...skill,
          // A profile override may carry Number.MAX_SAFE_INTEGER in `score`
          // solely to sort a strategy item. It must never become a domain
          // weight; category.weight remains the explicit scoring weight.
          weight: normalizeDomainWeight(skill.weight ?? category.weight, 100),
          categoryWeight: normalizeDomainWeight(category.weight, 100),
          categoryId: category.id
        }))
      )
      || options.course?.skillPlan?.categories?.flatMap(category =>
        (category.skills || []).map(skill => ({
          ...skill,
          weight: normalizeDomainWeight(skill.weight ?? category.weight, 100),
          categoryWeight: normalizeDomainWeight(category.weight, 100),
          categoryId: category.id
        }))
      )
      || [];
    const output = [];
    const seen = new Set();
    for (const [index, raw] of source.entries()) {
      const categoryId = String(raw?.categoryId || raw?.category || '').trim().toLowerCase();
      const isRecoveryAlternative = categoryId === 'stamina'
        || raw?.alternativeGroup === 'recovery'
        || raw?.coverageRole === 'recoveryAlternative'
        || raw?.excludeFromDeckTargets === true;
      // The stamina category is a ranked recovery menu, not five separate
      // skill targets. Recovery is scored only by recoveryPlan and its
      // canonical family gate below.
      if (isRecoveryAlternative) continue;
      const id = positiveId(raw?.id ?? raw?.skillId ?? raw?.familyId);
      if (!id) continue;
      const targetSkill = skills.get(id);
      const familyIds = uniqueNumbers([...(raw.familyIds || []), raw.familyId, id]);
      const explicitKind = raw.requiredKind || raw.kind;
      const isUpgradeBase = number(targetSkill?.rarity, 0) === 1 && raw.factorId != null;
      // A factorable one-star static aptitude (for example 「主要距離○」)
      // belongs in factor planning, not support-card competition. Letting it
      // enter the normal target pool made a weak card look like it supplied
      // both a necessary route and a hint route.
      const conditionText = (targetSkill?.conditionGroups || [])
        .map(group => `${group?.condition || ''}&${group?.precondition || ''}`)
        .join('&');
      const isFactorableLowValueGreen = number(targetSkill?.rarity, 0) === 1
        && (raw.factorId != null || raw.factorable === true || categoryId === 'efficiency')
        && (categoryId === 'efficiency'
          || /(?:is_basis_distance|distance_type|ground_type|rotation|season|time|weather|track_id|is_dirtgrade|is_abroad|is_tight_track)/i.test(conditionText));
      const derivedKind = explicitKind
        || (!targetSkill ? 'any' : number(targetSkill?.rarity, 0) >= 2
          ? (/event/i.test(String(raw.source || raw.sourceKind || '')) ? 'eventGold' : 'gold')
          : isUpgradeBase ? 'lowerTier' : 'lowerTier');
      const derivedMinRarity = raw.minRarity != null
        ? number(raw.minRarity, null)
        : number(targetSkill?.rarity, 0) >= 2 ? 2 : null;
      const targetFamilySet = new Set(familyIds.map(Number));
      const knownGoldUpgrade = number(targetSkill?.rarity, 0) === 1
        && [...skills.values()].some(skill => number(skill?.rarity, 0) >= 2
          && familyIdsForSkill(skill, skills).some(id => targetFamilySet.has(Number(id))));
      const explicitFactorability = raw.factorabilityProxy != null
        ? Number(raw.factorabilityProxy)
        : raw.factorability != null
          ? Number(raw.factorability)
          : null;
      const factorabilityProxy = Number.isFinite(explicitFactorability)
        ? clamp(explicitFactorability, 0, 0.6)
        : number(targetSkill?.rarity, 0) === 1
          && (raw.factorId != null || raw.factorable === true || knownGoldUpgrade)
          ? 0.24
          : 0;
      const factorabilitySource = Number.isFinite(explicitFactorability)
        ? 'explicit-proxy'
        : factorabilityProxy > 0
          ? raw.factorId != null || raw.factorable === true
            ? 'ordinary-white-factor-evidence'
            : 'known-gold-family-factor-evidence'
          : 'none';
      const key = `${familyIds[0] || id}:${derivedKind}`;
      if (seen.has(key)) continue;
      seen.add(key);
      output.push({
        ...raw,
        id,
        familyId: number(raw.familyId, familyIds[0] || id),
        familyIds,
        name: raw.nameZhTw || raw.name || String(id),
        weight: normalizeDomainWeight(
          raw.weight ?? raw.categoryWeight ?? raw.category?.weight,
          Math.max(1, 1000 - index * 25)
        ),
        sortPriority: number(raw.sortPriority ?? raw.priority, null),
        factorabilityProxy,
        factorabilitySource,
        requiredKind: derivedKind,
        minRarity: derivedMinRarity,
        sourceEligibility: isFactorableLowValueGreen
          ? 'factorOnly'
          : raw.sourceEligibility
            || (raw.sourceKind === 'parent-unique' || raw.deckEligible === false ? 'directParent' : 'deck'),
        coverageRole: isFactorableLowValueGreen
          ? 'factorableLowValueGreen'
          : isUpgradeBase ? 'upgradeBase' : raw.coverageRole || null
      });
    }
    return output;
  }

  function normalizeChoiceOption(option) {
    if (Array.isArray(option)) return option.map(Number).filter(Number.isFinite);
    if (option && Array.isArray(option.skillIds)) {
      return option.skillIds.map(Number).filter(Number.isFinite);
    }
    if (option && Number.isFinite(Number(option.skillId))) return [Number(option.skillId)];
    return [];
  }

  function supportEventChoiceModel(card, options = {}) {
    const cardId = String(Number(card?.id));
    // schema v2 keeps the compact choice model at the top level.  The
    // metadata supportStatus wrapper is retained only as a compatibility
    // fallback for older route datasets; prefer the canonical model so a
    // stale wrapper cannot hide a complete model.
    const model = options.supportEventRoutes?.choiceModels?.[cardId]
      || options.supportEventRoutes?.metadata?.supportStatus?.[cardId]?.choiceModel;
    return model?.status === 'complete' ? model : null;
  }

  function dataChoiceSpec(card, options = {}) {
    const model = supportEventChoiceModel(card, options);
    if (!model) return null;
    const groups = [];
    const coveredCoBundles = new Set();
    for (const group of model.mutualExclusionGroups || []) {
      const alternatives = (group.alternativeBundles || [])
        .map(bundle => normalizeChoiceOption(bundle?.bundleSkillIds ?? bundle?.skillIds ?? bundle))
        .filter(option => option.length);
      if (alternatives.length < 2) continue;
      const mode = alternatives.some(option => option.length > 1)
        ? 'co-obtainable-bundle-choice'
        : 'exclusive-branch';
      groups.push({
        id: group.groupId || `event:${group.eventId || groups.length}`,
        eventIds: group.eventId ? [String(group.eventId)] : [],
        options: alternatives,
        mode,
        source: 'support-event-routes.choiceModel',
        dataIncomplete: false
      });
      for (const bundle of group.alternativeBundles || []) {
        if (bundle?.bundleId != null) coveredCoBundles.add(String(bundle.bundleId));
      }
    }
    for (const bundle of model.coObtainableBundles || []) {
      if (!bundle?.bundleSkillIds?.length) continue;
      const bundleId = String(bundle.bundleId || '');
      if (bundleId && coveredCoBundles.has(bundleId)) continue;
      groups.push({
        id: bundleId || `co-bundle:${groups.length}`,
        eventIds: bundle.eventId ? [String(bundle.eventId)] : [],
        options: [normalizeChoiceOption(bundle.bundleSkillIds)],
        mode: 'co-obtainable-bundle',
        source: 'support-event-routes.choiceModel',
        dataIncomplete: false
      });
    }
    return groups.length
      ? {
        groups,
        source: 'support-event-routes.choiceModel',
        dataIncomplete: false
      }
      : null;
  }

  function cardEventChoiceSpec(card, fixture, options = {}) {
    const dataSpec = dataChoiceSpec(card, options);
    if (dataSpec) return dataSpec;
    if (fixture?.eventChoice?.options?.length) {
      const optionsList = fixture.eventChoice.options.map(normalizeChoiceOption).filter(option => option.length);
      return {
        groups: [{
          id: 'fixture-event-choice',
          options: optionsList,
          mode: fixture.eventChoice.mode === 'bundle'
            || fixture.eventChoice.coObtainable === true
            ? 'co-obtainable-bundle'
            : 'exclusive-branch',
          source: 'fixture.eventChoice',
          dataIncomplete: fixture.eventChoice.dataIncomplete === true
        }],
        options: optionsList,
        mode: fixture.eventChoice.mode === 'bundle'
          || fixture.eventChoice.coObtainable === true
          ? 'co-obtainable-bundle'
          : 'exclusive-branch',
        source: 'fixture.eventChoice',
        dataIncomplete: fixture.eventChoice.dataIncomplete === true
      };
    }
    if (fixture?.bundleChoices?.length) {
      const optionsList = fixture.bundleChoices
        .map(item => normalizeChoiceOption(item?.skillIds ?? item))
        .filter(option => option.length);
      return {
        groups: [{
          id: 'fixture-bundle-choice',
          options: optionsList,
          mode: 'co-obtainable-bundle-choice',
          source: 'fixture.bundleChoices',
          dataIncomplete: false
        }],
        options: optionsList,
        mode: 'co-obtainable-bundle-choice',
        source: 'fixture.bundleChoices',
        dataIncomplete: false
      };
    }
    return null;
  }

  function cardEventChoices(card, fixture, options = {}) {
    return cardEventChoiceSpec(card, fixture, options)?.options || null;
  }

  function eventRouteBranchKey(route, cardId, fallbackSkillId = null) {
    const explicit = route?.eventBranchKey
      ?? route?.branchKey
      ?? (route?.eventId != null && route?.choiceId != null
        ? `${route.eventId}:${route.choiceId}`
        : null)
      ?? route?.eventChoiceGroup
      ?? route?.exclusiveGroup
      ?? route?.eventId
      ?? route?.bundleId
      ?? route?.eventBundleId;
    if (explicit != null && String(explicit).trim()) return String(explicit);
    const eventIndex = route?.eventIndex ?? route?.event_index;
    const title = route?.eventTitle ?? route?.event_title;
    if (eventIndex != null || title != null) {
      return `support:${Number(cardId)}:event:${eventIndex ?? ''}:${String(title || '')}`;
    }
    return `support:${Number(cardId)}:event:skill:${Number(route?.skillId ?? fallbackSkillId ?? 0)}`;
  }

  function explicitCoObtainableRoute(route) {
    return route?.coObtainable === true
      || route?.co_obtainable === true
      || route?.coObtainableBundle === true
      || route?.coObtainableGroup != null;
  }

  function routeFamilySet(route, skills) {
    return new Set(familyIdsForSkill(route?.skill || route?.skillId, skills).map(Number));
  }

  function expandedChoiceGroups(choices, routeRows, options = {}, choiceMeta = {}) {
    const groups = (choices || []).map(option => [...new Set((option || []).map(Number))]);
    const familyGroups = groups.map(group => new Set(group.flatMap(id =>
      familyIdsForSkill(options.skills?.get(Number(id)) || { id }, options.skills)
    ).map(Number)));
    for (const route of routeRows || []) {
      if (route?.source !== 'event') continue;
      if (choiceMeta.eventIds?.length
        && !choiceMeta.eventIds.includes(String(route.eventBranchGroupId
          || route.routeEvidence?.eventId
          || route.routeEvidence?.event_id
          || ''))) continue;
      const families = routeFamilySet(route, options.skills);
      if (!families.size) continue;
      const optionIndex = familyGroups.findIndex(group =>
        [...families].some(familyId => group.has(Number(familyId))));
      if (optionIndex < 0) continue;
      if (!groups[optionIndex].includes(Number(route.skillId))) {
        groups[optionIndex].push(Number(route.skillId));
      }
    }
    return groups;
  }

  function routeTargetImpact(route) {
    const probability = formalRouteProbability(route);
    return Math.max(0, ...(route?.matchedTargets || []).map(target =>
      number(target?.weight, 0) * probability
    ), 0);
  }

  function unknownEventBranchRows(routeRows, options = {}) {
    const groups = new Map();
    for (const route of routeRows || []) {
      if (route?.source !== 'event') continue;
      const routeType = String(route.routeType || route.sourceKind || route.eventKind || '').toLowerCase();
      if (routeType.includes('random') || routeType.includes('unknown')) continue;
      const key = route.eventBranchKey || eventRouteBranchKey(
        route.routeEvidence || route,
        route.cardId ?? route.supportId,
        route.skillId
      );
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(route);
    }
    let result = [...(routeRows || [])];
    for (const [branchKey, branchRows] of groups.entries()) {
      const goldRows = branchRows.filter(route => Number(route.skill?.rarity) >= 2);
      const goldFamilies = [...new Set(goldRows.flatMap(route =>
        [...routeFamilySet(route, options.skills)]
      ))];
      if (goldFamilies.length <= 1) continue;
      // A complete choice model has already selected or explicitly marked
      // the branch rows.  Never apply the unknown-data fallback on top of
      // that evidence, especially when several target families share one
      // card-level event.
      if (branchRows.some(route => route.eventBranchExplicit === true)) continue;
      if (branchRows.some(route => route.eventBranchCoObtainable === true)) continue;
      const byFamily = new Map();
      for (const route of branchRows) {
        const families = routeFamilySet(route, options.skills);
        const family = goldFamilies.find(id => families.has(Number(id)));
        if (family == null) continue;
        if (!byFamily.has(String(family))) byFamily.set(String(family), []);
        byFamily.get(String(family)).push(route);
      }
      const selectedFamily = [...byFamily.entries()]
        .map(([family, rows]) => ({
          family,
          score: Math.max(...rows.map(routeTargetImpact), 0),
          maxProbability: Math.max(...rows.map(route => number(route.coverageProbability ?? route.probability, 0)), 0)
        }))
        .sort((left, right) => right.score - left.score
          || right.maxProbability - left.maxProbability
          || String(left.family).localeCompare(String(right.family)))[0]?.family;
      if (selectedFamily == null) continue;
      const branchAudit = {
        branchKey,
        policy: 'one-branch-budget',
        dataIncomplete: true,
        selectedFamily: Number(selectedFamily),
        candidateFamilies: [...byFamily.keys()].map(Number),
        note: '多金事件缺少 explicit choice/co-obtainable bundle；跨 target 僅保留最大單一 branch'
      };
      const keep = new Set((byFamily.get(String(selectedFamily)) || []).map(route => route));
      result = result.filter(route => !branchRows.includes(route) || keep.has(route));
      result = result.map(route => branchRows.includes(route)
        ? {
          ...route,
          eventBranchDataIncomplete: true,
          eventBranchPolicy: 'one-branch-budget',
          eventBranchAudit: branchAudit,
          eventBranchSelected: keep.has(route)
        }
        : route);
    }
    return result;
  }

  function acquisitionRouteOptions(options) {
    return {
      routeDataset: options.supportEventRoutes || null,
      continuousHeuristic: options.continuousEventProbability
        ?? options.acquisitionScenarioProxy?.continuousEventProbability
        ?? options.routeReliability?.continuousEventProbability
    };
  }

  function acquisitionRouteDatasetIndex(input) {
    if (input.acquisitionRouteDatasetIndex) return input.acquisitionRouteDatasetIndex;
    const rows = Array.isArray(input.supportEventRoutes)
      ? input.supportEventRoutes
      : input.supportEventRoutes?.routes;
    const bySupport = new Map();
    for (const row of rows || []) {
      const supportId = Number(row?.supportId);
      const skillId = Number(row?.skillId);
      if (!Number.isFinite(supportId) || !Number.isFinite(skillId)) continue;
      if (!bySupport.has(supportId)) bySupport.set(supportId, new Map());
      const bySkill = bySupport.get(supportId);
      if (!bySkill.has(skillId)) bySkill.set(skillId, []);
      bySkill.get(skillId).push(row);
    }
    input.acquisitionRouteDatasetIndex = bySupport;
    return bySupport;
  }

  function acquisitionRouteRecords(input, supportId, skillId) {
    const indexed = acquisitionRouteDatasetIndex(input)
      .get(Number(supportId))?.get(Number(skillId));
    if (indexed) return indexed;
    if (typeof skillAcquisitionCore?.routeRecords === 'function') {
      return skillAcquisitionCore.routeRecords(
        input.supportEventRoutes,
        Number(supportId),
        Number(skillId)
      );
    }
    return [];
  }

  function acquisitionCardMayMatchTarget(target, card, input) {
    const eventIds = uniqueNumbers(card?.eventSkillIds || []);
    const hintIds = uniqueNumbers(card?.hintSkillIds || []);
    return eventIds.some(id => {
      const skill = input.skills.get(id);
      return skill
        && skillTagsCompatible(skill, input.context || {})
        && targetMatchesSkill(target, skill, 'event', {
          context: input.context || {},
          skills: input.skills
        });
    }) || hintIds.some(id => {
      const skill = input.skills.get(id);
      return skill
        && skillTagsCompatible(skill, input.context || {})
        && targetMatchesSkill(target, skill, 'hint', {
          context: input.context || {},
          skills: input.skills
        });
    });
  }

  function sharedAcquisitionRoutesForCard(card, options, targetRows, resolvedProfile = null) {
    if (typeof skillAcquisitionCore?.classifySupportRoute !== 'function'
      || typeof skillAcquisitionCore?.routeRecords !== 'function'
      || typeof skillAcquisitionCore?.calculateHintAcquisition !== 'function'
      || !options.supportEventRoutes) return null;
    const routeOptions = acquisitionRouteOptions(options);
    const routeRows = [];
    const hintSkillIds = uniqueNumbers(card.hintSkillIds || []);
    const eventSkillIds = uniqueNumbers(card.eventSkillIds || []);
    const profile = resolvedProfile || card.resolvedProfile || null;
    const resolvedEffects = profile?.effects
      || card.acquisition?.resolvedEffects
      || card.resolvedEffects
      || card.effects
      || null;
    const opportunities = Math.max(0, Math.trunc(number(
      options.acquisitionScenarioProxy?.hintOpportunityCount
        ?? options.hintOpportunityCount,
      1
    )));
    const addRoute = (route, source, skill, matchedTargets, probability, hintMetrics = null) => {
      const classification = skillAcquisitionCore.classifySupportRoute(route, routeOptions);
      const routeType = classification.routeType;
      const routeConditionReliability = source === 'event'
        // The route dataset supplies event availability, not an activation
        // reliability override.  Let the condition-derived heuristic run so
        // runner-incompatible order conditions remain low while explicit
        // front-half conditions stay usable.
        ? conditionReliability(skill, options.context || {}, null)
        : 1;
      const safeProbability = clamp(
        (probability ?? classification.rankingProbability) * routeConditionReliability,
        0,
        1
      );
      routeRows.push({
        cardId: number(card.id),
        skillId: number(skill.id),
        familyId: number(skill.familyId, familyIdsForSkill(skill, options.skills)[0] || skill.id),
        familyIds: familyIdsForSkill(skill, options.skills),
        skill,
        source,
        sourceKind: routeType,
        routeType,
        type: source === 'event' ? 'support-event' : 'support-hint',
        kind: skillRouteKind(skill, source),
        routeEvidence: route,
        probability: safeProbability,
        coverageProbability: safeProbability,
        rankingProbability: safeProbability,
        reliability: routeConditionReliability,
        conditionReliability: routeConditionReliability,
        probabilitySource: classification.probabilitySource,
        bonusOnly: Boolean(classification.bonusOnly),
        heuristic: routeType === skillAcquisitionCore.ROUTE_TYPES.CONTINUOUS_EVENT
          || String(classification.probabilitySource || '').startsWith('heuristic:'),
        hintMetrics,
        eventBranchKey: source === 'event'
          ? eventRouteBranchKey(route, card.id, skill.id)
          : null,
        eventBranchGroupId: source === 'event'
          ? (route?.eventId ?? route?.event_id ?? route?.eventChoiceGroup ?? null)
          : null,
        eventBranchCoObtainable: source === 'event' && explicitCoObtainableRoute(route),
        eventBranchExplicit: false,
        exclusiveGroup: `support:${Number(card.id)}:${matchedTargets.length
          ? `target:${matchedTargets.map(target => target.id).join(',')}`
          : `skill:${Number(skill.id)}`}`,
        matchedTargets,
        recovery: (skill.conditionGroups || []).flatMap(group => group.effects || [])
          .filter(effect => number(effect.type) === 9 && number(effect.value, 0) > 0)
      });
    };
    for (const id of eventSkillIds) {
      const skill = options.skills.get(id);
      if (!skill || !skillTagsCompatible(skill, options.context || {})) continue;
      const matchedTargets = targetRows.filter(target =>
        targetMatchesSkill(target, skill, 'event', {
          context: options.context || {},
          skills: options.skills
        })
      );
      const records = acquisitionRouteRecords(options, Number(card.id), Number(id));
      const evidence = records.length
        ? records
        : [{
          supportId: Number(card.id),
          skillId: Number(id),
          eventKind: skillAcquisitionCore.ROUTE_TYPES.UNKNOWN_EVENT
        }];
      evidence.forEach(route => {
        const classified = skillAcquisitionCore.classifySupportRoute(route, routeOptions);
        addRoute(route, 'event', skill, matchedTargets, classified.rankingProbability);
      });
    }
    for (const id of hintSkillIds) {
      const skill = options.skills.get(id);
      if (!skill || !skillTagsCompatible(skill, options.context || {})) continue;
      const matchedTargets = targetRows.filter(target =>
        targetMatchesSkill(target, skill, 'hint', {
          context: options.context || {},
          skills: options.skills
        })
      );
      if (!matchedTargets.length) continue;
      const hintMetrics = skillAcquisitionCore.calculateHintAcquisition({
        supportCard: card,
        profile,
        resolvedEffects,
        hintSkillIds,
        targetSkillId: Number(id),
        opportunities
      }, { opportunities });
      addRoute({
        supportId: Number(card.id),
        skillId: Number(id),
        routeType: skillAcquisitionCore.ROUTE_TYPES.TRAINING_HINT,
        hintSkillIds,
        resolvedEffects,
        hintMetrics
      }, 'hint', skill, matchedTargets, hintMetrics.pAtLeastOnce, hintMetrics);
    }
    return routeRows;
  }

  function skillRoutesForCard(card, options, targetRows, choiceScores = null, resolvedProfile = null) {
    const skills = options.skills;
    const context = options.context || {};
    const fixture = options.fixtures.get(number(card.id));
    const choiceSpec = cardEventChoiceSpec(card, fixture, options);
    const choices = choiceSpec?.options || choiceSpec?.groups?.[0]?.options || null;
    const sharedRouteRows = sharedAcquisitionRoutesForCard(
      card,
      options,
      targetRows,
      resolvedProfile
    );
    if (sharedRouteRows) {
      return applyCardChoiceSelection(card, options, targetRows, choices, sharedRouteRows, choiceSpec);
    }
    const sources = [
      ['event', card.eventSkillIds || []],
      ['hint', card.hintSkillIds || []]
    ];
    const routeRows = [];
    for (const [source, ids] of sources) {
      for (const id of uniqueNumbers(ids)) {
        const skill = skills.get(id);
        if (!skill || !skillTagsCompatible(skill, context)) continue;
        const curatedRoute = (fixture?.skillRoutes || []).find(route =>
          Number(route.skillId) === Number(id)
        );
        if (curatedRoute?.distanceType != null
          && number(context.distance_type ?? context.distanceType) !== number(curatedRoute.distanceType)) continue;
        if (curatedRoute?.runningStyle != null
          && number(context.running_style ?? context.runningStyle) !== number(curatedRoute.runningStyle)) continue;
        if (curatedRoute?.groundType != null
          && number(context.ground_type ?? context.groundType) !== number(curatedRoute.groundType)) continue;
        const matchedTargets = targetRows.filter(target => targetMatchesSkill(target, skill, source, { context, skills }));
        const familyId = number(skill.familyId, familyIdsForSkill(skill, skills)[0] || id);
        const routeReliability = conditionReliability(
          skill,
          context,
          curatedRoute?.reliability
        );
        const supplyProbability = source === 'event' ? 0.8 : 0.65;
        routeRows.push({
          cardId: number(card.id),
          skillId: id,
          familyId,
          familyIds: familyIdsForSkill(skill, skills),
          skill,
          source,
          kind: skillRouteKind(skill, source),
          reliability: routeReliability,
          conditionReliability: routeReliability,
          supplyProbability,
          probability: supplyProbability * routeReliability,
          routeType: source === 'event'
            ? (curatedRoute?.routeType || curatedRoute?.eventKind || 'unknown_event')
            : 'training_hint',
          sourceKind: source === 'event'
            ? (curatedRoute?.routeType || curatedRoute?.eventKind || 'unknown_event')
            : 'training_hint',
          probabilitySource: curatedRoute?.probabilitySource || 'legacy-curated-route',
          bonusOnly: source === 'event'
            && /random|unknown/i.test(String(curatedRoute?.routeType || curatedRoute?.eventKind || '')),
          eventBranchKey: source === 'event'
            ? eventRouteBranchKey(curatedRoute || {}, card.id, id)
            : null,
          eventBranchGroupId: source === 'event'
            ? (curatedRoute?.eventId ?? curatedRoute?.event_id
              ?? curatedRoute?.eventChoiceGroup ?? null)
            : null,
          eventBranchCoObtainable: source === 'event' && explicitCoObtainableRoute(curatedRoute),
          eventBranchExplicit: false,
          matchedTargets,
          recovery: (skill.conditionGroups || []).flatMap(group => group.effects || [])
            .filter(effect => number(effect.type) === 9 && number(effect.value, 0) > 0)
        });
      }
    }
    return applyCardChoiceSelection(card, options, targetRows, choices, routeRows, choiceSpec);
  }

  function applyCardChoiceSelection(card, options, targetRows, choices, routeRows, choiceSpec = null) {
    let selectedRows = routeRows || [];
    const groups = choiceSpec?.groups?.length
      ? choiceSpec.groups
      : choices?.length
        ? [{
          id: 'default-choice-group',
          options: choices,
          mode: choiceSpec?.mode || 'exclusive-branch',
          eventIds: []
        }]
        : [];
    if (!groups.length) return unknownEventBranchRows(selectedRows, options);
    const preCoveredRecoveryFamilies = new Set(uniqueNumbers(options.recoveryPlan?.preCoveredSkillIds || [])
      .map(id => options.skills.get(id))
      .filter(skill => number(skill?.rarity, 0) === 2
        && (skill.conditionGroups || []).some(group => (group.effects || [])
          .some(effect => number(effect.type) === 9 && number(effect.value, 0) > 0)))
      .map(skill => String(familyIdsForSkill(skill, options.skills)[0] || skill.id)));
    const recoveryDeficit = Math.max(
      0,
      number(options.recoveryPlan?.currentDeficit,
        number(options.recoveryPlan?.requiredGold, 0) - preCoveredRecoveryFamilies.size)
    );
    groups.forEach((group, groupIndex) => {
      const choiceGroups = expandedChoiceGroups(group.options, selectedRows, options, group);
      if (!choiceGroups.length) return;
      const choiceIds = new Set(choiceGroups.flatMap(item => item || []).map(Number));
      const eventIds = (group.eventIds || []).map(String);
      // Choice groups describe event branches only. A training hint for the
      // same skill/family is independent evidence and must remain available
      // when an event branch is selected.
      const routeInGroup = route => route?.source === 'event'
        && choiceIds.has(Number(route.skillId))
        && (!eventIds.length || eventIds.includes(String(route.eventBranchGroupId
          || route.routeEvidence?.eventId
          || route.routeEvidence?.event_id
          || '')));
      const choiceRoutes = selectedRows.filter(routeInGroup);
      if (!choiceRoutes.length) return;
      const otherRoutes = selectedRows.filter(route => !choiceRoutes.includes(route));
      const choiceRoutesWithMeta = choiceRoutes.map(route => ({
        ...route,
        choiceOption: choiceGroups.findIndex(option => option.includes(Number(route.skillId))),
        choiceGroupIndex: groupIndex,
        choiceGroup: choiceGroups,
        eventBranchExplicit: true,
        eventBranchCoObtainable: group.mode === 'co-obtainable-bundle'
          || group.mode === 'co-obtainable-bundle-choice'
          ? true
          : route.eventBranchCoObtainable,
        independent: group.mode === 'co-obtainable-bundle'
          || group.mode === 'co-obtainable-bundle-choice'
          ? true
          : route.independent
      }));
      if (options.deferChoiceSelection) {
        selectedRows = [...otherRoutes, ...choiceRoutesWithMeta];
        return;
      }
      const scoreChoice = choice => (choice || []).reduce((sum, id) => {
        const route = choiceRoutes.find(item => item.skillId === Number(id));
        const recoveryValue = route?.recovery?.length && formalRouteProbability(route) > 0
          ? (recoveryDeficit > 0 ? 2200 : 100)
            + Math.max(...route.recovery.map(effect => number(effect.value, 0))) / 10
          : 0;
        return sum + routeTargetImpact(route) + recoveryValue;
      }, 0);
      const selectedChoice = choiceGroups
        .slice()
        .sort((left, right) => scoreChoice(right) - scoreChoice(left)
          || String(left).localeCompare(String(right)))[0] || [];
      const selectedIds = new Set((selectedChoice || []).map(Number));
      selectedRows = [
        ...otherRoutes,
        ...choiceRoutesWithMeta.filter(route => selectedIds.has(Number(route.skillId)))
      ];
    });
    return unknownEventBranchRows(selectedRows, options);
  }

  function recoveryRouteRows(card, options, routeRows) {
    const context = options.context || {};
    const bestByFamily = new Map();
    for (const route of routeRows) {
      const skill = route.skill;
      if (!route.recovery?.length || number(skill.rarity, 0) !== 2) continue;
      const familyId = String(route.familyId);
      const recoveryPlan = options.recoveryPlan || {};
      const qualityRow = (recoveryPlan.quality || []).flatMap(group =>
        (group.skillIds || []).map(id => {
          const explicit = Number(group.value);
          return [
            Number(id),
            Number.isFinite(explicit)
              ? clamp(explicit, 0, 1)
              : recoveryQualityByTier(group.tier, 0)
          ];
        })
      ).find(([id]) => id === route.skillId);
      const quality = qualityRow?.[1]
        ?? recoveryQualityForSkill(
          route.skillId,
          recoveryPlan,
          options.skills,
          route,
          context
        );
      const formalProbability = formalRouteProbability(route);
      const candidate = {
        id: route.skillId,
        familyId: number(route.familyId),
        name: route.skill.nameZhTw || route.skill.name || String(route.skillId),
        quality,
        reliability: route.reliability,
        conditionReliability: route.conditionReliability ?? route.reliability,
        probability: formalProbability,
        expectedCoverage: clamp(quality * formalProbability, 0, 1),
        recoveryValue: Math.max(...route.recovery.map(effect => number(effect.value, 0))),
        source: route.source,
        routeKind: route.kind,
        routeType: route.routeType || route.sourceKind || route.eventKind || null,
        bonusOnly: route.bonusOnly === true,
        skill: route.skill,
        context
      };
      const previous = bestByFamily.get(familyId);
      if (!previous
        || candidate.expectedCoverage > previous.expectedCoverage
        || (candidate.expectedCoverage === previous.expectedCoverage
          && candidate.quality > previous.quality)) {
        bestByFamily.set(familyId, candidate);
      }
    }
    return [...bestByFamily.values()];
  }

  function applyPanelCap(before, rawGain, policyInput = STAT_UTILITY_POLICY) {
    const policy = resolveStatUtilityPolicy({ statUtilityPolicy: policyInput });
    const base = Math.max(0, number(before, 0));
    const raw = Math.max(0, number(rawGain, 0));
    const underCap = Math.min(raw, Math.max(0, policy.threshold - base));
    const excess = Math.max(0, raw - underCap);
    const displayedMarginal = underCap + excess * policy.trainingGainAboveThreshold;
    const raceEffectiveMarginal = underCap
      + excess * policy.trainingGainAboveThreshold * policy.raceEffectAboveThreshold;
    const displayedAfter = Math.round(base + displayedMarginal);
    return {
      before: base,
      rawGain: raw,
      displayedAfter,
      displayedMarginal: Math.round(displayedMarginal * 100) / 100,
      effectiveMarginal: Math.round(raceEffectiveMarginal * 100) / 100,
      raceEffectiveMarginal: Math.round(raceEffectiveMarginal * 100) / 100,
      rawTrainingMultiplier: excess > 0 ? policy.trainingGainAboveThreshold : 1,
      raceEffectiveMultiplier: excess > 0 ? policy.raceEffectAboveThreshold : 1,
      combinedMarginalMultiplier: raw > 0
        ? Math.round(raceEffectiveMarginal / raw * 10000) / 10000
        : 1,
      policy
    };
  }

  function aggregatePanelCaps(entries, expectedStats = {}, policyInput = STAT_UTILITY_POLICY) {
    const rawByType = new Map();
    for (const entry of entries || []) {
      const byStat = entry?.rawGainByStat;
      if (byStat && typeof byStat === 'object') {
        for (const [statKey, value] of Object.entries(byStat)) {
          const type = normalizeSupportType(statKey);
          if (!type || !['Speed', 'Stamina', 'Power', 'Guts', 'Wisdom'].includes(type)) continue;
          const rawGain = Math.max(0, number(value, 0));
          rawByType.set(type, (rawByType.get(type) || 0) + rawGain);
        }
        continue;
      }
      const legacyType = normalizeSupportType(entry?.supportType || entry?.type);
      if (!legacyType) continue;
      const rawGain = Math.max(0, number(entry?.rawTrainingGain, 0));
      rawByType.set(legacyType, (rawByType.get(legacyType) || 0) + rawGain);
    }
    const byType = {};
    let totalRawGain = 0;
    let totalEffectiveMarginal = 0;
    for (const [type, rawGain] of rawByType.entries()) {
      const statKey = {
        Speed: 'speed',
        Stamina: 'stamina',
        Power: 'power',
        Guts: 'guts',
        Wisdom: 'wisdom'
      }[type];
      const before = number(expectedStats?.[statKey] ?? expectedStats?.[type], 0);
      const cap = applyPanelCap(before, rawGain, policyInput);
      byType[type] = {
        ...cap,
        rawGain: cap.rawGain
      };
      totalRawGain += cap.rawGain;
      totalEffectiveMarginal += cap.effectiveMarginal;
    }
    return {
      byType,
      totalRawGain,
      totalEffectiveMarginal: Math.round(totalEffectiveMarginal * 100) / 100
    };
  }

  function expectedStatBefore(options, supportType) {
    const expected = options.expectedStats
      || options.battleUma?.expectedStats
      || options.battleUma?.stats
      || {};
    const key = { Speed: 'speed', Stamina: 'stamina', Power: 'power', Guts: 'guts', Wisdom: 'wisdom' }[supportType];
    return number(expected[key] ?? expected[ supportType ], 0);
  }

  function skillPointEconomy(effects) {
    // GameTora effect 30 is Skill Pt Bonus. It is a training-economy field,
    // not an event-SP grant. Hint/race/fan fields must not leak into this axis.
    const skillPtBonus = Math.max(0, number(effects[30], 0));
    const initialSkillPt = Math.max(0, number(effects[32], 0));
    const trainingFrequency = clamp(
      1
        + number(effects[19], 0) * STANDARD_TRAINING_BENCHMARK.specialtyFrequencyPerPoint
        + number(effects[14], 0) * STANDARD_TRAINING_BENCHMARK.initialBondFrequencyPerPoint,
      1,
      STANDARD_TRAINING_BENCHMARK.maximumTrainingFrequency
    );
    const baseTrainingSkillPt = STANDARD_TRAINING_BENCHMARK.baseSkillPt * trainingFrequency;
    const sharedBaselineSkillPt = STANDARD_TRAINING_BENCHMARK.baseSkillPt;
    const attributableTrainingSkillPt = Math.max(
      0,
      baseTrainingSkillPt - sharedBaselineSkillPt
    );
    const attributableScore = attributableTrainingSkillPt
      + skillPtBonus * 90
      + initialSkillPt * 1.5;
    return {
      skillPtBonus,
      initialSkillPt,
      baseTrainingSkillPt,
      sharedBaselineSkillPt,
      attributableTrainingSkillPt,
      trainingFrequency,
      // `score` remains the transparent single-card benchmark for callers
      // that compare one card in isolation. Package ranking must use the
      // attributable value below so the shared 120-point run baseline is not
      // counted once per support card.
      score: baseTrainingSkillPt + skillPtBonus * 90 + initialSkillPt * 1.5,
      attributableScore
    };
  }

  // Keep Skill Pt ordering visible across a complete six-card deck.  A hard
  // 900-point clamp made modern decks all read as 100 and erased real
  // differences such as a support card's effect-30 bonus.  This is a
  // transparent benchmark curve, not a claim about the game's final wallet.
  function skillPointNormalized(rawScore, options = {}) {
    const halfScale = Math.max(1, number(options.skillPtHalfScale, 900));
    const raw = Math.max(0, number(rawScore, 0));
    return {
      value: clamp(raw / (raw + halfScale), 0, 1),
      halfScale
    };
  }

  function panelMetricSnapshot(card, effects, options) {
    const type = normalizeSupportType(card.supportType);
    const baseStats = STANDARD_TRAINING_BENCHMARK.level5BaseStats[type] || {};
    const statEffectType = { speed: 3, stamina: 4, power: 5, guts: 6, wisdom: 7 };
    const friendMultiplier = 1 + Math.max(0, number(effects[1], 0)) / 100;
    const motivationMultiplier = 1 + STANDARD_TRAINING_BENCHMARK.motivationBase
      * (1 + Math.max(0, number(effects[2], 0)) / 100);
    const trainingMultiplier = 1 + Math.max(0, number(effects[8], 0)) / 100;
    const participantMultiplier = STANDARD_TRAINING_BENCHMARK.soloParticipantMultiplier;
    const specialtyRate = Math.max(0, number(effects[19], 0));
    const mainWeight = STANDARD_TRAINING_BENCHMARK.specialtyOtherWeight
      * (1 + specialtyRate / 100);
    const denominator = mainWeight
      + STANDARD_TRAINING_BENCHMARK.specialtyOtherWeight * 4
      + STANDARD_TRAINING_BENCHMARK.specialtyNoneWeight;
    const specialtyProbability = denominator > 0 ? mainWeight / denominator : 0;
    const baselineProbability = STANDARD_TRAINING_BENCHMARK.specialtyOtherWeight
      / (STANDARD_TRAINING_BENCHMARK.specialtyOtherWeight * 5
        + STANDARD_TRAINING_BENCHMARK.specialtyNoneWeight);
    const specialtyFrequencyMultiplier = specialtyProbability / Math.max(EPSILON, baselineProbability);
    const rawGainByStat = Object.fromEntries(Object.entries(statEffectType).map(([statKey, effectType]) => {
      const base = Math.max(0, number(baseStats[statKey], 0));
      if (!base) return [statKey, 0];
      const flatBonus = Math.max(0, number(effects[effectType], 0));
      const output = (base + flatBonus)
        * friendMultiplier
        * motivationMultiplier
        * trainingMultiplier
        * participantMultiplier
        * specialtyFrequencyMultiplier;
      return [statKey, Math.round(output * 100) / 100];
    }));
    const rawTrainingGain = Object.values(rawGainByStat)
      .reduce((sum, value) => sum + number(value, 0), 0);
    // Do not cap each card. The six-card aggregate below applies the 1200
    // cap once per real stat output, including the secondary stat of a
    // training, and exposes raw as well as cap-adjusted gain.
    const rawTrainingScore = rawTrainingGain * STANDARD_TRAINING_BENCHMARK.trainingScorePerEffectiveGain;
    const friendship = (friendMultiplier - 1) * 100;
    const motivation = (motivationMultiplier - 1) * 100;
    const specialty = specialtyFrequencyMultiplier;
    const bond = Math.max(0, number(effects[14], 0))
      * STANDARD_TRAINING_BENCHMARK.initialBondScorePerPoint;
    const wisdomRecovery = type === 'Wisdom'
      ? Math.max(0, number(effects[31], 0))
        * STANDARD_TRAINING_BENCHMARK.wisdomRecoveryScorePerPoint
      : 0;
    const skillPt = skillPointEconomy(effects);
    const nonCapScore = bond + wisdomRecovery;
    const score = rawTrainingScore + nonCapScore;
    return {
      score: Math.round(score),
      effects,
      rawTrainingGain,
      rawGainByStat,
      rawTrainingScore: Math.round(rawTrainingScore * 100) / 100,
      nonCapScore: Math.round(nonCapScore * 100) / 100,
      capAdjustment: {
        appliedAt: 'deck-aggregate-only',
        before: expectedStatBefore(options, type),
        rawGain: rawTrainingGain,
        capAdjustedGain: null
      },
      components: {
        rawTraining: Math.round(rawTrainingScore * 100) / 100,
        friendshipMultiplier: Math.round(friendMultiplier * 1000) / 1000,
        motivationMultiplier: Math.round(motivationMultiplier * 1000) / 1000,
        trainingMultiplier: Math.round(trainingMultiplier * 1000) / 1000,
        specialtyFrequencyMultiplier: Math.round(specialty * 1000) / 1000,
        specialtyProbability: Math.round(specialtyProbability * 10000) / 10000,
        friendship: Math.round(friendship * 100) / 100,
        motivation: Math.round(motivation * 100) / 100,
        specialty: Math.round(specialty * 1000) / 1000,
        initialBond: Math.round(bond * 100) / 100,
        wisdomRecovery: Math.round(wisdomRecovery * 100) / 100,
        statBonus: Object.fromEntries(Object.entries(statEffectType)
          .map(([statKey, effectType]) => [statKey, Math.max(0, number(effects[effectType], 0))])),
        excluded: {
          raceBonus: 0,
          fanBonus: 0,
          hintLevel: 0,
          hintRate: 0,
          initialStats: 0
        }
      },
      // Only card-attributable SP enters the deck axis. The common run
      // baseline is exposed for audit but is not repeated for six cards.
      skillPtEconomy: Math.round(skillPt.attributableScore * 100) / 100,
      skillPtComponents: {
        skillPtBonus: skillPt.skillPtBonus,
        initialSkillPt: skillPt.initialSkillPt,
        baseTrainingSkillPt: Math.round(skillPt.baseTrainingSkillPt * 100) / 100,
        sharedBaselineSkillPt: Math.round(skillPt.sharedBaselineSkillPt * 100) / 100,
        attributableTrainingSkillPt: Math.round(skillPt.attributableTrainingSkillPt * 100) / 100,
        attributableScore: Math.round(skillPt.attributableScore * 100) / 100,
        trainingFrequency: Math.round(skillPt.trainingFrequency * 1000) / 1000
      }
    };
  }

  function panelMetrics(card, resolved, selectedCards, options) {
    const base = panelMetricSnapshot(card, resolved?.baseEffects || resolved?.effects || {}, options);
    const expected = panelMetricSnapshot(card, resolved?.expectedEffects || resolved?.effects || {}, options);
    const peak = panelMetricSnapshot(card, resolved?.peakEffects || resolved?.effects || {}, options);
    return {
      ...expected,
      scoreBase: base.score,
      scoreExpected: expected.score,
      scorePeak: peak.score,
      base,
      expected,
      peak,
      conditionalEffects: resolved?.conditionalEffects || []
    };
  }

  function deckPanelMetrics(cards, input) {
    const variants = [
      ['base', 'base'],
      ['expected', 'expected'],
      ['peak', 'peak']
    ];
    const summaries = {};
    for (const [key, panelKey] of variants) {
      const entries = cards.map(card => ({
        supportType: card.supportType,
        rawTrainingGain: number(
          card.panel?.[panelKey]?.rawTrainingGain,
          card.panel?.rawTrainingGain
        ),
        rawGainByStat: card.panel?.[panelKey]?.rawGainByStat
          || card.panel?.rawGainByStat
      }));
      const caps = aggregatePanelCaps(
        entries,
        expectedStatsForInput(input),
        resolveStatUtilityPolicy(input)
      );
      const nonCapScore = cards.reduce((sum, card) => {
        const snapshot = card.panel?.[panelKey] || card.panel || {};
        return sum + number(snapshot.nonCapScore, 0);
      }, 0);
      const rawTrainingScore = caps.totalRawGain * STANDARD_TRAINING_BENCHMARK.trainingScorePerEffectiveGain;
      const capAdjustedTrainingScore = Object.values(caps.byType)
        .reduce((sum, cap) => sum + number(cap.effectiveMarginal, 0)
          * STANDARD_TRAINING_BENCHMARK.trainingScorePerEffectiveGain, 0);
      summaries[key] = {
        score: Math.round((nonCapScore + capAdjustedTrainingScore) * 100) / 100,
        rawTrainingGain: caps.totalRawGain,
        capAdjustedTrainingGain: caps.totalEffectiveMarginal,
        rawTrainingScore: Math.round(rawTrainingScore * 100) / 100,
        capAdjustedTrainingScore: Math.round(capAdjustedTrainingScore * 100) / 100,
        nonCapScore: Math.round(nonCapScore * 100) / 100,
        rawGainByType: Object.fromEntries(Object.entries(caps.byType)
          .map(([type, cap]) => [type, cap.rawGain])),
        capByType: caps.byType
      };
    }
    return summaries;
  }

  function targetAdjustedTrainingScore(cards, input = {}) {
    const entries = (cards || []).map(card => ({
      supportType: card.supportType,
      rawTrainingGain: number(card.panel?.expected?.rawTrainingGain, card.panel?.rawTrainingGain),
      rawGainByStat: card.panel?.expected?.rawGainByStat || card.panel?.rawGainByStat
    }));
    const caps = aggregatePanelCaps(
      entries,
      expectedStatsForInput(input),
      resolveStatUtilityPolicy(input)
    );
    const nonCapScore = (cards || []).reduce((sum, card) =>
      sum + number(card.panel?.expected?.nonCapScore, card.panel?.nonCapScore), 0);
    return Math.round((
      nonCapScore
      + caps.totalEffectiveMarginal * STANDARD_TRAINING_BENCHMARK.trainingScorePerEffectiveGain
    ) * 100) / 100;
  }

  function routeKey(route) {
    return `${route.familyId}:${route.kind || 'any'}`;
  }

  function coverageForCards(cards, targetRows, options) {
    const routesByTarget = new Map();
    for (const target of targetRows) {
      routesByTarget.set(target.id, []);
      for (const card of cards) {
        const cardRoutes = card.__routeRows || [];
        for (const route of cardRoutes) {
          if (!route.matchedTargets.some(item => item.id === target.id)) continue;
          routesByTarget.get(target.id).push({
            ...route,
            cardId: number(card.id),
            probability: clamp(route.probability ?? route.reliability, 0, 1),
            coverageProbability: clamp(
              route.coverageProbability ?? route.probability ?? route.reliability,
              0,
              1
            )
          });
        }
      }
    }
    const certainSkillIds = uniqueNumbers([
      ...(options.preCoveredSkillIds || []),
      ...(options.battleUmaCertainSkillIds || []),
      ...(options.certainSkillIds || [])
    ]);
    const skillLookup = options.skills;
    const rows = [];
    for (const target of targetRows) {
      const deckEligible = target.sourceEligibility !== 'directParent'
        && target.sourceEligibility !== 'factorOnly';
      const routes = deckEligible ? (routesByTarget.get(target.id) || []) : [];
      const certain = deckEligible ? certainSkillIds
        .map(id => skillLookup.get(id))
        .filter(skill => targetMatchesSkill(target, skill, 'event', { context: options.context, skills: skillLookup })
          || targetMatchesSkill(target, skill, 'hint', { context: options.context, skills: skillLookup }))
        : [];
      const qSources = [...routes, ...certain.map(skill => ({
        skill,
        skillId: skill.id,
        familyId: number(skill.familyId, familyIdsForSkill(skill, skillLookup)[0]),
        kind: 'battleUmaCertain',
        source: 'battleUma',
        routeType: 'uma-certain',
        availabilityOnly: true,
        probability: 1,
        coverageProbability: 1,
        cardId: null
      }))];
      const supportSources = qSources.filter(route => route.cardId != null);
      const nonSupportSources = qSources.filter(route => route.cardId == null);
      const formalSupportSources = supportSources.filter(isFormalAcquisitionRoute);
      const supportCoverage = combinedRouteProbability(formalSupportSources, options);
      let nonSupportUncovered = 1;
      for (const route of nonSupportSources) {
        nonSupportUncovered *= 1 - clamp(route.probability, 0, 1);
      }
      const q = clamp(
        1 - (1 - supportCoverage) * nonSupportUncovered,
        0,
        1
      );
      rows.push({
        ...target,
        familyId: number(target.familyId, target.id),
        coverageProbability: q,
        residualCoverageProbability: 1 - q,
        routes: qSources.map(route => ({
          cardId: route.cardId,
          skillId: number(route.skillId),
          familyId: number(route.familyId),
          source: route.source,
          sourceKind: route.sourceKind || route.routeType || null,
          routeType: route.routeType || route.sourceKind || null,
          kind: route.kind,
          availabilityOnly: route.availabilityOnly === true,
          probability: route.probability,
          coverageProbability: route.coverageProbability ?? route.probability,
          bonusOnly: route.bonusOnly === true,
          skillRarity: Number.isFinite(Number(route.skill?.rarity))
            ? Number(route.skill.rarity)
            : Number.isFinite(Number(route.skillRarity))
              ? Number(route.skillRarity)
              : null,
          formal: isFormalAcquisitionRoute(route),
          probabilitySource: route.probabilitySource || null,
          hintMetrics: route.hintMetrics || null,
          skillCost: number(route.skill?.cost, null),
          reliability: route.reliability || route.probability,
          supplyProbability: route.supplyProbability || null
        }))
      });
    }
    return rows;
  }

  function buildContext(options) {
    return {
      ...(options.courseProfile?.context || {}),
      ...(options.course?.context || {}),
      ...(options.race?.context || {}),
      ...(options.context || {}),
      running_style: options.context?.running_style ?? options.runningStyle ?? 1
    };
  }

  function normalizeRecoveryPlan(options) {
    const source = options.staminaRecoveryDeficit || options.recoveryPlan || {};
    return {
      ...source,
      requiredGold: Math.max(0, number(source.requiredGold ?? source.goldRecoveryRequired ?? options.requiredGoldRecovery, 0)),
      preCoveredSkillIds: uniqueNumbers([
        ...(source.preCoveredSkillIds || []),
        ...(options.battleUmaCertainSkillIds || []),
        ...(options.preCoveredRecoverySkillIds || [])
      ])
    };
  }

  function buildCardInstance(card, options, borrowed = false) {
    const inventory = options.inventory || options.ownedInventory;
    const entry = borrowed ? null : inventoryEntryFor(card, inventory);
    const rules = options.plannerRules || options.rules || {};
    const assumed = !borrowed
      && options.competitionMode !== true
      && !entry
      && (rules?.ownership?.assumedOwnedRarities || ['R', 'SR'])
      .includes(card.rarity);
    const maxLevel = maxLevelFor(card, options.profiles.get(number(card.id)), options.fixtures.get(number(card.id)), 4);
    return {
      ...card,
      id: number(card.id),
      supportType: normalizeSupportType(card.supportType),
      borrowed,
      borrowedAtMax: borrowed,
      maxLevel,
      level: borrowed ? maxLevel : number(entry?.level, assumed ? maxLevel : 1),
      limitBreak: borrowed ? 4 : clamp(entry?.limitBreak ?? (assumed ? 4 : 0), 0, 4),
      ownership: borrowed ? '借卡：滿突滿等' : assumed ? 'R／SR 全持有規則' : '自有：實際 Lv／突'
    };
  }

  function normalizeInputs(options = {}) {
    const catalog = supportCatalogFrom(options);
    const skills = skillMapFrom(options);
    const profiles = profileMapFrom(options.supportProfiles || options.profiles || options.catalog?.supportProfiles);
    const fixtures = fixtureMapFrom(options.curatedFixtures || levelFixtures);
    const context = buildContext(options);
    const targets = normalizeTargets(options, skills);
    const deckTargets = targets.filter(target => target.sourceEligibility !== 'directParent'
      && target.sourceEligibility !== 'factorOnly');
    const recoveryPlan = normalizeRecoveryPlan(options);
    const scenario = normalizeScenarioConstraint(options.scenario);
    const serverAvailability = options.serverAvailability;
    const rules = options.plannerRules || options.rules || {};
    const rawTypeTemplate = options.typeTemplate
      ?? options.desiredTypeTemplate
      ?? options.targetTypes;
    const typeTemplateMode = options.typeTemplateMode
      || (rawTypeTemplate && Array.isArray(rawTypeTemplate) && rawTypeTemplate.length < 6 ? 'free' : 'exact');
    let templateSpec = normalizeTemplateSpec(rawTypeTemplate, typeTemplateMode);
    const competitionMode = options.competitionMode !== false;
    const availableCards = catalog
      .filter(card => cardIsServerAvailable(card, {
        ...options,
        serverAvailability,
        requireTraditionalChinese: options.requireTraditionalChinese !== false
      }))
      .map(card => ({ ...card, supportType: normalizeSupportType(card.supportType) }))
      .sort((left, right) => number(left.id) - number(right.id));
    templateSpec = applyScenarioTemplateSpec(templateSpec, scenario, availableCards);
    const owned = availableCards
      .filter(card => !competitionMode || competitiveSourceEligibility(card, {
        ...options,
        serverAvailability,
        requireTraditionalChinese: options.requireTraditionalChinese !== false
      }).eligible)
      .filter(card => cardIsOwned(
        card,
        options.inventory || options.ownedInventory,
        rules,
        competitionMode ? { ...options, explicitOnly: true } : options
      ))
      .filter(card => !Number.isFinite(number(options.battleUma?.characterId))
        || number(card.characterId) !== number(options.battleUma.characterId))
      .map(card => buildCardInstance(card, { ...options, profiles, fixtures }, false));
    const borrowed = availableCards
      .filter(card => !competitionMode || competitiveSourceEligibility(card, {
        ...options,
        serverAvailability,
        requireTraditionalChinese: options.requireTraditionalChinese !== false
      }).eligible)
      .filter(card => !Number.isFinite(number(options.battleUma?.characterId))
        || number(card.characterId) !== number(options.battleUma.characterId))
      .map(card => buildCardInstance(card, { ...options, profiles, fixtures }, true));
    return {
      ...options,
      scenarioCatalog: catalog,
      catalog: availableCards,
      skills,
      profiles,
      fixtures,
      context,
      targets,
      deckTargets,
      recoveryPlan,
      scenario,
      rules,
      supportEventRoutes: options.supportEventRoutes || null,
      acquisitionIdentity: acquisitionDataIdentity({
        supportEventRoutes: options.supportEventRoutes,
        supportProfiles: options.supportProfiles || options.profiles || options.catalog?.supportProfiles
      }),
      trainingLifecycleProxy: normalizeTrainingLifecycleProxy(
        options.trainingLifecycleProxy
          || options.acquisitionScenarioProxy?.trainingLifecycleProxy
          || options.scenario?.trainingLifecycleProxy
      ),
      acquisitionInventoryIdentity: acquisitionInventoryIdentity(options),
      acquisitionCore: skillAcquisitionCore || null,
      owned,
      borrowed,
      competitionMode,
      templateSpec,
      typeTemplateMode,
      targetTypes: templateSpec.requiredTypes,
      competitionAudits: availableCards.map(card => competitiveCardAudit(card, {
        ...options,
        inventory: options.inventory || options.ownedInventory,
        rules,
        serverAvailability,
        requireTraditionalChinese: options.requireTraditionalChinese !== false
      })),
      borrowAnalysisCache: new Map(),
      acquisitionSupportCandidatePool: null,
      acquisitionSourceCardCache: new Map(),
      acquisitionSourceRouteIndexCache: new Map(),
      acquisitionBaseSourceGraphCache: new Map(),
      acquisitionMarginalAnalysisCache: new Map(),
      cardRouteRowsCache: new Map(),
      acquisitionAnalysisCache: new Map(),
      acquisitionSourceRouteCache: new Map()
    };
  }

  function routeTargetWeight(route) {
    return (route?.matchedTargets || [])
      .reduce((sum, target) => sum + number(target?.weight, 0), 0);
  }

  // Formal skill coverage is narrower than route availability.  A support
  // event may grant a white skill or ordinary stat/energy/bond rewards; those
  // rows remain useful evidence for the audit UI, but only an on-course gold
  // skill can enter the formal skill axis.  Random/unknown routes fail closed
  // regardless of legacy reliability fields. Training hints remain formal
  // acquisition routes (their Hint Lv affects economy, not probability).
  function isFormalAcquisitionRoute(route) {
    const source = String(route?.source || route?.type || '').toLowerCase();
    const routeType = String(
      route?.routeType
        || route?.sourceKind
        || route?.eventKind
        || ''
    ).toLowerCase();
    if (route?.bonusOnly === true) return false;
    if (routeType.includes('random') || routeType.includes('unknown')) return false;
    if (source === 'event' || source === 'support-event' || source === 'support_event') {
      const kind = String(route?.kind || '').toLowerCase();
      const rarityValue = route?.skill?.rarity
        ?? route?.skillRarity
        ?? route?.rarity;
      const rarity = Number(rarityValue);
      if (kind === 'eventwhite' || kind === 'event-white') return false;
      // Event route data may identify the skill but omit its catalog rarity.
      // That is insufficient evidence for formal skill value; keep the row
      // visible, but fail closed until an explicit gold rarity is available.
      if (!Number.isFinite(rarity) || rarity < 2) return false;
    }
    return source === 'event'
      || source === 'support-event'
      || source === 'support_event'
      || source === 'hint'
      || source === 'support-hint'
      || source === 'support_hint'
      || source === 'battleuma'
      || source === 'battle-uma'
      || source === 'uma-certain'
      || source === 'uma-event'
      || source === 'certain'
      || source === 'verified-factor'
      || source === 'existing-factor'
      || source === 'factor'
      || source === 'character'
      || source === 'character-event'
      || source === 'character-built-in'
      || source === '';
  }

  // One formal gate for every recommendation/recovery consumer. Audit rows
  // may retain their raw probability, but a non-formal, bonus-only, random,
  // unknown, or zero-probability row contributes no expected acquisition.
  function formalRouteProbability(route) {
    if (!isFormalAcquisitionRoute(route)) return 0;
    return clamp(route?.coverageProbability ?? route?.probability ?? route?.reliability, 0, 1);
  }

  function formalExpectedCoverage(route, quality = route?.quality) {
    return clamp(Math.max(0, number(quality, 0)) * formalRouteProbability(route), 0, 1);
  }

  // Availability-only sources confirm that a skill can be purchased from a
  // non-card source. They are real formal coverage for necessary/recovery
  // gates, but not free-learning evidence for the hint economy baseline.
  function isAvailabilityOnlyRoute(route) {
    if (route?.availabilityOnly === true) return true;
    const markers = [
      route?.source,
      route?.type,
      route?.sourceKind,
      route?.routeType,
      route?.kind
    ].map(value => String(value || '').toLowerCase());
    return markers.some(marker => [
      'uma-certain',
      'battle-uma-certain',
      'battleumacertain'
    ].includes(marker))
      || (markers.includes('battleuma') && markers.includes('uma-certain'));
  }

  function acquisitionRouteSourceKey(route, index = 0) {
    // A support card is one acquisition candidate.  Preserve one-card
    // exclusivity for hint + event/choice rows, while allowing different
    // cards to contribute independent opportunities to the same target.
    const cardId = number(route?.cardId ?? route?.supportId, null);
    if (cardId != null) return `support:${cardId}`;
    const explicit = route?.candidateSourceKey || route?.sourceKey;
    if (explicit != null && String(explicit) !== '') return String(explicit);
    return `route:${route?.source || route?.type || 'unknown'}:${index}`;
  }

  function mergedAcquisitionSourceCoverage(routes, options = {}) {
    const availabilityOnlyRoutes = (routes || []).filter(isAvailabilityOnlyRoute);
    if (availabilityOnlyRoutes.length) {
      let availabilityUncovered = 1;
      for (const route of availabilityOnlyRoutes) {
        availabilityUncovered *= 1 - formalRouteProbability(route);
      }
      const availabilityCoverage = clamp(1 - availabilityUncovered, 0, 1);
      const remainingRoutes = (routes || []).filter(route => !isAvailabilityOnlyRoute(route));
      if (!remainingRoutes.length || availabilityCoverage >= 1) return availabilityCoverage;
      const remainingCoverage = mergedAcquisitionSourceCoverage(remainingRoutes, options);
      return clamp(
        1 - (1 - availabilityCoverage) * (1 - remainingCoverage),
        0,
        1
      );
    }
    const bySource = new Map();
    (routes || []).forEach((route, index) => {
      const key = acquisitionRouteSourceKey(route, index);
      if (!bySource.has(key)) bySource.set(key, []);
      bySource.get(key).push(route);
    });
    const sourceProbabilities = [...bySource.values()].map(sourceRoutes => {
      if (typeof skillAcquisitionCore?.mergeRoutes === 'function') {
        // The core merges choice/hint/event evidence within this one source.
        // Cross-card noisy-or is deliberately performed by this adapter.
        return clamp(skillAcquisitionCore.mergeRoutes(sourceRoutes, {
          ...acquisitionRouteOptions(options),
          independentEvidence: false
        }).coverageProbability, 0, 1);
      }
      const byExclusiveGroup = new Map();
      for (const route of sourceRoutes) {
        const group = String(route?.exclusiveGroup
          || `${route?.type || route?.source || ''}:${route?.skillId ?? ''}`);
        byExclusiveGroup.set(group, Math.max(
          byExclusiveGroup.get(group) || 0,
          clamp(route?.coverageProbability ?? route?.probability ?? route?.reliability, 0, 1)
        ));
      }
      let uncovered = 1;
      for (const probability of byExclusiveGroup.values()) uncovered *= 1 - probability;
      return clamp(1 - uncovered, 0, 1);
    });
    let uncovered = 1;
    for (const probability of sourceProbabilities) uncovered *= 1 - probability;
    return clamp(1 - uncovered, 0, 1);
  }

  function combinedRouteProbability(routes, options = {}) {
    return mergedAcquisitionSourceCoverage(routes, options);
  }

  function acquisitionSupportCandidates(input) {
    if (Array.isArray(input.acquisitionSupportCandidatePool)) {
      return input.acquisitionSupportCandidatePool;
    }
    const targetCharacterId = number(input.battleUma?.characterId, null);
    const ownedIds = new Set((input.owned || []).map(card => Number(card.id)));
    const eligible = (input.catalog || []).filter(card => {
      if (targetCharacterId != null && Number(card.characterId) === targetCharacterId) return false;
      if (input.competitionMode !== true) return true;
      return competitiveSourceEligibility(card, {
        ...input,
        serverAvailability: input.serverAvailability,
        requireTraditionalChinese: input.requireTraditionalChinese !== false
      }).eligible;
    });
    input.acquisitionSupportCandidatePool = eligible.map(card => ({
      card,
      owned: ownedIds.has(Number(card.id)),
      availability: ownedIds.has(Number(card.id)) ? 'owned' : 'theoretical-borrow',
      sourceQuality: ownedIds.has(Number(card.id)) ? 1 : 0.35
    }));
    return input.acquisitionSupportCandidatePool;
  }

  function acquisitionResolvedSourceCard(card, input, owned) {
    const id = Number(card?.id);
    const cacheKey = `${id}:${owned ? 'owned' : 'borrow'}`;
    if (input.acquisitionSourceCardCache?.has(cacheKey)) {
      return input.acquisitionSourceCardCache.get(cacheKey);
    }
    const profile = input.profiles.get(id);
    const fixture = input.fixtures.get(id);
    const instance = buildCardInstance(card, input, !owned);
    const resolved = resolveProfile(
      instance,
      profile,
      input.context,
      fixture,
      [],
      null
    );
    const resolvedCard = {
      ...instance,
      resolvedProfile: resolved,
      acquisition: {
        ...(instance.acquisition || {}),
        resolvedEffects: resolved?.effects || null
      }
    };
    input.acquisitionSourceCardCache?.set(cacheKey, resolvedCard);
    return resolvedCard;
  }

  function acquisitionRoutesForSource(target, source, input, candidateRoutes = null) {
    const id = Number(source.card?.id);
    const cacheKey = `${Number(target.id)}:${id}`;
    if (candidateRoutes && source.isCandidate) {
      return candidateRoutes.filter(route =>
        (route.matchedTargets || []).some(item => Number(item.id) === Number(target.id))
      );
    }
    if (input.acquisitionSourceRouteCache.has(cacheKey)) {
      return input.acquisitionSourceRouteCache.get(cacheKey);
    }
    // Source breadth is a potential-supply graph, not a second full card
    // analysis. Skip cards whose declared hint/event skill IDs cannot match
    // this target before resolving profiles or constructing route rows.
    if (!acquisitionCardMayMatchTarget(target, source.card, input)) {
      input.acquisitionSourceRouteCache.set(cacheKey, []);
      return [];
    }
    const indexKey = `${id}:${source.owned ? 'owned' : 'borrow'}`;
    let byTarget = input.acquisitionSourceRouteIndexCache.get(indexKey);
    if (!byTarget) {
      const sourceCard = acquisitionResolvedSourceCard(source.card, input, source.owned);
      const targetRows = input.deckTargets?.length
        ? input.deckTargets
        : input.targets?.length
          ? input.targets
          : [target];
      const allRows = skillRoutesForCard(
        sourceCard,
        input,
        targetRows,
        null,
        sourceCard.resolvedProfile
      );
      byTarget = new Map();
      for (const row of allRows) {
        for (const matchedTarget of row.matchedTargets || []) {
          const targetId = Number(matchedTarget.id);
          if (!byTarget.has(targetId)) byTarget.set(targetId, []);
          byTarget.get(targetId).push(row);
        }
      }
      input.acquisitionSourceRouteIndexCache.set(indexKey, byTarget);
    }
    const rows = (byTarget.get(Number(target.id)) || []).slice();
    input.acquisitionSourceRouteCache.set(cacheKey, rows);
    return rows;
  }

  function acquisitionGraphRouteOrder(routes) {
    return (routes || []).slice().sort((left, right) =>
      number(right.coverageProbability ?? right.probability, 0)
      - number(left.coverageProbability ?? left.probability, 0)
      || Number(left.skillId || 0) - Number(right.skillId || 0)
    );
  }

  function acquisitionRouteCoverage(routes, input) {
    const formalRoutes = (routes || []).filter(isFormalAcquisitionRoute);
    if (!formalRoutes.length) return 0;
    if (typeof skillAcquisitionCore?.mergeRoutes === 'function') {
      return clamp(skillAcquisitionCore.mergeRoutes(formalRoutes, {
        ...acquisitionRouteOptions(input),
        independentEvidence: input.independentEvidence === true
      }).coverageProbability, 0, 1);
    }
    let uncovered = 1;
    for (const route of formalRoutes) {
      uncovered *= 1 - clamp(route.coverageProbability ?? route.probability, 0, 1);
    }
    return clamp(1 - uncovered, 0, 1);
  }

  function acquisitionCharacterSources(target, input, selectedIds) {
    const cards = input.characterCards || input.gameCatalog?.characterCards || [];
    const ownedOutfitIds = new Set((input.inventory?.trainees || [])
      .map(item => Number(item.outfitId))
      .filter(Number.isFinite));
    const targetSkill = input.skills.get(Number(target.id));
    return cards.flatMap(card => {
      const builtInIds = uniqueNumbers(card.catalogBuiltInSkillIds || []);
      const eventIds = uniqueNumbers(card.catalogEventSkillIds || []);
      const matchingIds = [...new Set([...builtInIds, ...eventIds])]
        .filter(id => {
          const skill = input.skills.get(id);
          return targetMatchesSkill(target, skill, 'event', {
            context: input.context,
            skills: input.skills
          }) || targetMatchesSkill(target, skill, 'hint', {
            context: input.context,
            skills: input.skills
          });
        });
      if (!matchingIds.length) return [];
      const outfitId = Number(card.id);
      if (!Number.isFinite(outfitId)) return [];
      const owned = ownedOutfitIds.has(outfitId);
      const selected = selectedIds.has(String(outfitId));
      return [{
        sourceId: `outfit:${outfitId}`,
        outfitId,
        sourceType: 'character',
        sourceKind: [...matchingIds].some(id => eventIds.includes(id))
          ? 'character-event'
          : 'character-built-in',
        skillIds: matchingIds,
        // A character outfit's built-in and event skills are one source node.
        // It is potential supply, never actual coverage unless explicitly
        // selected/confirmed below.
        coverageProbability: 1,
        sourceQuality: owned ? 0.8 : 0.3,
        availability: owned ? 'owned-outfit' : 'theoretical-outfit',
        owned,
        selected: selected && owned,
        actual: false,
        targetSkillId: targetSkill?.id || Number(target.id)
      }];
    });
  }

  function acquisitionCertainSources(target, input) {
    const ids = uniqueNumbers([
      ...(input.battleUmaCertainSkillIds || []),
      ...(input.certainSkillIds || [])
    ]);
    return ids.flatMap(skillId => {
      const skill = input.skills.get(skillId);
      const matches = targetMatchesSkill(target, skill, 'event', {
        context: input.context,
        skills: input.skills
      }) || targetMatchesSkill(target, skill, 'hint', {
        context: input.context,
        skills: input.skills
      });
      if (!matches) return [];
      return [{
        sourceId: `battle-uma-certain:${skillId}`,
        skillId,
        sourceType: 'battle-uma-certain',
        sourceKind: 'battle-uma-certain',
        coverageProbability: 1,
        sourceQuality: 1,
        selected: true,
        actual: true,
        availability: 'confirmed'
      }];
    });
  }

  function acquisitionVerifiedFactorSources(target, input) {
    const factors = input.verifiedExistingFactors || input.verifiedFactors || [];
    return factors.flatMap((factor, index) => {
      if (factor?.verified !== true
        && String(factor?.verificationStatus || factor?.evidenceStatus || '').toLowerCase() !== 'verified') {
        return [];
      }
      const skillId = number(factor.skillId ?? factor.id, null);
      const skill = input.skills.get(skillId);
      const matches = targetMatchesSkill(target, skill, 'event', {
        context: input.context,
        skills: input.skills
      }) || targetMatchesSkill(target, skill, 'hint', {
        context: input.context,
        skills: input.skills
      });
      if (!matches || skillId == null) return [];
      return [{
        sourceId: `verified-factor:${factor.id ?? skillId}:${index}`,
        skillId,
        sourceType: 'verified-factor',
        sourceKind: 'verified-factor',
        coverageProbability: clamp(factor.coverageProbability ?? factor.probability ?? 1, 0, 1),
        sourceQuality: 1,
        selected: true,
        actual: true,
        availability: 'verified'
      }];
    });
  }

  function acquisitionBaseSourceGraphKey(target, input) {
    const targetKey = JSON.stringify({
      id: Number(target.id),
      familyId: Number(target.familyId),
      familyIds: (target.familyIds || []).map(Number).sort((left, right) => left - right),
      requiredKind: target.requiredKind || target.kind || null,
      minRarity: target.minRarity ?? null,
      sourceEligibility: target.sourceEligibility || null
    });
    const contextKey = JSON.stringify(input.context || {});
    const acquisition = input.acquisitionIdentity || {};
    return [
      'base',
      targetKey,
      input.race?.id || input.courseProfile?.id || 'race',
      contextKey,
      acquisition.modelVersion || ACQUISITION_MODEL_VERSION,
      acquisition.eventRouteDataVersion || 'missing',
      acquisition.eventRouteDataHash || 'missing',
      acquisition.supportProfileVersion || 'missing',
      input.acquisitionInventoryIdentity || 'inventory'
    ].join(':');
  }

  function acquisitionBaseSourceGraphForTarget(target, input) {
    const cacheKey = acquisitionBaseSourceGraphKey(target, input);
    if (input.acquisitionBaseSourceGraphCache?.has(cacheKey)) {
      return input.acquisitionBaseSourceGraphCache.get(cacheKey);
    }
    const supportSources = acquisitionSupportCandidates(input).flatMap(source => {
      const sourceId = Number(source.card.id);
      const routes = acquisitionRoutesForSource(target, source, input)
        .filter(isFormalAcquisitionRoute);
      if (!routes.length) return [];
      return [{
        ...source.card,
        supportId: sourceId,
        sourceType: 'support',
        sourceKind: 'support-card',
        sourceQuality: source.sourceQuality,
        availability: source.availability,
        owned: source.owned,
        borrowCandidate: !source.owned,
        // Package selection is deliberately overlaid later. Ownership and
        // theoretical borrow availability are potential supply only.
        selected: false,
        actual: false,
        routes: acquisitionGraphRouteOrder(routes)
      }];
    });
    const sources = [
      ...supportSources,
      ...acquisitionCharacterSources(target, input, new Set()),
      ...acquisitionCertainSources(target, input),
      ...acquisitionVerifiedFactorSources(target, input)
    ];
    const deduped = typeof skillAcquisitionCore?.dedupeSourceGraph === 'function'
      ? skillAcquisitionCore.dedupeSourceGraph(sources)
      : { nodes: sources, aliases: new Map() };
    const nodes = deduped.nodes.map(node => {
      const routeBreakdown = node.routes?.length
        ? (typeof skillAcquisitionCore?.mergeRoutes === 'function'
          ? skillAcquisitionCore.mergeRoutes(node.routes, {
            ...acquisitionRouteOptions(input),
            independentEvidence: input.independentEvidence === true
          })
          : null)
        : null;
      const coverageProbability = routeBreakdown
        ? clamp(routeBreakdown.coverageProbability, 0, 1)
        : clamp(node.coverageProbability, 0, 1);
      return {
        ...node,
        routeBreakdown,
        coverageProbability,
        potentialCoverage: coverageProbability,
        actual: node.actual === true,
        selected: node.selected === true
      };
    });
    const potentialNodes = nodes.filter(node =>
      (node.sourceType === 'support' || node.sourceType === 'character')
      && Number(node.potentialCoverage) > 0
    );
    const potentialBySupportId = new Map(
      nodes
        .filter(node => node.sourceType === 'support')
        .map(node => [Number(node.supportId), Number(node.potentialCoverage) > 0])
    );
    const sourceBySupportId = new Map(
      nodes
        .filter(node => node.sourceType === 'support')
        .map(node => [Number(node.supportId), node])
    );
    const targetSkill = input.skills.get(Number(target.id));
    const lineage = typeof skillAcquisitionCore?.resolvePlannedLineage === 'function'
      ? skillAcquisitionCore.resolvePlannedLineage({
        target: { ...target, skill: targetSkill },
        targetSkill,
        catalog: {
          skills: [...input.skills.values()],
          supports: input.catalog,
          supportCardProfiles: { profiles: [...input.profiles.values()] }
        },
        plannedLineage: input.plannedLineage
      })
      : { entries: [], actualCoverage: 0, plannedLineageCredit: 0 };
    const result = {
      sources,
      nodes,
      sourceNodes: nodes,
      aliases: deduped.aliases,
      targetSkill,
      potentialSourceCount: potentialNodes.length,
      potentialSourceQualityMass: potentialNodes.reduce((sum, node) =>
        sum + number(node.sourceQuality, 1), 0),
      potentialBySupportId,
      sourceBySupportId,
      sourceAvailability: {
        supportOwned: nodes.filter(node => node.sourceType === 'support' && node.owned).length,
        supportTheoreticalBorrow: nodes.filter(node =>
          node.sourceType === 'support' && node.availability === 'theoretical-borrow').length,
        characterOwned: nodes.filter(node => node.sourceType === 'character' && node.owned).length,
        characterTheoretical: nodes.filter(node =>
          node.sourceType === 'character' && !node.owned).length
      },
      lineage,
      cacheKey
    };
    input.acquisitionBaseSourceGraphCache?.set(cacheKey, result);
    return result;
  }

  function acquisitionSourceGraphForTarget(target, candidate, input, selectedCards, candidateRoutes) {
    if (typeof skillAcquisitionCore?.analyzeSkillAcquisition !== 'function'
      || !input.supportEventRoutes) return null;
    const candidateId = Number(candidate?.id);
    const selectedIds = new Set((selectedCards || []).map(card => String(Number(card.id))));
    const base = acquisitionBaseSourceGraphForTarget(target, input);
    const explain = input.acquisitionExplain === true;
    let candidateWasPotential = base.potentialBySupportId?.get(candidateId) === true;
    const candidateRouteKey = (candidateRoutes || [])
      .map(route => [
        Number(route.skillId),
        route.source || '',
        route.routeType || route.sourceKind || route.eventKind || '',
        Number(route.coverageProbability ?? route.probability ?? 0),
        route.choiceOption ?? '',
        (route.matchedTargets || []).map(item => Number(item.id)).sort((left, right) => left - right).join(',')
      ].join('~'))
      .sort()
      .join('|');
    const analysisCacheKey = `${base.cacheKey}:candidate:${candidateId}:${candidate?.borrowed ? 'borrow' : 'owned'}:${candidate?.level || ''}:${candidate?.limitBreak || ''}:selected:${[...selectedIds].sort().join(',')}:routes:${candidateRouteKey}`;
    if (!explain && input.acquisitionMarginalAnalysisCache?.has(analysisCacheKey)) {
      return input.acquisitionMarginalAnalysisCache.get(analysisCacheKey);
    }
    const candidateRouteCoverage = candidateRoutes?.length
      ? acquisitionRouteCoverage(candidateRoutes, input)
      : 0;
    if (!base.sourceBySupportId?.has(candidateId) && candidateRoutes?.length) {
      // A candidate missing from the potential graph is still represented for
      // an explainable marginal row, but random/unknown evidence remains zero
      // and therefore is not a scarcity alternative.
      candidateWasPotential = candidateRouteCoverage > 0;
    }
    const potentialBreadth = Math.max(0, base.potentialSourceCount - (candidateWasPotential ? 1 : 0));
    const factorabilityBase = target.factorabilityProxy
      ?? target.factorability
      ?? (target.factorable === true ? 1 : 0);
    // This is deliberately a bounded scarcity-only proxy. More verified
    // factor-shaped source breadth can reduce marginal scarcity, but it never
    // becomes actual coverage and is capped well below one.
    const factorabilityProxy = clamp(
      Number(factorabilityBase || 0) + (factorabilityBase > 0
        ? Math.min(0.18, potentialBreadth * 0.01)
        : 0),
      0,
      0.6
    );
    const selectedNodes = [...selectedIds]
      .map(id => base.sourceBySupportId?.get(Number(id)))
      .filter(Boolean);
    const fixedActualNodes = base.nodes.filter(node => node.actual === true);
    const actualNodes = [...new Map([
      ...fixedActualNodes,
      ...selectedNodes
    ].map(node => [node.sourceKey || node.supportId || node.outfitId, node])).values()]
      .filter(source => Number(source.coverageProbability) > 0);
    const actualCoverage = skillAcquisitionCore.noisyOr([
      ...actualNodes.map(source => number(source.coverageProbability, 0)),
      number(base.lineage?.actualCoverage, 0)
    ]);
    const candidateNode = base.sourceBySupportId?.get(candidateId);
    const candidateQuality = candidateWasPotential
      ? number(candidateNode?.sourceQuality, candidateRoutes?.length ? 1 : 0)
      : 0;
    const alternativeSourceCount = Math.max(
      0,
      base.potentialSourceCount - (candidateWasPotential ? 1 : 0)
    );
    const effectiveAlternativeMass = Math.max(
      0,
      number(base.potentialSourceQualityMass, 0)
        - (candidateWasPotential ? candidateQuality : 0)
    );
    const floor = clamp(input.acquisitionScarcityFloor, 0, 1) || 0.10;
    const baseScarcityMultiplier = clamp(
      1 / (1 + effectiveAlternativeMass),
      floor,
      1
    );
    const scarcityMultiplier = clamp(
      baseScarcityMultiplier * (1 - factorabilityProxy),
      0,
      1
    );
    const candidateSourceKey = candidateNode?.sourceKey
      || (candidateRoutes?.length ? `support:${candidateId}` : null);
    const alternativeSourceQuality = alternativeSourceCount
      ? effectiveAlternativeMass / alternativeSourceCount
      : 0;
    const scarcity = {
      alternativeSourceCount,
      alternativeSourceQuality,
      alternativeSourceQualityBreakdown: [],
      effectiveAlternativeMass,
      factorabilityProxy,
      floor,
      baseScarcityMultiplier,
      scarcityMultiplier,
      marginalMultiplier: scarcityMultiplier,
      formulaBreakdown: {
        effectiveAlternativeMass: 'sum(alternativeSourceQuality)',
        baseScarcityMultiplier: 'clamp(1 / (1 + effectiveAlternativeMass), floor, 1)',
        scarcityMultiplier: 'baseScarcityMultiplier * (1 - factorabilityProxy)',
        primarySourceKey: null,
        candidateSourceKey,
        candidateExcludedFromAlternatives: Boolean(candidateWasPotential)
      },
      candidateSourceKey,
      candidateFound: Boolean(candidateWasPotential)
    };
    const candidateNodeSummary = candidateNode
      ? [{
        sourceKey: candidateNode.sourceKey,
        aliases: candidateNode.aliases,
        coverageProbability: candidateRoutes?.length
          ? candidateRouteCoverage
          : candidateNode.coverageProbability,
        routeCount: candidateRoutes?.length || candidateNode.routes?.length || 0
      }]
      : candidateRoutes?.length
        ? [{
          sourceKey: `support:${candidateId}`,
          aliases: [`support:${candidateId}`],
          coverageProbability: candidateRouteCoverage,
          routeCount: candidateRoutes.length
        }]
        : [];
    const analysis = {
      modelVersion: ACQUISITION_MODEL_VERSION,
      target,
      skill: base.targetSkill || null,
      sourceGraph: null,
      routeBreakdown: [],
      actualCoverage,
      actualCoverageProbability: actualCoverage,
      actualSourceCount: actualNodes.length + (number(base.lineage?.actualCoverage, 0) > 0 ? 1 : 0),
      selectedBorrowIds: selectedNodes
        .filter(node => node.borrowCandidate === true)
        .flatMap(node => node.aliases || []),
      alternativeSourceCount,
      alternativeSourceQuality,
      factorabilityProxy,
      plannedLineageCredit: number(base.lineage?.plannedLineageCredit, 0),
      plannedLineage: base.lineage?.entries || [],
      scarcityMultiplier,
      marginalMultiplier: scarcityMultiplier,
      scarcity,
      formulaBreakdown: {
        coverage: 'noisy-or(selected source coverage plus verified planned lineage)',
        scarcity: scarcity.formulaBreakdown,
        randomAndUnknown: 'rankingProbability=0 and coverage=0'
      },
      sourceAvailability: base.sourceAvailability,
      candidateNode: candidateNodeSummary,
      factorabilitySourceBreadth: potentialBreadth
    };
    if (explain) {
      const graphNodes = base.nodes.map(source => {
        const isCandidate = Number(source.supportId) === candidateId;
        const selected = !isCandidate
          && source.sourceType === 'support'
          && selectedIds.has(String(Number(source.supportId)));
        const routes = isCandidate && candidateRoutes?.length
          ? acquisitionGraphRouteOrder(candidateRoutes)
          : source.routes;
        const coverageProbability = isCandidate && candidateRoutes?.length
          ? candidateRouteCoverage
          : source.coverageProbability;
        return {
          ...source,
          selected: isCandidate ? false : selected || source.selected === true,
          actual: isCandidate ? false : source.actual === true || selected,
          routes,
          coverageProbability,
          potentialCoverage: coverageProbability,
          selectedBorrow: source.borrowCandidate === true
            && (selected || source.selected === true)
        };
      });
      if (!base.sourceBySupportId?.has(candidateId) && candidateRoutes?.length) {
        graphNodes.push({
          ...candidate,
          supportId: candidateId,
          sourceType: 'support',
          sourceKind: 'support-card',
          sourceQuality: 1,
          owned: true,
          selected: false,
          actual: false,
          routes: acquisitionGraphRouteOrder(candidateRoutes),
          coverageProbability: candidateRouteCoverage,
          potentialCoverage: candidateRouteCoverage,
          sourceKey: `support:${candidateId}`,
          aliases: [`support:${candidateId}`]
        });
      }
      analysis.sourceGraph = {
        modelVersion: ACQUISITION_MODEL_VERSION,
        target,
        nodes: graphNodes,
        sourceNodes: graphNodes,
        aliases: base.aliases,
        routeDatasetStatus: typeof skillAcquisitionCore.routeDatasetStatus === 'function'
          ? skillAcquisitionCore.routeDatasetStatus(input.supportEventRoutes)
          : null,
        deduped: true
      };
      analysis.routeBreakdown = graphNodes.map(node => ({
        sourceKey: node.sourceKey,
        actual: node.actual,
        selectedBorrow: node.selectedBorrow,
        coverageProbability: node.coverageProbability,
        breakdown: node.routeBreakdown?.breakdown || []
      }));
      return analysis;
    }
    input.acquisitionMarginalAnalysisCache?.set(analysisCacheKey, analysis);
    return analysis;
  }

  function acquisitionCandidateBreakdown(routeRows, candidate, input, selectedCards = []) {
    if (!input.supportEventRoutes
      || typeof skillAcquisitionCore?.analyzeSkillAcquisition !== 'function') return [];
    const targets = new Map();
    for (const route of routeRows || []) {
      for (const target of route.matchedTargets || []) {
        if (!targets.has(Number(target.id))) targets.set(Number(target.id), target);
      }
    }
    return [...targets.values()].map(target => {
      const routes = (routeRows || []).filter(route =>
        (route.matchedTargets || []).some(item => Number(item.id) === Number(target.id)))
        .map(route => ({ ...route, cardId: Number(candidate.id) }));
      const formalRoutes = routes.filter(isFormalAcquisitionRoute);
      const eventRoutes = formalRoutes.filter(route => route.source !== 'hint');
      const allProbability = combinedRouteProbability(formalRoutes, input);
      const eventProbability = combinedRouteProbability(eventRoutes, input);
      const hintProbability = Math.max(0, allProbability - eventProbability);
      const analysis = acquisitionSourceGraphForTarget(
        target,
        candidate,
        input,
        selectedCards,
        routes
      );
      const actualCoverage = clamp(analysis?.actualCoverage ?? 0, 0, 1);
      const residualActualCoverage = 1 - actualCoverage;
      const scarcityMultiplier = clamp(analysis?.scarcityMultiplier ?? 1, 0, 1);
      const economy = hintEconomyForTarget(target, routes, input);
      const eventMarginalValue = number(target.weight, 0)
        * residualActualCoverage
        * scarcityMultiplier
        * eventProbability;
      const hintEconomyValue = number(target.weight, 0)
        * residualActualCoverage
        * scarcityMultiplier
        * hintProbability
        * number(economy.economyFactor, 0);
      return {
        targetId: Number(target.id),
        targetName: target.name || input.skills.get(Number(target.id))?.nameZhTw || String(target.id),
        baseImpact: number(target.weight, 0),
        actualCoverage,
        residualActualCoverage,
        scarcityMultiplier,
        candidateRouteProbability: eventProbability,
        candidateAllRouteProbability: allProbability,
        candidateHintMarginalProbability: hintProbability,
        eventMarginalValue,
        hintEconomyValue,
        hintEconomy: economy,
        alternativeSourceCount: Number(analysis?.alternativeSourceCount || 0),
        alternativeSourceQuality: number(analysis?.alternativeSourceQuality, 0),
        factorabilityProxy: number(analysis?.factorabilityProxy, 0),
        factorabilitySource: target.factorabilitySource || 'derived-source-breadth',
        factorabilitySourceBreadth: Number(analysis?.factorabilitySourceBreadth || 0),
        plannedLineageCredit: number(analysis?.plannedLineageCredit, 0),
        sourceAvailability: analysis?.sourceAvailability || {
          supportOwned: 0,
          supportTheoreticalBorrow: 0,
          characterOwned: 0,
          characterTheoretical: 0
        },
        formula: 'baseImpact * residualActualCoverage * scarcityMultiplier * candidateRouteProbability',
        scarcityFormula: analysis?.scarcity?.formulaBreakdown || null,
        candidateSourceKey: `support:${Number(candidate.id)}`,
        candidateFound: Boolean(analysis?.scarcity?.candidateFound),
        candidateNode: analysis?.candidateNode || [],
        candidateExcludedFromAlternatives: Boolean(analysis?.scarcity?.formulaBreakdown?.candidateExcludedFromAlternatives)
      };
    });
  }

  function targetCoverageRaw(routeRows, options = {}) {
    const targets = new Map();
    for (const route of routeRows || []) {
      for (const target of route.matchedTargets || []) {
        if (!targets.has(target.id)) targets.set(target.id, target);
      }
    }
    let total = 0;
    for (const target of targets.values()) {
      const routes = (routeRows || []).filter(route =>
        (route.matchedTargets || []).some(item => item.id === target.id));
      total += number(target.weight, 0) * combinedRouteProbability(
        routes.filter(isFormalAcquisitionRoute),
        options
      );
    }
    return total;
  }

  function hintEconomyForTarget(target, routes, options = {}) {
    const hasPositiveHint = (routes || []).some(route =>
      (route?.source === 'hint' || route?.type === 'support-hint')
      && formalRouteProbability(route) > 0
      && route?.bonusOnly !== true
      && number(route?.hintMetrics?.spDiscountRate, 0) > 0
    );
    if (!hasPositiveHint) {
      return {
        marginalProbability: 0,
        skillCost: Math.max(1, number(
          target?.cost
            ?? options.skills?.get?.(Number(target?.id))?.cost,
          120
        )),
        discountRate: 0,
        economyFactor: 0,
        value: 0,
        source: null,
        sourceAttribution: [],
        coverageProbability: 0
      };
    }
    const formalRoutes = (routes || []).filter(isFormalAcquisitionRoute);
    const skillCost = Math.max(1, number(
      target?.cost
        ?? options.skills?.get?.(Number(target?.id))?.cost
        ?? formalRoutes.find(route => route.source === 'hint')?.skill?.cost
        ?? formalRoutes.find(route => route.source === 'hint')?.skillCost,
      120
    ));
    const sourceGroups = new Map();
    for (const [index, route] of formalRoutes.entries()) {
      const cardId = number(route?.cardId ?? route?.supportId, null);
      if (cardId == null) continue;
      const sourceKey = acquisitionRouteSourceKey(route, index);
      if (!sourceGroups.has(sourceKey)) {
        sourceGroups.set(sourceKey, { sourceKey, cardId, routes: [], order: index });
      }
      sourceGroups.get(sourceKey).routes.push(route);
    }
    const sourceRows = [...sourceGroups.values()].map(group => {
      const hintRoutes = group.routes
        .filter(route => (route.source === 'hint' || route.type === 'support-hint')
          && route.bonusOnly !== true
          && number(route.coverageProbability ?? route.probability, 0) > 0)
        .map(route => ({
          route,
          probability: clamp(route.coverageProbability ?? route.probability, 0, 1),
          discountRate: number(route.hintMetrics?.spDiscountRate, null)
        }))
        .filter(item => item.discountRate != null && item.discountRate > 0)
        .sort((left, right) =>
          right.discountRate - left.discountRate
          || right.probability - left.probability
        );
      const eventRoutes = group.routes.filter(route =>
        route.source !== 'hint' && route.type !== 'support-hint');
      const coverageProbability = combinedRouteProbability(group.routes, options);
      const eventProbability = combinedRouteProbability(eventRoutes, options);
      const hintMarginalProbability = Math.max(0, coverageProbability - eventProbability);
      const selected = hintRoutes[0] || null;
      return {
        ...group,
        coverageProbability,
        eventProbability,
        hintMarginalProbability,
        selected,
        expectedEconomy: hintMarginalProbability * number(selected?.discountRate, 0),
        hintRouteCount: hintRoutes.length
      };
    })
      .filter(row => row.selected && row.hintMarginalProbability > 0)
      // A deterministic sequential attribution gives the strongest expected
      // SP-saving source first. This makes the per-card discount explicit and
      // prevents a high-Hint-Lv card from lending its rate to another card.
      .sort((left, right) =>
        number(right.selected?.discountRate, 0) - number(left.selected?.discountRate, 0)
        || right.expectedEconomy - left.expectedEconomy
        || left.order - right.order);
    if (!sourceRows.length) {
      return {
        marginalProbability: 0,
        skillCost,
        discountRate: 0,
        economyFactor: 0,
        value: 0,
        source: null,
        sourceAttribution: [],
        coverageProbability: combinedRouteProbability(formalRoutes, options)
      };
    }
    // Formal non-hint card/event routes from every card are the initial
    // coverage baseline. Availability-only rows are guaranteed purchase
    // access, not free learning, so they are intentionally excluded here.
    // Initializing only from cardId-null rows lets an event on one card fail
    // to reduce the marginal hint chance on another card.
    const formalNonHintRoutes = formalRoutes.filter(route =>
      !isAvailabilityOnlyRoute(route)
      && route.source !== 'hint'
      && route.type !== 'support-hint'
    );
    let cumulativeCoverage = combinedRouteProbability(formalNonHintRoutes, options);
    let marginalProbability = 0;
    let economyRaw = 0;
    const sourceAttribution = [];
    for (const source of sourceRows) {
      const eventProbability = clamp(source.eventProbability, 0, 1);
      const fullProbability = clamp(source.coverageProbability, 0, 1);
      // The source's event chance is already in the full-deck non-hint
      // baseline. Upgrade that source from event=e to event+hint=f instead
      // of noisy-ORing f as a second independent opportunity:
      // delta=(1-current)*(f-e)/(1-e).
      const upgradeFraction = eventProbability < 1
        ? Math.max(0, (fullProbability - eventProbability) / Math.max(1e-12, 1 - eventProbability))
        : 0;
      const attributedProbability = clamp(
        (1 - cumulativeCoverage) * upgradeFraction,
        0,
        1
      );
      const discountRate = number(source.selected?.discountRate, 0);
      const sourceEconomy = attributedProbability * discountRate;
      marginalProbability += attributedProbability;
      economyRaw += sourceEconomy;
      sourceAttribution.push({
        sourceKey: source.sourceKey,
        cardId: Number(source.cardId),
        coverageProbability: source.coverageProbability,
        eventProbability,
        hintMarginalProbability: source.hintMarginalProbability,
        attributedProbability,
        discountRate,
        economyValue: sourceEconomy,
        hintRouteCount: source.hintRouteCount
      });
      cumulativeCoverage = clamp(cumulativeCoverage + attributedProbability, 0, 1);
    }
    // Preserve target impact for the hint axis, but make the expected SP
    // saving explicit per source: P_marginal * skillCost * discountRate.
    const economyFactor = marginalProbability > 0
      ? (skillCost / 120) * (economyRaw / marginalProbability)
      : 0;
    const selected = sourceRows[0].selected;
    return {
      marginalProbability,
      skillCost,
      discountRate: selected.discountRate,
      economyFactor,
      value: number(target?.weight, 0) * (skillCost / 120) * economyRaw,
      source: selected.route,
      sourceAttribution,
      coverageProbability: cumulativeCoverage
    };
  }

  function hintEconomyBreakdown(routeRows, options = {}) {
    const targets = new Map();
    for (const route of routeRows || []) {
      for (const target of route.matchedTargets || []) {
        if (!targets.has(target.id)) targets.set(target.id, target);
      }
    }
    return [...targets.values()].map(target => {
      const routes = (routeRows || []).filter(route =>
        (route.matchedTargets || []).some(item => item.id === target.id));
      return {
        targetId: Number(target.id),
        targetName: target.name
          || options.skills?.get?.(Number(target.id))?.nameZhTw
          || String(target.id),
        ...hintEconomyForTarget(target, routes, options)
      };
    });
  }

  function hintEfficiencyRaw(routeRows, options = {}) {
    // Hints get only their marginal coverage after event/battle-uma routes in
    // the same family. Necessary coverage receives a combined family value
    // once, never a second full value from the same hint.
    return hintEconomyBreakdown(routeRows, options)
      .reduce((sum, item) => sum + number(item.value, 0), 0);
  }

  function packageHintEfficiencyRaw(coverageRows, options = {}) {
    return (coverageRows || []).reduce((sum, row) => {
      return sum + hintEconomyForTarget(row, row.routes || [], options).value;
    }, 0);
  }

  function packageNecessarySkillRaw(coverageRows, options = {}) {
    return (coverageRows || []).reduce((sum, row) => {
      const eventCoverage = combinedRouteProbability((row.routes || [])
        .filter(route => route.source !== 'hint' && isFormalAcquisitionRoute(route)), options);
      return sum + number(row.weight, 0) * eventCoverage;
    }, 0);
  }

  function contextualGoldSourceBreadth(skill, excludedSupportId = null) {
    const sources = skill?.sources || {};
    const ids = [
      ...(sources.supportHint || []).map(id => ({ id, kind: 'support' })),
      ...(sources.supportEvent || []).map(id => ({ id, kind: 'support' })),
      ...(sources.characterBuiltIn || []),
      ...(sources.characterEvent || []),
      ...(sources.scenarioEvent || [])
    ].map(item => typeof item === 'object' ? item : { id: item, kind: 'other' })
      .filter(item => Number.isFinite(Number(item.id)))
      .filter(item => Number(excludedSupportId) !== Number(item.id))
      .map(item => Number(item.id));
    return new Set(ids).size;
  }

  function contextualGoldEffectMetrics(skill, route, options = {}) {
    const values = new Map();
    for (const group of skill?.conditionGroups || []) {
      for (const effect of group?.effects || []) {
        const type = number(effect?.type ?? effect?.effectType, null);
        const value = Math.max(0, number(effect?.value, 0));
        if (type == null || value <= 0) continue;
        values.set(type, Math.max(values.get(type) || 0, value));
      }
    }
    const scales = {
      9: { scale: 550, weight: 0.45 },
      22: { scale: 4000, weight: 0.20 },
      27: { scale: 3500, weight: 0.30 },
      31: { scale: 4000, weight: 0.30 }
    };
    const contributions = [...values.entries()]
      .map(([type, value]) => {
        const benchmark = scales[type];
        return benchmark
          ? clamp(value / benchmark.scale, 0, 1) * benchmark.weight
          : 0;
      });
    const effectScore = clamp(contributions.reduce((sum, item) => sum + item, 0), 0, 1);
    const context = options.context || {};
    const wantedTags = [
      runningStyleTag(context.running_style ?? context.runningStyle),
      { 1: 'sho', 2: 'mil', 3: 'med', 4: 'lng' }[number(context.distance_type ?? context.distanceType)],
      { 1: 'tur', 2: 'dir' }[number(context.ground_type ?? context.groundType)]
    ].filter(Boolean);
    const matchingContextTags = wantedTags.filter(tag => (skill?.tags || []).includes(tag)).length;
    const conditionReliability = clamp(number(
      route?.conditionReliability ?? route?.reliability,
      dynamicReliability(skill)
    ), 0, 1);
    const hasRecoveryEffect = values.has(9);
    const recoveryNeed = hasRecoveryEffect && number(options.recoveryPlan?.requiredGold, 0) > 0
      ? 1.12
      : 1;
    return {
      effectScore,
      effectMultiplier: clamp(0.90 + effectScore * 0.32, 0.85, 1.25),
      timingMultiplier: clamp(0.88 + conditionReliability * 0.12, 0.75, 1),
      courseNeedMultiplier: clamp(1 + matchingContextTags * 0.04, 1, 1.12),
      recoveryNeedMultiplier: recoveryNeed,
      effectTypes: [...values.keys()],
      conditionReliability,
      matchingContextTags
    };
  }

  function contextualGoldMetrics(route, options = {}) {
    const skill = route?.skill;
    if (formalRouteProbability(route) <= 0) return null;
    if (route?.source !== 'event'
      || number(skill?.rarity ?? route?.skillRarity ?? route?.rarity, 0) < 2) return null;
    if ((route?.matchedTargets || []).length) return null;
    const usefulEffect = (skill?.conditionGroups || []).some(group =>
      (group?.effects || []).some(effect => [9, 22, 27, 31].includes(number(effect?.type))
        && number(effect?.value, 0) > 0));
    if (!usefulEffect) return null;
    const tags = new Set(skill?.tags || []);
    const scoped = ['run', 'ldr', 'btw', 'cha', 'sho', 'mil', 'med', 'lng', 'tur', 'dir']
      .some(tag => tags.has(tag));
    const scopeMultiplier = scoped
      ? CONTEXTUAL_GOLD_BENCHMARK.scopedMultiplier
      : tags.has('nac')
        ? CONTEXTUAL_GOLD_BENCHMARK.universalMultiplier
        : CONTEXTUAL_GOLD_BENCHMARK.otherMultiplier;
    // Source breadth is objective alternative evidence, not actual coverage.
    // Keep the reduction bounded so a common contextual gold remains visible
    // while a scarce, course-compatible gold can retain marginal value.
    const alternativeSourceCount = contextualGoldSourceBreadth(skill, options.sourceCardId);
    const scarcityMultiplier = clamp(
      0.75 + 0.25 / Math.sqrt(Math.max(1, alternativeSourceCount)),
      0.75,
      1
    );
    const effectMetrics = contextualGoldEffectMetrics(skill, route, options);
    const weight = CONTEXTUAL_GOLD_BENCHMARK.baseWeight
      * scopeMultiplier
      * scarcityMultiplier
      * effectMetrics.effectMultiplier
      * effectMetrics.timingMultiplier
      * effectMetrics.courseNeedMultiplier
      * effectMetrics.recoveryNeedMultiplier;
    return {
      weight,
      baseWeight: CONTEXTUAL_GOLD_BENCHMARK.baseWeight,
      scopeMultiplier,
      scarcityMultiplier,
      alternativeSourceCount,
      sourceBreadth: alternativeSourceCount,
      source: alternativeSourceCount ? 'skill.sources-breadth' : 'bounded-no-source-evidence',
      effectScore: effectMetrics.effectScore,
      effectMultiplier: effectMetrics.effectMultiplier,
      timingMultiplier: effectMetrics.timingMultiplier,
      courseNeedMultiplier: effectMetrics.courseNeedMultiplier,
      recoveryNeedMultiplier: effectMetrics.recoveryNeedMultiplier,
      effectTypes: effectMetrics.effectTypes,
      conditionReliability: effectMetrics.conditionReliability,
      matchingContextTags: effectMetrics.matchingContextTags
    };
  }

  function contextualGoldWeight(route, options = {}) {
    return number(contextualGoldMetrics(route, options)?.weight, 0);
  }

  function contextualGoldBonusScore(raw, options = {}) {
    const divisor = Math.max(1, number(
      options.contextualGoldScoreDivisor,
      CONTEXTUAL_GOLD_SCORE_DIVISOR
    ));
    const cap = Math.max(0, number(
      options.contextualGoldScoreCap,
      MAX_CONTEXTUAL_GOLD_BONUS
    ));
    return clamp(number(raw, 0) / divisor, 0, cap);
  }

  function contextualGoldForCards(cards, targetRows, options = {}) {
    const targetedFamilies = new Set((targetRows || []).flatMap(target => [...targetFamilySet(target)]));
    const byFamily = new Map();
    for (const card of cards || []) {
      for (const route of card?.routeRows || card?.__routeRows || []) {
        const familyId = String((route.familyIds || [route.familyId || route.skillId])[0]);
        if (targetedFamilies.has(familyId)) continue;
        const metrics = contextualGoldMetrics(route, {
          ...options,
          sourceCardId: card.id
        });
        const weight = number(metrics?.weight, 0);
        if (!weight) continue;
        if (!byFamily.has(familyId)) {
          byFamily.set(familyId, {
            familyId: number(familyId),
            name: route.skill?.nameZhTw || route.skill?.name || familyId,
            weight,
            alternativeSourceCount: metrics.alternativeSourceCount,
            factorabilityProxy: 0,
            scarcityMultiplier: metrics.scarcityMultiplier,
            sourceBreadth: metrics.sourceBreadth,
            sourceBreadthSource: metrics.source,
            effectScore: metrics.effectScore,
            effectMultiplier: metrics.effectMultiplier,
            timingMultiplier: metrics.timingMultiplier,
            courseNeedMultiplier: metrics.courseNeedMultiplier,
            recoveryNeedMultiplier: metrics.recoveryNeedMultiplier,
            effectTypes: metrics.effectTypes,
            conditionReliability: metrics.conditionReliability,
            routes: []
          });
        }
        const row = byFamily.get(familyId);
        row.weight = Math.max(row.weight, weight);
        row.alternativeSourceCount = Math.min(
          row.alternativeSourceCount,
          metrics.alternativeSourceCount
        );
        row.scarcityMultiplier = Math.max(
          row.scarcityMultiplier,
          metrics.scarcityMultiplier
        );
        row.effectScore = Math.max(row.effectScore, metrics.effectScore);
        row.effectMultiplier = Math.max(row.effectMultiplier, metrics.effectMultiplier);
        row.timingMultiplier = Math.max(row.timingMultiplier, metrics.timingMultiplier);
        row.courseNeedMultiplier = Math.max(row.courseNeedMultiplier, metrics.courseNeedMultiplier);
        row.recoveryNeedMultiplier = Math.max(row.recoveryNeedMultiplier, metrics.recoveryNeedMultiplier);
        row.conditionReliability = Math.max(row.conditionReliability || 0, metrics.conditionReliability || 0);
        row.routes.push({
          cardId: number(card.id),
          skillId: number(route.skillId),
          source: route.source,
          routeType: route.routeType || route.sourceKind || route.eventKind || null,
          sourceKind: route.sourceKind || route.routeType || null,
          eventKind: route.eventKind || route.routeEvidence?.eventKind || null,
          probabilitySource: route.probabilitySource || null,
          bonusOnly: route.bonusOnly === true,
          exclusiveGroup: route.exclusiveGroup || null,
          hintMetrics: route.hintMetrics || null,
          probability: clamp(
            route.coverageProbability ?? route.probability ?? route.reliability,
            0,
            1
          ),
          coverageProbability: clamp(
            route.coverageProbability ?? route.probability ?? route.reliability,
            0,
            1
          ),
          reliability: route.reliability,
          conditionReliability: route.conditionReliability ?? route.reliability ?? null,
          eventBranchKey: route.eventBranchKey || null,
          eventBranchGroupId: route.eventBranchGroupId || route.routeEvidence?.eventId || null,
          eventBranchCoObtainable: route.eventBranchCoObtainable === true,
          eventBranchExplicit: route.eventBranchExplicit === true,
          eventBranchDataIncomplete: route.eventBranchDataIncomplete === true,
          eventBranchPolicy: route.eventBranchPolicy || null,
          sourceKey: route.sourceKey || route.candidateSourceKey
            || `support:${Number(card.id)}:family:${familyId}`,
          tags: route.skill?.tags || []
        });
      }
    }
    const rows = [...byFamily.values()].map(row => ({
      ...row,
      coverageProbability: combinedRouteProbability(row.routes, options)
    }));
    return {
      rows,
      raw: rows.reduce((sum, row) => sum + number(row.weight, 0)
        * number(row.coverageProbability, 0), 0)
    };
  }

  function deckScenarioFitRaw(card, input) {
    const type = normalizeSupportType(card?.supportType);
    const fitsTemplate = templateVariants(input)
      .some(variant => typeCounts(variant)[type] > 0);
    const conditional = card?.resolvedProfile?.conditionalEffects || [];
    const conditionalProbability = conditional.length
      ? conditional.reduce((sum, item) => sum + number(item.probability, 0.5), 0) / conditional.length
      : 0.9;
    // A missing runtime unique context is reported as uncertainty, but it is
    // not a hidden score penalty.  Only incomplete level data affects this
    // completeness term; peak/conditional unique values never enter ranking.
    const dataCompleteness = card?.modelMode === 'partial-stats' ? 0.7 : 1;
    const scenarioRequired = input?.scenario?.requiredSupportTypes
      || input?.courseProfile?.scenario?.requiredSupportTypes
      || [];
    const scenarioTypeMatches = scenarioRequired.map(normalizeSupportType).includes(type);
    const mandatoryScenarioCard = scenarioCardIsRequired(card, input);
    const scenarioBonus = scenarioTypeMatches ? 0.15 : 0;
    const flexPenalty = !mandatoryScenarioCard
      && type === 'Group' && !scenarioTypeMatches
      ? 0.12
      : 0;
    return clamp(
      (fitsTemplate ? 0.58 : 0.2)
      + conditionalProbability * 0.22
      + dataCompleteness * 0.2
      + scenarioBonus
      - flexPenalty,
      0,
      1
    );
  }

  function cardAnalysis(instance, input, selectedCards = [], benchmarkContext = null) {
    const profile = input.profiles.get(number(instance.id));
    const fixture = input.fixtures.get(number(instance.id));
    const matureBenchmark = benchmarkContext
      || buildMatureFriendshipTrainingBenchmarkContext(
        [...selectedCards, instance],
        input.trainingLifecycleProxy
      );
    const resolved = resolveProfile(
      instance,
      profile,
      input.context,
      fixture,
      selectedCards,
      matureBenchmark
    );
    const panel = panelMetrics(instance, resolved, selectedCards, input);
    const existingRecoveryFamilies = new Set((selectedCards || []).flatMap(card =>
      (card.recoveryRoutes || [])
        .filter(route => number(route.expectedCoverage, 0) > 0)
        .map(route => String(route.familyId))
    ));
    const recoveryOptions = {
      ...input,
      recoveryPlan: {
        ...input.recoveryPlan,
        currentDeficit: Math.max(0, input.recoveryPlan.requiredGold - existingRecoveryFamilies.size)
      }
    };
    const targetRows = input.deckTargets || input.targets;
    const routeCacheKey = [
      Number(instance.id),
      instance.borrowed ? 'borrow' : 'owned',
      Number(instance.level),
      Number(instance.limitBreak),
      Number(resolved.effects?.[17] || 0),
      Number(resolved.effects?.[18] || 0),
      Number(recoveryOptions.recoveryPlan.currentDeficit || 0),
      targetRows.map(target => Number(target.id)).join(',')
    ].join(':');
    let cachedRoutes = input.cardRouteRowsCache.get(routeCacheKey);
    if (!cachedRoutes) {
      const routeRows = skillRoutesForCard(
        instance,
        recoveryOptions,
        targetRows,
        null,
        resolved
      );
      cachedRoutes = {
        routeRows,
        recoveryRoutes: recoveryRouteRows(instance, recoveryOptions, routeRows)
      };
      input.cardRouteRowsCache.set(routeCacheKey, cachedRoutes);
    }
    const routeRows = cachedRoutes.routeRows;
    const recoveryRoutes = cachedRoutes.recoveryRoutes;
    const effectiveFamilies = new Set(routeRows
      .filter(route => route.matchedTargets.length)
      .map(route => String(route.familyId)));
    const skillPt = number(panel.skillPtEconomy, 0);
    const acquisitionBreakdown = acquisitionCandidateBreakdown(
      routeRows,
      instance,
      input,
      selectedCards
    );
    // Necessary-skill axis receives deterministic/event coverage only.
    // Hint-only acquisition belongs wholly to the hint axis; mixed families
    // award hints just their marginal residual chance there.
    const declaredSkillScore = acquisitionBreakdown.length
      ? acquisitionBreakdown.reduce((sum, row) => sum + number(row.eventMarginalValue, 0), 0)
      : targetCoverageRaw(routeRows, input);
    const contextualGold = contextualGoldForCards(
      [{ ...instance, routeRows }],
      input.deckTargets || input.targets,
      input
    );
    const skillScore = declaredSkillScore + contextualGold.raw;
    const contextualGoldBonus = contextualGoldBonusScore(contextualGold.raw, input);
    const probabilityFamilies = new Set(routeRows
      .filter(route => isFormalAcquisitionRoute(route)
        && clamp(route.probability ?? route.reliability, 0, 1) >= 0.2)
      .map(route => String(route.familyId)));
    const breadth = probabilityFamilies.size;
    const hintScore = acquisitionBreakdown.length
      ? acquisitionBreakdown.reduce((sum, row) => sum + number(row.hintEconomyValue, 0), 0)
      : hintEfficiencyRaw(routeRows, input);
    const hintEconomyBreakdownRows = hintEconomyBreakdown(routeRows, input);
    return {
      ...instance,
      scenarioRequired: scenarioCardIsRequired(instance, input),
      resolvedProfile: resolved,
      uniqueResolution: resolved.uniqueResolution,
      panel,
      trainingBenchmark: {
        rawGain: number(panel.expected?.rawTrainingGain ?? panel.rawTrainingGain, 0),
        rawTrainingScore: number(panel.expected?.rawTrainingScore ?? panel.rawTrainingScore, 0),
        nonCapScore: number(panel.expected?.nonCapScore ?? panel.nonCapScore, 0),
        capPolicy: 'deck-aggregate-only'
      },
      skillPtBenchmark: { ...(panel.skillPtComponents || {}) },
      routeRows,
      recoveryRoutes,
      skillPt,
      skillPtScore: skillPt,
      skillScore,
      declaredSkillScore,
      courseStyleGoldScore: contextualGold.raw,
      contextualGoldBonusScore: contextualGoldBonus,
      courseStyleGoldRoutes: contextualGold.rows,
      hintEfficiencyScore: hintScore,
      hintEconomyBreakdown: hintEconomyBreakdownRows,
      acquisitionBreakdown,
      acquisitionModel: acquisitionBreakdown.length
        ? 'candidate-specific-marginal'
        : 'route-only-fallback',
      breadth,
      axisRaw: {
        trainingOutput: number(panel.scoreExpected ?? panel.score, 0),
        skillPtEconomy: skillPt,
        // Keep the 25% necessary-skill axis tied to declared target
        // coverage. Contextual compatible gold is an independent bounded
        // bonus, not a second way to satisfy a race target.
        necessarySkills: declaredSkillScore,
        contextualGold: contextualGold.raw,
        hintEfficiency: hintScore,
        deckScenarioFit: deckScenarioFitRaw({ ...instance, resolvedProfile: resolved, modelMode: resolved.modelMode }, input)
      },
      modelMode: resolved.modelMode,
      __routeRows: routeRows
    };
  }

  function routeVariantsForCard(card, input, targetRows) {
    const routeRows = skillRoutesForCard(card, {
      ...input,
      deferChoiceSelection: true
    }, targetRows, null, card.resolvedProfile);
    const choiceRoutes = routeRows.filter(route => Number.isInteger(route.choiceOption));
    if (!choiceRoutes.length) return [{ routes: routeRows, signature: '' }];
    const otherRoutes = routeRows.filter(route => !Number.isInteger(route.choiceOption));
    const options = new Map();
    for (const route of choiceRoutes) {
      const groupIndex = Number.isInteger(route.choiceGroupIndex)
        ? route.choiceGroupIndex
        : 0;
      if (!options.has(groupIndex)) options.set(groupIndex, new Map());
      const group = options.get(groupIndex);
      if (!group.has(route.choiceOption)) group.set(route.choiceOption, []);
      group.get(route.choiceOption).push(route);
    }
    let variants = [{ routes: otherRoutes, signature: '' }];
    for (const [groupIndex, groupOptions] of [...options.entries()]
      .sort(([left], [right]) => left - right)) {
      variants = variants.flatMap(variant => [...groupOptions.entries()]
        .sort(([left], [right]) => left - right)
        .map(([option, routes]) => ({
          routes: [...variant.routes, ...routes],
          signature: variant.signature
            ? `${variant.signature}|${groupIndex}:${option}`
            : `${groupIndex}:${option}`
        })));
    }
    return variants;
  }

  function choiceCombinationScore(routeSets, input, targetRows) {
    const routes = routeSets.flat();
    const targetsByFamily = new Map();
    for (const target of targetRows || []) {
      const familyId = String((target.familyIds || [target.familyId || target.id])[0]);
      if (!targetsByFamily.has(familyId)) targetsByFamily.set(familyId, {
        weight: number(target.weight, 0),
        targetIds: []
      });
      const family = targetsByFamily.get(familyId);
      family.weight = Math.max(family.weight, number(target.weight, 0));
      family.targetIds.push(target.id);
    }
    let coverageScore = 0;
    for (const family of targetsByFamily.values()) {
      const familyRoutes = routes.filter(route =>
        isFormalAcquisitionRoute(route)
        && (route.matchedTargets || []).some(target => family.targetIds.includes(target.id))
      );
      coverageScore += family.weight * combinedRouteProbability(familyRoutes, input);
    }
    // Choice branches must use the same contextual-gold model as the final
    // package.  Otherwise a mutually exclusive gold choice is decided by
    // route order/ID even when one branch has materially better course,
    // effect, timing, or recovery value.
    const hasContextualGold = routes.some(route =>
      isFormalAcquisitionRoute(route)
      && formalRouteProbability(route) > 0
      && route?.source === 'event'
      && number(route?.skill?.rarity ?? route?.skillRarity ?? route?.rarity, 0) >= 2
      && !(route?.matchedTargets || []).length
    );
    const contextual = hasContextualGold
      ? contextualGoldForCards(
        [...new Set(routes
          .map(route => Number(route.cardId))
          .filter(Number.isFinite))]
          .map(cardId => ({
            id: cardId,
            routeRows: routes.filter(route => Number(route.cardId) === cardId)
          })),
        targetRows,
        { ...input, deckTargets: targetRows }
      )
      : { raw: 0 };
    const preCovered = recoveryFamilyKeysFromPlan(input.recoveryPlan, input.skills);
    const recoveryCandidates = routeSets.flatMap((routeSet, sourceIndex) =>
      (routeSet || []).map((route, routeIndex) => {
        if (!isFormalAcquisitionRoute(route)
          || formalRouteProbability(route) <= 0
          || !route.recovery?.length
          || number(route.skill?.rarity ?? route?.skillRarity ?? route?.rarity, 0) !== 2) {
          return null;
        }
        const familyId = String((route.familyIds || [route.familyId || route.skillId])[0]);
        const quality = recoveryQualityForSkill(
          route.skillId,
          input.recoveryPlan,
          input.skills,
          route,
          input.context
        );
        const explicitSourceKey = route?.candidateSourceKey || route?.sourceKey;
        const sourceKey = explicitSourceKey
          ? String(explicitSourceKey)
          : `support:${route.cardId ?? route.supportId ?? sourceIndex}`;
        return {
          sourceKey,
          familyId,
          skillId: route.skillId,
          quality,
          expectedCoverage: formalExpectedCoverage(route, quality),
          route,
          routeIndex
        };
      }).filter(Boolean)
    );
    const recoveryFamilies = unionRecoveryCandidates(recoveryCandidates);
    const requiredGold = Math.max(0, number(input.recoveryPlan?.requiredGold, 0));
    const qualified = new Set([
      ...preCovered,
      ...[...recoveryFamilies.entries()]
        .filter(([, item]) => item.quality >= 0.82 && item.expectedCoverage > 0)
        .map(([familyId]) => familyId)
    ]);
    const qualifiedCount = qualified.size;
    const structuralGain = Math.min(requiredGold, qualifiedCount);
    const structuralDeficit = Math.max(0, requiredGold - qualifiedCount);
    const expectedRecovery = [...recoveryFamilies.values()]
      .reduce((sum, item) => sum + item.expectedCoverage, 0);
    return coverageScore
      + contextual.raw
      + structuralGain * 4000
      - structuralDeficit * 4000
      + expectedRecovery * 40;
  }

  function choosePackageRoutes(cards, input) {
    const targetRows = input.deckTargets || input.targets;
    const variants = cards.map(card => routeVariantsForCard(card, input, targetRows));
    let combinations = [{ routeSets: [], signature: '' }];
    for (const cardVariants of variants) {
      combinations = combinations.flatMap(state => cardVariants.map(variant => ({
        routeSets: [...state.routeSets, variant.routes],
        signature: `${state.signature}|${variant.signature}`
      })));
    }
    const best = combinations
      .map(state => ({
        ...state,
        score: choiceCombinationScore(state.routeSets, input, targetRows)
      }))
      .sort((left, right) => right.score - left.score || left.signature.localeCompare(right.signature))[0]
      || { routeSets: cards.map(card => card.__routeRows || []), signature: '' };
    cards.forEach((card, index) => {
      const routeRows = best.routeSets[index] || [];
      card.__routeRows = routeRows;
      card.routeRows = routeRows;
      card.recoveryRoutes = recoveryRouteRows(card, input, routeRows);
    });
    return cards;
  }

  function routeOverlapIdentity(route) {
    const cardId = number(route?.cardId ?? route?.supportId, null);
    if (!Number.isFinite(cardId)) return null;
    const explicit = route?.candidateSourceKey || route?.sourceKey;
    if (explicit) return String(explicit);
    const familyId = number(
      route?.familyId
        ?? route?.familyIds?.[0]
        ?? route?.skillId,
      0
    );
    // A card is one acquisition candidate.  Duplicate event rows, a
    // same-family hint, and an event/hint pair on that card must not become
    // additional deck-fit penalties after candidate-specific marginalization.
    return `support:${cardId}:family:${familyId}`;
  }

  function paretoFrontier(cards, limit = 10) {
    const byType = new Map();
    for (const card of cards) {
      const type = normalizeSupportType(card.supportType);
      if (!byType.has(type)) byType.set(type, []);
      byType.get(type).push(card);
    }
    const output = [];
    for (const [type, group] of byType.entries()) {
      const selected = new Map();
      const metrics = [
        ['panel', item => item.panel.score],
        ['skillPt', item => item.skillPtScore],
        ['skill', item => item.skillScore],
        ['recovery', item => item.recoveryRoutes
          .filter(route => number(route.expectedCoverage, 0) > 0)
          .reduce((sum, route) => sum + route.quality, 0)],
        ['breadth', item => item.breadth]
      ];
      for (const [reason, metric] of metrics) {
        group.slice().sort((left, right) => metric(right) - metric(left) || number(left.id) - number(right.id))
          .slice(0, limit)
          .forEach(item => selected.set(`${item.borrowed ? 'borrow' : 'owned'}:${number(item.id)}`, { item, reason }));
      }
      output.push(...[...selected.values()].map(row => ({ ...row.item, frontierReason: row.reason })));
    }
    return output.sort((left, right) => number(left.id) - number(right.id));
  }

  function cardHasSpeed(cards) {
    return cards.some(card => normalizeSupportType(card.supportType) === 'Speed');
  }

  function recoveryQualityByTier(tier, fallback = 0) {
    const qualityByTier = { S: 1, A: 0.82, B: 0.65, C: 0.45 };
    const value = qualityByTier[String(tier || '').trim().toUpperCase()];
    return value == null ? fallback : value;
  }

  function recoveryQualityForSkill(skillId, recoveryPlan, skills, route = null, context = {}) {
    const routeType = String(route?.routeType || route?.sourceKind || route?.eventKind || '').toLowerCase();
    // Formal recovery cannot be supplied by a random or unknown event even
    // when a legacy quality menu gave the skill a high conditional quality.
    if (routeType.includes('random') || routeType.includes('unknown')) return 0;
    for (const group of recoveryPlan?.quality || []) {
      if ((group.skillIds || []).map(Number).includes(Number(skillId))) {
        const explicit = Number(group.value);
        return Number.isFinite(explicit)
          ? clamp(explicit, 0, 1)
          : recoveryQualityByTier(group.tier, 0);
      }
    }
    if (recoveryPlan?.defaultQuality != null) {
      return clamp(number(recoveryPlan.defaultQuality, 0), 0, 1);
    }
    const skill = route?.skill || skills?.get?.(Number(skillId));
    const recoveryEffects = (skill?.conditionGroups || [])
      .flatMap(group => group?.effects || [])
      .filter(effect => number(effect?.type, 0) === 9 && number(effect?.value, 0) > 0);
    const strongestEffect = Math.max(
      0,
      ...recoveryEffects.map(effect => number(effect?.value, 0))
    );
    if (!strongestEffect) return 0;
    const reliability = clamp(number(
      route?.conditionReliability ?? route?.reliability,
      dynamicReliability(skill)
    ), 0, 1);
    const sourceMultiplier = route?.source === 'hint'
      ? 0.86
      : routeType.includes('continuous')
        ? 0.96
        : route?.source === 'event'
          ? 0.9
          : 0.72;
    const conditionText = (skill?.conditionGroups || [])
      .map(group => String(group?.condition || ''))
      .join('&');
    const runningStyle = number(context?.running_style ?? context?.runningStyle, null);
    const timingMultiplier = runningStyle === 1 && /order_rate\s*>=\s*40/i.test(conditionText)
      ? 0.35
      : runningStyle === 1 && /order_rate\s*<=\s*50/i.test(conditionText)
        ? 1
        : /is_overtake|accumulatetime/i.test(conditionText)
          ? 0.5
          : /phase|corner/i.test(conditionText)
            ? 1
            : 0.85;
    const effectStrength = clamp(strongestEffect / 550, 0, 1);
    return clamp(
      0.38
        + effectStrength * 0.14
        + reliability * 0.18
        + sourceMultiplier * 0.08
        + timingMultiplier * 0.12,
      0.35,
      1
    );
  }

  function recoveryEntryIsQualified(entry) {
    return entry?.qualified !== false
      && number(entry?.quality ?? entry?.route?.quality, 0.65) >= 0.82
      && number(entry?.expectedCoverage, 0) > 0;
  }

  function recoveryFamilyKeysFromPlan(recoveryPlan, skills) {
    const covered = recoveryFamiliesFrom([], recoveryPlan || {}, skills);
    return new Set([...covered.entries()]
      .filter(([, item]) => item.qualified !== false)
      .map(([familyId]) => familyId));
  }

  function unionRecoveryCandidates(candidates) {
    const byFamily = new Map();
    for (const candidate of candidates || []) {
      const familyId = String(candidate.familyId);
      const sourceKey = String(candidate.sourceKey || `route:${candidate.skillId || candidate.id}`);
      if (!byFamily.has(familyId)) byFamily.set(familyId, new Map());
      const bySource = byFamily.get(familyId);
      const previous = bySource.get(sourceKey);
      if (!previous
        || number(candidate.expectedCoverage, 0) > number(previous.expectedCoverage, 0)
        || (number(candidate.expectedCoverage, 0) === number(previous.expectedCoverage, 0)
          && number(candidate.quality, 0) > number(previous.quality, 0))) {
        bySource.set(sourceKey, { ...candidate, sourceKey });
      }
    }
    const result = new Map();
    for (const [familyId, sources] of byFamily.entries()) {
      const sourceRows = [...sources.values()];
      let uncovered = 1;
      for (const source of sourceRows) {
        uncovered *= 1 - clamp(number(source.expectedCoverage, 0), 0, 1);
      }
      const expectedCoverage = clamp(1 - uncovered, 0, 1);
      const representative = sourceRows
        .slice()
        .sort((left, right) => number(right.expectedCoverage, 0) - number(left.expectedCoverage, 0)
          || number(right.quality, 0) - number(left.quality, 0)
          || String(left.sourceKey).localeCompare(String(right.sourceKey)))[0];
      if (!representative || expectedCoverage <= 0) continue;
      result.set(familyId, {
        ...representative,
        probability: expectedCoverage,
        expectedCoverage,
        qualified: number(representative.quality, 0) >= 0.82
          && expectedCoverage > 0,
        sourceCount: sourceRows.length,
        sourceKeys: sourceRows.map(source => source.sourceKey)
      });
    }
    return result;
  }

  function marginalRecoveryFamilyCount(cards, input) {
    const required = Math.max(0, number(input?.recoveryPlan?.requiredGold, 0));
    if (!required) return 0;
    const preCovered = recoveryFamilyKeysFromPlan(input.recoveryPlan, input.skills);
    const allCovered = recoveryFamiliesFrom(cards, input.recoveryPlan, input.skills);
    const cardFamilies = [...allCovered.entries()]
      .filter(([, item]) => item.qualified !== false)
      .map(([familyId]) => familyId)
      .filter(key => !preCovered.has(key));
    return Math.min(Math.max(0, required - preCovered.size), cardFamilies.length);
  }

  function recoveryFamiliesFrom(cards, recoveryPlan, skills) {
    const covered = new Map();
    const preCovered = uniqueNumbers(recoveryPlan.preCoveredSkillIds || []);
    for (const id of preCovered) {
      const skill = skills?.get(id);
      const isGoldRecovery = number(skill?.rarity, 0) === 2
        && (skill?.conditionGroups || []).some(group => (group.effects || [])
          .some(effect => number(effect.type) === 9 && number(effect.value, 0) > 0));
      if (!isGoldRecovery) continue;
      const familyIds = familyIdsForSkill(skill, skills);
      const familyId = String(familyIds[0] || id);
      const quality = recoveryQualityForSkill(id, recoveryPlan, skills, null, {});
      covered.set(familyId, {
        source: 'battleUma',
        probability: 1,
        expectedCoverage: 1,
        reliability: 1,
        quality,
        qualified: quality >= 0.82,
        skillId: id
      });
    }
    const candidates = [];
    for (const [cardIndex, card] of (cards || []).entries()) {
      for (const route of card.recoveryRoutes || []) {
        const formalProbability = formalRouteProbability(route);
        const expectedCoverage = formalExpectedCoverage(route);
        if (expectedCoverage <= 0) continue;
        const sourceIdentity = card.candidateSourceKey
          || card.sourceKey
          || card.id
          || cardIndex;
        candidates.push({
          sourceKey: `support:${sourceIdentity}`,
          source: `card:${sourceIdentity}`,
          skillId: route.id,
          familyId: route.familyId,
          probability: formalProbability,
          expectedCoverage,
          reliability: route.reliability,
          quality: route.quality,
          route
        });
      }
    }
    for (const [familyId, candidate] of unionRecoveryCandidates(candidates).entries()) {
      const current = covered.get(familyId);
      if (!current || candidate.expectedCoverage > Number(current.expectedCoverage || 0)) {
        covered.set(familyId, candidate);
      }
    }
    return covered;
  }

  function packageCoverage(cards, input) {
    choosePackageRoutes(cards, input);
    const rows = coverageForCards(cards, input.targets, {
      ...input,
      skills: input.skills
    });
    const coveredFamilies = new Set();
    rows.forEach(row => {
      if (row.coverageProbability > 0.01) coveredFamilies.add(String(row.familyId));
    });
    const recoveryFamilies = recoveryFamiliesFrom(cards, input.recoveryPlan, input.skills);
    const requiredGold = input.recoveryPlan.requiredGold;
    const coveredRecoveryCount = [...recoveryFamilies.values()]
      .filter(item => number(item.expectedCoverage, 0) > 0)
      .length;
    const qualifiedRecoveryFamilies = [...recoveryFamilies.values()]
      .filter(recoveryEntryIsQualified);
    const qualifiedDistinctFamilies = qualifiedRecoveryFamilies.length;
    const expectedRecoveryCoverage = qualifiedRecoveryFamilies
      .reduce((sum, item) => sum + number(item.expectedCoverage, item.probability), 0);
    const structuralDeficit = Math.max(0, requiredGold - qualifiedDistinctFamilies);
    const expectedDeficit = Math.max(0, requiredGold - expectedRecoveryCoverage);
    const reliabilityRisk = qualifiedDistinctFamilies
      ? clamp(1 - expectedRecoveryCoverage / qualifiedDistinctFamilies, 0, 1)
      : 1;
    const recoveryGate = {
      requiredGold,
      structuralSlots: requiredGold,
      coveredDistinctFamilies: coveredRecoveryCount,
      qualifiedDistinctFamilies,
      expectedCoverage: Math.round(expectedRecoveryCoverage * 100) / 100,
      reliabilityRisk: Math.round(reliabilityRisk * 100) / 100,
      expectedDeficit: Math.round(expectedDeficit * 100) / 100,
      deficit: structuralDeficit,
      structuralDeficit,
      status: structuralDeficit > 0 ? 'deficit' : 'met',
      coveredFamilies: [...recoveryFamilies.entries()].map(([familyId, item]) => ({ familyId: number(familyId), ...item }))
    };
    const preCoveredRecoveryCount = recoveryFamilyKeysFromPlan(input.recoveryPlan, input.skills).size;
    const recoverySlotsRemaining = Math.max(0, requiredGold - preCoveredRecoveryCount);
    const effectiveGoldSkills = [...recoveryFamilies.values()]
      .filter(item => recoveryEntryIsQualified(item) && item.route)
      .sort((left, right) => number(right.expectedCoverage, 0) - number(left.expectedCoverage, 0))
      .slice(0, recoverySlotsRemaining)
      .map(item => item.route)
      .filter(Boolean)
      .map(route => ({
        id: route.id,
        familyId: route.familyId,
        name: route.name,
        quality: route.quality,
        expectedCoverage: number(recoveryFamilies.get(String(route.familyId))?.expectedCoverage, 0),
        reliability: route.reliability,
        source: route.source,
        choiceGroup: route.choiceGroup || null
      }));
    return {
      rows,
      coveredFamilies,
      recoveryFamilies,
      recoveryGate,
      deficit: structuralDeficit,
      effectiveGoldSkills
    };
  }

  function modeWeights(mode) {
    return mode === 'panel'
      ? { panel: 0.48, skillPt: 0.28, skill: 0.12, recovery: 0.04, breadth: 0.08 }
      : mode === 'skill'
        ? { panel: 0.16, skillPt: 0.22, skill: 0.38, recovery: 0.08, breadth: 0.16 }
        : mode === 'recovery'
          ? { panel: 0.18, skillPt: 0.1, skill: 0.16, recovery: 0.46, breadth: 0.1 }
          : { panel: 0.3, skillPt: 0.2, skill: 0.25, recovery: 0.17, breadth: 0.08 };
  }

  function packageMetrics(owned, borrowed, input, mode) {
    // Re-resolve the complete deck because support uniques can depend on the
    // other five support types. Beam analysis remains intentionally isolated.
    const allCards = [...owned, borrowed];
    const matureBenchmark = buildMatureFriendshipTrainingBenchmarkContext(
      allCards,
      input.trainingLifecycleProxy
    );
    const cards = allCards.map((card, index) =>
      cardAnalysis({
        ...card,
        borrowed: Boolean(card.borrowed),
        level: card.level,
        limitBreak: card.limitBreak
      }, input, allCards.filter((_, otherIndex) => otherIndex !== index), matureBenchmark)
    );
    const coverage = packageCoverage(cards, input);
    const deckPanels = deckPanelMetrics(cards, input);
    const panelScore = number(deckPanels.expected.score, 0);
    const panelBaseScore = number(deckPanels.base.score, panelScore);
    const panelPeakScore = number(deckPanels.peak.score, panelScore);
    const skillPtScore = cards.reduce((sum, card) => sum + number(card.skillPtScore, 0), 0);
    const deckRows = coverage.rows.filter(row => row.sourceEligibility !== 'directParent'
      && row.sourceEligibility !== 'factorOnly');
    const deckTargets = input.deckTargets || input.targets;
    // Choice selection can change after the six-card combination is known.
    // Recompute each selected candidate's marginal rows against the other
    // five cards so package ranking uses the same candidate-specific model as
    // card ranking. Formal coverage.rows below remains the unscaled union.
    const packageAcquisitionBreakdown = cards.flatMap((card, index) => {
      const rows = card.__routeRows || card.routeRows || [];
      const breakdown = acquisitionCandidateBreakdown(
        rows,
        card,
        input,
        cards.filter((_, otherIndex) => otherIndex !== index)
      );
      card.acquisitionBreakdown = breakdown;
      return breakdown.map(item => ({
        ...item,
        cardId: Number(card.id),
        borrowed: Boolean(card.borrowed)
      }));
    });
    const hasAcquisitionBreakdown = packageAcquisitionBreakdown.length > 0;
    // Card-level acquisition rows are leave-one-out marginal attribution for
    // scarcity/explanation. They are not additive package coverage: summing
    // them can count the same target repeatedly (or even decrease as cards
    // are added). The formal necessary axis is the union over each target's
    // event/battle-uma routes, with same-card exclusivity and cross-card
    // noisy-or handled by packageNecessarySkillRaw/combinedRouteProbability.
    const declaredSkillRaw = packageNecessarySkillRaw(deckRows, input);
    const contextualGold = contextualGoldForCards(cards, deckTargets, input);
    const contextualGoldRaw = number(contextualGold.raw, 0);
    const contextualGoldBonus = contextualGoldBonusScore(contextualGoldRaw, input);
    const skillRaw = declaredSkillRaw + contextualGoldRaw;
    const breadth = new Set(deckRows
      .filter(row => row.coverageProbability >= 0.2)
      .map(row => String(row.familyId))).size;
    const overlapItems = [];
    for (const row of coverage.rows) {
      const sourceKeys = [...new Set(row.routes
        .map(routeOverlapIdentity)
        .filter(Boolean))];
      const sourceCount = sourceKeys.length;
      if (sourceCount > 1 || row.coverageProbability > 0.85) {
        overlapItems.push({
          familyId: row.familyId,
          name: row.name,
          sourceCount,
          sourceKeys,
          coverageProbability: row.coverageProbability,
          penalty: 0,
          scoring: 'audit-only-after-acquisition-marginal'
        });
      }
    }
    const recoverySources = new Map();
    for (const card of cards) {
      for (const route of card.recoveryRoutes || []) {
        if (Number(route.quality) < 0.82 || number(route.expectedCoverage, 0) <= 0) continue;
        const familyId = String(route.familyId);
        if (!recoverySources.has(familyId)) recoverySources.set(familyId, []);
        recoverySources.get(familyId).push({ cardId: number(card.id), skillId: number(route.id) });
      }
    }
    for (const [familyId, sources] of recoverySources.entries()) {
      const distinctSources = new Map(sources.map(item => [item.cardId, item]));
      if (distinctSources.size > 1) {
        overlapItems.push({
          familyId: number(familyId),
          name: `回復 family ${familyId}`,
          sourceCount: distinctSources.size,
          coverageProbability: number(coverage.recoveryFamilies.get(familyId)?.expectedCoverage, 0),
          kind: 'recovery',
          penalty: Math.min(0.12, (distinctSources.size - 1) * 0.06),
          note: '同一金回 family 只佔一個結構槽；其他來源只保留可靠率小額價值'
        });
      }
    }
    // Candidate-specific acquisition already discounts duplicate sources.  A
    // second ordinary-overlap deduction would charge the same evidence twice;
    // retain distinct source identities for audit/UI, but do not score it.
    const overlapPenalty = 0;
    const recoveryRedundancyPenalty = overlapItems
      .filter(item => item.kind === 'recovery')
      .reduce((sum, item) => sum + number(item.penalty, 0), 0);
    // A six-card panel is commonly well above 2,200 proxy points. A hard
    // clamp there made modern decks indistinguishable, so keep the ordering
    // with a saturating curve whose half-scale is a reasonable full-deck
    // reference instead of treating every modern deck as 100%.
    const panelHalfScale = Math.max(1, number(input.panelHalfScale, 6000));
    const panelNormalized = clamp(panelScore / (panelScore + panelHalfScale), 0, 1);
    const skillPtNormalization = skillPointNormalized(skillPtScore, input);
    const ptNormalized = skillPtNormalization.value;
    const targetWeightTotal = deckTargets.reduce((sum, target) => sum + number(target.weight, 0), 0);
    // Only declared target coverage belongs to the 25% necessary-skill axis.
    // Contextual event gold uses its own bounded utility budget below and
    // cannot inherit a declared target's weight.
    const skillNormalized = deckTargets.length
      ? clamp(declaredSkillRaw / Math.max(1, targetWeightTotal), 0, 1)
      : 0.5;
    // Calculate hint value from the package coverage rows, so a route only
    // earns its marginal chance after all event/battle-uma coverage and is
    // never added in full beside necessary-skill coverage.
    // Candidate breakdowns are leave-one-out explanations. They are not an
    // additive package metric: summing them double-discounts shared residual
    // coverage and can make a second independent hint lower the deck score.
    // Compute the full-deck noisy-or/source attribution exactly once.
    const hintRaw = packageHintEfficiencyRaw(deckRows, input);
    const hintNormalized = targetWeightTotal
      ? clamp(hintRaw / targetWeightTotal, 0, 1)
      : 0.5;
    const deckFitRaw = cards.length
      ? cards.reduce((sum, card) => sum + number(card.axisRaw?.deckScenarioFit, 0), 0) / cards.length
      : 0;
    const deckFitNormalized = clamp(deckFitRaw, 0, 1);
    const recoveryNormalized = input.recoveryPlan.requiredGold
      ? clamp(coverage.recoveryGate.qualifiedDistinctFamilies / input.recoveryPlan.requiredGold, 0, 1)
      : 0;
    const breadthNormalized = clamp(breadth / Math.max(1, deckTargets.length || 8), 0, 1);
    const weights = modeWeights(mode);
    const survivalPenalty = coverage.deficit * 0.42;
    const overlapAdjusted = breadthNormalized;
    const fiveAxisNormalized = {
      trainingOutput: panelNormalized,
      skillPtEconomy: ptNormalized,
      necessarySkills: skillNormalized,
      hintEfficiency: hintNormalized,
      deckScenarioFit: deckFitNormalized
    };
    const fiveAxisRaw = {
      trainingOutput: panelScore,
      skillPtEconomy: skillPtScore,
      necessarySkills: declaredSkillRaw,
      hintEfficiency: hintRaw,
      deckScenarioFit: deckFitRaw
    };
    const fiveAxisWeights = fiveAxisWeightsForInput(input);
    const fiveAxisContributions = Object.fromEntries(Object.entries(fiveAxisWeights)
      .map(([axis, weight]) => [axis,
        Math.round(fiveAxisNormalized[axis] * weight * 10000) / 100]));
    const fiveAxisScore = Object.values(fiveAxisContributions)
      .reduce((sum, contribution) => sum + contribution, 0);
    const totalScore = Math.round(
      (fiveAxisScore + contextualGoldBonus
        - survivalPenalty * 100 - recoveryRedundancyPenalty * 100) * 100
    ) / 100;
    const residualFactorCost = coverage.rows
      .filter(row => row.coverageProbability < 0.999)
      .map(row => ({
        familyId: row.familyId,
        name: row.name,
        coverageProbability: row.coverageProbability,
        qFinalDeck: row.coverageProbability,
        sourceEligibility: row.sourceEligibility || 'deck',
        priority: Math.round(number(row.weight, 100) * (row.rarity || 1) * (1 - row.coverageProbability) * 100) / 100,
        source: row.routes.map(route => ({ cardId: route.cardId, skillId: route.skillId, kind: route.kind, probability: route.probability })),
        inheritanceReliability: number(row.inheritanceReliability, 0.35)
      }))
      .sort((left, right) => right.priority - left.priority);
    const effectiveFamilies = new Set(deckRows
      .filter(row => row.coverageProbability >= 0.2)
      .map(row => String(row.familyId)));
    const reasons = [];
    if (panelNormalized >= 0.65) reasons.push('友情／訓練與面板輸出較強');
    const skillPtBonusTotal = cards.reduce((sum, card) =>
      sum + number(card.panel?.skillPtComponents?.skillPtBonus, 0), 0);
    const initialSkillPtTotal = cards.reduce((sum, card) =>
      sum + number(card.panel?.skillPtComponents?.initialSkillPt, 0), 0);
    if (ptNormalized >= 0.65) {
      reasons.push(`技能 Pt 經濟：Skill Pt Bonus +${Math.round(skillPtBonusTotal * 10) / 10}、初期 +${Math.round(initialSkillPtTotal * 10) / 10}`);
    }
    if (breadth >= 2) reasons.push(`有效技能家族 ${breadth} 個`);
    if (coverage.effectiveGoldSkills.length) reasons.push(`保留 ${coverage.effectiveGoldSkills.map(item => item.name).join('、')}`);
    if (coverage.recoveryGate.status === 'met') reasons.push('回復門檻已達標');
    else if (coverage.recoveryGate.deficit) reasons.push(`回復仍缺 ${coverage.recoveryGate.deficit} 個去重 family`);
    if (recoveryRedundancyPenalty > 0) reasons.push('同一回復技能家族重複來源只保留可靠率小額價值');
    if (overlapItems.length) reasons.push(`重疊 ${overlapItems.length} 項，僅給可靠率小額價值`);
    const unresolvedUniqueCards = cards
      .filter(card => card.uniqueResolution?.unresolvedEffects?.length)
      .map(card => ({
        id: number(card.id),
        unresolvedEffects: card.uniqueResolution.unresolvedEffects,
        unlockLevel: card.uniqueResolution.unlockLevel
      }));
    const modelMode = cards.some(card => card.modelMode === 'partial-stats')
      ? 'partial-stats'
      : unresolvedUniqueCards.length
        ? 'curve-unique-uncertain'
        : 'max-level-borrow';
    return {
      cards,
      matureFriendshipTrainingBenchmarkContext: matureBenchmark,
      coverage,
      panelScore,
      panelSummary: {
        base: Math.round(panelBaseScore * 100) / 100,
        expected: Math.round(panelScore * 100) / 100,
        peak: Math.round(panelPeakScore * 100) / 100,
        trainingBenchmark: {
          capPolicy: 'target-bound two-stage stat utility applied once after aggregate by output stat',
          statUtilityPolicy: resolveStatUtilityPolicy(input),
          rawGain: deckPanels.expected.rawTrainingGain,
          capAdjustedGain: deckPanels.expected.capAdjustedTrainingGain,
          rawTrainingScore: deckPanels.expected.rawTrainingScore,
          capAdjustedTrainingScore: deckPanels.expected.capAdjustedTrainingScore,
          nonCapScore: deckPanels.expected.nonCapScore
        },
        rawGainByType: deckPanels.expected.rawGainByType,
        capByType: deckPanels.expected.capByType,
        conditionalCards: cards
          .filter(card => card.panel?.conditionalEffects?.length)
          .map(card => ({ id: card.id, conditions: card.panel.conditionalEffects })),
        unresolvedUniqueCards
      },
      skillPtScore,
      skillRaw,
      declaredSkillRaw,
      contextualGoldRaw,
      contextualGoldBonusScore: contextualGoldBonus,
      acquisitionBreakdown: packageAcquisitionBreakdown,
      acquisitionModel: hasAcquisitionBreakdown
        ? 'candidate-specific-marginal'
        : 'route-only-fallback',
      courseStyleGold: contextualGold,
      unresolvedUniqueCards,
      breadth,
      overlapItems,
      overlapPenalty,
      effectiveFamilies,
      effectiveGoldSkills: coverage.effectiveGoldSkills,
      residualFactorCost,
      recoveryGate: coverage.recoveryGate,
      modelMode,
      breakdown: {
        panel: Math.round(panelNormalized * 100) / 100,
        skillPtEconomy: Math.round(ptNormalized * 100) / 100,
        skillGoldRecovery: Math.round(skillNormalized * 100) / 100,
        declaredNecessarySkills: Math.round(declaredSkillRaw * 100) / 100,
        courseStyleGold: Math.round(contextualGoldRaw * 100) / 100,
        contextualGoldBonus: Math.round(contextualGoldBonus * 100) / 100,
        recoveryGate: Math.round(recoveryNormalized * 100) / 100,
        breadth: Math.round(breadthNormalized * 100) / 100,
        overlap: Math.round(overlapAdjusted * 100) / 100,
        survivalPenalty: Math.round(survivalPenalty * 100) / 100,
        recoveryRedundancyPenalty: Math.round(recoveryRedundancyPenalty * 100) / 100,
        weights,
        fiveAxisWeights,
        fiveAxis: Object.fromEntries(Object.entries(fiveAxisNormalized)
          .map(([axis, value]) => [axis, Math.round(value * 10000) / 100])),
        fiveAxisRaw,
        declaredSkillRaw,
        acquisitionBreakdown: packageAcquisitionBreakdown,
        courseStyleGoldRaw: contextualGoldRaw,
        contextualGoldBonusScore: contextualGoldBonus,
        fiveAxisContributions,
        modelMode,
        normalization: {
          panel: 'saturating',
          panelHalfScale,
          skillPt: 'non-saturating',
          skillPtHalfScale: skillPtNormalization.halfScale
        }
      },
      totalScore,
      scoreInputs: {
        panelNormalized,
        ptNormalized,
        skillNormalized,
        recoveryNormalized,
        breadthNormalized,
        overlapAdjusted,
        hintNormalized,
        declaredSkillRaw,
        courseStyleGoldRaw: contextualGoldRaw,
        contextualGoldBonusScore: contextualGoldBonus,
        deckFitNormalized,
        fiveAxisRaw,
        fiveAxisNormalized,
        fiveAxisWeights,
        statSaturationShare: statSaturationShare(input),
        statUtilityPolicy: resolveStatUtilityPolicy(input),
        survivalPenalty,
        panelHalfScale,
        skillPtHalfScale: skillPtNormalization.halfScale,
        recoveryRedundancyPenalty
      },
      reasons,
      cards,
      scoreFormula: `自訂 heuristic：訓練輸出 ${Math.round(fiveAxisWeights.trainingOutput * 1000) / 10}% + 技能 Pt 經濟 ${Math.round(fiveAxisWeights.skillPtEconomy * 1000) / 10}% + 已宣告必要路線 25% + 提示邊際效率 15% + 卡組／劇本適配 15%；五維進入 ${resolveStatUtilityPolicy(input).threshold} 邊際區時，最多把 7.5% 從訓練轉至不受面板折損的技能 Pt；相容 event gold 另以 bounded 小額 bonus 計入；另扣回復存活 gate 與重複懲罰；不是網站 Tier`
    };
  }

  function packageValid(owned, borrowed, input) {
    const cards = [...owned, borrowed].filter(Boolean);
    const errors = [];
    if (owned.length !== 5) errors.push('必須恰好五張自有卡');
    if (!borrowed) errors.push('必須有一張借卡');
    const ids = cards.map(card => number(card.id));
    if (cards.some(card => !cardIsServerAvailable(card, input))) {
      errors.push('卡組含未在目前繁中服可用的支援卡');
    }
    if (new Set(ids).size !== ids.length) errors.push('卡片 ID 不可重複');
    const characters = cards.map(card => number(card.characterId));
    if (characters.some(Number.isFinite) && new Set(characters.filter(Number.isFinite)).size !== characters.filter(Number.isFinite).length) {
      errors.push('支援角色不可重複');
    }
    const targetCharacter = number(input.battleUma?.characterId);
    if (Number.isFinite(targetCharacter) && cards.some(card => number(card.characterId) === targetCharacter)) {
      errors.push('不可使用與戰馬同角色支援卡');
    }
    if (input.requireSpeedCard !== false && !cardHasSpeed(cards)) {
      errors.push('整副牌至少需要一張速度卡');
    }
    if (input.typeTemplateMode !== 'free' && !typeTemplateIsExact(cards, input)) {
      const expected = Object.entries(typeCounts(input.targetTypes))
        .map(([type, count]) => `${type}×${count}`).join('、');
      errors.push(`六張牌型必須符合預設模板${expected ? `（${expected}）` : ''}`);
    }
    if (input.competitionMode && owned.some(card => {
      const gate = competitiveSourceEligibility(card, input);
      return !gate.eligible;
    })) {
      errors.push('競技卡只允許目前繁中服可用、SSR、obtained=gacha');
    }
    if (input.competitionMode && borrowed && !competitiveSourceEligibility(borrowed, input).eligible) {
      errors.push('競技借卡只允許目前繁中服可用、SSR、obtained=gacha');
    }
    if (!owned.every(card => !card.borrowed && cardIsOwned(
      card,
      input.inventory || input.ownedInventory,
      input.rules,
      input.competitionMode ? { ...input, explicitOnly: true } : input
    ))) {
      errors.push('自有欄位必須符合持有規則');
    }
    if (borrowed && !borrowed.borrowed) errors.push('第六張必須標為借卡');
    if (borrowed) {
      const borrowedProfile = input.profiles?.get(number(borrowed.id));
      const borrowedFixture = input.fixtures?.get(number(borrowed.id));
      const borrowedMaxLevel = maxLevelFor(borrowed, borrowedProfile, borrowedFixture, 4);
      if (number(borrowed.limitBreak, -1) !== 4
        || borrowed.borrowedAtMax !== true
        || number(borrowed.level, 0) !== borrowedMaxLevel) {
        errors.push('借卡必須使用滿突滿等');
      }
    }
    errors.push(...scenarioPackageErrors(owned, borrowed, input));
    return { valid: errors.length === 0, errors };
  }

  function packageId(mode, owned, borrowed) {
    const ownedIds = owned.map(card => number(card.id)).sort((left, right) => left - right).join('-');
    return `deck-v1-${mode}-owned-${ownedIds}-borrow-${borrowed?.id || 'none'}`;
  }

  function canonicalDeckKey(packageValue) {
    const ownedIds = (packageValue?.ownedCards || (packageValue?.deckCards || [])
      .filter(card => !card.borrowed))
      .map(card => number(card.id))
      .sort((left, right) => left - right);
    const borrowed = packageValue?.borrowedCard
      || (packageValue?.deckCards || []).find(card => card.borrowed);
    const borrowedId = number(borrowed?.id, 0);
    const borrowedSlot = number(
      packageValue?.borrowedSlot ?? packageValue?.borrowedIndex ?? borrowed?.slot,
      5
    );
    return `owned:${ownedIds.join(',')}|borrow:${borrowedId}@${borrowedSlot}`;
  }

  function beamStateKey(cards) {
    return (cards || [])
      .map(card => number(card?.id))
      .sort((left, right) => left - right)
      .join(',');
  }

  function makePackage(owned, borrowed, input, mode, ordinal = 0) {
    const validation = packageValid(owned, borrowed, input);
    if (!validation.valid) return null;
    const metrics = packageMetrics(owned, borrowed, input, mode);
    const scoredCards = metrics.cards || [...owned, borrowed];
    const scoredOwned = scoredCards.slice(0, 5);
    const scoredBorrowed = scoredCards[5] || borrowed;
    const packageValue = {
      id: packageId(mode, owned, borrowed),
      signature: `owned:${owned.map(card => number(card.id)).sort((left, right) => left - right).join(',')}|borrowed:${number(borrowed?.id, 0)}|mode:${mode}`,
      modelVersion: MODEL_VERSION,
      acquisitionModelVersion: input.acquisitionIdentity?.modelVersion || ACQUISITION_MODEL_VERSION,
      eventRouteDataVersion: input.acquisitionIdentity?.eventRouteDataVersion || 'missing',
      eventRouteDataHash: input.acquisitionIdentity?.eventRouteDataHash || 'missing',
      supportProfileVersion: input.acquisitionIdentity?.supportProfileVersion || 'missing',
      mode,
      modeLabel: MODES.find(item => item.id === mode)?.label || mode,
      valid: true,
      errors: [],
      ownedCards: scoredOwned.map(card => ({ ...card, borrowed: false })),
      borrowedCard: { ...scoredBorrowed, borrowed: true, borrowedAtMax: true, level: scoredBorrowed.resolvedProfile?.maxLevel || scoredBorrowed.level, limitBreak: 4 },
      deckCards: [...scoredOwned.map(card => ({ ...card, borrowed: false })), { ...scoredBorrowed, borrowed: true }],
      totalScore: metrics.totalScore,
      breakdown: metrics.breakdown,
      scoreInputs: metrics.scoreInputs,
      panelSummary: metrics.panelSummary,
      matureFriendshipTrainingBenchmarkContext: metrics.matureFriendshipTrainingBenchmarkContext,
      courseStyleGold: metrics.courseStyleGold,
      acquisitionBreakdown: metrics.acquisitionBreakdown,
      acquisitionModel: metrics.acquisitionModel,
      unresolvedUniqueCards: metrics.unresolvedUniqueCards,
      benchmarkBreakdown: {
        training: metrics.panelSummary?.trainingBenchmark || null,
        skillPt: metrics.cards.map(card => ({
          id: Number(card.id),
          ...card.panel?.skillPtComponents
        }))
      },
      skillPtEconomy: metrics.skillPtScore,
      declaredSkillRaw: metrics.declaredSkillRaw,
      contextualGoldRaw: metrics.contextualGoldRaw,
      contextualGoldBonusScore: metrics.contextualGoldBonusScore,
      skillPtSources: metrics.cards.map(card => ({
        id: Number(card.id),
        skillPtBonus: number(card.panel?.skillPtComponents?.skillPtBonus, 0),
        initialSkillPt: number(card.panel?.skillPtComponents?.initialSkillPt, 0),
        baseTrainingSkillPt: number(card.panel?.skillPtComponents?.baseTrainingSkillPt, 0),
        sharedBaselineSkillPt: number(card.panel?.skillPtComponents?.sharedBaselineSkillPt, 0),
        attributableTrainingSkillPt: number(card.panel?.skillPtComponents?.attributableTrainingSkillPt, 0),
        attributableScore: number(card.panel?.skillPtComponents?.attributableScore, 0),
        trainingFrequency: number(card.panel?.skillPtComponents?.trainingFrequency, 1)
      })),
      modelMode: metrics.modelMode,
      effectiveGoldSkills: metrics.effectiveGoldSkills,
      effectiveSkillFamilies: [...metrics.effectiveFamilies].map(Number).filter(Number.isFinite),
      distinctSkillFamilyCount: metrics.effectiveFamilies.size,
      overlapItems: metrics.overlapItems,
      recoveryGate: metrics.recoveryGate,
      coverageByFamily: metrics.coverage.rows,
      residualFactorCost: metrics.residualFactorCost,
      typeTemplateMode: input.typeTemplateMode,
      typeTemplate: input.targetTypes,
      typeTemplateSpec: input.templateSpec,
      typeCounts: typeCounts([...owned, borrowed]),
      borrowedSlot: 5,
      reason: metrics.reasons.join('；') || '在硬條件內維持可手動調整的平衡方案',
      scoreFormula: metrics.scoreFormula,
      ordinal
    };
    return packageValue;
  }

  function rescorePackageForMode(packageValue, input, mode) {
    const scoreInputs = packageValue?.scoreInputs;
    if (!scoreInputs) return { ...packageValue, mode };
    const recoveryRedundancyPenalty = number(scoreInputs.recoveryRedundancyPenalty, 0);
    const weights = modeWeights(mode);
    const fiveAxisNormalized = scoreInputs.fiveAxisNormalized || {
      trainingOutput: scoreInputs.panelNormalized,
      skillPtEconomy: scoreInputs.ptNormalized,
      necessarySkills: scoreInputs.skillNormalized,
      hintEfficiency: scoreInputs.hintNormalized || 0,
      deckScenarioFit: scoreInputs.deckFitNormalized || scoreInputs.overlapAdjusted
    };
    const fiveAxisWeights = scoreInputs.fiveAxisWeights || fiveAxisWeightsForInput(input);
    const fiveAxisContributions = Object.fromEntries(Object.entries(fiveAxisWeights)
      .map(([axis, weight]) => [axis,
        Math.round(number(fiveAxisNormalized[axis], 0) * weight * 10000) / 100]));
    const contextualGoldBonus = number(scoreInputs.contextualGoldBonusScore, 0);
    const scoreBeforePenalty = Object.values(fiveAxisContributions)
      .reduce((sum, contribution) => sum + contribution, 0) + contextualGoldBonus;
    const totalScore = Math.round(
      (scoreBeforePenalty - scoreInputs.survivalPenalty * 100 - recoveryRedundancyPenalty * 100) * 100
    ) / 100;
    return {
      ...packageValue,
      id: packageId(mode, packageValue.ownedCards, packageValue.borrowedCard),
      mode,
      modeLabel: MODES.find(item => item.id === mode)?.label || mode,
      totalScore,
      breakdown: {
        ...packageValue.breakdown,
        panel: Math.round(scoreInputs.panelNormalized * 100) / 100,
        skillPtEconomy: Math.round(scoreInputs.ptNormalized * 100) / 100,
        skillGoldRecovery: Math.round(scoreInputs.skillNormalized * 100) / 100,
        contextualGoldBonus: Math.round(contextualGoldBonus * 100) / 100,
        recoveryGate: Math.round(scoreInputs.recoveryNormalized * 100) / 100,
        breadth: Math.round(scoreInputs.breadthNormalized * 100) / 100,
        overlap: Math.round(scoreInputs.overlapAdjusted * 100) / 100,
        survivalPenalty: Math.round(scoreInputs.survivalPenalty * 100) / 100,
        recoveryRedundancyPenalty: Math.round(recoveryRedundancyPenalty * 100) / 100,
        weights,
        fiveAxisWeights,
        fiveAxis: Object.fromEntries(Object.entries(fiveAxisNormalized)
          .map(([axis, value]) => [axis, Math.round(number(value, 0) * 10000) / 100])),
        fiveAxisContributions,
        normalization: { panel: 'saturating', panelHalfScale: scoreInputs.panelHalfScale || 6000 }
      },
      signature: `owned:${(packageValue.ownedCards || []).map(card => number(card.id)).sort((left, right) => left - right).join(',')}|borrowed:${number(packageValue.borrowedCard?.id, 0)}|mode:${mode}`
    };
  }

  function beamOwnedCandidates(input, preAnalyzed = null) {
    const analyzed = preAnalyzed || input.owned.map(card => cardAnalysis(card, input));
    const frontier = paretoFrontier(analyzed, 8);
    const byId = new Map(frontier.map(card => [number(card.id), card]));
    // Keep a few broad candidates even when their single-card panel score is
    // lower; otherwise a full pool of R/SR cards can erase skill complements.
    analyzed.slice().sort((left, right) => right.breadth - left.breadth || number(left.id) - number(right.id))
      .slice(0, 12)
      .forEach(card => byId.set(number(card.id), card));
    const byType = new Map();
    for (const card of analyzed) {
      const type = normalizeSupportType(card.supportType);
      if (!byType.has(type)) byType.set(type, []);
      byType.get(type).push(card);
    }
    for (const group of byType.values()) {
      [
        item => item.panel.score,
        item => item.skillPtScore,
        item => item.skillScore,
        item => item.recoveryRoutes.filter(route => number(route.expectedCoverage, 0) > 0).length,
        item => item.breadth
      ].forEach(metric => group.slice()
        .sort((left, right) => metric(right) - metric(left) || number(left.id) - number(right.id))
        .slice(0, 3)
        .forEach(card => byId.set(number(card.id), card)));
    }
    analyzed
      .filter(card => scenarioCardIsRequired(card, input))
      .forEach(card => byId.set(number(card.id), card));
    return [...byId.values()].sort((left, right) => number(left.id) - number(right.id));
  }

  function templateStateFeasible(cards, input) {
    if (input.typeTemplateMode === 'free') return true;
    const actual = typeCounts(cards);
    return templateVariants(input).some(variant => {
      if (cards.length > variant.length) return false;
      const wanted = typeCounts(variant);
      return Object.entries(actual).every(([type, count]) => count <= (wanted[type] || 0));
    });
  }

  function templateStateSignature(cards, input, slot) {
    if (input.typeTemplateMode === 'free') return 'free';
    const counts = typeCounts(cards);
    const missing = missingTemplateTypes(cards, input) || [];
    return Object.entries(counts).sort(([left], [right]) => left.localeCompare(right))
      .map(([type, count]) => type + ':' + count).join('|')
      + ';remaining:' + (missing.join(',') || 'none') + ';slot:' + slot;
  }

  // Competition pruning must use the same five-axis proxy for every legacy
  // presentation mode.  The four mode labels are retained for the UI, but
  // they must not cause the bounded search to explore four different decks
  // and only call the result "five-axis" after the fact.
  function competitionSearchScore(cards, input) {
    if (!cards.length) return 0;
    const targetWeightTotal = (input.deckTargets || input.targets || [])
      .reduce((sum, target) => sum + number(target.weight, 0), 0);
    const panelRaw = targetAdjustedTrainingScore(cards, input);
    const skillPtRaw = cards.reduce((sum, card) => sum + number(card.axisRaw?.skillPtEconomy, card.skillPtScore), 0);
    const necessaryRaw = cards.reduce((sum, card) => sum + number(card.axisRaw?.necessarySkills, card.skillScore), 0);
    const contextualGoldRaw = cards.reduce((sum, card) => sum + number(card.axisRaw?.contextualGold, 0), 0);
    const hintRaw = cards.reduce((sum, card) => sum + number(card.axisRaw?.hintEfficiency, card.hintEfficiencyScore), 0);
    const fitRaw = cards.reduce((sum, card) => sum + number(card.axisRaw?.deckScenarioFit, 0), 0) / cards.length;
    const skillPtNormalization = skillPointNormalized(skillPtRaw, input);
    const normalized = {
      trainingOutput: clamp(panelRaw / (panelRaw + Math.max(1, number(input.panelHalfScale, 6000))), 0, 1),
      skillPtEconomy: skillPtNormalization.value,
      necessarySkills: targetWeightTotal
        ? clamp(necessaryRaw / targetWeightTotal, 0, 1)
        : 0.5,
      hintEfficiency: targetWeightTotal
        ? clamp(hintRaw / targetWeightTotal, 0, 1)
        : 0.5,
      deckScenarioFit: clamp(fitRaw, 0, 1)
    };
    const fiveAxisWeights = fiveAxisWeightsForInput(input);
    const axisScore = Object.entries(fiveAxisWeights)
      .reduce((sum, [axis, weight]) => sum + normalized[axis] * weight, 0) * 100;
    const contextualGoldScore = contextualGoldBonusScore(contextualGoldRaw, input);
    const requiredRecovery = Math.max(0, number(input.recoveryPlan?.requiredGold, 0));
    const recoveryScore = requiredRecovery
      ? marginalRecoveryFamilyCount(cards, input) / requiredRecovery
      : 0;
    return axisScore + contextualGoldScore + recoveryScore;
  }

  function beamStates(candidates, input, mode) {
    const exactTemplate = input.typeTemplateMode !== 'free';
    const preferredOwnedIds = scenarioUsableCardIds(input).filter(id =>
      scenarioInventoryOwnsId(input, id)
      && candidates.some(card => number(card?.id) === number(id))
    );
    const lockedIds = preferredOwnedIds.length ? [preferredOwnedIds[0]] : [];
    const lockedCards = lockedIds.map(id => candidates.find(card => number(card?.id) === id));
    if (lockedCards.some(card => !card)) return [];
    if (lockedCards.some((card, index) => lockedCards
      .slice(index + 1)
      .some(other => number(other.characterId) === number(card.characterId)))) {
      return [];
    }
    if (exactTemplate && !templateStateFeasible(lockedCards, input)) return [];
    let beam = [{
      cards: lockedCards,
      key: beamStateKey(lockedCards),
      score: input.competitionMode
        ? competitionSearchScore(lockedCards, input)
        : 0
    }];
    for (let slot = lockedCards.length; slot < 5; slot += 1) {
      const expanded = [];
      for (const state of beam) {
        for (const card of candidates) {
          if (state.cards.some(item => number(item.id) === number(card.id)
            || number(item.characterId) === number(card.characterId))) continue;
          const cards = [...state.cards, card];
          if (exactTemplate) {
            if (!templateStateFeasible(cards, input)) continue;
            // Five owned cards must leave exactly one legal template slot for
            // the arbitrary borrowed card. This makes type choice a hard
            // multiset constraint instead of a score penalty.
            if (slot === 4) {
              const missing = missingTemplateTypes(cards, input);
              if (!missing || missing.length !== 1) continue;
            }
          }
          const panel = cards.reduce((sum, item) => sum + item.panel.score, 0);
          const skill = cards.reduce((sum, item) => sum + item.skillScore, 0);
          const recovery = marginalRecoveryFamilyCount(cards, input) * 120;
          const breadth = new Set(cards.flatMap(item => item.routeRows.map(route => route.familyId))).size;
          const typePenalty = exactTemplate ? 0 : 110;
          const modeScore = input.competitionMode
            ? competitionSearchScore(cards, input)
            : mode === 'panel'
              ? panel * 1.1 + skill * 0.05 + breadth * 8 - typePenalty
              : mode === 'skill'
                ? skill * 1.1 + breadth * 120 + itemValue(cards, 'skillPtScore') * 0.4 - typePenalty
                : mode === 'recovery'
                  ? recovery * 10 + panel * 0.25 + breadth * 45 - typePenalty
                  : panel * 0.45 + skill * 0.25 + recovery * 7 + breadth * 70 + itemValue(cards, 'skillPtScore') * 0.25 - typePenalty;
          expanded.push({ cards, key: beamStateKey(cards), score: modeScore });
        }
      }
      expanded.sort((left, right) => right.score - left.score || left.key.localeCompare(right.key));
      const seen = new Set();
      const signatureGroups = new Map();
      for (const state of expanded) {
        if (seen.has(state.key)) continue;
        seen.add(state.key);
        const signature = exactTemplate
          ? templateStateSignature(state.cards, input, slot)
          : 'free';
        if (!signatureGroups.has(signature)) signatureGroups.set(signature, []);
        signatureGroups.get(signature).push(state);
      }
      const perSignatureQuota = exactTemplate ? 8 : 60;
      const retainedBySignature = [...signatureGroups.values()]
        .flatMap(group => group.slice(0, perSignatureQuota));
      beam = retainedBySignature
        .sort((left, right) => right.score - left.score || left.key.localeCompare(right.key))
        .slice(0, exactTemplate ? 96 : 60);
    }
    return beam;
  }

  function itemValue(cards, field) {
    return cards.reduce((sum, item) => sum + number(item[field], 0), 0);
  }

  function borrowCandidates(input, owned, mode) {
    const ownedIds = new Set(owned.map(card => String(card.id)));
    const ownedCharacters = new Set(owned.map(card => String(card.characterId)));
    const missingTypes = missingTemplateTypes(owned, input);
    const scenarioIds = scenarioRequiredCardIds(input);
    const usableScenarioIds = scenarioUsableCardIds(input);
    const preferredOwnedScenario = usableScenarioIds.filter(id =>
      scenarioInventoryOwnsId(input, id)
      && owned.some(card => number(card?.id) === number(id))
    );
    const forcedScenarioBorrow = scenarioIds.length > 0 && preferredOwnedScenario.length === 0;
    const requiredBorrowIds = forcedScenarioBorrow ? new Set(usableScenarioIds) : null;
    const requiredBorrowType = !forcedScenarioBorrow
      && input.typeTemplateMode !== 'free' && missingTypes?.length === 1
      ? missingTypes[0]
      : null;
    if (input.typeTemplateMode !== 'free' && !requiredBorrowType && !forcedScenarioBorrow) return [];
    const recoveryValue = card => marginalRecoveryFamilyCount([...owned, card], input);
    const ownedTypeSignature = Object.entries(typeCounts(owned))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([type, count]) => `${type}:${count}`)
      .join('|');
    const currentRecoveryDeficit = marginalRecoveryFamilyCount(owned, input);
    const analyzeBorrowed = card => {
      const cacheKey = `${card.id}|${ownedTypeSignature}|${currentRecoveryDeficit}`;
      let cached = input.borrowAnalysisCache?.get(cacheKey);
      if (!cached) {
        cached = cardAnalysis(card, input, owned);
        input.borrowAnalysisCache?.set(cacheKey, cached);
      }
      // packageCoverage reselects event-choice routes for the actual package;
      // avoid sharing those mutable route arrays between states.
      return {
        ...cached,
        routeRows: (cached.routeRows || []).map(route => ({
          ...route,
          familyIds: [...(route.familyIds || [])],
          matchedTargets: [...(route.matchedTargets || [])]
        })),
        recoveryRoutes: (cached.recoveryRoutes || []).map(route => ({ ...route })),
        __routeRows: (cached.__routeRows || []).map(route => ({
          ...route,
          familyIds: [...(route.familyIds || [])],
          matchedTargets: [...(route.matchedTargets || [])]
        }))
      };
    };
    const candidateValue = card => input.competitionMode
      ? competitionSearchScore([...owned, card], input)
      : mode === 'panel'
        ? card.panel.score + card.skillPtScore * 0.4
        : mode === 'skill'
          ? card.skillScore + card.breadth * 120 + card.skillPtScore * 0.4
          : mode === 'recovery'
            ? recoveryValue(card) * 700 + card.panel.score * 0.2
            : card.panel.score * 0.4 + card.skillScore * 0.3 + recoveryValue(card) * 500 + card.breadth * 80;
    const candidates = input.borrowed
      .filter(card => !ownedIds.has(String(card.id)) && !ownedCharacters.has(String(card.characterId)))
      .filter(card => forcedScenarioBorrow
        ? requiredBorrowIds.has(number(card.id))
        : !requiredBorrowType || normalizeSupportType(card.supportType) === requiredBorrowType)
      .map(analyzeBorrowed)
      .sort((left, right) => {
        return candidateValue(right) - candidateValue(left) || number(left.id) - number(right.id);
      });
    // A scenario entry card is a placement constraint, not a high-scoring
    // replacement candidate.  Keep the exact required IDs and do not let
    // type-based expansion add another Group/Friend/Stamina card.
    if (forcedScenarioBorrow) return candidates;
    const selected = new Map(candidates.slice(0, 60).map(card => [number(card.id), card]));
    const byType = new Map();
    for (const card of candidates) {
      const type = normalizeSupportType(card.supportType);
      if (!byType.has(type)) byType.set(type, []);
      byType.get(type).push(card);
    }
    for (const group of byType.values()) {
      [
        item => item.panel.score,
        item => item.skillPtScore,
        item => item.skillScore,
        item => recoveryValue(item),
        item => item.breadth
      ].forEach(metric => group.slice()
        .sort((left, right) => metric(right) - metric(left) || number(left.id) - number(right.id))
        .slice(0, 4)
        .forEach(card => selected.set(number(card.id), card)));
    }
    const byRecoveryFamily = new Map();
    for (const card of candidates) {
      for (const route of card.recoveryRoutes || []) {
        if (Number(route.quality) < 0.82 || number(route.expectedCoverage, 0) <= 0) continue;
        const familyId = String(route.familyId);
        if (!byRecoveryFamily.has(familyId)) byRecoveryFamily.set(familyId, []);
        byRecoveryFamily.get(familyId).push(card);
      }
    }
    for (const familyCandidates of byRecoveryFamily.values()) {
      familyCandidates
        .slice()
        .sort((left, right) => candidateValue(right) - candidateValue(left) || number(left.id) - number(right.id))
        .slice(0, 2)
        .forEach(card => selected.set(number(card.id), card));
    }
    return [...selected.values()]
      .sort((left, right) => candidateValue(right) - candidateValue(left) || number(left.id) - number(right.id));
  }

  function buildFrontier(input, analyzedOwned, analyzedBorrowed) {
    const all = [...analyzedOwned, ...analyzedBorrowed]
      .filter(card => cardIsServerAvailable(card, input))
      .sort((left, right) => number(left.id) - number(right.id));
    const selected = paretoFrontier(all, 8);
    return selected.slice(0, Math.max(10, selected.length)).map((card, index) => ({
      id: number(card.id),
      frontierKey: `${card.borrowed ? 'borrow' : 'owned'}:${number(card.id)}`,
      card: { ...card, resolvedProfile: undefined, __routeRows: undefined },
      slot: index % 5,
      ownership: card.borrowed ? 'borrow' : 'owned',
      actualLevel: card.level,
      limitBreak: card.limitBreak,
      modelMode: card.modelMode,
      frontierReason: card.frontierReason || (card.borrowed ? '滿突借卡作為可替換欄位' : '自有卡 Pareto frontier'),
      metrics: {
        panel: card.panel.score,
        skillPt: card.skillPtScore,
        skill: card.skillScore,
        recovery: card.recoveryRoutes
          .filter(route => number(route.expectedCoverage, 0) > 0)
          .length,
        breadth: card.breadth
      }
    }));
  }

  function percentile(value, values) {
    const finite = values.map(item => number(item, 0)).filter(Number.isFinite);
    if (!finite.length) return 0.5;
    const less = finite.filter(item => item < value).length;
    const equal = finite.filter(item => item === value).length;
    return clamp((less + equal * 0.5) / finite.length, 0, 1);
  }

  function evaluateCompetitiveCards(cards, peers, input, role) {
    const peerByType = new Map();
    const policy = { ...STRICT_PRIMARY_POLICY, ...(input.strictPrimaryPolicy || {}) };
    for (const card of peers) {
      const type = normalizeSupportType(card.supportType);
      if (!peerByType.has(type)) peerByType.set(type, []);
      peerByType.get(type).push(card);
    }
    const fiveAxisWeights = fiveAxisWeightsForInput(input);
    const resourceWeightTotal = fiveAxisWeights.trainingOutput + fiveAxisWeights.skillPtEconomy;
    const performanceTrainingWeight = resourceWeightTotal > 0
      ? fiveAxisWeights.trainingOutput / resourceWeightTotal
      : 0.5;
    const performanceSkillPtWeight = resourceWeightTotal > 0
      ? fiveAxisWeights.skillPtEconomy / resourceWeightTotal
      : 0.5;
    return cards.map(card => {
      const mandatoryScenarioCard = scenarioCardIsRequired(card, input);
      const peersOfType = peerByType.get(normalizeSupportType(card.supportType)) || [card];
      const axisBreakdown = {};
      let score = 0;
      for (const [axis, weight] of Object.entries(fiveAxisWeights)) {
        const raw = axis === 'trainingOutput'
          ? targetAdjustedTrainingScore([card], input)
          : number(card.axisRaw?.[axis], 0);
        const peerValues = peersOfType.map(peer => axis === 'trainingOutput'
          ? targetAdjustedTrainingScore([peer], input)
          : number(peer.axisRaw?.[axis], 0));
        const axisPercentile = percentile(raw, peerValues);
        const contribution = axisPercentile * weight * 100;
        axisBreakdown[axis] = {
          raw: Math.round(raw * 100) / 100,
          percentile: Math.round(axisPercentile * 1000) / 1000,
          weight,
          contribution: Math.round(contribution * 100) / 100
        };
        score += contribution;
      }
      const contextualGoldBonus = contextualGoldBonusScore(
        card.axisRaw?.contextualGold ?? card.courseStyleGoldScore,
        input
      );
      score += contextualGoldBonus;
      const uniqueUncertainty = card.uniqueResolution?.unresolvedEffects || [];
      const dataCompleteness = card.modelMode === 'partial-stats'
        ? 0.7
        : uniqueUncertainty.length ? 0.85 : 1;
      const levelRatio = number(card.maxLevel, 0) > 0
        ? clamp(number(card.level, 0) / number(card.maxLevel, 1), 0, 1)
        : 0;
      const reasons = [];
      const reasonCodes = [];
      const sourceGate = competitiveSourceEligibility(card, input);
      const explicitInventory = role !== 'owned' || cardIsOwned(
        card,
        input.inventory || input.ownedInventory,
        input.rules || input.plannerRules,
        { ...input, explicitOnly: true }
      );
      const hasExactCurve = card.modelMode !== 'partial-stats'
        && Array.isArray(card.resolvedProfile?.effectRows)
        && card.resolvedProfile.effectRows.length > 0;
      const actualMaturity = role !== 'owned' || (
        number(card.level, 0) >= number(policy.minimumLevel, STRICT_PRIMARY_POLICY.minimumLevel)
        && number(card.limitBreak, 0) >= number(policy.minimumLimitBreak, STRICT_PRIMARY_POLICY.minimumLimitBreak)
      );
      const trainingPercentile = number(axisBreakdown.trainingOutput?.percentile, 0);
      const skillPtPercentile = number(axisBreakdown.skillPtEconomy?.percentile, 0);
      const performanceComposite = clamp(
        trainingPercentile * performanceTrainingWeight
        + skillPtPercentile * performanceSkillPtWeight,
        0,
        1
      );
      const passesPerformance = trainingPercentile >= number(
        policy.minimumTrainingPercentile,
        STRICT_PRIMARY_POLICY.minimumTrainingPercentile
      ) && performanceComposite >= number(
        policy.minimumCompositePercentile,
        STRICT_PRIMARY_POLICY.minimumCompositePercentile
      );
      const recommendationScore = Math.round(performanceComposite * 10000) / 100;
      if (!sourceGate.eligible) {
        reasons.push(`不符合 SSR／gacha／目前伺服器來源 gate：${sourceGate.reasons.join('；')}`);
        reasonCodes.push('source-gate');
      }
      if (!explicitInventory) {
        reasons.push('不在 explicit inventory，不能作自有主力卡');
        reasonCodes.push('not-explicit-inventory');
      }
      if (!hasExactCurve) {
        reasons.push('沒有完整 exact effect curve，僅能作資料不足備註，不能作一般 primary');
        reasonCodes.push('missing-exact-curve');
      }
      if (uniqueUncertainty.length) {
        reasons.push(`unique runtime contract 尚未解碼（type ${uniqueUncertainty.map(item => item.type).join('／')}）；此卡的訓練比較是 sensitivity，不是精確勝負結論`);
        reasonCodes.push('unresolved-unique-runtime-contract');
      }
      if (!actualMaturity) {
        reasons.push(`自有實際 Lv${card.level || '?'}／${card.limitBreak || 0}突低於參考成熟度 Lv${policy.minimumLevel}／${policy.minimumLimitBreak}突；僅記錄，不淘汰，改由實際效果曲線與目標面板效用決定`);
        reasonCodes.push('below-reference-maturity-not-a-gate');
      }
      if (!passesPerformance) {
        reasons.push(`同型訓練／Skill Pt benchmark 低於參考線（訓練 ${Math.round(trainingPercentile * 100)}%，綜合 ${Math.round(performanceComposite * 100)}%）；只影響排序，不作候選淘汰`);
        reasonCodes.push('below-performance-reference-not-a-gate');
      }
      // A scenario exact ID remains a hard-slot exception. For every other
      // card, Lv/LB only resolves the actual effect curve; it is not a second
      // eligibility gate after the measured performance comparison.
      const scenarioException = mandatoryScenarioCard && sourceGate.eligible
        && (role !== 'owned' || explicitInventory);
      if (scenarioException) {
        reasons.push('劇本 exact 必帶卡：作為 hard-slot 例外，保留實際 Lv／突與完整度稽核，但不以一般成熟／performance gate 淘汰');
        reasonCodes.push('scenario-required-exception');
      }
      const primaryCandidate = scenarioException || (
        sourceGate.eligible
        && explicitInventory
        && hasExactCurve
      );
      const recommended = scenarioException || (
        primaryCandidate
        && passesPerformance
      );
      return {
        ...card,
        competitiveEvaluation: {
          role,
          mandatoryScenarioCard,
          // `recommended` is only a single-card comparison reference.  The
          // full six-card search still receives every `primaryCandidate`, so
          // a low-LB card with a useful Skill Pt economy is never discarded
          // before deck-level overlap and target-cap utility are evaluated.
          recommended,
          primaryCandidate,
          rawScore: Math.round(score * 100) / 100,
          contextualGoldBonusScore: Math.round(contextualGoldBonus * 100) / 100,
          recommendationScore,
          levelRatio: Math.round(levelRatio * 1000) / 1000,
          dataCompleteness,
          modelMode: card.modelMode,
          axisBreakdown,
          strictPrimary: {
            policy,
            sourceEligible: sourceGate.eligible,
            explicitInventory,
            exactCurve: hasExactCurve,
            uniqueResolution: uniqueUncertainty.length ? 'unresolved-runtime-contract' : 'resolved-or-inactive',
            unresolvedUniqueEffects: uniqueUncertainty,
            actualMaturity,
            performance: {
              trainingPercentile: Math.round(trainingPercentile * 1000) / 1000,
              skillPtPercentile: Math.round(skillPtPercentile * 1000) / 1000,
              composite: Math.round(performanceComposite * 1000) / 1000,
              weights: {
                trainingOutput: Math.round(performanceTrainingWeight * 1000) / 1000,
                skillPtEconomy: Math.round(performanceSkillPtWeight * 1000) / 1000
              },
              passes: passesPerformance
            },
            scenarioException,
            status: primaryCandidate ? 'search-eligible' : 'fallback-required',
            reasonCodes: [...reasonCodes]
          },
          warnings: reasons,
          warningCodes: reasonCodes,
          benchmark: `同型別、繁中服 eligible peers 的目標面板邊際訓練 ${Math.round(performanceTrainingWeight * 1000) / 10}% + Skill Pt ${Math.round(performanceSkillPtWeight * 1000) / 10}% percentile 排序；Lv／突與 performance reference 都不是淘汰門檻；不是第三方 Tier`
        }
      };
    });
  }

  function prepareCompetitionPools(input) {
    if (!input.competitionMode) {
      const analyzedOwned = input.owned.map(card => cardAnalysis(card, input));
      input.owned = analyzedOwned;
      return {
        owned: analyzedOwned,
        borrowed: input.borrowed.map(card => cardAnalysis(card, input)),
        eligibleOwned: analyzedOwned,
        eligibleBorrowed: input.borrowed,
        primaryOwned: analyzedOwned,
        primaryBorrowed: input.borrowed,
        fallbackOwned: [],
        fallbackBorrowed: []
      };
    }
    const eligibleOwned = input.owned.map(card => cardAnalysis(card, input));
    const eligibleBorrowed = input.borrowed.map(card => cardAnalysis(card, input));
    // Compare against the same-server competitive supply, including actual
    // owned instances and MLB borrow instances.  A low-LB owned card should
    // not look first-tier only because the local inventory has weak peers.
    const peers = [...eligibleOwned, ...eligibleBorrowed];
    const owned = evaluateCompetitiveCards(eligibleOwned, peers, input, 'owned');
    const borrowed = evaluateCompetitiveCards(eligibleBorrowed, peers, input, 'borrowed');
    const ownedSearchPool = owned.filter(card => card.competitiveEvaluation.primaryCandidate);
    const borrowedSearchPool = borrowed.filter(card => card.competitiveEvaluation.primaryCandidate);
    const ownedFallback = owned.filter(card => !card.competitiveEvaluation.primaryCandidate);
    const borrowedFallback = borrowed.filter(card => !card.competitiveEvaluation.primaryCandidate);
    const byId = new Map();
    input.competitionAudits.forEach(audit => byId.set(Number(audit.id), audit));
    owned.forEach(card => {
      const audit = byId.get(Number(card.id));
      if (!audit) return;
      audit.owned = {
        eligible: true,
        recommended: card.competitiveEvaluation.recommended,
        score: card.competitiveEvaluation.recommendationScore,
        rawScore: card.competitiveEvaluation.rawScore,
        level: card.level,
        limitBreak: card.limitBreak,
        maxLevel: card.maxLevel,
        levelRatio: card.competitiveEvaluation.levelRatio,
        modelMode: card.modelMode,
        axisBreakdown: card.competitiveEvaluation.axisBreakdown,
        strictPrimary: card.competitiveEvaluation.strictPrimary,
        warnings: card.competitiveEvaluation.warnings,
        warningCodes: card.competitiveEvaluation.warningCodes
      };
      audit.modelMode = card.modelMode;
      audit.ownedRecommended = card.competitiveEvaluation.recommended;
      audit.competitiveRecommended = audit.competitiveRecommended
        || card.competitiveEvaluation.recommended;
      audit.recommendationReasons = card.competitiveEvaluation.warnings;
    });
    borrowed.forEach(card => {
      const audit = byId.get(Number(card.id));
      if (!audit) return;
      audit.borrowed = {
        eligible: true,
        recommended: card.competitiveEvaluation.recommended,
        score: card.competitiveEvaluation.recommendationScore,
        rawScore: card.competitiveEvaluation.rawScore,
        level: card.level,
        limitBreak: card.limitBreak,
        maxLevel: card.maxLevel,
        levelRatio: card.competitiveEvaluation.levelRatio,
        modelMode: card.modelMode,
        axisBreakdown: card.competitiveEvaluation.axisBreakdown,
        strictPrimary: card.competitiveEvaluation.strictPrimary,
        warnings: card.competitiveEvaluation.warnings,
        warningCodes: card.competitiveEvaluation.warningCodes
      };
      audit.modelMode = audit.modelMode || card.modelMode;
      audit.borrowedRecommended = card.competitiveEvaluation.recommended;
      audit.competitiveRecommended = audit.competitiveRecommended
        || card.competitiveEvaluation.recommended;
      audit.recommendationReasons = audit.recommendationReasons?.length
        ? audit.recommendationReasons
        : card.competitiveEvaluation.warnings;
    });
    input.eligibleOwned = owned;
    input.eligibleBorrowed = borrowed;
    input.owned = ownedSearchPool;
    input.borrowed = borrowedSearchPool;
    input.borrowAnalysisCache = new Map();
    return {
      owned,
      borrowed,
      eligibleOwned: owned,
      eligibleBorrowed: borrowed,
      primaryOwned: ownedSearchPool,
      primaryBorrowed: borrowedSearchPool,
      fallbackOwned: ownedFallback,
      fallbackBorrowed: borrowedFallback
    };
  }

  function optimizeDeckPackages(options = {}) {
    const input = normalizeInputs(options);
    const competitionPools = prepareCompetitionPools(input);
    // prepareCompetitionPools replaces input.owned with the exact-curve
    // search pool.  Single-card reference performance is deliberately not an
    // eligibility gate: deck-level target caps, Skill Pt and overlap decide.
    const candidates = beamOwnedCandidates(input, input.owned);
    const analyzedBorrowed = competitionPools.borrowed;
    const candidateDecks = new Map();
    for (const mode of MODES) {
      const states = [
        ...beamStates(candidates, input, mode.id)
      ];
      const statesByBorrowType = new Map();
      for (const state of states) {
        const missingTypes = missingTemplateTypes(state.cards, input);
        const borrowType = input.typeTemplateMode === 'free'
          ? 'free'
          : missingTypes?.[0] || 'invalid';
        if (borrowType === 'invalid') continue;
        if (!statesByBorrowType.has(borrowType)) statesByBorrowType.set(borrowType, []);
        statesByBorrowType.get(borrowType).push(state);
      }
      const packages = [];
      const stateQuota = input.typeTemplateMode === 'free' ? 60 : 8;
      const borrowQuota = input.typeTemplateMode === 'free' ? 60 : 10;
      for (const groupedStates of statesByBorrowType.values()) {
        const rankedStates = groupedStates
          .slice()
          .sort((left, right) => right.score - left.score || left.key.localeCompare(right.key))
          .slice(0, stateQuota);
        for (const state of rankedStates) {
          const candidateBorrows = borrowCandidates(input, state.cards, mode.id);
          const selectedBorrows = [...candidateBorrows.slice(0, borrowQuota)];
          for (const borrowed of selectedBorrows) {
            const packageValue = makePackage(
              state.cards.map(card => ({
                ...card,
                routeRows: (card.routeRows || []).map(route => ({ ...route })),
                recoveryRoutes: (card.recoveryRoutes || []).map(route => ({ ...route })),
                __routeRows: (card.__routeRows || []).map(route => ({ ...route }))
              })),
              {
                ...borrowed,
                routeRows: (borrowed.routeRows || []).map(route => ({ ...route })),
                recoveryRoutes: (borrowed.recoveryRoutes || []).map(route => ({ ...route })),
                __routeRows: (borrowed.__routeRows || []).map(route => ({ ...route }))
              },
              input,
              mode.id,
              packages.length
            );
            if (!packageValue) continue;
            packages.push(packageValue);
          }
        }
      }
      packages.sort((left, right) => right.totalScore - left.totalScore || left.id.localeCompare(right.id));
      packages.slice(0, 96).forEach(packageValue => {
        const deckKey = canonicalDeckKey(packageValue);
        const previous = candidateDecks.get(deckKey);
        if (!previous || packageValue.totalScore > previous.totalScore) {
          candidateDecks.set(deckKey, packageValue);
        }
      });
    }
    const packageRows = [];
    for (const mode of MODES) {
      const ranked = [...candidateDecks.values()]
        .map(packageValue => rescorePackageForMode(packageValue, input, mode.id))
        .sort((left, right) => right.totalScore - left.totalScore
          || (input.competitionMode
            ? canonicalDeckKey(left).localeCompare(canonicalDeckKey(right))
            : left.id.localeCompare(right.id)));
      const chosen = ranked[0];
      if (chosen) {
        packageRows.push(chosen);
      }
    }
    const allAnalyzed = [...candidates, ...analyzedBorrowed];
    const frontier = buildFrontier(input, candidates, analyzedBorrowed);
    const packages = packageRows
      .sort((left, right) => ['balanced', 'panel', 'skill', 'recovery'].indexOf(left.mode)
        - ['balanced', 'panel', 'skill', 'recovery'].indexOf(right.mode))
      .map((item, index) => ({ ...item, ordinal: index }));
    const competitionAudits = input.competitionAudits.map(audit => ({
      ...audit,
      card: { ...audit.card }
    }));
    const shortage = [];
    const scenarioShortage = [];
    const scenarioIds = scenarioRequiredCardIds(input);
    if (input.competitionMode && scenarioIds.length) {
      const eligibleOwnedIds = new Set(competitionPools.eligibleOwned.map(card => number(card.id)));
      const eligibleBorrowedIds = new Set(competitionPools.eligibleBorrowed.map(card => number(card.id)));
      const usableIds = scenarioUsableCardIds(input);
      const usableOwnedIds = usableIds.filter(id => eligibleOwnedIds.has(id));
      const usableBorrowedIds = usableIds.filter(id => eligibleBorrowedIds.has(id));
      if (!usableIds.length) {
        const details = scenarioIds.map(id => {
          const card = input.scenarioCatalog.find(item => number(item?.id) === id);
          const label = card?.nameZhTw || card?.titleZhTw || `卡片 ${id}`;
          if (!card) return `${id} 缺少卡片資料`;
          const gate = competitiveSourceEligibility(card, input);
          return `${label}（${id}：${gate.reasons.join('；') || '目前不可用'}）`;
        });
        scenarioShortage.push(`劇本必帶卡替代集合（${scenarioIds.join('／')}）沒有任何可用 exact ID：${details.join('；')}`);
      } else if (usableOwnedIds.some(id => scenarioInventoryOwnsId(input, id))) {
        // One explicitly owned usable exact ID satisfies required-one.  Do
        // not report every unowned alternative as a shortage.
      } else if (!usableBorrowedIds.length) {
        scenarioShortage.push(`未持有劇本必帶卡替代集合（${scenarioIds.join('／')}），目前沒有可用的唯一 exact 借卡`);
      }
    }
    shortage.push(...scenarioShortage);
    if (input.competitionMode && competitionPools.eligibleOwned.length < 5) {
      shortage.push(`競技自有 SSR／gacha 卡只有 ${competitionPools.eligibleOwned.length} 張，還缺 ${5 - competitionPools.eligibleOwned.length} 張`);
    }
    if (input.competitionMode && input.owned.length < 5) {
      shortage.push(`可進入完整卡組搜尋（競技來源、explicit inventory、exact curve）的自有卡只有 ${input.owned.length} 張；不以活動／商店卡或資料不完整卡補位`);
    }
    if (input.competitionMode && competitionPools.eligibleBorrowed.length < 1) {
      shortage.push('沒有符合競技 gate 的 SSR／gacha 借卡');
    }
    if (input.competitionMode && input.borrowed.length < 1) {
      shortage.push('沒有可進入完整卡組搜尋（競技來源、滿突 exact curve）的 SSR／gacha 借卡');
    }
    if (input.competitionMode && !packages.length) {
      shortage.push('目前沒有能同時符合六卡牌型、同角色／育成角色與速度卡規則的競技 5+1 組合；未以 SR／活動／商店卡回填');
      if (scenarioIds.length && !scenarioShortage.length) {
        const requiredLabel = scenarioIds.join('／');
        const message = `選定劇本的 exact 入場卡（${requiredLabel}）尚未形成可行自有／唯一借卡配置；請檢查卡位衝突或競技卡不足，不能用同型卡替代`;
        scenarioShortage.push(message);
        shortage.push(message);
      }
    }
    const competitionCardSummary = (card, ownership) => ({
      id: number(card.id),
      supportType: normalizeSupportType(card.supportType),
      rarity: card.rarity || null,
      obtained: card.obtained || null,
      ownership,
      level: number(card.level, null),
      limitBreak: number(card.limitBreak, null),
      maxLevel: number(card.maxLevel, null),
      modelMode: card.modelMode || null,
      primary: card.competitiveEvaluation?.strictPrimary || null,
      fallbackReasons: card.competitiveEvaluation?.primaryCandidate
        ? []
        : (card.competitiveEvaluation?.warnings || [])
    });
    const fallbackRequired = input.competitionMode && !packages.length;
    const fallbackAudit = {
      status: fallbackRequired ? 'fallback-required' : 'not-required',
      autoInserted: false,
      policy: { ...STRICT_PRIMARY_POLICY },
      primaryOwnedIds: (competitionPools.primaryOwned || input.owned).map(card => number(card.id)),
      primaryBorrowedIds: (competitionPools.primaryBorrowed || input.borrowed).map(card => number(card.id)),
      fallbackOwned: (competitionPools.fallbackOwned || []).map(card => competitionCardSummary(card, 'owned')),
      fallbackBorrowed: (competitionPools.fallbackBorrowed || []).map(card => competitionCardSummary(card, 'borrowed')),
      reasons: fallbackRequired ? shortage.slice() : []
    };
    // Keep this response-sized audit focused on cards that can affect a
    // primary result.  The exhaustive per-card contract is already retained
    // in competition.audits, so listing all upstream unresolved effects here
    // would obscure the actually selected sensitivity.
    const summarizeUniqueUncertainty = (cards, ownership) => (cards || [])
      .filter(card => card.uniqueResolution?.unresolvedEffects?.length)
      .map(card => ({
        id: number(card.id),
        ownership,
        unresolvedEffects: card.uniqueResolution.unresolvedEffects
      }));
    const primaryUniqueUncertainty = [
      ...summarizeUniqueUncertainty(competitionPools.primaryOwned || input.owned, 'owned'),
      ...summarizeUniqueUncertainty(competitionPools.primaryBorrowed || input.borrowed, 'borrowed')
    ];
    const selectedUniqueUncertainty = packages.flatMap(packageValue =>
      (packageValue.unresolvedUniqueCards || []).map(card => ({
        ...card,
        packageModes: packages
          .filter(candidate => (candidate.unresolvedUniqueCards || [])
            .some(item => number(item.id) === number(card.id)))
          .map(candidate => candidate.mode)
      }))
    ).filter((card, index, rows) => rows.findIndex(other => number(other.id) === number(card.id)) === index);
    const uniqueUncertainty = selectedUniqueUncertainty.length
      ? selectedUniqueUncertainty
      : primaryUniqueUncertainty;
    const matureBenchmarkContexts = packages.map(packageValue => ({
      mode: packageValue.mode,
      deckKey: canonicalDeckKey(packageValue),
      context: packageValue.matureFriendshipTrainingBenchmarkContext || null
    }));
    return {
      modelVersion: MODEL_VERSION,
      acquisitionModelVersion: input.acquisitionIdentity?.modelVersion || ACQUISITION_MODEL_VERSION,
      eventRouteDataVersion: input.acquisitionIdentity?.eventRouteDataVersion || 'missing',
      eventRouteDataHash: input.acquisitionIdentity?.eventRouteDataHash || 'missing',
      supportProfileVersion: input.acquisitionIdentity?.supportProfileVersion || 'missing',
      matureFriendshipTrainingBenchmark: {
        name: MATURE_FRIENDSHIP_TRAINING_BENCHMARK_NAME,
        purpose: MATURE_FRIENDSHIP_TRAINING_BENCHMARK_PURPOSE,
        contexts: matureBenchmarkContexts
      },
      matureFriendshipTrainingBenchmarkContext: matureBenchmarkContexts[0]?.context || null,
      modelMode: packages.some(item => item.modelMode === 'partial-stats')
        ? 'partial-stats'
        : packages.some(item => item.modelMode === 'curve-unique-uncertain')
          ? 'curve-unique-uncertain'
          : 'max-level-borrow',
      packages,
      frontier,
      availableOwnedCount: competitionPools.eligibleOwned.length,
      availableBorrowCount: competitionPools.eligibleBorrowed.length,
      targetTypes: input.targetTypes,
      typeTemplate: input.templateSpec,
      typeTemplateMode: input.typeTemplateMode,
      scenario: input.scenario,
      competition: {
        enabled: input.competitionMode,
        status: packages.length ? 'ready' : input.competitionMode
          ? 'insufficient/fallback-required'
          : 'insufficient',
        eligibleOwnedCount: competitionPools.eligibleOwned.length,
        eligibleBorrowCount: competitionPools.eligibleBorrowed.length,
        searchOwnedCount: input.owned.length,
        searchBorrowCount: input.borrowed.length,
        recommendedOwnedCount: competitionPools.owned
          .filter(card => card.competitiveEvaluation?.recommended).length,
        recommendedBorrowCount: competitionPools.borrowed
          .filter(card => card.competitiveEvaluation?.recommended).length,
        eligibleOwnedIds: competitionPools.eligibleOwned.map(card => number(card.id)),
        eligibleBorrowedIds: competitionPools.eligibleBorrowed.map(card => number(card.id)),
        searchOwnedIds: input.owned.map(card => number(card.id)),
        searchBorrowedIds: input.borrowed.map(card => number(card.id)),
        recommendedOwnedIds: competitionPools.owned
          .filter(card => card.competitiveEvaluation?.recommended)
          .map(card => number(card.id)),
        recommendedBorrowedIds: competitionPools.borrowed
          .filter(card => card.competitiveEvaluation?.recommended)
          .map(card => number(card.id)),
        eligibleOwnedCards: competitionPools.eligibleOwned
          .map(card => competitionCardSummary(card, 'owned')),
        eligibleBorrowedCards: competitionPools.eligibleBorrowed
          .map(card => competitionCardSummary(card, 'borrowed')),
        searchOwnedCards: input.owned
          .map(card => competitionCardSummary(card, 'owned')),
        searchBorrowedCards: input.borrowed
          .map(card => competitionCardSummary(card, 'borrowed')),
        recommendedOwnedCards: competitionPools.owned
          .filter(card => card.competitiveEvaluation?.recommended)
          .map(card => competitionCardSummary(card, 'owned')),
        recommendedBorrowedCards: competitionPools.borrowed
          .filter(card => card.competitiveEvaluation?.recommended)
          .map(card => competitionCardSummary(card, 'borrowed')),
        excludedCandidates: competitionAudits
          .filter(audit => !audit.ownedRecommended || !audit.sourceEligible),
        audits: competitionAudits,
        scenario: input.scenario,
        scenarioRequiredCardIds: scenarioIds,
        scenarioShortage,
        shortage,
        fallback: fallbackAudit,
        uncertainty: {
          rankingStatus: uniqueUncertainty.length ? 'unique-uncertain' : 'exact-curve-ready',
          unresolvedUniqueCards: uniqueUncertainty,
          primaryUnresolvedUniqueCards: primaryUniqueUncertainty,
          note: uniqueUncertainty.length
            ? '入選／primary raw unique runtime contracts 未解碼；相對排名僅為 expected/peak sensitivity，完整逐卡內容保留在 competition.audits。'
            : '效果曲線與 unique contract 均可由目前 resolver 稽核。'
        },
        note: '來源 gate 與自訂五軸 heuristic 分開顯示；不宣稱重現 Kamigame／GameWith Tier'
      },
      hardRules: {
        ownedCount: 5,
        borrowedCount: 1,
        noDuplicateCards: true,
        noDuplicateCharacters: true,
        targetCharacterExcluded: true,
        atLeastOneSpeed: true,
        exactTypeTemplate: input.typeTemplateMode !== 'free',
        templateAlternatives: input.templateSpec,
        scenarioEntryCardPolicy: input.scenario.entryCardPolicy,
        scenarioRequiredSupportCardIds: scenarioIds,
        scenarioRequiredSupportTypes: input.scenario.requiredSupportTypes,
        scenarioRequiredCardPlacement: input.scenario.requiredCardPlacement,
        competitionSource: input.competitionMode ? 'SSR + obtained=gacha' : null,
        explicitOwnedInventory: input.competitionMode,
        server: options.server || 'zh_tw'
      },
      inputSummary: {
        targetCount: input.targets.length,
        requiredGoldRecovery: input.recoveryPlan.requiredGold,
        context: input.context
      },
      allAnalyzedCount: allAnalyzed.length,
      scenarioShortage,
      shortage
    };
  }

  // Small deterministic oracle used by unit tests to check the bounded beam.
  // It is intentionally not used by the interactive optimizer.
  function exhaustiveBestPackage(options = {}, mode = 'balanced') {
    const input = normalizeInputs(options);
    if (input.owned.length > 14) return null;
    const owned = input.owned.map(card => cardAnalysis(card, input));
    const borrowed = input.borrowed.map(card => cardAnalysis(card, input));
    let best = null;
    const visit = (start, chosen) => {
      if (chosen.length === 5) {
        if (input.typeTemplateMode !== 'free') {
          const missing = missingTemplateTypes(chosen, input);
          if (!missing || missing.length !== 1) return;
        }
        for (const borrow of borrowed) {
          if (chosen.some(card => number(card.id) === number(borrow.id)
            || number(card.characterId) === number(borrow.characterId))) continue;
          if (input.typeTemplateMode !== 'free'
            && normalizeSupportType(borrow.supportType) !== missingTemplateTypes(chosen, input)?.[0]) continue;
          const packageValue = makePackage(
            chosen.map(card => ({ ...card })),
            { ...borrow },
            input,
            mode,
            0
          );
          if (!packageValue) continue;
          if (!best || packageValue.totalScore > best.totalScore
            || (packageValue.totalScore === best.totalScore
              && canonicalDeckKey(packageValue).localeCompare(canonicalDeckKey(best)) < 0)) {
            best = packageValue;
          }
        }
        return;
      }
      for (let index = start; index < owned.length; index += 1) {
        const card = owned[index];
        if (chosen.some(item => number(item.characterId) === number(card.characterId))) continue;
        const next = [...chosen, card];
        if (input.typeTemplateMode !== 'free') {
          const counts = typeCounts(next);
          const desired = typeCounts(input.targetTypes);
          if (Object.entries(counts).some(([type, count]) => count > (desired[type] || 0))) continue;
        }
        visit(index + 1, next);
      }
    };
    visit(0, []);
    return best;
  }

  function validatePackage(packageValue, options = {}) {
    const input = normalizeInputs(options);
    const owned = (packageValue?.ownedCards || []).map(card => ({
      ...card,
      borrowed: false
    }));
    const borrowed = packageValue?.borrowedCard ? { ...packageValue.borrowedCard, borrowed: true } : null;
    return packageValid(owned, borrowed, input);
  }

  return {
    MODEL_VERSION,
    MODES,
    normalizeSupportType,
    normalizeTemplateSpec,
    normalizeScenarioConstraint,
    applyScenarioTemplateSpec,
    scenarioRequiredCardIds,
    templateVariants,
    skillPointEconomy,
    cardIsServerAvailable,
    cardIsOwned,
    competitiveSourceEligibility,
    competitiveCardAudit,
    normalizeTypeTemplate,
    typeCounts,
    typeTemplateIsExact,
    skillTagsCompatible,
    normalizeTargets,
    normalizeDomainWeight,
    acquisitionDataIdentity,
    targetMatchesSkill,
    familyIdsForSkill,
    isFormalAcquisitionRoute,
    formalRouteProbability,
    combinedRouteProbability,
    hintEconomyForTarget,
    hintEconomyBreakdown,
    packageHintEfficiencyRaw,
    contextualGoldForCards,
    contextualGoldBonusScore,
    acquisitionCandidateBreakdown,
    acquisitionSourceGraphForTarget,
    recoveryFamiliesFrom,
    recoveryQualityForSkill,
    dynamicReliability,
    conditionReliability,
    resolveProfile,
    panelMetricSnapshot,
    applyPanelCap,
    aggregatePanelCaps,
    resolveStatUtilityPolicy,
    statSaturationShare,
    fiveAxisWeightsForInput,
    targetAdjustedTrainingScore,
    beamStateKey,
    canonicalDeckKey,
    coverageForCards,
    optimizeDeckPackages,
    exhaustiveBestPackage,
    buildDeckOptimization: optimizeDeckPackages,
    MATURE_FRIENDSHIP_TRAINING_BENCHMARK_NAME,
    buildMatureFriendshipTrainingBenchmarkContext,
    SUPPORT_UNIQUE_CORE: supportUniqueCore,
    validatePackage,
    packageValid,
    scenarioPackageErrors,
    FIVE_AXIS_WEIGHTS,
    STAT_UTILITY_POLICY,
    CURATED_SUPPORT_PROFILE_FIXTURES: levelFixtures
  };
});
