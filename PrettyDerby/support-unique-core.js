(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SUPPORT_UNIQUE_CORE = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

/*
 * Auditable parser/evaluator for GameTora support-card unique effects.
 *
 * The raw source is the only authority for card parameters.  The contracts
 * below describe how those parameters are interpreted at runtime; they do
 * not mutate the source profile and they never turn missing context into a
 * numeric zero.  This module deliberately has no dependency on the deck
 * optimizer so it can be reviewed and tested in isolation before integration.
 */

const STATUS = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  CONDITIONAL: 'conditional',
  UNSUPPORTED: 'unsupported'
});

const UNIQUE_TYPES = Object.freeze(
  Array.from({ length: 22 }, (_, index) => index + 101)
);

const MAX_SUPPORT_DECK_SIZE = 6;
const INITIAL_STAT_EFFECT_BY_SUPPORT_TYPE = Object.freeze({
  speed: 9,
  stamina: 10,
  power: 11,
  guts: 12,
  wisdom: 13,
  wit: 13
});
const TRAINING_STAT_EFFECT_BY_SUPPORT_TYPE = Object.freeze({
  speed: 3,
  stamina: 4,
  power: 5,
  guts: 6,
  wisdom: 7,
  wit: 7
});
const STAT_EFFECTS = Object.freeze([9, 10, 11, 12, 13]);
const TRAINING_STAT_EFFECTS = Object.freeze([3, 4, 5, 6, 7]);

const TYPE_CONTRACTS = Object.freeze({
  101: {
    conditionKind: 'bond-at-least',
    requiredContext: ['bond'],
    parameterShape: ['value', 'value_1', 'value_2', 'value_3?', 'value_4?'],
    crossCheck: 'Bond gate; one or two ordinary support effects.',
    reliability: 'raw-parameter-exact'
  },
  102: {
    conditionKind: 'bond-at-least-and-not-specialty',
    requiredContext: ['bond', 'trainingState.isSpecialtyTraining'],
    parameterShape: ['value', 'value_1'],
    crossCheck: 'Bond gate plus not training in the card specialty.',
    reliability: 'raw-parameter-exact'
  },
  103: {
    conditionKind: 'support-type-count-at-least',
    requiredContext: ['supportTypeCount'],
    parameterShape: ['value', 'value_1'],
    crossCheck: 'Different support types in the deck gate training effectiveness.',
    reliability: 'raw-parameter-exact'
  },
  104: {
    conditionKind: 'fan-count-scaled',
    requiredContext: ['fanCount'],
    parameterShape: ['value', 'value_1'],
    crossCheck: 'Training effectiveness increases by fan threshold, capped by value_1.',
    reliability: 'raw-parameter-exact'
  },
  105: {
    conditionKind: 'deck-initial-stat-by-support-type',
    requiredContext: ['deckState.cards'],
    parameterShape: ['value', 'value_1'],
    crossCheck: 'Each deck card grants initial stats by support type; Friend/Group use value_1 on every stat.',
    reliability: 'raw-parameter-exact'
  },
  106: {
    conditionKind: 'training-count-scaled',
    requiredContext: ['trainingCount'],
    parameterShape: ['value', 'value_1', 'value_2'],
    crossCheck: 'One effect unit is gained per friendship training, capped by value.',
    reliability: 'raw-parameter-exact'
  },
  107: {
    conditionKind: 'energy-scaled',
    requiredContext: ['energy'],
    parameterShape: ['value', 'value_1', 'value_2', 'value_3', 'value_4'],
    crossCheck: 'Current-energy curve; raw gives the effect type, curve anchors, and upper/lower values.',
    reliability: 'bounded-curve'
  },
  108: {
    conditionKind: 'maximum-energy-scaled',
    requiredContext: ['maxEnergy'],
    parameterShape: ['value', 'value_1', 'value_2', 'value_3', 'value_4'],
    crossCheck: 'Maximum-energy curve; 5 at 100 and 20 at 120 for the released instances.',
    reliability: 'bounded-curve'
  },
  109: {
    conditionKind: 'combined-bond-scaled',
    requiredContext: ['combinedSupportBond'],
    parameterShape: ['value', 'value_1'],
    crossCheck: 'Training effectiveness increases once per bond step across all support bonds, capped at 20 for a six-card deck.',
    reliability: 'raw-parameter-exact'
  },
  110: {
    conditionKind: 'same-training-support-count-scaled',
    requiredContext: ['sameTrainingSupportCount'],
    parameterShape: ['value', 'value_1'],
    crossCheck: 'Effect increases for each other support in the same training facility.',
    reliability: 'raw-parameter-exact'
  },
  111: {
    conditionKind: 'facility-level-scaled',
    requiredContext: ['facilityLevel'],
    parameterShape: ['value', 'value_1'],
    crossCheck: 'Effect increases by value_1 for each current facility level.',
    reliability: 'raw-parameter-exact'
  },
  112: {
    conditionKind: 'chance-based',
    requiredContext: ['randomOutcome'],
    parameterShape: ['value'],
    crossCheck: 'Chance to make the current training failure rate zero.',
    reliability: 'raw-parameter-exact'
  },
  113: {
    conditionKind: 'friendship-training-state',
    requiredContext: ['trainingState.isFriendshipTraining'],
    parameterShape: ['value', 'value_1'],
    crossCheck: 'Effect is granted while participating in friendship/rainbow training.',
    reliability: 'raw-parameter-exact'
  },
  114: {
    conditionKind: 'current-energy-scaled',
    requiredContext: ['energy'],
    parameterShape: ['value', 'value_1', 'value_2'],
    crossCheck: 'Released instances scale from value_1 at zero energy to value_2 at 100 or more energy.',
    reliability: 'bounded-curve'
  },
  115: {
    conditionKind: 'all-deck-supports',
    requiredContext: [],
    parameterShape: ['value', 'value_1'],
    crossCheck: 'The resolved effect is applied to every support card in the deck.',
    reliability: 'raw-parameter-exact'
  },
  116: {
    conditionKind: 'owned-skill-count-scaled',
    requiredContext: ['ownedSkills'],
    parameterShape: ['value', 'value_1', 'value_2', 'value_3'],
    crossCheck: 'Effect increases for learned skills in the encoded category, capped by value_3.',
    reliability: 'raw-parameter-exact'
  },
  117: {
    conditionKind: 'combined-facility-level-scaled',
    requiredContext: ['combinedFacilityLevel'],
    parameterShape: ['value', 'value_1', 'value_2'],
    crossCheck: 'Training effectiveness scales with combined facility level up to value_1, capped at value_2.',
    reliability: 'bounded-curve'
  },
  118: {
    conditionKind: 'bond-gated-extra-location',
    requiredContext: ['bond'],
    parameterShape: ['value', 'value_1'],
    crossCheck: 'At the bond threshold this support can appear in two facilities at once.',
    reliability: 'raw-parameter-exact'
  },
  119: {
    conditionKind: 'bond-gated-deck-specialty',
    requiredContext: ['bond'],
    parameterShape: ['value', 'value_1', 'value_2'],
    crossCheck: 'At the bond threshold all support cards in the deck receive the specialty effect.',
    reliability: 'raw-parameter-exact'
  },
  120: {
    conditionKind: 'bond-gated-deck-stat-bonus',
    requiredContext: ['bond', 'deckState.cards'],
    parameterShape: ['value', 'value_1', 'value_2', 'value_3'],
    crossCheck: 'At the bond threshold each support type contributes a capped stat bonus; Friend/Group contributes skill points.',
    reliability: 'raw-parameter-exact'
  },
  121: {
    conditionKind: 'same-facility-bond-gain-choice',
    requiredContext: ['trainingState.sameFacility'],
    parameterShape: ['value', 'value_1'],
    crossCheck: 'All supports receive value bond; supports in this card facility receive value_1 bond.',
    reliability: 'raw-parameter-exact'
  },
  122: {
    conditionKind: 'following-turn-same-facility',
    requiredContext: ['trainingState.sameFacility', 'turnOffset'],
    parameterShape: ['value', 'value_1'],
    crossCheck: 'Other supports on the same facility receive the effect on the following turn.',
    reliability: 'raw-parameter-exact'
  }
});

function clone(value) {
  if (value == null || typeof value !== 'object') return value;
  return JSON.parse(JSON.stringify(value));
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function integerOrNull(value) {
  const number = finiteNumber(value);
  return number == null ? null : Math.trunc(number);
}

function hasOwn(object, key) {
  return Boolean(object && Object.prototype.hasOwnProperty.call(object, key));
}

function firstPresent(object, keys) {
  for (const key of keys) {
    if (hasOwn(object, key) && object[key] != null) return object[key];
  }
  return undefined;
}

function valueAt(context, keys) {
  const direct = firstPresent(context, keys);
  if (direct !== undefined) return direct;
  const trainingState = context?.trainingState || context?.training || {};
  return firstPresent(trainingState, keys);
}

function normalizedBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1' || value === 'true' || value === 'yes') return true;
  if (value === 0 || value === '0' || value === 'false' || value === 'no') return false;
  return null;
}

function contextBoolean(context, directKeys, nestedKeys = []) {
  const direct = firstPresent(context, directKeys);
  const trainingState = context?.trainingState || context?.training || {};
  const nested = firstPresent(trainingState, nestedKeys);
  const value = direct !== undefined ? direct : nested;
  return normalizedBoolean(value);
}

function pathNode(path) {
  return { type: 'context', path };
}

function literalNode(value) {
  return { type: 'literal', value: clone(value) };
}

function comparison(path, operator, value, kind) {
  return {
    type: 'comparison',
    kind,
    operator,
    left: pathNode(path),
    right: literalNode(value),
    path,
    value
  };
}

function logical(operator, operands, kind = undefined) {
  return {
    type: 'logical',
    ...(kind ? { kind } : {}),
    operator,
    operands: operands.map(clone)
  };
}

function alwaysCondition() {
  return { type: 'literal', kind: 'always', value: true };
}

function range(effectType, minimum, maximum, extra = {}) {
  return {
    effectType,
    min: minimum == null ? null : Number(minimum),
    max: maximum == null ? null : Number(maximum),
    ...clone(extra)
  };
}

function additive(effectType, value, extra = {}) {
  return {
    effectType: Number(effectType),
    value: Number(value),
    effectClass: 'additive',
    scope: 'current-trainee',
    ...clone(extra)
  };
}

function ruleEffect(effectType, value, effectClass, extra = {}) {
  return {
    effectType: Number(effectType),
    value: Number(value),
    effectClass,
    ...clone(extra)
  };
}

function mergeEffects(effects) {
  const merged = [];
  const byKey = new Map();
  for (const effect of effects || []) {
    if (!effect || effect.value == null || !Number.isFinite(Number(effect.value))) continue;
    const scope = effect.scope || '';
    const effectClass = effect.effectClass || '';
    const target = effect.target || '';
    const key = [String(effect.effectType), effectClass, scope, target].join('|');
    if (!byKey.has(key)) {
      const copy = clone(effect);
      copy.value = Number(copy.value);
      byKey.set(key, copy);
      merged.push(copy);
    } else {
      byKey.get(key).value += Number(effect.value);
    }
  }
  return merged;
}

function effectMap(effects) {
  const map = {};
  for (const effect of effects || []) {
    if (!effect || effect.value == null || !Number.isFinite(Number(effect.value))) continue;
    const key = String(effect.effectType);
    map[key] = (map[key] || 0) + Number(effect.value);
  }
  return map;
}

function additiveEffectMap(effects) {
  const map = {};
  for (const effect of effects || []) {
    if (effect?.effectClass !== 'additive') continue;
    const key = String(effect.effectType);
    map[key] = (map[key] || 0) + Number(effect.value);
  }
  return map;
}

function makePhase({ known, effects = null, ranges = [], reason = null, assumptions = [], probabilities = [] }) {
  const normalizedEffects = known ? mergeEffects(effects || []) : null;
  return {
    known: Boolean(known),
    effects: normalizedEffects,
    effectMap: normalizedEffects == null ? null : effectMap(normalizedEffects),
    additiveEffectMap: normalizedEffects == null ? null : additiveEffectMap(normalizedEffects),
    range: clone(ranges),
    probabilities: clone(probabilities),
    reason,
    assumptions: [...assumptions]
  };
}

function statusFrom({ known, active, unsupported = false }) {
  if (unsupported) return STATUS.UNSUPPORTED;
  if (!known) return STATUS.CONDITIONAL;
  return active ? STATUS.ACTIVE : STATUS.INACTIVE;
}

function rawEffectsFrom(raw) {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.effects)) return raw.effects;
  return [];
}

function rawUniqueFrom(input) {
  if (input?.unique && hasOwn(input.unique, 'raw')) return input.unique.raw;
  if (input?.unique?.raw) return input.unique.raw;
  if (input?.raw && Array.isArray(input.raw.effects)) return input.raw;
  return input;
}

