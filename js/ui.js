// ============================================
// UI 层：界面渲染 / 交互 / 计分动画
// ============================================
import {
  TYPES, HANDS, ITEMS, RARITY, CONSUMABLES, GYMS, ROSTER, RULES, WEEKLY_VARIANTS, weeklyVariant,
  handBase, cardChips,
} from './data.js';
import {
  fightCount, fightInfo, MIN_DECK, evaluate,
  newRun, newRun2P, startFight, scoreHand, discardCards, afterPlay,
  fightWon, winFight, previewReward, defeat, openShop, restock, reroll, rerollCost,
  itemPrice, consumablePrice, buyItem, buyConsumable, sellItem, sellConsumable,
  useConsumableCard, useConsumableHandType, useConsumableDeckCard, useConsumableInstant,
  leaveShop, loadDex, loadDexShiny, dexSeenCount, dexShinyCount,
  weeklySeed, dailySeed, roomKeyFor, runBoardKey, weeklyScore,
  recordWeeklyResult, getWeeklyBoard,
  submitWeeklyScore, fetchWeeklyBoard, getSettings, saveSettings,
  encodeChallenge, decodeChallenge, buildReportJson,
  save, load, clearSave, hasSave,
} from './engine.js';
import { sfx } from './sfx.js';

const app = document.getElementById('app');

let run = null;
let selected = new Set();      // 选中的手牌 uid
let targeting = null;          // { cIdx } 正在使用消耗品选手牌
let deckTargeting = null;      // { cIdx } 正在使用消耗品选牌组卡
let busy = false;              // 计分动画中锁定输入
let rewardPending = false;     // 战斗胜利待领取
let fightIntroShown = -1;      // 已展示开场动画的 fightIdx
let handPickFor = null;        // { cIdx } 正在选择手牌类型（升级数据）
let lastHandKey = null;
let lastWeeklyRank = null;     // 周挑战结算结果

const sleep = ms => new Promise(r => setTimeout(r, ms));
const $ = sel => document.querySelector(sel);
const fmt = n => Math.round(n).toLocaleString('zh-Hans-CN');

export function init() {
  // 应用保存的音量设置
  const st = getSettings();
  sfx.setVolumes({ sfx: st.sfx, bgm: st.bgm });
  app.addEventListener('click', onClick);
  app.addEventListener('mouseover', onHover);
  app.addEventListener('input', onInput);
  render();
}

// ---------------- 总渲染 ----------------
function render() {
  if (!run) { sfx.setBgmScene('title'); renderTitle(); return; }
  if (run.phase === 'battle') { sfx.setBgmScene('battle'); renderBattle(); }
  else if (run.phase === 'shop') { sfx.setBgmScene('shop'); renderShop(); }
  else { sfx.setBgmScene('end'); renderEnd(); }
}

function topbar() {
  const beaten = run ? Math.min(GYMS.length, Math.floor(run.fightIdx / 2)) : 0;
  const badges = GYMS.map((g, i) =>
    `<span class="badge ${i < beaten ? 'earned' : ''}" title="${g.leader}·${g.badge}">${i + 1}</span>`).join('');
  const champ = `<span class="badge champ ${run.phase === 'victory' ? 'earned' : ''}" title="冠军">★</span>`;
  return `
  <header class="topbar">
    <div class="badges">${badges}${champ}</div>
    <div class="top-right">
      ${run.mode === '2p' ? `<span class="player-badge p${run.activeIdx + 1}">P${run.activeIdx + 1} 出战</span>` : ''}
      <span class="money">$ ${run.money}</span>
      ${run.variant ? `<span class="variant-tag" data-tip="${(WEEKLY_VARIANTS.find(v => v.key === run.variant) || {}).desc || ''}">${(WEEKLY_VARIANTS.find(v => v.key === run.variant) || { name: run.variant }).name}</span>` : ''}
      <button class="mini-btn mobile-only" data-action="handTypes">手型</button>
      <button class="mini-btn" data-action="dex">图鉴 ${dexSeenCount()}/80${dexShinyCount() ? '✨' + dexShinyCount() : ''}</button>
      <button class="mini-btn" data-action="deck">牌组</button>
      <button class="mini-btn" data-action="settings">⚙</button>
    </div>
  </header>`;
}

// ---------------- 标题界面 ----------------
function renderTitle() {
  app.innerHTML = `
  <div class="screen title-screen">
    <div class="title-logo">
      <div class="title-sub">非官方粉丝游戏 · Fan Game</div>
      <h1>宝可梦 · 徽章之路</h1>
      <div class="title-tag">POKÉMON BADGE RUN — 卡牌构筑肉鸽</div>
    </div>
    <div class="title-menu">
      <button class="big-btn red" data-action="start">开始新的挑战</button>
      <button class="big-btn gold" data-action="startDaily" data-tip="${weeklyVariant(dailySeed().key).desc}">今日挑战 · ${dailySeed().key.slice(5).replace('-', '/')} · ${weeklyVariant(dailySeed().key).name}</button>
      <button class="big-btn gold" data-action="startWeekly" data-tip="${weeklyVariant(weeklySeed().key).desc}">本周挑战 · ${weekKeyLabel()} · ${weeklyVariant(weeklySeed().key).name}</button>
      <button class="big-btn blue" data-action="start2P">双人热座挑战</button>
      <button class="big-btn blue" data-action="customChallenge">自定义挑战房</button>
      <div class="seed-row">
        挑战码：<input id="codeInput" placeholder="粘贴 GYM1.xxxx" style="width:200px">
        <button class="mini-btn" data-action="joinCode">进入</button>
      </div>
      <div class="board-btns">
        <button class="mini-btn wide" data-action="dailyBoard">今日榜</button>
        <button class="mini-btn wide" data-action="weeklyBoard">本周榜</button>
      </div>
      ${hasSave() ? '<button class="big-btn blue" data-action="continue">继续上次挑战</button>' : ''}
      <div class="seed-row">种子：<input id="seedInput" placeholder="留空随机" maxlength="10"></div>
    </div>
    <div class="title-pokemon">
      <img src="assets/sprites/25.png"><img src="assets/sprites/6.png"><img src="assets/sprites/9.png"><img src="assets/sprites/3.png"><img src="assets/sprites/150.png">
    </div>
    <footer class="disclaimer">
      本作为非官方、非营利的粉丝作品，与任天堂 / Game Freak / The Pokémon Company 无关。<br>
      Pokémon © Nintendo · Creatures · Game Freak。素材来自 PokéAPI 社区图库，仅供学习交流，严禁商用。
    </footer>
  </div>`;
}

// ---------------- 战斗界面 ----------------
function cardHtml(card, { mini = false, inHand = false } = {}) {
  const t = TYPES[card.type];
  const asleep = inHand && run.fight && card.uid === run.fight.sleepUid;
  const sel = inHand && selected.has(card.uid);
  const bonuses = [];
  if (card.chipBonus) bonuses.push(`<span class="bonus-chip">+${card.chipBonus}</span>`);
  if (card.multBonus) bonuses.push(`<span class="bonus-mult">+${card.multBonus}</span>`);
  if (card.shiny) bonuses.push('<span class="bonus-shiny">✨</span>');
  return `
  <div class="card type-${card.type} ${sel ? 'selected' : ''} ${asleep ? 'asleep' : ''} ${mini ? 'mini' : ''} ${card.shiny ? 'shiny' : ''}"
       ${inHand ? `data-action="select" data-uid="${card.uid}"` : ''}
       ${mini ? `data-action="deckCardPick" data-uid="${card.uid}"` : ''}
       style="--tc:${t.color}"
       data-tip="${card.shiny ? '✨闪光 ' : ''}${card.name} · ${t.name}属性 · 力量${card.power}<br>基础攻击 ${cardChips(card)}${card.multBonus ? ' · 倍率+' + card.multBonus : ''}">
    <div class="card-type">${t.name}</div>
    <img src="assets/${card.shiny ? 'sprites-shiny' : 'sprites'}/${card.dex}.png" alt="${card.name}" draggable="false">
    ${asleep ? '<div class="sleep-mark">💤</div>' : ''}
    <div class="card-name">${card.name}</div>
    <div class="card-chips">${cardChips(card)}</div>
    <div class="card-power">${card.power}</div>
    <div class="card-check">✓</div>
    ${bonuses.length ? `<div class="card-bonus">${bonuses.join('')}</div>` : ''}
  </div>`;
}

