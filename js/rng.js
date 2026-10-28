// 可序列化的种子随机数（mulberry32），状态是单个 uint32，方便存档
export function makeRng(seed) {
  const state = { s: seed >>> 0 };
  return state;
}

export function rngNext(state) {
  state.s = (state.s + 0x6D2B79F5) | 0;
  let t = state.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function rngInt(state, n) {
  return Math.floor(rngNext(state) * n);
}

export function rngPick(state, arr) {
  return arr[rngInt(state, arr.length)];
}

export function shuffle(state, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rngInt(state, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function makeSeed() {
  return (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
}
