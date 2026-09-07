import { CONFIG, DISCLAIMER } from '../../config/index';
import { shareDefault, triggerShareBonus } from '../../utils/share';
import { getNavTopPx } from '../../utils/nav';

/** 投诉邮箱（合规 3.10/3.13）：与 git 联系邮箱一致，更换时同步这里 */
const CONTACT_MAIL = '1187623599@qq.com';

Page({
  data: {
    navTop: getNavTopPx(),
    version: CONFIG.APP_VERSION,
    disclaimer: DISCLAIMER,
  },

  /** 点击复制投诉邮箱 */
  copyMail() {
    wx.setClipboardData({
      data: CONTACT_MAIL,
      success: () => {
        wx.showToast({ title: '邮箱已复制', icon: 'success' });
      },
    });
  },

  /** 页内返回：custom 导航无系统返回键；有栈走 back，栈空（reLaunch/深链进入）兜底回首页 */
  goBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.reLaunch({ url: '/pages/index/index' });
    }
  },

  onShareAppMessage() { triggerShareBonus('forward'); return shareDefault(); },
});
