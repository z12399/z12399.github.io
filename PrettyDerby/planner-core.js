(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PLANNER_CORE = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function cardScore(card) {
    const rarity = { R: 0, SR: 1000, SSR: 2000 }[card?.rarity] ?? 0;
    const level = Number.isFinite(Number(card?.level)) ? Number(card.level) : -1;
    const limitBreak = Number.isFinite(Number(card?.limitBreak)) ? Number(card.limitBreak) : -1;
    return rarity + level * 10 + limitBreak * 75;
  }

  function numericId(id) {
    const number = Number(id);
    return Number.isFinite(number) ? number : id;
  }

  function uniqueIds(ids) {
    return [...new Set((ids || []).filter(id => id !== null && id !== undefined).map(numericId))];
  }

  function assumedOwnedRarities(rules) {
    return rules?.ownership?.assumedOwnedRarities || [];
  }

  function isCardOwned(card, inventory, rules) {
    if (!card) return false;
    if (assumedOwnedRarities(rules).includes(card.rarity)) return true;
    return (inventory?.supportCards || []).some(owned => Number(owned.id) === Number(card.id));
  }

  function normalizeSupportType(type) {
    return type === 'intelligence' ? 'Wisdom' : type;
  }

  function normalizeScenarioConstraint(value) {
    const source = value && typeof value === 'object' ? value : {};
    const requiredSupportCardIds = uniqueIds(
      source.requiredSupportCardIds || source.scenarioSupportIds || []
    );
    const entryCardPolicy = source.entryCardPolicy === 'required-one'
      && requiredSupportCardIds.length
      ? 'required-one'
      : 'none';
    return {
      id: source.id || null,
      nameZhTw: source.nameZhTw || source.name || null,
      entryCardPolicy,
      requiredSupportCardIds,
      requiredSupportTypes: uniqueIds(source.requiredSupportTypes || [])
    };
  }

  function inventoryEntryFor(inventory, id) {
    return (inventory?.supportCards || [])
      .find(card => Number(card.id ?? card.supportId) === Number(id)) || null;
  }

  function cardAvailableOnServer(card, options = {}) {
    if (!card) return false;
    if (card.availableOnServer === false || card.serverAvailable === false) return false;
    const server = options.server || options.serverId || 'zh_tw';
    if (Array.isArray(card.availableOnServers) && !card.availableOnServers.includes(server)) {
      return false;
    }
    if (card.serverAvailability && typeof card.serverAvailability === 'object'
      && card.serverAvailability[server] === false) return false;
    return true;
  }

  function scenarioRequiredCardIds(scenario) {
    return scenario?.entryCardPolicy === 'required-one'
      ? scenario.requiredSupportCardIds || []
      : [];
  }

  function scenarioRequiredCard(scenario, catalog, id) {
    return (catalog?.supports || []).find(card => Number(card.id) === Number(id))
      || (Array.isArray(catalog) ? catalog.find(card => Number(card.id) === Number(id)) : null)
      || null;
  }

  function mergeSupportCard(card, owned, rules) {
    return {
      ...card,
      ...(owned || {}),
      supportType: normalizeSupportType(owned?.supportType || card.supportType),
      characterNameZhTw: card.nameZhTw || card.name || owned?.characterNameZhTw || null,
      titleZhTw: card.titleZhTw || card.title || owned?.titleZhTw || null,
      assumedOwned: !owned && assumedOwnedRarities(rules).includes(card.rarity)
    };
  }

  function supportPool(inventory, rules, catalog) {
    const explicit = new Map((inventory?.supportCards || []).map(card => [Number(card.id), card]));
    const catalogCards = (catalog?.supports || [])
      .filter(card => isCardOwned(card, inventory, rules))
      .map(card => mergeSupportCard(card, explicit.get(Number(card.id)), rules));
    const catalogIds = new Set(catalogCards.map(card => Number(card.id)));
    const uncatalogued = [...explicit.values()]
      .filter(card => !catalogIds.has(Number(card.id)))
      .map(card => ({
        ...card,
        supportType: normalizeSupportType(card.supportType),
        assumedOwned: false
      }));
    return [...catalogCards, ...uncatalogued];
  }

  function fullSupportPool(inventory, rules, catalog) {
    const explicit = new Map((inventory?.supportCards || []).map(card => [Number(card.id), card]));
    const catalogCards = (catalog?.supports || [])
      .map(card => mergeSupportCard(card, explicit.get(Number(card.id)), rules));
    const catalogIds = new Set(catalogCards.map(card => Number(card.id)));
    const uncatalogued = [...explicit.values()]
      .filter(card => !catalogIds.has(Number(card.id)))
      .map(card => ({
        ...card,
        supportType: normalizeSupportType(card.supportType),
        assumedOwned: false
      }));
    return [...catalogCards, ...uncatalogued];
  }

  function buildBreedingDeck(inventory, rules, ownedTypePlan, catalog, options = {}) {
    if (options.scenario?.entryCardPolicy === 'required-one') {
      return buildSkillDrivenBreedingDeck(
        inventory,
        rules,
        { categories: [] },
        catalog,
        { ...options, preferredTypes: options.preferredTypes || ownedTypePlan }
      );
    }
    const deckRules = rules.breedingDeck;
    const candidates = supportPool(inventory, rules, catalog)
      .sort((a, b) => cardScore(b) - cardScore(a) || Number(a.id) - Number(b.id));
    const used = new Set();
    const owned = [];

    for (const type of ownedTypePlan || []) {
      const card = candidates.find(item => item.supportType === type && !used.has(Number(item.id)));
      if (!card) continue;
      used.add(Number(card.id));
      owned.push({ ...card, borrowed: false });
    }

    for (const card of candidates) {
      if (owned.length >= deckRules.ownedSlots) break;
      if (used.has(Number(card.id))) continue;
      used.add(Number(card.id));
      owned.push({ ...card, borrowed: false });
    }

    const borrowed = Array.from({ length: deckRules.borrowedSlots }, (_, index) => ({
      id: `borrow-${index + 1}`,
      rarity: null,
      supportType: 'Any',
      characterNameZhTw: '任意支援卡',
      titleZhTw: '借用卡位',
      level: null,
      limitBreak: null,
      borrowed: true
    }));
    const deck = [...owned.slice(0, deckRules.ownedSlots), ...borrowed];
    return { deck, validation: validateBreedingDeck(deck, inventory, rules, options) };
  }

  function skillPlanCategories(skillPlan) {
    if (Array.isArray(skillPlan)) return skillPlan;
    if (Array.isArray(skillPlan?.categories)) return skillPlan.categories;
    if (Array.isArray(skillPlan?.priorities)) {
      return [{ id: 'legacy', label: '技能目標', weight: 100, skills: skillPlan.priorities }];
    }
    return [];
  }

  function optionValue(collection, id) {
    if (!collection) return undefined;
    if (collection instanceof Map) {
      return collection.get(numericId(id)) ?? collection.get(String(id));
    }
    return collection[numericId(id)] ?? collection[String(id)];
  }

  function normalizeSkillTargets(skillPlan, options = {}) {
    const excludedIds = new Set(uniqueIds(options.excludeSkillIds).map(String));
    const targetsById = new Map();
    for (const [categoryIndex, category] of skillPlanCategories(skillPlan).entries()) {
      const categoryWeight = Number(category?.weight);
      const weight = Number.isFinite(categoryWeight) && categoryWeight > 0 ? categoryWeight : 1;
      for (const [skillIndex, skill] of (category?.skills || []).entries()) {
        if (!skill || skill.sourceKind === 'parent-unique' || skill.deckEligible === false) continue;
        const targetIds = uniqueIds([skill.id, skill.factorId]);
        for (const [variantIndex, id] of targetIds.entries()) {
          if (excludedIds.has(String(id))) continue;
          const explicitWeight = Number(skill.weight);
          const skillMultiplier = Number(skill.weightMultiplier);
          const optionMultiplier = Number(optionValue(options.targetWeightMultipliers, id));
          const targetWeight = (Number.isFinite(explicitWeight) && explicitWeight > 0
            ? explicitWeight
            : weight * (Number.isFinite(skillMultiplier) && skillMultiplier >= 0
              ? skillMultiplier
              : 1))
            * (Number.isFinite(optionMultiplier) && optionMultiplier >= 0
              ? optionMultiplier
              : 1);
          if (targetWeight <= 0) continue;
          const target = {
            id,
            familyIds: uniqueIds(skill.familyIds),
            sourceSkillId: numericId(skill.id),
            factorId: skill.factorId == null ? null : numericId(skill.factorId),
            isFactor: skill.factorId != null && Number(id) === Number(skill.factorId),
            categoryId: category.id || `category-${categoryIndex + 1}`,
            categoryLabel: category.label || category.id || `分類 ${categoryIndex + 1}`,
            categoryWeight: weight,
            weight: targetWeight,
            baseWeight: Number.isFinite(explicitWeight) && explicitWeight > 0
              ? explicitWeight
              : weight,
            weightMultiplier: targetWeight / (Number.isFinite(explicitWeight) && explicitWeight > 0
              ? explicitWeight
              : weight),
            categoryIndex,
            skillIndex,
            variantIndex,
            activationWindow: skill.activationWindow || null,
            evidence: skill.evidence || null
          };
          const existing = targetsById.get(String(id));
          if (!existing || target.weight > existing.weight) targetsById.set(String(id), target);
        }
      }
    }
    return [...targetsById.values()];
  }

  function coverageForCard(card, targetById) {
    const hintIds = new Set(uniqueIds(card?.hintSkillIds).map(String));
    const eventIds = new Set(uniqueIds(card?.eventSkillIds).map(String));
    const hintCoverageIds = [];
    const eventCoverageIds = [];

    for (const [id, target] of targetById.entries()) {
      const aliases = new Set([id, ...(target.familyIds || []).map(String)]);
      if ([...aliases].some(alias => hintIds.has(alias))) hintCoverageIds.push(target.id);
      if ([...aliases].some(alias => eventIds.has(alias))) eventCoverageIds.push(target.id);
    }

    const coverageSkillIds = uniqueIds([...hintCoverageIds, ...eventCoverageIds]);
    return {
      coverageSkillIds,
      hintCoverageIds: uniqueIds(hintCoverageIds),
      eventCoverageIds: uniqueIds(eventCoverageIds)
    };
  }

  function annotateCandidates(cards, targets) {
    const targetById = new Map(targets.map(target => [String(target.id), target]));
    return cards.map(card => ({ ...card, ...coverageForCard(card, targetById) }));
  }

  function preferredTypeNeed(card, selected, preferredTypes) {
    if (!Array.isArray(preferredTypes) || preferredTypes.length === 0) return 0;
    const desired = preferredTypes.filter(type => type === card.supportType).length;
    const current = selected.filter(item => item.supportType === card.supportType).length;
    return current < desired ? desired - current : 0;
  }

  function candidateMetrics(card, uncoveredIds, targetsById, selected, options) {
    const newCoverageIds = card.coverageSkillIds.filter(id => uncoveredIds.has(String(id)));
    const newCoverageWeight = newCoverageIds.reduce(
      (sum, id) => sum + (targetsById.get(String(id))?.weight || 0),
      0
    );
    const configuredBonus = Number(optionValue(options.cardBonuses, card.id));
    const preferenceBonus = newCoverageWeight > 0 && Number.isFinite(configuredBonus)
      ? configuredBonus
      : 0;
    const highestNewWeight = newCoverageIds.reduce(
      (highest, id) => Math.max(highest, targetsById.get(String(id))?.weight || 0),
      0
    );
    return {
      card,
      newCoverageIds,
      newCoverageWeight,
      adjustedCoverageWeight: newCoverageWeight + preferenceBonus,
      preferenceBonus,
      highestNewWeight,
      preferredTypeNeed: preferredTypeNeed(card, selected, options.preferredTypes),
      unownedBorrow: options.borrowed && !isCardOwned(card, options.inventory, options.rules) ? 1 : 0,
      strength: cardScore(card)
    };
  }

  function compareCandidateMetrics(a, b, options = {}) {
    const borrowed = Boolean(options.borrowed);
    const aHasCoverage = a.newCoverageWeight > 0 ? 1 : 0;
    const bHasCoverage = b.newCoverageWeight > 0 ? 1 : 0;
    if (aHasCoverage !== bHasCoverage) return bHasCoverage - aHasCoverage;
    if (!aHasCoverage && !bHasCoverage) {
      if (options.preferTypeBeforeStrength && a.preferredTypeNeed !== b.preferredTypeNeed) {
        return b.preferredTypeNeed - a.preferredTypeNeed;
      }
      if (a.strength !== b.strength) return b.strength - a.strength;
      if (a.preferredTypeNeed !== b.preferredTypeNeed) {
        return b.preferredTypeNeed - a.preferredTypeNeed;
      }
      if (borrowed && a.unownedBorrow !== b.unownedBorrow) return b.unownedBorrow - a.unownedBorrow;
      return Number(a.card.id) - Number(b.card.id);
    }
    if (a.adjustedCoverageWeight !== b.adjustedCoverageWeight) {
      return b.adjustedCoverageWeight - a.adjustedCoverageWeight;
    }
    if (borrowed && a.highestNewWeight !== b.highestNewWeight) {
      return b.highestNewWeight - a.highestNewWeight;
    }
    if (a.newCoverageWeight !== b.newCoverageWeight) return b.newCoverageWeight - a.newCoverageWeight;
    if (a.newCoverageIds.length !== b.newCoverageIds.length) {
      return b.newCoverageIds.length - a.newCoverageIds.length;
    }
    if (a.preferredTypeNeed !== b.preferredTypeNeed) {
      return b.preferredTypeNeed - a.preferredTypeNeed;
    }
    if (borrowed && a.unownedBorrow !== b.unownedBorrow) return b.unownedBorrow - a.unownedBorrow;
    if (a.strength !== b.strength) return b.strength - a.strength;
    return Number(a.card.id) - Number(b.card.id);
  }

  function chooseCandidate(cards, uncoveredIds, targetsById, selected, options = {}) {
    const metrics = cards
      .map(card => candidateMetrics(card, uncoveredIds, targetsById, selected, options))
      .sort((a, b) => compareCandidateMetrics(a, b, options));
    return metrics[0] || null;
  }

  function targetCoverageSummary(deck, targets) {
    const covered = new Set(
      deck.flatMap(card => card.coverageSkillIds || []).map(id => String(numericId(id)))
    );
    const coveredSkillIds = targets
      .filter(target => covered.has(String(target.id)))
      .map(target => target.id);
    const totalWeight = targets.reduce((sum, target) => sum + target.weight, 0);
    const coveredWeight = targets
      .filter(target => covered.has(String(target.id)))
      .reduce((sum, target) => sum + target.weight, 0);
    return {
      coveredSkillIds,
      uncoveredSkillIds: targets
        .filter(target => !covered.has(String(target.id)))
        .map(target => target.id),
      totalWeight,
      coveredWeight,
      percentage: totalWeight > 0 ? Math.round((coveredWeight / totalWeight) * 100) : 0
    };
  }

  function maxBorrowLevel(rarity) {
    return { R: 40, SR: 45, SSR: 50 }[rarity] ?? null;
  }

  function buildSkillDrivenBreedingDeck(
    inventory,
    rules,
    skillPlan,
    catalog,
    options = {}
  ) {
    const deckRules = rules.breedingDeck;
    const scenario = normalizeScenarioConstraint(options.scenario);
    const requiredScenarioIds = scenarioRequiredCardIds(scenario);
    const explicitInventoryIds = new Set((inventory?.supportCards || [])
      .map(card => String(card.id ?? card.supportId)));
    const targetCharacterId = Number(options.battleUma?.characterId ?? options.targetCharacterId);
    const usableScenarioCards = requiredScenarioIds
      .map(id => scenarioRequiredCard(scenario, catalog, id))
      .filter(card => cardAvailableOnServer(card, options))
      .filter(card => !Number.isFinite(targetCharacterId)
        || Number(card.characterId) !== targetCharacterId);
    const usableScenarioIds = usableScenarioCards.map(card => Number(card.id));
    const requiredOwnedId = usableScenarioIds.find(id => explicitInventoryIds.has(String(id)));
    // required-one is an alternative set: once one exact ID is explicitly
    // owned, do not also force an unowned alternative into the borrow slot.
    const requiredBorrowId = requiredOwnedId == null
      ? usableScenarioIds.find(id => !explicitInventoryIds.has(String(id)))
      : null;
    const requiredBorrowCard = requiredBorrowId == null
      ? null
      : scenarioRequiredCard(scenario, catalog, requiredBorrowId);
    const targets = normalizeSkillTargets(skillPlan, options);
    const targetsById = new Map(targets.map(target => [String(target.id), target]));
    const uncoveredIds = new Set(targets.map(target => String(target.id)));
    const ownedCandidates = annotateCandidates(supportPool(inventory, rules, catalog), targets)
      .filter(card => cardAvailableOnServer(card, options))
      .filter(card => {
        const id = Number(card.id);
        // R/SR assumed ownership is still useful for factor farming, but an
        // exact scenario card may enter the owned five only with an explicit
        // inventory row.
        if (requiredScenarioIds.includes(id) && !explicitInventoryIds.has(String(id))) return false;
        if (requiredBorrowCard && Number.isFinite(targetCharacterId)
          && Number(requiredBorrowCard.characterId) === targetCharacterId) return false;
        return !Number.isFinite(targetCharacterId) || Number(card.characterId) !== targetCharacterId;
      });
    const selectedOwned = [];
    const usedIds = new Set();
    const usedCharacterIds = new Set();
    const speedRequirement = (deckRules.requiredSupportTypes || [])
      .find(requirement => requirement.type === 'Speed');
    const speedMinimum = Number(speedRequirement?.minimum || 0);
    const ownedCanSupplySpeed = ownedCandidates.some(card => card.supportType === 'Speed');

    const addOwnedCard = (card, metrics) => {
      if (!card || selectedOwned.length >= deckRules.ownedSlots) return false;
      selectedOwned.push({
        ...card,
        borrowed: false,
        responsibilitySkillIds: metrics?.newCoverageIds || []
      });
      usedIds.add(String(card.id));
      if (Number.isFinite(Number(card.characterId))) {
        usedCharacterIds.add(String(card.characterId));
      }
      for (const id of metrics?.newCoverageIds || []) uncoveredIds.delete(String(id));
      return true;
    };

    const mandatoryOwnedCard = requiredOwnedId == null
      ? null
      : ownedCandidates.find(card => Number(card.id) === Number(requiredOwnedId));
    if (requiredOwnedId != null && mandatoryOwnedCard) {
      const metrics = candidateMetrics(mandatoryOwnedCard, uncoveredIds, targetsById, selectedOwned, {
        inventory,
        rules,
        borrowed: false
      });
      addOwnedCard(mandatoryOwnedCard, metrics);
    }

    while (selectedOwned.length < deckRules.ownedSlots) {
      let remaining = ownedCandidates.filter(card => !usedIds.has(String(card.id))
        && (!Number.isFinite(Number(card.characterId))
          || !usedCharacterIds.has(String(card.characterId))));
      if (remaining.length === 0) break;

      const selectedSpeedCount = selectedOwned.filter(card => card.supportType === 'Speed').length;
      const slotsLeft = deckRules.ownedSlots - selectedOwned.length;
      const speedStillNeeded = Math.max(0, speedMinimum - selectedSpeedCount);
      if (ownedCanSupplySpeed && speedStillNeeded > 0 && slotsLeft <= speedStillNeeded) {
        remaining = remaining.filter(card => card.supportType === 'Speed');
      }

      const picked = chooseCandidate(remaining, uncoveredIds, targetsById, selectedOwned, {
        preferredTypes: options.preferredTypes || [],
        preferTypeBeforeStrength: Boolean(options.preferTypeBeforeStrength),
        cardBonuses: options.cardBonuses,
        inventory,
        rules,
        borrowed: false
      });
      if (!picked) break;

      addOwnedCard(picked.card, picked);
    }

    const allCandidates = annotateCandidates(fullSupportPool(inventory, rules, catalog), targets)
      .filter(card => cardAvailableOnServer(card, options))
      .filter(card => !Number.isFinite(targetCharacterId)
        || Number(card.characterId) !== targetCharacterId);
    const requiredBorrowCandidate = requiredBorrowId == null
      ? null
      : allCandidates.find(card => Number(card.id) === Number(requiredBorrowId));
    const borrowedCards = [];
    const addBorrowedCard = card => {
      if (!card) return false;
      const borrowed = {
        ...card,
        borrowed: true,
        borrowedAtMax: true,
        level: maxBorrowLevel(card.rarity),
        limitBreak: card.rarity ? 4 : null,
        responsibilitySkillIds: []
      };
      const metrics = candidateMetrics(card, uncoveredIds, targetsById,
        [...selectedOwned, ...borrowedCards], {
          preferredTypes: options.preferredTypes || [],
          preferTypeBeforeStrength: Boolean(options.preferTypeBeforeStrength),
          cardBonuses: options.cardBonuses,
          inventory,
          rules,
          borrowed: true
        });
      borrowed.responsibilitySkillIds = metrics.newCoverageIds;
      borrowedCards.push(borrowed);
      usedIds.add(String(card.id));
      if (Number.isFinite(Number(card.characterId))) {
        usedCharacterIds.add(String(card.characterId));
      }
      for (const id of metrics.newCoverageIds) uncoveredIds.delete(String(id));
      return true;
    };

    if (requiredBorrowId != null && requiredBorrowCandidate
      && borrowedCards.length < deckRules.borrowedSlots
      && !usedIds.has(String(requiredBorrowCandidate.id))) {
      addBorrowedCard(requiredBorrowCandidate);
    }

    for (let index = borrowedCards.length; index < deckRules.borrowedSlots; index += 1) {
      let remaining = allCandidates.filter(card => !usedIds.has(String(card.id))
        && (!Number.isFinite(Number(card.characterId))
          || !usedCharacterIds.has(String(card.characterId))));
      const speedCount = [...selectedOwned, ...borrowedCards]
        .filter(card => card.supportType === 'Speed').length;
      const borrowedSlotsLeft = deckRules.borrowedSlots - index;
      const speedStillNeeded = Math.max(0, speedMinimum - speedCount);
      if (speedStillNeeded > 0 && borrowedSlotsLeft <= speedStillNeeded) {
        remaining = remaining.filter(card => card.supportType === 'Speed');
      }

      const picked = chooseCandidate(remaining, uncoveredIds, targetsById, [
        ...selectedOwned,
        ...borrowedCards
      ], {
        preferredTypes: options.preferredTypes || [],
        preferTypeBeforeStrength: Boolean(options.preferTypeBeforeStrength),
        cardBonuses: options.cardBonuses,
        inventory,
        rules,
        borrowed: true
      });

      if (!picked) {
        borrowedCards.push({
          id: `borrow-${index + 1}`,
          rarity: null,
          supportType: speedStillNeeded > 0 ? 'Speed' : 'Any',
          characterNameZhTw: '任意支援卡',
          titleZhTw: '借用卡位',
          level: null,
          limitBreak: null,
          borrowed: true,
          coverageSkillIds: [],
          hintCoverageIds: [],
          eventCoverageIds: [],
          responsibilitySkillIds: []
        });
        continue;
      }

      addBorrowedCard(picked.card);
    }

    const deck = [
      ...selectedOwned.slice(0, deckRules.ownedSlots),
      ...borrowedCards.slice(0, deckRules.borrowedSlots)
    ];
    const validation = validateBreedingDeck(deck, inventory, rules, {
      ...options,
      scenario,
      targetCharacterId,
      catalog
    });
    return {
      deck,
      validation,
      coverage: targetCoverageSummary(deck, targets),
      scenario,
      scenarioShortage: validation.violations.filter(violation =>
        String(violation).includes('劇本必帶卡')
      )
    };
  }

  function validateBreedingDeck(deck, inventory, rules, options = {}) {
    const deckRules = rules.breedingDeck;
    const owned = deck.filter(card => !card.borrowed);
    const borrowed = deck.filter(card => card.borrowed);
    const violations = [];
    if (deck.length !== deckRules.totalSlots) {
      violations.push(`配卡必須正好 ${deckRules.totalSlots} 張`);
    }
    if (owned.length !== deckRules.ownedSlots) {
      violations.push(`必須使用 ${deckRules.ownedSlots} 張自有卡`);
    }
    if (borrowed.length !== deckRules.borrowedSlots) {
      violations.push(`必須借用 ${deckRules.borrowedSlots} 張支援卡`);
    }
    if (owned.some(card => !isCardOwned(card, inventory, rules))) {
      violations.push('自有卡位包含未持有的支援卡');
    }
    const cards = [...owned, ...borrowed].filter(Boolean);
    const cardIds = cards.map(card => String(card.id));
    if (new Set(cardIds).size !== cardIds.length) {
      violations.push('同一張支援卡不可重複');
    }
    const characterIds = cards
      .map(card => Number(card.characterId))
      .filter(Number.isFinite);
    if (new Set(characterIds).size !== characterIds.length) {
      violations.push('同一支援角色不可重複');
    }
    const targetCharacterId = Number(options.battleUma?.characterId ?? options.targetCharacterId);
    if (Number.isFinite(targetCharacterId) && cards.some(card =>
      Number(card.characterId) === targetCharacterId
    )) {
      violations.push('不得使用育成角色同角色支援卡');
    }
    if (cards.some(card => !cardAvailableOnServer(card, options))) {
      violations.push('支援卡不在目前伺服器可用');
    }
    const scenario = normalizeScenarioConstraint(options.scenario);
    const requiredScenarioIds = scenarioRequiredCardIds(scenario);
    if (requiredScenarioIds.length) {
      const scenarioCatalog = options.catalog || options.supportCatalog || [];
      const availableRequiredCards = requiredScenarioIds
        .map(id => scenarioRequiredCard(scenario, scenarioCatalog, id))
        .filter(card => card && cardAvailableOnServer(card, options));
      if (!availableRequiredCards.length) {
        violations.push(`劇本必帶卡候選在目前伺服器／資料來源皆不可用：${requiredScenarioIds.join(', ')}`);
      }
      const matches = cards.filter(card => requiredScenarioIds.includes(Number(card.id)));
      if (matches.length !== 1) {
        violations.push(`劇本必帶卡必須精確包含其中一張 ID：${requiredScenarioIds.join(', ')}`);
      }
      const availableRequiredIds = availableRequiredCards.map(card => Number(card.id));
      const explicitRequiredIds = availableRequiredIds.filter(id =>
        Boolean(inventoryEntryFor(inventory, id))
      );
      const ownedMatches = owned.filter(card => explicitRequiredIds.includes(Number(card.id)));
      const borrowedMatches = borrowed.filter(card => requiredScenarioIds.includes(Number(card.id)));
      if (explicitRequiredIds.length) {
        if (!ownedMatches.length) {
          violations.push(`劇本必帶卡 ${explicitRequiredIds.join(', ')} 持有時必須占自有卡位`);
        }
        if (borrowedMatches.length) {
          violations.push('持有劇本必帶卡時不可改借同一張卡');
        }
      } else if (!borrowedMatches.length) {
        violations.push(`未持有劇本必帶卡，唯一借卡必須是 ${requiredScenarioIds.join(', ')}`);
      }
      for (const card of borrowedMatches) {
        const maxLevel = maxBorrowLevel(card.rarity);
        if (card.borrowedAtMax !== true || Number(card.limitBreak) !== 4
          || Number(card.level) !== Number(maxLevel)) {
          violations.push(`劇本必帶借卡 ${card.id} 必須滿突滿等`);
        }
      }
      if (owned.some(card => requiredScenarioIds.includes(Number(card.id))
        && !inventoryEntryFor(inventory, card.id))) {
        violations.push('未列入明確 inventory 的劇本卡不可占自有卡位');
      }
    }
    for (const requirement of deckRules.requiredSupportTypes || []) {
      const count = deck.filter(card => card.supportType === requirement.type).length;
      if (count < requirement.minimum) {
        violations.push(`${requirement.type} 支援卡至少需要 ${requirement.minimum} 張`);
      }
    }
    return {
      valid: violations.length === 0,
      violations,
      ownedCount: owned.length,
      borrowedCount: borrowed.length,
      speedCount: deck.filter(card => card.supportType === 'Speed').length
    };
  }

  return {
    cardScore,
    isCardOwned,
    normalizeScenarioConstraint,
    normalizeSupportType,
    supportPool,
    buildBreedingDeck,
    buildSkillDrivenBreedingDeck,
    validateBreedingDeck
  };
});
