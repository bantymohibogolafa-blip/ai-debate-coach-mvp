const levelMap = {
  新手: '新手：问题直接，主要训练观点清晰和基本回应。',
  校赛: '校赛：问题有一定压迫感，关注定义、逻辑链和例证。',
  市赛: '市赛：问题更尖锐，追问因果、边界、比较标准和现实可行性。'
};

export function getOpponentSide(userSide) {
  return userSide === '正方' ? '反方' : '正方';
}

export function buildStartMessages({ topic, userSide, difficulty }) {
  const opponentSide = getOpponentSide(userSide);

  return [
    {
      role: 'system',
      content: [
        '你是高中生辩论赛中的二辩攻辩陪练。',
        `用户立场是${userSide}，你必须站在${opponentSide}。`,
        levelMap[difficulty] || levelMap.新手,
        '现在生成第一轮攻辩问题。',
        '严格要求：只能问一个问题；不超过150字；不要给答案；不要列多个问题；语言适合高中学生。'
      ].join('\n')
    },
    {
      role: 'user',
      content: `辩题：${topic}\n请站在${opponentSide}，向${userSide}提出第一轮攻辩问题。`
    }
  ];
}

export function buildRespondMessages({ topic, userSide, difficulty, history, answer }) {
  const opponentSide = getOpponentSide(userSide);
  const transcript = formatHistory(history);

  return [
    {
      role: 'system',
      content: [
        '你是高中生辩论赛中的二辩攻辩陪练。',
        `用户立场是${userSide}，你必须站在${opponentSide}。`,
        levelMap[difficulty] || levelMap.新手,
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
        `请站在${opponentSide}输出漏洞判断和一个追问。`
      ].join('\n\n')
    }
  ];
}

export function buildReviewMessages({ topic, userSide, difficulty, history }) {
  const opponentSide = getOpponentSide(userSide);
  const transcript = formatHistory(history);

  return [
    {
      role: 'system',
      content: [
        '你是高中生辩论训练教练。',
        `用户立场是${userSide}，陪练 AI 立场是${opponentSide}。`,
        levelMap[difficulty] || levelMap.新手,
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

function formatHistory(history = []) {
  return history
    .map((item, index) => {
      const speaker = item.role === 'ai' ? 'AI 陪练' : '用户';
      return `${index + 1}. ${speaker}：${item.content}`;
    })
    .join('\n');
}
