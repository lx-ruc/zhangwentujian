/**
 * 真实模型端到端验证（需 ZHIPU_API_KEY 环境变量 + /tmp/palm-test.jpg）
 * 不是常规单测——验证 真实GLM-4.6V-Flash + 真实prompt + 我们的校验器 全链路
 * 运行：ZHIPU_API_KEY=xxx npx jest tests/e2e-real-model.test.ts
 * 无 Key 时自动跳过（CI 安全）
 */
import * as fs from 'fs';
import { buildRequestBody } from '../cloudfunctions/analyze/zhipu';
import { validateReport } from '../cloudfunctions/analyze/validate';

const KEY = process.env.ZHIPU_API_KEY;
const IMG_PATH = '/tmp/palm-test.jpg';
const hasFixture = KEY && fs.existsSync(IMG_PATH);

const describeIf = hasFixture ? describe : describe.skip;

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('回复中未找到 JSON');
  return JSON.parse(candidate.slice(start, end + 1));
}

/** 连续 3 次真实调用：观察输出稳定性（违禁词命中率/JSON 合规率） */
describeIf('真实模型 E2E：GLM-4.6V-Flash + prompt + validate', () => {
  const results: Array<{ ok: boolean; errors: string[]; funScore?: number; reasoning: number; elapsed: number }> = [];

  beforeAll(() => { jest.setTimeout(120_000); });

  for (let i = 0; i < 3; i++) {
    it(`第 ${i + 1} 次调用：输出能过我们的校验器`, async () => {
      const img = fs.readFileSync(IMG_PATH).toString('base64');
      const body = buildRequestBody(img, 'right');
      const t0 = Date.now();
      const res = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });
      expect(res.ok).toBe(true);
      const data = (await res.json()) as {
        choices: Array<{ message: { content: string } }>;
        usage: { completion_tokens_details?: { reasoning_tokens?: number } };
      };
      const text = data.choices[0].message.content;
      const reasoning = data.usage.completion_tokens_details?.reasoning_tokens ?? 0;
      const elapsed = Date.now() - t0;

      const v = validateReport(extractJson(text));
      results.push({ ok: v.ok, errors: v.errors, funScore: v.report?.funScore, reasoning, elapsed });
      if (!v.ok) console.warn(`[E2E] 第${i + 1}次校验失败:`, v.errors.join('; '), '\n输出片段:', text.slice(0, 300));
      expect(v.ok).toBe(true);
    });
  }

  afterAll(() => {
    for (const [i, r] of results.entries()) {
      console.log(`[E2E] run#${i + 1} ok=${r.ok} funScore=${r.funScore ?? '-'} reasoning=${r.reasoning} ${(r.elapsed / 1000).toFixed(1)}s ${r.ok ? '' : r.errors.join(';')}`);
    }
  });
});
