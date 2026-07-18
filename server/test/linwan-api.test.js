import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import jwt from 'jsonwebtoken';

const USER_A = '10000000-0000-4000-8000-000000000001';
const USER_B = '10000000-0000-4000-8000-000000000002';
const USER_C = '10000000-0000-4000-8000-000000000003';
const LOCAL_A = 'user_30000000-0000-4000-8000-000000000001';
const LOCAL_B = 'user_30000000-0000-4000-8000-000000000002';
const JWT_SECRET = 'linwan-api-test-secret-at-least-32-characters';
const SECRET_A = '蓝色河马7319';
const SECRET_B = '绿色月亮999';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = JWT_SECRET;
process.env.DEEPSEEK_API_KEY = 'test-deepseek-key';
process.env.DEEPSEEK_API_URL = 'https://deepseek.test/chat/completions';
process.env.SUPABASE_URL = 'https://supabase.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

const { app } = await import('../src/index.js');

test('Lin Wan history, profile and destructive endpoints use only the verified account', async (t) => {
  const harness = createIsolationHarness();
  const port = await listen(t, harness.fetch);
  const tokenA = signToken(USER_A);

  assert.equal((await requestJson(port, '/api/linwan/history')).status, 401);

  const history = await requestJson(port, `/api/linwan/history?limit=10&user_id=${USER_B}&conversation_id=forged`, auth(tokenA));
  assert.equal(history.status, 200);
  assert.equal(history.body.messages.some((message) => message.content.includes(SECRET_A)), true);
  assert.equal(history.body.messages.some((message) => message.content.includes(SECRET_B)), false);

  const historyCall = harness.calls.find((call) => call.table === 'linwan_messages' && call.method === 'GET');
  assert.equal(historyCall.url.searchParams.get('user_id'), `eq.${USER_A}`);
  assert.equal(historyCall.url.searchParams.toString().includes(USER_B), false);

  harness.calls.length = 0;
  const profile = await requestJson(port, `/api/linwan/profile?user_id=${USER_B}`, auth(tokenA));
  assert.equal(profile.status, 200);
  assert.equal(profile.body.profile.preferredName, '账户A称呼');
  assert.equal(harness.calls.find((call) => call.table === 'linwan_user_profile').url.searchParams.get('user_id'), `eq.${USER_A}`);

  harness.calls.length = 0;
  const saved = await requestJson(port, '/api/linwan/profile', auth(tokenA), 'PUT', {
    user_id: USER_B,
    preferredName: '更新A',
    responseLength: 'balanced',
    communicationStyle: 'balanced',
    answerOrder: 'auto',
    terminologyLevel: 'normal',
    customPreference: '',
    autoShowContext: true
  });
  assert.equal(saved.status, 400, 'unknown user_id is rejected rather than trusted');

  harness.calls.length = 0;
  const deleted = await requestJson(port, `/api/linwan/history?user_id=${USER_B}`, auth(tokenA), 'DELETE');
  assert.equal(deleted.status, 200);
  const deleteCall = harness.calls.find((call) => call.method === 'DELETE');
  assert.equal(deleteCall.url.searchParams.get('user_id'), `eq.${USER_A}`);
});

test('rejects a cross-user Supabase row before it can enter model context', async (t) => {
  const harness = createIsolationHarness({ contaminateUser: USER_A });
  const port = await listen(t, harness.fetch);
  const result = await requestJson(port, '/api/debate-experience-chat', auth(signToken(USER_A)), 'POST', {
    question: '这次请求不应到达模型',
    user_id: USER_B,
    chatHistory: [{ role: 'user', content: SECRET_B }]
  });

  assert.equal(result.status, 502);
  assert.equal(result.body.message.includes(SECRET_B), false);
  assert.equal(harness.modelRequests.length, 0);
});

test('isolates 10 concurrent rounds per account in storage and actual model messages', async (t) => {
  const harness = createIsolationHarness();
  const port = await listen(t, harness.fetch);
  const tokenA = signToken(USER_A);
  const tokenB = signToken(USER_B);

  const requests = [];
  for (let index = 0; index < 10; index += 1) {
    requests.push(requestJson(port, '/api/debate-experience-chat', auth(tokenA), 'POST', {
      question: `A专属信息：红色火箭888-A${index}`,
      user_id: USER_B,
      chatHistory: [{ role: 'user', content: SECRET_B }],
      userTrainingProfile: { recurringProblems: [`伪造B画像-${SECRET_B}-${index}`] }
    }));
    requests.push(requestJson(port, '/api/debate-experience-chat', auth(tokenB), 'POST', {
      question: `B专属信息：绿色月亮999-B${index}`,
      user_id: USER_A,
      chatHistory: [{ role: 'user', content: SECRET_A }],
      userTrainingProfile: { recurringProblems: [`伪造A画像-${SECRET_A}-${index}`] }
    }));
  }

  const responses = await Promise.all(requests);
  assert.equal(responses.every((response) => response.status === 200 && response.body.historySaved), true);
  assert.equal(harness.modelRequests.length, 20);

  harness.modelRequests.forEach(({ messages }) => {
    const joined = messages.map((message) => message.content).join('\n');
    const isA = joined.includes('红色火箭888');
    const isB = joined.includes('绿色月亮999');
    assert.notEqual(isA, isB, 'each model request contains exactly one account marker');
    if (isA) assert.equal(joined.includes(SECRET_B), false);
    if (isB) assert.equal(joined.includes(SECRET_A), false);
  });

  const persistedA = harness.messages.filter((row) => row.user_id === USER_A);
  const persistedB = harness.messages.filter((row) => row.user_id === USER_B);
  assert.equal(persistedA.some((row) => row.content.includes('绿色月亮999-B')), false);
  assert.equal(persistedB.some((row) => row.content.includes('红色火箭888-A')), false);
  assert.equal(persistedA.filter((row) => row.role === 'user' && row.content.includes('红色火箭888-A')).length, 10);
  assert.equal(persistedB.filter((row) => row.role === 'user' && row.content.includes('绿色月亮999-B')).length, 10);
});

