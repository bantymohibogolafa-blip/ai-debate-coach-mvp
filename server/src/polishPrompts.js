export const polishModeAliases = {
  constructive: 'constructive_speech',
  constructive_speech: 'constructive_speech',
  '立论训练': 'constructive_speech',
  summary: 'cx_summary',
  cx_summary: 'cx_summary',
  '攻辩小结': 'cx_summary',
  free_debate: 'free_debate',
  '自由辩论': 'free_debate',
  attack: 'offensive_cx',
  offensive_cx: 'offensive_cx',
  '攻辩训练': 'offensive_cx',
  defense: 'defensive_cx',
  defensive_cx: 'defensive_cx',
  '防守训练': 'defensive_cx',
  closing: 'closing_speech',
  closing_speech: 'closing_speech',
  '结辩训练': 'closing_speech'
};

export const polishPrompts = {
  constructive_speech: {
    displayName: '立论训练',
    defaultType: 'constructive_full',
    sharedGoal: [
      '用户正在整理一辩立论表达。',
      '目标是把原始表达整理成清晰、完整、可用于开局立论的结构。',
      '必须明确立场、定义关键概念、给出判准、展开核心论点、补足论据与例证，语言正式、清晰、有开场感。',
      '不要整理成质询问题、自由辩短句或单纯攻击句，不要省略论证链条。'
    ],
    types: {
      constructive_full: {
        label: '立论稿整理版',
        instruction: '整理成完整立论稿结构，包含【立场】【定义与判准】【核心论点一】【核心论点二】【论据与例证】【结论】。'
      },
      constructive_opening: {
        label: '简洁开篇版',
        instruction: '整理成简洁开篇表达，使用“我方认为……因为第一……第二……因此……”的节奏，适合开场快速建立框架。'
      },
      constructive_structure: {
        label: '结构化论点版',
        instruction: '整理成结构化论点清单，每个论点都要包含主张、理由和可使用的论据方向。'
      }
    }
  },
  cx_summary: {
    displayName: '攻辩小结',
    defaultType: 'cx_summary_full',
    sharedGoal: [
      '用户正在整理攻辩后的短小结。',
      '目标是把刚才攻辩中的交锋结果整理成战场结算。',
      '必须总结核心问题、指出对方没有完成的论证责任、说明己方拿下的战场，并接回己方主线。',
      '不要重新写成立论，不要脱离刚才攻辩内容，不要只复述问题。'
    ],
    types: {
      cx_summary_full: {
        label: '攻辩小结版',
        instruction: '整理成攻辩小结，包含【先结掉刚才的交锋】【对方暴露的问题】【我方拿下的战场】【回到本场核心】。'
      },
      cx_battlefield: {
        label: '战场结算版',
        instruction: '重点整理成战场归属判断，明确刚才哪一组交锋对己方有利、对方失守在哪里。'
      },
      cx_summary_15s: {
        label: '15秒压缩版',
        instruction: '压缩成15秒左右可直接说出的版本，句式参考“刚才这组攻辩已经说明……对方没有证明……因此这个战场应当归我方。”'
      }
    }
  },
  free_debate: {
    displayName: '自由辩论',
    defaultType: 'free_debate_quick',
    sharedGoal: [
      '用户正在整理自由辩论中的即时发言。',
      '目标是把原始想法整理成短、快、准的自由辩发言。',
      '必须直接回应对方，短句化，有反问或反压，能快速抢回战场。',
      '不要写成长篇立论、结辩升华或堆砌论据。'
    ],
    types: {
      free_debate_quick: {
        label: '自由辩快攻版',
        instruction: '整理成自由辩快攻发言，包含【短句回应】【反压追问】【战场拉回】。'
      },
      free_debate_counter: {
        label: '短句反击版',
        instruction: '整理成更短的反击句，重点指出对方偷换、遗漏或未证明之处。'
      },
      free_debate_followup: {
        label: '追问承接版',
        instruction: '整理成承接对方上一句话的追问，问题必须完整，能逼对方回应关键前提。'
      }
    }
  },
  offensive_cx: {
    displayName: '攻辩训练',
    defaultType: 'offensive_cx_question',
    sharedGoal: [
      '用户作为质询方，需要整理攻辩问题。',
      '目标是把想法整理成高压、连续、清晰的质询问题。',
      '问题要短，一次只问一个核心点，有追问链，能攻击对方定义、判准、论据或因果链。',
      '不要写成长篇陈词，不要一次塞多个问题，不要写成防守回应。'
    ],
    types: {
      offensive_cx_question: {
        label: '攻辩质询版',
        instruction: '整理成攻辩质询，包含【第一问】【追问一】【追问二】【锁定结论】。'
      },
      offensive_cx_chain: {
        label: '连续追问版',
        instruction: '整理成连续追问链，每一问都承接上一问，逐步逼近对方关键前提。'
      },
      offensive_cx_30s: {
        label: '30秒比赛版',
        instruction: '整理成30秒攻辩表达，句式参考“请问……？如果……，那你方是否承认……？如果不承认，请解释……”。'
      }
    }
  },
  defensive_cx: {
    displayName: '防守训练',
    defaultType: 'defensive_response',
    sharedGoal: [
      '用户作为被质询方，需要整理回应。',
      '目标是把原始回答整理成正面回应、概念切割、反压对方的防守表达。',
      '必须先正面回答，再切割对方预设，守住己方核心标准，必要时反压。',
      '不要写成质询问题为主，不要逃避问题，不要承认致命前提，不要空泛重复己方立场。'
    ],
    types: {
      defensive_response: {
        label: '防守回应版',
        instruction: '整理成防守回应，包含【正面回应】【概念切割】【守住标准】【反压一句】。'
      },
      defensive_cutback: {
        label: '切割反压版',
        instruction: '重点强化概念切割和反压，先拆掉对方问题预设，再把比较标准拉回己方。'
      },
      defensive_30s: {
        label: '30秒防守版',
        instruction: '整理成30秒防守表达，句式参考“我方并不承认这个预设。我们承认……但不代表……。今天真正要比较的是……”。'
      }
    }
  },
  closing_speech: {
    displayName: '结辩训练',
    defaultType: 'closing_full',
    sharedGoal: [
      '用户正在整理结辩。',
      '目标是把表达整理成比赛末端的总结陈词。',
      '必须整合全场战场、完成胜负比较、吸收攻防成果、明确评判标准并完成价值升华。',
      '不要重新写成立论，不要只复述己方论点，不要忽略对方攻击，不要写成自由辩短句。'
    ],
    types: {
      closing_full: {
        label: '结辩稿整理版',
        instruction: '整理成结辩稿，包含【本场核心争议】【我方赢下的战场】【对方没有完成的责任】【为什么应按我方标准裁决】【价值升华】。'
      },
      closing_battlefield: {
        label: '战场整合版',
        instruction: '重点整理全场战场和胜负比较，明确己方在哪些标准、论据或价值上更优。'
      },
      closing_value: {
        label: '价值升华版',
        instruction: '在保留战场结算的基础上强化价值升华，形成有终局感和说服力的结尾。'
      }
    }
  },
  general: {
    displayName: '通用辩论表达整理',
    defaultType: 'general_debate',
    sharedGoal: [
      '当前训练模式未识别，请进行通用辩论表达整理。',
      '目标是在不改变用户立场和原意的前提下，让表达更清晰、更有逻辑、更适合比赛发言。'
    ],
    types: {
      general_debate: {
        label: '通用辩论表达整理版',
        instruction: '整理成通用辩论表达，包含明确结论、核心理由、必要论据和一句收束。'
      }
    }
  }
};

export function normalizePolishMode(value) {
  return polishModeAliases[value] || polishModeAliases[String(value || '').trim()] || 'general';
}

export function getPolishProfile(mode) {
  return polishPrompts[normalizePolishMode(mode)] || polishPrompts.general;
}

export function getPolishTypeProfile(mode, type) {
  const profile = getPolishProfile(mode);
  const polishType = profile.types[type] ? type : profile.defaultType;
  return {
    profile,
    polishType,
    typeProfile: profile.types[polishType]
  };
}

export function getPolishOptions(mode) {
  const profile = getPolishProfile(mode);
  return Object.entries(profile.types).map(([id, option]) => ({
    id,
    label: option.label
  }));
}
