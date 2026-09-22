(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SUPPORT_CARD_LEVEL_FIXTURES = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // The upstream profile snapshot in this repository is max-LB only. These
  // small, reviewed rows keep the MVP honest for the cards used by the
  // planner's regression fixtures until a full curve sync is available.
  const fixtures = [
    {
      id: 30226,
      maxLevelByLimitBreak: { 0: 30, 1: 35, 2: 40, 3: 45, 4: 50 },
      effectRows: [
        { effectType: 1, unlockLevel: 1, valuesByLevel: { 30: 25, 35: 27, 45: 32, 50: 35 } },
        { effectType: 2, unlockLevel: 1, valuesByLevel: { 30: 20, 35: 23, 45: 30, 50: 30 } },
        { effectType: 8, unlockLevel: 1, valuesByLevel: { 30: 10, 35: 11, 45: 13, 50: 15 } },
        { effectType: 14, unlockLevel: 1, valuesByLevel: { 30: 25, 35: 26, 45: 28, 50: 30 } },
        { effectType: 19, unlockLevel: 1, valuesByLevel: { 30: 0, 35: 0, 45: 40, 50: 80 } },
        { effectType: 30, unlockLevel: 1, valuesByLevel: { 30: 0, 35: 1, 45: 1, 50: 1 } },
        { effectType: 32, unlockLevel: 1, valuesByLevel: { 30: 30, 35: 30, 45: 40, 50: 40 } }
      ],
      unique: {
        unlockLevel: 30,
        raw: { effects: [{ type: 101, value: 80, value_1: 4, value_2: 2 }] },
        condition: { bondAtLeast: 80, effectType: 4, value: 2 }
      },
      eventChoice: {
        options: [[203241], [203251]],
        label: '203241 vs 203251: choose one gold route'
      }
    },
    {
      id: 30173,
      maxLevelByLimitBreak: { 0: 30, 1: 35, 2: 40, 3: 45, 4: 50 },
      effectRows: [
        { effectType: 1, unlockLevel: 1, valuesByLevel: { 1: 10, 30: 25, 50: 30 } },
        { effectType: 2, unlockLevel: 1, valuesByLevel: { 1: 0, 30: 0, 50: 40 } },
        { effectType: 4, unlockLevel: 1, valuesByLevel: { 1: 0, 30: 1, 50: 1 } },
        { effectType: 8, unlockLevel: 1, valuesByLevel: { 1: 0, 30: 5, 50: 5 } },
        { effectType: 14, unlockLevel: 1, valuesByLevel: { 1: 0, 30: 0, 50: 30 } },
        { effectType: 15, unlockLevel: 1, valuesByLevel: { 1: 1, 30: 5, 50: 10 } },
        { effectType: 16, unlockLevel: 1, valuesByLevel: { 1: 1, 30: 15, 50: 20 } },
        { effectType: 17, unlockLevel: 1, valuesByLevel: { 1: 0, 30: 1, 50: 1 } },
        { effectType: 18, unlockLevel: 1, valuesByLevel: { 1: 0, 30: 20, 50: 20 } },
        { effectType: 19, unlockLevel: 1, valuesByLevel: { 1: 5, 30: 50, 50: 65 } },
        { effectType: 30, unlockLevel: 1, valuesByLevel: { 1: 0, 30: 1, 50: 1 } }
      ],
      unique: {
        unlockLevel: 30,
        raw: { effects: [{ type: 103, value: 4, value_1: 10 }] },
        condition: { supportTypeCountAtLeast: 4, effectType: 8, value: 10 }
      },
      eventChoice: {
        options: [[200361], [200381]],
        label: '200361 vs 200381: choose one gold route'
      }
    },
    {
      id: 30209,
      maxLevelByLimitBreak: { 0: 30, 1: 35, 2: 40, 3: 45, 4: 50 },
      effectRows: [
        { effectType: 1, unlockLevel: 1, valuesByLevel: { 30: 20, 50: 25 } },
        { effectType: 2, unlockLevel: 1, valuesByLevel: { 30: 25, 50: 30 } },
        { effectType: 8, unlockLevel: 1, valuesByLevel: { 30: 8, 50: 10 } },
        { effectType: 14, unlockLevel: 1, valuesByLevel: { 30: 25, 50: 35 } },
        { effectType: 19, unlockLevel: 1, valuesByLevel: { 30: 30, 50: 50 } },
        { effectType: 30, unlockLevel: 1, valuesByLevel: { 30: 1, 50: 2 } }
      ],
      unique: {
        unlockLevel: 30,
        raw: { effects: [{ type: 101, value: 100, value_1: 4, value_2: 1, value_3: 6, value_4: 2 }] },
        condition: { bondAtLeast: 100, effects: [{ effectType: 4, value: 1 }, { effectType: 6, value: 2 }] }
      },
      skillRoutes: [{ skillId: 203051, distanceType: 3, reliability: 0.82 }]
    },
    {
      id: 30211,
      eventChoice: {
        options: [[202841], [202951]],
        label: '202841 vs 202951: choose one gold route'
      },
      evidence: {
        sourceUrls: [
          'https://kamigame.jp/umamusume/page/327231629154077249.html',
          'https://umamusumelabo.com/chara_support/ssr-ricky-kasikosa'
        ],
        note: 'The two gold skills are a stage-3 choice; no event probability is inferred.'
      }
    },
    {
      id: 30107,
      maxLevelByLimitBreak: { 0: 30, 1: 35, 2: 40, 3: 45, 4: 50 },
      effectRows: [
        { effectType: 1, unlockLevel: 1, valuesByLevel: { 30: 20, 50: 25 } },
        { effectType: 2, unlockLevel: 1, valuesByLevel: { 30: 25, 50: 30 } },
        { effectType: 3, unlockLevel: 1, valuesByLevel: { 30: 1, 50: 1 } },
        { effectType: 5, unlockLevel: 1, valuesByLevel: { 30: 1, 50: 1 } },
        { effectType: 14, unlockLevel: 1, valuesByLevel: { 30: 25, 50: 30 } },
        { effectType: 15, unlockLevel: 1, valuesByLevel: { 30: 3, 50: 5 } },
        { effectType: 16, unlockLevel: 1, valuesByLevel: { 30: 5, 50: 10 } },
        { effectType: 17, unlockLevel: 1, valuesByLevel: { 30: 1, 50: 2 } },
        { effectType: 18, unlockLevel: 1, valuesByLevel: { 30: 25, 50: 30 } },
        { effectType: 19, unlockLevel: 1, valuesByLevel: { 30: 25, 50: 35 } }
      ],
      unique: {
        unlockLevel: 30,
        raw: { effects: [{ type: 111, value: 8, value_1: 5 }] },
        condition: { facilityLevelMultiplier: 5, reliability: 0.82 }
      },
      skillRoutes: [{ skillId: 201271, runningStyle: 1, reliability: 0.82 }]
    },
    {
      id: 30242,
      maxLevelByLimitBreak: { 0: 30, 1: 35, 2: 40, 3: 45, 4: 50 },
      bundleChoices: [
        { id: 'A', skillIds: [202701, 203431], label: 'A: 202701 + 203431' },
        { id: 'B', skillIds: [200361, 200331], label: 'B: 200361 + 200331' }
      ]
    }
  ];

  return {
    schemaVersion: 1,
    maxLevelByLimitBreak: { R: [20, 25, 30, 35, 40], SR: [25, 30, 35, 40, 45], SSR: [30, 35, 40, 45, 50] },
    capFixtures: [
      { before: 1190, rawGain: 30, displayedAfter: 1210, effectiveMarginal: 15 },
      { before: 1200, rawGain: 20, displayedAfter: 1210, effectiveMarginal: 5 }
    ],
    profiles: fixtures
  };
});
