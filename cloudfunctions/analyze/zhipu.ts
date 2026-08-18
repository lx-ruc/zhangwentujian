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
 * 实际调用 —— Node 内置 https（云函数 runtime 为 Node16，无原生 fetch）
 * 429（免费模型限流）按指数退避重试；其余错误抛给上层重试逻辑
 */
import * as https from 'https';

const RATE_LIMIT_STATUS = 429;
const RATE_LIMIT_RETRIES = 3;
const RATE_LIMIT_BASE_DELAY = 1_000;

interface HttpResult {
  status: number;
  body: string;
}

/** POST JSON（内置 https，兼容 Node16；超时由 req.setTimeout 控制） */
function postJson(url: string, headers: Record<string, string>, body: string, timeoutMs: number): Promise<HttpResult> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: 'POST',
        headers: { ...headers, 'Content-Length': Buffer.byteLength(body) },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') }));
      },
    );
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`zhipu timeout after ${timeoutMs}ms`)));
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

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
    const res = await postJson(
      ZHIPU_URL,
      { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      JSON.stringify(buildRequestBody(imageBase64, hand)),
      CONFIG.MODEL_TIMEOUT,
    );
    if (res.status === RATE_LIMIT_STATUS && attempt < RATE_LIMIT_RETRIES) continue;
    if (res.status !== 200) throw new Error(`zhipu http ${res.status}: ${res.body.slice(0, 200)}`);
    const data = JSON.parse(res.body) as { choices?: Array<{ message?: { content?: string } }> };
    text = data.choices?.[0]?.message?.content ?? '';
    break;
  }
  return { text, report: extractJson(text) };
}

export type { ReportShape };
