import { useEffect, useState } from 'react';
import ContactFeedback from './ContactFeedback.jsx';
import {
  getInitialOnboardingPageIndex,
  getNextOnboardingPageIndex,
  getOnboardingPrimaryAction,
  getPreviousOnboardingPageIndex,
  onboardingKicker,
  onboardingPages
} from '../data/onboardingContent.js';

function FeatureList({ items }) {
  return (
    <div className="onboarding-feature-list">
      {items.map((item) => (
        <article key={item.title} className="onboarding-feature-card">
          <strong>{item.title}</strong>
          <p>{item.description}</p>
        </article>
      ))}
    </div>
  );
}

function PageBody({ page }) {
  if (page.id === 'modes') {
    return (
      <div className="onboarding-mode-grid">
        {page.modes.map((mode) => (
          <article key={mode.title} className="onboarding-mode-card">
            <h3>{mode.title}</h3>
            <p>适合：{mode.fit}</p>
            <strong>{mode.summary}</strong>
          </article>
        ))}
      </div>
    );
  }

  if (page.id === 'three-steps') {
    return (
      <>
        <ol className="onboarding-steps onboarding-three-steps">
          {page.steps.map((step) => (
            <li key={step.title}>
              <strong>{step.title}</strong>
              <span>{step.description}</span>
            </li>
          ))}
        </ol>
        <div className="onboarding-tip">{page.tip}</div>
      </>
    );
  }

  if (page.id === 'answering' || page.id === 'review') {
    return (
      <>
        <FeatureList items={page.features} />
        <div className="onboarding-tip">{page.tip}</div>
      </>
    );
  }

  if (page.id === 'spaces') {
    return (
      <>
        <FeatureList items={page.sections} />
        <ul className="onboarding-compact-list">{page.bullets.map((item) => <li key={item}>{item}</li>)}</ul>
        <div className="onboarding-tip">{page.tip}</div>
      </>
    );
  }

  if (page.id === 'start') {
    return (
      <>
        <p className="onboarding-closing-copy">{page.intro}</p>
        <ContactFeedback variant="guide" />
      </>
    );
  }

  return (
    <>
      <p>{page.intro}</p>
      {page.bullets && <ul className="onboarding-compact-list">{page.bullets.map((item) => <li key={item}>{item}</li>)}</ul>}
      {page.tip && <div className="onboarding-tip">{page.tip}</div>}
      {page.note && <p className="onboarding-note">{page.note}</p>}
    </>
  );
}

export default function OnboardingGuide({ open, onClose, onStart }) {
  const [pageIndex, setPageIndex] = useState(getInitialOnboardingPageIndex);
  const page = onboardingPages[pageIndex];
  const isFirst = pageIndex === 0;
  const primaryAction = getOnboardingPrimaryAction(pageIndex);

  useEffect(() => {
    if (open) setPageIndex(getInitialOnboardingPageIndex());
  }, [open]);

  if (!open) return null;

  return (
    <div className="onboarding-backdrop" role="presentation">
      <section className="onboarding-panel" role="dialog" aria-modal="true" aria-label="新手指导">
        <div className="onboarding-header">
          <p className="eyebrow">{onboardingKicker}</p>
          <h2>第一次使用锋辩？</h2>
        </div>

        <div className="onboarding-progress" aria-label="引导进度">
          {onboardingPages.map((item, index) => (
            <span
              key={item.title}
              className={index === pageIndex ? 'active' : ''}
              aria-current={index === pageIndex ? 'step' : undefined}
            />
          ))}
        </div>

        <div className="onboarding-content">
          <h3>{page.title}</h3>
          <PageBody page={page} />
        </div>

        <div className="onboarding-actions">
          <button type="button" className="ghost-button" onClick={onClose}>跳过</button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => setPageIndex(getPreviousOnboardingPageIndex)}
            disabled={isFirst}
          >
            上一步
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={primaryAction.type === 'start'
              ? onStart
              : () => setPageIndex(getNextOnboardingPageIndex)}
          >
            {primaryAction.label}
          </button>
        </div>
      </section>
    </div>
  );
}
