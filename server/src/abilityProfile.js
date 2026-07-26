const DAY_MS = 24 * 60 * 60 * 1000;

export const ABILITY_STAGE_GAP_DAYS = 30;
export const ABILITY_STAGE_GAP_MS = ABILITY_STAGE_GAP_DAYS * DAY_MS;
export const ABILITY_PACKAGE_DECAY_RATE = 0.15;
export const ABILITY_MODEL_NAME = 'Fengbian Ability Estimate v2';
export const ABILITY_ALGORITHM_NAME = '断点分包 + 包内指数加权 + 包间动态融合';

export const abilityDimensions = [
  { key: 'logic', label: '逻辑推进', weight: 0.18 },
  { key: 'evidence', label: '例证支撑', weight: 0.16 },
  { key: 'defenseStability', label: '防守稳定', weight: 0.16 },
  { key: 'counterPressure', label: '反压能力', weight: 0.16 },
  { key: 'battlefieldControl', label: '战场控制', weight: 0.18 },
  { key: 'expression', label: '表达效率', weight: 0.16 }
];

const abilityAssessmentRecommendations = {
  logic: '完成一次立论、攻辩或防守训练',
  evidence: '完成一次立论或结辩训练',
  defenseStability: '完成一次防守或自由辩训练',
  counterPressure: '完成一次攻辩、防守或自由辩训练',
  battlefieldControl: '完成一次自由辩、攻辩小结或结辩训练',
  expression: '完成一次立论、自由辩或结辩训练'
};

// This preserves the existing business definition of which unified ability
// dimensions a training mode updates. The values are coverage only; the new
// package formula does not multiply by a mode weight.
const abilityModeCoverage = {
  constructive: ['logic', 'evidence', 'expression'],
  summary: ['battlefieldControl', 'logic', 'evidence', 'expression'],
  free_debate: ['battlefieldControl', 'counterPressure', 'defenseStability', 'expression'],
  attack: ['counterPressure', 'battlefieldControl', 'logic'],
  defense: ['defenseStability', 'counterPressure', 'logic'],
  closing: ['battlefieldControl', 'logic', 'evidence', 'expression']
};

const abilityDifficultyBonus = {
  novice: -4,
  campus: 2,
  city: 7
};

export function calculatePackageAlpha(recordCount) {
  const count = Number(recordCount);
  if (!Number.isFinite(count) || count < 1) return 0;
  return 0.4 + (0.4 * count) / (count + 2);
}

export function calculatePackageWeightedAverage(values = []) {
  const scores = values.map(extractPackageScore);
  if (!scores.length || scores.some((score) => score === null)) return null;

  const count = scores.length;
  let weightedTotal = 0;
  let weightTotal = 0;

  scores.forEach((score, index) => {
    const updatesAfter = count - index - 1;
    const weight = Math.exp(-ABILITY_PACKAGE_DECAY_RATE * updatesAfter);
    weightedTotal += score * weight;
    weightTotal += weight;
  });

  return weightTotal ? weightedTotal / weightTotal : null;
}

export function buildPackageWeightDebug(values = []) {
  const count = values.length;
  return values.map((value, index) => {
    const updatesAfter = count - index - 1;
    return {
      recordId: value?.recordId || '',
      timestamp: value?.timestamp || '',
      score: extractPackageScore(value),
      x: updatesAfter,
      weight: Math.exp(-ABILITY_PACKAGE_DECAY_RATE * updatesAfter)
    };
  });
}

export function splitTrainingStages(values = []) {
  const sorted = [...values].sort(compareDimensionUpdates);
  const stages = [];

  sorted.forEach((value) => {
    const currentStage = stages.at(-1);
    const previous = currentStage?.at(-1);
    if (
      !currentStage
      || (value.timestampMs - previous.timestampMs) >= ABILITY_STAGE_GAP_MS
    ) {
      stages.push([value]);
      return;
    }
    currentStage.push(value);
  });

  return stages;
}

