import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  monthlyIncome, countPerks, round1, deviation, scopeStatus, itemDeviations,
  normalizeWeights, weightedTotal, matchPreset, weightsLabel, classify,
  classRangeLabel, nextClassMessage, evaluateScope, isProvisional, shareText,
  histogramBinIndex, DEFAULT_WEIGHTS, PRESETS,
} from '../public/js/calc.js';
import { CLASSES } from '../public/js/classes.js';

const scope = (n, wage, monthly, perks) => ({ n, wage, monthly, perks });

describe('基本の計算', () => {
  test('月収見込み = 時給 × 週時間 × 52 ÷ 12', () => {
    assert.equal(monthlyIncome(1200, 15), 78000);
    assert.equal(monthlyIncome(1000, 1), 1000 * 52 / 12);
  });

  test('待遇の数は重複を数えない', () => {
    assert.equal(countPerks([]), 0);
    assert.equal(countPerks(undefined), 0);
    assert.equal(countPerks(['transport', 'meal', 'transport']), 2);
  });

  test('小数第1位に丸める', () => {
    assert.equal(round1(62.34), 62.3);
    assert.equal(round1(62.36), 62.4);
    assert.equal(round1(-0.04), 0);
    assert.equal(round1(NaN), null);
    assert.equal(round1(null), null);
  });
});

describe('偏差値', () => {
  test('平均と同じなら 50、1σ 上なら 60', () => {
    const st = { n: 100, mean: 1200, sd: 200 };
    assert.equal(deviation(1200, st), 50);
    assert.equal(deviation(1400, st), 60);
    assert.equal(deviation(900, st), 35);
  });

  test('標準偏差 0 のときは 50', () => {
    assert.equal(deviation(1200, { n: 20, mean: 1200, sd: 0 }), 50);
    assert.equal(deviation(1500, { n: 20, mean: 1200, sd: 0 }), 50);
  });

  test('データ1件以下・集計なしは null', () => {
    assert.equal(deviation(1200, { n: 1, mean: 1200, sd: 0 }), null);
    assert.equal(deviation(1200, { n: 0, mean: null, sd: null }), null);
    assert.equal(deviation(1200, null), null);
    assert.equal(deviation(1200, undefined), null);
    assert.equal(deviation(NaN, { n: 10, mean: 1, sd: 1 }), null);
  });

  test('10件未満の範囲はデータ不足', () => {
    assert.deepEqual(scopeStatus({ n: 9 }), { ok: false, n: 9, reason: 'insufficient' });
    assert.deepEqual(scopeStatus(undefined), { ok: false, n: 0, reason: 'insufficient' });
    assert.equal(scopeStatus({ n: 10 }).ok, true);
  });

  test('項目別偏差値', () => {
    const s = scope(50, { mean: 1000, sd: 100 }, { mean: 60000, sd: 20000 }, { mean: 2, sd: 1 });
    const d = itemDeviations({ wage: 1100, hours: 15, perks: ['transport', 'meal', 'raise'] }, s);
    assert.equal(d.wage, 60);
    assert.equal(round1(d.earn), round1(50 + 10 * (monthlyIncome(1100, 15) - 60000) / 20000));
    assert.equal(d.perk, 60);
    assert.equal(itemDeviations({ wage: 1100, hours: 15, perks: [] }, { n: 3 }), null);
  });
});

describe('重み付け', () => {
  test('加重平均', () => {
    const devs = { wage: 60, earn: 40, perk: 50 };
    assert.equal(weightedTotal(devs, { wage: 5, earn: 2, perk: 3 }), (300 + 80 + 150) / 10);
    assert.equal(weightedTotal(devs, { wage: 1, earn: 0, perk: 0 }), 60);
    assert.equal(weightedTotal(devs, { wage: 10, earn: 10, perk: 10 }), 50);
  });

  test('重みがすべて 0 なら null', () => {
    assert.equal(weightedTotal({ wage: 60, earn: 40, perk: 50 }, { wage: 0, earn: 0, perk: 0 }), null);
  });

  test('重みのある項目が計算できなければ null、重み 0 の項目は無視', () => {
    const devs = { wage: 60, earn: null, perk: 50 };
    assert.equal(weightedTotal(devs, { wage: 1, earn: 1, perk: 1 }), null);
    assert.equal(weightedTotal(devs, { wage: 1, earn: 0, perk: 1 }), 55);
    assert.equal(weightedTotal(null, DEFAULT_WEIGHTS), null);
  });

  test('重みは 0〜10 の整数にそろえ、不正値は初期値', () => {
    assert.deepEqual(normalizeWeights({ wage: 12, earn: -3, perk: 2.6 }), { wage: 10, earn: 0, perk: 3 });
    assert.deepEqual(normalizeWeights({ wage: 'x' }), { ...DEFAULT_WEIGHTS });
    assert.deepEqual(normalizeWeights(null), { ...DEFAULT_WEIGHTS });
    assert.deepEqual(normalizeWeights({ wage: '7', earn: '0', perk: 1 }), { wage: 7, earn: 0, perk: 1 });
  });

  test('初期値は 時給5：稼ぎ2：待遇3', () => {
    assert.deepEqual({ ...DEFAULT_WEIGHTS }, { wage: 5, earn: 2, perk: 3 });
  });

  test('プリセットの判定と説明文', () => {
    assert.equal(PRESETS.length, 3);
    assert.equal(matchPreset(PRESETS[0].weights).label, '時給重視');
    assert.equal(matchPreset({ wage: 1, earn: 1, perk: 1 }), null);
    assert.equal(weightsLabel(PRESETS[2].weights), '待遇重視の設定');
    assert.equal(weightsLabel(DEFAULT_WEIGHTS), '時給5・稼ぎ2・待遇3の設定');
  });
});

