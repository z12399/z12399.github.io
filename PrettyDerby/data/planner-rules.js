window.PLANNER_RULES = {
  schemaVersion: 1,
  ownership: {
    assumedOwnedRarities: ['R', 'SR'],
    explicitInventoryRarities: ['SSR'],
    unknownLevelPolicy: 'owned-but-unranked'
  },
  strategy: {
    runningStyle: 1,
    label: '領頭',
    locked: true
  },
  breedingDeck: {
    totalSlots: 6,
    ownedSlots: 5,
    borrowedSlots: 1,
    borrowAllowsAnyCard: true,
    preferRequirementsInOwnedSlots: true,
    requiredSupportTypes: [
      { type: 'Speed', minimum: 1, scope: 'entire-deck' }
    ]
  }
};
