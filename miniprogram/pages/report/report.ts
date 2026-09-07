import { CONFIG, DISCLAIMER } from '../../config/index';
import { toDimensions, clampScore } from '../../utils/format';
import { callFunction } from '../../utils/request';
import { getNavBelowPx } from '../../utils/nav';
import { demoReport } from '../../utils/draw';
import { shareReport, shareDefault, triggerShareBonus } from '../../utils/share';
import { drawPoster, CanvasRenderingContextLike } from '../../utils/poster';
import { classifyPalmType, classifyByScore } from '../../utils/classify';
import { headFontSizes } from '../../utils/head-fit';
import { REPORT_CONTENT } from '../../data/report-content';
import { PalmType } from '../../data/palm-types';
import { ReportResult, AnalysisRecord } from '../../types/index';

interface SceneView {
  key: 'work' | 'life' | 'mind';
  icon: string;
  title: string;
  en: string;
  traits: string[];
  cautions: string[];
}

function toScenes(body: { scenes?: ReportResult['scenes'] }): SceneView[] {
  if (!body.scenes) return [];
  const meta: Array<Omit<SceneView, 'traits' | 'cautions'>> = [
    { key: 'work', icon: '工', title: '工作', en: 'WORK' },
    { key: 'life', icon: '生', title: '生活', en: 'LIFE' },
    { key: 'mind', icon: '心', title: '身心', en: 'MIND' },
  ];
  return meta
    .map((m) => ({ ...m, traits: body.scenes![m.key].traits, cautions: body.scenes![m.key].cautions }))
    .filter((s) => s.traits.length && s.cautions.length);
}

