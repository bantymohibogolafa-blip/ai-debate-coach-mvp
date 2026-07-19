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
      '30-49 逻辑崩塌区': [
        '30-39：立论完全失效，无法理解辩题，立场混乱，定义和判准缺失，论点与辩题无关。',
        '40-49：勉强提出立场，但定义混乱、判准摇摆，论据多为感受或不可验证判断。'
      ],
      '50-69 基础及格区': [
        '50-59：有基本立场，但定义不清、判准模糊，论点松散，论据单薄。',
        '60-69：立论基本完整，有简单论点链条，但层次不足，战场设计较被动。'
      ],
      '70-79 标准竞技区': [
        '70-74：立场清楚，定义和判准基本成立，论据能支撑主要结论。',
        '75-79：结构自洽，能区分主辅论点，并预判部分对方攻击。'
      ],
      '80-89 优势压制区': [
        '80-84：能抢夺定义权、判准权或前提权，论据代表性较强。',
        '85-89：框架高效，有现实解释力，既正面证明己方也预埋限制对方的空间。'
      ],
      '90-100 大师致胜区': [
        '90-94：高水平校队立论，定义判准稳定、逻辑闭环，并能有效设计后续战场。',
        '95-100：极优秀中学生立论，框架成熟且几乎没有实质漏洞；98分以上仅用于接近当前任务理想答案。'
      ]
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
      '30-49 逻辑崩塌区': [
        '30-39：完全没有小结意识，只是重复立论、情绪宣泄或偏离刚才攻辩。',
        '40-49：能提到部分攻辩内容，但结算错误，误读交锋结果。'
      ],
      '50-69 基础及格区': [
        '50-59：能复述部分内容，但停留在流水账，缺少重要性判断。',
        '60-69：能指出对方部分不足，但结算不集中，容易变成简单回顾。'
      ],
      '70-79 标准竞技区': [
        '70-74：能总结关键交锋点，说明对方未完成的论证责任。',
        '75-79：小结有层次，能说明己方拿下的前提和后续推进。'
      ],
      '80-89 优势压制区': [
        '80-84：能把零散攻辩整合为清晰战场结算，转化为己方优势。',
        '85-89：能让评委感到对方在关键战场失守，并铺好后续路线。'
      ],
      '90-100 大师致胜区': [
        '90-94：高水平校队小结，准确结算关键交锋并把优势稳定接回本方主线。',
        '95-100：极优秀中学生小结，能提炼决定胜负的核心矛盾且几乎无实质遗漏。'
      ]
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
    coreGoal: '评价用户在快速、多轮、开放式交锋中的战场控制、临场反应、团队协同和攻守转换能力。',
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
      { name: '团队协同与战术意识', maxScore: 5 }
    ],
    ranges: {
      '30-49 逻辑崩塌区': [
        '30-39：发言混乱、答非所问或情绪攻击，甚至帮助对方推进论证。',
        '40-49：能发言但无有效交锋，只重复口号，不回应最新攻击。'
      ],
      '50-69 基础及格区': [
        '50-59：能参与但反应慢，只接表层问题，重点不清。',
        '60-69：能回应部分攻击并简单反驳，但经常追着枝节跑。'
      ],
      '70-79 标准竞技区': [
        '70-74：能接住常规攻击并回到己方主线，基本完成责任。',
        '75-79：知道哪些要接、切割或反打，多轮中主线不丢。'
      ],
      '80-89 优势压制区': [
        '80-84：能主动控制战场，通过短句、反问、结算形成节奏优势。',
        '85-89：能抓住对方临场漏洞扩大，使对方被迫回应己方问题。'
      ],
      '90-100 大师致胜区': [
        '90-94：高水平校队表现，多轮持续回应、反击并控制主要战场。',
        '95-100：极优秀中学生表现，攻守转换成熟且几乎没有实质失守。'
      ]
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
    outputFocus: '评价连续交锋和战场控制，不要按单次回答或单次质询评分。',
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
      '30-49 逻辑崩塌区': [
        '30-39：不会质询，问题与辩题无关或变成人身攻击。',
        '40-49：能提问但无实质攻击，问题空泛，不能形成追问链。'
      ],
      '50-69 基础及格区': [
        '50-59：能围绕辩题提问，但停留表层，缺少针对性。',
        '60-69：能抓住明显漏洞追问一到两层，但容易断线。'
      ],
      '70-79 标准竞技区': [
        '70-74：问题有明确攻击目标，能指出明显定义、例证或逻辑问题。',
        '75-79：追问有层次，能逼对方承认前提、暴露矛盾或承担代价。'
      ],
      '80-89 优势压制区': [
        '80-84：质询有压迫感，能抢夺定义权、前提权或标准权。',
        '85-89：精准打击核心架构，使对方在连续追问中明显失守。'
      ],
      '90-100 大师致胜区': [
        '90-94：高水平校队质询，问中核心并沿漏洞连续推进，形成有效锁定。',
        '95-100：极优秀中学生质询，追问链成熟且几乎没有无效或断裂环节。'
      ]
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
    outputFocus: '重点评价用户的主动质询能力，不要按被质询防守标准评价。',
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
      '30-49 逻辑崩塌区': [
        '30-39：彻底失守，答非所问或承认致命前提。',
        '40-49：无效防御，用口号和情绪代替回应，被连续追问后崩溃。'
      ],
      '50-69 基础及格区': [
        '50-59：能回应部分问题，但经常绕开核心，缺少切割。',
        '60-69：能正面回应普通质询，基本守住底线，但面对强攻容易退让。'
      ],
      '70-79 标准竞技区': [
        '70-74：能接住主要质询，回答有条理，能简单切割。',
        '75-79：防线较稳，能区分个例与整体、原则与例外、现象与因果。'
      ],
      '80-89 优势压制区': [
        '80-84：高压下仍稳定，能先处理预设再回应核心问题。',
        '85-89：能把质询转化为己方资源，指出对方标准不稳或预设错误。'
      ],
      '90-100 大师致胜区': [
        '90-94：高水平校队防守，多轮正面回应并持续守住标准，能完成切割和反压。',
        '95-100：极优秀中学生防守，高压下几乎没有实质失守，回应与反控均成熟。'
      ]
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
    outputFocus: '不能评价用户“问题问得不够好”，因为用户任务是防守而不是提问。',
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
      { name: '对攻防成果的吸收', maxScore: 21 },
      { name: '价值升华与判断标准', maxScore: 27 },
      { name: '逻辑收束与表达感染力', maxScore: 15 },
      { name: '时间控制与结构完整', maxScore: 5 }
    ],
    ranges: {
      '30-49 逻辑崩塌区': [
        '30-39：完全不是结辩，无法总结战场，也无法说明己方为何获胜。',
        '40-49：有结辩形式但没有实质总结，只重复立论，忽略已发生攻防。'
      ],
      '50-69 基础及格区': [
        '50-59：能简单总结己方观点，但缺乏胜负比较。',
        '60-69：能回顾主要论点并指出对方不足，但结构散，裁决指引不清。'
      ],
      '70-79 标准竞技区': [
        '70-74：能完成基本战场整合，说明双方争议和己方优势。',
        '75-79：能把前面攻防成果纳入总结，形成清晰胜负比较。'
      ],
      '80-89 优势压制区': [
        '80-84：能将零散交锋整合为清晰主线，指出对方论证责任缺失。',
        '85-89：既能结算技术战场，又能升到价值层面，完整且有感染力。'
      ],
      '90-100 大师致胜区': [
        '90-94：高水平校队结辩，完整整合战场、比较胜负并给出稳定裁决标准。',
        '95-100：极优秀中学生结辩，技术结算与价值收束成熟且几乎无实质遗漏。'
      ]
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
    outputFocus: '不能套用攻辩评分，重点评价战场整合、胜负比较和价值升华。',
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

校赛基准评分锚点（新手和市赛按下方难度规则调整）：
1. 这是中学生辩论训练产品的教练评分，不是全国总决赛或职业辩手评分；必须客观、有区分度，但不得过度压分。
2. 30-49：严重答非所问、立场混乱、逻辑崩塌、大量无关内容，或实质帮助对方论证。
3. 50-64：只能完成零散表达，核心问题多次失守，缺少基本结构和有效回应。
4. 65-74：完成基本训练责任，能回应一般问题，但逻辑、战场或论据明显薄弱。
5. 75-84：达到普通校赛可用水平，结构基本清楚，能完成正常攻防并有一定战场意识。
6. 85-89：明显优秀的校赛表现，逻辑完整、攻防有效，有明确概念切割或战场推进，只有若干次要问题。
7. 90-94：高水平校队表现，多轮持续守住或控制战场，能重构问题、稳定标准或完成反压，表达和逻辑明显高于普通中学生。
8. 95-97：极优秀中学生表现，接近高水平赛事成熟辩手，几乎没有实质漏洞。
9. 98-100：极少使用，接近当前训练任务下的理想答案，但不要求达到全国冠军或职业辩手标准。
10. 校赛 90 分代表在中学校赛训练者中表现明显优秀，不代表“全国总决赛大师”。
11. 不得因为还能继续压缩、还能补充例证或还能更完美，就把高质量表现限制在 80-85；存在次要改进空间不妨碍进入 90 分以上。
12. 高分首先取决于用户是否高质量完成“${rubric.coreGoal}”；只要核心任务完成度很高，就应允许各核心维度进入 90 分以上。

第五维专项校准（${fifthDimension.name}，仅占 ${fifthDimension.maxScore}%）：
1. 表达稍长不等于表达低效；内容较多但结构清楚、推进有效时，该维度不应低于80分。
2. 高压多轮中为完成概念切割和逻辑说明而适度展开，属于合理表达。
3. 90-95：清晰、稳定、基本高效，仅有少量可压缩空间。
4. 85-89：整体流畅，部分冗长但不影响理解和推进。
5. 78-84：有明显重复或篇幅偏长，但核心表达仍清楚。
6. 70-77：多处冗长、节奏拖沓，开始影响攻防效率。
7. 70以下：表达混乱、严重重复，难以识别核心回应。
8. “可以继续精炼”通常只是次要改进点，不得单独成为主要失分来源。

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
1. 不要输出 score 和 scoreLevel，最终总分与区间由后端根据五维权重生成。
2. dimensionScores 必须完整输出上方五个维度，名称保持一致；score 为 0-100 的一位小数，maxScore 固定为100。
3. battlefield 要概括本轮核心战场归属或胜负焦点。
4. reviewText 用自然语言说明本轮表现，必须先肯定一个具体亮点，再指出主要问题。
5. template 给出该环节可直接复用的表达模板。
`;
}

function buildDifficultyScoringInstruction(difficulty) {
  if (difficulty === 'novice') {
    return [
      '- 当前为新手模式：标准宽松，鼓励表达，整体评分应明显更友好。',
      '- 只要用户有基本观点、基本回应或基本结构，就应给到70分以上；除非完全答非所问、立场混乱或大量无关内容，不要低于60分。',
      '- 表现较完整时应给85-95分；明显优秀可以给95-100分。',
      '- 对表达不成熟、术语不规范和结构粗糙更宽容；同样表现应比校赛模式高约10-15分。',
      '- 复盘要先肯定一个真实优点，再给一条最关键的改进方向；不能无原则满分，但也不要用高阶比赛标准压新手。'
    ].join('\n');
  }

  if (difficulty === 'city') {
    return [
      '- 当前为市赛模式：标准较严，更关注论证深度、战场控制、例证质量、临场稳定和对抗强度。',
      '- 市赛模式不是全国冠军标准；它应更严格，但仍是训练型教练评分，必须保持客观、鼓励和可进步。',
      '- 完成基本责任应给65-72分；有清晰逻辑和较好攻防应给72-80分；表现优秀应给80-88分；高水平表现应给88-95分。',
      '- 同样表现应比校赛模式低约10-15分，但不得极端压分；只有严重失误才低于60分。',
      '- 如果用户表现完整，不要轻易低于70分；不要把高质量、接近成熟比赛水准的发言压到80分左右。'
    ].join('\n');
  }

  return [
    '- 当前为校赛模式：作为主要基准评分，标准适中，关注完整论证、基本攻防、战场意识和表达清晰度。',
    '- 30-49仅用于严重答非所问、立场混乱、逻辑崩塌、大量无关内容或实质帮助对方论证。',
    '- 50-64表示零散表达、核心问题多次失守或缺少基本结构；65-74表示完成基本责任但核心能力明显薄弱。',
    '- 75-84表示普通校赛可用水平；85-89表示明显优秀的校赛表现。',
    '- 90-94表示高水平校队表现；95-97表示极优秀中学生表现；98-100仅用于当前任务下接近理想的答案。',
    '- 校赛90分不代表全国总决赛大师。不得仅因还可精炼或补充次要例证，就把高质量表现限制在80-85分。',
    '- 评分保持区分度和教练感：先肯定具体亮点，再指出真正影响当前模式任务完成度的问题。'
  ].join('\n');
}
