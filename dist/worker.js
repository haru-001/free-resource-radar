// 免费资源雷达 · 单文件版（用于 Cloudflare 控制台直接粘贴部署）。源码见 src/，由 npm run build:single 生成。
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/smtp.js
var smtp_exports = {};
__export(smtp_exports, {
  smtpSend: () => smtpSend
});
import { connect } from "cloudflare:sockets";
async function smtpSend(o) {
  const port = Number(o.port) || 465;
  const secure = o.secure || (port === 465 ? "ssl" : "starttls");
  const socket = connect({ hostname: o.host, port }, { secureTransport: secure === "ssl" ? "on" : "starttls", allowHalfOpen: false });
  const c = new Conn(socket);
  const helo = "radar.workers.dev";
  try {
    await c.reply([220], "\u63E1\u624B");
    await c.cmd(`EHLO ${helo}`, [250], "EHLO");
    if (secure === "starttls") {
      await c.cmd("STARTTLS", [220], "STARTTLS");
      c.release();
      c.attach(c.socket.startTls());
      await c.cmd(`EHLO ${helo}`, [250], "EHLO(TLS)");
    }
    await c.cmd("AUTH LOGIN", [334], "AUTH");
    await c.cmd(b64(o.user), [334], "AUTH \u7528\u6237\u540D");
    await c.cmd(b64(o.pass), [235], "AUTH \u5BC6\u7801\uFF08QQ \u90AE\u7BB1\u8BF7\u7528\u6388\u6743\u7801\uFF09");
    await c.cmd(`MAIL FROM:<${o.from}>`, [250], "MAIL FROM");
    for (const addr of o.to) await c.cmd(`RCPT TO:<${addr}>`, [250, 251], `RCPT ${addr}`);
    await c.cmd("DATA", [354], "DATA");
    const body = o.raw.replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..");
    await c.write(body + (body.endsWith("\r\n") ? "" : "\r\n") + ".\r\n");
    await c.reply([250], "\u53D1\u9001\u5185\u5BB9");
    try {
      await c.cmd("QUIT", null, "QUIT");
    } catch {
    }
  } finally {
    try {
      await c.socket.close();
    } catch {
    }
  }
}
var enc, b64, Conn;
var init_smtp = __esm({
  "src/smtp.js"() {
    enc = new TextEncoder();
    b64 = (str) => {
      const bytes = enc.encode(str);
      let bin = "";
      for (let i = 0; i < bytes.length; i += 32768) bin += String.fromCharCode(...bytes.subarray(i, i + 32768));
      return btoa(bin);
    };
    Conn = class {
      constructor(socket) {
        this.attach(socket);
      }
      attach(socket) {
        this.socket = socket;
        this.reader = socket.readable.getReader();
        this.writer = socket.writable.getWriter();
        this.dec = new TextDecoder();
        this.buf = "";
      }
      async write(s) {
        await this.writer.write(enc.encode(s));
      }
      completeAt() {
        let pos = 0;
        for (; ; ) {
          const nl = this.buf.indexOf("\n", pos);
          if (nl < 0) return 0;
          const line = this.buf.slice(pos, nl).replace(/\r$/, "");
          if (/^\d{3}( |$)/.test(line)) return nl + 1;
          pos = nl + 1;
        }
      }
      async reply(expect, step) {
        const deadline = Date.now() + 3e4;
        for (; ; ) {
          const end = this.completeAt();
          if (end) {
            const block = this.buf.slice(0, end);
            this.buf = this.buf.slice(end);
            const code = parseInt(block.slice(block.lastIndexOf("\n", block.length - 2) + 1), 10) || parseInt(block, 10);
            if (expect && !expect.includes(code)) throw new Error(`SMTP ${step} \u5931\u8D25\uFF1A${block.trim().slice(0, 200)}`);
            return { code, text: block };
          }
          const left = deadline - Date.now();
          if (left <= 0) throw new Error(`SMTP ${step} \u8D85\u65F6`);
          const r = await Promise.race([
            this.reader.read(),
            new Promise((_, rej) => setTimeout(() => rej(new Error(`SMTP ${step} \u8D85\u65F6`)), left))
          ]);
          if (r.done) throw new Error(`SMTP \u8FDE\u63A5\u5728 ${step} \u65F6\u88AB\u5173\u95ED`);
          this.buf += this.dec.decode(r.value, { stream: true });
        }
      }
      async cmd(line, expect, step) {
        await this.write(line + "\r\n");
        return this.reply(expect, step);
      }
      release() {
        try {
          this.reader.releaseLock();
        } catch {
        }
        try {
          this.writer.releaseLock();
        } catch {
        }
      }
    };
  }
});

// src/db.js
var DEFAULT_SOURCES = [
  // 中文社区（部分源参考 ZiChuanLan/freebie-radar 的内置源）
  { name: "V2EX \xB7 \u514D\u8D39\u8D60\u9001", type: "v2ex", node: "free", enabled: true },
  { name: "V2EX \xB7 \u4E91\u8BA1\u7B97", type: "v2ex", node: "cloud", enabled: true },
  { name: "V2EX \xB7 \u63A8\u5E7F\u4E0E\u6CE8\u518C\u9001", type: "v2ex", node: "promotions", enabled: true },
  { name: "V2EX \xB7 \u5206\u4EAB\u53D1\u73B0", type: "v2ex", node: "share", enabled: false },
  { name: "NodeSeek \xB7 \u798F\u5229\u60C5\u62A5", type: "rss", url: "https://rss.nodeseek.com/", enabled: true },
  { name: "NodeLoc \xB7 \u7F8A\u6BDB\u4E0E\u4E3B\u673A", type: "rss", url: "https://www.nodeloc.com/latest.rss", enabled: true },
  // LINUX DO 有 Cloudflare 护盾，机房 IP 常被拦，默认关闭
  { name: "LINUX DO \xB7 \u798F\u5229\u7F8A\u6BDB", type: "rss", url: "https://linux.do/c/welfare/36.rss", enabled: false },
  { name: "\u5C0F\u4F17\u8F6F\u4EF6\u8BBA\u575B \xB7 \u53D1\u73B0", type: "rss", url: "https://meta.appinn.net/c/faxian/10.rss", enabled: true },
  // 英文社区
  { name: "LowEndTalk \xB7 Offers", type: "rss", url: "https://lowendtalk.com/categories/offers/feed.rss", enabled: true },
  { name: "LowEndSpirit", type: "rss", url: "https://lowendspirit.com/discussions/feed.rss", enabled: true },
  { name: "Hacker News \xB7 free domain", type: "hn", query: '"free domain"', enabled: true },
  { name: "Hacker News \xB7 free subdomain", type: "hn", query: '"free subdomain"', enabled: true },
  { name: "Hacker News \xB7 free hosting", type: "hn", query: '"free hosting"', enabled: true },
  { name: "GitHub \xB7 free domain", type: "github", query: "free domain", enabled: true },
  { name: "GitHub \xB7 free hosting", type: "github", query: "free hosting", enabled: true },
  // Reddit 常拦截机房 IP，默认关闭
  { name: "Reddit \xB7 free domain", type: "reddit", query: "free domain", enabled: false },
  { name: "Reddit \xB7 free web hosting", type: "reddit", query: "free web hosting", enabled: false }
];
var DEFAULT_SETTINGS = {
  // AI 判定（OpenAI 兼容接口）
  ai_enabled: "false",
  ai_base_url: "https://api.openai.com/v1",
  ai_api_key: "",
  ai_model: "",
  ai_batch_size: "8",
  // 每次请求判定几条
  ai_max_items: "40",
  // 每次运行最多判定几条
  ai_min_score: "60",
  // 低于此分数视为不通过
  // 联网搜索模型（OpenAI 兼容接口，模型需自带联网能力）
  search_enabled: "false",
  search_base_url: "",
  search_api_key: "",
  search_model: "",
  search_extra_body: "{}",
  // 额外请求参数，如 {"web_search_options":{}}
  // 搜索 API（可与搜索模型同时启用）
  tavily_enabled: "false",
  tavily_api_key: "",
  // 存 KV
  tavily_depth: "basic",
  // basic / advanced / fast
  keenable_enabled: "true",
  // 免 Key 公共接口开箱即用
  keenable_api_key: "",
  // 存 KV；留空走免 Key 公共接口（按 IP 限流）
  keenable_mode: "pro",
  // pro / realtime
  search_max_results: "10",
  // 每个查询返回条数
  search_queries: ["\u514D\u8D39\u57DF\u540D \u6CE8\u518C", "\u514D\u8D39\u4E8C\u7EA7\u57DF\u540D \u7533\u8BF7", "\u514D\u8D39\u865A\u62DF\u4E3B\u673A \u65E0\u9700\u4FE1\u7528\u5361", "\u514D\u8D39\u7F51\u7AD9\u7A7A\u95F4 PHP", "\u767D\u5AD6 \u514D\u8D39\u4E3B\u673A \u57DF\u540D", "free subdomain registration", "free web hosting no credit card"].join("\n"),
  search_lang: "zh_first",
  // zh_first 中文优先 / zh_only 只要中文 / any 不限
  search_block_domains: ["csdn.net", "baijiahao.baidu.com", "sohu.com", "163.com", "toutiao.com"].join("\n"),
  // 屏蔽的站点（转载 / 搬运居多）
  // 邮件日报
  mail_enabled: "true",
  // 填好账号和收件人后自动生效；未填写时跳过
  mail_provider: "smtp",
  // smtp / resend / brevo / cloudflare
  smtp_host: "smtp.qq.com",
  // QQ 邮箱默认配置
  smtp_port: "465",
  smtp_secure: "ssl",
  // ssl（465）/ starttls（587）
  smtp_user: "",
  // 完整 QQ 邮箱，如 123456@qq.com
  smtp_pass: "",
  // QQ 邮箱授权码（不是 QQ 密码），存 KV
  mail_api_key: "",
  // Resend / Brevo 的 Key，存 KV
  mail_from: "",
  // 发件地址；SMTP 留空则使用 smtp_user（QQ 要求一致）
  mail_from_name: "\u514D\u8D39\u8D44\u6E90\u96F7\u8FBE",
  mail_to: "",
  // 收件人，多个用逗号或换行分隔
  mail_subject: "\u514D\u8D39\u57DF\u540D / \u865A\u62DF\u4E3B\u673A\u65E5\u62A5",
  mail_only_new: "true",
  // 只发上次之后新通过的
  mail_send_empty: "false",
  // 没有新内容也发
  mail_max_items: "60",
  mail_site_url: "",
  // 邮件底部“查看全部”链接，如 https://xxx.workers.dev
  mail_last_sent_at: "0",
  // 内部使用
  // Telegram 推送（与邮件共用“上次推送时间”）
  telegram_enabled: "false",
  telegram_bot_token: "",
  // 存 KV
  telegram_chat_id: "",
  // 存 KV
  // 抓取与过滤
  noise_filter: "true",
  // 跳过求助 / 吐槽类标题，不送 AI
  allowed_obtain: "free,conditional",
  // 允许的获取方式：free 直接白嫖 / conditional 有条件 / trial / lottery / promo / paid
  block_rules: ["# \u6BCF\u884C\u4E00\u6761\uFF0C\u666E\u901A\u6587\u672C\u4E3A\u5173\u952E\u8BCD\uFF0C/\u6B63\u5219/i \u4E3A\u6B63\u5219\uFF1B\u547D\u4E2D\u5373\u4E22\u5F03\uFF0C\u4E0D\u9001 AI", "\u5DF2\u5931\u6548", "/\u5DF2(\u5173\u95ED|\u505C\u6B62)\u6CE8\u518C/"].join("\n"),
  max_age_days: "180",
  // 超过半年的消息过滤掉
  retention_days: "15",
  // 抓到的数据按日期存储，保留 15 天后自动清理
  keep_undated: "false",
  // 无发布日期的条目是否保留
  topic_keywords: ["\u57DF\u540D", "\u4E8C\u7EA7\u57DF\u540D", "\u5B50\u57DF\u540D", "\u4E3B\u673A", "\u865A\u62DF\u4E3B\u673A", "\u7A7A\u95F4", "\u5EFA\u7AD9", "\u6258\u7BA1", "domain", "subdomain", "hosting", "webhost", "web host", "cpanel", "static site"].join("\n"),
  free_keywords: ["\u514D\u8D39", "\u767D\u5AD6", "0\u5143", "\u6C38\u4E45\u514D\u8D39", "free", "gratis", "$0"].join("\n"),
  hard_signup_keywords: ["\u4FE1\u7528\u5361", "\u94F6\u884C\u5361", "\u7ED1\u5361", "\u5B9E\u540D", "\u8EAB\u4EFD\u8BC1", "kyc", "\u624B\u673A\u9A8C\u8BC1", "\u77ED\u4FE1\u9A8C\u8BC1", "\u9080\u8BF7\u7801", "credit card", "debit card", "phone verification", "sms verification", "id verification", "passport", "invite code"].join("\n"),
  sources: JSON.stringify(DEFAULT_SOURCES, null, 2)
};
var SECRET_KEYS = ["ai_api_key", "search_api_key", "mail_api_key", "smtp_pass", "tavily_api_key", "keenable_api_key", "telegram_bot_token"];
var KV_KEYS = ["ai_base_url", "ai_api_key", "search_base_url", "search_api_key", "mail_api_key", "smtp_user", "smtp_pass", "tavily_api_key", "keenable_api_key", "telegram_bot_token", "telegram_chat_id"];
var kvName = (k) => `cfg:${k}`;
var schemaReady = false;
async function ensureSchema(env) {
  if (schemaReady) return;
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)"),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, title TEXT NOT NULL, url TEXT NOT NULL, source TEXT, raw_text TEXT, published_at INTEGER, fetched_at INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', category TEXT, name TEXT, summary TEXT, signup TEXT, score INTEGER, judged_by TEXT, judged_at INTEGER, attempts INTEGER NOT NULL DEFAULT 0)`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_items_status ON items(status, published_at)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_items_published ON items(published_at)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS runs (id INTEGER PRIMARY KEY AUTOINCREMENT, trigger TEXT, started_at INTEGER, finished_at INTEGER, stats TEXT, log TEXT)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS secrets (key TEXT PRIMARY KEY, value TEXT NOT NULL)"),
    // 去重记忆：条目 15 天后会清理，但“见过”的记录保留更久，避免旧帖被重新抓取、重复推送
    env.DB.prepare("CREATE TABLE IF NOT EXISTS seen (id TEXT PRIMARY KEY, fp TEXT, seen_at INTEGER NOT NULL)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_seen_fp ON seen(fp)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_seen_at ON seen(seen_at)")
  ]);
  for (const col of ["obtain TEXT", "fp TEXT", "day TEXT"]) {
    try {
      await env.DB.prepare(`ALTER TABLE items ADD COLUMN ${col}`).run();
    } catch {
    }
  }
  for (const sql of [
    "CREATE INDEX IF NOT EXISTS idx_items_fp ON items(fp)",
    "CREATE INDEX IF NOT EXISTS idx_items_day ON items(day, status)",
    "CREATE INDEX IF NOT EXISTS idx_items_fetched ON items(fetched_at)"
  ]) {
    try {
      await env.DB.prepare(sql).run();
    } catch {
    }
  }
  schemaReady = true;
}
async function getSettings(env) {
  const { results } = await env.DB.prepare("SELECT key, value FROM settings").all();
  const s = { ...DEFAULT_SETTINGS };
  for (const r of results || []) if (r.key in DEFAULT_SETTINGS) s[r.key] = r.value;
  const sec = await env.DB.prepare("SELECT key, value FROM secrets").all();
  for (const r of sec.results || []) if (KV_KEYS.includes(r.key)) s[r.key] = r.value;
  if (env.SECRETS) {
    const vals = await Promise.all(KV_KEYS.map((k) => env.SECRETS.get(kvName(k))));
    KV_KEYS.forEach((k, i) => {
      if (vals[i] !== null) s[k] = vals[i];
    });
  }
  return s;
}
function maskSecret(v) {
  if (!v) return "";
  if (v.length <= 8) return "****";
  return v.slice(0, 3) + "****" + v.slice(-4);
}
function settingsForAdmin(s) {
  const out = { ...s };
  for (const k of SECRET_KEYS) out[k] = maskSecret(s[k]);
  return out;
}
async function saveSettings(env, patch) {
  const stmts = [];
  const kvWrites = [];
  for (const [k, v] of Object.entries(patch || {})) {
    if (!(k in DEFAULT_SETTINGS)) continue;
    let val = typeof v === "boolean" ? String(v) : String(v ?? "");
    if (SECRET_KEYS.includes(k) && val.includes("****")) continue;
    if (k === "sources") JSON.parse(val);
    if (k === "search_extra_body") JSON.parse(val || "{}");
    if (KV_KEYS.includes(k)) {
      stmts.push(env.DB.prepare("DELETE FROM settings WHERE key = ?").bind(k));
      if (env.SECRETS) {
        kvWrites.push(env.SECRETS.put(kvName(k), val));
        stmts.push(env.DB.prepare("DELETE FROM secrets WHERE key = ?").bind(k));
      } else {
        stmts.push(env.DB.prepare("INSERT INTO secrets (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(k, val));
      }
      continue;
    }
    stmts.push(
      env.DB.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(k, val)
    );
  }
  await Promise.all(kvWrites);
  if (stmts.length) await env.DB.batch(stmts);
}
var lines = (txt) => String(txt || "").split(/\r?\n|,/).map((x) => x.trim().toLowerCase()).filter(Boolean);
var storageMode = (env) => env.SECRETS && typeof env.SECRETS.get === "function" ? "kv" : "d1";
async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(text)));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function getAdminHash(env) {
  const r = await env.DB.prepare("SELECT value FROM secrets WHERE key = 'admin_pass_hash'").first();
  return r?.value || "";
}
async function setAdminHash(env, password) {
  const h = await sha256("frr:" + password);
  await env.DB.prepare("INSERT INTO secrets (key, value) VALUES ('admin_pass_hash', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(h).run();
}
function dayOf(ts) {
  return new Date(ts + 8 * 36e5).toISOString().slice(0, 10);
}

// src/ai.js
function normalizeBase(u) {
  return String(u || "").trim().replace(/\/+$/, "").replace(/\/chat\/completions$/, "").replace(/\/models$/, "");
}
async function listModels(baseUrl, apiKey) {
  const r = await fetch(normalizeBase(baseUrl) + "/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(2e4)
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`\u83B7\u53D6\u6A21\u578B\u5931\u8D25 HTTP ${r.status}: ${text.slice(0, 200)}`);
  const j = JSON.parse(text);
  const arr = j.data || j.models || (Array.isArray(j) ? j : []);
  return arr.map((m) => typeof m === "string" ? m : m.id || m.name).filter(Boolean).sort();
}
async function chat({ baseUrl, apiKey, model, messages, extra = {}, temperature = 0.1, timeout = 12e4 }) {
  if (!baseUrl || !apiKey || !model) throw new Error("AI \u672A\u914D\u7F6E\u5B8C\u6574\uFF08URL / Key / \u6A21\u578B\uFF09");
  const body = { model, messages, temperature, ...extra };
  const r = await fetch(normalizeBase(baseUrl) + "/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout)
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`AI HTTP ${r.status}: ${text.slice(0, 300)}`);
  const j = JSON.parse(text);
  const msg = j.choices?.[0]?.message || {};
  let content = msg.content;
  if (Array.isArray(content)) content = content.map((c) => c.text || "").join("");
  return String(content || "");
}
function extractJson(text) {
  let t = String(text || "").trim();
  t = t.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  try {
    return JSON.parse(t);
  } catch {
  }
  const starts = [t.indexOf("{"), t.indexOf("[")].filter((i) => i >= 0);
  if (!starts.length) throw new Error("\u6A21\u578B\u8F93\u51FA\u4E2D\u6CA1\u6709 JSON");
  const start = Math.min(...starts);
  const close = t[start] === "{" ? "}" : "]";
  const end = t.lastIndexOf(close);
  return JSON.parse(t.slice(start, end + 1));
}
var JUDGE_PROMPT = `\u4F60\u662F"\u514D\u8D39\u57DF\u540D / \u514D\u8D39\u865A\u62DF\u4E3B\u673A"\u8D44\u6E90\u5BA1\u6838\u5458\u3002\u9010\u6761\u5224\u65AD\u8F93\u5165\u7684\u5E16\u5B50\u6216\u9875\u9762\uFF0C\u53EA\u8F93\u51FA\u4E25\u683C JSON\u3002
\u5224\u5B9A\u89C4\u5219\uFF1A
1. relevant\uFF1A\u5185\u5BB9\u786E\u5B9E\u5728\u63D0\u4F9B\u6216\u4ECB\u7ECD\u3010\u53EF\u514D\u8D39\u83B7\u5F97\u3011\u7684\u57DF\u540D\uFF08\u542B\u514D\u8D39\u4E8C\u7EA7\u57DF\u540D\u3001\u514D\u8D39\u9876\u7EA7\u57DF\u540D\u6D3B\u52A8\uFF09\u6216\u865A\u62DF\u4E3B\u673A / \u7F51\u7AD9\u6258\u7BA1\uFF08\u542B\u9759\u6001\u6258\u7BA1\u3001PHP \u4E3B\u673A\u3001\u514D\u8D39\u9762\u677F\u7A7A\u95F4\uFF09\u3002\u4EE5\u4E0B\u60C5\u51B5\u4E3A false\uFF1A\u7EAF\u8BA8\u8BBA\u6216\u6C42\u52A9\u3001\u4ED8\u8D39\u4FC3\u9500\u3001VPS / \u4E91\u670D\u52A1\u5668\u4F18\u60E0\uFF08\u975E\u865A\u62DF\u4E3B\u673A\uFF09\u3001\u5DF2\u5931\u6548 / \u5DF2\u5173\u95ED / \u5DF2\u552E\u7F44\u3001\u5E7F\u544A\u6216\u660E\u663E\u4E0D\u53EF\u4FE1\u3002
2. simple_signup\uFF1A\u53EA\u9700\u90AE\u7BB1\uFF0C\u6216 GitHub / Google \u7B49\u7B2C\u4E09\u65B9\u8D26\u53F7\u5373\u53EF\u6CE8\u518C\u4F7F\u7528 \u2192 true\u3002\u9700\u8981\u4FE1\u7528\u5361 / PayPal \u7ED1\u5361\u3001\u624B\u673A\u53F7\u77ED\u4FE1\u9A8C\u8BC1\u3001\u5B9E\u540D / KYC / \u8EAB\u4EFD\u8BC1\u3001\u9080\u8BF7\u7801\u3001\u4EBA\u5DE5\u5BA1\u6838\u7533\u8BF7\u3001\u5148\u4ED8\u8D39 \u2192 false\u3002\u4FE1\u606F\u4E0D\u8DB3\u65F6\u6309\u5E38\u8BC6\u8C28\u614E\u5224\u65AD\uFF0C\u5E76\u5728 signup \u5B57\u6BB5\u5199\u660E\u4F9D\u636E\u3002
3. obtain\uFF1A\u83B7\u53D6\u65B9\u5F0F\uFF0C\u53EA\u80FD\u662F free\uFF08\u76F4\u63A5\u767D\u5AD6\uFF0C\u6CE8\u518C\u5373\u7528\uFF09\u3001conditional\uFF08\u9700\u8981\u5B8C\u6210\u7B80\u5355\u4EFB\u52A1\uFF0C\u5982\u56DE\u5E16\u3001\u9080\u8BF7\u3001\u7B7E\u5230\uFF09\u3001lottery\uFF08\u62BD\u5956 / \u540D\u989D\u968F\u673A\uFF09\u3001trial\uFF08\u9650\u65F6\u8BD5\u7528\uFF0C\u5230\u671F\u6536\u8D39\uFF09\u3001promo\uFF08\u5546\u5BB6\u63A8\u5E7F\u5F15\u6D41\uFF09\u3001paid\uFF08\u9700\u8981\u4ED8\u8D39\uFF09\u3002
4. score\uFF1A0-100 \u7684\u6574\u6570\uFF0C\u7EFC\u5408\u76F8\u5173\u6027\u3001\u6CE8\u518C\u7B80\u6613\u5EA6\u3001\u8D44\u6E90\u4EF7\u503C\u3001\u53EF\u4FE1\u5EA6\u3001\u662F\u5426\u957F\u671F\u53EF\u7528\u3002
\u8F93\u51FA\u683C\u5F0F\uFF1A{"results":[{"i":\u5E8F\u53F7,"relevant":true,"category":"domain|hosting|other","obtain":"free","simple_signup":true,"signup":"\u6CE8\u518C\u8981\u6C42\uFF0C15\u5B57\u5185","name":"\u670D\u52A1\u6216\u8D44\u6E90\u540D\u79F0","summary":"\u4E00\u53E5\u8BDD\u4E2D\u6587\u7B80\u4ECB\uFF0C40\u5B57\u5185","score":80}]}`;
async function judgeBatch(items, s) {
  const payload = items.map((it, i) => ({
    i,
    title: it.title,
    url: it.url,
    source: it.source,
    date: it.published_at ? new Date(it.published_at).toISOString().slice(0, 10) : null,
    text: String(it.raw_text || "").slice(0, 700)
  }));
  const content = await chat({
    baseUrl: s.ai_base_url,
    apiKey: s.ai_api_key,
    model: s.ai_model,
    messages: [
      { role: "system", content: JUDGE_PROMPT },
      { role: "user", content: JSON.stringify(payload) }
    ]
  });
  const j = extractJson(content);
  const results = Array.isArray(j) ? j : j.results || [];
  const map = /* @__PURE__ */ new Map();
  for (const r of results) if (r && Number.isInteger(Number(r.i))) map.set(Number(r.i), r);
  return map;
}
async function searchWithModel(s, maxAgeDays) {
  let extra = {};
  try {
    extra = JSON.parse(s.search_extra_body || "{}");
  } catch {
  }
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const lang = s.search_lang || "zh_first";
  const langRule = lang === "any" ? "" : lang === "zh_only" ? "\u53EA\u4F7F\u7528\u4E2D\u6587\u6765\u6E90\uFF1A\u4F18\u5148 V2EX\u3001NodeSeek\u3001Linux.do\u3001HostLoc\u3001\u77E5\u4E4E\u3001\u6398\u91D1\u3001\u5C11\u6570\u6D3E\u3001\u535A\u5BA2\u56ED\u3001GitHub \u4E2D\u6587\u4ED3\u5E93\u7B49\u4E2D\u6587\u793E\u533A\u548C\u535A\u5BA2\uFF1B\u4E0D\u8981\u82F1\u6587\u7F51\u9875\u3002" : "\u4F18\u5148\u641C\u7D22\u4E2D\u6587\u6765\u6E90\uFF08V2EX\u3001NodeSeek\u3001Linux.do\u3001HostLoc\u3001\u77E5\u4E4E\u3001\u6398\u91D1\u3001\u5C11\u6570\u6D3E\u3001\u535A\u5BA2\u56ED\u3001\u4E2D\u6587\u535A\u5BA2\u7B49\uFF09\uFF0C\u7528\u4E2D\u6587\u5173\u952E\u8BCD\u641C\u7D22\uFF0C\u4F8B\u5982\u201C\u514D\u8D39\u57DF\u540D\u201D\u201C\u514D\u8D39\u4E8C\u7EA7\u57DF\u540D\u201D\u201C\u514D\u8D39\u865A\u62DF\u4E3B\u673A\u201D\u201C\u514D\u8D39\u7A7A\u95F4\u201D\u201C\u767D\u5AD6 \u4E3B\u673A\u201D\uFF1B\u4E2D\u6587\u7ED3\u679C\u4E0D\u8DB3\u65F6\u518D\u8865\u5145\u82F1\u6587\u7ED3\u679C\u3002";
  const prompt = `\u4ECA\u5929\u662F ${today}\u3002\u8BF7\u8054\u7F51\u641C\u7D22\u6700\u8FD1 ${maxAgeDays} \u5929\u5185\u53D1\u5E03\u6216\u66F4\u65B0\u3001\u76EE\u524D\u4ECD\u7136\u53EF\u7528\u7684\u3010\u514D\u8D39\u57DF\u540D\u3011\uFF08\u542B\u514D\u8D39\u4E8C\u7EA7\u57DF\u540D\uFF09\u548C\u3010\u514D\u8D39\u865A\u62DF\u4E3B\u673A / \u7F51\u7AD9\u6258\u7BA1\u3011\u8D44\u6E90\u3002
${langRule}
\u53EA\u8981\u6CE8\u518C\u7B80\u5355\u7684\uFF1A\u4EC5\u9700\u90AE\u7BB1\u6216 GitHub / Google \u767B\u5F55\uFF0C\u4E0D\u9700\u8981\u4FE1\u7528\u5361\u3001\u624B\u673A\u9A8C\u8BC1\u3001\u5B9E\u540D\u3001\u9080\u8BF7\u7801\u3002
\u8DF3\u8FC7\uFF1A\u8F6C\u8F7D\u642C\u8FD0\u7AD9\u3001SEO \u91C7\u96C6\u7AD9\u3001\u5DF2\u5931\u6548\u6216\u5DF2\u5173\u95ED\u7684\u670D\u52A1\u3001\u4ED8\u8D39\u4FC3\u9500\u3001VPS \u4F18\u60E0\u3002
\u5C3D\u91CF\u7ED9\u51FA 15 \u6761\u3002url \u4F18\u5148\u7ED9\u539F\u5E16\u6216\u5B98\u65B9\u7F51\u5740\uFF1Btitle \u4FDD\u7559\u539F\u6587\u6807\u9898\uFF1Bsummary \u4E00\u5F8B\u7528\u4E2D\u6587\u3002
lang \u8868\u793A\u6765\u6E90\u7F51\u9875\u7684\u8BED\u8A00\uFF08zh \u6216 en\uFF09\u3002
\u53EA\u8F93\u51FA JSON\uFF1A{"items":[{"title":"","url":"","lang":"zh","published_at":"YYYY-MM-DD","category":"domain|hosting","signup":"","summary":""}]}`;
  const content = await chat({
    baseUrl: s.search_base_url,
    apiKey: s.search_api_key,
    model: s.search_model,
    messages: [{ role: "user", content: prompt }],
    extra,
    timeout: 18e4
  });
  const j = extractJson(content);
  const arr = Array.isArray(j) ? j : j.items || [];
  return arr.filter((x) => x && x.url && /^https?:\/\//i.test(x.url)).map((x) => ({
    title: String(x.title || x.url).slice(0, 300),
    url: x.url,
    published_at: x.published_at ? Date.parse(x.published_at) || null : null,
    raw_text: [x.summary, x.signup ? `\u6CE8\u518C\uFF1A${x.signup}` : ""].filter(Boolean).join(" | "),
    source: "AI \u8054\u7F51\u641C\u7D22",
    lang: String(x.lang || "").toLowerCase()
  }));
}

