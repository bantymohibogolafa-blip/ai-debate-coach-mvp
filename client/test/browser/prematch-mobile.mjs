// Run with Vite running; PLAYWRIGHT_MODULE may point to a bundled playwright/index.mjs.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:5173';
const output = new URL('../../../tmp/prematch-mobile/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const html = `<!doctype html><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>
<script type="module">
import RefreshRuntime from '/@react-refresh';
RefreshRuntime.injectIntoGlobalHook(window);
window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => (type) => type;
window.__vite_plugin_react_preamble_installed__ = true;
const {default: React} = await import('/node_modules/.vite/deps/react.js');
const {default: ReactDOM} = await import('/node_modules/.vite/deps/react-dom_client.js');
const {default: Prep} = await import('/src/components/SuperLinWanPrep.jsx');
await import('/src/styles.css');
const task = {id:'mobile-test',title:'人工智能是否会降低人的创造力',debateTopic:'人工智能是否会降低人的创造力',status:'active',stance:'affirmative',strategyState:{}};
let messages = [{id:'reply',role:'assistant',content:('第三，群体层面有个很难绕开的逻辑坑：总量上升不等于创造力没有降低。\\n\\n').repeat(16),createdAt:new Date().toISOString()}];
const api = {
  getJson: async (url) => url.includes('/mobile-test') ? {task,messages,permissions:{canChat:true,canManage:true}} : {tasks:[task]},
  postJson: async (url, body) => { const assistantMessage = {id:'new-reply',role:'assistant',content:'收到，你可以继续补充判断。',createdAt:new Date().toISOString()}; messages = [...messages,assistantMessage]; return {task,assistantMessage}; }
};
const user = {id:'test-user'};
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement('main',{className:'app-shell'},
  React.createElement('section',{className:'team-topbar compact-topbar'},
    React.createElement('div',{className:'topbar-brand'},React.createElement('strong',null,'锋辩'),React.createElement('span',null,'当前：个人模式 / 小觉')),
    React.createElement('div',{className:'topbar-current'},React.createElement('span',null,'当前功能'),React.createElement('strong',null,'赛前备战｜Super 林婉')),
    React.createElement('button',{className:'function-panel-trigger'},'☰ 功能区')),
  React.createElement('div',{className:'history-status'},'登录成功。'),
  React.createElement(Prep,{api,isLoggedIn:true,currentUser:user,initialTaskId:'mobile-test'})));
</script>`;
async function check(page, label, height, top = 0) {
  await page.waitForTimeout(100);
  const rects = await page.evaluate(() => {
    const rect = (selector) => {
      const {top,bottom,left,right,height} = document.querySelector(selector).getBoundingClientRect();
      return {top,bottom,left,right,height};
    };
    const list = document.querySelector('.prematch-chat-list');
    return {input:rect('.prematch-chat-input'),list:rect('.prematch-chat-list'),shell:rect('.app-shell'),
      scrollable:list.scrollHeight > list.clientHeight,scrollTop:window.scrollY,width:window.innerWidth};
  });
  assert.ok(rects.input.bottom <= top + height + 1, `${label}: composer clipped ${JSON.stringify(rects)}`);
  assert.ok(rects.input.top >= top && rects.input.height >= 44, `${label}: composer missing`);
  assert.ok(rects.input.right <= rects.width && rects.input.left >= 0, `${label}: horizontal overflow`);
  assert.ok(rects.list.bottom <= rects.input.top + 1 && rects.list.height > 0, `${label}: chat overlaps input`);
  console.log(label, JSON.stringify(rects));
}
try {
  for (const width of [360,393,414]) {
    const context = await browser.newContext({viewport:{width,height:760},isMobile:true,hasTouch:true,
      userAgent:'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/110.0.0.0 Mobile Safari/537.36 MicroMessenger/8.0.49'});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
    await page.route('**/__mobile-regression', route => route.fulfill({contentType:'text/html',body:html}));
    await page.goto(`${origin}/__mobile-regression`);
    await page.locator('.prematch-chat-input').waitFor();
    await check(page, `${width}px login + long reply`, 760);
    if (width === 393) {
      // Demonstrate the original CSS failure with the same actual component and content.
      if (process.env.BASELINE_REF) {
      const oldCss = execFileSync('git',['show',`${process.env.BASELINE_REF}:client/src/styles.css`],{encoding:'utf8'});
      const baseline = await page.addStyleTag({content:oldCss + '\n@media(max-width:620px){body.prematch-workspace-open .app-shell{position:static;display:block;height:100dvh}.prematch-workspace{flex:none;position:static}}'});
      const before = await page.locator('.prematch-chat-input').boundingBox();
      assert.ok(before.y + before.height > 760, 'baseline must reproduce clipping');
      await page.screenshot({path:fileURLToPath(new URL('before.png',output))});
      await baseline.evaluate(el => el.remove());
      }
      await page.screenshot({path:fileURLToPath(new URL('after.png',output))});
    }
    await page.getByRole('button',{name:'打开对话工具',exact:true}).click();
    await page.locator('.prematch-tools-heading').getByRole('button',{name:'关闭对话工具'}).click();
    await page.locator('.prematch-note-fab').click();
    await page.locator('.prematch-note-close').click();
    await page.locator('.prematch-chat-input textarea').fill('我想从个体创造力继续讨论');
    await page.locator('.prematch-chat-input button[type=submit]').click();
    await page.getByText('收到，你可以继续补充判断。').waitFor();
    await check(page, `${width}px after reply`, 760);
    await page.evaluate(() => {
      const viewport = Object.assign(new EventTarget(),{height:380,offsetTop:40,scale:1});
      Object.defineProperty(window,'visualViewport',{configurable:true,value:viewport});
    });
    // Re-enter to bind the simulated visual viewport, just as a real WebView does on mount.
    await page.getByRole('button',{name:'返回任务列表',exact:true}).click();
    await page.locator('.prematch-task-card').click();
    await check(page, `${width}px keyboard + pan`, 380, 40);
    await page.evaluate(() => {window.visualViewport.height=760;window.visualViewport.offsetTop=0;window.visualViewport.dispatchEvent(new Event('resize'));});
    await check(page, `${width}px keyboard closed`, 760);
    await page.evaluate(() => document.querySelector('.app-shell > .history-status').remove());
    await check(page, `${width}px without login notice`, 760);
    await page.evaluate(() => {
      document.body.style.fontSize = '20px';
      const notice = document.createElement('div');
      notice.className = 'history-status';
      notice.textContent = '登录成功。';
      document.querySelector('.compact-topbar').after(notice);
    });
    await check(page, `${width}px larger system text`, 760);
    await page.getByRole('button',{name:'返回任务列表',exact:true}).click();
    assert.equal(await page.evaluate(() => document.body.classList.contains('prematch-workspace-open')), false);
    assert.deepEqual(errors, []);
    await context.close();
  }
  const page = await browser.newPage({viewport:{width:1440,height:900}});
  await page.route('**/__mobile-regression', route => route.fulfill({contentType:'text/html',body:html}));
  await page.goto(`${origin}/__mobile-regression`);
  await page.locator('.prematch-chat-input').waitFor();
  assert.notEqual(await page.locator('.app-shell').evaluate(el => getComputedStyle(el).position), 'fixed');
  await page.locator('.prematch-chat-input').scrollIntoViewIfNeeded();
  assert.ok((await page.locator('.prematch-chat-input').boundingBox()).width > 620);
  console.log('desktop retains normal document layout');
} finally { await browser.close(); }
