import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canonicalizeEvidenceUrl,
  cleanEvidenceResults,
  mergeEvidenceLibrary,
  normalizeEvidenceLibrary
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
