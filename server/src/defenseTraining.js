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

const REQUIRED_ROUND_SCORE_COMPONENTS = Object.freeze([
  ...SCORE_COMPONENTS,
  'delayedRecoveryQuality'
]);

export function validateDefenseTurnAnalysis(content, { hasNextRound = true, difficulty = 'campus' } = {}) {
  const parsed = parseStrictJsonObject(content);
  const errors = [];
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { valid: false, parsed: null, errors: ['root_must_be_json_object'] };
  }

  if (!ANSWER_STATUSES.has(parsed.answerStatus)) errors.push('answerStatus_invalid');
  validateScoreNumber(parsed.currentQuestionCompletion, 'currentQuestionCompletion', errors);
  if (typeof parsed.isCurrentQuestionAnswered !== 'boolean') errors.push('isCurrentQuestionAnswered_must_be_boolean');
  for (const field of ['answeredQuestionIds', 'delayedAnswerQuestionIds', 'unresolvedPoints']) {
    if (!Array.isArray(parsed[field]) || parsed[field].some((item) => typeof item !== 'string')) {
      errors.push(`${field}_must_be_string_array`);
    }
  }
  if (typeof parsed.reason !== 'string' || !parsed.reason.trim()) errors.push('reason_must_be_nonempty_string');
  if (!FOLLOW_UP_STRATEGIES.has(parsed.followUpStrategy)) errors.push('followUpStrategy_invalid');
  if (!parsed.roundScore || typeof parsed.roundScore !== 'object' || Array.isArray(parsed.roundScore)) {
    errors.push('roundScore_must_be_object');
  } else {
    for (const field of REQUIRED_ROUND_SCORE_COMPONENTS) {
      validateScoreNumber(parsed.roundScore[field], `roundScore.${field}`, errors);
    }
  }

  if (hasNextRound) {
    const next = parsed.nextQuestion;
    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      errors.push('nextQuestion_must_be_object');
    } else {
      for (const field of ['questionText', 'targetPoint', 'requiredResponse']) {
        if (typeof next[field] !== 'string' || !next[field].trim()) errors.push(`nextQuestion.${field}_must_be_nonempty_string`);
      }
      collectDefenseQuestionScopeErrors(next, difficulty, errors, 'nextQuestion.');
    }
  } else if (parsed.nextQuestion !== null) {
    errors.push('nextQuestion_must_be_null_on_final_round');
  }

  return { valid: errors.length === 0, parsed, errors };
}

export function validateDefenseOpeningAnalysis(content, { difficulty = 'campus' } = {}) {
  const parsed = parseStrictJsonObject(content);
  const errors = [];
  if (!parsed) return { valid: false, parsed: null, errors: ['root_must_be_json_object'] };
  for (const field of ['questionText', 'targetPoint', 'requiredResponse']) {
    if (typeof parsed[field] !== 'string' || !parsed[field].trim()) errors.push(`${field}_must_be_nonempty_string`);
  }
  collectDefenseQuestionScopeErrors(parsed, difficulty, errors);
  return { valid: errors.length === 0, parsed, errors };
}

export function buildDefenseAnalysisRepairInstruction({ hasNextRound = true, difficulty = 'campus' } = {}) {
  const nextQuestionExample = hasNextRound
    ? '{"questionText":"沿用上一条下一轮质询","targetPoint":"沿用上一条攻击点","requiredResponse":"沿用上一条回应要求"}'
    : 'null';
  return [
    '你上一条防守分析的JSON字段类型或结构不符合接口要求。只修复格式，不得重新评价用户回答，不得改变原有判断、分数或追问内容。',
    '只输出一个JSON对象，不要Markdown或解释。所有分数字段必须是0到100之间的数字（不能是字符串或说明文字），isCurrentQuestionAnswered必须是布尔值。',
    'answeredQuestionIds、delayedAnswerQuestionIds、unresolvedPoints必须是字符串数组；reason必须是非空字符串。',
    'roundScore必须完整包含contentQuality、currentQuestionRelevance、responseCompleteness、timeliness、defensiveEffectiveness、delayedRecoveryQuality六个数字字段。',
    hasNextRound
      ? 'nextQuestion必须是对象，并完整包含非空字符串questionText、targetPoint、requiredResponse。'
      : '本轮是最后一轮，nextQuestion必须严格为null。',
    hasNextRound ? getDefenseQuestionScopeRepairRule(difficulty, 'nextQuestion') : '',
    `严格结构示例：{"answerStatus":"partially_answered","currentQuestionCompletion":65,"isCurrentQuestionAnswered":false,"answeredQuestionIds":[],"delayedAnswerQuestionIds":[],"unresolvedPoints":["尚未回应的明确义务"],"reason":"沿用上一条判断说明","followUpStrategy":"press_unresolved_point","roundScore":{"contentQuality":70,"currentQuestionRelevance":75,"responseCompleteness":65,"timeliness":80,"defensiveEffectiveness":60,"delayedRecoveryQuality":0},"nextQuestion":${nextQuestionExample}}`
  ].filter(Boolean).join('\n');
}

