// 数据库与设置
export const DEFAULT_SOURCES = [
  // 中文社区（部分源参考 ZiChuanLan/freebie-radar 的内置源）
  { name: 'V2EX · 免费赠送', type: 'v2ex', node: 'free', enabled: true },
  { name: 'V2EX · 云计算', type: 'v2ex', node: 'cloud', enabled: true },
  { name: 'V2EX · 推广与注册送', type: 'v2ex', node: 'promotions', enabled: true },
  { name: 'V2EX · 分享发现', type: 'v2ex', node: 'share', enabled: false },
  { name: 'NodeSeek · 福利情报', type: 'rss', url: 'https://rss.nodeseek.com/', enabled: true },
  { name: 'NodeLoc · 羊毛与主机', type: 'rss', url: 'https://www.nodeloc.com/latest.rss', enabled: true },
  // LINUX DO 有 Cloudflare 护盾，机房 IP 常被拦，默认关闭
  { name: 'LINUX DO · 福利羊毛', type: 'rss', url: 'https://linux.do/c/welfare/36.rss', enabled: false },
  { name: '小众软件论坛 · 发现', type: 'rss', url: 'https://meta.appinn.net/c/faxian/10.rss', enabled: true },
  // 白嫖专源：内容本身就是免费资源，免关键词预筛、免 AI 审核直接入库（trusted），分类固定
  { name: 'Epic · 每周免费游戏', type: 'epic', category: 'game', trusted: true, enabled: true },
  { name: 'GamerPower · 限免游戏', type: 'gamerpower', category: 'game', trusted: true, enabled: true },
  { name: 'OpenRouter · 免费模型', type: 'openrouter_free', category: 'ai', trusted: true, enabled: true },
  // include：标题需匹配的正则（这个源混有打折商品，只要 100% 免费的）
  { name: 'SharewareOnSale · 正版软件限免', type: 'rss', url: 'https://sharewareonsale.com/feed', include: '100% discount|\\bfree\\b', category: 'software', trusted: true, note: '正版软件限时 100% 免费领取（英文站）', enabled: true },
  { name: 'V2EX · 创意', type: 'v2ex', node: 'create', enabled: false },
  // 中文白嫖专源。category: 'auto' 表示按关键词自动归类（归不进已勾选的分类就跳过）
  { name: '反斗限免 · 限时免费', type: 'rss', url: 'https://free.apprcn.com/feed/', category: 'auto', fallback: 'software', trusted: true, enabled: true },
  { name: 'IT之家 · 喜加一 / 限免', type: 'rss', url: 'https://www.ithome.com/rss/', include: '喜加一|限免|限时免费|免费领|白嫖', category: 'auto', fallback: 'game', trusted: true, enabled: true },
  { name: '如有乐享 · 免费资源', type: 'rss', url: 'https://51.ruyo.net/feed', enabled: true },
  { name: '小众软件 · 主站', type: 'rss', url: 'https://www.appinn.com/feed/', enabled: true },
  { name: '异次元软件世界', type: 'rss', url: 'https://feed.iplaysoft.com/', enabled: true },
  { name: '蓝点网', type: 'rss', url: 'https://www.landiannews.com/feed', include: '免费|限免|白嫖|领取|赠送', enabled: true },
  // 英文社区：默认过滤纯英文内容，这些源默认关闭；关掉「过滤纯英文」后可按需打开
  { name: 'LowEndTalk · Offers', type: 'rss', url: 'https://lowendtalk.com/categories/offers/feed.rss', enabled: false },
  { name: 'LowEndSpirit', type: 'rss', url: 'https://lowendspirit.com/discussions/feed.rss', enabled: false },
  { name: 'Hacker News · free domain', type: 'hn', query: '"free domain"', enabled: false },
  { name: 'Hacker News · free subdomain', type: 'hn', query: '"free subdomain"', enabled: false },
  { name: 'Hacker News · free hosting', type: 'hn', query: '"free hosting"', enabled: false },
  // GitHub 仓库搜索噪音大，建议配合 AI 判定再开启
  { name: 'GitHub · free domain', type: 'github', query: 'free domain', ai_only: true, enabled: false },
  { name: 'GitHub · free hosting', type: 'github', query: 'free hosting', ai_only: true, enabled: false },
  // ai_only：讨论帖多，只有配置了 AI 判定时才抓
  { name: 'Hacker News · free tier', type: 'hn', query: '"free tier"', ai_only: true, enabled: false },
  { name: 'Hacker News · free credits', type: 'hn', query: '"free credits"', ai_only: true, enabled: false },
  // Reddit 常拦截机房 IP，默认关闭
  { name: 'Reddit · free domain', type: 'reddit', query: 'free domain', enabled: false },
  { name: 'Reddit · free web hosting', type: 'reddit', query: 'free web hosting', enabled: false },
];