// 选牌实时预览：当前选中将打出的手牌类型与预估伤害；同时联动"取消选择"按钮
function updateHandPreview() {
  const el = $('#handPreview');
  if (!el || !run || !run.fight) return;
  const clearBtn = $('#clearSelBtn');
  const cards = [...selected].map(uid => run.deck.find(c => c.uid === uid)).filter(Boolean);
  if (clearBtn) {
    clearBtn.hidden = cards.length === 0;
    clearBtn.innerHTML = `取消选择 <small>${cards.length} 张</small>`;
  }
  if (!cards.length) {
    el.innerHTML = '<span class="dim">点击卡牌选中（1~5 张），打出前这里会预估手牌与伤害</span>';
    return;
  }
  const ev = evaluate(cards);
  const lv = run.handLevels[ev.key] || 1;
  const b = handBase(ev.key, lv);
  const cardChipsSum = ev.cards.reduce((s, c) => s + cardChips(c), 0);
  const chips = b.chips + cardChipsSum;
  el.innerHTML = `将打出<b>${HANDS[ev.key].name}</b>Lv${lv} · ${b.chips}+${cardChipsSum} × ${b.mult}` +
    `<span class="hp-dmg">≈${fmt(chips * b.mult)}</span><span class="dim">（${selected.size}/5）</span>`;
}

function handPanelHtml() {
  const keys = Object.keys(HANDS);
  return keys.map(k => {
    const lv = run.handLevels[k] || 1;
    const b = handBase(k, lv);
    const uses = run.handUses[k] || 0;
    return `<div class="hand-row ${lastHandKey === k ? 'just-played' : ''}" data-tip="等级 ${lv}：${b.chips} × ${b.mult}">
      <span class="hand-name">${HANDS[k].name}</span>
      <span class="hand-lv">Lv${lv}</span>
      <span class="hand-base">${b.chips}×${b.mult}</span>
      <span class="hand-uses">${uses ? '·' + uses : ''}</span>
    </div>`;
  }).join('');
}

function itemsPanelHtml(editable) {
  const slots = [];
  for (let i = 0; i < RULES.itemSlots; i++) {
    const id = run.items[i];
    if (id) {
      const d = ITEMS[id];
      const r = RARITY[d.rarity];
      const growth = run.itemBonus && run.itemBonus[id] ? `<br>当前累计加成 +${run.itemBonus[id]}` : '';
      slots.push(`
      <div class="item-slot rarity-${d.rarity}" data-action="itemInfo" data-idx="${i}"
           data-tip="${d.name}（${r.name}）<br>${d.desc}${growth}<br><i>点击查看详情 / 出售</i>"
           style="--rc:${r.color}">
        <img src="assets/items/${d.slug}.png" alt="${d.name}">
      </div>`);
    } else {
      slots.push('<div class="item-slot empty"></div>');
    }
  }
  const cslots = [];
  for (let i = 0; i < RULES.consumableSlots; i++) {
    const id = run.consumables[i];
    if (id) {
      const d = CONSUMABLES[id];
      const where = d.target === 'card' ? '战斗中点击后选手牌使用'
        : d.target === 'handType' ? '点击后选手牌类型使用'
        : d.target === 'deckCard' ? '点击后从牌组选一张卡使用' : '点击立即生效';
      cslots.push(`
      <div class="item-slot consumable ${targeting && targeting.cIdx === i ? 'targeting' : ''}"
           data-action="useConsumable" data-idx="${i}"
           data-tip="${d.name}<br>${d.desc}<br>（${where}）">
        <img src="assets/items/${d.slug}.png" alt="${d.name}">
      </div>`);
    } else {
      cslots.push('<div class="item-slot empty consumable"></div>');
    }
  }
  return `
  <aside class="items-panel">
    <div class="panel-title">携带物</div>
    <div class="item-grid">${slots.join('')}</div>
    <div class="panel-title">背包</div>
    <div class="item-grid">${cslots.join('')}</div>
  </aside>`;
}

function renderBattle() {
  const f = run.fight;
  const info = f.info;
  // 整页 innerHTML 重建会把手牌横向滚动与页面滚动重置，先记住再还原（手机端体验关键）
  const prevHandArea = $('#handArea');
  const prevHandScroll = prevHandArea ? prevHandArea.scrollLeft : null;
  const prevPageScroll = window.scrollY;
  const handCards = f.hand.map(uid => run.deck.find(c => c.uid === uid));
  const hpPct = Math.max(0, f.hp / f.maxHp * 100);
  const ruleText = !info.isLeader ? '常规战斗，无特殊规则'
    : f.rule.kind === 'sealType'
      ? `${info.ruleDesc}（当前封锁：${TYPES[f.rule.type].name}属性）` : info.ruleDesc;
  const nextIsChampion = run.fightIdx >= GYMS.length * 2;
  const stage = nextIsChampion ? '冠军战' : `道馆 ${Math.floor(run.fightIdx / 2) + 1}/8 · ${run.fightIdx % 2 === 0 ? '训练师战' : '馆主战'}`;
  const weatherId = [...run.items].reverse().find(id => ITEMS[id] && ITEMS[id].weather);
  const weather = weatherId ? ITEMS[weatherId].weather : null;

  app.innerHTML = `
  <div class="screen battle" style="--gym:${info.color || '#4a5a86'}">
    ${topbar()}
    <div class="battle-main">
      <aside class="hand-panel">${handPanelHtml()}</aside>
      <section class="arena">
        <div class="stage-label">${stage}${weather ? ` <span class="weather-pill" data-tip="${ITEMS[weatherId].name}：${ITEMS[weatherId].desc.replace(/天气【.*?】：/, '')}">${weather.name}</span>` : ''}</div>
        <div class="opponent" id="opponent">
          <div class="opp-portrait"><img src="assets/sprites/${info.aceId}.png"></div>
          <div class="opp-info">
            <div class="opp-name">${info.name}</div>
            <div class="opp-ace">王牌：${info.aceName}</div>
            ${f.poison > 0 ? `<div class="poison-badge">☠ 中毒 ×${f.poison}（每手结算 -${f.poison * 20}）</div>` : ''}
            <div class="opp-rule ${f.rule.kind === 'none' ? 'dim' : ''}">${ruleText}</div>
          </div>
          <div class="opp-hp">
            <div class="hp-bar"><div class="hp-fill" style="width:${hpPct}%"></div><span class="hp-text">${fmt(f.hp)} / ${fmt(f.maxHp)}</span></div>
          </div>
        </div>
        <div class="score-strip">
          <div class="score-box chips"><span class="score-label">攻击</span><b id="chipsVal">0</b></div>
          <div class="score-x">×</div>
          <div class="score-box mult"><span class="score-label">倍率</span><b id="multVal">0</b></div>
          <div class="played-row" id="playedRow"></div>
        </div>
        ${targeting ? `<div class="targeting-banner">选择一张手牌使用【${CONSUMABLES[run.consumables[targeting.cIdx]]?.name || ''}】<button class="mini-btn" data-action="cancelTargeting">取消</button></div>` : ''}
        <div class="hand-area ${targeting ? 'selecting' : ''}" id="handArea">
          ${handCards.map(c => cardHtml(c, { inHand: true })).join('')}
        </div>
        <div class="hand-preview" id="handPreview"></div>
        <div class="actions">
          <button class="big-btn red sm" data-action="play" id="playBtn">打出 <small>剩余 ${f.hands} 手</small></button>
          <button class="big-btn blue sm" data-action="discard" id="discardBtn" ${f.discards <= 0 ? 'disabled' : ''}>弃牌 <small>剩 ${f.discards} 次</small></button>
          <button class="big-btn ghost sm" data-action="clearSelection" id="clearSelBtn" hidden>取消选择</button>
        </div>
      </section>
      ${itemsPanelHtml(true)}
    </div>
  </div>`;
  updateHandPreview();
  if (prevHandScroll != null) {
    const ha = $('#handArea');
    if (ha) ha.scrollLeft = prevHandScroll;
  }
  if (prevPageScroll) window.scrollTo(0, prevPageScroll);

  if (fightIntroShown !== run.fightIdx) {
    fightIntroShown = run.fightIdx;
    const hasDialogue = (info.kind === 'leader' || info.kind === 'champion') && info.dialogue;
    if (hasDialogue) showDialogue(info, ruleText);
    else showIntro(info, ruleText);
  }
  // 道馆音色：不同道馆计分音调不同
  sfx.setGymKey(nextIsChampion ? 8 : Math.floor(run.fightIdx / 2));
}

