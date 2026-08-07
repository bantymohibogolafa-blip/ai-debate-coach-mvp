import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EVIDENCE_CARD_SUMMARY_FALLBACK,
  EVIDENCE_CARD_SUMMARY_LIMIT,
  EVIDENCE_CARD_TITLE_LIMIT,
  evidenceCardTitle,
  evidenceDisplaySummary
} from '../src/utils/evidenceCard.js';

test('evidence card hard-limits generated titles and summaries', () => {
  const title = evidenceCardTitle({ evidenceTitle: '生成式人工智能能够显著降低普通用户参与内容创作所需要掌握的技术门槛' });
  const summary = evidenceDisplaySummary({ displaySummary: `该研究认为，${'生成式人工智能可以提升创意生成与执行效率，'.repeat(12)}` });
  assert.ok(Array.from(title).length <= EVIDENCE_CARD_TITLE_LIMIT);
  assert.ok(Array.from(summary).length <= EVIDENCE_CARD_SUMMARY_LIMIT);
  assert.equal(summary.endsWith('…'), true);
});

test('legacy cards clean metadata and never read raw retrieval fields', () => {
  const summary = evidenceDisplaySummary({
    evidenceContent: '## DOI 10.1234/example 作者：张三；单位：某大学；发布日期：2025-01-01；## Abstract 研究发现AI能够提升创意执行效率。',
    applicationAnalysis: '可支持AI辅助创新，但不能证明AI可以替代人的核心判断。## References [1] 无关文献',
    snippet: '搜索引擎抓取的超长原文'.repeat(100),
    sourceExcerpt: '网页正文'.repeat(100),
    contentExcerpt: '论文全文'.repeat(100)
  });
  assert.match(summary, /可支持AI辅助创新/);
  assert.doesNotMatch(summary, /DOI|作者|单位|发布日期|Abstract|References|无关文献/);
  assert.doesNotMatch(summary, /搜索引擎抓取|网页正文|论文全文/);
  assert.ok(Array.from(summary).length <= EVIDENCE_CARD_SUMMARY_LIMIT);
});

test('missing generated and legacy AI summaries use only the safe prompt', () => {
  const summary = evidenceDisplaySummary({
    snippet: '搜索片段'.repeat(200),
    sourceExcerpt: '原始正文'.repeat(200)
  });
  assert.equal(summary, EVIDENCE_CARD_SUMMARY_FALLBACK);
});
