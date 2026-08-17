import { DISCLAIMER } from '../../config/index';
import type { Hand } from '../../types/index';

Page({
  data: {
    hand: 'right' as Hand,
    disclaimer: DISCLAIMER,
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
    });
  },

  goBack() { wx.navigateBack(); },
});
