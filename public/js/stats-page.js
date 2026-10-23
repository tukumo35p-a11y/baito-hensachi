// 全国データ：総投稿数・業種別ランキング・都道府県別の平均時給

import { INDUSTRIES, PREFECTURES, MIN_SCOPE_N } from './constants.js';
import { isProvisional } from './calc.js';
import { api, $, esc, yen } from './common.js';

let prefSort = 'code';
let data = null;

function rankList(rows, maxWage) {
  return rows.map((r, i) => {
    const ok = r.scope?.wage && r.scope.n >= MIN_SCOPE_N;
    const pct = ok ? Math.max(2, (r.scope.wage.mean / maxWage) * 100) : 0;
    return `<li class="${ok ? '' : 'na'}">
      <span class="rank-no">${r.no ?? i + 1}</span>
      <span class="rank-name">${esc(r.label)}</span>
      <span class="rank-bar" aria-hidden="true"><i style="width:${pct.toFixed(1)}%"></i></span>
      <span class="rank-val">${ok ? yen(r.scope.wage.mean) : `データ不足<br>(${r.scope?.n ?? 0}件)`}</span>
    </li>`;
  }).join('');
}

// 平均時給の高い順。データ不足は後ろに回す
function byWage(a, b) {
  const wa = a.scope?.wage?.mean ?? -1;
  const wb = b.scope?.wage?.mean ?? -1;
  return wb - wa;
}

function render() {
  const s = data;
  const n = s.national?.n ?? 0;
  const overview = [
    ['総投稿数', `${s.totalPosts.toLocaleString()}件`],
    ['集計対象', `${n.toLocaleString()}件`],
    ['全国平均時給', s.national?.wage ? yen(s.national.wage.mean) : 'データ不足'],
  ];
  $('#overview').innerHTML = overview.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  if (isProvisional(n)) {
    const box = $('#stats-error');
    box.textContent = `データ収集中（現在${n}件）。件数が少ないうちは値が大きく変わることがあります。`;
    box.classList.remove('hidden');
  }

  const ind = INDUSTRIES.map((i) => ({ label: i.label, scope: s.industry?.[i.key] ?? { n: 0 } })).sort(byWage);
  const pref = PREFECTURES.map((name, i) => ({ label: name, scope: s.pref?.[String(i + 1)] ?? { n: 0 } }));
  const all = [...ind, ...pref].map((r) => r.scope?.wage?.mean ?? 0);
  const maxWage = Math.max(1, ...all);

  // データ不足には順位を付けない
  ind.forEach((r, i) => { r.no = r.scope?.wage ? i + 1 : '–'; });
  $('#industry-rank').innerHTML = rankList(ind, maxWage);

  let prefRows = pref;
  if (prefSort === 'wage') {
    prefRows = [...pref].sort(byWage);
    prefRows.forEach((r, i) => { r.no = r.scope?.wage ? i + 1 : '–'; });
  } else {
    prefRows.forEach((r, i) => { r.no = i + 1; });
  }
  $('#pref-rank').innerHTML = rankList(prefRows, maxWage);
}

document.querySelector('.tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-sort]');
  if (!btn || !data) return;
  prefSort = btn.dataset.sort;
  document.querySelectorAll('.tabs [data-sort]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
  render();
});

try {
  data = await api.stats();
  render();
} catch (e) {
  const box = $('#stats-error');
  box.textContent = e.message;
  box.classList.remove('hidden');
  $('#overview').innerHTML = '<div><dt>読み込めませんでした</dt><dd>—</dd></div>';
}
