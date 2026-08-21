/**
 * 历史数据模块：云端权威 + 本地缓存
 * - fetchHistory：云端拉取 → 校验映射 → 整表替换 storage `reports`（上限 20），返回列表
 * - getCachedHistory：读缓存（0 延迟渲染；断网/云端失败时即全部数据）
 * 本地不再有独立写入路径（analyzing 的即时写入仅作缓存预热，id 用云端记录 id）
 */
import { CONFIG } from '../config/index';
import { callFunction } from './request';
import { AnalysisRecord } from '../types/index';

/** 本地缓存上限（与云端 HISTORY_LIMIT 一致） */
const HISTORY_CAP = 20;

interface HistoryResponse {
  records?: Array<Partial<AnalysisRecord>>;
}

/** 拉取云端历史并整表替换本地缓存（云端是权威：不做合并，替换即收敛） */
export async function fetchHistory(): Promise<AnalysisRecord[]> {
  const data = await callFunction<HistoryResponse>(CONFIG.FN_ANALYZE, { action: 'history' });
  const list = (data.records || [])
    .filter((r): r is AnalysisRecord =>
      !!r && typeof r._id === 'string' && r._id !== '' && !!r.result)
    .map((r) => ({
      _id: r._id,
      hand: r.hand === 'left' ? ('left' as const) : ('right' as const),
      result: r.result,
      modelVersion: typeof r.modelVersion === 'string' ? r.modelVersion : '',
      createdAt: typeof r.createdAt === 'number' ? r.createdAt : 0,
    }));
  const capped = list.slice(0, HISTORY_CAP);
  wx.setStorageSync('reports', capped);
  return capped;
}

/** 读本地缓存（无网络请求；空缓存返回空数组） */
export function getCachedHistory(): AnalysisRecord[] {
  return (wx.getStorageSync('reports') || []) as AnalysisRecord[];
}
