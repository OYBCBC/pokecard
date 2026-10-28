// ============================================
// 游戏引擎：牌堆 / 判牌 / 计分 / 肉鸽流程
// 所有状态均为可 JSON 序列化的纯数据
// ============================================
import {
  TYPES, ROSTER, HANDS, ITEMS, RARITY, CONSUMABLES, GYMS, CHAMPION, RULES, WEEKLY_VARIANTS,
  weeklyVariant, targetHp, cardChips, handBase,
} from './data.js';
import { makeRng, rngNext, rngInt, rngPick, shuffle } from './rng.js';

// ---------- 新的一局 ----------
export function newRun(seed, weeklyKey = null, forcedVariant = null) {
  const run = {
    v: 1,
    seed,
    weekly: weeklyKey,
    daily: null,         // 每日挑战 key（YYYY-MM-DD）
    roomKey: null,       // 挑战房榜 key（ROOM-XXXX）
    variant: forcedVariant || (weeklyKey ? weeklyVariant(weeklyKey).key : null),
    token: Date.now().toString(36) + Math.random().toString(36).slice(2, 10), // 周榜防刷令牌
    submitted: false,
    rng: makeRng(seed),
    fightIdx: 0,          // 0..15 训练师/馆主，16 冠军
    money: RULES.startMoney,
    deck: buildDeck(),
    items: [],            // 道具 id 列表（最多 5）
    itemBonus: {},        // 成长型道具的累计加成 itemId -> n
    consumables: [],      // 消耗品 id 列表（最多 2）
    handLevels: {},       // handKey -> level（默认 1）
    handUses: {},         // handKey -> 本局使用次数
    stats: { maxHit: 0, handsPlayed: 0, fightsWon: 0, moneyEarned: 0 },
    history: [],          // 战报：每手牌记录
    fight: null,
    phase: 'battle',      // battle | shop
    shop: null,
  };
  if (run.variant === 'draft') applyDraftTrim(run);
  if (run.variant === 'duo') applyDuoDeck(run);
  startFight(run);
  return run;
}

// 精简周：随机放生 20 张（每种属性至少保留 5 张）
function applyDraftTrim(run) {
  const shuffled = shuffle(run.rng, [...run.deck]);
  const typeCount = {};
  for (const c of run.deck) typeCount[c.type] = (typeCount[c.type] || 0) + 1;
  const removed = new Set();
  for (const c of shuffled) {
    if (removed.size >= 20) break;
    if (typeCount[c.type] > 5) {
      removed.add(c.uid);
      typeCount[c.type]--;
    }
  }
  run.deck = run.deck.filter(c => !removed.has(c.uid));
}

// 双属性周：只保留随机两种属性（20 张）
function applyDuoDeck(run) {
  const types = Object.keys(TYPES);
  const typeA = types[rngInt(run.rng, types.length)];
  let typeB = types[rngInt(run.rng, types.length)];
  while (typeB === typeA) typeB = types[rngInt(run.rng, types.length)];
  run.deck = run.deck.filter(c => c.type === typeA || c.type === typeB);
  run.duoTypes = [typeA, typeB];
}

let uidCounter = 0;
function buildDeck() {
  const deck = [];
  for (const [type, list] of Object.entries(ROSTER)) {
    list.forEach(([dex, name], i) => {
      deck.push({
        uid: ++uidCounter,
        dex, name, type,
        power: i + 1,
        chipBonus: 0,   // 蛋白质等永久加成
        multBonus: 0,   // 锌补剂等永久加成
        shiny: false,   // 闪光（珍贵球）
      });
    });
  }
  return deck;
}

function nextUid() { return ++uidCounter; }

export function fightCount() { return GYMS.length * 2 + 1; }

export function fightInfo(fightIdx) {
  if (fightIdx >= GYMS.length * 2) {
    return {
      kind: 'champion', isLeader: true, ...CHAMPION,
      name: CHAMPION.leader, aceId: CHAMPION.ace, aceName: CHAMPION.aceName,
      gymIdx: GYMS.length,
    };
  }
  const gymIdx = Math.floor(fightIdx / 2);
  const g = GYMS[gymIdx];
  const isLeader = fightIdx % 2 === 1;
  return isLeader
    ? { kind: 'leader', isLeader: true, ...g, name: `馆主 ${g.leader}`, aceId: g.ace, aceName: g.aceName, gymIdx }
    : { kind: 'trainer', isLeader: false, ...g, name: g.trainer, aceId: g.trainerAce, aceName: g.trainerAceName, gymIdx };
}

