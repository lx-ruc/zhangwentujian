import { DISCLAIMER } from '../../config/index';
import { clampScore } from '../../utils/format';
import { classifyPalmType, classifyByScore } from '../../utils/classify';
import { PALM_TYPE_LIST } from '../../data/palm-types';
import type { PalmType } from '../../data/palm-types';
import { shareCollection, triggerShareBonus } from '../../utils/share';
import type { AnalysisRecord } from '../../types/index';

interface TypeCard extends PalmType {
  unlocked: boolean;
}

Page({
  data: {
    types: [] as TypeCard[],
    unlockedCount: 0,
    total: PALM_TYPE_LIST.length,
    showDetail: false,
    detail: null as TypeCard | null,
    disclaimer: DISCLAIMER,
  },

  onShow() {
    // 解锁来源 = 历史记录去重（Phase 2 后同逻辑读云端）
    const list: AnalysisRecord[] = wx.getStorageSync('reports') || [];
    const unlocked: Record<string, true> = {};
    for (const r of list) {
      const t = r.result.lines
        ? classifyPalmType({
            heart: clampScore(r.result.lines.heart),
            head: clampScore(r.result.lines.head),
            life: clampScore(r.result.lines.life),
          })
        : classifyByScore(clampScore(r.result.funScore));
      unlocked[t.id] = true;
    }
    this.setData({
      unlockedCount: Object.keys(unlocked).length,
      types: PALM_TYPE_LIST.map((t) => ({ ...t, unlocked: !!unlocked[t.id] })),
    });
  },

  openType(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    const t = this.data.types.find((x) => x.id === id);
    if (!t) return;
    if (t.unlocked) {
      this.setData({ showDetail: true, detail: t });
    } else {
      wx.showToast({
        title: `尚未解锁 · 掌纹稀有度 ${t.rarity}`,
        icon: 'none',
        duration: 1800,
      });
    }
  },

  closeDetail() { this.setData({ showDetail: false }); },
  noop() { /* 阻止弹层冒泡 */ },
  goCapture() { wx.redirectTo({ url: '/pages/capture/capture' }); },

  onShareAppMessage() {
    triggerShareBonus('forward');
    return shareCollection(this.data.unlockedCount ?? 0);
  },
});
