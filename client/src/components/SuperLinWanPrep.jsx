import { useEffect, useMemo, useRef, useState } from 'react';

const stanceOptions = [
  { value: 'affirmative', label: '正方' },
  { value: 'negative', label: '反方' },
  { value: 'undecided', label: '暂未确定' }
];

const quickPrompts = [
  {
    intent: 'deconstruct',
    label: '拆辩题',
    text: '【拆辩题】\n\n请基于当前任务，帮我拆解辩题的核心概念、争议对象、比较标准、双方举证责任和可能的核心战场。不要一次性给完整成品。如果信息不足，请先问我最关键的一个问题。'
  },
  {
    intent: 'expand',
    label: '发散论点',
    text: '【发散论点】\n\n请基于当前任务、当前已经确认的思路和被否定的思路，发散几条有明显区别的论点路线。请说明每条路线的逻辑链、优势、风险以及适合作为主论还是辅助论。不要悄悄恢复我已经否定的思路。'
  },
  {
    intent: 'evidence',
    label: '搜集论据',
    text: '【搜集论据】\n\n请基于当前任务和当前已经形成的论点，联网搜集可用的事实、案例、数据、研究或现实材料，同时检查反例与限制条件。请标注来源编号，并区分已取得的材料、仅供追查的线索和仍需核实的内容。'
  }
];

const reportPrompt = '请基于当前任务内已经讨论的内容，形成当前思路报告。';

const emptyForm = {
  debateTopic: '',
  stance: 'undecided',
  debatePosition: 'undecided',
  initialIdeas: ''
};