function showIntro(info, ruleText) {
  const el = document.createElement('div');
  el.className = 'intro-overlay';
  el.innerHTML = `
    <div class="intro-card">
      <img src="assets/sprites/${info.aceId}.png">
      <h2>${info.name}</h2>
      <p>${ruleText}</p>
    </div>`;
  app.appendChild(el);
  sfx.badge();
  setTimeout(() => el.remove(), 1700);
}

// 道馆主/冠军战前剧情对话（点击逐条推进）
function showDialogue(info, ruleText) {
  const lines = info.dialogue;
  let idx = 0;
  const el = document.createElement('div');
  el.className = 'dialogue-overlay';
  el.innerHTML = `
    <div class="dialogue-box">
      <div class="dialogue-portrait"><img src="assets/sprites/${info.aceId}.png"></div>
      <div class="dialogue-body">
        <div class="dialogue-name"></div>
        <div class="dialogue-text"></div>
        <div class="dialogue-hint">点击继续 ▸</div>
      </div>
    </div>`;
  app.appendChild(el);
  const nameEl = el.querySelector('.dialogue-name');
  const textEl = el.querySelector('.dialogue-text');
  const hintEl = el.querySelector('.dialogue-hint');
  const show = () => {
    nameEl.textContent = lines[idx].s;
    textEl.textContent = lines[idx].t;
    hintEl.textContent = idx === lines.length - 1 ? `规则：${ruleText} ▸` : '点击继续 ▸';
  };
  show();
  el.addEventListener('click', () => {
    sfx.click();
    idx++;
    if (idx >= lines.length) { el.remove(); sfx.badge(); return; }
    show();
  });
}

// ---------------- 计分动画 ----------------
async function doPlay() {
  if (busy || rewardPending || selected.size === 0 || selected.size > 5) return;
  busy = true;
  const uids = [...selected];
  selected.clear();
  // 打出与消耗品选卡互斥：清掉选卡状态与横幅，避免计分动画中横幅残留
  if (targeting) { targeting = null; const b = $('.targeting-banner'); if (b) b.remove(); }

  // 把打出的卡视觉上移到计分区
  const handEl = $('#handArea');
  const rowEl = $('#playedRow');
  uids.forEach(uid => {
    const src = handEl.querySelector(`[data-uid="${uid}"]`);
    if (src) {
      const clone = src.cloneNode(true);
      clone.classList.remove('selected');
      clone.classList.add('played');
      rowEl.appendChild(clone);
      src.classList.add('gone');
    }
  });
  sfx.play();
  await sleep(320);

  const { events, played } = scoreHand(run, uids);
  lastHandKey = events[0].hand;
  let cardStep = 0;
  for (const ev of events) {
    if (ev.type === 'base') {
      setScore(ev.chips, ev.mult);
      sfx.tick(0);
      await sleep(360);
    } else if (ev.type === 'card') {
      const el = rowEl.children[cardStep++];
      if (el) { el.classList.add('scoring'); setTimeout(() => el.classList.remove('scoring'), 260); }
      bumpScore(ev.chipsGain, ev.multGain);
      flashCardBonus(el);
      if (ev.weather) showFloat(el, ev.weather === 1.5 ? '☀×1.5' : `×${ev.weather}`, ev.weather === 1.5 ? '#ffd76a' : '#8fa3c8');
      sfx.tick(cardStep);
      await sleep(240);
    } else if (ev.type === 'item') {
      const def = ITEMS[ev.itemId];
      const slot = document.querySelector(`.item-slot img[src*="${def.slug}"]`);
      if (slot) { const s = slot.parentElement; s.classList.add('triggered'); setTimeout(() => s.classList.remove('triggered'), 300); }
      bumpScore(ev.chipsGain || 0, ev.multGain || 0);
      sfx.mult();
      await sleep(240);
    } else if (ev.type === 'ruleDebuff') {
      showFloat(rowEl, '规则削弱！', '#ff5a5a');
      sfx.hurt();
      await sleep(300);
    } else if (ev.type === 'ruleCap') {
      showFloat(rowEl, `倍率封顶 ${ev.to}！`, '#ff5a5a');
      sfx.hurt();
      await sleep(300);
    } else if (ev.type === 'total') {
      setScore(ev.chips, ev.mult);
      await sleep(200);
      showFloat(rowEl, `-${fmt(ev.total)}`, '#ffd24a', 'big');
      sfx.total();
      shakeScreen();
      await sleep(420);
    } else if (ev.type === 'poison') {
      showFloat(rowEl, `☠ 中毒 +${ev.add}（共 ${ev.stacks} 层）`, '#a0e050');
      sfx.mult();
      await sleep(340);
    } else if (ev.type === 'poisonDmg') {
      showFloat(rowEl, `☠ 毒伤 -${fmt(ev.damage)}`, '#a0e050', 'big');
      sfx.hurt();
      shakeScreen();
      await sleep(460);
    } else if (ev.type === 'sash') {
      showToast('气势披带发动！追加 1 手牌机会！（本场仅一次）');
      sfx.badge();
      await sleep(600);
    }
  }

  // 更新血条
  const f = run.fight;
  const fill = $('.hp-fill');
  const txt = $('.hp-text');
  if (fill) fill.style.width = Math.max(0, f.hp / f.maxHp * 100) + '%';
  if (txt) txt.textContent = `${fmt(f.hp)} / ${fmt(f.maxHp)}`;
  await sleep(500);

  if (fightWon(run)) {
    sfx.win();
    rewardPending = true;
    showRewardModal();
  } else if (f.hands <= 0) {
    defeat(run);
    clearSave();
    sfx.lose();
    await sleep(600);
    if (runBoardKey(run)) {
      lastWeeklyRank = recordWeeklyResult(run);       // 本地兜底
      const cloud = await submitWeeklyScore(run);      // 云端提交
      if (cloud && cloud.online && cloud.rank) lastWeeklyRank = { ...lastWeeklyRank, rank: cloud.rank, online: true };
    }
    render();
    if (lastWeeklyRank) showWeeklyBoardModal(lastWeeklyRank.rank);
  } else {
    afterPlay(run);
    save(run);
    render();
  }
  busy = false;
}

function setScore(chips, mult) {
  const c = $('#chipsVal'), m = $('#multVal');
  if (c) c.textContent = fmt(chips);
  if (m) m.textContent = (Math.round(mult * 10) / 10).toString().replace(/\.0$/, '');
}

function bumpScore(dChips, dMult) {
  const c = $('#chipsVal'), m = $('#multVal');
  if (c) {
    const cur = parseInt(c.textContent.replace(/,/g, '')) || 0;
    c.textContent = fmt(cur + (dChips || 0));
    if (dChips) showFloat(c.parentElement, `+${dChips}`, '#4aa8ff');
  }
  if (m) {
    const cur = parseFloat(m.textContent) || 0;
    m.textContent = (Math.round((cur + (dMult || 0)) * 10) / 10).toString();
    if (dMult) showFloat(m.parentElement, `+${dMult}`, '#ff5a5a');
  }
  c && pulse(c); m && pulse(m);
}

function flashCardBonus(el) { if (el) el.classList.add('card-hit'); }

function showFloat(anchor, text, color, big = false) {
  if (!anchor) return;
  const fl = document.createElement('div');
  fl.className = 'float-num' + (big ? ' big' : '');
  fl.style.color = color;
  fl.textContent = text;
  const rect = anchor.getBoundingClientRect();
  fl.style.left = (rect.left + rect.width / 2 + (Math.random() * 40 - 20)) + 'px';
  fl.style.top = (rect.top - 8) + 'px';
  document.body.appendChild(fl);
  setTimeout(() => fl.remove(), 950);
}

function pulse(el) {
  el.classList.remove('pulse');
  void el.offsetWidth;
  el.classList.add('pulse');
}

function shakeScreen() {
  const s = document.querySelector('.screen');
  if (!s) return;
  s.classList.remove('shake');
  void s.offsetWidth;
  s.classList.add('shake');
}

