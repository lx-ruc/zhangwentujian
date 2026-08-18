/**
 * 云存储上传：capture 拿到本地临时图 → 上传 → fileID
 * 图片即焚原则：路径只用于本次分析，云端分析完即删。
 */

export class UploadError extends Error {
  readonly userMessage: string;

  constructor(userMessage: string, raw?: unknown) {
    super(userMessage);
    this.userMessage = userMessage;
    if (raw !== undefined) console.error('[upload]', raw);
  }
}

/**
 * 上传手掌照片到云存储。
 * 失败抛 UploadError（页面捕获后 toast，不进分析页）。
 */
export function uploadPalmImage(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    wx.cloud.uploadFile({
      cloudPath: `palms/${Date.now()}-${Math.floor(Math.random() * 1e6)}.jpg`,
      filePath,
      success: (res) => {
        if (!res.fileID) {
          reject(new UploadError('上传失败，请重试', res));
          return;
        }
        resolve(res.fileID);
      },
      fail: (err) => {
        const msg = /env|init/i.test(err.errMsg)
          ? '云环境未就绪，请稍后重试'
          : '上传失败，请检查网络后重试';
        reject(new UploadError(msg, err));
      },
    });
  });
}
