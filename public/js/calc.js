// 偏差値・重み付け・クラス判定の計算ロジック（DOM に依存しない純粋な関数だけ）

import { CLASSES } from './classes.js';
import { MIN_SCOPE_N, RELIABLE_N } from './constants.js';

/** 項目別偏差値の定義。stat は API の集計値のキー */
export const ITEMS = [
  { key: 'wage', label: '時給', stat: 'wage' },
  { key: 'earn', label: '稼ぎ', stat: 'monthly' },
  { key: 'perk', label: '待遇', stat: 'perks' },
];

export const WEIGHT_MIN = 0;
export const WEIGHT_MAX = 10;
export const DEFAULT_WEIGHTS = Object.freeze({ wage: 5, earn: 2, perk: 3 });

export const PRESETS = [
  { id: 'wage', label: '時給重視', weights: { wage: 10, earn: 3, perk: 1 } },
  { id: 'balance', label: 'バランス', weights: { wage: 5, earn: 5, perk: 5 } },
  { id: 'perk', label: '待遇重視', weights: { wage: 2, earn: 2, perk: 10 } },
];

/** 月収見込み = 時給 × 週の勤務時間 × 52 ÷ 12 */
export function monthlyIncome(wage, hoursPerWeek) {
  return (wage * hoursPerWeek * 52) / 12;
}

/** 待遇の数（重複は数えない） */
export function countPerks(perks) {
  return new Set((perks ?? []).filter(Boolean)).size;
}

/** 小数第1位に丸める（-0 は 0 にそろえる） */
export function round1(x) {
  if (x == null || !Number.isFinite(x)) return null;
  const r = Math.round(x * 10) / 10;
  return Object.is(r, -0) ? 0 : r;
}

/**
 * 偏差値 = 50 + 10 × (値 − 平均) ÷ 母標準偏差
 * - 集計がない・1件以下 → null（計算できない）
 * - 標準偏差が 0（全員同じ値）→ ばらつきがなく差を測れないので 50 とする
 * @param {number} value
 * @param {{n:number, mean:number, sd:number}|null|undefined} stat
 */
export function deviation(value, stat) {
  if (!stat || !Number.isFinite(value)) return null;
  const { n, mean, sd } = stat;
  if (!(n > 1) || !Number.isFinite(mean) || !Number.isFinite(sd)) return null;
  if (sd <= 1e-9) return 50;
  return 50 + (10 * (value - mean)) / sd;
}

/** 比較範囲（全国・業種・都道府県）の状態 */
export function scopeStatus(scope) {
  const n = scope?.n ?? 0;
  if (n < MIN_SCOPE_N) return { ok: false, n, reason: 'insufficient' };
  return { ok: true, n };
}

/** 入力値を項目ごとの値に変換 */
export function itemValues(input) {
  return {
    wage: input.wage,
    earn: monthlyIncome(input.wage, input.hours),
    perk: countPerks(input.perks),
  };
}

/**
 * 項目別偏差値（丸める前の値）。範囲のデータが不足なら null
 * @returns {{wage:number|null, earn:number|null, perk:number|null}|null}
 */
export function itemDeviations(input, scope) {
  if (!scopeStatus(scope).ok) return null;
  const v = itemValues(input);
  const out = {};
  for (const item of ITEMS) {
    const st = scope[item.stat];
    out[item.key] = deviation(v[item.key], st ? { n: scope.n, ...st } : null);
  }
  return out;
}

/** 重みを 0〜10 の整数にそろえる。不正な値は初期値に戻す */
export function normalizeWeights(w) {
  const out = {};
  for (const item of ITEMS) {
    const raw = Number(w?.[item.key]);
    out[item.key] = Number.isFinite(raw)
      ? Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, Math.round(raw)))
      : DEFAULT_WEIGHTS[item.key];
  }
  return out;
}

export function weightSum(weights) {
  return ITEMS.reduce((s, item) => s + (weights[item.key] ?? 0), 0);
}

