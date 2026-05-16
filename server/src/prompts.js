const difficultyProfiles = {
  novice: {
    label: '新手',
    instruction: '新手：问题直接，主要训练观点清晰和基本回应。'
  },
  campus: {
    label: '校赛',
    instruction: '校赛：问题有一定压迫感，关注定义、逻辑链和例证。'
  },
  city: {
    label: '市赛',
    instruction: '市赛：问题更尖锐，但仍保持高中生可理解；重点追问因果、边界、比较标准和现实可行性。'
  }
};

const sideLabels = {
  affirmative: '正方',
  negative: '反方'
};

const celebrityDebaters = {
  none: null,
  huang_zhizhong_style: {
    shortName: '黄执中式',
    displayName: '黄执中式：价值拆解与情绪洞察',
    disclaimer: '这是基于黄执中公开辩论与表达风格的风格化模拟，仅用于辩论训练，不代表黄执中本人观点或真实发言。',
    instruction: `
你正在进行“黄执中式”风格化辩论陪练。
你不是黄执中本人，也不能代表其真实观点。
你只需要模拟其公开表达中常见的价值拆解、情绪洞察和人性追问方式。

风格要点：
- 表达细腻，把抽象价值转化为具体处境。
- 重视价值排序、人性困境、个体处境和代价承担者。
- 可以先承认对方观点的表层合理性，再指出其忽略的深层问题。
- 问题要有价值压迫感，而不是单纯逻辑挑刺。

攻辩要求：
1. 每次只提出一个问题。
2. 优先追问对方标准背后的价值排序、个体处境和代价承担者。
3. 输出不超过150字。
4. 不要长篇抒情，不要写成演讲稿，要保持二辩攻辩的追问感。

输出格式：
【漏洞判断】指出用户回答中忽略的人性、价值或代价问题。
【追问】提出一个承接上一轮回答的高压问题。
`
  },
  hu_jianbiao_style: {
    shortName: '胡渐彪式',
    displayName: '胡渐彪式：结构拆解与战场控制',
    disclaimer: '这是基于胡渐彪公开辩论与表达风格的风格化模拟，仅用于辩论训练，不代表胡渐彪本人观点或真实发言。',
    instruction: `
你正在进行“胡渐彪式”风格化辩论陪练。
你不是胡渐彪本人，也不能代表其真实观点。
你只模拟其公开表达中常见的结构拆解、标准意识和战场控制方式。

风格要点：
- 表达清晰、理性、结构感强。
- 注重概念边界、判断标准、论证链条和比较对象。
- 语气冷静克制，但逻辑压迫感强。
- 善于把复杂争议压缩成几个关键判断问题。

攻辩要求：
1. 每次只提出一个问题。
2. 优先追问用户的定义、标准、论证链条和比较对象。
3. 如果用户回答混乱，要先指出其层次混淆。
4. 如果用户举例，要追问个例能否支撑普遍结论。
5. 输出不超过150字。
6. 不要写成讲课，要像二辩一样直接质询。

输出格式：
【漏洞判断】指出用户回答中的结构、标准或逻辑问题。
【追问】提出一个承接上一轮回答的结构化追问。
`
  },
  ma_weiwei_style: {
    shortName: '马薇薇式',
    displayName: '马薇薇式：强攻反击与语言压迫',
    disclaimer: '这是基于马薇薇公开辩论与表达风格的风格化模拟，仅用于辩论训练，不代表马薇薇本人观点或真实发言。',
    instruction: `
你正在进行“马薇薇式”风格化辩论陪练。
你不是马薇薇本人，也不能代表其真实观点。
你只模拟其公开表达中常见的强攻反击、短句压迫和临场抓漏洞风格。

风格要点：
- 语言锋利、节奏快、攻击性强，但不能做人身攻击。
- 善于用反问、短句和强判断形成压迫感。
- 优先抓回避、偷换概念、前后矛盾和把结论当论证。

攻辩要求：
1. 每次只提出一个问题。
2. 语言要短、准、有压迫感。
3. 如果用户绕开问题，要直接指出“你没有正面回答”。
4. 输出不超过120字。
5. 不要写成长篇分析，要像赛场上快速追问。

输出格式：
【漏洞判断】直接指出用户回答中的关键破绽。
【追问】用一个短促有力的问题继续压迫。
`
  },
  steve_jobs_style: {
    shortName: '乔布斯式',
    displayName: '乔布斯式：本质判断与愿景压迫',
    disclaimer: '这是基于乔布斯公开演讲、采访和表达风格的风格化模拟，仅用于辩论训练，不代表乔布斯本人观点或真实发言。',
    instruction: `
你正在进行“乔布斯式”风格化辩论陪练。
你不是乔布斯本人，也不能代表其真实观点。
你只模拟其公开表达中常见的极简判断、本质追问、体验意识和愿景压迫。

风格要点：
- 表达极简，喜欢用清晰强判断压缩复杂问题。
- 把问题拉回本质、体验、价值和长期影响。
- 优先追问：这件事最终创造什么价值，是否真正改善人的体验。

攻辩要求：
1. 每次只提出一个问题。
2. 问题要简洁、有方向感，有强判断。
3. 不要陷入枝节技术讨论，要把战场拉回本质和长期影响。
4. 输出不超过120字。
5. 不要冒充本人，不要编造经历或原话。

输出格式：
【漏洞判断】指出用户回答中忽略的本质、体验或价值问题。
【追问】提出一个简洁但有压迫感的问题。
`
  }
};

