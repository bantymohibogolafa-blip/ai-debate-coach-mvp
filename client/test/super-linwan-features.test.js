import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const prepSource = fs.readFileSync(
  fileURLToPath(new URL('../src/components/SuperLinWanPrep.jsx', import.meta.url)),
  'utf8'
);

test('evidence entries use one shared card with source text, Chinese explanation, and application analysis', () => {
  assert.equal((prepSource.match(/function MessageEvidenceSources/g) || []).length, 1);
  assert.match(prepSource, /论据内容/);
  assert.match(prepSource, /来源名称/);
  assert.match(prepSource, /相关原文/);
  assert.match(prepSource, /中文翻译或说明/);
  assert.match(prepSource, /适用分析/);
  assert.match(prepSource, /source\.contentExcerpt/);
  assert.match(prepSource, /source\.chineseExplanation/);
  assert.match(prepSource, /source\.applicationAnalysis/);
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
