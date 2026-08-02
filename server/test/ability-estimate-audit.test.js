import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildAbilityEstimate,
  calculateProjectedOverall,
  calculatePackageWeightedAverage,
  projectAbilityDimensions
} from '../src/abilityProfile.js';
import {
  calculateWeightedScore,
  getScoringRubric
} from '../src/scoringRubrics.js';

function dimensionScores(mode, score, overrides = {}) {
  return getScoringRubric(mode).rubric.dimensions.map((dimension, index) => ({
    name: dimension.name,
    score: Array.isArray(score) ? score[index] : score,
    maxScore: 100,
    ...overrides
  }));
}

function abilityRecord(id, mode, score, createdAt, difficulty = '') {
  return {
    id,
    training_mode: mode,
    difficulty,
    score,
    created_at: createdAt,
    dimension_scores: dimensionScores(mode, score)
  };
}

test('a genuine zero remains a valid raw dimension score instead of becoming missing', () => {
  const rubric = getScoringRubric('defense').rubric;
  const weighted = calculateWeightedScore(dimensionScores('defense', 0), rubric);
  const estimate = buildAbilityEstimate([{
    ...abilityRecord('zero', 'defense', 30, '2026-01-01T00:00:00.000Z'),
    dimension_scores: dimensionScores('defense', 0)
  }]);

  assert.deepEqual(weighted.dimensionScores.map((dimension) => dimension.score), [0, 0, 0, 0, 0]);
  assert.equal(weighted.score, 30, 'the current total-score floor is 30 even when every raw dimension is zero');
  assert.equal(estimate.dimensions.find((dimension) => dimension.key === 'defenseStability').score, 0);
});

test('a non-applicable ability stays null and does not create a zero-valued update', () => {
  const estimate = buildAbilityEstimate([
    abilityRecord('constructive', 'constructive', 80, '2026-01-01T00:00:00.000Z')
  ]);

  assert.equal(estimate.dimensions.find((dimension) => dimension.key === 'defenseStability').score, null);
  assert.equal(estimate.history[0].dimensions.defenseStability, null);
});

test('an AI response missing one of the five dimensions is rejected', () => {
  const rubric = getScoringRubric('attack').rubric;
  assert.throws(
    () => calculateWeightedScore(dimensionScores('attack', 75).slice(0, 4), rubric),
    (error) => error.code === 'SCORING_DIMENSIONS_INVALID'
  );
});

test('an illegal dimension string is rejected instead of becoming zero', () => {
  const rubric = getScoringRubric('defense').rubric;
  const scores = dimensionScores('defense', 75);
  scores[2].score = 'not-a-score';

  assert.throws(
    () => calculateWeightedScore(scores, rubric),
    (error) => error.code === 'SCORING_DIMENSIONS_INVALID'
  );
});

test('a complete but wrong AI field name is rejected rather than matched by array position', () => {
  const rubric = getScoringRubric('defense').rubric;
  const scores = dimensionScores('defense', 75);
  scores[2].name = '不存在的评分字段';

  assert.throws(
    () => calculateWeightedScore(scores, rubric),
    (error) => error.code === 'SCORING_DIMENSIONS_INVALID'
  );
});

test('an extra sixth AI dimension is rejected instead of being silently ignored', () => {
  const rubric = getScoringRubric('defense').rubric;
  const scores = [
    ...dimensionScores('defense', 75),
    { name: '额外字段', score: 99, maxScore: 100 }
  ];

  assert.throws(
    () => calculateWeightedScore(scores, rubric),
    (error) => error.code === 'SCORING_DIMENSIONS_INVALID'
  );
});

test('legacy weighted subscores are normalized by maxScore before ability projection', () => {
  const legacyRecord = {
    id: 'legacy-72',
    score: 72,
    created_at: '2026-05-23T00:00:00.000Z',
    training_mode: 'free_debate',
    difficulty: 'city',
    dimension_scores: [
      { name: '战场识别与控制', score: 22, maxScore: 30 },
      { name: '临场回应与反击', score: 18, maxScore: 25 },
      { name: '逻辑推进与攻守转换', score: 14, maxScore: 20 },
      { name: '表达效率与节奏感', score: 12, maxScore: 15 },
      { name: '团队协同与战术意识', score: 6, maxScore: 10 }
    ]
  };
  const projected = projectAbilityDimensions(legacyRecord);
  const estimate = buildAbilityEstimate([legacyRecord]);

  assert.equal(projected.logic, 70);
  assert.equal(projected.defenseStability, 72);
  assert.equal(projected.expression, 80);
  assertClose(projected.counterPressure, 70.22608695652174);
  assertClose(projected.battlefieldControl, 71.80520570948782);
  assert.equal(estimate.overall, 74.8, 'legacy names and maxScore normalization must feed the v4 projection');
});

test('all six modes leave genuinely non-evaluated abilities absent', () => {
  const expected = {
    constructive: ['battlefieldControl', 'expression', 'logic'],
    summary: ['battlefieldControl', 'counterPressure', 'expression', 'logic'],
    free_debate: ['battlefieldControl', 'counterPressure', 'defenseStability', 'expression', 'logic'],
    attack: ['battlefieldControl', 'counterPressure', 'expression', 'logic'],
    defense: ['counterPressure', 'defenseStability', 'expression', 'logic'],
    closing: ['battlefieldControl', 'expression', 'logic']
  };

  for (const [mode, keys] of Object.entries(expected)) {
    assert.deepEqual(
      Object.keys(projectAbilityDimensions({
        training_mode: mode,
        dimension_scores: dimensionScores(mode, 75)
      })).sort(),
      [...keys].sort()
    );
  }
});

