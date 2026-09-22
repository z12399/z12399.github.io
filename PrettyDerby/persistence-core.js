(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PERSISTENCE_CORE = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const SCHEMA_VERSION = 3;
  const STORAGE_KEY = 'pretty-derby-factor-planner:v2';
  const ZH_TW_G1_RULESET_ID = 'zh_tw-2024-06-27';
  const ZH_TW_SERVER = 'zh_tw';
  const FACTOR_STAT_AXES = Object.freeze(['speed', 'stamina', 'power', 'guts', 'wisdom']);
  const MANUAL_LINEAGE_SLOT_IDS = Object.freeze([
    'target',
    'parentA',
    'parentB',
    'parentA1',
    'parentA2',
    'parentB1',
    'parentB2'
  ]);
  const MANUAL_LINEAGE_RED_FACTOR_KEYS = Object.freeze([
    'turf',
    'dirt',
    'short',
    'mile',
    'medium',
    'long',
    'runner',
    'leader',
    'betweener',
    'chaser'
  ]);
  const MANUAL_LINEAGE_RED_FACTOR_ALIASES = Object.freeze({
    front: 'runner',
    pace: 'leader',
    late: 'betweener',
    end: 'chaser'
  });

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function text(value, fallback = '') {
    return typeof value === 'string' ? value.trim() : fallback;
  }

  function finiteNumber(value, fallback = null) {
    if (value === null || value === undefined || value === '') return fallback;
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function stars(value) {
    return Math.max(1, Math.min(3, finiteNumber(value, 1)));
  }

  function uniqueList(values, mapper = value => value) {
    const output = [];
    const seen = new Set();
    for (const raw of Array.isArray(values) ? values : []) {
      const value = mapper(raw);
      if (value == null || value === '' || seen.has(String(value))) continue;
      seen.add(String(value));
      output.push(value);
    }
    return output;
  }

  function createId(prefix = 'record') {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `${prefix}-${crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function normalizeFactor(raw, fallbackType = '') {
    if (!raw || typeof raw !== 'object') return { type: fallbackType, stars: 1 };
    return {
      type: text(raw.type, fallbackType),
      stars: stars(raw.stars)
    };
  }

  function normalizeWhiteFactor(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const skillId = finiteNumber(raw.skillId);
    const name = text(raw.name);
    if (!Number.isFinite(skillId) && !name) return null;
    return {
      id: text(raw.id) || createId('factor'),
      skillId,
      name,
      stars: stars(raw.stars),
      note: text(raw.note)
    };
  }

  function catalogRaceEntries(catalog) {
    if (catalog instanceof Map) return [...catalog.values()];
    if (Array.isArray(catalog)) return catalog;
    if (!catalog || typeof catalog !== 'object') return [];
    if (Array.isArray(catalog.races)) return catalog.races;
    if (Array.isArray(catalog.records)) return catalog.records;
    return Object.values(catalog).filter(value => value && typeof value === 'object');
  }

  function raceCatalogLookup(catalog) {
    const byCatalogId = new Map();
    const byCanonicalRaceId = new Map();
    catalogRaceEntries(catalog).forEach(raw => {
      const catalogRaceId = finiteNumber(raw.catalogRaceId ?? raw.catalogId ?? raw.id);
      const canonicalRaceId = finiteNumber(raw.canonicalRaceId ?? raw.raceId ?? raw.baseRaceId);
      if (!Number.isFinite(catalogRaceId) || !Number.isFinite(canonicalRaceId)) return;
      const entry = {
        catalogRaceId,
        canonicalRaceId,
        grade: raw.grade ?? null,
        nameZhTw: text(raw.nameZhTw ?? raw.name),
        nameJp: text(raw.nameJp),
        urlName: text(raw.urlName)
      };
      byCatalogId.set(String(catalogRaceId), entry);
      const key = String(canonicalRaceId);
      if (!byCanonicalRaceId.has(key)) byCanonicalRaceId.set(key, []);
      byCanonicalRaceId.get(key).push(entry);
    });
    return { byCatalogId, byCanonicalRaceId };
  }

  function migrationContext(options = {}) {
    const source = options && typeof options === 'object' ? options : {};
    const ruleset = text(source.rulesetId ?? source.ruleset) || ZH_TW_G1_RULESET_ID;
    const server = text(source.server) || ZH_TW_SERVER;
    return { ruleset, server };
  }

  function legacyCatalogRace(raw, options = {}) {
    const value = finiteNumber(raw);
    if (!Number.isFinite(value)) return null;
    const lookup = raceCatalogLookup(options.raceCatalog ?? options.catalog ?? options.gameToraRaceCatalog);
    const catalogMatch = lookup.byCatalogId.get(String(value));
    if (catalogMatch) return catalogMatch;
    const canonicalMatches = lookup.byCanonicalRaceId.get(String(value)) || [];
    if (!canonicalMatches.length) return null;
    const canonicalRaceIds = new Set(canonicalMatches.map(item => item.canonicalRaceId));
    return canonicalRaceIds.size === 1 ? canonicalMatches[0] : null;
  }

  function normalizeG1Evidence(raw, options = {}) {
    if (raw === null || raw === undefined || raw === '') return null;
    const legacyNumeric = typeof raw === 'number' || (typeof raw === 'string' && /^\d+$/.test(raw.trim()));
    if (legacyNumeric) {
      const legacyCatalogRaceId = finiteNumber(raw);
      const resolved = legacyCatalogRace(raw, options);
      if (!resolved) {
        return {
          legacyCatalogRaceId,
          catalogRaceId: null,
          canonicalRaceId: null,
          verificationStatus: 'UNVERIFIED',
          migrationStatus: 'LEGACY_CATALOG_UNRESOLVED',
          source: 'legacy-numeric-g1Wins'
        };
      }
      const context = migrationContext(options);
      return {
        catalogRaceId: resolved.catalogRaceId,
        canonicalRaceId: resolved.canonicalRaceId,
        grade: resolved.grade,
        nameZhTw: resolved.nameZhTw,
        nameJp: resolved.nameJp,
        urlName: resolved.urlName,
        server: context.server,
        ruleset: context.ruleset,
        outcomeStatus: 'WIN',
        finishPosition: 1,
        verificationStatus: 'MIGRATED_CATALOG_RESOLVED',
        migrationStatus: 'LEGACY_CATALOG_RESOLVED',
        source: 'legacy-numeric-g1Wins'
      };
    }
    if (!raw || typeof raw !== 'object') return null;
    const evidence = clone(raw);
    const catalogRaceId = finiteNumber(raw.catalogRaceId ?? raw.catalogId ?? raw.id);
    const canonicalRaceId = finiteNumber(raw.canonicalRaceId ?? raw.raceId ?? raw.baseRaceId);
    const verificationStatus = text(raw.verificationStatus ?? raw.evidenceStatus);
    return {
      ...evidence,
      catalogRaceId,
      canonicalRaceId,
      // Do not invent missing outcome/server/ruleset fields for structured input.
      // Breeder core will reject it from scoring until real evidence is supplied.
      ...(verificationStatus ? { verificationStatus } : {})
    };
  }

  function normalizeG1EvidenceList(values, options = {}) {
    const output = [];
    const seen = new Set();
    for (const raw of (Array.isArray(values) ? values : (values == null ? [] : [values]))) {
      const evidence = normalizeG1Evidence(raw, options);
      if (!evidence) continue;
      const key = String(
        evidence.catalogRaceId
        ?? evidence.legacyCatalogRaceId
        ?? `${evidence.canonicalRaceId ?? ''}|${evidence.outcomeStatus ?? ''}|${evidence.finishPosition ?? ''}`
      );
      if (seen.has(key)) continue;
      seen.add(key);
      output.push(evidence);
    }
    return output;
  }

  function normalizeProjectedG1Schedule(values, options = {}) {
    const items = Array.isArray(values) ? values : (values == null ? [] : [values]);
    return items.map(raw => {
      if (!raw || typeof raw !== 'object') return null;
      const source = clone(raw);
      return {
        ...source,
        catalogRaceId: finiteNumber(raw.catalogRaceId ?? raw.catalogId ?? raw.id),
        canonicalRaceId: finiteNumber(raw.canonicalRaceId ?? raw.raceId ?? raw.baseRaceId),
        projectionStatus: 'PROJECTED',
        verificationStatus: text(raw.verificationStatus) || 'UNVERIFIED'
      };
    }).filter(Boolean);
  }

  function normalizeProfileIdentity(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const profileId = text(raw.profileId || raw.id);
    const catalogRaceId = finiteNumber(raw.catalogRaceId);
    const courseId = finiteNumber(raw.courseId);
    const eventMode = raw.eventMode === 'loh' ? 'loh' : raw.eventMode === 'cm' ? 'cm' : '';
    if (!profileId && !Number.isFinite(catalogRaceId) && !Number.isFinite(courseId)) return null;
    return {
      profileId,
      catalogRaceId,
      courseId,
      eventMode
    };
  }

  function normalizeBreeder(raw, options = {}) {
    if (!raw || typeof raw !== 'object') return null;
    const outfitId = finiteNumber(raw.outfitId);
    const characterId = finiteNumber(raw.characterId);
    const affinityKey = text(raw.affinityKey);
    const name = text(raw.name);
    if (!name && !Number.isFinite(outfitId) && !affinityKey) return null;
    const parentIds = Array.isArray(raw.parentIds)
      ? raw.parentIds.slice(0, 2).map(value => text(value) || null)
      : [text(raw.parentAId) || null, text(raw.parentBId) || null];
    while (parentIds.length < 2) parentIds.push(null);
    return {
      id: text(raw.id) || createId('breeder'),
      name: name || `未命名種馬 ${String(outfitId || '').trim()}`,
      outfitId,
      characterId,
      affinityKey,
      rating: Math.max(0, finiteNumber(raw.rating, 0)),
      blueFactor: normalizeFactor(raw.blueFactor, '速度'),
      redFactor: normalizeFactor(raw.redFactor, '長距離'),
      greenFactor: normalizeFactor(raw.greenFactor, ''),
      whiteFactors: (Array.isArray(raw.whiteFactors) ? raw.whiteFactors : [])
        .map(normalizeWhiteFactor)
        .filter(Boolean),
      parentIds,
      // Legacy numeric g1Wins are migrated only when the caller supplies a
      // resolvable GameTora catalog. Otherwise the entry survives as explicitly
      // UNVERIFIED evidence and can never be silently scored.
      g1Wins: normalizeG1EvidenceList(raw.g1Wins, options),
      projectedG1Schedule: normalizeProjectedG1Schedule(
        raw.projectedG1Schedule
        ?? raw.g1Schedule
        ?? raw.scheduledG1Races
        ?? raw.plannedG1Races,
        options
      ),
      notes: text(raw.notes),
      createdAt: text(raw.createdAt) || new Date().toISOString(),
      updatedAt: text(raw.updatedAt) || new Date().toISOString()
    };
  }

  function normalizeFactorExecutionState(raw) {
    const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const targets = Object.fromEntries(FACTOR_STAT_AXES.map(axis => {
      const value = source.targets?.[axis];
      const row = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
      return [axis, {
        minimum: Math.max(0, finiteNumber(row.minimum, 0)) || null,
        target: Math.max(0, finiteNumber(row.target, 0)) || null,
        belowWeight: Math.max(0, finiteNumber(row.belowWeight, 1)),
        surplusWeight: Math.max(0, finiteNumber(row.surplusWeight, 0.25))
      }];
    }));
    return {
      templateId: text(source.templateId, 'manual'),
      riskProfileId: ['stable', 'balanced', 'upside'].includes(source.riskProfileId)
        ? source.riskProfileId
        : 'balanced',
      tradeoffBudgetPercent: Math.max(0, Math.min(30, finiteNumber(source.tradeoffBudgetPercent, 10))),
      targets
    };
  }

  function normalizeManualLineageState(raw) {
    const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const rawSlots = source.slots && typeof source.slots === 'object' && !Array.isArray(source.slots)
      ? source.slots
      : {};
    const rawFactors = source.redFactors && typeof source.redFactors === 'object' && !Array.isArray(source.redFactors)
      ? source.redFactors
      : {};
    const rawOptionalRaces = source.optionalRaces
      && typeof source.optionalRaces === 'object'
      && !Array.isArray(source.optionalRaces)
        ? source.optionalRaces
        : {};
    const slots = Object.fromEntries(MANUAL_LINEAGE_SLOT_IDS.map(slotId => [
      slotId,
      finiteNumber(rawSlots[slotId])
    ]));
    const redFactors = Object.fromEntries(MANUAL_LINEAGE_SLOT_IDS.map(slotId => {
      const row = rawFactors[slotId];
      const rawKey = text(row?.key ?? row?.type).toLowerCase();
      const key = MANUAL_LINEAGE_RED_FACTOR_ALIASES[rawKey] || rawKey;
      return [slotId, MANUAL_LINEAGE_RED_FACTOR_KEYS.includes(key)
        ? { key, stars: stars(row?.stars) }
        : null];
    }));
    const optionalRaces = Object.fromEntries(MANUAL_LINEAGE_SLOT_IDS.map(slotId => {
      const rows = Array.isArray(rawOptionalRaces[slotId]) ? rawOptionalRaces[slotId] : [];
      return [slotId, rows.slice(0, 30).map((row, index) => {
        const catalogRaceId = finiteNumber(row?.catalogRaceId ?? row?.raceId);
        const rawTurn = finiteNumber(row?.turn);
        if (!Number.isFinite(catalogRaceId) || !Number.isFinite(rawTurn)) return null;
        const turn = Math.max(1, Math.min(99, Math.trunc(rawTurn)));
        const rawRequirementLevel = text(row?.requirementLevel, 'OPTIONAL').toUpperCase();
        return {
          id: text(row?.id) || `optional:${slotId}:${index}:${catalogRaceId}:${turn}`,
          catalogRaceId,
          canonicalRaceId: finiteNumber(row?.canonicalRaceId),
          turn,
          nameZhTw: text(row?.nameZhTw ?? row?.name),
          requirementLevel: ['USER_REQUIRED', 'RECOMMENDED', 'OPTIONAL'].includes(rawRequirementLevel)
            ? rawRequirementLevel
            : 'OPTIONAL',
          reason: text(row?.reason),
          server: text(row?.server, 'zh_tw'),
          ruleset: text(row?.ruleset, ZH_TW_G1_RULESET_ID),
          sourceStatus: 'USER_RECORDED'
        };
      }).filter(Boolean)];
    }));
    const requestedScheduleSlot = text(source.activeScheduleSlot);
    return {
      schemaVersion: 1,
      slots,
      redFactors,
      includeGoalRaces: source.includeGoalRaces !== false,
      activeScheduleSlot: MANUAL_LINEAGE_SLOT_IDS.includes(requestedScheduleSlot)
        ? requestedScheduleSlot
        : 'target',
      optionalRaces
    };
  }

  function normalizePlannerState(raw) {
    const state = raw && typeof raw === 'object' ? raw : {};
    const battleDeckCardIds = Array.from({ length: 6 }, (_, index) =>
      finiteNumber(state.battleDeckCardIds?.[index])
    );
    return {
      activePanel: ['goal', 'parents', 'deck'].includes(state.activePanel)
        ? state.activePanel
        : 'goal',
      parentSubview: ['strategy', 'battle', 'parents', 'library'].includes(state.parentSubview)
        ? state.parentSubview
        : 'strategy',
      selectedRaceKeys: uniqueList(state.selectedRaceKeys, value => text(value)),
      primaryRaceKey: text(state.primaryRaceKey),
      profileIdentity: normalizeProfileIdentity(state.profileIdentity),
      customRaces: Array.isArray(state.customRaces) ? clone(state.customRaces) : [],
      battleUmaOutfitId: finiteNumber(state.battleUmaOutfitId),
      selectedAccelerationSkillIds: uniqueList(
        state.selectedAccelerationSkillIds,
        value => finiteNumber(value)
      ).filter(Number.isFinite),
      residualFactorDecisionConfirmed: state.residualFactorDecisionConfirmed === true,
      battleOwnedCardsConfirmed: state.battleOwnedCardsConfirmed === true,
      scenarioId: text(state.scenarioId),
      eventMode: state.eventMode === 'loh' ? 'loh' : 'cm',
      inheritanceMode: text(state.inheritanceMode, 'balanced'),
      breedingAutomationMode: state.breedingAutomationMode === 'omakase'
        ? 'omakase'
        : 'autonomous',
      factorSpecificationEnabled: state.factorSpecificationEnabled !== false,
      applyBattleDeckCoverage: state.applyBattleDeckCoverage !== false,
      mainParentSkillId: finiteNumber(state.mainParentSkillId),
      subParentSkillId: finiteNumber(state.subParentSkillId),
      parentSelectionPackageId: text(state.parentSelectionPackageId),
      battleDeckCardIds,
      deckPackageId: text(state.deckPackageId),
      deckPackageModelVersion: Math.max(0, Math.trunc(finiteNumber(state.deckPackageModelVersion, 0))),
      battleDeckBorrowedIndex: Math.max(
        0,
        Math.min(5, Math.trunc(finiteNumber(state.battleDeckBorrowedIndex, 5)))
      ),
      familyTargetAffinityKey: text(state.familyTargetAffinityKey),
      familyParentBreederIds: [
        text(state.familyParentBreederIds?.[0]) || null,
        text(state.familyParentBreederIds?.[1]) || null
      ],
      lineageBreederRecordBindings: Object.fromEntries(
        Object.entries(
          state.lineageBreederRecordBindings
          && typeof state.lineageBreederRecordBindings === 'object'
          && !Array.isArray(state.lineageBreederRecordBindings)
            ? state.lineageBreederRecordBindings
            : {}
        )
          .map(([stepId, recordId]) => [text(stepId), text(recordId)])
          .filter(([stepId, recordId]) => stepId && recordId)
      ),
      manualLineage: normalizeManualLineageState(state.manualLineage),
      factorExecution: normalizeFactorExecutionState(state.factorExecution),
      checklist: {
        factorReady: Boolean(state.checklist?.factorReady),
        skillPointReady: Boolean(state.checklist?.skillPointReady)
      },
      stamina: state.stamina && typeof state.stamina === 'object' ? clone(state.stamina) : {}
    };
  }

  function emptyDocument() {
    return {
      schemaVersion: SCHEMA_VERSION,
      savedAt: null,
      plannerState: normalizePlannerState({}),
      breeders: []
    };
  }

  function normalizeDocument(raw, options = {}) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const breeders = (Array.isArray(source.breeders) ? source.breeders : [])
      .map(breeder => normalizeBreeder(breeder, options))
      .filter(Boolean);
    const uniqueBreeders = [];
    const seen = new Set();
    for (const breeder of breeders) {
      if (seen.has(breeder.id)) breeder.id = createId('breeder');
      seen.add(breeder.id);
      uniqueBreeders.push(breeder);
    }
    const knownIds = new Set(uniqueBreeders.map(item => item.id));
    uniqueBreeders.forEach(item => {
      item.parentIds = item.parentIds.map(id => knownIds.has(id) && id !== item.id ? id : null);
    });
    const plannerState = normalizePlannerState(source.plannerState || source.state);
    plannerState.familyParentBreederIds = plannerState.familyParentBreederIds
      .map(id => knownIds.has(id) ? id : null);
    plannerState.lineageBreederRecordBindings = Object.fromEntries(
      Object.entries(plannerState.lineageBreederRecordBindings || {})
        .filter(([, recordId]) => knownIds.has(recordId))
    );
    return {
      schemaVersion: SCHEMA_VERSION,
      savedAt: text(source.savedAt) || null,
      plannerState,
      breeders: uniqueBreeders
    };
  }

  function resolveStorage(storage) {
    if (storage) return storage;
    try {
      return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch {
      return null;
    }
  }

  function load(storage, options = {}) {
    const target = resolveStorage(storage);
    if (!target) return { document: emptyDocument(), status: 'unavailable', error: null };
    try {
      const raw = target.getItem(STORAGE_KEY);
      if (!raw) return { document: emptyDocument(), status: 'empty', error: null };
      return {
        document: normalizeDocument(JSON.parse(raw), options),
        status: 'loaded',
        error: null
      };
    } catch (error) {
      return { document: emptyDocument(), status: 'invalid', error };
    }
  }

  function save(document, storage, options = {}) {
    const target = resolveStorage(storage);
    if (!target) return { ok: false, error: new Error('瀏覽器不允許使用本機儲存空間') };
    try {
      const normalized = normalizeDocument({
        ...document,
        savedAt: new Date().toISOString()
      }, options);
      target.setItem(STORAGE_KEY, JSON.stringify(normalized));
      return { ok: true, document: normalized, error: null };
    } catch (error) {
      return { ok: false, error };
    }
  }

  function remove(storage) {
    const target = resolveStorage(storage);
    if (!target) return false;
    try {
      target.removeItem(STORAGE_KEY);
      return true;
    } catch {
      return false;
    }
  }

  function serialize(document, options = {}) {
    const normalized = normalizeDocument({
      ...document,
      savedAt: new Date().toISOString()
    }, options);
    return JSON.stringify(normalized, null, 2);
  }

  function parseImport(value, options = {}) {
    const parsed = typeof value === 'string' ? JSON.parse(value.replace(/^\uFEFF/, '')) : value;
    return normalizeDocument(parsed, options);
  }

  return {
    SCHEMA_VERSION,
    STORAGE_KEY,
    ZH_TW_G1_RULESET_ID,
    ZH_TW_SERVER,
    createId,
    raceCatalogLookup,
    legacyCatalogRace,
    normalizeG1Evidence,
    normalizeG1EvidenceList,
    normalizeProjectedG1Schedule,
    emptyDocument,
    normalizeBreeder,
    normalizeFactorExecutionState,
    normalizeManualLineageState,
    normalizePlannerState,
    normalizeDocument,
    load,
    save,
    remove,
    serialize,
    parseImport
  };
});
