(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RENTAL_SCREENSHOT_OCR_CLIENT = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  const MODEL_VERSION = 'rental-screenshot-ocr-client-v1';
  const DEFAULT_CONFIG = Object.freeze({
    libraryUrl: 'assets/vendor/tesseract/7.0.0/tesseract.min.js',
    workerPath: 'assets/vendor/tesseract/7.0.0/worker.min.js',
    corePath: 'assets/vendor/tesseract-core/7.0.0',
    langPath: 'assets/vendor/tessdata/4.0.0_best_int',
    languages: Object.freeze(['chi_tra', 'eng'])
  });
  const FACTOR_KINDS = Object.freeze({
    blue: 'blue',
    pink: 'red',
    green: 'unique',
    neutral: 'white',
    unknown: 'unknown'
  });
  const ACCEPTED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

  let libraryPromise = null;
  let workerPromise = null;
  let activeWorker = null;

  function fail(code, message) {
    const error = new Error(message || code);
    error.code = code;
    throw error;
  }

  function finiteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  function clamp(value, low, high) {
    return Math.max(low, Math.min(high, value));
  }

  function normalizeOcrText(value) {
    if (typeof value !== 'string') return '';
    return value
      .replace(/\r/g, '')
      .split('\n')
      .map(line => line.replace(/[\u200B-\u200D\uFEFF]/g, '').trim())
      .filter(Boolean)
      .join('\n');
  }

  function normalizeOcrLabel(value) {
    return normalizeOcrText(value)
      .replace(/\n+/g, ' ')
      .replace(/^[|｜:：;；,，.。·・_\-—\s]+|[|｜:：;；,，.。·・_\-—\s]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function classifyPixel(red, green, blue, alpha = 255) {
    if (alpha < 180) return 'other';
    if (red >= 248 && green >= 248 && blue >= 248) return 'white';
    if (blue >= 145 && blue > red + 18 && green > red + 8) return 'blue';
    if (red >= 175 && red > green + 8 && red > blue + 8) return 'pink';
    if (green >= 115 && green > red + 12 && green > blue + 22) return 'green';
    const spread = Math.max(red, green, blue) - Math.min(red, green, blue);
    if (red >= 190 && green >= 190 && blue >= 190 && spread <= 30) return 'neutral';
    return 'other';
  }

  function sampleScanline(data, width, height, y, startX, endX, sampleCount = 28) {
    const counts = { blue: 0, pink: 0, green: 0, neutral: 0, white: 0, other: 0 };
    const safeY = clamp(Math.round(y), 0, height - 1);
    const left = clamp(Math.round(startX), 0, width - 1);
    const right = clamp(Math.round(endX), left, width - 1);
    for (let index = 0; index < sampleCount; index += 1) {
      const ratio = sampleCount === 1 ? 0.5 : index / (sampleCount - 1);
      const x = Math.round(left + (right - left) * ratio);
      const offset = (safeY * width + x) * 4;
      const kind = classifyPixel(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
      counts[kind] += 1;
    }
    const palettes = ['blue', 'pink', 'green', 'neutral'];
    const dominant = palettes.sort((a, b) => counts[b] - counts[a])[0];
    const paletteCount = palettes.reduce((sum, key) => sum + counts[key], 0);
    return {
      active: paletteCount / sampleCount >= 0.5,
      dominant: counts[dominant] / sampleCount >= 0.28 ? dominant : 'unknown',
      coverage: paletteCount / sampleCount,
      counts
    };
  }

  function bridgeShortGaps(active, maxGap = 3) {
    const result = active.slice();
    let index = 0;
    while (index < result.length) {
      if (result[index]) {
        index += 1;
        continue;
      }
      const start = index;
      while (index < result.length && !result[index]) index += 1;
      const length = index - start;
      if (start > 0 && index < result.length && length <= maxGap) {
        for (let cursor = start; cursor < index; cursor += 1) result[cursor] = true;
      }
    }
    return result;
  }

  function detectColumnBands(imageData, width, height, column) {
    const left = Math.round(width * column[0]);
    const right = Math.round(width * column[1]);
    const scans = [];
    for (let y = 0; y < height; y += 1) {
      scans.push(sampleScanline(imageData.data, width, height, y, left + 5, right - 5));
    }
    const active = bridgeShortGaps(scans.map(scan => scan.active));
    const bands = [];
    let y = 0;
    while (y < height) {
      if (!active[y]) {
        y += 1;
        continue;
      }
      const start = y;
      while (y < height && active[y]) y += 1;
      const end = y - 1;
      const bandHeight = end - start + 1;
      if (bandHeight < 13 || bandHeight > 48) continue;
      const vote = { blue: 0, pink: 0, green: 0, neutral: 0, unknown: 0 };
      for (let rowY = start; rowY <= end; rowY += 1) vote[scans[rowY].dominant] += 1;
      const palette = Object.keys(vote).sort((a, b) => vote[b] - vote[a])[0];
      bands.push({
        x: left,
        y: start,
        width: Math.max(1, right - left + 1),
        height: bandHeight,
        palette,
        column: column[2]
      });
    }
    return bands;
  }

  function findFactorAnchor(leftBands, rightBands) {
    for (const left of leftBands) {
      if (left.palette !== 'blue') continue;
      const match = rightBands.find(right => right.palette === 'pink'
        && Math.abs((right.y + right.height / 2) - (left.y + left.height / 2)) <= 7);
      if (match) return Math.min(left.y, match.y) - 3;
    }
    return null;
  }

  function normalizeBox(box, width, height) {
    return {
      x: box.x / width,
      y: box.y / height,
      width: box.width / width,
      height: box.height / height
    };
  }

  function detectFactorRowsFromImageData(imageData, width, height) {
    if (!imageData || !imageData.data || imageData.data.length !== width * height * 4) {
      fail('INVALID_IMAGE_DATA', '影像像素資料無效。');
    }
    if (!Number.isInteger(width) || width < 80 || !Number.isInteger(height) || height < 80) {
      fail('IMAGE_TOO_SMALL', '截圖尺寸太小。');
    }
    const columns = [
      [0.025, 0.49, 'left'],
      [0.51, 0.975, 'right']
    ];
    const leftBands = detectColumnBands(imageData, width, height, columns[0]);
    const rightBands = detectColumnBands(imageData, width, height, columns[1]);
    const anchorY = findFactorAnchor(leftBands, rightBands);
    const allBands = [...leftBands, ...rightBands]
      .filter(band => anchorY === null
        ? band.palette === 'neutral'
        : band.y >= anchorY && ['blue', 'pink', 'green', 'neutral'].includes(band.palette))
      .sort((a, b) => a.y - b.y || (a.column === 'left' ? -1 : 1));
    return allBands.map((band, index) => ({
      rowIndex: index,
      column: band.column,
      suggestedKind: FACTOR_KINDS[band.palette] || 'unknown',
      colorHint: band.palette,
      bbox: normalizeBox(band, width, height),
      pixelBox: { x: band.x, y: band.y, width: band.width, height: band.height }
    }));
  }

  function isGoldPixel(red, green, blue, alpha) {
    return alpha >= 180
      && red >= 205
      && green >= 105
      && green <= 220
      && blue <= 115
      && red >= green + 20
      && green >= blue + 25;
  }

  function detectStarsFromImageData(imageData, width, height) {
    if (!imageData || !imageData.data || imageData.data.length !== width * height * 4) return null;
    const startX = Math.floor(width * 0.25);
    const endX = Math.ceil(width * 0.78);
    const startY = Math.floor(height * 0.45);
    const visited = new Uint8Array(width * height);
    const components = [];
    for (let y = startY; y < height; y += 1) {
      for (let x = startX; x < endX; x += 1) {
        const pixelIndex = y * width + x;
        if (visited[pixelIndex]) continue;
        const offset = pixelIndex * 4;
        if (!isGoldPixel(
          imageData.data[offset],
          imageData.data[offset + 1],
          imageData.data[offset + 2],
          imageData.data[offset + 3]
        )) continue;
        const queue = [[x, y]];
        visited[pixelIndex] = 1;
        let cursor = 0;
        let area = 0;
        let minX = x;
        let maxX = x;
        let minY = y;
        let maxY = y;
        while (cursor < queue.length) {
          const [currentX, currentY] = queue[cursor];
          cursor += 1;
          area += 1;
          minX = Math.min(minX, currentX);
          maxX = Math.max(maxX, currentX);
          minY = Math.min(minY, currentY);
          maxY = Math.max(maxY, currentY);
          for (let deltaY = -1; deltaY <= 1; deltaY += 1) {
            for (let deltaX = -1; deltaX <= 1; deltaX += 1) {
              if (!deltaX && !deltaY) continue;
              const nextX = currentX + deltaX;
              const nextY = currentY + deltaY;
              if (nextX < startX || nextX >= endX || nextY < startY || nextY >= height) continue;
              const nextIndex = nextY * width + nextX;
              if (visited[nextIndex]) continue;
              const nextOffset = nextIndex * 4;
              if (!isGoldPixel(
                imageData.data[nextOffset],
                imageData.data[nextOffset + 1],
                imageData.data[nextOffset + 2],
                imageData.data[nextOffset + 3]
              )) continue;
              visited[nextIndex] = 1;
              queue.push([nextX, nextY]);
            }
          }
        }
        const componentWidth = maxX - minX + 1;
        const componentHeight = maxY - minY + 1;
        if (area >= 5 && componentWidth >= 3 && componentWidth <= 20 && componentHeight >= 3 && componentHeight <= 20) {
          components.push({ area, minX, maxX, minY, maxY });
        }
      }
    }
    const centers = components
      .sort((a, b) => a.minX - b.minX)
      .map(component => (component.minX + component.maxX) / 2);
    const clusters = [];
    centers.forEach(center => {
      if (!clusters.length || center - clusters[clusters.length - 1] > 5) clusters.push(center);
      else clusters[clusters.length - 1] = (clusters[clusters.length - 1] + center) / 2;
    });
    return clusters.length >= 1 && clusters.length <= 3 ? clusters.length : null;
  }

  function mergedConfig() {
    // Paths stay fixed and same-origin.  A page-level override could silently
    // turn a local-only OCR flow into a third-party request.
    return { ...DEFAULT_CONFIG };
  }

  function loadTesseract(config) {
    if (root?.Tesseract?.createWorker) return Promise.resolve(root.Tesseract);
    if (!root?.document?.head) return Promise.reject(Object.assign(new Error('瀏覽器 OCR 環境不可用。'), { code: 'BROWSER_REQUIRED' }));
    if (libraryPromise) return libraryPromise;
    libraryPromise = new Promise((resolve, reject) => {
      const script = root.document.createElement('script');
      script.src = config.libraryUrl;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.dataset.prettyDerbyOcrRuntime = MODEL_VERSION;
      script.onload = () => {
        if (root.Tesseract?.createWorker) resolve(root.Tesseract);
        else reject(Object.assign(new Error('OCR 程式已下載但 API 不可用。'), { code: 'OCR_API_UNAVAILABLE' }));
      };
      script.onerror = () => reject(Object.assign(new Error('無法載入本機執行的 OCR 程式。請檢查網路後重試。'), { code: 'OCR_RUNTIME_LOAD_FAILED' }));
      root.document.head.append(script);
    }).catch(error => {
      libraryPromise = null;
      throw error;
    });
    return libraryPromise;
  }

  function getWorker(options = {}) {
    if (workerPromise) return workerPromise;
    const config = mergedConfig(options);
    workerPromise = loadTesseract(config).then(async Tesseract => {
      const worker = await Tesseract.createWorker(
        config.languages,
        Tesseract.OEM?.LSTM_ONLY ?? 1,
        {
          workerPath: config.workerPath,
          corePath: config.corePath,
          langPath: config.langPath,
          logger(message) {
            if (typeof options.onProgress === 'function') {
              options.onProgress({
                status: String(message?.status || 'loading'),
                progress: finiteNumber(message?.progress)
              });
            }
          }
        }
      );
      activeWorker = worker;
      return worker;
    }).catch(error => {
      workerPromise = null;
      activeWorker = null;
      throw error;
    });
    return workerPromise;
  }

  async function resetWorker() {
    const worker = activeWorker;
    activeWorker = null;
    workerPromise = null;
    if (worker?.terminate) await worker.terminate();
  }

  async function decodeImage(file) {
    if (!file || typeof file !== 'object' || !ACCEPTED_IMAGE_TYPES.has(String(file.type || '').toLowerCase())) {
      fail('IMAGE_FILE_REQUIRED', '請選擇 PNG、JPG 或其他圖片。');
    }
    const canvas = root.document.createElement('canvas');
    let source;
    let revokeUrl = null;
    if (typeof root.createImageBitmap === 'function') {
      source = await root.createImageBitmap(file);
    } else {
      const url = root.URL.createObjectURL(file);
      revokeUrl = url;
      source = await new Promise((resolve, reject) => {
        const image = new root.Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(Object.assign(new Error('無法解碼圖片。'), { code: 'IMAGE_DECODE_FAILED' }));
        image.src = url;
      });
    }
    const width = Number(source.width || source.naturalWidth);
    const height = Number(source.height || source.naturalHeight);
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 80 || height < 80) {
      if (source.close) source.close();
      if (revokeUrl) root.URL.revokeObjectURL(revokeUrl);
      fail('IMAGE_TOO_SMALL', '截圖尺寸太小。');
    }
    if (width * height > 20_000_000) {
      if (source.close) source.close();
      if (revokeUrl) root.URL.revokeObjectURL(revokeUrl);
      fail('IMAGE_TOO_MANY_PIXELS', '截圖像素過大。');
    }
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(source, 0, 0, width, height);
    if (source.close) source.close();
    if (revokeUrl) root.URL.revokeObjectURL(revokeUrl);
    return { canvas, context, width, height };
  }

  function thresholdCrop(sourceCanvas, box, mode = 'row') {
    const scale = 3;
    const cropX = mode === 'row' ? box.x + Math.round(box.width * 0.13) : box.x;
    const cropY = box.y;
    const cropWidth = mode === 'row' ? Math.round(box.width * 0.82) : box.width;
    const cropHeight = mode === 'row' ? Math.max(8, Math.round(box.height * 0.58)) : box.height;
    const canvas = root.document.createElement('canvas');
    canvas.width = Math.max(1, cropWidth * scale);
    canvas.height = Math.max(1, cropHeight * scale);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.imageSmoothingEnabled = true;
    context.drawImage(
      sourceCanvas,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      canvas.width,
      canvas.height
    );
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let offset = 0; offset < pixels.data.length; offset += 4) {
      const luminance = pixels.data[offset] * 0.299
        + pixels.data[offset + 1] * 0.587
        + pixels.data[offset + 2] * 0.114;
      const value = luminance < (mode === 'row' ? 150 : 165) ? 0 : 255;
      pixels.data[offset] = value;
      pixels.data[offset + 1] = value;
      pixels.data[offset + 2] = value;
      pixels.data[offset + 3] = 255;
    }
    context.putImageData(pixels, 0, 0);
    return canvas;
  }

  async function sha256Hex(file) {
    if (!root.crypto?.subtle || typeof file.arrayBuffer !== 'function') return null;
    const digest = await root.crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  }

  async function recognizeIdentity(worker, decoded) {
    if (decoded.height < 500) return { rawText: '', lines: [], suggestedName: null };
    const box = {
      x: Math.round(decoded.width * 0.36),
      y: Math.round(decoded.height * 0.07),
      width: Math.round(decoded.width * 0.61),
      height: Math.round(decoded.height * 0.17)
    };
    const crop = thresholdCrop(decoded.canvas, box, 'identity');
    await worker.setParameters({ tessedit_pageseg_mode: 6, preserve_interword_spaces: '1' });
    const result = await worker.recognize(crop);
    const rawText = normalizeOcrText(result?.data?.text);
    const lines = rawText.split('\n').map(normalizeOcrLabel).filter(Boolean);
    const meaningful = lines.filter(line => !/^(因子一覽|持有因子|關閉)$/.test(line));
    return {
      rawText,
      lines,
      suggestedName: meaningful.length ? meaningful[meaningful.length - 1] : null
    };
  }

  async function recognizeFile(file, fileIndex, worker, options = {}) {
    const decoded = await decodeImage(file);
    const imageData = decoded.context.getImageData(0, 0, decoded.width, decoded.height);
    const detectedRows = detectFactorRowsFromImageData(imageData, decoded.width, decoded.height);
    if (!detectedRows.length) fail('FACTOR_ROWS_NOT_FOUND', `在 ${file.name || `第 ${fileIndex + 1} 張圖片`} 找不到因子列。`);
    const hash = await sha256Hex(file);
    const sourceId = hash ? `sha256-${hash.slice(0, 16)}` : `image-${fileIndex + 1}`;
    const identity = await recognizeIdentity(worker, decoded);
    await worker.setParameters({ tessedit_pageseg_mode: 7, preserve_interword_spaces: '1' });
    const rows = [];
    for (let index = 0; index < detectedRows.length; index += 1) {
      const detected = detectedRows[index];
      const box = detected.pixelBox;
      const rowPixels = decoded.context.getImageData(box.x, box.y, box.width, box.height);
      const detectedStars = detectStarsFromImageData(rowPixels, box.width, box.height);
      const crop = thresholdCrop(decoded.canvas, box, 'row');
      const result = await worker.recognize(crop);
      const rawText = normalizeOcrText(result?.data?.text);
      const text = normalizeOcrLabel(rawText);
      if (text) {
        rows.push({
          text,
          rawText,
          confidence: finiteNumber(result?.data?.confidence) === null
            ? null
            : clamp(Number(result.data.confidence) / 100, 0, 1),
          colorHint: detected.suggestedKind === 'red' ? 'red' : detected.colorHint,
          suggestedKind: detected.suggestedKind,
          detectedStars,
          bbox: detected.bbox,
          column: detected.column,
          rowIndex: detected.rowIndex
        });
      }
      if (typeof options.onProgress === 'function') {
        options.onProgress({
          status: 'recognizing_rows',
          fileIndex,
          rowIndex: index,
          rowCount: detectedRows.length,
          progress: (index + 1) / detectedRows.length
        });
      }
    }
    return {
      sourceId,
      fileName: String(file.name || `clipboard-${fileIndex + 1}.png`),
      sha256: hash,
      width: decoded.width,
      height: decoded.height,
      identity,
      rows,
      listCompletenessSuggestion: 'UNKNOWN',
      evidenceStatus: 'OCR_DRAFT_UNCONFIRMED'
    };
  }

  async function recognizeFiles(files, options = {}) {
    const list = Array.from(files || []);
    if (!list.length) fail('IMAGE_FILE_REQUIRED', '請先貼上或選擇至少一張截圖。');
    if (list.length > 6) fail('TOO_MANY_IMAGES', '同一匹候選一次最多六張截圖。');
    list.forEach(file => {
      if (!ACCEPTED_IMAGE_TYPES.has(String(file?.type || '').toLowerCase())) fail('IMAGE_FILE_REQUIRED', '只接受 PNG、JPG 或 WebP 圖片。');
      if (Number(file.size) > 12 * 1024 * 1024) fail('IMAGE_TOO_LARGE', '單張截圖不可超過 12 MB。');
    });
    const worker = await getWorker(options);
    const pages = [];
    for (let index = 0; index < list.length; index += 1) {
      if (typeof options.onProgress === 'function') {
        options.onProgress({ status: 'recognizing_image', fileIndex: index, fileCount: list.length, progress: 0 });
      }
      pages.push(await recognizeFile(list[index], index, worker, options));
    }
    return {
      modelVersion: MODEL_VERSION,
      authority: 'OCR_DRAFT_ONLY',
      status: 'NEEDS_CONFIRMATION',
      probabilityStatus: 'NOT_COMPUTED',
      localProcessing: true,
      pages
    };
  }

  return Object.freeze({
    MODEL_VERSION,
    DEFAULT_CONFIG,
    ACCEPTED_IMAGE_TYPES,
    classifyPixel,
    normalizeOcrText,
    normalizeOcrLabel,
    detectFactorRowsFromImageData,
    detectStarsFromImageData,
    recognizeFiles,
    resetWorker
  });
});