// ---------- 战斗 ----------
export function startFight(run) {
  const info = fightInfo(run.fightIdx);
  let hp = targetHp(run.fightIdx);
  let hands = RULES.handsPerFight - (info.rule.kind === 'minusHands' ? info.rule.n : 0);
  if (run.variant === 'speed') hands -= 1;                    // 疾风周
  if (run.variant === 'elite') hp = Math.round(hp * 1.25);   // 精英周
  if (run.variant === 'sudden') { hp = Math.round(hp * 0.6); hands = 2; } // 决斗周
  const rule = info.isLeader ? { ...info.rule } : { kind: 'none' }; // 训练师战无馆主规则
  // 娜姿：随机封锁一种属性
  if (rule.kind === 'sealType') rule.type = rngPick(run.rng, Object.keys(TYPES));
  run.fight = {
    info, rule, hp, maxHp: hp,
    hands,
    discards: RULES.discardsPerFight - (rule.kind === 'minusDiscards' ? rule.n : 0),
    handSize: RULES.handSize - (rule.kind === 'minusHandSize' ? rule.n : 0),
    plays: 0,
    drawPile: [], hand: [], discardPile: [],
    sleepUid: null,
    poison: 0,        // 剧毒层数（剧毒宝珠）
    sashUsed: false,  // 气势披带是否已用（本场）
  };
  refillPile(run);
  drawTo(run, run.fight.handSize);
}

function refillPile(run) {
  const f = run.fight;
  f.drawPile = run.deck.map(c => c.uid);
  shuffle(run.rng, f.drawPile);
  f.discardPile = [];
}

function cardByUid(run, uid) {
  return run.deck.find(c => c.uid === uid);
}

export function drawTo(run, n) {
  const f = run.fight;
  while (f.hand.length < n) {
    if (f.drawPile.length === 0) {
      if (f.discardPile.length === 0) refillPile(run);
      else { f.drawPile = shuffle(run.rng, [...f.discardPile]); f.discardPile = []; }
    }
    if (f.drawPile.length === 0) break;
    const uid = f.drawPile.pop();
    f.hand.push(uid);
    const card = cardByUid(run, uid);
    if (card) markCardSeen(card);
  }
  // 莉佳·催眠粉：补牌后随机一张未睡眠的手牌入睡
  if (f.rule.kind === 'sleep' && f.hand.length > 0) {
    f.sleepUid = f.hand[rngInt(run.rng, f.hand.length)];
  } else {
    f.sleepUid = null;
  }
}

function uidToDex(run, uid) {
  const c = run.deck.find(c => c.uid === uid);
  return c ? c.dex : null;
}

// ---------- 图鉴（跨局累积，闪光单独标记） ----------
const DEX_KEY = 'gymrun-dex-v1';
const DEX_SHINY_KEY = 'gymrun-dex-shiny-v1';
let dexState = null;
let dexShinyState = null;

export function loadDex() {
  if (dexState) return dexState;
  try {
    dexState = JSON.parse(localStorage.getItem(DEX_KEY)) || {};
  } catch (e) { dexState = {}; }
  return dexState;
}

export function loadDexShiny() {
  if (dexShinyState) return dexShinyState;
  try {
    dexShinyState = JSON.parse(localStorage.getItem(DEX_SHINY_KEY)) || {};
  } catch (e) { dexShinyState = {}; }
  return dexShinyState;
}

export function markDexSeen(dexId) {
  if (dexId == null) return;
  const dex = loadDex();
  dex[dexId] = (dex[dexId] || 0) + 1;
  try { localStorage.setItem(DEX_KEY, JSON.stringify(dex)); } catch (e) {}
}

// 只点亮闪光图鉴（不重复计普通遇见次数）
export function markShinySeen(dexId) {
  if (dexId == null) return;
  const s = loadDexShiny();
  s[dexId] = (s[dexId] || 0) + 1;
  try { localStorage.setItem(DEX_SHINY_KEY, JSON.stringify(s)); } catch (e) {}
}

