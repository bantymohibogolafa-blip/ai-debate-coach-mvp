import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const appSource = fs.readFileSync(
  fileURLToPath(new URL('../src/App.jsx', import.meta.url)),
  'utf8'
);

test('Lin Wan receives the authoritative ability estimate instead of a record-list profile', () => {
  assert.match(appSource, /trainingProfile=\{displayedAbilityEstimate\}/);
  assert.equal(appSource.includes('function buildUserTrainingProfile('), false);
  assert.equal(appSource.includes('linWanTrainingProfile'), false);
});

test('Lin Wan profile display uses scored records and unified ability dimensions', () => {
  assert.match(appSource, /profile\?\.scoredRecordCount/);
  assert.match(appSource, /统一六维能力画像/);
  assert.match(appSource, /profile\?\.dimensions/);
  assert.match(appSource, /Number\(dimension\?\.records\) <= 0/);
  assert.match(appSource, /待测能力不显示分数，也不会参与综合能力、短板或辩位判断/);
  assert.match(appSource, /林婉不会在测评前把这些能力判断为短板/);
});
