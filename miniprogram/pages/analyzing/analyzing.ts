import { CONFIG } from '../../config/index';
import { shareDefault, triggerShareBonus } from '../../utils/share';
import { callFunction, RequestError } from '../../utils/request';
import { consumeQuota, normalizeQuotaState, type QuotaState } from '../../utils/quota';
import type { ReportResult, AnalysisRecord } from '../../types/index';

/** 掩盖 8-15s 等待的趣味知识轮播（文案合规：无运/命/吉凶表述） */
const FACTS = [
  '掌纹在胎儿期约第 13 周就已成形，此后终生基本不变——你的三条主线是名副其实的"出厂设置"。',
  '世界上找不到两张完全相同的手掌：就算同卵双胞胎，掌纹也各不相同。',
  '掌纹其实是皮肤为了方便手部弯曲产生的褶皱，长期握持工具的人，纹路通常更深。',
  '三条主线的深浅长短因人而异，所谓解读，是把形态差异翻译成性格倾向的趣味描述。',
  '民间常说"男左女右"，但两只手的掌纹并不相同，各自独一无二——想读得最清楚，拍你最灵活的那只手就好。',
];

/** 进度节奏：前 8s 冲到 85%，之后 30s 缓爬至 95% 封顶；云端返回后由 complete 拉满 */
const FAST_MS = 8_000;
const FAST_PCT = 85;
const SLOW_MS = 30_000;
const SLOW_PCT = 95;
/** 看门狗：超过此时长云端未回按失败处理（云函数超时上限 60s，提前留量） */
const WATCHDOG_MS = 45_000;

/** 云函数返回的分析结果信封（fallback 分流本地消费面；id 对齐云端记录） */
interface AnalyzeOutcome {
  report: ReportResult;
  fallback: boolean;
  id?: string;
}

Page({
  data: {
    progress: 0,
    facts: FACTS,
    factIndex: 0,
    done: false,
    handImage: '',
    handText: '右手',
    slowHint: '',
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
      let pct: number;
      if (el <= FAST_MS) {
        pct = (el / FAST_MS) * FAST_PCT;
      } else {
        pct = FAST_PCT + Math.min(SLOW_PCT - FAST_PCT, ((el - FAST_MS) / SLOW_MS) * (SLOW_PCT - FAST_PCT));
      }
      // 只增不减；不触达 100（100 由云端回调驱动）
      if (Math.round(pct) > this.data.progress) this.setData({ progress: Math.round(pct) });
      if (el > FAST_MS + 6_000 && !this.data.slowHint) {
        this.setData({ slowHint: '这次读得有点慢，再等等…' });
      }
    }, 400);

    this.factTimer = setInterval(() => {
      this.setData({ factIndex: (this.data.factIndex + 1) % FACTS.length });
    }, CONFIG.FACT_INTERVAL);

    // 看门狗：超时按失败处理，避免无限等待
    this.watchdogTimer = setTimeout(() => {
      if (!this.settled) this.complete(Promise.reject(new RequestError('MODEL_TIMEOUT', '解读超时了，请重试一次')));
    }, WATCHDOG_MS);

    this.complete(this.fetchReport());
  },

  async fetchReport(): Promise<AnalyzeOutcome> {
    const app = getApp();
    const fileID = app.globalData.pendingFileID;
    try {
      if (!fileID) throw new RequestError('UNKNOWN', '缺少图片，请重新拍摄');
      const data = await callFunction<{ report: ReportResult; remaining?: number; fallback?: boolean; id?: string }>(CONFIG.FN_ANALYZE, {
        action: 'analyze',
        fileID,
        hand: app.globalData.pendingHand,
      });
      // 本地乐观消耗一次；云端权威值由首页 onShow 拉取修正；
      // 兜底不扣配额（云端 users 零写入，spec: analysis-fallback）→ 本地回滚这次乐观消耗
      wx.setStorageSync('quota', consumeQuota(normalizeQuotaState(wx.getStorageSync('quota'))));
      if (data.fallback === true) this.rollbackOptimisticConsume();
      return { report: data.report, fallback: data.fallback === true, id: data.id };
    } catch (err) {
      // 配额用尽/服务异常：不降级 mock（真实数据才有意义），上抛给 complete 统一处理
      if (err instanceof RequestError) {
        console.warn('[analyzing] 云端返回错误：', err.code);
        throw err;
      }
      console.warn('[analyzing] 未知错误：', err);
      throw new RequestError('UNKNOWN', '出了点小问题，请重试');
    }
  },

  /** 兜底回滚：云端未扣，本地乐观消耗撤销（不可变，仅减当日计数；残留由首页权威拉取纠正） */
  rollbackOptimisticConsume() {
    const state = normalizeQuotaState(wx.getStorageSync('quota'));
    const rolledBack: QuotaState = { ...state, dailyCount: Math.max(0, state.dailyCount - 1) };
    wx.setStorageSync('quota', rolledBack);
  },

  /** 云端回调统一出口（成功/失败都走这里，进度拉满后结算） */
  async complete(promise: Promise<AnalyzeOutcome>) {
    const outcome = await promise.then(
      (o) => o,
      (err: unknown) => {
        console.warn('[analyzing] 云端失败：', err instanceof RequestError ? err.code : err);
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
    this.setData({ progress: 100, slowHint: '' });

    setTimeout(() => this.finish(outcome), 500);
  },

  finish(outcome: AnalyzeOutcome | null) {
    if (this.data.done || !this.alive) return;
    this.setData({ done: true });

    const app = getApp();
    if (!outcome) {
      // 失败：不落假记录，回拍摄页并给出可读原因（配额/超时等具体信息）
      wx.showToast({ title: this.failReason || '解读失败了，请重试一次', icon: 'none', duration: 2500 });
      setTimeout(() => wx.redirectTo({ url: '/pages/capture/capture' }), 1400);
      this.clearPending();
      return;
    }

    app.globalData.pendingReport = outcome.report;
    app.globalData.pendingFallback = outcome.fallback;
    if (outcome.fallback) {
      // 兜底不进本地消费面：不落历史（图鉴解锁随之无来源）；清掉旧 reportId 防止报告页按旧记录复看
      app.globalData.reportId = '';
    } else {
      const record: AnalysisRecord = {
        // 云端记录 id 对齐缓存（旧云函数未回传时回退本地前缀）
        _id: outcome.id || `local-${Date.now()}`,
        hand: app.globalData.pendingHand,
        result: outcome.report,
        modelVersion: CONFIG.MODEL_VERSION,
        createdAt: Date.now(),
      };
      this.saveRecord(record);
      app.globalData.reportId = record._id;
    }
    this.clearPending();

    wx.redirectTo({ url: '/pages/report/report' });
  },

  /** 手掌图即焚：本地预览路径与云 fileID 引用一并清空 */
  clearPending() {
    const app = getApp();
    app.globalData.pendingImage = '';
    app.globalData.pendingFileID = '';
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
