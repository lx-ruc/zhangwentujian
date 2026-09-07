/**
 * 十二掌纹形态型 —— 形态图鉴数据
 * 合规边界：全部文案只描述纹路形态与统计/科普事实，零性格、零命运推断。
 * 稀有度为趣味统计估算（文案中已明示），仅供收集参考。
 */

export interface MorphType {
  id: string;
  no: string;
  name: string;
  /** 印章字（图鉴视觉用，取名称首字） */
  seal: string;
  clarityLabel: string;
  densityLabel: string;
  trendLabel: string;
  /** 趣味统计稀有度估算（%） */
  rarity: number;
  /** 形态描述（事实层） */
  desc: string;
  /** 手部科普（真实科学事实） */
  science: string;
}

export const MORPH_TYPES: Record<string, MorphType> = {
  'deep-sparse-aligned': {
    id: 'deep-sparse-aligned', no: 'M.01', name: '深谷平川', seal: '谷',
    clarityLabel: '纹路深刻', densityLabel: '细纹疏朗', trendLabel: '主线大体同向',
    rarity: 9,
    desc: '主纹路深而清晰，走向大体平直，掌心细纹不多——形态上像一片开阔的川谷，主干明显、支流很少。',
    science: '掌部屈肌线在胎儿期约第 13 周成形，此后形态基本保持稳定。',
  },
  'deep-sparse-woven': {
    id: 'deep-sparse-woven', no: 'M.02', name: '深谷环流', seal: '环',
    clarityLabel: '纹路深刻', densityLabel: '细纹疏朗', trendLabel: '纹向交织',
    rarity: 7,
    desc: '主纹路深而清晰，整体呈弧形绕行，细纹稀少——形态像一条深河道在川谷里画出一道大弯。',
    science: '屈肌线的形态由胚胎期手垫发育与皮肤折叠方式共同决定，人人不同。',
  },
  'deep-dense-aligned': {
    id: 'deep-dense-aligned', no: 'M.03', name: '阡陌纵横', seal: '陌',
    clarityLabel: '纹路深刻', densityLabel: '细纹繁密', trendLabel: '主线大体同向',
    rarity: 11,
    desc: '主纹路深而清晰，细纹密集交织，主线走向平直——形态像一片被田埂整齐划开的沃野。',
    science: '掌部细纹（细屈肌线）的数量与分布存在明显的个体差异。',
  },
  'deep-dense-woven': {
    id: 'deep-dense-woven', no: 'M.04', name: '江河水网', seal: '网',
    clarityLabel: '纹路深刻', densityLabel: '细纹繁密', trendLabel: '纹向交织',
    rarity: 8,
    desc: '主纹路深而清晰，细纹密布，主线呈弧形走向——形态像水系发达的三角洲，干流支流交织成网。',
    science: '皮肤纹路图案在人群中几乎没有完全重合的两例，常被用作身份识别特征。',
  },
  'mid-sparse-aligned': {
    id: 'mid-sparse-aligned', no: 'M.05', name: '平原疏朗', seal: '原',
    clarityLabel: '纹路适中', densityLabel: '细纹疏朗', trendLabel: '主线大体同向',
    rarity: 12,
    desc: '主纹路深浅适中、边界清楚，细纹不多，主线走向平直——形态像一片留白充足的平原。',
    science: '掌部纹路的深浅会随皮肤厚薄、湿度与年龄呈现可见变化。',
  },
  'mid-sparse-woven': {
    id: 'mid-sparse-woven', no: 'M.06', name: '缓丘绕流', seal: '丘',
    clarityLabel: '纹路适中', densityLabel: '细纹疏朗', trendLabel: '纹向交织',
    rarity: 10,
    desc: '主纹路深浅适中，细纹稀少，主线呈弧形绕行——形态像溪水绕过缓丘，弯而不急。',
    science: '屈肌线与手指屈曲时的皮肤受力方向高度相关，是功能结构的产物。',
  },
  'mid-dense-aligned': {
    id: 'mid-dense-aligned', no: 'M.07', name: '平野织田', seal: '田',
    clarityLabel: '纹路适中', densityLabel: '细纹繁密', trendLabel: '主线大体同向',
    rarity: 13,
    desc: '主纹路深浅适中，细纹较密，主线走向平直——形态像被犁出条条直线的水田。',
    science: '手部长期的使用习惯会让部分细纹逐渐加深、固定。',
  },
  'mid-dense-woven': {
    id: 'mid-dense-woven', no: 'M.08', name: '丘谷织网', seal: '织',
    clarityLabel: '纹路适中', densityLabel: '细纹繁密', trendLabel: '纹向交织',
    rarity: 9,
    desc: '主纹路深浅适中，细纹密集，主线呈弧形走向——形态像丘陵间织出的一张细网。',
    science: '全球迄今未发现掌部纹路完全相同的两个人，包括同卵双胞胎。',
  },
  'light-sparse-aligned': {
    id: 'light-sparse-aligned', no: 'M.09', name: '浅滩疏纹', seal: '滩',
    clarityLabel: '纹路浅淡', densityLabel: '细纹疏朗', trendLabel: '主线大体同向',
    rarity: 6,
    desc: '纹路整体浅淡柔和，细纹很少，主线走向平直——形态像退潮后留有几道水痕的浅滩。',
    science: '纹路印记的深浅主要由皮肤乳头层的结构决定，与肤色无关。',
  },
  'light-sparse-woven': {
    id: 'light-sparse-woven', no: 'M.10', name: '浅滩缓弯', seal: '缓',
    clarityLabel: '纹路浅淡', densityLabel: '细纹疏朗', trendLabel: '纹向交织',
    rarity: 5,
    desc: '纹路整体浅淡柔和，细纹稀少，主线呈弧形走向——形态像一道轻轻扫过沙面的浅弧。',
    science: '掌部纹路在出生前已经定型，是人体最早成形的体表特征之一。',
  },
  'light-dense-aligned': {
    id: 'light-dense-aligned', no: 'M.11', name: '轻纱细织', seal: '纱',
    clarityLabel: '纹路浅淡', densityLabel: '细纹繁密', trendLabel: '主线大体同向',
    rarity: 5,
    desc: '纹路浅淡但细纹密集，主线走向平直——形态像一层细纱上的经纬，密而不深。',
    science: '细纹的分布与遗传相关，家族间常呈现相似的疏密风格。',
  },
  'light-dense-woven': {
    id: 'light-dense-woven', no: 'M.12', name: '雾原细流', seal: '雾',
    clarityLabel: '纹路浅淡', densityLabel: '细纹繁密', trendLabel: '纹向交织',
    rarity: 5,
    desc: '纹路浅淡柔和，细纹密集交织，主线呈弧形走向——形态像雾中原野上的涓涓细流。',
    science: '掌纹的个体差异度极高，常被生物统计研究用作群体多样性样本。',
  },
};

export const MORPH_TYPE_LIST: MorphType[] = Object.values(MORPH_TYPES);
