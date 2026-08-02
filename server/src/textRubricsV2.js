export const TEXT_RUBRIC_VERSION = 'text_v2';
export const TEXT_RUBRIC_EFFECTIVE_DATE = '2026-08-01';

export const textScoreLevels = [
  { min: 95, max: 100, label: '卓越' },
  { min: 90, max: 94.999, label: '优秀' },
  { min: 80, max: 89.999, label: '良好' },
  { min: 70, max: 79.999, label: '合格可用' },
  { min: 60, max: 69.999, label: '基础成立' },
  { min: 50, max: 59.999, label: '明显不完整' },
  { min: 30, max: 49.999, label: '严重失效' }
];

const anchorBands = [
  ['0%-39%', '几乎没有完成'],
  ['40%-59%', '只完成少量'],
  ['60%-69%', '基本完成但有明显缺口的'],
  ['70%-79%', '较稳定地完成'],
  ['80%-89%', '高质量完成'],
  ['90%-94%', '高度完整且有控制力地完成'],
  ['95%-100%', '以极高严密度和少见洞察完成']
];

function anchors(task) {
  return anchorBands.map(([ratio, quality]) => ({
    ratio,
    description: `${quality}${task}。`
  }));
}

function dimensionAnchors(dimensions) {
  return Object.fromEntries(dimensions.map(({ name, anchorTask }) => [name, anchors(anchorTask)]));
}

const commonRanges = {
  '30-49 严重失效': [],
  '50-59 明显不完整': [],
  '60-69 基础成立': [],
  '70-79 合格可用': [],
  '80-89 良好': [],
  '90-94 优秀': [],
  '95-100 卓越': []
};

function makeRubric(config) {
  const dimensions = config.dimensions.map(({ name, maxScore }) => ({ name, maxScore }));
  return {
    ...config,
    rubricVersion: TEXT_RUBRIC_VERSION,
    effectiveDate: TEXT_RUBRIC_EFFECTIVE_DATE,
    usesDifficulty: false,
    scoreLevels: textScoreLevels,
    capRules: (config.capRules || []).map((rule) => ({
      ...rule,
      enforcement: rule.enforcement || (/原则上/.test(rule.description) ? 'advisory' : 'hard')
    })),
    dimensions,
    dimensionAnchors: dimensionAnchors(config.dimensions),
    ranges: Object.fromEntries(Object.entries(commonRanges).map(([range, value]) => [
      range,
      config.ranges[range] || value
    ]))
  };
}

