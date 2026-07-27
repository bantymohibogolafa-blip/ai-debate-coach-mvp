import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import jwt from 'jsonwebtoken';

const LEADER = '91000000-0000-4000-8000-000000000001';
const MEMBER = '91000000-0000-4000-8000-000000000002';
const OUTSIDER = '91000000-0000-4000-8000-000000000003';
const MATCH = '92000000-0000-4000-8000-000000000001';
const OLD_MATCH = '92000000-0000-4000-8000-000000000002';
const TASK = '93000000-0000-4000-8000-000000000001';
const TEAM_CODE = 'BOARD01';
const JWT_SECRET = 'team-preparation-test-secret-at-least-32-characters';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = JWT_SECRET;
process.env.SUPABASE_URL = 'https://supabase.team-preparation.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'team-preparation-service-role';

const { app } = await import('../src/index.js');

test('board is member-only, match-scoped, and omits another member completion note', async (t) => {
  const harness = createHarness();
  const port = await listen(t, harness.fetch);

  const outsider = await requestJson(
    port,
    `/api/team/preparation?teamCode=${TEAM_CODE}`,
    auth(OUTSIDER)
  );
  assert.equal(outsider.status, 403);

  const response = await requestJson(
    port,
    `/api/team/preparation?teamCode=${TEAM_CODE}`,
    auth(MEMBER)
  );
  assert.equal(response.status, 200);
  assert.equal(response.body.match.id, MATCH);
  assert.deepEqual(response.body.tasks.map((task) => task.id), [TASK]);
  assert.equal(response.body.permissions.canManage, false);
  const assignments = response.body.tasks[0].assignments;
  assert.equal(assignments.find((item) => item.appUserId === LEADER).completionNote, '');
  assert.equal(assignments.find((item) => item.appUserId === MEMBER).completionNote, '我的公开提交说明');
  const serialized = JSON.stringify(response.body);
  assert.equal(serialized.includes('abilityProfile'), false);
  assert.equal(serialized.includes('prematch_messages'), false);

  const taskQuery = harness.calls.find((call) => call.table === 'team_tasks' && call.method === 'GET');
  assert.equal(taskQuery.url.searchParams.get('match_id'), `eq.${MATCH}`);
  assert.equal(taskQuery.url.searchParams.get('task_category'), 'eq.current_match');
});

test('ordinary members cannot manage matches or another assignee', async (t) => {
  const harness = createHarness();
  const port = await listen(t, harness.fetch);

  const matchEdit = await requestJson(
    port,
    `/api/team/preparation/matches/${MATCH}`,
    auth(MEMBER),
    'PATCH',
    matchBody()
  );
  assert.equal(matchEdit.status, 403);

  const otherCompletion = await requestJson(
    port,
    `/api/team/preparation/tasks/${TASK}/assignments/${LEADER}`,
    auth(MEMBER),
    'PATCH',
    { teamCode: TEAM_CODE, matchId: MATCH, completed: true }
  );
  assert.equal(otherCompletion.status, 403);

  const overall = await requestJson(
    port,
    `/api/team/preparation/tasks/${TASK}/completion`,
    auth(MEMBER),
    'POST',
    { teamCode: TEAM_CODE, matchId: MATCH, completed: true }
  );
  assert.equal(overall.status, 403);
});

test('members update themselves while a leader can atomically align all assignee states', async (t) => {
  const harness = createHarness();
  const port = await listen(t, harness.fetch);

  const selfCompletion = await requestJson(
    port,
    `/api/team/preparation/tasks/${TASK}/assignments/${MEMBER}`,
    auth(MEMBER),
    'PATCH',
    {
      teamCode: TEAM_CODE,
      matchId: MATCH,
      completed: true,
      completionNote: '已完成论证梳理'
    }
  );
  assert.equal(selfCompletion.status, 200);
  assert.equal(selfCompletion.body.assignment.completedBy, MEMBER);
  assert.equal(selfCompletion.body.assignment.completedByRole, 'member');
  assert.ok(selfCompletion.body.assignment.completedAt);
  assert.equal(selfCompletion.body.assignment.completionNote, '已完成论证梳理');

  const wholeCompletion = await requestJson(
    port,
    `/api/team/preparation/tasks/${TASK}/completion`,
    auth(LEADER),
    'POST',
    { teamCode: TEAM_CODE, matchId: MATCH, completed: true }
  );
  assert.equal(wholeCompletion.status, 200);
  assert.equal(harness.assignments.every((item) => item.status === 'completed'), true);
  assert.equal(harness.assignments.every((item) => item.completed_by === LEADER), true);
  assert.equal(harness.assignments.every((item) => item.completed_by_role === 'leader'), true);

  const restore = await requestJson(
    port,
    `/api/team/preparation/tasks/${TASK}/completion`,
    auth(LEADER),
    'POST',
    { teamCode: TEAM_CODE, matchId: MATCH, completed: false }
  );
  assert.equal(restore.status, 200);
  assert.equal(harness.assignments.every((item) => item.status === 'assigned'), true);
  assert.equal(harness.assignments.every((item) => item.completed_at === null), true);
  assert.equal(harness.assignments.every((item) => item.completed_by === null), true);
  assert.equal(harness.assignments.every((item) => item.completed_by_role === null), true);
});

