(function (root, factory) {
  const registry = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = registry;
  if (root) {
    root.PRETTY_DERBY_OWNED_BREEDER_REGISTRY = registry;
    root.OWNED_BREEDER_REGISTRY = registry;
    if (root.window && root.window !== root) {
      root.window.PRETTY_DERBY_OWNED_BREEDER_REGISTRY = registry;
      root.window.OWNED_BREEDER_REGISTRY = registry;
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  return {
  "schemaVersion": "prettyderby-owned-breeder-registry.v1",
  "registryId": "user-owned-breeder-plan",
  "title": "我的種馬資產",
  "description": "只記錄使用者已確認持有的種馬，以及準備由使用者自己養出的下一代。外部租借 ID 不會進入 ownedRecords，也不計入可用資產。",
  "evidencePolicy": {
    "ownedAuthority": "USER_CONFIRMED_OWNED",
    "plannedAuthority": "PLANNED_SELF_BUILD_NOT_OWNED_YET",
    "browserRecordAuthority": "USER_RECORDED",
    "browserBindingBoundary": "本清單的 S1、M1、B1、K0 是穩定的規劃編號；只有下方瀏覽器資料庫產生的 record id 才能自動綁定族譜步驟。",
    "externalRentalBoundary": "公開租借 ID 只能作為施工輸入，不是使用者資產，也不能升格成 owned record。",
    "unknownValue": null
  },
  "ownedRecords": [
    {
      "planningId": "K0",
      "displayName": "正月北黑（三沙起點）",
      "characterName": "北部玄駒",
      "outfitId": 106802,
      "outfitTitle": "壓軸好戲・慶鶴之志",
      "ownershipStatus": "USER_CONFIRMED_OWNED",
      "completionStatus": "COMPLETED",
      "usableAsBreeder": true,
      "browserRecordId": null,
      "browserBindingStatus": "UNBOUND_TO_BROWSER_RECORD",
      "planningRole": "既有起點；沙地紅因不直接服務 CM 奧克斯，但仍是你的可用資產",
      "bodyBlue": { "key": "guts", "label": "意志力", "stars": 2 },
      "bodyRed": { "key": "dirt", "label": "沙地", "stars": 3 },
      "bodyUnique": { "label": "吉兆驚天大放送！", "stars": 2 },
      "knownWhiteFactorHighlights": [
        { "name": "中距離彎道○", "stars": 2 },
        { "name": "領先的自尊", "stars": 2 },
        { "name": "搶得先機", "stars": 1 },
        { "name": "先驅者", "stars": 1 },
        { "name": "正面突破", "stars": 2 },
        { "name": "青春點火・智慧", "stars": 2 },
        { "name": "順時針的覺醒", "stars": 2 },
        { "name": "春之覺醒", "stars": 2 }
      ],
      "whiteFactorScope": "PARTIAL_TARGET_RELEVANT_SCREENSHOT_TRANSCRIPTION",
      "parentRecords": null,
      "evidenceStatus": "USER_SCREENSHOT_CONFIRMED_PARTIAL",
      "evidenceRefs": ["codex-clipboard-a2d88d50-b3a7-40ff-b6b4-69b1bec269b5.png"]
    },
    {
      "planningId": "S1",
      "displayName": "原皮青雲天空",
      "characterName": "青雲天空",
      "outfitId": 102001,
      "outfitTitle": "青雲釣術",
      "ownershipStatus": "USER_CONFIRMED_OWNED",
      "completionStatus": "COMPLETED",
      "usableAsBreeder": true,
      "browserRecordId": null,
      "browserBindingStatus": "UNBOUND_TO_BROWSER_RECORD",
      "planningRole": "速度3＋草地3橋接親；白因稍弱但已決定先收",
      "bodyBlue": { "key": "speed", "label": "速度", "stars": 3 },
      "bodyRed": { "key": "turf", "label": "草地", "stars": 3 },
      "bodyUnique": { "label": "釣魚×計謀", "stars": null },
      "knownWhiteFactorHighlights": null,
      "whiteFactorScope": "USER_REPORTED_WEAK_NOT_TRANSCRIBED",
      "parentRecords": null,
      "evidenceStatus": "USER_CONVERSATION_CONFIRMED",
      "evidenceRefs": ["conversation-confirmation-own-seiun-speed3-turf3"]
    },
    {
      "planningId": "B1",
      "displayName": "情人節波旁",
      "characterName": "美浦波旁",
      "outfitId": 102602,
      "outfitTitle": "CODE：淋面裝飾",
      "ownershipStatus": "USER_CONFIRMED_OWNED",
      "completionStatus": "COMPLETED",
      "usableAsBreeder": true,
      "browserRecordId": null,
      "browserBindingStatus": "UNBOUND_TO_BROWSER_RECORD",
      "planningRole": "已出貨的中距離素材親",
      "bodyBlue": { "key": "guts", "label": "意志力", "stars": 3 },
      "bodyRed": { "key": "medium", "label": "中距離", "stars": 3 },
      "bodyUnique": { "label": "巧克力作戰行動", "stars": 2 },
      "knownWhiteFactorHighlights": [
        { "name": "直線靈巧", "stars": 1 },
        { "name": "加快節奏", "stars": 2 },
        { "name": "緊咬不放", "stars": 2 },
        { "name": "領頭直線○", "stars": 2 },
        { "name": "領頭彎道○", "stars": 2 },
        { "name": "領先的自尊", "stars": 2 },
        { "name": "打好基礎", "stars": 2 },
        { "name": "青春點火・智慧", "stars": 2 },
        { "name": "中距離的基因", "stars": 1 }
      ],
      "whiteFactorScope": "PARTIAL_TARGET_RELEVANT_SCREENSHOT_TRANSCRIPTION",
      "parentRecords": null,
      "parentConstructionReds": [
        { "key": "dirt", "label": "沙地", "stars": 3 },
        { "key": "medium", "label": "中距離", "stars": 3 }
      ],
      "evidenceStatus": "USER_SCREENSHOT_CONFIRMED_PARTIAL",
      "evidenceRefs": [
        "codex-clipboard-220ce7e0-cfae-4708-a4d1-ab8909477a38.png",
        "codex-clipboard-5433f638-2b1d-4d19-ad02-2a46799bb5ba.png"
      ]
    },
    {
      "planningId": "M1",
      "displayName": "紅焰丸善斯基（完善司機）",
      "characterName": "丸善斯基",
      "outfitId": 100401,
      "outfitTitle": "嫣紅方程式",
      "ownershipStatus": "USER_CONFIRMED_OWNED",
      "completionStatus": "COMPLETED",
      "usableAsBreeder": true,
      "browserRecordId": null,
      "browserBindingStatus": "UNBOUND_TO_BROWSER_RECORD",
      "planningRole": "已完成的主親代；供葛城線與北黑戰馬線共用",
      "bodyBlue": { "key": "guts", "label": "意志力", "stars": 3 },
      "bodyRed": { "key": "medium", "label": "中距離", "stars": 3 },
      "bodyUnique": { "label": "紅焰檔位/LP1211-M", "stars": 2 },
      "knownWhiteFactorHighlights": [
        { "name": "先鋒", "stars": 2 },
        { "name": "領頭直線○", "stars": 2 },
        { "name": "領先的自尊", "stars": 2 },
        { "name": "正面突破", "stars": 3 },
        { "name": "青春點火・智慧", "stars": 2 },
        { "name": "乘順風而行", "stars": 2 },
        { "name": "堅定的信念", "stars": 2 },
        { "name": "鎖定一切", "stars": 2 }
      ],
      "whiteFactorScope": "PARTIAL_TARGET_RELEVANT_SCREENSHOT_TRANSCRIPTION",
      "parentRecords": null,
      "evidenceStatus": "USER_SCREENSHOT_CONFIRMED_PARTIAL",
      "evidenceRefs": [
        "codex-clipboard-8902795a-ef72-42e5-8aff-185f98f502f8.png",
        "codex-clipboard-49ca5234-bffc-46ad-88e8-681ebc196f40.png"
      ]
    }
  ],
  "plannedRecords": [
    {
      "planningId": "K1",
      "displayName": "正月北黑（葛城用副親代）",
      "ownershipStatus": "PLANNED_SELF_BUILD_NOT_OWNED_YET",
      "completionStatus": "PLANNED",
      "usableAsBreeder": false,
      "buildFromOwnedPlanningIds": ["S1"],
      "externalConstructionSourceIds": ["public-example-1"],
      "targetUse": "M1＋K1 → 正月葛城戰馬",
      "minimumShipLine": [
        "保留青春點火・智慧",
        "中距離2～3，或領頭2／草地3之一",
        "取得數個 CM 奧克斯有效白因子"
      ],
      "notes": "外借只負責這次施工；K1 養成後才會成為你的資產。"
    },
    {
      "planningId": "H1",
      "displayName": "萬聖重砲（北黑戰馬用副親代）",
      "ownershipStatus": "PLANNED_SELF_BUILD_NOT_OWNED_YET",
      "completionStatus": "PLANNED",
      "usableAsBreeder": false,
      "buildFromOwnedPlanningIds": ["S1"],
      "externalConstructionSourceIds": ["public-example-1"],
      "targetUse": "M1＋H1 → 正月北黑戰馬",
      "minimumShipLine": [
        "保留青春點火・智慧",
        "中距離2～3，或領頭2／草地3之一",
        "取得數個 CM 奧克斯有效白因子"
      ],
      "notes": "這是另一條自養支線；未完成前不計入可用資產。"
    }
  ]
};
});
