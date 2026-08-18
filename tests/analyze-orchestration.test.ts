/**
 * analyze 云函数编排单测
 * mock 掉 wx-server-sdk 与 zhipu，只测 index.ts 的编排逻辑：
 * 配额判定 → 下载 → 模型 → 校验重试 → 兜底 → 落库 → 消耗配额 → 删图
 */
import type { ReportShape } from '../cloudfunctions/analyze/validate';

jest.mock('wx-server-sdk', () => {
  const collectionData = new Map<string, Array<Record<string, unknown>>>();
  const deleted: string[] = [];
  const downloads: string[] = [];

  const makeCollection = (name: string) => ({
    _name: name,
    where(cond: Record<string, unknown>) {
      const key = Object.keys(cond)[0] as string;
      const val = cond[key];
      const rows = (collectionData.get(name) || []).filter((r) => r[key] === val);
      return {
        limit() { return this; },
        get: async () => ({ data: rows }),
        update: async () => ({ stats: { updated: 1 } }),
      };
    },
    add: async ({ data }: { data: Record<string, unknown> }) => {
      const rows = collectionData.get(name) || [];
      rows.push({ _id: `id-${rows.length + 1}`, ...data });
      collectionData.set(name, rows);
      return { _id: `id-${rows.length + 1}` };
    },
    doc(id: string) {
      return {
        update: async () => { void id; return { stats: { updated: 1 } }; },
        get: async () => ({ data: (collectionData.get(name) || []).find((r) => r._id === id) }),
        set: async ({ data }: { data: Record<string, unknown> }) => {
          const rows = collectionData.get(name) || [];
          rows.push({ _id: id, ...data });
          collectionData.set(name, rows);
          return {};
        },
      };
    },
  });

  const sdk = {
    DYNAMIC_CURRENT_ENV: Symbol('dyn'),
    init: jest.fn(),
    getWXContext: () => ({ OPENID: 'openid-test' }),
    database: () => ({
      collection: makeCollection,
      command: { inc: (n: number) => ({ __inc__: n }) },
      serverDate: () => ({ __serverDate__: new Date().toISOString() }),
    }),
    downloadFile: async ({ fileID }: { fileID: string }) => {
      downloads.push(fileID);
      return { fileContent: Buffer.from('fake-jpeg-bytes') };
    },
    deleteFile: async ({ fileList }: { fileList: string[] }) => {
      deleted.push(...fileList);
      return { fileList: fileList.map((f) => ({ fileID: f, code: 0 })) };
    },
    __test: {
      collectionData, deleted, downloads,
      reset: () => { collectionData.clear(); deleted.length = 0; downloads.length = 0; },
      seedUser: (openid: string, dailyCount: number, lastUsedDate: string) => {
        collectionData.set('users', [{ _openid: openid, dailyCount, lastUsedDate }]);
      },
    },
  };
  return sdk;
});

