const gameCatalog = window.GAMETORA_DATA;
const skillCore = window.SKILL_CORE;
const currentRaceProfile = window.CURRENT_RACE_PROFILE;
const cmRaceCalendar = window.CM_RACE_CALENDAR || { entries: [] };
const jpStrategy = window.JP_STRATEGY_PROFILE;
const inventory = window.USER_INVENTORY;
const plannerRules = window.PLANNER_RULES;
const scenarioMechanicsPolicies = window.SCENARIO_MECHANICS_POLICIES || { profiles: [] };
const plannerCore = window.PLANNER_CORE;
const affinity = window.AFFINITY_DATA;
const persistenceCore = window.PERSISTENCE_CORE;
const breederCore = window.BREEDER_CORE;
const raceStrategyCore = window.RACE_STRATEGY_CORE;
const staminaSimCore = window.STAMINA_SIM_CORE;
const guidedPlannerCore = window.GUIDED_PLANNER_CORE;
const skillImpactCore = window.SKILL_IMPACT_CORE;
const battleHorseRankingCore = window.BATTLE_HORSE_RANKING_CORE || null;
const battleBuildEvaluationCore = window.BATTLE_BUILD_EVALUATION_CORE || null;
const skillAcquisitionCore = window.SKILL_ACQUISITION_CORE || null;
const planningSnapshotCore = window.PLANNING_SNAPSHOT_CORE;
const courseEffectSnapshots = window.COURSE_EFFECT_SNAPSHOTS;
const goalContractCore = window.GOAL_CONTRACT_CORE || null;
const ownedBreederRegistry = window.OWNED_BREEDER_REGISTRY || null;
const rentalSourceRegistry = window.RENTAL_SOURCE_REGISTRY || window.BREEDER_CANDIDATE_REGISTRY || null;
const cmOaksWhiteFactorAdapter = window.CM_OAKS_WHITE_FACTOR_ADAPTER || null;
const cmOaksRentalImportAdapter = window.CM_OAKS_RENTAL_IMPORT_ADAPTER || null;
const rentalScreenshotImportUi = window.RENTAL_SCREENSHOT_IMPORT_UI || null;
const supportCardProfiles = window.SUPPORT_CARD_PROFILES;
const supportEventRoutes = window.SUPPORT_EVENT_ROUTES || null;
const deckOptimizerCore = window.DECK_OPTIMIZER_CORE;
const deckComfortCore = window.DECK_COMFORT_CORE || null;
const supportCardLevelFixtures = window.SUPPORT_CARD_LEVEL_FIXTURES;
const lineagePlannerCore = window.LINEAGE_PLANNER_CORE;
const g1ScheduleCore = window.G1_SCHEDULE_CORE;
const manualLineageRedProjectionCore = window.MANUAL_LINEAGE_RED_PROJECTION_CORE || null;
const factorRunStrategy = window.FACTOR_RUN_STRATEGY;
const factorExecutionCore = window.FACTOR_EXECUTION_CORE || null;
const factorExecutionProfile = window.FACTOR_EXECUTION_PROFILE || {};
const goalRaceSchedules = window.GOAL_RACE_SCHEDULES || {};
const factorExecutionTemplates = Array.isArray(factorExecutionProfile.templates)
  ? factorExecutionProfile.templates
  : [];
const factorExecutionRiskProfiles = Array.isArray(factorExecutionProfile.riskProfiles)
  ? factorExecutionProfile.riskProfiles
  : [];
const factorStatAxes = factorExecutionCore?.STAT_AXES || ['speed', 'stamina', 'power', 'guts', 'wisdom'];
const manualLineageSlotDefinitions = Object.freeze([
  { id: 'target', label: '本命', shortLabel: '本命', generation: 'target' },
  { id: 'parentA', label: '直接親代 A', shortLabel: '父母 A', generation: 'parent' },
  { id: 'parentB', label: '直接親代 B', shortLabel: '父母 B', generation: 'parent' },
  { id: 'parentA1', label: '祖代 A1', shortLabel: '祖 A1', generation: 'grandparent', branch: 'A' },
  { id: 'parentA2', label: '祖代 A2', shortLabel: '祖 A2', generation: 'grandparent', branch: 'A' },
  { id: 'parentB1', label: '祖代 B1', shortLabel: '祖 B1', generation: 'grandparent', branch: 'B' },
  { id: 'parentB2', label: '祖代 B2', shortLabel: '祖 B2', generation: 'grandparent', branch: 'B' }
]);
const manualLineageSlotIds = manualLineageSlotDefinitions.map(row => row.id);
const manualLineageRedFactorTypes = Object.freeze([
  { key: 'turf', label: '草地', aptitudeIndex: 0 },
  { key: 'dirt', label: '泥地', aptitudeIndex: 1 },
  { key: 'short', label: '短距離', aptitudeIndex: 2 },
  { key: 'mile', label: '一哩', aptitudeIndex: 3 },
  { key: 'medium', label: '中距離', aptitudeIndex: 4 },
  { key: 'long', label: '長距離', aptitudeIndex: 5 },
  { key: 'runner', label: '領頭', aptitudeIndex: 6 },
  { key: 'leader', label: '前列', aptitudeIndex: 7 },
  { key: 'betweener', label: '居中', aptitudeIndex: 8 },
  { key: 'chaser', label: '後追', aptitudeIndex: 9 }
]);
const lineageDecisionPolicy = factorRunStrategy?.lineageDecisionPolicy || {};
const lineageG1RoutePolicy = lineageDecisionPolicy?.g1RoutePolicy || {};
const battleScenarioProfiles = (factorRunStrategy?.scenarioProfiles || [])
  .filter(profile => profile?.serverStatus === 'available-zh_tw');
const defaultBattleScenarioId = factorRunStrategy?.scenarioDecision?.defaultScenarioId
  || battleScenarioProfiles[0]?.id
  || null;

function finiteOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function factorExecutionTemplateById(id) {
  return factorExecutionTemplates.find(template => template.id === id)
    || factorExecutionTemplates.find(template => template.id === factorExecutionProfile.defaultTemplateId)
    || factorExecutionTemplates[0]
    || { id: 'manual', label: '自行設定', axes: {} };
}

function factorRiskProfileById(id) {
  return factorExecutionRiskProfiles.find(profile => profile.id === id)
    || factorExecutionRiskProfiles.find(profile => profile.id === factorExecutionProfile.defaultRiskProfileId)
    || factorExecutionRiskProfiles[0]
    || { id: 'balanced', label: '平衡', tradeoffBudget: 0.1, nearTieToleranceRatio: 0.08 };
}

function factorTargetsFromTemplate(template) {
  return Object.fromEntries(factorStatAxes.map(axis => {
    const source = template?.axes?.[axis] || {};
    return [axis, {
      minimum: finiteOrNull(source.minimum),
      target: finiteOrNull(source.target),
      belowWeight: Math.max(0, finiteOrNull(source.belowWeight) ?? 1),
      surplusWeight: Math.max(0, finiteOrNull(source.surplusWeight ?? source.overWeight) ?? 0.25)
    }];
  }));
}

function normalizeFactorExecutionState(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const template = factorExecutionTemplateById(source.templateId);
  const risk = factorRiskProfileById(source.riskProfileId);
  const templateTargets = factorTargetsFromTemplate(template);
  const targets = Object.fromEntries(factorStatAxes.map(axis => {
    const saved = source.targets?.[axis];
    const fallback = templateTargets[axis];
    return [axis, saved && typeof saved === 'object' ? {
      minimum: finiteOrNull(saved.minimum),
      target: finiteOrNull(saved.target),
      belowWeight: Math.max(0, finiteOrNull(saved.belowWeight) ?? fallback.belowWeight),
      surplusWeight: Math.max(0, finiteOrNull(saved.surplusWeight) ?? fallback.surplusWeight)
    } : fallback];
  }));
  const budget = finiteOrNull(source.tradeoffBudgetPercent);
  return {
    templateId: template.id,
    riskProfileId: risk.id,
    tradeoffBudgetPercent: Math.max(0, Math.min(30, budget ?? Number(risk.tradeoffBudget || 0.1) * 100)),
    targets
  };
}

function defaultFactorExecutionState() {
  return normalizeFactorExecutionState({
    templateId: factorExecutionProfile.defaultTemplateId,
    riskProfileId: factorExecutionProfile.defaultRiskProfileId
  });
}

function normalizeManualLineageState(raw = {}) {
  if (typeof persistenceCore?.normalizeManualLineageState === 'function') {
    return persistenceCore.normalizeManualLineageState(raw);
  }
  return {
    schemaVersion: 1,
    slots: Object.fromEntries(manualLineageSlotIds.map(slotId => [slotId, null])),
    redFactors: Object.fromEntries(manualLineageSlotIds.map(slotId => [slotId, null])),
    includeGoalRaces: true,
    activeScheduleSlot: 'target',
    optionalRaces: Object.fromEntries(manualLineageSlotIds.map(slotId => [slotId, []]))
  };
}

function defaultManualLineageState() {
  return normalizeManualLineageState({});
}
// G1 evidence can contain legacy catalog IDs.  Every persistence path must
// receive the same live catalog so it can preserve verified evidence or mark
// unresolved legacy values explicitly instead of silently scoring them.
const persistenceMigrationOptions = {
  raceCatalog: gameCatalog?.races || [],
  server: 'zh_tw'
};

const persistenceLoad = persistenceCore
  ? persistenceCore.load(undefined, persistenceMigrationOptions)
  : { document: { plannerState: {}, breeders: [] }, status: 'unavailable', error: null };
let plannerDocument = persistenceLoad.document;
let breeders = plannerDocument.breeders || [];
const savedPlannerState = plannerDocument.plannerState || {};
const hasSavedPlanner = persistenceLoad.status === 'loaded';

const STRATEGY = currentRaceProfile?.strategy || plannerRules?.strategy?.label || '領頭';
const supportTypeLabels = {
  Speed: '速度',
  Stamina: '耐力',
  Power: '力量',
  Guts: '根性',
  Wisdom: '賢能',
  Friend: '友人',
  Group: '團體',
  Any: '任意'
};
const supportPickerTypeOrder = ['Speed', 'Stamina', 'Power', 'Guts', 'Wisdom', 'Friend', 'Group'];
const supportTypeColors = {
  Speed: '#d84b70',
  Stamina: '#477ac9',
  Power: '#e08a45',
  Guts: '#35a77d',
  Wisdom: '#c86882',
  Friend: '#716b82',
  Group: '#7656b8',
  Any: '#7656b8'
};
const japaneseTextPattern = /[\u3041-\u3096\u30a1-\u30fa\u30fc\u30fd-\u30ff\uff66-\uff9d]/;
const byId = id => document.getElementById(id);
const normalizeSupportType = type => type === 'intelligence' ? 'Wisdom' : type;
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[character]));

const characterNameZhTwByJp = new Map((gameCatalog?.characters || [])
  .filter(character => character.jp_name && character.name_tw)
  .map(character => [character.jp_name, character.name_tw]));
const supportCatalogById = new Map((gameCatalog?.supports || [])
  .map(card => [Number(card.id), card]));
const supportCardProfileById = new Map((supportCardProfiles?.profiles || [])
  .map(profile => [Number(profile.id), profile]));
const supportCardFixtureById = new Map((supportCardLevelFixtures?.profiles || [])
  .map(fixture => [Number(fixture.id), fixture]));
const inventorySupportById = new Map((inventory?.supportCards || [])
  .map(card => [Number(card.id), card]));
const inventoryTraineeByOutfitId = new Map((inventory?.trainees || [])
  .map(trainee => [Number(trainee.outfitId), trainee]));
const skillById = new Map((gameCatalog?.skills || [])
  .map(skill => [Number(skill.id), skill]));
const raceById = new Map((gameCatalog?.races || [])
  .map(race => [Number(race.id), race]));
const characterCardById = new Map((gameCatalog?.characterCards || [])
  .map(card => [Number(card.id), card]));
const characterById = new Map((gameCatalog?.characters || [])
  .map(character => [Number(character.id ?? character.char_id), character]));

// Keep optimizer provenance outside the planner document so persistence-core
// can continue to reject unknown planner fields.  The record is intentionally
// metadata only: it never replaces or mutates a user's saved deck.
const OPTIMIZER_IDENTITY_STORAGE_KEY = 'pretty-derby-optimizer-identity:v1';
const OPTIMIZER_RUNTIME_BUILD_ID = 'pretty-derby-app-runtime-2026-08-10:v1';

function sourceMetadataIdentity(value) {
  const metadata = value?.metadata && typeof value.metadata === 'object'
    ? value.metadata
    : value || {};
  return {
    version: value?.version ?? metadata.version ?? null,
    schemaVersion: value?.schemaVersion ?? metadata.schemaVersion ?? null,
    asOf: metadata.asOf ?? value?.asOf ?? null,
    generatedAt: metadata.generatedAt ?? value?.generatedAt ?? null,
    assetHash: value?.assetHash ?? metadata.assetHash ?? null,
    hash: value?.hash ?? metadata.hash ?? null,
    supportEffectsHash: metadata.supportEffectsHash ?? null
  };
}

function sourceFingerprint(value) {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return 'unserializable';
  }
}

function buildOptimizerIdentity() {
  const acquisition = acquisitionDataIdentity();
  return {
    schemaVersion: 1,
    build: OPTIMIZER_RUNTIME_BUILD_ID,
    core: {
      name: 'deck-optimizer-core',
      modelVersion: deckOptimizerCore?.MODEL_VERSION ?? 'unavailable'
    },
    model: {
      deckOptimizer: deckOptimizerCore?.MODEL_VERSION ?? 'unavailable',
      acquisition: acquisition.modelVersion || 'unavailable',
      supportLevelFixtures: supportCardLevelFixtures?.schemaVersion ?? 'missing'
    },
    source: {
      catalog: {
        ...sourceMetadataIdentity(gameCatalog),
        raceCount: gameCatalog?.races?.length || 0,
        supportCount: gameCatalog?.supports?.length || 0,
        skillCount: gameCatalog?.skills?.length || 0,
        characterCardCount: gameCatalog?.characterCards?.length || 0
      },
      raceProfile: {
        id: currentRaceProfile?.id || null,
        schemaVersion: currentRaceProfile?.schemaVersion ?? null,
        catalogRaceId: Number(currentRaceProfile?.catalogRaceId) || null,
        courseId: Number(currentRaceProfile?.courseId) || null,
        eventMode: currentRaceProfile?.eventMode || null,
        fingerprint: sourceFingerprint(currentRaceProfile)
      },
      strategy: {
        id: jpStrategy?.id || null,
        schemaVersion: jpStrategy?.schemaVersion ?? null,
        fingerprint: sourceFingerprint(jpStrategy)
      },
      supportProfiles: sourceMetadataIdentity(supportCardProfiles),
      eventRoutes: {
        ...sourceMetadataIdentity(supportEventRoutes),
        routeCount: supportEventRoutes?.routes?.length || 0,
        complete: supportEventRoutes?.metadata?.complete === true
      },
      supportLevelFixtures: sourceMetadataIdentity(supportCardLevelFixtures),
      inventory: {
        ...sourceMetadataIdentity(inventory),
        supportFingerprint: sourceFingerprint((inventory?.supportCards || [])
          .map(card => [card.id, card.level, card.limitBreak, card.obtained])),
        traineeFingerprint: sourceFingerprint((inventory?.trainees || [])
          .map(trainee => [trainee.outfitId, trainee.stars, trainee.awakeningLevel]))
      },
      plannerRules: sourceFingerprint(plannerRules),
      scenarioMechanicsPolicies: sourceFingerprint(scenarioMechanicsPolicies)
    }
  };
}

function parseOptimizerIdentityRecord(rawValue) {
  if (!rawValue) return null;
  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== 'object') return null;
    const pending = parsed.pending === true;
    const identity = parsed.identity && typeof parsed.identity === 'object'
      ? parsed.identity
      : pending ? null : parsed;
    return {
      identity,
      identityKey: typeof parsed.identityKey === 'string'
        ? parsed.identityKey
        : identity ? JSON.stringify(identity) : '',
      plannerSavedAt: parsed.plannerSavedAt || null,
      pending
    };
  } catch {
    return null;
  }
}

function readStoredOptimizerIdentity() {
  try {
    return parseOptimizerIdentityRecord(
      window.localStorage.getItem(OPTIMIZER_IDENTITY_STORAGE_KEY)
    );
  } catch {
    return null;
  }
}

const currentOptimizerIdentity = buildOptimizerIdentity();
const currentOptimizerIdentityKey = JSON.stringify(currentOptimizerIdentity);
const savedOptimizerIdentityRecord = readStoredOptimizerIdentity();
const savedOptimizerIdentityKey = savedOptimizerIdentityRecord?.identityKey || '';
const savedOptimizerIdentityPending = savedOptimizerIdentityRecord?.pending === true;
const savedOptimizerIdentityMatchesPlanner = Boolean(
  savedOptimizerIdentityRecord?.plannerSavedAt
  && savedOptimizerIdentityRecord.plannerSavedAt === plannerDocument.savedAt
);
const savedPlannerHasOptimizerState = Boolean(
  savedPlannerState.deckPackageId
  || savedPlannerState.battleUmaOutfitId
  || savedPlannerState.battleOwnedCardsConfirmed === true
  || (Array.isArray(savedPlannerState.battleDeckCardIds)
    && savedPlannerState.battleDeckCardIds.some(id => Number.isFinite(Number(id)) && Number(id) > 0))
);
let optimizerIdentityStale = Boolean(
  savedOptimizerIdentityPending
  || (savedPlannerHasOptimizerState
    && (!savedOptimizerIdentityMatchesPlanner
      || !savedOptimizerIdentityKey
      || savedOptimizerIdentityKey !== currentOptimizerIdentityKey))
);
let optimizerIdentityStaleReason = savedOptimizerIdentityPending
  ? 'optimizer identity pending：舊方案尚未經目前模型明確重新確認'
  : !savedOptimizerIdentityRecord
  ? '已保存方案没有 optimizer identity（舊版分頁或舊版保存格式）'
  : !savedOptimizerIdentityMatchesPlanner
    ? 'optimizer identity 與已保存方案時間不一致（可能由舊分頁寫回）'
    : '已保存方案使用不同的 optimizer source/build/model identity';
let optimizerIdentityStorageUnavailable = false;
let optimizerIdentityPendingSave = false;

function persistOptimizerIdentity() {
  try {
    window.localStorage.setItem(OPTIMIZER_IDENTITY_STORAGE_KEY, JSON.stringify({
      schemaVersion: 1,
      pending: false,
      identity: currentOptimizerIdentity,
      identityKey: currentOptimizerIdentityKey,
      plannerSavedAt: plannerDocument.savedAt || null,
      savedAt: new Date().toISOString()
    }));
    optimizerIdentityStorageUnavailable = false;
    return true;
  } catch {
    optimizerIdentityStorageUnavailable = true;
    return false;
  }
}

function persistOptimizerIdentityPending() {
  try {
    const existing = readStoredOptimizerIdentity();
    window.localStorage.setItem(OPTIMIZER_IDENTITY_STORAGE_KEY, JSON.stringify({
      schemaVersion: 1,
      pending: true,
      // Preserve the observed old identity, if one exists, but never claim
      // that it is the current runtime identity.
      identity: existing?.identity || null,
      identityKey: existing?.identityKey || null,
      plannerSavedAt: plannerDocument.savedAt || null,
      savedAt: new Date().toISOString()
    }));
    optimizerIdentityStorageUnavailable = false;
    return true;
  } catch {
    optimizerIdentityStorageUnavailable = true;
    return false;
  }
}

window.addEventListener('storage', event => {
  if (event.key !== OPTIMIZER_IDENTITY_STORAGE_KEY || !event.newValue) return;
  const incoming = parseOptimizerIdentityRecord(event.newValue);
  if (!incoming?.pending
    && (!incoming?.identityKey || incoming.identityKey === currentOptimizerIdentityKey)) return;
  // A different tab may have loaded another build/data package.  Surface the
  // mismatch, but never reload or rewrite this tab's planner state.
  optimizerIdentityPendingSave = false;
  optimizerIdentityStale = true;
  optimizerIdentityStaleReason = incoming.pending
    ? '另一個分頁保留了待確認的 optimizer identity'
    : '另一個分頁使用了不同的 optimizer source/build/model identity';
  renderOptimizerIdentity();
});

const skillCategories = currentRaceProfile?.skillPlan?.categories || [];
const factorCategories = jpStrategy?.factorPlan?.categories || jpStrategy?.factorCategories || [];
const plannedSkillMetas = [...skillCategories, ...factorCategories].flatMap(category =>
  (category.skills || []).map((skill, index) => ({
    ...skill,
    categoryId: category.id,
    categoryLabel: category.label,
    categoryWeight: Number(category.weight) || 0,
    order: index
  }))
);
const plannedTargetIds = [...new Set(plannedSkillMetas.flatMap(meta =>
  [Number(meta.id), Number(meta.factorId)].filter(Number.isFinite)
))];
const plannedTargetIdSet = new Set(plannedTargetIds);

const profileSurfaceLabel = profile => ({
  1: '草地',
  2: '泥地'
}[Number(profile?.context?.ground_type)] || '場地');
const profileDistanceLabel = profile => ({
  1: '短距離',
  2: '一哩',
  3: '中距離',
  4: '長距離'
}[Number(profile?.context?.distance_type)] || '目前距離');
const profileFactorLabel = profile => {
  const rotation = { 0: '直線', 1: '順', 2: '逆' }[Number(profile?.context?.rotation)];
  const season = { 1: '春', 2: '夏', 3: '秋', 4: '冬' }[Number(profile?.context?.season)];
  const time = { 1: '日', 2: '夕', 3: '夜', 4: '夜' }[Number(profile?.context?.time)];
  const ground = profile?.course?.groundCondition === 'Random'
    ? '場地隨機'
    : profile?.course?.groundCondition;
  const weather = profile?.course?.weather === 'Random'
    ? '天候隨機'
    : profile?.course?.weather;
  return [
    profile?.course?.trackNameZhTw,
    profile?.context?.course_distance ? `${profile.context.course_distance}m` : '',
    rotation,
    season,
    time,
    ground,
    weather
  ].filter(Boolean).join('・');
};

const calendarDistanceLabels = {
  short: '短距離',
  mile: '一哩',
  medium: '中距離',
  long: '長距離'
};
const calendarSeasonLabels = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' };
const calendarWeatherLabels = { sunny: '晴', cloudy: '陰', rain: '雨', snow: '雪' };
const calendarGroundLabels = { good: '良', yielding: '稍重', soft: '重', heavy: '不良' };
const cmRaceSeeds = (Array.isArray(cmRaceCalendar?.entries) ? cmRaceCalendar.entries : [])
  .slice()
  .sort((a, b) => Number(a.sequence) - Number(b.sequence))
  .map(entry => ({
    presetId: entry.id,
    persistKey: `cm:${entry.id}`,
    name: entry.displayName,
    surface: entry.surface === 'dirt' ? '泥地' : '草地',
    distance: calendarDistanceLabels[entry.distanceType] || '距離未定',
    distanceMeters: Number(entry.distanceM),
    style: STRATEGY,
    factor: [
      calendarSeasonLabels[entry.season],
      calendarWeatherLabels[entry.weather],
      calendarGroundLabels[entry.groundCondition]
    ].filter(Boolean).join('・'),
    conditionLabel: [
      calendarSeasonLabels[entry.season],
      calendarWeatherLabels[entry.weather],
      calendarGroundLabels[entry.groundCondition]
    ].filter(Boolean).join('・'),
    icon: 'CM',
    phaseLabel: entry.periodLabel || `同版本 ${String(entry.sequence).padStart(2, '0')}`,
    scheduleStatus: entry.scheduleStatus,
    officialEvidence: entry.officialEvidence,
    sourceUrl: entry.sourceUrl,
    server: entry.server,
    eventMode: entry.eventMode,
    objective: entry.objective,
    courseId: Number(entry.courseId),
    trackId: Number(entry.trackId),
    trackNameZhTw: entry.trackNameZhTw,
    context: {
      always: 1,
      course_distance: Number(entry.distanceM),
      distance_type: Number(entry.distanceTypeCode),
      ground_type: Number(entry.groundType),
      rotation: Number(entry.rotationCode),
      season: Number(entry.seasonCode),
      time: Number(entry.timeCode),
      weather: Number(entry.weatherCode),
      ground_condition: Number(entry.groundConditionCode),
      track_id: Number(entry.trackId),
      is_basis_distance: Number(entry.isBasisDistance),
      is_tight_track: Number(entry.isTightTrack),
      running_style: 1
    }
  }));

const raceSeeds = [
  ...(currentRaceProfile ? [{
    catalogId: currentRaceProfile.catalogRaceId,
    catalogRaceId: currentRaceProfile.catalogRaceId,
    gameToraRaceId: currentRaceProfile.catalogRaceId,
    upstreamRaceId: currentRaceProfile.upstreamRaceId,
    profileId: currentRaceProfile.id,
    current: true,
    scheduleStatus: currentRaceProfile.scheduleStatus,
    phaseLabel: currentRaceProfile.periodLabel,
    officialEvidence: currentRaceProfile.officialEvidence,
    sourceUrl: currentRaceProfile.officialEvidence?.sourceUrl,
    name: currentRaceProfile.name,
    surface: profileSurfaceLabel(currentRaceProfile),
    distance: profileDistanceLabel(currentRaceProfile),
    style: STRATEGY,
    factor: profileFactorLabel(currentRaceProfile),
    icon: 'LOH',
    courseId: currentRaceProfile.courseId,
    trackId: currentRaceProfile.course?.trackId,
    context: { ...currentRaceProfile.context },
    randomConditions: {
      groundCondition: currentRaceProfile.course?.groundCondition,
      weather: currentRaceProfile.course?.weather
    },
    eventMode: currentRaceProfile.eventMode,
    battleDeckTypes: currentRaceProfile.battleDeck.supportTypes
  }] : []),
  ...cmRaceSeeds
];
const distanceLabels = { 1: '短距離', 2: '一哩', 3: '中距離', 4: '長距離' };
const races = raceSeeds.map(seed => {
  const source = gameCatalog?.races?.find(race => Number(race.id) === seed.catalogId);
  const isProfileSeed = Boolean(seed.profileId && currentRaceProfile?.id === seed.profileId);
  if (isProfileSeed) {
    // A planning profile is authoritative.  In particular, 110101 is a
    // catalog race with a grade value, while this LOH plan intentionally has
    // random weather/ground and must not inherit catalog-only conditions.
    const context = { ...(seed.context || {}), always: 1, running_style: 1 };
    delete context.grade;
    delete context.weather;
    delete context.ground_condition;
    const courseId = Number(seed.courseId ?? source?.courseId);
    const catalogRaceId = Number(seed.catalogRaceId ?? seed.catalogId ?? source?.id);
    return {
      ...seed,
      catalogId: catalogRaceId,
      catalogRaceId,
      gameToraRaceId: Number(seed.gameToraRaceId ?? catalogRaceId),
      upstreamRaceId: Number(seed.upstreamRaceId ?? source?.raceId),
      courseId,
      trackId: Number(seed.trackId ?? context.track_id),
      course: findCourse(courseId),
      distanceMeters: Number(context.course_distance),
      context
    };
  }
  if (seed.presetId) {
    const courseId = Number(seed.courseId);
    return {
      ...seed,
      courseId,
      trackId: Number(seed.trackId ?? seed.context?.track_id),
      course: findCourse(courseId),
      distanceMeters: Number(seed.distanceMeters ?? seed.context?.course_distance),
      context: { ...(seed.context || {}), always: 1, running_style: 1 }
    };
  }
  if (!source) return { ...seed, surface: '草地', distance: seed.distance || '中距離' };
  return {
    ...seed,
    name: seed.name || source.nameZhTw,
    surface: seed.surface || (source.groundType === 2 ? '泥地' : '草地'),
    distance: seed.distance || distanceLabels[source.distanceType],
    distanceMeters: Number(source.distance),
    courseId: Number(source.courseId),
    course: findCourse(source.courseId),
    context: { ...source.context, ...(seed.context || {}), running_style: 1 },
    gameToraRaceId: source.id
  };
});

const parents = {
  '短距離': [
    { name: '櫻花進王', detail: '領頭短距離固有與速度白因子', icon: '🌸' },
    { name: '大樹快車', detail: '領頭可用的直線速度方向', icon: '🌳' }
  ],
  '一哩': [
    { name: '大樹快車', detail: '領頭一哩速度固有方向', icon: '🌳' },
    { name: '無聲鈴鹿', detail: '領頭中盤與直線白因子方向', icon: '🔔' }
  ],
  '中距離': [
    { name: '北部玄駒', detail: '領頭中長距離速度與搶位方向', icon: '⛩️' },
    { name: '青雲天空', detail: '領頭彎道加速固有方向', icon: '☁️' }
  ],
  '長距離': [
    {
      name: '北部玄駒',
      outfit: '[錦上．大判御輿]',
      detail: '勝利歡呼嘿呀！｜終盤起點副加速',
      icon: '⛩️',
      outfitId: 106801,
      characterId: 1068,
      skillId: 100681
    },
    {
      name: '青雲天空',
      outfit: '[小貓咪的晚宴]',
      detail: 'Do Ya Breakin!｜終盤起點副加速，CM 優先度較高',
      icon: '☁️',
      outfitId: 102002,
      characterId: 1020,
      skillId: 110201
    },
    {
      name: '重砲',
      outfit: '[搖滾☆MewMeow]',
      detail: 'HOP STEP♪LOCK ON!｜3.5% 回復＋速度／即時速度',
      icon: '🎸',
      outfitId: 102403,
      characterId: 1024,
      skillId: 120241
    },
    {
      name: '美浦波旁',
      outfit: '[CODE：淋面裝飾]',
      detail: '巧克力作戰行動｜中盤保位＋少量回復',
      icon: '🍫',
      outfitId: 102602,
      characterId: 1026,
      skillId: 110261
    }
  ]
};

const defaultInheritanceModes = [
  {
    id: 'balanced',
    label: '中盤穩定型（CM 建議）',
    description: '月賽先保住終盤前 3 名：一個副加速＋一個中盤固有。',
    eventTypes: ['cm', 'loh'],
    directSkillIds: [110201, 110261],
    ancestorSkillIds: [100681, 120241]
  },
  {
    id: 'stamina',
    label: '足耐穩定型',
    description: '耐力壓力高時，把 3.5% 回復固有放進直接親代。',
    eventTypes: ['cm', 'loh'],
    directSkillIds: [110201, 120241],
    ancestorSkillIds: [100681, 110261]
  },
  {
    id: 'firepower',
    label: '雙副加速型（LoH 建議）',
    description: 'LoH 或高穩定需求可雙帶；已有完整主加速時不一定需要。',
    eventTypes: ['loh', 'cm'],
    directSkillIds: [110201, 100681],
    ancestorSkillIds: [120241, 110261]
  }
];
const genericInheritanceModes = [
  {
    id: 'balanced',
    label: '本賽道動態推薦',
    description: '依目前賽道可成立的領頭固有技能重新排序；直接親代優先有效終盤加速，再補中盤保位或回復。',
    eventTypes: ['cm', 'loh'],
    directSkillIds: [],
    ancestorSkillIds: []
  }
];

const defaultFactorPlan = {
  formula: '賽道價值 × 戰馬未覆蓋 × 取得難度 × 發動穩定度',
  redFactor: {
    label: '紅因子',
    primary: '長距離 ★3',
    detail: '長距離 S 最優先；領頭次之，草地最低。'
  },
  blueFactor: {
    label: '藍因子',
    primary: '力量／根性',
    detail: '速2耐2智1團1沒有直接力量、根性卡；耐力未達標時才轉補耐力。'
  },
  categories: [
    {
      id: 'must-factor',
      label: 'S｜優先因子化',
      weight: 500,
      description: '支援卡難補、會直接影響主加速或本育成完成度。',
      skills: [
        {
          id: 210052,
          weight: 520,
          deckEligible: false,
          activationWindow: '序盤斜行',
          reason: '一般支援卡沒有來源；若要完整斜行組合，只能靠既有因子或特定劇本。',
          evidence: ['攻略高評價', '一般支援卡無來源', '進階／有爭議']
        },
        {
          id: 202822,
          weight: 500,
          activationWindow: '2133m 終盤起點',
          reason: '水滴石穿萬里行的白因子；戰馬本體或智力大和赤驥能取時會自動降權。',
          evidence: ['主加速下位', '前 1～3 名條件']
        },
        {
          id: 201172,
          weight: 440,
          activationWindow: '長距離直線',
          reason: '便宜且泛用，日服攻略特別指出本育成較難從支援卡補齊。',
          evidence: ['攻略高評價', '取得較難']
        }
      ]
    },
    {
      id: 'opening-factor',
      label: 'A｜序盤搶位缺口',
      weight: 400,
      description: '目的不是全程第一，而是確保終盤進入時仍在前 3 名。',
      skills: [
        { id: 200532, weight: 430, activationWindow: '起跑', reason: '沒有先手必勝／磐石來源時的最低起跑加速。', evidence: ['Top96 97.83%'] },
        { id: 201601, weight: 420, activationWindow: '序盤', reason: '與三個序盤技能組成啟動包；戰馬卡組有來源時降權。', evidence: ['Top96 70.65%'] },
        { id: 201262, weight: 410, activationWindow: '序盤', reason: '斜行組合中較穩定的一件；智力大和赤驥可提供。', evidence: ['Top96 70.65%'] },
        { id: 200452, weight: 360, activationWindow: '序盤', reason: '速度醒目飛鷹可提供；已有該卡時不必硬刷。', evidence: ['Top96 67.39%', '攻略評價有分歧'] }
      ]
    },
    {
      id: 'middle-factor',
      label: 'A｜中盤與終盤前速度',
      weight: 360,
      description: '京都中盤直線長，可追回位置；終盤前速度比單純末段速度更有價值。',
      skills: [
        { id: 201611, weight: 430, activationWindow: '中盤', reason: '多技能啟動的便宜速度，日服高排名採用率很高。', evidence: ['Top96 84.78%'] },
        { id: 202012, weight: 410, activationWindow: '終盤前', reason: '賽後分析特別提高終盤前區段的權重。', evidence: ['賽後高評價'] },
        { id: 201272, weight: 370, activationWindow: '初中期', reason: '競爭時維持位置；若已指定戰馬卡可取得便會自動降權。', evidence: ['保位速度'] },
        { id: 200542, weight: 360, activationWindow: '中盤', reason: '頂尖跑者的下位；本育成無金技時適合因子補。', evidence: ['保位速度'] },
        { id: 201242, weight: 330, activationWindow: '領頭直線', reason: '適用範圍穩定、技能點效率高。', evidence: ['高 CP'] },
        { id: 201252, weight: 330, activationWindow: '領頭彎道', reason: '本場彎道多；有智力大和赤驥時降權。', evidence: ['高 CP'] },
        { id: 201182, weight: 300, activationWindow: '長距離彎道', reason: '便宜泛用；耐力空中神宮可提供。', evidence: ['高 CP'] }
      ]
    },
    {
      id: 'green-factor',
      label: 'B｜固定綠技與足耐補強',
      weight: 300,
      description: '固定生效、適合因子化，但不應壓過主加速與保位條件。',
      skills: [
        { id: 200012, weight: 410, activationWindow: '全程固定', reason: '順時針固定速度；終盤長使速度綠技 CP 更高。', evidence: ['Top96 66.85%', '攻略高評價'] },
        { id: 200172, weight: 410, activationWindow: '全程固定', reason: '春季固定速度；多個 2025 攻略共同推薦。', evidence: ['Top96 73.37%', '攻略高評價'] },
        { id: 200062, weight: 290, activationWindow: '全程固定', reason: '耐力＋40；足耐不足時升權，足耐已滿時下降。', evidence: ['Top96 30.43%'] },
        { id: 200132, weight: 290, activationWindow: '全程固定', reason: '耐力＋40；依速2耐2智1團1的成品耐力調整。', evidence: ['Top96 36.96%'] }
      ]
    },
    {
      id: 'insurance-factor',
      label: 'C｜條件式保險',
      weight: 180,
      description: '可能很強，但時機或條件不穩；已有三個有效加速後不要繼續堆。',
      skills: [
        { id: 201581, weight: 230, activationWindow: '上坡隨機', reason: '可能命中終盤上坡，也可能提前；標成爭議保險。', evidence: ['Top96 57.07%', '發動位置不固定'] },
        { id: 200492, weight: 210, activationWindow: '末段堵塞', reason: '高排名實績常見，但賽後分析認為完整加速後價值下降。', evidence: ['Top96 73.91%', '賽後評價有分歧'] },
        { id: 210101, weight: 150, deckEligible: false, activationWindow: '末段', reason: '消耗持久力換速度；僅在足耐充裕且不怕耐力削減時採用。', evidence: ['高風險', '非固定核心'] }
      ]
    }
  ]
};

const deckData = {
  '短距離': {
    title: '領頭種馬育成：先拿加速，再補速度',
    notes: ['卡位按目標技能覆蓋選擇', '至少保留一張速度支援卡']
  },
  '一哩': {
    title: '領頭種馬育成：維持中盤位置',
    notes: ['卡位按目標技能覆蓋選擇', '至少保留一張速度支援卡']
  },
  '中距離': {
    title: '領頭種馬育成：足耐後補有效加速',
    notes: ['卡位按目標技能覆蓋選擇', '至少保留一張速度支援卡']
  },
  '長距離': {
    title: '領頭種馬：從戰馬未覆蓋白因子反推',
    notes: [
      '這裡是種馬育成配卡，不是戰馬最終六卡',
      '借卡用來補最高權重缺口，不再固定借耐力目白麥昆',
      '直接親代固有與祖代抽選已在第 2 步分開'
    ]
  }
};

const currentRaceIndex = races.findIndex(race => race.current);
const profileDataIdentityMatches = Boolean(
  currentRaceProfile
  && jpStrategy
  && Number(currentRaceProfile.catalogRaceId) === Number(jpStrategy.catalogRaceId)
  && Number(currentRaceProfile.courseId) === Number(jpStrategy.courseId)
);
const currentProfilePersistenceIdentity = currentRaceProfile ? {
  profileId: currentRaceProfile.id,
  catalogRaceId: Number(currentRaceProfile.catalogRaceId),
  courseId: Number(currentRaceProfile.courseId),
  eventMode: currentRaceProfile.eventMode
} : null;
const savedProfileIdentityMatchesCurrent = Boolean(
  currentProfilePersistenceIdentity
  && savedPlannerState.profileIdentity
  && savedPlannerState.profileIdentity.profileId === currentProfilePersistenceIdentity.profileId
  && Number(savedPlannerState.profileIdentity.catalogRaceId) === currentProfilePersistenceIdentity.catalogRaceId
  && Number(savedPlannerState.profileIdentity.courseId) === currentProfilePersistenceIdentity.courseId
  && savedPlannerState.profileIdentity.eventMode === currentProfilePersistenceIdentity.eventMode
);
const genericBattleDeckIds = [30107, 30210, 30226, 30139, 30227, 30241];
const profileBattleDeckIds = (currentRaceProfile?.battleDeck?.cardIds || [])
  .map(id => Number.isFinite(Number(id)) && Number(id) > 0 ? Number(id) : null)
  .slice(0, 6);
const recommendedBattleDeckIds = profileDataIdentityMatches
  && currentRaceProfile?.battleDeck?.selectionStatus === 'types-only'
  ? profileBattleDeckIds
  : (jpStrategy?.battleDeckCoverageAssumption?.supportIds
    || jpStrategy?.battleDeckAssumption?.supportIds
    || jpStrategy?.battleDeckPreset?.supportIds
    || genericBattleDeckIds).map(Number);
const recommendedBattleDeckBorrowedIndex = (() => {
  const unownedIndex = recommendedBattleDeckIds.findIndex(id => {
    const card = supportCatalogById.get(Number(id));
    return card
      && deckOptimizerCore?.competitiveSourceEligibility?.(card, { server: 'zh_tw' })?.eligible
      && !inventorySupportById.has(Number(id));
  });
  return unownedIndex >= 0 ? unownedIndex : Math.max(0, recommendedBattleDeckIds.length - 1);
})();
const PARENT_SUBVIEWS = ['strategy', 'battle', 'parents', 'library'];
const state = {
  selected: new Set(hasSavedPlanner ? [] : (currentRaceIndex >= 0 ? [currentRaceIndex] : [])),
  primaryRaceKey: savedPlannerState.primaryRaceKey
    || (currentRaceIndex >= 0 ? racePersistKey(races[currentRaceIndex]) : ''),
  custom: Array.isArray(savedPlannerState.customRaces) ? savedPlannerState.customRaces : [],
  main: savedPlannerState.mainParentSkillId ?? null,
  sub: savedPlannerState.subParentSkillId ?? null,
  parentSelectionPackageId: savedPlannerState.parentSelectionPackageId || null,
  battleUmaOutfitId: savedPlannerState.battleUmaOutfitId ?? null,
  selectedAccelerationSkillIds: Array.isArray(savedPlannerState.selectedAccelerationSkillIds)
    ? [...new Set(savedPlannerState.selectedAccelerationSkillIds.map(Number).filter(Number.isFinite))]
    : [],
  residualFactorDecisionConfirmed: savedPlannerState.residualFactorDecisionConfirmed === true
    || (Array.isArray(savedPlannerState.selectedAccelerationSkillIds)
      && savedPlannerState.selectedAccelerationSkillIds.length > 0),
  battleOwnedCardsConfirmed: savedPlannerState.battleOwnedCardsConfirmed === true,
  scenarioId: battleScenarioProfiles.some(profile => profile.id === savedPlannerState.scenarioId)
    ? savedPlannerState.scenarioId
    : defaultBattleScenarioId,
  deckPackageId: savedPlannerState.deckPackageId || null,
  deckPackageModelVersion: Number(savedPlannerState.deckPackageModelVersion) || 0,
  eventMode: savedPlannerState.eventMode || currentRaceProfile?.eventMode || 'cm',
  inheritanceMode: savedPlannerState.inheritanceMode || 'balanced',
  breedingAutomationMode: savedPlannerState.breedingAutomationMode || 'autonomous',
  factorSpecificationEnabled: savedPlannerState.factorSpecificationEnabled !== false,
  applyBattleDeckCoverage: savedPlannerState.applyBattleDeckCoverage !== false,
  battleDeckTypes: currentRaceProfile?.battleDeck?.supportTypes || [],
  battleDeckCardIds: (savedPlannerState.battleDeckCardIds || [])
    .map((id, index) => Number.isFinite(Number(id)) && Number(id) > 0
      ? Number(id)
      : recommendedBattleDeckIds[index])
    .slice(0, 6),
  battleDeckBorrowedIndex:
    hasSavedPlanner
    && Number.isInteger(savedPlannerState.battleDeckBorrowedIndex)
    && savedPlannerState.battleDeckBorrowedIndex >= 0
    && savedPlannerState.battleDeckBorrowedIndex < 6
      ? savedPlannerState.battleDeckBorrowedIndex
      : recommendedBattleDeckBorrowedIndex,
  familyTargetAffinityKey: savedPlannerState.familyTargetAffinityKey || '',
  familyParentBreederIds: Array.isArray(savedPlannerState.familyParentBreederIds)
    ? savedPlannerState.familyParentBreederIds.slice(0, 2)
    : [null, null],
  lineageBreederRecordBindings:
    savedPlannerState.lineageBreederRecordBindings
    && typeof savedPlannerState.lineageBreederRecordBindings === 'object'
    && !Array.isArray(savedPlannerState.lineageBreederRecordBindings)
      ? { ...savedPlannerState.lineageBreederRecordBindings }
      : {},
  manualLineage: normalizeManualLineageState(savedPlannerState.manualLineage),
  factorExecution: normalizeFactorExecutionState(savedPlannerState.factorExecution),
  checklist: savedPlannerState.checklist || {},
  stamina: savedPlannerState.stamina || {},
  activePanel: savedPlannerState.activePanel || 'goal',
  parentSubview: PARENT_SUBVIEWS.includes(savedPlannerState.parentSubview)
    ? savedPlannerState.parentSubview
    : 'strategy'
};
while (state.battleDeckCardIds.length < 6) {
  state.battleDeckCardIds.push(recommendedBattleDeckIds[state.battleDeckCardIds.length] || null);
}
while (state.familyParentBreederIds.length < 2) state.familyParentBreederIds.push(null);

function activeBattleScenario() {
  return battleScenarioProfiles.find(profile => profile.id === state.scenarioId)
    || battleScenarioProfiles.find(profile => profile.id === defaultBattleScenarioId)
    || null;
}

function activeScenarioMechanicsPolicy(profile = activeBattleScenario(), server = 'zh_tw') {
  return (scenarioMechanicsPolicies?.profiles || []).find(policy =>
    policy?.server === server && policy?.scenarioId === profile?.id
  ) || null;
}

function activeScenarioMechanicsSummary(profile = activeBattleScenario()) {
  const mechanics = activeScenarioMechanicsPolicy(profile);
  if (!mechanics) return '尚未綁定此劇本的版本規則；訓練面板效用不作跨版本推定。';
  const mapping = mechanics.releaseMapping || {};
  const policy = mechanics.statUtilityPolicy || {};
  const combined = Number(policy.trainingGainAboveThreshold) * Number(policy.raceEffectAboveThreshold);
  return [
    `台服 ${mapping.zhTwReleaseDate || '日期未記錄'} 對應日服同劇本 ${mapping.jpReferenceReleaseDate || '日期未記錄'}`,
    Number.isFinite(Number(mapping.lagDays)) ? `版本落差 ${Number(mapping.lagDays)} 日` : '',
    Number.isFinite(Number(policy.threshold))
      ? `${Number(policy.threshold)} 後訓練增量 ×${Number(policy.trainingGainAboveThreshold).toFixed(2)}，比賽效用再 ×${Number(policy.raceEffectAboveThreshold).toFixed(2)}（邊際合計 ×${combined.toFixed(2)}）`
      : '',
    mechanics.evidence?.statUtilityCoefficients === 'USER_CONFIRMED'
      ? '係數依玩家確認；劇本與日期由官方資料綁定'
      : ''
  ].filter(Boolean).join('；');
}

function scenarioRequiredSupportIds(profile = activeBattleScenario()) {
  if (profile?.entryCardPolicy !== 'required-one') return [];
  return [...new Set((profile.requiredSupportCardIds || profile.scenarioSupportIds || [])
    .map(Number)
    .filter(Number.isFinite))];
}

function scenarioRequiredSupportCards(profile = activeBattleScenario()) {
  return scenarioRequiredSupportIds(profile)
    .map(id => supportCatalogById.get(Number(id)))
    .filter(Boolean);
}

function normalizeBattleDeckForGuidedFlow() {
  const original = state.battleDeckCardIds.slice(0, 6);
  const originalOwned = original.slice(0, 5).map(Number);
  const borrowedId = original[state.battleDeckBorrowedIndex];
  const ownedIds = [];
  const seen = new Set();
  const targetCharacterId = Number(selectedBattleUmaCard()?.characterId);
  const seenCharacters = new Set();
  original.forEach((id, index) => {
    const card = supportCatalogById.get(Number(id));
    if (index === state.battleDeckBorrowedIndex || !card) return;
    if (!inventorySupportById.has(Number(card.id))
      || !deckOptimizerCore?.competitiveSourceEligibility?.(card, { server: 'zh_tw' })?.eligible
      || seen.has(String(card.id))
      || (Number.isFinite(targetCharacterId) && Number(card.characterId) === targetCharacterId)
      || seenCharacters.has(String(card.characterId))) return;
    seen.add(String(card.id));
    seenCharacters.add(String(card.characterId));
    ownedIds.push(Number(card.id));
  });
  const ownedPool = (gameCatalog?.supports || [])
    .filter(card => inventorySupportById.has(Number(card.id)))
    .filter(card => deckOptimizerCore?.competitiveSourceEligibility?.(card, { server: 'zh_tw' })?.eligible)
    .filter(card => !Number.isFinite(targetCharacterId) || Number(card.characterId) !== targetCharacterId)
    .sort((a, b) => Number(b.id) - Number(a.id));
  for (const card of ownedPool) {
    if (ownedIds.length >= 5) break;
    if (seen.has(String(card.id)) || seenCharacters.has(String(card.characterId))) continue;
    seen.add(String(card.id));
    seenCharacters.add(String(card.characterId));
    ownedIds.push(Number(card.id));
  }
  const fallbackBorrow = (() => {
    const current = supportCatalogById.get(Number(borrowedId));
    if (current
      && !seen.has(String(current.id))
      && !seenCharacters.has(String(current.characterId))
      && deckOptimizerCore?.competitiveSourceEligibility?.(current, { server: 'zh_tw' })?.eligible) {
      return current;
    }
    return (gameCatalog?.supports || [])
      .filter(card => deckOptimizerCore?.competitiveSourceEligibility?.(card, { server: 'zh_tw' })?.eligible)
      .find(card => !seen.has(String(card.id)) && !seenCharacters.has(String(card.characterId)));
  })()
    || null;
  state.battleDeckCardIds = [...ownedIds.slice(0, 5), fallbackBorrow ? Number(fallbackBorrow.id) : null];
  state.battleDeckBorrowedIndex = 5;
  if (originalOwned.join(',') !== state.battleDeckCardIds.slice(0, 5).map(Number).join(',')) {
    state.battleOwnedCardsConfirmed = false;
  }
}

function activeRaceUsesTypesOnlyProfileDeck() {
  const race = primaryRace();
  return Boolean(
    profileDataIdentityMatches
    && currentRaceProfile?.battleDeck?.selectionStatus === 'types-only'
    && race?.profileId === currentRaceProfile?.id
  );
}

function shouldDeferTypesOnlyDeckToOptimizer() {
  return activeRaceUsesTypesOnlyProfileDeck() && !selectedBattleUmaCard();
}

function shouldKeepTypesOnlyBattleDeckEmpty() {
  return shouldDeferTypesOnlyDeckToOptimizer()
    && state.battleDeckCardIds.every(id => !Number.isFinite(Number(id)) || Number(id) <= 0);
}

if (shouldDeferTypesOnlyDeckToOptimizer()) {
  state.battleDeckCardIds = Array.from({ length: 6 }, () => null);
  state.battleDeckBorrowedIndex = 5;
} else {
  normalizeBattleDeckForGuidedFlow();
}

let saveTimer = null;
let cachedDeckOptimizationKey = '';
let cachedDeckOptimization = null;
// A deck-comfort result is derived entirely from one immutable optimizer
// result plus the same race/uma target contract. Weak keys avoid another
// manual invalidation path whenever the optimizer cache is replaced.
const deckComfortComparisonCache = new WeakMap();
// Per-lineage-step decks are deterministic for a given trainee, target set,
// scenario and inventory snapshot. Keep the expensive deck construction out
// of every rerender, while leaving it separate from the battle-deck cache.
const lineageStepDeckCache = new Map();
const lineageG1FoundationRouteCache = new Map();
let lineageOpenStepId = null;
let lineageStepViewMode = 'next';
let manualLineagePickerSlotId = null;
let manualLineageRedEditorSlotId = null;
let manualLineageScheduleBundle = null;
let cmOaksWhiteFactorRouteId = 'kitasan';
let cmOaksRentalImportResult = null;
// A race change on Step 1 only needs the compact race summary.  The guided
// deck/parent workbench is rebuilt when Step 2 is opened, not while it is hidden.
let raceDerivedViewsDirty = false;
// Visual workbench state intentionally stays outside the persisted planner state.
// Reopening a completed stage must never alter a confirmed calculation/package.
let guidedOpenStage = null;
let guidedLastCurrentStage = null;
let guidedStageStates = {};
let guidedInputModality = 'keyboard';
let suppressBeforeUnloadSave = false;
let staminaFormHydrated = false;
let breederDraftWhiteFactors = [];
let breederDraftG1Wins = [];
let breederReturnFocus = null;

function preferredScrollBehavior() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

function racePersistKey(race) {
  if (!race) return '';
  if (race.persistKey) return String(race.persistKey);
  if (race.profileId) return `profile:${race.profileId}`;
  if (race.gameToraRaceId || race.catalogId) return `race:${race.gameToraRaceId || race.catalogId}`;
  return `custom:${race.id || race.name || 'race'}`;
}

function applyRaceEventMode(race = primaryRace()) {
  if (!['cm', 'loh'].includes(String(race?.eventMode || ''))) return false;
  state.eventMode = race.eventMode;
  [byId('eventMode'), byId('guidedEventMode')]
    .filter(Boolean)
    .forEach(select => { select.value = state.eventMode; });
  return true;
}

function isCurrentProfileRace(race = primaryRace()) {
  return Boolean(race?.profileId && race.profileId === currentRaceProfile?.id);
}

function resetRaceDependentProfileState() {
  if (allRaces()[currentRaceIndex]) {
    selectSingleRace(currentRaceIndex);
  } else {
    state.selected.clear();
    state.primaryRaceKey = '';
  }
  state.main = null;
  state.sub = null;
  state.parentSelectionPackageId = null;
  state.battleUmaOutfitId = null;
  state.selectedAccelerationSkillIds = [];
  state.residualFactorDecisionConfirmed = false;
  state.battleOwnedCardsConfirmed = false;
  state.scenarioId = defaultBattleScenarioId;
  state.deckPackageId = null;
  state.deckPackageModelVersion = 0;
  state.battleDeckCardIds = Array.from({ length: 6 }, () => null);
  state.battleDeckBorrowedIndex = 5;
  state.battleDeckTypes = currentRaceProfile?.battleDeck?.supportTypes || [];
  state.eventMode = currentRaceProfile?.eventMode || 'cm';
  state.inheritanceMode = 'balanced';
  state.familyTargetAffinityKey = '';
  state.familyParentBreederIds = [null, null];
  state.lineageBreederRecordBindings = {};
  state.manualLineage = defaultManualLineageState();
  state.factorExecution = defaultFactorExecutionState();
  state.checklist = {};
  state.stamina = {};
  cachedRaceStrategy = null;
  cachedRaceStrategyKey = '';
  cachedCourseImpact = null;
  cachedCourseImpactKey = '';
  cachedDeckOptimization = null;
  cachedDeckOptimizationKey = '';
}

function staminaStateFromForm() {
  const value = id => byId(id)?.value;
  const checked = id => Boolean(byId(id)?.checked);
  return {
    speed: value('expectedSpeed'),
    stamina: value('expectedStamina'),
    power: value('expectedPower'),
    guts: value('expectedGuts'),
    wisdom: value('expectedWisdom'),
    mood: value('simMood'),
    distanceAptitude: value('simDistanceAptitude'),
    reference: value('staminaReference'),
    goldRecoveryCount: value('reliableGoldRecoveryCount'),
    inheritedRecoveryCount: value('inheritedRecoveryCount'),
    hasKyotoGreen: checked('hasKyotoGreen'),
    hasBasisGreen: checked('hasBasisGreen'),
    kakariSeconds: value('simKakariSeconds'),
    spotStruggleSeconds: value('simSpotSeconds'),
    downhillPercent: value('simDownhillPercent'),
    debuffPercent: value('simDebuffPercent'),
    speedBonus: value('simSpeedBonus')
  };
}

function plannerSnapshot() {
  const race = primaryRace();
  const primaryRaceKey = racePersistKey(race);
  return {
    activePanel: state.activePanel,
    parentSubview: state.parentSubview,
    selectedRaceKeys: [primaryRaceKey].filter(Boolean),
    primaryRaceKey,
    profileIdentity: race?.profileId === currentRaceProfile?.id
      ? currentProfilePersistenceIdentity
      : null,
    customRaces: state.custom,
    battleUmaOutfitId: state.battleUmaOutfitId,
    selectedAccelerationSkillIds: state.selectedAccelerationSkillIds,
    residualFactorDecisionConfirmed: state.residualFactorDecisionConfirmed,
    battleOwnedCardsConfirmed: state.battleOwnedCardsConfirmed,
    scenarioId: state.scenarioId,
    deckPackageId: state.deckPackageId,
    deckPackageModelVersion: state.deckPackageModelVersion,
    eventMode: state.eventMode,
    inheritanceMode: state.inheritanceMode,
    breedingAutomationMode: state.breedingAutomationMode,
    factorSpecificationEnabled: state.factorSpecificationEnabled,
    applyBattleDeckCoverage: state.applyBattleDeckCoverage,
    mainParentSkillId: state.main,
    subParentSkillId: state.sub,
    parentSelectionPackageId: state.parentSelectionPackageId,
    battleDeckCardIds: state.battleDeckCardIds,
    battleDeckBorrowedIndex: state.battleDeckBorrowedIndex,
    familyTargetAffinityKey: state.familyTargetAffinityKey,
    familyParentBreederIds: state.familyParentBreederIds,
    lineageBreederRecordBindings: state.lineageBreederRecordBindings,
    manualLineage: state.manualLineage,
    factorExecution: state.factorExecution,
    checklist: {
      factorReady: Boolean(byId('factorReadyCheck')?.checked),
      skillPointReady: Boolean(byId('skillPointCheck')?.checked)
    },
    stamina: staminaStateFromForm()
  };
}

function setSaveStatus(message, status = 'ready') {
  const output = byId('saveStatus');
  if (!output) return;
  output.textContent = message;
  output.dataset.state = status;
}

function persistPlanner() {
  if (!persistenceCore) {
    setSaveStatus('瀏覽器不支援本機保存', 'error');
    return false;
  }
  const result = persistenceCore.save({
    ...plannerDocument,
    plannerState: plannerSnapshot(),
    breeders
  }, undefined, persistenceMigrationOptions);
  if (!result.ok) {
    setSaveStatus(`保存失敗：${result.error?.message || '未知錯誤'}`, 'error');
    return false;
  }
  plannerDocument = result.document;
  breeders = plannerDocument.breeders;
  const time = new Date(plannerDocument.savedAt).toLocaleTimeString('zh-TW', {
    hour: '2-digit',
    minute: '2-digit'
  });
  // Persist provenance separately from plannerState so old persistence
  // schemas remain readable and a stale deck can be disclosed without an
  // automatic reload or destructive migration.
  // A stale planner must remain stale across ordinary autosaves.  Only an
  // explicit package confirmation may mark the identity for the next save;
  // the current identity is written only after that planner save succeeds.
  if (optimizerIdentityPendingSave) {
    if (persistOptimizerIdentity()) {
      optimizerIdentityPendingSave = false;
      optimizerIdentityStale = false;
      optimizerIdentityStaleReason = '';
    } else {
      optimizerIdentityStale = true;
      optimizerIdentityStaleReason = '方案已套用，但 optimizer identity 保存失敗；仍需重新保存確認';
      persistOptimizerIdentityPending();
    }
  } else if (optimizerIdentityStale) {
    persistOptimizerIdentityPending();
  } else if (!persistOptimizerIdentity()) {
    optimizerIdentityStale = true;
    optimizerIdentityStaleReason = 'planner 已保存，但 optimizer identity 保存失敗';
    persistOptimizerIdentityPending();
  }
  renderOptimizerIdentity();
  setSaveStatus(`已自動保存於此裝置 · ${time}`, 'saved');
  return true;
}

function scheduleSave() {
  clearTimeout(saveTimer);
  setSaveStatus('正在保存…');
  saveTimer = setTimeout(persistPlanner, 180);
}

function downloadPlannerBackup() {
  if (!persistenceCore) return;
  const content = persistenceCore.serialize({
    ...plannerDocument,
    plannerState: plannerSnapshot(),
    breeders
  }, persistenceMigrationOptions);
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `pretty-derby-planner-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function importPlannerBackup(file) {
  if (!file || !persistenceCore) return;
  try {
    const rawText = (await file.text()).replace(/^\uFEFF/, '');
    const rawDocument = JSON.parse(rawText);
    if (
      !rawDocument
      || typeof rawDocument !== 'object'
      || !Array.isArray(rawDocument.breeders)
      || !(rawDocument.plannerState || rawDocument.state)
    ) {
      throw new Error('這不是本工具匯出的計畫備份檔');
    }
    if (
      rawDocument.schemaVersion != null
      && Number(rawDocument.schemaVersion) > Number(persistenceCore.SCHEMA_VERSION)
    ) {
      throw new Error(`備份版本 ${rawDocument.schemaVersion} 高於目前支援版本`);
    }
    const imported = persistenceCore.parseImport(rawDocument, persistenceMigrationOptions);
    const validation = breederCore?.validateBreederDatabase(
      breederCoreDatabase(imported.breeders),
      { affinityData: affinity }
    );
    if (validation && !validation.valid) {
      throw new Error(validation.errors.map(error => error.message).join(' '));
    }
    const result = persistenceCore.save(imported, undefined, persistenceMigrationOptions);
    if (!result.ok) throw result.error;
    suppressBeforeUnloadSave = true;
    clearTimeout(saveTimer);
    window.location.reload();
  } catch (error) {
    setSaveStatus(`匯入失敗：${error.message}`, 'error');
  }
}

function localizedUmaName(name) {
  if (!name) return '未指定';
  return characterNameZhTwByJp.get(name) || (japaneseTextPattern.test(name) ? '未提供繁中名稱' : name);
}

function localizedSkillName(skillOrId) {
  const skill = typeof skillOrId === 'object' ? skillOrId : skillById.get(Number(skillOrId));
  return skill?.nameZhTw || `技能 ${typeof skillOrId === 'object' ? skillOrId?.id : skillOrId || ''}`.trim();
}

function localizedSupportLabels(card) {
  const source = supportCatalogById.get(Number(card?.id));
  const rawName = source?.nameZhTw || source?.name || card?.characterNameZhTw || card?.characterNameJp;
  const rawTitle = source?.titleZhTw || source?.title || card?.titleZhTw || '';
  return {
    name: localizedUmaName(rawName),
    title: japaneseTextPattern.test(rawTitle) ? '' : rawTitle
  };
}

function supportCardSourceLabel(card) {
  const source = String(card?.obtained || '').toLowerCase();
  return {
    gacha: '抽卡（gacha）',
    story_event: '劇情活動（story_event）',
    shop: '商店（shop）',
    event: '活動（event）',
    welfare: '配布／免費（welfare）',
    free: '配布／免費（free）'
  }[source] || (source ? `來源：${source}` : '來源資料缺失');
}

function supportCardImagePath(card) {
  const id = Number(card?.id);
  return Number.isFinite(id) ? `assets/support-cards/${id}.png` : '';
}

function supportCardOwnershipDetail(card, options = {}) {
  if (!card) return '尚未指定';
  if (options.borrowed) {
    return `借卡・滿突 Lv${options.level || card.level || ({ SSR: 50, SR: 45, R: 40 }[card.rarity] || '?')}`;
  }
  const owned = inventorySupportById.get(Number(card.id));
  if (owned) {
    const level = Number.isFinite(Number(owned.level)) ? `Lv${owned.level}` : '等級未建檔';
    const limitBreak = Number.isFinite(Number(owned.limitBreak)) ? `${owned.limitBreak}突` : '突破未建檔';
    return `${level}・${limitBreak}`;
  }
  if (['R', 'SR'].includes(card.rarity)) return '預設持有（R／SR）';
  return '已持有・等級未建檔';
}

function supportCardImageMarkup(card, options = {}) {
  const labels = localizedSupportLabels(card);
  const type = supportTypeLabels[normalizeSupportType(card?.supportType)]
    || normalizeSupportType(card?.supportType)
    || '支援';
  const rarity = card?.rarity || '卡片';
  const alt = `${rarity}${type}支援卡 ${labels.name}${labels.title ? ` ${labels.title}` : ''}`;
  const fallback = String(labels.name || type).trim().slice(0, 2) || '卡';
  const source = supportCardImagePath(card);
  const thumb = Number.isFinite(Number(card?.id))
    ? `assets/support-cards/${Number(card.id)}.thumb.png`
    : '';
  return `<span class="support-card-art${source ? '' : ' is-missing'}" data-support-card-art="${Number(card?.id) || ''}">
    ${source ? `<img src="${escapeHtml(source)}" alt="${escapeHtml(alt)}" width="96" height="128" data-asset-kind="full-small" data-fallback-src="${escapeHtml(thumb)}" ${options.eager ? '' : 'loading="lazy"'} onerror="if(this.dataset.fallbackTried!=='1'&&this.dataset.fallbackSrc){this.dataset.fallbackTried='1';this.dataset.assetKind='thumbnail-fallback';this.src=this.dataset.fallbackSrc;}else{this.hidden=true;this.parentElement.classList.add('is-missing')}" />` : ''}
    <span class="support-card-art-fallback" aria-hidden="true"><b>${escapeHtml(type)}</b><strong>${escapeHtml(fallback)}</strong><small>${escapeHtml(rarity)}</small></span>
  </span>`;
}

function traineePortraitPath(cardOrCandidate) {
  const outfitId = Number(cardOrCandidate?.outfitId ?? cardOrCandidate?.id);
  return Number.isFinite(outfitId) ? `assets/trainee-portraits/${outfitId}.png` : '';
}

function traineePortraitMarkup(cardOrCandidate, className = '') {
  const name = cardOrCandidate?.nameZhTw || cardOrCandidate?.name || '賽馬娘';
  const outfit = cardOrCandidate?.outfitTitleZhTw
    || cardOrCandidate?.titleZhTw
    || cardOrCandidate?.outfit
    || '';
  const source = cardOrCandidate?.imagePath || traineePortraitPath(cardOrCandidate);
  const fallback = [...String(name)].find(character => character.trim()) || '馬';
  return `<span class="trainee-portrait ${escapeHtml(className)}">
    ${source ? `<img src="${escapeHtml(source)}" alt="${escapeHtml(`${name} ${outfit}`.trim())}" loading="lazy" onerror="this.hidden=true;this.parentElement.classList.add('is-missing')" />` : ''}
    <span class="trainee-portrait-fallback" aria-hidden="true">${escapeHtml(fallback)}</span>
  </span>`;
}

function inheritanceModes() {
  const source = hasActiveProfileStrategy()
    ? (jpStrategy?.inheritanceModes || defaultInheritanceModes)
    : genericInheritanceModes;
  return source.map(mode => ({
    ...mode,
    directSkillIds: mode.directSkillIds || mode.directUniqueIds || [],
    ancestorSkillIds: mode.ancestorSkillIds || mode.ancestorUniqueIds || []
  }));
}

function configuredParentCandidates() {
  if (!hasActiveProfileStrategy()) return [];
  const configured = jpStrategy?.parentCandidates || jpStrategy?.inheritanceCandidates;
  if (!Array.isArray(configured)) return [];
  return configured.map(candidate => {
    const card = gameCatalog?.characterCards?.find(item =>
      Number(item.id) === Number(candidate.outfitId));
    return {
      ...candidate,
      name: candidate.name || candidate.nameZhTw || card?.nameZhTw || card?.name,
      outfit: candidate.outfit || candidate.outfitTitleZhTw || card?.titleZhTw || card?.title,
      detail: candidate.detail || candidate.summary || candidate.role || '',
      characterId: Number(candidate.characterId || card?.characterId),
      skillId: Number(candidate.skillId || candidate.uniqueSkillId),
      icon: candidate.icon || '🏇'
    };
  });
}

function longParentCandidates() {
  const configured = configuredParentCandidates();
  return configured;
}

function selectedBattleUmaCard() {
  if (!state.battleUmaOutfitId) return null;
  return gameCatalog?.characterCards?.find(card =>
    Number(card.id) === Number(state.battleUmaOutfitId)) || null;
}

function battleCardCertainSkillIds(card) {
  if (!card) return [];
  const inventoryEntry = inventoryTraineeByOutfitId.get(Number(card.id));
  const awakeningLevel = Math.max(1, Math.min(5, Number(inventoryEntry?.awakeningLevel) || 1));
  if (typeof battleHorseRankingCore?.resolveBodyPackage === 'function') {
    const body = battleHorseRankingCore.resolveBodyPackage({
      card,
      catalog: gameCatalog,
      target: activeGoalContractTarget(),
      awakeningLevel
    });
    if (body?.evidence?.target === 'READY') {
      return [...new Set((body.active || [])
        .map(row => Number(row.skillId))
        .filter(Number.isFinite))];
    }
  }
  const unlockedAwakening = (card.awakeningSkillIds || []).slice(0, awakeningLevel - 1);
  return [...new Set([
    ...(card.uniqueSkillIds || []),
    ...(card.innateSkillIds || []),
    ...unlockedAwakening
  ].map(Number).filter(Number.isFinite))];
}

function battleUmaCertainSkillIds() {
  return battleCardCertainSkillIds(selectedBattleUmaCard());
}

function usefulAccelerationCandidates() {
  const table = activeCourseAccelerationTable();
  if (!table) {
    return guidedPlannerCore?.usefulAccelerations(activeRaceStrategy(), gameCatalog) || [];
  }
  return table.families
    .filter(candidate => candidate.actionable && Number(candidate.routeBashin) >= 0.25)
    .map((candidate, index) => ({
      ...candidate,
      courseRank: index + 1,
      effectLabel: `單技能約 +${Number(candidate.expectedBashin).toFixed(2)} 馬身`,
      priority: `${candidate.priority}｜第 ${index + 1} 名`
    }));
}

function remainingAccelerationCandidates() {
  if (!selectedBattleUmaCard()) return [];
  const remaining = guidedPlannerCore?.remainingAccelerations(
    usefulAccelerationCandidates(),
    battleUmaCertainSkillIds(),
    gameCatalog
  ) || [];
  const selectedParentIds = new Set([state.main, state.sub]
    .filter(hasSelectedParentId)
    .map(Number));
  if (!selectedParentIds.size) return remaining;
  // Parent-unique skills are obtained only by changing the selected parent.
  // Once both parents are fixed, selected uniques are already covered and
  // unselected uniques are not legitimate white-factor checkboxes.
  return remaining.filter(candidate => candidate.sourceKind !== 'parent-unique');
}

function selectedAccelerationCandidates() {
  const selected = new Set(state.selectedAccelerationSkillIds.map(Number));
  return remainingAccelerationCandidates().filter(candidate => selected.has(Number(candidate.id)));
}

function accelerationSelectionComplete() {
  return Boolean(selectedBattleUmaCard())
    && parentSelectionComplete()
    && (
      state.residualFactorDecisionConfirmed
      || selectedAccelerationCandidates().length > 0
      || remainingAccelerationCandidates().length === 0
    );
}

function battleDeckCoversAcceleration(candidate) {
  const row = activePlanningSnapshot()?.rows?.find(item =>
    Number(item.familyId) === Number(candidate?.familyId)
  );
  return Number(row?.coverageProbability) >= 0.999;
}

function breedingAccelerationCandidates() {
  const snapshot = activePlanningSnapshot();
  return selectedAccelerationCandidates()
    .map(candidate => {
      const need = snapshot?.rows?.find(item =>
        Number(item.familyId) === Number(candidate.familyId)
      );
      return { ...candidate, need };
    })
    .filter(candidate => Number(candidate.need?.residualWeight ?? 1) > 0.05);
}

function syncSelectedAccelerations() {
  const valid = new Set(remainingAccelerationCandidates().map(candidate => Number(candidate.id)));
  const before = state.selectedAccelerationSkillIds.map(Number);
  state.selectedAccelerationSkillIds = [...new Set(before.filter(id => valid.has(id)))];
}

function recommendedRouteGreens() {
  return guidedPlannerCore?.recommendedGreenSkills(activeRaceStrategy(), gameCatalog, 3) || [];
}

function expectedBattleDeckTemplate() {
  const distanceType = Number(activeRaceStrategy()?.context?.distance_type || 3);
  const scenario = activeBattleScenario();
  const scenarioRequired = [
    ...(scenario?.requiredSupportTypes || []),
    ...scenarioRequiredSupportCards(scenario).map(card => normalizeSupportType(card.supportType))
  ].map(normalizeSupportType).filter(Boolean);
  const scenarioTypes = [...new Set(scenarioRequired)];
  const hasRequiredScenarioCard = scenario?.entryCardPolicy === 'required-one'
    && scenarioRequiredSupportIds(scenario).length > 0;
  const isTwinkleMedium = distanceType === 3
    && hasRequiredScenarioCard
    && (scenario?.id === 'twinkle-legends'
      || scenarioRequiredSupportIds(scenario).includes(30241));
  const baseRequiredTypes = distanceType === 4
    ? ['Speed', 'Speed', 'Stamina', 'Stamina', 'Wisdom']
    : distanceType <= 2
      ? ['Speed', 'Speed', 'Power', 'Power', 'Wisdom']
      : ['Speed', 'Speed', 'Stamina', 'Power', 'Wisdom'];
  const flexTypes = hasRequiredScenarioCard && !scenarioTypes.some(type =>
    baseRequiredTypes.includes(type)
  )
    ? scenarioTypes
    : ['Speed', 'Stamina', 'Power', 'Guts', 'Friend', 'Group'];
  if (isTwinkleMedium) {
    return {
      requiredTypes: ['Speed', 'Speed', 'Stamina', 'Stamina', 'Wisdom'],
      flexSlots: 1,
      flexTypes: scenarioTypes.length ? scenarioTypes : ['Group'],
      label: '傳奇盃中距離：速度×2＋耐力×2＋賢能×1＋劇本必帶卡',
      groupRequired: scenarioTypes.includes('Group')
    };
  }
  if (distanceType === 4) {
    return {
      requiredTypes: ['Speed', 'Speed', 'Stamina', 'Stamina', 'Wisdom'],
      flexSlots: 1,
      flexTypes,
      label: hasRequiredScenarioCard
        ? '長距離：速度×2＋耐力×2＋賢能×1＋劇本必帶卡'
        : '長距離：速度×2＋耐力×2＋賢能×1＋彈性位',
      groupRequired: scenarioTypes.includes('Group') && hasRequiredScenarioCard
    };
  }
  if (distanceType <= 2) {
    return {
      requiredTypes: ['Speed', 'Speed', 'Power', 'Power', 'Wisdom'],
      flexSlots: 1,
      flexTypes,
      label: hasRequiredScenarioCard
        ? '短距離／一哩：速度×2＋力量×2＋賢能×1＋劇本必帶卡'
        : '短距離／一哩：速度×2＋力量×2＋賢能×1＋彈性位',
      groupRequired: scenarioTypes.includes('Group') && hasRequiredScenarioCard
    };
  }
  return {
    requiredTypes: ['Speed', 'Speed', 'Stamina', 'Power', 'Wisdom'],
    flexSlots: 1,
    flexTypes,
    label: hasRequiredScenarioCard
      ? '中距離：速度×2＋耐力×1＋力量×1＋賢能×1＋劇本必帶卡'
      : '中距離：速度×2＋耐力×1＋力量×1＋賢能×1＋彈性位',
    groupRequired: scenarioTypes.includes('Group') && hasRequiredScenarioCard
  };
}

function expectedBattleDeckTypes() {
  const template = expectedBattleDeckTemplate();
  return [...template.requiredTypes, template.flexTypes?.[0] || 'Any'];
}

function normalizeDeckDomainWeight(value, fallback = 100) {
  if (typeof deckOptimizerCore?.normalizeDomainWeight === 'function') {
    return deckOptimizerCore.normalizeDomainWeight(value, fallback);
  }
  const numericFallback = Number(fallback);
  const safeFallback = Number.isFinite(numericFallback)
    && numericFallback > 0
    && numericFallback <= 1000000
    ? numericFallback
    : 100;
  const numeric = Number(value);
  return Number.isFinite(numeric)
    && numeric > 0
    && numeric <= 1000000
    && numeric < Number.MAX_SAFE_INTEGER
    ? numeric
    : safeFallback;
}

function acquisitionDataIdentity() {
  if (typeof deckOptimizerCore?.acquisitionDataIdentity === 'function') {
    return deckOptimizerCore.acquisitionDataIdentity({
      supportEventRoutes,
      supportProfiles: supportCardProfiles
    });
  }
  const routeMetadata = supportEventRoutes?.metadata || {};
  const profileMetadata = supportCardProfiles?.metadata || {};
  return {
    modelVersion: skillAcquisitionCore?.MODEL_VERSION || 'skill-acquisition-unavailable',
    eventRouteDataVersion: String(
      supportEventRoutes?.version
      || supportEventRoutes?.schemaVersion
      || routeMetadata.parserVersion
      || 'missing'
    ),
    eventRouteDataHash: String(
      supportEventRoutes?.hash
      || routeMetadata.hash
      || [
        supportEventRoutes ? 'present' : 'missing',
        supportEventRoutes?.schemaVersion || 0,
        routeMetadata.parserVersion || '',
        routeMetadata.generatedAt || '',
        routeMetadata.routeCount || supportEventRoutes?.routes?.length || 0,
        routeMetadata.complete === true ? 'complete' : 'partial'
      ].join(':')
    ),
    supportProfileVersion: String(
      supportCardProfiles?.version
      || [
        supportCardProfiles ? 'present' : 'missing',
        supportCardProfiles?.schemaVersion || 0,
        profileMetadata.asOf || '',
        profileMetadata.assetHash || '',
        profileMetadata.supportEffectsHash || ''
      ].join(':')
    ),
    coreAvailable: Boolean(skillAcquisitionCore)
  };
}

function acquisitionScenarioProxy() {
  const configured = activeBattleScenario()?.acquisitionScenarioProxy
    || activeRaceStrategy()?.acquisitionScenarioProxy
    || currentRaceProfile?.acquisitionScenarioProxy
    || {};
  const configuredCount = Number(
    configured.hintOpportunityCount
    ?? configured.opportunityCount
  );
  const configuredOpeningSkillCount = Number(
    configured.openingSkillCount
      ?? configured.plannedOpeningSkillCount
  );
  const configuredContinuousProbability = Number(configured.continuousEventProbability);
  const configuredLifecycle = configured.trainingLifecycleProxy
    || configured.lifecycleProxy
    || null;
  const trainingLifecycleProxy = configuredLifecycle || {
    version: 'training-lifecycle-proxy-v1',
    source: 'heuristic-support-lifecycle',
    explicit: false,
    formalPhase: 'expected',
    phases: {
      lower: {
        label: 'lower',
        facilityLevel: 1,
        ownedSkillCounts: { speed: 0 },
        bondProbability: 0.25,
        weight: 0.25
      },
      expected: {
        label: 'expected',
        facilityLevel: 3,
        ownedSkillCounts: { speed: 1 },
        bondProbability: 0.65,
        weight: 0.5
      },
      peak: {
        label: 'peak',
        facilityLevel: 5,
        ownedSkillCounts: { speed: 3 },
        bondProbability: 0.9,
        weight: 0.25
      }
    },
    note: '公開資料沒有完整育成設施Lv×回合分布；lower／expected／peak 是有界 scenario proxy，正式競技分只用 expected。'
  };
  return {
    hintOpportunityCount: Number.isFinite(configuredCount) && configuredCount > 0
      ? configuredCount
      : 50,
    singleCardHintOpportunityCount: 1,
    continuousEventProbability: Number.isFinite(configuredContinuousProbability)
      && configuredContinuousProbability >= 0
      && configuredContinuousProbability <= 1
      ? configuredContinuousProbability
      : 0.75,
    continuousEventProbabilitySource: Number.isFinite(configuredContinuousProbability)
      ? 'configured-heuristic'
      : 'default-heuristic-proxy',
    source: configured.source || 'heuristic-full-training-horizon',
    explicit: Number.isFinite(configuredCount) && configuredCount > 0,
    openingSkillCount: Number.isFinite(configuredOpeningSkillCount)
      && configuredOpeningSkillCount >= 0
      ? Math.trunc(configuredOpeningSkillCount)
      : null,
    openingSkillCountSource: Number.isFinite(configuredOpeningSkillCount)
      && configuredOpeningSkillCount >= 0
      ? 'explicit-scenario-proxy'
      : 'fail-closed-no-explicit-plan',
    trainingLifecycleProxy,
    note: configured.note
      || '以 50 次訓練選擇機會估算整場；不是完整育成官方機率'
  };
}

function acquisitionIntegrationOptions() {
  const race = primaryRace() || {};
  const strategy = activeRaceStrategy() || {};
  const proxy = acquisitionScenarioProxy();
  const openingSkillCount = Number(proxy.openingSkillCount);
  return {
    skillAcquisitionCore,
    acquisitionCore: skillAcquisitionCore,
    supportEventRoutes,
    acquisitionScenarioProxy: proxy,
    context: {
      ...(race.context || {}),
      ...(strategy.context || {}),
      running_style: 1,
      ...(Number.isFinite(openingSkillCount) ? { openingSkillCount } : {})
    },
    gameCatalog,
    characterCards: gameCatalog?.characterCards || []
  };
}

function deckOptimizationTargets() {
  const strategy = activeRaceStrategy() || currentRaceProfile || {};
  const categories = strategy.categories
    || strategy.skillPlan?.categories
    || currentRaceProfile?.skillPlan?.categories
    || [];
  return categories
    .filter(category => String(category.id || '').toLowerCase() !== 'stamina'
      && String(category.alternativeGroup || '').toLowerCase() !== 'recovery')
    .flatMap(category => (category.skills || []).map(skill => {
    const catalogSkill = skillById.get(Number(skill.id));
    const categoryWeight = normalizeDeckDomainWeight(category.weight, 100);
    const sortPriority = Number(skill.sortPriority ?? skill.priority);
    return {
      ...skill,
      id: Number(skill.id),
      factorId: Number(skill.factorId || skill.id),
      familyId: Number(catalogSkill?.familyId || skill.familyId || skill.id),
      familyIds: catalogSkill?.familyIds || skill.familyIds || [Number(skill.id)],
      name: skill.nameZhTw || catalogSkill?.nameZhTw || skill.name,
      // `race-strategy-core` may use score=Number.MAX_SAFE_INTEGER for a
      // profile override ordering sentinel. Keep ordering metadata separate;
      // only an explicit finite domain weight or category weight is scored.
      weight: normalizeDeckDomainWeight(skill.weight ?? category.weight, categoryWeight),
      categoryWeight,
      sortPriority: Number.isFinite(sortPriority) ? sortPriority : null,
      categoryId: category.id,
      source: skill.source || null,
      sourceEligibility: skill.sourceEligibility
        || (skill.sourceKind === 'parent-unique' || skill.deckEligible === false
          ? 'directParent'
          : 'deck')
    };
    })).filter(item => Number.isFinite(item.id));
}

function deckOptimizationKey() {
  const strategy = activeRaceStrategy();
  const target = selectedBattleUmaCard();
  const template = expectedBattleDeckTemplate();
  const acquisition = acquisitionDataIdentity();
  const targetStats = ['expectedSpeed', 'expectedStamina', 'expectedPower', 'expectedGuts', 'expectedWisdom']
    .map(id => Number(byId(id)?.value) || 0);
  return JSON.stringify({
    // The optimizer result is invalid when its executable model or any of the
    // source manifests changes, even if the visible race/target inputs match.
    optimizerIdentity: currentOptimizerIdentityKey,
    race: racePersistKey(primaryRace()),
    context: strategy?.context || {},
    target: target?.id || null,
    targetCharacter: target?.characterId || null,
    scenarioId: activeBattleScenario()?.id || null,
    scenarioMechanicsPolicyId: activeScenarioMechanicsPolicy()?.id || null,
    scenarioRequiredSupportIds: scenarioRequiredSupportIds(),
    targets: deckOptimizationTargets().map(item => [item.id, item.weight, item.sourceEligibility]),
    types: template,
    stats: targetStats,
    packageModel: supportCardLevelFixtures?.schemaVersion || 0,
    acquisitionModelVersion: acquisition.modelVersion,
    eventRouteDataVersion: acquisition.eventRouteDataVersion,
    eventRouteDataHash: acquisition.eventRouteDataHash,
    supportProfileVersion: acquisition.supportProfileVersion,
    acquisitionScenarioProxy: acquisitionScenarioProxy()
    // eventMode is intentionally absent: the deck optimizer contract does not
    // consume it; it currently affects app-side factor/strategy presentation.
    // selectedFamilyAnalysis is also intentionally absent: its current
    // breeder contract has no verified/planned factor markers, so treating it
    // as optimizer input would claim coverage the optimizer cannot verify.
  });
}

function activeDeckOptimization() {
  if (!deckOptimizerCore || !selectedBattleUmaCard()) return null;
  const key = deckOptimizationKey();
  if (key === cachedDeckOptimizationKey && cachedDeckOptimization) return cachedDeckOptimization;
  const strategy = activeRaceStrategy() || {};
  const staminaModel = activeStaminaModel();
  const standardTier = (staminaModel?.tiers || []).find(tier => tier.id === 'standard')
    || (staminaModel?.tiers || [])[0];
  const template = expectedBattleDeckTemplate();
  cachedDeckOptimizationKey = key;
  cachedDeckOptimization = deckOptimizerCore.optimizeDeckPackages({
    race: primaryRace(),
    courseProfile: currentRaceProfile,
    battleUma: selectedBattleUmaCard(),
    inventory,
    plannerRules,
    supportCatalog: gameCatalog?.supports || [],
    supportProfiles: supportCardProfiles,
    curatedFixtures: supportCardLevelFixtures,
    skills: gameCatalog?.skills || [],
    targets: deckOptimizationTargets(),
    typeTemplate: template,
    targetTypes: template.requiredTypes,
    desiredTypeTemplate: template,
    typeTemplateMode: 'alternatives',
    competitionMode: true,
    scenario: activeBattleScenario(),
    statUtilityPolicy: activeScenarioMechanicsPolicy()?.statUtilityPolicy,
    context: { ...(strategy.context || {}), running_style: 1 },
    ...acquisitionIntegrationOptions(),
    expectedStats: {
      speed: Number(byId('expectedSpeed')?.value) || 0,
      stamina: Number(byId('expectedStamina')?.value) || 0,
      power: Number(byId('expectedPower')?.value) || 0,
      guts: Number(byId('expectedGuts')?.value) || 0,
      wisdom: Number(byId('expectedWisdom')?.value) || 0
    },
    staminaRecoveryDeficit: {
      requiredGold: Number(standardTier?.goldRecovery) || 0,
      quality: staminaModel?.recoveryQuality || [],
      preCoveredSkillIds: battleUmaCertainSkillIds()
    },
    battleUmaCertainSkillIds: battleUmaCertainSkillIds(),
    server: 'zh_tw'
  });
  cachedDeckOptimization = {
    ...cachedDeckOptimization,
    optimizerIdentity: currentOptimizerIdentity,
    optimizerIdentityKey: currentOptimizerIdentityKey
  };
  return cachedDeckOptimization;
}

function peekActiveDeckOptimization() {
  if (!selectedBattleUmaCard() || !cachedDeckOptimization) return null;
  return cachedDeckOptimizationKey === deckOptimizationKey()
    ? cachedDeckOptimization
    : null;
}

function packageDeckIds(packageValue) {
  return [
    ...(packageValue?.ownedCards || []).map(card => Number(card.id)),
    Number(packageValue?.borrowedCard?.id)
  ].map(id => Number.isFinite(id) ? id : null);
}

function packageMatchesCurrentDeck(packageValue) {
  const wanted = packageDeckIds(packageValue);
  const current = state.battleDeckCardIds.slice(0, 6).map(Number);
  return wanted.length === 6
    && wanted.every((id, index) => Number(id) === Number(current[index]));
}

function currentDeckPackage(result = peekActiveDeckOptimization()) {
  if (!result) return null;
  if (state.deckPackageId && state.deckPackageId !== 'custom' && state.deckPackageId !== 'legacy') {
    const selected = result.packages.find(item => item.id === state.deckPackageId);
    if (selected) return selected;
  }
  return result.packages.find(packageMatchesCurrentDeck) || null;
}

function deckPackageSelectionComplete() {
  const validation = battleDeckValidation();
  if (!selectedBattleUmaCard() || !validation.valid || !state.battleOwnedCardsConfirmed) return false;
  // A manually confirmed or migrated exact six-card deck is still a usable
  // user loadout. Optimizer identity controls the theoretical comparison, not
  // whether a valid saved loadout may continue through the planner.
  if (state.deckPackageId === 'legacy' || state.deckPackageId === 'custom') return true;
  // Named theoretical packages must still match the current optimizer/source
  // identity before they can be treated as the current recommendation.
  if (optimizerIdentityStale) return false;
  const result = peekActiveDeckOptimization();
  if (!result) return false;
  const selected = currentDeckPackage(result);
  if (selected) {
    if (!state.deckPackageId) {
      state.deckPackageId = selected.id;
      state.deckPackageModelVersion = Number(result.modelVersion) || 1;
    }
    return true;
  }
  // A previous six-ID save may not match the current optimizer catalog. Keep
  // the old loadout usable and mark it as a migrated legacy/custom package;
  // it is still validated by the ordinary six-card hard rules above.
  if (!state.deckPackageId) {
    state.deckPackageId = 'legacy';
    state.deckPackageModelVersion = 0;
  }
  return true;
}

function applyDeckPackage(packageValue, options = {}) {
  if (!packageValue || !packageValue.valid) return false;
  const ids = packageDeckIds(packageValue);
  if (ids.length !== 6 || ids.some(id => !Number.isFinite(id))) return false;
  const packageChanged = String(state.deckPackageId || '') !== String(packageValue.id);
  const confirmationPackageChanged =
    String(state.parentSelectionPackageId || '') !== String(packageValue.id);
  // Re-applying the already-confirmed package must not erase Step 5 choices.
  // The package card is also rendered disabled for this state, but keep the
  // function idempotent because browser/storage callers can still invoke it.
  if (!packageChanged && state.battleOwnedCardsConfirmed && !optimizerIdentityStale) return true;
  if (packageChanged || confirmationPackageChanged) {
    state.parentSelectionPackageId = null;
  }
  state.battleDeckCardIds = ids;
  state.battleDeckBorrowedIndex = 5;
  state.deckPackageId = packageValue.id;
  state.deckPackageModelVersion = Number(packageValue.modelVersion) || 1;
  state.battleOwnedCardsConfirmed = true;
  if (packageChanged || confirmationPackageChanged) {
    state.selectedAccelerationSkillIds = [];
    state.residualFactorDecisionConfirmed = false;
  }
  if (!options.silent) acknowledgeOptimizerIdentity();
  if (!options.silent) {
    renderGuidedAccelerationFlow();
    renderBattleDeckEditor();
    renderGuidedParentStage();
    renderBattleCoverageSummary();
    renderCurrentRaceProfile();
    renderSkillPlan();
    renderGuidedProgress();
    scheduleSave();
    const announcement = options.statusMessage
      || `已套用 ${packageValue.modeLabel || '競技主推薦'}；六卡方案已更新。`;
    const restoreFocus = () => {
      const status = byId('guidedDeckPackageStatus');
      if (status) status.textContent = announcement;
      const packageId = String(options.focusPackageId || packageValue.id);
      const button = [...document.querySelectorAll('[data-apply-deck-package]')]
        .find(item => String(item.dataset.applyDeckPackage) === packageId && !item.disabled);
      const visible = node => Boolean(node && !node.closest('[hidden]'));
      const nextStageHeading = document.querySelector(
        '.guided-stage.is-current.is-expanded .guided-stage-heading h3'
      );
      if (visible(button)) {
        button.focus();
      } else if (visible(status)) {
        status.focus();
      } else if (nextStageHeading) {
        nextStageHeading.tabIndex = -1;
        nextStageHeading.focus();
      }
    };
    // A programmatic click can blur a button after its handler disables it;
    // restore focus in the next task, after that default click processing.
    setTimeout(restoreFocus, 0);
  }
  return true;
}

function ensureDeckPackageSelection() {
  const result = activeDeckOptimization();
  if (!result?.packages?.length) return null;
  const selected = currentDeckPackage(result);
  if (selected && state.battleOwnedCardsConfirmed) {
    if (!state.deckPackageId) {
      state.deckPackageId = selected.id;
      state.deckPackageModelVersion = Number(result.modelVersion) || 1;
    }
    return selected;
  }
  // Existing six-ID saves remain usable. New targets get a deterministic
  // preselection so the comparison UI is immediately populated, but the user
  // must still press the package button before the parent stage is final.
  const fallback = result.packages[0];
  const ids = packageDeckIds(fallback);
  if (state.deckPackageId !== fallback.id) state.parentSelectionPackageId = null;
  state.battleDeckCardIds = ids;
  state.battleDeckBorrowedIndex = 5;
  state.deckPackageId = fallback.id;
  state.deckPackageModelVersion = Number(result.modelVersion) || 1;
  state.battleOwnedCardsConfirmed = false;
  return fallback;
}

function repairGuidedOwnedCardsForTarget() {
  if (deckOptimizerCore && selectedBattleUmaCard()) {
    ensureDeckPackageSelection();
    return;
  }
  const beforeOwned = state.battleDeckCardIds.slice(0, 5).map(Number);
  const targetCharacterId = Number(selectedBattleUmaCard()?.characterId);
  const candidates = plannerCore.supportPool(inventory, plannerRules, gameCatalog)
    .filter(card => !Number.isFinite(targetCharacterId) || Number(card.characterId) !== targetCharacterId);
  const snapshot = activePlanningSnapshot({ ignoreDeck: true });
  const selectedFamilies = new Set(
    selectedAccelerationCandidates().map(candidate => Number(candidate.familyId))
  );
  const weightedRows = selectedFamilies.size
    ? (snapshot?.rows || []).filter(row => selectedFamilies.has(Number(row.familyId)))
    : snapshot?.topGaps || [];
  const recommendation = planningSnapshotCore?.recommendCards({
    snapshot,
    rows: weightedRows,
    catalog: gameCatalog,
    cards: candidates,
    targetCharacterId,
    targetTypes: expectedBattleDeckTypes().slice(0, 5),
    limit: 5
  });
  const selected = (recommendation?.cards || []).map(card => Number(card.id));
  state.battleDeckCardIds = [
    ...selected.slice(0, 5),
    null
  ];
  state.battleDeckBorrowedIndex = 5;
  if (beforeOwned.join(',') !== state.battleDeckCardIds.slice(0, 5).map(Number).join(',')) {
    state.battleOwnedCardsConfirmed = false;
  }
}

function selectedInheritanceMode() {
  const modes = inheritanceModes();
  return modes.find(mode => mode.id === state.inheritanceMode) || modes[0];
}

function battleDeckPresetIds() {
  const selected = (state?.battleDeckCardIds || []).map(Number).filter(Number.isFinite);
  if (selected.length) return selected;
  if (!hasActiveProfileStrategy()) return [...genericBattleDeckIds];
  const configured = jpStrategy?.battleDeckCoverageAssumption?.supportIds
    || jpStrategy?.battleDeckAssumption?.supportIds
    || jpStrategy?.battleDeckPreset?.supportIds
    || [];
  return configured
    .map(Number)
    .filter(Number.isFinite);
}

function setCoverageEntry(map, id, entry) {
  const key = Number(id);
  if (!Number.isFinite(key)) return;
  const current = map.get(key);
  if (!current || entry.multiplier < current.multiplier) map.set(key, entry);
}

function setCoverageFamilyEntry(map, id, entry) {
  const familyIds = guidedPlannerCore?.familyIdsForSkill(id, gameCatalog) || [Number(id)];
  familyIds.forEach(familyId => setCoverageEntry(map, familyId, entry));
}

function battleSkillCoverage() {
  const coverage = new Map();
  // Step 5/planning-snapshot is the single coverage semantic.  Do not
  // re-create raw event/hint multipliers here: that used to make the factor
  // planner disagree with both deck optimization and the visible snapshot.
  const summary = buildStep5CoverageSummary();
  for (const target of summary?.targets || []) {
    const coverageProbability = Number(target.coverageProbability);
    const multiplier = Number.isFinite(Number(target.gapMultiplier))
      ? Number(target.gapMultiplier)
      : Number.isFinite(coverageProbability)
        ? 1 - coverageProbability
        : 1;
    const routes = target.coverageRoutes || [];
    const labels = [...new Set(routes.map(route => route.label).filter(Boolean))];
    const sourceKinds = [...new Set(routes.flatMap(route =>
      route.sourceKinds || (route.sourceKind ? [route.sourceKind] : [])
    ))];
    const bonusOnly = routes.some(route => route.bonusOnly === true)
      && routes.every(route => route.bonusOnly === true || Number(route.probability) <= 0);
    const entry = {
      multiplier: Math.max(0, Math.min(1, multiplier)),
      state: bonusOnly ? 'bonus-only' : target.coverageState,
      label: labels.join('、') || (bonusOnly ? '隨機事件（額外、不計推薦）' : '尚未覆蓋'),
      sourceKinds,
      bonusOnly,
      acquisition: target.acquisition || target.acquisitionBreakdown || null
    };
    const familyIds = target.familyIds || [target.familyId];
    if (familyIds.some(id => Number.isFinite(Number(id)))) {
      familyIds.forEach(id => setCoverageEntry(coverage, id, entry));
    } else if (Number.isFinite(Number(target.requiredSkillId))) {
      setCoverageFamilyEntry(coverage, target.requiredSkillId, entry);
    }
  }
  const accelerationSnapshot = activePlanningSnapshot();
  for (const row of accelerationSnapshot?.rows || []) {
    const entry = {
      multiplier: Number(row.gapMultiplier),
      state: row.coverageState,
      label: row.coverageRoutes.map(route => route.label).join('、') || '尚未覆蓋',
      sourceKinds: [...new Set((row.coverageRoutes || []).flatMap(route =>
        route.sourceKinds || (route.sourceKind ? [route.sourceKind] : [])
      ))],
      acquisition: row.acquisition || row.acquisitionBreakdown || null
    };
    (row.familyIds || [row.familyId]).forEach(id =>
      setCoverageEntry(coverage, id, entry)
    );
  }
  return coverage;
}

function eventModeMultiplier(meta) {
  const values = meta?.eventMultipliers || meta?.eventModeMultipliers;
  const value = Number(values?.[state.eventMode]);
  return Number.isFinite(value) && value >= 0 ? value : 1;
}

function factorBaseWeight(category, meta) {
  const explicit = Number(meta?.weight);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const categoryWeight = Number(category?.weight);
  return Number.isFinite(categoryWeight) && categoryWeight > 0 ? categoryWeight : 100;
}

function factorEffectiveScore(category, meta, coverage = battleSkillCoverage()) {
  const coverageMultiplier = coverage.get(Number(meta.id))?.multiplier ?? 1;
  return Math.round(
    factorBaseWeight(category, meta)
    * coverageMultiplier
    * eventModeMultiplier(meta)
  );
}

function supportRouteLabel(routes) {
  const labels = [];
  if (routes?.includes('hint')) labels.push('提示');
  if (routes?.includes('event')) labels.push('事件');
  return labels.join('／') || '取得來源';
}

function characterRouteLabel(routes) {
  return routes?.includes('built-in') ? '自帶／覺醒' : '育成事件';
}

function supportTargetCoverage(card) {
  const activeTargetIds = new Set([
    ...activeFactorPlan().categories.flatMap(category =>
      (category.skills || []).flatMap(meta => [Number(meta.id), Number(meta.factorId)])
    ),
    ...(activeRaceStrategy()?.categories || []).flatMap(category =>
      (category.skills || []).flatMap(meta => [Number(meta.id), Number(meta.factorId)])
    )
  ].filter(Number.isFinite));
  return [...new Set([
    ...(card?.hintSkillIds || []),
    ...(card?.eventSkillIds || [])
  ].map(Number).filter(id => activeTargetIds.has(id)))];
}

function supportSourceScore(card) {
  const owned = inventorySupportById.get(Number(card.id));
  const type = normalizeSupportType(card.supportType);
  const deckWeight = state.battleDeckCardIds
    .map(id => supportCatalogById.get(Number(id)))
    .filter(Boolean)
    .map(item => normalizeSupportType(item.supportType))
    .filter(item => item === type).length;
  const rarity = { SSR: 3, SR: 2, R: 1 }[card.rarity] || 0;
  const hint = card.routes?.includes('hint') ? 1 : 0;
  return supportTargetCoverage(card).length * 100000
    + hint * 10000
    + deckWeight * 2000
    + rarity * 100
    + (owned?.limitBreak || 0) * 20
    + (owned?.level || 0);
}

function bestSupportSource(cards, predicate) {
  return (cards || [])
    .filter(predicate)
    .sort((a, b) => supportSourceScore(b) - supportSourceScore(a) || Number(a.id) - Number(b.id))[0] || null;
}

function supportSourceText(card) {
  if (!card) return '';
  const owned = inventorySupportById.get(Number(card.id));
  const type = supportTypeLabels[normalizeSupportType(card.supportType)] || normalizeSupportType(card.supportType);
  const level = owned ? `・Lv${owned.level}・${owned.limitBreak}突` : '';
  const labels = localizedSupportLabels(card);
  return `${card.rarity} ${labels.name}（${type}${level}・${supportRouteLabel(card.routes)}）`;
}

function bestOwnedTraineeSource(characterCards) {
  return (characterCards || [])
    .filter(card => inventoryTraineeByOutfitId.has(Number(card.id)))
    .sort((a, b) =>
      Number(b.routes?.includes('built-in')) - Number(a.routes?.includes('built-in'))
      || (inventoryTraineeByOutfitId.get(Number(b.id))?.stars || 0)
        - (inventoryTraineeByOutfitId.get(Number(a.id))?.stars || 0)
      || Number(a.id) - Number(b.id)
    )[0] || null;
}

function traineeSourceText(card) {
  if (!card) return '';
  const owned = inventoryTraineeByOutfitId.get(Number(card.id));
  return `${card.nameZhTw || card.name} ${card.titleZhTw || ''}（${owned?.stars || '?'}★・${characterRouteLabel(card.routes)}）`;
}

function skillSourceRows(resolved) {
  const assumedRarities = plannerRules?.ownership?.assumedOwnedRarities || [];
  const explicit = bestSupportSource(resolved?.supports, card =>
    inventorySupportById.has(Number(card.id)));
  const assumed = bestSupportSource(resolved?.supports, card =>
    !inventorySupportById.has(Number(card.id)) && assumedRarities.includes(card.rarity));
  const borrow = bestSupportSource(resolved?.supports, card =>
    !inventorySupportById.has(Number(card.id)) && !assumedRarities.includes(card.rarity));
  const trainee = bestOwnedTraineeSource(resolved?.characterCards);
  const rows = [];
  if (explicit) rows.push({ kind: 'owned', label: '自有卡', text: supportSourceText(explicit) });
  if (assumed) rows.push({ kind: 'assumed', label: '預設持有', text: supportSourceText(assumed) });
  if (trainee) rows.push({ kind: 'trainee', label: '自有角色', text: traineeSourceText(trainee) });
  if (borrow) rows.push({ kind: 'borrow', label: '借卡候選', text: supportSourceText(borrow) });
  return {
    rows,
    accessible: Boolean(explicit || assumed || trainee),
    explicit,
    assumed,
    borrow,
    trainee
  };
}

function bestFactorSourceText(factorId) {
  if (!factorId) return '';
  const factorResolved = skillCore?.resolveSkillSources(factorId, gameCatalog, inventory, plannerRules);
  if (!factorResolved) return '';
  const sources = skillSourceRows(factorResolved);
  if (sources.explicit) return supportSourceText(sources.explicit);
  if (sources.assumed) return supportSourceText(sources.assumed);
  if (sources.trainee) return traineeSourceText(sources.trainee);
  if (sources.borrow) return supportSourceText(sources.borrow);
  return '';
}

function activeStaminaModel() {
  const strategy = activeRaceStrategy();
  if (hasActiveProfileStrategy(strategy)) {
    return strategy.staminaModel
      || jpStrategy?.staminaModel
      || currentRaceProfile?.skillPlan?.staminaModel
      || { tiers: [], referenceGuts: 0 };
  }
  return {
    id: 'generic-full-course-simulation',
    tiers: [],
    referenceGuts: 0
  };
}

function updateStaminaEstimate() {
  const output = byId('staminaEstimate');
  if (!staminaSimCore || !output) return;
  const strategy = activeRaceStrategy();
  const model = activeStaminaModel();
  const race = primaryRace();
  const context = strategy?.context || race?.context || {};
  const randomGroundCondition = context.ground_condition == null
    && race?.randomConditions?.groundCondition === 'Random';
  const stamina = Number(byId('expectedStamina')?.value) || 0;
  const guts = Number(byId('expectedGuts')?.value) || 0;
  const goldRecoveryCount = Math.max(0, Number(byId('reliableGoldRecoveryCount')?.value) || 0);
  const inheritedRecoveryCount =
    Math.max(0, Number(byId('inheritedRecoveryCount')?.value) || 0);
  const tiers = model?.tiers || jpStrategy?.staminaTiers || [];
  const selectedTierId = byId('staminaReference')?.value || 'standard';
  const tier = tiers.find(item => item.id === selectedTierId)
    || tiers.find(item => item.id === 'standard')
    || tiers[0];
  const greenBonus =
    (byId('hasKyotoGreen')?.checked ? 40 : 0)
    + (byId('hasBasisGreen')?.checked ? 40 : 0);
  const battleCard = selectedBattleUmaCard();
  const surfaceAptitudeIndex = Number(context.ground_type || 1) - 1;
  const marginNode = byId('staminaMargin');
  const breakdownNode = byId('staminaBreakdown');
  const gutsNode = byId('gutsWarning');
  const statusNode = output.querySelector(':scope > span');
  const goldPositions = [0.34, 0.46, 0.58, 0.7];
  const inheritedPositions = [0.62, 0.74];
  const recoveries = [
    ...Array.from({ length: goldRecoveryCount }, (_, index) => ({
      label: `可靠金回 ${index + 1}`,
      percent: 0.055,
      positionRatio: goldPositions[index] || Math.min(0.8, 0.34 + index * 0.12)
    })),
    ...Array.from({ length: inheritedRecoveryCount }, (_, index) => ({
      label: `繼承回復 ${index + 1}`,
      percent: 0.035,
      positionRatio: inheritedPositions[index] || Math.min(0.85, 0.62 + index * 0.12)
    }))
  ];
  const input = {
    distance: Number(context.course_distance || race?.distanceMeters || race?.course?.length || 2000),
    course: race?.course || findCourse(race?.courseId),
    style: 'runner',
    speed: Number(byId('expectedSpeed')?.value) || 0,
    stamina,
    power: Number(byId('expectedPower')?.value) || 0,
    guts,
    wisdom: Number(byId('expectedWisdom')?.value) || 0,
    mood: Number(byId('simMood')?.value) || 0,
    distanceAptitude: byId('simDistanceAptitude')?.value || 'A',
    surfaceAptitude: battleCard?.aptitude?.[surfaceAptitudeIndex] || 'A',
    staminaGreenBonus: greenBonus,
    surface: Number(context.ground_type) === 2 ? 'Dirt' : 'Turf',
    groundCondition: {
      1: 'Good',
      2: 'SlightlyHeavy',
      3: 'Heavy',
      4: 'Bad'
    }[Number(context.ground_condition)] || 'Good',
    kakariSeconds: Number(byId('simKakariSeconds')?.value) || 0,
    spotStruggleSeconds: Number(byId('simSpotSeconds')?.value) || 0,
    downhillShare: (Number(byId('simDownhillPercent')?.value) || 0) / 100,
    staminaDebuffPercent: (Number(byId('simDebuffPercent')?.value) || 0) / 100,
    speedSkillBonus: Number(byId('simSpeedBonus')?.value) || 0,
    recoveries
  };
  const scenarios = staminaSimCore.simulateScenarios(input);
  const result = scenarios.baseline;
  const isEnough = result.remainingHp >= 0;
  output.dataset.state = isEnough ? 'ok' : 'short';
  if (statusNode) statusNode.textContent = isEnough ? '分段模擬可跑完全程' : '分段模擬將於終點前耗盡';
  if (marginNode) {
    marginNode.textContent = isEnough
      ? `剩餘 ${Math.round(result.remainingHp)} HP（${result.remainingPercent}%）`
      : `約在 ${Math.round(result.exhaustionAt || 0)}m 耗盡，缺 ${Math.abs(Math.round(result.remainingHp))} HP`;
  }
  if (breakdownNode) {
    const tierText = tier
      ? `；攻略門檻 ${tier.label}：耐 ${tier.stamina}／金回 ${tier.goldRecovery}`
      : '';
    breakdownNode.textContent =
      `最大 HP ${Math.round(result.maxHp)}；總消耗 ${Math.round(result.totalConsumed)}；`
      + `有效回復 ${Math.round(result.totalRecovered)}；直接削減 ${Math.round(result.directDrain)}${tierText}`
      + `${randomGroundCondition ? '；本場場地狀態隨機，本次以良場作為中性模擬基準，非固定賽事條件' : ''}。`;
  }
  if (gutsNode) {
    const reference = Number(model?.referenceGuts || 0);
    gutsNode.textContent = reference && guts < reference
      ? `根性 ${guts} 低於攻略參考 ${reference}；終盤 HP 消耗係數會更高。`
      : '此處已使用公開 HP／速度／根性公式做賽道分段計算；對手位置、技能隨機點與加速過程仍以近似處理。';
  }

  const scenarioLabels = [
    ['baseline', '目前設定'],
    ['kakari', '焦躁 12 秒'],
    ['contested', '搶位競爭 8 秒'],
    ['debuffed', '耐力削減 3%']
  ];
  byId('staminaScenarioCards').innerHTML = scenarioLabels.map(([key, label]) => {
    const scenario = scenarios[key];
    return `<article class="scenario-card" data-risk="${scenario.risk}">
      <span>${label}</span>
      <strong>${scenario.remainingHp >= 0 ? '+' : ''}${Math.round(scenario.remainingHp)} HP</strong>
      <small>${scenario.fullSpurt ? '可完成最大衝刺' : `約 ${Math.round(scenario.exhaustionAt || 0)}m 耗盡`}</small>
    </article>`;
  }).join('');
  byId('staminaStageRows').innerHTML = result.stages.map(stage => {
    const recovery = stage.recoveries.reduce((sum, item) => sum + Number(item.applied || 0), 0);
    return `<tr>
      <td>${stage.label}</td>
      <td>${Math.round(stage.distance)}m</td>
      <td>${stage.averageSpeed.toFixed(2)}m/s<small>目標 ${stage.speed.toFixed(2)}${stage.accelerationSeconds ? `・加速 ${stage.accelerationSeconds.toFixed(1)}s` : ''}</small></td>
      <td>${stage.seconds.toFixed(1)}s</td>
      <td>-${Math.round(stage.consumption)}</td>
      <td>${recovery ? `+${Math.round(recovery)}` : '—'}</td>
      <td>${Math.round(stage.remainingHp)}</td>
    </tr>`;
  }).join('');
  byId('staminaModelNote').innerHTML =
    `${result.exactness} 精密場上互動可再用 `
    + `<a href="https://alpha123.github.io/uma-tools/umalator-global/stamina/" target="_blank" rel="noreferrer">Umalator</a> 交叉驗證。`
    + `${randomGroundCondition ? ' 場地狀態為隨機；良場僅是這次模擬的中性基準。' : ''}`;
  renderFactorDecision();
  scheduleSave();
}

function bindStaminaEstimator() {
  const strategy = activeRaceStrategy();
  const model = activeStaminaModel();
  const tiers = model?.tiers || jpStrategy?.staminaTiers || [];
  const reference = byId('staminaReference');
  const currentReference = reference?.value;
  if (reference) {
    reference.innerHTML = tiers.length ? tiers.map(tier =>
      `<option value="${tier.id}" ${tier.id === 'standard' ? 'selected' : ''}>`
      + `${tier.label}｜耐 ${tier.stamina}＋金回 ${tier.goldRecovery}`
      + `${tier.inheritedRecovery35 ? `＋3.5% 回復 ${tier.inheritedRecovery35}` : ''}`
      + '</option>'
    ).join('') : '<option value="simulation">依分段模擬判定</option>';
  }
  const context = strategy?.context || {};
  const trackLabel = trackNames[Number(context.track_id)]
    || primaryRace()?.name
    || '目前賽場';
  if (byId('trackGreenLabel')) {
    byId('trackGreenLabel').textContent = `${trackLabel}賽場○（耐力＋40）`;
  }
  if (byId('basisGreenLabel')) {
    byId('basisGreenLabel').textContent =
      `${Number(context.is_basis_distance) === 1 ? '根幹距離○' : '非根幹距離○'}（耐力＋40）`;
  }
  const saved = staminaFormHydrated ? {} : (state.stamina || {});
  const standardTier = tiers.find(tier => tier.id === 'standard') || tiers[0] || {};
  const restoreValues = {
    expectedSpeed: saved.speed,
    expectedStamina: saved.stamina ?? (!staminaFormHydrated ? standardTier.stamina : undefined),
    expectedPower: saved.power,
    expectedGuts: saved.guts,
    expectedWisdom: saved.wisdom,
    simMood: saved.mood,
    simDistanceAptitude: saved.distanceAptitude,
    reliableGoldRecoveryCount: saved.goldRecoveryCount
      ?? (!staminaFormHydrated ? standardTier.goldRecovery : undefined),
    inheritedRecoveryCount: saved.inheritedRecoveryCount
      ?? (!staminaFormHydrated ? standardTier.inheritedRecovery35 : undefined),
    simKakariSeconds: saved.kakariSeconds,
    simSpotSeconds: saved.spotStruggleSeconds,
    simDownhillPercent: saved.downhillPercent,
    simDebuffPercent: saved.debuffPercent,
    simSpeedBonus: saved.speedBonus
  };
  Object.entries(restoreValues).forEach(([id, value]) => {
    if (value !== undefined && value !== null && byId(id)) byId(id).value = value;
  });
  if (reference) {
    const wanted = staminaFormHydrated ? currentReference : saved.reference;
    reference.value = [...reference.options].some(option => option.value === wanted)
      ? wanted
      : (tiers.some(tier => tier.id === 'standard') ? 'standard' : reference.options[0]?.value || '');
  }
  if (saved.hasKyotoGreen !== undefined) byId('hasKyotoGreen').checked = Boolean(saved.hasKyotoGreen);
  if (saved.hasBasisGreen !== undefined) byId('hasBasisGreen').checked = Boolean(saved.hasBasisGreen);
  [
    'expectedSpeed',
    'expectedStamina',
    'expectedPower',
    'expectedGuts',
    'expectedWisdom',
    'simMood',
    'simDistanceAptitude',
    'staminaReference',
    'reliableGoldRecoveryCount',
    'inheritedRecoveryCount',
    'hasKyotoGreen',
    'hasBasisGreen',
    'simKakariSeconds',
    'simSpotSeconds',
    'simDownhillPercent',
    'simDebuffPercent',
    'simSpeedBonus'
  ].forEach(id => {
    const input = byId(id);
    if (!input) return;
    input.oninput = updateStaminaEstimate;
    input.onchange = updateStaminaEstimate;
  });
  staminaFormHydrated = true;
  updateStaminaEstimate();
}

let cachedRaceStrategy = null;
let cachedRaceStrategyKey = '';
let cachedCourseImpact = null;
let cachedCourseImpactKey = '';
let cachedGoalContractLineagePlan = null;
let cachedGoalContractLineageKey = '';

function primaryRace() {
  return selectedRaces().find(race => racePersistKey(race) === state.primaryRaceKey)
    || selectedRaces()[0]
    || races[currentRaceIndex]
    || races[0]
    || null;
}

function activeRaceStrategy() {
  if (!raceStrategyCore || !gameCatalog) return null;
  const race = primaryRace();
  const key = JSON.stringify({
    id: racePersistKey(race),
    context: race?.context || {},
    courseId: race?.courseId,
    scenarioId: state.scenarioId
  });
  if (key === cachedRaceStrategyKey && cachedRaceStrategy) return cachedRaceStrategy;
  cachedRaceStrategyKey = key;
  const built = raceStrategyCore.buildRaceStrategy(gameCatalog, race || {}, {
    profileOverride: currentRaceProfile
  });
  const scenario = activeBattleScenario();
  cachedRaceStrategy = {
    ...built,
    scenario,
    battleDeck: {
      ...(built?.battleDeck || {}),
      scenario
    }
  };
  return cachedRaceStrategy;
}

function goalContractTargetFromRace(race, strategy, overrides = {}) {
  const context = strategy?.context || race?.context || {};
  const groundType = Number(context.ground_type);
  const distanceType = Number(context.distance_type);
  const eventMode = overrides.eventMode || race?.eventMode || state.eventMode || null;
  return {
    server: overrides.server || race?.server || 'zh_tw',
    eventMode,
    courseId: Number(race?.courseId ?? strategy?.race?.courseId) || null,
    surface: ({ 1: 'turf', 2: 'dirt' })[groundType] || null,
    distanceType: ({ 1: 'short', 2: 'mile', 3: 'medium', 4: 'long' })[distanceType] || null,
    distanceM: Number(context.course_distance ?? race?.distanceMeters ?? race?.distance) || null,
    runningStyle: 'runner',
    objective: overrides.objective
      || (eventMode === 'cm' ? 'cm_winner_line' : eventMode === 'loh' ? 'loh_score_line' : 'race_fit'),
    label: race?.name || race?.nameZhTw || strategy?.race?.name || '目前賽事',
    evidenceStatus: Number(race?.courseId ?? strategy?.race?.courseId)
      ? 'CATALOG_OR_USER_SELECTED'
      : 'NEEDS_EVIDENCE'
  };
}

function activeGoalContractTarget() {
  return goalContractTargetFromRace(primaryRace(), activeRaceStrategy());
}

function activeGoalContractProfileTarget() {
  const strategy = activeRaceStrategy();
  if (!strategy?.profileOverride?.applied || !currentRaceProfile) return null;
  return goalContractTargetFromRace(currentRaceProfile, {
    ...strategy,
    context: currentRaceProfile.context || strategy.context,
    race: { ...(strategy.race || {}), courseId: currentRaceProfile.courseId }
  }, {
    server: currentRaceProfile.server || 'zh_tw',
    eventMode: currentRaceProfile.eventMode,
    objective: currentRaceProfile.eventMode === 'cm' ? 'cm_winner_line' : 'loh_score_line'
  });
}

function hasActiveProfileStrategy(strategy = activeRaceStrategy()) {
  if (!strategy?.profileOverride?.applied || !currentRaceProfile || !jpStrategy) return false;
  const race = strategy.race || primaryRace() || {};
  const raceCatalogId = Number(
    race.catalogRaceId ?? race.catalogId ?? race.gameToraRaceId ?? race.id
  );
  const raceCourseId = Number(race.courseId ?? primaryRace()?.courseId);
  const profileCatalogId = Number(currentRaceProfile.catalogRaceId);
  const profileCourseId = Number(currentRaceProfile.courseId);
  const strategyCatalogId = Number(jpStrategy.catalogRaceId ?? profileCatalogId);
  const strategyCourseId = Number(jpStrategy.courseId ?? profileCourseId);
  return Number.isFinite(raceCatalogId)
    && Number.isFinite(raceCourseId)
    && raceCatalogId === profileCatalogId
    && raceCatalogId === strategyCatalogId
    && raceCourseId === profileCourseId
    && raceCourseId === strategyCourseId;
}

function activeCourseAccelerationTable() {
  if (!skillImpactCore || !gameCatalog) return null;
  const race = primaryRace();
  const strategy = activeRaceStrategy();
  const key = JSON.stringify({
    race: racePersistKey(race),
    courseId: race?.courseId,
    context: strategy?.context || race?.context || {},
    dataVersion: gameCatalog?.metadata?.asOf || gameCatalog?.metadata?.fetchedAt || ''
  });
  if (key === cachedCourseImpactKey && cachedCourseImpact) return cachedCourseImpact;
  cachedCourseImpactKey = key;
  cachedCourseImpact = skillImpactCore.buildCourseAccelerationTable({
    catalog: gameCatalog,
    race: {
      ...(race || {}),
      context: strategy?.context || race?.context || {},
      courseId: race?.courseId || strategy?.race?.courseId
    },
    snapshots: courseEffectSnapshots,
    runningStyle: 1,
    minimumBashin: 0.1
  });
  return cachedCourseImpact;
}

// Step 5 is deliberately driven by the confirmed six cards, rather than a
// recommendation or a partial five-card draft.  A catalog card is only an
// acquisition route once the user has actually confirmed the full package.
function resolveBattleCoverageCards(cards) {
  const strategy = activeRaceStrategy() || {};
  const rawCards = cards || [];
  return rawCards.map((card, index) => {
    const id = Number(card?.id);
    const borrowed = index === 5;
    const owned = inventorySupportById.get(id);
    const instance = {
      ...card,
      id,
      borrowed,
      borrowedAtMax: borrowed,
      level: borrowed ? Number.MAX_SAFE_INTEGER : Number(owned?.level) || 1,
      limitBreak: borrowed ? 4 : Math.max(0, Math.min(4, Number(owned?.limitBreak) || 0))
    };
    const resolved = deckOptimizerCore?.resolveProfile
      ? deckOptimizerCore.resolveProfile(
        instance,
        supportCardProfileById.get(id),
        { ...(strategy.context || {}), running_style: 1 },
        supportCardFixtureById.get(id),
        rawCards
      )
      : null;
    return {
      ...card,
      id,
      level: Number(resolved?.level ?? instance.level),
      limitBreak: Number(resolved?.limitBreak ?? instance.limitBreak),
      borrowed,
      borrowedAtMax: borrowed,
      resolvedProfile: resolved || card?.resolvedProfile || null,
      acquisition: {
        ...(card?.acquisition || {}),
        resolvedEffects: resolved?.effects || card?.acquisition?.resolvedEffects || null
      }
    };
  });
}

function confirmedBattleDeckCoverageCards() {
  if (optimizerIdentityStale
    || !state.applyBattleDeckCoverage
    || !state.battleOwnedCardsConfirmed) return [];
  const validation = battleDeckValidation();
  if (!validation.valid) return [];
  const cards = state.battleDeckCardIds
    .slice(0, 6)
    .map(id => supportCatalogById.get(Number(id)))
    .filter(Boolean);
  return cards.length === 6 ? resolveBattleCoverageCards(cards) : [];
}

function step5CoverageTargets() {
  if (typeof guidedPlannerCore?.buildCoverageTargets !== 'function') return [];
  const directParentCandidates = [state.main, state.sub]
    .filter(hasSelectedParentId)
    .map(Number)
    .map(id => ({
      id,
      coverageTargetSkillId: id,
      kind: 'direct-parent-unique',
      sourceKind: 'parent-unique',
      inheritedAvailable: true,
      label: localizedSkillName(id),
      // Direct-parent targets live in a separate denominator. The positive
      // weight only makes their own completion metric readable.
      weight: 1
    }));
  return guidedPlannerCore.buildCoverageTargets({
    accelerationCandidates: [
      ...selectedAccelerationCandidates(),
      ...directParentCandidates
    ],
    greenCandidates: recommendedRouteGreens(),
    defaultWeight: 1
  });
}

function buildStep5CoverageSummary() {
  if (typeof planningSnapshotCore?.buildCoverageSummary !== 'function') return null;
  const familyAnalysis = selectedFamilyAnalysis();
  return planningSnapshotCore.buildCoverageSummary({
    catalog: gameCatalog,
    targets: step5CoverageTargets(),
    certainSkillIds: battleUmaCertainSkillIds(),
    characterEventSkillIds: selectedBattleUmaCard()?.catalogEventSkillIds || [],
    // Invalid or unconfirmed card selections intentionally contribute no
    // routes. This keeps the Step 5 number tied to the actual six-card deck.
    deckCards: confirmedBattleDeckCoverageCards(),
    directParentSkillIds: [state.main, state.sub].filter(hasSelectedParentId).map(Number),
    existingFactors: familyAnalysis?.factorSummary?.whiteFactors || [],
    ...acquisitionIntegrationOptions(),
    supportProfiles: supportCardProfiles,
    curatedFixtures: supportCardLevelFixtures
  });
}

function deckComfortCanonicalSignature(packageValue) {
  if (typeof deckOptimizerCore?.canonicalDeckKey === 'function') {
    return deckOptimizerCore.canonicalDeckKey(packageValue);
  }
  if (typeof deckComfortCore?.canonicalDeckSignature === 'function') {
    return deckComfortCore.canonicalDeckSignature(packageValue);
  }
  return `owned:${(packageValue?.ownedCards || [])
    .map(card => Number(card?.id))
    .filter(Number.isFinite)
    .sort((left, right) => left - right)
    .join(',')}|borrow:${Number(packageValue?.borrowedCard?.id) || 0}@5`;
}

function deckComfortCoverageTargets() {
  // This comparison happens before parents are locked. Use the race-strategy
  // targets that a battle deck is actually allowed to acquire, and leave
  // direct-parent uniques to Step 4 so they cannot inflate every deck's gap.
  return deckOptimizationTargets()
    .filter(target => target.sourceEligibility !== 'directParent'
      && target.sourceEligibility !== 'factorOnly')
    .map((target, order) => ({
      ...target,
      id: Number(target.factorId || target.id),
      coverageTargetSkillId: Number(target.factorId || target.id),
      kind: 'factor',
      label: target.name || target.nameZhTw || localizedSkillName(target.factorId || target.id),
      order
    }))
    .filter(target => Number.isFinite(target.coverageTargetSkillId));
}

function buildDeckComfortCoverage(packageValue) {
  if (typeof planningSnapshotCore?.buildCoverageSummary !== 'function') return null;
  const targets = deckComfortCoverageTargets();
  const cards = [
    ...(packageValue?.ownedCards || []),
    packageValue?.borrowedCard
  ].filter(Boolean);
  if (!targets.length || cards.length !== 6) return null;
  return planningSnapshotCore.buildCoverageSummary({
    catalog: gameCatalog,
    targets,
    certainSkillIds: battleUmaCertainSkillIds(),
    characterEventSkillIds: selectedBattleUmaCard()?.catalogEventSkillIds || [],
    deckCards: resolveBattleCoverageCards(cards),
    // Comfort asks what this horse + six-card package can provide by itself.
    // Parents and existing factors are deliberately held at zero here; their
    // job is the residual shown by the comparison, not hidden input coverage.
    directParentSkillIds: [],
    existingFactors: [],
    ...acquisitionIntegrationOptions(),
    supportProfiles: supportCardProfiles,
    curatedFixtures: supportCardLevelFixtures
  });
}

function activeDeckComfortComparison(result = activeDeckOptimization()) {
  if (!result || typeof result !== 'object'
    || typeof deckComfortCore?.buildDeckComfortComparison !== 'function') return null;
  if (deckComfortComparisonCache.has(result)) return deckComfortComparisonCache.get(result);
  const coverageBySignature = new Map();
  (result.packages || []).forEach(packageValue => {
    const signature = deckComfortCanonicalSignature(packageValue);
    if (!coverageBySignature.has(signature)) {
      coverageBySignature.set(signature, buildDeckComfortCoverage(packageValue));
    }
  });
  const comparison = deckComfortCore.buildDeckComfortComparison(result.packages || [], {
    coverageBySignature,
    hardRecovery: false,
    topGapLimit: 5
  });
  deckComfortComparisonCache.set(result, comparison);
  return comparison;
}

function currentDeckComparisonPackage() {
  const ownedCards = state.battleDeckCardIds
    .slice(0, 5)
    .map(id => supportCatalogById.get(Number(id)))
    .filter(Boolean);
  const borrowedCard = supportCatalogById.get(Number(state.battleDeckCardIds[5])) || null;
  const validation = battleDeckValidation();
  return {
    id: 'current-custom-deck',
    mode: 'custom',
    modeLabel: '你的自配',
    valid: validation.valid && ownedCards.length === 5 && Boolean(borrowedCard),
    ownedCards,
    borrowedCard,
    deckCards: [...ownedCards, borrowedCard].filter(Boolean),
    validation
  };
}

function deckCoverageRowKey(row) {
  const value = Number(
    row?.coverageTargetSkillId
    ?? row?.requiredSkillId
    ?? row?.factorId
    ?? row?.id
    ?? row?.familyId
  );
  return Number.isFinite(value) ? value : null;
}

function supportCardComparisonName(card) {
  if (!card) return '未識別卡片';
  const labels = localizedSupportLabels(card);
  return [labels.name, labels.title].filter(Boolean).join('・')
    || card.nameZhTw
    || card.name
    || `卡片 ${Number(card.id) || '?'}`;
}

function buildTheoreticalVsCustomDeckDelta(theoreticalPackage) {
  const customPackage = currentDeckComparisonPackage();
  const theoreticalCards = [
    ...(theoreticalPackage?.ownedCards || []),
    theoreticalPackage?.borrowedCard
  ].filter(Boolean);
  const customCards = [...customPackage.ownedCards, customPackage.borrowedCard].filter(Boolean);
  const theoreticalIds = new Set(theoreticalCards.map(card => Number(card.id)).filter(Number.isFinite));
  const customIds = new Set(customCards.map(card => Number(card.id)).filter(Number.isFinite));
  const removedCards = theoreticalCards.filter(card => !customIds.has(Number(card.id)));
  const addedCards = customCards.filter(card => !theoreticalIds.has(Number(card.id)));
  const theoreticalCoverage = theoreticalPackage
    ? buildDeckComfortCoverage(theoreticalPackage)
    : null;
  const customCoverage = customPackage.valid
    ? buildDeckComfortCoverage(customPackage)
    : null;
  const rowMap = rows => new Map((rows || []).map(row => [deckCoverageRowKey(row), row])
    .filter(([key]) => Number.isFinite(key)));
  const theoreticalRows = rowMap(theoreticalCoverage?.targets);
  const customRows = rowMap(customCoverage?.targets);
  const allKeys = new Set([...theoreticalRows.keys(), ...customRows.keys()]);
  const coverageChanges = [...allKeys].map(key => {
    const theoretical = theoreticalRows.get(key) || {};
    const custom = customRows.get(key) || {};
    const theoreticalProbability = Number(theoretical.coverageProbability) || 0;
    const customProbability = Number(custom.coverageProbability) || 0;
    const label = theoretical.label
      || custom.label
      || localizedSkillName(key)
      || `技能 ${key}`;
    const weight = Number(theoretical.weight ?? custom.weight ?? 1) || 1;
    return {
      key,
      label,
      theoreticalProbability,
      customProbability,
      delta: customProbability - theoreticalProbability,
      impact: Math.abs(customProbability - theoreticalProbability) * weight
    };
  }).sort((left, right) => right.impact - left.impact || left.key - right.key);
  const finiteMetric = value => Number.isFinite(Number(value)) ? Number(value) : null;
  const theoreticalCoveragePercent = finiteMetric(theoreticalCoverage?.factorCoverage?.percentage);
  const customCoveragePercent = finiteMetric(customCoverage?.factorCoverage?.percentage);
  const theoreticalResidual = finiteMetric(theoreticalCoverage?.factorCoverage?.residualWeight);
  const customResidual = finiteMetric(customCoverage?.factorCoverage?.residualWeight);
  const theoreticalSignature = theoreticalPackage
    ? deckComfortCanonicalSignature(theoreticalPackage)
    : null;
  const customSignature = customPackage.valid
    ? deckComfortCanonicalSignature(customPackage)
    : null;
  return {
    customPackage,
    removedCards,
    addedCards,
    losses: coverageChanges.filter(row => row.delta < -1e-9).slice(0, 4),
    gains: coverageChanges.filter(row => row.delta > 1e-9).slice(0, 4),
    theoreticalCoveragePercent,
    customCoveragePercent,
    theoreticalResidual,
    customResidual,
    theoreticalSignature,
    customSignature,
    sameDeck: Boolean(theoreticalSignature && customSignature && theoreticalSignature === customSignature)
  };
}

function buildBattleDeckTrainingGuide() {
  const target = selectedBattleUmaCard();
  if (!target) {
    return {
      status: 'WAITING_FOR_UMA',
      statusLabel: '等待戰馬',
      summaryTitle: '先選戰馬',
      summaryText: '戰馬會改變可用支援卡、必要技能與面板目標，不能先套用通用養法。',
      actions: [],
      boundary: '尚未選擇戰馬，因此不建立育成順序。'
    };
  }

  const validation = battleDeckValidation();
  const cards = (validation.cards || []).filter(Boolean);
  if (!validation.valid || cards.length !== 6) {
    return {
      status: 'WAITING_FOR_DECK',
      statusLabel: '等待完整六卡',
      summaryTitle: '先把 5 張自有卡＋1 張借卡選完整',
      summaryText: (validation.problems || []).join('；') || '目前六卡尚未通過結構驗證。',
      actions: [{
        phase: '現在',
        title: '先修正配卡，再談養法',
        reason: '缺卡、重複角色或劇本必要卡不合法時，任何訓練建議都會建立在錯的六卡上。',
        evidence: '六卡硬門',
        confidence: 'KNOWN',
        tone: 'warning'
      }],
      boundary: '六卡尚未成立；不以理論方案或舊配卡代替你的實際選擇。'
    };
  }

  const statTypeOrder = ['Speed', 'Stamina', 'Power', 'Guts', 'Wisdom'];
  const displayTypeOrder = [...statTypeOrder, 'Friend', 'Group'];
  const cardsByType = new Map(displayTypeOrder.map(type => [type, []]));
  cards.forEach(card => {
    const type = normalizeSupportType(card?.supportType);
    if (!cardsByType.has(type)) cardsByType.set(type, []);
    cardsByType.get(type).push(card);
  });
  const typeRows = [...cardsByType.entries()]
    .filter(([, rows]) => rows.length)
    .sort((left, right) => right[1].length - left[1].length
      || displayTypeOrder.indexOf(left[0]) - displayTypeOrder.indexOf(right[0]));
  const compositionText = typeRows
    .map(([type, rows]) => `${supportTypeLabels[type] || type}×${rows.length}`)
    .join('・');
  const primaryStatType = typeRows.find(([type]) => statTypeOrder.includes(type))?.[0] || 'Speed';
  const primaryCards = cardsByType.get(primaryStatType) || [];
  const primaryNames = primaryCards.map(supportCardComparisonName).join('、');
  const statMeta = [
    ['Speed', '速度', 'expectedSpeed'],
    ['Stamina', '耐力', 'expectedStamina'],
    ['Power', '力量', 'expectedPower'],
    ['Guts', '根性', 'expectedGuts'],
    ['Wisdom', '智力', 'expectedWisdom']
  ];
  const targetStatText = statMeta.map(([, label, id]) => {
    const value = finiteOrNull(byId(id)?.value);
    return Number.isFinite(value) ? `${label} ${Math.round(value)}` : '';
  }).filter(Boolean).join('／');

  const customPackage = currentDeckComparisonPackage();
  const coverage = customPackage.valid ? buildDeckComfortCoverage(customPackage) : null;
  const coverageRows = coverage?.targets || [];
  const routeProbability = route => Number(route?.coverageProbability ?? route?.probability ?? 0);
  const formalRoutes = (row, type) => (row?.coverageRoutes || []).filter(route =>
    route?.type === type
    && route.bonusOnly !== true
    && routeProbability(route) > 0
    && cards.some(card => Number(card.id) === Number(route.cardId))
  );
  const namedRows = rows => [...new Set(rows.map(row => row.label || localizedSkillName(deckCoverageRowKey(row))))]
    .filter(Boolean)
    .slice(0, 4);
  const hintNames = namedRows(coverageRows.filter(row => formalRoutes(row, 'support-hint').length));
  const eventNames = namedRows(coverageRows.filter(row => formalRoutes(row, 'support-event').length));
  const gapNames = namedRows(coverageRows
    .filter(row => Number(row.residualWeight) > 1e-9)
    .sort((left, right) => Number(right.residualWeight) - Number(left.residualWeight)));
  const coveragePercent = Number.isFinite(Number(coverage?.factorCoverage?.percentage))
    ? Math.round(Number(coverage.factorCoverage.percentage))
    : null;

  const matchedPackage = currentDeckPackage();
  const recoveryGate = matchedPackage?.recoveryGate || null;
  const staminaModel = activeStaminaModel();
  const standardTier = (staminaModel?.tiers || []).find(tier => tier.id === 'standard')
    || (staminaModel?.tiers || [])[0]
    || {};
  const requiredGoldRecovery = Math.max(0, Number(standardTier.goldRecovery) || 0);
  const scenarioIds = scenarioRequiredSupportIds();
  const scenarioCards = cards.filter(card => scenarioIds.includes(Number(card.id)));

  const actions = [{
    phase: '前期',
    title: '條件式原則：同一格帶到多張尚未成熟的卡時，先追羈絆',
    reason: `目前六卡是 ${compositionText}。介面沒有當回合擺位與羈絆值，因此只能給條件式規則：若同一訓練能同時讓多張可進友情的卡成熟，才優先它；不能據此宣稱現在必須踩哪一格。`,
    evidence: '六卡卡型確定；當回合羈絆／擺位未知',
    confidence: 'CONDITIONAL',
    tone: 'priority'
  }, {
    phase: '中後期',
    title: `進局後再比較目前面板與終盤目標；差距相近時偏向 ${supportTypeLabels[primaryStatType] || primaryStatType}`,
    reason: `${primaryNames ? `${supportTypeLabels[primaryStatType] || primaryStatType}主力是 ${primaryNames}。` : ''}目前只知道終盤計畫值 ${targetStatText || '尚未完整設定'}，不知道局內當前面板；請在遊戲內用「終盤目標－目前面板」比較缺口，差距相近時才用同色多卡／友情集中度決勝。`,
    evidence: '實際六卡＋終盤計畫值；局內目前面板未知',
    confidence: 'CONDITIONAL',
    tone: 'priority'
  }];

  const skillActionParts = [];
  if (hintNames.length) skillActionParts.push(`提示優先：${hintNames.join('、')}`);
  if (eventNames.length) skillActionParts.push(`事件路線：${eventNames.join('、')}（只當取得路線，不當保證）`);
  if (gapNames.length) skillActionParts.push(`仍有殘餘缺口：${gapNames.join('、')}，不要在本局空等，改由父輩／因子處理`);
  actions.push({
    phase: '技能',
    title: hintNames.length ? `本場目標提示先檢查：${hintNames.slice(0, 2).join('、')}` : '沒有解析到本場目標的正式提示時，不要亂追提示',
    reason: `${skillActionParts.join('；') || '目前六卡沒有可確認的本場目標提示／事件路線；介面不會用卡片白技數量假裝成有效技能。'}${hintNames.length ? '；是否立刻點取仍要看當下技能 Pt、提示折扣與該回合訓練收益，這裡只確認它是本場有效取得路線。' : ''}`,
    evidence: coveragePercent === null ? '目標技能來源證據不足' : `賽道綁定取得覆蓋代理 ${coveragePercent}%`,
    confidence: hintNames.length || eventNames.length ? 'CONDITIONAL' : 'UNKNOWN',
    tone: hintNames.length || eventNames.length ? 'skill' : 'warning'
  });

  if (requiredGoldRecovery <= 0) {
    actions.push({
      phase: '體力',
      title: '標準方案沒有額外金回硬門，不為重複回復犧牲主訓練',
      reason: '目前足耐模型的標準層沒有要求金回數；若你手動改低耐力，必須重新計算，不能沿用這句。',
      evidence: '目前賽道足耐標準層',
      confidence: 'MODEL_BOUND',
      tone: 'recovery'
    });
  } else if (recoveryGate?.status === 'met') {
    actions.push({
      phase: '體力',
      title: `保留已達標的回復路線；標準需求為 ${requiredGoldRecovery} 個金回槽`,
      reason: '目前六卡是 optimizer 已算過的完整候選，回復結構門已通過；同家族第二套回復不重複當成第二個槽。',
      evidence: '完整候選的回復結構門',
      confidence: 'KNOWN',
      tone: 'recovery'
    });
  } else {
    const deficit = Number.isFinite(Number(recoveryGate?.deficit))
      ? `；目前尚缺 ${Number(recoveryGate.deficit).toFixed(2)} 槽`
      : '；自配不是已完整算過的候選，達成狀態未知';
    actions.push({
      phase: '體力',
      title: `先守住足耐／回復線：標準需求為 ${requiredGoldRecovery} 個金回槽`,
      reason: `未確認回復門前，不把「有回復技能」直接當成足耐${deficit}。`,
      evidence: recoveryGate ? '完整候選的回復缺口' : 'UNKNOWN；不得當成 0',
      confidence: recoveryGate ? 'MODEL_BOUND' : 'UNKNOWN',
      tone: 'warning'
    });
  }

  if (scenarioCards.length) {
    actions.unshift({
      phase: '全程固定',
      title: `固定保留必要卡：${scenarioCards.map(supportCardComparisonName).join('、')}`,
      reason: '這張卡是目前劇本的 exact 必要卡，已固定占一格；比較換卡時不能把它誤當成自由卡位。',
      evidence: '劇本 exact hard slot',
      confidence: 'KNOWN',
      tone: 'constraint'
    });
  }

  const targetName = `${localizedUmaName(target.nameZhTw || target.name)} ${target.titleZhTw || target.title || ''}`.trim();
  const guideStatus = !state.battleOwnedCardsConfirmed
    ? 'PREVIEW'
    : matchedPackage
      ? 'READY'
      : 'PARTIAL';
  return {
    status: guideStatus,
    statusLabel: guideStatus === 'READY'
      ? '可照這套開始養'
      : guideStatus === 'PARTIAL'
        ? '六卡已確認・部分理由未知'
        : '六卡有效・尚未確認',
    summaryTitle: `${targetName}｜${compositionText}`,
    summaryText: `這份順序依你的實際六卡產生；${guideStatus === 'READY' ? '六卡已確認，且能對應一副完整 optimizer 候選。' : guideStatus === 'PARTIAL' ? '六卡已確認，但不是完整 optimizer 候選；面板／回復未知處不補猜。' : '目前可先預覽，按下確認後才供父輩與因子重算。'}`,
    actions,
    boundary: '這裡沒有當回合卡片位置、羈絆值、體力、失敗率、目前面板與劇本量表，所以不會假裝知道該點哪一格；它只給「這副卡整場怎麼養」的條件式順序。逐回合決策必須另接即時狀態，UNKNOWN 不會被當成 0。'
  };
}

function renderBattleDeckTrainingPlan() {
  const root = byId('guidedTrainingPlan');
  const status = byId('guidedTrainingPlanStatus');
  const summary = byId('guidedTrainingPlanSummary');
  const steps = byId('guidedTrainingPlanSteps');
  const boundary = byId('guidedTrainingPlanBoundary');
  if (!root || !status || !summary || !steps || !boundary) return;
  const guide = buildBattleDeckTrainingGuide();
  const confidenceLabels = {
    KNOWN: '已確認',
    MODEL_BOUND: '模型綁定',
    CONDITIONAL: '條件式',
    UNKNOWN: '未知'
  };
  root.dataset.status = guide.status;
  status.textContent = guide.statusLabel;
  summary.innerHTML = `<strong>${escapeHtml(guide.summaryTitle)}</strong><span>${escapeHtml(guide.summaryText)}</span>`;
  steps.innerHTML = guide.actions.length
    ? guide.actions.map((action, index) => `<li data-training-tone="${escapeHtml(action.tone || 'priority')}" data-training-confidence="${escapeHtml(action.confidence || 'UNKNOWN')}">
        <b>${index + 1}</b><div><span>${escapeHtml(action.phase)}</span><strong>${escapeHtml(action.title)}</strong><p>${escapeHtml(action.reason)}</p><small>理由依據：${escapeHtml(action.evidence)}・信心：${escapeHtml(confidenceLabels[action.confidence] || '未知')}</small></div>
      </li>`).join('')
    : '<li data-training-tone="waiting"><b>—</b><div><strong>等待六卡</strong><p>完成目前步驟後才建立育成順序。</p></div></li>';
  boundary.textContent = guide.boundary;
}

function activePlanningSnapshot(options = {}) {
  if (!planningSnapshotCore) return null;
  const courseTable = activeCourseAccelerationTable();
  if (!courseTable) return null;
  const familyAnalysis = selectedFamilyAnalysis();
  const selectedFamilyIds = state.selectedAccelerationSkillIds
    .map(id => courseTable.families.find(row => Number(row.id) === Number(id))?.familyId)
    .filter(Number.isFinite);
  const deckCards = options.ignoreDeck
    ? []
    : confirmedBattleDeckCoverageCards().filter((card, index) => !options.ignoreBorrow || index < 5);
  return planningSnapshotCore.buildPlanningSnapshot({
    courseTable,
    catalog: gameCatalog,
    certainSkillIds: battleUmaCertainSkillIds(),
    characterEventSkillIds: selectedBattleUmaCard()?.catalogEventSkillIds || [],
    deckCards,
    directParentSkillIds: [state.main, state.sub].filter(hasSelectedParentId).map(Number),
    existingFactors: familyAnalysis?.factorSummary?.whiteFactors || [],
    selectedFamilyIds,
    ...acquisitionIntegrationOptions(),
    supportProfiles: supportCardProfiles,
    curatedFixtures: supportCardLevelFixtures
  });
}

function generatedFactorPlan(strategy) {
  if (!strategy) return defaultFactorPlan;
  const red = strategy.redFactors?.[0];
  const types = state.battleDeckCardIds
    .map(id => supportCatalogById.get(Number(id)))
    .filter(Boolean)
    .map(card => normalizeSupportType(card.supportType));
  const missingStats = [
    !types.includes('Power') ? '力量' : '',
    !types.includes('Guts') ? '根性' : ''
  ].filter(Boolean);
  const categories = (strategy.categories || [])
    .filter(category => category.id !== 'recovery')
    .map(category => ({
      id: category.id,
      label: category.label,
      weight: normalizeDeckDomainWeight(category.weight, 100),
      description: category.description,
      skills: (category.skills || []).map(skill => ({
        id: Number(skill.factorId || skill.id),
        sourceSkillId: Number(skill.id),
        factorId: Number(skill.factorId || skill.id),
        // Strategy score is ordering metadata (and may be MAX_SAFE for a
        // profile override), never a factor/domain weight.
        weight: normalizeDeckDomainWeight(
          skill.weight,
          normalizeDeckDomainWeight(category.weight, 100)
        ),
        activationWindow: skill.activationWindow,
        reason: skill.reason,
        evidence: [
          skill.effectLabel,
          skill.priority ? `通用評級 ${skill.priority}` : '',
          skill.source === 'profile-override' ? '本賽事人工校正' : 'GameTora 條件動態篩選'
        ].filter(Boolean)
      }))
    }));
  return {
    formula: '賽道條件符合度 × 時間窗 × 領頭／距離／場地專用度 × 取得來源',
    redFactor: {
      label: '紅因子',
      primary: red ? `${red.label.replace(/因子$/, '')} ★${red.recommendedStars}` : '依賽道適性',
      detail: (strategy.redFactors || []).map(item => `${item.label}：${item.reason}`).join(' ')
    },
    blueFactor: {
      label: '藍因子',
      primary: missingStats.length ? missingStats.join('／') : '依成品缺口',
      detail: missingStats.length
        ? `目前戰馬卡型沒有直接${missingStats.join('、')}卡，優先用藍因子補成品缺口。`
        : '依預期成品數值與足耐模擬結果調整。'
    },
    categories
  };
}

function activeFactorPlan() {
  const strategy = activeRaceStrategy();
  if (hasActiveProfileStrategy(strategy)) {
    if (jpStrategy?.factorPlan?.categories?.length) return jpStrategy.factorPlan;
    if (Array.isArray(jpStrategy?.factorCategories) && jpStrategy.factorCategories.length) {
      return {
        ...defaultFactorPlan,
        categories: jpStrategy.factorCategories,
        redFactor: jpStrategy.redFactor || defaultFactorPlan.redFactor,
        blueFactor: jpStrategy.blueFactor || defaultFactorPlan.blueFactor
      };
    }
  }
  return generatedFactorPlan(strategy);
}

function ownedLongRunnerCards() {
  const ownedIds = new Set((inventory?.trainees || []).map(item => Number(item.outfitId)));
  return (gameCatalog?.characterCards || [])
    .filter(card => ownedIds.has(Number(card.id)))
    .filter(card => ['A', 'B'].includes(card.aptitude?.[5]))
    .filter(card => ['A', 'B'].includes(card.aptitude?.[6]))
    .sort((a, b) =>
      String(a.nameZhTw || a.name).localeCompare(String(b.nameZhTw || b.name), 'zh-Hant')
      || Number(a.id) - Number(b.id)
    );
}

function ownedRunnerBattleCards() {
  const strategy = activeRaceStrategy();
  const distanceType = Number(strategy?.context?.distance_type || 4);
  const groundType = Number(strategy?.context?.ground_type || 1);
  const distanceIndex = distanceType + 1;
  const groundIndex = groundType - 1;
  const runnerIndex = 6;
  const ownedIds = new Set((inventory?.trainees || []).map(item => Number(item.outfitId)));
  const aptitudeRank = { S: 7, A: 6, B: 5, C: 4, D: 3, E: 2, F: 1, G: 0 };
  return (gameCatalog?.characterCards || [])
    .filter(card => ownedIds.has(Number(card.id)))
    .map(card => ({
      card,
      distanceAptitude: card.aptitude?.[distanceIndex] || '?',
      groundAptitude: card.aptitude?.[groundIndex] || '?',
      styleAptitude: card.aptitude?.[runnerIndex] || '?',
      needsAptitudeWork:
        !['A', 'B'].includes(card.aptitude?.[distanceIndex])
        || !['A', 'B'].includes(card.aptitude?.[groundIndex])
        || !['A', 'B'].includes(card.aptitude?.[runnerIndex])
    }))
    .sort((a, b) =>
      (aptitudeRank[b.styleAptitude] ?? -1) - (aptitudeRank[a.styleAptitude] ?? -1)
      || (aptitudeRank[b.distanceAptitude] ?? -1) - (aptitudeRank[a.distanceAptitude] ?? -1)
      || (aptitudeRank[b.groundAptitude] ?? -1) - (aptitudeRank[a.groundAptitude] ?? -1)
      || String(a.card.nameZhTw || a.card.name).localeCompare(
        String(b.card.nameZhTw || b.card.name),
        'zh-Hant'
      )
      || Number(a.card.id) - Number(b.card.id)
    );
}

let cachedBattleHorseRankingKey = '';
let cachedBattleHorseRankingResult = null;
let cachedBattleBuildEvaluationKey = '';
let cachedBattleBuildEvaluationResult = null;
let battleHorseBuildAnalysisKey = '';
let battleHorseAnalysisState = {
  status: 'idle',
  inputKey: '',
  completedSteps: 0,
  candidateCount: 0,
  error: ''
};
let guidedDeckRenderToken = 0;

function isCmOaksRunnerTarget(target) {
  return target?.server === 'zh_tw'
    && target?.eventMode === 'cm'
    && Number(target?.courseId) === 10606
    && target?.surface === 'turf'
    && target?.distanceType === 'medium'
    && Number(target?.distanceM) === 2400
    && target?.runningStyle === 'runner'
    && target?.objective === 'cm_winner_line';
}

function activeBattleDemandDisplayProfile(target = activeGoalContractTarget()) {
  const timeline = activeCourseAccelerationTable()?.timeline || null;
  if (!timeline || timeline.geometryConfidence !== 'catalog') {
    return {
      status: 'NEEDS_EVIDENCE',
      profileId: null,
      windows: [],
      expectedSlotIds: [],
      evidenceSource: null
    };
  }
  if (isCmOaksRunnerTarget(target)) {
    return {
      status: 'POLICY_CANDIDATE',
      profileId: 'cm-oaks-10606-runner-demand-policy-v1',
      evidenceSource: 'course-core:10606 + user-calibrated terminal sufficiency example',
      expectedSlotIds: [
        'opening_launch_0_400',
        'mid_position_400_1600',
        'terminal_launch_1600_1875',
        'final_straight_1875_2400'
      ],
      windows: [
        {
          id: 'opening_launch_0_400',
          label: '序盤起步',
          meterWindow: { start: 0, end: 400 },
          functionLabel: '起步加速＋搶位',
          sufficientThreshold: null,
          demandStatus: 'POLICY_CANDIDATE',
          note: '先發必勝、先鋒、打好基礎要在這一槽合併；0.4／0.6／0.8 的足量線仍待校準。'
        },
        {
          id: 'mid_position_400_1600',
          label: '中盤維持',
          meterWindow: { start: 400, end: 1600 },
          functionLabel: '速度＋位置控制＋回復',
          sufficientThreshold: null,
          demandStatus: 'POLICY_CANDIDATE',
          note: '不把中盤速度、回復與加速度混成同一個數字。'
        },
        {
          id: 'terminal_launch_1600_1875',
          label: '後期起速',
          meterWindow: { start: 1600, end: 1875 },
          functionLabel: '終盤加速度',
          sufficientThreshold: 0.4,
          demandStatus: 'USER_CALIBRATED_EXAMPLE',
          note: '本輪採用的邏輯驗證線：紅焰 0.2＋準時白加速 0.2 已足量時，本體同槽加速邊際＝0。'
        },
        {
          id: 'final_straight_1875_2400',
          label: '最終直線',
          meterWindow: { start: 1875, end: 2400 },
          functionLabel: '終直速度；延誤時才補加速',
          sufficientThreshold: null,
          demandStatus: 'POLICY_CANDIDATE',
          note: '不能把晚開加速當成 1600m 起速槽的等價供給。'
        }
      ]
    };
  }
  return {
    status: 'POLICY_CANDIDATE',
    profileId: `course-${Number(target?.courseId) || 'unknown'}-geometry-only`,
    evidenceSource: 'course-core:catalog-geometry-only',
    expectedSlotIds: (timeline.phases || []).map(phase => `phase_${phase.phase}_${Math.round(phase.start)}_${Math.round(phase.end)}`),
    windows: (timeline.phases || []).map(phase => ({
      id: `phase_${phase.phase}_${Math.round(phase.start)}_${Math.round(phase.end)}`,
      label: ({ 0: '序盤', 1: '中盤', 2: '後期前段', 3: '後期後段' })[phase.phase] || `賽段 ${phase.phase}`,
      meterWindow: { start: phase.start, end: phase.end },
      functionLabel: '需求功能待定義',
      sufficientThreshold: null,
      demandStatus: 'POLICY_CANDIDATE',
      note: '只有賽道幾何已確認；需求量與來源映射尚未校準。'
    }))
  };
}

function battleBodyDiagnosticRows(bodyPackage) {
  const seen = new Set();
  return (bodyPackage?.active || []).flatMap(record => {
    const windows = Array.isArray(record?.timing?.windows) && record.timing.windows.length
      ? record.timing.windows
      : [null];
    const replacement = (bodyPackage?.evolutionRoutes || []).find(route =>
      Number(route?.selectedSkillId) === Number(record?.skillId));
    return windows.map((window, windowIndex) => {
      const effects = window?.controlEffects || [];
      const maximum = type => Math.max(0, ...effects
        .filter(effect => Number(effect?.type) === type)
        .map(effect => Number(effect?.value) || 0));
      const intervals = (window?.intervals || [])
        .filter(interval => Number.isFinite(Number(interval?.start)) && Number.isFinite(Number(interval?.end)))
        .map(interval => ({ start: Number(interval.start), end: Number(interval.end) }));
      const start = intervals.length ? Math.min(...intervals.map(interval => interval.start)) : null;
      const end = intervals.length ? Math.max(...intervals.map(interval => interval.end)) : null;
      const acceleration = maximum(31) / 10000;
      const speed = (maximum(22) + maximum(27)) / 10000;
      const conditionFields = new Set(window?.conditionFields || record?.timing?.fields || []);
      const timingClass = conditionFields.has('activate_count_start')
        ? 'opening'
        : conditionFields.has('activate_count_middle')
          ? 'mid'
          : start != null && end != null && end <= 400
            ? 'opening'
            : start != null && start >= 1600
              ? 'terminal'
              : 'other';
      return {
        skillId: Number(record?.skillId),
        windowIndex,
        name: record?.name || localizedSkillName(record?.skillId),
        kind: record?.kind || 'body',
        acceleration,
        speed,
        meterWindow: start == null || end == null ? null : { start, end },
        intervals,
        timingClass,
        distribution: window?.distribution || 'UNKNOWN',
        conditionFields: [...conditionFields],
        conditionState: record?.applicability || 'UNKNOWN',
        isUnique: record?.kind === 'unique',
        replacesSkillId: Number.isFinite(Number(replacement?.oldSkillId))
          ? Number(replacement.oldSkillId)
          : null,
        familyIds: record?.canonicalFamilyIds || []
      };
    });
  }).filter(row => {
    const signature = [
      row.skillId,
      row.meterWindow?.start ?? 'unknown',
      row.meterWindow?.end ?? 'unknown',
      row.acceleration,
      row.speed,
      row.conditionFields.join('|')
    ].join(':');
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

function battleDeckDiagnosticRows(deckValidation, bodyPackage) {
  const replacedFamilies = new Set((bodyPackage?.evolutionRoutes || [])
    .filter(route => route?.state === 'SELECTED')
    .flatMap(route => [route?.oldSkillId, ...(route?.oldFamilyIds || [])])
    .map(Number)
    .filter(Number.isFinite));
  return (deckValidation?.cards || []).filter(Boolean).map(card => {
    const profile = supportCardProfileById.get(Number(card.id));
    const hintSkillIds = [...new Set((profile?.skillSources?.hintSkillIds || card?.hintSkillIds || [])
      .map(Number).filter(Number.isFinite))];
    const eventSkillIds = [...new Set((profile?.skillSources?.eventSkillIds || card?.eventSkillIds || [])
      .map(Number).filter(Number.isFinite))];
    const allSkillIds = [...new Set([...hintSkillIds, ...eventSkillIds])];
    const overlapSkillIds = allSkillIds.filter(skillId => {
      const skill = skillById.get(Number(skillId));
      const families = [Number(skillId), Number(skill?.familyId), ...(skill?.familyIds || []).map(Number)];
      return families.some(familyId => Number.isFinite(familyId) && replacedFamilies.has(familyId));
    });
    return {
      cardId: Number(card.id),
      name: localizedSupportLabels(card).name,
      supportType: normalizeSupportType(card.supportType),
      hintSkillIds,
      eventSkillIds,
      overlapSkillIds,
      retainedSkillIds: allSkillIds.filter(skillId => !overlapSkillIds.includes(skillId)),
      routeStatus: supportEventRoutes?.choiceModels?.[String(card.id)]?.status || 'UNKNOWN'
    };
  });
}

function battleHorseRankingInputs() {
  const target = activeGoalContractTarget();
  const profileTarget = activeGoalContractProfileTarget();
  const deckConfirmed = state.battleOwnedCardsConfirmed === true;
  const selectedSupportCharacters = state.battleDeckCardIds
    .map(id => supportCatalogById.get(Number(id)))
    .filter(Boolean)
    .map(card => Number(card.characterId))
    .filter(Number.isFinite);
  return { target, profileTarget, deckConfirmed, selectedSupportCharacters };
}

function battleHorseRankingInputKey() {
  const {
    target,
    profileTarget,
    deckConfirmed,
    selectedSupportCharacters
  } = battleHorseRankingInputs();
  return JSON.stringify({
    target: [
      target.server,
      target.eventMode,
      target.courseId,
      target.surface,
      target.distanceType,
      target.distanceM,
      target.runningStyle,
      target.objective
    ],
    profileTarget: profileTarget ? [
      profileTarget.server,
      profileTarget.eventMode,
      profileTarget.courseId,
      profileTarget.surface,
      profileTarget.distanceType,
      profileTarget.distanceM,
      profileTarget.runningStyle,
      profileTarget.objective
    ] : null,
    scenarioId: state.scenarioId || null,
    deckConfirmed,
    battleDeckCardIds: state.battleDeckCardIds.map(id => Number(id) || null),
    selectedSupportCharacters,
    directParentSkillIds: [state.main, state.sub].map(id => Number(id) || null),
    selectedAccelerationSkillIds: state.selectedAccelerationSkillIds.map(Number),
    expectedStats: ['expectedSpeed', 'expectedStamina', 'expectedPower', 'expectedGuts', 'expectedWisdom']
      .map(id => finiteOrNull(byId(id)?.value)),
    sourceIdentity: currentOptimizerIdentityKey,
    inventory: (inventory?.trainees || []).map(item => [
      Number(item.outfitId),
      Number(item.awakeningLevel) || null
    ])
  });
}

function currentBattleHorseAnalysisState() {
  const inputKey = battleHorseRankingInputKey();
  if (battleHorseAnalysisState.inputKey && battleHorseAnalysisState.inputKey !== inputKey) {
    return {
      status: 'idle',
      inputKey,
      completedSteps: 0,
      candidateCount: 0,
      error: '',
      stale: true
    };
  }
  return { ...battleHorseAnalysisState, inputKey };
}

function activeBattleHorseRanking(options = {}) {
  const {
    target,
    profileTarget,
    deckConfirmed,
    selectedSupportCharacters
  } = battleHorseRankingInputs();
  const key = battleHorseRankingInputKey();
  const analysis = currentBattleHorseAnalysisState();
  if (!options.force && analysis.status !== 'ready') return null;
  if (cachedBattleHorseRankingKey === key && cachedBattleHorseRankingResult) {
    return cachedBattleHorseRankingResult;
  }
  if (typeof battleHorseRankingCore?.rankBattleHorses !== 'function') {
    cachedBattleHorseRankingKey = key;
    cachedBattleHorseRankingResult = {
      status: 'BLOCKED',
      target: null,
      targetKey: null,
      candidates: [],
      errors: [{ code: 'BATTLE_HORSE_RANKING_CORE_NOT_LOADED' }]
    };
    return cachedBattleHorseRankingResult;
  }
  const candidates = ownedRunnerBattleCards().map(entry => {
    const inventoryEntry = inventoryTraineeByOutfitId.get(Number(entry.card.id));
    const conflict = deckConfirmed
      && selectedSupportCharacters.includes(Number(entry.card.characterId));
    return {
      card: entry.card,
      outfitId: Number(entry.card.id),
      awakeningLevel: Number(inventoryEntry?.awakeningLevel) || null,
      deckConflict: deckConfirmed
        ? { status: 'CONFIRMED', conflict }
        : { status: 'UNCONFIRMED' }
    };
  });
  cachedBattleHorseRankingKey = key;
  cachedBattleHorseRankingResult = battleHorseRankingCore.rankBattleHorses({
    target,
    ...(profileTarget ? { evidenceProfile: profileTarget } : {}),
    catalog: gameCatalog,
    inventory,
    candidates,
    includeBenchmarks: false
  });
  return cachedBattleHorseRankingResult;
}

function battleHorseConstructionRecommendations(
  battleOptions = ownedRunnerBattleCards(),
  ranking = activeBattleHorseRanking()
) {
  const target = activeGoalContractTarget();
  if (!ranking) {
    return {
      status: 'NOT_ANALYZED',
      rows: [],
      note: '尚未分析；此步不影響你直接從自有清單選馬。'
    };
  }
  const rankingById = new Map((ranking?.candidates || []).map(candidate => [
    Number(candidate.outfitId),
    candidate
  ]));
  const eligible = battleOptions
    .filter(entry => !entry.needsAptitudeWork)
    .map(entry => ({
      entry,
      candidate: rankingById.get(Number(entry.card.id)) || null
    }))
    .filter(row => row.candidate?.ownership === 'USER_OWNED'
      && row.candidate?.recommendationTier !== 'UNKNOWN');

  if (isCmOaksRunnerTarget(target)) {
    const kitasan = eligible.find(row => Number(row.entry.card.id) === 106802);
    if (!kitasan) {
      return {
        status: 'NEEDS_BUILD_CONTEXT',
        rows: [],
        note: '目前自有資料沒有可在既有停止線邏輯下直接列為首選的戰馬；請從完整清單手動選擇。'
      };
    }
    return {
      status: 'READY_FOR_CONSTRUCTION',
      rows: [{
        ...kitasan,
        recommendationLabel: '目前首選・先做完整方案',
        recommendationReason: '本體同時提供開局、中盤與後期價值；即使後期加速由卡片與因子補到停止線，也不會整包失去收益。',
        recommendationGap: '若帶速飛鷹卡，下一步必須比較重複金技、保留高價白技池與換卡代價。'
      }],
      note: ''
    };
  }

  const rows = eligible
    .filter(row => row.candidate.frontRecommended === true)
    .slice(0, 2)
    .map((row, index) => ({
      ...row,
      recommendationLabel: index === 0 ? '優先建立完整方案' : '第二施工候選',
      recommendationReason: row.candidate.reasons?.[0]
        || '本體包與目前賽道條件有明確交集，值得先建立六卡與因子方案。',
      recommendationGap: row.candidate.gaps?.[0]
        || '仍需用完整六卡、父輩與成品數值確認最後收益。'
    }));
  return {
    status: rows.length ? 'READY_FOR_CONSTRUCTION' : 'NEEDS_BUILD_CONTEXT',
    rows,
    note: rows.length
      ? '這些候選只代表先做完整建構的順序，不是完成配卡後的最終名次。'
      : '目前沒有通過證據門檻的施工首選；請從完整清單手動選擇。'
  };
}

function activeBattleBuildEvaluation(options = {}) {
  if (typeof battleBuildEvaluationCore?.evaluateBattleBuilds !== 'function') return null;
  if (!options.force && !battleHorseBuildAnalysisKey) return null;
  const target = activeGoalContractTarget();
  const demandDisplayProfile = activeBattleDemandDisplayProfile(target);
  const cacheKey = JSON.stringify({
    target: [
      target.server,
      target.eventMode,
      target.courseId,
      target.surface,
      target.distanceType,
      target.distanceM,
      target.runningStyle,
      target.objective
    ],
    battleUmaOutfitId: state.battleUmaOutfitId,
    battleDeckCardIds: state.battleDeckCardIds,
    battleOwnedCardsConfirmed: state.battleOwnedCardsConfirmed,
    directParentSkillIds: [state.main, state.sub],
    selectedAccelerationSkillIds: state.selectedAccelerationSkillIds,
    expectedStats: ['expectedSpeed', 'expectedStamina', 'expectedPower', 'expectedGuts', 'expectedWisdom']
      .map(id => finiteOrNull(byId(id)?.value)),
    ownedOutfitIds: (inventory?.trainees || []).map(row => Number(row.outfitId)),
    demandProfileId: demandDisplayProfile.profileId,
    demandProfileStatus: demandDisplayProfile.status
  });
  if (!options.force && battleHorseBuildAnalysisKey !== cacheKey) return null;
  if (cacheKey === cachedBattleBuildEvaluationKey && cachedBattleBuildEvaluationResult) {
    return cachedBattleBuildEvaluationResult;
  }
  const selectedId = Number(state.battleUmaOutfitId);
  const hasSelectedBattleUma = state.battleUmaOutfitId != null && Number.isFinite(selectedId);
  const deckValidation = hasSelectedBattleUma
    ? battleDeckValidation()
    : { valid: false, cards: [] };
  const deckConfirmed = Boolean(state.battleOwnedCardsConfirmed && deckValidation.valid);
  const rankingById = new Map((activeBattleHorseRanking({ force: options.force })?.candidates || []).map(row => [
    Number(row.outfitId),
    row
  ]));
  const candidates = ownedRunnerBattleCards().map(entry => {
    const outfitId = Number(entry.card.id);
    const inventoryEntry = inventoryTraineeByOutfitId.get(outfitId);
    const ranking = rankingById.get(outfitId);
    const bodyEvidence = ranking?.bodyPackage?.evidence || {};
    const aptitudeState = entry.needsAptitudeWork ? 'HEAVY_REPAIR' : 'READY';
    const selectedVariants = outfitId === selectedId
      ? [{
        variantId: 'current-ui-build',
        battleUmaOutfitId: outfitId,
        ...(deckConfirmed ? { sixCardIds: deckValidation.cards.map(card => Number(card?.id)) } : {}),
        expectedStats: {
          status: 'PLANNED',
          speed: finiteOrNull(byId('expectedSpeed')?.value),
          stamina: finiteOrNull(byId('expectedStamina')?.value),
          power: finiteOrNull(byId('expectedPower')?.value),
          guts: finiteOrNull(byId('expectedGuts')?.value),
          wisdom: finiteOrNull(byId('expectedWisdom')?.value),
          evidenceSource: 'user-entered expected build stats'
        },
        opportunity: null
      }]
      : [];
    if (
      outfitId === 106802
      && outfitId === selectedId
      && selectedVariants.length === 1
      && deckConfirmed
      && deckValidation.cards.some(card => Number(card?.id) === 30210)
    ) {
      selectedVariants[0].variantId = 'retain-falcon-current-deck';
      selectedVariants.push({
        variantId: 'swap-falcon-alternative-unselected',
        battleUmaOutfitId: outfitId,
        expectedStats: {
          status: 'UNKNOWN',
          speed: null,
          stamina: null,
          power: null,
          guts: null,
          wisdom: null
        },
        opportunity: null
      });
    }
    return {
      candidateId: outfitId,
      name: `${entry.card.nameZhTw || entry.card.name || ''} ${entry.card.titleZhTw || entry.card.title || ''}`.trim(),
      ownership: 'USER_OWNED',
      serverStatus: 'AVAILABLE',
      bodyEvidence: bodyEvidence.target === 'READY'
        && bodyEvidence.catalog === 'CONFIRMED'
        && bodyEvidence.courseGeometry === 'CONFIRMED'
        ? 'CONFIRMED'
        : 'UNKNOWN',
      aptitudeState,
      awakeningState: inventoryEntry && bodyEvidence.awakeningLevel === 'CONFIRMED'
        ? 'CONFIRMED'
        : 'UNKNOWN',
      evolutionState: bodyEvidence.evolution === 'CONFIRMED' ? 'CONFIRMED' : 'UNKNOWN',
      bodySources: [],
      buildVariants: selectedVariants
    };
  });
  cachedBattleBuildEvaluationKey = cacheKey;
  const evaluation = battleBuildEvaluationCore.evaluateBattleBuilds({
    target,
    // The course geometry is known, but interval demand magnitudes are not yet
    // calibrated.  Empty is deliberate: the evaluator must stop here instead
    // of substituting the legacy body-package thresholds.
    demandSlots: [],
    demandProfileContract: {
      status: demandDisplayProfile.status,
      expectedSlotIds: demandDisplayProfile.expectedSlotIds,
      evidenceSource: demandDisplayProfile.evidenceSource
    },
    comparisonUnitContract: {
      unit: 'course_bashin_reference',
      additivity: 'REFERENCE_ONLY',
      evidenceSource: 'data/course-effect-snapshots.json:per-skill-reference'
    },
    comparisonSet: {
      status: 'CONFIRMED_COMPLETE',
      candidateIds: candidates.map(candidate => candidate.candidateId),
      evidenceSource: 'data/user-inventory.json:owned-trainee-set'
    },
    candidates
  });
  const selectedRanking = rankingById.get(selectedId) || null;
  evaluation.displayContext = {
    demandProfile: demandDisplayProfile,
    selectedBodyRows: battleBodyDiagnosticRows(selectedRanking?.bodyPackage),
    selectedDeckRows: battleDeckDiagnosticRows(deckValidation, selectedRanking?.bodyPackage),
    selectedParentSkillIds: [state.main, state.sub]
      .filter(hasSelectedParentId)
      .map(Number),
    selectedFactorGoalSkillIds: (state.selectedAccelerationSkillIds || [])
      .map(Number)
      .filter(Number.isFinite),
    exactFactorRecordsConfirmed: false,
    note: 'Display diagnostics are evidence rows only; they do not authorize finalRank.'
  };
  cachedBattleBuildEvaluationResult = evaluation;
  battleHorseBuildAnalysisKey = cacheKey;
  return cachedBattleBuildEvaluationResult;
}

function battleHorseRaceFitCandidates() {
  const build = activeBattleBuildEvaluation();
  const buildById = new Map((build?.candidates || []).map(candidate => [
    Number(candidate.candidateId),
    candidate
  ]));
  const bodyById = new Map((activeBattleHorseRanking()?.candidates || []).map(candidate => [
    Number(candidate.outfitId),
    candidate
  ]));
  return ownedRunnerBattleCards().map(entry => {
    const outfitId = Number(entry.card.id);
    const candidate = buildById.get(outfitId);
    const body = bodyById.get(outfitId);
    return {
      id: String(outfitId),
      outfitId,
      characterId: Number(entry.card.characterId),
      nameZhTw: `${entry.card.nameZhTw || entry.card.name || ''} ${entry.card.titleZhTw || entry.card.title || ''}`.trim(),
      selected: outfitId === Number(state.battleUmaOutfitId),
      certainSkillIds: (body?.bodyPackage?.active || [])
        .map(row => Number(row.skillId))
        .filter(Number.isFinite),
      raceFit: {
        status: candidate?.finalRank == null ? 'NEEDS_EVIDENCE' : 'READY',
        axes: { wholeBuildRank: candidate?.finalRank ?? null }
      }
    };
  });
}

function goalContractRequirementRows() {
  const useful = usefulAccelerationCandidates();
  const selectedIds = new Set(state.selectedAccelerationSkillIds.map(Number));
  const selected = useful.filter(row => selectedIds.has(Number(row.id)));
  const candidates = [...selected, ...useful.slice(0, 6)];
  const byFamily = new Map();
  candidates.forEach(candidate => {
    const familyId = Number(candidate.familyId ?? candidate.factorId ?? candidate.id);
    if (!Number.isFinite(familyId) || byFamily.has(familyId)) return;
    const id = Number(candidate.id);
    byFamily.set(familyId, {
      ...candidate,
      id,
      skillId: Number(candidate.factorId ?? candidate.coverageTargetSkillId ?? candidate.id),
      familyId,
      name: candidate.nameZhTw || candidate.name || localizedSkillName(id),
      kind: candidate.coverageTargetKind || candidate.sourceKind || 'terminal_acceleration',
      timingWindow: candidate.activationWindow || '',
      requirementLevel: selectedIds.has(id) ? 'USER_REQUIRED' : 'RECOMMENDED',
      reason: candidate.reason || '本賽道有效加速候選'
    });
  });
  return [...byFamily.values()];
}

function goalContractLineageKey() {
  const target = activeGoalContractTarget();
  return JSON.stringify({
    target: [
      target.server,
      target.eventMode,
      target.courseId,
      target.surface,
      target.distanceType,
      target.distanceM,
      target.runningStyle,
      target.objective
    ],
    battleUmaOutfitId: state.battleUmaOutfitId,
    directParentSkillIds: [state.main, state.sub],
    selectedAccelerationSkillIds: [...state.selectedAccelerationSkillIds].sort((a, b) => Number(a) - Number(b)),
    battleDeckCardIds: [...state.battleDeckCardIds],
    battleOwnedCardsConfirmed: state.battleOwnedCardsConfirmed,
    breeders: breeders.map(record => [record.id, record.updatedAt || '']),
    bindings: state.lineageBreederRecordBindings
  });
}

function buildActiveGoalContract(lineagePlan = null) {
  if (typeof goalContractCore?.buildGoalContract !== 'function') return null;
  const target = activeGoalContractTarget();
  const selectedId = Number(state.battleUmaOutfitId);
  const requirementRows = goalContractRequirementRows();
  const selectedIds = state.selectedAccelerationSkillIds
    .map(Number)
    .filter(Number.isFinite);
  const deckValidation = Number.isFinite(selectedId)
    ? battleDeckValidation()
    : { valid: false, cards: [] };
  const deckConfirmed = Boolean(state.battleOwnedCardsConfirmed && deckValidation.valid);
  const planningSnapshot = activePlanningSnapshot();
  const normalizedTarget = goalContractCore.normalizeTarget?.(target) || target;
  const targetBoundPlanningSnapshot = planningSnapshot
    ? { ...planningSnapshot, targetKey: normalizedTarget.targetKey }
    : null;
  const confirmedDeckFamilyIds = deckConfirmed
    ? (planningSnapshot?.rows || [])
      .filter(row => String(row.coverageState || '').toUpperCase() === 'COVERED')
      .filter(row => (row.coverageRoutes || []).some(route =>
        /support|deck|card|hint|event/i.test(String(
          route.type || route.source || route.routeType || route.sourceKind || ''
        ))
      ))
      .map(row => row.familyId)
      .filter(value => value !== null && value !== undefined)
    : [];
  try {
    return goalContractCore.buildGoalContract({
      target,
      profileTarget: activeGoalContractProfileTarget(),
      courseTable: {
        profile: target,
        rows: requirementRows
      },
      selectedTargetIds: selectedIds.length ? selectedIds : undefined,
      planningSnapshot: targetBoundPlanningSnapshot,
      deckConfirmation: {
        status: deckConfirmed ? 'CONFIRMED' : 'UNCONFIRMED',
        confirmed: deckConfirmed,
        exactRoute: deckConfirmed,
        confirmedFamilyIds: confirmedDeckFamilyIds,
        source: deckConfirmed ? 'USER_CONFIRMED_SIX_CARD_DECK' : 'NEEDS_USER_CONFIRMATION'
      },
      raceFitCandidates: battleHorseRaceFitCandidates(),
      raceFitAxes: ['wholeBuildRank'],
      axisDirections: {
        wholeBuildRank: 'min'
      },
      selectedCandidateId: Number.isFinite(Number(state.battleUmaOutfitId))
        ? String(state.battleUmaOutfitId)
        : null,
      lineagePlan,
      registeredBreeders: breeders.map(record => ({
        ...record,
        sourceStatus: 'USER_RECORDED'
      })),
      breederBindings: state.lineageBreederRecordBindings
    });
  } catch (error) {
    console.warn('Goal contract could not be built.', error);
    return null;
  }
}

function goalContractStatusLabel(status) {
  return ({
    READY: '已可交棒',
    READY_WITH_TRADEOFFS: '可交棒・有取捨',
    NEEDS_EVIDENCE: '還缺證據',
    BLOCKED: '目標衝突'
  })[status] || '等待資料';
}

function battleBuildStatusLabel(status) {
  return ({
    READY: '完整建構可比較',
    INCOMPLETE_BUILD: '已知建構仍有缺口',
    NEEDS_BUILD_CONTEXT: '缺完整建構',
    NEEDS_EVIDENCE: '缺需求／技能證據',
    BLOCKED: '硬門檻未通過'
  })[status] || '等待資料';
}

function renderBattleBuildEvaluation() {
  const panel = byId('battleBuildEvaluation');
  const title = byId('battleBuildEvaluationTitle');
  const status = byId('battleBuildEvaluationStatus');
  const summary = byId('battleBuildEvaluationSummary');
  const ledger = byId('battleBuildEvaluationLedger');
  if (!panel || !title || !status || !summary || !ledger) return;
  const result = activeBattleBuildEvaluation();
  if (!result) {
    const coreReady = typeof battleBuildEvaluationCore?.evaluateBattleBuilds === 'function';
    panel.dataset.status = coreReady ? 'NOT_ANALYZED' : 'BLOCKED';
    title.textContent = coreReady ? '尚未分析這份建構' : '完整評價核心未載入';
    status.textContent = coreReady ? '等待手動分析' : '停止';
    summary.innerHTML = '';
    ledger.innerHTML = coreReady
      ? '<p>選馬介面不會在載入時自動運算；需要完整評價時，再按「開始分析推薦戰馬」。</p>'
      : '<p>不沿用舊的本體排行。</p>';
    return;
  }
  const selectedId = Number(state.battleUmaOutfitId);
  const hasSelectedBattleUma = state.battleUmaOutfitId != null && Number.isFinite(selectedId);
  const selected = (result.candidates || []).find(candidate =>
    Number(candidate.candidateId) === selectedId) || null;
  const diagnostic = selected?.diagnosticVariant || null;
  const displayContext = result.displayContext || {};
  const demandDisplay = displayContext.demandProfile || { windows: [] };
  const bodyRows = Array.isArray(displayContext.selectedBodyRows)
    ? displayContext.selectedBodyRows
    : [];
  const deckRows = Array.isArray(displayContext.selectedDeckRows)
    ? displayContext.selectedDeckRows
    : [];
  const deckValidation = hasSelectedBattleUma
    ? battleDeckValidation()
    : { valid: false, cards: [] };
  const deckConfirmed = Boolean(state.battleOwnedCardsConfirmed && deckValidation.valid);
  const missing = new Set([
    ...(diagnostic?.missingBuildFields || []),
    ...(result.errors || []).map(error => error.code)
  ]);
  const missingLabels = {
    sixCardIds: '精確六卡',
    deckSources: '六卡實際取得技能列',
    whiteFactorSources: '實際白因子列',
    inheritedUniqueSources: '兩個直接親代固有',
    aptitudeRepair: '適性修復方案',
    expectedStats: '五維成品預估',
    performanceMetrics: '足耐／全速最後衝刺計算結果',
    teamFit: '這匹馬在固定隊伍中的角色適配',
    opportunity: '保留卡／換卡的訓練與技能 Pt 差',
    skillPlan: '最終購買技能表',
    DEMAND_SLOTS_MISSING: '各米數區間的需求量',
    DEMAND_PROFILE_POLICY_NOT_CALIBRATED: '完整需求 profile 尚未校準',
    DEMAND_PROFILE_NOT_CONFIRMED_COMPLETE: '完整需求 profile 尚未確認',
    DEMAND_PROFILE_EXPECTED_SLOT_IDS_MISSING: '需求 profile 預期槽位',
    DEMAND_PROFILE_SLOT_IDS_MISMATCH: '已知幾何槽與已校準需求槽尚未對齊',
    PERFORMANCE_REQUIREMENTS_MISSING: '成品五維／足耐門檻',
    TEAM_CONTEXT_NOT_CONFIRMED: '固定 CM 隊伍腳本',
    TEAM_STRATEGY_ID_MISSING: '隊伍策略編號',
    TEAMMATE_IDS_INVALID: '兩名隊友',
    TEAM_CONTEXT_EVIDENCE_MISSING: '隊伍腳本證據',
    COMPARISON_UNIT_ADDITIVITY_UNKNOWN: '可相加數值契約'
  };
  const missingText = [...missing]
    .map(item => missingLabels[item] || item)
    .filter(Boolean);
  const finalReady = result.finalRankingReady === true;
  panel.dataset.status = finalReady ? 'READY' : result.status;
  title.textContent = finalReady
    ? '完整建構排行已成立'
    : selected
      ? '已選本體，但現在不能排強弱'
      : '尚未產生最終排行';
  status.textContent = battleBuildStatusLabel(result.status);
  const terminalStart = activeCourseAccelerationTable()?.timeline?.terminalStart;
  const terminalDemand = (demandDisplay.windows || []).find(row => row.id === 'terminal_launch_1600_1875');
  summary.innerHTML = `
    <article><span>區間需求</span><strong>${Number.isFinite(Number(terminalStart)) ? `後期 ${Math.round(terminalStart)}m 起` : '賽道幾何待確認'}</strong><small>${Number.isFinite(Number(terminalDemand?.sufficientThreshold)) ? `後期示例足量線 ${Number(terminalDemand.sufficientThreshold).toFixed(1)}；其他槽仍待校準` : '需求量未校準前，不判定加速度是否足夠'}</small></article>
    <article><span>卡＋因子基準</span><strong>${deckConfirmed ? '六卡已選，供給列待正規化' : '尚未完成'}</strong><small>先算非本體覆蓋，再看本體邊際</small></article>
    <article><span>本體加速度</span><strong>${bodyRows.some(row => row.acceleration > 0) ? '原始值已解析・邊際待基準' : '沒有已解析同槽加速'}</strong><small>同區間 baseline 達足量線時，本體同類邊際＝0</small></article>
    <article><span>成品與足耐</span><strong>尚未通過</strong><small>五維、回復與全速最後衝刺是獨立硬門檻</small></article>
    <article><span>CM 隊伍腳本</span><strong>尚未綁定</strong><small>勝負馬、牽引馬與隊友互動不能省略</small></article>
    <article><span>技能總量</span><strong>${diagnostic?.wholeBuild?.status === 'KNOWN' ? diagnostic.wholeBuild.effectiveCourseValue : 'UNKNOWN'}</strong><small>需求內截頂；其餘技能只接受可相加契約</small></article>
    <article><span>配卡衝突</span><strong>逐方案比較</strong><small>保留高白技卡與改放有效金技卡各算一遍</small></article>
    <article><span>最終名次</span><strong>${finalReady ? 'READY' : '停止'}</strong><small>所有可行候選未齊前，不給 provisional rank</small></article>`;
  const selectedCardIds = new Set((deckValidation.cards || []).map(card => Number(card?.id)));
  const kitasanFalcon = selectedId === 106802 && selectedCardIds.has(30210);
  const specialCase = selectedId === 102001
    ? '<p><strong>原皮青雲：</strong>本體 0.4 加速度只補「紅焰＋白加速」之後的剩餘量；該窗口已達停止線時，本體固有邊際直接為 0，不能再靠原始 0.4 加一次。</p>'
    : kitasanFalcon
      ? '<p><strong>正月北黑＋速飛鷹卡：</strong>先區分「先發必勝」原始取得路線重疊與進化後有效技能；再並排計算保留飛鷹白技池、或換成另一張有效金技速卡的整副卡組差。</p>'
      : '';
  const factorGoalIds = displayContext.selectedFactorGoalSkillIds || [];
  const parentIds = displayContext.selectedParentSkillIds || [];
  const plannedBaselineText = [
    parentIds.length ? `已選父輩 ${parentIds.map(localizedSkillName).join('、')}` : '直接親代尚未選齊',
    factorGoalIds.length ? `白因子目標 ${factorGoalIds.map(localizedSkillName).join('、')}（目標不等於已繼承）` : '實際白因子技能列未確認',
    deckConfirmed ? '六卡已確認，但最終購買技能尚未確認' : '六卡尚未確認'
  ].join('；');
  const bodyRowsForWindow = window => bodyRows.filter(row => {
    if (!(row.acceleration > 0)) return false;
    if (!row.meterWindow) return false;
    return row.meterWindow.start <= window.meterWindow.start
      && row.meterWindow.end >= window.meterWindow.end;
  });
  const intervalRows = (demandDisplay.windows || []).map(window => {
    const sources = bodyRowsForWindow(window);
    const threshold = Number.isFinite(Number(window.sufficientThreshold))
      ? `${Number(window.sufficientThreshold).toFixed(1)} raw acceleration`
      : 'UNKNOWN・不可先填 0';
    const marginal = Number.isFinite(Number(window.sufficientThreshold))
      ? `實際 baseline 未確認；若 ≥ ${Number(window.sufficientThreshold).toFixed(1)}，本體邊際＝0`
      : '足量線未知，停止計分';
    return `
    <tr>
      <th scope="row">${escapeHtml(window.label)}<small>${escapeHtml(window.functionLabel)}</small></th>
      <td>${Math.round(window.meterWindow.start)}～${Math.round(window.meterWindow.end)}m</td>
      <td>${escapeHtml(threshold)}<small>${escapeHtml(window.note)}</small></td>
      <td>${escapeHtml(plannedBaselineText)}</td>
      <td>${escapeHtml(marginal)}${sources.length ? `<small>完整覆蓋此骨架的本體 raw 候選：${escapeHtml(sources.map(row => `${row.name} +${row.acceleration.toFixed(1)}`).join('、'))}</small>` : '<small>沒有可直接視為完整覆蓋此骨架的本體 raw 列；部分窗口需另拆需求槽。</small>'}</td>
    </tr>`;
  }).join('');
  const intervalTable = intervalRows
    ? `<div class="battle-build-window-table-wrap"><table class="battle-build-window-table">
        <thead><tr><th>區間骨架</th><th>米數</th><th>最低／目標</th><th>卡＋因子基準</th><th>本體邊際</th></tr></thead>
        <tbody>${intervalRows}</tbody>
      </table><p>幾何已確認不等於需求量已確認；正式需求槽還要按彎道、直線與技能條件切細，不同槽不能互相補量。</p></div>`
    : '<p>目前沒有可確認的賽道區間，無法建立覆蓋帳本。</p>';
  const bodyLedger = bodyRows.length
    ? `<div class="battle-build-window-table-wrap"><table class="battle-build-window-table">
        <thead><tr><th>本體技能</th><th>原始效果</th><th>可發動窗</th><th>條件狀態</th><th>取得路線</th></tr></thead>
        <tbody>${bodyRows.map(row => {
          const effects = [
            row.acceleration > 0 ? `加速 +${row.acceleration.toFixed(1)}` : '',
            row.speed > 0 ? `速度 +${row.speed.toFixed(2)}` : ''
          ].filter(Boolean).join('、') || '非速度／加速效果';
          const window = row.intervals?.length
            ? row.intervals.map(interval => `${Math.round(interval.start)}～${Math.round(interval.end)}m`).join('、')
            : '未解析';
          const route = row.replacesSkillId
            ? `進化取代 ${localizedSkillName(row.replacesSkillId)}`
            : row.isUnique ? '本體固有' : '本體技能';
          const condition = `${row.conditionState}・${row.conditionFields?.join(' / ') || '條件未解析'}`;
          return `<tr><th scope="row">${escapeHtml(row.name)}</th><td>${escapeHtml(effects)}</td><td>${escapeHtml(window)}<small>${escapeHtml(row.distribution)}</small></td><td>${escapeHtml(condition)}</td><td>${escapeHtml(route)}</td></tr>`;
        }).join('')}</tbody>
      </table><p>這裡保留 raw 值；真正計分只取各槽剩餘需求，不會直接把所有 raw 值相加。</p></div>`
    : '<p>尚未選擇戰馬，或本體技能來源仍未解析。</p>';
  const deckLedger = deckRows.length
    ? `<div class="battle-build-window-table-wrap"><table class="battle-build-window-table">
        <thead><tr><th>支援卡</th><th>Hint</th><th>事件</th><th>與本體取得路線重疊</th><th>其餘保留技能</th></tr></thead>
        <tbody>${deckRows.map(row => `<tr><th scope="row">${escapeHtml(row.name)}</th><td>${row.hintSkillIds.length}</td><td>${row.eventSkillIds.length}・${escapeHtml(row.routeStatus)}</td><td>${row.overlapSkillIds.length ? escapeHtml(row.overlapSkillIds.map(localizedSkillName).join('、')) : '無'}</td><td>${row.retainedSkillIds.length}</td></tr>`).join('')}</tbody>
      </table><p>重疊只刪掉同一取得／效果的重複收益；整張卡的白技池、訓練與技能 Pt 仍留在 retain 方案。</p></div>`
    : '<p>尚未確認完整六卡，暫無配卡來源帳本。</p>';
  const kitasanVariants = kitasanFalcon
    ? `<div class="battle-build-variant-grid">
        <article><span>Variant A・保留速飛鷹</span><strong>來源可列・尚未可比較</strong><small>先發必勝路線重疊不計；其餘白技池、面板與技能 Pt 全保留。仍缺最終技能購買表與施工數值。</small></article>
        <article><span>Variant B・更換速卡</span><strong>尚缺替代卡</strong><small>必須指定實際卡片後，重跑金技、白技、訓練與技能 Pt 的完整差值；不使用固定扣分。</small></article>
      </div>`
    : '';
  ledger.innerHTML = `
    <p><strong>固定公式：</strong><code>baseline = 卡＋白因子＋繼承固有</code>；<code>residual = max(0, 足量停止線 − baseline)</code>；<code>bodyMarginal = min(residual, 本體新增覆蓋)</code>。超過足量線只留 raw 稽核，不再變成本體分。</p>
    <p><strong>固定比較順序：</strong>硬門檻 → 五維／足耐 → 每區間最低量 → 剩餘缺口向量 → 隊伍腳本 → 全技能有效量 → 保留卡／換卡差 → 訓練、技能 Pt、舒適度與適性成本。</p>
    ${intervalTable}
    <h5>本體來源帳本</h5>${bodyLedger}
    <h5>支援卡取得與衝突帳本</h5>${deckLedger}
    ${kitasanVariants}
    ${specialCase}
    <p><strong>目前缺口：</strong>${escapeHtml(missingText.join('、') || '無；可建立完整排行')}</p>
    <p><strong>停止規則：</strong>UNKNOWN 不當 0；單技能馬身參考不直接相加；任一可行自有戰馬沒有 READY 建構時，全部 finalRank 維持空值。</p>`;
}

function goalContractStageMarkup(index, title, value, note, status) {
  return `<li data-status="${escapeHtml(status || 'NEEDS_EVIDENCE')}">
    <span>${index}</span><strong>${escapeHtml(title)}</strong>
    <small>${escapeHtml(value)}</small><small>${escapeHtml(note)}</small>
  </li>`;
}

function renderGoalContractChain(lineagePlan) {
  renderBattleBuildEvaluation();
  const panel = byId('goalContractPanel');
  const status = byId('goalContractStatus');
  const stages = byId('goalContractStages');
  const ledger = byId('goalContractLedger');
  const evidence = byId('goalContractEvidence');
  if (!panel || !status || !stages || !ledger || !evidence) return;

  if (arguments.length) {
    cachedGoalContractLineagePlan = lineagePlan || null;
    cachedGoalContractLineageKey = lineagePlan ? goalContractLineageKey() : '';
  }
  const currentKey = goalContractLineageKey();
  const activeLineagePlan = cachedGoalContractLineageKey === currentKey
    ? cachedGoalContractLineagePlan
    : null;
  const contract = buildActiveGoalContract(activeLineagePlan);
  if (!contract) {
    panel.dataset.status = 'NEEDS_EVIDENCE';
    status.textContent = '契約核心尚未載入';
    stages.innerHTML = [
      ['賽道', '等待目標'], ['有效技能', '等待賽道'], ['戰馬', '等待選擇'],
      ['六卡', '等待確認'], ['殘餘', '尚未扣除'], ['親祖代', '尚未展開'], ['停手', '不可判定']
    ].map(([title, value], index) => goalContractStageMarkup(index + 1, title, value, '需要證據', 'NEEDS_EVIDENCE')).join('');
    ledger.innerHTML = '<article><span>狀態</span><strong>尚未建立</strong><small>不以舊分數替代。</small></article>';
    evidence.innerHTML = '<p>核心未載入時停止推導；不將 UNKNOWN 當成 0。</p>';
    return;
  }

  const target = contract.target || {};
  const requirements = contract.requirements?.all || [];
  const lockedRequirements = requirements.filter(row =>
    ['RULE_REQUIRED', 'USER_REQUIRED'].includes(row.requirementLevel));
  const remaining = contract.residual?.remainingTargets || [];
  const unresolved = remaining.filter(row => row.coverageClass === 'UNRESOLVED');
  const partial = remaining.filter(row => row.coverageClass === 'PARTIAL_ROUTE');
  const raceFitRows = contract.raceFit?.candidates || [];
  const battleBuildResult = activeBattleBuildEvaluation();
  const battleBuildRows = battleBuildResult?.candidates || [];
  const selectedBattleId = Number.isFinite(Number(state.battleUmaOutfitId))
    ? String(state.battleUmaOutfitId)
    : '';
  const battle = selectedBattleId
    ? raceFitRows.find(row => String(row.candidateId ?? row.id) === selectedBattleId) || {}
    : {};
  const selectedBattleBuild = selectedBattleId
    ? battleBuildRows.find(row => String(row.candidateId) === selectedBattleId) || null
    : null;
  const directRows = contract.lineage?.direct_parent || [];
  const grandparentRows = contract.lineage?.grandparent || [];
  const foundationRows = contract.lineage?.foundation || [];
  const usableBindings = Object.values(contract.lineage?.bindings || {})
    .filter(binding => binding?.usableForEvidence).length;
  const deckReady = contract.deck?.confirmed === true;
  const targetBlocked = (contract.blockers || []).some(blocker =>
    ['TARGET_REQUIRED_FIELD_MISSING', 'PROFILE_MISMATCH'].includes(blocker.code));
  const requirementStatus = requirements.length
    ? contract.requirements?.unresolvedSelectedTargetIds?.length ? 'NEEDS_EVIDENCE' : 'READY'
    : 'NEEDS_EVIDENCE';
  const battleStatus = battle.candidateId
    ? battle.raceFit?.status === 'READY' ? 'READY' : 'NEEDS_EVIDENCE'
    : 'NEEDS_EVIDENCE';
  const residualStatus = !requirements.length
    ? 'NEEDS_EVIDENCE'
    : unresolved.length
      ? 'NEEDS_EVIDENCE'
      : partial.length
        ? 'READY_WITH_TRADEOFFS'
        : 'READY';
  const targetSummary = [
    target.eventMode === 'cm' ? 'CM' : target.eventMode === 'loh' ? 'LOH' : '賽制未定',
    target.surface === 'turf' ? '草地' : target.surface === 'dirt' ? '泥地' : '場地未定',
    target.distanceM ? `${target.distanceM}m` : '距離未定',
    target.runningStyle === 'runner' ? '領頭' : target.runningStyle || '跑法未定'
  ].join('・');
  const requirementNames = lockedRequirements.length
    ? lockedRequirements.map(row => row.name).filter(Boolean)
    : requirements.map(row => row.name).filter(Boolean);
  const remainingNames = remaining.map(row => row.name).filter(Boolean);

  panel.dataset.status = contract.status;
  status.textContent = goalContractStatusLabel(contract.status);
  stages.innerHTML = [
    goalContractStageMarkup(1, '賽道', targetSummary, targetBlocked ? '目標欄位衝突' : '單一目標鍵', targetBlocked ? 'BLOCKED' : 'READY'),
    goalContractStageMarkup(2, '有效技能', `${lockedRequirements.length || requirements.length} 項`, lockedRequirements.length ? '已鎖定必要項' : '賽道候選待選', requirementStatus),
    goalContractStageMarkup(
      3,
      '戰馬',
      battle.name || '尚未選擇',
      selectedBattleBuild
        ? battleBuildStatusLabel(selectedBattleBuild.status)
        : '尚未由你選定',
      battleStatus
    ),
    goalContractStageMarkup(4, '六卡', deckReady ? '5 自有＋1 借用' : '尚未確認', deckReady ? '只扣確定路線' : '卡組不先算覆蓋', deckReady ? 'READY' : 'NEEDS_EVIDENCE'),
    goalContractStageMarkup(5, '殘餘', `${remaining.length} 項`, remaining.length ? '交給因子與家系' : '目前需求已扣完', residualStatus),
    goalContractStageMarkup(6, '親祖代', `${directRows.length} 親・${grandparentRows.length} 祖`, foundationRows.length ? `${foundationRows.length} 個前置素材` : '尚未產生施工線', contract.lineage?.status || 'NEEDS_EVIDENCE'),
    goalContractStageMarkup(7, '停手', goalContractStatusLabel(contract.status), usableBindings ? `${usableBindings} 格有本機成品證據` : '未綁定成品不宣稱完成', contract.status)
  ].join('');

  const battleLedgerTitle = (battle.candidateId || battle.id)
    ? '目前戰馬'
    : '戰馬尚未選擇';
  const battleLedgerName = battle.name
    || '尚未選擇';
  const battleLedgerNote = (battle.candidateId || battle.id)
    ? `${battleBuildStatusLabel(selectedBattleBuild?.status)}；完整六卡、繼承與因子未齊前不排名`
    : '請在上方從自有戰馬自行選擇';
  ledger.innerHTML = `
    <article><span>${lockedRequirements.length ? '已鎖定必要技能' : '有效加速候選'}</span><strong>${lockedRequirements.length || requirements.length} 項</strong><small>${escapeHtml(requirementNames.slice(0, 4).join('、') || '先由賽道產生候選')}</small></article>
    <article><span>${escapeHtml(battleLedgerTitle)}</span><strong>${escapeHtml(battleLedgerName)}</strong><small>${escapeHtml(battleLedgerNote)}</small></article>
    <article><span>種馬仍需負責</span><strong>${remaining.length} 項</strong><small>${escapeHtml(remainingNames.slice(0, 4).join('、') || '目前沒有未扣除技能')}</small></article>`;

  const deductionLabels = {
    NATIVE_CERTAIN: '本體確定',
    DIRECT_PARENT_CERTAIN: '直接親代確定',
    DECK_CONFIRMED: '六卡確定路線',
    EXISTING_FACTOR_CONFIRMED: '既有因子確認',
    PARTIAL_ROUTE: '部分路線',
    UNRESOLVED: '未解缺口'
  };
  evidence.innerHTML = `
    <p><strong>目標鍵：</strong><code>${escapeHtml(target.targetKey || 'UNKNOWN')}</code></p>
    <p><strong>固定扣除順序：</strong>${escapeHtml((contract.deductionOrder || []).map(item => deductionLabels[item] || item).join(' → '))}</p>
    <p><strong>資料分層：</strong>自有規劃資產 ${(ownedBreederRegistry?.ownedRecords || []).filter(record => record.ownershipStatus === 'USER_CONFIRMED_OWNED' && record.usableAsBreeder === true).length} 隻；本機 USER_RECORDED ${breeders.length} 筆；外部施工來源 ${rentalSourceRegistry?.candidates?.length || 0} 筆（不算資產）。</p>
    <p><strong>模型界線：</strong>本體技能包只作資料清單，不再產生推薦名次。完整比較必須先算卡＋因子＋繼承的區間覆蓋，再算本體邊際、全技能有效量與換卡機會成本；UNKNOWN 不給分也不給 finalRank。M3 只參與規則反證，未直接改寫此結果。</p>`;
}

function uniqueSkillScore(skill, context) {
  if (!skill || skillCore.evaluateSkillForContext(skill, context) === skillCore.FALSE) return -1;
  const effects = (skill.conditionGroups || []).flatMap(group => group.effects || []);
  const maximum = type => Math.max(0, ...effects
    .filter(effect => Number(effect.type) === type)
    .map(effect => Number(effect.value) || 0));
  return maximum(31) * 10 + maximum(9) * 4 + maximum(27) * 2 + maximum(22);
}

function ownedRunnerCardsForRace() {
  const strategy = activeRaceStrategy();
  const distanceType = Number(strategy?.context?.distance_type || 4);
  const distanceIndex = distanceType + 1;
  const groundIndex = Math.max(0, Number(strategy?.context?.ground_type || 1) - 1);
  const aptitudeRank = { S: 7, A: 6, B: 5, C: 4, D: 3, E: 2, F: 1, G: 0 };
  const ownedIds = new Set((inventory?.trainees || []).map(item => Number(item.outfitId)));
  const targetCharacterId = Number(selectedBattleUmaCard()?.characterId);
  return (gameCatalog?.characterCards || [])
    .filter(card => ownedIds.has(Number(card.id)))
    .filter(card => !Number.isFinite(targetCharacterId) || Number(card.characterId) !== targetCharacterId)
    .map(card => {
      const distanceAptitude = card.aptitude?.[distanceIndex] || '?';
      const groundAptitude = card.aptitude?.[groundIndex] || '?';
      const distanceCost = Math.max(0, 5 - (aptitudeRank[distanceAptitude] ?? 0));
      const groundCost = Math.max(0, 5 - (aptitudeRank[groundAptitude] ?? 0));
      const aptitudeCost = distanceCost + groundCost;
      const aptitudeWarning = aptitudeCost
        ? `需補適性：${distanceAptitude}距離／${groundAptitude}場地，養成成本代理 +${aptitudeCost}`
        : '距離／場地適性目前不需額外補正';
      const skillId = [...(card.uniqueSkillIds || [])].map(Number).filter(Number.isFinite).at(-1);
      const skill = skillById.get(skillId);
      const inheritedSkill = skill?.geneVersion
        ? {
            ...skill.geneVersion,
            availableOnServer: skill.availableOnServer,
            tags: skill.tags || []
          }
        : skill;
      return {
        name: card.nameZhTw || card.name,
        outfit: card.titleZhTw || card.title,
        detail: `${localizedSkillName(skillId)}（繼承版）｜${skill?.geneVersion?.description || skill?.descriptionZhTw || '繼承固有候選'}`,
        icon: '🏇',
        outfitId: Number(card.id),
        characterId: Number(card.characterId),
        skillId,
        score: uniqueSkillScore(inheritedSkill, strategy?.context || {}),
        distanceAptitude,
        groundAptitude,
        aptitudeCost,
        aptitudeWarning
      };
    })
    .filter(parent => Number.isFinite(parent.skillId) && parent.score >= 0)
    .sort((a, b) => b.score - a.score || String(a.name).localeCompare(String(b.name), 'zh-Hant'));
}

function mergeParentStrategyMetadata(candidate) {
  const configured = configuredParentCandidates().find(item =>
    (Number.isFinite(Number(candidate.outfitId))
      && Number(item.outfitId) === Number(candidate.outfitId))
    || (Number.isFinite(Number(candidate.skillId))
      && Number(item.skillId) === Number(candidate.skillId))
  );
  if (!configured) return candidate;
  const strategyWeight = Number(
    configured.strategyWeight
      ?? configured.guideWeight
      ?? configured.priorityWeight
      ?? 0
  );
  return {
    ...candidate,
    detail: configured.detail || candidate.detail,
    icon: configured.icon || candidate.icon,
    strategyRank: Number(configured.rank ?? configured.order) || null,
    strategyWeight: Number.isFinite(strategyWeight) ? strategyWeight : 0,
    strategyMetadata: {
      source: 'jp-strategy-profile',
      detail: configured.detail || '',
      evidence: configured.evidence || configured.sources || []
    }
  };
}

function parentBySkillId(skillId) {
  const pool = eligibleParentCandidates();
  return pool.find(parent => Number(parent.skillId) === Number(skillId)) || null;
}

function eligibleParentCandidates() {
  return ownedRunnerCardsForRace().map(mergeParentStrategyMetadata);
}

function parentProxyMetrics(candidate) {
  const skill = skillById.get(Number(candidate?.skillId));
  const inherited = skill?.geneVersion || skill;
  const effects = (inherited?.conditionGroups || []).flatMap(group => group.effects || []);
  const maximum = type => Math.max(0, ...effects
    .filter(effect => Number(effect.type) === type)
    .map(effect => Number(effect.value) || 0));
  const acceleration = maximum(31);
  const speed = maximum(27) + maximum(22);
  const recovery = maximum(9);
  const evaluation = skillCore?.evaluateSkillForContext(
    inherited,
    activeRaceStrategy()?.context || {}
  );
  const reliability = evaluation === skillCore?.TRUE
    ? 0.82
    : evaluation === skillCore?.UNKNOWN
      ? 0.58
      : 0.35;
  const proxyBashin = Math.max(
    0.12,
    ((acceleration / 1000) * 0.25)
      + ((speed / 1000) * 0.08)
      + ((recovery / 1000) * 0.12)
  ) * reliability;
  const components = [
    acceleration ? `加速代理 ${Math.round(acceleration / 100)}%` : '',
    speed ? `速度代理 ${Math.round(speed / 100)}%` : '',
    recovery ? `回復代理 ${Math.round(recovery / 100)}%` : ''
  ].filter(Boolean);
  return {
    proxyBashin,
    proxyReliability: reliability,
    proxyScore: proxyBashin * 100 + components.length * 3,
    proxyReason: `${components.join('＋') || '固有效果未解析'}；條件可靠度約 ${Math.round(reliability * 100)}%`
  };
}

function hasSelectedParentId(value) {
  return value !== null
    && value !== undefined
    && value !== ''
    && Number.isFinite(Number(value));
}

function guidedParentRecommendations() {
  const targetCharacterId = Number(selectedBattleUmaCard()?.characterId);
  const selectedPackage = state.battleOwnedCardsConfirmed ? currentDeckPackage() : null;
  const candidates = eligibleParentCandidates().map(candidate => ({
    ...candidate,
    nameZhTw: candidate.nameZhTw || candidate.name,
    outfitTitleZhTw: candidate.outfitTitleZhTw || candidate.outfit,
    imagePath: candidate.imagePath || traineePortraitPath(candidate),
    uniqueSkillId: Number(candidate.skillId),
    uniqueSkillName: localizedSkillName(candidate.skillId),
    ...parentProxyMetrics(candidate)
  }));
  const ranked = guidedPlannerCore?.rankParentCandidates(candidates, {
    targetCharacterId,
    impactRows: activeCourseAccelerationTable()?.families || [],
    residualRows: selectedPackage?.residualFactorCost || []
  }) || [];
  return factorExecutionCore?.annotateNearTies
    ? factorExecutionCore.annotateNearTies(ranked, {
        scoreKey: 'parentRankScore',
        toleranceRatio: Number(state.factorExecution?.tradeoffBudgetPercent || 0) / 100,
        riskProfile: state.factorExecution?.riskProfileId,
        riskProfiles: factorExecutionRiskProfiles
      })
    : ranked;
}

function recommendedParentPair() {
  return guidedPlannerCore?.selectDistinctParentRecommendations(
    guidedParentRecommendations(),
    2
  ) || [];
}

function parentSelectionComplete() {
  const target = selectedBattleUmaCard();
  if (!target || !guidedPlannerCore?.parentPairIsValid) return false;
  const candidates = eligibleParentCandidates();
  const main = candidates.find(candidate =>
    Number(candidate.skillId) === Number(state.main)
  );
  const sub = candidates.find(candidate =>
    Number(candidate.skillId) === Number(state.sub)
  );
  return guidedPlannerCore.parentPairIsValid(
    main,
    sub,
    candidates,
    target.characterId
  );
}

function parentSelectionConfirmedForPackage() {
  return parentSelectionComplete()
    && Boolean(state.deckPackageId)
    && String(state.parentSelectionPackageId || '') === String(state.deckPackageId);
}

function resetGuidedDownstreamAfterParentChange() {
  const packageConfirmed = deckPackageSelectionComplete();
  state.selectedAccelerationSkillIds = [];
  state.residualFactorDecisionConfirmed = false;
  if (!packageConfirmed) {
    state.battleOwnedCardsConfirmed = false;
    state.battleDeckCardIds[5] = null;
    state.battleDeckBorrowedIndex = 5;
  }
}

function parentCandidateId(candidate) {
  return Number(candidate?.parentSkillId ?? candidate?.skillId ?? candidate?.uniqueSkillId);
}

function applyParentSelection(slot, value, candidates = guidedParentRecommendations()) {
  if (!deckPackageSelectionComplete()) return false;
  const next = Number(value);
  if (!Number.isFinite(next) || !['main', 'sub'].includes(slot)) return false;
  const otherSlot = slot === 'main' ? 'sub' : 'main';
  const selectedCandidate = (candidates || []).find(candidate =>
    parentCandidateId(candidate) === next
  );
  if (!selectedCandidate) return false;
  const target = selectedBattleUmaCard();
  if (
    target
    && guidedPlannerCore?.sameParentCharacter(selectedCandidate, target)
  ) return false;
  const otherCandidate = (candidates || []).find(candidate =>
    parentCandidateId(candidate) === Number(state[otherSlot])
  );
  const otherWasCleared = Boolean(
    selectedCandidate
    && otherCandidate
    && guidedPlannerCore?.sameParentCharacter(selectedCandidate, otherCandidate)
  );
  const changed = Number(state[slot]) !== next || otherWasCleared;
  if (!changed) {
    if (deckPackageSelectionComplete() && parentSelectionComplete()
      && String(state.parentSelectionPackageId || '') !== String(state.deckPackageId || '')) {
      state.parentSelectionPackageId = state.deckPackageId || null;
      state.selectedAccelerationSkillIds = [];
      state.residualFactorDecisionConfirmed = false;
      return true;
    }
    return false;
  }
  if (otherWasCleared) state[otherSlot] = null;
  state[slot] = next;
  resetGuidedDownstreamAfterParentChange();
  state.parentSelectionPackageId = parentSelectionComplete()
    ? state.deckPackageId
    : null;
  return true;
}

function rerenderParentDependentViews() {
  renderGuidedParentStage();
  renderGuidedAccelerationFlow();
  renderBattleDeckEditor();
  renderBattleCoverageSummary();
  renderCurrentRaceProfile();
  renderSkillPlan();
  renderParents();
  scheduleSave();
}

function modeParentPlan() {
  const mode = selectedInheritanceMode();
  const eligible = eligibleParentCandidates();
  const eligibleIds = new Set(eligible.map(parent => Number(parent.skillId)));
  const recommendedIds = recommendedParentPair().map(parent => Number(parent.parentSkillId));
  const directIds = recommendedIds.slice(0, 2);
  const preferredAncestors = (mode?.ancestorSkillIds || []).map(Number)
    .filter(id => eligibleIds.has(id) && !directIds.includes(id));
  const ancestors = [...preferredAncestors];
  for (const parent of guidedParentRecommendations()) {
    const id = Number(parent.parentSkillId);
    if (ancestors.length >= 2) break;
    if (!directIds.includes(id) && !ancestors.includes(id)) ancestors.push(id);
  }
  return {
    mode,
    directIds,
    recommendedIds: directIds,
    ancestorIds: ancestors.slice(0, 2)
  };
}

function syncRecommendedParents(force = false, options = {}) {
  const plan = modeParentPlan();
  const eligibleIds = new Set(eligibleParentCandidates().map(parent => Number(parent.skillId)));
  const before = `${state.main ?? ''}|${state.sub ?? ''}`;
  if (force && options.autoSelect) state.main = plan.directIds[0] ?? null;
  if (!eligibleIds.has(Number(state.main))) state.main = null;
  if (
    !eligibleIds.has(Number(state.sub))
    || Number(state.sub) === Number(state.main)
  ) {
    state.sub = null;
  }
  if (force && options.autoSelect && !hasSelectedParentId(state.sub)) {
    state.sub = plan.directIds.find(id => Number(id) !== Number(state.main)) ?? null;
  }
  const after = `${state.main ?? ''}|${state.sub ?? ''}`;
  return before !== after;
}

function aptitudeRankValue(rank) {
  return { S: 7, A: 6, B: 5, C: 4, D: 3, E: 2, F: 1, G: 0 }[rank] ?? 0;
}

function reverseLineageFactorTargets() {
  const targets = [];
  const seen = new Map();
  const add = raw => {
    const id = Number(raw?.id);
    if (!Number.isFinite(id)) return;
    const current = seen.get(id);
    if (current && Number(current.weight) >= Number(raw.weight)) return;
    const skill = skillById.get(id);
    const factorModel = factorRunStrategy?.skillFactorModel || {};
    const factorProbability = raw.kind === 'green'
      ? Number(factorModel.doubleCircleSkill || factorModel.ordinarySkill || 0.2)
      : Number(skill?.rarity) >= 2
        ? Number(factorModel.goldSkill || factorModel.ordinarySkill || 0.2)
        : Number(factorModel.ordinarySkill || 0.2);
    const skillPointCost = Math.max(0, Number(skill?.cost) || 0);
    const skillPointEfficiency = 200 / (200 + skillPointCost);
    const weight = Math.max(1, Number(raw.weight) || 1);
    const value = {
      id,
      nameZhTw: raw.nameZhTw || localizedSkillName(id),
      kind: raw.kind || 'white',
      weight,
      skillPointCost,
      factorProbability,
      expectedUtility: weight * factorProbability * skillPointEfficiency,
      sourceKind: raw.sourceKind || '',
      scenarioExclusive: Boolean(raw.scenarioExclusive),
      scenarioId: raw.scenarioId || '',
      reason: raw.reason || ''
    };
    seen.set(id, value);
  };

  breedingAccelerationCandidates().forEach(candidate => add({
    id: Number(candidate.factorId || candidate.id),
    nameZhTw: candidate.factorName || candidate.name,
    kind: 'acceleration',
    weight: 10000 + Math.round(Number(candidate.need?.residualWeight || 0) * 1000),
    sourceKind: candidate.sourceKind,
    reason: `本場剩餘加速權重 ${Number(candidate.need?.residualWeight || 0).toFixed(2)} 馬身`
  }));

  recommendedRouteGreens().forEach((green, index) => add({
    id: Number(green.factorId || green.id),
    nameZhTw: green.factorName || green.name,
    kind: 'green',
    weight: 3000 - index * 100,
    reason: green.reason || green.effectLabel
  }));

  const coverage = battleSkillCoverage();
  const remaining = (activeFactorPlan().categories || [])
    .flatMap(category => (category.skills || []).map(meta => ({
      category,
      meta,
      score: factorEffectiveScore(category, meta, coverage)
    })))
    .filter(item => item.score > 0 && item.meta.sourceKind !== 'parent-unique')
    .sort((left, right) => right.score - left.score || Number(left.meta.id) - Number(right.meta.id));
  remaining.slice(0, 10).forEach(({ meta, score }) => {
    const id = Number(meta.factorId || meta.id);
    add({
      id,
      nameZhTw: localizedSkillName(id),
      kind: 'white',
      weight: score,
      scenarioExclusive: id === 210052,
      scenarioId: id === 210052 ? 'aoharu' : '',
      reason: meta.reason || meta.description || ''
    });
  });
  for (const value of seen.values()) targets.push(value);
  return targets.sort((left, right) => right.weight - left.weight || left.id - right.id);
}

function lineageCandidatePool(options = {}) {
  const foundationOnly = options.foundationOnly === true;
  const applySkillCompatibilityGate = options.applySkillCompatibilityGate !== false && !foundationOnly;
  const strategy = activeRaceStrategy();
  const context = strategy?.context || {};
  const distanceIndex = Number(context.distance_type || 4) + 1;
  const groundIndex = Math.max(0, Number(context.ground_type || 1) - 1);
  const targetIds = new Set(reverseLineageFactorTargets().map(target => Number(target.id)));
  const impactRows = activeCourseAccelerationTable()?.families || [];
  const impactBySkillId = new Map();
  impactRows.forEach(row => {
    [row.id, ...(row.familyIds || [])].map(Number).filter(Number.isFinite)
      .forEach(id => impactBySkillId.set(id, row));
  });
  const auditedParents = new Map(longParentCandidates()
    .filter(parent => Number.isFinite(Number(parent.outfitId)))
    .map(parent => [Number(parent.outfitId), parent]));
  const ownedIds = new Set((inventory?.trainees || []).map(item => Number(item.outfitId)));
  return (gameCatalog?.characterCards || [])
    .filter(card => ownedIds.has(Number(card.id)))
    .map(card => {
      const inventoryEntry = inventoryTraineeByOutfitId.get(Number(card.id));
      const character = characterById.get(Number(card.characterId));
      const uniqueSkillId = [...(card.uniqueSkillIds || [])]
        .map(Number).filter(Number.isFinite).at(-1);
      const uniqueSkill = skillById.get(uniqueSkillId);
      const inheritedSkill = uniqueSkill?.geneVersion
        ? {
            ...uniqueSkill.geneVersion,
            availableOnServer: uniqueSkill.availableOnServer,
            tags: uniqueSkill.tags || []
          }
        : uniqueSkill;
      if (!uniqueSkillId || !inheritedSkill) return null;
      if (applySkillCompatibilityGate
        && skillCore.evaluateSkillForContext(inheritedSkill, context) === skillCore.FALSE) return null;
      if (foundationOnly
        && (!Array.isArray(card.aptitude) || card.aptitude.length < 6)) return null;
      const impact = impactBySkillId.get(uniqueSkillId);
      const audited = auditedParents.get(Number(card.id));
      const rawLearnableSkillIds = [...new Set([
        ...(card.catalogBuiltInSkillIds || []),
        ...(card.catalogEventSkillIds || [])
      ].map(Number).filter(Number.isFinite))];
      const learnableSkillIds = [...new Set(rawLearnableSkillIds.flatMap(id =>
        guidedPlannerCore?.familyIdsForSkill(id, gameCatalog) || [id]
      ).map(Number).filter(Number.isFinite))];
      const sourceBreadth = learnableSkillIds.filter(id => targetIds.has(id)).length;
      const groundRank = card.aptitude?.[groundIndex] || 'G';
      const distanceRank = card.aptitude?.[distanceIndex] || 'G';
      const aptitudeScore = aptitudeRankValue(groundRank) + aptitudeRankValue(distanceRank);
      const g1Breadth = (card.aptitude || []).slice(0, 6)
        .reduce((sum, rank) => sum + (['S', 'A'].includes(rank) ? 2 : rank === 'B' ? 1 : 0), 0);
      const staticScore = Math.min(240, Math.max(0, uniqueSkillScore(inheritedSkill, context) / 100));
      const courseScore = staticScore
        + (audited ? 220 : 0)
        + Math.max(0, Number(impact?.riskAdjustedBashin || 0)) * 100;
      const buildNote = ['A', 'B'].includes(distanceRank) && ['A', 'B'].includes(groundRank)
        ? `${distanceLabels[context.distance_type] || '目標距離'} ${distanceRank}／${groundRank === 'A' ? '場地 A' : `場地 ${groundRank}`}`
        : `自動周回前先把距離／場地補到 B 以上（目前 ${distanceRank}／${groundRank}）`;
      const candidate = {
        id: `outfit:${card.id}`,
        outfitId: Number(card.id),
        characterId: Number(card.characterId),
        affinityKey: inventoryEntry?.affinityKey || character?.jp_name || card.nameJp,
        nameZhTw: card.nameZhTw || card.name,
        nameJp: card.nameJp,
        outfitTitleZhTw: card.titleZhTw || card.title,
        imagePath: traineePortraitPath(card),
        uniqueSkillId,
        uniqueSkillName: localizedSkillName(uniqueSkillId),
        learnableSkillIds,
        courseScore,
        courseBashin: Number(impact?.riskAdjustedBashin || impact?.expectedBashin || 0),
        sourceBreadth,
        aptitudeScore,
        // Preserve the complete catalog aptitude vector for G1/race schedule
        // construction.  The scalar score above is only for ranking.
        aptitude: Array.isArray(card.aptitude) ? [...card.aptitude] : [],
        g1Breadth,
        owned: true,
        buildNote,
        metadata: {
          groundRank,
          distanceRank,
          learnableSkillCount: rawLearnableSkillIds.length,
          learnableTargetCount: sourceBreadth,
          impactSource: impact?.impactSource || 'skill-condition-proxy'
        }
      };
      candidate.foundationG1Coverage = typeof g1ScheduleCore?.evaluateFoundationG1Coverage === 'function'
          ? g1ScheduleCore.evaluateFoundationG1Coverage(candidate, gameCatalog?.races || [], {
              server: 'zh_tw',
              automationMode: state.breedingAutomationMode,
              // Keep the foundation score on the stable A-rank baseline.  The
              // separate projected route may relax to C without relabelling a
              // probabilistic low-aptitude race as native foundation coverage.
              strictAptitude: true,
              defaultRequiredRank: lineageG1RoutePolicy.foundationCoverageBaselineRank || 'A',
              defaultRequirementLevel: lineageG1RoutePolicy.defaultRequirementLevel || 'RECOMMENDED',
              projectedG1RequirementLevel: lineageG1RoutePolicy.projectedG1RequirementLevel || 'RECOMMENDED'
            })
        : null;
      candidate.foundationG1RoutePlan = lineageFoundationRoutePlanForCard(card);
      if (foundationOnly
        && (!candidate.foundationG1Coverage
          || candidate.foundationG1Coverage.aptitudeInput?.complete !== true)) return null;
      return candidate;
    })
    .filter(Boolean);
}

function lineageFoundationCandidatePool() {
  return lineageCandidatePool({ foundationOnly: true });
}

function lineageAptitudeRequirements(battleCard = selectedBattleUmaCard()) {
  const context = activeRaceStrategy()?.context || {};
  const distance = {
    1: ['short', '短距離'],
    2: ['mile', '一哩'],
    3: ['medium', '中距離'],
    4: ['long', '長距離']
  }[Number(context.distance_type)];
  const ground = {
    1: ['turf', '草地'],
    2: ['dirt', '泥地']
  }[Number(context.ground_type)];
  const distanceRank = battleCard?.aptitude?.[Number(context.distance_type) + 1] || '';
  const groundRank = battleCard?.aptitude?.[Math.max(0, Number(context.ground_type) - 1)] || '';
  return [
    distance && {
      key: distance[0],
      label: `${distance[1]}適性`,
      nativeRank: distanceRank,
      requestedRank: 'A',
      requirementLevel: 'RULE_REQUIRED',
      requiredForAutonomous: true
    },
    ground && {
      key: ground[0],
      label: `${ground[1]}適性`,
      nativeRank: groundRank,
      requestedRank: 'A',
      requirementLevel: 'RULE_REQUIRED',
      requiredForAutonomous: true
    }
  ].filter(Boolean);
}

function lineageFoundationCoverageForCard(card, extra = {}) {
  if (!card || typeof g1ScheduleCore?.evaluateFoundationG1Coverage !== 'function') return null;
  return g1ScheduleCore.evaluateFoundationG1Coverage({
    id: `outfit:${Number(card.id)}`,
    outfitId: Number(card.id),
    characterId: Number(card.characterId),
    nameZhTw: card.nameZhTw || card.name,
    nameJp: card.nameJp,
    aptitude: Array.isArray(card.aptitude) ? [...card.aptitude] : []
  }, gameCatalog?.races || [], {
    server: 'zh_tw',
    automationMode: state.breedingAutomationMode,
    strictAptitude: true,
    defaultRequiredRank: lineageG1RoutePolicy.foundationCoverageBaselineRank || 'A',
    defaultRequirementLevel: lineageG1RoutePolicy.defaultRequirementLevel || 'RECOMMENDED',
    projectedG1RequirementLevel: lineageG1RoutePolicy.projectedG1RequirementLevel || 'RECOMMENDED',
    ...extra
  });
}

function lineageFoundationRoutePlanForCard(card) {
  if (!card || typeof g1ScheduleCore?.evaluateG1FoundationRoutes !== 'function') return null;
  const key = Number(card.id);
  if (lineageG1FoundationRouteCache.has(key)) return lineageG1FoundationRouteCache.get(key);
  const goalSchedule = Number.isFinite(Number(card.characterId))
    ? factorExecutionCore?.scheduleForCharacter?.(goalRaceSchedules, Number(card.characterId)) || null
    : null;
  const result = g1ScheduleCore.evaluateG1FoundationRoutes({
    candidate: {
      id: `outfit:${key}`,
      outfitId: key,
      characterId: Number(card.characterId),
      nameZhTw: card.nameZhTw || card.name,
      nameJp: card.nameJp,
      aptitude: Array.isArray(card.aptitude) ? [...card.aptitude] : []
    },
    goalSchedule,
    raceCatalog: gameCatalog?.races || [],
    desiredBuckets: ['turf-mile', 'turf-medium'],
    routeRequiredRank: 'C',
    server: 'zh_tw'
  });
  lineageG1FoundationRouteCache.set(key, result);
  return result;
}

function lineagePlanInput() {
  const battleCard = selectedBattleUmaCard();
  if (!battleCard) return null;
  const trainee = inventoryTraineeByOutfitId.get(Number(battleCard.id));
  const character = characterById.get(Number(battleCard.characterId));
  const aptitudeRequirements = lineageAptitudeRequirements(battleCard);
  return {
    battleCard,
    target: {
      id: 'target',
      outfitId: Number(battleCard.id),
      characterId: Number(battleCard.characterId),
      affinityKey: trainee?.affinityKey || character?.jp_name || battleCard.nameJp,
      nameZhTw: battleCard.nameZhTw || battleCard.name,
      outfitTitleZhTw: battleCard.titleZhTw || battleCard.title,
      imagePath: traineePortraitPath(battleCard),
      // The schedule core requires all six native aptitude axes.  Keep the
      // original card array, rather than reducing it to a scalar rank score.
      aptitude: Array.isArray(battleCard.aptitude) ? [...battleCard.aptitude] : [],
      aptitudeRequirements,
      foundationG1Coverage: lineageFoundationCoverageForCard(battleCard),
      foundationG1RoutePlan: lineageFoundationRoutePlanForCard(battleCard)
    },
    candidates: lineageCandidatePool(),
    foundationCandidates: lineageFoundationCandidatePool(),
    directParentSkillIds: [state.main, state.sub].filter(hasSelectedParentId).map(Number),
    factorTargets: reverseLineageFactorTargets(),
    affinityData: affinity,
    raceCatalog: gameCatalog?.races || [],
    breederRecordByStep: state.lineageBreederRecordBindings,
    breederRecords: breeders,
    aptitudeRequirements,
    lineageDecisionPolicy,
    inheritanceProbabilityModel: factorRunStrategy?.inheritanceProbabilityModel || null,
    automationMode: state.breedingAutomationMode,
    breedingAutomationMode: state.breedingAutomationMode,
    server: 'zh_tw'
  };
}

function lineageRedFactorEntries(value) {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value.flatMap(lineageRedFactorEntries);
  if (typeof value !== 'object') return [{ key: value, stars: 0 }];
  if (Array.isArray(value.factors)) return lineageRedFactorEntries(value.factors);
  if (value.byKey && typeof value.byKey === 'object') return lineageRedFactorEntries(Object.values(value.byKey));
  if (value.key != null || value.type != null || value.aptitudeKey != null || value.redFactorKey != null) {
    return [value];
  }
  return Object.entries(value).map(([key, item]) => (
    item && typeof item === 'object' ? { ...item, key: item.key ?? key } : { key, stars: item }
  ));
}

function lineageOutgoingRedFactors(candidate) {
  const source = candidate?.outgoingRedFactors
    ?? candidate?.outgoingRedFactor
    ?? candidate?.redFactors
    ?? candidate?.redFactor
    ?? candidate?.factors?.red;
  return lineageRedFactorEntries(source);
}

function lineageIncomingRedFactors(candidate) {
  const source = candidate?.incomingRedFactors
    ?? candidate?.incomingRedFactor
    ?? candidate?.incomingRedPlan
    ?? candidate?.incomingRedByKey
    ?? candidate?.factors?.incomingRed;
  return lineageRedFactorEntries(source);
}

function lineageMatchingBreederRecords(step) {
  const outfitId = Number(step?.candidate?.outfitId);
  const characterId = Number(step?.candidate?.characterId);
  if (!Number.isFinite(outfitId) || !Number.isFinite(characterId)) return [];
  return (breeders || [])
    .filter(record => Number(record?.outfitId) === outfitId)
    .filter(record => Number(record?.characterId) === characterId)
    .slice()
    .sort((left, right) =>
      String(right?.updatedAt || '').localeCompare(String(left?.updatedAt || ''))
      || String(left?.name || '').localeCompare(String(right?.name || ''), 'zh-Hant')
    );
}

function lineageBoundBreederRecord(step) {
  const recordId = String(state.lineageBreederRecordBindings?.[step?.id] || '').trim();
  if (!recordId) return null;
  return lineageMatchingBreederRecords(step)
    .find(record => String(record?.id || '') === recordId) || null;
}

function pruneInvalidLineageRecordBindings(plan) {
  const steps = new Map((plan?.workOrder || []).map(step => [String(step.id), step]));
  let changed = false;
  for (const [stepId, recordId] of Object.entries(state.lineageBreederRecordBindings || {})) {
    const step = steps.get(String(stepId));
    const valid = step && lineageMatchingBreederRecords(step)
      .some(record => String(record?.id || '') === String(recordId));
    if (valid) continue;
    delete state.lineageBreederRecordBindings[stepId];
    changed = true;
  }
  return changed;
}

function lineageScheduleCandidates(plan, input) {
  const sourceById = new Map((input?.candidates || [])
    .filter(candidate => candidate?.id)
    .map(candidate => [String(candidate.id), candidate]));
  const stepById = new Map((plan?.workOrder || []).map(step => [step.id, step]));
  const outgoingByStepId = new Map();
  const slotStages = new Set(['parent', 'grandparent']);
  const candidates = [];

  for (const step of (plan?.workOrder || []).slice().sort((left, right) => left.order - right.order)) {
    const selected = step.candidate || {};
    const isTarget = step.id === 'target';
    const source = isTarget
      ? input.target
      : sourceById.get(String(selected.id)) || selected;
    const ownIncoming = lineageIncomingRedFactors(source);
    const inheritedIncoming = (step.dependsOn || []).flatMap(dependencyId =>
      (outgoingByStepId.get(dependencyId) || []).map(factor => ({
        ...factor,
        sourceStepId: dependencyId,
        sourceStepIds: [...new Set([
          ...(factor?.sourceStepIds || []),
          dependencyId
        ])],
        evidenceStatus: factor?.evidenceStatus || 'USER_RECORDED'
      }))
    );
    const boundRecord = lineageBoundBreederRecord(step);
    const outgoing = (step?.factorFlow?.observedOutputs?.red || []).map(factor => ({
      ...factor,
      sourceStepId: step.id,
      sourceStepIds: [...new Set([...(factor?.sourceStepIds || []), step.id])],
      evidenceStatus: 'USER_RECORDED'
    }));
    const slot = slotStages.has(step.stage) && selected.slot
      ? selected.slot
      : (isTarget ? 'target' : `work:${step.id}`);
    const aptitude = Array.isArray(source?.aptitude)
      ? [...source.aptitude]
      : (Array.isArray(selected?.aptitude) ? [...selected.aptitude] : []);
    const scheduleCandidate = {
      ...source,
      // Schedule identities are per construction step.  A reused foundation
      // material must not overwrite another step's schedule contract.
      id: `schedule:${step.id}`,
      slot,
      stepId: step.id,
      nameZhTw: source?.nameZhTw || selected?.nameZhTw || step.label,
      outfitId: Number(source?.outfitId ?? selected?.outfitId),
      characterId: Number(source?.characterId ?? selected?.characterId),
      aptitude,
      selectionBasis: step?.selectionBasis || selected?.selectionBasis || source?.selectionBasis || null,
      baseAffinity: Number.isFinite(Number(step?.selectionBasis?.targetAffinity))
        ? Number(step.selectionBasis.targetAffinity)
        : null,
      goalSchedule: Number.isFinite(Number(source?.characterId ?? selected?.characterId))
        ? factorExecutionCore?.scheduleForCharacter?.(
            goalRaceSchedules,
            Number(source?.characterId ?? selected?.characterId)
          ) || null
        : null,
      incomingRedFactors: [...ownIncoming, ...inheritedIncoming],
      outgoingRedFactors: outgoing,
      outgoingRedFactor: outgoing[0] || null,
      g1Wins: normalizedG1EvidenceList(boundRecord?.g1Wins),
      projectedG1Schedule: normalizedProjectedG1Schedule(boundRecord?.projectedG1Schedule),
      automationMode: state.breedingAutomationMode
    };
    candidates.push(scheduleCandidate);
    outgoingByStepId.set(step.id, outgoing);
  }
  return candidates;
}

function lineageStrongerRequirementLevel(left, right) {
  const levels = ['OPTIONAL', 'RECOMMENDED', 'USER_REQUIRED', 'RULE_REQUIRED'];
  const normalized = [left, right]
    .map(value => String(value || 'RECOMMENDED').trim().toUpperCase())
    .filter(value => levels.includes(value));
  return normalized.sort((a, b) => levels.indexOf(b) - levels.indexOf(a))[0] || 'RECOMMENDED';
}

function lineageRecommendedBlueFactor() {
  const recommendation = activeFactorPlan()?.blueFactor || {};
  const primary = String(recommendation.primary || '').trim();
  const nameZhTw = ['速度', '耐力', '力量', '根性', '賢能']
    .find(stat => primary.includes(stat));
  if (!nameZhTw) return null;
  return {
    key: nameZhTw,
    nameZhTw,
    requirementLevel: 'RECOMMENDED',
    note: `${primary}；${recommendation.detail || '依成品面板缺口調整。'}這是攻略建議，不是遊戲硬門檻。`
  };
}

function lineageFactorPlansFromSchedule(plan, scheduleByStep = {}) {
  const rowsByStep = new Map();
  const assignedRedKeyByStep = new Map();
  const chooseSourceSteps = (dependencyIds, factorKey, declaredSourceIds = []) => {
    const declared = declaredSourceIds.filter(id => dependencyIds.includes(id));
    if (declared.length) return declared.filter(id => {
      const assigned = assignedRedKeyByStep.get(id);
      return !assigned || assigned === factorKey;
    });
    const sameKey = dependencyIds.find(id => assignedRedKeyByStep.get(id) === factorKey);
    if (sameKey) return [sameKey];
    const free = dependencyIds.find(id => !assignedRedKeyByStep.has(id));
    return free ? [free] : [];
  };
  const append = (stepId, raw, childStep, metadata = {}) => {
    const factor = lineageRedFactorEntries(raw)[0];
    const key = String(factor?.key || factor?.type || factor?.nameZhTw || '').trim();
    if (!stepId || !key) return;
    if (!rowsByStep.has(stepId)) rowsByStep.set(stepId, new Map());
    const rows = rowsByStep.get(stepId);
    const existing = rows.get(key) || {
      key,
      nameZhTw: factor?.nameZhTw || factor?.label || factor?.name || key,
      requirementLevel: 'RECOMMENDED',
      collectiveRequiredStars: 0,
      collectiveMissingStars: 0,
      sourceStepIds: [],
      targetStepIds: []
    };
    existing.requirementLevel = lineageStrongerRequirementLevel(
      existing.requirementLevel,
      metadata.requirementLevel ?? factor?.requirementLevel
    );
    existing.collectiveRequiredStars = Math.max(
      Number(existing.collectiveRequiredStars) || 0,
      Number(metadata.collectiveRequiredStars ?? factor?.collectiveRequiredStars ?? factor?.requiredStars ?? factor?.stars) || 0
    );
    existing.collectiveMissingStars = Math.max(
      Number(existing.collectiveMissingStars) || 0,
      Number(metadata.collectiveMissingStars ?? factor?.missingStars) || 0
    );
    existing.requiredStars = Math.max(
      Number(existing.requiredStars) || 0,
      Number(metadata.requiredStars ?? factor?.requiredStars ?? factor?.stars) || 0
    ) || undefined;
    existing.stars = Math.max(Number(existing.stars) || 0, Number(metadata.stars ?? factor?.stars) || 0) || undefined;
    existing.sourceStepIds = [...new Set([
      ...existing.sourceStepIds,
      ...(metadata.sourceStepIds || factor?.sourceStepIds || [])
    ])];
    existing.targetStepIds = [...new Set([...existing.targetStepIds, childStep.id])];
    existing.assignmentStatus = metadata.assignmentStatus || existing.assignmentStatus || 'SOURCE_DECLARED';
    existing.note = metadata.note || `供 ${childStep.candidate?.nameZhTw || childStep.label || childStep.id} 使用；${
      existing.collectiveRequiredStars > 0
        ? `同一上游組合計需 ${existing.collectiveRequiredStars}★`
        : '星數由下一代入場門檻合計判定'
    }。`;
    rows.set(key, existing);
    assignedRedKeyByStep.set(stepId, key);
  };

  for (const childStep of (plan?.workOrder || [])) {
    const override = scheduleByStep?.[childStep.id]
      || scheduleByStep?.[childStep.candidate?.slot]
      || scheduleByStep?.[childStep.candidate?.id]
      || null;
    if (!override || !(childStep.dependsOn || []).length) continue;
    const dependencyIds = [...new Set(childStep.dependsOn || [])];
    const supplied = lineageRedFactorEntries(override.incomingRedPlan);
    supplied.forEach(factor => {
      const declaredSources = [...new Set([
        ...(factor?.sourceStepIds || []),
        factor?.sourceStepId
      ].filter(id => dependencyIds.includes(id)))];
      const recipients = chooseSourceSteps(dependencyIds, String(factor?.key || factor?.type || factor?.nameZhTw || '').trim(), declaredSources);
      recipients.forEach(dependencyId => append(dependencyId, factor, childStep, {
        requirementLevel: factor?.requirementLevel,
        sourceStepIds: declaredSources,
        assignmentStatus: declaredSources.length ? 'SOURCE_DECLARED' : 'COLLECTIVE_UNASSIGNED',
        note: declaredSources.length
          ? `供 ${childStep.candidate?.nameZhTw || childStep.label || childStep.id} 使用；此來源由已綁定的上游紀錄指出。`
          : `供 ${childStep.candidate?.nameZhTw || childStep.label || childStep.id} 使用；上游來源尚未能由紀錄定位，不代表每一匹都要各自產出。`
      }));
    });

    lineageRedFactorEntries(override.incomingRedRequirements).forEach(factor => {
      const requiredStars = Math.max(0, Number(factor?.requiredStars ?? factor?.stars) || 0);
      const suppliedStars = Math.max(0, Number(factor?.suppliedStars ?? factor?.recordedStars) || 0);
      const missingStars = Math.max(
        0,
        Number.isFinite(Number(factor?.missingStars))
          ? Number(factor.missingStars)
          : requiredStars - suppliedStars
      );
      if (missingStars <= 0) return;
      const existingSources = [...new Set([
        ...(factor?.sourceStepIds || []),
        factor?.sourceStepId
      ].filter(id => dependencyIds.includes(id)))];
      const eligibleSources = dependencyIds.filter(id => !existingSources.includes(id));
      const factorKey = String(factor?.key || factor?.type || factor?.nameZhTw || '').trim();
      const recipients = chooseSourceSteps(
        eligibleSources.length ? eligibleSources : dependencyIds,
        factorKey,
        []
      );
      recipients.forEach(dependencyId => append(dependencyId, {
        ...factor,
        stars: Math.min(3, missingStars),
        requiredStars: Math.min(3, missingStars),
        suppliedStars: 0,
        requirementLevel: factor?.requirementLevel || 'RULE_REQUIRED'
      }, childStep, {
        requirementLevel: factor?.requirementLevel || 'RULE_REQUIRED',
        requiredStars: Math.min(3, missingStars),
        stars: Math.min(3, missingStars),
        collectiveRequiredStars: requiredStars,
        collectiveMissingStars: missingStars,
        sourceStepIds: recipients,
        assignmentStatus: 'COLLECTIVE_SOURCE_ASSIGNED',
        note: `供 ${childStep.candidate?.nameZhTw || childStep.label || childStep.id} 入場；這一輪負責「${factor?.nameZhTw || factor?.label || factorKey}」，本體紅因子目標最多 ${Math.min(3, missingStars)}★。同一上游組合合計需 ${requiredStars}★，其餘星數仍要由同一組合的其他成員承擔。`
      }));
    });
  }

  const blue = lineageRecommendedBlueFactor();
  return Object.fromEntries((plan?.workOrder || []).map(step => [
    step.id,
    {
      ...(blue ? { blue: { ...blue } } : {}),
      red: [...(rowsByStep.get(step.id)?.values() || [])]
    }
  ]));
}

function lineageFoundationScheduleBuckets(routeId) {
  const buckets = ['turf-mile', 'turf-medium'];
  if (String(routeId || '') === 'classic_crown') buckets.push('turf-long');
  return buckets;
}

function buildActiveReverseLineagePlan() {
  if (!lineagePlannerCore || !selectedBattleUmaCard()) return null;
  const input = lineagePlanInput();
  if (!input) return null;
  // First choose the actual direct-parent/grandparent/foundation slots.  The
  // G1 generator must never run across the broad candidate pool because that
  // would create schedules for mares not used in this construction.
  const selectedPlan = lineagePlannerCore.buildReverseLineagePlan(input);
  if (typeof g1ScheduleCore?.buildProjectedG1Schedule !== 'function') return selectedPlan;

  const selectedScheduleCandidates = lineageScheduleCandidates(selectedPlan, input);
  const provisionalG1FoundationPlan = typeof g1ScheduleCore?.planLineageG1Foundation === 'function'
    ? g1ScheduleCore.planLineageG1Foundation({
        raceCatalog: input.raceCatalog,
        candidates: selectedScheduleCandidates.filter(candidate => candidate.slot !== 'target'),
        desiredBuckets: ['turf-mile', 'turf-medium'],
        routeRequiredRank: 'C',
        server: 'zh_tw'
      })
    : null;
  const g1Schedule = g1ScheduleCore.buildProjectedG1Schedule({
    raceCatalog: input.raceCatalog,
    candidates: selectedScheduleCandidates,
    server: 'zh_tw',
    ruleset: g1ScheduleCore?.RULESET?.id || selectedPlan?.ruleset?.id,
    automationMode: state.breedingAutomationMode,
    strictAptitude: lineageG1RoutePolicy.strictAptitude !== false,
    defaultRequiredRank: lineageG1RoutePolicy.defaultRequiredRank || 'C',
    defaultRequirementLevel: lineageG1RoutePolicy.defaultRequirementLevel || 'RECOMMENDED',
    projectedG1RequirementLevel: lineageG1RoutePolicy.projectedG1RequirementLevel || 'RECOMMENDED',
    desiredBuckets: lineageFoundationScheduleBuckets(provisionalG1FoundationPlan?.recommendedRoute?.id),
    foundationRouteId: provisionalG1FoundationPlan?.recommendedRoute?.id || ''
  });
  const factorPlanByStep = lineageFactorPlansFromSchedule(
    selectedPlan,
    g1Schedule?.g1ScheduleByStep || {}
  );
  // Rebuild only after the per-step contract exists so lineage core can retain
  // its confirmed-G1 guards while the schedule core contributes projected rows.
  const finalPlan = lineagePlannerCore.buildReverseLineagePlan({
    ...input,
    ruleset: g1Schedule?.ruleset?.id || input.ruleset,
    g1ScheduleByStep: g1Schedule?.g1ScheduleByStep || {},
    factorPlanByStep
  });
  const finalScheduleCandidates = lineageScheduleCandidates(finalPlan, input);
  const g1FoundationPlan = typeof g1ScheduleCore?.planLineageG1Foundation === 'function'
    ? g1ScheduleCore.planLineageG1Foundation({
        raceCatalog: input.raceCatalog,
        candidates: finalScheduleCandidates.filter(candidate => candidate.slot !== 'target'),
        desiredBuckets: ['turf-mile', 'turf-medium'],
        routeRequiredRank: 'C',
        server: 'zh_tw',
        ruleset: g1ScheduleCore?.RULESET?.id || input.ruleset
      })
    : null;
  const g1FoundationPlanByStep = Object.fromEntries(
    (g1FoundationPlan?.candidatePlans || [])
      .map(candidatePlan => [String(candidatePlan.candidateId || '').replace(/^schedule:/, ''), candidatePlan])
      .filter(([stepId]) => stepId)
  );
  return {
    ...finalPlan,
    g1Schedule,
    g1ScheduleByStep: g1Schedule?.g1ScheduleByStep || {},
    g1CandidatePlansById: g1Schedule?.candidatePlansById || {},
    g1ScheduleEdges: g1Schedule?.edgeSchedules || [],
    factorPlanByStep,
    g1ScheduleWarnings: g1Schedule?.warnings || [],
    g1FoundationPlan,
    g1FoundationPlanByStep
  };
}

function factorTargetChips(targets, limit = 6) {
  const values = (targets || []).slice(0, limit);
  return values.length
    ? values.map(target => `<span>${escapeHtml(target.nameZhTw || localizedSkillName(target.id))}</span>`).join('')
    : '<span>尚未指定白／綠因子</span>';
}

function lineageSlotLabel(slot) {
  return {
    parentA: '直接親代 A',
    parentB: '直接親代 B',
    parentA1: '祖代 A1',
    parentA2: '祖代 A2',
    parentB1: '祖代 B1',
    parentB2: '祖代 B2'
  }[String(slot || '')] || String(slot || '下一代槽位');
}

function lineageFieldForStep(step, plan, field) {
  const direct = step?.[field] ?? step?.candidate?.[field];
  if (direct !== undefined && direct !== null) return direct;
  const schedule = lineageScheduleOverrideForStep(step, plan);
  if (schedule?.[field] !== undefined && schedule?.[field] !== null) return schedule[field];
  const value = plan?.[field];
  if (value === undefined || value === null || Array.isArray(value) || typeof value !== 'object') {
    return value ?? null;
  }
  const keys = [step?.id, step?.slot, step?.candidate?.slot, step?.candidate?.id]
    .filter(Boolean)
    .map(String);
  for (const key of keys) {
    if (value[key] !== undefined && value[key] !== null) return value[key];
  }
  for (const container of ['byStep', 'steps', 'bySlot', 'slots']) {
    const nested = value[container];
    if (!nested || typeof nested !== 'object') continue;
    for (const key of keys) {
      if (nested[key] !== undefined && nested[key] !== null) return nested[key];
    }
  }
  return null;
}

function lineageScheduleOverrideForStep(step, plan) {
  const schedules = plan?.g1ScheduleByStep || plan?.g1Schedule?.g1ScheduleByStep;
  if (!schedules || typeof schedules !== 'object' || Array.isArray(schedules)) return null;
  const keys = [step?.id, step?.slot, step?.candidate?.slot, step?.candidate?.id]
    .filter(Boolean)
    .map(String);
  for (const key of keys) {
    if (schedules[key] !== undefined && schedules[key] !== null) return schedules[key];
  }
  return null;
}

function lineageValueText(value) {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (!value || typeof value !== 'object') return '';
  const primary = value.label
    ?? value.nameZhTw
    ?? value.name
    ?? value.raceNameZhTw
    ?? value.raceName
    ?? value.title
    ?? value.description
    ?? value.requirement
    ?? (value.canonicalRaceId != null ? `賽事 ${value.canonicalRaceId}` : null)
    ?? value.status;
  if (primary === undefined || primary === null || primary === '') return '';
  const status = value.status && value.status !== primary ? `（${value.status}）` : '';
  return `${primary}${status}`;
}

function lineageValueList(value, limit = 6) {
  if (value === undefined || value === null) return [];
  const values = Array.isArray(value)
    ? value
    : typeof value === 'object'
      ? value.items || value.entries || value.races || value.requirements || value.schedule || value.values || [value]
      : [value];
  return values
    .flatMap(item => Array.isArray(item) ? item : [item])
    .map(lineageValueText)
    .filter(Boolean)
    .slice(0, limit);
}

function lineageG1ChipMarkup(candidate, step, plan) {
  const schedule = lineageScheduleOverrideForStep(step, plan);
  const confirmedContract = lineageFieldForStep(step, plan, 'g1ScheduleConfirmed');
  const projectedContract = lineageFieldForStep(step, plan, 'g1ScheduleProjected');
  const confirmed = lineageValueList(confirmedContract, 2);
  const projected = lineageValueList(
    schedule?.projectedG1Schedule ?? schedule?.projected ?? projectedContract,
    2
  );
  const chips = [
    ...confirmed.map(value => `G1 已登錄：${value}`),
    ...projected.map(value => `G1 預計：${value}`)
  ];
  if (!chips.length && confirmedContract?.status) {
    chips.push(`G1 已登錄：${confirmedContract.status}`);
  }
  if (!chips.length && (schedule?.status || projectedContract?.status)) {
    chips.push(`G1 預計：${schedule?.status || projectedContract.status}`);
  }
  if (!chips.length && Number.isFinite(Number(candidate?.g1Breadth))) {
    chips.push(`G1 廣度代理：${Number(candidate.g1Breadth)}`);
  }
  return chips.map(value => `<span class="lineage-g1-chip">${escapeHtml(value)}</span>`).join('')
    || '<span class="lineage-g1-chip is-pending">G1 賽程待確認</span>';
}

function lineageFoundationProfile(candidate, step, plan) {
  return candidate?.foundationG1Coverage
    || lineageScheduleOverrideForStep(step, plan)?.foundationG1Coverage
    || null;
}

function lineageG1FoundationForStep(step, plan) {
  const family = plan?.g1FoundationPlan || null;
  const candidatePlan = plan?.g1FoundationPlanByStep?.[step?.id] || null;
  const routeId = family?.recommendedRoute?.id || candidatePlan?.recommendedRoute?.id || '';
  return {
    family,
    candidatePlan,
    route: candidatePlan?.routes?.[routeId] || candidatePlan?.recommendedRoute || null,
    dirtDecision: candidatePlan?.dirtDecision || null
  };
}

function lineageAptitudeText(candidate) {
  const labels = [
    ['turf', '草'],
    ['dirt', '泥'],
    ['mile', '英'],
    ['medium', '中'],
    ['long', '長']
  ];
  const raw = candidate?.aptitude;
  const map = raw && !Array.isArray(raw) ? raw : {};
  const arrayIndexes = { turf: 0, dirt: 1, mile: 3, medium: 4, long: 5 };
  return labels.map(([key, label]) => {
    const rank = String(Array.isArray(raw) ? raw[arrayIndexes[key]] || '' : map[key] || '').toUpperCase();
    if (!rank) return `${label} 未提供（不可判定）`;
    if (rank === 'A' || rank === 'S') return `${label} ${rank}（原生）`;
    return `${label} ${rank}（需紅因子補）`;
  }).join('；');
}

function lineageFoundationG1Text(candidate, step, plan) {
  const routePlan = lineageG1FoundationForStep(step, plan);
  if (routePlan.route) {
    const races = (routePlan.route.races || []).map(row => row.nameZhTw).filter(Boolean);
    const redAxes = (routePlan.route.requiredRedAxes || [])
      .map(axis => `${axis.label || axis.key} ${Number(axis.requiredIncomingRedStars) || '?'}★`);
    const aptitude = routePlan.route.unprovenAxes?.length
      ? `；${routePlan.route.unprovenAxes.map(axis => axis.label || axis.key).join('、')}適性尚無法證明`
      : redAxes.length
        ? `；入場前需由上游合計補 ${redAxes.join('、')}`
        : '；目前適性可直接採用';
    return `${routePlan.route.label}：${races.join('、') || '賽事資料待確認'}${aptitude}`;
  }
  const profile = lineageFoundationProfile(candidate, step, plan);
  if (!profile) return '原生待計算；補紅因子後待計算';
  const native = Number(profile.nativeCanonicalG1Count ?? profile.nativeCount ?? 0);
  const expanded = Number(
    profile.oneStarExpandedCanonicalG1Count
    ?? profile.oneStarExpandedCount
    ?? native + Number(profile.oneStarExpandableCount || 0)
  );
  const redAxes = (profile.requiredRedAxes || profile.requiredRedFactors || [])
    .map(axis => `${axis.label || axis.nameZhTw || axis.key || '紅因子'} ${Number(axis.requiredStars || axis.explicitStars || 1)}★`)
    .filter(Boolean);
  return `原生 ${native} 場；${redAxes.length ? `補 ${redAxes.join('、')} 後可到 ${expanded} 場` : `不需額外紅因子時仍為 ${expanded} 場`}`;
}

function lineageSelectionReasonItems(candidate, role, targets = []) {
  const selection = candidate?.selectionReason;
  if (Array.isArray(selection)) return selection.filter(Boolean);
  if (Array.isArray(selection?.items) && selection.items.length) return selection.items.filter(Boolean);
  const basis = candidate?.selectionBasis || {};
  const stage = basis.stage || (role.includes('直接') ? 'direct-parent' : role.includes('祖代') ? 'grandparent' : 'foundation');
  if (stage === 'direct-parent') {
    return [
      `繼承固有：${candidate?.uniqueSkillName || localizedSkillName(candidate?.uniqueSkillId) || '待確認'}`,
      `最終戰馬基礎相性：${Number.isFinite(Number(basis.targetAffinity)) ? basis.targetAffinity : '未解析'}`,
      `賽道／固有價值：${Number(candidate?.courseScore || 0).toFixed(1)}`
    ];
  }
  if (stage === 'grandparent') {
    return [
      `本支系因子：${factorTargetChipsText(targets)}`,
      `直屬親代相性：${Number.isFinite(Number(basis.parentAffinity)) ? basis.parentAffinity : '未解析'}`,
      `最終戰馬基礎相性：${Number.isFinite(Number(basis.targetAffinity)) ? basis.targetAffinity : '未解析'}`
    ];
  }
  return [
    `GⅠ底座：${lineageFoundationG1Text(candidate, null, null)}`,
    `紅因子需求：${(candidate?.foundationG1Coverage?.requiredRedAxes || []).map(axis => `${axis.label || axis.key} 1★`).join('、') || '不需額外紅因子'}`,
    `本支系因子：${factorTargetChipsText(targets)}`
  ];
}

function factorTargetChipsText(targets) {
  return (targets || []).map(target => target?.nameZhTw || localizedSkillName(target?.id)).filter(Boolean).join('、') || '未指定';
}

function lineageStepTakeText(step, plan, targets = []) {
  const candidate = step?.candidate || {};
  const flow = step?.factorFlow || {};
  const outputs = flow.plannedOutputs || {};
  const pieces = [];
  const uniqueSkill = candidate.uniqueSkillName || (Number.isFinite(Number(candidate.uniqueSkillId))
    ? localizedSkillName(candidate.uniqueSkillId)
    : '');
  if (uniqueSkill) pieces.push(`${step?.stage === 'parent' ? '固有' : '固有抽選'}：${uniqueSkill}`);
  const factorItems = [
    ...(outputs.blue && outputs.blue.status !== 'UNSPECIFIED'
      ? [`藍：${outputs.blue.nameZhTw || outputs.blue.key || '已指定藍因子'}`]
      : []),
    ...(outputs.red || []).map(value => `紅：${value.nameZhTw || value.key}`),
    ...(outputs.white || []).map(value => `白：${value.nameZhTw || localizedSkillName(value.skillId)}`),
    ...(outputs.green || []).map(value => `綠：${value.nameZhTw || localizedSkillName(value.skillId)}`)
  ];
  if (factorItems.length) pieces.push(...factorItems);
  if (!pieces.length && targets.length) pieces.push(`白／綠因子：${factorTargetChipsText(targets)}`);
  return pieces.join('；') || '本代產出目標尚未指定；請以下方施工契約為準';
}

function lineageQuickRedScope(step) {
  const red = step?.factorFlow?.plannedOutputs?.red || [];
  if (!red.length) return '';
  const factorName = item => item?.nameZhTw || item?.key || '未命名紅因子';
  const assigned = red.filter(item =>
    ['RULE_REQUIRED', 'USER_REQUIRED'].includes(String(item?.requirementLevel || '').toUpperCase())
    || String(item?.sourceStepId || '') === String(step?.id || '')
  );
  if (assigned.length) {
    return `本輪紅因子：${assigned.map(factorName).join('／')}。`;
  }
  const shared = red.map(item => {
    const stars = Number(item?.stars ?? item?.requiredStars);
    return `${factorName(item)}${Number.isFinite(stars) && stars > 0 ? ` ${stars}★` : ''}`;
  });
  return `家系仍有共同紅因子缺口：${shared.join('、')}；尚未分配到單一育成，本輪不會要求全部同時取得。`;
}

function lineageStepQuickTakeText(step, plan, targets = []) {
  const candidate = step?.candidate || {};
  const outputs = step?.factorFlow?.plannedOutputs || {};
  const pieces = [];
  const uniqueSkill = candidate.uniqueSkillName || (Number.isFinite(Number(candidate.uniqueSkillId))
    ? localizedSkillName(candidate.uniqueSkillId)
    : '');
  if (uniqueSkill) pieces.push(`${step?.stage === 'parent' ? '固有' : '固有抽選'}：${uniqueSkill}`);
  if (outputs.blue && outputs.blue.status !== 'UNSPECIFIED') {
    pieces.push(`藍：${outputs.blue.nameZhTw || outputs.blue.key || '已指定藍因子'}`);
  }
  const assignedRed = (outputs.red || []).filter(item =>
    ['RULE_REQUIRED', 'USER_REQUIRED'].includes(String(item?.requirementLevel || '').toUpperCase())
    || String(item?.sourceStepId || '') === String(step?.id || '')
  );
  if (assignedRed.length) {
    pieces.push(`紅：${assignedRed.map(item => item.nameZhTw || item.key).join('／')}`);
  }
  const whiteAndGreen = [
    ...(outputs.white || []).map(value => `白：${value.nameZhTw || localizedSkillName(value.skillId)}`),
    ...(outputs.green || []).map(value => `綠：${value.nameZhTw || localizedSkillName(value.skillId)}`)
  ].filter(Boolean);
  pieces.push(...whiteAndGreen.slice(0, 4));
  if (whiteAndGreen.length > 4) pieces.push(`另 ${whiteAndGreen.length - 4} 項建議`);
  if (!pieces.length && targets.length) pieces.push(`白／綠因子：${factorTargetChipsText(targets)}`);
  return pieces.join('；') || '本代產出目標尚未指定；請打開本輪查看施工契約';
}

function lineageCandidateCard(candidate, role, targets = [], extra = '', context = {}) {
  if (!candidate) return '<article class="lineage-candidate is-missing"><strong>候選不足</strong><small>需要人工指定</small></article>';
  const summaryOnly = Boolean(context.summaryOnly);
  const reasonItems = lineageSelectionReasonItems(candidate, role, targets);
  const takeText = lineageStepTakeText(context.step, context.plan, targets);
  const relationship = extra || lineageStepSupplyText(context.step || {});
  return `<article class="lineage-candidate">
    ${traineePortraitMarkup(candidate)}
    <div class="lineage-candidate-copy">
      <span>${escapeHtml(role)}</span>
      <strong>${escapeHtml(candidate.nameZhTw)} ${escapeHtml(candidate.outfitTitleZhTw || '')}</strong>
      <small>${escapeHtml(candidate.uniqueSkillName || localizedSkillName(candidate.uniqueSkillId))}</small>
      ${summaryOnly
        ? `<p>關係摘要：${escapeHtml(relationship)}</p>`
        : `<section class="lineage-selection-reason"><strong>為何選牠</strong><span>${escapeHtml(reasonItems.join('；'))}</span></section>
           <section class="lineage-step-take"><strong>本步要拿</strong><span>${escapeHtml(takeText)}</span></section>
           ${candidate.buildNote ? `<p>${escapeHtml(candidate.buildNote)}</p>` : ''}
           ${extra ? `<p>${escapeHtml(extra)}</p>` : ''}
           <div class="lineage-factor-chips">${factorTargetChips(targets)}${lineageG1ChipMarkup(candidate, context.step, context.plan)}</div>`}
    </div>
  </article>`;
}

function lineageStepSupplyText(step) {
  if (step.stage === 'foundation') {
    const slots = (step.reusedFor || []).map(lineageSlotLabel);
    return slots.length ? `供應 ${slots.join('、')}` : '供應後續祖代素材';
  }
  if (step.stage === 'grandparent') {
    return `供應 ${step.candidate?.branch === 'B' ? '直接親代 B' : '直接親代 A'} 的祖代槽`;
  }
  if (step.stage === 'parent') return '供應最終戰馬的直接親代槽';
  return '完成最終戰馬育成';
}

function lineageDependencyText(step, plan) {
  if (step?.stage === 'foundation') return '起點素材：可直接開養';
  const byId = new Map((plan?.workOrder || []).map(item => [item.id, item]));
  const dependencies = (step?.dependsOn || []).map(id => {
    const dependency = byId.get(id);
    return dependency?.candidate?.nameZhTw
      ? `${dependency.id}（${dependency.candidate.nameZhTw}）`
      : id;
  }).filter(Boolean);
  return dependencies.length
    ? `先完成 ${dependencies.join('、')}`
    : '沒有前置步驟，直接開養';
}

function lineageStepFactorRequirements(step, plan) {
  const targets = step?.targets || step?.candidate?.factorTargets || [];
  const white = targets
    .filter(target => !['green', 'red'].includes(String(target?.kind || '').toLowerCase()))
    .map(target => target?.nameZhTw || localizedSkillName(target?.id))
    .filter(Boolean);
  const green = targets
    .filter(target => String(target?.kind || '').toLowerCase() === 'green')
    .map(target => target?.nameZhTw || localizedSkillName(target?.id))
    .filter(Boolean);
  const schedule = lineageScheduleOverrideForStep(step, plan);
  const factorLabel = (factor, prefix) => {
    const label = factor?.label || factor?.nameZhTw || factor?.name || factor?.key || '未命名紅因子';
    const stars = Number(factor?.stars);
    const requiredStars = Number(factor?.requiredStars);
    const suppliedStars = Number(factor?.suppliedStars);
    if (Number.isFinite(requiredStars)) {
      return `${prefix}${label} 需 ${requiredStars}★${Number.isFinite(suppliedStars) ? `／已 ${suppliedStars}★` : ''}`;
    }
    return `${prefix}${label}${Number.isFinite(stars) ? ` ${stars}★` : ''}`;
  };
  const incoming = lineageRedFactorEntries(schedule?.incomingRedPlan)
    .map(factor => factorLabel(factor, '入場←上游：'));
  const unsatisfied = lineageRedFactorEntries(schedule?.incomingRedRequirements)
    .map(factor => factorLabel(factor, '尚缺上游：'));
  const outgoing = lineageRedFactorEntries(schedule?.outgoingRedFactors ?? schedule?.outgoingRedFactor)
    .map(factor => factorLabel(factor, '產出→下代：'));
  const suppliedRed = lineageValueList(lineageFieldForStep(step, plan, 'redFactorRequirements'));
  // When the schedule core is present, its incoming/outgoing contract is the
  // only red-factor source.  Do not repeat the target's red goal on every step.
  const red = schedule
    ? [...incoming, ...unsatisfied, ...outgoing]
    : suppliedRed;
  return { red, white, green };
}

function lineageRequirementsMarkup(step, plan) {
  const requirements = lineageStepFactorRequirements(step, plan);
  const chips = values => values.length
    ? values.map(value => `<span>${escapeHtml(value)}</span>`).join('')
    : '<span class="is-pending">未指定</span>';
  return `<section class="lineage-step-requirements" aria-label="本步因子需求">
    <div><strong>紅</strong><span>${chips(requirements.red)}</span></div>
    <div><strong>白</strong><span>${chips(requirements.white)}</span></div>
    <div><strong>綠</strong><span>${chips(requirements.green)}</span></div>
  </section>`;
}

function lineageFactorTypeLabel(type) {
  return {
    blue: '藍因子',
    red: '紅因子',
    white: '白因子',
    green: '綠因子'
  }[String(type || '').toLowerCase()] || '因子';
}

function lineageRequirementLevelLabel(level) {
  return {
    RULE_REQUIRED: '規則必要',
    USER_REQUIRED: '本次施工必要',
    RECOMMENDED: '攻略建議',
    OPTIONAL: '可選強化'
  }[String(level || '').toUpperCase()] || '待分類';
}

function lineageFactorStatusLabel(status) {
  return {
    SATISFIED: '已由上游登錄紀錄滿足',
    USER_RECORDED: '已登錄（使用者紀錄）',
    MISSING: '尚缺',
    DEPENDENT_UNVERIFIED: '上游有規劃，但尚未綁定可用紀錄',
    PLANNED_MISSING: '待抽取／待登錄',
    UNSPECIFIED: '尚未指定',
    NONE: '尚無紀錄'
  }[String(status || '').toUpperCase()] || String(status || '待確認');
}

function lineageFactorIdentity(item, type = item?.type) {
  if (!item) return '';
  const skillId = Number(item.skillId);
  if (Number.isFinite(skillId)) return `${type}:skill:${skillId}`;
  const key = String(item.key || item.nameZhTw || '').trim().toLowerCase();
  return key ? `${type}:key:${key}` : '';
}

function lineageFactorName(item, type = item?.type) {
  if (!item) return `${lineageFactorTypeLabel(type)}未指定`;
  if (Number.isFinite(Number(item.skillId))) {
    return item.nameZhTw || localizedSkillName(Number(item.skillId));
  }
  return item.nameZhTw || item.label || item.name || item.key || `${lineageFactorTypeLabel(type)}未指定`;
}

function lineageStepNameById(plan, stepId) {
  const step = (plan?.workOrder || []).find(item => String(item.id) === String(stepId));
  return step?.candidate?.nameZhTw
    ? `${step.id}（${step.candidate.nameZhTw}）`
    : String(stepId || '未指定上游');
}

function lineageFactorRowMarkup(item, type, plan, options = {}) {
  const status = String(item?.status || options.status || '').toUpperCase() || 'NONE';
  const requirementLevel = String(item?.requirementLevel || 'OPTIONAL').toUpperCase();
  const evidenceStatus = String(item?.evidenceStatus || 'NONE').toUpperCase();
  const gate = String(options.gate || 'none').toLowerCase();
  const requiredStars = Number(item?.requiredStars);
  const collectiveRequiredStars = Number(item?.collectiveRequiredStars);
  const collectiveMissingStars = Number(item?.collectiveMissingStars);
  const suppliedStars = Number(item?.suppliedStars ?? item?.stars);
  const sourceStepIds = [...new Set([
    ...(item?.sourceStepIds || []),
    item?.sourceStepId
  ].filter(Boolean))];
  const targetStepIds = [...new Set([
    ...(item?.targetStepIds || []),
    item?.targetStepId
  ].filter(Boolean))];
  const details = [
    Number.isFinite(requiredStars) ? `需 ${requiredStars}★` : '',
    Number.isFinite(suppliedStars) && status !== 'PLANNED_MISSING'
      ? `本紀錄 ${suppliedStars}★`
      : '',
    Number.isFinite(collectiveRequiredStars) && collectiveRequiredStars > 0
      ? `上游組合合計需 ${collectiveRequiredStars}★`
      : '',
    Number.isFinite(collectiveMissingStars) && collectiveMissingStars > 0
      ? `上游組合尚缺 ${collectiveMissingStars}★`
      : '',
    item?.assignmentStatus === 'COLLECTIVE_UNASSIGNED'
      ? '共同缺口尚未分配，不代表每個上游都要各自補滿'
      : '',
    sourceStepIds.length
      ? `來源：${sourceStepIds.map(id => lineageStepNameById(plan, id)).join('、')}`
      : '',
    targetStepIds.length
      ? `供應：${targetStepIds.map(id => lineageStepNameById(plan, id)).join('、')}`
      : '',
    item?.note || ''
  ].filter(Boolean);
  return `<article class="lineage-factor-row" data-factor-type="${escapeHtml(type)}" data-factor-status="${escapeHtml(status)}" data-requirement-level="${escapeHtml(requirementLevel)}" data-evidence-status="${escapeHtml(evidenceStatus)}" data-gate="${escapeHtml(gate)}">
    <div><span class="lineage-factor-kind">${escapeHtml(lineageFactorTypeLabel(type))}</span><strong>${escapeHtml(lineageFactorName(item, type))}</strong></div>
    <p>${escapeHtml(details.join('；') || '星數／來源尚未指定')}</p>
    <footer><span>${escapeHtml(lineageRequirementLevelLabel(item?.requirementLevel))}</span><b>${escapeHtml(lineageFactorStatusLabel(status))}</b></footer>
  </article>`;
}

function lineageBreederRecordSummary(record) {
  const values = [
    record?.blueFactor?.type ? `藍 ${record.blueFactor.type} ${Number(record.blueFactor.stars) || 0}★` : '',
    record?.redFactor?.type ? `紅 ${record.redFactor.type} ${Number(record.redFactor.stars) || 0}★` : '',
    (record?.whiteFactors || []).length ? `白 ${(record.whiteFactors || []).length} 項` : ''
  ].filter(Boolean);
  return values.join('・') || '尚未登錄因子內容';
}

function lineageRecordBindingMarkup(step) {
  const records = lineageMatchingBreederRecords(step);
  const bound = lineageBoundBreederRecord(step);
  const stepId = String(step?.id || '');
  const inputId = `lineageRecord-${stepId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  return `<div class="lineage-record-binding" data-binding-state="${bound ? 'bound' : 'unbound'}">
    <label for="${escapeHtml(inputId)}"><strong>本步實際種馬紀錄</strong><span>只有明確綁定到這一步的同衣裝紀錄，才會算作已產出；同衣裝舊紀錄不會自動套用。</span></label>
    <select id="${escapeHtml(inputId)}" data-lineage-record-select data-lineage-step-id="${escapeHtml(stepId)}">
      <option value="">${records.length ? '尚未綁定紀錄' : '沒有同衣裝紀錄可綁定'}</option>
      ${records.map(record => `<option value="${escapeHtml(record.id)}"${bound?.id === record.id ? ' selected' : ''}>${escapeHtml(record.name || `紀錄 ${record.id}`)}｜${escapeHtml(lineageBreederRecordSummary(record))}</option>`).join('')}
    </select>
    <small>${bound
      ? `已綁定「${escapeHtml(bound.name || bound.id)}」；這是使用者登錄紀錄，不是外部實戰驗證。`
      : records.length
        ? '請選擇這一次施工實際使用／產出的紀錄。'
        : '請先在「現有種馬庫」新增這個衣裝的實際育成結果。'}</small>
  </div>`;
}

function lineageRequirementIsHard(level, plan) {
  const hardLevels = plan?.decisionPolicy?.hardRequirementLevels || ['RULE_REQUIRED', 'USER_REQUIRED'];
  return hardLevels.includes(String(level || 'RECOMMENDED').toUpperCase());
}

function lineageIncomingFactorRows(step) {
  const flow = step?.factorFlow || {};
  const incoming = flow.incoming || {};
  return [
    ...(incoming.blue || []).map(item => ({ item, type: 'blue' })),
    ...(incoming.red || []).map(item => ({ item, type: 'red' })),
    ...(incoming.white || []).map(item => ({ item, type: 'white' }))
  ];
}

function lineagePlannedFactorRows(step) {
  const flow = step?.factorFlow || {};
  const planned = flow.plannedOutputs || {};
  const blue = planned.blue || { status: 'UNSPECIFIED', requirementLevel: 'OPTIONAL' };
  const plannedRows = [
    { item: { ...blue, type: 'blue' }, type: 'blue' },
    ...(planned.red || []).map(item => ({ item, type: 'red' })),
    ...(planned.white || []).map(item => ({ item, type: 'white' })),
    ...(planned.green || []).map(item => ({ item, type: 'green' }))
  ];
  const blueRecommendation = activeFactorPlan()?.blueFactor;
  if (blue.status === 'UNSPECIFIED') {
    plannedRows[0].item = {
      ...plannedRows[0].item,
      nameZhTw: '尚未指定藍因子目標',
      note: blueRecommendation?.primary
        ? `攻略偏好：${blueRecommendation.primary}。這是建議，不是遊戲硬門檻。`
        : '藍因子目標需由本次成品缺口決定；未指定不等於遊戲禁止開始。'
    };
  }
  return plannedRows;
}

function lineageFactorFlowParts(step, plan) {
  const observed = step?.factorFlow?.observedOutputs || {};
  const incomingRows = lineageIncomingFactorRows(step);
  const plannedRows = lineagePlannedFactorRows(step);
  const plannedIdentities = new Set(plannedRows.map(row => lineageFactorIdentity(row.item, row.type)).filter(Boolean));
  const observedRows = [
    ...(observed.blue ? [{ item: observed.blue, type: 'blue' }] : []),
    ...(observed.red || []).map(item => ({ item, type: 'red' })),
    ...(observed.white || []).map(item => ({ item, type: 'white' })),
    ...(observed.green || []).map(item => ({ item, type: 'green' }))
  ].filter(row => !plannedIdentities.has(lineageFactorIdentity(row.item, row.type)));
  return {
    incoming: `<div class="lineage-factor-flow"><section class="lineage-factor-flow-section" data-factor-flow-section="incoming" aria-label="上一代帶入的因子條件">
      <header><span>1</span><div><strong>上一代帶入的因子條件</strong><small>只看上游已綁定紀錄；硬門未達才阻塞開養，攻略建議未達可以接受。</small></div></header>
      <div class="lineage-factor-groups">${incomingRows.length
        ? incomingRows.map(row => lineageFactorRowMarkup(row.item, row.type, plan, { gate: 'start' })).join('')
        : '<p class="lineage-factor-empty">本步沒有已聲明的上游因子門檻，可以直接準備本代育成。</p>'}</div>
    </section></div>`,
    outputs: `<div class="lineage-factor-flow"><section class="lineage-factor-flow-section" data-factor-flow-section="outputs" aria-label="本代規劃產出的因子">
      <header><span>2</span><div><strong>本代要產出的因子</strong><small>先顯示施工目標，再用下方的實際種馬紀錄核對；計畫不等於已抽到。</small></div></header>
      ${lineageRecordBindingMarkup(step)}
      <div class="lineage-factor-groups">${[...plannedRows, ...observedRows]
        .map(row => lineageFactorRowMarkup(row.item, row.type, plan, { gate: 'handoff' }))
        .join('')}</div>
    </section></div>`
  };
}

function lineageMissionLabel(row) {
  const item = row?.item || row || {};
  return `${lineageFactorTypeLabel(row?.type || item.type)}・${lineageFactorName(item, row?.type || item.type)}`;
}

function lineageStepMissionMarkup(step, plan) {
  const incomingRows = lineageIncomingFactorRows(step);
  const plannedRows = lineagePlannedFactorRows(step);
  const projectedG1 = step?.g1ScheduleProjected?.races || [];
  const hard = [
    ...incomingRows
      .filter(row => lineageRequirementIsHard(row.item?.requirementLevel, plan))
      .map(row => `入場・${lineageMissionLabel(row)}`),
    ...plannedRows
    .filter(row => lineageRequirementIsHard(row.item?.requirementLevel, plan))
      .map(lineageMissionLabel)
  ];
  const compromises = [
    ...incomingRows
      .filter(row => !lineageRequirementIsHard(row.item?.requirementLevel, plan))
      .map(row => `入場建議・${lineageMissionLabel(row)}`),
    ...plannedRows
    .filter(row => !lineageRequirementIsHard(row.item?.requirementLevel, plan))
      .map(lineageMissionLabel)
  ];
  const hardG1Count = projectedG1.filter(race => lineageRequirementIsHard(race.requirementLevel, plan)).length;
  const recommendedG1Count = projectedG1.length - hardG1Count;
  if (hardG1Count) hard.push(`共同 GⅠ・${hardG1Count} 場硬性賽程`);
  if (recommendedG1Count) compromises.push(`共同 GⅠ・${recommendedG1Count} 場建議賽程（未全達成可接受）`);
  const unique = values => [...new Set(values.filter(Boolean))];
  const hardItems = unique(hard);
  const compromiseItems = unique(compromises);
  const chips = (items, fallback) => items.length
    ? items.map(item => `<li>${escapeHtml(item)}</li>`).join('')
    : `<li>${escapeHtml(fallback)}</li>`;
  return `<section class="lineage-step-mission" aria-label="本代取捨">
    <article data-mission-kind="hard"><span>不可妥協</span><strong>這代一定要做到</strong><ul>${chips(hardItems, '沒有新增硬性因子；仍須守住上游入場條件與合法 5+1 配卡。')}</ul></article>
    <article data-mission-kind="tradeoff"><span>期望值加分</span><strong>這代可以妥協</strong><ul>${chips(compromiseItems, '目前沒有額外推薦項；不必為了湊數增加周回成本。')}</ul></article>
  </section>`;
}

function lineageScheduleMarkup(step, plan) {
  const schedule = lineageScheduleOverrideForStep(step, plan);
  const confirmedContract = lineageFieldForStep(step, plan, 'g1ScheduleConfirmed') || {};
  const projectedContract = lineageFieldForStep(step, plan, 'g1ScheduleProjected') || {};
  const confirmed = lineageValueList(confirmedContract);
  const projected = lineageValueList(
    schedule?.projectedG1Schedule ?? schedule?.projected ?? projectedContract
  );
  const projectedStatus = projected.length
    ? 'PROJECTED'
    : (schedule?.status || projectedContract.status || 'NONE');
  const projectedScoreIncluded = schedule?.scoreIncluded === false
    || schedule?.projectedG1ScoreIncluded === false
    || projectedContract.scoreIncluded === false;
  const foundation = lineageG1FoundationForStep(step, plan);
  const foundationRaces = (foundation.route?.races || [])
    .map(row => row.nameZhTw).filter(Boolean);
  const routeRedAxes = (foundation.route?.requiredRedAxes || [])
    .map(axis => `${axis.label || axis.key} ${Number(axis.requiredIncomingRedStars) || '?'}★`);
  return `<section class="lineage-step-schedule" aria-label="共同 G1 賽程" data-g1-status="${escapeHtml(projectedStatus)}" data-score-included="${projectedScoreIncluded ? 'false' : 'unknown'}">
    <div data-evidence-status="${escapeHtml(foundation.route?.status || 'UNVERIFIED')}"><strong>這代的 GⅠ 底座主線</strong><span>${escapeHtml(foundation.route?.label || '待確認')}：${escapeHtml(foundationRaces.join('、') || '賽事資料待確認')}${routeRedAxes.length ? `；入場前由上游合計補 ${escapeHtml(routeRedAxes.join('、'))}` : ''}。</span></div>
    <div data-evidence-status="${escapeHtml(foundation.dirtDecision?.status || 'UNVERIFIED')}"><strong>泥地是否值得補</strong><span>${escapeHtml(lineageQuickDirtText(foundation.dirtDecision))}</span></div>
    <div data-evidence-status="${escapeHtml(confirmedContract.status || 'UNVERIFIED')}"><strong>共同 G1・已登錄（使用者紀錄）</strong><span>${confirmed.length ? escapeHtml(confirmed.join('、')) : '無已登錄勝場'}（${escapeHtml(confirmedContract.status || 'UNVERIFIED')}；${confirmedContract.scoreIncluded === false ? '不計分' : '可依目前規則計分'}）</span></div>
    <div data-evidence-status="${projected.length ? 'PROJECTED' : 'NONE'}"><strong>共同 G1・預計</strong><span>${projected.length ? escapeHtml(projected.join('、')) : '尚未產生賽程'}（${escapeHtml(projectedStatus)}；${projectedScoreIncluded ? '預計賽程不計入已登錄分數' : '計分狀態待確認'}）</span></div>
  </section>`;
}

function lineageEligibilityText(status) {
  return {
    NATIVE_APTITUDE_ELIGIBLE: '原生適性可排',
    RED_FACTOR_DEPENDENT: '需紅因子補（未驗證）',
    RED_FACTOR_REQUIRED_UNSATISFIED: '尚缺紅因子',
    MISSING_APTITUDE: '適性資料不足',
    INELIGIBLE: '不合格',
    NO_G1_CANDIDATES_FOR_BUCKET: '此 bucket 無 canonical GⅠ'
  }[status] || status || '待確認';
}

function lineageRaceAptitudeMarkup(step, plan) {
  const candidate = step?.candidate || {};
  const schedule = lineageScheduleOverrideForStep(step, plan);
  const requirements = schedule?.raceAptitudeRequirements || [];
  const rows = requirements.slice(0, 6).map(requirement => {
    const bucket = requirement.bucket || [requirement.surface, requirement.distanceType].filter(Boolean).join('・');
    const ranks = [
      requirement.surfaceRank ? `場地 ${requirement.surfaceRank}` : '',
      requirement.distanceRank ? `距離 ${requirement.distanceRank}` : '',
      lineageEligibilityText(requirement.eligibilityStatus)
    ].filter(Boolean).join('／');
    return `${bucket || '賽事適性'}：${ranks || '未提供'}`;
  });
  const outgoing = lineageRedFactorEntries(schedule?.outgoingRedFactors ?? schedule?.outgoingRedFactor)
    .map(factor => `${factor.label || factor.nameZhTw || factor.key || '紅因子'}${Number.isFinite(Number(factor.stars)) ? ` ${Number(factor.stars)}★` : ''}`);
  return `<section class="lineage-step-aptitude" aria-label="賽事適性與紅因子方向">
    <div><strong>適性基礎</strong><span>${escapeHtml(lineageAptitudeText(candidate))}</span></div>
    <div><strong>GⅠ底座</strong><span>${escapeHtml(lineageFoundationG1Text(candidate, step, plan))}</span></div>
    <div><strong>本步賽事適性</strong><span>${rows.length ? escapeHtml(rows.join('、')) : '尚未產生賽事適性契約'}</span></div>
    <div><strong>紅因子方向</strong><span>${outgoing.length ? `本匹產出→下代：${escapeHtml(outgoing.join('、'))}` : '本匹尚未指定產出紅因子；不把它當作本步入場適性。'}</span></div>
  </section>`;
}

function lineageStepDeckPlan(step) {
  const fallbackTargets = step.stage === 'target' && !(step.targets || []).length
    ? reverseLineageFactorTargets()
    : step.targets || [];
  return {
    formula: '本步以指定白／綠因子優先；其餘卡位交由 5自有+1借用的育成規則補足。',
    categories: [{
      id: `lineage-${step.id}`,
      label: '本步因子需求',
      weight: 1000,
      skills: fallbackTargets.map((target, index) => ({
        id: Number(target?.id),
        factorId: Number(target?.id),
        familyIds: target?.familyIds || [],
        sourceKind: target?.sourceKind,
        deckEligible: target?.sourceKind !== 'parent-unique',
        weight: Math.max(1, Number(target?.weight || target?.expectedUtility) || 1000 - index),
        evidence: [target?.reason].filter(Boolean)
      })).filter(target => Number.isFinite(target.id))
    }]
  };
}

function lineageStepDeckCacheKey(step) {
  const scenario = activeBattleScenario();
  const inventorySignature = (inventory?.supportCards || []).map(card => [
    Number(card.id ?? card.supportId), Number(card.level), Number(card.limitBreak)
  ]);
  const stepTargets = step.stage === 'target' && !(step.targets || []).length
    ? reverseLineageFactorTargets()
    : step.targets || [];
  const targets = stepTargets.map(target => [
    Number(target?.id), Number(target?.weight || target?.expectedUtility), target?.kind || ''
  ]);
  return JSON.stringify({
    step: step.id,
    candidate: [step.candidate?.outfitId, step.candidate?.characterId],
    scenario: [scenario?.id, scenario?.entryCardPolicy, scenarioRequiredSupportIds(scenario)],
    targets,
    inventory: inventorySignature
  });
}

function lineageStepBreedingDeck(step) {
  if (typeof plannerCore?.buildSkillDrivenBreedingDeck !== 'function' || !step?.candidate) return null;
  const key = lineageStepDeckCacheKey(step);
  if (lineageStepDeckCache.has(key)) return lineageStepDeckCache.get(key);
  const result = plannerCore.buildSkillDrivenBreedingDeck(
    inventory,
    plannerRules,
    lineageStepDeckPlan(step),
    gameCatalog,
    {
      preferredTypes: expectedBattleDeckTypes(),
      preferTypeBeforeStrength: true,
      scenario: activeBattleScenario(),
      battleUma: step.candidate,
      server: 'zh_tw'
    }
  );
  lineageStepDeckCache.set(key, result);
  return result;
}

function lineageStepDeckMarkup(step, deckResult) {
  if (!deckResult) {
    return '<section class="lineage-step-deck is-unavailable"><strong>本步 5自有+1借用配卡</strong><span>配卡核心尚未可用，請先補齊本步方案。</span></section>';
  }
  const validation = deckResult.validation || {};
  const cards = deckResult.deck || [];
  const speedCount = Number(validation.speedCount)
    || cards.filter(card => normalizeSupportType(card?.supportType) === 'Speed').length;
  const scenarioIds = scenarioRequiredSupportIds();
  const exactScenarioCount = scenarioIds.length
    ? cards.filter(card => scenarioIds.includes(Number(card?.id))).length
    : 1;
  const ruleProblems = [
    ...(validation.violations || []),
    ...(speedCount >= 1 ? [] : ['至少需要 1 張速度支援卡']),
    ...(exactScenarioCount === 1 ? [] : [`劇本必帶 exact 卡需要其中一張：${scenarioIds.join('／')}`])
  ];
  const valid = validation.valid === true && ruleProblems.length === 0;
  const cardMarkup = card => {
    const labels = localizedSupportLabels(card);
    const responsibilityIds = [...new Set([
      ...(card?.responsibilitySkillIds || []),
      ...(card?.coverageSkillIds || [])
    ])];
    const responsibility = responsibilityIds.length
      ? responsibilityIds.map(localizedSkillName).join('、')
      : '補訓練輸出／技能點穩定度';
    const ownership = card?.borrowed
      ? supportCardOwnershipDetail(card, { borrowed: true, level: card.level })
      : supportCardOwnershipDetail(card);
    return `<article class="lineage-step-support-card" data-support-card-id="${Number(card?.id) || ''}" data-ownership="${card?.borrowed ? 'borrowed' : 'owned'}">
      ${supportCardImageMarkup(card, { borrowed: Boolean(card?.borrowed), level: card?.level })}
      <div><strong>${escapeHtml(labels.name)}${labels.title ? ` ${escapeHtml(labels.title)}` : ''}</strong>
        <small>${escapeHtml(ownership)}・來源：${escapeHtml(supportCardSourceLabel(card))}</small>
        <span>負責：${escapeHtml(responsibility)}</span>
      </div>
    </article>`;
  };
  return `<section class="lineage-step-deck" data-lineage-deck-valid="${valid}">
    <header><strong>本步育成配卡：5自有+1借用</strong><small>${valid
      ? `規則通過・速度 ${speedCount} 張${scenarioIds.length ? `・劇本 exact ${scenarioIds.join('／')}` : ''}`
      : `尚未就緒：${escapeHtml(ruleProblems.join('；') || '配卡規則未通過')}`}</small></header>
    <div class="lineage-step-support-grid">${cards.map(cardMarkup).join('')}</div>
  </section>`;
}

function lineageContinueStatusLabel(status) {
  return {
    READY_TO_START: '可以開始本代育成',
    READY_TO_HANDOFF: '可以交棒給下一代',
    READY_WITH_TRADEOFFS: '可以交棒（保留妥協）',
    FINAL_TARGET: '最終戰馬，不再往下交棒',
    PLAN_INCOMPLETE: '可開始，但施工目標尚未完整',
    BLOCKED: '尚不可繼續',
    READY: '已就緒',
    MISSING: '尚缺紀錄',
    NEEDS_DECISION: '需要先決定目標',
    USER_RECORDED: '已登錄（使用者紀錄）',
    PROJECTED_ONLY: '只有預計賽程，尚未登錄勝場',
    RECOMMENDED_PENDING: '建議項未全達成（可妥協）',
    NOT_REQUIRED: '本步不要求'
  }[String(status || '').toUpperCase()] || String(status || '待確認');
}

function lineageContinueBlockerText(item, plan) {
  const factorName = item?.skillId
    ? localizedSkillName(Number(item.skillId))
    : item?.key || lineageFactorTypeLabel(item?.type);
  return {
    INCOMING_FACTOR_MISSING: `上游尚未提供 ${factorName}`,
    INCOMING_FACTOR_UNVERIFIED: `上游 ${factorName} 尚未由綁定紀錄證明可用`,
    OUTPUT_FACTOR_NOT_RECORDED: `本代尚未登錄產出 ${factorName}`,
    G1_RESULT_NOT_RECORDED: `預計 G1 ${item?.raceIdentity || ''} 尚未登錄為實際勝場`
  }[item?.code] || item?.message || item?.code || '仍有未完成條件';
}

function lineageContinueTradeoffText(item) {
  const redLabels = {
    turf: '草地',
    dirt: '泥地',
    sprint: '短距離',
    mile: '英里',
    medium: '中距離',
    long: '長距離'
  };
  const factorName = item?.skillId
    ? localizedSkillName(Number(item.skillId))
    : redLabels[item?.key] || item?.key || lineageFactorTypeLabel(item?.type);
  return {
    RECOMMENDED_OUTPUT_NOT_RECORDED: `建議因子「${factorName}」未產出；仍可交棒，但少一個期望效用加分。`,
    RECOMMENDED_G1_NOT_RECORDED: `建議 G1 ${item?.raceIdentity || ''} 未登錄勝場；仍可交棒，但共同 G1 加分較少。`
  }[item?.code] || item?.message || item?.code || '此項是可接受的機率性缺口';
}

function lineageCompletionMarkup(step, plan, deckResult) {
  const flow = step?.factorFlow || {};
  const continueWhen = flow.continueWhen || {};
  const deckValid = deckResult?.validation?.valid === true;
  const startStatus = deckValid ? (continueWhen.startStatus || 'BLOCKED') : 'BLOCKED';
  const handoffStatus = deckValid
    ? (continueWhen.handoffStatus || continueWhen.status || 'BLOCKED')
    : 'BLOCKED';
  const boundRecord = lineageBoundBreederRecord(step);
  const rawBlockers = [
    ...(deckValid ? [] : [{ code: 'DECK_INVALID', message: '本步 5自有+1借用配卡尚未通過' }]),
    ...(continueWhen.blockers || [])
  ];
  const startBlockers = rawBlockers
    .filter(item => item?.code === 'DECK_INVALID' || String(item?.code || '').startsWith('INCOMING_'))
    .map(item => lineageContinueBlockerText(item, plan));
  const handoffBlockers = rawBlockers
    .filter(item => item?.code !== 'DECK_INVALID' && !String(item?.code || '').startsWith('INCOMING_'))
    .map(item => lineageContinueBlockerText(item, plan));
  const rawTradeoffs = continueWhen.tradeoffs || [];
  const tradeoffs = rawTradeoffs
    .filter(item => item?.code !== 'RECOMMENDED_G1_NOT_RECORDED')
    .map(lineageContinueTradeoffText)
    .filter(Boolean);
  const recommendedG1GapCount = rawTradeoffs
    .filter(item => item?.code === 'RECOMMENDED_G1_NOT_RECORDED')
    .length;
  if (recommendedG1GapCount) {
    tradeoffs.push(`建議共同 GⅠ 尚有 ${recommendedG1GapCount} 場未登錄；仍可交棒，但共同 GⅠ加分較少。`);
  }
  const warnings = [
    ...(continueWhen.warnings || []).map(item => item?.message || item?.code || ''),
    ...lineageValueList(step?.warnings),
    ...lineageValueList(lineageScheduleOverrideForStep(step, plan)?.warnings)
  ].filter(Boolean);
  const isTarget = step?.stage === 'target' || step?.id === 'target';
  return `<section class="lineage-step-continue" data-factor-flow-section="continue" aria-label="可繼續條件">
    <header><span>3</span><div><strong>${isTarget ? '完成本育成的條件' : '可繼續往下一代的條件'}</strong><small>硬門仍須有實際紀錄；建議白因子與建議 G1 未全達成時，會標成「保留妥協」而不再假裝整條路線失敗。</small></div></header>
    <div class="lineage-continue-grid">
      <article><strong>開始本代</strong><b data-continue-status="${escapeHtml(startStatus)}">${escapeHtml(lineageContinueStatusLabel(startStatus))}</b><span>${deckValid ? '5+1 配卡已通過' : '先修正本步 5+1 配卡'}；上游因子 ${escapeHtml(lineageContinueStatusLabel(continueWhen.incoming || 'BLOCKED'))}</span></article>
      <article><strong>${isTarget ? '本育成結果' : '交棒下一代'}</strong><b data-continue-status="${escapeHtml(handoffStatus)}">${escapeHtml(lineageContinueStatusLabel(handoffStatus))}</b><span>本代產出 ${escapeHtml(lineageContinueStatusLabel(continueWhen.deliverables || 'MISSING'))}；G1 ${escapeHtml(lineageContinueStatusLabel(continueWhen.g1 || 'NOT_REQUIRED'))}</span></article>
      <article data-evidence-status="${boundRecord ? 'USER_RECORDED' : 'NONE'}"><strong>實際紀錄</strong><b>${boundRecord ? 'USER_RECORDED・已綁定' : 'NONE・尚未綁定'}</b><span>${boundRecord
        ? `使用者紀錄「${escapeHtml(boundRecord.name || boundRecord.id)}」；不等同外部驗證或官方確認。`
        : '同衣裝紀錄不會自動套用，請在上方選擇本次實際結果。'}</span></article>
    </div>
    ${startBlockers.length ? `<div class="lineage-continue-blockers" data-gate="start"><strong>開始前尚缺</strong><ul>${startBlockers.map(value => `<li>${escapeHtml(value)}</li>`).join('')}</ul></div>` : ''}
    ${handoffBlockers.length ? `<div class="lineage-continue-blockers" data-gate="handoff"><strong>交棒前尚缺</strong><ul>${handoffBlockers.map(value => `<li>${escapeHtml(value)}</li>`).join('')}</ul></div>` : ''}
    ${tradeoffs.length ? `<div class="lineage-continue-tradeoffs"><strong>可妥協缺口</strong><ul>${tradeoffs.map(value => `<li>${escapeHtml(value)}</li>`).join('')}</ul></div>` : ''}
    ${warnings.length ? `<div class="lineage-continue-warnings"><strong>提醒</strong><ul>${warnings.map(value => `<li>${escapeHtml(value)}</li>`).join('')}</ul></div>` : ''}
  </section>`;
}

function lineageStepWorkflowState(step, plan, deckResult = lineageStepBreedingDeck(step)) {
  const continueWhen = step?.factorFlow?.continueWhen || {};
  const deckValid = deckResult?.validation?.valid === true;
  const blockers = [
    ...(deckValid ? [] : [{ code: 'DECK_INVALID', message: '本步 5自有+1借用配卡尚未通過' }]),
    ...(continueWhen.blockers || [])
  ];
  const tradeoffs = continueWhen.tradeoffs || [];
  const boundRecord = lineageBoundBreederRecord(step);
  const startStatus = deckValid ? (continueWhen.startStatus || 'BLOCKED') : 'BLOCKED';
  const handoffStatus = deckValid
    ? (continueWhen.handoffStatus || continueWhen.status || 'BLOCKED')
    : 'BLOCKED';
  const coreHandoffReady = ['READY_TO_HANDOFF', 'READY_WITH_TRADEOFFS'].includes(handoffStatus);
  const isTarget = step?.stage === 'target' || step?.id === 'target';
  const complete = Boolean(boundRecord)
    && blockers.length === 0
    && (isTarget ? startStatus === 'READY_TO_START' : coreHandoffReady);
  return {
    step,
    deckResult,
    deckValid,
    boundRecord,
    blockers,
    tradeoffs,
    startStatus,
    handoffStatus,
    complete,
    needsAttention: blockers.length > 0 || tradeoffs.length > 0 || !boundRecord
  };
}

function lineagePlanWorkflowSummary(plan, orderedSteps) {
  const states = orderedSteps.map(step => lineageStepWorkflowState(step, plan));
  const nextState = states.find(item => !item.complete) || null;
  return {
    states,
    nextState,
    focusState: nextState || states.at(-1) || null,
    completeCount: states.filter(item => item.complete).length,
    blockerCount: states.reduce((sum, item) => sum + item.blockers.length, 0),
    tradeoffCount: states.reduce((sum, item) => sum + item.tradeoffs.length, 0),
    tradeoffStepCount: states.filter(item => item.tradeoffs.length > 0).length,
    recordCount: states.filter(item => item.boundRecord).length
  };
}

function lineageWorkflowNextAction(workflow) {
  const item = workflow?.nextState;
  if (!item) return '所有世代都已綁定實績，且硬門已通過；可以回頭檢查最終家系。';
  const candidate = item.step?.candidate || {};
  const name = `${candidate.nameZhTw || item.step?.label || '本代'} ${candidate.outfitTitleZhTw || ''}`.trim();
  if (!item.deckValid) return `先修正「${name}」的 5自有+1借用配卡。`;
  if (item.startStatus === 'BLOCKED') return `先補齊「${name}」的上游硬條件，再開始本代育成。`;
  if (!item.boundRecord) return `育成「${name}」，完成後綁定本次實際種馬紀錄。`;
  if (item.blockers.length) return `「${name}」已有紀錄，但仍須補齊硬條件後才能交棒。`;
  return `檢查「${name}」的交棒條件；推薦缺口可以明確保留，不必重刷到完美。`;
}

function lineageQuickAffinityText(step) {
  const basis = step?.selectionBasis || step?.candidate?.selectionBasis || {};
  const rows = [
    ['直屬親代', basis.parentAffinity ?? basis.childAffinity],
    ['最終戰馬', basis.targetAffinity]
  ].map(([label, value]) => [label, Number(value)])
    .filter(([, value]) => Number.isFinite(value));
  return rows.length
    ? `${rows.map(([label, value]) => `${label} ${value}`).join('／')}；與共同 GⅠ 分開看`
    : '目前無可核對數值；不用 GⅠ 數量代替相性';
}

function lineageQuickDirtText(dirtDecision) {
  if (!dirtDecision) return '尚未取得泥地底座判斷';
  const red = (dirtDecision.requiredRedAxes || [])
    .map(axis => `${axis.label || axis.key} ${Number(axis.requiredIncomingRedStars) || '?'}★`)
    .join('、');
  return {
    RECOMMENDED_NATIVE: '有固定或共同泥地 GⅠ，且原生適性可用；可併入底座',
    RECOMMENDED_RED_FACTOR_OPTION: `有明確泥地 GⅠ 對齊；若要跑，入場前由上游合計補 ${red || '對應紅因子'}`,
    NOT_RECOMMENDED_NO_SHARED_G1: `沒有共同／固定泥地 GⅠ；這輪不值得為 ${red || '泥地適性'} 單獨改線`,
    AVAILABLE_NOT_NEEDED: '適性可跑，但沒有共同／固定泥地 GⅠ；這輪不必特別排',
    NOT_RECOMMENDED: `泥地路線適性無法證明；這輪不排${red ? `（已見缺口 ${red}）` : ''}`,
    NEEDS_EVIDENCE: '適性或 GⅠ 資料不足；不自動改泥地'
  }[dirtDecision.status] || '泥地只在對齊固定賽或共同 GⅠ 時才考慮';
}

function lineageQuickStartMarkup(plan, workflow) {
  if (!plan || !workflow) {
    return `<div class="breeder-quick-empty">
      <span class="breeder-quick-eyebrow">還差一步</span>
      <h3>先回去選好戰馬與六卡</h3>
      <p>確認後，這裡會直接告訴你現在要養哪隻，不用先讀完整個家系模型。</p>
      <div class="breeder-quick-actions"><button type="button" class="primary" data-prev="parents">回去選戰馬與六卡</button></div>
    </div>`;
  }
  if (!workflow.nextState?.step) {
    return `<div class="breeder-quick-empty">
      <span class="breeder-quick-eyebrow">家系已完成</span>
      <h3>可以進入最終戰馬育成</h3>
      <p>所有世代都已綁定實績且通過硬門；需要時再打開完整家系核對。</p>
      <div class="breeder-quick-actions"><button type="button" class="primary" data-breeder-open-step data-step-id="">查看完整家系</button></div>
    </div>`;
  }
  const stateItem = workflow.nextState;
  const step = stateItem.step;
  const candidate = step.candidate || {};
  const deck = stateItem.deckResult || lineageStepBreedingDeck(step);
  const borrowed = (deck?.deck || []).find(card => card?.borrowed) || deck?.borrowedCard || null;
  const borrowedLabels = borrowed ? localizedSupportLabels(borrowed) : null;
  const routePlan = lineageG1FoundationForStep(step, plan);
  const familyRoute = routePlan.family?.recommendedRoute;
  const route = routePlan.route;
  const routeRaces = (route?.races || familyRoute?.races || [])
    .map(row => row.nameZhTw).filter(Boolean);
  const routeReason = familyRoute?.builtInGoalMatchCount
    ? `家系內有 ${familyRoute.builtInGoalMatchCount} 個固定目標賽命中這條路線`
    : familyRoute?.sharedMatchCount
      ? `已有 ${familyRoute.sharedMatchCount} 個共同 GⅠ 對齊`
      : '英里＋中距離底座預設優先；不把另一套三冠一起硬塞';
  const statusCopy = stateItem.startStatus === 'BLOCKED'
    ? '先補開養條件'
    : '現在可開養';
  return `<div class="breeder-quick-hero">
      ${traineePortraitMarkup(candidate, 'breeder-quick-portrait')}
      <div>
        <span class="breeder-quick-eyebrow">下一輪・${Number(step.order) || '?'}／${workflow.states.length}</span>
        <h3>現在先養：${escapeHtml(candidate.nameZhTw || step.label || '本代')} ${escapeHtml(candidate.outfitTitleZhTw || '')}</h3>
        <p><strong>${escapeHtml(statusCopy)}</strong>・${escapeHtml(lineageStepSupplyText(step))}</p>
      </div>
    </div>
    <div class="breeder-quick-grid">
      <article><span>開養前</span><strong>${escapeHtml(lineageDependencyText(step, plan))}</strong></article>
      <article><span>這輪主要追</span><strong>${escapeHtml(lineageStepQuickTakeText(step, plan, step.targets || []))}</strong>${lineageQuickRedScope(step) ? `<small>${escapeHtml(lineageQuickRedScope(step))}</small>` : ''}</article>
      <article><span>借卡</span><strong>${borrowedLabels ? `${escapeHtml(borrowedLabels.name)}${borrowedLabels.title ? ` ${escapeHtml(borrowedLabels.title)}` : ''}` : '本輪配卡尚未就緒'}</strong></article>
      <article><span>GⅠ 底座</span><strong>${escapeHtml(route?.label || familyRoute?.label || '路線待確認')}：${escapeHtml(routeRaces.join('・') || '賽事資料待確認')}</strong><small>${escapeHtml(routeReason)}</small></article>
      <article><span>是否改泥地</span><strong>${escapeHtml(lineageQuickDirtText(routePlan.dirtDecision))}</strong></article>
      <article><span>基礎相性</span><strong>${escapeHtml(lineageQuickAffinityText(step))}</strong></article>
    </div>
    <div class="breeder-quick-actions">
      <button type="button" class="primary" data-breeder-open-step data-step-id="${escapeHtml(step.id)}">打開這一輪：賽程、配卡、畢業條件</button>
      <button type="button" class="ghost" data-prev="parents">回去改戰馬或六卡</button>
    </div>
    <p class="breeder-quick-boundary">GⅠ 底座、基礎相性、紅因子成本分開裁決；預計賽程不會被當成已獲勝。</p>`;
}

function bindBreederQuickStart(quickStart, buildSteps, workflow) {
  if (!quickStart) return;
  const backButton = quickStart.querySelector('[data-prev]');
  if (backButton) backButton.addEventListener('click', () => {
    showPanel(backButton.dataset.prev, { focusHeading: true });
  });
  const openButton = quickStart.querySelector('[data-breeder-open-step]');
  if (!openButton) return;
  openButton.addEventListener('click', () => {
    const workbench = byId('lineageWorkbenchDetails');
    if (workbench) workbench.open = true;
    const stepId = openButton.dataset.stepId || workflow?.nextState?.step?.id || '';
    lineageStepViewMode = stepId ? 'next' : 'all';
    if (buildSteps) applyLineageStepView(buildSteps);
    const detail = stepId
      ? [...(buildSteps?.querySelectorAll('details[data-lineage-step-id]') || [])]
        .find(item => item.dataset.lineageStepId === stepId)
      : buildSteps?.querySelector('details[data-lineage-step-id]');
    if (!detail) {
      workbench?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    detail.open = true;
    detail.querySelector('summary')?.focus();
    detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function lineageWorkflowDashboardMarkup(plan, workflow) {
  const total = workflow.states.length;
  const next = workflow.nextState?.step;
  const nextOrder = Number(next?.order) || null;
  const nextBodyId = next ? `lineageStep-${String(next.id).replace(/[^a-zA-Z0-9_-]/g, '-')}` : '';
  const policy = plan?.decisionPolicy || {};
  const execution = factorExecutionAssessment()?.assessment || null;
  const executionRows = execution?.statAssessment?.rows || [];
  const executionConfigured = executionRows.filter(row => row.status !== 'UNCONFIGURED').length;
  const executionGapCount = execution?.statAssessment?.tradeoffs?.length || 0;
  const executionStatusLabel = {
    READY: '可執行',
    READY_WITH_TRADEOFFS: '可執行・有取捨',
    BLOCKED: '低於使用者硬門',
    UNCONFIGURED: '目標未設定',
    UNVERIFIED: '預估值未知'
  }[execution?.status] || '尚未評估';
  return `<div class="lineage-policy-strip">
      <span>目前規則</span><strong>${escapeHtml(policy.id || 'probabilistic-balanced-v1')}</strong><p>${escapeHtml(policy.principle || '硬門必守；相性、共同 GⅠ與推薦因子作為機率加分。')}</p>
    </div>
    <button type="button" class="lineage-next-action" data-lineage-next-action data-next-step-id="${escapeHtml(next?.id || '')}"${nextBodyId ? ` aria-controls="${escapeHtml(nextBodyId)}"` : ' disabled'}>
      <span>${nextOrder ? `下一步・${nextOrder}／${total}` : '施工完成'}</span>
      <strong>${escapeHtml(lineageWorkflowNextAction(workflow))}</strong>
      <small>${next ? escapeHtml(lineageStepSupplyText(next)) : '建議保留所有實際紀錄，之後再依新賽事需求重算。'}</small>
    </button>
    <div class="lineage-workflow-metrics">
      <article><span>完成交棒</span><strong>${workflow.completeCount}／${total}</strong><small>需綁定實績並通過硬門</small></article>
      <article data-metric-tone="hard"><span>硬阻塞</span><strong>${workflow.blockerCount}</strong><small>未解決就不能開始或交棒</small></article>
      <article data-metric-tone="tradeoff"><span>可妥協世代</span><strong>${workflow.tradeoffStepCount}／${total}</strong><small>影響期望值，不判整條失敗</small></article>
      <article data-metric-tone="evidence"><span>實績綁定</span><strong>${workflow.recordCount}／${total}</strong><small>使用者紀錄，不等同外部驗證</small></article>
      <article data-metric-tone="execution" data-execution-status="${escapeHtml(execution?.status || 'UNVERIFIED')}"><span>育成可行性</span><strong>${escapeHtml(executionStatusLabel)}</strong><small>${executionConfigured} 項已設門檻・${executionGapCount} 項 target 缺口；不改血統排序</small></article>
    </div>`;
}

function lineagePlanContractMarkup(plan) {
  const ruleset = plan?.ruleset?.id || plan?.ruleset?.label || plan?.ruleset || '規則集待確認';
  const confirmed = plan?.confirmedG1Bonus || {};
  const projected = plan?.projectedG1Bonus || {};
  const confirmedEdges = (plan?.g1Edges || [])
    .filter(edge => (edge?.commonRaces || []).length)
    .slice(0, 3)
    .map(edge => edge.label || edge.id || '共同 G1 關係');
  const red = Object.values(plan?.redByKey || {})
    .filter(item => Number(item?.factorCount) > 0)
    .slice(0, 3)
    .map(item => `${item.key} ${Number(item.starTotal) || 0}★`);
  const aptitude = (plan?.aptitudePlan || [])
    .map(item => `${item.label || item.key}：${item.probabilityStatus || 'UNVERIFIED'}`)
    .slice(0, 3);
  const autonomous = plan?.autonomousEligibility?.status || 'UNVERIFIED';
  const schedule = plan?.g1Schedule || {};
  const scheduledEdges = (plan?.g1ScheduleEdges || schedule?.edgeSchedules || [])
    .filter(edge => (edge?.projected || edge?.projectedG1Schedule || []).length)
    .map(edge => edge.id)
    .slice(0, 5);
  return `<div class="lineage-contract-status" aria-label="家系驗證狀態">
    <span>規則：${escapeHtml(String(ruleset))}</span>
    <span>共同 G1 已登錄（使用者紀錄）：${escapeHtml(confirmed.status || 'UNVERIFIED')}${Number.isFinite(Number(confirmed.total)) ? `・${Number(confirmed.total)} 分` : ''}</span>
    <span>預計 G1：${escapeHtml(projected.status || 'UNVERIFIED')}・${projected.scoreIncluded === false ? '不計入已登錄分數' : '分數狀態待確認'}</span>
    <span>共同關係：${escapeHtml(confirmedEdges.join('、') || '尚無可確認關係')}</span>
    <span>施工預計 G1：${escapeHtml(schedule.status || '尚未產生')}・${escapeHtml(scheduledEdges.join('、') || '尚無可排共同 edge')}・永不計 confirmed 分數</span>
    <span>紅因子：${escapeHtml(red.join('、') || '尚無已入家系紅因子')}</span>
    <span>適性：${escapeHtml(aptitude.join('、') || '尚無已驗證結論')}</span>
    <span>自主育成：${escapeHtml(autonomous)}</span>
  </div>`;
}

function factorScenarioMarkup(plan, factorTargets) {
  const profiles = factorRunStrategy?.scenarioProfiles || [];
  const defaultProfile = activeBattleScenario()
    || profiles.find(profile => profile.id === factorRunStrategy?.scenarioDecision?.defaultScenarioId)
    || profiles[0];
  const exclusiveTargets = factorTargets.filter(target => target.scenarioExclusive);
  const exclusiveProfiles = [...new Set(exclusiveTargets.map(target => target.scenarioId))]
    .map(id => profiles.find(profile => profile.id === id))
    .filter(Boolean);
  const explicitSupport = scenarioRequiredSupportIds(defaultProfile)
    .map(id => supportCatalogById.get(Number(id)))
    .filter(Boolean);
  const ownedScenarioSupport = explicitSupport.find(card =>
    inventorySupportById.has(Number(card.id))
  );
  const sourceCount = factorTargets.filter(target => {
    const skill = skillCore.resolveSkillSources(target.id, gameCatalog, inventory, plannerRules);
    return Boolean(
      skill?.characterCards?.length
      || skill?.supports?.length
      || target.scenarioExclusive
    );
  }).length;
  const rawCost = factorTargets.reduce((sum, target) =>
    sum + Math.max(0, Number(skillById.get(Number(target.id))?.cost) || 0), 0
  );
  const mode = (factorRunStrategy?.modes || []).find(item =>
    item.id === state.breedingAutomationMode
  );
  const factorSelection = state.factorSpecificationEnabled
    ? '自選因子負責固定藍／紅種類；白因子仍要抽選'
    : '未使用自選因子；藍／紅種類也要納入周回成本';
  const exclusiveRows = exclusiveProfiles.length
    ? `<div class="scenario-path scenario-path--seed">
        <span>最前置限定種子</span>
        <strong>${exclusiveProfiles.map(profile => profile.nameZhTw).join('／')}</strong>
        <p>${exclusiveTargets.map(target => target.nameZhTw).join('、')}只有舊劇本路線；只做進最前置素材，下一代就回高輸出劇本。</p>
      </div>`
    : '';
  return `<div class="scenario-recommendation-heading">
      <div><p class="kicker">自動因子周回</p><h4>每一代應該跑哪個劇本</h4></div>
      <span>${escapeHtml(mode?.nameZhTw || '自動育成')}</span>
    </div>
    <div class="scenario-metrics">
      <article><span>目標白因子</span><strong>${factorTargets.length} 項</strong><small>${sourceCount} 項已有明確取得路線</small></article>
      <article><span>未折扣技能 Pt</span><strong>${rawCost || '—'}</strong><small>只用來判斷提示池壓力，不是實際需求</small></article>
      <article><span>劇本技能 Pt 指數</span><strong>${defaultProfile?.skillPointIndex ?? '—'}／100</strong><small>攻略代理，不是保證產量</small></article>
      <article><span>自選因子</span><strong>${state.factorSpecificationEnabled ? '啟用' : '未啟用'}</strong><small>${escapeHtml(factorSelection)}</small></article>
    </div>
    <div class="scenario-paths">
      ${explicitSupport.length ? `<div class="scenario-path scenario-path--required">
        <span>劇本六卡 hard requirement</span>
        <strong>${explicitSupport.map(card => `${escapeHtml(localizedSupportLabels(card).name)}（ID ${card.id}）`).join('／')}</strong>
        <p>${ownedScenarioSupport
          ? `持有時固定占自有五卡之一：${escapeHtml(supportCardOwnershipDetail(ownedScenarioSupport) || '依 inventory 實際等級／突破')}`
          : `未持有時固定唯一借卡：${explicitSupport.map(card => card.id).join('／')}，借卡滿突滿等；同型其他卡不可替代`}</p>
      </div>` : ''}
      ${exclusiveRows}
      <div class="scenario-path">
        <span>四祖代與兩親代</span>
        <strong>${escapeHtml(defaultProfile?.nameZhTw || '目前最高輸出自動劇本')}</strong>
        <p>${escapeHtml(defaultProfile?.summary || '')}${ownedScenarioSupport ? ` 你已持有劇本卡「${localizedSupportLabels(ownedScenarioSupport).name}」。` : ''}</p>
      </div>
      <div class="scenario-path">
        <span>技能 Pt 剩餘時</span>
        <strong>增加有用提示，不是亂買技能</strong>
        <p>${escapeHtml(factorRunStrategy?.scenarioDecision?.surplusSkillPointPolicy || '')}</p>
      </div>
    </div>`;
}

function lineageFoundationMiniMarkup(seed, plan) {
  return `<article class="lineage-foundation-mini">
    ${traineePortraitMarkup(seed, 'lineage-foundation-portrait')}
    <div><strong>${escapeHtml(seed.nameZhTw)} ${escapeHtml(seed.outfitTitleZhTw || '')}</strong>
      <small>關係摘要：${escapeHtml(seed.role || '前置素材')}；${escapeHtml(lineageStepSupplyText({ stage: 'foundation', reusedFor: [seed.childSlot] }))}</small>
    </div>
  </article>`;
}

function lineageFoundationMaterialsMarkup(plan, grandparent) {
  const seeds = (plan.foundations || []).filter(seed => seed.childSlot === grandparent?.slot);
  return `<section class="lineage-foundation-materials" aria-label="${escapeHtml(lineageSlotLabel(grandparent?.slot))} 的前置素材">
    <strong>前置素材</strong>
    <div>${seeds.length
      ? seeds.map(seed => lineageFoundationMiniMarkup(seed, plan)).join('')
      : '<small>尚未排出前置素材</small>'}</div>
  </section>`;
}

function lineageTradeoffCategoryCount(tradeoffs) {
  return new Set((tradeoffs || []).map(item => (
    item?.code === 'RECOMMENDED_G1_NOT_RECORDED' ? 'g1' : 'factor'
  ))).size;
}

function lineageStepSummaryBadgesMarkup(workflow, isNext) {
  const blocker = workflow.blockers.length
    ? `<b data-badge-tone="hard">硬阻塞 ${workflow.blockers.length}</b>`
    : '<b data-badge-tone="ready">硬門可行</b>';
  const tradeoffCategories = lineageTradeoffCategoryCount(workflow.tradeoffs);
  const tradeoff = tradeoffCategories
    ? `<b data-badge-tone="tradeoff">可妥協 ${tradeoffCategories} 類</b>`
    : '';
  const evidence = workflow.boundRecord
    ? '<b data-badge-tone="evidence">USER_RECORDED・實績已綁定</b>'
    : '<b data-badge-tone="muted">NONE・實績未綁定</b>';
  return `<span class="lineage-step-summary-badges">${isNext ? '<b data-badge-tone="next">下一步</b>' : ''}${blocker}${tradeoff}${evidence}</span>`;
}

function lineageStepMarkup(step, plan, currentStepId, workflowState = null, workflowNextId = '') {
  const current = step.id === currentStepId;
  const candidate = step.candidate || {};
  const deck = workflowState?.deckResult || lineageStepBreedingDeck(step);
  const workflow = workflowState || lineageStepWorkflowState(step, plan, deck);
  const isNext = step.id === workflowNextId;
  const factorFlow = lineageFactorFlowParts(step, plan);
  const role = step.stage === 'target'
    ? '最終戰馬'
    : step.stage === 'parent'
      ? '直接親代'
      : step.stage === 'grandparent'
        ? '祖代'
        : '前置素材';
  const extra = step.reusedFor?.length > 1
    ? `可共用於 ${step.reusedFor.map(lineageSlotLabel).join('、')}`
    : '';
  const stepId = String(step.id);
  const bodyId = `lineageStep-${stepId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  return `<li class="lineage-linear-item" data-lineage-step-order="${Number(step.order) || ''}">
    <details class="lineage-work-step${current ? ' is-current' : ''}" data-lineage-step-id="${escapeHtml(stepId)}" data-stage="${escapeHtml(step.stage)}" data-work-order="${Number(step.order) || ''}" data-start-status="${escapeHtml(workflow.startStatus)}" data-handoff-status="${escapeHtml(workflow.handoffStatus)}" data-record-status="${workflow.boundRecord ? 'USER_RECORDED' : 'NONE'}" data-workflow-next="${isNext}" data-workflow-complete="${workflow.complete}" data-workflow-blockers="${workflow.blockers.length}" data-workflow-tradeoffs="${workflow.tradeoffs.length}" data-workflow-bound="${Boolean(workflow.boundRecord)}"${current ? ' open' : ''}>
      <summary aria-controls="${escapeHtml(bodyId)}" aria-label="步驟 ${Number(step.order) || '?'}：養成 ${escapeHtml(candidate.nameZhTw || role)}">
        <span class="lineage-step-number">${Number(step.order) || '?'}</span>
        <span class="lineage-step-summary-copy"><strong>養 ${escapeHtml(candidate.nameZhTw || role)} ${escapeHtml(candidate.outfitTitleZhTw || '')}</strong><small>${escapeHtml(lineageStepSupplyText(step))}</small>${lineageStepSummaryBadgesMarkup(workflow, isNext)}</span>
        <span class="lineage-step-state">${current ? '正在查看' : (workflow.complete ? '已交棒' : '查看')}</span>
      </summary>
      <div class="lineage-work-step-body" id="${escapeHtml(bodyId)}">
        <section class="lineage-work-phase" data-lineage-work-phase="decision">
          <header><span>先判斷</span><div><strong>這一代值不值得養</strong><small>先看角色任務，再分清楚硬門與期望值加分。</small></div></header>
          <div class="lineage-work-phase-content">
            ${lineageCandidateCard(candidate, role, step.targets || [], extra, { step, plan })}
            ${lineageStepMissionMarkup(step, plan)}
            <p class="lineage-step-supplies"><strong>本步供應</strong>${escapeHtml(lineageStepSupplyText(step))}</p>
          </div>
        </section>
        <section class="lineage-work-phase" data-lineage-work-phase="before">
          <header><span>開始前</span><div><strong>只檢查會卡住開養的條件</strong><small>上游未證明的硬因子才阻塞；推薦項留到育成後評估。</small></div></header>
          <div class="lineage-work-phase-content">
            <section class="lineage-step-dependency" aria-label="前置來源"><strong>前置來源</strong><span>${escapeHtml(lineageDependencyText(step, plan))}</span></section>
            ${factorFlow.incoming}
          </div>
        </section>
        <section class="lineage-work-phase" data-lineage-work-phase="during">
          <header><span>育成中</span><div><strong>照可行賽程與合法配卡執行</strong><small>賽程與相性是機率工具；技能強度足夠時，可以接受較差的基礎相性。</small></div></header>
          <div class="lineage-work-phase-content">
            ${lineageScheduleMarkup(step, plan)}
            ${lineageRaceAptitudeMarkup(step, plan)}
            ${lineageStepDeckMarkup(step, deck)}
          </div>
        </section>
        <section class="lineage-work-phase" data-lineage-work-phase="after">
          <header><span>育成後</span><div><strong>綁定實績，再決定交棒或重刷</strong><small>硬門沒中才阻塞；建議白因子或共同 GⅠ沒中，可以明確接受妥協。</small></div></header>
          <div class="lineage-work-phase-content">
            ${factorFlow.outputs}
            ${lineageCompletionMarkup(step, plan, deck)}
          </div>
        </section>
      </div>
    </details>
  </li>`;
}

function bindLineageStepDisclosure(buildSteps) {
  const details = [...buildSteps.querySelectorAll('details[data-lineage-step-id]')];
  const updateCurrent = active => {
    details.forEach(detail => {
      const current = detail === active;
      detail.classList.toggle('is-current', current);
      const summary = detail.querySelector('summary');
      if (current) {
        summary?.setAttribute('aria-current', 'step');
      } else {
        summary?.removeAttribute('aria-current');
      }
      const state = detail.querySelector('.lineage-step-state');
      if (state) {
        state.textContent = current
          ? '正在查看'
          : (detail.dataset.workflowComplete === 'true' ? '已交棒' : '查看');
      }
    });
  };
  details.forEach(detail => {
    detail.addEventListener('toggle', () => {
      if (!detail.open) return;
      lineageOpenStepId = detail.dataset.lineageStepId || null;
      details.forEach(other => {
        if (other !== detail && other.open) other.open = false;
      });
      updateCurrent(detail);
    });
  });
  const current = details.find(detail => detail.dataset.lineageStepId === lineageOpenStepId)
    || details.find(detail => detail.open)
    || details[0];
  if (current) updateCurrent(current);

  buildSteps.querySelectorAll('[data-lineage-record-select]').forEach(select => {
    select.addEventListener('change', () => {
      const stepId = String(select.dataset.lineageStepId || '').trim();
      if (!stepId) return;
      const recordId = String(select.value || '').trim();
      if (recordId) state.lineageBreederRecordBindings[stepId] = recordId;
      else delete state.lineageBreederRecordBindings[stepId];
      lineageOpenStepId = stepId;
      scheduleSave();
      renderReverseLineagePlan();
      requestAnimationFrame(() => {
        const replacement = [...document.querySelectorAll('[data-lineage-record-select]')]
          .find(node => node.dataset.lineageStepId === stepId);
        replacement?.focus();
      });
    });
  });
}

function lineageStepMatchesView(detail, mode) {
  if (mode === 'all') return true;
  if (mode === 'next') return detail.dataset.workflowNext === 'true';
  return Number(detail.dataset.workflowBlockers) > 0
    || Number(detail.dataset.workflowTradeoffs) > 0
    || detail.dataset.workflowBound !== 'true';
}

function applyLineageStepView(buildSteps) {
  const items = [...buildSteps.querySelectorAll('.lineage-linear-item')];
  items.forEach(item => {
    const detail = item.querySelector('details[data-lineage-step-id]');
    item.hidden = !detail || !lineageStepMatchesView(detail, lineageStepViewMode);
  });
  const visibleDetails = items
    .filter(item => !item.hidden)
    .map(item => item.querySelector('details[data-lineage-step-id]'))
    .filter(Boolean);
  const current = visibleDetails.find(detail => detail.open);
  if (!current && visibleDetails[0]) {
    buildSteps.querySelectorAll('details[data-lineage-step-id][open]').forEach(detail => {
      detail.open = false;
    });
    visibleDetails[0].open = true;
    lineageOpenStepId = visibleDetails[0].dataset.lineageStepId || lineageOpenStepId;
  }
  document.querySelectorAll('[data-lineage-view-mode]').forEach(button => {
    const active = button.dataset.lineageViewMode === lineageStepViewMode;
    button.setAttribute('aria-pressed', String(active));
    button.classList.toggle('is-active', active);
    button.onclick = () => {
      lineageStepViewMode = button.dataset.lineageViewMode || 'next';
      applyLineageStepView(buildSteps);
      const firstVisible = [...buildSteps.querySelectorAll('.lineage-linear-item:not([hidden]) summary')][0];
      firstVisible?.focus();
    };
  });
  const status = byId('lineageStepFilterStatus');
  if (status) {
    const label = lineageStepViewMode === 'next'
      ? '下一步'
      : lineageStepViewMode === 'issues'
        ? '有硬阻塞、可妥協缺口或尚未綁定實績的步驟'
        : '全部步驟';
    status.textContent = `目前顯示 ${visibleDetails.length}／${items.length}：${label}。`;
  }
}

function manualLineageSlotDefinition(slotId) {
  return manualLineageSlotDefinitions.find(row => row.id === slotId)
    || { id: slotId, label: slotId, shortLabel: slotId, generation: 'unknown' };
}

function manualLineageCardForSlot(slotId) {
  const outfitId = Number(state.manualLineage?.slots?.[slotId]);
  return Number.isFinite(outfitId) ? characterCardById.get(outfitId) || null : null;
}

function manualLineageAptitudeMarkup(card, className = '') {
  const labels = [
    ['草', '草地'], ['泥', '泥地'], ['短', '短距離'], ['哩', '一哩'], ['中', '中距離'],
    ['長', '長距離'], ['領', '領頭'], ['前', '前列'], ['居', '居中'], ['後', '後追']
  ];
  const aptitude = Array.isArray(card?.aptitude) ? card.aptitude : [];
  return `<span class="manual-lineage-aptitude ${escapeHtml(className)}" aria-label="十項初始適性">
    ${labels.map(([short, label], index) => `<span title="${escapeHtml(label)}"><small>${short}</small><b data-rank="${escapeHtml(aptitude[index] || '?')}">${escapeHtml(aptitude[index] || '?')}</b></span>`).join('')}
  </span>`;
}

function manualLineageRedFactorLabel(slotId) {
  const factor = state.manualLineage?.redFactors?.[slotId];
  const type = manualLineageRedFactorTypes.find(row => row.key === factor?.key);
  return type ? `${type.label} ${Number(factor.stars) || 1}★` : '設定紅因子';
}

function manualLineageRedEditorMarkup(slotId) {
  if (manualLineageRedEditorSlotId !== slotId) return '';
  const factor = state.manualLineage?.redFactors?.[slotId];
  return `<div class="manual-lineage-red-editor" data-lineage-red-editor="${escapeHtml(slotId)}">
    <label>類型<select data-manual-red-type="${escapeHtml(slotId)}">
      <option value="">未設定</option>
      ${manualLineageRedFactorTypes.map(row => `<option value="${row.key}"${row.key === factor?.key ? ' selected' : ''}>${escapeHtml(row.label)}</option>`).join('')}
    </select></label>
    <label>星數<select data-manual-red-stars="${escapeHtml(slotId)}"${factor?.key ? '' : ' disabled'}>
      ${[1, 2, 3].map(value => `<option value="${value}"${Number(factor?.stars) === value ? ' selected' : ''}>${value}★</option>`).join('')}
    </select></label>
    <button type="button" class="text-button" data-manual-red-reset="${escapeHtml(slotId)}"${factor?.key ? '' : ' disabled'}>清除</button>
  </div>`;
}

function manualLineageSlotCardMarkup(slotId) {
  const slot = manualLineageSlotDefinition(slotId);
  const card = manualLineageCardForSlot(slotId);
  const active = state.manualLineage?.activeScheduleSlot === slotId;
  const scheduleStatus = manualLineageScheduleBundle?.bySlot?.[slotId]?.status || (card ? 'UNVERIFIED' : 'EMPTY');
  const scheduleLabel = scheduleStatus === 'EMPTY' ? '未選角色' : manualLineageScheduleStatusLabel(scheduleStatus);
  const owned = card && inventoryTraineeByOutfitId.has(Number(card.id));
  if (!card) {
    return `<article class="manual-lineage-slot is-empty${active ? ' is-schedule-active' : ''}" data-manual-lineage-slot="${escapeHtml(slotId)}">
      <span class="manual-lineage-slot-role">${escapeHtml(slot.label)}<small>${escapeHtml(scheduleLabel)}</small></span>
      <button type="button" class="manual-lineage-slot-main" data-manual-lineage-pick="${escapeHtml(slotId)}">
        <b aria-hidden="true">＋</b><strong>選擇衣裝</strong><small>點擊搜尋角色</small>
      </button>
      <div class="manual-lineage-slot-actions">
        <button type="button" data-manual-red-open="${escapeHtml(slotId)}">${escapeHtml(manualLineageRedFactorLabel(slotId))}</button>
        <button type="button" data-manual-schedule-slot="${escapeHtml(slotId)}" aria-pressed="${active}">賽程</button>
      </div>
      ${manualLineageRedEditorMarkup(slotId)}
    </article>`;
  }
  const name = card.nameZhTw || card.name || card.nameJp || `衣裝 ${card.id}`;
  const title = card.titleZhTw || card.title || '';
  return `<article class="manual-lineage-slot${active ? ' is-schedule-active' : ''}" data-manual-lineage-slot="${escapeHtml(slotId)}">
    <span class="manual-lineage-slot-role">${escapeHtml(slot.label)}<small>${owned ? '持有快照' : '資料庫候選'}・${escapeHtml(scheduleLabel)}</small></span>
    <button type="button" class="manual-lineage-slot-main" data-manual-lineage-pick="${escapeHtml(slotId)}" aria-label="更換 ${escapeHtml(slot.label)}：${escapeHtml(name)} ${escapeHtml(title)}">
      ${traineePortraitMarkup(card, 'manual-lineage-portrait')}
      <span class="manual-lineage-slot-copy"><strong>${escapeHtml(name)}</strong><small>${escapeHtml(title || `衣裝 ${card.id}`)}</small>${manualLineageAptitudeMarkup(card)}</span>
    </button>
    <div class="manual-lineage-slot-actions">
      <button type="button" data-manual-red-open="${escapeHtml(slotId)}">${escapeHtml(manualLineageRedFactorLabel(slotId))}</button>
      <button type="button" data-manual-schedule-slot="${escapeHtml(slotId)}" aria-pressed="${active}">分析賽程</button>
    </div>
    ${manualLineageRedEditorMarkup(slotId)}
  </article>`;
}

function manualLineageTreeMarkup() {
  return `<div class="manual-lineage-target-row">${manualLineageSlotCardMarkup('target')}</div>
    <div class="manual-lineage-tree-connector" aria-hidden="true">兩名直接親代</div>
    <div class="manual-lineage-branches">
      <section class="manual-lineage-branch" data-branch="A">
        ${manualLineageSlotCardMarkup('parentA')}
        <div class="manual-lineage-branch-connector" aria-hidden="true">支系 A 的兩名祖代</div>
        <div class="manual-lineage-grandparents">${manualLineageSlotCardMarkup('parentA1')}${manualLineageSlotCardMarkup('parentA2')}</div>
      </section>
      <section class="manual-lineage-branch" data-branch="B">
        ${manualLineageSlotCardMarkup('parentB')}
        <div class="manual-lineage-branch-connector" aria-hidden="true">支系 B 的兩名祖代</div>
        <div class="manual-lineage-grandparents">${manualLineageSlotCardMarkup('parentB1')}${manualLineageSlotCardMarkup('parentB2')}</div>
      </section>
    </div>`;
}

function manualLineageRedSummaryMarkup() {
  const parentSlotIds = manualLineageSlotIds.filter(slotId => slotId !== 'target');
  const rows = new Map();
  parentSlotIds.forEach(slotId => {
    const factor = state.manualLineage?.redFactors?.[slotId];
    if (!factor?.key) return;
    const current = rows.get(factor.key) || { key: factor.key, count: 0, stars: 0 };
    current.count += 1;
    current.stars += Number(factor.stars) || 0;
    rows.set(factor.key, current);
  });
  const ranked = [...rows.values()].sort((left, right) => right.stars - left.stars || right.count - left.count);
  if (!ranked.length) {
    return '<strong>六親代紅因子尚未配置</strong><span>先用每張卡底部的紅因子按鈕分配類型與星數。</span><small>星數是手動目標，不是繼承或生成保證。</small>';
  }
  const top = ranked[0];
  const type = manualLineageRedFactorTypes.find(row => row.key === top.key);
  const referenceReached = top.count === 6 && top.stars >= 12;
  return `<strong>${escapeHtml(type?.label || top.key)}：${top.count} 格／${top.stars}★</strong>
    <span>${ranked.slice(1, 4).map(row => {
      const label = manualLineageRedFactorTypes.find(typeRow => typeRow.key === row.key)?.label || row.key;
      return `${label} ${row.count} 格／${row.stars}★`;
    }).join('・') || '目前集中在單一類型'}</span>
    <small>${referenceReached ? '已達參考站提示的六格同型、合計 12★觀察條件；仍不等於白因子必定生成。' : '參考站提示可觀察六格同型、合計 12★；這裡只追蹤配置，不把它當保證。'}</small>`;
}

function manualLineageRecommendedSlots(plan) {
  const slots = Object.fromEntries(manualLineageSlotIds.map(slotId => [slotId, null]));
  slots.target = Number(plan?.target?.outfitId) || null;
  (plan?.directParents || []).forEach((candidate, index) => {
    slots[index === 0 ? 'parentA' : 'parentB'] = Number(candidate?.outfitId) || null;
  });
  (plan?.grandparents || []).forEach(candidate => {
    if (manualLineageSlotIds.includes(candidate?.slot)) slots[candidate.slot] = Number(candidate?.outfitId) || null;
  });
  return slots;
}

function manualLineagePickerResults(query = '') {
  const normalized = String(query || '').trim().toLocaleLowerCase('zh-Hant');
  const ownedIds = new Set((inventory?.trainees || []).map(row => Number(row.outfitId)));
  return (gameCatalog?.characterCards || [])
    .filter(card => {
      if (!normalized) return true;
      return [card.id, card.nameZhTw, card.name, card.nameJp, card.titleZhTw, card.title]
        .some(value => String(value || '').toLocaleLowerCase('zh-Hant').includes(normalized));
    })
    .sort((left, right) => Number(ownedIds.has(Number(right.id))) - Number(ownedIds.has(Number(left.id)))
      || String(left.nameZhTw || left.name || left.nameJp || '').localeCompare(String(right.nameZhTw || right.name || right.nameJp || ''), 'zh-Hant')
      || Number(left.id) - Number(right.id));
}

function renderManualLineagePicker(query = byId('lineageHorseSearch')?.value || '') {
  const results = byId('lineageHorseResults');
  const status = byId('lineageHorseSearchStatus');
  if (!results || !manualLineagePickerSlotId) return;
  const matches = manualLineagePickerResults(query);
  const visible = matches.slice(0, 90);
  if (status) status.textContent = `找到 ${matches.length} 張衣裝${matches.length > visible.length ? `，先顯示 ${visible.length} 張` : ''}。持有快照排在前面。`;
  results.innerHTML = visible.length ? visible.map(card => {
    const owned = inventoryTraineeByOutfitId.has(Number(card.id));
    const selected = Number(state.manualLineage?.slots?.[manualLineagePickerSlotId]) === Number(card.id);
    return `<button type="button" class="lineage-horse-result${selected ? ' is-selected' : ''}" data-manual-lineage-choose="${Number(card.id)}">
      ${traineePortraitMarkup(card, 'lineage-horse-result-portrait')}
      <span><strong>${escapeHtml(card.nameZhTw || card.name || card.nameJp || `衣裝 ${card.id}`)}</strong><small>${escapeHtml(card.titleZhTw || card.title || `衣裝編號 ${card.id}`)}・${owned ? '持有快照' : '資料庫候選'}</small>${manualLineageAptitudeMarkup(card, 'is-dialog')}</span>
    </button>`;
  }).join('') : '<p class="empty-state">沒有符合的衣裝；可改用角色名稱、衣裝名或編號搜尋。</p>';
  results.querySelectorAll('[data-manual-lineage-choose]').forEach(button => {
    button.onclick = () => {
      const outfitId = Number(button.dataset.manualLineageChoose);
      if (!Number.isFinite(outfitId)) return;
      const slotId = manualLineagePickerSlotId;
      const previousOutfitId = Number(state.manualLineage?.slots?.[slotId]);
      const optionalRaceCount = state.manualLineage?.optionalRaces?.[slotId]?.length || 0;
      if (
        previousOutfitId > 0
        && previousOutfitId !== outfitId
        && optionalRaceCount > 0
        && !window.confirm(`更換衣裝會清除這一格的 ${optionalRaceCount} 場手動加賽；紅因子目標會保留。確定更換？`)
      ) return;
      if (previousOutfitId > 0 && previousOutfitId !== outfitId) {
        state.manualLineage.optionalRaces[slotId] = [];
      }
      state.manualLineage.slots[slotId] = outfitId;
      state.manualLineage.activeScheduleSlot = slotId;
      byId('lineageHorseDialog')?.close();
      manualLineagePickerSlotId = null;
      manualLineageRedEditorSlotId = null;
      renderManualLineageWorkbench();
      scheduleSave();
    };
  });
}

function openManualLineagePicker(slotId) {
  if (!manualLineageSlotIds.includes(slotId)) return;
  manualLineagePickerSlotId = slotId;
  const dialog = byId('lineageHorseDialog');
  const search = byId('lineageHorseSearch');
  const title = byId('lineageHorseDialogTitle');
  if (title) title.textContent = `${manualLineageSlotDefinition(slotId).label}・選擇衣裝`;
  if (search) search.value = '';
  renderManualLineagePicker('');
  if (typeof dialog?.showModal === 'function') dialog.showModal();
  else dialog?.setAttribute('open', '');
  requestAnimationFrame(() => search?.focus());
}

function manualLineageResolvedOptionalRaces(slotId) {
  return (state.manualLineage?.optionalRaces?.[slotId] || []).map(row => {
    const race = raceById.get(Number(row.catalogRaceId));
    return {
      ...(race || {}),
      id: row.id,
      catalogRaceId: Number(row.catalogRaceId),
      canonicalRaceId: Number(race?.raceId ?? row.canonicalRaceId) || null,
      turn: Number(row.turn),
      nameZhTw: race?.nameZhTw || row.nameZhTw || race?.nameJp || '未命名 GⅠ',
      isGoalRace: false,
      kind: 'optional-race',
      requirementLevel: row.requirementLevel || 'OPTIONAL',
      reason: row.reason || '使用者手動加入族譜賽程',
      server: row.server || 'zh_tw',
      ruleset: row.ruleset || 'zh_tw-2024-06-27',
      mappingStatus: race ? 'LOCAL_CATALOG_MATCHED' : 'USER_INPUT_UNRESOLVED',
      sourceStatus: race ? 'USER_RECORDED_TURN_LOCAL_CATALOG' : 'USER_RECORDED_CATALOG_MISSING'
    };
  });
}

function manualLineageSharedG1Summary() {
  if (manualLineageScheduleBundle?.familySummary?.sharedG1Drafts) {
    return manualLineageScheduleBundle.familySummary.sharedG1Drafts.map(row => ({
      catalogRaceId: row.catalogRaceId,
      count: row.slotCount,
      sourceSlotIds: row.sourceSlotIds,
      race: raceById.get(Number(row.catalogRaceId)),
      status: row.status,
      scoreIncluded: false
    }));
  }
  const counts = new Map();
  manualLineageSlotIds.filter(slotId => slotId !== 'target').forEach(slotId => {
    const card = manualLineageCardForSlot(slotId);
    const goalSchedule = state.manualLineage.includeGoalRaces && card
      ? factorExecutionCore?.scheduleForCharacter?.(goalRaceSchedules, card.characterId)
      : null;
    const goalG1Ids = (goalSchedule?.goals || [])
      .filter(row => Number(row.grade) === 100)
      .map(row => Number(row.catalogRaceId))
      .filter(Number.isFinite);
    const unique = new Set([
      ...(state.manualLineage?.optionalRaces?.[slotId] || []).map(row => Number(row.catalogRaceId)),
      ...goalG1Ids
    ].filter(Number.isFinite));
    unique.forEach(id => counts.set(id, (counts.get(id) || 0) + 1));
  });
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([catalogRaceId, count]) => ({ catalogRaceId, count, race: raceById.get(catalogRaceId) }))
    .sort((left, right) => right.count - left.count || left.catalogRaceId - right.catalogRaceId);
}

function manualLineageScheduleAnalysis(slotId = state.manualLineage?.activeScheduleSlot) {
  return manualLineageScheduleBundle?.bySlot?.[slotId] || null;
}

function buildManualLineageScheduleBundle() {
  if (typeof factorExecutionCore?.analyzeManualLineageSchedules !== 'function') return null;
  const slots = Object.fromEntries(manualLineageSlotIds.map(slotId => {
    const card = manualLineageCardForSlot(slotId);
    return [slotId, {
      card,
      goalSchedule: card
        ? factorExecutionCore.scheduleForCharacter?.(goalRaceSchedules, card.characterId) || null
        : null,
      optionalRaces: manualLineageResolvedOptionalRaces(slotId)
    }];
  }));
  const redProjection = typeof manualLineageRedProjectionCore?.buildProjectedG1Schedule === 'function'
    ? manualLineageRedProjectionCore.buildProjectedG1Schedule({
      state: state.manualLineage,
      slots,
      slotIds: manualLineageSlotIds,
      raceCatalog: gameCatalog?.races || [],
      g1ScheduleCore,
      automationMode: 'manual'
    })
    : null;
  const analysis = factorExecutionCore.analyzeManualLineageSchedules({
    slotIds: manualLineageSlotIds,
    slots,
    includeGoalRaces: state.manualLineage.includeGoalRaces,
    raceDensityPolicy: factorExecutionProfile.raceDensityPolicy || {},
    windowPolicy: { minimumTurn: 1, maximumTurn: 72, bufferTurns: 1 }
  });
  const optionalCanonicalFrequency = new Map();
  manualLineageSlotIds.filter(slotId => slotId !== 'target').forEach(slotId => {
    const ids = [...new Set((slots[slotId]?.optionalRaces || [])
      .map(row => Number(row.canonicalRaceId)).filter(Number.isFinite))];
    ids.forEach(id => optionalCanonicalFrequency.set(id, (optionalCanonicalFrequency.get(id) || 0) + 1));
  });
  const sharedCanonicalRaceIds = [...optionalCanonicalFrequency.entries()]
    .filter(([, count]) => count >= 2)
    .map(([id]) => id);
  const g1FoundationPlan = typeof g1ScheduleCore?.planLineageG1Foundation === 'function'
    ? g1ScheduleCore.planLineageG1Foundation({
        raceCatalog: gameCatalog?.races || [],
        candidates: manualLineageSlotIds.filter(slotId => slotId !== 'target')
          .map(slotId => {
            const card = slots[slotId]?.card;
            if (!card) return null;
            return {
              id: `manual:${slotId}`,
              slot: slotId,
              outfitId: Number(card.id),
              characterId: Number(card.characterId),
              nameZhTw: card.nameZhTw || card.name || card.nameJp,
              aptitude: Array.isArray(card.aptitude) ? [...card.aptitude] : [],
              goalSchedule: slots[slotId]?.goalSchedule || null
            };
          }).filter(Boolean),
        sharedCanonicalRaceIds,
        desiredBuckets: ['turf-mile', 'turf-medium'],
        routeRequiredRank: 'C',
        server: 'zh_tw'
      })
    : null;
  const g1FoundationBySlot = Object.fromEntries((g1FoundationPlan?.candidatePlans || [])
    .map(candidatePlan => [String(candidatePlan.candidateId || '').replace(/^manual:/, ''), candidatePlan])
    .filter(([slotId]) => slotId));
  return {
    ...analysis,
    bySlot: Object.fromEntries(manualLineageSlotIds.map(slotId => {
      const projected = redProjection?.bySlot?.[slotId] || null;
      return [slotId, {
        ...(analysis.bySlot?.[slotId] || { slotId }),
        // This is a directional projection from the manually selected
        // upstream outputs.  It is deliberately separate from the native
        // factor-execution aptitude assessment and never a win probability.
        redProjection: projected,
        projectedG1Plan: projected?.g1Plan || null,
        g1FoundationRoutePlan: g1FoundationBySlot[slotId] || null
      }];
    })),
    redProjection,
    g1FoundationPlan
  };
}

function manualLineageScheduleStatusLabel(status) {
  return {
    READY: '目前可排',
    READY_WITH_TRADEOFFS: '可排，但有取捨',
    READY_WITH_WARNINGS: '可排，資料待確認',
    BLOCKED: '有硬衝突',
    UNVERIFIED: '資料未齊',
    EMPTY: '未選角色'
  }[status] || '等待分析';
}

function manualLineageRedProjectionSummaryMarkup(projection) {
  if (!projection) return '';
  const factors = Array.isArray(projection.incomingRedFactors)
    ? projection.incomingRedFactors
    : [];
  const factorText = factors.length
    ? factors.map(factor => {
      const bonus = Number.isFinite(Number(factor.startBonus))
        ? `，開局 +${Number(factor.startBonus)}`
        : '';
      return `${factor.nameZhTw || factor.key} ${Number(factor.stars) || 0}★${bonus}`;
    }).join('、')
    : '未配置';
  const sourceSlotIds = [...new Set((projection.sourceEntries || [])
    .map(entry => entry.sourceSlotId)
    .filter(Boolean))];
  const sourceText = sourceSlotIds.length
    ? `來源：${sourceSlotIds.map(slotId => manualLineageSlotDefinition(slotId).shortLabel).join('＋')}`
    : '沒有上游槽輸出';
  return `<article data-red-projection-status="PROJECTED">
    <span>PROJECTED incoming red</span>
    <strong>${escapeHtml(factorText)}</strong>
    <small>${escapeHtml(sourceText)}；UNVERIFIED，僅作適性／GⅠ排程投影，不代表已繼承或勝率。</small>
  </article>`;
}

function renderManualLineageSchedule() {
  const analyzer = byId('lineageScheduleAnalyzer');
  const title = byId('lineageScheduleAnalyzerTitle');
  const badge = byId('lineageScheduleStatusBadge');
  const summary = byId('lineageScheduleSummary');
  const timeline = byId('lineageScheduleTimeline');
  const windows = byId('lineageScheduleWindows');
  const decision = byId('lineageScheduleDecision');
  const form = byId('lineageOptionalRaceForm');
  if (!analyzer || !title || !badge || !summary || !timeline || !windows || !decision || !form) return;
  const slotId = state.manualLineage?.activeScheduleSlot || 'target';
  const slot = manualLineageSlotDefinition(slotId);
  const card = manualLineageCardForSlot(slotId);
  const analysis = manualLineageScheduleAnalysis(slotId);
  title.textContent = card
    ? `${slot.label}・${card.nameZhTw || card.name || card.nameJp || `衣裝 ${card.id}`}`
    : `${slot.label}・尚未選馬`;
  analyzer.dataset.status = analysis?.status || 'UNVERIFIED';
  badge.textContent = manualLineageScheduleStatusLabel(analysis?.status || 'UNVERIFIED');
  [...form.elements].forEach(element => { element.disabled = !card; });
  if (!card || !analysis) {
    summary.innerHTML = '<p class="empty-state">先在左側選一張衣裝，再按「分析賽程」。</p>';
    timeline.innerHTML = '';
    windows.innerHTML = '';
    decision.innerHTML = '';
    return;
  }
  const sharedG1 = manualLineageSharedG1Summary();
  const redProjection = analysis.redProjection;
  const familyFoundation = manualLineageScheduleBundle?.g1FoundationPlan || null;
  const slotFoundation = analysis.g1FoundationRoutePlan || null;
  const foundationRouteId = familyFoundation?.recommendedRoute?.id || slotFoundation?.recommendedRoute?.id || '';
  const foundationRoute = slotFoundation?.routes?.[foundationRouteId] || slotFoundation?.recommendedRoute || null;
  summary.innerHTML = `<article><span>硬衝突</span><strong>${analysis.blockers.length}</strong><small>同回合兩場才會阻塞</small></article>
    <article><span>可妥協成本</span><strong>${analysis.tradeoffs.length}</strong><small>連戰或原生適性低於 B</small></article>
    <article><span>資料缺口</span><strong>${analysis.warnings.length}</strong><small>目標賽對應或適性未知</small></article>
    <article><span>共同 GⅠ 草稿</span><strong>${sharedG1.length}</strong><small>至少兩個親代槽手動排入</small></article>
    <article><span>GⅠ 底座主線</span><strong>${escapeHtml(foundationRoute?.label || familyFoundation?.recommendedRoute?.label || '待確認')}</strong><small>${foundationRoute ? escapeHtml((foundationRoute.races || []).map(row => row.nameZhTw).filter(Boolean).join('・')) : '選滿六個親代槽後才能對齊'}</small></article>
    ${manualLineageRedProjectionSummaryMarkup(redProjection)}`;
  const factor = state.manualLineage?.redFactors?.[slotId];
  const factorType = manualLineageRedFactorTypes.find(row => row.key === factor?.key);
  const placedRaceMarkup = analysis.races.map(row => {
      const aptitude = row.aptitudeAssessment || {};
      const aptitudeText = [
        aptitude.surfaceRank ? `場地 ${aptitude.surfaceRank}` : '',
        aptitude.distanceRank ? `距離 ${aptitude.distanceRank}` : ''
      ].filter(Boolean).join('・') || '適性未知';
      const plannedRed = factorType && aptitude.requiredRedKeys?.includes(factorType.key)
        ? `｜本槽 outgoing red：${factorType.label} ${factor.stars}★；不作本槽 incoming`
        : '';
      return `<li data-race-kind="${row.isGoalRace ? 'goal' : 'optional'}" data-race-status="${escapeHtml(aptitude.status || 'UNVERIFIED')}">
        <b>第 ${row.turn} 回合</b>
        <span><strong>${escapeHtml(row.nameZhTw || row.nameJp || '未命名賽事')}</strong><small>${row.isGoalRace ? '育成目標' : '手動加賽'}・${escapeHtml(aptitudeText + plannedRed)}</small></span>
        <em>${row.mappingStatus === 'LOCAL_CATALOG_MATCHED' ? '本地賽事已對應' : row.isGoalRace ? '社群目標賽' : '使用者回合＋本地賽事'}</em>
        ${row.isGoalRace ? '' : `<button type="button" data-manual-optional-race-remove="${escapeHtml(row.id)}" aria-label="移除第 ${row.turn} 回合 ${escapeHtml(row.nameZhTw || row.nameJp || '可選賽')}">移除</button>`}
      </li>`;
    }).join('');
  const unplacedRaceMarkup = (analysis.unplacedRows || []).map(row => `<li data-race-kind="unplaced" data-race-status="UNVERIFIED">
    <b>回合未知</b><span><strong>${escapeHtml(row.nameZhTw || row.nameJp || '未命名賽事')}</strong><small>${row.isGoalRace ? '社群育成目標' : '手動加賽'}・不參與衝突、連戰或窗口計算</small></span><em>UNVERIFIED</em>
  </li>`).join('');
  const terminalMarkup = (analysis.terminalBoundaries || []).length
    ? `<p class="lineage-terminal-boundaries"><strong>育成終端邊界</strong><span>${analysis.terminalBoundaries.map(row => `第 ${row.turn} 回合`).join('・')}</span><small>只作顯示，不是賽事，也不進密度計算。</small></p>`
    : '';
  timeline.innerHTML = placedRaceMarkup || unplacedRaceMarkup
    ? `<h6>回合時間線</h6><ol>${placedRaceMarkup}${unplacedRaceMarkup}</ol>${terminalMarkup}`
    : '<p class="empty-state">目前沒有可顯示的回合。若關閉了目標賽，可在上方手動加入 GⅠ。</p>';
  timeline.querySelectorAll('[data-manual-optional-race-remove]').forEach(button => {
    button.onclick = () => {
      state.manualLineage.optionalRaces[slotId] = (state.manualLineage.optionalRaces[slotId] || [])
        .filter(row => row.id !== button.dataset.manualOptionalRaceRemove);
      renderManualLineageWorkbench();
      scheduleSave();
    };
  });
  const usefulWindows = analysis.planningWindows.filter(row => row.length >= 2).slice(0, 4);
  windows.innerHTML = `<h6>低密度回合窗口</h6>${usefulWindows.length
    ? `<div>${usefulWindows.map(row => `<article><strong>第 ${row.from}–${row.to} 回合</strong><span>${row.length} 個低密度回合</span><small>只按目前時間線前後各留 1 回合；仍需你確認賽事實際可選日期。</small></article>`).join('')}</div>`
    : '<p>目前沒有長度至少 2 回合的低密度窗口；先移動可選賽或取消不重要的加賽。</p>'}`;
  const primaryGain = `${analysis.goals.length} 個育成目標已列入、${analysis.optionalRaces.length} 場 GⅠ由你明確加排`;
  const sacrifice = analysis.blockers[0]?.message
    || analysis.tradeoffs[0]?.message
    || analysis.warnings[0]?.message
    || '目前沒有已辨識的硬衝突或軟成本；這不等於勝率或因子結果已確認。';
  decision.innerHTML = `<h6>這個排法代表什麼</h6><div>
    <article data-decision-kind="foundation"><span>GⅠ 底座</span><strong>${escapeHtml(foundationRoute?.label || '路線待確認')}：${escapeHtml((foundationRoute?.races || []).map(row => row.nameZhTw).filter(Boolean).join('・') || '賽事資料待確認')}</strong><small>${foundationRoute?.builtInGoalMatches?.length ? `這一格有 ${foundationRoute.builtInGoalMatches.length} 場固定目標賽對齊。` : '這一格沒有對齊的三冠固定目標賽；主線來自全家系裁決。'}</small></article>
    <article data-decision-kind="dirt"><span>泥地分支</span><strong>${escapeHtml(lineageQuickDirtText(slotFoundation?.dirtDecision))}</strong><small>只在固定目標賽或兩格以上共同泥地 GⅠ 時考慮付紅因子成本。</small></article>
    <article data-decision-kind="gain"><span>得到什麼</span><strong>${escapeHtml(primaryGain)}</strong><small>${sharedG1.length ? `六親代目前有 ${sharedG1.length} 場共同 GⅠ 草稿。` : '共同 GⅠ 需在其他親代槽也手動加入同場賽事後才會出現。'}</small></article>
    <article data-decision-kind="sacrifice"><span>犧牲什麼</span><strong>${escapeHtml(sacrifice)}</strong><small>推薦缺口可以妥協；同回合衝突不可以。</small></article>
    <article data-decision-kind="sensitive"><span>最敏感假設</span><strong>${escapeHtml(analysis.sensitivity.label)}</strong><small>${escapeHtml(analysis.sensitivity.detail)}</small></article>
  </div>`;
}

function renderManualLineageWorkbench(plan = null) {
  const root = byId('manualLineageWorkbench');
  const tree = byId('manualLineageTree');
  const redSummary = byId('manualLineageRedSummary');
  if (!root || !tree || !redSummary) return;
  state.manualLineage = normalizeManualLineageState(state.manualLineage);
  manualLineageScheduleBundle = buildManualLineageScheduleBundle();
  const analysis = manualLineageScheduleAnalysis();
  root.dataset.status = analysis?.status || 'UNVERIFIED';
  root.dataset.probabilityStatus = 'NOT_COMPUTED';
  root.dataset.activeScheduleSlot = state.manualLineage.activeScheduleSlot;
  tree.innerHTML = manualLineageTreeMarkup();
  redSummary.innerHTML = manualLineageRedSummaryMarkup();
  const includeGoals = byId('manualLineageIncludeGoals');
  if (includeGoals) includeGoals.checked = state.manualLineage.includeGoalRaces;
  const recommended = byId('manualLineageUseRecommended');
  if (recommended) recommended.disabled = !plan && !selectedBattleUmaCard();
  const battleTarget = byId('manualLineageUseBattleTarget');
  if (battleTarget) battleTarget.disabled = !selectedBattleUmaCard();
  renderManualLineageSchedule();
}

function initManualLineageWorkbench() {
  const tree = byId('manualLineageTree');
  const dialog = byId('lineageHorseDialog');
  const includeGoals = byId('manualLineageIncludeGoals');
  const form = byId('lineageOptionalRaceForm');
  const raceSelect = byId('lineageOptionalRaceCatalog');
  if (!tree || !dialog || !includeGoals || !form || !raceSelect) return;
  if (!(Number(state.manualLineage?.slots?.target) > 0) && selectedBattleUmaCard()) {
    state.manualLineage.slots.target = Number(selectedBattleUmaCard().id);
  }
  const g1Races = (gameCatalog?.races || [])
    .filter(race => Number(race.grade) === 100)
    .sort((left, right) => String(left.nameZhTw || left.nameJp || '').localeCompare(String(right.nameZhTw || right.nameJp || ''), 'zh-Hant'));
  raceSelect.innerHTML = g1Races.map(race => `<option value="${Number(race.id)}">${escapeHtml(race.nameZhTw || race.nameJp || `GⅠ ${race.id}`)}｜${race.distance}m・${Number(race.groundType) === 2 ? '泥地' : '草地'}</option>`).join('');
  tree.addEventListener('click', event => {
    const pick = event.target.closest('[data-manual-lineage-pick]');
    if (pick) {
      openManualLineagePicker(pick.dataset.manualLineagePick);
      return;
    }
    const red = event.target.closest('[data-manual-red-open]');
    if (red) {
      manualLineageRedEditorSlotId = manualLineageRedEditorSlotId === red.dataset.manualRedOpen
        ? null
        : red.dataset.manualRedOpen;
      renderManualLineageWorkbench();
      return;
    }
    const schedule = event.target.closest('[data-manual-schedule-slot]');
    if (schedule) {
      state.manualLineage.activeScheduleSlot = schedule.dataset.manualScheduleSlot;
      renderManualLineageWorkbench();
      scheduleSave();
      return;
    }
    const reset = event.target.closest('[data-manual-red-reset]');
    if (reset) {
      state.manualLineage.redFactors[reset.dataset.manualRedReset] = null;
      renderManualLineageWorkbench();
      scheduleSave();
    }
  });
  tree.addEventListener('change', event => {
    const typeSelect = event.target.closest('[data-manual-red-type]');
    if (typeSelect) {
      const slotId = typeSelect.dataset.manualRedType;
      state.manualLineage.redFactors[slotId] = typeSelect.value
        ? { key: typeSelect.value, stars: Number(state.manualLineage.redFactors[slotId]?.stars) || 3 }
        : null;
      renderManualLineageWorkbench();
      scheduleSave();
      return;
    }
    const starSelect = event.target.closest('[data-manual-red-stars]');
    if (starSelect) {
      const slotId = starSelect.dataset.manualRedStars;
      const factor = state.manualLineage.redFactors[slotId];
      if (factor?.key) factor.stars = Math.max(1, Math.min(3, Number(starSelect.value) || 1));
      renderManualLineageWorkbench();
      scheduleSave();
    }
  });
  includeGoals.onchange = () => {
    state.manualLineage.includeGoalRaces = includeGoals.checked;
    renderManualLineageWorkbench();
    scheduleSave();
  };
  byId('manualLineageUseRecommended').onclick = () => {
    const plan = buildActiveReverseLineagePlan();
    if (!plan) return;
    const recommendedSlots = manualLineageRecommendedSlots(plan);
    const affectedOptionalRaces = manualLineageSlotIds.reduce((sum, slotId) => {
      const changed = Number(state.manualLineage.slots[slotId]) !== Number(recommendedSlots[slotId]);
      return sum + (changed ? state.manualLineage.optionalRaces[slotId]?.length || 0 : 0);
    }, 0);
    if (affectedOptionalRaces > 0 && !window.confirm(`套用推薦會更換部分衣裝，並清除受影響槽位的 ${affectedOptionalRaces} 場手動加賽；紅因子目標會保留。確定套用？`)) return;
    manualLineageSlotIds.forEach(slotId => {
      if (Number(state.manualLineage.slots[slotId]) !== Number(recommendedSlots[slotId])) {
        state.manualLineage.optionalRaces[slotId] = [];
      }
    });
    state.manualLineage.slots = recommendedSlots;
    state.manualLineage.activeScheduleSlot = 'target';
    renderManualLineageWorkbench(plan);
    scheduleSave();
  };
  byId('manualLineageUseBattleTarget').onclick = () => {
    const card = selectedBattleUmaCard();
    if (!card) return;
    const targetChanged = Number(state.manualLineage.slots.target) !== Number(card.id);
    const optionalRaceCount = state.manualLineage.optionalRaces.target?.length || 0;
    if (targetChanged && optionalRaceCount > 0 && !window.confirm(`同步戰馬會清除本命槽的 ${optionalRaceCount} 場手動加賽；紅因子目標會保留。確定同步？`)) return;
    if (targetChanged) state.manualLineage.optionalRaces.target = [];
    state.manualLineage.slots.target = Number(card.id);
    state.manualLineage.activeScheduleSlot = 'target';
    renderManualLineageWorkbench();
    scheduleSave();
  };
  byId('manualLineageReset').onclick = () => {
    if (!window.confirm('確定重設手動七格、紅因子與各槽加賽？既有自動推薦與種馬資料庫不會被刪除。')) return;
    state.manualLineage = defaultManualLineageState();
    manualLineageRedEditorSlotId = null;
    renderManualLineageWorkbench();
    scheduleSave();
  };
  byId('lineageHorseSearch').oninput = event => renderManualLineagePicker(event.target.value);
  byId('lineageHorseClearSlot').onclick = () => {
    const slotId = manualLineagePickerSlotId;
    if (!manualLineageSlotIds.includes(slotId)) return;
    state.manualLineage.slots[slotId] = null;
    state.manualLineage.redFactors[slotId] = null;
    state.manualLineage.optionalRaces[slotId] = [];
    dialog.close();
    manualLineagePickerSlotId = null;
    manualLineageRedEditorSlotId = null;
    renderManualLineageWorkbench();
    scheduleSave();
  };
  byId('lineageHorseDialogClose').onclick = () => dialog.close();
  dialog.addEventListener('close', () => { manualLineagePickerSlotId = null; });
  form.onsubmit = event => {
    event.preventDefault();
    const slotId = state.manualLineage.activeScheduleSlot;
    const turn = Math.trunc(Number(byId('lineageOptionalRaceTurn').value));
    const catalogRaceId = Number(raceSelect.value);
    const race = raceById.get(catalogRaceId);
    if (!manualLineageCardForSlot(slotId) || !Number.isFinite(turn) || turn < 1 || turn > 99 || !race) return;
    state.manualLineage.optionalRaces[slotId].push({
      id: persistenceCore?.createId?.('optional-race') || `optional-race-${Date.now()}`,
      turn,
      catalogRaceId,
      canonicalRaceId: Number(race.raceId) || null,
      nameZhTw: race.nameZhTw || race.nameJp || '',
      requirementLevel: 'OPTIONAL',
      reason: '使用者手動加入族譜賽程',
      server: 'zh_tw',
      ruleset: 'zh_tw-2024-06-27',
      sourceStatus: 'USER_RECORDED'
    });
    byId('lineageOptionalRaceTurn').value = '';
    renderManualLineageWorkbench();
    scheduleSave();
  };
  renderManualLineageWorkbench();
}

function renderReverseLineagePlan() {
  const quickStart = byId('breederQuickStart');
  const quickContent = byId('breederQuickContent');
  const route = byId('factorRoute');
  const tree = byId('reverseLineageTree');
  const buildSteps = byId('lineageBuildSteps');
  const summary = byId('lineagePlanSummary');
  const workflowDashboard = byId('lineageWorkflowDashboard');
  const scenario = byId('factorScenarioRecommendation');
  const notes = byId('lineageModelNotes');
  if (!quickStart || !quickContent || !route || !tree || !buildSteps || !summary || !workflowDashboard || !scenario || !notes) return;
  const plan = buildActiveReverseLineagePlan();
  renderManualLineageWorkbench(plan);
  const factorTargets = reverseLineageFactorTargets();
  if (!plan) {
    quickStart.dataset.status = 'NEEDS_INPUT';
    quickContent.innerHTML = lineageQuickStartMarkup(null, null);
    bindBreederQuickStart(quickStart, buildSteps, null);
    renderGoalContractChain(null);
    summary.innerHTML = '<p class="empty-state">先選擇戰馬，系統才會從最終需求往回排兩親代、四祖代與前置素材。</p>';
    workflowDashboard.innerHTML = '<p class="empty-state">完成前兩步後，這裡會顯示唯一下一步、硬阻塞與可妥協缺口。</p>';
    route.dataset.policyId = '';
    route.dataset.nextStepId = '';
    route.dataset.planStatus = 'EMPTY';
    route.dataset.executionStatus = factorExecutionAssessment()?.assessment?.status || 'UNVERIFIED';
    tree.innerHTML = '';
    buildSteps.innerHTML = '';
    scenario.innerHTML = '';
    notes.innerHTML = '';
    return;
  }
  if (pruneInvalidLineageRecordBindings(plan)) scheduleSave();
  renderGoalContractChain(plan);

  const parentSteps = plan.workOrder.filter(step => step.stage === 'parent');
  const branchRows = ['A', 'B'].map((branch, branchIndex) => {
    const parent = plan.directParents[branchIndex];
    const parentStep = parentSteps.find(step => step.id === `parent:${branch}`);
    const parentTargets = parentStep?.targets || [];
    const grandparents = plan.grandparents.filter(item => item?.branch === branch);
    return `<section class="reverse-lineage-branch">
      <div class="lineage-branch-label"><span>支系 ${branch}</span><strong>${branch === 'A' ? '主親代路線' : '副親代路線'}</strong></div>
      ${lineageCandidateCard(parent, '直接親代・固有確定', parentTargets, parent ? `供應最終戰馬的直接親代槽` : '尚未選出直接親代', { step: parentStep, plan, summaryOnly: true })}
      <div class="lineage-branch-connector" aria-hidden="true">↑ 由以下兩名祖代育成</div>
      <div class="lineage-grandparent-grid">
        ${grandparents.map((grandparent, index) => {
          const step = plan.workOrder.find(item => item.id === `grandparent:${grandparent.slot}`);
          return lineageCandidateCard(
            grandparent,
            `祖代 ${index + 1}・抽選來源`,
            grandparent.factorTargets,
            `供應${lineageSlotLabel(grandparent.slot)}；由前置素材育成`,
            { step, plan, summaryOnly: true }
          );
        }).join('')}
      </div>
      <div class="lineage-blueprint-foundations">${grandparents.map(grandparent =>
        lineageFoundationMaterialsMarkup(plan, grandparent)
      ).join('')}</div>
    </section>`;
  }).join('');
  tree.innerHTML = `<div class="lineage-target-card">
      ${traineePortraitMarkup(plan.target, 'lineage-target-portrait')}
      <div><span>最終服務目標</span><strong>${escapeHtml(plan.target.nameZhTw)} ${escapeHtml(plan.target.outfitTitleZhTw || '')}</strong><small>所有往前的種馬只為這張戰馬服務</small><div class="lineage-factor-chips">${factorTargetChips(factorTargets, 4)}${lineageG1ChipMarkup(plan.target, plan.workOrder.find(step => step.id === 'target'), plan)}</div></div>
    </div>
    <div class="lineage-target-connector" aria-hidden="true">↑ 使用兩名直接親代</div>
    <div class="reverse-lineage-branches">${branchRows}</div>`;
  // Reaching the reverse-lineage result is already an explicit on-demand
  // action. Load every identity in this bounded seven-slot tree now instead
  // of leaving off-screen ancestors at the browser's lazy-load discretion.
  tree.querySelectorAll('img[loading="lazy"]').forEach(image => {
    image.loading = 'eager';
  });

  const orderedSteps = [...plan.workOrder].sort((left, right) => Number(left.order) - Number(right.order));
  const workflow = lineagePlanWorkflowSummary(plan, orderedSteps);
  const workflowNextId = workflow.focusState?.step?.id || '';
  route.dataset.policyId = plan?.decisionPolicy?.id || 'probabilistic-balanced-v1';
  route.dataset.nextStepId = workflow.nextState?.step?.id || '';
  route.dataset.planStatus = workflow.blockerCount
    ? 'BLOCKED'
    : (workflow.tradeoffStepCount ? 'READY_WITH_TRADEOFFS' : 'READY');
  route.dataset.executionStatus = factorExecutionAssessment()?.assessment?.status || 'UNVERIFIED';
  if (
    !orderedSteps.some(step => step.id === lineageOpenStepId)
    || (lineageStepViewMode === 'next' && lineageOpenStepId !== workflowNextId)
  ) {
    lineageOpenStepId = workflowNextId || orderedSteps[0]?.id || null;
  }
  const workflowByStepId = new Map(workflow.states.map(item => [item.step.id, item]));
  buildSteps.innerHTML = `<ol class="lineage-linear-list">${orderedSteps
    .map(step => lineageStepMarkup(
      step,
      plan,
      lineageOpenStepId,
      workflowByStepId.get(step.id),
      workflowNextId
    ))
    .join('')}</ol>`;
  bindLineageStepDisclosure(buildSteps);
  applyLineageStepView(buildSteps);
  quickStart.dataset.status = workflow.nextState ? 'NEXT_STEP_READY' : 'COMPLETE';
  quickContent.innerHTML = lineageQuickStartMarkup(plan, workflow);
  bindBreederQuickStart(quickStart, buildSteps, workflow);
  workflowDashboard.innerHTML = lineageWorkflowDashboardMarkup(plan, workflow);
  const nextAction = workflowDashboard.querySelector('[data-lineage-next-action]');
  if (nextAction && workflow.nextState) {
    nextAction.addEventListener('click', () => {
      const workbench = byId('lineageWorkbenchDetails');
      if (workbench) workbench.open = true;
      lineageStepViewMode = 'next';
      applyLineageStepView(buildSteps);
      const detail = [...buildSteps.querySelectorAll('details[data-lineage-step-id]')]
        .find(item => item.dataset.lineageStepId === workflow.nextState.step.id);
      if (!detail) return;
      detail.open = true;
      detail.querySelector('summary')?.focus();
      detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  const completeParents = plan.directParents.filter(Boolean).length;
  const completeGrandparents = plan.grandparents.filter(Boolean).length;
  const critical = factorTargets.filter(target => target.kind === 'acceleration');
  summary.innerHTML = `
    <article><span>直接親代候選已選</span><strong>${completeParents}／2</strong><small>不是已養成；完成度請看上方交棒進度</small></article>
    <article><span>四祖代候選已選</span><strong>${completeGrandparents}／4</strong><small>不是已產出；固有與白因子仍是抽選</small></article>
    <article><span>最優先白因子</span><strong>${critical.length || 0} 項</strong><small>${critical.map(target => target.nameZhTw).join('、') || '目前加速已覆蓋'}</small></article>
    <article><span>最早起點</span><strong>${orderedSteps.filter(step => step.stage === 'foundation').length} 種素材</strong><small>重複角色已合併，可跨支系共用</small></article>
    ${lineagePlanContractMarkup(plan)}`;
  scenario.innerHTML = factorScenarioMarkup(plan, factorTargets);
  notes.innerHTML = `<p>${escapeHtml(plan.assumptions.activeLineage)}</p>
    <p>${escapeHtml(plan.assumptions.acquisition)}</p>
    <p>${escapeHtml(plan.assumptions.optimization)}</p>
    <p>${escapeHtml(plan.assumptions.g1Evidence || '')}</p>
    <p>${escapeHtml(plan.assumptions.redFactors || '')}</p>
    <p>${escapeHtml(plan.assumptions.tradeoffs || '')}</p>
    <p>${escapeHtml(plan.assumptions.probability || '')}</p>
    <p>候選圖片使用本地 GameTora 衣裝圖快取；原版與換裝版以衣裝編號分開，不再只顯示角色名稱。</p>
    <div class="lineage-source-links">${(factorRunStrategy?.sources || []).map(source =>
      `<a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.label)}</a>`
    ).join('')}</div>
    ${plan.warnings.length ? `<p class="guts-warning">${escapeHtml(plan.warnings.map(item => item.message).join(' '))}</p>` : ''}`;
}

function initReverseLineageControls() {
  const mode = byId('breedingAutomationMode');
  const factorSpecification = byId('factorSpecificationEnabled');
  if (!mode || !factorSpecification) return;
  mode.value = state.breedingAutomationMode;
  factorSpecification.checked = state.factorSpecificationEnabled;
  mode.onchange = () => {
    state.breedingAutomationMode = mode.value === 'omakase' ? 'omakase' : 'autonomous';
    renderReverseLineagePlan();
    scheduleSave();
  };
  factorSpecification.onchange = () => {
    state.factorSpecificationEnabled = factorSpecification.checked;
    renderReverseLineagePlan();
    scheduleSave();
  };
}

function coverageWeightLabel(value) {
  const numeric = Number(value) || 0;
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(2);
}

function step5CoverageMarkup(summary, options = {}) {
  if (!summary) {
    return '<strong>Step 5 語意覆蓋尚未可用</strong><span>覆蓋核心尚未載入；不以舊的自動配卡結果代替。</span>';
  }
  const factor = summary.factorCoverage || {};
  const direct = summary.directParentCoverage || {};
  const deckCards = confirmedBattleDeckCoverageCards();
  const deckState = !state.applyBattleDeckCoverage
    ? '已停用戰馬六卡扣除；本次按 0 張卡計算。'
    : deckCards.length === 6
      ? `已使用目前確認的 6 張實際戰馬卡。`
      : '六卡尚未確認或不符合完整驗證；本次按 0 張卡計算。';
  const partialCount = Number(factor.partialSkillIds?.length) || 0;
  const factorPercentage = Number(factor.percentage) || 0;
  const directPercentage = Number(direct.percentage) || 0;
  const acquisitionProxy = acquisitionScenarioProxy();
  const allCoverageRoutes = (summary.targets || [])
    .flatMap(target => target.coverageRoutes || []);
  const formalRoute = route => typeof planningSnapshotCore?.isFormalAcquisitionRoute === 'function'
    ? planningSnapshotCore.isFormalAcquisitionRoute(route)
    : route?.formal !== false && route?.bonusOnly !== true;
  const formalCoverageRoutes = allCoverageRoutes.filter(route =>
    formalRoute(route)
    && Number(route.coverageProbability ?? route.probability ?? 0) > 0
  );
  const auditOnlyRoutes = allCoverageRoutes.filter(route => !formalCoverageRoutes.includes(route));
  const sourceLabels = [...new Set(formalCoverageRoutes
    .map(route => route.label)
    .filter(Boolean))];
  const auditOnlyCount = auditOnlyRoutes.length;
  const randomOnlyCount = auditOnlyRoutes
    .filter(route => /random|unknown/i.test(String(route.routeType || route.sourceKind || route.eventKind || ''))
      || route.bonusOnly === true)
    .length;
  const compact = options.compact ? ' step5-coverage--compact' : '';
  sourceLabels.push(Number.isFinite(Number(acquisitionProxy.openingSkillCount))
    ? `明示序盤技能計數 N=${Number(acquisitionProxy.openingSkillCount)}（${acquisitionProxy.openingSkillCountSource}）`
    : '序盤技能計數尚未明示；activate_count_start 條件金技 fail-closed=0');
  return `<section class="step5-coverage${compact}" aria-label="Step 5 技能與因子覆蓋">
    <div class="step5-coverage-metrics">
      <article class="step5-coverage-metric" data-step5-factor-coverage="${factorPercentage}">
        <span>因子預期加權覆蓋</span>
        <strong>${factorPercentage}%</strong>
        <small>預期分子 ${coverageWeightLabel(factor.expectedCoveredWeight)}／目標權重 ${coverageWeightLabel(factor.totalWeight)}</small>
      </article>
      <article class="step5-coverage-metric" data-step5-direct-parent-coverage="${directPercentage}">
        <span>直接親代固有（另計）</span>
        <strong>${directPercentage}%</strong>
        <small>預期分子 ${coverageWeightLabel(direct.expectedCoveredWeight)}／直親目標權重 ${coverageWeightLabel(direct.totalWeight)}</small>
      </article>
    </div>
    <p class="step5-coverage-explanation">因子百分比只計白／綠／加速等因子目標；直接親代固有不進入該分母。${partialCount ? `其中 ${partialCount} 項為部分機率路線，` : ''}事件、提示與既有白因子只代表取得機率，不等於保證取得。</p>
    <details class="step5-coverage-details"><summary>查看取得來源與機率代理</summary><p>正式來源：${escapeHtml(sourceLabels.join('、') || '尚無可計來源')}${auditOnlyCount ? `；連續事件白技／隨機／未知事件 ${auditOnlyCount} 條僅稽核，不計推薦` : ''}${randomOnlyCount ? `；隨機事件 ${randomOnlyCount} 條僅列為額外，不計推薦` : ''}。</p><p>提示池機會 N=${acquisitionProxy.hintOpportunityCount}（${escapeHtml(acquisitionProxy.source)}；explicit=${acquisitionProxy.explicit ? 'true' : 'false'}）。${escapeHtml(acquisitionProxy.note)}</p><p>連續事件使用 ${Math.round(acquisitionProxy.continuousEventProbability * 100)}% heuristic proxy（${escapeHtml(acquisitionProxy.continuousEventProbabilitySource)}），不是官方保證。</p></details>
    <p class="step5-coverage-deck-state">${escapeHtml(deckState)}</p>
  </section>`;
}

function renderBattleCoverageSummary() {
  const container = byId('battleCoverageSummary');
  if (!container) return;
  const target = selectedBattleUmaCard();
  const targetLabel = target
    ? `${localizedUmaName(target.nameZhTw || target.name)} ${japaneseTextPattern.test(target.titleZhTw || target.title || '') ? '' : (target.titleZhTw || target.title || '')}`.trim()
    : '尚未指定戰馬衣裝';
  const deckCards = confirmedBattleDeckCoverageCards();
  const cardChips = deckCards.length
    ? deckCards.map(card => {
      const labels = localizedSupportLabels(card);
      return `<span>${supportTypeLabels[normalizeSupportType(card.supportType)] || card.supportType}・${escapeHtml(labels.name)}</span>`;
    }).join('')
    : '<span>未以預選或無效卡組扣除技能來源</span>';
  container.innerHTML = `<strong>目前反推基準</strong><span>${escapeHtml(targetLabel)}</span>
    <div class="battle-coverage-card-chips">${cardChips}</div>
    ${step5CoverageMarkup(buildStep5CoverageSummary())}`;
  renderGoalContractChain();
}

function accelerationAcquisitionText(candidate) {
  if (candidate?.sourceKind === 'parent-unique') {
    const resolved = skillCore?.resolveSkillSources(candidate.id, gameCatalog, inventory, plannerRules);
    const source = (resolved?.characterCards || [])
      .slice()
      .sort((a, b) => Number(b.routes?.includes('built-in')) - Number(a.routes?.includes('built-in')))[0];
    const rawTitle = source?.titleZhTw || source?.title || '';
    const sourceName = source
      ? `${localizedUmaName(source.nameZhTw || source.name)} ${japaneseTextPattern.test(rawTitle) ? '' : rawTitle}`.trim()
      : '持有該固有技能的親代';
    return `親代固有繼承：${sourceName}`;
  }
  const factorId = Number(candidate?.factorId || candidate?.id);
  const factorName = candidate?.factorName || localizedSkillName(factorId);
  const source = bestFactorSourceText(factorId) || bestFactorSourceText(candidate?.id);
  return source
    ? `白因子目標：${factorName}；育成來源：${source}`
    : `白因子目標：${factorName}；本地卡表尚未找到直接支援卡來源`;
}

function renderGuidedCourseTimeline(table = activeCourseAccelerationTable()) {
  const container = byId('guidedCourseTimeline');
  const facts = byId('guidedCourseFacts');
  const note = byId('guidedCourseModelNote');
  if (!container || !facts || !note) return;
  const timeline = table?.timeline;
  if (
    !timeline?.distance
    || timeline.geometryConfidence !== 'catalog'
    || !timeline.phases?.length
  ) {
    container.innerHTML = '<p class="guided-empty">這場賽事缺少確切賽道幾何，無法建立可靠時間軸與技能馬身。</p>';
    facts.innerHTML = timeline?.distance
      ? `<article><span>目前只有距離</span><strong>${Math.round(timeline.distance)}m</strong><small>未指定可對應的 courseId</small></article>`
      : '';
    note.textContent = '請改用正式賽事，或替自訂賽事指定確切 courseId；系統不會把粗略 2／3 分段冒充精確賽道分析。';
    return;
  }
  const phaseLabels = { 0: '序盤', 1: '中盤', 2: '後期前段', 3: '後期後段' };
  container.innerHTML = `
    <div class="course-timeline-head">
      <strong>${timeline.distance.toLocaleString('zh-TW')}m 賽道時間軸</strong>
      <span>後期從 ${Math.round(timeline.terminalStart).toLocaleString('zh-TW')}m 開始</span>
    </div>
    <div class="course-phase-track">
      ${(timeline.phases || []).map(phase => `
        <span class="course-phase course-phase--${phase.phase}" style="width:${((phase.end - phase.start) / timeline.distance * 100).toFixed(4)}%">
          <b>${phaseLabels[phase.phase] || `賽段 ${phase.phase}`}</b>
          <small>${Math.round(phase.start)}～${Math.round(phase.end)}m</small>
        </span>`).join('')}
      <i class="terminal-marker" style="left:${(timeline.terminalStart / timeline.distance * 100).toFixed(4)}%" aria-hidden="true"></i>
    </div>`;
  const terminalShape = timeline.terminalSegment?.kind === 'straight'
    ? '直線'
    : timeline.terminalSegment?.kind === 'corner'
      ? `第 ${timeline.terminalSegment.cornerNumber || '?'} 彎道`
      : '區段未知';
  const terminalSlope = timeline.terminalSlopes?.[0]?.direction === 'up'
    ? '上坡'
    : timeline.terminalSlopes?.[0]?.direction === 'down'
      ? '下坡'
      : '平路';
  const top = table.families?.find(item => item.actionable);
  facts.innerHTML = `
    <article><span>後期起點</span><strong>${Math.round(timeline.terminalStart)}m</strong><small>${terminalShape}・${terminalSlope}</small></article>
    <article><span>最高單技能參考</span><strong>${top ? `${top.expectedBashin.toFixed(2)} 馬身` : '未解析'}</strong><small>${top ? escapeHtml(top.name) : ''}</small></article>
    <article><span>排序依據</span><strong>預期馬身</strong><small>再乘發動條件可靠度</small></article>
    <article><span>最後衝刺前提</span><strong>足耐必須通過</strong><small>否則最後衝刺型加速會延後或失效</small></article>`;
  const sourceEntry = courseEffectSnapshots?.entries?.[`${timeline.courseId}:runner`];
  note.innerHTML = sourceEntry
    ? `已把 U-tools 的日服馬身結果轉成繁中，並只保留繁中服已實裝技能；版本差異仍以本地資料為準。`
      + ` 清單只列可找到種馬路線、且路線馬身權重至少 0.25 的候選。`
      + ` <a href="${escapeHtml(sourceEntry.sourceUrl)}" target="_blank" rel="noreferrer">查看日文原始校正頁</a>`
    : '此賽道尚無 U-tools 本地快照，目前顯示 GameTora 條件與賽道幾何的簡化估算。';
}

function courseAccelerationCard(candidate) {
  const range = Math.abs(Number(candidate.maxBashin) - Number(candidate.minBashin)) >= 0.05
    ? `${Number(candidate.minBashin).toFixed(2)}～${Number(candidate.maxBashin).toFixed(2)}`
    : '固定位置參考';
  const routeName = candidate.factorName
    || (candidate.sourceKind === 'parent-unique' ? `${candidate.name}（繼承版）` : candidate.name);
  const routeBashin = Number(
    candidate.routeImpact?.expectedBashin
    ?? candidate.routeBashin
    ?? 0
  );
  const efficiency = Number.isFinite(Number(candidate.bashinPerPt))
    ? `每 100 技能點 ${Number(candidate.bashinPerPt).toFixed(2)} 馬身`
    : candidate.sourceKind === 'parent-unique'
      ? '固有／繼承路線'
      : '技能點效率未提供';
  const source = candidate.impactSource === 'utools-reference'
    ? '日服馬身校正'
    : '本地條件估算';
  const valueLabel = candidate.sourceKind === 'parent-unique'
    ? '繼承馬身'
    : '原技能馬身';
  return `
    <article class="guided-choice-card course-impact-card" data-skill-id="${candidate.id}">
      <header>
        <span class="impact-rank">${candidate.courseRank}</span>
        <div><strong>${escapeHtml(candidate.name)}</strong><small>${escapeHtml(candidate.activationWindow)}</small></div>
        <b class="impact-bashin">+${Number(candidate.expectedBashin).toFixed(2)}<small>${valueLabel}</small></b>
      </header>
      <div class="impact-meter"><i style="width:${Math.min(100, Number(candidate.expectedBashin) / 5.5 * 100).toFixed(1)}%"></i></div>
      <div class="impact-facts">
        <span>範圍 ${range}</span><span>${efficiency}</span><span>${source}</span>
        <span>種馬可傳：${escapeHtml(routeName)}約 ${routeBashin.toFixed(2)} 馬身</span>
        ${candidate.requiresFullSpurt ? '<span>足耐前提：後期起點可進最後衝刺</span>' : ''}
      </div>
      <p>${escapeHtml(accelerationAcquisitionText(candidate))}</p>
    </article>`;
}

function renderGuidedLoadoutWeights() {
  const container = byId('guidedLoadoutWeights');
  if (!container) return;
  const selected = selectedAccelerationCandidates();
  if (!selected.length) {
    container.innerHTML = '<p class="guided-empty">選定加速缺口後，這裡會顯示戰馬與配卡如何改變必要度。</p>';
    return;
  }
  const snapshot = activePlanningSnapshot();
  const rows = selected.map(candidate => ({
    candidate,
    need: snapshot?.rows?.find(row => Number(row.familyId) === Number(candidate.familyId))
  })).filter(item => item.need);
  container.innerHTML = `
    <header><strong>目前配置重算後的加速權重</strong><small>單技能馬身 × 條件可靠度 × 未覆蓋率；只供排序，不可相加</small></header>
    <div>${rows.map(({ candidate, need }) => `
      <article data-state="${need.coverageState}">
        <div><strong>${escapeHtml(candidate.name)}</strong><small>${need.coverageRoutes.map(route => route.label).join('、') || '目前沒有取得路線'}</small></div>
        <span>代理覆蓋 ${Math.round(need.coverageProbability * 100)}%</span>
        <b>${need.residualWeight.toFixed(2)}<small>馬身權重</small></b>
      </article>`).join('')}</div>`;
}

function renderGuidedParentStage() {
  const mainContainer = byId('guidedMainParents');
  const subContainer = byId('guidedSubParents');
  const availability = byId('guidedParentAvailability');
  const choiceStatus = byId('guidedParentChoiceStatus');
  if (!mainContainer || !subContainer || !availability || !choiceStatus) return;

  const target = selectedBattleUmaCard();
  if (!target) {
    availability.innerHTML = '<strong>尚未選擇戰馬</strong><span>選定戰馬衣裝後，這裡會自動按本場賽道計算父輩。</span>';
    mainContainer.innerHTML = '<p class="guided-empty">先選擇戰馬，才能排除同角色並計算繼承版固有收益。</p>';
    subContainer.innerHTML = '<p class="guided-empty">先選擇戰馬，才能排除同角色並計算繼承版固有收益。</p>';
    choiceStatus.textContent = '選定兩名不同角色後，才會解鎖下一步。';
    return;
  }

  const packageConfirmed = deckPackageSelectionComplete();
  [mainContainer, subContainer].forEach(container => {
    const fieldset = container.closest('fieldset');
    if (!fieldset) return;
    fieldset.disabled = !packageConfirmed;
    fieldset.inert = !packageConfirmed;
    fieldset.setAttribute('aria-disabled', String(!packageConfirmed));
  });

  if (!packageConfirmed) {
    availability.innerHTML = '<strong>等待六卡確認</strong><span>先完成配卡；父輩候選會在六卡缺口確定後才計算。</span>';
    mainContainer.innerHTML = '<p class="guided-empty">確認六卡後再整理主親代，不在選馬時預先運算。</p>';
    subContainer.innerHTML = '<p class="guided-empty">確認六卡後再整理副親代，不在選馬時預先運算。</p>';
    choiceStatus.textContent = '等待完整六卡。';
    return;
  }

  const ranked = guidedParentRecommendations();
  const recommendations = recommendedParentPair();
  const recommendedById = new Map(
    ranked.slice(0, 3).map((candidate, index) => [Number(candidate.parentSkillId), index + 1])
  );
  const targetName = target.nameZhTw || target.name || '目前衣裝';

  const distinctCount = recommendations.length;
  const sourceCount = ranked.filter(candidate => candidate.inheritedValueSource === 'course-impact').length;
  const availabilityMessage = distinctCount < 2
    ? `候選不足：排除目標戰馬「${targetName}」同角色後，目前只有 ${distinctCount} 名不同角色可用；至少需要 2 名不同角色，系統不會自動放行。`
    : `已排除目標戰馬「${targetName}」同角色；共有 ${ranked.length} 名完整父輩候選，其中 ${sourceCount}/${ranked.length} 名對應本場繼承版賽道影響資料，其餘以條件可靠度＋速度／加速／回復代理排序。`;
  availability.innerHTML = `<strong>${distinctCount >= 2 ? '系統推薦前兩名' : '父輩候選檢查'}</strong><span>${escapeHtml(availabilityMessage)}</span>`;

  const renderSlot = (slot, container) => {
    const otherKey = slot === 'main' ? 'sub' : 'main';
    const selectedId = Number(state[slot]);
    const other = ranked.find(candidate => Number(candidate.parentSkillId) === Number(state[otherKey]));
    const topCandidates = ranked.slice(0, 3);
    const otherCandidates = ranked.slice(3);
    if (!ranked.length) {
      container.innerHTML = '<p class="guided-empty">目前沒有符合本場條件的父輩候選，請先確認持有清單與賽道資料。</p>';
      return;
    }

    const parentSearchText = candidate => [
      candidate.nameZhTw || candidate.name,
      candidate.outfitTitleZhTw || candidate.outfit,
      candidate.uniqueSkillName || localizedSkillName(candidate.skillId),
      candidate.parentSkillId
    ].filter(Boolean).join(' ');

    const cardMarkup = candidate => {
      const id = Number(candidate.parentSkillId);
      const recommendedRank = recommendedById.get(id);
      const blockedByOther = other && guidedPlannerCore?.sameParentCharacter(other, candidate)
        && id !== selectedId;
      const selected = id === selectedId;
      const benefit = Number(candidate.inheritedBenefitBashin) || 0;
      const expected = Number(candidate.inheritedExpectedBashin) || benefit;
      const reliability = Number(candidate.inheritedReliability);
      const isCourseImpact = candidate.inheritedValueSource === 'course-impact';
      const isOriginalFallback = candidate.inheritedValueSource === 'original-impact-fallback';
      const sourceLabel = isCourseImpact
        ? `繼承版收益 +${benefit.toFixed(2)} 馬身（預期 ${expected.toFixed(2)}）`
        : isOriginalFallback
          ? `原固有賽道值代理／非繼承版約 +${benefit.toFixed(2)} 馬身`
          : `代理收益約 +${benefit.toFixed(2)} 馬身`;
      const reliabilityLabel = Number.isFinite(reliability)
        ? `條件可靠度代理 ${Math.round(reliability * 100)}%（非成功率）`
        : '條件可靠度代理待補資料';
      const baseReason = isCourseImpact
        ? candidate.inheritedReason || `${candidate.inheritedActivationWindow}；依本場賽道影響排序`
        : candidate.inheritedReason
          || `${candidate.proxyReason || '未對到本場固有／繼承版本'}；此數值只作代理，不是實測馬身`;
      const reason = [baseReason, candidate.aptitudeWarning]
        .filter(Boolean)
        .join('；');
      const skillProvenanceLabel = isCourseImpact
        ? '（繼承版）'
        : isOriginalFallback
          ? '（原固有；非繼承版代理）'
          : '（固有代理）';
      const title = `${candidate.nameZhTw || candidate.name || '候選角色'} ${candidate.outfitTitleZhTw || candidate.outfit || ''}`.trim();
      const nearTieBadge = candidate.nearTie
        ? '<em class="guided-parent-near-tie">近似方案</em>'
        : '';
      return `<label class="guided-parent-card${selected ? ' is-selected' : ''}${recommendedRank ? ' is-recommended' : ''}${blockedByOther ? ' is-disabled' : ''}" data-guided-parent-id="${id}" data-parent-role="${slot}">
        <input type="radio" name="guided-${slot}-parent" value="${id}" ${selected ? 'checked' : ''}${blockedByOther ? ' disabled' : ''} aria-label="${escapeHtml(`${slot === 'main' ? '主親代' : '副親代'} ${title}`)}">
        ${traineePortraitMarkup(candidate, 'guided-parent-portrait')}
        <span class="guided-parent-copy">
          <strong>${escapeHtml(title)}${recommendedRank ? ` <em>推薦 #${recommendedRank}</em>` : ''}${nearTieBadge}</strong>
          <small>${escapeHtml(candidate.uniqueSkillName || localizedSkillName(candidate.skillId))}${skillProvenanceLabel}</small>
          <b>${escapeHtml(sourceLabel)}</b>
          <span>${escapeHtml(candidate.inheritedActivationWindow || '條件區段')}・${escapeHtml(reliabilityLabel)}</span>
          <p>${escapeHtml(reason)}</p>
        </span>
      </label>`;
    };

    const selectedOtherCandidate = ranked.find(candidate => Number(candidate.parentSkillId) === selectedId);
    const selectedOther = selectedOtherCandidate && !recommendedById.has(selectedId);
    const selectedOtherMarkup = selectedOther
      ? `<div class="guided-parent-selected-other">
          <div class="guided-parent-list-heading"><strong>目前已選其他候選</strong><small>完整摘要仍保留在這裡，可直接重新操作。</small></div>
          ${cardMarkup(selectedOtherCandidate)}
        </div>`
      : '';
    const recommendedMarkup = `<div class="guided-parent-list-heading"><strong>推薦前三</strong><small>依本場排名順序突出顯示；主／副親代仍可從全部候選選擇。</small></div>
      <div class="guided-parent-recommendations">${topCandidates.map(cardMarkup).join('')}</div>`;
    const otherMarkup = otherCandidates.length
      ? `<details class="guided-parent-more">
          <summary>查看／選擇其他候選（${otherCandidates.length} 名）</summary>
          <div class="guided-parent-more-body">
            <label class="guided-parent-search">搜尋其他候選
              <input type="search" data-guided-parent-search placeholder="姓名、衣裝或固有技能" autocomplete="off" aria-label="搜尋${slot === 'main' ? '主親代' : '副親代'}其他候選">
            </label>
            <p class="guided-parent-more-status" data-guided-parent-search-status aria-live="polite">可用姓名、衣裝、固有技能或 ID 搜尋。</p>
            <div class="guided-parent-more-list" data-guided-parent-more-list>${otherCandidates.map(cardMarkup).join('')}</div>
            <p class="guided-parent-more-empty" data-guided-parent-search-empty hidden>沒有符合搜尋條件的其他候選。</p>
          </div>
        </details>`
      : '';
    container.innerHTML = `${selectedOtherMarkup}${recommendedMarkup}${otherMarkup}`;

    const search = container.querySelector('[data-guided-parent-search]');
    if (search) {
      const cards = [...container.querySelectorAll('[data-guided-parent-more-list] [data-guided-parent-id]')];
      const status = container.querySelector('[data-guided-parent-search-status]');
      const empty = container.querySelector('[data-guided-parent-search-empty]');
      const filterCards = () => {
        const query = String(search.value || '').trim().toLocaleLowerCase('zh-Hant');
        let visible = 0;
        cards.forEach(card => {
          const matches = !query
            || String(card.textContent || '').toLocaleLowerCase('zh-Hant').includes(query);
          card.hidden = !matches;
          if (matches) visible += 1;
        });
        if (status) status.textContent = query
          ? `${visible}/${cards.length} 名候選符合搜尋；灰色候選與另一槽角色重複，不能選。`
          : `共 ${cards.length} 名其他候選；可用鍵盤 Tab／方向鍵／空白鍵操作。`;
        if (empty) empty.hidden = visible > 0;
      };
      search.oninput = filterCards;
      filterCards();
    }

    container.querySelectorAll('input[type="radio"]').forEach(input => {
      input.onchange = () => {
        if (applyParentSelection(slot, input.value, ranked)) {
          rerenderParentDependentViews();
        }
      };
    });
  };

  renderSlot('main', mainContainer);
  renderSlot('sub', subContainer);
  if (parentSelectionConfirmedForPackage()) {
    choiceStatus.textContent = '卡組已套用，主／副親代已完成最終確認；下一步會重算剩餘技能／因子。';
  } else if (parentSelectionComplete() && packageConfirmed) {
    choiceStatus.textContent = '主／副親代仍保留為候選；請重新選定一名主親代或副親代，確認它們適用於目前卡組。';
  } else if (parentSelectionComplete()) {
    choiceStatus.textContent = '目前只顯示父輩預覽；請先套用一組 5+1 卡組，再完成最終確認。';
  } else if (ranked.length < 2 || distinctCount < 2) {
    choiceStatus.textContent = '候選不足或尚未選滿兩名不同角色；加速階段保持鎖定。';
  } else {
    choiceStatus.textContent = `請各選 1 名主親代與副親代；目前 ${[state.main, state.sub].filter(hasSelectedParentId).length}/2。`;
  }
}

function optimizerIdentityDisplay(identity = currentOptimizerIdentity) {
  const source = identity?.source || {};
  const catalog = source.catalog || {};
  const profile = source.raceProfile || {};
  const strategy = source.strategy || {};
  const routes = source.eventRoutes || {};
  const catalogVersion = catalog.version || catalog.asOf || catalog.assetHash || 'missing';
  const routeVersion = routes.version || routes.hash || 'missing';
  return [
    `source：catalog ${catalogVersion}／race ${profile.id || 'missing'}／strategy ${strategy.id || 'missing'}／routes ${routeVersion}`,
    `build：${identity?.build || 'missing'}`,
    `model：core ${identity?.core?.modelVersion ?? 'missing'}／deck ${identity?.model?.deckOptimizer ?? 'missing'}／acquisition ${identity?.model?.acquisition || 'missing'}／level-data ${identity?.model?.supportLevelFixtures ?? 'missing'}`
  ].join('；');
}

function renderOptimizerIdentity() {
  const node = byId('guidedDeckIdentity');
  if (!node) return;
  const base = optimizerIdentityDisplay();
  const storageNote = optimizerIdentityStorageUnavailable
    ? '；identity 無法保存於本機'
    : '';
  node.textContent = optimizerIdentityPendingSave
    ? `${base}；PENDING：已套用目前方案，等待 planner 保存；不會自動刷新${storageNote}`
    : optimizerIdentityStale
    ? `${base}；STALE：${optimizerIdentityStaleReason}；不會自動刷新，請手動重新確認卡組${storageNote}`
    : `${base}；identity 已與目前 runtime 對齊${storageNote}`;
  node.dataset.state = optimizerIdentityPendingSave
    ? 'pending'
    : optimizerIdentityStale ? 'stale' : 'current';
  node.setAttribute('aria-label', optimizerIdentityPendingSave
    ? 'Optimizer identity pending，等待 planner 保存'
    : optimizerIdentityStale
      ? 'Optimizer identity stale，請手動重新確認卡組'
      : 'Optimizer source、build、model identity');
}

function acknowledgeOptimizerIdentity() {
  // Only an explicit package confirmation may mark the current identity for
  // the next successful planner save.  Do not write here: if the tab closes
  // before the delayed save, the old planner and its pending identity must
  // still reload as stale.
  optimizerIdentityPendingSave = true;
  optimizerIdentityStale = false;
  optimizerIdentityStaleReason = '已套用目前方案，等待 planner 保存後確認 optimizer identity';
  renderOptimizerIdentity();
}

function percentileToScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0, Math.min(100, numeric <= 1.000001 ? numeric * 100 : numeric));
}

function competitiveCardPresentation(evaluation = {}, { scenarioRequired = false } = {}) {
  const score = percentileToScore(evaluation.recommendationScore ?? evaluation.score);
  const skillFitScore = percentileToScore(evaluation.axisBreakdown?.necessarySkills?.percentile);
  const policy = evaluation.strictPrimary?.policy || {};
  const gateScore = percentileToScore(policy.minimumCompositePercentile);
  const trainingGateScore = percentileToScore(policy.minimumTrainingPercentile);
  const passed = evaluation.recommended === true;
  return {
    score,
    scoreText: score == null ? '單卡競技基準：未評分' : `單卡競技基準 ${score.toFixed(1)}/100`,
    skillFitText: skillFitScore == null
      ? '本場技能適配（必要技能軸）：未解析'
      : `本場技能適配（必要技能軸） ${skillFitScore.toFixed(1)}/100`,
    gateText: scenarioRequired
      ? '劇本 exact 必帶：不以單卡參考線淘汰'
      : gateScore == null
        ? `單卡比較參考：未提供${trainingGateScore == null ? '' : `；訓練軸參考 ${trainingGateScore.toFixed(0)}`}`
        : `單卡比較參考 ${gateScore.toFixed(0)}：${passed ? '高於參考' : '低於參考，仍保留搜尋'}${trainingGateScore == null ? '' : `；訓練軸參考 ${trainingGateScore.toFixed(0)}`}`,
    passed
  };
}

function acquisitionRouteAuditRows(routeRows = []) {
  const rows = Array.isArray(routeRows) ? routeRows : [];
  const routeLabels = {
    training_hint: '訓練靈感',
    continuous_event: '連續事件',
    random_event: '隨機事件（額外、不計推薦）',
    unknown_event: '未知事件（fail-closed、不計分）'
  };
  const routeTypes = [...new Set(rows.map(route => String(
    route.routeType || route.sourceKind || route.eventKind
      || (route.source === 'hint' ? 'training_hint' : 'unknown_event')
  )))];
  return routeTypes.flatMap(type => {
    const groupedRows = rows.filter(route => String(
      route.routeType || route.sourceKind || route.eventKind
        || (route.source === 'hint' ? 'training_hint' : 'unknown_event')
    ) === type);
    const formalRoute = route => typeof deckOptimizerCore?.isFormalAcquisitionRoute === 'function'
      ? deckOptimizerCore.isFormalAcquisitionRoute(route)
      : route?.formal !== false && route?.bonusOnly !== true
        && !/white|random|unknown/i.test(String(type));
    const formalRows = groupedRows.filter(formalRoute);
    const auditRows = groupedRows.filter(route => !formalRoute(route));
    const output = [];
    if (formalRows.length) {
      const rawProbability = formalRows.reduce((max, route) => Math.max(max,
        Number(route.rawProbability ?? route.coverageProbability ?? route.probability ?? 0) || 0), 0);
      const formalProbability = formalRows.reduce((max, route) => Math.max(max,
        Number(route.formalProbability ?? route.coverageProbability ?? route.probability ?? 0) || 0), 0);
      output.push({
        type,
        label: routeLabels[type] || type,
        rawProbability,
        formalProbability,
        auditOnly: false,
        whiteAudit: false
      });
    }
    if (auditRows.length) {
      const rawProbability = auditRows.reduce((max, route) => Math.max(max,
        Number(route.rawProbability ?? route.coverageProbability ?? route.probability ?? 0) || 0), 0);
      const whiteAudit = auditRows.some(route => /white/i.test(String(
        route.kind || route.eventKind || route.sourceKind || ''
      )) || (route.source === 'event'
        && Number.isFinite(Number(route.skill?.rarity ?? route.skillRarity ?? route.rarity))
        && Number(route.skill?.rarity ?? route.skillRarity ?? route.rarity) < 2));
      output.push({
        type,
        label: `${whiteAudit ? '連續事件白技／' : ''}僅稽核／不計推薦 ${routeLabels[type] || type} raw=${rawProbability.toFixed(2)}`,
        rawProbability,
        formalProbability: 0,
        auditOnly: true,
        whiteAudit
      });
    }
    return output;
  });
}

function renderDeckOptimizationPlans() {
  const list = byId('guidedDeckPackageList');
  const status = byId('guidedDeckPackageStatus');
  const frontierList = byId('guidedDeckFrontierList');
  const alternativeList = byId('guidedDeckAlternativeList');
  const comfortList = byId('guidedDeckComfortList');
  const comfortSummary = byId('guidedDeckComfortSummary');
  const theoreticalBorrowNote = '理論借卡候選・需在好友/刷新清單出現，實際Lv/凸以提供者為準；模型仍以滿突 Lv50 benchmark 計算。';
  renderOptimizerIdentity();
  if (!list || !status || !frontierList) return;
  const result = activeDeckOptimization();
  if (!selectedBattleUmaCard() || !result) {
    list.innerHTML = '<li class="guided-empty" role="listitem">請先選擇戰馬，才能比較 5+1 卡組方案。</li>';
    status.textContent = '尚未產生卡組方案';
    if (byId('guidedDeckShortage')) byId('guidedDeckShortage').textContent = '尚未選擇戰馬';
    if (alternativeList) alternativeList.innerHTML = '';
    if (comfortList) comfortList.innerHTML = '';
    if (comfortSummary) comfortSummary.textContent = '選好戰馬後，這裡會直接比較理論方案與你的自配。';
    frontierList.innerHTML = '';
    renderBattleDeckTrainingPlan();
    return;
  }
  const selected = currentDeckPackage(result);
  const packageApplied = deckPackageSelectionComplete();
  const customApplied = packageApplied && ['custom', 'legacy'].includes(String(state.deckPackageId));
  status.textContent = customApplied
    ? '目前使用：你的自配；六卡已確認，可依剩餘技能／因子重算父輩。'
    : packageApplied
      ? `目前使用：${selected?.modeLabel || '已確認方案'}；六卡已確認，可依剩餘技能／因子重算父輩。`
    : selected
      ? `目前先填入：${selected.modeLabel}；可直接套用理論最優，或在右欄改成你的自配後確認。`
      : '請套用理論最優，或在右欄選滿並確認你的 5＋1；父輩目前仍是預覽。';
  const residualSummary = byId('guidedResidualFactorSummary');
  if (residualSummary) {
    // This is Step 5's canonical display. Do not substitute optimizer
    // residualFactorCost here: it is a package-ranking proxy, not exact
    // acquisition coverage for the confirmed six-card deck.
    residualSummary.innerHTML = step5CoverageMarkup(buildStep5CoverageSummary(), { compact: true });
  }
  const breakdownLabel = {
    panel: '面板／訓練',
    skillPtEconomy: '技能 Pt 經濟',
    skillGoldRecovery: '技能／金技',
    recoveryGate: '回復門檻',
    breadth: '有效技能廣度',
    overlap: '互補／重疊',
    recoveryRedundancyPenalty: '回復重複懲罰'
  };
  const fiveAxisLabel = {
    trainingOutput: '訓練輸出',
    skillPtEconomy: '技能 Pt 經濟',
    necessarySkills: '領頭必要／唯一技能',
    hintEfficiency: '提示效率',
    deckScenarioFit: '卡組／劇本適配'
  };
  const scenarioMechanicsSummary = activeScenarioMechanicsSummary();
  const acquisitionBreakdownMarkup = card => {
    const routeRows = card?.routeRows || card?.__routeRows || [];
    const targetRows = card?.acquisitionBreakdown || [];
    const routeAudits = acquisitionRouteAuditRows(routeRows);
    const routeMarkup = routeAudits.length
      ? `<div class="guided-deck-acquisition-routes">${routeAudits.map(audit => `<span>${escapeHtml(audit.label)} ${audit.formalProbability.toFixed(2)}${/random|unknown/i.test(audit.type) ? '（bonusOnly）' : ''}</span>`).join('')}</div>`
      : '';
    const hintRoute = routeRows.find(route => route.source === 'hint' && route.hintMetrics)
      || targetRows.find(row => row.hintEconomy?.source?.hintMetrics)?.hintEconomy?.source
      || null;
    const hint = hintRoute?.hintMetrics || null;
    const hintMarkup = hint
      ? `<div class="guided-deck-acquisition-hint"><span>Hint Lv ${Number(hint.hintGrantLevel ?? hint.hintGrant ?? (1 + Number(hint.effect17 || 0)))}／率 ${Number(hint.hintRate || 0)}%</span><span>池 ${Number(hint.poolSize || 0)}／N ${Number(hint.opportunities ?? hint.nOpportunities ?? 0)}</span><span>SP 折扣 ${Math.round(Number(hint.spDiscountRate || 0) * 100)}%</span></div>`
      : '<div class="guided-deck-acquisition-hint"><span>Hint：此卡未解析到訓練靈感 route</span></div>';
    const targetMarkup = targetRows.length
      ? targetRows.map(row => `<li><strong>${escapeHtml(row.targetName || String(row.targetId))}</strong><span>marginal ${Number(row.eventMarginalValue || 0).toFixed(2)}；替代 ${Number(row.alternativeSourceCount || 0)}；factorability ${Number(row.factorabilityProxy || 0).toFixed(2)}；scarcity ${Number(row.scarcityMultiplier || 0).toFixed(2)}</span></li>`).join('')
      : '<li>沒有可計分的 candidate-specific target route</li>';
    const lifecycle = card?.resolvedProfile?.lifecycleSensitivity;
    const lifecycleMarkup = lifecycle
      ? `<div class="guided-deck-acquisition-lifecycle"><span>育成 lifecycle proxy：${escapeHtml(lifecycle.proxySource || lifecycle.source || 'heuristic')}／formal expected</span><span>lower ${Object.keys(lifecycle.lowerEffectMap || {}).length ? '有' : '—'}・expected ${Object.keys(lifecycle.expectedEffectMap || {}).length ? '有' : '—'}・peak ${Object.keys(lifecycle.peakEffectMap || {}).length ? '有' : '—'}</span></div>`
      : '';
    return `<div class="guided-deck-acquisition" data-acquisition-breakdown="${Number(card?.id) || ''}"><strong>技能取得分解</strong>${routeMarkup}${hintMarkup}<ul>${targetMarkup}</ul>${lifecycleMarkup}</div>`;
  };
  const cardMarkup = (card, borrowed = false) => {
    const labels = localizedSupportLabels(card);
    const type = normalizeSupportType(card.supportType);
    const level = borrowed ? (card.level || 50) : card.level;
    const evaluation = card.competitiveEvaluation || {};
    const hasRecommendationScore = Number.isFinite(Number(evaluation.recommendationScore));
    const recommendationScore = hasRecommendationScore
      ? Number(evaluation.recommendationScore)
      : null;
    const scenarioRequired = evaluation.mandatoryScenarioCard === true
      || card.scenarioRequired === true;
    const recommendationPassed = evaluation.recommended === true || scenarioRequired;
    const presentation = competitiveCardPresentation(evaluation, { scenarioRequired });
    const recommendationReason = (evaluation.warnings || []).filter(Boolean).join('、')
      || (recommendationPassed ? '單卡訓練／技能 Pt 高於比較參考' : '單卡比較低於參考，但仍會進入完整六卡搜尋');
    const axisRows = Object.entries(evaluation.axisBreakdown || {})
      .map(([axis, item]) => `<span>${escapeHtml(fiveAxisLabel[axis] || axis)} ${Number(item.contribution || 0).toFixed(1)}</span>`)
      .join('');
    const warnings = (evaluation.warnings || []).filter(Boolean);
    const detail = borrowed
      ? '借卡・滿突 Lv50／4突'
      : `自有・Lv${level || '?'}／${Number(card.limitBreak) || 0}突`;
    const cardTitle = labels.title || card.titleZhTw || '未提供卡名';
    const sourceLabel = supportCardSourceLabel(card);
    return `<article class="guided-deck-card${borrowed ? ' is-borrowed' : ''}${warnings.length ? ' has-warning' : ''}" data-support-card-id="${Number(card.id) || ''}" data-ownership="${borrowed ? 'borrowed' : 'owned'}">
      ${supportCardImageMarkup(card, { borrowed, level, eager: true })}
      <div class="guided-deck-card-copy">
        <div class="guided-deck-card-badges"><span class="guided-deck-rarity guided-deck-rarity--${String(card.rarity || '').toLowerCase()}">${escapeHtml(card.rarity || '未知稀有度')}</span><span class="guided-deck-type">${escapeHtml(supportTypeLabels[type] || type || '未指定卡型')}</span>${scenarioRequired ? '<span class="guided-deck-scenario-badge">劇本必帶</span>' : ''}</div>
        <strong>${escapeHtml(labels.name || card.nameZhTw || card.name || String(card.id))}</strong>
        <span>${escapeHtml(cardTitle)}</span>
        <small>${escapeHtml(detail)}</small>
        <details class="guided-deck-card-details">
          <summary>查看來源與評分</summary>
          ${borrowed ? `<small class="guided-deck-borrow-note">${escapeHtml(theoreticalBorrowNote)}</small>` : ''}
          <div class="guided-deck-card-badges"><span class="guided-deck-source">${escapeHtml(sourceLabel)}</span></div>
          <div class="guided-deck-card-recommendation" aria-label="${escapeHtml(`${presentation.scoreText}；${presentation.gateText}；${presentation.skillFitText}`)}">
            <strong>${escapeHtml(presentation.scoreText)}</strong>
            <span>${escapeHtml(presentation.gateText)}</span>
            <span>${escapeHtml(presentation.skillFitText)}</span>
            <small>${escapeHtml(`這只是單卡比較參考（訓練／技能 Pt），不是候選淘汰線，也不是整副卡組或本場領頭推薦度；${recommendationReason}`)}</small>
          </div>
          ${axisRows ? `<div class="guided-deck-card-axis" aria-label="卡片五軸加權貢獻">${axisRows}</div>` : ''}
          ${acquisitionBreakdownMarkup(card)}
          ${warnings.length ? `<p class="guided-deck-warning">${escapeHtml(warnings.join('；'))}</p>` : ''}
        </details>
      </div>
    </article>`;
  };
  const packageGroups = [];
  const groupsBySignature = new Map();
  result.packages.forEach(packageValue => {
    const signature = deckComfortCanonicalSignature(packageValue);
    if (!groupsBySignature.has(signature)) {
      const group = { signature, packages: [] };
      groupsBySignature.set(signature, group);
      packageGroups.push(group);
    }
    groupsBySignature.get(signature).packages.push(packageValue);
  });
  const optionLabelBySignature = new Map(packageGroups.map((group, index) => [
    group.signature,
    `方案 ${String.fromCharCode(65 + index)}`
  ]));
  const comfortComparison = activeDeckComfortComparison(result);
  const comfortBySignature = new Map((comfortComparison?.groups || [])
    .map(group => [group.signature, group]));
  const selectedSignature = selected ? deckComfortCanonicalSignature(selected) : null;
  const theoreticalSignature = comfortComparison?.recommendedSignature
    || packageGroups[0]?.signature
    || null;
  const theoreticalGroup = packageGroups.find(group => group.signature === theoreticalSignature)
    || packageGroups[0]
    || null;
  const theoreticalPackage = theoreticalGroup?.packages?.[0] || null;
  const deckDelta = buildTheoreticalVsCustomDeckDelta(theoreticalPackage);
  const comfortBadgeLabels = {
    overall: '綜合代表',
    'least-factor': '最省因子',
    'easiest-training': '最好養',
    'least-borrow': '借卡壓力最低',
    'recovery-ready': '回復最穩',
    'recovery-met': '回復達標',
    'recovery-tradeoff': '回復需妥協',
    'borrow-dependent': '借卡依賴',
    'borrow-unknown': '借卡證據不足',
    uncertain: '資料不確定',
    'factor-gaps': '仍有缺口',
    invalid: '方案無效',
    'hard-recovery-blocked': '回復硬門未過'
  };
  if (comfortSummary) {
    const coverageKnown = deckDelta.theoreticalCoveragePercent !== null
      && deckDelta.customCoveragePercent !== null;
    comfortSummary.textContent = !theoreticalPackage
      ? '目前沒有合法的理論 5＋1，無法建立比較基準。'
      : !deckDelta.customPackage.valid
        ? '你的自配還沒選滿有效的 5＋1；先完成右欄，這裡才會顯示差異。'
        : deckDelta.sameDeck
          ? '你的自配和理論最優完全相同；目前沒有換卡差異。'
          : coverageKnown
            ? `你換了 ${deckDelta.removedCards.length} 張卡；目前技能取得覆蓋代理由 ${Math.round(deckDelta.theoreticalCoveragePercent)}% 變成 ${Math.round(deckDelta.customCoveragePercent)}%。`
            : `你換了 ${deckDelta.removedCards.length} 張卡；六卡結構可比較，但技能取得覆蓋證據尚未完整。`;
  }
  if (comfortList) {
    const probabilityText = row => `${Math.round(row.theoreticalProbability * 100)}% → ${Math.round(row.customProbability * 100)}%`;
    const cardNames = cards => cards.map(supportCardComparisonName).join('、');
    const lossLines = [
      deckDelta.removedCards.length ? `換掉：${cardNames(deckDelta.removedCards)}` : '',
      deckDelta.losses.length
        ? `較少的取得路線：${deckDelta.losses.map(row => `${row.label}（${probabilityText(row)}）`).join('、')}`
        : ''
    ].filter(Boolean);
    const gainLines = [
      deckDelta.addedCards.length ? `換入：${cardNames(deckDelta.addedCards)}` : '',
      deckDelta.gains.length
        ? `較多的取得路線：${deckDelta.gains.map(row => `${row.label}（${probabilityText(row)}）`).join('、')}`
        : ''
    ].filter(Boolean);
    const knownOptimizerPackage = Boolean(
      deckDelta.customSignature && groupsBySignature.has(deckDelta.customSignature)
    );
    const validityText = !deckDelta.customPackage.valid
      ? `還不能用：${deckDelta.customPackage.validation.problems.join('；') || '請選滿五張自有卡與一張借卡。'}`
      : state.battleOwnedCardsConfirmed
        ? '六卡結構已確認；父輩與因子會依這副自配重算。'
        : '六卡結構有效，但你還沒按下確認。';
    const modelBoundary = knownOptimizerPackage
      ? '這副自配也是模型已算過的候選，可以沿用完整卡組代理比較。'
      : '自配若不是模型候選，這裡只比較精確卡片／技能取得路線；面板與技能 Pt 差異不硬填。';
    comfortList.innerHTML = `<li class="deck-delta-card" data-deck-delta-state="${deckDelta.customPackage.valid ? deckDelta.sameDeck ? 'same' : 'changed' : 'incomplete'}">
      <article data-delta-kind="loss"><span>少了什麼</span><strong>${deckDelta.sameDeck ? '沒有換卡差異' : '理論方案中被你拿掉的部分'}</strong><p>${escapeHtml(lossLines.join('；') || '目前可確認的技能取得路線沒有變少。')}</p></article>
      <article data-delta-kind="gain"><span>換來什麼</span><strong>${deckDelta.sameDeck ? '與理論方案相同' : '你的自配新增的部分'}</strong><p>${escapeHtml(gainLines.join('；') || '目前可確認的技能取得路線沒有增加。')}</p></article>
      <article data-delta-kind="validity"><span>還能不能用</span><strong>${deckDelta.customPackage.valid ? '六卡結構可用' : '尚未完成'}</strong><p>${escapeHtml(validityText)}<br>${escapeHtml(modelBoundary)}</p></article>
    </li>`;
  }
  const visiblePackageGroups = theoreticalGroup ? [theoreticalGroup] : [];
  list.innerHTML = visiblePackageGroups.map((group, groupIndex) => {
    const isSelected = group.packages.some(item => item.id === selected?.id);
    const packageValue = group.packages[0];
    const optionLabel = '理論最優';
    const comfortGroup = comfortBySignature.get(group.signature);
    const isRecommended = group.signature === comfortComparison?.recommendedSignature;
    const modeSummary = group.packages
      .map(item => `${item.modeLabel} ${Number(item.totalScore || 0).toFixed(1)}`)
      .join('・');
    const modeLabels = group.packages.map(item => item.modeLabel).join('／');
    const breakdown = Object.entries(packageValue.breakdown || {})
      .filter(([key, value]) => key !== 'weights'
        && key !== 'normalization'
        && key !== 'survivalPenalty'
        && typeof value === 'number')
      .map(([key, value]) => `<span>${escapeHtml(breakdownLabel[key] || key)} ${value.toFixed(2)}</span>`)
      .join('');
    const fiveAxis = packageValue.breakdown?.fiveAxis || {};
    const fiveAxisRaw = packageValue.breakdown?.fiveAxisRaw || {};
    const fiveAxisContributions = packageValue.breakdown?.fiveAxisContributions || {};
    const fiveAxisMarkup = Object.keys(fiveAxisLabel).map(axis =>
      `<li><span>${escapeHtml(fiveAxisLabel[axis])}</span><strong>${Number(fiveAxis[axis] || 0).toFixed(1)}/100</strong><small>加權 +${Number(fiveAxisContributions[axis] || 0).toFixed(1)}</small></li>`
    ).join('');
    const rawAxisMarkup = Object.keys(fiveAxisLabel)
      .map(axis => `<dt>${escapeHtml(fiveAxisLabel[axis] || axis)}</dt><dd>公開條件／代理原始值 ${Number(fiveAxisRaw[axis] || 0).toFixed(2)}；正規化 ${Number(fiveAxis[axis] || 0).toFixed(2)}/100；權重 ${Number(packageValue.breakdown?.fiveAxisWeights?.[axis] || 0) * 100}%；貢獻 ${Number(fiveAxisContributions[axis] || 0).toFixed(2)}</dd>`)
      .join('');
    const recovery = packageValue.recoveryGate || {};
    const gold = (packageValue.effectiveGoldSkills || []).map(skill =>
      `${escapeHtml(skill.name || String(skill.id))} (${Math.round(Number(skill.expectedCoverage || skill.probability || 0) * 100)}%)`
    ).join('、') || '尚無已識別金回';
    const comfortTags = (comfortGroup?.badges || [])
      .filter(key => ['overall', 'least-factor', 'easiest-training', 'least-borrow', 'recovery-ready'].includes(key))
      .map(key => comfortBadgeLabels[key] || key)
      .join('／');
    return `<li class="guided-deck-package${isSelected ? ' is-selected' : ''}" role="listitem" data-deck-package-card="${escapeHtml(group.signature)}">
      <header><div><span class="guided-deck-package-mode">${escapeHtml(optionLabel)} 5＋1</span><h4>這是模型目前建議的六張卡</h4></div>
        <strong>${isSelected ? '你正在用' : '可直接套用'}<small>${comfortTags ? escapeHtml(comfortTags) : '完整 5＋1'}<br>借卡按滿突基準</small></strong></header>
      <div class="guided-deck-cards" tabindex="0" aria-label="六卡方案卡片，可使用鍵盤左右閱讀">${packageValue.ownedCards.map(card => cardMarkup(card)).join('')}${cardMarkup(packageValue.borrowedCard, true)}</div>
      <details class="guided-deck-analysis">
        <summary>查看五軸、來源、模式理由與原始評分</summary>
        <p><strong>劇本版本規則：</strong>${escapeHtml(scenarioMechanicsSummary)}</p>
        <p><strong>適用模式：</strong>${escapeHtml(modeLabels)}；<strong>模型總分：</strong>${Number(packageValue.totalScore || 0).toFixed(1)}（${escapeHtml(modeSummary)}）</p>
        <p><strong>模式理由：</strong>${escapeHtml(packageValue.reason || '未提供')}</p>
        <section class="guided-deck-five-axis" aria-labelledby="guided-deck-axis-${escapeHtml(packageValue.id)}"><h5 id="guided-deck-axis-${escapeHtml(packageValue.id)}">五軸分數與加權貢獻</h5><ol>${fiveAxisMarkup}</ol></section>
        <div class="guided-deck-breakdown">${breakdown}</div>
        <p><strong>有效金技／回復：</strong>${gold}</p>
        <p><strong>同時為：</strong>${escapeHtml(modeLabels)} 首選；<strong>有效技能家族：</strong>${packageValue.distinctSkillFamilyCount || 0}；<strong>重疊：</strong>${packageValue.overlapItems?.length || 0}；<strong>回復：</strong>${recovery.status === 'met' ? '結構槽達標' : `缺 ${Number(recovery.deficit || 0).toFixed(2)} 槽`}</p>
        <p class="guided-deck-reason">${escapeHtml(packageValue.modelMode === 'partial-stats' ? '含降階統計模型：自有卡未有完整曲線，使用代理模型。' : '')}</p>
        <details class="guided-deck-details"><summary>查看原始值／權重／貢獻</summary><dl>${rawAxisMarkup}</dl><p>模型模式：${escapeHtml(packageValue.modelMode || 'unknown')}；分數公式：${escapeHtml(packageValue.scoreFormula || '')}</p></details>
      </details>
      <button type="button" class="primary" aria-pressed="${isSelected}" data-apply-deck-package="${escapeHtml(packageValue.id)}">${packageApplied && isSelected ? '已採用理論最優' : '套用這副六卡'}</button>
    </li>`;
  }).join('');

  if (!packageGroups.length) {
    list.innerHTML = `<li class="guided-deck-empty" role="listitem"><strong>競技卡不足</strong><span>${escapeHtml((result.shortage || result.competition?.shortage || ['沒有可顯示的競技 5+1 方案']).join('；'))}</span><small>SR／R、活動、商店與配布卡沒有被偷偷回填；請到下方收合區理解缺卡原因。</small></li>`;
    if (comfortList) comfortList.innerHTML = '';
    if (comfortSummary) comfortSummary.textContent = '目前沒有合法的完整 5+1 候選可比較。';
  }
  const shortageNode = byId('guidedDeckShortage');
  if (shortageNode) {
    shortageNode.textContent = result.shortage?.length
      ? result.shortage.join('；')
      : '已有可進入完整卡組搜尋的 5+1 候選';
    shortageNode.dataset.state = result.shortage?.length ? 'warning' : 'ready';
  }
  if (alternativeList) {
    const audits = (result.competition?.audits || [])
      .filter(audit => !audit.ownedRecommended || !audit.sourceEligible)
      .sort((left, right) => {
        const priority = id => [30084, 20058, 30081, 30226, 30227].includes(Number(id)) ? 0 : 1;
        return priority(left.id) - priority(right.id) || Number(left.id) - Number(right.id);
      });
    const visibleAudits = audits.slice(0, 60);
    alternativeList.innerHTML = visibleAudits.length
      ? visibleAudits.map(audit => {
        const card = audit.card || {};
        const labels = localizedSupportLabels(card);
        const warnings = [
          ...(audit.ownedReasons || []),
          ...(audit.owned?.warnings || []),
          ...(audit.borrowed?.warnings || [])
        ].filter(Boolean);
        const uniqueWarnings = [...new Set(warnings)];
        const sourceGateExcluded = audit.sourceEligible === false;
        const recommendation = sourceGateExcluded
          ? null
          : [audit.owned, audit.borrowed]
            .find(candidate => candidate && Number.isFinite(Number(candidate.score)))
            || null;
        const hasRecommendationScore = Boolean(
          recommendation && Number.isFinite(Number(recommendation.score))
        );
        const recommendationScore = hasRecommendationScore
          ? Number(recommendation.score)
          : null;
        const presentation = recommendation
          ? competitiveCardPresentation({
            ...recommendation,
            score: recommendation.score
          })
          : null;
        const recommendationPassed = hasRecommendationScore
          && recommendation.recommended === true
          && audit.sourceEligible;
        const recommendationReason = uniqueWarnings.join('、')
          || (sourceGateExcluded
            ? '未建立競技五軸評分'
            : recommendationPassed ? '單卡訓練／技能 Pt 高於比較參考' : '單卡比較低於參考，但仍會進入完整六卡搜尋');
        const eligibleText = audit.sourceEligible
          ? audit.ownedRecommended ? '競技來源可用；單卡高於比較參考' : '競技來源可用；單卡低於參考但未被淘汰'
          : '競技來源 gate 排除';
        const recommendationMarkup = sourceGateExcluded
          ? `<strong>單卡競技基準：未評分（競技來源 gate 已排除）</strong><small>${escapeHtml(eligibleText)}；${escapeHtml(recommendationReason)}</small>`
          : hasRecommendationScore
            ? `<strong>${escapeHtml(presentation?.scoreText || `單卡競技基準 ${recommendationScore.toFixed(1)}/100`)}</strong><span>${escapeHtml(presentation?.gateText || `單卡比較參考：${recommendationPassed ? '高於參考' : '低於參考，仍保留搜尋'}`)}</span><span>${escapeHtml(presentation?.skillFitText || '本場技能適配（必要技能軸）：未解析')}</span><small>${escapeHtml(`這只是單卡訓練／技能 Pt 比較參考，不是候選淘汰線，也不是整副卡組或本場領頭推薦度；${eligibleText}；${recommendationReason}`)}</small>`
            : `<strong>單卡競技基準：未評分</strong><small>${escapeHtml(eligibleText)}；${escapeHtml(recommendationReason)}</small>`;
        return `<article class="guided-deck-alternative-card" role="listitem" data-alternative-card-id="${Number(card.id) || ''}">
          ${supportCardImageMarkup(card, { eager: false })}
          <div><div class="guided-deck-card-badges"><span class="guided-deck-rarity guided-deck-rarity--${String(card.rarity || '').toLowerCase()}">${escapeHtml(card.rarity || '未知稀有度')}</span><span class="guided-deck-type">${escapeHtml(supportTypeLabels[normalizeSupportType(card.supportType)] || normalizeSupportType(card.supportType) || '未指定卡型')}</span><span class="guided-deck-source">${escapeHtml(supportCardSourceLabel(card))}</span></div><strong>卡名：${escapeHtml(labels.title || card.titleZhTw || '未提供卡名')}</strong><span>角色：${escapeHtml(labels.name || card.nameZhTw || card.name || String(card.id))}</span><div class="guided-deck-card-recommendation">${recommendationMarkup}</div></div>
        </article>`;
      }).join('')
      : '<p class="guided-empty" role="listitem">目前沒有額外單卡說明。</p>';
  }

  frontierList.innerHTML = result.frontier.map(item => {
    const card = item.card || {};
    const frontierKey = item.frontierKey || `${item.ownership}:${Number(item.id)}`;
    const labels = localizedSupportLabels(card);
    const slotOptions = item.ownership === 'borrow'
      ? '<option value="5">借卡欄</option>'
      : [0, 1, 2, 3, 4].map(slot => `<option value="${slot}" ${Number(item.slot) === slot ? 'selected' : ''}>自有欄 ${slot + 1}</option>`).join('');
    return `<article class="guided-deck-frontier-row" data-frontier-key="${escapeHtml(frontierKey)}" role="listitem">
      ${supportCardImageMarkup(card, { borrowed: item.ownership === 'borrow', level: item.actualLevel })}
      <div><strong>${escapeHtml(labels.name || card.nameZhTw || String(item.id))}</strong><small>${item.ownership === 'borrow' ? '借卡滿突滿等' : `自有 Lv${item.actualLevel || '?'}／${item.limitBreak || 0}突`} · ${escapeHtml(item.frontierReason || '')}</small></div>
      <label>放入<select data-frontier-slot="${escapeHtml(frontierKey)}">${slotOptions}</select></label>
      <button type="button" class="text-button" data-apply-frontier-card="${escapeHtml(frontierKey)}">套用候選</button>
    </article>`;
  }).join('');

  list.querySelectorAll('[data-apply-deck-package]').forEach(button => {
    button.onclick = () => {
      const packageValue = result.packages.find(item => item.id === button.dataset.applyDeckPackage);
      if (applyDeckPackage(packageValue, {
        focusPackageId: packageValue?.id,
        statusMessage: packageValue
          ? `已套用 ${packageValue.modeLabel || '競技主推薦'}；六卡方案已更新。`
          : '無法套用這個六卡方案。'
      })) {
        byId('guidedDeckPackageStatus').textContent = `已套用 ${packageValue.modeLabel || '競技主推薦'}；現在可作最終父輩確認。`;
      }
    };
  });
  list.querySelectorAll('[data-apply-deck-package]').forEach(button => {
    const packageValue = result.packages.find(item => item.id === button.dataset.applyDeckPackage);
    button.disabled = Boolean(
      !optimizerIdentityStale
      && state.battleOwnedCardsConfirmed
      && packageValue
      && packageMatchesCurrentDeck(packageValue)
    );
  });
  comfortList?.querySelectorAll('[data-focus-deck-package-signature]').forEach(button => {
    button.onclick = () => {
      const packageCard = [...list.querySelectorAll('[data-deck-package-card]')]
        .find(node => node.dataset.deckPackageCard === button.dataset.focusDeckPackageSignature);
      if (!packageCard) return;
      packageCard.scrollIntoView({
        behavior: preferredScrollBehavior(),
        block: 'start'
      });
      packageCard.querySelector('[data-apply-deck-package]')?.focus({ preventScroll: true });
    };
  });
  frontierList.querySelectorAll('[data-apply-frontier-card]').forEach(button => {
    button.onclick = () => {
      const item = result.frontier.find(candidate =>
        (candidate.frontierKey || `${candidate.ownership}:${Number(candidate.id)}`) === button.dataset.applyFrontierCard);
      const slot = Number(frontierList.querySelector(`[data-frontier-slot="${button.dataset.applyFrontierCard}"]`)?.value);
      if (!item || !Number.isInteger(slot) || slot < 0 || slot > 5) return;
      if (slot === 5 || item.ownership === 'borrow') {
        state.battleDeckCardIds[5] = Number(item.id);
      } else {
        state.battleDeckCardIds[slot] = Number(item.id);
      }
      state.battleDeckBorrowedIndex = 5;
      state.deckPackageId = 'custom';
      state.deckPackageModelVersion = Number(result.modelVersion) || 1;
      state.parentSelectionPackageId = null;
      state.battleOwnedCardsConfirmed = false;
      state.selectedAccelerationSkillIds = [];
      state.residualFactorDecisionConfirmed = false;
      renderDeckOptimizationPlans();
      renderBattleDeckEditor();
      renderGuidedProgress();
      scheduleSave();
    };
  });
  renderBattleDeckTrainingPlan();
}

function renderGuidedAccelerationFlow(options = {}) {
  const courseList = byId('guidedCourseAccelerationList');
  const remainingList = byId('guidedRemainingAccelerationList');
  if (!courseList || !remainingList) return;
  const residualList = byId('guidedResidualAccelerationList');
  const noResidualButton = byId('guidedConfirmNoResidual');
  const noResidualNote = byId('guidedResidualDecisionNote');
  const renderRemaining = markup => [remainingList, residualList]
    .filter(Boolean)
    .forEach(node => { node.innerHTML = markup; });

  syncSelectedAccelerations();
  if (!options.deckPending) renderDeckOptimizationPlans();
  const candidates = usefulAccelerationCandidates();
  const target = selectedBattleUmaCard();

  renderGuidedCourseTimeline();
  courseList.innerHTML = candidates.length
    ? [
      ...candidates.slice(0, 6).map(courseAccelerationCard),
      candidates.length > 6
        ? `<details class="course-impact-more"><summary>查看其餘 ${candidates.length - 6} 個有效加速</summary>`
          + candidates.slice(6).map(courseAccelerationCard).join('')
          + '</details>'
        : ''
    ].join('')
    : '<p class="guided-empty">這個賽道目前沒有解析到可用的領頭加速；請確認確切賽道與版本資料。</p>';
  byId('guidedCourseAccelerationStatus').textContent = candidates.length
    ? `${candidates.length} 個・按馬身排序`
    : '沒有有效候選';

  if (!target) {
    renderRemaining('<p class="guided-empty">選定戰馬後，這裡會扣除本體確定持有的同家族加速。</p>');
    byId('guidedBattleUmaStatus').textContent = '尚未選擇';
    byId('guidedAccelerationStatus').textContent = '先選戰馬';
    if (noResidualButton) noResidualButton.hidden = true;
    return;
  }

  const targetInventory = inventoryTraineeByOutfitId.get(Number(target.id));
  byId('guidedBattleUmaStatus').textContent = `${localizedUmaName(target.nameZhTw || target.name)}・覺醒 ${targetInventory?.awakeningLevel || 1}`;
  if (options.deckPending) {
    renderRemaining('<p class="guided-empty">先分析完整六卡，再計算這匹戰馬的剩餘技能缺口。</p>');
    byId('guidedAccelerationStatus').textContent = '等待配卡分析';
    if (noResidualButton) noResidualButton.hidden = true;
    return;
  }

  if (!deckPackageSelectionComplete() || !parentSelectionConfirmedForPackage()) {
    renderRemaining('<p class="guided-empty">套用一組 5+1 卡組並確認主／副親代後，才會重算剩餘技能／因子缺口。</p>');
    byId('guidedAccelerationStatus').textContent = '先確認父輩';
    if (noResidualButton) noResidualButton.hidden = true;
    return;
  }

  const remaining = remainingAccelerationCandidates();
  const selectedIds = new Set(state.selectedAccelerationSkillIds.map(Number));
  if (!remaining.length) {
    renderRemaining('<p class="guided-empty">戰馬固有與卡組已覆蓋目前可操作的技能家族。</p>');
    byId('guidedAccelerationStatus').textContent = '本體已完整覆蓋';
    if (noResidualButton) noResidualButton.hidden = true;
    if (noResidualNote) noResidualNote.textContent = '目前沒有需要再決定的白因子缺口。';
    return;
  }

  const umaOnlySnapshot = activePlanningSnapshot({ ignoreDeck: true });
  const weightedRemaining = remaining
    .map(candidate => ({
      candidate,
      need: umaOnlySnapshot?.rows?.find(row =>
        Number(row.familyId) === Number(candidate.familyId)
      )
    }))
    .sort((a, b) =>
      Number(b.need?.residualWeight || 0) - Number(a.need?.residualWeight || 0)
    );
  const remainingChoices = weightedRemaining.map(({ candidate, need }) => {
    const checked = selectedIds.has(Number(candidate.id));
    const routeName = candidate.factorName
      || (candidate.sourceKind === 'parent-unique' ? `${candidate.name}（繼承版）` : candidate.name);
    const routeBashin = Number(
      candidate.routeImpact?.expectedBashin
      ?? candidate.routeBashin
      ?? 0
    );
    const courseValueLabel = candidate.sourceKind === 'parent-unique'
      ? '繼承版'
      : '原技能';
    return `
      <label class="guided-choice${checked ? ' is-selected' : ''}" data-skill-id="${candidate.id}">
        <input type="checkbox" value="${candidate.id}" ${checked ? 'checked' : ''}>
        <strong>${escapeHtml(routeName)}<b>種馬路線約 +${routeBashin.toFixed(2)} 馬身</b></strong>
        <small>${courseValueLabel}「${escapeHtml(candidate.name)}」單技能 +${Number(candidate.expectedBashin).toFixed(2)}・${escapeHtml(candidate.activationWindow)}・目前馬身權重 ${Number(need?.residualWeight || 0).toFixed(2)}</small>
        <p>${escapeHtml(accelerationAcquisitionText(candidate))}</p>
      </label>`;
  });
  const remainingMarkup = [
    ...remainingChoices.slice(0, 6),
    remainingChoices.length > 6
      ? `<details class="course-impact-more"><summary>查看其餘 ${remainingChoices.length - 6} 個較低權重缺口</summary>`
        + remainingChoices.slice(6).join('')
        + '</details>'
      : ''
  ].join('');
  renderRemaining(remainingMarkup);
  byId('guidedAccelerationStatus').textContent = selectedIds.size
    ? `已選 ${selectedIds.size} 個`
    : state.residualFactorDecisionConfirmed
      ? '已決定本輪不追加'
      : `剩餘 ${remaining.length} 個可選`;

  if (noResidualButton) {
    noResidualButton.hidden = false;
    noResidualButton.setAttribute('aria-pressed', String(
      state.residualFactorDecisionConfirmed && selectedIds.size === 0
    ));
    noResidualButton.textContent = selectedIds.size
      ? '清除勾選，這輪不追加'
      : state.residualFactorDecisionConfirmed
        ? '已決定：這輪不追加'
        : '這輪不額外指定白因子';
    noResidualButton.onclick = () => {
      state.selectedAccelerationSkillIds = [];
      state.residualFactorDecisionConfirmed = true;
      renderGuidedAccelerationFlow();
      renderBattleDeckEditor();
      renderBattleCoverageSummary();
      if (state.activePanel === 'deck') renderDeck();
      scheduleSave();
    };
  }
  if (noResidualNote) {
    noResidualNote.textContent = '這只是本次施工決策；不是宣告這些技能無效，也不會限制你之後改選。';
  }

  [remainingList, residualList].filter(Boolean).forEach(container => container.querySelectorAll('input[type="checkbox"]').forEach(input => {
    input.onchange = () => {
      const id = Number(input.value);
      const next = new Set(state.selectedAccelerationSkillIds.map(Number));
      if (input.checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      state.selectedAccelerationSkillIds = [...next];
      state.residualFactorDecisionConfirmed = true;
      renderGuidedAccelerationFlow();
      renderBattleDeckEditor();
      renderBattleCoverageSummary();
      if (state.activePanel === 'deck') renderDeck();
      scheduleSave();
    };
  }));
}

const GUIDED_STAGE_META = {
  course: {
    id: 'guidedStageCourse',
    contentId: 'guidedStageCourseContent',
    summaryId: 'guidedCourseStageSummary',
    dockStatusId: 'guidedDockCourseStatus'
  },
  uma: {
    id: 'guidedStageUma',
    contentId: 'guidedStageUmaContent',
    summaryId: 'guidedUmaStageSummary',
    dockStatusId: 'guidedDockUmaStatus'
  },
  acceleration: {
    id: 'guidedStageAcceleration',
    contentId: 'guidedStageAccelerationContent',
    summaryId: 'guidedAccelerationStageSummary',
    dockStatusId: 'guidedDockAccelerationStatus'
  },
  parents: {
    id: 'guidedStageParents',
    contentId: 'guidedStageParentsContent',
    summaryId: 'guidedParentsStageSummary',
    dockStatusId: 'guidedDockParentsStatus'
  },
  owned: {
    id: 'guidedStageOwnedCards',
    contentId: 'guidedStageOwnedCardsContent',
    summaryId: 'guidedOwnedStageSummary',
    dockStatusId: 'guidedDockOwnedStatus'
  },
  borrow: {
    id: 'guidedStageBorrow',
    contentId: 'guidedStageBorrowContent',
    summaryId: 'guidedBorrowStageSummary',
    dockStatusId: 'guidedDockBorrowStatus'
  }
};

function setGuidedStageState(id, stateName) {
  const stage = byId(id);
  if (!stage) return;
  stage.classList.toggle('is-current', stateName === 'current');
  stage.classList.toggle('is-complete', stateName === 'complete');
  stage.classList.toggle('is-locked', stateName === 'locked');
  stage.classList.toggle('is-preview', stateName === 'preview');
  stage.dataset.stageState = stateName;
  // Keep the compact summary readable/focusable even when its full stage is locked.
  // The workbench sync below owns whether the detailed controls are inert/hidden.
  stage.inert = false;
  stage.setAttribute('aria-disabled', String(stateName === 'locked'));
}

function openGuidedStage(key, options = {}) {
  const meta = GUIDED_STAGE_META[key];
  const stateName = guidedStageStates[key];
  if (!meta || stateName === 'locked') return false;
  guidedOpenStage = key;
  renderGuidedWorkbench();
  if (options.focus) {
    const heading = byId(meta.contentId)?.querySelector('.guided-stage-heading h3');
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }
  return true;
}

function renderGuidedWorkbench(context = {}) {
  const { stageStates, currentStage, summaries, currentPlan } = context;
  if (stageStates) guidedStageStates = { ...stageStates };
  if (!Object.keys(guidedStageStates).length) return;

  const receivedCurrentStage = Boolean(currentStage);
  const logicalStage = currentStage
    || guidedLastCurrentStage
    || Object.keys(guidedStageStates).find(key => guidedStageStates[key] === 'current')
    || 'course';
  const previousOpenStage = guidedOpenStage;
  const focusedElement = document.activeElement;
  const currentStageChanged = Boolean(
    receivedCurrentStage
    && guidedLastCurrentStage
    && logicalStage !== guidedLastCurrentStage
  );
  const focusedStage = focusedElement?.closest?.('.guided-stage');
  const focusNeedsRepair = Boolean(
    currentStageChanged
    && previousOpenStage
    && previousOpenStage !== logicalStage
    && focusedStage?.dataset.guidedStage === previousOpenStage
  );
  const openState = guidedStageStates[guidedOpenStage];
  if (!guidedOpenStage || openState === 'locked' || (receivedCurrentStage && logicalStage !== guidedLastCurrentStage)) {
    guidedOpenStage = logicalStage;
  }
  if (receivedCurrentStage) guidedLastCurrentStage = logicalStage;

  Object.entries(GUIDED_STAGE_META).forEach(([key, meta]) => {
    const stage = byId(meta.id);
    const content = byId(meta.contentId);
    const stateName = guidedStageStates[key] || 'locked';
    const expanded = key === guidedOpenStage && stateName !== 'locked';
    const locked = stateName === 'locked';
    if (stage) stage.classList.toggle('is-expanded', expanded);
    if (content) {
      content.hidden = !expanded;
      content.inert = !expanded || locked;
      // A previously collapsed stage can contain lazy card/portrait art. Promote
      // it when the user opens that stage so its visible identities are not held
      // back by a browser's off-screen lazy-load heuristic.
      if (expanded) {
        content.querySelectorAll('img[loading="lazy"]').forEach(image => {
          image.loading = 'eager';
        });
      }
    }
    document.querySelectorAll(`[data-guided-stage-open="${key}"]`).forEach(control => {
      control.disabled = locked;
      control.classList.toggle('is-open', expanded);
      control.dataset.stageState = stateName;
      control.setAttribute('aria-expanded', String(expanded));
      control.setAttribute('aria-disabled', String(locked));
      if (control.closest('.guided-stage-dock')) {
        if (key === logicalStage) control.setAttribute('aria-current', 'step');
        else control.removeAttribute('aria-current');
      }
    });
    const summary = byId(meta.summaryId);
    if (summary && summaries?.[key]) summary.textContent = summaries[key];
    const dockStatus = byId(meta.dockStatusId);
    if (dockStatus && summaries?.[key]) dockStatus.textContent = summaries[key];
  });
  if (focusNeedsRepair) {
    if (guidedInputModality === 'pointer') {
      // Do not pull a pointer user's focus or viewport into the next stage, but
      // also never leave focus inside content that has just become hidden/inert.
      focusedElement.blur?.();
    } else {
      const nextMeta = GUIDED_STAGE_META[logicalStage];
      const heading = byId(nextMeta?.contentId)?.querySelector('.guided-stage-heading h3');
      const dockControl = document.querySelector(
        `.guided-stage-dock [data-guided-stage-open="${logicalStage}"]`
      );
      const focusTarget = heading || dockControl;
      if (focusTarget) {
        if (heading) heading.tabIndex = -1;
        focusTarget.focus({ preventScroll: true });
        requestAnimationFrame(() => focusTarget.scrollIntoView({
          behavior: preferredScrollBehavior(),
          block: 'nearest'
        }));
      }
    }
  }
  const plan = byId('guidedCurrentPlan');
  if (plan && currentPlan) plan.textContent = currentPlan;
}

function renderGuidedDeckPending() {
  const status = byId('guidedDeckPackageStatus');
  const list = byId('guidedDeckPackageList');
  const shortage = byId('guidedDeckShortage');
  const pendingMarkup = '<li class="guided-empty">先分析完整六卡，再計算這匹戰馬的剩餘技能缺口。</li>';
  if (status) {
    status.dataset.state = 'pending';
    status.textContent = selectedBattleUmaCard()
      ? '已選戰馬；打開「配卡與養法」後才整理理論六卡。'
      : '先選戰馬。';
  }
  if (list) {
    list.innerHTML = selectedBattleUmaCard()
      ? '<li class="guided-deck-lazy-placeholder"><strong>配卡尚未載入</strong><span>需要時再執行六卡模型，不阻塞選戰馬。</span><button type="button" class="primary" data-run-guided-deck-analysis>開始分析配卡</button></li>'
      : '<li class="guided-empty" role="listitem">請先選擇戰馬，才能比較 5＋1 卡組方案。</li>';
    list.querySelector('[data-run-guided-deck-analysis]')?.addEventListener('click', requestGuidedDeckStageRender);
  }
  if (shortage) shortage.textContent = selectedBattleUmaCard() ? '等待開啟配卡步驟' : '尚未選擇戰馬';
  ['guidedRemainingAccelerationList', 'guidedResidualAccelerationList'].forEach(id => {
    const node = byId(id);
    if (node) node.innerHTML = pendingMarkup;
  });
  const accelerationStatus = byId('guidedAccelerationStatus');
  if (accelerationStatus) accelerationStatus.textContent = '等待配卡分析';
  const comfortSummary = byId('guidedDeckComfortSummary');
  if (comfortSummary) comfortSummary.textContent = '分析配卡後，這裡才比較理論最優與你的自配。';
  const comfortList = byId('guidedDeckComfortList');
  if (comfortList) comfortList.innerHTML = '';
}

function requestGuidedDeckStageRender() {
  if (!selectedBattleUmaCard()) return;
  if (peekActiveDeckOptimization()) {
    renderGuidedAccelerationFlow();
    renderBattleDeckEditor();
    renderGuidedParentStage();
    renderBattleCoverageSummary();
    return;
  }
  const token = ++guidedDeckRenderToken;
  const status = byId('guidedDeckPackageStatus');
  const list = byId('guidedDeckPackageList');
  if (status) {
    status.dataset.state = 'loading';
    status.textContent = '正在整理這匹戰馬的理論六卡…';
  }
  if (list) {
    list.innerHTML = `<li class="guided-deck-loading" aria-label="正在整理六卡">${Array.from({ length: 6 }, () => '<span></span>').join('')}</li>`;
  }
  requestAnimationFrame(() => setTimeout(() => {
    if (token !== guidedDeckRenderToken) return;
    renderGuidedAccelerationFlow();
    renderBattleDeckEditor();
    renderGuidedParentStage();
    renderBattleCoverageSummary();
  }, 0));
}

function initGuidedWorkbench() {
  const planner = byId('guidedPlanner');
  planner?.addEventListener('pointerdown', () => {
    guidedInputModality = 'pointer';
  }, true);
  planner?.addEventListener('keydown', () => {
    guidedInputModality = 'keyboard';
  }, true);
  document.querySelectorAll('[data-guided-stage-open]').forEach(control => {
    control.onclick = event => {
      const stageKey = control.dataset.guidedStageOpen;
      const opened = openGuidedStage(stageKey, {
        focus: event.detail === 0
      });
      if (opened) {
        event.preventDefault();
        if (stageKey === 'acceleration') requestGuidedDeckStageRender();
      }
    };
  });
}

function renderGuidedProgress() {
  renderGuidedParentStage();
  const courseComplete = Boolean(activeRaceStrategy());
  const umaComplete = Boolean(selectedBattleUmaCard());
  const parentsComplete = parentSelectionComplete();
  const packageComplete = deckPackageSelectionComplete();
  const finalParentsComplete = packageComplete && parentSelectionConfirmedForPackage();
  const accelerationComplete = finalParentsComplete && accelerationSelectionComplete();
  const ownedValidation = battleOwnedCardValidation();
  const ownedComplete = packageComplete && ownedValidation.valid && state.battleOwnedCardsConfirmed;
  const fullValidation = battleDeckValidation();
  const borrowComplete = packageComplete
    && finalParentsComplete
    && accelerationComplete
    && ownedComplete
    && fullValidation.valid;

  const stageStates = {
    course: courseComplete ? 'complete' : 'current',
    uma: !courseComplete ? 'locked' : umaComplete ? 'complete' : 'current',
    acceleration: !umaComplete ? 'locked' : packageComplete ? 'complete' : 'current',
    parents: !umaComplete
      ? 'locked'
      : finalParentsComplete
        ? 'complete'
        : packageComplete
          ? 'current'
          : 'preview',
    owned: !finalParentsComplete ? 'locked' : !accelerationComplete ? 'current' : 'complete',
    borrow: !accelerationComplete ? 'locked' : borrowComplete ? 'complete' : 'current'
  };
  Object.entries(GUIDED_STAGE_META).forEach(([key, meta]) => {
    setGuidedStageState(meta.id, stageStates[key]);
  });

  if (byId('guidedParentsStatus')) {
    byId('guidedParentsStatus').textContent = !umaComplete
      ? '先選戰馬'
      : parentSelectionConfirmedForPackage()
        ? '主／副親代已確認'
      : parentsComplete && packageComplete
        ? '請重新確認此卡組的父輩'
        : parentsComplete
          ? '父輩預覽已選，等待卡組確認'
          : `${recommendedParentPair().length >= 2 ? '請選主、副親代' : '候選不足'}・${[state.main, state.sub].filter(hasSelectedParentId).length}/2`;
  }

  if (parentsComplete && !packageComplete && byId('guidedParentsStatus')) {
    byId('guidedParentsStatus').textContent = '目前為父輩預覽；套用卡組後才作最終確認';
  }

  if (byId('guidedOwnedCardsStatus')) {
    byId('guidedOwnedCardsStatus').textContent = !finalParentsComplete
      ? '先確認父輩'
      : !accelerationComplete
        ? '請決定是否追加白因子'
        : selectedAccelerationCandidates().length
          ? `已選 ${selectedAccelerationCandidates().length} 個因子目標`
          : '已決定本輪不追加';
  }

  const completed = [umaComplete, packageComplete, finalParentsComplete, accelerationComplete, borrowComplete]
    .filter(Boolean).length;
  const progress = byId('guidedProgress');
  const currentStep = borrowComplete ? 5 : Math.min(5, completed + 1);
  if (progress) {
    progress.max = 5;
    progress.value = currentStep;
    progress.textContent = `${currentStep}／5`;
  }
  const progressText = byId('guidedProgressText');
  const nextLabels = [
    '選擇戰馬',
    '比較並確認 5+1 卡組',
    '完成父輩確認',
    '檢視剩餘技能／因子',
    '確認完整六卡並完成'
  ];
  if (progressText) {
    progressText.textContent = borrowComplete
      ? '5／5　戰馬與配卡方案完成'
      : `${currentStep}／5　${nextLabels[Math.min(completed, 4)]}`;
  }

  const nextButton = byId('guidedToRoute');
  if (nextButton) nextButton.disabled = !borrowComplete;
  const routeStep = document.querySelector('.step[data-step="deck"]');
  if (routeStep) {
    routeStep.disabled = !borrowComplete;
    routeStep.setAttribute('aria-disabled', String(!borrowComplete));
  }
  const summary = byId('guidedReadySummary');
  if (summary) {
    summary.textContent = borrowComplete
      ? `戰馬六卡方案已完成：5 張自有卡＋1 張借卡。可進入種馬路線。`
      : !umaComplete
        ? '先選擇要養的戰馬，系統才會扣除本體加速。'
        : !packageComplete
          ? '先從四組 5+1 方案中明確選擇並套用一組；父輩目前只作預覽。'
          : !parentsComplete
            ? '請各選一名主親代與副親代；兩名必須不同角色且不能是目標戰馬。'
          : !accelerationComplete
            ? '請檢視卡組與父輩重算後的剩餘技能／因子缺口。'
          : !ownedComplete
            ? ownedValidation.valid
              ? '請檢視完整六卡；若未手動修改，不需要再次確認。'
              : '請修正五張自有卡；不可重複，也不能與戰馬同角色。'
            : '第 3 步已確認借卡；此處只顯示完整方案摘要。';
  }
  const target = selectedBattleUmaCard();
  const targetName = target ? localizedUmaName(target.nameZhTw || target.name) : '';
  const scenario = activeBattleScenario();
  const scenarioName = scenario?.nameZhTw || scenario?.name || scenario?.label || '';
  const selectedPackage = state.battleOwnedCardsConfirmed ? currentDeckPackage() : null;
  const currentStage = borrowComplete
    ? 'borrow'
    : Object.keys(stageStates).find(key => stageStates[key] === 'current') || 'course';
  renderGuidedWorkbench({
    stageStates,
    currentStage,
    summaries: {
      course: courseComplete
        ? `${usefulAccelerationCandidates().length} 個有效加速`
        : '等待賽道',
      uma: target ? `${targetName}${scenarioName ? `・${scenarioName}` : ''}` : '尚未選擇',
      acceleration: packageComplete
        ? '完整 5+1 已確認'
        : umaComplete ? '選擇競技主方案' : '等待戰馬',
      parents: finalParentsComplete
        ? '主／副親代已確認'
        : packageComplete ? '確認主／副親代' : '等待配卡',
      owned: accelerationComplete
        ? selectedAccelerationCandidates().length
          ? `已選 ${selectedAccelerationCandidates().length} 個因子目標`
          : '本輪不追加因子'
        : finalParentsComplete ? '決定是否追加白因子' : '等待父輩',
      borrow: borrowComplete ? '可進入種馬路線' : accelerationComplete ? '完成六卡確認' : '等待前序完成'
    },
    currentPlan: target
      ? `目前計畫：${targetName}${scenarioName ? `・${scenarioName}` : ''}${selectedPackage
        ? `・${selectedPackage.modeLabel || '5+1 方案'}`
        : packageComplete
          ? '・你的自配 5+1'
          : '・待確認 5+1'}`
      : '先由你選戰馬；完整建構未齊前不產生強弱排行'
  });
  return { ready: borrowComplete, completed };
}

function battleOwnedCardValidation() {
  const cards = state.battleDeckCardIds.slice(0, 5)
    .map(id => supportCatalogById.get(Number(id)) || null);
  const problems = [];
  if (cards.some(card => !card)) problems.push('五個自有卡位都必須指定');
  const ids = cards.filter(Boolean).map(card => Number(card.id));
  if (new Set(ids).size !== ids.length) problems.push('同一張支援卡不能重複');
  const requiredIds = scenarioRequiredSupportIds();
  const exactOwnedIds = ids.filter(id => requiredIds.includes(Number(id)));
  if (exactOwnedIds.length > 1) {
    problems.push(`劇本必帶替代集合只能占一張 exact 卡（${requiredIds.join('／')}）`);
  }
  const usableExactIds = requiredIds.filter(id => {
    const card = supportCatalogById.get(Number(id));
    return card && supportCardIsAvailableForManualDeck(card);
  });
  const heldUsableExactIds = usableExactIds.filter(id => inventorySupportById.has(Number(id)));
  if (heldUsableExactIds.length
    && !exactOwnedIds.some(id => heldUsableExactIds.includes(Number(id)))) {
    problems.push(`已持有劇本 exact 卡 ${heldUsableExactIds.join('／')} 必須占用自有卡位`);
  }
  if (requiredIds.length && !usableExactIds.length) {
    problems.push(`劇本必帶替代集合（${requiredIds.join('／')}）沒有可用 exact 卡資料`);
  }
  cards.forEach(card => {
    if (!card) return;
    if (!supportCardIsAvailableForManualDeck(card)) {
      problems.push(`${localizedSupportLabels(card).name} 不在目前繁中服可用卡池`);
    }
    if (!inventorySupportById.has(Number(card.id))) {
      problems.push(`${localizedSupportLabels(card).name} 不是自有卡`);
    }
  });
  const targetCharacterId = Number(selectedBattleUmaCard()?.characterId);
  if (Number.isFinite(targetCharacterId) && cards.some(card => Number(card?.characterId) === targetCharacterId)) {
    problems.push('不能使用與育成戰馬相同角色的支援卡');
  }
  return {
    valid: problems.length === 0,
    problems,
    cards
  };
}

function battleDeckValidationOptions() {
  const strategy = activeRaceStrategy() || {};
  const template = expectedBattleDeckTemplate();
  return {
    battleUma: selectedBattleUmaCard(),
    inventory,
    plannerRules,
    supportCatalog: gameCatalog?.supports || [],
    supportProfiles: supportCardProfiles,
    curatedFixtures: supportCardLevelFixtures,
    skills: gameCatalog?.skills || [],
    typeTemplate: template,
    targetTypes: template.requiredTypes,
    desiredTypeTemplate: template,
    // Manual construction follows game/scenario legality. The optimizer may
    // still use the preferred template and competitive source gate when it
    // builds the theoretical package, but neither may block the user's 5+1.
    typeTemplateMode: 'free',
    competitionMode: false,
    requireSpeedCard: false,
    scenario: activeBattleScenario(),
    context: { ...(strategy.context || {}), running_style: 1 },
    ...acquisitionIntegrationOptions(),
    server: 'zh_tw'
  };
}

function supportCardIsAvailableForManualDeck(card) {
  if (!card) return false;
  if (typeof deckOptimizerCore?.cardIsServerAvailable === 'function') {
    return deckOptimizerCore.cardIsServerAvailable(card, { server: 'zh_tw' });
  }
  return card.availableOnServer !== false
    && card.serverAvailable !== false
    && (!Array.isArray(card.availableOnServers) || card.availableOnServers.includes('zh_tw'))
    && card.serverAvailability?.zh_tw !== false;
}

function battleDeckValidationCard(card, borrowed, options, selectedCards) {
  if (!card) return null;
  const id = Number(card.id);
  const profile = supportCardProfileById.get(id);
  const fixture = supportCardFixtureById.get(id);
  const owned = inventorySupportById.get(id);
  const requestedLevel = borrowed
    ? Number.MAX_SAFE_INTEGER
    : owned
      ? (Number.isFinite(Number(owned.level)) ? Number(owned.level) : 1)
      : 1;
  const requestedLimitBreak = borrowed
    ? 4
    : Math.max(0, Math.min(4, Number(owned?.limitBreak) || 0));
  const instance = {
    ...card,
    id,
    borrowed: Boolean(borrowed),
    borrowedAtMax: Boolean(borrowed),
    level: requestedLevel,
    limitBreak: requestedLimitBreak
  };
  const resolved = deckOptimizerCore?.resolveProfile
    ? deckOptimizerCore.resolveProfile(instance, profile, options.context, fixture, selectedCards)
    : null;
  return {
    ...instance,
    level: Number(resolved?.level ?? requestedLevel),
    limitBreak: Number(resolved?.limitBreak ?? requestedLimitBreak)
  };
}

function battleDeckValidation() {
  const owned = battleOwnedCardValidation();
  const borrowed = supportCatalogById.get(Number(state.battleDeckCardIds[5])) || null;
  const problems = [...owned.problems];
  if (state.battleDeckBorrowedIndex !== 5) problems.push('借卡欄必須位於完整六卡的最後一格');
  if (!borrowed) problems.push('尚未產生推薦借卡');
  if (borrowed && owned.cards.some(card => Number(card?.id) === Number(borrowed.id))) {
    problems.push('借卡不能與五張自有卡重複');
  }
  const targetCharacterId = Number(selectedBattleUmaCard()?.characterId);
  if (borrowed && Number.isFinite(targetCharacterId) && Number(borrowed.characterId) === targetCharacterId) {
    problems.push('借卡不能與育成戰馬是同一角色');
  }
  const cards = [...owned.cards, borrowed];
  const speedCount = cards.filter(card =>
    normalizeSupportType(card?.supportType) === 'Speed'
  ).length;
  const options = battleDeckValidationOptions();
  const selectedCards = cards.filter(Boolean);
  const ownedInstances = owned.cards.map(card =>
    battleDeckValidationCard(card, false, options, selectedCards)
    || { id: null, borrowed: false }
  );
  const borrowedInstance = battleDeckValidationCard(borrowed, true, options, selectedCards);
  const packageValidation = deckOptimizerCore?.validatePackage
    ? deckOptimizerCore.validatePackage({
      ownedCards: ownedInstances,
      borrowedCard: borrowedInstance
    }, options)
    : { valid: false, errors: ['卡組驗證核心未載入'] };
  for (const error of packageValidation.errors || []) {
    if (!problems.includes(error)) problems.push(error);
  }
  return {
    valid: Boolean(packageValidation.valid) && problems.length === 0,
    problems,
    cards,
    speedCount,
    packageValidation,
    instances: [...ownedInstances, borrowedInstance].filter(Boolean)
  };
}

function ownedSupportPickerCards() {
  const targetCharacterId = Number(selectedBattleUmaCard()?.characterId);
  return (gameCatalog?.supports || [])
    .filter(card => inventorySupportById.has(Number(card.id)))
    .filter(supportCardIsAvailableForManualDeck)
    .filter(card => !Number.isFinite(targetCharacterId) || Number(card.characterId) !== targetCharacterId)
    .slice()
    .sort((a, b) => {
      return String(normalizeSupportType(a.supportType)).localeCompare(String(normalizeSupportType(b.supportType)))
        || ({ SSR: 0, SR: 1, R: 2 }[a.rarity] ?? 9) - ({ SSR: 0, SR: 1, R: 2 }[b.rarity] ?? 9)
        || plannerCore.cardScore(b) - plannerCore.cardScore(a)
        || Number(a.id) - Number(b.id);
    });
}

function ownedSupportSelectOptions(selectedId) {
  const cards = ownedSupportPickerCards();
  return Object.keys(supportTypeLabels)
    .filter(type => type !== 'Any')
    .map(type => {
      const matches = cards.filter(card => normalizeSupportType(card.supportType) === type);
      if (!matches.length) return '';
      return `<optgroup label="${supportTypeLabels[type] || type}">${matches.map(card => {
        const labels = localizedSupportLabels(card);
        const owned = inventorySupportById.get(Number(card.id));
        const detail = owned ? `Lv${owned.level}・${owned.limitBreak}突` : '等級未建檔';
        const label = `${labels.name || card.name || card.id}${labels.title ? `・${labels.title}` : ''}`;
        return `<option value="${card.id}" ${Number(card.id) === Number(selectedId) ? 'selected' : ''}>${escapeHtml(label)}｜${detail}</option>`;
      }).join('')}</optgroup>`;
    }).join('');
}

function manualBorrowSupportPickerCards() {
  const targetCharacterId = Number(selectedBattleUmaCard()?.characterId);
  const optimizer = peekActiveDeckOptimization();
  const rankedIds = [
    ...(optimizer?.packages || []).map(item => Number(item.borrowedCard?.id)),
    ...(optimizer?.frontier || [])
      .filter(item => item.ownership === 'borrow')
      .map(item => Number(item.id))
  ].filter(Number.isFinite);
  const rank = new Map(rankedIds.map((id, index) => [id, index]));
  return (gameCatalog?.supports || [])
    .filter(supportCardIsAvailableForManualDeck)
    .filter(card => !Number.isFinite(targetCharacterId) || Number(card.characterId) !== targetCharacterId)
    .sort((a, b) =>
      (rank.get(Number(a.id)) ?? Number.MAX_SAFE_INTEGER) - (rank.get(Number(b.id)) ?? Number.MAX_SAFE_INTEGER)
      || String(normalizeSupportType(a.supportType)).localeCompare(String(normalizeSupportType(b.supportType)))
      || String(localizedSupportLabels(a).name).localeCompare(String(localizedSupportLabels(b).name), 'zh-Hant')
      || Number(a.id) - Number(b.id)
    );
}

function manualBorrowSupportSelectOptions(selectedId) {
  const ownedIds = new Set(state.battleDeckCardIds.slice(0, 5).map(Number));
  const ownedCharacterIds = new Set(state.battleDeckCardIds.slice(0, 5)
    .map(id => supportCatalogById.get(Number(id)))
    .map(card => Number(card?.characterId))
    .filter(Number.isFinite));
  const cards = manualBorrowSupportPickerCards()
    .filter(card => !ownedIds.has(Number(card.id))
      && !ownedCharacterIds.has(Number(card.characterId)));
  return cards.map(card => {
    const labels = localizedSupportLabels(card);
    const isSelected = Number(card.id) === Number(selectedId);
    const type = supportTypeLabels[normalizeSupportType(card.supportType)] || normalizeSupportType(card.supportType);
    return `<option value="${Number(card.id)}" ${isSelected ? 'selected' : ''}>${escapeHtml(labels.name || card.name || String(card.id))}｜${escapeHtml(type)}</option>`;
  }).join('');
}

const supportCardPickerState = {
  role: null,
  slotIndex: null,
  type: 'All',
  query: ''
};

function supportPickerSearchText(card) {
  const labels = localizedSupportLabels(card);
  const type = normalizeSupportType(card?.supportType);
  return [
    card?.id,
    labels.name,
    labels.title,
    card?.name,
    card?.nameJp,
    card?.title,
    card?.titleJp,
    supportTypeLabels[type],
    type
  ].filter(Boolean).join(' ').normalize('NFKC').toLocaleLowerCase('zh-Hant');
}

function supportPickerConflictReason(card, role, slotIndex) {
  const checkedIndexes = role === 'owned'
    ? [0, 1, 2, 3, 4].filter(index => index !== slotIndex)
    : [0, 1, 2, 3, 4];
  const selectedCards = checkedIndexes
    .map(index => supportCatalogById.get(Number(state.battleDeckCardIds[index])))
    .filter(Boolean);
  if (selectedCards.some(selected => Number(selected.id) === Number(card.id))) return '同一張卡已在其他卡位';
  if (selectedCards.some(selected => Number(selected.characterId) === Number(card.characterId))) return '同角色支援卡已在其他卡位';
  return '';
}

function supportPickerCandidates() {
  return supportCardPickerState.role === 'borrowed'
    ? manualBorrowSupportPickerCards()
    : ownedSupportPickerCards();
}

function supportPickerCardMarkup(card) {
  const role = supportCardPickerState.role;
  const selectedId = role === 'borrowed'
    ? Number(state.battleDeckCardIds[5])
    : Number(state.battleDeckCardIds[supportCardPickerState.slotIndex]);
  const selected = Number(card.id) === selectedId;
  const type = normalizeSupportType(card.supportType);
  const labels = localizedSupportLabels(card);
  const conflict = supportPickerConflictReason(card, role, supportCardPickerState.slotIndex);
  const owned = inventorySupportById.get(Number(card.id));
  const detail = role === 'borrowed'
    ? '借卡・滿突滿等'
    : owned ? `自有・Lv${owned.level}・${owned.limitBreak}突` : '自有資料未建檔';
  return `<button type="button" class="support-card-picker-card${selected ? ' is-selected' : ''}" data-support-picker-card-id="${Number(card.id)}" data-support-type="${escapeHtml(type)}" ${conflict ? 'disabled' : ''} aria-pressed="${selected ? 'true' : 'false'}">
    <span class="support-card-picker-art">${supportCardImageMarkup(card, { borrowed: role === 'borrowed', level: role === 'borrowed' ? 50 : owned?.level })}</span>
    <span class="support-card-picker-copy">
      <span class="support-card-picker-badges"><b>${escapeHtml(supportTypeLabels[type] || type)}</b><em>${escapeHtml(card.rarity || '')}</em>${selected ? '<i>目前選擇</i>' : ''}</span>
      <strong>${escapeHtml(labels.name || String(card.id))}</strong>
      <small>${escapeHtml(labels.title || '')}</small>
      <span>${escapeHtml(detail)}</span>
      ${conflict ? `<mark>${escapeHtml(conflict)}</mark>` : ''}
    </span>
  </button>`;
}

function renderSupportCardPicker() {
  const types = byId('supportCardPickerTypes');
  const results = byId('supportCardPickerResults');
  const status = byId('supportCardPickerStatus');
  if (!types || !results || !status || !supportCardPickerState.role) return;
  const query = String(supportCardPickerState.query || '').trim().normalize('NFKC').toLocaleLowerCase('zh-Hant');
  const candidates = supportPickerCandidates();
  const queryMatches = candidates.filter(card => !query || supportPickerSearchText(card).includes(query));
  const typeCounts = new Map(supportPickerTypeOrder.map(type => [
    type,
    queryMatches.filter(card => normalizeSupportType(card.supportType) === type).length
  ]));
  types.innerHTML = [
    `<button type="button" data-support-picker-type="All" aria-pressed="${supportCardPickerState.type === 'All'}">全部 <span>${queryMatches.length}</span></button>`,
    ...supportPickerTypeOrder.map(type => `<button type="button" data-support-picker-type="${type}" aria-pressed="${supportCardPickerState.type === type}">${escapeHtml(supportTypeLabels[type] || type)} <span>${typeCounts.get(type) || 0}</span></button>`)
  ].join('');
  const activeTypes = supportCardPickerState.type === 'All'
    ? supportPickerTypeOrder
    : [supportCardPickerState.type];
  const selectedId = supportCardPickerState.role === 'borrowed'
    ? Number(state.battleDeckCardIds[5])
    : Number(state.battleDeckCardIds[supportCardPickerState.slotIndex]);
  let visibleCount = 0;
  const sections = activeTypes.map(type => {
    const matches = queryMatches.filter(card => normalizeSupportType(card.supportType) === type);
    if (!matches.length) return '';
    const limit = supportCardPickerState.type === 'All' && !query ? 24 : 120;
    const visible = matches.slice(0, limit);
    const selectedCard = matches.find(card => Number(card.id) === selectedId);
    if (selectedCard && !visible.some(card => Number(card.id) === selectedId)) visible.push(selectedCard);
    visibleCount += visible.length;
    return `<section class="support-card-picker-group" data-support-picker-group="${type}">
      <header><h3>${escapeHtml(supportTypeLabels[type] || type)}</h3><span>${matches.length} 張</span></header>
      <div class="support-card-picker-grid">${visible.map(supportPickerCardMarkup).join('')}</div>
      ${matches.length > visible.length ? `<p>此屬性尚有 ${matches.length - visible.length} 張；點上方「${escapeHtml(supportTypeLabels[type] || type)}」或輸入名稱即可縮小範圍。</p>` : ''}
    </section>`;
  }).join('');
  results.innerHTML = sections || '<p class="support-card-picker-empty">找不到符合條件的支援卡。</p>';
  status.textContent = query
    ? `搜尋「${supportCardPickerState.query}」：${queryMatches.length} 張符合，畫面顯示 ${visibleCount} 張。`
    : `共 ${candidates.length} 張可選；依固定屬性順序排列，畫面顯示 ${visibleCount} 張。`;
  types.querySelectorAll('[data-support-picker-type]').forEach(button => {
    button.onclick = () => {
      supportCardPickerState.type = button.dataset.supportPickerType || 'All';
      renderSupportCardPicker();
    };
  });
  results.querySelectorAll('[data-support-picker-card-id]').forEach(button => {
    button.onclick = () => {
      const id = Number(button.dataset.supportPickerCardId);
      if (!Number.isFinite(id)) return;
      const dialog = byId('supportCardPickerDialog');
      if (typeof dialog?.close === 'function') dialog.close();
      else dialog?.removeAttribute('open');
      if (supportCardPickerState.role === 'borrowed') applyBattleBorrowedCardSelection(id);
      else applyBattleOwnedCardSelection(supportCardPickerState.slotIndex, id);
    };
  });
}

function openSupportCardPicker(role, slotIndex = null) {
  const dialog = byId('supportCardPickerDialog');
  const search = byId('supportCardPickerSearch');
  const title = byId('supportCardPickerTitle');
  const subtitle = byId('supportCardPickerSubtitle');
  if (!dialog || !search || !title || !subtitle) return;
  supportCardPickerState.role = role === 'borrowed' ? 'borrowed' : 'owned';
  supportCardPickerState.slotIndex = supportCardPickerState.role === 'owned' ? Number(slotIndex) : 5;
  supportCardPickerState.query = '';
  const currentId = supportCardPickerState.role === 'borrowed'
    ? state.battleDeckCardIds[5]
    : state.battleDeckCardIds[supportCardPickerState.slotIndex];
  const currentCard = supportCatalogById.get(Number(currentId));
  supportCardPickerState.type = normalizeSupportType(currentCard?.supportType) || 'All';
  title.textContent = supportCardPickerState.role === 'borrowed'
    ? '選擇第 6 張借卡'
    : `選擇第 ${supportCardPickerState.slotIndex + 1} 張自有卡`;
  subtitle.textContent = supportCardPickerState.role === 'borrowed'
    ? '借卡以滿突滿等顯示；屬性位置固定，搜尋可跨全部屬性。'
    : '只列你已持有且目前伺服器可用的卡；屬性位置固定。';
  search.value = '';
  search.oninput = () => {
    supportCardPickerState.query = search.value;
    renderSupportCardPicker();
  };
  byId('supportCardPickerClose').onclick = () => dialog.close();
  dialog.onclick = event => {
    if (event.target === dialog) dialog.close();
  };
  renderSupportCardPicker();
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
  requestAnimationFrame(() => search.focus());
}

function applyBattleBorrowedCardSelection(borrowedId) {
  if (!Number.isFinite(Number(borrowedId))) return;
  state.battleDeckCardIds[5] = Number(borrowedId);
  state.battleDeckBorrowedIndex = 5;
  state.deckPackageId = 'custom';
  state.deckPackageModelVersion = Number(activeDeckOptimization()?.modelVersion) || 1;
  state.parentSelectionPackageId = null;
  state.selectedAccelerationSkillIds = [];
  state.residualFactorDecisionConfirmed = false;
  state.battleOwnedCardsConfirmed = false;
  renderDeckOptimizationPlans();
  renderBattleDeckEditor();
  renderGuidedProgress();
  scheduleSave();
}

function applyBattleOwnedCardSelection(index, cardId) {
  if (!Number.isInteger(Number(index)) || Number(index) < 0 || Number(index) > 4) return;
  if (!Number.isFinite(Number(cardId))) return;
  state.battleDeckCardIds[Number(index)] = Number(cardId);
  state.battleDeckBorrowedIndex = 5;
  state.deckPackageId = 'custom';
  state.deckPackageModelVersion = Number(activeDeckOptimization()?.modelVersion) || 1;
  state.parentSelectionPackageId = null;
  state.selectedAccelerationSkillIds = [];
  state.residualFactorDecisionConfirmed = false;
  state.battleOwnedCardsConfirmed = false;
  renderDeckOptimizationPlans();
  renderBattleDeckEditor();
  renderBattleCoverageSummary();
  renderCurrentRaceProfile();
  renderSkillPlan();
  if (state.activePanel === 'deck') renderDeck();
  scheduleSave();
}

function battleBorrowRecommendation() {
  const selected = selectedAccelerationCandidates();
  if (
    !selectedBattleUmaCard()
    || !parentSelectionConfirmedForPackage()
    || !accelerationSelectionComplete()
    || !state.battleOwnedCardsConfirmed
    || !battleOwnedCardValidation().valid
  ) {
    return { ready: false, candidates: [], scoreMode: 'skill-recovery-panel' };
  }
  const snapshot = activePlanningSnapshot({ ignoreBorrow: true });
  const ownedCards = state.battleDeckCardIds.slice(0, 5)
    .map(id => supportCatalogById.get(Number(id)))
    .filter(Boolean);
  const requiresSpeedBorrow = !ownedCards.some(card =>
    normalizeSupportType(card.supportType) === 'Speed'
  );
  const staminaModel = activeStaminaModel();
  const standardStaminaTier = (staminaModel?.tiers || [])
    .find(tier => tier.id === 'standard')
    || (staminaModel?.tiers || [])[0];
  const battleUma = selectedBattleUmaCard();
  const preCoveredRecoverySkillIds = battleUmaCertainSkillIds();
  return guidedPlannerCore.recommendBorrowedSupports({
    selectedOwnedCardIds: state.battleDeckCardIds.slice(0, 5),
    targets: selected.filter(candidate => candidate.sourceKind !== 'parent-unique').map(candidate => {
      const need = snapshot?.rows?.find(row =>
        Number(row.familyId) === Number(candidate.familyId)
      );
      return {
        id: candidate.id,
        familyIds: candidate.familyIds,
        name: candidate.factorName || candidate.name,
        weight: Math.max(100, Math.round(Number(need?.residualWeight || candidate.routeBashin || 0.1) * 2000))
      };
    }),
    targetTypes: expectedBattleDeckTypes(),
    targetCharacterId: selectedBattleUmaCard()?.characterId,
    requiredBorrowType: requiresSpeedBorrow ? 'Speed' : null,
    targetsAreResidual: true,
    recoveryPlan: {
      requiredGold: Number(standardStaminaTier?.goldRecovery)
        || (Number(activeRaceStrategy()?.context?.distance_type) === 4 ? 1 : 0),
      quality: staminaModel?.recoveryQuality || [],
      preCoveredSkillIds: preCoveredRecoverySkillIds,
      context: {
        ...(activeRaceStrategy()?.context || {}),
        running_style: 1
      }
    },
    supportProfiles: supportCardProfiles,
    catalog: gameCatalog,
    limit: 3
  });
}

function renderBattleBorrowRecommendation(recommendation) {
  const container = byId('guidedBorrowRecommendation');
  const status = byId('guidedBorrowStatus');
  const theoreticalBorrowNote = '理論借卡候選・需在好友/刷新清單出現，實際Lv/凸以提供者為準；模型仍以滿突 Lv50 benchmark 計算。';
  if (!container || !status) return;
  const selectedPackage = currentDeckPackage(peekActiveDeckOptimization());
  const selectedBorrowed = selectedPackage?.borrowedCard
    || supportCatalogById.get(Number(state.battleDeckCardIds[5]));
  // A manual borrow is a user choice even before the six-card confirmation.
  // Do not replace it with the recommendation engine's first candidate while
  // re-rendering the editor; validation will still decide whether it is legal.
  if (selectedBorrowed && Number.isFinite(Number(state.battleDeckCardIds[5]))) {
    const borrowed = selectedBorrowed;
    const labels = localizedSupportLabels(borrowed);
    state.battleDeckCardIds[5] = Number(borrowed.id);
    state.battleDeckBorrowedIndex = 5;
    status.textContent = '完整六卡方案已確認';
    container.innerHTML = `<article class="borrow-recommendation-primary">
      <div class="borrow-card-presentation">
        ${supportCardImageMarkup(borrowed, { borrowed: true, level: borrowed.level || 50, eager: true })}
        <div><span>方案借卡：滿突滿等</span><strong>${escapeHtml(labels.name)} ${escapeHtml(labels.title || '')}</strong>
        <p>${escapeHtml(selectedPackage?.reason || '此借卡與五張自有卡共同完成整副方案。')}</p>
        <small class="borrow-availability-note">${escapeHtml(theoreticalBorrowNote)}</small></div>
      </div>
    </article>`;
    return;
  }
  const top = recommendation?.candidates?.[0];
  if (!recommendation?.ready || !top) {
    if (!state.deckPackageId) state.battleDeckCardIds[5] = null;
    state.battleDeckBorrowedIndex = 5;
    const ownedReady = battleOwnedCardValidation().valid;
    container.innerHTML = `<p class="guided-empty">${ownedReady
      ? '完成手動調整後確認完整六卡，系統才會更新方案摘要。'
      : '請在進階手動微調中選滿五張有效自有卡。'}</p>`;
    status.textContent = ownedReady ? '等待手動調整確認' : '手動卡槽未完成';
    return;
  }
  state.battleDeckCardIds[5] = Number(top.id);
  state.battleDeckBorrowedIndex = 5;
  status.textContent = '已產生推薦';
  const labels = localizedSupportLabels(top);
  const topType = normalizeSupportType(top.supportType);
  const reasonText = text => String(text || '')
    .replace(/Speed/g, supportTypeLabels.Speed)
    .replace(/Stamina/g, supportTypeLabels.Stamina)
    .replace(/Power/g, supportTypeLabels.Power)
    .replace(/Guts/g, supportTypeLabels.Guts)
    .replace(/Wisdom/g, supportTypeLabels.Wisdom)
    .replace(/Friend/g, supportTypeLabels.Friend)
    .replace(/Group/g, supportTypeLabels.Group);
  const alternatives = recommendation.candidates.slice(1);
  const scoreBreakdown = card => `
    <span>技能缺口 ${Number(card.skillScore || 0).toLocaleString('zh-TW')}</span>
    <span>足耐／金回 ${Number(card.recoveryScore || 0).toLocaleString('zh-TW')}</span>
    <span>育成面板 ${Number(card.panelScore || 0).toLocaleString('zh-TW')}</span>
  `;
  container.innerHTML = `
    <article class="borrow-recommendation-primary" style="--card:${supportTypeColors[top.supportType] || '#716b82'}">
      <div class="borrow-card-presentation">
        ${supportCardImageMarkup(top, { borrowed: true, level: top.level })}
        <div><span>推薦借卡・滿突 Lv${top.level || 50}</span>
        <strong>${supportTypeLabels[topType] || topType}｜${labels.name} ${labels.title}</strong>
        <p>${escapeHtml(reasonText(top.reason))}</p>
        <small class="borrow-availability-note">${escapeHtml(theoreticalBorrowNote)}</small>
        <div class="borrow-score-breakdown" aria-label="借卡分數拆解">${scoreBreakdown(top)}</div></div>
      </div>
    </article>
    ${alternatives.length ? `<div class="borrow-alternatives"><span>次選</span>${alternatives.map(card => {
      const itemLabels = localizedSupportLabels(card);
      const cardType = normalizeSupportType(card.supportType);
      return `<article><div class="borrow-alternative-presentation">${supportCardImageMarkup(card, { borrowed: true, level: card.level })}<div><strong>${itemLabels.name}</strong><small>${supportTypeLabels[cardType] || cardType}｜${escapeHtml(reasonText(card.reason))}</small><div class="borrow-score-breakdown is-compact">${scoreBreakdown(card)}</div></div></div></article>`;
    }).join('')}</div>` : ''}`;
}

function renderBattleDeckEditor() {
  const containers = [byId('guidedBattleOwnedSlots'), byId('battleDeckSlots')].filter(Boolean);
  if (!containers.length) return;
  const slotHtml = state.battleDeckCardIds.slice(0, 5).map((id, index) => {
    const card = supportCatalogById.get(Number(id));
    const type = supportTypeLabels[normalizeSupportType(card?.supportType)] || '未指定';
    const labels = localizedSupportLabels(card);
    const rarity = card?.rarity || '未指定';
    const ownership = supportCardOwnershipDetail(card);
    const scenarioRequired = scenarioRequiredSupportIds().includes(Number(card?.id));
    return `
      <article class="battle-deck-slot" data-battle-owned-card-tile="${index}" data-support-card-id="${Number(card?.id) || ''}">
        <header>
          <strong>${index + 1}</strong>
          <span>${scenarioRequired ? '劇本必帶' : '自配卡位'}</span>
        </header>
        <div class="support-card-tile">
        ${supportCardImageMarkup(card, { eager: true })}
          <div class="support-card-tile-copy">
            <strong>${escapeHtml(labels.name || '尚未選卡')}</strong>
            <span>${escapeHtml(labels.title || '從下方選擇')}</span>
            <small>${escapeHtml(type)}・${escapeHtml(rarity)}・${escapeHtml(ownership)}</small>
          </div>
        </div>
        <button type="button" class="support-card-picker-trigger" data-support-picker-role="owned" data-support-picker-slot="${index}">用圖像更換</button>
        <select class="support-card-native-select" data-battle-owned-slot="${index}" aria-label="戰馬自有配卡第 ${index + 1} 張">
          ${ownedSupportSelectOptions(id)}
        </select>
      </article>`;
  }).join('');
  containers.forEach(container => { container.innerHTML = slotHtml; });

  const manualBorrowSelect = byId('guidedManualBorrowSelect');
  if (manualBorrowSelect) {
    manualBorrowSelect.innerHTML = manualBorrowSupportSelectOptions(state.battleDeckCardIds[5]);
    manualBorrowSelect.value = state.battleDeckCardIds[5] || '';
    const manualBorrowPreview = byId('guidedManualBorrowPreview');
    const borrowedCard = supportCatalogById.get(Number(state.battleDeckCardIds[5]));
    if (manualBorrowPreview) {
      if (borrowedCard) {
        const labels = localizedSupportLabels(borrowedCard);
        const type = supportTypeLabels[normalizeSupportType(borrowedCard.supportType)]
          || normalizeSupportType(borrowedCard.supportType)
          || '未指定';
        manualBorrowPreview.innerHTML = `${supportCardImageMarkup(borrowedCard, { borrowed: true, level: 50, eager: true })}
          <div class="support-card-tile-copy"><strong>${escapeHtml(labels.name || String(borrowedCard.id))}</strong><span>${escapeHtml(labels.title || '')}</span><small>${escapeHtml(type)}・滿突 Lv50 模型</small></div>`;
      } else {
        manualBorrowPreview.innerHTML = '<span class="guided-deck-slot-plus" aria-hidden="true">＋</span><div class="support-card-tile-copy"><strong>尚未選借卡</strong><span>從下方清單選擇</span><small>第 6 格固定為借卡</small></div>';
      }
    }
    const manualBorrowPickerButton = byId('guidedManualBorrowPickerButton');
    if (manualBorrowPickerButton) {
      manualBorrowPickerButton.onclick = () => openSupportCardPicker('borrowed', 5);
    }
    manualBorrowSelect.onchange = () => {
      const borrowedId = Number(manualBorrowSelect.value);
      applyBattleBorrowedCardSelection(borrowedId);
    };
  }

  document.querySelectorAll('[data-support-picker-role="owned"]').forEach(button => {
    button.onclick = () => openSupportCardPicker('owned', Number(button.dataset.supportPickerSlot));
  });
  document.querySelectorAll('[data-battle-owned-slot]').forEach(select => {
    select.onchange = () => {
      const index = Number(select.dataset.battleOwnedSlot);
      applyBattleOwnedCardSelection(index, Number(select.value));
    };
  });

  const validation = battleDeckValidation();
  const confirmButton = byId('guidedConfirmOwnedCards');
  if (confirmButton) {
    confirmButton.disabled = !validation.valid
      || state.battleOwnedCardsConfirmed;
    confirmButton.textContent = state.battleOwnedCardsConfirmed
      ? '已確認我的自配六卡'
      : '確認我的自配六卡';
    confirmButton.onclick = () => {
      if (!battleDeckValidation().valid) return;
      state.deckPackageId = 'custom';
      state.deckPackageModelVersion = Number(activeDeckOptimization()?.modelVersion) || 1;
      state.parentSelectionPackageId = null;
      state.battleOwnedCardsConfirmed = true;
      syncRecommendedParents(false);
      renderGuidedAccelerationFlow();
      renderBattleDeckEditor();
      renderGuidedParentStage();
      renderBattleCoverageSummary();
      renderCurrentRaceProfile();
      renderSkillPlan();
      renderGuidedProgress();
      scheduleSave();
    };
  }

  const recommendation = peekActiveDeckOptimization()
    ? battleBorrowRecommendation()
    : { ready: false, candidates: [], scoreMode: 'skill-recovery-panel' };
  renderBattleBorrowRecommendation(recommendation);
  renderGuidedLoadoutWeights();
  const guidedValidation = byId('guidedBattleDeckValidation');
  if (guidedValidation) {
    guidedValidation.dataset.state = !validation.valid
      ? 'invalid'
      : state.battleOwnedCardsConfirmed
        ? 'valid'
        : 'pending';
    guidedValidation.innerHTML = !validation.valid
      ? `<strong>需要修正</strong><span>${validation.problems.join('；')}</span>`
      : state.battleOwnedCardsConfirmed
        ? '<strong>你的完整 5＋1 已確認</strong><span>父輩與剩餘因子會依這副卡重算。</span>'
        : '<strong>六卡已填滿</strong><span>可以直接確認；下方只比較這副卡與推薦方案的具體差異。</span>';
  }
  [byId('battleDeckValidation')].filter(Boolean).forEach(output => {
    output.dataset.state = validation.valid ? 'valid' : 'invalid';
    output.innerHTML = validation.valid
      ? '<strong>完整六卡可用</strong><span>五張自有卡＋一張借卡。</span>'
      : `<strong>需要修正</strong><span>${validation.problems.join('；')}</span>`;
  });
  renderGuidedProgress(recommendation);
  renderParentSubviewStatus();
}

function renderBattleScenarioRequirement() {
  const output = byId('guidedScenarioRequirement');
  if (!output) return;
  const scenario = activeBattleScenario();
  const requiredIds = scenarioRequiredSupportIds(scenario);
  if (!scenario) {
    output.innerHTML = '<strong>未選定育成劇本</strong><span>請先選擇可用的繁中服劇本。</span>';
    output.dataset.state = 'warning';
    return;
  }
  if (!requiredIds.length) {
    output.innerHTML = `<strong>${escapeHtml(scenario.nameZhTw || scenario.id)}：沒有指定入場卡</strong><span>目前六卡保留距離模板的彈性位；不會把任意 Group／Friend 當成劇本必帶。</span>`;
    output.dataset.state = 'ready';
    return;
  }
  const cards = requiredIds.map(id => supportCatalogById.get(Number(id))).filter(Boolean);
  const cardText = requiredIds.map(id => {
    const card = supportCatalogById.get(Number(id));
    if (!card) return `卡片 ${id}（資料缺失）`;
    const labels = localizedSupportLabels(card);
    const type = supportTypeLabels[normalizeSupportType(card.supportType)] || normalizeSupportType(card.supportType);
    const owned = inventorySupportById.get(Number(id));
    const ownership = owned
      ? `自有 ${supportCardOwnershipDetail(card)}`
      : '未持有・唯一借卡滿突 Lv50／4突';
    return `${labels.name}${labels.title ? ` ${labels.title}` : ''}（ID ${id}、${type}、${supportCardSourceLabel(card)}、${ownership}）`;
  }).join('／');
  const ownedRequired = requiredIds.some(id => inventorySupportById.has(Number(id)));
  output.innerHTML = `<strong>${escapeHtml(scenario.nameZhTw || scenario.id)}：劇本必帶卡</strong><span>${escapeHtml(cardText)}</span><small>規則：${ownedRequired ? '自有時固定占五張自有卡之一；' : '未持有時固定占唯一借卡位；'}同型支援卡不可替代。切換劇本會清除卡組／父輩／技能確認。</small>`;
  output.dataset.state = cards.length === requiredIds.length ? 'required' : 'warning';
}

function clearInvalidBattleDeckState() {
  state.deckPackageId = null;
  state.deckPackageModelVersion = 0;
  state.parentSelectionPackageId = null;
  state.battleOwnedCardsConfirmed = false;
  state.main = null;
  state.sub = null;
  state.selectedAccelerationSkillIds = [];
  state.residualFactorDecisionConfirmed = false;
  state.familyTargetAffinityKey = '';
  state.familyParentBreederIds = [null, null];
  state.checklist = {};
}

function hydrateBattleDeckState() {
  const validation = battleDeckValidation();
  if (validation.valid) {
    if (
      state.battleOwnedCardsConfirmed
      && state.deckPackageId
      && !peekActiveDeckOptimization()
      && !['legacy', 'custom'].includes(String(state.deckPackageId))
    ) {
      const savedPackageId = String(state.deckPackageId);
      state.deckPackageId = 'legacy';
      if (String(state.parentSelectionPackageId || '') === savedPackageId) {
        state.parentSelectionPackageId = 'legacy';
      }
      scheduleSave();
      return { validation, repaired: false, migrated: true };
    }
    return { validation, repaired: false, migrated: false };
  }

  // Saved package state is reusable only when it passes the current scenario
  // exact-card gate as well as the ordinary six-card rules.
  clearInvalidBattleDeckState();
  if (shouldDeferTypesOnlyDeckToOptimizer()) {
    state.battleDeckCardIds = Array.from({ length: 6 }, () => null);
    state.battleDeckBorrowedIndex = 5;
  } else {
    normalizeBattleDeckForGuidedFlow();
  }
  scheduleSave();
  return {
    validation: battleDeckValidation(),
    repaired: true
  };
}

function seedBattleDeckFromScenarioPackage() {
  const optimized = activeDeckOptimization()?.packages?.[0];
  if (!optimized) return false;
  const ids = packageDeckIds(optimized);
  if (ids.length !== 6 || ids.some(id => !Number.isFinite(id))) return false;
  state.battleDeckCardIds = ids;
  state.battleDeckBorrowedIndex = 5;
  return true;
}

function changeBattleScenario(scenarioId) {
  const next = battleScenarioProfiles.find(profile => profile.id === scenarioId)
    || battleScenarioProfiles.find(profile => profile.id === defaultBattleScenarioId);
  if (!next || next.id === state.scenarioId) {
    renderBattleScenarioRequirement();
    return;
  }
  state.scenarioId = next.id;
  cachedRaceStrategyKey = '';
  cachedDeckOptimizationKey = '';
  cachedDeckOptimization = null;
  state.deckPackageId = null;
  state.deckPackageModelVersion = 0;
  state.parentSelectionPackageId = null;
  state.battleOwnedCardsConfirmed = false;
  state.selectedAccelerationSkillIds = [];
  state.residualFactorDecisionConfirmed = false;
  state.main = null;
  state.sub = null;
  state.battleDeckCardIds = Array.from({ length: 6 }, () => null);
  state.battleDeckBorrowedIndex = 5;
  if (!shouldKeepTypesOnlyBattleDeckEmpty()) {
    normalizeBattleDeckForGuidedFlow();
  }
  const selector = byId('battleScenario');
  if (selector) selector.value = state.scenarioId;
  renderBattleScenarioRequirement();
  renderGuidedParentStage();
  renderGuidedAccelerationFlow({ deckPending: true });
  renderGuidedDeckPending();
  renderBattleDeckEditor();
  renderBattleCoverageSummary();
  renderCurrentRaceProfile();
  renderSkillPlan();
  renderParents();
  renderReverseLineagePlan();
  if (state.activePanel === 'deck') renderDeck();
  const status = byId('guidedDeckPackageStatus');
  if (status) {
    status.textContent = `${next.nameZhTw || next.id} 已選定；六卡方案與下游確認已清除，請重新套用。`;
    status.focus?.();
  }
  scheduleSave();
}

function resetBattleDeckToRecommended() {
  const optimized = activeDeckOptimization()?.packages?.[0];
  if (optimized) {
    applyDeckPackage(optimized);
    return;
  }
  state.battleDeckCardIds = [...recommendedBattleDeckIds].slice(0, 6);
  state.battleDeckBorrowedIndex = recommendedBattleDeckBorrowedIndex;
  state.battleOwnedCardsConfirmed = false;
  state.deckPackageId = null;
  state.deckPackageModelVersion = 0;
  state.parentSelectionPackageId = null;
  if (!shouldKeepTypesOnlyBattleDeckEmpty()) normalizeBattleDeckForGuidedFlow();
  renderBattleDeckEditor();
  renderBattleCoverageSummary();
  renderCurrentRaceProfile();
  renderSkillPlan();
  scheduleSave();
}

function initStrategyControls() {
  const battleUma = byId('battleUma');
  const guidedBattleUma = byId('guidedBattleUma');
  const battleHorseChoiceList = byId('battleHorseChoiceList');
  const battleHorseRecommendationList = byId('battleHorseRecommendationList');
  const eventMode = byId('eventMode');
  const guidedEventMode = byId('guidedEventMode');
  const inheritanceMode = byId('inheritanceMode');
  const coverageToggle = byId('applyBattleDeckCoverage');
  const scenarioSelect = byId('battleScenario');
  const battleHorseAnalysisButton = byId('battleHorseAnalysisButton');
  if (!battleUma || !guidedBattleUma || !eventMode || !guidedEventMode || !inheritanceMode || !coverageToggle) return;

  applyRaceEventMode();
  const strategy = activeRaceStrategy();
  const distanceLabel = distanceLabels[Number(strategy?.context?.distance_type)] || '目前距離';
  const groundLabel = surfaceLabels[Number(strategy?.context?.ground_type)] || '目前場地';
  const battleOptions = ownedRunnerBattleCards();
  const validBattleIds = new Set(battleOptions.map(item => Number(item.card.id)));
  if (
    state.battleUmaOutfitId
    && !validBattleIds.has(Number(state.battleUmaOutfitId))
  ) {
    state.battleUmaOutfitId = null;
  }
  const optionRows = battleOptions.map(({ card, distanceAptitude, groundAptitude, styleAptitude, needsAptitudeWork }) => {
    const name = card.nameZhTw || localizedUmaName(card.name);
    const rawTitle = card.titleZhTw || card.title || '';
    const title = japaneseTextPattern.test(rawTitle) ? '' : rawTitle;
    return `<option value="${card.id}">${needsAptitudeWork ? '⚠ 需補適性｜' : ''}${escapeHtml(name)} ${escapeHtml(title)}`
      + `｜${distanceLabel} ${distanceAptitude}・${groundLabel} ${groundAptitude}・領頭 ${styleAptitude}</option>`;
  });
  battleUma.innerHTML = ['<option value="">未指定（一般領頭）</option>', ...optionRows].join('');
  guidedBattleUma.innerHTML = ['<option value="">請選擇持有戰馬</option>', ...optionRows].join('');
  [battleUma, guidedBattleUma].forEach(select => { select.value = state.battleUmaOutfitId || ''; });
  const modes = inheritanceModes();
  if (!modes.some(mode => mode.id === state.inheritanceMode)) {
    state.inheritanceMode = modes[0]?.id || 'balanced';
  }
  inheritanceMode.innerHTML = modes
    .map(mode => `<option value="${mode.id}">${mode.label}</option>`)
    .join('');
  inheritanceMode.value = state.inheritanceMode;
  [eventMode, guidedEventMode].forEach(select => { select.value = state.eventMode; });
  guidedEventMode.disabled = true;
  guidedEventMode.setAttribute('aria-disabled', 'true');
  coverageToggle.checked = state.applyBattleDeckCoverage;
  if (scenarioSelect) {
    scenarioSelect.innerHTML = battleScenarioProfiles
      .map(profile => `<option value="${escapeHtml(profile.id)}">${escapeHtml(profile.nameZhTw || profile.id)}</option>`)
      .join('');
    scenarioSelect.value = state.scenarioId || defaultBattleScenarioId || '';
    scenarioSelect.onchange = () => changeBattleScenario(scenarioSelect.value);
  }
  renderBattleScenarioRequirement();

  const renderBattleUmaPreview = () => {
    const preview = byId('guidedBattleUmaPreview');
    if (!preview) return;
    const card = selectedBattleUmaCard();
    if (!card) {
      preview.innerHTML = '<p>選定後會在這裡顯示實際衣裝；原版與換裝版不再只靠文字辨識。</p>';
      preview.dataset.state = 'empty';
      return;
    }
    const row = battleOptions.find(item => Number(item.card.id) === Number(card.id));
    preview.dataset.state = 'selected';
    preview.innerHTML = `${traineePortraitMarkup(card, 'battle-uma-portrait')}
      <div><span>目前戰馬衣裝</span><strong>${escapeHtml(card.nameZhTw || card.name)} ${escapeHtml(card.titleZhTw || card.title || '')}</strong>
      <small>衣裝編號 ${card.id}・${distanceLabel} ${row?.distanceAptitude || '?'}・${groundLabel} ${row?.groundAptitude || '?'}・領頭 ${row?.styleAptitude || '?'}</small></div>`;
  };

  const renderBattleHorseChoices = () => {
    if (!battleHorseChoiceList) return;
    if (!battleOptions.length) {
      battleHorseChoiceList.innerHTML = '<p class="guided-empty">自有戰馬清單目前是空的；請先確認本機持有資料。</p>';
      return;
    }
    const analysis = currentBattleHorseAnalysisState();
    const evaluation = activeBattleBuildEvaluation();
    const scoreOrder = byId('battleHorseScoreOrder');
    const scoreBoundary = byId('battleHorseScoreBoundary');
    if (scoreOrder) {
      const order = Array.isArray(evaluation?.layers) ? evaluation.layers : [];
      scoreOrder.innerHTML = order.length
        ? order.map((item, index) => {
          return `<li><b>${index + 1}</b><span><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.rule)}</small></span></li>`;
        }).join('')
        : '<li><span><strong>尚未執行戰馬分析</strong><small>按下分析後才載入評價層；不在開頁時自動計算。</small></span></li>';
    }
    if (scoreBoundary) {
      scoreBoundary.textContent = evaluation?.boundary
        || '所有可行候選的六卡、因子、繼承與技能值未齊前，不產生 finalRank。';
    }
    const ranking = analysis.status === 'ready' ? activeBattleHorseRanking() : null;
    const construction = ranking
      ? battleHorseConstructionRecommendations(battleOptions, ranking)
      : { status: 'NOT_ANALYZED', rows: [], note: '' };
    const analysisRoot = byId('battleHorseRecommendations');
    const recommendationStatus = byId('battleHorseRecommendationStatus');
    const progressWrap = byId('battleHorseAnalysisProgressWrap');
    const progress = byId('battleHorseAnalysisProgress');
    const progressLabel = byId('battleHorseAnalysisProgressLabel');
    if (analysisRoot) analysisRoot.dataset.analysisState = analysis.status;
    if (battleHorseAnalysisButton) {
      battleHorseAnalysisButton.disabled = analysis.status === 'running';
      battleHorseAnalysisButton.textContent = analysis.status === 'running'
        ? '分析中…'
        : analysis.status === 'ready'
          ? '重新分析推薦戰馬'
          : analysis.stale
            ? '條件已變更・重新分析'
            : '開始分析推薦戰馬';
    }
    if (progressWrap) progressWrap.hidden = analysis.status === 'idle';
    if (progress) progress.value = Math.max(0, Math.min(4, Number(analysis.completedSteps) || 0));
    if (progressLabel) {
      progressLabel.textContent = analysis.status === 'running'
        ? ['準備分析', '賽道與硬門已固定', '自有戰馬已整理', '本體排行已完成', '完整建構已完成'][analysis.completedSteps] || '分析中'
        : analysis.status === 'ready'
          ? `分析完成・已檢查 ${analysis.candidateCount} 匹自有戰馬`
          : analysis.status === 'error'
            ? '分析失敗；未使用不完整結果'
            : '等待開始';
    }
    if (recommendationStatus) {
      recommendationStatus.textContent = analysis.status === 'running'
        ? '分析中'
        : analysis.status === 'ready'
          ? construction.rows.length
            ? `${construction.rows.length} 匹施工候選`
            : '沒有通過證據門檻的候選'
          : analysis.status === 'error'
            ? '分析未完成'
            : analysis.stale
              ? '條件已變更'
              : '尚未分析';
      recommendationStatus.dataset.state = analysis.status === 'ready'
        ? construction.status
        : analysis.status.toUpperCase();
    }
    if (battleHorseRecommendationList) {
      battleHorseRecommendationList.innerHTML = analysis.status === 'running'
        ? '<p class="guided-empty">正在依目前賽道整理候選；你仍可直接從下方自有清單選馬。</p>'
        : analysis.status === 'error'
          ? '<p class="guided-empty">分析沒有完成，因此不顯示半成品推薦。你仍可直接手動選馬。</p>'
          : analysis.status !== 'ready'
            ? `<p class="guided-empty">${analysis.stale ? '賽道或卡組條件已變更，請重新分析。' : '尚未分析；此步不影響你手動選馬。'}</p>`
            : construction.rows.length
        ? construction.rows.map(({ entry, recommendationLabel, recommendationReason, recommendationGap }) => {
          const { card, distanceAptitude, groundAptitude, styleAptitude } = entry;
          const rawTitle = card.titleZhTw || card.title || '';
          const title = japaneseTextPattern.test(rawTitle) ? '' : rawTitle;
          const fullName = `${card.nameZhTw || localizedUmaName(card.name)}${title ? ` ${title}` : ''}`;
          const selected = Number(card.id) === Number(state.battleUmaOutfitId);
          return `<label class="battle-horse-recommendation-card${selected ? ' is-selected' : ''}" data-recommendation-kind="construction-priority">
            <input type="radio" name="guidedBattleHorseChoice" value="${card.id}"${selected ? ' checked' : ''}>
            ${traineePortraitMarkup(card, 'battle-horse-recommendation-portrait')}
            <span class="battle-horse-recommendation-copy"><b>${escapeHtml(recommendationLabel)}</b><strong>${escapeHtml(fullName)}</strong>
              <small>${distanceLabel} ${distanceAptitude}・${groundLabel} ${groundAptitude}・領頭 ${styleAptitude}</small>
              <span>${escapeHtml(recommendationReason)}</span>
              <em>${escapeHtml(recommendationGap)}</em></span>
            <span class="battle-horse-recommendation-action">${selected ? '已選擇' : '選這匹'}</span>
          </label>`;
        }).join('') + (construction.note ? `<p class="battle-horse-recommendation-note">${escapeHtml(construction.note)}</p>` : '')
        : `<p class="guided-empty">${escapeHtml(construction.note || '目前沒有通過證據門檻的施工候選；請直接從自有清單選擇。')}</p>`;
    }
    const displayRows = battleOptions.map(entry => ({ entry }));
    if (!displayRows.length) {
      battleHorseChoiceList.innerHTML = '<p class="guided-empty">自有戰馬清單目前是空的；請先確認本機持有資料。</p>';
    } else {
      battleHorseChoiceList.innerHTML = displayRows.map(({ entry }) => {
      const { card, distanceAptitude, groundAptitude, styleAptitude, needsAptitudeWork } = entry;
      const rawTitle = card.titleZhTw || card.title || '';
      const title = japaneseTextPattern.test(rawTitle) ? '' : rawTitle;
      const fullName = `${card.nameZhTw || localizedUmaName(card.name)}${title ? ` ${title}` : ''}`;
      const reason = needsAptitudeWork
        ? '需要先確認紅因子修復，再建立完整建構'
        : '原生適性可施工；仍要靠完整六卡、因子與繼承判斷';
      const selected = Number(card.id) === Number(state.battleUmaOutfitId);
      const gateLabel = needsAptitudeWork ? '需補適性・手動候選' : '適性可施工・手動候選';
      return `<label class="battle-horse-choice${selected ? ' is-selected' : ''}" data-evaluation-state="NEEDS_BUILD_CONTEXT">
        <input type="radio" name="guidedBattleHorseChoice" value="${card.id}"${selected ? ' checked' : ''}>
        <span class="battle-horse-choice-rank">${escapeHtml(gateLabel)}</span>
        ${traineePortraitMarkup(card, 'battle-horse-choice-portrait')}
        <span class="battle-horse-choice-copy"><strong>${escapeHtml(fullName)}</strong>
          <small>${distanceLabel} ${distanceAptitude}・${groundLabel} ${groundAptitude}・領頭 ${styleAptitude}</small>
          <span>${escapeHtml(reason)}</span></span>
        <b>${selected ? '已選擇' : '選這匹'}</b>
      </label>`;
      }).join('');
    }
    const note = byId('battleHorseManualNote');
    if (note) {
      note.textContent = `這裡保留全部 ${battleOptions.length} 隻自有戰馬；清單順序只按適性與名稱整理，不是強度名次。`;
    }
    renderBattleBuildEvaluation();
  };

  const yieldBattleHorseAnalysisPaint = () => new Promise(resolve => {
    requestAnimationFrame(() => setTimeout(resolve, 0));
  });

  if (battleHorseAnalysisButton) {
    battleHorseAnalysisButton.onclick = async () => {
      const inputKey = battleHorseRankingInputKey();
      const assertAnalysisInputIsCurrent = () => {
        if (battleHorseRankingInputKey() !== inputKey) {
          throw new Error('分析期間條件已變更；舊結果已捨棄');
        }
      };
      battleHorseBuildAnalysisKey = '';
      cachedBattleHorseRankingKey = '';
      cachedBattleHorseRankingResult = null;
      cachedBattleBuildEvaluationKey = '';
      cachedBattleBuildEvaluationResult = null;
      battleHorseAnalysisState = {
        status: 'running',
        inputKey,
        completedSteps: 0,
        candidateCount: 0,
        error: ''
      };
      renderBattleHorseChoices();
      try {
        await yieldBattleHorseAnalysisPaint();
        assertAnalysisInputIsCurrent();
        battleHorseAnalysisState.completedSteps = 1;
        renderBattleHorseChoices();

        await yieldBattleHorseAnalysisPaint();
        assertAnalysisInputIsCurrent();
        battleHorseAnalysisState.completedSteps = 2;
        battleHorseAnalysisState.candidateCount = battleOptions.length;
        renderBattleHorseChoices();

        await yieldBattleHorseAnalysisPaint();
        assertAnalysisInputIsCurrent();
        const ranking = activeBattleHorseRanking({ force: true });
        if (!ranking || ranking.status === 'BLOCKED') {
          throw new Error('戰馬排序核心沒有產生可用結果');
        }
        battleHorseAnalysisState.completedSteps = 3;
        renderBattleHorseChoices();

        await yieldBattleHorseAnalysisPaint();
        assertAnalysisInputIsCurrent();
        const evaluation = activeBattleBuildEvaluation({ force: true });
        if (!evaluation) throw new Error('完整建構評價沒有產生可用結果');
        assertAnalysisInputIsCurrent();
        battleHorseAnalysisState = {
          ...battleHorseAnalysisState,
          status: 'ready',
          completedSteps: 4,
          error: ''
        };
      } catch (error) {
        console.warn('Battle horse analysis did not complete.', error);
        battleHorseAnalysisState = {
          ...battleHorseAnalysisState,
          status: 'error',
          error: String(error?.message || error || 'UNKNOWN')
        };
      }
      renderBattleHorseChoices();
      renderGoalContractChain();
    };
  }

  const onBattleUmaChange = value => {
    guidedDeckRenderToken += 1;
    state.battleUmaOutfitId = value ? Number(value) : null;
    state.main = null;
    state.sub = null;
    state.deckPackageId = null;
    state.deckPackageModelVersion = 0;
    state.battleOwnedCardsConfirmed = false;
    state.battleDeckCardIds[5] = null;
    state.battleDeckBorrowedIndex = 5;
    state.parentSelectionPackageId = null;
    resetGuidedDownstreamAfterParentChange();
    const targetCharacterId = Number(selectedBattleUmaCard()?.characterId);
    state.battleDeckCardIds = state.battleDeckCardIds.map((id, index) => {
      if (index === 5) return null;
      const card = supportCatalogById.get(Number(id));
      return card && Number(card.characterId) === targetCharacterId ? null : id;
    });
    [battleUma, guidedBattleUma].forEach(select => { select.value = state.battleUmaOutfitId || ''; });
    renderBattleUmaPreview();
    renderBattleHorseChoices();
    renderBattleScenarioRequirement();
    renderGuidedDeckPending();
    renderGuidedProgress();
    scheduleSave();
    const selectedId = Number(state.battleUmaOutfitId);
    requestAnimationFrame(() => setTimeout(() => {
      if (Number(state.battleUmaOutfitId) !== selectedId) return;
      renderGuidedAccelerationFlow({ deckPending: true });
      renderBattleCoverageSummary();
      renderCurrentRaceProfile();
      renderSkillPlan();
      if (peekActiveDeckOptimization()) renderParents();
      const target = selectedBattleUmaCard();
      if (target && affinity) {
        const affinityName = gameCatalog?.characters?.find(character =>
          Number(character.id) === Number(target.characterId))?.jp_name;
        if (affinityName && affinity.names.includes(affinityName)) {
          byId('targetUma').value = affinityName;
          updateAffinity();
          state.familyTargetAffinityKey = affinityName;
          renderFamilyPlanner();
        }
      }
      if (state.activePanel === 'deck') renderDeck();
    }, 0));
  };
  battleUma.onchange = () => onBattleUmaChange(battleUma.value);
  guidedBattleUma.onchange = () => onBattleUmaChange(guidedBattleUma.value);
  [battleHorseChoiceList, battleHorseRecommendationList].filter(Boolean).forEach(container => {
    container.onchange = event => {
      const choice = event.target.closest('input[name="guidedBattleHorseChoice"]');
      if (choice) onBattleUmaChange(choice.value);
    };
  });
  const onEventModeChange = value => {
    state.eventMode = value;
    [eventMode, guidedEventMode].forEach(select => { select.value = value; });
    renderSkillPlan();
    renderParents();
    if (state.activePanel === 'deck') renderDeck();
    scheduleSave();
  };
  eventMode.onchange = () => onEventModeChange(eventMode.value);
  guidedEventMode.onchange = () => onEventModeChange(guidedEventMode.value);
  inheritanceMode.onchange = () => {
    state.inheritanceMode = inheritanceMode.value;
    syncRecommendedParents(true);
    renderSkillPlan();
    renderParents();
    scheduleSave();
  };
  coverageToggle.onchange = () => {
    state.applyBattleDeckCoverage = coverageToggle.checked;
    renderSkillPlan();
    scheduleSave();
  };
  hydrateBattleDeckState();
  syncSelectedAccelerations();
  renderBattleUmaPreview();
  renderBattleHorseChoices();
  renderBattleScenarioRequirement();
  if (selectedBattleUmaCard()) {
    renderGuidedAccelerationFlow({ deckPending: true });
    renderGuidedDeckPending();
  }
  else renderGuidedAccelerationFlow();
  renderBattleCoverageSummary();
}

function activeFactorExecutionTemplate() {
  return factorExecutionTemplateById(state.factorExecution?.templateId);
}

function activeFactorTargetProfile() {
  const template = activeFactorExecutionTemplate();
  return {
    ...template,
    axes: Object.fromEntries(factorStatAxes.map(axis => [
      axis,
      {
        ...(template?.axes?.[axis] || {}),
        ...(state.factorExecution?.targets?.[axis] || {})
      }
    ]))
  };
}

function expectedFactorStats() {
  return {
    speed: finiteOrNull(byId('expectedSpeed')?.value),
    stamina: finiteOrNull(byId('expectedStamina')?.value),
    power: finiteOrNull(byId('expectedPower')?.value),
    guts: finiteOrNull(byId('expectedGuts')?.value),
    wisdom: finiteOrNull(byId('expectedWisdom')?.value)
  };
}

function selectedGoalRaceSchedule() {
  const card = selectedBattleUmaCard();
  if (!card || typeof factorExecutionCore?.scheduleForCharacter !== 'function') return null;
  return factorExecutionCore.scheduleForCharacter(goalRaceSchedules, card.characterId);
}

function factorExecutionAssessment() {
  if (!factorExecutionCore?.evaluateExecutionPlan) return null;
  const schedule = selectedGoalRaceSchedule();
  return {
    schedule,
    assessment: factorExecutionCore.evaluateExecutionPlan({
      targetProfile: activeFactorTargetProfile(),
      expectedStats: expectedFactorStats(),
      riskProfile: state.factorExecution?.riskProfileId,
      riskProfiles: factorExecutionRiskProfiles,
      races: schedule?.goals || [],
      raceDensityPolicy: factorExecutionProfile.raceDensityPolicy || {}
    })
  };
}

function factorAxisLabel(axis) {
  return {
    speed: '速度',
    stamina: '耐力',
    power: '力量',
    guts: '根性',
    wisdom: '智力'
  }[axis] || axis;
}

function factorInputValue(value) {
  return Number.isFinite(Number(value)) ? String(Number(value)) : '';
}

function factorGuideTableMarkup(columns = [], rows = [], caption = '') {
  return `${caption ? `<caption>${escapeHtml(caption)}</caption>` : ''}
    <thead><tr>${columns.map(column => `<th scope="col">${escapeHtml(column)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(row => `<tr>${row.map((cell, index) =>
      index === 0
        ? `<th scope="row">${escapeHtml(cell)}</th>`
        : `<td>${escapeHtml(cell)}</td>`
    ).join('')}</tr>`).join('')}</tbody>`;
}

function factorGuideModifierText(kind, rank, aptitudeReference) {
  const rankIndex = (aptitudeReference?.ranks || []).indexOf(rank);
  if (rankIndex < 0) return '未知';
  const values = kind === 'surface'
    ? aptitudeReference.surfaceAccelerationPercent
    : aptitudeReference.distanceSpeedPercent;
  const value = Number(values?.[rankIndex]);
  if (!Number.isFinite(value)) return '未知';
  return `${value > 0 ? '+' : ''}${value}%`;
}

function factorGuideUniqueG1Rows(guide) {
  const surfaceRows = [
    { label: '草地', groundType: 1 },
    { label: '泥地', groundType: 2 }
  ].filter(row => guide?.goalContract?.surfaces?.includes(row.label));
  const distanceRows = [
    { label: '一哩', distanceType: 2 },
    { label: '中距離', distanceType: 3 },
    { label: '長距離', distanceType: 4 }
  ].filter(row => guide?.goalContract?.distances?.includes(row.label));
  const races = (gameCatalog?.races || []).filter(race => Number(race.grade) === 100);
  return surfaceRows.flatMap(surface => distanceRows.map(distance => {
    const names = [...new Set(races
      .filter(race => Number(race.groundType) === surface.groundType
        && Number(race.distanceType) === distance.distanceType)
      .map(race => race.nameZhTw || race.nameJp || race.nameEn)
      .filter(Boolean))];
    const preview = names.length
      ? `${names.slice(0, 4).join('、')}${names.length > 4 ? `＋${names.length - 4}` : ''}`
      : '本地目錄無此類 G1';
    return [
      surface.label,
      distance.label,
      String(names.length),
      preview,
      names.length ? '候選池／需再排程' : '無候選'
    ];
  }));
}

function cmOaksWhiteFactorValue(value) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') {
    return '待補快照';
  }
  if (typeof value === 'string' && !value.trim()) return '待補快照';
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(3) : '待補快照';
}

function cmOaksWhiteFactorBodyStatus(row) {
  return {
    REQUIRED: '固定必追',
    NOT_REQUIRED: '本體已有',
    OPTIONAL: '可追'
  }[row?.bodyGoal?.status] || '待確認';
}

function renderCmOaksWhiteFactorDecision() {
  const root = byId('cmOaksWhiteFactorDecision');
  const brief = byId('cmOaksWhiteFactorBrief');
  const list = byId('cmOaksWhiteFactorList');
  if (!root || !brief || !list) return;
  const routeButtons = [...root.querySelectorAll('[data-cm-oaks-factor-route]')];
  routeButtons.forEach(button => {
    const selected = button.dataset.cmOaksFactorRoute === cmOaksWhiteFactorRouteId;
    button.setAttribute('aria-pressed', String(selected));
    button.onclick = () => {
      cmOaksWhiteFactorRouteId = button.dataset.cmOaksFactorRoute;
      renderCmOaksWhiteFactorDecision();
    };
  });

  if (typeof cmOaksWhiteFactorAdapter?.evaluateRoute !== 'function') {
    root.dataset.status = 'UNAVAILABLE';
    brief.innerHTML = '<p>白因子比較核心尚未載入。</p>';
    list.innerHTML = '';
    return;
  }

  const result = cmOaksWhiteFactorAdapter.evaluateRoute({
    courseEffectSnapshots,
    gameCatalog
  }, cmOaksWhiteFactorRouteId);
  root.dataset.status = result.decisionStatus || result.status || 'UNVERIFIED';
  root.dataset.probabilityStatus = result.probabilityStatus || 'NOT_COMPUTED';
  const rows = Array.isArray(result.displayRows) ? result.displayRows : [];
  const required = rows.find(row => row.bodyGoal?.status === 'REQUIRED');
  const bodyRanking = Array.isArray(result.bodyRankings) ? result.bodyRankings : [];
  const firstRanked = bodyRanking[0];
  const firstRow = rows.find(row => Number(row.skillId) === Number(firstRanked?.skillId));
  brief.innerHTML = `
    <article data-kind="required">
      <span>${escapeHtml(cmOaksWhiteFactorBodyStatus(required))}</span>
      <strong>${escapeHtml(required?.nameZhTw || '青春點火．智慧')}</strong>
      <small>${required?.scoreStatus === 'UNKNOWN' ? '本地快照沒有數值；保留 UNKNOWN，不當成 0。' : `直接親代相對值 ${cmOaksWhiteFactorValue(required?.factorMarginal?.directParent?.value)}`}</small>
    </article>
    <article data-kind="ranked">
      <span>有數值的本體缺口首選</span>
      <strong>${escapeHtml(firstRow?.nameZhTw || '目前沒有可量化候選')}</strong>
      <small>${firstRow ? `直接親代 ${cmOaksWhiteFactorValue(firstRow.factorMarginal?.directParent?.value)}・祖輩 ${cmOaksWhiteFactorValue(firstRow.factorMarginal?.grandparent?.value)}` : '資料不足，先不排序。'}</small>
    </article>`;

  list.innerHTML = rows.map(row => {
    const direct = cmOaksWhiteFactorValue(row.factorMarginal?.directParent?.value);
    const grandparent = cmOaksWhiteFactorValue(row.factorMarginal?.grandparent?.value);
    const note = row.bodyGoal?.status === 'NOT_REQUIRED'
      ? '此用途本體已能取得；只保留子代白因子價值。'
      : row.scoreStatus === 'UNKNOWN'
        ? '缺少本地快照，維持 UNKNOWN。'
        : 'CM 第一名線的單技能相對值。';
    return `<article data-skill-id="${Number(row.skillId)}" data-score-status="${escapeHtml(row.scoreStatus)}">
      <div><span>${escapeHtml(cmOaksWhiteFactorBodyStatus(row))}</span><strong>${escapeHtml(row.nameZhTw)}</strong></div>
      <dl><div><dt>直接親代</dt><dd>${escapeHtml(direct)}</dd></div><div><dt>祖輩</dt><dd>${escapeHtml(grandparent)}</dd></div></dl>
      <small>${escapeHtml(note)}</small>
    </article>`;
  }).join('');
}

function cmOaksRentalExampleJson() {
  return JSON.stringify({
    schemaVersion: 'prettyderby-rental-candidates.v1',
    candidates: [
      {
        id: '140388262',
        nameZhTw: '聖誕成田路（格式範例）',
        bodyBlue: { guts: 2 },
        bodyRed: { medium: 3 },
        bodyUnique: { skillId: 110771, nameZhTw: 'Joy to the World', stars: 3 },
        effectiveWhiteCount: 15,
        effectiveWhiteCountStatus: 'USER_SUPPLIED_EXTERNAL_EVIDENCE',
        directlyUsefulBodyWhiteFamilies: ['領頭直線', '正面突破', '乘順風而行', '青春點火．智慧'],
        parents: [{ red: { mile: 3 } }, { red: { dirt: 3 } }],
        g1Count: 22,
        g1Status: 'USER_SUPPLIED_EXTERNAL_EVIDENCE'
      },
      {
        id: '119801938',
        nameZhTw: '新年好歌劇（格式範例）',
        bodyBlue: { stamina: 3 },
        bodyRed: { medium: 3 },
        bodyUnique: { skillId: 110151, nameZhTw: '惠福的船歌', stars: 3 },
        effectiveWhiteCount: null,
        effectiveWhiteCountStatus: 'NOT_SUPPLIED',
        userOrdinalWhiteComparison: '140388262 > 119801938',
        parents: [{ red: { mile: 2 } }, { red: { dirt: 3 } }],
        g1Count: 22,
        g1Status: 'USER_SUPPLIED_EXTERNAL_EVIDENCE'
      }
    ]
  }, null, 2);
}

function cmOaksRentalNumericText(value) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') {
    return '待補證據';
  }
  if (typeof value === 'string' && !value.trim()) return '待補證據';
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(3) : '待補證據';
}

function cmOaksRentalOrdinalText(value) {
  return ({
    HIGHER_OR_EQUAL: '較高／同級',
    HIGHER: '較高',
    HIGHER_SOFT: '軟性較高',
    HIGHER_SMALL_MARGIN: '小幅較高',
    EQUAL: '同級',
    BASELINE: '基準',
    LOWER_SMALL_MARGIN: '小幅較低',
    LOWER_SOFT: '軟性較低',
    LOWER: '較低',
    CONDITIONAL_WITH_PLANNED_RECOVERY: '有回復條件',
    CONDITIONAL_UNMET: '條件不成立',
    CONDITIONAL_UNKNOWN: '條件待補',
    UNMAPPED_OR_UNVERIFIED: '效果待驗證',
    UNVERIFIED: '待驗證',
    UNKNOWN: '待補'
  })[String(value || '').toUpperCase()] || '待補';
}

function cmOaksRentalComponent(row, componentId) {
  return (Array.isArray(row?.componentBreakdown) ? row.componentBreakdown : [])
    .find(component => component.componentId === componentId) || null;
}

function cmOaksRentalGapText(value) {
  return ({
    effective_body_white_count: '有效白因子數',
    directly_useful_body_white_families: '有效白因子清單',
    body_blue: '藍因子',
    parents_construction_reds: '父母施工紅因子',
    shared_g1_count: '共同 G1 數',
    body_unique: '本體固有',
    'body unique local course-effect row unavailable': '固有的本地賽道效果',
    'Joy activation rate not supplied and not inferred': 'Joy 發動率（不推算）',
    'deck_has_early_or_middle_recovery is required': '前／中盤回復條件'
  })[String(value)] || String(value || '未知欄位').replaceAll('_', ' ');
}

function cmOaksRentalErrorText(result) {
  const error = Array.isArray(result?.errors) ? result.errors[0] : null;
  const label = ({
    JSON_TEXT_REQUIRED: '請貼入 JSON 文字。',
    JSON_PARSE_ERROR: 'JSON 格式無法解析。',
    ROOT_MUST_BE_OBJECT: '最外層必須是 JSON 物件。',
    SCHEMA_VERSION_UNSUPPORTED: 'schemaVersion 必須是 prettyderby-rental-candidates.v1。',
    CANDIDATES_MUST_BE_ARRAY: 'candidates 必須是陣列。',
    CANDIDATES_MUST_NOT_BE_EMPTY: '至少需要一筆候選。',
    CANDIDATE_MUST_BE_OBJECT: '每筆候選都必須是物件。',
    CANDIDATE_ID_REQUIRED: '每筆候選都需要明確且非空的 ID。',
    DUPLICATE_CANDIDATE_ID: '候選 ID 不可重複。',
    FORBIDDEN_PROBABILITY_FIELD: '資料含有勝率、發動率、繼承率或其他禁用機率欄位。',
    INVALID_LINEAGE_STAGE: '譜系位置無效。',
    RECOVERY_MUST_BE_BOOLEAN: '回復條件必須是明確的有／無。',
    SCORER_ERROR: '評分核心執行失敗。',
    SCORER_INVALID_RESULT: '評分核心沒有回傳有效結果。'
  })[error?.code] || (result?.status === 'UNAVAILABLE' ? '租借馬評分核心尚未載入。' : '候選資料未通過檢查。');
  return error?.path ? `${label}（${error.path}）` : label;
}

function renderCmOaksRentalResult(result = cmOaksRentalImportResult) {
  const root = byId('cmOaksRentalTool');
  const output = byId('cmOaksRentalResult');
  if (!root || !output) return;
  if (!result) {
    root.dataset.status = 'WAITING_FOR_INPUT';
    root.dataset.probabilityStatus = 'NOT_COMPUTED';
    output.innerHTML = '<p>尚未匯入候選。只有按下「比較候選」後才會解析。</p>';
    return;
  }
  const status = String(result.status || 'BLOCKED').toUpperCase();
  root.dataset.status = status;
  root.dataset.probabilityStatus = result.probabilityStatus || 'NOT_COMPUTED';
  if (['BLOCKED', 'UNAVAILABLE', 'ERROR'].includes(status)) {
    output.innerHTML = `<p data-result-status="BLOCKED">${escapeHtml(cmOaksRentalErrorText(result))}</p>`;
    return;
  }

  const rankings = Array.isArray(result.rankings) ? result.rankings : [];
  const ready = status === 'READY';
  const gaps = Array.isArray(result.dataGaps) ? [...new Set(result.dataGaps)] : [];
  const heading = ready
    ? `已比較 ${rankings.length} 筆；只按確定性代理分數排序。`
    : `已讀入 ${rankings.length} 筆，但缺 ${gaps.length || '部分'} 項證據，暫不排序。`;
  output.innerHTML = `<header><strong>${ready ? '排序完成' : '需要補資料'}</strong> ${escapeHtml(heading)}</header>${rankings.map(row => {
    const white = cmOaksRentalComponent(row, 'white_factor_utility');
    const blue = cmOaksRentalComponent(row, 'blue_marginal');
    const unique = cmOaksRentalComponent(row, 'body_unique_grandparent');
    const completeness = cmOaksRentalComponent(row, 'data_completeness');
    const confidence = completeness?.confidenceValue;
    const completenessText = Number.isFinite(Number(confidence))
      ? `${Math.round(Number(confidence) * 100)}%`
      : '待補';
    return `<article data-ranking-status="${escapeHtml(row.rankingStatus || status)}">
      <b>${ready && Number.isFinite(Number(row.rank)) ? `#${Number(row.rank)}` : '未排序'}</b>
      <div><strong>${escapeHtml(row.candidateName || row.candidateId || '未命名候選')}</strong><small>白 ${escapeHtml(cmOaksRentalOrdinalText(white?.ordinal))}・藍 ${escapeHtml(cmOaksRentalOrdinalText(blue?.ordinal))}・固有 ${escapeHtml(cmOaksRentalOrdinalText(unique?.ordinal))}</small></div>
      <dl><div><dt>代理總分</dt><dd>${escapeHtml(cmOaksRentalNumericText(row.totalScore))}</dd></div><div><dt>資料完整度</dt><dd>${escapeHtml(completenessText)}</dd></div></dl>
    </article>`;
  }).join('')}${gaps.length ? `<p>待補欄位：${escapeHtml(gaps.slice(0, 6).map(cmOaksRentalGapText).join('、'))}${gaps.length > 6 ? `＋${gaps.length - 6}` : ''}</p>` : ''}`;
}

function renderCmOaksRentalTool() {
  const root = byId('cmOaksRentalTool');
  const input = byId('cmOaksRentalInput');
  const stage = byId('cmOaksRentalStage');
  const recovery = byId('cmOaksRentalRecovery');
  const exampleButton = byId('cmOaksRentalExample');
  const compareButton = byId('cmOaksRentalCompare');
  if (!root || !input || !stage || !recovery || !exampleButton || !compareButton) return;
  const available = typeof cmOaksRentalImportAdapter?.parseAndScore === 'function';
  compareButton.disabled = !available;
  exampleButton.disabled = !available;
  exampleButton.onclick = () => {
    input.value = cmOaksRentalExampleJson();
    input.focus();
  };
  rentalScreenshotImportUi?.mount({
    root: byId('rentalScreenshotImport'),
    jsonInput: input
  });
  compareButton.onclick = () => {
    cmOaksRentalImportResult = cmOaksRentalImportAdapter.parseAndScore(input.value, {
      lineageStage: stage.value,
      deckHasEarlyOrMiddleRecovery: recovery.checked
    });
    renderCmOaksRentalResult(cmOaksRentalImportResult);
  };
  if (!available) {
    cmOaksRentalImportResult = { status: 'UNAVAILABLE', probabilityStatus: 'NOT_COMPUTED' };
  }
  renderCmOaksRentalResult(cmOaksRentalImportResult);
}

function renderFactorGuide() {
  const root = byId('factorGuide');
  const guide = factorRunStrategy?.factorGuide;
  if (!root || !guide) return;
  const starter = (gameCatalog?.characterCards || [])
    .find(card => Number(card.id) === Number(guide.starter?.characterCardId));
  const inventoryOwnsStarter = (inventory?.trainees || [])
    .some(card => Number(card.outfitId) === Number(guide.starter?.characterCardId));
  const reference = guide.referenceTables || {};
  const aptitudeReference = reference.aptitudeModifiers || {};
  const skillNames = (guide.starter?.coreSkillIds || []).map(localizedSkillName);
  const starterName = starter
    ? `${starter.titleZhTw || starter.title || ''} ${starter.nameZhTw || starter.name || ''}`.trim()
    : `角色卡 ${guide.starter?.characterCardId || '未知'}`;
  const redTarget = guide.goalContract?.redStarAllocationTarget || {};
  const starterAptitudes = Array.isArray(starter?.aptitude) ? starter.aptitude : [];

  root.dataset.status = guide.status || 'USER_PLANNED';
  root.dataset.probabilityStatus = guide.probabilityStatus || 'COMMUNITY_REFERENCE_NOT_WIN_RATE';
  root.dataset.starterOwnership = inventoryOwnsStarter ? 'INVENTORY_SNAPSHOT' : guide.starter?.ownershipStatus || 'UNKNOWN';
  const evidenceBadge = byId('factorGuideEvidenceBadge');
  if (evidenceBadge) evidenceBadge.textContent = 'USER_RECORDED 起點・社群機率參考';

  const summary = byId('factorGuideSummary');
  if (summary) {
    summary.innerHTML = `
      <article data-guide-layer="starter">
        <span>現在先養誰</span>
        <strong>${escapeHtml(starterName)}</strong>
        <small>${inventoryOwnsStarter ? '持有清單快照已確認' : 'USER_RECORDED｜比 2026-07-15 持有清單快照新'}</small>
      </article>
      <article data-guide-layer="aptitude">
        <span>開局適性骨架</span>
        <strong>泥 ${escapeHtml(redTarget.dirt)}★＋一哩 ${escapeHtml(redTarget.mile)}★＋長 ${escapeHtml(redTarget.long)}★</strong>
        <small>${escapeHtml(redTarget.result || '')}</small>
      </article>
      <article data-guide-layer="take">
        <span>第一輪要拿</span>
        <strong>泥地紅因子＋核心技能白因子</strong>
        <small>${escapeHtml(skillNames.join('／'))}</small>
      </article>
      <article data-guide-layer="handoff">
        <span>下一代接什麼</span>
        <strong>共同 G1 歷戰＋補滿 ${escapeHtml(redTarget.total)}★骨架</strong>
        <small>先保留可用橋接種，不等第一輪全項完美。</small>
      </article>`;
  }

  const skillStrip = byId('factorGuideSkills');
  if (skillStrip) {
    skillStrip.innerHTML = `<strong>葛城直接承載</strong>${skillNames.map((name, index) =>
      `<span data-skill-id="${Number(guide.starter.coreSkillIds[index])}">${escapeHtml(name)}</span>`
    ).join('')}<small>因子化仍是抽選，不是學到就必掉。</small>`;
  }
  renderCmOaksWhiteFactorDecision();
  renderCmOaksRentalTool();

  const steps = byId('factorGuideSteps');
  if (steps) {
    steps.innerHTML = (guide.constructionSteps || []).map(step => `
      <li>
        <b>${escapeHtml(step.priority)}</b>
        <div><strong>${escapeHtml(step.title)}</strong><p>${escapeHtml(step.action)}</p><small>交接：${escapeHtml(step.handoff)}</small></div>
      </li>`).join('');
  }

  const winRateNote = byId('factorGuideWinRateNote');
  if (winRateNote) {
    winRateNote.innerHTML = `<strong>勝率：NOT_AVAILABLE</strong><span>${escapeHtml(reference.winRate?.note || '')}</span>`;
  }

  const aptitudeSummary = byId('factorGuideAptitudeSummary');
  if (aptitudeSummary) {
    aptitudeSummary.innerHTML = (guide.aptitudeTargets || []).map(target => {
      const startRank = starterAptitudes[Number(target.aptitudeIndex)] || '?';
      const targetRank = target.targetRank || startRank;
      const startModifier = factorGuideModifierText(target.kind, startRank, aptitudeReference);
      const targetModifier = factorGuideModifierText(target.kind, targetRank, aptitudeReference);
      const metric = target.kind === 'surface' ? '加速度' : '速度';
      const status = targetRank === 'A' ? 'READY' : targetRank === 'C' ? 'PROJECTED' : 'TRADEOFF';
      return `<article data-route-status="${status}">
        <span>${escapeHtml(target.priority)}・${escapeHtml(target.label)}</span>
        <strong>${escapeHtml(startRank)} → ${escapeHtml(targetRank)}</strong>
        <small>${target.redStars ? `紅因子 ${Number(target.redStars)}★` : '不用補紅因子'}・${metric} ${escapeHtml(startModifier)} → ${escapeHtml(targetModifier)}</small>
        <em>勝率未提供${status === 'PROJECTED' ? '・只作可嘗試線' : ''}</em>
      </article>`;
    }).join('');
  }

  const aptitudeTable = byId('factorGuideAptitudeTable');
  if (aptitudeTable) {
    aptitudeTable.innerHTML = factorGuideTableMarkup(
      ['適性修正', ...(aptitudeReference.ranks || [])],
      [
        ['場地／加速度', ...(aptitudeReference.surfaceAccelerationPercent || []).map(value => `${value > 0 ? '+' : ''}${value}%`)],
        ['距離／速度', ...(aptitudeReference.distanceSpeedPercent || []).map(value => `${value > 0 ? '+' : ''}${value}%`)],
        ['作戰／智力', ...(aptitudeReference.styleWitPercent || []).map(value => `${value > 0 ? '+' : ''}${value}%`)]
      ],
      `Uma Reference 適性修正；${aptitudeReference.optionalRaceGuidance || '不是勝率'}`
    );
  }

  const g1Catalog = byId('factorGuideG1Catalog');
  if (g1Catalog) {
    g1Catalog.innerHTML = factorGuideTableMarkup(
      ['場地', '距離', '同名去重 G1', '本地目錄候選例', '狀態'],
      factorGuideUniqueG1Rows(guide),
      '本地 G1 目錄候選池；不是單輪可跑清單，也不是已確認勝鞍'
    );
  }

  const streak = reference.consecutiveRacePenalty || {};
  const streakTable = byId('factorGuideStreakTable');
  if (streakTable) {
    streakTable.innerHTML = factorGuideTableMarkup(streak.columns, streak.rows, '連戰事故率／社群估計');
  }
  if (byId('factorGuideStreakNote')) byId('factorGuideStreakNote').textContent = streak.mandatoryRaceNote || '';

  const inheritance = reference.inheritanceBase || {};
  const inheritanceTable = byId('factorGuideInheritanceTable');
  if (inheritanceTable) {
    inheritanceTable.innerHTML = factorGuideTableMarkup(inheritance.columns, inheritance.rows, '單一因子的基礎繼承率');
  }
  if (byId('factorGuideInheritanceNote')) {
    byId('factorGuideInheritanceNote').textContent = `${inheritance.compatibilityFormula || ''}。${inheritance.grandparentNote || ''}`;
  }

  const generation = reference.factorGeneration || {};
  const blueTable = byId('factorGuideBlueTable');
  if (blueTable) blueTable.innerHTML = factorGuideTableMarkup(generation.blueStarColumns, generation.blueStarRows, '藍因子星數／社群參考');
  if (byId('factorGuideBlueNote')) byId('factorGuideBlueNote').textContent = generation.blueStatSelectionNote || '';
  const skillWhiteTable = byId('factorGuideSkillWhiteTable');
  if (skillWhiteTable) skillWhiteTable.innerHTML = factorGuideTableMarkup(generation.skillWhiteColumns, generation.skillWhiteRows, '學到技能後生成白因子的基礎估計');
  if (byId('factorGuideSkillWhiteNote')) {
    byId('factorGuideSkillWhiteNote').textContent = `${generation.raceScenarioWhiteBase || ''} ${generation.familySameFactorBonus || ''}`.trim();
  }
  const whiteStarTable = byId('factorGuideWhiteStarTable');
  if (whiteStarTable) whiteStarTable.innerHTML = factorGuideTableMarkup(generation.whiteStarColumns, generation.whiteStarRows, '白因子星數／社群參考');
  if (byId('factorGuideRedSelectionNote')) byId('factorGuideRedSelectionNote').textContent = generation.redSelectionNote || '';

  const graduation = byId('factorGuideGraduation');
  if (graduation) {
    graduation.innerHTML = `<h4>本輪畢業線</h4><div>${(guide.graduationLines || []).map(line => `
      <article data-graduation-status="${escapeHtml(line.status)}">
        <span>${escapeHtml(line.level)}</span><strong>${escapeHtml(line.status)}</strong><p>${escapeHtml(line.criteria)}</p>
      </article>`).join('')}</div>`;
  }

  const futureSupport = guide.futureSupport || {};
  const futureNode = byId('factorGuideFutureSupport');
  if (futureNode) {
    futureNode.innerHTML = `
      <span>${escapeHtml(futureSupport.zhTwStatus || 'UNKNOWN')}</span>
      <div><strong>${escapeHtml(futureSupport.name || '')}・${escapeHtml(futureSupport.supportType || '')}</strong>
      <p>${escapeHtml(futureSupport.action || '')}</p>
      <small>繁中推出：${escapeHtml(futureSupport.zhTwReleaseDate || '待確認')}｜日服公開：${escapeHtml(futureSupport.jpReleaseDate || '未知')}｜目標技能：${escapeHtml(localizedSkillName(futureSupport.targetSkillId))}</small></div>`;
  }

  const sourceIds = new Set([
    guide.goalContract?.redStarAllocationTarget?.sourceId,
    aptitudeReference.sourceId,
    streak.sourceId,
    inheritance.sourceId,
    ...(generation.sourceIds || []),
    ...(futureSupport.sourceIds || [])
  ].filter(Boolean));
  const sources = (factorRunStrategy?.sources || []).filter(source => sourceIds.has(source.id));
  const sourceNode = byId('factorGuideSources');
  if (sourceNode) {
    sourceNode.innerHTML = `<h4>原始參考</h4><ul>${sources.map(source => `
      <li><a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.label)}</a><small>${escapeHtml(source.claimScope || source.layer || '')}</small></li>
    `).join('')}</ul>`;
  }
}

function factorTargetRowsMarkup(profile, expectedStats) {
  return `<div class="factor-target-row factor-target-row--head" aria-hidden="true">
      <span>能力</span><span>目前預估</span><span>最低線</span><span>主要目標</span><span>未達權重</span><span>超標權重</span>
    </div>${factorStatAxes.map(axis => {
      const row = profile?.axes?.[axis] || {};
      return `<div class="factor-target-row" data-factor-target-axis="${axis}">
        <strong>${escapeHtml(row.label || factorAxisLabel(axis))}</strong>
        <output>${Number.isFinite(Number(expectedStats?.[axis])) ? Math.round(Number(expectedStats[axis])) : '未填'}</output>
        <label><span>最低線</span><input type="number" min="0" max="2500" step="10" inputmode="numeric" data-factor-axis="${axis}" data-factor-field="minimum" value="${factorInputValue(row.minimum)}" placeholder="不設硬門" aria-label="${escapeHtml(factorAxisLabel(axis))}最低線"></label>
        <label><span>主要目標</span><input type="number" min="0" max="2500" step="10" inputmode="numeric" data-factor-axis="${axis}" data-factor-field="target" value="${factorInputValue(row.target)}" placeholder="未設定" aria-label="${escapeHtml(factorAxisLabel(axis))}主要目標"></label>
        <label><span>未達權重</span><input type="number" min="0" max="20" step="0.1" inputmode="decimal" data-factor-axis="${axis}" data-factor-field="belowWeight" value="${factorInputValue(row.belowWeight)}" aria-label="${escapeHtml(factorAxisLabel(axis))}未達權重"></label>
        <label><span>超標權重</span><input type="number" min="0" max="20" step="0.1" inputmode="decimal" data-factor-axis="${axis}" data-factor-field="surplusWeight" value="${factorInputValue(row.surplusWeight)}" aria-label="${escapeHtml(factorAxisLabel(axis))}超標權重"></label>
      </div>`;
    }).join('')}`;
}

function bindFactorDecisionControls() {
  const templateSelect = byId('factorTargetTemplate');
  const riskSelect = byId('factorRiskProfile');
  const budgetInput = byId('factorTradeoffBudgetPercent');
  const targetRows = byId('factorTargetRows');
  if (templateSelect) {
    templateSelect.onchange = () => {
      const riskProfileId = state.factorExecution?.riskProfileId;
      const tradeoffBudgetPercent = state.factorExecution?.tradeoffBudgetPercent;
      state.factorExecution = normalizeFactorExecutionState({
        templateId: templateSelect.value,
        riskProfileId,
        tradeoffBudgetPercent
      });
      renderFactorDecision();
      renderGuidedParentStage();
      renderParents();
      scheduleSave();
    };
  }
  if (riskSelect) {
    riskSelect.onchange = () => {
      const risk = factorRiskProfileById(riskSelect.value);
      state.factorExecution.riskProfileId = risk.id;
      state.factorExecution.tradeoffBudgetPercent = Math.round(Number(risk.tradeoffBudget || 0.1) * 100);
      renderFactorDecision();
      renderGuidedParentStage();
      renderParents();
      scheduleSave();
    };
  }
  if (budgetInput) {
    budgetInput.onchange = () => {
      state.factorExecution.tradeoffBudgetPercent = Math.max(
        0,
        Math.min(30, finiteOrNull(budgetInput.value) ?? 0)
      );
      renderFactorDecision();
      renderGuidedParentStage();
      renderParents();
      scheduleSave();
    };
  }
  targetRows?.querySelectorAll('[data-factor-axis][data-factor-field]').forEach(input => {
    input.onchange = () => {
      const axis = input.dataset.factorAxis;
      const field = input.dataset.factorField;
      if (!factorStatAxes.includes(axis) || !['minimum', 'target', 'belowWeight', 'surplusWeight'].includes(field)) return;
      const fallback = field === 'belowWeight' ? 1 : field === 'surplusWeight' ? 0.25 : null;
      state.factorExecution.targets[axis][field] = finiteOrNull(input.value) ?? fallback;
      renderFactorDecision();
      scheduleSave();
    };
  });
}

function renderFactorDecision() {
  const workbench = byId('factorDecisionWorkbench');
  if (!workbench || !factorExecutionCore) return;
  const template = activeFactorExecutionTemplate();
  const risk = factorRiskProfileById(state.factorExecution?.riskProfileId);
  const profile = activeFactorTargetProfile();
  const expectedStats = expectedFactorStats();
  const result = factorExecutionAssessment();
  if (!result?.assessment) return;
  const { assessment, schedule } = result;
  const scenarioMismatch = Boolean(template?.scenarioId && template.scenarioId !== state.scenarioId);
  const parentRows = factorExecutionCore.annotateNearTies(guidedParentRecommendations(), {
    scoreKey: 'parentRankScore',
    toleranceRatio: Number(state.factorExecution?.tradeoffBudgetPercent || 0) / 100,
    riskProfile: risk,
    riskProfiles: factorExecutionRiskProfiles
  });
  const nearTieRows = parentRows.filter(row => row.nearTie);
  const targetSelect = byId('factorTargetTemplate');
  const riskSelect = byId('factorRiskProfile');
  const budgetInput = byId('factorTradeoffBudgetPercent');
  if (targetSelect) {
    targetSelect.innerHTML = factorExecutionTemplates.map(row =>
      `<option value="${escapeHtml(row.id)}">${escapeHtml(row.label || row.id)}</option>`
    ).join('');
    targetSelect.value = template.id;
  }
  if (riskSelect) {
    riskSelect.innerHTML = factorExecutionRiskProfiles.map(row =>
      `<option value="${escapeHtml(row.id)}">${escapeHtml(row.label || row.id)}｜${escapeHtml(row.description || '')}</option>`
    ).join('');
    riskSelect.value = risk.id;
  }
  if (budgetInput) budgetInput.value = String(state.factorExecution.tradeoffBudgetPercent);

  const rows = assessment.statAssessment.rows;
  const blockers = assessment.statAssessment.blockers;
  const tradeoffs = assessment.statAssessment.tradeoffs;
  const unknown = assessment.statAssessment.unknown || [];
  const unconfigured = assessment.statAssessment.unconfigured || [];
  const reached = rows.filter(row => row.status === 'AT_OR_ABOVE_TARGET' || row.status === 'AT_OR_ABOVE_MINIMUM');
  const statusText = blockers.length
    ? `有 ${blockers.length} 項低於你設定的 minimum；這是使用者硬門。`
    : assessment.statAssessment.status === 'UNCONFIGURED'
      ? '目前未套用任何能力門檻；請自行設定，或明確選用 Kua 社群參考模板。'
      : assessment.statAssessment.status === 'UNVERIFIED'
        ? '尚缺五維預估值；空值維持未知，不會當成零或達標。'
    : tradeoffs.length
      ? `${reached.length} 項已達目標、${tradeoffs.length} 項仍有缺口；缺口保留為可解釋妥協。`
      : unconfigured.length
        ? `${reached.length} 項達到已設定門檻，另有 ${unconfigured.length} 項未設定；未設定項不計分。`
        : unknown.length
          ? `${reached.length} 項達到已設定門檻，另有 ${unknown.length} 項仍缺預估值。`
          : '目前有資料的五維皆已達 target；超標部分仍按較低邊際價值計算。';
  const mismatchText = scenarioMismatch
    ? ` 目前劇本為 ${activeBattleScenario()?.nameZhTw || state.scenarioId || '未指定'}，所選模板只作跨劇本參考。`
    : '';
  const status = blockers.length
    ? 'BLOCKED'
    : ['UNCONFIGURED', 'UNVERIFIED'].includes(assessment.statAssessment.status)
      ? assessment.statAssessment.status
      : (tradeoffs.length || unconfigured.length || unknown.length || scenarioMismatch ? 'READY_WITH_TRADEOFFS' : 'READY');
  workbench.dataset.status = status;
  workbench.dataset.probabilityStatus = 'NOT_COMPUTED';
  workbench.dataset.sourceStatus = template.sourceStatus || 'USER_CONFIGURED';
  workbench.dataset.nearTieCount = String(nearTieRows.length);
  workbench.dataset.scenarioMismatch = String(scenarioMismatch);
  const statusOutput = byId('factorDecisionStatus');
  if (statusOutput) {
    const statusLabel = status === 'BLOCKED'
      ? '需先修正硬門'
      : status === 'READY'
        ? '目前可用'
        : status === 'UNCONFIGURED'
          ? '先設定目標'
          : status === 'UNVERIFIED'
            ? '等待預估值'
            : '可用，但有取捨';
    statusOutput.innerHTML = `<strong>${statusLabel}</strong><span>${escapeHtml(statusText + mismatchText)}</span>`;
  }
  const evidenceBadge = byId('factorDecisionEvidenceBadge');
  if (evidenceBadge) {
    evidenceBadge.textContent = template.sourceStatus === 'USER_CONFIGURED'
      ? '使用者設定'
      : '社群觀察・需校準';
  }
  const selectedParentCount = [state.main, state.sub].filter(hasSelectedParentId).length;
  const factorDirectionCount = reverseLineageFactorTargets().length;
  if (byId('factorLineageLayer')) {
    byId('factorLineageLayer').textContent = `親代 ${selectedParentCount}/2・${factorDirectionCount} 個因子方向`;
  }
  if (byId('factorExecutionLayer')) {
    byId('factorExecutionLayer').textContent = `${reached.length} 項達標・${tradeoffs.length} 項缺口・${unconfigured.length} 項未設・必跑 ${schedule?.goals?.length || 0} 場`;
  }
  if (byId('factorEvidenceLayer')) {
    byId('factorEvidenceLayer').textContent = `${template.sourceStatus || 'USER_CONFIGURED'}・不計機率`;
  }

  const targetRows = byId('factorTargetRows');
  if (targetRows) targetRows.innerHTML = factorTargetRowsMarkup(profile, expectedStats);

  const blueOutput = byId('factorBlueMarginal');
  if (blueOutput) {
    const ranked = assessment.blueFactorOptions.filter(row =>
      row.marginalUtility !== null && Number.isFinite(Number(row.marginalUtility))
    );
    blueOutput.innerHTML = ranked.length
      ? `<ol>${ranked.slice(0, 3).map((row, index) => `<li data-rank="${index + 1}"><strong>${escapeHtml(factorAxisLabel(row.axis))} 3★</strong><span>+${row.appliedGain}・邊際值 ${Number(row.marginalUtility).toFixed(1)}</span><small>${row.targetGapBefore > 0 ? `原缺口 ${Math.round(row.targetGapBefore)}` : '已過 target，按 surplus 權重'}</small></li>`).join('')}</ol>`
      : '<p>先在上方足耐試算填入五維預估，才會計算藍因子邊際值。</p>';
  }

  const scheduleOutput = byId('factorGoalSchedule');
  if (scheduleOutput) {
    const goals = schedule?.goals || [];
    scheduleOutput.innerHTML = goals.length
      ? `<ul>${goals.slice(0, 6).map(goal => `<li><strong>第 ${goal.turn} 回合</strong><span>${escapeHtml(goal.nameZhTw || goal.nameJp || '目標賽')}</span><small>${goal.mappingStatus === 'LOCAL_CATALOG_MATCHED' ? '本地賽事已對應' : '社群賽程名稱；尚未唯一對應'}</small></li>`).join('')}</ul>${goals.length > 6 ? `<p>另有 ${goals.length - 6} 個必跑節點；目標賽本身免除自選連戰軟成本。</p>` : '<p>目標賽本身免除自選連戰軟成本。</p>'}<small>自選賽尚未輸入，因此不推測第三／第四連戰成本。</small>`
      : '<p>目前角色沒有可用的必跑賽程對照；空值代表未知，不代表零場。</p><small>自選賽尚未輸入，因此不推測第三／第四連戰成本。</small>';
  }

  const nearTieOutput = byId('factorNearTie');
  if (nearTieOutput) {
    const top = parentRows.find(row => row.nearTieReference);
    nearTieOutput.innerHTML = top
      ? `<p><strong>基準：${escapeHtml(top.nameZhTw || top.name || '最高分候選')}</strong><span>容忍度 ${state.factorExecution.tradeoffBudgetPercent}%（加權差，不是成功率）</span></p>${nearTieRows.length ? `<ul>${nearTieRows.slice(0, 4).map(row => `<li><strong>${escapeHtml(row.nameZhTw || row.name || '候選')}</strong><span>加權差 ${(Number(row.nearTieGapRatio) * 100).toFixed(1)}%</span><small>保留比較，不自動淘汰</small></li>`).join('')}</ul>` : '<small>目前容忍度內沒有其他候選；仍可從完整列表手動選擇。</small>'}`
      : '<p>先完成戰馬與候選資料，才會建立 deterministic near-tie。</p>';
  }
  bindFactorDecisionControls();
}

function renderFactorPlan() {
  const plan = activeFactorPlan();
  const foundation = byId('factorFoundation');
  const list = byId('factorCategoryList');
  if (!foundation || !list) return;
  const red = plan.redFactor || defaultFactorPlan.redFactor;
  const blue = plan.blueFactor || defaultFactorPlan.blueFactor;
  foundation.innerHTML = [red, blue].map(item => `
    <article>
      <span>${item.label}</span>
      <strong>${item.primary || item.priority || ''}</strong>
      <small>${item.detail || item.rule || ''}</small>
    </article>`).join('');

  const coverage = battleSkillCoverage();
  list.innerHTML = (plan.categories || []).map((category, categoryIndex) => {
    const targets = (category.skills || [])
      .map(meta => ({
        meta,
        score: factorEffectiveScore(category, meta, coverage),
        coverage: coverage.get(Number(meta.id))
      }))
      .sort((a, b) => b.score - a.score || Number(a.meta.id) - Number(b.meta.id))
      .map(({ meta, score, coverage: covered }) => {
        const factorSource = bestFactorSourceText(meta.factorId || meta.id);
        const evidence = [
          meta.activationWindow ? `區段：${meta.activationWindow}` : '',
          factorSource ? `育成來源：${factorSource}` : '',
          ...(meta.evidence || []),
          covered?.label || ''
        ].filter(Boolean);
        return `
          <article class="factor-target" data-skill-id="${meta.id}" data-coverage="${covered?.state || 'open'}">
            <div class="factor-target-heading">
              <h6>${localizedSkillName(meta.id)}</h6>
              <span class="factor-score">${score > 0 ? `必要度 ${score}` : '本體已有確定來源'}</span>
            </div>
            <p>${meta.reason || meta.description || ''}</p>
            <div class="factor-evidence">${evidence.map(item => `<span>${item}</span>`).join('')}</div>
          </article>`;
      }).join('');
    return `
      <details class="factor-category" data-category="${category.id}" ${categoryIndex === 0 ? 'open' : ''}>
        <summary class="factor-category-heading">
          <div><h5>${category.label}</h5><p>${category.description || ''}</p></div>
          <strong>展開 ${category.skills?.length || 0} 項</strong>
        </summary>
        <div class="factor-targets">${targets}</div>
      </details>`;
  }).join('');
  renderFactorDecision();
}

function renderResearchSources() {
  const container = byId('researchSources');
  if (!container) return;
  const strategy = activeRaceStrategy();
  const profileDefaults = [
    { label: '官方：歷史同條件活動公告', url: 'https://umamusume.jp/news/detail?id=2484' },
    { label: 'U-tools：大井泥地 2000m 領頭技能效果', url: 'https://xn--gck1f423k.xn--1bvt37a.tools/race/courses/11103/effects/runner' },
    { label: '神攻略：2025 LOH 泥地賽道校正', url: 'https://kamigame.jp/umamusume/page/365458142282152316.html' },
    { label: 'GameWith：2025 LOH 泥地角色與技能校正', url: 'https://gamewith.jp/uma-musume/article/show/492474' }
  ];
  const genericSources = [
    { label: 'GameTora：繁中技能、賽事與發動條件資料', url: 'https://gametora.com/umamusume' },
    { label: '賽馬娘研究：全程體力消耗公式', url: 'https://umamusumeschool.com/hp_decrease/' },
    { label: '賽馬娘研究：實際速度與腳質係數公式', url: 'https://umamusumeschool.com/running_speed/' },
    { label: 'Umalator：全程足耐模擬交叉驗證', url: 'https://alpha123.github.io/uma-tools/umalator-global/stamina/' }
  ];
  const useProfileAudit = hasActiveProfileStrategy(strategy);
  if (byId('researchSourceTitle')) {
    byId('researchSourceTitle').textContent = useProfileAudit
      ? `本次／下一場繁中規劃：${currentRaceProfile?.name || '目前賽事'}（日服 2025 同條件校正）`
      : '通用資料與公式來源';
  }
  const rawSources = useProfileAudit
    ? (jpStrategy?.sources || profileDefaults)
    : genericSources;
  const sources = rawSources.map(source => ({
    label: source.label || source.titleZhTw || source.title || source.name,
    url: source.url
  })).filter(source => source.label && source.url);
  container.innerHTML = sources
    .map(source => `<a href="${source.url}" target="_blank" rel="noreferrer">${escapeHtml(source.label)}</a>`)
    .join('');
}

function renderSkillPlan() {
  const panel = byId('skillPlan');
  const strategy = activeRaceStrategy();
  const plan = strategy
    ? { categories: strategy.categories, staminaModel: strategy.staminaModel }
    : currentRaceProfile?.skillPlan;
  const list = byId('skillCategoryList') || byId('skillTargetList');
  if (!panel || !list || !plan || !skillCore || !gameCatalog) {
    if (panel) panel.hidden = true;
    return;
  }

  const race = primaryRace();
  const useProfileAudit = hasActiveProfileStrategy(strategy);
  const strategyTitle = byId('raceStrategyTitle');
  if (strategyTitle) {
    strategyTitle.textContent =
      `${race?.name || race?.nameZhTw || '目前賽事'} · ${race?.distance || distanceLabels[strategy?.context?.distance_type] || ''}領頭策略`;
  }
  if (byId('skillPlanKicker')) {
    byId('skillPlanKicker').textContent = useProfileAudit
      ? '本次／下一場繁中規劃（日服 2025 同條件校正）'
      : '目前賽道動態分析';
  }
  if (byId('skillPlanIntro')) {
    byId('skillPlanIntro').textContent = useProfileAudit
      ? `${race?.name || currentRaceProfile?.name || '本場'}：日服 2025 同條件只作校正，繁中仍以本機模擬為先。排序為「1333m 終盤起點加速 → 序盤搶位 → 中後段連接 → 固定綠技 → 耐力模擬」。天候與場地狀態為隨機。`
      : `本頁已依 ${strategy?.context?.course_distance || '目前'}m、場地、方向、季節、天候與賽道幾何重新篩選領頭技能。順序為「距離／場地適性 → 全程足耐 → 有效終盤加速 → 序盤搶位 → 中盤保位 → 高效率補強」。`;
  }

  const coreSummary = byId('coreSkillSummary');
  if (coreSummary) {
    if (useProfileAudit) {
      const historicalTier = (activeStaminaModel()?.tiers || []).find(tier => tier.id === 'standard')
        || activeStaminaModel()?.tiers?.[0]
        || {};
      const profileCategories = currentRaceProfile?.skillPlan?.categories || [];
      const terminal = profileCategories.find(category => category.id === 'terminal')?.skills || [];
      const positioning = [
        ...(profileCategories.find(category => category.id === 'opening')?.skills || []),
        ...(profileCategories.find(category => category.id === 'middle')?.skills || [])
      ].slice(0, 4);
      coreSummary.innerHTML = `
      <article>
        <span>歷史耐力參考</span>
        <strong>耐力 ${historicalTier.stamina || 1200}＋金回 ${historicalTier.goldRecovery || 1}＋小回復 ${historicalTier.inheritedRecovery35 || 1}</strong>
        <small>日服 2025 同條件舊參考；本次繁中規劃必須先跑模擬，不是保證門檻</small>
      </article>
      <article>
        <span>終盤起點主加速</span>
        <strong>${terminal.map(skill => localizedSkillName(skill.id)).join('／') || '依本場技能計畫'}</strong>
        <small>1333m 起於第三彎道；最後衝刺 1667m、最終直線 1614m，晚發加速不作主軸</small>
      </article>
      <article>
        <span>前方位置與連接</span>
        <strong>${positioning.map(skill => localizedSkillName(skill.id)).join('／') || '依實際戰馬補足'}</strong>
        <small>白北部玄駒負責 1～3 名穩定，普通青雲天空只在第 1 名時提高上限</small>
      </article>`;
    } else {
      const red = strategy?.redFactors?.[0];
      const terminal = strategy?.categories
        ?.find(category => category.id === 'terminalAcceleration')?.skills?.slice(0, 2) || [];
      const positioning = [
        ...(strategy?.categories?.find(category => category.id === 'openingPositioning')?.skills || []),
        ...(strategy?.categories?.find(category => category.id === 'middleSpeed')?.skills || [])
      ].slice(0, 3);
      coreSummary.innerHTML = `
        <article>
          <span>第一門檻</span>
          <strong>${red?.label || '距離適性'} ★3＋足耐模擬通過</strong>
          <small>${red?.reason || '依目前賽道條件動態建立，不沿用其他賽道的固定清單'}</small>
        </article>
        <article>
          <span>本場終盤加速</span>
          <strong>${terminal.map(skill => localizedSkillName(skill.id)).join('／') || '尚無穩定白因子候選'}</strong>
          <small>只列 GameTora 靜態條件在本賽道可能成立的領頭技能</small>
        </article>
        <article>
          <span>位置維持</span>
          <strong>${positioning.map(skill => localizedSkillName(skill.id)).join('／') || '以泛用領頭速度補強'}</strong>
          <small>序盤搶位與中盤保位會依距離、場地與技能條件重新排序</small>
        </article>`;
    }
  }

  renderBattleCoverageSummary();
  renderFactorPlan();
  renderResearchSources();

  const priorityCoverage = battleSkillCoverage();
  const prioritySkills = activeFactorPlan().categories
    .flatMap(category => (category.skills || []).map(meta => {
      const score = factorEffectiveScore(category, meta, priorityCoverage);
      const source = bestFactorSourceText(meta.factorId || meta.id)
        || (meta.sourceKind === 'parent-unique'
          ? '指定角色固有，由實際種馬繼承'
          : '目前未對應持有卡，交由第 3 步借卡補缺口');
      return {
        name: localizedSkillName(meta.id),
        priority: `${meta.priority || category.label} · 必要度 ${score}`,
        score,
        source
      };
    }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'zh-Hant'))
    .slice(0, 5);
  const prioritySourceList = byId('prioritySkillSources');
  if (prioritySourceList) {
    prioritySourceList.innerHTML = prioritySkills.length
      ? prioritySkills.map(item => `
        <li>
          <div><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.priority)}</span></div>
          <small><b>主要來源</b>${escapeHtml(item.source)}</small>
        </li>`).join('')
      : '<li class="empty-state">目前沒有尚未覆蓋的優先技能。</li>';
  }
  const prioritySourceStatus = byId('prioritySkillSourcesStatus');
  if (prioritySourceStatus) {
    const validation = battleDeckValidation();
    const target = selectedBattleUmaCard();
    prioritySourceStatus.textContent = !validation.valid
      ? `六卡需要修正；目前未套用六卡覆蓋（${validation.problems.join('；')}）`
      : !target
        ? '戰馬未指定；目前先按通用領頭與六卡計算'
        : '已依戰馬本體、六卡與現有家系扣除覆蓋';
    prioritySourceStatus.dataset.state = !validation.valid ? 'invalid' : target ? 'valid' : 'warning';
  }

  let accessibleCount = 0;
  let totalCount = 0;
  list.innerHTML = plan.categories.map(category => {
    const cards = (category.skills || []).map(meta => {
      const resolved = skillCore.resolveSkillSources(meta.id, gameCatalog, inventory, plannerRules);
      if (!resolved) return '';
      totalCount += 1;
      const sources = skillSourceRows(resolved);
      if (sources.accessible) accessibleCount += 1;
      const factor = meta.factorId ? skillById.get(Number(meta.factorId)) : null;
      const factorSource = meta.factorId ? bestFactorSourceText(meta.factorId) : '';
      const factorText = meta.sourceKind === 'parent-unique'
        ? '親代固有直接繼承（需使用指定衣裝）'
        : factor
          ? `種馬白因子：${localizedSkillName(factor)}（機率取得）${factorSource ? `；來源 ${factorSource}` : ''}`
          : Number(resolved.skill.rarity) === 1
            ? `種馬白因子候選：${localizedSkillName(resolved.skill)}`
            : '戰馬用技能；沒有可直接繼承的金技白因子';
      const sourceRows = sources.rows.length
        ? sources.rows.map(source => `
          <div class="skill-source" data-ownership="${source.kind}">
            <span class="source-kind ${source.kind}">${source.label}</span>
            <span>${source.text}</span>
          </div>`).join('')
        : '<div class="skill-source"><span class="source-kind missing">未解析</span><span>本地卡表沒有可用來源</span></div>';
      return `
        <article class="skill-target" data-skill-id="${meta.id}" data-category="${category.id}">
          <div class="skill-target-header">
            <span class="skill-tier">${meta.priority || '候選'}</span>
            <h4>${localizedSkillName(resolved.skill)}</h4>
            <strong>${meta.effectLabel || ''}</strong>
          </div>
          <p class="skill-reason">${meta.reason}</p>
          <div class="skill-sources">${sourceRows}</div>
          <div class="skill-factor-direction">
            <b>${meta.sourceKind === 'parent-unique' ? '親代方向' : '因子方向'}</b>
            <span>${factorText}</span>
          </div>
        </article>`;
    }).join('');
    return `
      <section class="skill-category" data-category="${category.id}">
        <div class="skill-category-heading">
          <div><h4>${category.label}</h4><p>${category.description}</p></div>
          <strong>權重 ${category.weight || '動態'}</strong>
        </div>
        <div class="skill-target-list">${cards}</div>
      </section>`;
  }).join('');

  const status = byId('skillPlanStatus');
  if (status) {
    const target = selectedBattleUmaCard();
    const factorCount = activeFactorPlan().categories
      .flatMap(category => category.skills || []).length;
    status.textContent =
      `固定作戰：${STRATEGY} · ${target ? `${target.nameZhTw} ${target.titleZhTw}` : '戰馬未指定'}`
      + ` · ${factorCount} 個因子候選 · ${totalCount} 個本賽道技能參考`
      + `${useProfileAudit ? ` · 已套用${currentRaceProfile?.name || '本場'}日服 2025 同條件校正` : ' · GameTora 條件動態產生（含賽道幾何）'}`;
  }
  const advice = byId('skillPlanAdvice');
  if (advice) {
    const topOpen = prioritySkills.slice(0, 3).map(item => item.name);
    const mode = selectedInheritanceMode();
    const coverageBasis = state.familyParentBreederIds.some(Boolean)
      ? '戰馬本體、已指定六卡與現有家系'
      : '戰馬本體與已指定六卡';
    advice.textContent =
      `${mode?.label || '目前方案'}：${mode?.description || ''}`
      + ` 依${coverageBasis}降權後，先刷：${topOpen.join('、') || '目前沒有未覆蓋候選'}；主要取得來源已列在上方。`
      + (useProfileAudit
        ? ' 借卡不固定特定角色，而由第 3 步補最高權重缺口。'
        : ' 親代與第 3 步配卡都已改用本賽道動態候選。');
  }
  bindStaminaEstimator();
  renderParentSubviewStatus();
}

function affinityScore(target, candidate) {
  if (!affinity) return null;
  const a = affinity.names.indexOf(target);
  const b = affinity.names.indexOf(candidate);
  return a < 0 || b < 0 ? null : affinity.matrix[a][b];
}

function updateAffinity() {
  if (!affinity) return;
  const target = byId('targetUma').value;
  const candidate = byId('candidateUma').value;
  const score = affinityScore(target, candidate);
  byId('affinityValue').textContent = score ?? '--';
  byId('affinityNote').textContent =
    score === null ? '同角色不可配對' : `${localizedUmaName(target)} × ${localizedUmaName(candidate)}`;
  const matches = affinity.names
    .map(name => ({ name, score: affinityScore(target, name) }))
    .filter(item => item.score !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
  byId('topMatches').innerHTML =
    matches.map(item => `<li>${localizedUmaName(item.name)} <b>${item.score}</b></li>`).join('');
}

function normalizedG1EvidenceList(values) {
  if (typeof persistenceCore?.normalizeG1EvidenceList === 'function') {
    return persistenceCore.normalizeG1EvidenceList(values, persistenceMigrationOptions);
  }
  return (Array.isArray(values) ? values : [])
    .filter(Boolean)
    .map(value => value && typeof value === 'object' ? { ...value } : value);
}

function normalizedProjectedG1Schedule(values) {
  if (typeof persistenceCore?.normalizeProjectedG1Schedule === 'function') {
    return persistenceCore.normalizeProjectedG1Schedule(values, persistenceMigrationOptions);
  }
  return (Array.isArray(values) ? values : [])
    .filter(Boolean)
    .map(value => value && typeof value === 'object' ? { ...value } : value);
}

function g1EvidenceCatalogRaceId(value) {
  return Number(value?.catalogRaceId ?? value?.catalogId ?? value?.id ?? value);
}

function g1EvidenceLabel(value) {
  const catalogRaceId = g1EvidenceCatalogRaceId(value);
  const race = raceById.get(catalogRaceId);
  return value?.nameZhTw || race?.nameZhTw || `賽事 ${Number.isFinite(catalogRaceId) ? catalogRaceId : '待確認'}`;
}

function toBreederCoreRecord(record) {
  const trainee = inventoryTraineeByOutfitId.get(Number(record.outfitId));
  const card = characterCardById.get(Number(record.outfitId));
  // Do not collapse a structured G1 record back to an ID.  The breeder core
  // needs catalog/canonical IDs plus server/ruleset/outcome evidence to decide
  // whether a claimed WIN is actually scoreable.
  const raceWins = normalizedG1EvidenceList(record.g1Wins);
  const projectedG1Schedule = normalizedProjectedG1Schedule(record.projectedG1Schedule);
  return {
    schemaVersion: 1,
    id: record.id,
    label: record.name,
    character: {
      characterId: record.characterId,
      outfitId: record.outfitId,
      affinityKey: record.affinityKey || trainee?.affinityKey || card?.nameJp,
      nameZhTw: trainee?.nameZhTw || card?.nameZhTw,
      nameJp: trainee?.nameJp || card?.nameJp,
      outfitTitleZhTw: trainee?.outfitTitleZhTw || card?.titleZhTw
    },
    factors: {
      blue: {
        key: record.blueFactor?.type,
        nameZhTw: record.blueFactor?.type,
        stars: Number(record.blueFactor?.stars)
      },
      red: {
        key: record.redFactor?.type,
        nameZhTw: record.redFactor?.type,
        stars: Number(record.redFactor?.stars)
      },
      green: record.greenFactor?.type
        ? {
            key: record.greenFactor.type,
            nameZhTw: record.greenFactor.type,
            stars: Number(record.greenFactor.stars)
          }
        : null,
      white: (record.whiteFactors || []).map(factor => ({
        id: factor.id,
        skillId: Number(factor.skillId),
        key: Number.isFinite(Number(factor.skillId)) ? String(factor.skillId) : factor.name,
        nameZhTw: factor.name || localizedSkillName(factor.skillId),
        stars: Number(factor.stars)
      }))
    },
    g1Wins: raceWins,
    projectedG1Schedule,
    parentIds: record.parentIds || [null, null],
    notes: record.notes
  };
}

function breederCoreDatabase(records = breeders) {
  return {
    schemaVersion: 1,
    records: records.map(toBreederCoreRecord)
  };
}

function selectedFamilyAnalysis() {
  if (!breederCore || !affinity || !state.familyParentBreederIds.some(Boolean)) return null;
  return breederCore.calculateLineageScore({
    target: {
      affinityKey: state.familyTargetAffinityKey || affinity.names?.[0] || '',
      nameZhTw: localizedUmaName(state.familyTargetAffinityKey || affinity.names?.[0])
    },
    parentIds: state.familyParentBreederIds
  }, breederCoreDatabase(), affinity);
}

function breederDisplayName(record) {
  if (!record) return '未指定';
  const trainee = inventoryTraineeByOutfitId.get(Number(record.outfitId));
  return `${record.name}${trainee ? `｜${trainee.nameZhTw} ${trainee.outfitTitleZhTw}` : ''}`;
}

function breederSelectOptions(selectedId, excludedId = null) {
  return [
    '<option value="">未指定</option>',
    ...breeders
      .filter(record => record.id !== excludedId)
      .map(record =>
        `<option value="${escapeHtml(record.id)}" ${record.id === selectedId ? 'selected' : ''}>${escapeHtml(breederDisplayName(record))}</option>`
      )
  ].join('');
}

function ownedTraineeOptions(selectedId) {
  return (inventory?.trainees || [])
    .slice()
    .sort((a, b) =>
      String(a.nameZhTw).localeCompare(String(b.nameZhTw), 'zh-Hant')
      || Number(a.outfitId) - Number(b.outfitId)
    )
    .map(item =>
      `<option value="${item.outfitId}" ${Number(item.outfitId) === Number(selectedId) ? 'selected' : ''}>${item.nameZhTw} ${item.outfitTitleZhTw}｜${item.stars}★ 覺醒${item.awakeningLevel}</option>`
    ).join('');
}

function renderBreederDraftChips() {
  const whiteContainer = byId('breederWhiteFactors');
  const g1Container = byId('breederG1Wins');
  if (whiteContainer) {
    whiteContainer.innerHTML = breederDraftWhiteFactors.length
      ? breederDraftWhiteFactors.map((factor, index) =>
        `<span class="editor-chip">${escapeHtml(factor.name || localizedSkillName(factor.skillId))} ★${factor.stars}<button type="button" data-remove-white="${index}" aria-label="移除">×</button></span>`
      ).join('')
      : '<small>尚未加入白因子</small>';
    whiteContainer.querySelectorAll('[data-remove-white]').forEach(button => {
      button.onclick = () => {
        breederDraftWhiteFactors.splice(Number(button.dataset.removeWhite), 1);
        renderBreederDraftChips();
      };
    });
  }
  if (g1Container) {
    g1Container.innerHTML = breederDraftG1Wins.length
      ? breederDraftG1Wins.map((evidence, index) => {
        return `<span class="editor-chip">${escapeHtml(g1EvidenceLabel(evidence))}<button type="button" data-remove-g1="${index}" aria-label="移除">×</button></span>`;
      }).join('')
      : '<small>尚未加入 G1 勝場</small>';
    g1Container.querySelectorAll('[data-remove-g1]').forEach(button => {
      button.onclick = () => {
        breederDraftG1Wins.splice(Number(button.dataset.removeG1), 1);
        renderBreederDraftChips();
      };
    });
  }
}

function openBreederForm(recordId = null) {
  const record = breeders.find(item => item.id === recordId);
  const form = byId('breederForm');
  breederReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  form.hidden = false;
  byId('breederId').value = record?.id || '';
  byId('breederName').value = record?.name || '';
  byId('breederOutfit').innerHTML = ownedTraineeOptions(record?.outfitId);
  byId('breederRating').value = record?.rating || 0;
  byId('breederGreenStars').value = record?.greenFactor?.stars || 3;
  byId('breederBlueType').value = record?.blueFactor?.type || '速度';
  byId('breederBlueStars').value = record?.blueFactor?.stars || 3;
  byId('breederRedType').value = record?.redFactor?.type || '長距離';
  byId('breederRedStars').value = record?.redFactor?.stars || 3;
  byId('breederParentA').innerHTML = breederSelectOptions(record?.parentIds?.[0], record?.id);
  byId('breederParentB').innerHTML = breederSelectOptions(record?.parentIds?.[1], record?.id);
  byId('breederNotes').value = record?.notes || '';
  breederDraftWhiteFactors = (record?.whiteFactors || []).map(item => ({ ...item }));
  breederDraftG1Wins = [...(record?.g1Wins || [])];
  renderBreederDraftChips();
  form.scrollIntoView({ behavior: preferredScrollBehavior(), block: 'nearest' });
  requestAnimationFrame(() => byId('breederName')?.focus());
}

function closeBreederForm() {
  byId('breederForm').hidden = true;
  breederDraftWhiteFactors = [];
  breederDraftG1Wins = [];
  const returnTarget = breederReturnFocus;
  breederReturnFocus = null;
  requestAnimationFrame(() => (returnTarget?.isConnected ? returnTarget : byId('newBreeder'))?.focus());
}

function breederRegistryFactorLabel(factor, fallback) {
  if (!factor) return `${fallback}未記錄`;
  const label = factor.label || factor.name || fallback;
  const stars = Number.isInteger(factor.stars) ? ` ★${factor.stars}` : ' ★?';
  return `${label}${stars}`;
}

function breederRegistryOwnedMarkup(record) {
  const factors = [
    breederRegistryFactorLabel(record.bodyBlue, '藍因子'),
    breederRegistryFactorLabel(record.bodyRed, '紅因子'),
    breederRegistryFactorLabel(record.bodyUnique, '綠因子')
  ].join('・');
  const whites = Array.isArray(record.knownWhiteFactorHighlights)
    ? record.knownWhiteFactorHighlights.map(factor => breederRegistryFactorLabel(factor, '白因子'))
    : [];
  const parentReds = Array.isArray(record.parentConstructionReds)
    ? record.parentConstructionReds.map(factor => breederRegistryFactorLabel(factor, '紅因子')).join('＋')
    : '';
  return `<article class="breeder-registry-owned-card" data-planning-id="${escapeHtml(record.planningId)}" data-ownership-status="${escapeHtml(record.ownershipStatus)}">
    <header><div><strong>${escapeHtml(record.displayName)}</strong><small>${escapeHtml(record.characterName || '')}${record.outfitTitle ? `・${escapeHtml(record.outfitTitle)}` : ''}</small></div><code>${escapeHtml(record.planningId)}</code></header>
    <p class="breeder-registry-factor-line">${escapeHtml(factors)}</p>
    <p>${escapeHtml(record.planningRole || '自有種馬')}</p>
    <small>${whites.length ? `已記錄重點白因：${escapeHtml(whites.slice(0, 6).join('、'))}${whites.length > 6 ? `，另 ${whites.length - 6} 項` : ''}` : '白因子完整清單尚未記錄；不把未知當成 0'}</small>
    ${parentReds ? `<small>已知上代紅因：${escapeHtml(parentReds)}</small>` : ''}
    <small>規劃編號已固定；瀏覽器 record ID ${record.browserRecordId ? escapeHtml(record.browserRecordId) : '尚未精確綁定'}</small>
  </article>`;
}

function breederRegistryPlannedMarkup(record) {
  const ownedInputs = (record.buildFromOwnedPlanningIds || []).join('＋') || '自有親代待定';
  const externalInputs = (record.externalConstructionSourceIds || []).join('、');
  const shipLine = (record.minimumShipLine || []).join('；');
  return `<article data-planning-id="${escapeHtml(record.planningId)}" data-ownership-status="${escapeHtml(record.ownershipStatus)}">
    <header><strong>${escapeHtml(record.displayName)}</strong><code>${escapeHtml(record.planningId)}</code></header>
    <small>待自養・尚未列入可用資產</small>
    <p>施工：${escapeHtml(ownedInputs)}${externalInputs ? `＋外借 ${escapeHtml(externalInputs)}` : ''}</p>
    <p>用途：${escapeHtml(record.targetUse || '待確認')}</p>
    <small>${escapeHtml(shipLine || record.notes || '最低出貨線待確認')}</small>
  </article>`;
}

function renderBreederRegistry() {
  const status = byId('breederRegistryStatus');
  const summary = byId('breederRegistrySummary');
  const owned = byId('breederRegistryOwned');
  const planned = byId('breederRegistryPlanned');
  const historical = byId('breederRegistryHistorical');
  if (!status || !summary || !owned || !planned || !historical) return;
  const ownedRecords = (ownedBreederRegistry?.ownedRecords || [])
    .filter(record => record.ownershipStatus === 'USER_CONFIRMED_OWNED' && record.usableAsBreeder === true);
  const plannedRecords = (ownedBreederRegistry?.plannedRecords || [])
    .filter(record => record.ownershipStatus === 'PLANNED_SELF_BUILD_NOT_OWNED_YET');
  const externalSources = (rentalSourceRegistry?.candidates || [])
    .slice()
    .sort((left, right) =>
      Number(left.sortOrder ?? Number.MAX_SAFE_INTEGER) - Number(right.sortOrder ?? Number.MAX_SAFE_INTEGER)
      || String(left.id).localeCompare(String(right.id))
    );
  const localWhiteCount = breeders.reduce((total, record) =>
    total + (Array.isArray(record.whiteFactors) ? record.whiteFactors.length : 0), 0);
  status.textContent = `${ownedRecords.length} 隻可用自有・${plannedRecords.length} 隻待打造`;
  summary.innerHTML = `
    <article><span>你已確認持有</span><strong>${ownedRecords.length} 隻</strong><small>只計 K0／S1／B1／M1 這類自有規劃資產</small></article>
    <article><span>瀏覽器精確建檔</span><strong>${breeders.length} 筆</strong><small>${breeders.length ? `USER_RECORDED；已保存白因子 ${localWhiteCount} 列` : '尚未綁定 record ID，不影響查看自有名冊'}</small></article>
    <article><span>下一代自養目標</span><strong>${plannedRecords.length} 隻</strong><small>完成並驗收後才移入可用資產</small></article>`;
  owned.innerHTML = ownedRecords.length
    ? ownedRecords.map(breederRegistryOwnedMarkup).join('')
    : '<p class="empty-state">尚未記錄任何你自己持有的種馬。</p>';
  planned.innerHTML = plannedRecords.length
    ? plannedRecords.map(breederRegistryPlannedMarkup).join('')
    : '<p class="empty-state">目前沒有待自養的下一代。</p>';
  historical.innerHTML = externalSources.length
    ? externalSources.map(candidate => {
      const evidence = candidate.evidenceStatus || candidate.sourceStatus || 'UNKNOWN';
      const note = Array.isArray(candidate.notes) ? candidate.notes[0] : candidate.notes;
      return `<article data-planning-status="${escapeHtml(candidate.planningStatus || 'INCOMPLETE')}" data-evidence-status="${escapeHtml(evidence)}">
        <header><strong>${escapeHtml(candidate.displayName || candidate.nameZhTw || '未命名來源')}</strong><code>外借 ${escapeHtml(candidate.id)}</code></header>
        <small>外部施工來源・${escapeHtml(candidate.availabilityStatus || 'NEEDS_IN_GAME_RECHECK')}</small>
        <p>${escapeHtml(candidate.displaySummary || '因子欄位尚未完整記錄')}</p>
        ${note ? `<small>${escapeHtml(note)}</small>` : ''}
      </article>`;
    }).join('')
    : '<p class="empty-state">目前沒有外部施工來源；這不影響你的自有種馬資產。</p>';
}

function renderBreederDatabase() {
  const list = byId('breederList');
  if (!list) return;
  list.innerHTML = breeders.length
    ? breeders.map(record => {
      const trainee = inventoryTraineeByOutfitId.get(Number(record.outfitId));
      const parentNames = (record.parentIds || [])
        .filter(Boolean)
        .map(id => breederDisplayName(breeders.find(item => item.id === id)));
      const whiteFactorText = (record.whiteFactors || [])
        .map(factor => `${factor.name || localizedSkillName(factor.skillId)} ★${factor.stars}`)
        .join('、');
      const factors = [
        `${record.greenFactor?.type || '固有因子'} ★${record.greenFactor?.stars || 1}`,
        `${record.blueFactor?.type || '藍因子'} ★${record.blueFactor?.stars || 1}`,
        `${record.redFactor?.type || '紅因子'} ★${record.redFactor?.stars || 1}`,
        `白因子 ${record.whiteFactors?.length || 0} 個`,
        `G1 ${record.g1Wins?.length || 0} 場`
      ];
      return `<article class="breeder-record">
        <header>
          <div><h4>${escapeHtml(record.name)}</h4><small>${escapeHtml(trainee ? `${trainee.nameZhTw} ${trainee.outfitTitleZhTw}` : '衣裝資料待確認')}｜本機紀錄 ID ${escapeHtml(record.id)}</small></div>
          <div class="record-actions">
            <button type="button" data-edit-breeder="${escapeHtml(record.id)}">編輯</button>
            <button type="button" data-delete-breeder="${escapeHtml(record.id)}">刪除</button>
          </div>
        </header>
        <p>${escapeHtml(factors.join('・'))}</p>
        <p>${record.parentIds?.filter(Boolean).length === 2 ? '祖代資料完整' : '尚未填滿兩名祖代'}${parentNames.length ? `｜${escapeHtml(parentNames.join('＋'))}` : ''}</p>
        ${whiteFactorText ? `<p class="record-white-factors">白因子：${escapeHtml(whiteFactorText)}</p>` : ''}
        ${record.notes ? `<p>${escapeHtml(record.notes)}</p>` : ''}
      </article>`;
    }).join('')
    : '<p class="empty-state">尚未建立現有種馬。先新增你已經養好的種馬，之後就能直接組家系與計算共同 G1。</p>';
  list.querySelectorAll('[data-edit-breeder]').forEach(button => {
    button.onclick = () => openBreederForm(button.dataset.editBreeder);
  });
  list.querySelectorAll('[data-delete-breeder]').forEach(button => {
    button.onclick = () => {
      const record = breeders.find(item => item.id === button.dataset.deleteBreeder);
      if (!record || !window.confirm(`確定刪除「${record.name}」？引用它的祖代欄位會清空。`)) return;
      breeders = breeders
        .filter(item => item.id !== record.id)
        .map(item => ({
          ...item,
          parentIds: item.parentIds.map(id => id === record.id ? null : id)
        }));
      state.familyParentBreederIds = state.familyParentBreederIds
        .map(id => id === record.id ? null : id);
      state.lineageBreederRecordBindings = Object.fromEntries(
        Object.entries(state.lineageBreederRecordBindings || {})
          .filter(([, recordId]) => recordId !== record.id)
      );
      renderBreederDatabase();
      renderSkillPlan();
      if (state.activePanel === 'deck') renderDeck();
      persistPlanner();
    };
  });
  renderBreederRegistry();
  renderFamilyPlanner();
  renderParentSubviewStatus();
}

function saveBreederFromForm(event) {
  event.preventDefault();
  const outfitId = Number(byId('breederOutfit').value);
  const trainee = inventoryTraineeByOutfitId.get(outfitId);
  const outfitCard = characterCardById.get(outfitId);
  const uniqueSkillId = [...(outfitCard?.uniqueSkillIds || [])]
    .map(Number)
    .filter(Number.isFinite)
    .at(-1);
  const existingId = byId('breederId').value;
  const existing = breeders.find(item => item.id === existingId);
  const record = persistenceCore.normalizeBreeder({
    id: existing?.id || persistenceCore.createId('breeder'),
    name: byId('breederName').value,
    outfitId,
    characterId: trainee?.characterId,
    affinityKey: trainee?.affinityKey,
    rating: Number(byId('breederRating').value) || 0,
    greenFactor: {
      type: localizedSkillName(uniqueSkillId),
      stars: Number(byId('breederGreenStars').value)
    },
    blueFactor: {
      type: byId('breederBlueType').value,
      stars: Number(byId('breederBlueStars').value)
    },
    redFactor: {
      type: byId('breederRedType').value,
      stars: Number(byId('breederRedStars').value)
    },
    whiteFactors: breederDraftWhiteFactors,
    parentIds: [
      byId('breederParentA').value || null,
      byId('breederParentB').value || null
    ],
    g1Wins: normalizedG1EvidenceList(breederDraftG1Wins),
    notes: byId('breederNotes').value,
    createdAt: existing?.createdAt,
    updatedAt: new Date().toISOString()
  });
  const candidate = existing
    ? breeders.map(item => item.id === existing.id ? record : item)
    : [...breeders, record];
  if (existing && (
    Number(existing.outfitId) !== Number(record.outfitId)
    || Number(existing.characterId) !== Number(record.characterId)
  )) {
    state.lineageBreederRecordBindings = Object.fromEntries(
      Object.entries(state.lineageBreederRecordBindings || {})
        .filter(([, recordId]) => recordId !== existing.id)
    );
  }
  const validation = breederCore?.validateBreederDatabase(breederCoreDatabase(candidate), { affinityData: affinity });
  if (validation && !validation.valid) {
    window.alert(validation.errors.map(error => error.message).join('\n'));
    return;
  }
  breeders = candidate;
  closeBreederForm();
  renderBreederDatabase();
  renderSkillPlan();
  if (state.activePanel === 'deck') renderDeck();
  persistPlanner();
}

function initBreederDatabase() {
  byId('breederOutfit').innerHTML = ownedTraineeOptions();
  byId('breederWhiteSkill').innerHTML = (gameCatalog?.skills || [])
    .filter(skill => Number(skill.rarity) === 1 && Number(skill.id) >= 200000 && Number(skill.id) < 300000)
    .sort((a, b) => String(a.nameZhTw).localeCompare(String(b.nameZhTw), 'zh-Hant'))
    .map(skill => `<option value="${skill.id}">${skill.nameZhTw}｜${skill.descriptionZhTw || ''}</option>`)
    .join('');
  byId('breederG1Race').innerHTML = (gameCatalog?.races || [])
    .filter(race => Number(race.grade) === 100)
    .sort((a, b) => String(a.nameZhTw).localeCompare(String(b.nameZhTw), 'zh-Hant'))
    .map(race => `<option value="${race.id}">${race.nameZhTw}｜${trackNames[race.trackId] || race.trackId} ${race.distance}m</option>`)
    .join('');
  byId('newBreeder').onclick = () => openBreederForm();
  byId('cancelBreeder').onclick = closeBreederForm;
  byId('addWhiteFactor').onclick = () => {
    const skillId = Number(byId('breederWhiteSkill').value);
    const skill = skillById.get(skillId);
    const existing = breederDraftWhiteFactors.find(item => Number(item.skillId) === skillId);
    if (existing) {
      existing.stars = Number(byId('breederWhiteStars').value);
    } else {
      breederDraftWhiteFactors.push({
        id: persistenceCore.createId('factor'),
        skillId,
        name: skill?.nameZhTw || `技能 ${skillId}`,
        stars: Number(byId('breederWhiteStars').value)
      });
    }
    renderBreederDraftChips();
  };
  byId('addG1Win').onclick = () => {
    const raceId = Number(byId('breederG1Race').value);
    if (!breederDraftG1Wins.some(item => g1EvidenceCatalogRaceId(item) === raceId)) {
      breederDraftG1Wins.push(raceId);
    }
    renderBreederDraftChips();
  };
  byId('breederForm').onsubmit = saveBreederFromForm;
  renderBreederDatabase();
}

function familyRecordLabel(record) {
  if (!record) return '未指定';
  return record.label || record.character?.nameZhTw || record.character?.affinityKey || record.id;
}

function rankedExistingBreeders(targetAffinityKey) {
  const targetWeights = new Map();
  for (const category of activeFactorPlan().categories || []) {
    for (const factor of category.skills || []) {
      const skillId = Number(factor.factorId || factor.id);
      if (!Number.isFinite(skillId)) continue;
      const weight = factorEffectiveScore(category, factor);
      targetWeights.set(skillId, Math.max(targetWeights.get(skillId) || 0, weight));
    }
  }
  const wantedRed = activeFactorPlan().redFactor?.primary || '';
  return breeders.map(record => {
    const baseAffinity = affinityScore(targetAffinityKey, record.affinityKey);
    const whiteMatches = (record.whiteFactors || [])
      .map(factor => ({
        name: factor.name || localizedSkillName(factor.skillId),
        stars: Number(factor.stars) || 1,
        weight: targetWeights.get(Number(factor.skillId)) || 0
      }))
      .filter(factor => factor.weight > 0);
    const whiteScore = whiteMatches.reduce(
      (sum, factor) => sum + factor.weight * (0.8 + factor.stars * 0.2),
      0
    );
    const redMatch = record.redFactor?.type && wantedRed.includes(record.redFactor.type);
    const ancestryComplete = (record.parentIds || []).filter(Boolean).length === 2;
    const score =
      Math.max(0, Number(baseAffinity) || 0) * 12
      + whiteScore
      + (redMatch ? 260 + Number(record.redFactor.stars || 1) * 40 : 0)
      + (ancestryComplete ? 80 : 0)
      + Math.min(150, Number(record.rating) / 100);
    const reasons = [
      Number.isFinite(baseAffinity) ? `角色相性 ${baseAffinity}` : '',
      redMatch ? `${record.redFactor.type} ${record.redFactor.stars}★` : '',
      whiteMatches.length
        ? `命中 ${whiteMatches.slice(0, 3).map(item => `${item.name} ${item.stars}★`).join('、')}`
        : '',
      ancestryComplete ? '祖代完整' : '祖代未完整'
    ].filter(Boolean);
    return { record, score: Math.round(score), reasons };
  }).sort((a, b) =>
    b.score - a.score
    || Number(b.record.rating) - Number(a.record.rating)
    || String(a.record.name).localeCompare(String(b.record.name), 'zh-Hant')
  );
}

function renderBreederRecommendations() {
  const container = byId('breederRecommendations');
  if (!container) return;
  if (!breeders.length) {
    container.innerHTML = '<p class="empty-state">建立現有種馬後，這裡會依相性、紅因子、目標白因子與祖代完整度排序。</p>';
    return;
  }
  const ranked = rankedExistingBreeders(state.familyTargetAffinityKey).slice(0, 5);
  container.innerHTML = `
    <div class="recommendation-heading">
      <strong>現有種馬候選排序</strong>
      <small>工具分數只用於比較你手上的紀錄，不是遊戲內相性值。</small>
    </div>
    <div class="breeder-recommendation-list">
      ${ranked.map((item, index) => `
        <article>
          <span>#${index + 1}</span>
          <div><strong>${escapeHtml(breederDisplayName(item.record))}</strong><small>${escapeHtml(item.reasons.join('・'))}</small></div>
          <b>${item.score}</b>
          <button type="button" data-use-breeder-a="${escapeHtml(item.record.id)}">設為 A</button>
          <button type="button" data-use-breeder-b="${escapeHtml(item.record.id)}">設為 B</button>
        </article>
      `).join('')}
    </div>`;
  container.querySelectorAll('[data-use-breeder-a]').forEach(button => {
    button.onclick = () => {
      state.familyParentBreederIds[0] = button.dataset.useBreederA;
      renderFamilyPlanner();
      renderSkillPlan();
      if (state.activePanel === 'deck') renderDeck();
      scheduleSave();
    };
  });
  container.querySelectorAll('[data-use-breeder-b]').forEach(button => {
    button.onclick = () => {
      state.familyParentBreederIds[1] = button.dataset.useBreederB;
      renderFamilyPlanner();
      renderSkillPlan();
      if (state.activePanel === 'deck') renderDeck();
      scheduleSave();
    };
  });
}

function renderFamilyPlanner() {
  const targetSelect = byId('familyTargetUma');
  const parentASelect = byId('familyParentA');
  const parentBSelect = byId('familyParentB');
  if (!targetSelect || !parentASelect || !parentBSelect) return;
  if (!targetSelect.options.length) {
    targetSelect.innerHTML = affinity.names
      .map(name => `<option value="${name}">${localizedUmaName(name)}</option>`)
      .join('');
  }
  const battleTarget = selectedBattleUmaCard();
  const battleAffinity = battleTarget
    ? characterById.get(Number(battleTarget.characterId))?.jp_name
    : null;
  if (!state.familyTargetAffinityKey) {
    state.familyTargetAffinityKey = battleAffinity || affinity.names[0] || '';
  }
  targetSelect.value = state.familyTargetAffinityKey;
  renderBreederRecommendations();
  parentASelect.innerHTML = breederSelectOptions(state.familyParentBreederIds[0]);
  parentBSelect.innerHTML = breederSelectOptions(state.familyParentBreederIds[1]);

  const [parentAId, parentBId] = state.familyParentBreederIds;
  const output = byId('familyAffinityResult');
  const tree = byId('familyTree');
  if (!parentAId || !parentBId || !breederCore) {
    tree.innerHTML = '';
    output.innerHTML = '<p class="empty-state">請從現有種馬庫選擇實際種馬 A 與 B；系統會沿用各自保存的兩名親代作為四祖代。</p>';
  } else {
    const result = selectedFamilyAnalysis();
    const branches = [
      ['parentA', 'parentA1', 'parentA2', '實際種馬 A'],
      ['parentB', 'parentB1', 'parentB2', '實際種馬 B']
    ];
    tree.innerHTML = branches.map(([parent, grand1, grand2, label]) => `
      <article class="family-branch">
        <strong>${label}｜${escapeHtml(familyRecordLabel(result.family[parent]))}</strong>
        <div class="family-grandparents">
          <span>祖代 1｜${escapeHtml(familyRecordLabel(result.family[grand1]))}</span>
          <span>祖代 2｜${escapeHtml(familyRecordLabel(result.family[grand2]))}</span>
        </div>
      </article>`).join('');
    const warnings = result.warnings.map(warning => warning.message);
    const factorTypes = result.factorSummary.byType;
    const whiteFactors = [...result.factorSummary.whiteFactors]
      .sort((a, b) =>
        Number(b.occurrences) - Number(a.occurrences)
        || Number(b.totalStars) - Number(a.totalStars)
      )
      .slice(0, 10);
    output.innerHTML = `
      <div class="affinity-total">
        <strong>${result.complete ? result.rating : '—'} ${result.total}</strong>
        <span>基礎相性 ${result.breakdown.baseAffinity}＋共同 G1 ${result.breakdown.g1Bonus}</span>
        <small>${result.complete ? '兩親代與四祖代資料完整' : '資料未完整，總分僅供目前已填內容參考'}</small>
      </div>
      <div class="affinity-breakdown">
        ${result.baseAffinity.pairs.map(pair => `<article><span>${pair.label}</span><strong>${pair.score ?? '—'}</strong></article>`).join('')}
        ${result.g1Bonus.pairs.map(pair => `<article><span>${pair.label}</span><strong>+${pair.points}</strong><small>${pair.commonRaceCount} 場共同 G1</small></article>`).join('')}
      </div>
      <div class="family-factor-summary">
        <strong>現有家系因子覆蓋</strong>
        <span>固有 ${factorTypes.green.totalStars}★</span>
        <span>藍因子 ${factorTypes.blue.totalStars}★</span>
        <span>紅因子 ${factorTypes.red.totalStars}★</span>
        <span>白因子 ${factorTypes.white.totalStars}★</span>
        ${whiteFactors.map(factor =>
          `<small>${escapeHtml(factor.nameZhTw || localizedSkillName(factor.skillId))}：${factor.occurrences} 處／${factor.totalStars}★</small>`
        ).join('')}
      </div>
      ${warnings.length ? `<p class="guts-warning">${warnings.join(' ')}</p>` : ''}
      <p class="affinity-footnote">${result.assumptions.baseAffinity} ${result.assumptions.g1Bonus}</p>`;
  }

  targetSelect.onchange = () => {
    state.familyTargetAffinityKey = targetSelect.value;
    renderFamilyPlanner();
    renderSkillPlan();
    if (state.activePanel === 'deck') renderDeck();
    scheduleSave();
  };
  parentASelect.onchange = () => {
    state.familyParentBreederIds[0] = parentASelect.value || null;
    renderFamilyPlanner();
    renderSkillPlan();
    if (state.activePanel === 'deck') renderDeck();
    scheduleSave();
  };
  parentBSelect.onchange = () => {
    state.familyParentBreederIds[1] = parentBSelect.value || null;
    renderFamilyPlanner();
    renderSkillPlan();
    if (state.activePanel === 'deck') renderDeck();
    scheduleSave();
  };
  renderParentSubviewStatus();
}

function initAffinity() {
  const status = byId('affinityStatus');
  if (!affinity) {
    if (status) status.textContent = '相性資料未載入';
    return;
  }
  const options = affinity.names
    .map(name => `<option value="${name}">${localizedUmaName(name)}</option>`)
    .join('');
  byId('targetUma').innerHTML = options;
  byId('candidateUma').innerHTML = options;
  byId('candidateUma').selectedIndex = 1;
  const owned = inventory
    ? ` · ${inventory.summary.trainees} 衣裝／${inventory.summary.supportCards} 張已建檔 SSR/SR`
    : '';
  const assumed = plannerRules ? ' · R/SR 預設全持有' : '';
  const skillData = gameCatalog ? ` · GameTora ${gameCatalog.summary.skillsAvailable} 個繁中技能` : '';
  if (status) status.textContent = `已載入 ${affinity.names.length} 名角色${owned}${assumed}${skillData}`;
  byId('targetUma').onchange = updateAffinity;
  byId('candidateUma').onchange = updateAffinity;
  updateAffinity();
}

function allRaces() {
  return [...races, ...state.custom];
}

function selectSingleRace(index) {
  const race = allRaces()[index];
  if (!race) return false;
  const key = racePersistKey(race);
  const unchanged = state.selected.size === 1
    && state.selected.has(index)
    && state.primaryRaceKey === key;
  state.selected.clear();
  state.selected.add(index);
  state.primaryRaceKey = key;
  return !unchanged;
}

function restoredSingleRaceIndex(selectedRaceKeys = [], primaryRaceKey = '') {
  const list = allRaces();
  const indexForKey = key => list.findIndex(race => racePersistKey(race) === String(key || ''));
  const primaryIndex = indexForKey(primaryRaceKey);
  if (primaryIndex >= 0) return primaryIndex;
  for (const key of Array.isArray(selectedRaceKeys) ? selectedRaceKeys : []) {
    const index = indexForKey(key);
    if (index >= 0) return index;
  }
  if (currentRaceIndex >= 0 && list[currentRaceIndex]) return currentRaceIndex;
  return list.length ? 0 : -1;
}

function selectedRaces() {
  return [...state.selected].map(index => allRaces()[index]).filter(Boolean);
}

function restoreSelectedRaces() {
  if (!hasSavedPlanner) return;
  const restoredIndex = restoredSingleRaceIndex(
    savedPlannerState.selectedRaceKeys,
    savedPlannerState.primaryRaceKey
  );
  if (restoredIndex >= 0) selectSingleRace(restoredIndex);
  if (isCurrentProfileRace() && !savedProfileIdentityMatchesCurrent) {
    // A profile key can survive a seasonal migration.  Its old deck, parents,
    // selected accelerations and CM state must not be treated as Oi data.
    resetRaceDependentProfileState();
  }
  // Old Kyoto/CM localStorage must not keep a stale event mode when it falls
  // back to the current profile after the target-race migration.
  applyRaceEventMode(primaryRace());
}

const trackNames = {
  10001: '札幌',
  10002: '函館',
  10003: '新潟',
  10004: '福島',
  10005: '中山',
  10006: '東京',
  10007: '中京',
  10008: '京都',
  10009: '阪神',
  10010: '小倉',
  10101: '大井',
  10103: '川崎',
  10104: '船橋',
  10105: '盛岡',
  10201: '隆尚',
  10202: '聖塔安妮塔',
  10203: '沙烏地'
};
const surfaceLabels = { 1: '草地', 2: '泥地' };
const rotationLabels = { 0: '直線', 1: '順時針', 2: '逆時針' };
const seasonLabels = { 1: '春', 2: '夏', 3: '秋', 4: '冬' };
const timeLabels = { 1: '日', 2: '夕', 3: '夜', 4: '夜' };
const groundConditionLabels = { 1: '良', 2: '稍重', 3: '重', 4: '不良' };
const weatherLabels = { 1: '晴', 2: '陰', 3: '雨', 4: '雪' };

function findCourse(courseId) {
  const numeric = Number(courseId);
  for (const track of gameCatalog?.racetracks || []) {
    const course = (track.courses || []).find(item => Number(item.id) === numeric);
    if (course) return { ...course, trackId: Number(track.id) };
  }
  return null;
}

function distanceTypeFromMeters(meters) {
  const value = Number(meters);
  if (value <= 1400) return 1;
  if (value <= 1800) return 2;
  if (value <= 2400) return 3;
  return 4;
}

function distanceLabelFromMeters(meters) {
  return distanceLabels[distanceTypeFromMeters(meters)];
}

function raceFromCatalog(source) {
  const course = findCourse(source.courseId);
  const context = {
    ...(source.context || {}),
    always: 1,
    running_style: 1,
    ground_condition: 1,
    weather: 1
  };
  return {
    id: `catalog-${source.id}`,
    persistKey: `race:${source.id}`,
    catalogId: Number(source.id),
    gameToraRaceId: Number(source.id),
    courseId: Number(source.courseId),
    course,
    name: source.nameZhTw,
    surface: surfaceLabels[source.groundType] || '草地',
    distance: distanceLabels[source.distanceType] || distanceLabelFromMeters(source.distance),
    distanceMeters: Number(source.distance),
    style: STRATEGY,
    factor: `${trackNames[source.trackId] || `賽場 ${source.trackId}`}・${source.distance}m・${rotationLabels[source.rotation] || ''}・${seasonLabels[source.season] || ''}`,
    icon: '📍',
    context
  };
}

function initRaceBuilders() {
  const catalogSelect = byId('catalogRace');
  const trackSelect = byId('customTrack');
  const customDistance = byId('customDistance');
  const customMeters = byId('customMeters');
  const goalIntro = document.querySelector('#goal .panel-heading > p');
  if (goalIntro) goalIntro.textContent = '選擇一場目標賽事；技能、足耐與配卡都依這場賽事規劃。';
  const profileKicker = document.querySelector('#currentRaceProfile .profile-heading .kicker');
  if (profileKicker) profileKicker.textContent = '目前目標賽事';
  const libraryTitle = document.querySelector('.race-library > summary strong');
  if (libraryTitle) libraryTitle.textContent = '選擇正式賽事';
  const catalogButton = byId('addCatalogRace');
  if (catalogButton) catalogButton.textContent = '套用正式賽事';
  const customButton = byId('addCustom');
  if (customButton) customButton.textContent = '套用自訂賽事';
  if (catalogSelect) {
    catalogSelect.innerHTML = (gameCatalog?.races || [])
      .slice()
      .sort((a, b) =>
        Number(a.distance) - Number(b.distance)
        || String(a.nameZhTw).localeCompare(String(b.nameZhTw), 'zh-Hant')
      )
      .map(race =>
        `<option value="${race.id}">${race.nameZhTw}｜${trackNames[race.trackId] || race.trackId} ${race.distance}m・${surfaceLabels[race.groundType] || ''}</option>`
      ).join('');
  }
  if (trackSelect) {
    trackSelect.innerHTML = Object.entries(trackNames)
      .map(([id, name]) => `<option value="${id}" ${Number(id) === 10008 ? 'selected' : ''}>${name}</option>`)
      .join('');
  }
  if (customDistance && customMeters) {
    const representativeMeters = {
      短距離: 1200,
      一哩: 1600,
      中距離: 2000,
      長距離: 3200
    };
    customDistance.onchange = () => {
      customMeters.value = representativeMeters[customDistance.value] || 2000;
    };
    customMeters.oninput = () => {
      customDistance.value = distanceLabelFromMeters(customMeters.value);
    };
  }

  catalogButton.onclick = () => {
    const source = raceById.get(Number(catalogSelect.value));
    if (!source) return;
    const key = `race:${source.id}`;
    let index = allRaces().findIndex(race => racePersistKey(race) === key);
    if (index < 0) {
      state.custom.push(raceFromCatalog(source));
      index = allRaces().length - 1;
    }
    const changed = selectSingleRace(index);
    if (!changed) return;
    cachedRaceStrategyKey = '';
    cachedCourseImpactKey = '';
    renderRaces();
    updateGoalHint();
    refreshRaceDependentViews();
    scheduleSave();
  };
}

function dominantDistance() {
  return primaryRace()?.distance || '中距離';
}

function renderRaces() {
  const grid = byId('raceGrid');
  const focusedRace = document.activeElement?.closest?.('[data-race-key]');
  const focusedRaceKey = grid.contains(focusedRace) ? focusedRace.dataset.raceKey : '';
  let replacementFocusTarget = null;
  grid.innerHTML = '';
  allRaces().forEach((race, index) => {
    const template = byId('raceTemplate').content.cloneNode(true);
    const button = template.querySelector('button');
    const raceKey = racePersistKey(race);
    const selected = state.selected.has(index);
    const primary = selected && raceKey === state.primaryRaceKey;
    button.classList.toggle('selected', selected);
    button.classList.toggle('primary-target', primary);
    button.setAttribute('aria-pressed', String(selected));
    button.dataset.raceKey = raceKey;
    button.classList.toggle('race-card--projected', race.scheduleStatus === 'PROJECTED_FROM_JP_VERSION');
    button.dataset.eventMode = race.eventMode || '';
    button.querySelector('.race-icon').textContent = race.icon || String(race.eventMode || '賽事').toUpperCase();
    button.querySelector('.race-name').textContent = race.name;
    const trackLabel = race.trackNameZhTw || trackNames[Number(race.trackId)] || '';
    const meters = Number(race.distanceMeters ?? race.context?.course_distance);
    button.querySelector('.race-meta').textContent = [
      trackLabel,
      `${race.surface}${Number.isFinite(meters) ? ` ${meters}m` : ''}`,
      race.distance
    ].filter(Boolean).join('・');
    const conditionLabel = String(race.conditionLabel || race.factor || '')
      .split('・')
      .filter(part => part && part !== trackLabel && part !== `${meters}m`)
      .join('・');
    const actionText = primary ? '目前目標' : '切換目標';
    const scheduleLabel = race.scheduleStatus === 'OFFICIAL_TW_CONFIRMED'
      ? `繁中官方・${race.phaseLabel || '條件已確認'}`
      : race.scheduleStatus === 'PROJECTED_FROM_JP_VERSION'
      ? race.phaseLabel || '同版本預排'
      : race.current ? '預設規劃範本' : '';
    button.querySelector('.race-tags').textContent = [scheduleLabel, conditionLabel, actionText]
      .filter(Boolean).join('　｜　');
    button.setAttribute('aria-label', `${race.name}，${actionText}`);
    button.onclick = () => {
      if (!selectSingleRace(index)) return;
      applyRaceEventMode(primaryRace());
      renderRaces();
      updateGoalHint();
      refreshRaceDependentViews();
      scheduleSave();
    };
    if (raceKey === focusedRaceKey) replacementFocusTarget = button;
    grid.append(template);
  });
  if (replacementFocusTarget) {
    requestAnimationFrame(() => replacementFocusTarget.focus({ preventScroll: true }));
  }
}

function updateGoalHint() {
  const race = primaryRace();
  const hasConditions = Boolean(gameCatalog && skillCore && race?.context);
  const hasCurrent = Boolean(race?.current);
  const deckHint = hasCurrent
    ? `；戰馬骨架為${expectedBattleDeckTypes()
      .map(type => supportTypeLabels[type] || type).join('／')}`
    : '';
  byId('goalHint').textContent = race
    ? `目前目標：${race.name || race.nameZhTw}。固定只計算${STRATEGY}；先判定足耐，再排有效加速與速度／接續${hasConditions ? '；技能條件資料已就緒' : ''}${deckHint}`
    : '請選擇一場目標賽事';
}

function renderCurrentRaceProfile() {
  const panel = byId('currentRaceProfile');
  const race = primaryRace();
  const strategy = activeRaceStrategy();
  if (!race || !strategy) {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;
  const context = strategy.context || {};
  byId('currentRaceTitle').textContent = race.name || race.nameZhTw || '目前分析賽事';
  byId('currentRaceConditions').textContent = [
    surfaceLabels[context.ground_type],
    distanceLabels[context.distance_type],
    context.course_distance ? `${context.course_distance}m` : '',
    rotationLabels[context.rotation],
    seasonLabels[context.season],
    timeLabels[context.time],
    context.ground_condition == null && race?.randomConditions?.groundCondition === 'Random'
      ? '場地：隨機'
      : groundConditionLabels[context.ground_condition],
    context.weather == null && race?.randomConditions?.weather === 'Random'
      ? '天候：隨機'
      : weatherLabels[context.weather],
    STRATEGY
  ].filter(Boolean).join('・');
  const deckTypes = expectedBattleDeckTypes();
  byId('battleDeckTypeChips').innerHTML = deckTypes
    .map((type, index) => `<span>${index + 1}. ${supportTypeLabels[type] || type}</span>`)
    .join('');
  const staticSkills = (strategy.staticSkillIds || [])
    .map(id => skillById.get(Number(id)))
    .filter(Boolean);
  byId('staticCourseSkillChips').innerHTML =
    staticSkills.map(skill => `<span>${localizedSkillName(skill)}</span>`).join('');
  const impactTable = activeCourseAccelerationTable();
  const topImpact = impactTable?.families?.find(item => item.actionable);
  const sourceLabel = impactTable?.source?.includes('utools')
    ? 'U-tools 馬身校正＋繁中服技能過濾'
    : '本地賽道幾何估算';
  const snapshotDate = gameCatalog?.metadata?.asOf || '日期未確認';
  const scheduleNote = race.scheduleStatus === 'OFFICIAL_TW_CONFIRMED'
    ? `繁中官方已確認${race.phaseLabel ? `（${race.phaseLabel}）` : ''}。`
    : race.scheduleStatus === 'PROJECTED_FROM_JP_VERSION'
    ? '日服同版本預排，繁中服日期與條件待官方確認。'
    : race.current ? '預設規劃範本，尚未確認為繁中服當期活動。' : '';
  byId('currentRaceStatus').textContent =
    `${scheduleNote}資料快照：${snapshotDate}。固定作戰：${STRATEGY}。已先建立 ${context.course_distance || '自訂'}m 賽道時間軸，`
    + `再用${sourceLabel}排序有效加速`
    + `${topImpact ? `；目前最高為「${topImpact.name}」約 ${topImpact.expectedBashin.toFixed(2)} 馬身` : ''}。`;
  if (race.scheduleStatus === 'OFFICIAL_TW_CONFIRMED' && race.officialEvidence?.sourceUrl) {
    const link = document.createElement('a');
    link.href = race.officialEvidence.sourceUrl;
    link.textContent = ' 查看官方公告';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    byId('currentRaceStatus').append(link);
  }
}

function refreshRaceDependentViews() {
  state.main = null;
  state.sub = null;
  state.deckPackageId = null;
  state.deckPackageModelVersion = 0;
  state.battleOwnedCardsConfirmed = false;
  state.battleDeckCardIds[5] = null;
  state.battleDeckBorrowedIndex = 5;
  state.parentSelectionPackageId = null;
  state.familyTargetAffinityKey = '';
  state.familyParentBreederIds = [null, null];
  state.checklist = {};
  [byId('factorReadyCheck'), byId('skillPointCheck')]
    .filter(Boolean)
    .forEach(input => { input.checked = false; });
  resetGuidedDownstreamAfterParentChange();
  cachedRaceStrategy = null;
  cachedRaceStrategyKey = '';
  cachedCourseImpact = null;
  cachedCourseImpactKey = '';
  cachedDeckOptimization = null;
  cachedDeckOptimizationKey = '';
  raceDerivedViewsDirty = true;
  renderCurrentRaceProfile();
}

function hydrateRaceDependentViews() {
  if (!raceDerivedViewsDirty) return false;
  initStrategyControls();
  raceDerivedViewsDirty = false;
  return true;
}

function renderParents() {
  renderFactorGuide();
  const selected = selectedRaces();
  const distance = dominantDistance();
  const strategy = activeRaceStrategy();
  const options = eligibleParentCandidates();
  syncRecommendedParents();
  byId('targetSummary').innerHTML = selected.length
    ? selected.map(race => `<span class="target-chip">${escapeHtml(race.name)} · ${escapeHtml(race.distance)} · ${STRATEGY}</span>`).join('')
    : `<span class="target-chip">尚未選賽事，先以${STRATEGY}示範</span>`;

  ['mainParents', 'subParents'].forEach((id, column) => {
    const key = column ? 'sub' : 'main';
    const recommendedIds = new Set(modeParentPlan().directIds.map(Number));
    byId(id).innerHTML = options.map((parent, index) => {
      const value = Number(parent.skillId || parent.outfitId || index);
      const recommended = recommendedIds.has(value);
      return `
      <label class="parent-option">
        <input type="radio" name="${id}" value="${value}" ${Number(state[key]) === value ? 'checked' : ''}>
        ${traineePortraitMarkup(parent, 'parent-option-portrait')}
        <span>
          <strong>${parent.name}${parent.outfit ? ` ${parent.outfit}` : ''}${recommended ? '・建議' : ''}</strong>
          <small>${parent.detail}${parent.outfitId ? '｜已持有' : ''}</small>
        </span>
      </label>`;
    }).join('');
    byId(id).querySelectorAll('input').forEach(input => {
      input.onchange = () => {
        if (applyParentSelection(key, input.value, options)) {
          rerenderParentDependentViews();
        }
      };
    });
  });

  const main = options.find(parent => Number(parent.skillId || parent.outfitId) === Number(state.main));
  const sub = options.find(parent => Number(parent.skillId || parent.outfitId) === Number(state.sub));
  const target = selectedBattleUmaCard();
  const mode = selectedInheritanceMode();
  const eventLabel = state.eventMode === 'loh' ? '英雄聯盟' : '月賽／冠軍盃';
  const targetHasMainAcceleration = target?.catalogBuiltInSkillIds?.some(id =>
    usefulAccelerationCandidates().some(candidate =>
      (candidate.familyIds || [candidate.id]).map(Number).includes(Number(id))));
  let message = hasActiveProfileStrategy(strategy)
    ? `${eventLabel}・${mode?.label || '目前方案'}。白北部玄駒的吉兆驚天大放送！提供 1～3 名穩定；普通青雲天空的釣魚×計謀只在第 1 名時提高上限。舞會千代王與泳裝速子僅作備案／連接。`
    : `${eventLabel}・${mode?.label || '目前方案'}。候選已依本賽事距離、領頭適性與固有技能靜態條件重新排序；仍應以終盤加速時間窗為第一判斷。`;
  if (main && sub) {
    message += Number(main.characterId) === Number(sub.characterId)
      ? ' 目前兩邊選到同角色，請改成不同角色。'
      : ` 目前建議固有：${main.name}「${localizedSkillName(main.skillId)}」＋`
        + `${sub.name}「${localizedSkillName(sub.skillId)}」。`;
  }
  if (!target) {
    message += ' 尚未指定戰馬，因此目前按一般領頭計算；選定衣裝後會排除同角色並扣掉本體技能。';
  } else {
    message += ` 已排除與戰馬「${target.nameZhTw}」相同角色的固有方向。`;
    if (targetHasMainAcceleration) message += ' 此衣裝自帶主加速，親代槽可更積極轉向中盤或回復。';
  }
  byId('parentAdvice').innerHTML = `<strong>固有方向提示：</strong>${message}`;

  const ancestorContainer = byId('ancestorPlan');
  if (ancestorContainer) {
    const selectedDirect = new Set([Number(state.main), Number(state.sub)]);
    const ancestors = modeParentPlan().ancestorIds
      .map(parentBySkillId)
      .filter(parent => parent && !selectedDirect.has(Number(parent.skillId)));
    ancestorContainer.innerHTML = ancestors.length
      ? ancestors.map(parent => `
        <span class="ancestor-chip">
          <strong>${parent.name} ${parent.outfit || ''}</strong>
          ${localizedSkillName(parent.skillId)}｜祖代抽選，不當成確定取得
        </span>`).join('')
      : '<span class="ancestor-chip">直接親代已使用目前候選；祖代優先補中盤速度、3.5% 回復或未帶的副加速。</span>';
  }
  renderParentSubviewStatus();
  renderGoalContractChain();
}

function coverageNames(card) {
  return [...new Set(card?.coverageSkillIds || [])]
    .map(localizedSkillName)
    .filter(Boolean);
}

function guidedBreedingPlan() {
  const accelerations = breedingAccelerationCandidates();
  const greens = recommendedRouteGreens();
  return {
    formula: '有效加速依剩餘預期馬身排序，且一律優先於三種固定綠技；其餘卡位才補面板。',
    categories: [
      {
        id: 'guided-acceleration',
        label: '有效加速',
        weight: 10000,
        skills: accelerations
          .slice()
          .sort((a, b) =>
            Number(b.need?.residualWeight || 0) - Number(a.need?.residualWeight || 0)
          )
          .map(candidate => ({
          id: Number(candidate.factorId || candidate.id),
          familyIds: candidate.familyIds,
          sourceSkillId: Number(candidate.id),
          sourceKind: candidate.sourceKind,
          deckEligible: candidate.sourceKind !== 'parent-unique',
          weight: 10000 + Math.round(Number(candidate.need?.residualWeight || 0) * 1000),
          activationWindow: candidate.activationWindow,
          evidence: [
            candidate.reason,
            `戰馬與六卡後仍有 ${Number(candidate.need?.residualWeight || 0).toFixed(2)} 馬身權重`,
            accelerationAcquisitionText(candidate)
          ].filter(Boolean)
        }))
      },
      {
        id: 'guided-green',
        label: '三種固定綠技',
        weight: 1000,
        skills: greens.map((green, index) => ({
          id: Number(green.factorId || green.id),
          familyIds: green.familyIds,
          sourceSkillId: Number(green.id),
          weight: 1000 - index * 25,
          activationWindow: '全程固定',
          evidence: [green.reason, green.effectLabel].filter(Boolean)
        }))
      }
    ]
  };
}

function routeCoverageCard(result, targetId) {
  return (result?.deck || []).find(card =>
    (card.coverageSkillIds || []).some(id => Number(id) === Number(targetId))
  ) || null;
}

function routeCardText(card) {
  if (!card) return '';
  const labels = localizedSupportLabels(card);
  const type = supportTypeLabels[normalizeSupportType(card.supportType)] || normalizeSupportType(card.supportType);
  return `${card.borrowed ? '借卡' : '自有卡'}：${type}・${labels.name}`;
}

function renderBreederRoute(result) {
  const accelerationContainer = byId('routeAccelerationTargets');
  const greenContainer = byId('routeGreenTargets');
  const panelContainer = byId('routePanelTargets');
  if (!accelerationContainer || !greenContainer || !panelContainer) return;

  const accelerations = selectedAccelerationCandidates();
  const planningSnapshot = activePlanningSnapshot();
  accelerationContainer.innerHTML = accelerations.length
    ? accelerations.map(candidate => {
      const targetId = Number(candidate.factorId || candidate.id);
      const need = planningSnapshot?.rows?.find(row =>
        Number(row.familyId) === Number(candidate.familyId)
      );
      const coverageProbability = Number(need?.coverageProbability) || 0;
      const residualWeight = Number(need?.residualWeight) || 0;
      const coveredByBattleDeck = coverageProbability >= 0.999;
      const parentSelected = candidate.sourceKind === 'parent-unique'
        && [state.main, state.sub].some(id => Number(id) === Number(candidate.id));
      const card = coveredByBattleDeck || candidate.sourceKind === 'parent-unique'
        ? null
        : routeCoverageCard(result, targetId);
      const stateName = coveredByBattleDeck || parentSelected || card ? 'covered' : 'missing';
      const coverageText = coverageProbability > 0
        ? `目前戰馬與六卡的取得代理覆蓋 ${Math.round(coverageProbability * 100)}%，馬身權重 ${residualWeight.toFixed(2)}`
        : `目前戰馬與六卡尚未覆蓋，馬身權重 ${residualWeight.toFixed(2)}`;
      const status = coveredByBattleDeck
        ? '戰馬本體或直接取得路線已完整覆蓋；不占用種馬因子路線'
        : candidate.sourceKind === 'parent-unique'
          ? parentSelected
            ? '已指定為直接親代固有'
            : '需在進階工具指定對應直接親代'
          : card
            ? `${routeCardText(card)}；用來育成此白因子`
            : '種馬配卡未覆蓋，需靠白因子或既有種馬';
      const detail = [
        `賽道單技能參考 +${Number(candidate.expectedBashin || 0).toFixed(2)} 馬身`,
        coverageText,
        coveredByBattleDeck
          ? (need?.coverageRoutes || []).map(route => route.label).join('、')
          : accelerationAcquisitionText(candidate)
      ].filter(Boolean).join('；');
      return `
        <article class="route-target" data-state="${stateName}" data-skill-id="${candidate.id}">
          <span>${escapeHtml(candidate.priority)}</span>
          <strong>${escapeHtml(candidate.factorName || candidate.name)}</strong>
          <p>${escapeHtml(detail)}</p>
          <small>${escapeHtml(status)}</small>
        </article>`;
    }).join('')
    : usefulAccelerationCandidates().length
      ? '<article class="route-target" data-state="covered"><strong>戰馬本體已覆蓋有效加速</strong><p>不必再為同家族加速占用種馬卡位。</p></article>'
      : '<article class="route-target" data-state="missing"><strong>本場沒有已解析的有效加速候選</strong><p>先以三種綠技與面板育成；需要時再從進階技能表人工補充。</p></article>';

  const greens = recommendedRouteGreens();
  greenContainer.innerHTML = greens.map((green, index) => {
    const targetId = Number(green.factorId || green.id);
    const card = routeCoverageCard(result, targetId);
    const source = bestFactorSourceText(targetId);
    return `
      <article class="route-target" data-state="${card ? 'covered' : 'missing'}" data-skill-id="${green.id}">
        <span>第 ${index + 1} 種</span>
        <strong>${escapeHtml(green.name)}</strong>
        <p>${escapeHtml(green.effectLabel || green.reason)}</p>
        <small>${escapeHtml(card ? routeCardText(card) : source ? `育成來源：${source}` : '需由白因子或可取得此技能的育成補上')}</small>
      </article>`;
  }).join('');

  const distanceType = Number(activeRaceStrategy()?.context?.distance_type || 3);
  const distancePanel = distanceType === 4
    ? '長距離以耐力面板為首要缺口'
    : distanceType <= 2
      ? '短距離／一哩以速度與力量面板為主'
      : '中距離兼顧速度、耐力與力量';
  panelContainer.innerHTML = [
    ['硬條件', '至少 1 張速度支援卡'],
    ['距離方向', distancePanel],
    ['穩定取得技能', '以智慧或團體卡補技能點、體力與育成穩定度'],
    ['模型界線', '此處的種馬配卡仍用卡型、稀有度、等級與突破代理面板；未宣稱完整數值最優']
  ].map(([label, text]) => `
    <article class="route-target">
      <span>${label}</span>
      <strong>${text}</strong>
    </article>`).join('');
}

function renderDeck() {
  syncRecommendedParents();
  const distance = dominantDistance();
  const strategy = activeRaceStrategy();
  const race = primaryRace();
  const data = hasActiveProfileStrategy(strategy)
    ? {
      title: `${race?.name || currentRaceProfile?.name || '本場'} 領頭種馬：依未覆蓋因子反推`,
      notes: [
        `理論育成主案：${expectedBattleDeckTemplate().label}；手動自配會另行比較實際卡片、技能與面板差異。`,
        '天候／場地狀態為隨機，不把晴天、良場或重場寫成固定配卡條件。',
        '除劇本必帶 30241 外，五格交由 optimizer 依戰馬、持有卡與技能覆蓋決定。'
      ]
    }
    : {
      title: `${race?.name || race?.nameZhTw || '本次賽事'}領頭種馬：依未覆蓋因子反推`,
      notes: [
        '技能清單已依本賽道條件重新產生，不沿用其他賽道的固定推薦',
        '借卡優先補目前最高權重且五張自有卡未覆蓋的技能',
        '若自動選到低等卡，可接受較低覆蓋率並手動改用高等速度卡'
      ]
    };
  const breedingPlan = guidedBreedingPlan();
  const cardBonuses = Object.fromEntries(
    (hasActiveProfileStrategy(strategy) ? (jpStrategy?.factorSupportPreferences || []) : [])
      .map(item => [Number(item.supportId), Number(item.bonus) || 0])
  );
  const result = typeof plannerCore.buildSkillDrivenBreedingDeck === 'function'
    ? plannerCore.buildSkillDrivenBreedingDeck(
      inventory,
      plannerRules,
      breedingPlan,
      gameCatalog,
      {
        preferredTypes: expectedBattleDeckTypes(),
        preferTypeBeforeStrength: true,
        cardBonuses,
        scenario: activeBattleScenario(),
        battleUma: selectedBattleUmaCard(),
        server: 'zh_tw'
      }
    )
    : plannerCore.buildBreedingDeck(
      inventory,
      plannerRules,
      ['Speed', 'Stamina', 'Wisdom', 'Group', 'Power'],
      gameCatalog,
      { scenario: activeBattleScenario(), battleUma: selectedBattleUmaCard(), server: 'zh_tw' }
    );

  const factorScenarioIds = scenarioRequiredSupportIds();
  const factorScenarioCards = (result.deck || []).filter(card =>
    factorScenarioIds.includes(Number(card.id))
  );
  const factorScenarioStatus = factorScenarioIds.length
    ? factorScenarioCards.length === 1
      ? factorScenarioCards[0].borrowed
        ? `劇本必帶：借卡・滿突 Lv${factorScenarioCards[0].level || 50}`
        : `劇本必帶：自有・Lv${factorScenarioCards[0].level || '?'}／${factorScenarioCards[0].limitBreak || 0}突`
      : `劇本卡不足：需要精確 ID ${factorScenarioIds.join(', ')}`
    : '';
  renderBreederRoute(result);
  renderReverseLineagePlan();

  byId('deckCards').innerHTML = result.deck.map(card => {
    const type = supportTypeLabels[card.supportType] || card.supportType;
    const labels = localizedSupportLabels(card);
    const detail = card.borrowed
      ? '可借任意一張'
      : card.assumedOwned
        ? '預設持有 R/SR'
        : `Lv${card.level} · ${card.limitBreak}突`;
    const skills = coverageNames(card);
    return `
      <article class="support-card ${card.borrowed ? 'borrowed' : ''}" data-support-card-id="${Number(card.id) || ''}" data-ownership="${card.borrowed ? 'borrowed' : 'owned'}" style="--card:${supportTypeColors[card.supportType] || '#716b82'}">
        <p class="support-type">${type} SUPPORT</p>
        <h4>${labels.name}</h4>
        <small>${labels.title}</small>
        ${factorScenarioIds.includes(Number(card.id)) ? '<span class="scenario-entry-badge">劇本必帶</span>' : ''}
        <span class="slot-kind">${card.borrowed ? '借用卡位' : `自有 · ${detail}`}</span>
        <p class="card-coverage">${skills.length ? `負責：${skills.join('、')}` : '補育成強度／尚未覆蓋到目標技能'}</p>
      </article>`;
  }).join('');

  byId('trainingTitle').textContent = data.title;
  const coverage = result.coverage || {};
  const lowLevelCards = result.deck.filter(card =>
    !card.borrowed
    && Number.isFinite(Number(card.level))
    && Number(card.level) < 30
  );
  byId('trainingNotes').innerHTML = [
    ...(factorScenarioStatus ? [factorScenarioStatus] : []),
    `目前種馬六卡覆蓋 ${coverage.coveredSkillIds?.length || 0} 個「有效加速＋三綠」目標；加權覆蓋率 ${coverage.percentage ?? 0}%。`,
    '配卡先搶有效加速，再補三種固定綠技；剩餘卡位才依距離卡型與本地卡片代理強度補面板。',
    ...(lowLevelCards.length ? [
      `養成提醒：${lowLevelCards.map(card => `${localizedSupportLabels(card).name} Lv${card.level}`).join('、')} 是為技能覆蓋入選；若訓練不穩，應換高等速度卡並接受部分覆蓋率下降。`
    ] : ['滿突支援效果資料已建入借卡排序；此處的種馬六卡尚未套用全組合面板最佳化。'])
  ].map(note => `<li>${note}</li>`).join('');

  const ruleLabel = byId('deckRuleCheck');
  ruleLabel.className = result.validation.valid ? 'rule-valid' : 'rule-invalid';
  ruleLabel.querySelector('input').checked = result.validation.valid;
  ruleLabel.childNodes[1].textContent = result.validation.valid
    ? ' 5 張自有＋1 張借用，且已含速度卡'
    : ` ${result.validation.violations.join('、')}`;
  const coveragePercent = Math.round(Number(coverage.percentage) || 0);
  byId('planScore').textContent = `${coveragePercent}%`;
  if (byId('deckSummaryValidity')) {
    byId('deckSummaryValidity').textContent = result.validation.valid ? '配卡有效' : '需要修正';
    byId('deckSummaryValidity').dataset.state = result.validation.valid ? 'valid' : 'invalid';
  }
  if (byId('deckSummaryOwnership')) {
    byId('deckSummaryOwnership').textContent = `${result.validation.ownedCount} 自有＋${result.validation.borrowedCount} 借用`;
  }
  if (byId('deckSummarySpeed')) {
    byId('deckSummarySpeed').textContent = `${result.validation.speedCount} 張`;
  }
  if (byId('deckSummaryCoverage')) {
    byId('deckSummaryCoverage').textContent = `${coveragePercent}%`;
  }
}

function renderParentSubviewStatus() {
  const factorCount = activeFactorPlan().categories
    .flatMap(category => category.skills || []).length;
  const validation = battleDeckValidation();
  const selectedParentCount = [state.main, state.sub].filter(hasSelectedParentId).length;
  const selectedFamilyCount = state.familyParentBreederIds.filter(Boolean).length;
  if (byId('parentNavStrategyStatus')) {
    byId('parentNavStrategyStatus').textContent = `${factorCount} 個因子候選・先看結論`;
  }
  if (byId('parentNavBattleStatus')) {
    const target = selectedBattleUmaCard();
    byId('parentNavBattleStatus').textContent = !validation.valid
      ? '六卡需要修正'
      : !target
        ? '戰馬未指定・六卡已備妥'
        : `六卡有效・速度卡 ${validation.speedCount} 張`;
  }
  if (byId('parentNavParentsStatus')) {
    byId('parentNavParentsStatus').textContent = `已選 ${selectedParentCount}/2 個固有方向`;
  }
  if (byId('parentNavLibraryStatus')) {
    byId('parentNavLibraryStatus').textContent = breeders.length
      ? `${breeders.length} 筆紀錄・家系 ${selectedFamilyCount}/2`
      : '選填・尚無種馬紀錄';
  }
}

function renderParentSubviewNavigation() {
  if (!PARENT_SUBVIEWS.includes(state.parentSubview)) state.parentSubview = 'strategy';
  document.querySelectorAll('.parent-subview').forEach(section => {
    const selected = section.dataset.parentView === state.parentSubview;
    section.hidden = !selected;
    section.setAttribute('aria-hidden', String(!selected));
  });
  document.querySelectorAll('[role="tab"][data-parent-view-target]').forEach(tab => {
    const selected = tab.dataset.parentViewTarget === state.parentSubview;
    tab.classList.toggle('active', selected);
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  renderParentSubviewStatus();
}

function setParentSubview(view, options = {}) {
  if (!PARENT_SUBVIEWS.includes(view)) return;
  state.parentSubview = view;
  renderParentSubviewNavigation();
  if (options.focusTab) {
    document.querySelector(`[role="tab"][data-parent-view-target="${view}"]`)?.focus();
  }
  if (options.scroll) {
    document.querySelector('.parent-subflow')?.scrollIntoView({
      behavior: preferredScrollBehavior(),
      block: 'start'
    });
  }
  scheduleSave();
}

function initParentSubviewNavigation() {
  const controls = [...document.querySelectorAll('[data-parent-view-target]')];
  controls.forEach(control => {
    control.onclick = () => setParentSubview(control.dataset.parentViewTarget, {
      scroll: true,
      focusTab: true
    });
  });
  const tabs = controls.filter(control => control.getAttribute('role') === 'tab');
  tabs.forEach((tab, index) => {
    tab.onkeydown = event => {
      let nextIndex = null;
      if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
      if (event.key === 'Home') nextIndex = 0;
      if (event.key === 'End') nextIndex = tabs.length - 1;
      if (nextIndex === null) return;
      event.preventDefault();
      setParentSubview(tabs[nextIndex].dataset.parentViewTarget, { focusTab: true });
    };
  });
  renderParentSubviewNavigation();
}

function showPanel(id, options = {}) {
  const manualLineageEntry = id === 'deck' && options.manualLineageEntry === true;
  // A stale Step 2 cannot establish Step 3 readiness. Route it through the
  // demand-driven Step 2 hydration first instead of evaluating hidden views.
  if (id === 'deck' && raceDerivedViewsDirty && !manualLineageEntry) id = 'parents';
  if (id === 'deck' && !manualLineageEntry && !renderGuidedProgress().ready) id = 'parents';
  const hydratedRaceDerivedViews = id === 'parents' && hydrateRaceDependentViews();
  state.activePanel = id;
  document.querySelectorAll('.panel')
    .forEach(panel => panel.classList.toggle('shown', panel.id === id));
  document.querySelectorAll('.step')
    .forEach(step => {
      const selected = step.dataset.step === id;
      step.classList.toggle('active', selected);
      if (selected) step.setAttribute('aria-current', 'step');
      else step.removeAttribute('aria-current');
    });
  document.querySelectorAll('.progress-dot')
    .forEach((dot, index) => dot.classList.toggle('active', index <= ['goal', 'parents', 'deck'].indexOf(id)));
  if (id === 'parents') {
    if (!hydratedRaceDerivedViews) {
      if (selectedBattleUmaCard()) {
        renderGuidedAccelerationFlow({ deckPending: true });
        renderGuidedDeckPending();
      }
      else renderGuidedAccelerationFlow();
    }
    renderSkillPlan();
    if (peekActiveDeckOptimization() || !selectedBattleUmaCard()) renderParents();
    renderBattleDeckEditor();
    renderFamilyPlanner();
    renderParentSubviewNavigation();
    renderGuidedProgress();
  }
  if (id === 'deck') {
    if (manualLineageEntry) renderManualLineageWorkbench(buildActiveReverseLineagePlan());
    else renderDeck();
  }
  window.scrollTo({ top: 0, behavior: preferredScrollBehavior() });
  if (manualLineageEntry) {
    // Direct entry must reveal the workbench even inside collapsed disclosures.
    for (let ancestor = byId('manualLineageWorkbench')?.parentElement; ancestor; ancestor = ancestor.parentElement) {
      if (ancestor.tagName === 'DETAILS') ancestor.open = true;
    }
    requestAnimationFrame(() => byId('manualLineageWorkbench')?.scrollIntoView({
      behavior: preferredScrollBehavior(),
      block: 'start'
    }));
  }
  if (options.focusHeading) {
    requestAnimationFrame(() => byId(id)?.querySelector('.panel-heading h2')?.focus());
  }
  scheduleSave();
}

window.addEventListener('prettyderby:planner-entry', event => {
  if (event.detail?.entry !== 'manual-lineage') return;
  showPanel('deck', { manualLineageEntry: true, focusHeading: false });
});

document.querySelectorAll('[data-next]')
  .forEach(button => button.onclick = () => showPanel(button.dataset.next, { focusHeading: true }));
document.querySelectorAll('[data-prev]')
  .forEach(button => button.onclick = () => showPanel(button.dataset.prev, { focusHeading: true }));
document.querySelectorAll('.step')
  .forEach(button => button.onclick = () => showPanel(button.dataset.step));

byId('addCustom').onclick = () => {
  const meters = Number(byId('customMeters').value) || 2000;
  const distanceType = distanceTypeFromMeters(meters);
  const trackId = Number(byId('customTrack').value) || 10008;
  const groundType = byId('customSurface').value === '泥地' ? 2 : 1;
  const rotation = Number(byId('customRotation').value);
  const season = Number(byId('customSeason').value);
  const groundCondition = Number(byId('customGroundCondition').value);
  const weather = Number(byId('customWeather').value);
  const id = persistenceCore?.createId('custom-race') || `custom-${Date.now()}`;
  state.custom.push({
    id,
    persistKey: `custom:${id}`,
    name: byId('customRaceName').value.trim() || '自訂賽事',
    surface: byId('customSurface').value,
    distance: distanceLabels[distanceType],
    distanceMeters: meters,
    style: STRATEGY,
    factor: `${trackNames[trackId] || `賽場 ${trackId}`}・${meters}m・${rotationLabels[rotation]}・${seasonLabels[season]}・${groundConditionLabels[groundCondition]}・${weatherLabels[weather]}`,
    icon: '✨',
    context: {
      always: 1,
      course_distance: meters,
      distance_type: distanceType,
      ground_type: groundType,
      rotation,
      season,
      ground_condition: groundCondition,
      weather,
      track_id: trackId,
      is_basis_distance: meters % 400 === 0 ? 1 : 0,
      running_style: 1
    }
  });
  selectSingleRace(allRaces().length - 1);
  cachedRaceStrategyKey = '';
  cachedCourseImpactKey = '';
  renderRaces();
  updateGoalHint();
  refreshRaceDependentViews();
  scheduleSave();
};

byId('reset').onclick = () => {
  state.custom = [];
  selectSingleRace(currentRaceIndex);
  state.main = null;
  state.sub = null;
  state.parentSelectionPackageId = null;
  state.battleUmaOutfitId = null;
  state.scenarioId = defaultBattleScenarioId;
  state.selectedAccelerationSkillIds = [];
  state.residualFactorDecisionConfirmed = false;
  state.battleOwnedCardsConfirmed = false;
  state.eventMode = currentRaceProfile?.eventMode || 'cm';
  state.inheritanceMode = 'balanced';
  state.breedingAutomationMode = 'autonomous';
  state.factorSpecificationEnabled = true;
  state.applyBattleDeckCoverage = true;
  state.parentSubview = 'strategy';
  guidedOpenStage = null;
  guidedLastCurrentStage = null;
  state.battleDeckCardIds = [...recommendedBattleDeckIds].slice(0, 6);
  state.battleDeckBorrowedIndex = recommendedBattleDeckBorrowedIndex;
  if (!shouldKeepTypesOnlyBattleDeckEmpty()) normalizeBattleDeckForGuidedFlow();
  state.familyTargetAffinityKey = '';
  state.familyParentBreederIds = [null, null];
  state.lineageBreederRecordBindings = {};
  state.manualLineage = defaultManualLineageState();
  state.factorExecution = defaultFactorExecutionState();
  state.checklist = {};
  state.stamina = {};
  byId('factorReadyCheck').checked = false;
  byId('skillPointCheck').checked = false;
  const resetStaminaTier = activeStaminaModel()?.tiers?.find(tier => tier.id === 'standard')
    || activeStaminaModel()?.tiers?.[0]
    || {};
  Object.entries({
    expectedSpeed: 1700,
    expectedStamina: Number(resetStaminaTier.stamina) || 1200,
    expectedPower: 1200,
    expectedGuts: 1200,
    expectedWisdom: 1200,
    simMood: 2,
    simDistanceAptitude: 'S',
    reliableGoldRecoveryCount: Number(resetStaminaTier.goldRecovery) || 0,
    inheritedRecoveryCount: Number(resetStaminaTier.inheritedRecovery35) || 0,
    simKakariSeconds: 0,
    simSpotSeconds: 0,
    simDownhillPercent: 0,
    simDebuffPercent: 0,
    simSpeedBonus: 0
  }).forEach(([id, value]) => {
    if (byId(id)) byId(id).value = value;
  });
  byId('hasKyotoGreen').checked = false;
  byId('hasBasisGreen').checked = false;
  cachedRaceStrategyKey = '';
  cachedCourseImpactKey = '';
  cachedDeckOptimizationKey = '';
  cachedDeckOptimization = null;
  raceDerivedViewsDirty = false;
  initStrategyControls();
  initReverseLineageControls();
  renderBattleDeckEditor();
  renderFamilyPlanner();
  syncRecommendedParents(true);
  renderRaces();
  updateGoalHint();
  renderCurrentRaceProfile();
  showPanel('goal');
  persistPlanner();
};

restoreSelectedRaces();
initRaceBuilders();
renderRaces();
updateGoalHint();
initAffinity();
initBreederDatabase();
initStrategyControls();
initReverseLineageControls();
initManualLineageWorkbench();
initParentSubviewNavigation();
initGuidedWorkbench();
bindStaminaEstimator();
renderBattleDeckEditor();
if (peekActiveDeckOptimization()) syncRecommendedParents(!hasSavedPlanner);
renderCurrentRaceProfile();
byId('resetBattleDeck').onclick = resetBattleDeckToRecommended;
byId('factorReadyCheck').checked = Boolean(state.checklist.factorReady);
byId('skillPointCheck').checked = Boolean(state.checklist.skillPointReady);
byId('factorReadyCheck').onchange = scheduleSave;
byId('skillPointCheck').onchange = scheduleSave;
byId('exportPlannerData').onclick = downloadPlannerBackup;
byId('importPlannerData').onchange = event => importPlannerBackup(event.target.files?.[0]);
byId('clearPlannerData').onclick = () => {
  if (!window.confirm('確定清除這台裝置上的計畫與全部現有種馬資料？請先匯出備份。')) return;
  suppressBeforeUnloadSave = true;
  clearTimeout(saveTimer);
  persistenceCore?.remove();
  window.location.reload();
};
window.addEventListener('beforeunload', () => {
  if (!suppressBeforeUnloadSave) persistPlanner();
});
setSaveStatus(
  persistenceLoad.status === 'loaded'
    ? `已還原 ${breeders.length} 筆種馬與上次計畫`
    : persistenceLoad.status === 'invalid'
      ? '舊資料格式錯誤，已使用新計畫'
      : '將自動保存於這台裝置',
  persistenceLoad.status === 'invalid' ? 'error' : 'ready'
);
// Initialize the compact workbench even when the restored panel is not Step 2.
// This keeps its dock/statuses truthful before the user returns to the flow.
renderOptimizerIdentity();
renderGuidedProgress();
showPanel(state.activePanel);
