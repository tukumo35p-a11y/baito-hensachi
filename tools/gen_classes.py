# -*- coding: utf-8 -*-
"""
クラス定義ファイル public/js/classes.js を生成するスクリプト。

32x32 のドット絵を「共通の体」＋「クラスごとの装備」の重ね描きで作り、
輪郭線（k）を自動で付けてから、パレットと行データとして書き出す。

  python tools/gen_classes.py

生成後の classes.js は直接編集してもよい（このスクリプトを再実行すると上書きされる）。
"""
import json
import pathlib

W = H = 32

# 共通パレット（クラスごとに上書き可）
BASE_PALETTE = {
    "k": "#1f1a2e",  # 輪郭
    "s": "#f6c9a0",  # 肌
    "S": "#e0a57c",  # 肌の影
    "p": "#f29a9a",  # ほお
    "m": "#a8434a",  # 口
    "w": "#ffffff",  # 白・ハイライト
    "h": "#6b3f22",  # 髪
    "t": "#c49a6c",  # 服
    "T": "#a47a4c",  # 服の影・差し色
    "l": "#6d5a46",  # ズボン
    "f": "#4a3728",  # くつ
    "b": "#5a3d2b",  # ベルト
    "r": "#9a6a3a",  # 木
    "a": "#9aa6b8",  # 金属
    "A": "#dfe6f0",  # 金属ハイライト
    "x": "#c3ccd8",  # 刃
    "X": "#ffffff",  # 刃ハイライト
    "g": "#f2c230",  # 金
    "G": "#c8901c",  # 金の影
    "c": "#d8443c",  # マント・布
    "C": "#a8302c",  # マントの影
    "q": "#5fd4ff",  # 宝石・魔力
    "z": "#ffe680",  # きらめき（輪郭なし）
    "u": "#7fd6a8",  # スライム
    "U": "#4fb488",  # スライムの影
    "L": "#3f8f4a",  # 葉
}
NO_OUTLINE = set("z")


class Grid:
    def __init__(self):
        self.c = [[None] * W for _ in range(H)]

    def px(self, x, y, ch):
        if 0 <= x < W and 0 <= y < H:
            self.c[y][x] = ch

    def rect(self, x0, y0, x1, y1, ch):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.px(x, y, ch)

    def hline(self, x0, x1, y, ch):
        self.rect(x0, y, x1, y, ch)

    def vline(self, x, y0, y1, ch):
        self.rect(x, y0, x, y1, ch)

    def clear(self, x, y):
        self.c[y][x] = None

    def outline(self):
        add = []
        for y in range(H):
            for x in range(W):
                if self.c[y][x] is not None:
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < W and 0 <= ny < H:
                        v = self.c[ny][nx]
                        if v is not None and v not in NO_OUTLINE and v != "k":
                            add.append((x, y))
                            break
        for x, y in add:
            self.c[y][x] = "k"

    def sparkle(self, x, y, ch="z", big=False):
        """空いているマスにだけきらめきを置く"""
        pts = [(x, y), (x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)]
        if big:
            pts += [(x - 2, y), (x + 2, y), (x, y - 2), (x, y + 2)]
        for px, py in pts:
            if 0 <= px < W and 0 <= py < H and self.c[py][px] is None:
                self.c[py][px] = ch

    def rows(self):
        return ["".join(ch or "." for ch in row) for row in self.c]


# ---------------------------------------------------------------- 共通パーツ

def head(g, hair="h", eyes=True):
    g.rect(11, 5, 20, 14, "s")
    for x, y in ((11, 5), (20, 5), (11, 14), (20, 14)):
        g.clear(x, y)
    g.hline(12, 19, 14, "S")  # あご下の影
    # 髪（前髪）
    g.rect(11, 5, 20, 7, hair)
    g.clear(11, 5)
    g.clear(20, 5)
    g.vline(11, 8, 10, hair)
    g.vline(20, 8, 10, hair)
    g.px(14, 8, hair)
    g.px(17, 8, hair)
    if eyes:
        face(g)


def face(g):
    for x in (13, 18):
        g.vline(x, 10, 11, "k")
    g.px(12, 12, "p")
    g.px(19, 12, "p")
    g.hline(15, 16, 13, "m")


