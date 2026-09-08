/**
 * 掌纹图几何锁定测试
 * 1) 收界：所有题目×档位的焦点线/衬底线每一点都必须在轮廓内（nonzero 环绕数，
 *    与 canvas fill/clip 默认规则一致——轮廓是自重叠闭环，even-odd 不可用）；
 * 2) 可辨性：各题焦点线弧长下限（真机画布 ≈0.316px/viewBox 单位，过短即成点/碎渣）；
 * 3) 档位语义：辅线断续档恰为两段；
 * 4) trimInside 单元 + renderOptionChart 绘制顺序（clip 在掌纹线之前、轮廓之后）。
 */
import {
  ChartCtx,
  Pt,
  chartForOption,
  renderOptionChart,
  trimInside,
  windingNumber,
} from '../miniprogram/utils/palm-chart';

const MAIN_QIDS = ['heart', 'head', 'life'] as const;
const AUX_QIDS = ['bond', 'insight'] as const;
const LINE_QIDS = [...MAIN_QIDS, ...AUX_QIDS] as const;

/** 主线 4 档（深长/明快/平缓/浅淡），辅线 3 档（深长清晰/断续错落/浅短若隐），惯用手题无线 */
const variantCount = (qid: string): number => (qid === 'bond' || qid === 'insight' ? 3 : 4);

const outlineLoop = (): Pt[] => chartForOption('heart', 0).outline[0];

const arcLen = (polys: Pt[][]): number =>
  polys.reduce(
    (n, poly) =>
      n + poly.slice(1).reduce((m, p, k) => m + Math.hypot(p.x - poly[k].x, p.y - poly[k].y), 0),
    0,
  );

const outsideCount = (polys: Pt[][], outline: Pt[]): number =>
  polys.reduce((n, poly) => n + poly.filter((p) => windingNumber(outline, p) === 0).length, 0);

describe('收界：掌纹线全面收在掌内', () => {
  test('全部题目×档位，焦点线与衬底线的每一点都在轮廓内', () => {
    const outline = outlineLoop();
    for (const qid of LINE_QIDS) {
      for (let v = 0; v < variantCount(qid); v++) {
        const spec = chartForOption(qid, v);
        expect(outsideCount(spec.focus, outline)).toBe(0);
        expect(outsideCount(spec.context, outline)).toBe(0);
      }
    }
  });

  test('惯用手题：无焦点线/衬底线，左手镜像、右手不镜像', () => {
    const left = chartForOption('hand', 0);
    const right = chartForOption('hand', 1);
    expect(left.focus).toHaveLength(0);
    expect(left.context).toHaveLength(0);
    expect(left.mirror).toBe(true);
    expect(right.mirror).toBe(false);
  });
});

describe('凹向：情感线为凹弧（中段下凹，两端偏高）', () => {
  /** 凹弧判据：最高点落在两端 18% 内（凸拱的最高点在中段），且最低点比两端各自至少低 8 */
  const concave = (focus: Pt[][]) => {
    const pts = focus.flat();
    const xs = pts.map((p) => p.x);
    const lo = Math.min(...xs);
    const hi = Math.max(...xs);
    const highest = pts.reduce((a, b) => (b.y < a.y ? b : a));
    const deepest = pts.reduce((a, b) => (b.y > a.y ? b : a));
    const ends = [focus[0][0], focus[focus.length - 1][focus[focus.length - 1].length - 1]];
    return {
      topAtEnd: highest.x - lo <= (hi - lo) * 0.18 || hi - highest.x <= (hi - lo) * 0.18,
      sagOk: ends.every((e) => deepest.y - e.y >= 8),
      deepestMidFrac: (deepest.x - lo) / (hi - lo),
    };
  };

  test('情感线全档位保持凹向（2026-09-08 用户纠正：凸拱→凹弧）', () => {
    // 整线档：最高点在端部 + 最低点比两端各深 ≥8（完整凹弧）
    const full = concave(chartForOption('heart', 0).focus);
    expect(full.topAtEnd).toBe(true);
    expect(full.sagOk).toBe(true);
    // 截取/压扁档右端可能就切在凹底：只锁「最高点在端部」（凸拱最高点在中段，必挂）
    for (let v = 1; v < 4; v++) {
      expect(concave(chartForOption('heart', v).focus).topAtEnd).toBe(true);
    }
  });
});

