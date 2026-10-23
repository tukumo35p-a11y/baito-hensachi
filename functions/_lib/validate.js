import { PREFECTURES, INDUSTRIES, PERKS, LIMITS } from '../../public/js/constants.js';

function toInt(v) {
  if (typeof v === 'number') return Number.isInteger(v) ? v : NaN;
  if (typeof v === 'string' && /^\d{1,6}$/.test(v.trim())) return Number(v.trim());
  return NaN;
}

/**
 * 投稿データの検証。サーバー側で必ず通す
 * @returns {{ok:true, value:object} | {ok:false, errors:string[]}}
 */
export function validatePost(body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, errors: ['リクエストの形式が正しくありません'] };
  }

  const pref = toInt(body.pref);
  if (!(pref >= 1 && pref <= PREFECTURES.length)) errors.push('都道府県を選んでください');

  const industry = typeof body.industry === 'string' ? body.industry : '';
  if (!INDUSTRIES.some((i) => i.key === industry)) errors.push('業種を選んでください');

  const wage = toInt(body.wage);
  if (!(wage >= LIMITS.wage.min && wage <= LIMITS.wage.max)) {
    errors.push(`時給は${LIMITS.wage.min}〜${LIMITS.wage.max}円の整数で入力してください`);
  }

  const hours = toInt(body.hours);
  if (!(hours >= LIMITS.hours.min && hours <= LIMITS.hours.max)) {
    errors.push(`週の勤務時間は${LIMITS.hours.min}〜${LIMITS.hours.max}時間の整数で入力してください`);
  }

  const perks = {};
  const raw = body.perks ?? [];
  if (!Array.isArray(raw) || raw.length > PERKS.length) {
    errors.push('待遇の形式が正しくありません');
  } else {
    for (const p of PERKS) perks[p.key] = 0;
    for (const k of raw) {
      if (!PERKS.some((p) => p.key === k)) {
        errors.push('待遇の形式が正しくありません');
        break;
      }
      perks[k] = 1;
    }
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { pref, industry, wage, hours, perks } };
}
