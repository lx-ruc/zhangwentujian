/**
 * 本地抽签引擎 —— 加权随机定型 + 反向一致分数（确定性纯函数，无 wx 依赖）
 * 运行时不再调用模型：类型由稀有度加权随机抽取，三线分数由类型反推，
 * 不变量 classifyPalmType(scoresFor(t)) === t 由 tests/draw.test.ts 锁定。
 */
import { PALM_TYPES, PALM_TYPE_LIST, PalmType, Style, TypeId } from '../data/palm-types';
import { REPORT_CONTENT } from '../data/report-content';
import { ReportResult } from '../types/index';
import { LineScores } from './classify';

/** 三条线的内部键（展示名见 report 页：感受力/思考力/行动力） */
const DOMINANT_KEYS: Array<'heart' | 'head' | 'life'> = ['heart', 'head', 'life'];

/** 可复现伪随机（同 seed → 同序列；便于单测与问题复现） */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 稀有度 → 抽取权重（'6%' → 6；数据非法时 fail loud，防手改数据静默漂移） */
export function typeWeights(): Array<{ id: TypeId; weight: number }> {
  return PALM_TYPE_LIST.map((t) => {
    const weight = parseFloat(t.rarity);
    if (!Number.isFinite(weight) || weight <= 0) {
      throw new Error(`[draw] invalid rarity for ${t.id}: "${t.rarity}"`);
    }
    return { id: t.id, weight };
  });
}

/** 稀有度加权随机抽一支（稀有签更难抽到，收藏感由数据驱动） */
export function pickType(rand: () => number): PalmType {
  const weights = typeWeights();
  const total = weights.reduce((sum, w) => sum + w.weight, 0);
  let r = rand() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i].weight;
    if (r < 0) return PALM_TYPE_LIST[i];
  }
  return PALM_TYPE_LIST[PALM_TYPE_LIST.length - 1]; // 浮点舍入兜底
}

/**
 * 风格 → 分数窗口（闭区间，整数）。
 * 由 classify.ts 阈值反推：deep 看 range≥35；bold/calm/agile 看均值区间；
 * 四组窗口主导线均严格大于其余线，并列优先分支永不触发。
 */
const STYLE_WINDOWS: Record<Style, { dominant: [number, number]; others: [number, number] }> = {
  deep: { dominant: [88, 96], others: [42, 53] },
  bold: { dominant: [85, 95], others: [66, 78] },
  calm: { dominant: [52, 62], others: [42, 50] },
  agile: { dominant: [70, 80], others: [54, 66] },
};

function randInt(rand: () => number, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

/** 类型 → 三线分数：classify(scoresFor(t)) 恒等于 t（窗口见 STYLE_WINDOWS） */
export function scoresFor(t: Pick<PalmType, 'dominant' | 'style'>, rand: () => number): LineScores {
  const win = STYLE_WINDOWS[t.style];
  const dominantScore = randInt(rand, win.dominant[0], win.dominant[1]);
  const first = randInt(rand, win.others[0], win.others[1]);
  const second = randInt(rand, win.others[0], win.others[1]);
  const rest = DOMINANT_KEYS.filter((k) => k !== t.dominant);
  const scores: LineScores = { heart: 0, head: 0, life: 0 };
  scores[t.dominant] = dominantScore;
  scores[rest[0]] = first;
  scores[rest[1]] = second;
  return scores;
}

/** 组装报告（分数由外部喂入；随机源续用于趣味评分抖动，保持调用序确定） */
export function assembleReport(t: PalmType, lines: LineScores, rand: () => number): ReportResult {
  const body = REPORT_CONTENT[t.id];
  const mean = (lines.heart + lines.head + lines.life) / 3;
  const jitter = Math.floor(rand() * 7) - 3; // ±3，同型不同次略有差异
  const funScore = Math.min(100, Math.max(0, Math.round(mean) + jitter));
  return { ...body, funScore, lines };
}

/** 组装完整报告：内容库文案 + 反向一致分数 + 带微小抖动的趣味评分 */
export function buildReport(t: PalmType, rand: () => number): ReportResult {
  return assembleReport(t, scoresFor(t, rand), rand);
}

export interface DrawOutcome {
  report: ReportResult;
  type: PalmType;
}

/** 一锤定音：seed → 类型 + 报告（确定性，同 seed 结果完全一致） */
export function drawReport(seed: number): DrawOutcome {
  const rand = mulberry32(seed);
  const type = pickType(rand);
  return { report: buildReport(type, rand), type };
}

/** 报告页直开兜底（无 globalData/历史记录时），固定 heart-bold 便于测试断言 */
export function demoReport(): ReportResult {
  return buildReport(PALM_TYPES['heart-bold'], mulberry32(1));
}
