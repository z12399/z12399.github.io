window.SCENARIO_MECHANICS_POLICIES = {
  "schemaVersion": 1,
  "asOf": "2026-08-31",
  "profiles": [
    {
      "id": "zh-tw-twinkle-legends-jp-2025-02-24-v1",
      "server": "zh_tw",
      "scenarioId": "twinkle-legends",
      "scenarioName": "The Twinkle Legends",
      "releaseMapping": {
        "zhTwReleaseDate": "2026-06-27",
        "jpReferenceReleaseDate": "2025-02-24",
        "lagDays": 488,
        "mappingBasis": "same-scenario-version"
      },
      "statUtilityPolicy": {
        "id": "twinkle-legends-jp-2025-user-confirmed-double-softcap-v1",
        "threshold": 1200,
        "trainingGainAboveThreshold": 0.5,
        "raceEffectAboveThreshold": 0.5
      },
      "evidence": {
        "scenarioIdentity": "OFFICIAL_PRIMARY",
        "statUtilityCoefficients": "USER_CONFIRMED",
        "sources": [
          {
            "kind": "jp-official-release",
            "url": "https://umamusume.jp/news/detail?id=2419",
            "claim": "The Twinkle Legends opened on JP on 2025-02-24."
          },
          {
            "kind": "zh-tw-official-release",
            "url": "https://www.youtube.com/watch?v=OUcKs17Hr2Q",
            "claim": "The official Traditional Chinese channel announced 2026-06-27."
          },
          {
            "kind": "zh-tw-official-scenario",
            "url": "https://uma.komoejoy.com/contents/game/scenario/thetwinklelegends/",
            "claim": "The Traditional Chinese scenario identity is The Twinkle Legends."
          }
        ],
        "boundary": "The JP 2026-07 rebalance is later than this mapped scenario version and is not imported into this zh_tw profile."
      }
    }
  ]
};
