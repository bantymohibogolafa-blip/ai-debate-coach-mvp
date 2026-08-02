import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { buildRespondMessages, buildReviewMessages, buildStartMessages } from '../src/prompts.js';
import { finalizeReviewScore, getScoringRubric } from '../src/scoringRubrics.js';
import {
  buildDefenseAnalysisRepairInstruction,
  buildDefenseQuestionRepairInstruction,
  parseDefenseOpening,
  parseDefenseTurn,
  validateDefenseOpeningAnalysis,
  validateDefenseTurnAnalysis
} from '../src/defenseTraining.js';
import { calculateDifficultyAdjustment, projectAbilityDimensions } from '../src/abilityProfile.js';
import {
  CURRENT_DIFFICULTY_CALIBRATION_VERSION,
  CURRENT_ESTIMATOR_VERSION,
  CURRENT_PROJECTION_VERSION,
  CURRENT_SCORING_VERSION
} from '../src/scoringVersions.js';

const serverDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryDirectory = path.resolve(serverDirectory, '..');
const defaultPlanPath = path.join(serverDirectory, 'test-data', 'scoring-empirical-test-plan.csv');
const prepPath = path.join(serverDirectory, 'test-data', 'scoring-empirical-prep.json');
const outputDirectory = path.join(serverDirectory, 'test-results', 'defense-scoring-v6-verification');
const checkpointPath = path.join(outputDirectory, 'checkpoint.json');
const summaryPath = path.join(outputDirectory, 'summary.json');
const lockPath = path.join(outputDirectory, 'execution.lock');
const MAX_CALLS = 100;
const RANDOMIZATION_SEED = 20260802;
const SIMULATOR_SYSTEM_PROMPT = `你正在模拟同一名具有一定辩论经验的中学生。该学生属于普通比赛中等偏上水平，不是刚入门者，也不是高水平队伍核心。你的任务是根据当前辩题、己方立场、己方预先确定的基本主张、对方实际发言和当前轮任务自然作答，不是扮演教练或评分员。

始终保持以下稳定表现：正确理解常见辩题与己方立场；通常直接回应当前问题；每次给出一个明确结论和至少一条基本理由；可以使用常见例子，但不虚构精确数据，证据不必总是充分；能识别明显漏洞，但可能遗漏更深层前提；能做基础反击，但不保证持续压迫；不倒戈，不答非所问，不故意回避；表达清楚，允许偶尔重复或论证衔接不够紧密；遇到复杂或高压问题时自然暴露不足，不额外提升能力。

保持一致的思考深度、语言习惯和表达水平。不要猜测测试条件，不要迎合外部评价，不要输出自我评价。只能使用本次会话提供的信息，不得引用其他会话、其他测试或任何外部反馈。

严格完成当前轮任务。作为被质询方，优先回答当前问题，必要时做基础澄清、切割或简单反压。句子完整，不输出隐藏推理过程。`;

const args = parseArgs(process.argv.slice(2));
const planPath = path.resolve(args.approvedPlan || defaultPlanPath);
const planText = await fs.readFile(planPath, 'utf8');
const prepDocument = JSON.parse(await fs.readFile(prepPath, 'utf8'));
const planRows = parseCsv(planText).filter((row) => row.mode === 'defense');
validatePlan(planRows, args);
const tasks = shuffle(planRows.map((row) => ({
  runId: `V6-${row.test_id.replace(/^EMP-/, '')}`,
  testId: row.test_id,
  motionId: row.motion_id,
  difficulty: row.difficulty
})), RANDOMIZATION_SEED).map((task, index) => ({ ...task, executionOrder: index + 1 }));
const codeState = getCodeState();

if (!args.execute) {
  console.log(JSON.stringify({
    mode: 'plan', runs: tasks.length, baselineCalls: 72, maximumCalls: MAX_CALLS,
    databaseEnabled: false, outputDirectory, codeState, tasks
  }, null, 2));
  process.exit(0);
}

