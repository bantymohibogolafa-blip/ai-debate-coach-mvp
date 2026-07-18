import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTrainingMessageView } from '../src/utils/trainingMessageView.js';

test('keeps the unanswered AI tail only in the current-round view', () => {
  const history = [
    { role: 'ai', content: 'question one' },
    { role: 'user', content: 'answer one' },
    { role: 'ai', content: 'question two' }
  ];

  const view = buildTrainingMessageView(history, true);

  assert.deepEqual(view.historyEntries, [
    { message: history[0], originalIndex: 0 },
    { message: history[1], originalIndex: 1 }
  ]);
  assert.equal(view.currentAiMessage, history[2]);
  assert.equal(view.currentAiMessageIndex, 2);
  assert.equal(history.length, 3);
});

test('does not reuse an earlier AI message while waiting after a user answer', () => {
  const history = [
    { role: 'ai', content: 'question one' },
    { role: 'user', content: 'answer one' }
  ];

  const view = buildTrainingMessageView(history, true);

  assert.deepEqual(view.historyEntries.map(({ originalIndex }) => originalIndex), [0, 1]);
  assert.equal(view.currentAiMessage, null);
  assert.equal(view.currentAiMessageIndex, -1);
});

test('shows the complete record once training has ended', () => {
  const history = [
    { role: 'ai', content: 'question' },
    { role: 'user', content: 'answer' },
    { role: 'assistant', content: 'final prompt' }
  ];

  const view = buildTrainingMessageView(history, false);

  assert.deepEqual(view.historyEntries.map(({ originalIndex }) => originalIndex), [0, 1, 2]);
  assert.equal(view.currentAiMessage, null);
});

test('handles empty and invalid histories without mutating input', () => {
  const history = [];

  assert.deepEqual(buildTrainingMessageView(history, true), {
    historyEntries: [],
    currentAiMessage: null,
    currentAiMessageIndex: -1
  });
  assert.deepEqual(buildTrainingMessageView(null, true).historyEntries, []);
  assert.deepEqual(history, []);
});

test('uses the same current-message split for all six training modes', () => {
  const modes = ['attack', 'defense', 'constructive', 'free_debate', 'summary', 'closing'];
  const history = [
    { role: 'ai', content: 'question one' },
    { role: 'user', content: 'answer one' },
    { role: 'ai', content: 'question two' }
  ];

  for (const mode of modes) {
    const view = buildTrainingMessageView(history, true);
    assert.deepEqual(
      view.historyEntries.map(({ originalIndex }) => originalIndex),
      [0, 1],
      `${mode} should exclude the current unanswered AI message from history`
    );
    assert.equal(view.currentAiMessage, history[2]);
  }
});
