(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RENTAL_SCREENSHOT_IMPORT_UI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  const MODEL_VERSION = 'rental-screenshot-import-ui-v1';
  const ACCEPTED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
  const EFFECTIVE_WHITE_SUGGESTIONS = new Set([
    '青春點火・智慧',
    '乘順風而行',
    '領先到底的姿勢',
    '正面突破',
    '逆時針○'
  ]);
  const KIND_LABELS = Object.freeze({
    blue: '藍因子',
    red: '紅因子',
    unique: '固有',
    white: '白因子'
  });
  const AXIS_OPTIONS = Object.freeze({
    blue: [
      ['speed', '速度'],
      ['stamina', '耐力'],
      ['power', '力量'],
      ['guts', '意志力'],
      ['wisdom', '智力']
    ],
    red: [
      ['turf', '草地'],
      ['dirt', '沙地'],
      ['short', '短距離'],
      ['mile', '一哩'],
      ['medium', '中距離'],
      ['long', '長距離'],
      ['runner', '領頭'],
      ['leader', '前列'],
      ['betweener', '居中'],
      ['chaser', '後追']
    ]
  });
  const AXIS_ALIASES = Object.freeze({
    速度: 'speed',
    耐力: 'stamina',
    力量: 'power',
    根性: 'guts',
    意志力: 'guts',
    智力: 'wisdom',
    草地: 'turf',
    沙地: 'dirt',
    泥地: 'dirt',
    短距離: 'short',
    英里: 'mile',
    一哩: 'mile',
    中距離: 'medium',
    長距離: 'long',
    領頭: 'runner',
    逃馬: 'runner',
    前列: 'leader',
    先行: 'leader',
    居中: 'betweener',
    差馬: 'betweener',
    後追: 'chaser',
    追馬: 'chaser'
  });

  function text(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function normalizedSkillName(value) {
    return text(value)
      .replace(/[．.]/g, '・')
      .replace(/\s+/g, '')
      .replace(/[O0]$/i, '○');
  }

  function makeOption(value, label, selected = false) {
    const option = root.document.createElement('option');
    option.value = value;
    option.textContent = label;
    option.selected = selected;
    return option;
  }

  function fileKey(file) {
    return `${file.name || ''}|${file.type || ''}|${file.size || 0}|${file.lastModified || 0}`;
  }

  function displayError(error) {
    const code = error?.code || 'UNKNOWN_ERROR';
    return ({
      IMAGE_FILE_REQUIRED: '只接受 PNG、JPG 或 WebP 截圖。',
      IMAGE_TOO_LARGE: '單張截圖不可超過 12 MB。',
      IMAGE_TOO_MANY_PIXELS: '截圖像素過大，請先縮小後再試。',
      TOO_MANY_IMAGES: '同一匹候選一次最多六張截圖。',
      IMAGE_DECODE_FAILED: '這張圖片無法解碼。',
      FACTOR_ROWS_NOT_FOUND: '沒有找到可辨識的因子列，請換一張較完整的截圖。',
      OCR_RUNTIME_LOAD_FAILED: '本機 OCR 資源沒有載入成功。請確認 assets/vendor 內的 OCR 資源完整。',
      OCR_API_UNAVAILABLE: 'OCR 程式載入後沒有提供可用 API。',
      CANDIDATE_ID_REQUIRED: '請填入候選 ID。',
      CONFIRMED_ROW_TEXT_REQUIRED: '採用列必須有因子名稱。',
      CONFIRMED_ROW_KIND_REQUIRED: '採用列必須選擇因子類型。',
      CONFIRMED_ROW_STARS_REQUIRED: '採用列必須確認 1～3 星。',
      CONFIRMED_ROW_AXIS_REQUIRED: '藍／紅因子必須確認能力或適性種類。',
      MULTIPLE_CONFIRMED_UNIQUE_FACTORS: '一匹候選只能採用一個本體固有。',
      ROW_EDIT_STATE_CONFLICT: '同一列不能同時採用與排除。'
    })[code] || error?.message || '這批截圖尚未通過檢查。';
  }

  function mount(options = {}) {
    const container = options.root || root.document?.getElementById('rentalScreenshotImport');
    if (!container || container.dataset.mounted === MODEL_VERSION) return null;
    const draftCore = options.draftCore || root.RENTAL_SCREENSHOT_DRAFT_CORE;
    const ocrClient = options.ocrClient || root.RENTAL_SCREENSHOT_OCR_CLIENT;
    const jsonInput = options.jsonInput || root.document.getElementById('cmOaksRentalInput');
    const elements = {
      dropzone: root.document.getElementById('rentalScreenshotDropzone'),
      pick: root.document.getElementById('rentalScreenshotPick'),
      file: root.document.getElementById('rentalScreenshotFile'),
      clear: root.document.getElementById('rentalScreenshotClear'),
      recognize: root.document.getElementById('rentalScreenshotRecognize'),
      preview: root.document.getElementById('rentalScreenshotPreview'),
      groupWrap: root.document.getElementById('rentalScreenshotGroupConfirmWrap'),
      groupConfirm: root.document.getElementById('rentalScreenshotGroupConfirm'),
      status: root.document.getElementById('rentalScreenshotStatus'),
      review: root.document.getElementById('rentalScreenshotReview'),
      candidateId: root.document.getElementById('rentalScreenshotCandidateId'),
      candidateName: root.document.getElementById('rentalScreenshotCandidateName'),
      confirmAll: root.document.getElementById('rentalScreenshotConfirmAll'),
      rows: root.document.getElementById('rentalScreenshotRows'),
      addCandidate: root.document.getElementById('rentalScreenshotAddCandidate'),
      candidates: root.document.getElementById('rentalScreenshotCandidates'),
      candidateList: root.document.getElementById('rentalScreenshotCandidateList')
    };
    if (!draftCore?.buildDraft || !draftCore?.finalizeCandidate || !ocrClient?.recognizeFiles
      || !jsonInput || Object.values(elements).some(element => !element)) {
      container.dataset.status = 'UNAVAILABLE';
      if (elements.status) elements.status.textContent = '截圖整理模組尚未載入；仍可直接貼候選 JSON。';
      return null;
    }

    const state = {
      files: [],
      previewUrls: [],
      draft: null,
      candidates: [],
      busy: false
    };

    function setStatus(message, status = 'IDLE') {
      container.dataset.status = status;
      elements.status.dataset.status = status;
      elements.status.textContent = message;
    }

    function updateRecognizeAvailability() {
      const groupingReady = state.files.length <= 1 || elements.groupConfirm.checked;
      elements.recognize.disabled = state.busy || !state.files.length || !groupingReady;
      elements.clear.disabled = state.busy || !state.files.length;
      elements.pick.disabled = state.busy;
    }

    function releasePreviews() {
      state.previewUrls.forEach(url => root.URL.revokeObjectURL(url));
      state.previewUrls = [];
    }

    function renderFiles() {
      releasePreviews();
      elements.preview.replaceChildren();
      state.files.forEach((file, index) => {
        const article = root.document.createElement('article');
        const image = root.document.createElement('img');
        const url = root.URL.createObjectURL(file);
        state.previewUrls.push(url);
        image.src = url;
        image.alt = `第 ${index + 1} 張候選截圖預覽`;
        const label = root.document.createElement('span');
        label.textContent = `${index + 1}. ${file.name || '剪貼簿圖片'}`;
        const remove = root.document.createElement('button');
        remove.type = 'button';
        remove.textContent = '移除';
        remove.dataset.removeFileIndex = String(index);
        article.append(image, label, remove);
        elements.preview.append(article);
      });
      elements.groupWrap.hidden = state.files.length <= 1;
      if (state.files.length <= 1) elements.groupConfirm.checked = false;
      elements.review.hidden = true;
      state.draft = null;
      updateRecognizeAvailability();
      setStatus(
        state.files.length
          ? `已加入 ${state.files.length} 張；多張圖片必須是同一匹候選。`
          : '尚未加入截圖。',
        state.files.length ? 'FILES_READY' : 'IDLE'
      );
    }

    function addFiles(rawFiles) {
      const incoming = Array.from(rawFiles || []).filter(file => ACCEPTED_IMAGE_TYPES.has(String(file?.type || '').toLowerCase()));
      if (!incoming.length) {
        setStatus('沒有找到 PNG、JPG 或 WebP 圖片。', 'ERROR');
        return;
      }
      const byKey = new Map(state.files.map(file => [fileKey(file), file]));
      incoming.forEach(file => byKey.set(fileKey(file), file));
      const combined = [...byKey.values()];
      if (combined.length > 6) {
        setStatus('同一匹候選一次最多六張截圖。', 'ERROR');
        return;
      }
      state.files = combined;
      renderFiles();
    }

    function clearCurrentBatch() {
      state.files = [];
      state.draft = null;
      elements.file.value = '';
      elements.groupConfirm.checked = false;
      elements.candidateId.value = '';
      elements.candidateName.value = '';
      elements.rows.replaceChildren();
      elements.review.hidden = true;
      renderFiles();
    }

    function inferAxis(row) {
      return AXIS_ALIASES[text(row.text)] || '';
    }

    function detailControl(rowElement, kind, row) {
      const detail = rowElement.querySelector('[data-row-detail]');
      detail.replaceChildren();
      if (kind === 'blue' || kind === 'red') {
        const label = root.document.createElement('label');
        label.textContent = kind === 'blue' ? '能力 ' : '適性 ';
        const select = root.document.createElement('select');
        select.dataset.field = 'axis';
        select.append(makeOption('', '請選擇'));
        const suggested = inferAxis(row);
        AXIS_OPTIONS[kind].forEach(([value, optionLabel]) => {
          select.append(makeOption(value, optionLabel, value === suggested));
        });
        label.append(select);
        detail.append(label);
        return;
      }
      if (kind === 'white') {
        const label = root.document.createElement('label');
        label.className = 'rental-screenshot-effective';
        const input = root.document.createElement('input');
        input.type = 'checkbox';
        input.dataset.field = 'effective';
        input.checked = EFFECTIVE_WHITE_SUGGESTIONS.has(normalizedSkillName(row.text));
        label.append(input, root.document.createTextNode(' 本期有效'));
        if (input.checked) {
          const badge = root.document.createElement('small');
          badge.textContent = '依目前 CM 目標預先勾選，仍請確認';
          label.append(badge);
        }
        detail.append(label);
        return;
      }
      if (kind === 'unique') {
        const label = root.document.createElement('label');
        label.textContent = '技能 ID（可留空） ';
        const input = root.document.createElement('input');
        input.type = 'text';
        input.inputMode = 'numeric';
        input.dataset.field = 'skillId';
        label.append(input);
        detail.append(label);
        return;
      }
      const unresolved = root.document.createElement('small');
      unresolved.textContent = '先確認因子類型';
      detail.append(unresolved);
    }

    function renderReview(draft, ocrResult) {
      elements.rows.replaceChildren();
      const suggestedNames = [...new Set((ocrResult.pages || [])
        .map(page => text(page.identity?.suggestedName))
        .filter(Boolean))];
      elements.candidateId.value = text(draft.candidateId);
      elements.candidateName.value = suggestedNames.length === 1 ? suggestedNames[0] : text(draft.candidateName);

      draft.rows.forEach(row => {
        const article = root.document.createElement('article');
        article.dataset.rowId = row.rowId;

        const reviewLabel = root.document.createElement('label');
        reviewLabel.textContent = '處理 ';
        const reviewSelect = root.document.createElement('select');
        reviewSelect.dataset.field = 'review';
        reviewSelect.append(
          makeOption('pending', '待確認', true),
          makeOption('confirmed', '採用'),
          makeOption('discarded', '排除')
        );
        reviewLabel.append(reviewSelect);

        const kindLabel = root.document.createElement('label');
        kindLabel.textContent = '類型 ';
        const kindSelect = root.document.createElement('select');
        kindSelect.dataset.field = 'kind';
        kindSelect.append(makeOption('', '不確定', !KIND_LABELS[row.suggestedKind]));
        Object.entries(KIND_LABELS).forEach(([value, label]) => {
          kindSelect.append(makeOption(value, label, value === row.suggestedKind));
        });
        kindLabel.append(kindSelect);

        const textLabel = root.document.createElement('label');
        textLabel.textContent = '名稱 ';
        const nameInput = root.document.createElement('input');
        nameInput.type = 'text';
        nameInput.dataset.field = 'text';
        nameInput.value = row.text || '';
        textLabel.append(nameInput);

        const starsLabel = root.document.createElement('label');
        starsLabel.textContent = '星數 ';
        const starsSelect = root.document.createElement('select');
        starsSelect.dataset.field = 'stars';
        starsSelect.append(makeOption('', '請確認', row.suggestedStars === null));
        [1, 2, 3].forEach(stars => starsSelect.append(makeOption(String(stars), `${stars}★`, row.suggestedStars === stars)));
        starsLabel.append(starsSelect);

        const detail = root.document.createElement('div');
        detail.dataset.rowDetail = 'true';
        article.append(reviewLabel, kindLabel, textLabel, starsLabel, detail);
        kindSelect.addEventListener('change', () => detailControl(article, kindSelect.value, {
          ...row,
          text: nameInput.value
        }));
        detailControl(article, kindSelect.value, row);
        elements.rows.append(article);
      });
      elements.review.hidden = false;
      setStatus(`辨識出 ${draft.rows.length} 列。請逐列採用或排除，再加入 JSON。`, 'NEEDS_CONFIRMATION');
      elements.candidateId.focus();
    }

    function progressText(progress) {
      if (progress.status === 'recognizing_rows') {
        return `正在辨識第 ${Number(progress.fileIndex) + 1} 張：${Number(progress.rowIndex) + 1}/${progress.rowCount} 列…`;
      }
      if (progress.status === 'recognizing_image') {
        return `正在整理第 ${Number(progress.fileIndex) + 1}/${progress.fileCount} 張截圖…`;
      }
      return ({
        'loading tesseract core': '正在載入本機 OCR 核心…',
        'loading language traineddata': '正在載入繁中與英文辨識資料…',
        'initializing tesseract': '正在初始化本機 OCR…',
        'recognizing text': '正在辨識文字…'
      })[String(progress.status || '').toLowerCase()] || '正在準備本機 OCR…';
    }

    async function recognizeCurrentBatch() {
      if (state.busy || !state.files.length) return;
      if (state.files.length > 1 && !elements.groupConfirm.checked) {
        setStatus('請先確認這批圖片屬於同一匹候選。', 'ERROR');
        return;
      }
      state.busy = true;
      updateRecognizeAvailability();
      elements.review.hidden = true;
      setStatus('正在載入本機 OCR；第一次會比之後久。', 'LOADING');
      try {
        const result = await ocrClient.recognizeFiles(state.files, {
          onProgress(progress) {
            setStatus(progressText(progress), 'LOADING');
          }
        });
        const candidateNames = [...new Set(result.pages
          .map(page => text(page.identity?.suggestedName))
          .filter(Boolean))];
        const draft = draftCore.buildDraft({
          pages: result.pages,
          candidateName: candidateNames.length === 1 ? candidateNames[0] : undefined
        });
        if (draft.status === 'BLOCKED') {
          throw Object.assign(new Error('OCR 草稿沒有通過資料檢查。'), draft.errors?.[0] || {});
        }
        state.draft = draft;
        renderReview(draft, result);
      } catch (error) {
        setStatus(displayError(error), 'ERROR');
      } finally {
        state.busy = false;
        updateRecognizeAvailability();
      }
    }

    function collectRowEdits() {
      return Array.from(elements.rows.querySelectorAll('[data-row-id]')).map(article => {
        const rowId = article.dataset.rowId;
        const review = article.querySelector('[data-field="review"]').value;
        if (review === 'discarded') return { rowId, discarded: true };
        if (review !== 'confirmed') return { rowId };
        const kind = article.querySelector('[data-field="kind"]').value;
        const edit = {
          rowId,
          confirmed: true,
          kind,
          text: article.querySelector('[data-field="text"]').value,
          stars: article.querySelector('[data-field="stars"]').value
        };
        const axis = article.querySelector('[data-field="axis"]');
        const effective = article.querySelector('[data-field="effective"]');
        const skillId = article.querySelector('[data-field="skillId"]');
        if (axis) edit.axis = axis.value;
        if (effective) edit.effectiveForCmOaks = effective.checked;
        if (skillId && text(skillId.value)) edit.skillId = skillId.value;
        return edit;
      });
    }

    function parseCurrentPayload() {
      const source = text(jsonInput.value);
      if (!source) return [];
      let payload;
      try {
        payload = JSON.parse(source);
      } catch {
        throw Object.assign(new Error('下方 JSON 目前無法解析；請先修正或清空，避免覆蓋。'), { code: 'EXISTING_JSON_INVALID' });
      }
      if (payload?.schemaVersion !== 'prettyderby-rental-candidates.v1' || !Array.isArray(payload.candidates)) {
        throw Object.assign(new Error('下方 JSON 不是 prettyderby-rental-candidates.v1，無法安全合併。'), { code: 'EXISTING_JSON_SCHEMA_INVALID' });
      }
      return JSON.parse(JSON.stringify(payload.candidates));
    }

    function writePayload() {
      jsonInput.value = JSON.stringify({
        schemaVersion: 'prettyderby-rental-candidates.v1',
        candidates: state.candidates
      }, null, 2);
      jsonInput.dispatchEvent(new root.Event('input', { bubbles: true }));
    }

    function renderCandidates() {
      elements.candidateList.replaceChildren();
      state.candidates.forEach(candidate => {
        const article = root.document.createElement('article');
        const label = root.document.createElement('div');
        const strong = root.document.createElement('strong');
        strong.textContent = candidate.nameZhTw || candidate.id;
        const small = root.document.createElement('small');
        small.textContent = `ID ${candidate.id}・有效白 ${candidate.effectiveWhiteCount ?? '待補'}`;
        label.append(strong, small);
        const remove = root.document.createElement('button');
        remove.type = 'button';
        remove.textContent = '從 JSON 移除';
        remove.dataset.removeCandidateId = String(candidate.id);
        article.append(label, remove);
        elements.candidateList.append(article);
      });
      elements.candidates.hidden = !state.candidates.length;
    }

    function addCandidate() {
      if (!state.draft) return;
      const result = draftCore.finalizeCandidate(state.draft, {
        candidateId: elements.candidateId.value,
        candidateName: elements.candidateName.value,
        rows: collectRowEdits()
      });
      if (result.status === 'BLOCKED') {
        setStatus(displayError(result.errors?.[0]), 'ERROR');
        return;
      }
      if (result.status !== 'READY') {
        setStatus(`還有 ${result.unresolved?.length || '部分'} 列未處理；請選擇採用或排除。`, 'NEEDS_CONFIRMATION');
        return;
      }
      if (!result.rows?.length) {
        setStatus('至少要採用一列因子，不能把整張截圖都排除。', 'ERROR');
        return;
      }
      let existing;
      try {
        existing = parseCurrentPayload();
      } catch (error) {
        setStatus(displayError(error), 'ERROR');
        return;
      }
      const id = String(result.candidate.id);
      if (existing.some(candidate => String(candidate?.id || '') === id)) {
        setStatus(`候選 ID ${id} 已存在；請先修改 ID 或從 JSON 移除舊資料。`, 'ERROR');
        return;
      }
      state.candidates = [...existing, result.candidate];
      writePayload();
      renderCandidates();
      clearCurrentBatch();
      setStatus(`已把 ${result.candidate.nameZhTw || id} 加入候選 JSON。可繼續貼下一匹，或按下方「比較候選」。`, 'READY');
    }

    elements.pick.addEventListener('click', () => elements.file.click());
    elements.file.addEventListener('change', () => addFiles(elements.file.files));
    elements.groupConfirm.addEventListener('change', updateRecognizeAvailability);
    elements.clear.addEventListener('click', clearCurrentBatch);
    elements.recognize.addEventListener('click', recognizeCurrentBatch);
    elements.confirmAll.addEventListener('click', () => {
      elements.rows.querySelectorAll('[data-field="review"]').forEach(select => {
        select.value = 'confirmed';
      });
      setStatus('已將所有列標成採用；請快速核對名稱、類型、星數與本期有效勾選。', 'NEEDS_CONFIRMATION');
    });
    elements.addCandidate.addEventListener('click', addCandidate);
    elements.preview.addEventListener('click', event => {
      const button = event.target.closest('[data-remove-file-index]');
      if (!button) return;
      state.files.splice(Number(button.dataset.removeFileIndex), 1);
      renderFiles();
    });
    elements.candidateList.addEventListener('click', event => {
      const button = event.target.closest('[data-remove-candidate-id]');
      if (!button) return;
      let current;
      try {
        current = parseCurrentPayload();
      } catch (error) {
        setStatus(displayError(error), 'ERROR');
        return;
      }
      const id = button.dataset.removeCandidateId;
      state.candidates = current.filter(candidate => String(candidate?.id || '') !== id);
      writePayload();
      renderCandidates();
      setStatus('已從候選 JSON 移除一筆。', 'READY');
    });
    elements.dropzone.addEventListener('paste', event => {
      const files = Array.from(event.clipboardData?.items || [])
        .filter(item => item.kind === 'file' && ACCEPTED_IMAGE_TYPES.has(String(item.type || '').toLowerCase()))
        .map(item => item.getAsFile())
        .filter(Boolean);
      if (!files.length) return;
      event.preventDefault();
      addFiles(files);
    });
    elements.dropzone.addEventListener('dragover', event => {
      event.preventDefault();
      elements.dropzone.dataset.dragging = 'true';
    });
    elements.dropzone.addEventListener('dragleave', () => delete elements.dropzone.dataset.dragging);
    elements.dropzone.addEventListener('drop', event => {
      event.preventDefault();
      delete elements.dropzone.dataset.dragging;
      addFiles(event.dataTransfer?.files);
    });
    root.addEventListener('beforeunload', () => {
      releasePreviews();
      ocrClient.resetWorker?.();
    }, { once: true });

    container.dataset.mounted = MODEL_VERSION;
    container.dataset.status = 'IDLE';
    return Object.freeze({
      modelVersion: MODEL_VERSION,
      addFiles,
      clearCurrentBatch
    });
  }

  return Object.freeze({
    MODEL_VERSION,
    ACCEPTED_IMAGE_TYPES,
    mount
  });
});
