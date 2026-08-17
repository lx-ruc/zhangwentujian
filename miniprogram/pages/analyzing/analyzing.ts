import { CONFIG } from '../../config/index';

/** 掩盖 8-15s 等待的趣味知识轮播（文案合规：无运/命/吉凶表述） */
const FACTS = [
  '掌纹在胎儿期约第 13 周就已成形，此后终生基本不变——你的三条主线是名副其实的"出厂设置"。',
  '世界上找不到两张完全相同的手掌：就算同卵双胞胎，掌纹也各不相同。',
  '掌纹其实是皮肤为了方便手部弯曲产生的褶皱，长期握持工具的人，纹路通常更深。',
  '三条主线的深浅长短因人而异，所谓解读，是把形态差异翻译成性格倾向的趣味描述。',
];

Page({
  data: {
    progress: 0,
    facts: FACTS,
    factIndex: 0,
    done: false,
  },

  factTimer: 0 as unknown as ReturnType<typeof setTimeout>,
  progressTimer: 0 as unknown as ReturnType<typeof setInterval>,

  onLoad() {
    // Phase 1：本地模拟解读进度；Phase 2 换成真实云函数调用
    const startedAt = Date.now();
    const TOTAL = 10_000;
    this.progressTimer = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - startedAt) / TOTAL) * 100);
      this.setData({ progress: Math.round(pct) });
      if (pct >= 100) {
        clearInterval(this.progressTimer);
        this.setData({ done: true });
        setTimeout(() => this.finish(), 600);
      }
    }, 400);

    this.factTimer = setInterval(() => {
      const next = (this.data.factIndex + 1) % FACTS.length;
      this.setData({ factIndex: next });
    }, CONFIG.FACT_INTERVAL);
  },

  finish() {
    getApp().globalData.reportId = 'mock';
    wx.redirectTo({ url: '/pages/report/report' });
  },

  onUnload() {
    clearInterval(this.progressTimer);
    clearInterval(this.factTimer);
  },
});
