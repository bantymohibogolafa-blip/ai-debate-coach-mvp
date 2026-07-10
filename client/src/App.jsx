import { useEffect, useMemo, useRef, useState } from 'react';
import InstallPwaHint from './components/InstallPwaHint.jsx';
import OnboardingGuide from './components/OnboardingGuide.jsx';
import ReviewGeneratingCard from './components/ReviewGeneratingCard.jsx';
import { getAbilityVideosForDimension } from './data/abilityVideoMap.js';

const sides = [
  { label: '正方', value: 'affirmative' },
  { label: '反方', value: 'negative' }
];

const difficulties = [
  { label: '新手', value: 'novice' },
  { label: '校赛', value: 'campus' },
  { label: '市赛', value: 'city' }
];

const celebrityDebaters = [
  { label: '普通 AI', value: 'none', shortName: '普通 AI' },
  {
    label: '黄执中式：价值拆解与情绪洞察',
    value: 'huang_zhizhong_style',
    shortName: '黄执中式',
    description: '价值拆解与情绪洞察并重，擅长从动机、人性、情感成本和价值排序切入追问，适合价值辩、社会议题和需要训练表达温度的被质询训练。'
  },
  {
    label: '胡渐彪式：结构拆解与战场控制',
    value: 'hu_jianbiao_style',
    shortName: '胡渐彪式',
    description: '结构清晰、战场感强，擅长通过定义、标准、比较对象和逻辑层级控制攻防节奏，适合政策辩、机制辩和框架拆解训练。'
  },
  {
    label: '马薇薇式：强攻反击与语言压迫',
    value: 'ma_weiwei_style',
    shortName: '马薇薇式',
    description: '语言锋利、节奏紧凑、压迫感强，擅长抓回避、偷换概念和前后矛盾进行短促追问，适合临场反应和高压攻防训练。'
  },
  {
    label: '乔布斯式：本质判断与愿景压迫',
    value: 'steve_jobs_style',
    shortName: '乔布斯式',
    description: '极简直接、重视本质判断和长期价值，擅长把问题拉回用户体验、价值创造和愿景取舍，适合价值辩、科技议题和框架澄清训练。'
  },
  {
    label: '罗淼式：理性拆解与锋利质询',
    value: 'luo_miao_style',
    shortName: '罗淼式',
    description: '理性克制但质询锋利，擅长通过定义、前提、因果链和标准稳定性拆解对方论证，适合政策辩、事实辩和高压被质询训练。'
  }
];

const topicDirections = [
  { label: '校园教育', value: 'education' },
  { label: '科技生活', value: 'technology' },
  { label: '成长价值', value: 'growth' },
  { label: '社会伦理', value: 'ethics' },
  { label: '文化娱乐', value: 'culture' }
];

const topicPools = {
  education: [
    '中学生使用 AI 工具利大于弊',
    '高中阶段应不应该取消排名公示',
    '学校是否应该限制学生使用智能手机',
    '中学生参加竞赛是否利大于弊',
    '班级管理中严格纪律比自主空间更重要',
    '高中生是否应该被允许自主选择作业量',
    '学校是否应该允许学生把智能手机带入校园',
    '中学生更需要竞争教育还是合作教育',
    '学校教育更应该重视知识传授还是人格塑造',
    '中学生社团活动应不应该占用晚自习时间',
    '高中生职业规划教育应该提前开展',
    '课堂上使用平板电脑利大于弊',
    '老师应不应该公开表扬和批评学生',
    '中学生寒暑假补课利大于弊',
    '校园管理应以规则约束为主还是信任引导为主',
    '学生评价老师是否利大于弊',
    '中学生是否应该拥有更多自主安排时间',
    '家校群让教育沟通更高效还是更焦虑',
    '高中阶段分层教学利大于弊',
    '成绩排名能否真实反映学生成长',
    '学校是否应该设置无手机日'
  ],
  technology: [
    '短视频平台对中学生成长利大于弊',
    '人工智能会让年轻人更有创造力',
    '线上娱乐是否正在削弱青少年的现实社交能力',
    '算法推荐让人更自由还是更不自由',
    '电子阅读比纸质阅读更适合当代学生',
    '科技便利是否降低了人的独立思考能力',
    '生成式 AI 会增强还是削弱学生的学习能力',
    '社交媒体让人更接近真相还是更远离真相',
    '网络实名制利大于弊',
    '大数据时代人们更自由还是更不自由',
    '技术进步能否解决大多数社会问题',
    '智能设备让生活更高效还是更碎片化',
    '信息爆炸让人更博学还是更浅薄',
    '虚拟社交能否替代现实社交',
    '无人驾驶汽车应该优先保护乘客还是行人',
    'AI 写作工具应不应该进入校园',
    '人类应该更担心 AI 取代工作还是改变工作',
    '线上娱乐让年轻人的精神生活更丰富还是更贫乏',
    '互联网让公共讨论更理性还是更情绪化',
    '科技公司应该为用户沉迷承担更多责任',
    '数字遗产应不应该被继承'
  ],
  growth: [
    '得而复失比从未得到更遗憾',
    '年轻人更应该追求稳定还是可能性',
    '成长中挫折教育比鼓励教育更重要',
    '面对失败，接受现实比坚持到底更重要',
    '中学生应该更早接触社会竞争',
    '被误解是成长中必须付出的代价',
    '人生应是旷野还是轨道',
    '过程比结果更重要',
    '成功路上好伙伴比好对手更重要',
    '年轻人应该先学会妥协还是先学会坚持',
    '遗憾是否是青春的必修课',
    '亲密关系中坦诚比善意隐瞒更重要',
    '人更应该活成自己期待的样子还是社会需要的样子',
    '选择大于努力还是努力大于选择',
    '焦虑能否成为成长的动力',
    '年轻人更应该追求热爱还是责任',
    '经历失败会让人更强大还是更谨慎',
    '独处更能帮助人成长还是群体更能帮助人成长',
    '被看见比被理解更重要',
    '少年感是否值得被珍惜',
    '成大事者是否应该不拘小节'
  ],
  ethics: [
    '善意的谎言是否应该被接受',
    '公共利益是否应优先于个人选择',
    '犯错后弥补比道歉更重要',
    '规则公平比结果公平更重要',
    '评价一个人更应该看动机还是结果',
    '多数人的安全能否成为限制少数人自由的理由',
    '人性本善还是人性本恶',
    '沉默比愚昧更可怕还是愚昧比沉默更可怕',
    '法律与人情是否相悖',
    '相信需不需要证明',
    '以成败论英雄是否可取',
    '救猫还是救画',
    '当代社会更需要宽容还是更需要原则',
    '牺牲少数人的利益能否换取多数人的幸福',
    '迟到的正义是否还是正义',
    '网络舆论能不能提升公共理性',
    '个人隐私应不应该让位于公共安全',
    '道德评价应不应该考虑时代背景',
    '善良是否需要锋芒',
    '公平和效率何者更应优先',
    '宽恕是否比惩罚更能解决问题'
  ],
  culture: [
    '中学生不应该玩游戏',
    '追星对青少年成长利大于弊',
    '网络热梗让表达更丰富还是更贫乏',
    '流行文化比经典文化更能影响年轻人',
    '综艺节目是否降低了大众审美',
    '校园活动中竞技性比参与感更重要',
    '经典电影重新上线是电影市场繁荣的体现',
    '严肃表达在当代更应该被提倡',
    '流量能否代表作品价值',
    '短视频让文化传播更大众还是更浅薄',
    '传统文化年轻化表达利大于弊',
    '二次元文化对青少年成长利大于弊',
    '公众人物是否应该承担更高道德责任',
    '网络文学更应该追求市场还是文学价值',
    '博物馆文创让传统文化更有生命力',
    '方言保护应不应该进入校园教育',
    '偶像塌房后作品是否还值得被观看',
    '弹幕文化让观看体验更好还是更差',
    '影视改编应更尊重原著还是更尊重创新',
    '体育明星偶像化利大于弊',
    '年轻人更应该拥抱国潮还是保持全球视野'
  ]
};

const roundOptions = [3, 5];

const trainingModes = [
  {
    label: '立论训练',
    value: 'constructive',
    rounds: 1,
    description: '一辩立论，AI 只给对立面观点，发言后再复盘。'
  },
  {
    label: '攻辩小结',
    value: 'summary',
    rounds: 1,
    description: 'AI 只给场上交锋点和对方论点，用户自主小结。'
  },
  {
    label: '自由辩论',
    value: 'free_debate',
    rounds: 3,
    description: '双方可回应、推进并提问，发言短促，可选择3轮或5轮。'
  },
  {
    label: '攻辩训练',
    value: 'attack',
    rounds: 3,
    description: '用户只攻不防，AI 只能防守，可选择3轮或5轮。'
  },
  {
    label: '防守训练',
    value: 'defense',
    rounds: 3,
    description: 'AI 只攻，用户只能防守，可选择3轮或5轮。'
  },
  {
    label: '结辩训练',
    value: 'closing',
    rounds: 1,
    description: 'AI 只给对立面关键交锋点，结辩后再评分分析。'
  }
];

const trainingModeVenueNames = {
  constructive: '立论训练场',
  summary: '攻辩小结训练场',
  free_debate: '自由辩论训练场',
  attack: '攻辩训练场',
  defense: '防守训练场',
  closing: '结辩训练场'
};

const polishOptionsByMode = {
  constructive: [
    { id: 'constructive_full', label: '立论稿整理版' },
    { id: 'constructive_opening', label: '简洁开篇版' },
    { id: 'constructive_structure', label: '结构化论点版' }
  ],
  summary: [
    { id: 'cx_summary_full', label: '攻辩小结版' },
    { id: 'cx_battlefield', label: '战场结算版' },
    { id: 'cx_summary_15s', label: '15秒压缩版' }
  ],
  free_debate: [
    { id: 'free_debate_quick', label: '自由辩快攻版' },
    { id: 'free_debate_counter', label: '短句反击版' },
    { id: 'free_debate_followup', label: '追问承接版' }
  ],
  attack: [
    { id: 'offensive_cx_question', label: '攻辩质询版' },
    { id: 'offensive_cx_chain', label: '连续追问版' },
    { id: 'offensive_cx_30s', label: '30秒比赛版' }
  ],
  defense: [
    { id: 'defensive_response', label: '防守回应版' },
    { id: 'defensive_cutback', label: '切割反压版' },
    { id: 'defensive_30s', label: '30秒防守版' }
  ],
  closing: [
    { id: 'closing_full', label: '结辩稿整理版' },
    { id: 'closing_battlefield', label: '战场整合版' },
    { id: 'closing_value', label: '价值升华版' }
  ],
  general: [
    { id: 'general_debate', label: '通用辩论表达整理版' }
  ]
};

const initialConfig = {
  topic: '',
  userSide: '',
  difficulty: 'novice',
  celebrityDebater: 'none',
  trainingMode: '',
  rounds: 3
};

const defaultTaskForm = {
  title: '',
  topic: '',
  userSide: 'affirmative',
  mode: 'free_debate',
  difficulty: 'novice',
  styleId: 'none',
  requiredCount: 1,
  deadline: '',
  description: '',
  assignmentType: 'all',
  assignedUserIds: []
};

const abilityDimensionMeta = [
  { key: 'overall', label: '综合锋力', color: '#c8502d' },
  { key: 'logic', label: '逻辑推进', color: '#2d7f7a' },
  { key: 'evidence', label: '例证支撑', color: '#415f9d' },
  { key: 'defenseStability', label: '防守稳定', color: '#6e5aa8' },
  { key: 'counterPressure', label: '反压能力', color: '#9c4f24' },
  { key: 'battlefieldControl', label: '战场控制', color: '#9b3f58' },
  { key: 'expression', label: '表达效率', color: '#4b7280' }
];

const teamCodeStorageKey = 'ai-debate-coach-team-code';
const localUserIdStorageKey = 'ai-debate-coach-local-user-id';
const appModeStorageKey = 'ai-debate-coach-app-mode';
const selectedSpaceStorageKey = 'ai-debate-coach-selected-space';
const authTokenStorageKey = 'fengbian-auth-token';
const authUserStorageKey = 'fengbian-auth-user';
const onboardingStorageKey = 'fengbian_onboarding_seen';
const pwaHintStorageKey = 'fengbian_pwa_hint_dismissed';
const trainingRecordLimit = 20;
const defaultRecordFilters = { mode: 'all', sortBy: 'date', timeRange: 'all' };
const defaultRecordPage = { offset: 0, hasMore: false, isLoadingMore: false };
const personalNickname = '个人用户';
const personalSpace = { type: 'personal', teamCode: '' };
const roundSelectionModes = ['free_debate', 'attack', 'defense'];
const longOutputModes = ['constructive', 'summary', 'closing'];
const recordingLimitHint = '单次录音不要超过30秒';

