/**
 * 发货推送 XML 解析 —— 纯函数，无副作用。
 * 微信现金单推送为 XML（值多为 CDATA 包裹，且 WeChatPayInfo/GoodsInfo 为嵌套节点）。
 * 解析失败返回 null（调用方记日志并应答 '0' 防重推风暴）。
 */

export interface PushPayload {
  event: string;
  openid: string;
  outTradeNo: string;
  /** 微信支付单号（幂等键）；缺失时退化为 outTradeNo */
  mchOrderNo: string;
  productId: string;
  quantity: number;
}

function pick(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`));
  return m ? m[1].trim() : '';
}

export function parsePushXml(xml: string): PushPayload | null {
  if (!xml || !xml.includes('<xml')) return null;
  const event = pick(xml, 'Event');
  const openid = pick(xml, 'OpenId');
  const outTradeNo = pick(xml, 'OutTradeNo');
  if (!event || !openid || !outTradeNo) return null;

  const qty = parseInt(pick(xml, 'Quantity'), 10);
  return {
    event,
    openid,
    outTradeNo,
    mchOrderNo: pick(xml, 'MchOrderNo') || outTradeNo,
    productId: pick(xml, 'ProductId'),
    quantity: Number.isFinite(qty) && qty > 0 ? qty : 1,
  };
}
