export const DEFENSE_SCORING_CONFIG = Object.freeze({
  delayedRecoveryCoefficient: 0.45,
  delayedRecoveryContributionWeight: 0.05,
  modelScoreWeight: 0.55,
  roundScoreWeight: 0.45,
  componentWeights: Object.freeze({
    contentQuality: 0.2,
    currentQuestionRelevance: 0.25,
    responseCompleteness: 0.2,
    timeliness: 0.2,
    defensiveEffectiveness: 0.15
  }),
  statusCaps: Object.freeze({
    unanswered: 42,
    evaded: 49,
    off_topic: 49,
    partially_answered: 79,
    fully_answered: 100
  })
});

const ANSWER_STATUSES = new Set([
  'fully_answered',
  'partially_answered',
  'off_topic',
  'evaded',
  'unanswered'
]);

const FOLLOW_UP_STRATEGIES = new Set([
  'new_attack',
  'clarify',
  'narrow_question',
  'press_unresolved_point',
  'escalate',
  'final_pressure'
]);

const SCORE_COMPONENTS = Object.keys(DEFENSE_SCORING_CONFIG.componentWeights);

export function normalizeDefenseRoundStates(value, totalRounds) {
  if (!Array.isArray(value)) return [];
  const maxRounds = normalizeRoundLimit(totalRounds, 5);
  const normalized = [];
  for (const [index, item] of value.entries()) {
    if (normalized.length >= maxRounds) break;
    const state = normalizeDefenseRoundState(item, index + 1, { previousStates: normalized });
    if (state.roundNumber > maxRounds || normalized.some((candidate) => candidate.roundNumber === state.roundNumber)) continue;
    normalized.push(state);
  }
  return normalized.sort((left, right) => left.roundNumber - right.roundNumber);
}

export function reconcileDefenseRoundStates(value, { plannedRounds, completedRounds } = {}) {
  const safeCompletedRounds = clampInteger(completedRounds, 0, 5);
  const safePlannedRounds = Math.max(safeCompletedRounds, normalizeRoundLimit(plannedRounds, safeCompletedRounds || 1));
  const provided = normalizeDefenseRoundStates(value, safeCompletedRounds || 1);
  const states = [];
  const warnings = [];

  for (let roundNumber = 1; roundNumber <= safeCompletedRounds; roundNumber += 1) {
    const existing = provided.find((item) => item.roundNumber === roundNumber);
    if (existing) {
      states.push(normalizeDefenseRoundState(existing, roundNumber, { previousStates: states }));
      continue;
    }
    states.push(normalizeDefenseRoundState({
      roundNumber,
      totalRounds: safePlannedRounds,
      answerStatus: 'partially_answered',
      currentQuestionCompletion: 50,
      isCurrentQuestionAnswered: false,
      unresolvedPoints: ['该已完成轮次缺少结构化分析，按保守状态处理'],
      reason: '该已完成轮次缺少结构化分析，已按保守状态补齐。'
    }, roundNumber, { previousStates: states }));
    warnings.push(`第${roundNumber}轮缺少结构化状态，已保守补齐。`);
  }
  if (Array.isArray(value) && value.length > safeCompletedRounds) {
    warnings.push('收到多于实际完成轮次的状态，已截断未来状态。');
  }

  return {
    plannedRounds: safePlannedRounds,
    completedRounds: safeCompletedRounds,
    states,
    dataIntegrityWarning: warnings.join(' ')
  };
}

export function normalizeDefenseQuestion(value, roundNumber) {
  const source = value && typeof value === 'object' ? value : {};
  const safeRound = clampInteger(roundNumber, 1, 5);
  return {
    roundNumber: safeRound,
    totalRounds: Number.isFinite(Number(source.totalRounds)) ? normalizeRoundLimit(source.totalRounds, safeRound) : undefined,
    questionId: cleanText(source.questionId) || `defense_round_${safeRound}_question_1`,
    questionText: cleanText(source.questionText),
    targetPoint: cleanText(source.targetPoint) || '当前核心防守点',
    requiredResponse: cleanText(source.requiredResponse) || '正面回应当前问题并给出理由'
  };
}

export function parseDefenseOpening(content, totalRounds) {
  const parsed = parseJsonObject(content);
  const question = normalizeDefenseQuestion({
    ...parsed,
    totalRounds: normalizeRoundLimit(totalRounds, 3),
    questionText: parsed?.questionText || cleanText(content)
  }, 1);
  return {
    questionText: question.questionText || '请正面说明你方核心论点成立的依据。',
    question
  };
}

