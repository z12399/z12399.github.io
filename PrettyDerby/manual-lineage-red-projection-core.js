(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MANUAL_LINEAGE_RED_PROJECTION_CORE = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const SCHEMA_VERSION = 1;
  const SLOT_IDS = Object.freeze([
    'target',
    'parentA',
    'parentB',
    'parentA1',
    'parentA2',
    'parentB1',
    'parentB2'
  ]);
  const INCOMING_SOURCE_SLOTS = Object.freeze({
    target: Object.freeze(['parentA', 'parentB']),
    parentA: Object.freeze(['parentA1', 'parentA2']),
    parentB: Object.freeze(['parentB1', 'parentB2']),
    parentA1: Object.freeze([]),
    parentA2: Object.freeze([]),
    parentB1: Object.freeze([]),
    parentB2: Object.freeze([])
  });

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function text(value, fallback = '') {
    const result = value == null ? '' : String(value).trim();
    return result || fallback;
  }

  function number(value, fallback = 0) {
    if (value === null || value === undefined || value === '') return fallback;
    const result = Number(value);
    return Number.isFinite(result) ? result : fallback;
  }

  function clone(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
  }

  function factorEntries(raw) {
    if (raw === null || raw === undefined) return [];
    if (Array.isArray(raw)) return raw;
    if (!isObject(raw)) return [];
    if (raw.key !== undefined || raw.aptitudeKey !== undefined
      || raw.redFactorKey !== undefined || raw.type !== undefined) return [raw];
    if (Array.isArray(raw.factors)) return raw.factors;
    if (isObject(raw.factors)) return factorEntries(raw.factors);
    if (Array.isArray(raw.values)) return raw.values;
    if (isObject(raw.byKey)) return factorEntries(raw.byKey);
    return [];
  }

  function stateRedFactors(input) {
    const source = isObject(input) ? input : {};
    return source.manualLineage?.redFactors
      || source.redFactors
      || {};
  }

  function outgoingEntriesForSlot(input, slotId) {
    const raw = stateRedFactors(input)?.[slotId];
    return factorEntries(raw)
      .map(entry => {
        const key = text(entry?.key ?? entry?.aptitudeKey ?? entry?.redFactorKey ?? entry?.type);
        const stars = Math.max(0, number(entry?.stars ?? entry?.star ?? entry?.level, 0));
        if (!key || stars <= 0) return null;
        // A manual slot is one distinct upstream source.  Keep that identity
        // stable so g1-schedule-core can deduplicate repeated UI records from
        // this same slot without merging A/B branches.
        return {
          key,
          stars,
          sourceSlotId: slotId,
          sourceStepId: `manual-lineage:${slotId}`,
          sourceStepIds: [`manual-lineage:${slotId}`],
          direction: 'outgoing',
          projectionStatus: 'PROJECTED',
          evidenceStatus: 'PROJECTED'
        };
      })
      .filter(Boolean);
  }

  function normalizedIncoming(g1ScheduleCore, entries) {
    if (typeof g1ScheduleCore?.normalizeIncomingRedFactors !== 'function') {
      return {
        provided: entries.length > 0,
        direction: 'incoming',
        factors: clone(entries),
        byKey: Object.fromEntries(entries.map(entry => [entry.key, clone(entry)]))
      };
    }
    return g1ScheduleCore.normalizeIncomingRedFactors({
      incomingRedFactors: entries
    });
  }

  function buildIncomingProjection(input = {}) {
    const slotIds = Array.isArray(input.slotIds) && input.slotIds.length
      ? input.slotIds.map(value => text(value)).filter(Boolean)
      : SLOT_IDS.slice();
    const bySlot = Object.fromEntries(slotIds.map(slotId => {
      const sourceSlotIds = INCOMING_SOURCE_SLOTS[slotId] || [];
      const outgoingEntries = sourceSlotIds.flatMap(sourceSlotId =>
        outgoingEntriesForSlot(input.state || input, sourceSlotId)
      );
      const normalized = normalizedIncoming(input.g1ScheduleCore, outgoingEntries);
      return [slotId, {
        schemaVersion: SCHEMA_VERSION,
        slotId,
        sourceSlotIds: sourceSlotIds.slice(),
        direction: 'incoming',
        status: 'PROJECTED',
        projectionStatus: 'PROJECTED',
        evidenceStatus: 'UNVERIFIED',
        configured: outgoingEntries.length > 0,
        incomingRedFactors: clone(normalized.factors || []),
        incomingRedByKey: clone(normalized.byKey || {}),
        sourceEntries: clone(outgoingEntries)
      }];
    }));
    return {
      schemaVersion: SCHEMA_VERSION,
      status: 'PROJECTED',
      projectionStatus: 'PROJECTED',
      evidenceStatus: 'UNVERIFIED',
      sourceDirection: 'outgoing',
      incomingDirection: 'incoming',
      slotIds,
      bySlot
    };
  }

  function buildProjectedG1Schedule(input = {}) {
    const state = input.state || input;
    const slotIds = Array.isArray(input.slotIds) && input.slotIds.length
      ? input.slotIds.map(value => text(value)).filter(Boolean)
      : SLOT_IDS.slice();
    const projection = input.projection || buildIncomingProjection({
      state,
      slotIds,
      g1ScheduleCore: input.g1ScheduleCore
    });
    const slots = isObject(input.slots) ? input.slots : {};
    const candidates = slotIds
      .map(slotId => {
        const card = slots[slotId]?.card;
        if (!card) return null;
        const projected = projection.bySlot[slotId] || {};
        return {
          id: slotId,
          slot: slotId,
          nameZhTw: card.nameZhTw || card.name || card.nameJp || slotId,
          nameJp: card.nameJp,
          outfitId: card.id,
          characterId: card.characterId,
          aptitude: Array.isArray(card.aptitude) ? card.aptitude.slice() : card.aptitudes,
          incomingRedFactors: clone(projected.incomingRedFactors || []),
          outgoingRedFactors: clone(outgoingEntriesForSlot(state, slotId))
        };
      })
      .filter(Boolean);
    const g1 = input.g1ScheduleCore;
    const schedule = typeof g1?.buildProjectedG1Schedule === 'function'
      ? g1.buildProjectedG1Schedule({
        ...(isObject(input.g1Options) ? input.g1Options : {}),
        raceCatalog: input.raceCatalog,
        candidates,
        automationMode: input.automationMode ?? 'autonomous'
      })
      : null;
    const bySlot = Object.fromEntries(slotIds.map(slotId => [slotId, {
      ...projection.bySlot[slotId],
      candidateId: slotId,
      g1Plan: schedule?.candidatePlansById?.[slotId] || null
    }]));
    return {
      ...projection,
      bySlot,
      g1Schedule: schedule,
      g1Status: schedule?.status || 'UNAVAILABLE'
    };
  }

  return {
    SCHEMA_VERSION,
    SLOT_IDS,
    INCOMING_SOURCE_SLOTS,
    outgoingEntriesForSlot,
    buildIncomingProjection,
    buildProjectedG1Schedule,
    project: buildProjectedG1Schedule
  };
});
