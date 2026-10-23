import { getStats } from '../_lib/stats.js';
import { json, error } from '../_lib/http.js';

// GET /api/stats：全体・業種別・都道府県別の集計値とヒストグラム
export async function onRequestGet({ env }) {
  try {
    const stats = await getStats(env.DB);
    return json(stats, { headers: { 'Cache-Control': 'public, max-age=30' } });
  } catch (e) {
    console.error(e);
    return error(500, '集計の取得に失敗しました');
  }
}
