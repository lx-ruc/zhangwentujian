/**
 * 手掌图渲染器 —— 掌纹问答选项卡的矢量图（纯几何 + Canvas 绘制，无图片资产）
 * 轮廓与三条主线取自 design/hand-paths.json（freesvg.org #36174，CC0 Public Domain），
 * 路径字符串内嵌本文件；运行时解析 SVG path → 折线 → 形态变体 → canvas 2d 描线。
 * 交互约定：选中选项的「所问线」描朱砂红，未选中为墨色；衬底线恒为淡墨。
 * 收界约定：所有掌纹线（含衬底线）先经 trimInside 几何裁剪回轮廓内，绘制时再以轮廓
 * nonzero clip 兜底——线条任何情况下不允许画到掌外/指缝里（轮廓有自重叠，判内必须用
 * nonzero 环绕数，与 canvas fill/clip 默认规则一致）。
 */
import { QuestionId } from '../data/quiz-questions';

export interface Pt {
  x: number;
  y: number;
}

/** viewBox 0 0 481 588（与 hand-paths.json 一致） */
export const VIEW_BOX = { w: 481, h: 588 };

const PATH_OUTLINE =
  'm267 520.36c-8.39 1.99-18.29 4.32-25 6-8.13 0.52-16.22 1-24-2-6.45-3.51-15.53-7.05-24-8-10.88-4.22-21.13-9.81-30-18-13.75-7.79-18.58-22.77-27-35-10.46-13.4-18.77-28.08-29.5-41.5-4.69-6.25-11.724-19.01-21.5-33.5-8.391-12.26-18.788-34.21-21.5-42.5-2.352-5.12-8.51-20.12-12.5-29.5-4.237-8.45-11.19-21.26-16-29-4.403-7.08-4-25.08-4-32 1.167-9.16 8.727-9.21 10.5-9.5 5.41-0.86 18.573-2.48 23.5 1.5 16.708 5.3 24.229 16.17 32 32 2.54 5.09 6.98 20.99 11 25 13.82 13.14 19.45 24.31 24.5 31.5 3.38 5.88 10.57 10.29 15.5 11.5 5 2.34 9.71-5.94 12-8.5 5.65-6.3 6.9-13.08 7-21 0.06-4.63 0.34-12.23 1-17.5 1.29-10.23 0.78-17.38 1-24.5 0.26-8.2-5-18.44-5-28.5-2.08-7.59-1.23-24.6-1-31 0.34-9.56-1-25.55-1.5-33-0.46-6.88-4.17-23.89-4.5-33-0.38-10.56-3.67-29.03-4-40-0.21-6.85 0.92-18.848 1.5-24.998 0.61-6.465 1.05-17.797 1-25.5-0.03-4.758 3.35-12.393 8-16 6.66-7.161 20.06-11.471 28.5-5 11.31 8.187 10.18 16.194 12.5 21 3.62 7.479 2.67 16.834 3.5 24.5 0.63 7.912 1.43 15.541 0 28.498 0 5.7 0.54 18.06 1 25.5 0.5 8.08 2.94 24.11 4 30 1.59 8.82 3.5 24.4 3 32.5-0.66 10.72 2.16 22.3 3 29.5 0.88 7.58 6.8 18.96 12 23.5 4 3.49 11.5-5.27 11.5-17-1.03-17.06 2.54-36.37 2-43.5-0.48-6.33 0.5-13.66 0.5-15-0.81-3.23 0-6.66 0-10 0-7.24-2.64-16.53-2-26 0.39-5.82-0.59-21.62-1-30 0-21.783-0.56-9.93-0.5-19.498 0.04-6.329 1.9-19.102 3-23.5 0.32-10.239 2.96-20.96 5-28 3.25-9.011 11.56-22.292 23.5-23 16.57 0.799 20.31 7.524 21 17.5 0.27 3.915 1.33 16.334 2 20 0.26 5.475 1.16 18.152 1.5 25 0.41 8.209 2.52 20.268 3 27.498 0.28 4.2-1.43 15.86-1 24-1.9 8.3 0.5 20.27 0.5 29.5v28.5c0 12.29-3.13 22.76-1 33 0.89 4.31 1.93 16.73 6.5 17.5 7.65 1.3 15.33-12.22 17.5-34.5 1.33-14.18 4-28.48 4-40-1.64-6.55 4.22-26.79 6-33.5 2.82-10.64 4.25-22.99 7-31-1.28-12.496 3.29-25.14 5-37.498 2.5-9.138 5.27-19.272 12-22 6.5-5.714 13.83-3.333 18-1.5 7 5.251 9.57 12.745 11.5 20.5 1.59 6.393-0.17 17.667-1 23.5 0.01 8.029 0.61 17.838 0 26.998-0.6 9.01-3 19.78-3 27 0.11 9.98-1.5 25.28-1.5 37-2.23 14.72-3 28.93-6 43.5-2.06 9.7-7.43 23.24-7.5 34 0 9.27-4.6 21.31 7.5 23 7 8.37 16.35-17.31 20.5-25 4.81-11.42 11.42-28.99 14-37 2.85-7.75 9.2-18.63 11.5-26 6.02-12.05 8.67-22.39 11-30.5 3.97-7.93 11.52-14.63 17-15.5 7.33-1.16 13.35 4.89 18 12 3.01 7.98-0.4 20.31-2 32-3.05 15.17-6.98 28.59-10.43 37.31-2.48 6.25-8.74 19.99-11.57 28.23-3.35 8.1-7.22 18.91-10.41 24.88-3.51 6.55-9.89 15.88-12.09 24.58-3.14 12.57-3.5 23.31-3.5 33 0 6.21-2 11.75-2 20 0.77 10.25-3.24 19.77-2 30 0.65 2.59 0.5 10.34-0.5 17 0.82 9.79-3.89 22.56-5.5 29-1.94 7.75-7 25.13-7 28.5-8.96 16.43-9.84 28.18-15.5 36-4.85 6.2-9.82 15.24-15.5 19.5-4.68 3.51-9.71 7.86-14 10-8.01 4.39-17 8.76-31 10-9.61-0.87-20.68-5.17-27-6-9.52-4.48-20.63-7.43-31-8z';
