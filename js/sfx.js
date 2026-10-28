// WebAudio 合成音效 + 程序化 BGM（无音频素材，全部实时生成）
let ctx = null;
let muted = false;
let sfxVol = 1;      // 音效音量 0~1
let musicVol = 0.25; // 音乐音量 0~1
let musicBus = null;
let bgmOn = false;
let bgmTimer = null;
let bar = 0;

function ac() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone({ freq = 440, dur = 0.08, type = 'square', vol = 0.12, slide = 0, delay = 0, bus = null }) {
  const c = ac();
  if (!c || muted) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(g).connect(bus || c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise({ dur = 0.15, vol = 0.08, delay = 0 }) {
  const c = ac();
  if (!c || muted) return;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(g).connect(c.destination);
  src.start(c.currentTime + delay);
}

// ---------- 程序化场景 BGM（标题/战斗/商店三种曲风，全部实时合成） ----------
const SCENES = {
  // 标题：C 大调五声音阶，舒缓
  title: {
    interval: 2200, wave: 'triangle', lead: 0.5,
    scale: [261.63, 293.66, 329.63, 392.0, 440.0, 523.25],
    melody: [[0, 2, 4, 5], [4, 2, 0, 2], [1, 3, 5, 4], [0, 2, 3, 0]],
    bass: [130.81, 98.0, 110.0, 130.81],
  },
  // 战斗：A 小调五声音阶，急促
  battle: {
    interval: 1300, wave: 'square', lead: 0.3,
    scale: [220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25],
    melody: [[0, 2, 3, 5], [4, 3, 2, 0], [5, 4, 2, 3], [0, 1, 2, 4], [3, 5, 4, 2], [0, 2, 3, 0], [4, 2, 1, 0], [2, 0, 1, 2]],
    bass: [110.0, 110.0, 146.83, 130.81, 110.0, 98.0, 110.0, 110.0],
  },
  // 商店：高八度大调，轻快弹跳
  shop: {
    interval: 1700, wave: 'sine', lead: 0.55,
    scale: [523.25, 587.33, 659.26, 784.0, 880.0, 1046.5],
    melody: [[0, 2, 4, 2], [3, 1, 0, 1], [2, 4, 5, 4], [0, 1, 2, 0]],
    bass: [261.63, 196.0, 220.0, 261.63],
  },
  // 结算：静场（胜负音效已足够）
  end: null,
};
let scene = 'title';
let gymKey = 0; // 道馆音色：不同道馆计分 tick 基音偏移

function playBar() {
  if (!bgmOn || muted || musicVol <= 0) return;
  const cfg = SCENES[scene];
  if (!cfg) return;
  const c = ac();
  if (!c) return;
  if (!musicBus) {
    musicBus = c.createGain();
    musicBus.connect(c.destination);
  }
  musicBus.gain.value = musicVol;
  const step = cfg.interval / 4 - 60;
  const notes = cfg.melody[bar % cfg.melody.length];
  notes.forEach((n, i) => {
    tone({ freq: cfg.scale[n % cfg.scale.length], dur: step / 1000 + 0.08, type: cfg.wave, vol: cfg.lead, delay: i * step / 1000, bus: musicBus });
  });
  tone({ freq: cfg.bass[bar % cfg.bass.length], dur: cfg.interval / 1000 * 0.9, type: 'sine', vol: 0.7, bus: musicBus });
  bar++;
}

function startBgm() {
  if (bgmTimer) return;
  if (!SCENES[scene]) return;
  playBar();
  bgmTimer = setInterval(playBar, SCENES[scene].interval);
}

function stopBgm() {
  if (bgmTimer) { clearInterval(bgmTimer); bgmTimer = null; }
}

export const sfx = {
  toggleMute() { muted = !muted; if (muted) stopBgm(); else if (bgmOn) startBgm(); return muted; },
  isMuted() { return muted; },
  setVolumes({ sfx: s = sfxVol, bgm: m = musicVol }) {
    sfxVol = s;
    musicVol = m;
    if (musicBus) musicBus.gain.value = musicVol;
  },
  getVolumes() { return { sfx: sfxVol, bgm: musicVol }; },
  setBgm(on) {
    bgmOn = on;
    if (on && !muted) startBgm(); else stopBgm();
    return bgmOn;
  },
  isBgmOn() { return bgmOn; },
  setBgmScene(s) {
    if (!SCENES.hasOwnProperty(s) || scene === s) return;
    scene = s;
    if (bgmTimer) { stopBgm(); if (bgmOn && !muted) startBgm(); }
  },
  setGymKey(i) { gymKey = Math.max(0, Math.min(8, i | 0)); },
  getBgmScene() { return scene; },
  click() { tone({ freq: 700, dur: 0.04, type: 'triangle', vol: 0.08 * sfxVol }); },
  select() { tone({ freq: 520, dur: 0.05, type: 'triangle', vol: 0.1 * sfxVol }); },
  deselect() { tone({ freq: 380, dur: 0.05, type: 'triangle', vol: 0.08 * sfxVol }); },
  tick(i) { tone({ freq: (440 + gymKey * 28) + i * 45, dur: 0.06, type: 'square', vol: 0.1 * sfxVol }); },
  mult() { tone({ freq: 240, dur: 0.1, type: 'sawtooth', vol: 0.1 * sfxVol, slide: 120 }); },
  total() {
    tone({ freq: 160, dur: 0.25, type: 'sawtooth', vol: 0.14 * sfxVol, slide: -60 });
    noise({ dur: 0.2, vol: 0.1 * sfxVol });
  },
  play() { tone({ freq: 330, dur: 0.07, type: 'square', vol: 0.12 * sfxVol }); tone({ freq: 495, dur: 0.07, delay: 0.07, vol: 0.12 * sfxVol }); },
  discard() { noise({ dur: 0.18, vol: 0.1 * sfxVol }); tone({ freq: 300, dur: 0.1, type: 'triangle', slide: -100, vol: 0.1 * sfxVol }); },
  coin() { tone({ freq: 988, dur: 0.06, type: 'square', vol: 0.12 * sfxVol }); tone({ freq: 1319, dur: 0.12, delay: 0.06, vol: 0.12 * sfxVol }); },
  hurt() { tone({ freq: 110, dur: 0.3, type: 'sawtooth', vol: 0.16 * sfxVol, slide: -40 }); },
  win() { [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.14, delay: i * 0.11, type: 'square', vol: 0.1 * sfxVol })); },
  lose() { [392, 330, 262, 196].forEach((f, i) => tone({ freq: f, dur: 0.2, delay: i * 0.18, type: 'sawtooth', vol: 0.1 * sfxVol })); },
  badge() { [659, 784, 988, 1319].forEach((f, i) => tone({ freq: f, dur: 0.12, delay: i * 0.09, type: 'triangle', vol: 0.12 * sfxVol })); },
  sleep() { tone({ freq: 400, dur: 0.3, type: 'sine', vol: 0.1 * sfxVol, slide: -150 }); },
};
