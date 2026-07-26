import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ABILITY_STAGE_GAP_MS,
  abilityDimensions,
  abilityModeProjection,
  buildAbilityEstimate,
  buildPackageWeightDebug,
  calculateAbilityProfile,
  calculateDimensionProfile,
  calculatePackageAlpha,
  calculatePackageWeightedAverage,
  projectAbilityDimensions
} from '../src/abilityProfile.js';
import { getScoringRubric } from '../src/scoringRubrics.js';

test('single record package returns the record score', () => {
  assert.equal(calculatePackageWeightedAverage([80]), 80);
});

test('ability estimate exposes coverage and sample counts without confidence fields', () => {
  const estimate = buildAbilityEstimate([
    record('single', 80, '2026-01-01T00:00:00.000Z', 'constructive')
  ]);

  assert.equal(estimate.coverage, 62);
  assert.equal(estimate.totalDimensionCount, 5);
  assert.equal(estimate.dimensions.some((dimension) => dimension.key === 'evidence'), false);
  assert.equal(estimate.scoredRecordCount, 1);
  assert.equal(Object.hasOwn(estimate, 'confidence'), false);
  assert.equal(estimate.dimensions.every((dimension) => !Object.hasOwn(dimension, 'confidence')), true);
});

test('three continuous records use normalized exp(-0.15x) weights', () => {
  const weights = [Math.exp(-0.3), Math.exp(-0.15), 1];
  const expected = (60 * weights[0] + 70 * weights[1] + 80) / weights.reduce((sum, value) => sum + value, 0);
  assertClose(calculatePackageWeightedAverage([60, 70, 80]), expected);
});

test('constructive review subdimensions project into five abilities with normalized target weights', () => {
  const projected = projectAbilityDimensions({
    training_mode: 'constructive',
    dimension_scores: [
      { name: '辩题理解与定义判准', score: 90 },
      { name: '论证结构与逻辑链条', score: 90 },
      { name: '论据、数据与例证支撑', score: 50 },
      { name: '战场设计与可防守性', score: 80 },
      { name: '表达清晰度与时间控制', score: 60 }
    ]
  });

  assert.deepEqual(Object.keys(projected).sort(), ['battlefieldControl', 'expression', 'logic']);
  assertClose(projected.logic, (90 * 27 * 0.7 + 90 * 32 + 50 * 21) / (27 * 0.7 + 32 + 21));
  assertClose(projected.battlefieldControl, (90 * 27 * 0.3 + 80 * 15) / (27 * 0.3 + 15));
  assert.equal(projected.expression, 60);
});

test('all six review modes have complete, normalized mappings into exactly five unified abilities', () => {
  const expectedTargets = {
    constructive: ['battlefieldControl', 'expression', 'logic'],
    summary: ['battlefieldControl', 'counterPressure', 'expression', 'logic'],
    free_debate: ['battlefieldControl', 'counterPressure', 'defenseStability', 'expression', 'logic'],
    attack: ['battlefieldControl', 'counterPressure', 'expression', 'logic'],
    defense: ['counterPressure', 'defenseStability', 'expression', 'logic'],
    closing: ['battlefieldControl', 'expression', 'logic']
  };

  assert.deepEqual(
    abilityDimensions.map((dimension) => dimension.key),
    ['logic', 'defenseStability', 'counterPressure', 'battlefieldControl', 'expression']
  );
  assertClose(abilityDimensions.reduce((sum, dimension) => sum + dimension.weight, 0), 1);

  Object.entries(expectedTargets).forEach(([mode, targetKeys]) => {
    const rubric = getScoringRubric(mode).rubric;
    assert.deepEqual(
      Object.keys(abilityModeProjection[mode]),
      rubric.dimensions.map((dimension) => dimension.name),
      `${mode} must map every review subdimension by its canonical rubric name`
    );
    Object.values(abilityModeProjection[mode]).forEach((targets) => {
      assert.equal(Object.keys(targets).length <= 2, true);
      assertClose(Object.values(targets).reduce((sum, share) => sum + share, 0), 1);
    });

    const projected = projectAbilityDimensions({
      training_mode: mode,
      dimension_scores: rubric.dimensions.map((dimension) => ({
        name: dimension.name,
        score: 73
      }))
    });
    assert.deepEqual(Object.keys(projected).sort(), [...targetKeys].sort());
    Object.values(projected).forEach((score) => assertClose(score, 73));
  });
});

