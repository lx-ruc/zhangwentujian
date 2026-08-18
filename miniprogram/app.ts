// app entry: global lifecycle only; keep pages self-contained
import type { ReportResult } from './types/index';

interface GlobalData {
  /** 待分析的手掌图（本地路径，分析页预览用，分析后即焚） */
  pendingImage: string;
  /** 待分析手掌的云存储 fileID（capture → analyzing 传递，云端分析完即删） */
  pendingFileID: string;
  /** 待分析的手别 */
  pendingHand: 'left' | 'right';
  /** 当前查看的报告 id（analyzing/history → report 传递） */
  reportId: string;
  /** 刚生成的报告（analyzing → report 传递；历史复看时为空，从 storage 读） */
  pendingReport: ReportResult | null;
}

App<{
  globalData: GlobalData;
}>({
  globalData: {
    pendingImage: '',
    pendingFileID: '',
    pendingHand: 'right',
    reportId: '',
    pendingReport: null,
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('基础库版本过低，请升级微信后使用');
      return;
    }
    wx.cloud.init({ traceUser: true });
  },
});
