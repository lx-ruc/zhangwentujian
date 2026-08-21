import { DISCLAIMER } from '../../config/index';
import { formatDateTime, clampScore } from '../../utils/format';
import { shareHistory, triggerShareBonus } from '../../utils/share';
import { classifyPalmType, classifyByScore } from '../../utils/classify';
import { fetchHistory, getCachedHistory } from '../../utils/history-store';
import { getNavBelowPx } from '../../utils/nav';
import { AnalysisRecord } from '../../types/index';

Page({
  data: {
    navTop: getNavBelowPx(),
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
    // 缓存即时上屏，后台拉云端权威数据（整表替换缓存后重绘；失败静默——缓存已在屏上）
    this.renderRecords(getCachedHistory());
    fetchHistory()
      .then((list) => this.renderRecords(list))
      .catch(() => { /* 云端失败不打扰：断网也能看历史 */ });
  },

  renderRecords(list: AnalysisRecord[]) {
    this.setData({
      records: list.map((r) => {
        const t = r.result.lines
          ? classifyPalmType({
              heart: clampScore(r.result.lines.heart),
              head: clampScore(r.result.lines.head),
              life: clampScore(r.result.lines.life),
            })
          : classifyByScore(clampScore(r.result.funScore));
        return {
          id: r._id,
          date: formatDateTime(r.createdAt),
          hand: r.hand === 'left' ? '左手' : '右手',
          digest: (r.result.summary || '').slice(0, 52),
          tags: [t.name, ...(r.result.personality || []).slice(0, 2)],
          score: clampScore(r.result.funScore),
        };
      }),
    });
  },

  openRecord(e: WechatMiniprogram.TouchEvent) {
    const app = getApp();
    app.globalData.reportId = e.currentTarget.dataset.id as string;
    app.globalData.pendingReport = null;
    wx.navigateTo({ url: '/pages/report/report' });
  },

  goCapture() { wx.redirectTo({ url: '/pages/capture/capture' }); },

  onShareAppMessage() { triggerShareBonus('forward'); return shareHistory((wx.getStorageSync('reports') || []).length); },
});
