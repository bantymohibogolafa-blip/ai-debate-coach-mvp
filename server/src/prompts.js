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

const trainingModeProfiles = {
  constructive: {
    label: '立论训练',
    startRole: 'speech',
    reviewFocus: '一辩立论结构、论点完整度、论据使用和价值标准清晰度',
    opening: '请在内部模拟对立方一辩立论，但不要展示完整立论和思考过程。只输出“对立方已提出观点”，包含：1个核心标准、2-3个具体论点、2条事实论据。不要给用户建议、示范稿或写作方向。',
    response: '请输出反方一辩立论，回应正方核心标准，并提出反方2-3个主要论点，篇幅控制在朗读3分钟以内，约800-1000字。',
    userTask: '用户正在进行一辩立论训练。评价重点是立论结构、论证链、论据使用和表达完整度。'
  },
  summary: {
    label: '攻辩小结训练',
    startRole: 'prep',
    reviewFocus: '攻辩小结的战场提炼、交锋点回应、事实支撑和短时表达效率',
    opening: '请在内部模拟前面攻辩已经发生的交锋，但不要展示思考过程。只输出“场上已有交锋点”，包含：3个具体交锋点、对立方在每个交锋点上的主张、2-3条事实论据。不要给用户小结建议或示范稿。',
    response: '请根据已有材料和正方小结，输出反方攻辩小结示范，聚焦拆解正方战场和重建己方标准，控制在约600字以内。',
    userTask: '用户正在进行攻辩小结训练。评价重点是能否抓住交锋点、压缩战场、回应对方并形成总结性推进。'
  },
  free_debate: {
    label: '自由辩论',
    startRole: 'question',
    reviewFocus: '自由辩论中的回应、推进、攻防转换和战场控制',
    userTask: '用户正在进行自由辩论训练。评价重点是回应质量、推进意识、反压能力和战场控制。'
  },
  attack: {
    label: '攻辩训练',
    startRole: 'user_attack',
    reviewFocus: '质询设计、追问连续性、问题压迫感和战场推进',
    opening: '请在内部模拟对立方一辩立论，但不要展示完整立论和思考过程。只输出“对立方一辩已提出的关键点”，包含：1个核心标准、3-5个可被攻辩质询的具体主张、每个主张对应的简短理由或事实依据。不要给用户追问方向、进攻建议、目的分析或示范问题。',
    response: '你只能防守，不能反问、不能转为攻辩。请针对用户刚才的质询作答，尽量守住己方立场，并暴露适量可继续追问的空间。控制在160字以内。',
    userTask: '用户正在进行攻辩训练，用户只攻不防。评价重点是问题设计、追问连续性、压迫感和是否真正打到对方标准。'
  },
  defense: {
    label: '防守训练',
    startRole: 'question',
    reviewFocus: '被质询时的正面回应、概念切割、陷阱识别和防守反压',
    userTask: '用户正在进行防守训练，用户只能防守，不能反问或质询。评价重点是正面回应、守住立场、识别预设和避免致命承认。'
  },
  closing: {
    label: '结辩训练',
    startRole: 'prep',
    reviewFocus: '四辩结辩的战场归纳、价值升维、胜负判断和表达收束',
    opening: '请在内部模拟比赛前半程的对立方论证和交锋，但不要展示思考过程。只输出“对立方已形成的结辩素材”，包含：3个关键交锋点、对立方核心胜负判断、对立方主要论点。不要给用户结辩建议、发挥战场或示范稿。',
    response: '请根据已有交锋点和正方结辩，输出反方四辩结辩示范。需要回应正方胜负判断并重建反方战场，控制在朗读3分钟以内，约800-1000字。',
    userTask: '用户正在进行结辩训练。评价重点是战场归纳、胜负判断、价值升维和结尾收束。'
  }
};

