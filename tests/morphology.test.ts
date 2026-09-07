import { computeMetrics, bucketize, classifyMorph, demoMetrics } from '../miniprogram/utils/morphology';
import { MORPH_TYPES, MORPH_TYPE_LIST } from '../miniprogram/data/morph-types';

/** 构造亮度网格：fn(y,x) → 0-1 */
function grid(w: number, h: number, fn: (y: number, x: number) => number): number[][] {
  return Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => fn(y, x)));
}

/** 横向条带：相邻亮暗行交替（模拟大体同向的主纹路） */
function stripes(w: number, h: number, period: number, amp: number): number[][] {
  return grid(w, h, (y) => (Math.floor(y / (period / 2)) % 2 === 0 ? 0.5 - amp / 2 : 0.5 + amp / 2));
}

describe('MORPH_TYPES · 形态图鉴数据完整性', () => {
  test('12 型齐全且 id/编号/名称唯一', () => {
    expect(MORPH_TYPE_LIST).toHaveLength(12);
    expect(new Set(MORPH_TYPE_LIST.map((t) => t.id)).size).toBe(12);
    expect(new Set(MORPH_TYPE_LIST.map((t) => t.no)).size).toBe(12);
    expect(new Set(MORPH_TYPE_LIST.map((t) => t.name)).size).toBe(12);
  });

  test('形态文案零性格/命运词（合规：掌纹只出事实）', () => {
    const banned = ['性格', '人格', '命运', '缘分', '姻缘', '运势', '运气', '桃花', '财运', '倾向', '注定'];
    for (const t of MORPH_TYPE_LIST) {
      const text = JSON.stringify(t);
      for (const b of banned) expect(text.includes(b)).toBe(false);
    }
  });

  test('每型：desc 20 字+、science 12 字+、稀有度 1-30、标签齐全', () => {
    for (const t of MORPH_TYPE_LIST) {
      expect(t.desc.length).toBeGreaterThanOrEqual(20);
      expect(t.science.length).toBeGreaterThanOrEqual(12);
      expect(t.rarity).toBeGreaterThanOrEqual(1);
      expect(t.rarity).toBeLessThanOrEqual(30);
      expect(t.clarityLabel).toBeTruthy();
      expect(t.densityLabel).toBeTruthy();
      expect(t.trendLabel).toBeTruthy();
    }
  });
});

describe('computeMetrics · 合成像素', () => {
  test('横向深条带 → 深刻·繁密·同向', () => {
    const m = computeMetrics(stripes(60, 60, 8, 1.0));
    expect(m.clarity).toBeGreaterThanOrEqual(0.1);
    expect(m.density).toBeGreaterThanOrEqual(0.22);
    expect(m.coherence).toBeGreaterThanOrEqual(0.45);
    expect(classifyMorph(m)).toBe('deep-dense-aligned');
  });

  test('适中宽条带 → 适中·疏朗·同向', () => {
    const m = computeMetrics(stripes(60, 60, 24, 0.4));
    expect(m.clarity).toBeGreaterThanOrEqual(0.05);
    expect(m.clarity).toBeLessThan(0.1);
    expect(m.density).toBeLessThan(0.22);
    expect(classifyMorph(m)).toBe('mid-sparse-aligned');
  });

  test('浅淡宽条带 → 浅淡·疏朗·同向', () => {
    const m = computeMetrics(stripes(60, 60, 24, 0.2));
    expect(m.clarity).toBeLessThan(0.05);
    expect(classifyMorph(m)).toBe('light-sparse-aligned');
  });

  test('伪随机噪纹 → 纹向交织', () => {
    const m = computeMetrics(grid(60, 60, (y, x) => ((x * x * 31 + y * y * 17 + x * y * 7) % 97) / 97));
    expect(m.density).toBeGreaterThanOrEqual(0.22);
    expect(m.coherence).toBeLessThan(0.45);
    expect(classifyMorph(m)).toBe('deep-dense-woven');
  });

  test('全平网格 → 无边缘，coherence 兜底 0', () => {
    const m = computeMetrics(grid(20, 20, () => 0.5));
    expect(m.clarity).toBe(0);
    expect(m.density).toBe(0);
    expect(m.coherence).toBe(0);
    expect(classifyMorph(m)).toBe('light-sparse-woven');
  });

  test('过小网格兜底不抛错', () => {
    expect(computeMetrics([[0.5]])).toEqual({ clarity: 0, density: 0, coherence: 0 });
    expect(computeMetrics([])).toEqual({ clarity: 0, density: 0, coherence: 0 });
  });
});

describe('bucketize/classifyMorph · 分桶完备', () => {
  test('任意指标组合都有 12 型归属', () => {
    for (const clarity of [0, 0.05, 0.1, 0.5, 1]) {
      for (const density of [0, 0.22, 1]) {
        for (const coherence of [0, 0.45, 1]) {
          const id = classifyMorph({ clarity, density, coherence });
          expect(MORPH_TYPES[id]).toBeTruthy();
        }
      }
    }
  });

  test('三档清晰度边界', () => {
    expect(bucketize({ clarity: 0.049, density: 0, coherence: 1 }).clarity).toBe('light');
    expect(bucketize({ clarity: 0.05, density: 0, coherence: 1 }).clarity).toBe('mid');
    expect(bucketize({ clarity: 0.1, density: 0, coherence: 1 }).clarity).toBe('deep');
  });

  test('demoMetrics 落「适中·疏朗·同向」且类型存在', () => {
    const id = classifyMorph(demoMetrics());
    expect(id).toBe('mid-sparse-aligned');
    expect(MORPH_TYPES[id].name).toBe('平原疏朗');
  });
});
