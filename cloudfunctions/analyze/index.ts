/**
 * 云函数 analyze —— 入口编排
 * 链路：配额校验 → 下载图片 → base64 → 智谱 GLM-4V → 校验(重试1次) → 落库文本报告 → 删除图片
 * 原则：云端是配额权威判定方；模型输出不可信（必须过 validate）；图片即焚。
 */
import * as cloud from 'wx-server-sdk';
import { CONFIG } from './config';
import { callZhipu } from './zhipu';
import { validateReport, type ReportShape } from './validate';
import { hasQuota, consume, grantShareBonus, remainingOf, initialUserQuota, type UserQuota } from './quota';

// DYNAMIC_CURRENT_ENV 运行时为合法 env 标识，wx-server-sdk 2.x typing 误标为 string-only
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV as unknown as string });

interface AnalyzeEvent {
  action: 'analyze' | 'quota' | 'shareBonus' | 'history';
  /** 开发版标记（小程序 envVersion=develop 传入）：不限次且不消耗；上传后 trial/release 无此标记自动恢复限次 */
  dev?: boolean;
  channel?: 'forward' | 'timeline';
  fileID?: string;
  hand?: 'left' | 'right';
}

interface AnalyzeResult {
  report?: ReportShape;
  remaining?: number;
  /** 兜底标记：前端可据此提示"建议重拍" */
  fallback?: boolean;
  /** 兜底原因（诊断用，无敏感信息） */
  debugError?: string;
  /** 开发者白名单命中（首页展示满额） */
  devUnlimited?: boolean;
  /** 分享奖励结果 */
  granted?: number;
  /** 本次分析落库后的云端记录 id（客户端本地缓存对齐用） */
  id?: string;
  /** history 查询结果（字段瘦身，不含 _openid/fallback 等内部字段） */
  records?: HistoryRecord[];
}

/** history 返回记录：与客户端 AnalysisRecord 对齐（createdAt 统一毫秒） */
interface HistoryRecord {
  _id: string;
  hand: 'left' | 'right';
  result: ReportShape;
  modelVersion: string;
  createdAt: number;
}

const db = cloud.database();
const users = db.collection(CONFIG.COLLECTION_USERS);
const analyses = db.collection(CONFIG.COLLECTION_ANALYSES);

/** 兜底文案：模型两次都失败也不可白屏（无违禁词、无绝对化表述） */
const FALLBACK_REPORT: ReportShape = {
  summary:
    '这次的照片读起来有点吃力，纹路若隐若现。不如换个光线明亮的角度再拍一张，让三条主线看得更清楚些。以下是一份通用倾向描述，仅供参考。',
  archetype: '雾里看花的潜力股',
  personality: ['神秘待读', '值得再试'],
  career: '照片清晰度不足，暂不妄下结论——你倾向先把事情看清楚再出手。',
  love: '感情维度这次没读稳，仅供参考：你可能是慢热但长情的人。',
  wealth: '财富维度这次没读稳，仅供参考：你倾向稳中求进。',
  scenes: {
    work: {
      traits: ['纹路暂未读清：倾向先把信息摸全再动工，是"谋定后动"型。'],
      cautions: ['留意：重要方案别只靠一次会议定生死，留个书面确认更稳。'],
    },
    life: {
      traits: ['纹路暂未读清：你的社交电量可能偏有限，熟人小局更自在。'],
      cautions: ['留意：答应得太快容易把自己排满，学会留白。'],
    },
    mind: {
      traits: ['纹路暂未读清：连续高压后，你可能需要一段彻底放空才回得来。'],
      cautions: ['留意：以上是生活方式参考，如有身体不适请以专业人士意见为准。'],
    },
  },
  funScore: 66,
  advice: ['在窗边自然光下重拍一张，掌心正对镜头。', '五指自然张开，避开戒指手表。'],
  lines: { heart: 55, head: 55, life: 55 },
};

