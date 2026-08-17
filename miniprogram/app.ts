// app entry: global lifecycle only; keep pages self-contained
interface GlobalData {
  /** 待分析的手掌图（capture → analyzing 传递，分析后即焚） */
  pendingImage: string;
  /** 待分析的手别 */
  pendingHand: 'left' | 'right';
  /** 当前查看的报告 id（analyzing → report 传递） */
  reportId: string;
}

App<{
  globalData: GlobalData;
}>({
  globalData: {
    pendingImage: '',
    pendingHand: 'right',
    reportId: '',
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('基础库版本过低，请升级微信后使用');
      return;
    }
    wx.cloud.init({ traceUser: true });
  },
});