/**
 * 総合偏差値 = 項目別偏差値の加重平均
 * - 重みがすべて 0 → null
 * - 重みが 0 より大きい項目の偏差値が出ていない → null
 */
export function weightedTotal(devs, weights) {
  if (!devs) return null;
  const w = normalizeWeights(weights);
  const total = weightSum(w);
  if (total <= 0) return null;
  let acc = 0;
  for (const item of ITEMS) {
    if (w[item.key] === 0) continue;
    const d = devs[item.key];
    if (d == null || !Number.isFinite(d)) return null;
    acc += d * w[item.key];
  }
  return acc / total;
}

/** 重みに一致するプリセット（なければ null） */
export function matchPreset(weights) {
  const w = normalizeWeights(weights);
  return PRESETS.find((p) => ITEMS.every((i) => p.weights[i.key] === w[i.key])) ?? null;
}

/** シェア文などに使う重みの説明（例：「時給重視の設定」「時給5・稼ぎ2・待遇3の設定」） */
export function weightsLabel(weights) {
  const p = matchPreset(weights);
  if (p) return `${p.label}の設定`;
  const w = normalizeWeights(weights);
  return ITEMS.map((i) => `${i.label}${w[i.key]}`).join('・') + 'の設定';
}

/**
 * 総合偏差値からクラスを判定する。判定は表示と同じ「小数第1位に丸めた値」で行う
 * @returns {{cls:object, rank:number, next:object|null, diff:number|null}|null}
 *   rank は 0 が最上位。diff は次のクラスまでの差（最上位なら null）
 */
export function classify(score, classes = CLASSES) {
  const s = round1(score);
  if (s == null) return null;
  const rank = classes.findIndex((c) => c.min == null || s >= c.min);
  const idx = rank === -1 ? classes.length - 1 : rank;
  const next = idx > 0 ? classes[idx - 1] : null;
  return {
    cls: classes[idx],
    rank: idx,
    next,
    diff: next ? round1(next.min - s) : null,
  };
}

/** クラスの偏差値範囲の表示用テキスト（例：「60〜64.9」「70以上」「35未満」） */
export function classRangeLabel(classes, index) {
  const c = classes[index];
  const upper = index > 0 ? classes[index - 1].min : null;
  if (c.min == null) return `${upper}未満`;
  if (upper == null) return `${c.min}以上`;
  return `${c.min}〜${round1(upper - 0.1)}`;
}

/** 次のクラスまでのメッセージ */
export function nextClassMessage(result) {
  if (!result) return '';
  if (!result.next) return '頂点に到達！';
  return `あと${result.diff.toFixed(1)}で ${result.next.name} に転職！`;
}

/**
 * 1つの比較範囲についてまとめて計算する
 * @returns {{ok:boolean, n:number, items:object|null, total:number|null, klass:object|null}}
 *   items / total は小数第1位に丸めた値
 */
export function evaluateScope(input, scope, weights) {
  const st = scopeStatus(scope);
  if (!st.ok) return { ok: false, n: st.n, items: null, total: null, klass: null };
  const devs = itemDeviations(input, scope);
  const items = {};
  for (const item of ITEMS) items[item.key] = round1(devs[item.key]);
  const raw = weightedTotal(devs, weights);
  const total = round1(raw);
  return { ok: true, n: st.n, items, total, klass: total == null ? null : classify(total) };
}

/** 全国のデータがまだ少ないか（「参考値」表示用） */
export function isProvisional(nationalN) {
  return (nationalN ?? 0) < RELIABLE_N;
}

/** X に投稿する文 */
export function shareText(total, klass, weights) {
  return `${weightsLabel(weights)}で、私のバイト偏差値は${total.toFixed(1)}【${klass.cls.name}】でした #バイト偏差値`;
}

/** ヒストグラムのどの区間に入るか（見つからなければ -1） */
export function histogramBinIndex(bins, wage) {
  return bins.findIndex((b) => wage >= b.from && (b.to == null || wage < b.to));
}