export function buildDefenseQuestionRepairInstruction({ difficulty = 'campus' } = {}) {
  return [
    '上一条质询的回应义务过多或问题结构不符合防守训练要求。请保持同一个核心攻击点，只缩短并重写问题，不得新增攻击点。',
    getDefenseQuestionScopeRepairRule(difficulty, '本轮问题'),
    '只输出严格JSON对象：{"questionText":"重写后的单一核心质询","targetPoint":"同一个核心攻击点","requiredResponse":"单一、可完成、不会移动的回应义务"}。不要解释修改过程。'
  ].join('\n');
}

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
  let cap = 100;
  if (problemStates.length === 1) cap = 79;
  if (problemStates.length >= 2) cap = 64;
  if (problemStates.length === states.length) cap = Math.min(cap, 49);
  if (delayedWithoutCurrent.length >= Math.ceil(states.length / 2)) cap = Math.min(cap, 69);
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
  const isCurrentQuestionAddressed = answerStatus === 'fully_answered' || answerStatus === 'partially_answered';
  const followUpStrategy = FOLLOW_UP_STRATEGIES.has(source.followUpStrategy)
    ? source.followUpStrategy
    : chooseFallbackStrategy({ status: answerStatus, roundNumber, totalRounds: 3 });
  const roundScore = normalizeRoundScore(source.roundScore, {
    completion: currentQuestionCompletion,
    status: answerStatus,
    isCurrentQuestionAnswered,
    isCurrentQuestionAddressed,
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
    isCurrentQuestionAddressed,
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
    currentQuestionRelevance: context.isCurrentQuestionAddressed ? context.completion : Math.min(context.completion, 35),
    responseCompleteness: context.completion,
    timeliness: context.isCurrentQuestionAddressed ? context.completion : 20,
    defensiveEffectiveness: context.isCurrentQuestionAddressed ? context.completion : Math.min(context.completion, 35)
  };
  const result = {};
  for (const key of SCORE_COMPONENTS) {
    result[key] = clampNumber(source[key], 0, 100, defaults[key]);
  }
  if (!context.isCurrentQuestionAddressed) {
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

function collectDefenseQuestionScopeErrors(question, difficulty, errors, prefix = '') {
  if (!question || typeof question !== 'object') return;
  const questionText = typeof question.questionText === 'string' ? question.questionText.trim() : '';
  const requiredResponse = typeof question.requiredResponse === 'string' ? question.requiredResponse.trim() : '';
  const isNovice = difficulty === 'novice';
  const questionLengthLimit = isNovice ? 120 : 220;
  const responseLengthLimit = isNovice ? 55 : 100;
  const questionMarkLimit = isNovice ? 1 : 2;
  const connectorLimit = isNovice ? 0 : 1;
  const questionMarkCount = (questionText.match(/[？?]/g) || []).length;
  const dutyConnectorCount = (requiredResponse.match(/以及|分别|同时|并(?:说明|解释|回应|明确|给出|比较|论证)/g) || []).length;
  const impossibleStandard = /百分之百|零风险|完全消除|立即(?:彻底)?阻断|绝对(?:不会|准确)/.test(`${questionText}\n${requiredResponse}`)
    || (isNovice && /(?:确保|保证).{0,20}(?:不会|准确|无误)/.test(requiredResponse));
  if (questionText.length > questionLengthLimit) errors.push(`${prefix}questionText_too_long_for_difficulty`);
  if (requiredResponse.length > responseLengthLimit) errors.push(`${prefix}requiredResponse_too_long_for_difficulty`);
  if (questionMarkCount > questionMarkLimit) errors.push(`${prefix}questionText_has_too_many_questions`);
  if (dutyConnectorCount > connectorLimit) errors.push(`${prefix}requiredResponse_has_too_many_duties`);
  if (impossibleStandard) errors.push(`${prefix}requires_impossible_standard`);
}

function getDefenseQuestionScopeRepairRule(difficulty, subject) {
  if (difficulty === 'novice') {
    return `${subject}只能包含一个问号、一个核心问题和一个回应义务；questionText不超过120个汉字，requiredResponse不超过55个汉字，不得用“并说明/并解释/以及/分别/同时”叠加第二项任务。不得要求百分之百保证、立即彻底阻断或完全消除风险。`;
  }
  return `${subject}只能围绕一个核心问题，最多两个紧密相关的子要求；questionText不超过220个汉字，requiredResponse不超过100个汉字。不得把百分之百保证、立即彻底阻断或完全消除风险设为唯一合格答案。`;
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

function parseStrictJsonObject(content) {
  const text = cleanText(content);
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function validateScoreNumber(value, field, errors) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
    errors.push(`${field}_must_be_number_0_100`);
  }
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
