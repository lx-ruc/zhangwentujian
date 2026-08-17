import { DISCLAIMER } from '../../config/index';
import { formatDateTime, clampScore } from '../../utils/format';
import { shareHistory } from '../../utils/share';
import type { AnalysisRecord } from '../../types/index';

Page({
  data: {
    records: [] as Array<{
      id: string;
      date: string;
      hand: string;
      digest: string;
      tags: string[];
      score: number;
    }>,
    disclaimer: DISCLAIMER,
  },

  onShow() {
    // Phase 2 联调时改读云数据库 analyses 集合；当前读本地 storage
    const list: AnalysisRecord[] = wx.getStorageSync('reports') || [];
    this.setData({
      records: list.map((r) => ({
        id: r._id,
        date: formatDateTime(r.createdAt),
        hand: r.hand === 'left' ? '左手' : '右手',
        digest: (r.result.summary || '').slice(0, 52),
        tags: (r.result.personality || []).slice(0, 3),
        score: clampScore(r.result.funScore),
      })),
    });
  },

  openRecord(e: WechatMiniprogram.TouchEvent) {
    const app = getApp();
    app.globalData.reportId = e.currentTarget.dataset.id as string;
    app.globalData.pendingReport = null;
    wx.navigateTo({ url: '/pages/report/report' });
  },

  goCapture() { wx.redirectTo({ url: '/pages/capture/capture' }); },

  onShareAppMessage: () => shareHistory((wx.getStorageSync('reports') || []).length),
});
