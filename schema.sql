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
  day          TEXT,  -- 抓取日期（北京时间），按天存储，保留 retention_days 天
  cats         TEXT,
  hint         TEXT,
  target       TEXT,  -- 指向的目标地址（用于折叠重复）
  sources      TEXT,  -- 合并进来的其它来源 JSON
  extra        TEXT,  -- 附加信息 JSON（节点订阅地址、兑换码、怎么领、厂商、福利类型）
  expires_at   INTEGER, -- 截止时间
  up           INTEGER NOT NULL DEFAULT 0, -- 「值」票数
  down         INTEGER NOT NULL DEFAULT 0, -- 「不值」票数
  dead         INTEGER NOT NULL DEFAULT 0, -- 失效检测：1 = 疑似失效
  checked_at   INTEGER
);
CREATE INDEX IF NOT EXISTS idx_items_expires ON items(expires_at);
CREATE INDEX IF NOT EXISTS idx_items_target ON items(target);
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

-- 抓取步骤队列
CREATE TABLE IF NOT EXISTS jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id INTEGER NOT NULL, seq INTEGER NOT NULL, kind TEXT NOT NULL, payload TEXT, status TEXT NOT NULL DEFAULT 'pending', claimed_at INTEGER, tries INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS idx_jobs_run ON jobs(run_id, status, seq);

-- v1.8：投票、来源健康、AI 结论缓存、登录失败计数
CREATE TABLE IF NOT EXISTS votes (id TEXT NOT NULL, voter TEXT NOT NULL, v INTEGER NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (id, voter));
CREATE TABLE IF NOT EXISTS src_health (name TEXT NOT NULL, day TEXT NOT NULL, fetched INTEGER NOT NULL DEFAULT 0, added INTEGER NOT NULL DEFAULT 0, errors INTEGER NOT NULL DEFAULT 0, last_at INTEGER, last_err TEXT, PRIMARY KEY (name, day));
CREATE TABLE IF NOT EXISTS verdicts (k TEXT PRIMARY KEY, v TEXT NOT NULL, at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS rate (k TEXT PRIMARY KEY, n INTEGER NOT NULL, reset INTEGER NOT NULL);
-- v1.8.1：资源页快照（定时任务分块生成，访问时直接读）
CREATE TABLE IF NOT EXISTS snap (k TEXT PRIMARY KEY, v TEXT NOT NULL, at INTEGER NOT NULL);