export function calculateDimensionProfile(records = [], dimensionKey) {
  const normalizedRecords = normalizeAbilityRecords(records);
  const updates = normalizedRecords
    .filter((record) => record.coveredDimensions.includes(dimensionKey))
    .map((record) => ({
      recordId: record.id,
      timestamp: record.createdAt,
      timestampMs: record.timestampMs,
      score: record.adjustedScore
    }));
  const stages = splitTrainingStages(updates);
  let finalScore = null;

  const packages = stages.map((stage, index) => {
    const historyBefore = finalScore;
    const packageScore = calculatePackageWeightedAverage(stage);
    const alpha = index === 0 ? null : calculatePackageAlpha(stage.length);
    finalScore = index === 0
      ? packageScore
      : alpha * packageScore + (1 - alpha) * historyBefore;

    return {
      index: index + 1,
      recordCount: stage.length,
      startedAt: stage[0]?.timestamp || '',
      endedAt: stage.at(-1)?.timestamp || '',
      packageScore,
      alpha,
      historyBefore,
      finalScore,
      records: buildPackageWeightDebug(stage)
    };
  });

  return {
    key: dimensionKey,
    score: finalScore,
    recordCount: updates.length,
    packageCount: packages.length,
    packages
  };
}

export function calculateAbilityProfile(records = []) {
  const normalizedRecords = normalizeAbilityRecords(records);
  const dimensions = Object.fromEntries(
    abilityDimensions.map((dimension) => [
      dimension.key,
      calculateDimensionProfile(normalizedRecords, dimension.key)
    ])
  );
  const observedDimensions = abilityDimensions.filter(
    (dimension) => dimensions[dimension.key].score !== null
  );
  const observedWeight = observedDimensions.reduce(
    (sum, dimension) => sum + dimension.weight,
    0
  );
  const overall = observedWeight
    ? observedDimensions.reduce(
        (sum, dimension) => sum + dimensions[dimension.key].score * dimension.weight,
        0
      ) / observedWeight
    : null;
  const coverage = Math.round(observedWeight * 100);
  const recordConfidence = Math.min(100, Math.round((normalizedRecords.length / 10) * 100));

  return {
    validRecords: normalizedRecords,
    overall,
    overallEstimate: toAbilityEstimate(overall),
    confidence: Math.min(recordConfidence, coverage),
    coverage,
    observedDimensionCount: observedDimensions.length,
    dimensions
  };
}

