import assert from 'node:assert/strict';
import test from 'node:test';

import {
  abilityDimensions,
  abilityModeProjection,
  calculateAbilityProfile,
  calculateProjectedOverall,
  projectAbilityDimensions
} from '../src/abilityProfile.js';
import { getScoringRubric } from '../src/scoringRubrics.js';
import { assertClose, basisVectorScores, dimensionScoresFor, recordFixture } from './ability-test-helpers.js';

const GOLDEN_SCORES = [60, 70, 80, 90, 100];
const GOLDEN_PROJECTIONS = {
  constructive: { logic: 78.43971631205674, battlefieldControl: 80.8, expression: 100 },
  summary: { logic: 75.23076923076923, counterPressure: 70, battlefieldControl: 76.92307692307692, expression: 89.0909090909091 },
  free_debate: { logic: 80, defenseStability: 70, counterPressure: 76.26086956521739, battlefieldControl: 65.64231738035264, expression: 90 },
  attack: { logic: 70.71428571428571, counterPressure: 71.53846153846153, battlefieldControl: 81.875, expression: 100 },
  defense: { logic: 71.5625, defenseStability: 68.75, counterPressure: 90, expression: 100 },
  closing: { logic: 81.93548387096774, battlefieldControl: 73.11926605504587, expression: 84.48275862068965 }
};

test('30 basis vectors reproduce every normalized internal ability source weight', () => {
  let coverage = 0;
  for (const [mode, projection] of Object.entries(abilityModeProjection)) {
    const rubric = getScoringRubric(mode).rubric;
    rubric.dimensions.forEach((dimension, activeIndex) => {
      coverage += 1;
      const projected = projectAbilityDimensions({ training_mode: mode, dimension_scores: basisVectorScores(mode, activeIndex) });
      for (const ability of abilityDimensions) {
        const sourceWeights = rubric.dimensions
          .map((source) => Number(source.maxScore) * (projection[source.name][ability.key] || 0));
        const total = sourceWeights.reduce((sum, value) => sum + value, 0);
        const expected = total ? (sourceWeights[activeIndex] / total) * 100 : undefined;
        if (expected === undefined) {
          assert.equal(Object.hasOwn(projected, ability.key), false, `${mode}.${dimension.name} must not create ${ability.key}`);
        } else {
          assertClose(projected[ability.key], expected, 1e-9, `${mode}.${dimension.name} -> ${ability.key}`);
        }
      }
    });
  }
  assert.equal(coverage, 30);
});

test('equal subdimension scores preserve that same score for every covered ability', () => {
  for (const mode of Object.keys(abilityModeProjection)) {
    const projected = projectAbilityDimensions({ training_mode: mode, dimension_scores: dimensionScoresFor(mode, 73) });
    Object.entries(projected).forEach(([ability, score]) => assertClose(score, 73, 1e-9, `${mode}.${ability}`));
  }
});

test('golden D1-D5 samples lock raw projections independently of difficulty', () => {
  for (const [mode, expected] of Object.entries(GOLDEN_PROJECTIONS)) {
    const projected = projectAbilityDimensions({ training_mode: mode, dimension_scores: dimensionScoresFor(mode, GOLDEN_SCORES) });
    assert.deepEqual(Object.keys(projected).sort(), Object.keys(expected).sort(), `${mode} coverage`);
    Object.entries(expected).forEach(([ability, score]) => assertClose(projected[ability], score, 1e-9, `${mode}.${ability}`));
  }
});

test('missing, invalid, duplicate, and legacy names retain only valid non-duplicated sources', () => {
  const defense = projectAbilityDimensions({
    training_mode: 'defense',
    dimension_scores: [{ name: '反压能力', score: 82 }]
  });
  assert.deepEqual(defense, { counterPressure: 82 });

  const canonicalPriority = projectAbilityDimensions({
    training_mode: 'constructive',
    dimension_scores: [
      { name: '辩题理解与定义判准', score: 20 },
      { name: '辩题理解、立场与举证责任', score: 90 },
      { name: '不存在的维度', score: 100 },
      { name: '论证结构与逻辑链条', score: -1 }
    ]
  });
  assert.deepEqual(canonicalPriority, { logic: 90, battlefieldControl: 90 });

  const duplicate = projectAbilityDimensions({
    training_mode: 'defense',
    dimension_scores: [{ name: '反压能力', score: 82 }, { name: '反压能力', score: 1 }]
  });
  assert.deepEqual(duplicate, { counterPressure: 82 });
});

test('combined overall weights renormalize only over observed abilities and mode coverage is exact', () => {
  assertClose(calculateProjectedOverall({ logic: 90, defenseStability: 80, counterPressure: 70, battlefieldControl: 60, expression: 50 }), 72);
  assertClose(calculateProjectedOverall({ logic: 80, expression: 60 }), 72);

  const expectedCoverage = { constructive: 65, summary: 85, free_debate: 100, attack: 85, defense: 85, closing: 65 };
  for (const [mode, coverage] of Object.entries(expectedCoverage)) {
    const profile = calculateAbilityProfile([recordFixture({ id: mode, mode, score: 80 })]);
    assert.equal(profile.coverage, coverage, `${mode} coverage`);
  }
});
