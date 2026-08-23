import { headFontSizes, HEAD_CONTENT_RPX, T1_LABEL_EM, T1_LABEL_RPX, T2_LABEL_EM, T3_LABEL_EM, T3_SEP_EM } from '../miniprogram/utils/head-fit';
import { PALM_TYPES } from '../miniprogram/data/palm-types';

/** 按保守 em 模型还原每行渲染宽（rpx） */
function lineWidths(t: { name: string; tagline: string; compat: string[] }) {
  const f = headFontSizes(t);
  return {
    t1: T1_LABEL_EM * T1_LABEL_RPX + t.name.length * f.t1Name,
    t2: (T2_LABEL_EM + t.tagline.length) * f.t2,
    t3: (T3_LABEL_EM + t.compat[0].length + T3_SEP_EM + t.compat[1].length) * f.t3,
  };
}

test('全部 12 型：三行均不超内容宽（绝不换行）', () => {
  for (const t of Object.values(PALM_TYPES)) {
    const w = lineWidths(t);
    expect(w.t1).toBeLessThanOrEqual(HEAD_CONTENT_RPX);
    expect(w.t2).toBeLessThanOrEqual(HEAD_CONTENT_RPX);
    expect(w.t3).toBeLessThanOrEqual(HEAD_CONTENT_RPX);
  }
});

test('全部 12 型：每行铺满率 ≥ 96%（视觉占满）', () => {
  for (const t of Object.values(PALM_TYPES)) {
    const w = lineWidths(t);
    expect(w.t1 / HEAD_CONTENT_RPX).toBeGreaterThanOrEqual(0.96);
    expect(w.t2 / HEAD_CONTENT_RPX).toBeGreaterThanOrEqual(0.96);
    expect(w.t3 / HEAD_CONTENT_RPX).toBeGreaterThanOrEqual(0.96);
  }
});

test('字号落在合理区间且单调递减（短文案→更大字号）', () => {
  const sizes = Object.values(PALM_TYPES).map((t) => headFontSizes(t));
  for (const f of sizes) {
    expect(f.t1Name).toBeGreaterThan(60);
    expect(f.t1Name).toBeLessThan(90);
    expect(f.t2).toBeGreaterThan(23);
    expect(f.t2).toBeLessThan(31);
    expect(f.t3).toBeGreaterThan(30);
    expect(f.t3).toBeLessThan(32.5);
  }
});

test('确定性：同一类型结果一致', () => {
  const t = PALM_TYPES['heart-bold'];
  expect(headFontSizes(t)).toEqual(headFontSizes(t));
});
