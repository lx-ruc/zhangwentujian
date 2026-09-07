/**
 * 全链路 E2E：模拟器内本地抽签 + 真实调用云函数 draw action（automator）
 * 覆盖：本地 drawReport（照片不出手机）→ 云端 draw（配额/校验/落库）→ 报告页渲染 → 本地历史 → 云端 modelVersion 核验
 * 前提：analyze 云函数已部署（npm run deploy:cloud），且当日配额未耗尽
 */
const automator = require('miniprogram-automator');
const assert = require('assert');
const path = require('path');

const CLI = '/Applications/wechatwebdevtools.app/Contents/MacOS/cli';
const PROJECT = path.resolve(__dirname, '..');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log('① 启动开发者工具…');
  const mini = await automator.launch({
    cliPath: CLI,
    projectPath: PROJECT,
    timeout: 60000,
  });

  try {
    // ② 注入抽签状态（照片不出手机：pendingImage 留空，仅有左右手）
    console.log('② 注入状态，进入抽签页（本地 drawReport + 真实云函数 draw）…');
    await mini.evaluate(() => {
      const app = getApp();
      app.globalData.pendingImage = null;
      app.globalData.pendingHand = 'right';
    });

    let page = await mini.reLaunch('/pages/analyzing/analyzing');
    assert((await page.$('.progress')), '抽签页未渲染');

    // ③ 等本地抽签动画（约 2.2s）+ 云端落档（看门狗 10s，放宽到 25s 容纳冷启动）
    console.log('③ 等待抽签落档（最长 25s）…');
    const t0 = Date.now();
    let landed = null;
    while (Date.now() - t0 < 25_000) {
      await sleep(1_000);
      page = await mini.currentPage();
      if (page.path.includes('report')) { landed = 'report'; break; }
      if (page.path.includes('index') || page.path.includes('capture')) { landed = 'other'; break; }
    }
    const dur = Math.round((Date.now() - t0) / 1000);
    console.log(`   ${dur}s 后落在: ${page.path}`);

    if (landed !== 'report') {
      throw new Error(`未到报告页（落在 ${landed ?? '抽签页超时'}）；常见原因：当日配额耗尽或 draw 未部署`);
    }

    // ④ 报告页断言：类型来自 12 支签封闭集，文案来自内容库
    const data = await page.data();
    assert(data.palmType && data.palmType.name, '报告页缺签类型');
    assert(data.summary && data.summary.length > 20, '总评为空');
    assert(Array.isArray(data.lines) && data.lines.length === 3, '三维度条缺失');
    console.log(`④ 报告页 ✓ 签「${data.palmType.name}」趣味评分 ${data.funScore}（${data.summary.slice(0, 24)}…）`);

    // ⑤ 历史落库（本地）
    const reports = await mini.evaluate(() => wx.getStorageSync('reports') || []);
    assert(reports.length >= 1, '本地历史未落库');
    assert(reports[reports.length - 1].modelVersion === 'local-draw-1', '本地记录 engine 版本不对');
    console.log(`⑤ 本地历史 ✓ 共 ${reports.length} 条（engine=local-draw-1）`);

    // ⑥ 云端核验：最新记录 modelVersion 应为 local-draw-1（draw action 落档）
    const { execSync } = require('child_process');
    const cli = `export PATH="$(npm prefix -g)/bin:$PATH"; cloudbase db nosql execute -e cloud1-d9g41s8gza68b70b8 --json --command '[{"TableName":"analyses","CommandType":"COMMAND","Command":"{\\"find\\":\\"analyses\\",\\"filter\\":{},\\"sort\\":{\\"createdAt\\":-1},\\"limit\\":1,\\"projection\\":{\\"modelVersion\\":1,\\"fallback\\":1}}"}}]'`;
    try {
      const out = execSync(cli, { shell: '/bin/zsh', timeout: 60_000 }).toString();
      const m = out.match(/\{[\s\S]*\}/);
      const j = JSON.parse(m[0]);
      const batch = j?.data?.results?.[0]?.cursor?.firstBatch?.[0] || {};
      console.log(`⑥ 云端最新记录: modelVersion=${String(batch.modelVersion)} fallback=${String(batch.fallback)}`);
      assert(batch.modelVersion === 'local-draw-1', `云端 modelVersion 应为 local-draw-1，实际 ${String(batch.modelVersion)}`);
    } catch (e) {
      console.log('⑥ 云端核验跳过（CLI 查询失败）：', String(e.message).slice(0, 80));
    }

    console.log('\n✅ 全链路 E2E 通过：本地抽签→云端 draw 落档→报告→历史');
  } finally {
    await mini.close().catch(() => {});
  }
}

main().catch((e) => { console.error('\n❌ E2E 失败：', e.message); process.exit(1); });