jest.mock('../cloudfunctions/analyze/zhipu', () => {
  const impl = {
    /** 队列化模型响应；用尽后抛错或循环最后一个 */
    responses: [] as Array<{ text?: string; reject?: boolean }>,
    calls: 0,
    reset() { this.responses = []; this.calls = 0; },
  };
  return {
    __esModule: true,
    callZhipu: jest.fn(async () => {
      impl.calls += 1;
      const next = impl.responses[Math.min(impl.calls - 1, impl.responses.length - 1)];
      if (!next) throw new Error('zhipu not stubbed');
      if (next.reject) throw new Error('zhipu stubbed rejection');
      return { text: next.text ?? '', report: null };
    }),
    __zhipuImpl: impl,
  };
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const sdk = require('wx-server-sdk') as unknown as {
  __test: {
    reset: () => void; seedUser: (o: string, c: number, d: string) => void;
    deleted: string[]; downloads: string[];
    collectionData: Map<string, Array<Record<string, unknown>>>;
  };
};
// eslint-disable-next-line @typescript-eslint/no-var-requires
const zhipuMock = require('../cloudfunctions/analyze/zhipu') as {
  callZhipu: jest.Mock;
  __zhipuImpl: { responses: Array<{ text?: string; reject?: boolean }>; calls: number; reset: () => void };
};
// eslint-disable-next-line @typescript-eslint/no-var-requires
const analyzeIndex = require('../cloudfunctions/analyze/index');

const today = () => new Date().toISOString().slice(0, 10);

/** 一份完全合法的模型报告（不触发违禁词） */
const GOOD_REPORT: ReportShape = {
  summary: '纹路清晰深长，你倾向于目标感较强的类型，情绪较稳，面对新事物先观察再行动。',
  archetype: '稳扎稳打的实干家',
  personality: ['谋定后动', '慢热长情'],
  career: '倾向稳步推进，不喜频繁变更方向，适合长线型任务。',
  love: '慢热但长情，重视关系里的稳定感，表达偏含蓄。',
  wealth: '偏好计划性消费，储蓄意识较强，倾向稳中求进。',
  funScore: 87,
  advice: ['把大目标拆成小步子，每完成一步给自己一点小奖励。'],
  lines: { heart: 85, head: 72, life: 78 },
};

const goodRaw = (over: Record<string, unknown> = {}) => ({ ...GOOD_REPORT, ...over });

const call = (payload: Record<string, unknown> = {}) =>
  (analyzeIndex.main as (e: Record<string, unknown>) => Promise<{ code: number; message?: string; data?: unknown }>)({
    action: 'analyze',
    fileID: 'cloud://env.123/palm-test.jpg',
    hand: 'right',
    ...payload,
  });

beforeEach(() => {
  sdk.__test.reset();
  zhipuMock.__zhipuImpl.reset();
  delete process.env.ZHIPU_API_KEY;
});

describe('analyze 编排', () => {
  it('配额未用时：走完整链路并落库、删图', async () => {
    process.env.ZHIPU_API_KEY = 'test-key';
    zhipuMock.__zhipuImpl.responses = [{ text: JSON.stringify(goodRaw()) }];
    // 无 users 记录 → 视为首次，有配额

    const res = await call();
    expect(res.code).toBe(0);

    // 模型只调一次、下载发生
    expect(zhipuMock.__zhipuImpl.calls).toBe(1);
    expect(sdk.__test.downloads).toContain('cloud://env.123/palm-test.jpg');

    // 报告落库（只存文本，无图片字段）
    const analyses = sdk.__test.collectionData.get('analyses') || [];
    expect(analyses).toHaveLength(1);
    expect(analyses[0].result).toMatchObject({ funScore: 87 });
    expect(JSON.stringify(analyses[0])).not.toContain('fileID');
    expect(analyses[0]).not.toHaveProperty('imageBase64');

    // 配额已消耗
    const users = sdk.__test.collectionData.get('users') || [];
    expect(users[0]).toMatchObject({ dailyCount: 1, lastUsedDate: today() });

    // 图片即焚
    expect(sdk.__test.deleted).toContain('cloud://env.123/palm-test.jpg');
  });

  it('当日配额用尽：拒绝且不调模型、不落库', async () => {
    process.env.ZHIPU_API_KEY = 'test-key';
    sdk.__test.seedUser('openid-test', 3, today());

    const res = await call();
    expect(res.code).toBe(1);
    expect(res.message).toBe('QUOTA_EXCEEDED');
    expect(zhipuMock.__zhipuImpl.calls).toBe(0);
    expect(sdk.__test.collectionData.get('analyses') || []).toHaveLength(0);
    // 配额拒绝也要删除已上传的图片——不留隐私残留
    expect(sdk.__test.deleted).toContain('cloud://env.123/palm-test.jpg');
  });

  it('校验失败（违禁词）：重试 1 次后成功', async () => {
    process.env.ZHIPU_API_KEY = 'test-key';
    zhipuMock.__zhipuImpl.responses = [
      { text: JSON.stringify(goodRaw({ summary: '你的运势一片大好，财运亨通。这句话足够长以通过长度校验。' })) },
      { text: JSON.stringify(goodRaw()) },
    ];

    const res = await call();
    expect(res.code).toBe(0);
    expect(zhipuMock.__zhipuImpl.calls).toBe(2);
  });

  it('两次都失败：返回兜底报告（不白屏），仍落库删图', async () => {
    process.env.ZHIPU_API_KEY = 'test-key';
    zhipuMock.__zhipuImpl.responses = [
      { reject: true },
      { text: '模型抽风：这不是 JSON' },
    ];

    const res = await call();
    expect(res.code).toBe(0);
    expect(zhipuMock.__zhipuImpl.calls).toBe(2);
    // 兜底报告特征：funScore 66
    expect(res.data).toMatchObject({ report: { funScore: 66 } });
    expect(sdk.__test.deleted).toContain('cloud://env.123/palm-test.jpg');
    const analyses = sdk.__test.collectionData.get('analyses') || [];
    expect(analyses).toHaveLength(1);
  });

  it('网络/HTTP 异常也算一次失败，两次后兜底', async () => {
    process.env.ZHIPU_API_KEY = 'test-key';
    zhipuMock.__zhipuImpl.responses = [{ reject: true }, { reject: true }];

    const res = await call();
    expect(res.code).toBe(0);
    expect(res.data).toMatchObject({ report: { funScore: 66 } });
  });

  it('缺 API Key：明确报错不兜底（部署配置问题要暴露）', async () => {
    const res = await call();
    expect(res.code).toBe(1);
    expect(res.message).toContain('API Key');
    expect(zhipuMock.__zhipuImpl.calls).toBe(0);
  });

  it('缺 fileID：拒绝', async () => {
    process.env.ZHIPU_API_KEY = 'test-key';
    const res = await call({ fileID: '' });
    expect(res.code).toBe(1);
  });

  it('action=quota：返回今日剩余，不触发分析', async () => {
    process.env.ZHIPU_API_KEY = 'test-key';
    sdk.__test.seedUser('openid-test', 1, today());
    const res = await (analyzeIndex.main as (e: Record<string, unknown>) => Promise<{ code: number; data?: { remaining?: number } }>)({
      action: 'quota',
    });
    expect(res.code).toBe(0);
    expect(res.data?.remaining).toBe(2);
    expect(zhipuMock.__zhipuImpl.calls).toBe(0);
  });
});
