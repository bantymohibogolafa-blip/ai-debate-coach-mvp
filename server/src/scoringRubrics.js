const scoreLevels = [
  { min: 90, max: 100, label: '大师致胜区' },
  { min: 80, max: 89, label: '优势压制区' },
  { min: 70, max: 79, label: '标准竞技区' },
  { min: 50, max: 69, label: '基础及格区' },
  { min: 30, max: 49, label: '逻辑崩塌区' }
];

const rubricAliases = {
  constructive: 'constructive_speech',
  constructive_speech: 'constructive_speech',
  summary: 'cx_summary',
  cx_summary: 'cx_summary',
  free_debate: 'free_debate',
  attack: 'offensive_cx',
  offensive_cx: 'offensive_cx',
  defense: 'defensive_cx',
  defensive_cx: 'defensive_cx',
  closing: 'closing_speech',
  closing_speech: 'closing_speech'
};

export const scoringRubrics = {
  constructive_speech: {
    id: 'constructive_speech',
    appMode: 'constructive',
    displayName: '立论训练',
    coreGoal: '评价用户是否能够在开局阶段建立一个清晰、可防守、可推进的辩论框架。',
    focus: [
      '准确理解辩题并明确立场',
      '完成定义和判准',
      '建立清晰论证框架',
      '承担举证责任并给出有效论据',
      '为后续攻防留下可推进的战场'
    ],
    dimensions: [
      { name: '辩题理解与定义判准', maxScore: 27 },
      { name: '论证结构与逻辑链条', maxScore: 32 },
      { name: '论据、数据与例证支撑', maxScore: 21 },
      { name: '战场设计与可防守性', maxScore: 15 },
      { name: '表达清晰度与时间控制', maxScore: 5 }
    ],
    ranges: {
      '30-49 严重失效': ['立场混乱、理解错辩题、没有基本论点，或定义与结论互相冲突。'],
      '50-64 明显不足': ['有立场但只有观点，定义模糊，论点之间缺少完整证明和逻辑联系。'],
      '65-74 基本完成': ['有简单定义、标准和论点，但论据不足、战场较被动。'],
      '75-84 校赛可用': ['框架完整，定义判准基本稳定，主要论点有支撑。'],
      '85-89 明显优秀': ['定义、判准、论点和论据形成清楚闭环，能预判攻击并建立核心战场。'],
      '90-94 高水平校队': ['框架高效且有控制力，能限制对方成立空间，判准可以指导裁决。'],
      '95-100 接近理想': ['核心标准有原创性或穿透力，论证高度统一且几乎没有结构漏洞。']
    },
    penalties: [
      '没有明确立场，最高不超过49分。',
      '没有定义和判准，原则上不超过69分。',
      '只有观点没有论据，原则上不超过64分。',
      '论据与结论没有因果关系，原则上不超过72分。',
      '全篇空泛价值表达但无法落到辩题，原则上不超过75分。'
    ],
    highScoreConditions: [
      '定义、判准、论点、论据形成闭环。',
      '有可被后续攻防使用的核心战场。',
      '能主动预设对方可能攻击并提前布防。',
      '论证有现实支撑和价值高度。'
    ],
    outputFocus: '不要评价“追问是否连续”，重点评价立论框架、定义判准、论据支撑和可防守性。',
    templateHint: '给出一段可直接用于一辩立论的结构模板。'
  },
  cx_summary: {
    id: 'cx_summary',
    appMode: 'summary',
    displayName: '攻辩小结',
    coreGoal: '评价用户是否能在攻辩结束后准确结算交锋结果，说明己方拿下什么、对方暴露什么、后续如何推进。',
    focus: [
      '准确复盘攻辩交锋',
      '提炼对方暴露的漏洞',
      '说明己方守住或拿下的战场',
      '完成攻防转化',
      '把攻辩结果接回全场主线'
    ],
    dimensions: [
      { name: '攻辩内容提炼', maxScore: 27 },
      { name: '战场结算能力', maxScore: 32 },
      { name: '漏洞归纳与反击转化', maxScore: 21 },
      { name: '与本方主线连接', maxScore: 15 },
      { name: '表达简洁度与节奏', maxScore: 5 }
    ],
    ranges: {
      '30-49 严重失效': ['没有总结真实攻辩、与交锋结果相反、只重复立论，无法说明战场得失。'],
      '50-64 明显不足': ['只能流水账式复述，没有胜负判断，无法把漏洞转化为己方优势。'],
      '65-74 基本完成': ['能总结主要问答并指出部分不足，但战场仍较分散。'],
      '75-84 校赛可用': ['正确概括关键交锋，说明对方未完成的责任，基本形成有效结算。'],
      '85-89 明显优秀': ['能把零散问答整合为胜负点，把对方漏洞转化为己方优势并接回主线。'],
      '90-94 高水平校队': ['能重新定义后续比赛焦点，使核心战场的失守清晰可见。'],
      '95-100 接近理想': ['从有限攻辩中抓出决定胜负的核心矛盾，结算高度准确凝练。']
    },
    penalties: [
      '不引用或不回应刚才攻辩内容，最高不超过59分。',
      '只复述问题，没有结算，最高不超过64分。',
      '小结内容与实际攻辩相反，最高不超过49分。',
      '小结变成长篇重新立论，最高不超过72分。',
      '没有说明己方拿下什么优势，原则上不超过75分。'
    ],
    highScoreConditions: [
      '能准确结算攻辩胜负点。',
      '能指出对方没有完成的论证责任。',
      '能把攻辩结果转化为后续战场优势。',
      '语言简洁、有判断、有压迫感。'
    ],
    outputFocus: '不要把攻辩小结当成立论评分，重点评价战场结算和攻防转化。',
    templateHint: '给出一段可直接用于攻辩小结的结算模板。'
  },
  free_debate: {
    id: 'free_debate',
    appMode: 'free_debate',
    displayName: '自由辩论',
    coreGoal: '评价用户在快速、多轮、开放式交锋中的战场控制、临场反应、战术选择和攻守转换能力。',
    focus: [
      '连续交锋中的战场识别',
      '回应对方最新攻击',
      '抓住窗口反击',
      '推进己方主线',
      '在短促表达中完成攻守转换'
    ],
    dimensions: [
      { name: '战场识别与控制', maxScore: 32 },
      { name: '临场回应与反击', maxScore: 27 },
      { name: '逻辑推进与攻守转换', maxScore: 21 },
      { name: '表达效率与节奏感', maxScore: 15 },
      { name: '战术选择与临场判断', maxScore: 5 }
    ],
    ranges: {
      '30-49 严重失效': ['多次答非所问、情绪攻击、帮助对方推进，或完全找不到当前争点。'],
      '50-64 明显不足': ['只接表层、经常被带着跑，只防守或重复己方观点。'],
      '65-74 基本完成': ['能接住常规攻击并简单反驳，偶尔回到主线，但战场控制不稳定。'],
      '75-84 校赛可用': ['知道哪些问题应接、应切或应反打，多轮中主线基本不丢。'],
      '85-89 明显优秀': ['能抓住临场漏洞、转移压力并连续产生有效小结算。'],
      '90-94 高水平校队': ['多轮持续主导交锋，回应不仅防住，还能改变下一轮战场。'],
      '95-100 接近理想': ['几乎每次发言都有战略目的，能同时处理攻击、推进与胜负标准。']
    },
    penalties: [
      '多次不回应对方最新攻击，最高不超过59分。',
      '只会重复己方立论，最高不超过64分。',
      '被对方带偏核心战场，最高不超过69分。',
      '发言很长但没有有效推进，最高不超过72分。',
      '只攻击不防守或只防守不反击，原则上不超过78分。'
    ],
    highScoreConditions: [
      '能快速判断当前战场。',
      '能短句回应、快速反击。',
      '能不断把交锋拉回己方标准。',
      '能完成攻守转换。',
      '能结算每一轮小战场得失。'
    ],
    outputFocus: '评价连续交锋和战场控制，不要按单次回答或单次质询评分。第五维只评价用户能否判断应接、应切、应反打或应结算，不得评价当前单人 AI 训练中无法观察的团队协同。',
    templateHint: '给出一段自由辩短促回应、反击和结算的表达模板。'
  },
  offensive_cx: {
    id: 'offensive_cx',
    appMode: 'attack',
    displayName: '攻辩训练',
    coreGoal: '评价用户作为质询方时，能否通过问题设计、连续追问和逻辑压迫，打穿对方定义、判准、前提、数据或因果链。',
    focus: [
      '问题是否精准',
      '是否能根据回答连续追问',
      '是否打到核心漏洞',
      '是否推进战场',
      '表达是否短、准、狠'
    ],
    dimensions: [
      { name: '问题精准度', maxScore: 27 },
      { name: '连续追问能力', maxScore: 27 },
      { name: '抓漏洞能力', maxScore: 21 },
      { name: '逻辑压迫与战场推进', maxScore: 20 },
      { name: '表达简洁度与节奏控制', maxScore: 5 }
    ],
    ranges: {
      '30-49 严重失效': ['问题与辩题无关、涉及人身攻击、含义不明，无法形成有效质询。'],
      '50-64 明显不足': ['能围绕辩题发问但问题宽泛，只问事实，无法承接对方回答。'],
      '65-74 基本完成': ['能抓住明显漏洞并追问一到两层，但容易断线或转向枝节。'],
      '75-84 校赛可用': ['问题目标明确、追问基本连贯，能逼对方解释矛盾、前提或代价。'],
      '85-89 明显优秀': ['围绕核心漏洞形成稳定追问链，逐步压缩回答空间。'],
      '90-94 高水平校队': ['用少量关键问题打中核心架构，能即时调整并形成明确锁定。'],
      '95-100 接近理想': ['追问链高度严密，几乎没有无效问题，各类回答都会落入不利分支。']
    },
    penalties: [
      '问题与辩题无关，最高不超过39分。',
      '只会问单个问题，不会追问，最高不超过59分。',
      '只打枝节不打核心，最高不超过69分。',
      '一次问多个问题导致焦点混乱，最高不超过72分。',
      '攻击有气势但没有逻辑，原则上不超过65分。'
    ],
    highScoreConditions: [
      '每个问题都有明确攻击目标。',
      '能根据对方回答连续追问。',
      '能逼迫对方承认关键前提。',
      '能通过问题推进战场。',
      '问题短、准、狠。'
    ],
    outputFocus: '重点评价用户的主动质询能力，不要按被质询防守标准评价。“短、准、狠”的核心是准确，不得因必要铺垫、避免歧义或语气不强势而明显扣分。',
    templateHint: '给出一段攻辩追问链模板。'
  },
  defensive_cx: {
    id: 'defensive_cx',
    appMode: 'defense',
    displayName: '防守训练',
    coreGoal: '评价用户作为被质询方时，能否正面回应、识别陷阱、守住核心立场、完成概念切割，并在必要时反压。',
    focus: [
      '是否正面回应',
      '是否守住逻辑防线',
      '是否识别问题陷阱',
      '是否完成概念切割',
      '是否能稳定表达并适度反压'
    ],
    dimensions: [
      { name: '正面回应能力', maxScore: 27 },
      { name: '逻辑防守能力', maxScore: 27 },
      { name: '概念切割与陷阱识别', maxScore: 26 },
      { name: '反压能力', maxScore: 15 },
      { name: '表达效率与稳定性', maxScore: 5 }
    ],
    ranges: {
      '30-49 严重失效': ['彻底失守、答非所问、承认致命前提，或用情绪和口号代替回应。'],
      '50-64 明显不足': ['只能回应部分问题，经常绕开核心、缺少切割，面对强攻明显退让。'],
      '65-74 基本完成': ['能接住主要质询并简单切割，但防线不够稳定。'],
      '75-84 校赛可用': ['能正面回应，区分个例与整体、原则与例外、现象与因果，基本守住标准。'],
      '85-89 明显优秀': ['高压下仍稳定，能先处理预设再回应核心，并指出对方标准或前提问题。'],
      '90-94 高水平校队': ['多轮持续守住核心标准、重构问题，并将对方质询转化为己方资源。'],
      '95-100 接近理想': ['极限追问下几乎没有实质失守，完成高水平逻辑防守和反压。']
    },
    penalties: [
      '多次答非所问，最高不超过49分。',
      '多次回避核心问题，最高不超过59分。',
      '承认致命前提，最高不超过49分。',
      '不懂概念切割，原则上不超过69分。',
      '回答很长但没有回应问题，原则上不超过64分。'
    ],
    highScoreConditions: [
      '先正面回应，再切割。',
      '不乱承认对方预设。',
      '能守住核心标准。',
      '能用反问或重构完成反压。',
      '回答简洁、稳定、有判断。'
    ],
    outputFocus: '不能评价用户“问题问得不够好”，因为用户任务是防守而不是提问。有效类比、概念切割、重构标准和反压应得到实质认可；回答稍长但逻辑清楚、回应有效时不得明显扣分。',
    templateHint: '给出一段被质询时正面回应、切割和回到标准的模板。'
  },
  closing_speech: {
    id: 'closing_speech',
    appMode: 'closing',
    displayName: '结辩训练',
    coreGoal: '评价用户是否能够在比赛末端完成战场整合、胜负比较、价值升华和最终说服。',
    focus: [
      '说明本场真正争什么',
      '说明己方赢在哪里',
      '说明对方输在哪里',
      '说明评委应按何标准裁决',
      '完成价值升华和终局说服'
    ],
    dimensions: [
      { name: '战场整合与胜负比较', maxScore: 32 },
      { name: '对攻防成果的吸收', maxScore: 18 },
      { name: '价值升华与判断标准', maxScore: 30 },
      { name: '逻辑收束与表达感染力', maxScore: 15 },
      { name: '时间控制与结构完整', maxScore: 5 }
    ],
    ranges: {
      '30-49 严重失效': ['不是结辩、只重复立论，无法总结交锋或说明己方为何获胜。'],
      '50-64 明显不足': ['能总结己方观点但没有双方比较，忽略比赛过程且缺少裁决指引。'],
      '65-74 基本完成': ['能回顾主要争点并指出部分问题，但战场分散、价值收束较弱。'],
      '75-84 校赛可用': ['能整合主要攻防、进行胜负比较，并说明己方优势。'],
      '85-89 明显优秀': ['技术战场和价值层面均能结算，吸收攻防成果，裁决标准明确。'],
      '90-94 高水平校队': ['重新组织整场比赛，将零散争点统一到清楚标准并完成裁决指引。'],
      '95-100 接近理想': ['技术、现实和价值判断高度统一，结算凝练并能重塑评判理解。']
    },
    penalties: [
      '完全不总结比赛过程，最高不超过59分。',
      '只是重复立论，最高不超过64分。',
      '没有胜负比较，最高不超过69分。',
      '不回应对方核心攻击，最高不超过72分。',
      '价值升华空泛脱题，原则上不超过78分。'
    ],
    highScoreConditions: [
      '能明确结算本场核心战场。',
      '能吸收前面攻防成果。',
      '能告诉评委按什么标准裁决。',
      '能比较双方价值和现实后果。',
      '语言有终局感和感染力。'
    ],
    outputFocus: '不能套用攻辩评分，重点评价战场整合、胜负比较和价值升华。价值升华必须服务于已完成的战场结算；标准清楚且能指导裁决即可获得高分，不强制华丽语言、哲学名句或舞台式感染力。',
    templateHint: '给出一段结辩终局收束模板。'
  }
};

