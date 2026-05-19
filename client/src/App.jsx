import { useEffect, useMemo, useRef, useState } from 'react';

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
  { label: '黄执中式', value: 'huang_zhizhong_style', shortName: '黄执中式' },
  { label: '胡渐彪式', value: 'hu_jianbiao_style', shortName: '胡渐彪式' },
  { label: '马薇薇式', value: 'ma_weiwei_style', shortName: '马薇薇式' },
  { label: '乔布斯式', value: 'steve_jobs_style', shortName: '乔布斯式' }
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
    '高中生是否应该被允许自主选择作业量'
  ],
  technology: [
    '短视频平台对中学生成长利大于弊',
    '人工智能会让年轻人更有创造力',
    '线上娱乐是否正在削弱青少年的现实社交能力',
    '算法推荐让人更自由还是更不自由',
    '电子阅读比纸质阅读更适合当代学生',
    '科技便利是否降低了人的独立思考能力'
  ],
  growth: [
    '得而复失比从未得到更遗憾',
    '年轻人更应该追求稳定还是可能性',
    '成长中挫折教育比鼓励教育更重要',
    '面对失败，接受现实比坚持到底更重要',
    '中学生应该更早接触社会竞争',
    '被误解是成长中必须付出的代价'
  ],
  ethics: [
    '善意的谎言是否应该被接受',
    '公共利益是否应优先于个人选择',
    '犯错后弥补比道歉更重要',
    '规则公平比结果公平更重要',
    '评价一个人更应该看动机还是结果',
    '多数人的安全能否成为限制少数人自由的理由'
  ],
  culture: [
    '中学生不应该玩游戏',
    '追星对青少年成长利大于弊',
    '网络热梗让表达更丰富还是更贫乏',
    '流行文化比经典文化更能影响年轻人',
    '综艺节目是否降低了大众审美',
    '校园活动中竞技性比参与感更重要'
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
    description: '沿用当前一问一答训练流程，可选择3轮或5轮。'
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

const initialConfig = {
  topic: '',
  userSide: '',
  difficulty: 'novice',
  celebrityDebater: 'none',
  trainingMode: 'free_debate',
  rounds: 3
};

const teamCodeStorageKey = 'ai-debate-coach-team-code';
const nicknameStorageKey = 'ai-debate-coach-nickname';
const localUserIdStorageKey = 'ai-debate-coach-local-user-id';
const trainingRecordLimit = 20;

function App() {
  const [config, setConfig] = useState(initialConfig);
  const [history, setHistory] = useState([]);
  const [localUserId, setLocalUserId] = useState('');
  const [teamIdentity, setTeamIdentity] = useState({ teamCode: '', nickname: '' });
  const [joinForm, setJoinForm] = useState({ teamCode: '', nickname: '' });
  const [joinError, setJoinError] = useState('');
  const [isJoiningTeam, setIsJoiningTeam] = useState(false);
  const [activeTab, setActiveTab] = useState('training');
  const [trainingRecords, setTrainingRecords] = useState([]);
  const [teamRecords, setTeamRecords] = useState([]);
  const [teamStats, setTeamStats] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isTeamDataLoading, setIsTeamDataLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [teamDataError, setTeamDataError] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  const [answer, setAnswer] = useState('');
  const [review, setReview] = useState('');
  const [isTraining, setIsTraining] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [setupStep, setSetupStep] = useState('topic');
  const [topicDirection, setTopicDirection] = useState('education');
  const [generatedTopics, setGeneratedTopics] = useState([]);
  const [isPolishing, setIsPolishing] = useState(false);
  const [polishResult, setPolishResult] = useState(null);
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
  const selectedTrainingMode = trainingModes.find((item) => item.value === config.trainingMode) || trainingModes[2];
  const heroTitle = `锋辩——${trainingModeVenueNames[config.trainingMode] || '自由辩论训练场'}`;
  const isSingleSpeechMode = ['constructive', 'summary', 'closing'].includes(config.trainingMode);
  const isAttackMode = config.trainingMode === 'attack';
  const userStartsMode = config.userSide === 'affirmative' && (isSingleSpeechMode || isAttackMode);
  const selectedDifficultyLabel = isCelebrityMode
    ? `市赛 · ${selectedDebater?.shortName || '明星辩手'}`
    : getOptionLabel(difficulties, config.difficulty);
  const latestAiMessage = useMemo(() => getLatestMessage(history, 'ai'), [history]);
  const isBusy = isLoading || isPolishing || isTranscribing;
  const hasSessionContent = isTraining || history.length > 0 || Boolean(review);
  const hasJoinedTeam = Boolean(teamIdentity.teamCode && teamIdentity.nickname && localUserId);
  const maxRecordingSeconds = isSingleSpeechMode ? 180 : 60;

  useEffect(() => {
    const storedLocalUserId = getOrCreateLocalUserId();
    const storedTeamCode = normalizeTeamCode(localStorage.getItem(teamCodeStorageKey));
    const storedNickname = String(localStorage.getItem(nicknameStorageKey) || '').trim();

    setLocalUserId(storedLocalUserId);
    setTeamIdentity({ teamCode: storedTeamCode, nickname: storedNickname });
    setJoinForm({ teamCode: storedTeamCode, nickname: storedNickname });
  }, []);

  useEffect(() => {
    if (!hasJoinedTeam) return;

    loadTeamDashboard(teamIdentity.teamCode, localUserId);
  }, [hasJoinedTeam, teamIdentity.teamCode, localUserId]);

  useEffect(() => {
    return () => {
      stopRecordingResources(false);
    };
  }, []);

  async function joinTeam(event) {
    event.preventDefault();
    if (isJoiningTeam) return;

    const nextTeamCode = normalizeTeamCode(joinForm.teamCode);
    const nextNickname = joinForm.nickname.trim();
    const validationMessage = validateTeamJoinInput(nextTeamCode, nextNickname);

    if (validationMessage) {
      setJoinError(validationMessage);
      return;
    }

    const nextLocalUserId = localUserId || getOrCreateLocalUserId();
    setIsJoiningTeam(true);
    setJoinError('');

    try {
      await postJson('/api/team/join', {
        teamCode: nextTeamCode,
        nickname: nextNickname,
        localUserId: nextLocalUserId
      });

      localStorage.setItem(teamCodeStorageKey, nextTeamCode);
      localStorage.setItem(nicknameStorageKey, nextNickname);
      localStorage.setItem(localUserIdStorageKey, nextLocalUserId);
      setLocalUserId(nextLocalUserId);
      setTeamIdentity({ teamCode: nextTeamCode, nickname: nextNickname });
      setJoinForm({ teamCode: nextTeamCode, nickname: nextNickname });
      setActiveTab('training');
    } catch (requestError) {
      setJoinError(getFriendlyError(requestError));
    } finally {
      setIsJoiningTeam(false);
    }
  }

  function switchTeam() {
    if (isBusy || isRecording) return;

    localStorage.removeItem(teamCodeStorageKey);
    localStorage.removeItem(nicknameStorageKey);
    setTeamIdentity({ teamCode: '', nickname: '' });
    setJoinForm({ teamCode: '', nickname: '' });
    setTrainingRecords([]);
    setTeamRecords([]);
    setTeamStats(null);
    setSelectedRecord(null);
    setSaveStatus('');
    setHistoryError('');
    setTeamDataError('');
  }

  async function loadTeamDashboard(teamCode, userId) {
    await Promise.all([
      loadMyTrainingRecords(teamCode, userId),
      loadTeamData(teamCode)
    ]);
  }

  async function loadMyTrainingRecords(teamCode, userId) {
    setIsHistoryLoading(true);
    setHistoryError('');

    try {
      const data = await getJson(
        `/api/training-records/my?teamCode=${encodeURIComponent(teamCode)}&localUserId=${encodeURIComponent(userId)}`
      );
      setTrainingRecords(Array.isArray(data.records) ? data.records : []);
    } catch (requestError) {
      setHistoryError(getFriendlyError(requestError));
    } finally {
      setIsHistoryLoading(false);
    }
  }

  async function loadTeamData(teamCode) {
    setIsTeamDataLoading(true);
    setTeamDataError('');

    try {
      const [recordsData, statsData] = await Promise.all([
        getJson(`/api/training-records/team?teamCode=${encodeURIComponent(teamCode)}`),
        getJson(`/api/team/stats?teamCode=${encodeURIComponent(teamCode)}`)
      ]);
      setTeamRecords(Array.isArray(recordsData.records) ? recordsData.records : []);
      setTeamStats(statsData);
    } catch (requestError) {
      setTeamDataError(getFriendlyError(requestError));
    } finally {
      setIsTeamDataLoading(false);
    }
  }

  async function saveTrainingRecord(reviewContent) {
    setSaveStatus('正在保存本次训练记录...');

    try {
      const data = await postJson('/api/training-records', {
        teamCode: teamIdentity.teamCode,
        localUserId,
        nickname: teamIdentity.nickname,
        topic: config.topic,
        userSide: config.userSide,
        aiSide: getOpponentSideValue(config.userSide),
        difficulty: config.difficulty,
        styleId: config.celebrityDebater,
        trainingMode: config.trainingMode,
        messages: history,
        review: reviewContent,
        score: extractScoreFromReview(reviewContent),
        result: extractResultFromReview(reviewContent),
        battlefield: extractBattlefieldFromReview(reviewContent)
      });

      if (data.record) {
        setTrainingRecords((currentRecords) => [
          data.record,
          ...currentRecords.filter((record) => record.id !== data.record.id)
        ].slice(0, trainingRecordLimit));
        setTeamRecords((currentRecords) => [
          data.record,
          ...currentRecords.filter((record) => record.id !== data.record.id)
        ].slice(0, 50));
      }

      setSaveStatus('本次训练记录已保存。');
      loadTeamData(teamIdentity.teamCode);
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
    setGeneratedTopics(shuffle(pool).slice(0, 4));
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
    updateConfig({
      ...config,
      trainingMode: value,
      rounds: mode.rounds
    });
  }

  function goToDetailsStep() {
    if (isTraining || isBusy) return;

    if (!config.topic.trim()) {
      setError('请先输入辩题，或从随机生成的候选辩题中选择一个。');
      return;
    }

    setError('');
    setSetupStep('details');
  }

  function validateTrainingConfig() {
    if (!config.topic.trim()) {
      return '请先输入辩题，或从随机生成的候选辩题中选择一个。';
    }

    if (!config.userSide) {
      return '请先选择你的立场。';
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
    setHistory([]);
    setPolishResult(null);
    setSelectedRecord(null);
    setSaveStatus('');

    try {
      if (userStartsMode) {
        setHistory([{
          role: 'ai',
          content: getUserStartInstruction(config.trainingMode, config.userSide)
        }]);
      } else {
        const data = await postJson('/api/debate/start', {
          ...config,
          history: []
        });
        const content = requireContent(data);

        setHistory([{ role: 'ai', content }]);
      }
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

    if (isSingleSpeechMode && config.userSide === 'negative') {
      return;
    }

    if (userAnswers + 1 >= config.rounds && !isSingleSpeechMode) {
      return;
    }

    setIsLoading(true);

    try {
      const data = await postJson('/api/debate/respond', {
        ...config,
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

    setIsLoading(true);
    setError('');

    try {
      const data = await postJson('/api/debate/review', {
        ...config,
        history
      });
      const content = requireContent(data);

      setReview(content);
      setIsTraining(false);
      await saveTrainingRecord(content);
    } catch (requestError) {
      setError(getFriendlyError(requestError));
    } finally {
      setIsLoading(false);
    }
  }

  function resetTraining() {
    if (isBusy || isRecording) return;

    setConfig(initialConfig);
    setHistory([]);
    setAnswer('');
    setReview('');
    setError('');
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
    setSetupStep('topic');
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

  async function polishAnswer() {
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
        history,
        answer: trimmedAnswer
      });

      setPolishResult({
        original: data.original || trimmedAnswer,
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

  if (!hasJoinedTeam) {
    return (
      <main className="app-shell team-join-shell">
        <section className="panel team-join-panel">
          <div className="panel-title">
            <p className="eyebrow">团队空间</p>
            <h1>加入团队</h1>
            <p className="team-privacy-note">
              加入团队后，你的昵称、训练次数、分数、辩题和复盘结果可能被团队成员或队长查看，请勿输入私人敏感内容。
            </p>
          </div>

          <form className="team-join-form" onSubmit={joinTeam}>
            <label className="field">
              <span>昵称</span>
              <input
                value={joinForm.nickname}
                disabled={isJoiningTeam}
                onChange={(event) => setJoinForm({ ...joinForm, nickname: event.target.value })}
                placeholder="例如：党梓豪"
                maxLength={20}
              />
            </label>

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

            {joinError && <div className="error-box">{joinError}</div>}

            <button className="primary-button" type="submit" disabled={isJoiningTeam}>
              {isJoiningTeam ? '加入中...' : '加入团队'}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className={`app-shell ${hasSessionContent ? 'session-active' : ''}`}>
      <section className="team-topbar" aria-label="当前团队信息">
        <div>
          <span>当前团队：{teamIdentity.teamCode}</span>
          <strong>当前用户：{teamIdentity.nickname}</strong>
        </div>
        <button type="button" onClick={switchTeam} disabled={isBusy || isRecording}>
          切换团队
        </button>
      </section>

      <nav className="main-tabs" aria-label="功能分区">
        {[
          { label: '训练区', value: 'training' },
          { label: '我的记录', value: 'mine' },
          { label: '团队数据', value: 'team' }
        ].map((tab) => (
          <button
            type="button"
            key={tab.value}
            className={activeTab === tab.value ? 'active' : ''}
            onClick={() => {
              setActiveTab(tab.value);
              setSelectedRecord(null);
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'training' && (
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

      <section className="arena-hero">
        <div className="hero-copy">
          <p className="eyebrow">锋辩</p>
          <h1>{heroTitle}</h1>
          <p className="subtitle">
            输入辩题，选择立场与难度，让 AI 站在你的对立面进行一问一答式攻辩训练。
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
            <strong>{selectedTrainingMode.label}</strong>
          </div>
        </div>
      </section>

      {!hasSessionContent && setupStep === 'details' && (
        <section className="match-strip" aria-label="对阵信息">
          <div className="side-card user-side">
            <span>你方</span>
            <strong>{selectedSideLabel}</strong>
          </div>
          <div className="versus-mark">VS</div>
          <div className="side-card ai-side">
            <span>{isCelebrityMode ? '明星辩手模式' : 'AI 攻辩方'}</span>
            <strong>{isCelebrityMode ? selectedDebater.shortName : opponentSideLabel}</strong>
          </div>
        </section>
      )}

      <section className={`layout ${hasSessionContent ? 'debate-layout' : 'setup-layout'}`}>
        {!hasSessionContent && (
        <aside className="panel setup-panel">
          <div className="panel-title">
            <p className="eyebrow">赛前设置</p>
            <h2>{setupStep === 'topic' ? '选择辩题' : '选择训练方式'}</h2>
          </div>

          <div className="setup-progress" aria-label="赛前设置进度">
            <span className={setupStep === 'topic' ? 'active' : 'done'}>1 辩题</span>
            <span className={setupStep === 'details' ? 'active' : ''}>2 训练方式</span>
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

              <button className="primary-button" onClick={goToDetailsStep} disabled={isBusy}>
                下一步
              </button>
            </>
          ) : (
            <>
              <div className="selected-topic-card">
                <span>已选辩题</span>
                <strong>{config.topic}</strong>
                <button type="button" onClick={() => setSetupStep('topic')} disabled={isBusy}>
                  修改辩题
                </button>
              </div>

              <OptionGroup
                label="训练模式"
                options={trainingModes}
                value={config.trainingMode}
                disabled={isBusy}
                onChange={selectTrainingMode}
                className="training-mode-options"
              />

              <p className="mode-note">{selectedTrainingMode.description}</p>

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
                  已启用市赛难度。该模式仅做公开表达风格的训练模拟，不代表人物本人观点或真实发言。
                </p>
              )}

              <OptionGroup
                label="难度"
                options={difficulties}
                value={config.difficulty}
                disabled={isBusy || isCelebrityMode}
                onChange={(value) => updateConfig({ ...config, difficulty: value })}
              />

              <OptionGroup
                label="轮数"
                options={roundOptions.map((value) => ({ label: `${value}轮`, value }))}
                value={config.rounds}
                disabled={isBusy || !['free_debate', 'attack', 'defense'].includes(config.trainingMode)}
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

              <div className="button-stack">
                <button className="primary-button" onClick={startTraining} disabled={isBusy}>
                  {isLoading && !isTraining ? '生成中...' : '开始训练'}
                </button>
                <button className="ghost-button" onClick={() => setSetupStep('topic')} disabled={isBusy}>
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
                <p>完成左侧设置后开始训练，AI 将自动站在你的对立面提出第一轮问题。</p>
              </div>
            ) : (
              history.map((item, index) => (
                <article className={`message ${item.role}`} key={`${item.role}-${index}`}>
                  <span>{item.role === 'ai' ? 'AI 攻辩方' : '我的回答'}</span>
                  <p>{item.content}</p>
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
                    <span>第 {currentRound} / {config.rounds} 轮 · 本轮追问</span>
                    <p>{latestAiMessage || '等待 AI 追问。'}</p>
                  </div>
                  <textarea
                    value={answer}
                    disabled={isBusy}
                    onChange={(event) => {
                      setAnswer(event.target.value);
                      if (error) setError('');
                      if (polishResult) setPolishResult(null);
                    }}
                    placeholder="输入你的回答，尽量控制在30秒攻辩表达长度内。"
                    rows={4}
                  />
                  <div className="speech-panel">
                    <button
                      type="button"
                      className={`record-button ${isRecording ? 'recording' : ''}`}
                      onClick={isRecording ? stopAudioRecording : startAudioRecording}
                      disabled={isBusy}
                    >
                      {isRecording ? `停止并识别 ${formatDuration(recordingDuration)}` : '录音回答'}
                    </button>
                    <button
                      type="button"
                      className="polish-button"
                      onClick={polishAnswer}
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
                      <div className="polish-option featured">
                        <span>攻辩整理版</span>
                        <p>{polishResult.polished}</p>
                        <button type="button" onClick={() => usePolishedAnswer(polishResult.polished)}>
                          使用整理版
                        </button>
                      </div>
                      <div className="polish-option">
                        <span>30秒比赛版</span>
                        <p>{polishResult.concise}</p>
                        <button type="button" onClick={() => usePolishedAnswer(polishResult.concise)}>
                          使用30秒版
                        </button>
                      </div>
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
          <pre>{review}</pre>
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
          {isHistoryLoading && <span className="badge">加载中</span>}
        </div>
        <p className="anonymous-note">当前记录同步到团队空间，仅展示你在当前团队下的训练记录。</p>
        {saveStatus && <div className="history-status">{saveStatus}</div>}
        {historyError && <div className="error-box">{historyError}</div>}

        {!isHistoryLoading && trainingRecords.length === 0 ? (
          <div className="history-empty">暂无训练记录</div>
        ) : (
          <div className="history-list">
            {trainingRecords.map((record) => (
              <button
                type="button"
                key={record.id || record.createdAt}
                className={`history-item ${selectedRecord?.id === record.id ? 'active' : ''}`}
                onClick={() => setSelectedRecord(record)}
              >
                  <span>{formatRecordDate(record.createdAt)}</span>
                  <strong>{record.topic}</strong>
                  <small>
                  {getOptionLabel(trainingModes, record.trainingMode) || '自由辩论'} / {getOptionLabel(sides, record.userSide)} / {getOptionLabel(difficulties, record.difficulty)}
                  {record.score !== null && record.score !== undefined ? ` / ${record.score}分` : ''}
                  {record.result ? ` / ${record.result}` : ''}
                </small>
              </button>
            ))}
          </div>
        )}

        {selectedRecord && (
          <div className="history-detail">
            <div className="history-detail-header">
              <div>
                <span>{formatRecordDate(selectedRecord.createdAt)}</span>
                <h3>{selectedRecord.topic}</h3>
              </div>
              <button type="button" onClick={() => setSelectedRecord(null)}>
                收起
              </button>
            </div>

            <div className="history-meta">
              <span>我的立场：{getOptionLabel(sides, selectedRecord.userSide)}</span>
              <span>AI 立场：{getOptionLabel(sides, selectedRecord.aiSide)}</span>
              <span>难度：{getOptionLabel(difficulties, selectedRecord.difficulty)}</span>
              <span>风格：{getOptionLabel(celebrityDebaters, selectedRecord.styleId) || '普通 AI'}</span>
            </div>

            <div className="conversation history-conversation">
              {selectedRecord.messages.map((item, index) => (
                <article className={`message ${item.role}`} key={`${item.role}-${index}`}>
                  <span>{item.role === 'ai' ? 'AI 攻辩方' : '我的回答'}</span>
                  <p>{item.content}</p>
                </article>
              ))}
            </div>

            <div className="history-review">
              <h3>复盘报告</h3>
              <pre>{selectedRecord.review}</pre>
            </div>
          </div>
        )}
      </section>
      )}

      {activeTab === 'team' && (
        <TeamDataPanel
          records={teamRecords}
          stats={teamStats}
          selectedRecord={selectedRecord}
          isLoading={isTeamDataLoading}
          error={teamDataError}
          onSelectRecord={setSelectedRecord}
          onClearRecord={() => setSelectedRecord(null)}
        />
      )}
    </main>
  );
}

function TeamDataPanel({
  records,
  stats,
  selectedRecord,
  isLoading,
  error,
  onSelectRecord,
  onClearRecord
}) {
  const memberStats = Array.isArray(stats?.memberStats) ? stats.memberStats : [];
  const countRanking = [...memberStats].sort((a, b) => b.count - a.count);
  const scoreRanking = [...memberStats].sort((a, b) => (b.averageScore || 0) - (a.averageScore || 0));

  return (
    <section className="panel team-data-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">团队复盘</p>
          <h2>团队数据</h2>
        </div>
        {isLoading && <span className="badge">加载中</span>}
      </div>

      {error && <div className="error-box">{error}</div>}

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

      <div className="team-recent-section">
        <h3>最近训练记录</h3>
        {records.length === 0 ? (
          <div className="history-empty">暂无训练记录</div>
        ) : (
          <div className="history-list">
            {records.map((record) => (
              <button
                type="button"
                key={record.id || record.createdAt}
                className={`history-item ${selectedRecord?.id === record.id ? 'active' : ''}`}
                onClick={() => onSelectRecord(record)}
              >
                <span>{formatRecordDate(record.createdAt)} · {record.nickname || '未命名成员'}</span>
                <strong>{record.topic}</strong>
                <small>
                  {getOptionLabel(trainingModes, record.trainingMode) || '自由辩论'} / {getOptionLabel(difficulties, record.difficulty)}
                  {record.score !== null && record.score !== undefined ? ` / ${record.score}分` : ''}
                  {record.result ? ` / ${record.result}` : ''}
                </small>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedRecord && (
        <RecordDetail record={selectedRecord} onClose={onClearRecord} />
      )}
    </section>
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
            <li key={item.localUserId}>
              <span>{item.nickname || '未命名成员'}</span>
              <strong>{metric(item)}</strong>
            </li>
          ))}
        </ol>
      )}
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
            <p>{item.content}</p>
          </article>
        ))}
      </div>

      <div className="history-review">
        <h3>复盘报告</h3>
        <pre>{record.review}</pre>
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

function getLatestMessage(history, role) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (history[index].role === role) {
      return history[index].content;
    }
  }

  return '';
}

function getOpponentSideValue(userSide) {
  return userSide === 'affirmative' ? 'negative' : 'affirmative';
}

function getUserStartInstruction(trainingMode, userSide) {
  const sideLabel = getOptionLabel(sides, userSide);
  if (trainingMode === 'attack') {
    return `对立方一辩关键点已给出。${sideLabel}攻辩方请直接输入第一轮质询问题。`;
  }
  if (trainingMode === 'constructive') {
    return `对立方立论观点已给出。${sideLabel}一辩请直接完成立论。单次输入不超过1200字。`;
  }
  if (trainingMode === 'summary') {
    return `场上已有交锋点已给出。${sideLabel}请直接完成攻辩小结。`;
  }
  if (trainingMode === 'closing') {
    return `对立方结辩素材已给出。${sideLabel}四辩请直接完成结辩。单次输入不超过1200字。`;
  }
  return `${sideLabel}先进行。请开始你的发言。`;
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

function validateTeamJoinInput(teamCode, nickname) {
  if (!nickname || nickname.length > 20 || /[<>]/.test(nickname)) {
    return '请输入 1-20 个字符的昵称。';
  }

  if (!/^[A-Z0-9_-]{3,32}$/.test(teamCode)) {
    return '请输入 3-32 位团队码，只能包含字母、数字、短横线或下划线。';
  }

  return '';
}

function extractScoreFromReview(reviewText) {
  const match = String(reviewText || '').match(/总分[：:]\s*(\d{1,3})\s*\/\s*100/);

  if (!match) {
    return null;
  }

  return Math.min(100, Math.max(0, Number(match[1])));
}

function extractResultFromReview(reviewText) {
  const match = String(reviewText || '').match(/胜负倾向[：:]\s*(?:\n|\r\n)?\s*(用户明显胜|用户小优|势均力敌|用户偏劣)/);
  return match?.[1] || '';
}

function extractBattlefieldFromReview(reviewText) {
  const match = String(reviewText || '').match(/核心战场归属[：:]\s*(?:\n|\r\n)?\s*(用户小优|AI小优|势均力敌)/);
  return match?.[1] || '';
}

function formatNullableNumber(value) {
  return value === null || value === undefined ? '--' : value;
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

  if (status === 400 && message) {
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

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
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

  try {
    response = await fetch(url);
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