function showRewardModal() {
  const info = run.fight.info;
  const detail = previewReward(run);
  const el = document.createElement('div');
  el.className = 'modal-overlay';
  el.innerHTML = `<div class="modal reward">
    <div class="reward-title">${info.isLeader ? '击败了 ' + info.name + '！' : '战胜了 ' + info.name + '！'}</div>
    ${info.isLeader ? `<div class="reward-badge">获得 ${info.badge}</div>` : ''}
    ${info.isLeader && info.victory ? `<div class="reward-quote">「${info.victory}」<span>—— ${info.leader}</span></div>` : ''}
    <div class="reward-money">${fillRewardMoneyHtml(detail)}</div>
    <button class="big-btn red" data-action="claimReward">领取奖励</button>
  </div>`;
  app.appendChild(el);
}

function fillRewardMoneyHtml(detail) {
  return `
    <div class="money-row"><span>战斗奖励</span><b>+$${detail.base}</b></div>
    <div class="money-row"><span>存款利息</span><b>+$${detail.interest}</b></div>
    ${detail.bonus ? `<div class="money-row"><span>道具收益</span><b>+$${detail.bonus}</b></div>` : ''}
    <div class="money-row total"><span>合计</span><b>+$${detail.total}</b></div>`;
}

// ---------------- 商店界面 ----------------
function shopItemCard(id, idx) {
  const d = ITEMS[id];
  const r = RARITY[d.rarity];
  const price = itemPrice(run, id);
  const owned = run.shop.bought['i' + idx];
  return `
  <div class="shop-card ${owned ? 'sold' : ''}" style="--rc:${r.color}">
    <div class="shop-card-head rarity-${d.rarity}">${d.name}<span class="rarity-tag">${r.name}</span></div>
    <img class="shop-img" src="assets/items/${d.slug}.png">
    <div class="shop-desc">${d.desc}</div>
    ${owned ? '<div class="sold-mark">已购买</div>'
      : `<button class="buy-btn" data-action="buyItem" data-idx="${idx}" ${run.money < price || run.items.length >= RULES.itemSlots ? 'disabled' : ''}>$${price}</button>`}
  </div>`;
}

function shopConsumableCard(id, idx) {
  const d = CONSUMABLES[id];
  const price = consumablePrice(run, id);
  const owned = run.shop.bought['c' + idx];
  const full = run.consumables.length >= RULES.consumableSlots;
  const noMoney = run.money < price;
  const blockTitle = full ? '背包已满，先使用或出售一个' : noMoney ? '钱不够' : '';
  return `
  <div class="shop-card consumable ${owned ? 'sold' : ''}" style="--rc:#8a7cc8">
    <div class="shop-card-head">${d.name}<span class="rarity-tag">消耗品</span></div>
    <img class="shop-img" src="assets/items/${d.slug}.png">
    <div class="shop-desc">${d.desc}</div>
    ${owned ? '<div class="sold-mark">已购买</div>'
      : `<button class="buy-btn" data-action="buyConsumable" data-idx="${idx}" ${full || noMoney ? 'disabled' : ''} ${blockTitle ? `title="${blockTitle}"` : ''}>$${price}</button>`}
  </div>`;
}

function showSellConfirm(kind, idx) {
  const id = kind === 'item' ? run.items[idx] : run.consumables[idx];
  if (!id) return;
  const d = kind === 'item' ? ITEMS[id] : CONSUMABLES[id];
  const refund = kind === 'item' ? Math.floor(RARITY[d.rarity].price / 2) : Math.floor(d.price / 2);
  const el = document.createElement('div');
  el.className = 'modal-overlay';
  el.innerHTML = `<div class="modal sell-modal">
    <div class="panel-title">确认出售</div>
    <div class="sell-row">
      <img src="assets/items/${d.slug}.png" alt="${d.name}">
      <div class="sell-info"><b>${d.name}</b><span>退还 $${refund}</span></div>
    </div>
    <div class="modal-btns">
      <button class="big-btn blue sm" data-action="cancelSell">取消</button>
      <button class="big-btn red sm" data-action="confirmSell" data-kind="${kind}" data-idx="${idx}">出售 +$${refund}</button>
    </div>
  </div>`;
  app.appendChild(el);
}

function renderShop() {
  const nextInfo = fightInfo(run.fightIdx);
  const cost = rerollCost(run);
  app.innerHTML = `
  <div class="screen shop">
    ${topbar()}
    <div class="shop-head">
      <h2>宝可梦友好商店</h2>
      <span class="shop-next">下一战：<b>${nextInfo.name}</b>${nextInfo.isLeader && nextInfo.ruleDesc ? ` · <span class="opp-rule-inline">${nextInfo.ruleDesc}</span>` : ' · <span class="dim">常规战</span>'}</span>
    </div>
    <div class="shop-section"><div class="panel-title">携带道具</div>
      <div class="shop-grid">${run.shop.items.map((id, i) => shopItemCard(id, i)).join('')}</div>
    </div>
    <div class="shop-section"><div class="panel-title">消耗品${run.consumables.length >= RULES.consumableSlots ? '（背包已满，先使用或出售一个）' : '（战斗中使用）'}</div>
      <div class="shop-grid cons">${run.shop.consumables.map((id, i) => shopConsumableCard(id, i)).join('')}</div>
    </div>
    <div class="shop-section">
      <div class="panel-title">背包（${run.consumables.length}/${RULES.consumableSlots}）</div>
      <div class="owned-items owned-cons">
        ${run.consumables.length ? run.consumables.map((id, i) => {
          const d = CONSUMABLES[id];
          const refund = Math.floor(d.price / 2);
          return `<div class="cons-owned" data-tip="${d.name}<br>${d.desc}">
            <img src="assets/items/${d.slug}.png" alt="${d.name}">
            <span class="co-name">${d.name}</span>
            <button class="mini-btn" data-action="useConsumable" data-idx="${i}">使用</button>
            <button class="mini-btn red" data-action="sellConsumable" data-idx="${i}">售 $${refund}</button>
          </div>`;
        }).join('') : '<span class="dim">（空）</span>'}
      </div>
    </div>
    <div class="shop-section">
      <div class="panel-title">身上的携带物（点击出售）</div>
      <div class="owned-items">
        ${run.items.length ? run.items.map((id, i) => {
          const d = ITEMS[id]; const r = RARITY[d.rarity];
          return `<div class="owned-item" data-action="sell" data-idx="${i}" data-tip="${d.name}<br>${d.desc}<br>点击出售（$${Math.floor(r.price / 2)}）">
            <img src="assets/items/${d.slug}.png"><span>$${Math.floor(r.price / 2)}</span></div>`;
        }).join('') : '<span class="dim">（空）</span>'}
      </div>
    </div>
    <div class="shop-actions">
      <button class="big-btn blue sm" data-action="reroll" ${run.money < cost ? 'disabled' : ''}>刷新货架 $${cost}</button>
      <button class="big-btn red" data-action="leave">出发！</button>
    </div>
  </div>`;
}

