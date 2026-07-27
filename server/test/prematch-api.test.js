import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import jwt from 'jsonwebtoken';

const USER_A = '81000000-0000-4000-8000-000000000001';
const USER_B = '81000000-0000-4000-8000-000000000002';
const TASK_A = '82000000-0000-4000-8000-000000000001';
const TASK_B = '82000000-0000-4000-8000-000000000002';
const TASK_TEAM = '82000000-0000-4000-8000-000000000003';
const REQUEST_A = '83000000-0000-4000-8000-000000000001';
const TEAM_CODE = 'PREPTEAM';
const JWT_SECRET = 'prematch-api-test-secret-at-least-32-characters';
const DAILY_MARKER = '日常林婉私有消息-不得读取';
const TASK_A_MARKER = '任务A私有思路-只应进入任务A';
const TASK_B_MARKER = '任务B私有思路-绝不能进入任务A';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = JWT_SECRET;
process.env.DEEPSEEK_API_KEY = 'prematch-test-key';
process.env.DEEPSEEK_API_URL = 'https://deepseek.prematch.test/chat/completions';
process.env.SUPABASE_URL = 'https://supabase.prematch.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'prematch-service-role';

const { app } = await import('../src/index.js');

test('personal task lists and detail access use only the verified account', async (t) => {
  const harness = createHarness();
  const port = await listen(t, harness.fetch);

  const unauthenticated = await requestJson(port, '/api/prematch/tasks?spaceType=personal');
  assert.equal(unauthenticated.status, 401);

  const listed = await requestJson(
    port,
    `/api/prematch/tasks?spaceType=personal&owner_user_id=${USER_B}&status=all`,
    auth(signToken(USER_A))
  );
  assert.equal(listed.status, 200);
  assert.deepEqual(listed.body.tasks.map((task) => task.id), [TASK_A]);
  const listCall = harness.calls.find((call) => (
    call.table === 'prematch_tasks'
    && call.url.searchParams.get('owner_user_id')
  ));
  assert.equal(listCall.url.searchParams.get('owner_user_id'), `eq.${USER_A}`);
  assert.equal(listCall.url.searchParams.toString().includes(USER_B), false);

  harness.calls.length = 0;
  const denied = await requestJson(
    port,
    `/api/prematch/tasks/${TASK_B}`,
    auth(signToken(USER_A))
  );
  assert.equal(denied.status, 404);
  assert.equal(harness.calls.some((call) => call.table === 'prematch_messages'), false);
});

test('Super Lin Wan reads only the current task, reuses settings, and never reads daily history', async (t) => {
  const harness = createHarness();
  const port = await listen(t, harness.fetch);
  const response = await requestJson(
    port,
    `/api/prematch/tasks/${TASK_A}/chat`,
    auth(signToken(USER_A)),
    'POST',
    {
      question: '这个方向适合做主战场吗？',
      clientRequestId: REQUEST_A,
      chatHistory: [{ role: 'user', content: TASK_B_MARKER }],
      user_id: USER_B
    }
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.task.id, TASK_A);
  assert.equal(response.body.userMessage.taskId, TASK_A);
  assert.equal(response.body.assistantMessage.taskId, TASK_A);
  assert.equal(response.body.task.strategyState.coreBattlefield, '制度可预期性');
  assert.equal(response.body.task.strategyState.confirmedPoints.includes('保留机制比较'), true);

  assert.equal(harness.calls.some((call) => call.table === 'linwan_messages'), false);
  assert.equal(harness.modelRequests.length, 1);
  const prompt = harness.modelRequests[0].map((message) => message.content).join('\n');
  assert.match(prompt, new RegExp(TASK_A_MARKER));
  assert.equal(prompt.includes(TASK_B_MARKER), false);
  assert.equal(prompt.includes(DAILY_MARKER), false);
  assert.match(prompt, /称呼其为“账户A称呼”/);
  assert.match(prompt, /当前状态：Super 林婉/);

  const versionAfterFirstResponse = response.body.task.version;
  const duplicate = await requestJson(
    port,
    `/api/prematch/tasks/${TASK_A}/chat`,
    auth(signToken(USER_A)),
    'POST',
    {
      question: '重复提交不应再次调用模型',
      clientRequestId: REQUEST_A
    }
  );
  assert.equal(duplicate.status, 200);
  assert.equal(duplicate.body.duplicated, true);
  assert.equal(duplicate.body.task.version, versionAfterFirstResponse);
  assert.equal(harness.modelRequests.length, 1);
});

