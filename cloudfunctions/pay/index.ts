/**
 * 云函数 pay —— 虚拟支付下单 / 查单兜底（服务端是价格与签名权威）
 * - action=order : wx.login code → code2session(换 session_key + openid 交叉校验)
 *                  → 生成 outTradeNo/signData/paySig/signature → 先落 orders 再回传前端调起
 * - action=query : 发货推送丢失时的兜底：查单 → 已支付未发货 → 补发货（幂等）
 * 前端支付成功回调 ≠ 发货权威，权威是 paynotify 推送（本函数只是兜底）。
 */
import * as cloud from 'wx-server-sdk';
import { CONFIG, readPayEnv } from './config';
import { buildSignData, genOutTradeNo, paySigOf, userSigOf } from './sign';
import { code2Session, fetchAccessToken, queryOrder } from './wechat-api';
import { deliverQuota } from './deliver';

// DYNAMIC_CURRENT_ENV 运行时为合法 env 标识，wx-server-sdk 2.x typing 误标为 string-only
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV as unknown as string });

interface PayEvent {
  action?: 'order' | 'query';
  /** 道具短名（服务端查 PRODUCTS 得真实价格，客户端永远不传价格） */
  sku?: string;
  /** wx.login 的 code（下单时换 session_key 计算 signature） */
  code?: string;
  outTradeNo?: string;
}

interface OrderData {
  mode: 'short_series_goods';
  signData: string;
  paySig: string;
  signature: string;
  outTradeNo: string;
}

interface QueryData {
  status: 'delivered' | 'unpaid' | 'refunded' | 'closed';
}

const db = cloud.database();
const orders = db.collection(CONFIG.COLLECTION_ORDERS);

exports.main = async (
  event: PayEvent,
): Promise<{ code: number; message?: string; data?: OrderData | QueryData }> => {
  const OPENID = cloud.getWXContext().OPENID;
  if (!OPENID) return err('PAY_ERROR', '缺少用户标识');

  const payEnv = readPayEnv();
  if (!payEnv) return err('PAY_NOT_CONFIGURED', 'PAY_NOT_CONFIGURED');

  try {
    if (event.action === 'order') {
      const product = event.sku ? CONFIG.PRODUCTS[event.sku] : undefined;
      if (!product || !event.code) return err('PARAM_MISSING', '参数缺失');

      // code2session 换 session_key（signature 原料）；openid 交叉校验防伪造
      const session = await code2Session(CONFIG.APPID, payEnv.wxAppSecret, event.code);
      if (session.openid !== OPENID) return err('PAY_ERROR', '用户校验失败');

      const outTradeNo = genOutTradeNo(Date.now(), Math.random);
      const signData = buildSignData(payEnv.offerId, product, outTradeNo, 'quota');
      // 先落订单再回传签名：宁可无单不可无痕
      await orders.add({
        data: {
          _openid: OPENID,
          outTradeNo,
          productId: product.productId,
          sku: event.sku,
          quantity: 1,
          amount: product.price,
          status: 'created',
          createdAt: db.serverDate(),
        },
      });
      return ok({
        mode: 'short_series_goods' as const,
        signData,
        paySig: paySigOf(payEnv.payAppKey, signData),
        signature: userSigOf(session.sessionKey, signData),
        outTradeNo,
      });
    }

    if (event.action === 'query') {
      if (!event.outTradeNo) return err('PARAM_MISSING', '参数缺失');
      const found = (await orders
        .where({ _openid: OPENID, outTradeNo: event.outTradeNo })
        .limit(1)
        .get()) as { data?: Array<{ status?: string; productId?: string; quantity?: number }> };
      const order = found.data?.[0];
      if (!order) return err('PARAM_MISSING', '订单不存在');
      if (order.status === 'delivered') return ok({ status: 'delivered' as const });

      const token = await fetchAccessToken(CONFIG.APPID, payEnv.wxAppSecret);
      const q = await queryOrder(token, payEnv.payAppKey, OPENID, event.outTradeNo);
      if (q.errcode !== 0) return err('PAY_ERROR', `查单失败 ${q.errcode}`);

      // 已支付（2 待发货 / 3 已发货 / 4 已收货）→ 补发货；退款态只标记（额度回收走退款推送）
      if (q.status === 2 || q.status === 3 || q.status === 4) {
        const outcome = await deliverQuota({
          openid: OPENID,
          outTradeNo: event.outTradeNo,
          wxOrderId: q.wxOrderId || event.outTradeNo,
          productId: order.productId ?? '',
          quantity: order.quantity ?? 1,
        });
        return ok({ status: outcome === 'error' ? ('unpaid' as const) : ('delivered' as const) });
      }
      if (q.status === 5 || q.status === 8) return ok({ status: 'refunded' as const });
      return ok({ status: q.status === 6 ? ('closed' as const) : ('unpaid' as const) });
    }

    return err('PARAM_MISSING', '参数缺失');
  } catch (e) {
    console.error('[pay]', e);
    return err('PAY_ERROR', '支付服务异常');
  }
};

function ok(data: OrderData | QueryData) {
  return { code: 0, data };
}
function err(code: string, message: string) {
  const PASSTHROUGH = ['PAY_NOT_CONFIGURED', 'PARAM_MISSING'];
  return { code: 1, message: PASSTHROUGH.includes(code) ? code : message };
}
