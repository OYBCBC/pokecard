// ============================================
// 《宝可梦 · 徽章之路》 数据定义（粉丝作品，非官方）
// Pokémon © Nintendo / Creatures / Game Freak
// 素材来自 PokeAPI 社区图库，仅供学习交流，请勿商用
// ============================================

export const TYPES = {
  fire:     { name: '火',   color: '#f08030' },
  water:    { name: '水',   color: '#58a6f0' },
  grass:    { name: '草',   color: '#63bc5a' },
  electric: { name: '电',   color: '#f8d030' },
  psychic:  { name: '超能', color: '#f858a8' },
  fighting: { name: '格斗', color: '#c03028' },
  poison:   { name: '毒',   color: '#a040a0' },
  normal:   { name: '一般', color: '#a8a878' },
};

// 每属性 10 张卡，power 1~10（力量值），每张对应一只宝可梦
// [全国图鉴号, 中文名]
export const ROSTER = {
  fire: [
    [37, '六尾'], [58, '卡蒂狗'], [4, '小火龙'], [77, '小火马'], [38, '九尾'],
    [59, '风速狗'], [126, '鸭嘴火兽'], [467, '鸭嘴焰兽'], [6, '喷火龙'], [146, '火焰鸟'],
  ],
  water: [
    [129, '鲤鱼王'], [118, '角金鱼'], [120, '海星星'], [54, '可达鸭'], [61, '蚊香蝌蚪'],
    [130, '暴鲤龙'], [131, '拉普拉斯'], [62, '蚊香泳士'], [9, '水箭龟'], [382, '盖欧卡'],
  ],
  grass: [
    [46, '派拉斯'], [69, '喇叭芽'], [114, '蔓藤怪'], [70, '口呆花'], [45, '霸王花'],
    [71, '大食花'], [465, '巨蔓藤'], [103, '椰蛋树'], [3, '妙蛙花'], [251, '雪拉比'],
  ],
  electric: [
    [172, '皮丘'], [25, '皮卡丘'], [81, '小磁怪'], [100, '霹雳电球'], [125, '电击兽'],
    [26, '雷丘'], [82, '三合一磁怪'], [466, '电击魔兽'], [145, '闪电鸟'], [243, '雷公'],
  ],
  psychic: [
    [96, '催眠貘'], [63, '凯西'], [97, '引梦貘人'], [64, '勇基拉'], [122, '魔墙人偶'],
    [124, '迷唇姐'], [65, '胡地'], [196, '太阳精灵'], [282, '沙奈朵'], [150, '超梦'],
  ],
  fighting: [
    [66, '腕力'], [236, '无畏小子'], [106, '飞腿郎'], [67, '豪力'], [107, '快拳郎'],
    [237, '战舞郎'], [68, '怪力'], [475, '艾路雷朵'], [448, '路卡利欧'], [892, '武道熊师'],
  ],
  normal: [
    [132, '百变怪'], [52, '喵喵'], [35, '皮皮'], [39, '胖丁'], [113, '吉利蛋'],
    [40, '胖可丁'], [143, '卡比兽'], [242, '幸福蛋'], [128, '肯泰罗'], [493, '阿尔宙斯'],
  ],
  poison: [
    [13, '独角虫'], [48, '毛球'], [109, '瓦斯弹'], [110, '双弹瓦斯'], [49, '摩鲁蛾'],
    [88, '臭泥'], [89, '臭臭泥'], [169, '叉字蝠'], [94, '耿鬼'], [487, '骑拉帝纳'],
  ],
};

// 手牌类型：基础攻击×倍率，以及每升 1 级的增量
export const HANDS = {
  fiveOfAKind:  { name: '五连击', chips: 120, mult: 12, perChips: 35, perMult: 3, rank: 10 },
  straightFlush:{ name: '同花顺', chips: 100, mult: 8,  perChips: 40, perMult: 4, rank: 9 },
  quads:        { name: '四条',   chips: 60,  mult: 7,  perChips: 30, perMult: 3, rank: 8 },
  fullHouse:    { name: '葫芦',   chips: 40,  mult: 4,  perChips: 25, perMult: 2, rank: 7 },
  flush:        { name: '同花',   chips: 35,  mult: 4,  perChips: 15, perMult: 2, rank: 6 },
  straight:     { name: '顺子',   chips: 30,  mult: 4,  perChips: 30, perMult: 3, rank: 5 },
  trips:        { name: '三条',   chips: 30,  mult: 3,  perChips: 20, perMult: 2, rank: 4 },
  twoPair:      { name: '两对',   chips: 20,  mult: 2,  perChips: 20, perMult: 1, rank: 3 },
  pair:         { name: '一对',   chips: 10,  mult: 2,  perChips: 15, perMult: 1, rank: 2 },
  highCard:     { name: '高牌',   chips: 5,   mult: 1,  perChips: 10, perMult: 1, rank: 1 },
};

