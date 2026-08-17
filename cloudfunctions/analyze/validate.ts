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
}

export interface ReportShape {
  summary: string;
  personality: string[];
  career: string;
  love: string;
  wealth: string;
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

  const report: ReportShape = {
    summary: (r.summary as string).trim(),
    personality,
    career: (r.career as string).trim(),
    love: (r.love as string).trim(),
    wealth: (r.wealth as string).trim(),
    funScore,
    advice,
    lines,
  };
  return { ok: true, errors: [], report };
}