describe('クラス判定', () => {
  const cases = [
    [80, '伝説の勇者'], [70, '伝説の勇者'], [69.9, '勇者'], [65, '勇者'],
    [64.9, '賢者'], [60, '賢者'], [59.9, '魔法戦士'], [55, '魔法戦士'],
    [54.9, '戦士'], [50, '戦士'], [49.9, '商人'], [45, '商人'],
    [44.9, '見習い冒険者'], [40, '見習い冒険者'], [39.9, '村人'], [35, '村人'],
    [34.9, 'スライム'], [10, 'スライム'], [-20, 'スライム'],
  ];
  for (const [score, name] of cases) {
    test(`${score} → ${name}`, () => assert.equal(classify(score).cls.name, name));
  }

  test('表示と同じ丸めた値で判定する（69.96 は 70.0 なので伝説の勇者）', () => {
    assert.equal(classify(69.96).cls.name, '伝説の勇者');
    assert.equal(classify(69.94).cls.name, '勇者');
  });

  test('次のクラスまでの差', () => {
    const r = classify(58.2);
    assert.equal(r.next.name, '賢者');
    assert.equal(r.diff, 1.8);
    assert.equal(nextClassMessage(r), 'あと1.8で 賢者 に転職！');
    assert.equal(classify(34.96).cls.name, '村人'); // 35.0 に丸まる
    assert.equal(classify(34.94).diff, 0.1);
  });

  test('最上位は「頂点に到達！」', () => {
    const r = classify(75);
    assert.equal(r.next, null);
    assert.equal(r.diff, null);
    assert.equal(nextClassMessage(r), '頂点に到達！');
  });

  test('null や NaN はクラスなし', () => {
    assert.equal(classify(null), null);
    assert.equal(classify(NaN), null);
    assert.equal(nextClassMessage(null), '');
  });

  test('rank は上位ほど小さい', () => {
    assert.equal(classify(71).rank, 0);
    assert.equal(classify(20).rank, CLASSES.length - 1);
    assert.ok(classify(61).rank < classify(51).rank);
  });

  test('範囲の表示', () => {
    assert.equal(classRangeLabel(CLASSES, 0), '70以上');
    assert.equal(classRangeLabel(CLASSES, 2), '60〜64.9');
    assert.equal(classRangeLabel(CLASSES, CLASSES.length - 1), '35未満');
  });
});

describe('範囲ごとの評価', () => {
  const s = scope(40, { mean: 1000, sd: 100 }, { mean: 60000, sd: 20000 }, { mean: 2, sd: 1 });
  const input = { wage: 1150, hours: 10, perks: ['transport', 'meal', 'raise', 'flexible'] };

  test('丸めた項目別偏差値・総合偏差値・クラス', () => {
    const r = evaluateScope(input, s, { wage: 1, earn: 0, perk: 1 });
    assert.equal(r.ok, true);
    assert.equal(r.items.wage, 65);
    assert.equal(r.items.perk, 70);
    assert.equal(r.total, 67.5);
    assert.equal(r.klass.cls.name, '勇者');
  });

  test('重みがすべて 0 ならクラスなし', () => {
    const r = evaluateScope(input, s, { wage: 0, earn: 0, perk: 0 });
    assert.equal(r.ok, true);
    assert.equal(r.total, null);
    assert.equal(r.klass, null);
  });

  test('データ不足ならクラスなし', () => {
    const r = evaluateScope(input, { n: 5 }, DEFAULT_WEIGHTS);
    assert.deepEqual(r, { ok: false, n: 5, items: null, total: null, klass: null });
  });

  test('全員同じ値（標準偏差 0）でも壊れない', () => {
    const flat = scope(12, { mean: 1000, sd: 0 }, { mean: 40000, sd: 0 }, { mean: 1, sd: 0 });
    const r = evaluateScope({ wage: 1000, hours: 9, perks: ['meal'] }, flat, DEFAULT_WEIGHTS);
    assert.equal(r.total, 50);
    assert.equal(r.klass.cls.name, '戦士');
  });

  test('30件未満は参考値', () => {
    assert.equal(isProvisional(29), true);
    assert.equal(isProvisional(30), false);
    assert.equal(isProvisional(undefined), true);
  });
});

describe('表示用', () => {
  test('シェア文', () => {
    const k = classify(62.3);
    assert.equal(
      shareText(62.3, k, PRESETS[0].weights),
      '時給重視の設定で、私のバイト偏差値は62.3【賢者】でした #バイト偏差値',
    );
    assert.equal(shareText(50, classify(50), DEFAULT_WEIGHTS).startsWith('時給5・稼ぎ2・待遇3の設定で、'), true);
  });

  test('ヒストグラムの区間', () => {
    const bins = [{ from: 800, to: 900 }, { from: 900, to: 1000 }, { from: 1000, to: null }];
    assert.equal(histogramBinIndex(bins, 800), 0);
    assert.equal(histogramBinIndex(bins, 899), 0);
    assert.equal(histogramBinIndex(bins, 900), 1);
    assert.equal(histogramBinIndex(bins, 5000), 2);
    assert.equal(histogramBinIndex(bins, 700), -1);
  });
});