// 携带道具（对应同类游戏的"小丑牌"）
// hooks: onCard(每张计分卡) / onHand(整手打出后) / onWinMoney / priceDiscount / finalChipsMult
export const ITEMS = {
  // —— 常见 $4 ——
  charcoal:    { name: '木炭', slug: 'charcoal', rarity: 'common', desc: '打出的每张【火】属性卡 +3 倍率', onCard: (c, api) => { if (c.type === 'fire') api.addMult(3); } },
  mysticWater: { name: '神秘水滴', slug: 'mystic-water', rarity: 'common', desc: '打出的每张【水】属性卡 +40 攻击', onCard: (c, api) => { if (c.type === 'water') api.addChips(40); } },
  miracleSeed: { name: '奇迹种子', slug: 'miracle-seed', rarity: 'common', desc: '打出的每张【草】属性卡 +40 攻击', onCard: (c, api) => { if (c.type === 'grass') api.addChips(40); } },
  magnet:      { name: '磁铁', slug: 'magnet', rarity: 'common', desc: '打出的每张【电】属性卡 +3 倍率', onCard: (c, api) => { if (c.type === 'electric') api.addMult(3); } },
  twistedSpoon:{ name: '弯曲的汤匙', slug: 'twisted-spoon', rarity: 'common', desc: '打出的每张【超能】属性卡 +40 攻击', onCard: (c, api) => { if (c.type === 'psychic') api.addChips(40); } },
  blackBelt:   { name: '黑带', slug: 'black-belt', rarity: 'common', desc: '打出的每张【格斗】属性卡 +3 倍率', onCard: (c, api) => { if (c.type === 'fighting') api.addMult(3); } },
  poisonBarb:  { name: '毒针', slug: 'poison-barb', rarity: 'common', desc: '打出的每张【毒】属性卡 +40 攻击', onCard: (c, api) => { if (c.type === 'poison') api.addChips(40); } },
  silkScarf:   { name: '丝绸围巾', slug: 'silk-scarf', rarity: 'common', desc: '打出的每张【一般】属性卡 +3 倍率', onCard: (c, api) => { if (c.type === 'normal') api.addMult(3); } },
  hardStone:   { name: '硬石头', slug: 'hard-stone', rarity: 'common', desc: '力量值为偶数的卡 +25 攻击', onCard: (c, api) => { if (c.power % 2 === 0) api.addChips(25); } },
  ppUp:        { name: 'PP提升剂', slug: 'pp-up', rarity: 'common', desc: '力量值为奇数的卡 +25 攻击', onCard: (c, api) => { if (c.power % 2 === 1) api.addChips(25); } },
  // —— 罕见 $6 ——
  choiceSpecs: { name: '讲究眼镜', slug: 'choice-specs', rarity: 'uncommon', desc: '打出【顺子】时 +60 攻击', onHand: (ev, api) => { if (ev.key === 'straight') api.addChips(60); } },
  scopeLens:   { name: '聚焦镜', slug: 'scope-lens', rarity: 'uncommon', desc: '打出【同花】时 +4 倍率', onHand: (ev, api) => { if (ev.key === 'flush') api.addMult(4); } },
  expertBelt:  { name: '达人带', slug: 'expert-belt', rarity: 'uncommon', desc: '打出【四条】或【五连击】时，倍率 ×1.5', onHand: (ev, api) => { if (ev.key === 'quads' || ev.key === 'fiveOfAKind') api.xMult(1.5); } },
  kingsRock:   { name: '王者之证', slug: 'kings-rock', rarity: 'uncommon', desc: '打出的每张力量 10 的卡 +3 倍率', onCard: (c, api) => { if (c.power === 10) api.addMult(3); } },
  leek:        { name: '大葱', slug: 'leek', rarity: 'uncommon', desc: '打出的每张力量 5 的卡 +8 倍率', onCard: (c, api) => { if (c.power === 5) api.addMult(8); } },
  eviolite:    { name: '进化奇石', slug: 'eviolite', rarity: 'uncommon', desc: '打出【两对】时 +4 倍率', onHand: (ev, api) => { if (ev.key === 'twoPair') api.addMult(4); } },
  flameOrb:    { name: '火焰宝珠', slug: 'flame-orb', rarity: 'uncommon', desc: '打出【葫芦】时 +6 倍率', onHand: (ev, api) => { if (ev.key === 'fullHouse') api.addMult(6); } },
  razorClaw:   { name: '锐利之爪', slug: 'razor-claw', rarity: 'uncommon', desc: '打出【三条】时 +50 攻击', onHand: (ev, api) => { if (ev.key === 'trips') api.addChips(50); } },
  dragonFang:  { name: '龙之牙', slug: 'dragon-fang', rarity: 'uncommon', desc: '打出【顺子】时 +3 倍率', onHand: (ev, api) => { if (ev.key === 'straight') api.addMult(3); } },
  metalCoat:   { name: '金属外套', slug: 'metal-coat', rarity: 'uncommon', desc: '本场战斗打出的第一手牌 +2 倍率', onHand: (ev, api) => { if (api.fight.plays === 0) api.addMult(2); } },
  leftovers:   { name: '剩饭', slug: 'leftovers', rarity: 'uncommon', desc: '每场战斗胜利额外获得 $2', onWinMoney: () => 2 },
  amuletCoin:  { name: '护身金币', slug: 'amulet-coin', rarity: 'uncommon', desc: '每场战斗胜利额外获得 $3', onWinMoney: () => 3 },
  // —— 稀有 $8 ——
  luckyEgg:    { name: '幸运蛋', slug: 'lucky-egg', rarity: 'rare', desc: '商店所有商品价格 -$1（最低 $1）', priceDiscount: 1 },
  lifeOrb:     { name: '生命宝珠', slug: 'life-orb', rarity: 'rare', desc: '每手牌的最终攻击值 ×1.25', finalChipsMult: 1.25 },
  choiceBand:  { name: '讲究头带', slug: 'choice-band', rarity: 'rare', desc: '打出的手牌包含 5 张卡时，倍率 ×1.4', onHand: (ev, api) => { if (api.playedCount === 5) api.xMult(1.4); } },
  wideLens:    { name: '广角镜', slug: 'wide-lens', rarity: 'rare', desc: '打出【高牌】时，倍率 ×2', onHand: (ev, api) => { if (ev.key === 'highCard') api.xMult(2); } },
  soulDew:     { name: '心之水滴', slug: 'soul-dew', rarity: 'rare', desc: '打出【同花顺】时，倍率 ×2', onHand: (ev, api) => { if (ev.key === 'straightFlush') api.xMult(2); } },
  choiceScarf: {
    name: '讲究围巾', slug: 'choice-scarf', rarity: 'rare',
    desc: '每手牌 +2 倍率；每赢得一场战斗，加成再 +2（滚雪球）',
    onHand: (ev, api) => { api.addMult(2 + (api.run.itemBonus[api.id] || 0)); },
    onFightWon: (run, id) => { run.itemBonus[id] = (run.itemBonus[id] || 0) + 2; },
  },
  sacredAsh:   {
    name: '圣灰', slug: 'sacred-ash', rarity: 'rare',
    desc: '每手牌 +25 攻击；每赢得一场战斗，加成再 +25（滚雪球）',
    onHand: (ev, api) => { api.addChips(25 + (api.run.itemBonus[api.id] || 0)); },
    onFightWon: (run, id) => { run.itemBonus[id] = (run.itemBonus[id] || 0) + 25; },
  },
  // —— 天气流（同时只生效一个天气，后买的覆盖先买的） ——
  heatRock:   { name: '炽热岩石', slug: 'heat-rock', rarity: 'uncommon',
    desc: '天气【☀ 大晴天】：火/草属性卡攻击 ×1.5，水属性卡攻击 ×0.75',
    weather: { name: '☀ 大晴天', boost: ['fire', 'grass'], weak: ['water'] } },
  dampRock:   { name: '潮湿岩石', slug: 'damp-rock', rarity: 'uncommon',
    desc: '天气【🌧 下雨】：水/电属性卡攻击 ×1.5，火属性卡攻击 ×0.75',
    weather: { name: '🌧 下雨', boost: ['water', 'electric'], weak: ['fire'] } },
  smoothRock: { name: '光滑岩石', slug: 'smooth-rock', rarity: 'uncommon',
    desc: '天气【🌪 沙暴】：格斗/一般属性卡攻击 ×1.5，草属性卡攻击 ×0.75',
    weather: { name: '🌪 沙暴', boost: ['fighting', 'normal'], weak: ['grass'] } },
  icyRock:    { name: '冰凉岩石', slug: 'icy-rock', rarity: 'uncommon',
    desc: '天气【❄ 冰雹】：超能/毒属性卡攻击 ×1.5，一般属性卡攻击 ×0.75',
    weather: { name: '❄ 冰雹', boost: ['psychic', 'poison'], weak: ['normal'] } },
  // —— 受队（耐久消耗流） ——
  toxicOrb:   { name: '剧毒宝珠', slug: 'toxic-orb', rarity: 'rare',
    desc: '受队核心：每打出一张【毒】属性卡，对手中毒 +1 层；此后每手牌结算后造成 中毒层数×20 固定伤害' },
  focusSash:  { name: '气势披带', slug: 'focus-sash', rarity: 'rare',
    desc: '受队保险：本场战斗手牌机会用尽仍未获胜时，追加 1 手牌机会（每场一次）' },
};