await fs.mkdir(path.join(outputDirectory, 'raw'), { recursive: true });
const lock = await fs.open(lockPath, 'wx').catch((error) => {
  if (error.code === 'EEXIST') throw new Error(`Verification already running: ${lockPath}`);
  throw error;
});
await lock.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }), 'utf8');
try {
  const provider = await loadProvider();
  const checkpoint = await loadCheckpoint({ tasks, planPath, planText, codeState, provider });
  for (const task of tasks) {
    if (checkpoint.runs[task.runId]?.status === 'complete') continue;
    checkpoint.runs[task.runId] = { ...task, status: 'running', startedAt: new Date().toISOString() };
    await saveCheckpoint(checkpoint);
    try {
      checkpoint.runs[task.runId] = await executeRun({ task, checkpoint, provider, prepDocument, planRows });
      console.log(`[defense-v6] ${task.executionOrder}/9 ${task.runId} score=${checkpoint.runs[task.runId].finalScore} calls=${checkpoint.callCount}/${MAX_CALLS}`);
    } catch (error) {
      checkpoint.runs[task.runId] = {
        ...checkpoint.runs[task.runId], status: 'failed', finishedAt: new Date().toISOString(),
        error: String(error?.stack || error)
      };
      await saveCheckpoint(checkpoint);
      throw error;
    }
    await saveCheckpoint(checkpoint);
    await writeJsonAtomic(summaryPath, buildSummary(checkpoint));
  }
  const summary = buildSummary(checkpoint);
  await writeJsonAtomic(summaryPath, summary);
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await lock.close();
  await fs.rm(lockPath, { force: true });
}