export function parseDefenseTurn(content, context = {}) {
  const parsed = parseJsonObject(content);
  const roundNumber = clampInteger(context.currentRound, 1, 5);
  const currentQuestion = normalizeDefenseQuestion(context.currentQuestion, roundNumber);
  const previousStates = normalizeDefenseRoundStates(context.previousRounds, context.totalRounds);
  const state = normalizeDefenseRoundState({
    ...parsed,
    roundNumber,
    totalRounds: normalizeRoundLimit(context.totalRounds, 3),
    questionId: currentQuestion.questionId,
    questionText: currentQuestion.questionText,
    targetPoint: currentQuestion.targetPoint,
    requiredResponse: currentQuestion.requiredResponse,
    userAnswer: context.userAnswer,
    reason: cleanText(parsed?.reason) || '回答分析结果缺少完整说明，已采用保守校对。'
  }, roundNumber, { previousStates, currentQuestionId: currentQuestion.questionId });

  const nextRound = roundNumber + 1;
  const rawNextQuestion = normalizeDefenseQuestion({
    ...parsed?.nextQuestion,
    totalRounds: normalizeRoundLimit(context.totalRounds, 3),
    questionId: `defense_round_${nextRound}_question_1`
  }, nextRound);
  const nextQuestion = nextRound <= Number(context.totalRounds)
    ? preventRepeatedQuestion(rawNextQuestion, currentQuestion, state, previousStates)
    : null;

  return { state, nextQuestion, parseSucceeded: Boolean(parsed) };
}

export function calculateDefenseFinalScore(modelScore, roundStates, totalRounds) {
  const states = normalizeDefenseRoundStates(roundStates, totalRounds);
  if (!states.length) {
    const blendedScore = roundToOne(Math.max(0, Math.min(Number(modelScore), 100)));
    return { score: blendedScore, blendedScore, roundAverage: null, cap: null };
  }

  const roundAverage = states.reduce((sum, state) => sum + state.roundScore.total, 0) / states.length;
  const blended = Number(modelScore) * DEFENSE_SCORING_CONFIG.modelScoreWeight
    + roundAverage * DEFENSE_SCORING_CONFIG.roundScoreWeight;
  const problemStates = states.filter((state) => ['unanswered', 'evaded', 'off_topic'].includes(state.answerStatus));
  const delayedWithoutCurrent = states.filter((state) => state.isDelayedAnswer && !state.isCurrentQuestionAnswered);
  const incompleteStates = states.filter((state) => !state.isCurrentQuestionAnswered);
  let cap = 100;
  if (problemStates.length === 1) cap = 79;
  if (problemStates.length >= 2) cap = 64;
  if (problemStates.length >= Math.ceil(states.length / 2)) cap = Math.min(cap, 49);
  if (delayedWithoutCurrent.length) cap = Math.min(cap, 69);
  if (incompleteStates.length === states.length) cap = Math.min(cap, 79);
  else if (incompleteStates.length >= Math.ceil(states.length / 2)) cap = Math.min(cap, 84);
  return {
    score: roundToOne(Math.max(0, Math.min(blended, cap, 100))),
    blendedScore: roundToOne(Math.max(0, Math.min(blended, 100))),
    roundAverage: roundToOne(roundAverage),
    cap: cap < 100 ? cap : null
  };
}

export function buildDefenseRoundContext(states, totalRounds) {
  const normalized = normalizeDefenseRoundStates(states, totalRounds);
  const answeredQuestionIds = new Set(normalized.flatMap((item) => item.answeredQuestionIds));
  return JSON.stringify({
    totalRounds: normalizeRoundLimit(totalRounds, normalized.length || 3),
    previousRounds: normalized,
    unresolvedPoints: [...new Set(normalized.flatMap((item) => (
      answeredQuestionIds.has(item.questionId) ? [] : item.unresolvedPoints
    )))],
    delayedAnswerCount: normalized.filter((item) => item.isDelayedAnswer).length,
    missedCurrentQuestionCount: normalized.filter((item) => !item.isCurrentQuestionAnswered).length
  }, null, 2);
}

