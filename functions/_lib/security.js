// IP ハッシュ・Turnstile 検証など

/** ソルト付き SHA-256。生の IP は保存しない */
export async function hashIp(ip, salt) {
  const data = new TextEncoder().encode(`${salt}:${ip}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 日本時間の日付（YYYY-MM-DD）。1日の投稿上限の区切りに使う */
export function jstDay(date = new Date()) {
  return new Date(date.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** Cloudflare Turnstile のトークンを検証する */
export async function verifyTurnstile(token, secret, ip) {
  if (typeof token !== 'string' || token.length === 0 || token.length > 2048) return false;
  const form = new FormData();
  form.append('secret', secret);
  form.append('response', token);
  if (ip) form.append('remoteip', ip);
  try {
    const res = await fetch(SITEVERIFY_URL, { method: 'POST', body: form });
    if (!res.ok) return false;
    const out = await res.json();
    return out.success === true;
  } catch {
    return false;
  }
}
