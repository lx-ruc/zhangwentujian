/**
 * 统一分享配置 —— 全站转发卡片文案（合规：无运/命/吉凶词，钩子化措辞）
 */

interface ShareMessage {
  title: string;
  path: string;
  imageUrl?: string;
}

/** 默认分享（index / capture / analyzing / about 等无个性化数据时用） */
export function shareDefault(): ShareMessage {
  return {
    title: '我的掌纹里藏着什么性格密码？拍张照就知道了',
    path: '/pages/index/index',
  };
}

/** 报告页分享（带分数，制造好奇钩子） */
export function shareReport(score: number, archetype: string): ShareMessage {
  return {
    title: `我测出「${archetype}」，趣味评分 ${score} 分——你猜你的多少？`,
    path: '/pages/index/index',
  };
}

/** 历史页分享（带累计次数，社交证明） */
export function shareHistory(count: number): ShareMessage {
  const n = Math.max(1, count);
  return {
    title: `我已经玩了 ${n} 次掌纹解读，你也来测测？`,
    path: '/pages/index/index',
  };
}
