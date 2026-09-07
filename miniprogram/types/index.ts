/** 数据模型（与云函数/数据库 analyses.result schema 对齐） */

export type Hand = 'left' | 'right';

/** 三维强度（内部键名沿用旧主线命名；展示映射：heart→感受力 / head→思考力 / life→行动力） */
export interface MainLines {
  /** 感受力 0-100 */
  heart: number;
  /** 思考力 0-100 */
  head: number;
  /** 行动力 0-100 */
  life: number;
}

/** 场景化解读：特质 + 注意事项（合规：仅生活方式层，非医学） */
export interface SceneNotes {
  /** 该场景的特质描述 2 条 */
  traits: string[];
  /** 注意事项 2 条（用"留意/不妨/建议"措辞） */
  cautions: string[];
}

export interface ReportResult {
  summary: string;
  /** 掌纹人格称号（记忆点，如"稳扎稳打的实干家"） */
  archetype?: string;
  /** 性格关键词 3-5 个 */
  personality: string[];
  career: string;
  love: string;
  wealth: string;
  /** 场景速读：工作 / 生活 / 身心（可选，模型未给则隐藏模块） */
  scenes?: {
    work: SceneNotes;
    life: SceneNotes;
    mind: SceneNotes;
  };
  /** 综合趣味评分 0-100 */
  funScore: number;
  /** 积极建议 2-4 条 */
  advice: string[];
  /** 三主线强度（可选，模型可能不给） */
  lines?: MainLines;
}

export interface AnalysisRecord {
  _id: string;
  _openid?: string;
  hand: Hand;
  result: ReportResult;
  modelVersion: string;
  createdAt: number;
}
