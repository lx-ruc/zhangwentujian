/**
 * 掌纹人格图鉴 · 12 型全收录
 * 机制参考 MBTI 传播：封闭类型集合 + 画面感命名 + 趣味稀有度 + 相性钩子
 * 合规：稀有度为趣味估算（非真实统计，文案需带"趣味估算"）；描述全部为性格倾向，无运/命/吉凶词
 */

export type Dominant = 'heart' | 'head' | 'life';
export type Style = 'calm' | 'bold' | 'agile' | 'deep';
export type TypeId = `${Dominant}-${Style}`;

export interface PalmType {
  id: TypeId;
  /** 巴掌TI 代码（MBTI 式：主导线字母+风格字母，如 HA/RD/VN） */
  code: string;
  /** 图鉴编号 No.01-12 */
  no: string;
  /** 类型名（4 字画面感命名） */
  name: string;
  /** 主导线 */
  dominant: Dominant;
  dominantLabel: string;
  /** 风格 */
  style: Style;
  styleLabel: string;
  /** 趣味稀有度（写死的趣味估算值，展示时带"趣味估算"） */
  rarity: string;
  /** 一句话人设（反差感/自嘲感，分享钩子） */
  tagline: string;
  /** 图鉴描述（40-80 字，性格倾向措辞） */
  desc: string;
  /** 最合拍类型名（社交钩子：找同类/找互补） */
  compat: string[];
  /** 印章字（取类型名最具代表性的一字） */
  seal: string;
}

