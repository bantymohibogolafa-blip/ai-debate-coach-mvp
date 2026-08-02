import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyMandatoryScoreCaps,
  finalizeReviewScore,
  getScoreLevel,
  getScoringRubric
} from '../src/scoringRubrics.js';
import {
  calculateDefenseFinalScore,
  normalizeDefenseRoundStates,
  parseDefenseTurn,
  reconcileDefenseRoundStates
} from '../src/defenseTraining.js';
import { buildRespondMessages, buildStartMessages } from '../src/prompts.js';
import { CURRENT_SCORING_VERSION } from '../src/scoringVersions.js';

function dimensions(mode, score) {
  return getScoringRubric(mode).rubric.dimensions.map((dimension) => ({
    name: dimension.name,
    score,
    maxScore: 100,
    comment: '测试'
  }));
}

function state(roundNumber, answerStatus = 'fully_answered', componentScore = 90, extra = {}) {
  return {
    roundNumber,
    totalRounds: 5,
    questionId: `defense_round_${roundNumber}_question_1`,
    questionText: `第${roundNumber}轮问题`,
    userAnswer: `第${roundNumber}轮回答`,
    answerStatus,
    currentQuestionCompletion: answerStatus === 'fully_answered' ? componentScore : 60,
    isCurrentQuestionAnswered: answerStatus === 'fully_answered',
    roundScore: {
      contentQuality: componentScore,
      currentQuestionRelevance: componentScore,
      responseCompleteness: componentScore,
      timeliness: componentScore,
      defensiveEffectiveness: componentScore
    },
    ...extra
  };
}

test('realtime policies distinguish hard caps, advisory rules, and unknown codes', () => {
  for (const mode of ['free_debate', 'attack', 'defense']) {
    const rubric = getScoringRubric(mode).rubric;
    assert.equal(rubric.rubricVersion, 'realtime_v2');
    assert.equal(rubric.usesDifficulty, true);
    assert.ok(rubric.capRules.some((rule) => rule.enforcement === 'hard'));
    assert.ok(rubric.capRules.some((rule) => rule.enforcement === 'advisory'));
  }

  const rubric = getScoringRubric('defense').rubric;
  const hardCode = rubric.capRules.find((rule) => rule.enforcement === 'hard' && !['off_task', 'stance_reversal'].includes(rule.code)).code;
  const advisoryCode = rubric.capRules.find((rule) => rule.enforcement === 'advisory').code;
  const result = applyMandatoryScoreCaps(91, [hardCode, advisoryCode, 'invented_cap'], rubric);
  assert.ok(result.score < 91);
  assert.equal(result.hardCapCandidates.some((item) => item.code === hardCode), true);
  assert.equal(result.advisoryTriggers.some((item) => item.code === advisoryCode), true);
  assert.equal(result.acceptedTriggers.includes('invented_cap'), false);
});

test('stance reversal is explicitly configured and enforced as a 30 point cap', () => {
  for (const mode of ['free_debate', 'attack', 'defense']) {
    const rubric = getScoringRubric(mode).rubric;
    const rule = rubric.capRules.find((item) => item.code === 'stance_reversal');
    assert.equal(rule.maxScore, 30);
    assert.equal(rule.enforcement, 'hard');
    assert.equal(applyMandatoryScoreCaps(91, ['stance_reversal'], rubric).score, 30);
  }
});

test('interactive and text modes use their own seven score bands', () => {
  const realtimeExpected = new Map([[49, '严重失效'], [50, '明显不足'], [65, '基本完成'], [75, '校赛可用'], [85, '明显优秀'], [90, '高水平校队'], [95, '接近理想']]);
  for (const mode of ['free_debate', 'attack', 'defense']) {
    for (const [score, label] of realtimeExpected) assert.equal(getScoreLevel(score, mode), label);
  }
  assert.equal(getScoreLevel(49, 'constructive'), '严重失效');
  assert.equal(getScoreLevel(50, 'constructive'), '明显不完整');
  assert.equal(getScoreLevel(60, 'constructive'), '基础成立');
  assert.equal(getScoreLevel(70, 'constructive'), '合格可用');
  assert.equal(getScoreLevel(80, 'constructive'), '良好');
  assert.equal(getScoreLevel(90, 'constructive'), '优秀');
  assert.equal(getScoreLevel(95, 'constructive'), '卓越');
});

