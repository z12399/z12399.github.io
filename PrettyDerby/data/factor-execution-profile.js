window.FACTOR_EXECUTION_PROFILE = {
  "schemaVersion": 1,
  "researchedAt": "2026-08-16",
  "targetServer": "zh_tw",
  "defaultTemplateId": "manual",
  "defaultRiskProfileId": "balanced",
  "purpose": "P0 factor planning: separate lineage value, training feasibility and evidence without claiming a win or factor probability.",
  "riskProfiles": [
    {
      "id": "stable",
      "label": "保守",
      "nearTieToleranceRatio": 0.04,
      "tradeoffBudget": 0.05,
      "description": "較少接受排名差距，只保留非常接近的候選。"
    },
    {
      "id": "balanced",
      "label": "平衡",
      "nearTieToleranceRatio": 0.08,
      "tradeoffBudget": 0.1,
      "description": "硬門必守，允許強技能、較好育成可行性交換部分相性與共同 G1。"
    },
    {
      "id": "upside",
      "label": "進取",
      "nearTieToleranceRatio": 0.12,
      "tradeoffBudget": 0.15,
      "description": "保留更多高上限方案；這不是較高成功率。"
    }
  ],
  "templates": [
    {
      "id": "kua-legend-0811-reference",
      "label": "Kua Legend 社群參考",
      "scenarioId": "twinkle-legends",
      "sourceStatus": "COMMUNITY_TOOL_OBSERVED",
      "recommendationUse": "ADVISORY_ONLY",
      "description": "原工具的分段目標與權重，只作 Legend 育成缺口與藍因子敏感度參考，不是繁中服官方門檻。",
      "diminishingReturns": {
        "threshold": 1200,
        "multiplier": 0.5,
        "evidenceStatus": "ARCHIVE_BYTECODE_OBSERVED"
      },
      "axes": {
        "speed": {
          "label": "速度",
          "minimum": null,
          "target": 1800,
          "belowWeight": 5.17,
          "surplusWeight": 4.93,
          "evidenceStatus": "ARCHIVE_CONFIG_OBSERVED"
        },
        "stamina": {
          "label": "耐力",
          "minimum": null,
          "target": 900,
          "belowWeight": 5,
          "surplusWeight": 0.5,
          "evidenceStatus": "ARCHIVE_CONFIG_OBSERVED"
        },
        "power": {
          "label": "力量",
          "minimum": null,
          "target": 1400,
          "belowWeight": 3.31,
          "surplusWeight": 3.01,
          "evidenceStatus": "ARCHIVE_CONFIG_OBSERVED"
        },
        "guts": {
          "label": "根性",
          "minimum": null,
          "target": 1200,
          "belowWeight": 2.11,
          "surplusWeight": 2.1,
          "evidenceStatus": "ARCHIVE_CONFIG_OBSERVED"
        },
        "wisdom": {
          "label": "智力",
          "minimum": null,
          "target": 1400,
          "belowWeight": 1.16,
          "surplusWeight": 1.16,
          "evidenceStatus": "ARCHIVE_CONFIG_OBSERVED"
        }
      }
    },
    {
      "id": "manual",
      "label": "自行設定",
      "scenarioId": "",
      "sourceStatus": "USER_CONFIGURED",
      "recommendationUse": "ADVISORY_ONLY",
      "description": "不帶入任何社群目標；由使用者設定 minimum、target 與 surplusWeight。",
      "diminishingReturns": {
        "threshold": null,
        "multiplier": 1,
        "evidenceStatus": "USER_CONFIGURED"
      },
      "axes": {
        "speed": {
          "label": "速度",
          "minimum": null,
          "target": null,
          "belowWeight": 1,
          "surplusWeight": 0.25
        },
        "stamina": {
          "label": "耐力",
          "minimum": null,
          "target": null,
          "belowWeight": 1,
          "surplusWeight": 0.25
        },
        "power": {
          "label": "力量",
          "minimum": null,
          "target": null,
          "belowWeight": 1,
          "surplusWeight": 0.25
        },
        "guts": {
          "label": "根性",
          "minimum": null,
          "target": null,
          "belowWeight": 1,
          "surplusWeight": 0.25
        },
        "wisdom": {
          "label": "智力",
          "minimum": null,
          "target": null,
          "belowWeight": 1,
          "surplusWeight": 0.25
        }
      }
    }
  ],
  "raceDensityPolicy": {
    "thirdConsecutiveCost": 1,
    "fourthPlusCost": 2.5,
    "additionalConsecutiveCost": 0.5,
    "goalRacesExempt": true,
    "scoreIncluded": false,
    "evidenceStatus": "COMMUNITY_MODEL_CALIBRATION_REQUIRED",
    "description": "只表達第三連戰起成本提高的相對順序；不得和相性或 G1 分數直接相加。"
  },
  "evidencePolicy": {
    "probabilityStatus": "NOT_COMPUTED",
    "nearTieStatus": "DETERMINISTIC_SENSITIVITY_NOT_PROBABILITY",
    "goalScheduleStatus": "COMMUNITY_SNAPSHOT_CROSSWALK",
    "canonicalCatalog": "LOCAL_GAMETORA_ZH_TW"
  }
};
