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
  closing: [32, 21, 27, 15, 5]
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

test('campus calibration fixtures retain useful separation', () => {
  const { rubric } = getScoringRubric('defense');
  const ordinaryCampus = calculateWeightedScore(scoresFor('defense', [80, 78, 76, 75, 82]), rubric);
  const excellentCampus = calculateWeightedScore(scoresFor('defense', [91, 88, 89, 86, 87]), rubric);
  const highLevelTeam = calculateWeightedScore(scoresFor('defense', [94, 92, 93, 91, 90]), rubric);

  assert.equal(ordinaryCampus.score, 77.8);
  assert.equal(excellentCampus.score, 88.7);
  assert.equal(highLevelTeam.score, 92.6);
  assert.ok(ordinaryCampus.score >= 75 && ordinaryCampus.score <= 82);
  assert.ok(excellentCampus.score >= 85 && excellentCampus.score <= 91);
  assert.ok(highLevelTeam.score >= 90 && highLevelTeam.score <= 95);
});

test('score level is always regenerated from the deterministic final score', () => {
  assert.equal(getScoreLevel(83.5), '优势压制区');
  assert.equal(getScoreLevel(92.6), '大师致胜区');
});

test('review prompt asks only for dimensions and contains the relaxed campus and fifth-dimension anchors', () => {
  const prompt = buildReviewRubricInstruction('defense', 'campus');

  assert.match(prompt, /不要输出 score 和 scoreLevel/);
  assert.match(prompt, /校赛90分不代表全国总决赛大师/);
  assert.match(prompt, /表达稍长不等于表达低效/);
  assert.match(prompt, /正面回应能力：权重 27%/);
  assert.match(prompt, /表达效率与稳定性：权重 5%/);
  assert.equal(Object.keys(scoringRubrics).length, 6);
});
