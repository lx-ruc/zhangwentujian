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
/** 行2 label：性格底稿： */
export const T2_LABEL_EM = 5;
/** 行3 label：和你最合拍的巴掌TI是：（TI 计 1em）+ 中间全角斜线 1em */
export const T3_LABEL_EM = 11;
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
 * 一行铺满：已知字符数 n 与字号 f，求字间距。
 * 约束：含尾随字间距的总宽 n*(f+ls) ≤ 内容宽（否则末字会换行）；
 * 因此可见文字右缘留空 = ls ≈ 字间距，视觉上是均匀疏排。
 */
function spreadOf(n: number, f: number): number {
  const w = n * f;
  if (w >= HEAD_CONTENT_RPX) return 0;
  return floor1((HEAD_CONTENT_RPX - w) / n);
}

/** 头部四行字号（rpx）。t2/t3 共用字号、同号不同色，label 与值同号。 */
export function headFontSizes(t: Pick<PalmType, 'name' | 'tagline' | 'compat'>): HeadFontSizes {
  const t1Name = floor1((HEAD_CONTENT_RPX - T1_LABEL_EM * T1_LABEL_RPX) / t.name.length);
  const n2 = T2_LABEL_EM + t.tagline.length;
  const n3 = T3_LABEL_EM + t.compat[0].length + T3_SEP_EM + t.compat[1].length;
  // 行2/3 同一字号：按较长一行反推（另一行靠字间距铺满）
  const f = floor1(HEAD_CONTENT_RPX / Math.max(n2, n3));
  return { t1Name, t2: f, t2Ls: spreadOf(n2, f), t3: f, t3Ls: spreadOf(n3, f) };
}
