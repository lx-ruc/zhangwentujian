/**
 * 支付配置一致性单测 —— 三方（pay / paynotify / 小程序端）目录必须对齐
 * pay 与 paynotify 是两个独立云函数包，config/deliver 为有意复制（无法跨目录 import），
 * 本测试是防止“只改一边”的机器闸门。
 */
import { CONFIG as PAY_CONFIG } from '../cloudfunctions/pay/config';
import { CONFIG as PAYNOTIFY_CONFIG } from '../cloudfunctions/paynotify/config';
import { CONFIG as CLIENT_CONFIG } from '../miniprogram/config/index';

describe('pay ≡ paynotify（两份复制的服务端配置）', () => {
  test('AppID / 环境 / 集合名一致', () => {
    expect(PAY_CONFIG.APPID).toBe(PAYNOTIFY_CONFIG.APPID);
    expect(PAY_CONFIG.XPAY_ENV).toBe(PAYNOTIFY_CONFIG.XPAY_ENV);
    expect(PAY_CONFIG.COLLECTION_USERS).toBe(PAYNOTIFY_CONFIG.COLLECTION_USERS);
    expect(PAY_CONFIG.COLLECTION_ORDERS).toBe(PAYNOTIFY_CONFIG.COLLECTION_ORDERS);
    expect(PAY_CONFIG.COLLECTION_DELIVER_LOG).toBe(PAYNOTIFY_CONFIG.COLLECTION_DELIVER_LOG);
  });

  test('道具目录深度一致（价格单位分、quota 加量）', () => {
    expect(PAY_CONFIG.PRODUCTS).toEqual(PAYNOTIFY_CONFIG.PRODUCTS);
  });
});

describe('客户端 SKU ∈ 服务端道具目录', () => {
  test('PAY_SKU.id 能在服务端 PRODUCTS 命中，且价格（分）一致', () => {
    const product = PAY_CONFIG.PRODUCTS[CLIENT_CONFIG.PAY_SKU.id];
    expect(product).toBeDefined();
    expect(product.productId).toBe(CLIENT_CONFIG.PAY_SKU.id);
    expect(product.price).toBe(CLIENT_CONFIG.PAY_SKU.priceFen);
  });

  test('服务端价格为正整数分（禁止元单位混入）', () => {
    for (const key of Object.keys(PAY_CONFIG.PRODUCTS)) {
      const p = PAY_CONFIG.PRODUCTS[key];
      expect(Number.isInteger(p.price)).toBe(true);
      expect(p.price).toBeGreaterThan(0);
      expect(p.quota).toBeGreaterThan(0);
    }
  });

  test('总闸门默认关闭（合规安全默认值）', () => {
    expect(CLIENT_CONFIG.PAY_ENABLED).toBe(false);
  });
});
