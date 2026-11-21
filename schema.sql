-- 可选：Worker 首次访问时会自动建表，一般不用手动执行
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS items (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  url          TEXT NOT NULL,
  source       TEXT,
  raw_text     TEXT,
  published_at INTEGER,
  fetched_at   INTEGER NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',
  category     TEXT,
  name         TEXT,
  summary      TEXT,
  signup       TEXT,
  score        INTEGER,
  judged_by    TEXT,
  judged_at    INTEGER,
  attempts     INTEGER NOT NULL DEFAULT 0,
  obtain       TEXT,
  fp           TEXT,
  day          TEXT  -- 抓取日期（北京时间），按天存储，保留 retention_days 天
);
CREATE INDEX IF NOT EXISTS idx_items_day ON items(day, status);
CREATE INDEX IF NOT EXISTS idx_items_fetched ON items(fetched_at);
CREATE INDEX IF NOT EXISTS idx_items_fp ON items(fp);
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status, published_at);
CREATE INDEX IF NOT EXISTS idx_items_published ON items(published_at);

CREATE TABLE IF NOT EXISTS runs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  trigger     TEXT,
  started_at  INTEGER,
  finished_at INTEGER,
  stats       TEXT,
  log         TEXT
);

-- 未绑定 KV 时，敏感配置与管理员密码哈希存这里
CREATE TABLE IF NOT EXISTS secrets (key TEXT PRIMARY KEY, value TEXT NOT NULL);

-- 去重记忆
CREATE TABLE IF NOT EXISTS seen (id TEXT PRIMARY KEY, fp TEXT, seen_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_seen_fp ON seen(fp);
CREATE INDEX IF NOT EXISTS idx_seen_at ON seen(seen_at);
