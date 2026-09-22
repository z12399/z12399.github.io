(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.STAMINA_SIM_CORE = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const STYLE = {
    runner: {
      id: 1,
      label: '領頭',
      hp: 0.95,
      speed: [1.0, 0.98, 0.962, 0.962],
      acceleration: [1.0, 1.0, 0.996, 0.996]
    }
  };
  const MOOD = {
    '-2': 0.96,
    '-1': 0.98,
    '0': 1,
    '1': 1.02,
    '2': 1.04
  };
  const DISTANCE_APTITUDE = {
    S: 1.05,
    A: 1,
    B: 0.9,
    C: 0.8,
    D: 0.6,
    E: 0.4,
    F: 0.2,
    G: 0.1
  };
  const SURFACE_APTITUDE = { ...DISTANCE_APTITUDE };
  const DISTANCE_ACCELERATION_APTITUDE = {
    S: 1,
    A: 1,
    B: 1,
    C: 1,
    D: 1,
    E: 0.6,
    F: 0.5,
    G: 0.4
  };
  const SOURCES = [
    {
      label: '賽馬娘 School｜體力消耗量公式',
      url: 'https://umamusumeschool.com/hp_decrease/',
      supports: ['最大 HP', '序中盤每秒消耗', '終盤根性消耗係數', '場地係數']
    },
    {
      label: '賽馬娘 School｜實際速度公式',
      url: 'https://umamusumeschool.com/running_speed/',
      supports: ['基準速度', '領頭各階段速度係數', '速度與距離適性補正', '賢能亂數']
    },
    {
      label: '賽馬娘 School｜加速與起跑公式',
      url: 'https://umamusumeschool.com/acceleration_start_dash/',
      supports: ['力量對加速度的影響', '腳質／場地／距離適性加速度係數', '上坡加速度修正']
    },
    {
      label: 'Umalator stamina calculator',
      url: 'https://alpha123.github.io/uma-tools/umalator-global/stamina/',
      supports: ['完整模擬應以多次亂數與場上互動估計', 'HP 與耐力不是一比一']
    }
  ];

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function round(value, digits = 2) {
    const factor = 10 ** digits;
    return Math.round(number(value) * factor) / factor;
  }

  function effectiveStat(raw) {
    const value = Math.max(1, number(raw, 1));
    return value <= 1200 ? value : 1200 + (value - 1200) / 2;
  }

  function correctedStat(raw, mood = 0, greenBonus = 0) {
    const moodMultiplier = MOOD[String(clamp(number(mood), -2, 2))] || 1;
    return effectiveStat(raw) * moodMultiplier + number(greenBonus);
  }

  function baseSpeed(distance) {
    return 20 - (Math.max(1000, number(distance, 2000)) - 2000) / 1000;
  }

  function wisdomRandomPercent(wisdom, quantile = 0) {
    const value = Math.max(1, correctedStat(wisdom));
    const upper = (value / 5500) * Math.log10(value * 0.1);
    const lower = upper - 0.65;
    if (quantile <= -1) return lower;
    if (quantile >= 1) return upper;
    return (upper + lower) / 2;
  }

  function groundConsumptionCoefficient(surface, condition) {
    const dirt = String(surface).toLowerCase() === 'dirt' || surface === 2 || surface === '泥地';
    const normalized = String(condition).toLowerCase();
    if (['bad', 'heavy', '不良'].includes(normalized)) return 1.02;
    if (['soft', '重'].includes(normalized)) return dirt ? 1.01 : 1.02;
    return 1;
  }

  function gutsConsumptionCoefficient(guts) {
    return 200 / Math.sqrt(600 * Math.max(1, correctedStat(guts))) + 1;
  }

  function maximumHp(input) {
    const style = STYLE[input.style] || STYLE.runner;
    const stamina = correctedStat(input.stamina, input.mood, input.staminaGreenBonus);
    return Math.max(1, number(input.distance, 2000) + 0.8 * style.hp * stamina);
  }

  function defaultSegments(distance) {
    const length = Math.max(1000, number(distance, 2000));
    return [
      { id: 'opening', label: '序盤', start: 0, end: length / 6, phase: 0 },
      { id: 'middle', label: '中盤', start: length / 6, end: length * 4 / 6, phase: 1 },
      { id: 'late', label: '終盤前半', start: length * 4 / 6, end: length * 5 / 6, phase: 2 },
      { id: 'spurt', label: '最終衝刺', start: length * 5 / 6, end: length, phase: 3 }
    ];
  }

  function courseSegments(course, distance) {
    const length = Math.max(1000, number(course?.length, distance || 2000));
    const phases = Array.isArray(course?.phases) ? course.phases : [];
    if (phases.length < 4) return defaultSegments(length);
    const labels = ['序盤', '中盤', '終盤前半', '最終衝刺'];
    const ids = ['opening', 'middle', 'late', 'spurt'];
    return phases.slice(0, 4).map((phase, index) => ({
      id: ids[index],
      label: labels[index],
      start: number(phase.start),
      end: number(phase.end, length),
      phase: index
    }));
  }

  function targetSpeed(input, phase) {
    const style = STYLE[input.style] || STYLE.runner;
    const distance = Math.max(1000, number(input.distance, 2000));
    const base = baseSpeed(distance);
    const wisdom = wisdomRandomPercent(input.wisdom, input.wisdomQuantile) / 100;
    const intelligenceTerm = wisdom * base;
    const speedStat = correctedStat(input.speed, input.mood, input.speedGreenBonus);
    const aptitude = DISTANCE_APTITUDE[String(input.distanceAptitude || 'A').toUpperCase()] || 1;
    const speedStatTerm = Math.sqrt(500 * speedStat) * aptitude * 0.002;
    const skillBonus = number(input.phaseSpeedBonuses?.[phase], number(input.speedSkillBonus));
    if (phase < 2) return base * style.speed[phase] + intelligenceTerm + skillBonus;
    if (phase === 2) {
      return base * style.speed[2] + intelligenceTerm + speedStatTerm + skillBonus;
    }
    const lateTarget = base * (style.speed[3] + 0.01) + intelligenceTerm + speedStatTerm;
    const gutsStat = correctedStat(input.guts, input.mood, input.gutsGreenBonus);
    const gutsTerm = (450 * gutsStat) ** 0.597 * 0.0001;
    return lateTarget * 1.05 + speedStatTerm + gutsTerm + skillBonus;
  }

  function isUphillAt(course, position) {
    return (course?.slopes || []).some(slope =>
      Number(slope.slope) > 0
      && number(slope.start) <= position
      && position < number(slope.end)
    );
  }

  function baseAcceleration(input, phase, position = 0) {
    const style = STYLE[input.style] || STYLE.runner;
    const power = correctedStat(input.power, input.mood, input.powerGreenBonus);
    const surfaceAptitude =
      SURFACE_APTITUDE[String(input.surfaceAptitude || 'A').toUpperCase()] || 1;
    const distanceAptitude =
      DISTANCE_ACCELERATION_APTITUDE[
        String(input.distanceAptitude || 'A').toUpperCase()
      ] || 1;
    const baseCoefficient = isUphillAt(input.course, position) ? 0.0004 : 0.0006;
    return baseCoefficient
      * Math.sqrt(500 * Math.max(1, power))
      * number(style.acceleration?.[phase], 1)
      * surfaceAptitude
      * distanceAptitude
      + number(input.phaseAccelerationBonuses?.[phase], number(input.accelerationSkillBonus));
  }

  function statusCoefficientForSegment(input, segmentSeconds) {
    const kakari = clamp(number(input.kakariSeconds), 0, segmentSeconds);
    const spot = clamp(number(input.spotStruggleSeconds), 0, Math.max(0, segmentSeconds - kakari));
    const downhillShare = clamp(number(input.downhillShare), 0, 1);
    const normal = Math.max(0, segmentSeconds - kakari - spot);
    const average =
      (normal * 1 + kakari * 1.6 + spot * number(input.spotStruggleCoefficient, 1.4))
      / Math.max(0.001, segmentSeconds);
    return average * (1 - downhillShare + downhillShare * 0.4);
  }

  function segmentConsumption(input, segment, previousSpeed = null) {
    const distance = Math.max(0, segment.end - segment.start);
    const speed = Math.max(0.1, targetSpeed(input, segment.phase));
    const startingSpeed = previousSpeed == null ? speed : Math.max(0.1, number(previousSpeed, speed));
    const acceleration = Math.max(0.001, baseAcceleration(input, segment.phase, segment.start));
    let accelerationSeconds = 0;
    let seconds = distance / speed;
    if (speed > startingSpeed + 0.001 && distance > 0) {
      const fullAccelerationSeconds = (speed - startingSpeed) / acceleration;
      const fullAccelerationDistance =
        (startingSpeed + speed) / 2 * fullAccelerationSeconds;
      if (fullAccelerationDistance >= distance) {
        accelerationSeconds =
          (-startingSpeed + Math.sqrt(startingSpeed ** 2 + 2 * acceleration * distance))
          / acceleration;
        seconds = accelerationSeconds;
      } else {
        accelerationSeconds = fullAccelerationSeconds;
        seconds = accelerationSeconds + (distance - fullAccelerationDistance) / speed;
      }
    }
    const averageSpeed = distance / Math.max(0.001, seconds);
    const base = baseSpeed(input.distance);
    const status = statusCoefficientForSegment({
      ...input,
      kakariSeconds: number(input.kakariSeconds),
      spotStruggleSeconds: number(input.spotStruggleSeconds),
      downhillShare: number(input.downhillShareByPhase?.[segment.phase], input.downhillShare)
    }, seconds);
    const ground = groundConsumptionCoefficient(input.surface, input.groundCondition);
    const guts = segment.phase >= 2 ? gutsConsumptionCoefficient(input.guts) : 1;
    const perSecond = 20 * status * ((averageSpeed - base + 12) ** 2) / 144 * ground * guts;
    return {
      ...segment,
      distance: round(distance),
      speed: round(speed, 3),
      averageSpeed: round(averageSpeed, 3),
      acceleration: round(acceleration, 4),
      accelerationSeconds: round(accelerationSeconds, 3),
      seconds: round(seconds, 3),
      statusCoefficient: round(status, 4),
      groundCoefficient: ground,
      gutsCoefficient: round(guts, 4),
      perSecond: round(perSecond, 4),
      consumption: round(perSecond * seconds, 3)
    };
  }

  function normalizeRecoveryEvents(events, maxHp) {
    return (Array.isArray(events) ? events : [])
      .map((event, index) => {
        const ratio = clamp(number(event.positionRatio, event.position), 0, 1);
        const percent = clamp(number(event.percent), 0, 1);
        const flat = Math.max(0, number(event.flat));
        return {
          id: event.id || `recovery-${index + 1}`,
          label: event.label || `回復 ${index + 1}`,
          positionRatio: ratio,
          percent,
          amount: round(flat + maxHp * percent, 3),
          procRate: clamp(number(event.procRate, 1), 0, 1)
        };
      })
      .sort((a, b) => a.positionRatio - b.positionRatio);
  }

  function simulateRace(rawInput) {
    const input = {
      style: 'runner',
      distanceAptitude: 'A',
      mood: 0,
      speed: 1200,
      stamina: 1000,
      power: 1000,
      guts: 600,
      wisdom: 1000,
      surface: 'Turf',
      groundCondition: 'Good',
      surfaceAptitude: 'A',
      ...rawInput
    };
    input.distance = Math.max(1000, number(input.course?.length, input.distance || 2000));
    const maxHp = maximumHp(input);
    const recoveryEvents = normalizeRecoveryEvents(input.recoveries, maxHp);
    const directDrain = Math.max(0, maxHp * clamp(number(input.staminaDebuffPercent), 0, 1)
      + number(input.staminaDebuffFlat));
    let hp = maxHp - directDrain;
    let totalConsumed = 0;
    let totalRecovered = 0;
    let recoveryIndex = 0;
    let exhaustionAt = null;
    const stages = [];
    const segments = courseSegments(input.course, input.distance);
    let previousTargetSpeed = null;

    for (const rawSegment of segments) {
      const segment = segmentConsumption({
        ...input,
        // 焦躁與競搶是一次性的全場事件；集中在中盤區段可避免
        // 同一秒數被序盤與中盤各重複計算一次。
        kakariSeconds: rawSegment.id === 'middle' ? input.kakariSeconds : 0,
        spotStruggleSeconds: rawSegment.id === 'middle' ? input.spotStruggleSeconds : 0
      }, rawSegment, previousTargetSpeed);
      previousTargetSpeed = segment.speed;
      const stageRecoveries = [];
      let consumedPosition = segment.start;

      const consumeUntil = position => {
        const targetPosition = clamp(position, consumedPosition, segment.end);
        const distanceShare = segment.distance > 0
          ? (targetPosition - consumedPosition) / segment.distance
          : 0;
        const amount = segment.consumption * distanceShare;
        const before = hp;
        hp -= amount;
        totalConsumed += amount;
        if (hp < 0 && exhaustionAt === null && amount > 0) {
          const share = clamp(before / amount, 0, 1);
          exhaustionAt = round(
            consumedPosition + (targetPosition - consumedPosition) * share
          );
        }
        consumedPosition = targetPosition;
      };

      while (
        recoveryIndex < recoveryEvents.length
        && recoveryEvents[recoveryIndex].positionRatio <= segment.end / input.distance + 1e-9
      ) {
        const recovery = recoveryEvents[recoveryIndex];
        const recoveryPosition = recovery.positionRatio * input.distance;
        consumeUntil(recoveryPosition);
        const expectedAmount = recovery.amount * recovery.procRate;
        const applied = Math.max(0, Math.min(maxHp - hp, expectedAmount));
        hp += applied;
        totalRecovered += applied;
        stageRecoveries.push({ ...recovery, expectedAmount: round(expectedAmount), applied: round(applied) });
        recoveryIndex += 1;
      }
      consumeUntil(segment.end);
      stages.push({
        ...segment,
        recoveries: stageRecoveries,
        remainingHp: round(hp, 3),
        remainingPercent: round(hp / maxHp * 100, 2)
      });
    }

    const margin = hp;
    const spurt = stages.find(stage => stage.id === 'spurt');
    const risk = margin < 0
      ? 'insufficient'
      : margin / maxHp < 0.03
        ? 'critical'
        : margin / maxHp < 0.08
          ? 'tight'
          : 'safe';
    return {
      model: 'deterministic-segment-hp-v1',
      modelLabel: '分段 HP 公式模擬',
      exactness: '近似：使用公開公式與賽道階段，未模擬對手位置、加速過程、技能隨機位置及完整賽事 AI。',
      input,
      maxHp: round(maxHp, 3),
      directDrain: round(directDrain, 3),
      totalConsumed: round(totalConsumed, 3),
      totalRecovered: round(totalRecovered, 3),
      remainingHp: round(margin, 3),
      remainingPercent: round(margin / maxHp * 100, 2),
      fullSpurt: Boolean(spurt && spurt.remainingHp >= 0),
      exhaustionAt,
      risk,
      stages,
      sources: SOURCES
    };
  }

  function simulateScenarios(input) {
    const baseline = simulateRace(input);
    const kakari = simulateRace({
      ...input,
      kakariSeconds: Math.max(12, number(input.kakariSeconds))
    });
    const contested = simulateRace({
      ...input,
      spotStruggleSeconds: Math.max(8, number(input.spotStruggleSeconds))
    });
    const debuffed = simulateRace({
      ...input,
      staminaDebuffPercent: Math.max(0.03, number(input.staminaDebuffPercent))
    });
    return { baseline, kakari, contested, debuffed };
  }

  return {
    STYLE,
    MOOD,
    DISTANCE_APTITUDE,
    SURFACE_APTITUDE,
    DISTANCE_ACCELERATION_APTITUDE,
    SOURCES,
    effectiveStat,
    correctedStat,
    baseSpeed,
    wisdomRandomPercent,
    groundConsumptionCoefficient,
    gutsConsumptionCoefficient,
    maximumHp,
    courseSegments,
    targetSpeed,
    baseAcceleration,
    segmentConsumption,
    simulateRace,
    simulateScenarios
  };
});
