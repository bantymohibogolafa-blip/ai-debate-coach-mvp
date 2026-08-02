import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyMandatoryScoreCaps,
  buildReviewRubricInstruction,
  calculateWeightedScore,
  finalizeReviewScore,
  getScoreLevel,
  getScoringRubric,
  scoringRubrics
} from '../src/scoringRubrics.js';

const modes = ['constructive', 'summary', 'free_debate', 'attack', 'defense', 'closing'];
const expectedWeights = {
  constructive: [15, 20, 30, 20, 15],
  summary: [20, 25, 30, 20, 5],
  free_debate: [32, 27, 21, 15, 5],
  attack: [26, 26, 20, 19, 9],
  defense: [27, 27, 26, 15, 5],
  closing: [20, 25, 25, 20, 10]
};

function scoresFor(mode, scores) {
  const { rubric } = getScoringRubric(mode);
  return rubric.dimensions.map((dimension, index) => ({
    name: dimension.name,
    score: scores[index],
    maxScore: 100,
    comment: `维度 ${index + 1}`
  }));
}

test('all six rubrics sum to 100 and use the approved realtime weights', () => {
  for (const mode of modes) {
    const { rubric } = getScoringRubric(mode);
    assert.equal(rubric.dimensions.length, 5, mode);
    assert.deepEqual(rubric.dimensions.map((dimension) => dimension.maxScore), expectedWeights[mode], mode);
    assert.equal(rubric.dimensions.reduce((sum, dimension) => sum + dimension.maxScore, 0), 100, mode);
    const expectedFifth = mode === 'attack' ? 9 : mode === 'constructive' ? 15 : mode === 'closing' ? 10 : 5;
    assert.equal(rubric.dimensions[4].maxScore, expectedFifth, mode);
  }
});

test('defense sample uses 27/27/26/15/5 instead of an equal average', () => {
  const { rubric } = getScoringRubric('defense');
  const result = calculateWeightedScore(scoresFor('defense', [88, 82.5, 85, 78, 73]), rubric);

  assert.deepEqual(rubric.dimensions.map((dimension) => dimension.maxScore), [27, 27, 26, 15, 5]);
  assert.equal(result.score, 83.5);
  assert.notEqual(result.score, 81.3);
});

test('the fifth dimension can change the final score by at most five points', () => {
  const { rubric } = getScoringRubric('defense');
  const lowExpression = calculateWeightedScore(scoresFor('defense', [90, 90, 90, 90, 0]), rubric);
  const highExpression = calculateWeightedScore(scoresFor('defense', [90, 90, 90, 90, 100]), rubric);

  assert.equal(lowExpression.score, 85.5);
  assert.equal(highExpression.score, 90.5);
  assert.equal(highExpression.score - lowExpression.score, 5);
});

test('matches dimensions by name when the model changes their order', () => {
  const { rubric } = getScoringRubric('defense');
  const ordered = scoresFor('defense', [88, 82.5, 85, 78, 73]);
  const shuffled = [ordered[4], ordered[2], ordered[0], ordered[3], ordered[1]];

  const result = calculateWeightedScore(shuffled, rubric);

  assert.equal(result.score, 83.5);
  assert.deepEqual(result.dimensionScores.map((dimension) => dimension.name), rubric.dimensions.map((dimension) => dimension.name));
});

test('rejects duplicate dimension names deterministically', () => {
  const { rubric } = getScoringRubric('defense');
  const dimensions = scoresFor('defense', [88, 82.5, 85, 78, 73]);
  dimensions[4].name = dimensions[0].name;

  assert.throws(
    () => calculateWeightedScore(dimensions, rubric),
    (error) => error.code === 'SCORING_DIMENSIONS_INVALID' && /重复/.test(error.message)
  );
});

test('rejects missing dimensions with an explicit scoring error', () => {
  const { rubric } = getScoringRubric('attack');

  assert.throws(
    () => calculateWeightedScore(scoresFor('attack', [80, 80, 80, 80, 80]).slice(0, 4), rubric),
    (error) => error.code === 'SCORING_DIMENSIONS_INVALID' && /缺失/.test(error.message)
  );
});

test('clamps dimension scores to 0-100 and the final score to 30-100', () => {
  const { rubric } = getScoringRubric('defense');
  const high = calculateWeightedScore(scoresFor('defense', [120, 110, 105, 101, 150]), rubric);
  const low = calculateWeightedScore(scoresFor('defense', [-10, -20, -30, -40, -50]), rubric);

  assert.equal(high.score, 100);
  assert.deepEqual(high.dimensionScores.map((dimension) => dimension.score), [100, 100, 100, 100, 100]);
  assert.equal(low.score, 30);
  assert.deepEqual(low.dimensionScores.map((dimension) => dimension.score), [0, 0, 0, 0, 0]);
});

