window.CURRENT_RACE_PROFILE = {
  "schemaVersion": 1,
  "id": "2026-next-loh-oi-2000",
  "name": "LOH｜大井泥地 2000m",
  "source": "zh-tw-planning-with-jp-same-course-calibration",
  "server": "zh_tw",
  "eventMode": "loh",
  "scheduleStatus": "OFFICIAL_TW_CONFIRMED",
  "periodLabel": "9/25 12:00－10/4 11:59",
  "officialEvidence": {
    "sourceUrl": "https://uma.komoejoy.com/news/detail?id=b50e0f165c634070bba7dca7f9e4de93",
    "sourceApiUrl": "https://l11-web-api.komoejoy.com/game/website/content/detail/b50e0f165c634070bba7dca7f9e4de93",
    "announcedAt": "2026-09-22T12:00:00+08:00",
    "verifiedAt": "2026-09-22",
    "period": {
      "label": "9/25 12:00－10/4 11:59",
      "timeZone": "Asia/Taipei",
      "startsAt": "2026-09-25T12:00:00+08:00",
      "endsAt": "2026-10-04T11:59:00+08:00",
      "teamFormationStartsAt": "2026-09-22T12:00:00+08:00",
      "teamFormationEndsAt": "2026-10-01T11:59:00+08:00"
    },
    "confirmedFields": [
      "track",
      "surface",
      "distance",
      "rotation",
      "season",
      "time",
      "randomWeather",
      "randomGroundCondition"
    ],
    "scope": "官方確認活動日期與競賽條件；技能排序、耐力參考與育成建議仍屬規劃模型。"
  },
  "catalogRaceId": 110101,
  "upstreamRaceId": 1101,
  "courseId": 11103,
  "course": {
    "trackId": 10101,
    "trackNameZhTw": "大井",
    "distance": 2000,
    "distanceType": "Medium",
    "groundType": "Dirt",
    "rotation": "Right",
    "season": "Spring",
    "time": "Night",
    "groundCondition": "Random",
    "weather": "Random"
  },
  "context": {
    "always": 1,
    "course_distance": 2000,
    "distance_type": 3,
    "ground_type": 2,
    "rotation": 1,
    "season": 1,
    "time": 4,
    "track_id": 10101,
    "is_abroad": 0,
    "is_dirtgrade": 1,
    "is_basis_distance": 1,
    "is_tight_track": 0,
    "corner_count": 4,
    "running_style": 1
  },
  "strategy": "領頭",
  "battleDeck": {
    "totalSlots": 6,
    "supportTypes": [
      "Speed",
      "Speed",
      "Stamina",
      "Power",
      "Wisdom",
      "Group"
    ],
    "cardIds": [
      null,
      null,
      null,
      null,
      null,
      null
    ],
    "selectionStatus": "types-only",
    "skillCoverageStatus": "pending-card-selection"
  },
  "skillPlan": {
    "status": "loh-oi-dirt-2000-runner-plan",
    "coverageStatus": "dynamic-battle-horse-and-deck",
    "staminaModel": {
      "evaluation": "simulation-first-with-historical-benchmark",
      "historicalBenchmark": {
        "source": "2025-jp-same-course-loh",
        "description": "日服 2025 同條件攻略的領頭參考為耐力 1200、1 個金回復與 1 個小回復；繁中規劃以本機模擬為先，不把此值當成保證門檻。"
      },
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
          "description": "先以實際戰馬、綠技與發動率跑模擬；此值不是固定保底。"
        },
        {
          "id": "standard",
          "label": "日服同條件歷史參考",
          "stamina": 1200,
          "goldRecovery": 1,
          "inheritedRecovery35": 1,
          "description": "日服 2025 同條件的舊參考：耐力 1200 + 1 金回復 + 1 小回復。先以模擬結果調整。"
        },
        {
          "id": "safe",
          "label": "波動保守線",
          "stamina": 1200,
          "goldRecovery": 1,
          "inheritedRecovery35": 2,
          "description": "若有位置爭奪、掛速或回復不穩，增加小回復或實測後補耐力。"
        }
      ],
      "recoveryQuality": [],
      "warning": "天候與場地狀態為隨機，耐力結論必須以本次戰馬與模擬條件複核。"
    },
    "categories": [
      {
        "id": "terminal",
        "label": "S｜終盤起點加速",
        "weight": 500,
        "description": "終盤從 1333m 的第三彎道開始；領頭先用可在起點前後命中的白加速，再以親代固有補位。",
        "skills": [
          {
            "id": 203402,
            "priority": "S",
            "effectLabel": "終盤前段加速",
            "reason": "乘順風而行適用領頭／中距離；第三彎道終盤起點前段的白加速核心。"
          },
          {
            "id": 203112,
            "priority": "S",
            "effectLabel": "終盤起點加速",
            "reason": "正面突破適用中距離前方；作為終盤起點的白加速核心。"
          },
          {
            "id": 110681,
            "priority": "S",
            "effectLabel": "1～3 名終盤彎道速度＋加速",
            "reason": "白北部玄駒的吉兆驚天大放送！可覆蓋 1～3 名，作為 LOH 領頭穩定親代。",
            "sourceKind": "parent-unique"
          },
          {
            "id": 100201,
            "priority": "A",
            "effectLabel": "第 1 名終盤彎道加速",
            "reason": "普通青雲天空的釣魚×計謀只限第 1 名，作為上限型親代；不可把它當成 1～3 名穩定解。",
            "sourceKind": "parent-unique"
          }
        ]
      },
      {
        "id": "opening",
        "label": "A｜序盤搶位",
        "weight": 430,
        "description": "領頭仍需序盤包維持前方位置；以可取得性與實際技能觸發數決定是否因子化。",
        "skills": [
          {
            "id": 200532,
            "priority": "A",
            "effectLabel": "序盤加速",
            "reason": "先鋒是領頭序盤包的一環。"
          },
          {
            "id": 201601,
            "priority": "A",
            "effectLabel": "序盤加速",
            "reason": "打好基礎需搭配足夠序盤觸發數；不是無條件固定發動。"
          },
          {
            "id": 201262,
            "priority": "A",
            "effectLabel": "序盤位置保險",
            "reason": "迴避危險用於處理序盤卡位；依實際配置決定是否納入。"
          }
        ]
      },
      {
        "id": "middle",
        "label": "B｜中後段連接速度",
        "weight": 330,
        "description": "終盤前的速度連接可提高進入第三彎道時的位置品質，但不取代終盤起點加速。",
        "skills": [
          {
            "id": 110321,
            "priority": "B",
            "effectLabel": "中後段速度連接",
            "reason": "泳裝愛麗速子的夏日天空下的光暈定位為連接速度；不是主加速。",
            "sourceKind": "parent-unique",
            "role": "connection-speed-not-primary-acceleration"
          }
        ]
      },
      {
        "id": "efficiency",
        "label": "B｜固定綠技",
        "weight": 300,
        "description": "只列本場固定條件；天候與場地狀態為隨機，不把晴天、良場或重場當固定目標。",
        "skills": [
          {
            "id": 200012,
            "priority": "A",
            "effectLabel": "速度 +40",
            "reason": "順時針固定生效。"
          },
          {
            "id": 200172,
            "priority": "A",
            "effectLabel": "速度 +40",
            "reason": "春賽馬娘固定生效。"
          },
          {
            "id": 200132,
            "priority": "A",
            "effectLabel": "耐力 +40",
            "reason": "主要距離固定生效。"
          },
          {
            "id": 200952,
            "priority": "A",
            "effectLabel": "耐力 +40",
            "reason": "大井賽場固定生效。"
          },
          {
            "id": 202252,
            "priority": "A",
            "effectLabel": "速度 +40",
            "reason": "交流主要競賽固定生效。"
          },
          {
            "id": 202232,
            "priority": "A",
            "effectLabel": "賢能 +40",
            "reason": "本地繁中目錄已對應夜間賽○，本場以 time:4 固定生效。"
          }
        ]
      },
      {
        "id": "insurance",
        "label": "C｜位置／連接備案",
        "weight": 180,
        "description": "僅在主加速與序盤包已滿足後評估；不以備案取代領頭主軸。",
        "skills": [
          {
            "id": 110691,
            "priority": "C",
            "effectLabel": "剩餘 650m 位置備案",
            "reason": "舞會櫻花千代王的盛開吧盛開吧！我！偏 4～5 名位置；作為未進入 1～3 名時的備案，不是領頭主加速。",
            "sourceKind": "parent-unique",
            "role": "position-fallback-not-primary-leader-acceleration"
          }
        ]
      }
    ],
    "traps": [
      {
        "id": "slope-skills",
        "label": "坡道技能",
        "reason": "大井 2000m 沒有上下坡，坡道觸發技能不列入本場。",
        "skillIds": [
          201581,
          202172
        ]
      },
      {
        "id": "late-corner-or-straight-acceleration",
        "label": "過晚的最終彎／最終直線加速",
        "reason": "終盤從約 1333m 開始，體力足夠時可進入最後衝刺；約 1667m 是賽程最後 1/6 的分界，最終直線自 1614m 起。最終直線加速通常偏晚；將軍（王手）另須檢查剩餘距離與跑法條件，不能只憑終盤名稱判斷有效。",
        "skillIds": [
          202711,
          200641,
          200642
        ]
      }
    ],
    "inheritancePolicy": "直接親代先放白北部玄駒與普通青雲天空；舞會櫻花千代王只作位置備案，泳裝愛麗速子只作速度連接。"
  },
  "notes": [
    "本次／下一場繁中規劃使用 LOH 大井泥地 2000m；不是把夏季 Japan Dirt Derby 當成本場名稱。",
    "天候與場地狀態為隨機，因此 context 不寫 weather 或 ground_condition，UI 需顯示隨機。",
    "日服 2025 同條件攻略只作賽道、技能與耐力校正來源；繁中實際養成仍以本地目錄與模擬結果為準。"
  ]
};
