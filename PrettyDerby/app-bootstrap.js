(() => {
  'use strict';

  // A published build shares one content version across its lazy resources.
  // Local previews use a fresh version per page load so edited data is not stale.
  const assetVersion = new URL(document.currentScript?.src || document.baseURI)
    .searchParams.get('v') || String(Date.now());

  // Keep the first paint independent from every planner data file.  These
  // manifests are intentionally inert until a launch card is clicked.
  const PLANNER_MANIFEST = Object.freeze([
    'affinity-data.js',
    'data/user-inventory.js',
    'data/owned-breeder-registry.js',
    'data/breeder-candidate-registry.js',
    'data/planner-rules.js',
    'data/scenario-mechanics-policies.js',
    'data/current-race-profile.js',
    'data/cm-race-calendar.js',
    'data/jp-strategy-profile.js',
    'data/factor-run-strategy.js',
    'data/factor-execution-profile.js',
    'data/goal-race-schedules.js',
    'data/gametora-data.js',
    'data/support-card-profiles.js',
    'data/support-card-level-fixtures.js',
    'data/support-event-routes.js',
    'data/course-effect-snapshots.js',
    'skill-core.js',
    'skill-acquisition-core.js',
    'course-core.js',
    'skill-impact-core.js',
    'battle-horse-ranking-core.js',
    'battle-build-evaluation-core.js',
    'white-factor-value-core.js',
    'cm-oaks-white-factor-adapter.js',
    'lineage-rental-score-core.js',
    'cm-oaks-rental-import-adapter.js',
    'rental-screenshot-draft-core.js',
    'rental-screenshot-ocr-client.js',
    'rental-screenshot-import-ui.js',
    'planning-snapshot-core.js',
    'goal-contract-core.js',
    'planner-core.js',
    'persistence-core.js',
    'breeder-core.js',
    'factor-execution-core.js',
    'lineage-planner-core.js',
    'g1-schedule-core.js',
    'manual-lineage-red-projection-core.js',
    'race-strategy-core.js',
    'stamina-sim-core.js',
    'guided-planner-core.js',
    'support-unique-core.js',
    'deck-optimizer-core.js',
    'deck-comfort-core.js',
    'app.js'
  ]);
  const KUA_MANIFEST = Object.freeze([
    'kua-frontend-core.js',
    'data/kua-frontend-profile.js',
    'kua-frontend-app.js'
  ]);
  const manifests = Object.freeze({ planner: PLANNER_MANIFEST, kua: KUA_MANIFEST });
  const scriptPromises = new Map();
  const manifestPromises = new Map();
  const toolStatus = { planner: 'idle', kua: 'idle' };
  let activeLoad = null;

  const byId = id => document.getElementById(id);
  const launchShell = byId('launchShell');
  const plannerWorkspace = byId('plannerWorkspace');
  const kuaWorkspace = byId('kuaFrontendWorkspace');
  const launchButtons = [...document.querySelectorAll('[data-tool]')];

  function setLaunchStatus(message, state = 'idle') {
    const output = byId('launchStatus');
    if (!output) return;
    output.dataset.state = state;
    output.textContent = message;
  }

  function setLaunchBusy(busy) {
    launchButtons.forEach(button => {
      button.disabled = busy;
      button.setAttribute('aria-busy', String(busy));
    });
  }

  function focusWorkspace(workspace) {
    const heading = workspace?.querySelector('h1, h2');
    if (heading) heading.focus({ preventScroll: true });
  }

  function showTool(tool) {
    if (!launchShell || !plannerWorkspace || !kuaWorkspace) return;
    launchShell.hidden = true;
    plannerWorkspace.hidden = tool !== 'planner';
    kuaWorkspace.hidden = tool !== 'kua';
    document.body.dataset.activeTool = tool;
    focusWorkspace(tool === 'planner' ? plannerWorkspace : kuaWorkspace);
  }

  function showLaunch() {
    if (!launchShell || !plannerWorkspace || !kuaWorkspace) return;
    launchShell.hidden = false;
    plannerWorkspace.hidden = true;
    kuaWorkspace.hidden = true;
    delete document.body.dataset.activeTool;
    setLaunchBusy(Boolean(activeLoad));
  }

  function loadScript(src) {
    const requestedUrl = new URL(src, document.baseURI);
    requestedUrl.searchParams.set('v', assetVersion);
    const url = requestedUrl.href;
    if (scriptPromises.has(url)) return scriptPromises.get(url);
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.async = false;
      script.dataset.lazyToolScript = 'true';
      script.onload = () => resolve(src);
      script.onerror = () => reject(new Error(`無法載入 ${src}`));
      document.head.append(script);
    });
    scriptPromises.set(url, promise);
    return promise;
  }

  function loadManifest(tool) {
    if (manifestPromises.has(tool)) return manifestPromises.get(tool);
    const manifest = manifests[tool];
    if (!manifest) return Promise.reject(new Error(`未知工具：${tool}`));
    const promise = manifest.reduce(
      (chain, src) => chain.then(() => loadScript(src)),
      Promise.resolve()
    );
    manifestPromises.set(tool, promise);
    return promise;
  }

  function chooseTool(tool) {
    if (!manifests[tool] || activeLoad) return activeLoad || Promise.resolve();
    if (toolStatus[tool] === 'ready') {
      showTool(tool);
      return Promise.resolve();
    }

    toolStatus[tool] = 'loading';
    setLaunchBusy(true);
    setLaunchStatus(
      tool === 'kua' ? '正在載入回合助手…' : '正在載入完整規劃器資料…',
      'loading'
    );
    const promise = loadManifest(tool)
      .then(() => {
        toolStatus[tool] = 'ready';
        setLaunchStatus(tool === 'kua' ? '回合助手已就緒。' : '完整規劃器已就緒。', 'ready');
        showTool(tool);
      })
      .catch(error => {
        toolStatus[tool] = 'error';
        setLaunchStatus(`${error.message} 請重新整理後再試。`, 'error');
        throw error;
      })
      .finally(() => {
        activeLoad = null;
        setLaunchBusy(false);
      });
    activeLoad = promise;
    return promise;
  }

  launchButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tool = button.dataset.tool;
      const plannerEntry = button.dataset.plannerEntry || '';
      chooseTool(tool).then(() => {
        if (tool !== 'planner' || !plannerEntry) return;
        window.dispatchEvent(new CustomEvent('prettyderby:planner-entry', {
          detail: { entry: plannerEntry }
        }));
      }).catch(() => {
        // chooseTool already reports the failed resource in the live status.
        // Consume the UI event promise without retrying a partially loaded tool.
      });
    });
  });
  document.querySelectorAll('[data-tool-home]').forEach(button => {
    button.addEventListener('click', showLaunch);
  });

  // Useful for static diagnostics and future UI instrumentation; exposing the
  // manifests does not trigger a network request or load any script.
  window.PRETTY_DERBY_BOOTSTRAP = Object.freeze({
    manifests,
    status: toolStatus,
    chooseTool
  });
})();
