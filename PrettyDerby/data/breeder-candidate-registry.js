(function (root, factory) {
  const registry = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = registry;
  if (root) {
    root.PRETTY_DERBY_RENTAL_SOURCE_REGISTRY = registry;
    root.RENTAL_SOURCE_REGISTRY = registry;
    root.PRETTY_DERBY_BREEDER_CANDIDATE_REGISTRY = registry;
    root.BREEDER_CANDIDATE_REGISTRY = registry;
    if (root.window && root.window !== root) {
      root.window.PRETTY_DERBY_RENTAL_SOURCE_REGISTRY = registry;
      root.window.RENTAL_SOURCE_REGISTRY = registry;
      root.window.PRETTY_DERBY_BREEDER_CANDIDATE_REGISTRY = registry;
      root.window.BREEDER_CANDIDATE_REGISTRY = registry;
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  return {
  "schemaVersion": "prettyderby-rental-source-registry.v1",
  "registryId": "external-rental-construction-sources",
  "title": "外部借馬施工來源",
  "description": "保存先前規劃中出現的外部租借來源，只供施工重查。這些九位數 ID 不是使用者持有的種馬，不計入我的種馬資產，也不代表目前遊戲內可借用。",
  "canonicalUserRecordedCountFromRepo": 0,
  "canonicalUserRecordedIdsFromRepo": [],
  "candidateCount": 7,
  "sourceScope": "HISTORICAL_PUBLIC_AND_CONVERSATION_RECONSTRUCTION",
  "evidencePolicy": {
    "historicalCandidateAuthority": "ADVISORY_ONLY",
    "canonicalUserRecordedCountFromRepo": 0,
    "availabilityStatus": "NEEDS_IN_GAME_RECHECK",
    "unknownValue": null,
    "repoRegistrationBoundary": "只有本機資料庫中通過保存格式的紀錄才可作為已登錄種馬；本名冊的歷史 ID 不會自動升格或綁進族譜。",
    "g1Boundary": "G1 數字是歷史快照欄位；沒有逐場 canonical 賽事證據時，不把它當成本機已驗證勝場。",
    "whiteFactorBoundary": "有效白數字與白因子例子只保留歷史快照曾記錄的內容；缺少的欄位維持 null，不以陣列長度代替。"
  },
  "planningStatusValues": [
    "PRIMARY",
    "BACKUP",
    "SHORTCUT",
    "REJECTED",
    "INCOMPLETE"
  ],
  "sortPolicy": "先按明示 sortOrder；目前順序為 PRIMARY、BACKUP、SHORTCUT、REJECTED、INCOMPLETE，並保留使用者先前規劃次序。",
  "displaySummary": "外部借馬施工來源 7 筆｜自有資產 0 筆｜全部需要回遊戲重查",
  "candidates": [
    {
      "id": "public-example-1",
      "sourceId": "public-example-1",
      "nameZhTw": "機甲琵琶",
      "displayName": "機甲琵琶",
      "sortOrder": 1,
      "evidenceStatus": "HISTORICAL_PUBLIC_SNAPSHOT",
      "sourceStatus": "HISTORICAL_PUBLIC_SNAPSHOT",
      "availabilityStatus": "NEEDS_IN_GAME_RECHECK",
      "planningStatus": "PRIMARY",
      "planningRole": "主要橋接",
      "historicalOnly": true,
      "canonicalUserRecorded": false,
      "registeredInRepo": false,
      "repoRecordId": null,
      "verifiedInGame": false,
      "bodyBlue": {
        "key": "stamina",
        "label": "耐力",
        "stars": 3
      },
      "bodyRed": {
        "key": "medium",
        "label": "中距離",
        "stars": 3
      },
      "bodyUnique": null,
      "parents": [
        {
          "slot": "parentA",
          "blue": null,
          "red": {
            "key": "dirt",
            "label": "沙地",
            "stars": 3
          },
          "green": null,
          "white": null,
          "g1Count": null
        },
        {
          "slot": "parentB",
          "blue": null,
          "red": {
            "key": "dirt",
            "label": "沙地",
            "stars": 3
          },
          "green": null,
          "white": null,
          "g1Count": null
        }
      ],
      "parentsConstructionReds": [
        {
          "slot": "parentA",
          "red": {
            "dirt": 3
          }
        },
        {
          "slot": "parentB",
          "red": {
            "dirt": 3
          }
        }
      ],
      "effectiveWhiteCount": 15,
      "effectiveWhiteCountStatus": "HISTORICAL_PUBLIC_SNAPSHOT",
      "historicalWhiteFactorExamples": [
        "逆時針○",
        "春季賽馬娘○",
        "中距離直線○",
        "搶得先機",
        "先驅者",
        "正面突破",
        "青春點火．智慧"
      ],
      "historicalWhiteFactorExamplesStatus": "PARTIAL_EXAMPLES_NOT_COMPLETE_LIST",
      "g1Count": 22,
      "g1Status": "HISTORICAL_PUBLIC_SNAPSHOT",
      "factorSummary": {
        "blue": {
          "key": "stamina",
          "label": "耐力",
          "stars": 3
        },
        "red": {
          "key": "medium",
          "label": "中距離",
          "stars": 3
        },
        "unique": null,
        "parents": [
          {
            "slot": "parentA",
            "red": {
              "key": "dirt",
              "label": "沙地",
              "stars": 3
            }
          },
          {
            "slot": "parentB",
            "red": {
              "key": "dirt",
              "label": "沙地",
              "stars": 3
            }
          }
        ],
        "effectiveWhiteCount": 15,
        "g1Count": 22
      },
      "notes": [
        "歷史公開快照記錄本體耐3／中3、父母沙3＋沙3、有效白15、G1 22。",
        "用途是主要橋接；公開候選是否仍可在遊戲內借用必須重新確認。"
      ],
      "displaySummary": "機甲琵琶｜耐3／中3｜父母沙3＋沙3｜有效白15｜G1 22｜主要橋接"
    },
    {
      "id": "public-example-2",
      "sourceId": "public-example-2",
      "nameZhTw": "叢林口袋",
      "displayName": "叢林口袋",
      "sortOrder": 2,
      "evidenceStatus": "HISTORICAL_PUBLIC_SNAPSHOT",
      "sourceStatus": "HISTORICAL_PUBLIC_SNAPSHOT",
      "availabilityStatus": "NEEDS_IN_GAME_RECHECK",
      "planningStatus": "BACKUP",
      "planningRole": "備案",
      "historicalOnly": true,
      "canonicalUserRecorded": false,
      "registeredInRepo": false,
      "repoRecordId": null,
      "verifiedInGame": false,
      "bodyBlue": {
        "key": "stamina",
        "label": "耐力",
        "stars": 3
      },
      "bodyRed": {
        "key": "medium",
        "label": "中距離",
        "stars": 3
      },
      "bodyUnique": null,
      "parents": [
        {
          "slot": "parentA",
          "blue": {
            "key": "stamina",
            "label": "耐力",
            "stars": 2
          },
          "red": {
            "key": "dirt",
            "label": "沙地",
            "stars": 3
          },
          "green": null,
          "white": null,
          "g1Count": null
        },
        {
          "slot": "parentB",
          "blue": {
            "key": "power",
            "label": "力量",
            "stars": 3
          },
          "red": {
            "key": "dirt",
            "label": "沙地",
            "stars": 3
          },
          "green": null,
          "white": null,
          "g1Count": null
        }
      ],
      "parentsConstructionReds": [
        {
          "slot": "parentA",
          "red": {
            "dirt": 3
          },
          "blue": {
            "stamina": 2
          }
        },
        {
          "slot": "parentB",
          "red": {
            "dirt": 3
          },
          "blue": {
            "power": 3
          }
        }
      ],
      "effectiveWhiteCount": 14,
      "effectiveWhiteCountStatus": "HISTORICAL_PUBLIC_SNAPSHOT",
      "historicalWhiteFactorExamples": null,
      "historicalWhiteFactorExamplesStatus": "NOT_RECORDED",
      "g1Count": 20,
      "g1Status": "HISTORICAL_PUBLIC_SNAPSHOT",
      "factorSummary": {
        "blue": {
          "key": "stamina",
          "label": "耐力",
          "stars": 3
        },
        "red": {
          "key": "medium",
          "label": "中距離",
          "stars": 3
        },
        "unique": null,
        "parents": [
          {
            "slot": "parentA",
            "blue": {
              "key": "stamina",
              "label": "耐力",
              "stars": 2
            },
            "red": {
              "key": "dirt",
              "label": "沙地",
              "stars": 3
            }
          },
          {
            "slot": "parentB",
            "blue": {
              "key": "power",
              "label": "力量",
              "stars": 3
            },
            "red": {
              "key": "dirt",
              "label": "沙地",
              "stars": 3
            }
          }
        ],
        "effectiveWhiteCount": 14,
        "g1Count": 20
      },
      "notes": [
        "歷史公開快照記錄本體耐3／中3、父母耐2沙3＋力3沙3、有效白14、G1 20。",
        "相較主要橋接候選作備案；有效白的具體清單未在本名冊重建。"
      ],
      "displaySummary": "叢林口袋｜耐3／中3｜父母耐2沙3＋力3沙3｜有效白14｜G1 20｜備案"
    },
    {
      "id": "public-example-3",
      "sourceId": "public-example-3",
      "nameZhTw": "舞會櫻花千代王",
      "displayName": "舞會櫻花千代王",
      "sortOrder": 3,
      "evidenceStatus": "HISTORICAL_PUBLIC_SNAPSHOT",
      "sourceStatus": "HISTORICAL_PUBLIC_SNAPSHOT",
      "availabilityStatus": "NEEDS_IN_GAME_RECHECK",
      "planningStatus": "BACKUP",
      "planningRole": "位置備案",
      "historicalOnly": true,
      "canonicalUserRecorded": false,
      "registeredInRepo": false,
      "repoRecordId": null,
      "verifiedInGame": false,
      "bodyBlue": {
        "key": "stamina",
        "label": "耐力",
        "stars": 3
      },
      "bodyRed": {
        "key": "medium",
        "label": "中距離",
        "stars": 2
      },
      "bodyUnique": null,
      "parents": [
        {
          "slot": "parentA",
          "blue": {
            "key": "stamina",
            "label": "耐力",
            "stars": 3
          },
          "red": {
            "key": "dirt",
            "label": "沙地",
            "stars": 2
          },
          "green": null,
          "white": null,
          "g1Count": null
        },
        {
          "slot": "parentB",
          "blue": {
            "key": "power",
            "label": "力量",
            "stars": 3
          },
          "red": {
            "key": "dirt",
            "label": "沙地",
            "stars": 3
          },
          "green": null,
          "white": null,
          "g1Count": null
        }
      ],
      "parentsConstructionReds": [
        {
          "slot": "parentA",
          "red": {
            "dirt": 2
          },
          "blue": {
            "stamina": 3
          }
        },
        {
          "slot": "parentB",
          "red": {
            "dirt": 3
          },
          "blue": {
            "power": 3
          }
        }
      ],
      "effectiveWhiteCount": 13,
      "effectiveWhiteCountStatus": "HISTORICAL_PUBLIC_SNAPSHOT",
      "historicalWhiteFactorExamples": null,
      "historicalWhiteFactorExamplesStatus": "NOT_RECORDED",
      "g1Count": 19,
      "g1Status": "HISTORICAL_PUBLIC_SNAPSHOT",
      "factorSummary": {
        "blue": {
          "key": "stamina",
          "label": "耐力",
          "stars": 3
        },
        "red": {
          "key": "medium",
          "label": "中距離",
          "stars": 2
        },
        "unique": null,
        "parents": [
          {
            "slot": "parentA",
            "blue": {
              "key": "stamina",
              "label": "耐力",
              "stars": 3
            },
            "red": {
              "key": "dirt",
              "label": "沙地",
              "stars": 2
            }
          },
          {
            "slot": "parentB",
            "blue": {
              "key": "power",
              "label": "力量",
              "stars": 3
            },
            "red": {
              "key": "dirt",
              "label": "沙地",
              "stars": 3
            }
          }
        ],
        "effectiveWhiteCount": 13,
        "g1Count": 19
      },
      "notes": [
        "歷史公開快照記錄本體耐3／中2、父母耐3沙2＋力3沙3、有效白13、G1 19。",
        "作為位置備案，不是領頭主加速方向。"
      ],
      "displaySummary": "舞會櫻花千代王｜耐3／中2｜父母耐3沙2＋力3沙3｜有效白13｜G1 19｜位置備案"
    },
    {
      "id": "public-example-4",
      "sourceId": "public-example-4",
      "nameZhTw": "萬聖重砲",
      "displayName": "萬聖重砲",
      "sortOrder": 4,
      "evidenceStatus": "HISTORICAL_PUBLIC_SNAPSHOT",
      "sourceStatus": "HISTORICAL_PUBLIC_SNAPSHOT",
      "availabilityStatus": "NEEDS_IN_GAME_RECHECK",
      "planningStatus": "SHORTCUT",
      "planningRole": "一代捷徑",
      "historicalOnly": true,
      "canonicalUserRecorded": false,
      "registeredInRepo": false,
      "repoRecordId": null,
      "verifiedInGame": false,
      "bodyBlue": {
        "key": "speed",
        "label": "速度",
        "stars": 3
      },
      "bodyRed": {
        "key": "medium",
        "label": "中距離",
        "stars": 2
      },
      "bodyUnique": null,
      "parents": [
        {
          "slot": "parentA",
          "blue": null,
          "red": {
            "key": "dirt",
            "label": "沙地",
            "stars": 2
          },
          "green": null,
          "white": null,
          "g1Count": null
        },
        {
          "slot": "parentB",
          "blue": null,
          "red": {
            "key": "dirt",
            "label": "沙地",
            "stars": 2
          },
          "green": null,
          "white": null,
          "g1Count": null
        }
      ],
      "parentsConstructionReds": [
        {
          "slot": "parentA",
          "red": {
            "dirt": 2
          }
        },
        {
          "slot": "parentB",
          "red": {
            "dirt": 2
          }
        }
      ],
      "effectiveWhiteCount": null,
      "effectiveWhiteCountStatus": "UNKNOWN_NOT_RECORDED",
      "historicalWhiteFactorExamples": [
        "春季賽馬娘○",
        "乘順風而行",
        "青春點火．智慧"
      ],
      "historicalWhiteFactorExamplesStatus": "PARTIAL_HISTORICAL_RECORD_OTHER_VALUES_UNKNOWN",
      "g1Count": null,
      "g1Status": "UNKNOWN_NOT_RECORDED",
      "factorSummary": {
        "blue": {
          "key": "speed",
          "label": "速度",
          "stars": 3
        },
        "red": {
          "key": "medium",
          "label": "中距離",
          "stars": 2
        },
        "unique": null,
        "parents": [
          {
            "slot": "parentA",
            "red": {
              "key": "dirt",
              "label": "沙地",
              "stars": 2
            }
          },
          {
            "slot": "parentB",
            "red": {
              "key": "dirt",
              "label": "沙地",
              "stars": 2
            }
          }
        ],
        "effectiveWhiteCount": null,
        "g1Count": null
      },
      "notes": [
        "歷史記錄只確認本體速3／中2、父母沙2＋沙2，以及春、乘順風、青春智慧等白因子例子。",
        "有效白總數、G1 與其餘欄位未知，不能用例子數量或 0 代替。",
        "可直接借作省一代方案，但耐力與紅因控制弱於主要橋接候選。"
      ],
      "displaySummary": "萬聖重砲｜速3／中2｜父母沙2＋沙2｜白因：春／乘順風／青春智慧（其餘未知）｜一代捷徑"
    },
    {
      "id": "public-example-5",
      "sourceId": "public-example-5",
      "nameZhTw": "聯動北黑",
      "displayName": "聯動北黑",
      "sortOrder": 5,
      "evidenceStatus": "USER_CONVERSATION_RECONSTRUCTION",
      "sourceStatus": "USER_CONVERSATION_RECONSTRUCTION",
      "availabilityStatus": "NEEDS_IN_GAME_RECHECK",
      "planningStatus": "REJECTED",
      "planningRole": "路線角色重複，不建議",
      "historicalOnly": true,
      "canonicalUserRecorded": false,
      "registeredInRepo": false,
      "repoRecordId": null,
      "verifiedInGame": false,
      "bodyBlue": {
        "key": "guts",
        "label": "意志",
        "stars": 2
      },
      "bodyRed": {
        "key": "runner",
        "label": "領頭",
        "stars": 3
      },
      "bodyUnique": null,
      "parents": null,
      "parentsConstructionReds": null,
      "effectiveWhiteCount": 3,
      "effectiveWhiteCountStatus": "USER_CONVERSATION_RECONSTRUCTION",
      "historicalWhiteFactorExamples": null,
      "historicalWhiteFactorExamplesStatus": "NOT_RECORDED",
      "g1Count": null,
      "g1Status": "UNKNOWN_NOT_RECORDED",
      "factorSummary": {
        "blue": {
          "key": "guts",
          "label": "意志",
          "stars": 2
        },
        "red": {
          "key": "runner",
          "label": "領頭",
          "stars": 3
        },
        "unique": null,
        "parents": null,
        "effectiveWhiteCount": 3,
        "g1Count": null
      },
      "routeRoleAssessment": {
        "sameCharacterRoleAs": "北黑",
        "duplicateRisk": true,
        "recommendation": "NOT_RECOMMENDED"
      },
      "notes": [
        "既有摘要的正確值是意志2／領頭3／有效白3；不要把早先的意志3當成已確認值。",
        "本體角色與北黑路線重複，因此不作北黑側替代父輩。"
      ],
      "displaySummary": "聯動北黑｜意志2／領頭3｜有效白3｜北黑路線角色重複｜不建議"
    },
    {
      "id": "public-example-6",
      "sourceId": "public-example-6",
      "nameZhTw": "聖誕成田路",
      "displayName": "聖誕成田路",
      "sortOrder": 6,
      "evidenceStatus": "HISTORICAL_PUBLIC_SNAPSHOT",
      "sourceStatus": "HISTORICAL_PUBLIC_SNAPSHOT",
      "availabilityStatus": "NEEDS_IN_GAME_RECHECK",
      "planningStatus": "INCOMPLETE",
      "planningRole": "僅歷史候選",
      "historicalOnly": true,
      "canonicalUserRecorded": false,
      "registeredInRepo": false,
      "repoRecordId": null,
      "verifiedInGame": false,
      "bodyBlue": null,
      "bodyRed": null,
      "bodyUnique": null,
      "parents": null,
      "parentsConstructionReds": null,
      "effectiveWhiteCount": null,
      "effectiveWhiteCountStatus": "UNKNOWN_NOT_RECORDED",
      "historicalWhiteFactorExamples": null,
      "historicalWhiteFactorExamplesStatus": "UNKNOWN_NOT_RECORDED",
      "g1Count": null,
      "g1Status": "UNKNOWN_NOT_RECORDED",
      "factorSummary": {
        "blue": null,
        "red": null,
        "unique": null,
        "parents": null,
        "effectiveWhiteCount": null,
        "g1Count": null
      },
      "notes": [
        "只保留先前規劃中出現的歷史候選 ID 與名稱。",
        "本體、因子、父母、有效白與 G1 欄位均未知，使用前必須重新取得與確認。"
      ],
      "displaySummary": "聖誕成田路｜僅歷史候選｜本體／因子／父母／白因／G1 未知｜需重查"
    },
    {
      "id": "public-example-7",
      "sourceId": "public-example-7",
      "nameZhTw": "澤游／98白8沙砲",
      "displayName": "澤游／98白8沙砲",
      "sortOrder": 7,
      "evidenceStatus": "USER_CONVERSATION_RECONSTRUCTION",
      "sourceStatus": "USER_CONVERSATION_RECONSTRUCTION",
      "availabilityStatus": "NEEDS_IN_GAME_RECHECK",
      "planningStatus": "REJECTED",
      "planningRole": "使用者曾評估後拒絕",
      "historicalOnly": true,
      "canonicalUserRecorded": false,
      "registeredInRepo": false,
      "repoRecordId": null,
      "verifiedInGame": false,
      "bodyBlue": null,
      "bodyRed": null,
      "bodyUnique": null,
      "parents": null,
      "parentsConstructionReds": null,
      "effectiveWhiteCount": null,
      "effectiveWhiteCountStatus": "UNKNOWN_NOT_RECORDED",
      "historicalWhiteFactorExamples": null,
      "historicalWhiteFactorExamplesStatus": "UNKNOWN_NOT_RECORDED",
      "g1Count": null,
      "g1Status": "UNKNOWN_NOT_RECORDED",
      "factorSummary": {
        "blue": null,
        "red": null,
        "unique": null,
        "parents": null,
        "effectiveWhiteCount": null,
        "g1Count": null
      },
      "rejectionReason": "使用者曾評估後拒絕；名稱中的本體、因子與數字不可反推，具體欄位全部保留 null。",
      "notes": [
        "這是歷史候選與使用者決策的重建，不是本機已登錄紀錄。",
        "不可把名稱中的 98、白8、沙砲拆成未經確認的本體或因子。"
      ],
      "displaySummary": "澤游／98白8沙砲｜使用者曾評估後拒絕｜本體／因子未知"
    }
  ]
};
});
