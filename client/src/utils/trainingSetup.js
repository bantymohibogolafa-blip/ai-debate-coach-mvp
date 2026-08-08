export const trainingSetupSteps = ['topic', 'config', 'confirm'];

export function isMeaningfulTrainingTopic(value) {
  return /[\p{L}\p{N}]/u.test(String(value || '').trim());
}

export function validateTrainingSetup({ config, defensePrep = '', freeDebatePrep = '' }, target = 'confirm') {
  if (!isMeaningfulTrainingTopic(config?.topic)) {
    return { field: 'topic', message: '请输入包含有效文字或数字的辩题。' };
  }

  if (target === 'config') return null;
  if (!config?.userSide) return { field: 'userSide', message: '请选择你的立场。' };
  if (!config?.difficulty) return { field: 'difficulty', message: '请选择训练难度。' };
  if (!config?.trainingMode) return { field: 'trainingMode', message: '请选择训练模式。' };
  if (config.trainingMode === 'defense' && !String(defensePrep).trim()) {
    return { field: 'defensePrep', message: '请先填写己方分论点和论据。' };
  }
  if (config.trainingMode === 'free_debate' && !String(freeDebatePrep).trim()) {
    return { field: 'freeDebatePrep', message: '请至少填写一个自由辩论主要论点。' };
  }
  return null;
}

export function getTrainingStepAvailability(values) {
  const topicReady = !validateTrainingSetup(values, 'config');
  const configReady = !validateTrainingSetup(values, 'confirm');
  return { topic: true, config: topicReady, confirm: configReady };
}

export function getTrainingSnapshot({ config, defensePrep = '', freeDebatePrep = '' }) {
  return {
    topic: config.topic,
    userSide: config.userSide,
    difficulty: config.difficulty,
    celebrityDebater: config.celebrityDebater,
    trainingMode: config.trainingMode,
    rounds: config.rounds,
    defensePrep,
    freeDebatePrep
  };
}