function parseEffect(rawEffect, index) {
  const raw = rawEffect && typeof rawEffect === 'object' ? clone(rawEffect) : {};
  const type = integerOrNull(raw.type ?? raw.effectType);
  const contract = type == null ? null : TYPE_CONTRACTS[type] || null;
  const ordinary = type != null && type >= 1 && type <= 41;
  const parameterKeys = Object.keys(raw)
    .filter(key => /^value(?:_\d+)?$/.test(key))
    .sort((left, right) => {
      if (left === 'value') return -1;
      if (right === 'value') return 1;
      return Number(left.slice(6)) - Number(right.slice(6));
    });
  const parameters = Object.fromEntries(parameterKeys.map(key => [key, clone(raw[key])]));
  const validationErrors = [];
  if (type == null) validationErrors.push('missing-type');
  if (type != null && UNIQUE_TYPES.includes(type)) {
    const expected = contract?.parameterShape || [];
    const required = expected.filter(key => !key.endsWith('?'));
    for (const key of required) {
      if (!hasOwn(raw, key) || finiteNumber(raw[key]) == null) {
        validationErrors.push('missing-or-non-numeric-' + key);
      }
    }
  }
  return {
    index,
    type,
    raw,
    parameters,
    parameterKeys,
    contract: clone(contract),
    ordinary,
    validationErrors,
    decoderStatus: type != null && (ordinary || contract) && validationErrors.length === 0
      ? 'supported'
      : 'unsupported'
  };
}

function parseUniqueRaw(input) {
  const raw = rawUniqueFrom(input);
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? clone(raw) : { effects: [] };
  const unlockLevel = integerOrNull(source.level ?? source.unlockLevel);
  const effects = rawEffectsFrom(source).map(parseEffect);
  return {
    raw: source,
    unlockLevel,
    effects,
    types: [...new Set(effects.map(effect => effect.type).filter(Number.isFinite))],
    sourcePath: 'data/support-card-profiles.json:profiles[].unique.raw'
  };
}

function supportType(value) {
  if (value && typeof value === 'object') {
    return supportType(value.supportType ?? value.type ?? value.cardType ?? value.kind);
  }
  if (value == null) return null;
  const text = String(value).trim().toLowerCase();
  if (['1', 'speed', 'スピード', '速度'].includes(text)) return 'speed';
  if (['2', 'stamina', 'スタミナ', '耐力', '持久力'].includes(text)) return 'stamina';
  if (['3', 'power', 'パワー', '力量'].includes(text)) return 'power';
  if (['4', 'guts', '根性', '意志力'].includes(text)) return 'guts';
  if (['5', 'wisdom', 'wit', 'intelligence', '賢さ', '智力'].includes(text)) return 'wisdom';
  if (['6', 'friend', 'group', 'pal', '友人', '團體', 'group/friend'].includes(text)) return 'friend';
  return null;
}

function deckCards(context) {
  const deckState = context?.deckState || context?.deck || {};
  const cards = Array.isArray(deckState)
    ? deckState
    : deckState.cards || context?.selectedCards || context?.deckCards;
  return Array.isArray(cards) ? cards : null;
}

function supportTypeCountFromContext(context) {
  const direct = finiteNumber(firstPresent(context, ['supportTypeCount', 'differentSupportTypeCount']));
  if (direct != null) return { value: direct, source: 'supportTypeCount' };
  const cards = deckCards(context);
  if (!cards) return { value: null, source: null };
  const types = cards.map(card => supportType(card)).filter(Boolean);
  return { value: new Set(types).size, source: 'deckState.cards' };
}

function numericContext(context, keys) {
  const value = firstPresent(context, keys);
  return { value: finiteNumber(value), source: value === undefined ? null : keys.find(key => hasOwn(context, key)) || keys[0] };
}

function bondFromContext(context) {
  return numericContext(context, ['bond', 'initialBond', 'combinedSupportBond', 'supportBondTotal', 'bondTotal']);
}

function combinedBondFromContext(context) {
  return numericContext(context, ['combinedSupportBond', 'supportBondTotal', 'bondTotal', 'bond', 'initialBond']);
}

function friendshipTrainingFromContext(context) {
  return {
    value: contextBoolean(
      context,
      ['isFriendshipTraining', 'friendshipTraining', 'isRainbowTraining', 'rainbowTraining'],
      ['isFriendshipTraining', 'friendshipTraining', 'isRainbowTraining', 'rainbowTraining']
    ),
    source: 'trainingState.isFriendshipTraining'
  };
}

function specialtyTrainingFromContext(context) {
  return {
    value: contextBoolean(
      context,
      ['isSpecialtyTraining', 'specialtyTraining'],
      ['isSpecialtyTraining', 'specialtyTraining']
    ),
    source: 'trainingState.isSpecialtyTraining'
  };
}

function sameFacilityFromContext(context) {
  return {
    value: contextBoolean(
      context,
      ['sameFacility', 'isSameFacility', 'trainingWithThisCard'],
      ['sameFacility', 'isSameFacility', 'trainingWithThisCard']
    ),
    source: 'trainingState.sameFacility'
  };
}

function skillCategory(value) {
  const text = String(value ?? '').trim().toLowerCase();
  if (['1', 'speed', '速度', 'speed-increasing', 'speedincreasing'].includes(text)) return 'speed';
  if (['2', 'acceleration', '加速', 'accel'].includes(text)) return 'acceleration';
  if (['3', 'recovery', '回復', 'recovery-skill'].includes(text)) return 'recovery';
  return null;
}

function ownedSkillCount(context, categoryCode) {
  const category = skillCategory(categoryCode);
  const directCounts = context?.ownedSkillCounts || context?.ownedSkillsByCategory;
  if (directCounts && typeof directCounts === 'object') {
    const keys = category === 'speed'
      ? ['speed', '1', 'speed-increasing']
      : category === 'acceleration'
        ? ['acceleration', '2', 'accel']
        : ['recovery', '3', 'recovery-skill'];
    for (const key of keys) {
      const count = finiteNumber(directCounts[key]);
      if (count != null) return { value: Math.max(0, Math.trunc(count)), source: 'ownedSkillCounts' };
    }
  }
  const skills = context?.ownedSkills;
  if (Array.isArray(skills)) {
    const count = skills.filter(skill => skillCategory(
      skill?.category ?? skill?.skillCategory ?? skill?.kind ?? skill?.type
    ) === category).length;
    return { value: count, source: 'ownedSkills' };
  }
  if (skills && typeof skills === 'object') {
    const count = finiteNumber(skills[category] ?? skills[String(categoryCode)]);
    if (count != null) return { value: Math.max(0, Math.trunc(count)), source: 'ownedSkills' };
  }
  return { value: null, source: null };
}

function randomOutcomeFromContext(context, chancePercent) {
  const value = firstPresent(context, ['randomOutcome', 'chanceOutcome', 'roll']);
  if (typeof value === 'boolean') return { value, source: 'randomOutcome' };
  if (value == null) return { value: null, source: null };
  const number = finiteNumber(value);
  if (number == null) return { value: null, source: null };
  if (number >= 0 && number <= 1) return { value: number < chancePercent / 100, source: 'roll[0,1]' };
  return { value: number < chancePercent, source: 'roll[0,100)' };
}

function rangeFromEffects(effects, minimum = 0, maximum = null) {
  return mergeEffects(effects).map(effect => range(
    effect.effectType,
    minimum == null ? null : minimum,
    maximum,
    {
      effectClass: effect.effectClass,
      scope: effect.scope,
      target: effect.target
    }
  ));
}

function currentScalarResult({ value, maximum, effectFactory, condition, requiredContext, evidence, source, minimum = 0, reason = 'context-missing' }) {
  const peakEffects = effectFactory(maximum);
  const ranges = rangeFromEffects(peakEffects, minimum, maximum);
  if (value == null) {
    return {
      status: STATUS.CONDITIONAL,
      condition,
      requiredContext,
      now: makePhase({ known: false, ranges, reason }),
      expected: makePhase({ known: false, ranges, reason }),
      peak: makePhase({ known: true, effects: peakEffects, ranges, reason: 'parameter-maximum' }),
      evidence,
      source
    };
  }
  const clamped = Math.max(minimum, Math.min(maximum, value));
  const currentEffects = effectFactory(clamped);
  return {
    status: STATUS.ACTIVE,
    condition,
    requiredContext,
    now: makePhase({ known: true, effects: currentEffects, ranges: rangeFromEffects(currentEffects, clamped, clamped), reason: 'context-resolved' }),
    expected: makePhase({ known: true, effects: currentEffects, ranges: rangeFromEffects(currentEffects, clamped, clamped), reason: 'context-resolved' }),
    peak: makePhase({ known: true, effects: peakEffects, ranges, reason: 'parameter-maximum' }),
    evidence,
    source
  };
}

function evidenceFor(effect, contract, notes = []) {
  return [{
    kind: 'raw',
    source: 'GameTora raw',
    path: 'data/support-card-profiles.json:profiles[].unique.raw.effects[]',
    raw: clone(effect.raw),
    type: effect.type
  }, {
    kind: 'contract',
    source: 'support-unique-core',
    contract: contract ? clone(contract) : null,
    notes: [...notes]
  }];
}

