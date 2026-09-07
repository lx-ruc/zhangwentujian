import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/**
 * 违禁词回归守卫：扫描小程序全部可见文案 + 两份设计预览 HTML。
 * 只扫「用户可见」的字符串，避免标识符/注释/数据绑定误伤：
 * - .ts   → 剥注释后只扫字符串字面量（标识符/属性名不扫）
 * - .wxml → 剥注释、剥标签、剥 {{...}} 绑定后扫文本节点
 * - .json → JSON.parse 后递归扫所有字符串值（页面标题等可见）
 * - .wxss → 剥注释后扫引号字符串（content 属性等可见内容）
 * - .html → 剥注释、剥 <style>/<script> 块、剥标签后扫文本节点
 */

const ROOT = join(__dirname, '..');

/** 与 classify.test.ts / cloudfunctions/analyze/validate.ts 保持同步 */
const BANNED_TERMS = [
  // 玄学/命理类
  '算命', '占卜', '手相', '面相', '大师', '运势', '运气', '好运', '转运', '旺',
  '命运', '吉', '凶', '灾', '祸', '求签', '签文', '解签', '测运',
  // 手部类（含单字「掌」；仅品牌名整串豁免，见 BRAND）
  '手掌', '掌纹', '掌心', '巴掌', '手纹', '掌',
];
const BANNED_AI = /AI生成|AI解读|AI分析|AI读取/;
const BANNED_VISIBLE_EN = /palm/i;

/** 品牌名例外（2026-09-07 用户决策，告知全部风险后定名「AI掌纹分析」）：
 *  仅这 5 个字的整串可含掌族字样，扫描前剥离；其余可见文案仍零例外。 */
const BRAND = 'AI掌纹分析';

interface Hit {
  file: string;
  term: string;
  snippet: string;
}

function findBanned(file: string, texts: string[]): Hit[] {
  const hits: Hit[] = [];
  for (const text of texts) {
    const visible = text.split(BRAND).join('');
    for (const term of BANNED_TERMS) {
      if (visible.includes(term)) {
        hits.push({ file, term, snippet: text.trim().slice(0, 40) });
      }
    }
    if (BANNED_AI.test(visible)) {
      hits.push({ file, term: BANNED_AI.source, snippet: text.trim().slice(0, 40) });
    }
    if (BANNED_VISIBLE_EN.test(visible)) {
      hits.push({ file, term: 'palm(可见英文)', snippet: text.trim().slice(0, 40) });
    }
  }
  return hits;
}

/** 状态机提取字符串字面量（跳过 // 与 块注释；处理转义；模板串整段取）。
 *  import/require 的模块路径是代码而非可见文案，先置空再提取。 */