export default function SuperLinWanPrep({
  api,
  isLoggedIn,
  currentUser,
  initialTaskId = '',
  initialDraft = null,
  onDraftConsumed,
  onRequestLogin,
}) {
  const [tasks, setTasks] = useState([]);
  const [listStatus, setListStatus] = useState({ loading: false, error: '' });
  const [listFilter, setListFilter] = useState('active');
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailStatus, setDetailStatus] = useState({ loading: false, error: '' });
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(emptyForm);
  const [question, setQuestion] = useState('');
  const [questionIntent, setQuestionIntent] = useState('chat');
  const [isAdjustingEvidenceScope, setIsAdjustingEvidenceScope] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendingIntent, setSendingIntent] = useState('chat');
  const [sendingEvidenceAction, setSendingEvidenceAction] = useState('');
  const [chatError, setChatError] = useState('');
  const [actionStatus, setActionStatus] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [noteStatus, setNoteStatus] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [endedChallengeSessionId, setEndedChallengeSessionId] = useState('');
  const chatEndRef = useRef(null);
  const openingTaskRef = useRef('');
  const draftRef = useRef('');
  const scope = { spaceType: 'personal', teamCode: '' };
  const scopeKey = `${scope.spaceType}:${scope.teamCode}:${currentUser?.id || ''}`;
  const canCreateInScope = true;
  const challengeState = useMemo(
    () => deriveChallengeState(detail?.messages, endedChallengeSessionId),
    [detail?.messages, endedChallengeSessionId]
  );

  const visibleTasks = useMemo(
    () => tasks.filter((task) => task.status === listFilter),
    [tasks, listFilter]
  );

  useEffect(() => {
    setDetail(null);
    setDetailStatus({ loading: false, error: '' });
    setIsCreating(false);
    setActionStatus('');
    openingTaskRef.current = '';
    if (isLoggedIn) void loadTasks();
    else setTasks([]);
  }, [scopeKey, isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn || !initialTaskId || openingTaskRef.current === initialTaskId) return;
    openingTaskRef.current = initialTaskId;
    void openTask(initialTaskId);
  }, [initialTaskId, isLoggedIn, currentUser?.id]);

  useEffect(() => {
    if (!isLoggedIn || !initialDraft) return;
    const draftKey = JSON.stringify(initialDraft);
    if (draftRef.current === draftKey) return;
    draftRef.current = draftKey;
    setDetail(null);
    setForm({ ...emptyForm, ...initialDraft });
    setFormError('');
    setIsCreating(true);
    setActionStatus('已带入公开的比赛与任务信息；确认表单后才会创建个人任务。');
    onDraftConsumed?.();
  }, [initialDraft, isLoggedIn, currentUser?.id]);

  useEffect(() => {
    if (!detail?.messages?.length) return;
    window.requestAnimationFrame(() => {
      chatEndRef.current?.scrollIntoView({ block: 'end' });
    });
  }, [detail?.messages?.length, isSending]);

  async function loadTasks() {
    if (!isLoggedIn) return;
    setListStatus({ loading: true, error: '' });
    try {
      const query = new URLSearchParams({
        spaceType: scope.spaceType,
        status: 'all'
      });
      if (scope.teamCode) query.set('teamCode', scope.teamCode);
      const data = await api.getJson(`/api/prematch/tasks?${query.toString()}`);
      setTasks(Array.isArray(data.tasks) ? data.tasks : []);
    } catch (error) {
      setTasks([]);
      setListStatus({ loading: false, error: friendlyError(error) });
      return;
    }
    setListStatus({ loading: false, error: '' });
  }

  async function openTask(taskOrId) {
    const taskId = typeof taskOrId === 'string' ? taskOrId : taskOrId?.id;
    if (!taskId || !isLoggedIn) return;
    setDetailStatus({ loading: true, error: '' });
    setActionStatus('');
    setChatError('');
    setIsEditing(false);
    setIsAdjustingEvidenceScope(false);
    setEndedChallengeSessionId('');
    try {
      const data = await api.getJson(`/api/prematch/tasks/${encodeURIComponent(taskId)}`);
      applyDetail(data);
    } catch (error) {
      setDetail(null);
      const message = friendlyError(error);
      setDetailStatus({
        loading: false,
        error: /不存在|删除/.test(message)
          ? '这个备战任务已被删除或你已失去访问权限。'
          : message
      });
      return;
    }
    setDetailStatus({ loading: false, error: '' });
  }

  function applyDetail(data) {
    const nextDetail = {
      task: data.task,
      messages: Array.isArray(data.messages) ? data.messages : [],
      permissions: data.permissions || { canChat: data.task?.status === 'active', canManage: false }
    };
    setDetail(nextDetail);
    if (nextDetail.task) {
      setTasks((current) => upsertTask(current, nextDetail.task));
      setEditForm(taskToForm(nextDetail.task));
      setNoteDraft(nextDetail.task.strategyState?.note || '');
      setNoteStatus('');
      setEndedChallengeSessionId(
        window.sessionStorage?.getItem(challengeEndStorageKey(nextDetail.task.id)) || ''
      );
    }
  }

  function beginCreate() {
    if (!isLoggedIn) {
      onRequestLogin?.('登录后才能创建和跨设备保存赛前备战任务。');
      return;
    }
    if (!canCreateInScope) return;
    setForm(emptyForm);
    setFormError('');
    setIsCreating(true);
  }

  async function createTask(event) {
    event.preventDefault();
    if (isSaving) return;
    const validation = validateForm(form);
    if (validation) {
      setFormError(validation);
      return;
    }
    setIsSaving(true);
    setFormError('');
    try {
      const data = await api.postJson('/api/prematch/tasks', {
        ...normalizeFormForRequest(form),
        spaceType: scope.spaceType,
        teamCode: scope.teamCode
      });
      setIsCreating(false);
      applyDetail(data);
      setActionStatus('备战任务已创建。');
      await loadTasks();
    } catch (error) {
      setFormError(friendlyError(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function saveTaskEdits(event) {
    event.preventDefault();
    if (!detail?.task || isSaving) return;
    const validation = validateForm(editForm);
    if (validation) {
      setFormError(validation);
      return;
    }
    const strategyAffectingChange = (
      editForm.debateTopic.trim() !== detail.task.debateTopic
      || editForm.stance !== detail.task.stance
      || editForm.initialIdeas.trim() !== (detail.task.initialIdeas || '')
    );
    if (
      strategyAffectingChange
      && !window.confirm('任务内容、立场或已有想法的修改可能影响当前思路。保存后 Super 林婉会按新资料继续，是否保存？')
    ) return;

    setIsSaving(true);
    setFormError('');
    try {
      const data = await api.patchJson(
        `/api/prematch/tasks/${encodeURIComponent(detail.task.id)}`,
        {
          ...normalizeFormForRequest(editForm),
          expectedVersion: detail.task.version
        }
      );
      applyDetail(data);
      setIsEditing(false);
      setActionStatus(strategyAffectingChange
        ? '任务信息已更新。Super 林婉会按新资料继续讨论。'
        : '任务信息已更新。');
    } catch (error) {
      setFormError(friendlyError(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function submitChatRequest({
    text,
    intent = 'chat',
    preserveDraft = false,
    evidenceAction = '',
    challengeAction = '',
    challengeSessionId = ''
  }) {
    const cleanQuestion = text.trim();
    if (!cleanQuestion || !detail?.task || isSending) return;
    const clientRequestId = createUuid();
    const resolvedEvidenceAction = intent === 'evidence'
      ? evidenceAction || (isAdjustingEvidenceScope ? 'adjust' : 'plan')
      : '';
    setIsSending(true);
    setSendingIntent(challengeAction ? 'challenge' : intent);
    setSendingEvidenceAction(resolvedEvidenceAction);
    setChatError('');
    setActionStatus('');
    if (!preserveDraft) {
      setQuestion('');
      setQuestionIntent('chat');
    }
    try {
      const data = await api.postJson(
        `/api/prematch/tasks/${encodeURIComponent(detail.task.id)}/chat`,
        {
          question: cleanQuestion,
          clientRequestId,
          intent,
          ...(intent === 'evidence' ? { evidenceAction: resolvedEvidenceAction } : {}),
          ...(challengeAction ? { challengeAction, challengeSessionId } : {})
        }
      );
      setDetail((current) => {
        if (!current || current.task.id !== data.task?.id) return current;
        return {
          ...current,
          task: data.task || current.task,
          messages: mergeMessages(
            current.messages,
            [data.userMessage, data.assistantMessage].filter(Boolean)
          ),
        };
      });
      if (data.task) setTasks((current) => upsertTask(current, data.task));
      setIsAdjustingEvidenceScope(false);
    } catch (error) {
      if (!preserveDraft) {
        setQuestion(cleanQuestion);
        setQuestionIntent(intent);
      }
      setChatError(friendlyError(error));
    } finally {
      setIsSending(false);
      setSendingIntent('chat');
      setSendingEvidenceAction('');
    }
  }

  function sendMessage(event) {
    event?.preventDefault();
    if (challengeState.phase === 'awaiting_answer') {
      void submitChatRequest({
        text: question,
        intent: 'chat',
        challengeAction: 'answer',
        challengeSessionId: challengeState.sessionId
      });
      return;
    }
    void submitChatRequest({ text: question, intent: questionIntent });
  }

  function startChallenge() {
    if (isSending || !detail?.permissions?.canChat) return;
    window.sessionStorage?.removeItem(challengeEndStorageKey(detail.task.id));
    setEndedChallengeSessionId('');
    setQuestion('');
    setQuestionIntent('chat');
    void submitChatRequest({
      text: '请基于当前有效讨论开始一次即时检验。',
      intent: 'chat',
      preserveDraft: true,
      challengeAction: 'start',
      challengeSessionId: createUuid()
    });
  }

  function repeatChallenge() {
    if (isSending || challengeState.phase !== 'feedback' || challengeState.round >= 3) return;
    void submitChatRequest({
      text: '请基于当前有效讨论再检验一次。',
      intent: 'chat',
      preserveDraft: true,
      challengeAction: 'repeat',
      challengeSessionId: challengeState.sessionId
    });
  }

  function endChallenge() {
    if (!challengeState.sessionId) return;
    window.sessionStorage?.setItem(
      challengeEndStorageKey(detail.task.id),
      challengeState.sessionId
    );
    setEndedChallengeSessionId(challengeState.sessionId);
    setQuestion('');
    setQuestionIntent('chat');
    setActionStatus('即时检验已结束，可以继续正常讨论。');
  }

  function useQuickPrompt(prompt) {
    if (!prompt || isSending || !detail?.permissions?.canChat) return;
    if (prompt.intent === 'evidence') {
      void submitChatRequest({
        text: prompt.text,
        intent: 'evidence',
        preserveDraft: true,
        evidenceAction: 'plan'
      });
      return;
    }
    setQuestion((current) => current.trim()
      ? `${current.trim()}\n\n${prompt.text}`
      : prompt.text);
    setQuestionIntent(prompt.intent);
  }

  function createCurrentReport() {
    if (isSending || !detail?.permissions?.canChat) return;
    void submitChatRequest({
      text: reportPrompt,
      intent: 'report',
      preserveDraft: true
    });
  }

  function confirmEvidenceSearch() {
    if (isSending || !detail?.permissions?.canChat) return;
    void submitChatRequest({
      text: '按刚才确认的范围联网搜索论据。',
      intent: 'evidence',
      preserveDraft: true,
      evidenceAction: 'search'
    });
  }

  function adjustEvidenceScope() {
    if (isSending || !detail?.permissions?.canChat) return;
    setQuestion('我希望把检索范围调整为：');
    setQuestionIntent('evidence');
    setIsAdjustingEvidenceScope(true);
  }

  async function saveNote() {
    if (!detail?.task || isSavingNote) return;
    setIsSavingNote(true);
    setNoteStatus('');
    try {
      const data = await api.patchJson(
        `/api/prematch/tasks/${encodeURIComponent(detail.task.id)}/note`,
        { note: noteDraft, expectedVersion: detail.task.version }
      );
      setDetail((current) => current ? { ...current, task: data.task || current.task } : current);
      if (data.task) setTasks((current) => upsertTask(current, data.task));
      setNoteDraft(data.task?.strategyState?.note ?? noteDraft);
      setNoteStatus('笔记已保存。');
    } catch (error) {
      setNoteStatus(friendlyError(error));
    } finally {
      setIsSavingNote(false);
    }
  }

  async function revokeLatestMessage() {
    if (!detail?.task || isSending || isRevoking) return;
    if (!window.confirm('撤回最近一轮消息后，该消息和 Super 林婉的对应回复都会删除，且无法恢复。确认撤回？')) return;
    setIsRevoking(true);
    setChatError('');
    try {
      const data = await api.postJson(
        `/api/prematch/tasks/${encodeURIComponent(detail.task.id)}/revoke-latest`,
        { expectedVersion: detail.task.version }
      );
      applyDetail(data);
      setActionStatus('最近一轮消息及对应回复已撤回。');
    } catch (error) {
      setChatError(friendlyError(error));
    } finally {
      setIsRevoking(false);
    }
  }

  async function changeTaskStatus(nextStatus) {
    if (!detail?.task || isSaving) return;
    const action = nextStatus === 'archived' ? '归档' : '恢复';
    if (
      nextStatus === 'archived'
      && !window.confirm('归档后将停止继续对话，但任务资料和历史消息会保留。确认归档？')
    ) return;
    setIsSaving(true);
    setActionStatus('');
    try {
      const data = await api.postJson(
        `/api/prematch/tasks/${encodeURIComponent(detail.task.id)}/${nextStatus === 'archived' ? 'archive' : 'restore'}`,
        {}
      );
      const nextTask = data.task;
      setTasks((current) => upsertTask(current, nextTask));
      setDetail((current) => current ? {
        ...current,
        task: nextTask,
        permissions: { ...current.permissions, canChat: nextTask.status === 'active' }
      } : current);
      setActionStatus(`任务已${action}。`);
    } catch (error) {
      setActionStatus(friendlyError(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteTask() {
    if (!detail?.task || isSaving) return;
    if (!window.confirm('确认永久删除这个备战任务吗？任务资料、对话和任务内记忆都会删除。')) return;
    setIsSaving(true);
    try {
      await api.deleteJson(`/api/prematch/tasks/${encodeURIComponent(detail.task.id)}`);
      setTasks((current) => current.filter((task) => task.id !== detail.task.id));
      setDetail(null);
      setActionStatus('备战任务已删除。');
    } catch (error) {
      setActionStatus(friendlyError(error));
    } finally {
      setIsSaving(false);
    }
  }

  if (!isLoggedIn) {
    return (
      <section className="panel prematch-panel prematch-login-card">
        <div>
          <p className="eyebrow">赛前备战｜Super 林婉</p>
          <h2>与 Super 林婉一起准备一场具体比赛</h2>
          <p>任务和对话会按账号独立保存。登录后可以跨设备继续，也不会混入日常林婉聊天或其他任务。</p>
        </div>
        <button type="button" className="primary-button" onClick={() => onRequestLogin?.('登录后才能使用赛前备战。')}>
          登录后开始
        </button>
      </section>
    );
  }

  if (detailStatus.loading) {
    return <section className="panel prematch-panel"><div className="assistant-loading">正在恢复备战任务…</div></section>;
  }

  if (detail) {
    return (
      <PrematchTaskWorkspace
        detail={detail}
        question={question}
        isSending={isSending}
        sendingIntent={sendingIntent}
        sendingEvidenceAction={sendingEvidenceAction}
        isSaving={isSaving}
        isSavingNote={isSavingNote}
        isRevoking={isRevoking}
        isEditing={isEditing}
        editForm={editForm}
        formError={formError}
        chatError={chatError}
        actionStatus={actionStatus}
        noteDraft={noteDraft}
        noteStatus={noteStatus}
        challengeState={challengeState}
        chatEndRef={chatEndRef}
        onBack={() => {
          setDetail(null);
          setActionStatus('');
          setChatError('');
          void loadTasks();
        }}
        onQuestionChange={(value) => {
          setQuestion(value);
          if (!value.trim() && !isAdjustingEvidenceScope) setQuestionIntent('chat');
        }}
        onNoteChange={(value) => {
          setNoteDraft(value);
          setNoteStatus('');
        }}
        onSaveNote={saveNote}
        onRevokeLatest={revokeLatestMessage}
        onSend={sendMessage}
        onQuickPrompt={useQuickPrompt}
        onConfirmEvidenceSearch={confirmEvidenceSearch}
        onAdjustEvidenceScope={adjustEvidenceScope}
        onCreateReport={createCurrentReport}
        onStartChallenge={startChallenge}
        onRepeatChallenge={repeatChallenge}
        onEndChallenge={endChallenge}
        onEdit={() => {
          setEditForm(taskToForm(detail.task));
          setFormError('');
          setIsEditing(true);
        }}
        onEditCancel={() => {
          setIsEditing(false);
          setFormError('');
        }}
        onEditChange={setEditForm}
        onEditSave={saveTaskEdits}
        onArchive={() => changeTaskStatus('archived')}
        onRestore={() => changeTaskStatus('active')}
        onDelete={deleteTask}
      />
    );
  }

  return (
    <section className="prematch-hub">
      <section className="panel prematch-hero">
        <div>
          <p className="eyebrow">赛前备战｜Super 林婉</p>
          <h2>与 Super 林婉围绕一个任务持续讨论</h2>
          <p>每个任务都有一段独立、连续的对话。这里不会读取训练记录、能力画像、日常聊天或其他任务。</p>
          <div className="prematch-scope-badge">当前保存到：个人任务</div>
        </div>
        <button type="button" className="primary-button" disabled={!canCreateInScope} onClick={beginCreate}>
          创建备战任务
        </button>
      </section>

      {isCreating && (
        <section className="panel prematch-create-card">
          <div className="panel-header">
            <div>
              <p className="eyebrow">新任务</p>
              <h2>先告诉我当前要讨论什么</h2>
            </div>
            <button type="button" onClick={() => setIsCreating(false)}>取消</button>
          </div>
          <PrematchTaskForm
            form={form}
            error={formError}
            isSaving={isSaving}
            submitLabel="创建并进入任务空间"
            onChange={setForm}
            onSubmit={createTask}
          />
        </section>
      )}

      <section className="panel prematch-list-card">
        <div className="panel-header">
          <div>
            <p className="eyebrow">任务空间</p>
            <h2>{listFilter === 'active' ? '进行中的备战任务' : '已归档的备战任务'}</h2>
          </div>
          <div className="prematch-list-tabs">
            <button type="button" className={listFilter === 'active' ? 'active' : ''} onClick={() => setListFilter('active')}>
              进行中
            </button>
            <button type="button" className={listFilter === 'archived' ? 'active' : ''} onClick={() => setListFilter('archived')}>
              已归档
            </button>
          </div>
        </div>
        {actionStatus && <div className="history-status">{actionStatus}</div>}
        {detailStatus.error && <div className="error-box">{detailStatus.error}</div>}
        {listStatus.loading && <div className="assistant-loading">正在同步任务…</div>}
        {listStatus.error && (
          <div className="linwan-history-error">
            <span>{listStatus.error}</span>
            <button type="button" onClick={loadTasks}>重新加载</button>
          </div>
        )}
        {!listStatus.loading && !listStatus.error && visibleTasks.length === 0 && (
          <div className="history-empty">
            {listFilter === 'active' ? '还没有进行中的备战任务。' : '还没有已归档任务。'}
          </div>
        )}
        <div className="prematch-task-grid">
          {visibleTasks.map((task) => (
            <button type="button" className="prematch-task-card" key={task.id} onClick={() => openTask(task)}>
              <strong>{task.title}</strong>
              <p>{task.debateTopic}</p>
              <div>
                <span>立场：{getLabel(stanceOptions, task.stance)}</span>
              </div>
              <small>更新于 {formatDate(task.updatedAt)}</small>
            </button>
          ))}
        </div>
      </section>
    </section>
  );
}

function PrematchTaskWorkspace({
  detail,
  question,
  isSending,
  sendingIntent,
  sendingEvidenceAction,
  isSaving,
  isSavingNote,
  isRevoking,
  isEditing,
  editForm,
  formError,
  chatError,
  actionStatus,
  noteDraft,
  noteStatus,
  challengeState,
  chatEndRef,
  onBack,
  onQuestionChange,
  onNoteChange,
  onSaveNote,
  onRevokeLatest,
  onSend,
  onQuickPrompt,
  onConfirmEvidenceSearch,
  onAdjustEvidenceScope,
  onCreateReport,
  onStartChallenge,
  onRepeatChallenge,
  onEndChallenge,
  onEdit,
  onEditCancel,
  onEditChange,
  onEditSave,
  onArchive,
  onRestore,
  onDelete
}) {
  const { task, messages, permissions } = detail;
  const latestSearchMessage = [...messages].reverse().find((message) => (
    message.role === 'assistant' && message.contextManifest?.search
  ));
  const confirmableSearchMessageId = latestSearchMessage?.contextManifest?.search?.status === 'pending_confirmation'
    ? latestSearchMessage.id
    : '';
  const latestStoredUserMessage = [...messages].reverse().find((message) => (
    message.role === 'user' && message.clientRequestId
  ));
  const latestRevocableUserMessageId = (
    latestStoredUserMessage?.contextManifest?.challenge?.messageType === 'challenge_trigger'
      ? ''
      : latestStoredUserMessage?.id
  ) || '';
  const visibleMessages = messages.filter((message) => (
    message.contextManifest?.challenge?.messageType !== 'challenge_trigger'
  ));

  return (
    <section className="prematch-workspace">
      <section className="panel prematch-task-header">
        <button type="button" className="prematch-back-button" onClick={onBack}>← 返回任务列表</button>
        <div className="prematch-task-title-row">
          <div>
            <p className="eyebrow">Super 林婉任务空间</p>
            <h2>{task.title}</h2>
            <p className="prematch-topic">{task.debateTopic}</p>
          </div>
          <span className={`prematch-status ${task.status}`}>{task.status === 'archived' ? '已归档' : '进行中'}</span>
        </div>
        <div className="prematch-task-meta">
          <span>立场：{getLabel(stanceOptions, task.stance)}</span>
        </div>
        {permissions.canManage && (
          <div className="prematch-manage-actions">
            <button type="button" onClick={onEdit} disabled={isSaving}>修改任务</button>
            {task.status === 'active'
              ? <button type="button" onClick={onArchive} disabled={isSaving}>归档任务</button>
              : <button type="button" onClick={onRestore} disabled={isSaving}>恢复任务</button>}
            <button type="button" className="danger" onClick={onDelete} disabled={isSaving}>删除任务</button>
          </div>
        )}
        {actionStatus && <div className="history-status">{actionStatus}</div>}
      </section>

      {isEditing && (
        <section className="panel prematch-edit-card">
          <div className="panel-header">
            <div>
              <p className="eyebrow">任务信息</p>
              <h2>修改基础资料</h2>
            </div>
            <button type="button" onClick={onEditCancel}>取消</button>
          </div>
          <PrematchTaskForm
            form={editForm}
            error={formError}
            isSaving={isSaving}
            submitLabel="保存修改"
            onChange={onEditChange}
            onSubmit={onEditSave}
          />
        </section>
      )}

      <section className="panel prematch-note-card">
        <div className="panel-header">
          <div>
            <p className="eyebrow">当前任务笔记</p>
            <h2>记录你的备战想法</h2>
          </div>
          <span className="badge">仅当前任务</span>
        </div>
        <textarea
          value={noteDraft}
          onChange={(event) => onNoteChange(event.target.value)}
          rows={5}
          maxLength={10000}
          placeholder="写下当前辩题的想法、待办或临场提醒。"
          disabled={isSavingNote}
        />
        <div className="prematch-note-actions">
          <span>{noteStatus}</span>
          <button type="button" onClick={onSaveNote} disabled={isSavingNote}>
            {isSavingNote ? '保存中…' : '保存笔记'}
          </button>
        </div>
      </section>

      <div className="prematch-workspace-grid">
        <section className="panel prematch-chat-card">
          <div className="panel-header">
            <div>
              <p className="eyebrow">任务对话</p>
              <h2>和 Super 林婉共同推进</h2>
            </div>
            <span className="badge">仅当前任务</span>
          </div>
          <p className="prematch-boundary-note">这里仅使用当前任务资料、当前任务内记忆和当前任务消息，不读取训练记录、能力画像、日常聊天或其他任务。</p>
          <div className="prematch-chat-list">
            {visibleMessages.map((message) => {
              const challenge = message.contextManifest?.challenge;
              return (
              <article
                className={`prematch-message ${message.role} ${message.contextManifest?.intent === 'report' ? 'report' : ''} ${challenge?.messageType || ''}`}
                key={message.id}
              >
                <div>
                  <span>
                    {challengeMessageLabel(message)}
                  </span>
                  <time>{formatMessageTime(message.createdAt)}</time>
                  {message.id === latestRevocableUserMessageId && (
                    <button
                      type="button"
                      className="prematch-revoke-button"
                      disabled={isSending || isRevoking}
                      onClick={onRevokeLatest}
                    >
                      {isRevoking ? '撤回中…' : '撤回本轮'}
                    </button>
                  )}
                </div>
                {challenge?.messageType === 'challenge_feedback'
                  ? <ChallengeFeedbackCard challenge={challenge} />
                  : <p>{visiblePrematchMessageContent(message)}</p>}
                <MessageEvidenceSources
                  search={message.contextManifest?.search}
                  canConfirm={message.id === confirmableSearchMessageId}
                  isSending={isSending}
                  onConfirm={onConfirmEvidenceSearch}
                  onAdjust={onAdjustEvidenceScope}
                />
              </article>
              );
            })}
            {isSending && (
              <div className="assistant-loading">
                {sendingIntent === 'challenge'
                  ? challengeState.phase === 'awaiting_answer'
                    ? 'Super 林婉正在判断你的回应…'
                    : 'Super 林婉正在从对方角度寻找最关键的攻击点…'
                  : sendingIntent === 'evidence'
                  ? sendingEvidenceAction === 'search'
                    ? 'Super 林婉正在联网搜集并梳理论据…'
                    : 'Super 林婉正在梳理本轮检索范围…'
                  : 'Super 林婉正在整理当前思路…'}
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          {chatError && <div className="assistant-error">{chatError}</div>}
          <div className="prematch-chat-tools" aria-label="任务快捷提示">
            <div className="prematch-quick-prompts">
              {quickPrompts.map((prompt) => (
                <button
                  type="button"
                  key={prompt.intent}
                  disabled={isSending || !permissions.canChat || challengeState.active}
                  onClick={() => onQuickPrompt(prompt)}
                >
                  {prompt.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="prematch-report-button"
              disabled={isSending || !permissions.canChat || challengeState.active}
              onClick={onCreateReport}
            >
              形成当前思路报告
            </button>
            {!challengeState.active && (
              <button
                type="button"
                className="prematch-challenge-button"
                disabled={isSending || !permissions.canChat}
                onClick={onStartChallenge}
                title="让林婉从对方角度追问当前思路"
              >
                检验一下
              </button>
            )}
          </div>
          {challengeState.phase === 'feedback' && (
            <div className="prematch-challenge-actions">
              {challengeState.round < 3 && (
                <button type="button" onClick={onRepeatChallenge} disabled={isSending}>再检验一次</button>
              )}
              <button type="button" onClick={onEndChallenge} disabled={isSending}>结束检验</button>
            </div>
          )}
          {challengeState.phase === 'awaiting_answer' && (
            <div className="prematch-challenge-actions">
              <span>请直接在下方回答这个问题。</span>
              <button type="button" onClick={onEndChallenge} disabled={isSending}>结束检验</button>
            </div>
          )}
          <form className="prematch-chat-input" onSubmit={onSend}>
            <textarea
              value={question}
              onChange={(event) => onQuestionChange(event.target.value)}
              disabled={isSending || !permissions.canChat || challengeState.phase === 'feedback'}
              rows={4}
              placeholder={permissions.canChat
                ? challengeState.phase === 'awaiting_answer'
                  ? '现场回答对方的追问…'
                  : challengeState.phase === 'feedback'
                    ? '请选择“再检验一次”或“结束检验”。'
                    : '继续说你的判断、疑问或想修改的思路…'
                : '任务已归档，恢复后可以继续讨论。'}
            />
            <button type="submit" disabled={isSending || !permissions.canChat || challengeState.phase === 'feedback' || !question.trim()}>
              {isSending ? '整理中…' : challengeState.phase === 'awaiting_answer' ? '提交回答' : '发送'}
            </button>
          </form>
        </section>
      </div>
    </section>
  );
}

function PrematchTaskForm({ form, error, isSaving, submitLabel, onChange, onSubmit }) {
  function change(key, value) {
    onChange((current) => ({ ...current, [key]: value }));
  }

  return (
    <form className="prematch-task-form" onSubmit={onSubmit}>
      <label className="prematch-field prematch-field-wide">
        <span>当前任务 / 辩题 *</span>
        <textarea
          value={form.debateTopic}
          onChange={(event) => change('debateTopic', event.target.value)}
          rows={5}
          maxLength={500}
          placeholder="例如：辩题是人工智能会不会削弱人的创造力"
          required
        />
      </label>
      <label className="prematch-field">
        <span>我的立场（可选）</span>
        <select value={form.stance} onChange={(event) => change('stance', event.target.value)}>
          {stanceOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
        </select>
      </label>
      <label className="prematch-field prematch-field-wide">
        <span>当前已有想法或卡点（可选）</span>
        <textarea
          value={form.initialIdeas}
          onChange={(event) => change('initialIdeas', event.target.value)}
          rows={4}
          maxLength={2400}
          placeholder="写下已经想到的方向、困惑、担忧，或希望优先解决的问题。"
        />
      </label>
      {error && <div className="error-box prematch-field-wide">{error}</div>}
      <div className="prematch-form-actions prematch-field-wide">
        <button type="submit" className="primary-button" disabled={isSaving}>
          {isSaving ? '保存中…' : submitLabel}
        </button>
      </div>
    </form>
  );
}

function taskToForm(task) {
  return {
    debateTopic: task.debateTopic || '',
    stance: task.stance || 'undecided',
    initialIdeas: task.initialIdeas || ''
  };
}

function MessageEvidenceSources({ search, canConfirm, isSending, onConfirm, onAdjust }) {
  if (!search) return null;
  const sources = Array.isArray(search.sources)
    ? search.sources.filter((source) => safeHttpUrl(source?.sourceUrl || source?.url))
    : [];
  const statusText = {
    pending_confirmation: '请先确认本轮检索范围；确认前不会发起联网请求。',
    success: `本轮已联网检索，共找到 ${Number(search.totalResults || sources.length)} 个可查看来源。`,
    partial: '部分检索请求失败，以下为本轮成功取得的来源。',
    fallback: '本轮联网检索失败，以下内容仅为检索方向，不是已经核实的论据。',
    unavailable: '联网搜集暂时不可用，请稍后重试。'
  }[search.status];
  if (!statusText && !sources.length) return null;
  return (
    <section className={`prematch-evidence ${search.status || 'unavailable'}`} aria-label="本轮来源">
      {statusText && <p className="prematch-evidence-status">{statusText}</p>}
      {search.status === 'pending_confirmation' && (
        <div className="prematch-evidence-scope">
          {search.goal && <p><b>检索目标：</b>{search.goal}</p>}
          <ol>
            {(Array.isArray(search.queries) ? search.queries : []).map((item, index) => (
              <li key={`${item.zone}:${item.language}:${item.displayQuery || index}`}>
                {item.displayQuery || `当前辩题的补充检索方向${index + 1}`}
              </li>
            ))}
          </ol>
          {canConfirm && (
            <div className="prematch-evidence-actions">
              <button type="button" disabled={isSending} onClick={onConfirm}>按此范围搜索</button>
              <button type="button" disabled={isSending} onClick={onAdjust}>调整范围</button>
            </div>
          )}
        </div>
      )}
      {search.status !== 'pending_confirmation' && search.languageNotice && (
        <p className="prematch-evidence-language-notice">{search.languageNotice}</p>
      )}
      {sources.length > 0 && (
        <div className="prematch-evidence-list">
          {sources.map((source) => (
            <article className="prematch-evidence-source" key={`${source.id}:${source.sourceUrl || source.url}`}>
              <div className="prematch-evidence-heading">
                <b>{source.id}</b>
                <span>{source.sourceTitle || source.sourceName || source.domain}</span>
                <em>{evidenceSourceTypeLabel(source.sourceType)}</em>
              </div>
              <h3>{source.evidenceTitle || source.coreConclusion || source.title}</h3>
              <div className="prematch-evidence-summary">
                <b>核心摘要</b>
                <p>{evidenceDisplaySummary(source)}</p>
              </div>
              <p className="prematch-evidence-meta">
                <span>来源：{source.sourceTitle || source.sourceName || source.title || source.domain}</span>
                {source.publisher && <span>发布机构：{source.publisher}</span>}
                {source.publishedAt && <span>时间：{formatEvidenceDate(source.publishedAt)}</span>}
                <span>{source.sourceLanguageLabel || (source.sourceLanguage === 'zh-CN' ? '简体中文资料' : '外文资料（摘要已中文化）')}</span>
              </p>
              <div className="prematch-evidence-links">
                <a href={source.sourceUrl || source.url} target="_blank" rel="noopener noreferrer">查看原始来源</a>
              </div>
              {(source.sourceExcerpt || source.contentExcerpt || source.snippet) && (
                <details className="prematch-evidence-original">
                  <summary>展开原文与资料信息</summary>
                  <p>{source.sourceExcerpt || source.contentExcerpt || source.snippet}</p>
                  <a href={source.sourceUrl || source.url} target="_blank" rel="noopener noreferrer">打开原始网页或 PDF</a>
                </details>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function evidenceSourceTypeLabel(sourceType) {
  return ({
    academic: '论文 / 研究',
    official: '政策 / 官方资料',
    media: '新闻',
    organization: '报告 / 机构资料',
    other: '案例 / 其他'
  })[sourceType] || '其他资料';
}

function evidenceDisplaySummary(source) {
  if (source?.displaySummary) return source.displaySummary;
  const legacyChineseSummary = [source?.evidenceContent, source?.applicationAnalysis]
    .filter(Boolean)
    .join(' ');
  if (legacyChineseSummary) return legacyChineseSummary;
  if (source?.chineseExplanation) return source.chineseExplanation;
  return '该来源暂未生成中文辩论摘要，请通过原始资料入口核验后使用。';
}

function formatEvidenceDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function visiblePrematchMessageContent(message) {
  const searchStatus = message?.contextManifest?.search?.status;
  if (message?.role === 'assistant' && searchStatus === 'pending_confirmation') {
    return '已按你的需求整理本轮中文检索范围。请确认下方检索方向，确认后再开始联网搜索。';
  }
  if (message?.role === 'assistant' && ['fallback', 'unavailable'].includes(searchStatus)) {
    return '本轮联网检索未取得可核验来源，请稍后重试或调整中文检索范围。系统不会把未核实内容作为有效论据。';
  }
  return message?.content || '';
}

function challengeMessageLabel(message) {
  const type = message?.contextManifest?.challenge?.messageType;
  if (type === 'challenge_question') return '对方可能会这样追问';
  if (type === 'challenge_answer') return '我的现场回答';
  if (type === 'challenge_feedback') return 'Super 林婉 · 检验结果';
  if (message?.role === 'assistant') {
    return message.contextManifest?.intent === 'report' ? 'Super 林婉 · 当前思路报告' : 'Super 林婉';
  }
  return '我';
}

function ChallengeFeedbackCard({ challenge }) {
  return (
    <div className="prematch-challenge-feedback">
      <strong>{challenge.judgment || '反馈已生成'}</strong>
      <dl>
        <div><dt>有效之处</dt><dd>{challenge.effectivePoint}</dd></div>
        <div><dt>仍需补强</dt><dd>{challenge.remainingGap}</dd></div>
        <div><dt>提示</dt><dd>{challenge.hint}</dd></div>
      </dl>
    </div>
  );
}

function deriveChallengeState(messages, endedSessionId) {
  const source = Array.isArray(messages) ? messages : [];
  const latestStoredMessage = source.at(-1);
  if (latestStoredMessage && !latestStoredMessage.contextManifest?.challenge) {
    return { active: false, phase: 'inactive', sessionId: '', round: 0 };
  }
  const challengeMessages = source
    .filter((message) => message.contextManifest?.challenge?.sessionId);
  const latest = challengeMessages.at(-1);
  const challenge = latest?.contextManifest?.challenge;
  if (!challenge || challenge.sessionId === endedSessionId) {
    return { active: false, phase: 'inactive', sessionId: '', round: 0 };
  }
  if (challenge.messageType === 'challenge_question') {
    return {
      active: true,
      phase: 'awaiting_answer',
      sessionId: challenge.sessionId,
      round: challenge.round
    };
  }
  if (challenge.messageType === 'challenge_feedback') {
    return {
      active: true,
      phase: 'feedback',
      sessionId: challenge.sessionId,
      round: challenge.round
    };
  }
  return { active: false, phase: 'inactive', sessionId: '', round: 0 };
}

function safeHttpUrl(value) {
  try {
    return ['http:', 'https:'].includes(new URL(String(value || '')).protocol);
  } catch {
    return false;
  }
}

function normalizeFormForRequest(form) {
  return {
    debateTopic: form.debateTopic.trim(),
    stance: form.stance,
    debatePosition: 'undecided',
    initialIdeas: form.initialIdeas.trim()
  };
}

function validateForm(form) {
  if (form.debateTopic.trim().length < 2) return '请填写完整辩题。';
  if (!stanceOptions.some((option) => option.value === form.stance)) return '请选择有效立场。';
  return '';
}

function getLabel(options, value) {
  return options.find((option) => option.value === value)?.label || '暂未确定';
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '时间未提供';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function formatMessageTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function upsertTask(tasks, task) {
  if (!task?.id) return tasks;
  return [task, ...tasks.filter((item) => item.id !== task.id)]
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
}

function mergeMessages(current, incoming) {
  const byId = new Map();
  [...(current || []), ...(incoming || [])].forEach((message) => {
    if (!message?.id) return;
    byId.set(message.id, message);
  });
  return [...byId.values()].sort((left, right) => (
    new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
    || String(left.id).localeCompare(String(right.id))
  ));
}

function createUuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function challengeEndStorageKey(taskId) {
  return `super-linwan-ended-challenge:${String(taskId || '')}`;
}

function friendlyError(error) {
  const message = String(error?.message || '').trim();
  if (!message || message === 'Failed to fetch') return '请求失败，请检查网络后重试。';
  return message;
}
