(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DECK_COMFORT_CORE = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const EPSILON = 1e-9;
  const MODE_ORDER = ['balanced', 'panel', 'skill', 'recovery'];

  function finite(value) {
    if (value === null || value === undefined || value === '') return null;
    const result = Number(value);
    return Number.isFinite(result) ? result : null;
  }

  function integerId(value) {
    const candidate = typeof value === 'object' && value !== null ? value.id : value;
    const result = finite(candidate);
    return result !== null && result > 0 ? Math.trunc(result) : null;
  }

  function rounded(value, digits = 4) {
    const result = finite(value);
    if (result === null) return null;
    const factor = 10 ** digits;
    return Math.round(result * factor) / factor;
  }

  function clampProbability(value) {
    const result = finite(value);
    if (result === null) return null;
    return Math.max(0, Math.min(1, result));
  }

  function cloneValue(value, seen = new Map()) {
    if (value === null || typeof value !== 'object') return value;
    if (seen.has(value)) return seen.get(value);
    if (value instanceof Date) return new Date(value.getTime());
    if (Array.isArray(value)) {
      const output = [];
      seen.set(value, output);
      value.forEach(item => output.push(cloneValue(item, seen)));
      return output;
    }
    const output = {};
    seen.set(value, output);
    Object.keys(value).forEach(key => {
      output[key] = cloneValue(value[key], seen);
    });
    return output;
  }

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function firstFinite(...values) {
    for (const value of values) {
      const result = finite(value);
      if (result !== null) return result;
    }
    return null;
  }

  function modeOf(packageValue) {
    return String(packageValue?.mode || packageValue?.modeId || 'unknown');
  }

  function parseCanonicalSignature(value) {
    const text = String(value || '');
    const match = text.match(/owned:([^|]*)\|borrow(?:ed)?:([^|@]+)(?:@([^|]+))?/i);
    if (!match) return null;
    const ownedIds = match[1]
      .split(/[,-]/)
      .map(integerId)
      .filter(Number.isFinite);
    const borrowedId = integerId(match[2]);
    const borrowedSlot = firstFinite(match[3], 5);
    if (!ownedIds.length || borrowedId === null) return null;
    return {
      ownedIds: ownedIds.slice().sort((left, right) => left - right),
      borrowedId,
      borrowedSlot: Math.trunc(borrowedSlot === null ? 5 : borrowedSlot)
    };
  }

  function ownedIdsFor(packageValue) {
    const explicit = packageValue?.ownedIds;
    if (Array.isArray(explicit)) {
      return explicit.map(integerId).filter(Number.isFinite);
    }
    if (Array.isArray(packageValue?.ownedCards)) {
      return packageValue.ownedCards.map(integerId).filter(Number.isFinite);
    }
    if (Array.isArray(packageValue?.deckCards)) {
      return packageValue.deckCards
        .filter(card => card?.borrowed !== true)
        .slice(0, 5)
        .map(integerId)
        .filter(Number.isFinite);
    }
    return [];
  }

  function borrowedCardFor(packageValue) {
    if (packageValue?.borrowedCard) return packageValue.borrowedCard;
    if (Array.isArray(packageValue?.deckCards)) {
      const marked = packageValue.deckCards.find(card => card?.borrowed === true);
      if (marked) return marked;
      if (packageValue.deckCards.length >= 6) return packageValue.deckCards[5];
    }
    return null;
  }

  function identityFor(packageValue, index = 0) {
    let ownedIds = ownedIdsFor(packageValue);
    let borrowed = borrowedCardFor(packageValue);
    let borrowedId = integerId(
      packageValue?.borrowedId
        ?? packageValue?.borrowedCardId
        ?? borrowed
    );
    let borrowedSlot = firstFinite(
      packageValue?.borrowedSlot,
      packageValue?.borrowedIndex,
      borrowed?.slot
    );
    const parsed = parseCanonicalSignature(
      packageValue?.canonicalSignature || packageValue?.signature
    );
    if (!ownedIds.length && parsed) ownedIds = parsed.ownedIds;
    if (borrowedId === null && parsed) borrowedId = parsed.borrowedId;
    if (borrowedSlot === null && parsed) borrowedSlot = parsed.borrowedSlot;
    const complete = ownedIds.length === 5
      && ownedIds.every(Number.isFinite)
      && borrowedId !== null;
    const canonical = complete
      ? `owned:${ownedIds.slice().sort((left, right) => left - right).join(',')}|borrow:${borrowedId}@${Math.trunc(borrowedSlot === null ? 5 : borrowedSlot)}`
      : `unknown:${String(packageValue?.canonicalSignature || packageValue?.signature || packageValue?.id || index)}`;
    return {
      canonical,
      complete,
      ownedIds: ownedIds.slice().sort((left, right) => left - right),
      borrowedId,
      borrowedSlot: Math.trunc(borrowedSlot === null ? 5 : borrowedSlot)
    };
  }

  function packageCollection(packages) {
    if (Array.isArray(packages)) return packages.slice();
    if (Array.isArray(packages?.packages)) return packages.packages.slice();
    if (packages && typeof packages === 'object') return Object.values(packages);
    return [];
  }

  function hasCoverageShape(value) {
    if (!value || typeof value !== 'object') return false;
    return Array.isArray(value.targets)
      || Array.isArray(value.coverageByFamily)
      || Boolean(value.factorCoverage || value.allCoverage || value.coverage);
  }

  function unwrapCoverage(value) {
    if (!value || typeof value !== 'object') return null;
    if (hasCoverageShape(value)) return value;
    for (const key of ['coverageSummary', 'planningCoverage', 'summary', 'coverage']) {
      if (hasCoverageShape(value[key])) return value[key];
    }
    return null;
  }

  function lookupCoverageBySignature(source, keys) {
    if (!source) return null;
    for (const key of keys.filter(Boolean)) {
      let value;
      if (source instanceof Map) {
        if (!source.has(key)) continue;
        value = source.get(key);
      } else if (typeof source === 'object'
        && Object.prototype.hasOwnProperty.call(source, key)) {
        value = source[key];
      }
      const coverage = unwrapCoverage(value);
      if (coverage) return coverage;
    }
    return null;
  }

  function coverageForPackage(packageValue, identity, options, index, groupPackages) {
    const packageCoverage = unwrapCoverage(packageValue?.coverageSummary)
      || unwrapCoverage(packageValue?.planningCoverage)
      || unwrapCoverage(packageValue?.coverage)
      || unwrapCoverage(packageValue?.coverageByFamily);
    if (packageCoverage) return packageCoverage;
    if (typeof options.coverageForPackage === 'function') {
      try {
        const value = options.coverageForPackage(packageValue, identity.canonical, {
          index,
          packages: groupPackages.slice()
        });
        const coverage = unwrapCoverage(value);
        if (coverage) return coverage;
      } catch (error) {
        // A failed optional adapter is equivalent to unavailable evidence.
      }
    }
    const signatureKeys = [
      identity.canonical,
      packageValue?.canonicalSignature,
      packageValue?.signature,
      packageValue?.id
    ].filter(Boolean);
    const modeSignature = packageValue?.signature
      ? String(packageValue.signature).replace(/\|mode:[^|]+$/i, '')
      : null;
    if (modeSignature) signatureKeys.push(modeSignature);
    return lookupCoverageBySignature(options.coverageBySignature, signatureKeys);
  }

  function coverageParts(packageValue, coverage) {
    const directRows = Array.isArray(coverage?.targets)
      ? coverage.targets
      : Array.isArray(coverage?.coverageByFamily)
        ? coverage.coverageByFamily
        : Array.isArray(packageValue?.coverageByFamily)
          ? packageValue.coverageByFamily
          : [];
    const factorRows = directRows.filter(target => target?.kind !== 'direct-parent-unique');
    const factor = coverage?.factorCoverage || coverage?.coverage || {};
    const all = coverage?.allCoverage || {};
    // factorCoverage.percentage is explicitly a 0-100 field. Only legacy
    // package-level coverage ratios are eligible for 0-1 normalization; a
    // real 1% factor result must stay 1%, not be promoted to 100%.
    let targetCoverage = firstFinite(
      factor.percentage,
      factor.coveragePercentage
    );
    const factorPercentageKnown = targetCoverage !== null;
    if (targetCoverage === null) targetCoverage = firstFinite(
      coverage?.targetCoverage,
      coverage?.targetCoveragePercentage,
      packageValue?.targetCoverage,
      packageValue?.targetCoveragePercentage,
      packageValue?.metrics?.targetCoverage,
      packageValue?.metrics?.targetCoveragePercentage,
      packageValue?.breakdown?.skillGoldRecovery
    );
    if (!factorPercentageKnown
      && targetCoverage !== null
      && targetCoverage >= 0
      && targetCoverage <= 1) {
      targetCoverage *= 100;
    }
    let residualWeight = firstFinite(
      factor.residualWeight,
      all.residualWeight,
      coverage?.residualWeight,
      packageValue?.residualWeight,
      packageValue?.metrics?.residualWeight
    );
    if (residualWeight === null && factorRows.length) {
      residualWeight = factorRows.reduce((sum, target) => {
        const explicit = firstFinite(target?.residualWeight, target?.residualNeed);
        if (explicit !== null) return sum + Math.max(0, explicit);
        const weight = firstFinite(
          target?.weight,
          target?.reliableBashin,
          target?.routeBashin,
          target?.expectedBashin
        );
        const probability = clampProbability(target?.coverageProbability);
        if (weight === null || probability === null) return sum;
        return sum + Math.max(0, weight * (1 - probability));
      }, 0);
    }
    let gapCount = firstFinite(
      factor.gapCount,
      all.gapCount,
      coverage?.gapCount,
      packageValue?.gapCount,
      packageValue?.metrics?.gapCount
    );
    if (gapCount === null && factorRows.length) {
      gapCount = factorRows.filter(target => {
        const probability = clampProbability(target?.coverageProbability);
        if (probability !== null) return probability < 1 - EPSILON;
        return target?.coverageState === 'gap' || target?.coverageState === 'partial';
      }).length;
    }
    if (targetCoverage === null && factorRows.length) {
      let totalWeight = 0;
      let coveredWeight = 0;
      factorRows.forEach(target => {
        const weight = firstFinite(
          target?.weight,
          target?.reliableBashin,
          target?.routeBashin,
          target?.expectedBashin
        );
        const probability = clampProbability(target?.coverageProbability);
        if (weight === null || probability === null) return;
        totalWeight += Math.max(0, weight);
        coveredWeight += Math.max(0, weight) * probability;
      });
      targetCoverage = totalWeight > 0 ? coveredWeight / totalWeight * 100 : null;
    }
    return {
      coverage: coverage || null,
      targets: factorRows,
      allTargets: directRows,
      known: Boolean(coverage),
      targetCoverage: rounded(targetCoverage, 4),
      residualWeight: rounded(residualWeight, 4),
      gapCount: gapCount === null ? null : Math.max(0, Math.trunc(gapCount))
    };
  }

  function borrowedDependency(packageValue, identity, parts) {
    const targets = parts.targets;
    if (!identity.borrowedId || !targets.length) {
      return {
        weight: 0,
        count: 0,
        routeCount: 0,
        known: false,
        status: 'unknown'
      };
    }
    let routeEvidence = 0;
    let partialEvidence = false;
    let dependencyWeight = 0;
    let dependencyCount = 0;
    let dependencyRouteCount = 0;
    targets.forEach((target, targetIndex) => {
      if (!Array.isArray(target?.coverageRoutes)) return;
      routeEvidence += 1;
      let targetContribution = null;
      let targetHit = false;
      target.coverageRoutes.forEach(route => {
        const routeCardId = integerId(
          route?.cardId ?? route?.supportCardId ?? route?.sourceCardId
        );
        if (routeCardId !== identity.borrowedId) return;
        targetHit = true;
        dependencyRouteCount += 1;
        const probability = clampProbability(
          route?.coverageProbability
            ?? route?.probability
            ?? route?.expectedCoverage
            ?? route?.reliability
        );
        const explicitWeight = finite(route?.weight ?? route?.dependencyWeight);
        const targetWeight = firstFinite(
          target?.weight,
          target?.reliableBashin,
          target?.routeBashin,
          target?.expectedBashin
        );
        let contribution = null;
        if (explicitWeight !== null) contribution = Math.max(0, explicitWeight);
        else if (probability !== null && targetWeight !== null) {
          contribution = Math.max(0, targetWeight * probability);
        }
        if (contribution !== null) {
          targetContribution = targetContribution === null
            ? contribution
            : Math.max(targetContribution, contribution);
        } else {
          partialEvidence = true;
        }
      });
      if (targetHit) {
        dependencyCount += 1;
        if (targetContribution !== null) dependencyWeight += targetContribution;
      }
      // Keep the loop variable visibly consumed in a deterministic way for
      // callers that inspect route rows with duplicate target IDs.
      void targetIndex;
    });
    const known = routeEvidence === targets.length && !partialEvidence;
    return {
      weight: rounded(dependencyWeight, 4) || 0,
      count: dependencyCount,
      routeCount: dependencyRouteCount,
      known,
      status: !routeEvidence ? 'unknown' : known ? 'known' : 'partial'
    };
  }

  function recoveryInfo(packageValue, coverage) {
    const source = packageValue?.recoveryGate
      || packageValue?.metrics?.recoveryGate
      || packageValue?.metrics?.recovery
      || coverage?.recoveryGate
      || packageValue?.recovery
      || null;
    const sourceObject = source && typeof source === 'object' ? source : {};
    const rawStatus = typeof source === 'string' ? source : sourceObject.status;
    let ratio = firstFinite(
      sourceObject.ratio,
      sourceObject.coverageRatio,
      sourceObject.recoveryRatio,
      sourceObject.qualifiedRatio,
      packageValue?.recoveryRatio,
      packageValue?.metrics?.recoveryRatio,
      packageValue?.breakdown?.recoveryGate,
      packageValue?.scoreInputs?.recoveryNormalized
    );
    const qualified = firstFinite(
      sourceObject.qualifiedDistinctFamilies,
      sourceObject.qualifiedFamilies,
      sourceObject.coveredFamilies
    );
    const required = firstFinite(
      sourceObject.requiredGold,
      sourceObject.requiredFamilies,
      sourceObject.required
    );
    if (ratio === null && qualified !== null && required !== null && required > 0) {
      ratio = qualified / required;
    }
    if (ratio !== null && ratio > 1 && ratio <= 100) ratio /= 100;
    ratio = ratio === null ? null : Math.max(0, Math.min(1, ratio));
    const statusText = String(rawStatus || '').toLowerCase();
    let status = 'unknown';
    if (statusText === 'met' || statusText === 'ready' || statusText === 'qualified'
      || rawStatus === true || ratio >= 1 - EPSILON) {
      status = 'met';
    } else if (statusText.includes('warn') || statusText.includes('partial')
      || statusText.includes('deficit') || (ratio !== null && ratio > 0)) {
      status = 'warning';
    } else if (statusText.includes('missing') || statusText.includes('fail')
      || statusText.includes('unmet') || ratio === 0) {
      status = 'missing';
    }
    return { status, ratio: rounded(ratio, 4) };
  }

  function uncertaintyCount(packageValue, coverage) {
    const explicit = firstFinite(
      packageValue?.uncertaintyCount,
      packageValue?.metrics?.uncertaintyCount,
      coverage?.uncertaintyCount
    );
    if (explicit !== null) return Math.max(0, Math.trunc(explicit));
    const arrays = [
      packageValue?.unresolvedUniqueCards,
      packageValue?.uncertainties,
      packageValue?.uncertainty,
      coverage?.uncertainties
    ];
    return arrays.reduce((sum, value) => sum + (Array.isArray(value) ? value.length : 0), 0);
  }

  function metricsFor(packageValue, parts, borrow, recovery, coverage) {
    const totalScore = firstFinite(
      packageValue?.totalScore,
      packageValue?.metrics?.totalScore,
      packageValue?.score
    );
    const trainingOutput = firstFinite(
      packageValue?.trainingOutput,
      packageValue?.metrics?.trainingOutput,
      packageValue?.breakdown?.trainingOutput,
      packageValue?.breakdown?.panel,
      packageValue?.scoreInputs?.fiveAxisNormalized?.trainingOutput,
      packageValue?.scoreInputs?.panelNormalized,
      packageValue?.panelSummary?.expected
    );
    const skillPtEconomy = firstFinite(
      packageValue?.skillPtEconomy,
      packageValue?.metrics?.skillPtEconomy,
      packageValue?.breakdown?.skillPtEconomy,
      packageValue?.scoreInputs?.fiveAxisNormalized?.skillPtEconomy,
      packageValue?.scoreInputs?.ptNormalized
    );
    return {
      totalScore: rounded(totalScore, 4),
      trainingOutput: rounded(trainingOutput, 4),
      skillPtEconomy: rounded(skillPtEconomy, 4),
      targetCoverage: parts.targetCoverage,
      targetCoveragePercentage: parts.targetCoverage,
      residualWeight: parts.residualWeight,
      gapCount: parts.gapCount,
      borrowDependencyWeight: borrow.weight,
      borrowDependencyCount: borrow.count,
      borrowDependencyRouteCount: borrow.routeCount,
      borrowDependencyKnown: borrow.known,
      borrowDependencyStatus: borrow.status,
      recovery: recovery,
      recoveryStatus: recovery.status,
      recoveryRatio: recovery.ratio,
      uncertaintyCount: uncertaintyCount(packageValue, coverage),
      coverageKnown: parts.known
    };
  }

  function modeRank(mode) {
    const index = MODE_ORDER.indexOf(mode);
    return index < 0 ? MODE_ORDER.length : index;
  }

  function packageEntry(packageValue, identity, coverage, index, groupPackages, options) {
    const parts = coverageParts(packageValue, coverage);
    const borrow = borrowedDependency(packageValue, identity, parts);
    const recovery = recoveryInfo(packageValue, coverage);
    const metrics = metricsFor(packageValue, parts, borrow, recovery, coverage);
    const rawValid = packageValue?.valid !== false;
    const recoveryBlocked = options.hardRecovery === true && recovery.status !== 'met';
    const eligible = rawValid && !recoveryBlocked;
    return {
      packageValue,
      identity,
      coverage,
      parts,
      metrics,
      mode: modeOf(packageValue),
      index,
      rawValid,
      recoveryBlocked,
      eligible,
      modeRank: modeRank(modeOf(packageValue)),
      groupSize: groupPackages.length
    };
  }

  function compareRepresentative(left, right) {
    const leftScore = left.metrics.totalScore;
    const rightScore = right.metrics.totalScore;
    if (leftScore !== null || rightScore !== null) {
      if (leftScore === null) return 1;
      if (rightScore === null) return -1;
      if (Math.abs(leftScore - rightScore) > EPSILON) return rightScore - leftScore;
    }
    return left.modeRank - right.modeRank || left.index - right.index;
  }

  function numericMetric(group, key) {
    return finite(group?.metrics?.[key]);
  }

  function eligibleGroups(groups, options = {}) {
    return groups.filter(group => group.eligible && group.representativeEntry
      && (options.includeUnknownIdentity === true || group.identityComplete || group.signature));
  }

  function compareScore(left, right) {
    const leftValue = numericMetric(left, 'totalScore');
    const rightValue = numericMetric(right, 'totalScore');
    if (leftValue === null && rightValue === null) return left.signature.localeCompare(right.signature);
    if (leftValue === null) return 1;
    if (rightValue === null) return -1;
    return rightValue - leftValue || left.signature.localeCompare(right.signature);
  }

  function compareLeastFactor(left, right) {
    const leftResidual = numericMetric(left, 'residualWeight');
    const rightResidual = numericMetric(right, 'residualWeight');
    if (leftResidual === null && rightResidual === null) return compareScore(left, right);
    if (leftResidual === null) return 1;
    if (rightResidual === null) return -1;
    return leftResidual - rightResidual
      || (numericMetric(right, 'targetCoverage') ?? -Infinity)
        - (numericMetric(left, 'targetCoverage') ?? -Infinity)
      || compareScore(left, right);
  }

  function compareTraining(left, right) {
    const leftValue = numericMetric(left, 'trainingOutput');
    const rightValue = numericMetric(right, 'trainingOutput');
    if (leftValue === null && rightValue === null) return compareScore(left, right);
    if (leftValue === null) return 1;
    if (rightValue === null) return -1;
    return rightValue - leftValue || compareScore(left, right);
  }

  function compareBorrow(left, right) {
    const leftWeight = numericMetric(left, 'borrowDependencyWeight');
    const rightWeight = numericMetric(right, 'borrowDependencyWeight');
    if (!left.metrics.borrowDependencyKnown && !right.metrics.borrowDependencyKnown) return compareScore(left, right);
    if (!left.metrics.borrowDependencyKnown) return 1;
    if (!right.metrics.borrowDependencyKnown) return -1;
    return (leftWeight ?? Infinity) - (rightWeight ?? Infinity)
      || (left.metrics.borrowDependencyCount ?? Infinity)
        - (right.metrics.borrowDependencyCount ?? Infinity)
      || compareScore(left, right);
  }

  function recoveryRank(status) {
    return ({ met: 3, warning: 2, missing: 1, unknown: 0 })[status] ?? 0;
  }

  function compareRecovery(left, right) {
    const leftRatio = numericMetric(left, 'recoveryRatio');
    const rightRatio = numericMetric(right, 'recoveryRatio');
    return recoveryRank(right.metrics.recoveryStatus) - recoveryRank(left.metrics.recoveryStatus)
      || (rightRatio ?? -Infinity) - (leftRatio ?? -Infinity)
      || compareScore(left, right);
  }

  function leaderSignature(groups, comparator) {
    if (!groups.length) return null;
    return groups.slice().sort(comparator)[0]?.signature || null;
  }

  function statusFor(group, options = {}) {
    if (!group.eligible) {
      return group.recoveryBlocked ? 'recovery-blocked' : 'invalid';
    }
    if (group.metrics.recoveryStatus !== 'met'
      || group.metrics.uncertaintyCount > 0
      || (group.metrics.gapCount !== null && group.metrics.gapCount > 0)
      || !group.metrics.coverageKnown) {
      return 'tradeoff';
    }
    return 'ready';
  }

  function badgeList(group, leaders) {
    const badges = [];
    if (leaders.overall === group.signature) badges.push('overall');
    if (leaders.leastFactor === group.signature) badges.push('least-factor');
    if (leaders.easiestTraining === group.signature) badges.push('easiest-training');
    if (leaders.leastBorrow === group.signature) badges.push('least-borrow');
    if (leaders.recovery === group.signature) badges.push('recovery-ready');
    if (group.status === 'invalid') badges.push('invalid');
    if (group.status === 'recovery-blocked') badges.push('hard-recovery-blocked');
    if (group.metrics.recoveryStatus === 'met') badges.push('recovery-met');
    else if (group.metrics.recoveryStatus !== 'unknown') badges.push('recovery-tradeoff');
    if (group.metrics.borrowDependencyStatus === 'unknown') badges.push('borrow-unknown');
    else if (group.metrics.borrowDependencyWeight > 0) badges.push('borrow-dependent');
    if (group.metrics.uncertaintyCount > 0) badges.push('uncertain');
    if ((group.metrics.gapCount || 0) > 0) badges.push('factor-gaps');
    return badges;
  }

  function deltaItem(key, label, value, reference, direction) {
    return {
      key,
      label,
      value: rounded(value, 4),
      reference: rounded(reference, 4),
      delta: rounded(value !== null && reference !== null ? value - reference : null, 4),
      direction
    };
  }

  function explanationFor(group, groups, leaders) {
    const gains = [];
    const sacrifices = [];
    const overall = groups.find(item => item.signature === leaders.overall) || null;
    const leastFactor = groups.find(item => item.signature === leaders.leastFactor) || null;
    const easiestTraining = groups.find(item => item.signature === leaders.easiestTraining) || null;
    const leastBorrow = groups.find(item => item.signature === leaders.leastBorrow) || null;
    const recovery = groups.find(item => item.signature === leaders.recovery) || null;
    if (leaders.overall === group.signature) {
      gains.push({ key: 'overall', label: '現有 totalScore 綜合最高', value: group.metrics.totalScore });
    }
    if (leaders.leastFactor === group.signature) {
      gains.push({ key: 'leastFactor', label: '殘餘因子權重最低', value: group.metrics.residualWeight });
    }
    if (leaders.easiestTraining === group.signature) {
      gains.push({ key: 'easiestTraining', label: '訓練輸出最高', value: group.metrics.trainingOutput });
    }
    if (leaders.leastBorrow === group.signature) {
      gains.push({ key: 'leastBorrow', label: '已知借卡路線依賴最低', value: group.metrics.borrowDependencyWeight });
    }
    if (leaders.recovery === group.signature) {
      gains.push({ key: 'recovery', label: '回復可靠度最高', value: group.metrics.recoveryRatio });
    }
    if (overall && overall.signature !== group.signature
      && group.metrics.totalScore !== null && overall.metrics.totalScore !== null
      && group.metrics.totalScore > overall.metrics.totalScore + EPSILON) {
      gains.push(deltaItem('totalScore', 'totalScore 高於目前綜合代表', group.metrics.totalScore, overall.metrics.totalScore, 'higher'));
    }
    if (leastFactor && group.metrics.residualWeight !== null
      && leastFactor.metrics.residualWeight !== null
      && group.metrics.residualWeight < leastFactor.metrics.residualWeight - EPSILON) {
      gains.push(deltaItem('residualWeight', '殘餘因子較低', group.metrics.residualWeight, leastFactor.metrics.residualWeight, 'lower'));
    }
    if (easiestTraining && group.metrics.trainingOutput !== null
      && easiestTraining.metrics.trainingOutput !== null
      && group.metrics.trainingOutput > easiestTraining.metrics.trainingOutput + EPSILON) {
      gains.push(deltaItem('trainingOutput', '訓練輸出較高', group.metrics.trainingOutput, easiestTraining.metrics.trainingOutput, 'higher'));
    }
    if (group.metrics.recoveryStatus === 'met') {
      gains.push({ key: 'recovery-met', label: '回復門檻已達標', value: group.metrics.recoveryRatio });
    }
    if (group.metrics.targetCoverage !== null && group.metrics.targetCoverage >= 100 - EPSILON) {
      gains.push({ key: 'targetCoverage-complete', label: '目標覆蓋達到 100%', value: group.metrics.targetCoverage });
    }
    if (group.metrics.recoveryStatus !== 'met') {
      sacrifices.push({ key: 'recovery', label: '回復未完全達標，需接受機率性妥協', value: group.metrics.recoveryRatio });
    }
    if (group.metrics.gapCount !== null && group.metrics.gapCount > 0) {
      sacrifices.push({ key: 'factorGaps', label: `仍有 ${group.metrics.gapCount} 個技能／因子缺口`, value: group.metrics.gapCount });
    }
    if (group.metrics.borrowDependencyStatus === 'unknown') {
      sacrifices.push({ key: 'borrowUnknown', label: '沒有足夠路線證據判斷借卡依賴', value: null });
    } else if (group.metrics.borrowDependencyWeight > 0) {
      sacrifices.push({ key: 'borrowDependency', label: '部分覆蓋依賴借卡路線', value: group.metrics.borrowDependencyWeight });
    }
    if (group.metrics.uncertaintyCount > 0) {
      sacrifices.push({ key: 'uncertainty', label: `有 ${group.metrics.uncertaintyCount} 項未解析不確定性`, value: group.metrics.uncertaintyCount });
    }
    if (leastFactor && group.metrics.residualWeight !== null
      && leastFactor.metrics.residualWeight !== null
      && group.metrics.residualWeight > leastFactor.metrics.residualWeight + EPSILON) {
      sacrifices.push(deltaItem('residualWeight', '因子殘餘高於最低缺口方案', group.metrics.residualWeight, leastFactor.metrics.residualWeight, 'higher'));
    }
    if (easiestTraining && group.metrics.trainingOutput !== null
      && easiestTraining.metrics.trainingOutput !== null
      && group.metrics.trainingOutput < easiestTraining.metrics.trainingOutput - EPSILON) {
      sacrifices.push(deltaItem('trainingOutput', '訓練輸出低於最好養方案', group.metrics.trainingOutput, easiestTraining.metrics.trainingOutput, 'lower'));
    }
    void recovery;
    return { gains, sacrifices };
  }

  function buildDeckComfortComparison(packages, options = {}) {
    const sourcePackages = packageCollection(packages);
    const grouped = new Map();
    sourcePackages.forEach((packageValue, index) => {
      const safePackage = packageValue && typeof packageValue === 'object' ? packageValue : {};
      const identity = identityFor(safePackage, index);
      if (!grouped.has(identity.canonical)) grouped.set(identity.canonical, []);
      grouped.get(identity.canonical).push({ packageValue: safePackage, identity, index });
    });
    const groups = [...grouped.entries()].map(([signature, rows]) => {
      const entries = rows.map(row => packageEntry(
        row.packageValue,
        row.identity,
        coverageForPackage(row.packageValue, row.identity, options, row.index, rows.map(item => item.packageValue)),
        row.index,
        rows.map(item => item.packageValue),
        options
      ));
      const eligibleEntries = entries.filter(entry => entry.eligible);
      const representatives = (eligibleEntries.length ? eligibleEntries : entries).slice()
        .sort(compareRepresentative);
      const representativeEntry = representatives[0] || null;
      const coverageEntry = representativeEntry?.parts.known
        ? representativeEntry
        : entries.slice().sort((left, right) => Number(right.parts.known) - Number(left.parts.known)
          || compareRepresentative(left, right))[0] || representativeEntry;
      const group = {
        signature,
        canonicalSignature: signature,
        identityComplete: rows.every(row => row.identity.complete),
        ownedIds: rows[0]?.identity.ownedIds || [],
        borrowedId: rows[0]?.identity.borrowedId || null,
        borrowedSlot: rows[0]?.identity.borrowedSlot ?? 5,
        modes: [...new Set(entries.map(entry => entry.mode))].sort((left, right) =>
          modeRank(left) - modeRank(right) || left.localeCompare(right)),
        modePackages: entries.map(entry => ({
          mode: entry.mode,
          id: entry.packageValue?.id || null,
          totalScore: entry.metrics.totalScore,
          valid: entry.rawValid,
          eligible: entry.eligible,
          recoveryStatus: entry.metrics.recoveryStatus,
          recoveryRatio: entry.metrics.recoveryRatio
        })),
        entries,
        representativeEntry,
        coverageEntry,
        eligible: Boolean(representativeEntry?.eligible),
        rawValid: entries.some(entry => entry.rawValid),
        recoveryBlocked: entries.some(entry => entry.recoveryBlocked && entry.rawValid),
        status: 'invalid'
      };
      group.metrics = representativeEntry
        ? { ...representativeEntry.metrics }
        : {
          totalScore: null,
          trainingOutput: null,
          skillPtEconomy: null,
          targetCoverage: null,
          targetCoveragePercentage: null,
          residualWeight: null,
          gapCount: null,
          borrowDependencyWeight: 0,
          borrowDependencyCount: 0,
          borrowDependencyRouteCount: 0,
          borrowDependencyKnown: false,
          borrowDependencyStatus: 'unknown',
          recovery: { status: 'unknown', ratio: null },
          recoveryStatus: 'unknown',
          recoveryRatio: null,
          uncertaintyCount: 0,
          coverageKnown: false
        };
      // Coverage belongs to the deck identity, while totalScore remains the
      // selected mode's existing score. Use the richest same-deck evidence if
      // the representative mode did not carry the summary itself.
      if (coverageEntry && coverageEntry !== representativeEntry) {
        const coverageMetrics = coverageEntry.metrics;
        group.metrics.targetCoverage = coverageMetrics.targetCoverage;
        group.metrics.targetCoveragePercentage = coverageMetrics.targetCoveragePercentage;
        group.metrics.residualWeight = coverageMetrics.residualWeight;
        group.metrics.gapCount = coverageMetrics.gapCount;
        group.metrics.borrowDependencyWeight = coverageMetrics.borrowDependencyWeight;
        group.metrics.borrowDependencyCount = coverageMetrics.borrowDependencyCount;
        group.metrics.borrowDependencyRouteCount = coverageMetrics.borrowDependencyRouteCount;
        group.metrics.borrowDependencyKnown = coverageMetrics.borrowDependencyKnown;
        group.metrics.borrowDependencyStatus = coverageMetrics.borrowDependencyStatus;
        group.metrics.coverageKnown = coverageMetrics.coverageKnown;
      }
      group.status = statusFor(group, options);
      group.valid = group.eligible;
      group.ids = {
        ownedIds: group.ownedIds.slice(),
        borrowedId: group.borrowedId,
        borrowedSlot: group.borrowedSlot
      };
      const topGaps = (coverageEntry?.parts?.targets || [])
        .map((target, index) => {
          const probability = clampProbability(target?.coverageProbability);
          const residual = firstFinite(
            target?.residualWeight,
            target?.residualNeed,
            (() => {
              const weight = firstFinite(target?.weight, target?.reliableBashin, target?.routeBashin, target?.expectedBashin);
              return weight !== null && probability !== null ? weight * (1 - probability) : null;
            })()
          );
          return {
            id: integerId(target?.id ?? target?.requiredSkillId ?? target?.factorId),
            label: String(target?.label || target?.name || target?.nameZhTw || target?.id || `target-${index}`),
            coverageProbability: rounded(probability, 4),
            residualWeight: rounded(residual, 4),
            weight: rounded(firstFinite(target?.weight, target?.reliableBashin, target?.routeBashin, target?.expectedBashin), 4),
            coverageRoutes: cloneValue(asArray(target?.coverageRoutes)),
            coverageState: target?.coverageState || (probability === null ? 'unknown' : probability >= 1 - EPSILON ? 'covered' : probability > 0 ? 'partial' : 'gap')
          };
        })
        .filter(gap => gap.coverageState !== 'covered' || (gap.residualWeight !== null && gap.residualWeight > EPSILON))
        .sort((left, right) => (right.residualWeight ?? -Infinity) - (left.residualWeight ?? -Infinity)
          || (left.id ?? Infinity) - (right.id ?? Infinity)
          || left.label.localeCompare(right.label))
        .slice(0, Math.max(1, Math.trunc(finite(options.topGapLimit) ?? 5)));
      group.topGaps = topGaps;
      return group;
    });
    const candidates = eligibleGroups(groups, options)
      .filter(group => group.metrics.totalScore !== null);
    const leaders = {
      overall: leaderSignature(candidates, compareScore),
      leastFactor: leaderSignature(candidates.filter(group => group.metrics.residualWeight !== null), compareLeastFactor),
      easiestTraining: leaderSignature(candidates.filter(group => group.metrics.trainingOutput !== null), compareTraining),
      leastBorrow: leaderSignature(candidates.filter(group => group.metrics.borrowDependencyKnown), compareBorrow),
      recovery: leaderSignature(candidates.filter(group => group.metrics.recoveryStatus !== 'unknown'), compareRecovery)
    };
    groups.forEach(group => {
      group.badges = badgeList(group, leaders);
      const explanations = explanationFor(group, groups, leaders);
      group.gains = explanations.gains;
      group.sacrifices = explanations.sacrifices;
      group.representativePackage = cloneValue(group.representativeEntry?.packageValue || null);
      group.package = group.representativePackage;
      group.hardBlockers = group.entries.flatMap(entry => {
        const blockers = [];
        if (entry.packageValue?.valid === false) blockers.push(...asArray(entry.packageValue?.errors));
        if (entry.recoveryBlocked) blockers.push('hardRecovery: recovery requirement not met');
        return blockers;
      }).filter((item, index, values) => values.indexOf(item) === index);
      delete group.entries;
      delete group.representativeEntry;
      delete group.coverageEntry;
    });
    const resultGroups = groups.sort((left, right) => left.signature.localeCompare(right.signature));
    return {
      schemaVersion: 1,
      modelVersion: 'deck-comfort-comparison-v1',
      recommendedSignature: leaders.overall,
      leaders,
      groups: resultGroups,
      comparisons: resultGroups,
      packageCount: sourcePackages.length,
      canonicalGroupCount: resultGroups.length,
      options: {
        hardRecovery: options.hardRecovery === true,
        topGapLimit: Math.max(1, Math.trunc(finite(options.topGapLimit) ?? 5))
      },
      note: '舒適度是既有 totalScore、覆蓋、養成、借卡與回復證據的並列比較；不宣稱勝率，也不重算最佳化。'
    };
  }

  return {
    MODEL_VERSION: 'deck-comfort-comparison-v1',
    buildDeckComfortComparison,
    canonicalDeckSignature: packageValue => identityFor(packageValue).canonical,
    canonicalDeckIdentity: identityFor
  };
});