export function normalizeDefenseRoundState(value, fallbackRound, context = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const roundNumber = clampInteger(source.roundNumber ?? fallbackRound, 1, 5);
  const requestedStatus = ANSWER_STATUSES.has(source.answerStatus)
    ? source.answerStatus
    : 'partially_answered';
  let currentQuestionCompletion = clampNumber(source.currentQuestionCompletion, 0, 100, 50);
  let answerStatus = requestedStatus;
  let isCurrentQuestionAnswered = source.isCurrentQuestionAnswered === true;
  if (requestedStatus === 'fully_answered' && (!isCurrentQuestionAnswered || currentQuestionCompletion < 80)) {
    answerStatus = 'partially_answered';
  }
  if (answerStatus === 'fully_answered') {
    isCurrentQuestionAnswered = true;
    currentQuestionCompletion = Math.max(80, currentQuestionCompletion);
  } else {
    isCurrentQuestionAnswered = false;
    currentQuestionCompletion = answerStatus === 'partially_answered'
      ? Math.min(79, currentQuestionCompletion)
      : answerStatus === 'unanswered' ? 0 : Math.min(49, currentQuestionCompletion);
  }
  const questionId = cleanText(source.questionId) || `defense_round_${roundNumber}_question_1`;
  const previousStates = Array.isArray(context.previousStates) ? context.previousStates : [];
  const delayedAnswerQuestionIds = validateDelayedAnswerQuestionIds(
    source.delayedAnswerQuestionIds,
    previousStates,
    roundNumber,
    context.currentQuestionId || questionId
  );
  const isDelayedAnswer = delayedAnswerQuestionIds.length > 0;
  const followUpStrategy = FOLLOW_UP_STRATEGIES.has(source.followUpStrategy)
    ? source.followUpStrategy
    : chooseFallbackStrategy({ status: answerStatus, roundNumber, totalRounds: 3 });
  const roundScore = normalizeRoundScore(source.roundScore, {
    completion: currentQuestionCompletion,
    status: answerStatus,
    isCurrentQuestionAnswered,
    isDelayedAnswer
  });
  const answeredQuestionIds = [...delayedAnswerQuestionIds];
  if (answerStatus === 'fully_answered') answeredQuestionIds.push(questionId);
  const unresolvedPoints = normalizeStrings(source.unresolvedPoints);
  if (!isCurrentQuestionAnswered && !unresolvedPoints.length) {
    unresolvedPoints.push(cleanText(source.requiredResponse || source.targetPoint) || '当前问题尚未完整回答');
  }
  return {
    roundNumber,
    totalRounds: Number.isFinite(Number(source.totalRounds)) ? normalizeRoundLimit(source.totalRounds, roundNumber) : undefined,
    questionId,
    questionText: cleanText(source.questionText),
    targetPoint: cleanText(source.targetPoint),
    requiredResponse: cleanText(source.requiredResponse),
    userAnswer: cleanText(source.userAnswer),
    answerStatus,
    currentQuestionCompletion,
    unresolvedPoints,
    answeredQuestionIds,
    delayedAnswerQuestionIds,
    isDelayedAnswer,
    isCurrentQuestionAnswered,
    followUpStrategy,
    roundScore,
    reason: cleanText(source.reason)
  };
}

function normalizeRoundScore(value, context) {
  const source = value && typeof value === 'object' ? value : {};
  const statusCap = DEFENSE_SCORING_CONFIG.statusCaps[context.status] ?? 79;
  const defaults = {
    contentQuality: context.completion,
    currentQuestionRelevance: context.isCurrentQuestionAnswered ? context.completion : Math.min(context.completion, 35),
    responseCompleteness: context.completion,
    timeliness: context.isCurrentQuestionAnswered ? context.completion : 20,
    defensiveEffectiveness: context.isCurrentQuestionAnswered ? context.completion : Math.min(context.completion, 35)
  };
  const result = {};
  for (const key of SCORE_COMPONENTS) {
    result[key] = clampNumber(source[key], 0, 100, defaults[key]);
  }
  if (!context.isCurrentQuestionAnswered) {
    result.currentQuestionRelevance = Math.min(result.currentQuestionRelevance, 35);
    result.timeliness = Math.min(result.timeliness, 20);
    result.defensiveEffectiveness = Math.min(result.defensiveEffectiveness, 35);
  }
  if (context.status === 'unanswered') {
    result.contentQuality = Math.min(result.contentQuality, 20);
    result.responseCompleteness = Math.min(result.responseCompleteness, 10);
  }
  result.delayedRecoveryQuality = context.isDelayedAnswer
    ? clampNumber(source.delayedRecoveryQuality ?? source.delayedRecovery, 0, 100, result.contentQuality)
    : 0;
  result.delayedRecoveryCredit = Math.min(2.25, roundToOne(
    result.delayedRecoveryQuality
      * DEFENSE_SCORING_CONFIG.delayedRecoveryCoefficient
      * DEFENSE_SCORING_CONFIG.delayedRecoveryContributionWeight
  ));
  result.delayedRecovery = result.delayedRecoveryQuality * DEFENSE_SCORING_CONFIG.delayedRecoveryCoefficient;
  const base = SCORE_COMPONENTS.reduce((sum, key) => (
    sum + result[key] * DEFENSE_SCORING_CONFIG.componentWeights[key]
  ), 0);
  result.total = roundToOne(Math.min(base + result.delayedRecoveryCredit, statusCap));
  return result;
}

