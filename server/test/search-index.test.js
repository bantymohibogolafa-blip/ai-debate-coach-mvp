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

test('searchEvidence uses Chinese primary queries first and skips foreign supplement when quality is sufficient', async () => {
  const sent = [];
  const result = await searchEvidence({
    apiKey: 'test-key',
    queries: [
      {
        displayQuery: '人工智能与创造力的中文研究、数据和案例',
        searchQuery: '人工智能 创造力 研究 数据 案例',
        zone: 'cn', language: 'zh-CN', phase: 'primary'
      },
      {
        displayQuery: '生成式人工智能降低创作门槛的外文原始研究',
        searchQuery: 'generative AI creativity democratization evidence study',
        zone: 'intl', language: 'en', phase: 'supplemental'
      }
    ],
    fetchImpl: async (url, init) => {
      const body = JSON.parse(init.body);
      sent.push(body.query);
      return Response.json({
        code: 0,
        data: {
          results: [1, 2, 3].map((index) => ({
            title: `中国高校人工智能创造力研究${index}`,
            url: `https://research${index}.edu.cn/report`,
            snippet: '研究报告提供了可核验的数据、研究方法、调查结果和适用范围。',
            content: '这是一项由高校发布的完整中文研究材料，包含样本、研究方法、统计数据、结论与局限。'
          }))
        }
      });
    }
  });
  assert.deepEqual(sent, ['人工智能 创造力 研究 数据 案例']);
  assert.equal(result.usedForeignSupplement, false);
  assert.equal(result.chineseAssessment.sufficient, true);
  assert.equal(result.queries[1].searchQuery, 'generative AI creativity democratization evidence study');
  assert.equal(result.queries[1].displayQuery, '生成式人工智能降低创作门槛的外文原始研究');
});

test('searchEvidence supplements with a foreign query only when Chinese evidence is insufficient', async () => {
  const sent = [];
  const result = await searchEvidence({
    apiKey: 'test-key',
    queries: [
      { displayQuery: '前沿研究的中文资料', searchQuery: '前沿研究 中文论文', language: 'zh-CN', phase: 'primary' },
      { displayQuery: '前沿研究的外文原始论文', searchQuery: 'frontier original research paper', zone: 'intl', language: 'en', phase: 'supplemental' }
    ],
    fetchImpl: async (url, init) => {
      const body = JSON.parse(init.body);
      sent.push(body.query);
      return Response.json({
        code: 0,
        data: { results: body.language === 'en'
          ? [{ title: 'Original Research', url: 'https://example.edu/paper', snippet: 'Original peer reviewed study.' }]
          : [] }
      });
    }
  });
  assert.deepEqual(sent, ['前沿研究 中文论文', 'frontier original research paper']);
  assert.equal(result.usedForeignSupplement, true);
});
