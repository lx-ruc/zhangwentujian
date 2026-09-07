/**
 * 每日限额 + 分享奖励（云函数侧权威实现，与 miniprogram/utils/quota.ts 保持同一规则）
 * 规则：每日基础 3 次；分享可额外获得奖励次数——
 *   - 转发（个人/群，平台不可区分）+1，每日最多 2 次
 *   - 朋友圈 +3，每日最多 1 次
 *   - 每日分享奖励总上限 3 次（防刷）
 */
import { CONFIG } from './config';

export function todayKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export interface UserQuota {
  dailyCount: number;
  lastUsedDate: string;
  /** 今日分享奖励已加次数（可叠加到当日上限） */
  bonus: number;
  /** 今日分享奖励记录日 */
  bonusDate: string;
  /** 购买的永久加量（虚拟支付发货入账，不随日期重置） */
  purchased?: number;
  /** 今日各渠道分享次数（防连点） */
  shareCounters?: { forward: number; timeline: number };
}

export const initialUserQuota = (): UserQuota => ({
  dailyCount: 0,
  lastUsedDate: '',
  bonus: 0,
  bonusDate: '',
  purchased: 0,
});

/** 当日总额度 = 基础 + 分享奖励 + 购买加量（永久） */
export function capacityOf(q: UserQuota, now: Date = new Date()): number {
  const today = todayKey(now);
  const usedToday = q.lastUsedDate === today ? q.dailyCount : 0;
  const bonusToday = q.bonusDate === today ? q.bonus : 0;
  void usedToday;
  return CONFIG.DAILY_QUOTA + bonusToday + (q.purchased ?? 0);
}

/** 今日剩余 */
export function remainingOf(q: UserQuota, now: Date = new Date()): number {
  const today = todayKey(now);
  const usedToday = q.lastUsedDate === today ? q.dailyCount : 0;
  return Math.max(0, capacityOf(q, now) - usedToday);
}

export function hasQuota(q: UserQuota, now: Date = new Date()): boolean {
  return remainingOf(q, now) > 0;
}

/** 不可变消耗：返回新对象（调用方先 hasQuota 判定） */
export function consume(q: UserQuota, now: Date = new Date()): UserQuota {
  const today = todayKey(now);
  const base: UserQuota =
    q.lastUsedDate === today ? q : { ...q, dailyCount: 0, lastUsedDate: today };
  return { ...base, dailyCount: base.dailyCount + 1 };
}

export type ShareChannel = 'forward' | 'timeline';

export interface GrantResult {
  ok: boolean;
  /** 拒绝原因：DAILY_CAP（当日奖励总上限）/ CHANNEL_CAP（该渠道当日上限） */
  reason?: 'DAILY_CAP' | 'CHANNEL_CAP';
  quota: UserQuota;
  remaining: number;
}

/**
 * 发放分享奖励（不可变）。平台限制：转发无法区分群/个人，统一 +1；
 * 朋友圈 +3。渠道各自限次 + 每日总上限，防连点/刷分。
 */
export function grantShareBonus(
  q: UserQuota,
  channel: ShareChannel,
  now: Date = new Date(),
): GrantResult {
  const today = todayKey(now);
  // 跨日重置：bonus 与渠道计数一并归零（漏清 shareCounters 会导致旧计数永久占用每日限次）
  const base: UserQuota =
    q.bonusDate === today
      ? q
      : { ...q, bonus: 0, bonusDate: today, shareCounters: { forward: 0, timeline: 0 } };
  const rule = CONFIG.SHARE_BONUS[channel];

  if (base.bonus + rule.amount > CONFIG.SHARE_BONUS.DAILY_CAP) {
    return { ok: false, reason: 'DAILY_CAP', quota: base, remaining: remainingOf(base, now) };
  }
  if ((base.shareCounters?.[channel] ?? 0) >= rule.perDay) {
    return { ok: false, reason: 'CHANNEL_CAP', quota: base, remaining: remainingOf(base, now) };
  }

  const next: UserQuota = {
    ...base,
    bonus: base.bonus + rule.amount,
    shareCounters: {
      forward: channel === 'forward' ? (base.shareCounters?.forward ?? 0) + 1 : base.shareCounters?.forward ?? 0,
      timeline: channel === 'timeline' ? (base.shareCounters?.timeline ?? 0) + 1 : base.shareCounters?.timeline ?? 0,
    },
  };
  return { ok: true, quota: next, remaining: remainingOf(next, now) };
}