const PATH_HEART =
  'm196 269.36c14.46-5.14 34.25-14.22 45.5-17 12.09-2 25.23-5.11 31.5-7 14.43-2.17 30.28-6.24 43-2 11.31 2.1 24.95 10.88 32.5 14 6.91 3.8 17.04 13.59 23.5 17.5 8.29 5.02 17.65 14.12 21.5 17';
const PATH_HEAD =
  'm220.5 288.36c9.77 7.27 24.24 15 31.5 18 4.95 2.05 20.61 6.81 27 9.5 6.83 3.5 21.49 3.73 29 6.5 13.97 2.92 20.99 4.43 34 10 14.25 4.6 27.43 3.35 37 9';
const PATH_LIFE =
  'm204 312.36c6.66-0.37 21.01 12.02 32 21 8.6 9.32 21.21 25.42 26.5 35 4.53 9.07 10.98 23.8 13.5 33.5 2.58 9.96 7 25.75 8 38.5 1 12.67 4.73 30.9 4 42';

// ---------------------------------------------------------------- SVG path 解析

/** 解析 SVG path data（M/L/H/V/C/S/Q/T/Z 及小写相对坐标）为折线子路径组 */
export function parseSvgPath(d: string): Pt[][] {
  const tokens = d.match(/[MmLlHhVvCcSsQqTtZz]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || [];
  const subpaths: Pt[][] = [];
  let cur: Pt = { x: 0, y: 0 };
  let start: Pt = { x: 0, y: 0 };
  let ctrl: Pt | null = null;
  let points: Pt[] = [];
  let cmd = '';
  let i = 0;

  const num = (): number => parseFloat(tokens[i++]);
  const push = (p: Pt) => {
    points.push(p);
  };
  const cubic = (p1: Pt, p2: Pt, p3: Pt) => {
    const STEPS = 14;
    for (let s = 1; s <= STEPS; s++) {
      const t = s / STEPS;
      const mt = 1 - t;
      push({
        x: mt * mt * mt * cur.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x,
        y: mt * mt * mt * cur.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y,
      });
    }
    ctrl = p2;
    cur = p3;
  };
  const quad = (p1: Pt, p2: Pt) => {
    const STEPS = 10;
    for (let s = 1; s <= STEPS; s++) {
      const t = s / STEPS;
      const mt = 1 - t;
      push({
        x: mt * mt * cur.x + 2 * mt * t * p1.x + t * t * p2.x,
        y: mt * mt * cur.y + 2 * mt * t * p1.y + t * t * p2.y,
      });
    }
    ctrl = p1;
    cur = p2;
  };
  /** S/T 的控制点反射（闭包赋值不受流分析追踪，经参数还原联合类型） */
  const reflect = (c: Pt | null): Pt =>
    c ? { x: 2 * cur.x - c.x, y: 2 * cur.y - c.y } : { x: cur.x, y: cur.y };

  while (i < tokens.length) {
    const tok = tokens[i];
    if (/[MmLlHhVvCcSsQqTtZz]/.test(tok)) {
      cmd = tok;
      i++;
      continue;
    }
    const rel = cmd === cmd.toLowerCase();
    const r = (): Pt => ({ x: cur.x, y: cur.y });
    switch (cmd.toLowerCase()) {
      case 'm': {
        const p = { x: num(), y: num() };
        const abs = rel ? { x: r().x + p.x, y: r().y + p.y } : p;
        if (points.length > 0) subpaths.push(points);
        points = [abs];
        cur = abs;
        start = abs;
        ctrl = null;
        cmd = rel ? 'l' : 'L'; // 后续隐式坐标按直线继续
        break;
      }
      case 'l': {
        const p = { x: num(), y: num() };
        const abs = rel ? { x: r().x + p.x, y: r().y + p.y } : p;
        push(abs);
        cur = abs;
        ctrl = null;
        break;
      }
      case 'h': {
        const v = num();
        cur = { x: rel ? cur.x + v : v, y: cur.y };
        push(cur);
        ctrl = null;
        break;
      }
      case 'v': {
        const v = num();
        cur = { x: cur.x, y: rel ? cur.y + v : v };
        push(cur);
        ctrl = null;
        break;
      }
      case 'c': {
        const d1 = { x: num(), y: num() };
        const d2 = { x: num(), y: num() };
        const d3 = { x: num(), y: num() };
        cubic(
          rel ? { x: cur.x + d1.x, y: cur.y + d1.y } : d1,
          rel ? { x: cur.x + d2.x, y: cur.y + d2.y } : d2,
          rel ? { x: cur.x + d3.x, y: cur.y + d3.y } : d3,
        );
        break;
      }
      case 's': {
        const d2 = { x: num(), y: num() };
        const d3 = { x: num(), y: num() };
        const reflected = reflect(ctrl);
        cubic(
          reflected,
          rel ? { x: cur.x + d2.x, y: cur.y + d2.y } : d2,
          rel ? { x: cur.x + d3.x, y: cur.y + d3.y } : d3,
        );
        break;
      }
      case 'q': {
        const d1 = { x: num(), y: num() };
        const d2 = { x: num(), y: num() };
        quad(
          rel ? { x: cur.x + d1.x, y: cur.y + d1.y } : d1,
          rel ? { x: cur.x + d2.x, y: cur.y + d2.y } : d2,
        );
        break;
      }
      case 't': {
        const d2 = { x: num(), y: num() };
        quad(reflect(ctrl), rel ? { x: cur.x + d2.x, y: cur.y + d2.y } : d2);
        break;
      }
      case 'z': {
        push(start);
        cur = start;
        ctrl = null;
        break;
      }
      default:
        throw new Error(`[chart] unsupported path command: ${cmd}`);
    }
  }
  if (points.length > 1) subpaths.push(points);
  return subpaths;
}

// ---------------------------------------------------------------- 几何变体

/** 按累计弧长参数截取折线片段（t∈[0,1]，纯函数返回新数组） */
export function slicePolyline(pts: Pt[], t0: number, t1: number): Pt[] {
  if (pts.length < 2 || t0 >= t1) return [];
  const lens: number[] = [0];
  let total = 0;
  for (let k = 1; k < pts.length; k++) {
    total += Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y);
    lens.push(total);
  }
  const lo = t0 * total;
  const hi = t1 * total;
  const out: Pt[] = [];
  for (let k = 0; k < pts.length; k++) {
    if (lens[k] < lo - 1e-6 || lens[k] > hi + 1e-6) continue;
    out.push(pts[k]);
  }
  return out.length < 2 ? [] : out;
}

