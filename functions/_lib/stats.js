// D1 から集計値（件数・平均・母標準偏差・ヒストグラム）を作る。生データは返さない

import { MIN_SCOPE_N } from '../../public/js/constants.js';

// 外れ値除外：全体の件数が OUTLIER_MIN_N 以上になったら、
// 時給・月収見込みのどちらかが平均から OUTLIER_Z 標準偏差より離れた投稿を集計から外す。
// 個別に外したい投稿は posts.excluded = 1 にする（README 参照）
export const OUTLIER_Z = 4;
export const OUTLIER_MIN_N = 30;

// 時給ヒストグラム：800 円から 100 円刻み、HIST_TOP 円以上は1つにまとめる
export const HIST_FROM = 800;
export const HIST_STEP = 100;
export const HIST_TOP = 3000;

const MONTHLY = '(wage * hours * 52.0 / 12.0)';
const PERK_COUNT = '(perk_transport + perk_training + perk_meal + perk_raise + perk_flexible)';

/** AVG(x) と AVG(x²) から母標準偏差を出す（誤差で負にならないよう 0 で止める） */
export function popSd(mean, meanSq) {
  if (mean == null || meanSq == null) return null;
  return Math.sqrt(Math.max(0, meanSq - mean * mean));
}

/** 外れ値の範囲。データが少ないうちは範囲なし（null） */
export function outlierBounds(row, z = OUTLIER_Z, minN = OUTLIER_MIN_N) {
  if (!row || row.n < minN) return null;
  const wSd = popSd(row.wm, row.wq);
  const mSd = popSd(row.mm, row.mq);
  if (!(wSd > 0) || !(mSd > 0)) return null;
  return {
    wageMin: row.wm - z * wSd,
    wageMax: row.wm + z * wSd,
    monthlyMin: row.mm - z * mSd,
    monthlyMax: row.mm + z * mSd,
  };
}

const r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);

/** 集計行 → API で返す範囲の集計値。件数が少ない範囲は件数だけ返す */
export function rowToScope(row, minN = MIN_SCOPE_N) {
  const n = row?.n ?? 0;
  if (n < minN) return { n };
  return {
    n,
    wage: { mean: r2(row.wm), sd: r2(popSd(row.wm, row.wq)) },
    monthly: { mean: r2(row.mm), sd: r2(popSd(row.mm, row.mq)) },
    perks: { mean: r2(row.pm), sd: r2(popSd(row.pm, row.pq)) },
  };
}

/** 区間ごとの件数 → すべての区間をそろえたヒストグラム */
export function buildHistogram(rows) {
  const counts = new Map(rows.map((r) => [r.b, r.c]));
  const bins = [];
  for (let from = HIST_FROM; from < HIST_TOP; from += HIST_STEP) {
    bins.push({ from, to: from + HIST_STEP, count: counts.get(from) ?? 0 });
  }
  bins.push({ from: HIST_TOP, to: null, count: counts.get(HIST_TOP) ?? 0 });
  return bins;
}

const AGG_COLS = `COUNT(*) AS n,
  AVG(wage) AS wm, AVG(wage * wage) AS wq,
  AVG(${MONTHLY}) AS mm, AVG(${MONTHLY} * ${MONTHLY}) AS mq,
  AVG(${PERK_COUNT}) AS pm, AVG(${PERK_COUNT} * ${PERK_COUNT}) AS pq`;

/**
 * @param {D1Database} db
 * @returns 全国・業種別・都道府県別の集計値と時給ヒストグラム
 */
export async function getStats(db) {
  const base = await db.prepare(`SELECT ${AGG_COLS} FROM posts WHERE excluded = 0`).first();
  const bounds = outlierBounds(base);

  let where = 'excluded = 0';
  let params = [];
  if (bounds) {
    where += ` AND wage BETWEEN ? AND ? AND ${MONTHLY} BETWEEN ? AND ?`;
    params = [bounds.wageMin, bounds.wageMax, bounds.monthlyMin, bounds.monthlyMax];
  }
  const q = (sql) => db.prepare(sql).bind(...params);

  const [total, byIndustry, byPref, hist, all] = await db.batch([
    q(`SELECT ${AGG_COLS} FROM posts WHERE ${where}`),
    q(`SELECT industry AS k, ${AGG_COLS} FROM posts WHERE ${where} GROUP BY industry`),
    q(`SELECT pref AS k, ${AGG_COLS} FROM posts WHERE ${where} GROUP BY pref`),
    q(`SELECT CASE WHEN wage >= ${HIST_TOP} THEN ${HIST_TOP}
         ELSE ${HIST_FROM} + ((wage - ${HIST_FROM}) / ${HIST_STEP}) * ${HIST_STEP} END AS b,
         COUNT(*) AS c FROM posts WHERE ${where} GROUP BY b`),
    db.prepare('SELECT COUNT(*) AS n FROM posts'),
  ]);

  const group = (rows) => Object.fromEntries(rows.map((r) => [String(r.k), rowToScope(r)]));
  return {
    totalPosts: all.results[0]?.n ?? 0,
    national: rowToScope(total.results[0]),
    industry: group(byIndustry.results),
    pref: group(byPref.results),
    histogram: buildHistogram(hist.results),
    generatedAt: new Date().toISOString(),
  };
}