// 完整卡牌入册：普通遇见计数；闪光额外点亮闪光图鉴
export function markCardSeen(card) {
  if (!card) return;
  markDexSeen(card.dex);
  if (card.shiny) markShinySeen(card.dex);
}

export function dexSeenCount() {
  return Object.keys(loadDex()).length;
}

export function dexShinyCount() {
  return Object.keys(loadDexShiny()).length;
}

export function selectableCardUids(run) {
  const f = run.fight;
  return f.hand.filter(uid => uid !== f.sleepUid);
}

// ---------- 判牌（扑克规则） ----------
// 输入：打出的 1~5 张卡；输出最优手牌类型与参与计分的卡
export function evaluate(cards) {
  const sorted = [...cards].sort((a, b) => b.power - a.power);
  const byPower = new Map();
  for (const c of sorted) {
    if (!byPower.has(c.power)) byPower.set(c.power, []);
    byPower.get(c.power).push(c);
  }
  const groups = [...byPower.values()].sort((a, b) => b.length - a.length || b[0].power - a[0].power);
  const n = cards.length;
  const isFlush = n === 5 && cards.every(c => c.type === cards[0].type);
  let straightRun = null;
  if (n === 5) {
    const powers = [...new Set(sorted.map(c => c.power))].sort((a, b) => a - b);
    if (powers.length === 5) {
      let ok = true;
      for (let i = 1; i < 5; i++) if (powers[i] !== powers[i - 1] + 1) { ok = false; break; }
      if (ok) straightRun = powers;
    }
  }
  const samePower = k => groups.find(g => g.length === k);

  if (n === 5 && groups[0].length === 5) return { key: 'fiveOfAKind', cards: groups[0] };
  if (isFlush && straightRun) return { key: 'straightFlush', cards: sorted };
  if (samePower(4)) return { key: 'quads', cards: samePower(4) };
  if (samePower(3) && groups[1] && groups[1].length === 2) return { key: 'fullHouse', cards: [...groups[0], ...groups[1]] };
  if (isFlush) return { key: 'flush', cards: sorted };
  if (straightRun) return { key: 'straight', cards: sorted };
  if (samePower(3)) return { key: 'trips', cards: samePower(3) };
  const pairs = groups.filter(g => g.length === 2);
  if (pairs.length >= 2) return { key: 'twoPair', cards: [...pairs[0], ...pairs[1]] };
  if (pairs.length === 1) return { key: 'pair', cards: pairs[0] };
  return { key: 'highCard', cards: [sorted[0]] };
}

