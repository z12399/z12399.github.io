(function (root, factory) {
  function optionalRequire(path) {
    try {
      return typeof module !== 'undefined' && module.exports ? require(path) : null;
    } catch (error) {
      // The shared acquisition core is delivered independently. Keep this
      // semantic snapshot loadable while the integration adapter is pending.
      return null;
    }
  }
  const skillAcquisitionCore = optionalRequire('./skill-acquisition-core.js')
    || root?.SKILL_ACQUISITION_CORE
    || null;
  const api = factory(skillAcquisitionCore);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PLANNING_SNAPSHOT_CORE = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (skillAcquisitionCore) {
  const MODEL_VERSION = 'semantic-coverage-v5-acquisition-adapter';
  const ACQUISITION_MODEL_VERSION = skillAcquisitionCore?.MODEL_VERSION
    || 'skill-acquisition-unavailable';
  const DEFAULT_ROUTE_RELIABILITY = {
    certain: 1,
    // Catalog source lists are possible routes, not guarantees. These are
    // conservative fallbacks until a caller supplies audited probabilities.
    characterEvent: 0.55,
    supportEvent: 0.45,
    supportHint: 0.3,
    directParent: 1,
    existingFactor: 0.35
  };

  function uniqueNumbers(values) {
    return [...new Set((values || []).map(Number).filter(Number.isFinite))];
  }

  function numericId(value) {
    const id = Number(value);
    return Number.isFinite(id) ? id : null;
  }

  function clampProbability(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
  }

  // Keep Step 5 on the same formal boundary as the deck optimizer. Raw event
  // rows stay available for audit, but only an explicitly identified gold
  // skill from a non-random/non-unknown event contributes formal coverage.
  // Training hints remain valid acquisition routes.
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
      const rarity = Number(route?.skill?.rarity ?? route?.skillRarity ?? route?.rarity);
      if (kind === 'eventwhite' || kind === 'event-white') return false;
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

  // The optimizer applies the same condition contract when resolving a
  // support event. Step 5 receives the explicit planning context here rather
  // than silently assuming that a conditional gold will activate.
  function conditionReliabilityForSkill(skill, context = {}) {
    const conditions = (skill?.conditionGroups || [])
      .map(group => String(group?.condition || ''))
      .join('&');
    const openingActivation = conditions.match(/activate_count_start\s*>=\s*(\d+)/i);
    if (openingActivation) {
      const required = Number(openingActivation[1]);
      const plannedCount = Number(
        context.openingSkillCount
          ?? context.plannedOpeningSkillCount
          ?? context.openingSkillActivationCount
          ?? context.startSkillCount
      );
      if (!Number.isFinite(plannedCount) || plannedCount < required) return 0;
    }
    const hasRuntimeContext = [
      context.running_style ?? context.runningStyle,
      context.distance_type ?? context.distanceType,
      context.ground_type ?? context.groundType
    ].some(value => Number.isFinite(Number(value)));
    let reliability = hasRuntimeContext
      ? /order_rate|blocked|block|overtake|change_order|accumulatetime|random/i.test(conditions)
        ? 0.82
        : 0.92
      : 1;
    const runningStyle = Number(context.running_style ?? context.runningStyle);
    if (runningStyle === 1 && /order_rate\s*>=\s*40/i.test(conditions)) reliability *= 0.05;
    return Math.max(0, Math.min(1, reliability));
  }

  function acquisitionDataIdentity(options = {}) {
    const routeData = options.supportEventRoutes || null;
    const profileData = options.supportProfiles || null;
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
        // Keep the snapshot deterministic during a partial data/core update.
      }
    }
    const routeMetadata = routeData?.metadata || {};
    const profileMetadata = profileData?.metadata || {};
    return {
      modelVersion: coreIdentity?.modelVersion || ACQUISITION_MODEL_VERSION,
      eventRouteDataVersion: String(
        coreIdentity?.eventRouteDataVersion
        || coreIdentity?.routeDataVersion
        || routeData?.version
        || routeData?.schemaVersion
        || routeMetadata.parserVersion
        || 'missing'
      ),
      eventRouteDataHash: String(
        coreIdentity?.eventRouteDataHash
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
        ].join(':')
      ),
      supportProfileVersion: String(
        coreIdentity?.supportProfileVersion
        || profileData?.version
        || [
          profileData ? 'present' : 'missing',
          profileData?.schemaVersion || 0,
          profileMetadata.asOf || '',
          profileMetadata.assetHash || '',
          profileMetadata.supportEffectsHash || ''
        ].join(':')
      ),
      coreAvailable: Boolean(skillAcquisitionCore)
    };
  }

  function familyIdsForSkill(skillId, catalog) {
    const skill = (catalog?.skills || []).find(item => Number(item.id) === Number(skillId));
    return uniqueNumbers([
      ...(skill?.familyIds || []),
      skill?.familyId,
      skill?.id,
      skillId
    ]);
  }

  function familySet(row) {
    return new Set((row?.familyIds || [row?.familyId, row?.id])
      .map(Number)
      .filter(Number.isFinite));
  }

  function matchesFamily(skillId, row, catalog, context = {}) {
    const sourceSkill = catalogSkill(catalog, skillId);
    if (sourceSkill && !skillTagsCompatible(sourceSkill, context)) return false;
    const wanted = familySet(row);
    return familyIdsForSkill(skillId, catalog).some(id => wanted.has(Number(id)));
  }

  function combineProbability(current, addition) {
    const a = clampProbability(current);
    const b = clampProbability(addition);
    return 1 - (1 - a) * (1 - b);
  }

  function legacySupportRoutesForRow(card, row, catalog, reliability, context = {}) {
    const eventIds = (card?.eventSkillIds || []).filter(id => matchesFamily(id, row, catalog, context));
    const hintIds = (card?.hintSkillIds || []).filter(id => matchesFamily(id, row, catalog, context));
    if (eventIds.length && hintIds.length) {
      return [{
        type: 'support-event-or-hint',
        probability: Math.max(reliability.supportEvent, reliability.supportHint),
        cardId: Number(card.id),
        skillIds: uniqueNumbers([...eventIds, ...hintIds]),
        label: '支援卡事件／提示'
      }];
    }
    const routes = [];
    if (eventIds.length) {
      routes.push({
        type: 'support-event',
        probability: reliability.supportEvent,
        cardId: Number(card.id),
        skillIds: eventIds.map(Number),
        label: '支援卡事件'
      });
    }
    if (hintIds.length) {
      routes.push({
        type: 'support-hint',
        probability: reliability.supportHint,
        cardId: Number(card.id),
        skillIds: hintIds.map(Number),
        label: '支援卡提示'
      });
    }
    return routes;
  }

  function legacyRowCoverage(row, options, reliability) {
    const routes = [];
    for (const skillId of options.certainSkillIds || []) {
      if (!matchesFamily(skillId, row, options.catalog, options.context || {})) continue;
      routes.push({
        type: 'uma-certain',
        probability: reliability.certain,
        skillIds: [Number(skillId)],
        label: '戰馬本體確定取得'
      });
    }
    for (const skillId of options.characterEventSkillIds || []) {
      if (!matchesFamily(skillId, row, options.catalog, options.context || {})) continue;
      routes.push({
        type: 'uma-event',
        probability: reliability.characterEvent,
        skillIds: [Number(skillId)],
        label: '戰馬事件'
      });
    }
    for (const card of options.deckCards || []) {
      routes.push(...legacySupportRoutesForRow(card, row, options.catalog, reliability, options.context || {}));
    }
    if (
      row.sourceKind === 'parent-unique'
      && (options.directParentSkillIds || []).some(id => matchesFamily(id, row, options.catalog, options.context || {}))
    ) {
      routes.push({
        type: 'direct-parent',
        probability: reliability.directParent,
        label: '直接親代固有'
      });
    }
    for (const factor of options.existingFactors || []) {
      if (!matchesFamily(factor.skillId, row, options.catalog, options.context || {})) continue;
      const occurrences = Math.max(1, Number(factor.occurrences) || 1);
      const totalStars = Math.max(occurrences, Number(factor.totalStars) || occurrences);
      const averageStars = Math.max(1, Math.min(3, totalStars / occurrences));
      const slots = Array.isArray(factor.slots) && factor.slots.length
        ? factor.slots
        : Array.from({ length: occurrences }, () => 'unknown');
      let probability = 0;
      for (const slot of slots) {
        const directMultiplier = ['parentA', 'parentB'].includes(slot) ? 1 : 0.65;
        const starMultiplier = 0.75 + averageStars * 0.125;
        probability = combineProbability(
          probability,
          Math.min(0.7, reliability.existingFactor * directMultiplier * starMultiplier)
        );
      }
      routes.push({
        type: 'existing-factor',
        probability,
        label: `現有家系 ${occurrences} 處／${totalStars}★（位置與星數代理）`
      });
    }
    let coverageProbability = 0;
    for (const route of routes) {
      coverageProbability = combineProbability(coverageProbability, route.probability);
    }
    return { routes, coverageProbability };
  }

  // Coverage is intentionally exact-skill based. A gold skill may supersede a
  // white skill during play, but it is not evidence that the requested gold
  // route is available from a same-family white source (and vice versa).
  function targetKind(target) {
    return target?.kind === 'direct-parent-unique'
      || target?.coverageTargetKind === 'direct-parent-unique'
      || target?.sourceKind === 'parent-unique'
      || target?.directParent === true
      ? 'direct-parent-unique'
      : 'factor';
  }

  function exactSkillIdForTarget(target) {
    return numericId(
      target?.requiredSkillId
      ?? target?.exactSkillId
      ?? target?.coverageTargetSkillId
      ?? target?.factorId
      ?? target?.id
    );
  }

  function acceptedSkillIdsForTarget(target) {
    return uniqueNumbers([
      exactSkillIdForTarget(target),
      ...(target?.acceptedSkillIds || [])
    ]);
  }

  function matchesExactTarget(skillId, target) {
    return acceptedSkillIdsForTarget(target).includes(Number(skillId));
  }

  function catalogSkill(catalog, skillId) {
    return (catalog?.skills || []).find(skill => Number(skill.id) === Number(skillId)) || null;
  }

  function skillTagsCompatible(skill, context = {}) {
    const tags = new Set(skill?.tags || []);
    const runningStyle = Number(context.running_style ?? context.runningStyle);
    const distance = Number(context.distance_type ?? context.distanceType);
    const ground = Number(context.ground_type ?? context.groundType);
    const wantedStyle = { 1: 'run', 2: 'ldr', 3: 'btw', 4: 'cha' }[runningStyle];
    const wantedDistance = { 1: 'sho', 2: 'mil', 3: 'med', 4: 'lng' }[distance];
    const wantedGround = { 1: 'tur', 2: 'dir' }[ground];
    const styleTags = ['run', 'ldr', 'btw', 'cha'].filter(tag => tags.has(tag));
    const distanceTags = ['sho', 'mil', 'med', 'lng'].filter(tag => tags.has(tag));
    const groundTags = ['tur', 'dir'].filter(tag => tags.has(tag));
    if (styleTags.length && wantedStyle && !tags.has(wantedStyle)) return false;
    if (distanceTags.length && wantedDistance && !tags.has(wantedDistance)) return false;
    if (groundTags.length && wantedGround && !tags.has(wantedGround)) return false;
    return true;
  }

  function sameSkillFamily(left, right) {
    const leftFamilies = new Set(uniqueNumbers([
      ...(left?.familyIds || []),
      left?.familyId,
      left?.id
    ]));
    return uniqueNumbers([
      ...(right?.familyIds || []),
      right?.familyId,
      right?.id
    ]).some(id => leftFamilies.has(id));
  }

  function matchesAcquisitionTarget(skillId, target, catalog, context = {}) {
    const sourceSkill = catalogSkill(catalog, skillId);
    if (sourceSkill && !skillTagsCompatible(sourceSkill, context)) return false;
    if (matchesExactTarget(skillId, target)) return true;
    if (target?.kind === 'direct-parent-unique') return false;
    const requiredSkill = catalogSkill(catalog, exactSkillIdForTarget(target));
    if (!requiredSkill || !sourceSkill || !sameSkillFamily(requiredSkill, sourceSkill)) return false;
    const requiredRarity = Number(requiredSkill.rarity);
    const sourceRarity = Number(sourceSkill.rarity);
    // A higher purchasable version can satisfy a white race-skill need; the
    // reverse is deliberately forbidden so a white route never claims a gold
    // target. Unique inheritance stays in its own exact-only bucket above.
    return requiredRarity === 1 && sourceRarity > requiredRarity && sourceRarity <= 2;
  }

  function coverageTargetForRow(row, index = 0) {
    const kind = targetKind(row);
    const requiredSkillId = kind === 'direct-parent-unique'
      ? numericId(row?.coverageTargetSkillId ?? row?.id)
      : numericId(row?.coverageTargetSkillId ?? row?.factorId ?? row?.id);
    return normalizeCoverageTarget({
      id: requiredSkillId,
      requiredSkillId,
      kind,
      sourceKind: row?.sourceKind || null,
      inheritedParentSkillIds: uniqueNumbers([
        ...(row?.inheritedParentSkillIds || []),
        ...(row?.parentSkillIds || []),
        kind === 'direct-parent-unique' ? row?.id : null
      ]),
      requiresInheritedParent: kind === 'direct-parent-unique',
      inheritedAvailable: row?.inheritedAvailable == null
        ? row?.routeImpactVariant === 'inherited'
          || row?.inheritedImpact != null
          || row?.requiresInheritedParent === false
        : Boolean(row.inheritedAvailable),
      familyId: row?.familyId,
      familyIds: row?.familyIds,
      rowId: row?.id,
      label: row?.factorName || row?.name,
      weight: row?.weight
        ?? row?.reliableBashin
        ?? row?.routeBashin
        ?? row?.expectedBashin,
      order: index
    }, index);
  }

  function normalizeCoverageTarget(target, index = 0) {
    const kind = targetKind(target);
    const requiredSkillId = exactSkillIdForTarget(target);
    if (requiredSkillId === null) return null;
    return {
      ...target,
      id: requiredSkillId,
      requiredSkillId,
      kind,
      sourceKind: target?.sourceKind || (kind === 'direct-parent-unique' ? 'parent-unique' : null),
      directParent: kind === 'direct-parent-unique',
      inheritedParentSkillIds: uniqueNumbers([
        ...(target?.inheritedParentSkillIds || []),
        ...(target?.parentSkillIds || []),
        kind === 'direct-parent-unique' ? target?.id : null
      ]),
      requiresInheritedParent: target?.requiresInheritedParent == null
        ? kind === 'direct-parent-unique'
        : Boolean(target.requiresInheritedParent),
      inheritedAvailable: target?.inheritedAvailable == null
        ? target?.routeImpactVariant == null
          ? true
          : target.routeImpactVariant === 'inherited' || target?.inheritedImpact != null
        : Boolean(target.inheritedAvailable),
      familyId: numericId(target?.familyId),
      familyIds: uniqueNumbers(target?.familyIds || []),
      label: target?.label || target?.name || target?.nameZhTw || String(requiredSkillId),
      weight: Math.max(0, Number(target?.weight) || 0),
      order: Number.isFinite(Number(target?.order)) ? Number(target.order) : index,
      coverageKey: `${kind}:${requiredSkillId}`
    };
  }

  function explicitProbability(card, type, skillId, fallback) {
    const id = String(skillId);
    const candidates = [
      card?.routeProbabilities?.[`${type}:${id}`],
      card?.routeProbabilities?.[type]?.[id],
      card?.[`${type}SkillProbabilities`]?.[id],
      card?.[`${type}Probability`]
    ];
    const value = candidates.find(candidate => Number.isFinite(Number(candidate)));
    return {
      probability: clampProbability(value == null ? fallback : value),
      probabilitySource: value == null ? 'fallback' : 'card-metadata'
    };
  }

  function sharedSupportRoutesForTarget(card, target, reliability, catalog, options = {}) {
    if (typeof skillAcquisitionCore?.classifySupportRoute !== 'function'
      || typeof skillAcquisitionCore?.routeRecords !== 'function'
      || typeof skillAcquisitionCore?.calculateHintAcquisition !== 'function'
      || !options.supportEventRoutes) return null;
    const routeOptions = {
      routeDataset: options.supportEventRoutes || null,
      continuousHeuristic: options.continuousEventProbability
        ?? options.acquisitionScenarioProxy?.continuousEventProbability
        ?? reliability.continuousEventProbability
        ?? reliability.supportEvent
    };
    const cardId = numericId(card?.id);
    const targetSkillId = exactSkillIdForTarget(target);
    const hintSkillIds = uniqueNumbers(card?.hintSkillIds || []);
    const rows = [];
    const resolvedEffects = card?.resolvedProfile?.effects
      || card?.acquisition?.resolvedEffects
      || card?.resolvedEffects
      || card?.effects
      || null;
    const opportunities = Math.max(0, Math.trunc(Number(
      options.acquisitionScenarioProxy?.hintOpportunityCount
        ?? options.hintOpportunityCount
        ?? 1
    )));
    const add = (route, type, skillId, probability, hintMetrics = null) => {
      const classification = skillAcquisitionCore.classifySupportRoute(route, routeOptions);
      const routeType = classification.routeType;
      const skill = (catalog?.skills || []).find(item => Number(item.id) === Number(skillId));
      const conditionReliability = type === 'support-event'
        ? conditionReliabilityForSkill(skill, options.context || {})
        : 1;
      const rawProbability = clampProbability(
        probability ?? classification.rankingProbability
      );
      const safeProbability = clampProbability(
        rawProbability * conditionReliability
      );
      rows.push({
        type,
        cardId,
        skillIds: [Number(skillId)],
        skillRarity: Number(catalog?.skills?.find(skill => Number(skill.id) === Number(skillId))?.rarity),
        source: type === 'support-hint' ? 'hint' : 'event',
        sourceKind: routeType,
        routeType,
        rawProbability,
        probability: safeProbability,
        coverageProbability: safeProbability,
        rankingProbability: safeProbability,
        conditionReliability,
        probabilitySource: classification.probabilitySource,
        bonusOnly: Boolean(classification.bonusOnly),
        heuristic: routeType === skillAcquisitionCore.ROUTE_TYPES.CONTINUOUS_EVENT
          || String(classification.probabilitySource || '').startsWith('heuristic:'),
        hintMetrics,
        // One selected support card is one candidate source. Event and hint
        // evidence share this group so a same-card route is max/unioned once.
        exclusiveGroup: `support:${cardId}:target:${targetSkillId}`,
        label: type === 'support-event'
          ? routeType === skillAcquisitionCore.ROUTE_TYPES.RANDOM_EVENT
            ? '隨機事件（額外、不計推薦）'
            : routeType === skillAcquisitionCore.ROUTE_TYPES.UNKNOWN_EVENT
              ? '未知事件（未計推薦）'
              : '連續事件'
          : '訓練靈感'
      });
    };
    const eventIds = uniqueNumbers(card?.eventSkillIds || [])
      .filter(skillId => matchesAcquisitionTarget(skillId, target, catalog, options.context || {}));
    for (const skillId of eventIds) {
      const records = skillAcquisitionCore.routeRecords(options.supportEventRoutes, cardId, skillId);
      const evidence = records.length
        ? records
        : [{
          supportId: cardId,
          skillId,
          eventKind: skillAcquisitionCore.ROUTE_TYPES.UNKNOWN_EVENT
        }];
      evidence.forEach(route => {
        const classified = skillAcquisitionCore.classifySupportRoute(route, routeOptions);
        add(route, 'support-event', skillId, classified.rankingProbability);
      });
    }
    const targetInHintPool = hintSkillIds.includes(Number(targetSkillId));
    if (targetInHintPool) {
      const hintMetrics = skillAcquisitionCore.calculateHintAcquisition({
        supportCard: card,
        resolvedEffects,
        hintSkillIds,
        targetSkillId,
        opportunities
      }, { opportunities });
      add({
        supportId: cardId,
        skillId: targetSkillId,
        routeType: skillAcquisitionCore.ROUTE_TYPES.TRAINING_HINT,
        hintSkillIds,
        resolvedEffects,
        hintMetrics
      }, 'support-hint', targetSkillId, hintMetrics.pAtLeastOnce, hintMetrics);
    }
    return rows;
  }

  function cardChoiceGroup(card, target, route) {
    const cardId = numericId(card?.id);
    const type = route?.type === 'support-event' ? 'event' : 'hint';
    const configured = route?.choiceGroup
      ?? card?.routeChoiceGroups?.[`${type}:${route?.skillId}`]
      ?? card?.routeChoiceGroups?.[type];
    // Event and hint arrays on one card are alternative choices from that one
    // card, so they cannot be compounded as independent probabilities.
    return configured || `support:${cardId ?? 'unknown'}:target:${exactSkillIdForTarget(target)}`;
  }

  function supportRoutesForTarget(card, target, reliability, catalog, options = {}) {
    const sharedRoutes = sharedSupportRoutesForTarget(card, target, reliability, catalog, options);
    if (sharedRoutes) return sharedRoutes;
    const routes = [];
    const add = (type, ids, fallback) => {
      for (const skillId of uniqueNumbers(ids)) {
        if (!matchesAcquisitionTarget(skillId, target, catalog, options.context || {})) continue;
        const sourceType = type === 'support-event' ? 'event' : 'hint';
        const missingEventDataset = type === 'support-event'
          && typeof skillAcquisitionCore?.classifySupportRoute === 'function'
          && !options.supportEventRoutes;
        // With the shared acquisition core present, an event without audited
        // route data is unknown and must not inherit the legacy .45 proxy.
        // Hint routes retain their explicit/fallback proxy semantics.
        const resolved = missingEventDataset
          ? { probability: 0, probabilitySource: 'fail-closed-missing-event-route' }
          : explicitProbability(card, sourceType, skillId, fallback);
        const route = {
          type,
          cardId: numericId(card?.id),
          skillIds: [skillId],
          skillRarity: Number(catalog?.skills?.find(skill => Number(skill.id) === Number(skillId))?.rarity),
          rawProbability: resolved.probability,
          probability: resolved.probability,
          probabilitySource: resolved.probabilitySource,
          routeType: missingEventDataset
            ? skillAcquisitionCore.ROUTE_TYPES.UNKNOWN_EVENT
            : null,
          sourceKind: missingEventDataset
            ? skillAcquisitionCore.ROUTE_TYPES.UNKNOWN_EVENT
            : null,
          bonusOnly: missingEventDataset,
          label: type === 'support-event' ? '支援卡事件' : '支援卡提示'
        };
        route.conditionReliability = type === 'support-event'
          ? conditionReliabilityForSkill(
            (catalog?.skills || []).find(item => Number(item.id) === Number(skillId)),
            options.context || {}
          )
          : 1;
        route.probability = clampProbability(route.probability * route.conditionReliability);
        route.coverageProbability = route.probability;
        route.exclusiveGroup = cardChoiceGroup(card, target, {
          type,
          skillId
        });
        routes.push(route);
      }
    };
    add('support-event', card?.eventSkillIds, reliability.supportEvent);
    add('support-hint', card?.hintSkillIds, reliability.supportHint);
    for (const customRoute of card?.coverageRoutes || []) {
      const type = customRoute?.type === 'hint' || customRoute?.type === 'support-hint'
        ? 'support-hint'
        : customRoute?.type === 'event' || customRoute?.type === 'support-event'
          ? 'support-event'
          : null;
      if (!type) continue;
      for (const skillId of uniqueNumbers(customRoute.skillIds || [customRoute.skillId])) {
        if (!matchesAcquisitionTarget(skillId, target, catalog, options.context || {})) continue;
        const routeEvidence = {
          ...customRoute,
          supportId: numericId(card?.id),
          cardId: numericId(card?.id),
          skillId,
          source: type === 'support-event' ? 'event' : 'hint',
          routeType: customRoute.routeType
            || customRoute.sourceKind
            || customRoute.eventKind
            || (type === 'support-event' ? 'unknown_event' : 'training_hint')
        };
        const classification = typeof skillAcquisitionCore?.classifySupportRoute === 'function'
          ? skillAcquisitionCore.classifySupportRoute(routeEvidence, {
            routeDataset: options.supportEventRoutes || null,
            continuousHeuristic: options.continuousEventProbability
              ?? options.acquisitionScenarioProxy?.continuousEventProbability
              ?? reliability.continuousEventProbability
          })
          : null;
        const routeType = classification?.routeType || routeEvidence.routeType;
        const isRandomOrUnknown = /random|unknown/i.test(String(routeType));
        const providedProbability = Number(
          customRoute.coverageProbability ?? customRoute.probability
        );
        const probability = isRandomOrUnknown
          ? 0
          : Number.isFinite(providedProbability)
            ? clampProbability(providedProbability)
            : clampProbability(classification?.rankingProbability);
        const rawProbability = Number.isFinite(providedProbability)
          ? clampProbability(providedProbability)
          : clampProbability(classification?.rankingProbability);
        const route = {
          type,
          cardId: numericId(card?.id),
          skillIds: [skillId],
          skillRarity: Number(catalog?.skills?.find(skill => Number(skill.id) === Number(skillId))?.rarity),
          source: type === 'support-event' ? 'event' : 'hint',
          sourceKind: routeType,
          routeType,
          eventKind: customRoute.eventKind || (type === 'support-event' ? routeType : null),
          rawProbability,
          probability,
          coverageProbability: probability,
          probabilitySource: isRandomOrUnknown
            ? classification?.probabilitySource || 'unknown-event-fail-closed'
            : customRoute.probabilitySource || classification?.probabilitySource || 'card-route',
          bonusOnly: isRandomOrUnknown || customRoute.bonusOnly === true,
          heuristic: routeType === skillAcquisitionCore?.ROUTE_TYPES?.CONTINUOUS_EVENT
            || String(classification?.probabilitySource || '').startsWith('heuristic:'),
          eventBranchKey: customRoute.eventBranchKey || customRoute.branchKey || null,
          eventBranchGroupId: customRoute.eventBranchGroupId || customRoute.eventId || null,
          eventBranchCoObtainable: customRoute.eventBranchCoObtainable === true
            || customRoute.coObtainable === true,
          label: type === 'support-event' ? '支援卡事件' : '支援卡提示'
        };
        route.conditionReliability = type === 'support-event'
          ? conditionReliabilityForSkill(
            (catalog?.skills || []).find(item => Number(item.id) === Number(skillId)),
            options.context || {}
          )
          : 1;
        route.probability = clampProbability(route.probability * route.conditionReliability);
        route.coverageProbability = route.probability;
        route.exclusiveGroup = cardChoiceGroup(card, target, {
          type,
          skillId,
          choiceGroup: customRoute.choiceGroup
        });
        routes.push(route);
      }
    }
    return routes;
  }

  function acquisitionRouteSourceKey(route, index = 0) {
    const cardId = numericId(route?.cardId ?? route?.supportId);
    if (cardId != null) return `support:${cardId}`;
    const explicit = route?.candidateSourceKey || route?.sourceKey;
    if (explicit != null && String(explicit) !== '') return String(explicit);
    return `route:${route?.source || route?.type || 'unknown'}:${index}`;
  }

  function mergedSupportRouteProbability(routes, options = {}) {
    const bySource = new Map();
    (routes || []).forEach((route, index) => {
      const key = acquisitionRouteSourceKey(route, index);
      if (!bySource.has(key)) bySource.set(key, []);
      bySource.get(key).push(route);
    });
    const sourceProbabilities = [...bySource.values()].map(sourceRoutes => {
      if (typeof skillAcquisitionCore?.mergeRoutes === 'function') {
        return clampProbability(skillAcquisitionCore.mergeRoutes(sourceRoutes, {
          routeDataset: options.supportEventRoutes || null,
          continuousHeuristic: options.continuousEventProbability
            ?? options.acquisitionScenarioProxy?.continuousEventProbability,
          independentEvidence: false
        }).coverageProbability);
      }
      const byExclusiveGroup = new Map();
      for (const route of sourceRoutes) {
        const group = String(route?.exclusiveGroup
          || `${route?.type || route?.source || ''}:${route?.skillId ?? ''}`);
        byExclusiveGroup.set(group, Math.max(
          byExclusiveGroup.get(group) || 0,
          clampProbability(route?.coverageProbability ?? route?.probability)
        ));
      }
      let uncovered = 1;
      for (const probability of byExclusiveGroup.values()) uncovered *= 1 - probability;
      return clampProbability(1 - uncovered);
    });
    let uncovered = 1;
    for (const probability of sourceProbabilities) uncovered *= 1 - probability;
    return clampProbability(1 - uncovered);
  }

  function routeProbability(routes, options = {}) {
    const supportRoutes = (routes || []).filter(route =>
      (route?.type === 'support-event'
        || route?.type === 'support-hint'
        || route?.source === 'event'
        || route?.source === 'hint')
      && (route?.routeType || route?.sourceKind)
    );
    const formalSupportRoutes = supportRoutes.filter(isFormalAcquisitionRoute);
    const nonSupportRoutes = (routes || []).filter(route => !supportRoutes.includes(route));
    if (typeof skillAcquisitionCore?.mergeRoutes === 'function' && formalSupportRoutes.length) {
      const supportProbability = mergedSupportRouteProbability(formalSupportRoutes, options);
      let nonSupportUncovered = 1;
      for (const route of nonSupportRoutes) {
        nonSupportUncovered *= 1 - clampProbability(route?.probability);
      }
      return Math.round((1 - (1 - supportProbability) * nonSupportUncovered) * 1000000) / 1000000;
    }
    const byExclusiveGroup = new Map();
    for (const route of [...formalSupportRoutes, ...nonSupportRoutes]) {
      const group = String(route?.exclusiveGroup || `${route?.type}:${route?.cardId ?? ''}`);
      byExclusiveGroup.set(
        group,
        Math.max(byExclusiveGroup.get(group) || 0, clampProbability(route?.probability))
      );
    }
    let probability = 0;
    for (const groupProbability of byExclusiveGroup.values()) {
      probability = combineProbability(probability, groupProbability);
    }
    return Math.round(probability * 1000000) / 1000000;
  }

  function supportRoutesForRow(card, row, catalog, reliability, options = {}) {
    return supportRoutesForTarget(card, coverageTargetForRow(row), reliability, catalog, options);
  }

  function targetCoverage(target, options, reliability) {
    const routes = [];
    const isDirectParentUnique = target.kind === 'direct-parent-unique';
    if (!isDirectParentUnique) {
      for (const skillId of options.certainSkillIds || []) {
        if (!matchesAcquisitionTarget(skillId, target, options.catalog, options.context || {})) continue;
        routes.push({
          type: 'uma-certain',
          probability: reliability.certain,
          skillIds: [Number(skillId)],
          exclusiveGroup: `uma-certain:${skillId}`,
          label: '目標馬已取得'
        });
      }
      for (const skillId of options.characterEventSkillIds || []) {
        if (!matchesAcquisitionTarget(skillId, target, options.catalog, options.context || {})) continue;
        routes.push({
          type: 'uma-event',
          probability: reliability.characterEvent,
          skillIds: [Number(skillId)],
          exclusiveGroup: `uma-event:${skillId}`,
          label: '目標馬事件'
        });
      }
      for (const card of options.deckCards || []) {
        routes.push(...supportRoutesForTarget(card, target, reliability, options.catalog, options));
      }
    }
    if (
      target.kind === 'direct-parent-unique'
      && target.inheritedAvailable
      && (options.directParentSkillIds || []).some(id =>
        (target.inheritedParentSkillIds || []).includes(Number(id))
      )
    ) {
      routes.push({
        type: 'direct-parent',
        probability: reliability.directParent,
        skillIds: uniqueNumbers(target.inheritedParentSkillIds),
        exclusiveGroup: `direct-parent:${target.requiredSkillId}`,
        label: '已選直親固有繼承'
      });
    }
    for (const [factorIndex, factor] of (isDirectParentUnique ? [] : options.existingFactors || []).entries()) {
      if (!matchesAcquisitionTarget(factor.skillId, target, options.catalog, options.context || {})) continue;
      const occurrences = Math.max(1, Number(factor.occurrences) || 1);
      const totalStars = Math.max(occurrences, Number(factor.totalStars) || occurrences);
      const averageStars = Math.max(1, Math.min(3, totalStars / occurrences));
      const slots = Array.isArray(factor.slots) && factor.slots.length
        ? factor.slots
        : Array.from({ length: occurrences }, () => 'unknown');
      let probability = 0;
      for (const slot of slots) {
        const directMultiplier = ['parentA', 'parentB'].includes(slot) ? 1 : 0.65;
        const starMultiplier = 0.75 + averageStars * 0.125;
        probability = combineProbability(
          probability,
          Math.min(0.7, reliability.existingFactor * directMultiplier * starMultiplier)
        );
      }
      routes.push({
        type: 'existing-factor',
        probability,
        skillIds: [Number(factor.skillId)],
        exclusiveGroup: `existing-factor:${target.requiredSkillId}:${factor.id ?? factorIndex}`,
        label: '既有家系白因子'
      });
    }
    return { routes, coverageProbability: routeProbability(routes, options) };
  }

  function rowCoverage(row, options, reliability) {
    return targetCoverage(coverageTargetForRow(row), options, reliability);
  }

  function routeFeasibility(row) {
    if (row.sourceKind === 'parent-unique' || row.factorId || row.actionable) return 1;
    return 0.35;
  }

  function deduplicateCoverageTargets(targets) {
    const byKey = new Map();
    for (const [index, rawTarget] of (targets || []).entries()) {
      const target = normalizeCoverageTarget(rawTarget, index);
      if (!target) continue;
      const existing = byKey.get(target.coverageKey);
      if (!existing) {
        byKey.set(target.coverageKey, {
          ...target,
          sourceTargets: [target]
        });
        continue;
      }
      const preferred = target.weight > existing.weight ? target : existing;
      byKey.set(target.coverageKey, {
        ...preferred,
        sourceTargets: [...existing.sourceTargets, target],
        duplicateCount: existing.sourceTargets.length + 1
      });
    }
    return [...byKey.values()].sort((left, right) =>
      left.order - right.order
      || left.requiredSkillId - right.requiredSkillId
    );
  }

  function coverageMetrics(targets) {
    const totalWeight = targets.reduce((sum, target) => sum + target.weight, 0);
    const expectedCoveredWeight = targets.reduce((sum, target) =>
      sum + target.weight * target.coverageProbability, 0);
    const certainCoveredWeight = targets.reduce((sum, target) =>
      sum + (target.coverageProbability >= 0.999 ? target.weight : 0), 0);
    const residualWeight = Math.max(0, totalWeight - expectedCoveredWeight);
    return {
      targetCount: targets.length,
      totalWeight,
      // `coveredWeight` is an expected-weight numerator. Consumers that need
      // a binary total must use certainCoveredWeight explicitly.
      coveredWeight: expectedCoveredWeight,
      expectedCoveredWeight,
      certainCoveredWeight,
      residualWeight,
      percentage: totalWeight > 0 ? Math.round(expectedCoveredWeight / totalWeight * 100) : 0,
      certainPercentage: totalWeight > 0 ? Math.round(certainCoveredWeight / totalWeight * 100) : 0,
      coveredSkillIds: targets
        .filter(target => target.coverageProbability >= 0.999)
        .map(target => target.requiredSkillId),
      partialSkillIds: targets
        .filter(target => target.coverageProbability > 0 && target.coverageProbability < 0.999)
        .map(target => target.requiredSkillId),
      uncoveredSkillIds: targets
        .filter(target => target.coverageProbability <= 0)
        .map(target => target.requiredSkillId)
    };
  }

  /**
   * Build the single semantic coverage source for Step 5.
   *
   * Inputs are exact targets, not skill-family aliases. `factor` targets form
   * the displayed factor percentage. `direct-parent-unique` targets are
   * intentionally reported in a separate bucket, so a selected parent unique
   * can never inflate the remaining-factor percentage.
   */
  function buildCoverageSummary(options = {}) {
    const reliability = {
      ...DEFAULT_ROUTE_RELIABILITY,
      ...(options.routeReliability || {})
    };
    const targets = deduplicateCoverageTargets(options.targets || options.coverageTargets || [])
      .map(target => {
        const coverage = targetCoverage(target, options, reliability);
        const coverageProbability = coverage.coverageProbability;
        return {
          ...target,
          coverageRoutes: coverage.routes,
          coverageProbability,
          gapMultiplier: 1 - coverageProbability,
          coveredWeight: target.weight * coverageProbability,
          residualWeight: target.weight * (1 - coverageProbability),
          coverageState: coverageProbability >= 0.999
            ? 'covered'
            : coverageProbability > 0
              ? 'partial'
              : 'gap'
        };
      });
    const factorTargets = targets.filter(target => target.kind === 'factor');
    const directParentTargets = targets.filter(target => target.kind === 'direct-parent-unique');
    const factorCoverage = coverageMetrics(factorTargets);
    const directParentCoverage = coverageMetrics(directParentTargets);
    const acquisitionIdentity = acquisitionDataIdentity(options);
    return {
      schemaVersion: 2,
      modelVersion: MODEL_VERSION,
      acquisitionModelVersion: acquisitionIdentity.modelVersion,
      eventRouteDataVersion: acquisitionIdentity.eventRouteDataVersion,
      eventRouteDataHash: acquisitionIdentity.eventRouteDataHash,
      supportProfileVersion: acquisitionIdentity.supportProfileVersion,
      acquisitionIdentity,
      formula: 'exact target × selected source probability; direct-parent uniques are separate',
      routeReliability: reliability,
      targets,
      factorCoverage,
      directParentCoverage,
      allCoverage: coverageMetrics(targets),
      // Convenience alias for the Step 5 percentage. It deliberately excludes
      // direct-parent uniques and duplicate factor targets.
      coverage: factorCoverage
    };
  }

  function buildPlanningSnapshot(options = {}) {
    const courseTable = options.courseTable || { families: [] };
    const reliability = {
      ...DEFAULT_ROUTE_RELIABILITY,
      ...(options.routeReliability || {})
    };
    const rows = (courseTable.families || []).map((row, index) => {
      const coverage = rowCoverage(row, options, reliability);
      const hasDetailedRouteImpact = Number.isFinite(Number(row.routeImpact?.expectedBashin));
      const courseBashin = Number(hasDetailedRouteImpact
        ? row.routeImpact.expectedBashin
        : row.routeBashin ?? row.expectedBashin ?? 0);
      const conditionReliability = Number(hasDetailedRouteImpact
        ? row.routeImpact?.conditionReliability ?? 1
        : Number.isFinite(Number(row.routeBashin))
          ? 1
          : row.conditionReliability ?? 1);
      const reliableBashin = courseBashin * conditionReliability;
      const gapMultiplier = 1 - coverage.coverageProbability;
      const feasibility = routeFeasibility(row);
      const residualWeight = reliableBashin * gapMultiplier * feasibility;
      const selected = !options.selectedFamilyIds?.length
        || options.selectedFamilyIds.map(Number).includes(Number(row.familyId));
      const coverageTarget = coverageTargetForRow({
        ...row,
        reliableBashin,
        weight: Number(row.weight) || reliableBashin
      }, index);
      return {
        ...row,
        order: index,
        courseBashin,
        conditionReliability,
        reliableBashin,
        coverageProbability: coverage.coverageProbability,
        coverageRoutes: coverage.routes,
        gapMultiplier,
        routeFeasibility: feasibility,
        residualWeight,
        residualNeed: residualWeight,
        residualScore: Math.round(residualWeight * 1000),
        selected,
        coverageTargetId: coverageTarget?.requiredSkillId ?? null,
        coverageTargetKind: coverageTarget?.kind || 'factor',
        coverageTargetKey: coverageTarget?.coverageKey || null,
        coverageState: coverage.coverageProbability >= 0.999
          ? 'covered'
          : coverage.coverageProbability > 0
            ? 'partial'
            : 'gap'
      };
    }).sort((a, b) =>
      b.residualWeight - a.residualWeight
      || b.reliableBashin - a.reliableBashin
      || a.order - b.order
    );
    const generatedTargets = rows
      .filter(row => row.selected)
      .map(row => coverageTargetForRow({
        ...row,
        weight: Number(row.weight) || Number(row.reliableBashin) || 0
      }, row.order));
    const coverageSummary = buildCoverageSummary({
      ...options,
      routeReliability: reliability,
      targets: options.coverageTargets || generatedTargets
    });
    const acquisitionIdentity = acquisitionDataIdentity(options);
    return {
      schemaVersion: 1,
      modelVersion: MODEL_VERSION,
      acquisitionModelVersion: acquisitionIdentity.modelVersion,
      eventRouteDataVersion: acquisitionIdentity.eventRouteDataVersion,
      eventRouteDataHash: acquisitionIdentity.eventRouteDataHash,
      supportProfileVersion: acquisitionIdentity.supportProfileVersion,
      acquisitionIdentity,
      formula: '賽道單技能參考馬身 × 條件可靠度 × 未覆蓋率 × 路線可行度＝馬身權重',
      courseTable,
      routeReliability: reliability,
      rows,
      selectedRows: rows.filter(row => row.selected),
      coverageSummary,
      coverage: coverageSummary.factorCoverage,
      factorCoverage: coverageSummary.factorCoverage,
      directParentCoverage: coverageSummary.directParentCoverage,
      topGaps: rows.filter(row => row.actionable && row.residualWeight > 0.05).slice(0, 12),
      limitations: [
        '馬身權重只供排序，不能直接相加；目前尚未做多個加速同時發動的逐幀邊際模擬。',
        '支援卡事件與提示機率是可見代理值，不是遊戲公布的保證機率。'
      ]
    };
  }

  function cardCoverageProbability(card, row, catalog, reliability, options = {}) {
    return routeProbability(
      supportRoutesForRow(card, row, catalog, reliability, options),
      options
    );
  }

  function normalizeSupportType(type) {
    return type === 'intelligence' ? 'Wisdom' : type;
  }

  function rarityProxy(card) {
    return ({ SSR: 60, SR: 30, R: 10 })[card?.rarity] || 0;
  }

  function recommendCards(options = {}) {
    const reliability = {
      ...DEFAULT_ROUTE_RELIABILITY,
      ...(options.routeReliability || {})
    };
    const weightedRows = options.rows || options.snapshot?.topGaps || [];
    const selected = [];
    const used = new Set((options.excludeCardIds || []).map(String));
    const accumulatedCoverage = new Map(
      weightedRows.map(row => [Number(row.familyId), Number(row.coverageProbability) || 0])
    );
    const wantedTypes = (options.targetTypes || []).map(normalizeSupportType);
    const selectedTypeCount = new Map();
    const limit = Math.max(1, Number(options.limit) || 1);

    for (let slot = 0; slot < limit; slot += 1) {
      const candidates = (options.cards || [])
        .filter(card => !used.has(String(card.id)))
        .filter(card =>
          !Number.isFinite(Number(options.targetCharacterId))
          || Number(card.characterId) !== Number(options.targetCharacterId)
        )
        .map(card => {
          let skillCoverageScore = 0;
          const coveredRows = [];
          for (const row of weightedRows) {
            const cardProbability = cardCoverageProbability(
              card,
              row,
              options.catalog,
              reliability,
              options
            );
            if (!cardProbability) continue;
            const before = accumulatedCoverage.get(Number(row.familyId)) || 0;
            const after = combineProbability(before, cardProbability);
            const marginal = Math.max(0, after - before);
            const value = marginal * Number(row.reliableBashin || row.routeBashin || 0);
            skillCoverageScore += value * 1000;
            if (value > 0) coveredRows.push({
              familyId: Number(row.familyId),
              name: row.name,
              marginalProbability: marginal,
              resultingProbability: after,
              value
            });
          }
          const type = normalizeSupportType(card.supportType);
          const wantedCount = wantedTypes.filter(item => item === type).length;
          const currentCount = selectedTypeCount.get(type) || 0;
          const typeNeed = Math.max(0, wantedCount - currentCount);
          const typeScore = typeNeed * 1200;
          return {
            ...card,
            supportType: type,
            skillCoverageScore,
            typeScore,
            proxyScore: rarityProxy(card),
            score: skillCoverageScore + typeScore + rarityProxy(card),
            coveredRows
          };
        })
        .sort((a, b) =>
          b.score - a.score
          || b.skillCoverageScore - a.skillCoverageScore
          || Number(a.id) - Number(b.id)
        );
      const best = candidates[0];
      if (!best) break;
      selected.push(best);
      used.add(String(best.id));
      selectedTypeCount.set(
        best.supportType,
        (selectedTypeCount.get(best.supportType) || 0) + 1
      );
      for (const covered of best.coveredRows) {
        accumulatedCoverage.set(covered.familyId, covered.resultingProbability);
      }
    }
    return {
      cards: selected,
      modelMode: 'course-skill-value+type+rarity-proxy',
      cardStatsComplete: false
    };
  }

  return {
    MODEL_VERSION,
    DEFAULT_ROUTE_RELIABILITY,
    isFormalAcquisitionRoute,
    familyIdsForSkill,
    matchesFamily,
    matchesExactTarget,
    matchesAcquisitionTarget,
    coverageTargetForRow,
    normalizeCoverageTarget,
    acquisitionDataIdentity,
    buildCoverageSummary,
    buildPlanningSnapshot,
    recommendCards
  };
});