test('defense reconciliation scores exactly the one to five completed rounds', () => {
  for (let completedRounds = 1; completedRounds <= 5; completedRounds += 1) {
    const provided = Array.from({ length: completedRounds }, (_, index) => state(index + 1));
    const reconciled = reconcileDefenseRoundStates(provided, { plannedRounds: 5, completedRounds });
    assert.equal(reconciled.states.length, completedRounds);
    assert.equal(reconciled.completedRounds, completedRounds);
    assert.equal(reconciled.states.some((item) => item.answerStatus === 'unanswered'), false);
  }
  assert.equal(normalizeDefenseRoundStates([state(1), state(2)], 2).length, 2);
  assert.equal(normalizeDefenseRoundStates([state(1), state(2), state(3), state(4)], 4).length, 4);
});

test('missing completed states are conservatively filled and future states are truncated', () => {
  const missing = reconcileDefenseRoundStates([state(1), state(2)], { plannedRounds: 5, completedRounds: 3 });
  assert.equal(missing.states.length, 3);
  assert.equal(missing.states[2].answerStatus, 'partially_answered');
  assert.equal(missing.states[2].isCurrentQuestionAnswered, false);
  assert.match(missing.dataIntegrityWarning, /缺少/);

  const extra = reconcileDefenseRoundStates([state(1), state(2), state(3), state(4)], { plannedRounds: 5, completedRounds: 2 });
  assert.equal(extra.states.length, 2);
  assert.match(extra.dataIntegrityWarning, /多于|多余/);
});

test('contradictory fully answered state is downgraded and component caps are deterministic', () => {
  const [normalized] = normalizeDefenseRoundStates([state(1, 'fully_answered', 100, {
    currentQuestionCompletion: 20,
    isCurrentQuestionAnswered: false
  })], 1);
  assert.equal(normalized.answerStatus, 'partially_answered');
  assert.equal(normalized.isCurrentQuestionAnswered, false);
  assert.ok(normalized.roundScore.currentQuestionRelevance <= 35);
  assert.ok(normalized.roundScore.timeliness <= 20);
  assert.ok(normalized.roundScore.defensiveEffectiveness <= 35);
  assert.ok(normalized.roundScore.total < 80);
});

test('delayed recovery accepts only one valid unresolved historical question', () => {
  const previous = [
    state(1, 'partially_answered', 50, { unresolvedPoints: ['历史问题'] }),
    state(2, 'fully_answered', 90)
  ];
  const previousSnapshot = structuredClone(previous);
  const parsed = parseDefenseTurn(JSON.stringify({
    answerStatus: 'partially_answered',
    currentQuestionCompletion: 50,
    isCurrentQuestionAnswered: false,
    delayedAnswerQuestionIds: [
      'defense_round_1_question_1',
      'defense_round_2_question_1',
      'defense_round_3_question_1',
      'defense_round_5_question_1',
      'unknown'
    ],
    roundScore: { contentQuality: 100, currentQuestionRelevance: 100, responseCompleteness: 100, timeliness: 100, defensiveEffectiveness: 100 }
  }), {
    currentRound: 3,
    totalRounds: 5,
    currentQuestion: { roundNumber: 3, questionId: 'defense_round_3_question_1', questionText: '当前问题' },
    previousRounds: previous,
    userAnswer: '先补答历史问题，但仍未完整回答当前问题'
  });
  assert.deepEqual(parsed.state.delayedAnswerQuestionIds, ['defense_round_1_question_1']);
  assert.equal(parsed.state.isCurrentQuestionAnswered, false);
  assert.ok(parsed.state.roundScore.delayedRecoveryCredit <= 2.25);
  assert.ok(parsed.state.roundScore.total <= 79);
  assert.deepEqual(previous, previousSnapshot);

  const repeated = parseDefenseTurn(JSON.stringify({
    answerStatus: 'partially_answered', currentQuestionCompletion: 50, isCurrentQuestionAnswered: false,
    delayedAnswerQuestionIds: ['defense_round_1_question_1']
  }), {
    currentRound: 4,
    totalRounds: 5,
    currentQuestion: { roundNumber: 4, questionId: 'defense_round_4_question_1', questionText: '第四轮' },
    previousRounds: [...previous, parsed.state],
    userAnswer: '再次补答'
  });
  assert.deepEqual(repeated.state.delayedAnswerQuestionIds, []);
});

