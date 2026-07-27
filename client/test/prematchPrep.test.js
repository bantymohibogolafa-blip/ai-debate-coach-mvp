import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const appSource = fs.readFileSync(
  fileURLToPath(new URL('../src/App.jsx', import.meta.url)),
  'utf8'
);
const prepSource = fs.readFileSync(
  fileURLToPath(new URL('../src/components/SuperLinWanPrep.jsx', import.meta.url)),
  'utf8'
);
const boardSource = fs.readFileSync(
  fileURLToPath(new URL('../src/components/TeamPreparationBoard.jsx', import.meta.url)),
  'utf8'
);

test('个人 Super 林婉与团队备战看板使用不同入口实现', () => {
  assert.match(appSource, /isTeamSpace \? '团队备战看板' : '赛前备战｜Super 林婉'/);
  assert.match(prepSource, /\/api\/prematch\/tasks/);
  assert.match(prepSource, /\/chat`/);
  assert.match(prepSource, /spaceType: 'personal'/);
  assert.match(boardSource, /\/api\/team\/preparation/);
  assert.equal(boardSource.includes('/api/prematch'), false);
  assert.equal(boardSource.includes('/api/ability'), false);
  assert.equal(prepSource.includes('/api/linwan/history'), false);
  assert.equal(prepSource.includes('/api/debate-experience-chat'), false);
});

test('正式训练携带来源任务并提供返回 Super 林婉的动作', () => {
  assert.match(appSource, /sourcePrepTaskId: context\.taskId/);
  assert.match(appSource, /prepStrategySummary: context\.strategySummary/);
  assert.match(appSource, /prepVerificationQuestion: context\.verificationQuestion/);
  assert.match(appSource, /返回 Super 林婉/);
});

test('不同备战任务以任务 ID 读取并支持归档、恢复与删除', () => {
  assert.match(prepSource, /encodeURIComponent\(taskId\)/);
  assert.match(prepSource, /'archive' : 'restore'/);
  assert.match(prepSource, /api\.deleteJson/);
  assert.match(prepSource, /clientRequestId/);
});

test('带入个人 Super 林婉只预填个人表单而不自动创建', () => {
  assert.match(boardSource, /onBringToPersonalLinWan/);
  assert.match(appSource, /setPersonalPrepDraft/);
  assert.match(prepSource, /确认表单后才会创建个人任务/);
  assert.equal(boardSource.includes("api.postJson('/api/prematch/tasks'"), false);
});