export const RARITY = {
  common:   { name: '常见', price: 4, weight: 55, color: '#4a9fd8' },
  uncommon: { name: '罕见', price: 6, weight: 33, color: '#4abb78' },
  rare:     { name: '稀有', price: 8, weight: 12, color: '#e0a030' },
};

// 消耗品（对应"行星牌/塔罗牌"位）
// target: 'card'=战斗中选手牌 | 'handType'=选手牌类型 | 'deckCard'=牌组中选一张 | 'none'=立即生效
export const CONSUMABLES = {
  protein:    { name: '蛋白质', slug: 'protein', price: 4, desc: '为一张卡永久 +60 攻击', target: 'card', apply: (card) => { card.chipBonus += 60; } },
  zinc:       { name: '锌补剂', slug: 'zinc', price: 4, desc: '为一张卡永久 +4 倍率', target: 'card', apply: (card) => { card.multBonus += 4; } },
  upGrade:    { name: '升级数据', slug: 'up-grade', price: 6, desc: '选择一种手牌类型，等级 +1', target: 'handType', apply: (run, key) => { run.handLevels[key] = (run.handLevels[key] || 1) + 1; } },
  escapeRope: { name: '离洞绳', slug: 'escape-rope', price: 4, desc: '放生一张卡，将其从牌组中永久移除（牌组至少保留 20 张）', target: 'deckCard', deckOp: 'remove' },
  pokeBall:   { name: '精灵球', slug: 'poke-ball', price: 4, desc: '随机捕获一只新宝可梦加入牌组（5% 概率是闪光！）', target: 'none', deckOp: 'capture' },
  repeatBall: { name: '重复球', slug: 'repeat-ball', price: 6, desc: '复制一张卡（连同强化与闪光），加入牌组', target: 'deckCard', deckOp: 'copy' },
  cherishBall:{ name: '珍贵球', slug: 'cherish-ball', price: 8, desc: '使一张卡变为闪光：立绘变为闪光版，攻击 +80', target: 'deckCard', deckOp: 'shiny' },
};