exports.main = async (event: AnalyzeEvent): Promise<{ code: number; message?: string; data?: AnalyzeResult }> => {
  const OPENID = cloud.getWXContext().OPENID;
  if (!OPENID) return err('MODEL_INVALID', '缺少用户标识');

  try {
    if (event.action === 'quota') {
      const q = await getUserQuota(OPENID);
      return ok({ remaining: remainingOf(q), devUnlimited: (CONFIG.DEV_OPENIDS as readonly string[]).includes(OPENID) });
    }

    // ---- 分享奖励（云端权威防刷：渠道限次 + 每日上限） ----
    if (event.action === 'shareBonus') {
      const channel = event.channel === 'timeline' ? 'timeline' : 'forward';
      const q = await getUserQuota(OPENID);
      const grant = grantShareBonus(q, channel);
      if (grant.ok) await upsertUserQuota(OPENID, grant.quota);
      return ok({ granted: grant.ok ? (channel === 'timeline' ? 3 : 1) : 0, remaining: grant.remaining });
    }

    // ---- 历史查询（仅本人、排除兜底；storage 只是缓存，云端是权威） ----
    if (event.action === 'history') {
      const records = await fetchHistoryRecords(OPENID);
      return ok({ records });
    }

    // ---- analyze ----
    if (!event.fileID || !event.hand) return err('PARAM_MISSING', '参数缺失');

    // 1) 配额（云端权威；开发者白名单 openid 或 dev 标记 → 不限次不消耗。真实用户照常限次）
    const devUnlimited = event.dev === true || (CONFIG.DEV_OPENIDS as readonly string[]).includes(OPENID);
    const quota = await getUserQuota(OPENID);
    if (!devUnlimited && !hasQuota(quota)) {
      // 配额不足也要删掉已上传的图，不留垃圾/隐私残留
      await safeDeleteFile(event.fileID);
      return err('QUOTA_EXCEEDED', '今日次数已用完');
    }

    const apiKey = process.env.ZHIPU_API_KEY;
    if (!apiKey) return err('MODEL_INVALID', '服务端未配置 API Key');

    // 2) 下载图片 → base64
    const imageBase64 = await downloadAsBase64(event.fileID);

    // 3~4) 模型 + 校验（失败重试 1 次），两次不过 → 兜底（不白屏）
    const { report, fallback, notPalm, lastError } = await analyzeWithRetry(apiKey, imageBase64, event.hand);

    // 非手掌照片：终态拒绝——不重试/不落库/不扣配额，提示重拍
    if (notPalm) {
      await safeDeleteFile(event.fileID);
      return err('NOT_PALM', 'NOT_PALM');
    }

    // 5) 落库（只存文本，绝不存图片/base64）；id 回传客户端对齐本地缓存
    const record = {
      _openid: OPENID,
      hand: event.hand,
      result: report,
      fallback,
      modelVersion: CONFIG.MODEL,
      createdAt: db.serverDate(),
    };
    const added = (await analyses.add({ data: record })) as { _id?: string };

    // 6) 消耗配额（不可变计算 + upsert）——兜底不扣：本次尝试不计入，users 零写入
    // remaining 统一 remainingOf 口径（bonus 感知），与 quota/shareBonus action 一致
    let remaining = remainingOf(quota);
    if (!fallback && !devUnlimited) {
      const next = consume(quota);
      await upsertUserQuota(OPENID, next);
      remaining = remainingOf(next);
    }

    // 7) 图片即焚（无论成败，走到这里分析已结束）
    await safeDeleteFile(event.fileID);

    return ok({ report, remaining, fallback, id: added._id, debugError: lastError });
  } catch (e) {
    console.error('[analyze]', e);
    // 未知异常也尝试清理图片（防泄漏）
    if (event.fileID) await safeDeleteFile(event.fileID);
    return err('MODEL_INVALID', '服务异常');
  }
};

/** 调模型 → 校验；模型判非手掌立即终止（不重试）；失败重试 MAX_RETRIES 次；仍失败返回兜底（标记 fallback） */
async function analyzeWithRetry(
  apiKey: string,
  imageBase64: string,
  hand: string,
): Promise<{ report: ReportShape; fallback: boolean; notPalm?: boolean; lastError?: string }> {
  let lastError = '';
  for (let attempt = 0; attempt <= CONFIG.MAX_RETRIES; attempt++) {
    try {
      const { text } = await callZhipu(apiKey, imageBase64, hand);
      const v = validateReport(JSON.parse(extractJsonText(text)));
      if (v.notPalm) {
        console.warn('[analyze] 模型判定非手掌照片，要求重拍');
        return { report: FALLBACK_REPORT, fallback: true, notPalm: true, lastError: 'not a palm photo' };
      }
      if (v.ok && v.report) return { report: v.report, fallback: false };
      lastError = v.errors.join('; ');
      console.warn(`[analyze] 第${attempt + 1}次校验失败: ${lastError}`);
    } catch (e) {
      lastError = String(e);
      console.warn(`[analyze] 第${attempt + 1}次调用失败: ${lastError}`);
    }
  }
  console.error(`[analyze] 进入兜底: ${lastError}`);
  return { report: FALLBACK_REPORT, fallback: true, lastError: lastError.slice(0, 200) };
}

