import { useMemo, useState } from 'react';

const sides = [
  { label: '正方', value: 'affirmative' },
  { label: '反方', value: 'negative' }
];

const difficulties = [
  { label: '新手', value: 'novice' },
  { label: '校赛', value: 'campus' },
  { label: '市赛', value: 'city' }
];

const roundOptions = [3, 5];

const initialConfig = {
  topic: '',
  userSide: '',
  difficulty: 'novice',
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

  const userAnswers = useMemo(
    () => history.filter((item) => item.role === 'user').length,
    [history]
  );
  const isFinished = isTraining && userAnswers >= config.rounds;
  const currentRound = Math.min(userAnswers + 1, config.rounds);
  const selectedSideLabel = getOptionLabel(sides, config.userSide) || '待选择';
  const opponentSideLabel = config.userSide
    ? config.userSide === 'affirmative'
      ? '反方'
      : '正方'
    : '待定';
  const selectedDifficultyLabel = getOptionLabel(difficulties, config.difficulty);

  function updateConfig(nextConfig) {
    setConfig(nextConfig);
    if (error) setError('');
  }

  function validateTrainingConfig() {
    if (!config.topic.trim()) {
      return '请先输入辩题。';
    }

    if (!config.userSide) {
      return '请先选择你的立场。';
    }

    return '';
  }

  async function startTraining() {
    if (isLoading) return;

    const validationError = validateTrainingConfig();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);
    setError('');
    setReview('');
    setHistory([]);

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
    if (isLoading) return;

    const trimmedAnswer = answer.trim();
    if (!trimmedAnswer) {
      setError('请先输入你的回答。');
      return;
    }

    const nextHistory = [...history, { role: 'user', content: trimmedAnswer }];
    setHistory(nextHistory);
    setAnswer('');
    setError('');

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
    if (isLoading) return;

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
    if (isLoading) return;

    setConfig(initialConfig);
    setHistory([]);
    setAnswer('');
    setReview('');
    setError('');
    setIsTraining(false);
  }

  return (
    <main className="app-shell">
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

      <section className="match-strip" aria-label="对阵信息">
        <div className="side-card user-side">
          <span>你方</span>
          <strong>{selectedSideLabel}</strong>
        </div>
        <div className="versus-mark">VS</div>
        <div className="side-card ai-side">
          <span>AI 攻辩方</span>
          <strong>{opponentSideLabel}</strong>
        </div>
      </section>

      <section className="layout">
        <aside className="panel setup-panel">
          <div className="panel-title">
            <p className="eyebrow">赛前设置</p>
            <h2>训练席</h2>
          </div>

          <label className="field">
            <span>辩题</span>
            <textarea
              value={config.topic}
              disabled={isTraining || isLoading}
              onChange={(event) => updateConfig({ ...config, topic: event.target.value })}
              placeholder="例如：中学生使用 AI 工具利大于弊"
              rows={4}
            />
          </label>

          <OptionGroup
            label="我的立场"
            options={sides}
            value={config.userSide}
            disabled={isTraining || isLoading}
            onChange={(value) => updateConfig({ ...config, userSide: value })}
          />

          <OptionGroup
            label="难度"
            options={difficulties}
            value={config.difficulty}
            disabled={isTraining || isLoading}
            onChange={(value) => updateConfig({ ...config, difficulty: value })}
          />

          <OptionGroup
            label="轮数"
            options={roundOptions.map((value) => ({ label: `${value}轮`, value }))}
            value={config.rounds}
            disabled={isTraining || isLoading}
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
            <button className="primary-button" onClick={startTraining} disabled={isLoading || isTraining}>
              {isLoading && !isTraining ? '生成中...' : '开始训练'}
            </button>
            <button className="ghost-button" onClick={resetTraining} disabled={isLoading}>
              重新设置
            </button>
          </div>
        </aside>

        <section className="panel coach-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">攻辩记录</p>
              <h2>{config.topic || '等待输入辩题'}</h2>
            </div>
            <span className="badge">{selectedSideLabel}训练</span>
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
                  <textarea
                    value={answer}
                    disabled={isLoading}
                    onChange={(event) => {
                      setAnswer(event.target.value);
                      if (error) setError('');
                    }}
                    placeholder="输入你的回答，尽量控制在30秒攻辩表达长度内。"
                    rows={4}
                  />
                  <button className="primary-button" onClick={submitAnswer} disabled={isLoading}>
                    {isLoading ? '分析中...' : '提交回答'}
                  </button>
                </>
              )}

              <button className="secondary-button" onClick={finishAndReview} disabled={isLoading || !history.length}>
                结束并复盘
              </button>
            </div>
          )}

          {error && <div className="error-box">{error}</div>}
        </section>
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

function OptionGroup({ label, options, value, onChange, disabled }) {
  return (
    <div className="option-group">
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