// src/search.js
var CJK = /[\u4e00-\u9fff]/;
function searchQueries(s) {
  const qs = String(s.search_queries || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  const lang = s.search_lang || "zh_first";
  return lang === "zh_only" ? qs.filter((q) => CJK.test(q)) : qs;
}
function blockList(s) {
  return lines(s.search_block_domains).map((d) => d.replace(/^https?:\/\//, "").replace(/\/.*$/, "")).filter((d) => d.includes("."));
}
async function postJson(url, headers, body, name) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(3e4)
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${name} HTTP ${r.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}
async function runQueries(queries, fn, name) {
  const settled = await Promise.allSettled(queries.map(fn));
  const ok = settled.filter((x) => x.status === "fulfilled");
  if (!ok.length && settled.length) throw settled[0].reason || new Error(`${name} \u5168\u90E8\u67E5\u8BE2\u5931\u8D25`);
  const errors = settled.filter((x) => x.status === "rejected").map((x) => x.reason?.message);
  return { items: ok.flatMap((x) => x.value), errors };
}
async function searchTavily(s, maxAgeDays) {
  if (!s.tavily_api_key) throw new Error("\u672A\u586B\u5199 Tavily API Key");
  const lang = s.search_lang || "zh_first";
  const start = new Date(Date.now() - maxAgeDays * 864e5).toISOString().slice(0, 10);
  const exclude = blockList(s).slice(0, 150);
  return runQueries(searchQueries(s), async (query) => {
    const zhQuery = CJK.test(query);
    const body = {
      query,
      search_depth: s.tavily_depth || "basic",
      max_results: Math.min(20, Number(s.search_max_results) || 10),
      topic: "general",
      start_date: start,
      filter_by_published_date: true,
      // 去掉无日期和超期的
      include_published_date: true,
      include_answer: false,
      include_raw_content: false
    };
    if (exclude.length) body.exclude_domains = exclude;
    if (zhQuery && lang !== "any") {
      body.language = "zh-cn";
      if (lang === "zh_only") body.filter_by_language = true;
    }
    const j = await postJson("https://api.tavily.com/search", { Authorization: `Bearer ${s.tavily_api_key}` }, body, "Tavily");
    return (j.results || []).map((r) => ({
      title: r.title || r.url,
      url: r.url,
      published_at: r.published_date ? Date.parse(r.published_date) || null : null,
      raw_text: String(r.content || "").slice(0, 1500),
      source: "Tavily \u641C\u7D22"
    }));
  }, "Tavily");
}
async function searchKeenable(s, maxAgeDays) {
  const key = s.keenable_api_key;
  const url = key ? "https://api.keenable.ai/v1/search" : "https://api.keenable.ai/v1/search/public";
  const headers = key ? { "X-API-Key": key } : { "X-Keenable-Title": "Free Resource Radar" };
  const exclude = blockList(s);
  return runQueries(searchQueries(s), async (query) => {
    const body = {
      query,
      mode: s.keenable_mode || "pro",
      max_results: Math.min(50, Number(s.search_max_results) || 10),
      published_after: `${maxAgeDays}d`,
      // 会自动去掉无发布日期的页面
      snippet_max_length: 800,
      disable_cards: true
    };
    if (exclude.length) body.exclude_domains = exclude;
    const j = await postJson(url, headers, body, "Keenable");
    return (j.results || []).map((r) => ({
      title: r.title || r.url,
      url: r.url,
      published_at: r.published_at ? Date.parse(r.published_at) || null : null,
      raw_text: String(r.snippet || "").slice(0, 1500),
      source: "Keenable \u641C\u7D22"
    }));
  }, "Keenable");
}

// src/rules.js
var NOISE_TITLE = /^(怎样|怎么|如何|哪里|哪个|为什么|为何)|请问|有没有|求推荐|求一个|哪里(有|能)|值得买吗|怎么样[?？]|不够用|用完了|失效了|吐槽|踩坑|后悔|失望|谁有|求个|求购|哪有|多少钱|求助|求带|有人吗|有人知道|被封|封号|跑路|[?？]\s*$/;
function isNoiseTitle(title) {
  const t = String(title || "");
  if (/^(如何|怎么|怎样)/.test(t) && /教程|攻略|步骤|指南/.test(t) && !/请问|求助|有没有|失效|[?？]/.test(t)) return false;
  return NOISE_TITLE.test(t);
}
function guessObtain(title, summary = "") {
  const t = `${title} ${summary}`;
  if (/抽奖|抽\s*\d+\s*(份|个|名|位)|抽取|随机送|开奖|中奖|摇号|giveaway/i.test(t)) return "lottery";
  if (/招募|代理|加盟|商务合作|招商|诚招|带货|优惠码.*分成|affiliate/i.test(t)) return "promo";
  if (/(年付|月付|季付)\s*[$¥￥]?\s*\d|[$¥￥]\s*\d+(\.\d+)?\s*\/\s*(年|月|yr|year|mo|month)|首年\s*[$¥￥]?\d/i.test(t) && !/免费|free/i.test(t)) return "paid";
  if (/试用|免费体验\s*\d+\s*天|首月免费|体验期|试用期|\d+\s*天免费|free\s+trial/i.test(t)) return "trial";
  if (/回帖|盖楼|转发|关注.*领取|邀请|拉新|实名|绑卡|下单|首单|充值|发帖|签到.*领|分享.*得|credit\s*card|phone\s*verif/i.test(t)) return "conditional";
  return "free";
}
function compileBlockRules(text) {
  const rules = [];
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^\/(.+)\/([gimsuy]*)$/);
    if (m) {
      try {
        rules.push({ label: line, test: (s) => new RegExp(m[1], m[2].replace("g", "")).test(s) });
      } catch {
      }
    } else {
      const w = line.toLowerCase();
      rules.push({ label: line, test: (s) => s.toLowerCase().includes(w) });
    }
  }
  return rules;
}
function matchBlock(rules, text) {
  for (const r of rules) if (r.test(text)) return r.label;
  return null;
}
function titleFingerprint(title) {
  return String(title || "").toLowerCase().replace(/【[^】]*】|\[[^\]]*\]|\([^)]*\)|（[^）]*）/g, "").replace(/https?:\/\/\S+/g, "").replace(/[^\p{L}\p{N}]+/gu, "").slice(0, 60);
}

// src/crawler.js
var UA = "Mozilla/5.0 (compatible; FreeResourceRadar/1.0; +https://workers.cloudflare.com)";
var DAY = 864e5;
async function getText(url, headers = {}) {
  const r = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "*/*", ...headers },
    signal: AbortSignal.timeout(2e4)
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}
var getJson = async (url, headers) => JSON.parse(await getText(url, { Accept: "application/json", ...headers }));
function decodeEntities(s) {
  return String(s || "").replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10))).replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}
