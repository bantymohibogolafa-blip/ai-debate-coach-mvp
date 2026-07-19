import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildReviewRubricInstruction,
  calculateWeightedScore,
  getScoreLevel,
  getScoringRubric,
  scoringRubrics
} from '../src/scoringRubrics.js';

const modes = ['constructive', 'summary', 'free_debate', 'attack', 'defense', 'closing'];
const expectedWeights = {
  constructive: [27, 32, 21, 15, 5],
  summary: [27, 32, 21, 15, 5],
  free_debate: [32, 27, 21, 15, 5],
  attack: [27, 27, 21, 20, 5],
  defense: [27, 27, 26, 15, 5],
  closing: [32, 18, 30, 15, 5]
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

test('all six rubrics sum to 100 and assign only 5 percent to the fifth dimension', () => {
  for (const mode of modes) {
    const { rubric } = getScoringRubric(mode);
    assert.equal(rubric.dimensions.length, 5, mode);
    assert.deepEqual(rubric.dimensions.map((dimension) => dimension.maxScore), expectedWeights[mode], mode);
    assert.equal(rubric.dimensions.reduce((sum, dimension) => sum + dimension.maxScore, 0), 100, mode);
    assert.equal(rubric.dimensions[4].maxScore, 5, mode);
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
  assert.equal(getScoreLevel(83.5), '优势压制区');
  assert.equal(getScoreLevel(92.6), '大师致胜区');
});

test('review prompt keeps compatible score fields but makes backend authority explicit', () => {
  const prompt = buildReviewRubricInstruction('defense', 'campus');

  assert.match(prompt, /score 和 scoreLevel 仅为兼容字段/);
  assert.match(prompt, /后端会忽略并根据五维权重重新生成/);
  assert.match(prompt, /校赛90分不代表全国总决赛大师/);
  assert.match(prompt, /表达稍长不等于表达低效/);
  assert.match(prompt, /“可以更精炼”通常对应85-92/);
  assert.match(prompt, /正面回应能力：权重 27%/);
  assert.match(prompt, /表达效率与稳定性：权重 5%/);
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

test('three difficulty prompts use independent anchors rather than fixed score shifts', () => {
  const novice = buildReviewRubricInstruction('defense', 'novice');
  const campus = buildReviewRubricInstruction('defense', 'campus');
  const city = buildReviewRubricInstruction('defense', 'city');

  assert.match(novice, /新手难度/);
  assert.match(novice, /不得按“校赛固定加10-15分”机械换算/);
  assert.match(campus, /不得根据新手或市赛分数做固定平移/);
  assert.match(city, /不得按“校赛固定减10-15分”机械换算/);
  assert.match(city, /89-93表示高水平市赛或强校队表现/);
});
