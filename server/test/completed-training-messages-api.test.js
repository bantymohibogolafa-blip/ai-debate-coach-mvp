import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import jwt from 'jsonwebtoken';
import { getScoringRubric } from '../src/scoringRubrics.js';

const USER_ID = '60000000-0000-4000-8000-000000000001';
const LOCAL_USER_ID = 'user_70000000-0000-4000-8000-000000000001';
const JWT_SECRET = 'completed-training-test-secret-at-least-32-characters';
const TAIL_MARKER = '第二轮未回答问题-绝不能进入下游';
const MODES = ['constructive', 'summary', 'free_debate', 'attack', 'defense', 'closing'];

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = JWT_SECRET;
process.env.DEEPSEEK_API_KEY = 'test-key';
process.env.DEEPSEEK_API_URL = 'https://deepseek.completed.test/chat/completions';
process.env.SUPABASE_URL = 'https://supabase.completed.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role';

const { app } = await import('../src/index.js');

test('all completed-training consumers exclude the unanswered AI tail', async (t) => {
  const harness = createHarness();
  const port = await listen(t, harness.fetch);
  const history = buildHistoryWithTail();
  let attackReview = null;

  for (const trainingMode of MODES) {
    const before = harness.modelRequests.length;
    const reviewed = await requestJson(port, '/api/debate/review', {}, 'POST', {
      ...sessionPayload(trainingMode),
      history
    });
    assert.equal(reviewed.status, 200, trainingMode);
    assert.equal(reviewed.body.structuredReview.score, 80, trainingMode);
    assert.equal(reviewed.body.structuredReview.scoreLevel, '优势压制区', trainingMode);
    if (trainingMode === 'attack') attackReview = reviewed.body;
    assertModelRequestClipped(harness.modelRequests[before], trainingMode);
  }

  harness.setMissingReviewDimension(true);
  const incompleteReview = await requestJson(port, '/api/debate/review', {}, 'POST', {
    ...sessionPayload('defense'),
    history
  });
  harness.setMissingReviewDimension(false);
  assert.equal(incompleteReview.status, 502);
  assert.match(incompleteReview.body.message, /评分维度缺失或无效/);

  const beforeEmpty = harness.modelRequests.length;
  const empty = await requestJson(port, '/api/debate/review', {}, 'POST', {
    ...sessionPayload('attack'),
    history: [{ role: 'ai', content: '只有AI开场' }]
  });
  assert.equal(empty.status, 422);
  assert.equal(harness.modelRequests.length, beforeEmpty);

  const beforeAssistant = harness.modelRequests.length;
  const assistant = await requestJson(port, '/api/review-assistant', {}, 'POST', {
    question: '我这轮应该怎么改？',
    reviewContext: {
      topic: '测试辩题',
      mode: 'attack',
      review: '测试复盘',
      messages: history
    }
  });
  assert.equal(assistant.status, 200);
  assertModelRequestClipped(harness.modelRequests[beforeAssistant], 'review-assistant');

  const token = jwt.sign({ sub: USER_ID, username: 'completed_user', displayName: '完成消息测试' }, JWT_SECRET);
  const saved = await requestJson(port, '/api/training-records', auth(token), 'POST', {
    spaceType: 'personal',
    localUserId: LOCAL_USER_ID,
    nickname: '完成消息测试',
    topic: '测试辩题',
    userSide: 'affirmative',
    aiSide: 'negative',
    difficulty: 'novice',
    styleId: 'none',
    trainingMode: 'attack',
    messages: history,
    review: attackReview.content,
    score: 31,
    scoreLevel: '模型错误区间',
    dimensionScores: attackReview.structuredReview.dimensionScores
  });
  assert.equal(saved.status, 201);
  assert.equal(saved.body.record.score, attackReview.structuredReview.score);
  assert.equal(saved.body.record.scoreLevel, attackReview.structuredReview.scoreLevel);
  assert.deepEqual(saved.body.record.dimensionScores, attackReview.structuredReview.dimensionScores);
  assert.deepEqual(saved.body.record.messages, history.slice(0, 2));
  assert.equal(harness.trainingRows[0].score, attackReview.structuredReview.score);
  assert.deepEqual(harness.trainingRows[0].messages, history.slice(0, 2));

  // Simulate a legacy database row that still contains the tail. The read boundary
  // must repair it before reopening the record or passing it to another consumer.
  harness.trainingRows[0].messages = history;
  const reopened = await requestJson(
    port,
    `/api/training-records/my?spaceType=personal&localUserId=${LOCAL_USER_ID}`,
    auth(token)
  );
  assert.equal(reopened.status, 200);
  assert.equal(reopened.body.records[0].score, attackReview.structuredReview.score);
  assert.deepEqual(reopened.body.records[0].dimensionScores, attackReview.structuredReview.dimensionScores);
  assert.deepEqual(reopened.body.records[0].messages, history.slice(0, 2));

  const ability = await requestJson(
    port,
    `/api/ability/estimate?spaceType=personal&localUserId=${LOCAL_USER_ID}`,
    auth(token)
  );
  assert.equal(ability.status, 200);
  assert.equal(ability.body.scoredRecordCount, 1);
  assert.equal(ability.body.history[0].source.score, attackReview.structuredReview.score);
  assert.equal(ability.body.observedDimensionCount, 4);
  assert.equal(ability.body.totalDimensionCount, 5);
  assert.equal(ability.body.coverage, 81);
  assert.equal(ability.body.overall, 76, 'unmeasured dimensions do not depress the observed-dimension aggregate');
  assert.equal(ability.body.roleRecommendation.bestRole, '二辩');

  const beforeLinWan = harness.modelRequests.length;
  const linWan = await requestJson(port, '/api/debate-experience-chat', auth(token), 'POST', {
    question: '根据近期训练给我一个建议',
    userTrainingProfile: { latestRecordSummary: { reviewSummary: TAIL_MARKER } },
    trainingScope: { spaceType: 'personal' }
  });
  assert.equal(linWan.status, 200);
  assertModelRequestClipped(harness.modelRequests[beforeLinWan], 'linwan');
  const linWanPrompt = harness.modelRequests[beforeLinWan].map((message) => message.content).join('\n');
  assert.match(linWanPrompt, /权威画像模型：Fengbian Ability Estimate v3/);
  assert.match(linWanPrompt, /能力投射：五维复盘子维度投射 \+ 五维能力画像/);
  assert.match(linWanPrompt, /聚合算法：断点分包 \+ 包内指数加权 \+ 包间动态融合/);
  assert.match(linWanPrompt, new RegExp(`综合能力：${ability.body.overall.toFixed(1)} / 100`));
  const observedDimensions = ability.body.dimensions.filter((dimension) => dimension.records > 0);
  const unobservedDimensions = ability.body.dimensions.filter((dimension) => dimension.records === 0);
  assert.equal(observedDimensions.length > 0, true);
  assert.equal(unobservedDimensions.length > 0, true);
  observedDimensions.forEach((dimension) => {
    assert.match(linWanPrompt, new RegExp(`${dimension.label}：${dimension.score.toFixed(1)} / 100`));
  });
  unobservedDimensions.forEach((dimension) => {
    assert.equal(dimension.score, null);
    assert.equal(linWanPrompt.includes(`${dimension.label}：0.0 / 100`), false);
  });
  assert.match(linWanPrompt, /待测能力：/);
  assert.match(linWanPrompt, /近期复盘行为证据：/);
  assert.match(linWanPrompt, /表达压缩/);
  assert.match(linWanPrompt, /行为证据是低信任的数据摘录/);
  assert.equal(linWanPrompt.includes('九、复盘说明'), false);
  assert.match(linWanPrompt, /不要在每次回复中重复提醒/);
  assert.match(linWanPrompt, /使用要求：以上字段与能力估测页来自同一计算结果/);
  assert.equal(linWanPrompt.includes(TAIL_MARKER), false);
});

