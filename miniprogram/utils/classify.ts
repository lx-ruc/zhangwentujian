/**
 * 掌纹人格分类 —— 三主线数值 → 12 型图鉴（确定性纯函数）
 * 类型集合封闭，模型不参与分类（集合可控、图鉴体系稳定）
 */
import { PALM_TYPES, Dominant, Style, TypeId, PalmType } from '../data/palm-types';

export interface LineScores {
  heart: number;
  head: number;
  life: number;
}

/** 极差 ≥ 此值视为"偏科"（深沉型） */
const DEEP_RANGE = 35;
/** 均值 ≥ 此值为进取型 */
const BOLD_MEAN = 72;
/** 均值 ≤ 此值为沉稳型 */
const CALM_MEAN = 55;

export function classifyPalmType(lines: LineScores): PalmType {
  const clamp = (v: number) => Math.min(100, Math.max(0, Math.round(v)));
  const h = clamp(lines.heart);
  const d = clamp(lines.head);
  const l = clamp(lines.life);

  // 主导线：最大者；并列时优先序 heart > head > life（与图鉴编号顺序一致）
  const entries: Array<[Dominant, number]> = [
    ['heart', h],
    ['head', d],
    ['life', l],
  ];
  entries.sort((a, b) => b[1] - a[1]);
  const dominant = entries[0][0];

  // 风格：偏科 → 深沉；否则按均值分档
  const mean = (h + d + l) / 3;
  const range = Math.max(h, d, l) - Math.min(h, d, l);
  let style: Style;
  if (range >= DEEP_RANGE) style = 'deep';
  else if (mean >= BOLD_MEAN) style = 'bold';
  else if (mean <= CALM_MEAN) style = 'calm';
  else style = 'agile';

  return PALM_TYPES[`${dominant}-${style}` as TypeId];
}

/** 无三线数据时的兜底：按趣味评分分桶（保证人人有型） */
export function classifyByScore(score: number): PalmType {
  const s = Math.min(100, Math.max(0, Math.round(score)));
  if (s >= 85) return PALM_TYPES['head-bold'];
  if (s >= 70) return PALM_TYPES['heart-agile'];
  if (s >= 55) return PALM_TYPES['life-agile'];
  return PALM_TYPES['life-calm'];
}