/** 纵向压扁（y 向中线上下按系数 k 收拢；k=1 原样） */
export function flattenY(pts: Pt[], k: number): Pt[] {
  const ys = pts.map((p) => p.y);
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  return pts.map((p) => ({ x: p.x, y: cy + (p.y - cy) * k }));
}

/** 三控制点合成曲线折线（辅线用：起/止 + 一个鼓点） */
export function synthStroke(a: Pt, bump: Pt, b: Pt): Pt[] {
  return parseSvgPath(`M${a.x} ${a.y}Q${bump.x} ${bump.y} ${b.x} ${b.y}`)[0];
}

/** 折线总弧长 */
function arcLen(pts: Pt[]): number {
  let sum = 0;
  for (let k = 1; k < pts.length; k++) {
    sum += Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y);
  }
  return sum;
}

/** 环绕数（nonzero 规则，与 canvas fill/clip 默认一致）：≠0 即在轮廓内 */
export function windingNumber(poly: Pt[], p: Pt): number {
  let w = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    const cross = (b.x - a.x) * (p.y - a.y) - (p.x - a.x) * (b.y - a.y);
    if (a.y <= p.y) {
      if (b.y > p.y && cross > 0) w++;
    } else if (b.y <= p.y && cross < 0) w--;
  }
  return w;
}

