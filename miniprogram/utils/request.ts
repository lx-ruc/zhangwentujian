/**
 * 云函数调用统一封装：错误分桶 + 用户可读文案
 * 页面只 catch RequestError，不直接碰原始 error
 */

export type RequestErrorCode =
  | 'QUOTA_EXCEEDED'
  | 'MODEL_TIMEOUT'
  | 'MODEL_INVALID'
  | 'NOT_PALM'
  | 'PAY_NOT_CONFIGURED'
  | 'NETWORK'
  | 'UNKNOWN';

export class RequestError extends Error {
  readonly code: RequestErrorCode;
  readonly userMessage: string;

  constructor(code: RequestErrorCode, userMessage: string, raw?: unknown) {
    super(userMessage);
    this.code = code;
    this.userMessage = userMessage;
    if (raw !== undefined) console.error('[request]', code, raw);
  }
}

const FRIENDLY: Record<RequestErrorCode, string> = {
  QUOTA_EXCEEDED: '今日解读次数已用完，明天再来吧',
  MODEL_TIMEOUT: '解读超时了，请重试一次',
  MODEL_INVALID: '结果生成异常，请重试一次',
  NOT_PALM: '这好像不是手掌照片，掌心对准取景框再拍一张吧',
  PAY_NOT_CONFIGURED: '支付暂未配置完成，请稍后再试',
  NETWORK: '网络不给力，请检查后重试',
  UNKNOWN: '出了点小问题，请重试',
};

interface CloudFnResult<T> {
  code?: number;
  message?: string;
  data?: T;
}

/** 调云函数并解包 {code:0, data} 约定 */
export async function callFunction<T>(
  name: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  let raw: { result?: unknown };
  try {
    raw = (await wx.cloud.callFunction({ name, data: payload })) as { result?: unknown };
  } catch (err) {
    throw new RequestError('NETWORK', FRIENDLY.NETWORK, err);
  }

  const result = raw.result as CloudFnResult<T> | undefined;
  if (!result || typeof result.code !== 'number') {
    throw new RequestError('UNKNOWN', FRIENDLY.UNKNOWN, result);
  }
  if (result.code !== 0) {
    const PASSTHROUGH: readonly string[] = ['QUOTA_EXCEEDED', 'MODEL_TIMEOUT', 'MODEL_INVALID', 'NOT_PALM', 'PAY_NOT_CONFIGURED'];
    const code = PASSTHROUGH.includes(String(result.message))
      ? (result.message as RequestErrorCode)
      : 'UNKNOWN';
    throw new RequestError(code, FRIENDLY[code], result);
  }
  return result.data as T;
}
