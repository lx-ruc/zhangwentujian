/**
 * 报告页头部四行「铺满」算法
 * 规则：每行文案长度因类型而异，反推字号使每行恰好占满内容宽（不换行、不留白）。
 * 行2/3 字号保持一致：取两行中较长一行的上限反推，较短的行用 letter-spacing 补满。
 * 中文字符/全角标点宽 = 1em；「巴掌TI」中的拉丁 T/I 按保守 1em 计（防溢出）。
 */

import { PalmType } from '../data/palm-types';

/** 页面内容宽：750rpx 屏宽 - 左右各 56rpx 留白 */
export const HEAD_CONTENT_RPX = 638;

/** 行1 固定字号：label（你的巴掌TI是：） */
export const T1_LABEL_RPX = 44;
/** 保守 em 宽（TI 各计 1em，实际约 0.9em，余量防溢出） */
export const T1_LABEL_EM = 7;
/** 行2 label：掌纹中蕴含的性格底稿：（完整文案，不缩字） */
export const T2_LABEL_EM = 11;
/** 行3 label：和你最合拍的巴掌TI是：（TI 保守计 1em 宽，但字间距按 2 个字符叠加）+ 中间全角斜线 1em */
export const T3_LABEL_EM = 11;
/** 行3 label 实际字符数：TI 是 2 个字符（letter-spacing 按字符叠加） */
export const T3_LABEL_CHARS = 12;
export const T3_SEP_EM = 1;

/** 向下取整到 0.1（保证 字号×字符数 ≤ 内容宽，绝不换行） */
const floor1 = (n: number) => Math.floor(n * 10) / 10;

export interface HeadFontSizes {
  /** 行1 类型名字号（rpx） */
  t1Name: number;
  /** 行2 字号（rpx，与行3 一致） */
  t2: number;
  /** 行2 字间距（rpx，补满宽度用，长文案为 0） */
  t2Ls: number;
  /** 行3 字号（rpx，与行2 一致） */
  t3: number;
  /** 行3 字间距（rpx） */
  t3Ls: number;
}

/**
 * 一行铺满：已知 em 宽与字符数，求字间距。
 * em 宽决定裸字宽，字间距按字符数叠加（含尾随 1 个间距）；
 * 总宽必须留有安全余量（< 内容宽 - 2rpx），否则贴边浮点舍入会导致末字换行；
 * 可见文字右缘留空 = ls ≈ 字间距，视觉上是均匀疏排。
 */
function spreadOf(em: number, chars: number, f: number): number {
  const target = HEAD_CONTENT_RPX - 2; // 2rpx 安全余量防临界换行
  const w = em * f;
  if (w >= target) return 0;
  return floor1((target - w) / chars);
}

/** 头部四行字号（rpx）。t2/t3 共用字号、同号不同色，label 与值同号。 */
export function headFontSizes(t: Pick<PalmType, 'name' | 'tagline' | 'compat'>): HeadFontSizes {
  const t1Name = floor1((HEAD_CONTENT_RPX - T1_LABEL_EM * T1_LABEL_RPX) / t.name.length);
  const n2 = T2_LABEL_EM + t.tagline.length; // 行2 全 CJK：em 数 = 字符数
  const n3Em = T3_LABEL_EM + t.compat[0].length + T3_SEP_EM + t.compat[1].length;
  const n3Chars = T3_LABEL_CHARS + t.compat[0].length + T3_SEP_EM + t.compat[1].length;
  // 行2/3 同一字号：按较长一行反推（另一行靠字间距铺满）
  const f = floor1(HEAD_CONTENT_RPX / Math.max(n2, n3Em));
  return {
    t1Name,
    t2: f,
    t2Ls: spreadOf(n2, n2, f),
    t3: f,
    t3Ls: spreadOf(n3Em, n3Chars, f),
  };
}