export function buildAbilityEstimate(records = [], { historyLimit = 120 } = {}) {
  const current = calculateAbilityProfile(records);
  const validRecords = current.validRecords;
  const historyStart = Math.max(0, validRecords.length - historyLimit);
  const history = [];

  for (let index = historyStart; index < validRecords.length; index += 1) {
    const snapshot = calculateAbilityProfile(validRecords.slice(0, index + 1));
    history.push({
      index: index + 1,
      date: validRecords[index].createdAt,
      overall: roundNullable(snapshot.overall),
      overallEstimate: snapshot.overallEstimate,
      dimensions: Object.fromEntries(
        abilityDimensions.map((dimension) => [
          dimension.key,
          validRecords[index].coveredDimensions.includes(dimension.key)
            ? roundNullable(snapshot.dimensions[dimension.key].score)
            : null
        ])
      ),
      source: buildAbilityHistorySource(validRecords[index])
    });
  }

  const previousProfile = validRecords.length > 1
    ? calculateAbilityProfile(validRecords.slice(0, Math.max(1, validRecords.length - 5)))
    : null;
  const dimensions = abilityDimensions.map((dimension) => {
    const currentDimension = current.dimensions[dimension.key];
    const previousScore = previousProfile?.dimensions?.[dimension.key]?.score ?? null;
    const score = currentDimension.score;

    return {
      key: dimension.key,
      label: dimension.label,
      score: roundNullable(score),
      estimate: toAbilityEstimate(score),
      confidence: Math.min(100, Math.round((currentDimension.recordCount / 5) * 100)),
      trend: score === null || previousScore === null ? 0 : roundToOne(score - previousScore),
      records: currentDimension.recordCount,
      packages: currentDimension.packageCount,
      assessment: abilityAssessmentRecommendations[dimension.key] || '完成对应训练'
    };
  });
  const roundedOverall = roundNullable(current.overall);

  return {
    model: ABILITY_MODEL_NAME,
    algorithm: ABILITY_ALGORITHM_NAME,
    recordCount: records.length,
    scoredRecordCount: validRecords.length,
    confidence: current.confidence,
    coverage: current.coverage,
    observedDimensionCount: current.observedDimensionCount,
    totalDimensionCount: abilityDimensions.length,
    overall: roundedOverall,
    overallEstimate: current.overallEstimate,
    level: getAbilityLevel(current.overallEstimate),
    trend: previousProfile
      ? current.overallEstimate - previousProfile.overallEstimate
      : 0,
    dimensions,
    history,
    roleRecommendation: buildRoleRecommendation(
      Object.fromEntries(
        abilityDimensions.map((dimension) => [
          dimension.key,
          current.dimensions[dimension.key].score
        ])
      )
    ),
    aggregation: {
      stageGapDays: ABILITY_STAGE_GAP_DAYS,
      packageDecayRate: ABILITY_PACKAGE_DECAY_RATE,
      dimensions: Object.fromEntries(
        abilityDimensions.map((dimension) => {
          const result = current.dimensions[dimension.key];
          return [
            dimension.key,
            {
              recordCount: result.recordCount,
              packageCount: result.packageCount,
              packages: result.packages.map((item) => ({
                index: item.index,
                recordCount: item.recordCount,
                startedAt: item.startedAt,
                endedAt: item.endedAt,
                packageScore: roundNullable(item.packageScore),
                alpha: item.alpha,
                historyBefore: roundNullable(item.historyBefore),
                finalScore: roundNullable(item.finalScore)
              }))
            }
          ];
        })
      )
    },
    note: '能力画像按维度独立计算：相邻有效更新间隔达到30天时开启新阶段，阶段内按后续有效更新次数指数加权，阶段之间按当前阶段样本数动态融合。'
  };
}

function normalizeAbilityRecords(records = []) {
  return records
    .map((record) => normalizeAbilityRecord(record))
    .filter(Boolean)
    .sort(compareAbilityRecords);
}

function normalizeAbilityRecord(record = {}) {
  const score = parseFiniteScore(record.score);
  const createdAt = String(record.created_at || record.createdAt || '').trim();
  const timestampMs = Date.parse(createdAt);
  if (score === null || !Number.isFinite(timestampMs)) return null;

  const trainingMode = abilityModeCoverage[record.training_mode || record.trainingMode]
    ? (record.training_mode || record.trainingMode)
    : 'free_debate';
  const difficulty = record.difficulty || '';
  const difficultyBonus = abilityDifficultyBonus[difficulty] || 0;
  const id = String(record.id || '').trim();
  const stableKey = [
    id,
    trainingMode,
    difficulty,
    score,
    record.topic || '',
    record.user_side || record.userSide || '',
    record.ai_side || record.aiSide || ''
  ].join('|');

  return {
    ...record,
    id,
    createdAt: new Date(timestampMs).toISOString(),
    timestampMs,
    stableKey,
    rawScore: score,
    adjustedScore: clamp(score + difficultyBonus, 0, 100),
    trainingMode,
    coveredDimensions: abilityModeCoverage[trainingMode]
  };
}

function compareAbilityRecords(left, right) {
  return left.timestampMs - right.timestampMs
    || left.stableKey.localeCompare(right.stableKey);
}

function compareDimensionUpdates(left, right) {
  return left.timestampMs - right.timestampMs
    || String(left.recordId || '').localeCompare(String(right.recordId || ''))
    || Number(left.score) - Number(right.score);
}