// ---------- 计分 ----------
// 返回 { events, total }，events 供 UI 播放动画
export function scoreHand(run, playedUids) {
  const f = run.fight;
  const played = playedUids.map(uid => cardByUid(run, uid));
  const ev = evaluate(played);
  const level = run.handLevels[ev.key] || 1;
  const base = handBase(ev.key, level);
  let chips = base.chips, mult = base.mult;
  const events = [{ type: 'base', hand: ev.key, chips, mult, level }];

  const ctx = {
    fight: f, run, playedCount: played.length,
    addChips(n) { chips += n; },
    addMult(n) { mult += n; },
    xMult(x) { mult *= x; },
  };
  const ownedItems = run.items.map(id => ({ id, def: ITEMS[id] }));
  // 每个道具拿到带自己 id 的 api（成长型道具需要）
  const makeApi = it => ({ ...ctx, id: it.id, run });
  // 生效中的天气（后买的覆盖先买的）
  const weatherItem = [...ownedItems].reverse().find(it => it.def.weather);

  // 1) 逐张计分卡结算（含卡牌自身数值与加成）
  for (const card of ev.cards) {
    let gain = cardChips(card);
    // 天气乘区
    let weatherMult = 0;
    if (weatherItem) {
      const w = weatherItem.def.weather;
      if (w.boost.includes(card.type)) weatherMult = 1.5;
      else if (w.weak.includes(card.type)) weatherMult = 0.75;
      if (weatherMult) gain = Math.round(gain * weatherMult);
    }
    // 馆主规则：属性削弱
    const r = f.rule;
    if ((r.kind === 'debuffType' && card.type === r.type) ||
        (r.kind === 'sealType' && card.type === r.type)) {
      gain = Math.floor(gain * r.factor);
      events.push({ type: 'ruleDebuff', cardUid: card.uid });
    }
    chips += gain;
    const ev0 = { type: 'card', cardUid: card.uid, chipsGain: gain, multGain: card.multBonus };
    if (weatherMult) ev0.weather = weatherMult;
    events.push(ev0);
    if (card.multBonus) mult += card.multBonus;
    // 道具的逐卡钩子
    for (const it of ownedItems) {
      if (it.def.onCard) {
        const before = { chips, mult };
        it.def.onCard(card, makeApi(it));
        if (chips !== before.chips || mult !== before.mult) {
          events.push({ type: 'item', itemId: it.id, chipsGain: chips - before.chips, multGain: mult - before.mult });
        }
      }
    }
  }

  // 2) 整手钩子（道具）
  for (const it of ownedItems) {
    if (it.def.onHand) {
      const before = { chips, mult };
      it.def.onHand(ev, makeApi(it));
      if (chips !== before.chips || mult !== before.mult) {
        events.push({ type: 'item', itemId: it.id, chipsGain: chips - before.chips, multGain: mult - before.mult });
      }
    }
  }

  // 3) 馆主规则：同花削弱（夏伯）
  if (f.rule.kind === 'flushMinus' && ev.key === 'flush') {
    mult -= f.rule.n;
    events.push({ type: 'ruleDebuff', chipsGain: 0, multGain: -f.rule.n });
  }

  // 4) 生命宝珠：最终攻击值加成
  for (const it of ownedItems) {
    if (it.def.finalChipsMult) {
      chips = Math.round(chips * it.def.finalChipsMult);
      events.push({ type: 'item', itemId: it.id, chipsGain: null, multGain: null, finalMult: it.def.finalChipsMult });
    }
  }

  // 5) 板木：倍率封顶
  if (f.rule.kind === 'multCap' && mult > f.rule.cap) {
    events.push({ type: 'ruleCap', from: mult, to: f.rule.cap });
    mult = f.rule.cap;
  }

  let total = Math.max(1, Math.round(chips * mult));
  events.push({ type: 'total', chips, mult, total });

  // 剧毒宝珠：打出毒属性卡叠层，此后每手结算造成固定伤害
  let poisonDmg = 0;
  if (run.items.includes('toxicOrb')) {
    const add = played.filter(c => c.type === 'poison').length;
    if (add > 0) {
      f.poison += add;
      events.push({ type: 'poison', add, stacks: f.poison });
    }
    if (f.poison > 0) {
      poisonDmg = f.poison * 20;
      f.hp = Math.max(0, f.hp - poisonDmg);
      events.push({ type: 'poisonDmg', stacks: f.poison, damage: poisonDmg });
    }
  }

  // 应用状态
  f.hp = Math.max(0, f.hp - total);
  f.plays++;
  f.hands--;
  // 气势披带：手数用尽仍未获胜 → 追加一手（每场一次）
  if (f.hp > 0 && f.hands <= 0 && !f.sashUsed && run.items.includes('focusSash')) {
    f.hands += 1;
    f.sashUsed = true;
    events.push({ type: 'sash' });
  }
  for (const uid of playedUids) {
    f.hand = f.hand.filter(u => u !== uid);
    f.discardPile.push(uid);
  }
  run.handUses[ev.key] = (run.handUses[ev.key] || 0) + 1;
  run.stats.handsPlayed++;
  run.stats.maxHit = Math.max(run.stats.maxHit, total + poisonDmg);
  run.history.push({
    f: run.fightIdx, opp: f.info.name, hand: ev.key,
    p: run.mode === '2p' ? 'P' + (run.activeIdx + 1) : null,
    cards: played.map(c => c.name), chips, mult, total, poison: poisonDmg,
  });
  return { events, total, ev, played };
}

export function discardCards(run, uids) {
  const f = run.fight;
  f.discards--;
  for (const uid of uids) {
    f.hand = f.hand.filter(u => u !== uid);
    f.discardPile.push(uid);
  }
  drawTo(run, f.handSize);
}

export function afterPlay(run) {
  const f = run.fight;
  drawTo(run, f.handSize);
}

export function fightWon(run) { return run.fight.hp <= 0; }
export function fightLost(run) { return run.fight.hands <= 0 && run.fight.hp > 0; }

