import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

const apiUrl = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/chat/completions';
const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
const thinkingType = process.env.DEEPSEEK_THINKING || 'disabled';

export async function callDeepSeek(messages, options = {}) {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    const error = new Error('DeepSeek API Key is not configured.');
    error.code = 'MISSING_DEEPSEEK_API_KEY';
    error.status = 500;
    throw error;
  }

  const response = await fetch(apiUrl, {
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
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error('DeepSeek request failed', {
      status: response.status,
      message: data?.error?.message
    });

    const error = new Error('DeepSeek API request failed.');
    error.code = 'DEEPSEEK_REQUEST_FAILED';
    error.status = response.status === 429 ? 429 : 502;
    throw error;
  }

  const choice = data?.choices?.[0];
  const content = choice?.message?.content?.trim();

  if (!content) {
    console.error('DeepSeek returned empty content', {
      model,
      finishReason: choice?.finish_reason,
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