const celebrityDebaters = {
  none: null,
  huang_zhizhong_style: {
    shortName: '黄执中式',
    displayName: '黄执中式：价值拆解与情绪洞察',
    disclaimer: '这是基于黄执中公开辩论与表达风格的风格化模拟，仅用于辩论训练，不代表黄执中本人观点或真实发言。',
    openingInstruction: '首轮只借鉴黄执中式的价值拆解、情绪洞察和人性追问方式，提出一个有价值压迫感的问题。不要判断漏洞，因为用户尚未回答。',
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
3. 尽量简洁，优先控制在150字左右；复杂问题可适当放宽，但必须完整表达。
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
    openingInstruction: '首轮只借鉴胡渐彪式的结构拆解、标准意识和战场控制方式，围绕定义、标准或比较对象提出一个问题。不要判断漏洞，因为用户尚未回答。',
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
5. 尽量简洁，优先控制在150字左右；复杂问题可适当放宽，但必须完整表达。
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
    openingInstruction: '首轮只借鉴马薇薇式的短句压迫和临场质询感，提出一个短、准、有压力的问题。不要判断漏洞，因为用户尚未回答。',
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
4. 优先短句表达，尽量控制在120字左右；复杂问题可适当放宽，但必须完整表达。
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
    openingInstruction: '首轮只借鉴乔布斯式的极简判断、本质追问和愿景压迫，提出一个关于本质、体验或长期价值的问题。不要判断漏洞，因为用户尚未回答。',
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
4. 优先简洁表达，尽量控制在120字左右；复杂问题可适当放宽，但必须完整表达。
5. 不要冒充本人，不要编造经历或原话。

输出格式：
【漏洞判断】指出用户回答中忽略的本质、体验或价值问题。
【追问】提出一个简洁但有压迫感的问题。
`
  }
};

const reviewScoringInstruction = `
你现在是二辩攻辩中的“被质询表现评分员”。

注意：用户不是质询方，而是被 AI 质询的一方。
因此你不评价用户提出问题的能力，而评价用户面对质询时的回应能力。

评分定位：
用户的任务是在 AI 连续追问下完成正面回应、守住己方核心立场、识别问题预设或陷阱、完成概念切割、避免承认致命前提，并在必要时进行简短反压。

总分 100 分，五项各 20 分：
1. 正面回应能力：是否直接回答 AI 的问题，而不是绕开。
2. 逻辑防守能力：是否守住己方立场和基本逻辑。
3. 概念切割能力：是否能区分情境、边界、例外与原则。
4. 陷阱识别能力：是否识别 AI 问题中的预设、偷换和极端化。
5. 反压与表达效率：是否能简洁回应，并适度把压力还给 AI。

评分规则：
1. 多次答非所问，通常不超过49分。
2. 只会重复立场，不能化解质询，通常不超过59分。
3. 能回应主要问题并守住基本立场，可进入60—66分。
4. 能完成有效切割并避免致命失守，可进入67—72分。
5. 能识别问题预设并稳定防守，可进入73—78分。
6. 能在防守中形成反压，可进入79—89分。
7. 90分以上必须谨慎，只有在高压质询下依然能掌控问题框架时才可给出。
8. 面对高强度或明星风格 AI，可以放宽胜负倾向，但不能虚高评分。

分数区间参考：
20—29：彻底失守。答非所问、情绪化、承认致命前提，甚至帮助 AI 方论证。
30—39：无效防御。能回应但没有真正回答，用口号、态度或循环论证代替防守。
40—49：被动抵抗。回答相关但无法消解问题，被 AI 带入不利战场。
50—59：初步回应。能回答常规问题，但标准不清、切割不足，容易硬接陷阱。
60—66：基本合格。多数回答正面，能守住底线，有简单切割，但反压不足。
67—72：有效防守。能接住主要质询，通过限定条件、标准澄清避免失守。
73—78：稳固防线。能识别偷换、过度概括或极端化，承认小问题但守住大立场。
79—84：高接低挡。能先处理预设，再回应核心，用“承认合理部分 + 切割边界 + 回到标准”完成防守。
85—89：防守反压。能拆掉 AI 问题前提，把压力反推给 AI，短时间完成回应、切割、反问。
90—94：掌控质询。能重构问题框架，让 AI 的追问变成己方标准的证明。
95—100：终极防线。极限施压下仍清晰、准确、简洁，无致命漏洞，切割精准，反压自然。

底层判断：
1. 正面回应优先。反复绕开问题，即使说得多，也不能高分。
2. 不承认致命前提。优秀回答应能识别并切割 AI 问题中的预设。
3. 概念切割是核心能力，例如正常流动 vs 恶性掐尖、个体例外 vs 整体趋势、短期利益 vs 长期影响、原则合理 vs 执行偏差、承认问题存在 vs 承认立场失败。
4. 防守不是复读。高质量回答应包含：正面回应问题、指出不当预设、切割概念边界、回到本方核心标准、必要时反问 AI。
5. 表达要高效：先给结论，再给理由，必要时切割，最后回到标准，不一次讲太多。

胜负倾向：
评分评价用户被质询能力；胜负倾向评价本轮攻辩对抗结果。面对高强度 AI，可以适当放宽胜负倾向，但不应虚高评分。
基础胜利线：入门50分，简单60分，校赛67分，市赛77分；高强度或明星风格 AI 可视情况修正。
胜负结果只能从四档中选择：用户明显胜、用户小优、势均力敌、用户偏劣。

复盘必须按照以下格式输出：
一、总分：__ / 100

二、分项评分：
1. 正面回应能力：__ / 20
2. 逻辑防守能力：__ / 20
3. 概念切割能力：__ / 20
4. 陷阱识别能力：__ / 20
5. 反压与表达效率：__ / 20

三、核心战场归属：
用户小优 / AI小优 / 势均力敌

四、胜负倾向：
用户明显胜 / 用户小优 / 势均力敌 / 用户偏劣

五、最大漏洞：
指出用户本轮被质询时最容易被打穿的具体问题。

六、最佳回应：
指出用户本轮最好的一次回答，并说明它好在哪里。

七、三条改进建议：
必须具体，不能空泛。

八、分步复盘：
按每一次“AI追问 + 用户回答”为一组逐轮复盘。每一轮必须包含：
第__轮：
1. AI追问重点：概括这一问真正想打的战场。
2. 用户回答判断：说明用户是否正面回答，是否守住己方立场。
3. 本轮主要问题：指出一个最关键的问题，例如标准不清、概念混淆、承认不利前提、例证不足、反压不足。
4. 本轮可取之处：指出一个值得保留的表达或思路。
5. 本轮修改建议：给出具体修改方向，不要只说“更清晰”“更有逻辑”。

九、每次回答的修改示范：
针对用户每一次回答逐条给出：
第__次回答：
原回答问题：指出原回答中最需要修改的地方。
建议改法：说明应该如何调整结构或用词。
修改后示范：给出一版可以直接用于攻辩现场的改写，控制在80—140字。

十、下次可直接使用的被质询回应模板：
给出一句适合被追问时使用的表达模板。
`;

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

export function normalizeTrainingMode(value) {
  return value || 'free_debate';
}

export function isValidTrainingMode(value) {
  return Object.hasOwn(trainingModeProfiles, value);
}

export function getSideLabel(side) {
  return sideLabels[side] || '正方';
}

export function getOpponentSide(userSide) {
  return userSide === 'affirmative' ? 'negative' : 'affirmative';
}

export function buildStartMessages({ topic, userSide, difficulty, celebrityDebater, trainingMode }) {
  const userSideLabel = getSideLabel(userSide);
  const opponentSideLabel = getSideLabel(getOpponentSide(userSide));
  const modeInstruction = getOpeningModeInstruction(difficulty, celebrityDebater);
  const modeProfile = trainingModeProfiles[trainingMode] || trainingModeProfiles.free_debate;

  if (trainingMode !== 'free_debate' && trainingMode !== 'defense') {
    return [
      {
        role: 'system',
        content: [
          '你是高中生辩论训练教练。',
          `当前训练模式：${modeProfile.label}。`,
          `用户立场是${userSideLabel}，AI 立场是${opponentSideLabel}。`,
          modeInstruction,
          '正方永远先进行，反方随后进行。',
          '开局要先模拟“用户对立面”已经完成的一辩、交锋或前半场论证，但只能展示提取后的材料。',
          '绝对不要展示你的思考过程、推理步骤、完整模拟稿或隐藏分析。',
          '输出只能是对立面已经提出的观点、关键点、交锋点、理由或事实依据。',
          '不要给用户指引、建议、追问方向、目的分析、发挥战场、表达模板或示范问题。',
          '等用户已经完成一次输入后，才可以在复盘中进行打分、分析和建议。',
          '输出格式：标题为“对立方已提出的关键点”，下面用编号列表罗列。每一点必须具体，可被用户直接拿来攻辩或回应。',
          '如果辩题涉及未成年人、校园关系、情感关系等内容，只讨论规则、责任、影响与价值判断。'
        ].join('\n')
      },
      {
        role: 'user',
        content: `辩题：${topic}\n用户立场：${userSideLabel}\n对立方立场：${opponentSideLabel}\n任务：${modeProfile.opening}`
      }
    ];
  }

  return [
    {
      role: 'system',
      content: [
        '你是高中生辩论赛中的二辩攻辩陪练。',
        `用户立场是${userSideLabel}，你必须站在${opponentSideLabel}。`,
        modeInstruction,
        '如果辩题涉及未成年人、校园关系、情感关系等内容，只讨论规则、责任、影响与价值判断，不生成露骨或成人化内容。',
        '现在生成第一轮攻辩问题。注意：用户还没有回答，所以不得输出“漏洞判断”、不得评价用户回答、不得使用【漏洞判断】格式。',
        '严格要求：只能问一个问题；不要给答案；不要列多个问题；语言适合高中学生；输出中只保留问题本身；问题要完整，不要为了压缩字数截断句子。'
      ].join('\n')
    },
    {
      role: 'user',
      content: `辩题：${topic}\n请站在${opponentSideLabel}，向${userSideLabel}提出第一轮攻辩问题。`
    }
  ];
}

export function buildRespondMessages({ topic, userSide, difficulty, celebrityDebater, trainingMode, history, answer }) {
  const userSideLabel = getSideLabel(userSide);
  const opponentSideLabel = getSideLabel(getOpponentSide(userSide));
  const modeInstruction = getModeInstruction(difficulty, celebrityDebater);
  const modeProfile = trainingModeProfiles[trainingMode] || trainingModeProfiles.free_debate;
  const transcript = formatHistory(history);

  if (trainingMode && trainingMode !== 'free_debate' && trainingMode !== 'defense') {
    return [
      {
        role: 'system',
        content: [
          '你是高中生辩论训练陪练。',
          `当前训练模式：${modeProfile.label}。`,
          `用户立场是${userSideLabel}，AI 立场是${opponentSideLabel}。`,
          modeInstruction,
          '正方永远先进行，反方随后进行。',
          modeProfile.userTask,
          '如果轮到 AI 发言，只输出 AI 方本轮内容；如果是攻辩训练，AI 只能防守，不能反问、不能质询。'
        ].join('\n')
      },
      {
        role: 'user',
        content: [
          `辩题：${topic}`,
          `此前流程：\n${transcript || '暂无'}`,
          `用户最新输入：${answer}`,
          `请按模式要求继续：${modeProfile.response || '代表 AI 方完成下一段发言，保持赛场表达。'}`
        ].join('\n\n')
      }
    ];
  }

  return [
    {
      role: 'system',
      content: [
        '你是高中生辩论赛中的二辩攻辩陪练。',
        `用户立场是${userSideLabel}，你必须站在${opponentSideLabel}。`,
        modeInstruction,
        '如果辩题涉及未成年人、校园关系、情感关系等内容，只讨论规则、责任、影响与价值判断，不生成露骨或成人化内容。',
        '你要根据用户刚才的回答，先判断一个主要漏洞，再提出一个追问。',
        '严格要求：只能提出一个追问；不要同时给多个问题；保持二辩攻辩的质询感；回答要简洁但句子必须完整，不要为了压缩字数截断。'
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

export function buildReviewMessages({ topic, userSide, difficulty, celebrityDebater, trainingMode, history }) {
  const userSideLabel = getSideLabel(userSide);
  const opponentSideLabel = getSideLabel(getOpponentSide(userSide));
  const modeInstruction = getModeInstruction(difficulty, celebrityDebater);
  const modeProfile = trainingModeProfiles[trainingMode] || trainingModeProfiles.free_debate;
  const transcript = formatHistory(history);

  return [
    {
      role: 'system',
      content: [
        '你是高中生辩论训练教练。',
        `用户立场是${userSideLabel}，陪练 AI 立场是${opponentSideLabel}。`,
        `当前训练模式：${modeProfile.label}。`,
        modeInstruction,
        '如果辩题涉及未成年人、校园关系、情感关系等内容，只做辩论表达、逻辑和价值分析。',
        reviewScoringInstruction,
        `请根据完整训练过程生成复盘报告。额外关注：${modeProfile.reviewFocus}。`,
        '请用简洁中文输出，适合高中学生阅读。'
      ].join('\n')
    },
    {
      role: 'user',
      content: `辩题：${topic}\n完整对话：\n${transcript || '暂无'}\n请生成复盘报告。`
    }
  ];
}

export function buildPolishMessages({ topic, userSide, difficulty, celebrityDebater, history, answer }) {
  const userSideLabel = getSideLabel(userSide);
  const opponentSideLabel = getSideLabel(getOpponentSide(userSide));
  const modeInstruction = getModeInstruction(difficulty, celebrityDebater);
  const transcript = formatHistory(history);

  return [
    {
      role: 'system',
      content: [
        '你是高中生二辩攻辩表达教练。',
        `用户立场是${userSideLabel}，对手立场是${opponentSideLabel}。`,
        modeInstruction,
        '你的任务是把用户当前的口语化回答整理成更适合被质询时使用的比赛表达。',
        '不要替用户改变核心立场，不要自动帮用户承认对方观点，不要新增虚构事实。',
        '如果辩题涉及未成年人、校园关系、情感关系等内容，只做辩论表达、逻辑和价值分析。',
        '必须只输出合法 JSON，不要使用 Markdown，不要加代码块。',
        'JSON 字段必须为：polished、concise、tip。',
        'polished：攻辩整理版，适合直接放进回答框，控制在120字以内。',
        'concise：30秒比赛版，更短、更有判断和反压，控制在80字以内。',
        'tip：一句表达质量提示，指出当前回答最该补强的地方。'
      ].join('\n')
    },
    {
      role: 'user',
      content: [
        `辩题：${topic}`,
        `此前对话：\n${transcript || '暂无'}`,
        `用户原始回答：${answer}`,
        `请基于${userSideLabel}立场整理表达。`
      ].join('\n\n')
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

function getOpeningModeInstruction(difficulty, celebrityDebater) {
  const debater = celebrityDebaters[celebrityDebater];

  if (!debater) {
    return difficultyProfiles[difficulty]?.instruction || difficultyProfiles.novice.instruction;
  }

  return [
    '当前为明星辩手模式，难度固定为市赛。',
    debater.disclaimer,
    debater.openingInstruction
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
