import { DISCLAIMER } from '../../config/index';
import { shareDefault, triggerShareBonus } from '../../utils/share';
import { getNavTopPx } from '../../utils/nav';
import { Hand } from '../../types/index';

Page({
  data: {
    navTop: getNavTopPx(),
    hand: 'right' as Hand,
    disclaimer: DISCLAIMER,
    privacyHint: '',
    /** 防快门双击重复进分析页 */
    submitting: false,
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

  /** 红色快门：相机可用直接拍；不可用（模拟器/异常）回退系统相机 */
  shoot() {
    if (this.data.cameraBroken) {
      this.choose(['camera']);
      return;
    }
    const ctx = wx.createCameraContext();
    ctx.takePhoto({
      quality: 'normal', // 仅本页与分析页预览，不参与计算，无需原图
      success: (res) => {
        if (!res.tempImagePath) {
          wx.showToast({ title: '拍摄失败，请重试', icon: 'none' });
          return;
        }
        this.submit(res.tempImagePath);
      },
      fail: (err) => {
        console.warn('[takePhoto] 回退系统相机：', err.errMsg);
        this.choose(['camera']);
      },
    });
  },

  choose(sources: string[]) {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: sources as ('album' | 'camera')[],
      sizeType: ['compressed'],
      success: (res) => {
        this.submit(res.tempFiles[0].tempFilePath);
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

  /** 留影完成：照片只留在本机（预览用），直接进抽签页——不上传任何数据 */
  submit(localPath: string) {
    if (this.data.submitting) return;
    this.setData({ submitting: true });
    const app = getApp();
    app.globalData.pendingImage = localPath; // 分析页预览用（本地路径，用后即弃）
    app.globalData.pendingHand = this.data.hand;
    wx.navigateTo({
      url: '/pages/analyzing/analyzing',
      complete: () => this.setData({ submitting: false }),
    });
  },

  goBack() { wx.navigateBack(); },

  onShareAppMessage() { triggerShareBonus('forward'); return shareDefault(); },
});
