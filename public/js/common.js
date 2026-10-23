// ページ共通：API 呼び出し・ブラウザ保存・表示用の小物

import { DEFAULT_WEIGHTS, normalizeWeights } from './calc.js';

// ---------- API ----------

async function request(path, init) {
  let res;
  try {
    res = await fetch(path, init);
  } catch {
    throw Object.assign(new Error('通信に失敗しました。電波の良いところでもう一度お試しください'), { status: 0 });
  }
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* JSON でない応答 */
  }
  if (!res.ok) {
    throw Object.assign(new Error(body?.error ?? `エラーが発生しました（${res.status}）`), {
      status: res.status,
      code: body?.code,
    });
  }
  return body;
}

export const api = {
  config: () => request('/api/config'),
  stats: () => request('/api/stats'),
  post: (payload) =>
    request('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
};

// ---------- ブラウザ保存（失敗しても動くように） ----------

const KEY_LAST = 'baito-hensachi:last';
const KEY_WEIGHTS = 'baito-hensachi:weights';

function read(storage, key) {
  try {
    const v = window[storage].getItem(key);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}
function write(storage, key, value) {
  try {
    window[storage].setItem(key, JSON.stringify(value));
  } catch {
    /* プライベートモードなど */
  }
}

/** 直近の診断（入力と集計値）。タブを閉じると消える */
export const loadLast = () => read('sessionStorage', KEY_LAST);
export const saveLast = (v) => write('sessionStorage', KEY_LAST, v);

/** 重みは次に開いたときも使う */
export const loadWeights = () => {
  const w = read('localStorage', KEY_WEIGHTS);
  return w ? normalizeWeights(w) : { ...DEFAULT_WEIGHTS };
};
export const saveWeights = (w) => write('localStorage', KEY_WEIGHTS, normalizeWeights(w));

// ---------- 表示 ----------

export const $ = (sel, root = document) => root.querySelector(sel);

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export const yen = (n) => `${Math.round(n).toLocaleString('ja-JP')}円`;
export const fmt1 = (n) => (n == null ? '—' : n.toFixed(1));
