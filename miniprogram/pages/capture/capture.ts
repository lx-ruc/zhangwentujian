import { DISCLAIMER } from '../../config/index';
import { shareDefault } from '../../utils/share';
import { uploadPalmImage, UploadError } from '../../utils/upload';
import type { Hand } from '../../types/index';

Page({
  data: {
    hand: 'right' as Hand,
    disclaimer: DISCLAIMER,
    privacyHint: '',
    uploading: false,
    /** 相机异常（权限被拒/组件错误）→ 显示占位并回退系统拍摄 */
    cameraBroken: false,
    /** 明确被用户拒绝授权 → 显示"去开启"按钮 */
    cameraDenied: false,
    cameraPos: 'back' as 'back' | 'front',
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

  // ===== 内嵌相机 =====
  onCameraError(e: WechatMiniprogram.CustomEvent<{ errMsg?: string }>) {
    const msg = String((e.detail as { errMsg?: string })?.errMsg || '');
    console.error('[camera]', msg);
    // 授权被拒：显示"去开启"占位；其他错误（模拟器等）：保留黑框，快门自动回退系统拍摄
    this.setData({ cameraDenied: /auth|deny/i.test(msg), cameraBroken: true });
  },

  openSetting() {
    wx.openSetting({
      success: (res) => {
        // 用户在设置页开回权限 → 重建 camera 组件
        if (res.authSetting['scope.camera']) {
          this.setData({ cameraDenied: false, cameraBroken: false });
        }
      },
    });
  },

  flipCamera() {
    this.setData({ cameraPos: this.data.cameraPos === 'back' ? 'front' : 'back' });
  },

  /** 红色快门：相机可用直接拍；不可用（模拟器/异常）回退系统拍摄 */
  shoot() {
    if (this.data.cameraBroken) {
      this.choose(['camera', 'album']);
      return;
    }
    const ctx = wx.createCameraContext();
    ctx.takePhoto({
      quality: 'high',
      success: (res) => {
        if (!res.tempImagePath) {
          wx.showToast({ title: '拍摄失败，请重试', icon: 'none' });
          return;
        }
        this.submit(res.tempImagePath);
      },
      fail: (err) => {
        console.warn('[takePhoto] 回退系统拍摄：', err.errMsg);
        this.choose(['camera', 'album']);
      },
    });
  },

  chooseAlbum() {
    this.choose(['album']);
  },
  choose(sources: string[]) {
    if (this.data.uploading) return;
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
        this.submit(file.tempFilePath);
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

  /** 选图完成：上传云存储拿 fileID，成功后才进分析页（失败留在本页 toast） */
  async submit(localPath: string) {
    this.setData({ uploading: true });
    wx.showLoading({ title: '正在上传…', mask: true });
    try {
      const fileID = await uploadPalmImage(localPath);
      const app = getApp();
      app.globalData.pendingImage = localPath; // 分析页预览用（本地路径，即焚）
      app.globalData.pendingFileID = fileID; // 云函数入参
      app.globalData.pendingHand = this.data.hand;
      wx.navigateTo({ url: '/pages/analyzing/analyzing' });
    } catch (err) {
      const msg = err instanceof UploadError ? err.userMessage : '上传失败，请重试';
      wx.showToast({ title: msg, icon: 'none', duration: 2500 });
    } finally {
      wx.hideLoading();
      this.setData({ uploading: false });
    }
  },

  goBack() { wx.navigateBack(); },

  onShareAppMessage: () => shareDefault(),
});
