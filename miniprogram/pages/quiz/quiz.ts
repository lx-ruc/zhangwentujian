/**
 * 掌纹问答页 —— 六题逐线选择 → 匹配 12 型人格签
 * 相机已删除（2026-09-08 第四次拒审后转向）：答案即输入，照片/AI 均不参与。
 * 云端 draw action 复用原抽签链路：乐观扣配额 → 云端校验+落档，失败回滚。
 */
import { CONFIG } from '../../config/index';
import { callFunction, RequestError } from '../../utils/request';
import { consumeQuota, normalizeQuotaState, QuotaState } from '../../utils/quota';
import { getNavTopPx } from '../../utils/nav';
import { ReportResult, AnalysisRecord, Hand } from '../../types/index';
import { QUIZ_QUESTIONS, QuizQuestion } from '../../data/quiz-questions';
import { chartForOption, renderOptionChart } from '../../utils/palm-chart';
import { quizOutcome, isQuizComplete, QuizAnswers } from '../../utils/quiz';
import { shareDefault, triggerShareBonus } from '../../utils/share';

/** 匹配仪式感下限（结果本地即时可得，纯等待节奏） */
const RITUAL_MS = 900;

interface CanvasItem {
  node: WechatMiniprogram.Canvas;
  width: number;
  height: number;
}

Page({
  data: {
    navTop: getNavTopPx(),
    qIndex: 0,
    question: QUIZ_QUESTIONS[0] as QuizQuestion,
    total: QUIZ_QUESTIONS.length,
    answers: {} as Record<string, string>,
    canNext: false,
    isLast: false,
    submitting: false,
  },

  /** 惯用手答案 id → Hand（云函数/历史记录字段沿用 left/right） */
  handFromAnswers(a: Record<string, string>): Hand {
    return a['hand'] === 'hand-left' ? 'left' : 'right';
  },

  onLoad() {
    this.renderQuestion();
  },

  /** 切题统一出口：同步题面状态并重画选项图 */
  renderQuestion() {
    const qIndex = this.data.qIndex;
    const question = QUIZ_QUESTIONS[qIndex];
    const answerId = this.data.answers[question.id] || '';
    this.setData({
      question,
      canNext: !!answerId,
      isLast: qIndex === QUIZ_QUESTIONS.length - 1,
    });
    wx.nextTick(() => this.drawCharts());
  },

  /** 画当前题全部选项图（选中态朱砂、未选墨色；左手题镜像轮廓） */
  drawCharts() {
    const question = this.data.question;
    const answerId = this.data.answers[question.id] || '';
    wx.createSelectorQuery()
      .in(this)
      .selectAll('.opt-canvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        const items = (res[0] || []) as CanvasItem[];
        const info = wx.getWindowInfo ? wx.getWindowInfo() : { pixelRatio: 2 };
        items.forEach((item, idx) => {
          const option = question.options[idx];
          if (!item.node || !option) return;
          const canvas = item.node;
          const ctx = canvas.getContext('2d');
          canvas.width = item.width * info.pixelRatio;
          canvas.height = item.height * info.pixelRatio;
          ctx.scale(info.pixelRatio, info.pixelRatio);
          const spec = chartForOption(question.id, idx);
          renderOptionChart(ctx, item.width, item.height, spec, option.id === answerId);
        });
      });
  },

  onPickOption(e: WechatMiniprogram.TouchEvent) {
    if (this.data.submitting) return;
    const idx = Number(e.currentTarget.dataset.index);
    const question = this.data.question;
    const option = question.options[idx];
    if (!option) return;
    // 不可变更新答案
    this.setData({
      answers: { ...this.data.answers, [question.id]: option.id },
      canNext: true,
    });
    wx.nextTick(() => this.drawCharts());
  },

  onPrev() {
    if (this.data.qIndex <= 0 || this.data.submitting) return;
    this.setData({ qIndex: this.data.qIndex - 1 });
    this.renderQuestion();
  },

  onNext() {
    if (!this.data.canNext || this.data.submitting) return;
    if (this.data.isLast) {
      this.submit();
      return;
    }
    this.setData({ qIndex: this.data.qIndex + 1 });
    this.renderQuestion();
  },

  /** 交卷：本地匹配（即时）+ 云端落档扣配额（复用抽签链路），失败回滚留在本页 */
  async submit() {
    if (this.data.submitting) return;
    const answers = this.data.answers as QuizAnswers;
    if (!isQuizComplete(answers)) {
      wx.showToast({ title: '还有题目没答完', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });

    const app = getApp();
    const hand = this.handFromAnswers(this.data.answers);
    app.globalData.pendingHand = hand;
    const { report, type } = quizOutcome(answers);

    // 本地乐观消耗；云端权威值由首页 onShow 拉取修正
    wx.setStorageSync('quota', consumeQuota(normalizeQuotaState(wx.getStorageSync('quota'))));

    try {
      const [data] = await Promise.all([
        callFunction<{ id?: string; remaining?: number }>(CONFIG.FN_ANALYZE, {
          action: 'draw',
          hand,
          typeId: type.id,
          report,
        }),
        new Promise((r) => setTimeout(r, RITUAL_MS)),
      ]);
      this.finish(report, type.id, data.id);
    } catch (err) {
      this.rollbackOptimisticConsume();
      this.setData({ submitting: false });
      const msg = err instanceof RequestError && err.userMessage ? err.userMessage : '匹配失败了，请重试一次';
      wx.showToast({ title: msg, icon: 'none', duration: 2500 });
    }
  },

  /** 成功出口：落历史 + 传报告数据 + 跳报告页 */
  finish(report: ReportResult, typeId: string, cloudId?: string) {
    const app = getApp();
    app.globalData.pendingReport = report;
    const record: AnalysisRecord = {
      _id: cloudId || `local-${Date.now()}`,
      hand: app.globalData.pendingHand,
      result: report,
      modelVersion: CONFIG.ENGINE_VERSION,
      createdAt: Date.now(),
    };
    this.saveRecord(record);
    app.globalData.reportId = record._id;
    wx.redirectTo({ url: '/pages/report/report' });
  },

  /** 回滚：云端未扣，本地乐观消耗撤销（不可变） */
  rollbackOptimisticConsume() {
    const state = normalizeQuotaState(wx.getStorageSync('quota'));
    const rolledBack: QuotaState = { ...state, dailyCount: Math.max(0, state.dailyCount - 1) };
    wx.setStorageSync('quota', rolledBack);
  },

  saveRecord(record: AnalysisRecord) {
    const list: AnalysisRecord[] = wx.getStorageSync('reports') || [];
    list.unshift(record);
    wx.setStorageSync('reports', list.slice(0, 20)); // 本地最多 20 条
  },

  onShareAppMessage() { triggerShareBonus('forward'); return shareDefault(); },
});
