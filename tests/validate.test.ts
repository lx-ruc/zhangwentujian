import { validateReport } from '../cloudfunctions/analyze/validate';
import { extractJson } from '../cloudfunctions/analyze/zhipu';

const GOOD = {
  summary: '纹路清晰深长，稳中带劲的节奏感，想得清楚做得踏实，仅供参考。',
  personality: ['沉稳务实', '慢热长情'],
  career: '思维线深长清晰，倾向于逻辑驱动型选手，遇到难题反而来劲。',
  love: '情感线走势平缓，情感表达偏内敛，可能是细水长流型。',
  wealth: '活力线弧度饱满，财务上倾向稳扎稳打。',
  funScore: 87,
  advice: ['给自己留一段自由发挥的时间。'],
  lines: { heart: 85, head: 72, life: 78 },
};

describe('validateReport · schema', () => {
  test('合法报告通过并规范化', () => {
    const r = validateReport({ ...GOOD, funScore: 120, lines: { heart: 999, head: -3, life: 66 } });
    expect(r.ok).toBe(true);
    expect(r.report!.funScore).toBe(100);
    expect(r.report!.lines.heart).toBe(100);
    expect(r.report!.lines.head).toBe(0);
    expect(r.report!.lines.life).toBe(66);
  });

  test('缺字段拒绝', () => {
    const r = validateReport({ summary: '只有总评，其他都没有的非法输出' });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('career'))).toBe(true);
  });

  test('personality 不足拒绝', () => {
    const r = validateReport({ ...GOOD, personality: ['孤独一个'] });
    expect(r.ok).toBe(false);
  });

  test('非对象拒绝', () => {
    expect(validateReport('抱歉我不会').ok).toBe(false);
    expect(validateReport(null).ok).toBe(false);
  });
});

describe('validateReport · 违禁词黑名单（合规核心）', () => {
  test.each([
    ['运势', '今年运势不错'],
    ['运气', '你最近运气会变好'],
    ['好运', '好运正在路上'],
    ['转运', '佩戴饰品可以转运'],
    ['旺', '财运旺'],
    ['命中注定', '这是命中注定的安排'],
    ['寿命', '掌纹显示寿命很长'],
    ['必定', '你必定成功'],
  ])('命中违禁词 %s → 拒绝', (term, sentence) => {
    const r = validateReport({ ...GOOD, summary: `开头。${sentence}。结尾。` });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toContain(term === '旺' ? '旺' : term);
  });

  test('嵌套字段（advice/love）中的违禁词同样拒绝', () => {
    const r = validateReport({ ...GOOD, advice: ['多喝水', '最近会走好运的'] });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toContain('好运');
  });

  test('合规倾向性措辞通过', () => {
    const r = validateReport({
      ...GOOD,
      summary: '你倾向于先观察再行动，可能偏慢热，仅供参考。',
    });
    expect(r.ok).toBe(true);
  });
});

describe('extractJson · 模型输出容错', () => {
  test('裸 JSON 直接解析', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  test('```json 围栏剥离', () => {
    expect(extractJson('好的，这是结果：\n```json\n{"a":1}\n```\n以上仅供参考')).toEqual({ a: 1 });
  });

  test('前后杂讯中提取', () => {
    expect(extractJson('报告如下 {"a":{"b":2}} 请查收')).toEqual({ a: { b: 2 } });
  });

  test('无 JSON 抛错', () => {
    expect(() => extractJson('抱歉，无法解析这张图片')).toThrow();
  });
});
