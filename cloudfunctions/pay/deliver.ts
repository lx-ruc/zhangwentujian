/**
 * 幂等发货 —— pay(查单兜底) 与 paynotify(推送) 两个入口共用逻辑。
 * 注意：本文件与 cloudfunctions/paynotify/deliver.ts 必须保持一致
 * （云函数包互相独立无法共享代码，config 由 tests/pay-config-consistency.test.ts 校验）。
 *
 * 幂等策略：
 * 1. pay_deliver_log 以微信支付单号 wxOrderId 为 _id（重复 _id 写入失败 = 已发货）；
 *    同时按 outTradeNo 反查，防止「推送按 MchOrderNo、查单兜底按 outTradeNo」双路重复入账。
 * 2. 配额入账失败时回滚删除锁记录并返回 error，让平台重推/用户重查可完整重试。
 * 3. users.purchased 为永久加量（不随日期重置），与 dailyCount/bonus 并列。
 */
import * as cloud from 'wx-server-sdk';
import { CONFIG } from './config';

export interface DeliverInput {
  openid: string;
  outTradeNo: string;
  /** 微信支付单号（推送里 WeChatPayInfo.MchOrderNo），幂等键 */
  wxOrderId: string;
  productId: string;
  quantity: number;
}

export type DeliverOutcome = 'delivered' | 'duplicate' | 'ignored' | 'error';

const db = cloud.database();

export async function deliverQuota(input: DeliverInput): Promise<DeliverOutcome> {
  const product = CONFIG.PRODUCTS[input.productId];
  if (!product) {
    console.error('[deliver] 未知道具，忽略该推送:', input.productId);
    return 'ignored';
  }

  const deliverLog = db.collection(CONFIG.COLLECTION_DELIVER_LOG);
  try {
    // 跨来源幂等：同 outTradeNo 已发过（无论以哪个单号为锁）直接判重
    const prior = (await deliverLog.where({ outTradeNo: input.outTradeNo }).limit(1).get()) as {
      data?: unknown[];
    };
    if (prior.data && prior.data.length > 0) return 'duplicate';

    await deliverLog.add({
      data: {
        _id: input.wxOrderId,
        openid: input.openid,
        outTradeNo: input.outTradeNo,
        productId: input.productId,
        quantity: input.quantity,
        deliveredAt: db.serverDate(),
      },
    });
  } catch (e) {
    const msg = String(e);
    if (/exists|duplicate|-502001/i.test(msg)) return 'duplicate';
    console.error('[deliver] 幂等锁写入失败:', msg);
    return 'error';
  }

  try {
    await incUserPurchased(input.openid, product.quota * input.quantity);
    await markOrder(input.outTradeNo, 'delivered', input.wxOrderId);
    return 'delivered';
  } catch (e) {
    console.error('[deliver] 配额入账失败，回滚幂等锁待重试:', input.outTradeNo, e);
    try {
      await deliverLog.doc(input.wxOrderId).remove();
    } catch (removeErr) {
      console.error('[deliver] 幂等锁回滚失败（需人工对账）:', input.wxOrderId, removeErr);
    }
    return 'error';
  }
}

/** 退款回收：users.purchased 扣减（下限 0）。读-改-写，¥1 小额场景可接受并发窗口 */
export async function revokeQuota(input: DeliverInput): Promise<'revoked' | 'error'> {
  const product = CONFIG.PRODUCTS[input.productId];
  const amount = product ? product.quota * input.quantity : 0;
  try {
    const users = db.collection(CONFIG.COLLECTION_USERS);
    const found = (await users.where({ _openid: input.openid }).limit(1).get()) as {
      data?: Array<{ purchased?: number }>;
    };
    const current = found.data?.[0]?.purchased ?? 0;
    if (found.data && found.data.length > 0) {
      await users.where({ _openid: input.openid }).update({
        data: { purchased: Math.max(0, current - amount), updatedAt: db.serverDate() },
      });
    }
    await markOrder(input.outTradeNo, 'refunded', input.wxOrderId);
    return 'revoked';
  } catch (e) {
    console.error('[deliver] 退款回收失败:', input.outTradeNo, e);
    return 'error';
  }
}

/** users.purchased 永久加量；首次出现的用户直接建全量配额档案 */
async function incUserPurchased(openid: string, amount: number): Promise<void> {
  const users = db.collection(CONFIG.COLLECTION_USERS);
  const existing = (await users.where({ _openid: openid }).limit(1).get()) as { data?: unknown[] };
  if (existing.data && existing.data.length > 0) {
    await users.where({ _openid: openid }).update({
      data: { purchased: db.command.inc(amount), updatedAt: db.serverDate() },
    });
  } else {
    await users.add({
      data: {
        _openid: openid,
        dailyCount: 0,
        lastUsedDate: '',
        bonus: 0,
        bonusDate: '',
        purchased: amount,
        shareCounters: { forward: 0, timeline: 0 },
        createdAt: db.serverDate(),
        updatedAt: db.serverDate(),
      },
    });
  }
}

async function markOrder(
  outTradeNo: string,
  status: 'delivered' | 'refunded',
  wxOrderId: string,
): Promise<void> {
  await db.collection(CONFIG.COLLECTION_ORDERS).where({ outTradeNo }).update({
    data: { status, wxOrderId, updatedAt: db.serverDate() },
  });
}
