/**
 * 每日次数计算 —— 纯函数（展示层；云端为权威判定方，规则见 cloudfunctions/analyze/quota.ts）
 * 规则：每日基础 3 次 + 分享奖励（转发+1×2/天、朋友圈+3×1/天、每日上限 3）
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
  /** 今日分享奖励次数 */
  bonus: number;
  bonusDate: string;
}

export const initialQuotaState = (): QuotaState => ({
  dailyCount: 0,
  lastUsedDate: '',
  bonus: 0,
  bonusDate: '',
});

/** 兼容旧缓存（缺 bonus 字段） */
export function normalizeQuotaState(raw: unknown): QuotaState {
  const s = (raw || {}) as Partial<QuotaState>;
  return {
    dailyCount: typeof s.dailyCount === 'number' ? s.dailyCount : 0,
    lastUsedDate: typeof s.lastUsedDate === 'string' ? s.lastUsedDate : '',
    bonus: typeof s.bonus === 'number' ? s.bonus : 0,
    bonusDate: typeof s.bonusDate === 'string' ? s.bonusDate : '',
  };
}

/** 今日剩余次数（含分享奖励，跨日重置） */
export function remainingQuota(
  state: QuotaState,
  now: Date = new Date(),
  limit: number,
): number {
  const today = todayKey(now);
  const used = state.lastUsedDate === today ? state.dailyCount : 0;
  const bonus = state.bonusDate === today ? state.bonus : 0;
  return Math.max(0, limit + bonus - used);
}

/** 消耗一次后的新状态（不可变，调用方负责先判断 remaining > 0） */
export function consumeQuota(
  state: QuotaState,
  now: Date = new Date(),
): QuotaState {
  const today = todayKey(now);
  const base: QuotaState =
    state.lastUsedDate === today ? state : { ...state, dailyCount: 0, lastUsedDate: today };
  return { ...base, dailyCount: base.dailyCount + 1 };
}
