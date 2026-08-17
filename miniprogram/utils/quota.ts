/**
 * 每日次数计算 —— 纯函数，无副作用（云函数侧有一份镜像实现）
 * 规则：每自然日（本地时区）重置，每日 DAILY_QUOTA 次。
 */

/** 'YYYY-MM-DD'（本地时区） */
export function todayKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export interface QuotaState {
  dailyCount: number;
  lastUsedDate: string;
}

export const initialQuotaState = (): QuotaState => ({
  dailyCount: 0,
  lastUsedDate: '',
});

/** 今日剩余次数（跨日自动视为重置） */
export function remainingQuota(
  state: QuotaState,
  now: Date = new Date(),
  limit: number,
): number {
  if (state.lastUsedDate !== todayKey(now)) return limit;
  return Math.max(0, limit - state.dailyCount);
}

/** 消耗一次后的新状态（不可变，调用方负责先判断 remaining > 0） */
export function consumeQuota(
  state: QuotaState,
  now: Date = new Date(),
): QuotaState {
  const today = todayKey(now);
  const base: QuotaState =
    state.lastUsedDate === today ? state : { dailyCount: 0, lastUsedDate: today };
  return { dailyCount: base.dailyCount + 1, lastUsedDate: today };
}