// 道馆与对手。每馆 = 训练师战( idx 偶 ) + 馆主战( idx 奇 )，共 16 场 + 冠军战
// rule.kind: debuffType | minusDiscards | minusHandSize | minusHands | sleep | sealType | flushMinus | multCap | none
// color: 道馆主题色（战斗界面点缀）；victory: 胜利台词
export const GYMS = [
  { gym: '尼比道馆', leader: '小刚', badge: '灰色徽章', ace: 95, aceName: '大岩蛇', color: '#b8a038',
    trainer: '短裤小子·阿健', trainerAce: 74, trainerAceName: '小拳石',
    rule: { kind: 'debuffType', type: 'fire', factor: 0.5 }, ruleDesc: '磐石壁垒：【火】属性卡的攻击减半',
    victory: '岩石般的意志，也会有被水流磨平的一天……这枚徽章，是你的了。',
    dialogue: [
      { s: '小刚', t: '欢迎来到尼比道馆！我像岩石一样坚强！' },
      { s: '小刚', t: '我的宝可梦不怕烈焰——石头烧不化。你的火系战术，在这里行不通！' },
    ] },
  { gym: '华蓝道馆', leader: '小霞', badge: '蓝色徽章', ace: 121, aceName: '宝石海星', color: '#58a6f0',
    trainer: '泳装姐姐·小琳', trainerAce: 118, trainerAceName: '角金鱼',
    rule: { kind: 'minusDiscards', n: 2 }, ruleDesc: '水之波动：本场弃牌次数 -2',
    victory: '哼！下次我会更漂亮地赢回来。拿去，蓝色徽章！',
    dialogue: [
      { s: '小霞', t: '华蓝道馆的美人鱼，就是我！' },
      { s: '小霞', t: '水看起来温柔，也能把你冲得七零八落。弃牌的机会，我可不会多给你。' },
    ] },
  { gym: '枯叶道馆', leader: '马志士', badge: '橙色徽章', ace: 125, aceName: '电击兽', color: '#f8d030',
    trainer: '水兵·大志', trainerAce: 81, trainerAceName: '小磁怪',
    rule: { kind: 'minusHandSize', n: 1 }, ruleDesc: '电网压制：手牌上限 -1（7 张）',
    victory: '了不起！你这种速度，连我的闪电都追不上！',
    dialogue: [
      { s: '马志士', t: '十年来，我在战场上一次都没输过！' },
      { s: '马志士', t: '尝尝我的电网！腾不出空间的牌手，赢不了闪电战！' },
    ] },
  { gym: '彩虹道馆', leader: '莉佳', badge: '彩虹徽章', ace: 45, aceName: '霸王花', color: '#63bc5a',
    trainer: '花童·小花', trainerAce: 44, trainerAceName: '臭臭花',
    rule: { kind: 'sleep' }, ruleDesc: '催眠粉：每次补充手牌后，随机一张手牌陷入睡眠无法打出',
    victory: '打得真好……这朵徽章，就像礼物一样送给你。',
    dialogue: [
      { s: '莉佳', t: '彩虹道馆，以花之名欢迎您。' },
      { s: '莉佳', t: '请小心……花香太浓的话，您的宝可梦会睡着的。' },
    ] },
  { gym: '浅红道馆', leader: '阿橘', badge: '粉色徽章', ace: 110, aceName: '双弹瓦斯', color: '#a040a0',
    trainer: '忍者·阿忍', trainerAce: 109, trainerAceName: '瓦斯弹',
    rule: { kind: 'minusHands', n: 1 }, ruleDesc: '毒雾弥漫：本场手数 -1（3 手）',
    victory: '败得心服口服。忍者的字典里，没有借口两个字。',
    dialogue: [
      { s: '阿橘', t: '忍者的世界里，一击定胜负。' },
      { s: '阿橘', t: '毒雾正在弥漫……你出手的机会，只有三次。' },
    ] },
  { gym: '金黄道馆', leader: '娜姿', badge: '金色徽章', ace: 65, aceName: '胡地', color: '#f858a8',
    trainer: '超能力者·小遥', trainerAce: 64, trainerAceName: '勇基拉',
    rule: { kind: 'sealType' }, ruleDesc: '意念封锁：随机一种属性被封锁，该属性卡的攻击减半',
    victory: '……有趣。我的预知能力，第一次落空了。',
    dialogue: [
      { s: '娜姿', t: '你的到来，我早就用超能力预见了。' },
      { s: '娜姿', t: '同样预见了……你最依赖的那个属性，会被我封印。' },
    ] },
  { gym: '红莲道馆', leader: '夏伯', badge: '深红徽章', ace: 59, aceName: '风速狗', color: '#f08030',
    trainer: '赌徒·老张', trainerAce: 58, trainerAceName: '卡蒂狗',
    rule: { kind: 'flushMinus', n: 3 }, ruleDesc: '猜谜时间：打出【同花】时倍率 -3',
    victory: '哈哈哈！好答案！老头子我输得痛快！',
    dialogue: [
      { s: '夏伯', t: '哈哈哈！想赢我这个老头的道馆，先答对一道题！' },
      { s: '夏伯', t: '问题来了——把属性堆成一片的战术，在我的火焰里值几分？' },
    ] },
  { gym: '常磐道馆', leader: '板木', badge: '绿色徽章', ace: 112, aceName: '钻角犀兽', color: '#c8b060',
    trainer: '火箭队手下', trainerAce: 24, trainerAceName: '阿柏蛇',
    rule: { kind: 'multCap', cap: 12 }, ruleDesc: '地震：每手牌的倍率最高只能到 12',
    victory: '哼……绿色徽章拿去吧。以你的实力，要不要考虑来火箭队？',
    dialogue: [
      { s: '板木', t: '常磐道馆馆主、火箭队的老大——板木，就是我。' },
      { s: '板木', t: '在大地的震怒面前，再高的倍率也是徒劳。力量，是有上限的。' },
    ] },
];

