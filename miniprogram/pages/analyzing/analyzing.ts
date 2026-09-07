import { CONFIG } from '../../config/index';
import { shareDefault, triggerShareBonus } from '../../utils/share';
import { callFunction, RequestError } from '../../utils/request';
import { consumeQuota, normalizeQuotaState, QuotaState } from '../../utils/quota';
import { getNavTopPx } from '../../utils/nav';
import { ReportResult, AnalysisRecord } from '../../types/index';
import { drawReport } from '../../utils/draw';

/** 掩盖约 3s 等待的签语轮播（文案合规：封闭体系/趣味定位，无运/命/吉凶表述） */
const FACTS = [
  'AI掌纹分析是封闭图鉴：无论怎么抽，结果一定落在十二支签之内，不会跑出边。',
  '十二支签的稀有度各不相同——稀有度是趣味估算，供收集参考，抽到哪支全看随机。',
  '每支签的文案预置且固定：同一支签人人拿到的解读一致，差异只在抽中哪支。',
  '所有解读都用「倾向于」「可能」这类对冲措辞——这是趣味测试，不是结论，仅供娱乐。',
  '结果当聊天素材最合适：发到群里比一比谁抽到了稀有签，才是正确打开方式。',
];

/** 进度节奏：2.2s 冲到 92%，云端 draw 落档返回后由 complete 拉满 */
const FAST_MS = 2_200;
const FAST_PCT = 92;
/** 看门狗：本地抽签即时完成，超时基本只剩网络问题，10s 足够 */
const WATCHDOG_MS = 10_000;

/** 本地抽签结果（typeId 供云端白名单校验；id 为云端记录） */
interface DrawOutcome {
  report: ReportResult;
  typeId: string;
  id?: string;
}

Page({
  data: {
    navTop: getNavTopPx(),
    progress: 0,
    facts: FACTS,
    factIndex: 0,
    done: false,
    handImage: '',
    handText: '右手',
  },

  factTimer: 0 as unknown as ReturnType<typeof setInterval>,
  progressTimer: 0 as unknown as ReturnType<typeof setInterval>,
  watchdogTimer: 0 as unknown as ReturnType<typeof setTimeout>,
  settled: false,
  failReason: '',
  /** 页面存活标记：卸载后不再触发结算，防止死页 setData */
  alive: true as boolean,

  onLoad() {
    const app = getApp();
    this.setData({
      handImage: app.globalData.pendingImage,
      handText: app.globalData.pendingHand === 'left' ? '左手' : '右手',
    });

    const startedAt = Date.now();
    this.progressTimer = setInterval(() => {
      const el = Date.now() - startedAt;
      const pct = Math.min(FAST_PCT, (el / FAST_MS) * FAST_PCT);
      // 只增不减；不触达 100（100 由完成回调驱动）
      if (Math.round(pct) > this.data.progress) this.setData({ progress: Math.round(pct) });
    }, 200);

    this.factTimer = setInterval(() => {
      this.setData({ factIndex: (this.data.factIndex + 1) % FACTS.length });
    }, CONFIG.FACT_INTERVAL);

    // 看门狗：超时按失败处理，避免无限等待
    this.watchdogTimer = setTimeout(() => {
      if (!this.settled) this.complete(Promise.reject(new RequestError('MODEL_TIMEOUT', '抽签超时了，请重试一次')));
    }, WATCHDOG_MS);

    this.complete(this.runDraw());
  },

  async runDraw(): Promise<DrawOutcome> {
    const app = getApp();
    // 1) 本地抽签：确定性引擎，时间+随机混合做 seed（同秒多次结果不同）
    const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    const { report, type } = drawReport(seed);

    // 2) 本地乐观消耗一次；云端权威值由首页 onShow 拉取修正
    wx.setStorageSync('quota', consumeQuota(normalizeQuotaState(wx.getStorageSync('quota'))));

    // 3) 云端落档（服务端权威配额 + 校验 + 持久化）；失败回滚乐观消耗并上抛
    try {
      const data = await callFunction<{ id?: string; remaining?: number }>(CONFIG.FN_ANALYZE, {
        action: 'draw',
        hand: app.globalData.pendingHand,
        typeId: type.id,
        report,
      });
      return { report, typeId: type.id, id: data.id };
    } catch (err) {
      this.rollbackOptimisticConsume();
      if (err instanceof RequestError) {
        console.warn('[analyzing] 云端落档失败：', err.code);
        throw err;
      }
      console.warn('[analyzing] 未知错误：', err);
      throw new RequestError('UNKNOWN', '出了点小问题，请重试');
    }
  },

  /** 回滚：云端未扣，本地乐观消耗撤销（不可变，仅减当日计数；残留由首页权威拉取纠正） */
  rollbackOptimisticConsume() {
    const state = normalizeQuotaState(wx.getStorageSync('quota'));
    const rolledBack: QuotaState = { ...state, dailyCount: Math.max(0, state.dailyCount - 1) };
    wx.setStorageSync('quota', rolledBack);
  },

  /** 结算统一出口（成功/失败都走这里，进度拉满后跳转） */
  async complete(promise: Promise<DrawOutcome>) {
    const outcome = await promise.then(
      (o) => o,
      (err: unknown) => {
        console.warn('[analyzing] 抽签失败：', err instanceof RequestError ? err.code : err);
        // 保留具体原因（配额用尽/超时/网络），别让通用文案吞掉
        this.failReason =
          err instanceof RequestError && err.userMessage ? err.userMessage : '';
        return null;
      },
    );
    if (this.settled || !this.alive) return; // 已结算或页面已卸载
    this.settled = true;
    clearTimeout(this.watchdogTimer);
    clearInterval(this.progressTimer);
    this.setData({ progress: 100 });

    setTimeout(() => this.finish(outcome), 500);
  },

  finish(outcome: DrawOutcome | null) {
    if (this.data.done || !this.alive) return;
    this.setData({ done: true });

    const app = getApp();
    if (!outcome) {
      // 失败：不落假记录，回拍摄页并给出可读原因（配额/超时等具体信息）
      wx.showToast({ title: this.failReason || '抽签失败了，请重试一次', icon: 'none', duration: 2500 });
      setTimeout(() => wx.redirectTo({ url: '/pages/capture/capture' }), 1400);
      this.clearPending();
      return;
    }

    app.globalData.pendingReport = outcome.report;
    const record: AnalysisRecord = {
      // 云端记录 id 对齐缓存（云函数未回传时回退本地前缀）
      _id: outcome.id || `local-${Date.now()}`,
      hand: app.globalData.pendingHand,
      result: outcome.report,
      modelVersion: CONFIG.ENGINE_VERSION,
      createdAt: Date.now(),
    };
    this.saveRecord(record);
    app.globalData.reportId = record._id;
    this.clearPending();

    wx.redirectTo({ url: '/pages/report/report' });
  },

  /** 留影即焚：本地预览路径清空（照片从未上传，也不落任何存储） */
  clearPending() {
    const app = getApp();
    app.globalData.pendingImage = '';
    this.setData({ handImage: '' });
  },

  saveRecord(record: AnalysisRecord) {
    const list: AnalysisRecord[] = wx.getStorageSync('reports') || [];
    list.unshift(record);
    // 本地最多留 20 条，避免 storage 膨胀
    wx.setStorageSync('reports', list.slice(0, 20));
  },

  onUnload() {
    this.alive = false;
    clearInterval(this.progressTimer);
    clearInterval(this.factTimer);
    clearTimeout(this.watchdogTimer);
  },

  onShareAppMessage() { triggerShareBonus('forward'); return shareDefault(); },
});
