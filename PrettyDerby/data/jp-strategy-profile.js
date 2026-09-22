window.JP_STRATEGY_PROFILE = {
  "schemaVersion": 1,
  "id": "jp-oi-dirt-2000-runner-loh-audit-2025",
  "name": "大井泥地 2000m 領頭因子策略（日服同條件校正）",
  "researchedAt": "2026-08-10",
  "catalogRaceId": 110101,
  "upstreamRaceId": 1101,
  "courseId": 11103,
  "eventMode": "loh",
  "serverCompatibility": {
    "targetServer": "zh_tw",
    "catalogAsOf": "2026-07-16",
    "policy": "以繁中本地技能、角色與支援卡目錄作可用性 gate；日服同條件資料只校正賽道幾何、觸發位置與優先序。",
    "caution": "這是本次／下一場繁中 LOH 規劃，不宣稱日服 2026 upcoming；日服 2025 同條件資料不可取代繁中實測。"
  },
  "sources": [
    {
      "id": "official-same-course-history",
      "label": "官方活動公告（歷史同條件）",
      "date": "2025",
      "eventType": "historical-reference",
      "url": "https://umamusume.jp/news/detail?id=2484"
    },
    {
      "id": "utools-oi-2000-runner",
      "label": "U-tools：大井泥地 2000m 領頭技能效果",
      "date": "2026-08-10",
      "eventType": "course-model",
      "url": "https://xn--gck1f423k.xn--1bvt37a.tools/race/courses/11103/effects/runner"
    },
    {
      "id": "kamigame-2025-loh-course",
      "label": "神攻略：2025 LOH 泥地賽道、加速與耐力參考",
      "date": "2025-05-23",
      "eventType": "loh",
      "url": "https://kamigame.jp/umamusume/page/365458142282152316.html"
    },
    {
      "id": "gamewith-2025-loh-course",
      "label": "GameWith：2025 LOH 泥地角色與技能參考",
      "date": "2025-05-23",
      "eventType": "loh",
      "url": "https://gamewith.jp/uma-musume/article/show/492474"
    }
  ],
  "logic": {
    "factorScoreFormula": "賽道位置價值 × 戰馬未覆蓋 × 取得難度 × 發動穩定度 × LOH 權重",
    "raceOrder": [
      "第三彎道 1333m 終盤起點的加速",
      "序盤搶位包",
      "中後段速度連接",
      "固定綠技",
      "耐力模擬與歷史參考"
    ],
    "accelerationCap": 3,
    "directParentReliability": "直接親代固有在育成開始時確定取得；穩定 1～3 名與只限第 1 名的條件必須分開評估。",
    "grandparentReliability": "祖代固有與白因子皆為繼承抽選；不得以理論高值取代實際發動率。"
  },
  "staminaModel": {
    "evaluation": "simulation-first-with-historical-benchmark",
    "referenceGuts": 1000,
    "passiveStaminaSkillIds": [
      200132
    ],
    "tiers": [
      {
        "id": "minimum",
        "label": "先跑模擬",
        "stamina": 1200,
        "goldRecovery": 1,
        "inheritedRecovery35": 1,
        "description": "以本機模擬檢查實際戰馬、綠技與回復觸發。"
      },
      {
        "id": "standard",
        "label": "日服同條件歷史參考",
        "stamina": 1200,
        "goldRecovery": 1,
        "inheritedRecovery35": 1,
        "description": "日服 2025 同條件領頭的歷史參考：耐力 1200、1 金回復、1 小回復；非繁中保證值。"
      },
      {
        "id": "safe",
        "label": "波動保守線",
        "stamina": 1200,
        "goldRecovery": 1,
        "inheritedRecovery35": 2,
        "description": "位置爭奪、掛速或回復不穩時，先以模擬確認再補小回復或耐力。"
      }
    ],
    "recoveryQuality": [],
    "warning": "天候與場地狀態為隨機；不要把歷史耐力參考直接當成固定完成門檻。"
  },
  "parentCandidates": [
    {
      "outfitId": 106802,
      "characterId": 1068,
      "skillId": 110681,
      "nameZhTw": "北部玄駒",
      "outfitTitleZhTw": "[壓軸好戲・慶鶴之志]",
      "icon": "⛩️",
      "rank": 1,
      "strategyWeight": 520,
      "role": "stable-top-three-direct-parent",
      "detail": "吉兆驚天大放送！｜1～3 名終盤彎道速度＋加速；領頭 LOH 穩定主軸。"
    },
    {
      "outfitId": 102001,
      "characterId": 1020,
      "skillId": 100201,
      "nameZhTw": "青雲天空",
      "outfitTitleZhTw": "[青雲釣術]",
      "icon": "☁️",
      "rank": 2,
      "strategyWeight": 500,
      "role": "first-place-ceiling-direct-parent",
      "detail": "釣魚×計謀｜只限第 1 名的終盤彎道加速；上限型親代，不可當作 1～3 名穩定解。"
    },
    {
      "outfitId": 106902,
      "characterId": 1069,
      "skillId": 110691,
      "nameZhTw": "櫻花千代王",
      "outfitTitleZhTw": "[Fleur Enneigée]",
      "icon": "🌸",
      "rank": 4,
      "strategyWeight": 260,
      "role": "position-fallback",
      "detail": "盛開吧盛開吧！我！｜4～5 名的剩餘 650m 位置備案；不是領頭主加速。"
    },
    {
      "outfitId": 103202,
      "characterId": 1032,
      "skillId": 110321,
      "nameZhTw": "愛麗速子",
      "outfitTitleZhTw": "[Lunatic Lab]",
      "icon": "🧪",
      "inventoryRequired": false,
      "rank": 5,
      "strategyWeight": 240,
      "role": "connection-speed",
      "detail": "夏日天空下的光暈｜中後段速度連接，不列為主加速；本地未持有時僅作候補參考。"
    }
  ],
  "inheritanceModes": [
    {
      "id": "balanced",
      "label": "LOH 1～3 名穩定＋第 1 名上限",
      "description": "直接親代同時帶白北部玄駒與普通青雲天空：前者承擔 1～3 名穩定，後者在第 1 名時提高上限。",
      "eventTypes": [
        "loh"
      ],
      "directSkillIds": [
        110681,
        100201
      ],
      "ancestorSkillIds": [
        110321,
        110691
      ]
    },
    {
      "id": "stamina",
      "label": "模擬保守型",
      "description": "若模擬顯示耐力／位置波動，保留白北部玄駒並把連接速度或小回復來源放到祖代，避免把備案誤當主加速。",
      "eventTypes": [
        "loh"
      ],
      "directSkillIds": [
        110681,
        110321
      ],
      "ancestorSkillIds": [
        100201,
        110691
      ]
    },
    {
      "id": "firepower",
      "label": "第 1 名火力型",
      "description": "已能穩定搶到第 1 名時優先普通青雲天空；若未能維持 1～3 名，改回穩定模式。",
      "eventTypes": [
        "loh"
      ],
      "directSkillIds": [
        100201,
        110681
      ],
      "ancestorSkillIds": [
        110691,
        110321
      ]
    }
  ],
  "battleDeckCoverageAssumption": {
    "status": "types-only-optimizer-owned",
    "supportTypes": [
      "Speed",
      "Speed",
      "Stamina",
      "Power",
      "Wisdom",
      "Group"
    ],
    "requiredScenarioSupportIds": [
      30241
    ],
    "rule": "保留繁中 The Twinkle Legends 的 exact 劇本卡 30241；這不是日服 2025 劇本替換。",
    "warning": "只固定卡型與繁中劇本 exact 卡 30241；其餘卡位由 optimizer 依戰馬、持有卡與技能覆蓋決定。"
  },
  "factorPlan": {
    "formula": "賽道位置價值 × 戰馬未覆蓋 × 取得難度 × 發動穩定度 × LOH 權重",
    "redFactor": {
      "label": "紅因子",
      "primary": "中距離 ★3／泥地 ★3",
      "detail": "先取得中距離與泥地適性；領頭適性與角色自身缺口另行判斷。"
    },
    "blueFactor": {
      "label": "藍因子",
      "primary": "耐力 1200 模擬優先",
      "detail": "歷史參考需 1 金回復與 1 小回復；最後以本機模擬和實際綠技結果確認。"
    },
    "categories": [
      {
        "id": "direct-parent",
        "label": "S｜直接親代固有",
        "weight": 520,
        "description": "穩定 1～3 名與只限第 1 名的固有分開取捨。",
        "skills": [
          {
            "id": 110681,
            "weight": 520,
            "deckEligible": false,
            "sourceKind": "parent-unique",
            "activationWindow": "1333m 第三彎道終盤起點",
            "reason": "白北部玄駒：1～3 名穩定主軸。",
            "evidence": [
              "日服同條件攻略",
              "U-tools 11103 領頭快照"
            ]
          },
          {
            "id": 100201,
            "weight": 500,
            "deckEligible": false,
            "sourceKind": "parent-unique",
            "activationWindow": "1333m 終盤彎道",
            "reason": "普通青雲天空：第 1 名上限型，不取代 1～3 名穩定。",
            "evidence": [
              "日服同條件攻略",
              "U-tools 11103 領頭快照"
            ]
          },
          {
            "id": 110691,
            "weight": 260,
            "deckEligible": false,
            "sourceKind": "parent-unique",
            "activationWindow": "剩餘 650m",
            "reason": "舞會櫻花千代王：位置備案，不是領頭主加速。",
            "evidence": [
              "位置條件 4～5 名"
            ]
          },
          {
            "id": 110321,
            "weight": 240,
            "deckEligible": false,
            "sourceKind": "parent-unique",
            "activationWindow": "中後段彎道",
            "reason": "泳裝愛麗速子：速度連接，不列為主加速。",
            "evidence": [
              "連接速度"
            ]
          }
        ]
      },
      {
        "id": "terminal-white",
        "label": "S｜終盤白加速",
        "weight": 480,
        "description": "終盤起點位於第三彎道 1333m；優先前段命中。",
        "skills": [
          {
            "id": 203402,
            "weight": 480,
            "activationWindow": "終盤起點前段",
            "reason": "乘順風而行是領頭／中距離的終盤前段白加速。",
            "evidence": [
              "日服同條件攻略"
            ]
          },
          {
            "id": 203112,
            "weight": 460,
            "activationWindow": "終盤起點",
            "reason": "正面突破可作前方中距離的終盤起點白加速。",
            "evidence": [
              "日服同條件攻略"
            ]
          }
        ]
      },
      {
        "id": "opening-package",
        "label": "A｜序盤搶位包",
        "weight": 410,
        "description": "以實際啟動數與卡組來源判斷，不強迫堆滿。",
        "skills": [
          {
            "id": 200532,
            "weight": 410,
            "activationWindow": "序盤",
            "reason": "先鋒。",
            "evidence": [
              "領頭序盤包"
            ]
          },
          {
            "id": 201601,
            "weight": 400,
            "activationWindow": "序盤",
            "reason": "打好基礎；需確認起跑階段觸發數。",
            "evidence": [
              "領頭序盤包"
            ]
          },
          {
            "id": 201262,
            "weight": 390,
            "activationWindow": "序盤卡位",
            "reason": "迴避危險。",
            "evidence": [
              "領頭序盤包"
            ]
          }
        ]
      },
      {
        "id": "fixed-green",
        "label": "A｜固定綠技",
        "weight": 360,
        "description": "只列固定條件；天候、場地狀態為隨機。",
        "skills": [
          {
            "id": 200012,
            "weight": 360,
            "activationWindow": "全程固定",
            "reason": "順時針○。",
            "evidence": [
              "右回"
            ]
          },
          {
            "id": 200172,
            "weight": 360,
            "activationWindow": "全程固定",
            "reason": "春賽馬娘○。",
            "evidence": [
              "春"
            ]
          },
          {
            "id": 200132,
            "weight": 350,
            "activationWindow": "全程固定",
            "reason": "主要距離○。",
            "evidence": [
              "2000m"
            ]
          },
          {
            "id": 200952,
            "weight": 350,
            "activationWindow": "全程固定",
            "reason": "大井賽場○。",
            "evidence": [
              "大井"
            ]
          },
          {
            "id": 202252,
            "weight": 350,
            "activationWindow": "全程固定",
            "reason": "交流主要競賽○。",
            "evidence": [
              "交流重賞"
            ]
          },
          {
            "id": 202232,
            "weight": 350,
            "activationWindow": "全程固定",
            "reason": "夜間賽○（本地繁中已映射）。",
            "evidence": [
              "time:4"
            ]
          }
        ]
      }
    ]
  },
  "factorSupportPreferences": [
    {
      "supportId": 30154,
      "bonus": 360,
      "role": "序盤包候補",
      "reason": "以實際提示／事件覆蓋檢查領頭序盤包。"
    },
    {
      "supportId": 20086,
      "bonus": 280,
      "role": "本地可用候補",
      "reason": "僅在本次技能缺口與來源 gate 都成立時加權。"
    },
    {
      "supportId": 30210,
      "bonus": 230,
      "role": "序盤覆蓋",
      "reason": "醒目飛鷹可補先鋒、打好基礎等序盤候選。"
    },
    {
      "supportId": 30107,
      "bonus": 180,
      "role": "序盤覆蓋",
      "reason": "丸善斯基可補領頭序盤候選。"
    },
    {
      "supportId": 30227,
      "bonus": 240,
      "role": "卡位覆蓋",
      "reason": "大和赤驥可補迴避危險等候選。"
    },
    {
      "supportId": 30141,
      "bonus": 220,
      "role": "序盤覆蓋",
      "reason": "美浦波旁可補序盤候選；以實際卡組為準。"
    },
    {
      "supportId": 30226,
      "bonus": 160,
      "role": "模擬耐力候補",
      "reason": "只在耐力模擬需要時加權，不把長距離門檻帶入本場。"
    }
  ],
  "traps": [
    {
      "id": "random-weather-and-ground",
      "label": "隨機天候／場地綠技",
      "reason": "LOH 的天候與場地狀態為隨機，不固定列晴天、良場或重場。"
    },
    {
      "id": "slope-skills",
      "label": "坡道技能",
      "reason": "大井 2000m 無坡，坡道技能不發動。",
      "skillIds": [
        201581,
        202172
      ]
    },
    {
      "id": "late-acceleration",
      "label": "最終彎／最終直線過晚加速",
      "reason": "最後衝刺 1667m、最終直線 1614m；王手及其他晚發加速沒有有效加速距離。",
      "skillIds": [
        202711,
        200641,
        200642
      ]
    }
  ]
};