export const CHAMPION = {
  gym: '石英高原', leader: '冠军·青绿', badge: '冠军之证', ace: 149, aceName: '快龙', color: '#f0c040',
  rule: { kind: 'none' }, ruleDesc: '名副其实的最强训练家，没有花招——只有强大的实力。',
  victory: '……怎么会！好吧，冠军的宝座暂且借你坐坐。下次，我一定赢回来！',
  dialogue: [
    { s: '青绿', t: '喂！总算走到这里了啊。' },
    { s: '青绿', t: '我是冠军青绿。不用花招，把你所有的牌，全部砸过来吧！' },
  ],
};

// 每周挑战变体（按周号确定性轮换）
export const WEEKLY_VARIANTS = [
  { key: 'standard', name: '标准周', desc: '经典规则，公平对决' },
  { key: 'elite',    name: '精英周', desc: '所有对手血量 +25%' },
  { key: 'speed',    name: '疾风周', desc: '每场战斗手数 -1（3 手）' },
  { key: 'poverty',  name: '拮据周', desc: '战斗奖励与存款利息减半' },
  { key: 'draft',    name: '精简周', desc: '开局随机放生 20 张，牌组只剩 60 张' },
  { key: 'duo',      name: '双属性周', desc: '牌组只由随机两种属性组成（20 张），同花随便凑' },
  { key: 'sudden',   name: '决斗周', desc: '每场只有 2 手牌，但对手血量 -40%' },
];

