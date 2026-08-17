import { CONFIG, DISCLAIMER } from '../../config/index';
import { toDimensions, clampScore, formatDateTime } from '../../utils/format';
import type { ReportResult } from '../../types/index';

/** Phase 1 mock 报告（合规措辞：倾向性表述，无运/命/吉凶词） */
const MOCK: ReportResult & { createdAt: number } = {
  summary:
    '整体纹路清晰深长，三条主线走向分明。你的掌心透着一股稳中带劲的节奏感：想得清楚、做得踏实，情绪来得慢去得也慢，是朋友圈里公认的"靠谱担当"。以上为趣味解读，仅供参考。',
  personality: ['沉稳务实', '慢热长情', '暗中较劲'],
  career: '思维线深长清晰，倾向逻辑驱动型选手：适合需要专注与规划的工作，遇到难题反而来劲。',
  love: '情感线走势平缓，情感表达偏内敛：不擅长甜言蜜语，但认定了就很少动摇，属于细水长流型。',
  wealth: '活力线弧度饱满，行动力在线：财务上倾向稳扎稳打，比起一夜暴富更喜欢看得见的积累。',
  funScore: 87,
  advice: [
    '给自己留一段"不务正业"的时间，灵感往往从那里来。',
    '重要决定睡一觉再做，你的第二天判断力通常更准。',
    '情绪内敛是优点，但偶尔把话说出口，关系会更近一步。',
  ],
  lines: { heart: 85, head: 72, life: 78 },
  createdAt: Date.now(),
};

Page({
  data: {
    funScore: 0,
    summary: '',
    lines: [] as Array<{ key: string; name: string; desc: string; score: number }>,
    dimensions: [] as ReturnType<typeof toDimensions>,
    advice: [] as string[],
    handText: '右手',
    modelVersion: CONFIG.MODEL_VERSION,
    disclaimer: DISCLAIMER,
  },

  onLoad() {
    const report = MOCK;
    this.setData({
      funScore: clampScore(report.funScore),
      summary: report.summary,
      dimensions: toDimensions(report),
      advice: report.advice,
      handText: getApp().globalData.pendingHand === 'left' ? '左手' : '右手',
      lines: [
        { key: 'heart', name: '情感线', desc: '情感表达', score: clampScore(report.lines?.heart) },
        { key: 'head', name: '思维线', desc: '思维风格', score: clampScore(report.lines?.head) },
        { key: 'life', name: '活力线', desc: '活力状态', score: clampScore(report.lines?.life) },
      ],
    });
    console.log('报告时间', formatDateTime(report.createdAt));
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
