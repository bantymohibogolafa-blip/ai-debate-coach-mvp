import assert from 'node:assert/strict';
import test from 'node:test';
import { getTaskDerivedStatus, isTaskActive, isTaskExpired } from '../../shared/teamTaskDeadline.js';

const now = Date.parse('2026-08-12T12:00:00.000Z');

test('active task before its deadline remains trainable', () => {
  const task = { status: 'active', deadline: '2026-08-12T12:01:00.000Z' };
  assert.equal(isTaskExpired(task, now), false);
  assert.equal(isTaskActive(task, now), true);
  assert.equal(getTaskDerivedStatus(task, now), 'active');
});

test('active task after its deadline is expired and not trainable', () => {
  const task = { status: 'active', deadline: '2026-08-12T11:59:00.000Z' };
  assert.equal(isTaskExpired(task, now), true);
  assert.equal(isTaskActive(task, now), false);
  assert.equal(getTaskDerivedStatus(task, now), 'expired');
});

test('ended status takes priority over an expired deadline', () => {
  const task = { status: 'ended', deadline: '2026-08-12T11:59:00.000Z' };
  assert.equal(getTaskDerivedStatus(task, now), 'ended');
  assert.equal(isTaskActive(task, now), false);
});

test('missing or invalid deadlines do not expire active tasks', () => {
  for (const deadline of [null, '', 'not-a-date']) {
    const task = { status: 'active', deadline };
    assert.equal(isTaskExpired(task, now), false);
    assert.equal(isTaskActive(task, now), true);
  }
});
