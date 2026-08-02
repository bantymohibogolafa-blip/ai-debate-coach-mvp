import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';

process.env.NODE_ENV = 'test';
process.env.DEEPSEEK_API_KEY = 'defense-analysis-test-key';
process.env.DEEPSEEK_API_URL = 'https://deepseek.defense-analysis.test/chat/completions';

const { app } = await import('../src/index.js');

test('defense start repairs an overloaded novice question before showing it to the student', { concurrency: false }, async (t) => {
  const requests = [];
  const outputs = [
    JSON.stringify({
      questionText: '你如何保证内容准确？并且如何确保学生永远不会形成错误认知？',
      targetPoint: '错误风险',
      requiredResponse: '请说明如何确保所有内容准确，并解释如何立即彻底阻断任何错误认知。'
    }),
    JSON.stringify({
      questionText: '学生遇到错误解释时，你方用什么机制降低误信风险？',
      targetPoint: '错误风险',
      requiredResponse: '说明一种降低学生误信错误解释风险的机制'
    })
  ];
  const port = await listen(t, async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return providerResponse(outputs.shift());
  });

  const response = await requestJson(port, defensePayload(), '/api/debate/start');
  assert.equal(response.status, 200);
  assert.equal(requests.length, 2);
  assert.match(requests[1].messages.at(-1).content, /一个问号、一个核心问题和一个回应义务/);
  assert.equal(response.body.defenseQuestion.requiredResponse, '说明一种降低学生误信错误解释风险的机制');
});

function analysis(overrides = {}) {
  return JSON.stringify({
    answerStatus: 'partially_answered',
    currentQuestionCompletion: 68,
    isCurrentQuestionAnswered: false,
    answeredQuestionIds: [],
    delayedAnswerQuestionIds: [],
    unresolvedPoints: ['尚未解释边界条件'],
    reason: '已经正面回应核心问题，但遗漏一项原定义务',
    followUpStrategy: 'press_unresolved_point',
    roundScore: {
      contentQuality: 72,
      currentQuestionRelevance: 78,
      responseCompleteness: 68,
      timeliness: 82,
      defensiveEffectiveness: 66,
      delayedRecoveryQuality: 0
    },
    nextQuestion: {
      questionText: '请只说明该边界条件。',
      targetPoint: '边界条件',
      requiredResponse: '说明该边界条件为何成立'
    },
    ...overrides
  });
}

test('defense response repairs an invalid schema exactly once without silently scoring it', { concurrency: false }, async (t) => {
  const requests = [];
  const outputs = [
    analysis({ currentQuestionCompletion: '约68分' }),
    analysis()
  ];
  const port = await listen(t, async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return providerResponse(outputs.shift());
  });

  const response = await requestJson(port, defensePayload());
  assert.equal(response.status, 200);
  assert.equal(response.body.defenseRoundState.currentQuestionCompletion, 68);
  assert.equal(response.body.defenseRoundState.isCurrentQuestionAddressed, true);
  assert.equal(requests.length, 2);
  assert.equal(requests[1].temperature, 0);
  assert.match(requests[1].messages.at(-1).content, /只修复格式/);
  assert.match(requests[1].messages.at(-1).content, /不得重新评价/);
});

test('defense response returns an explicit error when the single repair is still invalid', { concurrency: false }, async (t) => {
  let calls = 0;
  const port = await listen(t, async () => {
    calls += 1;
    return providerResponse(analysis({ currentQuestionCompletion: '仍然不是数字' }));
  });

  const response = await requestJson(port, defensePayload());
  assert.equal(response.status, 502);
  assert.match(response.body.message, /未计入本轮成绩/);
  assert.equal(calls, 2);
});

function defensePayload() {
  return {
    topic: '生成式人工智能对中学生学习利大于弊',
    userSide: 'affirmative',
    aiSide: 'negative',
    difficulty: 'novice',
    celebrityDebater: 'none',
    trainingMode: 'defense',
    rounds: 3,
    defensePrep: '生成式人工智能能够提供个性化反馈。',
    history: [
      { role: 'ai', content: '个性化反馈如何避免错误信息？' },
      { role: 'user', content: '通过教师审核与多源核验降低错误率。' }
    ],
    answer: '通过教师审核与多源核验降低错误率。',
    defenseRoundStates: [],
    currentDefenseQuestion: {
      roundNumber: 1,
      questionId: 'defense_round_1_question_1',
      questionText: '个性化反馈如何避免错误信息？',
      targetPoint: '错误信息风险',
      requiredResponse: '说明降低错误信息风险的具体机制'
    }
  };
}

function providerResponse(content) {
  return Response.json({
    choices: [{ message: { content }, finish_reason: 'stop' }]
  });
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

function requestJson(port, body, pathname = '/api/debate/respond') {
  const json = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const request = http.request({
      hostname: '127.0.0.1',
      port,
      path: pathname,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(json)
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
