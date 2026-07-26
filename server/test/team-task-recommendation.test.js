import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAbilityTaskRecommendations } from '../src/teamTaskRecommendation.js';

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
  assert.equal(result.teamAbilityOverall, 87, 'city records receive the same ability-estimate adjustment used by the profile');
  assert.equal(result.teamRecommendation.basis, 'ability_estimate');
  assert.equal(result.teamRecommendation.difficulty, 'city', 'difficulty is selected from ability overall, not the raw average of 80');
  assert.equal(typeof result.teamRecommendation.abilityDimensionKey, 'string');
  assert.equal(result.personalRecommendations.every((item) => item.basis === 'ability_estimate'), true);
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
    created_at: createdAt
  };
}