test('account-owned personal records cannot be read through guest or forged local identity paths', async (t) => {
  const harness = createIsolationHarness();
  const port = await listen(t, harness.fetch);

  const guest = await requestJson(port, `/api/training-records?spaceType=personal&userId=${LOCAL_A}`);
  assert.equal(guest.status, 200);
  assert.deepEqual(guest.body.records.map((row) => row.topic), ['A的游客记录']);
  const guestQuery = harness.calls.find((call) => call.table === 'training_records');
  assert.equal(guestQuery.url.searchParams.get('app_user_id'), 'is.null');

  harness.calls.length = 0;
  const forgedByB = await requestJson(port, `/api/training-records?spaceType=personal&userId=${LOCAL_A}`, auth(signToken(USER_B)));
  assert.equal(forgedByB.status, 200);
  assert.deepEqual(forgedByB.body.records.map((row) => row.topic), ['B的账户记录']);
  const accountQuery = harness.calls.find((call) => call.table === 'training_records');
  assert.equal(accountQuery.url.searchParams.get('app_user_id'), `eq.${USER_B}`);
  assert.equal(accountQuery.url.searchParams.get('local_user_id'), null);

  const legacyTeam = await requestJson(port, `/api/training-records?spaceType=team&userId=${LOCAL_A}`);
  assert.equal(legacyTeam.status, 400);
});

test('team stats require membership and do not expose another ordinary member private review', async (t) => {
  const harness = createIsolationHarness();
  const port = await listen(t, harness.fetch);

  const denied = await requestJson(port, '/api/team/stats?teamCode=TEAMISO', auth(signToken(USER_C)));
  assert.equal(denied.status, 403);

  const stats = await requestJson(port, '/api/team/stats?teamCode=TEAMISO', auth(signToken(USER_B)));
  assert.equal(stats.status, 200);
  const recordA = stats.body.recentRecords.find((row) => row.topic === 'A团队训练');
  const recordB = stats.body.recentRecords.find((row) => row.topic === 'B团队训练');
  assert.deepEqual(recordA.messages, []);
  assert.equal(recordA.review, '');
  assert.equal(recordA.battlefield, '');
  assert.equal(recordB.messages.length > 0, true);
  assert.equal(recordB.review, 'B团队私人复盘');
});

test('shared speech endpoint validates MIME type and empty audio before Aliyun', async (t) => {
  const port = await listen(t);
  const unsupported = await requestRaw(port, '/api/speech/transcribe', 'text/plain', Buffer.from('not-audio'));
  assert.equal(unsupported.status, 415);
  const empty = await requestRaw(port, '/api/speech/transcribe', 'audio/wav', Buffer.alloc(0));
  assert.equal(empty.status, 400);
});

