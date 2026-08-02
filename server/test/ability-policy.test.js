import assert from 'node:assert/strict';
import test from 'node:test';

import { abilityDimensions, abilityModeProjection } from '../src/abilityProfile.js';
import { getScoringRubric } from '../src/scoringRubrics.js';
import { CURRENT_PROJECTION_VERSION } from '../src/scoringVersions.js';
import { assertClose } from './ability-test-helpers.js';

const EXPECTED_ABILITY_WEIGHTS = {
  logic: 0.30,
  defenseStability: 0.15,
  counterPressure: 0.20,
  battlefieldControl: 0.15,
  expression: 0.20
};

const EXPECTED_ABILITY_MODE_PROJECTION = {
  constructive: {
    '辩题理解、立场与举证责任': { logic: 0.7, battlefieldControl: 0.3 },
    '定义、判准与裁决框架': { logic: 0.5, battlefieldControl: 0.5 },
    '论证结构与逻辑链条': { logic: 1 },
    '论据支撑与现实适配': { logic: 1 },
    '战场设计与表达完成度': { battlefieldControl: 0.7, expression: 0.3 }
  },
  summary: {
    '交锋事实还原与关键材料提取': { battlefieldControl: 0.6, logic: 0.4 },
    '核心漏洞识别与责任判定': { counterPressure: 0.7, logic: 0.3 },
    '战场结算与胜负比较': { battlefieldControl: 0.5, logic: 0.3, expression: 0.2 },
    '攻防成果向本方主线转化': { logic: 0.4, battlefieldControl: 0.6 },
    '表达凝练与节奏控制': { expression: 1 }
  },
  free_debate: {
    '战场识别与控制': { battlefieldControl: 1 },
    '临场回应与反击': { defenseStability: 0.65, counterPressure: 0.35 },
    '逻辑推进与攻守转换': { logic: 0.5, battlefieldControl: 0.2, counterPressure: 0.3 },
    '表达效率与节奏感': { expression: 1 },
    '战术选择与临场判断': { battlefieldControl: 0.7, counterPressure: 0.3 }
  },
  attack: {
    '问题精准度': { counterPressure: 0.6, logic: 0.4 },
    '连续追问能力': { counterPressure: 0.7, battlefieldControl: 0.3 },
    '抓漏洞能力': { logic: 0.6, counterPressure: 0.4 },
    '逻辑压迫与战场推进': { battlefieldControl: 0.6, counterPressure: 0.4 },
    '表达简洁度与节奏控制': { expression: 1 }
  },
  defense: {
    '正面回应能力': { defenseStability: 0.8, logic: 0.2 },
    '逻辑防守能力': { defenseStability: 0.4, logic: 0.6 },
    '概念切割与陷阱识别': { defenseStability: 0.6, logic: 0.4 },
    '反压能力': { counterPressure: 1 },
    '表达效率与稳定性': { expression: 1 }
  },
  closing: {
    '交锋事实吸收与比赛还原': { battlefieldControl: 0.7, logic: 0.3 },
    '核心战场整合': { battlefieldControl: 0.7, expression: 0.3 },
    '双方胜负比较与责任结算': { battlefieldControl: 0.6, logic: 0.4 },
    '裁决标准与价值收束': { battlefieldControl: 0.4, logic: 0.6 },
    '终局表达与结构完成度': { expression: 0.7, logic: 0.3 }
  }
};

test('ability policy locks the five official keys, order, weights, and v4 version', () => {
  assert.deepEqual(
    Object.fromEntries(abilityDimensions.map(({ key, weight }) => [key, weight])),
    EXPECTED_ABILITY_WEIGHTS
  );
  assert.deepEqual(abilityDimensions.map(({ key }) => key), Object.keys(EXPECTED_ABILITY_WEIGHTS));
  assert.equal(new Set(abilityDimensions.map(({ key }) => key)).size, 5);
  assertClose(abilityDimensions.reduce((sum, item) => sum + item.weight, 0), 1);
  assert.equal(CURRENT_PROJECTION_VERSION, 'ability_projection_v4');
});

test('all six modes exactly match the finalized ability projection matrix', () => {
  assert.deepEqual(abilityModeProjection, EXPECTED_ABILITY_MODE_PROJECTION);
});

test('every projection entry matches canonical rubric dimensions and has a valid share', () => {
  const officialKeys = new Set(Object.keys(EXPECTED_ABILITY_WEIGHTS));
  for (const [mode, expectedProjection] of Object.entries(EXPECTED_ABILITY_MODE_PROJECTION)) {
    const rubricNames = getScoringRubric(mode).rubric.dimensions.map((dimension) => dimension.name);
    assert.deepEqual(Object.keys(expectedProjection), rubricNames, `${mode} rubric order must remain stable`);
    for (const [dimension, targets] of Object.entries(expectedProjection)) {
      const targetKeys = Object.keys(targets);
      assert.equal(targetKeys.length >= 1, true, `${mode}.${dimension} must target an ability`);
      assert.equal(targetKeys.length <= 3, true, `${mode}.${dimension} may target at most three abilities`);
      assert.equal(targetKeys.every((key) => officialKeys.has(key)), true, `${mode}.${dimension} has an unknown ability`);
      assert.equal(Object.values(targets).every((share) => share > 0), true, `${mode}.${dimension} shares must be positive`);
      assertClose(Object.values(targets).reduce((sum, share) => sum + share, 0), 1, 1e-9, `${mode}.${dimension} shares must sum to 1`);
    }
  }
});
