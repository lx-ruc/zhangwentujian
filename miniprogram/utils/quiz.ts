/**
 * 掌纹问答匹配引擎 —— 六题答案 → 三维分数 → 12 型（确定性纯函数，无 wx 依赖）
 * 主线三题各定一个维度的分数档（档位窗口与 classify.ts 阈值反推对齐），
 * 惯用手与两条辅线不进档位、只扰动档内取值与趣味评分：同答案必同结果。
 * 不变量：scoresFromAnswers 的每一档组合经 classifyPalmType 落入 12 型封闭集合，
 * 由 tests/quiz.test.ts 锁定（含 12 型全可达）。
 */
import { QUIZ_QUESTIONS, QuestionId, questionById, MainLineKey } from '../data/quiz-questions';
import { mulberry32, assembleReport } from './draw';
import { classifyPalmType } from './classify';
import { ReportResult, MainLines } from '../types/index';
import { PalmType } from '../data/palm-types';

export type QuizAnswers = Record<QuestionId, string>;

const MAIN_LINE_KEYS: MainLineKey[] = ['heart', 'head', 'life'];

/** 答案 → 种子（FNV-1a，32 位；同答案同种子） */
export function seedFromAnswers(a: QuizAnswers): number {
  const joined = QUIZ_QUESTIONS.map((q) => `${q.id}:${a[q.id]}`).join('|');
  let h = 0x811c9dc5;
  for (let i = 0; i < joined.length; i++) {
    h ^= joined.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 主线题答案 → 分数（档内取值由全部答案共同决定；非法答案 fail loud） */
export function scoresFromAnswers(a: QuizAnswers): MainLines {
  const rand = mulberry32(seedFromAnswers(a));
  const scores: MainLines = { heart: 0, head: 0, life: 0 };
  for (const key of MAIN_LINE_KEYS) {
    const q = questionById(key);
    const opt = q.options.find((o) => o.id === a[key]);
    if (!opt || !opt.band) throw new Error(`[quiz] 未作答或非法答案: ${key}=${a[key]}`);
    const [lo, hi] = opt.band;
    scores[key] = lo + Math.floor(rand() * (hi - lo + 1));
  }
  return scores;
}

export interface QuizOutcome {
  report: ReportResult;
  type: PalmType;
}

/** 一锤定音：答案 → 分数 → 12 型 → 报告（确定性；抖动随机流由种子加盐派生） */
export function quizOutcome(a: QuizAnswers): QuizOutcome {
  const scores = scoresFromAnswers(a);
  const jitterRand = mulberry32((seedFromAnswers(a) ^ 0x9e3779b9) >>> 0);
  const type = classifyPalmType(scores);
  return { report: assembleReport(type, scores, jitterRand), type };
}

/** 六题是否全部作答（有效选项 id） */
export function isQuizComplete(a: Partial<QuizAnswers>): boolean {
  return QUIZ_QUESTIONS.every((q) => q.options.some((o) => o.id === a[q.id]));
}