// ---------------- 结算界面 ----------------
function renderEnd() {
  const win = run.phase === 'victory';
  const variantName = run.variant && run.variant !== 'standard'
    ? (WEEKLY_VARIANTS.find(v => v.key === run.variant) || {}).name : null;
  const is2P = run.mode === '2p';
  let title, sub;
  if (is2P) {
    const w = run.winner == null ? 0 : run.winner;
    title = win ? `🏆 P${w + 1} 击败了冠军！` : `🎉 P${w + 1} 获胜！`;
    sub = win ? `P${w + 1} 率先登上石英之巅，双人对决落幕。` : `P${1 - w + 0 + 1} 输掉了自己的战斗，P${w + 1} 赢下双人热座！`;
  } else {
    title = win ? '🏆 冠军诞生！' : '😭 挑战失败';
    sub = win ? `你击败了冠军青绿，集齐 8 枚徽章站上了石英之巅！`
      : `倒在第 ${run.fightIdx + 1} 场战斗 —— ${fightInfo(run.fightIdx).name}面前。`;
  }
  const pStats = is2P ? `
      <div class="end-2p">
        <div class="p2-card p1"><b>P1</b><span>胜场 ${run.players[0].stats.fightsWon}</span><span>最大 ${fmt(run.players[0].stats.maxHit)}</span><span>$${run.players[0].stats.moneyEarned}</span></div>
        <div class="vs">VS</div>
        <div class="p2-card p2"><b>P2</b><span>胜场 ${run.players[1].stats.fightsWon}</span><span>最大 ${fmt(run.players[1].stats.maxHit)}</span><span>$${run.players[1].stats.moneyEarned}</span></div>
      </div>` : '';
  app.innerHTML = `
  <div class="screen end-screen ${win ? 'victory' : 'defeat'}">
    <div class="end-card">
      <div class="end-title">${title}</div>
      <div class="end-sub">${sub}</div>
      ${variantName ? `<div class="end-variant">${run.weekly ? '本周变体' : '变体'}：${variantName}</div>` : ''}
      ${pStats}
      <div class="end-stats">
        <div><span>最大单手伤害</span><b>${fmt(run.stats.maxHit)}</b></div>
        <div><span>打出手数</span><b>${run.stats.handsPlayed}</b></div>
        <div><span>胜场数</span><b>${run.stats.fightsWon} / ${fightCount()}</b></div>
        <div><span>累计赚取</span><b>$${run.stats.moneyEarned}</b></div>
        <div><span>种子</span><b>${run.seed}</b></div>
        ${run.weekly ? `<div><span>本周挑战积分</span><b>${weeklyScore(run).toLocaleString()}</b></div>` : ''}
      </div>
      <div class="end-buttons">
        <button class="big-btn red" data-action="start">再来一局</button>
        <button class="big-btn gold" data-action="challengeCode">挑战码</button>
        <button class="big-btn gold" data-action="shareCard">保存战绩图</button>
        <button class="big-btn gold" data-action="history">本局战报</button>
        ${run.weekly ? '<button class="big-btn gold" data-action="weeklyBoard">本周排行榜</button>' : ''}
        ${run.daily ? '<button class="big-btn gold" data-action="dailyBoard">今日榜</button>' : ''}
        ${run.roomKey ? '<button class="big-btn gold" data-action="roomBoard">房间榜</button>' : ''}
        <button class="big-btn blue" data-action="toTitle">回到标题</button>
      </div>
    </div>
    <footer class="disclaimer">非官方粉丝作品 · Pokémon © Nintendo / Creatures / Game Freak · 仅供学习交流</footer>
  </div>`;
}

// ---------------- 弹窗：牌组 / 手牌类型选择 / 图鉴 / 道具详情 / 榜单 ----------------
function showDeckModal() {
  const el = document.createElement('div');
  el.className = 'modal-overlay';
  const hint = deckTargeting
    ? `<div class="targeting-banner">为【${CONSUMABLES[run.consumables[deckTargeting.cIdx]]?.name || ''}】选择一张卡（点击卡牌）<button class="mini-btn" data-action="cancelDeckTargeting">取消</button></div>`
    : '';
  el.innerHTML = `<div class="modal deck-modal">
    <div class="panel-title">牌组一览（${run.deck.length} 张）${deckTargeting ? '' : ' · 点击道具栏「背包」中的牌组类消耗品可在此选卡'}</div>
    ${hint}
    <div class="deck-grid">${run.deck.map(c => cardHtml(c, { mini: true })).join('')}</div>
    ${deckTargeting ? '' : '<button class="big-btn blue sm" data-action="closeModal">关闭</button>'}
  </div>`;
  app.appendChild(el);
}

function showHandTypesModal() {
  const el = document.createElement('div');
  el.className = 'modal-overlay';
  el.innerHTML = `<div class="modal">
    <div class="panel-title">手牌类型</div>
    <div class="handtype-list">${handPanelHtml()}</div>
    <button class="big-btn blue sm" data-action="closeModal">关闭</button>
  </div>`;
  app.appendChild(el);
}

function showDexModal() {
  const dex = loadDex();
  const shiny = loadDexShiny();
  const shinyCount = Object.keys(shiny).length;
  const slots = [];
  for (const [type, list] of Object.entries(ROSTER)) {
    for (const [dexId, name] of list) {
      const seen = dex[dexId];
      const shinySeen = shiny[dexId];
      slots.push(`
      <div class="dex-slot ${seen ? 'seen' : ''} ${shinySeen ? 'shiny-seen' : ''}"
           data-tip="${seen ? name + '<br>遇见 ' + seen + ' 次' + (shinySeen ? '<br>✨ 遇见过闪光 ×' + shinySeen : '') : '尚未遇见'}">
        ${shinySeen ? '<span class="dex-shiny">✨</span>' : ''}
        <img src="assets/sprites/${dexId}.png" draggable="false">
        <span>${seen ? name : '？？？'}</span>
      </div>`);
    }
  }
  const el = document.createElement('div');
  el.className = 'modal-overlay';
  el.innerHTML = `<div class="modal deck-modal">
    <div class="panel-title">宝可梦图鉴 · 已遇见 ${Object.keys(dex).length}/80${shinyCount ? ' · 闪光 ✨' + shinyCount : ''}（跨局累积）</div>
    <div class="dex-grid">${slots.join('')}</div>
    <button class="big-btn blue sm" data-action="closeModal">关闭</button>
  </div>`;
  app.appendChild(el);
}

function showSettingsModal() {
  const st = getSettings();
  const el = document.createElement('div');
  el.className = 'modal-overlay';
  el.innerHTML = `<div class="modal narrow settings">
    <div class="panel-title">设置</div>
    <div class="setting-row"><span>音效音量</span><input type="range" min="0" max="100" value="${Math.round(st.sfx * 100)}" data-setting="sfx"></div>
    <div class="setting-row"><span>音乐音量</span><input type="range" min="0" max="100" value="${Math.round(st.bgm * 100)}" data-setting="bgm"></div>
    <label class="setting-row"><input type="checkbox" data-action="bgmToggle" ${st.bgmOn ? 'checked' : ''}> 背景音乐（8-bit 合成循环）</label>
    <div class="setting-row"><span>训练师名</span><input type="text" class="name-input" maxlength="8" value="${st.name}" data-setting="name" placeholder="训练师"></div>
    <p class="dim small">音效与音乐全部由 WebAudio 实时合成，无任何音频素材文件。训练师名会显示在云端周榜上。</p>
    <button class="big-btn blue sm" data-action="closeModal">关闭</button>
  </div>`;
  app.appendChild(el);
}

function onInput(e) {
  const el = e.target.closest('[data-setting]');
  if (!el) return;
  const key = el.dataset.setting;
  if (key === 'sfx' || key === 'bgm') {
    const v = parseInt(el.value) / 100;
    sfx.setVolumes({ [key]: v });
    saveSettings({ [key]: v });
    if (key === 'sfx') sfx.select(); // 试听
  } else if (key === 'name') {
    saveSettings({ name: el.value.trim() || '训练师' });
  }
}

function showItemInfoModal(idx) {
  const id = run.items[idx];
  if (!id) return;
  const d = ITEMS[id];
  const r = RARITY[d.rarity];
  const growth = run.itemBonus && run.itemBonus[id];
  const el = document.createElement('div');
  el.className = 'modal-overlay';
  el.innerHTML = `<div class="modal narrow">
    <div class="item-info">
      <img src="assets/items/${d.slug}.png">
      <div>
        <div class="item-info-name" style="color:${r.color}">${d.name} <small>${r.name}</small></div>
        <div class="item-info-desc">${d.desc}</div>
        ${growth ? `<div class="item-info-growth">当前累计加成：+${growth}</div>` : ''}
      </div>
    </div>
    <div class="item-info-btns">
      <button class="big-btn red sm" data-action="sellFromInfo" data-idx="${idx}">出售 $${Math.floor(r.price / 2)}</button>
      <button class="big-btn blue sm" data-action="closeModal">关闭</button>
    </div>
  </div>`;
  app.appendChild(el);
}

function showWeeklyBoardModal(highlight, opts = {}) {
  const key = opts.key || (run && runBoardKey(run)) || weeklySeed().key;
  const label = opts.label || (key.startsWith('ROOM-') ? '挑战房排行榜'
    : /^\d{4}-\d{2}-\d{2}$/.test(key) ? '今日挑战排行榜' : '每周挑战排行榜');
  const el = document.createElement('div');
  el.className = 'modal-overlay';
  el.innerHTML = `<div class="modal">
    <div class="panel-title">${label} <span class="board-key dim">${key}</span> <span class="board-source dim">加载中…</span></div>
    <table class="board-table">
      <tr><th>名次</th><th>训练师</th><th>结果</th><th>进度</th><th>最大伤害</th><th>积分</th></tr>
      <tbody class="board-body"><tr><td colspan="6" class="dim">加载中…</td></tr></tbody>
    </table>
    <button class="big-btn blue sm" data-action="closeModal">关闭</button>
  </div>`;
  app.appendChild(el);
  const body = el.querySelector('.board-body');
  const source = el.querySelector('.board-source');
  const renderBoard = (board, online) => {
    if (!board.length) {
      body.innerHTML = '<tr><td colspan="6" class="dim">还没有记录，去打一场吧！</td></tr>';
    } else {
      body.innerHTML = board.map((e, i) => `
        <tr class="${highlight && i === highlight - 1 ? 'hl' : ''}">
          <td>#${i + 1}</td><td>${(e.name || '训练师').slice(0, 8)}</td><td>${e.result}${e.variant && e.variant !== 'standard' ? '·' + e.variant : ''}</td>
          <td>第 ${e.fightsWon} 场</td><td>最大 ${(e.maxHit || 0).toLocaleString()}</td>
          <td><b>${(e.score || 0).toLocaleString()}</b></td>
        </tr>`).join('');
    }
    source.textContent = online ? '（云端共享榜）' : '（本机记录，云端不可用）';
  };
  fetchWeeklyBoard(key).then(board => {
    if (board) renderBoard(board.slice(0, 10), true);
    else renderBoard(getWeeklyBoard().filter(e => e.key === key), false);
  });
}

