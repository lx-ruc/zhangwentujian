import { CONFIG, DISCLAIMER } from '../../config/index';
import { remainingQuota, normalizeQuotaState, QuotaState } from '../../utils/quota';
import { callFunction } from '../../utils/request';
import { shareDefault, isIOS } from '../../utils/share';
import { isDevEnv } from '../../utils/env';
import { getNavTopPx } from '../../utils/nav';

Page({
  data: {
    navTop: getNavTopPx(),
    remaining: Number(CONFIG.DAILY_QUOTA),
    disclaimer: DISCLAIMER,
    /** 配额用完时 CTA 切换为分享解锁 */
    exhausted: false,
    exhaustedTip: '',
  },

  onShow() {
    // 开发版不限次：直接满额展示（本地缓存与云端权威值都不看）
    if (isDevEnv()) {
      this.refreshRemaining(Number(CONFIG.DAILY_QUOTA));
      return;
    }
    // 展示层：本地缓存先行，再异步拉云端权威配额（含分享奖励）
    const state = normalizeQuotaState(wx.getStorageSync('quota'));
    this.refreshRemaining(remainingQuota(state, new Date(), CONFIG.DAILY_QUOTA));
    this.syncCloudQuota();
  },

  refreshRemaining(n: number) {
    this.setData({
      remaining: n,
      exhausted: n <= 0,
      exhaustedTip: isIOS()
        ? '今日次数已用完 · 转发好友每天可 +2 次'
        : '今日次数已用完 · 转发好友 +1 次/天2次 · 朋友圈 +3',
    });
  },

  async syncCloudQuota() {
    if (isDevEnv()) return; // 开发版不拉云端配额
    try {
      const data = await callFunction<{ remaining: number }>(CONFIG.FN_ANALYZE, { action: 'quota' });
      if (typeof data.remaining === 'number') {
        this.refreshRemaining(data.remaining);
        // 回写本地展示缓存（used = capacity - remaining，bonus 保持本地）
        const state = normalizeQuotaState(wx.getStorageSync('quota'));
        const today = new Date();
        const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const bonus = state.bonusDate === ymd ? state.bonus : 0;
        wx.setStorageSync('quota', {
          dailyCount: Math.max(0, CONFIG.DAILY_QUOTA + bonus - data.remaining),
          lastUsedDate: ymd,
          bonus,
          bonusDate: ymd,
        } as QuotaState);
      }
    } catch {
      // 云端不可用：本地展示层继续
    }
  },

  /** 分享奖励：转发 +1（每日 2 次）。onShareAppMessage 触发即调云端记账 */
  async grantForwardBonus() {
    await this.requestBonus('forward');
  },

  /** 分享奖励：朋友圈 +3（每日 1 次，仅 Android 有该入口） */
  async grantTimelineBonus() {
    await this.requestBonus('timeline');
  },

  async requestBonus(channel: 'forward' | 'timeline') {
    try {
      const data = await callFunction<{ granted: number; remaining: number }>(CONFIG.FN_ANALYZE, {
        action: 'shareBonus',
        channel,
      });
      if (data.granted > 0) {
        wx.showToast({ title: `分享成功 +${data.granted} 次`, icon: 'none' });
        this.refreshRemaining(data.remaining);
        // 本地 bonus 同步（展示层）
        const state = normalizeQuotaState(wx.getStorageSync('quota'));
        const now = new Date();
        const ymd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const bonusBase = state.bonusDate === ymd ? state.bonus : 0;
        wx.setStorageSync('quota', {
          ...state,
          bonus: bonusBase + data.granted,
          bonusDate: ymd,
        });
      } else {
        wx.showToast({ title: '今日分享奖励已领完，明天再来', icon: 'none' });
      }
    } catch {
      wx.showToast({ title: '网络不稳定，奖励稍后到账', icon: 'none' });
    }
  },

  onShareAppMessage() {
    this.grantForwardBonus(); // fire-and-forget，不阻塞分享面板
    return shareDefault();
  },

  onShareTimeline() {
    this.grantTimelineBonus();
    return { title: shareDefault().title };
  },

  goCapture() {
    if (this.data.exhausted) {
      // 配额用完：CTA 是分享按钮（open-type=share），不会走到这；防御兜底
      wx.showToast({ title: '今日次数已用完，分享可解锁更多', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/capture/capture' });
  },
  goCollection() { wx.navigateTo({ url: '/pages/collection/collection' }); },
  goHistory() { wx.navigateTo({ url: '/pages/history/history' }); },
  goAbout() { wx.navigateTo({ url: '/pages/about/about' }); },
});
