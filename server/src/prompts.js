const difficultyProfiles = {
  novice: {
    label: '新手',
    instruction: '新手：问题直接，主要训练观点清晰和基本回应。',
    fallbackQuestion: '如果坚持这个立场，你能先说明判断标准是什么吗？',
    fallbackProbe: '你的回答有判断标准不清的问题。追问：你用什么标准证明这个立场更合理？'
  },
  campus: {
    label: '校赛',
    instruction: '校赛：问题有一定压迫感，关注定义、逻辑链和例证。',
    fallbackQuestion: '你的立场如何避免只讲价值判断，而缺少现实依据？',
    fallbackProbe: '漏洞：你的论证缺少从原因到结论的连接。追问：这个结论具体由哪一步推出来？'
  },
  city: {
    label: '市赛',
    instruction: '市赛：问题更尖锐，但仍保持高中生可理解；重点追问因果、边界、比较标准和现实可行性。',
    fallbackQuestion: '如果出现例外情况，你方标准还能稳定成立吗？',
    fallbackProbe: '漏洞：你的回答没有处理边界情况。追问：遇到反例时，你方标准是否仍然成立？'
  }
};

const sideLabels = {
  affirmative: '正方',
  negative: '反方'
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

export function isValidSide(value) {
  return Object.hasOwn(sideLabels, value);
}

export function isValidDifficulty(value) {
  return Object.hasOwn(difficultyProfiles, value);
}

export function getSideLabel(side) {
  return sideLabels[side] || '正方';
}

export function getDifficultyLabel(difficulty) {
  return difficultyProfiles[difficulty]?.label || '新手';
}

export function getOpponentSide(userSide) {
  return userSide === 'affirmative' ? 'negative' : 'affirmative';
}

export function buildStartMessages({ topic, userSide, difficulty }) {
  const userSideLabel = getSideLabel(userSide);
  const opponentSideLabel = getSideLabel(getOpponentSide(userSide));
  const difficultyInstruction = getDifficultyInstruction(difficulty);

  return [
    {
      role: 'system',
      content: [
        '你是高中生辩论赛中的二辩攻辩陪练。',
        `用户立场是${userSideLabel}，你必须站在${opponentSideLabel}。`,
        difficultyInstruction,
        '如果辩题涉及未成年人、校园关系、情感关系等内容，只讨论规则、责任、影响与价值判断，不生成露骨或成人化内容。',
        '现在生成第一轮攻辩问题。',
        '严格要求：只能问一个问题；不超过150字；不要给答案；不要列多个问题；语言适合高中学生。'
      ].join('\n')
    },
    {
      role: 'user',
      content: `辩题：${topic}\n请站在${opponentSideLabel}，向${userSideLabel}提出第一轮攻辩问题。`
    }
  ];
}

export function buildRespondMessages({ topic, userSide, difficulty, history, answer }) {
  const userSideLabel = getSideLabel(userSide);
  const opponentSideLabel = getSideLabel(getOpponentSide(userSide));
  const difficultyInstruction = getDifficultyInstruction(difficulty);
  const transcript = formatHistory(history);

  return [
    {
      role: 'system',
      content: [
        '你是高中生辩论赛中的二辩攻辩陪练。',
        `用户立场是${userSideLabel}，你必须站在${opponentSideLabel}。`,
        difficultyInstruction,
        '如果辩题涉及未成年人、校园关系、情感关系等内容，只讨论规则、责任、影响与价值判断，不生成露骨或成人化内容。',
        '你要根据用户刚才的回答，先判断一个主要漏洞，再提出一个追问。',
        '严格要求：总字数不超过150字；只能提出一个追问；不要同时给多个问题；格式为“漏洞：... 追问：...”。'
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

export function buildReviewMessages({ topic, userSide, difficulty, history }) {
  const userSideLabel = getSideLabel(userSide);
  const opponentSideLabel = getSideLabel(getOpponentSide(userSide));
  const difficultyInstruction = getDifficultyInstruction(difficulty);
  const transcript = formatHistory(history);

  return [
    {
      role: 'system',
      content: [
        '你是高中生辩论训练教练。',
        `用户立场是${userSideLabel}，陪练 AI 立场是${opponentSideLabel}。`,
        difficultyInstruction,
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

export function buildFallbackStart({ userSide, difficulty }) {
  const opponentSideLabel = getSideLabel(getOpponentSide(userSide));
  const profile = getDifficultyProfile(difficulty);
  return `${opponentSideLabel}提问：${profile.fallbackQuestion}`;
}

export function buildFallbackRespond({ difficulty }) {
  return getDifficultyProfile(difficulty).fallbackProbe;
}

export function buildFallbackReview({ history }) {
  const userAnswers = history.filter((item) => item.role === 'user').map((item) => item.content);
  const bestAnswer = userAnswers.sort((a, b) => b.length - a.length)[0] || '暂无明显最佳回答';

  return [
    '总分：72/100',
    '五项评分：立论清晰 15/20；逻辑回应 14/20；例证使用 12/20；反问意识 14/20；表达简洁 17/20。',
    '最大漏洞：回答容易停留在态度表达，缺少清晰标准和具体例证。',
    `最佳回答：${bestAnswer}`,
    '三条改进建议：1. 先给判断标准；2. 每次回答补一个具体例子；3. 结尾主动反问对方标准。',
    '反击模板：如果对方只强调个别情况，我方追问：这个例子能否代表普遍判断标准？'
  ].join('\n');
}

function getDifficultyProfile(difficulty) {
  return difficultyProfiles[difficulty] || difficultyProfiles.novice;
}

function getDifficultyInstruction(difficulty) {
  return getDifficultyProfile(difficulty).instruction;
}

function formatHistory(history = []) {
  return history
    .map((item, index) => {
      const speaker = item.role === 'ai' ? 'AI 陪练' : '用户';
      return `${index + 1}. ${speaker}：${item.content}`;
    })
    .join('\n');
}