const lerpPt = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/** 线段 a→b 与多边形全部边的最近交点参数 t∈(0,1)；无交点返回 -1 */
function firstCrossT(a: Pt, b: Pt, poly: Pt[]): number {
  let best = -1;
  const r = b.x - a.x;
  const s = b.y - a.y;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const c = poly[j];
    const d = poly[i];
    const u = d.x - c.x;
    const v = d.y - c.y;
    const denom = r * v - s * u;
    if (Math.abs(denom) < 1e-12) continue;
    const t = ((c.x - a.x) * v - (c.y - a.y) * u) / denom;
    const q = ((c.x - a.x) * s - (c.y - a.y) * r) / denom;
    if (t > 1e-6 && t < 1 - 1e-6 && q >= 0 && q <= 1 && (best < 0 || t < best)) best = t;
  }
  return best;
}

/** 沿轮廓把折线裁回掌内：保留「在轮廓内」的连续段，端头外延到边界交点再沿方向内缩 inset；短于 minLen 的碎段丢弃 */
export function trimInside(pts: Pt[], poly: Pt[], inset = 12, minLen = 15): Pt[][] {
  const inside = (p: Pt) => windingNumber(poly, p) !== 0;
  const runs: Array<{ i: number; j: number }> = [];
  let i = 0;
  while (i < pts.length) {
    if (!inside(pts[i])) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < pts.length && inside(pts[j + 1])) j++;
    if (j - i + 1 >= 2) runs.push({ i, j });
    i = j + 1;
  }
  /** 边界交点（edge→inPt 路上）向内收缩 inset，交点离 inPt 太近则直接用 inPt */
  const extend = (edge: Pt, inPt: Pt): Pt => {
    const t = firstCrossT(edge, inPt, poly);
    if (t < 0) return inPt;
    const c = lerpPt(edge, inPt, t);
    const d = Math.hypot(inPt.x - c.x, inPt.y - c.y);
    return d <= inset ? inPt : lerpPt(c, inPt, inset / d);
  };
  const out: Pt[][] = [];
  for (const { i: lo, j: hi } of runs) {
    const head = lo > 0 ? extend(pts[lo - 1], pts[lo]) : pts[lo];
    const tail = hi < pts.length - 1 ? extend(pts[hi + 1], pts[hi]) : pts[hi];
    const seg = [head, ...pts.slice(lo + 1, hi), tail];
    if (seg.length >= 2 && arcLen(seg) >= minLen) out.push(seg);
  }
  return out;
}

