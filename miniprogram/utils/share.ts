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

/** 报告页分享（类型名 + 稀有度，制造好奇钩子） */
export function shareReport(score: number, typeName: string, rarity?: string): ShareMessage {
  const rare = rarity ? `，据说只有 ${rarity} 的手掌是这个型` : '';
  return {
    title: `我测出「${typeName}」${rare}——你是什么型？`,
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

/** 图鉴收集页分享（收集进度钩子） */
export function shareCollection(unlockedCount: number): ShareMessage {
  const n = Math.max(1, unlockedCount);
  return {
    title:
      n >= 10
        ? `我收集了 ${n}/12 种掌纹人格，就差几个稀有款了`
        : `我解锁了 ${n} 种掌纹人格图鉴，你是什么型？`,
    path: '/pages/index/index',
  };
}