const genericRubric = {
  id: 'generic_debate',
  appMode: 'free_debate',
  displayName: '通用辩论评分',
  coreGoal: '当前训练模式未识别，使用通用辩论表现评分，重点评价立场、逻辑、回应、论据和表达。',
  focus: ['立场清晰', '逻辑成立', '回应有效', '论据支撑', '表达稳定'],
  dimensions: [
    { name: '立场与任务匹配', maxScore: 20 },
    { name: '逻辑结构', maxScore: 25 },
    { name: '回应与推进', maxScore: 20 },
    { name: '论据支撑', maxScore: 20 },
    { name: '表达效率', maxScore: 15 }
  ],
  ranges: {
    '30-49 逻辑崩塌区': ['立场混乱、逻辑断裂、无法完成训练任务。'],
    '50-69 基础及格区': ['能完成基本表达，但结构、回应或论据明显不足。'],
    '70-79 标准竞技区': ['任务基本匹配，逻辑和表达达到常规训练水平。'],
    '80-89 优势压制区': ['有较强战场判断和说服力。'],
    '90-100 大师致胜区': ['逻辑、表达、战场和价值高度统一。']
  },
  penalties: ['如果表现与当前环节目标严重不匹配，应明显扣分。'],
  highScoreConditions: ['立场、逻辑、论据、回应和表达形成闭环。'],
  outputFocus: '必须提示：当前训练模式未识别，已使用通用评分。',
  templateHint: '给出通用辩论表达模板。'
};

