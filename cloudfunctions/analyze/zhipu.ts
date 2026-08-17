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

/** 实际调用（Phase 2 联调时接通；fetch 在 Node 18 云函数环境可用） */
export async function callZhipu(
  apiKey: string,
  imageBase64: string,
  hand: string,
): Promise<{ text: string; report: unknown }> {
  const res = await fetch(ZHIPU_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(buildRequestBody(imageBase64, hand)),
    signal: AbortSignal.timeout(CONFIG.MODEL_TIMEOUT),
  });
  if (!res.ok) throw new Error(`zhipu http ${res.status}`);
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = data.choices?.[0]?.message?.content ?? '';
  return { text, report: extractJson(text) };
}

export type { ReportShape };
