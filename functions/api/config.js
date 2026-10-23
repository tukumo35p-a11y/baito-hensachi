import { json } from '../_lib/http.js';

// GET /api/config：フロントに渡してよい公開設定（Turnstile のサイトキー）
export function onRequestGet({ env }) {
  return json(
    { turnstileSiteKey: env.TURNSTILE_SITE_KEY ?? null },
    { headers: { 'Cache-Control': 'public, max-age=300' } },
  );
}