export const PALM_TYPES: Record<TypeId, PalmType> = {
  // ===== 心系 · 情感线主导 =====
  'heart-calm': {
    id: 'heart-calm', code: 'HS', no: 'No.01', name: '深潭映月',
    dominant: 'heart', dominantLabel: '心系', style: 'calm', styleLabel: '沉稳',
    rarity: '9%',
    tagline: '表面平静，底下全是戏。',
    desc: '情绪像深潭：入水慢、退潮也慢。不轻易动心，认定之后极难改道。朋友眼里你是"最稳的那个人"，只有你自己知道心底演过多少部戏。',
    compat: ['春风拂面', '山间清风'],
    seal: '潭',
  },
  'heart-bold': {
    id: 'heart-bold', code: 'HA', no: 'No.02', name: '燎原星火',
    dominant: 'heart', dominantLabel: '心系', style: 'bold', styleLabel: '进取',
    rarity: '6%',
    tagline: '爱的时候，是真的烫。',
    desc: '情感浓度永远开最大档：喜欢就冲、讨厌就躲，没有中间态。燃烧得快，好在点燃下一片草原也快——你的人生从不冷场。',
    compat: ['磐石棋手', '长途行者'],
    seal: '燎',
  },
  'heart-agile': {
    id: 'heart-agile', code: 'HN', no: 'No.03', name: '春风拂面',
    dominant: 'heart', dominantLabel: '心系', style: 'agile', styleLabel: '灵动',
    rarity: '12%',
    tagline: '谁都处得来，走心的没几个。',
    desc: '天生的高情商社交者：三分钟暖场，五分钟破冰。但你心里有一张很清楚的名录——谁能进内圈，谁只能点赞，门儿清。',
    compat: ['深潭映月', '千面棱镜'],
    seal: '风',
  },
  'heart-deep': {
    id: 'heart-deep', code: 'HD', no: 'No.04', name: '暗河涌动',
    dominant: 'heart', dominantLabel: '心系', style: 'deep', styleLabel: '深沉',
    rarity: '2%',
    tagline: '嘴上说没事，心里已演完三部曲。',
    desc: '情感线深而不露：情绪的全流域都在地下运行。别人以为你佛，其实你只是不爱直播。偶尔把暗河引出地面，会轻松很多。',
    compat: ['春风拂面', '破壁先锋'],
    seal: '河',
  },

  // ===== 脑系 · 思维线主导 =====
  'head-calm': {
    id: 'head-calm', code: 'RS', no: 'No.05', name: '磐石棋手',
    dominant: 'head', dominantLabel: '脑系', style: 'calm', styleLabel: '沉稳',
    rarity: '7%',
    tagline: '走一步看十步，情绪不许插手。',
    desc: '判断力是你最硬的资产：先推理、再落子、从不悔棋。情绪想干扰你的决策？排队排不到。适合当所有人慌了之后的最后防线。',
    compat: ['燎原星火', '深空观测者'],
    seal: '磐',
  },
  'head-bold': {
    id: 'head-bold', code: 'RA', no: 'No.06', name: '破壁先锋',
    dominant: 'head', dominantLabel: '脑系', style: 'bold', styleLabel: '进取',
    rarity: '4%',
    tagline: '难题是最好的兴奋剂。',
    desc: '思维线带着冲锋属性：别人看到墙，你看到墙后面的路。越复杂的问题越上头，简单重复反而让你昏昏欲睡——你的字典里没有"无解"。',
    compat: ['暗河涌动', '长途行者'],
    seal: '破',
  },
  'head-agile': {
    id: 'head-agile', code: 'RN', no: 'No.07', name: '千面棱镜',
    dominant: 'head', dominantLabel: '脑系', style: 'agile', styleLabel: '灵动',
    rarity: '3%',
    tagline: '同一个问题，永远有第三个角度。',
    desc: '大脑自带棱镜：一束光进来，折射出七个方向。脑洞是生产资料，跳跃是工作方式。跟你聊天要抓稳扶手——思路过山车，但风景一流。',
    compat: ['春风拂面', '奔流入海'],
    seal: '棱',
  },
  'head-deep': {
    id: 'head-deep', code: 'RD', no: 'No.08', name: '深空观测者',
    dominant: 'head', dominantLabel: '脑系', style: 'deep', styleLabel: '深沉',
    rarity: '1.5%',
    tagline: '话少，但想的事比谁都远。',
    desc: '思维线深得像观测深空：别人聊眼前，你在想五年后。安静不代表掉线——你在做长焦对焦。全图鉴最稀有的类型，物以稀为贵。',
    compat: ['磐石棋手', '蛰伏火山'],
    seal: '观',
  },

  // ===== 身系 · 活力线主导 =====
  'life-calm': {
    id: 'life-calm', code: 'VS', no: 'No.09', name: '长途行者',
    dominant: 'life', dominantLabel: '身系', style: 'calm', styleLabel: '沉稳',
    rarity: '8%',
    tagline: '起跑不快，但从不中途退场。',
    desc: '活力线的耐力型选手：配速稳、补给稳、心态稳。短跑选手在你前面起哄也没用——这是场马拉松，而你天生就是跑这种的。',
    compat: ['燎原星火', '破壁先锋'],
    seal: '行',
  },
  'life-bold': {
    id: 'life-bold', code: 'VA', no: 'No.10', name: '奔流入海',
    dominant: 'life', dominantLabel: '身系', style: 'bold', styleLabel: '进取',
    rarity: '5%',
    tagline: '能量过剩，闲下来反而难受。',
    desc: '活力线满格供应：一天恨不得 48 小时。行动永远先于纠结，方向对了就一路奔流。要小心的事只有一件——记得偶尔上岸歇脚。',
    compat: ['千面棱镜', '山间清风'],
    seal: '奔',
  },
  'life-agile': {
    id: 'life-agile', code: 'VN', no: 'No.11', name: '山间清风',
    dominant: 'life', dominantLabel: '身系', style: 'agile', styleLabel: '灵动',
    rarity: '10%',
    tagline: '精力只花在好玩的事上。',
    desc: '活力线的兴趣驱动型：对味的事可以连肝三天，不对味的一分钟都嫌长。效率意外地高——因为热爱就是你的外挂引擎。',
    compat: ['奔流入海', '春风拂面'],
    seal: '清',
  },
  'life-deep': {
    id: 'life-deep', code: 'VD', no: 'No.12', name: '蛰伏火山',
    dominant: 'life', dominantLabel: '身系', style: 'deep', styleLabel: '深沉',
    rarity: '2.5%',
    tagline: '平时省电模式，关键时刻倾尽全力。',
    desc: '活力线的蓄能型：日常看起来安静低调，其实在悄悄充电。等真正在意的事出现——好家伙，原来你是火山。爆发力全图鉴第一。',
    compat: ['深空观测者', '磐石棋手'],
    seal: '伏',
  },
};

export const PALM_TYPE_LIST: PalmType[] = Object.values(PALM_TYPES);
