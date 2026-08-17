/**
 * 每日限额（云函数侧镜像实现，与 miniprogram/utils/quota.ts 保持同一规则）
 * 云函数是权威判定方；客户端仅做展示层预读。
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
}

export const initialUserQuota = (): UserQuota => ({
  dailyCount: 0,
  lastUsedDate: '',
});

export function hasQuota(q: UserQuota, now: Date = new Date()): boolean {
  if (q.lastUsedDate !== todayKey(now)) return true;
  return q.dailyCount < CONFIG.DAILY_QUOTA;
}

/** 不可变消耗：返回新对象（调用方先 hasQuota 判定） */
export function consume(q: UserQuota, now: Date = new Date()): UserQuota {
  const today = todayKey(now);
  const base: UserQuota =
    q.lastUsedDate === today ? q : { dailyCount: 0, lastUsedDate: today };
  return { dailyCount: base.dailyCount + 1, lastUsedDate: today };
}