test('four calibration levels remain separated across all three difficulties', () => {
  const { rubric } = getScoringRubric('defense');
  const fixtures = {
    basic: {
      novice: { scores: [75, 73, 72, 70, 76], range: [68, 78] },
      campus: { scores: [67, 65, 64, 62, 68], range: [60, 70] },
      city: { scores: [60, 58, 56, 55, 61], range: [52, 64] }
    },
    ordinary: {
      novice: { scores: [88, 86, 85, 83, 88], range: [82, 90] },
      campus: { scores: [82, 80, 78, 77, 82], range: [75, 84] },
      city: { scores: [76, 74, 72, 71, 75], range: [69, 79] }
    },
    excellent: {
      novice: { scores: [96, 94, 95, 92, 94], range: [91, 97] },
      campus: { scores: [91, 89, 90, 87, 89], range: [85, 92] },
      city: { scores: [87, 85, 86, 83, 84], range: [81, 89] }
    },
    highLevel: {
      novice: { scores: [99, 98, 99, 97, 98], range: [96, 100] },
      campus: { scores: [93, 91, 94, 90, 88], range: [90, 96] },
      city: { scores: [92, 90, 91, 88, 87], range: [88, 94] }
    }
  };

  for (const [level, difficulties] of Object.entries(fixtures)) {
    for (const [difficulty, fixture] of Object.entries(difficulties)) {
      const result = calculateWeightedScore(scoresFor('defense', fixture.scores), rubric);
      assert.ok(
        result.score >= fixture.range[0] && result.score <= fixture.range[1],
        `${level}/${difficulty}: ${result.score}`
      );
    }
  }

  const defenseCalibrationSample = calculateWeightedScore(scoresFor('defense', [93, 91, 94, 90, 88]), rubric);
  assert.equal(defenseCalibrationSample.score, 92);
  assert.ok(defenseCalibrationSample.score >= 90 && defenseCalibrationSample.score <= 93);
});

test('score level is always regenerated from the deterministic final score', () => {
  assert.equal(getScoreLevel(83.5), '校赛可用');
  assert.equal(getScoreLevel(92.6), '高水平校队');
});

test('interactive review prompt keeps difficulty calibration and backend authority explicit', () => {
  const prompt = buildReviewRubricInstruction('defense', 'campus');

  assert.match(prompt, /score 和 scoreLevel 仅为兼容字段/);
  assert.match(prompt, /后端会忽略并根据五维权重重新生成/);
  assert.match(prompt, /本交互模式保留难度校准/);
  assert.match(prompt, /当前为校赛模式/);
  assert.match(prompt, /表达稍长不等于表达低效/);
  assert.match(prompt, /“可以更精炼”通常对应85-92/);
  assert.match(prompt, /正面回应能力：权重 27%/);
  assert.match(prompt, /capTriggers/);
  assert.equal(Object.keys(scoringRubrics).length, 6);
});

test('free debate uses observable tactical judgment instead of team coordination', () => {
  const { rubric } = getScoringRubric('free_debate');
  const prompt = buildReviewRubricInstruction('free_debate', 'campus');

  assert.equal(rubric.dimensions[4].name, '战术选择与临场判断');
  assert.equal(rubric.dimensions.some((dimension) => dimension.name === '团队协同与战术意识'), false);
  assert.match(prompt, /不得因无法观察团队协同而扣分/);
  assert.match(prompt, /知道何时回应、切割、反打和结算/);
});

test('difficulty is isolated from text V2 but retained for interactive modes', () => {
  const novice = buildReviewRubricInstruction('constructive', 'novice');
  const campus = buildReviewRubricInstruction('constructive', 'campus');
  const city = buildReviewRubricInstruction('constructive', 'city');

  assert.equal(novice, campus);
  assert.equal(campus, city);
  assert.match(novice, /唯一的绝对评分标准/);

  assert.notEqual(buildReviewRubricInstruction('defense', 'novice'), buildReviewRubricInstruction('defense', 'city'));
});

test('mandatory score caps are applied after weighted scoring', () => {
  const offTask = applyMandatoryScoreCaps(91.3, ['off_task']);
  assert.equal(offTask.score, 40);
  assert.equal(offTask.appliedCap, 40);
  assert.deepEqual(offTask.acceptedTriggers, ['off_task']);
  assert.deepEqual(offTask.reasons, ['多数关键回合未回应当前模式核心任务']);

  const multiple = applyMandatoryScoreCaps(91.3, ['off_task', 'stance_reversal']);
  assert.equal(multiple.score, 30);
  assert.equal(multiple.appliedCap, 30);
  assert.deepEqual(multiple.acceptedTriggers, ['off_task', 'stance_reversal']);
});