export const textRubricsV2 = {
  constructive_speech: makeRubric({
    id: 'constructive_speech', appMode: 'constructive', displayName: '立论训练',
    coreGoal: '评价用户能否在比赛开始阶段建立一个可证明、可比较、可防守、可推进的完整辩论框架。',
    focus: ['准确承担举证责任', '建立必要且公平的定义与裁决框架', '形成严密论证链', '让论据真正支撑结论', '建立可攻防的核心战场'],
    dimensions: [
      { name: '辩题理解、立场与举证责任', maxScore: 15, anchorTask: '准确理解辩题、明确己方立场并承担核心举证责任' },
      { name: '定义、判准与裁决框架', maxScore: 20, anchorTask: '按辩题需要建立准确、稳定、可比较且不自利的定义与裁决框架' },
      { name: '论证结构与逻辑链条', maxScore: 30, anchorTask: '把前提、机制、结果和结论连成共同服务总立场的严密逻辑链' },
      { name: '论据支撑与现实适配', maxScore: 20, anchorTask: '用真实相关且有代表性的材料支撑论点并连接现实与抽象结论' },
      { name: '战场设计与表达完成度', maxScore: 15, anchorTask: '建立可推进、可防守且为后续攻防留有资源的战场，并清楚完整地适配立论时间' }
    ],
    ranges: {
      '30-49 严重失效': ['误解辩题、立场缺失或自相矛盾，核心论证无法成立，未完成基本立论任务。'],
      '50-59 明显不完整': ['能够表达部分观点，但举证责任、定义判准、论证结构或论据支撑存在大面积缺失。'],
      '60-69 基础成立': ['基本形成立场和论点框架，但逻辑链、现实支撑或战场设计仍存在明显短板。'],
      '70-79 合格可用': ['立场明确，主要论点基本成立，定义判准和论据能够支持常规比赛使用，但控制力有限。'],
      '80-89 良好': ['举证责任清楚，定义、判准、论点和论据形成较完整闭环，并建立可识别的核心战场。'],
      '90-94 优秀': ['框架成熟且具有控制力，裁决标准清楚，论证链严密，能够预判攻击并限制对方成立空间。'],
      '95-100 卓越': ['高度统一、严密且具有明显原创性或穿透力，几乎不存在实质性结构漏洞。']
    },
    capRules: [
      { code: 'wrong_or_missing_stance', maxScore: 49, description: '立场错误、立场缺失或根本误解辩题：最高49分。' },
      { code: 'claims_without_argument', maxScore: 59, description: '只有观点，没有有效论证过程：最高59分。' },
      { code: 'core_logic_invalid', maxScore: 69, description: '核心因果链或核心比较逻辑不成立：原则上最高69分。' },
      { code: 'irrelevant_evidence', maxScore: 69, description: '大量材料与结论无关，无法承担核心证明责任：原则上最高69分。' },
      { code: 'self_serving_framework', maxScore: 69, description: '定义或判准明显自利、循环，导致裁决框架失效：原则上最高69分。' }
    ],
    scoringPrinciples: ['缺少显式定义或判准不得自动封顶，先判断辩题是否确实需要。', '只有表达问题而逻辑内容完整时，只在对应维度扣分。', '第五维内部按战场设计10分、表达完成度5分理解。'],
    highScoreConditions: ['准确完成己方举证责任。', '定义和判准真实指导双方比较。', '主要论点形成完整逻辑闭环。', '论据与机制、结果和结论有真实支撑关系。', '建立可供后续攻防使用的核心战场。', '预判主要攻击并完成必要布防。'],
    outputFocus: '不得评价追问连续性；不得机械要求所有辩题都出现显式定义或判准；不得要求华丽语言、舞台感或煽情。',
    templateHint: '给出一段可直接用于一辩立论的结构模板。'
  }),
  cx_summary: makeRubric({
    id: 'cx_summary', appMode: 'summary', displayName: '攻辩小结',
    coreGoal: '评价用户能否忠实还原刚刚发生的攻辩，识别漏洞、结算局部战场，并把成果转化为本方全场资源。',
    focus: ['忠实提取交锋事实', '识别责任缺口', '完成局部胜负比较', '将成果接回本方主线', '凝练而有判断地表达'],
    dimensions: [
      { name: '交锋事实还原与关键材料提取', maxScore: 20, anchorTask: '忠实还原真实问答并准确提取承认、回避、矛盾和关键交锋材料' },
      { name: '核心漏洞识别与责任判定', maxScore: 25, anchorTask: '识别对方未完成的证明责任及前提、概念、因果或标准漏洞并说明理由' },
      { name: '战场结算与胜负比较', maxScore: 30, anchorTask: '说明本轮争点、双方责任完成度及其为何构成清楚的局部胜负' },
      { name: '攻防成果向本方主线转化', maxScore: 20, anchorTask: '把局部交锋接回本方论点、判准或裁决标准并形成后续可推进资源' },
      { name: '表达凝练与节奏控制', maxScore: 5, anchorTask: '用简洁、清楚、有判断且适配攻辩小结时间的结构完成表达' }
    ],
    ranges: {
      '30-49 严重失效': ['严重歪曲或虚构交锋事实，与真实问答明显相反，或者完全没有完成攻辩小结任务。'],
      '50-59 明显不完整': ['只能零散复述部分问答，缺少责任判断、漏洞识别和有效结算。'],
      '60-69 基础成立': ['能够提取主要交锋并指出部分问题，但事实、漏洞、结算或主线转化仍不完整。'],
      '70-79 合格可用': ['能够准确概括关键问答，基本判断双方责任和局部得失，并接回本方主线。'],
      '80-89 良好': ['能够把零散问答整理为清楚的胜负点，准确区分交锋事实与辩方解释，并形成有效战场转化。'],
      '90-94 优秀': ['高度准确地识别决定性交锋和责任缺口，完成清晰结算，并重新聚焦后续比赛的核心战场。'],
      '95-100 卓越': ['从有限攻辩中抓出决定胜负的核心矛盾，事实忠实、判断严密、结算凝练且具有显著战略转化价值。']
    },
    capRules: [
      { code: 'fabricated_exchange', maxScore: 49, description: '虚构或严重歪曲交锋事实：最高49分。' },
      { code: 'reversed_exchange_result', maxScore: 49, description: '小结结论与实际攻辩结果明显相反：最高49分。' },
      { code: 'no_real_exchange_material', maxScore: 59, description: '基本不使用真实攻辩材料：最高59分。' },
      { code: 'recap_without_settlement', maxScore: 64, description: '只有流水账式复述，没有责任判定或胜负结算：最高64分。' },
      { code: 'reconstructive_instead_of_summary', maxScore: 69, description: '主要内容变成重新立论而非总结本轮攻辩：原则上最高69分。' },
      { code: 'no_mainline_conversion', maxScore: 79, description: '能完成局部结算，但完全不能接回本方主线：原则上最高79分。' }
    ],
    scoringPrinciples: ['严格按“提取事实→判断漏洞→完成结算→转化主线”评分。', '同一句内容不得在多个维度重复计分。', '合理的有利解释可以得分，但不得冒充交锋事实。'],
    highScoreConditions: ['真实、准确使用本轮材料。', '指出对方未完成的核心证明责任。', '从零散问答提炼核心战场。', '完成双方责任和胜负结算。', '把局部成果接回本方立论、判准或后续策略。', '表达凝练、克制、有判断。'],
    outputFocus: '不得评价提问设计能力；不得要求压迫感；不得因表达克制、冷静而扣分。',
    templateHint: '给出一段可直接用于攻辩小结的结算模板。'
  }),
  closing_speech: makeRubric({
    id: 'closing_speech', appMode: 'closing', displayName: '结辩训练',
    coreGoal: '评价用户能否基于整场真实交锋，完成比赛还原、战场整合、双方比较、裁决指引和终局收束。',
    focus: ['吸收整场真实攻防', '整合少数核心战场', '比较双方责任和后果', '给出明确裁决标准', '完成终局收束'],
    dimensions: [
      { name: '交锋事实吸收与比赛还原', maxScore: 20, anchorTask: '准确吸收整场真实攻防、承认、失守、回应与关键争点并处理对方核心攻击' },
      { name: '核心战场整合', maxScore: 25, anchorTask: '把零散交锋整理为少数相互关联的核心战场并形成清楚比赛地图' },
      { name: '双方胜负比较与责任结算', maxScore: 25, anchorTask: '比较双方证明责任、现实后果和关键失误并说明己方为何赢、对方为何输' },
      { name: '裁决标准与价值收束', maxScore: 20, anchorTask: '以明确裁决标准统摄战场结算，并让价值与现实后果比较服务比赛结果' },
      { name: '终局表达与结构完成度', maxScore: 10, anchorTask: '以完整、适时且具有最终说服力的结构完成逻辑收束而不依赖煽情' }
    ],
    ranges: {
      '30-49 严重失效': ['严重歪曲比赛过程，未完成结辩任务，或者无法说明本场核心争点与己方获胜理由。'],
      '50-59 明显不完整': ['主要重复己方立论，几乎没有吸收真实交锋，也没有形成双方比较和裁决指引。'],
      '60-69 基础成立': ['能够回顾部分争点并作出初步比较，但战场整合、责任结算或价值收束存在明显缺失。'],
      '70-79 合格可用': ['能够整合主要攻防，完成基本双方比较，并向评委提供可用的裁决方向。'],
      '80-89 良好': ['准确吸收整场交锋，形成清楚的战场地图，双方比较和裁决标准较完整，价值收束服务于结算。'],
      '90-94 优秀': ['能够重新组织整场比赛，以清楚标准统一零散争点，处理对方核心攻击并形成有控制力的裁决指引。'],
      '95-100 卓越': ['技术战场、现实后果和价值判断高度统一，结算严密凝练，并显著重构评委对整场比赛的理解。']
    },
    capRules: [
      { code: 'fabricated_match', maxScore: 49, description: '严重虚构或歪曲本场交锋：最高49分。' },
      { code: 'no_real_match_exchange', maxScore: 59, description: '基本不使用本场真实交锋：最高59分。' },
      { code: 'repeats_constructive', maxScore: 64, description: '主要内容只是重复己方立论：最高64分。' },
      { code: 'no_two_sided_comparison', maxScore: 69, description: '没有双方比较，只总结己方观点：最高69分。' },
      { code: 'ignores_core_attack', maxScore: 74, description: '未处理对方最核心攻击：原则上最高74分。' },
      { code: 'no_decision_standard', maxScore: 79, description: '有战场总结但没有任何明确裁决标准：原则上最高79分。' }
    ],
    scoringPrinciples: ['严格按“比赛还原→战场整合→胜负比较→裁决与价值收束”评分。', '裁决标准优先，价值表达其次。', '价值表达脱离战场时不得为对应维度加分。', '不煽情、无名句或缺少舞台感不得触发封顶。'],
    highScoreConditions: ['准确吸收整场真实交锋。', '将零散争点整合为核心战场。', '完成双方责任和现实后果比较。', '明确告诉评委按什么标准裁决。', '正面处理对方最核心攻击。', '价值表达服务战场结算。', '语言有终局收束感但不依赖煽情。'],
    outputFocus: '不得套用攻辩或立论标准；不强制煽情、华丽语言、名句或舞台式感染力。',
    templateHint: '给出一段结辩终局收束模板。'
  })
};

export function isTextRubricMode(mode) {
  return ['constructive', 'constructive_speech', 'summary', 'cx_summary', 'closing', 'closing_speech'].includes(String(mode || '').trim());
}
