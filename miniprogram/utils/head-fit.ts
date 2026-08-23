/**
 * 报告页头部四行「铺满」算法
 * 规则：每行文案长度因类型而异，反推字号使每行恰好占满内容宽（不换行、不留白）。
 * 中文字符/全角标点宽 = 1em；「巴掌TI」中的拉丁 T/I 按保守 1em 计（防溢出）。
 */

import { PalmType } from '../data/palm-types';

/** 页面内容宽：750rpx 屏宽 - 左右各 56rpx 留白 */
export const HEAD_CONTENT_RPX = 638;

/** 行1 固定字号：label（你的巴掌TI是：） */
export const T1_LABEL_RPX = 44;
/** 保守 em 宽（TI 各计 1em，实际约 0.9em，余量防溢出） */
export const T1_LABEL_EM = 7;
/** 行2 label：掌纹中蕴含的性格底稿： */
export const T2_LABEL_EM = 11;
/** 行3 label：和你最合拍的巴掌TI是：（TI 计 1em）+ 中间全角斜线 1em */
export const T3_LABEL_EM = 11;
export const T3_SEP_EM = 1;

/** 向下取整到 0.1（保证 字号×字符数 ≤ 内容宽，绝不换行） */
const floor1 = (n: number) => Math.floor(n * 10) / 10;

export interface HeadFontSizes {
  /** 行1 类型名字号（rpx） */
  t1Name: number;
  /** 行2 全行字号（rpx） */
  t2: number;
  /** 行3 全行字号（rpx） */
  t3: number;
}

/** 头部四行字号（rpx）。t2/t3 整行统一字号、label 与值同号不同色。 */
export function headFontSizes(t: Pick<PalmType, 'name' | 'tagline' | 'compat'>): HeadFontSizes {
  const t1Name = floor1((HEAD_CONTENT_RPX - T1_LABEL_EM * T1_LABEL_RPX) / t.name.length);
  const t2 = floor1(HEAD_CONTENT_RPX / (T2_LABEL_EM + t.tagline.length));
  const t3 = floor1(HEAD_CONTENT_RPX / (T3_LABEL_EM + t.compat[0].length + T3_SEP_EM + t.compat[1].length));
  return { t1Name, t2, t3 };
}
