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

test('personal Super Lin Wan reads only the current task and excludes profiles, training and daily history', async (t) => {
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
      intent: 'expand',
      chatHistory: [{ role: 'user', content: TASK_B_MARKER }],
      user_id: USER_B
    }
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.task.id, TASK_A);
  assert.equal(response.body.userMessage.taskId, TASK_A);
  assert.equal(response.body.assistantMessage.taskId, TASK_A);
  assert.equal(response.body.task.strategyState.currentPosition.activePlan, '制度可预期性');
  assert.equal(response.body.task.strategyState.confirmedDecisions.includes('保留机制比较'), true);
  assert.equal(response.body.task.contextSummary, '已确认保留机制比较，下一步验证制度可预期性。');

  assert.equal(harness.calls.some((call) => call.table === 'linwan_messages'), false);
  assert.equal(harness.calls.some((call) => call.table === 'linwan_user_profile'), false);
  assert.equal(harness.calls.some((call) => call.table === 'training_records'), false);
  assert.equal(harness.calls.some((call) => call.table === 'prematch_training_links'), false);
  assert.equal(harness.modelRequests.length, 1);
  const prompt = harness.modelRequests[0].map((message) => message.content).join('\n');
  assert.match(prompt, new RegExp(TASK_A_MARKER));
  assert.equal(prompt.includes(TASK_B_MARKER), false);
  assert.equal(prompt.includes(DAILY_MARKER), false);
  assert.match(prompt, /当前登录用户显示名称/);
  assert.match(prompt, /本轮 intent=expand/);
  assert.match(prompt, /你是 Super 林婉/);

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

test('chat intent defaults to chat, rejects invalid values, and persists report intent', async (t) => {
  const harness = createHarness();
  const port = await listen(t, harness.fetch);

  const legacy = await requestJson(
    port,
    `/api/prematch/tasks/${TASK_A}/chat`,
    auth(signToken(USER_A)),
    'POST',
    {
      question: '旧客户端不传 intent',
      clientRequestId: '83000000-0000-4000-8000-000000000011'
    }
  );
  assert.equal(legacy.status, 200);
  assert.equal(legacy.body.contextManifest.intent, 'chat');
  assert.match(
    harness.modelRequests[0].map((message) => message.content).join('\n'),
    /本轮 intent=chat/
  );

  const invalid = await requestJson(
    port,
    `/api/prematch/tasks/${TASK_A}/chat`,
    auth(signToken(USER_A)),
    'POST',
    {
      question: '非法 intent',
      clientRequestId: '83000000-0000-4000-8000-000000000012',
      intent: 'search-now'
    }
  );
  assert.equal(invalid.status, 400);
  assert.match(invalid.body.message, /intent 无效/);
  assert.equal(harness.modelRequests.length, 1);

  const report = await requestJson(
    port,
    `/api/prematch/tasks/${TASK_A}/chat`,
    auth(signToken(USER_A)),
    'POST',
    {
      question: '请形成当前思路报告。',
      clientRequestId: '83000000-0000-4000-8000-000000000013',
      intent: 'report'
    }
  );
  assert.equal(report.status, 200);
  assert.equal(report.body.assistantMessage.contextManifest.intent, 'report');
  assert.match(
    harness.modelRequests[1].map((message) => message.content).join('\n'),
    /已确认、候选、已否定、已修改、尚未解决/
  );
  assert.match(
    harness.modelRequests[1].map((message) => message.content).join('\n'),
    /已确认保留机制比较，下一步验证制度可预期性/
  );
});

