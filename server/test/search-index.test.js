import assert from 'node:assert/strict';
import test from 'node:test';
import { searchEvidence } from '../src/search/index.js';

test('searchEvidence keeps successful queries when another query fails', async () => {
  const requests = [];
  const result = await searchEvidence({
    provider: 'anysearch',
    apiKey: 'test-key',
    queries: [
      { query: '成功查询', zone: 'cn', language: 'zh-CN' },
      { query: '失败查询', zone: 'intl', language: 'en' }
    ],
    fetchImpl: async (url, init) => {
      const body = JSON.parse(init.body);
      requests.push(body);
      if (body.query === '失败查询') return Response.json({ code: 400 }, { status: 400 });
      return Response.json({
        code: 0,
        request_id: 'partial-success',
        data: { results: [{ title: '保留结果', url: 'https://example.com/kept', snippet: 'ok' }] }
      });
    }
  });
  assert.equal(requests.length, 2);
  assert.equal(result.status, 'partial');
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].query, '成功查询');
  assert.equal(result.errors[0].code, 'invalid_query');
});

test('searchEvidence never dispatches more than three bounded queries', async () => {
  let calls = 0;
  const result = await searchEvidence({
    apiKey: 'test-key',
    queries: Array.from({ length: 5 }, (_, index) => ({ query: `查询 ${index + 1}` })),
    fetchImpl: async () => {
      calls += 1;
      return Response.json({ code: 0, data: { results: [] } });
    }
  });
  assert.equal(calls, 3);
  assert.equal(result.queries.length, 3);
});

test('searchEvidence strips identity and credential-shaped text before dispatch', async () => {
  let sentQuery = '';
  await searchEvidence({
    apiKey: 'test-key',
    sensitiveValues: ['真实姓名'],
    queries: [{
      query: '真实姓名 user@example.com 83000000-0000-4000-8000-000000000099 Bearer secret-token 人工智能研究'
    }],
    fetchImpl: async (url, init) => {
      sentQuery = JSON.parse(init.body).query;
      return Response.json({ code: 0, data: { results: [] } });
    }
  });
  assert.equal(sentQuery, '人工智能研究');
});