// ---------- 战斗胜利结算 ----------
export function previewReward(run) {
  const info = run.fight.info;
  const poverty = run.variant === 'poverty';
  const base = Math.floor((info.isLeader ? RULES.leaderReward : RULES.trainerReward) * (poverty ? 0.5 : 1));
  const rawInterest = Math.min(RULES.interestMax, Math.floor(run.money / RULES.interestPer));
  const interest = poverty ? Math.floor(rawInterest / 2) : rawInterest;
  let bonus = 0;
  for (const id of run.items) {
    if (ITEMS[id] && ITEMS[id].onWinMoney) bonus += ITEMS[id].onWinMoney(run);
  }
  return { base, interest, bonus, total: base + interest + bonus };
}

export function winFight(run) {
  const detail = previewReward(run); // 奖励明细（含变体修正）
  // 成长型道具：胜利后累计加成
  for (const id of run.items) {
    if (ITEMS[id] && ITEMS[id].onFightWon) ITEMS[id].onFightWon(run, id);
  }
  run.money += detail.total;
  run.stats.moneyEarned += detail.total;
  run.stats.fightsWon++;
  run.fightIdx++;
  if (run.mode === '2p') {
    run.players[run.activeIdx] = snapshotPlayer(run); // 同步当前玩家槽位
    if (run.fightIdx >= fightCount()) run.winner = run.activeIdx;
  }
  if (run.fightIdx >= fightCount()) {
    run.phase = 'victory';
    return detail;
  }
  openShop(run);
  return detail;
}

// ---------- 商店 ----------
export function openShop(run) {
  run.phase = 'shop';
  run.shop = { items: [], consumables: [], rerolls: 0, bought: {} };
  restock(run);
}

export function itemPrice(run, id) {
  const def = ITEMS[id];
  let p = RARITY[def.rarity].price;
  for (const own of run.items) {
    if (ITEMS[own] && ITEMS[own].priceDiscount) p -= ITEMS[own].priceDiscount;
  }
  return Math.max(1, p);
}

function rollItem(run) {
  const roll = rngNext(run.rng) * 100;
  let rarity = roll < RARITY.rare.weight ? 'rare'
    : roll < RARITY.rare.weight + RARITY.uncommon.weight ? 'uncommon' : 'common';
  const pool = Object.keys(ITEMS).filter(id =>
    ITEMS[id].rarity === rarity && !run.items.includes(id) && !run.shop.items.includes(id));
  const fallback = Object.keys(ITEMS).filter(id => !run.items.includes(id) && !run.shop.items.includes(id));
  const list = pool.length ? pool : fallback;
  return list.length ? list[rngInt(run.rng, list.length)] : null;
}

export function restock(run) {
  const s = run.shop;
  s.items = [];
  s.consumables = [];
  s.bought = {};
  for (let i = 0; i < 3; i++) {
    const id = rollItem(run);
    if (id) s.items.push(id);
  }
  const cKeys = Object.keys(CONSUMABLES);
  for (let i = 0; i < 2; i++) {
    s.consumables.push(cKeys[rngInt(run.rng, cKeys.length)]);
  }
}

export function consumablePrice(run, id) {
  let p = CONSUMABLES[id].price;
  for (const own of run.items) {
    if (ITEMS[own] && ITEMS[own].priceDiscount) p -= ITEMS[own].priceDiscount;
  }
  return Math.max(1, p);
}

export function buyItem(run, id) {
  const price = itemPrice(run, id);
  if (run.money < price || run.items.length >= RULES.itemSlots) return false;
  if (!run.shop.items.includes(id) || run.shop.bought[id]) return false;
  run.money -= price;
  run.items.push(id);
  run.shop.bought[id] = true;
  return true;
}

export function buyConsumable(run, id) {
  const price = consumablePrice(run, id);
  if (run.money < price || run.consumables.length >= RULES.consumableSlots) return false;
  if (run.shop.bought['c_' + id]) return false;
  run.money -= price;
  run.consumables.push(id);
  run.shop.bought['c_' + id] = true;
  return true;
}

export function rerollCost(run) {
  return RULES.rerollCost + run.shop.rerolls;
}

export function reroll(run) {
  const cost = rerollCost(run);
  if (run.money < cost) return false;
  run.money -= cost;
  run.shop.rerolls++;
  restock(run);
  return true;
}

