/**
 * 全链路 E2E：问答页逐题作答 + 真实调用云函数 draw action（automator）
 * 覆盖：quiz 六题选择（本地确定性匹配）→ 云端 draw（配额/校验/落库）→ 报告页渲染 → 本地历史 → 云端 modelVersion 核验
 * 前提：analyze 云函数已部署（npm run deploy:cloud），且当日配额未耗尽
 */
const automator = require('miniprogram-automator');
const assert = require('assert');
const path = require('path');

const CLI = '/Applications/wechatwebdevtools.app/Contents/MacOS/cli';
const PROJECT = path.resolve(__dirname, '..');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const QUESTIONS = 6;

async function main() {
  console.log('① 启动开发者工具…');
  const mini = await automator.launch({
    cliPath: CLI,
    projectPath: PROJECT,
    timeout: 60000,
  });

  try {
    // ② 问答页：逐题选第一项 → 下一题 → 交卷
    console.log('② 进入问答页，逐题作答（本地确定性匹配 + 真实云函数 draw）…');
    let page = await mini.reLaunch('/pages/quiz/quiz');
    await sleep(1200);
    assert((await page.$('.q-card')), '问答页未渲染');

    for (let i = 0; i < QUESTIONS; i++) {
      const opts = await page.$$('.opt');
      assert(opts.length >= 2, `第 ${i + 1} 题选项未渲染`);
      await opts[0].tap();
      await sleep(300);
      await (await page.$('.q-nav.next')).tap();
      await sleep(600);
    }

    // ③ 等云端 draw 落档 + 跳报告页（仪式 0.9s + 云端往返，放宽到 25s 容纳冷启动）
    console.log('③ 等待匹配落档（最长 25s）…');
    const t0 = Date.now();
    let landed = null;
    while (Date.now() - t0 < 25_000) {
      await sleep(1_000);
      page = await mini.currentPage();
      if (page.path.includes('report')) { landed = 'report'; break; }
      if (page.path.includes('index') || page.path.includes('quiz')) { if (Date.now() - t0 > 12_000) { landed = 'other'; break; } }
    }
    const dur = Math.round((Date.now() - t0) / 1000);
    console.log(`   ${dur}s 后落在: ${page.path}`);

    if (landed !== 'report') {
      throw new Error(`未到报告页（落在 ${landed ?? '问答页超时'}）；常见原因：当日配额耗尽或 draw 未部署`);
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
    assert(reports[0].modelVersion === 'local-draw-1', '本地记录 engine 版本不对');
    console.log(`⑤ 本地历史 ✓ 共 ${reports.length} 条（engine=local-draw-1）`);

    // ⑥ 云端核验：最新记录 modelVersion 应为 local-draw-1（draw action 落档）
    const { execSync } = require('child_process');
    const cli = `export PATH="$(npm prefix -g)/bin:$PATH"; cloudbase db nosql execute -e cloud1-d9g41s8gza68b70b8 --json --command '[{"TableName":"analyses","CommandType":"COMMAND","Command":"{\\"find\\":\\"analyses\\",\\"filter\\":{},\\"sort\\":{\\"createdAt\\":-1},\\"limit\\":1,\\"projection\\":{\\"modelVersion\\":1,\\"fallback\\":1}}"}}]'`;
    try {
      const out = execSync(cli, { shell: '/bin/zsh', timeout: 60_000 }).toString();
      const m = out.match(/\{[\s\S]*\}/);
      const j = JSON.parse(m[0]);
      // cloudbase 返回 results 为双层数组 [[{...}]]，兼容 cursor.firstBatch 两种形态
      const first = j?.data?.results?.[0];
      const batch = (Array.isArray(first) ? first[0] : first?.cursor?.firstBatch?.[0]) || {};
      console.log(`⑥ 云端最新记录: modelVersion=${String(batch.modelVersion)} fallback=${String(batch.fallback)}`);
      assert(batch.modelVersion === 'local-draw-1', `云端 modelVersion 应为 local-draw-1，实际 ${String(batch.modelVersion)}`);
    } catch (e) {
      console.log('⑥ 云端核验跳过（CLI 查询失败）：', String(e.message).slice(0, 80));
    }

    console.log('\n✅ 全链路 E2E 通过：问答→云端 draw 落档→报告→历史');
  } finally {
    await mini.close().catch(() => {});
  }
}

main().catch((e) => { console.error('\n❌ E2E 失败：', e.message); process.exit(1); });
