// 結果ページ：偏差値・クラス・重みスライダー・分布グラフ

import {
  ITEMS, PRESETS, WEIGHT_MIN, WEIGHT_MAX, evaluateScope, matchPreset, normalizeWeights,
  weightSum, nextClassMessage, isProvisional, shareText, histogramBinIndex,
  monthlyIncome, countPerks,
} from './calc.js';
import { industryLabel, prefName, PERKS } from './constants.js';
import { spriteSvg } from './pixelart.js';
import { loadLast, loadWeights, saveWeights, $, esc, yen, fmt1 } from './common.js';

const last = loadLast();

if (!last?.input || !last?.stats) {
  $('#no-data').classList.remove('hidden');
} else {
  init(last);
}

function init({ input, stats, saved }) {
  $('#result').classList.remove('hidden');

  const nationalN = stats.national?.n ?? 0;
  const scopes = [
    { key: 'national', label: '全国', sub: '', scope: stats.national },
    { key: 'industry', label: '同じ業種', sub: industryLabel(input.industry), scope: stats.industry?.[input.industry] ?? { n: 0 } },
    { key: 'pref', label: '同じ都道府県', sub: prefName(input.pref), scope: stats.pref?.[String(input.pref)] ?? { n: 0 } },
  ];

  let weights = loadWeights();
  let prevRank = null;

  // ---------- 変わらない部分 ----------

  if (isProvisional(nationalN)) {
    const box = $('#provisional');
    box.classList.remove('hidden');
    box.innerHTML = `<strong>データ収集中（現在${nationalN.toLocaleString()}件）</strong><br>まだデータが少ないため、偏差値は<strong>参考値</strong>です。`;
    $('#provisional-pill').innerHTML = ' <span class="pill">参考値</span>';
  }

  const monthly = monthlyIncome(input.wage, input.hours);
  $('#summary').innerHTML = [
    ['時給', yen(input.wage)],
    ['週の勤務', `${input.hours}時間`],
    ['月収見込み', yen(monthly)],
    ['待遇', `${countPerks(input.perks)} / ${PERKS.length}`],
  ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');

  $('#saved-note').textContent = saved
    ? 'この回答は集計に追加されました。ご協力ありがとうございます！'
    : 'この回答は保存していません（計算だけ行いました）。';

  renderHistogram(stats, input.wage);
  buildWeightControls();

  update();

  // ---------- 重みの操作 ----------

  function buildWeightControls() {
    $('#presets').innerHTML = PRESETS.map(
      (p) => `<button type="button" class="btn" data-preset="${p.id}" aria-pressed="false">${esc(p.label)}</button>`,
    ).join('');
    $('#presets').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-preset]');
      if (!btn) return;
      weights = { ...PRESETS.find((p) => p.id === btn.dataset.preset).weights };
      syncSliders();
      update();
    });

    $('#sliders').innerHTML = ITEMS.map(
      (it) => `<div class="slider-row">
        <label for="w-${it.key}">${it.label}</label>
        <input type="range" id="w-${it.key}" data-key="${it.key}" min="${WEIGHT_MIN}" max="${WEIGHT_MAX}" step="1">
        <output for="w-${it.key}" id="o-${it.key}"></output>
      </div>`,
    ).join('');
    $('#sliders').addEventListener('input', (e) => {
      const key = e.target.dataset.key;
      if (!key) return;
      weights = normalizeWeights({ ...weights, [key]: e.target.value });
      $(`#o-${key}`).textContent = weights[key];
      update();
    });
    syncSliders();
  }

  function syncSliders() {
    for (const it of ITEMS) {
      $(`#w-${it.key}`).value = weights[it.key];
      $(`#o-${it.key}`).textContent = weights[it.key];
    }
  }

  // ---------- 再計算して表示 ----------

  function update() {
    saveWeights(weights);
    const preset = matchPreset(weights);
    document.querySelectorAll('[data-preset]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.preset === preset?.id));
    });

    const results = scopes.map((s) => ({ ...s, r: evaluateScope(input, s.scope, weights) }));
    const main = results[0].r;

    renderHero(main);
    renderItemBars(main);
    renderScopeTable(results);
    renderShare(main);
  }

  function renderHero(r) {
    const hero = $('#hero');
    const showClass = r.ok && r.klass;
    $('#hero-class').classList.toggle('hidden', !showClass);
    $('#next-class').classList.toggle('hidden', !showClass);
    $('#hero-empty').classList.toggle('hidden', !!showClass);
    $('#score').textContent = r.ok && r.total != null ? fmt1(r.total) : '—';

    if (!r.ok) {
      $('#hero-empty').innerHTML = `<strong>データ不足</strong><p class="muted small">全国のデータが10件未満のため、まだ偏差値を出せません（現在${r.n}件）。</p>`;
      return;
    }
    if (!r.klass) {
      $('#hero-empty').innerHTML = weightSum(weights) === 0
        ? '<strong>重みがすべて0です</strong><p class="muted small">下のスライダーで、少なくとも1つの項目の重みを1以上にしてください。</p>'
        : '<strong>総合偏差値を計算できません</strong>';
      return;
    }

    const { cls, rank } = r.klass;
    if ($('#hero-sprite').dataset.cls !== cls.id) {
      $('#hero-sprite').innerHTML = spriteSvg(cls);
      $('#hero-sprite').dataset.cls = cls.id;
    }
    $('#class-name').textContent = cls.name;
    $('#class-comment').textContent = cls.comment;
    const next = $('#next-class');
    next.textContent = nextClassMessage(r.klass);
    next.classList.toggle('top', !r.klass.next);

    if (prevRank != null && rank < prevRank) {
      hero.classList.remove('levelup');
      void hero.offsetWidth; // アニメーションをやり直す
      hero.classList.add('levelup');
    }
    prevRank = rank;

    const dex = `/classes.html?me=${encodeURIComponent(cls.id)}`;
    $('#dex-link').href = dex;
    $('#nav-dex').href = dex;
  }

  function renderItemBars(r) {
    if (!r.ok) {
      $('#item-bars').innerHTML = '<p class="muted">データ不足</p>';
      return;
    }
    const pct = (d) => Math.min(100, Math.max(0, ((d - 20) / 60) * 100));
    $('#item-bars').innerHTML = ITEMS.map((it) => {
      const d = r.items[it.key];
      return `<div>
        <div class="dev-bar-head"><span>${it.label}偏差値</span><strong>${fmt1(d)}</strong></div>
        <div class="dev-track" role="img" aria-label="${it.label}偏差値 ${fmt1(d)}"><div class="dev-fill" style="width:${pct(d)}%"></div></div>
      </div>`;
    }).join('') + '<div class="dev-scale" aria-hidden="true"><span>20</span><span>50</span><span>80</span></div>';
  }

  function renderScopeTable(results) {
    $('#scope-rows').innerHTML = results.map(({ label, sub, r }) => {
      const head = `<th scope="row">${esc(label)}${sub ? `<span class="scope-sub">${esc(sub)}</span>` : ''}<span class="scope-sub">${r.n.toLocaleString()}件</span></th>`;
      if (!r.ok) return `<tr>${head}<td colspan="4" class="insufficient">データ不足</td></tr>`;
      return `<tr>${head}<td><strong>${fmt1(r.total)}</strong></td>${ITEMS.map((it) => `<td>${fmt1(r.items[it.key])}</td>`).join('')}</tr>`;
    }).join('');
  }

  function renderShare(r) {
    const a = $('#share-x');
    if (!(r.ok && r.klass)) {
      a.classList.add('hidden');
      return;
    }
    a.classList.remove('hidden');
    const text = shareText(r.total, r.klass, weights);
    const url = `${location.origin}/`;
    a.href = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  }
}

