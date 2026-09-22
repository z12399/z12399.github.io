(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BREEDER_CORE = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const SCHEMA_VERSION = 1;
  const FACTOR_TYPES = ['blue', 'red', 'green', 'white'];
  const BREEDER_RECORD_SCHEMA = {
    schemaVersion: SCHEMA_VERSION,
    required: ['id', 'character.affinityKey'],
    factorTypes: FACTOR_TYPES,
    factorStars: { minimum: 1, maximum: 3, integer: true },
    parentSlots: 2,
    g1RaceIdentityPriority: ['raceId', 'baseRaceId', 'key', 'urlName', 'nameZhTw', 'nameJp', 'id']
  };
  const FAMILY_SLOTS = [
    'target',
    'parentA',
    'parentB',
    'parentA1',
    'parentA2',
    'parentB1',
    'parentB2'
  ];
  const ANCESTOR_SLOTS = FAMILY_SLOTS.slice(1);

  // This is the seven-pair approximation supported by the existing two-character
  // affinity matrix. The exact in-game grandparent terms use hidden three-character
  // relationship groups, which cannot be reconstructed from affinity-data.js alone.
  const BASE_AFFINITY_PAIRS = [
    { id: 'target-parentA', slots: ['target', 'parentA'], label: '育成目標 × 主親代' },
    { id: 'target-parentB', slots: ['target', 'parentB'], label: '育成目標 × 副親代' },
    { id: 'parentA-parentB', slots: ['parentA', 'parentB'], label: '主親代 × 副親代' },
    { id: 'target-parentA1', slots: ['target', 'parentA1'], label: '育成目標 × 主親代祖代 1' },
    { id: 'target-parentA2', slots: ['target', 'parentA2'], label: '育成目標 × 主親代祖代 2' },
    { id: 'target-parentB1', slots: ['target', 'parentB1'], label: '育成目標 × 副親代祖代 1' },
    { id: 'target-parentB2', slots: ['target', 'parentB2'], label: '育成目標 × 副親代祖代 2' }
  ];

  // Since the 2023 rules change, a common G1 is counted on these five lineage
  // relationships. A race is deduplicated inside each relationship, while the
  // same race may score again on another relationship.
  const G1_BONUS_PAIRS = [
    { id: 'P1-P2', legacyId: 'parentA-parentB', slots: ['parentA', 'parentB'], label: '兩親代共同 G1' },
    { id: 'P1-GP11', legacyId: 'parentA-parentA1', slots: ['parentA', 'parentA1'], label: '主親代 × 祖代 1' },
    { id: 'P1-GP12', legacyId: 'parentA-parentA2', slots: ['parentA', 'parentA2'], label: '主親代 × 祖代 2' },
    { id: 'P2-GP21', legacyId: 'parentB-parentB1', slots: ['parentB', 'parentB1'], label: '副親代 × 祖代 1' },
    { id: 'P2-GP22', legacyId: 'parentB-parentB2', slots: ['parentB', 'parentB2'], label: '副親代 × 祖代 2' }
  ];

  // This ruleset is deliberately explicit.  The five-edge / three-point rule is
  // community-observed rather than an official probability table, so callers can
  // show it as an assumption instead of treating it as a server-side guarantee.
  const ZH_TW_G1_RULESET = Object.freeze({
    id: 'zh_tw-2024-06-27',
    server: 'zh_tw',
    effectiveDate: '2024-06-27',
    pointsPerSharedRace: 3,
    pointsStatus: 'COMMUNITY_OBSERVED',
    canonicalRaceSource: 'GameTora',
    edgeIds: G1_BONUS_PAIRS.map(pair => pair.id)
  });

  const RED_FACTOR_THRESHOLDS = Object.freeze([
    { stars: 0, bonus: 0 },
    { stars: 1, bonus: 1 },
    { stars: 4, bonus: 2 },
    { stars: 7, bonus: 3 },
    { stars: 10, bonus: 4 }
  ]);
  const APTITUDE_RANKS = Object.freeze(['G', 'F', 'E', 'D', 'C', 'B', 'A', 'S']);
  const RED_FACTOR_KEYS = Object.freeze([
    'turf', 'dirt', 'short', 'mile', 'medium', 'long',
    'styles', 'runner', 'leader', 'betweener', 'chaser'
  ]);
  const RED_FACTOR_ALIASES = Object.freeze({
    turf: 'turf', grass: 'turf', '草地': 'turf',
    dirt: 'dirt', '泥地': 'dirt',
    short: 'short', sprint: 'short', '短距離': 'short',
    mile: 'mile', '一哩': 'mile', '英里': 'mile',
    medium: 'medium', '中距離': 'medium',
    long: 'long', '長距離': 'long',
    styles: 'styles', style: 'styles',
    runner: 'runner', nige: 'runner', '逃げ': 'runner', '領頭': 'runner',
    leader: 'leader', senkou: 'leader', '先行': 'leader', '前列': 'leader',
    betweener: 'betweener', sashi: 'betweener', '差し': 'betweener', '居中': 'betweener',
    chaser: 'chaser', oikomi: 'chaser', '追込': 'chaser', '後追': 'chaser'
  });

  function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object || {}, key);
  }

  function trimmed(value) {
    if (value === null || value === undefined) return null;
    const text = String(value).trim();
    return text || null;
  }

  function scalar(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) && String(value).trim() !== '' ? number : trimmed(value);
  }

  function finiteNumber(value, fallback = null) {
    if (value === null || value === undefined || value === '') return fallback;
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function comparisonKey(value) {
    return trimmed(value)?.normalize('NFKC').toLocaleLowerCase() || null;
  }

  function issue(code, message, path, severity = 'error', details = {}) {
    return { code, message, path, severity, ...details };
  }

  function normalizeCharacter(input) {
    const outer = isObject(input) ? input : {};
    const source = typeof input === 'string' || typeof input === 'number'
      ? { affinityKey: input }
      : (isObject(outer.character) ? outer.character : outer);
    const nameJp = trimmed(
      source.nameJp
      ?? source.name_jp
      ?? source.jpName
      ?? source.jp_name
      ?? source.characterNameJp
    );
    return {
      characterId: scalar(
        source.characterId
        ?? source.charId
        ?? source.char_id
        ?? outer.characterId
      ),
      outfitId: scalar(
        source.outfitId
        ?? source.cardId
        ?? source.card_id
        ?? outer.outfitId
      ),
      affinityKey: trimmed(
        source.affinityKey
        ?? outer.affinityKey
        ?? nameJp
      ),
      nameZhTw: trimmed(
        source.nameZhTw
        ?? source.name_tw
        ?? source.nameTw
        ?? source.characterNameZhTw
        ?? outer.nameZhTw
      ),
      nameJp,
      outfitTitleZhTw: trimmed(
        source.outfitTitleZhTw
        ?? source.titleZhTw
        ?? outer.outfitTitleZhTw
      )
    };
  }

  function normalizeFactor(input, type) {
    if (input === null || input === undefined || input === '') return null;
    const source = isObject(input) ? input : { nameZhTw: input, key: input };
    const id = scalar(source.id ?? source.skillId ?? source.factorId);
    const nameZhTw = trimmed(source.nameZhTw ?? source.name ?? source.label);
    const nameJp = trimmed(source.nameJp ?? source.name_jp);
    const key = trimmed(source.key ?? id ?? nameZhTw ?? nameJp);
    return {
      type,
      id,
      key,
      nameZhTw,
      nameJp,
      stars: finiteNumber(source.stars ?? source.star ?? source.level),
      skillId: scalar(source.skillId),
      note: trimmed(source.note)
    };
  }

  function normalizeWhiteFactors(input) {
    const values = Array.isArray(input)
      ? input
      : (input === null || input === undefined ? [] : [input]);
    return values
      .map(value => normalizeFactor(value, 'white'))
      .filter(Boolean);
  }

  function normalizedToken(value) {
    return trimmed(value)
      ?.normalize('NFKC')
      .toLocaleLowerCase()
      .replace(/[\s_－–—-]/g, '') || '';
  }

  function g1Ruleset(options = {}) {
    const source = isObject(options.ruleset) ? options.ruleset : {};
    const id = trimmed(
      source.id
      ?? options.rulesetId
      ?? (typeof options.ruleset === 'string' ? options.ruleset : null)
    ) || ZH_TW_G1_RULESET.id;
    const server = trimmed(source.server ?? options.server) || ZH_TW_G1_RULESET.server;
    return {
      ...ZH_TW_G1_RULESET,
      ...source,
      id,
      server
    };
  }

  function raceIdentity(source) {
    return trimmed(
      source.canonicalRaceId
      ?? source.raceId
      ?? source.baseRaceId
      ?? source.catalogRaceId
      ?? source.catalogId
      ?? source.id
      ?? source.key
      ?? source.urlName
      ?? source.nameZhTw
      ?? source.name
      ?? source.nameJp
    );
  }

  function normalizeRaceWin(input) {
    if (input === null || input === undefined || input === '') return null;
    const legacyNumeric = typeof input === 'number' || (typeof input === 'string' && /^\d+$/.test(input.trim()));
    const source = isObject(input) ? input : { catalogRaceId: input, legacyCatalogRaceId: input };
    const canonicalRaceId = scalar(source.canonicalRaceId ?? source.raceId ?? source.baseRaceId);
    const catalogRaceId = scalar(
      source.catalogRaceId
      ?? source.catalogId
      ?? source.gameToraRaceId
      ?? source.id
      ?? source.legacyCatalogRaceId
      ?? (!isObject(input) ? input : null)
    );
    const key = raceIdentity({ ...source, canonicalRaceId, catalogRaceId });
    if (!key) return null;
    return {
      key,
      // `raceId` remains an alias for compatibility, but scoring always resolves
      // it through the passed GameTora catalog before using it.
      raceId: canonicalRaceId,
      canonicalRaceId,
      catalogRaceId,
      id: catalogRaceId,
      urlName: trimmed(source.urlName),
      nameZhTw: trimmed(source.nameZhTw ?? source.name),
      nameJp: trimmed(source.nameJp),
      grade: scalar(source.grade),
      server: trimmed(source.server ?? source.serverId ?? source.gameServer),
      ruleset: trimmed(source.ruleset ?? source.rulesetId ?? source.ruleSet ?? source.ruleSetId),
      outcomeStatus: trimmed(source.outcomeStatus ?? source.resultStatus ?? source.result ?? source.outcome ?? source.status),
      finishPosition: finiteNumber(source.finishPosition ?? source.position ?? source.rank),
      eventType: trimmed(source.eventType ?? source.type ?? source.recordType),
      isTitle: source.isTitle === true || Boolean(source.title),
      verificationStatus: trimmed(source.verificationStatus ?? source.evidenceStatus),
      source: trimmed(source.source),
      legacyNumeric
    };
  }

  function mergeRaceWin(left, right) {
    const merged = { ...left };
    Object.entries(right).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') merged[key] = value;
    });
    return merged;
  }

  function normalizeG1Wins(input) {
    const values = Array.isArray(input)
      ? input
      : (input === null || input === undefined ? [] : [input]);
    const byKey = new Map();
    values.map(normalizeRaceWin).filter(Boolean).forEach(race => {
      // Keep different catalog IDs distinct in the record. They are deduplicated
      // by canonical GameTora raceId only when a particular lineage edge scores.
      const key = comparisonKey(
        race.catalogRaceId
        ?? `${race.canonicalRaceId ?? race.key}|${race.outcomeStatus ?? ''}|${race.finishPosition ?? ''}`
      );
      byKey.set(key, byKey.has(key) ? mergeRaceWin(byKey.get(key), race) : race);
    });
    return [...byKey.values()];
  }

  function parentReference(input) {
    if (input === null || input === undefined || input === '') return null;
    if (typeof input === 'string' || typeof input === 'number') return trimmed(input);
    if (!isObject(input)) return null;
    return trimmed(input.recordId ?? input.breederId ?? input.id);
  }

  function normalizeParentIds(input) {
    const source = isObject(input) ? input : {};
    let parents = source.parentIds;
    if (!parents) parents = source.parents;
    if (isObject(parents)) {
      parents = [
        parents.parentA ?? parents.first ?? parents.left ?? parents[0],
        parents.parentB ?? parents.second ?? parents.right ?? parents[1]
      ];
    }
    if (!Array.isArray(parents)) {
      parents = [
        source.parentAId ?? source.parent1Id,
        source.parentBId ?? source.parent2Id
      ];
    }
    return [parentReference(parents[0]), parentReference(parents[1])];
  }

  function normalizeBreederRecord(input) {
    const source = isObject(input) ? input : {};
    const factorSource = isObject(source.factors) ? source.factors : {};
    const whiteFactors = factorSource.white
      ?? factorSource.whites
      ?? source.whiteFactors
      ?? source.whiteFactor;
    return {
      schemaVersion: SCHEMA_VERSION,
      id: trimmed(source.id ?? source.recordId ?? source.breederId),
      label: trimmed(source.label ?? source.nickname ?? source.displayName),
      character: normalizeCharacter(source),
      factors: {
        blue: normalizeFactor(factorSource.blue ?? source.blueFactor, 'blue'),
        red: normalizeFactor(factorSource.red ?? source.redFactor, 'red'),
        green: normalizeFactor(factorSource.green ?? source.greenFactor, 'green'),
        white: normalizeWhiteFactors(whiteFactors)
      },
      g1Wins: normalizeG1Wins(
        source.g1Wins
        ?? source.g1RaceWins
        ?? source.raceWins
        ?? source.wins
      ),
      projectedG1Schedule: normalizeG1Wins(
        source.projectedG1Schedule
        ?? source.g1Schedule
        ?? source.scheduledG1Races
        ?? source.plannedG1Races
      ),
      parentIds: normalizeParentIds(source),
      notes: trimmed(source.notes ?? source.note),
      tags: Array.isArray(source.tags)
        ? [...new Set(source.tags.map(trimmed).filter(Boolean))]
        : [],
      metadata: isObject(source.metadata) ? { ...source.metadata } : {}
    };
  }

  function factorList(record) {
    const factors = record?.factors || {};
    return [
      factors.blue,
      factors.red,
      factors.green,
      ...(Array.isArray(factors.white) ? factors.white : [])
    ].filter(Boolean);
  }

  function validateFactor(factor, path) {
    const errors = [];
    if (!factor.key) {
      errors.push(issue('FACTOR_KEY_REQUIRED', '因子需要名稱、技能 ID 或穩定識別鍵。', `${path}.key`));
    }
    if (!Number.isInteger(factor.stars) || factor.stars < 1 || factor.stars > 3) {
      errors.push(issue('FACTOR_STARS_INVALID', '因子星數必須是 1～3 的整數。', `${path}.stars`));
    }
    return errors;
  }

  function validateBreederRecord(input, options = {}) {
    const value = normalizeBreederRecord(input);
    const errors = [];
    const warnings = [];
    if (!isObject(input)) {
      errors.push(issue('RECORD_OBJECT_REQUIRED', '種馬紀錄必須是物件。', 'record'));
    }
    if (isObject(input) && hasOwn(input, 'schemaVersion') && Number(input.schemaVersion) !== SCHEMA_VERSION) {
      errors.push(issue(
        'SCHEMA_VERSION_UNSUPPORTED',
        `目前只支援 schemaVersion ${SCHEMA_VERSION}。`,
        'schemaVersion'
      ));
    }
    if (!value.id) errors.push(issue('RECORD_ID_REQUIRED', '種馬紀錄需要唯一 ID。', 'id'));
    if (!value.character.affinityKey) {
      errors.push(issue(
        'AFFINITY_KEY_REQUIRED',
        '角色需要 affinityKey（目前 affinity-data.js 使用日文角色本名作為鍵）。',
        'character.affinityKey'
      ));
    }
    const rawParents = isObject(input) ? (input.parentIds ?? input.parents) : null;
    if (Array.isArray(rawParents) && rawParents.length > BREEDER_RECORD_SCHEMA.parentSlots) {
      errors.push(issue(
        'PARENT_COUNT_INVALID',
        `一筆種馬紀錄只能保存 ${BREEDER_RECORD_SCHEMA.parentSlots} 個直接祖代引用。`,
        'parentIds'
      ));
    }

    ['blue', 'red', 'green'].forEach(type => {
      if (value.factors[type]) {
        errors.push(...validateFactor(value.factors[type], `factors.${type}`));
      }
    });
    value.factors.white.forEach((factor, index) => {
      errors.push(...validateFactor(factor, `factors.white[${index}]`));
    });

    value.parentIds.forEach((parentId, index) => {
      if (parentId && parentId === value.id) {
        errors.push(issue(
          'SELF_PARENT_REFERENCE',
          '種馬紀錄不能把自己設為祖代來源。',
          `parentIds[${index}]`
        ));
      }
    });
    if (value.parentIds[0] && value.parentIds[0] === value.parentIds[1]) {
      warnings.push(issue(
        'DUPLICATE_PARENT_REFERENCE',
        '兩個祖代欄位引用了同一筆種馬紀錄。',
        'parentIds',
        'warning',
        { recordId: value.parentIds[0] }
      ));
    }

    value.g1Wins.forEach((race, index) => {
      const grade = comparisonKey(race.grade);
      if (grade && !['100', 'g1', 'gⅠ', 'gi'].includes(grade)) {
        warnings.push(issue(
          'NON_G1_RACE_IN_G1_LIST',
          'g1Wins 中有一場不是 G1（GameTora 的 G1 grade 為 100）。',
          `g1Wins[${index}].grade`,
          'warning',
          { raceKey: race.key, grade: race.grade }
        ));
      }
    });

    const affinityNames = options.affinityData?.names;
    if (
      value.character.affinityKey
      && Array.isArray(affinityNames)
      && !affinityNames.includes(value.character.affinityKey)
    ) {
      warnings.push(issue(
        'AFFINITY_CHARACTER_UNKNOWN',
        '角色 affinityKey 不存在於目前的相性資料庫。',
        'character.affinityKey',
        'warning',
        { affinityKey: value.character.affinityKey }
      ));
    }
    return { valid: errors.length === 0, errors, warnings, value };
  }

  function normalizeBreederDatabase(input) {
    const source = Array.isArray(input) ? { records: input } : (isObject(input) ? input : {});
    const records = Array.isArray(source.records) ? source.records : [];
    return {
      schemaVersion: SCHEMA_VERSION,
      records: records.map(normalizeBreederRecord),
      metadata: isObject(source.metadata) ? { ...source.metadata } : {}
    };
  }

  function ancestryCycles(recordMap) {
    const state = new Map();
    const stack = [];
    const cycleKeys = new Set();
    const cycles = [];

    function visit(id) {
      if (state.get(id) === 2) return;
      if (state.get(id) === 1) {
        const index = stack.indexOf(id);
        const cycle = [...stack.slice(index), id];
        const key = [...new Set(cycle)].sort().join('|');
        if (!cycleKeys.has(key)) {
          cycleKeys.add(key);
          cycles.push(cycle);
        }
        return;
      }
      state.set(id, 1);
      stack.push(id);
      const record = recordMap.get(id);
      (record?.parentIds || []).filter(Boolean).forEach(parentId => {
        if (recordMap.has(parentId)) visit(parentId);
      });
      stack.pop();
      state.set(id, 2);
    }

    recordMap.forEach((_, id) => visit(id));
    return cycles;
  }

  function validateBreederDatabase(input, options = {}) {
    const value = normalizeBreederDatabase(input);
    const errors = [];
    const warnings = [];
    const sourceRecords = Array.isArray(input)
      ? input
      : (isObject(input) && Array.isArray(input.records) ? input.records : null);
    if (!sourceRecords) {
      errors.push(issue(
        'DATABASE_RECORDS_ARRAY_REQUIRED',
        '種馬資料庫需要 records 陣列。',
        'records'
      ));
    }
    if (
      isObject(input)
      && hasOwn(input, 'schemaVersion')
      && Number(input.schemaVersion) !== SCHEMA_VERSION
    ) {
      errors.push(issue(
        'SCHEMA_VERSION_UNSUPPORTED',
        `目前只支援 schemaVersion ${SCHEMA_VERSION}。`,
        'schemaVersion'
      ));
    }

    const recordMap = new Map();
    value.records.forEach((record, index) => {
      const validation = validateBreederRecord(sourceRecords?.[index] ?? record, options);
      validation.errors.forEach(item => errors.push({ ...item, path: `records[${index}].${item.path}` }));
      validation.warnings.forEach(item => warnings.push({ ...item, path: `records[${index}].${item.path}` }));
      if (!record.id) return;
      if (recordMap.has(record.id)) {
        errors.push(issue(
          'DUPLICATE_RECORD_ID',
          '種馬資料庫含有重複 ID。',
          `records[${index}].id`,
          'error',
          { recordId: record.id }
        ));
      } else {
        recordMap.set(record.id, record);
      }
    });

    value.records.forEach((record, recordIndex) => {
      record.parentIds.forEach((parentId, parentIndex) => {
        if (parentId && !recordMap.has(parentId)) {
          warnings.push(issue(
            'PARENT_REFERENCE_MISSING',
            '祖代引用不在目前資料庫中；若是借用種馬可保留此警告。',
            `records[${recordIndex}].parentIds[${parentIndex}]`,
            'warning',
            { recordId: record.id, parentId }
          ));
        }
      });
    });

    ancestryCycles(recordMap).forEach(cycle => {
      errors.push(issue(
        'ANCESTRY_CYCLE',
        '祖代引用形成循環，無法建立有效家系。',
        'records',
        'error',
        { recordIds: cycle }
      ));
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      value,
      recordMap
    };
  }

  function databaseRecordMap(database) {
    if (database?.recordMap instanceof Map) return databaseRecordMap(database.recordMap);
    if (database?.value?.records) return databaseRecordMap(database.value);
    if (database instanceof Map) {
      return new Map([...database.entries()].map(([id, record]) => [
        trimmed(id),
        normalizeBreederRecord({ ...record, id: record?.id ?? id })
      ]));
    }
    const normalized = normalizeBreederDatabase(database);
    const map = new Map();
    normalized.records.forEach(record => {
      if (record.id && !map.has(record.id)) map.set(record.id, record);
    });
    return map;
  }

  function emptyFamilyRecord(characterInput) {
    return {
      schemaVersion: SCHEMA_VERSION,
      id: null,
      label: null,
      character: normalizeCharacter(characterInput),
      factors: { blue: null, red: null, green: null, white: [] },
      g1Wins: [],
      projectedG1Schedule: [],
      parentIds: [null, null],
      notes: null,
      tags: [],
      metadata: {}
    };
  }

  function looksLikeBreederRecord(input) {
    return isObject(input) && (
      hasOwn(input, 'factors')
      || hasOwn(input, 'g1Wins')
      || hasOwn(input, 'parentIds')
      || hasOwn(input, 'parents')
      || hasOwn(input, 'recordId')
    );
  }

  function resolveFamilyNode(reference, recordMap, settings = {}) {
    if (reference === null || reference === undefined || reference === '') {
      return { value: null, unresolved: null };
    }
    if (looksLikeBreederRecord(reference)) {
      const recordId = trimmed(reference.recordId ?? reference.breederId);
      if (recordId && recordMap.has(recordId) && !hasOwn(reference, 'character')) {
        return { value: recordMap.get(recordId), unresolved: null };
      }
      return { value: normalizeBreederRecord(reference), unresolved: null };
    }
    if (isObject(reference) && (reference.affinityKey || reference.character || reference.nameJp)) {
      return { value: emptyFamilyRecord(reference), unresolved: null };
    }

    const key = trimmed(reference);
    if (recordMap.has(key)) return { value: recordMap.get(key), unresolved: null };
    if (settings.strictReference) {
      return {
        value: null,
        unresolved: issue(
          'FAMILY_RECORD_UNRESOLVED',
          '家系引用的種馬 ID 不在資料庫中。',
          settings.path || settings.slot || 'family',
          'warning',
          { recordId: key, slot: settings.slot }
        )
      };
    }
    return { value: emptyFamilyRecord({ affinityKey: key }), unresolved: null };
  }

  function twoParentReferences(spec) {
    if (Array.isArray(spec.parentIds)) return [spec.parentIds[0], spec.parentIds[1]];
    if (Array.isArray(spec.parents)) return [spec.parents[0], spec.parents[1]];
    if (isObject(spec.parents)) {
      return [
        spec.parents.parentA ?? spec.parents.first ?? spec.parents.left ?? spec.parents[0],
        spec.parents.parentB ?? spec.parents.second ?? spec.parents.right ?? spec.parents[1]
      ];
    }
    return [
      spec.parentAId ?? spec.parentA,
      spec.parentBId ?? spec.parentB
    ];
  }

  function explicitGrandparentReferences(spec) {
    const values = spec.grandparentIds ?? spec.grandparents;
    if (Array.isArray(values)) return [values[0], values[1], values[2], values[3]];
    if (isObject(values)) {
      return [
        values.parentA1 ?? values.a1 ?? values[0],
        values.parentA2 ?? values.a2 ?? values[1],
        values.parentB1 ?? values.b1 ?? values[2],
        values.parentB2 ?? values.b2 ?? values[3]
      ];
    }
    return [
      spec.parentA1Id ?? spec.parentA1,
      spec.parentA2Id ?? spec.parentA2,
      spec.parentB1Id ?? spec.parentB1,
      spec.parentB2Id ?? spec.parentB2
    ];
  }

  function buildFamily(specification, database) {
    const spec = isObject(specification) ? specification : { target: specification };
    const recordMap = databaseRecordMap(database);
    const unresolvedReferences = [];
    const family = {
      schemaVersion: SCHEMA_VERSION,
      target: null,
      parentA: null,
      parentB: null,
      parentA1: null,
      parentA2: null,
      parentB1: null,
      parentB2: null,
      unresolvedReferences
    };

    const target = resolveFamilyNode(spec.target, recordMap, { slot: 'target' });
    family.target = target.value;

    const parentRefs = twoParentReferences(spec);
    ['parentA', 'parentB'].forEach((slot, index) => {
      const strictReference = hasOwn(spec, `${slot}Id`) || Array.isArray(spec.parentIds);
      const resolved = resolveFamilyNode(parentRefs[index], recordMap, {
        slot,
        path: slot,
        strictReference
      });
      family[slot] = resolved.value;
      if (resolved.unresolved) unresolvedReferences.push(resolved.unresolved);
    });

    const explicit = explicitGrandparentReferences(spec);
    const derived = [
      family.parentA?.parentIds?.[0],
      family.parentA?.parentIds?.[1],
      family.parentB?.parentIds?.[0],
      family.parentB?.parentIds?.[1]
    ];
    ['parentA1', 'parentA2', 'parentB1', 'parentB2'].forEach((slot, index) => {
      const hasExplicit = explicit[index] !== null && explicit[index] !== undefined && explicit[index] !== '';
      const reference = hasExplicit ? explicit[index] : derived[index];
      const resolved = resolveFamilyNode(reference, recordMap, {
        slot,
        path: slot,
        strictReference: !hasExplicit || hasOwn(spec, `${slot}Id`) || Array.isArray(spec.grandparentIds)
      });
      family[slot] = resolved.value;
      if (resolved.unresolved) unresolvedReferences.push(resolved.unresolved);
    });
    return family;
  }

  function nodeIdentity(node) {
    return node?.id
      ? `record:${node.id}`
      : (node?.character?.affinityKey ? `character:${node.character.affinityKey}` : null);
  }

  function repeatedGroups(family, identity, slots = FAMILY_SLOTS) {
    const groups = new Map();
    slots.forEach(slot => {
      const key = comparisonKey(identity(family?.[slot]));
      if (!key) return;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(slot);
    });
    return [...groups.entries()]
      .filter(([, groupSlots]) => groupSlots.length > 1)
      .map(([key, groupSlots]) => ({ key, slots: groupSlots }));
  }

  function familyWarnings(family) {
    const warnings = [...(family?.unresolvedReferences || [])];
    ANCESTOR_SLOTS.forEach(slot => {
      if (!family?.[slot]) {
        warnings.push(issue(
          'FAMILY_SLOT_MISSING',
          '家系尚有未指定欄位。',
          slot,
          'warning',
          { slot }
        ));
      }
    });

    repeatedGroups(family, node => node?.character?.affinityKey).forEach(group => {
      warnings.push(issue(
        'DUPLICATE_CHARACTER',
        '同一角色出現在家系多個位置；遊戲內可能失去部分相性或 G1 加成。',
        'family',
        'warning',
        {
          affinityKey: family[group.slots[0]]?.character?.affinityKey,
          slots: group.slots
        }
      ));
    });

    repeatedGroups(family, node => node?.id, ANCESTOR_SLOTS).forEach(group => {
      warnings.push(issue(
        'DUPLICATE_LINEAGE_RECORD',
        '同一筆種馬紀錄被重複放入家系。',
        'family',
        'warning',
        {
          recordId: family[group.slots[0]]?.id,
          slots: group.slots
        }
      ));
    });

    const branchA = ['parentA', 'parentA1', 'parentA2'].map(slot => nodeIdentity(family?.[slot]));
    const branchB = ['parentB', 'parentB1', 'parentB2'].map(slot => nodeIdentity(family?.[slot]));
    if (
      branchA.every(Boolean)
      && branchB.every(Boolean)
      && branchA[0] === branchB[0]
      && [...branchA.slice(1)].sort().join('|') === [...branchB.slice(1)].sort().join('|')
    ) {
      warnings.push(issue(
        'DUPLICATE_FAMILY_BRANCH',
        '主、副親代使用了完全相同的三人家系。',
        'family',
        'warning',
        { branchA, branchB }
      ));
    }
    return warnings;
  }

  function affinityScore(left, right, affinityData) {
    const leftKey = typeof left === 'string'
      ? left
      : (left?.character?.affinityKey ?? left?.affinityKey ?? left?.nameJp);
    const rightKey = typeof right === 'string'
      ? right
      : (right?.character?.affinityKey ?? right?.affinityKey ?? right?.nameJp);
    if (!leftKey || !rightKey) {
      return { score: null, status: 'missing-character', leftKey, rightKey };
    }
    if (leftKey === rightKey) {
      return { score: 0, status: 'same-character', leftKey, rightKey };
    }
    if (!Array.isArray(affinityData?.names) || !Array.isArray(affinityData?.matrix)) {
      return { score: null, status: 'invalid-affinity-data', leftKey, rightKey };
    }
    const leftIndex = affinityData.names.indexOf(leftKey);
    const rightIndex = affinityData.names.indexOf(rightKey);
    if (leftIndex < 0 || rightIndex < 0) {
      return {
        score: null,
        status: 'character-not-in-affinity-data',
        leftKey,
        rightKey,
        leftIndex,
        rightIndex
      };
    }
    const value = affinityData.matrix[leftIndex]?.[rightIndex];
    const score = finiteNumber(value);
    return {
      score,
      status: score === null ? 'affinity-value-missing' : 'ok',
      leftKey,
      rightKey,
      leftIndex,
      rightIndex
    };
  }

  function normalizePair(pair, index) {
    if (Array.isArray(pair)) {
      return {
        id: `${pair[0]}-${pair[1]}`,
        slots: [pair[0], pair[1]],
        label: `${pair[0]} × ${pair[1]}`
      };
    }
    return {
      ...(isObject(pair) ? pair : {}),
      id: pair?.id || `pair-${index + 1}`,
      slots: pair?.slots || [pair?.left, pair?.right],
      label: pair?.label || pair?.id || `Pair ${index + 1}`
    };
  }

  function calculateBaseAffinity(family, affinityData, options = {}) {
    const pairRules = (options.pairs || BASE_AFFINITY_PAIRS).map(normalizePair);
    const pairs = pairRules.map(rule => {
      const [leftSlot, rightSlot] = rule.slots;
      const left = family?.[leftSlot];
      const right = family?.[rightSlot];
      const result = affinityScore(left, right, affinityData);
      return {
        ...rule,
        leftSlot,
        rightSlot,
        leftRecordId: left?.id || null,
        rightRecordId: right?.id || null,
        ...result
      };
    });
    const countedPairs = pairs.filter(pair => Number.isFinite(pair.score));
    return {
      method: options.method || 'seven-pair-matrix-approximation',
      total: countedPairs.reduce((sum, pair) => sum + pair.score, 0),
      complete: countedPairs.length === pairs.length,
      expectedPairCount: pairs.length,
      countedPairCount: countedPairs.length,
      missingPairCount: pairs.length - countedPairs.length,
      pairs
    };
  }

  function catalogEntries(catalog) {
    if (catalog instanceof Map) return [...catalog.values()];
    if (Array.isArray(catalog)) return catalog;
    if (!isObject(catalog)) return [];
    if (Array.isArray(catalog.races)) return catalog.races;
    if (Array.isArray(catalog.records)) return catalog.records;
    return Object.values(catalog).filter(isObject);
  }

  function catalogLookup(catalog) {
    const byCatalogId = new Map();
    const byCanonicalRaceId = new Map();
    catalogEntries(catalog).forEach(raw => {
      const catalogRaceId = scalar(raw.catalogRaceId ?? raw.catalogId ?? raw.id);
      const canonicalRaceId = scalar(raw.canonicalRaceId ?? raw.raceId ?? raw.baseRaceId);
      if (catalogRaceId === null || canonicalRaceId === null) return;
      const entry = {
        catalogRaceId,
        canonicalRaceId,
        grade: scalar(raw.grade),
        server: trimmed(raw.server ?? raw.serverId),
        urlName: trimmed(raw.urlName),
        nameZhTw: trimmed(raw.nameZhTw ?? raw.name),
        nameJp: trimmed(raw.nameJp)
      };
      byCatalogId.set(comparisonKey(catalogRaceId), entry);
      const canonicalKey = comparisonKey(canonicalRaceId);
      if (!byCanonicalRaceId.has(canonicalKey)) byCanonicalRaceId.set(canonicalKey, []);
      byCanonicalRaceId.get(canonicalKey).push(entry);
    });
    return { byCatalogId, byCanonicalRaceId };
  }

  function gradeIsG1(grade) {
    const value = normalizedToken(grade);
    return value === '100' || value === 'g1' || value === 'gⅰ' || value === 'gi';
  }

  function resolveCatalogRace(race, options = {}) {
    const lookup = catalogLookup(options.raceCatalog ?? options.catalog ?? options.gameToraRaceCatalog);
    if (!lookup.byCatalogId.size && !lookup.byCanonicalRaceId.size) {
      return { entry: null, code: 'G1_CATALOG_REQUIRED' };
    }
    const catalogKey = comparisonKey(race?.catalogRaceId);
    const canonicalKey = comparisonKey(race?.canonicalRaceId ?? race?.raceId);
    let entry = catalogKey ? lookup.byCatalogId.get(catalogKey) : null;
    if (!entry && canonicalKey) {
      const matching = lookup.byCanonicalRaceId.get(canonicalKey) || [];
      // A canonical raceId may legitimately be present under more than one
      // catalog id. It is still a known canonical GameTora race as long as all
      // matches resolve to that same canonical identity.
      if (matching.length) entry = matching[0];
    }
    if (!entry) return { entry: null, code: 'G1_CATALOG_RACE_UNKNOWN' };
    if (canonicalKey && canonicalKey !== comparisonKey(entry.canonicalRaceId)) {
      return { entry: null, code: 'G1_CATALOG_CANONICAL_MISMATCH' };
    }
    if (entry.server && comparisonKey(entry.server) !== comparisonKey(g1Ruleset(options).server)) {
      return { entry: null, code: 'G1_CATALOG_SERVER_UNSUPPORTED' };
    }
    return { entry, code: null };
  }

  function titleEvidence(race) {
    if (race?.isTitle === true) return true;
    const token = normalizedToken(race?.eventType);
    return ['title', 'achievement', 'trophy', '稱號'].includes(token);
  }

  function winningEvidence(race) {
    const status = normalizedToken(race?.outcomeStatus);
    const nonWin = new Set([
      'scheduled', 'schedule', 'planned', 'started', 'running', 'dnf', 'dns',
      'retired', 'loss', 'lose', 'second', '2nd', 'third', '3rd', 'notwon', 'startednotwon'
    ]);
    if (nonWin.has(status)) return false;
    const explicitWin = ['win', 'won', 'first', '1st', '1'].includes(status);
    const finishPosition = finiteNumber(race?.finishPosition);
    return explicitWin || finishPosition === 1;
  }

  function classifyG1RaceEvidence(input, options = {}) {
    const race = normalizeRaceWin(input);
    const ruleset = g1Ruleset(options);
    if (!race) {
      return {
        status: 'UNVERIFIED',
        race: null,
        warnings: [issue('G1_EVIDENCE_INVALID', 'G1 勝場資料缺少可解析的比賽識別。', 'g1Wins', 'warning')]
      };
    }
    if (race.verificationStatus && normalizedToken(race.verificationStatus) === 'unverified') {
      return {
        status: 'UNVERIFIED',
        race,
        warnings: [issue('G1_EVIDENCE_UNVERIFIED', 'G1 勝場證據被標記為未驗證，不納入分數。', 'g1Wins', 'warning', { race })]
      };
    }
    if (!race.server || comparisonKey(race.server) !== comparisonKey(ruleset.server)) {
      return {
        status: 'UNVERIFIED',
        race,
        warnings: [issue(
          'G1_SERVER_UNVERIFIED',
          'G1 勝場缺少或不符合繁中服伺服器證據，不納入分數。',
          'g1Wins',
          'warning',
          { expectedServer: ruleset.server, server: race.server || null }
        )]
      };
    }
    if (!race.ruleset || comparisonKey(race.ruleset) !== comparisonKey(ruleset.id)) {
      return {
        status: 'UNVERIFIED',
        race,
        warnings: [issue(
          'G1_RULESET_UNVERIFIED',
          'G1 勝場缺少或不符合目前規則版本，不納入分數。',
          'g1Wins',
          'warning',
          { expectedRuleset: ruleset.id, ruleset: race.ruleset || null }
        )]
      };
    }
    if (titleEvidence(race)) {
      return {
        status: 'UNVERIFIED',
        race,
        warnings: [issue('G1_TITLE_NOT_RACE', '稱號不是可計分的 G1 勝場。', 'g1Wins', 'warning', { race })]
      };
    }
    const catalog = resolveCatalogRace(race, options);
    if (!catalog.entry) {
      return {
        status: 'UNVERIFIED',
        race,
        warnings: [issue(
          catalog.code,
          '找不到可驗證的 GameTora canonical raceId，不納入 G1 分數。',
          'g1Wins',
          'warning',
          { race }
        )]
      };
    }
    if ((race.grade !== null && !gradeIsG1(race.grade)) || !gradeIsG1(catalog.entry.grade)) {
      return {
        status: 'UNVERIFIED',
        race: { ...race, ...catalog.entry },
        warnings: [issue('G1_GRADE_NOT_G1', '只有 G1 賽事可計入共同 G1 加成。', 'g1Wins', 'warning', { race })]
      };
    }
    if (!winningEvidence(race)) {
      return {
        status: 'UNVERIFIED',
        race: { ...race, ...catalog.entry },
        warnings: [issue(
          'G1_OUTCOME_NOT_WIN',
          '只有已確認 WIN 或 finishPosition=1 的 G1 可計分；賽程、出走中與未勝利均不計分。',
          'g1Wins',
          'warning',
          { race }
        )]
      };
    }
    return {
      status: 'CONFIRMED',
      race: {
        ...race,
        ...catalog.entry,
        raceId: catalog.entry.canonicalRaceId,
        canonicalRaceId: catalog.entry.canonicalRaceId,
        key: String(catalog.entry.canonicalRaceId),
        verificationStatus: 'CONFIRMED'
      },
      warnings: []
    };
  }

  function classifyProjectedG1Race(input, options = {}) {
    const race = normalizeRaceWin(input);
    const ruleset = g1Ruleset(options);
    if (!race) return { status: 'UNVERIFIED', race: null, warnings: [] };
    if (!race.server || comparisonKey(race.server) !== comparisonKey(ruleset.server)) {
      return {
        status: 'UNVERIFIED',
        race,
        warnings: [issue('PROJECTED_G1_SERVER_UNVERIFIED', '預定 G1 缺少繁中服伺服器證據，不列入預定共同賽程。', 'projectedG1Schedule', 'warning', { race })]
      };
    }
    if (!race.ruleset || comparisonKey(race.ruleset) !== comparisonKey(ruleset.id)) {
      return {
        status: 'UNVERIFIED',
        race,
        warnings: [issue('PROJECTED_G1_RULESET_UNVERIFIED', '預定 G1 缺少規則版本證據，不列入預定共同賽程。', 'projectedG1Schedule', 'warning', { race })]
      };
    }
    if (titleEvidence(race)) {
      return {
        status: 'UNVERIFIED',
        race,
        warnings: [issue('PROJECTED_G1_TITLE_NOT_RACE', '稱號不能當作預定 G1 賽程。', 'projectedG1Schedule', 'warning', { race })]
      };
    }
    const catalog = resolveCatalogRace(race, options);
    if (!catalog.entry || ((race.grade !== null && !gradeIsG1(race.grade)) || !gradeIsG1(catalog.entry.grade))) {
      return {
        status: 'UNVERIFIED',
        race,
        warnings: [issue(
          catalog.code || 'PROJECTED_G1_GRADE_NOT_G1',
          '預定賽程必須是可驗證的 GameTora G1，否則不列入。',
          'projectedG1Schedule',
          'warning',
          { race }
        )]
      };
    }
    return {
      status: 'PROJECTED',
      race: {
        ...race,
        ...catalog.entry,
        raceId: catalog.entry.canonicalRaceId,
        canonicalRaceId: catalog.entry.canonicalRaceId,
        key: String(catalog.entry.canonicalRaceId),
        verificationStatus: 'PROJECTED'
      },
      warnings: []
    };
  }

  function confirmedRaceMap(record, options = {}) {
    const map = new Map();
    const warnings = [];
    normalizeG1Wins(record?.g1Wins).forEach((raw, index) => {
      const classified = classifyG1RaceEvidence(raw, options);
      warnings.push(...classified.warnings.map(warning => ({ ...warning, path: `g1Wins[${index}]` })));
      if (classified.status !== 'CONFIRMED' || !classified.race) return;
      const key = comparisonKey(classified.race.canonicalRaceId);
      if (!map.has(key)) map.set(key, classified.race);
    });
    return { map, warnings };
  }

  function projectedRaceMap(record, options = {}) {
    const map = new Map();
    const warnings = [];
    const values = record?.projectedG1Schedule
      ?? record?.g1Schedule
      ?? record?.scheduledG1Races
      ?? record?.plannedG1Races
      ?? [];
    normalizeG1Wins(values).forEach((raw, index) => {
      const classified = classifyProjectedG1Race(raw, options);
      warnings.push(...classified.warnings.map(warning => ({ ...warning, path: `projectedG1Schedule[${index}]` })));
      if (classified.status !== 'PROJECTED' || !classified.race) return;
      const key = comparisonKey(classified.race.canonicalRaceId);
      if (!map.has(key)) map.set(key, classified.race);
    });
    return { map, warnings };
  }

  function raceMap(record, options = {}) {
    return confirmedRaceMap(record, options).map;
  }

  function commonRaceEvidence(left, right, options = {}) {
    const leftResult = confirmedRaceMap(left, options);
    const rightResult = confirmedRaceMap(right, options);
    const races = [];
    leftResult.map.forEach((race, key) => {
      if (rightResult.map.has(key)) races.push(mergeRaceWin(race, rightResult.map.get(key)));
    });
    return { races, warnings: [...leftResult.warnings, ...rightResult.warnings] };
  }

  function commonRaces(left, right, options = {}) {
    return commonRaceEvidence(left, right, options).races;
  }

  function racePointAliases(race) {
    return [
      race.key,
      race.raceId,
      race.id,
      race.urlName,
      race.nameZhTw,
      race.nameJp
    ].map(trimmed).filter(Boolean);
  }

  function configuredRacePoints(race, pair, options) {
    if (typeof options.getRacePoints === 'function') {
      const value = finiteNumber(options.getRacePoints(race, pair));
      if (value !== null) return value;
    }
    const configured = options.racePoints;
    const aliases = racePointAliases(race);
    if (configured instanceof Map) {
      for (const alias of aliases) {
        if (configured.has(alias)) {
          const value = finiteNumber(configured.get(alias));
          if (value !== null) return value;
        }
        const normalized = comparisonKey(alias);
        if (configured.has(normalized)) {
          const value = finiteNumber(configured.get(normalized));
          if (value !== null) return value;
        }
      }
    } else if (isObject(configured)) {
      for (const alias of aliases) {
        const exact = configured[alias];
        const normalized = configured[comparisonKey(alias)];
        const value = finiteNumber(exact ?? normalized);
        if (value !== null) return value;
      }
    }
    return finiteNumber(options.pointsPerRace, ZH_TW_G1_RULESET.pointsPerSharedRace);
  }

  function calculateG1Bonus(family, options = {}) {
    const ruleset = g1Ruleset(options);
    const pairRules = G1_BONUS_PAIRS.map(normalizePair);
    const warnings = [];
    const pairs = pairRules.map(rule => {
      const [leftSlot, rightSlot] = rule.slots;
      const left = family?.[leftSlot];
      const right = family?.[rightSlot];
      if (!left || !right) {
        return {
          ...rule,
          leftSlot,
          rightSlot,
          complete: false,
          commonRaceCount: 0,
          commonRaces: [],
          excludedEvidence: [],
          points: 0
        };
      }
      const common = commonRaceEvidence(left, right, { ...options, ruleset });
      warnings.push(...common.warnings.map(warning => ({ ...warning, edgeId: rule.id })));
      const races = common.races.map(race => ({
        ...race,
        points: configuredRacePoints(race, rule, options)
      }));
      return {
        ...rule,
        leftSlot,
        rightSlot,
        leftRecordId: left.id || null,
        rightRecordId: right.id || null,
        complete: true,
        commonRaceCount: races.length,
        commonRaces: races,
        excludedEvidence: common.warnings,
        points: races.reduce((sum, race) => sum + race.points, 0)
      };
    });
    const uniqueRaceKeys = [...new Set(
      pairs.flatMap(pair => pair.commonRaces.map(race => race.key))
    )];
    return {
      ruleset,
      method: 'five-lineage-pairs-confirmed-common-g1',
      evidencePolicy: 'confirmed-win-finishPosition1-canonical-gametora-raceid',
      pointsPerRace: finiteNumber(options.pointsPerRace, ZH_TW_G1_RULESET.pointsPerSharedRace),
      pointsStatus: ZH_TW_G1_RULESET.pointsStatus,
      total: pairs.reduce((sum, pair) => sum + pair.points, 0),
      complete: pairs.every(pair => pair.complete),
      expectedPairCount: pairs.length,
      completePairCount: pairs.filter(pair => pair.complete).length,
      racePairOccurrences: pairs.reduce((sum, pair) => sum + pair.commonRaceCount, 0),
      uniqueRaceKeys,
      pairs,
      warnings
    };
  }

  function commonProjectedRaceEvidence(left, right, options = {}) {
    const leftResult = projectedRaceMap(left, options);
    const rightResult = projectedRaceMap(right, options);
    const races = [];
    leftResult.map.forEach((race, key) => {
      if (rightResult.map.has(key)) races.push(mergeRaceWin(race, rightResult.map.get(key)));
    });
    return { races, warnings: [...leftResult.warnings, ...rightResult.warnings] };
  }

  function calculateProjectedG1Bonus(family, options = {}) {
    const ruleset = g1Ruleset(options);
    const pairRules = G1_BONUS_PAIRS.map(normalizePair);
    const warnings = [];
    const pairs = pairRules.map(rule => {
      const [leftSlot, rightSlot] = rule.slots;
      const left = family?.[leftSlot];
      const right = family?.[rightSlot];
      if (!left || !right) {
        return {
          ...rule,
          leftSlot,
          rightSlot,
          complete: false,
          projectedCommonRaceCount: 0,
          projectedCommonRaces: [],
          points: 0
        };
      }
      const common = commonProjectedRaceEvidence(left, right, { ...options, ruleset });
      warnings.push(...common.warnings.map(warning => ({ ...warning, edgeId: rule.id })));
      return {
        ...rule,
        leftSlot,
        rightSlot,
        leftRecordId: left.id || null,
        rightRecordId: right.id || null,
        complete: true,
        projectedCommonRaceCount: common.races.length,
        projectedCommonRaces: common.races,
        points: 0
      };
    });
    return {
      ruleset,
      method: 'five-lineage-pairs-projected-common-g1',
      status: 'UNVERIFIED',
      scoreIncluded: false,
      total: 0,
      complete: pairs.every(pair => pair.complete),
      expectedPairCount: pairs.length,
      completePairCount: pairs.filter(pair => pair.complete).length,
      projectedRacePairOccurrences: pairs.reduce((sum, pair) => sum + pair.projectedCommonRaceCount, 0),
      uniqueRaceKeys: [...new Set(pairs.flatMap(pair => pair.projectedCommonRaces.map(race => race.key)))],
      pairs,
      warnings
    };
  }

  function canonicalRedFactorKey(value) {
    const raw = trimmed(value);
    if (!raw) return null;
    const token = normalizedToken(raw);
    if (RED_FACTOR_ALIASES[token]) return RED_FACTOR_ALIASES[token];
    const styleToken = token.replace(/^(style|styles)[:.]/, '');
    return RED_FACTOR_ALIASES[styleToken] || null;
  }

  function redStartingBonus(starTotal) {
    const stars = Math.max(0, finiteNumber(starTotal, 0));
    return RED_FACTOR_THRESHOLDS.reduce(
      (bonus, threshold) => (stars >= threshold.stars ? threshold.bonus : bonus),
      0
    );
  }

  function aptitudeRankIndex(value) {
    const rank = trimmed(value)?.toUpperCase();
    const index = APTITUDE_RANKS.indexOf(rank);
    return index < 0 ? null : index;
  }

  function aptitudeRank(value) {
    const index = finiteNumber(value);
    return Number.isInteger(index) && index >= 0 && index < APTITUDE_RANKS.length
      ? APTITUDE_RANKS[index]
      : null;
  }

  function aggregateRedFactors(family, options = {}) {
    const slots = options.slots || (options.includeTarget ? FAMILY_SLOTS : ANCESTOR_SLOTS);
    const redByKey = Object.fromEntries(RED_FACTOR_KEYS.map(key => [key, {
      key,
      factorCount: 0,
      starTotal: 0,
      startBonus: 0,
      cappedAt: 'A',
      probabilityStatus: 'UNVERIFIED',
      slots: [],
      recordIds: []
    }]));
    const factors = [];
    const warnings = [];
    const records = Array.isArray(family)
      ? family.map((record, index) => ({ slot: `record-${index + 1}`, record }))
      : slots.map(slot => ({ slot, record: family?.[slot] }));
    records.forEach(({ slot, record }) => {
      const factor = record?.factors?.red;
      if (!factor) return;
      const key = canonicalRedFactorKey(factor.key ?? factor.nameZhTw ?? factor.name);
      if (!key) {
        warnings.push(issue(
          'RED_FACTOR_KEY_UNSUPPORTED',
          '紅因子沒有可辨識的場地、距離或作戰鍵，不能與其他紅因子合併。',
          `factors.red.${slot}`,
          'warning',
          { factor, slot, recordId: record?.id || null }
        ));
        return;
      }
      const stars = Math.max(0, finiteNumber(factor.stars, 0));
      const bucket = redByKey[key];
      bucket.factorCount += 1;
      bucket.starTotal += stars;
      bucket.slots.push(slot);
      if (record?.id) bucket.recordIds.push(record.id);
      factors.push({ ...factor, key, stars, slot, recordId: record?.id || null });
    });
    Object.values(redByKey).forEach(bucket => {
      bucket.startBonus = redStartingBonus(bucket.starTotal);
    });
    return {
      thresholds: RED_FACTOR_THRESHOLDS,
      redByKey,
      // Style factors stay separate by concrete style key. `runner` and
      // `leader`, for example, never accumulate toward each other.
      styleKeys: ['runner', 'leader', 'betweener', 'chaser'],
      factors,
      warnings
    };
  }

  function normalizeAptitudeRequirement(raw, index, options = {}) {
    const source = isObject(raw) ? raw : { key: raw };
    const key = canonicalRedFactorKey(source.key ?? source.aptitudeKey ?? source.redFactorKey ?? source.type);
    const nativeAptitudes = isObject(options.nativeAptitudes) ? options.nativeAptitudes : {};
    const requestedAptitudes = isObject(options.requestedAptitudes) ? options.requestedAptitudes : {};
    const nativeRank = trimmed(
      source.nativeRank
      ?? source.nativeAptitude
      ?? source.aptitude
      ?? nativeAptitudes[key]
    );
    const verifiedRank = trimmed(
      source.verifiedRank
      ?? source.verifiedAptitude
      ?? source.confirmedRank
    );
    const requestedRank = trimmed(
      source.requestedRank
      ?? source.targetRank
      ?? source.requiredRank
      ?? requestedAptitudes[key]
      ?? 'A'
    );
    return {
      key,
      label: trimmed(source.nameZhTw ?? source.label) || key || `適性 ${index + 1}`,
      nativeRank: aptitudeRank(aptitudeRankIndex(nativeRank)),
      verifiedRank: aptitudeRank(aptitudeRankIndex(verifiedRank)),
      requestedRank: aptitudeRank(aptitudeRankIndex(requestedRank)) || 'A',
      requiredForAutonomous: source.requiredForAutonomous !== false
        && source.autonomous !== false
    };
  }

  function autonomousRequested(input = {}) {
    return input.automationMode === 'autonomous'
      || input.breedingAutomationMode === 'autonomous'
      || input.autonomous === true
      || input.autonomousSchedule === true
      || input.scheduleMode === 'autonomous';
  }

  function evaluateAptitudeFeasibility(input = {}) {
    const aggregation = input.redByKey
      ? { redByKey: input.redByKey, warnings: [] }
      : aggregateRedFactors(input.family ?? input.records ?? [], input);
    const rawRequirements = input.requirements
      ?? input.aptitudeRequirements
      ?? input.redFactorRequirements
      ?? [];
    const requirements = (Array.isArray(rawRequirements) ? rawRequirements : [rawRequirements])
      .map((value, index) => normalizeAptitudeRequirement(value, index, input))
      .filter(requirement => requirement.key);
    const warnings = [...(aggregation.warnings || [])];
    const aptitudePlan = requirements.map(requirement => {
      const bucket = aggregation.redByKey?.[requirement.key] || {
        starTotal: 0,
        startBonus: 0
      };
      const starTotal = Math.max(0, Number(bucket.starTotal) || 0);
      const startBonus = Math.max(0, Number(bucket.startBonus) || redStartingBonus(starTotal));
      const nativeIndex = aptitudeRankIndex(requirement.nativeRank);
      const verifiedIndex = aptitudeRankIndex(requirement.verifiedRank);
      const requestedIndex = aptitudeRankIndex(requirement.requestedRank);
      const baselineIndex = Math.max(nativeIndex ?? -1, verifiedIndex ?? -1);
      const redStartIndex = nativeIndex === null
        ? null
        : Math.min(aptitudeRankIndex('A'), nativeIndex + startBonus);
      const startIndex = Math.max(baselineIndex, redStartIndex ?? -1);
      const validStart = startIndex >= 0 ? startIndex : null;
      const requiresRedFactor = requestedIndex !== null
        && baselineIndex >= 0
        && requestedIndex > baselineIndex
        && validStart !== null
        && requestedIndex <= validStart;
      const needsLaterInheritance = requestedIndex !== null
        && (validStart === null || requestedIndex > validStart);
      const probabilityStatus = requiresRedFactor || needsLaterInheritance
        ? 'UNVERIFIED'
        : 'NOT_REQUIRED';
      return {
        key: requirement.key,
        label: requirement.label,
        nativeRank: requirement.nativeRank,
        verifiedRank: requirement.verifiedRank,
        starTotal,
        startBonus,
        startRank: aptitudeRank(validStart),
        requestedRank: requirement.requestedRank,
        requiresRedFactor,
        needsLaterInheritance,
        probabilityStatus,
        cappedAt: 'A'
      };
    });
    const useAutonomous = autonomousRequested(input);
    const autonomousDependencies = aptitudePlan.filter(item => item.requiresRedFactor || item.needsLaterInheritance);
    if (useAutonomous && autonomousDependencies.length) {
      warnings.push(issue(
        'AUTO_APTITUDE_INHERITANCE_UNVERIFIED',
        '自主育成排程依賴紅因子提高或後續隨機繼承的適性，不能當作已驗證可行。',
        'aptitudePlan',
        'warning',
        { keys: autonomousDependencies.map(item => item.key) }
      ));
    }
    const status = !useAutonomous
      ? 'NOT_REQUESTED'
      : (autonomousDependencies.length ? 'UNVERIFIED' : 'ELIGIBLE_NATIVE_OR_VERIFIED');
    return {
      redByKey: aggregation.redByKey,
      aptitudePlan,
      autonomousEligibility: {
        status,
        reasons: warnings.filter(warning => warning.code === 'AUTO_APTITUDE_INHERITANCE_UNVERIFIED')
      },
      warnings
    };
  }

  function summarizeFamilyFactors(family, options = {}) {
    const slots = options.includeTarget ? FAMILY_SLOTS : ANCESTOR_SLOTS;
    const byType = Object.fromEntries(FACTOR_TYPES.map(type => [
      type,
      { type, factorCount: 0, totalStars: 0 }
    ]));
    const whiteByKey = new Map();
    const factors = [];

    slots.forEach(slot => {
      const record = family?.[slot];
      factorList(record).forEach(factor => {
        const entry = { ...factor, slot, recordId: record?.id || null };
        factors.push(entry);
        const summary = byType[factor.type] || (byType[factor.type] = {
          type: factor.type,
          factorCount: 0,
          totalStars: 0
        });
        summary.factorCount += 1;
        summary.totalStars += Number.isFinite(factor.stars) ? factor.stars : 0;
        if (factor.type !== 'white') return;
        const key = comparisonKey(factor.key);
        if (!key) return;
        if (!whiteByKey.has(key)) {
          whiteByKey.set(key, {
            key: factor.key,
            nameZhTw: factor.nameZhTw,
            skillId: factor.skillId,
            occurrences: 0,
            totalStars: 0,
            maxStars: 0,
            slots: []
          });
        }
        const item = whiteByKey.get(key);
        item.occurrences += 1;
        item.totalStars += Number.isFinite(factor.stars) ? factor.stars : 0;
        item.maxStars = Math.max(item.maxStars, Number.isFinite(factor.stars) ? factor.stars : 0);
        item.slots.push(slot);
      });
    });
    const redFactors = aggregateRedFactors(family, { ...options, slots });
    return {
      slots,
      factorCount: factors.length,
      totalStars: factors.reduce(
        (sum, factor) => sum + (Number.isFinite(factor.stars) ? factor.stars : 0),
        0
      ),
      byType,
      whiteFactors: [...whiteByKey.values()],
      factors,
      redByKey: redFactors.redByKey,
      redFactors: redFactors.factors,
      redWarnings: redFactors.warnings
    };
  }

  function affinityRating(total, thresholds = {}) {
    const excellent = finiteNumber(thresholds.excellent, 151);
    const good = finiteNumber(thresholds.good, 51);
    if (!Number.isFinite(total)) return null;
    if (total >= excellent) return '◎';
    if (total >= good) return '○';
    return '△';
  }

  function calculateFamilyScore(family, affinityData, options = {}) {
    const baseAffinity = calculateBaseAffinity(family, affinityData, options.baseAffinity || {});
    const g1Options = {
      raceCatalog: options.raceCatalog ?? options.catalog ?? options.gameToraRaceCatalog,
      ruleset: options.ruleset,
      server: options.server,
      ...(options.g1Bonus || {})
    };
    const confirmedG1Bonus = calculateG1Bonus(family, g1Options);
    const projectedG1Bonus = calculateProjectedG1Bonus(family, g1Options);
    const factorSummary = summarizeFamilyFactors(family, options.factorSummary);
    const aptitudeOptions = isObject(options.aptitude) ? options.aptitude : {};
    const aptitudeFeasibility = evaluateAptitudeFeasibility({
      redByKey: factorSummary.redByKey,
      requirements: aptitudeOptions.requirements
        ?? options.aptitudeRequirements
        ?? options.redFactorRequirements
        ?? family?.target?.aptitudeRequirements
        ?? [],
      nativeAptitudes: aptitudeOptions.nativeAptitudes ?? options.nativeAptitudes,
      requestedAptitudes: aptitudeOptions.requestedAptitudes ?? options.requestedAptitudes,
      automationMode: aptitudeOptions.automationMode ?? options.automationMode,
      breedingAutomationMode: aptitudeOptions.breedingAutomationMode ?? options.breedingAutomationMode,
      autonomous: aptitudeOptions.autonomous ?? options.autonomous,
      autonomousSchedule: aptitudeOptions.autonomousSchedule ?? options.autonomousSchedule,
      scheduleMode: aptitudeOptions.scheduleMode ?? options.scheduleMode
    });
    const warnings = familyWarnings(family);
    warnings.push(...confirmedG1Bonus.warnings, ...projectedG1Bonus.warnings);
    warnings.push(...(factorSummary.redWarnings || []), ...aptitudeFeasibility.warnings);
    baseAffinity.pairs.filter(pair => pair.score === null).forEach(pair => {
      warnings.push(issue(
        'BASE_AFFINITY_PAIR_MISSING',
        '有一組基礎相性無法從目前矩陣計算。',
        `baseAffinity.${pair.id}`,
        'warning',
        {
          slots: pair.slots,
          leftKey: pair.leftKey,
          rightKey: pair.rightKey,
          status: pair.status
        }
      ));
    });
    const total = baseAffinity.total + confirmedG1Bonus.total;
    const complete = baseAffinity.complete
      && confirmedG1Bonus.complete
      && !(family?.unresolvedReferences || []).length;
    return {
      schemaVersion: SCHEMA_VERSION,
      ruleset: confirmedG1Bonus.ruleset,
      total,
      rating: complete ? affinityRating(total, options.ratingThresholds) : null,
      complete,
      breakdown: {
        baseAffinity: baseAffinity.total,
        g1Bonus: confirmedG1Bonus.total,
        total
      },
      baseAffinity,
      // `g1Bonus` remains as a compatibility alias. UI consumers should use the
      // explicit confirmed/projected fields so a planned rotation never appears
      // as earned score.
      g1Bonus: confirmedG1Bonus,
      confirmedG1Bonus,
      projectedG1Bonus,
      g1Edges: confirmedG1Bonus.pairs,
      factorSummary,
      redByKey: factorSummary.redByKey,
      aptitudePlan: aptitudeFeasibility.aptitudePlan,
      autonomousEligibility: aptitudeFeasibility.autonomousEligibility,
      warnings,
      family,
      assumptions: {
        baseAffinity: '使用相性矩陣的 7 組兩兩近似值；四組祖代項不是遊戲隱藏三者關係群的精確重建。',
        g1Bonus: '只計入 zh_tw-2024-06-27 規則下、可對上 GameTora canonical raceId 的已確認 G1 勝利；5 組關係每個共同 raceId 預設 +3（社群觀測），同場在同一組內去重，跨組可重複加分。預定賽程永不加入 confirmed 分數。',
        redFactors: '紅因子只按同一場地、距離或作戰鍵加總；0/1/4/7/10 星對應開局 +0/+1/+2/+3/+4，開局最高 A。後續繼承的發生機率維持 UNVERIFIED。',
        duplicateLineage: '重複角色或重複種馬只提出警告；除同角色矩陣配對記為 0 外，不額外臆測隱藏扣分。'
      }
    };
  }

  function calculateLineageScore(specification, database, affinityData, options = {}) {
    const family = buildFamily(specification, database);
    return calculateFamilyScore(family, affinityData, options);
  }

  return {
    SCHEMA_VERSION,
    FACTOR_TYPES,
    BREEDER_RECORD_SCHEMA,
    FAMILY_SLOTS,
    ANCESTOR_SLOTS,
    BASE_AFFINITY_PAIRS,
    G1_BONUS_PAIRS,
    ZH_TW_G1_RULESET,
    RED_FACTOR_THRESHOLDS,
    RED_FACTOR_KEYS,
    APTITUDE_RANKS,
    normalizeCharacter,
    normalizeFactor,
    normalizeRaceWin,
    normalizeG1Wins,
    g1Ruleset,
    catalogLookup,
    resolveCatalogRace,
    classifyG1RaceEvidence,
    classifyProjectedG1Race,
    normalizeBreederRecord,
    validateBreederRecord,
    normalizeBreederDatabase,
    validateBreederDatabase,
    buildFamily,
    familyWarnings,
    affinityScore,
    calculateBaseAffinity,
    calculateG1Bonus,
    calculateProjectedG1Bonus,
    summarizeFamilyFactors,
    canonicalRedFactorKey,
    redStartingBonus,
    aggregateRedFactors,
    evaluateAptitudeFeasibility,
    affinityRating,
    calculateFamilyScore,
    calculateLineageScore
  };
});