function evaluateEffect(effect, context) {
  const raw = effect.raw;
  const type = effect.type;
  const contract = TYPE_CONTRACTS[type];
  const baseEvidence = evidenceFor(effect, contract);
  if (type == null || (!effect.ordinary && !contract)) {
    const note = ['No safe decoder contract for this unique effect type.'];
    return {
      status: STATUS.UNSUPPORTED,
      condition: { type: 'unknown', kind: 'unsupported-type', rawType: raw.type ?? raw.effectType ?? null },
      requiredContext: [],
      now: makePhase({ known: false, reason: 'unsupported-type' }),
      expected: makePhase({ known: false, reason: 'unsupported-type' }),
      peak: makePhase({ known: false, reason: 'unsupported-type' }),
      evidence: evidenceFor(effect, null, note),
      warnings: note
    };
  }
  if (effect.validationErrors.length) {
    const note = effect.validationErrors.map(error => 'raw-validation:' + error);
    const peakEffects = type === 101 && finiteNumber(raw.value_1) != null && finiteNumber(raw.value_2) != null
      ? [additive(raw.value_1, raw.value_2)]
      : [];
    return {
      status: STATUS.UNSUPPORTED,
      condition: { type: 'unknown', kind: contract.conditionKind, raw: clone(raw) },
      requiredContext: clone(contract.requiredContext),
      now: makePhase({ known: false, reason: 'invalid-raw-parameters' }),
      expected: makePhase({ known: false, ranges: rangeFromEffects(peakEffects, 0, null), reason: 'invalid-raw-parameters' }),
      peak: makePhase({ known: peakEffects.length > 0, effects: peakEffects, reason: 'known-partial-raw' }),
      evidence: evidenceFor(effect, contract, note),
      warnings: note
    };
  }

  const v = key => finiteNumber(raw[key]);
  const source = { type, raw: clone(raw) };
  const requiredContext = clone(contract?.requiredContext || []);
  const evidence = baseEvidence;

  if (type >= 1 && type <= 41) {
    const effects = [additive(type, v('value'))];
    return {
      status: STATUS.ACTIVE,
      condition: alwaysCondition(),
      requiredContext: [],
      now: makePhase({ known: true, effects, reason: 'ordinary-unique-effect' }),
      expected: makePhase({ known: true, effects, reason: 'ordinary-unique-effect' }),
      peak: makePhase({ known: true, effects, reason: 'ordinary-unique-effect' }),
      evidence,
      source
    };
  }

  if (type === 101) {
    const threshold = v('value');
    const pairs = [[v('value_1'), v('value_2')]];
    if (hasOwn(raw, 'value_3') || hasOwn(raw, 'value_4')) pairs.push([v('value_3'), v('value_4')]);
    const effects = pairs.filter(([effectType, value]) => effectType != null && value != null)
      .map(([effectType, value]) => additive(effectType, value));
    const bond = bondFromContext(context);
    const condition = comparison('bond', '>=', threshold, 'bond-at-least');
    const peakRanges = effects.map(effect => range(effect.effectType, 0, effect.value));
    const note = [];
    if (bond.source) note.push('bond-source:' + bond.source);
    if (hasOwn(raw, 'value_4') && !hasOwn(raw, 'value_3')) {
      note.push('ignored-orphan-parameter:value_4-without-value_3');
    }
    if (bond.value == null) {
      return {
        status: STATUS.CONDITIONAL,
        condition,
        requiredContext,
        now: makePhase({ known: false, ranges: peakRanges, reason: 'bond-missing' }),
        expected: makePhase({ known: false, ranges: peakRanges, reason: 'bond-missing' }),
        peak: makePhase({ known: true, effects, ranges: peakRanges, reason: 'condition-maximum' }),
        evidence: evidenceFor(effect, contract, note),
        warnings: note,
        source
      };
    }
    const active = bond.value >= threshold;
    return {
      status: active ? STATUS.ACTIVE : STATUS.INACTIVE,
      condition,
      requiredContext,
      now: makePhase({ known: true, effects: active ? effects : [], reason: active ? 'bond-satisfied' : 'bond-below-threshold' }),
      expected: makePhase({ known: true, effects: active ? effects : [], reason: 'context-resolved' }),
      peak: makePhase({ known: true, effects, ranges: peakRanges, reason: 'condition-maximum' }),
      evidence: evidenceFor(effect, contract, note),
      warnings: note,
      source
    };
  }

  if (type === 102) {
    const threshold = v('value');
    const bonus = v('value_1');
    const bond = bondFromContext(context);
    const specialty = specialtyTrainingFromContext(context);
    const condition = logical('and', [
      comparison('bond', '>=', threshold, 'bond-at-least'),
      { type: 'boolean', kind: 'not-specialty-training', path: 'trainingState.isSpecialtyTraining', operator: 'not', value: true }
    ], 'bond-at-least-and-not-specialty');
    const effects = [additive(8, bonus)];
    const ranges = [range(8, 0, bonus)];
    if (bond.value == null || specialty.value == null) {
      return {
        status: STATUS.CONDITIONAL,
        condition,
        requiredContext,
        now: makePhase({ known: false, ranges, reason: bond.value == null ? 'bond-missing' : 'specialty-state-missing' }),
        expected: makePhase({ known: false, ranges, reason: 'condition-missing' }),
        peak: makePhase({ known: true, effects, ranges, reason: 'condition-maximum' }),
        evidence,
        source
      };
    }
    const active = bond.value >= threshold && specialty.value === false;
    return {
      status: active ? STATUS.ACTIVE : STATUS.INACTIVE,
      condition,
      requiredContext,
      now: makePhase({ known: true, effects: active ? effects : [], reason: active ? 'condition-satisfied' : 'condition-false' }),
      expected: makePhase({ known: true, effects: active ? effects : [], reason: 'context-resolved' }),
      peak: makePhase({ known: true, effects, ranges, reason: 'condition-maximum' }),
      evidence,
      source
    };
  }

  if (type === 103) {
    const minimumTypes = v('value');
    const bonus = v('value_1');
    const count = supportTypeCountFromContext(context);
    const condition = comparison('supportTypeCount', '>=', minimumTypes, 'support-type-count-at-least');
    const effects = [additive(8, bonus)];
    const ranges = [range(8, 0, bonus)];
    if (count.value == null) {
      return {
        status: STATUS.CONDITIONAL,
        condition,
        requiredContext,
        now: makePhase({ known: false, ranges, reason: 'support-type-count-missing' }),
        expected: makePhase({ known: false, ranges, reason: 'support-type-count-missing' }),
        peak: makePhase({ known: true, effects, ranges, reason: 'condition-maximum' }),
        evidence: evidenceFor(effect, contract, ['count-source:missing']),
        source
      };
    }
    const active = count.value >= minimumTypes;
    return {
      status: active ? STATUS.ACTIVE : STATUS.INACTIVE,
      condition,
      requiredContext,
      now: makePhase({ known: true, effects: active ? effects : [], reason: active ? 'type-count-satisfied' : 'type-count-below-threshold' }),
      expected: makePhase({ known: true, effects: active ? effects : [], reason: 'context-resolved' }),
      peak: makePhase({ known: true, effects, ranges, reason: 'condition-maximum' }),
      evidence: evidenceFor(effect, contract, ['count-source:' + count.source]),
      source
    };
  }

  if (type === 104) {
    const fansPerStep = v('value');
    const maximum = v('value_1');
    const fans = numericContext(context, ['fanCount', 'fans']);
    const condition = {
      type: 'scale',
      kind: 'fan-count-scaled',
      input: pathNode('fanCount'),
      step: literalNode(fansPerStep),
      maximum: literalNode(maximum),
      formula: 'min(floor(fanCount / step), maximum)'
    };
    const factory = current => [additive(8, Math.min(maximum, Math.max(0, Math.floor(current / fansPerStep))))];
    const peak = factory(maximum * fansPerStep);
    if (fans.value == null) {
      return {
        status: STATUS.CONDITIONAL,
        condition,
        requiredContext,
        now: makePhase({ known: false, ranges: [range(8, 0, maximum)], reason: 'fan-count-missing' }),
        expected: makePhase({ known: false, ranges: [range(8, 0, maximum)], reason: 'fan-count-missing' }),
        peak: makePhase({ known: true, effects: peak, ranges: [range(8, 0, maximum)], reason: 'parameter-maximum' }),
        evidence,
        source
      };
    }
    const current = factory(Math.max(0, fans.value));
    return {
      status: STATUS.ACTIVE,
      condition,
      requiredContext,
      now: makePhase({ known: true, effects: current, reason: 'fan-count-resolved' }),
      expected: makePhase({ known: true, effects: current, reason: 'fan-count-resolved' }),
      peak: makePhase({ known: true, effects: peak, ranges: [range(8, 0, maximum)], reason: 'parameter-maximum' }),
      evidence: evidenceFor(effect, contract, ['fan-source:' + (fans.source || 'missing')]),
      source
    };
  }

  if (type === 105) {
    const cards = deckCards(context);
    const regularValue = v('value');
    const friendValue = v('value_1');
    const condition = {
      type: 'deck',
      kind: 'deck-initial-stat-by-support-type',
      input: pathNode('deckState.cards'),
      regularValue: literalNode(regularValue),
      friendGroupValue: literalNode(friendValue)
    };
    const buildEffects = cardList => {
      const effects = [];
      for (const card of cardList || []) {
        const typeName = supportType(card);
        if (typeName === 'friend') {
          for (const effectType of STAT_EFFECTS) {
            effects.push(additive(effectType, friendValue, {
              scope: 'deck-initial-stat',
              target: 'all-stats',
              sourceSupportType: 'friend-group'
            }));
          }
        } else if (INITIAL_STAT_EFFECT_BY_SUPPORT_TYPE[typeName]) {
          effects.push(additive(INITIAL_STAT_EFFECT_BY_SUPPORT_TYPE[typeName], regularValue, {
            scope: 'deck-initial-stat',
            target: typeName,
            sourceSupportType: typeName
          }));
        }
      }
      return mergeEffects(effects);
    };
    const maxCards = integerOrNull(context?.maxDeckSize) || MAX_SUPPORT_DECK_SIZE;
    const peak = [];
    for (const effectType of STAT_EFFECTS) {
      peak.push(additive(effectType, regularValue * maxCards, {
        scope: 'deck-initial-stat',
        target: effectType
      }));
    }
    if (!cards) {
      return {
        status: STATUS.CONDITIONAL,
        condition,
        requiredContext,
        now: makePhase({ known: false, ranges: STAT_EFFECTS.map(effectType => range(effectType, 0, regularValue * maxCards, { scope: 'deck-initial-stat' })), reason: 'deck-cards-missing' }),
        expected: makePhase({ known: false, ranges: STAT_EFFECTS.map(effectType => range(effectType, 0, regularValue * maxCards, { scope: 'deck-initial-stat' })), reason: 'deck-cards-missing' }),
        peak: makePhase({ known: true, effects: peak, reason: 'six-card-deck-upper-bound', assumptions: ['maxDeckSize=' + maxCards] }),
        evidence,
        source
      };
    }
    const current = buildEffects(cards);
    return {
      status: STATUS.ACTIVE,
      condition,
      requiredContext,
      now: makePhase({ known: true, effects: current, reason: 'deck-cards-resolved' }),
      expected: makePhase({ known: true, effects: current, reason: 'deck-cards-resolved' }),
      peak: makePhase({ known: true, effects: current, reason: 'deck-cards-fixed' }),
      evidence: evidenceFor(effect, contract, ['deck-card-count:' + cards.length]),
      source
    };
  }

  if (type === 106) {
    const maximumCount = v('value');
    const effectType = v('value_1');
    const perCount = v('value_2');
    const count = numericContext(context, ['trainingCount', 'friendshipTrainingCount', 'trainingWithThisCardCount']);
    const condition = {
      type: 'scale',
      kind: 'training-count-scaled',
      input: pathNode('trainingCount'),
      stepValue: literalNode(perCount),
      maximumCount: literalNode(maximumCount),
      formula: 'min(trainingCount, maximumCount) * stepValue'
    };
    const factory = current => [additive(effectType, Math.min(maximumCount, Math.max(0, Math.trunc(current))) * perCount)];
    const peak = factory(maximumCount);
    if (count.value == null) {
      return {
        status: STATUS.CONDITIONAL,
        condition,
        requiredContext,
        now: makePhase({ known: false, ranges: [range(effectType, 0, maximumCount * perCount)], reason: 'training-count-missing' }),
        expected: makePhase({ known: false, ranges: [range(effectType, 0, maximumCount * perCount)], reason: 'training-count-missing' }),
        peak: makePhase({ known: true, effects: peak, reason: 'parameter-maximum' }),
        evidence,
        source
      };
    }
    const current = factory(count.value);
    return {
      status: STATUS.ACTIVE,
      condition,
      requiredContext,
      now: makePhase({ known: true, effects: current, reason: 'training-count-resolved' }),
      expected: makePhase({ known: true, effects: current, reason: 'training-count-resolved' }),
      peak: makePhase({ known: true, effects: peak, reason: 'parameter-maximum' }),
      evidence,
      source
    };
  }

  if (type === 107) {
    const energy = numericContext(context, ['energy', 'currentEnergy']);
    const effectType = v('value');
    const lowerEnergy = v('value_2');
    const maximum = v('value_3');
    const minimum = v('value_4');
    const highEnergyCutoff = 100;
    const condition = {
      type: 'scale',
      kind: 'energy-scaled',
      input: pathNode('energy'),
      anchors: [
        { input: 0, output: maximum },
        { input: lowerEnergy, output: minimum },
        { input: highEnergyCutoff, output: 0 }
      ],
      formula: 'energy<=lowerEnergy ? linear(maximum,minimum) : energy>100 ? 0 : minimum'
    };
    const valueForEnergy = currentEnergy => {
      if (currentEnergy > highEnergyCutoff) return 0;
      if (currentEnergy <= lowerEnergy) {
        const ratio = lowerEnergy <= 0 ? 1 : Math.max(0, currentEnergy) / lowerEnergy;
        return Math.max(minimum, maximum - (maximum - minimum) * ratio);
      }
      return minimum;
    };
    const peak = [additive(effectType, maximum)];
    const ranges = [range(effectType, 0, maximum)];
    if (energy.value == null) {
      return {
        status: STATUS.CONDITIONAL,
        condition,
        requiredContext,
        now: makePhase({ known: false, ranges, reason: 'energy-missing' }),
        expected: makePhase({ known: false, ranges, reason: 'energy-missing' }),
        peak: makePhase({ known: true, effects: peak, ranges, reason: 'parameter-maximum' }),
        evidence: evidenceFor(effect, contract, ['curve-note:raw value_1 retained as source parameter; released card curve exposes 0/30/100 energy anchors']),
        source
      };
    }
    const current = [additive(effectType, valueForEnergy(Math.max(0, energy.value)))];
    return {
      status: STATUS.ACTIVE,
      condition,
      requiredContext,
      now: makePhase({ known: true, effects: current, reason: 'energy-resolved' }),
      expected: makePhase({ known: true, effects: current, reason: 'energy-resolved' }),
      peak: makePhase({ known: true, effects: peak, ranges, reason: 'parameter-maximum' }),
      evidence: evidenceFor(effect, contract, ['energy-source:' + energy.source]),
      source
    };
  }

  if (type === 108) {
    const maxEnergy = numericContext(context, ['maxEnergy', 'maximumEnergy']);
    const effectType = v('value');
    const minimumEnergyAnchor = v('value_1');
    const sourceParameter = v('value_2');
    const minimum = v('value_3');
    const maximum = v('value_4');
    const condition = {
      type: 'scale',
      kind: 'maximum-energy-scaled',
      input: pathNode('maxEnergy'),
      anchors: [
        { input: minimumEnergyAnchor, output: minimum },
        { input: minimumEnergyAnchor + 20, output: maximum }
      ],
      formula: 'minimum + 3 * floor((maxEnergy - 100) / 4), capped at maximum',
      sourceParameter
    };
    const valueForEnergy = current => {
      if (current <= minimumEnergyAnchor) return minimum;
      return Math.min(maximum, minimum + Math.max(0, Math.floor((current - minimumEnergyAnchor) / 4)) * 3);
    };
    const peak = [additive(effectType, maximum)];
    const ranges = [range(effectType, minimum, maximum)];
    if (maxEnergy.value == null) {
      return {
        status: STATUS.CONDITIONAL,
        condition,
        requiredContext,
        now: makePhase({ known: false, ranges, reason: 'max-energy-missing' }),
        expected: makePhase({ known: false, ranges, reason: 'max-energy-missing' }),
        peak: makePhase({ known: true, effects: peak, ranges, reason: 'parameter-maximum' }),
        evidence: evidenceFor(effect, contract, ['curve-note:released card text confirms 5 at 100 and 20 at 120']),
        source
      };
    }
    const current = [additive(effectType, valueForEnergy(Math.max(0, maxEnergy.value)))];
    return {
      status: STATUS.ACTIVE,
      condition,
      requiredContext,
      now: makePhase({ known: true, effects: current, reason: 'max-energy-resolved' }),
      expected: makePhase({ known: true, effects: current, reason: 'max-energy-resolved' }),
      peak: makePhase({ known: true, effects: peak, ranges, reason: 'parameter-maximum' }),
      evidence: evidenceFor(effect, contract, ['max-energy-source:' + maxEnergy.source]),
      source
    };
  }

  if (type === 109) {
    const bond = combinedBondFromContext(context);
    const effectType = v('value');
    const bondPerStep = v('value_1');
    const maximum = finiteNumber(context?.maxUniqueEffectValue) ?? 20;
    const condition = {
      type: 'scale',
      kind: 'combined-bond-scaled',
      input: pathNode('combinedSupportBond'),
      step: literalNode(bondPerStep),
      maximum: literalNode(maximum),
      formula: 'min(floor(combinedSupportBond / bondPerStep), maximum)'
    };
    const factory = totalBond => [additive(effectType, Math.min(maximum, Math.max(0, Math.floor(totalBond / bondPerStep))))];
    const peak = factory(maximum * bondPerStep);
    const ranges = [range(effectType, 0, maximum)];
    if (bond.value == null) {
      return {
        status: STATUS.CONDITIONAL,
        condition,
        requiredContext,
        now: makePhase({ known: false, ranges, reason: 'combined-support-bond-missing' }),
        expected: makePhase({ known: false, ranges, reason: 'combined-support-bond-missing' }),
        peak: makePhase({ known: true, effects: peak, ranges, reason: 'six-card-bond-upper-bound', assumptions: ['maximum combined support bond=' + (maximum * bondPerStep)] }),
        evidence: evidenceFor(effect, contract, ['bond-source:missing', 'cap-source:project-six-card-bond-ceiling']),
        source
      };
    }
    const current = factory(bond.value);
    return {
      status: STATUS.ACTIVE,
      condition,
      requiredContext,
      now: makePhase({ known: true, effects: current, reason: 'combined-support-bond-resolved' }),
      expected: makePhase({ known: true, effects: current, reason: 'combined-support-bond-resolved' }),
      peak: makePhase({ known: true, effects: peak, ranges, reason: 'six-card-bond-upper-bound' }),
      evidence: evidenceFor(effect, contract, ['bond-source:' + bond.source]),
      source
    };
  }

  if (type === 110) {
    const count = numericContext(context, ['sameTrainingSupportCount', 'sameFacilitySupportCount', 'otherSupportCount']);
    const effectType = v('value');
    const perSupport = v('value_1');
    const maximumCount = Math.max(0, integerOrNull(context?.maxSameTrainingSupportCount) ?? (MAX_SUPPORT_DECK_SIZE - 1));
    const condition = {
      type: 'scale',
      kind: 'same-training-support-count-scaled',
      input: pathNode('sameTrainingSupportCount'),
      perSupport: literalNode(perSupport),
      formula: 'sameTrainingSupportCount * perSupport'
    };
    const factory = current => [additive(effectType, Math.max(0, Math.trunc(current)) * perSupport, { scope: 'same-training-facility' })];
    const peak = factory(maximumCount);
    const ranges = [range(effectType, 0, maximumCount * perSupport, { scope: 'same-training-facility' })];
    if (count.value == null) {
      return {
        status: STATUS.CONDITIONAL,
        condition,
        requiredContext,
        now: makePhase({ known: false, ranges, reason: 'same-training-support-count-missing' }),
        expected: makePhase({ known: false, ranges, reason: 'same-training-support-count-missing' }),
        peak: makePhase({ known: true, effects: peak, ranges, reason: 'six-card-deck-upper-bound' }),
        evidence,
        source
      };
    }
    const current = factory(count.value);
    return {
      status: STATUS.ACTIVE,
      condition,
      requiredContext,
      now: makePhase({ known: true, effects: current, reason: 'same-training-support-count-resolved' }),
      expected: makePhase({ known: true, effects: current, reason: 'same-training-support-count-resolved' }),
      peak: makePhase({ known: true, effects: peak, ranges, reason: 'six-card-deck-upper-bound' }),
      evidence,
      source
    };
  }

  if (type === 111) {
    const facility = numericContext(context, ['facilityLevel', 'currentFacilityLevel']);
    const effectType = v('value');
    const perLevel = v('value_1');
    const maximumLevel = integerOrNull(context?.maxFacilityLevel) ?? 5;
    const condition = {
      type: 'scale',
      kind: 'facility-level-scaled',
      input: pathNode('facilityLevel'),
      perLevel: literalNode(perLevel),
      formula: 'facilityLevel * perLevel'
    };
    const factory = current => [additive(effectType, Math.max(0, Math.min(maximumLevel, current)) * perLevel, { scope: 'current-facility' })];
    const peak = factory(maximumLevel);
    const ranges = [range(effectType, 0, maximumLevel * perLevel, { scope: 'current-facility' })];
    if (facility.value == null) {
      return {
        status: STATUS.CONDITIONAL,
        condition,
        requiredContext,
        now: makePhase({ known: false, ranges, reason: 'facility-level-missing' }),
        expected: makePhase({ known: false, ranges, reason: 'facility-level-missing' }),
        peak: makePhase({ known: true, effects: peak, ranges, reason: 'facility-level-maximum' }),
        evidence,
        source
      };
    }
    const current = factory(facility.value);
    return {
      status: STATUS.ACTIVE,
      condition,
      requiredContext,
      now: makePhase({ known: true, effects: current, reason: 'facility-level-resolved' }),
      expected: makePhase({ known: true, effects: current, reason: 'facility-level-resolved' }),
      peak: makePhase({ known: true, effects: peak, ranges, reason: 'facility-level-maximum' }),
      evidence: evidenceFor(effect, contract, ['facility-source:' + facility.source]),
      source
    };
  }

  if (type === 112) {
    const chancePercent = v('value');
    const outcome = randomOutcomeFromContext(context, chancePercent);
    const condition = {
      type: 'chance',
      kind: 'chance-based',
      event: 'failure-rate-zero',
      probability: chancePercent / 100,
      input: pathNode('randomOutcome')
    };
    const base = ruleEffect(112, chancePercent, 'chance', {
      scope: 'current-training',
      event: 'failure-rate-zero',
      probability: chancePercent / 100
    });
    const probability = [{ event: 'failure-rate-zero', probability: chancePercent / 100 }];
    if (outcome.value == null) {
      return {
        status: STATUS.CONDITIONAL,
        condition,
        requiredContext,
        now: makePhase({ known: false, ranges: [range('failure-rate-zero', 0, 1, { effectClass: 'chance' })], reason: 'random-outcome-missing', probabilities: probability }),
        expected: makePhase({ known: true, probabilities: probability, reason: 'declared-chance' }),
        peak: makePhase({ known: true, effects: [ruleEffect(112, chancePercent, 'chance', { ...base, triggered: true })], probabilities: probability, reason: 'successful-random-outcome' }),
        evidence,
        source
      };
    }
    const triggered = outcome.value === true;
    return {
      status: triggered ? STATUS.ACTIVE : STATUS.INACTIVE,
      condition,
      requiredContext,
      now: makePhase({ known: true, effects: triggered ? [ruleEffect(112, chancePercent, 'chance', { ...base, triggered: true })] : [], reason: triggered ? 'random-outcome-success' : 'random-outcome-failure', probabilities: probability }),
      expected: makePhase({ known: true, probabilities: probability, reason: 'declared-chance' }),
      peak: makePhase({ known: true, effects: [ruleEffect(112, chancePercent, 'chance', { ...base, triggered: true })], probabilities: probability, reason: 'successful-random-outcome' }),
      evidence: evidenceFor(effect, contract, ['random-source:' + outcome.source]),
      source
    };
  }

  if (type === 113) {
    const friendship = friendshipTrainingFromContext(context);
    const effects = [additive(v('value'), v('value_1'), { scope: 'friendship-training' })];
    const ranges = [range(v('value'), 0, v('value_1'), { scope: 'friendship-training' })];
    const condition = {
      type: 'boolean',
      kind: 'friendship-training-state',
      path: 'trainingState.isFriendshipTraining',
      operator: 'equals',
      value: true
    };
    if (friendship.value == null) {
      return {
        status: STATUS.CONDITIONAL,
        condition,
        requiredContext,
        now: makePhase({ known: false, ranges, reason: 'friendship-training-state-missing' }),
        expected: makePhase({ known: false, ranges, reason: 'friendship-training-state-missing' }),
        peak: makePhase({ known: true, effects, ranges, reason: 'friendship-training-maximum' }),
        evidence,
        source
      };
    }
    const active = friendship.value === true;
    return {
      status: active ? STATUS.ACTIVE : STATUS.INACTIVE,
      condition,
      requiredContext,
      now: makePhase({ known: true, effects: active ? effects : [], reason: active ? 'friendship-training' : 'not-friendship-training' }),
      expected: makePhase({ known: true, effects: active ? effects : [], reason: 'context-resolved' }),
      peak: makePhase({ known: true, effects, ranges, reason: 'friendship-training-maximum' }),
      evidence: evidenceFor(effect, contract, ['training-state-source:' + friendship.source]),
      source
    };
  }

  if (type === 114) {
    const energy = numericContext(context, ['energy', 'currentEnergy']);
    const effectType = v('value');
    const minimum = v('value_1');
    const maximum = v('value_2');
    const condition = {
      type: 'scale',
      kind: 'current-energy-scaled',
      input: pathNode('energy'),
      anchors: [
        { input: 0, output: minimum },
        { input: 100, output: maximum }
      ],
      formula: 'minimum + (maximum - minimum) * clamp(energy / 100, 0, 1)'
    };
    const valueForEnergy = current => minimum + (maximum - minimum) * Math.max(0, Math.min(1, current / 100));
    const peak = [additive(effectType, maximum)];
    const ranges = [range(effectType, minimum, maximum)];
    if (energy.value == null) {
      return {
        status: STATUS.CONDITIONAL,
        condition,
        requiredContext,
        now: makePhase({ known: false, ranges, reason: 'energy-missing' }),
        expected: makePhase({ known: false, ranges, reason: 'energy-missing' }),
        peak: makePhase({ known: true, effects: peak, ranges, reason: 'parameter-maximum' }),
        evidence,
        source
      };
    }
    const current = [additive(effectType, valueForEnergy(Math.max(0, energy.value)))];
    return {
      status: STATUS.ACTIVE,
      condition,
      requiredContext,
      now: makePhase({ known: true, effects: current, reason: 'energy-resolved' }),
      expected: makePhase({ known: true, effects: current, reason: 'energy-resolved' }),
      peak: makePhase({ known: true, effects: peak, ranges, reason: 'parameter-maximum' }),
      evidence: evidenceFor(effect, contract, ['energy-source:' + energy.source]),
      source
    };
  }

  if (type === 115) {
    const effects = [additive(v('value'), v('value_1'), {
      scope: 'each-deck-support',
      target: 'all-supports'
    })];
    const condition = {
      type: 'scope',
      kind: 'all-deck-supports',
      target: 'all-supports'
    };
    return {
      status: STATUS.ACTIVE,
      condition,
      requiredContext,
      now: makePhase({ known: true, effects, reason: 'unconditional-deck-scope' }),
      expected: makePhase({ known: true, effects, reason: 'unconditional-deck-scope' }),
      peak: makePhase({ known: true, effects, reason: 'unconditional-deck-scope' }),
      evidence,
      source
    };
  }

  if (type === 116) {
    const count = ownedSkillCount(context, v('value'));
    const effectType = v('value_1');
    const perSkill = v('value_2');
    const maximumSkills = v('value_3');
    const category = skillCategory(v('value')) || 'unknown';
    const condition = {
      type: 'scale',
      kind: 'owned-skill-count-scaled',
      category,
      input: pathNode('ownedSkills'),
      perSkill: literalNode(perSkill),
      maximumSkills: literalNode(maximumSkills),
      formula: 'min(categorySkillCount, maximumSkills) * perSkill'
    };
    const factory = current => [additive(effectType, Math.min(maximumSkills, Math.max(0, Math.trunc(current))) * perSkill, { scope: 'owned-skills:' + category })];
    const peak = factory(maximumSkills);
    const ranges = [range(effectType, 0, maximumSkills * perSkill, { scope: 'owned-skills:' + category })];
    if (count.value == null) {
      return {
        status: STATUS.CONDITIONAL,
        condition,
        requiredContext,
        now: makePhase({ known: false, ranges, reason: 'owned-skills-missing' }),
        expected: makePhase({ known: false, ranges, reason: 'owned-skills-missing' }),
        peak: makePhase({ known: true, effects: peak, ranges, reason: 'parameter-maximum' }),
        evidence,
        source
      };
    }
    const current = factory(count.value);
    return {
      status: STATUS.ACTIVE,
      condition,
      requiredContext,
      now: makePhase({ known: true, effects: current, reason: 'owned-skills-resolved' }),
      expected: makePhase({ known: true, effects: current, reason: 'owned-skills-resolved' }),
      peak: makePhase({ known: true, effects: peak, ranges, reason: 'parameter-maximum' }),
      evidence: evidenceFor(effect, contract, ['skill-category:' + category, 'skill-count-source:' + count.source]),
      source
    };
  }

  if (type === 117) {
    const facility = numericContext(context, ['combinedFacilityLevel', 'totalFacilityLevel', 'facilityLevelTotal']);
    const effectType = v('value');
    const maximumInput = v('value_1');
    const maximumEffect = v('value_2');
    const condition = {
      type: 'scale',
      kind: 'combined-facility-level-scaled',
      input: pathNode('combinedFacilityLevel'),
      maximumInput: literalNode(maximumInput),
      maximumEffect: literalNode(maximumEffect),
      formula: 'floor(maximumEffect * clamp(combinedFacilityLevel / maximumInput, 0, 1))'
    };
    const factory = current => [additive(effectType, Math.floor(maximumEffect * Math.max(0, Math.min(1, current / maximumInput))), { scope: 'all-facilities' })];
    const peak = factory(maximumInput);
    const ranges = [range(effectType, 0, maximumEffect, { scope: 'all-facilities' })];
    if (facility.value == null) {
      return {
        status: STATUS.CONDITIONAL,
        condition,
        requiredContext,
        now: makePhase({ known: false, ranges, reason: 'combined-facility-level-missing' }),
        expected: makePhase({ known: false, ranges, reason: 'combined-facility-level-missing' }),
        peak: makePhase({ known: true, effects: peak, ranges, reason: 'parameter-maximum' }),
        evidence,
        source
      };
    }
    const current = factory(facility.value);
    return {
      status: STATUS.ACTIVE,
      condition,
      requiredContext,
      now: makePhase({ known: true, effects: current, reason: 'combined-facility-level-resolved' }),
      expected: makePhase({ known: true, effects: current, reason: 'combined-facility-level-resolved' }),
      peak: makePhase({ known: true, effects: peak, ranges, reason: 'parameter-maximum' }),
      evidence: evidenceFor(effect, contract, ['facility-level-source:' + facility.source]),
      source
    };
  }

  if (type === 118) {
    const bond = bondFromContext(context);
    const threshold = v('value_1');
    const special = ruleEffect(118, v('value'), 'availability', {
      scope: 'support-card',
      target: 'training-facility-count',
      extraFacilityCount: v('value')
    });
    const condition = comparison('bond', '>=', threshold, 'bond-gated-extra-location');
    if (bond.value == null) {
      return {
        status: STATUS.CONDITIONAL,
        condition,
        requiredContext,
        now: makePhase({ known: false, ranges: [range(118, 0, v('value'), { effectClass: 'availability' })], reason: 'bond-missing' }),
        expected: makePhase({ known: false, ranges: [range(118, 0, v('value'), { effectClass: 'availability' })], reason: 'bond-missing' }),
        peak: makePhase({ known: true, effects: [special], reason: 'bond-gate-maximum' }),
        evidence,
        source
      };
    }
    const active = bond.value >= threshold;
    return {
      status: active ? STATUS.ACTIVE : STATUS.INACTIVE,
      condition,
      requiredContext,
      now: makePhase({ known: true, effects: active ? [special] : [], reason: active ? 'bond-satisfied' : 'bond-below-threshold' }),
      expected: makePhase({ known: true, effects: active ? [special] : [], reason: 'context-resolved' }),
      peak: makePhase({ known: true, effects: [special], reason: 'bond-gate-maximum' }),
      evidence: evidenceFor(effect, contract, ['bond-source:' + bond.source]),
      source
    };
  }

  if (type === 119) {
    const bond = bondFromContext(context);
    const threshold = v('value_2');
    const special = additive(19, v('value'), { scope: 'each-deck-support', target: 'all-supports' });
    const condition = comparison('bond', '>=', threshold, 'bond-gated-deck-specialty');
    const ranges = [range(19, 0, v('value'), { scope: 'each-deck-support', target: 'all-supports' })];
    if (bond.value == null) {
      return {
        status: STATUS.CONDITIONAL,
        condition,
        requiredContext,
        now: makePhase({ known: false, ranges, reason: 'bond-missing' }),
        expected: makePhase({ known: false, ranges, reason: 'bond-missing' }),
        peak: makePhase({ known: true, effects: [special], ranges, reason: 'bond-gate-maximum' }),
        evidence,
        source
      };
    }
    const active = bond.value >= threshold;
    return {
      status: active ? STATUS.ACTIVE : STATUS.INACTIVE,
      condition,
      requiredContext,
      now: makePhase({ known: true, effects: active ? [special] : [], reason: active ? 'bond-satisfied' : 'bond-below-threshold' }),
      expected: makePhase({ known: true, effects: active ? [special] : [], reason: 'context-resolved' }),
      peak: makePhase({ known: true, effects: [special], ranges, reason: 'bond-gate-maximum' }),
      evidence: evidenceFor(effect, contract, ['bond-source:' + bond.source]),
      source
    };
  }

  if (type === 120) {
    const bond = bondFromContext(context);
    const threshold = v('value_1');
    const perCard = v('value');
    const friendEffect = 30;
    const maximumPerStat = v('value_3');
    const cards = deckCards(context);
    const condition = comparison('bond', '>=', threshold, 'bond-gated-deck-stat-bonus');
    const buildEffects = cardList => {
      const counts = { speed: 0, stamina: 0, power: 0, guts: 0, wisdom: 0, friend: 0 };
      for (const card of cardList || []) {
        const typeName = supportType(card);
        if (typeName && hasOwn(counts, typeName)) counts[typeName] += 1;
      }
      const effects = [];
      for (const typeName of Object.keys(TRAINING_STAT_EFFECT_BY_SUPPORT_TYPE)) {
        const count = Math.min(maximumPerStat, counts[typeName] || 0);
        if (count > 0) effects.push(additive(
          TRAINING_STAT_EFFECT_BY_SUPPORT_TYPE[typeName],
          count * perCard,
          { scope: 'deck-stat-bonus', target: typeName, sourceSupportCount: counts[typeName] }
        ));
      }
      if (counts.friend > 0) effects.push(additive(
        friendEffect,
        Math.min(maximumPerStat, counts.friend) * perCard,
        { scope: 'deck-stat-bonus', target: 'skill-points', sourceSupportCount: counts.friend }
      ));
      return effects;
    };
    const peak = [
      ...TRAINING_STAT_EFFECTS.map(effectType => additive(effectType, maximumPerStat * perCard, { scope: 'deck-stat-bonus' })),
      additive(friendEffect, maximumPerStat * perCard, { scope: 'deck-stat-bonus', target: 'skill-points' })
    ];
    const ranges = [
      ...TRAINING_STAT_EFFECTS.map(effectType => range(effectType, 0, maximumPerStat * perCard, { scope: 'deck-stat-bonus' })),
      range(friendEffect, 0, maximumPerStat * perCard, { scope: 'deck-stat-bonus', target: 'skill-points' })
    ];
    if (bond.value == null || !cards) {
      const reason = bond.value == null ? 'bond-missing' : 'deck-cards-missing';
      return {
        status: STATUS.CONDITIONAL,
        condition,
        requiredContext,
        now: makePhase({ known: false, ranges, reason }),
        expected: makePhase({ known: false, ranges, reason }),
        peak: makePhase({ known: true, effects: peak, ranges, reason: 'bond-and-deck-maximum' }),
        evidence,
        source
      };
    }
    const active = bond.value >= threshold;
    const current = active ? buildEffects(cards) : [];
    return {
      status: active ? STATUS.ACTIVE : STATUS.INACTIVE,
      condition,
      requiredContext,
      now: makePhase({ known: true, effects: current, reason: active ? 'bond-and-deck-resolved' : 'bond-below-threshold' }),
      expected: makePhase({ known: true, effects: current, reason: 'context-resolved' }),
      peak: makePhase({ known: true, effects: peak, ranges, reason: 'bond-and-deck-maximum' }),
      evidence: evidenceFor(effect, contract, ['bond-source:' + bond.source, 'deck-card-count:' + cards.length]),
      source
    };
  }

  if (type === 121) {
    const sameFacility = sameFacilityFromContext(context);
    const notWithValue = v('value');
    const withValue = v('value_1');
    const condition = {
      type: 'choice',
      kind: 'same-facility-bond-gain-choice',
      input: pathNode('trainingState.sameFacility'),
      branches: [
        { when: false, effects: [ruleEffect(121, notWithValue, 'bond-gain', { scope: 'all-supports', target: 'bond' })] },
        { when: true, effects: [ruleEffect(121, withValue, 'bond-gain', { scope: 'all-supports', target: 'bond' })] }
      ]
    };
    const notWith = ruleEffect(121, notWithValue, 'bond-gain', { scope: 'all-supports', target: 'bond' });
    const withCard = ruleEffect(121, withValue, 'bond-gain', { scope: 'all-supports', target: 'bond' });
    const ranges = [range(121, Math.min(notWithValue, withValue), Math.max(notWithValue, withValue), { effectClass: 'bond-gain', target: 'bond' })];
    if (sameFacility.value == null) {
      return {
        status: STATUS.CONDITIONAL,
        condition,
        requiredContext,
        now: makePhase({ known: false, ranges, reason: 'same-facility-state-missing' }),
        expected: makePhase({ known: false, ranges, reason: 'same-facility-state-missing' }),
        peak: makePhase({ known: true, effects: [withCard], ranges, reason: 'same-facility-maximum' }),
        evidence,
        source
      };
    }
    const current = sameFacility.value ? withCard : notWith;
    return {
      status: STATUS.ACTIVE,
      condition,
      requiredContext,
      now: makePhase({ known: true, effects: [current], reason: sameFacility.value ? 'same-facility' : 'different-facility' }),
      expected: makePhase({ known: true, effects: [current], reason: 'context-resolved' }),
      peak: makePhase({ known: true, effects: [withCard], ranges, reason: 'same-facility-maximum' }),
      evidence: evidenceFor(effect, contract, ['same-facility-source:' + sameFacility.source]),
      source
    };
  }

  if (type === 122) {
    const sameFacility = sameFacilityFromContext(context);
    const turnOffset = numericContext(context, ['turnOffset', 'trainingTurnOffset', 'followingTurnOffset']);
    const effect = ruleEffect(v('value'), v('value_1'), 'additive', {
      scope: 'other-supports-on-same-facility',
      target: 'following-turn',
      turnOffset: 1
    });
    const condition = logical('and', [
      { type: 'boolean', kind: 'same-facility', path: 'trainingState.sameFacility', operator: 'equals', value: true },
      comparison('turnOffset', '==', 1, 'following-turn')
    ], 'following-turn-same-facility');
    if (sameFacility.value == null || turnOffset.value == null) {
      return {
        status: STATUS.CONDITIONAL,
        condition,
        requiredContext,
        now: makePhase({ known: false, ranges: [range(effect.effectType, 0, effect.value, { effectClass: 'additive', scope: effect.scope })], reason: 'following-turn-context-missing' }),
        expected: makePhase({ known: false, ranges: [range(effect.effectType, 0, effect.value, { effectClass: 'additive', scope: effect.scope })], reason: 'following-turn-context-missing' }),
        peak: makePhase({ known: true, effects: [effect], reason: 'following-turn-maximum' }),
        evidence,
        source
      };
    }
    const active = sameFacility.value === true && turnOffset.value === 1;
    return {
      status: active ? STATUS.ACTIVE : STATUS.INACTIVE,
      condition,
      requiredContext,
      now: makePhase({ known: true, effects: active ? [effect] : [], reason: active ? 'following-turn-satisfied' : 'following-turn-condition-false' }),
      expected: makePhase({ known: true, effects: active ? [effect] : [], reason: 'context-resolved' }),
      peak: makePhase({ known: true, effects: [effect], reason: 'following-turn-maximum' }),
      evidence,
      source
    };
  }

  return {
    status: STATUS.UNSUPPORTED,
    condition: { type: 'unknown', kind: contract?.conditionKind || 'unknown' },
    requiredContext,
    now: makePhase({ known: false, reason: 'decoder-fallthrough' }),
    expected: makePhase({ known: false, reason: 'decoder-fallthrough' }),
    peak: makePhase({ known: false, reason: 'decoder-fallthrough' }),
    evidence,
    source,
    warnings: ['Decoder fallthrough; fail closed.']
  };
}

