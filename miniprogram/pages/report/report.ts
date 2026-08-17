import { CONFIG, DISCLAIMER } from '../../config/index';
import { toDimensions, clampScore } from '../../utils/format';
import { MOCK_REPORT } from '../../utils/mock-report';
import { shareReport, shareDefault } from '../../utils/share';
import { drawPoster, type CanvasRenderingContextLike, type CanvasImageLike } from '../../utils/poster';
import type { ReportResult, AnalysisRecord } from '../../types/index';

interface SceneView {
  key: 'work' | 'life' | 'mind';
  icon: string;
  title: string;
  en: string;
  traits: string[];
  cautions: string[];
}

function toScenes(r: ReportResult): SceneView[] {
  if (!r.scenes) return [];
  const meta: Array<Omit<SceneView, 'traits' | 'cautions'>> = [
    { key: 'work', icon: '工', title: '工作', en: 'WORK' },
    { key: 'life', icon: '生', title: '生活', en: 'LIFE' },
    { key: 'mind', icon: '心', title: '身心', en: 'MIND' },
  ];
  return meta
    .map((m) => ({ ...m, traits: r.scenes![m.key].traits, cautions: r.scenes![m.key].cautions }))
    .filter((s) => s.traits.length && s.cautions.length);
}

Page({
  data: {
    funScore: 0,
    summary: '',
    archetype: '',
    lines: [] as Array<{ key: string; name: string; desc: string; score: number }>,
    dimensions: [] as ReturnType<typeof toDimensions>,
    scenes: [] as SceneView[],
    advice: [] as string[],
    handText: '右手',
    modelVersion: CONFIG.MODEL_VERSION,
    disclaimer: DISCLAIMER,
    showPoster: false,
    posterReady: false,
  },

  onLoad() {
    // 数据源优先级：刚生成的（globalData）> 按 id 查历史（storage）> mock 兜底
    const app = getApp();
    let report: ReportResult = app.globalData.pendingReport || MOCK_REPORT;
    let hand = app.globalData.pendingHand;
    if (app.globalData.reportId) {
      const list: AnalysisRecord[] = wx.getStorageSync('reports') || [];
      const record = list.find((r) => r._id === app.globalData.reportId);
      if (record) {
        report = record.result;
        hand = record.hand;
      }
    }
    app.globalData.pendingReport = null; // 一次性，防止复看旧数据

    this.setData({
      funScore: clampScore(report.funScore),
      summary: report.summary,
      archetype: report.archetype ?? '',
      dimensions: toDimensions(report),
      scenes: toScenes(report),
      advice: report.advice,
      handText: hand === 'left' ? '左手' : '右手',
      lines: [
        { key: 'heart', name: '情感线', desc: '情感表达', score: clampScore(report.lines?.heart) },
        { key: 'head', name: '思维线', desc: '思维风格', score: clampScore(report.lines?.head) },
        { key: 'life', name: '活力线', desc: '活力状态', score: clampScore(report.lines?.life) },
      ],
    });
  },

  onShareAppMessage() {
    const fallback = shareDefault();
    return this.data.archetype
      ? shareReport(this.data.funScore, this.data.archetype)
      : fallback;
  },

  onShareTimeline() {
    const base = this.data.archetype
      ? shareReport(this.data.funScore, this.data.archetype)
      : shareDefault();
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

      const draw = (image: CanvasImageLike | null) => {
        drawPoster(ctx, {
          archetype: this.data.archetype || '稳扎稳打的实干家',
          funScore: this.data.funScore,
          lines: this.data.lines.map((l) => ({ name: l.name, score: l.score })),
          tags: (this.data.dimensions.find((d) => d.key === 'personality')?.text || '')
            .split(' · ')
            .filter(Boolean),
          handImagePath: '/assets/hand-plate.png',
        }, image);
        this.setData({ posterReady: true });
      };

      const img = node.createImage() as unknown as HTMLImageElement & CanvasImageLike;
      img.src = '/assets/hand-plate.png';
      img.onload = () => draw(img);
      img.onerror = () => draw(null);
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
            success: () =>
              wx.showToast({ title: '已保存到相册', icon: 'success' }),
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

  goHistory() { wx.navigateTo({ url: '/pages/history/history' }); },
  goIndex() { wx.reLaunch({ url: '/pages/index/index' }); },
  noop() { /* 阻止弹层冒泡 */ },
});
