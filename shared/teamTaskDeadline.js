export function getTaskDeadlineTime(task = {}) {
  const value = task.deadline;
  if (!value) return null;

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

export function isTaskExpired(task = {}, now = Date.now()) {
  const deadlineTime = getTaskDeadlineTime(task);
  return deadlineTime !== null && Number(now) > deadlineTime;
}

export function isTaskEnded(task = {}) {
  return ['ended', 'closed'].includes(task.status);
}

export function isTaskActive(task = {}, now = Date.now()) {
  return !isTaskEnded(task) && (task.status || 'active') === 'active' && !isTaskExpired(task, now);
}

export function getTaskDerivedStatus(task = {}, now = Date.now()) {
  if (isTaskEnded(task)) return 'ended';
  if (isTaskExpired(task, now)) return 'expired';
  return task.status || 'active';
}