test('missing review subdimensions do not become zero or create unrelated ability updates', () => {
  const projected = projectAbilityDimensions({
    training_mode: 'defense',
    dimension_scores: [
      { name: '反压能力', score: 82 }
    ]
  });

  assert.deepEqual(projected, {
    counterPressure: 82,
    defenseStability: 82
  });
  assert.equal(Object.hasOwn(projected, 'logic'), false);
  assert.equal(Object.hasOwn(projected, 'expression'), false);
});

test('adding a package record increments every prior x and gives the new record x zero', () => {
  const before = buildPackageWeightDebug([{ score: 60 }, { score: 70 }, { score: 80 }]);
  const after = buildPackageWeightDebug([{ score: 60 }, { score: 70 }, { score: 80 }, { score: 90 }]);

  assert.deepEqual(before.map((item) => item.x), [2, 1, 0]);
  assert.deepEqual(after.map((item) => item.x), [3, 2, 1, 0]);
  assertClose(after[2].weight, Math.exp(-0.15));
  assert.equal(after[3].weight, 1);
});

test('a gap below 30 days remains in one package', () => {
  const profile = calculateDimensionProfile([
    record('a', 60, '2026-01-01T00:00:00.000Z'),
    record('b', 80, '2026-01-30T23:59:59.999Z')
  ], 'logic');

  assert.equal(profile.packageCount, 1);
  assert.equal(profile.recordCount, 2);
});

test('a gap exactly 30 days starts a new package', () => {
  const start = Date.parse('2026-01-01T00:00:00.000Z');
  const profile = calculateDimensionProfile([
    record('a', 60, new Date(start).toISOString()),
    record('b', 80, new Date(start + ABILITY_STAGE_GAP_MS).toISOString())
  ], 'logic');

  assert.equal(profile.packageCount, 2);
});

test('a new package with one record uses alpha(1)', () => {
  const profile = calculateDimensionProfile([
    record('a', 60, '2026-01-01T00:00:00.000Z'),
    record('b', 90, '2026-02-01T00:00:00.000Z')
  ], 'logic');
  const alpha = calculatePackageAlpha(1);

  assertClose(alpha, 0.5333333333333333);
  assertClose(profile.packages[1].historyBefore, 60);
  assertClose(profile.packages[1].packageScore, 90);
  assertClose(profile.score, alpha * 90 + (1 - alpha) * 60);
});

test('a new package with two records uses alpha(2)', () => {
  const profile = calculateDimensionProfile([
    record('a', 60, '2026-01-01T00:00:00.000Z'),
    record('b', 80, '2026-02-01T00:00:00.000Z'),
    record('c', 90, '2026-02-02T00:00:00.000Z')
  ], 'logic');

  assertClose(profile.packages[1].alpha, 0.6);
});

test('a new package with six records uses alpha(6)', () => {
  const records = [record('history', 50, '2026-01-01T00:00:00.000Z')];
  for (let index = 0; index < 6; index += 1) {
    records.push(record(`new-${index}`, 70 + index, `2026-02-0${index + 1}T00:00:00.000Z`));
  }
  const profile = calculateDimensionProfile(records, 'logic');

  assertClose(profile.packages[1].alpha, 0.7);
});

test('package alpha approaches but never reaches 0.8', () => {
  const counts = [1, 2, 3, 4, 6, 8, 100, 1000000];
  const alphas = counts.map(calculatePackageAlpha);

  assert.equal(alphas.every((alpha) => alpha < 0.8), true);
  assert.equal(alphas.every((alpha, index) => index === 0 || alpha > alphas[index - 1]), true);
  assertClose(calculatePackageAlpha(8), 0.72);
});

test('multiple 30-day breaks recursively use the prior fused result as H', () => {
  const profile = calculateDimensionProfile([
    record('stage-1', 60, '2026-01-01T00:00:00.000Z'),
    record('stage-2', 80, '2026-02-01T00:00:00.000Z'),
    record('stage-3', 100, '2026-03-03T00:00:00.000Z')
  ], 'logic');
  const alpha = calculatePackageAlpha(1);
  const stage2 = alpha * 80 + (1 - alpha) * 60;
  const stage3 = alpha * 100 + (1 - alpha) * stage2;

  assert.equal(profile.packageCount, 3);
  assertClose(profile.packages[2].historyBefore, stage2);
  assertClose(profile.score, stage3);
});

