/**
 * E2E 冒烟测试（miniprogram-automator）
 * 前提：微信开发者工具已登录，且「设置 → 安全设置 → 服务端口」已开启
 * 运行：npm run e2e
 */
const automator = require('miniprogram-automator');
const assert = require('assert');
const path = require('path');

const CLI = '/Applications/wechatwebdevtools.app/Contents/MacOS/cli';
const PROJECT = path.resolve(__dirname, '..');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  let mini;
  // 优先连接已运行的自动化实例（工具已开启服务端口时最快）；失败再走 launch
  try {
    console.log('尝试连接已运行的自动化端口 ws://localhost:9420 …');
    mini = await automator.connect({ wsEndpoint: 'ws://localhost:9420' });
    console.log('已连接现有实例');
  } catch (e) {
    console.log('连接失败，改为启动开发者工具（首次约 10-20s）…');
    mini = await automator.launch({
      cliPath: CLI,
      projectPath: PROJECT,
      timeout: 60000,
    });
  }

  try {
    // ---- ① 首页 ----
    let page = await mini.reLaunch('/pages/index/index');
    await sleep(1000);
    assert((await page.$('.display')), '首页：品牌大标题未渲染');
    assert((await page.$('.cta')), '首页：CTA 未渲染');
    const quota = await page.$('.quota-chip .num');
    assert(quota, '首页：剩余次数未渲染');
    console.log('✓ 首页渲染正常');

    // ---- ② 首页 → 拍摄页（真实路由跳转）----
    await (await page.$('.cta')).tap();
    await sleep(1000);
    page = await mini.currentPage();
    assert(page.path.includes('capture'), `路由跳转失败：${page.path}`);
    assert((await page.$('.viewfinder')), '拍摄页：取景框未渲染');
    console.log('✓ 首页→拍摄页跳转 + 取景框正常');

    // ---- ③ 图鉴收集页：12 格网格 ----
    page = await mini.reLaunch('/pages/collection/collection');
    await sleep(1000);
    const cells = await page.$$('.cell');
    assert(cells.length === 12, `图鉴网格应为 12 格，实际 ${cells.length}`);
    console.log('✓ 图鉴收集页 12 型网格渲染');

    // ---- ④ 报告页：mock 兜底 + 类型徽章（85/72/78 → 燎原星火）----
    page = await mini.reLaunch('/pages/report/report');
    await sleep(1200);
    const typeName = await page.$('.type-name');
    assert(typeName, '报告页：类型徽章未渲染（mock 兜底失效？）');
    const name = await typeName.text();
    assert(name.includes('燎原星火'), `类型徽章应为「燎原星火」，实际「${name}」`);
    assert((await page.$('.scene')), '报告页：场景速读未渲染');
    console.log(`✓ 报告页 mock 兜底 + 类型徽章（${name}）`);

    // ---- ⑤ 历史 / 关于 ----
    page = await mini.reLaunch('/pages/history/history');
    await sleep(800);
    assert((await page.$('.h-head')), '历史页头部未渲染');
    page = await mini.reLaunch('/pages/about/about');
    await sleep(800);
    assert((await page.$('.about-head')), '关于页头部未渲染');
    console.log('✓ 历史/关于页渲染正常');

    console.log('\n✅ E2E 冒烟全部通过（6 页面 + 路由跳转 + mock 链路 + 图鉴分类）');
  } finally {
    await mini.close();
  }
}

main().catch((e) => {
  console.error('\n❌ E2E 失败：', e.message);
  if (String(e.message).includes('port') || String(e.message).includes('端口')) {
    console.error('提示：请打开微信开发者工具 → 设置 → 安全设置 → 开启「服务端口」后重试');
  }
  process.exit(1);
});
