import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createLinWanContextManifest,
  decodeLinWanCursor,
  encodeLinWanCursor,
  getDefaultLinWanProfile,
  getRecentCompletedLinWanRounds,
  normalizeLinWanContextManifest,
  validateLinWanProfile
} from '../src/linwan.js';

function message(role, content, index, extra = {}) {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    role,
    content,
    createdAt: new Date(Date.UTC(2026, 6, 18, 0, 0, index)).toISOString(),
    ...extra
  };
}

function completedRounds(count) {
  return Array.from({ length: count }, (_, round) => [
    message('user', `问题${round + 1}`, round * 2 + 1),
    message('assistant', `回答${round + 1}`, round * 2 + 2)
  ]).flat();
}

test('getRecentCompletedLinWanRounds handles zero, one, eight, and more than eight rounds', () => {
  assert.deepEqual(getRecentCompletedLinWanRounds([]), []);
  assert.equal(getRecentCompletedLinWanRounds(completedRounds(1)).length, 2);
  assert.equal(getRecentCompletedLinWanRounds(completedRounds(8)).length, 16);
  const recent = getRecentCompletedLinWanRounds(completedRounds(10));
  assert.equal(recent.length, 16);
  assert.equal(recent[0].content, '问题3');
  assert.equal(recent.at(-1).content, '回答10');
});

test('completed rounds ignore orphan, empty, invalid, duplicate, and failed messages', () => {
  const history = [
    message('assistant', '孤立回答', 1),
    message('user', '被下一条用户替代', 2),
    message('user', '有效问题', 3),
    message('assistant', '有效回答', 4),
    message('user', '孤立问题', 5),
    message('assistant', '   ', 6),
    message('tool', '非法角色', 7),
    message('user', '失败问题', 8),
    message('assistant', '失败占位', 9, { success: false }),
    { ...message('assistant', '有效回答', 4) }
  ];
  const recent = getRecentCompletedLinWanRounds(history);
  assert.deepEqual(recent.map((item) => item.content), ['有效问题', '有效回答']);
});

test('completed rounds are chronological and exclude the current question', () => {
  const outOfOrder = [
    message('assistant', '回答2', 4),
    message('user', '问题2', 3),
    message('assistant', '回答1', 2),
    message('user', '问题1', 1),
    message('user', '当前问题', 5)
  ];
  const recent = getRecentCompletedLinWanRounds(outOfOrder, { currentQuestion: '当前问题' });
  assert.deepEqual(recent.map((item) => item.content), ['问题1', '回答1', '问题2', '回答2']);
});

test('profile validation accepts valid values and preserves an intentionally empty name', () => {
  const profile = validateLinWanProfile({
    preferredName: '',
    responseLength: 'detailed',
    communicationStyle: 'gentle',
    answerOrder: 'analysis_first',
    terminologyLevel: 'professional',
    customPreference: '  请给具体动作  ',
    autoShowContext: false
  });
  assert.equal(profile.preferredName, '');
  assert.equal(profile.customPreference, '请给具体动作');
  assert.equal(profile.autoShowContext, false);
});

test('profile validation rejects invalid enums and excessive lengths, and strips controls', () => {
  const base = {
    preferredName: '小\n林',
    responseLength: 'balanced',
    communicationStyle: 'balanced',
    answerOrder: 'auto',
    terminologyLevel: 'normal',
    customPreference: '直\u0000接',
    autoShowContext: true
  };
  assert.equal(validateLinWanProfile(base).preferredName, '小林');
  assert.equal(validateLinWanProfile(base).customPreference, '直接');
  assert.throws(() => validateLinWanProfile({ ...base, responseLength: 'huge' }), /回答详略选项无效/);
  assert.throws(() => validateLinWanProfile({ ...base, preferredName: '一二三四五六七八九十一二三' }), /12 个字符/);
  assert.throws(() => validateLinWanProfile({ ...base, customPreference: '字'.repeat(201) }), /200 个字符/);
});

test('new profile defaults to autoShowContext true and uses the account display name once', () => {
  const profile = getDefaultLinWanProfile('辩手小林');
  assert.equal(profile.preferredName, '辩手小林');
  assert.equal(profile.autoShowContext, true);
});

test('context manifest reports only actual references and never includes raw context', () => {
  const profile = validateLinWanProfile({
    preferredName: '小林',
    responseLength: 'balanced',
    communicationStyle: 'direct',
    answerOrder: 'conclusion_first',
    terminologyLevel: 'normal',
    customPreference: '这里是不能展示的偏好原文',
    autoShowContext: true
  });
  const manifest = createLinWanContextManifest(profile, {
    recentTrainingCount: 3,
    weakDimensions: ['逻辑推进', '表达压缩', '第三项'],
    recommendedFocus: '训练重点原文'
  }, completedRounds(3));
  assert.equal(manifest.trainingProfile.highlights.length, 2);
  assert.equal(manifest.recentChat.rounds, 3);
  assert.equal(manifest.recentChat.messages, 6);
  assert.equal(manifest.preferences.customPreferenceUsed, true);
  const serialized = JSON.stringify(manifest);
  assert.equal(serialized.includes('不能展示的偏好原文'), false);
  assert.equal(serialized.includes('问题1'), false);
  assert.equal(serialized.includes('Prompt'), false);
});

test('context manifest omits unavailable training profile and tolerates legacy null manifests', () => {
  const manifest = createLinWanContextManifest(getDefaultLinWanProfile(''), null, []);
  assert.equal(manifest.trainingProfile.used, false);
  assert.equal(manifest.recentChat.used, false);
  assert.equal(normalizeLinWanContextManifest(null), null);
});

test('history cursor round-trips a stable createdAt and id pair', () => {
  const source = message('user', '问题', 12);
  const cursor = encodeLinWanCursor(source);
  assert.deepEqual(decodeLinWanCursor(cursor), { createdAt: source.createdAt, id: source.id });
  assert.equal(decodeLinWanCursor('invalid'), null);
});