function App() {
  const [config, setConfig] = useState(initialConfig);
  const [history, setHistory] = useState([]);
  const [localUserId, setLocalUserId] = useState('');
  const [authToken, setAuthToken] = useState(() => localStorage.getItem(authTokenStorageKey) || '');
  const [currentUser, setCurrentUser] = useState(() => parseStoredAuthUser());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ username: '', password: '', displayName: '', confirmPassword: '' });
  const [authError, setAuthError] = useState('');
  const [authStatus, setAuthStatus] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [currentSpace, setCurrentSpace] = useState(personalSpace);
  const [joinedTeams, setJoinedTeams] = useState([]);
  const [joinForm, setJoinForm] = useState({ teamCode: '', teamName: '', teamPassword: '', nickname: '' });
  const [teamFormMode, setTeamFormMode] = useState('join');
  const [joinError, setJoinError] = useState('');
  const [joinSuccess, setJoinSuccess] = useState('');
  const [joinedTeamPrompt, setJoinedTeamPrompt] = useState(null);
  const [isJoiningTeam, setIsJoiningTeam] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isJoinPasswordVisible, setIsJoinPasswordVisible] = useState(false);
  const [isTeamsLoading, setIsTeamsLoading] = useState(false);
  const [leaveTarget, setLeaveTarget] = useState(null);
  const [leaveError, setLeaveError] = useState('');
  const [isLeavingTeam, setIsLeavingTeam] = useState(false);
  const [memberModalTeam, setMemberModalTeam] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [teamMembersRequester, setTeamMembersRequester] = useState(null);
  const [isMembersLoading, setIsMembersLoading] = useState(false);
  const [memberActionError, setMemberActionError] = useState('');
  const [memberActionStatus, setMemberActionStatus] = useState('');
  const [activeMemberActionId, setActiveMemberActionId] = useState('');
  const [teamSettingsForm, setTeamSettingsForm] = useState({ teamName: '', currentPassword: '', nextPassword: '' });
  const [isCurrentTeamPasswordVisible, setIsCurrentTeamPasswordVisible] = useState(false);
  const [isNextTeamPasswordVisible, setIsNextTeamPasswordVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('training');
  const [isFunctionPanelOpen, setIsFunctionPanelOpen] = useState(false);
  const [personalRecords, setPersonalRecords] = useState([]);
  const [teamMemberRecords, setTeamMemberRecords] = useState([]);
  const [teamRecords, setTeamRecords] = useState([]);
  const [myRecordFilters, setMyRecordFilters] = useState(defaultRecordFilters);
  const [teamRecordFilters, setTeamRecordFilters] = useState(defaultRecordFilters);
  const [personalRecordsPage, setPersonalRecordsPage] = useState(defaultRecordPage);
  const [teamMemberRecordsPage, setTeamMemberRecordsPage] = useState(defaultRecordPage);
  const [teamRecordsPage, setTeamRecordsPage] = useState(defaultRecordPage);
  const [teamStats, setTeamStats] = useState(null);
  const [teamTasks, setTeamTasks] = useState([]);
  const [teamTasksError, setTeamTasksError] = useState('');
  const [isTeamTasksLoading, setIsTeamTasksLoading] = useState(false);
  const [activeTeamPanelTab, setActiveTeamPanelTab] = useState('overview');
  const [personalAbilityEstimate, setPersonalAbilityEstimate] = useState(null);
  const [teamAbilityEstimate, setTeamAbilityEstimate] = useState(null);
  const [isAbilityLoading, setIsAbilityLoading] = useState(false);
  const [abilityError, setAbilityError] = useState('');
  const [isTaskCreateOpen, setIsTaskCreateOpen] = useState(false);
  const [taskForm, setTaskForm] = useState(defaultTaskForm);
  const [taskActionError, setTaskActionError] = useState('');
  const [taskActionStatus, setTaskActionStatus] = useState('');
  const [isTaskActionLoading, setIsTaskActionLoading] = useState(false);
  const [selectedTaskDetail, setSelectedTaskDetail] = useState(null);
  const [isTaskDetailLoading, setIsTaskDetailLoading] = useState(false);
  const [taskDetailError, setTaskDetailError] = useState('');
  const [activeTaskSession, setActiveTaskSession] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isTeamDataLoading, setIsTeamDataLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [teamDataError, setTeamDataError] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  const [answer, setAnswer] = useState('');
  const [review, setReview] = useState('');
  const [structuredReview, setStructuredReview] = useState(null);
  const [isTraining, setIsTraining] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewGenerationStatus, setReviewGenerationStatus] = useState('idle');
  const [reviewLoadingError, setReviewLoadingError] = useState('');
  const [error, setError] = useState('');
  const [setupStep, setSetupStep] = useState('topic');
  const [longOutputPromptMode, setLongOutputPromptMode] = useState('');
  const [topicDirection, setTopicDirection] = useState('education');
  const [generatedTopics, setGeneratedTopics] = useState([]);
  const [recentGeneratedTopics, setRecentGeneratedTopics] = useState({});
  const [defensePrep, setDefensePrep] = useState('');
  const [freeDebatePrep, setFreeDebatePrep] = useState('');
  const [trainingSession, setTrainingSession] = useState(null);
  const [isPolishing, setIsPolishing] = useState(false);
  const [polishResult, setPolishResult] = useState(null);
  const [selectedPolishType, setSelectedPolishType] = useState('');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showPwaHint, setShowPwaHint] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingError, setRecordingError] = useState('');
  const [recordingStatus, setRecordingStatus] = useState('');
  const [recordedAudioUrl, setRecordedAudioUrl] = useState('');
  const recordingStreamRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const recordingStartedAtRef = useRef(0);
  const audioContextRef = useRef(null);
  const audioSourceRef = useRef(null);
  const audioProcessorRef = useRef(null);
  const recordingPcmChunksRef = useRef([]);
  const recordingInputSampleRateRef = useRef(48000);

  const userAnswers = useMemo(
    () => history.filter((item) => item.role === 'user').length,
    [history]
  );
  const isFinished = isTraining && userAnswers >= config.rounds;
  const currentRound = Math.min(userAnswers + 1, config.rounds);
  const isCelebrityMode = config.celebrityDebater !== 'none';
  const selectedSideLabel = getOptionLabel(sides, config.userSide) || '待选择';
  const opponentSideLabel = config.userSide
    ? config.userSide === 'affirmative'
      ? '反方'
      : '正方'
    : '待定';
  const selectedDebater = celebrityDebaters.find((item) => item.value === config.celebrityDebater);
  const selectedTrainingMode = trainingModes.find((item) => item.value === config.trainingMode);
  const currentPolishOptions = polishOptionsByMode[config.trainingMode] || polishOptionsByMode.general;
  const activePolishType = currentPolishOptions.some((option) => option.id === selectedPolishType)
    ? selectedPolishType
    : currentPolishOptions[0].id;
  const heroTitle = `锋辩——${trainingModeVenueNames[config.trainingMode] || '训练准备'}`;
  const isSingleSpeechMode = longOutputModes.includes(config.trainingMode);
  const isAttackMode = config.trainingMode === 'attack';
  const needsRoundSelection = roundSelectionModes.includes(config.trainingMode);
  const selectedDifficultyLabel = isCelebrityMode
    ? `市赛 · ${selectedDebater?.shortName || '明星辩手'}`
    : getOptionLabel(difficulties, config.difficulty);
  const latestAiMessage = useMemo(() => getLatestMessage(history, 'ai'), [history]);
  const isBusy = isLoading || isReviewing || isPolishing || isTranscribing;
  const hasSessionContent = isTraining || history.length > 0 || Boolean(review);
  const isLoggedIn = Boolean(authToken && currentUser?.id);
  const currentTeam = currentSpace.type === 'team'
    ? joinedTeams.find((team) => team.teamCode === currentSpace.teamCode)
    : null;
  const isTeamSpace = Boolean(currentTeam);
  const currentSpaceLabel = isTeamSpace ? (currentTeam.teamName || currentTeam.teamCode) : '个人模式';
  const currentNickname = isTeamSpace ? currentTeam.nickname : (currentUser?.displayName || personalNickname);
  const currentSpaceValue = isTeamSpace ? `team:${currentTeam.teamCode}` : 'personal';
  const displayedRecords = isTeamSpace ? teamMemberRecords : personalRecords;
  const displayedRecordsPage = isTeamSpace ? teamMemberRecordsPage : personalRecordsPage;
  const displayedAbilityEstimate = isTeamSpace ? teamAbilityEstimate : personalAbilityEstimate;
  const linWanTrainingProfile = useMemo(
    () => buildUserTrainingProfile(displayedRecords),
    [displayedRecords]
  );
  const taskAssignableMembers = teamMembers.filter((member) => member.status === 'active' && member.appUserId);
  const myRecordsScopeLabel = isTeamSpace
    ? `当前查看：我在【${currentTeam.teamName || currentTeam.teamCode}】中的训练记录`
    : '当前查看：个人训练记录';
  const emptyRecordsMessage = isTeamSpace
    ? '你在当前团队中暂无训练记录，完成一次团队训练后会显示在这里。'
    : '暂无个人训练记录，完成一次个人训练后会显示在这里。';
  const abilityScopeLabel = isTeamSpace
    ? `当前能力估测基于：我在【${currentTeam.teamName || currentTeam.teamCode}】中的训练记录`
    : '当前能力估测基于：个人训练记录';
  const emptyAbilityMessage = isTeamSpace
    ? '你在当前团队中暂无训练记录，完成一次团队训练后即可生成团队空间下的个人能力估测。'
    : '暂无个人训练记录，完成训练后即可生成能力估测。';
  const maxRecordingSeconds = 30;

  useEffect(() => {
    const storedLocalUserId = getOrCreateLocalUserId();
    const preferredSpace = parseStoredSpace();

    setLocalUserId(storedLocalUserId);
    if (authToken) {
      verifyAuthSession(preferredSpace.type === 'team' ? preferredSpace.teamCode : '');
    } else {
      setCurrentTrainingSpace(personalSpace);
    }
  }, []);

  useEffect(() => {
    if (localStorage.getItem(onboardingStorageKey) === 'true') {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setShowOnboarding(true);
    }, 500);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (showOnboarding || localStorage.getItem(pwaHintStorageKey) === 'true') {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setShowPwaHint(true);
    }, 800);

    return () => window.clearTimeout(timer);
  }, [showOnboarding]);

  useEffect(() => {
    if (!localUserId) return;

    if (currentSpace.type !== 'personal' && !isTeamSpace) {
      setCurrentTrainingSpace(personalSpace);
      return;
    }

    if (isTeamSpace) {
      loadTeamDashboard(currentTeam.teamCode, localUserId);
      loadMyTrainingRecords({ spaceType: 'team', teamCode: currentTeam.teamCode, userId: localUserId });
      loadAbilityEstimate({ spaceType: 'team', teamCode: currentTeam.teamCode, userId: localUserId });
      return;
    }

    loadMyTrainingRecords({ spaceType: 'personal', userId: localUserId });
    loadAbilityEstimate({ spaceType: 'personal', userId: localUserId });
  }, [currentSpace.type, currentSpace.teamCode, isTeamSpace, localUserId, authToken, currentUser?.id, myRecordFilters, teamRecordFilters]);

  useEffect(() => {
    if (!localUserId) return;

    if (activeTab === 'mine') {
      if (isTeamSpace) {
        loadMyTrainingRecords({ spaceType: 'team', teamCode: currentTeam.teamCode, userId: localUserId });
      } else {
        loadMyTrainingRecords({ spaceType: 'personal', userId: localUserId });
      }
    }

    if (activeTab === 'ability') {
      if (isTeamSpace) {
        loadAbilityEstimate({ spaceType: 'team', teamCode: currentTeam.teamCode, userId: localUserId });
      } else {
        loadAbilityEstimate({ spaceType: 'personal', userId: localUserId });
      }
    }

    if (activeTab === 'team' && isTeamSpace) {
      loadTeamData(currentTeam.teamCode, localUserId);
      loadTeamTasks(currentTeam.teamCode, localUserId);
    }
  }, [activeTab, isTeamSpace, currentSpace.teamCode, localUserId, authToken, currentUser?.id, myRecordFilters, teamRecordFilters]);

  useEffect(() => {
    if (currentSpace.type === 'personal' && activeTab === 'team') {
      setActiveTab('training');
      setSelectedRecord(null);
    }
    if (currentSpace.type === 'personal') {
      setActiveTaskSession(null);
    } else if (activeTaskSession?.teamCode && activeTaskSession.teamCode !== currentSpace.teamCode) {
      setActiveTaskSession(null);
    }
  }, [currentSpace.type, currentSpace.teamCode, activeTab, activeTaskSession?.teamCode]);

  useEffect(() => {
    return () => {
      stopRecordingResources(false);
    };
  }, []);

  async function verifyAuthSession(preferredTeamCode = '') {
    try {
      const data = await getJson('/api/auth/me');
      applyAuthSession({ token: localStorage.getItem(authTokenStorageKey) || authToken, user: data.user }, '');
      await loadJoinedTeams(localUserId || getOrCreateLocalUserId(), preferredTeamCode);
    } catch {
      clearAuthSession('登录状态已过期，请重新登录。');
    }
  }

  function applyAuthSession({ token, user }, statusMessage) {
    localStorage.setItem(authTokenStorageKey, token);
    localStorage.setItem(authUserStorageKey, JSON.stringify(user));
    setAuthToken(token);
    setCurrentUser(user);
    setAuthStatus(statusMessage);
    setAuthError('');
  }

  function clearAuthSession(statusMessage = '') {
    localStorage.removeItem(authTokenStorageKey);
    localStorage.removeItem(authUserStorageKey);
    setAuthToken('');
    setCurrentUser(null);
    setJoinedTeams([]);
    setPersonalRecords([]);
    setTeamMemberRecords([]);
    setTeamRecords([]);
    setPersonalRecordsPage(defaultRecordPage);
    setTeamMemberRecordsPage(defaultRecordPage);
    setTeamRecordsPage(defaultRecordPage);
    setTeamStats(null);
    setTeamTasks([]);
    setPersonalAbilityEstimate(null);
    setTeamAbilityEstimate(null);
    setCurrentTrainingSpace(personalSpace);
    setActiveTab('training');
    setAuthStatus(statusMessage);
  }

  function requestLogin(message = '该功能需要登录后使用。登录后可跨设备保存团队身份和任务进度。') {
    setAuthStatus('');
    setAuthError(message);
    setAuthMode('login');
    setIsAuthModalOpen(true);
  }

  async function submitAuth(event) {
    event.preventDefault();
    if (isAuthLoading) return;

    const username = authForm.username.trim();
    const password = authForm.password;
    const displayName = authForm.displayName.trim();
    const confirmPassword = authForm.confirmPassword;

    if (authMode === 'register') {
      const validationMessage = validateRegisterInput(username, displayName, password, confirmPassword);
      if (validationMessage) {
        setAuthError(validationMessage);
        return;
      }
    } else if (!username || !password) {
      setAuthError('账号或密码错误。');
      return;
    }

    setIsAuthLoading(true);
    setAuthError('');

    try {
      const endpoint = authMode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const payload = authMode === 'register'
        ? { username, password, displayName }
        : { username, password };
      const data = await postJson(endpoint, payload);
      applyAuthSession(data, authMode === 'register' ? '注册成功。' : '登录成功。');
      setAuthForm({ username: '', password: '', displayName: '', confirmPassword: '' });
      setIsAuthModalOpen(false);
      await loadJoinedTeams(localUserId || getOrCreateLocalUserId(), '');
      await loadMyTrainingRecords({ spaceType: 'personal', userId: localUserId || getOrCreateLocalUserId() });
      await loadAbilityEstimate({ spaceType: 'personal', userId: localUserId || getOrCreateLocalUserId() });
    } catch (requestError) {
      setAuthError(getFriendlyError(requestError));
    } finally {
      setIsAuthLoading(false);
    }
  }

  function logout() {
    clearAuthSession('已退出登录，当前切换为游客模式。');
  }

  async function joinTeam(event) {
    event.preventDefault();
    if (isJoiningTeam) return;

    if (!isLoggedIn) {
      requestLogin();
      return;
    }

    const nextTeamCode = normalizeTeamCode(joinForm.teamCode);
    const nextTeamName = joinForm.teamName.trim();
    const nextNickname = joinForm.nickname.trim();
    const nextTeamPassword = joinForm.teamPassword.trim();
    const validationMessage = validateTeamJoinInput(nextTeamCode, nextTeamPassword, nextNickname, teamFormMode === 'create' ? nextTeamName : null);

    if (validationMessage) {
      setJoinError(validationMessage);
      return;
    }

    const nextLocalUserId = localUserId || getOrCreateLocalUserId();
    setIsJoiningTeam(true);
    setJoinError('');
    setJoinSuccess('');

    try {
      const endpoint = teamFormMode === 'create' ? '/api/team/create' : '/api/team/join';
      const payload = {
        teamCode: nextTeamCode,
        teamPassword: nextTeamPassword,
        nickname: nextNickname,
        localUserId: nextLocalUserId
      };
      if (teamFormMode === 'create') {
        payload.teamName = nextTeamName;
      }
      const data = await postJson(endpoint, payload);

      localStorage.setItem(localUserIdStorageKey, nextLocalUserId);
      setLocalUserId(nextLocalUserId);
      const nextTeams = Array.isArray(data.teams) ? data.teams : [];
      setJoinedTeams(nextTeams);
      const joinedTeam = nextTeams.find((team) => team.teamCode === nextTeamCode);
      if (joinedTeam) {
        setJoinedTeamPrompt(joinedTeam);
        setJoinSuccess(`已加入团队：${joinedTeam.teamName || joinedTeam.teamCode}`);
      } else {
        setJoinedTeamPrompt({ teamCode: nextTeamCode, teamName: nextTeamCode });
        setJoinSuccess(`已加入团队：${nextTeamCode}`);
      }
      setJoinForm({ teamCode: '', teamName: '', teamPassword: '', nickname: nextNickname });
    } catch (requestError) {
      const friendlyMessage = getFriendlyError(requestError);
      setJoinError(friendlyMessage.includes('历史记录') || friendlyMessage.includes('AI ')
        ? '加入团队失败，请确认团队码、团队密码和数据库角色迁移已完成。'
        : friendlyMessage);
    } finally {
      setIsJoiningTeam(false);
    }
  }

  async function loadJoinedTeams(userId, preferredTeamCode = '') {
    if (!localStorage.getItem(authTokenStorageKey)) {
      setJoinedTeams([]);
      setCurrentTrainingSpace(personalSpace);
      return;
    }

    setIsTeamsLoading(true);
    try {
      const data = await getJson(`/api/teams/my?localUserId=${encodeURIComponent(userId)}`);
      const teams = Array.isArray(data.teams) ? data.teams : [];
      setJoinedTeams(teams);

      const restoredTeamCode = normalizeTeamCode(preferredTeamCode);
      const restoredTeam = teams.find((team) => team.teamCode === restoredTeamCode);
      if (restoredTeam) {
        setCurrentTrainingSpace({ type: 'team', teamCode: restoredTeam.teamCode });
      } else {
        setCurrentTrainingSpace(personalSpace);
      }
    } catch (requestError) {
      setJoinedTeams([]);
      setCurrentTrainingSpace(personalSpace);
    } finally {
      setIsTeamsLoading(false);
    }
  }

  function setCurrentTrainingSpace(space) {
    const nextSpace = space?.type === 'team' && space.teamCode
      ? { type: 'team', teamCode: normalizeTeamCode(space.teamCode) }
      : personalSpace;

    setCurrentSpace(nextSpace);
    localStorage.setItem(selectedSpaceStorageKey, stringifySpace(nextSpace));
    setSelectedRecord(null);
    setSaveStatus('');
    setHistoryError('');
    setTeamDataError('');
  }

  function selectTrainingSpace(value) {
    if (isBusy || isRecording) return;

    if (value === 'join') {
      if (!isLoggedIn) {
        requestLogin();
        return;
      }
      setJoinError('');
      setJoinSuccess('');
      setJoinedTeamPrompt(null);
      setTeamFormMode('join');
      setIsJoinModalOpen(true);
      return;
    }

    if (value === 'personal') {
      setCurrentTrainingSpace(personalSpace);
      return;
    }

    const teamCode = normalizeTeamCode(value.replace(/^team:/, ''));
    if (!isLoggedIn) {
      requestLogin();
      return;
    }
    const team = joinedTeams.find((item) => item.teamCode === teamCode);
    if (team) {
      setCurrentTrainingSpace({ type: 'team', teamCode: team.teamCode });
    }
  }

  async function confirmLeaveTeam() {
    if (!leaveTarget || isLeavingTeam) return;
    if (!isLoggedIn) {
      requestLogin();
      return;
    }

    setIsLeavingTeam(true);
    setLeaveError('');

    try {
      const data = await postJson('/api/team/leave', {
        teamCode: leaveTarget.teamCode,
        localUserId
      });
      const nextTeams = Array.isArray(data.teams) ? data.teams : [];
      setJoinedTeams(nextTeams);
      if (currentSpace.type === 'team' && currentSpace.teamCode === leaveTarget.teamCode) {
        setCurrentTrainingSpace(personalSpace);
      }
      setLeaveTarget(null);
      setActiveTab('teams');
    } catch (requestError) {
      setLeaveError(getFriendlyError(requestError));
    } finally {
      setIsLeavingTeam(false);
    }
  }

  async function openTeamMembers(team) {
    if (isBusy || isRecording) return;
    if (!isLoggedIn) {
      requestLogin();
      return;
    }
    setMemberModalTeam(team);
    setTeamSettingsForm({ teamName: team.teamName || team.teamCode, currentPassword: '', nextPassword: '' });
    setMemberActionError('');
    setMemberActionStatus('');
    await loadTeamMembers(team.teamCode);
  }

  async function loadTeamMembers(teamCode) {
    if (!localUserId) return;

    setIsMembersLoading(true);
    setMemberActionError('');
    try {
      const data = await getJson(`/api/team/members?teamCode=${encodeURIComponent(teamCode)}&localUserId=${encodeURIComponent(localUserId)}`);
      setTeamMembers(Array.isArray(data.members) ? data.members : []);
      setTeamMembersRequester(data.requester || null);
    } catch (requestError) {
      setTeamMembers([]);
      setTeamMembersRequester(null);
      setMemberActionError(getFriendlyError(requestError));
    } finally {
      setIsMembersLoading(false);
    }
  }

  async function removeTeamMember(member) {
    if (!memberModalTeam || activeMemberActionId) return;
    if (!isLoggedIn) {
      requestLogin();
      return;
    }
    const confirmed = window.confirm(`确认将「${member.nickname || '该成员'}」移出团队吗？对方过去的训练记录会保留，但不能再查看团队数据或保存新记录。`);
    if (!confirmed) return;

    setActiveMemberActionId(`remove:${member.localUserId}`);
    setMemberActionError('');
    setMemberActionStatus('');

    try {
      const data = await postJson('/api/team/member/remove', {
        teamCode: memberModalTeam.teamCode,
        localUserId,
        targetLocalUserId: member.localUserId
      });
      setTeamMembers(Array.isArray(data.members) ? data.members : []);
      setMemberActionStatus(`已将「${member.nickname || '该成员'}」移出团队。`);
    } catch (requestError) {
      setMemberActionError(getFriendlyError(requestError));
    } finally {
      setActiveMemberActionId('');
    }
  }

  async function transferTeamOwner(member) {
    if (!memberModalTeam || activeMemberActionId) return;
    if (!isLoggedIn) {
      requestLogin();
      return;
    }
    const confirmed = window.confirm(`确认把「${memberModalTeam.teamName || memberModalTeam.teamCode}」的队长权限转让给「${member.nickname || '该成员'}」吗？转让后你将变为普通成员。`);
    if (!confirmed) return;

    setActiveMemberActionId(`transfer:${member.localUserId}`);
    setMemberActionError('');
    setMemberActionStatus('');

    try {
      const data = await postJson('/api/team/transfer-owner', {
        teamCode: memberModalTeam.teamCode,
        localUserId,
        targetLocalUserId: member.localUserId
      });
      const nextTeams = Array.isArray(data.teams) ? data.teams : joinedTeams;
      setJoinedTeams(nextTeams);
      setTeamMembers(Array.isArray(data.members) ? data.members : []);
      setTeamMembersRequester((Array.isArray(data.members) ? data.members : []).find((item) => {
        return item.localUserId === (currentUser?.id || localUserId) || item.appUserId === currentUser?.id;
      }) || null);
      const updatedTeam = nextTeams.find((team) => team.teamCode === memberModalTeam.teamCode);
      if (updatedTeam) setMemberModalTeam(updatedTeam);
      setMemberActionStatus(`已将队长权限转让给「${member.nickname || '该成员'}」。`);
    } catch (requestError) {
      setMemberActionError(getFriendlyError(requestError));
    } finally {
      setActiveMemberActionId('');
    }
  }

  async function updateTeamMemberRole(member, role) {
    if (!memberModalTeam || activeMemberActionId) return;
    if (!isLoggedIn) {
      requestLogin();
      return;
    }
    const actionText = role === 'admin' ? '设为管理员' : '取消管理员';
    const confirmed = window.confirm(`确认将「${member.nickname || '该成员'}」${actionText}吗？`);
    if (!confirmed) return;

    setActiveMemberActionId(`role:${member.localUserId}:${role}`);
    setMemberActionError('');
    setMemberActionStatus('');

    try {
      const data = await postJson('/api/team/member/role', {
        teamCode: memberModalTeam.teamCode,
        memberUserId: member.appUserId || member.localUserId,
        role
      });
      setTeamMembers(Array.isArray(data.members) ? data.members : []);
      setMemberActionStatus(role === 'admin'
        ? `已将「${member.nickname || '该成员'}」设为管理员。`
        : `已取消「${member.nickname || '该成员'}」的管理员权限。`);
    } catch (requestError) {
      setMemberActionError(getFriendlyError(requestError) || '操作失败，请稍后重试。');
    } finally {
      setActiveMemberActionId('');
    }
  }

  async function updateTeamName() {
    if (!memberModalTeam || activeMemberActionId) return;
    if (!isLoggedIn) {
      requestLogin();
      return;
    }
    const nextTeamName = teamSettingsForm.teamName.trim();
    if (!nextTeamName || nextTeamName.length > 32 || /[<>]/.test(nextTeamName)) {
      setMemberActionError('请输入 1-32 个字符的团队名称。');
      return;
    }

    setActiveMemberActionId('update-name');
    setMemberActionError('');
    setMemberActionStatus('');

    try {
      const data = await postJson('/api/team/update-name', {
        teamCode: memberModalTeam.teamCode,
        localUserId,
        teamName: nextTeamName
      });
      const nextTeams = Array.isArray(data.teams) ? data.teams : joinedTeams;
      setJoinedTeams(nextTeams);
      const updatedTeam = nextTeams.find((team) => team.teamCode === memberModalTeam.teamCode);
      if (updatedTeam) {
        setMemberModalTeam(updatedTeam);
        setTeamSettingsForm((current) => ({ ...current, teamName: updatedTeam.teamName || updatedTeam.teamCode }));
      }
      setMemberActionStatus('团队名称已更新。');
    } catch (requestError) {
      setMemberActionError(getFriendlyError(requestError));
    } finally {
      setActiveMemberActionId('');
    }
  }

  async function updateTeamPassword() {
    if (!memberModalTeam || activeMemberActionId) return;
    if (!isLoggedIn) {
      requestLogin();
      return;
    }
    const currentPassword = teamSettingsForm.currentPassword.trim();
    const nextPassword = teamSettingsForm.nextPassword.trim();
    if (!currentPassword) {
      setMemberActionError('请输入当前团队密码。');
      return;
    }
    if (!nextPassword || nextPassword.length < 4 || nextPassword.length > 64) {
      setMemberActionError('请输入 4-64 位新团队密码。');
      return;
    }
    if (currentPassword === nextPassword) {
      setMemberActionError('新密码不能与当前密码相同。');
      return;
    }

    setActiveMemberActionId('update-password');
    setMemberActionError('');
    setMemberActionStatus('');

    try {
      await postJson('/api/team/update-password', {
        teamCode: memberModalTeam.teamCode,
        localUserId,
        currentPassword,
        nextPassword
      });
      setTeamSettingsForm((current) => ({ ...current, currentPassword: '', nextPassword: '' }));
      setMemberActionStatus('团队密码已更新，旧密码已失效。');
    } catch (requestError) {
      setMemberActionError(getFriendlyError(requestError));
    } finally {
      setActiveMemberActionId('');
    }
  }

  function viewTeamData(team) {
    if (!isLoggedIn) {
      requestLogin();
      return;
    }
    setCurrentTrainingSpace({ type: 'team', teamCode: team.teamCode });
    setActiveTab('team');
  }

  async function loadTeamDashboard(teamCode, userId) {
    if (!isLoggedIn) return;
    await Promise.all([
      loadTeamData(teamCode, userId),
      loadTeamTasks(teamCode, userId)
    ]);
  }

  async function loadMyTrainingRecords({ spaceType, teamCode = '', userId, append = false, filters = myRecordFilters }) {
    const pageState = spaceType === 'team' ? teamMemberRecordsPage : personalRecordsPage;
    const nextOffset = append ? pageState.offset : 0;
    if (append) {
      if (spaceType === 'team') {
        setTeamMemberRecordsPage((current) => ({ ...current, isLoadingMore: true }));
      } else {
        setPersonalRecordsPage((current) => ({ ...current, isLoadingMore: true }));
      }
    } else {
      setIsHistoryLoading(true);
    }
    setHistoryError('');
    if (spaceType === 'team') {
      if (!append) setTeamMemberRecords([]);
    } else {
      if (!append) setPersonalRecords([]);
    }

    try {
      const query = new URLSearchParams({
        spaceType,
        localUserId: userId,
        limit: String(trainingRecordLimit),
        offset: String(nextOffset),
        mode: filters.mode || 'all',
        sortBy: filters.sortBy || 'date',
        timeRange: filters.timeRange || 'all'
      });
      if (spaceType === 'team') query.set('teamCode', teamCode);
      const data = await getJson(`/api/training-records/my?${query.toString()}`);
      const nextRecords = Array.isArray(data.records) ? data.records : [];
      if (spaceType === 'team') {
        setTeamMemberRecords((current) => append ? [...current, ...nextRecords] : nextRecords);
        setTeamMemberRecordsPage({
          offset: Number(data.nextOffset ?? nextOffset + nextRecords.length),
          hasMore: Boolean(data.hasMore),
          isLoadingMore: false
        });
      } else {
        setPersonalRecords((current) => append ? [...current, ...nextRecords] : nextRecords);
        setPersonalRecordsPage({
          offset: Number(data.nextOffset ?? nextOffset + nextRecords.length),
          hasMore: Boolean(data.hasMore),
          isLoadingMore: false
        });
      }
    } catch (requestError) {
      setHistoryError(getFriendlyError(requestError));
      if (spaceType === 'team') {
        setTeamMemberRecordsPage((current) => ({ ...current, isLoadingMore: false }));
      } else {
        setPersonalRecordsPage((current) => ({ ...current, isLoadingMore: false }));
      }
    } finally {
      if (!append) setIsHistoryLoading(false);
    }
  }

  async function loadTeamData(teamCode, userId = localUserId, { append = false, filters = teamRecordFilters } = {}) {
    if (!isLoggedIn) return;
    const nextOffset = append ? teamRecordsPage.offset : 0;
    if (append) {
      setTeamRecordsPage((current) => ({ ...current, isLoadingMore: true }));
    } else {
      setIsTeamDataLoading(true);
    }
    setTeamDataError('');
    if (!append) setTeamRecords([]);

    try {
      const [recordsData, statsData] = await Promise.all([
        getJson(`/api/training-records/team?${new URLSearchParams({
          teamCode,
          localUserId: userId,
          limit: String(trainingRecordLimit),
          offset: String(nextOffset),
          mode: filters.mode || 'all',
          sortBy: filters.sortBy || 'date',
          timeRange: filters.timeRange || 'all'
        }).toString()}`),
        getJson(`/api/team/stats?teamCode=${encodeURIComponent(teamCode)}&localUserId=${encodeURIComponent(userId)}`)
      ]);
      const nextRecords = Array.isArray(recordsData.records) ? recordsData.records : [];
      setTeamRecords((current) => append ? [...current, ...nextRecords] : nextRecords);
      setTeamRecordsPage({
        offset: Number(recordsData.nextOffset ?? nextOffset + nextRecords.length),
        hasMore: Boolean(recordsData.hasMore),
        isLoadingMore: false
      });
      setTeamStats(statsData);
    } catch (requestError) {
      setTeamDataError(getFriendlyError(requestError));
      setTeamRecordsPage((current) => ({ ...current, isLoadingMore: false }));
    } finally {
      if (!append) setIsTeamDataLoading(false);
    }
  }

  function updateMyRecordFilters(nextFilters) {
    const normalizedFilters = { ...defaultRecordFilters, ...nextFilters };
    setMyRecordFilters(normalizedFilters);
    setSelectedRecord(null);
    if (isTeamSpace) {
      setTeamMemberRecords([]);
      setTeamMemberRecordsPage(defaultRecordPage);
    } else {
      setPersonalRecords([]);
      setPersonalRecordsPage(defaultRecordPage);
    }
  }

  function updateTeamRecordFilters(nextFilters) {
    const normalizedFilters = { ...defaultRecordFilters, ...nextFilters };
    setTeamRecordFilters(normalizedFilters);
    setSelectedRecord(null);
    setTeamRecords([]);
    setTeamRecordsPage(defaultRecordPage);
  }

  function clearMyRecordFilters() {
    updateMyRecordFilters(defaultRecordFilters);
  }

  function clearTeamRecordFilters() {
    updateTeamRecordFilters(defaultRecordFilters);
  }

  function loadMoreMyRecords() {
    if (!localUserId || isHistoryLoading) return;
    if (isTeamSpace) {
      if (teamMemberRecordsPage.isLoadingMore || !teamMemberRecordsPage.hasMore) return;
      loadMyTrainingRecords({
        spaceType: 'team',
        teamCode: currentTeam.teamCode,
        userId: localUserId,
        append: true,
        filters: myRecordFilters
      });
      return;
    }
    if (personalRecordsPage.isLoadingMore || !personalRecordsPage.hasMore) return;
    loadMyTrainingRecords({
      spaceType: 'personal',
      userId: localUserId,
      append: true,
      filters: myRecordFilters
    });
  }

  function loadMoreTeamRecords() {
    if (!isTeamSpace || !localUserId || teamRecordsPage.isLoadingMore || !teamRecordsPage.hasMore) return;
    loadTeamData(currentTeam.teamCode, localUserId, {
      append: true,
      filters: teamRecordFilters
    });
  }

  async function loadTeamTasks(teamCode, userId = localUserId) {
    if (!teamCode || !userId) return;
    if (!isLoggedIn) return;
    setIsTeamTasksLoading(true);
    setTeamTasksError('');

    try {
      const data = await getJson(`/api/team/tasks?teamCode=${encodeURIComponent(teamCode)}&localUserId=${encodeURIComponent(userId)}`);
      setTeamTasks(Array.isArray(data.tasks) ? data.tasks : []);
    } catch (requestError) {
      setTeamTasksError(getFriendlyError(requestError));
    } finally {
      setIsTeamTasksLoading(false);
    }
  }

  async function loadAbilityEstimate({ spaceType, teamCode = '', userId }) {
    if (!userId) return;
    setIsAbilityLoading(true);
    setAbilityError('');
    if (spaceType === 'team') {
      setTeamAbilityEstimate(null);
    } else {
      setPersonalAbilityEstimate(null);
    }

    try {
      const query = new URLSearchParams({
        spaceType,
        localUserId: userId
      });
      if (spaceType === 'team') query.set('teamCode', teamCode);
      const data = await getJson(`/api/ability/estimate?${query.toString()}`);
      if (spaceType === 'team') {
        setTeamAbilityEstimate(data);
      } else {
        setPersonalAbilityEstimate(data);
      }
    } catch (requestError) {
      if (spaceType === 'team') {
        setTeamAbilityEstimate(null);
      } else {
        setPersonalAbilityEstimate(null);
      }
      setAbilityError(getFriendlyError(requestError));
    } finally {
      setIsAbilityLoading(false);
    }
  }

  async function createTeamTask(event) {
    event.preventDefault();
    if (!currentTeam || isTaskActionLoading) return;
    if (!isLoggedIn) {
      requestLogin();
      return;
    }

    const title = taskForm.title.trim();
    const topic = taskForm.topic.trim();
    if (!title || !topic) {
      setTaskActionError('请填写任务名称和辩题。');
      return;
    }

    if (taskForm.assignmentType === 'selected' && !taskForm.assignedUserIds.length) {
      setTaskActionError('指定成员任务至少需要选择 1 名成员。');
      return;
    }

    setIsTaskActionLoading(true);
    setTaskActionError('');
    setTaskActionStatus('');

    try {
      await postJson('/api/team/tasks/create', {
        teamCode: currentTeam.teamCode,
        localUserId,
        title,
        topic,
        userSide: taskForm.userSide,
        mode: taskForm.mode,
        difficulty: taskForm.difficulty,
        styleId: taskForm.styleId,
        requiredCount: Number(taskForm.requiredCount) || 1,
        deadline: taskForm.deadline ? new Date(taskForm.deadline).toISOString() : '',
        description: taskForm.description.trim(),
        assignmentType: taskForm.assignmentType,
        assignedUserIds: taskForm.assignedUserIds
      });
      setTaskActionStatus('任务已发布。');
      setTaskForm(defaultTaskForm);
      setIsTaskCreateOpen(false);
      await loadTeamTasks(currentTeam.teamCode);
    } catch (requestError) {
      setTaskActionError(getFriendlyError(requestError));
    } finally {
      setIsTaskActionLoading(false);
    }
  }

  function applyTaskRecommendation(recommendation) {
    if (!recommendation) return;
    const tags = Array.isArray(recommendation.recommendedReasonTags)
      ? recommendation.recommendedReasonTags.join('、')
      : '';
    const description = [
      recommendation.taskDescription || '',
      recommendation.goal ? `训练目标：${recommendation.goal}` : '',
      recommendation.reason ? `推荐原因：${recommendation.reason}` : '',
      tags ? `问题标签：${tags}` : ''
    ].filter(Boolean).join('\n');

    setTaskForm((current) => ({
      ...current,
      title: recommendation.title || current.title,
      topic: current.topic || config.topic || '',
      mode: recommendation.mode || current.mode,
      difficulty: recommendation.difficulty || current.difficulty,
      description: description || current.description,
      deadline: current.deadline || getDateTimeLocalAfterDays(3),
      assignmentType: recommendation.assignmentType || current.assignmentType,
      assignedUserIds: Array.isArray(recommendation.assignedUserIds)
        ? recommendation.assignedUserIds
        : current.assignedUserIds
    }));
  }

  async function openTaskDetail(task) {
    if (!currentTeam || !task?.id) return;
    if (!isLoggedIn) {
      requestLogin();
      return;
    }
    setSelectedTaskDetail({ task, stats: null, completedCount: task.completedCount || 0, memberProgress: [] });
    setIsTaskDetailLoading(true);
    setTaskDetailError('');

    try {
      const [detailData, statsData] = await Promise.all([
        getJson(`/api/team/tasks/detail?taskId=${encodeURIComponent(task.id)}&teamCode=${encodeURIComponent(currentTeam.teamCode)}&localUserId=${encodeURIComponent(localUserId)}`),
        getJson(`/api/team/tasks/stats?taskId=${encodeURIComponent(task.id)}&teamCode=${encodeURIComponent(currentTeam.teamCode)}&localUserId=${encodeURIComponent(localUserId)}`)
      ]);
      setSelectedTaskDetail({
        task: detailData.task || task,
        completedCount: detailData.completedCount || 0,
        memberProgress: Array.isArray(detailData.memberProgress) ? detailData.memberProgress : [],
        stats: statsData
      });
    } catch (requestError) {
      setTaskDetailError(getFriendlyError(requestError));
    } finally {
      setIsTaskDetailLoading(false);
    }
  }

  async function closeTeamTask(task) {
    if (!currentTeam || !task?.id || isTaskActionLoading) return;
    if (!isLoggedIn) {
      requestLogin();
      return;
    }
    const confirmed = window.confirm(`确认关闭任务「${task.title}」吗？关闭后成员将无法继续通过该任务入口提交训练记录，但历史记录会保留。`);
    if (!confirmed) return;

    setIsTaskActionLoading(true);
    setTaskActionError('');
    setTaskActionStatus('');

    try {
      await postJson('/api/team/tasks/close', {
        taskId: task.id,
        teamCode: currentTeam.teamCode,
        localUserId
      });
      setTaskActionStatus('任务已关闭。');
      setSelectedTaskDetail(null);
      await loadTeamTasks(currentTeam.teamCode);
    } catch (requestError) {
      setTaskActionError(getFriendlyError(requestError));
    } finally {
      setIsTaskActionLoading(false);
    }
  }

  function startTaskTraining(task) {
    if (!task || isBusy || isRecording) return;
    if (!isLoggedIn) {
      requestLogin();
      return;
    }
    if (!isTaskActive(task)) {
      setTaskActionError('该任务已结束，不能继续通过任务入口训练。');
      return;
    }
    const mode = task.mode || 'free_debate';
    const selectedMode = trainingModes.find((item) => item.value === mode) || trainingModes[2];
    const taskConfig = {
      topic: task.topic || '',
      userSide: task.userSide || 'affirmative',
      difficulty: task.difficulty || 'novice',
      celebrityDebater: task.styleId || 'none',
      trainingMode: mode,
      rounds: selectedMode.rounds || 3
    };

    setCurrentTrainingSpace({ type: 'team', teamCode: task.teamCode || currentTeam?.teamCode });
    setConfig(taskConfig);
    setHistory([]);
    setAnswer('');
    setReview('');
    setStructuredReview(null);
    setError('');
    setSelectedRecord(null);
    setSaveStatus('');
    setPolishResult(null);
    setSelectedPolishType((polishOptionsByMode[mode] || polishOptionsByMode.general)[0].id);
    setActiveTaskSession({
      taskId: task.id,
      title: task.title,
      teamCode: task.teamCode || currentTeam?.teamCode,
      topic: task.topic || '',
      userSide: task.userSide || 'affirmative',
      mode,
      difficulty: task.difficulty || 'novice',
      styleId: task.styleId || 'none',
      requiredCount: task.requiredCount || 1,
      deadline: task.deadline || ''
    });
    setSetupStep(roundSelectionModes.includes(mode) ? 'rounds' : mode === 'defense' ? 'rounds' : 'ready');
    setActiveTab('training');
    if (longOutputModes.includes(mode)) {
      setLongOutputPromptMode(mode);
    }
  }

  async function saveTrainingRecord(reviewContent, reviewData = null) {
    if (currentSpace.type === 'team' && !isLoggedIn) {
      setSaveStatus('复盘已生成，但团队记录需要登录后才能同步。');
      return;
    }

    if (currentSpace.type === 'team' && !currentSpace.teamCode) {
      setSaveStatus('团队训练记录保存失败：缺少团队信息，请重新进入团队后训练。');
      return;
    }

    setSaveStatus('正在保存本次训练记录...');

    try {
      const recordSpaceType = currentSpace.type === 'team' ? 'team' : 'personal';
      const data = await postJson('/api/training-records', {
        spaceType: recordSpaceType,
        teamCode: recordSpaceType === 'team' ? currentSpace.teamCode : null,
        localUserId,
        nickname: currentNickname,
        topic: config.topic,
        userSide: config.userSide,
        aiSide: getOpponentSideValue(config.userSide),
        difficulty: config.difficulty,
        styleId: config.celebrityDebater,
        trainingMode: config.trainingMode,
        taskId: activeTaskSession?.taskId || '',
        messages: history,
        review: reviewContent,
        score: reviewData?.score ?? extractScoreFromReview(reviewContent),
        result: extractResultFromReview(reviewContent),
        battlefield: reviewData?.battlefield || extractBattlefieldFromReview(reviewContent),
        modeDisplayName: reviewData?.modeDisplayName || getOptionLabel(trainingModes, config.trainingMode),
        scoreLevel: reviewData?.scoreLevel || '',
        dimensionScores: Array.isArray(reviewData?.dimensionScores) ? reviewData.dimensionScores : []
      });

      if (data.record) {
        if (recordSpaceType === 'team') {
          setTeamMemberRecords((currentRecords) => [
            data.record,
            ...currentRecords.filter((record) => record.id !== data.record.id)
          ].slice(0, trainingRecordLimit));
          setTeamRecords((currentRecords) => [
            data.record,
            ...currentRecords.filter((record) => record.id !== data.record.id)
          ].slice(0, 50));
        } else {
          setPersonalRecords((currentRecords) => [
            data.record,
            ...currentRecords.filter((record) => record.id !== data.record.id)
          ].slice(0, trainingRecordLimit));
        }
      }

      setSaveStatus('本次训练记录已保存。');
      if (recordSpaceType === 'team') {
        loadTeamData(currentSpace.teamCode);
        loadTeamTasks(currentSpace.teamCode);
        loadMyTrainingRecords({ spaceType: 'team', teamCode: currentSpace.teamCode, userId: localUserId });
        loadAbilityEstimate({ spaceType: 'team', teamCode: currentSpace.teamCode, userId: localUserId });
      } else {
        loadMyTrainingRecords({ spaceType: 'personal', userId: localUserId });
        loadAbilityEstimate({ spaceType: 'personal', userId: localUserId });
      }
    } catch (requestError) {
      setSaveStatus('复盘已生成，但记录同步失败，请稍后重试。');
    }
  }

  function updateConfig(nextConfig) {
    setConfig(nextConfig);
    if (error) setError('');
  }

  function generateTopics() {
    if (isTraining || isBusy) return;

    const pool = topicPools[topicDirection] || topicPools.education;
    const recent = recentGeneratedTopics[topicDirection] || [];
    const available = pool.filter((topic) => !recent.includes(topic));
    const source = available.length >= 4 ? available : pool.filter((topic) => !generatedTopics.includes(topic));
    const nextTopics = shuffle(source.length >= 4 ? source : pool).slice(0, 4);

    setGeneratedTopics(nextTopics);
    setRecentGeneratedTopics((current) => ({
      ...current,
      [topicDirection]: [...recent, ...nextTopics].slice(-8)
    }));
  }

  function selectGeneratedTopic(topic) {
    if (isTraining || isBusy) return;

    updateConfig({ ...config, topic });
  }

  function selectCelebrityDebater(value) {
    updateConfig({
      ...config,
      celebrityDebater: value,
      difficulty: value === 'none' ? config.difficulty : 'city'
    });
  }

  function selectTrainingMode(value) {
    const mode = trainingModes.find((item) => item.value === value) || trainingModes[2];
    const nextPolishOptions = polishOptionsByMode[value] || polishOptionsByMode.general;
    updateConfig({
      ...config,
      trainingMode: value,
      rounds: mode.rounds
    });
    setSelectedPolishType(nextPolishOptions[0].id);
    setSetupStep(roundSelectionModes.includes(value) ? 'rounds' : 'ready');
    setGeneratedTopics([]);
    if (longOutputModes.includes(value)) {
      setLongOutputPromptMode(value);
    }
  }

  function goToDefensePrepStep() {
    if (isTraining || isBusy) return;
    setSetupStep('defensePrep');
    setError('');
  }

  function goToFreeDebatePrepStep() {
    if (isTraining || isBusy) return;
    setSetupStep('freeDebatePrep');
    setError('');
  }

  function goBackFromSetupStep() {
    if (isTraining || isBusy) return;
    setError('');
    if (setupStep === 'defensePrep') {
      setSetupStep('rounds');
      return;
    }
    if (setupStep === 'freeDebatePrep') {
      setSetupStep('rounds');
      return;
    }
    goToModeStep();
  }

  function goToModeStep() {
    if (isTraining || isBusy) return;
    const validationError = validatePreModeConfig();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSetupStep('mode');
    setError('');
  }

  function goToTopicStep() {
    if (isTraining || isBusy) return;
    setError('');
    setSetupStep('topic');
  }

  function validatePreModeConfig() {
    if (!config.topic.trim()) {
      return '请先输入辩题，或从随机生成的候选辩题中选择一个。';
    }

    if (!config.userSide) {
      return '请先选择你的立场。';
    }

    return '';
  }

  function validateTrainingConfig() {
    const preModeError = validatePreModeConfig();
    if (preModeError) return preModeError;

    if (!config.trainingMode) return '请先选择训练模式。';

    if (config.trainingMode === 'defense' && !defensePrep.trim()) {
      return '请先填写己方分论点和论据，AI 才能根据你的立论进行质询。';
    }

    if (config.trainingMode === 'free_debate' && !freeDebatePrep.trim()) {
      return '请至少填写一个主要论点，方便 AI 基于你的真实观点进行交锋。';
    }

    return '';
  }

  async function startTraining() {
    if (isBusy) return;

    const validationError = validateTrainingConfig();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);
    setError('');
    setReview('');
    setStructuredReview(null);
    setReviewGenerationStatus('idle');
    setReviewLoadingError('');
    setHistory([]);
    setPolishResult(null);
    setSelectedRecord(null);
    setSaveStatus('');
    const nextTrainingSession = {
      ...config,
      aiSide: getOpponentSideValue(config.userSide),
      userSideLabel: getOptionLabel(sides, config.userSide),
      aiSideLabel: getOptionLabel(sides, getOpponentSideValue(config.userSide)),
      defensePrep: defensePrep.trim(),
      freeDebatePrep: freeDebatePrep.trim(),
      startedAt: new Date().toISOString()
    };
    setTrainingSession(nextTrainingSession);

    if (config.trainingMode === 'constructive' && config.userSide === 'affirmative') {
      setHistory([]);
      setIsTraining(true);
      setIsLoading(false);
      return;
    }

    try {
      const data = await postJson('/api/debate/start', {
        ...nextTrainingSession,
        history: []
      });
      const content = requireContent(data);

      setHistory([{ role: 'ai', content }]);
      setIsTraining(true);
    } catch (requestError) {
      setError(getFriendlyError(requestError));
    } finally {
      setIsLoading(false);
    }
  }

  async function submitAnswer() {
    if (isBusy || isRecording) return;

    const trimmedAnswer = answer.trim();
    if (!trimmedAnswer) {
      setError('请先输入你的回答。');
      return;
    }

    if (isSingleSpeechMode && trimmedAnswer.length > 1200) {
      setError('本模式单次输入不能超过1200字。');
      return;
    }

    const nextHistory = [...history, { role: 'user', content: trimmedAnswer }];
    setHistory(nextHistory);
    setAnswer('');
    setError('');
    setPolishResult(null);

    if (isSingleSpeechMode) {
      return;
    }

    if (userAnswers + 1 >= config.rounds && !isSingleSpeechMode) {
      return;
    }

    setIsLoading(true);

    try {
      const data = await postJson('/api/debate/respond', {
        ...config,
        aiSide: getOpponentSideValue(config.userSide),
        userSideLabel: getOptionLabel(sides, config.userSide),
        aiSideLabel: getOptionLabel(sides, getOpponentSideValue(config.userSide)),
        defensePrep: trainingSession?.defensePrep ?? defensePrep.trim(),
        freeDebatePrep: trainingSession?.freeDebatePrep ?? freeDebatePrep.trim(),
        history: nextHistory,
        answer: trimmedAnswer
      });
      const content = requireContent(data);

      setHistory([...nextHistory, { role: 'ai', content }]);
      if (isSingleSpeechMode) {
        setIsTraining(false);
      }
    } catch (requestError) {
      setError(getFriendlyError(requestError));
    } finally {
      setIsLoading(false);
    }
  }

  async function finishAndReview() {
    if (isBusy || isRecording) return;

    if (!history.length) {
      setError('暂无对话，无法复盘。');
      return;
    }

    setIsReviewing(true);
    setReviewGenerationStatus('loading');
    setReviewLoadingError('');
    setError('');
    let reviewCompleted = false;

    try {
      const sessionForReview = trainingSession || {};
      const data = await postJson('/api/debate/review', {
        ...config,
        aiSide: sessionForReview.aiSide || getOpponentSideValue(config.userSide),
        userSideLabel: sessionForReview.userSideLabel || getOptionLabel(sides, config.userSide),
        aiSideLabel: sessionForReview.aiSideLabel || getOptionLabel(sides, getOpponentSideValue(config.userSide)),
        defensePrep: sessionForReview.defensePrep ?? defensePrep.trim(),
        freeDebatePrep: sessionForReview.freeDebatePrep ?? freeDebatePrep.trim(),
        history
      });
      const content = requireContent(data);
      const nextStructuredReview = normalizeStructuredReview(data.structuredReview);

      setReview(content);
      setStructuredReview(nextStructuredReview);
      setIsTraining(false);
      await saveTrainingRecord(content, nextStructuredReview);
      reviewCompleted = true;
      setReviewGenerationStatus('complete');
      await new Promise((resolve) => window.setTimeout(resolve, 650));
    } catch (requestError) {
      const message = '复盘生成失败，请稍后重试。';
      setReviewLoadingError(message);
      setReviewGenerationStatus('error');
      setError(message);
    } finally {
      setIsReviewing(false);
      if (reviewCompleted) {
        setReviewGenerationStatus('idle');
      }
    }
  }

  function prepareNextTraining(nextMode = config.trainingMode, statusMessage = '') {
    if (isBusy || isRecording) return;

    const modeConfig = trainingModes.find((item) => item.value === nextMode) || trainingModes[2];
    const nextPolishOptions = polishOptionsByMode[nextMode] || polishOptionsByMode.general;
    updateConfig({
      ...config,
      trainingMode: nextMode,
      rounds: modeConfig.rounds || config.rounds
    });
    setHistory([]);
    setAnswer('');
    setReview('');
    setStructuredReview(null);
    setReviewGenerationStatus('idle');
    setReviewLoadingError('');
    setError('');
    setSelectedRecord(null);
    setSaveStatus(statusMessage);
    setPolishResult(null);
    setSelectedPolishType(nextPolishOptions[0].id);
    setRecordingError('');
    setRecordingStatus('');
    setRecordedAudioUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      return '';
    });
    setRecordingDuration(0);
    stopRecordingResources();
    setIsTraining(false);
    setTrainingSession(null);
    setLongOutputPromptMode(longOutputModes.includes(nextMode) ? nextMode : '');
    setSetupStep(getSetupStepForMode(nextMode, {
      hasDefensePrep: Boolean(defensePrep.trim()),
      hasFreeDebatePrep: Boolean(freeDebatePrep.trim())
    }));
    setActiveTab('training');
  }

  function continueSameTrainingMode() {
    prepareNextTraining(config.trainingMode, '已保留本轮设置，可以继续练同一模式。');
  }

  function practiceWeakestDimensionAgain() {
    const weakestDimension = getWeakestDimensions(structuredReview?.dimensionScores, 1)[0];
    prepareNextTraining(
      config.trainingMode,
      weakestDimension
        ? `已回到当前模式，请重点关注「${weakestDimension.name}」。`
        : '已回到当前模式，可以针对刚才的短板再练一次。'
    );
  }

  function switchToRecommendedTrainingMode() {
    const weakestDimension = getWeakestDimensions(structuredReview?.dimensionScores, 1)[0];
    const recommendedMode = getRecommendedTrainingModeForDimension(weakestDimension?.name, config.trainingMode);
    const modeLabel = getOptionLabel(trainingModes, recommendedMode) || '推荐模式';
    prepareNextTraining(recommendedMode, `已切换到${modeLabel}，可以针对短板专项训练。`);
  }

  function resetTraining() {
    if (isBusy || isRecording) return;

    setConfig(initialConfig);
    setHistory([]);
    setAnswer('');
    setReview('');
    setError('');
    setReviewGenerationStatus('idle');
    setReviewLoadingError('');
    setSelectedRecord(null);
    setSaveStatus('');
    setPolishResult(null);
    setRecordingError('');
    setRecordingStatus('');
    setRecordedAudioUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      return '';
    });
    setRecordingDuration(0);
    stopRecordingResources();
    setIsTraining(false);
    setGeneratedTopics([]);
    setRecentGeneratedTopics({});
    setDefensePrep('');
    setFreeDebatePrep('');
    setTrainingSession(null);
    setSetupStep('topic');
    setLongOutputPromptMode('');
    setActiveTaskSession(null);
  }

  async function startAudioRecording() {
    if (isBusy || isRecording) return;

    if (!isAudioRecorderSupported()) {
      setRecordingStatus('');
      setRecordingError('当前浏览器不支持录音上传，请使用文字输入。');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContextClass();
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      const silentGain = audioContext.createGain();
      silentGain.gain.value = 0;

      recordingPcmChunksRef.current = [];
      recordingStreamRef.current = stream;
      audioContextRef.current = audioContext;
      audioSourceRef.current = source;
      audioProcessorRef.current = processor;
      recordingInputSampleRateRef.current = audioContext.sampleRate;
      recordingStartedAtRef.current = Date.now();

      processor.onaudioprocess = (event) => {
        if (!recordingStartedAtRef.current) return;
        const inputData = event.inputBuffer.getChannelData(0);
        recordingPcmChunksRef.current.push(new Float32Array(inputData));
      };

      source.connect(processor);
      processor.connect(silentGain);
      silentGain.connect(audioContext.destination);

      setIsRecording(true);
      setRecordingDuration(0);
      setRecordingError('');
      setRecordingStatus(`正在录音，请开始回答。最多录制 ${maxRecordingSeconds} 秒。`);

      recordingTimerRef.current = window.setInterval(() => {
        const seconds = Math.floor((Date.now() - recordingStartedAtRef.current) / 1000);
        setRecordingDuration(seconds);

        if (seconds >= maxRecordingSeconds) {
          stopAudioRecording();
        }
      }, 500);
    } catch (recordError) {
      setIsRecording(false);
      setRecordingStatus('');
      setRecordingError(isPermissionDenied(recordError) ? '请允许浏览器使用麦克风后再试。' : '录音失败，请重试或改用文字输入。');
      stopRecordingResources();
    }
  }

  function stopAudioRecording() {
    if (!audioProcessorRef.current) return;

    setIsRecording(false);
    setRecordingStatus('正在上传录音并转文字...');
    clearRecordingTimer();
    uploadRecordedAudio();
  }

  async function uploadRecordedAudio() {
    const chunks = recordingPcmChunksRef.current;
    const inputSampleRate = recordingInputSampleRateRef.current;
    stopRecordingResources(false);

    if (!chunks.length) {
      setRecordingStatus('');
      setRecordingError('没有录到声音，请重新录音。');
      return;
    }

    const mergedPcm = mergeFloat32Chunks(chunks);
    const wavBlob = encodeWav(downsampleBuffer(mergedPcm, inputSampleRate, 16000), 16000);
    const nextAudioUrl = URL.createObjectURL(wavBlob);
    setRecordedAudioUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      return nextAudioUrl;
    });
    setIsTranscribing(true);
    setRecordingError('');
    setRecordingStatus('正在转文字，请稍候。');

    try {
      const response = await fetch('/api/speech/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'audio/wav'
        },
        body: wavBlob
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || '录音识别失败，请重试或改用文字输入。');
      }

      const transcript = String(data.text || '').trim();
      if (!transcript) {
        throw new Error('录音识别失败，请重试或改用文字输入。');
      }

      appendAnswerText(transcript);
      setPolishResult(null);
      setRecordingStatus('录音识别完成，请检查文字后提交。');
    } catch (requestError) {
      setRecordingStatus('');
      setRecordingError(getFriendlyError(requestError));
    } finally {
      setIsTranscribing(false);
      recordingPcmChunksRef.current = [];
    }
  }

  async function polishAnswer(polishType = activePolishType) {
    if (isBusy || isRecording) return;

    const trimmedAnswer = answer.trim();
    if (!trimmedAnswer) {
      setError('请先输入你的回答。');
      return;
    }

    setIsPolishing(true);
    setError('');

    try {
      const data = await postJson('/api/debate/polish', {
        ...config,
        mode: config.trainingMode,
        modeDisplayName: getOptionLabel(trainingModes, config.trainingMode),
        aiSide: getOpponentSideValue(config.userSide),
        userSideLabel: getOptionLabel(sides, config.userSide),
        aiSideLabel: getOptionLabel(sides, getOpponentSideValue(config.userSide)),
        polishType,
        history,
        answer: trimmedAnswer
      });
      const fallbackOptions = currentPolishOptions.map((option) => ({
        ...option,
        text: option.id === polishType ? data.polished || trimmedAnswer : data.concise || data.polished || trimmedAnswer
      }));

      setPolishResult({
        original: data.original || trimmedAnswer,
        modeDisplayName: data.modeDisplayName || getOptionLabel(trainingModes, config.trainingMode),
        selectedType: data.selectedType || polishType,
        options: Array.isArray(data.options) && data.options.length ? data.options : fallbackOptions,
        polished: data.polished || trimmedAnswer,
        concise: data.concise || trimmedAnswer,
        tip: data.tip || '建议先给结论，再补一个清晰标准。'
      });
    } catch (requestError) {
      setError(getFriendlyError(requestError));
    } finally {
      setIsPolishing(false);
    }
  }

  function usePolishedAnswer(text) {
    setAnswer(text);
    setRecordingStatus('已放入回答框，请检查文字后提交。');
    setRecordingError('');
  }

  function appendAnswerText(text) {
    setAnswer((currentAnswer) => {
      const separator = currentAnswer.trim() ? '\n' : '';
      return `${currentAnswer}${separator}${text}`;
    });
  }

  function clearRecordingTimer() {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }

  function stopRecordingTracks() {
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current = null;
  }

  function stopRecordingResources(updateState = true) {
    clearRecordingTimer();
    audioProcessorRef.current?.disconnect();
    audioSourceRef.current?.disconnect();
    audioProcessorRef.current = null;
    audioSourceRef.current = null;
    recordingStartedAtRef.current = 0;
    audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
    recordingPcmChunksRef.current = [];
    stopRecordingTracks();
    if (updateState) {
      setIsRecording(false);
    }
  }

  function closeOnboarding() {
    localStorage.setItem(onboardingStorageKey, 'true');
    setShowOnboarding(false);
  }

  function startFromOnboarding() {
    closeOnboarding();
    window.requestAnimationFrame(() => {
      document
        .querySelector('.setup-panel, .mode-selector-panel, .arena-hero')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function dismissPwaHint() {
    localStorage.setItem(pwaHintStorageKey, 'true');
    setShowPwaHint(false);
  }

  function logDataStateDebug(nextTab = activeTab) {
    if (!import.meta.env.DEV) return;
    console.debug('[data-sync] tab switch', {
      activeTab: nextTab,
      currentSpace,
      selectedTeamCode: currentSpace.type === 'team' ? currentSpace.teamCode : '',
      personalRecordsCount: personalRecords.length,
      teamRecordsCount: teamRecords.length
    });
  }

  const functionGroups = [
    {
      title: '训练',
      items: [
        { label: '训练区', value: 'training' },
        { label: '辩论顾问', value: 'experience' }
      ]
    },
    {
      title: '数据',
      items: [
        { label: '我的记录', value: 'mine' },
        { label: '能力估测', value: 'ability' }
      ]
    },
    {
      title: '团队',
      items: [
        { label: '我的团队', value: 'teams' },
        { label: '团队数据', value: 'team', disabled: !isTeamSpace, hint: '切换到团队空间后可用' }
      ]
    }
  ];
  const functionTabs = functionGroups.flatMap((group) => group.items);
  const activeTabLabel = functionTabs.find((item) => item.value === activeTab)?.label || '训练区';

  function switchFunctionTab(tab) {
    if (tab.disabled) return;
    logDataStateDebug(tab.value);
    setActiveTab(tab.value);
    setSelectedRecord(null);
    setIsFunctionPanelOpen(false);
  }

  return (
    <main className={`app-shell ${hasSessionContent ? 'session-active' : ''}`}>
      <section className="team-topbar compact-topbar" aria-label="当前状态与功能区">
        <div className="topbar-brand">
          <strong>锋辩</strong>
          <span>当前：{currentSpaceLabel} / {currentNickname}</span>
        </div>
        <div className="topbar-current">
          <span>当前功能</span>
          <strong>{activeTabLabel}</strong>
        </div>
        <button
          type="button"
          className="function-panel-trigger"
          onClick={() => setIsFunctionPanelOpen(true)}
          aria-expanded={isFunctionPanelOpen}
        >
          ☰ 功能区
        </button>
      </section>

      <OnboardingGuide open={showOnboarding} onClose={closeOnboarding} onStart={startFromOnboarding} />

      <InstallPwaHint open={showPwaHint} onDismiss={dismissPwaHint} />

      {isFunctionPanelOpen && (
        <div
          className="function-panel-backdrop"
          role="presentation"
          onClick={() => setIsFunctionPanelOpen(false)}
        >
          <section
            className="function-panel"
            role="dialog"
            aria-modal="true"
            aria-label="功能区"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="function-panel-header">
              <div>
                <span>锋辩</span>
                <h2>功能区</h2>
              </div>
              <button type="button" onClick={() => setIsFunctionPanelOpen(false)} aria-label="关闭功能区">
                ×
              </button>
            </div>

            <div className="function-panel-groups">
              {functionGroups.map((group) => (
                <section className="function-panel-group" key={group.title}>
                  <h3>{group.title}</h3>
                  <div className="function-panel-buttons">
                    {group.items.map((item) => (
                      <button
                        type="button"
                        key={item.value}
                        className={activeTab === item.value ? 'active' : ''}
                        disabled={item.disabled}
                        onClick={() => switchFunctionTab(item)}
                        title={item.hint || item.label}
                      >
                        <span>{item.label}</span>
                        {item.hint && <small>{item.hint}</small>}
                      </button>
                    ))}
                  </div>
                </section>
              ))}

              <section className="function-panel-group account-space-group">
                <h3>账号与空间</h3>
                <div className="function-info-card">
                  <span>当前用户</span>
                  <strong>{isLoggedIn ? `${currentUser.displayName}（${currentUser.username}）` : `游客模式 / ${currentNickname}`}</strong>
                  {!isLoggedIn && <p>登录后可跨设备保存训练记录、团队身份和任务进度。</p>}
                </div>
                <label className="space-selector function-space-selector">
                  <span>切换空间</span>
                  <select
                    value={currentSpaceValue}
                    onChange={(event) => {
                      selectTrainingSpace(event.target.value);
                      setSelectedRecord(null);
                      setIsFunctionPanelOpen(false);
                    }}
                    disabled={isBusy || isRecording || isTeamsLoading}
                  >
                    <option value="personal">个人模式</option>
                    {joinedTeams.map((team) => (
                      <option key={team.teamCode} value={`team:${team.teamCode}`}>
                        {team.teamName || team.teamCode}
                      </option>
                    ))}
                    <option value="join">+ 加入 / 创建团队</option>
                  </select>
                </label>
                <div className="function-panel-actions">
                  <button type="button" onClick={() => { setShowOnboarding(true); setIsFunctionPanelOpen(false); }}>
                    新手指南
                  </button>
                  <button type="button" onClick={() => { setShowPwaHint(true); setIsFunctionPanelOpen(false); }}>
                    安装到桌面
                  </button>
                  {isLoggedIn ? (
                    <button type="button" className="danger" onClick={() => { setIsFunctionPanelOpen(false); logout(); }}>
                      退出登录
                    </button>
                  ) : (
                    <>
                      <button type="button" onClick={() => { setAuthMode('login'); setAuthError(''); setIsAuthModalOpen(true); setIsFunctionPanelOpen(false); }}>
                        登录
                      </button>
                      <button type="button" onClick={() => { setAuthMode('register'); setAuthError(''); setIsAuthModalOpen(true); setIsFunctionPanelOpen(false); }}>
                        注册
                      </button>
                    </>
                  )}
                </div>
              </section>
            </div>
          </section>
        </div>
      )}

      {authStatus && <div className="history-status">{authStatus}</div>}
      {joinSuccess && <div className="history-status">{joinSuccess}</div>}

      {isAuthModalOpen && (
        <AuthModal
          mode={authMode}
          form={authForm}
          error={authError}
          isLoading={isAuthLoading}
          onSubmit={submitAuth}
          onChange={setAuthForm}
          onModeChange={(nextMode) => {
            setAuthMode(nextMode);
            setAuthError('');
          }}
          onClose={() => {
            setIsAuthModalOpen(false);
            setAuthError('');
          }}
        />
      )}

      {isJoinModalOpen && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-panel" role="dialog" aria-modal="true" aria-label="加入新团队">
            <div className="panel-title">
              <p className="eyebrow">团队空间</p>
              <h2>{teamFormMode === 'create' ? '创建团队' : '加入团队'}</h2>
              <p className="team-privacy-note">
                加入团队后，你的昵称、训练次数、分数、辩题和复盘结果可能被团队成员或队长查看，请勿输入私人敏感内容。
              </p>
            </div>

            {joinedTeamPrompt ? (
              <div className="team-join-form">
                <div className="history-status">已加入团队：{joinedTeamPrompt.teamName || joinedTeamPrompt.teamCode}</div>
                <div className="modal-actions">
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => {
                      setCurrentTrainingSpace({ type: 'team', teamCode: joinedTeamPrompt.teamCode });
                      setIsJoinModalOpen(false);
                      setJoinedTeamPrompt(null);
                      setActiveTab('training');
                    }}
                  >
                    切换到该团队
                  </button>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => {
                      setIsJoinModalOpen(false);
                      setJoinedTeamPrompt(null);
                    }}
                  >
                    留在当前空间
                  </button>
                </div>
              </div>
            ) : (
              <form className="team-join-form" onSubmit={joinTeam}>
                <div className="form-mode-switch" aria-label="团队操作">
                  <button
                    type="button"
                    className={teamFormMode === 'join' ? 'active' : ''}
                    onClick={() => {
                      setTeamFormMode('join');
                      setJoinError('');
                    }}
                    disabled={isJoiningTeam}
                  >
                    加入已有团队
                  </button>
                  <button
                    type="button"
                    className={teamFormMode === 'create' ? 'active' : ''}
                    onClick={() => {
                      setTeamFormMode('create');
                      setJoinError('');
                    }}
                    disabled={isJoiningTeam}
                  >
                    创建新团队
                  </button>
                </div>

                {teamFormMode === 'create' && (
                  <label className="field">
                    <span>团队名称</span>
                    <input
                      value={joinForm.teamName}
                      disabled={isJoiningTeam}
                      onChange={(event) => setJoinForm({ ...joinForm, teamName: event.target.value })}
                      placeholder="例如：校辩论队一队"
                      maxLength={32}
                    />
                  </label>
                )}

                <label className="field">
                  <span>团队码</span>
                  <input
                    value={joinForm.teamCode}
                    disabled={isJoiningTeam}
                    onChange={(event) => setJoinForm({ ...joinForm, teamCode: event.target.value })}
                    placeholder="例如：JXCH-DEBATE"
                    maxLength={32}
                  />
                </label>

                <label className="field">
                  <span>团队密码</span>
                  <div className="password-input-wrap">
                    <input
                      type={isJoinPasswordVisible ? 'text' : 'password'}
                      value={joinForm.teamPassword}
                      disabled={isJoiningTeam}
                      onChange={(event) => setJoinForm({ ...joinForm, teamPassword: event.target.value })}
                      placeholder="请输入团队密码"
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      onClick={() => setIsJoinPasswordVisible((current) => !current)}
                      disabled={isJoiningTeam || !joinForm.teamPassword}
                      aria-label={isJoinPasswordVisible ? '隐藏密码' : '显示密码'}
                    >
                      {isJoinPasswordVisible ? '隐藏' : '显示'}
                    </button>
                  </div>
                </label>

                <label className="field">
                  <span>昵称</span>
                  <input
                    value={joinForm.nickname}
                    disabled={isJoiningTeam}
                    onChange={(event) => setJoinForm({ ...joinForm, nickname: event.target.value })}
                    placeholder="例如：林婉"
                    maxLength={20}
                  />
                </label>

                {joinError && <div className="error-box">{joinError}</div>}

                <div className="modal-actions">
                  <button className="primary-button" type="submit" disabled={isJoiningTeam}>
                    {isJoiningTeam ? '处理中...' : teamFormMode === 'create' ? '创建并加入' : '加入团队'}
                  </button>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => {
                      setIsJoinModalOpen(false);
                      setJoinError('');
                    }}
                    disabled={isJoiningTeam}
                  >
                    取消
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}

      {leaveTarget && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-panel" role="dialog" aria-modal="true" aria-label="退出团队确认">
            <div className="panel-title">
              <p className="eyebrow">退出团队</p>
              <h2>确认退出团队「{leaveTarget.teamName || leaveTarget.teamCode}」吗？</h2>
              <p className="team-privacy-note">
                退出后你将不能查看该团队数据，也不能将新训练记录保存到该团队。你过去的训练记录会保留在团队历史数据中。
              </p>
            </div>
            {leaveError && <div className="error-box">{leaveError}</div>}
            <div className="modal-actions">
              <button className="secondary-button danger" type="button" onClick={confirmLeaveTeam} disabled={isLeavingTeam}>
                {isLeavingTeam ? '退出中...' : '确认退出'}
              </button>
              <button className="ghost-button" type="button" onClick={() => setLeaveTarget(null)} disabled={isLeavingTeam}>
                取消
              </button>
            </div>
          </section>
        </div>
      )}

      {memberModalTeam && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-panel team-members-modal" role="dialog" aria-modal="true" aria-label="团队成员管理">
            <div className="panel-title">
              <p className="eyebrow">团队成员</p>
              <h2>{memberModalTeam.teamName || memberModalTeam.teamCode}</h2>
              <p className="team-privacy-note">
                普通成员可以查看团队成员。队长可以移出成员，也可以把队长权限转让给其他成员。
              </p>
            </div>

            {memberActionError && <div className="error-box">{memberActionError}</div>}
            {memberActionStatus && <div className="history-status">{memberActionStatus}</div>}

            {isTeamLeaderRole(teamMembersRequester?.role) && (
              <div className="team-settings-card">
                <div className="team-settings-row">
                  <label className="field">
                    <span>团队名称</span>
                    <input
                      value={teamSettingsForm.teamName}
                      disabled={Boolean(activeMemberActionId)}
                      onChange={(event) => setTeamSettingsForm({ ...teamSettingsForm, teamName: event.target.value })}
                      maxLength={32}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={updateTeamName}
                    disabled={Boolean(activeMemberActionId)}
                  >
                    {activeMemberActionId === 'update-name' ? '保存中...' : '保存名称'}
                  </button>
                </div>
                <div className="team-settings-row password-row">
                  <label className="field">
                    <span>当前密码</span>
                    <div className="password-input-wrap">
                      <input
                        type={isCurrentTeamPasswordVisible ? 'text' : 'password'}
                        value={teamSettingsForm.currentPassword}
                        disabled={Boolean(activeMemberActionId)}
                        onChange={(event) => setTeamSettingsForm({ ...teamSettingsForm, currentPassword: event.target.value })}
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        onClick={() => setIsCurrentTeamPasswordVisible((current) => !current)}
                        disabled={Boolean(activeMemberActionId) || !teamSettingsForm.currentPassword}
                        aria-label={isCurrentTeamPasswordVisible ? '隐藏当前密码' : '显示当前密码'}
                      >
                        {isCurrentTeamPasswordVisible ? '隐藏' : '显示'}
                      </button>
                    </div>
                  </label>
                  <label className="field">
                    <span>新密码</span>
                    <div className="password-input-wrap">
                      <input
                        type={isNextTeamPasswordVisible ? 'text' : 'password'}
                        value={teamSettingsForm.nextPassword}
                        disabled={Boolean(activeMemberActionId)}
                        onChange={(event) => setTeamSettingsForm({ ...teamSettingsForm, nextPassword: event.target.value })}
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        onClick={() => setIsNextTeamPasswordVisible((current) => !current)}
                        disabled={Boolean(activeMemberActionId) || !teamSettingsForm.nextPassword}
                        aria-label={isNextTeamPasswordVisible ? '隐藏新密码' : '显示新密码'}
                      >
                        {isNextTeamPasswordVisible ? '隐藏' : '显示'}
                      </button>
                    </div>
                  </label>
                  <button
                    type="button"
                    onClick={updateTeamPassword}
                    disabled={Boolean(activeMemberActionId)}
                  >
                    {activeMemberActionId === 'update-password' ? '更新中...' : '更新密码'}
                  </button>
                </div>
              </div>
            )}

            {isMembersLoading ? (
              <div className="history-status">正在加载成员列表...</div>
            ) : teamMembers.length === 0 ? (
              <div className="history-empty">暂无团队成员</div>
            ) : (
              <div className="member-list">
                {teamMembers.map((member) => {
                  const selfIdentityId = currentUser?.id || localUserId;
                  const isSelf = member.localUserId === selfIdentityId || member.appUserId === currentUser?.id;
                  const isLeader = isTeamLeaderRole(member.role);
                  const requesterIsLeader = isTeamLeaderRole(teamMembersRequester?.role);
                  const canManage = requesterIsLeader && !isSelf && !isLeader && Boolean(member.appUserId);
                  return (
                    <article className="member-list-item" key={member.localUserId}>
                      <div>
                        <strong>{member.nickname || '未命名成员'}{isSelf ? '（我）' : ''}</strong>
                        <span>{getTeamRoleLabel(member.role)} · {formatRecordDate(member.joinedAt)}</span>
                      </div>
                      {canManage && (
                        <div className="member-actions">
                          {member.role === 'admin' ? (
                            <button
                              type="button"
                              onClick={() => updateTeamMemberRole(member, 'member')}
                              disabled={Boolean(activeMemberActionId)}
                            >
                              {activeMemberActionId === `role:${member.localUserId}:member` ? '取消中...' : '取消管理员'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => updateTeamMemberRole(member, 'admin')}
                              disabled={Boolean(activeMemberActionId)}
                            >
                              {activeMemberActionId === `role:${member.localUserId}:admin` ? '设置中...' : '设为管理员'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => transferTeamOwner(member)}
                            disabled={Boolean(activeMemberActionId)}
                          >
                            {activeMemberActionId === `transfer:${member.localUserId}` ? '转让中...' : '转让队长'}
                          </button>
                          <button
                            type="button"
                            className="danger"
                            onClick={() => removeTeamMember(member)}
                            disabled={Boolean(activeMemberActionId)}
                          >
                            {activeMemberActionId === `remove:${member.localUserId}` ? '移出中...' : '移出成员'}
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}

            <div className="modal-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => loadTeamMembers(memberModalTeam.teamCode)}
                disabled={isMembersLoading || Boolean(activeMemberActionId)}
              >
                刷新成员
              </button>
              <button
                className="ghost-button"
                type="button"
                onClick={() => {
                  setMemberModalTeam(null);
                  setTeamMembers([]);
                  setTeamMembersRequester(null);
                  setMemberActionError('');
                  setMemberActionStatus('');
                  setTeamSettingsForm({ teamName: '', currentPassword: '', nextPassword: '' });
                }}
                disabled={Boolean(activeMemberActionId)}
              >
                关闭
              </button>
            </div>
          </section>
        </div>
      )}

      {isTaskCreateOpen && currentTeam && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-panel task-create-modal" role="dialog" aria-modal="true" aria-label="创建训练任务">
            <div className="panel-title">
              <p className="eyebrow">团队训练任务</p>
              <h2>发布训练任务</h2>
              <p className="team-privacy-note">
                成员从任务入口完成训练后，系统会把训练记录归入该任务，并统计完成次数、分数和完成情况。
              </p>
            </div>

            <TaskRecommendationPanel
              recommendations={teamStats?.taskRecommendations}
              onApply={applyTaskRecommendation}
            />

            <form className="task-form" onSubmit={createTeamTask}>
              <div className="task-assignment-box">
                <span className="task-assignment-title">任务对象</span>
                <div className="task-assignment-toggle">
                  <button
                    type="button"
                    className={taskForm.assignmentType === 'all' ? 'active' : ''}
                    disabled={isTaskActionLoading}
                    onClick={() => setTaskForm({ ...taskForm, assignmentType: 'all', assignedUserIds: [] })}
                  >
                    全员
                  </button>
                  <button
                    type="button"
                    className={taskForm.assignmentType === 'selected' ? 'active' : ''}
                    disabled={isTaskActionLoading}
                    onClick={() => setTaskForm({ ...taskForm, assignmentType: 'selected' })}
                  >
                    指定成员
                  </button>
                </div>
                {taskForm.assignmentType === 'selected' && (
                  <div className="task-member-picker">
                    <span>已选择 {taskForm.assignedUserIds.length} 人</span>
                    {taskAssignableMembers.length === 0 ? (
                      <p>暂无可指派成员，请先确认团队成员已登录加入。</p>
                    ) : (
                      taskAssignableMembers.map((member) => {
                        const checked = taskForm.assignedUserIds.includes(member.appUserId);
                        return (
                          <label key={member.appUserId} className="task-member-option">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={isTaskActionLoading}
                              onChange={() => {
                                const nextIds = checked
                                  ? taskForm.assignedUserIds.filter((id) => id !== member.appUserId)
                                  : [...taskForm.assignedUserIds, member.appUserId];
                                setTaskForm({ ...taskForm, assignedUserIds: nextIds });
                              }}
                            />
                            <span>{member.nickname || member.localUserId}</span>
                            <em>{getTeamRoleLabel(member.role)}</em>
                          </label>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              <label className="field">
                <span>任务名称</span>
                <input
                  value={taskForm.title}
                  disabled={isTaskActionLoading}
                  onChange={(event) => setTaskForm({ ...taskForm, title: event.target.value })}
                  placeholder="例如：本周政策辩被质询训练"
                  maxLength={80}
                />
              </label>

              <label className="field">
                <span>辩题</span>
                <textarea
                  value={taskForm.topic}
                  disabled={isTaskActionLoading}
                  onChange={(event) => setTaskForm({ ...taskForm, topic: event.target.value })}
                  placeholder="请输入本次任务指定辩题"
                  rows={3}
                />
              </label>

              <div className="task-form-grid">
                <OptionGroup
                  label="用户立场"
                  options={sides}
                  value={taskForm.userSide}
                  disabled={isTaskActionLoading}
                  onChange={(value) => setTaskForm({ ...taskForm, userSide: value })}
                />
                <OptionGroup
                  label="训练模式"
                  options={trainingModes.map((mode) => ({ label: mode.label, value: mode.value }))}
                  value={taskForm.mode}
                  disabled={isTaskActionLoading}
                  onChange={(value) => setTaskForm({ ...taskForm, mode: value })}
                />
                <OptionGroup
                  label="难度"
                  options={difficulties}
                  value={taskForm.difficulty}
                  disabled={isTaskActionLoading}
                  onChange={(value) => setTaskForm({ ...taskForm, difficulty: value })}
                />
                <OptionGroup
                  label="AI 风格"
                  options={celebrityDebaters}
                  value={taskForm.styleId}
                  disabled={isTaskActionLoading}
                  onChange={(value) => setTaskForm({ ...taskForm, styleId: value })}
                />
              </div>

              <div className="task-form-row">
                <label className="field">
                  <span>要求完成次数</span>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={taskForm.requiredCount}
                    disabled={isTaskActionLoading}
                    onChange={(event) => setTaskForm({ ...taskForm, requiredCount: event.target.value })}
                  />
                </label>
                <label className="field">
                  <span>截止时间</span>
                  <input
                    type="datetime-local"
                    value={taskForm.deadline}
                    disabled={isTaskActionLoading}
                    onChange={(event) => setTaskForm({ ...taskForm, deadline: event.target.value })}
                  />
                </label>
              </div>

              <label className="field">
                <span>任务说明</span>
                <textarea
                  value={taskForm.description}
                  disabled={isTaskActionLoading}
                  onChange={(event) => setTaskForm({ ...taskForm, description: event.target.value })}
                  placeholder="例如：重点训练政策边界、执行成本和误伤问题。"
                  rows={4}
                  maxLength={500}
                />
              </label>

              {taskActionError && <div className="error-box">{taskActionError}</div>}

              <div className="modal-actions">
                <button className="primary-button" type="submit" disabled={isTaskActionLoading}>
                  {isTaskActionLoading ? '发布中...' : '发布任务'}
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  disabled={isTaskActionLoading}
                  onClick={() => {
                    setIsTaskCreateOpen(false);
                    setTaskActionError('');
                  }}
                >
                  取消
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {longOutputPromptMode && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-panel" role="dialog" aria-modal="true" aria-label="完整输出提示">
            <div className="panel-title">
              <p className="eyebrow">{getOptionLabel(trainingModes, longOutputPromptMode)}</p>
              <h2>准备完整输出</h2>
              <p className="team-privacy-note">
                该环节须要一个较长时间的完整输出，请您事先做好论点等的准备。受录音技术限制，单次录音尽量不要超过30秒。例如，一篇三分钟的一辩稿请录六次音来完成输入。
              </p>
            </div>
            <div className="modal-actions single">
              <button className="primary-button" type="button" onClick={() => setLongOutputPromptMode('')}>
                我知道了
              </button>
            </div>
          </section>
        </div>
      )}

      {activeTab === 'training' && (
      <>
      {!hasSessionContent && setupStep === 'mode' && (
      <>
        <section className="mode-selector-panel" aria-label="单项训练模式">
          {trainingModes.map((mode) => (
            <button
              type="button"
              key={mode.value}
              className={config.trainingMode === mode.value ? 'active' : ''}
              onClick={() => selectTrainingMode(mode.value)}
              disabled={isBusy || isTraining || hasSessionContent}
            >
              <strong>{mode.label}</strong>
              <span>{mode.description}</span>
            </button>
          ))}
        </section>
        <button className="ghost-button setup-back-button" onClick={goToTopicStep} disabled={isBusy}>
          上一步
        </button>
      </>
      )}

      {setupStep !== 'mode' && (
      <section className="arena-hero">
        <div className="hero-copy">
          <p className="eyebrow">锋辩</p>
          <h1>{heroTitle}</h1>
          <p className="subtitle">
            {getHeroSubtitle(config.trainingMode)}
          </p>
        </div>

        <div className="scoreboard" aria-label="训练状态">
          <div>
            <span>当前轮次</span>
            <strong>{currentRound} / {config.rounds}</strong>
          </div>
          <div>
            <span>我的立场</span>
            <strong>{selectedSideLabel}</strong>
          </div>
          <div>
            <span>难度</span>
            <strong>{selectedDifficultyLabel}</strong>
          </div>
          <div>
            <span>训练模式</span>
            <strong>{selectedTrainingMode?.label || '待选择'}</strong>
          </div>
        </div>
      </section>
      )}

      {activeTaskSession && (
        <section className="task-session-banner">
          <span>团队任务</span>
          <strong>{activeTaskSession.title}</strong>
          <small>
            参数已锁定：{getOptionLabel(trainingModes, activeTaskSession.mode)} · {getOptionLabel(difficulties, activeTaskSession.difficulty)} · {getOptionLabel(celebrityDebaters, activeTaskSession.styleId) || '普通 AI'}
          </small>
          <small>本次复盘保存后会自动计入该任务完成次数。</small>
        </section>
      )}

      {!hasSessionContent && (setupStep === 'rounds' || setupStep === 'defensePrep' || setupStep === 'freeDebatePrep' || setupStep === 'ready') && (
        <section className="match-strip" aria-label="对阵信息">
          <div className="side-card user-side">
            <span>你方</span>
            <strong>{selectedSideLabel}</strong>
          </div>
          <div className="versus-mark">VS</div>
          <div className="side-card ai-side">
            <span>{isCelebrityMode ? '明星辩手模式' : 'AI 攻辩方'}</span>
            <strong>{isCelebrityMode ? `${selectedDebater.shortName} · ${opponentSideLabel}` : opponentSideLabel}</strong>
          </div>
        </section>
      )}

      <section className={`layout ${hasSessionContent ? 'debate-layout' : 'setup-layout'}`}>
        {!hasSessionContent && setupStep !== 'mode' && (
        <aside className="panel setup-panel">
          <div className="panel-title">
            <p className="eyebrow">赛前设置</p>
            <h2>{getSetupTitle(setupStep)}</h2>
          </div>

          <div className="setup-progress" aria-label="赛前设置进度">
            <span className={setupStep === 'topic' ? 'active' : 'done'}>1 辩题</span>
            <span className={setupStep === 'mode' ? 'active' : setupStep === 'topic' ? '' : 'done'}>2 模式</span>
            <span className={setupStep === 'rounds' || setupStep === 'defensePrep' || setupStep === 'freeDebatePrep' || setupStep === 'ready' ? 'active' : ''}>3 开赛</span>
          </div>

          {setupStep === 'topic' ? (
            <>
              <label className="field">
                <span>辩题</span>
                <textarea
                  value={config.topic}
                  disabled={isBusy}
                  onChange={(event) => updateConfig({ ...config, topic: event.target.value })}
                  placeholder="例如：中学生使用 AI 工具利大于弊"
                  rows={4}
                />
              </label>

              <div className="topic-generator">
                <OptionGroup
                  label="随机辩题方向"
                  options={topicDirections}
                  value={topicDirection}
                  disabled={isBusy}
                  onChange={(value) => {
                    setTopicDirection(value);
                    setGeneratedTopics([]);
                  }}
                  className="topic-direction-options"
                />
                <button
                  type="button"
                  className="topic-generate-button"
                  onClick={generateTopics}
                  disabled={isBusy}
                >
                  随机生成候选辩题
                </button>
                {generatedTopics.length > 0 && (
                  <div className="generated-topic-list" aria-label="候选辩题">
                    {generatedTopics.map((topic) => (
                      <button
                        type="button"
                        key={topic}
                        className={topic === config.topic ? 'selected' : ''}
                        onClick={() => selectGeneratedTopic(topic)}
                        disabled={isBusy}
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <OptionGroup
                label="我的立场"
                options={sides}
                value={config.userSide}
                disabled={isBusy}
                onChange={(value) => updateConfig({ ...config, userSide: value })}
              />

              <OptionGroup
                label="明星辩手模式"
                options={celebrityDebaters}
                value={config.celebrityDebater}
                disabled={isBusy}
                onChange={selectCelebrityDebater}
                className="celebrity-options"
              />

              {isCelebrityMode && (
                <p className="mode-note">
                  已启用市赛难度。{selectedDebater?.description || '该模式仅做公开表达风格的训练模拟，不代表人物本人观点或真实发言。'}以上为基于公开表达特征的风格化模拟，仅用于辩论训练，不代表相关人物本人观点或真实发言。
                </p>
              )}

              <OptionGroup
                label="难度"
                options={difficulties}
                value={config.difficulty}
                disabled={isBusy || isCelebrityMode}
                onChange={(value) => updateConfig({ ...config, difficulty: value })}
              />

              <button className="primary-button" onClick={goToModeStep} disabled={isBusy}>
                下一步：选择训练模式
              </button>
            </>
          ) : (
            <>
              <div className="selected-topic-card">
                <span>已选辩题</span>
                <strong>{config.topic}</strong>
                <button type="button" onClick={goToTopicStep} disabled={isBusy}>
                  修改辩题
                </button>
              </div>

              <div className="selected-topic-card">
                <span>已选模式</span>
                <strong>{selectedTrainingMode?.label || '待选择'}</strong>
                <button type="button" onClick={goToModeStep} disabled={isBusy}>
                  修改模式
                </button>
              </div>

              {setupStep === 'rounds' && (
                <>
                  <OptionGroup
                    label="轮数"
                    options={roundOptions.map((value) => ({ label: `${value}轮`, value }))}
                    value={config.rounds}
                    disabled={isBusy}
                    onChange={(value) => updateConfig({ ...config, rounds: value })}
                  />

                  <div className="round-progress" aria-label="轮次进度">
                    {Array.from({ length: config.rounds }, (_, index) => (
                      <span
                        key={index}
                        className={index < currentRound ? 'active' : ''}
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                </>
              )}

              {setupStep === 'defensePrep' && (
                <div className="defense-prep-card">
                  <div className="prep-context-grid" aria-label="防守训练上下文">
                    <div>
                      <span>你方立场</span>
                      <strong>{selectedSideLabel}</strong>
                    </div>
                    <div>
                      <span>AI 质询方</span>
                      <strong>{opponentSideLabel}</strong>
                    </div>
                    <div>
                      <span>训练轮数</span>
                      <strong>{config.rounds}轮</strong>
                    </div>
                  </div>
                  <label className="field">
                    <span>己方分论点与论据</span>
                    <textarea
                      value={defensePrep}
                      disabled={isBusy}
                      onChange={(event) => {
                        setDefensePrep(event.target.value);
                        if (error) setError('');
                      }}
                      placeholder={'请写下你方准备防守的几个分论点和论据。例如：\n1. 手机可以作为学习工具：查资料、看教学视频、记录作业。\n论据：部分学校已在课堂中使用平板或学习终端辅助教学。\n\n2. 手机能提高安全联络效率：突发情况能及时联系家长或老师。\n论据：校园突发事件中，及时联络能降低沟通成本。'}
                      rows={8}
                    />
                  </label>
                  <p className="mode-note">开始后，AI 会站在对立面，根据你填写的分论点和论据进行质询；你只需要防守，不要反问。</p>
                </div>
              )}

              {setupStep === 'freeDebatePrep' && (
                <div className="defense-prep-card">
                  <div className="prep-context-grid" aria-label="自由辩论上下文">
                    <div>
                      <span>我方立场</span>
                      <strong>{selectedSideLabel}</strong>
                    </div>
                    <div>
                      <span>AI 对立面</span>
                      <strong>{opponentSideLabel}</strong>
                    </div>
                    <div>
                      <span>训练轮数</span>
                      <strong>{config.rounds}轮</strong>
                    </div>
                  </div>
                  <label className="field">
                    <span>自由辩论主要论点</span>
                    <textarea
                      value={freeDebatePrep}
                      disabled={isBusy}
                      onChange={(event) => {
                        setFreeDebatePrep(event.target.value);
                        if (error) setError('');
                      }}
                      placeholder="请写下你方在自由辩论中准备坚持的主要论点和论据。AI 将只基于这些内容进行反问和质询，不会自行添加你的定义。"
                      rows={8}
                    />
                  </label>
                  <p className="mode-note">开始后，AI 只能基于你在这里写下的定义、论点、论据，以及后续对话中真实说出的内容进行交锋。</p>
                </div>
              )}

              <div className="button-stack">
                <button
                  className="primary-button"
                  onClick={
                    setupStep === 'rounds' && config.trainingMode === 'defense'
                      ? goToDefensePrepStep
                      : setupStep === 'rounds' && config.trainingMode === 'free_debate'
                        ? goToFreeDebatePrepStep
                        : startTraining
                  }
                  disabled={isBusy}
                >
                  {setupStep === 'rounds' && config.trainingMode === 'defense'
                    ? '下一步：填写己方观点'
                    : setupStep === 'rounds' && config.trainingMode === 'free_debate'
                      ? '下一步：填写主要论点'
                    : isLoading && !isTraining
                      ? '生成中...'
                      : config.trainingMode === 'free_debate'
                        ? '进入自由辩论'
                        : '开始训练'}
                </button>
                <button className="ghost-button" onClick={goBackFromSetupStep} disabled={isBusy}>
                  上一步
                </button>
              </div>
            </>
          )}
          {error && !hasSessionContent && <div className="error-box setup-error">{error}</div>}
        </aside>
        )}

        {hasSessionContent && (
        <section className="panel coach-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">攻辩记录</p>
              <h2>{config.topic || '等待输入辩题'}</h2>
            </div>
            <span className="badge">
              {isCelebrityMode ? `${selectedDebater.shortName} · 市赛` : `${selectedSideLabel}训练`}
            </span>
            {hasSessionContent && (
              <button className="compact-reset-button" type="button" onClick={resetTraining} disabled={isBusy || isRecording}>
                重新设置
              </button>
            )}
          </div>

          <div className="conversation">
            {history.length === 0 ? (
              <div className="empty-state">
                <span className="empty-light" />
                <strong>赛场待命</strong>
                <p>{getEmptyTrainingHint(config.trainingMode, config.userSide)}</p>
              </div>
            ) : (
              history.map((item, index) => (
                <article className={`message ${item.role}`} key={`${item.role}-${index}`}>
                  <span>{item.role === 'ai' ? 'AI 攻辩方' : '我的回答'}</span>
                  <p>{formatConversationContent(item.content, item.role)}</p>
                </article>
              ))
            )}

            {isLoading && isTraining && (
              <div className="message ai thinking">
                <span>AI 攻辩方</span>
                <p>正在组织追问<span className="dot-loader" /></p>
              </div>
            )}
          </div>

          {isTraining && (
            <div className="answer-box">
              {isFinished ? (
                <div className="finish-hint">训练轮数已完成，可以结束并生成复盘报告。</div>
              ) : (
                <>
                  <div className="round-card">
                    <span>第 {currentRound} / {config.rounds} 轮 · {getRoundPromptLabel(config.trainingMode)}</span>
                    <p>{latestAiMessage ? formatConversationContent(latestAiMessage, 'ai') : getEmptyTrainingHint(config.trainingMode, config.userSide)}</p>
                  </div>
                  <textarea
                    value={answer}
                    disabled={isBusy}
                    onChange={(event) => {
                      setAnswer(event.target.value);
                      if (error) setError('');
                      if (polishResult) setPolishResult(null);
                    }}
                    placeholder={getAnswerPlaceholder(config.trainingMode)}
                    rows={4}
                  />
                  <div className="polish-mode-panel">
                    <div className="polish-mode-label">
                      <span>当前训练模式：{getOptionLabel(trainingModes, config.trainingMode) || '通用整理'}</span>
                      <strong>整理表达选项</strong>
                    </div>
                    <div className="polish-type-grid">
                      {currentPolishOptions.map((option) => (
                        <button
                          type="button"
                          key={option.id}
                          className={option.id === activePolishType ? 'active' : ''}
                          onClick={() => {
                            setSelectedPolishType(option.id);
                            if (polishResult) setPolishResult(null);
                          }}
                          disabled={isBusy || isRecording}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="speech-panel">
                    <button
                      type="button"
                      className={`record-button ${isRecording ? 'recording' : ''}`}
                      onClick={isRecording ? stopAudioRecording : startAudioRecording}
                      disabled={isBusy}
                    >
                      {isRecording ? `停止并识别 ${formatDuration(recordingDuration)}` : `录音回答（${recordingLimitHint}）`}
                    </button>
                    <button
                      type="button"
                      className="polish-button"
                      onClick={() => polishAnswer(activePolishType)}
                      disabled={isBusy || isRecording || !answer.trim()}
                    >
                      {isPolishing ? '整理中...' : '整理表达'}
                    </button>
                  </div>
                  {(recordingStatus || recordingError) && (
                    <div className={recordingError ? 'speech-message error' : 'speech-message'}>
                      {recordingError || recordingStatus}
                    </div>
                  )}
                  {recordedAudioUrl && (
                    <audio className="recording-preview" controls src={recordedAudioUrl}>
                      当前浏览器不支持录音回放。
                    </audio>
                  )}
                  {polishResult && (
                    <div className="polish-card">
                      <div className="polish-card-header">
                        <span>表达整理</span>
                        <strong>先选稿，再提交</strong>
                      </div>
                      <div className="polish-option">
                        <span>原始文本</span>
                        <p>{polishResult.original}</p>
                      </div>
                      {(polishResult.options || []).map((option) => (
                        <div
                          className={`polish-option ${option.id === polishResult.selectedType ? 'featured' : ''}`}
                          key={option.id}
                        >
                          <span>{option.label}</span>
                          <p>{option.text}</p>
                          <button type="button" onClick={() => usePolishedAnswer(option.text)}>
                            使用{option.label}
                          </button>
                        </div>
                      ))}
                      <div className="polish-tip">{polishResult.tip}</div>
                    </div>
                  )}
                  <button className="primary-button" onClick={submitAnswer} disabled={isBusy || isRecording}>
                    {isLoading ? '分析中...' : '提交回答'}
                  </button>
                </>
              )}

              <button className="secondary-button" onClick={finishAndReview} disabled={isBusy || isRecording || !history.length}>
                结束并复盘
              </button>
              {(isReviewing || reviewGenerationStatus === 'error') && (
                <ReviewGeneratingCard status={reviewGenerationStatus} error={reviewLoadingError} />
              )}
            </div>
          )}

          {error && <div className="error-box">{error}</div>}
        </section>
        )}
      </section>

      {review && (
        <section className="panel review-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">训练复盘</p>
              <h2>复盘报告</h2>
            </div>
          </div>
          <ReviewReport
            reviewText={review}
            structuredReview={structuredReview}
            fallbackMode={config.trainingMode}
            assistantContext={{
              topic: config.topic,
              mode: config.trainingMode,
              modeDisplayName: getOptionLabel(trainingModes, config.trainingMode),
              difficulty: config.difficulty,
              userSide: config.userSide,
              aiSide: getOpponentSideValue(config.userSide),
              messages: history
            }}
          />
          <div className="next-training-card">
            <div>
              <span>下一次训练</span>
              <h3>复盘之后，直接接着练</h3>
              <p>可以保持当前辩题和设置，也可以围绕本轮最低维度做一次针对性训练。</p>
            </div>
            <div className="next-training-actions">
              <button type="button" onClick={continueSameTrainingMode}>
                继续练同一模式
              </button>
              <button type="button" onClick={practiceWeakestDimensionAgain}>
                针对最低维度再练一次
              </button>
              <button type="button" onClick={switchToRecommendedTrainingMode}>
                换成推荐模式训练
              </button>
            </div>
          </div>
        </section>
      )}
      </>
      )}

      {activeTab === 'mine' && (
      <section className="panel history-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">个人训练</p>
            <h2>我的记录</h2>
          </div>
          {isHistoryLoading && <span className="badge">正在同步最新训练数据…</span>}
        </div>
        <p className="anonymous-note">
          {myRecordsScopeLabel}
        </p>
        {saveStatus && <div className="history-status">{saveStatus}</div>}
        {historyError && <div className="error-box">{historyError}</div>}
        <RecordFilterBar
          filters={myRecordFilters}
          onChange={updateMyRecordFilters}
          onClear={clearMyRecordFilters}
        />

        {!isHistoryLoading && displayedRecords.length === 0 ? (
          <div className="history-empty">
            {isDefaultRecordFilters(myRecordFilters) ? emptyRecordsMessage : '当前筛选条件下暂无训练记录。'}
            {!isDefaultRecordFilters(myRecordFilters) && (
              <button type="button" className="filter-clear-button" onClick={clearMyRecordFilters}>
                清除筛选
              </button>
            )}
          </div>
        ) : (
          <div className="history-list">
            {displayedRecords.map((record) => {
              const recordKey = record.id || record.createdAt;
              const selectedRecordKey = selectedRecord?.id || selectedRecord?.createdAt;
              const isExpanded = selectedRecordKey === recordKey;

              return (
                <div className="history-record-group" key={recordKey}>
                  <button
                    type="button"
                    className={`history-item ${isExpanded ? 'active' : ''}`}
                    onClick={() => setSelectedRecord(isExpanded ? null : record)}
                  >
                    <span>{formatRecordDate(record.createdAt)}</span>
                    <strong>{record.topic}</strong>
                    <small>
                      {getOptionLabel(trainingModes, record.trainingMode) || '自由辩论'} / {getOptionLabel(sides, record.userSide)} / {getOptionLabel(difficulties, record.difficulty)}
                      {record.score !== null && record.score !== undefined ? ` / ${record.score}分` : ''}
                      {record.result ? ` / ${record.result}` : ''}
                    </small>
                  </button>

                  {isExpanded && (
                    <div className="history-detail inline-history-detail">
                      <div className="history-detail-header">
                        <div>
                          <span>{formatRecordDate(record.createdAt)}</span>
                          <h3>{record.topic}</h3>
                        </div>
                        <button type="button" onClick={() => setSelectedRecord(null)}>
                          收起
                        </button>
                      </div>

                      <div className="history-meta">
                        <span>我的立场：{getOptionLabel(sides, record.userSide)}</span>
                        <span>AI 立场：{getOptionLabel(sides, record.aiSide)}</span>
                        <span>难度：{getOptionLabel(difficulties, record.difficulty)}</span>
                        <span>风格：{getOptionLabel(celebrityDebaters, record.styleId) || '普通 AI'}</span>
                      </div>

                      <div className="conversation history-conversation">
                        {(record.messages || []).map((item, index) => (
                          <article className={`message ${item.role}`} key={`${item.role}-${index}`}>
                            <span>{item.role === 'ai' ? 'AI 攻辩方' : '我的回答'}</span>
                            <p>{formatConversationContent(item.content, item.role)}</p>
                          </article>
                        ))}
                      </div>

                      <div className="history-review">
                        <h3>复盘报告</h3>
                        <ReviewReport
                          reviewText={record.review}
                          structuredReview={record}
                          fallbackMode={record.trainingMode}
                          assistantContext={{
                            topic: record.topic,
                            mode: record.trainingMode,
                            modeDisplayName: getOptionLabel(trainingModes, record.trainingMode),
                            difficulty: record.difficulty,
                            userSide: record.userSide,
                            aiSide: record.aiSide,
                            messages: record.messages || []
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <RecordsLoadMore
          hasMore={displayedRecordsPage.hasMore}
          isLoading={displayedRecordsPage.isLoadingMore}
          recordsCount={displayedRecords.length}
          onLoadMore={loadMoreMyRecords}
        />
      </section>
      )}

      {activeTab === 'ability' && (
        <AbilityPanel
          estimate={displayedAbilityEstimate}
          isLoading={isAbilityLoading}
          error={abilityError}
          spaceLabel={currentSpaceLabel}
          scopeLabel={abilityScopeLabel}
          emptyMessage={emptyAbilityMessage}
        />
      )}

      {activeTab === 'experience' && (
        <DebateExperienceChat trainingProfile={linWanTrainingProfile} isLoggedIn={isLoggedIn} />
      )}

      {activeTab === 'teams' && (
        <section className="panel my-teams-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">团队空间</p>
              <h2>我的团队</h2>
            </div>
            <button
              type="button"
              className="compact-reset-button"
              onClick={() => {
                setJoinError('');
                setJoinSuccess('');
                setJoinedTeamPrompt(null);
                setTeamFormMode('join');
                setIsJoinModalOpen(true);
              }}
            >
              加入 / 创建团队
            </button>
          </div>

          {isTeamsLoading && <div className="history-status">正在加载团队列表...</div>}
          {joinedTeams.length === 0 ? (
            <div className="history-empty">暂无已加入团队</div>
          ) : (
            <div className="team-list">
              {joinedTeams.map((team) => (
                <article className="team-list-item" key={team.teamCode}>
                  <div>
                    <span>{team.teamCode}</span>
                    <strong>{team.teamName || team.teamCode}</strong>
                    <small>我的昵称：{team.nickname || '未命名'} · 角色：{getTeamRoleLabel(team.role)}</small>
                  </div>
                  <div className="team-list-actions">
                    <button type="button" onClick={() => viewTeamData(team)}>
                      查看团队数据
                    </button>
                    <button type="button" onClick={() => openTeamMembers(team)}>
                      成员管理
                    </button>
                    <button type="button" className="danger" onClick={() => setLeaveTarget(team)}>
                      退出团队
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'team' && (
        <TeamDataPanel
          records={teamRecords}
          stats={teamStats}
          team={currentTeam}
          tasks={teamTasks}
          activePanelTab={activeTeamPanelTab}
          onPanelTabChange={setActiveTeamPanelTab}
          isTasksLoading={isTeamTasksLoading}
          tasksError={teamTasksError}
          taskActionError={taskActionError}
          taskActionStatus={taskActionStatus}
          selectedTaskDetail={selectedTaskDetail}
          isTaskDetailLoading={isTaskDetailLoading}
          taskDetailError={taskDetailError}
          selectedRecord={selectedRecord}
          isLoading={isTeamDataLoading}
          error={teamDataError}
          onSelectRecord={setSelectedRecord}
          onClearRecord={() => setSelectedRecord(null)}
          recordFilters={teamRecordFilters}
          recordPage={teamRecordsPage}
          onRecordFiltersChange={updateTeamRecordFilters}
          onClearRecordFilters={clearTeamRecordFilters}
          onLoadMoreRecords={loadMoreTeamRecords}
          onOpenTaskCreate={() => {
            setTaskForm({
              ...defaultTaskForm,
              topic: config.topic || '',
              userSide: config.userSide || 'affirmative',
              mode: config.trainingMode || 'free_debate',
              difficulty: config.difficulty || 'novice',
              styleId: config.celebrityDebater || 'none',
              assignmentType: 'all',
              assignedUserIds: []
            });
            setTaskActionError('');
            setTaskActionStatus('');
            setIsTaskCreateOpen(true);
            loadTeamMembers(currentTeam.teamCode);
          }}
          onStartTask={startTaskTraining}
          onOpenTaskDetail={openTaskDetail}
          onCloseTask={closeTeamTask}
          onClearTaskDetail={() => {
            setSelectedTaskDetail(null);
            setTaskDetailError('');
          }}
        />
      )}
    </main>
  );
}

function isDefaultRecordFilters(filters = {}) {
  const current = { ...defaultRecordFilters, ...filters };
  return current.mode === 'all' && current.sortBy === 'date' && current.timeRange === 'all';
}

function RecordFilterBar({ filters, onChange, onClear }) {
  const current = { ...defaultRecordFilters, ...filters };
  const modeOptions = [
    { label: '全部模式', value: 'all' },
    { label: '立论训练', value: 'constructive' },
    { label: '攻辩小结', value: 'summary' },
    { label: '自由辩论', value: 'free_debate' },
    { label: '攻辩训练', value: 'attack' },
    { label: '防守训练', value: 'defense' },
    { label: '结辩训练', value: 'closing' }
  ];
  const sortOptions = [
    { label: '按日期', value: 'date' },
    { label: '按分数', value: 'score' }
  ];
  const timeOptions = [
    { label: '全部时间', value: 'all' },
    { label: '最近7天', value: '7d' }
  ];

  const renderChips = (field, options) => (
    <div className="record-filter-chips">
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          className={current[field] === option.value ? 'active' : ''}
          onClick={() => onChange({ ...current, [field]: option.value })}
        >
          {option.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="record-filter-panel">
      <div className="record-filter-row">
        <span>训练模式</span>
        {renderChips('mode', modeOptions)}
      </div>
      <div className="record-filter-row compact">
        <span>排序</span>
        {renderChips('sortBy', sortOptions)}
      </div>
      <div className="record-filter-row compact">
        <span>时间</span>
        {renderChips('timeRange', timeOptions)}
      </div>
      {!isDefaultRecordFilters(current) && (
        <button type="button" className="filter-clear-button" onClick={onClear}>
          清除筛选
        </button>
      )}
    </div>
  );
}

function RecordsLoadMore({ hasMore, isLoading, recordsCount, onLoadMore }) {
  if (!recordsCount) return null;

  return (
    <div className="records-load-more">
      {hasMore ? (
        <button type="button" onClick={onLoadMore} disabled={isLoading}>
          {isLoading ? '正在加载...' : '加载更多'}
        </button>
      ) : (
        <span>没有更多记录了</span>
      )}
    </div>
  );
}

function TeamDataPanel({
  records,
  stats,
  team,
  tasks,
  activePanelTab,
  onPanelTabChange,
  isTasksLoading,
  tasksError,
  taskActionError,
  taskActionStatus,
  selectedTaskDetail,
  isTaskDetailLoading,
  taskDetailError,
  selectedRecord,
  isLoading,
  error,
  onSelectRecord,
  onClearRecord,
  recordFilters,
  recordPage,
  onRecordFiltersChange,
  onClearRecordFilters,
  onLoadMoreRecords,
  onOpenTaskCreate,
  onStartTask,
  onOpenTaskDetail,
  onCloseTask,
  onClearTaskDetail
}) {
  const memberStats = Array.isArray(stats?.memberStats) ? stats.memberStats : [];
  const countRanking = [...memberStats].sort((a, b) => b.count - a.count);
  const scoreRanking = [...memberStats].sort((a, b) => (b.averageScore || 0) - (a.averageScore || 0));
  const isManager = isTeamManagerRole(team?.role);

  return (
    <section className="panel team-data-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">团队复盘</p>
          <h2>{team?.teamName || team?.teamCode || '团队数据'}</h2>
        </div>
        {(isLoading || isTasksLoading) && <span className="badge">正在同步最新训练数据…</span>}
      </div>

      {error && <div className="error-box">{error}</div>}
      {tasksError && <div className="error-box">{tasksError}</div>}
      {taskActionError && <div className="error-box">{taskActionError}</div>}
      {taskActionStatus && <div className="history-status">{taskActionStatus}</div>}

      <div className="team-panel-tabs">
        <button
          type="button"
          className={activePanelTab === 'overview' ? 'active' : ''}
          onClick={() => onPanelTabChange('overview')}
        >
          数据概览
        </button>
        <button
          type="button"
          className={activePanelTab === 'tasks' ? 'active' : ''}
          onClick={() => onPanelTabChange('tasks')}
        >
          训练任务
        </button>
      </div>

      {activePanelTab === 'overview' ? (
      <>
      <div className="team-stat-grid">
        <div className="stat-card">
          <span>团队训练总次数</span>
          <strong>{stats?.totalRecords ?? 0}</strong>
        </div>
        <div className="stat-card">
          <span>团队平均分</span>
          <strong>{formatNullableNumber(stats?.averageScore)}</strong>
        </div>
        <div className="stat-card">
          <span>团队最高分</span>
          <strong>{formatNullableNumber(stats?.highestScore)}</strong>
        </div>
      </div>

      <div className="team-rank-grid">
        <RankingList title="成员训练次数排行" items={countRanking} metric={(item) => `${item.count} 次`} />
        <RankingList title="成员平均分排行" items={scoreRanking} metric={(item) => `${formatNullableNumber(item.averageScore)} 分`} />
      </div>

      <TeamMemberProfiles profiles={stats?.memberProfiles || []} />
      <TeamCommonProblems problems={stats?.commonProblems || []} />

      <div className="team-recent-section">
        <h3>最近训练记录</h3>
        <RecordFilterBar
          filters={recordFilters}
          onChange={onRecordFiltersChange}
          onClear={onClearRecordFilters}
        />
        {records.length === 0 ? (
          <div className="history-empty">
            {isDefaultRecordFilters(recordFilters) ? '暂无训练记录' : '当前筛选条件下暂无训练记录。'}
            {!isDefaultRecordFilters(recordFilters) && (
              <button type="button" className="filter-clear-button" onClick={onClearRecordFilters}>
                清除筛选
              </button>
            )}
          </div>
        ) : (
          <div className="history-list">
            {records.map((record) => {
              const recordKey = record.id || record.createdAt;
              const selectedRecordKey = selectedRecord?.id || selectedRecord?.createdAt;
              const isExpanded = selectedRecordKey === recordKey;

              return (
                <div className="history-record-group" key={recordKey}>
                  <button
                    type="button"
                    className={`history-item ${isExpanded ? 'active' : ''}`}
                    onClick={() => onSelectRecord(isExpanded ? null : record)}
                  >
                    <span>{formatRecordDate(record.createdAt)} · {record.nickname || '未命名成员'}</span>
                    <strong>{record.topic}</strong>
                    <small>
                      {getOptionLabel(trainingModes, record.trainingMode) || '自由辩论'} / {getOptionLabel(difficulties, record.difficulty)}
                      {record.score !== null && record.score !== undefined ? ` / ${record.score}分` : ''}
                      {record.result ? ` / ${record.result}` : ''}
                    </small>
                  </button>

                  {isExpanded && (
                    <div className="inline-history-detail">
                      <RecordDetail record={record} onClose={onClearRecord} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <RecordsLoadMore
          hasMore={recordPage?.hasMore}
          isLoading={recordPage?.isLoadingMore}
          recordsCount={records.length}
          onLoadMore={onLoadMoreRecords}
        />
      </div>
      </>
      ) : (
        <TeamTasksPanel
          tasks={tasks}
          isOwner={isManager}
          selectedTaskDetail={selectedTaskDetail}
          isTaskDetailLoading={isTaskDetailLoading}
          taskDetailError={taskDetailError}
          onOpenTaskCreate={onOpenTaskCreate}
          onStartTask={onStartTask}
          onOpenTaskDetail={onOpenTaskDetail}
          onCloseTask={onCloseTask}
          onClearTaskDetail={onClearTaskDetail}
        />
      )}
    </section>
  );
}

function AuthModal({ mode, form, error, isLoading, onSubmit, onChange, onModeChange, onClose }) {
  const isRegister = mode === 'register';
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-panel auth-modal" role="dialog" aria-modal="true" aria-label={isRegister ? '注册账号' : '登录账号'}>
        <div className="panel-title">
          <p className="eyebrow">锋辩账号</p>
          <h2>{isRegister ? '注册账号' : '登录账号'}</h2>
          <p className="team-privacy-note">
            登录后可跨设备保存训练记录、团队身份和任务进度。游客模式仍可临时训练，但不能使用团队功能。
          </p>
        </div>

        <form className="team-join-form auth-form" onSubmit={onSubmit}>
          <label>
            用户名
            <input
              value={form.username}
              onChange={(event) => onChange({ ...form, username: event.target.value })}
              placeholder="请输入英文字母、数字或下划线"
              autoComplete="username"
              disabled={isLoading}
            />
          </label>

          {isRegister && (
            <label>
              昵称
              <input
                value={form.displayName}
                onChange={(event) => onChange({ ...form, displayName: event.target.value })}
                placeholder="训练中展示的昵称"
                autoComplete="nickname"
                disabled={isLoading}
              />
            </label>
          )}

          <label>
            密码
            <div className="password-input-wrap">
              <input
                type={isPasswordVisible ? 'text' : 'password'}
                value={form.password}
                onChange={(event) => onChange({ ...form, password: event.target.value })}
                placeholder="至少 6 位"
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setIsPasswordVisible((current) => !current)}
                disabled={isLoading || !form.password}
                aria-label={isPasswordVisible ? '隐藏密码' : '显示密码'}
              >
                {isPasswordVisible ? '隐藏' : '显示'}
              </button>
            </div>
          </label>

          {isRegister && (
            <label>
              确认密码
              <div className="password-input-wrap">
                <input
                  type={isConfirmPasswordVisible ? 'text' : 'password'}
                  value={form.confirmPassword}
                  onChange={(event) => onChange({ ...form, confirmPassword: event.target.value })}
                  placeholder="再次输入密码"
                  autoComplete="new-password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setIsConfirmPasswordVisible((current) => !current)}
                  disabled={isLoading || !form.confirmPassword}
                  aria-label={isConfirmPasswordVisible ? '隐藏确认密码' : '显示确认密码'}
                >
                  {isConfirmPasswordVisible ? '隐藏' : '显示'}
                </button>
              </div>
            </label>
          )}

          {error && <div className="error-box">{error}</div>}

          <div className="modal-actions">
            <button className="primary-button" type="submit" disabled={isLoading}>
              {isLoading ? '处理中...' : isRegister ? '注册' : '登录'}
            </button>
            <button className="ghost-button" type="button" onClick={onClose} disabled={isLoading}>
              取消
            </button>
          </div>
          <button
            className="link-button"
            type="button"
            onClick={() => onModeChange(isRegister ? 'login' : 'register')}
            disabled={isLoading}
          >
            {isRegister ? '已有账号？去登录' : '没有账号？去注册'}
          </button>
        </form>
      </section>
    </div>
  );
}

function AbilityPanel({ estimate, isLoading, error, spaceLabel, scopeLabel, emptyMessage }) {
  const dimensions = Array.isArray(estimate?.dimensions) ? estimate.dimensions : [];
  const history = Array.isArray(estimate?.history) ? estimate.history : [];

  return (
    <section className="panel ability-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">{spaceLabel}</p>
          <h2>辩论能力估测</h2>
        </div>
        {isLoading && <span className="badge">估测中</span>}
      </div>

      {scopeLabel && <p className="anonymous-note">{scopeLabel}</p>}
      {error && <div className="error-box">{error}</div>}

      {!estimate || !estimate.scoredRecordCount ? (
        <div className="history-empty">{emptyMessage || '暂无可估测记录。完成一次带评分的复盘后，这里会生成锋力值和能力曲线。'}</div>
      ) : (
        <>
          <div className="ability-hero">
            <div>
              <span>当前锋力值</span>
              <strong>{formatNullableNumber(estimate.overall)} / 100</strong>
              <small>{estimate.level} · 置信度 {estimate.confidence || 0}%</small>
            </div>
            <p>{estimate.note}</p>
          </div>

          {estimate.roleRecommendation && (
            <div className="role-recommendation-card">
              <span>适合辩位判断</span>
              <strong>推荐辩位：{estimate.roleRecommendation.bestRole}</strong>
              {estimate.roleRecommendation.secondaryRole && (
                <em>备选辩位：{estimate.roleRecommendation.secondaryRole}</em>
              )}
              <p>{estimate.roleRecommendation.reason}</p>
              <p>{estimate.roleRecommendation.advice}</p>
            </div>
          )}

          <div className="ability-grid">
            {dimensions.map((dimension) => (
              <article className="ability-card" key={dimension.key}>
                <div>
                  <span>{dimension.label}</span>
                  <strong>{formatNullableNumber(dimension.score)} / 100</strong>
                </div>
                <div className="ability-bar" aria-hidden="true">
                  <i style={{ width: `${Math.max(4, Math.min(100, dimension.score || 0))}%` }} />
                </div>
                <small>
                  样本 {dimension.records} · 趋势 {formatTrend(dimension.trend)}
                </small>
              </article>
            ))}
          </div>

          <AbilityTrendCharts history={history} dimensions={dimensions} />
        </>
      )}
    </section>
  );
}

function AbilityTrendCharts({ history, dimensions }) {
  const points = history.slice(-18);
  const chartMetas = [
    { key: 'overall', label: '综合锋力', color: '#c8502d', current: points.at(-1)?.overall },
    ...dimensions.map((dimension) => {
      const meta = abilityDimensionMeta.find((item) => item.key === dimension.key) || dimension;
      return { ...meta, current: dimension.score };
    })
  ];

  return (
    <div className="ability-chart-grid">
      {chartMetas.map((meta) => (
        <AbilityTrendCardInteractive key={meta.key} meta={meta} points={points} />
      ))}
    </div>
  );
}

function AbilityTrendCardInteractive({ meta, points }) {
  const [selectedPointIndex, setSelectedPointIndex] = useState(null);
  const pointData = points.map((item, index) => {
    const rawValue = meta.key === 'overall' ? item.overall : item.dimensions?.[meta.key];
    const value = Number(rawValue);

    return {
      ...item,
      pointIndex: index,
      value,
      dimensionName: meta.label,
      dimensionScore: value,
      source: item.source || {}
    };
  });
  const validPoints = pointData.filter((point) => Number.isFinite(point.value));
  const hasValues = validPoints.length > 0;
  const selectedPoint = validPoints.find((point) => point.pointIndex === selectedPointIndex) || null;
  const width = 320;
  const height = 132;
  const padding = 18;

  useEffect(() => {
    setSelectedPointIndex(null);
  }, [meta.key, points.length]);

  function toY(value) {
    return height - padding - (Math.max(0, Math.min(100, Number(value))) / 100) * (height - padding * 2);
  }

  function toX(index) {
    if (points.length <= 1) return width / 2;
    return padding + (index / (points.length - 1)) * (width - padding * 2);
  }

  function togglePoint(index) {
    setSelectedPointIndex((current) => current === index ? null : index);
  }

  return (
    <div className="ability-chart-card">
      <div className="history-detail-header">
        <div>
          <span>{meta.label}</span>
          <h3>{formatNullableNumber(meta.current)} / 100</h3>
        </div>
      </div>

      {points.length < 2 || !hasValues ? (
        <div className="history-empty">再完成一次训练后即可形成趋势曲线。</div>
      ) : (
        <>
          <svg className="ability-chart mini" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${meta.label}变化趋势图`}>
            {[0, 50, 100].map((tick) => (
              <g key={tick}>
                <line x1={padding} x2={width - padding} y1={toY(tick)} y2={toY(tick)} />
                <text x={4} y={toY(tick) + 4}>{tick}</text>
              </g>
            ))}
            <polyline
              points={validPoints.map((point) => `${toX(point.pointIndex)},${toY(point.value)}`).join(' ')}
              stroke={meta.color}
            />
            {validPoints.map((point) => {
              const isSelected = selectedPointIndex === point.pointIndex;
              const x = toX(point.pointIndex);
              const y = toY(point.value);

              return (
                <g key={point.pointIndex}>
                  <circle
                    className="ability-chart-point-hit"
                    cx={x}
                    cy={y}
                    r="10"
                    onClick={() => togglePoint(point.pointIndex)}
                    aria-label={`查看第 ${point.pointIndex + 1} 次训练来源`}
                  />
                  <circle
                    className={`ability-chart-point ${isSelected ? 'selected' : ''}`}
                    cx={x}
                    cy={y}
                    r={isSelected ? 5 : 3.5}
                    onClick={() => togglePoint(point.pointIndex)}
                  />
                </g>
              );
            })}
          </svg>
          {selectedPoint ? (
            <AbilityPointSourceCard point={selectedPoint} />
          ) : (
            <p className="ability-chart-hint">点击曲线上的点查看来源训练。</p>
          )}
        </>
      )}
    </div>
  );
}

function AbilityPointSourceCard({ point }) {
  const source = point?.source || {};
  const topic = source.topic || '未命名辩题';
  const createdAt = source.createdAt || source.created_at || point?.date || '';
  const modeLabel = getAbilityModeLabel(source.modeDisplayName || source.mode);
  const difficultyLabel = getAbilityDifficultyLabel(source.difficulty);
  const sideLabel = getAbilitySideLabel(source.userSide);
  const score = Number.isFinite(Number(source.score)) ? formatNullableNumber(source.score) : '--';
  const dimensionScore = Number.isFinite(Number(point?.dimensionScore)) ? formatNullableNumber(point.dimensionScore) : '--';
  const rows = [
    ['辩题', topic],
    ['时间', createdAt ? formatRecordDate(createdAt) : '时间未知'],
    ['模式', modeLabel || '模式未知'],
    ['难度', difficultyLabel || '难度未知'],
    ['立场', sideLabel || '立场未知'],
    ['总分', `${score} / 100`],
    ['当前维度', point?.dimensionName || '维度未知'],
    ['维度分数', `${dimensionScore} / 100`]
  ];

  if (source.teamName || source.teamCode) {
    rows.push(['团队', source.teamName ? `${source.teamName}${source.teamCode ? `（${source.teamCode}）` : ''}` : source.teamCode]);
  }

  if (source.taskTitle || source.taskId) {
    rows.push(['任务', source.taskTitle || source.taskId]);
  }

  return (
    <div className="ability-source-card">
      <h4>数据来源</h4>
      <div className="ability-source-grid">
        {rows.map(([label, value]) => (
          <div className="ability-source-row" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function getAbilityModeLabel(value) {
  if (!value) return '';
  const aliases = {
    constructive_speech: 'constructive',
    cx_summary: 'summary',
    offensive_cx: 'attack',
    defensive_cx: 'defense',
    closing_speech: 'closing',
    立论训练: 'constructive',
    攻辩小结: 'summary',
    自由辩论: 'free_debate',
    攻辩训练: 'attack',
    防守训练: 'defense',
    结辩训练: 'closing'
  };
  const normalized = aliases[value] || value;
  return getOptionLabel(trainingModes, normalized) || value;
}

function getAbilityDifficultyLabel(value) {
  if (!value) return '';
  const aliases = {
    beginner: 'novice',
    school: 'campus',
    novice: 'novice',
    campus: 'campus',
    city: 'city',
    新手: 'novice',
    校赛: 'campus',
    市赛: 'city'
  };
  const normalized = aliases[value] || value;
  return getOptionLabel(difficulties, normalized) || value;
}

function getAbilitySideLabel(value) {
  if (!value) return '';
  if (value === '正方' || value === '反方') return value;
  return getOptionLabel(sides, normalizeSideValue(value)) || value;
}

function AbilityTrendCard({ meta, points }) {
  const values = points.map((item) => meta.key === 'overall' ? item.overall : item.dimensions?.[meta.key]);
  const hasValues = values.some((value) => Number.isFinite(Number(value)));
  const width = 320;
  const height = 132;
  const padding = 18;

  function toY(value) {
    return height - padding - (Math.max(0, Math.min(100, Number(value))) / 100) * (height - padding * 2);
  }

  function toX(index) {
    if (points.length <= 1) return width / 2;
    return padding + (index / (points.length - 1)) * (width - padding * 2);
  }

  return (
    <div className="ability-chart-card">
      <div className="history-detail-header">
        <div>
          <span>{meta.label}</span>
          <h3>{formatNullableNumber(meta.current)} / 100</h3>
        </div>
      </div>

      {points.length < 2 || !hasValues ? (
        <div className="history-empty">再完成一次训练后即可形成趋势曲线。</div>
      ) : (
        <svg className="ability-chart mini" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${meta.label}变化趋势图`}>
          {[0, 50, 100].map((tick) => (
            <g key={tick}>
              <line x1={padding} x2={width - padding} y1={toY(tick)} y2={toY(tick)} />
              <text x={4} y={toY(tick) + 4}>{tick}</text>
            </g>
          ))}
          <polyline
            points={values.map((value, index) => `${toX(index)},${toY(value)}`).join(' ')}
            stroke={meta.color}
          />
          {values.map((value, index) => (
            <circle key={index} cx={toX(index)} cy={toY(value)} r="3" />
          ))}
        </svg>
      )}
    </div>
  );
}

function TeamTasksPanel({
  tasks = [],
  isOwner,
  selectedTaskDetail,
  isTaskDetailLoading,
  taskDetailError,
  onOpenTaskCreate,
  onStartTask,
  onOpenTaskDetail,
  onCloseTask,
  onClearTaskDetail
}) {
  return (
    <div className="team-tasks-panel">
      <div className="task-panel-header">
        <div>
          <h3>训练任务</h3>
          <p>从任务入口完成训练后，记录会自动计入对应任务。</p>
        </div>
        {isOwner && (
          <button type="button" className="primary-button" onClick={onOpenTaskCreate}>
            创建任务
          </button>
        )}
      </div>

      {tasks.length === 0 ? (
        <div className="history-empty">暂无训练任务</div>
      ) : (
        <div className="task-list">
          {tasks.map((task) => (
            <article className="task-card" key={task.id}>
              <div className="task-card-main">
                <span>{formatTaskDeadline(task.deadline)}</span>
                <h3>{task.title}</h3>
                <p>{task.topic}</p>
              </div>
              <div className="task-meta-grid">
                <span>模式：{getOptionLabel(trainingModes, task.mode) || '自由辩论'}</span>
                <span>难度：{getOptionLabel(difficulties, task.difficulty) || '--'}</span>
                <span>风格：{getOptionLabel(celebrityDebaters, task.styleId) || '普通 AI'}</span>
                <span>任务对象：{getTaskAssignmentLabel(task)}</span>
                <span>状态：{getTaskStatusLabel(task.status)}</span>
                <span>我的进度：{task.completedCount || 0} / {task.requiredCount || 1}</span>
              </div>
              {task.description && <p className="task-description">{task.description}</p>}
              <div className="task-actions">
                <button type="button" onClick={() => onStartTask(task)} disabled={!isTaskActive(task)}>
                  开始训练
                </button>
                <button type="button" className="ghost-button" onClick={() => onOpenTaskDetail(task)}>
                  查看详情
                </button>
                {isOwner && isTaskActive(task) && (
                  <button type="button" className="danger" onClick={() => onCloseTask(task)}>
                    结束任务
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {selectedTaskDetail && (
        <TaskDetail
          detail={selectedTaskDetail}
          isLoading={isTaskDetailLoading}
          error={taskDetailError}
          isOwner={isOwner}
          onClose={onClearTaskDetail}
          onStartTask={onStartTask}
          onCloseTask={onCloseTask}
        />
      )}
    </div>
  );
}

function TaskDetail({ detail, isLoading, error, isOwner, onClose, onStartTask, onCloseTask }) {
  const task = detail.task || {};
  const stats = detail.stats || {};
  const memberProgress = Array.isArray(stats.memberProgress)
    ? stats.memberProgress
    : Array.isArray(detail.memberProgress)
      ? detail.memberProgress
      : [];
  const recentRecords = Array.isArray(stats.recentRecords) ? stats.recentRecords : [];
  const [copyStatus, setCopyStatus] = useState('');
  const totalMembers = Number(stats.totalMembers ?? memberProgress.length) || memberProgress.length;
  const completedMembers = Number(stats.completedMembers ?? memberProgress.filter((member) => member.status === 'completed').length) || 0;
  const completionRate = Number.isFinite(Number(stats.completionRate))
    ? Number(stats.completionRate)
    : totalMembers
      ? Math.round((completedMembers / totalMembers) * 1000) / 10
      : 0;
  const incompleteMembers = memberProgress.filter((member) => member.status !== 'completed');
  const countRanking = [...memberProgress].sort((a, b) => (Number(b.completedCount) || 0) - (Number(a.completedCount) || 0)).slice(0, 5);
  const averageRanking = [...memberProgress]
    .filter((member) => Number.isFinite(Number(member.averageScore)))
    .sort((a, b) => Number(b.averageScore) - Number(a.averageScore))
    .slice(0, 5);
  const recentRecordByMember = new Map();
  recentRecords.forEach((record) => {
    const key = record.appUserId || record.app_user_id || record.localUserId || record.local_user_id || record.nickname;
    if (key && !recentRecordByMember.has(key)) {
      recentRecordByMember.set(key, record);
    }
  });

  async function copyIncompleteMembers() {
    const names = incompleteMembers.map((member) => member.nickname || '未命名成员');
    const text = names.length
      ? `未完成「${task.title || '训练任务'}」的成员：${names.join('、')}`
      : `「${task.title || '训练任务'}」已无人未完成。`;

    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus('已复制未完成名单。');
    } catch {
      setCopyStatus(text);
    }
  }

  return (
    <div className="task-detail">
      <div className="history-detail-header">
        <div>
          <span>{formatTaskDeadline(task.deadline)}</span>
          <h3>{task.title}</h3>
        </div>
        <button type="button" onClick={onClose}>
          收起
        </button>
      </div>

      {isLoading && <div className="history-status">正在加载任务详情...</div>}
      {error && <div className="error-box">{error}</div>}

      <p className="task-detail-topic">{task.topic}</p>
      <div className="history-meta">
        <span>我的进度：{detail.completedCount || 0} / {task.requiredCount || 1}</span>
        <span>团队完成率：{formatNullableNumber(stats.completionRate)}%</span>
        <span>平均分：{formatNullableNumber(stats.averageScore)}</span>
        <span>最高分：{formatNullableNumber(stats.highestScore)}</span>
      </div>

      <div className="task-locked-config">
        <strong>该任务由队长布置，训练参数已锁定。</strong>
        <div className="task-meta-grid">
          <span>任务对象：{getTaskAssignmentLabel(task)}</span>
          <span>状态：{getTaskStatusLabel(task.status)}</span>
          <span>用户立场：{getOptionLabel(sides, task.userSide) || '--'}</span>
          <span>AI 立场：{getOptionLabel(sides, task.aiSide) || '--'}</span>
          <span>训练模式：{getOptionLabel(trainingModes, task.mode) || '--'}</span>
          <span>难度：{getOptionLabel(difficulties, task.difficulty) || '--'}</span>
          <span>AI 风格：{getOptionLabel(celebrityDebaters, task.styleId) || '普通 AI'}</span>
          <span>要求次数：{task.requiredCount || 1}</span>
        </div>
      </div>

      <div className="task-completion-overview">
        <article>
          <span>成员完成进度</span>
          <strong>{completedMembers} / {totalMembers}</strong>
          <div className="task-progress-track" aria-hidden="true">
            <i style={{ width: `${Math.max(0, Math.min(100, completionRate))}%` }} />
          </div>
        </article>
        <article>
          <span>未完成成员</span>
          <strong>{incompleteMembers.length}</strong>
          <button type="button" onClick={copyIncompleteMembers}>
            一键复制催练名单
          </button>
        </article>
        <article>
          <span>最近一次训练</span>
          <strong>{recentRecords[0] ? formatRecordDate(recentRecords[0].createdAt) : '暂无'}</strong>
        </article>
      </div>
      {copyStatus && <div className="history-status">{copyStatus}</div>}

      <div className="task-actions">
        <button type="button" onClick={() => onStartTask(task)} disabled={!isTaskActive(task)}>
          开始训练
        </button>
        {isOwner && task.status === 'active' && (
          <button type="button" className="danger" onClick={() => onCloseTask(task)}>
            关闭任务
          </button>
        )}
      </div>

      <div className="member-progress-wrap">
        <h3>成员完成情况</h3>
        {memberProgress.length === 0 ? (
          <div className="history-empty">暂无成员进度</div>
        ) : (
          <>
            <div className="member-progress-table">
              {memberProgress.map((member) => {
                const memberKey = member.appUserId || member.localUserId || member.nickname;
                const recentRecord = recentRecordByMember.get(memberKey);
                const progressRate = Math.min(100, ((Number(member.completedCount) || 0) / Math.max(1, Number(member.requiredCount) || 1)) * 100);
                return (
                  <article className="member-progress-row" key={memberKey}>
                    <strong>{member.nickname || '未命名成员'}</strong>
                    <span>{member.completedCount} / {member.requiredCount}</span>
                    <span>均分：{formatNullableNumber(member.averageScore)}</span>
                    <span>最高：{formatNullableNumber(member.highestScore)}</span>
                    <span>最近：{recentRecord ? formatRecordDate(recentRecord.createdAt) : '暂无'}</span>
                    <em>{member.status === 'completed' ? '已完成' : '未完成'}</em>
                    <div className="member-progress-track" aria-hidden="true">
                      <i style={{ width: `${progressRate}%` }} />
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="task-rank-grid">
              <RankingList title="训练次数排行" items={countRanking} metric={(item) => `${item.completedCount || 0} 次`} />
              <RankingList title="平均分排行" items={averageRanking} metric={(item) => formatNullableNumber(item.averageScore)} />
            </div>
          </>
        )}
      </div>

      <div className="team-recent-section">
        <h3>最近任务记录</h3>
        {recentRecords.length === 0 ? (
          <div className="history-empty">暂无任务记录</div>
        ) : (
          <div className="history-list">
            {recentRecords.map((record) => (
              <div className="history-item static" key={record.id || record.createdAt}>
                <span>{formatRecordDate(record.createdAt)} · {record.nickname || '未命名成员'}</span>
                <strong>{record.topic}</strong>
                <small>
                  {getOptionLabel(trainingModes, record.trainingMode) || '自由辩论'}
                  {record.score !== null && record.score !== undefined ? ` / ${record.score}分` : ''}
                </small>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RankingList({ title, items, metric }) {
  return (
    <div className="ranking-card">
      <h3>{title}</h3>
      {items.length === 0 ? (
        <p>暂无数据</p>
      ) : (
        <ol>
          {items.map((item) => (
            <li key={item.localUserId || item.appUserId || item.nickname}>
              <span>{item.nickname || '未命名成员'}</span>
              <strong>{metric(item)}</strong>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function TeamMemberProfiles({ profiles = [] }) {
  return (
    <section className="team-insight-section">
      <div>
        <h3>成员能力画像</h3>
        <p>基于当前团队训练记录生成摘要，不展示完整对话和复盘正文。</p>
      </div>
      {profiles.length === 0 ? (
        <div className="history-empty">暂无足够团队训练记录，完成几轮训练后会生成能力画像。</div>
      ) : (
        <div className="member-profile-grid">
          {profiles.map((profile) => (
            <article className="member-profile-card" key={profile.appUserId || profile.localUserId || profile.nickname}>
              <div className="member-profile-header">
                <strong>{profile.nickname || '未命名成员'}</strong>
                <span>{getTeamRoleLabel(profile.role)}</span>
              </div>
              <div className="member-profile-meta">
                <span>最近训练：{profile.recentCount || 0} 次</span>
                <span>最近均分：{formatNullableNumber(profile.averageScore)}</span>
                <span>常练模式：{profile.frequentModes?.length ? profile.frequentModes.join('、') : '暂无'}</span>
              </div>
              {profile.recentCount ? (
                <>
                  <p><b>优势：</b>{profile.strengths?.length ? profile.strengths.join('、') : '暂未形成稳定优势'}</p>
                  <p><b>薄弱：</b>{profile.weaknesses?.length ? profile.weaknesses.join('、') : '暂未形成稳定短板'}</p>
                  <p><b>建议：</b>{profile.suggestion || '继续完成团队训练，积累更多样本。'}</p>
                </>
              ) : (
                <p>暂无足够团队训练记录，完成几轮训练后会生成能力画像。</p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function TeamCommonProblems({ problems = [] }) {
  return (
    <section className="team-insight-section">
      <div>
        <h3>全队共性问题</h3>
        <p>从近期团队训练的低分维度中提取，用于辅助队长和管理员布置任务。</p>
      </div>
      {problems.length === 0 ? (
        <div className="history-empty">团队训练数据不足，完成更多团队训练后可生成更准确推荐。</div>
      ) : (
        <div className="common-problem-grid">
          {problems.map((problem) => (
            <article className="common-problem-card" key={problem.title}>
              <span>{getOptionLabel(trainingModes, problem.recommendedMode) || '专项训练'}</span>
              <strong>{problem.title}</strong>
              <p>{problem.description}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function TaskRecommendationPanel({ recommendations, onApply }) {
  const [isOpen, setIsOpen] = useState(false);
  const [ignoredKeys, setIgnoredKeys] = useState([]);
  const teamRecommendations = Array.isArray(recommendations?.teamRecommendations)
    ? recommendations.teamRecommendations
    : (recommendations?.teamRecommendation ? [recommendations.teamRecommendation] : []);
  const personalRecommendations = Array.isArray(recommendations?.personalRecommendations)
    ? recommendations.personalRecommendations
    : [];
  const visibleTeamRecommendations = teamRecommendations.filter((item, index) => !ignoredKeys.includes(getRecommendationKey(item, index, 'team')));
  const visiblePersonalRecommendations = personalRecommendations.filter((item, index) => !ignoredKeys.includes(getRecommendationKey(item, index, 'personal')));
  const visibleCount = visibleTeamRecommendations.length + visiblePersonalRecommendations.length;

  function ignoreRecommendation(item, index, scope) {
    setIgnoredKeys((current) => [...current, getRecommendationKey(item, index, scope)]);
  }

  if (!recommendations?.hasEnoughData && visibleCount === 0) {
    return (
      <section className="task-recommendation-panel">
        <div className="task-recommendation-heading">
          <div>
            <span>智能任务推荐</span>
            <h3>团队训练数据不足</h3>
          </div>
          <p>完成更多团队训练后，系统会基于全队共性问题和成员个人短板生成更准确的任务推荐。</p>
        </div>
      </section>
    );
  }

  return (
    <section className="task-recommendation-panel">
      <div className="task-recommendation-heading">
        <div>
          <span>智能任务推荐</span>
          <h3>推荐不会自动发布，采纳后仍可修改</h3>
          <p>系统只基于当前团队空间训练数据生成建议，不展示完整对话和复盘全文。</p>
        </div>
        <button type="button" onClick={() => setIsOpen((current) => !current)}>
          {isOpen ? '收起推荐' : `查看推荐任务（${visibleCount}）`}
        </button>
      </div>

      {isOpen && (
        <div className="task-recommendation-body">
          {visibleTeamRecommendations.length > 0 && (
            <div className="task-recommendation-section">
              <h4>全队共性任务</h4>
              <div className="task-recommendation-grid">
                {visibleTeamRecommendations.map((item, index) => (
                  <RecommendationCard
                    item={item}
                    key={getRecommendationKey(item, index, 'team')}
                    label="全队推荐"
                    onApply={onApply}
                    onIgnore={() => ignoreRecommendation(item, index, 'team')}
                  />
                ))}
              </div>
            </div>
          )}

          {visiblePersonalRecommendations.length > 0 && (
            <div className="task-recommendation-section">
              <h4>成员个性化任务</h4>
              <div className="task-recommendation-grid">
                {visiblePersonalRecommendations.map((item, index) => (
                  <RecommendationCard
                    item={item}
                    key={getRecommendationKey(item, index, 'personal')}
                    label={`个人推荐 · ${item.memberName || '成员'}`}
                    onApply={onApply}
                    onIgnore={() => ignoreRecommendation(item, index, 'personal')}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function RecommendationCard({ item, label, onApply, onIgnore }) {
  if (item.insufficientData) {
    return (
      <article className="task-recommendation-card muted">
        <span>{label}</span>
        <strong>{item.memberName || '成员'}：数据不足</strong>
        <p>{item.reason || '该成员团队空间训练记录不足，暂不生成个性化推荐。'}</p>
      </article>
    );
  }

  const tags = Array.isArray(item.recommendedReasonTags) ? item.recommendedReasonTags : [];
  return (
    <article className="task-recommendation-card">
      <span>{label}</span>
      <strong>{item.title}</strong>
      <div className="task-recommendation-meta">
        <em>{item.assignmentType === 'selected' ? `对象：${item.memberName || item.targetMembers || '指定成员'}` : '对象：全体成员'}</em>
        <em>模式：{item.trainingMode || getOptionLabel(trainingModes, item.mode) || '专项训练'}</em>
        <em>难度：{item.difficultyLabel || getOptionLabel(difficulties, item.difficulty) || '校赛'}</em>
      </div>
      <p>{item.reason}</p>
      <p><b>训练目标：</b>{item.goal}</p>
      {tags.length > 0 && (
        <div className="recommendation-tags">
          {tags.map((tag) => <span key={tag}>{tag}</span>)}
        </div>
      )}
      <div className="recommendation-actions">
        <button type="button" onClick={() => onApply(item)}>
          采纳推荐
        </button>
        <button type="button" className="ghost" onClick={onIgnore}>
          忽略
        </button>
      </div>
    </article>
  );
}

function getRecommendationKey(item, index, scope) {
  return `${scope}-${item.memberAppUserId || item.title || item.memberName || 'item'}-${index}`;
}

function DimensionScoreChart({ dimensions }) {
  const chartDimensions = dimensions
    .map((dimension) => ({
      ...dimension,
      score: Number(dimension.score)
    }))
    .filter((dimension) => Number.isFinite(dimension.score));

  if (chartDimensions.length === 0) {
    return null;
  }

  const size = 240;
  const center = size / 2;
  const radius = 78;
  const angleStep = (Math.PI * 2) / chartDimensions.length;
  const toPoint = (index, valueRatio = 1) => {
    const angle = -Math.PI / 2 + index * angleStep;
    const pointRadius = radius * valueRatio;
    return {
      x: center + Math.cos(angle) * pointRadius,
      y: center + Math.sin(angle) * pointRadius
    };
  };
  const pointString = chartDimensions
    .map((dimension, index) => {
      const scoreRatio = Math.max(0, Math.min(100, dimension.score)) / 100;
      const point = toPoint(index, scoreRatio);
      return `${point.x},${point.y}`;
    })
    .join(' ');

  return (
    <div className="dimension-chart-card">
      <div className="dimension-chart-header">
        <div>
          <span>五维能力图表</span>
          <strong>本轮维度分布</strong>
        </div>
        <p>越靠外代表该维度越稳定，右侧条形可快速比较短板和优势。</p>
      </div>
      <div className="dimension-chart-layout">
        <div className="dimension-radar-wrap" aria-label="五维能力雷达图">
          <svg viewBox={`0 0 ${size} ${size}`} role="img">
            <title>复盘五维度分数雷达图</title>
            {[0.25, 0.5, 0.75, 1].map((level) => (
              <polygon
                key={level}
                className="dimension-radar-grid"
                points={chartDimensions.map((_, index) => {
                  const point = toPoint(index, level);
                  return `${point.x},${point.y}`;
                }).join(' ')}
              />
            ))}
            {chartDimensions.map((dimension, index) => {
              const outer = toPoint(index, 1);
              const labelPoint = toPoint(index, 1.24);
              return (
                <g key={dimension.name}>
                  <line className="dimension-radar-axis" x1={center} y1={center} x2={outer.x} y2={outer.y} />
                  <text className="dimension-radar-label" x={labelPoint.x} y={labelPoint.y}>
                    {index + 1}
                  </text>
                </g>
              );
            })}
            <polygon className="dimension-radar-area" points={pointString} />
            {chartDimensions.map((dimension, index) => {
              const point = toPoint(index, Math.max(0, Math.min(100, dimension.score)) / 100);
              return <circle key={dimension.name} className="dimension-radar-point" cx={point.x} cy={point.y} r="4" />;
            })}
          </svg>
        </div>
        <div className="dimension-bar-list">
          {chartDimensions.map((dimension, index) => (
            <div className="dimension-bar-row" key={dimension.name}>
              <div>
                <strong>{index + 1}. {dimension.name}</strong>
                <span>{formatScoreValue(dimension.score)} / 100</span>
              </div>
              <div className="dimension-bar-track" aria-hidden="true">
                <span style={{ width: `${Math.max(0, Math.min(100, dimension.score))}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function getWeakestDimensions(dimensionScores, count = 2) {
  if (!Array.isArray(dimensionScores)) {
    return [];
  }

  return dimensionScores
    .filter((dimension) => {
      const score = Number(dimension?.score);
      return dimension?.name && Number.isFinite(score);
    })
    .map((dimension) => ({
      ...dimension,
      score: Number(dimension.score)
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, count);
}

function getSetupStepForMode(mode, { hasDefensePrep = false, hasFreeDebatePrep = false } = {}) {
  if (mode === 'defense' && !hasDefensePrep) return 'defensePrep';
  if (mode === 'free_debate' && !hasFreeDebatePrep) return 'freeDebatePrep';
  if (roundSelectionModes.includes(mode)) return 'rounds';
  return 'ready';
}

function getRecommendedTrainingModeForDimension(name, fallbackMode = 'free_debate') {
  const normalizedName = String(name || '');
  const rules = [
    { keywords: ['定义', '判准', '论证结构', '逻辑链条', '论据', '数据', '例证', '可防守'], mode: 'constructive' },
    { keywords: ['攻辩内容', '结算', '归纳', '主线连接'], mode: 'summary' },
    { keywords: ['自由', '临场', '攻守转换', '团队协同', '战场识别', '战场控制'], mode: 'free_debate' },
    { keywords: ['问题精准', '追问', '抓漏洞', '逻辑压迫'], mode: 'attack' },
    { keywords: ['正面回应', '防守', '切割', '陷阱', '反压', '稳定'], mode: 'defense' },
    { keywords: ['整合', '胜负比较', '攻防成果', '价值', '升华', '收束', '感染力', '时间控制'], mode: 'closing' }
  ];
  const matchedRule = rules.find((rule) => rule.keywords.some((keyword) => normalizedName.includes(keyword)));
  return matchedRule?.mode || fallbackMode || 'free_debate';
}

function buildUserTrainingProfile(records = []) {
  const recentRecords = Array.isArray(records)
    ? records
        .filter(Boolean)
        .slice()
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .slice(0, 10)
    : [];

  if (!recentRecords.length) {
    return {
      recentTrainingCount: 0,
      frequentModes: [],
      averageScore: null,
      scoreTrend: '暂无足够数据',
      weakDimensions: [],
      recurringProblems: [],
      latestRecordSummary: null,
      recommendedFocus: ''
    };
  }

  const scores = recentRecords
    .map((record) => Number(record.score))
    .filter((score) => Number.isFinite(score));
  const averageScore = scores.length
    ? Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1))
    : null;
  const modeCounts = new Map();
  recentRecords.forEach((record) => {
    const label = getOptionLabel(trainingModes, record.trainingMode) || record.modeDisplayName || '未知模式';
    modeCounts.set(label, (modeCounts.get(label) || 0) + 1);
  });
  const frequentModes = [...modeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([label]) => label);
  const dimensionBuckets = new Map();

  recentRecords.forEach((record) => {
    const reviewData = normalizeStructuredReview(record);
    const dimensions = Array.isArray(reviewData?.dimensionScores) ? reviewData.dimensionScores : [];
    dimensions.forEach((dimension) => {
      const score = Number(dimension?.score);
      if (!dimension?.name || !Number.isFinite(score)) return;
      const current = dimensionBuckets.get(dimension.name) || { total: 0, count: 0 };
      current.total += score;
      current.count += 1;
      dimensionBuckets.set(dimension.name, current);
    });
  });

  const weakDimensions = [...dimensionBuckets.entries()]
    .map(([name, bucket]) => ({ name, average: bucket.total / bucket.count }))
    .sort((a, b) => a.average - b.average)
    .slice(0, 3)
    .map((item) => item.name);
  const recurringProblems = inferRecurringProblems(weakDimensions);
  const latestRecord = recentRecords[0];
  const latestReview = normalizeStructuredReview(latestRecord);
  const recommendedFocus = buildRecommendedFocus(weakDimensions, frequentModes);

  return {
    recentTrainingCount: recentRecords.length,
    frequentModes,
    averageScore,
    scoreTrend: getRecentScoreTrend(scores),
    weakDimensions,
    recurringProblems,
    latestRecordSummary: {
      topic: latestRecord.topic || '未命名辩题',
      mode: getOptionLabel(trainingModes, latestRecord.trainingMode) || latestRecord.modeDisplayName || '未知模式',
      difficulty: getOptionLabel(difficulties, latestRecord.difficulty) || latestRecord.difficulty || '',
      score: Number.isFinite(Number(latestRecord.score)) ? Number(latestRecord.score) : null,
      scoreLevel: latestRecord.scoreLevel || latestReview?.scoreLevel || '',
      userSide: getOptionLabel(sides, latestRecord.userSide) || '',
      aiSide: getOptionLabel(sides, latestRecord.aiSide) || '',
      battlefield: latestRecord.battlefield || latestReview?.battlefield || '',
      reviewSummary: summarizeText(latestReview?.mainWeakness || latestReview?.reviewText || latestRecord.review, 220),
      createdAt: latestRecord.createdAt || ''
    },
    recommendedFocus
  };
}

function inferRecurringProblems(weakDimensions = []) {
  const problems = [];
  const text = weakDimensions.join(' ');
  if (/战场|控制|识别|主线/.test(text)) problems.push('容易被对方问题带走，需要先练战场识别');
  if (/表达|节奏|时间|稳定/.test(text)) problems.push('回答容易变长，落点不够清楚，需要练表达压缩');
  if (/防守|回应|切割|陷阱|反压/.test(text)) problems.push('防守时需要先处理问题预设，再回到己方标准');
  if (/追问|问题|质询|漏洞|压迫/.test(text)) problems.push('攻辩问题还需要形成连续问题链');
  if (/论据|例证|数据|论证|逻辑/.test(text)) problems.push('论据和结论之间还需要补足推理链');
  if (/价值|升华|整合|收束|结算/.test(text)) problems.push('结尾需要更清楚地完成胜负比较和价值收束');
  return problems.slice(0, 4);
}

function buildRecommendedFocus(weakDimensions = [], frequentModes = []) {
  const text = weakDimensions.join(' ');
  if (/切割|防守|回应|陷阱/.test(text)) return '先练防守切割，再练反压一句';
  if (/战场|控制|识别/.test(text)) return '先练战场识别，再练自由辩追问链';
  if (/表达|节奏|时间/.test(text)) return '先练三句话压缩表达';
  if (/追问|质询|问题/.test(text)) return '先练攻辩问题链设计';
  if (/价值|升华|整合|收束/.test(text)) return '先练战场整合和结辩终局感';
  if (frequentModes.includes('自由辩论')) return '先稳定自由辩战场，再提升反击效率';
  return '先练一个小目标：判断战场、压缩表达、明确落点';
}

function getRecentScoreTrend(scores = []) {
  if (scores.length < 3) return '暂无足够趋势';
  const latest = scores.slice(0, Math.ceil(scores.length / 2));
  const earlier = scores.slice(Math.ceil(scores.length / 2));
  const latestAverage = latest.reduce((sum, score) => sum + score, 0) / latest.length;
  const earlierAverage = earlier.reduce((sum, score) => sum + score, 0) / earlier.length;
  const delta = latestAverage - earlierAverage;
  const spread = Math.max(...scores) - Math.min(...scores);
  if (spread >= 18) return '波动较大';
  if (delta >= 3) return '略有上升';
  if (delta <= -3) return '略有回落';
  return '整体稳定';
}

function summarizeText(text, maxLength = 220) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength)}…`;
}

function WeaknessVideoRecommendations({ dimensions }) {
  const weakestDimensions = getWeakestDimensions(dimensions, 2);

  if (weakestDimensions.length === 0) {
    return null;
  }

  return (
    <section className="weakness-video-section">
      <div className="weakness-video-header">
        <div>
          <span>学习推荐</span>
          <h3>针对短板的学习推荐</h3>
        </div>
        <p>系统根据本轮五维能力中分数较低的两个维度，为你推荐对应学习视频。</p>
      </div>

      <div className="weakness-video-grid">
        {weakestDimensions.map((dimension, index) => {
          const videos = getAbilityVideosForDimension(dimension.name).slice(0, 2);
          return (
            <article className="weakness-video-card" key={`${dimension.name}-${index}`}>
              <div className="weakness-video-meta">
                <span>短板{index + 1}</span>
                <strong>{dimension.name}</strong>
                <em>{formatScoreValue(dimension.score)} / 100</em>
              </div>
              <p className="weakness-video-reason">
                你本轮在“{dimension.name}”上的分数相对较低，建议先学习对应方法，再回到同类训练中专项练习。
              </p>
              <div className="weakness-video-list">
                {videos.map((video) => {
                  const searchUrl = `https://search.bilibili.com/all?keyword=${encodeURIComponent(video.searchKeyword || video.title)}`;
                  return (
                    <div className="weakness-video-item" key={video.title}>
                      <div>
                        <strong>{video.title}</strong>
                        <p>{video.reason}</p>
                      </div>
                      <a className="bilibili-search-link" href={searchUrl} target="_blank" rel="noopener noreferrer">
                        去 B站搜索
                      </a>
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function DebateExperienceChat({ trainingProfile, isLoggedIn }) {
  const featuredQuickQuestions = [
    '我最近最该练什么？',
    '我反复出现的问题是什么？',
    '帮我安排一个三天训练计划'
  ];
  const quickQuestionGroups = [
    {
      title: '个人训练方向',
      questions: [
        '我最近最该练什么？',
        '我反复出现的问题是什么？',
        '我适合先练自由辩还是防守？',
        '帮我安排一个三天训练计划。',
        '我最近有没有进步？'
      ]
    },
    {
      title: '赛场经验与状态',
      questions: [
        '上场前怎么稳住？',
        '自由辩总被带跑怎么办？',
        '攻辩怎么设计问题链？',
        '被对面问懵了怎么办？',
        '结辩怎么做出终局感？'
      ]
    }
  ];
  const openingMessage = '我是林婉，你的辩论顾问，也是你的辩论搭子。\n\n我会参考你最近的训练状态，不局限于某一场比赛，综合分析你的问题，提出我的建议。\n\n另外，我也有许多大赛经验。赛前准备、攻防设计、临场心态这些问题，都可以拿来问我，我会把能用的经验讲给你听。\n\n辩论赛的准备过程是痛苦且艰辛的，但没事，有我在，我们慢慢来。';
  const hasTrainingProfile = Number(trainingProfile?.recentTrainingCount || 0) > 0;
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([{ role: 'assistant', content: openingMessage }]);
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState('');
  const [memoryStatus, setMemoryStatus] = useState('');
  const [isClearingMemory, setIsClearingMemory] = useState(false);
  const [ttsLoadingKey, setTtsLoadingKey] = useState('');
  const [ttsPlayingKey, setTtsPlayingKey] = useState('');
  const [ttsErrorKey, setTtsErrorKey] = useState('');
  const [ttsErrorMessage, setTtsErrorMessage] = useState('');
  const [showAllQuickQuestions, setShowAllQuickQuestions] = useState(false);
  const ttsAudioRef = useRef(null);
  const ttsCacheRef = useRef(new Map());

  useEffect(() => {
    return () => {
      stopLinWanAudio(false);
      ttsCacheRef.current.forEach((item) => {
        if (item?.url) URL.revokeObjectURL(item.url);
      });
      ttsCacheRef.current.clear();
    };
  }, []);

  async function sendExperienceQuestion(nextQuestion = question) {
    const cleanQuestion = String(nextQuestion || '').trim();
    if (!cleanQuestion || isSending) return;

    const historyForRequest = messages
      .filter((item) => item.content !== openingMessage)
      .slice(-10);
    const nextMessages = [...messages, { role: 'user', content: cleanQuestion }];
    setMessages(nextMessages);
    setQuestion('');
    setChatError('');
    setIsSending(true);

    try {
      const data = await postJson('/api/debate-experience-chat', {
        question: cleanQuestion,
        chatHistory: historyForRequest,
        userTrainingProfile: trainingProfile || null
      });
      setMessages([...nextMessages, { role: 'assistant', content: data.answer || '我暂时没有整理好回答，你可以换个问法再试一次。' }]);
    } catch {
      setChatError('林婉暂时没有回应，请稍后再试。');
    } finally {
      setIsSending(false);
    }
  }

  function handleQuickQuestion(item) {
    sendExperienceQuestion(item);
    setShowAllQuickQuestions(false);
  }

  async function clearLinWanMemory() {
    if (isClearingMemory) return;

    if (!isLoggedIn) {
      setMemoryStatus('登录后可以清空跨设备保存的林婉记忆。');
      return;
    }

    setIsClearingMemory(true);
    setMemoryStatus('');
    setChatError('');

    try {
      const data = await postJson('/api/debate-experience-memory/clear', {});
      setMessages([{ role: 'assistant', content: openingMessage }]);
      setMemoryStatus(data.message || '林婉记忆已清空。');
    } catch {
      setMemoryStatus('林婉记忆暂时清空失败，请稍后再试。');
    } finally {
      setIsClearingMemory(false);
    }
  }

  function stopLinWanAudio(updateState = true) {
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current.currentTime = 0;
      ttsAudioRef.current = null;
    }
    if (updateState) {
      setTtsPlayingKey('');
    }
  }

  async function playLinWanReply(content, key) {
    if (!content || ttsLoadingKey) return;

    if (ttsPlayingKey === key) {
      stopLinWanAudio();
      return;
    }

    stopLinWanAudio();
    setTtsErrorKey('');
    setTtsErrorMessage('');

    const cached = ttsCacheRef.current.get(key);
    if (cached?.url) {
      startLinWanAudio(cached.url, key);
      return;
    }

    setTtsLoadingKey(key);

    try {
      const data = await postJson('/api/linwan/tts', { text: content });
      const blob = base64ToBlob(data.audioBase64, data.mimeType || 'audio/mpeg');
      const url = URL.createObjectURL(blob);
      ttsCacheRef.current.set(key, { url, mimeType: data.mimeType || 'audio/mpeg' });
      startLinWanAudio(url, key);
    } catch (error) {
      setTtsErrorKey(key);
      setTtsErrorMessage(getFriendlyError(error) || '语音生成失败，请稍后重试。');
    } finally {
      setTtsLoadingKey('');
    }
  }

  function startLinWanAudio(url, key) {
    const audio = new Audio(url);
    audio.playbackRate = 1.08;
    ttsAudioRef.current = audio;
    setTtsPlayingKey(key);

    audio.onended = () => {
      if (ttsAudioRef.current === audio) {
        ttsAudioRef.current = null;
        setTtsPlayingKey('');
      }
    };
    audio.onerror = () => {
      if (ttsAudioRef.current === audio) {
        ttsAudioRef.current = null;
        setTtsPlayingKey('');
        setTtsErrorKey(key);
      }
    };

    audio.play().catch(() => {
      if (ttsAudioRef.current === audio) {
        ttsAudioRef.current = null;
        setTtsPlayingKey('');
        setTtsErrorKey(key);
      }
    });
  }

  function getLinWanTtsButtonLabel(key) {
    if (ttsLoadingKey === key) return '林婉正在开口...';
    if (ttsPlayingKey === key) return '停止播放';
    return '▶ 听林婉说';
  }

  return (
    <section className="panel experience-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">辩手经验室</p>
          <h2>林婉 · 辩论顾问</h2>
        </div>
        <button
          type="button"
          className="memory-clear-button"
          disabled={isSending || isClearingMemory}
          onClick={clearLinWanMemory}
        >
          {isClearingMemory ? '清空中...' : '清空林婉记忆'}
        </button>
      </div>

      <TrainingProfileCard profile={trainingProfile} />

      <article className="experience-opening-card">
        <span>林婉</span>
        <p>{openingMessage}</p>
      </article>

      <p className="experience-boundary-note">林婉更关注你的近期训练状态和长期训练方向。单轮细节问题，可以在对应记录下问复盘助手。</p>

      <section className="experience-quick-panel" aria-label="快捷问题">
        <div className="experience-featured-questions">
          {featuredQuickQuestions.map((item) => (
            <button
              type="button"
              key={item}
              disabled={isSending}
              onClick={() => handleQuickQuestion(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="experience-more-questions"
          onClick={() => setShowAllQuickQuestions((value) => !value)}
          aria-expanded={showAllQuickQuestions}
        >
          {showAllQuickQuestions ? '收起问题' : '查看更多问题'}
        </button>

        {showAllQuickQuestions && (
          <div className="experience-quick-groups">
            {quickQuestionGroups.map((group) => (
              <section className="experience-quick-group" key={group.title}>
                <h3>{group.title}</h3>
                <div className="assistant-quick-questions experience-quick-questions">
                  {group.questions.map((item) => (
                    <button
                      type="button"
                      key={item}
                      disabled={isSending}
                      onClick={() => handleQuickQuestion(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>

      <div className="assistant-chat-list experience-chat-list">
        {messages.map((item, index) => {
          const ttsKey = getLinWanTtsKey(item.content, index);
          const canPlayTts = item.role === 'assistant' && item.content !== openingMessage;

          return (
            <article className={`assistant-chat-message ${item.role}`} key={`${item.role}-${index}`}>
              <span>{item.role === 'user' ? '我的问题' : '林婉'}</span>
              <p>{item.content}</p>
              {canPlayTts && (
                <div className="linwan-tts-row">
                  <button
                    type="button"
                    className="linwan-tts-button"
                    disabled={Boolean(ttsLoadingKey && ttsLoadingKey !== ttsKey)}
                    onClick={() => playLinWanReply(item.content, ttsKey)}
                  >
                    {getLinWanTtsButtonLabel(ttsKey)}
                  </button>
                  {ttsErrorKey === ttsKey && (
                    <small className="linwan-tts-error">{ttsErrorMessage || '语音生成失败，请稍后重试。'}</small>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>

      {isSending && <div className="assistant-loading">林婉正在整理思路...</div>}
      {chatError && <div className="assistant-error">{chatError}</div>}
      {memoryStatus && <div className="assistant-memory-status">{memoryStatus}</div>}

      <div className="assistant-input-row experience-input-row">
        <textarea
          value={question}
          disabled={isSending}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder={hasTrainingProfile ? '例如：我最近最该练什么？帮我安排三天训练计划。' : '例如：自由辩总被带跑怎么办？赛前准备一个辩题该怎么做？'}
          rows={3}
        />
        <button type="button" disabled={isSending || !question.trim()} onClick={() => sendExperienceQuestion()}>
          发送
        </button>
      </div>
    </section>
  );
}

function TrainingProfileCard({ profile }) {
  const hasProfile = Number(profile?.recentTrainingCount || 0) > 0;

  if (!hasProfile) {
    return (
      <article className="training-profile-card empty">
        <div>
          <span>近期训练画像</span>
          <h3>暂无足够训练记录</h3>
        </div>
        <p>林婉将先按通用赛场经验回答。完成几轮训练后，她会更了解你的训练状态。</p>
      </article>
    );
  }

  return (
    <article className="training-profile-card">
      <div className="training-profile-heading">
        <div>
          <span>近期训练画像</span>
          <h3>当前训练状态</h3>
        </div>
        <strong>{profile.recentTrainingCount} 次</strong>
      </div>
      <div className="training-profile-grid">
        <div>
          <span>常练模式</span>
          <strong>{profile.frequentModes?.length ? profile.frequentModes.join('、') : '暂无明显集中模式'}</strong>
        </div>
        <div>
          <span>最近均分</span>
          <strong>{profile.averageScore !== null && profile.averageScore !== undefined ? `${profile.averageScore} / 100` : '暂无稳定均分'}</strong>
        </div>
        <div>
          <span>反复短板</span>
          <strong>{profile.weakDimensions?.length ? profile.weakDimensions.join('、') : '暂未形成稳定短板'}</strong>
        </div>
        <div>
          <span>当前建议</span>
          <strong>{profile.recommendedFocus || '先保持训练，再观察稳定问题'}</strong>
        </div>
      </div>
    </article>
  );
}

function getLinWanTtsKey(content, index) {
  const text = String(content || '');
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }

  return `linwan-${index}-${Math.abs(hash)}`;
}

function base64ToBlob(base64, mimeType = 'audio/mpeg') {
  const binary = atob(String(base64 || ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new Blob([bytes], { type: mimeType });
}

function ReviewAssistant({ context }) {
  const quickQuestions = [
    '为什么我这轮分数不高？',
    '我这轮主要输在哪里？',
    '帮我改写一段回答',
    '下一轮我应该练什么？',
    '给我补一个例子'
  ];
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [assistantError, setAssistantError] = useState('');

  async function sendQuestion(nextQuestion = question) {
    const cleanQuestion = String(nextQuestion || '').trim();
    if (!cleanQuestion || isSending) return;

    const nextMessages = [...messages, { role: 'user', content: cleanQuestion }];
    setMessages(nextMessages);
    setQuestion('');
    setAssistantError('');
    setIsSending(true);

    try {
      const data = await postJson('/api/review-assistant', {
        reviewContext: context || {},
        question: cleanQuestion,
        chatHistory: messages
      });
      setMessages([...nextMessages, { role: 'assistant', content: data.answer || '我暂时没有组织好回答，请换个问法再试一次。' }]);
    } catch {
      setAssistantError('助手暂时无法回答，请稍后重试。');
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className="review-assistant">
      <div className="review-assistant-header">
        <div>
          <span>复盘助手</span>
          <h3>对这次复盘有疑问？可以继续问我。</h3>
        </div>
        <button type="button" onClick={() => setIsOpen((current) => !current)}>
          {isOpen ? '收起助手' : '问问复盘助手'}
        </button>
      </div>

      {isOpen && (
        <div className="review-assistant-body">
          <div className="assistant-quick-questions">
            {quickQuestions.map((item) => (
              <button
                type="button"
                key={item}
                disabled={isSending}
                onClick={() => sendQuestion(item)}
              >
                {item}
              </button>
            ))}
          </div>

          {messages.length > 0 && (
            <div className="assistant-chat-list">
              {messages.map((item, index) => (
                <article className={`assistant-chat-message ${item.role}`} key={`${item.role}-${index}`}>
                  <span>{item.role === 'user' ? '我的问题' : '复盘助手'}</span>
                  <p>{item.content}</p>
                </article>
              ))}
            </div>
          )}

          {isSending && <div className="assistant-loading">复盘助手正在思考...</div>}
          {assistantError && <div className="assistant-error">{assistantError}</div>}

          <div className="assistant-input-row">
            <textarea
              value={question}
              disabled={isSending}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="例如：这段回答怎么改？我主要输在哪里？"
              rows={3}
            />
            <button type="button" disabled={isSending || !question.trim()} onClick={() => sendQuestion()}>
              发送
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function ReviewReport({ reviewText, structuredReview, fallbackMode, assistantContext }) {
  const reviewData = normalizeStructuredReview(structuredReview);
  const assistantPayload = buildReviewAssistantContext({
    reviewText,
    reviewData,
    structuredReview,
    fallbackMode,
    assistantContext
  });

  if (!reviewData?.dimensionScores?.length) {
    return (
      <>
        <pre>{reviewText}</pre>
        <ReviewAssistant context={assistantPayload} />
      </>
    );
  }

  const modeDisplayName = reviewData.modeDisplayName || getOptionLabel(trainingModes, fallbackMode) || '训练复盘';
  const score = reviewData.score ?? extractScoreFromReview(reviewText);
  const scoreLevel = reviewData.scoreLevel || '';

  return (
    <div className="structured-review">
      <div className="review-score-card">
        <div>
          <span>训练环节</span>
          <strong>{modeDisplayName}</strong>
        </div>
        <div>
          <span>总分</span>
          <strong>{score !== null && score !== undefined ? `${score} / 100` : '未解析'}</strong>
        </div>
        {scoreLevel && (
          <div>
            <span>评分区间</span>
            <strong>{scoreLevel}</strong>
          </div>
        )}
      </div>

      <DimensionScoreChart dimensions={reviewData.dimensionScores} />

      <WeaknessVideoRecommendations dimensions={reviewData.dimensionScores} />

      <div className="dimension-score-list">
        {reviewData.dimensionScores.map((dimension) => (
          <div className="dimension-score-item" key={dimension.name}>
            <div>
              <strong>{dimension.name}</strong>
              <span>
                {dimension.score !== null && dimension.score !== undefined ? dimension.score : '未解析'} / {dimension.maxScore}
              </span>
            </div>
            {dimension.comment && <p>{dimension.comment}</p>}
          </div>
        ))}
      </div>

      {(reviewData.battlefield || reviewData.mainWeakness) && (
        <div className="review-summary-grid">
          {reviewData.battlefield && (
            <article>
              <span>核心战场</span>
              <p>{reviewData.battlefield}</p>
            </article>
          )}
          {reviewData.mainWeakness && (
            <article>
              <span>最大漏洞</span>
              <p>{reviewData.mainWeakness}</p>
            </article>
          )}
        </div>
      )}

      {reviewData.reviewText && (
        <div className="review-text-block">
          <h3>复盘说明</h3>
          <p>{reviewData.reviewText}</p>
        </div>
      )}

      {reviewData.nextStepAdvice.length > 0 && (
        <div className="review-text-block">
          <h3>下一步建议</h3>
          <ul>
            {reviewData.nextStepAdvice.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {reviewData.template && (
        <div className="review-text-block">
          <h3>可复用模板</h3>
          <p>{reviewData.template}</p>
        </div>
      )}

      <details className="raw-review-details">
        <summary>查看原始复盘文本</summary>
        <pre>{reviewText}</pre>
      </details>

      <ReviewAssistant context={assistantPayload} />
    </div>
  );
}

function RecordDetail({ record, onClose }) {
  return (
    <div className="history-detail">
      <div className="history-detail-header">
        <div>
          <span>{formatRecordDate(record.createdAt)} · {record.nickname || '我的训练'}</span>
          <h3>{record.topic}</h3>
        </div>
        <button type="button" onClick={onClose}>
          收起
        </button>
      </div>

      <div className="history-meta">
        <span>我的立场：{getOptionLabel(sides, record.userSide)}</span>
        <span>AI 立场：{getOptionLabel(sides, record.aiSide)}</span>
        <span>模式：{getOptionLabel(trainingModes, record.trainingMode) || '自由辩论'}</span>
        <span>难度：{getOptionLabel(difficulties, record.difficulty)}</span>
        <span>风格：{getOptionLabel(celebrityDebaters, record.styleId) || '普通 AI'}</span>
        {record.battlefield && <span>战场：{record.battlefield}</span>}
      </div>

      <div className="conversation history-conversation">
        {record.messages.map((item, index) => (
          <article className={`message ${item.role}`} key={`${item.role}-${index}`}>
            <span>{item.role === 'ai' ? 'AI 攻辩方' : '我的回答'}</span>
            <p>{formatConversationContent(item.content, item.role)}</p>
          </article>
        ))}
      </div>

      <div className="history-review">
        <h3>复盘报告</h3>
        <ReviewReport
          reviewText={record.review}
          structuredReview={record}
          fallbackMode={record.trainingMode}
          assistantContext={{
            topic: record.topic,
            mode: record.trainingMode,
            modeDisplayName: getOptionLabel(trainingModes, record.trainingMode),
            difficulty: record.difficulty,
            userSide: record.userSide,
            aiSide: record.aiSide,
            messages: record.messages || []
          }}
        />
      </div>
    </div>
  );
}

function OptionGroup({ label, options, value, onChange, disabled, className = '' }) {
  return (
    <div className={`option-group ${className}`}>
      <span>{label}</span>
      <div className="segmented">
        {options.map((option) => (
          <button
            type="button"
            key={option.value}
            disabled={disabled}
            className={option.value === value ? 'active' : ''}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function getOptionLabel(options, value) {
  return options.find((option) => option.value === value)?.label || '';
}

function getDateTimeLocalAfterDays(days = 3) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(20, 0, 0, 0);
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
}

function getTeamRoleLabel(role) {
  if (isTeamLeaderRole(role)) return '队长';
  if (role === 'admin') return '管理员';
  return '成员';
}

function isTeamLeaderRole(role) {
  return ['owner', 'captain', 'leader'].includes(role || 'member');
}

function isTeamManagerRole(role) {
  return isTeamLeaderRole(role) || role === 'admin';
}

function getLatestMessage(history, role) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (history[index].role === role) {
      return history[index].content;
    }
  }

  return '';
}

function getOpponentSideValue(userSide) {
  const normalized = normalizeSideValue(userSide);
  return normalized === 'affirmative' ? 'negative' : 'affirmative';
}

function normalizeSideValue(side) {
  if (side === '正方' || side === 'affirmative') return 'affirmative';
  if (side === '反方' || side === 'negative') return 'negative';
  return 'affirmative';
}

function getRoundPromptLabel(trainingMode) {
  if (trainingMode === 'attack') return '对立方一辩关键点';
  if (trainingMode === 'defense') return '本轮质询';
  if (trainingMode === 'constructive') return '对立方立论摘要';
  if (trainingMode === 'summary') return '场上已有交锋点';
  if (trainingMode === 'closing') return '对立方结辩素材';
  return '本轮追问';
}

function getSetupTitle(setupStep) {
  if (setupStep === 'topic') return '选择辩题与立场';
  if (setupStep === 'rounds') return '选择训练轮数';
  if (setupStep === 'defensePrep') return '填写防守立论要点';
  if (setupStep === 'freeDebatePrep') return '填写自由辩论主要论点';
  return '确认训练设置';
}

function getHeroSubtitle(trainingMode) {
  if (trainingMode === 'free_debate') {
    return '自由辩论不是一问一答，双方都可以回应、推进和提出多个问题，发言保持短促。';
  }

  if (trainingMode === 'constructive') {
    return '完成三分钟以内的一辩立论训练，系统将在发言后给出复盘评分。';
  }

  if (trainingMode === 'summary') {
    return '围绕场上交锋点完成攻辩小结，系统将在发言后给出复盘评分。';
  }

  if (trainingMode === 'closing') {
    return '围绕关键战场完成三分钟以内结辩，系统将在发言后给出复盘评分。';
  }

  if (trainingMode === 'defense') {
    return '先输入己方分论点和论据，AI 将围绕你的立论进行质询，你只做防守回应。';
  }

  return '输入辩题，选择立场与难度，让 AI 站在你的对立面进行训练。';
}

function getAnswerPlaceholder(trainingMode) {
  if (trainingMode === 'constructive') return '请输入你的完整三分钟立论，尽量做到观点清晰、论证完整、论据充分。';
  if (trainingMode === 'summary') return '请输入你的完整攻辩小结，集中回应场上交锋点并归纳本方优势。';
  if (trainingMode === 'closing') return '请输入你的完整三分钟结辩，完成战场归纳、胜负判断和价值收束。';
  if (trainingMode === 'free_debate') return '请输入你的自由辩论发言，可以回应、推进并提出问题，尽量控制在一二十秒内。';
  return '输入你的回答，尽量控制在30秒攻辩表达长度内。';
}

function getEmptyTrainingHint(trainingMode, userSide) {
  if (trainingMode === 'constructive' && userSide === 'affirmative') {
    return '正方一辩先进行，请直接完成你的三分钟立论。';
  }

  if (trainingMode === 'constructive') {
    return 'AI 将先模拟正方一辩立论，随后请你完成反方三分钟立论。';
  }

  if (trainingMode === 'free_debate') {
    return '自由辩论可以在同一轮中回应、推进并提问，发言尽量短促有力。';
  }

  return '完成设置后开始训练，AI 将根据当前模式给出开局材料或问题。';
}

function formatConversationContent(content, role) {
  const text = String(content || '').trim();

  if (!text || role !== 'ai') {
    return text;
  }

  return text
    .replace(/\*\*/g, '')
    .replace(/[ \t]*\r?\n[ \t]*/g, '\n')
    .replace(/\s*(对立方一辩陈词摘要|对立方已提出的关键点|对立方已形成的结辩素材|场上已有交锋点)[：:]?/g, '\n$1\n')
    .replace(/\s*(核心标准[：:])/g, '\n$1')
    .replace(/\s*(核心胜负判断[：:])/g, '\n$1')
    .replace(/\s*((?:\d+[.、]\s*)?(?:分论点|交锋点|主要论点)[一二三四五六七八九十\d]*[：:])/g, '\n\n$1')
    .replace(/\s*(摘要[：:])/g, '\n$1')
    .replace(/\s*(事实依据[：:])/g, '\n$1')
    .replace(/\s*(对立方主张[：:])/g, '\n$1')
    .replace(/\s*(理由[：:])/g, '\n$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function getOrCreateLocalUserId() {
  const existingUserId = localStorage.getItem(localUserIdStorageKey);

  if (isLocalUserId(existingUserId)) {
    return existingUserId;
  }

  const nextUserId = `user_${createUuid()}`;
  localStorage.setItem(localUserIdStorageKey, nextUserId);
  return nextUserId;
}

function createUuid() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'));

  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join('')
  ].join('-');
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function isLocalUserId(value) {
  return /^user_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function normalizeTeamCode(value) {
  return String(value || '').trim().toUpperCase();
}

function parseStoredSpace() {
  const storedSpace = String(localStorage.getItem(selectedSpaceStorageKey) || '');
  if (storedSpace.startsWith('team:')) {
    return { type: 'team', teamCode: normalizeTeamCode(storedSpace.slice(5)) };
  }

  const legacyMode = String(localStorage.getItem(appModeStorageKey) || '');
  const legacyTeamCode = normalizeTeamCode(localStorage.getItem(teamCodeStorageKey));
  if (legacyMode === 'team' && legacyTeamCode) {
    return { type: 'team', teamCode: legacyTeamCode };
  }

  return personalSpace;
}

function parseStoredAuthUser() {
  try {
    const user = JSON.parse(localStorage.getItem(authUserStorageKey) || 'null');
    return user?.id && user?.username ? user : null;
  } catch {
    return null;
  }
}

function stringifySpace(space) {
  return space.type === 'team' && space.teamCode ? `team:${space.teamCode}` : 'personal';
}

function validateRegisterInput(username, displayName, password, confirmPassword) {
  if (!/^[a-zA-Z0-9_]{4,20}$/.test(username)) {
    return '用户名仅支持 4-20 位英文字母、数字或下划线。';
  }

  if (!displayName || displayName.length > 20) {
    return '昵称不能为空，且不能超过 20 个字符。';
  }

  if (!password || password.length < 6) {
    return '密码至少需要 6 位。';
  }

  if (password !== confirmPassword) {
    return '两次输入的密码不一致。';
  }

  return '';
}

function validateTeamJoinInput(teamCode, teamPassword, nickname, teamName = null) {
  if (!/^[A-Z0-9_-]{3,32}$/.test(teamCode)) {
    return '请输入 3-32 位团队码，只能包含字母、数字、短横线或下划线。';
  }

  if (teamName !== null && (!teamName || teamName.length > 32 || /[<>]/.test(teamName))) {
    return '请输入 1-32 个字符的团队名称。';
  }

  if (!teamPassword || teamPassword.length < 4 || teamPassword.length > 64) {
    return '请输入 4-64 位团队密码。';
  }

  if (!nickname || nickname.length > 20 || /[<>]/.test(nickname)) {
    return '请输入 1-20 个字符的昵称。';
  }

  return '';
}

function extractScoreFromReview(reviewText) {
  const match = String(reviewText || '').match(/总分[：:]\s*(\d{1,3}(?:\.\d)?)\s*\/\s*100/);

  if (!match) {
    return null;
  }

  return formatScoreValue(match[1]);
}

function extractResultFromReview(reviewText) {
  const match = String(reviewText || '').match(/胜负倾向[：:]\s*(?:\n|\r\n)?\s*(用户明显胜|用户小优|势均力敌|用户偏劣)/);
  return match?.[1] || '';
}

function extractBattlefieldFromReview(reviewText) {
  const match = String(reviewText || '').match(/核心战场归属[：:]\s*(?:\n|\r\n)?\s*(用户小优|AI小优|势均力敌)/);
  return match?.[1] || '';
}

function normalizeStructuredReview(value) {
  if (!value || typeof value !== 'object') return null;
  const dimensionScores = Array.isArray(value.dimensionScores)
    ? value.dimensionScores
    : Array.isArray(value.dimension_scores)
      ? value.dimension_scores
      : [];

  return {
    score: formatScoreValue(value.score),
    scoreLevel: value.scoreLevel || value.score_level || '',
    mode: value.mode || value.trainingMode || value.training_mode || '',
    modeDisplayName: value.modeDisplayName || value.mode_display_name || '',
    dimensionScores: dimensionScores
      .map((item) => normalizeDimensionScoreItem(item))
      .filter((item) => item.name),
    battlefield: value.battlefield || '',
    mainWeakness: value.mainWeakness || value.main_weakness || '',
    strengths: Array.isArray(value.strengths) ? value.strengths.filter(Boolean) : [],
    weaknesses: Array.isArray(value.weaknesses) ? value.weaknesses.filter(Boolean) : [],
    reviewText: value.reviewText || value.review_text || '',
    nextStepAdvice: Array.isArray(value.nextStepAdvice)
      ? value.nextStepAdvice.filter(Boolean)
      : Array.isArray(value.next_step_advice)
        ? value.next_step_advice.filter(Boolean)
        : [],
    template: value.template || ''
  };
}

function buildReviewAssistantContext({ reviewText, reviewData, structuredReview, fallbackMode, assistantContext }) {
  const source = assistantContext || {};
  const normalizedReview = reviewData || normalizeStructuredReview(structuredReview) || {};
  const sourceMessages = Array.isArray(source.messages)
    ? source.messages
    : Array.isArray(structuredReview?.messages)
      ? structuredReview.messages
      : [];

  return {
    topic: source.topic || structuredReview?.topic || '',
    mode: source.mode || source.trainingMode || normalizedReview.mode || fallbackMode || structuredReview?.trainingMode || '',
    modeDisplayName: source.modeDisplayName || normalizedReview.modeDisplayName || getOptionLabel(trainingModes, fallbackMode) || '',
    difficulty: source.difficulty || structuredReview?.difficulty || '',
    userSide: source.userSide || structuredReview?.userSide || '',
    aiSide: source.aiSide || structuredReview?.aiSide || '',
    score: normalizedReview.score ?? structuredReview?.score ?? extractScoreFromReview(reviewText),
    scoreLevel: normalizedReview.scoreLevel || structuredReview?.scoreLevel || '',
    dimensionScores: normalizedReview.dimensionScores || [],
    review: reviewText || normalizedReview.reviewText || structuredReview?.review || '',
    highlights: normalizedReview.strengths || [],
    weaknesses: normalizedReview.weaknesses || [],
    battlefieldSummary: normalizedReview.battlefield || structuredReview?.battlefield || '',
    mainWeakness: normalizedReview.mainWeakness || '',
    nextStepAdvice: normalizedReview.nextStepAdvice || [],
    messages: sourceMessages
      .filter((item) => item && ['ai', 'user', 'assistant'].includes(item.role) && item.content)
      .slice(-10)
      .map((item) => ({
        role: item.role === 'assistant' ? 'ai' : item.role,
        content: String(item.content || '')
      }))
  };
}

function normalizeDimensionScoreItem(item) {
  const name = String(item?.name || '').trim();
  const rawScore = item?.score;
  const rawMaxScore = Number(item?.maxScore ?? item?.max_score ?? 100);
  const numericScore = Number(rawScore);
  const normalizedScore = Number.isFinite(numericScore)
    ? rawMaxScore && rawMaxScore !== 100
      ? (numericScore / rawMaxScore) * 100
      : numericScore
    : null;

  return {
    name,
    score: normalizedScore === null ? null : formatScoreValue(normalizedScore),
    maxScore: 100,
    comment: String(item?.comment || '').trim()
  };
}

function formatScoreValue(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return value ?? null;
  return Math.round(Math.max(0, Math.min(100, number)) * 10) / 10;
}

function formatNullableNumber(value) {
  if (value === null || value === undefined) return '--';
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(1) : value;
}

function toAbilityEstimate(score) {
  const number = Number(score);
  if (!Number.isFinite(number)) return null;
  const safeScore = Math.max(0, Math.min(100, number));
  return Math.round(300 + safeScore * 6);
}

function formatTrend(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || Math.abs(number) < 0.1) return '持平';
  return `${number > 0 ? '+' : ''}${number.toFixed(1)}`;
}

function formatRecordDate(value) {
  if (!value) return '未知时间';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '未知时间';
  }

  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatTaskDeadline(value) {
  if (!value) return '未设置截止时间';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '截止时间未知';
  }

  return `截止：${date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })}`;
}

function isTaskActive(task = {}) {
  return (task.status || 'active') === 'active';
}

function getTaskStatusLabel(status) {
  if (status === 'ended' || status === 'closed') return '已结束';
  if (status === 'expired') return '已过期';
  if (status === 'archived') return '已归档';
  return '进行中';
}

function getTaskAssignmentLabel(task = {}) {
  if (task.assignmentType === 'selected') {
    return `指定 ${Number(task.assignedCount || task.assignedMembers?.length || 0)} 人`;
  }
  return '全员';
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function isAudioRecorderSupported() {
  const AudioContextClass = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);

  return (
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    Boolean(AudioContextClass)
  );
}

function isPermissionDenied(error) {
  return error?.name === 'NotAllowedError' || error?.name === 'SecurityError';
}

function formatDuration(seconds) {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const restSeconds = String(safeSeconds % 60).padStart(2, '0');
  return `${minutes}:${restSeconds}`;
}

function mergeFloat32Chunks(chunks) {
  const totalLength = chunks.reduce((length, chunk) => length + chunk.length, 0);
  const result = new Float32Array(totalLength);
  let offset = 0;

  chunks.forEach((chunk) => {
    result.set(chunk, offset);
    offset += chunk.length;
  });

  return result;
}

function downsampleBuffer(buffer, inputSampleRate, outputSampleRate) {
  if (inputSampleRate === outputSampleRate) {
    return buffer;
  }

  const sampleRateRatio = inputSampleRate / outputSampleRate;
  const newLength = Math.round(buffer.length / sampleRateRatio);
  const result = new Float32Array(newLength);

  for (let index = 0; index < newLength; index += 1) {
    const start = Math.floor(index * sampleRateRatio);
    const end = Math.min(Math.floor((index + 1) * sampleRateRatio), buffer.length);
    let sum = 0;
    let count = 0;

    for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
      sum += buffer[sampleIndex];
      count += 1;
    }

    result[index] = count ? sum / count : 0;
  }

  return result;
}

function encodeWav(samples, sampleRate) {
  const bytesPerSample = 2;
  const dataLength = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  let offset = 44;
  samples.forEach((sample) => {
    const clampedSample = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, clampedSample < 0 ? clampedSample * 0x8000 : clampedSample * 0x7fff, true);
    offset += 2;
  });

  return new Blob([view], { type: 'audio/wav' });
}

function writeAscii(view, offset, text) {
  for (let index = 0; index < text.length; index += 1) {
    view.setUint8(offset + index, text.charCodeAt(index));
  }
}

function requireContent(data) {
  const content = String(data?.content || '').trim();
  if (!content) {
    throw new Error('AI 暂时没有返回内容，请重试。');
  }

  return content;
}

function getFriendlyError(error) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return '请求失败，请稍后重试。';
}

function getServerErrorMessage(status, message) {
  if (message === 'AI 暂时没有返回内容，请重试。') {
    return message;
  }

  if (typeof message === 'string' && message.startsWith('语音生成失败')) {
    return message;
  }

  if (message === '语音服务暂未配置') {
    return message;
  }

  if ([400, 401, 403, 409].includes(status) && message) {
    return message;
  }

  if (status === 429) {
    return 'AI 服务繁忙或额度不足，请稍后重试。';
  }

  if (status >= 500) {
    return 'AI 服务暂时不可用，请稍后重试。';
  }

  return '请求失败，请稍后重试。';
}

async function postJson(url, body) {
  let response;
  const token = localStorage.getItem(authTokenStorageKey);

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(body)
    });
  } catch {
    throw new Error('网络连接异常，请稍后重试。');
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(getServerErrorMessage(response.status, data.message));
  }

  return data;
}

async function getJson(url) {
  let response;
  const token = localStorage.getItem(authTokenStorageKey);

  try {
    response = await fetch(url, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
  } catch {
    throw new Error('网络连接异常，请稍后重试。');
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(getServerErrorMessage(response.status, data.message));
  }

  return data;
}

export default App;
