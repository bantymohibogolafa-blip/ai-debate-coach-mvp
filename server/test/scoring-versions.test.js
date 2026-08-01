import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CURRENT_DIFFICULTY_CALIBRATION_VERSION,
  CURRENT_ESTIMATOR_VERSION,
  CURRENT_PROJECTION_VERSION,
  CURRENT_SCORING_VERSION,
  getTrainingRecordVersionMetadata,
  inferTrainingRecordScoringVersion
} from '../src/scoringVersions.js';

test('empty historical dimensions are explicitly classified as legacy_missing', () => {
  assert.equal(inferTrainingRecordScoringVersion({ dimension_scores: [] }), 'legacy_missing');
  assert.equal(inferTrainingRecordScoringVersion({}), 'legacy_missing');
  assert.deepEqual(getTrainingRecordVersionMetadata({ dimension_scores: [] }), {
    scoringVersion: 'legacy_missing',
    rubricId: 'legacy_unknown',
    rubricVersion: 'legacy_unknown',
    projectionVersion: 'legacy_unknown',
    difficultyCalibrationVersion: 'legacy_unknown',
    estimatorVersion: 'legacy_unknown'
  });
});

test('historical weighted subscores and unversioned percentile scores are distinguished', () => {
  assert.equal(inferTrainingRecordScoringVersion({
    dimension_scores: [{ name: '旧维度', score: 22, maxScore: 30 }]
  }), 'legacy_subscore');
  assert.equal(inferTrainingRecordScoringVersion({
    dimension_scores: [{ name: '百分制维度', score: 72, maxScore: 100 }]
  }), 'legacy_percentile_unknown');
});

test('explicit current metadata is preserved without legacy inference', () => {
  const metadata = getTrainingRecordVersionMetadata({
    scoring_version: CURRENT_SCORING_VERSION,
    rubric_id: 'defensive_cx',
    projection_version: CURRENT_PROJECTION_VERSION,
    difficulty_calibration_version: CURRENT_DIFFICULTY_CALIBRATION_VERSION,
    estimator_version: CURRENT_ESTIMATOR_VERSION,
    dimension_scores: []
  });

  assert.deepEqual(metadata, {
    scoringVersion: CURRENT_SCORING_VERSION,
    rubricId: 'defensive_cx',
    rubricVersion: '',
    projectionVersion: CURRENT_PROJECTION_VERSION,
    difficultyCalibrationVersion: CURRENT_DIFFICULTY_CALIBRATION_VERSION,
    estimatorVersion: CURRENT_ESTIMATOR_VERSION
  });
});
