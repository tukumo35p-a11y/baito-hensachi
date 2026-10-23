# -*- coding: utf-8 -*-
"""
ローカル動作確認用のダミー投稿（seed/dev-seed.sql）を作る。本番 DB には入れないこと。

  python tools/gen_seed.py [件数]
"""
import pathlib
import random
import sys

INDUSTRY_BASE = {
    "food_hall": 1100, "food_kitchen": 1120, "convenience": 1080, "retail": 1070,
    "apparel": 1100, "tutor": 1700, "office": 1200, "warehouse": 1180,
    "event": 1250, "call_center": 1350, "hotel": 1120, "delivery": 1300,
    "care": 1250, "other": 1150,
}
# 都市部ほど少し高めに
PREF_BONUS = {13: 180, 14: 140, 27: 110, 23: 90, 11: 90, 12: 90, 26: 60, 28: 60, 40: 30, 1: 10}


def main():
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 300
    rnd = random.Random(42)
    prefs = list(range(1, 48))
    weights = [8 if p in PREF_BONUS else 1 for p in prefs]
    rows = []
    for _ in range(n):
        ind = rnd.choice(list(INDUSTRY_BASE))
        pref = rnd.choices(prefs, weights)[0]
        wage = int(rnd.gauss(INDUSTRY_BASE[ind] + PREF_BONUS.get(pref, 0), 120) // 10 * 10)
        wage = max(950, min(4000, wage))
        hours = max(2, min(40, int(rnd.gauss(14, 6))))
        perks = [1 if rnd.random() < p else 0 for p in (0.7, 0.6, 0.35, 0.3, 0.55)]
        rows.append((pref, ind, wage, hours, *perks))
    # 外れ値（集計から自動で除外されるはず）
    rows.append((13, "other", 9800, 60, 1, 1, 1, 1, 1))

    values = ",\n".join(
        f"('2000-01-01', 'dev-seed', {p}, '{i}', {w}, {h}, {a}, {b}, {c}, {d}, {e})"
        for p, i, w, h, a, b, c, d, e in rows
    )
    sql = (
        "-- ローカル動作確認用のダミーデータ（tools/gen_seed.py で生成）。本番では使わない\n"
        "INSERT INTO posts (day, ip_hash, pref, industry, wage, hours,\n"
        "  perk_transport, perk_training, perk_meal, perk_raise, perk_flexible) VALUES\n"
        f"{values};\n"
    )
    out = pathlib.Path(__file__).resolve().parent.parent / "seed" / "dev-seed.sql"
    out.parent.mkdir(exist_ok=True)
    out.write_text(sql, encoding="utf-8")
    print(f"wrote {len(rows)} rows to {out.name}")


if __name__ == "__main__":
    main()
