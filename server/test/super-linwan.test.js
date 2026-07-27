import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSuperLinWanMessages,
  createPrematchContextManifest,
  getDefaultPrematchStrategy,
  markPrematchStrategyForReassessment,
  mergePrematchStrategy,
  normalizePrematchStrategy,
  parseSuperLinWanResponse
} from '../src/superLinwan.js';
import { buildReviewMessages, buildStartMessages } from '../src/prompts.js';

test('strategy snapshots preserve real task decisions without inventing absent fields', () => {
  const initial = getDefaultPrematchStrategy();
  assert.deepEqual(initial.confirmedArguments, []);
  assert.equal(initial.coreBattlefield, '');

  const updated = mergePrematchStrategy(initial, {
    coreBattlefield: '比较两种制度谁更能降低不可逆伤害',
    confirmedPoints: ['不使用幸福总量作为唯一判准'],
    rejectedPoints: ['纯粹诉诸个案'],
    recommendedTrainings: [{
      mode: 'constructive',
      difficulty: 'campus',
      reason: '判准尚未闭合',
      goal: '验证判准能否覆盖主论点',
      verificationQuestion: '三个论点是否使用同一比较标准'
    }]
  }, { updatedAt: '2026-07-27T00:00:00.000Z' });

  assert.equal(updated.coreBattlefield, '比较两种制度谁更能降低不可逆伤害');
  assert.deepEqual(updated.confirmedPoints, ['不使用幸福总量作为唯一判准']);
  assert.deepEqual(updated.rejectedPoints, ['纯粹诉诸个案']);
  assert.equal(updated.recommendedTrainings[0].mode, 'constructive');
  assert.deepEqual(updated.opponentRoutes, []);
});

test('strategy reassessment keeps prior decisions and records the changed premise', () => {
  const current = normalizePrematchStrategy({
    confirmedArguments: ['原主论'],
    unresolvedQuestions: ['原待验证问题']
  });
  const marked = markPrematchStrategyForReassessment(
    current,
    '立场已修改，已有战略需要重新评估。',
    '重新检查立场变化对当前战略的影响'
  );

  assert.deepEqual(marked.confirmedArguments, ['原主论']);
  assert.equal(marked.needsReassessment, true);
  assert.match(marked.reassessmentReason, /立场已修改/);
  assert.deepEqual(marked.unresolvedQuestions, [
    '原待验证问题',
    '重新检查立场变化对当前战略的影响'
  ]);
});

test('Super Lin Wan prompt reuses the supplied base personality but switches only the task contract', () => {
  const messages = buildSuperLinWanMessages({
    basePersonalityPrompt: '原有林婉人格-不可修改',
    preferencePrompt: '称呼用户为小锋',
    abilityProfileText: '有效评分记录：2 条\n防守稳定：待测',
    task: {
      id: 'task-a',
      spaceType: 'personal',
      debateTopic: '人工智能让人更自由',
      stance: 'affirmative',
      debatePosition: 'second',
      currentStage: 'analysis'
    },
    strategy: {
      confirmedPoints: ['先比较选择能力'],
      rejectedPoints: ['不走效率万能论']
    },
    taskSummary: '只属于任务 A 的摘要',
    trainingLinks: [],
    recentMessages: [
      { role: 'user', content: '任务 A 私有消息' },
      { role: 'assistant', content: '任务 A 私有回答' }
    ],
    currentQuestion: '这个判准能不能成立？'
  });
  const joined = messages.map((message) => message.content).join('\n');

  assert.equal(messages[0].content, '原有林婉人格-不可修改');
  assert.match(joined, /当前状态：Super 林婉/);
  assert.match(joined, /不读取、不暗示读取日常林婉聊天/);
  assert.match(joined, /任务 A 私有消息/);
  assert.match(joined, /只属于任务 A 的摘要/);
  assert.match(joined, /只代表本场比赛，不代表真实价值观/);
  assert.equal(messages.at(-1).content, '这个判准能不能成立？');
});

test('structured response parser accepts only supported stages, modes and difficulties', () => {
  const response = parseSuperLinWanResponse(JSON.stringify({
    answer: '这个方向可以保留，但先别急着当主论。',
    taskSummary: '已确认方向 A，方向 B 待验证。',
    structuredUpdate: {
      currentStage: 'strategy',
      coreBattlefield: '规则可预期性',
      confirmedArguments: ['方向 A'],
      recommendedTrainings: [
        {
          mode: 'defense',
          difficulty: 'city',
          reason: '防守风险高',
          goal: '验证概念切割',
          verificationQuestion: '能否守住边界'
        },
        {
          mode: 'unknown',
          difficulty: 'impossible',
          reason: '不应保留'
        }
      ]
    }
  }));

  assert.equal(response.answer, '这个方向可以保留，但先别急着当主论。');
  assert.equal(response.structuredUpdate.currentStage, 'strategy');
  assert.equal(response.structuredUpdate.recommendedTrainings.length, 1);
  assert.equal(response.structuredUpdate.recommendedTrainings[0].mode, 'defense');
  assert.equal(response.structuredUpdate.needsReassessment, false);
});

test('context manifest exposes counts only and no raw strategy or messages', () => {
  const manifest = createPrematchContextManifest(
    { customPreference: '直说' },
    { scoredRecordCount: 3, coverage: 81 },
    [{ role: 'user', content: '私有原文' }],
    [{ resultSummary: { mainWeakness: '私有训练问题' } }]
  );
  const serialized = JSON.stringify(manifest);

  assert.equal(manifest.trainingProfile.scoredRecords, 3);
  assert.equal(manifest.taskContext.recentMessages, 1);
  assert.equal(serialized.includes('私有原文'), false);
  assert.equal(serialized.includes('私有训练问题'), false);
});

test('all formal training prompts carry bounded preparation goals without changing their mode boundary', () => {
  const shared = {
    topic: '测试辩题',
    userSide: 'affirmative',
    aiSide: 'negative',
    difficulty: 'novice',
    celebrityDebater: 'none',
    prepTrainingGoal: '验证判准闭合',
    prepStrategySummary: '核心战场：制度可预期性',
    prepVerificationQuestion: '三个论点是否共用同一标准'
  };
  const start = buildStartMessages({
    ...shared,
    trainingMode: 'defense',
    defensePrep: '己方分论点',
    freeDebatePrep: ''
  });
  const review = buildReviewMessages({
    ...shared,
    trainingMode: 'closing',
    history: [{ role: 'user', content: '结辩内容' }],
    completedRounds: 1
  });
  const startText = start.map((message) => message.content).join('\n');
  const reviewText = review.map((message) => message.content).join('\n');

  assert.match(startText, /来源：赛前备战任务/);
  assert.match(startText, /验证判准闭合/);
  assert.match(startText, /当前是防守训练：AI 只攻，用户只防守/);
  assert.match(reviewText, /三个论点是否共用同一标准/);
  assert.match(reviewText, /当前训练模式：结辩训练/);
});
