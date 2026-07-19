import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCompletedPolishResult,
  createPendingPolishResult,
  createPolishRequestSnapshot,
  getPolishSelectionText,
  shouldApplyPolishResponse
} from '../src/utils/polishWorkspace.js';

const trainingModes = ['attack', 'defense', 'constructive', 'free_debate', 'summary', 'closing'];

function createRequest(answer, requestId = 1, trainingMode = 'attack') {
  return createPolishRequestSnapshot({
    answer,
    polishType: 'structured',
    requestId,
    trainingMode,
    modeDisplayName: trainingMode
  });
}

test('binds every generation to the answer at click time in all six modes', () => {
  for (const mode of trainingModes) {
    const first = createRequest('  原稿 A  ', 1, mode);
    const second = createRequest('  新稿 B  ', 2, mode);

    assert.equal(first.sourceText, '原稿 A');
    assert.equal(second.sourceText, '新稿 B');
    assert.equal(createPendingPolishResult(second).sourceText, '新稿 B');
  }
});

test('keeps the second request source in its completed result and original selection', () => {
  const request = createRequest('新稿 B', 2);
  const result = createCompletedPolishResult(request, {
    generatedDraft: '整理稿 B',
    generatedLabel: '结构优化',
    generatedType: 'structured',
    modeDisplayName: '攻辩训练',
    tip: '提示'
  });

  assert.equal(result.sourceText, '新稿 B');
  assert.equal(getPolishSelectionText(result, 'original'), '新稿 B');
  assert.equal(getPolishSelectionText(result, 'generated'), '整理稿 B');
});

test('rejects an older request after the answer changes or a newer request starts', () => {
  const first = createRequest('原稿 A', 1);
  const second = createRequest('新稿 B', 2);

  assert.equal(shouldApplyPolishResponse({
    activeRequestId: 1,
    request: first,
    currentAnswer: '新稿 B',
    currentTrainingMode: 'attack'
  }), false);
  assert.equal(shouldApplyPolishResponse({
    activeRequestId: 2,
    request: first,
    currentAnswer: '新稿 B',
    currentTrainingMode: 'attack'
  }), false);
  assert.equal(shouldApplyPolishResponse({
    activeRequestId: 2,
    request: second,
    currentAnswer: '新稿 B',
    currentTrainingMode: 'attack'
  }), true);
});

test('does not reuse a request after switching training modes', () => {
  const request = createRequest('模式内原稿', 3, 'attack');

  assert.equal(shouldApplyPolishResponse({
    activeRequestId: 3,
    request,
    currentAnswer: '模式内原稿',
    currentTrainingMode: 'defense'
  }), false);
});

test('selection helper leaves final submission choice with the caller', () => {
  const request = createRequest('用户当前原稿', 4);
  const result = createCompletedPolishResult(request, {
    generatedDraft: '用户当前整理稿',
    generatedLabel: '整理稿',
    generatedType: 'structured',
    tip: ''
  });

  assert.equal(getPolishSelectionText(result, 'original'), '用户当前原稿');
  assert.equal(getPolishSelectionText(result, 'generated'), '用户当前整理稿');
});
