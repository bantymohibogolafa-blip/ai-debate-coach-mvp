import { getScoringRubric } from './scoringRubrics.js';
import { getTrainingRecordVersionMetadata } from './scoringVersions.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export const ABILITY_STAGE_GAP_DAYS = 30;
export const ABILITY_STAGE_GAP_MS = ABILITY_STAGE_GAP_DAYS * DAY_MS;
export const ABILITY_PACKAGE_DECAY_RATE = 0.15;
export const ABILITY_MODEL_NAME = 'Fengbian Ability Estimate v3';
export const ABILITY_ALGORITHM_NAME = '断点分包 + 包内指数加权 + 包间动态融合';
export const ABILITY_PROJECTION_NAME = '五维复盘子维度投射 + 五维能力画像';

export const abilityDimensions = [
  { key: 'logic', label: '逻辑推进', weight: 3 / 14 },
  { key: 'defenseStability', label: '防守稳定', weight: 4 / 21 },
  { key: 'counterPressure', label: '反压能力', weight: 4 / 21 },
  { key: 'battlefieldControl', label: '战场控制', weight: 3 / 14 },
  { key: 'expression', label: '表达效率', weight: 4 / 21 }
];

const abilityAssessmentRecommendations = {
  logic: '完成一次立论、攻辩或防守训练',
  defenseStability: '完成一次防守或自由辩训练',
  counterPressure: '完成一次攻辩、防守、自由辩或攻辩小结训练',
  battlefieldControl: '完成一次立论、自由辩、攻辩小结或结辩训练',
  expression: '完成任一正式训练并生成五维复盘'
};

// Each review subdimension can feed at most two unified abilities. Shares are
// multiplied by the rubric weight before the target dimension is normalized.
// “例证支撑” is no longer a standalone ability: the constructive evidence
// subdimension is treated as part of argument validity and feeds logic.
export const abilityModeProjection = {
  constructive: {
    '辩题理解、立场与举证责任': { logic: 0.7, battlefieldControl: 0.3 },
    '定义、判准与裁决框架': { logic: 0.7, battlefieldControl: 0.3 },
    '论证结构与逻辑链条': { logic: 1 },
    '论据支撑与现实适配': { logic: 1 },
    '战场设计与表达完成度': { battlefieldControl: 0.7, expression: 0.3 }
  },
  summary: {
    '交锋事实还原与关键材料提取': { battlefieldControl: 0.7, logic: 0.3 },
    '核心漏洞识别与责任判定': { counterPressure: 0.7, logic: 0.3 },
    '战场结算与胜负比较': { battlefieldControl: 1 },
    '攻防成果向本方主线转化': { logic: 0.6, battlefieldControl: 0.4 },
    '表达凝练与节奏控制': { expression: 1 }
  },
  free_debate: {
    '战场识别与控制': { battlefieldControl: 1 },
    '临场回应与反击': { defenseStability: 0.5, counterPressure: 0.5 },
    '逻辑推进与攻守转换': { logic: 0.7, battlefieldControl: 0.3 },
    '表达效率与节奏感': { expression: 1 },
    '战术选择与临场判断': { battlefieldControl: 0.7, counterPressure: 0.3 }
  },
  attack: {
    '问题精准度': { counterPressure: 0.6, logic: 0.4 },
    '连续追问能力': { counterPressure: 0.7, battlefieldControl: 0.3 },
    '抓漏洞能力': { logic: 0.6, counterPressure: 0.4 },
    '逻辑压迫与战场推进': { battlefieldControl: 0.6, counterPressure: 0.4 },
    '表达简洁度与节奏控制': { expression: 1 }
  },
  defense: {
    '正面回应能力': { defenseStability: 0.8, logic: 0.2 },
    '逻辑防守能力': { defenseStability: 0.6, logic: 0.4 },
    '概念切割与陷阱识别': { defenseStability: 0.6, logic: 0.4 },
    '反压能力': { counterPressure: 0.7, defenseStability: 0.3 },
    '表达效率与稳定性': { expression: 0.7, defenseStability: 0.3 }
  },
  closing: {
    '交锋事实吸收与比赛还原': { battlefieldControl: 0.7, logic: 0.3 },
    '核心战场整合': { battlefieldControl: 1 },
    '双方胜负比较与责任结算': { battlefieldControl: 0.6, logic: 0.4 },
    '裁决标准与价值收束': { battlefieldControl: 0.6, logic: 0.4 },
    '终局表达与结构完成度': { expression: 0.7, logic: 0.3 }
  }
};