// ---------- 時給の分布グラフ（SVG） ----------

function renderHistogram(stats, wage) {
  const bins = stats.histogram ?? [];
  const box = $('#histogram');
  const total = bins.reduce((s, b) => s + b.count, 0);
  if (total === 0) {
    box.innerHTML = '<p class="muted">まだデータがありません。</p>';
    return;
  }
  const W = 340, H = 170, top = 26, bottom = 22, left = 4, right = 4;
  const plotH = H - top - bottom;
  const bw = (W - left - right) / bins.length;
  const max = Math.max(...bins.map((b) => b.count));
  const me = histogramBinIndex(bins, wage);

  const bars = bins.map((b, i) => {
    const h = b.count === 0 ? 0 : Math.max(1.5, (b.count / max) * plotH);
    const x = left + i * bw;
    return `<rect class="bar${i === me ? ' me' : ''}" x="${(x + 0.75).toFixed(2)}" y="${(top + plotH - h).toFixed(2)}" width="${(bw - 1.5).toFixed(2)}" height="${h.toFixed(2)}" rx="1.5"><title>${b.to ? `${b.from}〜${b.to - 1}円` : `${b.from}円以上`}：${b.count}件</title></rect>`;
  }).join('');

  const ticks = bins
    .map((b, i) => ({ b, i }))
    .filter(({ b }) => b.from % 500 === 0 || b.to == null)
    .map(({ b, i }) => {
      const x = left + i * bw + (b.to == null ? bw / 2 : 0);
      const label = b.to == null ? `${b.from}+` : `${b.from}`;
      return `<text class="axis" x="${x.toFixed(1)}" y="${H - 6}" text-anchor="middle">${label}</text>`;
    }).join('');

  let marker = '';
  if (me >= 0) {
    const cx = left + me * bw + bw / 2;
    const anchor = cx < 50 ? 'start' : cx > W - 50 ? 'end' : 'middle';
    marker = `<line class="me-line" x1="${cx.toFixed(1)}" x2="${cx.toFixed(1)}" y1="${top - 6}" y2="${top + plotH}"/>
      <text class="me-label" x="${cx.toFixed(1)}" y="${top - 10}" text-anchor="${anchor}">あなた ${wage.toLocaleString()}円</text>`;
  }

  // 自分より時給が高い人の割合（同じ区間は半分として数える目安）
  let above = 0;
  bins.forEach((b, i) => {
    if (i > me) above += b.count;
    if (i === me) above += b.count / 2;
  });
  const abovePct = Math.round((above / total) * 100);

  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="全国の時給の分布。あなたの時給は${wage}円で、あなたより時給が高い人は約${abovePct}%です">
    <line class="baseline" x1="${left}" x2="${W - right}" y1="${top + plotH + 0.5}" y2="${top + plotH + 0.5}"/>
    ${bars}${marker}${ticks}
  </svg>
  <p class="small muted" style="margin:6px 0 0">横軸は時給（円）。集計対象 ${total.toLocaleString()}件${stats.national?.wage ? `・全国平均 ${yen(stats.national.wage.mean)}` : ''}。あなたより時給が高い人は<strong>約${abovePct}%</strong>。</p>`;
}
