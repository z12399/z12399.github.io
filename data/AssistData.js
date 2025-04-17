const assistBaseData = {
    '檸檬': {
        'image': 'TOA_image/character/檸檬.webp',
        'baseAtk': 0,
        'atkPercentage': 0,
        'attributeDamage': 0,  // 基礎屬性傷害
        'critRate': 0,
        'critDamage': 0.4,  // 基礎爆擊傷害
        'boostedStats': ['attributeDamage', 'critDamage'],  // 可增益的屬性
        'boostRatio': {  // 增益係數，每1%增益對應的屬性值增長
            'critDamage': 0.004  // 每1%增益增加0.004的爆擊傷害
        }
    },
    '檸檬(光)': {
        'image': 'TOA_image/character/檸檬.webp',
        'baseAtk': 0,
        'atkPercentage': 0,
        'attributeDamage': 0.15,  // 基礎屬性傷害
        'critRate': 0,
        'critDamage': 0.4,  // 基礎爆擊傷害
        'boostedStats': ['attributeDamage', 'critDamage'],  // 可增益的屬性
        'boostRatio': {  // 增益係數，每1%增益對應的屬性值增長
            'attributeDamage': 0.0015,  // 每1%增益增加0.0015的屬性傷害
            'critDamage': 0.004  // 每1%增益增加0.004的爆擊傷害
        }
    },
    '桃子(火)': {
        'image': 'TOA_image/character/桃子.webp',
        'baseAtk': 0,
        'atkPercentage': 0,
        'attributeDamage': 0.15,  // 基礎屬性傷害
        'critRate': 0,
        'critDamage': 0,
        'boostedStats': ['attributeDamage'],  // 可增益的屬性
        'boostRatio': {  // 增益係數
            'attributeDamage': 0.0015  // 每1%增益增加0.0015的屬性傷害
        }
    },
    '辣椒碎片(火)': {
        'image': 'TOA_image/character/辣椒碎片.webp',
        'baseAtk': 0,
        'atkPercentage': 0,
        'attributeDamage': 0.20,  // 基礎屬性傷害
        'critRate': 0,
        'critDamage': 0,
        'boostedStats': ['attributeDamage'],  // 可增益的屬性
        'boostRatio': {  // 增益係數
            'attributeDamage': 0.002  // 每1%增益增加0.002的屬性傷害
        }
    },
    '搖滾(水)': {
        'image': 'TOA_image/character/搖滾.webp',
        'baseAtk': 0,
        'atkPercentage': 0,
        'attributeDamage': 0.30,  // 基礎屬性傷害
        'critRate': 0,
        'critDamage': 0,
        'boostedStats': ['attributeDamage'],  // 可增益的屬性
        'boostRatio': {  // 增益係數
            'attributeDamage': 0.003  // 每1%增益增加0.003的屬性傷害
        }
    },
    '白玉草(風)': {
        'image': 'TOA_image/character/白玉草.webp',
        'baseAtk': 0,
        'atkPercentage': 0,
        'attributeDamage': 0.15,  // 基礎屬性傷害
        'critRate': 0,
        'critDamage': 0,
        'boostedStats': ['attributeDamage'],  // 可增益的屬性
        'boostRatio': {  // 增益係數
            'attributeDamage': 0.0015  // 每1%增益增加0.0015的屬性傷害
        }
    }
};

// 為了保持向後兼容，仍然提供舊的數據格式
const assistData = {
    '檸檬(0%增益,光)': {
        'image': 'TOA_image/character/檸檬.webp',
        'baseAtk': 0,
        'atkPercentage': 0,
        'attributeDamage': 0.15,
        'critRate': 0,
        'critDamage': 0.4
    },
    '檸檬(109%增益)': {
        'image': 'TOA_image/character/檸檬.webp',
        'baseAtk': 0,
        'atkPercentage': 0,
        'attributeDamage': 0,
        'critRate': 0,
        'critDamage': 0.836
    },
    '檸檬(109%增益,光)': {
        'image': 'TOA_image/character/檸檬.webp',
        'baseAtk': 0,
        'atkPercentage': 0,
        'attributeDamage': 0.314,
        'critRate': 0,
        'critDamage': 0.836
    },
    '桃子(0%增益,火)': {
        'image': 'TOA_image/character/桃子.webp',
        'baseAtk': 0,
        'atkPercentage': 0,
        'attributeDamage': 0.15,
        'critRate': 0,
        'critDamage': 0
    },
    '桃子(155%增益,火)': {
        'image': 'TOA_image/character/桃子.webp',
        'baseAtk': 0,
        'atkPercentage': 0,
        'attributeDamage': 0.383,
        'critRate': 0,
        'critDamage': 0
    },
    '辣椒碎片(0%增益,火)': {
        'image': 'TOA_image/character/辣椒碎片.webp',
        'baseAtk': 0,
        'atkPercentage': 0,
        'attributeDamage': 0.20,
        'critRate': 0,
        'critDamage': 0
    },
    '辣椒碎片(40%增益,火)': {
        'image': 'TOA_image/character/辣椒碎片.webp',
        'baseAtk': 0,
        'atkPercentage': 0,
        'attributeDamage': 0.28,
        'critRate': 0,
        'critDamage': 0
    },
    '搖滾(0%增益,水)': {
        'image': 'TOA_image/character/搖滾.webp',
        'baseAtk': 0,
        'atkPercentage': 0,
        'attributeDamage': 0.30,
        'critRate': 0,
        'critDamage': 0
    },
    '搖滾(155%增益,水)': {
        'image': 'TOA_image/character/搖滾.webp',
        'baseAtk': 0,
        'atkPercentage': 0,
        'attributeDamage': 0.765,
        'critRate': 0,
        'critDamage': 0
    }
};