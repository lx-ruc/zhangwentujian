import {
  QUIZ_QUESTIONS,
  questionById,
  QuestionId,
  MainLineKey,
} from '../miniprogram/data/quiz-questions';
import {
  seedFromAnswers,
  scoresFromAnswers,
  quizOutcome,
  isQuizComplete,
  QuizAnswers,
} from '../miniprogram/utils/quiz';
import { classifyPalmType } from '../miniprogram/utils/classify';
import { PALM_TYPE_LIST } from '../miniprogram/data/palm-types';
import { REPORT_CONTENT } from '../miniprogram/data/report-content';

const TYPE_IDS = new Set(PALM_TYPE_LIST.map((t) => t.id));
const MAIN_QIDS: MainLineKey[] = ['heart', 'head', 'life'];
const ALL_QIDS = QUIZ_QUESTIONS.map((q) => q.id);

/** 组一套完整答案（主线档位 0-3，惯用手/辅线取第 i 取模变体） */
function answersFor(mainIdx: Record<MainLineKey, number>, variant = 0): QuizAnswers {
  const a: Partial<QuizAnswers> = {};
  for (const q of QUIZ_QUESTIONS) {
    const optIdx = (q as { lineKey?: MainLineKey }).lineKey ? mainIdx[(q as { lineKey: MainLineKey }).lineKey] : variant % q.options.length;
    a[q.id] = q.options[optIdx].id;
  }
  return a as QuizAnswers;
}

describe('掌纹问答题库 · 结构', () => {
  test('六题固定顺序：惯用手 → 三条主线 → 两条辅线', () => {
    expect(ALL_QIDS).toEqual(['hand', 'heart', 'head', 'life', 'bond', 'insight']);
  });

  test('主线题 4 选项带档位、辅线 3 选项无档位、惯用手 2 选项', () => {
    for (const q of QUIZ_QUESTIONS) {
      if (q.kind === 'main') {
        expect(q.options).toHaveLength(4);
        for (const o of q.options) expect(o.band).toBeDefined();
      } else if (q.kind === 'aux') {
        expect(q.options).toHaveLength(3);
        for (const o of q.options) expect(o.band).toBeUndefined();
      } else {
        expect(q.options).toHaveLength(2);
      }
    }
  });

  test('档位窗口合法：lo≤hi、落在 0-100、四档互不重叠（保证选项索引决定分数区间）', () => {
    for (const key of MAIN_QIDS) {
      const bands = questionById(key).options.map((o) => o.band as [number, number]);
      for (const [lo, hi] of bands) {
        expect(lo).toBeLessThanOrEqual(hi);
        expect(lo).toBeGreaterThanOrEqual(0);
        expect(hi).toBeLessThanOrEqual(100);
      }
      // 选项序即档位序：0 深长(最高) → 3 浅淡(最低)，严格递减且不相交
      for (let i = 1; i < bands.length; i++) {
        expect(bands[i][1]).toBeLessThan(bands[i - 1][0]);
      }
    }
  });

  test('questionById 未知 id 抛错', () => {
    expect(() => questionById('nope' as QuestionId)).toThrow();
  });
});

describe('问答 → 12 型映射引擎', () => {
  test('同答案必同结果（确定性）', () => {
    const a = answersFor({ heart: 0, head: 2, life: 3 }, 1);
    const first = quizOutcome(a);
    const second = quizOutcome(a);
    expect(seedFromAnswers(a)).toBe(seedFromAnswers(a));
    expect(second.type.id).toBe(first.type.id);
    expect(second.report).toEqual(first.report);
  });

  test('64 种主线组合：全部落入 12 型封闭集合，分数都在所选档位窗口内', () => {
    for (let h = 0; h < 4; h++) {
      for (let r = 0; r < 4; r++) {
        for (let v = 0; v < 4; v++) {
          const a = answersFor({ heart: h, head: r, life: v });
          const scores = scoresFromAnswers(a);
          const bands = {
            heart: questionById('heart').options[h].band as [number, number],
            head: questionById('head').options[r].band as [number, number],
            life: questionById('life').options[v].band as [number, number],
          };
          for (const key of MAIN_QIDS) {
            expect(scores[key]).toBeGreaterThanOrEqual(bands[key][0]);
            expect(scores[key]).toBeLessThanOrEqual(bands[key][1]);
          }
          const { type, report } = quizOutcome(a);
          expect(TYPE_IDS.has(type.id)).toBe(true);
          expect(report.lines).toEqual(scores);
          expect(report.funScore).toBeGreaterThanOrEqual(0);
          expect(report.funScore).toBeLessThanOrEqual(100);
        }
      }
    }
  });

  test('864 种全组合（主线×惯用手×辅线）：12 型全部可达', () => {
    const seen = new Set<string>();
    for (let h = 0; h < 4; h++) {
      for (let r = 0; r < 4; r++) {
        for (let v = 0; v < 4; v++) {
          for (let variant = 0; variant < 18; variant++) {
            seen.add(quizOutcome(answersFor({ heart: h, head: r, life: v }, variant)).type.id);
          }
        }
      }
    }
    expect([...seen].sort()).toEqual([...TYPE_IDS].sort());
  });

  test('辅线与惯用手只扰动细节，不改变人格类型（档位窗口不重叠保证）', () => {
    // 取一组档位分明的稳定组合（明快/平缓/平缓 → 感受力主导·机敏）
    const base = { heart: 1, head: 2, life: 2 } as const;
    const ids = new Set<string>();
    for (let variant = 0; variant < 18; variant++) {
      const a = answersFor(base, variant);
      ids.add(quizOutcome(a).type.id);
      // 分数仍落在主线档位窗口内（扰动只影响窗口内取值）
      const scores = scoresFromAnswers(a);
      expect(scores.heart).toBeGreaterThanOrEqual(73);
      expect(scores.heart).toBeLessThanOrEqual(77);
    }
    expect(ids.size).toBe(1);
  });

  test('scoresFromAnswers 缺答 / 非法选项 fail loud', () => {
    const a = answersFor({ heart: 1, head: 1, life: 1 });
    expect(() => scoresFromAnswers({ ...a, heart: '' } as QuizAnswers)).toThrow();
    expect(() => scoresFromAnswers({ ...a, heart: 'hand-0' } as QuizAnswers)).toThrow();
  });

  test('isQuizComplete：全答 true，缺答/非法 id false', () => {
    const full = answersFor({ heart: 2, head: 2, life: 2 }, 2);
    expect(isQuizComplete(full)).toBe(true);
    expect(isQuizComplete({ ...full, bond: '' })).toBe(false);
    expect(isQuizComplete({ ...full, insight: 'nope' })).toBe(false);
    expect(isQuizComplete({})).toBe(false);
  });

  test('与 classify 引擎反向一致：结果类型 = 对所得分数再分类', () => {
    const a = answersFor({ heart: 0, head: 1, life: 2 }, 3);
    const { type, report } = quizOutcome(a);
    expect(classifyPalmType(report.lines as { heart: number; head: number; life: number }).id).toBe(type.id);
  });

  test('报告正文与 12 型内容库对齐（quiz 不产生内容库之外的新文案）', () => {
    const a = answersFor({ heart: 3, head: 0, life: 1 }, 4);
    const { type, report } = quizOutcome(a);
    expect(REPORT_CONTENT[type.id].summary).toBe(report.summary);
    expect(report.advice).toEqual(REPORT_CONTENT[type.id].advice);
    expect(report.personality.length).toBeGreaterThanOrEqual(2);
  });
});
