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

const initialConfig = {
  topic: '',
  userSide: '',
  difficulty: 'novice',
  celebrityDebater: 'none',
  rounds: 3
};

function App() {
  const [config, setConfig] = useState(initialConfig);
  const [history, setHistory] = useState([]);
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
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState('');
  const [speechStatus, setSpeechStatus] = useState('');
  const [isSpeechSupported, setIsSpeechSupported] = useState(true);
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const recordingStreamRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const recordingStartedAtRef = useRef(0);

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
  const selectedDifficultyLabel = isCelebrityMode
    ? `市赛 · ${selectedDebater?.shortName || '明星辩手'}`
    : getOptionLabel(difficulties, config.difficulty);
  const latestAiMessage = useMemo(() => getLatestMessage(history, 'ai'), [history]);
  const isBusy = isLoading || isPolishing || isTranscribing;
  const hasSessionContent = isTraining || history.length > 0 || Boolean(review);

  useEffect(() => {
    const SpeechRecognition = getSpeechRecognition();
    setIsSpeechSupported(Boolean(SpeechRecognition));

    if (!SpeechRecognition) {
      setSpeechError('当前浏览器不支持实时语音识别，请使用文字输入，或切换到 Chrome / Edge 浏览器。');
    } else if (isWeChatBrowser()) {
      setSpeechStatus('微信内实时语音识别可能不稳定，建议优先使用录音回答。');
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      stopRecordingResources(false);
    };
  }, []);

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

    try {
      const data = await postJson('/api/debate/start', {
        ...config,
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
    if (isBusy || isListening || isRecording) return;

    const trimmedAnswer = answer.trim();
    if (!trimmedAnswer) {
      setError('请先输入你的回答。');
      return;
    }

    const nextHistory = [...history, { role: 'user', content: trimmedAnswer }];
    setHistory(nextHistory);
    setAnswer('');
    setError('');
    setPolishResult(null);

    if (userAnswers + 1 >= config.rounds) {
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
    } catch (requestError) {
      setError(getFriendlyError(requestError));
    } finally {
      setIsLoading(false);
    }
  }

  async function finishAndReview() {
    if (isBusy || isListening) return;

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
    } catch (requestError) {
      setError(getFriendlyError(requestError));
    } finally {
      setIsLoading(false);
    }
  }

  function resetTraining() {
    if (isBusy || isListening) return;

    setConfig(initialConfig);
    setHistory([]);
    setAnswer('');
    setReview('');
    setError('');
    setSpeechError(isSpeechSupported ? '' : '当前浏览器不支持实时语音识别，请使用文字输入，或切换到 Chrome / Edge 浏览器。');
    setSpeechStatus('');
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

  function startSpeechRecognition() {
    if (isBusy || isListening || isRecording) return;

    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      setIsSpeechSupported(false);
      setSpeechStatus('');
      setSpeechError('当前浏览器不支持实时语音识别，请使用文字输入，或切换到 Chrome / Edge 浏览器。');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim();
      if (!transcript) return;

      appendAnswerText(transcript);
      setPolishResult(null);
      setSpeechError('');
      setSpeechStatus('识别完成，请检查文字后提交。');
    };

    recognition.onerror = (event) => {
      const isPermissionError = event.error === 'not-allowed' || event.error === 'service-not-allowed';
      setSpeechStatus('');
      setSpeechError(isPermissionError ? '请允许浏览器使用麦克风后再试。' : '识别失败，请重试。');
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    setSpeechError('');
    setSpeechStatus('正在聆听，请开始回答。');
    setIsListening(true);

    try {
      recognition.start();
    } catch {
      setIsListening(false);
      setSpeechStatus('');
      setSpeechError('识别失败，请重试。');
      recognitionRef.current = null;
    }
  }

  function stopSpeechRecognition() {
    if (!recognitionRef.current) return;

    recognitionRef.current.stop();
    setIsListening(false);
    setSpeechStatus('');
  }

  async function startAudioRecording() {
    if (isBusy || isRecording || isListening) return;

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
      const mimeType = getSupportedAudioMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      recordingChunksRef.current = [];
      recordingStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recordingStartedAtRef.current = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setIsRecording(false);
        setRecordingStatus('');
        setRecordingError('录音失败，请重试或改用文字输入。');
        stopRecordingResources();
      };

      recorder.onstop = () => {
        uploadRecordedAudio(recorder.mimeType || mimeType || 'audio/webm');
      };

      recorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      setRecordingError('');
      setSpeechStatus('');
      setRecordingStatus('正在录音，请开始回答。最多录制 60 秒。');

      recordingTimerRef.current = window.setInterval(() => {
        const seconds = Math.floor((Date.now() - recordingStartedAtRef.current) / 1000);
        setRecordingDuration(seconds);

        if (seconds >= 60) {
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
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;

    setIsRecording(false);
    setRecordingStatus('正在上传录音并转文字...');
    clearRecordingTimer();
    recorder.stop();
  }

  async function uploadRecordedAudio(mimeType) {
    const chunks = recordingChunksRef.current;
    stopRecordingTracks();

    if (!chunks.length) {
      setRecordingStatus('');
      setRecordingError('没有录到声音，请重新录音。');
      return;
    }

    const audioBlob = new Blob(chunks, { type: mimeType });
    const nextAudioUrl = URL.createObjectURL(audioBlob);
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
          'Content-Type': mimeType
        },
        body: audioBlob
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
      recordingChunksRef.current = [];
      mediaRecorderRef.current = null;
    }
  }

  async function polishAnswer() {
    if (isBusy || isListening || isRecording) return;

    const trimmedAnswer = answer.trim();
    if (!trimmedAnswer) {
      setError('请先输入你的回答。');
      return;
    }

    setIsPolishing(true);
    setError('');
    setSpeechStatus('');

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
    setSpeechStatus('已放入回答框，请检查文字后提交。');
    setSpeechError('');
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

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null;
      recorder.stop();
    }

    mediaRecorderRef.current = null;
    recordingChunksRef.current = [];
    stopRecordingTracks();
    if (updateState) {
      setIsRecording(false);
    }
  }

  return (
    <main className={`app-shell ${hasSessionContent ? 'session-active' : ''}`}>
      <section className="arena-hero">
        <div className="hero-copy">
          <p className="eyebrow">高中辩论训练场</p>
          <h1>AI 二辩攻辩陪练</h1>
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
              <button className="compact-reset-button" type="button" onClick={resetTraining} disabled={isBusy || isListening || isRecording}>
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
                      if (speechError && isSpeechSupported) setSpeechError('');
                      if (polishResult) setPolishResult(null);
                    }}
                    placeholder="输入你的回答，尽量控制在30秒攻辩表达长度内。"
                    rows={4}
                  />
                  <div className="speech-panel">
                    {isSpeechSupported ? (
                      <button
                        type="button"
                        className={`voice-button ${isListening ? 'listening' : ''}`}
                        onClick={isListening ? stopSpeechRecognition : startSpeechRecognition}
                        disabled={isBusy || isRecording}
                      >
                        {isListening ? '停止识别' : '实时语音输入（实验）'}
                      </button>
                    ) : (
                      <button type="button" className="voice-button" disabled>
                        实时语音输入（实验）
                      </button>
                    )}
                    <button
                      type="button"
                      className={`record-button ${isRecording ? 'recording' : ''}`}
                      onClick={isRecording ? stopAudioRecording : startAudioRecording}
                      disabled={isBusy || isListening}
                    >
                      {isRecording ? `停止并识别 ${formatDuration(recordingDuration)}` : '录音回答'}
                    </button>
                    <button
                      type="button"
                      className="polish-button"
                      onClick={polishAnswer}
                      disabled={isBusy || isListening || isRecording || !answer.trim()}
                    >
                      {isPolishing ? '整理中...' : '整理表达'}
                    </button>
                  </div>
                  {(speechStatus || speechError || recordingStatus || recordingError) && (
                    <div className={(speechError || recordingError) ? 'speech-message error' : 'speech-message'}>
                      {speechError || recordingError || recordingStatus || speechStatus}
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
                  <button className="primary-button" onClick={submitAnswer} disabled={isBusy || isListening || isRecording}>
                    {isLoading ? '分析中...' : '提交回答'}
                  </button>
                </>
              )}

              <button className="secondary-button" onClick={finishAndReview} disabled={isBusy || isListening || isRecording || !history.length}>
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
    </main>
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

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function getSpeechRecognition() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function isAudioRecorderSupported() {
  return (
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== 'undefined'
  );
}

function isWeChatBrowser() {
  if (typeof navigator === 'undefined') {
    return false;
  }

  return /micromessenger/i.test(navigator.userAgent || '');
}

function getSupportedAudioMimeType() {
  if (typeof MediaRecorder === 'undefined') {
    return '';
  }

  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/ogg'
  ];

  return candidates.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) || '';
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

export default App;
