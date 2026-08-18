/** 云函数常量（与小程序端 miniprogram/config/index.ts 对齐） */
export const CONFIG = {
  DAILY_QUOTA: 3,
  /** 分享奖励：转发(个人/群不可分)+1×2/天，朋友圈+3×1/天，每日奖励总上限 3 */
  SHARE_BONUS: {
    forward: { amount: 1, perDay: 2 },
    timeline: { amount: 3, perDay: 1 },
    DAILY_CAP: 3,
  },
  /** GLM-4.6V-Flash：免费、128K 上下文；docs.bigmodel.cn/cn/guide/models/free/glm-4.6v-flash */
  MODEL: 'glm-4.6v-flash',
  /** 模型请求超时 ms */
  MODEL_TIMEOUT: 45_000,
  /** JSON 解析失败重试次数 */
  MAX_RETRIES: 1,
  /** 集合名 */
  COLLECTION_USERS: 'users',
  COLLECTION_ANALYSES: 'analyses',
} as const;
