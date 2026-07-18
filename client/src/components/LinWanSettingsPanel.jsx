import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const DEFAULT_PROFILE = {
  preferredName: '',
  responseLength: 'balanced',
  communicationStyle: 'balanced',
  answerOrder: 'auto',
  terminologyLevel: 'normal',
  customPreference: '',
  autoShowContext: true
};

const OPTION_GROUPS = [
  {
    key: 'responseLength',
    title: '回答详略',
    options: [['concise', '简洁'], ['balanced', '适中'], ['detailed', '详细']]
  },
  {
    key: 'communicationStyle',
    title: '交流方式',
    options: [['direct', '直接'], ['balanced', '平衡'], ['gentle', '温和']]
  },
  {
    key: 'answerOrder',
    title: '建议顺序',
    options: [['conclusion_first', '先给结论'], ['analysis_first', '先分析'], ['auto', '由林婉判断']]
  },
  {
    key: 'terminologyLevel',
    title: '辩论术语程度',
    options: [['plain', '通俗解释'], ['normal', '正常使用'], ['professional', '专业表达']]
  }
];

export default function LinWanSettingsPanel({
  isOpen,
  profile,
  isLoading,
  loadError,
  onRetry,
  onSave,
  onClose,
  onClearHistory,
  isClearingHistory,
  isChatBusy
}) {
  const [draft, setDraft] = useState(DEFAULT_PROFILE);
  const [baseline, setBaseline] = useState(DEFAULT_PROFILE);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearError, setClearError] = useState('');
  const [isVisible, setIsVisible] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const wasOpenRef = useRef(false);
  const isDirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(baseline), [draft, baseline]);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setIsClosing(false);
      return undefined;
    }

    if (!isVisible) return undefined;
    setIsClosing(true);
    const timer = window.setTimeout(() => {
      setIsVisible(false);
      setIsClosing(false);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [isOpen, isVisible]);

  useEffect(() => {
    if (!isVisible) return undefined;
    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverscroll = document.documentElement.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overscrollBehavior = previousDocumentOverscroll;
    };
  }, [isVisible]);

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      const next = { ...DEFAULT_PROFILE, ...(profile || {}) };
      setDraft(next);
      setBaseline(next);
      setSaveError('');
      setSaveStatus('');
      setShowDiscardConfirm(false);
      setShowClearConfirm(false);
      setClearError('');
    }
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const next = { ...DEFAULT_PROFILE, ...(profile || {}) };
    setDraft((current) => JSON.stringify(current) === JSON.stringify(baseline) ? next : current);
    setBaseline(next);
  }, [isOpen, profile]);

  if (!isVisible) return null;

  function updateDraft(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
    setSaveError('');
    setSaveStatus('');
  }

  function requestClose() {
    if (isDirty) {
      setShowDiscardConfirm(true);
      return;
    }
    onClose();
  }

  function revealFocusedField(event) {
    event.currentTarget.closest('.linwan-settings-field')?.scrollIntoView({
      block: 'center',
      behavior: 'smooth'
    });
  }

  async function saveProfile() {
    if (isSaving || !isDirty) return;
    setIsSaving(true);
    setSaveError('');
    setSaveStatus('');
    try {
      const savedProfile = await onSave(draft);
      if (!savedProfile) return;
      const next = { ...DEFAULT_PROFILE, ...savedProfile };
      setDraft(next);
      setBaseline(next);
      setSaveStatus('已保存，将从下一次回答开始生效。');
    } catch (error) {
      setSaveError(error?.message || '设置保存失败，请稍后重试。');
    } finally {
      setIsSaving(false);
    }
  }

  async function clearHistory() {
    if (isClearingHistory) return;
    setClearError('');
    try {
      const cleared = await onClearHistory();
      if (cleared) setShowClearConfirm(false);
    } catch (error) {
      setClearError(error?.message || '聊天记录清空失败，请稍后重试。');
    }
  }

  return createPortal(
    <div className="linwan-settings-backdrop" role="presentation">
      <aside className={`linwan-settings-panel${isClosing ? ' is-closing' : ''}`} role="dialog" aria-modal="true" aria-labelledby="linwan-settings-title">
        <header>
          <div>
            <span>个性设置</span>
            <h3 id="linwan-settings-title">我的林婉</h3>
          </div>
          <button type="button" className="linwan-settings-close" aria-label="关闭我的林婉设置" onClick={requestClose}>×</button>
        </header>

        {isLoading ? (
          <div className="linwan-settings-state">正在读取设置…</div>
        ) : loadError ? (
          <div className="linwan-settings-state error">
            <p>{loadError}</p>
            <button type="button" onClick={onRetry}>重新加载</button>
          </div>
        ) : (
          <>
            <div className="linwan-settings-scroll">
              <label className="linwan-settings-field">
                <span>林婉如何称呼我</span>
                <input
                  value={draft.preferredName}
                  maxLength={12}
                  onChange={(event) => updateDraft('preferredName', cleanInline(event.target.value, 12))}
                  onFocus={revealFocusedField}
                  placeholder="留空表示不主动使用称呼"
                />
                <small>{[...draft.preferredName].length} / 12</small>
              </label>

              {OPTION_GROUPS.map((group) => (
                <fieldset className="linwan-settings-field" key={group.key}>
                  <legend>{group.title}</legend>
                  <div className="linwan-settings-options">
                    {group.options.map(([value, label]) => (
                      <label className={draft[group.key] === value ? 'selected' : ''} key={value}>
                        <input
                          type="radio"
                          name={group.key}
                          value={value}
                          checked={draft[group.key] === value}
                          onChange={() => updateDraft(group.key, value)}
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}

              <label className="linwan-settings-field">
                <span>自由补充沟通偏好</span>
                <textarea
                  value={draft.customPreference}
                  maxLength={200}
                  rows={4}
                  onChange={(event) => updateDraft('customPreference', cleanInline(event.target.value, 200))}
                  onFocus={revealFocusedField}
                  placeholder="例如：指出问题时直接一些，但请给出可马上练的动作。"
                />
                <small>{[...draft.customPreference].length} / 200</small>
              </label>

              <label className="linwan-settings-switch">
                <span>
                  <strong>自动展示本轮参考</strong>
                  <small>关闭后仍可在每条回答下手动查看。</small>
                </span>
                <input
                  type="checkbox"
                  checked={draft.autoShowContext}
                  onChange={(event) => updateDraft('autoShowContext', event.target.checked)}
                />
              </label>

              <section className="linwan-settings-danger">
                <strong>聊天记录</strong>
                <p>清空不会影响设置、训练记录和近期训练画像。</p>
                <button type="button" disabled={isClearingHistory || isChatBusy} onClick={() => setShowClearConfirm(true)}>
                  清空全部聊天记录
                </button>
                {isChatBusy && <small>林婉回答完成后即可清空。</small>}
              </section>
            </div>

            <footer>
              <div aria-live="polite">
                {saveStatus && <span className="success">{saveStatus}</span>}
                {saveError && <span className="error">{saveError}</span>}
              </div>
              <button type="button" className="linwan-settings-save" disabled={!isDirty || isSaving} onClick={saveProfile}>
                {isSaving ? '保存中…' : '保存设置'}
              </button>
            </footer>
          </>
        )}

        {showDiscardConfirm && (
          <div className="linwan-settings-confirm" role="alertdialog" aria-modal="true" aria-labelledby="linwan-discard-title">
            <div>
              <h4 id="linwan-discard-title">设置尚未保存，确定放弃修改吗？</h4>
              <div>
                <button type="button" onClick={() => setShowDiscardConfirm(false)}>继续编辑</button>
                <button type="button" className="danger" onClick={onClose}>放弃修改</button>
              </div>
            </div>
          </div>
        )}

        {showClearConfirm && (
          <div className="linwan-settings-confirm" role="alertdialog" aria-modal="true" aria-labelledby="linwan-clear-title">
            <div>
              <h4 id="linwan-clear-title">确定清空全部聊天记录吗？</h4>
              <p>清空后无法恢复，但不会影响“我的林婉”设置、训练记录和近期训练画像。</p>
              {clearError && <span className="error">{clearError}</span>}
              <div>
                <button type="button" disabled={isClearingHistory} onClick={() => setShowClearConfirm(false)}>取消</button>
                <button type="button" className="danger" disabled={isClearingHistory || isChatBusy} onClick={clearHistory}>
                  {isClearingHistory ? '清空中…' : '确认清空'}
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>,
    document.body
  );
}

function cleanInline(value, maxLength) {
  return [...String(value || '')
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')]
    .slice(0, maxLength)
    .join('');
}
