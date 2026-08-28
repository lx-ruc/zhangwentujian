/** 报告数据格式化 —— 纯函数，可单测 */
import { ReportResult } from '../types/index';

/** 分数收敛到 [0,100] 整数（模型输出不可信，展示层兜底） */
export function clampScore(n: unknown, fallback = 60): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(100, Math.max(0, Math.round(v)));
}

/** 时间戳 → '8月17日 14:05' */
export function formatDateTime(ts: number, now: Date = new Date()): string {
  const d = new Date(ts);
  const sameYear = d.getFullYear() === now.getFullYear();
  const md = `${d.getMonth() + 1}月${d.getDate()}日`;
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return sameYear ? `${md} ${hm}` : `${d.getFullYear()}年${md} ${hm}`;
}

export interface DimensionView {
  key: 'personality' | 'career' | 'love' | 'wealth';
  title: string;
  en: string;
  text: string;
}

/** 四维卡片视图模型：文案兜底，绝不出空白 */
export function toDimensions(r: ReportResult): DimensionView[] {
  const fallback = '这一维暂未读到清晰纹路，仅供参考。';
  return [
    { key: 'personality', title: '性格', en: 'NATURE', text: r.personality?.join(' · ') || fallback },
    { key: 'career', title: '做事风格', en: 'WORK STYLE', text: r.career || fallback },
    { key: 'love', title: '相处风格', en: 'BONDING', text: r.love || fallback },
    { key: 'wealth', title: '金钱观', en: 'MONEY VIEW', text: r.wealth || fallback },
  ];
}
