/** 全局常量：改这里，不要散落到页面 */
export const CONFIG = {
  /**
   * 云开发环境 ID（云开发控制台左上角可复制，形如 cloud1-0g…）
   * 留空 = 使用账号默认环境；多环境账号必须填，否则上传/云函数报 env 错误
   */
  CLOUD_ENV: 'cloud1-d9g41s8gza68b70b8',
  /** 每日免费次数（纯防刷，不收费） */
  DAILY_QUOTA: 3,
  /** 云函数名 */
  FN_ANALYZE: 'analyze',
  /** 模型标识（展示用，实际调用在云端） */
  MODEL_VERSION: 'glm-4.6v-flash',
  /** 模型超时（ms），云函数侧同步配置 */
  MODEL_TIMEOUT: 30_000,
  /** 分析页趣味知识轮播间隔（ms） */
  FACT_INTERVAL: 4_000,
  /**
   * 虚拟支付总闸门（个人主体·道具模式）。默认关闭：
   * 待 MP 后台开通虚拟支付、道具 add_quota_5 发布、pay/paynotify 云函数配置部署后置 true。
   * 详见 VIRTUAL-PAYMENT-SETUP.md。
   */
  PAY_ENABLED: false,
  /** 支付云函数名 */
  FN_PAY: 'pay',
  /** 售卖 SKU（价格单位分，须与服务端 PRODUCTS 一致，tests/pay-config-consistency.test.ts 校验） */
  PAY_SKU: {
    id: 'add_quota_5',
    title: '解读加量包',
    desc: '额外 5 次掌纹解读',
    priceFen: 100,
  },
} as const;

/** 免责声明（三处必放：首页/报告页/分享海报） */
export const DISCLAIMER =
  '本内容为趣味测试，测试结果仅供娱乐，不构成任何科学依据或决策建议。';
