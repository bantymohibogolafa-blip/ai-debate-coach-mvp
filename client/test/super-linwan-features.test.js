import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const prepSource = fs.readFileSync(
  fileURLToPath(new URL('../src/components/SuperLinWanPrep.jsx', import.meta.url)),
  'utf8'
);
const styleSource = fs.readFileSync(
  fileURLToPath(new URL('../src/styles.css', import.meta.url)),
  'utf8'
);

test('evidence entries render only an ID, language tag, title, safe summary and source link', () => {
  assert.equal((prepSource.match(/function MessageEvidenceSources/g) || []).length, 1);
  assert.match(prepSource, /evidenceDisplaySummary\(source\)/);
  assert.match(prepSource, /evidenceCardTitle\(source\)/);
  assert.match(prepSource, /简体中文资料/);
  assert.match(prepSource, /外文资料 · 中文摘要/);
  assert.match(prepSource, /查看原始来源/);
  assert.equal(prepSource.includes('prematch-evidence-meta'), false);
  assert.equal(prepSource.includes('prematch-evidence-original'), false);
  assert.equal(prepSource.includes('source.sourceExcerpt'), false);
  assert.equal(prepSource.includes('source.contentExcerpt'), false);
  assert.equal(prepSource.includes('source.snippet'), false);
  assert.match(styleSource, /-webkit-line-clamp:\s*6/);
});

test('scope adjustment, task note, and latest-round revocation use the existing task API', () => {
  assert.match(prepSource, /isAdjustingEvidenceScope \? 'adjust' : 'plan'/);
  assert.match(prepSource, /evidenceAction: resolvedEvidenceAction/);
  assert.match(prepSource, /\/note`/);
  assert.match(prepSource, /保存笔记/);
  assert.match(prepSource, /\/revoke-latest`/);
  assert.match(prepSource, /撤回本轮/);
  assert.match(prepSource, /expectedVersion: detail\.task\.version/);
});

test('evidence scope renders only Chinese displayQuery and keeps internal searchQuery hidden', () => {
  const component = prepSource.slice(prepSource.indexOf('function MessageEvidenceSources'));
  assert.match(component, /item\.displayQuery/);
  assert.equal(component.includes('item.searchQuery'), false);
  assert.equal(component.includes('item.query'), false);
  assert.match(component, /简体中文资料/);
  assert.match(component, /外文资料 · 中文摘要/);
  assert.match(component, /search\.languageNotice/);
  assert.match(prepSource, /visiblePrematchMessageContent\(message\)/);
  assert.match(prepSource, /search\?\.status === 'pending_confirmation'/);
  assert.match(prepSource, /已按你的需求整理本轮中文检索范围/);
});

test('instant challenge stays in the existing chat flow with lightweight controls and message types', () => {
  assert.match(prepSource, /检验一下/);
  assert.match(prepSource, /让林婉从对方角度追问当前思路/);
  assert.match(prepSource, /challengeAction: 'start'/);
  assert.match(prepSource, /challengeAction: 'answer'/);
  assert.match(prepSource, /challengeAction: 'repeat'/);
  assert.match(prepSource, /challenge_question/);
  assert.match(prepSource, /challenge_answer/);
  assert.match(prepSource, /challenge_feedback/);
  assert.match(prepSource, /再检验一次/);
  assert.match(prepSource, /结束检验/);
  assert.match(prepSource, /challengeState\.round < 3/);
  assert.match(prepSource, /latestStoredUserMessage\?\.contextManifest\?\.challenge/);
});