def body(g, top="t", shade="T", arm=None, legs="l", shoes="f", belt="b"):
    arm = arm or top
    g.rect(11, 15, 20, 21, top)
    g.hline(11, 20, 15, shade)  # 襟
    g.rect(8, 15, 9, 20, arm)
    g.rect(22, 15, 23, 20, arm)
    g.rect(8, 21, 9, 21, "s")
    g.rect(22, 21, 23, 21, "s")
    if belt:
        g.hline(11, 20, 21, belt)
    g.rect(11, 22, 14, 26, legs)
    g.rect(17, 22, 20, 26, legs)
    g.rect(10, 27, 14, 28, shoes)
    g.rect(17, 27, 21, 28, shoes)


def cape(g, main="c", shade="C", wide=False):
    x0, x1 = (6, 25) if wide else (7, 24)
    g.rect(9, 15, 22, 23, main)
    g.rect(x0 + 1, 22, x1 - 1, 26, main)
    g.rect(x0, 25, x1, 28, main)
    for x in range(x0, x1 + 1, 3):
        g.px(x, 28, shade)
        g.px(x, 27, shade)


def sword(g, top=4, blade="x", hi="X", guard="a", grip="r", pommel="a"):
    g.rect(24, top, 25, 19, blade)
    g.vline(25, top + 1, 18, hi)
    g.clear(24, top)
    g.hline(21, 28, 20, guard)
    g.rect(24, 21, 25, 22, grip)
    g.rect(24, 23, 25, 23, pommel)


def shield(g, face_c="r", rim="a", emblem=None):
    g.rect(3, 15, 9, 23, rim)
    g.rect(4, 16, 8, 22, face_c)
    for x, y in ((3, 15), (9, 15)):
        g.clear(x, y)
    g.rect(4, 24, 8, 24, rim)
    g.rect(5, 25, 7, 25, rim)
    g.px(6, 26, rim)
    if emblem:  # ひし形の紋章
        g.px(6, 17, emblem)
        g.hline(5, 7, 18, emblem)
        g.hline(4, 8, 19, emblem)
        g.hline(5, 7, 20, emblem)
        g.px(6, 21, emblem)


# ---------------------------------------------------------------- 各クラス

def slime():
    g = Grid()
    widths = {
        14: (12, 19), 15: (10, 21), 16: (9, 22), 17: (8, 23),
        18: (7, 24), 19: (7, 24), 20: (6, 25), 21: (6, 25), 22: (6, 25),
        23: (6, 25), 24: (6, 25), 25: (6, 25), 26: (7, 24), 27: (8, 23),
    }
    for y, (x0, x1) in widths.items():
        g.hline(x0, x1, y, "u")
    # 下側の影
    g.hline(8, 23, 26, "U")
    g.hline(9, 22, 27, "U")
    for y in range(20, 26):
        g.px(25, y, "U")
    # ハイライト
    g.hline(10, 11, 16, "w")
    g.px(9, 17, "w")
    g.px(9, 18, "w")
    # 芽（伸びしろ）
    g.vline(16, 10, 13, "L")
    g.rect(13, 9, 15, 10, "L")
    g.px(12, 9, "L")
    g.rect(17, 8, 19, 9, "u")
    g.px(20, 8, "u")
    # 顔：にっこり目と小さな口
    for cx in (12, 19):
        g.px(cx - 1, 21, "k")
        g.px(cx, 20, "k")
        g.px(cx + 1, 21, "k")
    g.px(10, 23, "p")
    g.px(21, 23, "p")
    g.hline(15, 16, 23, "m")
    g.outline()
    return g, {"u": "#86d9b0", "U": "#55b98d", "L": "#3f8f4a"}


def villager():
    g = Grid()
    head(g, "h")
    body(g, "t", "T", legs="l", belt="b")
    # つぎあて
    g.rect(17, 18, 18, 19, "T")
    g.outline()
    return g, {"t": "#c9a679", "T": "#a7835a", "l": "#7a6650"}


def apprentice():
    g = Grid()
    # 木の棒
    g.rect(24, 9, 25, 24, "r")
    g.vline(25, 10, 23, "T")
    head(g, "h")
    # バンダナ
    g.hline(11, 20, 7, "c")
    g.px(21, 7, "c")
    g.px(22, 8, "c")
    g.px(22, 9, "c")
    body(g, "t", "T", legs="l", belt="b")
    g.rect(22, 20, 25, 21, "s")
    g.outline()
    return g, {"t": "#76b45f", "T": "#548f42", "c": "#e0533f", "r": "#a8743f", "l": "#6b5843"}


