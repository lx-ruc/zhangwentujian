/**
 * history-store 单测：云端拉取 → 校验映射 → 整表替换缓存（上限 20）
 * mock wx storage 与 request.callFunction，只测本模块逻辑
 */
jest.mock('../miniprogram/utils/request', () => ({ callFunction: jest.fn() }));

const storage = new Map<string, unknown>();
(global as unknown as { wx: unknown }).wx = {
  getStorageSync: (key: string) => storage.get(key),
  setStorageSync: (key: string, value: unknown) => { storage.set(key, value); },
};

import { callFunction } from '../miniprogram/utils/request';
import { fetchHistory, getCachedHistory } from '../miniprogram/utils/history-store';
import type { AnalysisRecord } from '../miniprogram/types/index';

const callFn = callFunction as jest.Mock;

const RECORD = (over: Partial<AnalysisRecord> = {}): AnalysisRecord => ({
  _id: 'a1',
  hand: 'right',
  result: {
    summary: '纹路清晰深长，你倾向于目标感较强的类型。',
    archetype: '稳扎稳打的实干家',
    personality: ['谋定后动'],
    career: '倾向稳步推进。',
    love: '慢热但长情。',
    wealth: '偏好计划性消费。',
    funScore: 87,
    advice: ['拆小目标。'],
    lines: { heart: 85, head: 72, life: 78 },
  },
  modelVersion: 'glm-4.6v-flash',
  createdAt: 1_755_700_000_000,
  ...over,
});

beforeEach(() => {
  storage.clear();
  callFn.mockReset();
});

describe('history-store', () => {
  it('fetchHistory：拉取后整表替换缓存（旧残留消失），hand 归一化', async () => {
    storage.set('reports', [RECORD({ _id: 'stale-local-1' })]);
    callFn.mockResolvedValue({
      records: [RECORD({ _id: 'cloud-1', hand: 'left' }), RECORD({ _id: 'cloud-2' })],
    });

    const list = await fetchHistory();

    expect(callFn).toHaveBeenCalledWith('analyze', { action: 'history' });
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ _id: 'cloud-1', hand: 'left' });
    // 整表替换：stale 记录不在缓存
    const cached = getCachedHistory();
    expect(cached.map((r) => r._id)).toEqual(['cloud-1', 'cloud-2']);
  });

  it('fetchHistory：无效记录（缺 _id / 缺 result）被过滤', async () => {
    callFn.mockResolvedValue({
      records: [
        { ...RECORD(), _id: '' },              // 空 id
        { ...RECORD({ _id: 'x' }), result: undefined }, // 缺 result
        RECORD({ _id: 'ok-1' }),
      ],
    });

    const list = await fetchHistory();
    expect(list.map((r) => r._id)).toEqual(['ok-1']);
  });

  it('fetchHistory：超过 20 条截断（云端已限，客户端双保险）', async () => {
    callFn.mockResolvedValue({
      records: Array.from({ length: 25 }, (_, i) => RECORD({ _id: `r${i}` })),
    });

    const list = await fetchHistory();
    expect(list).toHaveLength(20);
    expect(getCachedHistory()).toHaveLength(20);
  });

  it('getCachedHistory：空缓存返回空数组', () => {
    expect(getCachedHistory()).toEqual([]);
  });

  it('fetchHistory：云端失败向上抛（页面决定静默与否），缓存不动', async () => {
    storage.set('reports', [RECORD({ _id: 'keep-me' })]);
    callFn.mockRejectedValue(new Error('network down'));

    await expect(fetchHistory()).rejects.toThrow('network down');
    expect(getCachedHistory().map((r) => r._id)).toEqual(['keep-me']);
  });
});
