import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import jwt from 'jsonwebtoken';

const USER_A = '10000000-0000-4000-8000-000000000001';
const USER_B = '10000000-0000-4000-8000-000000000002';
const JWT_SECRET = 'linwan-api-test-secret-at-least-32-characters';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = JWT_SECRET;
process.env.SUPABASE_URL = 'https://supabase.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

const { app } = await import('../src/index.js');

test('Lin Wan history endpoints require authentication and always scope access to req.user.id', async (t) => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    calls.push({ url, method: init.method || 'GET' });

    if (url.pathname.endsWith('/app_users')) {
      const id = String(url.searchParams.get('id') || '').replace(/^eq\./, '');
      const user = id === USER_A
        ? { id: USER_A, username: 'user_a', display_name: '用户A' }
        : id === USER_B
          ? { id: USER_B, username: 'user_b', display_name: '用户B' }
          : null;
      return Response.json(user ? [user] : []);
    }

    if (url.pathname.endsWith('/linwan_messages') && (init.method || 'GET') === 'GET') {
      return Response.json([{
        id: '20000000-0000-4000-8000-000000000001',
        role: 'user',
        content: '用户A的问题',
        created_at: '2026-07-18T00:00:00.000Z',
        context_manifest: null
      }]);
    }

    if (url.pathname.endsWith('/linwan_messages') && init.method === 'DELETE') {
      return Response.json([]);
    }

    throw new Error(`Unexpected Supabase request: ${init.method || 'GET'} ${url}`);
  };

  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(async () => {
    globalThis.fetch = originalFetch;
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  const port = server.address().port;
  const tokenA = jwt.sign({ sub: USER_A, username: 'user_a', displayName: '用户A' }, JWT_SECRET);

  const unauthenticated = await requestJson(port, '/api/linwan/history');
  assert.equal(unauthenticated.status, 401);

  calls.length = 0;
  const history = await requestJson(port, `/api/linwan/history?limit=10&user_id=${USER_B}`, {
    authorization: `Bearer ${tokenA}`
  });
  assert.equal(history.status, 200);
  assert.equal(history.body.messages[0].content, '用户A的问题');
  const historyCall = calls.find((call) => call.url.pathname.endsWith('/linwan_messages'));
  assert.equal(historyCall.url.searchParams.get('user_id'), `eq.${USER_A}`);
  assert.equal(historyCall.url.searchParams.toString().includes(USER_B), false);

  calls.length = 0;
  const deleted = await requestJson(port, `/api/linwan/history?user_id=${USER_B}`, {
    authorization: `Bearer ${tokenA}`
  }, 'DELETE');
  assert.equal(deleted.status, 200);
  assert.equal(deleted.body.message, '聊天记录已清空。');
  const deleteCall = calls.find((call) => call.method === 'DELETE');
  assert.equal(deleteCall.url.pathname.endsWith('/linwan_messages'), true);
  assert.equal(deleteCall.url.searchParams.get('user_id'), `eq.${USER_A}`);
  assert.equal(calls.some((call) => /linwan_user_profile|training_records/.test(call.url.pathname)), false);
});

test('shared speech endpoint validates MIME type and empty audio before Aliyun', async (t) => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const port = server.address().port;

  const unsupported = await requestRaw(port, '/api/speech/transcribe', 'text/plain', Buffer.from('not-audio'));
  assert.equal(unsupported.status, 415);
  assert.equal(unsupported.body.message, '当前录音格式不受支持，请重新录音。');

  const empty = await requestRaw(port, '/api/speech/transcribe', 'audio/wav', Buffer.alloc(0));
  assert.equal(empty.status, 400);
  assert.equal(empty.body.message, '没有收到录音文件，请重新录音。');
});

function requestJson(port, pathname, headers = {}, method = 'GET') {
  return new Promise((resolve, reject) => {
    const request = http.request({
      hostname: '127.0.0.1',
      port,
      path: pathname,
      method,
      headers
    }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => resolve({
        status: response.statusCode,
        body: body ? JSON.parse(body) : null
      }));
    });
    request.on('error', reject);
    request.end();
  });
}

function requestRaw(port, pathname, contentType, body) {
  return new Promise((resolve, reject) => {
    const request = http.request({
      hostname: '127.0.0.1',
      port,
      path: pathname,
      method: 'POST',
      headers: {
        'content-type': contentType,
        'content-length': body.length
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
    request.end(body);
  });
}