test('one active match is enforced before insertion', async (t) => {
  const harness = createHarness();
  const port = await listen(t, harness.fetch);
  const duplicate = await requestJson(
    port,
    '/api/team/preparation/matches',
    auth(LEADER),
    'POST',
    matchBody()
  );
  assert.equal(duplicate.status, 409);
  assert.equal(harness.calls.some((call) => call.table === 'team_matches' && call.method === 'POST'), false);
});

function createHarness() {
  const calls = [];
  const members = [
    memberRow(LEADER, 'leader', '队长'),
    memberRow(MEMBER, 'member', '成员')
  ];
  const matches = [{
    id: MATCH,
    team_code: TEAM_CODE,
    competition_name: '暑期邀请赛',
    debate_topic: '人工智能是否提升教育公平',
    stance: 'affirmative',
    competition_time: null,
    format_info: '四人制',
    announcement: '本周先统一判准。',
    status: 'active',
    created_by: LEADER,
    updated_by: LEADER,
    archived_at: null,
    created_at: '2026-07-27T00:00:00.000Z',
    updated_at: '2026-07-27T00:00:00.000Z'
  }];
  const tasks = [
    taskRow(TASK, MATCH, 'current_match'),
    taskRow('93000000-0000-4000-8000-000000000002', OLD_MATCH, 'current_match'),
    taskRow('93000000-0000-4000-8000-000000000003', MATCH, 'daily_training')
  ];
  const assignments = [
    assignmentRow('94000000-0000-4000-8000-000000000001', LEADER, '队长私有完成说明'),
    assignmentRow('94000000-0000-4000-8000-000000000002', MEMBER, '我的公开提交说明')
  ];

  async function fetchMock(input, init = {}) {
    const url = new URL(String(input));
    const method = init.method || 'GET';
    const table = url.pathname.split('/').at(-1);
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ url, method, table, body });

    if (table === 'app_users') {
      const userId = eqValue(url, 'id');
      return Response.json([LEADER, MEMBER, OUTSIDER].includes(userId)
        ? [{ id: userId, username: `user_${userId.at(-1)}`, display_name: '测试用户' }]
        : []);
    }
    if (table === 'team_members' && method === 'GET') return Response.json(filterRows(members, url));
    if (table === 'team_matches' && method === 'GET') return Response.json(filterRows(matches, url));
    if (table === 'team_matches' && method === 'PATCH') {
      const selected = filterRows(matches, url);
      selected.forEach((row) => Object.assign(row, body));
      return Response.json(selected);
    }
    if (table === 'team_matches' && method === 'POST') {
      const row = { ...body, id: crypto.randomUUID() };
      matches.push(row);
      return Response.json([row]);
    }
    if (table === 'team_tasks' && method === 'GET') return Response.json(filterRows(tasks, url));
    if (table === 'team_task_assignments' && method === 'GET') {
      return Response.json(filterRows(assignments, url));
    }
    if (table === 'team_task_assignments' && method === 'PATCH') {
      const selected = filterRows(assignments, url);
      selected.forEach((row) => Object.assign(row, body));
      return init.headers?.Prefer === 'return=minimal' ? new Response(null, { status: 204 }) : Response.json(selected);
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  }

  return { calls, assignments, fetch: fetchMock };
}

function memberRow(appUserId, role, nickname) {
  return {
    id: crypto.randomUUID(),
    team_code: TEAM_CODE,
    local_user_id: `user_${appUserId}`,
    app_user_id: appUserId,
    nickname,
    role,
    status: 'active',
    joined_at: '2026-07-27T00:00:00.000Z',
    left_at: null
  };
}

function taskRow(id, matchId, category) {
  return {
    id,
    team_code: TEAM_CODE,
    match_id: matchId,
    task_category: category,
    task_source: 'manual',
    title: `任务-${id.at(-1)}`,
    topic: '人工智能是否提升教育公平',
    user_side: 'affirmative',
    ai_side: 'negative',
    mode: 'free_debate',
    difficulty: 'novice',
    style_id: 'none',
    required_count: 1,
    deadline: null,
    description: '梳理论证',
    assignment_type: 'selected',
    created_by: LEADER,
    created_by_app_user_id: LEADER,
    status: 'active',
    created_at: '2026-07-27T00:00:00.000Z',
    updated_at: '2026-07-27T00:00:00.000Z'
  };
}

function assignmentRow(id, appUserId, note) {
  return {
    id,
    task_id: TASK,
    team_code: TEAM_CODE,
    app_user_id: appUserId,
    status: 'assigned',
    assigned_at: '2026-07-27T00:00:00.000Z',
    completed_count: 0,
    completed_at: null,
    completed_by: null,
    completed_by_role: null,
    completion_note: note,
    training_record_id: null,
    updated_at: '2026-07-27T00:00:00.000Z'
  };
}

function matchBody() {
  return {
    teamCode: TEAM_CODE,
    competitionName: '另一场比赛',
    debateTopic: '测试辩题',
    stance: 'negative',
    competitionTime: null,
    formatInfo: '',
    announcement: ''
  };
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

function eqValue(url, key) {
  return String(url.searchParams.get(key) || '').replace(/^eq\./, '');
}

function auth(userId) {
  return { authorization: `Bearer ${jwt.sign({ sub: userId }, JWT_SECRET)}` };
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
