import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getMobileTrainingSnapshot,
  getMobileTrainingStepAvailability,
  isMeaningfulTrainingTopic,
  validateMobileTrainingSetup
} from '../src/utils/mobileTrainingSetup.js';

const readyConfig = {
  topic: '中学生使用 AI 工具利大于弊',
  userSide: 'affirmative',
  difficulty: 'novice',
  celebrityDebater: 'none',
  trainingMode: 'attack',
  rounds: 3
};

test('辩题必须包含文字或数字', () => {
  assert.equal(isMeaningfulTrainingTopic(' ？！…… '), false);
  assert.equal(isMeaningfulTrainingTopic('AI？'), true);
});

test('后续步骤按完成状态解锁', () => {
  assert.deepEqual(getMobileTrainingStepAvailability({ config: { ...readyConfig, topic: '' } }), {
    topic: true,
    config: false,
    confirm: false
  });
  assert.deepEqual(getMobileTrainingStepAvailability({ config: readyConfig }), {
    topic: true,
    config: true,
    confirm: true
  });
});

test('模式专属准备内容仍为必填', () => {
  const result = validateMobileTrainingSetup({ config: { ...readyConfig, trainingMode: 'defense' } });
  assert.equal(result.field, 'defensePrep');
});

test('确认快照始终读取最新且完整的前端状态', () => {
  const changed = { ...readyConfig, difficulty: 'city', rounds: 5 };
  const snapshot = getMobileTrainingSnapshot({ config: changed, defensePrep: '论点一' });
  assert.equal(snapshot.difficulty, 'city');
  assert.equal(snapshot.rounds, 5);
  assert.equal(snapshot.topic, readyConfig.topic);
  assert.equal(snapshot.defensePrep, '论点一');
});