export function normalizeScoringMode(mode) {
  return rubricAliases[String(mode || '').trim()] || '';
}

export function getScoringRubric(mode) {
  const rubricId = normalizeScoringMode(mode);
  if (rubricId && scoringRubrics[rubricId]) {
    return {
      rubric: scoringRubrics[rubricId],
      rubricId,
      isFallback: false
    };
  }

  return {
    rubric: genericRubric,
    rubricId: genericRubric.id,
    isFallback: true
  };
}

export function getScoreLevel(score) {
  const numericScore = Number(score);
  if (!Number.isFinite(numericScore)) return '';
  const boundedScore = Math.max(30, Math.min(100, numericScore));
  return scoreLevels.find((level) => boundedScore >= level.min && boundedScore <= level.max)?.label || '';
}

export function calculateWeightedScore(dimensionScores, rubric) {
  const rubricDimensions = Array.isArray(rubric?.dimensions) ? rubric.dimensions : [];
  if (!rubricDimensions.length || !Array.isArray(dimensionScores) || dimensionScores.length < rubricDimensions.length) {
    throw scoringDimensionsError('评分维度缺失。');
  }

  const providedNames = dimensionScores
    .map((dimension) => normalizeDimensionName(dimension?.name))
    .filter(Boolean);
  if (new Set(providedNames).size !== providedNames.length) {
    throw scoringDimensionsError('评分维度名称重复。');
  }

  const weightTotal = rubricDimensions.reduce((total, dimension) => total + Number(dimension.maxScore), 0);
  if (!Number.isFinite(weightTotal) || Math.abs(weightTotal - 100) > 0.0001) {
    throw scoringDimensionsError('评分权重配置无效。');
  }

  const usedIndexes = new Set();
  const normalizedDimensions = rubricDimensions.map((dimension, rubricIndex) => {
    const expectedName = normalizeDimensionName(dimension.name);
    let providedIndex = dimensionScores.findIndex((item, index) => (
      !usedIndexes.has(index) && normalizeDimensionName(item?.name) === expectedName
    ));

    if (providedIndex < 0 && !usedIndexes.has(rubricIndex)) {
      providedIndex = rubricIndex;
    }
    if (providedIndex < 0) {
      providedIndex = dimensionScores.findIndex((item, index) => !usedIndexes.has(index));
    }

    const provided = providedIndex >= 0 ? dimensionScores[providedIndex] : null;
    const rawScore = provided?.score;
    const numericScore = Number(rawScore);
    const providedMaxScore = Number(provided?.maxScore ?? provided?.max_score ?? 100);
    if (
      !provided
      || rawScore === null
      || rawScore === undefined
      || rawScore === ''
      || !Number.isFinite(numericScore)
      || !Number.isFinite(providedMaxScore)
      || providedMaxScore <= 0
    ) {
      throw scoringDimensionsError(`评分维度“${dimension.name}”缺失或无效。`);
    }

    usedIndexes.add(providedIndex);
    const normalizedScore = providedMaxScore === 100
      ? numericScore
      : (numericScore / providedMaxScore) * 100;

    return {
      name: dimension.name,
      score: roundToOne(clamp(normalizedScore, 0, 100)),
      maxScore: 100,
      comment: String(provided?.comment || '').trim()
    };
  });

  const weightedScore = rubricDimensions.reduce((total, dimension, index) => (
    total + normalizedDimensions[index].score * (Number(dimension.maxScore) / 100)
  ), 0);

  return {
    score: roundToOne(clamp(weightedScore, 30, 100)),
    dimensionScores: normalizedDimensions
  };
}

