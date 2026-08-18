import {
  todayKey,
  remainingQuota,
  consumeQuota,
  initialQuotaState,
} from '../miniprogram/utils/quota';
import {
  hasQuota,
  consume,
  initialUserQuota,
  todayKey as cloudTodayKey,
} from '../cloudfunctions/analyze/quota';

describe('小程序端 quota 纯函数', () => {
  const now = new Date('2026-08-17T15:00:00');

  test('todayKey 输出 YYYY-MM-DD（本地时区）', () => {
    expect(todayKey(now)).toBe('2026-08-17');
  });

  test('初始状态满额', () => {
    expect(remainingQuota(initialQuotaState(), now, 3)).toBe(3);
  });

  test('当日消耗递减，不透支', () => {
    let s = initialQuotaState();
    s = consumeQuota(s, now);
    s = consumeQuota(s, now);
    expect(remainingQuota(s, now, 3)).toBe(1);
    s = consumeQuota(s, now);
    expect(remainingQuota(s, now, 3)).toBe(0);
    s = consumeQuota(s, now); // 超额调用（调用方应先判 remaining>0）
    expect(remainingQuota(s, now, 3)).toBe(0);
  });

  test('跨日自动重置', () => {
    let s = initialQuotaState();
    for (let i = 0; i < 3; i++) s = consumeQuota(s, now);
    expect(remainingQuota(s, now, 3)).toBe(0);
    const nextDay = new Date('2026-08-18T00:01:00');
    expect(remainingQuota(s, nextDay, 3)).toBe(3);
  });

  test('consumeQuota 不可变（不修改原状态）', () => {
    const s = { ...initialQuotaState(), dailyCount: 1, lastUsedDate: todayKey(now) };
    const next = consumeQuota(s, now);
    expect(s.dailyCount).toBe(1);
    expect(next.dailyCount).toBe(2);
  });
});

describe('云函数端 quota 镜像', () => {
  const now = new Date('2026-08-17T15:00:00');

  test('与前端 todayKey 规则一致', () => {
    // 镜像一致性：两端日期键不同步会导致配额判定错位
    expect(todayKey(now)).toBe(cloudTodayKey(now));
  });

  test('hasQuota 判定与前端 remaining 一致', () => {
    let s = initialUserQuota();
    expect(hasQuota(s, now)).toBe(remainingQuota(initialQuotaState(), now, 3) > 0);
    s = { ...initialUserQuota(), dailyCount: 3, lastUsedDate: todayKey(now) };
    expect(hasQuota(s, now)).toBe(false);
  });

  test('consume 跨日清零', () => {
    const s = { ...initialUserQuota(), dailyCount: 3, lastUsedDate: '2026-08-16' };
    const next = consume(s, now);
    expect(next.dailyCount).toBe(1);
    expect(next.lastUsedDate).toBe('2026-08-17');
  });

  test('分享奖励：转发+1（每日2次）、朋友圈+3（每日1次）、总上限3', () => {
    const { grantShareBonus } = require('../cloudfunctions/analyze/quota');
    let q = initialUserQuota();
    // 转发第 1 次：+1
    let r1 = grantShareBonus(q, 'forward', now);
    expect(r1.ok).toBe(true);
    expect(r1.remaining).toBe(4); // 基础3 + 奖励1
    // 转发第 2 次：再 +1（达渠道上限）
    let r2 = grantShareBonus(r1.quota, 'forward', now);
    expect(r2.ok).toBe(true);
    expect(r2.remaining).toBe(5);
    // 转发第 3 次：渠道上限拒绝
    let r3 = grantShareBonus(r2.quota, 'forward', now);
    expect(r3.ok).toBe(false);
    expect(r3.reason).toBe('CHANNEL_CAP');
    // 朋友圈：总上限 3 已满 → 拒绝
    let r4 = grantShareBonus(r2.quota, 'timeline', now);
    expect(r4.ok).toBe(false);
    expect(r4.reason).toBe('DAILY_CAP');
  });

  test('分享奖励：朋友圈先 +3，再转发触总上限', () => {
    const { grantShareBonus } = require('../cloudfunctions/analyze/quota');
    let q = initialUserQuota();
    const r1 = grantShareBonus(q, 'timeline', now);
    expect(r1.ok).toBe(true);
    expect(r1.remaining).toBe(6); // 基础3 + 朋友圈3
    const r2 = grantShareBonus(r1.quota, 'forward', now);
    expect(r2.ok).toBe(false);
    expect(r2.reason).toBe('DAILY_CAP');
  });

  test('分享奖励跨日重置', () => {
    const { grantShareBonus, remainingOf } = require('../cloudfunctions/analyze/quota');
    const today = grantShareBonus(initialUserQuota(), 'timeline', now);
    const nextDay = new Date('2026-08-19T10:00:00');
    const r = grantShareBonus(today.quota, 'forward', nextDay);
    expect(r.ok).toBe(true);
    expect(remainingOf(today.quota, nextDay)).toBe(3); // 昨日奖励不带入
  });
});
