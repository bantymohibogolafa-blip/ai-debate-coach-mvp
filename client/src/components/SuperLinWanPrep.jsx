import { useEffect, useMemo, useRef, useState } from 'react';

const stanceOptions = [
  { value: 'affirmative', label: '正方' },
  { value: 'negative', label: '反方' },
  { value: 'undecided', label: '暂未确定' }
];

const positionOptions = [
  { value: 'first', label: '一辩' },
  { value: 'second', label: '二辩' },
  { value: 'third', label: '三辩' },
  { value: 'fourth', label: '四辩' },
  { value: 'undecided', label: '暂未确定' },
  { value: 'other', label: '其他或特殊赛制' }
];

const stageLabels = {
  understanding: '理解任务',
  analysis: '初步判断',
  brainstorming: '共同修订',
  strategy: '阶段性战略',
  training: '训练验证',
  ready: '赛前确认'
};

const trainingModeLabels = {
  constructive: '立论训练',
  summary: '攻辩小结训练',
  free_debate: '自由辩论',
  attack: '攻辩训练',
  defense: '防守训练',
  closing: '结辩训练'
};

const difficultyLabels = {
  novice: '新手',
  campus: '校赛',
  city: '市赛'
};

const emptyForm = {
  title: '',
  debateTopic: '',
  stance: 'undecided',
  debatePosition: 'undecided',
  positionDetail: '',
  competitionName: '',
  competitionDate: '',
  competitionLevel: '',
  format: '',
  preparationDeadline: '',
  initialIdeas: '',
  opponentInfo: '',
  priorityQuestion: ''
};

