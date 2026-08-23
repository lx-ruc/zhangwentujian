import { headFontSizes, HEAD_CONTENT_RPX, T1_LABEL_EM, T1_LABEL_RPX, T2_LABEL_EM, T3_LABEL_EM, T3_SEP_EM } from '../miniprogram/utils/head-fit';
import { PALM_TYPES } from '../miniprogram/data/palm-types';

/** 可见文字宽（尾随字间距不计入可见内容）：n*f + (n-1)*ls */
function visWidth(n: number, f: number, ls: number) {
  return n * f + (n - 1) * ls;
}

test('全部 12 型：行2/3 字号完全一致', () => {
  for (const t of Object.values(PALM_TYPES)) {
    const f = headFontSizes(t);
    expect(f.t2).toBe(f.t3);
    expect(f.t2).toBeGreaterThanOrEqual(30);
    expect(f.t2).toBeLessThanOrEqual(32);
  }
});

test('全部 12 型：三行可见文字不超内容宽（绝不换行）', () => {
  for (const t of Object.values(PALM_TYPES)) {
    const f = headFontSizes(t);
    const t1 = T1_LABEL_EM * T1_LABEL_RPX + t.name.length * f.t1Name;
    const t2 = visWidth(T2_LABEL_EM + t.tagline.length, f.t2, f.t2Ls);
    const t3 = visWidth(T3_LABEL_EM + t.compat[0].length + T3_SEP_EM + t.compat[1].length, f.t3, f.t3Ls);
    expect(t1).toBeLessThanOrEqual(HEAD_CONTENT_RPX);
    expect(t2).toBeLessThanOrEqual(HEAD_CONTENT_RPX);
    expect(t3).toBeLessThanOrEqual(HEAD_CONTENT_RPX);
  }
});

test('全部 12 型：每行铺满率 ≥ 98%（视觉占满）', () => {
  for (const t of Object.values(PALM_TYPES)) {
    const f = headFontSizes(t);
    const t1 = T1_LABEL_EM * T1_LABEL_RPX + t.name.length * f.t1Name;
    const t2 = visWidth(T2_LABEL_EM + t.tagline.length, f.t2, f.t2Ls);
    const t3 = visWidth(T3_LABEL_EM + t.compat[0].length + T3_SEP_EM + t.compat[1].length, f.t3, f.t3Ls);
    expect(t1 / HEAD_CONTENT_RPX).toBeGreaterThanOrEqual(0.98);
    expect(t2 / HEAD_CONTENT_RPX).toBeGreaterThanOrEqual(0.98);
    expect(t3 / HEAD_CONTENT_RPX).toBeGreaterThanOrEqual(0.98);
  }
});

test('行2 字号不小于改动前（调大）且字间距在合理范围', () => {
  for (const t of Object.values(PALM_TYPES)) {
    const f = headFontSizes(t);
    expect(f.t1Name).toBeGreaterThan(60);
    expect(f.t1Name).toBeLessThan(90);
    expect(f.t2).toBeGreaterThanOrEqual(30);
    expect(f.t2Ls).toBeGreaterThanOrEqual(0);
    expect(f.t2Ls).toBeLessThanOrEqual(12);
    expect(f.t3Ls).toBeLessThanOrEqual(2);
  }
});

test('确定性：同一类型结果一致', () => {
  const t = PALM_TYPES['heart-bold'];
  expect(headFontSizes(t)).toEqual(headFontSizes(t));
});