async function executeRun({ task, checkpoint, provider, prepDocument, planRows }) {
  const row = planRows.find((item) => item.test_id === task.testId);
  const prep = prepDocument.motions[row.motion_id]?.prep;
  if (!prep) throw new Error(`Missing frozen prep for ${row.motion_id}`);
  const payload = {
    topic: row.motion, userSide: 'affirmative', aiSide: 'negative', difficulty: row.difficulty,
    celebrityDebater: 'none', trainingMode: 'defense', rounds: 3, defensePrep: prep
  };
  const rawDirectory = path.join(outputDirectory, 'raw', task.runId);
  await fs.mkdir(rawDirectory, { recursive: true });
  const context = { task, checkpoint, provider, rawDirectory, localCalls: 0, repairCount: 0 };
  const openingMessages = buildStartMessages(payload);
  let opening = await callModel(context, 'opponent_start', openingMessages, { temperature: 0.45, maxTokens: 620 });
  let openingValidation = validateDefenseOpeningAnalysis(opening.content, { difficulty: row.difficulty });
  if (!openingValidation.valid) {
    context.repairCount += 1;
    opening = await callModel(context, 'opponent_start_question_repair', [
      ...openingMessages,
      { role: 'assistant', content: opening.content },
      { role: 'user', content: buildDefenseQuestionRepairInstruction({ difficulty: row.difficulty }) }
    ], { temperature: 0, maxTokens: 900 });
    openingValidation = validateDefenseOpeningAnalysis(opening.content, { difficulty: row.difficulty });
  }
  if (!openingValidation.valid) throw new Error(`Invalid opening defense question after repair: ${openingValidation.errors.join(', ')}`);
  const parsedOpening = parseDefenseOpening(opening.content, 3);
  let currentQuestion = parsedOpening.question;
  const history = [{ role: 'ai', content: parsedOpening.questionText }];
  const states = [];

  for (let round = 1; round <= 3; round += 1) {
    const student = await callModel(context, `simulator_round_${round}`, buildSimulatorMessages(row, prep, history, round), {
      temperature: 0.2, maxTokens: 400
    });
    history.push({ role: 'user', content: student.content });
    const messages = buildRespondMessages({
      ...payload, history, answer: student.content, defenseRoundStates: states, currentDefenseQuestion: currentQuestion
    });
    let analyzed = await callModel(context, `defense_analysis_round_${round}`, messages, { temperature: 0.25, maxTokens: 1500 });
    const validationContext = { hasNextRound: round < 3, difficulty: row.difficulty };
    let validation = validateDefenseTurnAnalysis(analyzed.content, validationContext);
    if (!validation.valid) {
      context.repairCount += 1;
      analyzed = await callModel(context, `defense_analysis_round_${round}_format_repair`, [
        ...messages,
        { role: 'assistant', content: analyzed.content },
        { role: 'user', content: buildDefenseAnalysisRepairInstruction(validationContext) }
      ], { temperature: 0, maxTokens: 1600 });
      validation = validateDefenseTurnAnalysis(analyzed.content, validationContext);
    }
    if (!validation.valid) throw new Error(`Invalid defense schema after repair: ${validation.errors.join(', ')}`);
    const turn = parseDefenseTurn(analyzed.content, {
      currentRound: round, totalRounds: 3, currentQuestion, previousRounds: states, userAnswer: student.content
    });
    states.push(turn.state);
    currentQuestion = turn.nextQuestion;
    if (round < 3) history.push({ role: 'ai', content: currentQuestion.questionText });
  }

  const reviewMessages = buildReviewMessages({ ...payload, history, completedRounds: 3, defenseRoundStates: states });
  const reviewResponse = await callModel(context, 'scoring_review', reviewMessages, { temperature: 0.5, maxTokens: 2200 });
  const review = parseJsonObject(reviewResponse.content);
  if (!review) throw new Error('Scoring response is not valid JSON');
  const { rubric, rubricId } = getScoringRubric('defense');
  const finalized = finalizeReviewScore({
    trainingMode: 'defense', dimensionScores: review.dimensionScores, capTriggers: review.capTriggers,
    defenseRoundStates: states, plannedRounds: 3, completedRounds: 3
  });
  const rawProjected = projectAbilityDimensions({ training_mode: 'defense', dimension_scores: finalized.dimensionScores });
  const adjustedProjected = Object.fromEntries(Object.entries(rawProjected).map(([key, score]) => [
    key,
    Math.max(0, Math.min(100, score + calculateDifficultyAdjustment({
      score, difficulty: row.difficulty, usesDifficulty: rubric.usesDifficulty, finalScore: finalized.finalScore
    })))
  ]));
  const result = {
    ...task, status: 'complete', finishedAt: new Date().toISOString(), motion: row.motion,
    finalScore: finalized.finalScore, rawScore: finalized.rawScore, scoreLevel: finalized.scoreLevel,
    roundAverage: finalized.defenseRoundSummary?.roundAverage,
    statuses: states.map((state) => state.answerStatus),
    completions: states.map((state) => state.currentQuestionCompletion),
    roundScores: states.map((state) => state.roundScore.total),
    hardCapCodes: (finalized.hardCapCandidates || []).map((item) => item.code),
    appliedCap: finalized.appliedCap, repairCount: context.repairCount, modelCallCount: context.localCalls,
    dimensionScores: finalized.dimensionScores, rawProjected, adjustedProjected,
    scoringVersion: CURRENT_SCORING_VERSION, rubricId, rubricVersion: rubric.rubricVersion,
    projectionVersion: CURRENT_PROJECTION_VERSION,
    difficultyCalibrationVersion: CURRENT_DIFFICULTY_CALIBRATION_VERSION,
    estimatorVersion: CURRENT_ESTIMATOR_VERSION
  };
  await writeJsonAtomic(path.join(rawDirectory, 'transcript.json'), {
    runId: task.runId, payload, history, defenseRoundStates: states, review, finalized, result
  });
  return result;
}

function buildSimulatorMessages(row, prep, history, round) {
  return [
    { role: 'system', content: SIMULATOR_SYSTEM_PROMPT },
    { role: 'user', content: [
      `辩题：${row.motion}`, `己方立场：${row.student_side}`, `己方预先确定的基本主张：${prep}`,
      `本次会话内的实际对话：\n${history.map((item, index) => `${index + 1}. ${item.role === 'ai' ? '对方' : '学生'}：${item.content}`).join('\n')}`,
      `当前为第${round}轮。任务：作为被质询方，优先正面回应当前问题，必要时进行基础概念澄清、逻辑防守或简单反压。复杂问题允许只完成部分回答。`
    ].join('\n\n') }
  ];
}

