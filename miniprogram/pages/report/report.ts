import { CONFIG, DISCLAIMER } from '../../config/index';
import { toDimensions, clampScore } from '../../utils/format';
import { MOCK_REPORT } from '../../utils/mock-report';
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
    return {
      title: `我的掌纹趣味评分 ${this.data.funScore} 分，你猜你的多少？`,
      path: '/pages/index/index',
    };
  },

  goHistory() { wx.navigateTo({ url: '/pages/history/history' }); },
  goIndex() { wx.reLaunch({ url: '/pages/index/index' }); },
});