Page({
  data: {
    navTop: getNavBelowPx(),
    funScore: 0,
    summary: '',
    archetype: '',
    palmType: null as PalmType | null,
    t1NameSize: '68rpx',
    t2Style: 'font-size:26rpx;letter-spacing:0rpx',
    t3Style: 'font-size:26rpx;letter-spacing:0rpx',
    lines: [] as Array<{ key: string; name: string; score: number }>,
    dimensions: [] as ReturnType<typeof toDimensions>,
    scenes: [] as SceneView[],
    advice: [] as string[],
    disclaimer: DISCLAIMER,
    showPoster: false,
    posterReady: false,
  },

  onLoad() {
    // 数据源优先级：刚生成的（globalData）> 按 id 查历史（storage）> 演示报告兜底
    const app = getApp();
    let report: ReportResult = app.globalData.pendingReport || demoReport();
    if (app.globalData.reportId) {
      const list: AnalysisRecord[] = wx.getStorageSync('reports') || [];
      const record = list.find((r) => r._id === app.globalData.reportId);
      if (record) report = record.result;
    }
    app.globalData.pendingReport = null; // 一次性，防止复看旧数据

    // 图鉴类型：三维数值 → 12 型（本地确定性分类；旧记录无三线时按趣味评分兜底）
    const lineScores = {
      heart: clampScore(report.lines?.heart),
      head: clampScore(report.lines?.head),
      life: clampScore(report.lines?.life),
    };
    const palmType = report.lines
      ? classifyPalmType(lineScores)
      : classifyByScore(clampScore(report.funScore));

    // 展示层全部取自内容库：记录只供 lines/funScore；
    // 旧 AI 时代记录的存量文本（含过时措辞）从此不在任何页面渲染
    const body = REPORT_CONTENT[palmType.id];
    // 头部四行铺满：按每行实际文案长度反推字号（占满内容宽、不换行）
    const fit = headFontSizes(palmType);

    this.setData({
      funScore: clampScore(report.funScore),
      summary: body.summary,
      archetype: body.archetype ?? '',
      palmType,
      t1NameSize: `${fit.t1Name}rpx`,
      t2Style: `font-size:${fit.t2}rpx;letter-spacing:${fit.t2Ls}rpx`,
      t3Style: `font-size:${fit.t3}rpx;letter-spacing:${fit.t3Ls}rpx`,
      dimensions: toDimensions(body),
      scenes: toScenes(body),
      advice: body.advice,
      lines: [
        { key: 'heart', name: '感受力', score: lineScores.heart },
        { key: 'head', name: '思考力', score: lineScores.head },
        { key: 'life', name: '行动力', score: lineScores.life },
      ],
    });
  },

  onShareAppMessage() {
    triggerShareBonus('forward');
    const t = this.data.palmType;
    return t
      ? shareReport(this.data.funScore, t.name, t.rarity, t.code)
      : shareDefault();
  },

  onShareTimeline() {
    triggerShareBonus('timeline');
    const t = this.data.palmType;
    const base = t ? shareReport(this.data.funScore, t.name, t.rarity, t.code) : shareDefault();
    return { title: base.title, query: '' };
  },

  // ===== 分享海报 =====
  openPoster() {
    this.setData({ showPoster: true, posterReady: false });
    // 等 wxml 节点渲染后再查 canvas
    setTimeout(() => this.renderPoster(), 50);
  },

  renderPoster() {
    const query = this.createSelectorQuery();
    query.select('#poster').fields({ node: true, size: true });
    query.exec((res) => {
      const { node, width, height } = res[0] as {
        node: WechatMiniprogram.Canvas;
        width: number;
        height: number;
      };
      if (!node) return;
      const dpr = wx.getWindowInfo ? wx.getWindowInfo().pixelRatio : 2;
      node.width = width * dpr;
      node.height = height * dpr;
      const ctx = node.getContext('2d') as unknown as CanvasRenderingContextLike;
      ctx.scale((width * dpr) / 750, (height * dpr) / 1200);

      const t = this.data.palmType;
      drawPoster(ctx, {
        type: t
          ? { no: t.no, name: t.name, rarity: t.rarity, tagline: t.tagline, seal: t.seal, code: t.code }
          : undefined,
        archetype: this.data.archetype || '稳扎稳打的实干家',
        funScore: this.data.funScore,
        lines: this.data.lines.map((l) => ({ name: l.name, score: l.score })),
        tags: (this.data.dimensions.find((d) => d.key === 'personality')?.text || '')
          .split(' · ')
          .filter(Boolean),
      });
      this.setData({ posterReady: true });
    });
  },

  savePoster() {
    const query = this.createSelectorQuery();
    query.select('#poster').fields({ node: true });
    query.exec((res) => {
      const { node } = res[0] as { node: WechatMiniprogram.Canvas };
      wx.canvasToTempFilePath({
        canvas: node,
        success: (out) => {
          wx.saveImageToPhotosAlbum({
            filePath: out.tempFilePath,
            success: () => {
              // 海报→朋友圈等效分享（iOS 无"分享到朋友圈"接口，存海报手动发是主路径）：挂 timeline 奖励
              this.grantTimelineViaPoster();
            },
            fail: (err) => {
              if (String(err.errMsg).includes('auth')) {
                wx.showModal({
                  title: '需要相册权限',
                  content: '请在设置中开启「保存到相册」权限后重试',
                  confirmText: '去设置',
                  success: (r) => r.confirm && wx.openSetting(),
                });
              } else {
                wx.showToast({ title: '保存失败，请重试', icon: 'none' });
              }
            },
          });
        },
        fail: () => wx.showToast({ title: '海报生成失败', icon: 'none' }),
      });
    });
  },

  closePoster() { this.setData({ showPoster: false }); },

  /** 保存海报 → 朋友圈渠道 +3（与菜单"分享到朋友圈"共用 timeline 每日限次，防刷一致） */
  async grantTimelineViaPoster() {
    try {
      const data = await callFunction<{ granted: number; remaining: number }>(CONFIG.FN_ANALYZE, {
        action: 'shareBonus',
        channel: 'timeline',
      });
      if (data.granted > 0) {
        wx.showToast({ title: '海报已保存 · 朋友圈奖励 +3，去晒吧', icon: 'none', duration: 2500 });
      } else {
        wx.showToast({ title: '海报已保存到相册（今日朋友圈奖励已领完）', icon: 'none', duration: 2200 });
      }
    } catch {
      wx.showToast({ title: '已保存到相册', icon: 'success' });
    }
  },

  goHistory() { wx.navigateTo({ url: '/pages/history/history' }); },
  goCollection() { wx.navigateTo({ url: '/pages/collection/collection' }); },
  goIndex() { wx.reLaunch({ url: '/pages/index/index' }); },
  noop() { /* 阻止弹层冒泡 */ },
});
