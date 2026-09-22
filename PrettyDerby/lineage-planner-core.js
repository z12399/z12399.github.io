(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LINEAGE_PLANNER_CORE = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const DIRECT_SLOTS = ['parentA', 'parentB'];
  const GRANDPARENT_SLOTS = ['parentA1', 'parentA2', 'parentB1', 'parentB2'];
  const PACKAGE_SLOTS = ['a1', 'a2', 'b1', 'b2'];
  const ZH_TW_G1_RULESET = Object.freeze({
    id: 'zh_tw-2024-06-27',
    server: 'zh_tw',
    effectiveDate: '2024-06-27',
    pointsPerSharedRace: 3,
    pointsStatus: 'COMMUNITY_OBSERVED'
  });
  const FACTOR_FLOW_TYPES = Object.freeze(['blue', 'red', 'white', 'green']);
  const FACTOR_REQUIREMENT_LEVELS = Object.freeze([
    'RULE_REQUIRED',
    'USER_REQUIRED',
    'RECOMMENDED',
    'OPTIONAL'
  ]);
  const DEFAULT_LINEAGE_DECISION_POLICY = Object.freeze({
    id: 'probabilistic-balanced-v1',
    principle: '先滿足可用與關鍵價值，再用相性、共同 G1 與周回便利性提高機率；不要求每一項同時完美。',
    hardRequirementLevels: ['RULE_REQUIRED', 'USER_REQUIRED'],
    projectedG1DefaultRequirementLevel: 'RECOMMENDED',
    stageWeights: {
      directParent: {
        courseScore: 8,
        courseBashin: 260,
        factorUtility: 0.18,
        baseAffinity: 12,
        aptitude: 15,
        g1Breadth: 10,
        owned: 120
      },
      grandparent: {
        courseScore: 4,
        courseBashin: 120,
        factorUtility: 1.2,
        parentAffinity: 10,
        targetAffinity: 3,
        aptitude: 14,
        g1Breadth: 9,
        sourceBreadth: 5,
        owned: 100
      },
      foundation: {
        nativeG1: 420,
        redExpandedG1: 180,
        g1RouteNative: 240,
        g1RouteGoalAlignment: 140,
        g1RouteGoalConflict: -700,
        g1RouteRedStarCost: -35,
        childAffinity: 50,
        targetAffinity: 20,
        factorUtility: 8,
        redAxisCost: -150,
        aptitude: 5,
        owned: 25
      }
    }
  });

  function number(value, fallback = null) {
    if (value === null || value === undefined || value === '') return fallback;
    const result = Number(value);
    return Number.isFinite(result) ? result : fallback;
  }

  function text(value, fallback = '') {
    const result = value == null ? '' : String(value).trim();
    return result || fallback;
  }

  function uniqueNumbers(values) {
    return [...new Set((values || []).map(Number).filter(Number.isFinite))];
  }

  function values(value) {
    if (Array.isArray(value)) return value;
    return value === null || value === undefined ? [] : [value];
  }

  function hasOwn(value, key) {
    return Object.prototype.hasOwnProperty.call(value || {}, key);
  }

  function uniqueTexts(input) {
    const source = Array.isArray(input) ? input.flat(Infinity) : [input];
    return [...new Set(source.map(value => text(value)).filter(Boolean))];
  }

  function requirementLevel(value, fallback = 'RECOMMENDED') {
    const candidate = text(value).toUpperCase();
    return FACTOR_REQUIREMENT_LEVELS.includes(candidate) ? candidate : fallback;
  }

  function normalizeDecisionPolicy(raw = {}) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const weights = source.stageWeights && typeof source.stageWeights === 'object'
      ? source.stageWeights
      : {};
    const mergeWeights = stage => ({
      ...DEFAULT_LINEAGE_DECISION_POLICY.stageWeights[stage],
      ...(weights[stage] && typeof weights[stage] === 'object' ? weights[stage] : {})
    });
    const hardRequirementLevels = uniqueTexts(
      source.hardRequirementLevels ?? DEFAULT_LINEAGE_DECISION_POLICY.hardRequirementLevels
    )
      .map(value => value.toUpperCase())
      .filter(value => FACTOR_REQUIREMENT_LEVELS.includes(value));
    return {
      id: text(source.id, DEFAULT_LINEAGE_DECISION_POLICY.id),
      principle: text(source.principle, DEFAULT_LINEAGE_DECISION_POLICY.principle),
      hardRequirementLevels: hardRequirementLevels.length
        ? hardRequirementLevels
        : [...DEFAULT_LINEAGE_DECISION_POLICY.hardRequirementLevels],
      projectedG1DefaultRequirementLevel: requirementLevel(
        source.projectedG1DefaultRequirementLevel
        ?? source.handoffPolicy?.projectedG1DefaultRequirementLevel,
        DEFAULT_LINEAGE_DECISION_POLICY.projectedG1DefaultRequirementLevel
      ),
      stageWeights: {
        directParent: mergeWeights('directParent'),
        grandparent: mergeWeights('grandparent'),
        foundation: mergeWeights('foundation')
      }
    };
  }

  function isHardRequirement(value, policy) {
    return (policy?.hardRequirementLevels || DEFAULT_LINEAGE_DECISION_POLICY.hardRequirementLevels)
      .includes(requirementLevel(value));
  }

  function weightedEvaluation(rawValues, weights) {
    const raw = Object.fromEntries(Object.entries(rawValues || {}).map(([key, value]) => [
      key,
      Number.isFinite(Number(value)) ? Number(value) : 0
    ]));
    const components = Object.fromEntries(Object.entries(raw).map(([key, value]) => [
      key,
      value * (Number.isFinite(Number(weights?.[key])) ? Number(weights[key]) : 0)
    ]));
    return {
      total: Object.values(components).reduce((sum, value) => sum + value, 0),
      raw,
      components
    };
  }

  function flowFactorType(value, fallback = 'white') {
    const candidate = text(value).toLowerCase();
    return FACTOR_FLOW_TYPES.includes(candidate) ? candidate : fallback;
  }

  function cloneObject(value) {
    return value && typeof value === 'object' ? { ...value } : value;
  }

  function cloneValue(value) {
    if (Array.isArray(value)) return value.map(cloneValue);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneValue(item)]));
    }
    return value;
  }

  function normalizeRaceEvidence(raw) {
    if (raw === null || raw === undefined || raw === '') return null;
    if (typeof raw === 'number' || (typeof raw === 'string' && /^\d+$/.test(raw.trim()))) {
      return { legacyCatalogRaceId: number(raw), source: 'legacy-numeric-g1Wins' };
    }
    if (!raw || typeof raw !== 'object') return null;
    return {
      ...cloneObject(raw),
      catalogRaceId: number(raw.catalogRaceId ?? raw.catalogId ?? raw.id),
      canonicalRaceId: number(raw.canonicalRaceId ?? raw.raceId ?? raw.baseRaceId)
    };
  }

  function normalizeRaceEvidenceList(input) {
    return values(input).map(normalizeRaceEvidence).filter(Boolean);
  }

  function normalizeRedFactor(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const key = text(raw.key ?? raw.aptitudeKey ?? raw.type ?? raw.nameZhTw ?? raw.name);
    if (!key) return null;
    return {
      key,
      nameZhTw: text(raw.nameZhTw ?? raw.name, key),
      stars: Math.max(0, number(raw.stars ?? raw.star, 0))
    };
  }

  function normalizeFlowFactor(raw, type = 'white', index = 0) {
    if (raw === null || raw === undefined || raw === '') return null;
    const source = raw && typeof raw === 'object' ? raw : { key: raw, nameZhTw: raw };
    const id = number(source.id ?? source.factorId);
    const skillId = number(source.skillId ?? (type === 'white' ? source.id ?? source.factorId : null));
    const sourceStepIds = uniqueTexts([
      ...values(source.sourceStepIds),
      source.sourceStepId
    ]);
    const key = text(
      source.key
      ?? source.aptitudeKey
      ?? source.redFactorKey
      ?? source.type
      ?? source.nameZhTw
      ?? source.name
      ?? (Number.isFinite(skillId) ? String(skillId) : ''),
      ''
    );
    if (!key && !Number.isFinite(id) && !Number.isFinite(skillId)) return null;
    return {
      type,
      id,
      skillId,
      key,
      nameZhTw: text(source.nameZhTw ?? source.label ?? source.name, key || `${type} ${index + 1}`),
      stars: number(source.stars ?? source.star ?? source.level ?? source.requiredStars),
      requiredStars: number(source.requiredStars ?? source.minimumStars ?? source.minStars),
      suppliedStars: number(source.suppliedStars ?? source.availableStars ?? source.stars ?? source.star),
      collectiveRequiredStars: number(source.collectiveRequiredStars ?? source.groupRequiredStars),
      sourceStepId: sourceStepIds[0] || text(source.sourceStepId),
      sourceStepIds,
      targetStepId: text(source.targetStepId),
      targetStepIds: uniqueTexts([...(source.targetStepIds || []), source.targetStepId]),
      evidenceRecordId: text(source.evidenceRecordId ?? source.recordId),
      evidenceStatus: text(source.evidenceStatus),
      requirementLevel: requirementLevel(source.requirementLevel),
      requirementLevelProvided: hasOwn(source, 'requirementLevel'),
      status: text(source.status),
      note: text(source.note)
    };
  }

  function normalizeFlowFactorList(input, type = 'white') {
    if (input === null || input === undefined || input === '') return [];
    if (input && typeof input === 'object' && !Array.isArray(input)) {
      if (Array.isArray(input.items)) return normalizeFlowFactorList(input.items, type);
      if (Array.isArray(input.requirements)) return normalizeFlowFactorList(input.requirements, type);
      if (input.key !== undefined
        || input.type !== undefined
        || input.id !== undefined
        || input.skillId !== undefined
        || input.name !== undefined
        || input.nameZhTw !== undefined) {
        return [normalizeFlowFactor(input, type)].filter(Boolean);
      }
      if (input.byKey && typeof input.byKey === 'object') {
        return normalizeFlowFactorList(Object.values(input.byKey), type);
      }
      return Object.entries(input)
        .flatMap(([key, value]) => normalizeFlowFactor(
          value && typeof value === 'object' ? { ...value, key: value.key ?? key } : { key, stars: value },
          type
        ) || []);
    }
    const source = Array.isArray(input) ? input : [input];
    return source.flatMap((value, index) => normalizeFlowFactor(value, type, index) || []);
  }

  function normalizeCandidateFactorBundle(source) {
    const factors = source?.factors && typeof source.factors === 'object' ? source.factors : {};
    return {
      blue: normalizeFlowFactor(source?.blueFactor ?? factors.blue, 'blue'),
      red: normalizeFlowFactor(source?.redFactor ?? factors.red, 'red'),
      green: normalizeFlowFactor(source?.greenFactor ?? factors.green, 'green'),
      white: normalizeFlowFactorList(source?.whiteFactors ?? factors.white, 'white')
    };
  }

  function normalizeRedRequirements(input) {
    return values(input).map((raw, index) => {
      const source = raw && typeof raw === 'object' ? raw : { key: raw };
      const key = text(source.key ?? source.aptitudeKey ?? source.redFactorKey ?? source.type);
      if (!key) return null;
      return {
        key,
        label: text(source.nameZhTw ?? source.label, key),
        nativeRank: text(source.nativeRank ?? source.nativeAptitude),
        verifiedRank: text(source.verifiedRank ?? source.verifiedAptitude ?? source.confirmedRank),
        requestedRank: text(source.requestedRank ?? source.targetRank ?? source.requiredRank, 'A'),
        requiredForAutonomous: source.requiredForAutonomous !== false,
        order: index + 1
      };
    }).filter(Boolean);
  }

  function getBreederCore() {
    if (typeof globalThis !== 'undefined' && globalThis.BREEDER_CORE) return globalThis.BREEDER_CORE;
    if (typeof require === 'function') {
      try {
        return require('./breeder-core.js');
      } catch {
        return null;
      }
    }
    return null;
  }

  function normalizeCandidate(raw, index) {
    const source = raw && typeof raw === 'object' ? raw : {};
    return {
      id: text(source.id, `candidate-${index + 1}`),
      outfitId: number(source.outfitId ?? source.cardId),
      characterId: number(source.characterId),
      affinityKey: text(source.affinityKey ?? source.nameJp),
      nameZhTw: text(source.nameZhTw ?? source.name, `候選 ${index + 1}`),
      nameJp: text(source.nameJp),
      outfitTitleZhTw: text(source.outfitTitleZhTw ?? source.outfit ?? source.titleZhTw),
      imagePath: text(source.imagePath),
      uniqueSkillId: number(source.uniqueSkillId ?? source.skillId),
      uniqueSkillName: text(source.uniqueSkillName),
      aptitude: Array.isArray(source.aptitude)
        ? [...source.aptitude]
        : (source.aptitude && typeof source.aptitude === 'object' ? cloneValue(source.aptitude) : []),
      foundationG1Coverage: source.foundationG1Coverage && typeof source.foundationG1Coverage === 'object'
        ? cloneValue(source.foundationG1Coverage)
        : null,
      foundationG1RoutePlan: source.foundationG1RoutePlan && typeof source.foundationG1RoutePlan === 'object'
        ? cloneValue(source.foundationG1RoutePlan)
        : null,
      learnableSkillIds: uniqueNumbers([
        ...(source.learnableSkillIds || []),
        ...(source.builtInSkillIds || []),
        ...(source.eventSkillIds || [])
      ]),
      courseScore: Math.max(0, number(source.courseScore, 0)),
      courseBashin: Math.max(0, number(source.courseBashin, 0)),
      sourceBreadth: Math.max(0, number(source.sourceBreadth, 0)),
      aptitudeScore: Math.max(0, number(source.aptitudeScore, 0)),
      g1Breadth: Math.max(0, number(source.g1Breadth, 0)),
      g1Wins: normalizeRaceEvidenceList(
        source.g1Wins
        ?? source.confirmedG1Wins
        ?? source.g1RaceWins
      ),
      projectedG1Schedule: normalizeRaceEvidenceList(
        source.projectedG1Schedule
        ?? source.g1Schedule
        ?? source.scheduledG1Races
        ?? source.plannedG1Races
      ),
      redFactor: normalizeRedFactor(source.redFactor ?? source.factors?.red),
      redFactorRequirements: normalizeRedRequirements(source.redFactorRequirements ?? source.aptitudeRequirements),
      owned: source.owned !== false,
      buildNote: text(source.buildNote),
      metadata: source.metadata && typeof source.metadata === 'object'
        ? { ...source.metadata }
        : {}
    };
  }

  function normalizeTarget(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    return {
      outfitId: number(source.outfitId ?? source.id),
      characterId: number(source.characterId),
      affinityKey: text(source.affinityKey ?? source.nameJp),
      nameZhTw: text(source.nameZhTw ?? source.name, '目標戰馬'),
      outfitTitleZhTw: text(source.outfitTitleZhTw ?? source.titleZhTw),
      imagePath: text(source.imagePath),
      aptitude: Array.isArray(source.aptitude)
        ? [...source.aptitude]
        : (source.aptitude && typeof source.aptitude === 'object' ? cloneValue(source.aptitude) : []),
      foundationG1Coverage: source.foundationG1Coverage && typeof source.foundationG1Coverage === 'object'
        ? cloneValue(source.foundationG1Coverage)
        : null,
      foundationG1RoutePlan: source.foundationG1RoutePlan && typeof source.foundationG1RoutePlan === 'object'
        ? cloneValue(source.foundationG1RoutePlan)
        : null,
      aptitudeRequirements: normalizeRedRequirements(
        source.aptitudeRequirements
        ?? source.redFactorRequirements
      )
    };
  }

  function normalizeFactorTarget(raw, index) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const id = number(source.id ?? source.skillId);
    const weight = Math.max(0, number(source.weight, 1));
    const skillPointCost = Math.max(0, number(source.skillPointCost, 0));
    const factorProbability = Math.max(0, Math.min(1, number(source.factorProbability, 0.2)));
    return {
      id,
      skillId: number(source.skillId ?? source.id),
      nameZhTw: text(source.nameZhTw ?? source.name, id ? `技能 ${id}` : `因子 ${index + 1}`),
      kind: text(source.kind, 'white'),
      type: flowFactorType(
        source.type ?? source.factorType ?? (source.kind === 'green' ? 'green' : 'white')
      ),
      requirementLevel: requirementLevel(
        source.requirementLevel,
        source.required === true ? 'USER_REQUIRED' : (source.recommended === true ? 'RECOMMENDED' : 'RECOMMENDED')
      ),
      weight,
      skillPointCost,
      factorProbability,
      expectedUtility: Math.max(
        0,
        number(source.expectedUtility, weight * factorProbability * 200 / (200 + skillPointCost))
      ),
      sourceKind: text(source.sourceKind),
      scenarioExclusive: Boolean(source.scenarioExclusive),
      scenarioId: text(source.scenarioId),
      stars: number(source.stars ?? source.targetStars ?? source.minimumStars),
      reason: text(source.reason)
    };
  }

  function affinityScore(leftKey, rightKey, affinityData) {
    if (!leftKey || !rightKey || leftKey === rightKey) return leftKey === rightKey ? 0 : null;
    const names = affinityData?.names;
    const matrix = affinityData?.matrix;
    if (!Array.isArray(names) || !Array.isArray(matrix)) return null;
    const left = names.indexOf(leftKey);
    const right = names.indexOf(rightKey);
    if (left < 0 || right < 0) return null;
    return number(matrix[left]?.[right]);
  }

  function candidateIdentity(candidate) {
    return number(candidate?.characterId) ?? text(candidate?.affinityKey) ?? text(candidate?.id);
  }

  function sameCharacter(left, right) {
    if (!left || !right) return false;
    const leftCharacter = number(left.characterId);
    const rightCharacter = number(right.characterId);
    if (leftCharacter !== null && rightCharacter !== null) return leftCharacter === rightCharacter;
    return Boolean(left.affinityKey && right.affinityKey && left.affinityKey === right.affinityKey);
  }

  function targetMatches(candidate, targets) {
    const skillIds = new Set(candidate.learnableSkillIds);
    if (Number.isFinite(candidate.uniqueSkillId)) skillIds.add(candidate.uniqueSkillId);
    return (targets || []).filter(target => Number.isFinite(target.id) && skillIds.has(target.id));
  }

  function targetCoverageScore(candidate, targets) {
    return targetMatches(candidate, targets)
      .reduce((sum, target) => sum + Math.max(1, target.expectedUtility || target.weight), 0);
  }

  function foundationCoverage(candidate) {
    const profile = candidate?.foundationG1Coverage;
    if (!profile || typeof profile !== 'object') {
      return {
        hasProfile: false,
        nativeCount: Math.max(0, number(candidate?.g1Breadth, 0)),
        oneStarExpandableCount: 0,
        oneStarExpandedCount: Math.max(0, number(candidate?.g1Breadth, 0)),
        requiredRedAxes: [],
        requiredRedFactors: []
      };
    }
    const nativeCount = Math.max(0, number(
      profile.nativeCanonicalG1Count
      ?? profile.nativeCount
      ?? profile.nativeCanonicalRaceIds?.length,
      0
    ));
    const oneStarExpandableCount = Math.max(0, number(
      profile.oneStarExpandableCanonicalG1Count
      ?? profile.oneStarExpandableCount
      ?? profile.oneStarExpandableCanonicalRaceIds?.length,
      0
    ));
    return {
      hasProfile: true,
      nativeCount,
      oneStarExpandableCount,
      oneStarExpandedCount: Math.max(0, number(
        profile.oneStarExpandedCanonicalG1Count
        ?? profile.oneStarExpandedCount
        ?? profile.oneStarExpandedCanonicalRaceIds?.length,
        nativeCount + oneStarExpandableCount
      )),
      requiredRedAxes: Array.isArray(profile.requiredRedAxes) ? profile.requiredRedAxes : [],
      requiredRedFactors: Array.isArray(profile.requiredRedFactors) ? profile.requiredRedFactors : []
    };
  }

  function affinityReason(value, fallback = '未解析') {
    return Number.isFinite(Number(value)) ? `${Number(value)}` : fallback;
  }

  function factorReason(targets) {
    return (targets || []).map(target => target.nameZhTw || `因子 ${target.id}`).filter(Boolean).join('、') || '未指定';
  }

  function directSelectionDetails(
    candidate,
    target,
    factorTargets,
    affinityData,
    requestedSkillId = null,
    policy = normalizeDecisionPolicy(),
    evaluation = null
  ) {
    const targetAffinity = affinityScore(target?.affinityKey, candidate?.affinityKey, affinityData);
    const skillName = candidate?.uniqueSkillName || `固有 ${candidate?.uniqueSkillId ?? '待確認'}`;
    const requested = requestedSkillId !== null
      && requestedSkillId !== undefined
      && Number.isFinite(Number(requestedSkillId));
    const score = evaluation || directCandidateEvaluation(candidate, target, factorTargets, affinityData, policy);
    return {
      selectionBasis: {
        stage: 'direct-parent',
        inheritedUniqueSkill: {
          id: candidate?.uniqueSkillId,
          name: skillName,
          requested,
          priority: requested ? 'user-specified' : 'fallback'
        },
        targetAffinity,
        course: {
          score: candidate?.courseScore || 0,
          bashin: candidate?.courseBashin || 0
        },
        factorTargets: (factorTargets || []).map(targetItem => targetItem.id),
        decisionPolicy: policy.id,
        scoreBreakdown: cloneValue(score.components),
        score: Math.round(score.total),
        softObjectives: ['baseAffinity', 'g1Breadth', 'factorUtility', 'aptitude', 'owned']
      },
      selectionReason: {
        summary: requested
          ? `指定繼承固有：${skillName}`
          : `補足繼承固有：${skillName}`,
        items: [
          `繼承固有：${skillName}${requested ? '（使用者指定）' : ''}`,
          `最終戰馬基礎相性：${affinityReason(targetAffinity)}`,
          `賽道／固有價值：${Number(candidate?.courseScore || 0).toFixed(1)}；相性基礎：${Number(candidate?.courseBashin || 0).toFixed(1)}`,
          '取捨規則：關鍵繼承固有／賽道價值優先；基礎相性與共同 GⅠ 只作機率加分，不要求同時滿分。'
        ],
        score: Math.round(score.total)
      }
    };
  }

  function grandparentSelectionDetails(
    candidate,
    directParent,
    target,
    factorTargets,
    affinityData,
    score,
    policy,
    evaluation
  ) {
    const parentAffinity = affinityScore(directParent?.affinityKey, candidate?.affinityKey, affinityData);
    const targetAffinity = affinityScore(target?.affinityKey, candidate?.affinityKey, affinityData);
    return {
      selectionBasis: {
        stage: 'grandparent',
        factorTargets: (factorTargets || []).map(targetItem => targetItem.id),
        parentAffinity,
        targetAffinity,
        decisionPolicy: policy.id,
        scoreBreakdown: cloneValue(evaluation?.components || {}),
        score: Math.round(score),
        softObjectives: ['factorUtility', 'parentAffinity', 'targetAffinity', 'g1Breadth', 'aptitude']
      },
      selectionReason: {
        summary: `因子 ${factorReason(factorTargets)}；親子相性 ${affinityReason(parentAffinity)}；目標基礎相性 ${affinityReason(targetAffinity)}`,
        items: [
          `本支系因子：${factorReason(factorTargets)}`,
          `直屬親代相性：${affinityReason(parentAffinity)}`,
          `最終戰馬基礎相性：${affinityReason(targetAffinity)}`,
          '取捨規則：本支系因子效用可補償較低的基礎相性或較少共同 GⅠ；這些欄位只參與排序。'
        ],
        score: Math.round(score)
      }
    };
  }

  function directCandidateEvaluation(candidate, target, factorTargets, affinityData, policy) {
    const affinity = affinityScore(target.affinityKey, candidate.affinityKey, affinityData);
    return weightedEvaluation({
      courseScore: candidate.courseScore,
      courseBashin: candidate.courseBashin,
      factorUtility: targetCoverageScore(candidate, factorTargets),
      baseAffinity: Math.max(0, affinity || 0),
      aptitude: candidate.aptitudeScore,
      g1Breadth: candidate.g1Breadth,
      owned: candidate.owned ? 1 : 0
    }, policy.stageWeights.directParent);
  }

  function directCandidateScore(candidate, target, factorTargets, affinityData, policy) {
    return directCandidateEvaluation(candidate, target, factorTargets, affinityData, policy).total;
  }

  function resolveDirectParents(candidates, requestedSkillIds, target, factorTargets, affinityData, policy) {
    const warnings = [];
    const requested = uniqueNumbers(requestedSkillIds);
    const ranked = candidates.slice().sort((left, right) =>
      directCandidateScore(right, target, factorTargets, affinityData, policy)
      - directCandidateScore(left, target, factorTargets, affinityData, policy)
      || left.nameZhTw.localeCompare(right.nameZhTw, 'zh-Hant')
    );
    const selected = [];
    for (const skillId of requested) {
      const candidate = ranked.find(item =>
        Number(item.uniqueSkillId) === skillId
        && !sameCharacter(item, target)
        && !selected.some(existing => sameCharacter(existing, item))
      );
      if (candidate) {
        const evaluation = directCandidateEvaluation(candidate, target, factorTargets, affinityData, policy);
        selected.push({
          ...candidate,
          ...directSelectionDetails(candidate, target, factorTargets, affinityData, skillId, policy, evaluation)
        });
      }
      else warnings.push({
        code: 'DIRECT_PARENT_REQUEST_UNAVAILABLE',
        message: `指定固有技能 ${skillId} 沒有可用且不重複的持有角色。`,
        skillId
      });
      if (selected.length >= 2) break;
    }
    for (const candidate of ranked) {
      if (selected.length >= 2) break;
      if (sameCharacter(candidate, target)) continue;
      if (selected.some(existing => sameCharacter(existing, candidate))) continue;
      const evaluation = directCandidateEvaluation(candidate, target, factorTargets, affinityData, policy);
      selected.push({
        ...candidate,
        ...directSelectionDetails(candidate, target, factorTargets, affinityData, null, policy, evaluation)
      });
    }
    while (selected.length < 2) selected.push(null);
    return {
      parents: selected.slice(0, 2).map((candidate, index) => candidate && ({
        ...candidate,
        slot: DIRECT_SLOTS[index],
        score: Math.round(directCandidateScore(candidate, target, factorTargets, affinityData, policy))
      })),
      warnings
    };
  }

  function takeRotating(values, indexes) {
    if (!values.length) return [];
    return indexes.map(index => values[index % values.length]).filter(Boolean);
  }

  function uniqueTargets(values) {
    const output = [];
    const seen = new Set();
    for (const value of values || []) {
      const key = Number.isFinite(value?.id) ? `id:${value.id}` : `name:${value?.nameZhTw}`;
      if (!value || seen.has(key)) continue;
      seen.add(key);
      output.push(value);
    }
    return output;
  }

  function buildFactorPackages(factorTargets) {
    const ordered = factorTargets.slice().sort((left, right) =>
      (right.expectedUtility || right.weight) - (left.expectedUtility || left.weight)
      || (left.id ?? Infinity) - (right.id ?? Infinity)
    );
    const acceleration = ordered.filter(target => target.kind === 'acceleration');
    const greens = ordered.filter(target => target.kind === 'green');
    const other = ordered.filter(target => !['acceleration', 'green'].includes(target.kind));
    const critical = acceleration.slice(0, 2);
    const layouts = [
      [...critical.slice(0, 1), ...takeRotating(greens, [0]), ...takeRotating(other, [0, 4])],
      [...critical.slice(0, 1), ...takeRotating(greens, [1]), ...takeRotating(other, [1, 5])],
      [...critical.slice(0, 2), ...takeRotating(greens, [2]), ...takeRotating(other, [2, 6])],
      [...critical.slice(0, 1), ...takeRotating(greens, [0, 2]), ...takeRotating(other, [3, 7])]
    ];
    const labels = [
      '主加速與第一綠技',
      '主加速與第二綠技',
      '副加速與第三綠技',
      '兩支系的缺口補完'
    ];
    return PACKAGE_SLOTS.map((id, index) => ({
      id,
      label: labels[index],
      targets: uniqueTargets(layouts[index]).slice(0, 6)
    }));
  }

  function grandparentCandidateEvaluation(candidate, directParent, target, factorPackage, affinityData, policy) {
    const parentAffinity = affinityScore(directParent?.affinityKey, candidate.affinityKey, affinityData);
    const targetAffinity = affinityScore(target.affinityKey, candidate.affinityKey, affinityData);
    const packageScore = targetCoverageScore(candidate, factorPackage.targets);
    return weightedEvaluation({
      courseScore: candidate.courseScore,
      courseBashin: candidate.courseBashin,
      factorUtility: packageScore,
      parentAffinity: Math.max(0, parentAffinity || 0),
      targetAffinity: Math.max(0, targetAffinity || 0),
      aptitude: candidate.aptitudeScore,
      g1Breadth: candidate.g1Breadth,
      sourceBreadth: candidate.sourceBreadth,
      owned: candidate.owned ? 1 : 0
    }, policy.stageWeights.grandparent);
  }

  function grandparentCandidateScore(candidate, directParent, target, factorPackage, affinityData, policy) {
    return grandparentCandidateEvaluation(candidate, directParent, target, factorPackage, affinityData, policy).total;
  }

  function assignGrandparents(candidates, directParents, target, packages, affinityData, policy) {
    const selected = [];
    const warnings = [];
    GRANDPARENT_SLOTS.forEach((slot, index) => {
      const branchIndex = index < 2 ? 0 : 1;
      const parent = directParents[branchIndex];
      const factorPackage = packages[index];
      const ranked = candidates
        .filter(candidate => !sameCharacter(candidate, target))
        .filter(candidate => !directParents.some(directParent => sameCharacter(candidate, directParent)))
        .filter(candidate => !selected.some(existing => sameCharacter(existing, candidate)))
        .map(candidate => ({
          candidate,
          evaluation: grandparentCandidateEvaluation(
            candidate,
            parent,
            target,
            factorPackage,
            affinityData,
            policy
          )
        }))
        .sort((left, right) =>
          right.evaluation.total - left.evaluation.total
          || left.candidate.nameZhTw.localeCompare(right.candidate.nameZhTw, 'zh-Hant')
        );
      const best = ranked[0];
      if (!best) {
        selected.push(null);
        warnings.push({
          code: 'GRANDPARENT_SLOT_UNAVAILABLE',
          message: `${slot} 沒有不重複角色可用。`,
          slot
        });
        return;
      }
      selected.push({
        ...best.candidate,
        slot,
        branch: branchIndex === 0 ? 'A' : 'B',
        packageId: factorPackage.id,
        factorTargets: factorPackage.targets,
        score: Math.round(best.evaluation.total),
        affinityWithParent: affinityScore(parent?.affinityKey, best.candidate.affinityKey, affinityData),
        ...grandparentSelectionDetails(
          best.candidate,
          parent,
          target,
          factorPackage.targets,
          affinityData,
          best.evaluation.total,
          policy,
          best.evaluation
        )
      });
    });
    return { grandparents: selected, warnings };
  }

  function foundationRouteCompatibility(candidate, child) {
    const candidatePlan = candidate?.foundationG1RoutePlan;
    const childPlan = child?.foundationG1RoutePlan;
    const routeId = childPlan?.recommendedRoute?.id
      || candidatePlan?.recommendedRoute?.id
      || '';
    const route = candidatePlan?.routes?.[routeId]
      || candidatePlan?.recommendedRoute
      || null;
    const requiredRedStarCost = (route?.requiredRedAxes || [])
      .reduce((sum, axis) => sum + Math.max(0, number(axis?.requiredIncomingRedStars, 0)), 0);
    return {
      routeId,
      routeLabel: route?.label || '',
      hasEvidence: Boolean(route),
      nativeReady: route?.status === 'NATIVE_READY' ? 1 : 0,
      goalAlignmentCount: (route?.builtInGoalMatches || []).length,
      goalConflictCount: (route?.opposingGoalMatches || []).length,
      requiredRedStarCost,
      probabilityStatus: 'NOT_COMPUTED',
      selectionRankingIncluded: Boolean(route),
      confirmedG1ScoreIncluded: false
    };
  }

  function foundationCandidateEvaluation(candidate, child, target, factorTargets, affinityData, policy) {
    const coverage = foundationCoverage(candidate);
    const route = foundationRouteCompatibility(candidate, child);
    const childAffinity = affinityScore(child?.affinityKey, candidate.affinityKey, affinityData);
    const targetAffinity = affinityScore(target?.affinityKey, candidate.affinityKey, affinityData);
    // Native G1 coverage remains more reliable than red-supported expansion,
    // but neither may erase a high-value factor target. This keeps schedule
    // breadth as a probability booster instead of an implicit hard gate.
    return weightedEvaluation({
      nativeG1: coverage.nativeCount,
      redExpandedG1: coverage.oneStarExpandableCount,
      g1RouteNative: route.nativeReady,
      g1RouteGoalAlignment: route.goalAlignmentCount,
      g1RouteGoalConflict: route.goalConflictCount,
      g1RouteRedStarCost: route.requiredRedStarCost,
      childAffinity: Math.max(0, childAffinity || 0),
      targetAffinity: Math.max(0, targetAffinity || 0),
      factorUtility: targetCoverageScore(candidate, factorTargets),
      redAxisCost: coverage.requiredRedAxes.length,
      aptitude: candidate.aptitudeScore,
      owned: candidate.owned ? 1 : 0
    }, policy.stageWeights.foundation);
  }

  function foundationCandidateScore(candidate, child, target, factorTargets, affinityData, policy) {
    return foundationCandidateEvaluation(candidate, child, target, factorTargets, affinityData, policy).total;
  }

  function foundationSelectionDetails(candidate, child, target, factorTargets, affinityData, score, policy, evaluation) {
    const coverage = foundationCoverage(candidate);
    const route = foundationRouteCompatibility(candidate, child);
    const childAffinity = affinityScore(child?.affinityKey, candidate.affinityKey, affinityData);
    const targetAffinity = affinityScore(target?.affinityKey, candidate.affinityKey, affinityData);
    const redAxes = coverage.requiredRedAxes
      .map(axis => axis.label || axis.nameZhTw || axis.key)
      .filter(Boolean);
    const expandedCount = coverage.oneStarExpandedCount
      || coverage.nativeCount + coverage.oneStarExpandableCount;
    const redText = redAxes.length ? redAxes.map(axis => `${axis} 1★`).join('、') : '不需額外紅因子';
    return {
      selectionBasis: {
        stage: 'foundation',
        g1Foundation: {
          nativeCount: coverage.nativeCount,
          oneStarExpandableCount: coverage.oneStarExpandableCount,
          oneStarExpandedCount: expandedCount
        },
        g1Route: cloneValue(route),
        redFactorNeeds: cloneValue(coverage.requiredRedFactors.length
          ? coverage.requiredRedFactors
          : coverage.requiredRedAxes),
        childAffinity,
        targetAffinity,
        factorTargets: (factorTargets || []).map(targetItem => targetItem.id),
        decisionPolicy: policy.id,
        scoreBreakdown: cloneValue(evaluation?.components || {}),
        softObjectives: ['nativeG1', 'redExpandedG1', 'factorUtility', 'childAffinity', 'targetAffinity'],
        score: Math.round(score)
      },
      selectionReason: {
        summary: `GⅠ底座原生 ${coverage.nativeCount} 場；補 ${redText} 後可到 ${expandedCount} 場`,
        items: [
          `GⅠ底座：原生 ${coverage.nativeCount} 場；補 ${redText} 後可到 ${expandedCount} 場`,
          `三冠主線：${route.routeLabel || '未解析'}；固定目標賽命中 ${route.goalAlignmentCount}、相衝 ${route.goalConflictCount}；${route.requiredRedStarCost ? `需補合計 ${route.requiredRedStarCost}★ 適性` : '目前不需額外路線紅因子'}`,
          `紅因子需求：${redText}`,
          `直屬祖代相性：${affinityReason(childAffinity)}`,
          `最終戰馬基礎相性：${affinityReason(targetAffinity)}`,
          `本支系因子：${factorReason(factorTargets)}`,
          '取捨規則：原生 GⅠ 比紅因子擴張更可靠；高價值因子可補償部分賽程與相性缺口。'
        ],
        score: Math.round(score)
      }
    };
  }

  function assignFoundationSeeds(candidates, grandparents, blockedCandidates, affinityData, target, policy) {
    const foundationSlots = [];
    for (const grandparent of grandparents) {
      if (!grandparent) continue;
      const selected = [];
      const factorTargets = grandparent.factorTargets || [];
      const ranked = candidates
        .filter(candidate => !sameCharacter(candidate, grandparent))
        .filter(candidate => !(blockedCandidates || []).some(blocked => sameCharacter(candidate, blocked)))
        .map(candidate => ({
          candidate,
          evaluation: foundationCandidateEvaluation(candidate, grandparent, target, factorTargets, affinityData, policy)
        }))
        .sort((left, right) =>
          right.evaluation.total - left.evaluation.total
          || left.candidate.nameZhTw.localeCompare(right.candidate.nameZhTw, 'zh-Hant')
        );
      for (const row of ranked) {
        if (selected.length >= 2) break;
        if (selected.some(item => sameCharacter(item.candidate, row.candidate))) continue;
        selected.push(row);
      }
      selected.forEach((row, index) => {
        const seedTargets = factorTargets.filter((_, targetIndex) => targetIndex % 2 === index);
        foundationSlots.push({
          ...row.candidate,
          slot: `${grandparent.slot}-seed${index + 1}`,
          childSlot: grandparent.slot,
          factorTargets: seedTargets,
          score: Math.round(row.evaluation.total),
          role: index === 0 ? '自養起點' : '可借用的另一側素材',
          ...foundationSelectionDetails(
            row.candidate,
            grandparent,
            target,
            seedTargets,
            affinityData,
            row.evaluation.total,
            policy,
            row.evaluation
          )
        });
      });
    }
    const reuseCounts = new Map();
    foundationSlots.forEach(item => {
      const key = String(candidateIdentity(item));
      reuseCounts.set(key, (reuseCounts.get(key) || 0) + 1);
    });
    return foundationSlots.map(item => ({
      ...item,
      reuseCount: reuseCounts.get(String(candidateIdentity(item))) || 1
    }));
  }

  function parentFactorTargets(grandparents, branch) {
    const targets = grandparents
      .filter(grandparent => grandparent?.branch === branch)
      .flatMap(grandparent => grandparent.factorTargets || []);
    const critical = targets.filter(target => target.kind === 'acceleration');
    return uniqueTargets([...critical, ...targets]).slice(0, 10);
  }

  function scheduleOverride(input, stepId, candidate) {
    const maps = [
      input.g1ScheduleByStep,
      input.g1Schedules,
      input.lineageG1Schedules,
      input.scheduleContracts
    ].filter(value => value && typeof value === 'object' && !Array.isArray(value));
    const keys = [stepId, candidate?.slot, candidate?.id].filter(Boolean);
    for (const map of maps) {
      for (const key of keys) {
        if (map[key] !== undefined) return map[key];
      }
    }
    return null;
  }

  function g1Options(input = {}) {
    return {
      raceCatalog: input.raceCatalog ?? input.g1RaceCatalog ?? input.catalog ?? input.gameToraRaceCatalog,
      ruleset: input.ruleset ?? input.rulesetId ?? ZH_TW_G1_RULESET.id,
      server: input.server ?? ZH_TW_G1_RULESET.server
    };
  }

  function stepG1Schedule(candidate, stepId, input = {}) {
    const override = scheduleOverride(input, stepId, candidate) || {};
    const step = { id: stepId, candidate };
    const policy = normalizeDecisionPolicy(input.lineageDecisionPolicy ?? input.decisionPolicy);
    const boundRecord = breederRecordForStep(input, step);
    // Confirmed G1 evidence is never inherited from candidate metadata or a
    // caller-provided schedule row.  Only the record explicitly bound to this
    // exact work-order step may contribute user-recorded wins.
    const confirmedInput = boundRecord?.g1Wins ?? [];
    const projectedInput = override.projectedG1Schedule
      ?? override.projected
      ?? boundRecord?.projectedG1Schedule
      ?? candidate?.projectedG1Schedule
      ?? [];
    const core = getBreederCore();
    const options = g1Options(input);
    const classify = (source, method, expectedStatus) => {
      const submitted = normalizeRaceEvidenceList(source);
      const races = [];
      const warnings = [];
      submitted.forEach((raw, index) => {
        if (!core || typeof core[method] !== 'function') {
          warnings.push({
            code: 'G1_RULESET_ENGINE_UNAVAILABLE',
            message: 'G1 規則引擎不可用；賽程保留但未驗證。',
            index
          });
          return;
        }
        const result = core[method](raw, options);
        warnings.push(...(result.warnings || []).map(item => ({ ...item, index })));
        if (result.status === expectedStatus && result.race) {
          races.push({
            ...result.race,
            requirementLevel: requirementLevel(
              raw?.requirementLevel,
              expectedStatus === 'PROJECTED'
                ? policy.projectedG1DefaultRequirementLevel
                : 'RULE_REQUIRED'
            )
          });
        }
      });
      return { submitted, races, warnings };
    };
    const confirmed = classify(confirmedInput, 'classifyG1RaceEvidence', 'CONFIRMED');
    const projected = classify(projectedInput, 'classifyProjectedG1Race', 'PROJECTED');
    return {
      g1ScheduleConfirmed: {
        status: confirmed.races.length ? 'CONFIRMED' : (confirmed.submitted.length ? 'UNVERIFIED' : 'NONE'),
        scoreIncluded: true,
        races: confirmed.races,
        submitted: confirmed.submitted,
        warnings: confirmed.warnings
      },
      g1ScheduleProjected: {
        status: projected.races.length ? 'UNVERIFIED' : (projected.submitted.length ? 'UNVERIFIED' : 'NONE'),
        scoreIncluded: false,
        probabilityStatus: 'UNVERIFIED',
        races: projected.races,
        submitted: projected.submitted,
        warnings: projected.warnings
      }
    };
  }

  function stepRedRequirements(candidate, stepId, input = {}) {
    const override = scheduleOverride(input, stepId, candidate) || {};
    const sources = [
      override.redFactorRequirements,
      candidate?.redFactorRequirements,
      input.redFactorRequirements,
      input.aptitudeRequirements,
      input.target?.redFactorRequirements,
      input.target?.aptitudeRequirements
    ];
    const selected = sources.find(value => values(value).length > 0);
    return normalizeRedRequirements(selected);
  }

  function stepContract(candidate, stepId, input = {}) {
    const schedules = stepG1Schedule(candidate, stepId, input);
    const redFactorRequirements = stepRedRequirements(candidate, stepId, input);
    return {
      ...schedules,
      redFactorRequirements,
      completionCriteria: {
        ruleset: input.ruleset ?? input.rulesetId ?? ZH_TW_G1_RULESET.id,
        confirmedG1Only: true,
        confirmedG1RaceIds: schedules.g1ScheduleConfirmed.races.map(race => race.canonicalRaceId),
        projectedG1ScoreIncluded: false,
        projectedG1RaceIds: schedules.g1ScheduleProjected.races.map(race => race.canonicalRaceId),
        redFactorRequirements,
        redFactorInheritanceProbabilityStatus: redFactorRequirements.length
          ? 'UNVERIFIED'
          : 'NOT_REQUIRED'
      }
    };
  }

  function stepMapValue(input, fieldNames, step) {
    const keys = [step?.id, step?.candidate?.slot, step?.candidate?.id].filter(Boolean).map(String);
    for (const field of fieldNames) {
      const map = input?.[field];
      if (!map || typeof map !== 'object' || Array.isArray(map)) continue;
      for (const key of keys) {
        if (hasOwn(map, key)) return map[key];
      }
    }
    return null;
  }

  function factorPlanForStep(input, step) {
    const value = stepMapValue(input, ['factorPlanByStep', 'factorPlansByStep', 'lineageFactorPlans'], step);
    return value && typeof value === 'object' ? value : {};
  }

  function breederRecordForStep(input, step) {
    const stepId = text(step?.id);
    if (!stepId) return null;
    let binding = null;
    for (const field of ['breederRecordByStep', 'breederRecordsByStep', 'lineageBreederRecords']) {
      const map = input?.[field];
      if (!map || typeof map !== 'object' || Array.isArray(map) || !hasOwn(map, stepId)) continue;
      binding = map[stepId];
      break;
    }
    const records = values(input?.breederRecords ?? input?.breeders).filter(item => item && typeof item === 'object');
    let record = binding && typeof binding === 'object'
      ? (binding.record && typeof binding.record === 'object' ? binding.record : binding)
      : null;
    const recordId = text(
      binding && typeof binding === 'object'
        ? binding.recordId ?? binding.breederRecordId ?? binding.id
        : binding
    );
    if ((!record || !text(record.id)) && recordId) {
      record = records.find(item => text(item.id) === recordId) || null;
    }
    if (!record || !text(record.id)) return null;
    const candidate = step?.candidate || {};
    const recordOutfitId = number(record.outfitId ?? record.character?.outfitId);
    const recordCharacterId = number(record.characterId ?? record.character?.characterId);
    const candidateOutfitId = number(candidate.outfitId);
    const candidateCharacterId = number(candidate.characterId);
    if (!Number.isFinite(recordOutfitId) || !Number.isFinite(recordCharacterId)) return null;
    if (Number.isFinite(candidateOutfitId) && recordOutfitId !== candidateOutfitId) return null;
    if (Number.isFinite(candidateCharacterId) && recordCharacterId !== candidateCharacterId) return null;
    return record;
  }

  function flowFactorIdentity(item, type) {
    if (!item) return '';
    if ((type === 'white' || type === 'green') && Number.isFinite(item.skillId)) {
      return `${type}:skill:${Number(item.skillId)}`;
    }
    const key = type === 'red'
      ? canonicalRedFactorKey(item.key ?? item.nameZhTw)
      : (type === 'blue'
          ? canonicalBlueFactorKey(item.key ?? item.nameZhTw)
          : text(item.key ?? item.nameZhTw).toLowerCase());
    return key ? `${type}:key:${key}` : '';
  }

  function canonicalRedFactorKey(value) {
    const raw = text(value).toLowerCase().replace(/[\s_・-]+/g, '');
    const aliases = {
      turf: ['turf', 'grass', '草地', '芝'],
      dirt: ['dirt', '泥地', '沙地', 'ダート'],
      short: ['short', '短距離', '短距'],
      mile: ['mile', '一哩', '英里', 'マイル'],
      medium: ['medium', '中距離', '中距'],
      long: ['long', '長距離', '長距'],
      runner: ['runner', 'frontrunner', '領頭', '逃げ'],
      leader: ['leader', '前列', '先行'],
      betweener: ['betweener', '居中', '差し'],
      chaser: ['chaser', '後追', '追込', '追い込み']
    };
    for (const [key, values] of Object.entries(aliases)) {
      if (values.some(alias => alias.toLowerCase().replace(/[\s_・-]+/g, '') === raw)) return key;
    }
    return raw;
  }

  function canonicalBlueFactorKey(value) {
    const raw = text(value).toLowerCase().replace(/[\s_・-]+/g, '');
    const aliases = {
      speed: ['speed', '速度', 'スピード'],
      stamina: ['stamina', '耐力', 'スタミナ'],
      power: ['power', '力量', 'パワー'],
      guts: ['guts', '毅力', '根性'],
      wisdom: ['wisdom', '智力', '賢さ', '賢']
    };
    for (const [key, values] of Object.entries(aliases)) {
      if (values.some(alias => alias.toLowerCase().replace(/[\s_・-]+/g, '') === raw)) return key;
    }
    return raw;
  }

  function dedupeFlowFactors(items, type) {
    const seen = new Set();
    return (items || []).filter(item => {
      const identity = flowFactorIdentity(item, type);
      if (!identity || seen.has(identity)) return false;
      seen.add(identity);
      return true;
    });
  }

  function plannedFactor(item, type, fallbackLevel) {
    const normalized = normalizeFlowFactor(item, type);
    if (!normalized) return null;
    return {
      ...normalized,
      type,
      requirementLevel: requirementLevel(item?.requirementLevel, fallbackLevel),
      status: 'PLANNED_MISSING',
      evidenceStatus: 'NONE'
    };
  }

  function plannedOutputsForStep(step, input) {
    const plan = factorPlanForStep(input, step);
    const override = scheduleOverride(input, step?.id, step?.candidate) || {};
    const blueSource = plan.blue ?? plan.blueFactor ?? plan.outputs?.blue;
    const blueFactor = plannedFactor(blueSource, 'blue', 'RECOMMENDED');
    const explicitWhite = normalizeFlowFactorList(plan.white ?? plan.whiteFactors ?? plan.outputs?.white, 'white');
    const explicitGreen = normalizeFlowFactorList(plan.green ?? plan.greenFactors ?? plan.outputs?.green, 'green');
    const explicitRed = normalizeFlowFactorList(
      plan.red
      ?? plan.redFactor
      ?? plan.redFactors
      ?? plan.outgoingRedFactors
      ?? plan.outputs?.red
      ?? override.outgoingRedFactors
      ?? override.outgoingRedFactor,
      'red'
    );
    const targetWhite = (step?.targets || [])
      .filter(target => !['green', 'red'].includes(text(target?.kind).toLowerCase()))
      .map(target => plannedFactor({
        ...target,
        skillId: target.skillId ?? target.id,
        requirementLevel: target.requirementLevel ?? 'USER_REQUIRED'
      }, 'white', 'USER_REQUIRED'))
      .filter(Boolean);
    const targetGreen = (step?.targets || [])
      .filter(target => text(target?.kind).toLowerCase() === 'green')
      .map(target => plannedFactor({
        ...target,
        skillId: target.skillId ?? target.id,
        requirementLevel: target.requirementLevel ?? 'RECOMMENDED'
      }, 'green', 'RECOMMENDED'))
      .filter(Boolean);
    return {
      blue: blueFactor
        ? blueFactor
        : {
            planned: null,
            status: 'UNSPECIFIED',
            requirementLevel: 'OPTIONAL',
            evidenceStatus: 'NONE'
          },
      red: dedupeFlowFactors(
        explicitRed.map(item => plannedFactor(item, 'red', 'USER_REQUIRED')).filter(Boolean),
        'red'
      ),
      white: dedupeFlowFactors([
        ...explicitWhite.map(item => plannedFactor(item, 'white', 'USER_REQUIRED')).filter(Boolean),
        ...targetWhite
      ], 'white'),
      green: dedupeFlowFactors([
        ...explicitGreen.map(item => plannedFactor(item, 'green', 'RECOMMENDED')).filter(Boolean),
        ...targetGreen
      ], 'green')
    };
  }

  function observedOutputsForStep(step, input) {
    const record = breederRecordForStep(input, step);
    if (!record) {
      return {
        evidenceRecordId: null,
        evidenceStatus: 'NONE',
        blue: null,
        red: [],
        white: [],
        green: []
      };
    }
    const recordId = text(record.id);
    const factors = record.factors && typeof record.factors === 'object' ? record.factors : {};
    const decorate = (item, type, exactMatchEligible = true) => item ? ({
      ...item,
      type,
      status: 'USER_RECORDED',
      evidenceStatus: 'USER_RECORDED',
      evidenceRecordId: recordId,
      exactMatchEligible
    }) : null;
    const blue = decorate(normalizeFlowFactor(record.blueFactor ?? factors.blue, 'blue'), 'blue');
    const red = normalizeFlowFactorList(record.redFactors ?? record.redFactor ?? factors.red, 'red')
      .map(item => decorate(item, 'red'));
    const green = normalizeFlowFactorList(record.greenFactors ?? record.greenFactor ?? factors.green, 'green')
      // Persisted green factors currently have a localized name but no stable
      // skill id, so they remain user-recorded audit rows, not exact evidence.
      .map(item => decorate(item, 'green', Number.isFinite(item.skillId)));
    const white = normalizeFlowFactorList(record.whiteFactors ?? factors.white, 'white')
      .map(item => decorate(item, 'white', Number.isFinite(item.skillId)));
    return {
      evidenceRecordId: recordId,
      evidenceStatus: 'USER_RECORDED',
      blue,
      red,
      white,
      green
    };
  }

  function factorStarsMeet(planned, observed) {
    const required = number(planned?.requiredStars ?? planned?.stars);
    const supplied = number(observed?.suppliedStars ?? observed?.stars, 0);
    return !Number.isFinite(required) || supplied >= required;
  }

  function observedMatchesPlanned(planned, observed, type) {
    if (!planned || !observed || observed.exactMatchEligible === false) return false;
    if (type === 'white' || type === 'green') {
      if (!Number.isFinite(planned.skillId) || !Number.isFinite(observed.skillId)) return false;
      return Number(planned.skillId) === Number(observed.skillId) && factorStarsMeet(planned, observed);
    }
    const plannedKey = type === 'red'
      ? canonicalRedFactorKey(planned.key ?? planned.nameZhTw)
      : text(planned.key ?? planned.nameZhTw).toLowerCase();
    const observedKey = type === 'red'
      ? canonicalRedFactorKey(observed.key ?? observed.nameZhTw)
      : text(observed.key ?? observed.nameZhTw).toLowerCase();
    return Boolean(plannedKey && plannedKey === observedKey && factorStarsMeet(planned, observed));
  }

  function annotatePlannedOutputs(plannedOutputs, observedOutputs) {
    const annotate = (item, type, observedRows) => {
      if (!item || item.status === 'UNSPECIFIED') return item;
      const evidence = values(observedRows).find(row => observedMatchesPlanned(item, row, type));
      return evidence
        ? { ...item, status: 'USER_RECORDED', evidenceStatus: 'USER_RECORDED', evidenceRecordId: evidence.evidenceRecordId }
        : item;
    };
    return {
      blue: annotate(plannedOutputs.blue, 'blue', observedOutputs.blue),
      red: plannedOutputs.red.map(item => annotate(item, 'red', observedOutputs.red)),
      white: plannedOutputs.white.map(item => annotate(item, 'white', observedOutputs.white)),
      green: plannedOutputs.green.map(item => annotate(item, 'green', observedOutputs.green))
    };
  }

  function incomingFactorsForStep(step, input) {
    const override = scheduleOverride(input, step?.id, step?.candidate) || {};
    const plan = factorPlanForStep(input, step);
    const dependencyIds = uniqueTexts(step?.dependsOn || []);
    const workSteps = values(input?.lineageWorkSteps ?? input?.workOrder);
    const sourceStepForId = sourceStepId => workSteps.find(item => text(item?.id) === sourceStepId) || null;
    const observedRowsForSource = (sourceStepId, type) => {
      const sourceStep = sourceStepForId(sourceStepId);
      if (!sourceStep || !breederRecordForStep(input, sourceStep)) return [];
      const observed = observedOutputsForStep(sourceStep, input);
      const rows = type === 'blue'
        ? (observed.blue ? [observed.blue] : [])
        : values(observed[type]);
      return rows.map(item => ({
        ...item,
        sourceStepId,
        evidenceRecordId: text(observed.evidenceRecordId)
      }));
    };
    const providedRed = normalizeFlowFactorList(
      override.incomingRedPlan ?? override.incomingRedFactors ?? plan.incoming?.red,
      'red'
    );
    const requiredRed = normalizeFlowFactorList(
      override.incomingRedRequirements ?? plan.incomingRequirements?.red,
      'red'
    );
    const providedByKey = new Map(providedRed.map(item => [flowFactorIdentity(item, 'red'), item]));
    const requiredByKey = new Map(requiredRed.map(item => [flowFactorIdentity(item, 'red'), item]));
    const redKeys = new Set([...providedByKey.keys(), ...requiredByKey.keys()].filter(Boolean));
    const red = [...redKeys].map(identity => {
      const provided = providedByKey.get(identity);
      const required = requiredByKey.get(identity);
      const source = provided || required;
      const declaredRequirement = [provided, required]
        .find(item => item?.requirementLevelProvided === true);
      const requiredStars = number(required?.requiredStars ?? required?.stars ?? provided?.requiredStars);
      const suppliedStars = number(
        provided?.suppliedStars
        ?? provided?.stars
        ?? required?.suppliedStars
        ?? required?.recordedStars,
        0
      );
      const declaredSourceStepIds = uniqueTexts([
        ...(provided?.sourceStepIds || []),
        ...(required?.sourceStepIds || [])
      ]);
      const requestedSourceStepIds = declaredSourceStepIds.length ? declaredSourceStepIds : dependencyIds;
      const sourceStepIds = requestedSourceStepIds.filter(id => dependencyIds.includes(id));
      const validatedRows = sourceStepIds.flatMap(sourceStepId => {
        const matches = observedRowsForSource(sourceStepId, 'red')
          .filter(item => flowFactorIdentity(item, 'red') === identity)
          .sort((left, right) => number(right.stars, 0) - number(left.stars, 0));
        return matches[0] ? [{ ...matches[0], sourceStepId }] : [];
      });
      const validatedStars = validatedRows.reduce(
        (sum, item) => sum + Math.max(0, number(item.stars ?? item.suppliedStars, 0)),
        0
      );
      const declaredSuppliedStars = suppliedStars;
      const hasDeclaredEvidence = Boolean(provided) || declaredSuppliedStars > 0;
      const hasRecordedEvidence = validatedRows.length > 0;
      const enoughStars = !Number.isFinite(requiredStars) || validatedStars >= requiredStars;
      const status = hasRecordedEvidence
        ? (enoughStars ? 'SATISFIED' : 'MISSING')
        : (hasDeclaredEvidence ? 'DEPENDENT_UNVERIFIED' : 'MISSING');
      return {
        ...source,
        type: 'red',
        requiredStars,
        suppliedStars: validatedStars,
        sourceStepId: sourceStepIds[0] || '',
        sourceStepIds,
        requirementLevel: declaredRequirement
          ? requirementLevel(declaredRequirement.requirementLevel, 'RULE_REQUIRED')
          : 'RULE_REQUIRED',
        status,
        evidenceStatus: hasRecordedEvidence ? 'USER_RECORDED' : 'UNVERIFIED',
        evidenceRecordIds: uniqueTexts(validatedRows.map(item => item.evidenceRecordId))
      };
    });
    const genericIncoming = type => normalizeFlowFactorList(plan.incoming?.[type], type).map(item => {
      const declaredSourceStepIds = uniqueTexts(item.sourceStepIds || []);
      const requestedSourceStepIds = declaredSourceStepIds.length ? declaredSourceStepIds : dependencyIds;
      const sourceStepIds = requestedSourceStepIds.filter(id => dependencyIds.includes(id));
      const identity = flowFactorIdentity(item, type);
      const exactIdentityAvailable = type !== 'white' || Number.isFinite(item.skillId);
      const validatedRows = exactIdentityAvailable
        ? sourceStepIds.flatMap(sourceStepId => observedRowsForSource(sourceStepId, type)
            .filter(row => row.exactMatchEligible !== false)
            .filter(row => flowFactorIdentity(row, type) === identity))
        : [];
      const suppliedStars = type === 'white'
        ? validatedRows.reduce((maximum, row) => Math.max(maximum, Math.max(0, number(row.stars, 0))), 0)
        : validatedRows.reduce((sum, row) => sum + Math.max(0, number(row.stars, 0)), 0);
      const requiredStars = number(item.requiredStars ?? item.stars);
      const enoughStars = validatedRows.length > 0
        && (!Number.isFinite(requiredStars) || suppliedStars >= requiredStars);
      return {
        ...item,
        type,
        requiredStars,
        suppliedStars,
        sourceStepId: sourceStepIds[0] || '',
        sourceStepIds,
        requirementLevel: requirementLevel(item.requirementLevel, 'USER_REQUIRED'),
        status: validatedRows.length
          ? (enoughStars ? 'SATISFIED' : 'MISSING')
          : (dependencyIds.length ? 'DEPENDENT_UNVERIFIED' : 'MISSING'),
        evidenceStatus: validatedRows.length ? 'USER_RECORDED' : 'UNVERIFIED',
        evidenceRecordIds: uniqueTexts(validatedRows.map(row => row.evidenceRecordId))
      };
    });
    return {
      blue: genericIncoming('blue'),
      red,
      white: genericIncoming('white')
    };
  }

  function raceIdentity(row) {
    const canonical = number(row?.canonicalRaceId ?? row?.raceId ?? row?.baseRaceId);
    if (Number.isFinite(canonical)) return `canonical:${canonical}`;
    const catalog = number(row?.catalogRaceId ?? row?.catalogId ?? row?.legacyCatalogRaceId ?? row?.id);
    return Number.isFinite(catalog) ? `catalog:${catalog}` : '';
  }

  function buildFactorFlow(step, input = {}) {
    const policy = normalizeDecisionPolicy(input.lineageDecisionPolicy ?? input.decisionPolicy);
    const incoming = incomingFactorsForStep(step, input);
    const observedOutputs = observedOutputsForStep(step, input);
    const plannedOutputs = annotatePlannedOutputs(plannedOutputsForStep(step, input), observedOutputs);
    const incomingRows = [...incoming.blue, ...incoming.red, ...incoming.white];
    const startBlockers = incomingRows
      .filter(item => isHardRequirement(item.requirementLevel, policy))
      .filter(item => item.status !== 'SATISFIED')
      .map(item => ({
        code: item.status === 'MISSING' ? 'INCOMING_FACTOR_MISSING' : 'INCOMING_FACTOR_UNVERIFIED',
        type: item.type,
        key: item.key,
        sourceStepIds: item.sourceStepIds || []
      }));
    const outputRows = [
      ...(plannedOutputs.blue?.planned === null ? [] : [plannedOutputs.blue]),
      ...plannedOutputs.red,
      ...plannedOutputs.white,
      ...plannedOutputs.green
    ];
    const hardOutputs = outputRows.filter(item => isHardRequirement(item.requirementLevel, policy));
    const missingOutputs = hardOutputs.filter(item => item.status !== 'USER_RECORDED');
    const recommendedOutputGaps = outputRows
      .filter(item => requirementLevel(item.requirementLevel) === 'RECOMMENDED')
      .filter(item => !['USER_RECORDED', 'SATISFIED'].includes(item.status));
    const projectedRows = step?.g1ScheduleProjected?.races || [];
    const recordedRaceIds = new Set(
      (step?.g1ScheduleConfirmed?.races || []).map(raceIdentity).filter(Boolean)
    );
    const missingProjectedRows = projectedRows
      .filter(row => {
        const identity = raceIdentity(row);
        return identity && !recordedRaceIds.has(identity);
      });
    const missingRequiredG1 = missingProjectedRows
      .filter(row => isHardRequirement(row.requirementLevel, policy));
    const recommendedG1Gaps = missingProjectedRows
      .filter(row => requirementLevel(row.requirementLevel, policy.projectedG1DefaultRequirementLevel) === 'RECOMMENDED');
    const g1Status = projectedRows.length
      ? (missingRequiredG1.length
          ? 'PROJECTED_ONLY'
          : (recommendedG1Gaps.length ? 'RECOMMENDED_PENDING' : 'USER_RECORDED'))
      : 'NOT_REQUIRED';
    const handoffBlockers = [
      ...missingOutputs.map(item => ({
        code: 'OUTPUT_FACTOR_NOT_RECORDED',
        type: item.type,
        key: item.key,
        skillId: item.skillId
      })),
      ...missingRequiredG1.map(row => ({ code: 'G1_RESULT_NOT_RECORDED', raceIdentity: raceIdentity(row) }))
    ];
    const tradeoffs = [
      ...recommendedOutputGaps.map(item => ({
        code: 'RECOMMENDED_OUTPUT_NOT_RECORDED',
        type: item.type,
        key: item.key,
        skillId: item.skillId,
        requirementLevel: 'RECOMMENDED',
        message: `${item.nameZhTw || item.key || item.type} 未產出；可接受並交棒，但會少一個機率／效用加分。`
      })),
      ...recommendedG1Gaps.map(row => ({
        code: 'RECOMMENDED_G1_NOT_RECORDED',
        raceIdentity: raceIdentity(row),
        requirementLevel: 'RECOMMENDED',
        message: `建議 GⅠ ${row.nameZhTw || row.nameJp || raceIdentity(row)} 未跑或未勝；可接受並交棒，但共同 GⅠ 加分較少。`
      }))
    ];
    const needsBlueDecision = plannedOutputs.blue?.status === 'UNSPECIFIED';
    const isFinalTarget = step?.id === 'target' || step?.stage === 'target';
    const startStatus = startBlockers.length ? 'BLOCKED' : 'READY_TO_START';
    const handoffStatus = isFinalTarget
      ? 'FINAL_TARGET'
      : (handoffBlockers.length
        ? 'BLOCKED'
        : (needsBlueDecision
            ? 'PLAN_INCOMPLETE'
            : (tradeoffs.length ? 'READY_WITH_TRADEOFFS' : 'READY_TO_HANDOFF')));
    const warnings = [];
    if (needsBlueDecision && !isFinalTarget) {
      warnings.push({ code: 'BLUE_FACTOR_PLAN_UNSPECIFIED', message: '尚未指定本代藍因子目標；不影響開始育成，但施工規格尚未完整。' });
    }
    return {
      schemaVersion: 1,
      incoming,
      plannedOutputs,
      observedOutputs,
      continueWhen: {
        deck: 'UNKNOWN',
        incoming: startBlockers.length ? 'BLOCKED' : 'READY',
        deliverables: missingOutputs.length
          ? 'MISSING'
          : (needsBlueDecision
              ? 'NEEDS_DECISION'
              : (recommendedOutputGaps.length ? 'RECOMMENDED_PENDING' : 'READY')),
        g1: g1Status,
        startStatus,
        handoffStatus,
        status: handoffStatus,
        blockers: [...startBlockers, ...handoffBlockers],
        tradeoffs,
        warnings
      }
    };
  }

  function asBreederRecord(candidate, record = null) {
    if (!candidate) return null;
    const factors = record?.factors && typeof record.factors === 'object' ? record.factors : {};
    return {
      id: text(record?.id, candidate.id),
      character: {
        characterId: candidate.characterId,
        outfitId: candidate.outfitId,
        affinityKey: candidate.affinityKey,
        nameZhTw: candidate.nameZhTw,
        nameJp: candidate.nameJp
      },
      factors: {
        blue: record?.blueFactor ?? factors.blue ?? null,
        red: record?.redFactor ?? factors.red ?? null,
        green: record?.greenFactor ?? factors.green ?? null,
        white: record?.whiteFactors ?? factors.white ?? []
      },
      g1Wins: record?.g1Wins || [],
      projectedG1Schedule: record?.projectedG1Schedule || [],
      parentIds: record?.parentIds || [null, null]
    };
  }

  function inheritanceContracts(target, directParents, grandparents, input = {}) {
    const core = getBreederCore();
    const family = {
      target: asBreederRecord(
        target,
        breederRecordForStep(input, { id: 'target', candidate: target })
      ),
      parentA: asBreederRecord(
        directParents[0],
        breederRecordForStep(input, { id: 'parent:A', candidate: directParents[0] })
      ),
      parentB: asBreederRecord(
        directParents[1],
        breederRecordForStep(input, { id: 'parent:B', candidate: directParents[1] })
      ),
      parentA1: asBreederRecord(
        grandparents[0],
        breederRecordForStep(input, { id: `grandparent:${grandparents[0]?.slot || 'parentA1'}`, candidate: grandparents[0] })
      ),
      parentA2: asBreederRecord(
        grandparents[1],
        breederRecordForStep(input, { id: `grandparent:${grandparents[1]?.slot || 'parentA2'}`, candidate: grandparents[1] })
      ),
      parentB1: asBreederRecord(
        grandparents[2],
        breederRecordForStep(input, { id: `grandparent:${grandparents[2]?.slot || 'parentB1'}`, candidate: grandparents[2] })
      ),
      parentB2: asBreederRecord(
        grandparents[3],
        breederRecordForStep(input, { id: `grandparent:${grandparents[3]?.slot || 'parentB2'}`, candidate: grandparents[3] })
      ),
      unresolvedReferences: []
    };
    const options = g1Options(input);
    const requirements = normalizeRedRequirements(
      input.redFactorRequirements
      ?? input.aptitudeRequirements
      ?? target?.aptitudeRequirements
    );
    if (!core) {
      return {
        ruleset: { ...ZH_TW_G1_RULESET },
        confirmedG1Bonus: { total: 0, status: 'UNVERIFIED', pairs: [] },
        projectedG1Bonus: { total: 0, status: 'UNVERIFIED', scoreIncluded: false, pairs: [] },
        g1Edges: [],
        redByKey: {},
        aptitudePlan: [],
        autonomousEligibility: { status: 'UNVERIFIED', reasons: [] }
      };
    }
    const confirmedG1Bonus = core.calculateG1Bonus(family, options);
    const projectedG1Bonus = core.calculateProjectedG1Bonus(family, options);
    const red = core.aggregateRedFactors(family);
    const aptitude = core.evaluateAptitudeFeasibility({
      redByKey: red.redByKey,
      requirements,
      automationMode: input.automationMode ?? input.breedingAutomationMode,
      autonomous: input.autonomous,
      autonomousSchedule: input.autonomousSchedule
    });
    return {
      ruleset: confirmedG1Bonus.ruleset,
      confirmedG1Bonus,
      projectedG1Bonus,
      g1Edges: confirmedG1Bonus.pairs,
      redByKey: red.redByKey,
      aptitudePlan: aptitude.aptitudePlan,
      autonomousEligibility: aptitude.autonomousEligibility,
      warnings: [...(confirmedG1Bonus.warnings || []), ...(projectedG1Bonus.warnings || []), ...(aptitude.warnings || [])]
    };
  }

  function buildWorkOrder(target, directParents, grandparents, foundations, input = {}) {
    const uniqueFoundation = [];
    const foundationKeys = new Set();
    foundations.forEach(item => {
      const key = String(candidateIdentity(item));
      if (foundationKeys.has(key)) return;
      foundationKeys.add(key);
      const id = `foundation:${key}`;
      uniqueFoundation.push({
        id,
        stage: 'foundation',
        label: '前置素材',
        candidate: item,
        selectionBasis: item.selectionBasis,
        selectionReason: item.selectionReason,
        targets: uniqueTargets(foundations
          .filter(other => String(candidateIdentity(other)) === key)
          .flatMap(other => other.factorTargets || [])),
        dependsOn: [],
        reusedFor: foundations
          .filter(other => String(candidateIdentity(other)) === key)
          .map(other => other.childSlot),
        ...stepContract(item, id, input)
      });
    });
    const grandparentSteps = grandparents.filter(Boolean).map(grandparent => {
      const id = `grandparent:${grandparent.slot}`;
      return {
      id,
      stage: 'grandparent',
      label: '四祖代',
      candidate: grandparent,
      selectionBasis: grandparent.selectionBasis,
      selectionReason: grandparent.selectionReason,
      targets: grandparent.factorTargets || [],
      dependsOn: foundations
        .filter(seed => seed.childSlot === grandparent.slot)
        .map(seed => `foundation:${candidateIdentity(seed)}`),
      ...stepContract(grandparent, id, input)
      };
    });
    const parentSteps = directParents.filter(Boolean).map((parent, index) => {
      const branch = index === 0 ? 'A' : 'B';
      const id = `parent:${branch}`;
      return {
        id,
        stage: 'parent',
        label: '兩親代',
        candidate: parent,
        selectionBasis: parent.selectionBasis,
        selectionReason: parent.selectionReason,
        targets: parentFactorTargets(grandparents, branch),
        dependsOn: grandparentSteps
        .filter(step => step.candidate.branch === branch)
          .map(step => step.id),
        ...stepContract(parent, id, input)
      };
    });
    const targetId = 'target';
    const ordered = [
      ...uniqueFoundation,
      ...grandparentSteps,
      ...parentSteps,
      {
        id: targetId,
        stage: 'target',
        label: '最終戰馬',
        candidate: target,
        selectionBasis: { stage: 'target' },
        selectionReason: {
          summary: '最終戰馬是本次施工的服務目標',
          items: ['目標：完成最終戰馬育成']
        },
        targets: [],
        dependsOn: parentSteps.map(step => step.id),
        ...stepContract(target, targetId, input)
      }
    ].map((step, index) => ({ ...step, order: index + 1 }));
    const factorFlowInput = { ...input, lineageWorkSteps: ordered };
    return ordered.map(step => ({
      ...step,
      factorFlow: buildFactorFlow(step, factorFlowInput)
    }));
  }

  function buildReverseLineagePlan(input = {}) {
    const policy = normalizeDecisionPolicy(input.lineageDecisionPolicy ?? input.decisionPolicy);
    const target = normalizeTarget(input.target);
    const factorTargets = (input.factorTargets || [])
      .map(normalizeFactorTarget)
      .filter(item => item.id !== null || item.nameZhTw);
    const candidates = (input.candidates || []).map(normalizeCandidate);
    const foundationCandidates = (Array.isArray(input.foundationCandidates)
      ? input.foundationCandidates
      : input.candidates || [])
      .map(normalizeCandidate);
    const direct = resolveDirectParents(
      candidates,
      input.directParentSkillIds,
      target,
      factorTargets,
      input.affinityData,
      policy
    );
    const packages = buildFactorPackages(factorTargets);
    const grandparentResult = assignGrandparents(
      candidates,
      direct.parents,
      target,
      packages,
      input.affinityData,
      policy
    );
    const foundations = assignFoundationSeeds(
      foundationCandidates,
      grandparentResult.grandparents,
      [target, ...direct.parents, ...grandparentResult.grandparents].filter(Boolean),
      input.affinityData,
      target,
      policy
    );
    const workOrder = buildWorkOrder(
      target,
      direct.parents,
      grandparentResult.grandparents,
      foundations,
      input
    );
    const contracts = inheritanceContracts(
      target,
      direct.parents,
      grandparentResult.grandparents,
      input
    );
    return {
      schemaVersion: 2,
      ruleset: contracts.ruleset,
      decisionPolicy: cloneValue(policy),
      inheritanceProbabilityModel: input.inheritanceProbabilityModel
        ? cloneValue(input.inheritanceProbabilityModel)
        : null,
      target,
      directParents: direct.parents,
      grandparents: grandparentResult.grandparents,
      foundations,
      factorPackages: packages,
      workOrder,
      confirmedG1Bonus: contracts.confirmedG1Bonus,
      projectedG1Bonus: contracts.projectedG1Bonus,
      g1Edges: contracts.g1Edges,
      redByKey: contracts.redByKey,
      aptitudePlan: contracts.aptitudePlan,
      autonomousEligibility: contracts.autonomousEligibility,
      warnings: [...direct.warnings, ...grandparentResult.warnings, ...(contracts.warnings || [])],
      assumptions: {
        activeLineage: '最終育成只直接計入兩親代與四祖代；前置素材只是製作這六名種馬的施工順序。',
        acquisition: '直接親代固有視為育成開始時確定取得；祖代固有與白因子仍是繼承抽選。',
        optimization: '候選依賽道固有價值、相性、可學目標技能、技能 Pt 成本、白因子化代理、適性、G1 廣度與三冠底座路線排序；固定目標賽相衝、路線紅因子成本及基礎相性分開保留，最終六格排除同角色重複，不宣稱是遊戲隱藏公式。',
        g1Evidence: '共同 G1 只使用可驗證的繁中服 zh_tw-2024-06-27 G1 WIN／finishPosition=1；預定賽程只作施工契約，絕不加進 confirmed 分數。',
        redFactors: '紅因子需求按鍵分開列出；開局最高 A，後續繼承與自主育成可行性維持 UNVERIFIED。',
        tradeoffs: policy.principle,
        probability: '相性、共同 GⅠ、泥地歷戰與社群機率表只用來排序／說明期望值；不會把社群估計、PROJECTED 或 USER_RECORDED 升格成官方精確機率。'
      }
    };
  }

  return {
    DIRECT_SLOTS,
    GRANDPARENT_SLOTS,
    ZH_TW_G1_RULESET,
    DEFAULT_LINEAGE_DECISION_POLICY,
    normalizeDecisionPolicy,
    normalizeCandidate,
    normalizeFactorTarget,
    normalizeRaceEvidence,
    normalizeRedRequirements,
    affinityScore,
    buildFactorPackages,
    foundationRouteCompatibility,
    stepContract,
    inheritanceContracts,
    buildReverseLineagePlan
  };
});