export const DEFAULT_SETTINGS = {
  // AI 判定（OpenAI 兼容接口）
  ai_enabled: 'true',     // 可选：填好接口地址、Key、模型就自动使用；不填则用关键词判定
  ai_base_url: 'https://api.openai.com/v1',
  ai_api_key: '',
  ai_model: '',
  ai_batch_size: '12',    // 每次请求判定几条
  ai_max_items: '60',     // 每次运行最多送 AI 判定几条（免费版 Worker 每次最多 50 个外部请求，别设太大）
  ai_min_score: '60',     // 低于此分数视为不通过
  // 联网搜索后端（见 search.js 的 BACKENDS）。全部默认开启：AnySearch、Keenable 免 Key 直接可用；其余填了 Key 就自动参与，没填就跳过
  anysearch_enabled: 'true',
  anysearch_api_key: '',    // 可选；填了就固定走 Key
  keenable_enabled: 'true',
  keenable_api_key: '',     // 可选；留空走免 Key 公共接口（按 IP 限流）
  keenable_mode: 'pro',     // pro / realtime
  tavily_enabled: 'true',
  tavily_api_key: '',
  tavily_depth: 'basic',    // basic / advanced / fast
  exa_enabled: 'true',
  exa_api_key: '',
  brave_enabled: 'true',
  brave_api_key: '',
  qianfan_enabled: 'true',
  qianfan_api_key: '',
  volc_enabled: 'true',
  volc_api_key: '',
  search_max_results: '10', // 每个查询返回条数
  search_queries: '',     // 留空：按勾选的分类自动生成中文搜索词；填写则只用你写的
  search_max_queries: '6',  // 每次最多查几个词（省额度，也避免超出 Worker 外部请求上限）
  search_lang: 'zh_only',  // zh_first 中文优先 / zh_only 只要中文 / any 不限
  search_block_domains: ['csdn.net', 'baijiahao.baidu.com', 'sohu.com', '163.com', 'toutiao.com'].join('\n'), // 屏蔽的站点（转载 / 搬运居多）
  // 邮件日报
  mail_enabled: 'true',      // 填好账号和收件人后自动生效；未填写时跳过
  mail_provider: 'smtp',     // smtp / resend / brevo / cloudflare
  smtp_host: 'smtp.qq.com',  // QQ 邮箱默认配置
  smtp_port: '465',
  smtp_secure: 'ssl',        // ssl（465）/ starttls（587）
  smtp_user: '',             // 完整 QQ 邮箱，如 123456@qq.com
  smtp_pass: '',             // QQ 邮箱授权码（不是 QQ 密码），存 KV
  mail_api_key: '',          // Resend / Brevo 的 Key，存 KV
  mail_from: '',             // 发件地址；SMTP 留空则使用 smtp_user（QQ 要求一致）
  mail_from_name: '免费资源雷达',
  mail_to: '',               // 收件人，多个用逗号或换行分隔
  mail_subject: '免费资源雷达 · 今日白嫖',
  mail_only_new: 'true',     // 只发上次之后新通过的
  mail_send_empty: 'false',  // 没有新内容也发
  mail_max_items: '60',
  mail_site_url: '',         // 邮件底部“查看全部”链接，如 https://xxx.workers.dev
  mail_last_sent_at: '0',    // 内部使用
  // Telegram 推送（与邮件共用“上次推送时间”）
  telegram_enabled: 'false',
  telegram_bot_token: '',    // 存 KV
  telegram_chat_id: '',      // 存 KV
  // 抓取与过滤
  noise_filter: 'true',
  filter_english: 'true',    // 过滤纯英文内容（标题和正文都没有中文就丢弃）      // 跳过求助 / 吐槽类标题，不送 AI
  allowed_obtain: 'free,conditional', // 允许的获取方式：free 直接白嫖 / conditional 有条件 / trial / lottery / promo / paid
  block_rules: ['# 每行一条，普通文本为关键词，/正则/i 为正则；命中即丢弃，不送 AI', '已失效', '/已(关闭|停止)注册/'].join('\n'),
  max_age_days: '180',    // 超过半年的消息过滤掉
  retention_days: '15',
  run_hour: '9',          // 每天几点开始抓取（北京时间，0-23）；抓完自动推送
  steps_per_tick: '1',    // 每次定时调用执行几步；免费版保持 1（10ms CPU 限制），付费版可调大   // 抓到的数据按日期存储，保留 15 天后自动清理
  keep_undated: 'false',  // 无发布日期的条目是否保留
  // 分类：勾选要收集的；推送分类留空 = 与收集相同
  enabled_categories: 'domain,hosting,cloud,ai,software,dev,game,edu',
  mail_categories: '',
  simple_signup_only: 'true', // 只要注册简单的（邮箱 / GitHub / Google 登录）
  topic_keywords: '',      // 额外主题词（每个分类已内置关键词，这里只需补充）
  free_keywords: ['免费', '白嫖', '0元', '零元', '永久免费', '限免', '限时免费', '喜加一', '送', '领取', 'free', 'gratis', '$0', 'giveaway', '100% off'].join('\n'),
  hard_signup_keywords: ['信用卡', '银行卡', '绑卡', '实名', '身份证', 'kyc', '手机验证', '短信验证', '邀请码', 'credit card', 'debit card', 'phone verification', 'sms verification', 'id verification', 'passport', 'invite code'].join('\n'),
  sources: JSON.stringify(DEFAULT_SOURCES, null, 2),
};