export function sellItem(run, idx) {
  const id = run.items[idx];
  if (!id) return 0;
  run.items.splice(idx, 1);
  return Math.floor(RARITY[ITEMS[id].rarity].price / 2);
}

export function sellConsumable(run, idx) {
  const id = run.consumables[idx];
  if (!id) return 0;
  run.consumables.splice(idx, 1);
  return Math.floor(CONSUMABLES[id].price / 2);
}

export function useConsumableCard(run, cIdx, cardUid) {
  const id = run.consumables[cIdx];
  const c = CONSUMABLES[id];
  if (!c || c.target !== 'card') return false;
  const card = run.deck.find(x => x.uid === cardUid);
  if (!card) return false;
  c.apply(card);
  run.consumables.splice(cIdx, 1);
  return true;
}

export function useConsumableHandType(run, cIdx, handKey) {
  const id = run.consumables[cIdx];
  const c = CONSUMABLES[id];
  if (!c || c.target !== 'handType') return false;
  c.apply(run, handKey);
  run.consumables.splice(cIdx, 1);
  return true;
}

// ---------- 牌组操作消耗品（离洞绳/重复球/珍贵球/精灵球） ----------
export const MIN_DECK = 20;

export function useConsumableDeckCard(run, cIdx, cardUid) {
  const id = run.consumables[cIdx];
  const c = CONSUMABLES[id];
  if (!c || c.target !== 'deckCard') return false;
  const card = run.deck.find(x => x.uid === cardUid);
  if (!card) return false;
  let result = null;
  if (c.deckOp === 'remove') {
    if (run.deck.length <= MIN_DECK) return { error: `牌组至少要保留 ${MIN_DECK} 张` };
    run.deck = run.deck.filter(x => x.uid !== cardUid);
    // 战斗中：清除牌堆/手牌中的引用
    if (run.fight) {
      run.fight.drawPile = run.fight.drawPile.filter(u => u !== cardUid);
      run.fight.hand = run.fight.hand.filter(u => u !== cardUid);
      run.fight.discardPile = run.fight.discardPile.filter(u => u !== cardUid);
    }
    result = { op: 'remove', card };
  } else if (c.deckOp === 'copy') {
    const copy = { ...card, uid: nextUid() };
    run.deck.push(copy);
    if (run.fight) run.fight.drawPile.push(copy.uid);
    result = { op: 'copy', card: copy };
  } else if (c.deckOp === 'shiny') {
    if (card.shiny) return { error: '这张卡已经是闪光了' };
    card.shiny = true;
    markShinySeen(card.dex); // 卡可能已在手牌中，不会再走抽牌入册路径
    result = { op: 'shiny', card };
  }
  run.consumables.splice(cIdx, 1);
  return result || { error: '未知操作' };
}

// 精灵球：随机捕获（5% 闪光）
export function useConsumableInstant(run, cIdx) {
  const id = run.consumables[cIdx];
  const c = CONSUMABLES[id];
  if (!c || c.target !== 'none' || c.deckOp !== 'capture') return false;
  const types = Object.keys(ROSTER);
  const type = types[rngInt(run.rng, types.length)];
  const roster = ROSTER[type];
  const idx = rngInt(run.rng, roster.length);
  const [dex, name] = roster[idx];
  const shiny = rngNext(run.rng) < 0.05;
  const card = { uid: nextUid(), dex, name, type, power: idx + 1, chipBonus: 0, multBonus: 0, shiny };
  run.deck.push(card);
  if (run.fight) run.fight.drawPile.push(card.uid);
  markCardSeen(card);
  run.consumables.splice(cIdx, 1);
  return { op: 'capture', card };
}