test('a cross-task database row is rejected before it reaches the model', async (t) => {
  const harness = createHarness({ contaminateTask: TASK_A });
  const port = await listen(t, harness.fetch);
  const result = await requestJson(
    port,
    `/api/prematch/tasks/${TASK_A}/chat`,
    auth(signToken(USER_A)),
    'POST',
    {
      question: '这轮不应到达模型',
      clientRequestId: REQUEST_A
    }
  );

  assert.equal(result.status, 502);
  assert.equal(result.body.message.includes(TASK_B_MARKER), false);
  assert.equal(harness.modelRequests.length, 0);
});

test('changing stance marks the existing strategy for reassessment with optimistic versioning', async (t) => {
  const harness = createHarness();
  const port = await listen(t, harness.fetch);
  const result = await requestJson(
    port,
    `/api/prematch/tasks/${TASK_A}`,
    auth(signToken(USER_A)),
    'PATCH',
    {
      expectedVersion: 1,
      debateTopic: '测试辩题 A',
      stance: 'negative',
      debatePosition: 'second',
      title: '任务 A'
    }
  );

  assert.equal(result.status, 200);
  assert.equal(result.body.task.stance, 'negative');
  assert.equal(result.body.task.currentStage, 'understanding');
  assert.equal(result.body.task.strategyState.needsReassessment, true);
  assert.match(result.body.task.strategyState.reassessmentReason, /立场已修改/);
  assert.equal(result.body.task.version, 2);

  const stale = await requestJson(
    port,
    `/api/prematch/tasks/${TASK_A}`,
    auth(signToken(USER_A)),
    'PATCH',
    {
      expectedVersion: 1,
      debateTopic: '测试辩题 A',
      stance: 'affirmative',
      debatePosition: 'second',
      title: '任务 A'
    }
  );
  assert.equal(stale.status, 409);
});

test('retired team Super Lin Wan scope is rejected before reading team data', async (t) => {
  const harness = createHarness();
  const port = await listen(t, harness.fetch);
  const formerMemberPath = await requestJson(
    port,
    `/api/prematch/tasks?spaceType=team&teamCode=${TEAM_CODE}&status=all`,
    auth(signToken(USER_A))
  );
  assert.equal(formerMemberPath.status, 410);
  assert.match(formerMemberPath.body.message, /团队备战看板/);

  const nonMemberPath = await requestJson(
    port,
    `/api/prematch/tasks?spaceType=team&teamCode=${TEAM_CODE}&status=all`,
    auth(signToken(USER_B))
  );
  assert.equal(nonMemberPath.status, 410);
  assert.equal(
    harness.calls.some((call) => call.table === 'prematch_tasks' || call.table === 'team_members'),
    false
  );
});

