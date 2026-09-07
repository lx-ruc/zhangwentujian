import { mulberry32, typeWeights, pickType, scoresFor, drawReport, demoReport } from '../miniprogram/utils/draw';
import { classifyPalmType } from '../miniprogram/utils/classify';
import { PALM_TYPE_LIST, PALM_TYPES } from '../miniprogram/data/palm-types';
import { REPORT_CONTENT } from '../miniprogram/data/report-content';

describe('本地抽签引擎 · 反向一致性（核心不变量）', () => {
  test('12 型 × 2000 组随机分数：classify(scoresFor(t)) 恒等于 t', () => {
    for (const t of PALM_TYPE_LIST) {
      const rand = mulberry32(20260907);
      for (let i = 0; i < 2000; i++) {
        const scores = scoresFor(t, rand);
        expect(classifyPalmType(scores).id).toBe(t.id);
      }
    }
  });

  test('分数始终在 0-100 整数域内', () => {
    const rand = mulberry32(7);
    for (const t of PALM_TYPE_LIST) {
      const s = scoresFor(t, rand);
      for (const v of Object.values(s)) {
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe('本地抽签引擎 · 权重与分布', () => {
  test('12 支权重全部可解析为正数', () => {
    const weights = typeWeights();
    expect(weights).toHaveLength(12);
    for (const w of weights) {
      expect(Number.isFinite(w.weight)).toBe(true);
      expect(w.weight).toBeGreaterThan(0);
    }
  });

  test('2 万次抽取：稀有度加权生效（最稀有 < 最常见），12 支全命中', () => {
    const rand = mulberry32(42);
    const counts = new Map<string, number>();
    for (let i = 0; i < 20000; i++) {
      const t = pickType(rand);
      counts.set(t.id, (counts.get(t.id) || 0) + 1);
    }
    expect(counts.size).toBe(12);
    expect(counts.get('head-deep')!).toBeLessThan(counts.get('heart-agile')!); // 1.5% vs 12%
  });
});

describe('本地抽签引擎 · 报告组装', () => {
  test('同 seed 结果完全一致（确定性）', () => {
    const a = drawReport(12345);
    const b = drawReport(12345);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test('funScore 在 0-100，且报告字段完备（内容库全量挂载）', () => {
    for (let seed = 0; seed < 200; seed++) {
      const { report, type } = drawReport(seed);
      expect(report.funScore).toBeGreaterThanOrEqual(0);
      expect(report.funScore).toBeLessThanOrEqual(100);
      expect(report.summary).toBe(REPORT_CONTENT[type.id].summary);
      expect(classifyPalmType(report.lines!)).toBe(type);
      expect(report.scenes?.work.traits).toHaveLength(2);
      expect(report.advice.length).toBeGreaterThanOrEqual(2);
    }
  });

  test('demoReport 固定为 heart-bold 燎原星火（报告页直开兜底）', () => {
    const demo = demoReport();
    const type = classifyPalmType(demo.lines!);
    expect(type.id).toBe('heart-bold');
    expect(type.name).toBe('燎原星火');
    expect(demo.summary).toBe(PALM_TYPES['heart-bold'] && REPORT_CONTENT['heart-bold'].summary);
  });
});
