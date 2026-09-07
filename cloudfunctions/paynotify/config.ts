/**
 * 云函数 paynotify —— 配置
 * ⚠ 与 cloudfunctions/pay/config.ts 保持同步（云函数包互相独立无法共享代码，
 *   由 tests/pay-config-consistency.test.ts 深度校验，改任何一边必须同步另一边）。
 */

export interface ProductSpec {
  /** 道具 ID：必须与 MP 后台「虚拟支付-道具管理」中已发布的道具一致 */
  productId: string;
  /** 单价（单位：分）。必须与后台道具价格一致，否则拉起支付报 -15013 */
  price: number;
  /** 该道具加的永久解读次数 */
  quota: number;
  name: string;
}

export const CONFIG = {
  APPID: 'wx3b8baf398bf449d2',
  /** 虚拟支付环境：0=现网（固定值，signData.env 同源） */
  XPAY_ENV: 0,
  /** 道具目录：服务端是价格/道具权威，客户端只传 sku 短名、永不传价格 */
  PRODUCTS: {
    add_quota_5: { productId: 'add_quota_5', price: 100, quota: 5, name: '解读加量包·5次' },
  } as Record<string, ProductSpec>,
  COLLECTION_USERS: 'users',
  COLLECTION_ORDERS: 'orders',
  /** 幂等发货锁：以微信支付单号为 _id，重复写入即视为已发货 */
  COLLECTION_DELIVER_LOG: 'pay_deliver_log',
};

export interface PayEnv {
  offerId: string;
  payAppKey: string;
  wxAppSecret: string;
}

/** 读取环境变量（paynotify 本身不签名，读不出来仅告警不影响收推送） */
export function readPayEnv(): PayEnv | null {
  const offerId = process.env.OFFER_ID || '';
  const payAppKey = process.env.PAY_APP_KEY || '';
  const wxAppSecret = process.env.WX_APP_SECRET || '';
  if (!offerId || !payAppKey || !wxAppSecret) return null;
  return { offerId, payAppKey, wxAppSecret };
}