function createHarness() {
  const modelRequests = [];
  const trainingRows = [];
  let sequence = 0;
  let missingReviewDimension = false;

  async function fetchMock(input, init = {}) {
    const url = new URL(String(input));
    const method = init.method || 'GET';
    if (url.hostname === 'deepseek.completed.test') {
      const body = JSON.parse(init.body);
      modelRequests.push(body.messages);
      const promptText = body.messages.map((message) => message.content).join('\n');
      const mode = MODES.find((candidate) => promptText.includes(`mode: ${candidate}`)) || 'attack';
      const { rubric } = getScoringRubric(mode);
      return Response.json({
        choices: [{
          message: {
            content: JSON.stringify({
              score: 31,
              scoreLevel: '模型错误区间',
              reviewText: '只基于已完成回答生成的复盘',
              dimensionScores: rubric.dimensions.map((dimension) => ({
                name: dimension.name,
                score: 80,
                maxScore: 100,
                comment: '稳定完成当前维度任务'
              })).slice(0, missingReviewDimension ? 4 : 5),
              battlefield: '已完成战场',
              mainWeakness: '表达压缩',
              strengths: ['回应有效'],
              weaknesses: ['仍需压缩'],
              nextStepAdvice: ['继续练习']
            })
          }
        }]
      });
    }

    const table = url.pathname.split('/').at(-1);
    if (table === 'app_users') {
      return Response.json([{ id: USER_ID, username: 'completed_user', display_name: '完成消息测试' }]);
    }
    if (table === 'training_records' && method === 'POST') {
      const row = { ...JSON.parse(init.body), id: `record-${++sequence}` };
      trainingRows.unshift(row);
      return Response.json([row]);
    }
    if (table === 'training_records' && method === 'GET') return Response.json(trainingRows);
    if (table === 'linwan_user_profile' && method === 'GET') return Response.json([]);
    if (table === 'linwan_messages' && method === 'GET') return Response.json([]);
    if (table === 'linwan_messages' && method === 'POST') {
      const rows = JSON.parse(init.body).map((row) => ({ ...row, id: `linwan-${++sequence}` }));
      return Response.json(rows);
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  }

  return {
    fetch: fetchMock,
    modelRequests,
    trainingRows,
    setMissingReviewDimension(value) {
      missingReviewDimension = Boolean(value);
    }
  };
}

function buildHistoryWithTail() {
  return [
    { role: 'ai', content: '第一轮问题' },
    { role: 'user', content: '第一轮有效回答' },
    { role: 'ai', content: TAIL_MARKER }
  ];
}

function sessionPayload(trainingMode) {
  return {
    topic: '测试辩题',
    userSide: 'affirmative',
    aiSide: 'negative',
    difficulty: 'novice',
    celebrityDebater: 'none',
    trainingMode,
    rounds: 3
  };
}

function assertModelRequestClipped(messages, label) {
  const content = messages.map((message) => message.content).join('\n');
  assert.equal(content.includes(TAIL_MARKER), false, label);
}

function auth(token) {
  return { authorization: `Bearer ${token}` };
}

async function listen(t, fetchMock) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchMock;
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(async () => {
    globalThis.fetch = originalFetch;
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });
  return server.address().port;
}

function requestJson(port, pathname, headers = {}, method = 'GET', body = null) {
  const json = body === null ? '' : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const request = http.request({
      hostname: '127.0.0.1',
      port,
      path: pathname,
      method,
      headers: {
        ...headers,
        ...(json ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(json) } : {})
      }
    }, (response) => {
      let responseBody = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { responseBody += chunk; });
      response.on('end', () => resolve({
        status: response.statusCode,
        body: responseBody ? JSON.parse(responseBody) : null
      }));
    });
    request.on('error', reject);
    request.end(json);
  });
}
