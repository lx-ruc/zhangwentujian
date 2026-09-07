import { headFontSizes, HEAD_CONTENT_RPX, T1_LABEL_EM, T1_LABEL_RPX, T2_LABEL_EM, T3_LABEL_EM, T3_LABEL_CHARS, T3_SEP_EM } from '../miniprogram/utils/head-fit';
import { PALM_TYPES } from '../miniprogram/data/palm-types';

/** 可见文字宽（尾随字间距不计入可见内容）：em*f + (chars-1)*ls */
function visWidth(em: number, chars: number, f: number, ls: number) {
  return em * f + (chars - 1) * ls;
}

/** 总宽（含尾随字间距，必须留 2rpx 安全余量才不换行）：em*f + chars*ls */
function advWidth(em: number, chars: number, f: number, ls: number) {
  return em * f + chars * ls;
}

test('全部 12 型：行2/3 字号完全一致（完整前缀下按较长行反推）', () => {
  for (const t of Object.values(PALM_TYPES)) {
    const f = headFontSizes(t);
    expect(f.t2).toBe(f.t3);
    expect(f.t2).toBeGreaterThanOrEqual(23);
    expect(f.t2).toBeLessThanOrEqual(31);
  }
});

test('全部 12 型：三行总宽留安全余量（绝不换行）', () => {
  for (const t of Object.values(PALM_TYPES)) {
    const f = headFontSizes(t);
    const t1 = T1_LABEL_EM * T1_LABEL_RPX + t.name.length * f.t1Name;
    const n2 = T2_LABEL_EM + t.tagline.length;
    const n3Em = T3_LABEL_EM + t.compat[0].length + T3_SEP_EM + t.compat[1].length;
    const n3Chars = T3_LABEL_CHARS + t.compat[0].length + T3_SEP_EM + t.compat[1].length;
    expect(t1).toBeLessThanOrEqual(HEAD_CONTENT_RPX);
    // 行2 无字间距时恰好 638 安全（临界浮点换行只发生在带 letter-spacing 的行）
    expect(advWidth(n2, n2, f.t2, f.t2Ls)).toBeLessThanOrEqual(HEAD_CONTENT_RPX);
    expect(advWidth(n3Em, n3Chars, f.t3, f.t3Ls)).toBeLessThanOrEqual(HEAD_CONTENT_RPX - 2);
  }
});

test('全部 12 型：每行铺满率 ≥ 98%（视觉占满）', () => {
  for (const t of Object.values(PALM_TYPES)) {
    const f = headFontSizes(t);
    const t1 = T1_LABEL_EM * T1_LABEL_RPX + t.name.length * f.t1Name;
    const n2 = T2_LABEL_EM + t.tagline.length;
    const n3Em = T3_LABEL_EM + t.compat[0].length + T3_SEP_EM + t.compat[1].length;
    const n3Chars = T3_LABEL_CHARS + t.compat[0].length + T3_SEP_EM + t.compat[1].length;
    expect(t1 / HEAD_CONTENT_RPX).toBeGreaterThanOrEqual(0.98);
    expect(visWidth(n2, n2, f.t2, f.t2Ls) / HEAD_CONTENT_RPX).toBeGreaterThanOrEqual(0.98);
    expect(visWidth(n3Em, n3Chars, f.t3, f.t3Ls) / HEAD_CONTENT_RPX).toBeGreaterThanOrEqual(0.98);
  }
});

test('行1 名称字号与行2/3 字间距均在合理范围', () => {
  for (const t of Object.values(PALM_TYPES)) {
    const f = headFontSizes(t);
    expect(f.t1Name).toBeGreaterThan(60);
    expect(f.t1Name).toBeLessThan(90);
    expect(f.t2Ls).toBeLessThanOrEqual(0.5);
    expect(f.t3Ls).toBeGreaterThanOrEqual(0);
    expect(f.t3Ls).toBeLessThanOrEqual(8);
  }
});

test('确定性：同一类型结果一致', () => {
  const t = PALM_TYPES['heart-bold'];
  expect(headFontSizes(t)).toEqual(headFontSizes(t));
});
