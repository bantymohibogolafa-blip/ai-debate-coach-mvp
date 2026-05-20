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
    await joinTeam(memberPayload);
    const teams = await fetchJoinedTeams(memberPayload.localUserId);

    res.json({
      teams
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/team/create', async (req, res, next) => {
  try {
    const teamPayload = validateTeamCreatePayload(req.body);
    await createTeam(teamPayload);
    const teams = await fetchJoinedTeams(teamPayload.localUserId);

    res.status(201).json({ teams });
  } catch (error) {
    next(error);
  }
});

app.get('/api/teams/my', async (req, res, next) => {
  try {
    const localUserId = normalizeText(req.query.localUserId || req.query.userId);

    if (!isValidLocalUserId(localUserId)) {
      return res.status(400).json({ message: '用户身份无效，请刷新页面后重试。' });
    }

    const teams = await fetchJoinedTeams(localUserId);
    res.json({ teams });
  } catch (error) {
    next(error);
  }
});

app.post('/api/team/leave', async (req, res, next) => {
  try {
    const { teamCode, localUserId } = validateLeaveTeamPayload(req.body);
    await leaveTeam({ teamCode, localUserId });
    const teams = await fetchJoinedTeams(localUserId);
    res.json({ teams });
  } catch (error) {
    next(error);
  }
});

