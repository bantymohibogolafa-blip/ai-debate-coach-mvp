import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { callDeepSeek } from './deepseek.js';
import {
  buildPolishMessages,
  buildRespondMessages,
  buildReviewMessages,
  buildStartMessages,
  isValidCelebrityDebater,
  isValidDifficulty,
  isValidSide,
  normalizeCelebrityDebater,
  normalizeDifficulty,
  normalizeSide
} from './prompts.js';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

const app = express();
const port = process.env.PORT || 3001;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, '../../client/dist');

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.post('/api/debate/start', async (req, res, next) => {
  try {
    const payload = validateSessionPayload(req.body);
    const messages = buildStartMessages(payload);
    const content = await callDeepSeek(messages, { maxTokens: 360 });

    res.json({ content: limitLength(cleanOpeningQuestion(content), 320) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/debate/respond', async (req, res, next) => {
  try {
    const payload = validateSessionPayload(req.body);
    const answer = normalizeText(req.body.answer);

    if (!answer) {
      return res.status(400).json({ message: '请先输入回答。' });
    }

    const messages = buildRespondMessages({ ...payload, answer });
    const content = await callDeepSeek(messages, { maxTokens: 420 });

    res.json({ content: limitLength(content, 320) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/debate/polish', async (req, res, next) => {
  try {
    const payload = validateSessionPayload(req.body);
    const answer = normalizeText(req.body.answer);

    if (!answer) {
      return res.status(400).json({ message: '请先输入回答。' });
    }

    const messages = buildPolishMessages({ ...payload, answer });
    const content = await callDeepSeek(messages, { maxTokens: 700, temperature: 0.45 });

    res.json(parsePolishContent(content, answer));
  } catch (error) {
    next(error);
  }
});

app.post('/api/debate/review', async (req, res, next) => {
  try {
    const payload = validateSessionPayload(req.body);

    if (!payload.history.length) {
      return res.status(400).json({ message: '暂无对话，无法复盘。' });
    }

    const messages = buildReviewMessages(payload);
    const content = await callDeepSeek(messages, { maxTokens: 900, temperature: 0.5 });

    res.json({ content });
  } catch (error) {
    next(error);
  }
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(clientDistPath));

  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

app.use((error, req, res, next) => {
  console.error(error);
  res.status(getPublicStatus(error)).json({
    message: getPublicErrorMessage(error)
  });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

function validateSessionPayload(body) {
  const topic = normalizeText(body.topic);
  const userSide = normalizeSide(normalizeText(body.userSide));
  const celebrityDebater = normalizeCelebrityDebater(normalizeText(body.celebrityDebater));
  const difficulty = celebrityDebater === 'none' ? normalizeDifficulty(normalizeText(body.difficulty)) : 'city';
  const rounds = Number(body.rounds);
  const history = Array.isArray(body.history) ? body.history : [];

  if (!topic) {
    throw badRequest('请输入辩题。');
  }

  if (!isValidSide(userSide)) {
    throw badRequest('请选择正方或反方。');
  }

  if (!isValidDifficulty(difficulty)) {
    throw badRequest('请选择训练难度。');
  }

  if (!isValidCelebrityDebater(celebrityDebater)) {
    throw badRequest('请选择有效的辩手模式。');
  }

  if (![3, 5].includes(rounds)) {
    throw badRequest('请选择3轮或5轮。');
  }

  return {
    topic,
    userSide,
    difficulty,
    celebrityDebater,
    rounds,
    history: history
      .filter((item) => ['ai', 'user'].includes(item.role) && normalizeText(item.content))
      .map((item) => ({
        role: item.role,
        content: normalizeText(item.content)
      }))
  };
}

function normalizeText(value) {
  return String(value || '').trim();
}

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function getPublicStatus(error) {
  if (error.status === 400 || error.status === 429) {
    return error.status;
  }

  return 502;
}

function getPublicErrorMessage(error) {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return '请求格式有误，请刷新后重试。';
  }

  if (error.status === 400 && error.message) {
    return error.message;
  }

  if (error.code === 'EMPTY_DEEPSEEK_CONTENT') {
    return 'AI 暂时没有返回内容，请重试。';
  }

  if (error.status === 429) {
    return 'AI 服务繁忙或额度不足，请稍后重试。';
  }

  return 'AI 服务暂时不可用，请稍后重试。';
}

function limitLength(text, maxLength) {
  const clean = normalizeText(text);
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 1)}…`;
}

function cleanOpeningQuestion(text) {
  const clean = normalizeText(text);
  const bracketProbe = clean.match(/【追问】\s*([\s\S]+)/);
  if (bracketProbe?.[1]) {
    return normalizeText(bracketProbe[1]);
  }

  const colonProbe = clean.match(/追问[：:]\s*([\s\S]+)/);
  if (colonProbe?.[1]) {
    return normalizeText(colonProbe[1]);
  }

  return clean
    .split('\n')
    .filter((line) => !/漏洞判断|漏洞[：:]/.test(line))
    .join('\n')
    .trim();
}

function parsePolishContent(content, fallbackAnswer) {
  const clean = normalizeText(content);
  const jsonText = extractJsonObject(clean);

  if (jsonText) {
    try {
      const parsed = JSON.parse(jsonText);
      return {
        original: fallbackAnswer,
        polished: limitLength(parsed.polished, 180) || fallbackAnswer,
        concise: limitLength(parsed.concise, 130) || limitLength(fallbackAnswer, 130),
        tip: limitLength(parsed.tip, 120) || '建议先给结论，再补一个清晰标准。'
      };
    } catch {
      // Fall through to the conservative fallback below.
    }
  }

  return {
    original: fallbackAnswer,
    polished: limitLength(clean, 180) || fallbackAnswer,
    concise: limitLength(fallbackAnswer, 130),
    tip: '建议先给结论，再补一个清晰标准。'
  };
}

function extractJsonObject(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    return '';
  }

  return text.slice(start, end + 1);
}