function defenseRoundState(roundNumber, status = 'fully_answered', componentScore = 90) {
  return {
    roundNumber,
    questionId: `defense_round_${roundNumber}_question_1`,
    questionText: `第${roundNumber}轮问题`,
    userAnswer: `第${roundNumber}轮回答`,
    answerStatus: status,
    currentQuestionCompletion: status === 'fully_answered' ? componentScore : 0,
    isCurrentQuestionAnswered: status === 'fully_answered',
    roundScore: {
      contentQuality: componentScore,
      currentQuestionRelevance: componentScore,
      responseCompleteness: componentScore,
      timeliness: componentScore,
      defensiveEffectiveness: componentScore
    }
  };
}

test('defense final score is the lowest result across round and mandatory caps', () => {
  const dimensions = scoresFor('defense', [90, 90, 90, 90, 90]);
  const roundCapped = finalizeReviewScore({
    trainingMode: 'defense',
    dimensionScores: dimensions,
    rounds: 3,
    defenseRoundStates: [
      defenseRoundState(1),
      defenseRoundState(2, 'unanswered', 0),
      defenseRoundState(3, 'off_topic', 0)
    ]
  });
  assert.equal(roundCapped.rawScore, 90);
  assert.equal(roundCapped.finalScore, 49);
  assert.equal(roundCapped.scoreLevel, getScoreLevel(49, 'defense'));

  const taskCapped = finalizeReviewScore({
    trainingMode: 'defense',
    dimensionScores: dimensions,
    capTriggers: ['off_task'],
    rounds: 3,
    defenseRoundStates: [defenseRoundState(1), defenseRoundState(2), defenseRoundState(3)]
  });
  assert.equal(taskCapped.blendedScore, 90);
  assert.equal(taskCapped.finalScore, 40, 'a later defense blend cannot lift an off_task cap');

  const multipleCaps = finalizeReviewScore({
    trainingMode: 'defense',
    dimensionScores: dimensions,
    capTriggers: ['off_task', 'stance_reversal'],
    rounds: 3,
    defenseRoundStates: [
      defenseRoundState(1),
      defenseRoundState(2, 'unanswered', 0),
      defenseRoundState(3, 'off_topic', 0)
    ]
  });
  assert.equal(multipleCaps.finalScore, 30, 'the existing lowest general cap remains authoritative');
});

test('uncapped defense preserves the 55/45 blend as the final score', () => {
  const result = finalizeReviewScore({
    trainingMode: 'defense',
    dimensionScores: scoresFor('defense', [88, 88, 88, 88, 88]),
    rounds: 3,
    defenseRoundStates: [
      defenseRoundState(1, 'fully_answered', 80),
      defenseRoundState(2, 'fully_answered', 80),
      defenseRoundState(3, 'fully_answered', 80)
    ]
  });
  assert.equal(result.rawScore, 88);
  assert.equal(result.blendedScore, 84.4);
  assert.equal(result.finalScore, 84.4);
});

test('text V2 has seven levels, mode-specific anchors and lowest-cap semantics', () => {
  for (const mode of ['constructive', 'summary', 'closing']) {
    const { rubric } = getScoringRubric(mode);
    assert.equal(rubric.rubricVersion, 'text_v2');
    assert.equal(rubric.usesDifficulty, false);
    assert.equal(Object.keys(rubric.dimensionAnchors).length, 5);
    assert.ok(Object.values(rubric.dimensionAnchors).every((items) => items.length === 7));
  }

  assert.equal(getScoreLevel(49, 'constructive'), '严重失效');
  assert.equal(getScoreLevel(50, 'constructive'), '明显不完整');
  assert.equal(getScoreLevel(60, 'constructive'), '基础成立');
  assert.equal(getScoreLevel(70, 'constructive'), '合格可用');
  assert.equal(getScoreLevel(80, 'constructive'), '良好');
  assert.equal(getScoreLevel(90, 'constructive'), '优秀');
  assert.equal(getScoreLevel(95, 'constructive'), '卓越');

  const rubric = getScoringRubric('constructive').rubric;
  const capped = applyMandatoryScoreCaps(92, ['core_logic_invalid', 'wrong_or_missing_stance'], rubric);
  assert.equal(capped.score, 49);
  assert.equal(capped.hardCapCandidates.length, 1);
  assert.equal(capped.advisoryTriggers.length, 1);
  assert.equal(applyMandatoryScoreCaps(92, ['core_logic_invalid'], rubric).score, 92);
  assert.equal(applyMandatoryScoreCaps(82, [], rubric).score, 82);
});
