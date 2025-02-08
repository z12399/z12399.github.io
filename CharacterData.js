//暫時把武器的(52%攻)和潛能套裝效果(30%屬傷20屬攻)放在這裡
//要考慮自增益
//爆傷要先減去100%

const characterData = {
    '冰岩': {
        'baseAtk': 734,
        'atkPercentage': 0.52,
        'attributeDamage': 0.3,
        'critRate': 0.375,
        'critDamage': 0.5
    },
    '冰薄荷': {
        'baseAtk': 680,
        'atkPercentage': 0.82,
        'attributeDamage': 0.3,
        'critRate': 0.15,
        'critDamage': 0.5
    },

    '雪花糖球': {
        'baseAtk': 683,
        'atkPercentage': 0.52,
        'attributeDamage': 0.30,
        'critRate': 0.375,
        'critDamage': 0.5
    },

    '羅勒青醬': {
        'baseAtk': 672,
        'atkPercentage': 0.82,
        'attributeDamage': 0.3,
        'critRate': 0.375,
        'critDamage': 0.5
    },
    '哈拉帕辣椒': {
        'baseAtk': 722,
        'atkPercentage': 0.82,
        'attributeDamage': 0.3,
        'critRate': 0.15,
        'critDamage': 0.5
    },
    '紫玉甘藍': {
        'baseAtk': 744,
        'atkPercentage': 0.82,
        'attributeDamage': 0.3,
        'critRate': 0.15,
        'critDamage': 0.5,
    },
    '檸檬皮': {
        'baseAtk': 712,
        'atkPercentage': 0.52,
        'attributeDamage': 0.54,
        'critRate': 0.375,
        'critDamage': 0.5,
    },
    '奶油蘇打': {
        'baseAtk': 725,
        'atkPercentage': 0.82,
        'attributeDamage': 0.3,
        'critRate': 0.15,
        'critDamage': 0.5
    },
    '黑麥': {
        'baseAtk': 737,
        'atkPercentage': 0.82,
        'attributeDamage': 0.30,
        'critRate': 0.15,
        'critDamage': 1.3
    },    
    '甜辣醬': {
        'baseAtk': 719,
        'atkPercentage': 0.52,
        'attributeDamage': 0.6,
        'critRate': 0.375,
        'critDamage': 1.619,
    },
    '黑巧克力': {
        'baseAtk': 755,
        'atkPercentage': 0.52,
        'attributeDamage': 0.3,
        'critRate': 0.15,
        'critDamage': 0.875,
    },

    '麻花捲': {
        'baseAtk': 567,
        'atkPercentage': 0.82,
        'attributeDamage': 0.525,
        'critRate': 0.15,
        'critDamage': 0.5
    }
};