import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const stylesSource = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

test('mobile Lin Wan chat keeps messages before a sticky composer', () => {
  const chatIndex = appSource.indexOf('assistant-chat-list experience-chat-list');
  const composerIndex = appSource.indexOf('assistant-input-row experience-input-row');

  assert.ok(chatIndex >= 0 && composerIndex > chatIndex);
  assert.match(stylesSource, /\.experience-panel > \.experience-input-row\s*{[^}]*position:\s*sticky;[^}]*bottom:\s*0;/s);
  assert.match(stylesSource, /env\(safe-area-inset-bottom/);
});

test('mobile composer uses a compact auto-growing textarea', () => {
  assert.match(appSource, /placeholder="问问林婉……"/);
  assert.match(appSource, /input\.style\.height = 'auto'/);
  assert.match(stylesSource, /\.experience-input-row textarea\s*{[^}]*min-height:\s*44px;[^}]*max-height:\s*132px;[^}]*resize:\s*none;/s);
});

test('quick questions become an empty state and Lin Wan actions share one row', () => {
  assert.match(appSource, /hasConversation \? 'has-conversation' : 'is-empty'/);
  assert.match(stylesSource, /\.experience-quick-panel\.has-conversation\s*{\s*display:\s*none;/s);
  assert.match(appSource, /className="linwan-message-actions"/);
  assert.match(appSource, />▶ 听林婉说</);
  assert.match(appSource, /LinWanContextManifest/);
});
