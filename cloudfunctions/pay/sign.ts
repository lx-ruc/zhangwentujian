/**
 * 虚拟支付签名 —— 纯函数（算法见官方「虚拟支付签名」文档）
 * - pay_sig     = hmac_sha256_hex(app_key,     uri + '&' + post_body)
 * - signature   = hmac_sha256_hex(session_key, signData)            （用户登录态）
 * - 前端调起    : uri 固定为 API 名 'requestVirtualPayment'
 * 官方测试向量在 tests/pay-sign.test.ts 中逐字节核对。
 */
import * as crypto from 'crypto';

/** wx.requestVirtualPayment 对应的签名 uri（不带参数） */
export const PAY_API_NAME = 'requestVirtualPayment';

const OUT_TRADE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export interface SignProduct {
  productId: string;
  price: number;
}

export function hmacSha256Hex(key: string, data: string): string {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest('hex');
}

/**
 * signData 严格按官方示例字段顺序序列化（字段顺序不可换）：
 * offerId, buyQuantity, env, currencyType, productId, goodsPrice, outTradeNo, attach
 */
export function buildSignData(offerId: string, product: SignProduct, outTradeNo: string, attach: string): string {
  return JSON.stringify({
    offerId,
    buyQuantity: 1,
    env: 0,
    currencyType: 'CNY',
    productId: product.productId,
    goodsPrice: product.price,
    outTradeNo,
    attach,
  });
}

/** 前端支付签名 paySig：uri 为 API 名 */
export function paySigOf(appKey: string, signData: string): string {
  return serverSigOf(appKey, PAY_API_NAME, signData);
}

/** 用户登录态签名 signature：直接对 signData 签（无 uri 前缀） */
export function userSigOf(sessionKey: string, signData: string): string {
  return hmacSha256Hex(sessionKey, signData);
}

/** 服务端 API 签名 pay_sig：uri 不带 query，post_body 与实际请求体逐字节一致 */
export function serverSigOf(appKey: string, uri: string, postBody: string): string {
  return hmacSha256Hex(appKey, `${uri}&${postBody}`);
}

/**
 * 商户单号 outTradeNo：8-32 位，字符集 数字/大小写字母/_-|*@，不可下划线开头，全局唯一。
 * 构成：'Q' + base36 毫秒时间戳(~8位) + 6 位随机字母数字 ≈ 15 位。
 */
export function genOutTradeNo(now: number, rand: () => number): string {
  const ts = now.toString(36);
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += OUT_TRADE_CHARS[Math.floor(rand() * OUT_TRADE_CHARS.length)];
  }
  return `Q${ts}${suffix}`;
}
