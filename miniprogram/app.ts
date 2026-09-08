// app entry: global lifecycle only; keep pages self-contained
import { CONFIG } from './config/index';
import { ReportResult } from './types/index';

interface GlobalData {
  /** 本次答题选的惯用手（quiz → 落档用；无照片流程） */
  pendingHand: 'left' | 'right';
  /** 当前查看的报告 id（quiz/history → report 传递） */
  reportId: string;
  /** 刚生成的报告（quiz → report 传递；历史复看时为空，从 storage 读） */
  pendingReport: ReportResult | null;
}

App<{
  globalData: GlobalData;
}>({
  globalData: {
    pendingHand: 'right',
    reportId: '',
    pendingReport: null,
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('基础库版本过低，请升级微信后使用');
      return;
    }
    // 多环境账号必须显式指定 env，否则云函数调用会落到错误环境而失败
    wx.cloud.init({ traceUser: true, env: CONFIG.CLOUD_ENV || undefined });
  },

  /** 空路径/未注册页兜底：回首页，不白屏（后台路径配错、坏分享链接等场景） */
  onPageNotFound(res) {
    console.warn('[app] 页面不存在，回首页：', res.path || '(空路径)');
    wx.reLaunch({ url: '/pages/index/index' });
  },
});
