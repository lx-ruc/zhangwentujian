/**
 * 掌纹形态测量引擎 —— 纯函数
 * 链路：照片 → 亮度网格（页面侧 canvas 采样）→ 梯度统计 → 三指标 → 12 形态型
 * 合规边界：只测量、只出事实（清晰度/密度/走向聚合），不做任何性格或命运推断。
 */

/** 形态三指标（0-1，含义见注释） */
export interface MorphMetrics {
  /** 纹路清晰度：掌心区域平均梯度强度（越大纹路越深、边界越清晰） */
  clarity: number;
  /** 纹路密度：显著边缘像素占比（越大细纹越多） */
  density: number;
  /** 走向聚合度：梯度方向一致性（高=主线大体同向，低=纹向交织） */
  coherence: number;
}

/** 显著边缘判定阈值（0-1 亮度差） */
export const EDGE_THRESHOLD = 0.06;

/**
 * 亮度网格 → 三指标。跳过四周 15% 边框，只统计掌心区域。
 * luma 为 0-1 的矩形网格（页面侧从 canvas 像素下采样得到），行列至少 4。
 */
export function computeMetrics(luma: number[][]): MorphMetrics {
  const h = luma.length;
  const w = h > 0 ? luma[0].length : 0;
  if (h < 4 || w < 4) return { clarity: 0, density: 0, coherence: 0 };

  const y0 = Math.floor(h * 0.15);
  const y1 = Math.ceil(h * 0.85);
  const x0 = Math.floor(w * 0.15);
  const x1 = Math.ceil(w * 0.85);

  let gradSum = 0;
  let edgeCount = 0;
  let dirX = 0;
  let dirY = 0;
  let dirCount = 0;
  let count = 0;

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const gx = luma[y][x + 1 < w ? x + 1 : x] - luma[y][x > 0 ? x - 1 : x];
      const gy = luma[y + 1 < h ? y + 1 : y][x] - luma[y > 0 ? y - 1 : y][x];
      const gMax = Math.max(Math.abs(gx), Math.abs(gy));
      gradSum += Math.abs(gx) + Math.abs(gy);
      if (gMax > EDGE_THRESHOLD) {
        edgeCount += 1;
        // 双角向量累加（轴向对称：θ 与 θ+π 视为同向），coherence=合成向量模/个数
        const theta2 = 2 * Math.atan2(gy, gx);
        dirX += Math.cos(theta2);
        dirY += Math.sin(theta2);
        dirCount += 1;
      }
      count += 1;
    }
  }

  if (count === 0) return { clarity: 0, density: 0, coherence: 0 };
  return {
    clarity: gradSum / count,
    density: edgeCount / count,
    coherence: dirCount > 0 ? Math.hypot(dirX, dirY) / dirCount : 0,
  };
}

/** 清晰度档位 */
export type ClarityLevel = 'deep' | 'mid' | 'light';
/** 密度档位 */
export type DensityLevel = 'sparse' | 'dense';
/** 走向档位 */
export type TrendLevel = 'aligned' | 'woven';

/** 三指标 → 档位（阈值见常量；确定性分桶，任意输入必有归属） */
export function bucketize(m: MorphMetrics): {
  clarity: ClarityLevel;
  density: DensityLevel;
  trend: TrendLevel;
} {
  return {
    clarity: m.clarity < 0.05 ? 'light' : m.clarity < 0.1 ? 'mid' : 'deep',
    density: m.density < 0.22 ? 'sparse' : 'dense',
    trend: m.coherence >= 0.45 ? 'aligned' : 'woven',
  };
}

/** 档位 → 形态型 id（与 morph-types.ts 的 12 型一一对应） */
export function classifyMorph(m: MorphMetrics): string {
  const b = bucketize(m);
  return `${b.clarity}-${b.density}-${b.trend}`;
}

/** 演示用兜底指标（报告页直开时使用，落「适中·疏朗·单向」） */
export function demoMetrics(): MorphMetrics {
  return { clarity: 0.07, density: 0.18, coherence: 0.6 };
}
