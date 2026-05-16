import { useMemo, useState } from 'react';

const sides = ['正方', '反方'];
const difficulties = ['新手', '校赛', '市赛'];
const roundOptions = [3, 5];

const initialConfig = {
  topic: '',
  userSide: '正方',
  difficulty: '新手',
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

  async function startTraining() {
    if (!config.topic.trim()) {
      setError('请先输入辩题。');
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

      setHistory([{ role: 'ai', content: data.content }]);
      setIsTraining(true);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function submitAnswer() {
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

      setHistory([...nextHistory, { role: 'ai', content: data.content }]);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function finishAndReview() {
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

      setReview(data.content);
      setIsTraining(false);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsLoading(false);
    }
  }

  function resetTraining() {
    setConfig(initialConfig);
    setHistory([]);
    setAnswer('');
    setReview('');
    setError('');
    setIsTraining(false);
  }

  return (
    <main className="app-shell">
      <section className="intro">
        <div>
          <p className="eyebrow">高中辩论训练 MVP</p>
          <h1>AI 二辩攻辩陪练</h1>
          <p className="subtitle">
            输入辩题，选择立场与难度，让 AI 站在你的对立面进行一问一答式攻辩训练。
          </p>
        </div>
        <div className="status-card">
          <span>当前轮次</span>
          <strong>{Math.min(userAnswers + 1, config.rounds)} / {config.rounds}</strong>
        </div>
      </section>

      <section className="layout">
        <aside className="panel setup-panel">
          <label className="field">
            <span>辩题</span>
            <textarea
              value={config.topic}
              disabled={isTraining || isLoading}
              onChange={(event) => setConfig({ ...config, topic: event.target.value })}
              placeholder="例如：中学生使用 AI 工具利大于弊"
              rows={4}
            />
          </label>

          <OptionGroup
            label="我的立场"
            options={sides}
            value={config.userSide}
            disabled={isTraining || isLoading}
            onChange={(value) => setConfig({ ...config, userSide: value })}
          />

          <OptionGroup
            label="难度"
            options={difficulties}
            value={config.difficulty}
            disabled={isTraining || isLoading}
            onChange={(value) => setConfig({ ...config, difficulty: value })}
          />

          <OptionGroup
            label="轮数"
            options={roundOptions}
            value={config.rounds}
            disabled={isTraining || isLoading}
            onChange={(value) => setConfig({ ...config, rounds: value })}
            formatter={(value) => `${value}轮`}
          />

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
            <span className="badge">{config.userSide}训练</span>
          </div>

          <div className="conversation">
            {history.length === 0 ? (
              <div className="empty-state">
                完成左侧设置后开始训练，AI 将自动站在你的对立面提出第一轮问题。
              </div>
            ) : (
              history.map((item, index) => (
                <article className={`message ${item.role}`} key={`${item.role}-${index}`}>
                  <span>{item.role === 'ai' ? 'AI 攻辩方' : '我的回答'}</span>
                  <p>{item.content}</p>
                </article>
              ))
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
                    onChange={(event) => setAnswer(event.target.value)}
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

function OptionGroup({ label, options, value, onChange, disabled, formatter = String }) {
  return (
    <div className="option-group">
      <span>{label}</span>
      <div className="segmented">
        {options.map((option) => (
          <button
            type="button"
            key={option}
            disabled={disabled}
            className={option === value ? 'active' : ''}
            onClick={() => onChange(option)}
          >
            {formatter(option)}
          </button>
        ))}
      </div>
    </div>
  );
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || '请求失败，请稍后重试。');
  }

  return data;
}

export default App;
