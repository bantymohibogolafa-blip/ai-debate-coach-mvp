import { useState } from 'react';
import { contactInfo, getFeedbackMailto } from '../data/contactInfo.js';

function fallbackCopy(text) {
  if (typeof document === 'undefined') return false;
  const input = document.createElement('textarea');
  input.value = text;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  input.remove();
  return copied;
}

export default function ContactFeedback({ variant = 'panel' }) {
  const [copyNotice, setCopyNotice] = useState('');

  async function copyWechat() {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        let timeoutId;
        try {
          await Promise.race([
            navigator.clipboard.writeText(contactInfo.wechat.value),
            new Promise((_, reject) => {
              timeoutId = window.setTimeout(() => reject(new Error('CLIPBOARD_TIMEOUT')), 500);
            })
          ]);
        } finally {
          window.clearTimeout(timeoutId);
        }
        setCopyNotice('微信号已复制');
        return;
      }
      if (fallbackCopy(contactInfo.wechat.value)) {
        setCopyNotice('微信号已复制');
        return;
      }
    } catch {
      // Continue to the safe manual-copy message below.
    }
    setCopyNotice(`请手动复制：${contactInfo.wechat.value}`);
  }

  const isGuide = variant === 'guide';

  return (
    <section className={`contact-feedback contact-feedback-${variant}`} aria-labelledby={`contact-feedback-title-${variant}`}>
      <div className="contact-feedback-heading">
        <h4 id={`contact-feedback-title-${variant}`}>联系与反馈</h4>
        <p>{isGuide ? '在使用过程中遇到任何问题，敬请联系：' : '欢迎反馈问题、交流技术并提出批评建议。'}</p>
      </div>
      <div className="contact-feedback-list">
        {contactInfo.emails.map((contact) => (
          <div className="contact-feedback-row" key={contact.value}>
            <span>{contact.name}｜{contact.role}</span>
            <a href={getFeedbackMailto(contact.value)}>{contact.value}</a>
          </div>
        ))}
        <div className="contact-feedback-row contact-feedback-wechat">
          <span>{isGuide ? `${contactInfo.wechat.name}｜微信` : `${contactInfo.wechat.name}微信`}</span>
          <span className="contact-feedback-copy-line">
            <strong>{contactInfo.wechat.value}</strong>
            <button type="button" onClick={copyWechat} aria-label={`复制微信号 ${contactInfo.wechat.value}`}>
              {isGuide ? '复制微信号' : '复制'}
            </button>
          </span>
        </div>
      </div>
      <div className="contact-feedback-footer">
        <p className="contact-feedback-closing">
          {isGuide ? '同时也欢迎技术交流和批评指正。' : '欢迎技术交流和批评指正。'}
        </p>
        <span className="contact-feedback-notice" role="status" aria-live="polite">{copyNotice}</span>
      </div>
    </section>
  );
}
