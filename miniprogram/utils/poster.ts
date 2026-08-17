/**
 * 分享海报绘制（Canvas 2D，宣纸/墨/朱砂「图鉴」风）
 * 合规：免责声明必须出现在海报角落（三处必放之一）
 */

export interface PosterData {
  /** 图鉴类型（优先） */
  type?: { no: string; name: string; rarity: string; tagline: string; seal: string };
  /** 兜底：模型称号（无类型时） */
  archetype: string;
  funScore: number;
  /** 三主线 [情感, 思维, 活力] 0-100 */
  lines: Array<{ name: string; score: number }>;
  tags: string[];
  /** 底部手掌插画（透明/宣纸底 PNG 路径） */
  handImagePath: string;
}

const C = {
  paper: '#F9F5EC',
  paper2: '#F0E9EA'.replace('EA', 'DA'), // #F0E9DA
  ink: '#26211A',
  ink2: '#6F6759',
  ink3: '#A79D8B',
  cinnabar: '#BC3F21',
  rule: '#D8CFBB',
};

const FONT_SERIF = '"Songti SC", "STSong", serif';
const FONT_MONO = 'Menlo, monospace';
const FONT_BODY = '-apple-system, "PingFang SC", sans-serif';

/** 逻辑尺寸 750×1200，外部负责 canvas.width = 750*dpr 并 ctx.scale(dpr,dpr) */
export function drawPoster(
  ctx: CanvasRenderingContextLike,
  data: PosterData,
  image: CanvasImageLike | null,
): void {
  const W = 750;
  const H = 1200;

  // 宣纸底
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, W, H);

  // 双线界格框
  ctx.strokeStyle = C.rule;
  ctx.lineWidth = 2;
  strokeRect(ctx, 30, 30, W - 60, H - 60);
  ctx.lineWidth = 1;
  strokeRect(ctx, 42, 42, W - 84, H - 84);

  // eyebrow
  ctx.fillStyle = C.ink2;
  ctx.font = `500 24px ${FONT_MONO}`;
  drawTracked(ctx, 'PALM INSIGHT · 趣味掌纹解读', W / 2, 116, 6);

  // 引题 + 图鉴编号
  ctx.fillStyle = C.ink3;
  ctx.font = `400 30px ${FONT_BODY}`;
  drawTracked(ctx, '我的掌纹人格是', W / 2, 200, 10);
  if (data.type) {
    ctx.fillStyle = C.ink2;
    ctx.font = `500 28px ${FONT_MONO}`;
    ctx.fillText(data.type.no, W / 2 - ctx.measureText(data.type.no).width / 2, 252);
  }

  // 类型名/称号（朱砂大字，自动缩字）
  const headline = data.type ? data.type.name : `「${data.archetype}」`;
  ctx.fillStyle = C.cinnabar;
  ctx.font = `900 ${fitFontSize(ctx, headline, 84, 560, FONT_SERIF)}px ${FONT_SERIF}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(headline, W / 2, 316);
  ctx.textAlign = 'left';

  // 稀有度 / tagline
  if (data.type) {
    ctx.fillStyle = C.ink2;
    ctx.font = `400 28px ${FONT_BODY}`;
    ctx.textAlign = 'center';
    ctx.fillText(`趣味稀有度 ${data.type.rarity} · "${data.type.tagline}"`, W / 2, 396);
    ctx.textAlign = 'left';
  }

  // 评分印章（旋转方章）
  drawSeal(ctx, W / 2, 470, data.funScore);

  // 三主线
  const linesTop = 640;
  data.lines.forEach((l, i) => {
    const y = linesTop + i * 84;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = C.ink;
    ctx.font = `900 34px ${FONT_SERIF}`;
    ctx.fillText(l.name, 110, y);
    // 分数条
    const tx = 250;
    const tw = 320;
    ctx.fillStyle = C.paper2;
    roundRect(ctx, tx, y - 10, tw, 20, 10);
    ctx.fill();
    ctx.fillStyle = C.cinnabar;
    roundRect(ctx, tx, y - 10, Math.max(20, (tw * l.score) / 100), 20, 10);
    ctx.fill();
    // 分数
    ctx.fillStyle = C.cinnabar;
    ctx.font = `700 34px ${FONT_MONO}`;
    ctx.fillText(String(l.score), tx + tw + 40, y);
  });

  // 性格标签 pills
  const tags = data.tags.slice(0, 3);
  if (tags.length) {
    const pillY = linesTop + 3 * 84 + 30;
    ctx.font = `400 28px ${FONT_BODY}`;
    const widths = tags.map((t) => ctx.measureText(t).width + 48);
    const total = widths.reduce((a, b) => a + b, 0) + (tags.length - 1) * 20;
    let x = (W - total) / 2;
    tags.forEach((t, i) => {
      ctx.fillStyle = C.paper2;
      roundRect(ctx, x, pillY, widths[i], 56, 28);
      ctx.fill();
      ctx.fillStyle = C.ink2;
      ctx.textAlign = 'center';
      ctx.fillText(t, x + widths[i] / 2, pillY + 30);
      ctx.textAlign = 'left';
      x += widths[i] + 20;
    });
  }

  // 手掌插画（居中）
  if (image) {
    const iw = 300;
    const ih = iw * (image.height / image.width);
    ctx.drawImage(image as unknown as CanvasImageSource, (W - iw) / 2, 906, iw, ih);
  }

  // 免责（合规三处必放：海报角落）
  ctx.fillStyle = C.ink3;
  ctx.font = `400 20px ${FONT_BODY}`;
  ctx.textAlign = 'center';
  ctx.fillText('趣味解读 · 仅供娱乐，不构成任何科学依据或决策建议', W / 2, 1112);
  // 引流
  ctx.fillStyle = C.ink2;
  ctx.font = `500 26px ${FONT_MONO}`;
  drawTracked(ctx, '微信搜索「掌纹测运」', W / 2, 1152, 6);
  ctx.textAlign = 'left';
}

/** 字距绘制（小程序 canvas 无 letterSpacing，逐字画） */
function drawTracked(
  ctx: CanvasRenderingContextLike,
  text: string,
  centerX: number,
  y: number,
  gap: number,
): void {
  const chars = [...text];
  const width = chars.reduce((a, c) => a + ctx.measureText(c).width + gap, -gap);
  let x = centerX - width / 2;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (const c of chars) {
    ctx.fillText(c, x, y);
    x += ctx.measureText(c).width + gap;
  }
}

/** 称号过长时缩字号 */
function fitFontSize(
  ctx: CanvasRenderingContextLike,
  text: string,
  base: number,
  maxWidth: number,
  font: string,
): number {
  let size = base;
  while (size > 44) {
    ctx.font = `900 ${size}px ${font}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 4;
  }
  return size;
}