test('evidence intent stays offline and asks only for an unverified retrieval plan', async (t) => {
  const harness = createHarness();
  const port = await listen(t, harness.fetch);
  const response = await requestJson(
    port,
    `/api/prematch/tasks/${TASK_A}/chat`,
    auth(signToken(USER_A)),
    'POST',
    {
      question: '帮我搜集论据方向。',
      clientRequestId: '83000000-0000-4000-8000-000000000014',
      intent: 'evidence'
    }
  );

  assert.equal(response.status, 200);
  const prompt = harness.modelRequests[0].map((message) => message.content).join('\n');
  assert.match(prompt, /本轮 intent=evidence/);
  assert.match(prompt, /绝不联网/);
  assert.match(prompt, /检索方案，不是已经核实的证据/);
  assert.equal(harness.calls.some((call) => call.table === 'prematch_training_links'), false);
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
  assert.equal(result.body.task.strategyState.currentPosition.stance, 'negative');
  assert.match(result.body.task.strategyState.unresolvedQuestions.join('\n'), /立场变化/);
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

test('personal task creation needs only debateTopic and generates defaults and title', async (t) => {
  const harness = createHarness();
  const port = await listen(t, harness.fetch);
  const topic = '  人工智能会不会削弱人的创造力，   当前需要先建立判准。  ';
  const created = await requestJson(
    port,
    '/api/prematch/tasks',
    auth(signToken(USER_A)),
    'POST',
    { debateTopic: topic }
  );

  assert.equal(created.status, 201);
  assert.equal(created.body.task.debateTopic, topic.trim());
  assert.equal(created.body.task.stance, 'undecided');
  assert.equal(created.body.task.debatePosition, 'undecided');
  assert.match(created.body.task.title, /^人工智能会不会削弱人的创造力/);
  assert.equal(created.body.task.strategyState.version, 2);
});

test('archived personal task cannot chat and restored task can continue', async (t) => {
  const harness = createHarness();
  const port = await listen(t, harness.fetch);
  const archived = await requestJson(
    port,
    `/api/prematch/tasks/${TASK_A}/archive`,
    auth(signToken(USER_A)),
    'POST',
    {}
  );
  assert.equal(archived.status, 200);
  assert.equal(archived.body.task.status, 'archived');

  const blocked = await requestJson(
    port,
    `/api/prematch/tasks/${TASK_A}/chat`,
    auth(signToken(USER_A)),
    'POST',
    {
      question: '归档后不应继续',
      clientRequestId: '83000000-0000-4000-8000-000000000015'
    }
  );
  assert.equal(blocked.status, 409);
  assert.equal(harness.modelRequests.length, 0);

  const restored = await requestJson(
    port,
    `/api/prematch/tasks/${TASK_A}/restore`,
    auth(signToken(USER_A)),
    'POST',
    {}
  );
  assert.equal(restored.status, 200);
  assert.equal(restored.body.task.status, 'active');

  const continued = await requestJson(
    port,
    `/api/prematch/tasks/${TASK_A}/chat`,
    auth(signToken(USER_A)),
    'POST',
    {
      question: '恢复后继续',
      clientRequestId: '83000000-0000-4000-8000-000000000016'
    }
  );
  assert.equal(continued.status, 200);
  assert.equal(harness.modelRequests.length, 1);
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

test('two personal tasks remain isolated through twelve persisted chat rounds and reload', async (t) => {
  const harness = createHarness();
  const port = await listen(t, harness.fetch);
  const createdTasks = [];

  for (const marker of ['隔离任务甲', '隔离任务乙']) {
    const created = await requestJson(
      port,
      '/api/prematch/tasks',
      auth(signToken(USER_A)),
      'POST',
      {
        title: marker,
        debateTopic: `${marker}辩题`,
        stance: 'affirmative',
        debatePosition: 'second',
        spaceType: 'personal'
      }
    );
    assert.equal(created.status, 201);
    createdTasks.push(created.body.task);
  }

  const [taskA, taskB] = createdTasks;
  assert.notEqual(taskA.id, taskB.id);

  for (let round = 1; round <= 12; round += 1) {
    const marker = `第${round}轮测试标记-${String(round).padStart(2, '0')}`;
    const response = await requestJson(
      port,
      `/api/prematch/tasks/${taskA.id}/chat`,
      auth(signToken(USER_A)),
      'POST',
      {
        question: marker,
        clientRequestId: `93000000-0000-4000-8000-${String(round).padStart(12, '0')}`
      }
    );
    assert.equal(response.status, 200);
    assert.equal(response.body.userMessage.content, marker);
    assert.equal(response.body.userMessage.taskId, taskA.id);
    assert.equal(response.body.assistantMessage.taskId, taskA.id);
  }

  const reloadedA = await requestJson(
    port,
    `/api/prematch/tasks/${taskA.id}`,
    auth(signToken(USER_A))
  );
  const reloadedB = await requestJson(
    port,
    `/api/prematch/tasks/${taskB.id}`,
    auth(signToken(USER_A))
  );

  assert.equal(reloadedA.status, 200);
  assert.equal(reloadedA.body.messages.length, 25);
  assert.equal(reloadedA.body.messages[0].role, 'assistant');
  assert.equal(reloadedA.body.messages.at(-2).content, '第12轮测试标记-12');
  assert.equal(reloadedA.body.messages.at(-1).role, 'assistant');
  assert.equal(new Set(reloadedA.body.messages.map((message) => message.id)).size, 25);
  assert.equal(reloadedA.body.messages.every((message) => message.taskId === taskA.id), true);

  assert.equal(reloadedB.status, 200);
  assert.equal(reloadedB.body.messages.length, 1);
  assert.equal(reloadedB.body.messages[0].role, 'assistant');
  assert.equal(JSON.stringify(reloadedB.body).includes('第12轮测试标记-12'), false);
});

test('personal Super Lin Wan never requests an ability profile', async (t) => {
  const harness = createHarness({ abilityProfileFailure: true });
  const port = await listen(t, harness.fetch);
  const response = await requestJson(
    port,
    `/api/prematch/tasks/${TASK_A}/chat`,
    auth(signToken(USER_A)),
    'POST',
    {
      question: '画像故障降级测试',
      clientRequestId: '93000000-0000-4000-8000-000000000101'
    }
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.userMessage.content, '画像故障降级测试');
  assert.equal(response.body.assistantMessage.contextManifest.trainingProfile.used, false);
  assert.equal(harness.calls.some((call) => call.table === 'training_records'), false);
  assert.match(harness.modelRequests[0].map((message) => message.content).join('\n'), /不得调用或暗示知道.*能力画像/);
});

test('task creation currently succeeds even when its opening message cannot be persisted', async (t) => {
  const harness = createHarness({ failOpeningMessage: true });
  const port = await listen(t, harness.fetch);
  const created = await requestJson(
    port,
    '/api/prematch/tasks',
    auth(signToken(USER_A)),
    'POST',
    {
      title: '开场消息故障测试',
      debateTopic: '测试非事务创建',
      stance: 'affirmative',
      debatePosition: 'first',
      spaceType: 'personal'
    }
  );

  assert.equal(created.status, 201);
  assert.equal(created.body.task.title, '开场消息故障测试');
  assert.equal(created.body.messages.length, 0);
  assert.equal(
    harness.messages.some((message) => message.task_id === created.body.task.id),
    false
  );
});

test('repeating the same task creation request creates duplicate tasks', async (t) => {
  const harness = createHarness();
  const port = await listen(t, harness.fetch);
  const payload = {
    title: '重复创建测试',
    debateTopic: '相同创建请求是否幂等',
    stance: 'affirmative',
    debatePosition: 'first',
    spaceType: 'personal'
  };
  const first = await requestJson(
    port,
    '/api/prematch/tasks',
    auth(signToken(USER_A)),
    'POST',
    payload
  );
  const second = await requestJson(
    port,
    '/api/prematch/tasks',
    auth(signToken(USER_A)),
    'POST',
    payload
  );

  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  assert.notEqual(first.body.task.id, second.body.task.id);
  assert.equal(
    harness.tasks.filter((task) => task.title === payload.title).length,
    2
  );
});

test('chat messages remain stored when the subsequent strategy snapshot update conflicts', async (t) => {
  const harness = createHarness({ failTaskPatchAfterExchange: true });
  const port = await listen(t, harness.fetch);
  const requestId = '93000000-0000-4000-8000-000000000201';
  const response = await requestJson(
    port,
    `/api/prematch/tasks/${TASK_A}/chat`,
    auth(signToken(USER_A)),
    'POST',
    {
      question: '消息与阶段快照一致性测试',
      clientRequestId: requestId
    }
  );

  assert.equal(response.status, 409);
  const stored = harness.messages.filter((message) => message.client_request_id === requestId);
  assert.deepEqual(stored.map((message) => message.role), ['user', 'assistant']);
  assert.equal(harness.tasks.find((task) => task.id === TASK_A).version, 1);

  const reloaded = await requestJson(
    port,
    `/api/prematch/tasks/${TASK_A}`,
    auth(signToken(USER_A))
  );
  assert.equal(reloaded.status, 200);
  assert.equal(
    reloaded.body.messages.filter((message) => message.clientRequestId === requestId).length,
    2
  );
  assert.equal(reloaded.body.task.version, 1);
  assert.equal(reloaded.body.task.strategyState.currentPosition.activePlan, '');
});

test('task detail restores only the latest one hundred messages', async (t) => {
  const harness = createHarness();
  for (let index = 0; index < 120; index += 1) {
    harness.messages.push({
      ...messageRow(
        `94000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
        TASK_A,
        USER_A,
        index % 2 === 0 ? 'user' : 'assistant',
        `历史消息-${String(index).padStart(3, '0')}`
      ),
      created_at: new Date(Date.UTC(2026, 6, 28, 0, 0, index)).toISOString()
    });
  }
  const port = await listen(t, harness.fetch);
  const detail = await requestJson(
    port,
    `/api/prematch/tasks/${TASK_A}`,
    auth(signToken(USER_A))
  );

  assert.equal(detail.status, 200);
  assert.equal(detail.body.messages.length, 100);
  assert.equal(detail.body.messages.some((message) => message.content === TASK_A_MARKER), false);
  assert.equal(detail.body.messages.at(-1).content, '历史消息-119');
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
                taskUnderstanding: '比较两种机制的长期影响',
                currentPosition: {
                  stance: 'affirmative',
                  definitions: [],
                  criteria: ['比较哪方更能降低不可逆风险'],
                  claims: ['机制比较'],
                  activePlan: '制度可预期性'
                },
                confirmedDecisions: ['保留机制比较'],
                candidateIdeas: ['对方可能强调个体自由'],
                rejectedDecisions: ['不用纯个案'],
                decisionChanges: [],
                evidenceNeeds: ['制度长期影响的案例'],
                risks: ['概念边界过宽'],
                unresolvedQuestions: ['风险是否可逆']
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
    if (table === 'prematch_tasks' && method === 'POST') {
      const row = {
        ...body,
        id: `92000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`
      };
      tasks.push(row);
      return Response.json([row]);
    }
    if (table === 'team_members' && method === 'GET') {
      return Response.json(filterRows(teamMembers, url));
    }
    if (table === 'prematch_tasks' && method === 'PATCH') {
      if (options.failTaskPatchAfterExchange && messages.some((message) => message.client_request_id)) {
        return Response.json([]);
      }
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
      const descending = rows.slice().sort((left, right) => (
        String(right.created_at).localeCompare(String(left.created_at))
        || String(right.id).localeCompare(String(left.id))
      ));
      const limit = Number(url.searchParams.get('limit') || descending.length);
      return Response.json(descending.slice(0, limit));
    }
    if (table === 'prematch_messages' && method === 'POST') {
      if (options.failOpeningMessage && !Array.isArray(body)) {
        return Response.json(
          { code: 'TEST_OPENING_WRITE_FAILED', message: 'opening message write failed' },
          { status: 500 }
        );
      }
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
    if (table === 'training_records' && method === 'GET') {
      if (options.abilityProfileFailure) {
        return Response.json(
          { code: 'TEST_PROFILE_UNAVAILABLE', message: 'ability profile unavailable' },
          { status: 500 }
        );
      }
      return Response.json(filterRows(trainingRecords, url));
    }
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