// ---------------------------------------------------------------- 选项图组装

export interface ChartSpec {
  /** 左手镜像 */
  mirror: boolean;
  /** 手掌轮廓（墨） */
  outline: Pt[][];
  /** 淡墨衬底线（未提问的主线 / 提问辅线时的主线三条） */
  context: Pt[][];
  /** 所问线的形态（可多段：断续形），选中时朱砂、未选墨色 */
  focus: Pt[][];
  focusWidth: number;
}

const GEOM = {
  outline: parseSvgPath(PATH_OUTLINE),
  heart: parseSvgPath(PATH_HEART)[0],
  head: parseSvgPath(PATH_HEAD)[0],
  life: parseSvgPath(PATH_LIFE)[0],
};

/** 轮廓闭环（freesvg 轮廓为单条 1318 点自闭合折线） */
const OUTLINE_LOOP = GEOM.outline[0];

/** 主线形态 → 折线（与 quiz-questions.ts 四档一一对应：0 深长 / 1 明快 / 2 平缓 / 3 浅淡）；统一裁回掌内 */
export function mainLineVariant(lineKey: 'heart' | 'head' | 'life', variant: number): Pt[][] {
  const base = GEOM[lineKey];
  let polys: Pt[][];
  switch (variant) {
    case 0:
      polys = [base];
      break;
    case 1:
      polys = [slicePolyline(base, 0, 0.74)];
      break;
    case 2:
      polys = [flattenY(base, 0.5)];
      break;
    case 3:
      polys = [slicePolyline(base, 0.06, 0.62)];
      break;
    default:
      throw new Error(`[chart] bad variant: ${variant}`);
  }
  return polys.flatMap((p) => trimInside(p, OUTLINE_LOOP));
}

/** 衬底线固定用主线 0 档（已裁剪），三条主线题与辅线题共用 */
const MAIN_TRIMMED: Record<'heart' | 'head' | 'life', Pt[][]> = {
  heart: mainLineVariant('heart', 0),
  head: mainLineVariant('head', 0),
  life: mainLineVariant('life', 0),
};

/** 辅线基线：缘分线（小指下方短横）、灵感线（自中部斜向上）。控制点取自掌内实测安全区：小指侧指缝空腔（x≈375-400）下探到 y≈270+，须避开；小指柱 x≈405-450 自 y≈210 起全在掌内，可放短横 */
function auxBase(qid: 'bond' | 'insight'): Pt[] {
  if (qid === 'bond') return synthStroke({ x: 405, y: 272 }, { x: 422, y: 248 }, { x: 440, y: 256 });
  return synthStroke({ x: 330, y: 332 }, { x: 350, y: 302 }, { x: 370, y: 280 });
}

/** 辅线形态 → 折线（0 深长清晰 / 1 断续错落 / 2 浅短若隐）；统一裁回掌内 */
export function auxLineVariant(qid: 'bond' | 'insight', variant: number): Pt[][] {
  const base = auxBase(qid);
  let polys: Pt[][];
  switch (variant) {
    case 0:
      polys = [base];
      break;
    case 1:
      polys = [slicePolyline(base, 0, 0.42), slicePolyline(base, 0.55, 1)];
      break;
    case 2:
      // 浅短档要短于 v0 但仍可辨走向（端头贴近边界，trim 内缩会再吃掉一截，切片须放宽）
      polys = [slicePolyline(base, 0.05, 0.8)];
      break;
    default:
      throw new Error(`[chart] bad variant: ${variant}`);
  }
  // 辅线本就是短横，断续档碎片更短：minLen 放宽到 8，只滤真实碎渣
  return polys.flatMap((p) => trimInside(p, OUTLINE_LOOP, 12, 8));
}

