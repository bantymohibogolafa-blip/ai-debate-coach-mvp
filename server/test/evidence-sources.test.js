import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canonicalizeEvidenceUrl,
  cleanEvidenceResults,
  mergeEvidenceLibrary,
  normalizeEvidenceLibrary,
  publicEvidenceSource
} from '../src/search/evidenceSources.js';

test('source cleaning filters invalid URLs, deduplicates tracking variants and bounds fields', () => {
  const long = '字'.repeat(3000);
  const sources = cleanEvidenceResults([
    { title: 'bad', url: 'javascript:alert(1)', snippet: 'x' },
    { title: '', url: 'https://empty.example/', snippet: '', content: '' },
    { title: long, url: 'https://example.com/path?utm_source=x#one', snippet: long, content: long },
    { title: 'duplicate', url: 'https://example.com/path#two', snippet: 'duplicate' },
    { title: 'unknown', url: 'https://unknown.example/item', snippet: 'ok' }
  ], { contextLimit: 1900 });
  assert.equal(sources.length, 2);
  assert.equal(sources[0].id, 'E1');
  assert.equal(sources[0].title.length, 240);
  assert.equal(sources[0].snippet.length, 500);
  assert.ok(sources[0].contentExcerpt.length <= 1800);
  assert.equal(sources[1].sourceType, 'other');
  assert.ok(sources.reduce((sum, item) => sum + item.contentExcerpt.length, 0) <= 1900);
  assert.equal(canonicalizeEvidenceUrl('ftp://example.com/a'), null);
});

test('source IDs stay stable across rounds and full content is not persisted', () => {
  const existing = [{
    id: 'E4', title: 'Saved', url: 'https://example.com/a#old', domain: 'wrong',
    snippet: 'saved', sourceType: 'academic', query: 'q', retrievedAt: '2026-01-01T00:00:00Z'
  }];
  const cleaned = cleanEvidenceResults([
    { title: 'Again', url: 'https://example.com/a?utm_campaign=x', snippet: 'again', content: 'full A' },
    { title: 'New', url: 'https://example.com/b', snippet: 'new', content: 'full B' }
  ], { existingLibrary: existing });
  assert.deepEqual(cleaned.map((item) => item.id), ['E4', 'E5']);
  const merged = mergeEvidenceLibrary(existing, cleaned);
  assert.deepEqual(merged.map((item) => item.id), ['E4', 'E5']);
  assert.equal(Object.hasOwn(merged[1], 'content'), false);
  assert.equal(Object.hasOwn(merged[1], 'contentExcerpt'), false);
  assert.deepEqual(normalizeEvidenceLibrary(merged), merged);
});

test('one evidence round keeps at most five concise sources', () => {
  const sources = cleanEvidenceResults(Array.from({ length: 8 }, (_, index) => ({
    title: `来源 ${index + 1}`,
    url: `https://example.com/source-${index + 1}`,
    snippet: `摘要 ${index + 1}`
  })));
  assert.equal(sources.length, 5);
  assert.deepEqual(sources.map((item) => item.id), ['E1', 'E2', 'E3', 'E4', 'E5']);
});

test('quality ranking does not let a low-quality Chinese page displace an authoritative foreign source', () => {
  const sources = cleanEvidenceResults([
    {
      title: '无来源中文观点',
      url: 'https://zhihu.com/question/1',
      snippet: '没有作者、数据或原始出处的中文内容。',
      sourceLanguage: 'zh-CN',
      sourceQuality: 0
    },
    {
      title: 'Authoritative Original Study',
      url: 'https://research.example.edu/paper',
      snippet: 'Peer reviewed original research with methods and data.',
      sourceLanguage: 'foreign',
      sourceType: 'academic',
      sourceQuality: 5
    }
  ]);
  assert.equal(sources[0].title, 'Authoritative Original Study');
  const publicSource = publicEvidenceSource(sources[0]);
  assert.equal(publicSource.sourceLanguageLabel, '外文原始资料');
  assert.equal(publicSource.isPrimarySource, true);
});

test('public evidence keeps concise display fields separate from hidden source excerpts', () => {
  const [source] = cleanEvidenceResults([{
    title: 'Original Research Title',
    url: 'https://example.edu/paper.pdf',
    snippet: 'English search snippet that should not be the default card body.',
    content: 'A longer original passage reserved for explicit expansion.',
    sourceLanguage: 'foreign',
    sourceType: 'academic',
    publisher: 'Example University',
    publishedAt: '2025-05-06'
  }]);
  const publicSource = publicEvidenceSource({
    ...source,
    evidenceTitle: '生成式 AI 降低参与创作的技术门槛',
    displaySummary: '该研究说明创作门槛下降，可支持效率观点；但不能单独证明长期创造力提高。'
  });

  assert.equal(publicSource.sourceTitle, 'Original Research Title');
  assert.equal(publicSource.sourceUrl, 'https://example.edu/paper.pdf');
  assert.equal(publicSource.sourceExcerpt, 'A longer original passage reserved for explicit expansion.');
  assert.match(publicSource.displaySummary, /不能单独证明/);
  assert.equal(publicSource.publisher, 'Example University');
  assert.equal(publicSource.publishedAt, '2025-05-06T00:00:00.000Z');
});
