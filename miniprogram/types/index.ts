/** 数据模型（与云函数/数据库 analyses.result schema 对齐） */

export type Hand = 'left' | 'right';

/** 三条主线（产品命名，勿用传统名，见 design/hand-paths.json _naming） */
export interface MainLines {
  /** 情感线 0-100 */
  heart: number;
  /** 思维线 0-100 */
  head: number;
  /** 活力线 0-100 */
  life: number;
}

export interface ReportResult {
  summary: string;
  /** 性格关键词 3-5 个 */
  personality: string[];
  career: string;
  love: string;
  wealth: string;
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