test('cross-round partial caps and the formal 30 point floor are applied', () => {
  for (const count of [2, 3]) {
    const result = finalizeReviewScore({
      trainingMode: 'defense', dimensionScores: dimensions('defense', 95),
      defenseRoundStates: Array.from({ length: count }, (_, index) => state(index + 1, 'partially_answered', 79)),
      plannedRounds: count, completedRounds: count
    });
    assert.ok(result.finalScore <= 79);
  }

  const majorityIncomplete = calculateDefenseFinalScore(95, [
    state(1), state(2), state(3, 'partially_answered', 79), state(4, 'partially_answered', 79), state(5, 'partially_answered', 79)
  ], 5);
  assert.ok(majorityIncomplete.score <= 84);

  const floor = finalizeReviewScore({
    trainingMode: 'defense', dimensionScores: dimensions('defense', 30),
    defenseRoundStates: [state(1, 'unanswered', 0)], plannedRounds: 5, completedRounds: 1
  });
  assert.ok(floor.blendedScore < 30);
  assert.equal(floor.finalScore, 30);
});

test('text training prompts have no difficulty semantics while realtime modes retain them', () => {
  const base = { topic: '测试辩题', userSide: 'affirmative', aiSide: 'negative', celebrityDebater: 'none', rounds: 1, history: [{ role: 'user', content: '测试回答' }], answer: '测试回答' };
  for (const mode of ['constructive', 'summary', 'closing']) {
    const prompts = ['novice', 'campus', 'city'].map((difficulty) => JSON.stringify(buildStartMessages({ ...base, trainingMode: mode, difficulty })));
    assert.equal(prompts[0], prompts[1]);
    assert.equal(prompts[1], prompts[2]);
    assert.doesNotMatch(prompts[0], /当前为新手模式|当前为校赛模式|当前为市赛模式|难度固定为市赛/);
    const celebrity = JSON.stringify(buildStartMessages({ ...base, trainingMode: mode, difficulty: 'novice', celebrityDebater: 'ma_weiwei_style' }));
    assert.doesNotMatch(celebrity, /难度固定为市赛/);
  }
  for (const mode of ['free_debate', 'attack', 'defense']) {
    const novice = JSON.stringify(buildRespondMessages({ ...base, trainingMode: mode, difficulty: 'novice', defenseRoundStates: [], currentDefenseQuestion: {}, defensePrep: '准备', freeDebatePrep: '论点' }));
    const city = JSON.stringify(buildRespondMessages({ ...base, trainingMode: mode, difficulty: 'city', defenseRoundStates: [], currentDefenseQuestion: {}, defensePrep: '准备', freeDebatePrep: '论点' }));
    assert.notEqual(novice, city);
  }
});

test('the scoring policy version is advanced without changing text rubric version', () => {
  assert.equal(CURRENT_SCORING_VERSION, 'scoring_v4');
  assert.equal(getScoringRubric('defense').rubric.rubricVersion, 'realtime_v2');
  assert.equal(getScoringRubric('constructive').rubric.rubricVersion, 'text_v2');
});
