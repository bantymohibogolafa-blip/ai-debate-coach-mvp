export const onboardingKicker = '8页快速认识锋辩';

export const onboardingModeCards = Object.freeze([
  Object.freeze({ title: '立论训练', fit: '开篇立论、定义判准和论点结构。', summary: '练习把观点讲清楚、立稳，并形成完整的论证链。' }),
  Object.freeze({ title: '攻辩小结', fit: '攻辩后的战场结算与得失归纳。', summary: '练习总结刚才的交锋，并说明谁拿下了关键战场。' }),
  Object.freeze({ title: '自由辩论', fit: '快速反应、短句反击和战场控制。', summary: '练习连续交锋、追问和临场攻防。' }),
  Object.freeze({ title: '攻辩训练', fit: '质询、连续追问和漏洞推进。', summary: '练习把问题问准，并沿着对方漏洞继续追击。' }),
  Object.freeze({ title: '防守训练', fit: '被质询时的回应、切割和反压。', summary: '练习在高压追问中稳住立场，并把压力推回对方。' }),
  Object.freeze({ title: '结辩训练', fit: '总结陈词、胜负比较和价值收束。', summary: '练习重新结算整场比赛，并完成最终落点。' })
]);

export const onboardingPages = Object.freeze([
  Object.freeze({
    id: 'intro',
    title: '锋辩是什么？',
    intro: '锋辩是一个面向辩论训练的 AI 工具。你可以选择辩题、立场和训练模式，与站在对立面的 AI 进行专项攻防练习。训练结束后，系统会生成评分、问题分析和下一步建议。',
    bullets: Object.freeze([
      '可以在“我的记录”中查看之前的训练；',
      '可以通过“能力估测”观察自己的能力变化；',
      '可以向林婉咨询长期训练、赛前准备和反复出现的问题；',
      '可以进入团队空间完成团队任务和查看团队数据。'
    ]),
    tip: '训练中，AI是你的对手；复盘时，AI才是你的教练。',
    note: '第一次使用，建议先完成一场新手难度的训练。'
  }),
  Object.freeze({
    id: 'three-steps',
    title: '三步开始一次训练',
    steps: Object.freeze([
      Object.freeze({ title: '第一步：辩题', description: '填写一个辩题，或使用随机辩题功能选择候选题目。' }),
      Object.freeze({ title: '第二步：模式', description: '选择你的立场、难度、训练模式、轮数和其他训练配置。' }),
      Object.freeze({ title: '第三步：开赛', description: '确认本轮配置，检查无误后开始训练。' })
    ]),
    tip: '进入下一步后，仍然可以点击顶部步骤或返回按钮修改之前的内容，其他仍然有效的配置不会丢失。'
  }),
  Object.freeze({ id: 'modes', title: '我该选哪个模式？', modes: onboardingModeCards }),
  Object.freeze({
    id: 'answering',
    title: '训练中如何作答？',
    features: Object.freeze([
      Object.freeze({ title: '文字输入', description: '可以直接在回答框中输入你的观点。' }),
      Object.freeze({ title: '语音输入', description: '可以使用阿里云语音识别，将你的语音转换为文字。' }),
      Object.freeze({ title: '录音限制', description: '单次录音最长约30秒。' }),
      Object.freeze({ title: '整理表达', description: '可以让 AI 根据当前训练模式生成整理稿。' }),
      Object.freeze({ title: '原稿与整理稿', description: '原稿和整理稿可以切换，你可以选择更适合本轮训练的版本。' })
    ]),
    tip: '训练区支持文字输入和语音转文字，但不播放 AI 语音。'
  }),
  Object.freeze({
    id: 'review',
    title: '训练结束后怎么看？',
    features: Object.freeze([
      Object.freeze({ title: '结束并复盘', description: '完成至少一次有效作答后，可以结束训练并生成复盘。' }),
      Object.freeze({ title: '复盘报告', description: '查看本场总分、能力维度、主要问题、具体改进建议和下一步训练动作。' }),
      Object.freeze({ title: '我的记录', description: '在“我的记录”中查看之前完成的训练和完整复盘。' }),
      Object.freeze({ title: '能力估测', description: '根据当前空间中的训练记录，观察逻辑推进、防守稳定、反压能力、战场控制和表达效率等能力。' }),
      Object.freeze({ title: '复盘助手', description: '需要追问某一场训练的具体细节时，可以在对应训练记录下继续询问复盘助手。' })
    ]),
    tip: '训练次数越充分，能力估测和反复问题判断才越有参考价值。'
  }),
  Object.freeze({
    id: 'linwan',
    title: '林婉 · 辩论顾问',
    intro: '林婉用于长期训练分析和赛前准备。她不是单场训练中的对手，而是帮助你观察反复问题、制定训练方向的辩论顾问。',
    bullets: Object.freeze([
      '会参考当前空间的近期训练画像；',
      '会结合最近8轮完整对话；',
      '支持文字输入；',
      '支持阿里云语音转文字，语音结果不会自动发送；',
      '回答支持小米流式语音播放；',
      '“我的林婉”可以调整称呼和交流偏好；',
      '回答下方可以查看“本轮参考”。'
    ]),
    tip: '单轮训练的具体细节，优先在对应训练记录下询问复盘助手。'
  }),
  Object.freeze({
    id: 'spaces',
    title: '个人空间与团队空间',
    sections: Object.freeze([
      Object.freeze({ title: '个人空间', description: '个人空间中的训练记录、能力估测和近期训练画像属于你个人。' }),
      Object.freeze({ title: '团队空间', description: '切换到某个团队空间后，你在该团队中的训练记录、能力估测和训练画像会单独计算。' }),
      Object.freeze({ title: '数据隔离', description: '不同空间的数据彼此隔离。切换空间后，页面显示的记录、画像和团队数据也会随之变化。' }),
      Object.freeze({ title: '林婉', description: '林婉分析训练问题时，会使用你当前所在空间的训练画像，同时结合最近8轮对话。' })
    ]),
    bullets: Object.freeze([
      '查看团队任务；',
      '完成指定训练；',
      '查看团队训练数据；',
      '队长和管理员可以布置与管理任务。'
    ]),
    tip: '登录后可以跨设备恢复账号数据、使用“我的林婉”设置并加入团队。'
  }),
  Object.freeze({
    id: 'start',
    title: '去大胆试试吧',
    intro: '别害怕，去大胆尝试 AI 辩论，也试着和林婉聊会儿吧。\n\n她不一样，你也不一样，她应该会很懂你的吧。'
  })
]);

export function getInitialOnboardingPageIndex() {
  return 0;
}

export function getPreviousOnboardingPageIndex(pageIndex) {
  return Math.max(0, pageIndex - 1);
}

export function getNextOnboardingPageIndex(pageIndex) {
  return Math.min(onboardingPages.length - 1, pageIndex + 1);
}

export function getOnboardingPrimaryAction(pageIndex) {
  return pageIndex === onboardingPages.length - 1
    ? Object.freeze({ label: '进入训练区', type: 'start' })
    : Object.freeze({ label: '下一步', type: 'next' });
}
