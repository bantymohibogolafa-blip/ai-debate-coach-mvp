import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFENSE_SCORING_CONFIG,
  calculateDefenseFinalScore,
  normalizeDefenseRoundStates,
  parseDefenseTurn
} from '../src/defenseTraining.js';

function question(roundNumber, text = `第${roundNumber}轮问题`) {
  return {
    roundNumber,
    questionId: `defense_round_${roundNumber}_question_1`,
    questionText: text,
    targetPoint: `攻击点${roundNumber}`,
    requiredResponse: `回应要求${roundNumber}`
  };
}

function modelTurn(overrides = {}) {
  return JSON.stringify({
    answerStatus: 'fully_answered',
    currentQuestionCompletion: 90,
    isCurrentQuestionAnswered: true,
    answeredQuestionIds: [],
    delayedAnswerQuestionIds: [],
    unresolvedPoints: [],
    reason: '正面完成本轮回应',
    followUpStrategy: 'new_attack',
    roundScore: {
      contentQuality: 90,
      currentQuestionRelevance: 90,
      responseCompleteness: 90,
      timeliness: 90,
      defensiveEffectiveness: 90,
      delayedRecovery: 0
    },
    nextQuestion: question(2, '请比较双方方案的独特优势。'),
    ...overrides
  });
}

test('three-round and five-round modes share the same normalized state implementation', () => {
  const input = [1, 2, 3, 4, 5].map((roundNumber) => ({
    ...question(roundNumber),
    answerStatus: 'fully_answered',
    currentQuestionCompletion: 90,
    isCurrentQuestionAnswered: true,
    roundScore: {}
  }));

  assert.equal(normalizeDefenseRoundStates(input, 3).length, 3);
  assert.equal(normalizeDefenseRoundStates(input, 5).length, 5);
  assert.equal(DEFENSE_SCORING_CONFIG.delayedRecoveryCoefficient, 0.45);
  assert.equal(DEFENSE_SCORING_CONFIG.delayedRecoveryContributionWeight, 0.05);
});

test('a delayed answer does not complete the current question or overwrite the missed round', () => {
  const previous = normalizeDefenseRoundStates([{
    ...question(2),
    answerStatus: 'unanswered',
    currentQuestionCompletion: 0,
    isCurrentQuestionAnswered: false,
    unresolvedPoints: ['第二轮标准依据未回答'],
    roundScore: {}
  }], 3);
  const content = modelTurn({
    answerStatus: 'off_topic',
    currentQuestionCompletion: 20,
    isCurrentQuestionAnswered: false,
    answeredQuestionIds: ['defense_round_2_question_1'],
    delayedAnswerQuestionIds: ['defense_round_2_question_1'],
    unresolvedPoints: ['第三轮比较优势未回答'],
    followUpStrategy: 'final_pressure',
    nextQuestion: null
  });
  const result = parseDefenseTurn(content, {
    currentRound: 3,
    totalRounds: 3,
    currentQuestion: question(3),
    previousRounds: previous,
    userAnswer: '补充第二轮标准依据'
  });

  assert.equal(result.state.isDelayedAnswer, true);
  assert.equal(result.state.isCurrentQuestionAnswered, false);
  assert.equal(result.state.answerStatus, 'off_topic');
  assert.equal(previous[0].answerStatus, 'unanswered');
  assert.equal(result.nextQuestion, null);
  assert.ok(result.state.roundScore.total <= 49);
});

test('partial answers preserve unresolved points and repeated questions are rewritten', () => {
  const repeatedText = '为什么你的判断标准能够成立？';
  const result = parseDefenseTurn(modelTurn({
    answerStatus: 'partially_answered',
    currentQuestionCompletion: 55,
    isCurrentQuestionAnswered: false,
    unresolvedPoints: ['判断标准的客观依据'],
    followUpStrategy: 'press_unresolved_point',
    nextQuestion: question(2, repeatedText)
  }), {
    currentRound: 1,
    totalRounds: 5,
    currentQuestion: question(1, repeatedText),
    previousRounds: [],
    userAnswer: '只解释了标准的用途'
  });

  assert.equal(result.state.answerStatus, 'partially_answered');
  assert.deepEqual(result.state.unresolvedPoints, ['判断标准的客观依据']);
  assert.notEqual(result.nextQuestion.questionText, repeatedText);
  assert.match(result.nextQuestion.questionText, /直接给出结论和依据/);
});

