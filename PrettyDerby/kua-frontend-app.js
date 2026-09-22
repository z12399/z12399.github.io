(() => {
  'use strict';

  const core = window.KUA_FRONTEND_CORE || null;
  const profile = window.KUA_FRONTEND_PROFILE || {};
  const STORAGE_KEY = 'pretty-derby:kua-frontend:v1';
  const statAxes = core?.STAT_AXES || ['speed', 'stamina', 'power', 'guts', 'wisdom', 'skillPt'];
  const statInputIds = {
    speed: 'kuaStatSpeed',
    stamina: 'kuaStatStamina',
    power: 'kuaStatPower',
    guts: 'kuaStatGuts',
    wisdom: 'kuaStatWisdom',
    skillPt: 'kuaStatSkillPt'
  };
  const statLabels = {
    speed: '速度',
    stamina: '耐力',
    power: '力量',
    guts: '根性',
    wisdom: '智力',
    skillPt: '技能點'
  };
  const targetProfile = profile.targetProfile || {};
  let kuaFrontendState = null;
  let kuaFrontendRanked = [];
  let kuaFrontendTransientMessage = '';

  const byId = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[character]));

  function cloneValue(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return null;
    }
  }

  function readStoredSnapshot() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function persistSnapshot() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(kuaFrontendState));
      return true;
    } catch {
      return false;
    }
  }

  function validateSnapshot(input) {
    if (!core?.acceptNormalizedSnapshot) {
      return { accepted: false, reason: 'CORE_NOT_LOADED', snapshot: null };
    }
    return core.acceptNormalizedSnapshot(input);
  }

  function initialSnapshot() {
    const stored = validateSnapshot(readStoredSnapshot());
    if (stored.accepted) return stored.snapshot;
    const sample = validateSnapshot(cloneValue(profile.sampleSnapshot));
    return sample.accepted ? sample.snapshot : null;
  }

  function number(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function scoreLabel(value) {
    return Number.isFinite(value) ? value.toFixed(2) : '未確認';
  }

  function isRecommendationEligible(row) {
    return row.available === true
      && (row.status === 'READY' || row.status === 'READY_WITH_UNCONFIGURED_PROFILE')
      && Number.isFinite(row.score);
  }

  function statusLabel(status) {
    return {
      READY: '可用',
      READY_WITH_UNCONFIGURED_PROFILE: '目標未設定',
      UNAVAILABLE: '不可用',
      UNVERIFIED: '資料不足',
      NO_COMMANDS: '尚無行動'
    }[status] || status || '資料不足';
  }

  function actionTypeLabel(type) {
    return {
      training: '訓練',
      race: '賽事',
      rest: '休息',
      outing: '外出'
    }[type] || '行動';
  }

  function rawStateWithPatch(patch = {}) {
    return { ...(cloneValue(kuaFrontendState) || {}), ...patch };
  }

  function invalidMessage() {
    kuaFrontendTransientMessage = '資料有誤，已保留原資料。請檢查進階區的 JSON。';
  }

  function applySnapshot(input, options = {}) {
    const checked = validateSnapshot(input);
    if (!checked.accepted) {
      invalidMessage();
      renderKuaFrontend();
      return checked;
    }
    kuaFrontendState = checked.snapshot;
    kuaFrontendRanked = core.rankCommands(kuaFrontendState, { targetProfile });
    if (options.persist !== false) persistSnapshot();
    if (!options.keepMessage) kuaFrontendTransientMessage = '';
    renderKuaFrontend();
    return { ...checked, result: kuaFrontendRanked };
  }

  function ingestKuaFrontendSnapshot(snapshot) {
    return applySnapshot(snapshot);
  }

  function formatGain(axis, value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed === 0) return '';
    return `${statLabels[axis] || axis}${parsed > 0 ? '+' : ''}${parsed}`;
  }

  function benefitsFor(row) {
    const gains = Object.entries(row.explanation?.keep || {})
      .map(([axis, value]) => formatGain(axis, value))
      .filter(Boolean);
    if (Number(row.scoreBreakdown?.components?.motivation) > 0) gains.push('幹勁');
    if (Number(row.scoreBreakdown?.components?.bond) > 0) gains.push('羈絆');
    if (Number(row.scoreBreakdown?.components?.hint) > 0) gains.push('提示');
    return [...new Set(gains)].slice(0, 3).join('、') || '無可量化增益';
  }

  function tradeoffsFor(row) {
    const tradeoffs = [];
    const tradeoff = row.explanation?.tradeoff || {};
    if (Number(tradeoff.vitalDelta) < 0) tradeoffs.push(`體力${tradeoff.vitalDelta}`);
    if (Number(tradeoff.motivationDelta) < 0) tradeoffs.push(`幹勁${tradeoff.motivationDelta}`);
    if (Number(tradeoff.failureRate) > 0) tradeoffs.push(`風險輸入 ${tradeoff.failureRate}%`);
    return tradeoffs.join('、') || '未列出代價';
  }

  function compactStateValue(value) {
    if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) return '未填';
    const parsed = Number(value);
    return Number.isFinite(parsed) ? String(value) : '未填';
  }

  function stateSummaryText(snapshot) {
    const stats = snapshot?.stats || {};
    const items = [
      `回合 ${compactStateValue(snapshot?.turn)}`,
      `體力 ${compactStateValue(snapshot?.vital)}`,
      `幹勁 ${compactStateValue(snapshot?.motivation)}`,
      ...statAxes.map(axis => `${statLabels[axis] || axis} ${compactStateValue(stats[axis])}`)
    ];
    return items.join('・');
  }

  function renderBreakdown(row) {
    const breakdown = row.scoreBreakdown || {};
    const componentLabels = {
      stats: '能力值',
      vital: '體力',
      motivation: '幹勁',
      bond: '羈絆',
      hint: '提示',
      facility: '設施',
      failurePenalty: '風險扣分',
      goalRace: '目標賽'
    };
    const components = Object.entries(breakdown.components || {})
      .filter(([, value]) => value !== null)
      .map(([key, value]) => `<li><span>${escapeHtml(componentLabels[key] || key)}</span><strong>${Number(value).toFixed(2)}</strong></li>`)
      .join('');
    const axes = (breakdown.axes || [])
      .filter(axis => axis.gain !== 0 || axis.utility !== null)
      .map(axis => `<li><span>${escapeHtml(axis.label)} ${axis.gain >= 0 ? '+' : ''}${axis.gain}</span><strong>${axis.utility === null ? '未設定' : Number(axis.utility).toFixed(2)}</strong></li>`)
      .join('');
    const unconfiguredAxes = (breakdown.unconfiguredAxes || [])
      .map(axis => statLabels[axis] || axis);
    const missingTargets = unconfiguredAxes.length
      ? `<small>${escapeHtml(unconfiguredAxes.join('、'))}未設定目標，不計分。</small>`
      : '';
    return `<details class="kua-frontend-breakdown"><summary>分數明細</summary>
      <p class="kua-frontend-formula">${escapeHtml(breakdown.formula || '無法計算')}</p>
      <div class="kua-frontend-breakdown-grid"><div><b>計分項目</b><ul>${components || '<li>無</li>'}</ul></div><div><b>能力值計分</b><ul>${axes || '<li>尚未設定</li>'}</ul></div></div>
      ${missingTargets}
    </details>`;
  }

  function renderRankedRow(row, options = {}) {
    const isTop = options.isTop === true;
    const benefit = benefitsFor(row);
    const tradeoff = tradeoffsFor(row);
    const summary = `${escapeHtml(benefit)}；${escapeHtml(tradeoff)}`;
    return `<article class="kua-frontend-ranked-row ${isTop ? 'is-top' : ''} ${row.nearTie ? 'is-near-tie' : ''}" data-command-id="${escapeHtml(row.id)}" data-status="${escapeHtml(row.status)}">
      <header><span class="kua-frontend-rank">${isTop ? '首選' : `#${row.rank}`}</span><div><strong>${escapeHtml(row.label)}</strong><small>${escapeHtml(actionTypeLabel(row.type))}・${escapeHtml(statusLabel(row.status))}</small></div><b>${scoreLabel(row.score)}</b></header>
      <p class="kua-frontend-ranked-summary">${summary}</p>
      ${options.showBreakdown ? renderBreakdown(row) : ''}
    </article>`;
  }

  function renderRanking() {
    const output = byId('kuaFrontendRankedCommands');
    if (!output) return;
    const rankedRows = Array.isArray(kuaFrontendRanked) ? kuaFrontendRanked : [];
    if (!rankedRows.length) {
      output.innerHTML = '<p class="kua-frontend-empty">尚無行動資料。</p>';
      return;
    }
    const rows = rankedRows.filter(isRecommendationEligible);
    if (!rows.length) {
      output.innerHTML = '<p class="kua-frontend-empty">行動皆不可用或缺少分數，請更新行動資料。</p>'
        + rankedRows.map(row => renderRankedRow(row, { showBreakdown: true })).join('');
      return;
    }
    const top = rows.find(row => row.rank === 1) || rows[0];
    const remaining = rankedRows.filter(row =>
      row !== top && row.rank !== 1 && (top.id == null || row.id !== top.id));
    const restMarkup = remaining.length
      ? `<details class="kua-ranking-details kua-frontend-section" id="kuaFrontendRankingDetails">
          <summary>其他 ${remaining.length} 個行動</summary>
          <div class="kua-ranking-details-body">${remaining.map(row => renderRankedRow(row, { showBreakdown: true })).join('')}</div>
        </details>`
      : '';
    output.innerHTML = `${renderRankedRow(top, { isTop: true, showBreakdown: true })}${restMarkup}`;
  }

  function renderKuaFrontend() {
    const lab = byId('kuaFrontendLab');
    if (!lab || !kuaFrontendState) return;
    const status = kuaFrontendState.normalizationStatus || 'UNVERIFIED';
    lab.dataset.status = status;
    lab.dataset.probabilityStatus = kuaFrontendState.probabilityStatus || 'NOT_COMPUTED';
    lab.dataset.connectionStatus = kuaFrontendState.connectionStatus || 'NOT_LIVE_CONNECTED';
    const setText = (id, value) => {
      const element = byId(id);
      if (element) element.textContent = String(value ?? '');
    };
    setText('kuaFrontendSummaryStatus', '手動快照');
    setText('kuaFrontendStateSummary', stateSummaryText(kuaFrontendState));
    const sourceLabels = { MANUAL_SNAPSHOT: '手動輸入', COMMUNITY_TOOL_OBSERVED: '社群工具觀察', USER_RECORDED: '自行記錄' };
    const sourceStatus = kuaFrontendState.sourceStatus || 'MANUAL_SNAPSHOT';
    const connectionStatus = kuaFrontendState.connectionStatus || 'NOT_LIVE_CONNECTED';
    const probabilityLabels = { NOT_COMPUTED: '未計算機率', NOT_PROBABILITY: '分數不代表機率' };
    const probabilityStatus = kuaFrontendState.probabilityStatus || 'NOT_COMPUTED';
    const probabilityClaimStatus = kuaFrontendState.probabilityClaimStatus || 'NOT_PROBABILITY';
    setText('kuaFrontendSourceStatus', sourceLabels[sourceStatus] || sourceStatus);
    setText('kuaFrontendConnectionStatus', connectionStatus === 'NOT_LIVE_CONNECTED' ? '未連接遊戲' : connectionStatus);
    setText('kuaFrontendEngineStatus', '未整合原版 Kua 引擎');
    setText('kuaFrontendProbabilityStatus', `${probabilityLabels[probabilityStatus] || probabilityStatus}；${probabilityLabels[probabilityClaimStatus] || probabilityClaimStatus}`);
    const setValue = (id, value) => {
      const element = byId(id);
      if (element) element.value = value === null || value === undefined ? '' : String(value);
    };
    setValue('kuaFrontendTurn', kuaFrontendState.turn);
    setValue('kuaFrontendVital', kuaFrontendState.vital);
    setValue('kuaFrontendMotivation', kuaFrontendState.motivation);
    statAxes.forEach(axis => setValue(statInputIds[axis], kuaFrontendState.stats?.[axis]));
    const jsonInput = byId('kuaFrontendJsonInput');
    if (jsonInput && document.activeElement !== jsonInput) jsonInput.value = JSON.stringify(kuaFrontendState, null, 2);
    renderRanking();
    const statusOutput = byId('kuaFrontendStatus');
    if (statusOutput) {
      const errorText = (kuaFrontendState.errors || []).length > 0;
      const noRecommendation = kuaFrontendRanked.length > 0
        && !kuaFrontendRanked.some(isRecommendationEligible);
      const unconfigured = kuaFrontendRanked.some(row =>
        row.status === 'READY_WITH_UNCONFIGURED_PROFILE'
        || (row.scoreBreakdown?.unconfiguredAxes || []).length > 0);
      const hideStatus = status === 'READY' && kuaFrontendRanked.status === 'READY'
        && !kuaFrontendTransientMessage && !errorText && !noRecommendation && !unconfigured;
      statusOutput.hidden = hideStatus;
      // The status class sets display:flex, so hide its box as well as its content.
      if (statusOutput.style) statusOutput.style.display = hideStatus ? 'none' : '';
      const summaryStatus = noRecommendation
        ? '沒有可推薦的行動'
        : statusLabel(kuaFrontendRanked?.status || 'NO_COMMANDS');
      const summaryMessage = noRecommendation
        ? ''
        : `${kuaFrontendState.commands.length} 個候選行動`;
      const message = kuaFrontendTransientMessage || summaryMessage;
      statusOutput.innerHTML = hideStatus ? '' : errorText
        ? '<strong>資料不足</strong><span>資料未通過檢查，無法確認排名。</span>'
        : `<strong>${escapeHtml(summaryStatus)}</strong>${message ? `<span>${escapeHtml(message)}</span>` : ''}`;
    }
  }

  function bindKuaFrontendControls() {
    const updateScalar = (id, key) => {
      byId(id)?.addEventListener('change', event => {
        applySnapshot(rawStateWithPatch({ [key]: number(event.target.value) }));
      });
    };
    updateScalar('kuaFrontendTurn', 'turn');
    updateScalar('kuaFrontendVital', 'vital');
    updateScalar('kuaFrontendMotivation', 'motivation');
    statAxes.forEach(axis => {
      byId(statInputIds[axis])?.addEventListener('change', event => {
        const raw = rawStateWithPatch();
        raw.stats = { ...(raw.stats || {}), [axis]: number(event.target.value) };
        applySnapshot(raw);
      });
    });
    byId('kuaFrontendLoadSample')?.addEventListener('click', () => {
      applySnapshot(cloneValue(profile.sampleSnapshot));
    });
    byId('kuaFrontendApplyJson')?.addEventListener('click', () => {
      const input = byId('kuaFrontendJsonInput')?.value || '';
      try {
        const result = applySnapshot(JSON.parse(input), { keepMessage: true });
        if (result.accepted) kuaFrontendTransientMessage = 'JSON 已套用。';
        renderKuaFrontend();
      } catch {
        invalidMessage();
        renderKuaFrontend();
      }
    });
    byId('kuaFrontendExportJson')?.addEventListener('click', () => {
      const content = JSON.stringify(kuaFrontendState, null, 2);
      const input = byId('kuaFrontendJsonInput');
      if (input) input.value = content;
      const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'kua-frontend-normalized-turn-state.json';
      anchor.click();
      URL.revokeObjectURL(url);
    });
  }

  kuaFrontendState = initialSnapshot();
  kuaFrontendRanked = kuaFrontendState && core?.rankCommands
    ? core.rankCommands(kuaFrontendState, { targetProfile })
    : [];

  window.PRETTY_DERBY_KUA_FRONTEND = {
    schemaVersion: 1,
    engineStatus: 'CLEAN_ROOM_FRONTEND_MVP_NOT_ORIGINAL_KUA',
    connectionStatus: 'NOT_LIVE_CONNECTED',
    probabilityStatus: 'NOT_COMPUTED',
    probabilityClaimStatus: 'NOT_PROBABILITY',
    ingestSnapshot: ingestKuaFrontendSnapshot,
    getSnapshot: () => cloneValue(kuaFrontendState)
  };
  window.addEventListener('prettyderby:kua-snapshot', event => {
    ingestKuaFrontendSnapshot(event?.detail?.snapshot || event?.detail);
  });
  bindKuaFrontendControls();
  renderKuaFrontend();
})();
