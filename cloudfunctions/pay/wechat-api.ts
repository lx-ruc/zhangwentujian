/**
 * 微信服务端 API 薄封装 —— Node 原生 https（云函数运行时无 fetch），模式同 analyze/zhipu.ts
 * - code2Session: wx.login code → openid + session_key（signature 签名原料）
 * - fetchAccessToken: cgi-bin/token（仅查单兜底路径使用，调用量极小不缓存）
 * - queryOrder: /xpay/query_order 现金单状态查询（pay_sig 放 query 参数）
 */
import * as https from 'https';
import { serverSigOf } from './sign';

const API_HOST = 'api.weixin.qq.com';
const TIMEOUT_MS = 10_000;

export interface SessionInfo {
  openid: string;
  sessionKey: string;
}

interface WxJson {
  [key: string]: unknown;
}

/** 查单结果：status 枚举见 queryOrder 注释 */
export interface QueryOrderResult {
  errcode: number;
  errmsg: string;
  status: number;
  wxOrderId: string;
}

function request(
  method: 'GET' | 'POST',
  url: string,
  headers: Record<string, string>,
  body: string,
): Promise<WxJson> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      { method, headers, timeout: TIMEOUT_MS },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          try {
            resolve(JSON.parse(text));
          } catch {
            reject(new Error(`微信 API 响应非 JSON: ${text.slice(0, 200)}`));
          }
        });
      },
    );
    req.on('timeout', () => req.destroy(new Error('微信 API 请求超时')));
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

export async function code2Session(appid: string, secret: string, jsCode: string): Promise<SessionInfo> {
  const url =
    `https://${API_HOST}/sns/jscode2session?appid=${appid}&secret=${secret}` +
    `&js_code=${encodeURIComponent(jsCode)}&grant_type=authorization_code`;
  const res = await request('GET', url, {}, '');
  const errcode = Number(res.errcode ?? 0);
  if (errcode !== 0) throw new Error(`code2session ${errcode}: ${String(res.errmsg ?? '')}`);
  if (typeof res.openid !== 'string' || typeof res.session_key !== 'string') {
    throw new Error('code2session 缺少 openid/session_key');
  }
  return { openid: res.openid, sessionKey: res.session_key };
}

export async function fetchAccessToken(appid: string, secret: string): Promise<string> {
  const url =
    `https://${API_HOST}/cgi-bin/token?grant_type=client_credential&appid=${appid}&secret=${secret}`;
  const res = await request('GET', url, {}, '');
  if (typeof res.access_token !== 'string') {
    throw new Error(`获取 access_token 失败 ${String(res.errcode ?? '')}: ${String(res.errmsg ?? '')}`);
  }
  return res.access_token;
}

/**
 * 查询现金单（非代币单）。
 * status 枚举（官方文档）：1 创建 / 2 已支付待发货 / 3 已发货 / 4 已确认收货 /
 * 5 已退款 / 6 已关闭 / 7 退款失败 / 8 用户退款完成 / 9 回收广告金 / 10 分账回退。
 * 响应字段名以实测为准（文档页面示例为空），此处对 order 容器与单号字段做兼容读取。
 */
export async function queryOrder(
  accessToken: string,
  appKey: string,
  openid: string,
  outTradeNo: string,
): Promise<QueryOrderResult> {
  const uri = '/xpay/query_order';
  // post_body 必须与实际 HTTP 请求体逐字节一致（参与 pay_sig 签名）
  const postBody = JSON.stringify({ env: 0, openid, out_trade_no: outTradeNo });
  const paySig = serverSigOf(appKey, uri, postBody);
  const url = `https://${API_HOST}${uri}?access_token=${encodeURIComponent(accessToken)}&pay_sig=${paySig}`;
  const res = await request('POST', url, {
    'Content-Type': 'application/json',
    'Content-Length': String(Buffer.byteLength(postBody)),
  }, postBody);
  const order = (res.order && typeof res.order === 'object' ? res.order : res) as WxJson;
  return {
    errcode: Number(res.errcode ?? 0),
    errmsg: String(res.errmsg ?? ''),
    status: Number(order.status ?? order.order_state ?? -1),
    wxOrderId: String(order.wx_order_id ?? order.channel_order_id ?? ''),
  };
}