function combinePhases(items, key) {
  const phases = items.map(item => item[key]);
  const known = phases.every(phase => phase.known);
  const effects = known ? phases.flatMap(phase => phase.effects || []) : null;
  const ranges = phases.flatMap(phase => phase.range || []);
  const probabilities = phases.flatMap(phase => phase.probabilities || []);
  return makePhase({
    known,
    effects,
    ranges,
    probabilities,
    reason: known ? 'all-effects-resolved' : phases.map(phase => phase.reason).filter(Boolean).join(';') || 'context-missing',
    assumptions: phases.flatMap(phase => phase.assumptions || [])
  });
}

function overallStatus(items, parsed) {
  if (!items.length) return STATUS.INACTIVE;
  if (items.every(item => item.status === STATUS.UNSUPPORTED)) return STATUS.UNSUPPORTED;
  if (items.some(item => item.status === STATUS.CONDITIONAL || item.status === STATUS.UNSUPPORTED)) return STATUS.CONDITIONAL;
  if (items.some(item => item.status === STATUS.ACTIVE)) return STATUS.ACTIVE;
  if (parsed.unlockLevel != null) return STATUS.INACTIVE;
  return STATUS.INACTIVE;
}

function evaluateUnique(input, context = {}) {
  const parsed = input && Array.isArray(input.effects) && hasOwn(input, 'raw')
    ? input
    : parseUniqueRaw(input);
  const level = finiteNumber(firstPresent(context, ['level', 'cardLevel', 'supportLevel']));
  const levelKnown = parsed.unlockLevel == null || level != null;
  const levelUnlocked = parsed.unlockLevel == null || (level != null && level >= parsed.unlockLevel);
  const parsedItems = parsed.effects.map(effect => ({
    ...evaluateEffect(effect, context),
    index: effect.index,
    type: effect.type,
    raw: clone(effect.raw),
    parameterKeys: [...effect.parameterKeys]
  }));
  let items = parsedItems;
  if (!levelKnown) {
    items = parsedItems.map(item => ({
      ...item,
      status: item.status === STATUS.UNSUPPORTED ? STATUS.UNSUPPORTED : STATUS.CONDITIONAL,
      now: makePhase({ known: false, ranges: item.peak?.range || item.expected?.range || [], reason: 'card-level-missing' }),
      expected: makePhase({ known: false, ranges: item.peak?.range || item.expected?.range || [], reason: 'card-level-missing' }),
      peak: item.peak
    }));
  } else if (!levelUnlocked) {
    items = parsedItems.map(item => ({
      ...item,
      status: STATUS.INACTIVE,
      now: makePhase({ known: true, effects: [], reason: 'unique-below-unlock-level' }),
      expected: makePhase({ known: true, effects: [], reason: 'unique-below-unlock-level' }),
      peak: item.peak
    }));
  }
  const result = {
    status: overallStatus(items, parsed),
    unlockLevel: parsed.unlockLevel,
    raw: clone(parsed.raw),
    condition: items.length === 1
      ? clone(items[0].condition)
      : { type: 'logical', kind: 'all-unique-effects', operator: 'and', operands: items.map(item => clone(item.condition)) },
    requiredContext: [...new Set(items.flatMap(item => item.requiredContext || []))],
    items,
    now: combinePhases(items, 'now'),
    expected: combinePhases(items, 'expected'),
    peak: combinePhases(items, 'peak'),
    evidence: items.flatMap(item => item.evidence || []),
    warnings: items.flatMap(item => item.warnings || [])
  };
  // These aliases make the hand-off to an optimizer explicit while keeping
  // the phase objects as the canonical, audit-friendly representation.
  result.nowEffects = result.now.effects;
  result.expectedEffects = result.expected.effects;
  result.peakEffects = result.peak.effects;
  result.expectedRange = result.expected.range;
  result.peakRange = result.peak.range;
  return result;
}

