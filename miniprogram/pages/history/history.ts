import { DISCLAIMER } from '../../config/index';
import { formatDateTime } from '../../utils/format';

interface HistoryItem {
  id: string;
  date: string;
  hand: string;
  digest: string;
  tags: string[];
  score: number;
}

Page({
  data: {
    records: [] as HistoryItem[],
    disclaimer: DISCLAIMER,
  },

  onShow() {
    // Phase 1：本地缓存 mock；Phase 2 读云数据库 analyses 集合
    const cached: HistoryItem[] = wx.getStorageSync('history') || [];
    if (cached.length) {
      this.setData({ records: cached });
      return;
    }
    const mock: HistoryItem[] = [
      {
        id: 'demo-1',
        date: formatDateTime(Date.now() - 3600_000),
        hand: '右手',
        digest: '纹路清晰深长，稳中带劲的节奏感：想得清楚、做得踏实，靠谱担当。',
        tags: ['沉稳务实', '慢热长情'],
        score: 87,
      },
      {
        id: 'demo-2',
        date: formatDateTime(Date.now() - 86400_000),
        hand: '左手',
        digest: '情感线平缓内敛，细水长流型；活力线饱满，行动力在线。',
        tags: ['细水长流', '行动派'],
        score: 81,
      },
    ];
    this.setData({ records: mock });
  },

  openRecord(e: WechatMiniprogram.TouchEvent) {
    getApp().globalData.reportId = e.currentTarget.dataset.id as string;
    wx.navigateTo({ url: '/pages/report/report' });
  },

  goCapture() { wx.redirectTo({ url: '/pages/capture/capture' }); },
});