// ---------- 每周挑战与本地排行榜 ----------
export function weekKey(date = new Date()) {
  // ISO 周号
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function weeklySeed() {
  const key = weekKey();
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return { seed: h >>> 0, key };
}

// 每日挑战：本地日期号确定性种子（与周挑战各自独立轮换变体）
export function dayKey(date = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

export function dailySeed() {
  const key = dayKey();
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return { seed: h >>> 0, key };
}

// 挑战房：同挑战码 → 同房间榜
export function roomKeyFor(seed, variant) {
  let h = 2166136261;
  const s = `${seed}:${variant || 'standard'}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return 'ROOM-' + (h >>> 0).toString(36).toUpperCase();
}

// 当前对局的榜 key（周/日/房间三轨，互斥）
export function runBoardKey(run) {
  return run.weekly || run.daily || run.roomKey || null;
}

const BOARD_KEY = 'gymrun-weekly-board-v1';

export function weeklyScore(run) {
  return run.stats.fightsWon * 1000 + run.stats.maxHit + (run.phase === 'victory' ? 5000 : 0);
}

export function recordWeeklyResult(run) {
  if (!run.weekly) return null;
  const entry = {
    key: run.weekly,
    score: weeklyScore(run),
    result: run.phase === 'victory' ? '冠军' : '止步',
    fightsWon: run.stats.fightsWon,
    maxHit: run.stats.maxHit,
    date: new Date().toISOString().slice(0, 10),
  };
  try {
    const board = JSON.parse(localStorage.getItem(BOARD_KEY)) || [];
    board.push(entry);
    board.sort((a, b) => b.score - a.score);
    const trimmed = board.slice(0, 10);
    localStorage.setItem(BOARD_KEY, JSON.stringify(trimmed));
    return { entry, rank: trimmed.indexOf(entry) + 1, board: trimmed };
  } catch (e) {
    return { entry, rank: 0, board: [] };
  }
}

export function getWeeklyBoard() {
  try {
    return JSON.parse(localStorage.getItem(BOARD_KEY)) || [];
  } catch (e) { return []; }
}

// ---------- 挑战码（seed + 变体编码，分享给好友复现同一局） ----------
export function encodeChallenge({ seed, variant, label }) {
  const payload = { v: 1, s: seed >>> 0, va: variant || 'standard', n: (label || '').slice(0, 16) };
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  return 'GYM1.' + b64;
}

export function decodeChallenge(code) {
  try {
    const str = String(code || '').trim();
    if (!str.startsWith('GYM1.')) return null;
    const payload = JSON.parse(decodeURIComponent(escape(atob(str.slice(5)))));
    if (typeof payload.s !== 'number') return null;
    const variant = WEEKLY_VARIANTS.some(v => v.key === payload.va) ? payload.va : 'standard';
    return { seed: payload.s >>> 0, variant, label: String(payload.n || '') };
  } catch (e) {
    return null;
  }
}

export function buildReportJson(run) {
  return JSON.stringify({
    name: getSettings().name, seed: run.seed, mode: run.mode || '1p',
    weekly: run.weekly, variant: run.variant, stats: run.stats,
    players: run.players || undefined, history: run.history,
  }, null, 2);
}

// ---------- 双人热座 ----------
function snapshotPlayer(run) {
  return {
    items: [...run.items], itemBonus: { ...run.itemBonus }, consumables: [...run.consumables],
    money: run.money, handLevels: { ...run.handLevels }, handUses: { ...run.handUses },
    stats: { ...run.stats },
  };
}

function freshPlayer() {
  return {
    items: [], itemBonus: {}, consumables: [],
    money: RULES.startMoney, handLevels: {}, handUses: {},
    stats: { maxHit: 0, handsPlayed: 0, fightsWon: 0, moneyEarned: 0 },
  };
}

function loadPlayerSlot(run, idx) {
  const p = run.players[idx];
  run.items = [...p.items];
  run.itemBonus = { ...p.itemBonus };
  run.consumables = [...p.consumables];
  run.money = p.money;
  run.handLevels = { ...p.handLevels };
  run.handUses = { ...p.handUses };
  run.stats = { ...p.stats };
}

export function newRun2P(seed, forcedVariant = null) {
  const run = newRun(seed, null, forcedVariant);
  run.mode = '2p';
  run.activeIdx = 0;               // fightIdx % 2 出战
  run.winner = null;
  run.players = [snapshotPlayer(run), freshPlayer()];
  loadPlayerSlot(run, 0);
  return run;
}

// 出战交接：保存当前玩家状态，换下一位出战（在 leaveShop 里调用）
function swapPlayerForNextFight(run) {
  if (run.mode !== '2p') return;
  run.players[run.activeIdx] = snapshotPlayer(run);
  run.activeIdx = run.fightIdx % 2;
  loadPlayerSlot(run, run.activeIdx);
}
// ---------- 云端周榜（同源 /api/*，不可用时自动回退本地） ----------
const SETTINGS_KEY = 'gymrun-settings-v1';

export function getSettings() {
  try {
    return { sfx: 1, bgm: 0.25, bgmOn: false, name: '训练师', ...JSON.parse(localStorage.getItem(SETTINGS_KEY)) };
  } catch (e) { return { sfx: 1, bgm: 0.25, bgmOn: false, name: '训练师' }; }
}

export function saveSettings(patch) {
  const next = { ...getSettings(), ...patch };
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch (e) {}
  return next;
}

export function buildWeeklyEntry(run) {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    token: run.token,
    key: runBoardKey(run),
    name: getSettings().name,
    score: weeklyScore(run),
    result: run.phase === 'victory' ? '冠军' : '止步',
    fightsWon: run.stats.fightsWon,
    maxHit: run.stats.maxHit,
    date: new Date().toISOString().slice(0, 10),
    variant: run.variant || 'standard',
  };
}

export async function submitWeeklyScore(run) {
  if (run.submitted || !runBoardKey(run)) return null;
  run.submitted = true;
  const entry = buildWeeklyEntry(run);
  try {
    const res = await fetch('/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    if (!res.ok) throw new Error('bad status');
    const data = await res.json();
    return { entry, online: true, rank: data.rank || 0 };
  } catch (e) {
    run.submitted = false; // 失败允许重试
    return { entry, online: false };
  }
}

export async function fetchWeeklyBoard(key) {
  try {
    const res = await fetch('/api/board?key=' + encodeURIComponent(key));
    if (!res.ok) throw new Error('bad status');
    const data = await res.json();
    return Array.isArray(data.board) ? data.board : null;
  } catch (e) {
    return null;
  }
}

export function leaveShop(run) {
  run.phase = 'battle';
  run.shop = null;
  if (run.mode === '2p') swapPlayerForNextFight(run);
  startFight(run);
}

export function runOver(run) { return run.phase === 'defeat' || run.phase === 'victory'; }

export function defeat(run) {
  if (run.mode === '2p') {
    run.players[run.activeIdx] = snapshotPlayer(run);
    run.winner = 1 - run.activeIdx; // 输家出局，另一位获胜
  }
  run.phase = 'defeat';
}

// ---------- 存档 ----------
const SAVE_KEY = 'gymrun-save-v1';

export function save(run) {
  try {
    const { fight, ...rest } = run;
    const data = {
      ...rest,
      fightSaved: fight ? {
        hp: fight.hp, maxHp: fight.maxHp, hands: fight.hands, discards: fight.discards,
        plays: fight.plays, poison: fight.poison, sashUsed: fight.sashUsed,
        drawPile: fight.drawPile, hand: fight.hand, discardPile: fight.discardPile,
        sleepUid: fight.sleepUid, handSize: fight.handSize,
      } : null,
      uidCounter,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) { /* 存档失败不阻塞游戏 */ }
}

export function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.v !== 1) return null;
    uidCounter = data.uidCounter || 1000;
    const run = { ...data };
    delete run.fightSaved;
    delete run.uidCounter;
    if (run.phase === 'battle') {
      const info = fightInfo(run.fightIdx);
      const rule = info.isLeader ? { ...info.rule } : { kind: 'none' }; // 训练师战无馆主规则
      if (rule.kind === 'sealType') {
        // 封锁属性已固化在存档里无法恢复（rule.type），重新随机会不一致；
        // 简单起见：恢复时重新随机一次
        rule.type = rngPick(run.rng, Object.keys(TYPES));
      }
      run.fight = {
        info, rule,
        hp: data.fightSaved.hp, maxHp: data.fightSaved.maxHp,
        hands: data.fightSaved.hands, discards: data.fightSaved.discards,
        plays: data.fightSaved.plays,
        poison: data.fightSaved.poison || 0, sashUsed: !!data.fightSaved.sashUsed,
        drawPile: data.fightSaved.drawPile, hand: data.fightSaved.hand,
        discardPile: data.fightSaved.discardPile, sleepUid: data.fightSaved.sleepUid,
        handSize: data.fightSaved.handSize,
      };
    } else if (run.phase === 'shop') {
      openShop(run);
    }
    return run;
  } catch (e) {
    return null;
  }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
}

export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
}
