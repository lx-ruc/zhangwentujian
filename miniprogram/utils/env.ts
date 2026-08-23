/**
 * 运行环境判断
 * envVersion: develop=开发版(工具/预览/auto-preview) / trial=体验版 / release=正式版
 * 「上传代码」后即为 trial/release——限次数自动恢复，无需改代码
 */
export function isDevEnv(): boolean {
  try {
    const info = wx.getAccountInfoSync();
    return info.miniProgram.envVersion === 'develop';
  } catch {
    return false;
  }
}
