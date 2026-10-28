// 判牌逻辑单元测试：node tools/test-eval.mjs
import { evaluate } from '../js/engine.js';

const c = (power, type = 'fire') => ({ power, type, uid: power * 10 + power, chipBonus: 0, multBonus: 0 });

let pass = 0, fail = 0;
function check(name, cards, expectKey, expectCount) {
  const r = evaluate(cards);
  const ok = r.key === expectKey && (expectCount === undefined || r.cards.length === expectCount);
  if (ok) { pass++; console.log(`  ✓ ${name} -> ${r.key} (${r.cards.length}张)`); }
  else { fail++; console.error(`  ✗ ${name} 期望 ${expectKey}×${expectCount ?? '?'}，实际 ${r.key}×${r.cards.length}`); }
}

console.log('判牌单元测试：');
check('高牌（单张）', [c(9)], 'highCard', 1);
check('高牌（5张杂牌）', [c(9), c(4, 'water'), c(7, 'grass'), c(2, 'electric'), c(5, 'psychic')], 'highCard', 1);
check('一对', [c(5), c(5, 'water'), c(9, 'grass')], 'pair', 2);
check('两对', [c(5), c(5, 'water'), c(9, 'grass'), c(9, 'electric')], 'twoPair', 4);
check('两对（取最大两对）', [c(2), c(2, 'water'), c(9, 'grass'), c(9, 'electric'), c(5, 'psychic')], 'twoPair', 4);
check('三条', [c(7), c(7, 'water'), c(7, 'grass'), c(2, 'electric')], 'trips', 3);
check('顺子 1-5', [c(1), c(2, 'water'), c(3, 'grass'), c(4, 'electric'), c(5, 'psychic')], 'straight', 5);
check('顺子 6-10', [c(6), c(7, 'water'), c(8, 'grass'), c(9, 'electric'), c(10, 'psychic')], 'straight', 5);
check('非顺子（有断档）', [c(1), c(2, 'water'), c(3, 'grass'), c(5, 'electric'), c(6, 'psychic')], 'highCard', 1);
check('同花', [c(2), c(5), c(7), c(9), c(10)], 'flush', 5);
check('葫芦', [c(8), c(8, 'water'), c(8, 'grass'), c(3, 'electric'), c(3, 'psychic')], 'fullHouse', 5);
check('四条', [c(6), c(6, 'water'), c(6, 'grass'), c(6, 'electric'), c(1, 'psychic')], 'quads', 4);
check('五连击（同力量跨属性）', [c(4), c(4, 'water'), c(4, 'grass'), c(4, 'electric'), c(4, 'psychic')], 'fiveOfAKind', 5);
check('同花顺', [c(3), c(4), c(5), c(6), c(7)], 'straightFlush', 5);
check('五连击 > 同花顺（同为5张）', [c(9), c(9, 'water'), c(9, 'grass'), c(9, 'electric'), c(9, 'psychic')], 'fiveOfAKind', 5);

console.log(`\n结果：${pass} 通过，${fail} 失败`);
process.exit(fail ? 1 : 0);
