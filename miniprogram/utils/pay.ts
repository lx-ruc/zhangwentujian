/**
 * 虚拟支付前端封装（个人主体·短剧类道具模式 short_series_goods）
 * - 价格/签名一律由云函数 pay 生成，客户端只传 sku 短名，永不传价格
 * - 支付成功回调 ≠ 发货权威（权威是 paynotify 推送），成功后异步查单兜底
 * - 全部入口受 CONFIG.PAY_ENABLED 闸门控制（默认关，后台配置完成并过审后再开）
 */
import { CONFIG } from '../config/index';
import { callFunction } from './request';

export type PayFailReason = 'UNSUPPORTED' | 'NOT_ENABLED' | 'CANCEL' | 'PAY_ERROR';

export class PayError extends Error {
  readonly reason: PayFailReason;
  readonly userMessage: string;

  constructor(reason: PayFailReason, userMessage: string) {
    super(userMessage);
    this.name = 'PayError';
    this.reason = reason;
    this.userMessage = userMessage;
  }
}

export interface PaySuccess {
  orderNo: string;
}

/** 基础库版本比较：v1 >= v2 返回非负 */
function compareVersion(v1: string, v2: string): number {
  const a = v1.split('.').map(Number);
  const b = v2.split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] || 0) - (b[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** 虚拟支付可用性：基础库 ≥ 2.19.2（或 canIUse）；iOS 另需微信客户端 ≥ 8.0.68 */
export function canUseVirtualPayment(): boolean {
  try {
    const info = wx.getSystemInfoSync();
    const sdkOk =
      compareVersion(String(info.SDKVersion || ''), '2.19.2') >= 0 ||
      wx.canIUse('requestVirtualPayment');
    if (!sdkOk) return false;
    if (info.platform === 'ios' && compareVersion(String(info.version || ''), '8.0.68') < 0) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

interface OrderResponse {
  mode: string;
  signData: string;
  paySig: string;
  signature: string;
  outTradeNo: string;
}

interface VirtualPaymentOpts {
  mode: string;
  signData: string;
  paySig: string;
  signature: string;
  success: (res: unknown) => void;
  fail: (res: { errCode?: number; errMsg?: string }) => void;
}

/** errCode → 用户文案（-2 用户取消 / -4 风控 / -15007 session_key 过期等） */
function failMessage(res: { errCode?: number; errMsg?: string }): string {
  if (res.errCode === -2) return '已取消支付';
  if (res.errCode === -4) return '支付未通过验证，请稍后再试';
  if (res.errCode === -15007) return '登录态已过期，请重试';
  return '支付未完成，请重试';
}

function wxLogin(): Promise<{ code: string }> {
  return new Promise((resolve, reject) => {
    wx.login({ success: resolve, fail: () => reject(new PayError('PAY_ERROR', '登录失败，请重试')) });
  });
}

/** 购买加量包：下单 → 拉起支付 →（成功后）异步查单兜底补发货 */
export async function buyQuotaPack(): Promise<PaySuccess> {
  if (!CONFIG.PAY_ENABLED) throw new PayError('NOT_ENABLED', '暂未开放购买');
  if (!canUseVirtualPayment()) {
    throw new PayError('UNSUPPORTED', '当前微信版本暂不支持，请升级微信后重试');
  }

  const login = await wxLogin();
  const order = await callFunction<OrderResponse>(CONFIG.FN_PAY, {
    action: 'order',
    sku: CONFIG.PAY_SKU.id,
    code: login.code,
  });

  await new Promise<void>((resolve, reject) => {
    // 类型声明落后于真机 API，运行时存在；失败码见官方文档（-2 取消 / -4 风控 / -150xx 参数签名类）
    (wx as unknown as { requestVirtualPayment: (o: VirtualPaymentOpts) => void }).requestVirtualPayment({
      mode: 'short_series_goods',
      signData: order.signData,
      paySig: order.paySig,
      signature: order.signature,
      success: () => resolve(),
      fail: (res) => reject(new PayError(res.errCode === -2 ? 'CANCEL' : 'PAY_ERROR', failMessage(res))),
    });
  });

  // 前端成功回调不作为发货依据：fire-and-forget 查单兜底（幂等，与推送不冲突）
  void callFunction(CONFIG.FN_PAY, { action: 'query', outTradeNo: order.outTradeNo }).catch(
    () => undefined,
  );
  return { orderNo: order.outTradeNo };
}
