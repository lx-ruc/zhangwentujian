/**
 * 发货推送 XML 解析单测 —— 样本按官方字段表构造（CDATA + 嵌套 WeChatPayInfo/GoodsInfo）
 */
import { parsePushXml } from '../cloudfunctions/paynotify/xml';

const DELIVER_XML =
  '<xml>' +
  '<Event><![CDATA[xpay_goods_deliver_notify]]></Event>' +
  '<OpenId><![CDATA[oXyz1234567890]]></OpenId>' +
  '<OutTradeNo><![CDATA[Qm3abc9def12]]></OutTradeNo>' +
  '<WeChatPayInfo>' +
  '<MchOrderNo><![CDATA[wx_order_id_20260903_0001]]></MchOrderNo>' +
  '</WeChatPayInfo>' +
  '<GoodsInfo>' +
  '<ProductId><![CDATA[add_quota_5]]></ProductId>' +
  '<Quantity><![CDATA[1]]></Quantity>' +
  '</GoodsInfo>' +
  '</xml>';

describe('parsePushXml', () => {
  test('完整发货推送：CDATA + 嵌套节点正确解析', () => {
    expect(parsePushXml(DELIVER_XML)).toEqual({
      event: 'xpay_goods_deliver_notify',
      openid: 'oXyz1234567890',
      outTradeNo: 'Qm3abc9def12',
      mchOrderNo: 'wx_order_id_20260903_0001',
      productId: 'add_quota_5',
      quantity: 1,
    });
  });

  test('非 CDATA 明文节点同样可解析', () => {
    const plain =
      '<xml><Event>xpay_refund_notify</Event><OpenId>oABC</OpenId>' +
      '<OutTradeNo>Qref12345</OutTradeNo><MchOrderNo>wx_ref_001</MchOrderNo>' +
      '<ProductId>add_quota_5</ProductId><Quantity>1</Quantity></xml>';
    expect(parsePushXml(plain)).toEqual({
      event: 'xpay_refund_notify',
      openid: 'oABC',
      outTradeNo: 'Qref12345',
      mchOrderNo: 'wx_ref_001',
      productId: 'add_quota_5',
      quantity: 1,
    });
  });

  test('缺 MchOrderNo 时退化为 outTradeNo（幂等键兜底）', () => {
    const noMch =
      '<xml><Event>xpay_goods_deliver_notify</Event><OpenId>oA</OpenId>' +
      '<OutTradeNo>Qno1</OutTradeNo><ProductId>add_quota_5</ProductId></xml>';
    expect(parsePushXml(noMch)?.mchOrderNo).toBe('Qno1');
  });

  test('缺 Quantity 时默认 1（按数量发放的最小安全值）', () => {
    const noQty =
      '<xml><Event>e</Event><OpenId>oA</OpenId><OutTradeNo>Q1</OutTradeNo></xml>';
    expect(parsePushXml(noQty)?.quantity).toBe(1);
  });

  test('缺关键字段（Event/OpenId/OutTradeNo 任一）→ null', () => {
    expect(parsePushXml('<xml><OpenId>o</OpenId><OutTradeNo>Q</OutTradeNo></xml>')).toBeNull();
    expect(parsePushXml('<xml><Event>e</Event><OutTradeNo>Q</OutTradeNo></xml>')).toBeNull();
    expect(parsePushXml('<xml><Event>e</Event><OpenId>o</OpenId></xml>')).toBeNull();
  });

  test('非 XML / 空串 → null（不抛异常）', () => {
    expect(parsePushXml('')).toBeNull();
    expect(parsePushXml('not xml at all')).toBeNull();
    expect(parsePushXml('{}')).toBeNull();
  });
});
