window.FACTOR_RUN_STRATEGY = {
  "schemaVersion": 2,
  "researchedAt": "2026-08-20",
  "availabilityVerifiedAt": "2026-09-22",
  "targetServer": "zh_tw",
  "purpose": "自動／自主育成的多代因子施工策略",
  "principles": [
    "父母先由目標賽道真正需要的繼承固有決定。",
    "因子施工是機率型決策：先確保可用與高價值，再用基礎相性、共同 G1 與路線便利性提高機率，不要求所有維度同時完美。",
    "強固有、關鍵技能或高價值因子可以交換較低的基礎相性或部分共同 G1；只有遊戲規則與使用者明訂條件是硬門。",
    "祖父母承載稀有白因子、相性與共同 G1；更早世代只作為製作祖父母的素材，不直接算入最終六名祖先。",
    "技能點多但可買的有用技能不足時，應補提示來源或先種入舊劇本限定因子，不能只最大化技能總數。",
    "舊劇本只在限定白因子有明確價值時使用一段；取得種子後回到高技能點、較穩定的劇本擴增白因子。"
  ],
  "inheritanceRuleset": {
    "id": "zh_tw-2024-06-27",
    "server": "zh_tw",
    "effectiveDate": "2024-06-27",
    "status": "community-observed",
    "g1Bonus": {
      "edgeIds": [
        "P1-P2",
        "P1-GP11",
        "P1-GP12",
        "P2-GP21",
        "P2-GP22"
      ],
      "pointsPerSharedCanonicalRace": 3,
      "pointsStatus": "community-observed",
      "confirmedOnly": true,
      "canonicalRaceIdRequired": true,
      "projectedScheduleScores": false,
      "sourceIds": [
        "u-tools-g1-five-edges"
      ]
    },
    "redFactorAptitude": {
      "thresholds": [
        {
          "stars": 0,
          "startBonus": 0
        },
        {
          "stars": 1,
          "startBonus": 1
        },
        {
          "stars": 4,
          "startBonus": 2
        },
        {
          "stars": 7,
          "startBonus": 3
        },
        {
          "stars": 10,
          "startBonus": 4
        }
      ],
      "startRankCap": "A",
      "laterInheritanceProbabilityStatus": "UNVERIFIED",
      "sourceIds": [
        "gamewith-red-factor-aptitude"
      ]
    }
  },
  "zhTwTimeline": [
    {
      "id": "g1-five-edge-rule",
      "effectiveDate": "2024-06-27",
      "server": "zh_tw",
      "status": "community-observed",
      "summary": "共同 G1 僅取五條家系邊；每個已確認的共同 canonical raceId 預設 +3，預定賽程不計分。",
      "sourceIds": [
        "u-tools-g1-five-edges"
      ]
    },
    {
      "id": "factor-specification",
      "server": "zh_tw",
      "status": "reported-zh_tw",
      "summary": "因子指定可降低藍／紅種類的抽選負擔；星數、白／綠／劇本因子仍非保證。",
      "sourceIds": [
        "tw-factor-specification"
      ]
    },
    {
      "id": "autonomous-training",
      "server": "zh_tw",
      "status": "reported-zh_tw",
      "summary": "自主訓練育成的繁中服可用性有公告來源；若排程依賴紅因子提高適性或後續繼承，該自動契約仍是 feature-gated/unknown。",
      "sourceIds": [
        "tw-autonomous-training"
      ]
    }
  ],
  "factorSpecification": {
    "enabledByDefault": true,
    "guaranteedKinds": [
      "blue",
      "red"
    ],
    "notGuaranteedKinds": [
      "green",
      "white",
      "scenario"
    ],
    "starPolicy": "固定因子種類不固定星數，星數仍會重抽。",
    "plannerEffect": "降低藍／紅種類的抽選負擔；白因子仍依技能取得與因子化抽選反覆周回。",
    "sourceId": "tw-factor-specification",
    "serverStatus": "reported-zh_tw",
    "verificationNote": "繁中服實裝範圍必須以遊戲內畫面確認；不可把指定結果當作星數或白／綠因子的保證。"
  },
  "factorGuide": {
    "id": "tokyo-2400-new-year-katsuragi-broad-g1-v1",
    "researchedAt": "2026-08-20",
    "availabilityVerifiedAt": "2026-09-22",
    "targetServer": "zh_tw",
    "status": "USER_PLANNED",
    "probabilityStatus": "COMMUNITY_REFERENCE_NOT_WIN_RATE",
    "headline": "先用正月葛城榮主起滾；根性無聲鈴鹿已於繁中服推出，可按技能缺口評估借用補強。",
    "starter": {
      "characterCardId": 110402,
      "ownershipStatus": "USER_RECORDED",
      "inventorySnapshotStatus": "POSTDATES_2026_07_15_INVENTORY_SNAPSHOT",
      "role": "技能母本／第一代泥地橋接種馬",
      "coreSkillIds": [
        203381,
        203391,
        203402
      ],
      "reason": "正月葛城本體已能取得勝負現在正要開始！、英姿颯爽與乘順風而行，第一輪可直接把技能與泥地紅因子一起往下滾。根性無聲鈴鹿已推出，但是否持有或借用仍須另行選定，不影響現有母本開工。"
    },
    "goalContract": {
      "surfaces": [
        "草地",
        "泥地"
      ],
      "distances": [
        "一哩",
        "中距離",
        "長距離"
      ],
      "excludedDistances": [
        "短距離"
      ],
      "raceObjective": "MAXIMIZE_CONFIRMED_SHARED_G1_WINS",
      "raceResultStatus": "PROJECTED_UNTIL_USER_RECORDED",
      "preferredRaceRank": "A",
      "minimumAttemptRank": "C",
      "minimumAttemptRankNote": "C 只代表規劃器的可嘗試門檻，不是勝率保證。",
      "redStarAllocationTarget": {
        "dirt": 10,
        "mile": 1,
        "long": 1,
        "total": 12,
        "result": "正月葛城由草 A／泥 G／一哩 B／中 A／長 B，開局提升為草 A／泥 C／一哩 A／中 A／長 A。",
        "sourceId": "umareference-raising-aptitude"
      },
      "raceRecordPolicy": [
        "先跑下一代也會重複的共同 G1；只有兩端實際都贏過的 canonical G1 才能建立共同勝鞍。",
        "本地 G1 目錄數只是候選池，不代表同一輪全部能排進，也不代表必勝。",
        "連續出賽要把必跑賽與自選賽分開；若可調度，避免第 4 場以上的自選連戰。"
      ]
    },
    "aptitudeTargets": [
      {
        "key": "turf",
        "label": "草地",
        "kind": "surface",
        "aptitudeIndex": 0,
        "targetRank": "A",
        "redStars": 0,
        "priority": "KEEP"
      },
      {
        "key": "dirt",
        "label": "泥地",
        "kind": "surface",
        "aptitudeIndex": 1,
        "targetRank": "C",
        "redStars": 10,
        "priority": "P1"
      },
      {
        "key": "mile",
        "label": "一哩",
        "kind": "distance",
        "aptitudeIndex": 3,
        "distanceType": 2,
        "targetRank": "A",
        "redStars": 1,
        "priority": "P2"
      },
      {
        "key": "medium",
        "label": "中距離",
        "kind": "distance",
        "aptitudeIndex": 4,
        "distanceType": 3,
        "targetRank": "A",
        "redStars": 0,
        "priority": "KEEP"
      },
      {
        "key": "long",
        "label": "長距離",
        "kind": "distance",
        "aptitudeIndex": 5,
        "distanceType": 4,
        "targetRank": "A",
        "redStars": 1,
        "priority": "P2"
      }
    ],
    "constructionSteps": [
      {
        "priority": "P1",
        "title": "正月葛城先開第一輪",
        "action": "把她當技能母本；因子指定優先選泥地，結算前實際學到三個核心技能。",
        "handoff": "先拿泥地紅因子與核心白因子，不要求第一輪就成為最終萬用種馬。"
      },
      {
        "priority": "P2",
        "title": "先把開局適性骨架湊齊",
        "action": "六祖先合計以泥地 10★＋一哩 1★＋長距離 1★為目標。",
        "handoff": "達成後正月葛城可用泥 C 嘗試泥地歷戰，同時保持草／一哩／中／長 A。"
      },
      {
        "priority": "P3",
        "title": "勝鞍只堆可重複的共同 G1",
        "action": "草／泥的一哩、中、長 G1 依實際賽程排入；優先下一代也能跑的同名 canonical race。",
        "handoff": "未實跑仍標 PROJECTED；完成後才寫入種馬紀錄。"
      },
      {
        "priority": "P4",
        "title": "控制連戰事故",
        "action": "第三場自選連戰已進入事故區；若非必跑，第四場以上先插休息或非出賽回合。",
        "handoff": "必跑賽依社群攻略規則不計同一套連戰懲罰，但仍要以遊戲內狀態確認。"
      },
      {
        "priority": "P5",
        "title": "按橋接價值畢業，不等完美",
        "action": "先看泥地紅因子、核心技能白因子與已確認共同 G1，再看星數上限。",
        "handoff": "可用橋接種立刻交給下一代；已推出的根性鈴鹿可作其他角色取得勝負現在正要開始！的支援來源，仍須確認借卡選擇與事件路線。"
      }
    ],
    "graduationLines": [
      {
        "level": "優秀畢業",
        "status": "KEEP",
        "criteria": "泥地 3★＋三個核心技能因子至少 2 個＋主要共同 G1 路線已確認。"
      },
      {
        "level": "主力畢業",
        "status": "KEEP",
        "criteria": "泥地 3★且有核心技能因子，或泥地 2★但有 2 個以上核心技能因子與良好共同 G1。"
      },
      {
        "level": "橋接保留",
        "status": "BRIDGE",
        "criteria": "泥地 2★，或帶到勝負現在正要開始！等稀有核心因子；可先滾下一代，不因少一項就丟棄。"
      },
      {
        "level": "可放棄",
        "status": "REJECT",
        "criteria": "沒有目標紅因子、沒有任何核心技能因子，也沒有新增可重複的共同 G1。"
      }
    ],
    "futureSupport": {
      "supportCardId": 30252,
      "name": "[My Beloved Scenery] 無聲鈴鹿",
      "nameJp": "[My Beloved Scenery] サイレンススズカ",
      "supportType": "Guts",
      "jpReleaseDate": "2025-05-12",
      "zhTwStatus": "RELEASED_ON_ZH_TW",
      "zhTwReleaseDate": "2026-09-13",
      "verifiedAt": "2026-09-22",
      "ownershipStatus": "NOT_ASSERTED",
      "officialEvidence": {
        "sourceUrl": "https://uma.komoejoy.com/news/detail?id=17257c4f772b46e8a05288563cbcf1c9",
        "announcedAt": "2026-09-13T12:00:03+08:00",
        "catalogSourceUrl": "https://gametora.com/data/umamusume/support-cards.e96217eb.json",
        "verifiedAt": "2026-09-22"
      },
      "targetSkillId": 203381,
      "blocking": false,
      "action": "繁中服已推出，可按自有清單或借卡選擇評估。正月葛城已自帶同一金技；鈴鹿可補其他種馬本體的取得路線，但不是必帶，事件的逃脫術與勝負現在正要開始！為互斥選項，也不保證育成時取得。",
      "sourceIds": [
        "tw-guts-suzuka-release",
        "gamewith-guts-suzuka",
        "umamusumelabo-guts-suzuka"
      ]
    },
    "referenceTables": {
      "winRate": {
        "status": "NOT_AVAILABLE",
        "note": "Uma Reference 沒有提供『某適性＝固定勝率』。介面只顯示適性修正與該站的賽事適合度建議；實際勝率受能力、技能、幹勁、賽程與隨機因素影響。"
      },
      "aptitudeModifiers": {
        "status": "COMMUNITY_REFERENCE",
        "sourceId": "umareference-aptitudes",
        "ranks": [
          "S",
          "A",
          "B",
          "C",
          "D",
          "E",
          "F",
          "G"
        ],
        "surfaceAccelerationPercent": [
          5,
          0,
          -10,
          -20,
          -30,
          -50,
          -70,
          -90
        ],
        "distanceSpeedPercent": [
          5,
          0,
          -10,
          -20,
          -40,
          -60,
          -80,
          -90
        ],
        "styleWitPercent": [
          10,
          0,
          -15,
          -25,
          -40,
          -60,
          -80,
          -90
        ],
        "optionalRaceGuidance": "該站建議優先跑顯示 2★ 適合度的自選賽；這是站內建議，不是勝率。"
      },
      "consecutiveRacePenalty": {
        "status": "COMMUNITY_ESTIMATE",
        "sourceId": "umareference-optional-races",
        "columns": [
          "連續出賽",
          "體力狀態",
          "幹勁下降",
          "隨機能力下降",
          "肌膚狀況"
        ],
        "rows": [
          [
            "1",
            "任何體力",
            "0%",
            "0%",
            "0%"
          ],
          [
            "2",
            "任何體力",
            "0%",
            "0%",
            "0%"
          ],
          [
            "3",
            "任何體力",
            "約 60%",
            "0%",
            "約 12%"
          ],
          [
            "4+",
            "任何體力",
            "100%",
            "約 40%",
            "約 33%"
          ],
          [
            "1",
            "體力 0",
            "約 20%",
            "0%",
            "約 5%"
          ],
          [
            "2",
            "體力 0",
            "約 33%",
            "0%",
            "約 10%"
          ],
          [
            "3",
            "體力 0",
            "約 95%",
            "0%",
            "約 20%"
          ],
          [
            "4+",
            "體力 0",
            "100%",
            "約 40%",
            "約 33%"
          ]
        ],
        "mandatoryRaceNote": "來源將必跑賽排除於這組自選連戰懲罰／連戰重置判定之外；仍以繁中服遊戲內結果為準。"
      },
      "inheritanceBase": {
        "status": "COMMUNITY_REFERENCE",
        "sourceId": "umareference-inheriting-sparks",
        "columns": [
          "因子類型",
          "1★",
          "2★",
          "3★"
        ],
        "rows": [
          [
            "藍因子",
            "70%",
            "80%",
            "90%"
          ],
          [
            "紅因子",
            "1%",
            "3%",
            "5%"
          ],
          [
            "綠因子",
            "5%",
            "10%",
            "15%"
          ],
          [
            "賽事白因子",
            "1%",
            "2%",
            "3%"
          ],
          [
            "技能／劇本白因子",
            "3%",
            "6%",
            "9%"
          ]
        ],
        "compatibilityFormula": "基礎率 ×（1＋相性分／100）",
        "grandparentNote": "來源以祖父母約減半說明，但對藍因子例外的語氣不確定；介面不據此計算最終精確總率。"
      },
      "factorGeneration": {
        "status": "COMMUNITY_REFERENCE",
        "blueStatSelectionNote": "藍因子先在五維中抽一項；若只把一項撐到 1100 以上，該指定能力出 3★的整體示例約為 1/5 × 10% ≈ 2%。",
        "blueStarColumns": [
          "結算能力",
          "1★",
          "2★",
          "3★"
        ],
        "blueStarRows": [
          [
            "低於 600",
            "90%",
            "10%",
            "0%"
          ],
          [
            "600–1100",
            "50%",
            "45%",
            "約 6%"
          ],
          [
            "高於 1100",
            "20%",
            "70%",
            "約 10%"
          ]
        ],
        "skillWhiteColumns": [
          "持有技能層級",
          "生成白因子機率"
        ],
        "skillWhiteRows": [
          [
            "一般白技 ○",
            "20%"
          ],
          [
            "雙圈技能 ◎",
            "25%"
          ],
          [
            "金技",
            "40%"
          ]
        ],
        "whiteStarColumns": [
          "結算評價",
          "1★",
          "2★",
          "3★"
        ],
        "whiteStarRows": [
          [
            "一般",
            "50%",
            "45%",
            "5%"
          ],
          [
            "SS+",
            "20%",
            "70%",
            "10%"
          ]
        ],
        "raceScenarioWhiteBase": "賽事／劇本白因子生成基礎值約 20%。",
        "familySameFactorBonus": "每個父母／祖父母同名技能因子約 +2.5%；同名金技因子約 +5%。",
        "redSelectionNote": "紅因子只會從結算時 A 以上的適性軸抽選；A 軸越多越會稀釋指定類型。因子指定可降低類型抽選負擔，但不保證星數。",
        "sourceIds": [
          "umareference-three-star-spark",
          "umareference-white-sparks",
          "umareference-advanced-breeding"
        ]
      }
    }
  },
  "lineageDecisionPolicy": {
    "id": "probabilistic-balanced-v1",
    "principle": "可用先於完美；強固有、關鍵技能或高價值因子可以交換較低基礎相性或部分共同 G1，只有規則與使用者明訂條件是硬門。",
    "hardRequirementLevels": [
      "RULE_REQUIRED",
      "USER_REQUIRED"
    ],
    "projectedG1DefaultRequirementLevel": "RECOMMENDED",
    "g1RoutePolicy": {
      "strictAptitude": false,
      "defaultRequiredRank": "C",
      "foundationCoverageBaselineRank": "A",
      "defaultRequirementLevel": "RECOMMENDED",
      "projectedG1RequirementLevel": "RECOMMENDED",
      "note": "C 是影片策略示例中的可嘗試門檻，不是勝率保證；所有未實跑賽果仍保持 PROJECTED。"
    },
    "stageWeights": {
      "directParent": {
        "courseScore": 8,
        "courseBashin": 260,
        "factorUtility": 0.18,
        "baseAffinity": 12,
        "aptitude": 15,
        "g1Breadth": 10,
        "owned": 120
      },
      "grandparent": {
        "courseScore": 4,
        "courseBashin": 120,
        "factorUtility": 1.2,
        "parentAffinity": 10,
        "targetAffinity": 3,
        "aptitude": 14,
        "g1Breadth": 9,
        "sourceBreadth": 5,
        "owned": 100
      },
      "foundation": {
        "nativeG1": 420,
        "redExpandedG1": 180,
        "childAffinity": 50,
        "targetAffinity": 20,
        "factorUtility": 8,
        "redAxisCost": -150,
        "aptitude": 5,
        "owned": 25
      }
    },
    "handoffPolicy": {
      "requiredMissing": "BLOCKED",
      "recommendedMissing": "READY_WITH_TRADEOFFS",
      "optionalMissing": "NO_EFFECT"
    }
  },
  "inheritanceProbabilityModel": {
    "status": "creator-analysis-unverified",
    "sourceId": "bilibili-61444-fourth-anniversary-breeding",
    "plannerUse": "只用於相對排序、權衡與解釋，不顯示成 VERIFIED 精確機率，也不作硬門。",
    "baseInheritancePercentByStars": {
      "blue": {
        "1": 70,
        "2": 80,
        "3": 90
      },
      "red": {
        "1": 1,
        "2": 3,
        "3": 5
      },
      "green": {
        "1": 5,
        "2": 10,
        "3": 15
      },
      "race": {
        "1": 1,
        "2": 2,
        "3": 3
      },
      "skill": {
        "1": 3,
        "2": 6,
        "3": 9
      },
      "scenario": {
        "1": 3,
        "2": 6,
        "3": 9
      }
    },
    "compatibilityMultiplier": "base × (1 + compatibilityScore / 100)",
    "directParentVsGrandparent": "about-2-to-3x",
    "dirtRouteExample": {
      "estimatedAverageMultiplier": 1.2,
      "extraCommonG1Approx": 7,
      "status": "creator-example-not-universal"
    },
    "geneticFactorGeneration": {
      "sameTypeRedStars6To11Percent": 40,
      "sameTypeRedStars12Percent": 100,
      "status": "creator-slide-unverified"
    }
  },
  "modes": [
    {
      "id": "omakase",
      "nameZhTw": "自動育成（前景）",
      "description": "可設定賽程與優先技能；追求較高技能點、評價與因子品質時優先。",
      "backgroundProgress": false,
      "availability": "僅支援指定劇本",
      "confidence": "official"
    },
    {
      "id": "autonomous",
      "nameZhTw": "自主育成（離線）",
      "description": "繁中服已有自主訓練培育公告來源；若賽程依賴紅因子提高適性或後續隨機繼承，不能視為已驗證可自動完成。",
      "backgroundProgress": true,
      "availability": "zh_tw-reported; red-factor-dependent=feature-gated-unknown",
      "confidence": "reported-zh_tw; red-factor-contract-unknown",
      "featureGates": [
        {
          "id": "red-factor-aptitude-dependent-schedule",
          "status": "feature-gated-unknown",
          "reason": "紅因子產出與後續繼承不等於自主流程已驗證會滿足適性契約。"
        }
      ],
      "sourceIds": [
        "tw-autonomous-training"
      ]
    }
  ],
  "scenarioProfiles": [
    {
      "id": "twinkle-legends",
      "nameZhTw": "The Twinkle Legends",
      "serverStatus": "available-zh_tw",
      "scenarioSupportIds": [
        30241
      ],
      "entryCardPolicy": "required-one",
      "requiredSupportCardIds": [
        30241
      ],
      "requiredSupportTypes": [
        "Group"
      ],
      "requiredCardPlacement": "owned-preferred-borrow-allowed",
      "entryCardNote": "exact ID 30241；持有時固定占五張自有卡之一並保留自由借卡；未持有時唯一借卡固定為 30241 滿等滿突；30137 或任意同型 Group 不可替代。",
      "modes": [
        "omakase",
        "autonomous"
      ],
      "skillPointIndex": 85,
      "usefulHintIndex": 68,
      "panelStabilityIndex": 88,
      "g1FreedomIndex": 78,
      "activeTimeIndex": 90,
      "recommendedFor": [
        "default",
        "parent",
        "grandparent",
        "white-factor-expansion"
      ],
      "summary": "繁中服目前的預設因子劇本；The Twinkle Legends exact 30241 持有時占五張自有卡之一，未持有時借 exact 30241 滿等滿突，適合自動堆面板、技能點與一般白因子。",
      "limitations": [
        "高技能點仍可能因提示池不足而剩餘",
        "心得與事件分支使提示取得不完全穩定"
      ],
      "sourceIds": [
        "gamewith-factor-farming"
      ]
    },
    {
      "id": "aoharu",
      "nameZhTw": "青春盃",
      "serverStatus": "available-zh_tw",
      "scenarioSupportIds": [],
      "entryCardPolicy": "none",
      "requiredSupportCardIds": [],
      "requiredSupportTypes": [],
      "requiredCardPlacement": "none",
      "modes": [
        "autonomous"
      ],
      "skillPointIndex": 38,
      "usefulHintIndex": 58,
      "panelStabilityIndex": 48,
      "g1FreedomIndex": 72,
      "activeTimeIndex": 55,
      "exclusiveSkillIds": [
        210052
      ],
      "recommendedFor": [
        "scenario-exclusive-seed"
      ],
      "summary": "只在需要青春點火等限定白因子時做最前置種子；之後回到高技能點劇本。",
      "limitations": [
        "技能點明顯低於新劇本",
        "若繁中服自主育成尚未支援，應改借已有該因子的素材"
      ],
      "sourceIds": [
        "gamewith-factor-farming"
      ]
    },
    {
      "id": "ura",
      "nameZhTw": "URA Final",
      "serverStatus": "available-zh_tw",
      "scenarioSupportIds": [],
      "entryCardPolicy": "none",
      "requiredSupportCardIds": [],
      "requiredSupportTypes": [],
      "requiredCardPlacement": "none",
      "modes": [
        "omakase",
        "autonomous"
      ],
      "skillPointIndex": 34,
      "usefulHintIndex": 42,
      "panelStabilityIndex": 52,
      "g1FreedomIndex": 70,
      "activeTimeIndex": 82,
      "recommendedFor": [
        "fast-seed",
        "ura-factor"
      ],
      "summary": "只有明確需要 URA 因子或短時間前置素材時採用；不是一般白因子擴增的預設。",
      "limitations": [
        "技能點與提示數較低"
      ],
      "sourceIds": [
        "gamewith-factor-farming"
      ]
    }
  ],
  "skillFactorModel": {
    "status": "community-assumption-not-official",
    "ordinarySkill": 0.2,
    "doubleCircleSkill": 0.25,
    "goldSkill": 0.4,
    "formula": "最大化 Σ(技能賽道效用 × 因子化代理機率)，而非單純最大化已學技能數。",
    "warning": "2026 現行精確機率與同名祖先加成未公開，不得把此代理顯示成保證機率。"
  },
  "scenarioDecision": {
    "defaultScenarioId": "twinkle-legends",
    "exclusiveSeedPolicy": "若目標含舊劇本限定技能，最前置層做一次限定種子，後續祖父母與父母回到預設高輸出劇本。",
    "borrowFallback": "若指定舊劇本無可用自動模式，借用帶該白因子的前置素材，不要求整條家系手動周回。",
    "surplusSkillPointPolicy": "技能點預期會剩餘時，優先增加有用提示來源、低成本白技與同名金技路線；不因技能點多就購買無關技能。"
  },
  "sources": [
    {
      "id": "bilibili-61444-fourth-anniversary-breeding",
      "layer": "creator-analysis",
      "label": "61444不玩賽馬娘攻略組：四周年種馬、相性與泥地歷戰路線",
      "url": "https://www.bilibili.com/video/BV1tX96YMEZ9/",
      "date": "2025-03-03",
      "claimScope": "影片中的基礎繼承率、相性乘數、父母與祖父母差異、泥地路線及紅因子星數門檻；均作社群模型與策略示例，不當作官方精確機率。"
    },
    {
      "id": "official-4th-anniversary",
      "layer": "fact",
      "label": "Cygames：4 周年新功能與因子指定",
      "url": "https://umamusume.jp/steam-news/detail?id=2419",
      "date": "2025-02-22"
    },
    {
      "id": "tw-factor-specification",
      "layer": "reported-zh_tw",
      "label": "繁中服：因子指定功能討論與公告轉載",
      "url": "https://forum.gamer.com.tw/C.php?bsn=34421&snA=12825",
      "reportedAt": "2026-08-10",
      "sourceDateStatus": "page-date-not-verified",
      "claimScope": "繁中服因子指定可用性；星數與其他因子種類不保證。"
    },
    {
      "id": "official-autonomous-training",
      "layer": "fact-jp-current",
      "label": "Cygames：自主訓練育成",
      "url": "https://umamusume.jp/news/detail?id=3318",
      "date": "2026-06-29"
    },
    {
      "id": "tw-autonomous-training",
      "layer": "reported-zh_tw",
      "label": "繁中服：自主訓練培育功能討論與公告轉載",
      "url": "https://forum.gamer.com.tw/C.php?bsn=34421&snA=14816",
      "reportedAt": "2026-08-10",
      "sourceDateStatus": "page-date-not-verified",
      "claimScope": "繁中服自主訓練培育；紅因子依賴的完成契約仍需遊戲內驗證。"
    },
    {
      "id": "official-auto-faq",
      "layer": "fact",
      "label": "Cygames FAQ：自動育成限制",
      "url": "https://support.umamusume.jp/faq/",
      "date": "2026-08-08"
    },
    {
      "id": "gamewith-factor-farming",
      "layer": "editorial",
      "label": "GameWith：因子周回劇本與支援卡策略",
      "url": "https://gamewith.jp/uma-musume/article/show/258843",
      "date": "2026-08-08"
    },
    {
      "id": "kamigame-lineage",
      "layer": "editorial",
      "label": "神 Game 攻略：祖父母起點與共同 G1",
      "url": "https://kamigame.jp/umamusume/page/147455032642539573.html",
      "date": "2026-08-08"
    },
    {
      "id": "u-tools-g1-five-edges",
      "layer": "community-observed",
      "label": "U-tools：G1 加成五邊與每場 +3",
      "url": "https://xn--gck1f423k.xn--1bvt37a.tools/announcements/5",
      "date": "2023-03-06",
      "claimScope": "五條家系邊、共同 G1 每場 +3、G2/G3/稱號不計。"
    },
    {
      "id": "gamewith-red-factor-aptitude",
      "layer": "community-observed",
      "label": "GameWith：紅因子適性門檻與開局 A 上限",
      "url": "https://gamewith.jp/uma-musume/article/show/270279",
      "date": "2026-06-29",
      "claimScope": "0/1/4/7/10 星的開局適性增量、最高 A；後續繼承機率未公開。"
    },
    {
      "id": "community-white-factor-model",
      "layer": "community-model",
      "label": "白因子妥協線的社群估計",
      "url": "https://note.com/200000is/n/ncac3506cff03",
      "date": "2024-04-05"
    },
    {
      "id": "umareference-aptitudes",
      "layer": "community-guide",
      "label": "Uma Reference：適性效果",
      "url": "https://www.umareference.com/guide/aptitudes",
      "checkedAt": "2026-08-20",
      "claimScope": "場地適性對加速度、距離適性對速度、作戰適性對智力的修正；不是固定勝率。"
    },
    {
      "id": "umareference-optional-races",
      "layer": "community-guide",
      "label": "Uma Reference：自選賽與連戰懲罰",
      "url": "https://www.umareference.com/guide/optional-races",
      "checkedAt": "2026-08-20",
      "claimScope": "自選賽適合度建議、連續出賽與零體力時的社群事故率估計。"
    },
    {
      "id": "umareference-raising-aptitude",
      "layer": "community-guide",
      "label": "Uma Reference：以紅因子提高開局適性",
      "url": "https://www.umareference.com/guide/legacies/raising-aptitude",
      "checkedAt": "2026-08-20",
      "claimScope": "1／4／7／10 顆紅因子星對應開局提升 1／2／3／4 階，開局最高 A。"
    },
    {
      "id": "umareference-inheriting-sparks",
      "layer": "community-guide",
      "label": "Uma Reference：因子繼承基礎率",
      "url": "https://www.umareference.com/guide/legacies/chance-of-inheriting-sparks",
      "checkedAt": "2026-08-20",
      "claimScope": "藍／紅／綠／白因子的星數基礎率與相性乘數；祖父母描述含不確定語氣。"
    },
    {
      "id": "umareference-three-star-spark",
      "layer": "community-guide",
      "label": "Uma Reference：藍因子星數機率",
      "url": "https://www.umareference.com/guide/legacies/3-star-spark-chance",
      "checkedAt": "2026-08-20",
      "claimScope": "藍因子依結算能力區間的 1／2／3 星分布，以及五維抽選示例。"
    },
    {
      "id": "umareference-white-sparks",
      "layer": "community-guide",
      "label": "Uma Reference：白因子生成與星數",
      "url": "https://www.umareference.com/guide/legacies/chance-of-getting-white-sparks",
      "checkedAt": "2026-08-20",
      "claimScope": "一般／雙圈／金技白因子生成率、評價對白因子星數分布與同名家系加成。"
    },
    {
      "id": "umareference-advanced-breeding",
      "layer": "community-guide",
      "label": "Uma Reference：進階種馬施工",
      "url": "https://www.umareference.com/guide/advanced-breeding-strategy",
      "checkedAt": "2026-08-20",
      "claimScope": "共同勝鞍、A 適性紅因子抽選池與可接受 2 星橋接種的策略。"
    },
    {
      "id": "tw-guts-suzuka-release",
      "layer": "official-zh_tw",
      "label": "繁中官方：9/13 SSR 根性無聲鈴鹿推出",
      "url": "https://uma.komoejoy.com/news/detail?id=17257c4f772b46e8a05288563cbcf1c9",
      "checkedAt": "2026-09-22",
      "claimScope": "9/13推出SSR [My Beloved Scenery]無聲鈴鹿；ID30252與根性卡型另以GameTora同名卡原始資料核對，不代表使用者已持有或必帶。"
    },
    {
      "id": "gamewith-guts-suzuka",
      "layer": "jp-editorial-ahead",
      "label": "GameWith：SSR 根性無聲鈴鹿",
      "url": "https://gamewith.jp/uma-musume/article/show/496886",
      "checkedAt": "2026-08-20",
      "claimScope": "日服支援卡類型、金技選項與公開日期；不代表繁中服已實裝。"
    },
    {
      "id": "umamusumelabo-guts-suzuka",
      "layer": "jp-editorial-ahead",
      "label": "Umamusume Labo：根性無聲鈴鹿與正月葛城的技能重疊",
      "url": "https://umamusumelabo.com/chara_support/ssr-suzuka-konjou",
      "checkedAt": "2026-08-20",
      "claimScope": "勝負はここから！適合中距離領頭種馬施工；正月葛城本體已能取得同技能。"
    }
  ]
};
