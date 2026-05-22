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
const teamTasksTable = process.env.SUPABASE_TEAM_TASKS_TABLE || 'team_tasks';
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

app.get('/api/team/members', async (req, res, next) => {
  try {
    const teamCode = normalizeTeamCode(req.query.teamCode);
    const localUserId = normalizeText(req.query.localUserId);

    if (!isValidTeamCode(teamCode) || !isValidLocalUserId(localUserId)) {
      return res.status(400).json({ message: '团队或用户身份无效，请刷新后重试。' });
    }

    const requester = await requireActiveMembership(teamCode, localUserId);
    const members = await fetchTeamMembers(teamCode);
    res.json({
      requester: mapTeamMemberFromDb(requester),
      members: members.map(mapTeamMemberFromDb)
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/team/member/remove', async (req, res, next) => {
  try {
    const payload = validateTeamMemberActionPayload(req.body);
    await removeTeamMember(payload);
    const members = await fetchTeamMembers(payload.teamCode);
    res.json({ members: members.map(mapTeamMemberFromDb) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/team/transfer-owner', async (req, res, next) => {
  try {
    const payload = validateTeamMemberActionPayload(req.body);
    await transferTeamOwner(payload);
    const [members, teams] = await Promise.all([
      fetchTeamMembers(payload.teamCode),
      fetchJoinedTeams(payload.localUserId)
    ]);

    res.json({
      teams,
      members: members.map(mapTeamMemberFromDb)
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/team/update-name', async (req, res, next) => {
  try {
    const payload = validateTeamUpdateNamePayload(req.body);
    await updateTeamName(payload);
    const teams = await fetchJoinedTeams(payload.localUserId);
    res.json({ teams });
  } catch (error) {
    next(error);
  }
});

app.post('/api/team/update-password', async (req, res, next) => {
  try {
    const payload = validateTeamUpdatePasswordPayload(req.body);
    await updateTeamPassword(payload);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.post('/api/team/tasks/create', async (req, res, next) => {
  try {
    const payload = validateTeamTaskPayload(req.body);
    const task = await createTeamTask(payload);
    res.status(201).json({ task: mapTeamTaskFromDb(task) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/team/tasks', async (req, res, next) => {
  try {
    const { teamCode, localUserId } = validateTeamTaskQuery(req.query);
    await requireActiveMembership(teamCode, localUserId);
    const tasks = await fetchTeamTasksWithProgress(teamCode, localUserId);
    res.json({ tasks });
  } catch (error) {
    next(error);
  }
});

app.get('/api/team/tasks/detail', async (req, res, next) => {
  try {
    const { taskId, teamCode, localUserId } = validateTeamTaskDetailQuery(req.query);
    await requireActiveMembership(teamCode, localUserId);
    const task = await requireTeamTask(taskId, teamCode);
    const stats = await fetchTeamTaskStats(task, localUserId);
    res.json({
      task: mapTeamTaskFromDb(task),
      completedCount: stats.currentUserCompletedCount,
      memberProgress: stats.memberProgress
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/team/tasks/stats', async (req, res, next) => {
  try {
    const { taskId, teamCode, localUserId } = validateTeamTaskDetailQuery(req.query);
    await requireActiveMembership(teamCode, localUserId);
    const task = await requireTeamTask(taskId, teamCode);
    const stats = await fetchTeamTaskStats(task, localUserId);
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

app.post('/api/team/tasks/close', async (req, res, next) => {
  try {
    const payload = validateTeamTaskClosePayload(req.body);
    const task = await closeTeamTask(payload);
    res.json({ task: mapTeamTaskFromDb(task) });
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

app.get('/api/ability/estimate', async (req, res, next) => {
  try {
    const { spaceType, teamCode, localUserId } = validateAbilityEstimateQuery(req.query);
    let records = [];

    if (spaceType === 'team') {
      await requireActiveMembership(teamCode, localUserId);
      records = await fetchMyTrainingRecords(teamCode, localUserId, 120);
    } else {
      records = await fetchPersonalTrainingRecords(localUserId, 120);
    }

    res.json(buildAbilityEstimate(records));
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
  const defensePrep = normalizeText(body.defensePrep || body.defense_prep || '');
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

  if (trainingMode === 'defense' && !defensePrep) {
    throw badRequest('请先填写己方分论点和论据。');
  }

  return {
    topic,
    userSide,
    difficulty,
    celebrityDebater,
    trainingMode,
    rounds,
    defensePrep,
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
  const taskId = normalizeText(body.taskId || body.task_id);
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

    if (taskId) {
      if (!isUuid(taskId)) {
        throw badRequest('任务信息无效，请从任务入口重新开始训练。');
      }
      const task = await requireTeamTask(taskId, normalizedTeamCode);
      if (task.status !== 'active') {
        throw httpError(403, '该训练任务已关闭，不能继续提交任务记录。');
      }
    }
  } else if (taskId) {
    throw badRequest('个人模式记录不能绑定团队任务。');
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

  const record = {
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

  if (taskId) {
    record.task_id = taskId;
  }

  return record;
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

function validateTeamMemberActionPayload(body) {
  const teamCode = normalizeTeamCode(body.teamCode || body.team_code);
  const localUserId = normalizeText(body.localUserId || body.local_user_id);
  const targetLocalUserId = normalizeText(body.targetLocalUserId || body.target_local_user_id);

  if (!isValidTeamCode(teamCode)) {
    throw badRequest('团队码无效，请重新选择团队。');
  }

  if (!isValidLocalUserId(localUserId)) {
    throw badRequest('用户身份无效，请刷新页面后重试。');
  }

  if (!isValidLocalUserId(targetLocalUserId)) {
    throw badRequest('目标成员身份无效，请刷新成员列表后重试。');
  }

  return { teamCode, localUserId, targetLocalUserId };
}

function validateTeamUpdateNamePayload(body) {
  const teamCode = normalizeTeamCode(body.teamCode || body.team_code);
  const localUserId = normalizeText(body.localUserId || body.local_user_id);
  const teamName = normalizeTeamName(body.teamName || body.team_name);

  if (!isValidTeamCode(teamCode)) {
    throw badRequest('团队码无效，请重新选择团队。');
  }

  if (!isValidLocalUserId(localUserId)) {
    throw badRequest('用户身份无效，请刷新页面后重试。');
  }

  if (!teamName || teamName.length > 32 || /[<>]/.test(teamName)) {
    throw badRequest('请输入 1-32 个字符的团队名称。');
  }

  return { teamCode, localUserId, teamName };
}

function validateTeamUpdatePasswordPayload(body) {
  const teamCode = normalizeTeamCode(body.teamCode || body.team_code);
  const localUserId = normalizeText(body.localUserId || body.local_user_id);
  const currentPassword = normalizeText(body.currentPassword || body.current_password);
  const nextPassword = normalizeText(body.nextPassword || body.next_password || body.teamPassword || body.team_password);

  if (!isValidTeamCode(teamCode)) {
    throw badRequest('团队码无效，请重新选择团队。');
  }

  if (!isValidLocalUserId(localUserId)) {
    throw badRequest('用户身份无效，请刷新页面后重试。');
  }

  if (!currentPassword) {
    throw badRequest('请输入当前团队密码。');
  }

  if (!nextPassword || nextPassword.length < 4 || nextPassword.length > 64) {
    throw badRequest('请输入 4-64 位新团队密码。');
  }

  if (currentPassword === nextPassword) {
    throw badRequest('新密码不能与当前密码相同。');
  }

  return { teamCode, localUserId, currentPassword, nextPassword };
}

function validateTeamTaskPayload(body) {
  const teamCode = normalizeTeamCode(body.teamCode || body.team_code);
  const localUserId = normalizeText(body.localUserId || body.local_user_id);
  const title = normalizeText(body.title);
  const topic = normalizeText(body.topic);
  const userSide = normalizeOptionalSide(body.userSide || body.user_side);
  const mode = normalizeTrainingMode(normalizeText(body.mode || body.trainingMode || body.training_mode));
  const difficulty = normalizeDifficulty(normalizeText(body.difficulty));
  const styleId = normalizeCelebrityDebater(normalizeText(body.styleId || body.style_id || 'none'));
  const requiredCount = clampNumber(Number(body.requiredCount || body.required_count || 1), 1, 20);
  const deadline = normalizeOptionalDate(body.deadline);
  const description = limitLength(normalizeText(body.description), 500);

  if (!isValidTeamCode(teamCode)) {
    throw badRequest('团队码无效，请重新选择团队。');
  }

  if (!isValidLocalUserId(localUserId)) {
    throw badRequest('用户身份无效，请刷新页面后重试。');
  }

  if (!title || title.length > 80 || /[<>]/.test(title)) {
    throw badRequest('请输入 1-80 个字符的任务名称。');
  }

  if (!topic || topic.length > 300 || /[<>]/.test(topic)) {
    throw badRequest('请输入 1-300 个字符的辩题。');
  }

  if (userSide && !isValidSide(userSide)) {
    throw badRequest('请选择有效的用户立场。');
  }

  if (!isValidTrainingMode(mode)) {
    throw badRequest('请选择有效的训练模式。');
  }

  if (!isValidDifficulty(difficulty)) {
    throw badRequest('请选择有效难度。');
  }

  if (!isValidCelebrityDebater(styleId)) {
    throw badRequest('请选择有效 AI 风格。');
  }

  return {
    teamCode,
    localUserId,
    title,
    topic,
    userSide: userSide || null,
    mode,
    difficulty,
    styleId,
    requiredCount,
    deadline,
    description
  };
}

function validateTeamTaskQuery(query) {
  const teamCode = normalizeTeamCode(query.teamCode || query.team_code);
  const localUserId = normalizeText(query.localUserId || query.local_user_id);

  if (!isValidTeamCode(teamCode) || !isValidLocalUserId(localUserId)) {
    throw badRequest('团队或用户身份无效，请刷新后重试。');
  }

  return { teamCode, localUserId };
}

function validateTeamTaskDetailQuery(query) {
  const taskId = normalizeText(query.taskId || query.task_id);
  const base = validateTeamTaskQuery(query);

  if (!isUuid(taskId)) {
    throw badRequest('任务信息无效，请刷新任务列表后重试。');
  }

  return { ...base, taskId };
}

function validateTeamTaskClosePayload(body) {
  const taskId = normalizeText(body.taskId || body.task_id);
  const teamCode = normalizeTeamCode(body.teamCode || body.team_code);
  const localUserId = normalizeText(body.localUserId || body.local_user_id);

  if (!isUuid(taskId)) {
    throw badRequest('任务信息无效，请刷新任务列表后重试。');
  }

  if (!isValidTeamCode(teamCode) || !isValidLocalUserId(localUserId)) {
    throw badRequest('团队或用户身份无效，请刷新后重试。');
  }

  return { taskId, teamCode, localUserId };
}

function validateAbilityEstimateQuery(query) {
  const spaceType = normalizeSpaceType(query.spaceType || query.space_type || query.scope);
  const teamCode = normalizeTeamCode(query.teamCode || query.team_code);
  const localUserId = normalizeText(query.localUserId || query.local_user_id || query.userId || query.user_id);

  if (!isValidLocalUserId(localUserId)) {
    throw badRequest('用户身份无效，请刷新页面后重试。');
  }

  if (spaceType === 'team' && !isValidTeamCode(teamCode)) {
    throw badRequest('团队信息无效，请重新选择团队。');
  }

  return { spaceType, teamCode, localUserId };
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

function normalizeOptionalSide(value) {
  const text = normalizeText(value);
  if (!text) return '';
  return normalizeSide(text);
}

function normalizeOptionalDate(value) {
  const text = normalizeText(value);
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    throw badRequest('截止时间格式无效。');
  }
  return date.toISOString();
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
    if (/space_type|status|joined_at|join_password|team_tasks|task_id|schema cache|column/i.test(detailText)) {
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

function isUuid(value) {
  return isValidLegacyUserId(value);
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

function isMissingRpcError(error) {
  const detailText = `${error?.supabaseMessage || ''} ${error?.supabaseDetails || ''}`;
  return error?.code === 'SUPABASE_REQUEST_FAILED'
    && [400, 404].includes(error.status)
    && /transfer_team_owner|function|schema cache|rpc/i.test(detailText);
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
      join_password_hash: hashTeamPassword(teamPassword),
      join_password: null,
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
  const member = await requireActiveMembership(teamCode, localUserId);
  if ((member.role || 'member') === 'owner') {
    const activeMembers = await fetchTeamMembers(teamCode);
    if (activeMembers.some((item) => item.local_user_id !== localUserId)) {
      throw badRequest('队长退出团队前，请先把队长权限转让给其他成员。');
    }
  }

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

async function fetchTeamMembers(teamCode) {
  let members = [];

  try {
    members = await supabaseRequest(
      `${teamMembersTable}?${new URLSearchParams({
        select: 'id,team_code,local_user_id,nickname,role,status,joined_at,left_at,created_at,last_seen_at',
        team_code: `eq.${teamCode}`,
        status: 'eq.active',
        order: 'joined_at.asc'
      }).toString()}`
    );
  } catch (error) {
    if (!isSupabaseSchemaError(error)) throw error;
    members = await supabaseRequest(
      `${teamMembersTable}?${new URLSearchParams({
        select: 'id,team_code,local_user_id,nickname,created_at,last_seen_at',
        team_code: `eq.${teamCode}`,
        order: 'created_at.asc'
      }).toString()}`
    );
  }

  return members;
}

async function requireTeamOwner(teamCode, localUserId) {
  const member = await requireActiveMembership(teamCode, localUserId);

  if (!isTeamOwnerRole(member.role)) {
    throw httpError(403, '只有队长可以管理团队成员。');
  }

  return member;
}

function isTeamOwnerRole(role) {
  return ['owner', 'captain'].includes(role || 'member');
}

async function removeTeamMember({ teamCode, localUserId, targetLocalUserId }) {
  await requireTeamOwner(teamCode, localUserId);

  if (localUserId === targetLocalUserId) {
    throw badRequest('不能在成员管理中移出自己，请使用退出团队。');
  }

  const targetMember = await requireActiveMembership(teamCode, targetLocalUserId);
  if ((targetMember.role || 'member') === 'owner') {
    throw badRequest('不能移出队长，请先转让队长权限。');
  }

  await supabaseRequest(
    `${teamMembersTable}?team_code=eq.${encodeURIComponent(teamCode)}&local_user_id=eq.${encodeURIComponent(targetLocalUserId)}`,
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

async function transferTeamOwner({ teamCode, localUserId, targetLocalUserId }) {
  await requireTeamOwner(teamCode, localUserId);
  const targetMember = await requireActiveMembership(teamCode, targetLocalUserId);

  if (localUserId === targetLocalUserId || (targetMember.role || 'member') === 'owner') {
    return;
  }

  try {
    await supabaseRequest('rpc/transfer_team_owner', {
      method: 'POST',
      body: {
        p_team_code: teamCode,
        p_current_owner_id: localUserId,
        p_new_owner_id: targetLocalUserId
      }
    });
    return;
  } catch (error) {
    if (!isMissingRpcError(error)) throw error;
  }

  await supabaseRequest(
    `${teamMembersTable}?team_code=eq.${encodeURIComponent(teamCode)}&local_user_id=eq.${encodeURIComponent(localUserId)}`,
    {
      method: 'PATCH',
      body: {
        role: 'member',
        status: 'active'
      },
      prefer: 'return=representation'
    }
  );

  try {
    await supabaseRequest(
      `${teamMembersTable}?team_code=eq.${encodeURIComponent(teamCode)}&local_user_id=eq.${encodeURIComponent(targetLocalUserId)}`,
      {
        method: 'PATCH',
        body: {
          role: 'owner',
          status: 'active',
          left_at: null
        },
        prefer: 'return=representation'
      }
    );
  } catch (error) {
    await supabaseRequest(
      `${teamMembersTable}?team_code=eq.${encodeURIComponent(teamCode)}&local_user_id=eq.${encodeURIComponent(localUserId)}`,
      {
        method: 'PATCH',
        body: {
          role: 'owner',
          status: 'active'
        },
        prefer: 'return=representation'
      }
    );
    throw error;
  }
}

async function updateTeamName({ teamCode, localUserId, teamName }) {
  await requireTeamOwner(teamCode, localUserId);
  await supabaseRequest(
    `${teamsTable}?team_code=eq.${encodeURIComponent(teamCode)}`,
    {
      method: 'PATCH',
      body: {
        team_name: teamName
      },
      prefer: 'return=representation'
    }
  );
}

async function updateTeamPassword({ teamCode, localUserId, currentPassword, nextPassword }) {
  await requireTeamOwner(teamCode, localUserId);
  const team = await getSingleByQuery(
    teamsTable,
    new URLSearchParams({
      select: 'id,team_code,join_password_hash,join_password',
      team_code: `eq.${teamCode}`,
      limit: '1'
    })
  );

  if (!team) {
    throw httpError(404, '团队不存在，请刷新后重试。');
  }

  if (!verifyTeamPassword(team, currentPassword)) {
    throw httpError(401, '当前团队密码错误。');
  }

  await supabaseRequest(
    `${teamsTable}?team_code=eq.${encodeURIComponent(teamCode)}`,
    {
      method: 'PATCH',
      body: {
        join_password_hash: hashTeamPassword(nextPassword),
        join_password: null
      },
      prefer: 'return=representation'
    }
  );
}

async function createTeamTask(payload) {
  await requireTeamOwner(payload.teamCode, payload.localUserId);
  const createdTasks = await supabaseRequest(teamTasksTable, {
    method: 'POST',
    body: {
      team_code: payload.teamCode,
      title: payload.title,
      topic: payload.topic,
      user_side: payload.userSide,
      mode: payload.mode,
      difficulty: payload.difficulty,
      style_id: payload.styleId,
      required_count: payload.requiredCount,
      deadline: payload.deadline,
      description: payload.description,
      created_by: payload.localUserId,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    prefer: 'return=representation'
  });

  return createdTasks[0];
}

async function fetchTeamTasksWithProgress(teamCode, localUserId) {
  const tasks = await supabaseRequest(
    `${teamTasksTable}?${new URLSearchParams({
      select: 'id,team_code,title,topic,user_side,mode,difficulty,style_id,required_count,deadline,description,created_by,status,created_at,updated_at',
      team_code: `eq.${teamCode}`,
      status: 'eq.active',
      order: 'created_at.desc'
    }).toString()}`
  );

  return Promise.all(tasks.map(async (task) => {
    const completedCount = await fetchTaskCompletedCount(task.id, teamCode, localUserId);
    return {
      ...mapTeamTaskFromDb(task),
      completedCount,
      requiredCount: task.required_count || 1
    };
  }));
}

async function requireTeamTask(taskId, teamCode) {
  const task = await getSingleByQuery(
    teamTasksTable,
    new URLSearchParams({
      select: 'id,team_code,title,topic,user_side,mode,difficulty,style_id,required_count,deadline,description,created_by,status,created_at,updated_at',
      id: `eq.${taskId}`,
      team_code: `eq.${teamCode}`,
      limit: '1'
    })
  );

  if (!task) {
    throw httpError(404, '任务不存在或不属于当前团队。');
  }

  return task;
}

async function closeTeamTask({ taskId, teamCode, localUserId }) {
  await requireTeamOwner(teamCode, localUserId);
  await requireTeamTask(taskId, teamCode);
  const updatedTasks = await supabaseRequest(
    `${teamTasksTable}?id=eq.${encodeURIComponent(taskId)}&team_code=eq.${encodeURIComponent(teamCode)}`,
    {
      method: 'PATCH',
      body: {
        status: 'closed',
        updated_at: new Date().toISOString()
      },
      prefer: 'return=representation'
    }
  );

  return updatedTasks[0];
}

async function fetchTaskCompletedCount(taskId, teamCode, localUserId) {
  const records = await fetchTaskRecords(taskId, teamCode, {
    localUserId,
    limit: 1000
  });
  return records.length;
}

async function fetchTeamTaskStats(task, currentLocalUserId) {
  const [members, records] = await Promise.all([
    fetchTeamMembers(task.team_code),
    fetchTaskRecords(task.id, task.team_code, { limit: 1000 })
  ]);
  const requiredCount = task.required_count || 1;
  const recordsByMember = new Map();

  records.forEach((record) => {
    const key = record.local_user_id;
    if (!key) return;
    const current = recordsByMember.get(key) || [];
    current.push(record);
    recordsByMember.set(key, current);
  });

  const memberProgress = members.map((member) => {
    const memberRecords = recordsByMember.get(member.local_user_id) || [];
    const scoredRecords = memberRecords.filter((record) => Number.isFinite(Number(record.score)));
    const completedCount = memberRecords.length;
    return {
      nickname: member.nickname || '未命名成员',
      localUserId: member.local_user_id,
      completedCount,
      requiredCount,
      averageScore: scoredRecords.length
        ? roundToOne(scoredRecords.reduce((sum, record) => sum + Number(record.score), 0) / scoredRecords.length)
        : null,
      highestScore: scoredRecords.length
        ? Math.max(...scoredRecords.map((record) => Number(record.score)))
        : null,
      status: completedCount >= requiredCount ? 'completed' : 'incomplete'
    };
  });
  const scoredRecords = records.filter((record) => Number.isFinite(Number(record.score)));
  const completedMembers = memberProgress.filter((member) => member.status === 'completed').length;

  return {
    totalMembers: members.length,
    completedMembers,
    completionRate: members.length ? roundToOne((completedMembers / members.length) * 100) : 0,
    averageScore: scoredRecords.length
      ? roundToOne(scoredRecords.reduce((sum, record) => sum + Number(record.score), 0) / scoredRecords.length)
      : null,
    highestScore: scoredRecords.length
      ? Math.max(...scoredRecords.map((record) => Number(record.score)))
      : null,
    currentUserCompletedCount: (recordsByMember.get(currentLocalUserId) || []).length,
    memberProgress,
    recentRecords: records.slice(0, 10).map(mapTrainingRecordFromDb)
  };
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

function hashTeamPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
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

const abilityDimensions = [
  { key: 'caseBuilding', label: '立论建构', weight: 0.18 },
  { key: 'clash', label: '交锋识别', weight: 0.18 },
  { key: 'attack', label: '质询压迫', weight: 0.16 },
  { key: 'defense', label: '防守回应', weight: 0.16 },
  { key: 'closing', label: '结辩收束', weight: 0.16 },
  { key: 'expression', label: '表达稳定', weight: 0.16 }
];

const abilityModeWeights = {
  constructive: { caseBuilding: 0.75, expression: 0.25 },
  summary: { clash: 0.65, expression: 0.2, caseBuilding: 0.15 },
  free_debate: { clash: 0.35, attack: 0.25, defense: 0.2, expression: 0.2 },
  attack: { attack: 0.7, clash: 0.3 },
  defense: { defense: 0.75, clash: 0.25 },
  closing: { closing: 0.7, expression: 0.3 }
};

const abilityDifficultyBonus = {
  novice: -4,
  campus: 2,
  city: 7
};

function buildAbilityEstimate(records = []) {
  const scoredRecords = records
    .filter((record) => Number.isFinite(Number(record.score)))
    .sort((left, right) => new Date(left.created_at) - new Date(right.created_at));
  const history = scoredRecords.map((_, index) => {
    const snapshot = calculateAbilitySnapshot(scoredRecords.slice(0, index + 1));
    return {
      index: index + 1,
      date: scoredRecords[index].created_at,
      overall: snapshot.overall,
      overallEstimate: snapshot.overallEstimate,
      dimensions: snapshot.dimensionScores
    };
  });
  const current = calculateAbilitySnapshot(scoredRecords);
  const previous = history.length > 1 ? history[Math.max(0, history.length - 6)] : null;
  const dimensions = abilityDimensions.map((dimension) => {
    const score = current.dimensionScores[dimension.key];
    const previousScore = previous?.dimensions?.[dimension.key] ?? null;
    return {
      key: dimension.key,
      label: dimension.label,
      score,
      estimate: score === null ? null : toAbilityEstimate(score),
      confidence: current.dimensionConfidence[dimension.key] || 0,
      trend: score === null || previousScore === null ? 0 : roundToOne(score - previousScore),
      records: current.dimensionCounts[dimension.key] || 0
    };
  });

  return {
    model: 'Fengbian Ability Estimate v1',
    recordCount: records.length,
    scoredRecordCount: scoredRecords.length,
    confidence: current.confidence,
    overall: current.overall,
    overallEstimate: current.overallEstimate,
    level: getAbilityLevel(current.overallEstimate),
    trend: previous ? current.overallEstimate - previous.overallEstimate : 0,
    dimensions,
    history,
    note: '能力估测基于 AI 复盘分、训练模式、难度和近期权重实时计算；训练次数越多，置信度越高。'
  };
}

function calculateAbilitySnapshot(scoredRecords) {
  if (!scoredRecords.length) {
    return {
      overall: null,
      overallEstimate: null,
      confidence: 0,
      dimensionScores: Object.fromEntries(abilityDimensions.map((dimension) => [dimension.key, null])),
      dimensionConfidence: Object.fromEntries(abilityDimensions.map((dimension) => [dimension.key, 0])),
      dimensionCounts: Object.fromEntries(abilityDimensions.map((dimension) => [dimension.key, 0]))
    };
  }

  const buckets = Object.fromEntries(
    abilityDimensions.map((dimension) => [dimension.key, { weightedTotal: 0, weightTotal: 0, count: 0 }])
  );
  const total = scoredRecords.length;

  scoredRecords.forEach((record, index) => {
    const modeWeights = abilityModeWeights[record.training_mode || 'free_debate'] || abilityModeWeights.free_debate;
    const recencyWeight = Math.pow(0.9, total - index - 1);
    const adjustedScore = clampNumber(Number(record.score) + (abilityDifficultyBonus[record.difficulty] || 0), 0, 100);

    Object.entries(modeWeights).forEach(([dimensionKey, dimensionWeight]) => {
      const bucket = buckets[dimensionKey];
      if (!bucket) return;
      const weight = recencyWeight * dimensionWeight;
      bucket.weightedTotal += adjustedScore * weight;
      bucket.weightTotal += weight;
      bucket.count += 1;
    });
  });

  const globalAverage = roundToOne(
    scoredRecords.reduce((sum, record) => {
      return sum + clampNumber(Number(record.score) + (abilityDifficultyBonus[record.difficulty] || 0), 0, 100);
    }, 0) / scoredRecords.length
  );
  const dimensionScores = {};
  const dimensionConfidence = {};
  const dimensionCounts = {};

  abilityDimensions.forEach((dimension) => {
    const bucket = buckets[dimension.key];
    dimensionCounts[dimension.key] = bucket.count;
    dimensionConfidence[dimension.key] = Math.min(100, Math.round((bucket.count / 5) * 100));
    dimensionScores[dimension.key] = bucket.weightTotal
      ? roundToOne(bucket.weightedTotal / bucket.weightTotal)
      : roundToOne(globalAverage * 0.86);
  });

  const overall = roundToOne(abilityDimensions.reduce((sum, dimension) => {
    return sum + dimensionScores[dimension.key] * dimension.weight;
  }, 0));

  return {
    overall,
    overallEstimate: toAbilityEstimate(overall),
    confidence: Math.min(100, Math.round((scoredRecords.length / 10) * 100)),
    dimensionScores,
    dimensionConfidence,
    dimensionCounts
  };
}

function toAbilityEstimate(score) {
  if (score === null || score === undefined) return null;
  return Math.round(300 + clampNumber(Number(score), 0, 100) * 6);
}

function getAbilityLevel(estimate) {
  if (!estimate) return '暂无估测';
  if (estimate >= 820) return '强校队核心';
  if (estimate >= 760) return '市赛强手';
  if (estimate >= 700) return '校赛上游';
  if (estimate >= 640) return '稳定参赛';
  if (estimate >= 580) return '基础成型';
  return '起步积累';
}

async function fetchTaskRecords(taskId, teamCode, { localUserId = '', limit = 1000 } = {}) {
  const query = new URLSearchParams({
    select: 'id,space_type,team_code,local_user_id,nickname,topic,user_side,ai_side,difficulty,style_id,training_mode,task_id,messages,review,score,result,battlefield,created_at',
    space_type: 'eq.team',
    team_code: `eq.${teamCode}`,
    task_id: `eq.${taskId}`,
    order: 'created_at.desc',
    limit: String(limit)
  });

  if (localUserId) {
    query.set('local_user_id', `eq.${localUserId}`);
  }

  return supabaseRequest(`${trainingRecordsTable}?${query.toString()}`);
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
    if (record.task_id) throw error;

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
    taskId: record.task_id || null,
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

function mapTeamTaskFromDb(task = {}) {
  return {
    id: task.id,
    teamCode: task.team_code,
    title: task.title,
    topic: task.topic,
    userSide: task.user_side,
    mode: task.mode || 'free_debate',
    difficulty: task.difficulty || 'novice',
    styleId: task.style_id || 'none',
    requiredCount: task.required_count || 1,
    deadline: task.deadline,
    description: task.description || '',
    createdBy: task.created_by,
    status: task.status || 'active',
    createdAt: task.created_at,
    updatedAt: task.updated_at
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
