export const DEFENSE_SCORING_CONFIG = Object.freeze({
  delayedAnswerCoefficient: 0.45,
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
  const maxRounds = totalRounds === 5 ? 5 : 3;
  return value
    .slice(0, maxRounds)
    .map((item, index) => normalizeDefenseRoundState(item, index + 1))
    .filter((item, index, items) => (
      item.roundNumber <= maxRounds
      && items.findIndex((candidate) => candidate.roundNumber === item.roundNumber) === index
    ));
}

export function normalizeDefenseQuestion(value, roundNumber) {
  const source = value && typeof value === 'object' ? value : {};
  const safeRound = clampInteger(roundNumber, 1, 5);
  return {
    roundNumber: safeRound,
    totalRounds: source.totalRounds === 5 ? 5 : source.totalRounds === 3 ? 3 : undefined,
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
    totalRounds: totalRounds === 5 ? 5 : 3,
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
  const fallbackStatus = 'partially_answered';
  const status = ANSWER_STATUSES.has(parsed?.answerStatus) ? parsed.answerStatus : fallbackStatus;
  const completion = clampNumber(parsed?.currentQuestionCompletion, 0, 100, 50);
  const answeredQuestionIds = normalizeIds(parsed?.answeredQuestionIds);
  const delayedAnswerQuestionIds = normalizeIds(parsed?.delayedAnswerQuestionIds)
    .filter((id) => id !== currentQuestion.questionId);
  const isCurrentQuestionAnswered = parsed?.isCurrentQuestionAnswered === true
    || (status === 'fully_answered' && completion >= 80);
  if (isCurrentQuestionAnswered && !answeredQuestionIds.includes(currentQuestion.questionId)) {
    answeredQuestionIds.push(currentQuestion.questionId);
  }
  const isDelayedAnswer = delayedAnswerQuestionIds.length > 0;
  const unresolvedPoints = normalizeStrings(parsed?.unresolvedPoints);
  if (!isCurrentQuestionAnswered && !unresolvedPoints.length) {
    unresolvedPoints.push(currentQuestion.requiredResponse || currentQuestion.targetPoint);
  }
  const followUpStrategy = FOLLOW_UP_STRATEGIES.has(parsed?.followUpStrategy)
    ? parsed.followUpStrategy
    : chooseFallbackStrategy({ status, roundNumber, totalRounds: context.totalRounds });
  const components = normalizeRoundScore(parsed?.roundScore, {
    completion,
    status,
    isCurrentQuestionAnswered,
    isDelayedAnswer
  });

  const state = normalizeDefenseRoundState({
    roundNumber,
    totalRounds: context.totalRounds === 5 ? 5 : 3,
    questionId: currentQuestion.questionId,
    questionText: currentQuestion.questionText,
    targetPoint: currentQuestion.targetPoint,
    requiredResponse: currentQuestion.requiredResponse,
    userAnswer: context.userAnswer,
    answerStatus: status,
    currentQuestionCompletion: completion,
    unresolvedPoints,
    answeredQuestionIds,
    delayedAnswerQuestionIds,
    isDelayedAnswer,
    isCurrentQuestionAnswered,
    followUpStrategy,
    roundScore: components,
    reason: cleanText(parsed?.reason) || '回答分析结果缺少完整说明，已采用保守校对。'
  }, roundNumber);

  const nextRound = roundNumber + 1;
  const rawNextQuestion = normalizeDefenseQuestion({
    ...parsed?.nextQuestion,
    totalRounds: context.totalRounds === 5 ? 5 : 3,
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
    return { score: roundToOne(modelScore), roundAverage: null, cap: null };
  }

  const roundAverage = states.reduce((sum, state) => sum + state.roundScore.total, 0) / states.length;
  const blended = Number(modelScore) * DEFENSE_SCORING_CONFIG.modelScoreWeight
    + roundAverage * DEFENSE_SCORING_CONFIG.roundScoreWeight;
  const problemStates = states.filter((state) => ['unanswered', 'evaded', 'off_topic'].includes(state.answerStatus));
  const delayedWithoutCurrent = states.filter((state) => state.isDelayedAnswer && !state.isCurrentQuestionAnswered);
  let cap = 100;
  if (problemStates.length === 1) cap = 79;
  if (problemStates.length >= 2) cap = 64;
  if (problemStates.length >= Math.ceil(states.length / 2)) cap = Math.min(cap, 49);
  if (delayedWithoutCurrent.length) cap = Math.min(cap, 69);
  return {
    score: roundToOne(Math.max(0, Math.min(blended, cap, 100))),
    roundAverage: roundToOne(roundAverage),
    cap: cap < 100 ? cap : null
  };
}

export function buildDefenseRoundContext(states, totalRounds) {
  const normalized = normalizeDefenseRoundStates(states, totalRounds);
  const answeredQuestionIds = new Set(normalized.flatMap((item) => item.answeredQuestionIds));
  return JSON.stringify({
    totalRounds: totalRounds === 5 ? 5 : 3,
    previousRounds: normalized,
    unresolvedPoints: [...new Set(normalized.flatMap((item) => (
      answeredQuestionIds.has(item.questionId) ? [] : item.unresolvedPoints
    )))],
    delayedAnswerCount: normalized.filter((item) => item.isDelayedAnswer).length,
    missedCurrentQuestionCount: normalized.filter((item) => !item.isCurrentQuestionAnswered).length
  }, null, 2);
}

function normalizeDefenseRoundState(value, fallbackRound) {
  const source = value && typeof value === 'object' ? value : {};
  const roundNumber = clampInteger(source.roundNumber ?? fallbackRound, 1, 5);
  const answerStatus = ANSWER_STATUSES.has(source.answerStatus)
    ? source.answerStatus
    : 'partially_answered';
  const currentQuestionCompletion = clampNumber(source.currentQuestionCompletion, 0, 100, 50);
  const delayedAnswerQuestionIds = normalizeIds(source.delayedAnswerQuestionIds);
  const isDelayedAnswer = source.isDelayedAnswer === true || delayedAnswerQuestionIds.length > 0;
  const isCurrentQuestionAnswered = source.isCurrentQuestionAnswered === true;
  const followUpStrategy = FOLLOW_UP_STRATEGIES.has(source.followUpStrategy)
    ? source.followUpStrategy
    : chooseFallbackStrategy({ status: answerStatus, roundNumber, totalRounds: 3 });
  const roundScore = normalizeRoundScore(source.roundScore, {
    completion: currentQuestionCompletion,
    status: answerStatus,
    isCurrentQuestionAnswered,
    isDelayedAnswer
  });
  return {
    roundNumber,
    totalRounds: source.totalRounds === 5 ? 5 : source.totalRounds === 3 ? 3 : undefined,
    questionId: cleanText(source.questionId) || `defense_round_${roundNumber}_question_1`,
    questionText: cleanText(source.questionText),
    targetPoint: cleanText(source.targetPoint),
    requiredResponse: cleanText(source.requiredResponse),
    userAnswer: cleanText(source.userAnswer),
    answerStatus,
    currentQuestionCompletion,
    unresolvedPoints: normalizeStrings(source.unresolvedPoints),
    answeredQuestionIds: normalizeIds(source.answeredQuestionIds),
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
  result.delayedRecovery = context.isDelayedAnswer
    ? clampNumber(
        source.delayedRecovery,
        0,
        result.contentQuality * DEFENSE_SCORING_CONFIG.delayedAnswerCoefficient,
        result.contentQuality * DEFENSE_SCORING_CONFIG.delayedAnswerCoefficient
      )
    : 0;
  const base = SCORE_COMPONENTS.reduce((sum, key) => (
    sum + result[key] * DEFENSE_SCORING_CONFIG.componentWeights[key]
  ), 0);
  result.total = roundToOne(Math.min(base + result.delayedRecovery * 0.05, statusCap));
  return result;
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

function roundToOne(value) {
  return Math.round((Number(value) + Number.EPSILON) * 10) / 10;
}
