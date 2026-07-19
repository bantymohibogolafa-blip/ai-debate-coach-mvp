import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildReviewableMessages,
  hasUnansweredAssistantTail,
  withCompletedTrainingMessages
} from '../../shared/completedTrainingMessages.js';

const allTrainingModes = ['constructive', 'summary', 'free_debate', 'attack', 'defense', 'closing'];

test('clips an unanswered AI tail after the last meaningful user answer', () => {
  const history = [
    { role: 'ai', content: '第一轮问题' },
    { role: 'user', content: '第一轮有效回答' },
    { role: 'ai', content: '第二轮未回答问题' }
  ];

  assert.deepEqual(buildReviewableMessages(history), history.slice(0, 2));
  assert.equal(hasUnansweredAssistantTail(history), true);
  assert.equal(history.length, 3, 'the original training history is not mutated');
});

test('keeps two complete rounds and rejects an AI-only opening', () => {
  const completed = [
    { role: 'ai', content: '第一轮问题' },
    { role: 'user', content: '第一轮回答' },
    { role: 'ai', content: '第二轮问题' },
    { role: 'user', content: '第二轮回答' }
  ];

  assert.deepEqual(buildReviewableMessages(completed), completed);
  assert.deepEqual(buildReviewableMessages([{ role: 'ai', content: '开场问题' }]), []);
});

test('normalizes saved or reopened records to completed messages', () => {
  const record = {
    id: 'record-1',
    messages: [
      { role: 'ai', content: '第一轮问题' },
      { role: 'user', content: '第一轮回答' },
      { role: 'ai', content: '不应重新显示的第二轮问题' }
    ]
  };
  const normalized = withCompletedTrainingMessages(record);

  assert.equal(normalized.messages.length, 2);
  assert.equal(normalized.messages.some((item) => item.content.includes('第二轮')), false);
  assert.equal(record.messages.length, 3);
});

test('uses the same completed-message boundary for all six training modes', () => {
  allTrainingModes.forEach((mode) => {
    const history = [
      { role: 'ai', content: `${mode}-第一轮问题` },
      { role: 'user', content: `${mode}-第一轮回答` },
      { role: 'ai', content: `${mode}-未回答尾消息` }
    ];
    assert.deepEqual(buildReviewableMessages(history), history.slice(0, 2), mode);
  });
});