const legacyTextAbilityProjection = {
  constructive: {
    weights: [27, 32, 21, 15, 5],
    projection: {
      '辩题理解与定义判准': { logic: 0.7, battlefieldControl: 0.3 },
      '论证结构与逻辑链条': { logic: 1 },
      '论据、数据与例证支撑': { logic: 1 },
      '战场设计与可防守性': { battlefieldControl: 1 },
      '表达清晰度与时间控制': { expression: 1 }
    }
  },
  summary: {
    weights: [27, 32, 21, 15, 5],
    projection: {
      '攻辩内容提炼': { battlefieldControl: 0.7, logic: 0.3 },
      '战场结算能力': { battlefieldControl: 1 },
      '漏洞归纳与反击转化': { counterPressure: 0.7, battlefieldControl: 0.3 },
      '与本方主线连接': { logic: 0.6, battlefieldControl: 0.4 },
      '表达简洁度与节奏': { expression: 1 }
    }
  },
  closing: {
    weights: [32, 18, 30, 15, 5],
    projection: {
      '战场整合与胜负比较': { battlefieldControl: 0.8, logic: 0.2 },
      '对攻防成果的吸收': { battlefieldControl: 1 },
      '价值升华与判断标准': { battlefieldControl: 0.6, logic: 0.4 },
      '逻辑收束与表达感染力': { logic: 0.6, expression: 0.4 },
      '时间控制与结构完整': { expression: 0.7, logic: 0.3 }
    }
  }
};

const abilityDimensionNameAliases = {
  constructive: {
    '辩题理解与定义判准': '辩题理解、立场与举证责任',
    '论据、数据与例证支撑': '论据支撑与现实适配',
    '战场设计与可防守性': '定义、判准与裁决框架',
    '表达清晰度与时间控制': '战场设计与表达完成度'
  },
  summary: {
    '攻辩内容提炼': '交锋事实还原与关键材料提取',
    '战场结算能力': '战场结算与胜负比较',
    '漏洞归纳与反击转化': '核心漏洞识别与责任判定',
    '与本方主线连接': '攻防成果向本方主线转化',
    '表达简洁度与节奏': '表达凝练与节奏控制'
  },
  free_debate: {
    '团队协同与战术意识': '战术选择与临场判断'
  },
  closing: {
    '战场整合与胜负比较': '核心战场整合',
    '对攻防成果的吸收': '交锋事实吸收与比赛还原',
    '价值升华与判断标准': '裁决标准与价值收束',
    '逻辑收束与表达感染力': '双方胜负比较与责任结算',
    '时间控制与结构完整': '终局表达与结构完成度'
  }
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
      score: record.projectedScores[dimensionKey]
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
  return {
    validRecords: normalizedRecords,
    overall,
    overallEstimate: toAbilityEstimate(overall),
    coverage,
    observedDimensionCount: observedDimensions.length,
    dimensions
  };
}

export function calculateProjectedOverall(projectedScores = {}) {
  const observedDimensions = abilityDimensions.filter((dimension) => (
    parseFiniteScore(projectedScores?.[dimension.key]) !== null
  ));
  const observedWeight = observedDimensions.reduce((sum, dimension) => sum + dimension.weight, 0);
  if (!observedWeight) return null;
  return observedDimensions.reduce(
    (sum, dimension) => sum + parseFiniteScore(projectedScores[dimension.key]) * dimension.weight,
    0
  ) / observedWeight;
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
    projection: ABILITY_PROJECTION_NAME,
    recordCount: records.length,
    scoredRecordCount: validRecords.length,
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
    note: '五维复盘先按子维度权重投射为五维能力；各能力再独立聚合：相邻有效更新间隔达到30天时开启新阶段，阶段内按后续有效更新次数指数加权，阶段之间按当前阶段样本数动态融合。'
  };
}

