-- 投稿データ（ユーザーの自己申告のみ）
CREATE TABLE IF NOT EXISTS posts (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  day            TEXT    NOT NULL,                 -- 日本時間の日付（1日の投稿上限用）
  ip_hash        TEXT    NOT NULL,                 -- ソルト付き SHA-256。生の IP は保存しない
  pref           INTEGER NOT NULL CHECK (pref BETWEEN 1 AND 47),
  industry       TEXT    NOT NULL,
  wage           INTEGER NOT NULL CHECK (wage BETWEEN 800 AND 10000),
  hours          INTEGER NOT NULL CHECK (hours BETWEEN 1 AND 60),
  perk_transport INTEGER NOT NULL DEFAULT 0 CHECK (perk_transport IN (0, 1)),
  perk_training  INTEGER NOT NULL DEFAULT 0 CHECK (perk_training IN (0, 1)),
  perk_meal      INTEGER NOT NULL DEFAULT 0 CHECK (perk_meal IN (0, 1)),
  perk_raise     INTEGER NOT NULL DEFAULT 0 CHECK (perk_raise IN (0, 1)),
  perk_flexible  INTEGER NOT NULL DEFAULT 0 CHECK (perk_flexible IN (0, 1)),
  excluded       INTEGER NOT NULL DEFAULT 0 CHECK (excluded IN (0, 1))  -- 1 なら集計から除外
);

CREATE INDEX IF NOT EXISTS idx_posts_ip_day   ON posts (ip_hash, day);
CREATE INDEX IF NOT EXISTS idx_posts_industry ON posts (industry);
CREATE INDEX IF NOT EXISTS idx_posts_pref     ON posts (pref);
