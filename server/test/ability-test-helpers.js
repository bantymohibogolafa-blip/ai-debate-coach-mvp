import assert from 'node:assert/strict';

import { getScoringRubric } from '../src/scoringRubrics.js';

export function assertClose(actual, expected, tolerance = 1e-9, message = '') {
  assert.equal(
    Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
    true,
    message || `expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

export function dimensionScoresFor(mode, values) {
  const rubric = getScoringRubric(mode).rubric;
  return rubric.dimensions.map((dimension, index) => ({
    name: dimension.name,
    score: Array.isArray(values) ? values[index] : values,
    maxScore: 100
  }));
}

export function basisVectorScores(mode, activeIndex) {
  return dimensionScoresFor(mode, [0, 0, 0, 0, 0].map((_, index) => (
    index === activeIndex ? 100 : 0
  )));
}

export function recordFixture({
  id = 'record',
  score = 80,
  finalScore = score,
  mode = 'free_debate',
  difficulty = '',
  dimensionScores = dimensionScoresFor(mode, score),
  createdAt = '2026-01-01T00:00:00.000Z'
} = {}) {
  return {
    id,
    score: finalScore,
    created_at: createdAt,
    training_mode: mode,
    difficulty,
    dimension_scores: dimensionScores
  };
}
