/**
 * 掌纹问答题库 —— 六题逐线选择（2026-09-08 用户决策：产品转向掌纹问答，违禁词政策仅放行「掌纹」一词）
 * 惯用手 + 三条主线（各定一个维度分数档）+ 两条辅线（只做结果扰动）。
 * 纯数据、无 wx 依赖；题面文案全部在 tests/copy-ban.test.ts 扫描范围内。
 * 线名沿用 design/hand-paths.json 命名考据：情感线/思维线/活力线（避传统「生命线」寿命暗示）；
 * 辅线不叫「事业线」（其别名「命运线」含禁用词）。
 */

export type MainLineKey = 'heart' | 'head' | 'life';
export type QuestionId = 'hand' | 'heart' | 'head' | 'life' | 'bond' | 'insight';

export interface QuizOption {
  id: string;
  label: string;
  hint: string;
  /** 主线题：该形态对应的分数档（闭区间）；辅线/惯用手题无档位 */
  band?: [number, number];
}

export interface QuizQuestion {
  id: QuestionId;
  kind: 'hand' | 'main' | 'aux';
  /** 主线题对应的维度键 */
  lineKey?: MainLineKey;
  title: string;
  sub: string;
  options: QuizOption[];
}

/** 主线形态四档（分数窗口与 utils/classify.ts 阈值反推对齐，见 utils/quiz.ts） */
const MAIN_SHAPES: Array<Omit<QuizOption, 'id'>> = [
  { label: '深长贯通', hint: '从一侧延伸到另一侧，深而连续', band: [90, 92] },
  { label: '明快上扬', hint: '走向清晰，微微上挑', band: [73, 77] },
  { label: '平缓舒展', hint: '弧度柔和，不深不浅', band: [52, 55] },
  { label: '浅淡纤细', hint: '偏浅偏细，若隐若现', band: [45, 48] },
];

/** 辅线形态三档（不进分数，只影响匹配的细微扰动） */
const AUX_SHAPES: Array<Omit<QuizOption, 'id'>> = [
  { label: '深长清晰', hint: '清楚可见，走向完整' },
  { label: '断续错落', hint: '分成两三段，时有时无' },
  { label: '浅短若隐', hint: '很短或很浅，几乎看不到' },
];

function mainOptions(key: string): QuizOption[] {
  return MAIN_SHAPES.map((s, i) => ({ ...s, id: `${key}-${i}` }));
}

function auxOptions(key: string): QuizOption[] {
  return AUX_SHAPES.map((s, i) => ({ ...s, id: `${key}-${i}` }));
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 'hand',
    kind: 'hand',
    title: '你的惯用手是？',
    sub: '先定个方向，后面逐条对照',
    options: [
      { id: 'hand-left', label: '左手', hint: '镜子里的方向' },
      { id: 'hand-right', label: '右手', hint: '最顺手的那只' },
    ],
  },
  {
    id: 'heart',
    kind: 'main',
    lineKey: 'heart',
    title: '你的情感线更接近哪种？',
    sub: '对照自己的手，凭第一眼选',
    options: mainOptions('heart'),
  },
  {
    id: 'head',
    kind: 'main',
    lineKey: 'head',
    title: '你的思维线更接近哪种？',
    sub: '掌纹中部的那条横向走势',
    options: mainOptions('head'),
  },
  {
    id: 'life',
    kind: 'main',
    lineKey: 'life',
    title: '你的活力线更接近哪种？',
    sub: '包绕拇指根部的那条弧线',
    options: mainOptions('life'),
  },
  {
    id: 'bond',
    kind: 'aux',
    title: '你的缘分线更接近哪种？',
    sub: '小指下方的一条短横纹',
    options: auxOptions('bond'),
  },
  {
    id: 'insight',
    kind: 'aux',
    title: '你的灵感线更接近哪种？',
    sub: '纵向上行的细纹，不是每个人都有',
    options: auxOptions('insight'),
  },
];

export function questionById(id: QuestionId): QuizQuestion {
  const q = QUIZ_QUESTIONS.find((item) => item.id === id);
  if (!q) throw new Error(`[quiz] unknown question: ${id}`);
  return q;
}
