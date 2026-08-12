import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const stylesSource = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const panelSource = appSource.slice(
  appSource.indexOf('function TeamTasksPanel('),
  appSource.indexOf('function TaskDetail(')
);

test('team task detail renders inside the matching mapped task card', () => {
  const taskMapStart = panelSource.indexOf('tasks.map((task) =>');
  const inlineDetail = panelSource.indexOf('{isExpanded && (', taskMapStart);
  const taskMapEnd = panelSource.indexOf('})}', inlineDetail);

  assert.ok(taskMapStart >= 0);
  assert.ok(panelSource.includes("const expandedTaskId = selectedTaskDetail?.task?.id || '';"));
  assert.ok(panelSource.includes('const isExpanded = expandedTaskId === task.id;'));
  assert.ok(inlineDetail > taskMapStart && inlineDetail < taskMapEnd);
  assert.equal(panelSource.slice(taskMapEnd).includes('{selectedTaskDetail && ('), false);
});

test('inline loading, error, and close behavior reuse the selected task detail state', () => {
  assert.ok(panelSource.includes('isLoading={isTaskDetailLoading}'));
  assert.ok(panelSource.includes('error={taskDetailError}'));
  assert.ok(panelSource.includes("onClick={() => (isExpanded ? onClearTaskDetail() : onOpenTaskDetail(task))}"));
  assert.equal(panelSource.includes('window.scrollTo'), false);
});

test('expanded task card has connected detail styling and mobile scroll offset', () => {
  assert.match(stylesSource, /\.task-card > \.task-detail\s*\{/);
  assert.match(stylesSource, /\.task-card\.expanded\s*\{/);
  assert.match(stylesSource, /scroll-margin-top:\s*calc\(env\(safe-area-inset-top, 0px\) \+ 88px\)/);
  assert.match(stylesSource, /overflow-wrap:\s*anywhere/);
});
