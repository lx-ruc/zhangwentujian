/**
 * 云函数 paynotify —— 虚拟支付平台推送入口（云接入 HTTP 触发，必须开启「集成响应」）
 * - GET  ：URL 校验，原样回显 echostr。
 * - POST ：XML 推送。
 *   - xpay_goods_deliver_notify（发货通知，发货权威）→ 幂等入账 → 应答 '0'；
 *     非 '0' 平台会重推（≤15 次），因此仅 入账失败 应答 'FAIL'。
 *   - xpay_refund_notify（退款通知）→ 回收 purchased 额度 → '0'。
 *   - 解析失败/未知类型：记日志后仍应答 '0'（重推也解不了，防重推风暴）。
 * 前端支付成功回调 ≠ 发货权威。
 */
import * as cloud from 'wx-server-sdk';
import { parsePushXml } from './xml';
import { deliverQuota, revokeQuota } from './deliver';
import { readPayEnv } from './config';

// DYNAMIC_CURRENT_ENV 运行时为合法 env 标识，wx-server-sdk 2.x typing 误标为 string-only
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV as unknown as string });

interface HttpEvent {
  httpMethod?: string;
  body?: string;
  isBase64Encoded?: boolean;
  queryStringParameters?: Record<string, string>;
}

interface IntegratedResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

exports.main = async (event: HttpEvent): Promise<IntegratedResponse> => {
  // 环境变量缺失不影响收推送（推送处理不需要签名），仅告警提醒配置
  if (!readPayEnv()) console.warn('[paynotify] 支付环境变量未配置（不影响推送处理）');

  if ((event.httpMethod || 'GET').toUpperCase() === 'GET') {
    return text(event.queryStringParameters?.echostr || 'ok');
  }

  const raw = decodeBody(event);
  const push = parsePushXml(raw);
  if (!push) {
    console.error('[paynotify] 无法解析推送:', raw.slice(0, 500));
    return text('0');
  }

  if (push.event === 'xpay_goods_deliver_notify') {
    const outcome = await deliverQuota({
      openid: push.openid,
      outTradeNo: push.outTradeNo,
      wxOrderId: push.mchOrderNo,
      productId: push.productId,
      quantity: push.quantity,
    });
    console.log('[paynotify] 发货结果:', push.outTradeNo, outcome);
    return text(outcome === 'error' ? 'FAIL' : '0');
  }

  if (push.event === 'xpay_refund_notify') {
    const outcome = await revokeQuota({
      openid: push.openid,
      outTradeNo: push.outTradeNo,
      wxOrderId: push.mchOrderNo,
      productId: push.productId,
      quantity: push.quantity,
    });
    console.log('[paynotify] 退款回收结果:', push.outTradeNo, outcome);
    return text(outcome === 'error' ? 'FAIL' : '0');
  }

  console.warn('[paynotify] 未知推送类型:', push.event);
  return text('0');
};

function decodeBody(event: HttpEvent): string {
  const body = event.body || '';
  return event.isBase64Encoded ? Buffer.from(body, 'base64').toString('utf8') : body;
}

/** 集成响应：Content-Type 必须纯文本，成功应答 body 必须是 '0' */
function text(body: string): IntegratedResponse {
  return { statusCode: 200, headers: { 'Content-Type': 'text/plain' }, body };
}