function scoringDimensionsError(message) {
  const error = new Error(message);
  error.code = 'SCORING_DIMENSIONS_INVALID';
  return error;
}

function normalizeDimensionName(value) {
  return String(value || '').trim().replace(/\s+/g, '');
}

function roundToOne(value) {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function buildReviewRubricInstruction(mode, difficulty = 'campus') {
  const { rubric, rubricId, isFallback } = getScoringRubric(mode);
  const dimensions = rubric.dimensions
    .map((dimension, index) => `${index + 1}. ${dimension.name}：权重 ${dimension.maxScore}%`)
    .join('\n');
  const difficultyInstruction = buildDifficultyScoringInstruction(difficulty);
  const ranges = Object.entries(rubric.ranges)
    .map(([title, lines]) => `${title}\n${lines.map((line) => `- ${line}`).join('\n')}`)
    .join('\n\n');
  const penalties = rubric.penalties.map((item) => `- ${item}`).join('\n');
  const highScoreConditions = rubric.highScoreConditions.map((item) => `- ${item}`).join('\n');
  const focus = rubric.focus.map((item) => `- ${item}`).join('\n');
  const fifthDimension = rubric.dimensions.at(-1);
  const fifthDimensionCalibration = buildFifthDimensionCalibration(rubric);
  const fallbackNote = isFallback ? '\n当前训练模式未识别，已使用通用评分。你必须在 reviewText 中明确提示这一点。' : '';

  return `
当前复盘评分标准：
mode: ${rubric.appMode}
rubricId: ${rubricId}
modeDisplayName: ${rubric.displayName}
${fallbackNote}

核心评价目标：
${rubric.coreGoal}

本环节重点考察：
${focus}

评分权重：
${dimensions}

分数区间：
${ranges}

特殊扣分规则：
${penalties}

高分条件：
${highScoreConditions}

难度修正规则：
${difficultyInstruction}

训练型共同校准原则：
1. 这是中学生辩论训练产品的教练评分，不是全国总决赛或职业辩手评分；必须客观、有区分度，但不得过度压分。
2. 三档难度分别依据自身训练目标和实际缺陷严重程度评分，不得把校赛分数机械加减固定分数。
3. 高分首先取决于用户是否高质量完成“${rubric.coreGoal}”；核心任务完成度很高时，应允许核心维度进入90分以上。
4. 不得因为还能继续压缩、还能补充例证或还能更完美，就把高质量表现限制在80-85；次要改进空间不妨碍进入90分以上。
5. 只有真正影响当前模式任务完成的缺陷才应实质扣分，不要用“不完美即压分”的逻辑。

第五维专项校准（${fifthDimension.name}，仅占 ${fifthDimension.maxScore}%）：
${fifthDimensionCalibration}

本环节特别要求：
${rubric.outputFocus}

AI评分总规则：
1. 评分必须只根据当前训练环节对应 rubric。
2. 不允许所有环节都使用攻辩训练标准。
3. 你只负责给出五个维度的 0-100 分和文字评价；不要计算、猜测或输出最终总分与 scoreLevel，后端会按权重确定性计算。
4. 不要因为语言流畅就给高分。
5. 不要因为价值表达华丽但逻辑空洞就给高分。
6. 不要因为用户表达很多就给高分。
7. 评分必须说明扣分原因。
8. 评分必须给出下一步改进建议。
9. 如果用户表现与当前环节目标严重不匹配，应明显扣分。
10. 复盘语气要像辩论教练：reviewText 开头必须先具体肯定用户本轮一个真实亮点，再指出主要问题，最后给下一步训练建议；不得嘲讽、打击用户，也不要空泛夸奖。
11. 鼓励必须具体，例如指出用户抓住了核心矛盾、没有完全失守、有基本战场意识、表达结构清楚等真实表现。
12. 维度分允许细分并保留一位小数；不要总是输出整数或固定分，可以使用66.5、72.8、78.3、84.6、89.2、92.5等。
13. 对明显优秀的表现要敢给高分。市赛难度可以更严格，但优秀结辩、优秀攻防不应被压在80分左右。
14. 即使是市赛模式，也不等于全国冠军标准；市赛模式应更严格，但仍需对训练者保持客观、鼓励和可进步的评价。
15. ${rubric.templateHint}

复盘必须输出严格 JSON，不要包裹 Markdown 代码块，不要输出 JSON 之外的文字。JSON 结构如下：
{
  "score": 0,
  "scoreLevel": "",
  "mode": "${rubric.appMode}",
  "modeDisplayName": "${rubric.displayName}",
  "dimensionScores": [
${rubric.dimensions.map((dimension) => `    { "name": "${dimension.name}", "score": 0, "maxScore": 100, "comment": "" }`).join(',\n')}
  ],
  "battlefield": "",
  "mainWeakness": "",
  "strengths": [],
  "weaknesses": [],
  "reviewText": "",
  "nextStepAdvice": [],
  "template": ""
}

JSON填写要求：
1. score 和 scoreLevel 仅为兼容字段，可以输出，但后端会忽略并根据五维权重重新生成。
2. dimensionScores 必须完整输出上方五个维度，名称保持一致；score 为 0-100 的一位小数，maxScore 固定为100。
3. battlefield 要概括本轮核心战场归属或胜负焦点。
4. reviewText 用自然语言说明本轮表现，必须先肯定一个具体亮点，再指出主要问题。
5. template 给出该环节可直接复用的表达模板。
`;
}

function buildFifthDimensionCalibration(rubric) {
  if (rubric.appMode === 'free_debate') {
    return [
      '1. 该维度只评价当前单人训练中可观察的战术选择，不得因无法观察团队协同而扣分。',
      '2. 90-100：每轮策略选择准确，知道何时回应、切割、反打和结算。',
      '3. 80-89：总体判断合理，偶尔在次要战场投入过多。',
      '4. 70-79：能做基本选择，但容易被对方带节奏。',
      '5. 60-69：策略被动，经常抓错重点；60以下仅用于几乎没有战术判断、发言方向混乱。'
    ].join('\n');
  }

  return [
    '1. 表达稍长不等于表达低效；内容较多但结构清楚、推进有效时，该维度不应低于80分。',
    '2. 高压多轮中为完成概念切割和逻辑说明而适度展开，属于合理表达。',
    '3. 95-100：表达极清晰、高效、稳定，几乎没有无效内容。',
    '4. 90-94：整体清晰流畅，只有少量可压缩空间。',
    '5. 85-89：存在部分冗长或节奏问题，但不影响理解和推进。',
    '6. 78-84：明显偏长或有重复，但核心结构仍清楚。',
    '7. 70-77：多处拖沓，开始影响攻防效率。',
    '8. 60-69：表达混乱、重复明显，核心不易识别；30-59仅用于表达问题严重影响任务完成。',
    '9. “可以更精炼”通常对应85-92，而不是70-75，不得单独成为主要失分来源。'
  ].join('\n');
}

function buildDifficultyScoringInstruction(difficulty) {
  if (difficulty === 'novice') {
    return [
      '- 当前为新手难度：面向刚接触辩论、主要目标是敢说、能回应并形成基本结构的用户。',
      '- 30-49表示基本无法完成任务、答非所问、立场混乱或逻辑严重崩塌；50-64表示有表达意愿但尚未形成有效回应。',
      '- 65-74表示能完成部分基本任务但回应、结构或论据明显不足；75-84表示合格入门水平。',
      '- 85-89表示新手中的明显优秀表现；90-94表示明显超过普通初学者并基本具备校赛可用能力。',
      '- 95-97表示当前任务中非常成熟、接近优秀校队新人；98-100仅用于当前训练目标下近乎理想的完成。',
      '- 有明确观点和基本回应一般不低于70；完成当前环节主要任务一般在78以上；结构清楚、逻辑完整且攻防有效应达到88以上。',
      '- 表达不够专业、术语不规范或篇幅略长不能成为重扣理由；新手满分不代表全国冠军。',
      '- 不得按“校赛固定加10-15分”机械换算，必须根据新手训练目标下的实际缺陷严重程度评分。'
    ].join('\n');
  }

  if (difficulty === 'city') {
    return [
      '- 当前为市赛难度：面向较强校队成员和区市级比赛准备，更关注逻辑深度、临场稳定、证据质量与战场控制。',
      '- 30-49表示严重崩塌、无法有效交锋；50-64表示完成度较低，明显达不到市赛要求。',
      '- 65-74表示有基础能力但稳定性、深度或对抗强度不足；75-82表示普通市赛可用水平。',
      '- 83-88表示明显优秀的市赛表现；89-93表示高水平市赛或强校队表现。',
      '- 94-97表示极成熟中学生辩手表现；98-100仅用于当前训练任务下近乎理想的完成。',
      '- 市赛不是职业赛或全国总决赛标准；高质量完整表现不得被压在75-82，有成熟逻辑和明显战场控制时允许达到88-93。',
      '- 只有逻辑深度、对抗稳定性或例证质量存在实质不足时，才应明显低于同类校赛表现。',
      '- 不得按“校赛固定减10-15分”机械换算；同一份极优秀回答可在新手96-100、校赛92-96、市赛87-93之间自然分布。'
    ].join('\n');
  }

  return [
    '- 当前为校赛模式：作为主要基准评分，标准适中，关注完整论证、基本攻防、战场意识和表达清晰度。',
    '- 30-49仅用于严重答非所问、立场混乱、逻辑崩塌、大量无关内容或实质帮助对方论证。',
    '- 50-64表示零散表达、核心问题多次失守或缺少基本结构；65-74表示完成基本责任但核心能力明显薄弱。',
    '- 75-84表示普通校赛可用水平；85-89表示明显优秀的校赛表现。',
    '- 90-94表示高水平校队表现；95-97表示极优秀中学生表现；98-100仅用于当前任务下接近理想的答案。',
    '- 校赛90分不代表全国总决赛大师。不得仅因还可精炼或补充次要例证，就把高质量表现限制在80-85分。',
    '- 结构清楚且无重大失守不应低于75；完成明显概念切割、战场控制或有效反压时应允许进入88-93。',
    '- 不得根据新手或市赛分数做固定平移，必须根据当前校赛任务中的真实缺陷严重程度评分。',
    '- 评分保持区分度和教练感：先肯定具体亮点，再指出真正影响当前模式任务完成度的问题。'
  ].join('\n');
}
