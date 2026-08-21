import { DISCLAIMER } from '../../config/index';
import { clampScore } from '../../utils/format';
import { classifyPalmType, classifyByScore } from '../../utils/classify';
import { PALM_TYPE_LIST } from '../../data/palm-types';
import { PalmType } from '../../data/palm-types';
import { shareCollection, triggerShareBonus } from '../../utils/share';
import { fetchHistory, getCachedHistory } from '../../utils/history-store';
import { getNavBelowPx } from '../../utils/nav';
import { AnalysisRecord } from '../../types/index';

interface TypeCard extends PalmType {
  unlocked: boolean;
}

Page({
  data: {
    navTop: getNavBelowPx(),
    types: [] as TypeCard[],
    unlockedCount: 0,
    total: PALM_TYPE_LIST.length,
    showDetail: false,
    detail: null as TypeCard | null,
    disclaimer: DISCLAIMER,
  },

  onShow() {
    // 解锁来源 = 云端历史缓存（与历史页同源；分类保持本地确定性映射，模型不参与）
    this.renderUnlocks(getCachedHistory());
    fetchHistory()
      .then((list) => this.renderUnlocks(list))
      .catch(() => { /* 云端失败：缓存已渲染 */ });
  },

  renderUnlocks(list: AnalysisRecord[]) {
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
