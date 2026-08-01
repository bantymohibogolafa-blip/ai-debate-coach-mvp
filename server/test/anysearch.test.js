import assert from 'node:assert/strict';
import test from 'node:test';
import { AnySearchError, searchAnySearch } from '../src/search/anysearch.js';

const key = 'test-only-secret-value';

test('AnySearch adapter sends a bounded POST request and parses results', async () => {
  let captured;
  const result = await searchAnySearch({
    query: '人工智能 创造力', max_results: 99, zone: 'intl', language: 'en'
  }, {
    apiKey: key,
    apiUrl: 'https://anysearch.test/v1/search',
    fetchImpl: async (url, init) => {
      captured = { url, init, body: JSON.parse(init.body) };
      return Response.json({
        code: 0,
        request_id: 'req-1',
        data: { results: [{ title: 'Study', url: 'https://example.com/a', snippet: 'Summary' }] }
      });
    }
  });
  assert.equal(captured.init.method, 'POST');
  assert.equal(captured.init.headers.Authorization, `Bearer ${key}`);
  assert.equal(captured.init.headers['Content-Type'], 'application/json');
  assert.deepEqual(captured.body, {
    query: '人工智能 创造力', max_results: 10, zone: 'intl', language: 'en', format: 'json'
  });
  assert.equal(result.requestId, 'req-1');
  assert.equal(result.results.length, 1);
});

test('AnySearch adapter accepts an empty successful result list', async () => {
  const result = await searchAnySearch({ query: 'empty' }, {
    apiKey: key,
    fetchImpl: async () => Response.json({ code: 0, data: { results: [] } })
  });
  assert.deepEqual(result.results, []);
});

test('AnySearch adapter maps provider and HTTP failures without exposing the key', async () => {
  const cases = [
    [400, 'invalid_query'], [401, 'invalid_credentials'], [402, 'quota_exhausted'],
    [403, 'invalid_credentials'], [429, 'rate_limited'], [500, 'service_unavailable'],
    [503, 'service_unavailable'], [504, 'service_unavailable']
  ];
  for (const [status, code] of cases) {
    let calls = 0;
    await assert.rejects(
      searchAnySearch({ query: 'failure' }, {
        apiKey: key,
        fetchImpl: async () => {
          calls += 1;
          return Response.json({ code: status, request_id: 'safe-request-id' }, { status });
        }
      }),
      (error) => {
        assert.equal(error instanceof AnySearchError, true);
        assert.equal(error.code, code);
        assert.equal(error.message.includes(key), false);
        return true;
      }
    );
    assert.equal(calls, [429, 500, 503, 504].includes(status) ? 2 : 1);
  }

  await assert.rejects(
    searchAnySearch({ query: 'provider-code' }, {
      apiKey: key,
      fetchImpl: async () => Response.json({ code: 9001, message: key })
    }),
    (error) => error.code === 'provider_error' && !error.message.includes(key)
  );
});

test('AnySearch adapter times out and never makes an anonymous request when the key is missing', async () => {
  let called = false;
  await assert.rejects(
    searchAnySearch({ query: 'missing' }, {
      apiKey: '',
      fetchImpl: async () => { called = true; }
    }),
    (error) => error.code === 'missing_key'
  );
  assert.equal(called, false);

  await assert.rejects(
    searchAnySearch({ query: 'timeout' }, {
      apiKey: key,
      timeoutMs: 1000,
      fetchImpl: async (url, init) => new Promise((resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      })
    }),
    (error) => error.code === 'timeout'
  );
});
