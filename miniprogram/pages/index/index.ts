import { CONFIG, DISCLAIMER } from '../../config/index';
import { remainingQuota, type QuotaState, initialQuotaState } from '../../utils/quota';
import { shareDefault } from '../../utils/share';

Page({
  data: {
    remaining: Number(CONFIG.DAILY_QUOTA),
    disclaimer: DISCLAIMER,
  },

  onShow() {
    // Phase 1 静态阶段：读本地缓存模拟配额；Phase 2 接云函数后端配额
    const state: QuotaState = wx.getStorageSync('quota') || initialQuotaState();
    this.setData({
      remaining: remainingQuota(state, new Date(), CONFIG.DAILY_QUOTA),
    });
  },

  goCapture() { wx.navigateTo({ url: '/pages/capture/capture' }); },

  onShareAppMessage: () => shareDefault(),
  onShareTimeline: () => ({ title: shareDefault().title }),
  goHistory() { wx.navigateTo({ url: '/pages/history/history' }); },
  goAbout() { wx.navigateTo({ url: '/pages/about/about' }); },
});
