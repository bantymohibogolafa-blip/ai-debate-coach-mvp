import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateAbilityProfile,
  calculateDifficultyAdjustment,
  calculateDimensionProfile,
  calculatePackageAlpha,
  calculatePackageWeightedAverage,
  projectAbilityDimensions
} from '../src/abilityProfile.js';
import {
  CURRENT_DIFFICULTY_CALIBRATION_VERSION,
  CURRENT_PROJECTION_VERSION
} from '../src/scoringVersions.js';
import { assertClose, dimensionScoresFor, recordFixture } from './ability-test-helpers.js';

test('a complete record keeps raw projections, per-ability adjustments, audit scores, and versions distinct', () => {
  const source = recordFixture({
    id: 'city-audit',
    mode: 'free_debate',
    score: 84,
    finalScore: 84,
    difficulty: 'city',
    dimensionScores: dimensionScoresFor('free_debate', [92, 86, 78, 95, 88])
  });
  const record = calculateAbilityProfile([source]).validRecords[0];
  const rawProjectedScores = projectAbilityDimensions(source);

  assert.deepEqual(record.rawProjectedScores, rawProjectedScores);
  for (const [ability, rawScore] of Object.entries(rawProjectedScores)) {
    const adjustment = calculateDifficultyAdjustment({ score: rawScore, difficulty: 'city', usesDifficulty: true, finalScore: 84 });
    assertClose(record.difficultyAdjustments[ability], adjustment, 1e-9, ability);
    assertClose(record.projectedScores[ability], Math.min(100, rawScore + adjustment), 1e-9, ability);
  }
  assertClose(record.projectedOverall, 88.31596291596843);
  assert.equal(record.rawScore, 84);
  assert.equal(record.adjustedScore, 87);
  assert.equal(record.appliedProjectionVersion, CURRENT_PROJECTION_VERSION);
  assert.equal(record.appliedDifficultyCalibrationVersion, CURRENT_DIFFICULTY_CALIBRATION_VERSION);
});

test('failed city, novice, and text-mode records preserve their distinct finalized difficulty behavior', () => {
  const city = calculateAbilityProfile([recordFixture({
    id: 'city-failed', mode: 'free_debate', score: 45, finalScore: 45, difficulty: 'city', dimensionScores: dimensionScoresFor('free_debate', 100)
  })]).validRecords[0];
  assert.equal(Object.values(city.difficultyAdjustments).every((value) => value === 0), true);
  assert.deepEqual(city.projectedScores, city.rawProjectedScores);
  assert.equal(city.adjustedScore, 45);

  const novice = calculateAbilityProfile([recordFixture({
    id: 'novice-failed', mode: 'defense', score: 45, finalScore: 45, difficulty: 'novice', dimensionScores: dimensionScoresFor('defense', 70)
  })]).validRecords[0];
  assert.equal(Object.values(novice.difficultyAdjustments).every((value) => value === -1), true);
  assert.equal(novice.adjustedScore, 44);

  const text = calculateAbilityProfile([recordFixture({
    id: 'text-mode', mode: 'constructive', score: 95, finalScore: 95, difficulty: 'city', dimensionScores: dimensionScoresFor('constructive', 95)
  })]).validRecords[0];
  assert.equal(Object.values(text.difficultyAdjustments).every((value) => value === 0), true);
  assert.deepEqual(text.projectedScores, text.rawProjectedScores);
});

test('long-term aggregation keeps package decay, exact 30-day splits, and recursive fusion stable', () => {
  const records = [
    recordFixture({ id: 'a', mode: 'constructive', score: 60, createdAt: '2026-01-01T00:00:00.000Z', dimensionScores: dimensionScoresFor('constructive', 60) }),
    recordFixture({ id: 'b', mode: 'constructive', score: 70, createdAt: '2026-01-02T00:00:00.000Z', dimensionScores: dimensionScoresFor('constructive', 70) }),
    recordFixture({ id: 'c', mode: 'constructive', score: 80, createdAt: '2026-01-03T00:00:00.000Z', dimensionScores: dimensionScoresFor('constructive', 80) }),
    recordFixture({ id: 'd', mode: 'constructive', score: 90, createdAt: '2026-02-02T00:00:00.000Z', dimensionScores: dimensionScoresFor('constructive', 90) }),
    recordFixture({ id: 'e', mode: 'constructive', score: 100, createdAt: '2026-02-03T00:00:00.000Z', dimensionScores: dimensionScoresFor('constructive', 100) })
  ];
  const profile = calculateDimensionProfile([...records].reverse(), 'logic');
  const firstPackage = calculatePackageWeightedAverage([60, 70, 80]);
  const secondPackage = calculatePackageWeightedAverage([90, 100]);
  const expected = calculatePackageAlpha(2) * secondPackage + (1 - calculatePackageAlpha(2)) * firstPackage;

  assert.equal(profile.packageCount, 2);
  assert.deepEqual(profile.packages[0].records.map((record) => record.x), [2, 1, 0]);
  assert.deepEqual(profile.packages[1].records.map((record) => record.x), [1, 0]);
  assertClose(profile.packages[0].packageScore, firstPackage);
  assertClose(profile.packages[1].packageScore, secondPackage);
  assertClose(profile.packages[1].alpha, 0.6);
  assertClose(profile.score, expected);
});
