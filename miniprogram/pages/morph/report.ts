import { MORPH_TYPES, MorphType } from '../../data/morph-types';
import { demoMetrics, MorphMetrics } from '../../utils/morphology';
import { shareDefault, shareMorph, triggerShareBonus } from '../../utils/share';
import { getNavTopPx } from '../../utils/nav';
import { DISCLAIMER } from '../../config/index';

/** 展示条（0-100，由指标换算） */
interface MetricBar {
  key: string;
  label: string;
  en: string;
  pct: number;
}

/** 指标 → 展示百分比（换算仅为可视化，分档阈值以 morphology.ts 为准） */
function toBars(m: MorphMetrics): MetricBar[] {
  return [
    { key: 'clarity', label: '纹路清晰度', en: 'CLARITY', pct: Math.min(100, Math.round(m.clarity * 160)) },
    { key: 'density', label: '细纹密度', en: 'DENSITY', pct: Math.min(100, Math.round(m.density * 90)) },
    { key: 'coherence', label: '走向聚合度', en: 'COHERENCE', pct: Math.round(m.coherence * 100) },
  ];
}

Page({
  data: {
    navTop: getNavTopPx(),
    type: null as MorphType | null,
    bars: [] as MetricBar[],
    metrics: null as MorphMetrics | null,
    fromDemo: false,
    disclaimer: DISCLAIMER,
  },

  onLoad() {
    const pending = getApp().globalData.pendingMorph;
    const metrics = pending ? pending.metrics : demoMetrics();
    const id = pending ? pending.id : 'mid-sparse-aligned';
    const type = MORPH_TYPES[id] || MORPH_TYPES['mid-sparse-aligned'];
    this.setData({ type, bars: toBars(metrics), metrics, fromDemo: !pending });
  },

  /** 再测一张 */
  goCapture() {
    wx.redirectTo({ url: '/pages/capture/capture' });
  },

  /** 抽一支人格签（明示随机、与掌纹无关的独立娱乐模块） */
  goDraw() {
    wx.redirectTo({ url: '/pages/analyzing/analyzing?mode=draw' });
  },

  goCollection() {
    wx.navigateTo({ url: '/pages/collection/collection' });
  },

  goIndex() {
    wx.reLaunch({ url: '/pages/index/index' });
  },

  onShareAppMessage() {
    triggerShareBonus('forward');
    const t = this.data.type;
    return t ? shareMorph(t.name, t.rarity) : shareDefault();
  },
});