function showBadgeOverlay(info) {
  const isChampion = info.kind === 'champion';
  const el = document.createElement('div');
  el.className = 'badge-overlay';
  el.innerHTML = `
    <div class="badge-showcase" style="--gym:${info.color || '#f0c040'}">
      <div class="badge-medal ${isChampion ? 'champ' : ''}">${isChampion ? '★' : '徽'}</div>
      <div class="badge-caption">${isChampion ? '冠军之证到手！' : `获得 ${info.badge}`}</div>
      <div class="badge-sub">${info.gym} · ${info.leader}</div>
    </div>`;
  document.body.appendChild(el);
  sfx.badge();
  const close = () => el.remove();
  el.addEventListener('click', close);
  setTimeout(close, 2800);
}

async function drawShareCard(runWin) {
  const W = 640, H = 360;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const win = run.phase === 'victory';
  // 背景
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#22345c'); grad.addColorStop(1, '#10151f');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#e8a72e'; ctx.lineWidth = 3;
  ctx.strokeRect(8, 8, W - 16, H - 16);
  // 标题
  ctx.textAlign = 'center';
  ctx.fillStyle = win ? '#ffd76a' : '#ff8a80';
  ctx.font = 'bold 34px "PingFang SC", sans-serif';
  ctx.fillText(win ? '🏆 冠军诞生！' : '挑战失败', W / 2, 56);
  ctx.fillStyle = '#8fa3c8';
  ctx.font = '15px "PingFang SC", sans-serif';
  ctx.fillText(`宝可梦·徽章之路 · 训练师「${getSettings().name}」 · 种子 ${run.seed}`, W / 2, 84);
  // 徽章行
  const beaten = Math.min(GYMS.length, Math.floor(run.fightIdx / 2));
  const bx = W / 2 - 8 * 19, by = 122;
  for (let i = 0; i < GYMS.length; i++) {
    ctx.beginPath();
    ctx.arc(bx + 19 + i * 38, by, 13, 0, Math.PI * 2);
    if (i < beaten) {
      ctx.fillStyle = '#e8a72e';
      ctx.fill();
      ctx.fillStyle = '#5d3f00';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(String(i + 1), bx + 19 + i * 38, by + 4);
    } else {
      ctx.strokeStyle = '#3a4a70'; ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
  ctx.beginPath();
  ctx.arc(bx + 19 + 8 * 38, by, 13, 0, Math.PI * 2);
  if (win) { ctx.fillStyle = '#ffd76a'; ctx.fill(); } else { ctx.strokeStyle = '#3a4a70'; ctx.stroke(); }
  ctx.fillStyle = '#5d3f00'; ctx.font = 'bold 11px sans-serif';
  ctx.fillText('★', bx + 19 + 8 * 38, by + 4);
  // 统计
  ctx.fillStyle = '#e8ecf4';
  ctx.font = 'bold 19px "PingFang SC", sans-serif';
  ctx.fillText(`胜场 ${run.stats.fightsWon}/17    最大单手 ${run.stats.maxHit.toLocaleString()}    累计赚取 $${run.stats.moneyEarned}`, W / 2, 172);
  if (run.variant && run.variant !== 'standard') {
    ctx.fillStyle = '#ffd76a';
    ctx.font = '15px "PingFang SC", sans-serif';
    const v = WEEKLY_VARIANTS.find(x => x.key === run.variant);
    ctx.fillText(`每周挑战 · ${v ? v.name : run.variant} · 积分 ${weeklyScore(run).toLocaleString()}`, W / 2, 202);
  }
  // 三只宝可梦立绘（取牌组力量最高的三只）
  const picks = [...run.deck].sort((a, b) => b.power - a.power).slice(0, 3);
  const imgs = await Promise.all(picks.map(p => new Promise(res => {
    const img = new Image();
    img.onload = () => res({ img, p });
    img.onerror = () => res(null);
    img.src = `assets/${p.shiny ? 'sprites-shiny' : 'sprites'}/${p.dex}.png`;
  })));
  const iw = 130, gap = 40;
  const totalW = picks.length * iw + (picks.length - 1) * gap;
  imgs.filter(Boolean).forEach(({ img, p }, i) => {
    const x = W / 2 - totalW / 2 + i * (iw + gap);
    ctx.drawImage(img, x, H - iw - 28, iw, iw);
    ctx.fillStyle = TYPES[p.type].color;
    ctx.fillRect(x + iw / 2 - 38, H - 26, 76, 20);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px "PingFang SC", sans-serif';
    ctx.fillText(`${p.name}${p.shiny ? '✨' : ''}`, x + iw / 2, H - 11);
  });
  return canvas;
}

function showCustomChallengeModal() {
  const el = document.createElement('div');
  el.className = 'modal-overlay';
  el.innerHTML = `<div class="modal narrow">
    <div class="panel-title">自定义挑战房</div>
    <p class="dim small" style="text-align:left;margin:0 0 10px">选一个变体规则和种子开局。生成挑战码发给朋友，对方粘贴后能玩到完全相同的一局。</p>
    <div class="setting-row"><span>变体规则</span>
      <select class="variant-select">
        ${WEEKLY_VARIANTS.map(v => `<option value="${v.key}">${v.name} —— ${v.desc}</option>`).join('')}
      </select>
    </div>
    <div class="setting-row"><span>种子（留空随机）</span><input type="text" class="name-input" id="customSeed" maxlength="10" placeholder="随机"></div>
    <div class="item-info-btns" style="margin-top:14px">
      <button class="big-btn red sm" data-action="startCustom">开局</button>
      <button class="big-btn blue sm" data-action="closeModal">取消</button>
    </div>
  </div>`;
  app.appendChild(el);
}

function showChallengeCodeModal() {
  const code = encodeChallenge({ seed: run.seed, variant: run.variant || 'standard', label: getSettings().name });
  const el = document.createElement('div');
  el.className = 'modal-overlay';
  el.innerHTML = `<div class="modal narrow">
    <div class="panel-title">本局挑战码</div>
    <p class="dim small">把挑战码发给朋友，对方在标题页粘贴即可玩到同一副牌的同一局。</p>
    <textarea class="code-area" readonly rows="3">${code}</textarea>
    <div class="item-info-btns" style="margin-top:12px">
      <button class="big-btn red sm" data-action="copyCode">复制挑战码</button>
      <button class="big-btn gold sm" data-action="exportReport">导出战报 JSON</button>
      <button class="big-btn gold sm" data-action="roomBoard">房间榜</button>
      <button class="big-btn blue sm" data-action="closeModal">关闭</button>
    </div>
  </div>`;
  app.appendChild(el);
}

function showHistoryModal() {
  const hist = run.history || [];
  // 按战斗分组
  const groups = [];
  for (const h of hist) {
    let g = groups[groups.length - 1];
    if (!g || g.f !== h.f) { g = { f: h.f, opp: h.opp, hands: [], dmg: 0 }; groups.push(g); }
    g.hands.push(h);
    g.dmg += h.total + (h.poison || 0);
  }
  const rows = groups.map(g => `
    <div class="hist-group">
      <div class="hist-head">第 ${g.f + 1} 场 · ${g.opp} <span class="dim">共造成 ${fmt(g.dmg)} 伤害</span></div>
      ${g.hands.map(h => `
        <div class="hist-row" data-tip="${(h.p ? h.p + '：' : '')}${h.cards.join('、')}">
          <span class="hist-hand">${h.p ? `<i class="hp-${h.p}">${h.p}</i>` : ''}${HANDS[h.hand] ? HANDS[h.hand].name : h.hand}</span>
          <span class="hist-cards">${h.cards.slice(0, 3).join('·')}${h.cards.length > 3 ? '…' : ''}</span>
          <span class="hist-dmg">${fmt(h.total)}${h.poison ? ` ☠${fmt(h.poison)}` : ''}</span>
        </div>`).join('')}
    </div>`).join('');
  const el = document.createElement('div');
  el.className = 'modal-overlay';
  el.innerHTML = `<div class="modal history-modal">
    <div class="panel-title">本局战报 · ${hist.length} 手牌</div>
    <div class="hist-list">${rows || '<div class="dim">还没有出过牌</div>'}</div>
    <button class="big-btn blue sm" data-action="closeModal">关闭</button>
  </div>`;
  app.appendChild(el);
}

async function downloadShareCard() {
  try {
    const canvas = await drawShareCard();
    const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
    if (!blob) throw new Error('canvas 为空');
    const fileName = `badge-run-${run.seed}.png`;
    // 优先系统分享（手机可直接发到社交平台）
    try {
      const file = new File([blob], fileName, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: '宝可梦·徽章之路 战绩' });
        sfx.coin();
        return;
      }
    } catch (e) { /* 用户取消或不支持，走下载 */ }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    sfx.coin();
  } catch (e) {
    showToast('生成分享图失败：' + e.message, true);
  }
}


