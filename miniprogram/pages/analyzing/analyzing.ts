import { CONFIG } from '../../config/index';
import { callFunction, RequestError } from '../../utils/request';
import { consumeQuota, initialQuotaState, type QuotaState } from '../../utils/quota';
import { MOCK_REPORT } from '../../utils/mock-report';
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

    // 云函数真实调用：未部署/失败时自动降级 mock（前端零改动等 Phase 2 接通）
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
    try {
      const data = await callFunction<{ report: ReportResult }>(CONFIG.FN_ANALYZE, {
        action: 'analyze',
        // Phase 2：换 fileID（wx.cloud.uploadFile 之后）
        imageLocal: true,
        hand: app.globalData.pendingHand,
      });
      return data.report;
    } catch (err) {
      // 云函数未部署 / 无 Key / 网络——本地降级，保证链路可体验
      if (err instanceof RequestError) {
        console.warn('[analyzing] 云端不可用，降级 mock：', err.code);
      } else {
        console.warn('[analyzing] 未知错误，降级 mock：', err);
      }
      return MOCK_REPORT;
    }
  },

  async finish() {
    if (this.data.done) return;
    this.setData({ done: true });

    const app = getApp();
    const report = await this.reportPromise!.catch(() => MOCK_REPORT);
    const record: AnalysisRecord = {
      _id: `local-${Date.now()}`,
      hand: app.globalData.pendingHand,
      result: report,
      modelVersion: CONFIG.MODEL_VERSION,
      createdAt: Date.now(),
    };
    this.saveRecord(record);

    // 消耗本地配额（权威配额在云端，Phase 2 对齐）
    const q: QuotaState = wx.getStorageSync('quota') || initialQuotaState();
    wx.setStorageSync('quota', consumeQuota(q));

    app.globalData.pendingReport = report;
    app.globalData.reportId = record._id;
    // 手掌图即焚：用完立刻清引用
    app.globalData.pendingImage = '';
    this.setData({ handImage: '' });

    wx.redirectTo({ url: '/pages/report/report' });
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
});