export default function SuperLinWanPrep({
  api,
  isLoggedIn,
  currentUser,
  currentSpace,
  currentTeam,
  initialTaskId = '',
  onRequestLogin,
  onStartTraining
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
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState('');
  const [actionStatus, setActionStatus] = useState('');
  const chatEndRef = useRef(null);
  const openingTaskRef = useRef('');
  const scope = currentSpace?.type === 'team' && currentSpace?.teamCode
    ? { spaceType: 'team', teamCode: currentSpace.teamCode }
    : { spaceType: 'personal', teamCode: '' };
  const scopeKey = `${scope.spaceType}:${scope.teamCode}:${currentUser?.id || ''}`;
  const canCreateInScope = scope.spaceType === 'personal'
    || ['owner', 'captain', 'leader', 'admin'].includes(currentTeam?.role);

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
    try {
      const data = await api.getJson(`/api/prematch/tasks/${encodeURIComponent(taskId)}`);
      applyDetail(data);
    } catch (error) {
      setDetail(null);
      const message = friendlyError(error);
      setDetailStatus({
        loading: false,
        error: /不存在|删除/.test(message)
          ? '这个备战任务已被删除或你已失去访问权限。正式训练记录不会因此删除。'
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
      trainingLinks: Array.isArray(data.trainingLinks) ? data.trainingLinks : [],
      permissions: data.permissions || { canChat: data.task?.status === 'active', canManage: false }
    };
    setDetail(nextDetail);
    if (nextDetail.task) {
      setTasks((current) => upsertTask(current, nextDetail.task));
      setEditForm(taskToForm(nextDetail.task));
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
      || editForm.debatePosition !== detail.task.debatePosition
      || editForm.positionDetail.trim() !== (detail.task.positionDetail || '')
    );
    if (
      strategyAffectingChange
      && !window.confirm('辩题、立场或辩位的修改可能影响已有战略。保存后 Super 林婉会重新评估当前方案，是否继续？')
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
        ? '基础信息已更新。已有战略已标记为需要重新评估。'
        : '任务信息已更新。');
    } catch (error) {
      setFormError(friendlyError(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function sendMessage(event) {
    event?.preventDefault();
    const cleanQuestion = question.trim();
    if (!cleanQuestion || !detail?.task || isSending) return;
    const clientRequestId = createUuid();
    setIsSending(true);
    setChatError('');
    setActionStatus('');
    setQuestion('');
    try {
      const data = await api.postJson(
        `/api/prematch/tasks/${encodeURIComponent(detail.task.id)}/chat`,
        { question: cleanQuestion, clientRequestId }
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
          trainingLinks: Array.isArray(data.trainingLinks)
            ? data.trainingLinks
            : current.trainingLinks
        };
      });
      if (data.task) setTasks((current) => upsertTask(current, data.task));
    } catch (error) {
      setQuestion(cleanQuestion);
      setChatError(friendlyError(error));
    } finally {
      setIsSending(false);
    }
  }

  async function changeTaskStatus(nextStatus) {
    if (!detail?.task || isSaving) return;
    const action = nextStatus === 'archived' ? '归档' : '恢复';
    if (
      nextStatus === 'archived'
      && !window.confirm('归档后将停止继续对话，但任务和训练关联会保留。确认归档？')
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
    if (!window.confirm('确认永久删除这个备战任务吗？任务对话和战略会删除，但已经完成的正式训练记录仍会保留。')) return;
    setIsSaving(true);
    try {
      await api.deleteJson(`/api/prematch/tasks/${encodeURIComponent(detail.task.id)}`);
      setTasks((current) => current.filter((task) => task.id !== detail.task.id));
      setDetail(null);
      setActionStatus('备战任务已删除；正式训练记录仍然保留。');
    } catch (error) {
      setActionStatus(friendlyError(error));
    } finally {
      setIsSaving(false);
    }
  }

  function startRecommendedTraining(recommendation) {
    if (!detail?.task || !recommendation) return;
    if (detail.task.stance === 'undecided') {
      setActionStatus('当前立场尚未确定。请先修改任务立场，再进入正式训练。');
      return;
    }
    onStartTraining?.(
      detail.task,
      recommendation,
      buildStrategySummary(detail.task.strategyState)
    );
  }

  if (!isLoggedIn) {
    return (
      <section className="panel prematch-panel prematch-login-card">
        <div>
          <p className="eyebrow">赛前备战</p>
          <h2>与 Super 林婉一起准备一场具体比赛</h2>
          <p>任务、战略和对话会按账号独立保存。登录后可以跨设备继续，也不会混入日常林婉聊天。</p>
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
        currentUser={currentUser}
        question={question}
        isSending={isSending}
        isSaving={isSaving}
        isEditing={isEditing}
        editForm={editForm}
        formError={formError}
        chatError={chatError}
        actionStatus={actionStatus}
        chatEndRef={chatEndRef}
        onBack={() => {
          setDetail(null);
          setActionStatus('');
          setChatError('');
          void loadTasks();
        }}
        onQuestionChange={setQuestion}
        onSend={sendMessage}
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
        onStartTraining={startRecommendedTraining}
      />
    );
  }

  return (
    <section className="prematch-hub">
      <section className="panel prematch-hero">
        <div>
          <p className="eyebrow">赛前备战</p>
          <h2>与 Super 林婉讨论辩题、制定战略，并安排下一步训练</h2>
          <p>每场比赛都是独立任务。这里共享你的林婉设置和真实能力画像，但不会读取日常聊天，也不会替代六大训练或复盘助手。</p>
          <div className="prematch-scope-badge">
            当前保存到：{scope.spaceType === 'team' ? `团队「${currentTeam?.teamName || scope.teamCode}」` : '个人任务'}
          </div>
        </div>
        <button type="button" className="primary-button" disabled={!canCreateInScope} onClick={beginCreate}>
          创建备战任务
        </button>
        {!canCreateInScope && <small>团队任务仅可由队长或管理员创建；你仍可参与已有团队任务。</small>}
      </section>

      {isCreating && (
        <section className="panel prematch-create-card">
          <div className="panel-header">
            <div>
              <p className="eyebrow">新任务</p>
              <h2>先告诉我这场比赛的基本信息</h2>
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
              <span className="prematch-task-card-stage">{stageLabels[task.currentStage] || '理解任务'}</span>
              <strong>{task.title}</strong>
              <p>{task.debateTopic}</p>
              <div>
                <span>{getLabel(stanceOptions, task.stance)}</span>
                <span>{getPositionLabel(task)}</span>
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
  currentUser,
  question,
  isSending,
  isSaving,
  isEditing,
  editForm,
  formError,
  chatError,
  actionStatus,
  chatEndRef,
  onBack,
  onQuestionChange,
  onSend,
  onEdit,
  onEditCancel,
  onEditChange,
  onEditSave,
  onArchive,
  onRestore,
  onDelete,
  onStartTraining
}) {
  const { task, messages, trainingLinks, permissions } = detail;
  const strategy = task.strategyState || {};
  const recommendations = Array.isArray(strategy.recommendedTrainings)
    ? strategy.recommendedTrainings
    : [];

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
          <span>辩位：{getPositionLabel(task)}</span>
          <span>阶段：{stageLabels[task.currentStage] || '理解任务'}</span>
          <span>创建：{formatDate(task.createdAt)}</span>
          {task.competitionDate && <span>比赛：{formatDate(task.competitionDate)}</span>}
        </div>
        {strategy.needsReassessment && (
          <div className="prematch-reassessment">
            基础信息发生变化：{strategy.reassessmentReason || 'Super 林婉需要重新评估当前方案。'}
          </div>
        )}
        {permissions.canManage && (
          <div className="prematch-manage-actions">
            <button type="button" onClick={onEdit} disabled={isSaving}>修改信息</button>
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

      <div className="prematch-workspace-grid">
        <section className="panel prematch-chat-card">
          <div className="panel-header">
            <div>
              <p className="eyebrow">任务对话</p>
              <h2>和 Super 林婉共同推进</h2>
            </div>
            <span className="badge">仅当前任务</span>
          </div>
          <p className="prematch-boundary-note">这里不会读取日常林婉聊天；其他备战任务也不会进入本轮上下文。</p>
          <div className="prematch-chat-list">
            {messages.map((message) => (
              <article className={`prematch-message ${message.role}`} key={message.id}>
                <div>
                  <span>{message.role === 'assistant' ? 'Super 林婉' : message.userId === currentUser?.id ? '我' : '队友'}</span>
                  <time>{formatMessageTime(message.createdAt)}</time>
                </div>
                <p>{message.content}</p>
                {message.role === 'assistant' && message.contextManifest?.trainingProfile?.used && (
                  <small>
                    本轮参考：当前任务 · {message.contextManifest.trainingProfile.scoredRecords} 条有效训练记录
                  </small>
                )}
              </article>
            ))}
            {isSending && <div className="assistant-loading">Super 林婉正在整理当前战场…</div>}
            <div ref={chatEndRef} />
          </div>
          {chatError && <div className="assistant-error">{chatError}</div>}
          <form className="prematch-chat-input" onSubmit={onSend}>
            <textarea
              value={question}
              onChange={(event) => onQuestionChange(event.target.value)}
              disabled={isSending || !permissions.canChat}
              rows={4}
              placeholder={permissions.canChat
                ? '把你的论点、队友方案、对手特点或训练后的新发现告诉林婉…'
                : '任务已归档，恢复后可以继续讨论。'}
            />
            <button type="submit" disabled={isSending || !permissions.canChat || !question.trim()}>
              {isSending ? '整理中…' : '发送'}
            </button>
          </form>
        </section>

        <aside className="prematch-side-column">
          <section className="panel prematch-strategy-card">
            <div className="panel-header">
              <div>
                <p className="eyebrow">当前战略</p>
                <h2>阶段性方案</h2>
              </div>
              <span className="badge">{stageLabels[task.currentStage] || '理解任务'}</span>
            </div>
            <StrategySection title="核心战场" text={strategy.coreBattlefield} />
            <StrategySection title="定义与判准" text={strategy.criterion} />
            <StrategyList title="已确认主论点" items={strategy.confirmedArguments} />
            <StrategyList title="备选论点" items={strategy.alternativeArguments} />
            <StrategyList title="对方可能路线" items={strategy.opponentRoutes} />
            <StrategyList title="本方主要风险" items={strategy.risks} />
            <StrategyList title="我的辩位任务" items={strategy.positionTasks} />
            <StrategyList title="待解决问题" items={strategy.unresolvedQuestions} />
            <details className="prematch-decision-details">
              <summary>查看已确认与已否定决定</summary>
              <StrategyList title="已确认" items={strategy.confirmedPoints} />
              <StrategyList title="已否定" items={strategy.rejectedPoints} />
            </details>
          </section>

          <section className="panel prematch-training-card">
            <div className="panel-header">
              <div>
                <p className="eyebrow">推荐训练</p>
                <h2>下一步去哪里练</h2>
              </div>
            </div>
            {recommendations.length === 0 ? (
              <p className="prematch-empty-copy">继续和林婉确认战场。形成可验证的问题后，这里会出现正式训练建议。</p>
            ) : recommendations.map((recommendation, index) => (
              <article className="prematch-recommendation" key={`${recommendation.mode}-${index}`}>
                <div>
                  <strong>{trainingModeLabels[recommendation.mode] || recommendation.mode}</strong>
                  <span>{difficultyLabels[recommendation.difficulty] || '新手'}</span>
                </div>
                {recommendation.reason && <p>{recommendation.reason}</p>}
                {recommendation.goal && <p><b>本次目标：</b>{recommendation.goal}</p>}
                {recommendation.verificationQuestion && <p><b>重点验证：</b>{recommendation.verificationQuestion}</p>}
                <button
                  type="button"
                  disabled={task.status !== 'active' || task.stance === 'undecided'}
                  onClick={() => onStartTraining(recommendation)}
                >
                  进入{trainingModeLabels[recommendation.mode] || '训练区'}
                </button>
              </article>
            ))}
            {task.stance === 'undecided' && <small>确定本场立场后才能携带参数进入正式训练。</small>}
          </section>

          <section className="panel prematch-training-results">
            <div className="panel-header">
              <div>
                <p className="eyebrow">训练回流</p>
                <h2>已关联结果</h2>
              </div>
            </div>
            {trainingLinks.length === 0 ? (
              <p className="prematch-empty-copy">还没有从本任务完成的正式训练。</p>
            ) : trainingLinks.slice().reverse().map((link) => (
              <article key={link.id}>
                <div>
                  <strong>{trainingModeLabels[link.trainingMode] || link.trainingMode}</strong>
                  <span>{link.resultSummary?.score === null || link.resultSummary?.score === undefined
                    ? '已完成'
                    : `${link.resultSummary.score} 分`}</span>
                </div>
                <p>{link.resultSummary?.mainWeakness || link.trainingGoal || '结构化训练摘要已回流。'}</p>
                <small>{formatDate(link.resultSummary?.completedAt || link.createdAt)}</small>
              </article>
            ))}
          </section>
        </aside>
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
        <span>辩题 *</span>
        <textarea
          value={form.debateTopic}
          onChange={(event) => change('debateTopic', event.target.value)}
          rows={2}
          maxLength={500}
          placeholder="例如：人工智能的发展让人更自由 / 更不自由"
          required
        />
      </label>
      <label className="prematch-field">
        <span>我的立场 *</span>
        <select value={form.stance} onChange={(event) => change('stance', event.target.value)}>
          {stanceOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
        </select>
      </label>
      <label className="prematch-field">
        <span>我的辩位 *</span>
        <select value={form.debatePosition} onChange={(event) => change('debatePosition', event.target.value)}>
          {positionOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
        </select>
      </label>
      {form.debatePosition === 'other' && (
        <label className="prematch-field prematch-field-wide">
          <span>特殊辩位或赛制职责</span>
          <input
            value={form.positionDetail}
            onChange={(event) => change('positionDetail', event.target.value)}
            maxLength={160}
            placeholder="例如：三人制主攻手、自由人"
          />
        </label>
      )}
      <label className="prematch-field prematch-field-wide">
        <span>任务名称</span>
        <input
          value={form.title}
          onChange={(event) => change('title', event.target.value)}
          maxLength={80}
          placeholder="可不填，将使用辩题作为任务名"
        />
      </label>
      <details className="prematch-optional-fields prematch-field-wide">
        <summary>补充比赛信息（可选）</summary>
        <div className="prematch-optional-grid">
          <label className="prematch-field">
            <span>比赛名称</span>
            <input value={form.competitionName} onChange={(event) => change('competitionName', event.target.value)} maxLength={160} />
          </label>
          <label className="prematch-field">
            <span>比赛时间</span>
            <input type="datetime-local" value={form.competitionDate} onChange={(event) => change('competitionDate', event.target.value)} />
          </label>
          <label className="prematch-field">
            <span>比赛级别</span>
            <input value={form.competitionLevel} onChange={(event) => change('competitionLevel', event.target.value)} maxLength={80} placeholder="校赛 / 市赛 / 邀请赛" />
          </label>
          <label className="prematch-field">
            <span>准备截止</span>
            <input type="datetime-local" value={form.preparationDeadline} onChange={(event) => change('preparationDeadline', event.target.value)} />
          </label>
          <label className="prematch-field prematch-field-wide">
            <span>赛制</span>
            <input value={form.format} onChange={(event) => change('format', event.target.value)} maxLength={240} placeholder="例如：四人制，新加坡赛制" />
          </label>
          <label className="prematch-field prematch-field-wide">
            <span>队伍当前已有思路</span>
            <textarea value={form.initialIdeas} onChange={(event) => change('initialIdeas', event.target.value)} rows={3} maxLength={2400} />
          </label>
          <label className="prematch-field prematch-field-wide">
            <span>已知对手信息</span>
            <textarea value={form.opponentInfo} onChange={(event) => change('opponentInfo', event.target.value)} rows={2} maxLength={1600} />
          </label>
          <label className="prematch-field prematch-field-wide">
            <span>希望优先解决的问题</span>
            <textarea value={form.priorityQuestion} onChange={(event) => change('priorityQuestion', event.target.value)} rows={2} maxLength={1000} />
          </label>
        </div>
      </details>
      {error && <div className="error-box prematch-field-wide">{error}</div>}
      <div className="prematch-form-actions prematch-field-wide">
        <button type="submit" className="primary-button" disabled={isSaving}>
          {isSaving ? '保存中…' : submitLabel}
        </button>
      </div>
    </form>
  );
}

function StrategySection({ title, text }) {
  return (
    <div className="prematch-strategy-section">
      <h3>{title}</h3>
      <p>{text || '尚未形成'}</p>
    </div>
  );
}

function StrategyList({ title, items }) {
  const list = Array.isArray(items) ? items : [];
  return (
    <div className="prematch-strategy-section">
      <h3>{title}</h3>
      {list.length ? (
        <ul>{list.map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}</ul>
      ) : <p>暂无</p>}
    </div>
  );
}

function taskToForm(task) {
  return {
    title: task.title || '',
    debateTopic: task.debateTopic || '',
    stance: task.stance || 'undecided',
    debatePosition: task.debatePosition || 'undecided',
    positionDetail: task.positionDetail || '',
    competitionName: task.competitionName || '',
    competitionDate: toDateTimeLocal(task.competitionDate),
    competitionLevel: task.competitionLevel || '',
    format: task.format || '',
    preparationDeadline: toDateTimeLocal(task.preparationDeadline),
    initialIdeas: task.initialIdeas || '',
    opponentInfo: task.opponentInfo || '',
    priorityQuestion: task.priorityQuestion || ''
  };
}

function normalizeFormForRequest(form) {
  return {
    ...form,
    title: form.title.trim(),
    debateTopic: form.debateTopic.trim(),
    positionDetail: form.positionDetail.trim(),
    competitionName: form.competitionName.trim(),
    competitionDate: form.competitionDate ? new Date(form.competitionDate).toISOString() : '',
    competitionLevel: form.competitionLevel.trim(),
    format: form.format.trim(),
    preparationDeadline: form.preparationDeadline ? new Date(form.preparationDeadline).toISOString() : '',
    initialIdeas: form.initialIdeas.trim(),
    opponentInfo: form.opponentInfo.trim(),
    priorityQuestion: form.priorityQuestion.trim()
  };
}

function validateForm(form) {
  if (form.debateTopic.trim().length < 2) return '请填写完整辩题。';
  if (!stanceOptions.some((option) => option.value === form.stance)) return '请选择有效立场。';
  if (!positionOptions.some((option) => option.value === form.debatePosition)) return '请选择有效辩位。';
  if (form.debatePosition === 'other' && !form.positionDetail.trim()) return '请说明特殊辩位或赛制职责。';
  return '';
}

function buildStrategySummary(strategy = {}) {
  const lines = [
    strategy.coreBattlefield ? `核心战场：${strategy.coreBattlefield}` : '',
    strategy.criterion ? `定义与判准：${strategy.criterion}` : '',
    Array.isArray(strategy.confirmedArguments) && strategy.confirmedArguments.length
      ? `已确认论点：${strategy.confirmedArguments.join('；')}`
      : '',
    Array.isArray(strategy.risks) && strategy.risks.length
      ? `主要风险：${strategy.risks.join('；')}`
      : '',
    Array.isArray(strategy.positionTasks) && strategy.positionTasks.length
      ? `辩位任务：${strategy.positionTasks.join('；')}`
      : ''
  ].filter(Boolean);
  return lines.join('\n').slice(0, 1600);
}

function getPositionLabel(task) {
  const base = getLabel(positionOptions, task.debatePosition);
  return task.debatePosition === 'other' && task.positionDetail ? `${base} · ${task.positionDetail}` : base;
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

function toDateTimeLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
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

function friendlyError(error) {
  const message = String(error?.message || '').trim();
  if (!message || message === 'Failed to fetch') return '请求失败，请检查网络后重试。';
  return message;
}