function cleanText(s) {
  let t = String(s || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  t = decodeEntities(t);
  t = t.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
  return decodeEntities(t).replace(/\s+/g, " ").trim();
}
function tag(block, name) {
  const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i");
  const m = block.match(re);
  return m ? m[1] : "";
}
function parseDate(s) {
  if (!s) return null;
  const t = Date.parse(String(s).replace(/<!\[CDATA\[|\]\]>/g, "").trim());
  return Number.isFinite(t) ? t : null;
}
function parseFeed(xml) {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  return blocks.map((b) => {
    let link = cleanText(tag(b, "link"));
    if (!link) {
      const alt = b.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i) || b.match(/<link[^>]*href=["']([^"']+)["']/i);
      link = alt ? decodeEntities(alt[1]) : cleanText(tag(b, "guid"));
    }
    return {
      title: cleanText(tag(b, "title")),
      url: link,
      published_at: parseDate(tag(b, "pubDate") || tag(b, "published") || tag(b, "dc:date") || tag(b, "updated")),
      raw_text: cleanText(tag(b, "description") || tag(b, "summary") || tag(b, "content:encoded") || tag(b, "content")).slice(0, 1500)
    };
  });
}
function normalizeUrl(u) {
  try {
    const url = new URL(String(u).trim());
    url.hash = "";
    for (const k of [...url.searchParams.keys()]) if (/^(utm_|ref$|source$|spm$)/i.test(k)) url.searchParams.delete(k);
    return url.toString();
  } catch {
    return String(u || "").trim();
  }
}
async function hashId(s) {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function fetchSource(src, cutoff, env) {
  const q = encodeURIComponent(src.query || "");
  switch (src.type) {
    case "hn": {
      const j = await getJson(`https://hn.algolia.com/api/v1/search_by_date?query=${q}&advancedSyntax=true&tags=story&hitsPerPage=50&numericFilters=created_at_i>${Math.floor(cutoff / 1e3)}`);
      return (j.hits || []).map((h) => ({
        title: h.title || "",
        url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
        published_at: (h.created_at_i || 0) * 1e3 || parseDate(h.created_at),
        raw_text: cleanText(h.story_text || "").slice(0, 1500) + ` (HN: https://news.ycombinator.com/item?id=${h.objectID})`
      }));
    }
    case "v2ex": {
      const j = await getJson(`https://www.v2ex.com/api/topics/show.json?node_name=${encodeURIComponent(src.node || "free")}`);
      if (!Array.isArray(j)) throw new Error("V2EX \u8FD4\u56DE\u5F02\u5E38");
      return j.map((t) => ({
        title: t.title || "",
        url: t.url || `https://www.v2ex.com/t/${t.id}`,
        published_at: (t.created || 0) * 1e3 || null,
        raw_text: cleanText(t.content || "").slice(0, 1500)
      }));
    }
    case "reddit": {
      const base = src.subreddit ? `https://www.reddit.com/r/${src.subreddit}/search.json?restrict_sr=1&` : "https://www.reddit.com/search.json?";
      const j = await getJson(`${base}q=${q}&sort=new&t=year&limit=50`);
      return (j.data?.children || []).map(({ data: d }) => ({
        title: d.title || "",
        url: `https://www.reddit.com${d.permalink}`,
        published_at: (d.created_utc || 0) * 1e3 || null,
        raw_text: [d.selftext, d.url && !d.is_self ? `\u94FE\u63A5\uFF1A${d.url}` : ""].filter(Boolean).join(" ").slice(0, 1500)
      }));
    }
    case "github": {
      const since = new Date(cutoff).toISOString().slice(0, 10);
      const headers = { Accept: "application/vnd.github+json" };
      if (env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
      const j = await getJson(`https://api.github.com/search/repositories?q=${encodeURIComponent(`${src.query} pushed:>${since}`)}&sort=updated&order=desc&per_page=30`, headers);
      return (j.items || []).map((r) => ({
        title: `${r.full_name}${r.description ? " - " + r.description : ""}`,
        url: r.html_url,
        published_at: parseDate(r.pushed_at),
        raw_text: `${r.description || ""} \u2605${r.stargazers_count}${r.homepage ? " \u4E3B\u9875\uFF1A" + r.homepage : ""}`
      }));
    }
    case "rss":
    default:
      if (!src.url) throw new Error("\u7F3A\u5C11 url");
      return parseFeed(await getText(src.url, { Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*" }));
  }
}
var CJK2 = /[\u4e00-\u9fff]/;
function isBlocked(u, domains) {
  if (!domains.length) return false;
  let host = "";
  try {
    host = new URL(u).hostname.toLowerCase();
  } catch {
    return false;
  }
  return domains.some((d) => host === d || host.endsWith("." + d));
}
var containsAny = (text, words) => words.some((w) => text.includes(w));
function heuristicJudge(item, s) {
  const text = `${item.title} ${item.raw_text || ""}`.toLowerCase();
  const hard = lines(s.hard_signup_keywords).find((w) => text.includes(w));
  const isDomain = /域名|domain|subdomain/.test(text);
  const obtain = guessObtain(item.title, item.raw_text || "");
  const allowed = lines(s.allowed_obtain);
  return {
    status: hard || !allowed.includes(obtain) ? "rejected" : "approved",
    obtain,
    category: isDomain ? "domain" : "hosting",
    name: null,
    summary: (item.raw_text || "").slice(0, 120),
    signup: hard ? `\u7591\u4F3C\u9700\u8981\uFF1A${hard}` : allowed.includes(obtain) ? "\u672A\u7ECF AI \u5224\u5B9A" : `\u83B7\u53D6\u65B9\u5F0F\uFF1A${obtain}`,
    score: null,
    judged_by: "keywords"
  };
}
async function runCrawl(env, trigger = "cron") {
  const startedAt = Date.now();
  const s = await getSettings(env);
  const maxAgeDays = Math.max(1, Number(s.max_age_days) || 180);
  const cutoff = startedAt - maxAgeDays * DAY;
  const keepUndated = s.keep_undated === "true";
  const topicWords = lines(s.topic_keywords);
  const freeWords = lines(s.free_keywords);
  const hardWords = lines(s.hard_signup_keywords);
  const blockDomains = lines(s.search_block_domains);
  const searchLang = s.search_lang || "zh_first";
  const blockRules = compileBlockRules(s.block_rules);
  const noiseOn = s.noise_filter !== "false";
  const log = [];
  const stats = { fetched: 0, blocked: 0, block_rule: 0, noise: 0, dup_title: 0, non_zh: 0, hard_signup: 0, too_old: 0, undated: 0, off_topic: 0, candidates: 0, new: 0, judged: 0, approved: 0, rejected: 0, expired_removed: 0, errors: 0 };
  let sources = [];
  try {
    sources = JSON.parse(s.sources).filter((x) => x && x.enabled !== false);
  } catch (e) {
    log.push(`\u6570\u636E\u6E90 JSON \u89E3\u6790\u5931\u8D25\uFF1A${e.message}`);
  }
  const tasks = sources.map(
    (src) => fetchSource(src, cutoff, env).then(
      (items) => ({ src, items: items.map((it) => ({ ...it, source: src.name || src.type })) }),
      (err) => ({ src, error: err })
    )
  );
  const aiReady = s.ai_enabled === "true" && s.ai_api_key && s.ai_base_url && s.ai_model;
  const searchReady = s.search_enabled === "true" && s.search_api_key && s.search_base_url && s.search_model;
  if (searchReady) {
    tasks.push(
      searchWithModel(s, maxAgeDays).then(
        (items) => ({ src: { name: "AI \u8054\u7F51\u641C\u7D22", isSearch: true }, items }),
        (err) => ({ src: { name: "AI \u8054\u7F51\u641C\u7D22" }, error: err })
      )
    );
  }
  const apiSearch = (name, fn) => tasks.push(fn(s, maxAgeDays).then(
    ({ items, errors }) => {
      for (const e of errors) log.push(`! ${name} \u90E8\u5206\u67E5\u8BE2\u5931\u8D25\uFF1A${e}`);
      return { src: { name, isSearch: true }, items };
    },
    (err) => ({ src: { name }, error: err })
  ));
  if (s.tavily_enabled === "true") apiSearch("Tavily \u641C\u7D22", searchTavily);
  if (s.keenable_enabled === "true") apiSearch("Keenable \u641C\u7D22", searchKeenable);
  const results = await Promise.all(tasks);
  const candidates = /* @__PURE__ */ new Map();
  const seenFp = /* @__PURE__ */ new Set();
  for (const r of results) {
    if (r.error) {
      stats.errors++;
      log.push(`\u2717 ${r.src.name}: ${r.error.message}`);
      continue;
    }
    log.push(`\u2713 ${r.src.name}: ${r.items.length} \u6761`);
    for (const it of r.items) {
      stats.fetched++;
      if (!it.url || !it.title) continue;
      if (!it.published_at) {
        if (!keepUndated) {
          stats.undated++;
          continue;
        }
      } else if (it.published_at < cutoff) {
        stats.too_old++;
        continue;
      }
      if (isBlocked(it.url, blockDomains)) {
        stats.blocked++;
        continue;
      }
      if (noiseOn && isNoiseTitle(it.title)) {
        stats.noise++;
        continue;
      }
      if (blockRules.length && matchBlock(blockRules, `${it.title}
${it.raw_text || ""}`)) {
        stats.block_rule++;
        continue;
      }
      if (r.src.isSearch) {
        const zh = it.lang ? it.lang.startsWith("zh") : CJK2.test(it.title);
        if (searchLang === "zh_only" && !zh) {
          stats.non_zh++;
          continue;
        }
        const t = `${it.title} ${it.raw_text || ""}`.toLowerCase();
        if (hardWords.some((w) => t.includes(w) && !t.includes("\u65E0\u9700" + w) && !t.includes("\u4E0D\u9700\u8981" + w) && !t.includes("no " + w))) {
          stats.hard_signup++;
          continue;
        }
      }
      if (r.src.filter !== false) {
        const text = `${it.title} ${it.raw_text || ""}`.toLowerCase();
        if (!containsAny(text, topicWords) || !containsAny(text, freeWords)) {
          stats.off_topic++;
          continue;
        }
      }
      const url = normalizeUrl(it.url);
      const id = await hashId(url);
      const fp = titleFingerprint(it.title);
      if (candidates.has(id)) continue;
      if (fp.length >= 8 && seenFp.has(fp)) {
        stats.dup_title++;
        continue;
      }
      if (fp.length >= 8) seenFp.add(fp);
      candidates.set(id, { ...it, url, id, fp });
    }
  }
  stats.candidates = candidates.size;
  const ids = [...candidates.keys()];
  const existing = /* @__PURE__ */ new Set();
  const existingFp = /* @__PURE__ */ new Set();
  const today = dayOf(startedAt);
  for (let i = 0; i < ids.length; i += 45) {
    const chunk = ids.slice(i, i + 45);
    const fps = chunk.map((id) => candidates.get(id).fp || "-");
    const { results: rows } = await env.DB.prepare(
      `SELECT id, fp FROM seen WHERE id IN (${chunk.map(() => "?").join(",")}) OR fp IN (${fps.map(() => "?").join(",")})`
    ).bind(...chunk, ...fps).all();
    for (const row of rows || []) {
      existing.add(row.id);
      if (row.fp) existingFp.add(row.fp);
    }
  }
  const inserts = [];
  for (const [id, it] of candidates) {
    if (existing.has(id)) continue;
    if (it.fp && it.fp.length >= 8 && existingFp.has(it.fp)) {
      stats.dup_title++;
      continue;
    }
    inserts.push(
      env.DB.prepare("INSERT OR IGNORE INTO items (id, title, url, source, raw_text, published_at, fetched_at, status, fp, day) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(id, it.title.slice(0, 500), it.url, it.source || "", (it.raw_text || "").slice(0, 2e3), it.published_at || null, startedAt, "pending", it.fp || null, today),
      env.DB.prepare("INSERT OR IGNORE INTO seen (id, fp, seen_at) VALUES (?, ?, ?)").bind(id, it.fp || null, startedAt)
    );
  }
  for (let i = 0; i < inserts.length; i += 50) await env.DB.batch(inserts.slice(i, i + 50));
  stats.new = inserts.length / 2;
  const maxItems = Math.max(1, Number(s.ai_max_items) || 40);
  const { results: pending } = await env.DB.prepare(
    "SELECT * FROM items WHERE status = ? AND (published_at IS NULL OR published_at >= ?) ORDER BY published_at DESC LIMIT ?"
  ).bind("pending", cutoff, maxItems).all();
  const updates = [];
  const applyVerdict = (it, v) => {
    updates.push(
      env.DB.prepare("UPDATE items SET status=?, category=?, name=?, summary=?, signup=?, score=?, obtain=?, judged_by=?, judged_at=? WHERE id=?").bind(v.status, v.category, v.name, v.summary, v.signup, v.score, v.obtain || null, v.judged_by, Date.now(), it.id)
    );
    stats.judged++;
    if (v.status === "approved") stats.approved++;
    else stats.rejected++;
  };
  if (aiReady) {
    const minScore = Number(s.ai_min_score) || 60;
    const allowedObtain = lines(s.allowed_obtain);
    const batchSize = Math.min(20, Math.max(1, Number(s.ai_batch_size) || 8));
    const aiItems = (pending || []).filter((it) => it.attempts < 3);
    for (const it of (pending || []).filter((x) => x.attempts >= 3)) applyVerdict(it, heuristicJudge(it, s));
    const batches = [];
    for (let i = 0; i < aiItems.length; i += batchSize) batches.push(aiItems.slice(i, i + batchSize));
    for (let i = 0; i < batches.length; i += 3) {
      await Promise.all(batches.slice(i, i + 3).map(async (batch) => {
        try {
          const verdicts = await judgeBatch(batch, s);
          batch.forEach((it, idx) => {
            const v = verdicts.get(idx);
            if (!v) {
              updates.push(env.DB.prepare("UPDATE items SET attempts = attempts + 1 WHERE id=?").bind(it.id));
              return;
            }
            const score = Math.round(Number(v.score) || 0);
            const obtain = ["free", "conditional", "lottery", "trial", "promo", "paid"].includes(v.obtain) ? v.obtain : guessObtain(it.title, it.raw_text || "");
            const ok = v.relevant === true && v.simple_signup === true && score >= minScore && allowedObtain.includes(obtain);
            applyVerdict(it, {
              status: ok ? "approved" : "rejected",
              category: ["domain", "hosting"].includes(v.category) ? v.category : "other",
              name: v.name ? String(v.name).slice(0, 100) : null,
              summary: v.summary ? String(v.summary).slice(0, 300) : null,
              signup: v.signup ? String(v.signup).slice(0, 100) : null,
              score,
              obtain,
              judged_by: `ai:${s.ai_model}`
            });
          });
        } catch (e) {
          stats.errors++;
          log.push(`\u2717 AI \u5224\u5B9A\u5931\u8D25\uFF1A${e.message}`);
          for (const it of batch) updates.push(env.DB.prepare("UPDATE items SET attempts = attempts + 1 WHERE id=?").bind(it.id));
        }
      }));
    }
  } else {
    if (s.ai_enabled === "true") log.push("AI \u5DF2\u542F\u7528\u4F46\u914D\u7F6E\u4E0D\u5B8C\u6574\uFF0C\u4F7F\u7528\u5173\u952E\u8BCD\u5224\u5B9A");
    for (const it of pending || []) applyVerdict(it, heuristicJudge(it, s));
  }
  for (let i = 0; i < updates.length; i += 50) await env.DB.batch(updates.slice(i, i + 50));
  const keepMs = Math.max(1, Number(s.retention_days) || 15) * 864e5;
  const del = await env.DB.prepare("DELETE FROM items WHERE fetched_at < ? OR (published_at IS NOT NULL AND published_at < ?)").bind(startedAt - keepMs, cutoff).run();
  stats.expired_removed = del.meta?.changes || 0;
  await env.DB.prepare("DELETE FROM seen WHERE seen_at < ?").bind(Math.min(cutoff, startedAt - keepMs)).run();
  await env.DB.prepare("DELETE FROM runs WHERE started_at < ?").bind(startedAt - keepMs).run();
  const finishedAt = Date.now();
  log.push(`\u8017\u65F6 ${((finishedAt - startedAt) / 1e3).toFixed(1)}s`);
  await env.DB.prepare("INSERT INTO runs (trigger, started_at, finished_at, stats, log) VALUES (?, ?, ?, ?, ?)").bind(trigger, startedAt, finishedAt, JSON.stringify(stats), log.join("\n")).run();
  await env.DB.prepare("DELETE FROM runs WHERE id NOT IN (SELECT id FROM runs ORDER BY id DESC LIMIT 60)").run();
  return { stats, log };
}

// src/mailer.js
var esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var recipients = (s) => String(s || "").split(/[,;\s]+/).map((x) => x.trim()).filter((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));
var ymd = (t) => new Date(t + 8 * 36e5).toISOString().slice(0, 10);
var CAT = { domain: "\u514D\u8D39\u57DF\u540D", hosting: "\u514D\u8D39\u865A\u62DF\u4E3B\u673A", other: "\u5176\u4ED6" };
var OBTAIN_ZH = { free: "\u76F4\u63A5\u767D\u5AD6", conditional: "\u6709\u6761\u4EF6", lottery: "\u62BD\u5956", trial: "\u8BD5\u7528", promo: "\u63A8\u5E7F", paid: "\u9700\u4ED8\u8D39" };
async function collectDigest(env, s) {
  const onlyNew = s.mail_only_new !== "false";
  const since = onlyNew ? Number(s.mail_last_sent_at) || 0 : 0;
  const cutoff = Date.now() - (Number(s.max_age_days) || 180) * 864e5;
  const limit = Math.min(200, Number(s.mail_max_items) || 60);
  const { results } = await env.DB.prepare(
    `SELECT * FROM items WHERE status = 'approved' AND COALESCE(judged_at, fetched_at) > ? AND (published_at IS NULL OR published_at >= ?)
     ORDER BY CASE category WHEN 'domain' THEN 0 WHEN 'hosting' THEN 1 ELSE 2 END, score DESC, published_at DESC LIMIT ?`
  ).bind(since, cutoff, limit).all();
  return results || [];
}
function renderDigest(items, s, dateStr) {
  const groups = {};
  for (const it of items) (groups[it.category || "other"] ||= []).push(it);
  const siteUrl = (s.mail_site_url || "").replace(/\/+$/, "");
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Hiragino Sans GB','Microsoft YaHei',Arial,sans-serif";
  const section = (cat, list) => `
<tr><td style="padding:22px 24px 6px;font-family:${font};font-size:16px;font-weight:bold;color:#111827;border-bottom:1px solid #e6e8ec;">${CAT[cat] || cat}\uFF08${list.length}\uFF09</td></tr>
${list.map((it) => `
<tr><td style="padding:14px 24px;border-bottom:1px solid #eeeeee;font-family:${font};">
  <a href="${esc(it.url)}" target="_blank" style="font-size:15px;font-weight:bold;color:#111318;text-decoration:none;line-height:1.5;word-break:break-all;">${esc(it.name || it.title)}</a>
  ${it.name && it.name !== it.title ? `<div style="font-size:12px;color:#9ca3af;line-height:1.5;margin-top:2px;">${esc(it.title)}</div>` : ""}
  ${it.summary ? `<div style="font-size:14px;color:#374151;line-height:1.6;margin-top:6px;">${esc(it.summary)}</div>` : ""}
  <div style="font-size:12px;color:#6b7280;line-height:1.6;margin-top:6px;">
    ${it.obtain ? `<span style="color:${it.obtain === "free" ? "#047857" : "#92400e"};font-weight:bold;">${OBTAIN_ZH[it.obtain] || ""}</span>&nbsp; ` : ""}${it.signup ? `<span style="background:#fef3c7;color:#92400e;padding:1px 6px;border-radius:4px;">\u6CE8\u518C\uFF1A${esc(it.signup)}</span>&nbsp; ` : ""}
    ${it.published_at ? ymd(it.published_at) + " \xB7 " : ""}${esc(it.source || "")}${it.score != null ? " \xB7 " + it.score + "\u5206" : ""}
  </div>
</td></tr>`).join("")}`;
  const body = items.length ? Object.keys(CAT).filter((c) => groups[c]).map((c) => section(c, groups[c])).join("") : `<tr><td style="padding:30px 24px;font-family:${font};font-size:14px;color:#6b7280;text-align:center;">\u4ECA\u5929\u6CA1\u6709\u65B0\u7684\u8D44\u6E90\u3002</td></tr>`;
  const html2 = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting">
<title>${esc(s.mail_subject)}</title>
<!--[if mso]><style>table,td,a,div{font-family:'Microsoft YaHei',Arial,sans-serif !important;}</style><![endif]-->
<style>@media only screen and (max-width:620px){.container{width:100% !important;}}</style>
</head>
<body style="margin:0;padding:0;background:#f6f7f9;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${items.length ? `\u4ECA\u65E5 ${items.length} \u6761\u65B0\u8D44\u6E90\uFF1A${esc(items.slice(0, 3).map((i) => i.name || i.title).join("\u3001"))}` : "\u4ECA\u5929\u6CA1\u6709\u65B0\u8D44\u6E90"}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f6f7f9;">
<tr><td align="center" style="padding:20px 10px;">
<table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:8px;">
<tr><td style="padding:22px 24px;background:#111318;border-radius:8px 8px 0 0;font-family:${font};">
  <div style="font-size:19px;font-weight:bold;color:#ffffff;">${esc(s.mail_subject)}</div>
  <div style="font-size:13px;color:#d1d5db;margin-top:4px;">${dateStr} \xB7 \u5171 ${items.length} \u6761 \xB7 \u53EA\u6536\u5F55\u534A\u5E74\u5185\u3001\u6CE8\u518C\u7B80\u5355\u7684\u8D44\u6E90</div>
</td></tr>
${body}
<tr><td style="padding:18px 24px;font-family:${font};font-size:12px;color:#9ca3af;line-height:1.6;">
  ${siteUrl ? `<a href="${esc(siteUrl)}" target="_blank" style="color:#312e81;text-decoration:none;">\u67E5\u770B\u5168\u90E8\u8D44\u6E90 \u2192</a>&nbsp;\xB7&nbsp;<a href="${esc(siteUrl)}/feed.xml" target="_blank" style="color:#9ca3af;">RSS</a><br>` : ""}
  \u7531 Cloudflare Workers \u81EA\u52A8\u6293\u53D6\u5E76\u7ECF AI \u7B5B\u9009\uFF0C\u4F7F\u7528\u524D\u8BF7\u81EA\u884C\u786E\u8BA4\u670D\u52A1\u6761\u6B3E\u3002
</td></tr>
</table></td></tr></table></body></html>`;
  const text = [`${s.mail_subject} \xB7 ${dateStr} \xB7 \u5171 ${items.length} \u6761`, ""].concat(items.length ? Object.keys(CAT).filter((c) => groups[c]).flatMap((c) => [
    `\u3010${CAT[c]}\u3011`,
    ...groups[c].map((it, i) => `${i + 1}. ${it.name || it.title}
   ${it.url}${it.summary ? "\n   " + it.summary : ""}${it.signup ? "\n   \u6CE8\u518C\uFF1A" + it.signup : ""}`),
    ""
  ]) : ["\u4ECA\u5929\u6CA1\u6709\u65B0\u7684\u8D44\u6E90\u3002"]).concat(siteUrl ? [`\u67E5\u770B\u5168\u90E8\uFF1A${siteUrl}`] : []).join("\n");
  return { html: html2, text };
}
var b642 = (str) => {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 32768) bin += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(bin);
};
var wrap76 = (s) => s.replace(/.{1,76}/g, "$&\r\n").trim();
var encHeader = (s) => `=?UTF-8?B?${b642(s)}?=`;
function buildMime({ fromName, from, to, subject, html: html2, text }) {
  const toList = Array.isArray(to) ? to : [to];
  const boundary = "b_" + crypto.randomUUID().replace(/-/g, "");
  const domain = from.split("@")[1] || "localhost";
  return [
    `From: ${encHeader(fromName)} <${from}>`,
    `To: ${toList.map((a) => `<${a}>`).join(", ")}`,
    `Subject: ${encHeader(subject)}`,
    `Date: ${(/* @__PURE__ */ new Date()).toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@${domain}>`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrap76(b642(text)),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrap76(b642(html2)),
    `--${boundary}--`,
    ""
  ].join("\r\n");
}
async function sendMail(env, s, { subject, html: html2, text }) {
  const to = recipients(s.mail_to);
  if (!to.length) throw new Error("\u672A\u586B\u5199\u6709\u6548\u7684\u6536\u4EF6\u4EBA");
  const provider = s.mail_provider || "smtp";
  const fromName = s.mail_from_name || "\u514D\u8D39\u8D44\u6E90\u96F7\u8FBE";
  if (provider === "smtp") {
    if (!s.smtp_user || !s.smtp_pass) throw new Error("\u672A\u586B\u5199 SMTP \u8D26\u53F7\u6216\u6388\u6743\u7801");
    const from = s.mail_from || s.smtp_user;
    const { smtpSend: smtpSend2 } = await Promise.resolve().then(() => (init_smtp(), smtp_exports));
    const raw = buildMime({ fromName, from, to, subject, html: html2, text });
    await smtpSend2({ host: s.smtp_host || "smtp.qq.com", port: s.smtp_port || 465, secure: s.smtp_secure || "ssl", user: s.smtp_user, pass: s.smtp_pass, from, to, raw });
    return { provider, to };
  }
  if (!s.mail_from) throw new Error("\u672A\u586B\u5199\u53D1\u4EF6\u5730\u5740");
  if (provider === "resend") {
    if (!s.mail_api_key) throw new Error("\u672A\u586B\u5199 Resend API Key");
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${s.mail_api_key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: `${fromName} <${s.mail_from}>`, to, subject, html: html2, text })
    });
    if (!r.ok) throw new Error(`Resend HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
    return { provider, to };
  }
  if (provider === "brevo") {
    if (!s.mail_api_key) throw new Error("\u672A\u586B\u5199 Brevo API Key");
    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": s.mail_api_key, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ sender: { name: fromName, email: s.mail_from }, to: to.map((email) => ({ email })), subject, htmlContent: html2, textContent: text })
    });
    if (!r.ok) throw new Error(`Brevo HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
    return { provider, to };
  }
  if (provider === "cloudflare") {
    if (!env.MAILER) throw new Error("\u672A\u7ED1\u5B9A send_email\uFF08MAILER\uFF09\uFF0C\u8BF7\u5728 wrangler.toml \u4E2D\u5F00\u542F\u5E76\u914D\u7F6E Email Routing");
    const { EmailMessage } = await import("cloudflare:email");
    for (const addr of to) {
      const raw = buildMime({ fromName, from: s.mail_from, to: addr, subject, html: html2, text });
      await env.MAILER.send(new EmailMessage(s.mail_from, addr, raw));
    }
    return { provider, to };
  }
  throw new Error(`\u672A\u77E5\u7684\u90AE\u4EF6\u670D\u52A1\uFF1A${provider}`);
}
async function previewDigest(env) {
  const s = await getSettings(env);
  const items = await collectDigest(env, s);
  return renderDigest(items, s, ymd(Date.now())).html;
}
var tgEsc = (x) => String(x ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
async function sendTelegram(s, items, title) {
  if (!s.telegram_bot_token || !s.telegram_chat_id) throw new Error("\u672A\u586B\u5199 Telegram Bot Token \u6216 Chat ID");
  const blocks = items.map((it) => {
    const tags = [CAT[it.category] || "", it.obtain ? OBTAIN_ZH[it.obtain] : "", it.signup ? `\u6CE8\u518C\uFF1A${it.signup}` : ""].filter(Boolean).join(" \xB7 ");
    return `\u25AA\uFE0F <a href="${tgEsc(it.url)}">${tgEsc(it.name || it.title)}</a>${it.summary ? `
${tgEsc(it.summary)}` : ""}${tags ? `
<i>${tgEsc(tags)}</i>` : ""}`;
  });
  const head = `<b>${tgEsc(title)}</b>`;
  const msgs = [];
  let cur = head;
  for (const b of blocks.length ? blocks : ["\u4ECA\u5929\u6CA1\u6709\u65B0\u7684\u8D44\u6E90\u3002"]) {
    if ((cur + "\n\n" + b).length > 3800) {
      msgs.push(cur);
      cur = b;
    } else cur += "\n\n" + b;
  }
  msgs.push(cur);
  for (const text of msgs) {
    const r = await fetch(`https://api.telegram.org/bot${s.telegram_bot_token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: s.telegram_chat_id, text, parse_mode: "HTML", disable_web_page_preview: true })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) throw new Error(`Telegram \u53D1\u9001\u5931\u8D25\uFF1A${j.description || r.status}`);
  }
  return { provider: "telegram", to: [String(s.telegram_chat_id)] };
}
async function sendDigest(env, { force = false, test = false, channel } = {}) {
  const s = await getSettings(env);
  const startedAt = Date.now();
  const mailReady = !!String(s.mail_to || "").trim() && (s.mail_provider === "smtp" || !s.mail_provider ? !!(s.smtp_user && s.smtp_pass) : s.mail_provider === "cloudflare" ? !!s.mail_from : !!(s.mail_api_key && s.mail_from));
  const tgReady = !!(s.telegram_bot_token && s.telegram_chat_id);
  const channels = channel ? [channel] : [s.mail_enabled === "true" && mailReady && "mail", s.telegram_enabled === "true" && tgReady && "telegram"].filter(Boolean);
  if (!channels.length) return { skipped: "\u6CA1\u6709\u53EF\u7528\u7684\u63A8\u9001\u6E20\u9053\uFF08\u90AE\u4EF6\u9700\u586B\u5199\u8D26\u53F7\u3001\u6388\u6743\u7801\u548C\u6536\u4EF6\u4EBA\uFF0C\u6216\u914D\u7F6E Telegram\uFF09" };
  const items = test ? (await collectDigest(env, { ...s, mail_only_new: "false" })).slice(0, 5) : await collectDigest(env, s);
  if (!test && !items.length && s.mail_send_empty !== "true") return { skipped: "\u6CA1\u6709\u65B0\u5185\u5BB9" };
  const dateStr = ymd(Date.now());
  const subject = `${test ? "[\u6D4B\u8BD5] " : ""}${s.mail_subject} \xB7 ${dateStr}${items.length ? `\uFF08${items.length} \u6761\uFF09` : ""}`;
  const results = [];
  const errors = [];
  for (const ch of channels) {
    try {
      if (ch === "mail") results.push(await sendMail(env, s, { subject, ...renderDigest(items, s, dateStr) }));
      else results.push(await sendTelegram(s, items, subject));
    } catch (e) {
      errors.push(`${ch === "mail" ? "\u90AE\u4EF6" : "Telegram"}\uFF1A${e.message}`);
    }
  }
  if (!results.length) throw new Error(errors.join("\uFF1B"));
  if (!test) await saveSettings(env, { mail_last_sent_at: String(startedAt) });
  return { sent: items.length, to: results.flatMap((r) => r.to), providers: results.map((r) => r.provider), errors };
}

// src/admin.html
var admin_default = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>\u7BA1\u7406 \xB7 \u514D\u8D39\u8D44\u6E90\u96F7\u8FBE</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><circle cx='8' cy='8' r='5' fill='%23312e81'/></svg>" />
<style>
  :root {
    --canvas:#f6f7f9; --canvas-subtle:#eceef2; --surface:#fff; --hover:#f7f8fb; --muted:#f1f3f6;
    --ink-950:#111318; --ink-700:#374151; --ink-600:#4b5563; --ink-500:#525c6b; --ink-400:#646f80; --ink-300:#d1d5de; --ink-200:#e6e8ec;
    --brand:#111318; --brand-hover:#272b36; --brand-subtle:#eef0ff; --brand-border:#c7d0f8; --accent:#312e81;
    --deal:#047857; --deal-subtle:#ecfdf5; --code:#92400e; --code-subtle:#fef3c7; --alert:#dc2626; --alert-subtle:#fef2f2;
    --mono: ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  }
  * { box-sizing:border-box; }
  html, body { margin:0; height:100%; }
  body { font:13px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif; color:var(--ink-950); background:var(--surface); -webkit-font-smoothing:antialiased; }
  ::selection { background:var(--brand-subtle); }
  a { color:var(--accent); text-decoration:none; }
  a:hover { text-decoration:underline; }
  .app { display:grid; grid-template-columns:240px minmax(0,1fr); min-height:100vh; }
  /* \u5DE6\u5BFC\u8F68 */
  .rail { background:var(--canvas); border-right:1px solid var(--ink-200); padding:18px 12px; position:sticky; top:0; height:100vh; overflow:auto; }
  .brand { display:flex; align-items:center; gap:8px; font-weight:600; font-size:14px; padding:2px 8px 16px; }
  .dot { width:8px; height:8px; border-radius:50%; background:var(--accent); flex:none; }
  .nav-title { font:600 11px/1.3 var(--mono); color:var(--ink-400); text-transform:uppercase; letter-spacing:.04em; padding:14px 8px 6px; }
  .nav a { display:flex; justify-content:space-between; align-items:center; padding:7px 10px; border-radius:6px; color:var(--ink-700); font-size:13px; }
  .nav a:hover { background:var(--canvas-subtle); text-decoration:none; }
  .nav a.on { background:var(--canvas-subtle); color:var(--ink-950); font-weight:600; }
  .nav .n { font:600 11px var(--mono); color:var(--ink-400); font-variant-numeric:tabular-nums; }
  /* \u4E3B\u753B\u5E03 */
  .main { min-width:0; }
  .top { position:sticky; top:0; z-index:5; background:rgba(255,255,255,.92); backdrop-filter:blur(8px); border-bottom:1px solid var(--ink-200); padding:14px 28px; display:flex; align-items:center; gap:10px; }
  .top h1 { font-size:17px; font-weight:600; margin:0; flex:1; }
  .page { padding:22px 28px 60px; max-width:980px; }
  .panel { display:none; }
  .panel.on { display:block; }
  .section { border:1px solid var(--ink-200); border-radius:8px; margin-bottom:16px; }
  .section > header { display:flex; align-items:center; gap:10px; padding:12px 16px; border-bottom:1px solid var(--ink-200); }
  .section > header h2 { font-size:14px; font-weight:600; margin:0; flex:1; }
  .section .body { padding:14px 16px; display:grid; gap:14px; }
  .grid2 { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px 16px; }
  .grid3 { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px 16px; }
  label.f { display:block; font-size:12px; color:var(--ink-500); margin-bottom:4px; }
  input[type=text], input[type=password], input[type=number], select, textarea {
    width:100%; height:36px; padding:0 10px; border:1px solid var(--ink-200); border-radius:6px; font:inherit; color:var(--ink-950); background:var(--surface); outline:none; }
  textarea { height:auto; min-height:110px; padding:8px 10px; font:12px/1.55 var(--mono); resize:vertical; }
  input:focus, select:focus, textarea:focus { border-color:var(--brand-border); box-shadow:0 0 0 3px var(--brand-subtle); }
  .hint { font-size:12px; color:var(--ink-400); }
  .row { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
  .row > .grow { flex:1; min-width:180px; }
  .btn { height:32px; padding:0 12px; border-radius:6px; border:1px solid var(--ink-200); background:var(--surface); color:var(--ink-700); font:inherit; cursor:pointer; white-space:nowrap; }
  .btn:hover { background:var(--hover); }
  .btn.pri { background:var(--brand); border-color:var(--brand); color:#fff; }
  .btn.pri:hover { background:var(--brand-hover); }
  .btn.danger { color:var(--alert); }
  .btn:disabled { opacity:.55; cursor:wait; }
  .btn.sm { height:26px; padding:0 8px; font-size:12px; }
  /* \u5F00\u5173 */
  .sw { display:inline-flex; align-items:center; gap:8px; cursor:pointer; font-size:13px; color:var(--ink-700); user-select:none; }
  .sw input { appearance:none; width:30px; height:18px; border-radius:999px; background:var(--ink-300); position:relative; cursor:pointer; transition:.15s; margin:0; }
  .sw input::after { content:""; position:absolute; top:2px; left:2px; width:14px; height:14px; border-radius:50%; background:#fff; transition:.15s; }
  .sw input:checked { background:var(--brand); }
  .sw input:checked::after { left:14px; }
  .chk { display:inline-flex; align-items:center; gap:6px; margin-right:14px; font-size:13px; color:var(--ink-700); }
  /* \u5217\u8868 */
  .tabs { display:flex; gap:18px; border-bottom:1px solid var(--ink-200); margin-bottom:4px; }
  .tabs button { background:none; border:none; padding:8px 0; font:inherit; color:var(--ink-500); cursor:pointer; border-bottom:2px solid transparent; margin-bottom:-1px; }
  .tabs button.on { color:var(--ink-950); font-weight:600; border-color:var(--accent); }
  .tabs .n { font:600 11px var(--mono); color:var(--ink-400); margin-left:4px; }
  .item { display:grid; grid-template-columns:40px minmax(0,1fr) auto; gap:10px; padding:12px 6px; border-bottom:1px solid var(--ink-200); align-items:start; }
  .item:hover { background:var(--hover); }
  .score { font:600 12px var(--mono); color:var(--ink-400); text-align:right; padding-top:1px; font-variant-numeric:tabular-nums; }
  .score.hi { color:var(--deal); }
  .t { font-size:14px; font-weight:500; color:var(--ink-950); line-height:1.35; word-break:break-word; }
  .t:hover { color:var(--accent); text-decoration:none; }
  .free { color:var(--deal); font-size:12px; margin-left:6px; }
  .cond { color:var(--code); font-size:12px; margin-left:6px; }
  .sum { color:var(--ink-600); margin-top:3px; }
  .meta { color:var(--ink-400); font-size:12px; margin-top:3px; }
  .meta i { font-style:normal; margin:0 5px; color:var(--ink-300); }
  .acts { display:flex; gap:4px; opacity:.35; transition:.12s; }
  .item:hover .acts { opacity:1; }
  .empty { color:var(--ink-400); padding:40px 0; text-align:center; }
  details { border-bottom:1px solid var(--ink-200); padding:10px 4px; }
  summary { cursor:pointer; color:var(--ink-700); }
  pre { background:var(--muted); border-radius:6px; padding:10px 12px; font:12px/1.55 var(--mono); white-space:pre-wrap; word-break:break-all; margin:8px 0 0; }
  .callout { background:var(--brand-subtle); border:1px solid var(--brand-border); color:var(--accent); border-radius:6px; padding:8px 12px; font-size:12px; }
  #toast { position:fixed; left:50%; bottom:24px; transform:translateX(-50%); background:var(--ink-950); color:#fff; padding:9px 16px; border-radius:8px; box-shadow:0 8px 24px rgba(17,19,24,.18); display:none; max-width:min(560px,90vw); z-index:20; }
  #gate { position:fixed; inset:0; background:rgba(246,247,249,.96); display:none; align-items:center; justify-content:center; z-index:30; }
  #gate .box { width:340px; background:#fff; border:1px solid var(--ink-200); border-radius:8px; padding:22px; box-shadow:0 12px 32px rgba(17,19,24,.08); }
  #gate h3 { margin:0 0 4px; font-size:17px; }
  @media (max-width:1023px) { .grid3 { grid-template-columns:repeat(2,minmax(0,1fr)); } }
  @media (max-width:760px) {
    .app { grid-template-columns:1fr; }
    .rail { position:static; height:auto; padding:12px; border-right:none; border-bottom:1px solid var(--ink-200); }
    .rail .nav { display:flex; overflow-x:auto; gap:4px; }
    .rail .nav a { flex:none; }
    .nav-title, .rail .foot { display:none; }
    .brand { padding-bottom:10px; }
    .top, .page { padding-left:14px; padding-right:14px; }
    .grid2, .grid3 { grid-template-columns:1fr; }
    .item { grid-template-columns:32px minmax(0,1fr); }
    .acts { grid-column:2; opacity:1; }
  }
</style>
</head>
<body>
<div id="gate"><div class="box">
  <div id="loginBox">
    <h3>\u7BA1\u7406\u533A</h3>
    <div class="hint" style="margin-bottom:14px">\u8F93\u5165\u7BA1\u7406\u5458\u5BC6\u7801</div>
    <input type="password" id="tokenInput" placeholder="\u5BC6\u7801" onkeydown="if(event.key==='Enter')login()" />
    <div class="row" style="margin-top:14px"><button class="btn pri" onclick="login()">\u8FDB\u5165</button><a href="/" class="hint">\u8FD4\u56DE\u8D44\u6E90\u9875</a></div>
  </div>
  <div id="setupBox" style="display:none">
    <h3>\u8BBE\u7F6E\u7BA1\u7406\u5458\u5BC6\u7801</h3>
    <div class="hint" style="margin-bottom:14px">\u9996\u6B21\u4F7F\u7528\uFF0C\u8BF7\u8BBE\u7F6E\u540E\u53F0\u5BC6\u7801\uFF08\u81F3\u5C11 8 \u4F4D\uFF09\u3002\u8BBE\u7F6E\u540E\u53EA\u80FD\u7528\u8FD9\u4E2A\u5BC6\u7801\u767B\u5F55\u3002</div>
    <input type="password" id="pw1" placeholder="\u5BC6\u7801" style="margin-bottom:8px" />
    <input type="password" id="pw2" placeholder="\u518D\u8F93\u5165\u4E00\u6B21" onkeydown="if(event.key==='Enter')setup()" />
    <div class="row" style="margin-top:14px"><button class="btn pri" onclick="setup()">\u5B8C\u6210\u8BBE\u7F6E</button></div>
  </div>
</div></div>

<div class="app">
  <aside class="rail">
    <div class="brand"><span class="dot"></span>\u514D\u8D39\u8D44\u6E90\u96F7\u8FBE</div>
    <div class="nav-title">\u7BA1\u7406</div>
    <nav class="nav" id="nav">
      <a href="#items" data-p="items">\u8D44\u6E90\u5BA1\u6838 <span class="n" id="navPending"></span></a>
      <a href="#ai" data-p="ai">AI \u5F15\u64CE</a>
      <a href="#search" data-p="search">\u8054\u7F51\u641C\u7D22</a>
      <a href="#push" data-p="push">\u90AE\u4EF6\u4E0E\u63A8\u9001</a>
      <a href="#collect" data-p="collect">\u91C7\u96C6\u4E0E\u8FC7\u6EE4</a>
      <a href="#runs" data-p="runs">\u8FD0\u884C\u8BB0\u5F55</a>
      <a href="#account" data-p="account">\u8D26\u53F7\u4E0E\u5B58\u50A8</a>
    </nav>
    <div class="nav-title">\u5176\u4ED6</div>
    <nav class="nav foot">
      <a href="/" target="_blank">\u8D44\u6E90\u9875 \u2197</a>
      <a href="/feed.xml" target="_blank">RSS \u2197</a>
      <a href="javascript:logout()">\u9000\u51FA\u767B\u5F55</a>
    </nav>
  </aside>

  <main class="main">
    <div class="top">
      <h1 id="title">\u8D44\u6E90\u5BA1\u6838</h1>
      <button class="btn" onclick="runNow(this)">\u7ACB\u5373\u6293\u53D6</button>
      <button class="btn pri" onclick="save(this)">\u4FDD\u5B58\u8BBE\u7F6E</button>
    </div>
    <div class="page">

      <!-- \u8D44\u6E90\u5BA1\u6838 -->
      <div class="panel" id="p-items">
        <div class="tabs">
          <button data-st="approved" onclick="loadItems('approved')">\u5DF2\u901A\u8FC7<span class="n"></span></button>
          <button data-st="pending" onclick="loadItems('pending')">\u5F85\u5224\u5B9A<span class="n"></span></button>
          <button data-st="rejected" onclick="loadItems('rejected')">\u5DF2\u62D2\u7EDD<span class="n"></span></button>
          <span style="flex:1"></span>
          <button class="danger" onclick="clearStatus()" style="color:var(--alert)">\u6E05\u7A7A\u5F53\u524D</button>
        </div>
        <pre id="runOut" style="display:none"></pre>
        <div id="items"></div>
      </div>

      <!-- AI -->
      <div class="panel" id="p-ai">
        <div class="section">
          <header><h2>AI \u5224\u5B9A</h2><label class="sw"><input type="checkbox" data-key="ai_enabled" />\u542F\u7528</label></header>
          <div class="body">
            <div class="callout"><span class="storageNote"></span>\u652F\u6301\u4EFB\u4F55 OpenAI \u517C\u5BB9\u63A5\u53E3\uFF1AOpenAI\u3001DeepSeek\u3001OpenRouter\u3001\u7845\u57FA\u6D41\u52A8\u3001\u5404\u7C7B\u4E2D\u8F6C\u3002</div>
            <div class="grid2">
              <div><label class="f">\u63A5\u53E3\u5730\u5740</label><input type="text" data-key="ai_base_url" placeholder="https://api.openai.com/v1" /></div>
              <div><label class="f">API Key</label><input type="password" data-key="ai_api_key" autocomplete="off" /></div>
            </div>
            <div>
              <label class="f">\u9ED8\u8BA4\u6A21\u578B</label>
              <div class="row">
                <input class="grow" type="text" data-key="ai_model" list="ai-models" placeholder="\u624B\u52A8\u8F93\u5165\uFF0C\u6216\u83B7\u53D6\u5217\u8868\u540E\u9009\u62E9" />
                <datalist id="ai-models"></datalist>
                <select id="ai-select" class="grow" onchange="pick('ai', this.value)"><option value="">\u2014 \u6A21\u578B\u5217\u8868 \u2014</option></select>
                <button class="btn" onclick="fetchModels('ai', this)">\u83B7\u53D6\u6A21\u578B</button>
                <button class="btn" onclick="testModel('ai', this)">\u6D4B\u8BD5</button>
              </div>
            </div>
            <div class="grid3">
              <div><label class="f">\u6BCF\u6B21\u8BF7\u6C42\u5224\u5B9A\u6761\u6570</label><input type="number" data-key="ai_batch_size" min="1" max="20" /></div>
              <div><label class="f">\u6BCF\u6B21\u8FD0\u884C\u6700\u591A\u5224\u5B9A</label><input type="number" data-key="ai_max_items" min="1" /></div>
              <div><label class="f">\u6700\u4F4E\u901A\u8FC7\u5206\u6570</label><input type="number" data-key="ai_min_score" min="0" max="100" /></div>
            </div>
            <div class="hint">AI \u8F93\u51FA\uFF1A\u662F\u5426\u76F8\u5173\u3001\u5206\u7C7B\uFF08\u57DF\u540D / \u4E3B\u673A\uFF09\u3001\u83B7\u53D6\u65B9\u5F0F\u3001\u6CE8\u518C\u662F\u5426\u7B80\u5355\u3001\u4E00\u53E5\u8BDD\u7B80\u4ECB\u30010-100 \u5206\u3002\u672A\u542F\u7528\u65F6\u7528\u5173\u952E\u8BCD\u7C97\u7B5B\u3002</div>
          </div>
        </div>
      </div>

      <!-- \u641C\u7D22 -->
      <div class="panel" id="p-search">
        <div class="section">
          <header><h2>Tavily</h2><label class="sw"><input type="checkbox" data-key="tavily_enabled" />\u542F\u7528</label></header>
          <div class="body">
            <div class="grid2">
              <div><label class="f">API Key\uFF08tvly-\u2026\uFF09</label><input type="password" data-key="tavily_api_key" autocomplete="off" /></div>
              <div><label class="f">\u641C\u7D22\u6DF1\u5EA6</label><select data-key="tavily_depth"><option value="basic">basic\uFF081 credit\uFF09</option><option value="advanced">advanced\uFF082 credits\uFF09</option><option value="fast">fast</option></select></div>
            </div>
            <div class="row"><button class="btn" onclick="testSearch('tavily', this)">\u6D4B\u8BD5\u641C\u7D22</button><span class="hint">\u4E2D\u6587\u67E5\u8BE2\u4F1A\u8BBE\u7F6E language=zh-cn\uFF1B\u53EA\u8981\u4E2D\u6587\u65F6\u5F00\u542F filter_by_language\u3002</span></div>
          </div>
        </div>
        <div class="section">
          <header><h2>Keenable</h2><label class="sw"><input type="checkbox" data-key="keenable_enabled" />\u542F\u7528</label></header>
          <div class="body">
            <div class="grid2">
              <div><label class="f">API Key\uFF08keen_\u2026\uFF0C\u7559\u7A7A\u8D70\u514D\u8D39\u516C\u5171\u63A5\u53E3\uFF09</label><input type="password" data-key="keenable_api_key" autocomplete="off" /></div>
              <div><label class="f">\u6A21\u5F0F</label><select data-key="keenable_mode"><option value="pro">pro\uFF08\u68C0\u7D22\u66F4\u6DF1\uFF09</option><option value="realtime">realtime\uFF08\u66F4\u5FEB\uFF09</option></select></div>
            </div>
            <div class="row"><button class="btn" onclick="testSearch('keenable', this)">\u6D4B\u8BD5\u641C\u7D22</button><span class="hint">\u6309\u53D1\u5E03\u65E5\u671F\u8FC7\u6EE4\uFF0C\u81EA\u52A8\u6392\u9664\u65E0\u65E5\u671F\u9875\u9762\u548C\u5C4F\u853D\u7AD9\u70B9\u3002</span></div>
          </div>
        </div>
        <div class="section">
          <header><h2>\u8054\u7F51\u641C\u7D22\u6A21\u578B</h2><label class="sw"><input type="checkbox" data-key="search_enabled" />\u542F\u7528</label></header>
          <div class="body">
            <div class="grid2">
              <div><label class="f">\u63A5\u53E3\u5730\u5740</label><input type="text" data-key="search_base_url" placeholder="https://api.perplexity.ai" /></div>
              <div><label class="f">API Key</label><input type="password" data-key="search_api_key" autocomplete="off" /></div>
            </div>
            <div>
              <label class="f">\u6A21\u578B</label>
              <div class="row">
                <input class="grow" type="text" data-key="search_model" list="search-models" placeholder="sonar / gpt-4o-search-preview" />
                <datalist id="search-models"></datalist>
                <select id="search-select" class="grow" onchange="pick('search', this.value)"><option value="">\u2014 \u6A21\u578B\u5217\u8868 \u2014</option></select>
                <button class="btn" onclick="fetchModels('search', this)">\u83B7\u53D6\u6A21\u578B</button>
                <button class="btn" onclick="testModel('search', this)">\u6D4B\u8BD5</button>
              </div>
            </div>
            <div><label class="f">\u989D\u5916\u8BF7\u6C42\u53C2\u6570\uFF08JSON\uFF09</label><textarea data-key="search_extra_body" style="min-height:56px"></textarea>
              <div class="hint">OpenAI \u641C\u7D22\u6A21\u578B\u586B {"web_search_options":{}}\uFF1BPerplexity \u53EF\u586B {"search_recency_filter":"month"}\uFF1B\u4E0D\u9700\u8981\u5C31\u586B {}\u3002</div></div>
          </div>
        </div>
        <div class="section">
          <header><h2>\u641C\u7D22\u504F\u597D\u4E0E\u8FC7\u6EE4</h2></header>
          <div class="body">
            <div class="grid2">
              <div><label class="f">\u8BED\u8A00</label><select data-key="search_lang"><option value="zh_first">\u4E2D\u6587\u4F18\u5148\uFF08\u4E0D\u8DB3\u65F6\u8865\u82F1\u6587\uFF09</option><option value="zh_only">\u53EA\u8981\u4E2D\u6587</option><option value="any">\u4E0D\u9650</option></select></div>
              <div><label class="f">\u6BCF\u4E2A\u67E5\u8BE2\u8FD4\u56DE\u6761\u6570</label><input type="number" data-key="search_max_results" min="1" max="50" /></div>
            </div>
            <div class="grid2">
              <div><label class="f">\u641C\u7D22\u8BCD\uFF08Tavily / Keenable\uFF0C\u6BCF\u884C\u4E00\u4E2A\uFF09</label><textarea data-key="search_queries"></textarea></div>
              <div><label class="f">\u5C4F\u853D\u7AD9\u70B9\uFF08\u6BCF\u884C\u4E00\u4E2A\u57DF\u540D\uFF0C\u5BF9\u6240\u6709\u6765\u6E90\u751F\u6548\uFF09</label><textarea data-key="search_block_domains"></textarea></div>
            </div>
            <div class="hint">\u641C\u7D22\u7ED3\u679C\u4F9D\u6B21\u7ECF\u8FC7\uFF1A\u5C4F\u853D\u7AD9\u70B9 \u2192 \u8BED\u8A00 \u2192 \u566A\u97F3\u6807\u9898 \u2192 \u5C4F\u853D\u89C4\u5219 \u2192 \u660E\u663E\u8981\u7ED1\u5361 / \u5B9E\u540D \u2192 \u53D1\u5E03\u65F6\u95F4 \u2192 \u5173\u952E\u8BCD \u2192 AI \u5224\u5B9A\u3002</div>
          </div>
        </div>
      </div>

      <!-- \u63A8\u9001 -->
      <div class="panel" id="p-push">
        <div class="section">
          <header><h2>\u90AE\u4EF6\u65E5\u62A5</h2><label class="sw"><input type="checkbox" data-key="mail_enabled" />\u542F\u7528</label></header>
          <div class="body">
            <div class="grid2">
              <div><label class="f">\u53D1\u9001\u65B9\u5F0F</label><select data-key="mail_provider" onchange="applyShow()"><option value="smtp">SMTP\uFF08\u9ED8\u8BA4 QQ \u90AE\u7BB1\uFF09</option><option value="resend">Resend</option><option value="brevo">Brevo</option><option value="cloudflare">Cloudflare Email Routing</option></select></div>
              <div><label class="f">\u6536\u4EF6\u4EBA\uFF08\u591A\u4E2A\u7528\u9017\u53F7\u5206\u9694\uFF09</label><input type="text" data-key="mail_to" placeholder="me@example.com" /></div>
            </div>
            <div data-show="mail_provider=smtp" class="grid3">
              <div><label class="f">SMTP \u670D\u52A1\u5668</label><input type="text" data-key="smtp_host" /></div>
              <div><label class="f">\u7AEF\u53E3</label><input type="number" data-key="smtp_port" /></div>
              <div><label class="f">\u52A0\u5BC6</label><select data-key="smtp_secure"><option value="ssl">SSL\uFF08465\uFF09</option><option value="starttls">STARTTLS\uFF08587\uFF09</option></select></div>
              <div><label class="f">QQ \u90AE\u7BB1\u8D26\u53F7</label><input type="text" data-key="smtp_user" placeholder="123456@qq.com" /></div>
              <div><label class="f">\u6388\u6743\u7801\uFF08\u4E0D\u662F QQ \u5BC6\u7801\uFF09</label><input type="password" data-key="smtp_pass" autocomplete="off" /></div>
              <div><label class="f">\u53D1\u4EF6\u5730\u5740\uFF08\u7559\u7A7A = \u8D26\u53F7\uFF09</label><input type="text" data-key="mail_from" /></div>
            </div>
            <div data-show="mail_provider=smtp" class="hint">QQ \u90AE\u7BB1 \u2192 \u8BBE\u7F6E \u2192 \u8D26\u53F7\u4E0E\u5B89\u5168 \u2192 \u5B89\u5168\u8BBE\u7F6E \u2192 \u5F00\u542F POP3/IMAP/SMTP \u670D\u52A1\uFF0C\u751F\u6210\u6388\u6743\u7801\u3002QQ \u8981\u6C42\u53D1\u4EF6\u5730\u5740\u4E0E\u767B\u5F55\u8D26\u53F7\u4E00\u81F4\u3002</div>
            <div data-show="mail_provider=resend,brevo" class="grid2">
              <div><label class="f">API Key</label><input type="password" data-key="mail_api_key" autocomplete="off" /></div>
              <div><label class="f">\u53D1\u4EF6\u5730\u5740\uFF08\u9700\u5DF2\u9A8C\u8BC1\u57DF\u540D\uFF09</label><input type="text" data-key="mail_from" class="mirror" /></div>
            </div>
            <div data-show="mail_provider=cloudflare" class="hint">\u9700\u8981\u53D6\u6D88 wrangler.toml \u4E2D [[send_email]] \u7684\u6CE8\u91CA\uFF0C\u53D1\u4EF6\u57DF\u540D\u5F00\u542F Email Routing\uFF0C\u6536\u4EF6\u4EBA\u5728 Email Routing \u4E2D\u9A8C\u8BC1\u3002\u53D1\u4EF6\u5730\u5740\u586B\u4F60\u57DF\u540D\u4E0B\u7684\u5730\u5740\u3002</div>
            <div class="grid3">
              <div><label class="f">\u53D1\u4EF6\u4EBA\u540D\u79F0</label><input type="text" data-key="mail_from_name" /></div>
              <div><label class="f">\u6807\u9898</label><input type="text" data-key="mail_subject" /></div>
              <div><label class="f">\u6BCF\u5C01\u6700\u591A\u6761\u6570</label><input type="number" data-key="mail_max_items" min="1" max="200" /></div>
            </div>
            <div><label class="f">\u8D44\u6E90\u9875\u5730\u5740\uFF08\u90AE\u4EF6\u5E95\u90E8\u201C\u67E5\u770B\u5168\u90E8\u201D\uFF09</label><input type="text" data-key="mail_site_url" placeholder="https://xxx.workers.dev" /></div>
            <div class="row">
              <label class="sw"><input type="checkbox" data-key="mail_only_new" />\u53EA\u63A8\u4E0A\u6B21\u4E4B\u540E\u65B0\u901A\u8FC7\u7684</label>
              <label class="sw"><input type="checkbox" data-key="mail_send_empty" />\u6CA1\u6709\u65B0\u5185\u5BB9\u4E5F\u63A8</label>
            </div>
            <div class="row">
              <button class="btn" onclick="mailPreview(this)">\u9884\u89C8\u90AE\u4EF6</button>
              <button class="btn" onclick="pushAction('test', 'mail', this)">\u53D1\u9001\u6D4B\u8BD5\u90AE\u4EF6</button>
              <span class="hint">\u5148\u4FDD\u5B58\u518D\u6D4B\u8BD5\u3002</span>
            </div>
          </div>
        </div>
        <div class="section">
          <header><h2>Telegram</h2><label class="sw"><input type="checkbox" data-key="telegram_enabled" />\u542F\u7528</label></header>
          <div class="body">
            <div class="grid2">
              <div><label class="f">Bot Token\uFF08@BotFather \u83B7\u53D6\uFF09</label><input type="password" data-key="telegram_bot_token" autocomplete="off" /></div>
              <div><label class="f">Chat ID\uFF08\u4E2A\u4EBA\u6216\u7FA4\u7EC4\uFF09</label><input type="text" data-key="telegram_chat_id" /></div>
            </div>
            <div class="row"><button class="btn" onclick="pushAction('test', 'telegram', this)">\u53D1\u9001\u6D4B\u8BD5\u6D88\u606F</button></div>
          </div>
        </div>
        <div class="row"><button class="btn pri" onclick="pushAction('send', null, this)">\u7ACB\u5373\u63A8\u9001\u65E5\u62A5</button><span class="hint">\u6BCF\u5929\u5B9A\u65F6\u6293\u53D6\u7ED3\u675F\u540E\uFF0C\u6309\u542F\u7528\u7684\u6E20\u9053\u81EA\u52A8\u63A8\u9001\u3002</span></div>
      </div>

      <!-- \u91C7\u96C6\u4E0E\u8FC7\u6EE4 -->
      <div class="panel" id="p-collect">
        <div class="section">
          <header><h2>\u65F6\u6548\u4E0E\u8D28\u91CF</h2></header>
          <div class="body">
            <div class="grid3">
              <div><label class="f">\u6700\u5927\u6D88\u606F\u5E74\u9F84\uFF08\u5929\uFF09</label><input type="number" data-key="max_age_days" min="1" /></div>
              <div><label class="f">\u6570\u636E\u4FDD\u7559\u5929\u6570\uFF08\u6309\u6293\u53D6\u65E5\u671F\uFF0C\u5230\u671F\u81EA\u52A8\u6E05\u7406\uFF09</label><input type="number" data-key="retention_days" min="1" max="365" /></div>
              <div><label class="f">\u65E0\u53D1\u5E03\u65E5\u671F</label><label class="sw" style="margin-top:8px"><input type="checkbox" data-key="keep_undated" />\u4FDD\u7559</label></div>
              <div><label class="f">\u566A\u97F3\u6807\u9898\uFF08\u6C42\u52A9 / \u5410\u69FD\uFF09</label><label class="sw" style="margin-top:8px"><input type="checkbox" data-key="noise_filter" />\u8DF3\u8FC7</label></div>
            </div>
            <div>
              <label class="f">\u5141\u8BB8\u7684\u83B7\u53D6\u65B9\u5F0F</label>
              <div data-csv="allowed_obtain">
                <label class="chk"><input type="checkbox" value="free" />\u76F4\u63A5\u767D\u5AD6</label>
                <label class="chk"><input type="checkbox" value="conditional" />\u6709\u6761\u4EF6</label>
                <label class="chk"><input type="checkbox" value="trial" />\u8BD5\u7528</label>
                <label class="chk"><input type="checkbox" value="lottery" />\u62BD\u5956</label>
                <label class="chk"><input type="checkbox" value="promo" />\u63A8\u5E7F</label>
                <label class="chk"><input type="checkbox" value="paid" />\u9700\u4ED8\u8D39</label>
              </div>
            </div>
            <div><label class="f">\u5C4F\u853D\u89C4\u5219\uFF08\u5173\u952E\u8BCD\u6216 /\u6B63\u5219/\uFF0C\u547D\u4E2D\u76F4\u63A5\u4E22\u5F03\uFF0C\u4E0D\u9001 AI\uFF09</label><textarea data-key="block_rules"></textarea></div>
          </div>
        </div>
        <div class="section">
          <header><h2>\u5173\u952E\u8BCD\u9884\u7B5B</h2></header>
          <div class="body">
            <div class="grid3">
              <div><label class="f">\u4E3B\u9898\u8BCD\uFF08\u547D\u4E2D\u5176\u4E00\uFF09</label><textarea data-key="topic_keywords"></textarea></div>
              <div><label class="f">\u514D\u8D39\u8BCD\uFF08\u547D\u4E2D\u5176\u4E00\uFF09</label><textarea data-key="free_keywords"></textarea></div>
              <div><label class="f">\u590D\u6742\u6CE8\u518C\u8BCD</label><textarea data-key="hard_signup_keywords"></textarea></div>
            </div>
          </div>
        </div>
        <div class="section">
          <header><h2>\u6570\u636E\u6E90</h2></header>
          <div class="body">
            <textarea data-key="sources" style="min-height:300px"></textarea>
            <div class="hint">type\uFF1Arss\uFF08url\uFF09/ v2ex\uFF08node\uFF09/ hn\uFF08query\uFF09/ reddit\uFF08query, subreddit\uFF09/ github\uFF08query\uFF09\u3002enabled:false \u505C\u7528\uFF0Cfilter:false \u8DF3\u8FC7\u5173\u952E\u8BCD\u9884\u7B5B\u3002</div>
          </div>
        </div>
      </div>

      <!-- \u8D26\u53F7\u4E0E\u5B58\u50A8 -->
      <div class="panel" id="p-account">
        <div class="section">
          <header><h2>\u5B58\u50A8</h2></header>
          <div class="body">
            <div id="storageInfo" class="hint"></div>
            <div class="hint">\u8D44\u6E90\u6309\u6293\u53D6\u65E5\u671F\uFF08\u5317\u4EAC\u65F6\u95F4\uFF09\u5B58\u50A8\uFF0C\u9ED8\u8BA4\u4FDD\u7559 15 \u5929\u540E\u81EA\u52A8\u6E05\u7406\uFF1B\u4E3A\u907F\u514D\u91CD\u590D\u63A8\u9001\uFF0C\u201C\u5DF2\u89C1\u8FC7\u201D\u7684\u94FE\u63A5\u8BB0\u5F55\u4FDD\u7559\u5230\u6700\u5927\u6D88\u606F\u5E74\u9F84\u3002\u4FDD\u7559\u5929\u6570\u5728\u300C\u91C7\u96C6\u4E0E\u8FC7\u6EE4\u300D\u91CC\u6539\u3002</div>
          </div>
        </div>
        <div class="section">
          <header><h2>\u7BA1\u7406\u5458\u5BC6\u7801</h2></header>
          <div class="body">
            <div id="pwEnvNote" class="hint" style="display:none">\u5F53\u524D\u4F7F\u7528 Cloudflare \u73AF\u5883\u53D8\u91CF ADMIN_TOKEN \u767B\u5F55\uFF0C\u8BF7\u5728\u63A7\u5236\u53F0\u300C\u8BBE\u7F6E \u2192 \u53D8\u91CF\u548C\u673A\u5BC6\u300D\u4FEE\u6539\u3002</div>
            <div id="pwForm" class="row">
              <input class="grow" type="password" id="newPw" placeholder="\u65B0\u5BC6\u7801\uFF08\u81F3\u5C11 8 \u4F4D\uFF09" />
              <button class="btn" onclick="changePw(this)">\u4FEE\u6539\u5BC6\u7801</button>
            </div>
          </div>
        </div>
      </div>

      <!-- \u8FD0\u884C\u8BB0\u5F55 -->
      <div class="panel" id="p-runs"><div id="runs"></div></div>
    </div>
  </main>
</div>
<div id="toast"></div>

<script>
let TOKEN = localStorage.getItem('frr_token') || '';
let CUR = 'approved';
let SETTINGS = {};
const TITLES = { items: '\u8D44\u6E90\u5BA1\u6838', ai: 'AI \u5F15\u64CE', search: '\u8054\u7F51\u641C\u7D22', push: '\u90AE\u4EF6\u4E0E\u63A8\u9001', collect: '\u91C7\u96C6\u4E0E\u8FC7\u6EE4', runs: '\u8FD0\u884C\u8BB0\u5F55', account: '\u8D26\u53F7\u4E0E\u5B58\u50A8' };
const CAT = { domain: '\u57DF\u540D', hosting: '\u4E3B\u673A', other: '\u5176\u4ED6' };
const OB = { free: '\u76F4\u63A5\u767D\u5AD6', conditional: '\u6709\u6761\u4EF6', lottery: '\u62BD\u5956', trial: '\u8BD5\u7528', promo: '\u63A8\u5E7F', paid: '\u9700\u4ED8\u8D39' };
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmt = (t) => (t ? new Date(t).toLocaleString('zh-CN', { hour12: false }) : '\u2014');
function ago(t) {
  if (!t) return '';
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 60) return Math.max(m, 1) + ' \u5206\u949F\u524D';
  if (m < 1440) return Math.round(m / 60) + ' \u5C0F\u65F6\u524D';
  return Math.round(m / 1440) + ' \u5929\u524D';
}
function toast(msg, ms = 3500) { const t = $('#toast'); t.textContent = msg; t.style.display = 'block'; clearTimeout(t._h); t._h = setTimeout(() => (t.style.display = 'none'), ms); }
let STATUS = { initialized: true, storage: 'd1', env_token: false };
function showGate() {
  $('#gate').style.display = 'flex';
  $('#loginBox').style.display = STATUS.initialized ? '' : 'none';
  $('#setupBox').style.display = STATUS.initialized ? 'none' : '';
  (STATUS.initialized ? $('#tokenInput') : $('#pw1')).focus();
}
async function setup() {
  const a = $('#pw1').value, b = $('#pw2').value;
  if (a.length < 8) return toast('\u5BC6\u7801\u81F3\u5C11 8 \u4F4D');
  if (a !== b) return toast('\u4E24\u6B21\u8F93\u5165\u4E0D\u4E00\u81F4');
  const r = await fetch('/api/admin/setup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: a }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return toast(j.error || '\u8BBE\u7F6E\u5931\u8D25');
  STATUS.initialized = true;
  TOKEN = a; localStorage.setItem('frr_token', TOKEN);
  $('#gate').style.display = 'none';
  toast('\u5BC6\u7801\u5DF2\u8BBE\u7F6E');
  init();
}
function changePw(btn) {
  return busy(btn, async () => {
    const pw = $('#newPw').value;
    await api('/api/admin/password', { method: 'POST', body: JSON.stringify({ password: pw }) });
    TOKEN = pw; localStorage.setItem('frr_token', TOKEN); $('#newPw').value = '';
    toast('\u5BC6\u7801\u5DF2\u4FEE\u6539');
  });
}
function login() { TOKEN = $('#tokenInput').value.trim(); localStorage.setItem('frr_token', TOKEN); $('#gate').style.display = 'none'; init(); }
function logout() { localStorage.removeItem('frr_token'); TOKEN = ''; showGate(); }

async function api(path, opts = {}) {
  const r = await fetch(path, { ...opts, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + TOKEN } });
  const j = await r.json().catch(() => ({ error: '\u54CD\u5E94\u4E0D\u662F JSON\uFF08HTTP ' + r.status + '\uFF09' }));
  if (r.status === 401) { showGate(); throw new Error('\u53E3\u4EE4\u9519\u8BEF'); }
  if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status);
  return j;
}
async function busy(btn, fn) {
  if (btn) btn.disabled = true;
  try { return await fn(); } catch (e) { toast('\u51FA\u9519\uFF1A' + e.message, 7000); } finally { if (btn) btn.disabled = false; }
}

// ---- \u8DEF\u7531 ----
function route() {
  const p = (location.hash || '#items').slice(1);
  const key = TITLES[p] ? p : 'items';
  $$('.panel').forEach((el) => el.classList.toggle('on', el.id === 'p-' + key));
  $$('#nav a').forEach((a) => a.classList.toggle('on', a.dataset.p === key));
  $('#title').textContent = TITLES[key];
  if (key === 'runs' && TOKEN) loadRuns();
}
window.addEventListener('hashchange', route);

// ---- \u8BBE\u7F6E ----
function fill(s) {
  SETTINGS = s;
  $$('[data-key]').forEach((el) => {
    const v = s[el.dataset.key];
    if (el.type === 'checkbox') el.checked = v === 'true'; else el.value = v ?? '';
  });
  $$('[data-csv]').forEach((box) => {
    const vals = String(s[box.dataset.csv] || '').split(',').map((x) => x.trim());
    box.querySelectorAll('input').forEach((i) => (i.checked = vals.includes(i.value)));
  });
  applyShow();
}
function collect() {
  const out = {};
  $$('[data-key]').forEach((el) => {
    if (el.closest('[data-show]') && el.closest('[data-show]').style.display === 'none') return; // \u9690\u85CF\u7684\u91CD\u590D\u5B57\u6BB5\u4E0D\u8986\u76D6
    out[el.dataset.key] = el.type === 'checkbox' ? String(el.checked) : el.value;
  });
  $$('[data-csv]').forEach((box) => { out[box.dataset.csv] = [...box.querySelectorAll('input:checked')].map((i) => i.value).join(','); });
  return out;
}
function applyShow() {
  $$('[data-show]').forEach((el) => {
    const [k, vals] = el.dataset.show.split('=');
    const cur = document.querySelector('select[data-key="' + k + '"]').value;
    el.style.display = vals.split(',').includes(cur) ? '' : 'none';
  });
}
const field = (k) => document.querySelector('[data-key="' + k + '"]');

function save(btn) {
  return busy(btn, async () => {
    const data = collect();
    try { JSON.parse(data.sources); } catch (e) { throw new Error('\u6570\u636E\u6E90 JSON \u683C\u5F0F\u9519\u8BEF\uFF1A' + e.message); }
    try { JSON.parse(data.search_extra_body || '{}'); } catch (e) { throw new Error('\u989D\u5916\u8BF7\u6C42\u53C2\u6570 JSON \u683C\u5F0F\u9519\u8BEF\uFF1A' + e.message); }
    const r = await api('/api/admin/settings', { method: 'PUT', body: JSON.stringify(data) });
    fill(r.settings);
    toast('\u5DF2\u4FDD\u5B58');
  });
}

function fetchModels(target, btn) {
  return busy(btn, async () => {
    const r = await api('/api/admin/models', { method: 'POST', body: JSON.stringify({ target, base_url: field(target + '_base_url').value, api_key: field(target + '_api_key').value }) });
    $('#' + target + '-models').innerHTML = r.models.map((m) => '<option value="' + esc(m) + '">').join('');
    const cur = field(target + '_model').value;
    $('#' + target + '-select').innerHTML = '<option value="">\u2014 \u5171 ' + r.models.length + ' \u4E2A\u6A21\u578B \u2014</option>' + r.models.map((m) => '<option' + (m === cur ? ' selected' : '') + ' value="' + esc(m) + '">' + esc(m) + '</option>').join('');
    toast('\u83B7\u53D6\u5230 ' + r.models.length + ' \u4E2A\u6A21\u578B\uFF0C\u9009\u597D\u540E\u8BB0\u5F97\u4FDD\u5B58');
  });
}
function pick(target, v) { if (v) field(target + '_model').value = v; }
function testModel(target, btn) {
  return busy(btn, async () => {
    const body = { target, base_url: field(target + '_base_url').value, api_key: field(target + '_api_key').value, model: field(target + '_model').value };
    if (target === 'search') body.extra_body = field('search_extra_body').value;
    const r = await api('/api/admin/test', { method: 'POST', body: JSON.stringify(body) });
    toast('\u8FDE\u63A5\u6210\u529F\uFF08' + r.ms + 'ms\uFF09\uFF1A' + r.reply, 6000);
  });
}
function testSearch(provider, btn) {
  return busy(btn, async () => {
    const r = await api('/api/admin/search-test', { method: 'POST', body: JSON.stringify({ provider }) });
    const out = $('#runOut');
    location.hash = '#items';
    out.style.display = 'block';
    out.textContent = provider + ' \u8FD4\u56DE ' + r.count + ' \u6761\uFF08' + r.ms + 'ms\uFF0C\u4F7F\u7528\u5DF2\u4FDD\u5B58\u7684\u8BBE\u7F6E\uFF09\\n' + (r.errors || []).map((e) => '! ' + e + '\\n').join('') + '\\n' + r.sample.map((x) => '\xB7 ' + (x.date || '\u65E0\u65E5\u671F') + '  ' + x.title + '\\n  ' + x.url).join('\\n');
  });
}

function runNow(btn) {
  return busy(btn, async () => {
    toast('\u6B63\u5728\u6293\u53D6\uFF0C\u53EF\u80FD\u9700\u8981\u4E00\u4E24\u5206\u949F\u2026', 120000);
    const r = await api('/api/admin/run', { method: 'POST' });
    location.hash = '#items';
    const out = $('#runOut'); out.style.display = 'block';
    const s = r.stats;
    out.textContent = '\u6293\u5230 ' + s.fetched + ' \xB7 \u5019\u9009 ' + s.candidates + ' \xB7 \u65B0\u589E ' + s.new + ' \xB7 \u5224\u5B9A ' + s.judged + ' \xB7 \u901A\u8FC7 ' + s.approved + ' \xB7 \u9519\u8BEF ' + s.errors +
      '\\n\u8FC7\u6EE4\uFF1A\u8D85\u671F ' + s.too_old + ' \xB7 \u65E0\u65E5\u671F ' + s.undated + ' \xB7 \u4E0D\u76F8\u5173 ' + s.off_topic + ' \xB7 \u566A\u97F3 ' + s.noise + ' \xB7 \u5C4F\u853D ' + (s.block_rule + s.blocked) + ' \xB7 \u91CD\u590D\u6807\u9898 ' + s.dup_title + '\\n\\n' + r.log.join('\\n');
    toast('\u6293\u53D6\u5B8C\u6210\uFF1A\u65B0\u589E ' + s.new + '\uFF0C\u901A\u8FC7 ' + s.approved);
    loadItems(CUR);
  });
}
function pushAction(kind, channel, btn) {
  return busy(btn, async () => {
    const r = await api('/api/admin/mail/' + kind, { method: 'POST', body: JSON.stringify({ channel }) });
    toast(r.skipped ? '\u672A\u53D1\u9001\uFF1A' + r.skipped : '\u5DF2\u53D1\u9001 ' + r.sent + ' \u6761 \u2192 ' + r.to.join(', ') + (r.errors && r.errors.length ? '\uFF1B\u5931\u8D25\uFF1A' + r.errors.join('\uFF1B') : ''), 7000);
  });
}
function mailPreview(btn) {
  return busy(btn, async () => {
    const r = await fetch('/api/admin/mail/preview', { headers: { authorization: 'Bearer ' + TOKEN } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    window.open(URL.createObjectURL(new Blob([await r.text()], { type: 'text/html' })), '_blank');
  });
}

// ---- \u8D44\u6E90 ----
async function loadItems(st) {
  CUR = st;
  $$('.tabs [data-st]').forEach((b) => b.classList.toggle('on', b.dataset.st === st));
  const r = await api('/api/admin/items?status=' + st);
  $$('.tabs [data-st]').forEach((b) => (b.querySelector('.n').textContent = r.counts[b.dataset.st] || 0));
  $('#navPending').textContent = r.counts.pending || '';
  $('#items').innerHTML = r.items.length ? r.items.map((it) => {
    const ob = it.obtain ? '<span class="' + (it.obtain === 'free' ? 'free' : 'cond') + '">' + OB[it.obtain] + '</span>' : '';
    return '<div class="item"><div class="score' + (it.score >= 70 ? ' hi' : '') + '">' + (it.score ?? '\u2014') + '</div><div>' +
      '<a class="t" href="' + esc(it.url) + '" target="_blank" rel="noopener">' + esc(it.name || it.title) + '</a>' + ob +
      (it.summary ? '<div class="sum">' + esc(it.summary) + '</div>' : '') +
      '<div class="meta">' + [esc(it.source), CAT[it.category] || '', it.signup ? '\u6CE8\u518C\uFF1A' + esc(it.signup) : '', ago(it.published_at), it.judged_by ? esc(it.judged_by) : ''].filter(Boolean).join('<i>\xB7</i>') + '</div>' +
      (it.name && it.name !== it.title ? '<div class="meta">' + esc(it.title) + '</div>' : '') +
      '</div><div class="acts">' +
      (st !== 'approved' ? '<button class="btn sm" onclick="setStatus(\\'' + it.id + '\\',\\'approved\\')">\u901A\u8FC7</button>' : '') +
      (st !== 'rejected' ? '<button class="btn sm" onclick="setStatus(\\'' + it.id + '\\',\\'rejected\\')">\u62D2\u7EDD</button>' : '') +
      (st !== 'pending' ? '<button class="btn sm" onclick="setStatus(\\'' + it.id + '\\',\\'pending\\')" title="\u4E0B\u6B21\u8FD0\u884C\u91CD\u65B0\u5224\u5B9A">\u91CD\u5224</button>' : '') +
      '<button class="btn sm danger" onclick="del(\\'' + it.id + '\\')">\u5220\u9664</button></div></div>';
  }).join('') : '<div class="empty">\u6682\u65E0</div>';
}
async function setStatus(id, status) { await busy(null, async () => { await api('/api/admin/items/' + id, { method: 'POST', body: JSON.stringify({ status }) }); loadItems(CUR); }); }
async function del(id) { if (!confirm('\u5220\u9664\u8FD9\u6761\uFF1F')) return; await busy(null, async () => { await api('/api/admin/items/' + id, { method: 'DELETE' }); loadItems(CUR); }); }
async function clearStatus() { if (!confirm('\u6E05\u7A7A\u5F53\u524D\u5206\u7C7B\u7684\u5168\u90E8\u6761\u76EE\uFF1F')) return; await busy(null, async () => { await api('/api/admin/items?status=' + CUR, { method: 'DELETE' }); loadItems(CUR); }); }

async function loadRuns() {
  const runs = await api('/api/admin/runs');
  $('#runs').innerHTML = runs.length ? runs.map((r) => {
    const s = JSON.parse(r.stats || '{}');
    const line = r.trigger === 'mail' ? (r.log || '').split('\\n')[0] : '\u6293\u5230 ' + (s.fetched || 0) + ' \xB7 \u65B0\u589E ' + (s.new || 0) + ' \xB7 \u901A\u8FC7 ' + (s.approved || 0) + ' \xB7 \u9519\u8BEF ' + (s.errors || 0);
    return '<details><summary>' + fmt(r.started_at) + '<span class="hint"> \xB7 ' + esc(r.trigger) + ' \xB7 </span>' + esc(line) + '</summary><pre>' + esc((r.log || '') + '\\n\\n' + JSON.stringify(s, null, 2)) + '</pre></details>';
  }).join('') : '<div class="empty">\u8FD8\u6CA1\u6709\u8FD0\u884C\u8FC7</div>';
}

async function init() {
  route();
  STATUS = await fetch('/api/admin/status').then((r) => r.json()).catch(() => STATUS);
  const where = STATUS.storage === 'kv' ? 'Cloudflare KV' : 'D1 \u72EC\u7ACB\u7684 secrets \u8868';
  $$('.storageNote').forEach((el) => (el.textContent = '\u63A5\u53E3\u5730\u5740\u3001Key\u3001\u6388\u6743\u7801\u7B49\u654F\u611F\u4FE1\u606F\u4FDD\u5B58\u5728 ' + where + '\uFF0C\u540E\u53F0\u53EA\u663E\u793A\u6253\u7801\u503C\u3002'));
  $('#storageInfo').textContent = '\u8D44\u6E90\u4E0E\u8BBE\u7F6E\uFF1AD1 \u6570\u636E\u5E93\u3002\u654F\u611F\u4FE1\u606F\uFF1A' + where + (STATUS.storage === 'kv' ? '' : '\uFF08\u5982\u9700\u6539\u5B58 KV\uFF0C\u7ED9 Worker \u7ED1\u5B9A\u4E00\u4E2A\u53D8\u91CF\u540D\u4E3A SECRETS \u7684 KV \u547D\u540D\u7A7A\u95F4\uFF0C\u91CD\u65B0\u4FDD\u5B58\u4E00\u6B21\u8BBE\u7F6E\u5373\u53EF\uFF09') + '\u3002';
  $('#pwEnvNote').style.display = STATUS.env_token ? '' : 'none';
  $('#pwForm').style.display = STATUS.env_token ? 'none' : '';
  if (!STATUS.initialized || !TOKEN) return showGate();
  try { fill(await api('/api/admin/settings')); await loadItems(CUR); } catch (e) { toast(e.message, 6000); }
}
init();
</script>
</body>
</html>
`;

// src/public.html
var public_default = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>\u514D\u8D39\u8D44\u6E90\u96F7\u8FBE \xB7 \u514D\u8D39\u57DF\u540D\u4E0E\u865A\u62DF\u4E3B\u673A</title>
<meta name="description" content="\u6BCF\u5929\u81EA\u52A8\u6536\u96C6\u534A\u5E74\u5185\u3001\u6CE8\u518C\u7B80\u5355\u7684\u514D\u8D39\u57DF\u540D\u4E0E\u514D\u8D39\u865A\u62DF\u4E3B\u673A\u8D44\u6E90" />
<link rel="alternate" type="application/rss+xml" title="RSS" href="/feed.xml" />
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><circle cx='8' cy='8' r='5' fill='%23312e81'/></svg>" />
<style>
  :root {
    --canvas:#f6f7f9; --canvas-subtle:#eceef2; --surface:#fff; --hover:#f7f8fb; --muted:#f1f3f6;
    --ink-950:#111318; --ink-700:#374151; --ink-600:#4b5563; --ink-500:#525c6b; --ink-400:#646f80; --ink-300:#d1d5de; --ink-200:#e6e8ec;
    --brand-subtle:#eef0ff; --brand-border:#c7d0f8; --accent:#312e81;
    --deal:#047857; --deal-subtle:#ecfdf5; --code:#92400e; --code-subtle:#fef3c7;
    --mono: ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  }
  * { box-sizing:border-box; }
  body { margin:0; font:13px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif; color:var(--ink-950); background:var(--surface); -webkit-font-smoothing:antialiased; }
  ::selection { background:var(--brand-subtle); }
  a { color:inherit; text-decoration:none; }
  .app { display:grid; grid-template-columns:240px minmax(0,1fr); min-height:100vh; }
  .rail { background:var(--canvas); border-right:1px solid var(--ink-200); padding:18px 12px; position:sticky; top:0; height:100vh; overflow:auto; }
  .brand { display:flex; align-items:center; gap:8px; font-weight:600; font-size:14px; padding:2px 8px 14px; }
  .dot { width:8px; height:8px; border-radius:50%; background:var(--accent); flex:none; }
  .search { position:relative; margin:0 2px 6px; }
  .search input { width:100%; height:32px; border:1px solid var(--ink-200); border-radius:6px; padding:0 28px 0 10px; font:inherit; background:#fff; outline:none; }
  .search input:focus { border-color:var(--brand-border); box-shadow:0 0 0 3px var(--brand-subtle); }
  .search kbd { position:absolute; right:8px; top:7px; font:600 11px var(--mono); color:var(--ink-400); border:1px solid var(--ink-200); border-radius:4px; padding:0 4px; background:var(--canvas); }
  .nav-title { font:600 11px/1.3 var(--mono); color:var(--ink-400); text-transform:uppercase; letter-spacing:.04em; padding:14px 8px 6px; }
  .nav a { display:flex; justify-content:space-between; align-items:center; padding:7px 10px; border-radius:6px; color:var(--ink-700); cursor:pointer; }
  .nav a:hover { background:var(--canvas-subtle); }
  .nav a.on { background:var(--canvas-subtle); color:var(--ink-950); font-weight:600; }
  .nav .n { font:600 11px var(--mono); color:var(--ink-400); font-variant-numeric:tabular-nums; }
  .about { color:var(--ink-400); font-size:12px; padding:16px 8px 0; line-height:1.6; }
  .main { min-width:0; }
  .top { position:sticky; top:0; z-index:5; background:rgba(255,255,255,.92); backdrop-filter:blur(8px); border-bottom:1px solid var(--ink-200); padding:14px 28px; display:flex; align-items:center; gap:12px; }
  .top h1 { font-size:17px; font-weight:600; margin:0; }
  .top .count { color:var(--ink-400); font:600 12px var(--mono); flex:1; }
  .seg { display:inline-flex; border:1px solid var(--ink-200); border-radius:6px; overflow:hidden; }
  .seg button { border:none; background:#fff; padding:5px 10px; font:inherit; font-size:12px; color:var(--ink-500); cursor:pointer; }
  .seg button.on { background:var(--ink-950); color:#fff; }
  .list { padding:4px 28px 60px; }
  /* \u7D27\u51D1\u884C */
  .row { display:grid; grid-template-columns:10px 34px minmax(0,1fr) auto; gap:10px; align-items:start; padding:12px 6px; border-bottom:1px solid var(--ink-200); }
  .row:hover { background:var(--hover); }
  .udot { width:7px; height:7px; border-radius:50%; background:var(--accent); margin-top:6px; }
  .udot.old { background:transparent; }
  .score { font:600 12px var(--mono); color:var(--ink-400); text-align:right; padding-top:1px; font-variant-numeric:tabular-nums; }
  .score.hi { color:var(--deal); }
  .t { font-size:14px; font-weight:500; line-height:1.35; word-break:break-word; }
  .t:hover { color:var(--accent); }
  .ob { font-size:12px; margin-left:6px; white-space:nowrap; }
  .ob.free { color:var(--deal); }
  .ob.cond { color:var(--code); }
  .sum { color:var(--ink-600); margin-top:3px; }
  .meta { color:var(--ink-400); font-size:12px; margin-top:3px; }
  .meta i { font-style:normal; margin:0 5px; color:var(--ink-300); }
  .time { font:12px var(--mono); color:var(--ink-400); white-space:nowrap; padding-top:2px; font-variant-numeric:tabular-nums; }
  /* \u5361\u7247\u89C6\u56FE */
  .grid .cards { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; padding-top:16px; }
  .card { border:1px solid var(--ink-200); border-radius:8px; padding:14px; display:flex; flex-direction:column; gap:6px; }
  .card:hover { border-color:var(--ink-300); background:var(--hover); }
  .card .head { display:flex; gap:8px; align-items:center; font-size:12px; color:var(--ink-400); }
  .card .head .score { flex:none; }
  .card .sum { flex:1; }
  .chip { font:600 11px var(--mono); color:var(--code); background:var(--code-subtle); border-radius:4px; padding:1px 6px; }
  .chip.free { color:var(--deal); background:var(--deal-subtle); }
  .empty { color:var(--ink-400); text-align:center; padding:60px 0; }
  .dayh { display:flex; align-items:baseline; gap:8px; padding:20px 6px 8px; border-bottom:1px solid var(--ink-200); position:sticky; top:57px; background:#fff; z-index:2; }
  .dayh b { font-size:13px; font-weight:600; }
  .dayh span { font:600 11px var(--mono); color:var(--ink-400); }
  .grid .dayh { border-bottom:none; padding-bottom:0; position:static; }
  .grid .cards { padding-top:10px; }
  @media (max-width:1023px) { .grid .cards { grid-template-columns:repeat(2,minmax(0,1fr)); } }
  @media (max-width:640px) {
    .app { grid-template-columns:1fr; }
    .rail { position:static; height:auto; padding:12px; border-right:none; border-bottom:1px solid var(--ink-200); }
    .rail .nav { display:flex; overflow-x:auto; gap:4px; }
    .rail .nav a { flex:none; gap:6px; }
    .nav-title, .about { display:none; }
    .search kbd { display:none; }
    .top, .list { padding-left:12px; padding-right:12px; }
    .row { grid-template-columns:30px minmax(0,1fr); }
    .row .udot { display:none; }
    .row .time { grid-column:2; padding:0; }
    .grid .cards { grid-template-columns:1fr; }
  }
</style>
</head>
<body>
<div class="app">
  <aside class="rail">
    <div class="brand"><span class="dot"></span>\u514D\u8D39\u8D44\u6E90\u96F7\u8FBE</div>
    <div class="search"><input id="q" placeholder="\u641C\u7D22\u8D44\u6E90\u2026" /><kbd>/</kbd></div>
    <div class="nav-title">\u9891\u9053</div>
    <nav class="nav" id="cats">
      <a data-c="" class="on">\u5168\u90E8 <span class="n" data-n="all"></span></a>
      <a data-c="domain">\u514D\u8D39\u57DF\u540D <span class="n" data-n="domain"></span></a>
      <a data-c="hosting">\u865A\u62DF\u4E3B\u673A <span class="n" data-n="hosting"></span></a>
    </nav>
    <div class="nav-title">\u83B7\u53D6\u65B9\u5F0F</div>
    <nav class="nav" id="obs">
      <a data-o="" class="on">\u4E0D\u9650</a>
      <a data-o="free">\u76F4\u63A5\u767D\u5AD6 <span class="n" data-n="free"></span></a>
      <a data-o="conditional">\u6709\u6761\u4EF6 <span class="n" data-n="conditional"></span></a>
    </nav>
    <div class="nav-title">\u6309\u65E5\u671F</div>
    <nav class="nav" id="days"><a data-d="" class="on">\u6700\u8FD1 <span class="n" id="retN"></span></a></nav>
    <div class="nav-title">\u8BA2\u9605</div>
    <nav class="nav">
      <a href="/feed.xml" target="_blank">RSS \u2197</a>
      <a href="/admin">\u7BA1\u7406</a>
    </nav>
    <div class="about">\u6BCF\u5929\u81EA\u52A8\u6536\u96C6\u534A\u5E74\u5185\u53D1\u5E03\u3001\u53EA\u9700\u90AE\u7BB1\u6216 GitHub / Google \u767B\u5F55\u5373\u53EF\u6CE8\u518C\u7684\u514D\u8D39\u57DF\u540D\u4E0E\u865A\u62DF\u4E3B\u673A\uFF0C\u7ECF AI \u7B5B\u9009\u3002<br><span id="updated"></span></div>
  </aside>
  <main class="main">
    <div class="top">
      <h1 id="title">\u5168\u90E8\u8D44\u6E90</h1>
      <span class="count" id="count"></span>
      <div class="seg" id="view"><button data-v="list">\u5217\u8868</button><button data-v="grid">\u5361\u7247</button></div>
    </div>
    <div class="list" id="list"><div class="empty">\u52A0\u8F7D\u4E2D\u2026</div></div>
  </main>
</div>
<script>
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const CAT = { domain: '\u514D\u8D39\u57DF\u540D', hosting: '\u865A\u62DF\u4E3B\u673A', other: '\u5176\u4ED6' };
const OB = { free: '\u76F4\u63A5\u767D\u5AD6', conditional: '\u6709\u6761\u4EF6', lottery: '\u62BD\u5956', trial: '\u8BD5\u7528', promo: '\u63A8\u5E7F', paid: '\u9700\u4ED8\u8D39' };
const state = { cat: '', ob: '', day: '', today: '', view: localStorage.getItem('frr_view') || 'list', timer: 0 };
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
function ago(t) {
  if (!t) return '';
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 60) return Math.max(m, 1) + '\u5206\u949F\u524D';
  if (m < 1440) return Math.round(m / 60) + '\u5C0F\u65F6\u524D';
  if (m < 43200) return Math.round(m / 1440) + '\u5929\u524D';
  return new Date(t).toLocaleDateString('zh-CN');
}
const obTag = (o, cls) => (o ? '<span class="' + cls + (o === 'free' ? ' free' : ' cond') + '">' + OB[o] + '</span>' : '');

function rowHtml(it) {
  const fresh = it.published_at && Date.now() - it.published_at < 3 * 86400000;
  return '<div class="row"><span class="udot' + (fresh ? '' : ' old') + '" title="' + (fresh ? '3 \u5929\u5185' : '') + '"></span>' +
    '<span class="score' + (it.score >= 70 ? ' hi' : '') + '">' + (it.score ?? '\xB7') + '</span><div>' +
    '<a class="t" href="' + esc(it.url) + '" target="_blank" rel="noopener">' + esc(it.name || it.title) + '</a>' + obTag(it.obtain, 'ob') +
    (it.summary ? '<div class="sum">' + esc(it.summary) + '</div>' : '') +
    '<div class="meta">' + [CAT[it.category] || '', it.signup ? '\u6CE8\u518C\uFF1A' + esc(it.signup) : '', esc(it.source || '')].filter(Boolean).join('<i>\xB7</i>') + '</div></div>' +
    '<span class="time">' + ago(it.published_at) + '</span></div>';
}
function cardHtml(it) {
  return '<a class="card" href="' + esc(it.url) + '" target="_blank" rel="noopener">' +
    '<div class="head"><span class="score' + (it.score >= 70 ? ' hi' : '') + '">' + (it.score ?? '\xB7') + '</span><span>' + (CAT[it.category] || '') + '</span><span style="flex:1"></span>' + obTag(it.obtain, 'chip') + '</div>' +
    '<div class="t">' + esc(it.name || it.title) + '</div>' +
    (it.summary ? '<div class="sum">' + esc(it.summary) + '</div>' : '<div class="sum"></div>') +
    '<div class="meta">' + [it.signup ? '\u6CE8\u518C\uFF1A' + esc(it.signup) : '', ago(it.published_at)].filter(Boolean).join('<i>\xB7</i>') + '</div></a>';
}

async function load() {
  const p = new URLSearchParams({ limit: '200' });
  if (state.cat) p.set('category', state.cat);
  if (state.ob) p.set('obtain', state.ob);
  if (state.day) p.set('day', state.day);
  const q = $('#q').value.trim();
  if (q) p.set('q', q);
  const items = await fetch('/api/items?' + p).then((r) => r.json()).catch(() => []);
  const el = $('#list');
  el.className = 'list ' + state.view;
  $('#count').textContent = Array.isArray(items) ? items.length + ' \u6761' : '';
  if (!Array.isArray(items) || !items.length) { el.innerHTML = '<div class="empty">\u6682\u65F6\u6CA1\u6709\u7B26\u5408\u6761\u4EF6\u7684\u8D44\u6E90</div>'; return; }
  const groups = [];
  for (const it of items) {
    const d = it.day || '';
    if (!groups.length || groups[groups.length - 1].d !== d) groups.push({ d, list: [] });
    groups[groups.length - 1].list.push(it);
  }
  el.innerHTML = groups.map((g) => '<div class="dayh"><b>' + dayLabel(g.d) + '</b><span>' + g.list.length + ' \u6761</span></div>' +
    (state.view === 'grid' ? '<div class="cards">' + g.list.map(cardHtml).join('') + '</div>' : g.list.map(rowHtml).join(''))).join('');
}
function dayLabel(d) {
  if (!d) return '\u66F4\u65E9';
  const [y, m, dd] = d.split('-').map(Number);
  const diff = state.today ? Math.round((Date.parse(state.today) - Date.parse(d)) / 86400000) : -1;
  const rel = diff === 0 ? ' \xB7 \u4ECA\u5929' : diff === 1 ? ' \xB7 \u6628\u5929' : '';
  return m + '\u6708' + dd + '\u65E5' + rel;
}
async function loadStats() {
  const s = await fetch('/api/stats').then((r) => r.json()).catch(() => null);
  if (!s) return;
  $$('[data-n]').forEach((el) => (el.textContent = s[el.dataset.n] ?? ''));
  state.today = s.today || '';
  $('#retN').textContent = s.retention_days ? s.retention_days + '\u5929' : '';
  $('#days').innerHTML = '<a data-d="" class="' + (state.day ? '' : 'on') + '">\u6700\u8FD1 <span class="n">' + (s.retention_days || 15) + '\u5929</span></a>' +
    (s.days || []).slice(0, 15).map((x) => '<a data-d="' + x.day + '" class="' + (state.day === x.day ? 'on' : '') + '">' + dayLabel(x.day) + ' <span class="n">' + x.n + '</span></a>').join('');
  $$('#days a').forEach((a) => (a.onclick = () => { state.day = a.dataset.d; setActive('#days', 'd', state.day); load(); }));
  if (s.last_run) $('#updated').textContent = '\u6700\u8FD1\u66F4\u65B0\uFF1A' + new Date(s.last_run).toLocaleString('zh-CN', { hour12: false });
}

function setActive(groupSel, attr, val) { $$(groupSel + ' a').forEach((a) => a.classList.toggle('on', a.dataset[attr] === val)); }
$$('#cats a').forEach((a) => (a.onclick = () => { state.cat = a.dataset.c; setActive('#cats', 'c', state.cat); $('#title').textContent = state.cat ? CAT[state.cat] : '\u5168\u90E8\u8D44\u6E90'; load(); }));
$$('#obs a').forEach((a) => (a.onclick = () => { state.ob = a.dataset.o; setActive('#obs', 'o', state.ob); load(); }));
$$('#view button').forEach((b) => {
  b.classList.toggle('on', b.dataset.v === state.view);
  b.onclick = () => { state.view = b.dataset.v; localStorage.setItem('frr_view', state.view); $$('#view button').forEach((x) => x.classList.toggle('on', x === b)); load(); };
});
$('#q').oninput = () => { clearTimeout(state.timer); state.timer = setTimeout(load, 250); };
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && document.activeElement !== $('#q')) { e.preventDefault(); $('#q').focus(); }
  if (e.key === 'Escape') { $('#q').value = ''; $('#q').blur(); load(); }
});
loadStats().then(load);
</script>
</body>
</html>
`;

// src/index.js
var json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8" } });
var html = (body, status = 200) => new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8" } });
function safeEqual(a, b) {
  const x = new TextEncoder().encode(String(a));
  const y = new TextEncoder().encode(String(b));
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0;
}
async function isAdmin(req, env) {
  const got = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!got) return false;
  if (env.ADMIN_TOKEN) return safeEqual(got, env.ADMIN_TOKEN);
  const h = await getAdminHash(env);
  return !!h && safeEqual(await sha256("frr:" + got), h);
}
function resolveAi(target, body, s) {
  const p = target === "search" ? "search" : "ai";
  const key = body.api_key && !String(body.api_key).includes("****") ? body.api_key : s[`${p}_api_key`];
  return { baseUrl: body.base_url || s[`${p}_base_url`], apiKey: key, model: body.model || s[`${p}_model`], extra: p === "search" ? body.extra_body ?? s.search_extra_body : "{}" };
}
async function publicItems(env, url) {
  const s = await getSettings(env);
  const cutoff = Date.now() - (Number(s.max_age_days) || 180) * 864e5;
  const where = ["status = 'approved'", "(published_at IS NULL OR published_at >= ?)"];
  const args = [cutoff];
  const ob = url.searchParams.get("obtain");
  if (ob) {
    where.push("obtain = ?");
    args.push(ob);
  }
  const cat = url.searchParams.get("category");
  if (cat) {
    where.push("category = ?");
    args.push(cat);
  }
  const day = url.searchParams.get("day");
  if (day) {
    where.push("day = ?");
    args.push(day);
  }
  const q = url.searchParams.get("q");
  if (q) {
    where.push("(title LIKE ? OR summary LIKE ? OR name LIKE ?)");
    args.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  const limit = Math.min(200, Number(url.searchParams.get("limit")) || 100);
  const { results } = await env.DB.prepare(
    `SELECT id, title, url, source, published_at, fetched_at, day, category, name, summary, signup, score, obtain FROM items WHERE ${where.join(" AND ")} ORDER BY day DESC, score DESC, published_at DESC LIMIT ?`
  ).bind(...args, limit).all();
  return results || [];
}
var xmlEsc = (s) => String(s ?? "").replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]);
async function handleAdmin(req, env, url) {
  const p = url.pathname.replace("/api/admin", "");
  const m = req.method;
  const body = m === "GET" || m === "DELETE" ? {} : await req.json().catch(() => ({}));
  if (p === "/settings" && m === "GET") return json(settingsForAdmin(await getSettings(env)));
  if (p === "/settings" && m === "PUT") {
    try {
      await saveSettings(env, body);
    } catch (e) {
      return json({ error: `\u4FDD\u5B58\u5931\u8D25\uFF1A${e.message}` }, 400);
    }
    return json({ ok: true, settings: settingsForAdmin(await getSettings(env)) });
  }
  if (p === "/models" && m === "POST") {
    const s = await getSettings(env);
    const c = resolveAi(body.target, body, s);
    if (!c.baseUrl || !c.apiKey) return json({ error: "\u8BF7\u5148\u586B\u5199\u63A5\u53E3\u5730\u5740\u548C Key" }, 400);
    return json({ models: await listModels(c.baseUrl, c.apiKey) });
  }
  if (p === "/test" && m === "POST") {
    const s = await getSettings(env);
    const c = resolveAi(body.target, body, s);
    let extra = {};
    try {
      extra = JSON.parse(c.extra || "{}");
    } catch {
    }
    const t0 = Date.now();
    const reply = await chat({ baseUrl: c.baseUrl, apiKey: c.apiKey, model: c.model, extra, messages: [{ role: "user", content: "\u53EA\u56DE\u590D OK" }], timeout: 6e4 });
    return json({ ok: true, reply: reply.slice(0, 200), ms: Date.now() - t0 });
  }
  if (p === "/run" && m === "POST") return json(await runCrawl(env, "manual"));
  if (p === "/search-test" && m === "POST") {
    const s = await getSettings(env);
    const fn = body.provider === "keenable" ? searchKeenable : searchTavily;
    const t0 = Date.now();
    const r = await fn(s, Number(s.max_age_days) || 180);
    return json({ ok: true, ms: Date.now() - t0, count: r.items.length, errors: r.errors, sample: r.items.slice(0, 8).map((x) => ({ title: x.title, url: x.url, date: x.published_at ? new Date(x.published_at).toISOString().slice(0, 10) : null })) });
  }
  if (p === "/mail/test" && m === "POST") return json(await sendDigest(env, { force: true, test: true, channel: body.channel === "telegram" ? "telegram" : "mail" }));
  if (p === "/mail/send" && m === "POST") return json(await sendDigest(env, { force: true }));
  if (p === "/mail/preview" && m === "GET") return html(await previewDigest(env));
  if (p === "/runs" && m === "GET") {
    const { results } = await env.DB.prepare("SELECT * FROM runs ORDER BY id DESC LIMIT 20").all();
    return json(results || []);
  }
  if (p === "/items" && m === "GET") {
    const status = url.searchParams.get("status") || "approved";
    const { results } = await env.DB.prepare("SELECT * FROM items WHERE status = ? ORDER BY published_at DESC LIMIT 300").bind(status).all();
    const { results: counts } = await env.DB.prepare("SELECT status, COUNT(*) AS n FROM items GROUP BY status").all();
    return json({ items: results || [], counts: Object.fromEntries((counts || []).map((r) => [r.status, r.n])) });
  }
  const im = p.match(/^\/items\/([0-9a-f]+)$/);
  if (im && m === "POST") {
    if (!["approved", "rejected", "pending"].includes(body.status)) return json({ error: "status \u65E0\u6548" }, 400);
    await env.DB.prepare("UPDATE items SET status = ?, judged_by = ?, judged_at = ?, attempts = 0 WHERE id = ?").bind(body.status, "manual", Date.now(), im[1]).run();
    return json({ ok: true });
  }
  if (im && m === "DELETE") {
    await env.DB.prepare("DELETE FROM items WHERE id = ?").bind(im[1]).run();
    return json({ ok: true });
  }
  if (p === "/items" && m === "DELETE") {
    const status = url.searchParams.get("status");
    if (!status) return json({ error: "\u9700\u8981 status" }, 400);
    await env.DB.prepare("DELETE FROM items WHERE status = ?").bind(status).run();
    return json({ ok: true });
  }
  return json({ error: "Not found" }, 404);
}
function setupMissing(env) {
  const m = [];
  if (!env.DB || typeof env.DB.prepare !== "function") m.push(["DB", "D1 \u6570\u636E\u5E93", "Worker \u2192 \u7ED1\u5B9A \u2192 \u6DFB\u52A0\u7ED1\u5B9A \u2192 D1 \u6570\u636E\u5E93\uFF0C\u53D8\u91CF\u540D\u586B DB\uFF0C\u9009\u62E9\uFF08\u6216\u65B0\u5EFA\uFF09\u4E00\u4E2A\u6570\u636E\u5E93"]);
  return m;
}
function setupPage(missing, asJson) {
  if (asJson) return json({ error: "\u90E8\u7F72\u672A\u5B8C\u6210\uFF0C\u7F3A\u5C11\uFF1A" + missing.map((x) => x[0]).join(", ") }, 503);
  const rows = missing.map(([k, n, how]) => `<li><b>${k}</b>\uFF08${n}\uFF09<br><span>${how}</span></li>`).join("");
  return html(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>\u8FD8\u5DEE\u4E00\u6B65 \xB7 \u514D\u8D39\u8D44\u6E90\u96F7\u8FBE</title>
<style>body{margin:0;background:#f6f7f9;font:14px/1.6 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#111318}.b{max-width:560px;margin:10vh auto;background:#fff;border:1px solid #e6e8ec;border-radius:8px;padding:24px 28px}h1{font-size:17px;margin:0 0 6px}p{color:#525c6b;margin:0 0 14px}li{margin-bottom:12px}li span{color:#4b5563;font-size:13px}code{background:#f1f3f6;padding:1px 5px;border-radius:4px}</style>
<div class="b"><h1>\u90E8\u7F72\u6210\u529F\uFF0C\u8FD8\u5DEE\u4E00\u6B65</h1><p>\u5728 Cloudflare \u63A7\u5236\u53F0\u6253\u5F00\u8FD9\u4E2A Worker\uFF0C\u8865\u4E0A\u4EE5\u4E0B\u7ED1\u5B9A\u540E\u5237\u65B0\u672C\u9875\u3002\u6570\u636E\u8868\u4F1A\u81EA\u52A8\u521B\u5EFA\uFF0C\u7BA1\u7406\u5458\u5BC6\u7801\u5728\u9996\u6B21\u6253\u5F00 /admin \u65F6\u8BBE\u7F6E\u3002</p><ol>${rows}</ol><p>\u5B9A\u65F6\u6293\u53D6\uFF1A\u8BBE\u7F6E \u2192 \u89E6\u53D1\u4E8B\u4EF6 \u2192 \u6DFB\u52A0 Cron\uFF0C\u586B <code>0 1 * * *</code>\uFF08\u5317\u4EAC 09:00\uFF09\u3002\u7528 GitHub \u90E8\u7F72\u7684\u8BDD\u5DF2\u81EA\u52A8\u914D\u7F6E\u3002</p></div></html>`, 503);
}
var index_default = {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const missing = setupMissing(env);
    if (missing.length) return setupPage(missing, url.pathname.startsWith("/api/"));
    try {
      await ensureSchema(env);
      if (url.pathname === "/" || url.pathname === "/index.html") return html(public_default);
      if (url.pathname === "/admin" || url.pathname === "/admin/") return html(admin_default);
      if (url.pathname === "/api/items") return json(await publicItems(env, url));
      if (url.pathname === "/api/stats") {
        const st = await getSettings(env);
        const cutoff = Date.now() - (Number(st.max_age_days) || 180) * 864e5;
        const base = "FROM items WHERE status = 'approved' AND (published_at IS NULL OR published_at >= ?)";
        const [cats, obs, last, days] = await Promise.all([
          env.DB.prepare(`SELECT category AS k, COUNT(*) AS n ${base} GROUP BY category`).bind(cutoff).all(),
          env.DB.prepare(`SELECT obtain AS k, COUNT(*) AS n ${base} GROUP BY obtain`).bind(cutoff).all(),
          env.DB.prepare("SELECT MAX(finished_at) AS t FROM runs WHERE trigger != 'mail'").first(),
          env.DB.prepare(`SELECT day AS d, COUNT(*) AS n ${base} AND day IS NOT NULL GROUP BY day ORDER BY day DESC LIMIT 31`).bind(cutoff).all()
        ]);
        const out = { all: 0, last_run: last?.t || null, today: dayOf(Date.now()), retention_days: Number(st.retention_days) || 15, days: (days.results || []).map((r) => ({ day: r.d, n: r.n })) };
        for (const r of cats.results || []) {
          out[r.k || "other"] = r.n;
          out.all += r.n;
        }
        for (const r of obs.results || []) if (r.k) out[r.k] = r.n;
        return json(out);
      }
      if (url.pathname === "/feed.xml") {
        const items = await publicItems(env, new URL(url.origin + "/?limit=50"));
        const body = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>\u514D\u8D39\u57DF\u540D / \u865A\u62DF\u4E3B\u673A\u8D44\u6E90</title><link>${xmlEsc(url.origin)}</link><description>\u6BCF\u65E5\u81EA\u52A8\u6293\u53D6\u5E76\u7ECF AI \u7B5B\u9009</description>${items.map((it) => `<item><title>${xmlEsc(it.name || it.title)}</title><link>${xmlEsc(it.url)}</link><guid isPermaLink="false">${it.id}</guid>${it.published_at ? `<pubDate>${new Date(it.published_at).toUTCString()}</pubDate>` : ""}<description>${xmlEsc([it.summary, it.signup && "\u6CE8\u518C\uFF1A" + it.signup].filter(Boolean).join(" | "))}</description></item>`).join("")}</channel></rss>`;
        return new Response(body, { headers: { "content-type": "application/rss+xml; charset=utf-8" } });
      }
      if (url.pathname.startsWith("/api/admin/")) {
        if (url.pathname === "/api/admin/status") {
          return json({ initialized: !!env.ADMIN_TOKEN || !!await getAdminHash(env), env_token: !!env.ADMIN_TOKEN, storage: storageMode(env) });
        }
        if (url.pathname === "/api/admin/setup" && req.method === "POST") {
          if (env.ADMIN_TOKEN || await getAdminHash(env)) return json({ error: "\u5DF2\u7ECF\u8BBE\u7F6E\u8FC7\u7BA1\u7406\u5458\u5BC6\u7801" }, 409);
          const { password } = await req.json().catch(() => ({}));
          if (!password || String(password).length < 8) return json({ error: "\u5BC6\u7801\u81F3\u5C11 8 \u4F4D" }, 400);
          await setAdminHash(env, String(password));
          return json({ ok: true });
        }
        if (!await isAdmin(req, env)) return json({ error: "\u672A\u6388\u6743" }, 401);
        if (url.pathname === "/api/admin/password" && req.method === "POST") {
          if (env.ADMIN_TOKEN) return json({ error: "\u5F53\u524D\u4F7F\u7528\u73AF\u5883\u53D8\u91CF ADMIN_TOKEN\uFF0C\u8BF7\u5728 Cloudflare \u63A7\u5236\u53F0\u4FEE\u6539" }, 400);
          const { password } = await req.json().catch(() => ({}));
          if (!password || String(password).length < 8) return json({ error: "\u5BC6\u7801\u81F3\u5C11 8 \u4F4D" }, 400);
          await setAdminHash(env, String(password));
          return json({ ok: true });
        }
        return await handleAdmin(req, env, url);
      }
      return json({ error: "Not found" }, 404);
    } catch (e) {
      return json({ error: e.message || String(e) }, 500);
    }
  },
  async scheduled(event, env, ctx) {
    const missing = setupMissing(env);
    if (missing.length) {
      console.error("\u90E8\u7F72\u672A\u5B8C\u6210\uFF0C\u7F3A\u5C11\u7ED1\u5B9A\uFF1A" + missing.map((x) => x[0]).join(", "));
      return;
    }
    await ensureSchema(env);
    ctx.waitUntil((async () => {
      try {
        await runCrawl(env, "cron");
      } catch (e) {
        console.error("crawl failed", e);
      }
      try {
        const r = await sendDigest(env);
        await env.DB.prepare("INSERT INTO runs (trigger, started_at, finished_at, stats, log) VALUES (?, ?, ?, ?, ?)").bind("mail", Date.now(), Date.now(), JSON.stringify(r), r.skipped ? `\u63A8\u9001\u8DF3\u8FC7\uFF1A${r.skipped}` : `\u2713 \u5DF2\u63A8\u9001 ${r.sent} \u6761\uFF08${r.providers.join(" + ")}\uFF09\u2192 ${r.to.join(", ")}${r.errors.length ? "\n\u2717 " + r.errors.join("\n\u2717 ") : ""}`).run();
      } catch (e) {
        console.error("digest failed", e);
        await env.DB.prepare("INSERT INTO runs (trigger, started_at, finished_at, stats, log) VALUES (?, ?, ?, ?, ?)").bind("mail", Date.now(), Date.now(), "{}", `\u2717 \u63A8\u9001\u5931\u8D25\uFF1A${e.message}`).run();
      }
    })());
  }
};
export {
  index_default as default
};
