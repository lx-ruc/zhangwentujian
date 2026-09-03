/**
 * 虚拟支付签名单测 —— 含官方文档 Python 示例的 assert 测试向量
 * （https://developers.weixin.qq.com/minigame/dev/guide/open-ability/virtual-payment/signature）
 * 官方向量核对通过 = 部署前检查清单「签名函数与官方文档签名示例核对一致」的机器验收。
 */
import * as crypto from 'crypto';
import {
  buildSignData,
  genOutTradeNo,
  hmacSha256Hex,
  paySigOf,
  serverSigOf,
  userSigOf,
} from '../cloudfunctions/pay/sign';

/** 官方文档示例的固定入参（直接用其序列化版本，保证逐字节一致） */
const DOC_URI = '/wxa/game/getbalance';
const DOC_BODY =
  '{"offer_id": "12345678", "openid": "oUrsfxxxxxxxxxx", "ts": 1668136271, "zone_id": "1", "env": 0}';
const DOC_APPKEY = '12345';
const DOC_SESSION_KEY = '9hAb/NEYUlkaMBEsmFgzig==';

describe('官方签名测试向量（核对一致）', () => {
  test('pay_sig = hmac_sha256(app_key, uri + "&" + post_body) 与官方 assert 值一致', () => {
    expect(serverSigOf(DOC_APPKEY, DOC_URI, DOC_BODY)).toBe(
      '11bac6388871d29c055c7d16fbe42e8d646855b666faf89b15c815218b1b23bd',
    );
  });

  test('signature = hmac_sha256(session_key, post_body)（无 uri 前缀）与官方 assert 值一致', () => {
    expect(userSigOf(DOC_SESSION_KEY, DOC_BODY)).toBe(
      '42fe1d3341fb1c8bd6f5014ba735ab04eacc80a2deb3ab4669eab4700b5b6729',
    );
  });

  test('hmacSha256Hex 与 Node 原生 crypto 逐字节一致（utf8 key/msg）', () => {
    const expected = crypto
      .createHmac('sha256', DOC_SESSION_KEY)
      .update(DOC_BODY, 'utf8')
      .digest('hex');
    expect(hmacSha256Hex(DOC_SESSION_KEY, DOC_BODY)).toBe(expected);
  });
});

describe('signData 构造（字段顺序与取值规则）', () => {
  const product = { productId: 'add_quota_5', price: 100 };

  test('严格按官方示例字段顺序序列化、无空格、单位为分、env=0', () => {
    expect(buildSignData('offer123', product, 'Qabc123xyz9', 'quota')).toBe(
      '{"offerId":"offer123","buyQuantity":1,"env":0,"currencyType":"CNY",' +
        '"productId":"add_quota_5","goodsPrice":100,"outTradeNo":"Qabc123xyz9","attach":"quota"}',
    );
  });

  test('解析后字段齐备（offerId/buyQuantity/env/currencyType/productId/goodsPrice/outTradeNo/attach）', () => {
    const parsed = JSON.parse(buildSignData('o', product, 'Qx1', 'quota'));
    expect(Object.keys(parsed)).toEqual([
      'offerId',
      'buyQuantity',
      'env',
      'currencyType',
      'productId',
      'goodsPrice',
      'outTradeNo',
      'attach',
    ]);
    expect(parsed.env).toBe(0);
    expect(parsed.currencyType).toBe('CNY');
    expect(parsed.goodsPrice).toBe(100);
  });

  test('paySigOf 即 uri=requestVirtualPayment 的服务端签名（官方前端约定）', () => {
    const sd = buildSignData('o', product, 'Qx1', 'quota');
    expect(paySigOf('appkey', sd)).toBe(serverSigOf('appkey', 'requestVirtualPayment', sd));
    expect(paySigOf('appkey', sd)).not.toBe(userSigOf('session', sd));
  });
});

describe('outTradeNo 生成规则', () => {
  test('格式：8-32 位、数字/大小写字母/_-|*@、不可下划线开头', () => {
    const okRe = /^[0-9A-Za-z_-|*@]{8,32}$/;
    for (let i = 0; i < 500; i++) {
      const no = genOutTradeNo(1770000000000 + i, Math.random);
      expect(okRe.test(no)).toBe(true);
      expect(no.startsWith('_')).toBe(false);
      expect(no.length).toBeGreaterThanOrEqual(8);
      expect(no.length).toBeLessThanOrEqual(32);
    }
  });

  test('可注入随机源（确定性）：同种子同时间戳 → 同单号', () => {
    const a = genOutTradeNo(1770000000000, () => 0.42);
    const b = genOutTradeNo(1770000000000, () => 0.42);
    expect(a).toBe(b);
  });

  test('唯一性：200 次生成无重复', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(genOutTradeNo(Date.now(), Math.random));
    expect(seen.size).toBe(200);
  });
});
