/**
 * 模型输出校验 —— 模型输出不可信，落库前必须过这里
 * 规则：schema 校验 + 违禁词黑名单（含"运"系词，见 PLAN.md §1.2 第 8 条）
 */

/** 违禁词黑名单：报告任何字段命中即拒绝（触发重试/兜底） */
export const BANNED_TERMS = [
  // 运系（产品名「掌纹测运」是唯一允许出现"运"的位置）
  '运势', '运气', '好运', '转运', '转好运', '旺', '桃花劫', '破财', '招财',
  // 命系
  '命运', '命中注定', '注定', '算命', '占卜', '手相', '大师', '风水', '吉', '凶', '灾', '祸',
  // 健康寿命
  '寿命', '长寿', '短命', '疾病', '患病', '健康问题', '体质差',
  // 绝对化
  '必定', '必然', '一定会', '肯定会', '天生注定',
] as const;

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  /** 清洗后的合法报告（trim 字符串、clamp 分数） */
  report: ReportShape | null;
  /** 模型明确判定非手掌照片（isPalm:false）——是终态信号，不重试不兜底 */
  notPalm?: boolean;
}

export interface SceneNotes {
  traits: string[];
  cautions: string[];
}

export interface ReportShape {
  summary: string;
  archetype?: string;
  personality: string[];
  career: string;
  love: string;
  wealth: string;
  scenes?: {
    work: SceneNotes;
    life: SceneNotes;
    mind: SceneNotes;
  };
  funScore: number;
  advice: string[];
  lines: { heart: number; head: number; life: number };
}

const REQUIRED_TEXT_FIELDS = ['summary', 'career', 'love', 'wealth'] as const;

const clamp = (v: unknown, lo: number, hi: number): number => {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return NaN;
  return Math.min(hi, Math.max(lo, Math.round(n)));
};

/** 对整个对象做违禁词扫描（拼接所有字符串字段） */
function findBannedTerms(obj: unknown): string[] {
  const text = JSON.stringify(obj ?? '');
  return BANNED_TERMS.filter((t) => text.includes(t));
}

export function validateReport(raw: unknown): ValidationResult {
  const errors: string[] = [];
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, errors: ['输出不是 JSON 对象'], report: null };
  }
  const r = raw as Record<string, unknown>;

  // 非手掌照片：模型终态判定，直接短路（不重试、不兜底、不落库）
  if (r.isPalm === false) return { ok: false, errors: [], report: null, notPalm: true };

  // 文本字段
  for (const f of REQUIRED_TEXT_FIELDS) {
    if (typeof r[f] !== 'string' || (r[f] as string).trim().length < 8) {
      errors.push(`字段 ${f} 缺失或过短`);
    }
  }

  // personality / advice 数组
  const personality = Array.isArray(r.personality)
    ? (r.personality as unknown[]).filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    : [];
  if (personality.length < 2) errors.push('personality 关键词不足 2 个');
  const advice = Array.isArray(r.advice)
    ? (r.advice as unknown[]).filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    : [];
  if (advice.length < 1) errors.push('advice 至少 1 条');

  // 分数
  const funScore = clamp(r.funScore, 0, 100);
  if (Number.isNaN(funScore)) errors.push('funScore 非数字');

  const linesRaw = (r.lines ?? {}) as Record<string, unknown>;
  const lines = {
    heart: Number.isFinite(clamp(linesRaw.heart, 0, 100)) ? clamp(linesRaw.heart, 0, 100) : 60,
    head: Number.isFinite(clamp(linesRaw.head, 0, 100)) ? clamp(linesRaw.head, 0, 100) : 60,
    life: Number.isFinite(clamp(linesRaw.life, 0, 100)) ? clamp(linesRaw.life, 0, 100) : 60,
  };

  // 违禁词（只对合法成形的对象扫，报错信息给到具体词）
  const banned = findBannedTerms(r);
  if (banned.length) errors.push(`命中违禁词: ${banned.join('/')}`);

  if (errors.length) return { ok: false, errors, report: null };

  // scenes（可选；结构不完整则整体丢弃，前端隐藏模块）
  const cleanList = (v: unknown): string[] =>
    Array.isArray(v)
      ? (v as unknown[]).filter((s): s is string => typeof s === 'string' && s.trim().length > 0).map((s) => s.trim())
      : [];
  let scenes: ReportShape['scenes'] | undefined;
  const sc = r.scenes as Record<string, unknown> | undefined;
  if (sc && typeof sc === 'object') {
    const build = (k: 'work' | 'life' | 'mind'): SceneNotes | null => {
      const item = sc[k] as Record<string, unknown> | undefined;
      if (!item) return null;
      const traits = cleanList(item.traits);
      const cautions = cleanList(item.cautions);
      return traits.length && cautions.length ? { traits, cautions } : null;
    };
    const work = build('work');
    const life = build('life');
    const mind = build('mind');
    scenes = work && life && mind ? { work, life, mind } : undefined;
  }

  const report: ReportShape = {
    summary: (r.summary as string).trim(),
    archetype: typeof r.archetype === 'string' && r.archetype.trim() ? r.archetype.trim() : undefined,
    personality,
    career: (r.career as string).trim(),
    love: (r.love as string).trim(),
    wealth: (r.wealth as string).trim(),
    scenes,
    funScore,
    advice,
    lines,
  };
  return { ok: true, errors: [], report };
}

/** 通用场景速读：模型偶发缺失 scenes 时注入（其余字段仍为个性化输出，此卡保持展示） */
export const GENERIC_SCENES: ReportShape['scenes'] = {
  work: {
    traits: [
      '纹路整体平缓清晰：做事倾向先看清全局再动手，节奏偏稳，是"谋定后动"型。',
      '面对多线任务时，倾向把最重要的一件安排在自己精力最好的时段。',
    ],
    cautions: [
      '留意：临时插进的需求容易打乱你的节奏，可以说"可以排，但先挪掉一件"。',
      '留意：重要结论别只靠口头同步，落成文字更稳妥。',
    ],
  },
  life: {
    traits: [
      '社交节奏偏温和：熟人小聚比大型饭局更让你自在。',
      '消费上倾向为"值得"买单，而不是为便宜买单。',
    ],
    cautions: [
      '留意：答应得太快容易把自己排满，适当留白。',
      '留意：情绪偏内敛的话，定期把感受说出来会更轻松。',
    ],
  },
  mind: {
    traits: [
      '精力节奏平稳：连续高强度之后，需要一段完整的放空来恢复。',
      '压力上升的信号常是话变少、睡眠变浅，值得留意。',
    ],
    cautions: [
      '留意：给情绪找个出口——写下来、运动、找人聊都行。',
      '留意：以上是生活方式参考，如有身体不适请以专业人士意见为准。',
    ],
  },
};