function drawSeal(ctx: CanvasRenderingContextLike, cx: number, cy: number, score: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((-6 * Math.PI) / 180);
  const s = 150;
  ctx.strokeStyle = C.cinnabar;
  ctx.lineWidth = 6;
  roundRect(ctx, -s / 2, -s / 2, s, s, 14);
  ctx.stroke();
  ctx.lineWidth = 2;
  roundRect(ctx, -s / 2 + 10, -s / 2 + 10, s - 20, s - 20, 8);
  ctx.stroke();
  ctx.fillStyle = C.cinnabar;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 64px ${FONT_SERIF}`;
  ctx.fillText(String(score), 0, -18);
  ctx.font = `400 24px ${FONT_BODY}`;
  ctx.fillText('趣味评分', 0, 38);
  ctx.restore();
  ctx.textAlign = 'left';
}

function strokeRect(ctx: CanvasRenderingContextLike, x: number, y: number, w: number, h: number) {
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.stroke();
}

function roundRect(
  ctx: CanvasRenderingContextLike,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 小程序 Canvas 2D 上下文的最小结构（屏蔽官方类型与 DOM 差异） */
export interface CanvasRenderingContextLike {
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  font: string;
  textAlign: string;
  textBaseline: string;
  fillRect(x: number, y: number, w: number, h: number): void;
  stroke(): void;
  fill(): void;
  fillText(text: string, x: number, y: number): void;
  measureText(text: string): { width: number };
  beginPath(): void;
  moveTo(x: number, y: number): void;
  rect(x: number, y: number, w: number, h: number): void;
  arcTo(x1: number, y1: number, x2: number, y2: number, r: number): void;
  closePath(): void;
  translate(x: number, y: number): void;
  rotate(angle: number): void;
  scale(x: number, y: number): void;
  save(): void;
  restore(): void;
  drawImage(img: CanvasImageSource, x: number, y: number, w: number, h: number): void;
}

export interface CanvasImageLike {
  width: number;
  height: number;
}
