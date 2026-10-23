import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validatePost } from '../functions/_lib/validate.js';
import { hashIp, jstDay } from '../functions/_lib/security.js';
import { popSd, outlierBounds, rowToScope, buildHistogram, HIST_TOP } from '../functions/_lib/stats.js';

const good = { pref: 13, industry: 'food_hall', wage: 1200, hours: 15, perks: ['transport', 'meal'] };

describe('入力チェック', () => {
  test('正しい入力', () => {
    const r = validatePost(good);
    assert.equal(r.ok, true);
    assert.deepEqual(r.value.perks, { transport: 1, training: 0, meal: 1, raise: 0, flexible: 0 });
  });

  test('時給の範囲（800〜10000 の整数）', () => {
    assert.equal(validatePost({ ...good, wage: 800 }).ok, true);
    assert.equal(validatePost({ ...good, wage: 10000 }).ok, true);
    assert.equal(validatePost({ ...good, wage: 799 }).ok, false);
    assert.equal(validatePost({ ...good, wage: 10001 }).ok, false);
    assert.equal(validatePost({ ...good, wage: 1200.5 }).ok, false);
    assert.equal(validatePost({ ...good, wage: '1200' }).ok, true);
    assert.equal(validatePost({ ...good, wage: '1e3' }).ok, false);
    assert.equal(validatePost({ ...good, wage: null }).ok, false);
  });

  test('週の勤務時間（1〜60）', () => {
    assert.equal(validatePost({ ...good, hours: 0 }).ok, false);
    assert.equal(validatePost({ ...good, hours: 1 }).ok, true);
    assert.equal(validatePost({ ...good, hours: 60 }).ok, true);
    assert.equal(validatePost({ ...good, hours: 61 }).ok, false);
  });

  test('都道府県・業種・待遇', () => {
    assert.equal(validatePost({ ...good, pref: 0 }).ok, false);
    assert.equal(validatePost({ ...good, pref: 48 }).ok, false);
    assert.equal(validatePost({ ...good, industry: 'ninja' }).ok, false);
    assert.equal(validatePost({ ...good, perks: ['bonus'] }).ok, false);
    assert.equal(validatePost({ ...good, perks: 'transport' }).ok, false);
    assert.equal(validatePost({ ...good, perks: undefined }).ok, true);
  });

  test('オブジェクト以外は拒否', () => {
    assert.equal(validatePost(null).ok, false);
    assert.equal(validatePost([1, 2]).ok, false);
    assert.equal(validatePost('x').ok, false);
  });
});

describe('IP ハッシュと日付', () => {
  test('ソルトで結果が変わり、生の IP を含まない', async () => {
    const a = await hashIp('203.0.113.5', 'salt-a');
    const b = await hashIp('203.0.113.5', 'salt-b');
    assert.match(a, /^[0-9a-f]{64}$/);
    assert.notEqual(a, b);
    assert.ok(!a.includes('203'));
    assert.equal(a, await hashIp('203.0.113.5', 'salt-a'));
  });

  test('日本時間で日付が変わる', () => {
    assert.equal(jstDay(new Date('2026-01-01T14:59:59Z')), '2026-01-01');
    assert.equal(jstDay(new Date('2026-01-01T15:00:00Z')), '2026-01-02');
  });
});

describe('集計', () => {
  test('母標準偏差', () => {
    // 値 2, 4, 4, 4, 5, 5, 7, 9 → 平均 5, 母標準偏差 2
    assert.equal(popSd(5, 29), 2);
    assert.equal(popSd(5, 24.999999), 0); // 誤差で負になっても 0
    assert.equal(popSd(null, 1), null);
  });

  test('10件未満は件数だけ返す', () => {
    assert.deepEqual(rowToScope({ n: 9, wm: 1000, wq: 1000000 }), { n: 9 });
    assert.deepEqual(rowToScope(undefined), { n: 0 });
    const s = rowToScope({ n: 10, wm: 1000, wq: 1010000, mm: 50000, mq: 2600000000, pm: 2, pq: 5 });
    assert.deepEqual(s.wage, { mean: 1000, sd: 100 });
    assert.deepEqual(s.monthly, { mean: 50000, sd: 10000 });
    assert.deepEqual(s.perks, { mean: 2, sd: 1 });
  });

  test('外れ値の範囲は30件以上になってから', () => {
    const row = { n: 29, wm: 1000, wq: 1010000, mm: 50000, mq: 2600000000 };
    assert.equal(outlierBounds(row), null);
    const b = outlierBounds({ ...row, n: 30 });
    assert.equal(b.wageMin, 600);
    assert.equal(b.wageMax, 1400);
    assert.equal(b.monthlyMax, 90000);
    assert.equal(outlierBounds({ ...row, n: 30, wq: 1000000 }), null); // 標準偏差 0
  });

  test('ヒストグラムは空の区間も含めて返す', () => {
    const bins = buildHistogram([{ b: 1000, c: 3 }, { b: HIST_TOP, c: 2 }]);
    assert.equal(bins[0].from, 800);
    assert.equal(bins.find((x) => x.from === 1000).count, 3);
    assert.equal(bins.find((x) => x.from === 900).count, 0);
    assert.deepEqual(bins.at(-1), { from: HIST_TOP, to: null, count: 2 });
  });
});
