import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import jwt from 'jsonwebtoken';
import { getScoringRubric } from '../src/scoringRubrics.js';
import {
  CURRENT_DIFFICULTY_CALIBRATION_VERSION,
  CURRENT_ESTIMATOR_VERSION,
  CURRENT_PROJECTION_VERSION,
  CURRENT_SCORING_VERSION
} from '../src/scoringVersions.js';

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
process.env.SUPABASE_TIMEOUT_MS = '25';

const { app } = await import('../src/index.js');

test('returns a recoverable 504 when a Supabase request times out', async (t) => {
  const port = await listen(t, async (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      reject(error);
    }, { once: true });
  }));

  const response = await requestJson(
    port,
    `/api/training-records?localUserId=${LOCAL_USER_ID}&spaceType=personal`
  );

  assert.equal(response.status, 504);
  assert.equal(response.body.message, '数据库服务响应超时，请稍后重试。');
});

test('all completed-training consumers exclude the unanswered AI tail', async (t) => {
  const harness = createHarness();
  const port = await listen(t, harness.fetch);
  const history = buildHistoryWithTail();
  let attackReview = null;
  let constructiveReview = null;

  for (const trainingMode of MODES) {
    const before = harness.modelRequests.length;
    const reviewed = await requestJson(port, '/api/debate/review', {}, 'POST', {
      ...sessionPayload(trainingMode),
      history
    });
    assert.equal(reviewed.status, 200, trainingMode);
    assert.equal(reviewed.body.structuredReview.score, trainingMode === 'defense' ? 66.5 : 80, trainingMode);
    assert.equal(
      reviewed.body.structuredReview.scoreLevel,
      ['constructive', 'summary', 'closing'].includes(trainingMode)
        ? '良好'
        : trainingMode === 'defense' ? '基本完成' : '校赛可用',
      trainingMode
    );
    assert.equal(reviewed.body.structuredReview.difficultyApplicable, !['constructive', 'summary', 'closing'].includes(trainingMode));
    assert.equal(
      reviewed.body.structuredReview.difficultyDisplayName,
      ['constructive', 'summary', 'closing'].includes(trainingMode) ? '统一标准' : '新手'
    );
    if (trainingMode === 'constructive') constructiveReview = reviewed.body;
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
  assert.equal(saved.body.record.scoringVersion, CURRENT_SCORING_VERSION);
  assert.equal(saved.body.record.rubricId, getScoringRubric('attack').rubric.id);
  assert.equal(saved.body.record.projectionVersion, CURRENT_PROJECTION_VERSION);
  assert.equal(saved.body.record.difficultyCalibrationVersion, CURRENT_DIFFICULTY_CALIBRATION_VERSION);
  assert.equal(saved.body.record.estimatorVersion, CURRENT_ESTIMATOR_VERSION);
  assert.equal(saved.body.record.difficultyApplicable, true);
  assert.equal(saved.body.record.difficultyDisplayName, '新手');
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
  assert.equal(reopened.body.records[0].scoringVersion, CURRENT_SCORING_VERSION);
  assert.deepEqual(reopened.body.records[0].messages, history.slice(0, 2));

  const ability = await requestJson(
    port,
    `/api/ability/estimate?spaceType=personal&localUserId=${LOCAL_USER_ID}`,
    auth(token)
  );
  assert.equal(ability.status, 200);
  assert.equal(ability.body.scoredRecordCount, 1);
  assert.equal(ability.body.history[0].source.score, attackReview.structuredReview.score);
  assert.equal(ability.body.history[0].source.scoringVersion, CURRENT_SCORING_VERSION);
  assert.equal(typeof ability.body.history[0].source.projectedOverall, 'number');
  assert.equal(typeof ability.body.history[0].source.projectedScores.logic, 'number');
  assert.equal(ability.body.history[0].overall, ability.body.history[0].source.projectedOverall);
  assert.equal(ability.body.observedDimensionCount, 4);
  assert.equal(ability.body.totalDimensionCount, 5);
  assert.equal(ability.body.coverage, 85);
  assert.equal(ability.body.overall, 79, 'novice applies the v2 base discount without filling unmeasured dimensions');
  assert.equal(ability.body.roleRecommendation.bestRole, '一辩');

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

  const savedText = await requestJson(port, '/api/training-records', auth(token), 'POST', {
    spaceType: 'personal',
    localUserId: LOCAL_USER_ID,
    nickname: '完成消息测试',
    topic: '测试辩题',
    userSide: 'affirmative',
    aiSide: 'negative',
    difficulty: 'city',
    styleId: 'none',
    trainingMode: 'constructive',
    messages: history,
    review: constructiveReview.content,
    score: 99,
    scoreLevel: '伪造高分',
    dimensionScores: constructiveReview.structuredReview.dimensionScores
  });
  assert.equal(savedText.status, 201);
  assert.equal(savedText.body.record.difficulty, 'novice', '数据库兼容值仍使用 novice');
  assert.equal(savedText.body.record.difficultyApplicable, false);
  assert.equal(savedText.body.record.difficultyDisplayName, '统一标准');
  assert.equal(harness.trainingRows[0].difficulty, 'novice');

  const textHistory = await requestJson(
    port,
    `/api/training-records/my?spaceType=personal&localUserId=${LOCAL_USER_ID}`,
    auth(token)
  );
  assert.equal(textHistory.status, 200);
  assert.equal(textHistory.body.records[0].difficultyApplicable, false);
  assert.equal(textHistory.body.records[0].difficultyDisplayName, '统一标准');
});

test('defense review, persisted record, and reloaded history share the server final score', async (t) => {
  const harness = createHarness();
  harness.setReviewDimensionScore(90);
  const port = await listen(t, harness.fetch);
  const token = jwt.sign({ sub: USER_ID, username: 'completed_user', displayName: '完成消息测试' }, JWT_SECRET);
  const defenseRoundStates = [
    defenseState(1, 'fully_answered', 90),
    defenseState(2, 'unanswered', 0),
    defenseState(3, 'off_topic', 0)
  ];
  const history = [
    { role: 'ai', content: '第一轮问题' },
    { role: 'user', content: '第一轮回答', defenseRoundState: defenseRoundStates[0] },
    { role: 'ai', content: '第二轮问题' },
    { role: 'user', content: '第二轮未回答', defenseRoundState: defenseRoundStates[1] },
    { role: 'ai', content: '第三轮问题' },
    { role: 'user', content: '第三轮偏题回答', defenseRoundState: defenseRoundStates[2] }
  ];

  const reviewed = await requestJson(port, '/api/debate/review', {}, 'POST', {
    ...sessionPayload('defense'),
    history,
    defenseRoundStates
  });
  assert.equal(reviewed.status, 200);
  assert.equal(reviewed.body.structuredReview.rawScore, 90);
  assert.equal(reviewed.body.structuredReview.score, 63);
  assert.equal(reviewed.body.structuredReview.totalScore, 63);
  assert.equal(reviewed.body.structuredReview.defenseRoundSummary.plannedRounds, 3);
  assert.equal(reviewed.body.structuredReview.defenseRoundSummary.completedRounds, 3);
  assert.equal(reviewed.body.structuredReview.defenseRoundSummary.analyzedRounds, 3);

  const saved = await requestJson(port, '/api/training-records', auth(token), 'POST', {
    spaceType: 'personal',
    localUserId: LOCAL_USER_ID,
    nickname: '完成消息测试',
    topic: '测试辩题',
    userSide: 'affirmative',
    aiSide: 'negative',
    difficulty: 'novice',
    styleId: 'none',
    trainingMode: 'defense',
    rounds: 3,
    defenseRoundStates,
    messages: history,
    review: reviewed.body.content,
    score: 99,
    scoreLevel: '伪造高分',
    dimensionScores: reviewed.body.structuredReview.dimensionScores,
    capTriggers: reviewed.body.structuredReview.capTriggers
  });
  assert.equal(saved.status, 201);
  assert.equal(saved.body.record.score, 63);
  assert.equal(saved.body.record.scoreLevel, reviewed.body.structuredReview.scoreLevel);
  assert.equal(harness.trainingRows[0].score, 63);

  const loaded = await requestJson(
    port,
    `/api/training-records/my?spaceType=personal&localUserId=${LOCAL_USER_ID}`,
    auth(token)
  );
  assert.equal(loaded.status, 200);
  assert.equal(loaded.body.records[0].score, 63);
  assert.equal(loaded.body.records[0].scoreLevel, reviewed.body.structuredReview.scoreLevel);
});

function createHarness() {
  const modelRequests = [];
  const trainingRows = [];
  let sequence = 0;
  let missingReviewDimension = false;
  let reviewDimensionScore = 80;

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
                score: reviewDimensionScore,
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
    },
    setReviewDimensionScore(value) {
      reviewDimensionScore = Number(value);
    }
  };
}

function defenseState(roundNumber, answerStatus, componentScore) {
  return {
    roundNumber,
    questionId: `defense_round_${roundNumber}_question_1`,
    questionText: `第${roundNumber}轮问题`,
    userAnswer: `第${roundNumber}轮回答`,
    answerStatus,
    currentQuestionCompletion: answerStatus === 'fully_answered' ? componentScore : 0,
    isCurrentQuestionAnswered: answerStatus === 'fully_answered',
    roundScore: {
      contentQuality: componentScore,
      currentQuestionRelevance: componentScore,
      responseCompleteness: componentScore,
      timeliness: componentScore,
      defensiveEffectiveness: componentScore
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
