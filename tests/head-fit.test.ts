import { headFontSizes, HEAD_CONTENT_RPX, T1_LABEL_EM, T1_LABEL_RPX, T2_LABEL_EM, T3_LABEL_EM, T3_LABEL_CHARS, T3_SEP_EM } from '../miniprogram/utils/head-fit';
import { PALM_TYPES } from '../miniprogram/data/palm-types';

/** 可见文字宽（尾随字间距不计入可见内容）：em*f + (chars-1)*ls */
function visWidth(em: number, chars: number, f: number, ls: number) {
  return em * f + (chars - 1) * ls;
}

/** 总宽（含尾随字间距）：em*f + chars*ls。
 *  安全上界分两档：无字间距（ls=0）时总宽=可见宽 ≤ 638 即安全；
 *  带字间距时尾随间距参与排版宽度，必须 ≤ 636（2rpx 余量防临界浮点换行）。 */
function advWidth(em: number, chars: number, f: number, ls: number) {
  return em * f + chars * ls;
}

test('全部 12 型：行2/3 字号完全一致（完整前缀下按较长行反推）', () => {
  for (const t of Object.values(PALM_TYPES)) {
    const f = headFontSizes(t);
    expect(f.t2).toBe(f.t3);
    // 实际区间 27.7–31.9（2026-09-07 新 label 长度下 relock）
    expect(f.t2).toBeGreaterThanOrEqual(27);
    expect(f.t2).toBeLessThanOrEqual(32);
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
    // 行2：带字间距需 ≤636；无字间距时 ≤638 即安全
    const adv2 = advWidth(n2, n2, f.t2, f.t2Ls);
    expect(adv2).toBeLessThanOrEqual(f.t2Ls > 0 ? HEAD_CONTENT_RPX - 2 : HEAD_CONTENT_RPX);
    const adv3 = advWidth(n3Em, n3Chars, f.t3, f.t3Ls);
    expect(adv3).toBeLessThanOrEqual(f.t3Ls > 0 ? HEAD_CONTENT_RPX - 2 : HEAD_CONTENT_RPX);
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
    // 实际区间：t1Name 57.2（5 字名）–71.5（4 字名）；t2Ls 0–5.5（短行疏排补满）
    expect(f.t1Name).toBeGreaterThanOrEqual(55);
    expect(f.t1Name).toBeLessThanOrEqual(75);
    expect(f.t2Ls).toBeGreaterThanOrEqual(0);
    expect(f.t2Ls).toBeLessThanOrEqual(6);
    expect(f.t3Ls).toBeGreaterThanOrEqual(0);
    expect(f.t3Ls).toBeLessThanOrEqual(6);
  }
});

test('确定性：同一类型结果一致', () => {
  const t = PALM_TYPES['heart-bold'];
  expect(headFontSizes(t)).toEqual(headFontSizes(t));
});
