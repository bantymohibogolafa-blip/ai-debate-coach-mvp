import { useEffect, useState } from 'react';

const modeCards = [
  {
    title: '立论训练',
    fit: '练开篇立论、定义判准、论点结构',
    summary: '帮你把观点讲清楚、立得住。'
  },
  {
    title: '攻辩小结',
    fit: '练攻辩后的战场结算',
    summary: '帮你总结刚才交锋中谁拿下了关键点。'
  },
  {
    title: '自由辩论',
    fit: '练快速反应、短句反击、战场控制',
    summary: '适合训练临场攻防和快速追问。'
  },
  {
    title: '攻辩训练',
    fit: '练质询、连续追问、打穿对方漏洞',
    summary: '适合训练“怎么问得准、追得狠”。'
  },
  {
    title: '防守训练',
    fit: '练被质询时的回应、切割和反压',
    summary: '适合训练“被问住时怎么稳住”。'
  },
  {
    title: '结辩训练',
    fit: '练总结陈词、胜负比较、价值升华',
    summary: '帮你把整场比赛收回来。'
  }
];

const featureCards = [
  ['整理表达', '把你的原始回答整理成更适合当前训练模式的表达版本。'],
  ['录音回答', '可以用语音输入回答，适合手机端快速训练。'],
  ['提交回答', '把你的回答提交给 AI，让 AI 继续追问或交锋。'],
  ['结束并复盘', '结束本轮训练，生成复盘报告、评分、问题分析和下一步建议。'],
  ['历史记录', '查看你之前的训练结果。'],
  ['团队模式', '和队友共享训练数据，适合辩论队或备赛小组使用。']
];

const pages = [
  {
    title: '锋辩是什么？',
    body: (
      <>
        <p>
          锋辩是一个 AI 辩论训练工具。你可以选择辩题、训练模式和立场，与 AI 进行攻防练习。
          AI 会站在你的对立面进行质询、反驳或交锋，训练结束后生成复盘报告和评分建议。
        </p>
        <div className="onboarding-tip">
          训练中 AI 是你的对手；复盘时 AI 才是你的教练。
        </div>
      </>
    )
  },
  {
    title: '如何开始一次训练？',
    body: (
      <>
        <ol className="onboarding-steps">
          <li>选择或填写一个辩题。</li>
          <li>选择训练模式。</li>
          <li>选择你的立场。</li>
          <li>填写你的观点和论据。</li>
          <li>开始和 AI 交锋。</li>
          <li>点击“结束并复盘”查看评分与建议。</li>
        </ol>
        <div className="onboarding-tip">
          如果你不知道怎么写，可以先写一个简单观点，后面用“整理表达”优化。
        </div>
      </>
    )
  },
  {
    title: '我该选哪个模式？',
    body: (
      <div className="onboarding-mode-grid">
        {modeCards.map((mode) => (
          <article key={mode.title} className="onboarding-mode-card">
            <h3>{mode.title}</h3>
            <p>适合：{mode.fit}。</p>
            <strong>{mode.summary}</strong>
          </article>
        ))}
      </div>
    )
  },
  {
    title: '常用功能说明',
    body: (
      <div className="onboarding-feature-list">
        {featureCards.map(([title, description]) => (
          <article key={title} className="onboarding-feature-card">
            <strong>{title}</strong>
            <p>{description}</p>
          </article>
        ))}
      </div>
    )
  }
];

export default function OnboardingGuide({ open, onClose, onStart }) {
  const [pageIndex, setPageIndex] = useState(0);
  const page = pages[pageIndex];
  const isFirst = pageIndex === 0;
  const isLast = pageIndex === pages.length - 1;

  useEffect(() => {
    if (open) {
      setPageIndex(0);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="onboarding-backdrop" role="presentation">
      <section className="onboarding-panel" role="dialog" aria-modal="true" aria-label="新手指导">
        <div className="onboarding-header">
          <p className="eyebrow">3 步开始一次 AI 辩论训练</p>
          <h2>第一次使用锋辩？</h2>
        </div>

        <div className="onboarding-progress" aria-label="引导进度">
          {pages.map((item, index) => (
            <span
              key={item.title}
              className={index === pageIndex ? 'active' : ''}
              aria-current={index === pageIndex ? 'step' : undefined}
            />
          ))}
        </div>

        <div className="onboarding-content">
          <h3>{page.title}</h3>
          {page.body}
        </div>

        <div className="onboarding-actions">
          <button type="button" className="ghost-button" onClick={onClose}>
            跳过
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => setPageIndex((current) => Math.max(0, current - 1))}
            disabled={isFirst}
          >
            上一步
          </button>
          {isLast ? (
            <button type="button" className="primary-button" onClick={onStart}>
              开始训练
            </button>
          ) : (
            <button
              type="button"
              className="primary-button"
              onClick={() => setPageIndex((current) => Math.min(pages.length - 1, current + 1))}
            >
              下一步
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
