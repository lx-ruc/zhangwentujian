import { classifyPalmType, classifyByScore } from '../miniprogram/utils/classify';
import { PALM_TYPES, PALM_TYPE_LIST } from '../miniprogram/data/palm-types';
import { REPORT_CONTENT } from '../miniprogram/data/report-content';
import { demoReport } from '../miniprogram/utils/draw';

// 禁词表与 copy-ban.test.ts 保持同步：运系/吉凶系/求签系/掌系（仅放行「掌纹」，报告正文不含掌部词故从严全禁）+ AI 措辞
const BANNED_TERMS = [
  '算命', '占卜', '手相', '面相', '大师',
  '运势', '运气', '好运', '转运', '旺', '命运',
  '吉', '凶', '灾', '祸',
  '求签', '签文', '解签', '测运',
  '手掌', '掌纹', '掌心', '巴掌', '手纹', '掌',
];
const BANNED_AI = /AI生成|AI解读|AI分析|AI读取/;

function expectNoBanned(text: string): void {
  for (const b of BANNED_TERMS) expect(text.includes(b)).toBe(false);
  expect(BANNED_AI.test(text)).toBe(false);
}

describe('人格签图鉴 · 数据完整性', () => {
  test('12 型齐全且编号唯一', () => {
    expect(PALM_TYPE_LIST).toHaveLength(12);
    const nos = new Set(PALM_TYPE_LIST.map((t) => t.no));
    expect(nos.size).toBe(12);
  });

  test('人格签代码：12 个且唯一，与主导线/风格字母一致', () => {
    const codes = PALM_TYPE_LIST.map((t) => t.code);
    expect(new Set(codes).size).toBe(12);
    const domLetter = { heart: 'H', head: 'R', life: 'V' } as const;
    const styLetter = { calm: 'S', bold: 'A', agile: 'N', deep: 'D' } as const;
    for (const t of PALM_TYPE_LIST) {
      expect(t.code).toBe(domLetter[t.dominant] + styLetter[t.style]);
    }
  });

  test('相性引用的类型名都存在', () => {
    const names = new Set(PALM_TYPE_LIST.map((t) => t.name));
    for (const t of PALM_TYPE_LIST) {
      for (const c of t.compat) expect(names.has(c)).toBe(true);
    }
  });

  test('全类型文案无违禁词', () => {
    for (const t of PALM_TYPE_LIST) {
      expectNoBanned(JSON.stringify(t));
    }
  });
});

describe('REPORT_CONTENT · 12 支签文案完备性', () => {
  test('12 支全覆盖，无缺失无多余', () => {
    expect(Object.keys(REPORT_CONTENT).sort()).toEqual(
      PALM_TYPE_LIST.map((t) => t.id).sort(),
    );
  });

  test('每支：summary 非空、personality 3 词、三维度非空、3 场景各 2+2、advice 2-4 条', () => {
    for (const t of PALM_TYPE_LIST) {
      const b = REPORT_CONTENT[t.id];
      expect(b.summary.length).toBeGreaterThan(20);
      expect(b.personality).toHaveLength(3);
      for (const dim of [b.career, b.love, b.wealth] as const) {
        expect(dim.length).toBeGreaterThan(10);
      }
      for (const key of ['work', 'life', 'mind'] as const) {
        const s = b.scenes!;
        expect(s[key].traits).toHaveLength(2);
        expect(s[key].cautions).toHaveLength(2);
      }
      expect(b.advice.length).toBeGreaterThanOrEqual(2);
      expect(b.advice.length).toBeLessThanOrEqual(4);
    }
  });

  test('全部文案无违禁词', () => {
    expectNoBanned(JSON.stringify(REPORT_CONTENT));
  });
});

describe('classifyPalmType · 主导线判定', () => {
  test('感受力最高 → 心系', () => {
    expect(classifyPalmType({ heart: 90, head: 60, life: 65 }).dominant).toBe('heart');
  });
  test('思考力最高 → 脑系', () => {
    expect(classifyPalmType({ heart: 55, head: 88, life: 60 }).dominant).toBe('head');
  });
  test('行动力最高 → 身系', () => {
    expect(classifyPalmType({ heart: 60, head: 58, life: 92 }).dominant).toBe('life');
  });
  test('三线并列 → 优先序 heart', () => {
    // 55 均值 → 沉稳档，heart-calm「深潭映月」
    expect(classifyPalmType({ heart: 55, head: 55, life: 55 }).id).toBe('heart-calm');
    // 70 均值 → 灵动档，heart-agile「春风拂面」（并列时主导线仍取 heart）
    expect(classifyPalmType({ heart: 70, head: 70, life: 70 }).id).toBe('heart-agile');
  });
});

describe('classifyPalmType · 风格判定', () => {
  test('极差 ≥ 35 → 深沉（偏科）', () => {
    const r = classifyPalmType({ heart: 95, head: 55, life: 58 });
    expect(r.style).toBe('deep');
    expect(r.id).toBe('heart-deep'); // 暗河涌动
  });
  test('均值高且不偏科 → 进取', () => {
    const r = classifyPalmType({ heart: 85, head: 78, life: 70 }); // mean=77.7 range=15
    expect(r.style).toBe('bold');
    expect(r.id).toBe('heart-bold'); // 燎原星火
  });
  test('均值低且不偏科 → 沉稳', () => {
    const r = classifyPalmType({ heart: 52, head: 50, life: 60 }); // mean=54 range=10
    expect(r.style).toBe('calm');
    expect(r.id).toBe('life-calm'); // 长途行者
  });
  test('中间地带 → 灵动', () => {
    const r = classifyPalmType({ heart: 65, head: 68, life: 60 }); // mean=64.3 range=8
    expect(r.style).toBe('agile');
    expect(r.id).toBe('head-agile'); // 千面棱镜
  });
  test('偏科优先于均值（极差大 + 均值高 → 仍深沉）', () => {
    const r = classifyPalmType({ heart: 100, head: 60, life: 65 }); // mean=75 range=40
    expect(r.style).toBe('deep');
  });
});

describe('classifyByScore · 兜底分桶', () => {
  test('任意分数都返回合法类型', () => {
    for (const s of [0, 30, 55, 72, 90, 100, -5, 999]) {
      expect(PALM_TYPES[classifyByScore(s).id]).toBeTruthy();
    }
  });
});

describe('demoReport · 报告页直开兜底', () => {
  test('三线判型 → 心系·进取「燎原星火」，文案取自内容库', () => {
    const r = demoReport();
    const t = classifyPalmType(r.lines!);
    expect(t.id).toBe('heart-bold');
    expect(t.name).toBe('燎原星火');
    expect(r.summary).toBe(REPORT_CONTENT['heart-bold'].summary);
  });
});