function createIsolationHarness(options = {}) {
  const calls = [];
  const modelRequests = [];
  let sequence = 0;
  const messages = [
    message(USER_A, 'user', `账户A：${SECRET_A}`, 'a-u'),
    message(USER_A, 'assistant', '已记录账户A测试内容', 'a-a'),
    message(USER_B, 'user', `账户B：${SECRET_B}`, 'b-u'),
    message(USER_B, 'assistant', '已记录账户B测试内容', 'b-a')
  ];
  const profiles = new Map([
    [USER_A, profile(USER_A, '账户A称呼')],
    [USER_B, profile(USER_B, '账户B称呼')]
  ]);
  const trainingRecords = [
    trainingRecord(LOCAL_A, null, 'A的游客记录'),
    trainingRecord(LOCAL_A, USER_A, 'A的账户记录'),
    trainingRecord(LOCAL_B, USER_B, 'B的账户记录'),
    trainingRecord(LOCAL_A, USER_A, 'A团队训练', 'team', 'TEAMISO', 'A团队私人复盘'),
    trainingRecord(LOCAL_B, USER_B, 'B团队训练', 'team', 'TEAMISO', 'B团队私人复盘')
  ];

  async function fetchMock(input, init = {}) {
    const url = new URL(String(input));
    const method = init.method || 'GET';
    if (url.hostname === 'deepseek.test') {
      const body = JSON.parse(init.body);
      modelRequests.push({ messages: body.messages });
      const question = body.messages.at(-1)?.content || '';
      return Response.json({ choices: [{ message: { content: `隔离回复：${question}` } }] });
    }

    const table = url.pathname.split('/').at(-1);
    calls.push({ url, method, table, body: init.body ? JSON.parse(init.body) : null });
    if (table === 'app_users') {
      const userId = eqValue(url, 'id');
      return Response.json([USER_A, USER_B, USER_C].includes(userId)
        ? [{ id: userId, username: `user_${userId.at(-1)}`, display_name: `用户${userId.at(-1)}` }]
        : []);
    }
    if (table === 'linwan_user_profile' && method === 'GET') {
      const userId = eqValue(url, 'user_id');
      return Response.json(profiles.has(userId) ? [profiles.get(userId)] : []);
    }
    if (table === 'linwan_user_profile' && method === 'POST') return Response.json([]);
    if (table === 'linwan_messages' && method === 'GET') {
      const userId = eqValue(url, 'user_id');
      const owned = messages.filter((row) => row.user_id === userId);
      if (options.contaminateUser === userId) return Response.json([...owned, message(USER_B, 'user', SECRET_B, 'leak')]);
      return Response.json([...owned].reverse());
    }
    if (table === 'linwan_messages' && method === 'POST') {
      const rows = JSON.parse(init.body).map((row) => ({ ...row, id: `saved-${++sequence}` }));
      messages.push(...rows);
      return Response.json(rows);
    }
    if (table === 'linwan_messages' && method === 'DELETE') return Response.json([]);
    if (table === 'training_records' && method === 'GET') {
      if (url.searchParams.get('space_type') === 'eq.team') {
        return Response.json(trainingRecords.filter((row) => row.space_type === 'team' && row.team_code === eqValue(url, 'team_code')));
      }
      const appUserFilter = url.searchParams.get('app_user_id');
      const localUser = eqValue(url, 'local_user_id');
      const rows = appUserFilter === 'is.null'
        ? trainingRecords.filter((row) => row.space_type === 'personal' && row.local_user_id === localUser && row.app_user_id === null)
        : trainingRecords.filter((row) => row.space_type === 'personal' && row.app_user_id === String(appUserFilter || '').replace(/^eq\./, ''));
      return Response.json(rows);
    }
    if (table === 'team_members' && method === 'GET') {
      const members = [
        { id: 'member-a', team_code: 'TEAMISO', local_user_id: LOCAL_A, app_user_id: USER_A, nickname: '成员A', role: 'member', status: 'active' },
        { id: 'member-b', team_code: 'TEAMISO', local_user_id: LOCAL_B, app_user_id: USER_B, nickname: '成员B', role: 'member', status: 'active' }
      ];
      const requestedUser = eqValue(url, 'app_user_id');
      return Response.json(requestedUser ? members.filter((row) => row.app_user_id === requestedUser) : members);
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  }

  return { calls, messages, modelRequests, fetch: fetchMock };
}

function message(userId, role, content, id) {
  return { id, user_id: userId, role, content, created_at: `2026-07-18T00:00:0${role === 'user' ? 0 : 1}.000Z`, context_manifest: null };
}

function profile(userId, preferredName) {
  return { user_id: userId, preferred_name: preferredName, response_length: 'balanced', communication_style: 'balanced', answer_order: 'auto', terminology_level: 'normal', custom_preference: '', auto_show_context: true };
}

function trainingRecord(localUserId, appUserId, topic, spaceType = 'personal', teamCode = null, review = '测试复盘') {
  return { id: `${topic}-id`, space_type: spaceType, team_code: teamCode, local_user_id: localUserId, app_user_id: appUserId, nickname: '测试', topic, user_side: 'affirmative', ai_side: 'negative', difficulty: 'novice', style_id: 'none', training_mode: 'free_debate', messages: [{ role: 'user', content: `${topic}内容` }], review, battlefield: `${topic}战场`, dimension_scores: [{ name: '逻辑', score: 75 }], score: 80, created_at: '2026-07-18T00:00:00.000Z' };
}

function eqValue(url, key) {
  return String(url.searchParams.get(key) || '').replace(/^eq\./, '');
}

function signToken(userId) {
  return jwt.sign({ sub: userId, username: `user_${userId.at(-1)}`, displayName: `用户${userId.at(-1)}` }, JWT_SECRET);
}

function auth(token) {
  return { authorization: `Bearer ${token}` };
}

async function listen(t, fetchMock = globalThis.fetch) {
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
  return request(port, pathname, method, { ...headers, ...(json ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(json) } : {}) }, json);
}

function requestRaw(port, pathname, contentType, body) {
  return request(port, pathname, 'POST', { 'content-type': contentType, 'content-length': body.length }, body);
}

function request(port, pathname, method, headers, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: pathname, method, headers }, (response) => {
      let responseBody = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { responseBody += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, body: responseBody ? JSON.parse(responseBody) : null }));
    });
    req.on('error', reject);
    req.end(body);
  });
}
