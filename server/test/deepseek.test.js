import assert from 'node:assert/strict';
import test from 'node:test';

process.env.DEEPSEEK_API_KEY = 'deepseek-unit-test-key';
process.env.DEEPSEEK_API_URL = 'https://deepseek.unit.test/chat/completions';
process.env.DEEPSEEK_MODEL = 'deepseek-test-model';
process.env.DEEPSEEK_TIMEOUT_MS = '25';

const originalFetch = global.fetch;
const { callDeepSeek } = await import('../src/deepseek.js?deepseek-unit-test');

test.afterEach(() => {
  global.fetch = originalFetch;
});

test('returns the same trimmed content for a normal DeepSeek response', async () => {
  global.fetch = async () => Response.json({
    choices: [{ finish_reason: 'stop', message: { content: '  正常回答  ' } }]
  });

  assert.equal(await callDeepSeek([{ role: 'user', content: '测试' }]), '正常回答');
});

test('rejects a successful response whose body is not valid JSON', async () => {
  global.fetch = async () => new Response('<html>bad gateway</html>', {
    status: 200,
    headers: { 'content-type': 'text/html' }
  });

  await assert.rejects(
    callDeepSeek([{ role: 'user', content: '测试' }]),
    (error) => error.code === 'DEEPSEEK_INVALID_RESPONSE'
      && error.status === 502
      && error.upstreamStatus === 200
      && error.cause instanceof SyntaxError
  );
});

test('preserves the upstream status when an error response is not JSON', async () => {
  global.fetch = async () => new Response('rate limited', { status: 429 });

  await assert.rejects(
    callDeepSeek([{ role: 'user', content: '测试' }]),
    (error) => error.code === 'DEEPSEEK_REQUEST_FAILED'
      && error.status === 429
      && error.upstreamStatus === 429
      && error.upstreamBodyPreview === 'rate limited'
  );
});

test('rejects truncated output instead of returning partial content', async () => {
  global.fetch = async () => Response.json({
    choices: [{ finish_reason: 'length', message: { content: '{"partial":' } }]
  });

  await assert.rejects(
    callDeepSeek([{ role: 'user', content: '测试' }]),
    (error) => error.code === 'DEEPSEEK_OUTPUT_TRUNCATED' && error.finishReason === 'length'
  );
});

test('aborts a DeepSeek request after the configured timeout', async () => {
  global.fetch = async (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      reject(error);
    }, { once: true });
  });

  await assert.rejects(
    callDeepSeek([{ role: 'user', content: 'timeout' }]),
    (error) => error.code === 'DEEPSEEK_TIMEOUT'
      && error.status === 504
      && error.timeoutMs === 25
      && error.cause?.name === 'AbortError'
  );
});

test('rejects filtered, resource-limited, and tool-call responses explicitly', async () => {
  const cases = [
    ['content_filter', 'DEEPSEEK_CONTENT_FILTERED'],
    ['insufficient_system_resource', 'DEEPSEEK_RESOURCE_UNAVAILABLE'],
    ['tool_calls', 'DEEPSEEK_UNSUPPORTED_TOOL_CALLS']
  ];

  for (const [finishReason, expectedCode] of cases) {
    global.fetch = async () => Response.json({
      choices: [{
        finish_reason: finishReason,
        message: {
          content: finishReason === 'tool_calls' ? null : '不应返回给用户',
          ...(finishReason === 'tool_calls' ? { tool_calls: [{ id: 'call-1' }] } : {})
        }
      }]
    });

    await assert.rejects(
      callDeepSeek([{ role: 'user', content: '测试' }]),
      (error) => error.code === expectedCode && error.finishReason === finishReason
    );
  }
});
