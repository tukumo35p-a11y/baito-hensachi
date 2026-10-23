// トップページ：入力フォーム

import { PREFECTURES, INDUSTRIES, PERKS, LIMITS } from './constants.js';
import { CLASSES } from './classes.js';
import { spriteSvg } from './pixelart.js';
import { api, saveLast, loadLast, $, esc } from './common.js';

const form = $('#entry-form');
const errorBox = $('#form-error');
const submitBtn = $('#submit-btn');
const consent = $('#consent');
const tsBox = $('#turnstile');

let turnstileWidget = null;
let turnstileReady = null; // Promise

// ---------- 画面の組み立て ----------

$('#pref').insertAdjacentHTML(
  'beforeend',
  PREFECTURES.map((name, i) => `<option value="${i + 1}">${esc(name)}</option>`).join(''),
);
$('#industry').insertAdjacentHTML(
  'beforeend',
  INDUSTRIES.map((i) => `<option value="${i.key}">${esc(i.label)}</option>`).join(''),
);
$('#perks').innerHTML = PERKS.map(
  (p) => `<label class="chip"><input type="checkbox" name="perks" value="${p.key}"><span>${esc(p.label)}</span></label>`,
).join('');

const showcase = ['slime', 'warrior', 'legend'].map((id) => CLASSES.find((c) => c.id === id));
$('#intro-sprites').innerHTML = showcase.map((c) => spriteSvg(c, { decorative: true })).join('');

// 前回の入力（同じタブ内）を戻す
const last = loadLast();
if (last?.input) {
  const i = last.input;
  form.pref.value = String(i.pref ?? '');
  form.industry.value = i.industry ?? '';
  form.wage.value = i.wage ?? '';
  form.hours.value = i.hours ?? '';
  for (const cb of form.querySelectorAll('input[name="perks"]')) cb.checked = (i.perks ?? []).includes(cb.value);
  consent.checked = last.consent !== false;
}

// ---------- Turnstile ----------

function loadTurnstile() {
  if (turnstileReady) return turnstileReady;
  turnstileReady = (async () => {
    const { turnstileSiteKey } = await api.config();
    if (!turnstileSiteKey) throw new Error('ボット判定の設定がありません（管理者向け：TURNSTILE_SITE_KEY）');
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error('ボット判定を読み込めませんでした。通信環境を確認してください'));
      document.head.append(s);
    });
    turnstileWidget = window.turnstile.render(tsBox, {
      sitekey: turnstileSiteKey,
      language: 'ja',
      theme: 'auto',
    });
  })();
  turnstileReady.catch(() => {
    turnstileReady = null; // 次の送信時にやり直す
  });
  return turnstileReady;
}

function syncConsent() {
  tsBox.classList.toggle('hidden', !consent.checked);
  if (consent.checked) loadTurnstile().catch((e) => showError(e.message));
}
consent.addEventListener('change', syncConsent);
syncConsent();

// ---------- 入力チェック ----------

function showError(msg) {
  errorBox.textContent = msg;
}

function clearFieldErrors() {
  form.querySelectorAll('.field-error').forEach((el) => el.remove());
  form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
}

function fieldError(el, msg) {
  el.setAttribute('aria-invalid', 'true');
  const p = document.createElement('p');
  p.className = 'field-error';
  p.id = `${el.id}-error`;
  p.textContent = msg;
  el.setAttribute('aria-describedby', p.id);
  el.closest('.form-field').append(p);
}

function readForm() {
  const intOrNaN = (v) => (/^\d+$/.test(v.trim()) ? Number(v.trim()) : NaN);
  return {
    pref: Number(form.pref.value),
    industry: form.industry.value,
    wage: intOrNaN(form.wage.value),
    hours: intOrNaN(form.hours.value),
    perks: [...form.querySelectorAll('input[name="perks"]:checked')].map((cb) => cb.value),
  };
}

function validate(input) {
  clearFieldErrors();
  const errs = [];
  if (!input.pref) errs.push([form.pref, '都道府県を選んでください']);
  if (!input.industry) errs.push([form.industry, '業種を選んでください']);
  if (!(input.wage >= LIMITS.wage.min && input.wage <= LIMITS.wage.max)) {
    errs.push([form.wage, `時給は${LIMITS.wage.min}〜${LIMITS.wage.max.toLocaleString()}円の整数で入力してください`]);
  }
  if (!(input.hours >= LIMITS.hours.min && input.hours <= LIMITS.hours.max)) {
    errs.push([form.hours, `週の勤務時間は${LIMITS.hours.min}〜${LIMITS.hours.max}時間の整数で入力してください`]);
  }
  errs.forEach(([el, msg]) => fieldError(el, msg));
  if (errs.length) errs[0][0].focus();
  return errs.length === 0;
}

// ---------- 送信 ----------

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  showError('');
  const input = readForm();
  if (!validate(input)) return;

  submitBtn.disabled = true;
  submitBtn.textContent = '診断中…';
  try {
    let stats;
    let saved = false;
    if (consent.checked) {
      await loadTurnstile();
      const token = window.turnstile?.getResponse(turnstileWidget);
      if (!token) throw new Error('ボット判定が終わるまで少し待ってから、もう一度押してください');
      try {
        const res = await api.post({ ...input, turnstileToken: token });
        stats = res.stats;
        saved = true;
      } finally {
        window.turnstile?.reset(turnstileWidget); // トークンは1回しか使えない
      }
    } else {
      stats = await api.stats();
    }
    saveLast({ input, stats, saved, consent: consent.checked, at: Date.now() });
    location.href = '/result.html';
  } catch (err) {
    let msg = err.message;
    if (err.code === 'rate_limit') msg += '（「集計に使ってよい」をオフにすれば、保存せずに診断できます）';
    showError(msg);
    submitBtn.disabled = false;
    submitBtn.textContent = '偏差値を診断する';
  }
});

// 戻るボタンでこのページに戻ったとき、ボタンを元に戻す
window.addEventListener('pageshow', () => {
  submitBtn.disabled = false;
  submitBtn.textContent = '偏差値を診断する';
});