describe('可辨性：焦点线弧长下限', () => {
  test('主线 ≥80、灵感线 ≥30、缘分线 ≥20（viewBox 单位）', () => {
    const MIN: Record<string, number> = { heart: 80, head: 80, life: 80, insight: 30, bond: 20 };
    for (const qid of LINE_QIDS) {
      for (let v = 0; v < variantCount(qid); v++) {
        expect(arcLen(chartForOption(qid, v).focus)).toBeGreaterThan(MIN[qid]);
      }
    }
  });

  test('辅线断续档恰为两段（对应「分成两三段，时有时无」选项语义）', () => {
    for (const qid of AUX_QIDS) {
      expect(chartForOption(qid, 1).focus).toHaveLength(2);
    }
  });
});

describe('trimInside 单元', () => {
  test('完全在掌内的短线原样保留单段', () => {
    const segs = trimInside([{ x: 300, y: 400 }, { x: 300, y: 440 }], outlineLoop());
    expect(segs).toHaveLength(1);
    expect(segs[0]).toHaveLength(2);
  });

  test('完全在指缝空腔内的线段整体丢弃', () => {
    expect(trimInside([{ x: 390, y: 220 }, { x: 400, y: 230 }], outlineLoop())).toHaveLength(0);
  });
});

describe('renderOptionChart 绘制顺序（clip 兜底）', () => {
  type Call = ['save' | 'restore' | 'clip' | 'beginPath' | 'closePath' | 'stroke', { color: string; width: number; alpha: number } | null];

  const makeCtx = (): { ctx: ChartCtx; calls: Call[] } => {
    const calls: Call[] = [];
    const ctx: ChartCtx = {
      strokeStyle: '#000',
      lineWidth: 1,
      globalAlpha: 1,
      lineCap: 'round',
      beginPath: () => calls.push(['beginPath', null]),
      moveTo: () => {},
      lineTo: () => {},
      closePath: () => calls.push(['closePath', null]),
      stroke: () =>
        calls.push(['stroke', { color: String(ctx.strokeStyle), width: ctx.lineWidth, alpha: ctx.globalAlpha }]),
      clip: () => calls.push(['clip', null]),
      save: () => calls.push(['save', null]),
      restore: () => calls.push(['restore', null]),
      translate: () => {},
      scale: () => {},
    };
    return { ctx, calls };
  };

  test('轮廓先描，clip 之后才画衬底线与焦点线，save/restore 成对', () => {
    const { ctx, calls } = makeCtx();
    renderOptionChart(ctx, 152, 190, chartForOption('heart', 0), true);

    const clipIdx = calls.findIndex(([op]) => op === 'clip');
    expect(clipIdx).toBeGreaterThan(0);

    const strokes = calls.filter(([op]) => op === 'stroke') as Array<['stroke', { color: string; width: number; alpha: number }]>;
    const strokeIdx = (pred: (s: { color: string; width: number; alpha: number }) => boolean): number =>
      calls.findIndex(([op, s]) => op === 'stroke' && s !== null && pred(s));

    // 轮廓（墨色、宽 5、α0.9）全部在 clip 之前
    const outlineStrokes = strokes.filter(([, s]) => s.color === '#26211A' && s.alpha === 0.9);
    expect(outlineStrokes.length).toBeGreaterThan(0);
    for (const [, s] of outlineStrokes) {
      expect(calls.findIndex(([op, x]) => op === 'stroke' && x === s)).toBeLessThan(clipIdx);
    }

    // 衬底线（淡墨 α0.16）与焦点线（选中朱砂）全部在 clip 之后
    const ctxIdx = strokeIdx((s) => s.alpha === 0.16);
    const focusIdx = strokeIdx((s) => s.color === '#BC3F21' && s.width === 9);
    expect(ctxIdx).toBeGreaterThan(clipIdx);
    expect(focusIdx).toBeGreaterThan(ctxIdx);

    // save 两次（外层变换 + clip），restore 两次，都在焦点线之后
    expect(calls.filter(([op]) => op === 'save')).toHaveLength(2);
    const restores = calls.map(([op], i) => [op, i] as const).filter(([op]) => op === 'restore');
    expect(restores).toHaveLength(2);
    for (const [, i] of restores) expect(i).toBeGreaterThan(focusIdx);
  });

  test('未选中时焦点线为墨色；镜像（左手）渲染不抛错', () => {
    const unselected = makeCtx();
    renderOptionChart(unselected.ctx, 152, 190, chartForOption('heart', 0), false);
    const focus = unselected.calls.filter(
      ([op, s]) => op === 'stroke' && s !== null && s.width === 9 && s.alpha === 1,
    );
    expect(focus.length).toBeGreaterThan(0);
    expect(focus.every(([, s]) => s !== null && s.color === '#26211A')).toBe(true);

    const mirrored = makeCtx();
    expect(() => renderOptionChart(mirrored.ctx, 152, 190, chartForOption('hand', 0), false)).not.toThrow();
  });
});
