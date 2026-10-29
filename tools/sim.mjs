// 数值模拟：贪心机器人跑完整局，检查难度曲线是否可达
// 策略：枚举手牌全部 1~5 张组合，用克隆局面预演得分取最优打出；不弃牌（保守下界）；商店无脑买第一个买得起的道具
import {
  newRun, startFight, scoreHand, afterPlay, discardCards, fightWon, winFight, defeat,
  buyItem, rerollCost, reroll, restock, itemPrice, fightCount, fightInfo,
} from '../js/engine.js';

function subsets(arr) {
  const out = [];
  const rec = (start, cur) => {
    if (cur.length >= 1 && cur.length <= 5) out.push([...cur]);
    if (cur.length === 5 || start >= arr.length) return;
    for (let i = start; i < arr.length; i++) rec(i + 1, [...cur, arr[i]]);
  };
  rec(0, []);
  return out;
}

function bestPlay(run) {
  const hand = [...run.fight.hand];
  let best = null;
  for (const combo of subsets(hand)) {
    const clone = structuredClone(run);
    const { total } = scoreHand(clone, combo);
    if (!best || total > best.total) best = { uids: combo, total };
  }
  return best;
}

function botFight(run) {
  while (true) {
    // 挖牌策略：若当前最优手牌不够打（预期打不穿剩余血量），弃掉组合外的牌重新找
    let b = bestPlay(run);
    const need = Math.ceil(run.fight.hp / Math.max(1, run.fight.hands));
    if (b.total < need * 0.9 && run.fight.discards > 0 && run.fight.hand.length > 5) {
      const keep = new Set(b.uids);
      const toss = run.fight.hand.filter(u => !keep.has(u));
      // 保留牌多的属性（可能凑同花），弃掉其余
      toss.sort((a, c) => power(run, c) - power(run, a));
      discardCards(run, toss);
      const b2 = bestPlay(run);
      if (b2.total > b.total) b = b2;
    }
    scoreHand(run, b.uids);
    if (fightWon(run)) return true;
    if (run.fight.hands <= 0) return false;
    afterPlay(run);
  }
}

function power(run, uid) {
  return run.deck.find(c => c.uid === uid).power;
}

function botShop(run) {
  run.shop.items.forEach((id, idx) => {
    if (run.items.length >= 5) return;
    if (run.money >= itemPrice(run, id)) buyItem(run, idx);
  });
}

function simulate(seed) {
  const run = newRun(seed);
  while (true) {
    const won = botFight(run);
    if (!won) return { reached: run.fightIdx, phase: 'defeat' };
    const isChampion = run.fightIdx >= fightCount() - 1;
    if (isChampion) {
      winFight(run);
      return { reached: fightCount(), phase: run.phase };
    }
    winFight(run);
    botShop(run);
    run.phase = 'battle';
    startFight(run);
  }
}

const N = 40;
const reach = new Array(fightCount() + 1).fill(0);
let wins = 0;
for (let i = 0; i < N; i++) {
  const seed = (0xBADF00D ^ (i * 2654435761)) >>> 0;
  const r = simulate(seed);
  reach[Math.min(r.reached, fightCount())]++;
  if (r.phase === 'victory') wins++;
}

console.log('贪心机器人模拟（无弃牌、商店只买一件道具）—', N, '局\n');
console.log('战斗序号  对手              到达次数');
for (let i = 0; i < fightCount(); i++) {
  const arrived = reach.slice(i).reduce((a, b) => a + b, 0);
  const info = fightInfo(i);
  const bar = '█'.repeat(Math.round(arrived / N * 30));
  console.log(
    String(i).padStart(4), '   ',
    info.name.padEnd(12, '　'),
    `${String(arrived).padStart(3)}/${N} ${bar}`
  );
}
console.log(`\n通关率：${wins}/${N}（${Math.round(wins / N * 100)}%）`);
console.log('参考：贪心机器人 = 下界。真人（会弃牌检索、买消耗品升级手牌）应明显更强。');
