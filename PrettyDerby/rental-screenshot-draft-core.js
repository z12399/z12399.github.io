(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RENTAL_SCREENSHOT_DRAFT_CORE = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // This module is intentionally a data-only boundary.  OCR observations are
  // suggestions for a human review screen; this module never treats pixels,
  // confidence, colour, or a detected star as user-confirmed evidence.
  const MODEL_VERSION = 'rental-screenshot-draft-core-v1';
  const DRAFT_SCHEMA = 'prettyderby-rental-screenshot-draft.v1';
  const INPUT_SCHEMA = 'prettyderby-rental-candidates.v1';
  const EVIDENCE_STATUS = 'OCR_DRAFT_UNCONFIRMED';
  const PROBABILITY_STATUS = 'NOT_COMPUTED';
  const KINDS = Object.freeze(['blue', 'red', 'unique', 'white']);
  const COLORS = new Set(['blue', 'red', 'green', 'neutral', 'unknown']);
  const BLUE_AXES = new Set(['speed', 'stamina', 'power', 'guts', 'wisdom']);
  const RED_AXES = new Set([
    'turf', 'dirt', 'short', 'mile', 'medium', 'long',
    'runner', 'leader', 'betweener', 'chaser'
  ]);
  const BLUE_AXIS_ALIASES = Object.freeze({
    速度: 'speed',
    耐力: 'stamina',
    力量: 'power',
    根性: 'guts',
    意志力: 'guts',
    智力: 'wisdom'
  });
  const RED_AXIS_ALIASES = Object.freeze({
    草地: 'turf',
    沙地: 'dirt',
    泥地: 'dirt',
    短距離: 'short',
    短距離適性: 'short',
    英里: 'mile',
    英里適性: 'mile',
    一哩: 'mile',
    一哩適性: 'mile',
    中距離: 'medium',
    中距離適性: 'medium',
    長距離: 'long',
    長距離適性: 'long',
    領頭: 'runner',
    逃馬: 'runner',
    前列: 'leader',
    先行: 'leader',
    居中: 'betweener',
    差馬: 'betweener',
    後追: 'chaser',
    追馬: 'chaser'
  });
  const FORBIDDEN_KEY_WORDS = new Set([
    'activation',
    'activationprobability',
    'activationrate',
    'chance',
    'count',
    'factorrate',
    'factorprobability',
    'inheritance',
    'inheritancechance',
    'inheritancerate',
    'inheritanceprobability',
    'probability',
    'rate',
    'successpercent',
    'successprobability',
    'winprobability',
    'winrate'
  ]);

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function hasOwn(source, key) {
    return Boolean(source) && Object.prototype.hasOwnProperty.call(source, key);
  }

  function clone(value) {
    if (Array.isArray(value)) return value.map(clone);
    if (isObject(value)) {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
    }
    return value;
  }

  function normalizedKey(value) {
    return typeof value === 'string'
      ? value.toLowerCase().replace(/[^a-z0-9]/g, '')
      : '';
  }

  function findForbiddenPath(value, path = '', allowDraftStatus = false) {
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        const found = findForbiddenPath(value[index], `${path}[${index}]`, allowDraftStatus);
        if (found) return found;
      }
      return null;
    }
    if (!isObject(value)) return null;
    for (const [key, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${key}` : key;
      const normalized = normalizedKey(key);
      const isAllowedDraftStatus = allowDraftStatus
        && path === ''
        && key === 'probabilityStatus'
        && child === PROBABILITY_STATUS;
      if (!isAllowedDraftStatus && (FORBIDDEN_KEY_WORDS.has(normalized)
        || normalized.includes('probability')
        || normalized.includes('inheritance')
        || normalized.includes('activation'))) {
        return childPath;
      }
      const found = findForbiddenPath(child, childPath, allowDraftStatus);
      if (found) return found;
    }
    return null;
  }

  function text(value) {
    if (typeof value !== 'string') return null;
    // OCR often inserts spaces between Han characters, while English skill
    // names such as "Joy to the World" contain meaningful spaces.
    const result = value
      .trim()
      .replace(/\s+/gu, ' ')
      .replace(/([\p{Script=Han}])\s+(?=[\p{Script=Han}])/gu, '$1')
      .replace(/([\p{Script=Han}])\s+(?=[A-Za-z0-9])/gu, '$1')
      .replace(/([A-Za-z0-9])\s+(?=[\p{Script=Han}])/gu, '$1');
    return result || null;
  }

  function normalizedFactorKey(value) {
    return text(value)?.replace(/\s+/gu, '').toLowerCase() || '';
  }

  function finite(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const result = Number(trimmed);
    return Number.isFinite(result) ? result : null;
  }

  function finiteInRange(value, min, max) {
    const result = finite(value);
    return result !== null && result >= min && result <= max ? result : null;
  }

  function strictInteger(value) {
    if (typeof value === 'number') {
      return Number.isSafeInteger(value) ? value : null;
    }
    if (typeof value !== 'string' || !/^[-+]?\d+$/u.test(value.trim())) return null;
    const result = Number(value.trim());
    return Number.isSafeInteger(result) ? result : null;
  }

  function normalizeId(value) {
    if (typeof value === 'string') {
      const result = value.trim();
      return result || null;
    }
    const number = finite(value);
    return number === null ? null : String(number);
  }

  function normalizeSourceId(value, pageIndex) {
    const id = normalizeId(value);
    return id || `page-${pageIndex + 1}`;
  }

  function normalizeColor(value) {
    if (typeof value !== 'string') return 'unknown';
    const result = value.trim().toLowerCase();
    return COLORS.has(result) ? result : 'unknown';
  }

  function suggestedKind(colorHint) {
    return ({
      blue: 'blue',
      red: 'red',
      green: 'unique',
      neutral: 'white',
      unknown: 'unknown'
    })[colorHint] || 'unknown';
  }

  function normalizeStars(value) {
    if (value === null || value === undefined) return null;
    const result = strictInteger(value);
    return result !== null && result >= 1 && result <= 3 ? result : null;
  }

  function normalizeBBox(value) {
    if (!isObject(value)) return null;
    const fields = ['x', 'y', 'width', 'height'];
    const result = {};
    for (const field of fields) {
      const number = finite(value[field]);
      if (number === null || number < 0) return null;
      result[field] = number;
    }
    return result;
  }

  function normalizeConfidence(value) {
    return finiteInRange(value, 0, 1);
  }

  function errorResult(code, path = null, warnings = []) {
    const error = { code };
    if (path) error.path = path;
    return {
      modelVersion: MODEL_VERSION,
      draftSchema: DRAFT_SCHEMA,
      inputSchema: INPUT_SCHEMA,
      status: 'BLOCKED',
      evidenceStatus: EVIDENCE_STATUS,
      probabilityStatus: PROBABILITY_STATUS,
      rows: [],
      unresolved: path ? [path] : [],
      errors: [error],
      warnings: clone(warnings)
    };
  }

  function normalizeRow(raw, pageIndex, rowIndex, sourceId) {
    if (!isObject(raw)) {
      return {
        row: null,
        error: { code: 'ROW_MUST_BE_OBJECT', path: `pages[${pageIndex}].rows[${rowIndex}]` }
      };
    }
    const factorText = text(raw.text);
    const rawText = typeof raw.rawText === 'string' ? raw.rawText : (typeof raw.text === 'string' ? raw.text : null);
    const colorHint = normalizeColor(raw.colorHint);
    const detectedStars = hasOwn(raw, 'detectedStars')
      ? normalizeStars(raw.detectedStars)
      : null;
    const confidence = hasOwn(raw, 'confidence') ? normalizeConfidence(raw.confidence) : null;
    const reasons = [];
    if (!factorText) reasons.push('factor text is missing or invalid');
    if (colorHint === 'unknown') reasons.push('factor kind is UNKNOWN; colour is only a suggestion');
    if (hasOwn(raw, 'detectedStars') && detectedStars === null) {
      reasons.push('detected star count is missing or invalid and must be confirmed');
    } else {
      reasons.push('star count is an OCR suggestion and must be confirmed');
    }
    reasons.push('OCR row requires user confirmation');
    const suggested = suggestedKind(colorHint);
    return {
      row: {
        rowId: `row-${pageIndex + 1}-${rowIndex + 1}`,
        text: factorText,
        rawText,
        suggestedKind: suggested,
        kind: null,
        suggestedStars: detectedStars,
        stars: null,
        confidence,
        bbox: normalizeBBox(raw.bbox),
        sourceIds: [sourceId],
        confirmed: false,
        requiresConfirmation: true,
        ...(suggested === 'white' ? { effectiveForCmOaks: null } : {}),
        unresolvedReasons: reasons
      },
      error: null
    };
  }

  function mergeRows(rows) {
    const merged = [];
    const byKey = new Map();
    rows.forEach((row) => {
      if (!row.text) {
        merged.push(row);
        return;
      }
      // Include the suggested kind in the key.  A matching label in a blue,
      // unique, and white row is not safe to collapse into one factor.
      const key = `${row.suggestedKind}|${normalizedFactorKey(row.text)}`;
      const existingIndex = byKey.get(key);
      if (existingIndex === undefined) {
        byKey.set(key, merged.length);
        merged.push(row);
        return;
      }
      const existing = merged[existingIndex];
      existing.sourceIds = [...new Set([...existing.sourceIds, ...row.sourceIds])];
      if (existing.confidence === null) existing.confidence = row.confidence;
      else if (row.confidence !== null) existing.confidence = Math.max(existing.confidence, row.confidence);
      if (!existing.bbox && row.bbox) existing.bbox = clone(row.bbox);
      if (existing.rawText === null && row.rawText !== null) existing.rawText = row.rawText;
      const stars = [existing.suggestedStars, row.suggestedStars].filter(item => item !== null);
      existing.suggestedStars = stars.length && new Set(stars).size === 1 ? stars[0] : null;
      if (new Set(stars).size > 1) {
        existing.unresolvedReasons = [...new Set([
          ...existing.unresolvedReasons,
          'duplicate OCR rows disagree on star count; confirm manually'
        ])];
      }
    });
    return merged.map((row, index) => ({
      ...row,
      rowId: `row-${index + 1}`,
      sourceIds: [...row.sourceIds]
    }));
  }

  function identityValue(source, keys, normalizer) {
    for (const key of keys) {
      if (hasOwn(source, key)) return normalizer(source[key]);
    }
    return null;
  }

  function buildDraft(input = {}) {
    if (!isObject(input)) return errorResult('INPUT_MUST_BE_OBJECT', 'root');
    const forbiddenPath = findForbiddenPath(input);
    if (forbiddenPath) return errorResult('FORBIDDEN_PROBABILITY_FIELD', forbiddenPath);
    if (!Array.isArray(input.pages)) return errorResult('PAGES_MUST_BE_ARRAY', 'pages');
    if (!input.pages.length) return errorResult('PAGES_MUST_NOT_BE_EMPTY', 'pages');

    const identity = {
      candidateId: identityValue(input, ['candidateId', 'candidate_id', 'id'], normalizeId),
      candidateName: identityValue(input, ['candidateName', 'candidate_name', 'nameZhTw', 'name'], text)
    };
    const rows = [];
    const warnings = [];
    for (let pageIndex = 0; pageIndex < input.pages.length; pageIndex += 1) {
      const page = input.pages[pageIndex];
      if (!isObject(page)) return errorResult('PAGE_MUST_BE_OBJECT', `pages[${pageIndex}]`);
      if (!Array.isArray(page.rows)) return errorResult('PAGE_ROWS_MUST_BE_ARRAY', `pages[${pageIndex}].rows`);
      const sourceId = normalizeSourceId(page.sourceId, pageIndex);
      if (!hasOwn(page, 'sourceId')) warnings.push({
        code: 'SOURCE_ID_GENERATED_FOR_LOCAL_PAGE',
        pageIndex,
        sourceId
      });
      for (let rowIndex = 0; rowIndex < page.rows.length; rowIndex += 1) {
        const normalized = normalizeRow(page.rows[rowIndex], pageIndex, rowIndex, sourceId);
        if (normalized.error) return errorResult(normalized.error.code, normalized.error.path);
        rows.push(normalized.row);
      }
    }
    if (!rows.length) return errorResult('ROWS_MUST_NOT_BE_EMPTY', 'pages[].rows');

    const mergedRows = mergeRows(rows);
    const unresolved = [];
    if (!identity.candidateId) unresolved.push('candidateId');
    if (!identity.candidateName) unresolved.push('candidateName');
    mergedRows.forEach(row => unresolved.push(`rows.${row.rowId}.confirmation`));
    return {
      modelVersion: MODEL_VERSION,
      draftSchema: DRAFT_SCHEMA,
      inputSchema: INPUT_SCHEMA,
      status: 'NEEDS_CONFIRMATION',
      evidenceStatus: EVIDENCE_STATUS,
      probabilityStatus: PROBABILITY_STATUS,
      candidateId: identity.candidateId,
      candidateName: identity.candidateName,
      identity: {
        candidateId: identity.candidateId,
        candidateName: identity.candidateName,
        requiresConfirmation: true
      },
      rows: mergedRows,
      unresolved,
      errors: [],
      warnings
    };
  }

  function normalizeKind(value) {
    if (typeof value !== 'string') return null;
    const result = value.trim().toLowerCase();
    return KINDS.includes(result) ? result : null;
  }

  function normalizeAxis(value, kind) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim().toLowerCase();
    if (kind === 'blue') {
      return BLUE_AXES.has(trimmed) ? trimmed : (BLUE_AXIS_ALIASES[value.trim()] || null);
    }
    if (kind === 'red') {
      return RED_AXES.has(trimmed) ? trimmed : (RED_AXIS_ALIASES[value.trim()] || null);
    }
    return null;
  }

  function rowEditMap(edits) {
    if (!hasOwn(edits, 'rows')) return { ok: true, rows: new Map() };
    if (Array.isArray(edits.rows)) {
      const map = new Map();
      for (let index = 0; index < edits.rows.length; index += 1) {
        const item = edits.rows[index];
        if (!isObject(item)) return { ok: false, result: errorResult('ROW_EDIT_MUST_BE_OBJECT', `edits.rows[${index}]`) };
        const rowId = text(item.rowId);
        if (!rowId) return { ok: false, result: errorResult('ROW_EDIT_ID_REQUIRED', `edits.rows[${index}].rowId`) };
        if (map.has(rowId)) return { ok: false, result: errorResult('DUPLICATE_ROW_EDIT_ID', `edits.rows[${index}].rowId`) };
        map.set(rowId, item);
      }
      return { ok: true, rows: map };
    }
    if (isObject(edits.rows)) {
      const map = new Map();
      for (const [rowId, value] of Object.entries(edits.rows)) {
        if (!isObject(value)) return { ok: false, result: errorResult('ROW_EDIT_MUST_BE_OBJECT', `edits.rows.${rowId}`) };
        map.set(rowId, { ...value, rowId });
      }
      return { ok: true, rows: map };
    }
    return { ok: false, result: errorResult('EDITS_ROWS_MUST_BE_ARRAY_OR_OBJECT', 'edits.rows') };
  }

  function identityFromEdits(draft, edits) {
    const id = hasOwn(edits, 'candidateId')
      ? normalizeId(edits.candidateId)
      : hasOwn(edits, 'candidate_id')
        ? normalizeId(edits.candidate_id)
        : normalizeId(draft.candidateId);
    const name = hasOwn(edits, 'candidateName')
      ? text(edits.candidateName)
      : hasOwn(edits, 'candidate_name')
        ? text(edits.candidate_name)
        : text(draft.candidateName);
    return { id, name };
  }

  function confirmedRow(row, edit) {
    if (edit?.discarded === true) {
      if (edit.confirmed === true) return { error: { code: 'ROW_EDIT_STATE_CONFLICT', rowId: row.rowId } };
      return { discarded: true };
    }
    if (!edit || edit.confirmed !== true) return { row: null, unresolved: 'not confirmed' };
    const kind = normalizeKind(edit.kind);
    const factorText = hasOwn(edit, 'text') ? text(edit.text) : row.text;
    const stars = hasOwn(edit, 'stars') ? normalizeStars(edit.stars) : null;
    if (!factorText) return { error: { code: 'CONFIRMED_ROW_TEXT_REQUIRED', rowId: row.rowId } };
    if (!kind) return { error: { code: 'CONFIRMED_ROW_KIND_REQUIRED', rowId: row.rowId } };
    if (stars === null) return { error: { code: 'CONFIRMED_ROW_STARS_REQUIRED', rowId: row.rowId } };
    const result = {
      rowId: row.rowId,
      text: factorText,
      kind,
      stars,
      sourceIds: [...row.sourceIds],
      confirmed: true,
      evidenceStatus: 'USER_CONFIRMED_FROM_OCR_DRAFT'
    };
    if (kind === 'white') {
      if (hasOwn(edit, 'effectiveForCmOaks') && typeof edit.effectiveForCmOaks !== 'boolean') {
        return { error: { code: 'WHITE_EFFECTIVE_FLAG_MUST_BE_BOOLEAN', rowId: row.rowId } };
      }
      result.effectiveForCmOaks = hasOwn(edit, 'effectiveForCmOaks')
        ? edit.effectiveForCmOaks
        : null;
    }
    if (kind === 'blue' || kind === 'red') {
      const axis = normalizeAxis(edit.axis, kind);
      if (!axis) return { error: { code: 'CONFIRMED_ROW_AXIS_REQUIRED', rowId: row.rowId } };
      result.axis = axis;
    }
    if (kind === 'unique') {
      if (hasOwn(edit, 'skillId')) {
        const skillId = strictInteger(edit.skillId);
        if (skillId === null || skillId < 0) {
          return { error: { code: 'UNIQUE_SKILL_ID_INVALID', rowId: row.rowId } };
        }
        result.skillId = skillId;
      }
    }
    return { row: result };
  }

  function candidateFromConfirmedRows(id, name, rows) {
    const candidate = { id, sourceStatus: 'USER_CONFIRMED_SCREENSHOT_TRANSCRIPTION' };
    if (name) candidate.nameZhTw = name;
    const blue = {};
    const red = {};
    const white = [];
    const unique = [];
    rows.forEach((row) => {
      if (row.kind === 'blue') blue[row.axis] = row.stars;
      if (row.kind === 'red') red[row.axis] = row.stars;
      if (row.kind === 'white') white.push(row);
      if (row.kind === 'unique') unique.push(row);
    });
    if (Object.keys(blue).length) candidate.bodyBlue = blue;
    if (Object.keys(red).length) candidate.bodyRed = red;
    if (unique.length === 1) {
      const row = unique[0];
      candidate.bodyUnique = {
        ...(row.skillId === undefined ? {} : { skillId: row.skillId }),
        nameZhTw: row.text,
        stars: row.stars
      };
    }
    if (unique.length > 1) return { error: { code: 'MULTIPLE_CONFIRMED_UNIQUE_FACTORS' } };
    if (white.length) {
      const effectiveRows = white.filter(row => row.effectiveForCmOaks === true);
      const unresolvedEffective = white.some(row => row.effectiveForCmOaks === null);
      candidate.directlyUsefulBodyWhiteFamilies = effectiveRows.map(row => row.text);
      if (!unresolvedEffective) {
        candidate.effectiveWhiteCount = effectiveRows.length;
        candidate.effectiveWhiteCountStatus = 'USER_CONFIRMED_FROM_OCR_DRAFT';
      }
    }
    return { candidate };
  }

  function finalizeCandidate(draft, edits = {}) {
    if (!isObject(draft)) return errorResult('DRAFT_MUST_BE_OBJECT', 'draft');
    const forbiddenDraftPath = findForbiddenPath(draft, '', true);
    if (forbiddenDraftPath) return errorResult('FORBIDDEN_PROBABILITY_FIELD', `draft.${forbiddenDraftPath}`);
    if (!isObject(edits)) return errorResult('EDITS_MUST_BE_OBJECT', 'edits');
    const forbiddenEditPath = findForbiddenPath(edits);
    if (forbiddenEditPath) return errorResult('FORBIDDEN_PROBABILITY_FIELD', `edits.${forbiddenEditPath}`);
    if (!Array.isArray(draft.rows)) return errorResult('DRAFT_ROWS_MUST_BE_ARRAY', 'draft.rows');
    const identity = identityFromEdits(draft, edits);
    if (!identity.id) return errorResult('CANDIDATE_ID_REQUIRED', 'candidateId');
    const mapped = rowEditMap(edits);
    if (!mapped.ok) return mapped.result;
    const draftIds = new Set(draft.rows.map(row => row.rowId));
    for (const rowId of mapped.rows.keys()) {
      if (!draftIds.has(rowId)) return errorResult('UNKNOWN_ROW_EDIT_ID', `edits.rows.${rowId}`);
    }

    const confirmed = [];
    const discarded = [];
    const unresolved = [];
    for (const row of draft.rows) {
      if (!isObject(row) || !text(row.rowId)) return errorResult('DRAFT_ROW_INVALID', 'draft.rows');
      const result = confirmedRow(row, mapped.rows.get(row.rowId));
      if (result.error) return errorResult(result.error.code, `rows.${row.rowId}`);
      if (result.row) confirmed.push(result.row);
      else if (result.discarded) discarded.push(row.rowId);
      else unresolved.push(`rows.${row.rowId}.confirmation`);
    }
    const materialized = candidateFromConfirmedRows(identity.id, identity.name, confirmed);
    if (materialized.error) return errorResult(materialized.error.code, 'rows');

    const allConfirmed = unresolved.length === 0;
    const warnings = [];
    if (unresolved.length) warnings.push({
      code: 'UNCONFIRMED_ROWS_OMITTED',
      rowIds: unresolved.map(item => item.split('.')[1])
    });
    if (!confirmed.length) warnings.push({ code: 'NO_CONFIRMED_FACTOR_ROWS' });
    if (confirmed.some(row => row.kind === 'white' && row.effectiveForCmOaks === null)) {
      warnings.push({ code: 'WHITE_EFFECTIVENESS_REMAINS_UNKNOWN' });
    }
    const status = allConfirmed ? 'READY' : 'NEEDS_CONFIRMATION';
    return {
      modelVersion: MODEL_VERSION,
      draftSchema: DRAFT_SCHEMA,
      inputSchema: INPUT_SCHEMA,
      status,
      evidenceStatus: EVIDENCE_STATUS,
      probabilityStatus: PROBABILITY_STATUS,
      candidate: materialized.candidate,
      rows: confirmed,
      discardedRowIds: discarded,
      unresolved,
      errors: [],
      warnings
    };
  }

  return {
    MODEL_VERSION,
    DRAFT_SCHEMA,
    INPUT_SCHEMA,
    EVIDENCE_STATUS,
    PROBABILITY_STATUS,
    KINDS,
    buildDraft,
    finalizeCandidate,
    normalizeStars,
    normalizeColor,
    suggestedKind
  };
});
