/** 报告数据格式化 —— 纯函数，可单测 */

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