def merchant():
    g = Grid()
    head(g, "h")
    # 帽子
    g.rect(10, 2, 21, 6, "c")
    g.hline(9, 22, 6, "C")
    for x, y in ((10, 2), (21, 2)):
        g.clear(x, y)
    g.px(15, 3, "g")
    g.px(16, 3, "g")
    body(g, "w", "T", arm="t", legs="l", belt=None)
    # ベスト
    g.rect(11, 15, 13, 21, "t")
    g.rect(18, 15, 20, 21, "t")
    g.px(15, 17, "g")
    g.px(15, 19, "g")
    # お金袋（左手）
    g.rect(3, 19, 8, 25, "r")
    g.hline(4, 7, 18, "b")
    g.px(5, 17, "b")
    g.px(6, 17, "b")
    g.rect(5, 21, 6, 23, "g")
    g.px(4, 26, "g")  # こぼれた金貨
    g.outline()
    g.sparkle(1, 22)
    return g, {"t": "#3f6fb8", "T": "#e3e7ef", "c": "#e88a3a", "C": "#b9652a", "r": "#b88c55", "w": "#f4f1ea", "l": "#555a68"}


def warrior():
    g = Grid()
    sword(g, top=5, guard="a", grip="b", pommel="a")
    head(g, "h")
    # 鉄かぶと
    g.rect(10, 2, 21, 8, "a")
    for x, y in ((10, 2), (11, 2), (20, 2), (21, 2), (10, 3), (21, 3)):
        g.clear(x, y)
    g.hline(10, 21, 8, "A")
    g.hline(13, 18, 3, "A")
    g.vline(15, 9, 10, "a")  # 鼻あて
    g.vline(16, 9, 10, "a")
    body(g, "a", "A", arm="t", legs="l", belt="b")
    g.rect(13, 17, 18, 19, "A")
    # 肩当て
    g.rect(7, 15, 10, 16, "a")
    g.rect(21, 15, 24, 16, "a")
    shield(g, "r", "a")
    g.outline()
    return g, {"t": "#7a5a42", "a": "#8f9bb0", "A": "#cdd5e2", "l": "#4c4f5c", "r": "#a8743f"}


def magic_warrior():
    g = Grid()
    cape(g, "c", "C")
    sword(g, top=3, blade="q", hi="w", guard="g", grip="b", pommel="g")
    head(g, "h")
    # 羽根かざりのかぶと
    g.rect(10, 3, 21, 8, "a")
    for x, y in ((10, 3), (21, 3)):
        g.clear(x, y)
    g.hline(10, 21, 8, "A")
    g.rect(12, 1, 13, 3, "c")
    g.px(11, 0, "c")
    g.px(12, 0, "c")
    body(g, "a", "A", arm="a", legs="l", belt="g")
    g.rect(14, 17, 17, 19, "c")
    g.rect(7, 15, 10, 16, "A")
    g.rect(21, 15, 24, 16, "A")
    # 魔法の玉（左手）
    g.rect(4, 18, 7, 21, "q")
    g.px(4, 18, None)
    g.px(5, 19, "w")
    g.outline()
    for x, y in ((28, 6), (28, 14), (2, 15)):
        g.sparkle(x, y, "z")
    return g, {"a": "#8e98c8", "A": "#d3d8f2", "c": "#7b5cd6", "C": "#5a3fb0", "q": "#6fe3ff", "l": "#3e3a5c", "z": "#b6f1ff"}


def sage():
    g = Grid()
    cape(g, "c", "C")
    # つえ
    g.vline(25, 6, 28, "r")
    g.vline(24, 6, 28, "r")
    g.rect(23, 1, 26, 5, "g")
    g.rect(24, 2, 25, 4, "q")
    g.px(24, 2, "w")
    head(g, "h")
    # 長い髪
    g.rect(10, 8, 10, 17, "h")
    g.rect(21, 8, 21, 17, "h")
    # サークレット
    g.hline(11, 20, 7, "g")
    g.rect(15, 6, 16, 7, "q")
    # ローブ
    g.rect(11, 15, 20, 21, "t")
    g.rect(8, 15, 9, 20, "t")
    g.rect(22, 15, 23, 20, "t")
    g.rect(8, 21, 9, 21, "s")
    g.rect(22, 21, 23, 21, "s")
    g.rect(10, 22, 21, 26, "t")
    g.rect(9, 27, 22, 28, "t")
    g.hline(9, 22, 28, "g")
    g.vline(15, 16, 27, "T")
    g.vline(16, 16, 27, "T")
    g.hline(11, 20, 21, "g")
    g.hline(11, 20, 15, "g")
    g.outline()
    for x, y in ((28, 3), (20, 1), (29, 10)):
        g.sparkle(x, y, "z")
    return g, {"h": "#dfe2ee", "t": "#f3f4fb", "T": "#4a6fd6", "c": "#3b4fa8", "C": "#2c3b85", "q": "#5fd4ff", "r": "#8c5f33"}