/*
 * Lifecycle evaluation is intentionally a separate API from evaluateUnique.
 * evaluateUnique answers "what is true in this one context?"; this layer
 * answers "what is the weighted result across caller-supplied phases?".
 * It never invents a campaign/turn distribution.  A phase without a usable
 * proxy remains conditional, even when a parameter maximum is available.
 */

function lifecycleNumber(value) {
  const number = finiteNumber(value);
  return number == null ? null : number;
}

function lifecycleProbability(value) {
  if (typeof value === 'boolean') return { value: value ? 1 : 0, source: 'boolean' };
  const number = lifecycleNumber(value);
  if (number == null || number < 0 || number > 1) return { value: null, source: null };
  return { value: number, source: 'probability' };
}

function lifecycleUniqueStrings(values) {
  const seen = new Set();
  const output = [];
  for (const value of values || []) {
    if (value == null) continue;
    const text = String(value);
    if (seen.has(text)) continue;
    seen.add(text);
    output.push(text);
  }
  return output;
}

function lifecycleRounded(value) {
  if (!Number.isFinite(Number(value))) return value;
  const rounded = Math.round(Number(value) * 1000000000000) / 1000000000000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function lifecycleMapFromEffects(effects) {
  const map = effectMap(effects || []);
  for (const key of Object.keys(map)) {
    if (Math.abs(Number(map[key])) < 1e-12) delete map[key];
    else map[key] = lifecycleRounded(map[key]);
  }
  return map;
}

function lifecycleMapAdd(target, source, multiplier = 1) {
  for (const [key, value] of Object.entries(source || {})) {
    const number = lifecycleNumber(value);
    if (number == null) continue;
    target[key] = (target[key] || 0) + number * multiplier;
  }
  return target;
}

function lifecycleMapSum(maps) {
  const output = {};
  for (const map of maps || []) lifecycleMapAdd(output, map, 1);
  for (const key of Object.keys(output)) {
    output[key] = lifecycleRounded(output[key]);
    if (Math.abs(output[key]) < 1e-12) delete output[key];
  }
  return output;
}

function lifecycleMapWeighted(rows) {
  const output = {};
  for (const row of rows || []) {
    if (!row || !row.known || row.effectMap == null) return null;
    lifecycleMapAdd(output, row.effectMap, Number(row.normalizedWeight) || 0);
  }
  for (const key of Object.keys(output)) {
    output[key] = lifecycleRounded(output[key]);
    if (Math.abs(output[key]) < 1e-12) delete output[key];
  }
  return output;
}

function lifecycleMapMin(maps) {
  if (!Array.isArray(maps) || !maps.length) return null;
  const keys = new Set(maps.flatMap(map => Object.keys(map || {})));
  const output = {};
  for (const key of keys) {
    output[key] = lifecycleRounded(Math.min(...maps.map(map => lifecycleNumber(map?.[key]) ?? 0)));
    if (Math.abs(output[key]) < 1e-12) delete output[key];
  }
  return output;
}

function lifecycleMapMax(maps) {
  if (!Array.isArray(maps) || !maps.length) return null;
  const keys = new Set(maps.flatMap(map => Object.keys(map || {})));
  const output = {};
  for (const key of keys) {
    output[key] = lifecycleRounded(Math.max(...maps.map(map => lifecycleNumber(map?.[key]) ?? 0)));
    if (Math.abs(output[key]) < 1e-12) delete output[key];
  }
  return output;
}

function lifecycleEffectsFromMap(map) {
  return Object.entries(map || {}).map(([effectType, value]) => ({
    effectType: finiteNumber(effectType) == null ? effectType : Number(effectType),
    value: Number(value),
    effectClass: 'additive',
    scope: 'lifecycle-aggregate'
  }));
}

function lifecycleSummary(map, known, reason, assumptions = [], proxySource = null, dataStatus = 'conditional') {
  const normalized = known ? clone(map || {}) : null;
  return {
    known: Boolean(known),
    effects: normalized == null ? null : lifecycleEffectsFromMap(normalized),
    effectMap: normalized,
    additiveEffectMap: normalized == null ? null : clone(normalized),
    range: [],
    probabilities: [],
    reason,
    assumptions: lifecycleUniqueStrings(assumptions),
    proxySource: clone(proxySource),
    dataStatus
  };
}

function lifecyclePhaseValue(phase, keys) {
  const list = Array.isArray(keys) ? keys : [keys];
  const nested = phase?.context && typeof phase.context === 'object' ? phase.context : {};
  for (const key of list) {
    if (hasOwn(phase, key) && phase[key] != null) return { value: phase[key], source: 'phase.' + key };
    if (hasOwn(nested, key) && nested[key] != null) return { value: nested[key], source: 'phase.context.' + key };
  }
  return { value: undefined, source: null };
}

function lifecyclePhaseHas(phase, keys) {
  const list = Array.isArray(keys) ? keys : [keys];
  const nested = phase?.context && typeof phase.context === 'object' ? phase.context : {};
  return list.some(key => hasOwn(phase, key) || hasOwn(nested, key));
}

function lifecycleProbabilityOverride(phase, item) {
  const condition = item?.condition || {};
  const candidates = [
    lifecyclePhaseValue(phase, ['conditionProbability']),
    lifecyclePhaseValue(phase, ['conditionProbabilities']),
    lifecyclePhaseValue(phase, ['probabilities'])
  ];
  for (const candidate of candidates) {
    const value = candidate.value;
    if (value == null || Array.isArray(value)) continue;
    if (typeof value === 'number' || typeof value === 'boolean') {
      const probability = lifecycleProbability(value);
      if (probability.value != null) return { ...probability, source: candidate.source };
      continue;
    }
    if (typeof value !== 'object') continue;
    const keys = [
      String(item?.type ?? ''),
      condition.kind,
      condition.event,
      'default'
    ].filter(Boolean);
    for (const key of keys) {
      if (!hasOwn(value, key)) continue;
      const probability = lifecycleProbability(value[key]);
      if (probability.value != null) return { ...probability, source: candidate.source + '.' + key };
    }
  }
  return null;
}

function lifecyclePathValue(context, path) {
  const text = String(path || '');
  if (hasOwn(context, text)) return context[text];
  const parts = text.split('.').filter(Boolean);
  let current = context;
  for (const part of parts) {
    if (!current || typeof current !== 'object' || !hasOwn(current, part)) {
      current = null;
      break;
    }
    current = current[part];
  }
  if (current != null) return current;
  if (parts.length === 2 && parts[0] === 'trainingState' && hasOwn(context, parts[1])) {
    return context[parts[1]];
  }
  return undefined;
}

function lifecycleProbabilityForPath(path, phase, context) {
  const text = String(path || '');
  let keys = [];
  if (text === 'bond') {
    keys = ['bondProbability', 'bond-probability'];
  } else if (text.includes('isFriendshipTraining') || text === 'friendshipTraining') {
    keys = ['friendshipProbability', 'friendshipTrainingProbability', 'isFriendshipTrainingProbability'];
  } else if (text.includes('isSpecialtyTraining') || text === 'specialtyTraining') {
    keys = ['specialtyProbability', 'specialtyTrainingProbability', 'isSpecialtyTrainingProbability'];
  } else if (text.includes('sameFacility') || text === 'sameFacility') {
    keys = ['sameFacilityProbability', 'trainingWithThisCardProbability'];
  } else if (text.includes('randomOutcome') || text === 'randomOutcome') {
    keys = ['randomOutcomeProbability', 'chanceProbability'];
  } else {
    keys = [text + 'Probability'];
  }
  for (const key of keys) {
    const provided = lifecyclePhaseValue(phase, [key]);
    if (provided.value === undefined) continue;
    const probability = lifecycleProbability(provided.value);
    if (probability.value != null) return { ...probability, source: provided.source };
    return null;
  }

  const exact = lifecyclePathValue(context, text);
  const boolean = normalizedBoolean(exact);
  if (boolean != null) return { value: boolean ? 1 : 0, source: 'phase-context.' + text, inferred: false };
  const number = lifecycleNumber(exact);
  if (number != null) return { value: number, source: 'phase-context.' + text, inferred: false };
  return null;
}

function lifecycleConditionProbability(condition, phase, context, item = null) {
  const override = item ? lifecycleProbabilityOverride(phase, item) : null;
  if (override) return { ...override, inferred: true, assumptions: ['caller-supplied condition probability override'] };
  if (!condition || typeof condition !== 'object') return null;

  if (condition.type === 'literal') {
    const boolean = normalizedBoolean(condition.value);
    return boolean == null ? null : { value: boolean ? 1 : 0, source: 'literal-condition', inferred: false, assumptions: [] };
  }

  if (condition.type === 'comparison') {
    const probability = lifecycleProbabilityForPath(condition.path, phase, context);
    if (!probability) return null;
    if (probability.source.startsWith('phase.') || probability.source.includes('conditionProbability')) {
      return {
        ...probability,
        inferred: true,
        assumptions: ['caller-supplied ' + condition.path + ' condition probability']
      };
    }
    const actual = lifecyclePathValue(context, condition.path);
    const target = lifecycleNumber(condition.value);
    const numeric = lifecycleNumber(actual);
    if (numeric == null || target == null) return null;
    let active = false;
    if (condition.operator === '>=') active = numeric >= target;
    else if (condition.operator === '>') active = numeric > target;
    else if (condition.operator === '<=') active = numeric <= target;
    else if (condition.operator === '<') active = numeric < target;
    else if (condition.operator === '==' || condition.operator === '=') active = numeric === target;
    else return null;
    return { value: active ? 1 : 0, source: 'phase-context.' + condition.path, inferred: false, assumptions: [] };
  }

  if (condition.type === 'boolean') {
    const target = condition.operator === 'not'
      ? !Boolean(normalizedBoolean(condition.value))
      : Boolean(normalizedBoolean(condition.value));
    const probability = lifecycleProbabilityForPath(condition.path, phase, context);
    if (!probability) return null;
    const sourceIsProxy = probability.source.startsWith('phase.')
      && !probability.source.includes('phase-context');
    return {
      value: target ? probability.value : 1 - probability.value,
      source: probability.source,
      inferred: sourceIsProxy,
      assumptions: sourceIsProxy ? ['caller-supplied ' + condition.path + ' condition probability'] : []
    };
  }

  if (condition.type === 'chance') {
    const probability = lifecycleProbabilityForPath('randomOutcome', phase, context);
    if (probability) {
      return {
        ...probability,
        inferred: probability.source.startsWith('phase.'),
        assumptions: probability.source.startsWith('phase.') ? ['caller-supplied random outcome probability'] : []
      };
    }
    const declared = lifecycleProbability(condition.probability);
    return declared.value == null
      ? null
      : { ...declared, source: 'raw-condition-probability', inferred: false, assumptions: [] };
  }

  if (condition.type === 'logical') {
    const operands = Array.isArray(condition.operands) ? condition.operands : [];
    if (!operands.length) return null;
    const values = operands.map(operand => lifecycleConditionProbability(operand, phase, context));
    if (values.some(value => !value)) return null;
    const value = condition.operator === 'or'
      ? 1 - values.reduce((remaining, item) => remaining * (1 - item.value), 1)
      : values.reduce((product, item) => product * item.value, 1);
    const inferred = values.some(item => item.inferred);
    return {
      value: lifecycleRounded(value),
      source: 'logical-' + (condition.operator || 'and'),
      inferred,
      assumptions: inferred && operands.length > 1
        ? ['logical condition probability combined with independent-product proxy']
        : values.flatMap(item => item.assumptions || [])
    };
  }

  if (condition.type === 'choice') {
    const probability = lifecycleProbabilityForPath('trainingState.sameFacility', phase, context);
    if (!probability) return null;
    return {
      ...probability,
      source: probability.source,
      inferred: probability.source.startsWith('phase.'),
      assumptions: probability.source.startsWith('phase.')
        ? ['caller-supplied same-facility choice probability']
        : []
    };
  }

  return null;
}

function lifecycleSetPath(context, path, value) {
  const text = String(path || '');
  const parts = text.split('.').filter(Boolean);
  if (parts.length === 2 && parts[0] === 'trainingState') {
    context.trainingState = { ...(context.trainingState || {}), [parts[1]]: value };
    return context;
  }
  if (text === 'bond') {
    for (const key of ['bond', 'initialBond', 'combinedSupportBond', 'supportBondTotal', 'bondTotal']) delete context[key];
    context.bond = value;
    return context;
  }
  context[text] = value;
  return context;
}

function lifecycleSatisfyingContext(condition, context) {
  const output = clone(context || {});
  if (!condition || typeof condition !== 'object') return null;
  if (condition.type === 'literal') return normalizedBoolean(condition.value) === true ? output : null;
  if (condition.type === 'comparison') return lifecycleSetPath(output, condition.path, condition.value);
  if (condition.type === 'boolean') {
    const target = condition.operator === 'not'
      ? !Boolean(normalizedBoolean(condition.value))
      : Boolean(normalizedBoolean(condition.value));
    return lifecycleSetPath(output, condition.path, target);
  }
  if (condition.type === 'chance') return lifecycleSetPath(output, 'randomOutcome', true);
  if (condition.type === 'logical') {
    for (const operand of condition.operands || []) {
      const next = lifecycleSatisfyingContext(operand, output);
      if (!next) return null;
      Object.assign(output, next);
    }
    return output;
  }
  return null;
}

function lifecycleScaledEffects(effects, multiplier) {
  return mergeEffects((effects || []).map(effect => ({
    ...clone(effect),
    value: Number(effect.value) * Number(multiplier)
  })));
}

function lifecycleChoiceExpectedEffects(item, phase, context) {
  if (item?.condition?.type !== 'choice') return null;
  const probability = lifecycleConditionProbability(item.condition, phase, context, item);
  if (!probability) return null;
  const branches = item.condition.branches || [];
  const trueBranch = branches.find(branch => normalizedBoolean(branch.when) === true);
  const falseBranch = branches.find(branch => normalizedBoolean(branch.when) === false);
  if (!trueBranch || !falseBranch) return null;
  const trueEffects = lifecycleScaledEffects(trueBranch.effects || [], probability.value);
  const falseEffects = lifecycleScaledEffects(falseBranch.effects || [], 1 - probability.value);
  return {
    known: true,
    effects: mergeEffects([...trueEffects, ...falseEffects]),
    probability,
    reason: 'phase-choice-probability-weighted'
  };
}

function lifecycleActiveEffects(input, item, context) {
  const activeContext = lifecycleSatisfyingContext(item.condition, context);
  if (!activeContext) return null;
  const activeResult = evaluateUnique(input, activeContext);
  const activeItem = activeResult.items.find(candidate => candidate.index === item.index);
  return activeItem?.now?.known ? clone(activeItem.now.effects || []) : null;
}

function lifecyclePhaseContext(commonContext, phase) {
  const nested = phase?.context && typeof phase.context === 'object' ? phase.context : {};
  const context = { ...(commonContext || {}), ...(commonContext?.context || {}), ...nested, ...(phase || {}) };
  delete context.context;

  const probabilityOverrides = [
    { probability: ['bondProbability', 'bond-probability'], exact: ['bond', 'initialBond', 'combinedSupportBond', 'supportBondTotal', 'bondTotal'] },
    { probability: ['friendshipProbability', 'friendshipTrainingProbability', 'isFriendshipTrainingProbability'], exact: ['isFriendshipTraining', 'friendshipTraining', 'isRainbowTraining', 'rainbowTraining'] },
    { probability: ['specialtyProbability', 'specialtyTrainingProbability', 'isSpecialtyTrainingProbability'], exact: ['isSpecialtyTraining', 'specialtyTraining'] },
    { probability: ['sameFacilityProbability', 'trainingWithThisCardProbability'], exact: ['sameFacility', 'isSameFacility', 'trainingWithThisCard'] },
    { probability: ['randomOutcomeProbability', 'chanceProbability'], exact: ['randomOutcome', 'chanceOutcome', 'roll'] }
  ];
  for (const entry of probabilityOverrides) {
    if (!lifecyclePhaseHas(phase, entry.probability) || lifecyclePhaseHas(phase, entry.exact)) continue;
    for (const key of entry.exact) delete context[key];
    if (entry.exact.includes('isFriendshipTraining')) {
      const training = { ...(context.trainingState || {}) };
      for (const key of ['isFriendshipTraining', 'friendshipTraining', 'isRainbowTraining', 'rainbowTraining']) delete training[key];
      context.trainingState = training;
    }
    if (entry.exact.includes('isSpecialtyTraining')) {
      const training = { ...(context.trainingState || {}) };
      for (const key of ['isSpecialtyTraining', 'specialtyTraining']) delete training[key];
      context.trainingState = training;
    }
    if (entry.exact.includes('sameFacility')) {
      const training = { ...(context.trainingState || {}) };
      for (const key of ['sameFacility', 'isSameFacility', 'trainingWithThisCard']) delete training[key];
      context.trainingState = training;
    }
  }
  return context;
}

function lifecycleScenarioDescriptor(scenario) {
  const raw = Array.isArray(scenario) ? { phases: scenario } : (scenario && typeof scenario === 'object' ? scenario : {});
  const proxy = raw.lifecycleProxy || raw.proxy || raw.lifecycle || raw.scenario || {};
  const phases = Array.isArray(raw.phases)
    ? raw.phases
    : Array.isArray(proxy.phases)
      ? proxy.phases
      : null;
  const common = {
    ...(raw.context && typeof raw.context === 'object' ? raw.context : {}),
    ...(proxy.context && typeof proxy.context === 'object' ? proxy.context : {})
  };
  const reserved = new Set(['phases', 'context', 'lifecycleProxy', 'proxy', 'lifecycle', 'scenario', 'proxySource', 'assumptions', 'metadata']);
  for (const source of [raw, proxy]) {
    for (const [key, value] of Object.entries(source || {})) {
      if (!reserved.has(key)) common[key] = value;
    }
  }
  const proxySource = firstPresent(raw, ['proxySource'])
    ?? firstPresent(proxy, ['proxySource'])
    ?? (phases ? 'caller-supplied-lifecycle-phases' : null);
  const assumptions = [
    ...(Array.isArray(raw.assumptions) ? raw.assumptions : []),
    ...(Array.isArray(proxy.assumptions) ? proxy.assumptions : [])
  ];
  return { raw, proxy, phases, common, proxySource, assumptions };
}

function normalizeLifecyclePhases(phases) {
  if (!Array.isArray(phases) || phases.length === 0) {
    return { valid: false, phases: [], reason: 'lifecycle-phases-missing' };
  }
  const normalized = [];
  let total = 0;
  for (let index = 0; index < phases.length; index += 1) {
    const phase = phases[index] && typeof phases[index] === 'object' ? phases[index] : {};
    const rawWeight = lifecyclePhaseValue(phase, ['weight']);
    const weight = lifecycleNumber(rawWeight.value);
    if (weight == null || weight < 0) {
      return { valid: false, phases: [], reason: 'phase-weight-missing-or-invalid:' + index };
    }
    total += weight;
    normalized.push({
      ...clone(phase),
      id: phase.id == null ? 'phase-' + (index + 1) : clone(phase.id),
      weight,
      normalizedWeight: null,
      weightSource: rawWeight.source || 'phase.weight'
    });
  }
  if (!(total > 0)) return { valid: false, phases: [], reason: 'phase-weights-sum-to-zero' };
  for (const phase of normalized) phase.normalizedWeight = lifecycleRounded(phase.weight / total);
  return { valid: true, phases: normalized, reason: null };
}

function lifecyclePhaseItemResult(input, item, phase, context) {
  const peakEffectMap = item.peak?.known ? lifecycleMapFromEffects(item.peak.effects || []) : null;
  if (item.status === STATUS.UNSUPPORTED) {
    return {
      known: false,
      effectMap: null,
      peakEffectMap,
      status: STATUS.UNSUPPORTED,
      reason: 'unsupported-unique-effect',
      assumptions: [],
      proxySource: phase.proxySource || null,
      inferred: false
    };
  }

  if (item.now?.known) {
    return {
      known: true,
      effectMap: lifecycleMapFromEffects(item.now.effects || []),
      peakEffectMap,
      status: item.status,
      reason: item.now.reason || 'phase-context-resolved',
      assumptions: [],
      proxySource: phase.proxySource || null,
      inferred: false
    };
  }

  const choice = lifecycleChoiceExpectedEffects(item, phase, context);
  if (choice) {
    return {
      known: true,
      effectMap: lifecycleMapFromEffects(choice.effects),
      peakEffectMap,
      status: STATUS.CONDITIONAL,
      reason: choice.reason,
      conditionProbability: choice.probability.value,
      assumptions: choice.probability.assumptions || [],
      proxySource: phase.proxySource || choice.probability.source || null,
      inferred: choice.probability.inferred !== false
    };
  }

  const probability = lifecycleConditionProbability(item.condition, phase, context, item);
  if (probability && item.peak?.known) {
    if (probability.value === 0) {
      return {
        known: true,
        effectMap: {},
        peakEffectMap,
        status: STATUS.CONDITIONAL,
        reason: 'phase-condition-probability-zero',
        conditionProbability: 0,
        assumptions: probability.assumptions || [],
        proxySource: phase.proxySource || probability.source || null,
        inferred: probability.inferred !== false
      };
    }
    const activeEffects = lifecycleActiveEffects(input, item, context);
    if (activeEffects) {
      const expectedEffects = lifecycleScaledEffects(activeEffects, probability.value);
      return {
        known: true,
        effectMap: lifecycleMapFromEffects(expectedEffects),
        peakEffectMap,
        status: STATUS.CONDITIONAL,
        reason: 'phase-condition-probability-weighted',
        conditionProbability: probability.value,
        assumptions: probability.assumptions || [],
        proxySource: phase.proxySource || probability.source || null,
        inferred: probability.inferred !== false
      };
    }
  }

  if (item.expected?.known && item.expected.effectMap != null) {
    return {
      known: true,
      effectMap: lifecycleMapFromEffects(item.expected.effects || []),
      peakEffectMap,
      status: item.status,
      reason: item.expected.reason || 'phase-expected-resolved',
      assumptions: [],
      proxySource: phase.proxySource || null,
      inferred: false
    };
  }

  return {
    known: false,
    effectMap: null,
    peakEffectMap,
    status: item.status === STATUS.UNSUPPORTED ? STATUS.UNSUPPORTED : STATUS.CONDITIONAL,
    reason: item.now?.reason || item.expected?.reason || 'phase-context-missing',
    assumptions: [],
    proxySource: phase.proxySource || null,
    inferred: false
  };
}

function evaluateUniqueLifecycle(input, scenario = {}) {
  const parsed = input && Array.isArray(input.effects) && hasOwn(input, 'raw')
    ? input
    : parseUniqueRaw(input);
  const descriptor = lifecycleScenarioDescriptor(scenario);
  const baseResult = evaluateUnique(parsed, descriptor.common);
  const phaseInput = normalizeLifecyclePhases(descriptor.phases);
  const commonAssumptions = lifecycleUniqueStrings([
    ...descriptor.assumptions,
    'raw unique parameters and contract come from the support-card data source',
    'formal expected is the normalized weighted sum of caller-supplied phase effects'
  ]);

  if (!phaseInput.valid) {
    const directKnown = baseResult.now?.known && descriptor.phases == null;
    const expectedMap = directKnown ? lifecycleMapFromEffects(baseResult.now.effects || []) : null;
    const peakMap = baseResult.peak?.known ? lifecycleMapFromEffects(baseResult.peak.effects || []) : null;
    const assumptions = lifecycleUniqueStrings([
      ...commonAssumptions,
      phaseInput.reason === 'lifecycle-phases-missing'
        ? 'no caller-supplied lifecycle phase distribution; expected remains conditional'
        : phaseInput.reason
    ]);
    const dataStatus = expectedMap == null ? 'conditional' : 'data-direct-context';
    const lifecycleItems = baseResult.items.map(item => {
      const itemExpected = directKnown && item.now?.known ? lifecycleMapFromEffects(item.now.effects || []) : null;
      const itemPeak = item.peak?.known ? lifecycleMapFromEffects(item.peak.effects || []) : null;
      return {
        ...item,
        lowerEffectMap: itemExpected == null ? null : clone(itemExpected),
        expectedEffectMap: itemExpected == null ? null : clone(itemExpected),
        peakEffectMap: itemPeak,
        lower: lifecycleSummary(itemExpected, itemExpected != null, 'no-phase-direct-context', assumptions, descriptor.proxySource, dataStatus),
        expected: lifecycleSummary(itemExpected, itemExpected != null, 'no-phase-direct-context', assumptions, descriptor.proxySource, dataStatus),
        peak: lifecycleSummary(itemPeak, itemPeak != null, 'parameter-maximum', assumptions, descriptor.proxySource, itemPeak == null ? 'conditional' : 'data'),
        phases: [],
        assumptions,
        proxySource: descriptor.proxySource
      };
    });
    return {
      ...baseResult,
      lifecycle: true,
      phaseBreakdown: [],
      phases: [],
      items: lifecycleItems,
      lower: lifecycleSummary(expectedMap, expectedMap != null, 'lifecycle-phases-missing', assumptions, descriptor.proxySource, dataStatus),
      expected: lifecycleSummary(expectedMap, expectedMap != null, 'lifecycle-phases-missing', assumptions, descriptor.proxySource, dataStatus),
      peak: lifecycleSummary(peakMap, peakMap != null, 'parameter-maximum', assumptions, descriptor.proxySource, peakMap == null ? 'conditional' : 'data'),
      lowerEffectMap: expectedMap == null ? null : clone(expectedMap),
      expectedEffectMap: expectedMap == null ? null : clone(expectedMap),
      peakEffectMap: peakMap,
      lowerEffects: expectedMap == null ? null : lifecycleEffectsFromMap(expectedMap),
      expectedEffects: expectedMap == null ? null : lifecycleEffectsFromMap(expectedMap),
      peakEffects: peakMap == null ? null : lifecycleEffectsFromMap(peakMap),
      effectMaps: { lower: expectedMap == null ? null : clone(expectedMap), expected: expectedMap == null ? null : clone(expectedMap), peak: peakMap },
      formalExpected: expectedMap == null ? null : clone(expectedMap),
      assumptions,
      proxySource: descriptor.proxySource,
      proxySourceDetail: { kind: descriptor.proxySource ? 'caller-supplied' : 'none', source: clone(descriptor.proxySource) },
      dataStatus,
      evidence: [
        ...baseResult.evidence,
        { kind: 'lifecycle-proxy', source: descriptor.proxySource, dataStatus, phases: [] }
      ],
      warnings: [...baseResult.warnings, phaseInput.reason]
    };
  }

  const normalizedPhases = phaseInput.phases;
  const phaseRows = normalizedPhases.map(phase => {
    const phaseProxySource = lifecyclePhaseValue(phase, ['proxySource']).value
      ?? descriptor.proxySource
      ?? 'caller-supplied-lifecycle-phase';
    const phaseWithSource = { ...phase, proxySource: phaseProxySource };
    const context = lifecyclePhaseContext(descriptor.common, phaseWithSource);
    const phaseEvaluation = evaluateUnique(parsed, context);
    const itemRows = phaseEvaluation.items.map(item => ({
      ...lifecyclePhaseItemResult(parsed, item, phaseWithSource, context),
      index: item.index,
      type: item.type
    }));
    const known = itemRows.every(row => row.known);
    const effectMap = known ? lifecycleMapSum(itemRows.map(row => row.effectMap || {})) : null;
    const peakKnown = itemRows.every(row => row.peakEffectMap != null);
    const peakEffectMap = peakKnown ? lifecycleMapSum(itemRows.map(row => row.peakEffectMap || {})) : null;
    const assumptions = lifecycleUniqueStrings([
      ...(Array.isArray(phase.assumptions) ? phase.assumptions : []),
      ...itemRows.flatMap(row => row.assumptions || [])
    ]);
    const inferred = itemRows.some(row => row.inferred);
    return {
      id: clone(phase.id),
      weight: phase.weight,
      normalizedWeight: phase.normalizedWeight,
      weightSource: phase.weightSource,
      known,
      effectMap,
      expectedEffectMap: effectMap == null ? null : clone(effectMap),
      peakEffectMap,
      status: known ? (inferred ? STATUS.CONDITIONAL : (Object.keys(effectMap || {}).length ? STATUS.ACTIVE : STATUS.INACTIVE)) : STATUS.CONDITIONAL,
      reason: known ? (inferred ? 'phase-proxy-resolved' : 'phase-context-resolved') : phaseEvaluation.expected?.reason || 'phase-context-missing',
      assumptions,
      proxySource: phaseProxySource,
      dataStatus: known ? (inferred ? 'data+inference' : 'data') : 'conditional',
      context: clone(context),
      items: itemRows
    };
  });

  const positiveRows = phaseRows.filter(row => Number(row.normalizedWeight) > 0);
  const allKnown = positiveRows.length > 0 && positiveRows.every(row => row.known);
  const expectedMap = allKnown ? lifecycleMapWeighted(positiveRows) : null;
  const lowerMap = allKnown ? lifecycleMapMin(positiveRows.map(row => row.effectMap || {})) : null;
  const peakRowsKnown = positiveRows.length > 0 && positiveRows.every(row => row.peakEffectMap != null);
  const peakMap = peakRowsKnown ? lifecycleMapMax(positiveRows.map(row => row.peakEffectMap || {})) : null;
  const inferred = phaseRows.some(row => row.dataStatus === 'data+inference');
  const unsupported = phaseRows.some(row => row.status === STATUS.UNSUPPORTED);
  const assumptions = lifecycleUniqueStrings([
    ...commonAssumptions,
    'phase weights are normalized by their caller-supplied sum',
    ...phaseRows.flatMap(row => row.assumptions || []),
    inferred ? 'probability-weighted conditions are caller-supplied proxies, not published turn-distribution data' : null,
    expectedMap == null ? 'at least one positive-weight phase is unresolved; lifecycle expected remains conditional' : null
  ]);
  const dataStatus = expectedMap == null
    ? 'conditional'
    : inferred
      ? 'data+inference'
      : 'data-direct-phase-weighting';
  const topStatus = expectedMap == null
    ? (unsupported && baseResult.status === STATUS.UNSUPPORTED ? STATUS.UNSUPPORTED : STATUS.CONDITIONAL)
    : inferred
      ? STATUS.CONDITIONAL
      : (Object.keys(expectedMap).length ? STATUS.ACTIVE : STATUS.INACTIVE);

  const itemResults = baseResult.items.map(item => {
    const itemRows = phaseRows.map(row => row.items.find(candidate => candidate.index === item.index));
    const itemPositiveRows = positiveRows
      .map(row => row.items.find(candidate => candidate.index === item.index))
      .filter(Boolean);
    const itemKnown = itemPositiveRows.length > 0 && itemPositiveRows.every(row => row?.known);
    const itemExpected = itemKnown
      ? lifecycleMapWeighted(itemPositiveRows.map((row, index) => ({ ...row, normalizedWeight: positiveRows[index].normalizedWeight })))
      : null;
    const itemLower = itemKnown ? lifecycleMapMin(itemPositiveRows.map(row => row.effectMap || {})) : null;
    const itemPeakKnown = itemPositiveRows.length > 0 && itemPositiveRows.every(row => row?.peakEffectMap != null);
    const itemPeak = itemPeakKnown ? lifecycleMapMax(itemPositiveRows.map(row => row.peakEffectMap || {})) : null;
    const itemInferred = itemRows.some(row => row?.inferred);
    const itemAssumptions = lifecycleUniqueStrings([
      ...itemRows.flatMap(row => row?.assumptions || []),
      itemExpected == null ? 'unresolved positive-weight phase' : null
    ]);
    return {
      ...item,
      lowerEffectMap: itemLower,
      expectedEffectMap: itemExpected,
      peakEffectMap: itemPeak,
      lower: lifecycleSummary(itemLower, itemLower != null, 'minimum-positive-weight-phase', itemAssumptions, descriptor.proxySource, itemLower == null ? 'conditional' : 'data'),
      expected: lifecycleSummary(itemExpected, itemExpected != null, 'weighted-positive-weight-phases', itemAssumptions, descriptor.proxySource, itemExpected == null ? 'conditional' : (itemInferred ? 'data+inference' : 'data')),
      peak: lifecycleSummary(itemPeak, itemPeak != null, 'maximum-positive-weight-phase', itemAssumptions, descriptor.proxySource, itemPeak == null ? 'conditional' : 'data'),
      phases: itemRows,
      assumptions: itemAssumptions,
      proxySource: descriptor.proxySource,
      dataStatus: itemExpected == null ? 'conditional' : (itemInferred ? 'data+inference' : 'data')
    };
  });

  const lifecycleEvidence = [
    { kind: 'lifecycle-proxy', source: descriptor.proxySource, dataStatus, phases: phaseRows.map(row => ({ id: row.id, weight: row.weight, normalizedWeight: row.normalizedWeight })) },
    { kind: 'lifecycle-inference', source: 'normalized-weighted-phase-effects', formula: 'sum(normalizedWeight * phase.effectMap)', dataStatus }
  ];
  const result = {
    ...baseResult,
    status: topStatus,
    lifecycle: true,
    contextEvaluation: baseResult,
    phaseBreakdown: phaseRows,
    phases: phaseRows,
    items: itemResults,
    lower: lifecycleSummary(lowerMap, lowerMap != null, 'minimum-positive-weight-phase', assumptions, descriptor.proxySource, lowerMap == null ? 'conditional' : 'data'),
    expected: lifecycleSummary(expectedMap, expectedMap != null, 'normalized-weighted-phase-effects', assumptions, descriptor.proxySource, dataStatus),
    peak: lifecycleSummary(peakMap, peakMap != null, 'maximum-positive-weight-phase', assumptions, descriptor.proxySource, peakMap == null ? 'conditional' : 'data'),
    lowerEffectMap: lowerMap,
    expectedEffectMap: expectedMap,
    peakEffectMap: peakMap,
    lowerEffects: lowerMap == null ? null : lifecycleEffectsFromMap(lowerMap),
    expectedEffects: expectedMap == null ? null : lifecycleEffectsFromMap(expectedMap),
    peakEffects: peakMap == null ? null : lifecycleEffectsFromMap(peakMap),
    effectMaps: { lower: lowerMap, expected: expectedMap, peak: peakMap },
    formalExpected: expectedMap == null ? null : clone(expectedMap),
    assumptions,
    proxySource: descriptor.proxySource,
    proxySourceDetail: {
      kind: descriptor.proxySource ? 'caller-supplied' : 'caller-supplied-phases-without-source-label',
      source: clone(descriptor.proxySource),
      phaseIds: phaseRows.map(row => clone(row.id))
    },
    dataStatus,
    evidence: [...baseResult.evidence, ...lifecycleEvidence],
    warnings: [...baseResult.warnings, ...phaseRows.filter(row => !row.known).map(row => row.reason)]
  };
  return result;
}

function evaluateProfileUniqueLifecycle(profile, scenario = {}) {
  return evaluateUniqueLifecycle(profile?.unique?.raw ? profile.unique.raw : profile, scenario);
}

function evaluateProfilesUniqueLifecycle(profiles, scenario = {}) {
  return (Array.isArray(profiles) ? profiles : []).map(profile => evaluateProfileUniqueLifecycle(profile, scenario));
}

function evaluateProfileUnique(profile, context = {}) {
  return evaluateUnique(profile?.unique?.raw ? profile.unique.raw : profile, context);
}

function summarizeUniqueTypes(profiles) {
  const list = Array.isArray(profiles) ? profiles : [];
  const types = {};
  for (const type of UNIQUE_TYPES) types[type] = { count: 0, shapes: {} };
  let nonNullUnique = 0;
  for (const profile of list) {
    const raw = profile?.unique?.raw;
    if (!raw) continue;
    nonNullUnique += 1;
    for (const effect of rawEffectsFrom(raw)) {
      const type = integerOrNull(effect?.type ?? effect?.effectType);
      if (!UNIQUE_TYPES.includes(type)) continue;
      const rawKeys = Object.keys(raw).sort();
      const effectKeys = Object.keys(effect || {}).sort();
      const signature = JSON.stringify({ rawKeys, effectKeys });
      types[type].count += 1;
      types[type].shapes[signature] = (types[type].shapes[signature] || 0) + 1;
    }
  }
  return {
    catalogProfiles: list.length,
    profilesWithNonNullUnique: nonNullUnique,
    types
  };
}

return {
  STATUS,
  UNIQUE_TYPES,
  TYPE_CONTRACTS,
  parseUniqueRaw,
  evaluateUnique,
  evaluateUniqueLifecycle,
  evaluateProfileUnique,
  evaluateProfileUniqueLifecycle,
  evaluateProfilesUniqueLifecycle,
  summarizeUniqueTypes,
  supportType,
  effectMap,
  additiveEffectMap
};
});