test('difficulty calibration uses the projected score after projection', () => {
  const base = {
    id: 'difficulty',
    training_mode: 'defense',
    score: 70,
    created_at: '2026-01-01T00:00:00.000Z',
    dimension_scores: dimensionScores('defense', 70)
  };

  const novice = buildAbilityEstimate([{ ...base, difficulty: 'novice' }]);
  const campus = buildAbilityEstimate([{ ...base, difficulty: 'campus' }]);
  const city = buildAbilityEstimate([{ ...base, difficulty: 'city' }]);
  assert.equal(novice.dimensions.find((dimension) => dimension.key === 'logic').score, 69);
  assert.equal(campus.dimensions.find((dimension) => dimension.key === 'logic').score, 70);
  assert.equal(city.dimensions.find((dimension) => dimension.key === 'logic').score, 72);
});

test('an extreme score is accepted without outlier filtering and receives normal exponential weight', () => {
  const expected = calculatePackageWeightedAverage([70, 72, 100]);
  const estimate = buildAbilityEstimate([
    abilityRecord('normal-1', 'constructive', 70, '2026-01-01T00:00:00.000Z'),
    abilityRecord('normal-2', 'constructive', 72, '2026-01-02T00:00:00.000Z'),
    abilityRecord('outlier', 'constructive', 100, '2026-01-03T00:00:00.000Z')
  ]);

  assert.equal(estimate.dimensions.find((dimension) => dimension.key === 'logic').score, Math.round(expected * 10) / 10);
});

test('one valid record immediately produces a one-decimal estimate with no minimum-sample gate', () => {
  const estimate = buildAbilityEstimate([
    abilityRecord('single', 'constructive', 83.7, '2026-01-01T00:00:00.000Z')
  ]);

  assert.equal(estimate.scoredRecordCount, 1);
  assert.equal(estimate.overall, 83.7);
  assert.equal(estimate.dimensions.find((dimension) => dimension.key === 'logic').records, 1);
});

test('all effective raw scores can be zero while the stored-style total remains 30', () => {
  const estimate = buildAbilityEstimate([{
    ...abilityRecord('all-zero', 'free_debate', 30, '2026-01-01T00:00:00.000Z'),
    dimension_scores: dimensionScores('free_debate', 0)
  }]);

  assert.equal(estimate.overall, 0);
  assert.equal(estimate.dimensions.every((dimension) => dimension.score === 0), true);
});

test('records whose dimensions are all null do not enter the ability estimate', () => {
  const estimate = buildAbilityEstimate([{
    ...abilityRecord('all-null', 'defense', 70, '2026-01-01T00:00:00.000Z'),
    dimension_scores: dimensionScores('defense', null)
  }]);

  assert.equal(estimate.scoredRecordCount, 0);
  assert.equal(estimate.overall, null);
});

test('a rubric whose weights do not sum to 100 is rejected', () => {
  const rubric = structuredClone(getScoringRubric('defense').rubric);
  rubric.dimensions[0].maxScore -= 1;

  assert.throws(
    () => calculateWeightedScore(dimensionScores('defense', 75), rubric),
    (error) => error.code === 'SCORING_DIMENSIONS_INVALID' && /权重/.test(error.message)
  );
});

test('a composite ability renormalizes over present subdimensions instead of filling missing children with zero', () => {
  const projected = projectAbilityDimensions({
    training_mode: 'constructive',
    dimension_scores: [
      { name: '辩题理解与定义判准', score: 90, maxScore: 100 }
    ]
  });

  assert.deepEqual(projected, {
    logic: 90,
    battlefieldControl: 90
  });
});

test('history source keeps training total, single-record projections and post-history overall separate', () => {
  const prior = abilityRecord('prior', 'attack', 40, '2026-01-01T00:00:00.000Z');
  const current = {
    ...abilityRecord('current', 'attack', 76, '2026-01-02T00:00:00.000Z'),
    dimension_scores: dimensionScores('attack', [90, 70, 60, 80, 50]),
    scoring_version: 'scoring_v3',
    rubric_id: 'offensive_cx',
    projection_version: 'ability_projection_v3',
    difficulty_calibration_version: 'difficulty_bonus_v1',
    estimator_version: 'ability_estimator_v3'
  };
  const projectedScores = projectAbilityDimensions(current);
  const expectedProjectedOverall = calculateProjectedOverall(projectedScores);
  const point = buildAbilityEstimate([prior, current]).history.at(-1);

  assert.equal(point.source.score, 76);
  assert.deepEqual(point.source.projectedScores, Object.fromEntries(
    Object.entries(projectedScores).map(([key, value]) => [key, Math.round(value * 10) / 10])
  ));
  assert.equal(point.source.projectedOverall, Math.round(expectedProjectedOverall * 10) / 10);
  assert.notEqual(point.overall, point.source.projectedOverall);
  assert.equal(point.source.scoringVersion, 'scoring_v3');
});

function assertClose(actual, expected, tolerance = 1e-10) {
  assert.equal(
    Math.abs(actual - expected) <= tolerance,
    true,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );
}