export function buildRecentBehaviorEvidence(records = [], {
  recordLimit = 5,
  evidenceLimit = 3
} = {}) {
  const maxRecords = clampInteger(recordLimit, 1, 20);
  const maxEvidence = clampInteger(evidenceLimit, 1, 10);
  const recentRecords = normalizeAbilityRecords(records).slice(-maxRecords).reverse();
  const evidence = [];
  const seen = new Set();

  for (const record of recentRecords) {
    const candidates = extractReviewProblemEvidence(record.review);
    for (const candidate of candidates) {
      const text = normalizeEvidenceText(candidate);
      const key = text.toLocaleLowerCase('zh-CN');
      if (!text || seen.has(key)) continue;
      seen.add(key);
      evidence.push({
        text,
        recordId: record.id || '',
        createdAt: record.createdAt || '',
        mode: record.trainingMode || ''
      });
      if (evidence.length >= maxEvidence) return evidence;
    }
  }

  return evidence;
}

function normalizeAbilityRecords(records = []) {
  return records
    .map((record) => normalizeAbilityRecord(record))
    .filter(Boolean)
    .sort(compareAbilityRecords);
}

function extractReviewProblemEvidence(review) {
  const text = String(review || '').replace(/\r\n?/g, '\n').trim();
  if (!text) return [];
  const sections = [];
  const mainWeakness = text.match(/(?:^|\n)六、最大漏洞：\s*\n?([\s\S]*?)(?=\n\s*七、|$)/);
  if (mainWeakness?.[1]) sections.push(mainWeakness[1]);
  const weaknesses = text.match(/(?:^|\n)八、主要问题：\s*\n?([\s\S]*?)(?=\n\s*九、|$)/);
  if (weaknesses?.[1]) sections.push(weaknesses[1]);

  return sections.flatMap((section) => section
    .split('\n')
    .map((line) => line.replace(/^\s*(?:[-•]|\d+[.)、])\s*/, '').trim())
    .filter(Boolean));
}

function normalizeEvidenceText(value) {
  const text = String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  if (!text || /^(?:暂无|无)(?:明确)?(?:漏洞|短板|问题)?[。.]?$/.test(text)) return '';
  return text;
}

function clampInteger(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, Math.floor(number)));
}

function normalizeAbilityRecord(record = {}) {
  const score = parseFiniteScore(record.score);
  const createdAt = String(record.created_at || record.createdAt || '').trim();
  const timestampMs = Date.parse(createdAt);
  if (score === null || !Number.isFinite(timestampMs)) return null;

  const trainingMode = abilityModeProjection[record.training_mode || record.trainingMode]
    ? (record.training_mode || record.trainingMode)
    : 'free_debate';
  const difficulty = record.difficulty || '';
  const rubricVersion = record.rubric_version || record.rubricVersion || '';
  const difficultyBonus = rubricVersion === 'text_v2' ? 0 : (abilityDifficultyBonus[difficulty] || 0);
  const rawProjectedScores = projectAbilityDimensions({
    ...record,
    training_mode: trainingMode
  });
  const projectedScores = Object.fromEntries(
    Object.entries(rawProjectedScores).map(([key, value]) => [
      key,
      clamp(value + difficultyBonus, 0, 100)
    ])
  );
  const coveredDimensions = Object.keys(projectedScores);
  if (!coveredDimensions.length) return null;
  const projectedOverall = calculateProjectedOverall(projectedScores);
  const versionMetadata = getTrainingRecordVersionMetadata(record);

  const id = String(record.id || '').trim();
  const stableKey = [
    id,
    trainingMode,
    difficulty,
    score,
    ...coveredDimensions.sort().map((key) => `${key}:${projectedScores[key]}`),
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
    projectedScores,
    projectedOverall,
    trainingMode,
    coveredDimensions,
    ...versionMetadata
  };
}

