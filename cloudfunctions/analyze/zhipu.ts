/**
 * 智谱 GLM-4V 客户端（纯函数式封装，可单测 mock）
 * API Key 只从环境变量读取，绝不落代码/日志
 */
import { SYSTEM_PROMPT } from './prompt';
import type { ReportShape } from './validate';
import { CONFIG } from './config';

const ZHIPU_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

interface ZhipuRequestBody {
  model: string;
  messages: Array<Record<string, unknown>>;
  temperature: number;
  /** GLM-4.6V 默认走思考模式（先长篇推理再作答），本场景要快速出 JSON，必须显式关闭 */
  thinking: { type: 'enabled' | 'disabled' };
  response_format?: { type: string };
}

export function buildRequestBody(imageBase64: string, hand: string): ZhipuRequestBody {
  return {
    model: CONFIG.MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
          { type: 'text', text: `这是一张${hand === 'left' ? '左' : '右'}手手掌照片，请按约定输出 JSON 报告。` },
        ],
      },
    ],
    temperature: 0.7,
    thinking: { type: 'disabled' },
  };
}

/** 从模型回复文本中提取 JSON（容忍 ```json 包裹/前后杂讯） */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('回复中未找到 JSON');
  return JSON.parse(candidate.slice(start, end + 1));
}

/**
 * 实际调用（fetch 在 Node 18 云函数环境可用）
 * 429（免费模型限流，code 1305）按指数退避重试；其余错误直接抛给上层重试逻辑
 */
const RATE_LIMIT_STATUS = 429;
const RATE_LIMIT_RETRIES = 3;
const RATE_LIMIT_BASE_DELAY = 1_000;

export async function callZhipu(
  apiKey: string,
  imageBase64: string,
  hand: string,
): Promise<{ text: string; report: unknown }> {
  let text = '';
  for (let attempt = 0; attempt <= RATE_LIMIT_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, RATE_LIMIT_BASE_DELAY * 2 ** (attempt - 1)));
    }
    const res = await fetch(ZHIPU_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(buildRequestBody(imageBase64, hand)),
      signal: AbortSignal.timeout(CONFIG.MODEL_TIMEOUT),
    });
    if (res.status === RATE_LIMIT_STATUS && attempt < RATE_LIMIT_RETRIES) continue;
    if (!res.ok) throw new Error(`zhipu http ${res.status}`);
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    text = data.choices?.[0]?.message?.content ?? '';
    break;
  }
  return { text, report: extractJson(text) };
}

export type { ReportShape };
