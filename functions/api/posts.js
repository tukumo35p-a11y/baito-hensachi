import { validatePost } from '../_lib/validate.js';
import { hashIp, jstDay, verifyTurnstile } from '../_lib/security.js';
import { getStats } from '../_lib/stats.js';
import { json, error } from '../_lib/http.js';
import { DAILY_POST_LIMIT } from '../../public/js/constants.js';

const MAX_BODY_BYTES = 4096;

// POST /api/posts：投稿を保存し、比較に必要な集計値を返す
export async function onRequestPost({ request, env }) {
  if (!env.TURNSTILE_SECRET_KEY || !env.IP_HASH_SALT) {
    console.error('TURNSTILE_SECRET_KEY / IP_HASH_SALT が設定されていません');
    return error(500, 'サーバーの設定が完了していません');
  }

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return error(413, 'リクエストが大きすぎます');
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return error(400, 'リクエストの形式が正しくありません');
  }

  const v = validatePost(body);
  if (!v.ok) return error(400, v.errors[0], { errors: v.errors });

  const ip = request.headers.get('CF-Connecting-IP') ?? '';
  if (!(await verifyTurnstile(body.turnstileToken, env.TURNSTILE_SECRET_KEY, ip))) {
    return error(403, 'ボット判定に失敗しました。もう一度お試しください', { code: 'turnstile' });
  }

  const ipHash = await hashIp(ip || 'unknown', env.IP_HASH_SALT);
  const day = jstDay();
  const { pref, industry, wage, hours, perks } = v.value;

  try {
    // 上限チェックと保存を1文で行い、同時投稿でも上限を超えないようにする
    const res = await env.DB.prepare(
      `INSERT INTO posts (day, ip_hash, pref, industry, wage, hours,
         perk_transport, perk_training, perk_meal, perk_raise, perk_flexible)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
       WHERE (SELECT COUNT(*) FROM posts WHERE ip_hash = ? AND day = ?) < ?`,
    )
      .bind(
        day, ipHash, pref, industry, wage, hours,
        perks.transport, perks.training, perks.meal, perks.raise, perks.flexible,
        ipHash, day, DAILY_POST_LIMIT,
      )
      .run();

    if (!res.meta.changes) {
      return error(429, `投稿は1日${DAILY_POST_LIMIT}件までです。明日また試してください`, { code: 'rate_limit' });
    }

    const stats = await getStats(env.DB);
    return json({ saved: true, stats });
  } catch (e) {
    console.error(e);
    return error(500, '保存に失敗しました');
  }
}
