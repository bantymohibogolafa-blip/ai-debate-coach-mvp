import { useEffect, useMemo, useState } from 'react';

const emptyMatchForm = {
  competitionName: '',
  debateTopic: '',
  stance: 'undecided',
  competitionTime: '',
  formatInfo: '',
  announcement: ''
};

const emptyTaskForm = {
  title: '',
  description: '',
  taskSource: 'manual',
  mode: 'free_debate',
  difficulty: 'novice',
  deadline: '',
  assignedUserIds: []
};

const modeLabels = {
  constructive: '立论训练',
  summary: '攻辩小结',
  free_debate: '自由辩论',
  attack: '攻辩训练',
  defense: '防守训练',
  closing: '结辩训练'
};

export default function TeamPreparationBoard({
  api,
  currentTeam,
  currentUser,
  onStartTraining,
  onBringToPersonalLinWan
}) {
  const [board, setBoard] = useState({ match: null, tasks: [], members: [], permissions: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [matchForm, setMatchForm] = useState(emptyMatchForm);
  const [showMatchForm, setShowMatchForm] = useState(false);
  const [taskForm, setTaskForm] = useState(emptyTaskForm);
  const [editingTaskId, setEditingTaskId] = useState('');
  const [showTaskForm, setShowTaskForm] = useState(false);
  const teamCode = currentTeam?.teamCode || '';
  const canManage = Boolean(board.permissions?.canManage);

  useEffect(() => {
    setShowMatchForm(false);
    setShowTaskForm(false);
    setEditingTaskId('');
    void loadBoard();
  }, [teamCode, currentUser?.id]);

  const groupedTasks = useMemo(() => {
    const tasks = Array.isArray(board.tasks) ? board.tasks : [];
    const incomplete = tasks
      .filter((task) => !task.isCompleted)
      .sort((left, right) => Number(right.isMine) - Number(left.isMine));
    return {
      incomplete,
      completed: tasks.filter((task) => task.isCompleted)
    };
  }, [board.tasks]);

  async function loadBoard() {
    if (!teamCode) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.getJson(`/api/team/preparation?teamCode=${encodeURIComponent(teamCode)}`);
      setBoard({
        match: data.match || null,
        tasks: Array.isArray(data.tasks) ? data.tasks : [],
        members: Array.isArray(data.members) ? data.members : [],
        permissions: data.permissions || {}
      });
    } catch (requestError) {
      setError(friendlyError(requestError));
    } finally {
      setLoading(false);
    }
  }

  function openMatchForm() {
    const match = board.match;
    setMatchForm(match ? {
      competitionName: match.competitionName || '',
      debateTopic: match.debateTopic || '',
      stance: match.stance || 'undecided',
      competitionTime: toLocalInput(match.competitionTime),
      formatInfo: match.formatInfo || '',
      announcement: match.announcement || ''
    } : emptyMatchForm);
    setShowMatchForm(true);
    setError('');
  }

  async function saveMatch(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const body = {
        ...matchForm,
        competitionTime: matchForm.competitionTime || null,
        teamCode
      };
      if (board.match) {
        await api.patchJson(`/api/team/preparation/matches/${encodeURIComponent(board.match.id)}`, body);
        setStatus('比赛与备战公告已更新。');
      } else {
        await api.postJson('/api/team/preparation/matches', body);
        setStatus('当前比赛已创建。');
      }
      setShowMatchForm(false);
      await loadBoard();
    } catch (requestError) {
      setError(friendlyError(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function archiveMatch() {
    if (!board.match || busy || !window.confirm('归档后，当前看板将不再显示这场比赛。确定结束当前比赛吗？')) return;
    setBusy(true);
    setError('');
    try {
      await api.postJson(
        `/api/team/preparation/matches/${encodeURIComponent(board.match.id)}/archive`,
        { teamCode }
      );
      setStatus('当前比赛已归档，可以创建下一场比赛。');
      setShowMatchForm(false);
      setShowTaskForm(false);
      await loadBoard();
    } catch (requestError) {
      setError(friendlyError(requestError));
    } finally {
      setBusy(false);
    }
  }

  function openTaskForm(task = null) {
    setEditingTaskId(task?.id || '');
    setTaskForm(task ? {
      title: task.title || '',
      description: task.description || '',
      taskSource: task.taskSource || 'manual',
      mode: task.mode || 'free_debate',
      difficulty: task.difficulty || 'novice',
      deadline: toLocalInput(task.deadline),
      assignedUserIds: (task.assignments || []).map((item) => item.appUserId)
    } : emptyTaskForm);
    setShowTaskForm(true);
    setError('');
  }

  async function saveTask(event) {
    event.preventDefault();
    if (!board.match || busy) return;
    setBusy(true);
    setError('');
    const body = {
      ...taskForm,
      deadline: taskForm.deadline || null,
      teamCode,
      matchId: board.match.id
    };
    try {
      if (editingTaskId) {
        await api.patchJson(`/api/team/preparation/tasks/${encodeURIComponent(editingTaskId)}`, body);
        setStatus('任务已更新。');
      } else {
        await api.postJson('/api/team/preparation/tasks', body);
        setStatus('任务已创建。');
      }
      setShowTaskForm(false);
      setEditingTaskId('');
      await loadBoard();
    } catch (requestError) {
      setError(friendlyError(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function deleteTask(task) {
    if (!board.match || busy || !window.confirm(`确定删除任务“${task.title}”吗？`)) return;
    setBusy(true);
    setError('');
    try {
      const query = new URLSearchParams({ teamCode, matchId: board.match.id });
      await api.deleteJson(`/api/team/preparation/tasks/${encodeURIComponent(task.id)}?${query.toString()}`);
      setStatus('任务已删除。');
      await loadBoard();
    } catch (requestError) {
      setError(friendlyError(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function toggleAssignment(task, assignment) {
    if (!board.match || busy) return;
    const completed = assignment.status !== 'completed';
    let completionNote = '';
    if (completed && assignment.appUserId === currentUser?.id) {
      completionNote = window.prompt('可选：填写简短完成说明（可直接留空）', assignment.completionNote || '') || '';
    }
    setBusy(true);
    setError('');
    try {
      await api.patchJson(
        `/api/team/preparation/tasks/${encodeURIComponent(task.id)}/assignments/${encodeURIComponent(assignment.appUserId)}`,
        { teamCode, matchId: board.match.id, completed, completionNote }
      );
      setStatus(completed ? '完成状态已记录。' : '已恢复为未完成。');
      await loadBoard();
    } catch (requestError) {
      setError(friendlyError(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function setWholeTask(task, completed) {
    if (!board.match || busy) return;
    setBusy(true);
    setError('');
    try {
      await api.postJson(
        `/api/team/preparation/tasks/${encodeURIComponent(task.id)}/completion`,
        { teamCode, matchId: board.match.id, completed }
      );
      setStatus(completed ? '所有负责人已同步标记完成。' : '所有负责人已同步恢复为未完成。');
      await loadBoard();
    } catch (requestError) {
      setError(friendlyError(requestError));
    } finally {
      setBusy(false);
    }
  }

  function bringToPersonalLinWan(task) {
    if (!board.match) return;
    onBringToPersonalLinWan?.({
      competitionName: board.match.competitionName,
      debateTopic: board.match.debateTopic,
      stance: board.match.stance,
      format: board.match.formatInfo,
      title: task.title,
      initialIdeas: [
        `团队任务：${task.title}`,
        task.description ? `任务说明：${task.description}` : '',
        board.match.announcement ? `公开备战公告：${board.match.announcement}` : ''
      ].filter(Boolean).join('\n')
    });
  }

  if (loading) {
    return <section className="panel team-prep-board"><div className="assistant-loading">正在加载团队备战看板…</div></section>;
  }

  return (
    <section className="team-prep-board">
      <section className="panel team-prep-hero">
        <div>
          <p className="eyebrow">团队备战看板</p>
          <h2>{currentTeam?.teamName || teamCode}</h2>
          <p>这里不调用 AI，只聚合当前比赛、公开公告和现有团队任务。</p>
        </div>
        {board.match && canManage && (
          <div className="team-prep-actions">
            <button type="button" onClick={openMatchForm}>编辑比赛与公告</button>
            <button type="button" className="danger" onClick={archiveMatch}>结束并归档</button>
          </div>
        )}
      </section>

      {error && <div className="error-box">{error}</div>}
      {status && <div className="history-status">{status}</div>}

      {!board.match ? (
        <section className="panel team-prep-empty">
          <p>
            {canManage
              ? '当前还没有正在进行的比赛，创建一场新的团队备战。'
              : '当前团队还没有设置正在进行的比赛。'}
          </p>
          {canManage && <button type="button" className="primary-button" onClick={openMatchForm}>创建当前比赛</button>}
        </section>
      ) : (
        <>
          <section className="panel team-match-card">
            <div className="panel-header">
              <div>
                <p className="eyebrow">当前比赛</p>
                <h2>{board.match.competitionName}</h2>
              </div>
              <span className="prematch-status active">当前备战</span>
            </div>
            <p className="team-match-topic">{board.match.debateTopic}</p>
            <div className="team-match-meta">
              <span>团队立场：{stanceLabel(board.match.stance)}</span>
              <span>比赛时间：{formatDate(board.match.competitionTime)}</span>
              {board.match.formatInfo && <span>赛制 / 补充：{board.match.formatInfo}</span>}
            </div>
          </section>

          <section className="panel team-announcement">
            <div className="panel-header">
              <div>
                <p className="eyebrow">公开信息</p>
                <h2>备战公告</h2>
              </div>
              {canManage && <button type="button" onClick={openMatchForm}>编辑公告</button>}
            </div>
            <p>{board.match.announcement || '暂无备战公告。'}</p>
          </section>

          {canManage && (
            <section className="panel team-prep-task-toolbar">
              <div>
                <h2>当前比赛任务</h2>
                <p>任务沿用现有团队任务与负责人关系，不另建任务系统。</p>
              </div>
              <button type="button" className="primary-button" onClick={() => openTaskForm()}>创建任务</button>
            </section>
          )}

          <TaskSection
            title="未完成任务"
            tasks={groupedTasks.incomplete}
            emptyText="当前没有未完成任务。"
            canManage={canManage}
            currentUserId={currentUser?.id}
            busy={busy}
            onToggle={toggleAssignment}
            onCompleteAll={(task) => setWholeTask(task, true)}
            onEdit={openTaskForm}
            onDelete={deleteTask}
            onStartTraining={onStartTraining}
            onBringToPersonalLinWan={bringToPersonalLinWan}
          />
          <TaskSection
            title="已完成任务"
            tasks={groupedTasks.completed}
            emptyText="当前还没有已完成任务。"
            canManage={canManage}
            currentUserId={currentUser?.id}
            busy={busy}
            onToggle={toggleAssignment}
            onRestoreAll={(task) => setWholeTask(task, false)}
            onEdit={openTaskForm}
            onDelete={deleteTask}
            onStartTraining={onStartTraining}
            onBringToPersonalLinWan={bringToPersonalLinWan}
          />
        </>
      )}

      {showMatchForm && (
        <div className="modal-backdrop" role="presentation">
          <form className="modal-panel team-prep-form" onSubmit={saveMatch}>
            <div className="panel-header">
              <h2>{board.match ? '编辑当前比赛' : '创建当前比赛'}</h2>
              <button type="button" onClick={() => setShowMatchForm(false)}>取消</button>
            </div>
            <label>比赛名称<input required maxLength="160" value={matchForm.competitionName} onChange={(event) => setMatchForm({ ...matchForm, competitionName: event.target.value })} /></label>
            <label>辩题<textarea required value={matchForm.debateTopic} onChange={(event) => setMatchForm({ ...matchForm, debateTopic: event.target.value })} /></label>
            <label>团队立场<select value={matchForm.stance} onChange={(event) => setMatchForm({ ...matchForm, stance: event.target.value })}><option value="undecided">暂未确定</option><option value="affirmative">正方</option><option value="negative">反方</option></select></label>
            <label>比赛时间（可选）<input type="datetime-local" value={matchForm.competitionTime} onChange={(event) => setMatchForm({ ...matchForm, competitionTime: event.target.value })} /></label>
            <label>赛制或补充信息（可选）<textarea value={matchForm.formatInfo} onChange={(event) => setMatchForm({ ...matchForm, formatInfo: event.target.value })} /></label>
            <label>团队备战公告<textarea rows="7" value={matchForm.announcement} onChange={(event) => setMatchForm({ ...matchForm, announcement: event.target.value })} /></label>
            <button className="primary-button" type="submit" disabled={busy}>{busy ? '保存中…' : '保存'}</button>
          </form>
        </div>
      )}

      {showTaskForm && board.match && (
        <div className="modal-backdrop" role="presentation">
          <form className="modal-panel team-prep-form" onSubmit={saveTask}>
            <div className="panel-header">
              <h2>{editingTaskId ? '编辑任务' : '创建当前比赛任务'}</h2>
              <button type="button" onClick={() => setShowTaskForm(false)}>取消</button>
            </div>
            <label>任务标题<input required maxLength="80" value={taskForm.title} onChange={(event) => setTaskForm({ ...taskForm, title: event.target.value })} /></label>
            <label>任务说明<textarea value={taskForm.description} onChange={(event) => setTaskForm({ ...taskForm, description: event.target.value })} /></label>
            <label>任务来源<select value={taskForm.taskSource} onChange={(event) => setTaskForm({ ...taskForm, taskSource: event.target.value })}><option value="manual">手动任务</option><option value="training">锋辩训练</option></select></label>
            {taskForm.taskSource === 'training' && (
              <div className="team-prep-inline-fields">
                <label>训练模式<select value={taskForm.mode} onChange={(event) => setTaskForm({ ...taskForm, mode: event.target.value })}>{Object.entries(modeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label>难度<select value={taskForm.difficulty} onChange={(event) => setTaskForm({ ...taskForm, difficulty: event.target.value })}><option value="novice">新手</option><option value="campus">校赛</option><option value="city">市赛</option></select></label>
              </div>
            )}
            <label>截止时间（可选）<input type="datetime-local" value={taskForm.deadline} onChange={(event) => setTaskForm({ ...taskForm, deadline: event.target.value })} /></label>
            <fieldset>
              <legend>负责人</legend>
              <div className="team-prep-assignee-picker">
                {board.members.map((member) => (
                  <label key={member.appUserId}>
                    <input
                      type="checkbox"
                      checked={taskForm.assignedUserIds.includes(member.appUserId)}
                      onChange={(event) => setTaskForm({
                        ...taskForm,
                        assignedUserIds: event.target.checked
                          ? [...taskForm.assignedUserIds, member.appUserId]
                          : taskForm.assignedUserIds.filter((id) => id !== member.appUserId)
                      })}
                    />
                    {member.nickname}
                  </label>
                ))}
              </div>
            </fieldset>
            <button className="primary-button" type="submit" disabled={busy || !taskForm.assignedUserIds.length}>{busy ? '保存中…' : '保存任务'}</button>
          </form>
        </div>
      )}
    </section>
  );
}

function TaskSection({
  title,
  tasks,
  emptyText,
  canManage,
  currentUserId,
  busy,
  onToggle,
  onCompleteAll,
  onRestoreAll,
  onEdit,
  onDelete,
  onStartTraining,
  onBringToPersonalLinWan
}) {
  return (
    <section className="panel team-prep-task-section">
      <h2>{title}</h2>
      {!tasks.length ? <div className="history-empty">{emptyText}</div> : (
        <div className="team-prep-task-list">
          {tasks.map((task) => (
            <article className="team-prep-task" key={task.id}>
              <div className="team-prep-task-heading">
                <div>
                  <span>{task.taskSource === 'training' ? '锋辩训练' : '手动任务'}{task.isMine ? ' · 我的任务' : ''}</span>
                  <h3>{task.title}</h3>
                  {task.description && <p>{task.description}</p>}
                </div>
                <small>{task.deadline ? `截止：${formatDate(task.deadline)}` : '无截止时间'}</small>
              </div>
              <div className="team-prep-assignment-list">
                {(task.assignments || []).map((assignment) => {
                  const mayToggle = canManage || assignment.appUserId === currentUserId;
                  return (
                    <div key={assignment.id}>
                      <span>{assignment.member?.nickname || '未命名成员'}</span>
                      <em className={assignment.status}>{assignment.status === 'completed' ? '已完成' : '未完成'}</em>
                      {mayToggle && (
                        <button type="button" disabled={busy} onClick={() => onToggle(task, assignment)}>
                          {assignment.status === 'completed' ? '撤销完成' : '标记完成'}
                        </button>
                      )}
                      {assignment.completionNote && <small>说明：{assignment.completionNote}</small>}
                    </div>
                  );
                })}
              </div>
              <div className="team-prep-actions">
                {task.taskSource === 'training' && (
                  <button type="button" disabled={task.userSide === null || busy} onClick={() => onStartTraining?.(task)}>
                    进入训练
                  </button>
                )}
                <button type="button" onClick={() => onBringToPersonalLinWan(task)}>带入个人 Super 林婉</button>
                {canManage && onCompleteAll && <button type="button" onClick={() => onCompleteAll(task)}>整体完成</button>}
                {canManage && onRestoreAll && <button type="button" onClick={() => onRestoreAll(task)}>整体恢复</button>}
                {canManage && <button type="button" onClick={() => onEdit(task)}>编辑</button>}
                {canManage && <button type="button" className="danger" onClick={() => onDelete(task)}>删除</button>}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function stanceLabel(value) {
  if (value === 'affirmative') return '正方';
  if (value === 'negative') return '反方';
  return '暂未确定';
}

function formatDate(value) {
  if (!value) return '待定';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '待定' : date.toLocaleString('zh-CN', { hour12: false });
}

function toLocalInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function friendlyError(error) {
  return error instanceof Error ? error.message : '操作失败，请稍后重试。';
}
