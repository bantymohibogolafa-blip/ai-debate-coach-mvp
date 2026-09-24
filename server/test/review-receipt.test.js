import assert from 'node:assert/strict';
import test from 'node:test';
import jwt from 'jsonwebtoken';
import { fingerprintReviewMessages, signReviewReceipt, verifyReviewReceipt } from '../src/reviewReceipt.js';

const KEY = 'review-receipt-test-secret-at-least-32-characters';
const base = {
  identity: { appUserId: 'user-1', localUserId: 'local-1', spaceType: 'personal', teamCode: '', taskId: '' },
  session: { topic: '测试辩题', messages: [{ role: 'ai', content: '请回答' }, { role: 'user', content: '我的回答' }], messagesDigest: fingerprintReviewMessages([{ role: 'ai', content: '请回答' }, { role: 'user', content: '我的回答' }]) },
  review: { score: 76, content: '服务端复盘', dimensionScores: [{ name: '示例维度', score: 76 }] }
};

test('review receipt authenticates the server result and retains a unique reviewId', () => {
  const first = signReviewReceipt(base, KEY);
  const second = signReviewReceipt(base, KEY);
  assert.notEqual(first.reviewId, second.reviewId);
  assert.equal(verifyReviewReceipt(first.reviewReceipt, KEY).review.score, 76);
  assert.equal(verifyReviewReceipt(first.reviewReceipt, KEY).reviewId, first.reviewId);
});

test('missing, altered, and unrelated receipts are rejected', () => {
  const { reviewReceipt } = signReviewReceipt(base, KEY);
  assert.throws(() => verifyReviewReceipt('', KEY), /缺少有效/);
  assert.throws(() => verifyReviewReceipt(reviewReceipt + 'bad', KEY), /校验失败/);
  assert.throws(() => verifyReviewReceipt(reviewReceipt, 'another-long-secret-at-least-32-characters'), /校验失败/);
});

test('message fingerprint excludes unanswered tail only when upstream clips it', () => {
  const messages = [{ role: 'ai', content: '问题' }, { role: 'user', content: '回答' }];
  assert.equal(fingerprintReviewMessages(messages), fingerprintReviewMessages([{ role: 'assistant', content: '问题' }, { role: 'user', content: '回答' }]));
  assert.notEqual(fingerprintReviewMessages(messages), fingerprintReviewMessages([...messages, { role: 'ai', content: '尾巴' }]));
});

test('expired receipts and tokens for another purpose cannot authorize saves', () => {
  const payload = jwt.decode(signReviewReceipt(base, KEY).reviewReceipt);
  assert.throws(() => verifyReviewReceipt(jwt.sign({ ...payload, exp: 1 }, KEY), KEY), { status: 410 });
  assert.throws(() => verifyReviewReceipt(jwt.sign({ ...payload, aud: 'another-purpose' }, KEY), KEY), { status: 403 });
  assert.throws(() => verifyReviewReceipt(jwt.sign({ sub: 'user-1' }, KEY), KEY), { status: 403 });
  assert.throws(() => verifyReviewReceipt(jwt.sign(payload, KEY, { algorithm: 'HS384' }), KEY), { status: 403 });
});

test('the issuer never returns a receipt larger than the verifier accepts', () => {
  assert.throws(() => signReviewReceipt({ ...base, review: { ...base.review, content: '长'.repeat(60000) } }, KEY), { status: 413 });
});
