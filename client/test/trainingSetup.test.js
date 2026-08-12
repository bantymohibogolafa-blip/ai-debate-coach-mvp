import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  getTrainingSnapshot,
  getTrainingStepAvailability,
  isMeaningfulTrainingTopic,
  validateTrainingSetup
} from '../src/utils/trainingSetup.js';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const styleSource = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

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

test('arena hero remains above TrainingSetup before and after training starts', () => {
  const heroIndex = appSource.indexOf('<section className="arena-hero">');
  const setupIndex = appSource.indexOf('<TrainingSetup');

  assert.ok(heroIndex >= 0);
  assert.ok(setupIndex > heroIndex);
  assert.doesNotMatch(appSource, /\{hasSessionContent && \(\s*<section className="arena-hero">/);
  for (const label of ['当前轮次', '我的立场', '难度', '训练模式']) {
    assert.ok(appSource.includes(label));
  }
});

test('desktop training view uses a wider scoped shell without changing other tabs', () => {
  assert.match(appSource, /activeTab === 'training' \? 'training-view' : ''/);
  assert.match(styleSource, /@media \(min-width:\s*1000px\)\s*\{[\s\S]*?\.app-shell\.training-view\s*\{[\s\S]*?width:\s*min\(1600px, calc\(100% - 40px\)\)/);
  assert.match(styleSource, /\.training-view \.training-setup\s*\{[\s\S]*?width:\s*calc\(100% - 24px\);[\s\S]*?max-width:\s*none/);
  assert.match(styleSource, /\.training-view \.training-topic-step\s*\{[\s\S]*?max-width:\s*1400px/);
  assert.match(styleSource, /\.training-view \.training-confirm-step\s*\{[\s\S]*?max-width:\s*1240px/);
});

test('team-task setup exposes a lightweight source return that is cleared on start', () => {
  assert.match(appSource, /type:\s*'team-task'/);
  assert.match(appSource, /← 返回团队任务/);
  assert.match(appSource, /setActiveTeamPanelTab\('tasks'\)/);
  assert.match(appSource, /setActiveTab\('team'\)/);
  assert.match(appSource, /setTrainingEntrySource\(null\)/);
  assert.match(styleSource, /\.training-team-task-return\s*\{[\s\S]*?min-height:\s*36px/);
  assert.match(styleSource, /\.training-team-task-return\s*\{\s*min-height:\s*44px/);
});
