/**
 * 云函数 analyze —— 入口编排
 * 链路：配额校验 → 下载图片 → base64 → 智谱 GLM-4V → 校验(重试1次) → 落库文本报告 → 删除图片
 * Phase 2 联调时打通 wx-server-sdk 调用；当前为可编译的编排骨架。
 */
import * as cloud from 'wx-server-sdk';
import { CONFIG } from './config';
import { callZhipu } from './zhipu';
import { validateReport, type ReportShape } from './validate';
import { hasQuota, consume, initialUserQuota, type UserQuota } from './quota';

// DYNAMIC_CURRENT_ENV 运行时为合法 env 标识，wx-server-sdk 2.x typing 误标为 string-only
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV as unknown as string });

interface AnalyzeEvent {
  action: 'analyze' | 'quota';
  fileID?: string;
  hand?: 'left' | 'right';
}

interface AnalyzeResult {
  report?: ReportShape;
  remaining?: number;
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
      return ok({ remaining: hasQuota(q) ? CONFIG.DAILY_QUOTA - (q.lastUsedDate === new Date().toISOString().slice(0, 10) ? q.dailyCount : 0) : 0 });
    }

    // ---- analyze ----
    if (!event.fileID || !event.hand) return err('QUOTA_EXCEEDED', '参数缺失');

    // 1) 配额
    const quota = await getUserQuota(OPENID);
    if (!hasQuota(quota)) return err('QUOTA_EXCEEDED', '今日次数已用完');

    // 2~5) 图片 → 模型 → 校验（失败重试 1 次）→ 兜底
    const apiKey = process.env.ZHIPU_API_KEY;
    if (!apiKey) return err('MODEL_INVALID', '服务端未配置 API Key');

    // TODO(Phase 2): cloud.downloadFile({fileID}) → base64 → callZhipu → validateReport
    const report = FALLBACK_REPORT;

    // 6) 落库（只存文本）+ 消耗配额 + 删图
    // TODO(Phase 2): analyses.add / users 配额更新 / cloud.deleteFile
    void report; void consume; void initialUserQuota; void callZhipu; void validateReport; void users; void analyses;

    return ok({ report });
  } catch (e) {
    console.error('[analyze]', e);
    return err('MODEL_INVALID', '服务异常');
  }
};

async function getUserQuota(openid: string): Promise<UserQuota> {
  const res = (await users
    .where({ _openid: openid })
    .limit(1)
    .get()) as { data?: Array<Partial<UserQuota>> };
  const doc = res.data?.[0];
  return doc ? { dailyCount: doc.dailyCount ?? 0, lastUsedDate: doc.lastUsedDate ?? '' } : initialUserQuota();
}

function ok(data: AnalyzeResult) { return { code: 0, data }; }
function err(code: string, message: string) { return { code: 1, message: code === 'QUOTA_EXCEEDED' ? code : message }; }