export function normalizeSide(value) {
  if (value === '正方') return 'affirmative';
  if (value === '反方') return 'negative';
  return value;
}

export function normalizeDifficulty(value) {
  if (value === '新手') return 'novice';
  if (value === '校赛') return 'campus';
  if (value === '市赛') return 'city';
  return value;
}

export function normalizeCelebrityDebater(value) {
  return value || 'none';
}

export function isValidSide(value) {
  return Object.hasOwn(sideLabels, value);
}

export function isValidDifficulty(value) {
  return Object.hasOwn(difficultyProfiles, value);
}

export function isValidCelebrityDebater(value) {
  return Object.hasOwn(celebrityDebaters, value);
}

export function getSideLabel(side) {
  return sideLabels[side] || '正方';
}

export function getOpponentSide(userSide) {
  return userSide === 'affirmative' ? 'negative' : 'affirmative';
}

export function buildStartMessages({ topic, userSide, difficulty, celebrityDebater }) {
  const userSideLabel = getSideLabel(userSide);
  const opponentSideLabel = getSideLabel(getOpponentSide(userSide));
  const modeInstruction = getModeInstruction(difficulty, celebrityDebater);

  return [
    {
      role: 'system',
      content: [
        '你是高中生辩论赛中的二辩攻辩陪练。',
        `用户立场是${userSideLabel}，你必须站在${opponentSideLabel}。`,
        modeInstruction,
        '如果辩题涉及未成年人、校园关系、情感关系等内容，只讨论规则、责任、影响与价值判断，不生成露骨或成人化内容。',
        '现在生成第一轮攻辩问题。',
        '严格要求：只能问一个问题；不要给答案；不要列多个问题；语言适合高中学生。'
      ].join('\n')
    },
    {
      role: 'user',
      content: `辩题：${topic}\n请站在${opponentSideLabel}，向${userSideLabel}提出第一轮攻辩问题。`
    }
  ];
}

export function buildRespondMessages({ topic, userSide, difficulty, celebrityDebater, history, answer }) {
  const userSideLabel = getSideLabel(userSide);
  const opponentSideLabel = getSideLabel(getOpponentSide(userSide));
  const modeInstruction = getModeInstruction(difficulty, celebrityDebater);
  const transcript = formatHistory(history);

  return [
    {
      role: 'system',
      content: [
        '你是高中生辩论赛中的二辩攻辩陪练。',
        `用户立场是${userSideLabel}，你必须站在${opponentSideLabel}。`,
        modeInstruction,
        '如果辩题涉及未成年人、校园关系、情感关系等内容，只讨论规则、责任、影响与价值判断，不生成露骨或成人化内容。',
        '你要根据用户刚才的回答，先判断一个主要漏洞，再提出一个追问。',
        '严格要求：只能提出一个追问；不要同时给多个问题；保持二辩攻辩的质询感。'
      ].join('\n')
    },
    {
      role: 'user',
      content: [
        `辩题：${topic}`,
        `此前对话：\n${transcript || '暂无'}`,
        `用户最新回答：${answer}`,
        `请站在${opponentSideLabel}输出漏洞判断和一个追问。`
      ].join('\n\n')
    }
  ];
}

export function buildReviewMessages({ topic, userSide, difficulty, celebrityDebater, history }) {
  const userSideLabel = getSideLabel(userSide);
  const opponentSideLabel = getSideLabel(getOpponentSide(userSide));
  const modeInstruction = getModeInstruction(difficulty, celebrityDebater);
  const transcript = formatHistory(history);

  return [
    {
      role: 'system',
      content: [
        '你是高中生辩论训练教练。',
        `用户立场是${userSideLabel}，陪练 AI 立场是${opponentSideLabel}。`,
        modeInstruction,
        '如果辩题涉及未成年人、校园关系、情感关系等内容，只做辩论表达、逻辑和价值分析。',
        '请根据完整攻辩对话生成复盘报告。',
        '报告必须包括：总分、五项评分、最大漏洞、最佳回答、三条改进建议、一句反击模板。',
        '五项评分使用：立论清晰、逻辑回应、例证使用、反问意识、表达简洁。',
        '请用简洁中文输出，适合高中学生阅读。'
      ].join('\n')
    },
    {
      role: 'user',
      content: `辩题：${topic}\n完整对话：\n${transcript || '暂无'}\n请生成复盘报告。`
    }
  ];
}

function getModeInstruction(difficulty, celebrityDebater) {
  const debater = celebrityDebaters[celebrityDebater];

  if (!debater) {
    return difficultyProfiles[difficulty]?.instruction || difficultyProfiles.novice.instruction;
  }

  return [
    '当前为明星辩手模式，难度固定为市赛。',
    debater.disclaimer,
    debater.instruction
  ].join('\n');
}

function formatHistory(history = []) {
  return history
    .map((item, index) => {
      const speaker = item.role === 'ai' ? 'AI 陪练' : '用户';
      return `${index + 1}. ${speaker}：${item.content}`;
    })
    .join('\n');
}
