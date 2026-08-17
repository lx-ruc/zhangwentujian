/** 云函数常量（与小程序端 miniprogram/config/index.ts 对齐） */
export const CONFIG = {
  DAILY_QUOTA: 3,
  MODEL: 'glm-4v-flash',
  /** 模型请求超时 ms */
  MODEL_TIMEOUT: 30_000,
  /** JSON 解析失败重试次数 */
  MAX_RETRIES: 1,
  /** 集合名 */
  COLLECTION_USERS: 'users',
  COLLECTION_ANALYSES: 'analyses',
} as const;
