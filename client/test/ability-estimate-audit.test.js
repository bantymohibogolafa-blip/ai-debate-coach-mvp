import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { normalizeAbilityHistoryValue } from '../src/utils/abilityChart.js';

const appSource = fs.readFileSync(
  fileURLToPath(new URL('../src/App.jsx', import.meta.url)),
  'utf8'
);

test('a null history dimension is not coerced into a zero-valued chart point', () => {
  assert.doesNotMatch(appSource, /const value = Number\(rawValue\)/);
  assert.match(appSource, /normalizeAbilityHistoryValue\(rawValue\)/);
  assert.equal(normalizeAbilityHistoryValue(null), null);
  assert.equal(normalizeAbilityHistoryValue(undefined), null);
  assert.equal(normalizeAbilityHistoryValue(''), null);
  assert.equal(normalizeAbilityHistoryValue('not-a-score'), null);
  assert.equal(normalizeAbilityHistoryValue(0), 0);
  assert.equal(normalizeAbilityHistoryValue('0'), 0);
});

test('the source card reads three distinct score fields', () => {
  assert.match(appSource, /dimensionKey:\s*meta\.key/);
  assert.match(appSource, /source\.projectedOverall/);
  assert.match(appSource, /projectedScores\[point\?\.dimensionKey\]/);
  assert.match(appSource, /point\?\.overall/);
  assert.match(appSource, /\['本次训练总分', `\$\{score\} \/ 100`\]/);
  assert.match(appSource, /\['本次维度投射分', `\$\{projectedScore\} \/ 100`\]/);
  assert.match(appSource, /\['训练后综合锋力估测', `\$\{overallEstimate\} \/ 100`\]/);
});

test('the source card keeps the selected dimension label alongside the three score fields', () => {
  assert.match(appSource, /\['当前维度', point\?\.dimensionName/);
});
