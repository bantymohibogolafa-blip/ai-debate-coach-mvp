import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPersonalTaskLinWanMessages,
  buildSuperLinWanMessages,
  createPersonalTaskContextManifest,
  createPrematchContextManifest,
  getDefaultPersonalTaskMemory,
  getDefaultPrematchStrategy,
  markPrematchStrategyForReassessment,
  mergePersonalTaskMemory,
  mergePrematchStrategy,
  normalizePersonalTaskMemory,
  normalizePrematchStrategy,
  parsePersonalTaskLinWanResponse,
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

test('review scoring excludes sparring difficulty and celebrity style prompts', () => {
  const buildReviewText = (celebrityDebater) => buildReviewMessages({
    topic: '测试辩题',
    userSide: 'affirmative',
    aiSide: 'negative',
    difficulty: 'city',
    celebrityDebater,
    trainingMode: 'defense',
    history: [
      { role: 'ai', content: '请说明你方标准。' },
      { role: 'user', content: '我方标准是比较长期影响。' }
    ],
    completedRounds: 1,
    defensePrep: '长期影响比短期收益更重要。'
  }).map((message) => message.content).join('\n');

  for (const celebrityDebater of ['none', 'huang_zhizhong_style']) {
    const reviewText = buildReviewText(celebrityDebater);

    assert.match(reviewText, /本交互模式保留难度校准/);
    assert.match(reviewText, /当前为市赛难度/);
    assert.doesNotMatch(reviewText, /提问风格：/);
    assert.doesNotMatch(reviewText, /问题设计：/);
    assert.doesNotMatch(reviewText, /当前为明星辩手模式/);
    assert.doesNotMatch(reviewText, /你正在进行“黄执中式”风格化辩论陪练/);
  }
});

test('personal task prompt is isolated from training, daily history, other tasks and ability profiles', () => {
  const messages = buildPersonalTaskLinWanMessages({
    task: {
      id: 'personal-a',
      debateTopic: '人工智能会不会削弱人的创造力',
      stance: 'affirmative',
      initialIdeas: '先讨论创造力的定义'
    },
    memory: {
      confirmedDecisions: ['当前任务确认内容'],
      rejectedDecisions: ['当前任务否定内容']
    },
    taskSummary: '只属于当前任务的稳定摘要',
    recentMessages: [
      { role: 'user', content: '当前任务定义 A' },
      { role: 'assistant', content: '继续讨论定义 A' }
    ],
    currentQuestion: '下一步讨论什么？',
    intent: 'chat',
    displayName: '小锋'
  });
  const joined = messages.map((message) => message.content).join('\n');

  assert.match(joined, /当前任务定义 A/);
  assert.match(joined, /只属于当前任务的稳定摘要/);
  assert.match(joined, /当前任务确认内容/);
  assert.match(joined, /当前任务否定内容/);
  assert.match(joined, /当前登录用户显示名称：小锋/);
  assert.equal(joined.includes('能力画像原文'), false);
  assert.equal(joined.includes('过去训练记录原文'), false);
  assert.equal(joined.includes('其他任务消息原文'), false);
  assert.equal(joined.includes('日常林婉历史原文'), false);
  assert.equal(joined.includes('团队私有信息原文'), false);
});

test('personal memory keeps a revised decision as current and prevents the old version from returning', () => {
  const initial = mergePersonalTaskMemory(getDefaultPersonalTaskMemory(), {
    currentPosition: {
      stance: 'affirmative',
      definitions: ['稳定等于低风险。']
    },
    confirmedDecisions: ['稳定等于低风险。']
  });
  const revised = mergePersonalTaskMemory(initial, {
    currentPosition: {
      stance: 'affirmative',
      definitions: ['稳定等于可预期的发展路径。']
    },
    confirmedDecisions: ['稳定等于可预期的发展路径。'],
    decisionChanges: [{
      from: '稳定等于低风险。',
      to: '稳定等于可预期的发展路径。',
      reason: '用户修正定义',
      changeType: 'revised',
      changedAt: '2'
    }]
  });
  const normalized = normalizePersonalTaskMemory({
    ...revised,
    confirmedDecisions: [
      ...revised.confirmedDecisions,
      '稳定等于低风险。'
    ]
  });

  assert.deepEqual(normalized.currentPosition.definitions, ['稳定等于可预期的发展路径。']);
  assert.deepEqual(normalized.confirmedDecisions, ['稳定等于可预期的发展路径。']);
  assert.equal(normalized.decisionChanges[0].from, '稳定等于低风险。');
  assert.equal(JSON.stringify(normalized).includes('"confirmedDecisions":["稳定等于低风险。"]'), false);
});

