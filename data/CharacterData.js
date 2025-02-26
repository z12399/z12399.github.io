//暫時把武器的(52%攻)和潛能套裝效果(30%屬傷20屬攻)放在這裡
//要考慮自增益
//爆傷要先減去100%

const characterData = {
    '冰岩': {
        'image': 'TOA_image/冰岩.webp',
        'baseAtk': 734,
        'atkPercentage': 0.52,
        'attributeDamage': 0.3,
        'critRate': 0.375,
        'critDamage': 0.5
    },
    '冰薄荷': {
        'image': 'TOA_image/冰薄荷.webp',
        'baseAtk': 680,
        'atkPercentage': 0.82,
        'attributeDamage': 0.3,
        'critRate': 0.15,
        'critDamage': 0.5
    },

    '雪花糖球': {
        'image': 'TOA_image/雪花糖球.webp',
        'baseAtk': 683,
        'atkPercentage': 0.52,
        'attributeDamage': 0.30,
        'critRate': 0.375,
        'critDamage': 0.5
    },

    '羅勒青醬': {
        'image': 'TOA_image/羅勒青醬.webp',
        'baseAtk': 672,
        'atkPercentage': 0.82,
        'attributeDamage': 0.3,
        'critRate': 0.375,
        'critDamage': 0.5
    },
    '哈拉帕辣椒': {
        'image': 'TOA_image/哈拉帕辣椒.webp',
        'baseAtk': 722,
        'atkPercentage': 0.82,
        'attributeDamage': 0.3,
        'critRate': 0.15,
        'critDamage': 0.5
    },
    '紫玉甘藍': {
        'image': 'TOA_image/紫玉甘藍.webp',
        'baseAtk': 744,
        'atkPercentage': 0.82,
        'attributeDamage': 0.3,
        'critRate': 0.15,
        'critDamage': 0.5,
    },
    '檸檬皮': {
        'image': 'TOA_image/檸檬皮.webp',
        'baseAtk': 712,
        'atkPercentage': 0.52,
        'attributeDamage': 0.54,
        'critRate': 0.375,
        'critDamage': 0.5,
    },
    '奶油蘇打': {
        'image': 'TOA_image/奶油蘇打.webp',
        'baseAtk': 725,
        'atkPercentage': 0.82,
        'attributeDamage': 0.3,
        'critRate': 0.15,
        'critDamage': 0.5
    },
    '黑麥': {
        'image': 'TOA_image/黑麥.webp',
        'baseAtk': 737,
        'atkPercentage': 0.82,
        'attributeDamage': 0.30,
        'critRate': 0.15,
        'critDamage': 1.3
    },    
    '甜辣醬': {
        'image': 'TOA_image/甜辣醬.webp',
        'baseAtk': 719,
        'atkPercentage': 0.52,
        'attributeDamage': 0.6,
        'critRate': 0.375,
        'critDamage': 1.619,
    },
    '黑巧克力': {
        'image': 'TOA_image/黑巧克力.webp',
        'baseAtk': 755,
        'atkPercentage': 0.52,
        'attributeDamage': 0.3,
        'critRate': 0.15,
        'critDamage': 0.875,
    },

    '麻花捲': {
        'image': 'TOA_image/麻花捲.webp',
        'baseAtk': 567,
        'atkPercentage': 0.82,
        'attributeDamage': 0.525,
        'critRate': 0.15,
        'critDamage': 0.5
    }
};