export function projectAbilityDimensions(record = {}) {
  const requestedMode = record.training_mode || record.trainingMode;
  const trainingMode = abilityModeProjection[requestedMode] ? requestedMode : 'free_debate';
  const projection = abilityModeProjection[trainingMode];
  const rubric = getScoringRubric(trainingMode).rubric;
  const providedScores = Array.isArray(record.dimension_scores)
    ? record.dimension_scores
    : Array.isArray(record.dimensionScores)
      ? record.dimensionScores
      : [];
  const legacyText = legacyTextAbilityProjection[trainingMode];
  const currentDimensionNames = new Set(rubric.dimensions.map((dimension) => dimension.name));
  const useLegacyTextProjection = Boolean(
    legacyText && providedScores.some((dimension) => {
      const name = String(dimension?.name || '').trim();
      return legacyText.projection[name] && !currentDimensionNames.has(name);
    })
  );
  const effectiveProjection = useLegacyTextProjection ? legacyText.projection : projection;
  const effectiveDimensions = useLegacyTextProjection
    ? Object.keys(effectiveProjection).map((name, index) => ({ name, maxScore: legacyText.weights[index] }))
    : rubric.dimensions;
  const scoreByName = new Map();
  const nameAliases = abilityDimensionNameAliases[trainingMode] || {};

  const normalizedProvidedScores = providedScores
    .map((dimension) => {
      const sourceName = String(dimension?.name || '').trim();
      const name = effectiveProjection[sourceName] ? sourceName : nameAliases[sourceName];
      const score = parseFiniteScore(dimension?.score);
      const maxScore = parseFiniteScore(dimension?.maxScore ?? dimension?.max_score ?? 100);
      if (!name || score === null || maxScore === null || maxScore <= 0 || score < 0) return null;
      const normalizedScore = maxScore === 100 ? score : (score / maxScore) * 100;
      if (!Number.isFinite(normalizedScore)) return null;
      return {
        name,
        score: clamp(normalizedScore, 0, 100),
        isCanonicalName: sourceName === name
      };
    })
    .filter(Boolean)
    .sort((left, right) => Number(right.isCanonicalName) - Number(left.isCanonicalName));

  normalizedProvidedScores.forEach((dimension) => {
    const { name, score } = dimension;
    if (scoreByName.has(name)) return;
    scoreByName.set(name, score);
  });

  const accumulators = new Map();
  effectiveDimensions.forEach((rubricDimension) => {
    const score = scoreByName.get(rubricDimension.name);
    const targets = effectiveProjection[rubricDimension.name];
    const rubricWeight = Number(rubricDimension.maxScore);
    if (!Number.isFinite(score) || !targets || !Number.isFinite(rubricWeight) || rubricWeight <= 0) return;

    Object.entries(targets).forEach(([dimensionKey, share]) => {
      const numericShare = Number(share);
      if (!abilityDimensions.some((dimension) => dimension.key === dimensionKey)) return;
      if (!Number.isFinite(numericShare) || numericShare <= 0) return;
      const current = accumulators.get(dimensionKey) || { weightedTotal: 0, weightTotal: 0 };
      const weight = rubricWeight * numericShare;
      current.weightedTotal += score * weight;
      current.weightTotal += weight;
      accumulators.set(dimensionKey, current);
    });
  });

  return Object.fromEntries(
    [...accumulators.entries()]
      .filter(([, value]) => value.weightTotal > 0)
      .map(([key, value]) => [key, value.weightedTotal / value.weightTotal])
  );
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
    projectedScores: Object.fromEntries(
      Object.entries(record.projectedScores || {}).map(([key, value]) => [key, roundNullable(value)])
    ),
    projectedOverall: roundNullable(record.projectedOverall),
    scoringVersion: record.scoringVersion || '',
    rubricId: record.rubricId || '',
    rubricVersion: record.rubricVersion || '',
    projectionVersion: record.projectionVersion || '',
    difficultyCalibrationVersion: record.difficultyCalibrationVersion || '',
    estimatorVersion: record.estimatorVersion || '',
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
      dimensions: { logic: 0.45, battlefieldControl: 0.25, expression: 0.3 },
      reason: '你的逻辑推进、开局战场设计和表达清晰度更适合承担开局建构任务。'
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
        logic: 1 / 5,
        defenseStability: 1 / 5,
        counterPressure: 1 / 5,
        battlefieldControl: 1 / 5,
        expression: 1 / 5
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
