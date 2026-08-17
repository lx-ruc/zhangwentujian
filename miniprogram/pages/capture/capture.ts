import { DISCLAIMER } from '../../config/index';
import { shareDefault } from '../../utils/share';
import type { Hand } from '../../types/index';

Page({
  data: {
    hand: 'right' as Hand,
    disclaimer: DISCLAIMER,
    privacyHint: '',
  },

  onLoad() {
    // 隐私协议状态自检：后台未配置《用户隐私保护指引》时 chooseMedia 会被直接禁用
    if (wx.getPrivacySetting) {
      wx.getPrivacySetting({
        success: (res) => {
          console.log('[privacy]', res);
          if (res.needAuthorization) {
            this.setData({ privacyHint: '隐私协议未授权：后台需已配置《用户隐私保护指引》' });
          }
        },
        fail: (err) => {
          console.warn('[privacy] 查询失败（通常=后台未配置隐私指引）', err.errMsg);
          this.setData({ privacyHint: '隐私指引可能未配置：请到公众平台后台填写' });
        },
      });
    }
  },

  pickHand(e: WechatMiniprogram.TouchEvent) {
    this.setData({ hand: e.currentTarget.dataset.hand as Hand });
  },

  /** Phase 1：直接调起相机/相册拿图，跳分析页；Phase 2 换成 wx.cloud.uploadFile */
  shoot() {
    this.choose(['camera', 'album']);
  },
  chooseAlbum() {
    this.choose(['album']);
  },
  choose(sources: string[]) {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: sources as ('album' | 'camera')[],
      sizeType: ['compressed'],
      success: (res) => {
        const file = res.tempFiles[0];
        // 轻量前置质检：过暗/过小仅提示，不阻断（质检交给模型）
        if (file.size < 20 * 1024) {
          wx.showToast({ title: '图片过小，建议重拍', icon: 'none' });
          return;
        }
        getApp().globalData.pendingImage = file.tempFilePath;
        getApp().globalData.pendingHand = this.data.hand;
        wx.navigateTo({ url: '/pages/analyzing/analyzing' });
      },
      fail: (err) => {
        console.error('[chooseMedia]', err.errMsg);
        // 隐私协议未配置/系统权限被拒等场景给出可读提示
        const msg = err.errMsg.includes('privacy')
          ? '需要先在后台配置隐私协议（见控制台日志）'
          : err.errMsg.includes('auth') || err.errMsg.includes('deny')
            ? '相机/相册权限被拒绝，请在设置中开启'
            : '未能打开相机，详见控制台';
        wx.showToast({ title: msg, icon: 'none', duration: 2500 });
      },
    });
  },

  goBack() { wx.navigateBack(); },

  onShareAppMessage: () => shareDefault(),
});
