import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAbilityTaskRecommendations } from '../src/teamTaskRecommendation.js';
import { getScoringRubric } from '../src/scoringRubrics.js';

test('team task recommendations use ability estimates instead of raw-score averages', () => {
  const members = [
    member('member-a', '成员A'),
    member('member-b', '成员B')
  ];
  const records = [
    record('a-1', 'member-a', 'defense', 80, '2026-07-01T00:00:00.000Z'),
    record('a-2', 'member-a', 'defense', 80, '2026-07-02T00:00:00.000Z'),
    record('b-1', 'member-b', 'constructive', 80, '2026-07-01T00:00:00.000Z'),
    record('b-2', 'member-b', 'constructive', 80, '2026-07-02T00:00:00.000Z')
  ];

  const result = buildAbilityTaskRecommendations(members, records);

  assert.equal(result.basis, 'ability_estimate');
  assert.equal(result.teamAbilityOverall, 81.5, 'city adjusts the interactive record while the text-mode record stays unadjusted');
  assert.equal(result.teamRecommendation.basis, 'ability_estimate');
  assert.equal(result.teamRecommendation.difficulty, 'campus', 'difficulty is selected from the v2 ability overall');
  assert.equal(typeof result.teamRecommendation.abilityDimensionKey, 'string');
  assert.equal(Object.hasOwn(result.teamRecommendation, 'abilityConfidence'), false);
  assert.equal(result.personalRecommendations.every((item) => item.basis === 'ability_estimate'), true);
  assert.equal(result.personalRecommendations.every((item) => !Object.hasOwn(item, 'abilityConfidence')), true);
});

function member(id, nickname) {
  return {
    status: 'active',
    app_user_id: id,
    local_user_id: id,
    nickname
  };
}

function record(id, appUserId, trainingMode, score, createdAt) {
  return {
    id,
    app_user_id: appUserId,
    local_user_id: appUserId,
    training_mode: trainingMode,
    score,
    difficulty: 'city',
    created_at: createdAt,
    dimension_scores: getScoringRubric(trainingMode).rubric.dimensions.map((dimension) => ({
      name: dimension.name,
      score
    }))
  };
}
