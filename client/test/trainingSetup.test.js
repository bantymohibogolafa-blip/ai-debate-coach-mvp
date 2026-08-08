import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getTrainingSnapshot,
  getTrainingStepAvailability,
  isMeaningfulTrainingTopic,
  validateTrainingSetup
} from '../src/utils/trainingSetup.js';

const readyConfig = {
  topic: '中学生使用 AI 工具利大于弊',
  userSide: 'affirmative',
  difficulty: 'novice',
  celebrityDebater: 'none',
  trainingMode: 'attack',
  rounds: 3
};

test('topic validation rejects punctuation-only content', () => {
  assert.equal(isMeaningfulTrainingTopic(' ？！... '), false);
  assert.equal(isMeaningfulTrainingTopic('AI 利大于弊'), true);
});

test('step availability follows shared setup validation', () => {
  assert.deepEqual(getTrainingStepAvailability({ config: { ...readyConfig, topic: '' } }), {
    topic: true,
    config: false,
    confirm: false
  });
  assert.deepEqual(getTrainingStepAvailability({ config: readyConfig }), {
    topic: true,
    config: true,
    confirm: true
  });
});

test('mode-specific preparation remains required', () => {
  const result = validateTrainingSetup({ config: { ...readyConfig, trainingMode: 'defense' } });
  assert.equal(result?.field, 'defensePrep');
});

test('snapshot is detached from later config changes', () => {
  const changed = { ...readyConfig };
  const snapshot = getTrainingSnapshot({ config: changed, defensePrep: '论点一' });
  changed.topic = '新辩题';
  assert.equal(snapshot.topic, readyConfig.topic);
  assert.equal(snapshot.defensePrep, '论点一');
});