function extractPackageScore(value) {
  const candidate = typeof value === 'number' ? value : value?.score;
  return parseFiniteScore(candidate);
}

function parseFiniteScore(value) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') {
    return null;
  }
  const score = Number(value);
  return Number.isFinite(score) ? score : null;
}

function buildAbilityHistorySource(record = {}) {
  return {
    recordId: record.id || '',
    topic: record.topic || '',
    createdAt: record.createdAt || '',
    mode: record.training_mode || record.trainingMode || '',
    modeDisplayName: record.mode_display_name || record.modeDisplayName || '',
    difficulty: record.difficulty || '',
    userSide: record.user_side || record.userSide || '',
    aiSide: record.ai_side || record.aiSide || '',
    score: roundNullable(record.rawScore),
    teamCode: record.team_code || record.teamCode || '',
    spaceType: record.space_type || record.spaceType || '',
    taskId: record.task_id || record.taskId || '',
    nickname: record.nickname || ''
  };
}

function buildRoleRecommendation(scores = {}) {
  const hasScore = (key) => (
    scores[key] !== null
    && scores[key] !== undefined
    && Number.isFinite(Number(scores[key]))
  );
  const roleScores = [
    {
      role: '一辩',
      dimensions: { logic: 0.38, evidence: 0.32, expression: 0.3 },
      reason: '你的逻辑推进、例证支撑和表达清晰度更适合承担开局建构任务。'
    },
    {
      role: '二辩',
      dimensions: { counterPressure: 0.45, logic: 0.25, battlefieldControl: 0.3 },
      reason: '你的反压能力和战场判断更适合承担质询与拆解任务。'
    },
    {
      role: '三辩',
      dimensions: { battlefieldControl: 0.4, counterPressure: 0.3, defenseStability: 0.3 },
      reason: '你的战场控制、攻守转换和防守稳定更适合自由辩中的临场交锋。'
    },
    {
      role: '四辩 / 结辩',
      dimensions: { battlefieldControl: 0.35, logic: 0.3, expression: 0.35 },
      reason: '你的战场整合、逻辑收束和表达效率更适合完成终局总结。'
    },
    {
      role: '自由人 / 攻防核心',
      dimensions: {
        logic: 1 / 6,
        evidence: 1 / 6,
        defenseStability: 1 / 6,
        counterPressure: 1 / 6,
        battlefieldControl: 1 / 6,
        expression: 1 / 6
      },
      reason: '你的多维能力较均衡，适合在比赛中快速切换攻防任务。'
    }
  ]
    .filter((candidate) => Object.keys(candidate.dimensions).every(hasScore))
    .map((candidate) => ({
      ...candidate,
      score: Object.entries(candidate.dimensions)
        .reduce((sum, [key, weight]) => sum + Number(scores[key]) * weight, 0)
    }))
    .sort((left, right) => right.score - left.score);

  if (!roleScores.length) return null;

  const best = roleScores[0];
  const secondary = roleScores[1];
  return {
    bestRole: best.role,
    reason: best.reason,
    secondaryRole: secondary?.role || '',
    advice: secondary
      ? `如果继续加强${secondary.role}所需的关键能力，可以进一步拓展你的比赛定位。`
      : '继续完成不同模式训练后，系统会给出更稳定的辩位建议。'
  };
}

function toAbilityEstimate(score) {
  if (score === null || score === undefined) return null;
  return Math.round(300 + clamp(Number(score), 0, 100) * 6);
}

function getAbilityLevel(estimate) {
  if (!estimate) return '暂无估测';
  if (estimate >= 820) return '强校队核心';
  if (estimate >= 760) return '市赛强手';
  if (estimate >= 700) return '校赛上游';
  if (estimate >= 640) return '稳定参赛';
  if (estimate >= 580) return '基础成型';
  return '起步积累';
}

function roundNullable(value) {
  return value === null || value === undefined ? null : roundToOne(value);
}

function roundToOne(value) {
  return Math.round((Number(value) + Number.EPSILON) * 10) / 10;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