const SEARCH_KEYS = ['anysearch_api_key', 'keenable_api_key', 'tavily_api_key', 'exa_api_key', 'brave_api_key', 'qianfan_api_key', 'volc_api_key'];
export const SECRET_KEYS = ['ai_api_key', 'mail_api_key', 'smtp_pass', 'telegram_bot_token', ...SEARCH_KEYS];
// 敏感配置：绑定了 KV（SECRETS）就存 KV，否则存 D1 的 secrets 表（不和普通设置混在一起）
export const KV_KEYS = ['ai_base_url', 'ai_api_key', 'mail_api_key', 'smtp_user', 'smtp_pass', 'telegram_bot_token', 'telegram_chat_id', ...SEARCH_KEYS];
const kvName = (k) => `cfg:${k}`;

let schemaReady = false;
export async function ensureSchema(env) {
  if (schemaReady) return;
  await env.DB.batch([
    env.DB.prepare('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)'),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, title TEXT NOT NULL, url TEXT NOT NULL, source TEXT, raw_text TEXT, published_at INTEGER, fetched_at INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', category TEXT, name TEXT, summary TEXT, signup TEXT, score INTEGER, judged_by TEXT, judged_at INTEGER, attempts INTEGER NOT NULL DEFAULT 0)`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_items_status ON items(status, published_at)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_items_published ON items(published_at)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS runs (id INTEGER PRIMARY KEY AUTOINCREMENT, trigger TEXT, started_at INTEGER, finished_at INTEGER, stats TEXT, log TEXT)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS secrets (key TEXT PRIMARY KEY, value TEXT NOT NULL)'),
    // 一次抓取拆成的步骤（每个数据源 / 判定批次 / 推送各一步），定时任务每分钟执行一步
    env.DB.prepare("CREATE TABLE IF NOT EXISTS jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id INTEGER NOT NULL, seq INTEGER NOT NULL, kind TEXT NOT NULL, payload TEXT, status TEXT NOT NULL DEFAULT 'pending', claimed_at INTEGER)"),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_jobs_run ON jobs(run_id, status, seq)'),
    // 去重记忆：条目 15 天后会清理，但“见过”的记录保留更久，避免旧帖被重新抓取、重复推送
    env.DB.prepare('CREATE TABLE IF NOT EXISTS seen (id TEXT PRIMARY KEY, fp TEXT, seen_at INTEGER NOT NULL)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_seen_fp ON seen(fp)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_seen_at ON seen(seen_at)'),
  ]);
  // 增量迁移：新列（已存在会报错，忽略）
  for (const col of ['obtain TEXT', 'fp TEXT', 'day TEXT']) {
    try { await env.DB.prepare(`ALTER TABLE items ADD COLUMN ${col}`).run(); } catch {}
  }
  try { await env.DB.prepare('ALTER TABLE jobs ADD COLUMN claimed_at INTEGER').run(); } catch {}
  for (const sql of [
    'CREATE INDEX IF NOT EXISTS idx_items_fp ON items(fp)',
    'CREATE INDEX IF NOT EXISTS idx_items_day ON items(day, status)',
    'CREATE INDEX IF NOT EXISTS idx_items_fetched ON items(fetched_at)',
  ]) { try { await env.DB.prepare(sql).run(); } catch {} }
  schemaReady = true;
}

