import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

const apiUrl = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/chat/completions';
const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
const thinkingType = process.env.DEEPSEEK_THINKING || 'disabled';
const requestTimeoutMs = positiveIntegerEnv('DEEPSEEK_TIMEOUT_MS', 120000);

export async function callDeepSeek(messages, options = {}) {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    const error = new Error('DeepSeek API Key is not configured.');
    error.code = 'MISSING_DEEPSEEK_API_KEY';
    error.status = 500;
    throw error;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  let response;
  let responseText;

  try {
    response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        thinking: {
          type: thinkingType
        },
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 500
      }),
      signal: controller.signal
    });
    responseText = await response.text();
  } catch (cause) {
    if (controller.signal.aborted) {
      throw createDeepSeekError('DeepSeek API request timed out.', 'DEEPSEEK_TIMEOUT', {
        status: 504,
        timeoutMs: requestTimeoutMs,
        cause
      });
    }
    throw cause;
  } finally {
    clearTimeout(timeout);
  }

  let data;

  try {
    data = JSON.parse(responseText);
  } catch (cause) {
    if (!response.ok) {
      console.error('DeepSeek request failed with a non-JSON response', {
        status: response.status,
        contentType: response.headers.get('content-type') || '',
        bodyPreview: createSafeBodyPreview(responseText)
      });

      const error = createDeepSeekError('DeepSeek API request failed.', 'DEEPSEEK_REQUEST_FAILED', {
        status: response.status === 429 ? 429 : 502,
        upstreamStatus: response.status,
        upstreamBodyPreview: createSafeBodyPreview(responseText),
        cause
      });
      throw error;
    }

    console.error('DeepSeek returned an invalid JSON response', {
      status: response.status,
      contentType: response.headers.get('content-type') || '',
      bodyPreview: createSafeBodyPreview(responseText)
    });

    throw createDeepSeekError('DeepSeek API returned an invalid response.', 'DEEPSEEK_INVALID_RESPONSE', {
      status: 502,
      upstreamStatus: response.status,
      upstreamBodyPreview: createSafeBodyPreview(responseText),
      cause
    });
  }

  if (!response.ok) {
    console.error('DeepSeek request failed', {
      status: response.status,
      message: data?.error?.message
    });

    throw createDeepSeekError('DeepSeek API request failed.', 'DEEPSEEK_REQUEST_FAILED', {
      status: response.status === 429 ? 429 : 502,
      upstreamStatus: response.status,
      upstreamMessage: typeof data?.error?.message === 'string' ? data.error.message : ''
    });
  }

  const choice = data?.choices?.[0];
  const finishReason = choice?.finish_reason;

  if (finishReason === 'length') {
    console.error('DeepSeek output was truncated', { model, finishReason });
    throw createDeepSeekError('DeepSeek API output was truncated.', 'DEEPSEEK_OUTPUT_TRUNCATED', {
      status: 502,
      finishReason
    });
  }

  if (finishReason === 'content_filter') {
    console.error('DeepSeek output was filtered', { model, finishReason });
    throw createDeepSeekError('DeepSeek API output was filtered.', 'DEEPSEEK_CONTENT_FILTERED', {
      status: 502,
      finishReason
    });
  }

  if (finishReason === 'insufficient_system_resource') {
    console.error('DeepSeek had insufficient system resources', { model, finishReason });
    throw createDeepSeekError('DeepSeek API resources were unavailable.', 'DEEPSEEK_RESOURCE_UNAVAILABLE', {
      status: 502,
      finishReason
    });
  }

  if (finishReason === 'tool_calls' || choice?.message?.tool_calls?.length) {
    console.error('DeepSeek returned unsupported tool calls', { model, finishReason });
    throw createDeepSeekError('DeepSeek API returned unsupported tool calls.', 'DEEPSEEK_UNSUPPORTED_TOOL_CALLS', {
      status: 502,
      finishReason: finishReason || 'tool_calls'
    });
  }

  const content = choice?.message?.content?.trim();

  if (!content) {
    console.error('DeepSeek returned empty content', {
      model,
      finishReason,
      hasChoices: Array.isArray(data?.choices),
      choiceCount: data?.choices?.length || 0
    });

    const error = new Error('DeepSeek API returned empty content.');
    error.code = 'EMPTY_DEEPSEEK_CONTENT';
    error.status = 502;
    throw error;
  }

  return content;
}

function createDeepSeekError(message, code, details = {}) {
  const error = new Error(message, details.cause ? { cause: details.cause } : undefined);
  error.code = code;
  Object.entries(details).forEach(([key, value]) => {
    if (key !== 'cause' && value !== undefined) error[key] = value;
  });
  return error;
}

function createSafeBodyPreview(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

function positiveIntegerEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}