export function weeklyVariant(weekKeyStr) {
  let h = 2166136261;
  for (let i = 0; i < weekKeyStr.length; i++) {
    h ^= weekKeyStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return WEEKLY_VARIANTS[(h >>> 0) % WEEKLY_VARIANTS.length];
}

// 战斗数值曲线
export const RULES = {
  startMoney: 6,
  trainerReward: 7,
  leaderReward: 12,
  interestPer: 5,     // 每 $5 存款
  interestMax: 6,
  baseTarget: 280,    // 第 0 场目标
  growth: 1.26,       // 每场增长
  leaderMult: 1.4,    // 馆主战倍率
  championMult: 1.45, // 冠军战倍率
  handSize: 8,
  handsPerFight: 4,
  discardsPerFight: 3,
  itemSlots: 5,
  consumableSlots: 2,
  rerollCost: 5,
};

export function targetHp(fightIdx) {
  const { baseTarget, growth, leaderMult, championMult } = RULES;
  const totalFights = GYMS.length * 2 + 1;
  if (fightIdx >= totalFights - 1) return Math.round(baseTarget * Math.pow(growth, 15) * championMult);
  const isLeader = fightIdx % 2 === 1;
  return Math.round(baseTarget * Math.pow(growth, fightIdx) * (isLeader ? leaderMult : 1));
}

export function cardChips(card) {
  return 8 + card.power * 2 + card.chipBonus + (card.shiny ? 80 : 0);
}

export function handBase(key, level) {
  const h = HANDS[key];
  const lv = level - 1;
  return { chips: h.chips + h.perChips * lv, mult: h.mult + h.perMult * lv };
}