test('completed formal training links back as a structured summary only', async (t) => {
  const harness = createHarness();
  const port = await listen(t, harness.fetch);
  const result = await requestJson(
    port,
    '/api/training-records',
    auth(signToken(USER_A)),
    'POST',
    {
      spaceType: 'personal',
      localUserId: `user_${USER_A}`,
      nickname: '用户A',
      topic: '测试辩题 A',
      userSide: 'affirmative',
      aiSide: 'negative',
      difficulty: 'campus',
      styleId: 'none',
      trainingMode: 'defense',
      messages: [
        { role: 'ai', content: '请守住定义。' },
        { role: 'user', content: '我会区分短期成本和不可逆风险。' }
      ],
      review: '正式复盘摘要',
      score: 76,
      sourcePrepTaskId: TASK_A,
      prepTrainingGoal: '守住风险定义',
      prepStrategySummary: '核心战场：制度可预期性',
      prepVerificationQuestion: '能否完成概念切割',
      prepResultSummary: {
        score: 76,
        mainWeakness: '切割后的比较还不够完整',
        nextStepAdvice: ['回到任务补全比较义务'],
        completedAt: '2026-07-27T03:00:00.000Z'
      }
    }
  );

  assert.equal(result.status, 201);
  assert.equal(result.body.prematchLink.status, 'linked');
  assert.equal(result.body.prematchLink.link.taskId, TASK_A);
  assert.equal(result.body.prematchLink.link.trainingMode, 'defense');
  assert.equal(result.body.prematchLink.link.resultSummary.score, 76);
  const serializedLink = JSON.stringify(result.body.prematchLink.link);
  assert.equal(serializedLink.includes('请守住定义'), false);
  assert.equal(serializedLink.includes('正式复盘摘要'), false);
});

function createHarness(options = {}) {
  const calls = [];
  const modelRequests = [];
  let sequence = 0;
  const tasks = [
    taskRow(TASK_A, USER_A, '任务 A', '测试辩题 A'),
    taskRow(TASK_B, USER_B, '任务 B', '测试辩题 B'),
    taskRow(TASK_TEAM, USER_A, '团队任务', '团队测试辩题', {
      spaceType: 'team',
      teamCode: TEAM_CODE
    })
  ];
  const teamMembers = [{
    id: '86000000-0000-4000-8000-000000000001',
    team_code: TEAM_CODE,
    local_user_id: `user_${USER_A}`,
    app_user_id: USER_A,
    nickname: '用户A',
    role: 'owner',
    status: 'active',
    joined_at: '2026-07-27T00:00:00.000Z',
    left_at: null
  }];
  const messages = [
    messageRow('84000000-0000-4000-8000-000000000001', TASK_A, USER_A, 'user', TASK_A_MARKER),
    messageRow('84000000-0000-4000-8000-000000000002', TASK_A, USER_A, 'assistant', '任务A已有回应'),
    messageRow('84000000-0000-4000-8000-000000000003', TASK_B, USER_B, 'user', TASK_B_MARKER)
  ];
  const trainingLinks = [];
  const trainingRecords = [];

  async function fetchMock(input, init = {}) {
    const url = new URL(String(input));
    const method = init.method || 'GET';
    if (url.hostname === 'deepseek.prematch.test') {
      const body = JSON.parse(init.body);
      modelRequests.push(body.messages);
      return Response.json({
        choices: [{
          message: {
            content: JSON.stringify({
              answer: '这个方向有价值，但要先补足比较对象。',
              taskSummary: '已确认保留机制比较，下一步验证制度可预期性。',
              structuredUpdate: {
                currentStage: 'strategy',
                coreBattlefield: '制度可预期性',
                criterion: '比较哪方更能降低不可逆风险',
                confirmedArguments: ['机制比较'],
                alternativeArguments: [],
                opponentRoutes: ['对方可能强调个体自由'],
                risks: ['概念边界过宽'],
                positionTasks: ['二辩负责概念切割'],
                confirmedPoints: ['保留机制比较'],
                rejectedPoints: [],
                unresolvedQuestions: ['风险是否可逆'],
                recommendedTrainings: [{
                  mode: 'defense',
                  difficulty: 'campus',
                  reason: '概念边界需要验证',
                  goal: '守住风险定义',
                  verificationQuestion: '能否切开短期成本与不可逆伤害'
                }]
              }
            })
          }
        }]
      });
    }

    const table = url.pathname.split('/').at(-1);
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ url, method, table, body });

    if (table === 'app_users') {
      const userId = eqValue(url, 'id');
      return Response.json([USER_A, USER_B].includes(userId)
        ? [{ id: userId, username: `user_${userId.at(-1)}`, display_name: `用户${userId.at(-1)}` }]
        : []);
    }
    if (table === 'prematch_tasks' && method === 'GET') {
      return Response.json(filterRows(tasks, url));
    }
    if (table === 'team_members' && method === 'GET') {
      return Response.json(filterRows(teamMembers, url));
    }
    if (table === 'prematch_tasks' && method === 'PATCH') {
      const matches = filterRows(tasks, url);
      matches.forEach((row) => Object.assign(row, body));
      return Response.json(matches);
    }
    if (table === 'prematch_messages' && method === 'GET') {
      const rows = filterRows(messages, url);
      if (
        options.contaminateTask
        && eqValue(url, 'task_id') === options.contaminateTask
        && !url.searchParams.get('client_request_id')
      ) {
        return Response.json([...rows, messages.find((row) => row.task_id === TASK_B)]);
      }
      return Response.json(rows.slice().reverse());
    }
    if (table === 'prematch_messages' && method === 'POST') {
      const rows = (Array.isArray(body) ? body : [body]).map((row) => ({
        ...row,
        id: `85000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`
      }));
      messages.push(...rows);
      return Response.json(rows);
    }
    if (table === 'prematch_training_links' && method === 'GET') {
      return Response.json(filterRows(trainingLinks, url));
    }
    if (table === 'prematch_training_links' && method === 'POST') {
      const row = {
        ...body,
        id: `87000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`,
        created_at: '2026-07-27T03:00:01.000Z'
      };
      trainingLinks.push(row);
      return Response.json([row]);
    }
    if (table === 'linwan_user_profile' && method === 'GET') {
      return Response.json([{
        user_id: USER_A,
        preferred_name: '账户A称呼',
        response_length: 'balanced',
        communication_style: 'balanced',
        answer_order: 'auto',
        terminology_level: 'normal',
        custom_preference: '',
        auto_show_context: true
      }]);
    }
    if (table === 'training_records' && method === 'GET') return Response.json(filterRows(trainingRecords, url));
    if (table === 'training_records' && method === 'POST') {
      const row = {
        ...body,
        id: `88000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`
      };
      trainingRecords.push(row);
      return Response.json([row]);
    }
    if (table === 'linwan_messages') {
      throw new Error(`${DAILY_MARKER}: Super route must not query this table`);
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  }

  return { calls, modelRequests, tasks, messages, fetch: fetchMock };
}

