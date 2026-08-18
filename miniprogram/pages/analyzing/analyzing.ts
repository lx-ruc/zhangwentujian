import { CONFIG } from '../../config/index';
import { shareDefault } from '../../utils/share';
import { callFunction, RequestError } from '../../utils/request';
import { todayKey, type QuotaState } from '../../utils/quota';
import type { ReportResult, AnalysisRecord } from '../../types/index';

/** 掩盖 8-15s 等待的趣味知识轮播（文案合规：无运/命/吉凶表述） */
const FACTS = [
  '掌纹在胎儿期约第 13 周就已成形，此后终生基本不变——你的三条主线是名副其实的"出厂设置"。',
  '世界上找不到两张完全相同的手掌：就算同卵双胞胎，掌纹也各不相同。',
  '掌纹其实是皮肤为了方便手部弯曲产生的褶皱，长期握持工具的人，纹路通常更深。',
  '三条主线的深浅长短因人而异，所谓解读，是把形态差异翻译成性格倾向的趣味描述。',
  '民间常说"男左女右"，但两只手的掌纹并不相同，各自独一无二——想读得最清楚，拍你最灵活的那只手就好。',
];

/** 本地进度动画时长（真实云端通常 8-15s，联调后改为跟随真实回调） */
const PROGRESS_TOTAL = 8_000;

Page({
  data: {
    progress: 0,
    facts: FACTS,
    factIndex: 0,
    done: false,
    handImage: '',
    handText: '右手',
  },

  factTimer: 0 as unknown as ReturnType<typeof setInterval>,
  progressTimer: 0 as unknown as ReturnType<typeof setInterval>,
  reportPromise: null as null | Promise<ReportResult>,

  onLoad() {
    const app = getApp();
    this.setData({
      handImage: app.globalData.pendingImage,
      handText: app.globalData.pendingHand === 'left' ? '左手' : '右手',
    });

    // 云函数真实调用（失败在 finish 统一兜底提示）
    this.reportPromise = this.fetchReport();

    const startedAt = Date.now();
    this.progressTimer = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - startedAt) / PROGRESS_TOTAL) * 100);
      this.setData({ progress: Math.round(pct) });
      if (pct >= 100) {
        clearInterval(this.progressTimer);
        this.finish();
      }
    }, 400);

    this.factTimer = setInterval(() => {
      this.setData({ factIndex: (this.data.factIndex + 1) % FACTS.length });
    }, CONFIG.FACT_INTERVAL);
  },

  async fetchReport(): Promise<ReportResult> {
    const app = getApp();
    const fileID = app.globalData.pendingFileID;
    try {
      if (!fileID) throw new RequestError('UNKNOWN', '缺少图片，请重新拍摄');
      const data = await callFunction<{ report: ReportResult; remaining?: number }>(CONFIG.FN_ANALYZE, {
        action: 'analyze',
        fileID,
        hand: app.globalData.pendingHand,
      });
      // 云端权威配额回写本地展示层
      if (typeof data.remaining === 'number') {
        const used = Math.max(0, CONFIG.DAILY_QUOTA - data.remaining);
        const state: QuotaState = { dailyCount: used, lastUsedDate: todayKey() };
        wx.setStorageSync('quota', state);
      }
      return data.report;
    } catch (err) {
      // 配额用尽/服务异常：不降级 mock（真实数据才有意义），上抛给 finish 统一处理
      if (err instanceof RequestError) {
        console.warn('[analyzing] 云端返回错误：', err.code);
        throw err;
      }
      console.warn('[analyzing] 未知错误：', err);
      throw new RequestError('UNKNOWN', '出了点小问题，请重试');
    }
  },

  async finish() {
    if (this.data.done) return;
    this.setData({ done: true });

    const app = getApp();
    const report = await this.reportPromise!.catch((err: unknown) => {
      // 失败回拍摄页并给出可读原因（不进报告页、不落假记录）
      const msg = err instanceof RequestError ? err.userMessage : '出了点小问题，请重试';
      wx.showToast({ title: msg, icon: 'none', duration: 2500 });
      setTimeout(() => wx.redirectTo({ url: '/pages/capture/capture' }), 1200);
      this.clearPending();
      return null;
    });
    if (!report) return;

    const record: AnalysisRecord = {
      _id: `local-${Date.now()}`,
      hand: app.globalData.pendingHand,
      result: report,
      modelVersion: CONFIG.MODEL_VERSION,
      createdAt: Date.now(),
    };
    this.saveRecord(record);

    app.globalData.pendingReport = report;
    app.globalData.reportId = record._id;
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
    clearInterval(this.progressTimer);
    clearInterval(this.factTimer);
  },

  onShareAppMessage: () => shareDefault(),
});