function validateDelayedAnswerQuestionIds(value, previousStates, currentRound, currentQuestionId) {
  const priorRecoveryIds = new Set(previousStates.flatMap((item) => item.delayedAnswerQuestionIds || []));
  const previousById = new Map(previousStates.map((item) => [item.questionId, item]));
  return normalizeIds(value).filter((id) => {
    if (id === currentQuestionId || priorRecoveryIds.has(id)) return false;
    const match = /^defense_round_([1-5])_question_([1-9]\d*)$/.exec(id);
    if (!match) return false;
    const historical = previousById.get(id);
    return Boolean(
      historical
      && historical.roundNumber === Number(match[1])
      && historical.roundNumber < currentRound
      && historical.answerStatus !== 'fully_answered'
      && historical.isCurrentQuestionAnswered !== true
    );
  });
}

function preventRepeatedQuestion(nextQuestion, currentQuestion, state, previousStates) {
  if (!nextQuestion.questionText) {
    const unresolved = state.unresolvedPoints[0]
      || previousStates.flatMap((item) => item.unresolvedPoints)[0]
      || currentQuestion.requiredResponse;
    return {
      ...nextQuestion,
      questionText: `请直接回应“${unresolved}”，先给出明确结论，再说明依据。`,
      targetPoint: unresolved,
      requiredResponse: `直接回应并解决：${unresolved}`
    };
  }
  const similarity = diceSimilarity(nextQuestion.questionText, currentQuestion.questionText);
  if (similarity < 0.78) return nextQuestion;
  const unresolved = state.unresolvedPoints[0]
    || previousStates.flatMap((item) => item.unresolvedPoints)[0]
    || currentQuestion.requiredResponse;
  return {
    ...nextQuestion,
    questionText: `你刚才仍未完整回应“${unresolved}”。请直接给出结论和依据，并说明这如何守住你方核心立场。`,
    targetPoint: unresolved,
    requiredResponse: `直接回应并解决：${unresolved}`
  };
}

function chooseFallbackStrategy({ status, roundNumber, totalRounds }) {
  if (roundNumber >= Number(totalRounds)) return 'final_pressure';
  if (status === 'fully_answered') return 'new_attack';
  if (status === 'partially_answered') return 'press_unresolved_point';
  if (status === 'off_topic' || status === 'evaded') return 'narrow_question';
  return 'clarify';
}

function parseJsonObject(content) {
  const text = cleanText(content);
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function normalizeStrings(value) {
  return Array.isArray(value) ? value.map(cleanText).filter(Boolean).slice(0, 8) : [];
}

function normalizeIds(value) {
  return normalizeStrings(value).filter((item) => /^defense_round_[1-5]_question_\d+$/.test(item));
}

function diceSimilarity(left, right) {
  const a = cleanText(left).replace(/[^\p{L}\p{N}]/gu, '');
  const b = cleanText(right).replace(/[^\p{L}\p{N}]/gu, '');
  if (!a || !b) return 0;
  if (a === b) return 1;
  const pairs = (text) => Array.from({ length: Math.max(0, text.length - 1) }, (_, index) => text.slice(index, index + 2));
  const pool = pairs(b);
  let matches = 0;
  for (const pair of pairs(a)) {
    const index = pool.indexOf(pair);
    if (index >= 0) {
      matches += 1;
      pool.splice(index, 1);
    }
  }
  return (2 * matches) / Math.max(1, a.length + b.length - 2);
}

function cleanText(value) {
  return String(value || '').trim().slice(0, 2000);
}

function clampNumber(value, min, max, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.min(max, Math.max(min, numeric)) : fallback;
}

function clampInteger(value, min, max) {
  return Math.floor(clampNumber(value, min, max, min));
}

function normalizeRoundLimit(value, fallback = 5) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? clampInteger(numeric, 1, 5) : clampInteger(fallback, 1, 5);
}

function roundToOne(value) {
  return Math.round((Number(value) + Number.EPSILON) * 10) / 10;
}