async function callModel(context, label, messages, options) {
  if (context.checkpoint.callCount >= MAX_CALLS) throw new Error(`Model call budget exhausted at ${MAX_CALLS}`);
  context.checkpoint.callCount += 1;
  context.localCalls += 1;
  const callIndex = context.checkpoint.callCount;
  const body = {
    model: context.provider.model, messages, thinking: { type: context.provider.thinking },
    temperature: options.temperature, max_tokens: options.maxTokens
  };
  const prefix = `${String(callIndex).padStart(3, '0')}-${label}`;
  await writeJsonAtomic(path.join(context.rawDirectory, `${prefix}-request.json`), {
    callIndex, runId: context.task.runId, label, requestedAt: new Date().toISOString(),
    apiHost: new URL(context.provider.apiUrl).host, body
  });
  await saveCheckpoint(context.checkpoint);
  const response = await fetch(context.provider.apiUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${context.provider.apiKey}` },
    body: JSON.stringify(body)
  });
  const responseText = await response.text();
  let data;
  try { data = JSON.parse(responseText); } catch { data = { invalidJsonBody: responseText.slice(0, 1000) }; }
  await writeJsonAtomic(path.join(context.rawDirectory, `${prefix}-response.json`), {
    callIndex, runId: context.task.runId, label, receivedAt: new Date().toISOString(),
    status: response.status, requestId: response.headers.get('x-request-id') || data?.id || '', body: data
  });
  if (!response.ok) throw new Error(`Provider request failed: HTTP ${response.status}`);
  const choice = data?.choices?.[0];
  if (!choice?.message?.content) throw new Error('Provider returned empty content');
  if (choice.finish_reason === 'length') throw new Error('Provider output truncated');
  return { content: choice.message.content.trim(), usage: data.usage || {} };
}

function buildSummary(checkpoint) {
  const runs = Object.values(checkpoint.runs).filter((run) => run.status === 'complete');
  const mean = (values) => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 10) / 10 : null;
  return {
    experimentId: 'defense-scoring-v6-verification', codeState: checkpoint.codeState,
    databaseEnabled: false, modelCallsMade: checkpoint.callCount, completedRuns: runs.length,
    overallMean: mean(runs.map((run) => run.finalScore)),
    byDifficulty: Object.fromEntries(['novice', 'campus', 'city'].map((difficulty) => {
      const group = runs.filter((run) => run.difficulty === difficulty);
      return [difficulty, {
        count: group.length, meanFinalScore: mean(group.map((run) => run.finalScore)),
        meanRoundScore: mean(group.map((run) => run.roundAverage)),
        min: group.length ? Math.min(...group.map((run) => run.finalScore)) : null,
        max: group.length ? Math.max(...group.map((run) => run.finalScore)) : null
      }];
    })),
    statusCounts: runs.flatMap((run) => run.statuses).reduce((counts, status) => ({
      ...counts, [status]: (counts[status] || 0) + 1
    }), {}),
    repairCount: runs.reduce((sum, run) => sum + run.repairCount, 0),
    hardCapRunCount: runs.filter((run) => run.hardCapCodes.length).length,
    runs: runs.map(({ runId, testId, motionId, difficulty, finalScore, roundAverage, statuses, hardCapCodes, repairCount, modelCallCount }) => ({
      runId, testId, motionId, difficulty, finalScore, roundAverage, statuses, hardCapCodes, repairCount, modelCallCount
    }))
  };
}

function validatePlan(rows, parsedArgs) {
  if (rows.length !== 9) throw new Error(`Expected 9 approved defense rows, got ${rows.length}`);
  if (new Set(rows.map((row) => `${row.motion_id}|${row.difficulty}`)).size !== 9) throw new Error('Defense matrix is incomplete');
  if (rows.some((row) => row.approval_status !== '已批准')) throw new Error('Every defense row must be 已批准');
  if (parsedArgs.execute && !parsedArgs.approvedPlan) throw new Error('--execute requires --approved-plan <file>');
  if (parsedArgs.execute && ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY'].some((key) => process.env[key])) {
    throw new Error('Database environment detected; verification refused');
  }
}

async function loadProvider() {
  const env = parseEnv(await fs.readFile(path.join(serverDirectory, '.env'), 'utf8'));
  const apiKey = process.env.DEEPSEEK_API_KEY || env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY missing');
  return {
    apiKey, apiUrl: process.env.DEEPSEEK_API_URL || env.DEEPSEEK_API_URL || 'https://api.deepseek.com/chat/completions',
    model: process.env.DEEPSEEK_MODEL || env.DEEPSEEK_MODEL || 'deepseek-chat',
    thinking: process.env.DEEPSEEK_THINKING || env.DEEPSEEK_THINKING || 'disabled'
  };
}

async function loadCheckpoint({ tasks, planPath, planText, codeState, provider }) {
  let checkpoint;
  try {
    checkpoint = JSON.parse(await fs.readFile(checkpointPath, 'utf8'));
    if (checkpoint.planSha256 !== sha256(planText) || checkpoint.codeState.diffSha256 !== codeState.diffSha256) {
      throw new Error('Checkpoint does not match the approved plan or current code state');
    }
  } catch (error) {
    if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
    checkpoint = {
      experimentId: 'defense-scoring-v6-verification', createdAt: new Date().toISOString(),
      planPath, planSha256: sha256(planText), codeState, modelName: provider.model,
      databaseEnabled: false, callCount: 0,
      runs: Object.fromEntries(tasks.map((task) => [task.runId, { ...task, status: 'pending' }]))
    };
  }
  let physicalCalls = 0;
  for (const task of tasks) {
    const rawDirectory = path.join(outputDirectory, 'raw', task.runId);
    const files = await fs.readdir(rawDirectory).catch((error) => error.code === 'ENOENT' ? [] : Promise.reject(error));
    physicalCalls += files.filter((name) => name.endsWith('-request.json')).length;
    try {
      const transcript = JSON.parse(await fs.readFile(path.join(rawDirectory, 'transcript.json'), 'utf8'));
      if (transcript.result?.status === 'complete') checkpoint.runs[task.runId] = transcript.result;
    } catch (error) {
      if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
      if (checkpoint.runs[task.runId]?.status === 'running') checkpoint.runs[task.runId] = { ...task, status: 'pending' };
    }
  }
  checkpoint.callCount = Math.max(Number(checkpoint.callCount || 0), physicalCalls);
  checkpoint.recoveredAt = new Date().toISOString();
  await saveCheckpoint(checkpoint);
  return checkpoint;
}

async function saveCheckpoint(checkpoint) {
  await writeJsonAtomic(checkpointPath, checkpoint);
}

async function writeJsonAtomic(targetPath, value) {
  const temporaryPath = `${targetPath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(temporaryPath, JSON.stringify(value, null, 2), 'utf8');
  await fs.rename(temporaryPath, targetPath);
}

function getCodeState() {
  const headSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repositoryDirectory, encoding: 'utf8' }).trim();
  const diff = execFileSync('git', ['diff', '--', 'server/src', 'server/test'], { cwd: repositoryDirectory, encoding: 'utf8', maxBuffer: 10_000_000 });
  return { headSha, diffSha256: sha256(diff), scoringVersion: CURRENT_SCORING_VERSION };
}

function parseJsonObject(text) {
  const clean = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(clean); } catch { return null; }
}

function parseArgs(argv) {
  const result = { execute: false };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--execute') result.execute = true;
    else if (argv[index] === '--dry-run') result.dryRun = true;
    else if (argv[index] === '--approved-plan') result.approvedPlan = argv[++index];
    else throw new Error(`Unknown argument: ${argv[index]}`);
  }
  return result;
}

function parseCsv(text) {
  const records = [];
  let row = [], field = '', quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ',') { row.push(field); field = ''; }
    else if (character === '\n') { row.push(field.replace(/\r$/, '')); records.push(row); row = []; field = ''; }
    else field += character;
  }
  if (field || row.length) { row.push(field); records.push(row); }
  const headers = records.shift();
  return records.filter((values) => values.some(Boolean)).map((values) => (
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))
  ));
}

function shuffle(values, seed) {
  const result = [...values];
  let state = seed >>> 0;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function parseEnv(text) {
  return Object.fromEntries(String(text).split(/\r?\n/).map((line) => line.trim()).filter((line) => (
    line && !line.startsWith('#') && line.includes('=')
  )).map((line) => {
    const index = line.indexOf('=');
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    return [key, value];
  }));
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}
