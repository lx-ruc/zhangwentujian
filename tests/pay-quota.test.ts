/**
 * 购买配额（purchased 永久字段）单测 —— 云端/前端两侧镜像规则
 */
import {
  consume,
  hasQuota,
  initialUserQuota,
  remainingOf,
  UserQuota,
} from '../cloudfunctions/analyze/quota';
import {
  consumeQuota,
  initialQuotaState,
  normalizeQuotaState,
  remainingQuota,
} from '../miniprogram/utils/quota';

const now = new Date('2026-09-03T15:00:00');
const nextDay = new Date('2026-09-04T00:01:00');

describe('云端 quota：purchased 永久加量', () => {
  test('剩余 = 基础 + 购买（当日未用）', () => {
    const q = { ...initialUserQuota(), purchased: 5 };
    expect(remainingOf(q, now)).toBe(8);
    expect(hasQuota(q, now)).toBe(true);
  });

  test('永久不随日期重置（区别于 bonus）', () => {
    const q = { ...initialUserQuota(), bonus: 2, bonusDate: '2026-09-03', purchased: 5 };
    expect(remainingOf(q, nextDay)).toBe(8); // bonus 清零、purchased 保留
  });

  test('消耗扣减，不透支；consume 不可变且不动 purchased', () => {
    let q: UserQuota = { ...initialUserQuota(), purchased: 5 };
    for (let i = 0; i < 8; i++) q = consume(q, now);
    expect(remainingOf(q, now)).toBe(0);
    expect(q.purchased).toBe(5);
    const before = { ...q };
    consume(q, now);
    expect(q).toEqual(before);
  });

  test('旧文档缺 purchased 字段（?? 0 兜底）', () => {
    const legacy = { dailyCount: 3, lastUsedDate: '2026-09-03', bonus: 0, bonusDate: '' };
    expect(remainingOf(legacy, now)).toBe(0);
  });
});

describe('前端 quota 镜像：purchased', () => {
  test('remainingQuota 计入 purchased；跨日不清零', () => {
    const s = { ...initialQuotaState(), purchased: 5 };
    expect(remainingQuota(s, now, 3)).toBe(8);
    expect(remainingQuota(s, nextDay, 3)).toBe(8);
  });

  test('normalizeQuotaState 兼容旧缓存（缺 purchased → 0）', () => {
    const legacy = { dailyCount: 1, lastUsedDate: '2026-09-03', bonus: 1, bonusDate: '2026-09-03' };
    const s = normalizeQuotaState(legacy);
    expect(s.purchased).toBe(0);
    expect(remainingQuota(s, now, 3)).toBe(3);
  });

  test('与云端口径一致（同字段同剩余）', () => {
    const shared = {
      dailyCount: 2,
      lastUsedDate: '2026-09-03',
      bonus: 1,
      bonusDate: '2026-09-03',
      purchased: 5,
    };
    expect(remainingOf(shared, now)).toBe(remainingQuota(shared, now, 3));
    expect(remainingOf(shared, now)).toBe(7);
  });

  test('consumeQuota 不可变且保留 purchased', () => {
    const s = { ...initialQuotaState(), purchased: 5 };
    const next = consumeQuota(s, now);
    expect(s.dailyCount).toBe(0);
    expect(next.dailyCount).toBe(1);
    expect(next.purchased).toBe(5);
  });
});
