import { useState } from 'react';

export default function LinWanContextManifest({ manifest, autoShow = true }) {
  const content = getManifestContent(manifest);
  const [isExpanded, setIsExpanded] = useState(Boolean(autoShow));
  if (!content.length) return null;

  return (
    <section className={`linwan-context-manifest ${isExpanded ? 'expanded' : ''}`}>
      <button
        type="button"
        className="linwan-context-toggle"
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded((value) => !value)}
      >
        <span aria-hidden="true">{isExpanded ? '▾' : '›'}</span>
        {isExpanded ? '本轮参考' : '查看本轮参考'}
      </button>
      {isExpanded && (
        <ul>
          {content.map((item) => <li key={item}>{item}</li>)}
        </ul>
      )}
    </section>
  );
}

function getManifestContent(manifest) {
  if (!manifest || typeof manifest !== 'object') return [];
  const lines = [];
  const preferenceSummary = Array.isArray(manifest.preferences?.summary)
    ? manifest.preferences.summary.filter((item) => typeof item === 'string' && item.trim()).slice(0, 4)
    : [];
  if (manifest.preferences?.used && preferenceSummary.length) {
    lines.push(`交流偏好：${preferenceSummary.join('、')}`);
  }
  if (manifest.preferences?.customPreferenceUsed) {
    lines.push('已参考你的补充沟通偏好');
  }
  const highlights = Array.isArray(manifest.trainingProfile?.highlights)
    ? manifest.trainingProfile.highlights.filter((item) => typeof item === 'string' && item.trim()).slice(0, 2)
    : [];
  if (manifest.trainingProfile?.used && highlights.length) {
    lines.push(`近期训练画像：${highlights.join('、')}`);
  }
  const rounds = Number(manifest.recentChat?.rounds || 0);
  if (manifest.recentChat?.used && rounds > 0) {
    lines.push(`历史对话：最近${Math.min(Math.max(Math.floor(rounds), 0), 8)}轮`);
  }
  return lines;
}
