import { buildAbilityEstimate } from './abilityProfile.js';

const modeLabels = {
  constructive: '立论训练',
  summary: '攻辩小结',
  free_debate: '自由辩论',
  attack: '攻辩训练',
  defense: '防守训练',
  closing: '结辩训练'
};

const abilityTaskProfiles = {
  logic: {
    mode: 'constructive',
    tags: ['逻辑推进', '论证链条'],
    goal: '围绕一个核心判断，完成“定义—理由—结论”的完整论证链。'
  },
  defenseStability: {
    mode: 'defense',
    tags: ['防守稳定', '前提切割'],
    goal: '完成“正面回应一句、切前提一句、回到己方战场一句”。'
  },
  counterPressure: {
    mode: 'attack',
    tags: ['反压能力', '连续追问'],
    goal: '围绕一个核心漏洞连续追问3个问题，并完成一次明确结算。'
  },
  battlefieldControl: {
    mode: 'free_debate',
    tags: ['战场控制', '交锋结算'],
    goal: '在每轮回应中说明本轮争点，并把讨论拉回己方判断标准。'
  },
  expression: {
    mode: 'constructive',
    tags: ['表达效率', '明确落点'],
    goal: '在30秒内完成“观点—理由—落点”，避免没有结论的铺陈。'
  }
};

export function buildAbilityTaskRecommendations(members = [], records = []) {
  const profiles = buildAbilityMemberProfiles(members, records);
  const commonProblems = buildTeamAbilityWeaknesses(profiles);
  const scoredProfiles = profiles.filter((profile) => Number.isFinite(profile.abilityOverall));
  const teamOverall = scoredProfiles.length
    ? scoredProfiles.reduce((sum, profile) => sum + profile.abilityOverall, 0) / scoredProfiles.length
    : null;

  const teamRecommendations = commonProblems.slice(0, 3).map((problem, index) => {
    const taskProfile = getAbilityTaskProfile(problem.key);
    return buildTaskRecommendation({
      type: 'team_common',
      title: index === 0 ? `全队专项：${problem.label}` : `全队补强：${problem.label}`,
      assignmentType: 'all',
      targetMembers: 'all',
      mode: taskProfile.mode,
      difficulty: getDifficultyFromAbility(teamOverall),
      reason: `团队能力估测中「${problem.label}」为当前相对短板（均值 ${problem.score.toFixed(1)}，覆盖 ${problem.memberCount} 名成员）。`,
      goal: taskProfile.goal,
      tags: taskProfile.tags,
      abilityDimensionKey: problem.key,
      abilityScore: problem.score,
    });
  });

  const personalRecommendations = profiles
    .filter((profile) => profile.appUserId)
    .slice(0, 8)
    .map((profile) => {
      const weak = profile.weaknesses[0];
      if (!weak || weak.records < 2) {
        return {
          type: 'personalized',
          basis: 'ability_estimate',
          memberAppUserId: profile.appUserId,
          memberName: profile.nickname,
          insufficientData: true,
          reason: '该成员在对应能力维度上的有效训练证据少于2条，暂不生成个性化任务。'
        };
      }
      const taskProfile = getAbilityTaskProfile(weak.key);
      return {
        ...buildTaskRecommendation({
          type: 'personalized',
          title: `${profile.nickname}专项：${weak.label}`,
          assignmentType: 'selected',
          targetMembers: profile.nickname,
          mode: taskProfile.mode,
          difficulty: getDifficultyFromAbility(profile.abilityOverall),
          reason: `${profile.nickname} 的能力估测中「${weak.label}」相对偏弱（${weak.score.toFixed(1)}，有效记录 ${weak.records} 条）。`,
          goal: taskProfile.goal,
          tags: taskProfile.tags,
          abilityDimensionKey: weak.key,
          abilityScore: weak.score
        }),
        memberAppUserId: profile.appUserId,
        memberName: profile.nickname,
        assignedUserIds: [profile.appUserId]
      };
    });

  return {
    basis: 'ability_estimate',
    hasEnoughData: records.length >= 3 && scoredProfiles.length > 0,
    teamAbilityOverall: roundToOne(teamOverall),
    teamRecommendation: teamRecommendations[0] || null,
    teamRecommendations,
    personalRecommendations
  };
}

function buildAbilityMemberProfiles(members, records) {
  return members
    .filter((member) => member.status === 'active')
    .map((member) => {
      const memberId = member.app_user_id || member.local_user_id;
      const memberRecords = records.filter(
        (record) => (record.app_user_id || record.local_user_id) === memberId
      );
      const estimate = buildAbilityEstimate(memberRecords);
      const observed = estimate.dimensions
        .filter((dimension) => Number.isFinite(dimension.score))
        .sort((left, right) => left.score - right.score || left.key.localeCompare(right.key));
      return {
        appUserId: member.app_user_id || null,
        nickname: member.nickname || '未命名成员',
        abilityOverall: estimate.overall,
        weaknesses: observed,
        strengths: [...observed].reverse()
      };
    });
}

function buildTeamAbilityWeaknesses(profiles) {
  const buckets = new Map();
  profiles.forEach((profile) => {
    profile.weaknesses.forEach((dimension) => {
      const current = buckets.get(dimension.key) || { total: 0, memberCount: 0, label: dimension.label };
      current.total += dimension.score;
      current.memberCount += 1;
      buckets.set(dimension.key, current);
    });
  });
  return [...buckets.entries()]
    .map(([key, item]) => ({
      key,
      label: item.label,
      score: item.total / item.memberCount,
      memberCount: item.memberCount
    }))
    .sort((left, right) => left.score - right.score || right.memberCount - left.memberCount || left.key.localeCompare(right.key));
}

function getAbilityTaskProfile(key) {
  return abilityTaskProfiles[key] || abilityTaskProfiles.logic;
}

function getDifficultyFromAbility(overall) {
  // Temporary rule: recommendation difficulty must be recalibrated after the
  // ability-estimate scoring standard and cross-difficulty conversion are finalized.
  return Number.isFinite(overall) && overall >= 82 ? 'city' : 'campus';
}

function buildTaskRecommendation({ type, title, assignmentType, targetMembers, mode, difficulty, reason, goal, tags, abilityDimensionKey, abilityScore }) {
  return {
    type,
    basis: 'ability_estimate',
    title,
    targetMembers,
    mode,
    trainingMode: modeLabels[mode] || '训练复盘',
    difficulty,
    difficultyLabel: difficulty === 'city' ? '市赛' : '校赛',
    assignmentType,
    reason,
    goal,
    taskDescription: `${goal} 本任务重点不是追求一次高分，而是要求每轮都完成一个清楚、可检查的动作。`,
    recommendedReasonTags: [...new Set([...tags, modeLabels[mode]])].slice(0, 4),
    abilityDimensionKey,
    abilityScore: roundToOne(abilityScore),
    suggestedDeadline: '3天内'
  };
}

function roundToOne(value) {
  return Number.isFinite(value) ? Math.round(value * 10) / 10 : null;
}
