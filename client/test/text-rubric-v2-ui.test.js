import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('only interactive modes advertise and render difficulty controls', () => {
  for (const mode of ['constructive', 'summary', 'closing']) {
    assert.match(appSource, new RegExp(`value: '${mode}',[\\s\\S]{0,80}usesDifficulty: false`));
  }
  for (const mode of ['attack', 'defense', 'free_debate']) {
    assert.match(appSource, new RegExp(`value: '${mode}',[\\s\\S]{0,80}usesDifficulty: true`));
  }
  assert.match(appSource, /selectedMode\?\.usesDifficulty !== false/);
  assert.match(appSource, /usesDifficulty && \(/);
});

test('history explains the text V2 comparison boundary', () => {
  assert.match(appSource, /评分标准已于2026年8月1日更新，新旧分数不建议直接比较/);
  assert.match(appSource, /record\.rubricVersion === 'text_v2'/);
});

test('defense record submission carries the data required for server-side finalization', () => {
  assert.match(appSource, /config\.trainingMode === 'defense' \? \{/);
  assert.match(appSource, /defenseRoundStates,[\s\S]{0,100}rounds: config\.rounds,[\s\S]{0,100}plannedRounds: config\.rounds/);
  assert.match(appSource, /completedRounds: completedMessages\.filter/);
  assert.match(appSource, /reviewData\?\.finalScore \?\? reviewData\?\.totalScore \?\? reviewData\?\.score/);
  assert.match(appSource, /reviewData\.finalScore \?\? reviewData\.totalScore \?\? reviewData\.score/);
});