test('a record missing a dimension neither scores zero nor advances that dimension sequence', () => {
  const records = [
    record('defense-1', 60, '2026-01-01T00:00:00.000Z', 'defense'),
    record('constructive-only', 0, '2026-01-16T00:00:00.000Z', 'constructive'),
    record('defense-2', 80, '2026-02-01T00:00:00.000Z', 'defense')
  ];
  const profile = calculateDimensionProfile(records, 'defenseStability');
  const estimate = buildAbilityEstimate(records);

  assert.equal(profile.recordCount, 2);
  assert.equal(profile.packageCount, 2, 'the missing-dimension record cannot bridge the 31-day gap');
  assert.equal(profile.packages.some((item) => item.records.some((entry) => entry.recordId === 'constructive-only')), false);
  assert.equal(estimate.history[1].dimensions.defenseStability, null, 'the curve must not add a point for a missing dimension');
});

test('database return order does not change the result', () => {
  const records = [
    record('a', 60, '2026-01-01T00:00:00.000Z', 'constructive'),
    record('b', 75, '2026-01-03T00:00:00.000Z', 'attack'),
    record('c', 90, '2026-02-05T00:00:00.000Z', 'free_debate')
  ];
  const ordered = calculateAbilityProfile(records);
  const shuffled = calculateAbilityProfile([records[2], records[0], records[1]]);

  assertClose(shuffled.overall, ordered.overall);
  Object.keys(ordered.dimensions).forEach((key) => {
    assertClose(shuffled.dimensions[key].score, ordered.dimensions[key].score);
    assert.equal(shuffled.dimensions[key].packageCount, ordered.dimensions[key].packageCount);
  });
});

test('null scores and invalid timestamps remain outside the effective record sequence', () => {
  const estimate = buildAbilityEstimate([
    record('valid', 80, '2026-01-01T00:00:00.000Z'),
    record('null-score', null, '2026-01-02T00:00:00.000Z'),
    record('bad-time', 20, 'not-a-time')
  ]);

  assert.equal(estimate.recordCount, 3);
  assert.equal(estimate.scoredRecordCount, 1);
  const logic = estimate.dimensions.find((dimension) => dimension.key === 'logic');
  assert.equal(logic.records, 1);
  assert.equal(logic.score, 80);
});

test('a legacy total score without review subdimensions does not update the five-dimensional profile', () => {
  const estimate = buildAbilityEstimate([
    {
      id: 'legacy-total-only',
      score: 88,
      created_at: '2026-01-01T00:00:00.000Z',
      training_mode: 'constructive',
      difficulty: 'campus',
      dimension_scores: []
    }
  ]);

  assert.equal(estimate.recordCount, 1);
  assert.equal(estimate.scoredRecordCount, 0);
  assert.equal(estimate.overall, null);
  assert.equal(estimate.dimensions.every((dimension) => dimension.records === 0), true);
});

test('30-day boundary uses absolute timestamps across timezone and DST offsets', () => {
  const profile = calculateDimensionProfile([
    record('before-dst', 60, '2026-03-01T12:00:00-05:00'),
    record('after-dst', 80, '2026-03-31T13:00:00-04:00')
  ], 'logic');

  assert.equal(
    Date.parse('2026-03-31T13:00:00-04:00') - Date.parse('2026-03-01T12:00:00-05:00'),
    ABILITY_STAGE_GAP_MS
  );
  assert.equal(profile.packageCount, 2);
});

function record(id, score, createdAt, trainingMode = 'constructive') {
  return {
    id,
    score,
    created_at: createdAt,
    training_mode: trainingMode,
    difficulty: '',
    dimension_scores: getScoringRubric(trainingMode).rubric.dimensions.map((dimension) => ({
      name: dimension.name,
      score
    }))
  };
}

function assertClose(actual, expected, tolerance = 1e-10) {
  if (actual === null || expected === null) {
    assert.equal(actual, expected);
    return;
  }
  assert.equal(
    Math.abs(actual - expected) <= tolerance,
    true,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );
}