function filterRows(rows, url) {
  return rows.filter((row) => {
    for (const [key, value] of url.searchParams.entries()) {
      if (!value.startsWith('eq.')) continue;
      if (String(row[key] ?? '') !== value.slice(3)) return false;
    }
    return true;
  });
}

function taskRow(id, ownerUserId, title, topic, options = {}) {
  return {
    id,
    owner_user_id: ownerUserId,
    space_type: options.spaceType || 'personal',
    team_code: options.teamCode || null,
    title,
    debate_topic: topic,
    stance: 'affirmative',
    debate_position: 'second',
    position_detail: '',
    competition_name: '',
    competition_date: null,
    competition_level: '',
    format: '',
    preparation_deadline: null,
    initial_ideas: '',
    opponent_info: '',
    priority_question: '',
    status: 'active',
    current_stage: 'analysis',
    strategy_state: {
      confirmedPoints: ['保留机制比较'],
      rejectedPoints: ['不用纯个案']
    },
    context_summary: '任务私有摘要',
    version: 1,
    archived_at: null,
    created_at: '2026-07-27T01:00:00.000Z',
    updated_at: '2026-07-27T01:00:00.000Z'
  };
}

function messageRow(id, taskId, userId, role, content) {
  return {
    id,
    task_id: taskId,
    user_id: userId,
    role,
    content,
    structured_update: null,
    context_manifest: null,
    client_request_id: null,
    created_at: `2026-07-27T01:00:0${role === 'user' ? 0 : 1}.000Z`
  };
}

function eqValue(url, key) {
  return String(url.searchParams.get(key) || '').replace(/^eq\./, '');
}

function signToken(userId) {
  return jwt.sign({ sub: userId, username: 'prematch_user', displayName: '备战测试' }, JWT_SECRET);
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