function extractQuotedStrings(rawSrc: string): string[] {
  const src = rawSrc
    .replace(/(\bfrom\s*)(['"])[^'"]*\2/g, '$1$2$2')
    .replace(/(\brequire\s*\(\s*)(['"])[^'"]*\2/g, '$1$2$2')
    .replace(/(\bimport\s*\(\s*)(['"])[^'"]*\2/g, '$1$2$2');
  const out: string[] = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      i++;
      let buf = '';
      while (i < n && src[i] !== quote) {
        if (src[i] === '\\') {
          buf += src[i] + (src[i + 1] ?? '');
          i += 2;
          continue;
        }
        if (quote !== '`' && src[i] === '\n') break; // 未闭合，止损
        buf += src[i];
        i++;
      }
      i++;
      out.push(buf);
      continue;
    }
    i++;
  }
  return out;
}

/** wxml/html：剥注释与标签后的文本节点（{{...}} 绑定属代码，一并剥掉） */
function extractMarkupText(src: string): string[] {
  const noComments = src.replace(/<!--[\s\S]*?-->/g, '');
  const noBlocks = noComments.replace(/<(style|script)\b[\s\S]*?<\/\1>/gi, '');
  const noBindings = noBlocks.replace(/\{\{[\s\S]*?\}\}/g, '');
  return noBindings
    .replace(/<[^>]*>/g, '\n')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

function extractJsonStrings(src: string): string[] {
  const out: string[] = [];
  const walk = (v: unknown): void => {
    if (typeof v === 'string') {
      out.push(v);
    } else if (Array.isArray(v)) {
      v.forEach(walk);
    } else if (v && typeof v === 'object') {
      Object.values(v).forEach(walk);
    }
  };
  walk(JSON.parse(src));
  return out;
}

function walkFiles(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      out.push(...walkFiles(p, exts));
    } else if (exts.some((e) => p.endsWith(e))) {
      out.push(p);
    }
  }
  return out;
}

function collectTargets(): { file: string; texts: string[] }[] {
  const targets: { file: string; texts: string[] }[] = [];
  for (const p of walkFiles(join(ROOT, 'miniprogram'), ['.ts', '.wxml', '.json', '.wxss'])) {
    const file = p.slice(ROOT.length + 1);
    const src = readFileSync(p, 'utf8');
    let texts: string[];
    if (p.endsWith('.ts')) {
      texts = extractQuotedStrings(src);
    } else if (p.endsWith('.wxml')) {
      texts = extractMarkupText(src);
    } else if (p.endsWith('.json')) {
      texts = extractJsonStrings(src);
    } else {
      texts = extractQuotedStrings(src.replace(/\/\*[\s\S]*?\*\//g, ''));
    }
    targets.push({ file, texts });
  }
  for (const name of ['design/preview.html', 'design/app-preview.html']) {
    const p = join(ROOT, name);
    targets.push({ file: name, texts: extractMarkupText(readFileSync(p, 'utf8')) });
  }
  return targets;
}

describe('copy-ban 违禁词回归守卫', () => {
  test('守卫自检：违禁样本必须被抓到（防扫描器失效假绿）', () => {
    // 「手掌」复合词与单字「掌」各记 1 笔 → 2；注释不扫
    expect(findBanned('x.ts', extractQuotedStrings(`const a = '今天手掌真好看'; // 手掌注释`))).toHaveLength(2);
    // wxml：注释剥除、{{绑定}}剥除，只扫文本节点
    expect(findBanned('x.wxml', extractMarkupText(`<view><!-- 手相 --><text>大师{{x}}</text></view>`))).toHaveLength(1);
    expect(findBanned('x.json', extractJsonStrings(`{"t":"好运连连"}`))).toHaveLength(1);
    expect(findBanned('x.wxss', extractQuotedStrings(`.a::after { content: '签文'; }`))).toHaveLength(1);
    // html：style 块剥除；正文命中 AI解读 + 掌纹 + 掌 → 3
    expect(findBanned('x.html', extractMarkupText(`<p>AI解读你的掌纹</p><style>.p{content:'占卜'}</style>`))).toHaveLength(3);
    // 标识符与模块路径不误伤
    expect(findBanned('x.ts', extractQuotedStrings(`const palmType = getPalmTypeName(); // palm 标识符不误伤`))).toHaveLength(0);
    expect(findBanned('x.ts', extractQuotedStrings(`import { X } from '../data/palm-types'; const y = '可见文案';`))).toHaveLength(0);
    // 品牌名例外：仅豁免「AI掌纹分析」整串；同串之外的掌族词照抓（掌纹+掌=2）
    expect(findBanned('x.ts', extractQuotedStrings(`const a = 'AI掌纹分析';`))).toHaveLength(0);
    expect(findBanned('x.ts', extractQuotedStrings(`const a = 'AI掌纹分析'; const b = '你的掌纹很好看';`))).toHaveLength(2);
  });

  test('扫描范围覆盖足够文件（文件收集器未失效）', () => {
    const targets = collectTargets();
    expect(targets.length).toBeGreaterThanOrEqual(30);
    const exts = new Set(targets.map((t) => t.file.split('.').pop()));
    expect(exts).toEqual(new Set(['ts', 'wxml', 'json', 'wxss', 'html']));
  });

  test('全部可见文案零违禁词（含单字「掌」、AI 措辞、可见 palm）', () => {
    const targets = collectTargets();
    const hits = targets.flatMap((t) => findBanned(t.file, t.texts));
    if (hits.length > 0) {
      const detail = hits
        .map((h) => `${h.file} → [${h.term}] 「${h.snippet}」`)
        .join('\n');
      throw new Error(`发现 ${hits.length} 处违禁词：\n${detail}`);
    }
  });
});
