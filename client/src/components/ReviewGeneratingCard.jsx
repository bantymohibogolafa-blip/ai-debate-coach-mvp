import { useEffect, useMemo, useState } from 'react';

const reviewStages = [
  '正在读取本轮对话',
  '正在分析你的论证结构',
  '正在结算关键战场',
  '正在计算五维能力',
  '正在生成短板建议',
  '正在整理复盘报告'
];

export default function ReviewGeneratingCard({ status = 'loading', error = '' }) {
  const [progress, setProgress] = useState(status === 'complete' ? 100 : 8);
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    if (status === 'complete') {
      setProgress(100);
      setStageIndex(reviewStages.length - 1);
      return undefined;
    }

    if (status === 'error') {
      return undefined;
    }

    setProgress(8);
    setStageIndex(0);

    const progressTimer = window.setInterval(() => {
      setProgress((current) => {
        if (current >= 95) return 95;
        const nextStep = Math.max(1.2, (95 - current) * 0.08);
        return Math.min(95, current + nextStep);
      });
    }, 700);

    const stageTimer = window.setInterval(() => {
      setStageIndex((current) => Math.min(reviewStages.length - 1, current + 1));
    }, 1500);

    return () => {
      window.clearInterval(progressTimer);
      window.clearInterval(stageTimer);
    };
  }, [status]);

  const progressLabel = useMemo(() => `${Math.round(progress)}%`, [progress]);
  const isError = status === 'error';
  const isComplete = status === 'complete';
  const stageText = isError
    ? (error || '复盘生成失败，请稍后重试')
    : isComplete
      ? '复盘完成'
      : reviewStages[stageIndex];

  return (
    <article className={`review-generating-card ${isError ? 'error' : ''} ${isComplete ? 'complete' : ''}`}>
      <div className="review-generating-header">
        <div className="review-generating-spinner" aria-hidden="true" />
        <div>
          <span>复盘教练</span>
          <h3>{isError ? '复盘生成失败' : '正在生成复盘报告'}</h3>
        </div>
        <strong>{progressLabel}</strong>
      </div>
      <p>{stageText}</p>
      <div className="review-progress-track" aria-label="复盘生成进度">
        <span style={{ width: progressLabel }} />
      </div>
    </article>
  );
}
