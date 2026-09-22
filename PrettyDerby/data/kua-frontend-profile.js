(function (root, factory) {
  const profile = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = profile;
  if (root) root.KUA_FRONTEND_PROFILE = profile;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  return {
    "schemaVersion": 1,
    "id": "kua-frontend-mvp",
    "title": "Kua Legend 回合決策實驗室（clean-room frontend）",
    "engineStatus": "CLEAN_ROOM_FRONTEND_MVP_NOT_ORIGINAL_KUA",
    "futureAdapterStatus": "ORIGINAL_KUA_NOT_INCLUDED",
    "connectionStatus": "NOT_LIVE_CONNECTED",
    "probabilityStatus": "NOT_COMPUTED",
    "probabilityClaimStatus": "NOT_PROBABILITY",
    "purpose": "以正規化手動回合快照做透明、deterministic 的候選行動相對排序；不連接遊戲、不重建原 Kua 引擎。",
    "provenance": {
      "status": "STATIC_ONLY",
      "sourceType": "LOCAL_STATIC_RESEARCH_AND_MANUAL_SAMPLE",
      "sourcePath": "research/kua-legend-0811",
      "researchedAt": "2026-08-11",
      "evidenceBoundary": "COMMUNITY_TOOL_OBSERVED values are advisory calibration candidates, not official server mechanics or success rates.",
      "sensitiveDataIncluded": false,
      "runtimeArtifactsIncluded": false,
      "notes": [
        "本 profile 只保存可追溯的 config/data 摘要與人工輸入範例。",
        "沒有封包內容、帳戶識別、憑證、程序資訊或連線設定。"
      ]
    },
    "evidence": [
      {
        "status": "COMMUNITY_TOOL_OBSERVED",
        "use": "ADVISORY_ONLY",
        "fields": ["failureRate", "bondGain", "hintCount", "facilityGain", "motivationDelta", "vitalDelta"],
        "interpretation": "可作相對排序的輸入或校準候選；不是官方參數、成功率或勝率。"
      },
      {
        "status": "MANUAL_SNAPSHOT",
        "use": "DEMO_ONLY",
        "fields": ["turn", "vital", "motivation", "stats", "commands"],
        "interpretation": "由使用者手動輸入的可重現範例，不代表任何線上帳戶或實際回合。"
      }
    ],
    "observedParams": {
      "failureRate": { "status": "COMMUNITY_TOOL_OBSERVED", "range": [0, 100], "use": "relative risk penalty only", "not": "success probability" },
      "bondGain": { "status": "COMMUNITY_TOOL_OBSERVED", "use": "advisory component" },
      "hintCount": { "status": "COMMUNITY_TOOL_OBSERVED", "use": "advisory component" },
      "facilityGain": { "status": "COMMUNITY_TOOL_OBSERVED", "use": "advisory component" },
      "vitalDelta": { "status": "COMMUNITY_TOOL_OBSERVED", "use": "advisory component" },
      "motivationDelta": { "status": "COMMUNITY_TOOL_OBSERVED", "use": "advisory component" }
    },
    "targetProfile": {
      "id": "community-tool-observed-advisory",
      "label": "Kua Legend 社群觀察（只作 advisory）",
      "sourceStatus": "COMMUNITY_TOOL_OBSERVED",
      "recommendationUse": "ADVISORY_ONLY",
      "diminishingReturns": { "threshold": 1200, "multiplier": 0.5, "evidenceStatus": "COMMUNITY_TOOL_OBSERVED" },
      "utilityWeights": { "vital": 0.25, "motivation": 18, "bond": 10, "hint": 7, "facility": 10, "failure": 12, "goalRace": 0 },
      "axes": {
        "speed": { "label": "速度", "minimum": null, "target": 1800, "belowWeight": 5.17, "surplusWeight": 4.93, "evidenceStatus": "COMMUNITY_TOOL_OBSERVED" },
        "stamina": { "label": "耐力", "minimum": null, "target": 900, "belowWeight": 5, "surplusWeight": 0.5, "evidenceStatus": "COMMUNITY_TOOL_OBSERVED" },
        "power": { "label": "力量", "minimum": null, "target": 1400, "belowWeight": 3.31, "surplusWeight": 3.01, "evidenceStatus": "COMMUNITY_TOOL_OBSERVED" },
        "guts": { "label": "根性", "minimum": null, "target": 1200, "belowWeight": 2.11, "surplusWeight": 2.1, "evidenceStatus": "COMMUNITY_TOOL_OBSERVED" },
        "wisdom": { "label": "智力", "minimum": null, "target": 1400, "belowWeight": 1.16, "surplusWeight": 1.16, "evidenceStatus": "COMMUNITY_TOOL_OBSERVED" },
        "skillPt": { "label": "技能點", "minimum": null, "target": 9999, "belowWeight": 1, "surplusWeight": 0.25, "evidenceStatus": "COMMUNITY_TOOL_OBSERVED" }
      }
    },
    "futureAdapter": {
      "status": "ORIGINAL_KUA_NOT_INCLUDED",
      "acceptedInput": "NORMALIZED_TURN_STATE schema v1 only",
      "browserContract": "window.PRETTY_DERBY_KUA_FRONTEND.ingestSnapshot(snapshot)",
      "eventContract": "prettyderby:kua-snapshot",
      "connection": "NOT_LIVE_CONNECTED",
      "implementationBoundary": "This MVP has no game process, packet, credential, proxy, network, or engine integration."
    },
    "limitations": [
      "這是純瀏覽器快照評估，不是原 Kua 引擎，也不是原 Kua parity。",
      "輸出是 deterministic proxy 的相對排序，不是勝率、成功率、因子率或 Monte Carlo。",
      "COMMUNITY_TOOL_OBSERVED、PROJECTED、PROXY 與 USER_RECORDED 必須維持原 evidence status，不升格 confirmed。",
      "缺少 turn、vital、motivation、六個 named stats 軸或 commands 關鍵欄位時 fail closed/UNVERIFIED。"
    ],
    "sampleSnapshot": {
      "schemaVersion": 1,
      "stateType": "NORMALIZED_TURN_STATE",
      "turn": 24,
      "vital": 62,
      "motivation": 3,
      "stats": { "speed": 830, "stamina": 620, "power": 700, "guts": 450, "wisdom": 650, "skillPt": 238 },
      "sourceStatus": "MANUAL_SNAPSHOT",
      "connectionStatus": "NOT_LIVE_CONNECTED",
      "commands": [
        { "id": "training-speed", "type": "training", "label": "速度訓練", "available": true, "failureRate": 8, "gains": { "speed": 26, "stamina": 0, "power": 8, "guts": 0, "wisdom": 0, "skillPt": 12 }, "vitalDelta": -20, "motivationDelta": 0, "bondGain": 5, "hintCount": 1, "facilityGain": 2, "isGoalRace": false, "evidenceStatus": "MANUAL_SNAPSHOT" },
        { "id": "training-stamina", "type": "training", "label": "耐力訓練", "available": true, "failureRate": 12, "gains": { "speed": 0, "stamina": 24, "power": 6, "guts": 0, "wisdom": 0, "skillPt": 10 }, "vitalDelta": -20, "motivationDelta": 0, "bondGain": 4, "hintCount": 0, "facilityGain": 2, "isGoalRace": false, "evidenceStatus": "MANUAL_SNAPSHOT" },
        { "id": "training-wisdom", "type": "training", "label": "智力訓練", "available": true, "failureRate": 4, "gains": { "speed": 8, "stamina": 0, "power": 0, "guts": 0, "wisdom": 20, "skillPt": 16 }, "vitalDelta": 5, "motivationDelta": 0, "bondGain": 4, "hintCount": 1, "facilityGain": 1, "isGoalRace": false, "evidenceStatus": "MANUAL_SNAPSHOT" },
        { "id": "outing-recover", "type": "outing", "label": "外出恢復幹勁", "available": true, "failureRate": 0, "gains": { "speed": 0, "stamina": 0, "power": 0, "guts": 0, "wisdom": 0, "skillPt": 8 }, "vitalDelta": 25, "motivationDelta": 1, "bondGain": 0, "hintCount": 0, "facilityGain": 0, "isGoalRace": false, "evidenceStatus": "MANUAL_SNAPSHOT" },
        { "id": "goal-race-next", "type": "race", "label": "下一場目標賽", "available": true, "failureRate": 0, "gains": { "speed": 0, "stamina": 0, "power": 0, "guts": 0, "wisdom": 0, "skillPt": 45 }, "vitalDelta": -25, "motivationDelta": 0, "bondGain": 0, "hintCount": 0, "facilityGain": 0, "isGoalRace": true, "evidenceStatus": "COMMUNITY_TOOL_OBSERVED" }
      ]
    }
  };
});
