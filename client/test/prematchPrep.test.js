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
  assert.equal(prepSource.includes('onStartTraining'), false);
});

test('个人任务表单只显示任务、立场和已有想法', () => {
  assert.match(prepSource, /当前任务 \/ 辩题 \*/);
  assert.match(prepSource, /我的立场（可选）/);
  assert.match(prepSource, /当前已有想法或卡点（可选）/);
  assert.equal(prepSource.includes('<span>任务名称</span>'), false);
  assert.equal(prepSource.includes('<span>我的辩位'), false);
  assert.equal(prepSource.includes('补充比赛信息（可选）'), false);
  assert.match(prepSource, /debatePosition: 'undecided'/);
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

test('三个快捷提示与报告共用当前任务聊天接口并传递 intent', () => {
  assert.match(prepSource, /label: '拆辩题'/);
  assert.match(prepSource, /label: '发散论点'/);
  assert.match(prepSource, /label: '搜集论据'/);
  assert.match(prepSource, /形成当前思路报告/);
  assert.match(prepSource, /\{ question: cleanQuestion, clientRequestId, intent \}/);
  assert.match(prepSource, /intent: 'report'/);
  assert.match(prepSource, /setQuestion\(\(current\) => current\.trim\(\)/);
  assert.equal((prepSource.match(/\/chat`/g) || []).length, 1);
});

test('个人任务页面移除战略、训练推荐和训练回流卡片', () => {
  assert.equal(prepSource.includes('阶段性方案'), false);
  assert.equal(prepSource.includes('推荐训练'), false);
  assert.equal(prepSource.includes('训练回流'), false);
  assert.equal(prepSource.includes('本轮参考'), false);
  assert.equal(prepSource.includes('prematch-side-column'), false);
  assert.match(prepSource, /message\.contextManifest\?\.intent === 'report'/);
});