def hero():
    g = Grid()
    cape(g, "c", "C", wide=True)
    sword(g, top=1, guard="g", grip="t", pommel="g")
    head(g, "y")
    # 金の額当て
    g.hline(11, 20, 7, "g")
    g.rect(14, 4, 17, 7, "g")
    g.rect(15, 5, 16, 6, "q")
    body(g, "a", "A", arm="a", legs="t", shoes="T", belt="g")
    g.rect(13, 16, 18, 20, "t")
    g.vline(15, 16, 20, "g")
    g.vline(16, 16, 20, "g")
    g.rect(7, 15, 10, 16, "g")
    g.rect(21, 15, 24, 16, "g")
    shield(g, "t", "g", emblem="w")
    g.outline()
    for x, y in ((29, 3), (28, 12)):
        g.sparkle(x, y, "z")
    return g, {"y": "#f2c94c", "a": "#d4dced", "A": "#ffffff", "t": "#3a6ee8", "T": "#2a4fb0", "q": "#e8414b", "c": "#d8443c", "C": "#a8302c", "x": "#d9e2ee"}


def legend():
    g = Grid()
    cape(g, "c", "C", wide=True)
    g.hline(6, 25, 28, "g")
    sword(g, top=0, blade="X", hi="q", guard="g", grip="G", pommel="q")
    head(g, "y")
    # 翼のかぶと
    g.rect(10, 2, 21, 7, "g")
    g.hline(10, 21, 7, "G")
    g.rect(14, 0, 17, 2, "g")
    g.rect(15, 1, 16, 3, "q")
    g.rect(6, 2, 9, 4, "w")
    g.rect(7, 5, 9, 6, "w")
    g.px(5, 1, "w")
    g.rect(22, 2, 25, 4, "w")
    g.rect(22, 5, 24, 6, "w")
    g.px(26, 1, "w")
    body(g, "g", "G", arm="g", legs="G", shoes="G", belt="q")
    g.rect(13, 16, 18, 20, "A")
    g.rect(14, 17, 17, 19, "q")
    g.rect(6, 14, 10, 16, "G")
    g.rect(21, 14, 25, 16, "G")
    g.rect(7, 14, 9, 14, "g")
    g.rect(22, 14, 24, 14, "g")
    shield(g, "A", "g", emblem="q")
    g.outline()
    for x, y, big in ((29, 2, True), (28, 11, False), (2, 9, True), (1, 27, False), (30, 24, False)):
        g.sparkle(x, y, "z", big)
    return g, {"y": "#fbe3a0", "g": "#f5c842", "G": "#c8901c", "A": "#fff6d8", "q": "#ff4f6a", "c": "#b3203a", "C": "#7c1427", "X": "#fffbe8", "z": "#fff3a8"}