function showCaptureModal(card) {
  const el = document.createElement('div');
  el.className = 'modal-overlay';
  el.innerHTML = `<div class="modal capture">
    <div class="capture-title">${card.shiny ? '✨ 闪光 ' : ''}${card.name} 加入了你的牌组！</div>
    <div class="capture-img"><img src="assets/${card.shiny ? 'sprites-shiny' : 'sprites'}/${card.dex}.png"></div>
    <div class="capture-info">${TYPES[card.type].name}属性 · 力量 ${card.power}</div>
    <button class="big-btn red" data-action="closeModal">太好了！</button>
  </div>`;
  app.appendChild(el);
  if (card.shiny) sfx.badge(); else sfx.coin();
}

function showToast(text, isError = false) {
  const old = document.querySelector('.toast');
  if (old) old.remove();
  const el = document.createElement('div');
  el.className = 'toast' + (isError ? ' error' : '');
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

function showHandTypePicker() {
  const keys = Object.keys(HANDS);
  const el = document.createElement('div');
  el.className = 'modal-overlay';
  el.innerHTML = `<div class="modal">
    <div class="panel-title">为哪种子手牌升级？</div>
    <div class="handtype-grid">
      ${keys.map(k => {
        const lv = run.handLevels[k] || 1;
        const b = handBase(k, lv);
        const nb = handBase(k, lv + 1);
        return `<button class="handtype-btn" data-action="pickHandType" data-key="${k}">
          ${HANDS[k].name} Lv${lv}<br><small>${b.chips}×${b.mult} → ${nb.chips}×${nb.mult}</small></button>`;
      }).join('')}
    </div>
    <button class="big-btn blue sm" data-action="cancelHandPick">取消</button>
  </div>`;
  app.appendChild(el);
}

// ---------------- Tooltip ----------------
let tipEl = null;
function onHover(e) {
  const t = e.target.closest('[data-tip]');
  if (!t) { if (tipEl) { tipEl.remove(); tipEl = null; } return; }
  if (!tipEl) {
    tipEl = document.createElement('div');
    tipEl.className = 'tooltip';
    document.body.appendChild(tipEl);
  }
  tipEl.innerHTML = t.dataset.tip;
  const rect = t.getBoundingClientRect();
  tipEl.style.left = Math.min(window.innerWidth - 260, rect.left) + 'px';
  tipEl.style.top = (rect.bottom + 6) + 'px';
}

// ---------------- 交互 ----------------
async function onClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  if (busy && !['cancelTargeting', 'closeModal'].includes(action)) return;

  switch (action) {
    case 'start': {
      const input = $('#seedInput');
      const seedStr = input ? input.value.trim() : '';
      const seed = seedStr ? hashSeed(seedStr) : (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
      run = newRun(seed);
      selected.clear(); targeting = null; deckTargeting = null; rewardPending = false; lastHandKey = null;
      save(run);
      sfx.click();
      render();
      break;
    }
    case 'startDaily': {
      const { seed, key } = dailySeed();
      run = newRun(seed, null, weeklyVariant(key).key); // 每日独立轮换变体
      run.daily = key;
      selected.clear(); targeting = null; deckTargeting = null; rewardPending = false; lastHandKey = null;
      save(run);
      sfx.badge();
      render();
      break;
    }
    case 'startWeekly': {
      const { seed, key } = weeklySeed();
      run = newRun(seed, key);
      selected.clear(); targeting = null; deckTargeting = null; rewardPending = false; lastHandKey = null;
      save(run);
      sfx.badge();
      render();
      break;
    }
    case 'start2P': {
      const seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
      run = newRun2P(seed);
      selected.clear(); targeting = null; deckTargeting = null; rewardPending = false; lastHandKey = null;
      save(run);
      sfx.badge();
      render();
      showToast('双人热座：P1 与 P2 轮流出战，输掉自己战斗的一方落败！');
      break;
    }
    case 'customChallenge': sfx.click(); showCustomChallengeModal(); break;
    case 'startCustom': {
      const modal = document.querySelector('.modal.narrow');
      const variant = modal.querySelector('.variant-select').value;
      const seedStr = modal.querySelector('#customSeed').value.trim();
      const seed = seedStr ? hashSeed(seedStr) : (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
      run = newRun(seed, null, variant);
      run.roomKey = roomKeyFor(seed, variant);
      selected.clear(); targeting = null; deckTargeting = null; rewardPending = false; lastHandKey = null;
      save(run);
      document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
      sfx.badge();
      render();
      showToast(`自定义挑战：${(WEEKLY_VARIANTS.find(v => v.key === variant) || {}).name} · 种子 ${seed} · 房间榜 ${run.roomKey}`);
      break;
    }
    case 'joinCode': {
      const input = $('#codeInput');
      const parsed = decodeChallenge(input ? input.value : '');
      if (!parsed) { showToast('挑战码无效，应以 GYM1. 开头', true); sfx.hurt(); break; }
      run = newRun(parsed.seed, null, parsed.variant);
      run.roomKey = roomKeyFor(parsed.seed, parsed.variant);
      selected.clear(); targeting = null; deckTargeting = null; rewardPending = false; lastHandKey = null;
      save(run);
      sfx.badge();
      render();
      showToast(`已加入挑战：种子 ${parsed.seed}${parsed.variant !== 'standard' ? ' · ' + parsed.variant : ''}${parsed.label ? ' · 来自 ' + parsed.label : ''}`);
      break;
    }
    case 'challengeCode': sfx.click(); showChallengeCodeModal(); break;
    case 'copyCode': {
      const code = encodeChallenge({ seed: run.seed, variant: run.variant || 'standard', label: getSettings().name });
      try {
        await navigator.clipboard.writeText(code);
        showToast('挑战码已复制到剪贴板！');
      } catch (e) {
        const ta = document.querySelector('.code-area');
        if (ta) { ta.select(); document.execCommand('copy'); showToast('已复制（请手动粘贴分享）'); }
      }
      sfx.coin();
      break;
    }
    case 'exportReport': {
      const blob = new Blob([buildReportJson(run)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `badge-run-${run.seed}-report.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 3000);
      sfx.coin();
      break;
    }
    case 'continue': {
      const r = load();
      if (r) { run = r; selected.clear(); targeting = null; deckTargeting = null; rewardPending = false; render(); }
      break;
    }
    case 'weeklyBoard': sfx.click(); showWeeklyBoardModal(null, { key: weeklySeed().key }); break;
    case 'dailyBoard': sfx.click(); showWeeklyBoardModal(null, { key: dailySeed().key }); break;
    case 'roomBoard': sfx.click(); showWeeklyBoardModal(null, { key: run.roomKey }); break;
    case 'dex': sfx.click(); showDexModal(); break;
    case 'handTypes': sfx.click(); showHandTypesModal(); break;
    case 'settings': sfx.click(); showSettingsModal(); break;
    case 'bgmToggle': saveSettings({ bgmOn: sfx.setBgm(btn.checked) }); sfx.click(); break;
    case 'mute': sfx.toggleMute(); render(); break;
    case 'deck': sfx.click(); showDeckModal(); break;
    case 'closeModal': sfx.click(); document.querySelectorAll('.modal-overlay').forEach(m => m.remove()); break;

    case 'select': {
      if (targeting) { applyConsumableToCard(+btn.dataset.uid); return; }
      const uid = +btn.dataset.uid;
      const f = run.fight;
      if (uid === f.sleepUid) { showToast('这只宝可梦在睡眠中，这一手打不出 💤'); sfx.sleep(); return; }
      if (selected.has(uid)) {
        selected.delete(uid); sfx.deselect();
      } else if (selected.size < 5) {
        selected.add(uid); sfx.select();
      } else {
        // 已选满 5 张：抖动提示，不重渲染（保住动画）
        sfx.hurt();
        btn.classList.remove('deny'); void btn.offsetWidth; btn.classList.add('deny');
        showToast('最多同时选择 5 张');
        break;
      }
      // 就地更新选中态而非整页重渲染：手机上手牌区横向滚动位置会在 innerHTML 重建时被重置，
      // 导致"点到后面的牌却弹回最前面"。选中状态只差一个 class，补齐预览即可。
      btn.classList.toggle('selected', selected.has(uid));
      updateHandPreview();
      break;
    }
    case 'clearSelection': {
      if (selected.size === 0) break;
      selected.clear();
      sfx.deselect();
      // 就地摘掉所有卡的选中态，保证每张卡都回落原位；不整页重渲染以保住滚动位置与动画
      document.querySelectorAll('#handArea .card.selected').forEach(c => c.classList.remove('selected'));
      updateHandPreview();
      break;
    }
    case 'play': doPlay(); break;
    case 'discard': {
      if (selected.size === 0 || run.fight.discards <= 0) return;
      sfx.discard();
      targeting = null; // 弃牌与消耗品选卡互斥，防止横幅在重渲染后复活
      discardCards(run, [...selected]);
      selected.clear();
      save(run);
      render();
      break;
    }

    case 'itemInfo': {
      if (run.phase === 'battle' && busy) break;
      sfx.click();
      showItemInfoModal(+btn.dataset.idx);
      break;
    }
    case 'sellFromInfo': {
      const idx = +btn.dataset.idx;
      const gain = sellItem(run, idx);
      if (gain) { run.money += gain; sfx.coin(); save(run); }
      document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
      render();
      break;
    }

    case 'useConsumable': {
      const idx = +btn.dataset.idx;
      const id = run.consumables[idx];
      if (!id) return;
      const def = CONSUMABLES[id];
      sfx.click();
      if (def.target === 'card') {
        if (run.phase === 'battle') {
          targeting = targeting && targeting.cIdx === idx ? null : { cIdx: idx };
          render();
        } else { // 商店等非战斗场景：改为从牌组中选一张卡强化
          deckTargeting = { cIdx: idx, mode: 'card' };
          document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
          showDeckModal();
        }
      } else if (def.target === 'handType') {
        handPickFor = { cIdx: idx };
        showHandTypePicker();
      } else if (def.target === 'deckCard') {
        deckTargeting = { cIdx: idx };
        document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
        showDeckModal();
      } else if (def.target === 'none') {
        const result = useConsumableInstant(run, idx);
        if (result && result.card) {
          save(run);
          render(); // 消耗品列表变了，必须重渲染，否则其余槽位 data-idx 错位
          showCaptureModal(result.card);
        }
      }
      break;
    }
    case 'cancelTargeting':
      targeting = null;
      if (busy) {
        // 计分动画进行中只摘横幅，不整页重建（等动画收尾统一渲染），避免画面闪乱
        const b = $('.targeting-banner');
        if (b) b.remove();
      } else render();
      break;
    case 'cancelDeckTargeting':
      deckTargeting = null;
      document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
      render();
      break;
    case 'deckCardPick': {
      if (!deckTargeting) break; // 非选卡模式下点卡不做事
      const uid = +btn.dataset.uid;
      if (deckTargeting.mode === 'card') { // 蛋白质/锌补剂：商店内对牌组卡强化
        const target = run.deck.find(x => x.uid === uid);
        if (target && useConsumableCard(run, deckTargeting.cIdx, uid)) {
          sfx.coin();
          showToast(`已强化 ${target.name}！`);
          deckTargeting = null;
          document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
          save(run);
          render();
        }
        break;
      }
      const result = useConsumableDeckCard(run, deckTargeting.cIdx, uid);
      if (result && result.error) {
        showToast(result.error, true);
        sfx.hurt();
        break;
      }
      const card = result && result.card;
      const msg = result.op === 'remove' ? `放生了 ${card.name}（牌组 ${run.deck.length} 张）`
        : result.op === 'copy' ? `复制了 ${card.shiny ? '✨闪光 ' : ''}${card.name}！`
        : `${card.name} 变成了 ✨闪光宝可梦！`;
      sfx.coin();
      showToast(msg);
      deckTargeting = null;
      document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
      save(run);
      render();
      break;
    }
    case 'pickHandType': {
      if (!handPickFor) return;
      useConsumableHandType(run, handPickFor.cIdx, btn.dataset.key);
      handPickFor = null;
      sfx.coin();
      document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
      save(run);
      render();
      break;
    }
    case 'cancelHandPick':
      handPickFor = null;
      document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
      break;

    case 'claimReward': {
      const wonInfo = run.fight.info;
      const detail = winFight(run);
      rewardPending = false;
      sfx.coin();
      document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
      if (run.phase === 'victory') {
        clearSave();
        if (runBoardKey(run)) {
          lastWeeklyRank = recordWeeklyResult(run);
          const cloud = await submitWeeklyScore(run);
          if (cloud && cloud.online && cloud.rank) lastWeeklyRank = { ...lastWeeklyRank, rank: cloud.rank, online: true };
        }
        render();
        showBadgeOverlay(wonInfo);
        if (lastWeeklyRank) setTimeout(() => showWeeklyBoardModal(lastWeeklyRank.rank), 1400);
      }
      else {
        save(run); render();
        if (wonInfo.isLeader) showBadgeOverlay(wonInfo);
      }
      break;
    }

    case 'buyItem': if (buyItem(run, +btn.dataset.idx)) { sfx.coin(); save(run); } render(); break;
    case 'buyConsumable': if (buyConsumable(run, +btn.dataset.idx)) { sfx.coin(); save(run); } render(); break;
    case 'sell': sfx.click(); showSellConfirm('item', +btn.dataset.idx); break;
    case 'sellConsumable': sfx.click(); showSellConfirm('consumable', +btn.dataset.idx); break;
    case 'confirmSell': {
      const kind = btn.dataset.kind;
      const idx = +btn.dataset.idx;
      const id = kind === 'item' ? run.items[idx] : run.consumables[idx];
      const name = id ? (kind === 'item' ? ITEMS[id] : CONSUMABLES[id]).name : '';
      const gain = kind === 'item' ? sellItem(run, idx) : sellConsumable(run, idx);
      if (gain) { run.money += gain; sfx.coin(); showToast(`已出售 ${name} +$${gain}`); }
      document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
      save(run); render();
      break;
    }
    case 'cancelSell': sfx.click(); document.querySelectorAll('.modal-overlay').forEach(m => m.remove()); break;
    case 'reroll': if (reroll(run)) { sfx.click(); save(run); } render(); break;
    case 'leave': sfx.click(); leaveShop(run); selected.clear(); save(run); render(); break;

    case 'toTitle': run = null; render(); break;
    case 'shareCard': await downloadShareCard(); break;
    case 'history': sfx.click(); showHistoryModal(); break;
  }
}

function applyConsumableToCard(uid) {
  if (!targeting) return;
  if (useConsumableCard(run, targeting.cIdx, uid)) {
    sfx.coin();
    save(run);
  }
  targeting = null;
  render();
}

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function weekKeyLabel() {
  const { key } = weeklySeed();
  return `第 ${key.split('-W')[1]} 周（${key.split('-W')[0]}年）`;
}

// 调试钩子（自动化测试 / 控制台排查用；仅在 URL 带 ?debug 时暴露）
if (typeof location !== 'undefined' && location.search.includes('debug')) {
  window.__gymrun = {
    get run() { return run; },
    get busy() { return busy; },
    sfx,
  };
}