test('personal parser keeps candidate ideas separate from confirmed and records rejection history', () => {
  const parsed = parsePersonalTaskLinWanResponse(JSON.stringify({
    answer: '这个方向可以考虑，但还不能确认。',
    taskSummary: '方向 B 是候选，方向 C 已否定。',
    structuredUpdate: {
      confirmedDecisions: [],
      candidateIdeas: ['方向 B'],
      rejectedDecisions: ['方向 C'],
      decisionChanges: [{
        from: '方向 C',
        to: '',
        reason: '用户明确否定',
        changeType: 'rejected',
        changedAt: '3'
      }]
    }
  }));

  assert.deepEqual(parsed.structuredUpdate.confirmedDecisions, []);
  assert.deepEqual(parsed.structuredUpdate.candidateIdeas, ['方向 B']);
  assert.deepEqual(parsed.structuredUpdate.rejectedDecisions, ['方向 C']);
  assert.equal(parsed.structuredUpdate.decisionChanges[0].changeType, 'rejected');
});

test('personal intent instructions reserve evidence search safety and report classification', () => {
  const shared = {
    task: { id: 'personal-a', debateTopic: '测试辩题', stance: 'undecided' },
    memory: getDefaultPersonalTaskMemory(),
    taskSummary: '已确认 A；候选 B；已否定 C；已修改 D；待解决 E',
    recentMessages: [],
    currentQuestion: '继续'
  };
  const evidence = buildPersonalTaskLinWanMessages({ ...shared, intent: 'evidence' })
    .map((message) => message.content).join('\n');
  const report = buildPersonalTaskLinWanMessages({ ...shared, intent: 'report' })
    .map((message) => message.content).join('\n');

  assert.match(evidence, /本轮 intent=evidence/);
  assert.match(evidence, /不可信外部资料/);
  assert.match(evidence, /不得编造作者、日期、机构、论文、统计数字/);
  assert.match(evidence, /若标记为联网失败，只能给检索方案/);
  assert.match(report, /本轮 intent=report/);
  assert.match(report, /不得触发或要求新搜索/);
  assert.match(report, /已确认、候选、已否定、已修改、尚未解决/);

  const manifest = createPersonalTaskContextManifest('report', [{ role: 'user', content: '当前消息' }]);
  assert.equal(manifest.intent, 'report');
  assert.equal(manifest.trainingProfile.used, false);
  assert.equal(manifest.taskContext.linkedTrainingResults, 0);
});

test('personal prompt preserves older decisions through summary and structured memory beyond recent messages', () => {
  const recentMessages = Array.from({ length: 30 }, (_, index) => ({
    role: index % 2 === 0 ? 'user' : 'assistant',
    content: `最近窗口消息-${index + 1}`
  }));
  const messages = buildPersonalTaskLinWanMessages({
    task: { id: 'personal-a', debateTopic: '测试辩题', stance: 'affirmative' },
    memory: {
      confirmedDecisions: ['早期但仍有效的定义 A'],
      rejectedDecisions: ['早期已否定方案 B']
    },
    taskSummary: '长期摘要继续保留定义 A 与方案 B 的状态。',
    recentMessages,
    currentQuestion: '继续讨论',
    intent: 'chat'
  });
  const joined = messages.map((message) => message.content).join('\n');

  assert.match(joined, /早期但仍有效的定义 A/);
  assert.match(joined, /早期已否定方案 B/);
  assert.match(joined, /长期摘要继续保留定义 A/);
  assert.equal(joined.includes('最近窗口消息-1\n'), false);
  assert.match(joined, /最近窗口消息-30/);
});

test('task evidence library survives normalization and remains available to later chat and report prompts', () => {
  const memory = mergePersonalTaskMemory(getDefaultPersonalTaskMemory(), {
    evidenceLibrary: [{
      id: 'E1',
      title: '已保存来源',
      url: 'https://example.edu/research',
      domain: 'example.edu',
      snippet: '任务内持续使用的摘要',
      sourceType: 'academic',
      query: '研究查询',
      retrievedAt: '2026-08-01T00:00:00.000Z'
    }]
  });
  assert.equal(normalizePersonalTaskMemory(memory).evidenceLibrary[0].id, 'E1');
  for (const intent of ['chat', 'report']) {
    const prompt = buildPersonalTaskLinWanMessages({
      task: { id: 'personal-a', debateTopic: '测试辩题', stance: 'affirmative' },
      memory,
      taskSummary: '',
      recentMessages: [],
      currentQuestion: intent === 'report' ? '形成报告' : 'E1 能支持第二点吗？',
      intent
    }).map((message) => message.content).join('\n');
    assert.match(prompt, /\[E1\] 已保存来源/);
    assert.match(prompt, /任务内持续使用的摘要/);
  }
});
