export const CURRENT_SCORING_VERSION = 'scoring_v5';
export const CURRENT_PROJECTION_VERSION = 'ability_projection_v4';
export const CURRENT_DIFFICULTY_CALIBRATION_VERSION = 'difficulty_calibration_v2';
export const CURRENT_ESTIMATOR_VERSION = 'ability_estimator_v3';

export const LEGACY_SCORING_VERSION = {
  SUBSCORE: 'legacy_subscore',
  PERCENTILE_UNKNOWN: 'legacy_percentile_unknown',
  MISSING: 'legacy_missing'
};

export function inferTrainingRecordScoringVersion(record = {}) {
  const explicitVersion = normalizeVersion(record.scoring_version || record.scoringVersion);
  if (explicitVersion) return explicitVersion;

  const dimensions = getDimensionScores(record);
  if (!dimensions.length) return LEGACY_SCORING_VERSION.MISSING;

  const hasLegacySubscore = dimensions.some((dimension) => {
    const maxScore = Number(dimension?.maxScore ?? dimension?.max_score ?? 100);
    return Number.isFinite(maxScore) && maxScore > 0 && Math.abs(maxScore - 100) > 0.0001;
  });
  return hasLegacySubscore
    ? LEGACY_SCORING_VERSION.SUBSCORE
    : LEGACY_SCORING_VERSION.PERCENTILE_UNKNOWN;
}

export function getTrainingRecordVersionMetadata(record = {}) {
  const scoringVersion = inferTrainingRecordScoringVersion(record);
  const isLegacy = scoringVersion.startsWith('legacy_');

  return {
    scoringVersion,
    rubricId: normalizeVersion(record.rubric_id || record.rubricId) || (isLegacy ? 'legacy_unknown' : ''),
    rubricVersion: normalizeVersion(record.rubric_version || record.rubricVersion)
      || (isLegacy ? 'legacy_unknown' : ''),
    projectionVersion: normalizeVersion(record.projection_version || record.projectionVersion)
      || (isLegacy ? 'legacy_unknown' : CURRENT_PROJECTION_VERSION),
    difficultyCalibrationVersion: normalizeVersion(
      record.difficulty_calibration_version || record.difficultyCalibrationVersion
    ) || (isLegacy ? 'legacy_unknown' : CURRENT_DIFFICULTY_CALIBRATION_VERSION),
    estimatorVersion: normalizeVersion(record.estimator_version || record.estimatorVersion)
      || (isLegacy ? 'legacy_unknown' : CURRENT_ESTIMATOR_VERSION)
  };
}

function getDimensionScores(record) {
  if (Array.isArray(record.dimension_scores)) return record.dimension_scores;
  if (Array.isArray(record.dimensionScores)) return record.dimensionScores;
  return [];
}

function normalizeVersion(value) {
  return String(value || '').trim();
}