app.get('/api/training-records', async (req, res, next) => {
  try {
    const userId = normalizeText(req.query.userId || req.query.localUserId);
    const spaceType = normalizeSpaceType(req.query.spaceType || req.query.scope);
    const limit = clampNumber(Number(req.query.limit || 20), 1, 50);
    const localUserId = normalizeLegacyOrLocalUserId(userId);

    if (!isValidLocalUserId(localUserId)) {
      return res.status(400).json({ message: '匿名用户 ID 无效，请刷新页面后重试。' });
    }

    const records = spaceType === 'personal'
      ? await fetchPersonalTrainingRecords(localUserId, limit)
      : await fetchLegacyTrainingRecords(localUserId, limit);
    res.json({ records: records.map(mapTrainingRecordFromDb) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/training-records', async (req, res, next) => {
  try {
    const record = await validateTrainingRecordPayload(req.body);
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
    const spaceType = normalizeSpaceType(req.query.spaceType || req.query.scope);

    if (!isValidLocalUserId(localUserId)) {
      return res.status(400).json({ message: '用户身份无效，请刷新页面后重试。' });
    }

    if (spaceType === 'personal') {
      const records = await fetchPersonalTrainingRecords(localUserId, 50);
      return res.json({ records: records.map(mapTrainingRecordFromDb) });
    }

    if (!isValidTeamCode(teamCode)) {
      return res.status(400).json({ message: '团队信息无效，请重新加入团队。' });
    }

    await requireActiveMembership(teamCode, localUserId);
    const records = await fetchMyTrainingRecords(teamCode, localUserId, 50);
    res.json({ records: records.map(mapTrainingRecordFromDb) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/training-records/team', async (req, res, next) => {
  try {
    const teamCode = normalizeTeamCode(req.query.teamCode);
    const localUserId = normalizeText(req.query.localUserId);

    if (!isValidTeamCode(teamCode) || !isValidLocalUserId(localUserId)) {
      return res.status(400).json({ message: '团队码无效，请重新加入团队。' });
    }

    await requireActiveMembership(teamCode, localUserId);
    const records = await fetchTeamTrainingRecords(teamCode, 50);
    res.json({ records: records.map(mapTrainingRecordFromDb) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/team/stats', async (req, res, next) => {
  try {
    const teamCode = normalizeTeamCode(req.query.teamCode);
    const localUserId = normalizeText(req.query.localUserId);

    if (!isValidTeamCode(teamCode) || !isValidLocalUserId(localUserId)) {
      return res.status(400).json({ message: '团队码无效，请重新加入团队。' });
    }

    await requireActiveMembership(teamCode, localUserId);
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

async function validateTrainingRecordPayload(body) {
  const teamCode = normalizeTeamCode(body.teamCode || body.team_code);
  const localUserId = normalizeText(body.localUserId || body.local_user_id || body.userId || body.user_id);
  const nickname = normalizeNickname(body.nickname);
  const spaceType = normalizeSpaceType(body.spaceType || body.space_type || body.recordScope || body.scope);
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

  let normalizedTeamCode = null;
  let normalizedNickname = '个人用户';

  if (spaceType === 'team') {
    normalizedTeamCode = teamCode;
    if (!isValidTeamCode(normalizedTeamCode)) {
      throw badRequest('团队身份信息无效，请重新加入团队。');
    }

    const activeMember = await requireActiveMembership(normalizedTeamCode, localUserId);
    normalizedNickname = normalizeNickname(activeMember.nickname || nickname);
  }

  if (!isValidNickname(normalizedNickname)) {
    throw badRequest('昵称无效，请重新加入团队。');
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
    space_type: spaceType,
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
  const teamPassword = normalizeText(body.teamPassword || body.team_password);
  const nickname = normalizeNickname(body.nickname);
  const localUserId = normalizeText(body.localUserId || body.local_user_id);

  if (!isValidTeamCode(teamCode)) {
    throw badRequest('请输入 3-32 位团队码，只能包含字母、数字、短横线或下划线。');
  }

  if (!teamPassword) {
    throw badRequest('请输入团队密码。');
  }

  if (!isValidNickname(nickname)) {
    throw badRequest('请输入 1-20 个字符的昵称。');
  }

  if (!isValidLocalUserId(localUserId)) {
    throw badRequest('用户身份无效，请刷新页面后重试。');
  }

  return { teamCode, teamPassword, nickname, localUserId };
}

function validateTeamCreatePayload(body) {
  const teamCode = normalizeTeamCode(body.teamCode || body.team_code);
  const teamName = normalizeTeamName(body.teamName || body.team_name || teamCode);
  const teamPassword = normalizeText(body.teamPassword || body.team_password);
  const nickname = normalizeNickname(body.nickname);
  const localUserId = normalizeText(body.localUserId || body.local_user_id);

  if (!isValidTeamCode(teamCode)) {
    throw badRequest('请输入 3-32 位团队码，只能包含字母、数字、短横线或下划线。');
  }

  if (!teamName || teamName.length > 32 || /[<>]/.test(teamName)) {
    throw badRequest('请输入 1-32 个字符的团队名称。');
  }

  if (!teamPassword || teamPassword.length < 4 || teamPassword.length > 64) {
    throw badRequest('请输入 4-64 位团队密码。');
  }

  if (!isValidNickname(nickname)) {
    throw badRequest('请输入 1-20 个字符的昵称。');
  }

  if (!isValidLocalUserId(localUserId)) {
    throw badRequest('用户身份无效，请刷新页面后重试。');
  }

  return { teamCode, teamName, teamPassword, nickname, localUserId };
}

function validateLeaveTeamPayload(body) {
  const teamCode = normalizeTeamCode(body.teamCode || body.team_code);
  const localUserId = normalizeText(body.localUserId || body.local_user_id);

  if (!isValidTeamCode(teamCode)) {
    throw badRequest('团队码无效，请重新选择团队。');
  }

  if (!isValidLocalUserId(localUserId)) {
    throw badRequest('用户身份无效，请刷新页面后重试。');
  }

  return { teamCode, localUserId };
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

function normalizeTeamName(value) {
  return normalizeText(value).replace(/\s+/g, ' ');
}

function badRequest(message) {
  return httpError(400, message);
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function getPublicStatus(error) {
  if ([400, 401, 403, 404, 409, 429].includes(error.status)) {
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
    const detailText = `${error.supabaseMessage || ''} ${error.supabaseDetails || ''}`;
    if (/space_type|status|joined_at|join_password|schema cache|column/i.test(detailText)) {
      return '数据库表结构尚未更新，请先在 Supabase 执行 supabase-team-spaces.sql。';
    }
    return '历史记录保存或读取失败，请稍后重试。';
  }

  if ([400, 401, 403, 404, 409].includes(error.status) && error.message) {
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

function normalizeSpaceType(value) {
  return normalizeText(value) === 'team' ? 'team' : 'personal';
}

function getPersonalTeamCode(localUserId) {
  const match = /^user_([0-9a-f]{8})-/i.exec(localUserId);
  return `PERSONAL_${(match?.[1] || 'LOCAL').toUpperCase()}`;
}

function isSupabaseSchemaError(error) {
  return error?.code === 'SUPABASE_REQUEST_FAILED' && error.status === 400;
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

async function joinTeam({ teamCode, teamPassword, nickname, localUserId }) {
  const team = await getSingleByQuery(
    teamsTable,
    new URLSearchParams({
      select: 'id,team_code,team_name,join_password_hash,join_password,created_at',
      team_code: `eq.${teamCode}`,
      limit: '1'
    })
  );

  if (!team) {
    throw httpError(404, '团队不存在，请确认团队码。');
  }

  if (!verifyTeamPassword(team, teamPassword)) {
    throw httpError(401, '团队密码错误，请重新输入。');
  }

  let member = await getSingleByQuery(
    teamMembersTable,
    new URLSearchParams({
      select: 'id,team_code,local_user_id,nickname,role,status,joined_at,left_at,created_at,last_seen_at',
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
        role: 'member',
        status: 'active',
        joined_at: new Date().toISOString(),
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
          status: 'active',
          left_at: null,
          last_seen_at: new Date().toISOString()
        },
        prefer: 'return=representation'
      }
    );
    member = updatedMembers[0] || member;
  }

  return { team, member };
}

async function createTeam({ teamCode, teamName, teamPassword, nickname, localUserId }) {
  const existingTeam = await getSingleByQuery(
    teamsTable,
    new URLSearchParams({
      select: 'team_code',
      team_code: `eq.${teamCode}`,
      limit: '1'
    })
  );

  if (existingTeam) {
    throw httpError(409, '团队码已被占用，请换一个团队码。');
  }

  await supabaseRequest(teamsTable, {
    method: 'POST',
    body: {
      team_code: teamCode,
      team_name: teamName,
      join_password: teamPassword,
      created_at: new Date().toISOString()
    },
    prefer: 'return=representation'
  });

  await supabaseRequest(teamMembersTable, {
    method: 'POST',
    body: {
      team_code: teamCode,
      local_user_id: localUserId,
      nickname,
      role: 'owner',
      status: 'active',
      joined_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString()
    },
    prefer: 'return=representation'
  });
}

async function leaveTeam({ teamCode, localUserId }) {
  await requireActiveMembership(teamCode, localUserId);
  await supabaseRequest(
    `${teamMembersTable}?team_code=eq.${encodeURIComponent(teamCode)}&local_user_id=eq.${encodeURIComponent(localUserId)}`,
    {
      method: 'PATCH',
      body: {
        status: 'left',
        left_at: new Date().toISOString()
      },
      prefer: 'return=representation'
    }
  );
}

async function requireActiveMembership(teamCode, localUserId) {
  let member = null;

  try {
    member = await getSingleByQuery(
      teamMembersTable,
      new URLSearchParams({
        select: 'id,team_code,local_user_id,nickname,role,status,joined_at,left_at',
        team_code: `eq.${teamCode}`,
        local_user_id: `eq.${localUserId}`,
        status: 'eq.active',
        limit: '1'
      })
    );
  } catch (error) {
    if (!isSupabaseSchemaError(error)) throw error;
    member = await getSingleByQuery(
      teamMembersTable,
      new URLSearchParams({
        select: 'id,team_code,local_user_id,nickname,created_at,last_seen_at',
        team_code: `eq.${teamCode}`,
        local_user_id: `eq.${localUserId}`,
        limit: '1'
      })
    );
  }

  if (!member) {
    throw httpError(403, '你不是该团队的有效成员，不能查看或保存团队数据。');
  }

  return member;
}

async function fetchJoinedTeams(localUserId) {
  let members = [];

  try {
    members = await supabaseRequest(
      `${teamMembersTable}?${new URLSearchParams({
        select: 'id,team_code,local_user_id,nickname,role,status,joined_at,left_at,created_at,last_seen_at',
        local_user_id: `eq.${localUserId}`,
        status: 'eq.active',
        order: 'joined_at.desc'
      }).toString()}`
    );
  } catch (error) {
    if (!isSupabaseSchemaError(error)) throw error;
    members = await supabaseRequest(
      `${teamMembersTable}?${new URLSearchParams({
        select: 'id,team_code,local_user_id,nickname,created_at,last_seen_at',
        local_user_id: `eq.${localUserId}`,
        order: 'created_at.desc'
      }).toString()}`
    );
  }

  const teams = await Promise.all(
    members.map(async (member) => {
      const team = await getSingleByQuery(
        teamsTable,
        new URLSearchParams({
          select: 'id,team_code,team_name,created_at',
          team_code: `eq.${member.team_code}`,
          limit: '1'
        })
      );

      return mapJoinedTeamFromDb(member, team);
    })
  );

  return teams.filter(Boolean);
}

function verifyTeamPassword(team, password) {
  if (team.join_password_hash) {
    return verifyScryptPassword(password, team.join_password_hash);
  }

  if (team.join_password) {
    return safeTextEqual(password, team.join_password);
  }

  return false;
}

function verifyScryptPassword(password, storedHash) {
  const [scheme, salt, expectedHash] = String(storedHash || '').split('$');
  if (scheme !== 'scrypt' || !salt || !expectedHash) return false;

  const actualHash = crypto.scryptSync(password, salt, 64).toString('hex');
  return safeTextEqual(actualHash, expectedHash);
}

function safeTextEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

async function getSingleByQuery(tableName, query) {
  const rows = await supabaseRequest(`${tableName}?${query.toString()}`);
  return rows[0] || null;
}

async function fetchLegacyTrainingRecords(localUserId, limit) {
  const query = new URLSearchParams({
    select: 'id,space_type,team_code,local_user_id,nickname,topic,user_side,ai_side,difficulty,style_id,training_mode,messages,review,score,result,battlefield,created_at',
    local_user_id: `eq.${localUserId}`,
    order: 'created_at.desc',
    limit: String(limit)
  });

  try {
    return await supabaseRequest(`${trainingRecordsTable}?${query.toString()}`);
  } catch (error) {
    if (!isSupabaseSchemaError(error)) throw error;
    return fetchLegacyTrainingRecordsWithoutSpaceType(localUserId, limit);
  }
}

async function fetchPersonalTrainingRecords(localUserId, limit) {
  const query = new URLSearchParams({
    select: 'id,space_type,team_code,local_user_id,nickname,topic,user_side,ai_side,difficulty,style_id,training_mode,messages,review,score,result,battlefield,created_at',
    space_type: 'eq.personal',
    local_user_id: `eq.${localUserId}`,
    order: 'created_at.desc',
    limit: String(limit)
  });

  try {
    return await supabaseRequest(`${trainingRecordsTable}?${query.toString()}`);
  } catch (error) {
    if (!isSupabaseSchemaError(error)) throw error;
    return fetchLegacyPersonalTrainingRecords(localUserId, limit);
  }
}

async function fetchMyTrainingRecords(teamCode, localUserId, limit) {
  const query = new URLSearchParams({
    select: 'id,space_type,team_code,local_user_id,nickname,topic,user_side,ai_side,difficulty,style_id,training_mode,messages,review,score,result,battlefield,created_at',
    space_type: 'eq.team',
    team_code: `eq.${teamCode}`,
    local_user_id: `eq.${localUserId}`,
    order: 'created_at.desc',
    limit: String(limit)
  });

  try {
    return await supabaseRequest(`${trainingRecordsTable}?${query.toString()}`);
  } catch (error) {
    if (!isSupabaseSchemaError(error)) throw error;
    return fetchLegacyTeamMemberTrainingRecords(teamCode, localUserId, limit);
  }
}

async function fetchTeamTrainingRecords(teamCode, limit) {
  const query = new URLSearchParams({
    select: 'id,space_type,team_code,local_user_id,nickname,topic,user_side,ai_side,difficulty,style_id,training_mode,messages,review,score,result,battlefield,created_at',
    space_type: 'eq.team',
    team_code: `eq.${teamCode}`,
    order: 'created_at.desc',
    limit: String(limit)
  });

  try {
    return await supabaseRequest(`${trainingRecordsTable}?${query.toString()}`);
  } catch (error) {
    if (!isSupabaseSchemaError(error)) throw error;
    return fetchLegacyTeamTrainingRecords(teamCode, limit);
  }
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
    select: 'id,space_type,team_code,local_user_id,nickname,topic,user_side,ai_side,difficulty,style_id,training_mode,messages,review,score,result,battlefield,created_at',
    space_type: 'eq.team',
    team_code: `eq.${teamCode}`,
    order: 'created_at.desc',
    limit: '1000'
  });

  try {
    return await supabaseRequest(`${trainingRecordsTable}?${query.toString()}`);
  } catch (error) {
    if (!isSupabaseSchemaError(error)) throw error;
    return fetchLegacyTeamTrainingRecords(teamCode, 1000);
  }
}

async function fetchLegacyTrainingRecordsWithoutSpaceType(localUserId, limit) {
  const query = new URLSearchParams({
    select: 'id,team_code,local_user_id,nickname,topic,user_side,ai_side,difficulty,style_id,training_mode,messages,review,score,result,battlefield,created_at',
    local_user_id: `eq.${localUserId}`,
    order: 'created_at.desc',
    limit: String(limit)
  });

  return supabaseRequest(`${trainingRecordsTable}?${query.toString()}`);
}

async function fetchLegacyPersonalTrainingRecords(localUserId, limit) {
  const query = new URLSearchParams({
    select: 'id,team_code,local_user_id,nickname,topic,user_side,ai_side,difficulty,style_id,training_mode,messages,review,score,result,battlefield,created_at',
    team_code: `eq.${getPersonalTeamCode(localUserId)}`,
    local_user_id: `eq.${localUserId}`,
    order: 'created_at.desc',
    limit: String(limit)
  });

  return supabaseRequest(`${trainingRecordsTable}?${query.toString()}`);
}

async function fetchLegacyTeamMemberTrainingRecords(teamCode, localUserId, limit) {
  const query = new URLSearchParams({
    select: 'id,team_code,local_user_id,nickname,topic,user_side,ai_side,difficulty,style_id,training_mode,messages,review,score,result,battlefield,created_at',
    team_code: `eq.${teamCode}`,
    local_user_id: `eq.${localUserId}`,
    order: 'created_at.desc',
    limit: String(limit)
  });

  return supabaseRequest(`${trainingRecordsTable}?${query.toString()}`);
}

async function fetchLegacyTeamTrainingRecords(teamCode, limit) {
  const query = new URLSearchParams({
    select: 'id,team_code,local_user_id,nickname,topic,user_side,ai_side,difficulty,style_id,training_mode,messages,review,score,result,battlefield,created_at',
    team_code: `eq.${teamCode}`,
    order: 'created_at.desc',
    limit: String(limit)
  });

  return supabaseRequest(`${trainingRecordsTable}?${query.toString()}`);
}

async function insertTrainingRecord(record) {
  try {
    return await supabaseRequest(trainingRecordsTable, {
      method: 'POST',
      body: record,
      prefer: 'return=representation'
    });
  } catch (error) {
    if (!isSupabaseSchemaError(error)) throw error;

    const legacyRecord = { ...record };
    delete legacyRecord.space_type;
    if (record.space_type === 'personal') {
      legacyRecord.team_code = getPersonalTeamCode(record.local_user_id);
      await ensureLegacyPersonalTeam(legacyRecord.team_code);
    }

    return supabaseRequest(trainingRecordsTable, {
      method: 'POST',
      body: legacyRecord,
      prefer: 'return=representation'
    });
  }
}

async function ensureLegacyPersonalTeam(teamCode) {
  const existingTeam = await getSingleByQuery(
    teamsTable,
    new URLSearchParams({
      select: 'team_code',
      team_code: `eq.${teamCode}`,
      limit: '1'
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
    error.supabaseMessage = data?.message || '';
    error.supabaseDetails = data?.details || '';
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

function mapTrainingRecordFromDb(record = {}) {
  return {
    id: record.id,
    spaceType: record.space_type || (record.team_code ? 'team' : 'personal'),
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
    id: team.id,
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
    role: member.role || 'member',
    status: member.status || 'active',
    joinedAt: member.joined_at || member.created_at,
    leftAt: member.left_at,
    createdAt: member.created_at,
    lastSeenAt: member.last_seen_at
  };
}

function mapJoinedTeamFromDb(member = {}, team = {}) {
  if (!member?.team_code) return null;

  return {
    teamCode: member.team_code,
    teamName: team?.team_name || member.team_code,
    nickname: member.nickname,
    role: member.role || 'member',
    joinedAt: member.joined_at || member.created_at
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
