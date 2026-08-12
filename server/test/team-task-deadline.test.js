import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  getTaskDerivedStatus,
  isTaskActive,
  isTaskExpired
} from '../../shared/teamTaskDeadline.js';

const serverSource = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
const now = Date.parse('2026-08-12T12:00:00.000Z');

test('server and client share deadline validity semantics', () => {
  assert.equal(isTaskActive({ status: 'active', deadline: '2026-08-12T12:01:00.000Z' }, now), true);
  assert.equal(isTaskActive({ status: 'active', deadline: '2026-08-12T11:59:00.000Z' }, now), false);
  assert.equal(isTaskExpired({ status: 'active', deadline: 'invalid' }, now), false);
  assert.equal(getTaskDerivedStatus({ status: 'closed', deadline: '2026-08-12T11:59:00.000Z' }, now), 'ended');
});

test('task progress queries cap completion records at the stored deadline', () => {
  assert.match(serverSource, /fetchTaskRecords\(taskId, teamCode, \{[\s\S]*?deadline:\s*task\.deadline/);
  assert.match(serverSource, /fetchTaskRecords\(task\.id, task\.team_code, \{ limit: 1000, deadline: task\.deadline \}\)/);
  assert.match(serverSource, /query\.set\('created_at', `lte\.\$\{new Date\(deadlineTime\)\.toISOString\(\)\}`\)/);
});

test('expired completion remains a record while only closed tasks reject saving', () => {
  assert.match(serverSource, /if \(isTaskEnded\(task\)\) \{[\s\S]*?不能继续提交任务记录/);
  assert.doesNotMatch(serverSource, /if \(isTaskExpired\(task\)\)[\s\S]{0,160}不能继续提交任务记录/);
});

test('formal task training start is authenticated and rechecks live task validity', () => {
  assert.match(serverSource, /app\.post\('\/api\/debate\/start', optionalAuth/);
  assert.match(serverSource, /await validateTeamTaskTrainingStart\(req\.body, req\.user\)/);
  assert.match(serverSource, /async function validateTeamTaskTrainingStart[\s\S]*?if \(!isTaskActive\(task\)\)/);
  assert.match(serverSource, /await requireTaskAssignedToUser\(task, authUser\.id\)/);
});