test('historical and current questions can be recognized separately in one answer', () => {
  const previousRounds = normalizeDefenseRoundStates([{
    ...question(1),
    answerStatus: 'partially_answered',
    currentQuestionCompletion: 50,
    isCurrentQuestionAnswered: false,
    unresolvedPoints: ['第一轮问题尚未完整回答'],
    roundScore: {}
  }], 5);
  const result = parseDefenseTurn(modelTurn({
    answeredQuestionIds: ['defense_round_1_question_1', 'defense_round_2_question_1'],
    delayedAnswerQuestionIds: ['defense_round_1_question_1'],
    isCurrentQuestionAnswered: true,
    answerStatus: 'fully_answered'
  }), {
    currentRound: 2,
    totalRounds: 5,
    currentQuestion: question(2),
    previousRounds,
    userAnswer: '先补充第一轮，再回应第二轮'
  });

  assert.equal(result.state.isDelayedAnswer, true);
  assert.equal(result.state.isCurrentQuestionAnswered, true);
  assert.deepEqual(result.state.delayedAnswerQuestionIds, ['defense_round_1_question_1']);
});

test('multiple missed rounds and last-round recovery cannot return to the high-score band', () => {
  const states = normalizeDefenseRoundStates([
    { ...question(1), answerStatus: 'fully_answered', currentQuestionCompletion: 88, isCurrentQuestionAnswered: true, roundScore: {} },
    { ...question(2), answerStatus: 'unanswered', currentQuestionCompletion: 0, isCurrentQuestionAnswered: false, roundScore: {} },
    { ...question(3), answerStatus: 'off_topic', currentQuestionCompletion: 25, isCurrentQuestionAnswered: false, isDelayedAnswer: true, delayedAnswerQuestionIds: ['defense_round_2_question_1'], roundScore: {} }
  ], 3);
  const result = calculateDefenseFinalScore(92, states, 3);

  assert.ok(result.score <= 49);
  assert.ok(result.roundAverage < 70);
});

test('invalid model JSON falls back conservatively instead of marking a full answer', () => {
  const result = parseDefenseTurn('无法解析的模型输出', {
    currentRound: 2,
    totalRounds: 5,
    currentQuestion: question(2),
    previousRounds: [],
    userAnswer: '一段无法校对的回答'
  });

  assert.equal(result.state.answerStatus, 'partially_answered');
  assert.equal(result.state.currentQuestionCompletion, 50);
  assert.equal(result.state.isCurrentQuestionAnswered, false);
  assert.ok(result.state.roundScore.total <= 79);
});

test('five-round continuous evasion keeps distinct questions and increasingly focused strategies', () => {
  let previousRounds = [];
  let currentQuestion = question(1, '为什么你的标准成立？');
  const generatedQuestions = new Set([currentQuestion.questionText]);

  for (let roundNumber = 1; roundNumber <= 4; roundNumber += 1) {
    const result = parseDefenseTurn(modelTurn({
      answerStatus: 'evaded',
      currentQuestionCompletion: 15,
      isCurrentQuestionAnswered: false,
      unresolvedPoints: [`第${roundNumber}轮核心依据仍未回答`],
      followUpStrategy: roundNumber < 3 ? 'narrow_question' : 'escalate',
      nextQuestion: question(roundNumber + 1, currentQuestion.questionText)
    }), {
      currentRound: roundNumber,
      totalRounds: 5,
      currentQuestion,
      previousRounds,
      userAnswer: '继续陈述己方背景，但不回答问题'
    });
    assert.equal(generatedQuestions.has(result.nextQuestion.questionText), false);
    generatedQuestions.add(result.nextQuestion.questionText);
    previousRounds = [...previousRounds, result.state];
    currentQuestion = result.nextQuestion;
  }

  assert.equal(previousRounds.length, 4);
  assert.ok(calculateDefenseFinalScore(88, previousRounds, 5).score <= 49);
});

test('a fully answered round changes to a new attack and carries no delayed marker', () => {
  const result = parseDefenseTurn(modelTurn({
    nextQuestion: question(2, '既然标准成立，你方方案为何优于对方方案？')
  }), {
    currentRound: 1,
    totalRounds: 3,
    currentQuestion: question(1, '为什么你的标准成立？'),
    previousRounds: [],
    userAnswer: '给出标准依据并完成论证'
  });

  assert.equal(result.state.answerStatus, 'fully_answered');
  assert.equal(result.state.isDelayedAnswer, false);
  assert.equal(result.state.followUpStrategy, 'new_attack');
  assert.match(result.nextQuestion.questionText, /优于对方方案/);
});
