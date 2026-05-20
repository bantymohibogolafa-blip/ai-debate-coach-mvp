import cors from 'cors';
import crypto from 'node:crypto';
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
  isValidTrainingMode,
  normalizeCelebrityDebater,
  normalizeDifficulty,
  normalizeSide,
  normalizeTrainingMode
} from './prompts.js';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

const app = express();
const port = process.env.PORT || 3001;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, '../../client/dist');
const trainingRecordsTable = process.env.SUPABASE_TRAINING_TABLE || 'training_records';
const teamsTable = process.env.SUPABASE_TEAMS_TABLE || 'teams';
const teamMembersTable = process.env.SUPABASE_TEAM_MEMBERS_TABLE || 'team_members';
const aliyunTokenCache = {
  token: '',
  expireTime: 0
};

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
    const content = await callDeepSeek(messages, { maxTokens: 2200, temperature: 0.5 });

    res.json({ content });
  } catch (error) {
    next(error);
  }
});

app.post('/api/team/join', async (req, res, next) => {
  try {
    const memberPayload = validateTeamMemberPayload(req.body);
    const { team, member } = await joinTeam(memberPayload);

    res.json({
      team: mapTeamFromDb(team),
      member: mapTeamMemberFromDb(member)
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/training-records', async (req, res, next) => {
  try {
    const userId = normalizeText(req.query.userId || req.query.localUserId);
    const scope = normalizeRecordScope(req.query.scope);
    const limit = clampNumber(Number(req.query.limit || 20), 1, 50);
    const localUserId = normalizeLegacyOrLocalUserId(userId);

    if (!isValidLocalUserId(localUserId)) {
      return res.status(400).json({ message: '匿名用户 ID 无效，请刷新页面后重试。' });
    }

    const records = scope === 'personal'
      ? await fetchPersonalTrainingRecords(localUserId, limit)
      : await fetchLegacyTrainingRecords(localUserId, limit);
    res.json({ records: records.map(mapTrainingRecordFromDb) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/training-records', async (req, res, next) => {
  try {
    const record = validateTrainingRecordPayload(req.body);
    if (isPersonalTeamCode(record.team_code)) {
      await ensurePersonalTeam(record.team_code);
    }
    const savedRecords = await insertTrainingRecord(record);

    res.status(201).json({ record: mapTrainingRecordFromDb(savedRecords[0]) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/training-records/my', async (req, res, next) => {
  try {
    const teamCode = normalizeTeamCode(req.query.teamCode);
    const localUserId = normalizeText(req.query.localUserId);

    if (!isValidTeamCode(teamCode) || !isValidLocalUserId(localUserId)) {
      return res.status(400).json({ message: '团队信息无效，请重新加入团队。' });
    }

    const records = await fetchMyTrainingRecords(teamCode, localUserId, 50);
    res.json({ records: records.map(mapTrainingRecordFromDb) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/training-records/team', async (req, res, next) => {
  try {
    const teamCode = normalizeTeamCode(req.query.teamCode);

    if (!isValidTeamCode(teamCode)) {
      return res.status(400).json({ message: '团队码无效，请重新加入团队。' });
    }

    const records = await fetchTeamTrainingRecords(teamCode, 50);
    res.json({ records: records.map(mapTrainingRecordFromDb) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/team/stats', async (req, res, next) => {
  try {
    const teamCode = normalizeTeamCode(req.query.teamCode);

    if (!isValidTeamCode(teamCode)) {
      return res.status(400).json({ message: '团队码无效，请重新加入团队。' });
    }

    const stats = await fetchTeamStats(teamCode);
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

app.post(
  '/api/speech/transcribe',
  express.raw({
    limit: '12mb',
    type: ['audio/*', 'application/octet-stream']
  }),
  async (req, res, next) => {
    try {
      const audioBuffer = req.body;
      const mimeType = normalizeText(req.headers['content-type']) || 'application/octet-stream';

      if (!Buffer.isBuffer(audioBuffer) || audioBuffer.length === 0) {
        return res.status(400).json({ message: '没有收到录音文件，请重新录音。' });
      }

      const transcript = await transcribeAudio(audioBuffer, mimeType);
      res.json({ text: transcript });
    } catch (error) {
      next(error);
    }
  }
);

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
  const trainingMode = normalizeTrainingMode(normalizeText(body.trainingMode || body.training_mode));
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

  if (!isValidTrainingMode(trainingMode)) {
    throw badRequest('请选择有效的训练模式。');
  }

  if (![1, 3, 5].includes(rounds)) {
    throw badRequest('请选择有效训练轮数。');
  }

  return {
    topic,
    userSide,
    difficulty,
    celebrityDebater,
    trainingMode,
    rounds,
    history: history
      .filter((item) => ['ai', 'user'].includes(item.role) && normalizeText(item.content))
      .map((item) => ({
        role: item.role,
        content: normalizeText(item.content)
      }))
  };
}

function validateTrainingRecordPayload(body) {
  const teamCode = normalizeTeamCode(body.teamCode || body.team_code);
  const localUserId = normalizeText(body.localUserId || body.local_user_id || body.userId || body.user_id);
  const nickname = normalizeNickname(body.nickname);
  const recordScope = normalizeRecordScope(body.recordScope || body.scope);
  const topic = normalizeText(body.topic);
  const userSide = normalizeSide(normalizeText(body.userSide || body.user_side));
  const aiSide = normalizeSide(normalizeText(body.aiSide || body.ai_side));
  const difficulty = normalizeDifficulty(normalizeText(body.difficulty));
  const styleId = normalizeCelebrityDebater(normalizeText(body.styleId || body.style_id || 'none'));
  const trainingMode = normalizeTrainingMode(normalizeText(body.trainingMode || body.training_mode));
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const review = normalizeText(body.review);
  const score = parseNullableScore(body.score);
  const result = normalizeText(body.result);
  const battlefield = normalizeText(body.battlefield);

  if (!isValidLocalUserId(localUserId)) {
    throw badRequest('用户身份无效，请刷新页面后重试。');
  }

  const normalizedTeamCode = recordScope === 'personal' ? getPersonalTeamCode(localUserId) : teamCode;
  const normalizedNickname = recordScope === 'personal' ? '个人用户' : nickname;

  if (!isValidTeamCode(normalizedTeamCode) || !isValidNickname(normalizedNickname)) {
    throw badRequest('团队身份信息无效，请重新加入团队。');
  }

  if (!topic) {
    throw badRequest('训练记录缺少辩题。');
  }

  if (!isValidSide(userSide) || !isValidSide(aiSide)) {
    throw badRequest('训练记录缺少有效立场。');
  }

  if (!isValidDifficulty(difficulty)) {
    throw badRequest('训练记录缺少有效难度。');
  }

  if (!isValidCelebrityDebater(styleId)) {
    throw badRequest('训练记录缺少有效风格。');
  }

  if (!isValidTrainingMode(trainingMode)) {
    throw badRequest('训练记录缺少有效训练模式。');
  }

  if (!messages.length) {
    throw badRequest('训练记录缺少完整对话。');
  }

  if (['constructive', 'summary', 'closing'].includes(trainingMode)) {
    const longestUserMessage = messages
      .filter((item) => item.role === 'user')
      .reduce((maxLength, item) => Math.max(maxLength, normalizeText(item.content).length), 0);

    if (longestUserMessage > 1200) {
      throw badRequest('单项训练发言不能超过1200字。');
    }
  }

  if (!review) {
    throw badRequest('训练记录缺少复盘报告。');
  }

  return {
    team_code: normalizedTeamCode,
    local_user_id: localUserId,
    nickname: normalizedNickname,
    topic,
    user_side: userSide,
    ai_side: aiSide,
    difficulty,
    style_id: styleId,
    training_mode: trainingMode,
    messages: messages
      .filter((item) => ['ai', 'user'].includes(item.role) && normalizeText(item.content))
      .map((item) => ({
        role: item.role,
        content: normalizeText(item.content)
      })),
    review,
    score,
    result,
    battlefield,
    created_at: new Date().toISOString()
  };
}

function validateTeamMemberPayload(body) {
  const teamCode = normalizeTeamCode(body.teamCode || body.team_code);
  const nickname = normalizeNickname(body.nickname);
  const localUserId = normalizeText(body.localUserId || body.local_user_id);

  if (!isValidTeamCode(teamCode)) {
    throw badRequest('请输入 3-32 位团队码，只能包含字母、数字、短横线或下划线。');
  }

  if (!isValidNickname(nickname)) {
    throw badRequest('请输入 1-20 个字符的昵称。');
  }

  if (!isValidLocalUserId(localUserId)) {
    throw badRequest('用户身份无效，请刷新页面后重试。');
  }

  return { teamCode, nickname, localUserId };
}

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeTeamCode(value) {
  return normalizeText(value).toUpperCase();
}

function normalizeNickname(value) {
  return normalizeText(value).replace(/\s+/g, ' ');
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

  if (error.code === 'SUPABASE_NOT_CONFIGURED') {
    return 501;
  }

  if (error.code === 'ASR_NOT_CONFIGURED') {
    return 501;
  }

  return 502;
}

function getPublicErrorMessage(error) {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return '请求格式有误，请刷新后重试。';
  }

  if (error.code === 'EMPTY_DEEPSEEK_CONTENT') {
    return 'AI 暂时没有返回内容，请重试。';
  }

  if (error.status === 429) {
    return 'AI 服务繁忙或额度不足，请稍后重试。';
  }

  if (error.code === 'ASR_NOT_CONFIGURED') {
    return '录音识别服务暂未配置，请先使用文字输入。';
  }

  if (error.code === 'SUPABASE_NOT_CONFIGURED') {
    return '历史记录服务暂未配置，请检查 Supabase 环境变量。';
  }

  if (error.code === 'SUPABASE_REQUEST_FAILED') {
    return '历史记录保存或读取失败，请稍后重试。';
  }

  if (error.status === 400 && error.message) {
    return error.message;
  }

  if (error.code === 'ASR_REQUEST_FAILED' || error.code === 'EMPTY_ASR_CONTENT') {
    return '录音识别失败，请重试或改用文字输入。';
  }

  return 'AI 服务暂时不可用，请稍后重试。';
}

function limitLength(text, maxLength) {
  const clean = normalizeText(text);
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 1)}…`;
}

function isValidLegacyUserId(userId) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId);
}

function isValidLocalUserId(localUserId) {
  return /^user_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(localUserId);
}

function normalizeLegacyOrLocalUserId(userId) {
  const normalizedUserId = normalizeText(userId);
  if (isValidLocalUserId(normalizedUserId)) return normalizedUserId;
  if (isValidLegacyUserId(normalizedUserId)) return `user_${normalizedUserId}`;
  return normalizedUserId;
}

function normalizeRecordScope(value) {
  return normalizeText(value) === 'personal' ? 'personal' : 'team';
}

function getPersonalTeamCode(localUserId) {
  const match = /^user_([0-9a-f]{8})-/i.exec(localUserId);
  return `PERSONAL_${(match?.[1] || 'LOCAL').toUpperCase()}`;
}

function isPersonalTeamCode(teamCode) {
  return /^PERSONAL_[0-9A-F]{8}$/.test(teamCode);
}

function isValidTeamCode(teamCode) {
  return /^[A-Z0-9_-]{3,32}$/.test(teamCode);
}

function isValidNickname(nickname) {
  return nickname.length >= 1 && nickname.length <= 20 && !/[<>]/.test(nickname);
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function parseNullableScore(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const score = Number(value);
  if (!Number.isFinite(score)) {
    return null;
  }

  return clampNumber(Math.round(score), 0, 100);
}

function getSupabaseConfig() {
  const url = normalizeText(process.env.SUPABASE_URL).replace(/\/$/, '');
  const serviceRoleKey = normalizeText(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!url || !serviceRoleKey) {
    const error = new Error('Supabase is not configured.');
    error.code = 'SUPABASE_NOT_CONFIGURED';
    error.status = 501;
    throw error;
  }

  return { url, serviceRoleKey };
}

async function joinTeam({ teamCode, nickname, localUserId }) {
  let team = await getSingleByQuery(
    teamsTable,
    new URLSearchParams({
      select: 'team_code,team_name,created_at',
      team_code: `eq.${teamCode}`,
      limit: '1'
    })
  );

  if (!team) {
    const createdTeams = await supabaseRequest(teamsTable, {
      method: 'POST',
      body: {
        team_code: teamCode,
        team_name: teamCode,
        created_at: new Date().toISOString()
      },
      prefer: 'return=representation'
    });
    team = createdTeams[0];
  }

  let member = await getSingleByQuery(
    teamMembersTable,
    new URLSearchParams({
      select: 'id,team_code,local_user_id,nickname,created_at,last_seen_at',
      team_code: `eq.${teamCode}`,
      local_user_id: `eq.${localUserId}`,
      limit: '1'
    })
  );

  if (!member) {
    const createdMembers = await supabaseRequest(teamMembersTable, {
      method: 'POST',
      body: {
        team_code: teamCode,
        local_user_id: localUserId,
        nickname,
        created_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString()
      },
      prefer: 'return=representation'
    });
    member = createdMembers[0];
  } else {
    const updatedMembers = await supabaseRequest(
      `${teamMembersTable}?team_code=eq.${encodeURIComponent(teamCode)}&local_user_id=eq.${encodeURIComponent(localUserId)}`,
      {
        method: 'PATCH',
        body: {
          nickname,
          last_seen_at: new Date().toISOString()
        },
        prefer: 'return=representation'
      }
    );
    member = updatedMembers[0] || member;
  }

  return { team, member };
}

async function getSingleByQuery(tableName, query) {
  const rows = await supabaseRequest(`${tableName}?${query.toString()}`);
  return rows[0] || null;
}

async function fetchLegacyTrainingRecords(localUserId, limit) {
  const query = new URLSearchParams({
    select: 'id,team_code,local_user_id,nickname,topic,user_side,ai_side,difficulty,style_id,training_mode,messages,review,score,result,battlefield,created_at',
    local_user_id: `eq.${localUserId}`,
    order: 'created_at.desc',
    limit: String(limit)
  });

  return supabaseRequest(`${trainingRecordsTable}?${query.toString()}`);
}

async function ensurePersonalTeam(teamCode) {
  const existingTeam = await getSingleByQuery(
    teamsTable,
    new URLSearchParams({
      team_code: `eq.${teamCode}`
    })
  );

  if (existingTeam) return existingTeam;

  const createdTeams = await supabaseRequest(teamsTable, {
    method: 'POST',
    body: {
      team_code: teamCode,
      team_name: '个人模式'
    },
    prefer: 'return=representation'
  });

  return createdTeams[0] || null;
}

async function fetchPersonalTrainingRecords(localUserId, limit) {
  const query = new URLSearchParams({
    select: 'id,team_code,local_user_id,nickname,topic,user_side,ai_side,difficulty,style_id,training_mode,messages,review,score,result,battlefield,created_at',
    team_code: `eq.${getPersonalTeamCode(localUserId)}`,
    local_user_id: `eq.${localUserId}`,
    order: 'created_at.desc',
    limit: String(limit)
  });

  return supabaseRequest(`${trainingRecordsTable}?${query.toString()}`);
}

async function fetchMyTrainingRecords(teamCode, localUserId, limit) {
  const query = new URLSearchParams({
    select: 'id,team_code,local_user_id,nickname,topic,user_side,ai_side,difficulty,style_id,training_mode,messages,review,score,result,battlefield,created_at',
    team_code: `eq.${teamCode}`,
    local_user_id: `eq.${localUserId}`,
    order: 'created_at.desc',
    limit: String(limit)
  });

  return supabaseRequest(`${trainingRecordsTable}?${query.toString()}`);
}

async function fetchTeamTrainingRecords(teamCode, limit) {
  const query = new URLSearchParams({
    select: 'id,team_code,local_user_id,nickname,topic,user_side,ai_side,difficulty,style_id,training_mode,messages,review,score,result,battlefield,created_at',
    team_code: `eq.${teamCode}`,
    order: 'created_at.desc',
    limit: String(limit)
  });

  return supabaseRequest(`${trainingRecordsTable}?${query.toString()}`);
}

async function fetchTeamStats(teamCode) {
  const records = await fetchAllTeamRecordsForStats(teamCode);
  const scoredRecords = records.filter((record) => Number.isFinite(Number(record.score)));
  const memberMap = new Map();
  const recentRecords = records
    .slice(0, 10)
    .map(mapTrainingRecordFromDb);

  records.forEach((record) => {
    const key = record.local_user_id;
    if (!key) return;
    const current = memberMap.get(key) || {
      nickname: record.nickname || '未命名成员',
      localUserId: key,
      count: 0,
      scoreTotal: 0,
      scoreCount: 0,
      highestScore: null
    };
    const score = Number(record.score);
    current.nickname = record.nickname || current.nickname;
    current.count += 1;
    if (Number.isFinite(score)) {
      current.scoreTotal += score;
      current.scoreCount += 1;
      current.highestScore = current.highestScore === null ? score : Math.max(current.highestScore, score);
    }
    memberMap.set(key, current);
  });

  const memberStats = Array.from(memberMap.values())
    .map((member) => ({
      nickname: member.nickname,
      localUserId: member.localUserId,
      count: member.count,
      averageScore: member.scoreCount ? roundToOne(member.scoreTotal / member.scoreCount) : null,
      highestScore: member.highestScore
    }))
    .sort((a, b) => b.count - a.count || (b.averageScore || 0) - (a.averageScore || 0));

  return {
    totalRecords: records.length,
    averageScore: scoredRecords.length
      ? roundToOne(scoredRecords.reduce((sum, record) => sum + Number(record.score), 0) / scoredRecords.length)
      : null,
    highestScore: scoredRecords.length
      ? Math.max(...scoredRecords.map((record) => Number(record.score)))
      : null,
    memberStats,
    recentRecords
  };
}

async function fetchAllTeamRecordsForStats(teamCode) {
  const query = new URLSearchParams({
    select: 'id,team_code,local_user_id,nickname,topic,user_side,ai_side,difficulty,style_id,training_mode,messages,review,score,result,battlefield,created_at',
    team_code: `eq.${teamCode}`,
    order: 'created_at.desc',
    limit: '1000'
  });

  return supabaseRequest(`${trainingRecordsTable}?${query.toString()}`);
}

async function insertTrainingRecord(record) {
  return supabaseRequest(trainingRecordsTable, {
    method: 'POST',
    body: record,
    prefer: 'return=representation'
  });
}

async function supabaseRequest(pathname, options = {}) {
  const { url, serviceRoleKey } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${pathname}`, {
    method: options.method || 'GET',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      ...(options.prefer ? { Prefer: options.prefer } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error('Supabase request failed', {
      status: response.status,
      message: data?.message,
      details: data?.details
    });

    const error = new Error('Supabase request failed.');
    error.code = 'SUPABASE_REQUEST_FAILED';
    error.status = response.status;
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

function mapTrainingRecordFromDb(record = {}) {
  return {
    id: record.id,
    teamCode: record.team_code,
    localUserId: record.local_user_id,
    nickname: record.nickname,
    topic: record.topic,
    userSide: record.user_side,
    aiSide: record.ai_side,
    difficulty: record.difficulty,
    styleId: record.style_id,
    trainingMode: record.training_mode || 'free_debate',
    messages: Array.isArray(record.messages) ? record.messages : [],
    review: record.review || '',
    score: record.score ?? null,
    result: record.result || '',
    battlefield: record.battlefield || '',
    createdAt: record.created_at
  };
}

function mapTeamFromDb(team = {}) {
  return {
    teamCode: team.team_code,
    teamName: team.team_name,
    createdAt: team.created_at
  };
}

function mapTeamMemberFromDb(member = {}) {
  return {
    id: member.id,
    teamCode: member.team_code,
    localUserId: member.local_user_id,
    nickname: member.nickname,
    createdAt: member.created_at,
    lastSeenAt: member.last_seen_at
  };
}

function roundToOne(value) {
  return Math.round(value * 10) / 10;
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

async function transcribeAudio(audioBuffer, mimeType) {
  const appKey = process.env.ALIYUN_NLS_APPKEY;
  const apiUrl = process.env.ALIYUN_NLS_URL || 'https://nls-gateway-cn-shanghai.aliyuncs.com/stream/v1/asr';

  if (!appKey) {
    const error = new Error('Speech recognition service is not configured.');
    error.code = 'ASR_NOT_CONFIGURED';
    error.status = 501;
    throw error;
  }

  const token = await getAliyunNlsToken();

  const requestUrl = new URL(apiUrl);
  requestUrl.searchParams.set('appkey', appKey);
  requestUrl.searchParams.set('format', getAliyunAudioFormat(mimeType));
  requestUrl.searchParams.set('sample_rate', '16000');
  requestUrl.searchParams.set('enable_punctuation_prediction', 'true');
  requestUrl.searchParams.set('enable_inverse_text_normalization', 'true');

  const response = await fetch(requestUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-NLS-Token': token
    },
    body: audioBuffer
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !isAliyunSuccess(data)) {
    console.error('ASR request failed', {
      status: response.status,
      message: data?.message,
      code: data?.status
    });

    const error = new Error('Speech recognition request failed.');
    error.code = 'ASR_REQUEST_FAILED';
    error.status = response.status === 429 ? 429 : 502;
    throw error;
  }

  const text = normalizeText(data.result || data.text);
  if (!text) {
    const error = new Error('Speech recognition returned empty text.');
    error.code = 'EMPTY_ASR_CONTENT';
    error.status = 502;
    throw error;
  }

  return text;
}

function isAliyunSuccess(data) {
  return data?.status === 20000000 || data?.status === '20000000';
}

function getAliyunAudioFormat(mimeType) {
  if (mimeType.includes('wav')) return 'wav';
  return 'wav';
}

async function getAliyunNlsToken() {
  const now = Math.floor(Date.now() / 1000);
  if (aliyunTokenCache.token && aliyunTokenCache.expireTime - now > 300) {
    return aliyunTokenCache.token;
  }

  const staticToken = normalizeText(process.env.ALIYUN_NLS_TOKEN);
  const accessKeyId = normalizeText(process.env.ALIYUN_ACCESS_KEY_ID || process.env.ALIYUN_AK_ID);
  const accessKeySecret = normalizeText(process.env.ALIYUN_ACCESS_KEY_SECRET || process.env.ALIYUN_AK_SECRET);

  if (!accessKeyId || !accessKeySecret) {
    if (staticToken) {
      return staticToken;
    }

    const error = new Error('Aliyun AccessKey is not configured.');
    error.code = 'ASR_NOT_CONFIGURED';
    error.status = 501;
    throw error;
  }

  const endpoint = process.env.ALIYUN_NLS_TOKEN_URL || 'http://nls-meta.cn-shanghai.aliyuncs.com/';
  const parameters = {
    AccessKeyId: accessKeyId,
    Action: 'CreateToken',
    Format: 'JSON',
    RegionId: 'cn-shanghai',
    SignatureMethod: 'HMAC-SHA1',
    SignatureNonce: crypto.randomUUID(),
    SignatureVersion: '1.0',
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    Version: '2019-02-28'
  };
  const canonicalQuery = canonicalizeAliyunParameters(parameters);
  const stringToSign = `GET&${percentEncode('/')}&${percentEncode(canonicalQuery)}`;
  const signature = crypto
    .createHmac('sha1', `${accessKeySecret}&`)
    .update(stringToSign)
    .digest('base64');
  const requestUrl = `${endpoint}?Signature=${percentEncode(signature)}&${canonicalQuery}`;
  const response = await fetch(requestUrl);
  const data = await response.json().catch(() => ({}));
  const token = normalizeText(data?.Token?.Id);
  const expireTime = Number(data?.Token?.ExpireTime || 0);

  if (!response.ok || !token || !expireTime) {
    console.error('Aliyun token request failed', {
      status: response.status,
      message: data?.Message,
      code: data?.Code
    });

    const error = new Error('Aliyun token request failed.');
    error.code = 'ASR_REQUEST_FAILED';
    error.status = 502;
    throw error;
  }

  aliyunTokenCache.token = token;
  aliyunTokenCache.expireTime = expireTime;
  return token;
}

function canonicalizeAliyunParameters(parameters) {
  return Object.keys(parameters)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(parameters[key])}`)
    .join('&');
}

function percentEncode(value) {
  return encodeURIComponent(String(value))
    .replace(/\+/g, '%20')
    .replace(/\*/g, '%2A')
    .replace(/%7E/g, '~');
}