/** 惯用手题不画焦点线，只看轮廓方向 */
export function chartForOption(qid: QuestionId, optionIndex: number): ChartSpec {
  const mirror = qid === 'hand' && optionIndex === 0;
  switch (qid) {
    case 'hand':
      return { mirror, outline: GEOM.outline, context: [], focus: [], focusWidth: 0 };
    case 'heart':
    case 'head':
    case 'life': {
      const other = (['heart', 'head', 'life'] as const).filter((k) => k !== qid).map((k) => MAIN_TRIMMED[k]).flat();
      const width = [9, 7, 6.5, 4.5][optionIndex] ?? 6;
      return { mirror, outline: GEOM.outline, context: other, focus: mainLineVariant(qid, optionIndex), focusWidth: width };
    }
    case 'bond':
    case 'insight': {
      const width = [7, 5.5, 4][optionIndex] ?? 5;
      return {
        mirror,
        outline: GEOM.outline,
        context: [MAIN_TRIMMED.heart, MAIN_TRIMMED.head, MAIN_TRIMMED.life].flat(),
        focus: auxLineVariant(qid, optionIndex),
        focusWidth: width,
      };
    }
    default:
      throw new Error(`[chart] bad question: ${qid}`);
  }
}

// ---------------------------------------------------------------- Canvas 绘制

export interface ChartCtx {
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  closePath(): void;
  stroke(): void;
  clip(): void;
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  scale(x: number, y: number): void;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  globalAlpha: number;
  lineCap: 'round' | 'butt' | 'square';
}

export const CHART_COLORS = {
  ink: '#26211A',
  inkFaint: 'rgba(38,33,26,0.16)',
  cinnabar: '#BC3F21',
};

/** 把一组折线按 viewBox 等比缩放进 w×h 画布（含镜像），逐段描线 */
export function renderOptionChart(
  ctx: ChartCtx,
  w: number,
  h: number,
  spec: ChartSpec,
  selected: boolean,
): void {
  const s = Math.min(w / VIEW_BOX.w, h / VIEW_BOX.h);
  const ox = (w - VIEW_BOX.w * s) / 2;
  const oy = (h - VIEW_BOX.h * s) / 2;
  ctx.save();
  if (spec.mirror) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  ctx.lineCap = 'round';

  const strokeGroup = (paths: Pt[][], color: string, width: number, alpha: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.globalAlpha = alpha;
    for (const poly of paths) {
      if (poly.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let k = 1; k < poly.length; k++) ctx.lineTo(poly[k].x, poly[k].y);
      ctx.stroke();
    }
  };

  // 变换链：镜像（如有）后居中缩放，画 viewBox 坐标
  ctx.translate(ox, oy);
  ctx.scale(s, s);
  strokeGroup(spec.outline, CHART_COLORS.ink, 5, 0.9);
  // 掌纹线一律裁在轮廓内（nonzero clip，兜底线宽/圆头外溢）
  ctx.save();
  ctx.beginPath();
  for (const poly of spec.outline) {
    if (poly.length < 2) continue;
    ctx.moveTo(poly[0].x, poly[0].y);
    for (let k = 1; k < poly.length; k++) ctx.lineTo(poly[k].x, poly[k].y);
    ctx.closePath();
  }
  ctx.clip();
  strokeGroup(spec.context, CHART_COLORS.ink, 5, 0.16);
  if (spec.focus.length > 0 && spec.focusWidth > 0) {
    const color = selected ? CHART_COLORS.cinnabar : CHART_COLORS.ink;
    strokeGroup(spec.focus, color, spec.focusWidth, 1);
  }
  ctx.restore();
  ctx.restore();
}