CLASSES = [
    # min: その値「以上」でこのクラス（下から順に判定）
    {"id": "legend", "name": "伝説の勇者", "min": 70, "comment": "時給で世界を救えるレベル", "bg": ["#fff1c2", "#ffcf4d"], "draw": legend,
     "alt": "金色の鎧と翼のかぶとを身につけ、輝く剣と盾を持った伝説の勇者のドット絵"},
    {"id": "hero", "name": "勇者", "min": 65, "comment": "選ばれし者の時給", "bg": ["#e3edff", "#b8cff7"], "draw": hero,
     "alt": "銀の鎧に赤いマント、金の額当てをつけ、剣と青い盾を持った勇者のドット絵"},
    {"id": "sage", "name": "賢者", "min": 60, "comment": "知恵と待遇を兼ね備えた存在", "bg": ["#e6eefc", "#c3d4f2"], "draw": sage,
     "alt": "白いローブと青いマントをまとい、宝石のついたつえを持つ銀髪の賢者のドット絵"},
    {"id": "magic_warrior", "name": "魔法戦士", "min": 55, "comment": "攻守そろった万能タイプ", "bg": ["#ece6fa", "#cfc2ef"], "draw": magic_warrior,
     "alt": "紫のマントと羽根かざりのかぶとをつけ、光る魔法の剣と魔法の玉を持つ魔法戦士のドット絵"},
    {"id": "warrior", "name": "戦士", "min": 50, "comment": "最前線を支える頼れる主力", "bg": ["#e8ecf2", "#cdd4de"], "draw": warrior,
     "alt": "鉄のかぶとと胸当てをつけ、剣と木の盾を持った戦士のドット絵"},
    {"id": "merchant", "name": "商人", "min": 45, "comment": "堅実にコツコツ稼ぐ実力者", "bg": ["#f7ecd8", "#ead3ab"], "draw": merchant,
     "alt": "オレンジの帽子と青いベストを身につけ、金貨の入った袋を持つ商人のドット絵"},
    {"id": "apprentice", "name": "見習い冒険者", "min": 40, "comment": "冒険はまだ始まったばかり", "bg": ["#e8f2e0", "#cde2bd"], "draw": apprentice,
     "alt": "赤いバンダナと緑の服で、木の棒を持った見習い冒険者のドット絵"},
    {"id": "villager", "name": "村人", "min": 35, "comment": "平和な日常を守る大事な人", "bg": ["#f1ece3", "#ddd3c3"], "draw": villager,
     "alt": "つぎあてのある素朴な服を着た村人のドット絵"},
    {"id": "slime", "name": "スライム", "min": None, "comment": "最弱。でも伸びしろは無限大", "bg": ["#e4f4ec", "#c2e6d4"], "draw": slime,
     "alt": "頭に小さな芽が生えた、にっこり顔のまるいスライムのドット絵"},
]


def build():
    out = []
    for c in CLASSES:
        g, overrides = c["draw"]()
        pal = dict(BASE_PALETTE)
        pal.update(overrides)
        rows = g.rows()
        used = sorted({ch for r in rows for ch in r if ch != "."})
        out.append({
            "id": c["id"],
            "name": c["name"],
            "min": c["min"],
            "comment": c["comment"],
            "alt": c["alt"],
            "bg": c["bg"],
            "palette": {ch: pal[ch] for ch in used},
            "pixels": rows,
        })
    return out


HEADER = """// 偏差値クラスの定義ファイル（クラスの区切り・名前・ひとこと・イラスト）
//
// - classes は「上位クラスから順」に並べる
// - min: 総合偏差値がこの値「以上」ならこのクラス（最下位は null = それ未満すべて）
// - pixels: 32x32 のドット絵。1文字 = 1マス、"." は透明。palette で色を指定
// - bg: イラストの背景タイルのグラデーション（ライト・ダークどちらでも見えるよう明るめの色）
//
// 初期データは tools/gen_classes.py で生成。直接編集してもよい
// （スクリプトを再実行すると上書きされるので注意）。
"""


def main():
    data = build()
    root = pathlib.Path(__file__).resolve().parent.parent
    lines = [HEADER, "export const CLASSES = ["]
    for c in data:
        lines.append("  {")
        for key in ("id", "name", "min", "comment", "alt", "bg"):
            lines.append(f"    {key}: {json.dumps(c[key], ensure_ascii=False)},")
        lines.append("    palette: " + json.dumps(c["palette"]) + ",")
        lines.append("    pixels: [")
        for r in c["pixels"]:
            lines.append(f"      '{r}',")
        lines.append("    ],")
        lines.append("  },")
    lines.append("];")
    lines.append("")
    (root / "public" / "js" / "classes.js").write_text("\n".join(lines), encoding="utf-8")
    print(f"wrote {len(data)} classes")

    # ファビコン（スライム）
    slime_c = next(c for c in data if c["id"] == "slime")
    rects = []
    for y, row in enumerate(slime_c["pixels"]):
        for x, ch in enumerate(row):
            if ch != ".":
                rects.append(f'<rect x="{x}" y="{y}" width="1" height="1" fill="{slime_c["palette"][ch]}"/>')
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="4 6 24 24" shape-rendering="crispEdges">'
           + "".join(rects) + "</svg>\n")
    (root / "public" / "favicon.svg").write_text(svg, encoding="utf-8")


if __name__ == "__main__":
    main()
