import { DISCLAIMER } from '../../config/index';
import { shareDefault, triggerShareBonus } from '../../utils/share';
import { getNavTopPx } from '../../utils/nav';

Page({
  data: {
    navTop: getNavTopPx(),
    version: '0.1.0',
    disclaimer: DISCLAIMER,
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
