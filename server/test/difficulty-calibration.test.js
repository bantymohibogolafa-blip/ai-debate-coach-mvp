import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateDifficultyAdjustment, calculateHighScoreCurve } from '../src/abilityProfile.js';
import { getScoringRubric } from '../src/scoringRubrics.js';
import { assertClose } from './ability-test-helpers.js';

test('difficulty v2 high-score curve clamps safely and is monotonic in every 0.1-point step', () => {
  assert.equal(calculateHighScoreCurve(90), 0);
  assert.equal(calculateHighScoreCurve(100), 1);
  assertClose(calculateHighScoreCurve(92), 0.33362317086193194);
  assertClose(calculateHighScoreCurve(95), 0.679178699175393);
  assertClose(calculateHighScoreCurve(98), 0.8995146319765904);
  assert.equal(calculateHighScoreCurve(-Infinity), 0);
  assert.equal(calculateHighScoreCurve(Infinity), 0);
  assert.equal(calculateHighScoreCurve(Number.NaN), 0);
  assert.equal(calculateHighScoreCurve(89.9), 0);
  assert.equal(calculateHighScoreCurve(100.1), 1);
  let previous = -1;
  for (let tenths = 900; tenths <= 1000; tenths += 1) {
    const actual = calculateHighScoreCurve(tenths / 10);
    assert.equal(actual >= 0 && actual <= 1, true);
    assert.equal(actual >= previous, true);
    previous = actual;
  }
});

test('text-only modes and campus never receive difficulty adjustments', () => {
  for (const mode of ['constructive', 'summary', 'closing']) {
    const usesDifficulty = getScoringRubric(mode).rubric.usesDifficulty;
    for (const difficulty of ['novice', 'campus', 'city', '', 'unknown']) {
      assert.equal(calculateDifficultyAdjustment({ score: 100, difficulty, usesDifficulty, finalScore: 100 }), 0);
    }
  }
  for (const score of [0, 50, 79.999, 80, 89.999, 90, 100]) {
    assert.equal(calculateDifficultyAdjustment({ score, difficulty: 'campus', usesDifficulty: true, finalScore: 100 }), 0);
  }
});

test('novice and city boundaries apply only the finalized v2 rules', () => {
  assert.equal(calculateDifficultyAdjustment({ score: 0, difficulty: 'novice', usesDifficulty: true, finalScore: 45 }), -1);
  assert.equal(calculateDifficultyAdjustment({ score: 90, difficulty: 'novice', usesDifficulty: true, finalScore: 45 }), -1);
  assertClose(calculateDifficultyAdjustment({ score: 95, difficulty: 'novice', usesDifficulty: true, finalScore: 45 }), -1.679178699175393);
  assert.equal(calculateDifficultyAdjustment({ score: 100, difficulty: 'novice', usesDifficulty: true, finalScore: 45 }), -2);
  assert.equal(calculateDifficultyAdjustment({ score: 100, difficulty: 'city', usesDifficulty: true, finalScore: 49.999 }), 0);
  assert.equal(calculateDifficultyAdjustment({ score: 70, difficulty: 'city', usesDifficulty: true, finalScore: 50 }), 2);
  assert.equal(calculateDifficultyAdjustment({ score: 80, difficulty: 'city', usesDifficulty: true, finalScore: 50 }), 3);
  assert.equal(calculateDifficultyAdjustment({ score: 90, difficulty: 'city', usesDifficulty: true, finalScore: 50 }), 3);
  assertClose(calculateDifficultyAdjustment({ score: 95, difficulty: 'city', usesDifficulty: true, finalScore: 50 }), 3.679178699175393);
  assert.equal(calculateDifficultyAdjustment({ score: 100, difficulty: 'city', usesDifficulty: true, finalScore: 50 }), 4);
});
