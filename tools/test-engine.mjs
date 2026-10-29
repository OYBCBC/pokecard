// 新引擎功能单元测试：node tools/test-engine.mjs
// 牌组操作消耗品 / 闪光 / 图鉴 / 每周挑战 / 排行榜 / 存档
const store = new Map();
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
};

const {
  newRun, newRun2P, leaveShop, winFight, fightWon, scoreHand,
  useConsumableInstant, useConsumableDeckCard, useConsumableCard, sellConsumable, buyConsumable, buyItem, openShop,
  MIN_DECK,
  markDexSeen, markCardSeen, loadDex, loadDexShiny, dexSeenCount, dexShinyCount,
  weeklySeed, dailySeed, roomKeyFor, runBoardKey, weekKey, weeklyVariant, previewReward, recordWeeklyResult, getWeeklyBoard, weeklyScore,
  buildWeeklyEntry, getSettings, saveSettings, save, load,
  encodeChallenge, decodeChallenge, buildReportJson,
} = await import('../js/engine.js');
const { cardChips, WEEKLY_VARIANTS, weeklyVariant: variantOf, targetHp, GYMS } = await import('../js/data.js');

let pass = 0, fail = 0;
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name} ${extra}`); }
}

console.log('引擎扩展功能测试：');

// ---- 牌组操作消耗品 ----
const run = newRun(12345);
check('初始牌组 80 张', run.deck.length === 80);

run.consumables.push('pokeBall');
const cap = useConsumableInstant(run, 0);
check('精灵球捕获：牌组 +1', run.deck.length === 81 && cap.op === 'capture');
check('捕获的卡字段完整', cap.card.power >= 1 && cap.card.power <= 10 && typeof cap.card.dex === 'number');
check('捕获后消耗品已消耗', run.consumables.length === 0);
check('捕获写入图鉴', !!loadDex()[cap.card.dex]);

// 重复球复制
run.consumables.push('repeatBall');
const target = run.deck.find(c => c.chipBonus === 0);
target.chipBonus = 66;
const copied = useConsumableDeckCard(run, 0, target.uid);
check('重复球复制：牌组 +1', run.deck.length === 82 && copied.op === 'copy');
check('复制保留强化且 uid 不同', copied.card.chipBonus === 66 && copied.card.uid !== target.uid);

// 珍贵球闪光
run.consumables.push('cherishBall');
const plain = run.deck.find(c => !c.shiny);
const before = cardChips(plain);
const shined = useConsumableDeckCard(run, 0, plain.uid);
check('珍贵球：卡变闪光', shined.op === 'shiny' && plain.shiny === true);
check('闪光攻击 +80', cardChips(plain) === before + 80);
run.consumables.push('cherishBall');
check('已闪光的卡不可再闪', useConsumableDeckCard(run, 0, plain.uid).error !== undefined);
run.consumables = [];

// 离洞绳 + 下限保护
run.consumables.push('escapeRope');
const removed = useConsumableDeckCard(run, 0, run.deck[0].uid);
check('离洞绳：牌组 -1', removed.op === 'remove' && run.deck.length === 81);
const small = newRun(999);
while (small.deck.length > MIN_DECK) small.deck.pop();
small.consumables.push('escapeRope');
check(`牌组低于 ${MIN_DECK} 张时禁止放生`, useConsumableDeckCard(small, 0, small.deck[0].uid).error !== undefined);

// ---- 商店内消耗品管理：出售 / 非战斗中使用 ----
const shopRun = newRun(4242);
shopRun.money = 30;
shopRun.consumables = ['cherishBall', 'protein'];
const refund = sellConsumable(shopRun, 0); // cherishBall 原价 8
check('出售消耗品：退款为原价一半', refund === 4);
check('出售后槽位释放', shopRun.consumables.length === 1 && shopRun.consumables[0] === 'protein');
check('出售越界索引返回 0', sellConsumable(shopRun, 5) === 0);
// 蛋白质在非战斗阶段直接对牌组卡生效（商店内使用路径）
const boostTarget = shopRun.deck[0];
const beforeChips = boostTarget.chipBonus;
check('商店内蛋白质可直接强化牌组卡', useConsumableCard(shopRun, 0, boostTarget.uid) === true && boostTarget.chipBonus === beforeChips + 60);
check('强化后消耗品已消耗', shopRun.consumables.length === 0);
// 背包满时不可购买
openShop(shopRun);
shopRun.consumables = ['pokeBall', 'zinc'];
check('背包满时购买消耗品失败', buyConsumable(shopRun, 0) === false);
sellConsumable(shopRun, 0);
check('腾出槽位后可购买', buyConsumable(shopRun, 0) === true);
// ---- 货架重复商品（回归：两格相同消耗品，买一格曾把另一格也标成已购）----
const dupRun = newRun(6);
openShop(dupRun);
dupRun.money = 50;
dupRun.shop.consumables = ['protein', 'protein'];
dupRun.shop.bought = {};
check('重复消耗品：第一格可买', buyConsumable(dupRun, 0) === true && dupRun.consumables.length === 1);
check('重复消耗品：第二格仍可买', buyConsumable(dupRun, 1) === true && dupRun.consumables.length === 2);
check('重复消耗品：买后记账按格子互不影响', dupRun.shop.bought['c0'] === true && dupRun.shop.bought['c1'] === true);
dupRun.consumables = [];
dupRun.shop.items = ['charcoal', 'charcoal'];
check('重复道具：两格各自可买', buyItem(dupRun, 0) === true && buyItem(dupRun, 1) === true && dupRun.items.length === 2);
check('已购格子不可重复购买', buyItem(dupRun, 0) === false);
check('越界格子购买返回失败', buyItem(dupRun, 9) === false && buyConsumable(dupRun, 9) === false);

// ---- 图鉴 ----
markDexSeen(25);
markDexSeen(25);
check('图鉴计数累积', loadDex()[25] === 2 && dexSeenCount() >= 1);

// ---- 每周挑战 ----
const ws1 = weeklySeed();
const ws2 = weeklySeed();
check('每周种子确定性', ws1.seed === ws2.seed && /^\d{4}-W\d{2}$/.test(ws1.key));
check('本周标签非空', ws1.key === weekKey());

const wk = newRun(ws1.seed, ws1.key);
wk.stats.fightsWon = 5; wk.stats.maxHit = 1200;
const rec = recordWeeklyResult(wk);
check('周榜记录返回名次', rec.rank === 1 && rec.entry.score === weeklyScore(wk));
wk.stats.fightsWon = 9; wk.stats.maxHit = 3000; wk.phase = 'victory';
recordWeeklyResult(wk);
check('周榜排序（冠军分更高居首）', getWeeklyBoard()[0].fightsWon === 9);
check('周榜最多 10 条', (() => { for (let i = 0; i < 15; i++) { const r = newRun(i, ws1.key); r.stats.maxHit = i; recordWeeklyResult(r); } return getWeeklyBoard().length === 10; })());
check('普通局不进周榜', recordWeeklyResult(newRun(1)) === null);

// ---- 存档：闪光与周标记序列化 ----
wk.deck[0].shiny = true;
save(wk);
const loaded = load();
check('存档恢复周标记与闪光', loaded.weekly === ws1.key && loaded.deck.some(c => c.shiny));

// ---- 战斗内使用牌组道具不打断抽牌 ----
const run2 = newRun(777);
run2.consumables.push('pokeBall');
useConsumableInstant(run2, 0);
const added = run2.deck[run2.deck.length - 1];
check('战斗中捕获的新卡可被抽到', run2.fight.drawPile.includes(added.uid));

// ---- 图鉴闪光单独标记 ----
markCardSeen({ dex: 6, shiny: true });
markCardSeen({ dex: 9, shiny: false });
check('闪光遇见单独点亮', !!loadDexShiny()[6] && !loadDexShiny()[9]);
check('闪光计数正确（≥1，含珍贵球点亮）', dexShinyCount() >= 1);

// ---- 每周变体规则 ----
check('变体确定性且合法', WEEKLY_VARIANTS.some(v => v.key === variantOf('2099-W05').key) && variantOf('2099-W05').key === variantOf('2099-W05').key);
const elite = newRun(5, '2099-W05', 'elite');
check('精英周：血量 ×1.25', elite.fight.hp === Math.round(targetHp(0) * 1.25) && elite.fight.maxHp === elite.fight.hp);
const speed = newRun(5, '2099-W05', 'speed');
check('疾风周：手数 3', speed.fight.hands === 3);
const poverty = newRun(5, '2099-W05', 'poverty');
const pr = previewReward(poverty);
check('拮据周：奖励与利息减半', pr.base === Math.floor(7 / 2) && pr.interest === Math.floor(Math.min(6, Math.floor(6 / 5)) / 2));
const draft = newRun(5, '2099-W05', 'draft');
const typeCounts = {};
draft.deck.forEach(c => { typeCounts[c.type] = (typeCounts[c.type] || 0) + 1; });
check('精简周：牌组 60 张', draft.deck.length === 60);
check('精简周：每属性至少 5 张', Object.values(typeCounts).every(n => n >= 5));
const duo = newRun(5, '2099-W05', 'duo');
const duoTypes = new Set(duo.deck.map(c => c.type));
check('双属性周：牌组 20 张且恰含两种属性', duo.deck.length === 20 && duoTypes.size === 2 && Array.isArray(duo.duoTypes));
const sudden = newRun(5, '2099-W05', 'sudden');
check('决斗周：2 手牌且血量 ×0.6', sudden.fight.hands === 2 && sudden.fight.hp === Math.round(targetHp(0) * 0.6));
check('普通局无变体', newRun(5).variant === null);

// ---- 防刷令牌 ----
check('每局有防刷令牌且未提交', typeof elite.token === 'string' && elite.token.length >= 8 && elite.submitted === false);
check('云端条目携带令牌', typeof buildWeeklyEntry(elite).token === 'string' && buildWeeklyEntry(elite).token.length >= 8);

// ---- 天气系统 ----
const wr = newRun(42);
wr.items.push('heatRock');
const fireCard = wr.deck.find(c => c.type === 'fire');
wr.fight.hand = [fireCard.uid];
const wres = scoreHand(wr, [fireCard.uid]);
check('大晴天：火卡攻击 ×1.5', wres.total === Math.round((5 + Math.round(cardChips(fireCard) * 1.5)) * 1));
const wr2 = newRun(42);
wr2.items.push('heatRock');
const waterCard = wr2.deck.find(c => c.type === 'water');
wr2.fight.hand = [waterCard.uid];
const wres2 = scoreHand(wr2, [waterCard.uid]);
check('大晴天：水卡被弱化 ×0.75', wres2.total === Math.round((5 + Math.round(cardChips(waterCard) * 0.75)) * 1));

// ---- 娜姿·意念封锁（回归：sealType 规则缺 factor 曾把伤害打成 NaN，hp 变 NaN 永远无法获胜）----
const sabrina = GYMS.find(g => g.leader === '娜姿');
check('娜姿规则带 factor 0.5（攻击减半）', sabrina.rule.kind === 'sealType' && sabrina.rule.factor === 0.5);
const sealRun = newRun(2026);
const sealCard = sealRun.deck.find(c => c.type === 'fire');
sealRun.fight.rule = { kind: 'sealType', type: 'fire' }; // 模拟缺 factor 的旧数据/旧存档
sealRun.fight.hand = [sealCard.uid];
const sealRes = scoreHand(sealRun, [sealCard.uid]);
check('封锁属性卡伤害为有限数（不再 NaN）', Number.isFinite(sealRes.total) && sealRes.total >= 1);
check('封锁属性卡攻击正好减半', sealRes.total === Math.round((5 + Math.floor(cardChips(sealCard) * 0.5)) * 1));
check('封锁结算后 hp 正常下降', Number.isFinite(sealRun.fight.hp) && sealRun.fight.hp === sealRun.fight.maxHp - sealRes.total);
// NaN 存档自愈
const broken = newRun(3);
broken.fight.hp = NaN;
save(broken);
const healed = load();
check('血量损坏的存档加载时自动重开本场', Number.isFinite(healed.fight.hp) && healed.fight.hp > 0 && healed.fight.maxHp === healed.fight.hp);


// ---- 剧毒宝珠 ----
const tr = newRun(43);
tr.items.push('toxicOrb');
const pc1 = tr.deck.find(c => c.type === 'poison');
tr.fight.hand = [pc1.uid];
tr.fight.hp = 999999; tr.fight.maxHp = 999999;
const tres1 = scoreHand(tr, [pc1.uid]);
check('剧毒第一手：叠 1 层并造成 20 毒伤', tr.fight.poison === 1 && tres1.events.some(e => e.type === 'poisonDmg' && e.damage === 20));
const pc2 = tr.deck.find(c => c.type === 'poison' && c.uid !== pc1.uid);
tr.fight.hand = [pc2.uid];
const tres2 = scoreHand(tr, [pc2.uid]);
check('剧毒第二手：叠 2 层并造成 40 毒伤', tr.fight.poison === 2 && tres2.events.some(e => e.type === 'poisonDmg' && e.damage === 40));
check('无剧毒宝珠不叠层', (() => { const c2 = newRun(431); const p = c2.deck.find(c => c.type === 'poison'); c2.fight.hand = [p.uid]; scoreHand(c2, [p.uid]); return c2.fight.poison === 0; })());

// ---- 气势披带 ----
const sr = newRun(44);
sr.items.push('focusSash');
const sc = sr.deck[0];
sr.fight.hand = [sc.uid];
sr.fight.hands = 1; sr.fight.hp = 999999; sr.fight.maxHp = 999999;
scoreHand(sr, [sc.uid]);
check('披带：手数用尽时追加一手', sr.fight.hands === 1 && sr.fight.sashUsed === true);
const sc2 = sr.deck[1];
sr.fight.hand = [sc2.uid];
scoreHand(sr, [sc2.uid]);
check('披带每场只触发一次', sr.fight.hands === 0);

// ---- 战报 ----
check('战报记录每手牌', wr.history.length === 1 && wr.history[0].hand === wres.ev.key && wr.history[0].cards.length === 1);

// ---- 挑战码 ----
globalThis.btoa = s => Buffer.from(s, 'binary').toString('base64');
globalThis.atob = s => Buffer.from(s, 'base64').toString('binary');
const code = encodeChallenge({ seed: 123456, variant: 'elite', label: '小智' });
const parsed = decodeChallenge(code);
check('挑战码往返', code.startsWith('GYM1.') && parsed.seed === 123456 && parsed.variant === 'elite' && parsed.label === '小智');
check('挑战码非法输入返回 null', decodeChallenge('garbage') === null && decodeChallenge('GYM1.!!!') === null && decodeChallenge('') === null);
check('挑战码非法变体回退标准', decodeChallenge(encodeChallenge({ seed: 1, variant: 'hacker' })).variant === 'standard');
check('战报 JSON 含关键字段', (() => { const j = JSON.parse(buildReportJson(wr)); return j.seed === wr.seed && Array.isArray(j.history) && j.history.length === wr.history.length; })());

// ---- 双人热座 ----
const r2p = newRun2P(777);
check('2P 初始化', r2p.mode === '2p' && r2p.activeIdx === 0 && r2p.players.length === 2 && r2p.winner === null);
check('2P 初始 P2 状态为空', r2p.players[1].items.length === 0 && r2p.players[1].money === 6);
// P1 打赢第 0 场 → 商店 → 出发后应轮到 P2
r2p.fight.hp = 1;
scoreHand(r2p, [r2p.fight.hand[0]]);
winFight(r2p);
check('2P 胜利后同步 P1 槽位', r2p.players[0].stats.fightsWon === 1);
leaveShop(r2p);
check('2P 轮换：第 1 场由 P2 出战', r2p.activeIdx === 1 && r2p.items.length === 0);
// P2 买入道具不影响 P1
r2p.items.push('charcoal');
leaveShop; // noop 引用，避免未使用警告
r2p.fight.hp = 1;
scoreHand(r2p, [r2p.fight.hand[0]]);
winFight(r2p);
check('2P P2 道具隔离', r2p.players[1].items.includes('charcoal') && r2p.players[0].items.length === 0);
// P2 输掉第 2 场 → P1 获胜
r2p.fight.hands = 1; r2p.fight.hp = 999999; r2p.fight.maxHp = 999999;
scoreHand(r2p, [r2p.fight.hand[0]]);
const eng = await import('../js/engine.js');
eng.defeat(r2p);
check('2P 败者出局判胜', r2p.phase === 'defeat' && r2p.winner === 0);
// ---- 每日挑战 / 挑战房 ----
check('每日种子确定性', dailySeed().seed === dailySeed().seed && /^\d{4}-\d{2}-\d{2}$/.test(dailySeed().key));
check('日/周种子互不相同', dailySeed().seed !== weeklySeed().seed);
check('房间 key 稳定且同码同房', roomKeyFor(999, 'elite') === roomKeyFor(999, 'elite') && roomKeyFor(999, 'elite') !== roomKeyFor(998, 'elite') && roomKeyFor(1, 'standard').startsWith('ROOM-'));
const dailyRun = newRun(dailySeed().seed, null, 'elite');
dailyRun.daily = dailySeed().key;
check('每日局榜单 key 解析', buildWeeklyEntry(dailyRun).key === dailySeed().key);
const roomRun = newRun(777, null, 'duo');
roomRun.roomKey = roomKeyFor(777, 'duo');
check('房间局榜单 key 解析', buildWeeklyEntry(roomRun).key === roomRun.roomKey);
check('普通局不产生榜单 key', runBoardKey(newRun(5)) === null);
// 2P 存档往返
save(r2p);
const r2pLoaded = load();
check('2P 存档恢复', r2pLoaded.mode === '2p' && r2pLoaded.players.length === 2 && r2pLoaded.activeIdx === 1);

// ---- 云端条目与设置 ----
saveSettings({ name: '小智', sfx: 0.5 });
check('设置读写', getSettings().name === '小智' && getSettings().sfx === 0.5);
const wkEntry = buildWeeklyEntry(elite);
check('云端条目字段完整', wkEntry.id.length >= 8 && wkEntry.name === '小智' && wkEntry.variant === 'elite' && typeof wkEntry.score === 'number');

console.log(`\n结果：${pass} 通过，${fail} 失败`);
process.exit(fail ? 1 : 0);
