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

test('赛前备战拥有独立入口与独立任务 API', () => {
  assert.match(appSource, /\{ label: '赛前备战', value: 'preparation' \}/);
  assert.match(prepSource, /\/api\/prematch\/tasks/);
  assert.match(prepSource, /\/chat`/);
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

test('团队任务创建兼容现有队长和管理员角色', () => {
  assert.match(prepSource, /\['owner', 'captain', 'leader', 'admin'\]/);
});
