(function (root, factory) {
  const skillCore = typeof module !== 'undefined' && module.exports
    ? require('./skill-core.js')
    : root?.SKILL_CORE;
  const api = factory(skillCore);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GUIDED_PLANNER_CORE = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (skillCore) {
  function numericId(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function uniqueIds(values) {
    return [...new Set((values || []).map(numericId).filter(Number.isFinite))];
  }

  function normalizeSupportType(type) {
    return type === 'intelligence' ? 'Wisdom' : type;
  }

  function skillMap(catalog) {
    return new Map((catalog?.skills || []).map(skill => [Number(skill.id), skill]));
  }

  function familyIdsForSkill(value, catalog, extraIds = []) {
    const id = numericId(typeof value === 'object' ? value?.id : value);
    const skill = typeof value === 'object' ? value : skillMap(catalog).get(id);
    return uniqueIds([
      ...(skill?.familyIds || []),
      skill?.familyId,
      skill?.id,
      ...extraIds
    ]);
  }

  function skillEffects(skill) {
    return (skill?.conditionGroups || []).flatMap(group => group.effects || []);
  }

  function hasAcceleration(skill) {
    const source = skill?.geneVersion || skill;
    return skillEffects(source).some(effect => Number(effect.type) === 31 && Number(effect.value) > 0);
  }

  function usefulAccelerations(strategy, catalog) {
    const lookup = skillMap(catalog);
    const category = (strategy?.categories || [])
      .find(item => item.id === 'terminalAcceleration');
    const output = [];
    const seenFamilies = new Set();
    const skills = strategy?.profileOverride?.applied
      ? (category?.skills || []).filter(meta => meta.source === 'profile-override')
      : (category?.skills || []);
    for (const meta of skills) {
      const skill = lookup.get(Number(meta.id));
      if (!skill || !hasAcceleration(skill)) continue;
      const familyIds = familyIdsForSkill(skill, catalog, [meta.factorId]);
      const familyKey = String(skill.familyId || familyIds[0] || meta.id);
      if (seenFamilies.has(familyKey)) continue;
      seenFamilies.add(familyKey);
      output.push({
        id: Number(meta.id),
        factorId: Number.isFinite(Number(meta.factorId)) ? Number(meta.factorId) : null,
        familyId: Number(skill.familyId || familyIds[0] || meta.id),
        familyIds,
        name: skill.nameZhTw || skill.name || String(meta.id),
        factorName: meta.factorId ? lookup.get(Number(meta.factorId))?.nameZhTw || null : null,
        priority: meta.priority || '有效加速',
        effectLabel: meta.effectLabel || '',
        reason: meta.reason || '',
        sourceKind: meta.sourceKind || null,
        activationWindow: meta.activationWindow || '終盤'
      });
    }
    return output;
  }

  function coveredFamilyIds(skillIds, catalog) {
    const lookup = skillMap(catalog);
    return new Set(uniqueIds(skillIds).flatMap(id =>
      familyIdsForSkill(lookup.get(id) || id, catalog)
    ).map(String));
  }

  function remainingAccelerations(candidates, coveredSkillIds, catalog) {
    const covered = coveredFamilyIds(coveredSkillIds, catalog);
    return (candidates || []).filter(candidate =>
      !(candidate.familyIds || [candidate.id]).some(id => covered.has(String(id)))
    );
  }

  // Step 5 needs acquisition targets, not broad family aliases.  A support
  // card which offers a white skill is useful for that white factor route, but
  // is not proof that a same-family gold target is obtainable.
  function coverageTargetForCandidate(candidate, options = {}) {
    const directParent = candidate?.kind === 'direct-parent-unique'
      || candidate?.coverageTargetKind === 'direct-parent-unique'
      || candidate?.sourceKind === 'parent-unique';
    const requiredSkillId = numericId(directParent
      ? candidate?.coverageTargetSkillId ?? candidate?.id
      : candidate?.coverageTargetSkillId ?? candidate?.factorId ?? candidate?.id);
    if (requiredSkillId === null) return null;
    const explicitWeight = Number(candidate?.weight);
    const residualWeight = Number(candidate?.need?.residualWeight ?? candidate?.residualWeight);
    const weight = Number.isFinite(explicitWeight) && explicitWeight > 0
      ? explicitWeight
      : Number.isFinite(residualWeight) && residualWeight > 0
        ? residualWeight
        : Math.max(0, Number(options.defaultWeight) || 1);
    const inheritedAvailable = candidate?.inheritedAvailable == null
      ? candidate?.routeImpactVariant === 'inherited' || candidate?.inheritedImpact != null
      : Boolean(candidate.inheritedAvailable);
    const kind = directParent ? 'direct-parent-unique' : 'factor';
    return {
      id: requiredSkillId,
      requiredSkillId,
      kind,
      sourceKind: directParent ? 'parent-unique' : candidate?.sourceKind || null,
      directParent,
      // Skill-impact-core emits this list from geneVersion.parentSkillIds.
      // Keep the original unique as a compatibility fallback for old tables.
      inheritedParentSkillIds: uniqueIds([
        ...(candidate?.inheritedParentSkillIds || []),
        ...(candidate?.parentSkillIds || []),
        directParent ? candidate?.id : null
      ]),
      requiresInheritedParent: directParent,
      inheritedAvailable,
      familyId: numericId(candidate?.familyId),
      familyIds: uniqueIds(candidate?.familyIds || []),
      label: candidate?.factorName || candidate?.nameZhTw || candidate?.name || String(requiredSkillId),
      weight,
      sourceCandidateIds: uniqueIds([
        candidate?.id,
        candidate?.sourceSkillId,
        candidate?.factorId
      ])
    };
  }

  function buildCoverageTargets(options = {}) {
    const accelerationCandidates = options.accelerationCandidates
      || options.accelerations
      || options.selectedAccelerationCandidates
      || [];
    const greenCandidates = options.greenCandidates || options.greens || [];
    const inputs = [
      ...accelerationCandidates,
      ...greenCandidates.map(candidate => ({ ...candidate, sourceKind: candidate?.sourceKind || null }))
    ];
    const byKey = new Map();
    for (const candidate of inputs) {
      const target = coverageTargetForCandidate(candidate, options);
      if (!target) continue;
      const key = `${target.kind}:${target.requiredSkillId}`;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, { ...target, coverageKey: key, sourceTargets: [target] });
        continue;
      }
      const preferred = target.weight > existing.weight ? target : existing;
      byKey.set(key, {
        ...preferred,
        coverageKey: key,
        sourceTargets: [...existing.sourceTargets, target],
        duplicateCount: existing.sourceTargets.length + 1
      });
    }
    return [...byKey.values()].sort((left, right) =>
      right.weight - left.weight
      || left.requiredSkillId - right.requiredSkillId
    );
  }

  function parentSkillId(candidate) {
    return numericId(candidate?.skillId ?? candidate?.uniqueSkillId ?? candidate?.id);
  }

  function parentCharacterId(candidate) {
    return numericId(candidate?.characterId ?? candidate?.affinityKey);
  }

  function sameParentCharacter(left, right) {
    if (!left || !right) return false;
    const leftId = parentCharacterId(left);
    const rightId = parentCharacterId(right);
    if (leftId !== null && rightId !== null) return leftId === rightId;
    return Boolean(left.affinityKey && right.affinityKey && left.affinityKey === right.affinityKey);
  }

  function parentImpactForSkill(skillId, rows) {
    const id = numericId(skillId);
    if (id === null) return null;
    return (rows || []).find(row => [
      row?.id,
      row?.familyId,
      row?.factorId,
      ...(row?.familyIds || [])
    ].some(value => Number(value) === id)) || null;
  }

  function inheritedParentImpact(row) {
    if (row?.routeImpactVariant !== 'inherited' || !row.inheritedImpact) return null;
    const source = row.inheritedImpact;
    const expectedBashin = Number(source?.expectedBashin ?? row.expectedBashin);
    const riskAdjustedBashin = Number(
      source?.riskAdjustedBashin
      ?? row.routeBashin
      ?? row.riskAdjustedBashin
    );
    if (!Number.isFinite(expectedBashin) || !Number.isFinite(riskAdjustedBashin)) return null;
    if (expectedBashin <= 0 && riskAdjustedBashin <= 0) return null;
    return {
      expectedBashin: Math.max(0, expectedBashin),
      riskAdjustedBashin: Math.max(0, riskAdjustedBashin),
      conditionReliability: Number(
        source?.conditionReliability
        ?? row.conditionReliability
        ?? (expectedBashin > 0 ? riskAdjustedBashin / expectedBashin : 0)
      ),
      activationWindow: row.activationWindow || source?.activationWindow || '賽道有效區段',
      reason: row.reason || '',
      impactSource: row.impactSource || source?.source || 'course-impact',
      valueSource: 'course-impact'
    };
  }

  function rankParentCandidates(candidates, options = {}) {
    const targetCharacterId = numericId(options.targetCharacterId);
    const rows = options.impactRows || [];
    const residualRows = options.residualRows || [];
    return (candidates || [])
      .map(candidate => {
        const skillId = parentSkillId(candidate);
        const row = parentImpactForSkill(skillId, rows);
        const impact = inheritedParentImpact(row);
        const proxyBashin = Math.max(0, Number(candidate.proxyBashin) || 0);
        const proxyReliability = Math.max(0, Math.min(1, Number(candidate.proxyReliability) || 0));
        const proxyScore = Math.max(0, Number(candidate.proxyScore) || proxyBashin * 100);
        const originalFallback = row?.routeImpactVariant === 'original-fallback';
        const valueSource = impact?.valueSource
          || (originalFallback ? 'original-impact-fallback' : 'proxy');
        const courseScore = impact
          ? impact.riskAdjustedBashin * 1000 + impact.expectedBashin * 80
          : proxyScore;
        // A course-impact number describes a possible inherited result, not an
        // unconditional recommendation.  Audited race profiles can explicitly
        // rank reliable direct parents above high-variance fallback uniques.
        // Keep this opt-in so generic races retain the course/proxy ordering.
        const configuredRank = Number(
          candidate.strategyRank ?? candidate.rank ?? candidate.order
        );
        const strategyRank = Number.isFinite(configuredRank) && configuredRank > 0
          ? configuredRank
          : null;
        const configuredWeight = Number(candidate.strategyWeight);
        const strategyWeight = Number.isFinite(configuredWeight)
          ? configuredWeight
          : 0;
        const strategyPriorityScore = strategyRank === null
          ? 0
          : Math.max(0, 100000 - strategyRank * 1000) + strategyWeight * 50;
        const aptitudeCost = Math.max(0, Number(candidate.aptitudeCost) || 0);
        const candidateSkillIds = new Set([
          skillId,
          candidate.uniqueSkillId,
          ...(candidate.familyIds || [])
        ].map(Number).filter(Number.isFinite).map(String));
        const residualMatches = residualRows.filter(row => [
          row.familyId,
          ...(row.familyIds || []),
          row.id
        ].map(Number).filter(Number.isFinite).some(id => candidateSkillIds.has(String(id))));
        const residualScore = residualMatches.reduce((sum, row) =>
          sum + Math.max(0, Number(row.priority) || 0) * 0.18, 0);
        const inheritedReasonBase = impact?.reason
          || (originalFallback
            ? `原固有賽道值代理／非繼承版；${candidate.proxyReason || candidate.detail || '改用條件可靠度與效果代理排序'}`
            : candidate.proxyReason || candidate.detail || '未對到本場固有／geneVersion，改用條件代理');
        const inheritedReason = [
          inheritedReasonBase,
          residualMatches.length ? `卡組後剩餘 ${residualMatches.length} 個技能家族缺口` : ''
        ].filter(Boolean).join('；');
        return {
          ...candidate,
          parentSkillId: skillId,
          impactRow: row,
          inheritedBenefitBashin: impact?.riskAdjustedBashin ?? proxyBashin,
          inheritedExpectedBashin: impact?.expectedBashin ?? proxyBashin,
          inheritedReliability: impact?.conditionReliability ?? proxyReliability,
          inheritedActivationWindow: impact?.activationWindow || candidate.activationWindow || '條件代理',
          inheritedReason,
          inheritedValueSource: valueSource,
          inheritedValueLabel: valueSource === 'course-impact'
            ? '繼承版 course impact'
            : valueSource === 'original-impact-fallback'
              ? '原固有賽道值代理／非繼承版'
              : '條件效果代理',
          parentResidualMatches: residualMatches.map(row => Number(row.familyId || row.id)),
          parentResidualScore: Math.round(residualScore * 100) / 100,
          strategyRank,
          strategyWeight,
          strategyPriorityScore,
          parentRankScore: strategyPriorityScore + courseScore + residualScore - aptitudeCost * 25
        };
      })
      .filter(candidate => Number.isFinite(Number(candidate.parentSkillId)))
      .filter(candidate => targetCharacterId === null
        || Number(candidate.characterId) !== targetCharacterId)
      .sort((left, right) =>
        right.parentRankScore - left.parentRankScore
        || right.inheritedBenefitBashin - left.inheritedBenefitBashin
        || String(left.nameZhTw || left.name || '').localeCompare(
          String(right.nameZhTw || right.name || ''),
          'zh-Hant'
        )
        || Number(left.parentSkillId) - Number(right.parentSkillId)
      );
  }

  function selectDistinctParentRecommendations(ranked, limit = 2) {
    const selected = [];
    for (const candidate of ranked || []) {
      if (selected.some(existing => sameParentCharacter(existing, candidate))) continue;
      selected.push(candidate);
      if (selected.length >= limit) break;
    }
    return selected;
  }

  function parentPairIsValid(main, sub, candidates, targetCharacterId) {
    const targetId = numericId(targetCharacterId);
    const pool = candidates || [];
    const selected = [main, sub];
    if (selected.some(candidate => !candidate)) return false;
    if (targetId !== null && selected.some(candidate =>
      Number(candidate.characterId) === targetId
    )) return false;
    if (sameParentCharacter(main, sub)) return false;
    return selected.every(candidate => pool.some(item =>
      Number(parentSkillId(item)) === Number(parentSkillId(candidate))
    ));
  }

  function greenPriority(name) {
    if (/順時針|逆時針/.test(name)) return 0;
    if (/春賽馬娘|夏賽馬娘|秋賽馬娘|冬賽馬娘/.test(name)) return 1;
    if (/賽場○/.test(name)) return 2;
    if (/主要距離|非主要距離/.test(name)) return 3;
    if (/良好場地|路況差勁/.test(name)) return 4;
    if (/晴天|陰天|雨天|雪天/.test(name)) return 5;
    return 9;
  }

  function recommendedGreenSkills(strategy, catalog, limit = 3) {
    const lookup = skillMap(catalog);
    const activeIds = new Set(uniqueIds(strategy?.staticSkillIds).map(String));
    const category = (strategy?.categories || []).find(item => item.id === 'green');
    const output = [];
    const seenFamilies = new Set();
    for (const [index, meta] of (category?.skills || []).entries()) {
      const skill = lookup.get(Number(meta.id));
      if (!skill || !activeIds.has(String(skill.id))) continue;
      if (!/○$/.test(skill.nameZhTw || skill.name || '')) continue;
      const isStatGreen = skillEffects(skill).some(effect =>
        [1, 2, 3, 4, 5, 32].includes(Number(effect.type)) && Number(effect.value) > 0
      );
      if (!isStatGreen) continue;
      const familyIds = familyIdsForSkill(skill, catalog, [meta.factorId]);
      const familyKey = String(skill.familyId || familyIds[0] || skill.id);
      if (seenFamilies.has(familyKey)) continue;
      seenFamilies.add(familyKey);
      output.push({
        id: Number(skill.id),
        factorId: Number.isFinite(Number(meta.factorId)) ? Number(meta.factorId) : Number(skill.id),
        familyId: Number(skill.familyId || familyIds[0] || skill.id),
        familyIds,
        name: skill.nameZhTw || skill.name,
        effectLabel: meta.effectLabel || skill.descriptionZhTw || '',
        reason: meta.reason || '本場固定條件成立，可作為三綠啟動技能。',
        order: greenPriority(skill.nameZhTw || skill.name || '') * 100 + index
      });
    }
    return output.sort((a, b) => a.order - b.order || a.id - b.id).slice(0, limit);
  }

  function supportFamilyCoverage(card, target, catalog) {
    const targetFamilies = new Set((target.familyIds || [target.id]).map(String));
    return uniqueIds([...(card?.hintSkillIds || []), ...(card?.eventSkillIds || [])])
      .some(id => familyIdsForSkill(id, catalog).some(familyId => targetFamilies.has(String(familyId))));
  }

  function borrowedMaxLevel(rarity) {
    return { R: 40, SR: 45, SSR: 50 }[rarity] || null;
  }

  function supportProfileMap(profileCatalog) {
    if (profileCatalog instanceof Map) return profileCatalog;
    if (Array.isArray(profileCatalog)) {
      return new Map(profileCatalog.map(profile => [Number(profile.id), profile]));
    }
    if (Array.isArray(profileCatalog?.profiles)) {
      return new Map(profileCatalog.profiles.map(profile => [Number(profile.id), profile]));
    }
    return new Map(Object.entries(profileCatalog || {}).map(([id, profile]) => [
      Number(id),
      { ...profile, id: Number(profile?.id ?? id) }
    ]));
  }

  function combineSupportEffect(current, added, effectType) {
    const base = Number(current) || 0;
    const value = Number(added) || 0;
    if ([1, 27, 28].includes(Number(effectType))) {
      return base + value + base * value / 100;
    }
    return base + value;
  }

  function addSupportEffect(effects, type, value) {
    const id = Number(type);
    const amount = Number(value);
    if (!Number.isFinite(id) || !Number.isFinite(amount)) return;
    effects[id] = combineSupportEffect(effects[id], amount, id);
  }

  function customUniqueEffects(effect, effects, deckTypeCount) {
    const type = Number(effect?.type);
    if (type >= 1 && type <= 41) {
      addSupportEffect(effects, type, effect.value);
      return;
    }
    if (type === 101) {
      addSupportEffect(effects, effect.value_1, effect.value_2);
      if (effect.value_3) addSupportEffect(effects, effect.value_3, effect.value_4);
      return;
    }
    if (type === 102) {
      // Off-specialty conditional training is useful, but not active every turn.
      addSupportEffect(effects, 8, Number(effect.value_1) * 0.55);
      return;
    }
    if (type === 103) {
      if (deckTypeCount >= Number(effect.value)) addSupportEffect(effects, 8, effect.value_1);
      return;
    }
    if (type === 104) {
      addSupportEffect(effects, 8, Number(effect.value_1) * 0.8);
      return;
    }
    if (type === 106) {
      addSupportEffect(effects, effect.value_1, Number(effect.value) * Number(effect.value_2));
      return;
    }
    if (type === 109) {
      addSupportEffect(effects, effect.value, 16);
      return;
    }
    if ([110, 111].includes(type)) {
      addSupportEffect(effects, effect.value, Number(effect.value_1) * 4);
      return;
    }
    if (type === 113) {
      addSupportEffect(effects, effect.value, Number(effect.value_1) * 0.7);
      return;
    }
    if (type === 114) {
      addSupportEffect(
        effects,
        effect.value,
        (Number(effect.value_1) + Number(effect.value_2)) / 2
      );
      return;
    }
    if (type === 115) {
      addSupportEffect(effects, effect.value, effect.value_1);
      return;
    }
    if (type === 116) {
      addSupportEffect(
        effects,
        effect.value_1,
        Number(effect.value_2) * Number(effect.value_3) * 0.7
      );
      return;
    }
    if (type === 117) {
      addSupportEffect(effects, effect.value, Number(effect.value_2) * 0.8);
    }
  }

  function resolvedSupportEffects(card, profile, selectedCards) {
    if (!profile) return null;
    // This private reader is used only for borrowed candidates. Owned-card
    // actual level/LB evaluation belongs to the deck optimizer, not this path.
    const borrowedLevel = borrowedMaxLevel(card.rarity) || Number(profile.maxLevel);
    const maximumSnapshot = profile.effectsByLimitBreak?.[4];
    const baseEffects = maximumSnapshot?.effects || profile.effects;
    if (!baseEffects || typeof baseEffects !== 'object' || Array.isArray(baseEffects)
      || !Object.keys(baseEffects).length) return null;
    const effects = {};
    for (const [type, value] of Object.entries(baseEffects)) {
      addSupportEffect(effects, type, value);
    }
    const deckTypeCount = new Set(
      [...(selectedCards || []), card]
        .map(item => normalizeSupportType(item?.supportType))
        .filter(Boolean)
    ).size;
    const unique = profile.unique?.raw || profile.unique;
    if (unique && Number(unique.level || 1) <= borrowedLevel) {
      for (const effect of unique.effects || []) {
        customUniqueEffects(effect, effects, deckTypeCount);
      }
    }
    return { effects, deckTypeCount };
  }

  function panelScore(card, profile, selectedCards) {
    const resolved = resolvedSupportEffects(card, profile, selectedCards);
    if (!resolved) {
      return {
        score: ({ SSR: 60, SR: 30, R: 10 })[card.rarity] || 0,
        profileAvailable: false,
        effects: {},
        deckTypeCount: 0
      };
    }
    const effects = resolved.effects;
    const supportType = normalizeSupportType(card.supportType);
    const mainBonusType = {
      Speed: 3,
      Stamina: 4,
      Power: 5,
      Guts: 6,
      Wisdom: 7
    }[supportType];
    const initialMainType = {
      Speed: 9,
      Stamina: 10,
      Power: 11,
      Guts: 12,
      Wisdom: 13
    }[supportType];
    const statBonusTypes = [3, 4, 5, 6, 7];
    const otherStatBonuses = statBonusTypes
      .filter(type => type !== mainBonusType)
      .reduce((sum, type) => sum + (Number(effects[type]) || 0), 0);
    const initialStatTotal = [9, 10, 11, 12, 13]
      .reduce((sum, type) => sum + (Number(effects[type]) || 0), 0);
    const score =
      (Number(effects[8]) || 0) * 16
      + (Number(effects[1]) || 0) * 6
      + (Number(effects[19]) || 0) * 2.2
      + (Number(effects[mainBonusType]) || 0) * 90
      + otherStatBonuses * 35
      + (Number(effects[30]) || 0) * 90
      + (Number(effects[2]) || 0) * 1.5
      + (Number(effects[14]) || 0) * 1.5
      + (Number(effects[15]) || 0) * 3
      + (Number(effects[initialMainType]) || 0) * 0.5
      + Math.max(0, initialStatTotal - (Number(effects[initialMainType]) || 0)) * 0.2
      + (Number(effects[17]) || 0) * 10
      + (Number(effects[18]) || 0) * 0.25
      + (Number(effects[31]) || 0) * 10;
    return {
      score: Math.round(score),
      profileAvailable: true,
      effects,
      deckTypeCount: resolved.deckTypeCount
    };
  }

  function supportCoverageRoute(card, target, catalog) {
    const targetFamilies = new Set((target.familyIds || [target.id]).map(String));
    const matches = ids => uniqueIds(ids).some(id =>
      familyIdsForSkill(id, catalog).some(familyId => targetFamilies.has(String(familyId)))
    );
    if (matches(card?.eventSkillIds)) return { route: 'event', reliability: 0.8 };
    if (matches(card?.hintSkillIds)) return { route: 'hint', reliability: 0.65 };
    return null;
  }

  function skillEffectsForRecovery(skill) {
    return (skill?.conditionGroups || []).flatMap(group => group.effects || [])
      .filter(effect => Number(effect.type) === 9 && Number(effect.value) > 0);
  }

  function skillTagsCompatible(skill, context) {
    const tags = new Set(skill?.tags || []);
    const styleTags = ['run', 'ldr', 'btw', 'cha'].filter(tag => tags.has(tag));
    if (styleTags.length && !tags.has('run')) return false;
    const wantedDistance = { 1: 'sho', 2: 'mil', 3: 'med', 4: 'lng' }[
      Number(context?.distance_type)
    ];
    const distanceTags = ['sho', 'mil', 'med', 'lng'].filter(tag => tags.has(tag));
    if (distanceTags.length && wantedDistance && !tags.has(wantedDistance)) return false;
    const wantedGround = { 1: 'tur', 2: 'dir' }[Number(context?.ground_type)];
    const groundTags = ['tur', 'dir'].filter(tag => tags.has(tag));
    return !(groundTags.length && wantedGround && !tags.has(wantedGround));
  }

  function usableGoldRecovery(skill, context) {
    // The stamina plan's "gold recovery" slots refer to purchasable rarity-2
    // recovery skills. Character uniques/evolutions are separate recovery value.
    if (!skill || Number(skill.rarity) !== 2 || !skillEffectsForRecovery(skill).length) return false;
    if (!skillTagsCompatible(skill, context)) return false;
    return !skillCore
      || skillCore.evaluateSkillForContext(skill, context || {}) !== skillCore.FALSE;
  }

  function recoveryQualityMap(plan, catalog) {
    const lookup = skillMap(catalog);
    const output = new Map();
    const tierValue = { S: 1, A: 0.82, B: 0.65, C: 0.45 };
    for (const group of plan?.quality || []) {
      const quality = tierValue[group.tier] ?? 0.65;
      for (const id of uniqueIds(group.skillIds)) {
        for (const familyId of familyIdsForSkill(lookup.get(id) || id, catalog)) {
          output.set(String(familyId), Math.max(output.get(String(familyId)) || 0, quality));
        }
      }
    }
    return output;
  }

  function goldRecoveryRoutes(card, plan, catalog) {
    const lookup = skillMap(catalog);
    const quality = recoveryQualityMap(plan, catalog);
    const routes = [];
    const seenFamilies = new Set();
    for (const id of uniqueIds(card?.eventSkillIds)) {
      const skill = lookup.get(id);
      if (!usableGoldRecovery(skill, plan?.context || {})) continue;
      const familyId = String(skill.familyId || familyIdsForSkill(skill, catalog)[0] || id);
      if (seenFamilies.has(familyId)) continue;
      const rankedQuality = quality.size ? quality.get(familyId) : 0.65;
      if (!rankedQuality) continue;
      seenFamilies.add(familyId);
      routes.push({
        id: Number(skill.id),
        familyId: Number(familyId),
        name: skill.nameZhTw || skill.name || String(skill.id),
        quality: rankedQuality,
        recoveryValue: Math.max(...skillEffectsForRecovery(skill).map(effect => Number(effect.value)))
      });
    }
    return routes.sort((a, b) => b.quality - a.quality || b.recoveryValue - a.recoveryValue);
  }

  function coveredRecoveryFamilies(cards, skillIds, plan, catalog) {
    const lookup = skillMap(catalog);
    const covered = new Set();
    for (const id of uniqueIds(skillIds)) {
      const skill = lookup.get(id);
      if (usableGoldRecovery(skill, plan?.context || {})) {
        covered.add(String(skill.familyId || familyIdsForSkill(skill, catalog)[0] || id));
      }
    }
    for (const card of cards || []) {
      for (const route of goldRecoveryRoutes(card, plan, catalog)) {
        covered.add(String(route.familyId));
      }
    }
    return covered;
  }

  function recommendBorrowedSupports(options = {}) {
    const catalog = options.catalog || {};
    const profiles = supportProfileMap(options.supportProfiles);
    const selectedIds = uniqueIds(options.selectedOwnedCardIds);
    const selectedSet = new Set(selectedIds.map(String));
    const supportLookup = new Map((catalog.supports || []).map(card => [Number(card.id), card]));
    const selectedCards = selectedIds.map(id => supportLookup.get(id)).filter(Boolean);
    const validOwnedSelection = selectedIds.length === 5 && selectedCards.length === 5;
    if (!validOwnedSelection) {
      return { ready: false, candidates: [], scoreMode: 'skill-recovery-panel' };
    }

    const targets = (options.targets || []).map((target, index) => {
      const explicitWeight = Number(target.weight);
      return {
        ...target,
        id: Number(target.id),
        familyIds: uniqueIds(target.familyIds || [target.id]),
        weight: Number.isFinite(explicitWeight) && explicitWeight > 0
          ? explicitWeight
          : Math.max(100, 1000 - index * 100)
      };
    });
    const selectedCovered = new Set();
    for (const target of targets) {
      if (selectedCards.some(card => supportFamilyCoverage(card, target, catalog))) {
        selectedCovered.add(String(target.id));
      }
    }
    const targetTypes = options.targetTypes || [];
    const desiredTypeCount = targetTypes.reduce((map, type) => {
      const normalized = normalizeSupportType(type);
      map.set(normalized, (map.get(normalized) || 0) + 1);
      return map;
    }, new Map());
    const selectedTypeCount = selectedCards.reduce((map, card) => {
      const normalized = normalizeSupportType(card.supportType);
      map.set(normalized, (map.get(normalized) || 0) + 1);
      return map;
    }, new Map());

    const requiredBorrowType = options.requiredBorrowType
      ? normalizeSupportType(options.requiredBorrowType)
      : null;
    const recoveryPlan = options.recoveryPlan || {};
    const requiredGoldRecovery = Math.max(0, Number(recoveryPlan.requiredGold) || 0);
    const coveredRecovery = coveredRecoveryFamilies(
      selectedCards,
      recoveryPlan.preCoveredSkillIds,
      recoveryPlan,
      catalog
    );
    const recoveryDeficit = Math.max(0, requiredGoldRecovery - coveredRecovery.size);
    const candidates = (catalog.supports || [])
      .filter(card => !selectedSet.has(String(card.id)))
      .filter(card => !Number.isFinite(Number(options.targetCharacterId))
        || Number(card.characterId) !== Number(options.targetCharacterId))
      .filter(card =>
        !requiredBorrowType
        || normalizeSupportType(card.supportType) === requiredBorrowType
      )
      .map(card => {
        const supportType = normalizeSupportType(card.supportType);
        const coveredTargets = targets.map(target => ({
          target,
          coverage: supportCoverageRoute(card, target, catalog)
        })).filter(item =>
          !selectedCovered.has(String(item.target.id))
          && item.coverage
        );
        const skillScore = Math.round(coveredTargets.reduce(
          (sum, item) => sum + item.target.weight * item.coverage.reliability,
          0
        ));
        const typeNeed = Math.max(
          0,
          (desiredTypeCount.get(supportType) || 0) - (selectedTypeCount.get(supportType) || 0)
        );
        const typeScore = typeNeed * 250;
        const panel = panelScore(card, profiles.get(Number(card.id)), selectedCards);
        const recoveryRoutes = goldRecoveryRoutes(card, recoveryPlan, catalog)
          .filter(route => !coveredRecovery.has(String(route.familyId)))
          .slice(0, recoveryDeficit);
        const recoveryScore = Math.round(recoveryRoutes.reduce(
          (sum, route) => sum + 1400 * route.quality,
          0
        ));
        const reasons = [];
        if (coveredTargets.length) {
          reasons.push(`補上 ${coveredTargets.map(item => item.target.name).join('、')}`);
        }
        if (recoveryRoutes.length) {
          reasons.push(
            `金回復「${recoveryRoutes.map(route => route.name).join('、')}」`
            + `補足 ${requiredGoldRecovery} 金回門檻`
          );
        }
        if (typeNeed) reasons.push(`補齊 ${supportType} 卡型缺口`);
        if (panel.profileAvailable) reasons.push(`滿突育成面板 ${panel.score} 分`);
        if (!reasons.length) {
          reasons.push(targets.length === 0
            ? '所選加速走親代固有路線，借卡改補育成面板'
            : selectedCovered.size === targets.length
              ? '所選加速已由五張自有卡覆蓋，改補育成面板'
              : '本地卡表沒有對應技能來源，借卡改補育成面板');
        }
        return {
          ...card,
          supportType,
          borrowed: true,
          borrowedAtMax: true,
          level: borrowedMaxLevel(card.rarity),
          limitBreak: 4,
          coveredTargetIds: coveredTargets.map(item => item.target.id),
          skillScore,
          recoveryScore,
          panelScore: panel.score,
          panelEffects: panel.effects,
          panelProfileAvailable: panel.profileAvailable,
          activeDeckTypeCount: panel.deckTypeCount,
          goldRecoveryRoutes: recoveryRoutes,
          recoveryDeficitBeforeBorrow: recoveryDeficit,
          typeScore,
          score: skillScore + recoveryScore + panel.score + typeScore,
          reason: reasons.join('；')
        };
      })
      .sort((a, b) => b.score - a.score || Number(a.id) - Number(b.id))
      .slice(0, Number(options.limit) || 3);

    return {
      ready: true,
      candidates,
      selectedCoveredTargetIds: [...selectedCovered].map(Number),
      requiredBorrowType,
      recoveryDeficit,
      scoreMode: 'skill-recovery-panel'
    };
  }

  return {
    familyIdsForSkill,
    hasAcceleration,
    usefulAccelerations,
    remainingAccelerations,
    coverageTargetForCandidate,
    buildCoverageTargets,
    parentSkillId,
    sameParentCharacter,
    rankParentCandidates,
    selectDistinctParentRecommendations,
    parentPairIsValid,
    recommendedGreenSkills,
    recommendBorrowedSupports
  };
});
