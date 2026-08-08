import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { contactInfo, getFeedbackMailto } from '../src/data/contactInfo.js';
import {
  getInitialOnboardingPageIndex,
  getNextOnboardingPageIndex,
  getOnboardingPrimaryAction,
  getPreviousOnboardingPageIndex,
  onboardingKicker,
  onboardingPages
} from '../src/data/onboardingContent.js';

test('onboarding contains the required nine pages in order', () => {
  assert.equal(onboardingPages.length, 9);
  assert.deepEqual(onboardingPages.map(({ title }) => title), [
    '锋辩是什么？',
    '三步开始一次训练',
    '我该选哪个模式？',
    '训练中如何作答？',
    '训练结束后怎么看？',
    '林婉 · 辩论顾问',
    'Super 林婉 · 赛前备战',
    '个人空间与团队空间',
    '去大胆试试吧'
  ]);
  assert.equal(onboardingKicker, '9页快速认识锋辩');
});

test('opening, previous, next, and final primary action respect page boundaries', () => {
  assert.equal(getInitialOnboardingPageIndex(), 0);
  assert.equal(getPreviousOnboardingPageIndex(0), 0);
  assert.equal(getPreviousOnboardingPageIndex(4), 3);
  assert.equal(getNextOnboardingPageIndex(0), 1);
  assert.equal(getNextOnboardingPageIndex(8), 8);
  assert.deepEqual(getOnboardingPrimaryAction(7), { label: '下一步', type: 'next' });
  assert.deepEqual(getOnboardingPrimaryAction(8), { label: '进入训练区', type: 'start' });
});

test('three-step flow matches the current setup and explains returning to edit', () => {
  const page = onboardingPages[1];
  assert.deepEqual(page.steps.map(({ title }) => title), ['第一步：辩题', '第二步：模式', '第三步：开赛']);
  assert.match(page.tip, /顶部步骤或返回按钮修改之前的内容/);
});

test('answering page excludes the four prohibited explanations', () => {
  const content = JSON.stringify(onboardingPages[3]);
  for (const phrase of ['识别结果先进入输入框', '用户可以修改', '不会自动发送', '用户确认后手动提交']) {
    assert.equal(content.includes(phrase), false, `page 4 must not include: ${phrase}`);
  }
});

test('Lin Wan, Super Lin Wan, and space pages document distinct bounded contexts', () => {
  const linWanContent = JSON.stringify(onboardingPages[5]);
  const superLinWanPage = onboardingPages[6];
  const superLinWanContent = JSON.stringify(superLinWanPage);
  const spacesContent = JSON.stringify(onboardingPages[7]);
  assert.match(linWanContent, /最近12轮完整对话/);
  assert.match(linWanContent, /当前空间的近期训练画像/);
  assert.match(linWanContent, /日常辩论咨询/);
  assert.equal(linWanContent.includes('赛前准备'), false);
  assert.deepEqual(superLinWanPage.features.map(({ title }) => title), [
    '独立备战任务',
    '拆辩题',
    '发散论点',
    '搜集论据',
    '当前思路报告',
    '即时检验'
  ]);
  assert.match(superLinWanContent, /一场具体比赛/);
  assert.match(superLinWanContent, /不会和日常林婉聊天或其他比赛混在一起/);
  assert.match(superLinWanContent, /独立的个人备战任务/);
  assert.match(spacesContent, /不同空间的数据彼此隔离/);
  assert.match(spacesContent, /当前所在空间的训练画像/);
  assert.match(spacesContent, /独立保存在个人账号中/);
  assert.match(spacesContent, /不会自动读取团队训练画像/);
});

test('the final page title and intro remain exactly unchanged', () => {
  const finalPage = onboardingPages[8];
  assert.equal(finalPage.id, 'start');
  assert.equal(finalPage.title, '去大胆试试吧');
  assert.equal(finalPage.intro, '别害怕，去大胆尝试 AI 辩论，也试着和林婉聊会儿吧。\n她不一样，你也不一样，她应该会很懂你的吧。');
});

test('shared contact data preserves complete mailto and WeChat values', () => {
  assert.deepEqual(contactInfo.emails.map(({ name, role, value }) => ({ name, role, value })), [
    { name: '王予明', role: 'Founder & Project Leader', value: '1507514823@qq.com' },
    { name: '党梓豪', role: 'R&D Developer', value: 'dangzihao_2025@qq.com' }
  ]);
  assert.equal(contactInfo.wechat.name, '党梓豪');
  assert.equal(contactInfo.wechat.value, 'Dzh18781352495');
  assert.match(getFeedbackMailto(contactInfo.emails[0].value), /^mailto:1507514823@qq\.com\?subject=/);
  assert.match(getFeedbackMailto(contactInfo.emails[1].value), /^mailto:dangzihao_2025@qq\.com\?subject=/);
});

test('guide and function panel share one contact component without changing entry actions', async () => {
  const [guideSource, appSource, contactSource] = await Promise.all([
    readFile(new URL('../src/components/OnboardingGuide.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/ContactFeedback.jsx', import.meta.url), 'utf8')
  ]);
  assert.match(guideSource, /<ContactFeedback variant="guide"/);
  assert.match(guideSource, /if \(page\.features\)/);
  assert.match(appSource, /<ContactFeedback variant="panel"/);
  assert.match(contactSource, /from '\.\.\/data\/contactInfo\.js'/);
  assert.match(contactSource, /在使用过程中遇到任何问题，敬请联系：/);
  assert.equal(contactSource.includes('党梓豪微信'), false);
  assert.equal(contactSource.includes('党梓豪｜微信'), false);
  assert.match(guideSource, /primaryAction\.type === 'start'[\s\S]*\? onStart/);
  assert.match(appSource, /onClick=\{\(\) => switchFunctionTab\(item\)\}/);
  for (const label of ['训练区', '辩论顾问', '我的记录', '能力估测', '我的团队', '团队数据']) {
    assert.match(appSource, new RegExp(`label: '${label}'`));
  }
});