export async function getSettings(env) {
  const { results } = await env.DB.prepare('SELECT key, value FROM settings').all();
  const s = { ...DEFAULT_SETTINGS };
  for (const r of results || []) if (r.key in DEFAULT_SETTINGS) s[r.key] = r.value;
  const sec = await env.DB.prepare('SELECT key, value FROM secrets').all();
  for (const r of sec.results || []) if (KV_KEYS.includes(r.key)) s[r.key] = r.value;
  if (env.SECRETS) {
    const vals = await Promise.all(KV_KEYS.map((k) => env.SECRETS.get(kvName(k))));
    KV_KEYS.forEach((k, i) => { if (vals[i] !== null) s[k] = vals[i]; });
  }
  return s;
}

export function maskSecret(v) {
  if (!v) return '';
  if (v.length <= 8) return '****';
  return v.slice(0, 3) + '****' + v.slice(-4);
}

// 返回给后台的设置：密钥打码
export function settingsForAdmin(s) {
  const out = { ...s };
  for (const k of SECRET_KEYS) out[k] = maskSecret(s[k]);
  return out;
}

export async function saveSettings(env, patch) {
  const stmts = [];
  const kvWrites = [];
  for (const [k, v] of Object.entries(patch || {})) {
    if (!(k in DEFAULT_SETTINGS)) continue;
    let val = typeof v === 'boolean' ? String(v) : String(v ?? '');
    if (SECRET_KEYS.includes(k) && val.includes('****')) continue; // 未修改的打码密钥
    if (k === 'sources') JSON.parse(val); // 校验
    if (KV_KEYS.includes(k)) {
      stmts.push(env.DB.prepare('DELETE FROM settings WHERE key = ?').bind(k)); // 清掉旧版本存在普通设置里的值
      if (env.SECRETS) {
        kvWrites.push(env.SECRETS.put(kvName(k), val));
        stmts.push(env.DB.prepare('DELETE FROM secrets WHERE key = ?').bind(k));
      } else {
        stmts.push(env.DB.prepare('INSERT INTO secrets (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(k, val));
      }
      continue;
    }
    stmts.push(
      env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(k, val)
    );
  }
  await Promise.all(kvWrites);
  if (stmts.length) await env.DB.batch(stmts);
}

export const lines = (txt) =>
  String(txt || '').split(/\r?\n|,/).map((x) => x.trim().toLowerCase()).filter(Boolean);

export const storageMode = (env) => (env.SECRETS && typeof env.SECRETS.get === 'function' ? 'kv' : 'd1');

// ---------- 管理员密码（未设置 ADMIN_TOKEN 时，首次打开后台设置，哈希后存 D1） ----------
export async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text)));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export async function getAdminHash(env) {
  const r = await env.DB.prepare("SELECT value FROM secrets WHERE key = 'admin_pass_hash'").first();
  return r?.value || '';
}
export async function setAdminHash(env, password) {
  const h = await sha256('frr:' + password);
  await env.DB.prepare("INSERT INTO secrets (key, value) VALUES ('admin_pass_hash', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(h).run();
}

// ---------- 资源页访问密码（可选，哈希存 D1） ----------
export async function getSitePassHash(env) {
  const r = await env.DB.prepare("SELECT value FROM secrets WHERE key = 'site_pass_hash'").first();
  return r?.value || '';
}
export async function setSitePass(env, password) {
  if (!password) return env.DB.prepare("DELETE FROM secrets WHERE key = 'site_pass_hash'").run();
  const h = await sha256('frr-site:' + password);
  return env.DB.prepare("INSERT INTO secrets (key, value) VALUES ('site_pass_hash', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(h).run();
}

/** 北京时间日期 YYYY-MM-DD */
export function dayOf(ts) {
  return new Date(ts + 8 * 3600000).toISOString().slice(0, 10);
}