/** 从模型回复提取 JSON 文本（zhipu.extractJson 抛错场景在此兼容） */
function extractJsonText(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('回复中未找到 JSON');
  return candidate.slice(start, end + 1);
}

/** 下载云存储文件并转 base64；失败抛错（上层统一兜底） */
async function downloadAsBase64(fileID: string): Promise<string> {
  const res = (await cloud.downloadFile({ fileID })) as { fileContent?: Buffer };
  if (!res.fileContent || res.fileContent.length === 0) throw new Error('图片下载为空');
  return res.fileContent.toString('base64');
}

/** 删除云存储文件；失败仅记日志（不阻塞主流程） */
async function safeDeleteFile(fileID: string): Promise<void> {
  try {
    await cloud.deleteFile({ fileList: [fileID] });
  } catch (e) {
    console.error('[analyze] 删除图片失败（不影响报告）:', fileID, e);
  }
}

async function getUserQuota(openid: string): Promise<UserQuota> {
  const res = (await users
    .where({ _openid: openid })
    .limit(1)
    .get()) as { data?: Array<Partial<UserQuota>> };
  const doc = res.data?.[0] as Partial<UserQuota> | undefined;
  return doc
    ? {
        dailyCount: doc.dailyCount ?? 0,
        lastUsedDate: doc.lastUsedDate ?? '',
        bonus: doc.bonus ?? 0,
        bonusDate: doc.bonusDate ?? '',
        shareCounters: doc.shareCounters,
      }
    : initialUserQuota();
}

/** history 查询：仅本人、排除兜底（云端留观测、消费面不见）、倒序、上限条数 */
async function fetchHistoryRecords(openid: string): Promise<HistoryRecord[]> {
  const res = (await analyses
    .where({ _openid: openid, fallback: false })
    .orderBy('createdAt', 'desc')
    .limit(CONFIG.HISTORY_LIMIT)
    .get()) as { data?: Array<Record<string, unknown>> };
  return (res.data || [])
    .map((doc) => ({
      _id: String(doc._id ?? ''),
      hand: doc.hand === 'left' ? ('left' as const) : ('right' as const),
      result: doc.result as ReportShape,
      modelVersion: String(doc.modelVersion ?? ''),
      createdAt: toMillis(doc.createdAt),
    }))
    .filter((r) => r._id !== '');
}

/** createdAt 容错转毫秒：云端 Date、序列化 ISO 串、裸数字均接受，非法值归 0 */
function toMillis(v: unknown): number {
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const parsed = Date.parse(v);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}

/** upsert 用户配额；首次用 add，已有记录用 where().update() */
async function upsertUserQuota(openid: string, next: UserQuota): Promise<void> {
  const existing = (await users.where({ _openid: openid }).limit(1).get()) as { data?: unknown[] };
  // 全字段写入（bonus/bonusDate/shareCounters 缺一不可——漏写会导致分享奖励"内存生效、落库丢失"）
  const fields = {
    dailyCount: next.dailyCount,
    lastUsedDate: next.lastUsedDate,
    bonus: next.bonus ?? 0,
    bonusDate: next.bonusDate ?? '',
    shareCounters: next.shareCounters ?? { forward: 0, timeline: 0 },
    updatedAt: db.serverDate(),
  };
  if (existing.data && existing.data.length > 0) {
    await users.where({ _openid: openid }).update({ data: fields });
  } else {
    await users.add({ data: { _openid: openid, ...fields, createdAt: db.serverDate() } });
  }
}

function ok(data: AnalyzeResult) { return { code: 0, data }; }
function err(code: string, message: string) {
  const PASSTHROUGH = ['QUOTA_EXCEEDED', 'PARAM_MISSING', 'NOT_PALM'];
  return { code: 1, message: PASSTHROUGH.includes(code) ? code : message };
}
